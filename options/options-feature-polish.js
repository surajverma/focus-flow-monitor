/* Connected options features kept separate from the legacy dashboard renderer. */

const FEATURE_STATUS_IDS = { profile: 'profileStatus', summary: 'weeklySummaryStatus' };
let editingProfileId = null;

function featureStatus(id, message, isError = false) {
  const element = document.getElementById(id);
  if (!element) return;
  element.textContent = message;
  element.classList.toggle('error-message', isError);
}

function formatFeatureSeconds(seconds) {
  const minutes = Math.floor((Number(seconds) || 0) / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

async function loadFeatureData() {
  const data = await browser.storage.local.get([
    'dailyDomainData',
    'dailyCategoryData',
    'categoryProductivityRatings',
    'profiles',
    'activeFocusProfile',
    'trackingExclusions',
    'trackedData',
    'categories',
    'categoryAssignments',
    'lastBackupAt',
    'localGoals',
  ]);
  renderWeeklySummary(data);
  renderProfiles(data.profiles || [], data.activeFocusProfile || null);
  populateProfileCategories(data.categories || ['Other']);
  renderExclusions(data.trackingExclusions || {});
  renderUncategorized(data.dailyDomainData || {}, data.categoryAssignments || {}, data.categories || ['Other']);
  renderBackupStatus(data.lastBackupAt);
  if (typeof renderLocalTools === 'function') renderLocalTools(data);
  const bytes = await browser.storage.local.getBytesInUse(null).catch(() => null);
  const privacySummary = document.getElementById('privacySummary');
  if (privacySummary)
    privacySummary.textContent =
      bytes === null
        ? 'Data is stored locally in Firefox.'
        : `Local storage used: ${Math.round(bytes / 1024)} KB. No data is transmitted.`;
}

async function renderUncategorized(dailyDomainData, assignments, categories) {
  const list = document.getElementById('uncategorizedList');
  const select = document.getElementById('uncategorizedCategorySelect');
  if (!list || !select) return;
  select.replaceChildren();
  categories
    .filter((category) => category !== 'Other')
    .forEach((category) => select.appendChild(new Option(category, category)));
  list.replaceChildren();
  const totals = {};
  Object.values(dailyDomainData || {}).forEach((day) => {
    Object.entries(day || {}).forEach(([domain, seconds]) => {
      totals[domain] = (totals[domain] || 0) + (Number(seconds) || 0);
    });
  });
  const domains = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .map(([domain, seconds]) => ({ domain, formattedTime: formatFeatureSeconds(seconds) }));
  domains.forEach(({ domain, formattedTime }) => {
    const item = document.createElement('li');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.domain = domain;
    checkbox.className = 'uncategorized-checkbox';
    const details = document.createElement('span');
    details.className = 'bulk-domain-details';
    details.textContent = `${resolveCategoryForDomain(domain, assignments, 'Other')} · ${formattedTime}`;
    item.append(checkbox, document.createTextNode(domain), details);
    list.appendChild(item);
  });
  if (!domains.length) list.textContent = 'No uncategorized usage found.';
}

async function testRuleFromForm() {
  const input = document.getElementById('ruleTesterUrl');
  const output = document.getElementById('ruleTesterResult');
  const value = input?.value.trim();
  const candidate = normalizeCandidateUrl(value);
  if (!candidate) {
    if (output) output.textContent = 'Enter a valid domain or HTTP/HTTPS URL.';
    return;
  }
  const data = await browser.storage.local.get(['rules', 'categoryAssignments']);
  const normalizedUrl = candidate.toString();
  const domain = extractAndNormalizeHostname(normalizedUrl);
  const category = resolveCategoryForDomain(domain, data.categoryAssignments || {}, 'Other');
  const activeRules = (data.rules || []).filter((rule) => isRuleActive(rule, new Date()));
  const inactiveRules = (data.rules || []).filter((rule) => !isRuleActive(rule, new Date()));
  const result = evaluateRules(activeRules, normalizedUrl, { category });
  const inactiveMatches = evaluateRules(inactiveRules, normalizedUrl, { category }).matches.length;
  if (!output) return;

  if (result.blocked) {
    const rule = result.blockingRule;
    const type = rule.type === 'block-category' ? 'category block' : 'site block';
    const mode = rule.matchMode ? `, ${rule.matchMode.replaceAll('-', ' ')}` : '';
    output.textContent = `Blocked now · ${domain} · Category: ${category} · Matching ${type}: “${rule.value}”${mode} · ${result.matches.length} active matching rule(s)${inactiveMatches ? ` · ${inactiveMatches} scheduled rule(s) inactive now` : ''}`;
  } else if (result.exception) {
    output.textContent = `Allowed by exception · ${domain} · Category: ${category} · ${result.matches.length} active matching rule(s)`;
  } else {
    output.textContent = `Allowed now · ${domain} · Category: ${category} · ${result.matches.length} active matching rule(s)${inactiveMatches ? ` · ${inactiveMatches} scheduled rule(s) inactive now` : ''}`;
  }
}

function renderWeeklySummary(data) {
  const summary = buildWeeklySummary({
    dailyDomainData: data.dailyDomainData || {},
    dailyCategoryData: data.dailyCategoryData || {},
    productivityRatings: data.categoryProductivityRatings || {},
    trackingExclusions: data.trackingExclusions || {},
    categoryAssignments: data.categoryAssignments || {},
  });
  const metrics = document.getElementById('weeklySummaryMetrics');
  const status = document.getElementById(FEATURE_STATUS_IDS.summary);
  if (!metrics || !status) return;
  if (!summary.totalSeconds) {
    status.textContent = 'No tracked time is available for this week yet.';
    metrics.textContent = '';
  } else {
    status.textContent = `${summary.startDate} to ${summary.endDate} · ${summary.datesTracked} ${summary.datesTracked === 1 ? 'day' : 'days'} tracked`;
    const focusScore = Number(summary.focusScore) || 0;
    const focusScoreChange = Number(summary.focusScoreChange) || 0;
    metrics.replaceChildren();
    const comparison = summary.previousTotalSeconds
      ? `${focusScoreChange >= 0 ? '+' : ''}${focusScoreChange} points vs last week`
      : 'No previous week to compare';
    for (const [label, value, note] of [
      ['Focus score', `${focusScore}%`, comparison],
      [
        'Productive time',
        formatFeatureSeconds(summary.productiveSeconds),
        summary.previousTotalSeconds
          ? `${formatFeatureSeconds(summary.previousProductiveSeconds)} last week`
          : 'Time in productive categories',
      ],
      [
        'Total time',
        formatFeatureSeconds(summary.totalSeconds),
        `${formatFeatureSeconds(summary.neutralSeconds)} neutral · ${formatFeatureSeconds(summary.distractingSeconds)} distracting`,
      ],
      [
        'Best day',
        summary.bestDay
          ? new Date(`${summary.bestDay.date}T12:00:00`).toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })
          : '—',
        summary.bestDay ? `${summary.bestDay.focusScore}% focus score` : 'Browse to begin',
      ],
    ]) {
      const card = document.createElement('div');
      card.className = 'insight-metric';
      const title = document.createElement('span');
      title.textContent = label;
      const number = document.createElement('strong');
      number.textContent = value;
      const caption = document.createElement('small');
      caption.textContent = note;
      card.append(title, number, caption);
      metrics.appendChild(card);
    }
  }
  const comparisonNote = document.getElementById('weeklyComparisonNote');
  if (comparisonNote)
    comparisonNote.textContent =
      'This week so far compared with the full previous Monday–Sunday week. All calculations stay on your device.';
  const categories = document.getElementById('weeklySummaryCategories');
  if (categories) {
    categories.replaceChildren();
    if (!summary.topCategories.length) categories.textContent = 'Your category breakdown will appear as you browse.';
    summary.topCategories.forEach(({ category, seconds, share, rating }) => {
      const item = document.createElement('li');
      const label = document.createElement('div');
      label.className = 'breakdown-label';
      const name = document.createElement('span');
      name.textContent = category;
      const detail = document.createElement('small');
      detail.textContent = `${formatFeatureSeconds(seconds)} · ${share}% · ${rating === 1 ? 'Productive' : rating === -1 ? 'Distracting' : 'Neutral'}`;
      label.append(name, detail);
      const bar = document.createElement('progress');
      bar.max = 100;
      bar.value = share;
      bar.setAttribute('aria-label', `${category}: ${share}% of tracked time`);
      item.append(label, bar);
      categories.appendChild(item);
    });
  }
  const list = document.getElementById('weeklySummaryTopDomains');
  if (!list) return;
  list.replaceChildren();
  if (!summary.topDomains.length) list.textContent = 'No tracked websites this week yet.';
  summary.topDomains.forEach(({ domain, seconds }) => {
    const item = document.createElement('li');
    item.textContent = `${domain}: ${formatFeatureSeconds(seconds)}`;
    list.appendChild(item);
  });
}

