/**
 * Block context for the blocked page
 * Stores minimal context about why a page is blocked
 */

const BLOCK_CONTEXT_STORAGE_KEY = 'blockContext';
const CONTEXT_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Create a block context object
 * @param {string} blockedUrl - The blocked URL
 * @param {string} reason - Reason for blocking
 * @param {Object} details - Additional details
 * @returns {Object} Block context object
 */
function createBlockContext(blockedUrl, reason, details) {
  return {
    id: generateContextId(),
    url: blockedUrl,
    reason, // 'rule', 'limit', 'schedule', 'profile', 'pomodoro'
    details: {
      ruleName: details?.ruleName || null,
      ruleType: details?.ruleType || null,
      limitType: details?.limitType || null,
      limitSeconds: details?.limitSeconds || null,
      usedSeconds: details?.usedSeconds || null,
      scheduleDescription: details?.scheduleDescription || null,
      nextAvailable: details?.nextAvailable || null,
      resetTime: details?.resetTime || null,
      category: details?.category || null,
      ...details,
    },
    timestamp: Date.now(),
    expiresAt: Date.now() + CONTEXT_EXPIRY_MS,
  };
}

/**
 * Generate a unique context ID
 * @returns {string} Context ID
 */
function generateContextId() {
  return `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Store a block context
 * @param {Object} context - Block context object
 * @returns {Promise} Resolves when stored
 */
async function storeBlockContext(context) {
  try {
    const contexts = await getBlockContexts();

    // Remove expired contexts
    const validContexts = contexts.filter((c) => c.expiresAt > Date.now());

    // Add new context
    validContexts.push(context);

    // Keep only recent contexts (max 20)
    if (validContexts.length > 20) {
      validContexts.shift();
    }

    await browser.storage.local.set({
      [BLOCK_CONTEXT_STORAGE_KEY]: validContexts,
    });

    return context.id;
  } catch (error) {
    console.error('Error storing block context:', error);
    throw error;
  }
}

/**
 * Get all block contexts
 * @returns {Promise<Array>} Array of block contexts
 */
async function getBlockContexts() {
  try {
    const result = await browser.storage.local.get(BLOCK_CONTEXT_STORAGE_KEY);
    return result[BLOCK_CONTEXT_STORAGE_KEY] || [];
  } catch (error) {
    console.error('Error getting block contexts:', error);
    return [];
  }
}

/**
 * Get a specific block context by ID
 * @param {string} contextId - Context ID
 * @returns {Promise<Object|null>} Block context or null if not found/expired
 */
async function getBlockContext(contextId) {
  try {
    const contexts = await getBlockContexts();
    const context = contexts.find((c) => c.id === contextId);

    // Check if expired
    if (context && context.expiresAt < Date.now()) {
      return null;
    }

    return context || null;
  } catch (error) {
    console.error('Error getting block context:', error);
    return null;
  }
}

/**
 * Clear expired contexts
 * @returns {Promise} Resolves when cleared
 */
async function clearExpiredContexts() {
  try {
    const contexts = await getBlockContexts();
    const validContexts = contexts.filter((c) => c.expiresAt > Date.now());

    await browser.storage.local.set({
      [BLOCK_CONTEXT_STORAGE_KEY]: validContexts,
    });
  } catch (error) {
    console.error('Error clearing expired contexts:', error);
  }
}

/**
 * Format block reason for display
 * @param {Object} context - Block context
 * @returns {string} Human-readable reason
 */
function formatBlockReason(context) {
  if (!context) return 'Access blocked';

  const { reason, details } = context;

  switch (reason) {
    case 'rule':
      if (details.ruleName) {
        return `Blocked by rule: ${details.ruleName}`;
      }
      return `Blocked by rule`;

    case 'limit':
      return `Daily limit reached (${formatSeconds(details.usedSeconds)} of ${formatSeconds(details.limitSeconds)} used)`;

    case 'schedule':
      return `Blocked by schedule${details.scheduleDescription ? `: ${details.scheduleDescription}` : ''}`;

    case 'profile':
      return 'Blocked by active focus profile';

    case 'pomodoro':
      return 'Blocked during focus session';

    default:
      return 'Access blocked';
  }
}

/**
 * Format time remaining until unblock
 * @param {number} timestamp - Milliseconds since epoch when access becomes available
 * @returns {string} Formatted time string
 */
function formatTimeRemaining(timestamp) {
  if (!timestamp) return 'Unknown';

  const now = Date.now();
  const remaining = Math.max(0, timestamp - now);

  if (remaining === 0) {
    return 'Available now';
  }

  const seconds = Math.floor(remaining / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Format seconds to human-readable time
 * @param {number} seconds - Seconds
 * @returns {string} Formatted time
 */
function formatSeconds(seconds) {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

// Exports for browser and tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createBlockContext,
    generateContextId,
    storeBlockContext,
    getBlockContexts,
    getBlockContext,
    clearExpiredContexts,
    formatBlockReason,
    formatTimeRemaining,
    formatSeconds,
  };
}
