import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  // Neon closes idle connections after 5 minutes, so we set a shorter timeout
  idleTimeoutMillis: 60000, // Close idle connections after 1 minute
  connectionTimeoutMillis: 10000, // Timeout connection attempts after 10 seconds
  max: 10, // Maximum number of clients in the pool
});

// Add error handler to prevent uncaught errors from crashing the app
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
  // Log the error but don't crash - the pool will attempt to recover
});

export const db = drizzle({ client: pool, schema });
