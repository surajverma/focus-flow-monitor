/**
 * Tests for domain-matcher.js
 */

const {
  normalizeDomain,
  extractAndNormalizeHostname,
  domainMatchesPattern,
  urlMatchesPrefix,
  normalizeURLPrefix,
} = require('./domain-matcher');

describe('domain-matcher', () => {
  describe('normalizeDomain', () => {
    test('converts to lowercase', () => {
      expect(normalizeDomain('EXAMPLE.COM')).toBe('example.com');
    });

    test('removes leading www.', () => {
      expect(normalizeDomain('www.example.com')).toBe('example.com');
    });

    test('handles edge cases', () => {
      expect(normalizeDomain('')).toBeNull();
      expect(normalizeDomain(null)).toBeNull();
      expect(normalizeDomain('   ')).toBeNull();
    });
  });

  describe('extractAndNormalizeHostname', () => {
    test('extracts hostname from valid URL', () => {
      expect(extractAndNormalizeHostname('https://www.example.com/path')).toBe('example.com');
    });

    test('rejects extension URLs', () => {
      expect(extractAndNormalizeHostname('moz-extension://xyz/page')).toBeNull();
      expect(extractAndNormalizeHostname('chrome-extension://abc/page')).toBeNull();
      expect(extractAndNormalizeHostname('about:blank')).toBeNull();
    });

    test('handles edge cases', () => {
      expect(extractAndNormalizeHostname('')).toBeNull();
      expect(extractAndNormalizeHostname('not-a-url')).toBeNull();
      expect(extractAndNormalizeHostname('ftp://example.com/file')).toBeNull();
    });
  });

  describe('domainMatchesPattern', () => {
    test('matches exact domains', () => {
      expect(domainMatchesPattern('example.com', 'example.com')).toBe(true);
      expect(domainMatchesPattern('example.com', 'other.com')).toBe(false);
    });

    test('matches wildcard patterns', () => {
      expect(domainMatchesPattern('www.example.com', '*.example.com')).toBe(true);
      expect(domainMatchesPattern('api.example.com', '*.example.com')).toBe(true);
      expect(domainMatchesPattern('example.com', '*.example.com')).toBe(true);
      expect(domainMatchesPattern('other.com', '*.example.com')).toBe(false);
    });

    test('prevents notexample.com from matching example.com', () => {
      expect(domainMatchesPattern('notexample.com', 'example.com')).toBe(false);
      expect(domainMatchesPattern('notexample.com', '*.example.com')).toBe(false);
    });

    test('handles case sensitivity', () => {
      expect(domainMatchesPattern('EXAMPLE.COM', 'example.com')).toBe(true);
      expect(domainMatchesPattern('example.com', 'EXAMPLE.COM')).toBe(true);
    });
  });

  describe('urlMatchesPrefix', () => {
    test('matches URL prefixes', () => {
      expect(urlMatchesPrefix('https://example.com/api/users', 'https://example.com/api')).toBe(true);
      expect(urlMatchesPrefix('https://example.com/api/users/123', 'https://example.com/api/users')).toBe(true);
    });

    test('does not match non-prefixes', () => {
      expect(urlMatchesPrefix('https://example.com/v2/api', 'https://example.com/v1/api')).toBe(false);
      expect(urlMatchesPrefix('https://example.com.evil.test/api', 'https://example.com')).toBe(false);
    });

    test('handles rejects extension URLs', () => {
      expect(urlMatchesPrefix('moz-extension://xyz/page', 'https://example.com')).toBe(false);
    });
  });

  describe('normalizeURLPrefix', () => {
    test('normalizes URL prefix correctly', () => {
      expect(normalizeURLPrefix('https://www.example.com/api/v1')).toBe('https://example.com/api/v1');
      expect(normalizeURLPrefix('HTTPS://EXAMPLE.COM/api')).toBe('https://example.com/api');
    });

    test('rejects invalid URLs', () => {
      expect(normalizeURLPrefix('not-a-url')).toBeNull();
      expect(normalizeURLPrefix('moz-extension://xyz')).toBeNull();
    });
  });
});
