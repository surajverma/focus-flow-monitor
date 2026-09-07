// --- Storage Constants (from state.js, but good to have here for clarity if needed) ---
// const STORAGE_KEY_TRACKING_STATE = 'currentTrackingState';
// const STORAGE_KEY_IDLE_THRESHOLD = 'idleThresholdSeconds';
// const DEFAULT_IDLE_SECONDS = 1800; // 30 minutes
// const STORAGE_KEY_DATA_RETENTION_DAYS = 'dataRetentionPeriodDays';
// const DEFAULT_DATA_RETENTION_DAYS = 90; // 3 months
// const SAVE_DATA_DEBOUNCE_MS = 3000; // 3 seconds

const backgroundStorageManager = typeof createStorageManager === 'function' ? createStorageManager() : null;

async function loadData({ clearTrackingState = true } = {}) {
  console.log('[Storage] loadData started.');
  try {
    // Clear any potentially stale "currentTrackingState" on startup.
    // This state is only for tracking time between active browser states and should not persist across browser sessions.
    if (clearTrackingState) {
      await browser.storage.local.remove(FocusFlowState.STORAGE_KEY_TRACKING_STATE);
      console.log('[Storage] Cleared potentially stale tracking state on startup.');
    }

    const keysToLoad = [
      'trackedData',
      'categoryTimeData',
      'categories',
      'categoryAssignments',
      'rules',
      'dailyDomainData',
      'dailyCategoryData',
      'hourlyData',
      'dataRetentionPeriodDays', // For pruning
      FocusFlowState.STORAGE_KEY_POMODORO_STATS_DAILY,
      FocusFlowState.STORAGE_KEY_POMODORO_STATS_ALL_TIME,
    ];

    const result = await browser.storage.local.get([
      ...keysToLoad,
      'schemaVersion',
      'profiles',
      'activeFocusProfile',
      'trackingExclusions',
      'categoryProductivityRatings',
    ]);
    const migrated = typeof migrateData === 'function' ? migrateData(result) : result;
    if (typeof validateSchema === 'function') validateSchema(migrated);
    if (JSON.stringify(result.categoryProductivityRatings) !== JSON.stringify(migrated.categoryProductivityRatings)) {
      await browser.storage.local.set({ categoryProductivityRatings: migrated.categoryProductivityRatings });
    }
    console.log('[Storage] Config/History/Stats Data loaded from storage.');

    let needsSave = false; // Flag to check if initial save of defaults is needed
    let defaults = null;
    const needDefaultConfig =
      !Array.isArray(migrated.categories) ||
      migrated.categories.length === 0 ||
      !migrated.categoryAssignments ||
      Object.keys(migrated.categoryAssignments).length === 0;

    if (needDefaultConfig) {
      try {
        console.log('[Storage] Fetching defaults...');
        const response = await fetch(browser.runtime.getURL('data/default_config.json'));
        if (!response.ok) throw new Error(`Fetch error: ${response.statusText || response.status}`);
        defaults = await response.json();
        if (!defaults || !Array.isArray(defaults.categories) || typeof defaults.assignments !== 'object') {
          throw new Error('Invalid default config structure.');
        }
        console.log('[Storage] Successfully fetched defaults.');
      } catch (fetchError) {
        console.error('[Storage] CRITICAL: Failed to fetch or parse default config.', fetchError);
        // Fallback to minimal defaults if fetch fails
        defaults = { categories: ['Other'], assignments: {} };
      }
    }

    // Initialize state properties from storage or defaults
    FocusFlowState.categories =
      migrated.categories && migrated.categories.length > 0
        ? migrated.categories
        : defaults
          ? [...defaults.categories]
          : ['Other'];
    FocusFlowState.categoryAssignments =
      migrated.categoryAssignments && Object.keys(migrated.categoryAssignments).length > 0
        ? migrated.categoryAssignments
        : defaults
          ? { ...defaults.assignments }
          : {};
    FocusFlowState.rules = migrated.rules && Array.isArray(migrated.rules) ? migrated.rules : [];
    FocusFlowState.trackedData = migrated.trackedData || {};
    FocusFlowState.categoryTimeData = migrated.categoryTimeData || {};
    FocusFlowState.dailyDomainData = migrated.dailyDomainData || {};
    FocusFlowState.dailyCategoryData = migrated.dailyCategoryData || {};
    FocusFlowState.hourlyData = migrated.hourlyData || {};
    FocusFlowState.profiles = Array.isArray(migrated.profiles) ? migrated.profiles : [];
    FocusFlowState.activeFocusProfile = migrated.activeFocusProfile || null;
    FocusFlowState.trackingExclusions = migrated.trackingExclusions || {};

    // Load Pomodoro Stats
    FocusFlowState.pomodoroDailyStats = result[FocusFlowState.STORAGE_KEY_POMODORO_STATS_DAILY] || {};
    FocusFlowState.pomodoroAllTimeStats = result[FocusFlowState.STORAGE_KEY_POMODORO_STATS_ALL_TIME] || {
      totalWorkSessionsCompleted: 0,
      totalTimeFocused: 0,
    };

    // Ensure 'Other' category exists
    if (!FocusFlowState.categories.includes(FocusFlowState.defaultCategory)) {
      FocusFlowState.categories.push(FocusFlowState.defaultCategory);
      needsSave = true;
    }
    // Ensure categories referenced in assignments exist
    let categoriesChanged = false;
    for (const domain in FocusFlowState.categoryAssignments) {
      const catName = FocusFlowState.categoryAssignments[domain];
      if (!FocusFlowState.categories.includes(catName)) {
        console.warn(`[Storage] Assignment for "${domain}" uses unknown category "${catName}". Adding category.`);
        FocusFlowState.categories.push(catName);
        categoriesChanged = true;
      }
    }

    // If defaults were loaded, or 'Other' was added, or categories from assignments were added, or critical data like hourlyData/rules was missing, or pomodoro stats were missing
    if (
      needsSave ||
      needDefaultConfig ||
      categoriesChanged ||
      !result.hourlyData ||
      !result.rules ||
      !result[FocusFlowState.STORAGE_KEY_POMODORO_STATS_DAILY] ||
      !result[FocusFlowState.STORAGE_KEY_POMODORO_STATS_ALL_TIME] ||
      result.schemaVersion !== migrated.schemaVersion
    ) {
      console.log('[Storage] Saving initial/updated non-tracking state (including Pomodoro stats if new).');
      await performSave(); // This will now also save the (potentially empty/default) pomodoro stats
    }

    // Prune old data based on retention settings
    await pruneOldData(result['dataRetentionPeriodDays']); // Pass the loaded setting

    console.log(
      `[Storage] State loaded: ${FocusFlowState.categories.length} cats, ${
        Object.keys(FocusFlowState.categoryAssignments).length
      } assigns, ${FocusFlowState.rules.length} rules.`
    );
    console.log('[Storage] loadData finished.');
  } catch (error) {
    console.error('[Storage] CRITICAL Error during loadData:', error);
    // Fallback to ensure the extension doesn't break completely
    FocusFlowState.categories = ['Other'];
    FocusFlowState.categoryAssignments = {};
    FocusFlowState.rules = [];
    FocusFlowState.trackedData = {};
    FocusFlowState.categoryTimeData = {};
    FocusFlowState.dailyDomainData = {};
    FocusFlowState.dailyCategoryData = {};
    FocusFlowState.hourlyData = {};
    FocusFlowState.pomodoroDailyStats = {}; // Reset stats on error
    FocusFlowState.pomodoroAllTimeStats = { totalWorkSessionsCompleted: 0, totalTimeFocused: 0 };

    try {
      await browser.storage.local.remove(FocusFlowState.STORAGE_KEY_TRACKING_STATE);
    } catch (clearError) {
      console.error('[Storage] Failed to clear tracking state during loadData error handling:', clearError);
    }
  }
}

