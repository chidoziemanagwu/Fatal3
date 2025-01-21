const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://fatals_owner:8ewIhSPJzd0E@ep-hidden-cell-a897pgwf.eastus2.azure.neon.tech/fatals?sslmode=require',
  ssl: {
    rejectUnauthorized: false, // Required for SSL connections
  },
});

module.exports = pool;