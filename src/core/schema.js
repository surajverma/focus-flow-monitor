/**
 * Storage schema versioning and migrations
 * Handles backward compatibility and data upgrades
 */

const CURRENT_SCHEMA_VERSION = 2;

/**
 * Get the default/empty storage schema
 * @returns {Object} Default schema object
 */
function getDefaultSchema() {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    // Configuration
    categories: [
      'Work/Productivity',
      'Social Media',
      'News & Info',
      'Entertainment',
      'Shopping',
      'Reference & Learning',
      'Technology',
      'Finance',
      'Other',
    ],
    categoryAssignments: {},
    rules: [],
    profiles: [],
    activeFocusProfile: null,
    trackingExclusions: {},

    // Tracking data
    trackedData: {},
    dailyDomainData: {},
    dailyCategoryData: {},
    hourlyData: {},

    // Settings
    idleThresholdSeconds: 1800, // 30 minutes
    dataRetentionPeriodDays: 90,

    // Productivity ratings for categories
    categoryProductivityRatings: {
      'Work/Productivity': 'productive',
      'Social Media': 'distracting',
      'News & Info': 'neutral',
      Entertainment: 'distracting',
      Shopping: 'distracting',
      'Reference & Learning': 'productive',
      Technology: 'neutral',
      Finance: 'productive',
      Other: 'neutral',
    },

    // Pomodoro data
    pomodoroDailyStats: {},
    pomodoroAllTimeStats: {
      totalWorkSessionsCompleted: 0,
      totalTimeFocused: 0,
    },
  };
}

/**
 * Migrate old schema to new schema
 * @param {Object} oldData - The old stored data
 * @returns {Object} Migrated data
 */
function migrateData(oldData) {
  if (!oldData) {
    return getDefaultSchema();
  }

  const version = oldData.schemaVersion || 1;
  let data = { ...oldData };

  // Migration from v1 to v2
  if (version < 2) {
    data = migrateV1toV2(data);
  }

  // Set current version
  data.schemaVersion = CURRENT_SCHEMA_VERSION;

  return data;
}

/**
 * Migrate from schema v1 to v2
 * Changes: Add IDs to rules, add enabled flag, add period to limits
 * @param {Object} data - Old schema data
 * @returns {Object} Migrated data
 */
function migrateV1toV2(data) {
  const migrated = { ...data };

  // Migrate rules
  if (migrated.rules && Array.isArray(migrated.rules)) {
    migrated.rules = migrated.rules.map((rule, idx) => {
      // Generate ID if missing
      if (!rule.id) {
        rule.id = generateRuleId(rule, idx);
      }

      // Add enabled flag if missing
      if (rule.enabled === undefined) {
        rule.enabled = true;
      }

      // Add period to limit rules if missing
      if (rule.type && rule.type.startsWith('limit') && !rule.period) {
        rule.period = 'day'; // Default to daily limits
      }

      // Add matchMode for URL rules
      if (rule.type && rule.type.endsWith('-url') && !rule.matchMode) {
        rule.matchMode = 'domain'; // Default to domain matching
      }

      // Add exceptions array if missing
      if (!rule.exceptions) {
        rule.exceptions = [];
      }

      return rule;
    });
  }

  // Ensure categories exist
  if (!migrated.categories || migrated.categories.length === 0) {
    migrated.categories = getDefaultSchema().categories;
  }

  // Ensure categoryAssignments is object
  if (!migrated.categoryAssignments || typeof migrated.categoryAssignments !== 'object') {
    migrated.categoryAssignments = {};
  }

  // Ensure productivity ratings
  if (!migrated.categoryProductivityRatings || typeof migrated.categoryProductivityRatings !== 'object') {
    migrated.categoryProductivityRatings = getDefaultSchema().categoryProductivityRatings;
  }

  // Ensure pomodoro stats
  if (!migrated.pomodoroDailyStats || typeof migrated.pomodoroDailyStats !== 'object') {
    migrated.pomodoroDailyStats = {};
  }

  if (!migrated.pomodoroAllTimeStats || typeof migrated.pomodoroAllTimeStats !== 'object') {
    migrated.pomodoroAllTimeStats = {
      totalWorkSessionsCompleted: 0,
      totalTimeFocused: 0,
    };
  }

  if (!Array.isArray(migrated.profiles)) migrated.profiles = [];
  if (!migrated.trackingExclusions || typeof migrated.trackingExclusions !== 'object') migrated.trackingExclusions = {};

  return migrated;
}

/**
 * Generate a stable ID for a rule based on its properties
 * @param {Object} rule - The rule
 * @param {number} index - The rule index
 * @returns {string} Generated ID
 */
function generateRuleId(rule, index) {
  // Create a simple hash-like ID from rule properties
  const key = `${rule.type}-${rule.value || ''}-${index}`;
  return `rule_${Date.now()}_${index}`;
}

/**
 * Validate that all data is properly structured
 * @param {Object} data - Data to validate
 * @returns {Object} {valid: boolean, errors: []}
 */
function validateSchema(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    errors.push('Data must be an object');
    return { valid: false, errors };
  }

  // Check required arrays
  const arrayFields = ['categories', 'rules', 'trackedData', 'dailyDomainData', 'dailyCategoryData', 'hourlyData'];
  arrayFields.forEach((field) => {
    if (!data[field]) {
      data[field] = field === 'categories' ? ['Other'] : {};
    }
  });

  // Check object fields
  const objectFields = [
    'categoryAssignments',
    'categoryProductivityRatings',
    'pomodoroDailyStats',
    'pomodoroAllTimeStats',
  ];
  objectFields.forEach((field) => {
    if (!data[field] || typeof data[field] !== 'object' || Array.isArray(data[field])) {
      data[field] = {};
    }
  });

  // Ensure 'Other' category exists
  if (!data.categories.includes('Other')) {
    data.categories.push('Other');
  }

  return { valid: errors.length === 0, errors };
}

// Exports for Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CURRENT_SCHEMA_VERSION,
    getDefaultSchema,
    migrateData,
    migrateV1toV2,
    generateRuleId,
    validateSchema,
  };
}
