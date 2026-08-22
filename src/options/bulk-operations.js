/**
 * Bulk category assignment operations
 * Handles bulk assignment of multiple domains to categories
 */

/**
 * Assign multiple domains to a category
 * @param {Array} domains - Domains to assign
 * @param {string} category - Target category
 * @returns {Promise} Resolves when assignment is complete
 */
async function assignDomainsToCategory(domains, category) {
  try {
    if (!domains || domains.length === 0) {
      throw new Error('No domains provided');
    }

    if (!category) {
      throw new Error('No category provided');
    }

    // Load current assignments
    const result = await browser.storage.local.get(['categoryAssignments', 'categories']);
    const assignments = result.categoryAssignments || {};
    const categories = result.categories || [];

    // Validate category exists
    if (!categories.includes(category)) {
      throw new Error(`Category '${category}' does not exist`);
    }

    // Apply assignments
    const updatedAssignments = { ...assignments };
    domains.forEach((domain) => {
      if (domain) {
        updatedAssignments[domain] = category;
      }
    });

    // Save assignments
    await browser.storage.local.set({ categoryAssignments: updatedAssignments });

    // Notify background to update cache
    if (browser.runtime && browser.runtime.sendMessage) {
      browser.runtime.sendMessage({ action: 'updateRuleCache' }).catch(() => {
        // Ignore if background not ready
      });
    }

    return {
      success: true,
      count: domains.length,
      category,
    };
  } catch (error) {
    console.error('Error in bulk assignment:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Move domains from one category to another
 * @param {Array} domains - Domains to move
 * @param {string} fromCategory - Source category
 * @param {string} toCategory - Target category
 * @returns {Promise} Resolves when move is complete
 */
async function moveDomainsToCategory(domains, fromCategory, toCategory) {
  try {
    if (!fromCategory || !toCategory) {
      throw new Error('Source and target categories required');
    }

    if (fromCategory === toCategory) {
      throw new Error('Source and target categories are the same');
    }

    // Load current assignments
    const result = await browser.storage.local.get(['categoryAssignments']);
    const assignments = result.categoryAssignments || {};

    // Update assignments
    const updatedAssignments = { ...assignments };
    domains.forEach((domain) => {
      if (domain && assignments[domain] === fromCategory) {
        updatedAssignments[domain] = toCategory;
      }
    });

    // Save assignments
    await browser.storage.local.set({ categoryAssignments: updatedAssignments });

    // Notify background
    if (browser.runtime && browser.runtime.sendMessage) {
      browser.runtime.sendMessage({ action: 'updateRuleCache' }).catch(() => {
        // Ignore if background not ready
      });
    }

    return {
      success: true,
      moved: domains.length,
      from: fromCategory,
      to: toCategory,
    };
  } catch (error) {
    console.error('Error moving domains:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Remove assignments for multiple domains
 * @param {Array} domains - Domains to unassign
 * @returns {Promise} Resolves when removal is complete
 */
async function removeAssignments(domains) {
  try {
    if (!domains || domains.length === 0) {
      throw new Error('No domains provided');
    }

    // Load current assignments
    const result = await browser.storage.local.get(['categoryAssignments']);
    const assignments = result.categoryAssignments || {};

    // Remove assignments
    const updatedAssignments = { ...assignments };
    domains.forEach((domain) => {
      delete updatedAssignments[domain];
    });

    // Save
    await browser.storage.local.set({ categoryAssignments: updatedAssignments });

    // Notify background
    if (browser.runtime && browser.runtime.sendMessage) {
      browser.runtime.sendMessage({ action: 'updateRuleCache' }).catch(() => {
        // Ignore if background not ready
      });
    }

    return {
      success: true,
      removed: domains.length,
    };
  } catch (error) {
    console.error('Error removing assignments:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get all uncategorized domains
 * @param {Object} dailyDomainData - Tracking data
 * @param {Object} assignments - Current assignments
 * @returns {Promise<Array>} Array of uncategorized domains sorted by usage
 */
async function getUncategorizedDomains(dailyDomainData, assignments) {
  try {
    if (!dailyDomainData || !assignments) {
      return [];
    }

    const uncategorized = {};
    const otherCategory = 'Other';

    // Aggregate usage by domain
    Object.values(dailyDomainData).forEach((dayData) => {
      Object.entries(dayData).forEach(([domain, seconds]) => {
        // Check if domain has an explicit assignment
        if (!Object.hasOwn(assignments, domain)) {
          // Check wildcards
          let hasWildcard = false;
          const parts = domain.split('.');
          for (let i = 1; i < parts.length; i++) {
            if (Object.hasOwn(assignments, `*.${parts.slice(i).join('.')}`)) {
              hasWildcard = true;
              break;
            }
          }

          // If no wildcard either, it's uncategorized
          if (!hasWildcard) {
            uncategorized[domain] = (uncategorized[domain] || 0) + seconds;
          }
        }
      });
    });

    // Sort by usage (descending)
    return Object.entries(uncategorized)
      .sort((a, b) => b[1] - a[1])
      .map(([domain, seconds]) => ({
        domain,
        seconds,
        formattedTime: formatSeconds(seconds),
      }));
  } catch (error) {
    console.error('Error getting uncategorized domains:', error);
    return [];
  }
}

/**
 * Format seconds to human-readable time
 * @param {number} seconds - Seconds to format
 * @returns {string} Formatted time string
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
    assignDomainsToCategory,
    moveDomainsToCategory,
    removeAssignments,
    getUncategorizedDomains,
    formatSeconds,
  };
}
