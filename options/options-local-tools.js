/* Local goal management and deliberate, preview-first browsing-history deletion. */
let localToolsData = {};
let editingLocalGoalId = null;
let pendingHistorySelection = null;

function localElement(id) {
  return document.getElementById(id);
}
function localStatus(id, message, error = false) {
  const element = localElement(id);
  element.textContent = message;
  element.classList.toggle('error-message', error);
}
function fillLocalSelect(id, values, placeholder) {
  const select = localElement(id);
  const current = select.value;
  select.replaceChildren();
  if (placeholder) select.appendChild(new Option(placeholder, ''));
  values.forEach((value) => select.appendChild(new Option(value, value)));
  if (values.includes(current)) select.value = current;
}
function renderLocalTools(data) {
  localToolsData = data;
  fillLocalSelect(
    'historyDomain',
    [
      ...new Set([
        ...Object.keys(data.trackedData || {}),
        ...Object.values(data.dailyDomainData || {}).flatMap((day) => Object.keys(day)),
      ]),
    ].sort(),
    'All websites'
  );
  fillLocalSelect('goalCategory', data.categories || ['Other']);
  const list = localElement('localGoalsList');
  list.replaceChildren();
  const goals = (Array.isArray(data.localGoals) ? data.localGoals : []).map(normalizeLocalGoal).filter(Boolean);
  if (!goals.length) {
    const empty = document.createElement('div');
    empty.className = 'feature-empty';
    const title = document.createElement('strong');
    title.textContent = 'A little intention goes a long way.';
    const text = document.createElement('p');
    text.textContent = 'Try 30 productive minutes a day, or keep a distracting category under your own weekly target.';
    empty.append(title, text);
    list.appendChild(empty);
  }
  goals.forEach((goal) => {
    const progress = getLocalGoalProgress(goal, data);
    const card = document.createElement('article');
    card.className = 'goal-card';
    const heading = document.createElement('h3');
    heading.textContent = goal.name;
    const target = document.createElement('p');
    target.className = 'goal-target';
    target.textContent = `${goal.direction === 'at-least' ? 'At least' : 'At most'} ${formatFeatureSeconds(goal.targetSeconds)} / ${goal.period} · ${goal.targetType === 'productive' ? 'Productive time' : goal.target}`;
    const value = document.createElement('strong');
    value.className = 'goal-value';
    value.textContent = formatFeatureSeconds(progress.seconds);
    const state = document.createElement('span');
    state.className = 'goal-state';
    state.textContent = progress.status;
    const bar = document.createElement('progress');
    bar.max = goal.targetSeconds;
    bar.value = Math.min(progress.seconds, goal.targetSeconds);
    bar.setAttribute(
      'aria-label',
      `${goal.name}: ${formatFeatureSeconds(progress.seconds)} of ${formatFeatureSeconds(goal.targetSeconds)}`
    );
    const remaining = document.createElement('p');
    remaining.className = 'setting-description';
    remaining.textContent = `${progress.seconds > goal.targetSeconds && goal.direction === 'at-most' ? `${formatFeatureSeconds(progress.seconds - goal.targetSeconds)} above your target` : `${formatFeatureSeconds(progress.remainingSeconds)} ${goal.direction === 'at-most' ? 'remaining in your budget' : 'to your target'}`} · Resets ${new Date(progress.resetsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    const actions = document.createElement('div');
    actions.className = 'feature-actions';
    const edit = document.createElement('button');
    edit.className = 'action-button secondary';
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => openLocalGoal(goal));
    const remove = document.createElement('button');
    remove.className = 'action-button secondary';
    remove.textContent = 'Remove';
    remove.addEventListener('click', async () => {
      if (!window.confirm(`Remove the goal “${goal.name}”? Your browsing history will be kept.`)) return;
      remove.disabled = true;
      try {
        const stored = await browser.storage.local.get('localGoals');
        await browser.storage.local.set({
          localGoals: (stored.localGoals || []).filter((item) => item.id !== goal.id),
        });
        if (editingLocalGoalId === goal.id) localElement('localGoalForm').hidden = true;
        await loadFeatureData();
        localStatus('goalStatus', 'Goal removed.');
      } catch (error) {
        localStatus('goalStatus', error.message, true);
      } finally {
        remove.disabled = false;
      }
    });
    actions.append(edit, remove);
    card.append(heading, target, value, state, bar, remaining, actions);
    list.appendChild(card);
  });
}
function updateLocalGoalFields() {
  localElement('goalMinutes').max = localElement('goalPeriod').value === 'day' ? 1440 : 10080;
  localElement('goalCategoryField').hidden = localElement('goalType').value !== 'category';
  localElement('goalDomainField').hidden = localElement('goalType').value !== 'domain';
}
function openLocalGoal(goal = null) {
  editingLocalGoalId = goal?.id || null;
  localElement('localGoalForm').reset();
  localElement('goalEditorTitle').textContent = goal ? 'Edit your goal' : 'Create a goal';
  localElement('goalName').value = goal?.name || '';
  localElement('goalType').value = goal?.targetType || 'productive';
  localElement('goalDirection').value = goal?.direction || 'at-least';
  localElement('goalMinutes').value = goal ? goal.targetSeconds / 60 : 30;
  localElement('goalPeriod').value = goal?.period || 'day';
  if (goal?.targetType === 'category') {
    if (!(localToolsData.categories || []).includes(goal.target))
      localElement('goalCategory').appendChild(new Option(goal.target, goal.target));
    localElement('goalCategory').value = goal.target;
  }
  localElement('goalDomain').value = goal?.targetType === 'domain' ? goal.target : '';
  updateLocalGoalFields();
  localElement('localGoalForm').hidden = false;
  localElement('goalName').focus();
}
async function saveLocalGoal(event) {
  event.preventDefault();
  const targetType = localElement('goalType').value;
  const rawDomain = localElement('goalDomain').value.trim();
  if (targetType === 'domain' && (!isValidDomainPattern(rawDomain) || /[/*?#:]/.test(rawDomain))) {
    localStatus('goalStatus', 'Enter a website domain without a path or wildcard.', true);
    return;
  }
  const goal = normalizeLocalGoal({
    id: editingLocalGoalId || `goal_${crypto.randomUUID()}`,
    name: localElement('goalName').value,
    targetType,
    target: targetType === 'domain' ? normalizeDomain(rawDomain) : localElement('goalCategory').value,
    direction: localElement('goalDirection').value,
    period: localElement('goalPeriod').value,
    targetSeconds: Number(localElement('goalMinutes').value) * 60,
  });
  if (!goal) {
    localStatus(
      'goalStatus',
      'Enter a name and a target of 1–1,440 minutes per day or 1–10,080 minutes per week.',
      true
    );
    return;
  }
  const button = event.submitter || localElement('localGoalForm').querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const stored = await browser.storage.local.get('localGoals');
    const goals = (Array.isArray(stored.localGoals) ? stored.localGoals : []).filter((item) => item.id !== goal.id);
    goals.push(goal);
    await browser.storage.local.set({ localGoals: goals });
    localElement('localGoalForm').hidden = true;
    await loadFeatureData();
    localStatus('goalStatus', 'Goal saved on this device.');
  } catch (error) {
    localStatus('goalStatus', error.message, true);
  } finally {
    button.disabled = false;
  }
}
function invalidateHistoryPreview() {
  pendingHistorySelection = null;
  localElement('historyPreview').hidden = true;
}
async function previewLocalHistory() {
  invalidateHistoryPreview();
  const selection = {
    domain: localElement('historyDomain').value,
    from: localElement('historyFrom').value,
    to: localElement('historyTo').value,
  };
  const button = localElement('previewHistoryBtn');
  button.disabled = true;
  try {
    const result = await browser.runtime.sendMessage({ action: 'previewHistoryDeletion', selection });
    if (!result?.success) throw new Error(result?.error || 'Could not preview history. Please reload the extension.');
    if (!result.siteCount && !result.hourlyDayCount) {
      localStatus('historyStatus', 'No saved history matches this selection.');
      return;
    }
    // Do not show a stale preview if the user changes a field while waiting.
    if (
      selection.domain !== localElement('historyDomain').value ||
      selection.from !== localElement('historyFrom').value ||
      selection.to !== localElement('historyTo').value
    )
      return;
    pendingHistorySelection = selection;
    localElement('historyPreviewText').textContent =
      `Currently ${formatFeatureSeconds(result.seconds)} across ${result.siteCount} website(s) and ${result.dayCount} retained day(s). Scope: ${selection.domain || 'all websites'} · ${selection.from ? `${selection.from} through ${selection.to}` : 'all saved dates'}.`;
    localElement('historyHourlyNote').textContent = result.hourlyDayCount
      ? `${result.hourlyDayCount} daily hourly chart(s) will also be cleared.${selection.domain ? ' Older hourly charts combine all websites, so they cannot be separated by site. Other websites’ daily totals are kept.' : ''}`
      : 'No hourly charts are affected.';
    localElement('historyPreview').hidden = false;
    localStatus('historyStatus', 'Review the scope before deleting. Time accrued before confirmation is included.');
  } catch (error) {
    localStatus('historyStatus', error.message, true);
  } finally {
    button.disabled = false;
  }
}
async function deleteLocalHistory() {
  if (!pendingHistorySelection) return;
  const selection = pendingHistorySelection;
  pendingHistorySelection = null;
  const button = localElement('confirmHistoryBtn');
  button.disabled = true;
  try {
    const result = await browser.runtime.sendMessage({ action: 'deleteSelectedHistory', selection });
    if (!result?.success) throw new Error(result?.error || 'Could not delete history.');
    invalidateHistoryPreview();
    await loadAllData();
    await loadFeatureData();
    localStatus(
      'historyStatus',
      `Deleted ${formatFeatureSeconds(result.seconds)} of saved browsing time. Future browsing will still be tracked unless excluded.`
    );
  } catch (error) {
    invalidateHistoryPreview();
    localStatus('historyStatus', error.message, true);
  } finally {
    button.disabled = false;
  }
}
document.addEventListener('DOMContentLoaded', () => {
  localElement('newGoalBtn').addEventListener('click', () => openLocalGoal());
  localElement('cancelGoalBtn').addEventListener('click', () => {
    localElement('localGoalForm').hidden = true;
  });
  localElement('goalType').addEventListener('change', updateLocalGoalFields);
  localElement('goalPeriod').addEventListener('change', updateLocalGoalFields);
  localElement('localGoalForm').addEventListener('submit', saveLocalGoal);
  localElement('previewHistoryBtn').addEventListener('click', previewLocalHistory);
  localElement('confirmHistoryBtn').addEventListener('click', deleteLocalHistory);
  localElement('cancelHistoryBtn').addEventListener('click', invalidateHistoryPreview);
  ['historyDomain', 'historyFrom', 'historyTo'].forEach((id) =>
    localElement(id).addEventListener('input', invalidateHistoryPreview)
  );
  let refreshTimer;
  browser.storage.onChanged?.addListener((changes, area) => {
    if (
      area !== 'local' ||
      !['dailyDomainData', 'localGoals', 'categoryProductivityRatings'].some((key) => changes[key])
    )
      return;
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(
      () => loadFeatureData().catch((error) => localStatus('goalStatus', error.message, true)),
      300
    );
  });
});
