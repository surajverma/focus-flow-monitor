const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { normalizeLocalGoal } = require('./goals');
const { sanitizeImportedData } = require('./validation');
const context = vm.createContext({});
for (const file of ['insights.js', 'goals.js'])
  vm.runInContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), context);
const goal = {
  id: 'goal',
  name: 'Focus',
  targetType: 'productive',
  target: '',
  direction: 'at-least',
  targetSeconds: 120,
  period: 'day',
};
const data = {
  dailyDomainData: { '2026-09-06': { 'work.test': 600 }, '2026-09-07': { 'work.test': 120, 'private.test': 300 } },
  categoryAssignments: { 'work.test': 'Work', 'private.test': 'Work' },
  categoryProductivityRatings: { Work: 1 },
  trackingExclusions: { 'private.test': true },
};
test('productive daily goal respects ratings and exclusions', () => {
  const progress = context.getLocalGoalProgress(goal, data, new Date(2026, 8, 7));
  expect(progress.seconds).toBe(120);
  expect(progress.status).toBe('Goal reached');
});
test('weekly category budget resets Monday and distinguishes at versus over target', () => {
  const budget = { ...goal, targetType: 'category', target: 'Work', direction: 'at-most', period: 'week' };
  expect(context.getLocalGoalProgress(budget, data, new Date(2026, 8, 7)).status).toBe('Within target');
  expect(context.getLocalGoalProgress({ ...budget, targetSeconds: 60 }, data, new Date(2026, 8, 7)).status).toBe(
    'Over target'
  );
  expect(context.getLocalGoalProgress(budget, data, new Date(2026, 8, 14)).seconds).toBe(0);
});
test('domain goals use exact domains and retained history', () => {
  expect(
    context.getLocalGoalProgress({ ...goal, targetType: 'domain', target: 'sub.work.test' }, data, new Date(2026, 8, 7))
      .seconds
  ).toBe(0);
  expect(context.getLocalGoalProgress(goal, { ...data, dailyDomainData: {} }, new Date(2026, 8, 7)).seconds).toBe(0);
});
test('backup import preserves valid goals and rejects malformed goals', () => {
  expect(sanitizeImportedData({ localGoals: [goal, null, { ...goal, targetSeconds: -10 }] }).localGoals).toEqual([
    goal,
  ]);
  expect(normalizeLocalGoal({ ...goal, period: 'year' })).toBeNull();
});
