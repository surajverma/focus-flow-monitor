/**
 * Tracking interval utilities
 * Split intervals across hour and day boundaries
 */

const TRACKING_MILLISECONDS_PER_SECOND = 1000;

/**
 * Split a time interval across hour boundaries
 * @param {number} startTimestamp - Start time in milliseconds
 * @param {number} endTimestamp - End time in milliseconds
 * @returns {Array} Array of {hour, seconds} objects
 */
function splitIntervalByHour(startTimestamp, endTimestamp) {
  if (startTimestamp >= endTimestamp) return [];

  const intervals = [];
  let elapsedMilliseconds = 0;
  let attributedSeconds = 0;
  const attributeSegment = (milliseconds) => {
    elapsedMilliseconds += milliseconds;
    const roundedTotal = Math.round(elapsedMilliseconds / TRACKING_MILLISECONDS_PER_SECOND);
    const seconds = roundedTotal - attributedSeconds;
    attributedSeconds = roundedTotal;
    return seconds;
  };
  const start = new Date(startTimestamp);
  let current = new Date(start);
  current.setMinutes(0, 0, 0);

  // Move to next hour if we're not at the start of an hour
  if (start.getTime() !== current.getTime()) {
    const nextHourStart = new Date(current);
    nextHourStart.setHours(nextHourStart.getHours() + 1);

    const secondsInFirstHour = attributeSegment(Math.min(nextHourStart.getTime(), endTimestamp) - startTimestamp);
    if (secondsInFirstHour > 0) {
      intervals.push({
        hour: String(start.getHours()).padStart(2, '0'),
        date: getDateString(startTimestamp),
        seconds: secondsInFirstHour,
      });
    }
    current = nextHourStart;
  }

  // Process complete hours
  while (current.getTime() < endTimestamp) {
    const nextHourStart = new Date(current);
    nextHourStart.setHours(nextHourStart.getHours() + 1);

    const endTime = Math.min(nextHourStart.getTime(), endTimestamp);
    const secondsInHour = attributeSegment(endTime - current.getTime());

    if (secondsInHour > 0) {
      intervals.push({
        hour: String(current.getHours()).padStart(2, '0'),
        date: getDateString(current.getTime()),
        seconds: secondsInHour,
      });
    }

    current = nextHourStart;
  }

  return intervals;
}

/**
 * Split a time interval across day boundaries
 * @param {number} startTimestamp - Start time in milliseconds
 * @param {number} endTimestamp - End time in milliseconds
 * @returns {Array} Array of {date, seconds} objects
 */
function splitIntervalByDay(startTimestamp, endTimestamp) {
  if (startTimestamp >= endTimestamp) return [];

  const intervals = [];
  let elapsedMilliseconds = 0;
  let attributedSeconds = 0;
  const attributeSegment = (milliseconds) => {
    elapsedMilliseconds += milliseconds;
    const roundedTotal = Math.round(elapsedMilliseconds / TRACKING_MILLISECONDS_PER_SECOND);
    const seconds = roundedTotal - attributedSeconds;
    attributedSeconds = roundedTotal;
    return seconds;
  };
  const start = new Date(startTimestamp);
  let current = new Date(start);
  current.setHours(0, 0, 0, 0);

  // Move to next day if we're not at the start of a day
  if (start.getTime() !== current.getTime()) {
    const nextDayStart = new Date(current);
    nextDayStart.setDate(nextDayStart.getDate() + 1);

    const secondsInFirstDay = attributeSegment(Math.min(nextDayStart.getTime(), endTimestamp) - startTimestamp);
    if (secondsInFirstDay > 0) {
      intervals.push({
        date: getDateString(startTimestamp),
        seconds: secondsInFirstDay,
      });
    }
    current = nextDayStart;
  }

  // Process complete days
  while (current.getTime() < endTimestamp) {
    const nextDayStart = new Date(current);
    nextDayStart.setDate(nextDayStart.getDate() + 1);

    const endTime = Math.min(nextDayStart.getTime(), endTimestamp);
    const secondsInDay = attributeSegment(endTime - current.getTime());

    if (secondsInDay > 0) {
      intervals.push({
        date: getDateString(current.getTime()),
        seconds: secondsInDay,
      });
    }

    current = nextDayStart;
  }

  return intervals;
}

/**
 * Convert interval splits to daily and hourly data structure
 * @param {Array} hourlyIntervals - Array from splitIntervalByHour
 * @returns {Object} {dailyData: {date: seconds}, hourlyData: {date: {hour: seconds}}}
 */
function aggregateIntervals(hourlyIntervals) {
  const dailyData = {};
  const hourlyData = {};

  hourlyIntervals.forEach(({ date, hour, seconds }) => {
    // Accumulate daily totals
    dailyData[date] = (dailyData[date] || 0) + seconds;

    // Accumulate hourly data
    if (!hourlyData[date]) {
      hourlyData[date] = {};
    }
    hourlyData[date][hour] = (hourlyData[date][hour] || 0) + seconds;
  });

  return { dailyData, hourlyData };
}

/**
 * Get a date string in YYYY-MM-DD format
 * @param {number} timestamp - Milliseconds since epoch
 * @returns {string} Date string
 */
function getDateString(timestamp) {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Exports for Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    splitIntervalByHour,
    splitIntervalByDay,
    aggregateIntervals,
    getDateString,
  };
}
