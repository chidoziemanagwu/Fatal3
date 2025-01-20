const pool = require('./db');

async function migrate() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL
      );
    `);

    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS favorite_league_id INT REFERENCES leagues(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS favorite_team_id INT REFERENCES teams(id) ON DELETE SET NULL;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS leagues (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id SERIAL PRIMARY KEY,
        league_id INT REFERENCES leagues(id) ON DELETE CASCADE,
        name TEXT NOT NULL
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS taken_players (
        id SERIAL PRIMARY KEY,
        league_id INT REFERENCES leagues(id) ON DELETE CASCADE,
        player_id TEXT NOT NULL,
        team_id INT REFERENCES teams(id) ON DELETE CASCADE
      );
    `);

    console.log('Migration complete.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
