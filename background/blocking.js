// --- Main Blocking Handler ---
function handleBlockingRequest(requestDetails) {
  // 1. Initial checks to ignore irrelevant requests (unchanged)
  if (requestDetails.type !== 'main_frame' || !requestDetails.url || requestDetails.method !== 'GET') {
    return {};
  }
  const requestedUrl = requestDetails.url;
  const blockPageBaseUrl = browser.runtime.getURL('blocked/blocked.html');
  if (
    requestedUrl.startsWith('about:') ||
    requestedUrl.startsWith('moz-extension:') ||
    requestedUrl.startsWith('chrome-extension:') ||
    requestedUrl.startsWith(blockPageBaseUrl)
  ) {
    return {};
  }
  const requestedDomain = getDomain(requestedUrl); // from utils.js
  if (!requestedDomain) {
    return {};
  }

  // 2. Use the fast in-memory cache. Time-limit checks are now removed.
  const currentRules = FocusFlowState.activeBlockingRules;
  if ((!currentRules || currentRules.length === 0) && !FocusFlowState.activeFocusProfile) {
    return {};
  }

  // 3. Determine category only if a category block rule exists (optimization)
  let determinedCategory = null;
  if (
    currentRules.some((r) => r.type === 'block-category') ||
    FocusFlowState.activeFocusProfile?.allowedCategories?.length
  ) {
    determinedCategory = getCategoryForDomain(requestedDomain); // This now uses the cache
  }

  const activeProfile = FocusFlowState.activeFocusProfile;
  if (activeProfile && activeProfile.enabled !== false) {
    const profileSchedule = activeProfile.schedule;
    const profileIsActive = !profileSchedule || isScheduleActive(profileSchedule, new Date());
    if (profileIsActive && !isProfileAllowlisted(activeProfile, requestedUrl, determinedCategory)) {
      const blockContext =
        typeof createBlockContext === 'function'
          ? createBlockContext(requestedDomain, 'profile', {
              ruleName: activeProfile.name,
              profileId: activeProfile.id,
            })
          : null;
      if (blockContext && typeof storeBlockContext === 'function') storeBlockContext(blockContext).catch(() => {});
      const params = new URLSearchParams({
        reason: 'profile',
        type: 'focus-profile',
        value: activeProfile.name,
        profileId: activeProfile.id,
        contextId: blockContext?.id || '',
      });
      return { redirectUrl: `${blockPageBaseUrl}?${params.toString()}` };
    }
  }

  const now = new Date();
  const activeRules = currentRules.filter((rule) => {
    if (!rule.schedule && !(rule.startTime || rule.endTime || rule.days)) return true;
    const schedule = rule.schedule || { days: rule.days, startTime: rule.startTime, endTime: rule.endTime };
    return isScheduleActive(schedule, now);
  });
  const evaluation = evaluateRules(activeRules, requestedUrl, { category: determinedCategory });
  if (evaluation.blockingRule) {
    const rule = evaluation.blockingRule;
    const blockContext =
      typeof createBlockContext === 'function'
        ? createBlockContext(requestedDomain, 'rule', {
            ruleId: rule.id,
            ruleType: rule.type,
            ruleName: rule.value,
            category: determinedCategory,
          })
        : null;
    if (blockContext && typeof storeBlockContext === 'function') storeBlockContext(blockContext).catch(() => {});
    console.log(`[Blocking] Block enforced for ${rule.type}='${rule.value}'. Redirecting.`);
    const params = new URLSearchParams({
      reason: 'block',
      type: rule.type,
      value: rule.value || '',
      matchMode: rule.matchMode || 'domain',
      ruleId: rule.id || '',
      contextId: blockContext?.id || '',
      schedule_start: rule.schedule?.startTime || rule.startTime || 'N/A',
      schedule_end: rule.schedule?.endTime || rule.endTime || 'N/A',
      schedule_days: (rule.schedule?.days || rule.days || []).join(',') || 'All',
    });
    return { redirectUrl: `${blockPageBaseUrl}?${params.toString()}` };
  }

  // If no block rule matched, allow the request
  return {};
}
