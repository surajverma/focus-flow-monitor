/** Pure deletion plan used by both preview and background execution. */
function planHistoryDeletion(data, selection) {
  const domain = selection?.domain || '';
  const from = selection?.from || '';
  const to = selection?.to || '';
  const validDate = (value) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  if (typeof domain !== 'string' || (domain && !/^[a-z0-9.-]+$/i.test(domain)))
    throw new Error('Choose a valid website.');
  if ((from || to) && (!validDate(from) || !validDate(to) || from > to))
    throw new Error('Choose a valid start and end date.');
  if (!domain && !from) throw new Error('Choose a website or a date range.');
  const updates = {
    trackedData: { ...(data.trackedData || {}) },
    dailyDomainData: Object.fromEntries(
      Object.entries(data.dailyDomainData || {}).map(([date, domains]) => [date, { ...domains }])
    ),
    hourlyData: { ...(data.hourlyData || {}) },
    categoryTimeData: {},
    dailyCategoryData: {},
  };
  let seconds = 0;
  const sites = new Set();
  const dates = new Set();
  const selectedDate = (date) => !from || (date >= from && date <= to);
  for (const [date, domains] of Object.entries(updates.dailyDomainData)) {
    if (!selectedDate(date)) continue;
    for (const [site, duration] of Object.entries(domains)) {
      if (domain && site !== domain) continue;
      const removed = Math.max(0, Number(duration) || 0);
      seconds += removed;
      sites.add(site);
      dates.add(date);
      updates.trackedData[site] = Math.max(0, (Number(updates.trackedData[site]) || 0) - removed);
      if (!updates.trackedData[site]) delete updates.trackedData[site];
      delete domains[site];
    }
    if (!Object.keys(domains).length) delete updates.dailyDomainData[date];
  }
  if (domain && !from) {
    seconds += Number(updates.trackedData[domain]) || 0;
    if (Object.hasOwn(updates.trackedData, domain)) sites.add(domain);
    delete updates.trackedData[domain];
  }
  // Legacy hourly totals have no domain attribution: never pretend to subtract exact hours.
  const hourlyDates = Object.keys(updates.hourlyData).filter((date) => (domain ? dates.has(date) : selectedDate(date)));
  hourlyDates.forEach((date) => {
    delete updates.hourlyData[date];
  });
  const categoryFor = (site) => {
    const assignments = data.categoryAssignments || {};
    if (Object.hasOwn(assignments, site)) return assignments[site];
    const parts = site.split('.');
    for (let index = 1; index < parts.length; index++) {
      const key = `*.${parts.slice(index).join('.')}`;
      if (Object.hasOwn(assignments, key)) return assignments[key];
    }
    return 'Other';
  };
  for (const [site, duration] of Object.entries(updates.trackedData)) {
    const category = categoryFor(site);
    updates.categoryTimeData[category] = (updates.categoryTimeData[category] || 0) + duration;
  }
  for (const [date, domains] of Object.entries(updates.dailyDomainData)) {
    updates.dailyCategoryData[date] = {};
    for (const [site, duration] of Object.entries(domains)) {
      const category = categoryFor(site);
      updates.dailyCategoryData[date][category] = (updates.dailyCategoryData[date][category] || 0) + duration;
    }
  }
  return { updates, seconds, siteCount: sites.size, dayCount: dates.size, hourlyDayCount: hourlyDates.length };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { planHistoryDeletion };
