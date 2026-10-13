const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;

async function run() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected to Postgres. Adding secili_personeller column...");
    await client.query(`
      ALTER TABLE public.kargo_prim_kayitlari 
      ADD COLUMN IF NOT EXISTS secili_personeller JSONB DEFAULT NULL;
    `);
    console.log("Column secili_personeller added or already exists!");
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await client.end();
  }
}

run();
