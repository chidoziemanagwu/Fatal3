const express = require('express');
const axios = require('axios');
const { parse } = require('csv-parse/sync');
const bcrypt = require('bcrypt');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const pool = require('./db');
const path = require('path');

const app = express();

// Clean URL routes
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/settings', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'settings.html'));
});

app.get('/hfs', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'hfs.html'));
});

app.get('/pfs', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pfs.html'));
});


app.post('/api/subscription', async (req, res) => {
  const { userId, plan } = req.body;
  try {
    await pool.query(
      'INSERT INTO subscriptions (user_id, plan, status) VALUES (\$1, \$2, \$3)',
      [userId, plan, 'active']
    );
    res.json({ status: 'Subscription created' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});


// In your Express server file
// Add this endpoint to your server.js
app.get('/api/players/:id', async (req, res) => {
  try {
      const playerId = req.params.id;
      console.log('Fetching player with ID:', playerId);

      // First try to fetch from hitters
      const hfsResponse = await fetch('http://localhost:3000/api/hfs');
      if (!hfsResponse.ok) {
          throw new Error('Failed to fetch hitter data');
      }
      const hitters = await hfsResponse.json();

      // Then fetch from pitchers
      const pfsResponse = await fetch('http://localhost:3000/api/pfs');
      if (!pfsResponse.ok) {
          throw new Error('Failed to fetch pitcher data');
      }
      const pitchers = await pfsResponse.json();

      console.log('Data fetched successfully');
      console.log('Number of hitters:', hitters.length);
      console.log('Number of pitchers:', pitchers.length);

      // Find the player in either dataset
      const player = [...hitters, ...pitchers].find(p => String(p.playerid) === String(playerId));

      if (!player) {
          console.log('Player not found');
          return res.status(404).json({ 
              error: 'Player not found',
              searchedId: playerId
          });
      }

      console.log('Found player:', player.name);

      // Format the response
      const playerData = {
          id: player.playerid,
          name: player.name,
          team: player.team || 'N/A',
          position: player.Pos || 'N/A',
          currentStats: {},
          rank: player.Rank || 'N/A',
          availability: player.Availability || 'Unknown'
      };

      // Add stats based on position
      if (player.Pos && (player.Pos.includes('SP') || player.Pos.includes('RP'))) {
          playerData.currentStats = {
              wins: player.W || 0,
              saves: player.SV || 0,
              strikeouts: player.K || 0,
              era: player.ERA || '0.00',
              whip: player.WHIP || '0.00'
          };
      } else {
          playerData.currentStats = {
              homeRuns: player.HR || 0,
              runs: player.R || 0,
              rbi: player.RBI || 0,
              stolenBases: player.SB || 0,
              avg: player.AVG || '.000'
          };
      }

      // Add performance metrics
      playerData.metrics = {
          fgScore: player.fgScore || 0,
          statcastScore: player.statcastScore || 0,
          combinedScore: player.combinedScore || 0
      };

      console.log('Sending response:', playerData);
      res.json(playerData);

  } catch (error) {
      console.error('Server Error:', error);
      res.status(500).json({ 
          error: 'Internal server error', 
          message: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
  }
});


app.use(express.static('public'));
app.use(express.json());

app.use(session({
  store: new pgSession({
    pool: pool,
    tableName: 'session'
  }),
  secret: 'some_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24*60*60*1000 }
}));

function normalizeName(name) {
  if(!name||typeof name!=='string')return '';
  name=name.replace(/<[^>]*>/g,'');
  let cleaned=name.normalize('NFD').replace(/[\u0300-\u036f]/g,"");
  cleaned=cleaned.trim().toLowerCase();
  if(cleaned.includes(',')) {
    const parts=cleaned.split(',').map(p=>p.trim());
    if(parts.length===2) {
      cleaned=parts[1]+' '+parts[0];
    }
  }
  return cleaned;
}

let settings={
  RWeight:1,HRWeight:3,HWeight:1,SBWeight:1,BBWeight:1,RBIWeight:1,KWeight:1,HFGFactor:1,
  HBAFactor:130,HEstBAFactor:260,HSLGFactor:80,HEstSLGFactor:180,HEstWOBARactor:150,HStatcastWeight:0.8,HFGWeight:1,
  HPAFactor:0.08,HKpctFactor:100,HBABIPFactor:80,HwOBAFactor:100,HOPSFactor:60,HSpdFactor:4,HSoftWeight:1,

  PSVWeight:5,PWWeight:5,PSOWeight:1,PIPWeight:3,PHWeight:1,PLWeight:5,PERWeight:2,PBBWeight:1,PHoldWeight:0,PFGFactor:2,
  PERAFactor:13,PWHIPFactor:40,PAVGFactor:250,PTBFFactor:0.03,PK9Factor:6,PBB9Factor:12,PHR9Factor:30,PFGWeight:2,

  PEstBAFactor:260,PSLGFactor:40,PEstSLGFactor:80,PWOBFactor:50,PEstWOBAFactor:120,PXERAFactor:10,PStatcastWeight:1
};

async function fetchHitterProjectionsFG() {
  const url='https://www.fangraphs.com/api/projections?type=steamer&stats=bat&pos=all&team=0&players=0&lg=all';
  const response=await axios.get(url);
  const data=response.data;
  
  data.forEach(player => {
    // Parse K% safely, defaulting to 0 if not available
    const Kpct = typeof player['K%'] === 'string' ? parseFloat(player['K%']) : player['K%'] || 0;
    
    // Calculate hard score using counting stats
    const hard = (
      (player.R * settings.RWeight) +      // Runs
      (player.HR * settings.HRWeight) +    // Home Runs
      (player.H * settings.HWeight) +      // Hits
      (player.SB * settings.SBWeight) +    // Stolen Bases
      (player.BB * settings.BBWeight) +    // Walks
      (player.RBI * settings.RBIWeight) -  // RBIs
      (player.SO * settings.KWeight)       // Strikeouts (negative)
    ) * settings.HFGFactor;               // Apply overall factor
    
    // Calculate soft score using rate stats and advanced metrics
    const soft = (
      (player.PA * settings.HPAFactor) +           // Plate Appearances
      (-Kpct * settings.HKpctFactor) +             // Strikeout Rate (negative)
      (player.BABIP * settings.HBABIPFactor) +     // BABIP
      (player.wOBA * settings.HwOBAFactor) +       // Weighted On-Base Average
      (player.OPS * settings.HOPSFactor) +         // On-base Plus Slugging
      (player.Spd * settings.HSpdFactor)           // Speed Score
    ) * settings.HSoftWeight;                      // Apply overall weight
    
    // Combine scores
    player.score = hard + soft;
  });
  
  return data;
}

async function fetchPitcherProjectionsFG() {
  const url='https://www.fangraphs.com/api/projections?pos=&stats=pit&type=steamer&statgroup=standard';
  const response=await axios.get(url);
  const data=response.data;
  
  data.forEach(player => {
    // Calculate basic score using counting stats
    const basic = (
      (player.SV * settings.PSVWeight) +     // Saves
      (player.W * settings.PWWeight) +       // Wins
      (player.SO * settings.PSOWeight) +     // Strikeouts
      (player.IP * settings.PIPWeight) -     // Innings Pitched
      (player.H * settings.PHWeight) -       // Hits (negative)
      (player.L * settings.PLWeight) -       // Losses (negative)
      (player.ER * settings.PERWeight) -     // Earned Runs (negative)
      (player.BB * settings.PBBWeight) +     // Walks (negative)
      (player.H * settings.PHoldWeight)      // Holds
    ) * settings.PFGFactor;                  // Apply overall factor
    
    // Calculate advanced stats score
    const adv = (
      (player.ERA * settings.PERAFactor) +         // ERA
      (player.WHIP * settings.PWHIPFactor) +       // WHIP
      (player.AVG * settings.PAVGFactor) -         // Batting Average Against
      (player.TBF * settings.PTBFFactor) -         // Total Batters Faced (negative)
      (player['K/9'] * settings.PK9Factor) +       // K/9
      (player['BB/9'] * settings.PBB9Factor) +     // BB/9
      (player['HR/9'] * settings.PHR9Factor)       // HR/9
    );
    
    // Final score is basic stats minus advanced stats (higher advanced stats are generally worse)
    player.score = basic - adv;
  });
  
  return data;
}

async function fetchHitterStatcast() {
  const url='https://baseballsavant.mlb.com/leaderboard/expected_statistics?type=batter&year=2024&position=&team=&filterType=bip&min=50&csv=true';
  const response=await axios.get(url);
  let records=parse(response.data,{columns:true,skip_empty_lines:true});
  
  records.forEach(player => {
    // Parse all required stats, defaulting to 0 if not available
    const ba = parseFloat(player.ba) || 0;           // Batting Average
    const est_ba = parseFloat(player.est_ba) || 0;   // Expected BA
    const slg = parseFloat(player.slg) || 0;         // Slugging
    const est_slg = parseFloat(player.est_slg) || 0; // Expected SLG
    const est_woba = parseFloat(player.est_woba) || 0; // Expected wOBA
    
    // Calculate Statcast Score using actual and expected stats
    const StatcastScore = (
      (ba * settings.HBAFactor) +              // Actual BA
      (est_ba * settings.HEstBAFactor) +       // Expected BA
      (slg * settings.HSLGFactor) +            // Actual SLG
      (est_slg * settings.HEstSLGFactor) +     // Expected SLG
      (est_woba * settings.HEstWOBARactor)     // Expected wOBA
    ) * settings.HStatcastWeight;              // Apply overall weight
    
    player.score = StatcastScore;
  });
  
  return records;
}

async function fetchPitcherStatcast() {
  const url='https://baseballsavant.mlb.com/leaderboard/expected_statistics?type=pitcher&year=2024&position=&team=&min=1&csv=true';
  const response=await axios.get(url);
  let records=parse(response.data,{columns:true,skip_empty_lines:true});
  
  records.forEach(player => {
    // Parse all required stats, defaulting to 0 if not available
    const est_ba = parseFloat(player.est_ba) || 0;     // Expected BA
    const slg = parseFloat(player.slg) || 0;           // Actual SLG
    const est_slg = parseFloat(player.est_slg) || 0;   // Expected SLG
    const woba = parseFloat(player.woba) || 0;         // Actual wOBA
    const est_woba = parseFloat(player.est_woba) || 0; // Expected wOBA
    const xera = parseFloat(player.xera) || 0;         // Expected ERA
    
    // Calculate Statcast penalty (higher values are worse for pitchers)
    const StatcastPenalty = (
      (est_ba * settings.PEstBAFactor) +        // Expected BA
      (slg * settings.PSLGFactor) +             // Actual SLG
      (est_slg * settings.PEstSLGFactor) +      // Expected SLG
      (woba * settings.PWOBFactor) +            // Actual wOBA
      (est_woba * settings.PEstWOBAFactor) +    // Expected wOBA
      (xera * settings.PXERAFactor)             // Expected ERA
    ) * settings.PStatcastWeight;               // Apply overall weight
    
    player.score = StatcastPenalty;
  });
  
  return records;
}

function assignPositionRanks(players){
  const posGroups={};
  players.forEach(player=>{
    const p=player.Pos||'Unknown';
    if(!posGroups[p])posGroups[p]=[];
    posGroups[p].push(player);
  });
  for(const p in posGroups){
    posGroups[p].sort((a,b)=>b.combinedScore - a.combinedScore);
    posGroups[p].forEach((player,idx)=>{
      player.PositionRank=idx+1;
    });
  }
}

function normalizeData(data,fgKey='PlayerName'){
  const map={};
  data.forEach(p=>{
    const pid=p.playerid?p.playerid.toString():null;
    const key=pid?pid:normalizeName(p[fgKey]||p.Name);
    map[key]=p;
  });
  return map;
}

async function getCurrentLeagueId(req) {
  if(!req.session.userId)return null;
  if(!req.session.currentLeagueId)return null;
  const leagueRes=await pool.query(`SELECT id FROM leagues WHERE id=$1 AND user_id=$2`,[req.session.currentLeagueId,req.session.userId]);
  if(leagueRes.rows.length===0)return null;
  return leagueRes.rows[0].id;
}

async function getTakenPlayersForLeague(leagueId) {
  if(!leagueId)return {};
  // JOIN teams to get team name
  const tpRes=await pool.query(`
    SELECT taken_players.player_id, teams.name AS team_name
    FROM taken_players
    LEFT JOIN teams ON taken_players.team_id=teams.id
    WHERE taken_players.league_id=$1
  `,[leagueId]);
  const result={};
  tpRes.rows.forEach(r=>{
    result[r.player_id]=r.team_name||'Taken';
  });
  return result;
}

async function setPlayerTeamInLeague(leagueId,playerid,team) {
  if(!leagueId)return;
  // If no team, remove from taken_players
  const check=await pool.query(`SELECT id FROM taken_players WHERE league_id=$1 AND player_id=$2`,[leagueId,playerid]);
  if(!team||team.trim()==='') {
    if(check.rows.length>0) {
      await pool.query(`DELETE FROM taken_players WHERE league_id=$1 AND player_id=$2`,[leagueId,playerid]);
    }
  } else {
    // find or create team
    let teamRes=await pool.query(`SELECT id FROM teams WHERE league_id=$1 AND name=$2`,[leagueId,team.trim()]);
    let team_id;
    if(teamRes.rows.length===0){
      // create team
      const newTeam=await pool.query(`INSERT INTO teams(league_id,name) VALUES($1,$2) RETURNING id`,[leagueId,team.trim()]);
      team_id=newTeam.rows[0].id;
    }else{
      team_id=teamRes.rows[0].id;
    }

    if(check.rows.length===0) {
      await pool.query(`INSERT INTO taken_players(league_id,player_id,team_id) VALUES($1,$2,$3)`,[leagueId,playerid,team_id]);
    } else {
      await pool.query(`UPDATE taken_players SET team_id=$1 WHERE league_id=$2 AND player_id=$3`,[team_id,leagueId,playerid]);
    }
  }
}

async function deleteLeague(leagueId,userId){
  const check=await pool.query(`SELECT id FROM leagues WHERE id=$1 AND user_id=$2`,[leagueId,userId]);
  if(check.rows.length===0) {
    throw new Error('League not found or not owned by user');
  }
  await pool.query(`DELETE FROM taken_players WHERE league_id=$1`,[leagueId]);
  await pool.query(`DELETE FROM teams WHERE league_id=$1`,[leagueId]);
  await pool.query(`DELETE FROM leagues WHERE id=$1`,[leagueId]);
}

async function deleteTeam(leagueId,teamId){
  // Because of FK with ON DELETE CASCADE on taken_players->teams, deleting team will remove those entries
  const teamRes=await pool.query(`SELECT id FROM teams WHERE id=$1 AND league_id=$2`,[teamId,leagueId]);
  if(teamRes.rows.length===0) {
    throw new Error('Team not found in league');
  }
  await pool.query(`DELETE FROM teams WHERE id=$1 AND league_id=$2`,[teamId,leagueId]);
}

async function renameTeam(leagueId,teamId,newName){
  const teamRes=await pool.query(`SELECT id FROM teams WHERE id=$1 AND league_id=$2`,[teamId,leagueId]);
  if(teamRes.rows.length===0) {
    throw new Error('Team not found in league');
  }
  // Just update team name
  await pool.query(`UPDATE teams SET name=$1 WHERE id=$2 AND league_id=$3`,[newName,teamId,leagueId]);
}

async function getHitterData(){
  const [fgData,scData]=await Promise.all([
    fetchHitterProjectionsFG(),
    fetchHitterStatcast()
  ]);

  const fgMap=normalizeData(fgData,'PlayerName');
  const scMap={};
  scData.forEach(player=>{
    const norm=normalizeName(player['last_name, first_name']);
    scMap[norm]=player;
  });

  const allScScores=scData.map(p=>p.score);
  const avgScScore=allScScores.length>0?allScScores.reduce((a,b)=>a+b,0)/allScScores.length:0;

  const combined=[];
  for(const key in fgMap) {
    const fgPlayer=fgMap[key];
    const normName=normalizeName(fgPlayer.PlayerName);
    let StatcastScore=avgScScore;
    if(scMap[normName]) {
      StatcastScore=scMap[normName].score;
    }
    const finalScore=(fgPlayer.score+StatcastScore)*settings.HFGWeight;
    combined.push({
      playerid: fgPlayer.playerid ? fgPlayer.playerid.toString() : null,
      name: fgPlayer.PlayerName,
      fgScore: fgPlayer.score,
      statcastScore: StatcastScore,
      combinedScore: finalScore,
      Pos: fgPlayer.minpos,
      HR: Math.round(fgPlayer.HR || 0),
      R: Math.round(fgPlayer.R || 0),
      RBI: Math.round(fgPlayer.RBI || 0),
      SB: Math.round(fgPlayer.SB || 0),
      AVG: fgPlayer.AVG ? fgPlayer.AVG.toFixed(3) : '0.000'
    });
  }

  combined.sort((a,b)=>b.combinedScore - a.combinedScore);
  combined.forEach((p,i)=>p.Rank=i+1);
  assignPositionRanks(combined);
  return combined;
}

async function getPitcherData(){
  const [fgData,scData]=await Promise.all([
    fetchPitcherProjectionsFG(),
    fetchPitcherStatcast()
  ]);

  const fgMap=normalizeData(fgData,'PlayerName');
  const scMap={};
  scData.forEach(player=>{
    const norm=normalizeName(player['last_name, first_name']);
    scMap[norm]=player;
  });

  const allScScores=scData.map(p=>p.score);
  const avgScScore=allScScores.length>0?allScScores.reduce((a,b)=>a+b,0)/allScScores.length:0;

  const combined=[];
  for(const key in fgMap){
    const fgPlayer=fgMap[key];
    const normName=normalizeName(fgPlayer.PlayerName||fgPlayer.Name);
    let StatcastPenalty=avgScScore;
    if(scMap[normName]) {
      StatcastPenalty=scMap[normName].score;
    }
    const finalScore=((fgPlayer.score*settings.PFGWeight)-StatcastPenalty);

    const G=parseFloat(fgPlayer.G)||0;
    const GS=parseFloat(fgPlayer.GS)||0;
    let Pos='Unknown';
    if(G>0){
      const gsPerG=GS/G;
      Pos=gsPerG>0.5?'SP':'RP';
    }

    combined.push({
      playerid: fgPlayer.playerid ? fgPlayer.playerid.toString() : null,
      name: fgPlayer.PlayerName || fgPlayer.Name,
      fgScore: fgPlayer.score,
      statcastScore: StatcastPenalty,
      combinedScore: finalScore,
      Pos,
      W: Math.round(fgPlayer.W || 0),
      SV: Math.round(fgPlayer.SV || 0),
      ERA: fgPlayer.ERA ? fgPlayer.ERA.toFixed(2) : '0.00',
      WHIP: fgPlayer.WHIP ? fgPlayer.WHIP.toFixed(2) : '0.00',
      K: Math.round(fgPlayer.SO || 0)
    });
  }

  combined.sort((a,b)=>b.combinedScore - a.combinedScore);
  combined.forEach((p,i)=>p.Rank=i+1);
  assignPositionRanks(combined);
  return combined;
}

app.get('/api/settings',(req,res)=>{
  res.json(settings);
});

app.post('/api/settings',(req,res)=>{
  const newSettings=req.body;
  for(const key in newSettings){
    if(settings.hasOwnProperty(key)){
      settings[key]=Number(newSettings[key]);
    }
  }
  res.json({status:'Settings updated',settings});
});

app.get('/api/hitter-projections-fg',async(req,res)=>{
  try {
    const data=await fetchHitterProjectionsFG();
    res.json(data);
  }catch(err){
    res.status(500).json({error:'Failed to fetch data'});
  }
});

app.get('/api/pitcher-projections-fg',async(req,res)=>{
  try {
    const data=await fetchPitcherProjectionsFG();
    res.json(data);
  }catch(err){
    res.status(500).json({error:'Failed to fetch data'});
  }
});

app.get('/api/hitter-statcast',async(req,res)=>{
  try {
    const records=await fetchHitterStatcast();
    res.json(records);
  }catch(err){
    res.status(500).json({error:'Failed to fetch data'});
  }
});

app.get('/api/pitcher-statcast',async(req,res)=>{
  try {
    const records=await fetchPitcherStatcast();
    res.json(records);
  }catch(err){
    res.status(500).json({error:'Failed to fetch data'});
  }
});

app.get('/api/hfs',async(req,res)=>{
  try {
    const hitters=await getHitterData();
    const leagueId=await getCurrentLeagueId(req);
    const takenPlayers=leagueId?await getTakenPlayersForLeague(leagueId):{};
    hitters.forEach(player=>{
      const pid=player.playerid?`id-${player.playerid}`:`name-${normalizeName(player.name)}`;
      const isTaken=takenPlayers[pid];
      player.Availability=isTaken?'Taken':'Available';
      player.team=isTaken?isTaken:'Available';
    });
    res.json(hitters);
  }catch(e){
    res.status(500).json({error:'Failed to combine data'});
  }
});

app.get('/api/pfs',async(req,res)=>{
  try {
    const pitchers=await getPitcherData();
    const leagueId=await getCurrentLeagueId(req);
    const takenPlayers=leagueId?await getTakenPlayersForLeague(leagueId):{};
    pitchers.forEach(player=>{
      const pid=player.playerid?`id-${player.playerid}`:`name-${normalizeName(player.name)}`;
      const isTaken=takenPlayers[pid];
      player.Availability=isTaken?'Taken':'Available';
      player.team=isTaken?isTaken:'Available';
    });
    res.json(pitchers);
  }catch(e){
    res.status(500).json({error:'Failed to combine data'});
  }
});

app.get('/api/combined',async(req,res)=>{
  try {
    const hitters=await getHitterData();
    const pitchers=await getPitcherData();

    const maxHitter=Math.max(...hitters.map(h=>h.combinedScore))||1;
    const maxPitcher=Math.max(...pitchers.map(p=>p.combinedScore))||1;

    const scaleFactor=maxPitcher===0?1:(maxHitter/maxPitcher);
    const scaledPitchers=pitchers.map(p=>{
      let scaled=p.combinedScore*scaleFactor;
      scaled=Math.pow(scaled/maxHitter,0.8)*maxHitter;
      scaled+=maxHitter*0.05;
      return {...p,combinedScore:scaled};
    });

    const combined=[...hitters,...scaledPitchers];
    combined.sort((a,b)=>b.combinedScore - a.combinedScore);
    combined.forEach((player,i)=>{
      player.Rank=i+1;
    });

    const leagueId=await getCurrentLeagueId(req);
    const takenPlayers=leagueId?await getTakenPlayersForLeague(leagueId):{};
    combined.forEach(player=>{
      const pid=player.playerid?`id-${player.playerid}`:`name-${normalizeName(player.name)}`;
      const isTaken=takenPlayers[pid];
      player.Availability=isTaken?'Taken':'Available';
      player.team=isTaken?isTaken:'Available';
    });

    res.json(combined);
  }catch(err){
    res.status(500).json({error:'Failed to combine data'});
  }
});

const bcryptRounds=10;
app.post('/register',async(req,res)=>{
  const {username,password}=req.body;
  if(!username||!password)return res.status(400).json({error:'Username and password required'});
  const hash=await bcrypt.hash(password,bcryptRounds);
  try{
    await pool.query(`INSERT INTO users(username,password_hash) VALUES($1,$2)`,[username,hash]);
    const userRes=await pool.query(`SELECT id FROM users WHERE username=$1`,[username]);
    req.session.userId=userRes.rows[0].id;
    req.session.username=username;
    res.json({status:'Registered'});
  }catch(e){
    res.status(400).json({error:'Username may already exist'});
  }
});

app.post('/login',async(req,res)=>{
  const {username,password}=req.body;
  if(!username||!password)return res.status(400).json({error:'Username and password required'});
  const userRes=await pool.query(`SELECT id,password_hash FROM users WHERE username=$1`,[username]);
  if(userRes.rows.length===0)return res.status(400).json({error:'Invalid credentials'});
  const user=userRes.rows[0];
  const valid=await bcrypt.compare(password,user.password_hash);
  if(!valid)return res.status(400).json({error:'Invalid credentials'});
  req.session.userId=user.id;
  req.session.username=username;
  res.json({status:'Logged in'});
});

app.post('/logout',(req,res)=>{
  req.session.destroy(err=>{
    if(err)return res.status(500).json({error:'Failed to logout'});
    res.json({status:'Logged out'});
  });
});

app.get('/api/check-login', async (req, res) => {
  if (req.session.userId && req.session.username) {
    // Fetch favorite league and team
    const userRes = await pool.query(
      'SELECT favorite_league_id, favorite_team_id FROM users WHERE id = $1',
      [req.session.userId]
    );
    
    // If there's a favorite team, get its name
    let favoriteTeamName = null;
    if (userRes.rows[0].favorite_team_id) {
      const teamRes = await pool.query(
        'SELECT name FROM teams WHERE id = $1',
        [userRes.rows[0].favorite_team_id]
      );
      if (teamRes.rows.length > 0) {
        favoriteTeamName = teamRes.rows[0].name;
      }
    }

    res.json({
      loggedIn: true,
      username: req.session.username,
      currentLeagueId: req.session.currentLeagueId || userRes.rows[0].favorite_league_id || null,
      favoriteLeagueId: userRes.rows[0].favorite_league_id || null,
      favoriteTeamId: userRes.rows[0].favorite_team_id || null,
      favoriteTeamName: favoriteTeamName
    });
  } else {
    res.json({ loggedIn: false });
  }
});

app.get('/leagues',async(req,res)=>{
  if(!req.session.userId)return res.status(401).json({error:'Not logged in'});
  const leaguesRes=await pool.query(`SELECT id,name FROM leagues WHERE user_id=$1 ORDER BY id`,[req.session.userId]);
  res.json(leaguesRes.rows);
});

app.post('/create-league',async(req,res)=>{
  if(!req.session.userId)return res.status(401).json({error:'Not logged in'});
  const {name}=req.body;
  if(!name)return res.status(400).json({error:'League name required'});
  const leagueRes=await pool.query(`INSERT INTO leagues(user_id,name) VALUES($1,$2) RETURNING id,name`,[req.session.userId,name]);
  res.json(leagueRes.rows[0]);
});

app.post('/select-league',async(req,res)=>{
  if(!req.session.userId)return res.status(401).json({error:'Not logged in'});
  const {leagueId}=req.body;
  if(!leagueId)return res.status(400).json({error:'leagueId required'});
  const check=await pool.query(`SELECT id FROM leagues WHERE id=$1 AND user_id=$2`,[leagueId,req.session.userId]);
  if(check.rows.length===0)return res.status(400).json({error:'Invalid league'});
  req.session.currentLeagueId=leagueId;
  res.json({status:'League selected'});
});

app.post('/delete-league',async(req,res)=>{
  if(!req.session.userId)return res.status(401).json({error:'Not logged in'});
  const {leagueId}=req.body;
  if(!leagueId)return res.status(400).json({error:'leagueId required'});
  try{
    await deleteLeague(leagueId,req.session.userId);
    if(req.session.currentLeagueId==leagueId){
      delete req.session.currentLeagueId;
    }
    res.json({status:'League deleted'});
  }catch(e){
    res.status(400).json({error:e.message});
  }
});

app.get('/teams',async(req,res)=>{
  if(!req.session.userId)return res.status(401).json({error:'Not logged in'});
  const leagueId=await getCurrentLeagueId(req);
  if(!leagueId)return res.json([]);
  const t=await pool.query(`SELECT id,name FROM teams WHERE league_id=$1 ORDER BY name`,[leagueId]);
  res.json(t.rows);
});

app.post('/create-team',async(req,res)=>{
  if(!req.session.userId)return res.status(401).json({error:'Not logged in'});
  const leagueId=await getCurrentLeagueId(req);
  if(!leagueId)return res.status(400).json({error:'No league selected'});
  const {teamName}=req.body;
  if(!teamName||!teamName.trim())return res.status(400).json({error:'Team name required'});
  const teamRes=await pool.query(`INSERT INTO teams(league_id,name) VALUES($1,$2) RETURNING id,name`,[leagueId,teamName.trim()]);
  res.json({status:'Team created',team:teamRes.rows[0]});
});

app.post('/delete-team',async(req,res)=>{
  if(!req.session.userId)return res.status(401).json({error:'Not logged in'});
  const leagueId=await getCurrentLeagueId(req);
  if(!leagueId)return res.status(400).json({error:'No league selected'});
  const {teamId}=req.body;
  if(!teamId)return res.status(400).json({error:'teamId required'});
  try{
    await deleteTeam(leagueId,teamId);
    res.json({status:'Team deleted'});
  }catch(e){
    res.status(400).json({error:e.message});
  }
});

app.post('/rename-team',async(req,res)=>{
  if(!req.session.userId)return res.status(401).json({error:'Not logged in'});
  const leagueId=await getCurrentLeagueId(req);
  if(!leagueId)return res.status(400).json({error:'No league selected'});
  const {teamId,newName}=req.body;
  if(!teamId||!newName||!newName.trim())return res.status(400).json({error:'teamId and newName required'});
  try{
    await renameTeam(leagueId,teamId,newName.trim());
    res.json({status:'Team renamed'});
  }catch(e){
    res.status(400).json({error:e.message});
  }
});

app.post('/update-player-team',async(req,res)=>{
  if(!req.session.userId)return res.status(401).json({error:'Not logged in'});
  const leagueId=await getCurrentLeagueId(req);
  if(!leagueId)return res.status(400).json({error:'No league selected'});
  const {playerid,team}=req.body;
  if(!playerid)return res.status(400).json({error:'playerid is required'});
  await setPlayerTeamInLeague(leagueId,playerid,team);
  res.json({status:'Player updated'});
});

app.get('/api/export-league/:leagueId', async (req, res) => {
  try {
    const { leagueId } = req.params;
    const userId = req.session.userId;

    if (!userId) return res.status(401).json({ error: 'Not logged in' });

    // Verify league ownership
    const leagueData = await pool.query(
      'SELECT * FROM leagues WHERE id = $1 AND user_id = $2',
      [leagueId, userId]
    );

    if (leagueData.rows.length === 0) {
      return res.status(403).json({ error: 'League not found or access denied' });
    }

    // Fetch teams data
    const teamsData = await pool.query(
      'SELECT * FROM teams WHERE league_id = $1',
      [leagueId]
    );

    // Fetch taken players data
    const takenPlayersData = await pool.query(
      'SELECT * FROM taken_players WHERE league_id = $1',
      [leagueId]
    );

    const exportData = {
      league: leagueData.rows[0],
      teams: teamsData.rows,
      takenPlayers: takenPlayersData.rows,
      exportDate: new Date().toISOString()
    };

    res.json(exportData);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Export failed' });
  }
});

app.post('/api/import-league', async (req, res) => {
  try {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });

    const importData = req.body;

    await pool.query('BEGIN');

    // Insert league
    const leagueResult = await pool.query(
      'INSERT INTO leagues (name, user_id) VALUES ($1, $2) RETURNING id',
      [importData.league.name, req.session.userId]
    );
    const newLeagueId = leagueResult.rows[0].id;

    // Insert teams
    const teamMapping = {};
    for (const team of importData.teams) {
      const result = await pool.query(
        'INSERT INTO teams (name, league_id) VALUES ($1, $2) RETURNING id',
        [team.name, newLeagueId]
      );
      teamMapping[team.id] = result.rows[0].id;
    }

    // Insert taken players with mapped team IDs
    for (const player of importData.takenPlayers) {
      await pool.query(
        'INSERT INTO taken_players (league_id, player_id, team_id) VALUES ($1, $2, $3)',
        [newLeagueId, player.player_id, teamMapping[player.team_id]]
      );
    }

    await pool.query('COMMIT');
    res.json({ success: true, leagueId: newLeagueId });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Import error:', error);
    res.status(500).json({ error: 'Import failed' });
  }
});

app.post('/api/set-favorite-league', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
  const { leagueId } = req.body;
  
  try {
    // Verify league exists and belongs to user
    const leagueCheck = await pool.query(
      'SELECT id FROM leagues WHERE id = $1 AND user_id = $2',
      [leagueId, req.session.userId]
    );
    if (leagueCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid league' });
    }

    await pool.query(
      'UPDATE users SET favorite_league_id = $1 WHERE id = $2',
      [leagueId, req.session.userId]
    );
    res.json({ status: 'Favorite league updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update favorite league' });
  }
});

app.post('/api/set-favorite-team', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
  const { teamId } = req.body;
  
  try {
    // Verify team exists in one of user's leagues
    const teamCheck = await pool.query(
      'SELECT t.id FROM teams t JOIN leagues l ON t.league_id = l.id WHERE t.id = $1 AND l.user_id = $2',
      [teamId, req.session.userId]
    );
    if (teamCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid team' });
    }

    await pool.query(
      'UPDATE users SET favorite_team_id = $1 WHERE id = $2',
      [teamId, req.session.userId]
    );
    res.json({ status: 'Favorite team updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update favorite team' });
  }
});

async function calculateLeagueRankings(leagueId) {
  if (!leagueId) {
      throw new Error('League ID is required');
  }

  try {
      // Convert leagueId to integer
      const numericLeagueId = parseInt(leagueId, 10);
      if (isNaN(numericLeagueId)) {
          throw new Error('Invalid league ID format');
      }

      // First verify the league exists
      const leagueCheck = await pool.query(
          'SELECT id FROM leagues WHERE id = \$1',
          [numericLeagueId]
      );

      if (leagueCheck.rows.length === 0) {
          throw new Error('League not found');
      }

      // Get all teams in league with their players and scores
      const teamScoresQuery = await pool.query(`
          WITH player_scores AS (
              SELECT 
                  tp.team_id,
                  COALESCE(SUM(CASE 
                      WHEN p.stats->>'combinedScore' IS NOT NULL 
                      THEN (p.stats->>'combinedScore')::float 
                      ELSE 0 
                  END), 0) as total_score
              FROM teams t
              LEFT JOIN taken_players tp ON t.id = tp.team_id
              LEFT JOIN player_profiles p ON tp.player_id = p.player_id::text
              WHERE t.league_id = \$1
              GROUP BY tp.team_id
          )
          SELECT 
              t.id as team_id,
              t.name as team_name,
              COALESCE(ps.total_score, 0) as score
          FROM teams t
          LEFT JOIN player_scores ps ON t.id = ps.team_id
          WHERE t.league_id = \$1
          ORDER BY ps.total_score DESC NULLS LAST`,
          [numericLeagueId]
      );

      // Transform query results into rankings
      const rankings = teamScoresQuery.rows.map((team, index) => ({
          team_id: team.team_id,
          team_name: team.team_name,
          rank: index + 1,
          score: parseFloat(team.score) || 0
      }));

      // Update rankings in database
      await Promise.all(rankings.map(team => 
          pool.query(
              `INSERT INTO league_rankings (league_id, team_id, rank, score)
               VALUES (\$1, \$2, \$3, \$4)
               ON CONFLICT (league_id, team_id) 
               DO UPDATE SET rank = \$3, score = \$4`,
              [numericLeagueId, team.team_id, team.rank, team.score]
          )
      ));

      return rankings;

  } catch (error) {
      console.error('Error calculating rankings:', error);
      throw error;
  }
}

// Update the API endpoint
app.get('/api/league/:id/rankings', async (req, res) => {
  try {
      const { id } = req.params;
      
      if (!id || id === 'null' || id === 'undefined') {
          return res.status(400).json({ error: 'Valid league ID is required' });
      }

      const numericId = parseInt(id, 10);
      if (isNaN(numericId)) {
          return res.status(400).json({ error: 'League ID must be a number' });
      }

      const rankings = await calculateLeagueRankings(numericId);
      res.json(rankings);
  } catch (err) {
      console.error('Error fetching rankings:', err);
      res.status(500).json({ 
          error: 'Failed to fetch league rankings',
          message: err.message 
      });
  }
});

// Add these endpoints
// In server.js
app.get('/api/player/historical-stats', async (req, res) => {
  try {
      const { name } = req.query;

      if (!name) {
          return res.status(400).json({ error: 'Player name is required' });
      }

      console.log('Fetching historical stats for player:', name);

      // Fetch historical stats using BaseballStatsAPI
      const historicalStats = await BaseballStatsAPI.fetchHistoricalStats(null, name);

      res.json(historicalStats);
  } catch (error) {
      console.error('Error fetching historical stats:', error);
      res.status(500).json({ error: 'Failed to fetch historical stats' });
  }
});

app.get('/api/player/positions', async (req, res) => {
  try {
      const { name } = req.query;

      if (!name) {
          return res.status(400).json({ error: 'Player name is required' });
      }

      console.log('Fetching positions for player:', name);

      // Fetch player positions using BaseballStatsAPI
      const positions = await BaseballStatsAPI.fetchPlayerPositions(null, name);

      res.json(positions);
  } catch (error) {
      console.error('Error fetching player positions:', error);
      res.status(500).json({ error: 'Failed to fetch player positions' });
  }
});


app.get('/api/player/:id/statcast', async (req, res) => {
  try {
      const { id } = req.params;
      const statcastData = await BaseballStatsAPI.fetchStatcastData(id);
      res.json(statcastData);
  } catch (error) {
      console.error('Error fetching Statcast data:', error);
      res.status(500).json({ error: 'Failed to fetch Statcast data' });
  }
});


// Add API for category leaders
app.get('/api/league/:id/category-leaders', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT 
        t.name AS team_name,
        SUM(CASE WHEN p.HR >= 1 THEN 1 ELSE 0 END) AS hr_leaders,
        SUM(CASE WHEN p.RBI >= 1 THEN 1 ELSE 0 END) AS rbi_leaders,
        AVG(p.AVG) AS avg_leaders
      FROM teams t
      JOIN taken_players tp ON t.id = tp.team_id
      JOIN player_profiles p ON tp.player_id = p.id
      WHERE t.league_id = \$1
      GROUP BY t.id, t.name
    `, [id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch category leaders' });
  }
});

// Add API for head-to-head records
app.get('/api/league/:id/head-to-head', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT 
        team1.name AS team1_name,
        team2.name AS team2_name,
        h2h.wins_team1,
        h2h.wins_team2
      FROM head_to_head h2h
      JOIN teams team1 ON h2h.team1_id = team1.id
      JOIN teams team2 ON h2h.team2_id = team2.id
      WHERE h2h.league_id = \$1
    `, [id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch head-to-head records' });
  }
});

