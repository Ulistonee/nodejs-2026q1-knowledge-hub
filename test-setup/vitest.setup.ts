import 'reflect-metadata';

process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY ?? 'unit-test-secret';
process.env.JWT_SECRET_REFRESH_KEY =
  process.env.JWT_SECRET_REFRESH_KEY ?? 'unit-test-refresh-secret';
process.env.TOKEN_EXPIRE_TIME = process.env.TOKEN_EXPIRE_TIME ?? '1h';
process.env.TOKEN_REFRESH_EXPIRE_TIME =
  process.env.TOKEN_REFRESH_EXPIRE_TIME ?? '7d';
