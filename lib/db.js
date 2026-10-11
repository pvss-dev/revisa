import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForDb = globalThis;
export const prisma = globalForDb.__revisaPrisma ?? new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? 'postgresql://invalid:invalid@127.0.0.1:1/invalid' }),
});
if (process.env.NODE_ENV !== 'production') globalForDb.__revisaPrisma = prisma;
