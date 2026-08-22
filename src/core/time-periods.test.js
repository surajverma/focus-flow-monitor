/**
 * Tests for time-periods.js
 */

const { getStartOfDay, getStartOfWeek, getDateString, getHourString } = require('./time-periods');

describe('time-periods', () => {
  describe('getStartOfDay', () => {
    test('returns midnight of the given date', () => {
      const date = new Date('2026-08-21T14:30:45.000Z');
      const startOfDay = getStartOfDay(date);
      const result = new Date(startOfDay);

      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
    });

    test('uses current date if not provided', () => {
      const startOfDay = getStartOfDay();
      const result = new Date(startOfDay);

      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
    });
  });

  describe('getDateString', () => {
    test('formats date as YYYY-MM-DD', () => {
      const timestamp = new Date('2026-08-21').getTime();
      expect(getDateString(timestamp)).toBe('2026-08-21');
    });

    test('pads month and day with zeros', () => {
      const timestamp = new Date('2026-01-05').getTime();
      expect(getDateString(timestamp)).toBe('2026-01-05');
    });
  });

  describe('getHourString', () => {
    test('formats hour as HH', () => {
      const timestamp = new Date('2026-08-21T09:30:00').getTime();
      expect(getHourString(timestamp)).toBe('09');

      const timestamp2 = new Date('2026-08-21T15:30:00').getTime();
      expect(getHourString(timestamp2)).toBe('15');
    });
  });

  describe('getStartOfWeek', () => {
    test('returns Monday at midnight for week start', () => {
      // 2026-08-21 is a Friday
      const date = new Date('2026-08-21');
      const weekStart = getStartOfWeek(date);
      const result = new Date(weekStart);

      // Should be Monday 2026-08-17
      expect(result.getDay()).toBe(1); // Monday
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
    });
  });
});
