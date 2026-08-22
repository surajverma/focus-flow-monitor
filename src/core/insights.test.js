const { buildWeeklySummary, getUsageForPeriod } = require('./insights');

describe('local weekly insights', () => {
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
});
