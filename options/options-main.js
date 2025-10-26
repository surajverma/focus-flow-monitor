/**
 * Clears an element and appends a new list item with the given text message.
 * @param {HTMLElement} element - The UL or OL element to update.
 * @param {string} message - The text message to display in the list item.
 * @param {object} [options] - Optional styling for the list item.
 * @param {string} [options.textAlign='center'] - Text alignment for the list item.
 * @param {string} [options.color='var(--text-color-muted)'] - Text color for the list item.
 */
function setListMessage(element, message, options = {}) {
  if (!element) return;
  element.innerHTML = ''; // Clear previous content
  const li = document.createElement('li');
  li.textContent = message;
  li.style.textAlign = options.textAlign || 'center';
  li.style.color = options.color || 'var(--text-color-muted)';
  element.appendChild(li);
}

let isChartRenderPending = false;
let pendingChartData = null;
let pendingChartLabel = '';
let pendingChartViewMode = 'domain';

// Removed global isInitialPageLoad flag

function setupTabs() {
  const tabLinks = document.querySelectorAll('.tab-nav .tab-link');
  const tabContents = document.querySelectorAll('.tabs-container .tab-content');

  tabLinks.forEach((link) => {
    link.addEventListener('click', () => {
      const targetTab = link.dataset.tab;

      tabLinks.forEach((l) => l.classList.remove('active'));
      link.classList.add('active');

      tabContents.forEach((content) => {
        if (content.id === targetTab) {
          content.classList.add('active');
          if (targetTab === 'dashboardTab' && isChartRenderPending) {
            console.log('[Tabs] Dashboard tab activated, rendering pending chart.');
            if (typeof renderChart === 'function' && pendingChartData) {
              renderChart(pendingChartData, pendingChartLabel, pendingChartViewMode);
            } else if (typeof clearChartOnError === 'function') {
              clearChartOnError(
                pendingChartLabel ? `No significant data for ${pendingChartLabel}` : 'Chart data unavailable'
              );
            }
            isChartRenderPending = false;
            pendingChartData = null;
          }
        } else {
          content.classList.remove('active');
        }
      });
      if (browser && browser.storage && browser.storage.local) {
        browser.storage.local.set({ optionsActiveTab: targetTab }).catch((err) => {
          console.warn('Error saving active tab state:', err);
        });
      }
    });
  });
}

async function restoreActiveTab() {
  if (browser && browser.storage && browser.storage.local) {
    try {
      const result = await browser.storage.local.get('optionsActiveTab');
      const activeTabId = result.optionsActiveTab;
      if (activeTabId) {
        const tabToActivate = document.querySelector(`.tab-nav .tab-link[data-tab="${activeTabId}"]`);
        if (tabToActivate) {
          tabToActivate.click();
          console.log(`[Tabs] Restored active tab to: ${activeTabId}`);
        }
      }
    } catch (err) {
      console.warn('Error restoring active tab state:', err);
    }
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Options Main] DOMContentLoaded');
  if (!queryUIElements()) {
    console.error('Failed to initialize UI elements. Aborting setup.');
    const container = document.querySelector('.container');
    if (container) {
      container.innerHTML = '';
      const p = document.createElement('p');
      p.textContent = 'Error: Could not load page elements. Please try refreshing.';
      p.style.color = 'red';
      p.style.textAlign = 'center';
      p.style.padding = '20px';
      container.appendChild(p);
    }
    return;
  }

  setupTabs();

  try {
    const defaultChartView = AppState.currentChartViewMode || 'domain';
    const radioToCheck = document.querySelector(`input[name="chartView"][value="${defaultChartView}"]`);
    if (radioToCheck) {
      radioToCheck.checked = true;
    } else {
      const fallback = document.querySelector('input[name="chartView"][value="domain"]');
      if (fallback) fallback.checked = true;
    }
  } catch (e) {
    console.error('Error setting initial chart view radio button:', e);
  }

  await loadAllData(); // This will call updateDisplayForSelectedRangeUI(true)
  setupEventListeners();

  if (browser.storage && browser.storage.onChanged) {
    browser.storage.onChanged.addListener(handlePomodoroSettingsStorageChange);
    console.log('[Options Main] Storage change listener for Pomodoro settings registered.');
  }

  await restoreActiveTab();

  // No longer need to set isInitialPageLoad here.
  // The context is passed directly.

  if (window.location.hash) {
    const sectionId = window.location.hash.substring(1);
    const sectionElement = document.getElementById(sectionId);

    if (sectionElement) {
      const parentTabContent = sectionElement.closest('.tab-content');
      if (parentTabContent && !parentTabContent.classList.contains('active')) {
        const tabLink = document.querySelector(`.tab-nav .tab-link[data-tab="${parentTabContent.id}"]`);
        if (tabLink) {
          tabLink.click();
        }
      }

      setTimeout(() => {
        console.log(`[Options Main] Scrolling to section via hash: ${sectionId}`);
        sectionElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const originalBg = sectionElement.style.backgroundColor;
        sectionElement.style.transition = 'background-color 0.9s ease-in-out';
        sectionElement.style.backgroundColor = 'rgba(255, 255, 0, 0.2)';
        setTimeout(() => {
          sectionElement.style.backgroundColor = originalBg;
          sectionElement.style.transition = '';
        }, 2000);
      }, 100); // Delay slightly to ensure tab switch and rendering completes
    } else {
      console.warn(`[Options Main] Section ID "${sectionId}" not found for scrolling.`);
    }
  }
  console.log('Options Main script initialized (v0.9.0 - Pomodoro settings & stats).');
});

function handlePomodoroSettingsStorageChange(changes, area) {
  if (area === 'local' && changes[STORAGE_KEY_POMODORO_SETTINGS]) {
    const newStorageValue = changes[STORAGE_KEY_POMODORO_SETTINGS].newValue;

    if (newStorageValue) {
      if (newStorageValue.durations && typeof populatePomodoroSettingsInputs === 'function') {
        populatePomodoroSettingsInputs(newStorageValue);
        console.log('[Options Main] Pomodoro settings UI repopulated due to storage change.');
      }
      if (newStorageValue.notifyEnabled !== undefined) {
        const newNotifyState = newStorageValue.notifyEnabled;
        console.log(`[Options Page] Storage change detected for pomodoro notifyEnabled: ${newNotifyState}`);
        if (AppState.pomodoroNotifyEnabled !== newNotifyState) {
          AppState.pomodoroNotifyEnabled = newNotifyState;
        }
        if (
          UIElements.pomodoroEnableNotificationsCheckbox &&
          UIElements.pomodoroEnableNotificationsCheckbox.checked !== newNotifyState
        ) {
          UIElements.pomodoroEnableNotificationsCheckbox.checked = newNotifyState;
          console.log(`[Options Page] pomodoroEnableNotificationsCheckbox UI updated to: ${newNotifyState}`);
        }
        if (typeof updatePomodoroPermissionStatusDisplay === 'function') {
          updatePomodoroPermissionStatusDisplay();
        }
      }
    }
  }
}

