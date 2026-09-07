function recordTime(domain, seconds, timestamp = Date.now()) {
  if (!domain || seconds <= 0) {
    return;
  }
  if (Object.hasOwn(FocusFlowState.trackingExclusions || {}, domain)) {
    return;
  }
  const startTimestamp = timestamp - seconds * 1000;
  const hourlyIntervals = splitIntervalByHour(startTimestamp, timestamp);

  try {
    FocusFlowState.trackedData[domain] = (FocusFlowState.trackedData[domain] || 0) + seconds;
    const category = getCategoryForDomain(domain); // From utils.js
    FocusFlowState.categoryTimeData[category] = (FocusFlowState.categoryTimeData[category] || 0) + seconds;

    hourlyIntervals.forEach(({ date, hour, seconds: intervalSeconds }) => {
      if (!FocusFlowState.dailyDomainData[date]) FocusFlowState.dailyDomainData[date] = {};
      if (!FocusFlowState.dailyCategoryData[date]) FocusFlowState.dailyCategoryData[date] = {};
      if (!FocusFlowState.hourlyData[date]) FocusFlowState.hourlyData[date] = {};
      FocusFlowState.dailyDomainData[date][domain] =
        (FocusFlowState.dailyDomainData[date][domain] || 0) + intervalSeconds;
      FocusFlowState.hourlyData[date][hour] = (FocusFlowState.hourlyData[date][hour] || 0) + intervalSeconds;
      FocusFlowState.dailyCategoryData[date][category] =
        (FocusFlowState.dailyCategoryData[date][category] || 0) + intervalSeconds;
    });

    saveDataBatched(); // from storage.js
  } catch (error) {
    console.error(`[Tracking RecordTime] Error modifying state for domain ${domain}:`, error);
  }
}

