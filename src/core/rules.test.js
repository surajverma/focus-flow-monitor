const { evaluateRules, normalizeCandidateUrl, ruleMatchesUrl } = require('./rules');

describe('shared rule evaluator', () => {
  test('normalizes a bare domain for testing', () => {
    expect(normalizeCandidateUrl('Example.com/path').toString()).toBe('https://example.com/path');
  });

  test('rejects non-web URL schemes', () => {
    expect(normalizeCandidateUrl('ftp://example.com/file')).toBeNull();
  });

  test('matches domains without matching similar domains', () => {
    expect(ruleMatchesUrl({ value: 'example.com', matchMode: 'domain' }, 'https://www.example.com/a')).toBe(true);
    expect(ruleMatchesUrl({ value: 'example.com', matchMode: 'domain' }, 'https://notexample.com/a')).toBe(false);
  });

  test('supports exact URL and URL prefix modes', () => {
    expect(
      ruleMatchesUrl(
        { value: 'https://docs.example.com/file', matchMode: 'exact-url' },
        'https://docs.example.com/file'
      )
    ).toBe(true);
    expect(
      ruleMatchesUrl(
        { value: 'https://docs.example.com/file', matchMode: 'exact-url' },
        'https://docs.example.com/file/other'
      )
    ).toBe(false);
    expect(
      ruleMatchesUrl({ value: 'https://example.com/path', matchMode: 'url-prefix' }, 'https://example.com/path/child')
    ).toBe(true);
  });

  test('exception takes precedence over a broad block', () => {
    const result = evaluateRules(
      [
        {
          id: 'block',
          type: 'block-url',
          value: 'reddit.com',
          matchMode: 'domain-subdomains',
          exceptions: [{ value: 'https://www.reddit.com/r/learn', matchMode: 'url-prefix' }],
        },
      ],
      'https://www.reddit.com/r/learn/javascript'
    );
    expect(result.blocked).toBe(false);
    expect(result.exception).toBeTruthy();
  });

  test('returns the most specific block and matching limits', () => {
    const result = evaluateRules(
      [
        { id: 'broad', type: 'block-url', value: 'example.com', matchMode: 'domain-subdomains' },
        { id: 'specific', type: 'block-url', value: 'https://example.com/shorts', matchMode: 'url-prefix' },
        {
          id: 'limit',
          type: 'limit-url',
          value: 'example.com',
          matchMode: 'domain-subdomains',
          period: 'week',
          limitSeconds: 3600,
        },
      ],
      'https://example.com/shorts/today'
    );
    expect(result.blockingRule.id).toBe('specific');
    expect(result.limitRules).toHaveLength(1);
  });
});