async function loadAllData() {
  console.log('[Options Main] loadAllData starting...');
  const keysToLoad = [
    'trackedData',
    'categoryTimeData',
    'categories',
    'categoryAssignments',
    'rules',
    'dailyDomainData',
    'dailyCategoryData',
    'hourlyData',
    STORAGE_KEY_IDLE_THRESHOLD,
    STORAGE_KEY_DATA_RETENTION_DAYS,
    STORAGE_KEY_PRODUCTIVITY_RATINGS,
    STORAGE_KEY_BLOCK_PAGE_CUSTOM_HEADING,
    STORAGE_KEY_BLOCK_PAGE_CUSTOM_MESSAGE,
    STORAGE_KEY_BLOCK_PAGE_CUSTOM_BUTTON_TEXT,
    STORAGE_KEY_BLOCK_PAGE_SHOW_URL,
    STORAGE_KEY_BLOCK_PAGE_SHOW_REASON,
    STORAGE_KEY_BLOCK_PAGE_SHOW_RULE,
    STORAGE_KEY_BLOCK_PAGE_SHOW_LIMIT_INFO,
    STORAGE_KEY_BLOCK_PAGE_SHOW_SCHEDULE_INFO,
    STORAGE_KEY_BLOCK_PAGE_SHOW_QUOTE,
    STORAGE_KEY_BLOCK_PAGE_USER_QUOTES,
    STORAGE_KEY_POMODORO_SETTINGS,
    STORAGE_KEY_POMODORO_STATS_DAILY,
    STORAGE_KEY_POMODORO_STATS_ALL_TIME,
  ];

  try {
    const result = await browser.storage.local.get(keysToLoad);
    console.log('[Options Main] Data loaded from storage:', result);

    AppState.trackedData = result.trackedData || {};
    AppState.categoryTimeData = result.categoryTimeData || {};
    AppState.dailyDomainData = result.dailyDomainData || {};
    AppState.dailyCategoryData = result.dailyCategoryData || {};
    AppState.hourlyData = result.hourlyData || {};
    AppState.categories = result.categories || ['Other'];
    AppState.categoryProductivityRatings = result[STORAGE_KEY_PRODUCTIVITY_RATINGS] || {};

    if (!AppState.categories.includes('Other')) {
      AppState.categories.push('Other');
    }

    AppState.categoryAssignments = result.categoryAssignments || {};
    AppState.rules = result.rules || [];

    const savedIdleThreshold = result[STORAGE_KEY_IDLE_THRESHOLD];
    if (UIElements.idleThresholdSelect) {
      UIElements.idleThresholdSelect.value =
        savedIdleThreshold !== undefined && savedIdleThreshold !== null ? savedIdleThreshold : DEFAULT_IDLE_SECONDS;
    }

    const savedRetentionDays = result[STORAGE_KEY_DATA_RETENTION_DAYS];
    if (UIElements.dataRetentionSelect) {
      UIElements.dataRetentionSelect.value =
        savedRetentionDays !== undefined && savedRetentionDays !== null
          ? savedRetentionDays
          : DEFAULT_DATA_RETENTION_DAYS;
    }

    AppState.blockPageCustomHeading = result[STORAGE_KEY_BLOCK_PAGE_CUSTOM_HEADING] || '';
    AppState.blockPageCustomMessage = result[STORAGE_KEY_BLOCK_PAGE_CUSTOM_MESSAGE] || '';
    AppState.blockPageCustomButtonText = result[STORAGE_KEY_BLOCK_PAGE_CUSTOM_BUTTON_TEXT] || '';
    AppState.blockPageShowUrl =
      result[STORAGE_KEY_BLOCK_PAGE_SHOW_URL] !== undefined ? result[STORAGE_KEY_BLOCK_PAGE_SHOW_URL] : true;
    AppState.blockPageShowReason =
      result[STORAGE_KEY_BLOCK_PAGE_SHOW_REASON] !== undefined ? result[STORAGE_KEY_BLOCK_PAGE_SHOW_REASON] : true;
    AppState.blockPageShowRule =
      result[STORAGE_KEY_BLOCK_PAGE_SHOW_RULE] !== undefined ? result[STORAGE_KEY_BLOCK_PAGE_SHOW_RULE] : true;
    AppState.blockPageShowLimitInfo =
      result[STORAGE_KEY_BLOCK_PAGE_SHOW_LIMIT_INFO] !== undefined
        ? result[STORAGE_KEY_BLOCK_PAGE_SHOW_LIMIT_INFO]
        : true;
    AppState.blockPageShowScheduleInfo =
      result[STORAGE_KEY_BLOCK_PAGE_SHOW_SCHEDULE_INFO] !== undefined
        ? result[STORAGE_KEY_BLOCK_PAGE_SHOW_SCHEDULE_INFO]
        : true;
    AppState.blockPageShowQuote = result[STORAGE_KEY_BLOCK_PAGE_SHOW_QUOTE] || false;
    AppState.blockPageUserQuotes = Array.isArray(result[STORAGE_KEY_BLOCK_PAGE_USER_QUOTES])
      ? result[STORAGE_KEY_BLOCK_PAGE_USER_QUOTES]
      : [];

    if (UIElements.blockPageCustomHeadingInput)
      UIElements.blockPageCustomHeadingInput.value = AppState.blockPageCustomHeading;
    if (UIElements.blockPageCustomMessageTextarea)
      UIElements.blockPageCustomMessageTextarea.value = AppState.blockPageCustomMessage;
    if (UIElements.blockPageCustomButtonTextInput)
      UIElements.blockPageCustomButtonTextInput.value = AppState.blockPageCustomButtonText;
    if (UIElements.blockPageShowUrlCheckbox) UIElements.blockPageShowUrlCheckbox.checked = AppState.blockPageShowUrl;
    if (UIElements.blockPageShowReasonCheckbox)
      UIElements.blockPageShowReasonCheckbox.checked = AppState.blockPageShowReason;
    if (UIElements.blockPageShowRuleCheckbox) UIElements.blockPageShowRuleCheckbox.checked = AppState.blockPageShowRule;
    if (UIElements.blockPageShowLimitInfoCheckbox)
      UIElements.blockPageShowLimitInfoCheckbox.checked = AppState.blockPageShowLimitInfo;
    if (UIElements.blockPageShowScheduleInfoCheckbox)
      UIElements.blockPageShowScheduleInfoCheckbox.checked = AppState.blockPageShowScheduleInfo;
    if (UIElements.blockPageShowQuoteCheckbox) {
      UIElements.blockPageShowQuoteCheckbox.checked = AppState.blockPageShowQuote;
      if (UIElements.blockPageUserQuotesContainer) {
        UIElements.blockPageUserQuotesContainer.style.display = AppState.blockPageShowQuote ? 'block' : 'none';
      }
    }
    if (UIElements.blockPageUserQuotesTextarea)
      UIElements.blockPageUserQuotesTextarea.value = AppState.blockPageUserQuotes.join('\n');

    const pomodoroSettingsStorage = result[STORAGE_KEY_POMODORO_SETTINGS] || {};
    const defaultPomodoroDurations = {
      Work: 25 * 60,
      'Short Break': 5 * 60,
      'Long Break': 15 * 60,
    };
    const defaultSessions = 4;

    const currentDurations = pomodoroSettingsStorage.durations || defaultPomodoroDurations;
    const currentSessions =
      pomodoroSettingsStorage.sessionsBeforeLongBreak === undefined
        ? defaultSessions
        : pomodoroSettingsStorage.sessionsBeforeLongBreak;
    AppState.pomodoroNotifyEnabled =
      pomodoroSettingsStorage.notifyEnabled !== undefined ? pomodoroSettingsStorage.notifyEnabled : true;

    if (typeof populatePomodoroSettingsInputs === 'function') {
      populatePomodoroSettingsInputs({
        durations: currentDurations,
        sessionsBeforeLongBreak: currentSessions,
      });
    }

    if (UIElements.pomodoroEnableNotificationsCheckbox) {
      UIElements.pomodoroEnableNotificationsCheckbox.checked = AppState.pomodoroNotifyEnabled;
    }
    await updatePomodoroPermissionStatusDisplay();

    // Populate Pomodoro Work blocking settings
    const blockDuringWorkEnabled = !!pomodoroSettingsStorage.blockDuringWorkEnabled;
    const blockedCats = Array.isArray(pomodoroSettingsStorage.blockedCategoriesDuringWork)
      ? pomodoroSettingsStorage.blockedCategoriesDuringWork
      : [];
    if (UIElements.pomodoroBlockDuringWorkCheckbox) {
      UIElements.pomodoroBlockDuringWorkCheckbox.checked = blockDuringWorkEnabled;
    }
    if (UIElements.pomodoroBlockedCategoriesSelect) {
      UIElements.pomodoroBlockedCategoriesSelect.replaceChildren();
      const selectableCategories = (AppState.categories || []).filter((c) => c && c !== 'Other');
      selectableCategories.forEach((cat) => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        if (blockedCats.includes(cat)) opt.selected = true;
        UIElements.pomodoroBlockedCategoriesSelect.appendChild(opt);
      });
      // If previously saved categories are no longer present, keep them visible as disabled
      blockedCats
        .filter((c) => !selectableCategories.includes(c))
        .forEach((missing) => {
          const opt = document.createElement('option');
          opt.value = missing;
          opt.textContent = `${missing} (missing)`;
          opt.selected = true;
          opt.disabled = true;
          UIElements.pomodoroBlockedCategoriesSelect.appendChild(opt);
        });
    }

    AppState.allPomodoroDailyStats = result[STORAGE_KEY_POMODORO_STATS_DAILY] || {};

    const pomodoroAllTimeStatsStorage = result[STORAGE_KEY_POMODORO_STATS_ALL_TIME];
    if (pomodoroAllTimeStatsStorage) {
      AppState.pomodoroStatsAllTime.totalWorkSessionsCompleted =
        pomodoroAllTimeStatsStorage.totalWorkSessionsCompleted || 0;
      AppState.pomodoroStatsAllTime.totalTimeFocused = pomodoroAllTimeStatsStorage.totalTimeFocused || 0;
    } else {
      AppState.pomodoroStatsAllTime = { sessionsCompleted: 0, timeFocused: 0 };
    }

    if (typeof populateCategoryList === 'function') populateCategoryList();
    if (typeof populateCategorySelect === 'function') populateCategorySelect();
    if (typeof populateRuleCategorySelect === 'function') populateRuleCategorySelect();
    if (typeof populateAssignmentList === 'function') populateAssignmentList();
    if (typeof populateRuleList === 'function') populateRuleList();
    if (typeof populateProductivitySettings === 'function') populateProductivitySettings();
    if (typeof renderCalendar === 'function')
      renderCalendar(AppState.calendarDate.getFullYear(), AppState.calendarDate.getMonth());

    if (typeof updateDisplayForSelectedRangeUI === 'function') {
      updateDisplayForSelectedRangeUI(true); // Pass true for initial load
    }

    if (typeof highlightSelectedCalendarDay === 'function') highlightSelectedCalendarDay(AppState.selectedDateStr);
  } catch (error) {
    console.error('[Options Main] Error during data processing/UI update after loading from storage!', error);
    const errorMessage = 'Error loading data. Please try refreshing.';
    setListMessage(UIElements.categoryTimeList, errorMessage);
    setListMessage(UIElements.detailedTimeList, errorMessage);
    if (typeof clearChartOnError === 'function') clearChartOnError('Error processing data');
    if (typeof displayPomodoroStats === 'function') displayPomodoroStats('Error', true);
  }
}

