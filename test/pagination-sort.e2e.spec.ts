import { StatusCodes } from 'http-status-codes';
import { request } from './lib';
import {
  articlesRoutes,
  categoriesRoutes,
  commentsRoutes,
  usersRoutes,
} from './endpoints';
import {
  shouldAuthorizationBeTested,
  getTokenAndUserId,
  removeTokenUser,
} from './utils';

describe('Pagination and sorting (e2e)', () => {
  const req = request;
  const headers: Record<string, string> = { Accept: 'application/json' };
  let mockUserId: string | undefined;

  beforeAll(async () => {
    if (shouldAuthorizationBeTested) {
      const result = await getTokenAndUserId(req);
      headers['Authorization'] = result.token;
      mockUserId = result.mockUserId;
    }
  });

  afterAll(async () => {
    if (mockUserId) {
      await removeTokenUser(req, mockUserId, headers);
    }
    delete headers['Authorization'];
  });

  describe('GET /user', () => {
    it('returns paginated envelope when page query is present', async () => {
      const res = await req
        .get(`${usersRoutes.getAll}?page=1&limit=2`)
        .set(headers);

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body).toMatchObject({
        page: 1,
        limit: 2,
      });
      expect(typeof res.body.total).toBe('number');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeLessThanOrEqual(2);
    });

    it('returns a plain array when page and limit are omitted', async () => {
      const res = await req.get(usersRoutes.getAll).set(headers);

      expect(res.status).toBe(StatusCodes.OK);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('returns 400 for invalid sortBy', async () => {
      const res = await req
        .get(`${usersRoutes.getAll}?sortBy=passwordHash&order=asc`)
        .set(headers);

      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    });

    it('returns 400 when limit exceeds maximum', async () => {
      const res = await req
        .get(`${usersRoutes.getAll}?page=1&limit=101`)
        .set(headers);

      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    });

    it('sorts by login when sortBy and order are set (array response)', async () => {
      const loginLow = `pag_user_a_${Date.now()}`;
      const loginHigh = `pag_user_z_${Date.now()}`;

      const highRes = await req
        .post(usersRoutes.create)
        .set(headers)
        .send({ login: loginHigh, password: 'pw1' });
      const lowRes = await req
        .post(usersRoutes.create)
        .set(headers)
        .send({ login: loginLow, password: 'pw2' });

      expect(highRes.status).toBe(StatusCodes.CREATED);
      expect(lowRes.status).toBe(StatusCodes.CREATED);
      const idHigh = highRes.body.id as string;
      const idLow = lowRes.body.id as string;

      const listRes = await req
        .get(`${usersRoutes.getAll}?sortBy=login&order=asc`)
        .set(headers);

      expect(listRes.status).toBe(StatusCodes.OK);
      expect(Array.isArray(listRes.body)).toBe(true);

      const idxLow = listRes.body.findIndex(
        (u: { id: string }) => u.id === idLow,
      );
      const idxHigh = listRes.body.findIndex(
        (u: { id: string }) => u.id === idHigh,
      );
      expect(idxLow).toBeGreaterThanOrEqual(0);
      expect(idxHigh).toBeGreaterThanOrEqual(0);
      expect(idxLow).toBeLessThan(idxHigh);

      await req.delete(usersRoutes.delete(idHigh)).set(headers);
      await req.delete(usersRoutes.delete(idLow)).set(headers);
    });
  });

  describe('GET /category', () => {
    it('paginates categories', async () => {
      const res = await req
        .get(`${categoriesRoutes.getAll}?page=1&limit=1`)
        .set(headers);

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data.length).toBeLessThanOrEqual(1);
    });
  });

  describe('GET /article', () => {
    it('combines status filter with pagination envelope', async () => {
      const createRes = await req
        .post(articlesRoutes.create)
        .set(headers)
        .send({
          title: `PAG_ARTICLE_${Date.now()}`,
          content: 'c',
          status: 'draft',
          authorId: null,
          categoryId: null,
          tags: [],
        });

      expect(createRes.status).toBe(StatusCodes.CREATED);
      const articleId = createRes.body.id as string;

      const res = await req
        .get(
          `${articlesRoutes.getAll}?status=draft&page=1&limit=50&sortBy=createdAt&order=desc`,
        )
        .set(headers);

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data).toBeDefined();
      const found = res.body.data.some(
        (a: { id: string }) => a.id === articleId,
      );
      expect(found).toBe(true);

      await req.delete(articlesRoutes.delete(articleId)).set(headers);
    });
  });

  describe('GET /comment', () => {
    it('paginates comments for an article', async () => {
      const artRes = await req.post(articlesRoutes.create).set(headers).send({
        title: 'PAG_COMMENT_ARTICLE',
        content: 'x',
        status: 'draft',
        authorId: null,
        categoryId: null,
        tags: [],
      });
      expect(artRes.status).toBe(StatusCodes.CREATED);
      const articleId = artRes.body.id as string;

      const ids: string[] = [];
      for (let i = 0; i < 3; i += 1) {
        const cRes = await req
          .post(commentsRoutes.create)
          .set(headers)
          .send({
            content: `pag comment ${i}`,
            articleId,
            authorId: null,
          });
        expect(cRes.status).toBe(StatusCodes.CREATED);
        ids.push(cRes.body.id);
      }

      const res = await req
        .get(`/comment?articleId=${articleId}&page=1&limit=2`)
        .set(headers);

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.total).toBeGreaterThanOrEqual(3);
      expect(res.body.data.length).toBe(2);

      for (const id of ids) {
        await req.delete(commentsRoutes.delete(id)).set(headers);
      }
      await req.delete(articlesRoutes.delete(articleId)).set(headers);
    });
  });

  describe('GET /article invalid sort', () => {
    it('returns 400 for sortBy that is not a column on article', async () => {
      const res = await req
        .get(`${articlesRoutes.getAll}?sortBy=tags&order=asc`)
        .set(headers);

      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    });
  });
});
