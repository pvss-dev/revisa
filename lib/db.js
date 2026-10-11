import pg from 'pg';

// DATE columns are calendar dates, so keep them as YYYY-MM-DD without timezone conversion.
pg.types.setTypeParser(1082, value => value);

const globalForDb = globalThis;
export const pool = globalForDb.__revisaPool ?? new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});
if (process.env.NODE_ENV !== 'production') globalForDb.__revisaPool = pool;
