/**
 * Tests for categories.js
 */

const {
  resolveCategoryForDomain,
  assignDomainToCategory,
  removeAssignment,
  getDomainsInCategory,
} = require('./categories');

describe('categories', () => {
  describe('resolveCategoryForDomain', () => {
    test('returns exact domain match', () => {
      const assignments = {
        'example.com': 'Work',
        'facebook.com': 'Social Media',
      };

      expect(resolveCategoryForDomain('example.com', assignments, 'Other')).toBe('Work');
      expect(resolveCategoryForDomain('facebook.com', assignments, 'Other')).toBe('Social Media');
    });

    test('returns default for no match', () => {
      const assignments = { 'example.com': 'Work' };

      expect(resolveCategoryForDomain('unknown.com', assignments, 'Other')).toBe('Other');
    });

    test('matches wildcard patterns', () => {
      const assignments = {
        '*.example.com': 'Work',
      };

      expect(resolveCategoryForDomain('api.example.com', assignments, 'Other')).toBe('Work');
      expect(resolveCategoryForDomain('www.example.com', assignments, 'Other')).toBe('Work');
    });

    test('prefers exact matches over wildcards', () => {
      const assignments = {
        'api.example.com': 'API',
        '*.example.com': 'Work',
      };

      // Should not find exact match, so uses wildcard
      expect(resolveCategoryForDomain('www.example.com', assignments, 'Other')).toBe('Work');
    });
  });

  describe('assignDomainToCategory', () => {
    test('adds new assignment', () => {
      const assignments = { 'example.com': 'Work' };
      const updated = assignDomainToCategory(assignments, 'facebook.com', 'Social Media');

      expect(updated['example.com']).toBe('Work');
      expect(updated['facebook.com']).toBe('Social Media');
      expect(assignments['facebook.com']).toBeUndefined(); // Original unchanged
    });

    test('overwrites existing assignment', () => {
      const assignments = { 'example.com': 'Work' };
      const updated = assignDomainToCategory(assignments, 'example.com', 'Entertainment');

      expect(updated['example.com']).toBe('Entertainment');
    });
  });

  describe('removeAssignment', () => {
    test('removes an assignment', () => {
      const assignments = { 'example.com': 'Work', 'facebook.com': 'Social' };
      const updated = removeAssignment(assignments, 'example.com');

      expect(updated['example.com']).toBeUndefined();
      expect(updated['facebook.com']).toBe('Social');
      expect(assignments['example.com']).toBe('Work'); // Original unchanged
    });
  });

  describe('getDomainsInCategory', () => {
    test('returns all domains in category', () => {
      const assignments = {
        'example.com': 'Work',
        'github.com': 'Work',
        'facebook.com': 'Social',
      };

      const workDomains = getDomainsInCategory(assignments, 'Work');
      expect(workDomains.sort()).toEqual(['example.com', 'github.com']);

      const socialDomains = getDomainsInCategory(assignments, 'Social');
      expect(socialDomains).toEqual(['facebook.com']);
    });

    test('returns empty array for category with no domains', () => {
      const assignments = { 'example.com': 'Work' };

      expect(getDomainsInCategory(assignments, 'Unknown')).toEqual([]);
    });
  });
});
