import request from 'supertest';
import app from '../../src/app';

describe('GET /api/menu/categories routing', () => {
  it('routes to menu categories handler and returns JSON shape', async () => {
    const res = await request(app).get('/api/menu/categories');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
