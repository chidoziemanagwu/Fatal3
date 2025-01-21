const pool = require('./db');

async function migrate() {
  try {
    console.log('Running migrations...');

    // 1. Create session table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL,
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL
      );
    `);

    // Add primary key if it doesn't exist
    try {
      await pool.query(`
        ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid");
      `);
    } catch (e) {
      // Primary key might already exist, continue
    }

    await pool.query(`
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
    `);
    console.log('Session table checked/created.');

    // 2. Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL
      );
    `);
    console.log('Users table created.');

    // 3. Create leagues table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS leagues (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL
      );
    `);
    console.log('Leagues table created.');

    // 4. Create teams table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id SERIAL PRIMARY KEY,
        league_id INT REFERENCES leagues(id) ON DELETE CASCADE,
        name TEXT NOT NULL
      );
    `);
    console.log('Teams table created.');

    // 5. Add favorite columns to users
    try {
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN favorite_league_id INT REFERENCES leagues(id) ON DELETE SET NULL;
      `);
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN favorite_team_id INT REFERENCES teams(id) ON DELETE SET NULL;
      `);
    } catch (e) {
      // Columns might already exist, continue
    }
    console.log('User favorite columns checked.');

    // 6. Create taken_players table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS taken_players (
        id SERIAL PRIMARY KEY,
        league_id INT REFERENCES leagues(id) ON DELETE CASCADE,
        player_id TEXT NOT NULL,
        team_id INT REFERENCES teams(id) ON DELETE CASCADE
      );
    `);
    console.log('Taken_players table created.');

    // 7. Create player_profiles table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS player_profiles (
        id SERIAL PRIMARY KEY,
        player_id INT NOT NULL,
        name TEXT NOT NULL,
        team TEXT,
        position TEXT,
        stats JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Player_profiles table created.');

    // 8. Create league_rankings table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS league_rankings (
        id SERIAL PRIMARY KEY,
        league_id INT REFERENCES leagues(id) ON DELETE CASCADE,
        team_id INT REFERENCES teams(id) ON DELETE CASCADE,
        rank INT,
        score FLOAT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('League_rankings table created.');

    // 9. Create subscriptions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        plan TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Subscriptions table created.');

    // 10. Create referrals table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS referrals (
        id SERIAL PRIMARY KEY,
        referrer_id INT REFERENCES users(id) ON DELETE CASCADE,
        referred_id INT REFERENCES users(id) ON DELETE CASCADE,
        code TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Referrals table created.');

    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_leagues_user_id ON leagues(user_id);
      CREATE INDEX IF NOT EXISTS idx_teams_league_id ON teams(league_id);
      CREATE INDEX IF NOT EXISTS idx_taken_players_league_id ON taken_players(league_id);
      CREATE INDEX IF NOT EXISTS idx_taken_players_team_id ON taken_players(team_id);
      CREATE INDEX IF NOT EXISTS idx_league_rankings_league_id ON league_rankings(league_id);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
      CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
    `);
    console.log('Indexes created.');

    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    console.error('Error details:', err.message);
    process.exit(1);
  }
}

migrate();