async function updatePomodoroPermissionStatusDisplay() {
  if (!UIElements.pomodoroNotificationPermissionStatus) {
    console.warn('[Options Main] pomodoroNotificationPermissionStatus element not found.');
    return;
  }
  try {
    const hasPermission = await browser.permissions.contains({ permissions: ['notifications'] });
    if (hasPermission) {
      UIElements.pomodoroNotificationPermissionStatus.textContent = '(Permission: Granted)';
      UIElements.pomodoroNotificationPermissionStatus.className = 'permission-status-text granted';
    } else {
      UIElements.pomodoroNotificationPermissionStatus.textContent = '(Permission: Not Granted)';
      UIElements.pomodoroNotificationPermissionStatus.className = 'permission-status-text denied';
    }
  } catch (err) {
    console.error('Error checking notification permissions:', err);
    UIElements.pomodoroNotificationPermissionStatus.textContent = '(Permission: Status Unknown)';
    UIElements.pomodoroNotificationPermissionStatus.className = 'permission-status-text';
  }
}

function updateDisplayForSelectedRangeUI(isDuringInitialLoad = false) {
  // Added parameter
  if (!UIElements.dateRangeSelect) {
    console.warn('Date range select element not found for UI update.');
    return;
  }
  let selectedRangeValue = UIElements.dateRangeSelect.value;
  const loader = document.getElementById('statsLoader');
  const dashboard = document.querySelector('.stats-dashboard');

  let dataFetchKey = selectedRangeValue;
  let displayLabelKey = selectedRangeValue;
  let isRangeView = ['week', 'month', 'all'].includes(selectedRangeValue);

  if (selectedRangeValue === '' && AppState.selectedDateStr) {
    dataFetchKey = AppState.selectedDateStr;
    displayLabelKey =
      typeof formatDisplayDate === 'function' ? formatDisplayDate(AppState.selectedDateStr) : AppState.selectedDateStr;
    isRangeView = false;
  } else if (selectedRangeValue === '') {
    dataFetchKey = 'today';
    displayLabelKey = 'Today';
    if (UIElements.dateRangeSelect) UIElements.dateRangeSelect.value = 'today';
    isRangeView = false;
  }

  const showLoader = ['week', 'month', 'all'].includes(dataFetchKey);

  if (showLoader && loader) {
    loader.style.display = 'block';
    if (dashboard) dashboard.style.visibility = 'hidden';
  } else if (loader) {
    loader.style.display = 'none';
  }

  AppState.currentBreakdownIdentifier = null;
  if (UIElements.breakdownCategorySelect) UIElements.breakdownCategorySelect.value = '';

  setTimeout(() => {
    let domainData = {},
      categoryData = {},
      label = `Error (${displayLabelKey || dataFetchKey})`;
    try {
      const isSpecificDateFetch = /^\d{4}-\d{2}-\d{2}$/.test(dataFetchKey);
      const rangeData = getFilteredDataForRange(dataFetchKey, isSpecificDateFetch);
      domainData = rangeData.domainData;
      categoryData = rangeData.categoryData;
      label = isSpecificDateFetch ? displayLabelKey : rangeData.label;

      if (dataFetchKey === 'today' && !isSpecificDateFetch) {
        AppState.selectedDateStr =
          typeof getCurrentDateString === 'function' ? getCurrentDateString() : new Date().toISOString().split('T')[0];
        if (typeof highlightSelectedCalendarDay === 'function') highlightSelectedCalendarDay(AppState.selectedDateStr);
      }
  updateStatsDisplay(domainData, categoryData, label, AppState.selectedDateStr, isRangeView);
  // Update insights banner with current stats
  updateInsightsBanner(label, domainData, categoryData);

      const noDataForPeriod =
        Object.keys(domainData).length === 0 && Object.keys(categoryData).length === 0 && !isRangeView;
      if (typeof displayPomodoroStats === 'function') {
        displayPomodoroStats(label, noDataForPeriod);
      }

      if (typeof updateItemDetailDisplay === 'function') {
        console.log('[Options Main] Calling updateItemDetailDisplay after main stats update.');
        updateItemDetailDisplay(isDuringInitialLoad); // Pass the flag here
      }
    } catch (e) {
      console.error(`Error processing range ${dataFetchKey}:`, e);
  updateStatsDisplay({}, {}, label, AppState.selectedDateStr, isRangeView);
  updateInsightsBanner(label, {}, {});
      if (typeof displayPomodoroStats === 'function') {
        displayPomodoroStats(label, true);
      }
      if (typeof updateItemDetailDisplay === 'function') {
        console.log('[Options Main] Calling updateItemDetailDisplay after error in main stats.');
        AppState.currentBreakdownIdentifier = null;
        if (UIElements.breakdownCategorySelect) UIElements.breakdownCategorySelect.value = '';
        updateItemDetailDisplay(isDuringInitialLoad); // Pass the flag here
      }
    } finally {
      if (loader) loader.style.display = 'none';
      if (dashboard) dashboard.style.visibility = 'visible';
    }
  }, 10);
}

