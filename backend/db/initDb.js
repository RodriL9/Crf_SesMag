require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'crf_sesmag_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

async function initDb() {
  const client = await pool.connect();
  try {
    const schemaDir = path.resolve(__dirname, 'schema');
    const files = fs
      .readdirSync(schemaDir)
      .filter((name) => name.endsWith('.sql'))
      .sort();
    for (const file of files) {
      const schemaPath = path.join(schemaDir, file);
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await client.query(schemaSql);
      console.log(`Applied schema: ${file}`);
    }
    console.log('Database initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize database:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

initDb();
