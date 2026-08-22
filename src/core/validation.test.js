const { validateBackup, sanitizeImportedData } = require('./validation');

describe('backup validation and sanitization', () => {
  test('rejects malformed versioned backups and unknown top-level keys', () => {
    expect(validateBackup({ version: 2, rules: 'bad' }).valid).toBe(false);
    const sanitized = sanitizeImportedData({
      version: 2,
      categories: ['Work'],
      injected: true,
      trackingExclusions: { test: true },
    });
    expect(sanitized.injected).toBeUndefined();
    expect(sanitized.trackingExclusions).toEqual({ test: true });
  });

  test('accepts legacy backups without a version marker for migration', () => {
    expect(validateBackup({ categories: ['Other'] }).valid).toBe(true);
  });
});
