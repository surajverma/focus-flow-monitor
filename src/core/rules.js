/**
 * Shared rule matching and evaluation.
 * This module is intentionally browser-independent so the background blocker,
 * options rule tester, and unit tests use the same precedence rules.
 */

const RULE_MATCH_MODES = ['domain', 'domain-subdomains', 'exact-url', 'url-prefix'];

function normalizeRuleTarget(value, matchMode = 'domain') {
  if (typeof value !== 'string' || !value.trim()) return null;
  const target = value.trim();
  if (matchMode === 'domain' || matchMode === 'domain-subdomains') {
    const withoutScheme = target.replace(/^[a-z][a-z\d+.-]*:\/\//i, '').split(/[/?#]/, 1)[0];
    const withoutPort = withoutScheme.replace(/:\d+$/, '');
    const normalized = withoutPort.toLowerCase().replace(/^www\./, '');
    return normalized || null;
  }
  try {
    const parsed = new URL(target);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (
      (parsed.protocol === 'http:' && parsed.port === '80') ||
      (parsed.protocol === 'https:' && parsed.port === '443')
    ) {
      parsed.port = '';
    }
    return parsed.toString().replace(/\/$/, '');
  } catch (_error) {
    return null;
  }
}

function normalizeCandidateUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return null;
  const trimmed = url.trim();
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) && !/^https?:\/\//i.test(trimmed)) return null;
  try {
    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) return null;
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (
      (parsed.protocol === 'http:' && parsed.port === '80') ||
      (parsed.protocol === 'https:' && parsed.port === '443')
    ) {
      parsed.port = '';
    }
    return parsed;
  } catch (_error) {
    return null;
  }
}

function domainPatternMatches(hostname, pattern, includeSubdomains = true) {
  const normalizedHost = hostname.toLowerCase().replace(/^www\./, '');
  const normalizedPattern = pattern.toLowerCase().replace(/^www\./, '');
  if (normalizedPattern.startsWith('*.')) {
    const base = normalizedPattern.slice(2);
    return normalizedHost === base || normalizedHost.endsWith(`.${base}`);
  }
  return (
    normalizedHost === normalizedPattern || (includeSubdomains && normalizedHost.endsWith(`.${normalizedPattern}`))
  );
}

function ruleMatchesUrl(rule, url) {
  if (!rule || rule.enabled === false) return false;
  const candidate = normalizeCandidateUrl(url);
  if (!candidate) return false;
  const mode = rule.matchMode || (rule.type && rule.type.endsWith('-url') ? 'domain' : null);
  const target = normalizeRuleTarget(rule.value, mode);
  if (!target) return false;
  if (mode === 'domain' || mode === 'domain-subdomains') {
    return domainPatternMatches(candidate.hostname, target, mode === 'domain-subdomains');
  }
  const candidateUrl = candidate.toString().replace(/\/$/, '');
  return mode === 'exact-url' ? candidateUrl === target : candidateUrl.startsWith(target);
}

function exceptionMatchesUrl(exception, url) {
  if (typeof exception === 'string')
    return ruleMatchesUrl({ enabled: true, value: exception, matchMode: 'domain-subdomains' }, url);
  return ruleMatchesUrl({ enabled: true, ...exception }, url);
}

function getRuleSpecificity(rule) {
  const mode = rule.matchMode || 'domain';
  const modeWeight = { domain: 1, 'domain-subdomains': 2, 'url-prefix': 3, 'exact-url': 4 }[mode] || 0;
  return modeWeight * 10000 + String(rule.value || '').length;
}

function evaluateRules(rules, url, context = {}) {
  const enabledRules = Array.isArray(rules) ? rules.filter((rule) => rule && rule.enabled !== false) : [];
  const matches = enabledRules
    .filter((rule) => rule.type && (rule.type.startsWith('block-') || rule.type.startsWith('limit-')))
    .filter((rule) => {
      if (rule.type.endsWith('-category')) return context.category === rule.value;
      return ruleMatchesUrl(rule, url);
    })
    .sort((a, b) => getRuleSpecificity(b) - getRuleSpecificity(a));

  const exceptions = matches.filter((rule) => Array.isArray(rule.exceptions)).flatMap((rule) => rule.exceptions);
  const exception = exceptions.find((item) => exceptionMatchesUrl(item, url));
  const blockingMatch = matches.find((rule) => rule.type.startsWith('block-'));
  const limitMatches = matches.filter((rule) => rule.type.startsWith('limit-'));

  return {
    url: normalizeCandidateUrl(url),
    matches,
    blockingRule: exception ? null : blockingMatch || null,
    limitRules: limitMatches,
    exception: exception || null,
    blocked: Boolean(blockingMatch && !exception),
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    RULE_MATCH_MODES,
    normalizeRuleTarget,
    normalizeCandidateUrl,
    domainPatternMatches,
    ruleMatchesUrl,
    exceptionMatchesUrl,
    getRuleSpecificity,
    evaluateRules,
  };
}
