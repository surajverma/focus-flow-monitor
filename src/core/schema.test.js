const { CURRENT_SCHEMA_VERSION, generateRuleId, migrateData, validateSchema } = require('./schema');

describe('storage schema migrations', () => {
  test('generates stable rule ids and preserves an inactive profile value', () => {
    const rule = { type: 'block-domain', value: 'example.com' };
    expect(generateRuleId(rule, 0)).toBe(generateRuleId(rule, 0));
    const migrated = migrateData({
      schemaVersion: 1,
      categories: ['Other'],
      rules: [rule],
      activeFocusProfile: null,
    });
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.rules[0].id).toMatch(/^rule_/);
    expect(migrated.rules[0].type).toBe('block-url');
    expect(migrated.rules[0].matchMode).toBe('domain');
    expect(migrated.activeFocusProfile).toBeNull();
  });

  test('repairs arrays and objects to their correct container types', () => {
    const data = { categories: {}, rules: {}, profiles: {}, dailyDomainData: [] };
    validateSchema(data);
    expect(data.categories).toEqual(['Other']);
    expect(data.rules).toEqual([]);
    expect(data.profiles).toEqual([]);
    expect(data.dailyDomainData).toEqual({});
  });
});

const fs = require('fs');
const vm = require('vm');
const { getDefaultSchema } = require('./schema');

test('schema defaults agree with dashboard ratings and produce a nonzero focus score', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(require.resolve('../../options/options-utils'), 'utf8'), context);
  const ratings = getDefaultSchema().categoryProductivityRatings;
  expect(ratings).toEqual(vm.runInContext('defaultCategoryProductivityRatings', context));
  expect(context.calculateFocusScore({ 'Work/Productivity': 180, Other: 60 }, ratings).score).toBe(75);
});

test('repairs legacy ratings even at the current schema version and preserves overrides', () => {
  const original = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    categoryProductivityRatings: { Work: 'productive', Rest: 'neutral', Social: 'distracting', Finance: 1, Custom: -1 },
  };
  const migrated = migrateData(original);
  expect(migrated.categoryProductivityRatings).toEqual({ Work: 1, Rest: 0, Social: -1, Finance: 1, Custom: -1 });
  expect(original.categoryProductivityRatings.Work).toBe('productive');
  expect(migrateData(migrated)).toEqual(migrated);
});
