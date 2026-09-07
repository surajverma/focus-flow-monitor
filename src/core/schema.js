/**
 * Storage schema versioning and migrations
 * Handles backward compatibility and data upgrades
 */

const CURRENT_SCHEMA_VERSION = 3;

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
    localGoals: [],
    activeFocusProfile: null,
    trackingExclusions: {},
    lastBackupAt: null,

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
      'Work/Productivity': 1,
      'Social Media': -1,
      'News & Info': 0,
      Entertainment: -1,
      Shopping: -1,
      'Reference & Learning': 1,
      Technology: 0,
      Finance: 0,
      Other: 0,
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

  if (version < 3) {
    data = migrateV2toV3(data);
  }

  // Set current version
  data.schemaVersion = CURRENT_SCHEMA_VERSION;
  if (!Array.isArray(data.localGoals)) data.localGoals = [];
  // Repair ratings written by earlier schema defaults without changing user choices.
  const legacyRatings = { productive: 1, neutral: 0, distracting: -1 };
  data.categoryProductivityRatings = isPlainObject(data.categoryProductivityRatings)
    ? Object.fromEntries(
        Object.entries(data.categoryProductivityRatings).map(([category, rating]) => [
          category,
          Object.hasOwn(legacyRatings, rating) ? legacyRatings[rating] : rating,
        ])
      )
    : getDefaultSchema().categoryProductivityRatings;

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
    migrated.rules = migrated.rules.map((originalRule, idx) => {
      const rule = { ...originalRule };
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
  const key = `${rule?.type || 'rule'}|${rule?.value || ''}|${rule?.matchMode || ''}|${index}`;
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `rule_${(hash >>> 0).toString(36)}`;
}

function generateProfileId(profile, index) {
  return generateRuleId({ type: 'profile', value: profile?.name || '' }, index).replace(/^rule_/, 'profile_');
}

function migrateV2toV3(data) {
  const defaults = getDefaultSchema();
  const migrated = { ...defaults, ...data };
  migrated.categories = Array.isArray(data.categories) ? [...data.categories] : [...defaults.categories];
  if (!migrated.categories.includes('Other')) migrated.categories.push('Other');
  migrated.categoryAssignments = isPlainObject(data.categoryAssignments) ? { ...data.categoryAssignments } : {};
  migrated.rules = (Array.isArray(data.rules) ? data.rules : []).map((originalRule, index) => {
    const rule = { ...originalRule };
    if (rule.type === 'block-domain') rule.type = 'block-url';
    if (rule.type === 'limit-domain') rule.type = 'limit-url';
    rule.id = rule.id || generateRuleId(rule, index);
    rule.enabled = rule.enabled !== false;
    rule.exceptions = Array.isArray(rule.exceptions) ? rule.exceptions : [];
    if (rule.type?.startsWith('limit-'))
      rule.period = ['day', 'week', 'month'].includes(rule.period) ? rule.period : 'day';
    if (rule.type?.endsWith('-url')) rule.matchMode = rule.matchMode || 'domain';
    return rule;
  });
  migrated.profiles = (Array.isArray(data.profiles) ? data.profiles : []).map((originalProfile, index) => ({
    ...originalProfile,
    id: originalProfile.id || generateProfileId(originalProfile, index),
    enabled: originalProfile.enabled !== false,
    allowedDomains: Array.isArray(originalProfile.allowedDomains) ? originalProfile.allowedDomains : [],
    allowedCategories: Array.isArray(originalProfile.allowedCategories) ? originalProfile.allowedCategories : [],
  }));
  if (isPlainObject(data.activeFocusProfile)) {
    const storedActive = data.activeFocusProfile;
    migrated.activeFocusProfile = migrated.profiles.find(
      (profile) => (storedActive.id && profile.id === storedActive.id) || profile.name === storedActive.name
    ) || { ...storedActive, id: storedActive.id || generateProfileId(storedActive, migrated.profiles.length) };
  } else {
    migrated.activeFocusProfile = null;
  }
  migrated.trackingExclusions = isPlainObject(data.trackingExclusions) ? { ...data.trackingExclusions } : {};
  [
    'trackedData',
    'dailyDomainData',
    'dailyCategoryData',
    'hourlyData',
    'categoryProductivityRatings',
    'pomodoroDailyStats',
    'pomodoroAllTimeStats',
  ].forEach((field) => {
    migrated[field] = isPlainObject(data[field]) ? data[field] : defaults[field];
  });
  return migrated;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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
  if (!Array.isArray(data.categories)) data.categories = ['Other'];
  if (!Array.isArray(data.rules)) data.rules = [];
  if (!Array.isArray(data.profiles)) data.profiles = [];

  // Check object fields
  const objectFields = [
    'categoryAssignments',
    'categoryProductivityRatings',
    'pomodoroDailyStats',
    'pomodoroAllTimeStats',
    'trackedData',
    'dailyDomainData',
    'dailyCategoryData',
    'hourlyData',
    'trackingExclusions',
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
    migrateV2toV3,
    generateRuleId,
    generateProfileId,
    validateSchema,
  };
}