// Add API for historical rankings
app.get('/api/league/:id/historical-rankings', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT 
        team_id, 
        rank, 
        score, 
        created_at 
      FROM league_rankings
      WHERE league_id = \$1
      ORDER BY created_at DESC
    `, [id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch historical rankings' });
  }
});

// Add API for exporting league data
app.get('/api/league/:id/export', async (req, res) => {
  const { id } = req.params;
  try {
    const leagueData = await pool.query('SELECT * FROM leagues WHERE id = \$1', [id]);
    const teamsData = await pool.query('SELECT * FROM teams WHERE league_id = \$1', [id]);
    const playersData = await pool.query('SELECT * FROM taken_players WHERE league_id = \$1', [id]);
    res.json({
      league: leagueData.rows[0],
      teams: teamsData.rows,
      players: playersData.rows,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to export league data' });
  }
});

// Add API for importing league data
app.post('/api/league/import', async (req, res) => {
  const { league, teams, players } = req.body;
  try {
    const leagueResult = await pool.query(
      'INSERT INTO leagues (name, user_id) VALUES (\$1, \$2) RETURNING id',
      [league.name, league.user_id]
    );
    const leagueId = leagueResult.rows[0].id;

    for (const team of teams) {
      await pool.query(
        'INSERT INTO teams (name, league_id) VALUES (\$1, \$2)',
        [team.name, leagueId]
      );
    }

    for (const player of players) {
      await pool.query(
        'INSERT INTO taken_players (league_id, player_id, team_id) VALUES (\$1, \$2, \$3)',
        [leagueId, player.player_id, player.team_id]
      );
    }

    res.json({ status: 'League imported successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to import league data' });
  }
});


// Add this route to serve the navbar component
app.get('/components/navbar.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/components/navbar.html'));
});

app.listen(3000,()=>{
  console.log('Server is listening on http://localhost:3000');
});