async function performSave() {
  // TEMPORARY: More direct logging for entry
  console.log('[Storage performSave] ****** ENTERED performSave() ******');

  // Simpler check for now to ensure it proceeds if called directly
  if (FocusFlowState.isSaving) {
    console.warn(
      '[Storage performSave] performSave called while isSaving was true. Investigating if this is problematic...'
    );
    // For debugging, we might allow it to proceed or add a small delay and retry.
    // For now, let's proceed but be aware. If this happens often, it might indicate a race condition.
  }

  FocusFlowState.isSaving = true;
  console.log('[Storage performSave] Set isSaving to true.');

  // Create a snapshot of the stats to be saved for logging
  const statsToSaveSnapshot = {
    daily: JSON.parse(JSON.stringify(FocusFlowState.pomodoroDailyStats)), // Deep copy for logging
    allTime: JSON.parse(JSON.stringify(FocusFlowState.pomodoroAllTimeStats)), // Deep copy for logging
  };
  console.log('[Storage performSave] Pomodoro stats snapshot for saving:', statsToSaveSnapshot);
  console.log('[Storage performSave] Current FocusFlowState.pomodoroDailyStats:', FocusFlowState.pomodoroDailyStats);
  console.log(
    '[Storage performSave] Current FocusFlowState.pomodoroAllTimeStats:',
    FocusFlowState.pomodoroAllTimeStats
  );

  const stateToSave = {
    trackedData: FocusFlowState.trackedData,
    categoryTimeData: FocusFlowState.categoryTimeData,
    dailyDomainData: FocusFlowState.dailyDomainData,
    dailyCategoryData: FocusFlowState.dailyCategoryData,
    hourlyData: FocusFlowState.hourlyData,
    categories: FocusFlowState.categories,
    categoryAssignments: FocusFlowState.categoryAssignments,
    rules: FocusFlowState.rules,
    schemaVersion: typeof CURRENT_SCHEMA_VERSION === 'number' ? CURRENT_SCHEMA_VERSION : 2,
    profiles: FocusFlowState.profiles,
    activeFocusProfile: FocusFlowState.activeFocusProfile,
    trackingExclusions: FocusFlowState.trackingExclusions,
    // Add Pomodoro stats to save
    [FocusFlowState.STORAGE_KEY_POMODORO_STATS_DAILY]: FocusFlowState.pomodoroDailyStats,
    [FocusFlowState.STORAGE_KEY_POMODORO_STATS_ALL_TIME]: FocusFlowState.pomodoroAllTimeStats,
  };

  try {
    console.log('[Storage performSave] Attempting browser.storage.local.set with keys:', Object.keys(stateToSave));
    if (backgroundStorageManager) await backgroundStorageManager.write(stateToSave);
    else await browser.storage.local.set(stateToSave);
    console.log('[Storage performSave] Successfully saved state including Pomodoro stats.');
  } catch (error) {
    console.error('[Storage performSave] CRITICAL Error during browser.storage.local.set:', error);
  } finally {
    FocusFlowState.isSaving = false;
    console.log('[Storage performSave] Set isSaving to false. Exiting function.');
  }
}

