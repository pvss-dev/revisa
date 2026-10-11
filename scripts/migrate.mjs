import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

if (fs.existsSync('.env')) process.loadEnvFile('.env');
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL não configurada. Veja .env.example.');
  process.exit(1);
}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  await client.query(fs.readFileSync(path.join(process.cwd(), 'db/schema.sql'), 'utf8'));
  console.log('Banco de dados pronto.');
} finally {
  await client.end();
}