function updateDomainDisplayAndPagination() {
  if (
    !UIElements.detailedTimeList ||
    !UIElements.domainPaginationDiv ||
    !UIElements.domainPrevBtn ||
    !UIElements.domainNextBtn ||
    !UIElements.domainPageInfo
  ) {
    console.warn('Pagination or detailed list elements not found for domain display.');
    return;
  }
  const totalItems = AppState.fullDomainDataSorted.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / AppState.domainItemsPerPage));
  AppState.domainCurrentPage = Math.max(1, Math.min(AppState.domainCurrentPage, totalPages));

  const startIndex = (AppState.domainCurrentPage - 1) * AppState.domainItemsPerPage;
  const endIndex = startIndex + AppState.domainItemsPerPage;
  const itemsToShow = AppState.fullDomainDataSorted.slice(startIndex, endIndex);

  if (typeof displayDomainTime === 'function') displayDomainTime(itemsToShow);

  UIElements.domainPageInfo.textContent = `Page ${AppState.domainCurrentPage} of ${totalPages}`;
  UIElements.domainPrevBtn.disabled = AppState.domainCurrentPage <= 1;
  UIElements.domainNextBtn.disabled = AppState.domainCurrentPage >= totalPages;
  UIElements.domainPaginationDiv.style.display = totalPages > 1 ? 'flex' : 'none';
}

function updateStatsDisplay(
  domainData,
  categoryData,
  label,
  chartDateStr = AppState.selectedDateStr,
  isRangeView = false
) {
  try {
    console.log(
      `[Options Main] updateStatsDisplay called for label: ${label}, chartDateStr for chart: ${chartDateStr}, isRangeView: ${isRangeView}`
    );

    const currentDomainData = domainData || {};
    const currentCategoryData = categoryData || {};

    if (UIElements.statsPeriodSpans) {
      UIElements.statsPeriodSpans.forEach((span) => (span.textContent = label));
    }

    AppState.fullDomainDataSorted = Object.entries(currentDomainData)
      .map(([d, t]) => ({ domain: d, time: t }))
      .sort((a, b) => b.time - a.time);
    AppState.domainCurrentPage = 1;
    updateDomainDisplayAndPagination();

    if (typeof displayCategoryTime === 'function') displayCategoryTime(currentCategoryData);

    try {
      const scoreData =
        typeof calculateFocusScore === 'function'
          ? calculateFocusScore(currentCategoryData, AppState.categoryProductivityRatings)
          : { score: 0 };
      if (typeof displayProductivityScore === 'function') displayProductivityScore(scoreData, label);
    } catch (scoreError) {
      console.error(`[Options Main] Error calculating focus score for label "${label}":`, scoreError);
      if (typeof displayProductivityScore === 'function') displayProductivityScore(null, label, true);
    }

    if (
      UIElements.totalTimeForRangeContainer &&
      UIElements.totalTimeForRangeLabel &&
      UIElements.totalTimeForRangeValue &&
      UIElements.averageTimeForRange
    ) {
      if (isRangeView) {
        let totalSecondsForRange = 0;
        for (const domain in currentDomainData) {
          totalSecondsForRange += currentDomainData[domain];
        }
        UIElements.totalTimeForRangeValue.textContent =
          typeof formatTime === 'function' ? formatTime(totalSecondsForRange, true) : totalSecondsForRange + 's';
        let numberOfDaysInRange = 0;
        let averageTimeText;
        const selectedRangeValue = UIElements.dateRangeSelect ? UIElements.dateRangeSelect.value : '';
        if (selectedRangeValue === 'week') {
          numberOfDaysInRange = 7;
        } else if (selectedRangeValue === 'month') {
          const today = new Date();
          numberOfDaysInRange = today.getDate();
        } else if (selectedRangeValue === 'all') {
          numberOfDaysInRange = Object.keys(AppState.dailyDomainData).length;
        }
        const daySuffix = (n) => (n === 1 ? 'day' : 'days');
        if (numberOfDaysInRange > 0) {
          let avgSecondsPerDay;
          let formattedDisplayTime;
          if (totalSecondsForRange === 0) {
            formattedDisplayTime = typeof formatTime === 'function' ? formatTime(0, true) : '0s';
          } else {
            avgSecondsPerDay = totalSecondsForRange / numberOfDaysInRange;
            formattedDisplayTime =
              typeof formatTime === 'function' ? formatTime(avgSecondsPerDay, true) : `${avgSecondsPerDay.toFixed(0)}s`;
          }
          averageTimeText = `On average, you spent ${formattedDisplayTime}/day for ${numberOfDaysInRange} ${daySuffix(
            numberOfDaysInRange
          )}.`;
        } else {
          if (totalSecondsForRange === 0) {
            const formattedZeroTime = typeof formatTime === 'function' ? formatTime(0, true) : '0s';
            averageTimeText = `Avg: ${formattedZeroTime}/day (period N/A)`;
          } else {
            averageTimeText = `Avg: N/A / day (period unknown)`;
          }
        }
        UIElements.averageTimeForRange.textContent = averageTimeText;

        const periodSpanInTotalLabel = UIElements.totalTimeForRangeLabel.querySelector('.stats-period');
        if (periodSpanInTotalLabel) {
          periodSpanInTotalLabel.textContent = label;
        } else {
          UIElements.totalTimeForRangeLabel.textContent = `Total Time Online (${label})`;
        }
        UIElements.totalTimeForRangeContainer.style.display = 'block';
      } else {
        UIElements.totalTimeForRangeContainer.style.display = 'none';
      }
    }

    const chartDataView = AppState.currentChartViewMode === 'domain' ? currentDomainData : currentCategoryData;
    const chartLabelForRender = label;
    const hasSignificantData = Object.values(chartDataView).some((time) => time > 0.1);

    const dashboardTab = document.getElementById('dashboardTab');
    if (dashboardTab && dashboardTab.classList.contains('active')) {
      if (hasSignificantData) {
        if (typeof renderChart === 'function')
          renderChart(chartDataView, chartLabelForRender, AppState.currentChartViewMode);
      } else {
        if (typeof clearChartOnError === 'function')
          clearChartOnError(`No significant data for ${chartLabelForRender}`);
      }
      isChartRenderPending = false;
    } else if (hasSignificantData || Object.keys(chartDataView).length > 0) {
      console.log('[Tabs] Dashboard tab inactive, chart render is pending.');
      isChartRenderPending = true;
      pendingChartData = chartDataView;
      pendingChartLabel = chartLabelForRender;
      pendingChartViewMode = AppState.currentChartViewMode;
      if (typeof clearChartOnError === 'function') clearChartOnError('Loading chart data...');
    } else {
      if (typeof clearChartOnError === 'function') clearChartOnError(`No data for ${chartLabelForRender}`);
      isChartRenderPending = false;
    }

    if (UIElements.chartTitleElement) {
      UIElements.chartTitleElement.textContent = `Usage Chart (${chartLabelForRender})`;
    }
  } catch (error) {
    console.error(`[Options Main] Error during updateStatsDisplay for label "${label}":`, error);
    if (typeof displayCategoryTime === 'function') displayCategoryTime({});
    AppState.fullDomainDataSorted = [];
    updateDomainDisplayAndPagination();
    if (typeof displayProductivityScore === 'function') displayProductivityScore(null, label, true);
    if (typeof clearChartOnError === 'function') clearChartOnError(`Error loading data for ${label}`);
    if (UIElements.chartTitleElement) {
      UIElements.chartTitleElement.textContent = `Usage Chart (Error)`;
    }
    if (UIElements.totalTimeForRangeContainer) {
      UIElements.totalTimeForRangeContainer.style.display = 'none';
    }
  }
}