// --- Core Time Tracking Logic ---
async function updateTrackingStateImplementation(triggerContext = 'unknown') {
  const now = Date.now();

  let currentDomain = null;
  let isActive = false;
  let finalDomainToRecord = null;
  let previousState = null;

  try {
    // 1. Get Idle Threshold
    let thresholdSeconds = FocusFlowState.DEFAULT_IDLE_SECONDS;
    try {
      const settings = await browser.storage.local.get(FocusFlowState.STORAGE_KEY_IDLE_THRESHOLD);
      thresholdSeconds =
        settings[FocusFlowState.STORAGE_KEY_IDLE_THRESHOLD] !== undefined &&
        settings[FocusFlowState.STORAGE_KEY_IDLE_THRESHOLD] !== null
          ? parseInt(settings[FocusFlowState.STORAGE_KEY_IDLE_THRESHOLD], 10)
          : FocusFlowState.DEFAULT_IDLE_SECONDS;
      if (isNaN(thresholdSeconds)) thresholdSeconds = FocusFlowState.DEFAULT_IDLE_SECONDS;
    } catch (err) {
      console.error('[Tracking] Error fetching idle setting, using default:', err);
      thresholdSeconds = FocusFlowState.DEFAULT_IDLE_SECONDS;
    }

    // 2. Check Idle State
    let idleState = 'active';
    if (thresholdSeconds !== -1 && thresholdSeconds >= 1) {
      try {
        idleState = await browser.idle.queryState(thresholdSeconds);
      } catch (idleError) {
        console.warn('[Tracking] Error querying idle state:', idleError);
        idleState = 'active';
      }
    }

    // 3. Check Window Focus & Active Tab
    let activeTab = null;
    let focusedWindow = null;
    try {
      focusedWindow = await browser.windows.getLastFocused({ populate: true, windowTypes: ['normal'] });
      if (focusedWindow && focusedWindow.focused) {
        activeTab = focusedWindow.tabs.find((t) => t.active);
      }
    } catch (browserApiError) {
      console.warn(
        '[Tracking Check] Could not get focused window/tab (may be normal). Error:',
        browserApiError?.message
      );
    }

    // 4. Determine Activity Status & Current Domain
    if (idleState === 'active' && focusedWindow?.focused && activeTab) {
      const domain = getDomain(activeTab.url); // utils.js
      if (domain) {
        isActive = true;
        currentDomain = domain;
      } else {
        isActive = false;
      }
    } else {
      isActive = false;
    }

    // 5. Get Previous Tracking State
    try {
      const storageResult = await browser.storage.local.get(FocusFlowState.STORAGE_KEY_TRACKING_STATE);
      previousState = storageResult[FocusFlowState.STORAGE_KEY_TRACKING_STATE] || null;
    } catch (storageError) {
      console.error('[Tracking] Error getting previous tracking state:', storageError);
      previousState = null;
    }

    // 6. Process State Change / Update Time
    let elapsedSeconds = 0;
    if (previousState) {
      elapsedSeconds = Math.floor((now - previousState.timestamp) / 1000);
      finalDomainToRecord = previousState.domain;
    }

    // --- State Machine Logic ---
    if (elapsedSeconds < 0 || elapsedSeconds > 24 * 60 * 60) {
      elapsedSeconds = 0;
    }

    if (isActive) {
      // ACTIVE NOW
      const newState = { timestamp: now, domain: currentDomain };
      if (previousState) {
        // PREVIOUSLY ACTIVE
        if (finalDomainToRecord && elapsedSeconds > 0) {
          recordTime(finalDomainToRecord, elapsedSeconds);
          await checkTimeLimitsAndRedirectIfNeeded();
        }
        try {
          await browser.storage.local.set({ [FocusFlowState.STORAGE_KEY_TRACKING_STATE]: newState });
        } catch (storageError) {
          console.error('[Tracking] Error updating storage state (active -> active):', storageError);
        }
      } else {
        // PREVIOUSLY INACTIVE -> START TRACKING
        console.log(`[Tracking Logic] Was inactive, now ACTIVE. Storing new state:`, newState);
        try {
          await browser.storage.local.set({ [FocusFlowState.STORAGE_KEY_TRACKING_STATE]: newState });
        } catch (storageError) {
          console.error('[Tracking] Error storing initial active state:', storageError);
        }
      }
    } else {
      // INACTIVE NOW
      if (previousState) {
        // PREVIOUSLY ACTIVE -> STOP TRACKING
        if (finalDomainToRecord && elapsedSeconds > 0) {
          recordTime(finalDomainToRecord, elapsedSeconds);
          await checkTimeLimitsAndRedirectIfNeeded();
        }
        try {
          await browser.storage.local.remove(FocusFlowState.STORAGE_KEY_TRACKING_STATE);
          console.log(`[Tracking Logic] Removed stored tracking state.`);
        } catch (storageError) {
          console.error('[Tracking] Error removing stored state (active -> inactive):', storageError);
        }
      }
      // else: PREVIOUSLY INACTIVE -> STILL INACTIVE (do nothing)
    }
  } catch (error) {
    console.error(
      `[Tracking] CRITICAL Error in updateTrackingStateImplementation (Trigger: ${triggerContext}):`,
      error
    );
    try {
      if (previousState) {
        await browser.storage.local.remove(FocusFlowState.STORAGE_KEY_TRACKING_STATE);
        console.error('[Tracking] Cleared potentially corrupted tracking state due to error.');
      }
    } catch (clearError) {
      console.error('[Tracking] Failed to clear tracking state during error handling:', clearError);
    }
  }
}

const updateTrackingStateDebounced = debounce(
  (context) => updateTrackingStateImplementation(context),
  FocusFlowState.UPDATE_STATE_DEBOUNCE_MS
);

