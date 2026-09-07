const fs = require('fs');
const path = require('path');
const vm = require('vm');

const read = (file) => fs.readFileSync(path.join(__dirname, '../..', file), 'utf8');
function setup(data = {}) {
  const elements = {};
  const context = vm.createContext({
    console: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    URL,
    URLSearchParams,
    document: { addEventListener: jest.fn(), getElementById: (id) => elements[id] || null, querySelectorAll: () => [] },
    browser: {
      storage: {
        local: {
          get: async () => structuredClone(data),
          set: jest.fn(async (values) => Object.assign(data, structuredClone(values))),
        },
      },
      runtime: { sendMessage: jest.fn(async () => ({})) },
    },
    alert: jest.fn(),
  });
  for (const file of [
    'src/core/domain-matcher.js',
    'src/core/categories.js',
    'src/core/rules.js',
    'src/core/schedules.js',
    'src/core/insights.js',
    'options/options-utils.js',
    'options/options-state.js',
    'options/options-main.js',
    'options/options-handlers.js',
    'options/options-feature-polish.js',
  ]) {
    vm.runInContext(read(file), context, { filename: file });
  }
  return { context, elements };
}

test('options finish loading with exclusions and retain all-time totals beyond retained daily history', async () => {
  const { context } = setup({
    trackedData: { 'work.test': 600, 'private.test': 300 },
    dailyDomainData: { '2026-09-07': { 'work.test': 60, 'private.test': 30 } },
    categoryAssignments: { 'work.test': 'Work' },
    trackingExclusions: { 'private.test': true },
  });
  context.UIElements = {};
  context.updateDisplayForSelectedRangeUI = jest.fn();
  await context.loadAllData();
  expect(context.console.error).not.toHaveBeenCalled();
  expect(context.updateDisplayForSelectedRangeUI).toHaveBeenCalledWith(true);
  expect(vm.runInContext('AppState.categoryTimeData', context)).toEqual({ Work: 600 });
  expect(vm.runInContext('AppState.dailyCategoryData', context)).toEqual({ '2026-09-07': { Work: 60 } });
});

test('rule editor preserves exact URL and exact domain exceptions on unrelated edits', () => {
  const { context, elements } = setup();
  const exceptions = [
    { value: 'https://example.com/allowed', matchMode: 'exact-url' },
    { value: 'safe.test', matchMode: 'domain' },
  ];
  context.originalExceptions = exceptions;
  vm.runInContext(
    "AppState.rules = [{ id: 'r', type: 'limit-url', value: 'example.com', matchMode: 'domain', exceptions: originalExceptions }]; AppState.editingRuleIndex = 0;",
    context
  );
  context.UIElements = {
    editRulePatternInput: { value: 'example.com' },
    editRuleLimitInput: { value: '10' },
    editRuleUnitSelect: { value: 'minutes' },
  };
  vm.runInContext('Object.assign(UIElements, globalThis.UIElements)', context);
  elements.editRuleExceptionsInput = { value: 'https://example.com/allowed, safe.test' };
  context.saveRules = jest.fn();
  context.displayMessage = jest.fn();
  context.handleSaveChangesClick();
  const rule = vm.runInContext('AppState.rules[0]', context);
  expect(rule.exceptions).toEqual(exceptions);
  expect(context.ruleHasMatchingException(rule, 'https://example.com/allowed-extra')).toBe(false);
  expect(context.ruleHasMatchingException(rule, 'https://sub.safe.test')).toBe(false);
  expect(context.saveRules).toHaveBeenCalled();
});

test('profile form preserves day-only schedules and rejects no selected days', async () => {
  const data = {};
  const { context, elements } = setup(data);
  elements.profileNameInput = { value: 'Weekdays' };
  elements.profileDomainsInput = { value: 'work.test' };
  elements.profileStartTimeInput = { value: '' };
  elements.profileEndTimeInput = { value: '' };
  elements.saveProfileBtn = {};
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((value) => ({ value, checked: true }));
  context.document.querySelectorAll = () => days;
  context.loadFeatureData = jest.fn();
  context.featureStatus = jest.fn();
  await context.saveProfileFromForm();
  expect(context.isScheduleActive(data.profiles[0].schedule, new Date(2026, 8, 7, 12))).toBe(true);
  expect(context.isScheduleActive(data.profiles[0].schedule, new Date(2026, 8, 12, 12))).toBe(false);
  elements.profileNameInput.value = 'Empty';
  elements.profileDomainsInput.value = 'work.test';
  context.document.querySelectorAll = () => [];
  context.browser.storage.local.set.mockClear();
  await context.saveProfileFromForm();
  expect(context.browser.storage.local.set).not.toHaveBeenCalled();
});

test('weekly summary renders saved numeric productive ratings', () => {
  const { context, elements } = setup();
  const node = () => ({
    children: [],
    append(...items) {
      this.children.push(...items);
    },
    appendChild(item) {
      this.children.push(item);
    },
    replaceChildren() {
      this.children = [];
    },
  });
  context.document.createElement = node;
  elements.weeklySummaryMetrics = node();
  elements.weeklySummaryStatus = {};
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  context.renderWeeklySummary({
    dailyDomainData: { [date]: { 'work.test': 180 } },
    categoryAssignments: { 'work.test': 'Work' },
    categoryProductivityRatings: { Work: 1 },
  });
  expect(elements.weeklySummaryMetrics.children[0].children[1].textContent).toBe('100%');
});

test('category refresh and background save preserve renamed categories and unsaved usage', async () => {
  const data = { categories: ['New', 'Other'], categoryAssignments: { 'work.test': 'New' }, rules: [] };
  const { context } = setup(data);
  context.FocusFlowState = {
    categories: ['Old', 'Other'],
    defaultCategory: 'Other',
    trackedData: { 'work.test': 65 },
    dailyDomainData: { '2026-09-07': { 'work.test': 65 } },
    categoryTimeData: { Old: 60 },
    dailyCategoryData: { '2026-09-07': { Old: 60 } },
    pomodoroDailyStats: {},
    pomodoroAllTimeStats: {},
  };
  const utils = read('background/utils.js');
  vm.runInContext(
    utils.slice(utils.indexOf('function getCategoryForDomain('), utils.indexOf('function debounce(')),
    context
  );
  vm.runInContext(read('background/storage.js'), context);
  const main = read('background/main.js');
  vm.runInContext(
    main.slice(main.indexOf('async function updateRuleAndAssignmentCache()'), main.indexOf('const POMODORO_PHASES')),
    context
  );
  await context.updateRuleAndAssignmentCache();
  await context.performSave();
  expect(data.categories).toEqual(['New', 'Other']);
  expect(data.categoryTimeData).toEqual({ New: 65 });
  expect(data.dailyCategoryData).toEqual({ '2026-09-07': { New: 65 } });
  expect(data.trackedData).toEqual({ 'work.test': 65 });
});
