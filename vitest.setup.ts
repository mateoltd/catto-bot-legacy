import 'reflect-metadata';

// Set test environment variables to prevent config errors
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
}
if (!process.env.DISCORD_TOKEN) {
  process.env.DISCORD_TOKEN = 'test-token';
}
if (!process.env.CLIENT_ID) {
  process.env.CLIENT_ID = 'test-client-id';
}
if (!process.env.CLIENT_SECRET) {
  process.env.CLIENT_SECRET = 'test-client-secret';
}
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
}