// This function checks if the currently active tab should be blocked due to a time limit.
async function checkTimeLimitsAndRedirectIfNeeded() {
  const { rules, dailyDomainData, trackingExclusions } = FocusFlowState;
  if (!rules || rules.length === 0) return; // No rules to check

  const now = new Date();
  const limitRules = rules.filter((rule) => rule?.type?.startsWith('limit-') && isRuleActive(rule, now));
  if (limitRules.length === 0) return; // No limit rules to check

  let activeTab;
  try {
    const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab || !tab.url) return;
    activeTab = tab;
  } catch (e) {
    // This can happen if no window is focused, which is fine.
    return;
  }

  const domain = getDomain(activeTab.url);
  if (!domain) return;
  if (Object.hasOwn(trackingExclusions || {}, domain)) return;

  const category = getCategoryForDomain(domain);

  const isExcludedDomain = (trackedDomain) => Object.hasOwn(trackingExclusions || {}, trackedDomain);
  const getDatesForRule = (rule) => {
    const period = rule.period || 'day';
    const start = startOfPeriod(now, period);
    const end = getPeriodEnd(now, period);
    return getDateKeysBetween(start, end, dailyDomainData);
  };
  const sumTrackedDomains = (rule, predicate) =>
    getDatesForRule(rule).reduce(
      (total, date) =>
        total +
        Object.entries(dailyDomainData[date] || {}).reduce(
          (dayTotal, [trackedDomain, trackedSeconds]) =>
            dayTotal + (!isExcludedDomain(trackedDomain) && predicate(trackedDomain) ? Number(trackedSeconds) || 0 : 0),
          0
        ),
      0
    );

  for (const rule of limitRules) {
    if (ruleHasMatchingException(rule, activeTab.url)) continue;
    let timeSpentToday = 0;
    let ruleMatches = false;

    if ((rule.type === 'limit-url' || rule.type === 'limit-domain') && ruleMatchesUrl(rule, activeTab.url)) {
      const mode = getRuleMatchMode(rule);
      if (!['domain', 'domain-subdomains'].includes(mode)) continue;
      const targetDomain = normalizeRuleTarget(rule.value, mode);
      timeSpentToday = sumTrackedDomains(rule, (trackedDomain) =>
        domainPatternMatches(trackedDomain, targetDomain, mode === 'domain-subdomains')
      );
      ruleMatches = true;
    } else if (rule.type === 'limit-category' && category === rule.value) {
      timeSpentToday = sumTrackedDomains(rule, (trackedDomain) => getCategoryForDomain(trackedDomain) === rule.value);
      ruleMatches = true;
    }

    if (ruleMatches && timeSpentToday >= rule.limitSeconds) {
      console.log(`[Async Limit Check] Limit reached for ${domain}. Redirecting tab.`);
      const blockPageBaseUrl = browser.runtime.getURL('blocked/blocked.html');
      const params = new URLSearchParams({
        reason: 'limit',
        type: rule.type,
        value: rule.value,
        limit: rule.limitSeconds.toString(),
        spent: timeSpentToday.toString(),
      });
      const blockContext =
        typeof createBlockContext === 'function'
          ? createBlockContext(activeTab.url, 'limit', {
              ruleId: rule.id,
              ruleType: rule.type,
              limitType: rule.period || 'day',
              limitSeconds: rule.limitSeconds,
              usedSeconds: timeSpentToday,
              nextAvailable: getPeriodEnd(now, rule.period || 'day').getTime(),
            })
          : null;
      if (blockContext && typeof storeBlockContext === 'function') {
        params.set('contextId', blockContext.id);
        await storeBlockContext(blockContext).catch(() => {});
      }
      try {
        // Prevent redirection loop if already on the block page
        if (!activeTab.url.startsWith(blockPageBaseUrl)) {
          await browser.tabs.update(activeTab.id, { url: `${blockPageBaseUrl}?${params.toString()}` });
        }
      } catch (e) {
        console.error('Failed to redirect tab for time limit:', e);
      }
      return; // Stop checking after the first active limit is found and actioned
    }
  }
}
