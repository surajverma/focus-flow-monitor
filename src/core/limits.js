/**
 * Limit checking and enforcement
 * Evaluates whether usage limits have been exceeded
 */

/**
 * Check if a domain or category has exceeded its limit
 * @param {string} target - Domain or category name
 * @param {number} currentSeconds - Current usage in seconds
 * @param {number} limitSeconds - Limit in seconds
 * @returns {boolean} True if limit exceeded
 */
function isLimitExceeded(target, currentSeconds, limitSeconds) {
  if (!target || typeof limitSeconds !== 'number' || limitSeconds <= 0) {
    return false;
  }

  return currentSeconds >= limitSeconds;
}

/**
 * Get the remaining time until limit is reached
 * @param {number} currentSeconds - Current usage in seconds
 * @param {number} limitSeconds - Limit in seconds
 * @returns {number} Seconds remaining (0 if exceeded)
 */
function getRemainingTime(currentSeconds, limitSeconds) {
  if (typeof limitSeconds !== 'number' || typeof currentSeconds !== 'number') {
    return 0;
  }

  const remaining = Math.max(0, limitSeconds - currentSeconds);
  return remaining;
}

/**
 * Calculate percentage of limit used
 * @param {number} currentSeconds - Current usage
 * @param {number} limitSeconds - Limit
 * @returns {number} Percentage (0-100+)
 */
function getUsagePercentage(currentSeconds, limitSeconds) {
  if (typeof limitSeconds !== 'number' || limitSeconds <= 0) {
    return 0;
  }

  return Math.round((currentSeconds / limitSeconds) * 100);
}

/**
 * Get all applicable limits for a domain
 * @param {string} domain - Domain to check
 * @param {string} category - Category of domain
 * @param {Array} rules - Array of limit rules
 * @returns {Array} Applicable limit rules
 */
function getApplicableLimits(domain, category, rules) {
  if (!rules || !Array.isArray(rules)) {
    return [];
  }

  return rules.filter((rule) => {
    if (rule.type !== 'limit-domain' && rule.type !== 'limit-category') {
      return false;
    }

    if (!rule.enabled) {
      return false;
    }

    if (rule.type === 'limit-domain' && rule.value === domain) {
      return true;
    }

    if (rule.type === 'limit-category' && rule.value === category) {
      return true;
    }

    return false;
  });
}

/**
 * Find the most restrictive limit from a list
 * @param {Array} limits - Array of limit rules
 * @returns {Object|null} The most restrictive limit rule
 */
function getMostRestrictiveLimit(limits) {
  if (!limits || limits.length === 0) {
    return null;
  }

  return limits.reduce((most, current) => {
    if (!most) return current;
    return current.limitSeconds < most.limitSeconds ? current : most;
  });
}

/**
 * Validate a limit rule
 * @param {Object} limit - The limit rule
 * @returns {boolean} True if valid
 */
function validateLimitRule(limit) {
  if (!limit) return false;
  if (!limit.type || !limit.type.startsWith('limit-')) return false;
  if (!limit.value) return false;
  if (typeof limit.limitSeconds !== 'number' || limit.limitSeconds <= 0) return false;
  if (!limit.period || !['day', 'week', 'month'].includes(limit.period)) return false;
  return true;
}

// Exports for Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    isLimitExceeded,
    getRemainingTime,
    getUsagePercentage,
    getApplicableLimits,
    getMostRestrictiveLimit,
    validateLimitRule,
  };
}
