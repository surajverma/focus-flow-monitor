const { splitIntervalByHour, splitIntervalByDay, aggregateIntervals } = require('./tracking-intervals');

describe('tracking interval attribution', () => {
  test('splits an interval across two hours', () => {
    const start = new Date(2026, 7, 21, 10, 59, 50).getTime();
    const end = new Date(2026, 7, 21, 11, 0, 10).getTime();
    expect(splitIntervalByHour(start, end)).toEqual([
      { date: '2026-08-21', hour: '10', seconds: 10 },
      { date: '2026-08-21', hour: '11', seconds: 10 },
    ]);
  });

  test('splits an interval across midnight', () => {
    const start = new Date(2026, 7, 21, 23, 58).getTime();
    const end = new Date(2026, 7, 22, 0, 2).getTime();
    expect(splitIntervalByDay(start, end)).toEqual([
      { date: '2026-08-21', seconds: 120 },
      { date: '2026-08-22', seconds: 120 },
    ]);
  });

  test('aggregates split hourly intervals by date and hour', () => {
    const result = aggregateIntervals([
      { date: '2026-08-21', hour: '23', seconds: 120 },
      { date: '2026-08-22', hour: '00', seconds: 120 },
    ]);
    expect(result.dailyData).toEqual({ '2026-08-21': 120, '2026-08-22': 120 });
    expect(result.hourlyData['2026-08-22']['00']).toBe(120);
  });

  test('does not lose a sub-second interval at a boundary', () => {
    const start = new Date(2026, 7, 21, 10, 59, 59, 500).getTime();
    const end = new Date(2026, 7, 21, 11, 0, 0, 500).getTime();
    const parts = splitIntervalByHour(start, end);
    expect(parts.reduce((sum, part) => sum + part.seconds, 0)).toBe(1);
  });
});