function displayNoDataForDate(displayDateLabel) {
  console.log(`[Options Main] Displaying 'No Data' state for: ${displayDateLabel}`);
  const noDataMessage = `No data recorded for ${displayDateLabel}.`;
  if (UIElements.statsPeriodSpans) UIElements.statsPeriodSpans.forEach((span) => (span.textContent = displayDateLabel));
  setListMessage(UIElements.categoryTimeList, noDataMessage);
  setListMessage(UIElements.detailedTimeList, noDataMessage);
  if (UIElements.domainPaginationDiv) UIElements.domainPaginationDiv.style.display = 'none';
  AppState.fullDomainDataSorted = [];
  if (UIElements.productivityScoreLabel)
    UIElements.productivityScoreLabel.textContent = `Focus Score (${displayDateLabel})`;
  if (UIElements.productivityScoreValue) {
    UIElements.productivityScoreValue.textContent = 'N/A';
    UIElements.productivityScoreValue.className = 'score-value';
  }
  if (typeof clearChartOnError === 'function') clearChartOnError(noDataMessage);
  if (UIElements.chartTitleElement) UIElements.chartTitleElement.textContent = `Usage Chart (${displayDateLabel})`;
  if (UIElements.totalTimeForRangeContainer) UIElements.totalTimeForRangeContainer.style.display = 'none';

  if (typeof displayPomodoroStats === 'function') {
    console.log(
      `[DEBUG Main] Calling displayPomodoroStats from displayNoDataForDate. displayDateLabel: "${displayDateLabel}", noDataForMainStats: true`
    );
    displayPomodoroStats(displayDateLabel, true);
  }
}

function renderChartForSelectedDateUI() {
  if (!AppState.selectedDateStr) {
    if (typeof clearChartOnError === 'function') clearChartOnError('Select a date from the calendar.');
    return;
  }
  const data =
    AppState.currentChartViewMode === 'domain'
      ? AppState.dailyDomainData[AppState.selectedDateStr] || {}
      : AppState.dailyCategoryData[AppState.selectedDateStr] || {};

  const displayDate =
    typeof formatDisplayDate === 'function' ? formatDisplayDate(AppState.selectedDateStr) : AppState.selectedDateStr;

  const dashboardTab = document.getElementById('dashboardTab');
  if (dashboardTab && dashboardTab.classList.contains('active')) {
    if (typeof renderChart === 'function') renderChart(data, displayDate, AppState.currentChartViewMode);
    isChartRenderPending = false;
  } else if (Object.keys(data).length > 0) {
    console.log('[Tabs] Dashboard tab inactive during renderChartForSelectedDateUI, chart render is pending.');
    isChartRenderPending = true;
    pendingChartData = data;
    pendingChartLabel = displayDate;
    pendingChartViewMode = AppState.currentChartViewMode;
    if (typeof clearChartOnError === 'function') clearChartOnError('Loading chart data...');
  } else {
    if (typeof clearChartOnError === 'function') clearChartOnError(`No data for ${displayDate}`);
    isChartRenderPending = false;
  }

  if (UIElements.chartTitleElement) {
    UIElements.chartTitleElement.textContent = `Usage Chart (${displayDate})`;
  }
}

function getFilteredDataForRange(range, isSpecificDate = false) {
  let initialDomainData = {};
  let initialCategoryData = {};
  let mergedDomainData = {};
  let periodLabel = 'All Time';
  const today = new Date();

  try {
    if (isSpecificDate && /^\d{4}-\d{2}-\d{2}$/.test(range)) {
      initialDomainData = AppState.dailyDomainData[range] || {};
      initialCategoryData = AppState.dailyCategoryData[range] || {};
      periodLabel = typeof formatDisplayDate === 'function' ? formatDisplayDate(range) : range;
    } else if (range === 'today') {
      const todayStr = typeof formatDate === 'function' ? formatDate(today) : new Date().toISOString().split('T')[0];
      initialDomainData = AppState.dailyDomainData[todayStr] || {};
      initialCategoryData = AppState.dailyCategoryData[todayStr] || {};
      periodLabel = 'Today';
    } else if (range === 'week') {
      periodLabel = 'This Week';
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateStr = typeof formatDate === 'function' ? formatDate(date) : new Date().toISOString().split('T')[0];
        const dF = AppState.dailyDomainData[dateStr];
        if (dF) {
          for (const d in dF) initialDomainData[d] = (initialDomainData[d] || 0) + dF[d];
        }
        const cF = AppState.dailyCategoryData[dateStr];
        if (cF) {
          for (const c in cF) initialCategoryData[c] = (initialCategoryData[c] || 0) + cF[c];
        }
      }
    } else if (range === 'month') {
      periodLabel = 'This Month';
      const y = today.getFullYear();
      const m = today.getMonth();
      const daysInCurrentMonthSoFar = today.getDate();
      for (let day = 1; day <= daysInCurrentMonthSoFar; day++) {
        const date = new Date(y, m, day);
        const dateStr = typeof formatDate === 'function' ? formatDate(date) : new Date().toISOString().split('T')[0];
        const dF = AppState.dailyDomainData[dateStr];
        if (dF) {
          for (const d in dF) initialDomainData[d] = (initialDomainData[d] || 0) + dF[d];
        }
        const cF = AppState.dailyCategoryData[dateStr];
        if (cF) {
          for (const c in cF) initialCategoryData[c] = (initialCategoryData[c] || 0) + cF[c];
        }
      }
    } else {
      // "all"
      periodLabel = 'All Time';
      if (Object.keys(AppState.dailyDomainData).length > 0) {
        initialDomainData = {};
        initialCategoryData = {};
        for (const dateStr in AppState.dailyDomainData) {
          const dF = AppState.dailyDomainData[dateStr];
          if (dF) {
            for (const d in dF) initialDomainData[d] = (initialDomainData[d] || 0) + dF[d];
          }
        }
        for (const dateStr in AppState.dailyCategoryData) {
          const cF = AppState.dailyCategoryData[dateStr];
          if (cF) {
            for (const c in cF) initialCategoryData[c] = (initialCategoryData[c] || 0) + cF[c];
          }
        }
      } else {
        initialDomainData = AppState.trackedData || {};
        initialCategoryData = AppState.categoryTimeData || {};
      }
    }

    for (const domain in initialDomainData) {
      const time = initialDomainData[domain];
      if (time > 0) {
        let normalizedDomain = domain;
        if (domain.startsWith('www.')) {
          normalizedDomain = domain.substring(4);
        }
        mergedDomainData[normalizedDomain] = (mergedDomainData[normalizedDomain] || 0) + time;
      }
    }
  } catch (filterError) {
    console.error(`Error filtering/merging data for range "${range}":`, filterError);
    periodLabel = `Error (${range})`;
    return { domainData: {}, categoryData: {}, label: periodLabel };
  }
  return { domainData: mergedDomainData, categoryData: initialCategoryData, label: periodLabel };
}

function saveCategoriesAndAssignments() {
  return browser.storage.local
    .set({ categories: AppState.categories, categoryAssignments: AppState.categoryAssignments })
    .then(() => {
      console.log('[Options Main] Categories/Assignments saved to storage.');
      return browser.runtime.sendMessage({ action: 'categoriesUpdated' });
    })
    .then((response) =>
      console.log('[Options Main] Background notified (categories):', response ? 'OK' : 'No response/Error')
    )
    .catch((error) => {
      console.error('[Options Main] Error saving categories/assignments or notifying background:', error);
      throw error;
    });
}
function saveRules() {
  return browser.storage.local
    .set({ rules: AppState.rules })
    .then(() => {
      console.log('[Options Main] Rules saved to storage.');
      return browser.runtime.sendMessage({ action: 'rulesUpdated' });
    })
    .then((response) =>
      console.log('[Options Main] Background notified (rules):', response ? 'OK' : 'No response/Error')
    )
    .catch((error) => {
      console.error('[Options Main] Error saving rules or notifying background:', error);
      throw error;
    });
}