function renderProfiles(profiles, activeProfile) {
  const list = document.getElementById('profileList');
  if (!list) return;
  list.replaceChildren();
  profiles.forEach((profile) => {
    const item = document.createElement('li');
    item.className = 'profile-list-item';
    const label = document.createElement('span');
    label.className = 'profile-summary';
    const allowed = [
      ...(profile.allowedDomains || []),
      ...(profile.allowedCategories || []).map((category) => `Category: ${category}`),
    ];
    const days = profile.schedule?.days?.length ? ` · ${profile.schedule.days.join(', ')}` : '';
    label.textContent = `${profile.name} · ${allowed.join(', ')}${days}`;
    const controls = document.createElement('div');
    controls.className = 'profile-controls';
    const startStopButton = document.createElement('button');
    startStopButton.type = 'button';
    startStopButton.className = `action-button ${activeProfile?.id === profile.id ? 'secondary' : 'primary'}`;
    startStopButton.textContent = activeProfile?.id === profile.id ? 'Stop' : 'Start';
    startStopButton.addEventListener('click', async () => {
      if (activeProfile?.id === profile.id) {
        await browser.storage.local.set({ activeFocusProfile: null });
        await browser.runtime.sendMessage({ action: 'profilesUpdated' });
        featureStatus(FEATURE_STATUS_IDS.profile, `${profile.name} stopped.`);
      } else {
        await browser.storage.local.set({ activeFocusProfile: { ...profile, enabled: true } });
        await browser.runtime.sendMessage({ action: 'profilesUpdated' });
        featureStatus(FEATURE_STATUS_IDS.profile, `${profile.name} started.`);
      }
      await loadFeatureData();
    });
    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'edit-btn';
    editButton.textContent = 'Edit';
    editButton.addEventListener('click', () => editProfile(profile));
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'delete-btn';
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', async () => {
      if (!window.confirm(`Delete focus profile “${profile.name}”?`)) return;
      const nextProfiles = profiles.filter((candidate) => candidate.id !== profile.id);
      const updates = { profiles: nextProfiles };
      if (activeProfile?.id === profile.id) updates.activeFocusProfile = null;
      await browser.storage.local.set(updates);
      await browser.runtime.sendMessage({ action: 'profilesUpdated' });
      featureStatus(FEATURE_STATUS_IDS.profile, `${profile.name} deleted.`);
      await loadFeatureData();
    });
    controls.append(startStopButton, editButton, deleteButton);
    item.append(label, controls);
    list.appendChild(item);
  });
}

