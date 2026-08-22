const { validateProfile, isProfileAllowlisted } = require('./profiles');

describe('focus profiles', () => {
  test('validates and matches allowed domains', () => {
    const profile = { id: 'p1', name: 'Work', allowedDomains: ['example.com'], allowedCategories: [] };
    expect(validateProfile(profile).valid).toBe(true);
    expect(isProfileAllowlisted(profile, 'https://docs.example.com/file', 'Other')).toBe(true);
    expect(isProfileAllowlisted(profile, 'https://unrelated.test', 'Other')).toBe(false);
  });
});