function convertDataToCsv(dataObject) {
  if (!dataObject) return '';
  const headers = ['Domain', 'Category', 'Time Spent (HH:MM:SS)', 'Time Spent (Seconds)'];
  let csvString = headers.map(escapeCsvValue).join(',') + '\n';

  const sortedData = Object.entries(dataObject)
    .map(([d, s]) => ({ domain: d, seconds: s }))
    .sort((a, b) => b.time - a.time);

  const getCategory = (domain) => {
    if (AppState.categoryAssignments.hasOwnProperty(domain)) {
      return AppState.categoryAssignments[domain];
    }
    const parts = domain.split('.');
    for (let i = 1; i < parts.length; i++) {
      const wildcardPattern = '*.' + parts.slice(i).join('.');
      if (AppState.categoryAssignments.hasOwnProperty(wildcardPattern)) {
        return AppState.categoryAssignments[wildcardPattern];
      }
    }
    return 'Other';
  };

  sortedData.forEach((item) => {
    const category = getCategory(item.domain);
    const timeHMS = typeof formatTime === 'function' ? formatTime(item.seconds, true, true) : item.seconds + 's';
    const row = [item.domain, category, timeHMS, item.seconds];
    csvString += row.map(escapeCsvValue).join(',') + '\n';
  });
  return csvString;
}
function triggerCsvDownload(csvString, filename) {
  try {
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      console.log('CSV download triggered:', filename);
    } else {
      alert(
        'CSV export might not be fully supported by your browser. Please try a different browser or copy the data manually.'
      );
    }
  } catch (e) {
    console.error('Error triggering CSV download:', e);
    alert('An error occurred while trying to export the data.');
  }
}

async function recalculateAndUpdateCategoryTotals(changeDetails) {
  console.log('[Options Main] RECALCULATING category totals. Change Details:', changeDetails);
  try {
    const result = await browser.storage.local.get([
      'trackedData',
      'dailyDomainData',
      'categoryAssignments',
      'categories',
    ]);
    const currentTrackedData = result.trackedData || {};
    const currentDailyDomainData = result.dailyDomainData || {};
    const assignmentsForRebuild = result.categoryAssignments || {};
    const categoriesListForRebuild = result.categories || ['Other'];
    if (!categoriesListForRebuild.includes('Other')) {
      categoriesListForRebuild.push('Other');
    }

    const getCategoryForDomainLocal = (domain, assignments, categoriesList) => {
      if (!domain) return 'Other';
      if (assignments.hasOwnProperty(domain)) {
        return categoriesList.includes(assignments[domain]) ? assignments[domain] : 'Other';
      }
      const parts = domain.split('.');
      for (let i = 1; i < parts.length; i++) {
        const wildcardPattern = '*.' + parts.slice(i).join('.');
        if (assignments.hasOwnProperty(wildcardPattern)) {
          return categoriesList.includes(assignments[wildcardPattern]) ? assignments[wildcardPattern] : 'Other';
        }
      }
      return 'Other';
    };

    const rebuiltCategoryTimeData = {};
    for (const domain in currentTrackedData) {
      const time = currentTrackedData[domain];
      if (time > 0) {
        const category = getCategoryForDomainLocal(domain, assignmentsForRebuild, categoriesListForRebuild);
        rebuiltCategoryTimeData[category] = (rebuiltCategoryTimeData[category] || 0) + time;
      }
    }

    const rebuiltDailyCategoryData = {};
    for (const date in currentDailyDomainData) {
      rebuiltDailyCategoryData[date] = {};
      const domainsForDate = currentDailyDomainData[date];
      for (const domain in domainsForDate) {
        const time = domainsForDate[domain];
        if (time > 0) {
          const category = getCategoryForDomainLocal(domain, assignmentsForRebuild, categoriesListForRebuild);
          rebuiltDailyCategoryData[date][category] = (rebuiltDailyCategoryData[date][category] || 0) + time;
        }
      }
      if (Object.keys(rebuiltDailyCategoryData[date]).length === 0) {
        delete rebuiltDailyCategoryData[date];
      }
    }

    await browser.storage.local.set({
      categoryTimeData: rebuiltCategoryTimeData,
      dailyCategoryData: rebuiltDailyCategoryData,
    });

    AppState.categoryTimeData = rebuiltCategoryTimeData;
    AppState.dailyCategoryData = rebuiltDailyCategoryData;

    console.log('[Options Main] Category totals rebuilt and saved successfully.');
  } catch (error) {
    console.error('[Options Main] Error during category recalculation:', error);
    alert('An error occurred while recalculating category totals. Please check the console.');
  } finally {
    console.log('[Options Main] RECALCULATING category totals FINISHED.');
  }
}

function displayProductivityScore(scoreData, periodLabel = 'Selected Period', isError = false) {
  if (!UIElements.productivityScoreValue || !UIElements.productivityScoreLabel) {
    console.warn('Productivity score UI elements not found in Options.');
    return;
  }

  if (isError || !scoreData) {
    UIElements.productivityScoreValue.textContent = 'Error';
    UIElements.productivityScoreLabel.textContent = `Focus Score (${periodLabel})`;
    UIElements.productivityScoreValue.className = 'score-value';
    return;
  }

  UIElements.productivityScoreValue.textContent = `${scoreData.score}%`;
  UIElements.productivityScoreLabel.textContent = `Focus Score (${periodLabel})`;

  UIElements.productivityScoreValue.classList.remove('score-low', 'score-medium', 'score-high');
  if (scoreData.score < 40) {
    UIElements.productivityScoreValue.classList.add('score-low');
  } else if (scoreData.score < 70) {
    UIElements.productivityScoreValue.classList.add('score-medium');
  } else {
    UIElements.productivityScoreValue.classList.add('score-high');
  }
}

function handleCalendarDayClick(event) {
  const dayCell = event.target.closest('.calendar-day');
  if (!dayCell) return;
  const dateStr = dayCell.dataset.date;
  if (!dateStr) return;

  console.log(`[DEBUG Main] handleCalendarDayClick: Clicked on date ${dateStr}`);
  AppState.selectedDateStr = dateStr;
  if (typeof highlightSelectedCalendarDay === 'function') {
    highlightSelectedCalendarDay(dateStr);
  }

  if (UIElements.dateRangeSelect) {
    const valueWasChanged = UIElements.dateRangeSelect.value !== '';
    if (valueWasChanged) {
      UIElements.dateRangeSelect.value = '';
    }
    updateDisplayForSelectedRangeUI(false); // Explicitly false, not initial load
  } else {
    console.warn('[DEBUG Main] handleCalendarDayClick: dateRangeSelect UI element not found. Cannot update UI.');
  }
}

