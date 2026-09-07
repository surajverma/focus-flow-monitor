/**
 * Tests for schedules.js
 */

const { isScheduleActive, isRuleActive } = require('./schedules');

describe('schedules', () => {
  describe('isScheduleActive', () => {
    test('returns true for all-day schedule without day/time restrictions', () => {
      const schedule = {};
      expect(isScheduleActive(schedule, new Date())).toBe(true);
    });

    test('checks specific day', () => {
      // Mock a Friday (day 5)
      const friday = new Date('2026-08-21'); // Friday
      const schedule = { days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] };

      expect(isScheduleActive(schedule, friday)).toBe(true);
    });

    test('returns false for unselected day', () => {
      // Mock a Saturday (day 6)
      const saturday = new Date('2026-08-22'); // Saturday
      const schedule = { days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] };

      expect(isScheduleActive(schedule, saturday)).toBe(false);
    });

    test('handles time range within day', () => {
      const testDate = new Date('2026-08-21T14:30:00'); // 14:30
      const schedule = {
        days: ['Fri'],
        startTime: '09:00',
        endTime: '17:00',
      };

      expect(isScheduleActive(schedule, testDate)).toBe(true);
    });

    test('returns false for time outside range', () => {
      const testDate = new Date('2026-08-21T18:30:00'); // 18:30
      const schedule = {
        days: ['Fri'],
        startTime: '09:00',
        endTime: '17:00',
      };

      expect(isScheduleActive(schedule, testDate)).toBe(false);
    });

    test('handles overnight schedule', () => {
      // Test 23:00 on Monday
      const mondayNight = new Date('2026-08-17T23:00:00');
      const overnightSchedule = {
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        startTime: '22:00',
        endTime: '06:00',
      };

      expect(isScheduleActive(overnightSchedule, mondayNight)).toBe(true);

      // Test 05:00 on Tuesday (same overnight window)
      const tuesdayMorning = new Date('2026-08-18T05:00:00');
      expect(isScheduleActive(overnightSchedule, tuesdayMorning)).toBe(true);

      // Test 07:00 on Tuesday (outside window)
      const tuesdayLater = new Date('2026-08-18T07:00:00');
      expect(isScheduleActive(overnightSchedule, tuesdayLater)).toBe(false);
    });

    test('uses the previous selected day for the after-midnight part of an overnight schedule', () => {
      const mondayOnly = { days: ['Mon'], startTime: '22:00', endTime: '06:00' };

      expect(isScheduleActive(mondayOnly, new Date('2026-08-18T05:00:00'))).toBe(true);
      expect(isScheduleActive(mondayOnly, new Date('2026-08-17T05:00:00'))).toBe(false);
    });
  });

  describe('isRuleActive', () => {
    test('returns false for disabled rule', () => {
      const rule = { enabled: false };
      expect(isRuleActive(rule)).toBe(false);
    });

    test('returns true for enabled rule without schedule', () => {
      const rule = { enabled: true };
      expect(isRuleActive(rule)).toBe(true);
    });

    test('respects schedule when present', () => {
      const testDate = new Date('2026-08-21T14:30:00');
      const rule = {
        enabled: true,
        schedule: {
          enabled: true,
          days: ['Fri'],
          startTime: '09:00',
          endTime: '17:00',
        },
      };

      expect(isRuleActive(rule, testDate)).toBe(true);

      const outsideTime = new Date('2026-08-21T18:30:00');
      expect(isRuleActive(rule, outsideTime)).toBe(false);
    });

    test('respects legacy flat schedules', () => {
      const rule = { enabled: true, days: ['Fri'], startTime: '09:00', endTime: '17:00' };
      expect(isRuleActive(rule, new Date('2026-08-21T14:30:00'))).toBe(true);
      expect(isRuleActive(rule, new Date('2026-08-21T18:30:00'))).toBe(false);
    });

    test('treats a disabled nested schedule as unrestricted', () => {
      const rule = {
        enabled: true,
        schedule: { enabled: false, days: ['Fri'], startTime: '09:00', endTime: '17:00' },
      };
      expect(isRuleActive(rule, new Date('2026-08-22T18:30:00'))).toBe(true);
    });
  });
});
