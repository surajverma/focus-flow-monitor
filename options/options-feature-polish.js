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

function migrateLegacyProfileSchedule(profile) {
  const legacyDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const days = profile?.schedule?.days;
  if (!Array.isArray(days) || days.length !== legacyDays.length || !legacyDays.every((day) => days.includes(day))) {
    return profile;
  }
  return {
    ...profile,
    schedule: { ...profile.schedule, days: [...legacyDays, 'Sat', 'Sun'] },
  };
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
  ]);
  const profiles = Array.isArray(data.profiles) ? data.profiles : [];
  const migratedProfiles = profiles.map(migrateLegacyProfileSchedule);
  const scheduleMigrated = migratedProfiles.some((profile, index) => profile !== profiles[index]);
  if (scheduleMigrated) {
    const activeProfile = data.activeFocusProfile
      ? migratedProfiles.find((profile) => profile.id === data.activeFocusProfile.id) ||
        migrateLegacyProfileSchedule(data.activeFocusProfile)
      : null;
    await browser.storage.local.set({ profiles: migratedProfiles, activeFocusProfile: activeProfile });
    await browser.runtime.sendMessage({ action: 'profilesUpdated' });
    data.profiles = migratedProfiles;
    data.activeFocusProfile = activeProfile;
  }
  renderWeeklySummary(data);
  renderProfiles(data.profiles || [], data.activeFocusProfile || null);
  renderExclusions(data.trackingExclusions || {});
  renderUncategorized(data.dailyDomainData || {}, data.categoryAssignments || {}, data.categories || ['Other']);
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
  const domains = await getUncategorizedDomains(dailyDomainData, assignments);
  domains.slice(0, 100).forEach(({ domain, formattedTime }) => {
    const item = document.createElement('li');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.domain = domain;
    checkbox.className = 'uncategorized-checkbox';
    item.append(checkbox, document.createTextNode(`${domain} · ${formattedTime}`));
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
  const result = evaluateRules(data.rules || [], normalizedUrl, { category });
  if (!output) return;

  if (result.blocked) {
    const rule = result.blockingRule;
    const type = rule.type === 'block-category' ? 'category block' : 'site block';
    const mode = rule.matchMode ? `, ${rule.matchMode.replaceAll('-', ' ')}` : '';
    output.textContent = `Blocked · ${domain} · Category: ${category} · Matching ${type}: “${rule.value}”${mode} · ${result.matches.length} matching rule(s)`;
  } else if (result.exception) {
    output.textContent = `Allowed by exception · ${domain} · Category: ${category} · ${result.matches.length} matching rule(s)`;
  } else {
    output.textContent = `Allowed · ${domain} · Category: ${category} · ${result.matches.length} matching rule(s)`;
  }
}

function renderWeeklySummary(data) {
  const summary = buildWeeklySummary({
    dailyDomainData: data.dailyDomainData || {},
    dailyCategoryData: data.dailyCategoryData || {},
    productivityRatings: data.categoryProductivityRatings || {},
  });
  const metrics = document.getElementById('weeklySummaryMetrics');
  const status = document.getElementById(FEATURE_STATUS_IDS.summary);
  if (!metrics || !status) return;
  if (!summary.totalSeconds) {
    status.textContent = 'No completed week data is available yet.';
    metrics.textContent = '';
  } else {
    status.textContent = `${summary.startDate} to ${summary.endDate} · ${summary.datesTracked} days tracked`;
    const focusScore = Number(summary.focusScore) || 0;
    const focusScoreChange = Number(summary.focusScoreChange) || 0;
    metrics.textContent = `Total ${formatFeatureSeconds(summary.totalSeconds)} · Focus score ${focusScore}% (${focusScoreChange >= 0 ? '+' : ''}${focusScoreChange} points) · Best day ${summary.bestDay?.date || 'Not available'}`;
  }
  const list = document.getElementById('weeklySummaryTopDomains');
  if (!list) return;
  list.replaceChildren();
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
    label.textContent = `${profile.name} · ${(profile.allowedDomains || []).join(', ')}`;
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
  if (!name || allowedDomains.length === 0) {
    featureStatus(FEATURE_STATUS_IDS.profile, 'Enter a profile name and at least one allowed domain.', true);
    return;
  }
  if (Boolean(startInput?.value) !== Boolean(endInput?.value)) {
    featureStatus(FEATURE_STATUS_IDS.profile, 'Enter both schedule times or leave both blank.', true);
    return;
  }
  const profile = {
    id: editingProfileId || `profile_${Date.now()}`,
    name,
    description: '',
    enabled: true,
    allowedDomains,
    allowedCategories: [],
    schedule:
      startInput?.value && endInput?.value
        ? {
            days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            startTime: startInput.value,
            endTime: endInput.value,
          }
        : null,
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
  editingProfileId = null;
  document.getElementById('saveProfileBtn').textContent = 'Save Profile';
  featureStatus(FEATURE_STATUS_IDS.profile, `${name} saved.`);
  await loadFeatureData();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('saveProfileBtn')?.addEventListener('click', saveProfileFromForm);
  document.getElementById('addExclusionBtn')?.addEventListener('click', async () => {
    const input = document.getElementById('exclusionDomainInput');
    const domain = normalizeDomain(input?.value.trim());
    if (!domain) return;
    const result = await browser.storage.local.get('trackingExclusions');
    await browser.storage.local.set({ trackingExclusions: { ...(result.trackingExclusions || {}), [domain]: true } });
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
