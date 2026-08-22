/**
 * Quick actions for the current website
 * Provides shortcuts to create rules, assign categories, etc. from the popup
 */

/**
 * Get quick actions for the current tab
 * @param {Object} tab - Browser tab object
 * @param {Object} state - Current extension state (categories, rules, assignments, etc.)
 * @returns {Array} Available quick actions
 */
function getQuickActionsForTab(tab, state) {
  const actions = [];

  if (!tab || !tab.url) {
    return actions;
  }

  // Skip internal pages
  if (tab.url.startsWith('about:') || tab.url.startsWith('moz-extension:') || tab.url.startsWith('chrome-extension:')) {
    return actions;
  }

  // Try to extract domain
  let domain = null;
  try {
    const urlObj = new URL(tab.url);
    domain = urlObj.hostname;
    if (domain && domain.startsWith('www.')) {
      domain = domain.substring(4);
    }
  } catch (e) {
    return actions;
  }

  if (!domain) return actions;

  // Determine current category
  const currentCategory = state.categoryAssignments[domain] || state.categoryAssignments[`*.${domain}`] || 'Other';

  // Action 1: Assign category (show as primary action)
  actions.push({
    id: 'assign-category',
    label: `Assign Category`,
    description: `Current: ${currentCategory}`,
    icon: 'category',
    data: { domain, currentCategory },
  });

  // Action 2: Block this domain permanently
  actions.push({
    id: 'block-permanent',
    label: 'Block Permanently',
    description: domain,
    icon: 'block',
    data: { domain },
  });

  // Action 3: Block this domain with schedule
  actions.push({
    id: 'block-schedule',
    label: 'Block with Schedule',
    description: domain,
    icon: 'schedule',
    data: { domain },
  });

  // Action 4: Set daily limit
  actions.push({
    id: 'limit-domain',
    label: 'Set Daily Limit',
    description: domain,
    icon: 'timer',
    data: { domain },
  });

  // Action 5: Exclude from tracking
  actions.push({
    id: 'exclude-tracking',
    label: 'Exclude from Tracking',
    description: 'Time on this site will not be recorded',
    icon: 'exclude',
    data: { domain },
  });

  // Action 6: View detailed statistics
  actions.push({
    id: 'view-stats',
    label: 'View Statistics',
    description: domain,
    icon: 'chart',
    data: { domain },
  });

  return actions;
}

/**
 * Execute a quick action
 * @param {string} actionId - The action to execute
 * @param {Object} actionData - Data for the action
 * @returns {Promise} Resolves when action is complete
 */
async function executeQuickAction(actionId, actionData) {
  try {
    switch (actionId) {
      case 'assign-category':
        return showCategoryAssignmentDialog(actionData.domain, actionData.currentCategory);

      case 'block-permanent':
        return createBlockRule(actionData.domain, 'permanent');

      case 'block-schedule':
        return showScheduleBlockDialog(actionData.domain);

      case 'limit-domain':
        return showLimitDialog(actionData.domain);

      case 'exclude-tracking':
        return showExclusionConfirmation(actionData.domain);

      case 'view-stats':
        return openStatisticsPage(actionData.domain);

      default:
        console.warn(`Unknown quick action: ${actionId}`);
        return null;
    }
  } catch (error) {
    console.error(`Error executing quick action ${actionId}:`, error);
    throw error;
  }
}

/**
 * Show category assignment dialog
 * @param {string} domain - Domain to assign
 * @param {string} currentCategory - Current category
 * @returns {Promise<string>} Selected category or null
 */
async function showCategoryAssignmentDialog(domain, currentCategory) {
  await browser.runtime.openOptionsPage();
  return { success: true, domain, currentCategory };
}

/**
 * Create a permanent block rule
 * @param {string} domain - Domain to block
 * @param {string} type - 'permanent' or 'scheduled'
 * @returns {Promise} Resolves when rule is created
 */
async function createBlockRule(domain, type) {
  try {
    // Get current rules
    const result = await browser.storage.local.get(['rules']);
    const rules = result.rules || [];

    // Create new rule
    const newRule = {
      id: `rule_${Date.now()}`,
      type: 'block-domain',
      value: domain,
      enabled: true,
      exceptions: [],
    };
    if (type === 'scheduled') {
      newRule.schedule = {
        enabled: true,
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        startTime: '22:00',
        endTime: '06:00',
      };
    }

    // Add to rules
    rules.push(newRule);

    // Save rules
    await browser.storage.local.set({ rules });

    // Notify background to update cache
    if (browser.runtime && browser.runtime.sendMessage) {
      browser.runtime.sendMessage({ action: 'updateRuleCache' }).catch(() => {
        // Ignore if background not ready
      });
    }

    return { success: true, ruleId: newRule.id };
  } catch (error) {
    console.error('Error creating block rule:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Show schedule block dialog
 * @param {string} domain - Domain to block
 * @returns {Promise} Resolves when dialog is closed
 */
async function showScheduleBlockDialog(domain) {
  return createBlockRule(domain, 'scheduled');
}

/**
 * Show limit dialog
 * @param {string} domain - Domain to limit
 * @returns {Promise} Resolves when dialog is closed
 */
async function showLimitDialog(domain) {
  const result = await browser.storage.local.get(['rules']);
  const rules = result.rules || [];
  const newRule = {
    id: `rule_${Date.now()}`,
    type: 'limit-url',
    value: domain,
    matchMode: 'domain',
    period: 'day',
    limitSeconds: 30 * 60,
    enabled: true,
    exceptions: [],
  };
  await browser.storage.local.set({ rules: [...rules, newRule] });
  browser.runtime.sendMessage({ action: 'updateRuleCache' }).catch(() => {});
  return { success: true, ruleId: newRule.id };
}

/**
 * Show exclusion confirmation
 * @param {string} domain - Domain to exclude
 * @returns {Promise<boolean>} True if confirmed
 */
async function showExclusionConfirmation(domain) {
  return { success: false, domain, error: 'Use the explicit confirmation control in the popup.' };
}

/**
 * Open statistics page for a domain
 * @param {string} domain - Domain to show stats for
 * @returns {Promise} Resolves when page is opened
 */
async function openStatisticsPage(domain) {
  try {
    // Open options page with statistics view
    browser.runtime.openOptionsPage();
    return { success: true };
  } catch (error) {
    console.error('Error opening statistics page:', error);
    return { success: false, error: error.message };
  }
}

// Exports for browser and tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getQuickActionsForTab,
    executeQuickAction,
    createBlockRule,
  };
}