/**
 * Saves all current FocusFlowState data to browser.storage.local, debounced.
 */
function saveDataBatched() {
  if (FocusFlowState.saveTimeoutId) {
    clearTimeout(FocusFlowState.saveTimeoutId);
  }
  FocusFlowState.saveTimeoutId = setTimeout(() => {
    console.log('[Storage saveDataBatched] Debounced save triggered.');
    performSave(); // performSave now handles the isSaving flag
    FocusFlowState.saveTimeoutId = null;
  }, FocusFlowState.SAVE_DATA_DEBOUNCE_MS);
}

/**
 * Deletes daily and hourly tracking data older than the configured retention period.
 * Also prunes Pomodoro daily stats.
 * @param {number|undefined} [retentionDaysSetting] - Optional pre-fetched retention setting. If not provided, it will be fetched from storage.
 */
async function pruneOldData(retentionDaysSetting = undefined) {
  console.log('[Pruning] Checking for old data to prune...');
  let retentionDays = retentionDaysSetting;

  try {
    if (retentionDays === undefined) {
      const result = await browser.storage.local.get(FocusFlowState.STORAGE_KEY_DATA_RETENTION_DAYS);
      retentionDays = result[FocusFlowState.STORAGE_KEY_DATA_RETENTION_DAYS];
    }

    // If still undefined or null after trying to fetch, use default. Then parse.
    if (retentionDays === undefined || retentionDays === null) {
      retentionDays = FocusFlowState.DEFAULT_DATA_RETENTION_DAYS;
    } else {
      retentionDays = parseInt(retentionDays, 10);
    }

    if (isNaN(retentionDays) || retentionDays < 0) {
      // -1 means forever
      console.log('[Pruning] Data retention set to Forever or invalid. No pruning needed.');
      return;
    }

    console.log(`[Pruning] Data retention period: ${retentionDays} days.`);

    const today = new Date();
    const cutoffDate = new Date(today);
    cutoffDate.setDate(today.getDate() - retentionDays);
    cutoffDate.setHours(0, 0, 0, 0); // Set to the beginning of the cutoff day

    let dataWasPruned = false;

    const pruneObject = (dataObject, objectName) => {
      if (!dataObject) return;
      const keysToDelete = [];
      for (const dateKey in dataObject) {
        // Ensure the key is a valid date string format before attempting to parse
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
          try {
            const entryDate = new Date(dateKey + 'T00:00:00'); // Ensure consistent date parsing
            if (!isNaN(entryDate) && entryDate < cutoffDate) {
              keysToDelete.push(dateKey);
            }
          } catch (e) {
            console.warn(`[Pruning] Error parsing date key '${dateKey}' in ${objectName}. Skipping.`);
          }
        } else {
          console.warn(`[Pruning] Invalid date key format '${dateKey}' found in ${objectName}. Skipping.`);
        }
      }

      if (keysToDelete.length > 0) {
        console.log(`[Pruning] Deleting ${keysToDelete.length} old entries from ${objectName}:`, keysToDelete);
        keysToDelete.forEach((key) => delete dataObject[key]);
        dataWasPruned = true;
      }
    };

    pruneObject(FocusFlowState.dailyDomainData, 'dailyDomainData');
    pruneObject(FocusFlowState.dailyCategoryData, 'dailyCategoryData');
    pruneObject(FocusFlowState.hourlyData, 'hourlyData');
    pruneObject(FocusFlowState.pomodoroDailyStats, 'pomodoroDailyStats'); // Prune Pomodoro daily stats

    if (dataWasPruned) {
      console.log('[Pruning] Old data removed. Saving updated state...');
      await performSave(); // Save changes after pruning
      console.log('[Pruning] Updated state saved.');
    } else {
      console.log('[Pruning] No old data found to prune.');
    }
  } catch (error) {
    console.error('[Pruning] Error during data pruning:', error);
  }
}

// At the very end of for-gemini/background/storage.js
console.log('[Storage.js] Script loaded. performSave is now globally defined:', typeof performSave === 'function');
if (typeof performSave === 'function') {
  console.log('[Storage.js] performSave definition:', performSave.toString().substring(0, 200) + '...'); // Log first 200 chars
}
