/**
 * Category management and resolution
 * Determines categories for domains and manages category data
 */

/**
 * Resolve the category for a domain based on assignments
 * @param {string} domain - The domain to categorize (should be normalized)
 * @param {Object} assignments - Category assignments object {domain: 'Category Name'}
 * @param {string} defaultCategory - Default category if no assignment found
 * @returns {string} The resolved category name
 */
function resolveCategoryForDomain(domain, assignments, defaultCategory) {
  if (!domain || !assignments) {
    return defaultCategory || 'Other';
  }

  // Check for exact domain match first
  if (Object.hasOwn(assignments, domain)) {
    return assignments[domain];
  }

  // Check for wildcard matches (from most specific to least)
  const parts = domain.split('.');
  for (let i = 1; i < parts.length; i++) {
    const wildcardPattern = '*.' + parts.slice(i).join('.');
    if (Object.hasOwn(assignments, wildcardPattern)) {
      return assignments[wildcardPattern];
    }
  }

  return defaultCategory || 'Other';
}

/**
 * Get all domains assigned to a specific category
 * @param {Object} assignments - Category assignments
 * @param {string} category - The category to search for
 * @returns {Array} Array of domain strings
 */
function getDomainsInCategory(assignments, category) {
  if (!assignments || !category) return [];

  return Object.keys(assignments).filter((domain) => assignments[domain] === category);
}

/**
 * Add a new category assignment
 * @param {Object} assignments - Current assignments
 * @param {string} domain - Domain to assign
 * @param {string} category - Category name
 * @returns {Object} New assignments object
 */
function assignDomainToCategory(assignments, domain, category) {
  if (!domain || !category) return assignments;

  const updated = { ...assignments };
  updated[domain] = category;
  return updated;
}

/**
 * Remove an assignment
 * @param {Object} assignments - Current assignments
 * @param {string} domain - Domain to unassign
 * @returns {Object} New assignments object
 */
function removeAssignment(assignments, domain) {
  if (!domain) return assignments;

  const updated = { ...assignments };
  delete updated[domain];
  return updated;
}

/**
 * Calculate totals for each category from daily data
 * @param {Object} dailyCategoryData - {date: {category: seconds}}
 * @param {Array} categories - List of all category names
 * @returns {Object} {category: totalSeconds}
 */
function calculateCategoryTotals(dailyCategoryData, categories) {
  const totals = {};

  if (!categories) return totals;

  categories.forEach((cat) => {
    totals[cat] = 0;
  });

  if (!dailyCategoryData) return totals;

  Object.values(dailyCategoryData).forEach((dayData) => {
    Object.entries(dayData).forEach(([category, seconds]) => {
      totals[category] = (totals[category] || 0) + seconds;
    });
  });

  return totals;
}

/**
 * Categorize daily domain data based on assignments
 * @param {Object} dailyDomainData - {date: {domain: seconds}}
 * @param {Object} assignments - Category assignments
 * @param {string} defaultCategory - Default category
 * @returns {Object} {date: {category: seconds}}
 */
function categorizeDailyData(dailyDomainData, assignments, defaultCategory) {
  const dailyCategoryData = {};

  if (!dailyDomainData) return dailyCategoryData;

  Object.entries(dailyDomainData).forEach(([date, domainData]) => {
    dailyCategoryData[date] = {};

    Object.entries(domainData).forEach(([domain, seconds]) => {
      const category = resolveCategoryForDomain(domain, assignments, defaultCategory);
      dailyCategoryData[date][category] = (dailyCategoryData[date][category] || 0) + seconds;
    });
  });

  return dailyCategoryData;
}

// Exports for Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    resolveCategoryForDomain,
    getDomainsInCategory,
    assignDomainToCategory,
    removeAssignment,
    calculateCategoryTotals,
    categorizeDailyData,
  };
}
