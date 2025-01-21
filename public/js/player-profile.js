document.addEventListener('DOMContentLoaded', async () => {
    const playerId = new URLSearchParams(window.location.search).get('id');
    const response = await fetch(`/api/player/${playerId}`);
    const player = await response.json();
  
    if (!player) {
      document.body.innerHTML = '<h1>Player not found</h1>';
      return;
    }
  
    // Update player header
    document.getElementById('playerName').textContent = player.name;
    document.getElementById('playerTeam').textContent = `Team: ${player.team || 'N/A'}`;
    document.getElementById('playerPosition').textContent = `Position: ${player.position || 'N/A'}`;
  
    // Add player profile image if available
    if (player.image_url) {
      const playerImage = document.createElement('img');
      playerImage.src = player.image_url;
      playerImage.alt = `${player.name} Profile Image`;
      playerImage.classList.add('player-image');
      document.querySelector('.player-header').appendChild(playerImage);
    }
  
    // Current Season Stats
    const currentStats = `
      <p>AVG: ${player.fangraphs.AVG || 'N/A'} HR: ${player.fangraphs.HR || 'N/A'} RBI: ${player.fangraphs.RBI || 'N/A'}</p>
      <p>R: ${player.fangraphs.R || 'N/A'} SB: ${player.fangraphs.SB || 'N/A'}</p>
    `;
    document.getElementById('currentStats').innerHTML = currentStats;
  
    // Historical Performance
    const historicalStats = `
      <p>Games Played: ${player.games_played || 'N/A'}</p>
      <p>Career AVG: ${player.career_avg || 'N/A'}</p>
    `;
    document.getElementById('historicalStats').innerHTML = historicalStats;
  
    // Projections
    const projections = `
      <p>Projected HR: ${player.fangraphs.projected_hr || 'N/A'}</p>
      <p>Projected RBI: ${player.fangraphs.projected_rbi || 'N/A'}</p>
    `;
    document.getElementById('projectionStats').innerHTML = projections;
  
    // Advanced Metrics
    const advancedMetrics = `
      <p>FG Score: ${player.fangraphs.score || 'N/A'}</p>
      <p>Statcast Score: ${player.statcast.score || 'N/A'}</p>
      <p>Combined Score: ${player.combined_score || 'N/A'}</p>
    `;
    document.getElementById('advancedStats').innerHTML = advancedMetrics;
  
    // Statcast Metrics
    const statcastMetrics = `
      <p>xBA: ${player.statcast.xba || 'N/A'}</p>
      <p>xSLG: ${player.statcast.xslg || 'N/A'}</p>
      <p>xwOBA: ${player.statcast.xwoba || 'N/A'}</p>
    `;
    document.getElementById('advancedStats').innerHTML += `<h3>Statcast Metrics</h3>${statcastMetrics}`;
  });