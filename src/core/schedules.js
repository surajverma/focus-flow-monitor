/**
 * Rule evaluation and validation
 * Determines when rules are active and validates rule configurations
 */

/**
 * Check if a rule is enabled and active at a given time
 * @param {Object} rule - The rule object
 * @param {Date} date - Optional date to check (defaults to now)
 * @returns {boolean} True if rule is active
 */
function isRuleActive(rule, date) {
  if (!rule || rule.enabled === false) {
    return false;
  }

  const checkDate = date || new Date();

  // Check schedule if present
  const nestedSchedule = rule.schedule?.enabled === false ? null : rule.schedule;
  const flatSchedule =
    rule.startTime || rule.endTime || rule.days
      ? { startTime: rule.startTime, endTime: rule.endTime, days: rule.days }
      : null;
  const schedule = nestedSchedule || flatSchedule;
  if (schedule) {
    if (!isScheduleActive(schedule, checkDate)) {
      return false;
    }
  }

  return true;
}

/**
 * Check if a schedule is active at a given time
 * @param {Object} schedule - Schedule object {days: ['Mon', ...], startTime: 'HH:MM', endTime: 'HH:MM'}
 * @param {Date} date - Date to check
 * @returns {boolean} True if schedule is active
 */
function isScheduleActive(schedule, date) {
  if (!schedule) return true;

  const checkDate = date || new Date();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const currentDay = dayNames[checkDate.getDay()];
  const currentHour = String(checkDate.getHours()).padStart(2, '0');
  const currentMinute = String(checkDate.getMinutes()).padStart(2, '0');
  const currentTime = `${currentHour}:${currentMinute}`;

  // Check if today is in schedule
  if (schedule.days && schedule.days.length > 0) {
    // Handle overnight schedules
    if (schedule.startTime > schedule.endTime) {
      // Overnight: e.g., 22:00-06:00
      const isOnStartDay = schedule.days.includes(currentDay);
      const isPastStart = currentTime >= schedule.startTime;
      const isBeforeEnd = currentTime < schedule.endTime;

      // Active if on start day and past start, or if on any other day and before end
      if (isOnStartDay && isPastStart) {
        return true;
      }

      // Before the end time, this window belongs to the previous day's start.
      const previousDayIndex = (dayNames.indexOf(currentDay) + 6) % 7;
      const previousDay = dayNames[previousDayIndex];
      if (schedule.days.includes(previousDay) && isBeforeEnd) {
        return true;
      }

      return false;
    } else {
      // Same day schedule
      if (!schedule.days.includes(currentDay)) {
        return false;
      }
    }
  }

  // Check time range
  if (schedule.startTime && schedule.endTime) {
    if (schedule.startTime > schedule.endTime) {
      // Overnight: active if after start OR before end
      return currentTime >= schedule.startTime || currentTime < schedule.endTime;
    } else {
      // Same day: active if within range
      return currentTime >= schedule.startTime && currentTime < schedule.endTime;
    }
  }

  return true;
}

/**
 * Validate a rule object
 * @param {Object} rule - The rule to validate
 * @returns {Object} {valid: boolean, errors: []}
 */
function validateRule(rule) {
  const errors = [];

  if (!rule || typeof rule !== 'object') {
    errors.push('Rule must be an object');
    return { valid: false, errors };
  }

  // Check required fields
  if (!rule.id) errors.push('Rule must have an id');
  if (!rule.type) errors.push('Rule must have a type');
  if (rule.enabled === undefined) errors.push('Rule must have an enabled flag');

  // Validate type-specific fields
  if (
    rule.type === 'block-domain' ||
    rule.type === 'block-url' ||
    rule.type === 'block-category' ||
    rule.type === 'limit-domain' ||
    rule.type === 'limit-url' ||
    rule.type === 'limit-category'
  ) {
    if (!rule.value) errors.push(`${rule.type} rule must have a value`);
  }

  if (rule.type && rule.type.includes('limit')) {
    if (!rule.period || !['day', 'week', 'month'].includes(rule.period)) {
      errors.push('Limit rule must have a valid period (day, week, or month)');
    }
    if (typeof rule.limitSeconds !== 'number' || rule.limitSeconds <= 0) {
      errors.push('Limit rule must have a positive limitSeconds');
    }
    const matchMode = rule.matchMode || (rule.type.endsWith('-url') ? 'domain' : null);
    if (rule.type.endsWith('-url') && !['domain', 'domain-subdomains'].includes(matchMode)) {
      errors.push('URL time limits support domain-based match modes only');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Calculate the next time a rule will become active
 * @param {Object} rule - The rule object
 * @param {Date} fromDate - Date to start calculation from (defaults to now)
 * @returns {number|null} Timestamp of next activation, or null if never
 */
function getNextActivationTime(rule, fromDate) {
  if (!rule || !rule.schedule || !rule.schedule.enabled) {
    return null; // Permanent rule, already active if enabled
  }

  const startDate = fromDate || new Date();
  const schedule = rule.schedule;

  // For daily schedules, calculate next activation
  if (schedule.days && schedule.days.length > 0 && schedule.startTime) {
    const [startHour, startMinute] = schedule.startTime.split(':').map(Number);

    // Try to activate today
    const todayCheck = new Date(startDate);
    todayCheck.setHours(startHour, startMinute, 0, 0);

    if (todayCheck > startDate && isScheduleActive(schedule, todayCheck)) {
      return todayCheck.getTime();
    }

    // Try next days
    for (let i = 1; i <= 7; i++) {
      const nextDate = new Date(startDate);
      nextDate.setDate(nextDate.getDate() + i);
      nextDate.setHours(startHour, startMinute, 0, 0);

      if (isScheduleActive(schedule, nextDate)) {
        return nextDate.getTime();
      }
    }
  }

  return null;
}

// Exports for Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    isRuleActive,
    isScheduleActive,
    validateRule,
    getNextActivationTime,
  };
}
