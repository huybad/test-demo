import app from './app.js';
import { closeDatabase, createAdminAccount } from './database.js';
import { promisify } from 'node:util';
import { randomBytes, scrypt } from 'node:crypto';

const port = Number(process.env.PORT) || 3000;

const scryptAsync = promisify(scrypt);

if (process.env.ADMIN_EMAIL || process.env.ADMIN_PASSWORD) {
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD || !process.env.ADMIN_NAME) {
    throw new Error('Set ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD together to provision an admin account.');
  }
  if (process.env.ADMIN_PASSWORD.length < 12) {
    throw new Error('ADMIN_PASSWORD must contain at least 12 characters.');
  }
  const salt = randomBytes(16).toString('hex');
  const key = await scryptAsync(process.env.ADMIN_PASSWORD, salt, 64);
  await createAdminAccount({
    name: process.env.ADMIN_NAME.trim(),
    email: process.env.ADMIN_EMAIL.trim().toLowerCase(),
    passwordHash: `${salt}:${key.toString('hex')}`
  });
  console.log(`Admin account provisioned for ${process.env.ADMIN_EMAIL.trim().toLowerCase()}`);
}

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Server listening on port ${port}`);
});

async function shutdown() {
  server.close(async (error) => {
    try {
      await closeDatabase();
      if (error) {
        console.error('HTTP server shutdown failed.', error);
        process.exitCode = 1;
      }
    } catch (databaseError) {
      console.error('Database shutdown failed.', databaseError);
      process.exitCode = 1;
    }
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
