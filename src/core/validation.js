/**
 * Data validation utilities
 * Validates backup files, storage data, and configurations
 */

/**
 * Validate a backup file structure
 * @param {Object} backup - The backup object to validate
 * @returns {Object} {valid: boolean, errors: [], warnings: []}
 */
function validateBackup(backup) {
  const errors = [];
  const warnings = [];

  if (!backup || typeof backup !== 'object') {
    errors.push('Backup must be an object');
    return { valid: false, errors, warnings };
  }

  // Check for required fields
  if (backup.version === undefined && backup.schemaVersion === undefined) {
    warnings.push('Backup has no schema version and will use legacy migration defaults');
  }

  if (!backup.timestamp) {
    warnings.push('Backup missing timestamp');
  }

  // Validate data sections
  if (backup.categories) {
    if (!Array.isArray(backup.categories)) {
      errors.push('categories must be an array');
    } else {
      backup.categories.forEach((cat, idx) => {
        if (typeof cat !== 'string') {
          errors.push(`categories[${idx}] must be a string`);
        }
      });
    }
  }

  if (backup.categoryAssignments) {
    if (typeof backup.categoryAssignments !== 'object' || Array.isArray(backup.categoryAssignments)) {
      errors.push('categoryAssignments must be an object');
    } else {
      Object.entries(backup.categoryAssignments).forEach(([domain, category]) => {
        if (typeof domain !== 'string' || typeof category !== 'string') {
          errors.push(`categoryAssignments: invalid entry for ${domain}`);
        }
      });
    }
  }

  if (backup.rules) {
    if (!Array.isArray(backup.rules)) {
      errors.push('rules must be an array');
    } else {
      backup.rules.forEach((rule, idx) => {
        if (!rule.type) {
          errors.push(`rules[${idx}]: missing type`);
        }
      });
    }
  }

  if (backup.trackedData) {
    if (typeof backup.trackedData !== 'object' || Array.isArray(backup.trackedData)) {
      errors.push('trackedData must be an object');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Sanitize imported data to prevent injection
 * @param {Object} data - Data to sanitize
 * @returns {Object} Sanitized data
 */
function sanitizeImportedData(data) {
  if (!data || typeof data !== 'object') {
    return {};
  }

  const sanitized = {};
  const allowedTopLevelKeys = [
    'version',
    'extensionVersion',
    'timestamp',
    'categories',
    'categoryAssignments',
    'rules',
    'trackedData',
    'dailyDomainData',
    'dailyCategoryData',
    'hourlyData',
    'categoryTimeData',
    'categoryProductivityRatings',
    'pomodoroDailyStats',
    'pomodoroAllTimeStats',
    'pomodoroStatsDaily',
    'pomodoroStatsAllTime',
    'pomodoroUserSettings',
    'blockPage_customHeading',
    'blockPage_customMessage',
    'blockPage_customButtonText',
    'blockPage_showUrl',
    'blockPage_showReason',
    'blockPage_showRule',
    'blockPage_showLimitInfo',
    'blockPage_showScheduleInfo',
    'blockPage_showQuote',
    'blockPage_userQuotes',
    'idleThresholdSeconds',
    'dataRetentionPeriodDays',
    'schemaVersion',
    'profiles',
    'localGoals',
    'activeFocusProfile',
    'trackingExclusions',
    'lastBackupAt',
  ];

  Object.entries(data).forEach(([key, value]) => {
    // Only allow known top-level keys
    if (!allowedTopLevelKeys.includes(key)) {
      return;
    }

    if (key === 'categories' && Array.isArray(value)) {
      sanitized[key] = value.filter((v) => typeof v === 'string');
    } else if (key === 'categoryAssignments' && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = {};
      Object.entries(value).forEach(([k, v]) => {
        if (typeof k === 'string' && typeof v === 'string') {
          sanitized[key][k] = v;
        }
      });
    } else if (key === 'rules' && Array.isArray(value)) {
      sanitized[key] = value.filter((rule) => rule && typeof rule === 'object' && typeof rule.type === 'string');
    } else if (key === 'trackedData' && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = {};
      Object.entries(value).forEach(([k, v]) => {
        if (typeof k === 'string' && typeof v === 'number' && v > 0) {
          sanitized[key][k] = v;
        }
      });
    } else if ((key === 'idleThresholdSeconds' || key === 'dataRetentionPeriodDays') && typeof value === 'number') {
      sanitized[key] = key === 'dataRetentionPeriodDays' && value === -1 ? -1 : Math.max(1, Math.floor(value));
    } else if (
      [
        'dailyDomainData',
        'dailyCategoryData',
        'hourlyData',
        'categoryTimeData',
        'categoryProductivityRatings',
        'pomodoroDailyStats',
        'pomodoroAllTimeStats',
        'pomodoroStatsDaily',
        'pomodoroStatsAllTime',
        'pomodoroUserSettings',
      ].includes(key)
    ) {
      if (value && typeof value === 'object' && !Array.isArray(value)) sanitized[key] = value;
    } else if (key === 'localGoals') {
      // Browser pages load goals.js first; CommonJS tests use the same validator.
      const normalizeGoal =
        typeof normalizeLocalGoal === 'function' ? normalizeLocalGoal : module.require('./goals').normalizeLocalGoal;
      sanitized[key] = Array.isArray(value) ? value.map(normalizeGoal).filter(Boolean) : [];
    } else if (['profiles', 'activeFocusProfile', 'trackingExclusions'].includes(key)) {
      if (key === 'profiles' && Array.isArray(value))
        sanitized[key] = value.filter((profile) => profile && typeof profile === 'object');
      if (key === 'activeFocusProfile')
        sanitized[key] = value && typeof value === 'object' && !Array.isArray(value) ? value : null;
      if (key === 'trackingExclusions' && value && typeof value === 'object' && !Array.isArray(value))
        sanitized[key] = value;
    } else if (value === null && key === 'lastBackupAt') {
      sanitized[key] = null;
    } else if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
      sanitized[key] = value;
    } else if (key === 'blockPage_userQuotes' && Array.isArray(value)) {
      sanitized[key] = value.filter((quote) => typeof quote === 'string').slice(0, 100);
    }
  });

  return sanitized;
}

/**
 * Check if a value is a valid URL
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid
 */
function isValidURL(url) {
  if (typeof url !== 'string') return false;

  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

/**
 * Validate time format HH:MM
 * @param {string} time - Time string to validate
 * @returns {boolean} True if valid
 */
function isValidTimeFormat(time) {
  if (typeof time !== 'string') return false;
  const match = time.match(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/);
  return match !== null;
}

// Exports for Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    validateBackup,
    sanitizeImportedData,
    isValidURL,
    isValidTimeFormat,
  };
}
