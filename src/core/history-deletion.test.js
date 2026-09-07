const { planHistoryDeletion } = require('./history-deletion');
const history = () => ({
  trackedData: { 'a.test': 150, 'b.test': 80 },
  dailyDomainData: { '2026-09-06': { 'a.test': 30 }, '2026-09-07': { 'a.test': 60, 'b.test': 80 } },
  hourlyData: { '2026-09-06': { '09': 30 }, '2026-09-07': { 10: 140 } },
  categoryAssignments: { 'a.test': 'Work', 'b.test': 'Social' },
  rules: [{ id: 'keep' }],
});
test('website deletion removes older all-time totals and preserves other sites', () => {
  const data = history();
  const plan = planHistoryDeletion(data, { domain: 'a.test' });
  expect(plan.seconds).toBe(150);
  expect(plan.updates.trackedData).toEqual({ 'b.test': 80 });
  expect(plan.updates.dailyDomainData).toEqual({ '2026-09-07': { 'b.test': 80 } });
  expect(plan.updates.categoryTimeData).toEqual({ Social: 80 });
  expect(plan.updates.hourlyData).toEqual({});
  expect(plan.hourlyDayCount).toBe(2);
  expect(data).toEqual(history());
  expect(plan.updates.rules).toBeUndefined();
});
test('inclusive date deletion subtracts only that interval from all-time totals', () => {
  const plan = planHistoryDeletion(history(), { from: '2026-09-07', to: '2026-09-07' });
  expect(plan.seconds).toBe(140);
  expect(plan.updates.trackedData).toEqual({ 'a.test': 90 });
  expect(plan.updates.hourlyData).toEqual({ '2026-09-06': { '09': 30 } });
});
test('combined selection keeps the same website outside the range', () => {
  const plan = planHistoryDeletion(history(), { domain: 'a.test', from: '2026-09-07', to: '2026-09-07' });
  expect(plan.updates.trackedData).toEqual({ 'a.test': 90, 'b.test': 80 });
  expect(plan.updates.dailyCategoryData).toEqual({ '2026-09-06': { Work: 30 }, '2026-09-07': { Social: 80 } });
});
test.each([
  {},
  { from: '2026-09-07' },
  { from: '2026-09-08', to: '2026-09-07' },
  { from: '2026-02-30', to: '2026-03-01' },
])('rejects unsafe or invalid selections %j', (selection) => {
  expect(() => planHistoryDeletion(history(), selection)).toThrow();
});
