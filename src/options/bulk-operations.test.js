const { assignDomainsToCategory } = require('./bulk-operations');

test('bulk assignment imports normalization without a browser global', async () => {
  expect(global.normalizeDomain).toBeUndefined();
  browser.storage.local.get.mockResolvedValue({
    categories: ['Work'],
    categoryAssignments: { 'existing.com': 'Other' },
  });
  const result = await assignDomainsToCategory(['WWW.Example.COM', 'example.com', ''], 'Work');
  expect(result).toEqual({ success: true, count: 1, category: 'Work' });
  expect(browser.storage.local.set).toHaveBeenCalledWith({
    categoryAssignments: { 'existing.com': 'Other', 'example.com': 'Work' },
  });
});
