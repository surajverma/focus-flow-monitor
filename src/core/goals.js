/** On-device goals. Progress is derived from retained history, never uploaded. */
function normalizeLocalGoal(value) {
  if (!value || typeof value !== 'object') return null;
  const { id, name, targetType, target, direction, period } = value;
  const targetSeconds = Number(value.targetSeconds);
  if (typeof id !== 'string' || !id || typeof name !== 'string' || !name.trim()) return null;
  if (!['productive', 'category', 'domain'].includes(targetType) || !['at-least', 'at-most'].includes(direction))
    return null;
  if (
    !['day', 'week'].includes(period) ||
    !Number.isFinite(targetSeconds) ||
    targetSeconds < 60 ||
    targetSeconds > (period === 'day' ? 86400 : 604800)
  )
    return null;
  if (targetType !== 'productive' && (typeof target !== 'string' || !target.trim())) return null;
  return {
    id,
    name: name.trim().slice(0, 80),
    targetType,
    target: targetType === 'productive' ? '' : target.trim(),
    direction,
    period,
    targetSeconds,
  };
}

function getLocalGoalProgress(goal, data, now = new Date()) {
  const valid = normalizeLocalGoal(goal);
  if (!valid) return null;
  const start = startOfPeriod(now, valid.period);
  const end = getPeriodEnd(now, valid.period);
  let seconds = 0;
  for (const date of getDateKeysBetween(start, end, data.dailyDomainData || {})) {
    for (const [domain, duration] of Object.entries(data.dailyDomainData[date] || {})) {
      if (data.trackingExclusions?.[domain]) continue;
      const category = resolveInsightCategory(domain, data.categoryAssignments || {});
      if (
        (valid.targetType === 'domain' && domain === valid.target) ||
        (valid.targetType === 'category' && category === valid.target) ||
        (valid.targetType === 'productive' && getInsightRating(category, data.categoryProductivityRatings) === 1)
      ) {
        seconds += Math.max(0, Number(duration) || 0);
      }
    }
  }
  const reached = seconds >= valid.targetSeconds;
  return {
    seconds,
    percent: Math.min(100, Math.round((seconds / valid.targetSeconds) * 100)),
    remainingSeconds: Math.max(0, valid.targetSeconds - seconds),
    status:
      valid.direction === 'at-least'
        ? reached
          ? 'Goal reached'
          : 'In progress'
        : seconds > valid.targetSeconds
          ? 'Over target'
          : 'Within target',
    resetsAt: end.getTime(),
  };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { normalizeLocalGoal, getLocalGoalProgress };
