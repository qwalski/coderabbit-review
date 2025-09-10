/**
 * Note on framework: These tests are written for Jest (common in Node projects that use *.test.js).
 * They rely on jest.mock to replace the 'sqlite3' module. If your project uses Mocha/Chai instead,
 * you can adapt the mocking using proxyquire/sinon. However, auto-detection found .test.js structure,
 * so Jest is assumed.
 */

const path = require('path');

/**
 * We implement a manual jest.mock for 'sqlite3' that simulates:
 * - sqlite open success/failure via __setOpenError
 * - per-run errors for CREATE TABLE calls via __pushRunError
 * - close() success/failure via __setCloseError
 * The Database constructor returns a plain object instance with run/close capturing calls.
 */
jest.mock('sqlite3', () => {
  // Shared state between Database instances for inspection/control
  let openError = null;
  let closeError = null;
  let runErrorQueue = [];
  let createdDbs = [];

  const makeDb = () => {
    const calls = { run: [], close: 0 };
    const db = {
      _calls: calls,
      run(sql, cb) {
        this._calls.run.push(String(sql));
        const err = runErrorQueue.length ? runErrorQueue.shift() : null;
        // Next tick to simulate async sqlite behavior
        setImmediate(() => cb && cb(err));
      },
      close(cb) {
        this._calls.close += 1;
        const err = closeError;
        setImmediate(() => cb && cb(err));
      },
    };
    createdDbs.push(db);
    return db;
  };

  function Database(file, cb) {
    // Return our fake instance object as the constructed value.
    const db = makeDb();
    setImmediate(() => cb && cb(openError));
    return db;
  }

  // Expose control helpers through the module object (namespaced to avoid collisions)
  Database.__reset = () => {
    openError = null;
    closeError = null;
    runErrorQueue = [];
    createdDbs = [];
  };
  Database.__setOpenError = (err) => { openError = err || null; };
  Database.__pushRunError = (err) => { runErrorQueue.push(err); };
  Database.__setCloseError = (err) => { closeError = err || null; };
  Database.__getCreatedDbs = () => createdDbs.slice();
  Database.__getRunErrorQueueLength = () => runErrorQueue.length;

  const moduleApi = {
    Database,
    verbose: jest.fn(() => moduleApi), // sqlite3.verbose() returns the same object
  };
  return moduleApi;
});

// Helper to require the subject module from conventional locations.
// Adjust paths here if your repository uses a custom location.
function requireDatabaseModule() {
  const candidates = [
    'config/database.js',
    'src/config/database.js',
    'server/config/database.js',
    'app/config/database.js',
    'lib/config/database.js',
    // Fallback: allow tests to be co-located (rare)
    'tests/config/database.js',
  ];
  for (const rel of candidates) {
    try {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      return { mod: require(path.resolve(process.cwd(), rel)), pathTried: rel };
    } catch (e) {
      // continue
    }
  }
  throw new Error('Unable to locate database module. Expected one of: ' + candidates.join(', '));
}

// Pull sqlite3 mock control surface
const sqlite3 = require('sqlite3');

describe('Database singleton (SQLite) - unit tests', () => {
  let database;
  let modPath;

  beforeEach(() => {
    // Reset module registry and sqlite3 mock state before each test
    jest.resetModules();
    // Re-require the mock and reset its state
    const mocked = require('sqlite3');
    mocked.Database.__reset();

    // Now require the DB module fresh
    const { mod, pathTried } = requireDatabaseModule();
    database = mod; // module.exports = database (singleton)
    modPath = pathTried;
  });

  test('connect() resolves on successful open and table creation; getConnection() exposes db', async () => {
    // Arrange: all defaults resolve successfully (no errors set)
    // Act:
    await expect(database.connect()).resolves.toBeUndefined();

    // Assert:
    const dbInstances = sqlite3.Database.__getCreatedDbs();
    expect(dbInstances.length).toBe(1);
    const db = database.getConnection();
    expect(db).toBe(dbInstances[0]);

    // Two CREATE TABLE runs should have been executed in order
    const runCalls = db._calls.run;
    expect(runCalls.length).toBe(2);
    expect(runCalls[0]).toMatch(/CREATE TABLE IF NOT EXISTS\s+todos/i);
    expect(runCalls[1]).toMatch(/CREATE TABLE IF NOT EXISTS\s+activities/i);
  });

  test('connect() rejects if sqlite open fails', async () => {
    // Arrange:
    const openErr = new Error('open failed');
    sqlite3.Database.__setOpenError(openErr);

    // Act + Assert:
    await expect(database.connect()).rejects.toBe(openErr);

    // No connection should be stored
    expect(database.getConnection()).toBeNull();
  });

  test('connect() rejects when creating todos table fails', async () => {
    // Arrange: first db.run fails (todos), second would not be called
    const errTodos = new Error('todos create failed');
    sqlite3.Database.__pushRunError(errTodos);

    // Act + Assert:
    await expect(database.connect()).rejects.toBe(errTodos);

    const db = sqlite3.Database.__getCreatedDbs()[0];
    expect(db._calls.run.length).toBe(1);
    expect(db._calls.run[0]).toMatch(/CREATE TABLE IF NOT EXISTS\s+todos/i);
  });

  test('connect() rejects when creating activities table fails', async () => {
    // Arrange: first run ok (null), second run fails
    sqlite3.Database.__pushRunError(null);
    const errActivities = new Error('activities create failed');
    sqlite3.Database.__pushRunError(errActivities);

    // Act + Assert:
    await expect(database.connect()).rejects.toBe(errActivities);

    const db = sqlite3.Database.__getCreatedDbs()[0];
    expect(db._calls.run.length).toBe(2);
    expect(db._calls.run[0]).toMatch(/CREATE TABLE IF NOT EXISTS\s+todos/i);
    expect(db._calls.run[1]).toMatch(/CREATE TABLE IF NOT EXISTS\s+activities/i);
  });

  test('close() resolves when db is open and close succeeds', async () => {
    // Arrange: successful connect
    await database.connect();
    const db = database.getConnection();
    expect(db).toBeTruthy();

    // Act + Assert:
    await expect(database.close()).resolves.toBeUndefined();

    // The mock increments close call count
    expect(db._calls.close).toBe(1);
  });

  test('close() rejects when sqlite close fails', async () => {
    // Arrange: successful connect, but close will error
    await database.connect();
    const err = new Error('close failed');
    sqlite3.Database.__setCloseError(err);

    // Act + Assert:
    await expect(database.close()).rejects.toBe(err);
  });

  test('close() resolves immediately when no connection is present', async () => {
    // No prior connect, so db is null; close should resolve
    await expect(database.close()).resolves.toBeUndefined();
  });
});