function setupEventListeners() {
  console.log('[Options Main] Setting up event listeners...');
  try {
    if (UIElements.addCategoryBtn && typeof handleAddCategory === 'function')
      UIElements.addCategoryBtn.addEventListener('click', handleAddCategory);
    if (UIElements.categoryList) {
      UIElements.categoryList.addEventListener('click', (event) => {
        if (event.target.classList.contains('category-delete-btn') && typeof handleDeleteCategory === 'function')
          handleDeleteCategory(event);
        else if (event.target.classList.contains('category-edit-btn') && typeof handleEditCategoryClick === 'function')
          handleEditCategoryClick(event);
        else if (event.target.classList.contains('category-save-btn') && typeof handleSaveCategoryClick === 'function')
          handleSaveCategoryClick(event);
        else if (
          event.target.classList.contains('category-cancel-btn') &&
          typeof handleCancelCategoryEditClick === 'function'
        )
          handleCancelCategoryEditClick(event);
      });
    }

    if (UIElements.assignDomainBtn && typeof handleAssignDomainOrSaveChanges === 'function')
      UIElements.assignDomainBtn.addEventListener('click', handleAssignDomainOrSaveChanges);

    if (UIElements.cancelAssignDomainBtn && typeof handleCancelAssignDomainEdit === 'function')
      UIElements.cancelAssignDomainBtn.addEventListener('click', handleCancelAssignDomainEdit);

    if (UIElements.assignmentList) {
      UIElements.assignmentList.addEventListener('click', (event) => {
        if (event.target.classList.contains('assignment-delete-btn') && typeof handleDeleteAssignment === 'function')
          handleDeleteAssignment(event);
        else if (
          event.target.classList.contains('assignment-edit-btn') &&
          typeof handleEditAssignmentClick === 'function'
        )
          handleEditAssignmentClick(event);
      });
    }

    if (UIElements.ruleTypeSelect && typeof handleRuleTypeChange === 'function')
      UIElements.ruleTypeSelect.addEventListener('change', handleRuleTypeChange);
    if (UIElements.addRuleBtn && typeof handleAddRule === 'function')
      UIElements.addRuleBtn.addEventListener('click', handleAddRule);
    if (UIElements.ruleList) {
      UIElements.ruleList.addEventListener('click', (event) => {
        if (event.target.classList.contains('delete-btn') && typeof handleDeleteRule === 'function')
          handleDeleteRule(event);
        else if (event.target.classList.contains('edit-btn') && typeof handleEditRuleClick === 'function')
          handleEditRuleClick(event);
      });
    }
    if (UIElements.closeEditModalBtn && typeof handleCancelEditClick === 'function')
      UIElements.closeEditModalBtn.addEventListener('click', handleCancelEditClick);
    if (UIElements.cancelEditRuleBtn && typeof handleCancelEditClick === 'function')
      UIElements.cancelEditRuleBtn.addEventListener('click', handleCancelEditClick);
    if (UIElements.saveRuleChangesBtn && typeof handleSaveChangesClick === 'function')
      UIElements.saveRuleChangesBtn.addEventListener('click', handleSaveChangesClick);
    if (UIElements.editRuleModal && typeof handleCancelEditClick === 'function')
      UIElements.editRuleModal.addEventListener('click', (event) => {
        if (event.target === UIElements.editRuleModal) handleCancelEditClick();
      });

    if (UIElements.dateRangeSelect)
      UIElements.dateRangeSelect.addEventListener('change', () => updateDisplayForSelectedRangeUI(false)); // Pass false
    if (UIElements.domainPrevBtn && typeof handleDomainPrev === 'function')
      UIElements.domainPrevBtn.addEventListener('click', handleDomainPrev);
    if (UIElements.domainNextBtn && typeof handleDomainNext === 'function')
      UIElements.domainNextBtn.addEventListener('click', handleDomainNext);
    if (UIElements.prevMonthBtn && typeof handlePrevMonth === 'function')
      UIElements.prevMonthBtn.addEventListener('click', handlePrevMonth);
    if (UIElements.nextMonthBtn && typeof handleNextMonth === 'function')
      UIElements.nextMonthBtn.addEventListener('click', handleNextMonth);
    if (UIElements.chartViewRadios) {
      UIElements.chartViewRadios.forEach((radio) => {
        if (typeof handleChartViewChange === 'function') radio.addEventListener('change', handleChartViewChange);
      });
    }
    if (UIElements.exportCsvBtn && typeof handleExportCsv === 'function')
      UIElements.exportCsvBtn.addEventListener('click', handleExportCsv);

    if (UIElements.idleThresholdSelect && typeof handleIdleThresholdChange === 'function')
      UIElements.idleThresholdSelect.addEventListener('change', handleIdleThresholdChange);
    if (UIElements.dataRetentionSelect && typeof handleDataRetentionChange === 'function')
      UIElements.dataRetentionSelect.addEventListener('change', handleDataRetentionChange);

    if (UIElements.exportDataBtn && typeof handleExportData === 'function')
      UIElements.exportDataBtn.addEventListener('click', handleExportData);
    if (UIElements.importDataBtn && typeof handleImportDataClick === 'function')
      UIElements.importDataBtn.addEventListener('click', handleImportDataClick);
    if (UIElements.importFileInput && typeof handleImportFileChange === 'function')
      UIElements.importFileInput.addEventListener('change', handleImportFileChange);

    if (UIElements.productivitySettingsList && typeof handleProductivityRatingChange === 'function') {
      UIElements.productivitySettingsList.addEventListener('change', handleProductivityRatingChange);
    }

    if (UIElements.savePomodoroSettingsBtn && typeof handleSavePomodoroSettings === 'function') {
      UIElements.savePomodoroSettingsBtn.addEventListener('click', handleSavePomodoroSettings);
    }
    if (UIElements.resetPomodoroSettingsBtn && typeof handleResetPomodoroSettings === 'function') {
      UIElements.resetPomodoroSettingsBtn.addEventListener('click', handleResetPomodoroSettings);
    }
    if (UIElements.pomodoroEnableNotificationsCheckbox && typeof handlePomodoroNotificationToggle === 'function') {
      UIElements.pomodoroEnableNotificationsCheckbox.addEventListener('change', handlePomodoroNotificationToggle);
    }

    // Save Pomodoro Work blocking settings when changed
    if (UIElements.pomodoroBlockDuringWorkCheckbox) {
      UIElements.pomodoroBlockDuringWorkCheckbox.addEventListener('change', async () => {
        try {
          const res = await browser.storage.local.get(STORAGE_KEY_POMODORO_SETTINGS);
          const current = res[STORAGE_KEY_POMODORO_SETTINGS] || {};
          current.blockDuringWorkEnabled = UIElements.pomodoroBlockDuringWorkCheckbox.checked;
          await browser.storage.local.set({ [STORAGE_KEY_POMODORO_SETTINGS]: current });
          await browser.runtime.sendMessage({ action: 'pomodoroSettingsChanged' });
        } catch (e) {
          console.error('[Options] Failed to save blockDuringWorkEnabled:', e);
        }
      });
    }
    if (UIElements.pomodoroBlockedCategoriesSelect) {
      UIElements.pomodoroBlockedCategoriesSelect.addEventListener('change', async () => {
        try {
          const selected = Array.from(UIElements.pomodoroBlockedCategoriesSelect.options)
            .filter((o) => o.selected && !o.disabled && o.value)
            .map((o) => o.value);
          const res = await browser.storage.local.get(STORAGE_KEY_POMODORO_SETTINGS);
          const current = res[STORAGE_KEY_POMODORO_SETTINGS] || {};
          current.blockedCategoriesDuringWork = selected;
          await browser.storage.local.set({ [STORAGE_KEY_POMODORO_SETTINGS]: current });
          await browser.runtime.sendMessage({ action: 'pomodoroSettingsChanged' });
        } catch (e) {
          console.error('[Options] Failed to save blockedCategoriesDuringWork:', e);
        }
      });
    }

    if (UIElements.blockPageCustomHeadingInput && typeof handleBlockPageSettingChange === 'function')
      UIElements.blockPageCustomHeadingInput.addEventListener('change', () =>
        handleBlockPageSettingChange(
          STORAGE_KEY_BLOCK_PAGE_CUSTOM_HEADING,
          UIElements.blockPageCustomHeadingInput.value.trim()
        )
      );
    if (UIElements.blockPageCustomMessageTextarea && typeof handleBlockPageSettingChange === 'function')
      UIElements.blockPageCustomMessageTextarea.addEventListener('change', () =>
        handleBlockPageSettingChange(
          STORAGE_KEY_BLOCK_PAGE_CUSTOM_MESSAGE,
          UIElements.blockPageCustomMessageTextarea.value.trim()
        )
      );
    if (UIElements.blockPageCustomButtonTextInput && typeof handleBlockPageSettingChange === 'function')
      UIElements.blockPageCustomButtonTextInput.addEventListener('change', () =>
        handleBlockPageSettingChange(
          STORAGE_KEY_BLOCK_PAGE_CUSTOM_BUTTON_TEXT,
          UIElements.blockPageCustomButtonTextInput.value.trim()
        )
      );
    if (UIElements.blockPageShowUrlCheckbox && typeof handleBlockPageSettingChange === 'function')
      UIElements.blockPageShowUrlCheckbox.addEventListener('change', () =>
        handleBlockPageSettingChange(STORAGE_KEY_BLOCK_PAGE_SHOW_URL, UIElements.blockPageShowUrlCheckbox.checked)
      );
    if (UIElements.blockPageShowReasonCheckbox && typeof handleBlockPageSettingChange === 'function')
      UIElements.blockPageShowReasonCheckbox.addEventListener('change', () =>
        handleBlockPageSettingChange(STORAGE_KEY_BLOCK_PAGE_SHOW_REASON, UIElements.blockPageShowReasonCheckbox.checked)
      );
    if (UIElements.blockPageShowRuleCheckbox && typeof handleBlockPageSettingChange === 'function')
      UIElements.blockPageShowRuleCheckbox.addEventListener('change', () =>
        handleBlockPageSettingChange(STORAGE_KEY_BLOCK_PAGE_SHOW_RULE, UIElements.blockPageShowRuleCheckbox.checked)
      );
    if (UIElements.blockPageShowLimitInfoCheckbox && typeof handleBlockPageSettingChange === 'function')
      UIElements.blockPageShowLimitInfoCheckbox.addEventListener('change', () =>
        handleBlockPageSettingChange(
          STORAGE_KEY_BLOCK_PAGE_SHOW_LIMIT_INFO,
          UIElements.blockPageShowLimitInfoCheckbox.checked
        )
      );
    if (UIElements.blockPageShowScheduleInfoCheckbox && typeof handleBlockPageSettingChange === 'function')
      UIElements.blockPageShowScheduleInfoCheckbox.addEventListener('change', () =>
        handleBlockPageSettingChange(
          STORAGE_KEY_BLOCK_PAGE_SHOW_SCHEDULE_INFO,
          UIElements.blockPageShowScheduleInfoCheckbox.checked
        )
      );
    if (UIElements.blockPageShowQuoteCheckbox && typeof handleBlockPageShowQuoteChange === 'function')
      UIElements.blockPageShowQuoteCheckbox.addEventListener('change', handleBlockPageShowQuoteChange);
    if (UIElements.blockPageUserQuotesTextarea && typeof handleBlockPageUserQuotesChange === 'function')
      UIElements.blockPageUserQuotesTextarea.addEventListener('change', handleBlockPageUserQuotesChange);

    if (UIElements.categoryTimeList) {
      UIElements.categoryTimeList.addEventListener('click', (event) => {
        if (event.target.classList.contains('category-name-clickable')) {
          const categoryName = event.target.dataset.categoryName;
          if (categoryName && typeof handleCategoryBreakdownRequest === 'function') {
            handleCategoryBreakdownRequest(categoryName);
          }
        }
      });
    }

    if (UIElements.breakdownCategorySelect && typeof handleBreakdownCategorySelectChange === 'function') {
      UIElements.breakdownCategorySelect.addEventListener('change', handleBreakdownCategorySelectChange);
    }

    if (UIElements.itemDetailPrevBtn && typeof handleItemDetailPrev === 'function') {
      UIElements.itemDetailPrevBtn.addEventListener('click', handleItemDetailPrev);
    }
    if (UIElements.itemDetailNextBtn && typeof handleItemDetailNext === 'function') {
      UIElements.itemDetailNextBtn.addEventListener('click', handleItemDetailNext);
    }

    if (typeof handleRuleTypeChange === 'function') handleRuleTypeChange();
    console.log('[Options Main] Event listeners setup complete.');
  } catch (e) {
    console.error('[Options Main] Error setting up event listeners:', e);
  }
}

