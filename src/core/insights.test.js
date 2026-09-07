const { buildWeeklySummary, getUsageForPeriod } = require('./insights');

describe('local weekly insights', () => {
  test('uses saved numeric ratings, defaults, and explicit neutral overrides', () => {
    const summary = buildWeeklySummary(
      {
        dailyDomainData: { '2026-09-07': { a: 60, b: 60, c: 60, d: 60 } },
        categoryAssignments: { a: 'Custom', b: 'Work/Productivity', c: 'Reference & Learning', d: 'Social Media' },
        productivityRatings: { Custom: 1, 'Reference & Learning': 0 },
      },
      new Date(2026, 8, 7)
    );
    expect(summary.focusScore).toBe(50);
    expect(summary.productiveSeconds).toBe(120);
    expect(summary.neutralSeconds).toBe(60);
    expect(summary.distractingSeconds).toBe(60);
    expect(summary.startDate).toBe('2026-09-07');
    expect(summary.endDate).toBe('2026-09-13');
  });

  test('compares numeric scores across weeks and selects the most focused day', () => {
    const summary = buildWeeklySummary(
      {
        dailyDomainData: {
          '2026-08-31': { work: 60, social: 60 },
          '2026-09-07': { social: 600 },
          '2026-09-08': { work: 60 },
        },
        categoryAssignments: { work: 'Work', social: 'Social' },
        productivityRatings: { Work: 1, Social: -1 },
      },
      new Date(2026, 8, 8)
    );
    expect(summary.previousFocusScore).toBe(50);
    expect(summary.focusScore).toBe(9);
    expect(summary.focusScoreChange).toBe(-41);
    expect(summary.bestDay.date).toBe('2026-09-08');
  });

  test('aggregates current week and compares focus score', () => {
    const summary = buildWeeklySummary(
      {
        dailyDomainData: { '2026-08-17': { 'work.test': 3600, 'social.test': 1800 } },
        dailyCategoryData: { '2026-08-17': { Work: 3600, Social: 1800 } },
        productivityRatings: { Work: 'productive', Social: 'distracting' },
      },
      new Date(2026, 7, 21)
    );
    expect(summary.totalSeconds).toBe(5400);
    expect(summary.focusScore).toBe(67);
    expect(summary.bestDay.date).toBe('2026-08-17');
  });

  test('uses calendar week and month data without rolling windows', () => {
    const data = { '2026-08-01': { example: 60 }, '2026-08-31': { example: 120 } };
    expect(getUsageForPeriod(data, 'example', 'month', new Date(2026, 7, 10))).toBe(180);
  });

  test('omits historical data for excluded domains and recalculates categories', () => {
    const summary = buildWeeklySummary(
      {
        dailyDomainData: { '2026-08-17': { 'work.test': 300, 'private.test': 600 } },
        dailyCategoryData: { '2026-08-17': { Work: 300, Social: 600 } },
        categoryAssignments: { 'work.test': 'Work', 'private.test': 'Social' },
        trackingExclusions: { 'private.test': true },
        productivityRatings: { Work: 'productive', Social: 'distracting' },
      },
      new Date(2026, 7, 21)
    );
    expect(summary.totalSeconds).toBe(300);
    expect(summary.focusScore).toBe(100);
    expect(summary.topDomains).toEqual([{ domain: 'work.test', seconds: 300 }]);
  });
});
