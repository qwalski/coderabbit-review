/**
 * Server wiring tests
 *
 * Test framework: Jest (expect/describe/it, jest.mock for module mocking)
 * Focus: Validate middleware/route wiring, startup/teardown paths, and handlers (/, error, 404).
 *
 * These tests mock:
 *  - express (to intercept app.use/get/listen registrations)
 *  - cors, body-parser, express.static (to assert correct wiring)
 *  - ./config/database (to control connect/close behaviors)
 *  - ./routes/todoRoutes and ./routes/activityRoutes (as sentinels)
 *
 * They also stub process.on and process.exit to safely simulate SIGINT and startup failures.
 */

const path = require('path');

const ORIGINAL_ENV = { ...process.env };
let sigintHandler;
let appMock;
let expressFnMock;
let corsMock;
let bodyParserMock;
let databaseMock;
let consoleLogSpy;
let consoleErrorSpy;
let processOnSpy;
let processExitSpy;

/**
 * Prepare all module mocks and load the server module in isolation so its
 * top-level side effects (startServer and process.on) run with our stubs.
 */
function loadServerWithMocks({
  dbConnectResolves = true,
  dbCloseResolves = true,
  port = '3456',
} = {}) {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV, PORT: port };

  // Capture the SIGINT handler registration
  sigintHandler = undefined;
  processOnSpy = jest
    .spyOn(process, 'on')
    .mockImplementation((event, handler) => {
      if (event === 'SIGINT') sigintHandler = handler;
      // Do not register with the real process to avoid side-effects
      return process;
    });

  // Prevent tests from exiting the process
  processExitSpy = jest
    .spyOn(process, 'exit')
    .mockImplementation((code) => {
      // no-op in tests
    });

  // Spy on console
  consoleLogSpy = jest
    .spyOn(console, 'log')
    .mockImplementation(() => {});
  consoleErrorSpy = jest
    .spyOn(console, 'error')
    .mockImplementation(() => {});

  // Mock express and capture app instance and static()
  appMock = {
    use: jest.fn(),
    get: jest.fn(),
    listen: jest.fn((portArg, cb) => {
      if (typeof cb === 'function') cb();
      // return a fake server with close()
      return { close: jest.fn() };
    }),
  };
  expressFnMock = jest.fn(() => appMock);

  // Provide express.static sentinel
  const staticSentinel = 'STATIC_MW';
  jest.doMock('express', () => {
    const e = expressFnMock;
    e.static = jest.fn(() => staticSentinel);
    return e;
  });

  // Mock cors()
  corsMock = jest.fn(() => 'CORS_MW');
  jest.doMock('cors', () => corsMock);

  // Mock body-parser
  bodyParserMock = {
    json: jest.fn(() => 'JSON_MW'),
    urlencoded: jest.fn((opts) => 'URLENCODED_MW'),
  };
  jest.doMock('body-parser', () => bodyParserMock);

  // Mock routes as virtual modules (in case they don't exist on disk)
  jest.doMock('./routes/todoRoutes', () => 'TODO_ROUTES', {
    virtual: true,
  });
  jest.doMock('./routes/activityRoutes', () => 'ACTIVITY_ROUTES', {
    virtual: true,
  });

  // Mock database module
  databaseMock = {
    connect: dbConnectResolves
      ? jest.fn().mockResolvedValue()
      : jest.fn().mockRejectedValue(new Error('DB_CONNECT_FAIL')),
    close: dbCloseResolves
      ? jest.fn().mockResolvedValue()
      : jest.fn().mockRejectedValue(new Error('DB_CLOSE_FAIL')),
  };
  jest.doMock('./config/database', () => databaseMock, {
    virtual: true,
  });

  // IMPORTANT: Resolve the server entry path. The server file under test matches the PR diff content.
  // We try common entry names; adjust if your server file lives elsewhere.
  const candidatePaths = [
    './server.js',
    './index.js',
    './app.js',
    './src/server.js',
    './src/index.js',
    './src/app.js',
  ];

  let loaded = false;
  let lastErr;
  for (const p of candidatePaths) {
    try {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      require(p);
      loaded = true;
      break;
    } catch (e) {
      lastErr = e;
    }
  }

  if (!loaded) {
    // As a fallback, try the path used in the test file name hint (tests/server.test.js)
    try {
      require('../server');
    } catch (e2) {
      // Surface a clear error to help the contributor align the path
      throw new Error(
        'Could not locate the server entry file. Tried: ' +
          candidatePaths.concat(['../server']).join(', ') +
          '. Last error: ' +
          (lastErr ? lastErr.message : 'n/a')
      );
    }
  }

  return {
    appMock,
    expressFnMock,
    corsMock,
    bodyParserMock,
    databaseMock,
    consoleLogSpy,
    consoleErrorSpy,
    processOnSpy,
    processExitSpy,
    getSigintHandler: () => sigintHandler,
  };
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
});

