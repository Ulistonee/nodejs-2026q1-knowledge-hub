import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { ArticleStatus, PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';
import { getPgPoolConfig } from '../src/database/pg-pool.config';

const pool = new Pool(
  getPgPoolConfig({ remapDockerDbToLocalhost: true }),
);
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.comment.deleteMany();
  await prisma.article.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: {
      login: 'seed_admin',
      password: await bcrypt.hash('admin123', 10),
      role: UserRole.admin,
    },
  });

  const editor = await prisma.user.create({
    data: {
      login: 'seed_editor',
      password: await bcrypt.hash('editor123', 10),
      role: UserRole.editor,
    },
  });

  const [catDev, catOps, catDb] = await Promise.all([
    prisma.category.create({
      data: {
        name: 'Development',
        description: 'Software development topics',
      },
    }),
    prisma.category.create({
      data: {
        name: 'DevOps',
        description: 'Infrastructure and delivery',
      },
    }),
    prisma.category.create({
      data: {
        name: 'Database',
        description: 'Data persistence',
      },
    }),
  ]);

  const [tJs, tNest, tPg, tDocker, tApi] = await Promise.all([
    prisma.tag.create({ data: { name: 'javascript' } }),
    prisma.tag.create({ data: { name: 'nestjs' } }),
    prisma.tag.create({ data: { name: 'postgresql' } }),
    prisma.tag.create({ data: { name: 'docker' } }),
    prisma.tag.create({ data: { name: 'api' } }),
  ]);

  const [a1, a2, a3, a4, a5] = await Promise.all([
    prisma.article.create({
      data: {
        title: 'Seed: NestJS introduction',
        content: 'Draft article about NestJS fundamentals.',
        status: ArticleStatus.DRAFT,
        authorId: admin.id,
        categoryId: catDev.id,
        tags: { connect: [{ id: tJs.id }, { id: tNest.id }] },
      },
    }),
    prisma.article.create({
      data: {
        title: 'Seed: Prisma with PostgreSQL',
        content: 'Published guide to Prisma ORM and Postgres.',
        status: ArticleStatus.PUBLISHED,
        authorId: editor.id,
        categoryId: catDb.id,
        tags: { connect: [{ id: tPg.id }] },
      },
    }),
    prisma.article.create({
      data: {
        title: 'Seed: Docker for developers',
        content: 'Archived notes on containers.',
        status: ArticleStatus.ARCHIVED,
        authorId: admin.id,
        categoryId: catOps.id,
        tags: { connect: [{ id: tDocker.id }, { id: tPg.id }] },
      },
    }),
    prisma.article.create({
      data: {
        title: 'Seed: REST API design',
        content: 'Published tips for HTTP APIs.',
        status: ArticleStatus.PUBLISHED,
        authorId: editor.id,
        categoryId: catDev.id,
        tags: { connect: [{ id: tApi.id }, { id: tJs.id }] },
      },
    }),
    prisma.article.create({
      data: {
        title: 'Seed: Monolith vs microservices',
        content: 'Draft comparison for backend architecture.',
        status: ArticleStatus.DRAFT,
        authorId: admin.id,
        categoryId: catOps.id,
        tags: { connect: [{ id: tNest.id }, { id: tDocker.id }] },
      },
    }),
  ]);

  await prisma.comment.createMany({
    data: [
      {
        content: 'Great overview of Nest!',
        articleId: a1.id,
        authorId: editor.id,
      },
      {
        content: 'Thanks for the Prisma examples.',
        articleId: a2.id,
        authorId: admin.id,
      },
      {
        content: 'Very helpful for API design.',
        articleId: a4.id,
        authorId: editor.id,
      },
    ],
  });

  console.log('Seed finished: 2 users, 3 categories, 5 tags, 5 articles, 3 comments.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