function editProfile(profile) {
  editingProfileId = profile.id;
  document.getElementById('profileNameInput').value = profile.name || '';
  document.getElementById('profileDomainsInput').value = (profile.allowedDomains || []).join(', ');
  document.getElementById('profileStartTimeInput').value = profile.schedule?.startTime || '';
  document.getElementById('profileEndTimeInput').value = profile.schedule?.endTime || '';
  const selectedCategories = new Set(profile.allowedCategories || []);
  Array.from(document.getElementById('profileCategoriesInput')?.options || []).forEach((option) => {
    option.selected = selectedCategories.has(option.value);
  });
  const selectedDays = new Set(profile.schedule?.days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  document.querySelectorAll('input[name="profileDay"]').forEach((checkbox) => {
    checkbox.checked = selectedDays.has(checkbox.value);
  });
  document.getElementById('saveProfileBtn').textContent = 'Save Changes';
  featureStatus(FEATURE_STATUS_IDS.profile, `Editing ${profile.name}.`);
  document.getElementById('profileNameInput').focus();
}

function renderExclusions(exclusions) {
  const list = document.getElementById('exclusionList');
  if (!list) return;
  list.replaceChildren();
  Object.keys(exclusions)
    .sort()
    .forEach((domain) => {
      const item = document.createElement('li');
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Remove';
      remove.addEventListener('click', async () => {
        const next = { ...exclusions };
        delete next[domain];
        await browser.storage.local.set({ trackingExclusions: next });
        await browser.runtime.sendMessage({ action: 'trackingExclusionsUpdated' });
        if (typeof loadAllData === 'function') await loadAllData();
        if (typeof updateDisplayForSelectedRangeUI === 'function') updateDisplayForSelectedRangeUI(false);
        await loadFeatureData();
      });
      item.append(domain, remove);
      list.appendChild(item);
    });
}

async function saveProfileFromForm() {
  const nameInput = document.getElementById('profileNameInput');
  const domainsInput = document.getElementById('profileDomainsInput');
  const startInput = document.getElementById('profileStartTimeInput');
  const endInput = document.getElementById('profileEndTimeInput');
  const name = nameInput?.value.trim();
  const allowedDomains = (domainsInput?.value || '')
    .split(',')
    .map((value) => normalizeDomain(value.trim()))
    .filter(Boolean);
  const allowedCategories = Array.from(document.getElementById('profileCategoriesInput')?.selectedOptions || []).map(
    (option) => option.value
  );
  if (!name || allowedDomains.length + allowedCategories.length === 0) {
    featureStatus(FEATURE_STATUS_IDS.profile, 'Enter a profile name and allow at least one domain or category.', true);
    return;
  }
  if (Boolean(startInput?.value) !== Boolean(endInput?.value)) {
    featureStatus(FEATURE_STATUS_IDS.profile, 'Enter both schedule times or leave both blank.', true);
    return;
  }
  const days = Array.from(document.querySelectorAll('input[name="profileDay"]:checked')).map(
    (checkbox) => checkbox.value
  );
  if (!days.length) {
    featureStatus(FEATURE_STATUS_IDS.profile, 'Select at least one active day.', true);
    return;
  }
  const profile = {
    id: editingProfileId || `profile_${Date.now()}`,
    name,
    description: '',
    enabled: true,
    allowedDomains,
    allowedCategories,
    schedule: {
      days,
      ...(startInput?.value && endInput?.value ? { startTime: startInput.value, endTime: endInput.value } : {}),
    },
  };
  const result = await browser.storage.local.get(['profiles', 'activeFocusProfile']);
  const profiles = Array.isArray(result.profiles) ? result.profiles : [];
  const nextProfiles = editingProfileId
    ? profiles.map((candidate) => (candidate.id === editingProfileId ? profile : candidate))
    : [...profiles, profile];
  const updates = { profiles: nextProfiles };
  if (result.activeFocusProfile?.id === editingProfileId) updates.activeFocusProfile = { ...profile, enabled: true };
  await browser.storage.local.set(updates);
  await browser.runtime.sendMessage({ action: 'profilesUpdated' });
  nameInput.value = '';
  domainsInput.value = '';
  if (startInput) startInput.value = '';
  if (endInput) endInput.value = '';
  Array.from(document.getElementById('profileCategoriesInput')?.options || []).forEach((option) => {
    option.selected = false;
  });
  document.querySelectorAll('input[name="profileDay"]').forEach((checkbox) => {
    checkbox.checked = true;
  });
  editingProfileId = null;
  document.getElementById('saveProfileBtn').textContent = 'Save Profile';
  featureStatus(FEATURE_STATUS_IDS.profile, `${name} saved.`);
  await loadFeatureData();
}

function populateProfileCategories(categories) {
  const select = document.getElementById('profileCategoriesInput');
  if (!select) return;
  const selected = new Set(Array.from(select.selectedOptions).map((option) => option.value));
  select.replaceChildren();
  categories.forEach((category) => {
    const option = new Option(category, category);
    option.selected = selected.has(category);
    select.appendChild(option);
  });
}

function renderBackupStatus(lastBackupAt) {
  const status = document.getElementById('backupStatus');
  if (!status) return;
  if (!lastBackupAt) {
    status.textContent = 'No local backup export has been recorded yet. A monthly reminder will appear here.';
    return;
  }
  const ageDays = Math.max(0, Math.floor((Date.now() - new Date(lastBackupAt).getTime()) / 86400000));
  status.textContent = `Last backup exported ${ageDays === 0 ? 'today' : `${ageDays} day(s) ago`}.${ageDays >= 30 ? ' Consider exporting a fresh backup.' : ''}`;
}

document.addEventListener('DOMContentLoaded', () => {
  const updatePeriodWording = () => {
    const period = document.getElementById('rulePeriodSelect')?.value || 'day';
    const wording = document.getElementById('rulePeriodWording');
    if (wording) wording.textContent = `per ${period}`;
  };
  document.getElementById('rulePeriodSelect')?.addEventListener('change', updatePeriodWording);
  document.getElementById('ruleTypeSelect')?.addEventListener('change', updatePeriodWording);
  updatePeriodWording();
  document.getElementById('saveProfileBtn')?.addEventListener('click', saveProfileFromForm);
  document.getElementById('addExclusionBtn')?.addEventListener('click', async () => {
    const input = document.getElementById('exclusionDomainInput');
    const domain = normalizeDomain(input?.value.trim());
    if (!domain) return;
    const result = await browser.storage.local.get('trackingExclusions');
    await browser.storage.local.set({ trackingExclusions: { ...(result.trackingExclusions || {}), [domain]: true } });
    await browser.runtime.sendMessage({ action: 'trackingExclusionsUpdated' });
    if (typeof loadAllData === 'function') await loadAllData();
    if (typeof updateDisplayForSelectedRangeUI === 'function') updateDisplayForSelectedRangeUI(false);
    input.value = '';
    await loadFeatureData();
  });
  document.getElementById('testRuleBtn')?.addEventListener('click', () => testRuleFromForm().catch(() => {}));
  document.getElementById('assignUncategorizedBtn')?.addEventListener('click', async () => {
    const domains = Array.from(document.querySelectorAll('.uncategorized-checkbox:checked')).map(
      (checkbox) => checkbox.dataset.domain
    );
    const category = document.getElementById('uncategorizedCategorySelect')?.value;
    const result = await assignDomainsToCategory(domains, category);
    const status = document.getElementById('uncategorizedStatus');
    if (status) status.textContent = result.success ? `Assigned ${result.count} domain(s).` : result.error;
    if (result.success) await loadFeatureData();
  });
  document.getElementById('ruleList')?.addEventListener('change', async (event) => {
    if (!event.target.classList.contains('rule-enabled-toggle')) return;
    const index = Number(event.target.dataset.ruleIndex);
    if (!Number.isInteger(index) || !AppState.rules[index]) return;
    AppState.rules[index] = { ...AppState.rules[index], enabled: event.target.checked };
    await browser.storage.local.set({ rules: AppState.rules });
    await browser.runtime.sendMessage({ action: 'rulesUpdated' });
    featureStatus('weeklySummaryStatus', 'Rule status saved.');
  });
  browser.storage.onChanged?.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes.rules) return;
    AppState.rules = Array.isArray(changes.rules.newValue) ? changes.rules.newValue : [];
    populateRuleList();
  });
  loadFeatureData().catch((error) =>
    featureStatus(FEATURE_STATUS_IDS.summary, `Could not load local insights: ${error.message}`, true)
  );
});
