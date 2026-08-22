/**
 * Storage initialization and data loading with schema migration
 * This replaces the old loadData function
 */

async function initializeStorageWithMigration() {
  try {
    console.log('[Storage Migration] Starting storage initialization...');

    // Clear any stale tracking state on startup
    await browser.storage.local.remove(FocusFlowState.STORAGE_KEY_TRACKING_STATE);
    console.log('[Storage Migration] Cleared stale tracking state.');

    // Load all data
    const allData = await browser.storage.local.get(null);
    console.log('[Storage Migration] Loaded data from storage.');

    // Get schema version
    const schemaVersion = allData.schemaVersion || 1;
    console.log(`[Storage Migration] Current schema version: ${schemaVersion}`);

    // Migrate data if needed
    let migratedData = allData;
    if (schemaVersion < 2) {
      console.log('[Storage Migration] Running migration from v1 to v2...');
      migratedData = performDataMigration(allData);
      console.log('[Storage Migration] Migration complete.');
    }

    // Validate schema
    const validation = validateStorageSchema(migratedData);
    if (!validation.valid) {
      console.warn('[Storage Migration] Validation errors:', validation.errors);
    }

    // Update state with migrated data
    updateStateFromStorage(migratedData);

    // Save migrated data if changes were made
    if (schemaVersion < 2) {
      console.log('[Storage Migration] Saving migrated data...');
      await performSave();
    }

    console.log('[Storage Migration] Initialization complete.');
    return { success: true, migrationPerformed: schemaVersion < 2 };
  } catch (error) {
    console.error('[Storage Migration] CRITICAL error during initialization:', error);
    // Fallback to defaults
    initializeDefaultState();
    return { success: false, error: error.message };
  }
}

/**
 * Perform schema migration from v1 to v2
 * @param {Object} oldData - Old stored data
 * @returns {Object} Migrated data
 */
function performDataMigration(oldData) {
  const migrated = {
    schemaVersion: 2,
  };

  // Migrate categories and assignments
  migrated.categories = oldData.categories || [
    'Work/Productivity',
    'Social Media',
    'News & Info',
    'Entertainment',
    'Shopping',
    'Reference & Learning',
    'Technology',
    'Finance',
    'Other',
  ];
  migrated.categoryAssignments = oldData.categoryAssignments || {};

  // Ensure 'Other' category exists
  if (!migrated.categories.includes('Other')) {
    migrated.categories.push('Other');
  }

  // Migrate rules with new fields
  migrated.rules = (oldData.rules || []).map((rule, idx) => {
    if (!rule.id) {
      rule.id = `rule_${Date.now()}_${idx}`;
    }
    if (rule.enabled === undefined) {
      rule.enabled = true;
    }
    if (rule.type && rule.type.startsWith('limit') && !rule.period) {
      rule.period = 'day';
    }
    if (!rule.exceptions) {
      rule.exceptions = [];
    }
    return rule;
  });

  // Copy tracking data as-is
  migrated.trackedData = oldData.trackedData || {};
  migrated.dailyDomainData = oldData.dailyDomainData || {};
  migrated.dailyCategoryData = oldData.dailyCategoryData || {};
  migrated.hourlyData = oldData.hourlyData || {};

  // Copy Pomodoro data
  migrated.pomodoroDailyStats = oldData.pomodoroDailyStats || {};
  migrated.pomodoroAllTimeStats = oldData.pomodoroAllTimeStats || {
    totalWorkSessionsCompleted: 0,
    totalTimeFocused: 0,
  };

  // Copy settings
  migrated.idleThresholdSeconds = oldData.idleThresholdSeconds || 1800;
  migrated.dataRetentionPeriodDays = oldData.dataRetentionPeriodDays || 90;
  migrated.categoryProductivityRatings = oldData.categoryProductivityRatings || {};

  return migrated;
}

/**
 * Validate storage schema
 * @param {Object} data - Data to validate
 * @returns {Object} {valid: boolean, errors: []}
 */
function validateStorageSchema(data) {
  const errors = [];

  if (!data) {
    errors.push('Data is null or undefined');
    return { valid: false, errors };
  }

  // Ensure required fields exist
  const requiredFields = {
    categories: 'array',
    categoryAssignments: 'object',
    rules: 'array',
    trackedData: 'object',
    dailyDomainData: 'object',
    dailyCategoryData: 'object',
    hourlyData: 'object',
  };

  Object.entries(requiredFields).forEach(([field, expectedType]) => {
    if (!data[field]) {
      if (expectedType === 'array') {
        data[field] = field === 'categories' ? ['Other'] : [];
      } else {
        data[field] = {};
      }
    }
  });

  return { valid: true, errors };
}

/**
 * Update FocusFlowState from loaded storage data
 * @param {Object} data - Storage data
 */
function updateStateFromStorage(data) {
  FocusFlowState.categories = data.categories || ['Other'];
  FocusFlowState.categoryAssignments = data.categoryAssignments || {};
  FocusFlowState.rules = data.rules || [];
  FocusFlowState.trackedData = data.trackedData || {};
  FocusFlowState.categoryTimeData = {}; // Recalculate from daily data
  FocusFlowState.dailyDomainData = data.dailyDomainData || {};
  FocusFlowState.dailyCategoryData = data.dailyCategoryData || {};
  FocusFlowState.hourlyData = data.hourlyData || {};
  FocusFlowState.pomodoroDailyStats = data.pomodoroDailyStats || {};
  FocusFlowState.pomodoroAllTimeStats = data.pomodoroAllTimeStats || {
    totalWorkSessionsCompleted: 0,
    totalTimeFocused: 0,
  };
}

/**
 * Initialize to default state
 */
function initializeDefaultState() {
  FocusFlowState.schemaVersion = 2;
  FocusFlowState.categories = [
    'Work/Productivity',
    'Social Media',
    'News & Info',
    'Entertainment',
    'Shopping',
    'Reference & Learning',
    'Technology',
    'Finance',
    'Other',
  ];
  FocusFlowState.categoryAssignments = {};
  FocusFlowState.rules = [];
  FocusFlowState.trackedData = {};
  FocusFlowState.categoryTimeData = {};
  FocusFlowState.dailyDomainData = {};
  FocusFlowState.dailyCategoryData = {};
  FocusFlowState.hourlyData = {};
  FocusFlowState.pomodoroDailyStats = {};
  FocusFlowState.pomodoroAllTimeStats = {
    totalWorkSessionsCompleted: 0,
    totalTimeFocused: 0,
  };
}
