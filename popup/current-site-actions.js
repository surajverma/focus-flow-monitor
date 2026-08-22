/* Current-site actions for normal HTTP(S) tabs. */

async function initCurrentSiteActions() {
  const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
  const domain = extractAndNormalizeHostname(tab?.url || '');
  const domainElement = document.getElementById('current-site-domain');
  const categoryElement = document.getElementById('current-site-category');
  const controls = document.getElementById('current-site-controls');
  const status = document.getElementById('current-site-status');
  if (!domainElement || !categoryElement || !controls || !status) return;

  let statusTimer = null;
  const setStatus = (message, timeout = 3000) => {
    if (statusTimer) window.clearTimeout(statusTimer);
    status.textContent = message;
    statusTimer = message
      ? window.setTimeout(() => {
          status.textContent = '';
          statusTimer = null;
        }, timeout)
      : null;
  };

  const addButton = (label, handler, { disabled = false } = {}) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'site-action-button';
    button.textContent = label;
    button.disabled = disabled;

    if (handler) {
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          await handler();
        } catch (error) {
          setStatus(`Could not save: ${error.message}`, 5000);
        } finally {
          button.disabled = false;
        }
      });
    }

    controls.appendChild(button);
  };

  if (!domain) {
    domainElement.textContent = 'Unavailable on this page.';
    categoryElement.textContent = '';
    controls.replaceChildren();
    addButton('Block This Site', null, { disabled: true });
    return;
  }
  domainElement.textContent = domain;

  const isPopupDomainBlock = (rule) =>
    rule?.type === 'block-url' &&
    rule.enabled !== false &&
    !rule.schedule &&
    !rule.startTime &&
    !rule.endTime &&
    !rule.days &&
    (rule.matchMode || 'domain') === 'domain' &&
    normalizeRuleTarget(rule.value, 'domain') === domain;

  const saveRules = async (nextRules, message) => {
    await browser.storage.local.set({ rules: nextRules });
    await browser.runtime.sendMessage({ action: 'rulesUpdated' });
    setStatus(message);
  };

  const renderCategory = (categories, assignments) => {
    const category = resolveCategoryForDomain(domain, assignments, 'Other');
    categoryElement.replaceChildren();

    if (category !== 'Other') {
      const categoryLabel = document.createElement('span');
      categoryLabel.className = 'current-site-category-label';
      categoryLabel.textContent = category;
      categoryLabel.title = `Category: ${category}`;
      categoryElement.appendChild(categoryLabel);
      return;
    }

    const select = document.createElement('select');
    select.className = 'current-site-category-select';
    select.setAttribute('aria-label', `Assign a category to ${domain}`);
    select.appendChild(new Option('Assign category…', '', true, true));
    const assignableCategories = categories.filter((item) => item && item !== 'Other');
    assignableCategories.forEach((item) => select.appendChild(new Option(item, item)));
    select.disabled = assignableCategories.length === 0;
    select.addEventListener('change', async () => {
      if (!select.value) return;
      select.disabled = true;
      try {
        const latest = await browser.storage.local.get('categoryAssignments');
        const nextAssignments = assignDomainToCategory(latest.categoryAssignments || {}, domain, select.value);
        await browser.storage.local.set({ categoryAssignments: nextAssignments });
        await browser.runtime.sendMessage({ action: 'categoriesUpdated' });
        setStatus('Category saved ✓');
        renderCategory(categories, nextAssignments);
      } catch (error) {
        select.disabled = false;
        setStatus(`Could not save: ${error.message}`, 5000);
      }
    });
    categoryElement.appendChild(select);
  };

  const addManageRulesLink = () => {
    const link = document.createElement('a');
    link.className = 'manage-rules-link';
    link.href = browser.runtime.getURL('options/options.html#blocking-section');
    link.textContent = 'Manage rules';
    link.title = 'Open Site Blocking & Time Limiting';
    link.addEventListener('click', (event) => {
      event.preventDefault();
      browser.tabs.create({ url: link.href });
    });
    controls.appendChild(link);
  };

  const renderAction = async () => {
    const result = await browser.storage.local.get(['rules', 'categories', 'categoryAssignments']);
    const rules = Array.isArray(result.rules) ? result.rules : [];
    const isBlocked = rules.some(isPopupDomainBlock);
    renderCategory(Array.isArray(result.categories) ? result.categories : [], result.categoryAssignments || {});
    controls.replaceChildren();

    if (isBlocked) {
      addButton('Unblock This Site', async () => {
        const latest = await browser.storage.local.get('rules');
        const nextRules = (Array.isArray(latest.rules) ? latest.rules : []).filter((rule) => !isPopupDomainBlock(rule));
        await saveRules(nextRules, 'Unblocked ✓');
        await renderAction();
      });
      addManageRulesLink();
    } else {
      addButton('Block This Site', async () => {
        const latest = await browser.storage.local.get('rules');
        const currentRules = Array.isArray(latest.rules) ? latest.rules : [];
        const rule = {
          id: `rule_${Date.now()}`,
          type: 'block-url',
          value: domain,
          matchMode: 'domain',
          enabled: true,
          exceptions: [],
          source: 'popup',
        };
        await saveRules([...currentRules, rule], 'Blocked ✓');
        await renderAction();
      });
    }
  };

  await renderAction();
}

document.addEventListener('DOMContentLoaded', () => initCurrentSiteActions().catch(() => {}));
