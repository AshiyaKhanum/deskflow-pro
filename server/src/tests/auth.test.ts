import request from 'supertest';
import { app } from './helpers';

describe('Auth', () => {
  it('registers a new user as a customer regardless of any role field sent', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'New User',
      email: 'newuser@example.com',
      password: 'Password123!',
      role: 'admin', // must be ignored
    });

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('customer');
    expect(res.body.data.token).toBeDefined();
  });

  it('rejects registration with an already-used email', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'First',
      email: 'dupe@example.com',
      password: 'Password123!',
    });
    const res = await request(app).post('/api/auth/register').send({
      name: 'Second',
      email: 'dupe@example.com',
      password: 'Password123!',
    });
    expect(res.status).toBe(409);
  });

  it('rejects registration with a weak password', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Weak',
      email: 'weak@example.com',
      password: 'short',
    });
    expect(res.status).toBe(400);
  });

  it('logs in with correct credentials and rejects incorrect ones', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Login Test',
      email: 'login@example.com',
      password: 'Password123!',
    });

    const good = await request(app).post('/api/auth/login').send({
      email: 'login@example.com',
      password: 'Password123!',
    });
    expect(good.status).toBe(200);
    expect(good.body.data.token).toBeDefined();

    const bad = await request(app).post('/api/auth/login').send({
      email: 'login@example.com',
      password: 'WrongPassword1',
    });
    expect(bad.status).toBe(401);
  });

  it('rejects /me without a token, and accepts it with a valid token', async () => {
    const register = await request(app).post('/api/auth/register').send({
      name: 'Me Test',
      email: 'metest@example.com',
      password: 'Password123!',
    });
    const token = register.body.data.token;

    const noToken = await request(app).get('/api/auth/me');
    expect(noToken.status).toBe(401);

    const withToken = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(withToken.status).toBe(200);
    expect(withToken.body.data.email).toBe('metest@example.com');
  });

  it('rejects requests with a malformed/invalid token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });
});
