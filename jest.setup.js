// Mock browser API for testing
global.browser = {
  runtime: {
    getURL: (path) => `moz-extension://dummy/${path}`,
  },
  storage: {
    local: {
      get: jest.fn().mockResolvedValue({}),
      set: jest.fn().mockResolvedValue({}),
      remove: jest.fn().mockResolvedValue({}),
    },
  },
  alarms: {
    create: jest.fn(),
    clear: jest.fn(),
    onAlarm: {
      addListener: jest.fn(),
    },
  },
  tabs: {
    query: jest.fn(),
  },
  windows: {
    getLastFocused: jest.fn(),
  },
  idle: {
    queryState: jest.fn().mockResolvedValue('active'),
  },
  permissions: {
    contains: jest.fn().mockResolvedValue(false),
  },
  webRequest: {
    onBeforeRequest: {
      addListener: jest.fn(),
    },
  },
  notifications: {
    create: jest.fn(),
  },
};
