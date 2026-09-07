/** Local-only reporting helpers for calendar periods and weekly summaries. */

function startOfLocalDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function startOfLocalWeek(date) {
  const value = startOfLocalDay(date);
  const day = value.getDay();
  value.setDate(value.getDate() - (day === 0 ? 6 : day - 1));
  return value;
}

function startOfPeriod(date, period) {
  const value = new Date(date);
  if (period === 'week') return startOfLocalWeek(value);
  if (period === 'month') {
    value.setDate(1);
    return startOfLocalDay(value);
  }
  return startOfLocalDay(value);
}

function getPeriodEnd(date, period) {
  const value = startOfPeriod(date, period);
  if (period === 'week') value.setDate(value.getDate() + 7);
  else if (period === 'month') value.setMonth(value.getMonth() + 1, 1);
  else value.setDate(value.getDate() + 1);
  return value;
}

function getDateKeysBetween(start, end, dailyData) {
  const keys = [];
  for (let cursor = startOfLocalDay(start); cursor < end; cursor.setDate(cursor.getDate() + 1)) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
    if (dailyData && Object.hasOwn(dailyData, key)) keys.push(key);
  }
  return keys;
}

function sumObjectValues(value) {
  return Object.values(value || {}).reduce((total, seconds) => total + (Number(seconds) || 0), 0);
}

function resolveInsightCategory(domain, assignments) {
  if (!assignments) return null;
  if (assignments[domain]) return assignments[domain];
  const parts = domain.split('.');
  for (let index = 1; index < parts.length; index += 1) {
    const category = assignments[`*.${parts.slice(index).join('.')}`];
    if (category) return category;
  }
  return 'Other';
}

function aggregatePeriodData(dailyDomainData, dailyCategoryData, start, end, exclusions = {}, assignments = null) {
  const domains = {};
  const categories = {};
  const keys = getDateKeysBetween(start, end, dailyDomainData);
  keys.forEach((date) => {
    Object.entries(dailyDomainData[date] || {}).forEach(([domain, seconds]) => {
      if (exclusions[domain]) return;
      domains[domain] = (domains[domain] || 0) + (Number(seconds) || 0);
      const category = resolveInsightCategory(domain, assignments);
      if (category) categories[category] = (categories[category] || 0) + (Number(seconds) || 0);
    });
    if (!assignments) {
      Object.entries(dailyCategoryData?.[date] || {}).forEach(([category, seconds]) => {
        categories[category] = (categories[category] || 0) + (Number(seconds) || 0);
      });
    }
  });
  return { dates: keys, domains, categories, totalSeconds: sumObjectValues(domains) };
}

function getInsightRating(category, productivityRatings) {
  const defaults = {
    'Work/Productivity': 1,
    'Reference & Learning': 1,
    Shopping: -1,
    'Social Media': -1,
    Entertainment: -1,
  };
  const rating = productivityRatings?.[category] ?? defaults[category] ?? 0;
  if (rating === 'productive' || rating === 1) return 1;
  if (rating === 'distracting' || rating === -1) return -1;
  return 0;
}

function insightDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function calculateInsightFocusScore(categories, productivityRatings) {
  const total = sumObjectValues(categories);
  if (!total) return 0;
  const productive = Object.entries(categories).reduce(
    (sum, [category, seconds]) =>
      sum + (getInsightRating(category, productivityRatings) === 1 ? Number(seconds) || 0 : 0),
    0
  );
  return Math.round((productive / total) * 100);
}

function buildWeeklySummary(data, referenceDate = new Date()) {
  const currentStart = startOfLocalWeek(referenceDate);
  const currentEnd = getPeriodEnd(currentStart, 'week');
  const previousEnd = currentStart;
  const previousStart = new Date(currentStart);
  previousStart.setDate(previousStart.getDate() - 7);
  const current = aggregatePeriodData(
    data.dailyDomainData,
    data.dailyCategoryData,
    currentStart,
    currentEnd,
    data.trackingExclusions,
    data.categoryAssignments
  );
  const previous = aggregatePeriodData(
    data.dailyDomainData,
    data.dailyCategoryData,
    previousStart,
    previousEnd,
    data.trackingExclusions,
    data.categoryAssignments
  );
  const currentScore = calculateInsightFocusScore(current.categories, data.productivityRatings);
  const previousScore = calculateInsightFocusScore(previous.categories, data.productivityRatings);
  const domainChanges = Object.keys({ ...current.domains, ...previous.domains })
    .map((domain) => ({ domain, change: (current.domains[domain] || 0) - (previous.domains[domain] || 0) }))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  const dailyTotals = current.dates
    .map((date) => {
      const start = new Date(`${date}T00:00:00`);
      const day = aggregatePeriodData(
        data.dailyDomainData,
        data.dailyCategoryData,
        start,
        getPeriodEnd(start, 'day'),
        data.trackingExclusions,
        data.categoryAssignments
      );
      return {
        date,
        seconds: day.totalSeconds,
        focusScore: calculateInsightFocusScore(day.categories, data.productivityRatings),
      };
    })
    .filter((day) => day.seconds > 0);
  const bestDay = dailyTotals.sort((a, b) => b.focusScore - a.focusScore || b.seconds - a.seconds)[0] || null;
  return {
    startDate: insightDateKey(currentStart),
    endDate: insightDateKey(new Date(currentEnd.getTime() - 1)),
    totalSeconds: current.totalSeconds,
    previousTotalSeconds: previous.totalSeconds,
    previousProductiveSeconds: Object.entries(previous.categories).reduce(
      (sum, [category, seconds]) => sum + (getInsightRating(category, data.productivityRatings) === 1 ? seconds : 0),
      0
    ),
    productiveSeconds: Object.entries(current.categories).reduce(
      (sum, [category, seconds]) => sum + (getInsightRating(category, data.productivityRatings) === 1 ? seconds : 0),
      0
    ),
    neutralSeconds: Object.entries(current.categories).reduce(
      (sum, [category, seconds]) => sum + (getInsightRating(category, data.productivityRatings) === 0 ? seconds : 0),
      0
    ),
    distractingSeconds: Object.entries(current.categories).reduce(
      (sum, [category, seconds]) => sum + (getInsightRating(category, data.productivityRatings) === -1 ? seconds : 0),
      0
    ),
    focusScore: currentScore,
    previousFocusScore: previousScore,
    focusScoreChange: currentScore - previousScore,
    topDomains: Object.entries(current.domains)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([domain, seconds]) => ({ domain, seconds })),
    topCategories: Object.entries(current.categories)
      .sort((a, b) => b[1] - a[1])
      .map(([category, seconds]) => ({
        category,
        seconds,
        rating: getInsightRating(category, data.productivityRatings),
        share: current.totalSeconds ? Math.round((seconds / current.totalSeconds) * 100) : 0,
      })),
    largestChanges: domainChanges.slice(0, 5),
    bestDay,
    datesTracked: dailyTotals.length,
  };
}

function getUsageForPeriod(dailyDomainData, domain, period, referenceDate = new Date()) {
  const start = startOfPeriod(referenceDate, period);
  const end = getPeriodEnd(referenceDate, period);
  return getDateKeysBetween(start, end, dailyDomainData).reduce(
    (total, date) => total + (Number(dailyDomainData[date]?.[domain]) || 0),
    0
  );
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    startOfLocalDay,
    startOfLocalWeek,
    startOfPeriod,
    getPeriodEnd,
    aggregatePeriodData,
    calculateFocusScore: calculateInsightFocusScore,
    buildWeeklySummary,
    getUsageForPeriod,
  };
}
