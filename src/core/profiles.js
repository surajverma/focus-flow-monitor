/** Pure focus-profile validation and schedule helpers. */

function validateProfile(profile) {
  const errors = [];
  if (!profile || typeof profile !== 'object') errors.push('Profile must be an object');
  if (!profile?.id) errors.push('Profile must have an id');
  if (!profile?.name || typeof profile.name !== 'string') errors.push('Profile must have a name');
  if (!Array.isArray(profile?.allowedDomains)) errors.push('allowedDomains must be an array');
  if (!Array.isArray(profile?.allowedCategories)) errors.push('allowedCategories must be an array');
  if (profile?.schedule && !Array.isArray(profile.schedule.days)) errors.push('schedule.days must be an array');
  return { valid: errors.length === 0, errors };
}

function isProfileAllowlisted(profile, url, category) {
  if (!profile || profile.enabled === false || !/^https?:\/\//i.test(url)) return false;
  if (profile.allowedCategories?.includes(category)) return true;
  const candidate = new URL(url);
  const host = candidate.hostname.toLowerCase().replace(/^www\./, '');
  return (profile.allowedDomains || []).some((target) => {
    const normalized = String(target)
      .toLowerCase()
      .replace(/^www\./, '')
      .replace(/^\*\./, '');
    return host === normalized || host.endsWith(`.${normalized}`) || candidate.toString().startsWith(target);
  });
}

if (typeof module !== 'undefined' && module.exports) module.exports = { validateProfile, isProfileAllowlisted };
