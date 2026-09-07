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
