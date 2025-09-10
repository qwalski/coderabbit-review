/**
 * Tests for ActivityController
 * Testing library/framework: Jest (Node environment).
 * We mock ../../config/database to avoid touching a real DB.
 */

const flush = () => new Promise((resolve) => setImmediate(resolve));

let controller;
let dbInstance;

function makeDbMock() {
  return {
    all: jest.fn(),
    get: jest.fn(),
    run: jest.fn(),
  };
}

jest.mock('../../config/database', () => {
  // Uses latest dbInstance from closure so beforeEach can swap it
  return {
    getConnection: () => dbInstance,
  };
}, { virtual: false });

describe('ActivityController', () => {
  beforeEach(() => {
    jest.resetModules();
    dbInstance = makeDbMock();
    controller = require('../../controllers/activityController');
  });

  describe('getAllActivities', () => {
    const makeRes = () => ({
      statusCode: 200,
      body: null,
      status: jest.fn(function (code) { this.statusCode = code; return this; }),
      json: jest.fn(function (payload) { this.body = payload; return this; }),
    });

    test('returns paginated activities with defaults (happy path)', async () => {
      const req = { query: {} };
      const res = makeRes();

      dbInstance.all.mockImplementationOnce((sql, params, cb) => {
        expect(sql).toMatch(/SELECT[\s\S]*FROM activities a/i);
        expect(params).toEqual([50, 0]); // default limit=50, page=1 => offset 0
        cb(null, [{ id: 1, action: 'CREATE', todo_title: 'T1' }]);
      });

      dbInstance.get.mockImplementationOnce((sql, params, cb) => {
        expect(sql).toMatch(/COUNT\(\*\)\s+as\s+total\s+FROM activities/i);
        expect(params).toEqual([]);
        cb(null, { total: 1 });
      });

      await controller.getAllActivities(req, res);

      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        activities: [{ id: 1, action: 'CREATE', todo_title: 'T1' }],
        pagination: { page: 1, limit: 50, total: 1, pages: 1 },
      });
    });

    test('applies todo_id filter and pagination parameters', async () => {
      const req = { query: { page: '3', limit: '10', todo_id: '42' } };
      const res = makeRes();

      dbInstance.all.mockImplementationOnce((sql, params, cb) => {
        expect(sql).toMatch(/WHERE a\.todo_id = \?/);
        expect(params).toEqual(['42', 10, 20]); // limit=10, page=3 => offset 20
        cb(null, [{ id: 2, todo_id: 42 }]);
      });

      dbInstance.get.mockImplementationOnce((sql, params, cb) => {
        expect(sql).toMatch(/FROM activities(?:\s|)WHERE todo_id = \?/);
        expect(params).toEqual(['42']);
        cb(null, { total: 11 });
      });

      await controller.getAllActivities(req, res);

      expect(res.json).toHaveBeenCalledWith({
        activities: [{ id: 2, todo_id: 42 }],
        pagination: { page: 3, limit: 10, total: 11, pages: 2 },
      });
    });

    test('handles SQL error on list query', async () => {
      const req = { query: {} };
      const res = makeRes();

      dbInstance.all.mockImplementationOnce((sql, params, cb) => cb(new Error('DB list error')));

      await controller.getAllActivities(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'DB list error' });
    });

    test('handles SQL error on count query', async () => {
      const req = { query: {} };
      const res = makeRes();

      dbInstance.all.mockImplementationOnce((sql, params, cb) => cb(null, [{ id: 1 }]));
      dbInstance.get.mockImplementationOnce((sql, params, cb) => cb(new Error('DB count error')));

      await controller.getAllActivities(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'DB count error' });
    });

    test('catches unexpected exception and returns 500', async () => {
      const req = { query: {} };
      const res = makeRes();

      dbInstance.all.mockImplementationOnce(() => { throw new Error('Boom'); });

      await controller.getAllActivities(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });

  describe('getActivitiesByTodoId', () => {
    const makeRes = () => ({
      statusCode: 200,
      body: null,
      status: jest.fn(function (c) { this.statusCode = c; return this; }),
      json: jest.fn(function (p) { this.body = p; return this; }),
    });

    test('returns activities for a given todoId', async () => {
      const req = { params: { todoId: '7' } };
      const res = makeRes();

      dbInstance.all.mockImplementationOnce((sql, params, cb) => {
        expect(sql).toMatch(/WHERE a\.todo_id = \?/);
        expect(params).toEqual(['7']);
        cb(null, [{ id: 3, todo_id: 7 }]);
      });

      await controller.getActivitiesByTodoId(req, res);

      expect(res.json).toHaveBeenCalledWith([{ id: 3, todo_id: 7 }]);
    });

    test('handles DB error', async () => {
      const req = { params: { todoId: '9' } };
      const res = makeRes();

      dbInstance.all.mockImplementationOnce((sql, params, cb) => cb(new Error('DB error')));

      await controller.getActivitiesByTodoId(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'DB error' });
    });

    test('catches unexpected exception', async () => {
      const req = { params: { todoId: '9' } };
      const res = makeRes();

      dbInstance.all.mockImplementationOnce(() => { throw new Error('Unexpected'); });

      await controller.getActivitiesByTodoId(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });

  describe('getActivityById', () => {
    const makeRes = () => ({
      statusCode: 200,
      body: null,
      status: jest.fn(function (c) { this.statusCode = c; return this; }),
      json: jest.fn(function (p) { this.body = p; return this; }),
    });

    test('returns activity when found', async () => {
      const req = { params: { id: '5' } };
      const res = makeRes();

      const expected = { id: 5, action: 'UPDATE' };
      dbInstance.get.mockImplementationOnce((sql, params, cb) => {
        expect(params).toEqual(['5']);
        cb(null, expected);
      });

      await controller.getActivityById(req, res);

      expect(res.json).toHaveBeenCalledWith(expected);
    });

    test('returns 404 when not found', async () => {
      const req = { params: { id: '404' } };
      const res = makeRes();

      dbInstance.get.mockImplementationOnce((sql, params, cb) => cb(null, undefined));

      await controller.getActivityById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Activity not found' });
    });

    test('handles DB error', async () => {
      const req = { params: { id: '5' } };
      const res = makeRes();

      dbInstance.get.mockImplementationOnce((sql, params, cb) => cb(new Error('DB get error')));

      await controller.getActivityById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'DB get error' });
    });

    test('catches unexpected exception', async () => {
      const req = { params: { id: '5' } };
      const res = makeRes();

      dbInstance.get.mockImplementationOnce(() => { throw new Error('Boom'); });

      await controller.getActivityById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });

  describe('createActivity', () => {
    test('resolves with lastID on success', async () => {
      dbInstance.run.mockImplementationOnce((sql, params, cb) => {
        cb.call({ lastID: 123 }, null);
      });

      const id = await controller.createActivity({
        todo_id: 1,
        action: 'CREATE',
        description: 'Created task',
        old_value: null,
        new_value: '{"title":"T"}',
        user_ip: '127.0.0.1',
        user_agent: 'jest',
      });

      expect(id).toBe(123);
    });

    test('rejects on DB error', async () => {
      dbInstance.run.mockImplementationOnce((sql, params, cb) => {
        cb.call({}, new Error('Insert failed'));
      });

      await expect(controller.createActivity({
        todo_id: 1, action: 'CREATE', description: 'x', old_value: null, new_value: 'y', user_ip: 'ip', user_agent: 'ua',
      })).rejects.toThrow('Insert failed');
    });
  });

  describe('deleteActivity', () => {
    const makeRes = () => ({
      statusCode: 200,
      body: null,
      status: jest.fn(function (c) { this.statusCode = c; return this; }),
      json: jest.fn(function (p) { this.body = p; return this; }),
    });

    test('returns success when a row is deleted', async () => {
      const req = { params: { id: '8' } };
      const res = makeRes();

      dbInstance.run.mockImplementationOnce((sql, params, cb) => {
        cb.call({ changes: 1 }, null);
      });

      await controller.deleteActivity(req, res);

      expect(res.json).toHaveBeenCalledWith({ message: 'Activity deleted successfully' });
    });

    test('returns 404 when no rows affected', async () => {
      const req = { params: { id: '9' } };
      const res = makeRes();

      dbInstance.run.mockImplementationOnce((sql, params, cb) => {
        cb.call({ changes: 0 }, null);
      });

      await controller.deleteActivity(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Activity not found' });
    });

    test('handles DB error', async () => {
      const req = { params: { id: '9' } };
      const res = makeRes();

      dbInstance.run.mockImplementationOnce((sql, params, cb) => {
        cb.call({}, new Error('Delete failed'));
      });

      await controller.deleteActivity(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Delete failed' });
    });

    test('catches unexpected exception', async () => {
      const req = { params: { id: '9' } };
      const res = makeRes();

      dbInstance.run.mockImplementationOnce(() => { throw new Error('Crash'); });

      await controller.deleteActivity(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });

  describe('clearAllActivities', () => {
    const makeRes = () => ({
      statusCode: 200,
      body: null,
      status: jest.fn(function (c) { this.statusCode = c; return this; }),
      json: jest.fn(function (p) { this.body = p; return this; }),
    });

    test('returns deletedCount and message on success', async () => {
      const res = makeRes();

      dbInstance.run.mockImplementationOnce((sql, paramsOrCb, maybeCb) => {
        const cb = typeof paramsOrCb === 'function' ? paramsOrCb : maybeCb;
        cb.call({ changes: 25 }, null);
      });

      await controller.clearAllActivities({}, res);

      expect(res.json).toHaveBeenCalledWith({
        message: 'All activities cleared successfully',
        deletedCount: 25,
      });
    });

    test('handles DB error', async () => {
      const res = makeRes();

      dbInstance.run.mockImplementationOnce((sql, paramsOrCb, maybeCb) => {
        const cb = typeof paramsOrCb === 'function' ? paramsOrCb : maybeCb;
        cb.call({}, new Error('Truncate failed'));
      });

      await controller.clearAllActivities({}, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Truncate failed' });
    });

    test('catches unexpected exception', async () => {
      const res = makeRes();

      dbInstance.run.mockImplementationOnce(() => { throw new Error('Boom'); });

      await controller.clearAllActivities({}, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });

  describe('getActivityStats', () => {
    const makeRes = () => ({
      statusCode: 200,
      body: null,
      status: jest.fn(function (c) { this.statusCode = c; return this; }),
      json: jest.fn(function (p) { this.body = p; return this; }),
    });

    test('returns aggregated stats on success', async () => {
      const res = makeRes();

      const responses = [
        [{ total: 100 }],
        [{ today: 7 }],
        [{ action: 'CREATE', count: 60 }, { action: 'UPDATE', count: 40 }],
        [
          { date: '2025-09-09', count: 10 },
          { date: '2025-09-08', count: 8 },
        ],
      ];
      let callIdx = 0;
      dbInstance.all.mockImplementation((sql, params, cb) => {
        const idx = callIdx++;
        cb(null, responses[idx]);
      });

      controller.getActivityStats({}, res);
      await flush();

      expect(res.json).toHaveBeenCalledWith({
        total: 100,
        today: 7,
        byAction: responses[2],
        last7Days: responses[3],
      });
      expect(callIdx).toBe(4);
    });

    test('returns 500 when any stats query fails', async () => {
      const res = makeRes();

      let callIdx = 0;
      dbInstance.all.mockImplementation((sql, params, cb) => {
        if (callIdx++ === 2) cb(new Error('Aggregate fail'));
        else cb(null, [{ ok: 1 }]);
      });

      controller.getActivityStats({}, res);
      await flush();

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Aggregate fail' });
    });

    test('catches unexpected exception', async () => {
      const res = makeRes();

      dbInstance.all.mockImplementationOnce(() => { throw new Error('Boom'); });

      controller.getActivityStats({}, res);
      await flush();

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });
});