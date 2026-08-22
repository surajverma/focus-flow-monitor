/**
 * Time period utilities for tracking boundaries
 * Handles daily, weekly, and monthly period calculations
 */

const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const SECONDS_PER_HOUR = SECONDS_PER_MINUTE * MINUTES_PER_HOUR;
const SECONDS_PER_DAY = SECONDS_PER_HOUR * HOURS_PER_DAY;

/**
 * Get the start of today (midnight) as a timestamp
 * @param {Date} date - Optional date to use (defaults to now)
 * @returns {number} Timestamp of start of day
 */
function getStartOfDay(date) {
  const d = date ? new Date(date) : new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Get the start of this week (Monday) as a timestamp
 * @param {Date} date - Optional date to use (defaults to now)
 * @returns {number} Timestamp of start of week
 */
function getStartOfWeek(date) {
  const d = date ? new Date(date) : new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Get the start of this month as a timestamp
 * @param {Date} date - Optional date to use (defaults to now)
 * @returns {number} Timestamp of start of month
 */
function getStartOfMonth(date) {
  const d = date ? new Date(date) : new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Get the end of a period as a timestamp
 * @param {number} startTimestamp - Start of the period
 * @param {string} period - 'day', 'week', or 'month'
 * @returns {number} Timestamp of end of period
 */
function getEndOfPeriod(startTimestamp, period) {
  const start = new Date(startTimestamp);
  const end = new Date(start);

  if (period === 'day') {
    end.setDate(end.getDate() + 1);
  } else if (period === 'week') {
    end.setDate(end.getDate() + 7);
  } else if (period === 'month') {
    end.setMonth(end.getMonth() + 1);
  }

  return end.getTime();
}

/**
 * Get the YYYY-MM-DD date string for a given timestamp
 * @param {number} timestamp - Milliseconds since epoch
 * @returns {string} Date string in YYYY-MM-DD format
 */
function getDateString(timestamp) {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get the hour string (HH) for a given timestamp
 * @param {number} timestamp - Milliseconds since epoch
 * @returns {string} Hour string in HH format
 */
function getHourString(timestamp) {
  const d = new Date(timestamp);
  return String(d.getHours()).padStart(2, '0');
}

/**
 * Check if a timestamp is within a specific period
 * @param {number} timestamp - Milliseconds since epoch
 * @param {string} period - 'day', 'week', or 'month'
 * @returns {boolean} True if timestamp is in the current period
 */
function isInCurrentPeriod(timestamp, period) {
  const now = Date.now();
  let periodStart;

  if (period === 'day') {
    periodStart = getStartOfDay(now);
  } else if (period === 'week') {
    periodStart = getStartOfWeek(now);
  } else if (period === 'month') {
    periodStart = getStartOfMonth(now);
  } else {
    return false;
  }

  const periodEnd = getEndOfPeriod(periodStart, period);
  return timestamp >= periodStart && timestamp < periodEnd;
}

/**
 * Get the next period boundary
 * @param {string} period - 'day', 'week', or 'month'
 * @returns {number} Timestamp of next period start
 */
function getNextPeriodBoundary(period) {
  const now = Date.now();

  if (period === 'day') {
    return getStartOfDay(now) + SECONDS_PER_DAY * MILLISECONDS_PER_SECOND;
  } else if (period === 'week') {
    return getStartOfWeek(now) + 7 * SECONDS_PER_DAY * MILLISECONDS_PER_SECOND;
  } else if (period === 'month') {
    const start = getStartOfMonth(now);
    const next = new Date(start);
    next.setMonth(next.getMonth() + 1);
    return next.getTime();
  }

  return 0;
}

// Exports for Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getStartOfDay,
    getStartOfWeek,
    getStartOfMonth,
    getEndOfPeriod,
    getDateString,
    getHourString,
    isInCurrentPeriod,
    getNextPeriodBoundary,
    SECONDS_PER_DAY,
    SECONDS_PER_HOUR,
  };
}
