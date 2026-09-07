const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { planHistoryDeletion } = require('../core/history-deletion');
function runtime(write = jest.fn(async () => {})) {
  const state = {
    trackedData: { 'example.com': 60 },
    dailyDomainData: { '2026-09-07': { 'example.com': 60 } },
    hourlyData: {},
    categoryAssignments: {},
  };
  const context = vm.createContext({
    FocusFlowState: state,
    planHistoryDeletion,
    clearTimeout,
    backgroundStorageManager: { write },
    updateTrackingStateImplementation: jest.fn(async () => {}),
    console,
  });
  const main = fs.readFileSync(path.join(__dirname, '../../background/main.js'), 'utf8');
  vm.runInContext(main.slice(0, main.indexOf('async function updateRuleAndAssignmentCache')), context);
  return { context, state, write };
}
test('preview does not write and queued deletion changes live state before persistence', async () => {
  const { context, state, write } = runtime();
  const preview = await context.queueHistoryOperation({ domain: 'example.com' });
  expect(preview.seconds).toBe(60);
  expect(write).not.toHaveBeenCalled();
  write.mockImplementation(async () => {
    expect(state.trackedData).toEqual({});
  });
  await context.queueHistoryOperation({ domain: 'example.com' }, true);
  expect(state.trackedData).toEqual({});
  expect(write).toHaveBeenCalledTimes(1);
});
test('failed deletion restores live history and queue remains usable', async () => {
  const { context, state, write } = runtime(
    jest.fn(async () => {
      throw new Error('storage unavailable');
    })
  );
  await expect(context.queueHistoryOperation({ domain: 'example.com' }, true)).rejects.toThrow('storage unavailable');
  expect(state.trackedData).toEqual({ 'example.com': 60 });
  write.mockResolvedValue();
  await expect(context.queueHistoryOperation({ domain: 'example.com' }, true)).resolves.toMatchObject({
    success: true,
  });
});
test('waits for active tracking before deleting its newly recorded interval', async () => {
  const { context, state } = runtime();
  let finish;
  context.updateTrackingStateImplementation.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = () => {
          state.trackedData['example.com'] += 5;
          state.dailyDomainData['2026-09-07']['example.com'] += 5;
          resolve();
        };
      })
  );
  const deletion = context.queueHistoryOperation({ domain: 'example.com' }, true);
  expect(state.trackedData['example.com']).toBe(60);
  finish();
  await expect(deletion).resolves.toMatchObject({ seconds: 65 });
  expect(state.trackedData).toEqual({});
});
