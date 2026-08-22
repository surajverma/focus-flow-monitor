/**
 * Domain and URL normalization utilities
 * Pure functions for normalizing domains and URLs for matching and storage
 */

/**
 * Normalize a domain name
 * @param {string} domain - The domain to normalize
 * @returns {string|null} Normalized domain or null if invalid
 */
function normalizeDomain(domain) {
  if (!domain) return null;

  try {
    // Remove leading www if present
    let normalized = domain.toLowerCase();
    if (normalized.startsWith('www.')) {
      normalized = normalized.substring(4);
    }

    // Validate it's a proper domain
    if (!normalized || normalized.includes(' ') || normalized.startsWith('.') || normalized.endsWith('.')) {
      return null;
    }

    return normalized;
  } catch (e) {
    return null;
  }
}

/**
 * Extract and normalize the hostname from a URL
 * @param {string} url - The URL to parse
 * @returns {string|null} Normalized hostname or null if invalid
 */
function extractAndNormalizeHostname(url) {
  if (!url) return null;

  try {
    // Reject extension URLs
    if (url.startsWith('about:') || url.startsWith('moz-extension:') || url.startsWith('chrome-extension:')) {
      return null;
    }

    // Parse URL
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    if (!hostname) return null;

    return normalizeDomain(hostname);
  } catch (e) {
    return null;
  }
}

/**
 * Extract full URL path (protocol, hostname, pathname)
 * @param {string} url - The URL to parse
 * @returns {string|null} Normalized URL path or null if invalid
 */
function extractFullUrlPath(url) {
  if (!url) return null;

  try {
    if (url.startsWith('about:') || url.startsWith('moz-extension:') || url.startsWith('chrome-extension:')) {
      return null;
    }

    const urlObj = new URL(url);
    const protocol = urlObj.protocol;
    let hostname = urlObj.hostname;

    if (!hostname) return null;

    // Normalize hostname
    hostname = normalizeDomain(hostname);
    if (!hostname) return null;

    return `${protocol}//${hostname}${urlObj.pathname}`;
  } catch (e) {
    return null;
  }
}

/**
 * Check if a domain matches a pattern (supports wildcards)
 * @param {string} domain - The domain to check (should be normalized)
 * @param {string} pattern - The pattern (supports *.example.com)
 * @returns {boolean} True if domain matches pattern
 */
function domainMatchesPattern(domain, pattern) {
  if (!domain || !pattern) return false;

  const normalizedDomain = normalizeDomain(domain);
  const normalizedPattern = normalizeDomain(pattern);

  if (!normalizedDomain || !normalizedPattern) return false;

  // Exact match
  if (normalizedDomain === normalizedPattern) {
    return true;
  }

  // Wildcard match
  if (normalizedPattern.startsWith('*.')) {
    const basePattern = normalizedPattern.substring(2); // Remove '*.'

    // Must be exact subdomain match or parent domain
    return normalizedDomain === basePattern || normalizedDomain.endsWith('.' + basePattern);
  }

  return false;
}

/**
 * Check if a URL matches a prefix pattern
 * @param {string} url - The URL to check
 * @param {string} urlPrefix - The URL prefix pattern
 * @returns {boolean} True if URL starts with prefix
 */
function urlMatchesPrefix(url, urlPrefix) {
  if (!url || !urlPrefix) return false;

  try {
    const fullPath = extractFullUrlPath(url);
    if (!fullPath) return false;

    const prefixNormalized = normalizeURLPrefix(urlPrefix);
    if (!prefixNormalized) return false;

    return fullPath.startsWith(prefixNormalized);
  } catch (e) {
    return false;
  }
}

/**
 * Normalize a URL prefix for matching
 * @param {string} urlPrefix - The URL prefix to normalize
 * @returns {string|null} Normalized URL prefix or null if invalid
 */
function normalizeURLPrefix(urlPrefix) {
  if (!urlPrefix) return null;

  try {
    if (
      urlPrefix.startsWith('about:') ||
      urlPrefix.startsWith('moz-extension:') ||
      urlPrefix.startsWith('chrome-extension:')
    ) {
      return null;
    }

    const urlObj = new URL(urlPrefix);
    let hostname = urlObj.hostname;

    if (!hostname) return null;

    hostname = normalizeDomain(hostname);
    if (!hostname) return null;

    return `${urlObj.protocol}//${hostname}${urlObj.pathname}`;
  } catch (e) {
    return null;
  }
}

// Exports for Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    normalizeDomain,
    extractAndNormalizeHostname,
    extractFullUrlPath,
    domainMatchesPattern,
    urlMatchesPrefix,
    normalizeURLPrefix,
  };
}
