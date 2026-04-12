import type { PoolConfig } from 'pg';

export type PgPoolFromEnvOptions = {
  /** Для `npx prisma db seed` на хосте при `POSTGRES_HOST=db` из docker-compose */
  remapDockerDbToLocalhost?: boolean;
};

function resolveHost(hostname: string, opts?: PgPoolFromEnvOptions): string {
  if (!opts?.remapDockerDbToLocalhost) {
    return hostname;
  }
  const override = process.env.SEED_POSTGRES_HOST?.trim();
  if (override) {
    return override;
  }
  return hostname === 'db' ? '127.0.0.1' : hostname;
}

/**
 * Конфиг `pg` для PrismaPg. Nest в контейнере использует `DATABASE_URL` с хостом `db`;
 * на хосте — `localhost` в URL или в POSTGRES_HOST.
 */
export function getPgPoolConfig(opts?: PgPoolFromEnvOptions): PoolConfig {
  const fallbackPassword = String(process.env.POSTGRES_PASSWORD ?? '');
  const fallbackUser = process.env.POSTGRES_USER ?? 'postgres';
  const fallbackHost = resolveHost(
    process.env.POSTGRES_HOST ?? '127.0.0.1',
    opts,
  );
  const fallbackPort = parseInt(process.env.POSTGRES_PORT ?? '5432', 10);
  const fallbackDb = process.env.POSTGRES_DB ?? 'knowledge_hub';

  const direct =
    process.env.DIRECT_DATABASE_URL?.trim() ||
    process.env.SEED_DATABASE_URL?.trim();
  const dbUrl = process.env.DATABASE_URL?.trim();

  const raw =
    direct && !direct.startsWith('prisma+')
      ? direct
      : dbUrl &&
          (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://'))
        ? dbUrl
        : null;

  if (!raw) {
    return {
      user: fallbackUser,
      password: fallbackPassword,
      host: fallbackHost,
      port: fallbackPort,
      database: fallbackDb,
    };
  }

  try {
    const forUrl = raw.replace(/^postgres(ql)?:\/\//i, 'http://');
    const u = new URL(forUrl);
    const user = u.username ? decodeURIComponent(u.username) : fallbackUser;
    const fromUrl = u.password !== '' ? decodeURIComponent(u.password) : '';
    const password = fromUrl !== '' ? fromUrl : fallbackPassword;
    const host = resolveHost(u.hostname || fallbackHost, opts);
    const port = u.port ? parseInt(u.port, 10) : fallbackPort;
    const database = u.pathname.replace(/^\//, '').split('?')[0] || fallbackDb;

    return {
      user,
      password,
      host,
      port,
      database,
    };
  } catch {
    return { connectionString: raw };
  }
}