describe('Server wiring and lifecycle', () => {
  test('registers middleware in correct order and mounts API routes', () => {
    const { appMock, expressFnMock } = loadServerWithMocks({
      dbConnectResolves: true,
      port: '5050',
    });

    // express() was called to create the app
    expect(expressFnMock).toHaveBeenCalledTimes(1);

    // Middleware order
    expect(appMock.use).toHaveBeenNthCalledWith(1, 'CORS_MW');
    expect(appMock.use).toHaveBeenNthCalledWith(2, 'JSON_MW');
    expect(appMock.use).toHaveBeenNthCalledWith(3, 'URLENCODED_MW');
    // static middleware
    const staticCall = appMock.use.mock.calls[3];
    expect(staticCall).toHaveLength(1);
    expect(staticCall[0]).toBe('STATIC_MW');

    // Route mounts
    expect(appMock.use).toHaveBeenCalledWith(
      '/api/todos',
      'TODO_ROUTES'
    );
    expect(appMock.use).toHaveBeenCalledWith(
      '/api/activities',
      'ACTIVITY_ROUTES'
    );

    // Root route registered
    expect(appMock.get).toHaveBeenCalledTimes(1);
    const [rootPath, rootHandler] = appMock.get.mock.calls[0];
    expect(rootPath).toBe('/');

    // Validate the root handler sends index.html
    const res = {
      sendFile: jest.fn(),
    };
    rootHandler({}, res);
    expect(res.sendFile).toHaveBeenCalledTimes(1);
    const sentPath = res.sendFile.mock.calls[0][0];
    expect(typeof sentPath).toBe('string');
    expect(
      sentPath
    ).toContain(
      path
        .join('public', 'index.html')
        .replace(/\\+/g, path.sep)
    );
  });

  test('adds error handling middleware (500) and 404 handler', () => {
    const { appMock } = loadServerWithMocks();

    // Find the error handler (arity 4)
    const errorUseCall = appMock.use.mock.calls.find(
      (args) =>
        args.length === 1 &&
        typeof args[0] === 'function' &&
        args[0].length === 4
    );
    expect(errorUseCall).toBeTruthy();
    const errorHandler = errorUseCall[0];

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    errorHandler(new Error('boom'), {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Something went wrong!',
    });

    // The last app.use should be the 404 handler (arity 2)
    const lastUseCall =
      appMock.use.mock.calls[
        appMock.use.mock.calls.length - 1
      ];
    expect(lastUseCall).toHaveLength(1);
    const notFoundHandler = lastUseCall[0];
    expect(typeof notFoundHandler).toBe('function');
    expect(notFoundHandler.length).toBe(2);

    const res404 = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    notFoundHandler({}, res404);
    expect(res404.status).toHaveBeenCalledWith(404);
    expect(res404.json).toHaveBeenCalledWith({
      error: 'Route not found',
    });
  });

  test('successful startup connects to DB, listens on PORT, and logs banner', async () => {
    const {
      appMock,
      databaseMock,
      consoleLogSpy,
    } = loadServerWithMocks({
      dbConnectResolves: true,
      port: '5678',
    });

    expect(databaseMock.connect).toHaveBeenCalledTimes(1);
    expect(appMock.listen).toHaveBeenCalledTimes(1);
    const [portArg, cb] =
      appMock.listen.mock.calls[0];
    expect(String(portArg)).toBe('5678');
    expect(typeof cb).toBe('function');

    // listen mock calls the cb immediately, so banner should be logged
    expect(consoleLogSpy).toHaveBeenCalled();
    const msg = consoleLogSpy.mock.calls
      .map((c) => c.join(' '))
      .join('\n');
    expect(msg).toContain(
      'Server is running on http://localhost:5678'
    );
  });

  test('failed startup logs error and exits with code 1', async () => {
    const {
      databaseMock,
      processExitSpy,
      consoleErrorSpy,
    } = loadServerWithMocks({
      dbConnectResolves: false,
      port: '6789',
    });

    // Allow the async startServer to run its catch block
    await new Promise((resolve) =>
      setImmediate(resolve)
    );

    expect(databaseMock.connect).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalled();
    const errMsg = consoleErrorSpy.mock.calls
      .map((c) => c.join(' '))
      .join('\n');
    expect(errMsg).toMatch(/Failed to start server/i);
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  test('graceful shutdown on SIGINT closes DB and exits 0', async () => {
    const {
      databaseMock,
      getSigintHandler,
      processExitSpy,
      consoleLogSpy,
    } = loadServerWithMocks({
      dbCloseResolves: true,
    });
    const handler = getSigintHandler();
    expect(typeof handler).toBe('function');

    await handler();

    expect(consoleLogSpy).toHaveBeenCalled();
    const msg = consoleLogSpy.mock.calls
      .map((c) => c.join(' '))
      .join('\n');
    expect(msg).toMatch(/Shutting down server/i);
    expect(databaseMock.close).toHaveBeenCalledTimes(1);
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });

  test('graceful shutdown logs error and exits 1 if DB close fails', async () => {
    const {
      databaseMock,
      getSigintHandler,
      processExitSpy,
      consoleErrorSpy,
    } = loadServerWithMocks({
      dbCloseResolves: false,
    });
    const handler = getSigintHandler();
    expect(typeof handler).toBe('function');

    await handler();

    expect(databaseMock.close).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalled();
    const errMsg = consoleErrorSpy.mock.calls
      .map((c) => c.join(' '))
      .join('\n');
    expect(errMsg).toMatch(/Error during shutdown/i);
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  test('body-parser is configured with urlencoded({ extended: true })', () => {
    const { bodyParserMock } =
      loadServerWithMocks();
    expect(
      bodyParserMock.urlencoded
    ).toHaveBeenCalledWith({ extended: true });
  });

  test('static assets are served from a "public" directory', () => {
    const { expressFnMock } =
      loadServerWithMocks();
    // access the express.static mock attached to the express function
    expect(typeof require('express').static).toBe(
      'function'
    );
    const staticArgs =
      require('express').static.mock.calls[0] || [];
    expect(staticArgs).toHaveLength(1);
    expect(String(staticArgs[0])).toContain(
      'public'
    );
  });
});