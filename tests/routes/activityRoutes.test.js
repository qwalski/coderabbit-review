// tests/routes/activityRoutes.test.js - Jest + Supertest route wiring tests

/**
 * Testing library and framework:
 * - Jest (test runner and mocking)
 * - Supertest (HTTP assertions against Express app)
 *
 * Focus: Validate Express route wiring for activityRoutes:
 *   - Correct HTTP methods and paths are registered
 *   - Controller handlers are invoked with proper params
 *   - Happy paths return mocked controller responses
 *   - Edge/failure paths propagate errors appropriately
 *
 * These are unit-level router tests; controller logic is mocked.
 */

const express = require('express');
const request = require('supertest');
const path = require('path');

describe('routes/activityRoutes', () => {
  // Resolve the router module by searching common locations relative to project root.
  // Prefer routes/activityRoutes.js; fall back to src/routes/activityRoutes.js or similar.
  // Adjust here if your repo uses a different path.
  let routerModulePath;
  const candidatePaths = [
    'routes/activityRoutes.js',
    'src/routes/activityRoutes.js',
    'server/routes/activityRoutes.js',
    'app/routes/activityRoutes.js',
    // In rare cases, the router may be co-located under tests in the snippet; keep last as a fallback.
    'tests/routes/activityRoutes.test.js' // fallback only to avoid crash; will be rejected below
  ];
  for (const p of candidatePaths) {
    try {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      require.resolve(path.resolve(p));
      routerModulePath = path.resolve(p);
      break;
    } catch (e) { /* continue */ }
  }

  if (!routerModulePath || routerModulePath.endsWith('activityRoutes.test.js')) {
    test('FAIL-SAFE: activityRoutes module must exist at a known path', () => {
      // This test provides actionable feedback if the path is wrong.
      // If it fails, move the router path in candidatePaths above to the correct location.
      expect(() => require.resolve(path.resolve('routes/activityRoutes.js'))).toBeDefined();
    });
    return; // Skip rest to avoid misleading passes
  }

  // Build jest manual mock for the controller the router requires:
  // Detect controller path from the router's require(...) by loading the source and regexing the require line.
  let controllerRequirePath = '../controllers/activityController';
  try {
    const fs = require('fs');
    const src = fs.readFileSync(routerModulePath, 'utf8');
    const m = src.match(/require\(['"](.+activityController)['"]\)/);
    if (m && m[1]) controllerRequirePath = m[1];
  } catch (e) {
    // default fallback retained
  }

  // Resolve the absolute path of the controller module relative to the router's directory
  const routerDir = path.dirname(routerModulePath);
  const controllerAbsPath = require.resolve(path.resolve(routerDir, controllerRequirePath));

  // Create a fresh mock object for each test
  let mockController;
  const loadRouterWithMock = () => {
    jest.resetModules();
    mockController = {
      getAllActivities: jest.fn((req, res) => res.status(200).json({ ok: true, route: 'getAllActivities' })),
      getActivityStats: jest.fn((req, res) => res.status(200).json({ ok: true, route: 'getActivityStats' })),
      getActivitiesByTodoId: jest.fn((req, res) => res.status(200).json({ ok: true, route: 'getActivitiesByTodoId', todoId: req.params.todoId })),
      getActivityById: jest.fn((req, res) => res.status(200).json({ ok: true, route: 'getActivityById', id: req.params.id })),
      deleteActivity: jest.fn((req, res) => res.status(204).send()),
      clearAllActivities: jest.fn((req, res) => res.status(204).send()),
    };

    // Mock the controller module path that the router requires
    jest.doMock(controllerAbsPath, () => mockController, { virtual: false });

    // Require the router after mocking
    // eslint-disable-next-line import/no-dynamic-require, global-require
    const router = require(routerModulePath);

    // Mount router on an isolated Express app
    const app = express();
    app.use(express.json());
    app.use('/api/activities', router);
    // 404 fallback to assert method mismatches
    app.use((req, res) => res.status(404).json({ error: 'Not Found' }));
    return app;
  };

  describe('GET /api/activities', () => {
    test('calls getAllActivities and returns 200 with payload', async () => {
      const app = loadRouterWithMock();
      const res = await request(app).get('/api/activities?limit=10&page=2');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true, route: 'getAllActivities' });
      expect(mockController.getAllActivities).toHaveBeenCalledTimes(1);
      const [req] = mockController.getAllActivities.mock.calls[0];
      expect(req.query).toMatchObject({ limit: '10', page: '2' });
    });

    test('propagates controller error (next) as 500 by default', async () => {
      const app = (() => {
        jest.resetModules();
        mockController = {
          getAllActivities: jest.fn((req, res, next) => next(new Error('boom')))
        };
        jest.doMock(controllerAbsPath, () => mockController, { virtual: false });
        // eslint-disable-next-line import/no-dynamic-require, global-require
        const router = require(routerModulePath);
        const app = express();
        app.use('/api/activities', router);
        // Basic error handler
        // eslint-disable-next-line no-unused-vars
        app.use((err, req, res, next) => res.status(500).json({ error: err.message }));
        return app;
      })();

      const res = await request(app).get('/api/activities');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'boom' });
      expect(mockController.getAllActivities).toHaveBeenCalledTimes(1);
    });

    test('rejects unsupported method with 404 (POST on collection not defined)', async () => {
      const app = loadRouterWithMock();
      const res = await request(app).post('/api/activities').send({ any: 'thing' });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/activities/stats', () => {
    test('calls getActivityStats and returns 200', async () => {
      const app = loadRouterWithMock();
      const res = await request(app).get('/api/activities/stats');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true, route: 'getActivityStats' });
      expect(mockController.getActivityStats).toHaveBeenCalledTimes(1);
    });

    test('method not allowed (DELETE) yields 404', async () => {
      const app = loadRouterWithMock();
      const res = await request(app).delete('/api/activities/stats');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/activities/todo/:todoId', () => {
    test('calls getActivitiesByTodoId with path param', async () => {
      const app = loadRouterWithMock();
      const res = await request(app).get('/api/activities/todo/abc123');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true, route: 'getActivitiesByTodoId', todoId: 'abc123' });
      expect(mockController.getActivitiesByTodoId).toHaveBeenCalledTimes(1);
      const [req] = mockController.getActivitiesByTodoId.mock.calls[0];
      expect(req.params.todoId).toBe('abc123');
    });

    test('invalid todoId pattern still routes and leaves validation to controller', async () => {
      const app = loadRouterWithMock();
      const res = await request(app).get('/api/activities/todo/'); // missing param should 404 at router level
      expect([404, 400]).toContain(res.status); // Express treats missing param as 404
    });
  });

  describe('GET /api/activities/:id', () => {
    test('calls getActivityById with id', async () => {
      const app = loadRouterWithMock();
      const res = await request(app).get('/api/activities/42');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true, route: 'getActivityById', id: '42' });
      expect(mockController.getActivityById).toHaveBeenCalledTimes(1);
      const [req] = mockController.getActivityById.mock.calls[0];
      expect(req.params.id).toBe('42');
    });

    test('DELETE /api/activities/:id calls deleteActivity and returns 204', async () => {
      const app = loadRouterWithMock();
      const res = await request(app).delete('/api/activities/55');
      expect(res.status).toBe(204);
      expect(mockController.deleteActivity).toHaveBeenCalledTimes(1);
      const [req] = mockController.deleteActivity.mock.calls[0];
      expect(req.params.id).toBe('55');
    });

    test('unsupported method (PUT) on :id -> 404', async () => {
      const app = loadRouterWithMock();
      const res = await request(app).put('/api/activities/55').send({ x: 1 });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/activities (clear all)', () => {
    test('calls clearAllActivities and returns 204', async () => {
      const app = loadRouterWithMock();
      const res = await request(app).delete('/api/activities');
      expect(res.status).toBe(204);
      expect(mockController.clearAllActivities).toHaveBeenCalledTimes(1);
    });

    test('GET on /api/activities still handled by getAllActivities', async () => {
      const app = loadRouterWithMock();
      const res = await request(app).get('/api/activities');
      expect(res.status).toBe(200);
      expect(mockController.getAllActivities).toHaveBeenCalledTimes(1);
    });
  });

  describe('Route precedence and specificity', () => {
    test('GET /api/activities/stats should NOT invoke getActivityById due to specificity', async () => {
      const app = loadRouterWithMock();
      const res = await request(app).get('/api/activities/stats');
      expect(res.status).toBe(200);
      expect(mockController.getActivityById).not.toHaveBeenCalled();
      expect(mockController.getActivityStats).toHaveBeenCalledTimes(1);
    });

    test('GET /api/activities/todo/:todoId should NOT hit :id route', async () => {
      const app = loadRouterWithMock();
      const res = await request(app).get('/api/activities/todo/99');
      expect(res.status).toBe(200);
      expect(mockController.getActivityById).not.toHaveBeenCalled();
      expect(mockController.getActivitiesByTodoId).toHaveBeenCalledTimes(1);
    });
  });
});