// --- Insights banner logic ---
let insightsRotationTimer = null;
let lastInsightsForLabel = '';

function computeInsightsMessages(label, domainData, categoryData) {
  try {
    const messages = [];
    const totalSeconds = Object.values(domainData || {}).reduce((s, t) => s + t, 0);
    const focus = typeof calculateFocusScore === 'function' ? calculateFocusScore(categoryData, AppState.categoryProductivityRatings) : { score: 0, totalTime: 0 };

    // Top distracting category insight
    const distractingCats = Object.entries(categoryData || {})
      .filter(([cat]) => (AppState.categoryProductivityRatings?.[cat] ?? (defaultCategoryProductivityRatings?.[cat] ?? 0)) < 0)
      .sort((a, b) => b[1] - a[1]);
    if (distractingCats.length > 0) {
      const [topCat, topTime] = distractingCats[0];
      if (topTime >= 3600) {
        const timeText = typeof formatTime === 'function' ? formatTime(topTime, true) : `${Math.round(topTime/60)}m`;
        messages.push(`${timeText} on ${topCat}. Consider limiting it during Work to boost focus.`);
      } else {
        // Not enough time to single out a category; provide a generalized tip instead
        messages.push('Small steps add up — try a Work session to build momentum.');
      }
    }

    // Average per-day estimate if in a range
    if (label === 'This Week' || label === 'This Month' || label === 'All Time') {
      let days = 0;
      if (label === 'This Week') days = 7;
      else if (label === 'This Month') days = new Date().getDate();
      else days = Math.max(1, Object.keys(AppState.dailyDomainData || {}).length);
      const avgPerDay = totalSeconds / days;
      messages.push(`Avg ${typeof formatTime === 'function' ? formatTime(avgPerDay, true) : `${Math.round(avgPerDay/60)}m`}/day over ${label.toLowerCase()}.`);
    }

    // Focus score nudge
    if (focus && typeof focus.score === 'number') {
      if (focus.score < 50) messages.push(`Focus Score ${focus.score}%. Try a few Pomodoros to raise it.`);
      else if (focus.score >= 80) messages.push(`Great job! Focus Score ${focus.score}% — keep the streak.`);
    }

    // Pomodoro encouragement
    const todayStr = typeof getCurrentDateString === 'function' ? getCurrentDateString() : new Date().toISOString().split('T')[0];
    const todayStats = AppState.allPomodoroDailyStats?.[todayStr];
    if (!todayStats || (todayStats.workSessions || 0) === 0) {
      messages.push('Tip: Start a Work session to enter deep focus mode.');
    } else {
      const w = todayStats.workSessions || 0;
      messages.push(`You’ve completed ${w} work ${w === 1 ? 'session' : 'sessions'} today. Nice.`);
    }

    if (messages.length === 0) {
      messages.push('Insights will appear here as you accumulate data.');
    }
    return messages;
  } catch (e) {
    console.warn('[Insights] Failed to compute messages:', e);
    return ['Insights unavailable.'];
  }
}

function updateInsightsBanner(label, domainData, categoryData) {
  if (!UIElements.insightsBanner || !UIElements.insightsBannerText) return;
  const msgs = computeInsightsMessages(label, domainData, categoryData);
  if (!msgs || msgs.length === 0) {
    UIElements.insightsBanner.style.display = 'none';
    return;
  }
  UIElements.insightsBanner.style.display = 'block';
  let i = 0;
  UIElements.insightsBannerText.textContent = msgs[i];
  if (insightsRotationTimer) {
    clearInterval(insightsRotationTimer);
    insightsRotationTimer = null;
  }
  insightsRotationTimer = setInterval(() => {
    i = (i + 1) % msgs.length;
    UIElements.insightsBannerText.textContent = msgs[i];
  }, 7000);
}
