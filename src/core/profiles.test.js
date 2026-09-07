const { validateProfile, isProfileAllowlisted } = require('./profiles');

describe('focus profiles', () => {
  test('validates and matches allowed domains', () => {
    const profile = { id: 'p1', name: 'Work', allowedDomains: ['example.com'], allowedCategories: [] };
    expect(validateProfile(profile).valid).toBe(true);
    expect(isProfileAllowlisted(profile, 'https://docs.example.com/file', 'Other')).toBe(true);
    expect(isProfileAllowlisted(profile, 'https://unrelated.test', 'Other')).toBe(false);
  });

  test('keeps imported URL allowlists on the same origin', () => {
    const profile = {
      id: 'p2',
      name: 'Focused',
      allowedDomains: ['https://example.com/docs'],
      allowedCategories: [],
    };
    expect(isProfileAllowlisted(profile, 'https://example.com/docs/file', 'Other')).toBe(true);
    expect(isProfileAllowlisted(profile, 'https://example.com.evil.test/docs/file', 'Other')).toBe(false);
  });
});
