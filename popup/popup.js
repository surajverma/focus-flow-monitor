/*****************************************************************
 * Updated File: for-gemini/popup/popup.js
 *****************************************************************/
// --- Global Chart Instance ---
let hourlyChartInstance = null;
// --- Interval ID for live popup updates ---
let popupUpdateIntervalId = null;

// ID for the status message timeout to prevent conflicting timers
let statusMessageTimeoutId = null;
// Flag to prevent the main refresh loop from clearing a temporary message
let isDisplayingTempStatus = false;

const STORAGE_KEY_TIME_FORMAT = 'hourlyChartTimeFormat'; // true for 24-hour, false for 12-hour
let use24HourFormat = false; // Default to 12-hour format
let todaysHourlyDataForToggle = {}; // Store data for re-rendering on toggle

async function loadTimeFormatPreference() {
  try {
    const result = await browser.storage.local.get(STORAGE_KEY_TIME_FORMAT);
    if (result[STORAGE_KEY_TIME_FORMAT] !== undefined) {
      use24HourFormat = result[STORAGE_KEY_TIME_FORMAT];
    }
  } catch (e) {
    console.warn('Error loading time format preference:', e);
  }
}

async function saveTimeFormatPreference() {
  try {
    await browser.storage.local.set({ [STORAGE_KEY_TIME_FORMAT]: use24HourFormat });
  } catch (e) {
    console.warn('Error saving time format preference:', e);
  }
}

const STORAGE_KEY_SUMMARY_VIEW = 'popupSummaryViewType'; // true for categories, false for websites
let showCategoriesInSummary = true; // Default to showing categories

// Store fetched data for quick toggling
let todaysCategoryDataForSummary = {};
let todaysDomainDataForSummary = {};
let totalSecondsTodayForSummary = 0;

// --- Chart Rendering Function ---
function renderHourlyChart(canvasCtx, hourlyDataToday) {
  if (typeof Chart === 'undefined') {
    console.error('Chart.js library is not loaded or available!');
    if (canvasCtx && canvasCtx.canvas) {
      canvasCtx.clearRect(0, 0, canvasCtx.canvas.width, canvasCtx.canvas.height);
      canvasCtx.font = '12px sans-serif';
      canvasCtx.fillStyle = '#aaa';
      canvasCtx.textAlign = 'center';
      canvasCtx.fillText('Chart library missing!', canvasCtx.canvas.width / 2, canvasCtx.canvas.height / 2);
    }
    return;
  }

  if (hourlyChartInstance) {
    hourlyChartInstance.destroy();
    hourlyChartInstance = null;
  }

  const xAxisLabels = [];
  const data = [];

  for (let i = 0; i < 24; i++) {
    if (use24HourFormat) {
      xAxisLabels.push(String(i).padStart(2, '0')); // "00", "01", ... "23"
    } else {
      const hour = i % 12 === 0 ? 12 : i % 12;
      const ampm = i < 12 || i === 24 ? 'AM' : 'PM';
      if (i === 24) {
        // Should not be hit if data is only for 0-23h
        xAxisLabels.push(`12AM`);
      } else {
        xAxisLabels.push(`${hour}${ampm}`); // "12AM", "1AM", ...
      }
    }
    const hourStr = i.toString().padStart(2, '0');
    const seconds = hourlyDataToday[hourStr] || 0;
    data.push(seconds);
  }

  const hasData = data.some((value) => value > 0);

  if (!hasData && canvasCtx && canvasCtx.canvas) {
    canvasCtx.clearRect(0, 0, canvasCtx.canvas.width, canvasCtx.canvas.height);
    canvasCtx.font = '12px sans-serif';
    canvasCtx.fillStyle = '#aaa';
    canvasCtx.textAlign = 'center';
    canvasCtx.fillText('No hourly usage data for today.', canvasCtx.canvas.width / 2, canvasCtx.canvas.height / 2);
    return;
  }

  try {
    hourlyChartInstance = new Chart(canvasCtx, {
      type: 'bar',
      data: {
        labels: xAxisLabels,
        datasets: [
          {
            label: 'Time Spent',
            data: data,
            backgroundColor: 'rgba(54, 162, 235, 0.6)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1,
            barPercentage: 0.8,
            categoryPercentage: 0.9,
          },
        ],
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            displayColors: false,
            callbacks: {
              title: function (context) {
                return context[0]?.label || '';
              },
              label: function (context) {
                const seconds = context.parsed.y || 0;
                return `Time: ${typeof formatTime === 'function' ? formatTime(seconds, true) : seconds + 's'}`;
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 3600,
            ticks: {
              stepSize: 900,
              callback: function (value) {
                if (value === 0) return null;
                if (value === 900) return '15m';
                if (value === 1800) return '30m';
                if (value === 2700) return '45m';
                if (value === 3600) return '1h';
                return null;
              },
              maxTicksLimit: 5,
              font: { size: 10 },
            },
            grid: { drawTicks: false, border: { display: false } },
          },
          x: {
            ticks: {
              font: { size: 9 },
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 8, // Approx 3-hour intervals (12AM, 3AM, ...)
              callback: function (value) {
                // value is the index of the tick
                const originalLabel = this.getLabelForValue(value);
                if (use24HourFormat) {
                  // originalLabel is "00", "01", etc.
                  return `${originalLabel}h`;
                } else {
                  // originalLabel is "12AM", "1AM", etc.
                  return originalLabel;
                }
              },
            },
            grid: { display: false, drawTicks: false, border: { display: false } },
          },
        },
      },
    });
  } catch (chartError) {
    console.error('Error creating hourly chart:', chartError);
    if (canvasCtx && canvasCtx.canvas) {
      canvasCtx.clearRect(0, 0, canvasCtx.canvas.width, canvasCtx.canvas.height);
      canvasCtx.font = '12px sans-serif';
      canvasCtx.fillStyle = '#aaa';
      canvasCtx.textAlign = 'center';
      canvasCtx.fillText('Error rendering chart.', canvasCtx.canvas.width / 2, canvasCtx.canvas.height / 2);
    }
  }
}

async function loadSummaryViewPreference() {
  try {
    const result = await browser.storage.local.get(STORAGE_KEY_SUMMARY_VIEW);
    if (result[STORAGE_KEY_SUMMARY_VIEW] !== undefined) {
      showCategoriesInSummary = result[STORAGE_KEY_SUMMARY_VIEW];
    }
  } catch (e) {
    console.warn('Error loading summary view preference:', e);
  }
}

async function saveSummaryViewPreference() {
  try {
    await browser.storage.local.set({ [STORAGE_KEY_SUMMARY_VIEW]: showCategoriesInSummary });
  } catch (e) {
    console.warn('Error saving summary view preference:', e);
  }
}

function renderCategorySummary(summaryEl, progressBarEl, categoryData, totalSeconds) {
  summaryEl.innerHTML = '';
  progressBarEl.innerHTML = '';

  if (totalSeconds > 0 && categoryData && Object.keys(categoryData).length > 0) {
    progressBarEl.style.display = 'flex';
    const categoryArray = Object.entries(categoryData)
      .map(([category, time]) => ({
        name: category,
        time: time,
        percentage: totalSeconds > 0 ? (time / totalSeconds) * 100 : 0,
      }))
      .filter((cat) => cat.time > 0.1)
      .sort((a, b) => b.time - a.time);

    const maxItemsToDisplay = 5;
    let finalDisplayItems = [];
    if (categoryArray.length <= maxItemsToDisplay) {
      finalDisplayItems = categoryArray;
    } else {
      let topSlice = categoryArray.slice(0, maxItemsToDisplay);
      const remainingCategories = categoryArray.slice(maxItemsToDisplay);
      const remainingTime = remainingCategories.reduce((sum, cat) => sum + cat.time, 0);
      const realOtherIndexInTop = topSlice.findIndex((c) => c.name === 'Other');

      if (realOtherIndexInTop !== -1) {
        topSlice[realOtherIndexInTop].time += remainingTime;
        topSlice[realOtherIndexInTop].percentage =
          totalSeconds > 0 ? (topSlice[realOtherIndexInTop].time / totalSeconds) * 100 : 0;
        finalDisplayItems = topSlice;
      } else {
        finalDisplayItems = topSlice.slice(0, maxItemsToDisplay - 1);
        const fifthItemTime = topSlice[maxItemsToDisplay - 1]?.time || 0;
        const aggregateTime = fifthItemTime + remainingTime;
        if (aggregateTime >= 1) {
          const aggregatePercentage = totalSeconds > 0 ? (aggregateTime / totalSeconds) * 100 : 0;
          finalDisplayItems.push({ name: 'Other', time: aggregateTime, percentage: aggregatePercentage });
        } else if (finalDisplayItems.length < maxItemsToDisplay && fifthItemTime >= 1) {
          finalDisplayItems.push(topSlice[maxItemsToDisplay - 1]);
        }
      }
      if (finalDisplayItems.length > maxItemsToDisplay)
        finalDisplayItems = finalDisplayItems.slice(0, maxItemsToDisplay);
    }

    finalDisplayItems.forEach((cat) => {
      const displayPercentage = cat.time > 0.1 ? Math.max(1, Math.round(cat.percentage)) : 0;
      const itemDiv = document.createElement('div');
      itemDiv.className = 'category-item';
      const infoDiv = document.createElement('div');
      infoDiv.className = 'category-info';
      const dotSpan = document.createElement('span');
      dotSpan.className = 'category-dot';
      dotSpan.style.backgroundColor = typeof getCategoryColor === 'function' ? getCategoryColor(cat.name) : '#ccc';
      const nameSpan = document.createElement('span');
      nameSpan.className = 'category-name';
      nameSpan.textContent = cat.name;
      infoDiv.appendChild(dotSpan);
      infoDiv.appendChild(nameSpan);
      const timePercentSpan = document.createElement('span');
      timePercentSpan.className = 'category-time-percent';
      timePercentSpan.appendChild(
        document.createTextNode((typeof formatTime === 'function' ? formatTime(cat.time, true) : cat.time + 's') + ' ')
      );
      const percentSpanElement = document.createElement('span');
      percentSpanElement.className = 'category-percent';
      percentSpanElement.textContent = `(${displayPercentage}%)`;
      timePercentSpan.appendChild(percentSpanElement);
      itemDiv.appendChild(infoDiv);
      itemDiv.appendChild(timePercentSpan);
      summaryEl.appendChild(itemDiv);

      const segmentDiv = document.createElement('div');
      segmentDiv.className = 'progress-bar-segment';
      const widthPercentage = Math.max(0.5, cat.percentage);
      segmentDiv.style.width = `${widthPercentage}%`;
      segmentDiv.style.backgroundColor = typeof getCategoryColor === 'function' ? getCategoryColor(cat.name) : '#ccc';
      segmentDiv.title = `${cat.name}: ${
        typeof formatTime === 'function' ? formatTime(cat.time, true) : cat.time + 's'
      } (${displayPercentage}%)`;
      progressBarEl.appendChild(segmentDiv);
    });
    const totalSegmentWidth = Array.from(progressBarEl.children).reduce(
      (sum, el) => sum + parseFloat(el.style.width || 0),
      0
    );
    if (
      progressBarEl.children.length > 0 &&
      (totalSegmentWidth > 101 || totalSegmentWidth < 99) &&
      totalSegmentWidth !== 0
    ) {
      const scaleFactor = 100 / totalSegmentWidth;
      Array.from(progressBarEl.children).forEach((el) => {
        el.style.width = `${parseFloat(el.style.width || 0) * scaleFactor}%`;
      });
    }
  } else {
    summaryEl.textContent = 'No category activity tracked today.';
    progressBarEl.style.display = 'none';
  }
}

function renderDomainSummary(summaryEl, progressBarEl, domainData, totalSeconds) {
  summaryEl.innerHTML = '';
  progressBarEl.innerHTML = '';
  const websiteColors = [
    'rgba(128, 0, 128, 0.7)',
    'rgba(0, 128, 0, 0.7)',
    'rgba(255, 165, 0, 0.7)',
    'rgba(0, 0, 255, 0.7)',
    'rgba(210, 105, 30, 0.7)',
  ];
  const defaultOtherColor = 'rgba(128, 128, 128, 0.7)';

  if (totalSeconds > 0 && domainData && Object.keys(domainData).length > 0) {
    progressBarEl.style.display = 'flex';
    const domainArray = Object.entries(domainData)
      .map(([domain, time]) => ({
        name: domain,
        time: time,
        percentage: totalSeconds > 0 ? (time / totalSeconds) * 100 : 0,
      }))
      .filter((item) => item.time > 0.1)
      .sort((a, b) => b.time - a.time);

    const maxItemsToDisplay = 5;
    let finalDisplayItems = [];
    if (domainArray.length <= maxItemsToDisplay) {
      finalDisplayItems = domainArray;
    } else {
      finalDisplayItems = domainArray.slice(0, maxItemsToDisplay - 1);
      const remainingDomains = domainArray.slice(maxItemsToDisplay - 1);
      const remainingTime = remainingDomains.reduce((sum, item) => sum + item.time, 0);
      if (remainingTime >= 1) {
        const remainingPercentage = totalSeconds > 0 ? (remainingTime / totalSeconds) * 100 : 0;
        finalDisplayItems.push({ name: 'Other Websites', time: remainingTime, percentage: remainingPercentage });
      } else if (finalDisplayItems.length < maxItemsToDisplay && domainArray[maxItemsToDisplay - 1].time >= 1) {
        finalDisplayItems.push(domainArray[maxItemsToDisplay - 1]);
      }
    }

    finalDisplayItems.forEach((item, index) => {
      const displayPercentage = item.time > 0.1 ? Math.max(1, Math.round(item.percentage)) : 0;
      const itemDiv = document.createElement('div');
      itemDiv.className = 'category-item';
      const infoDiv = document.createElement('div');
      infoDiv.className = 'category-info';
      const dotSpan = document.createElement('span');
      dotSpan.className = 'category-dot';
      dotSpan.style.backgroundColor =
        item.name === 'Other Websites' ? defaultOtherColor : websiteColors[index % websiteColors.length];
      const nameSpan = document.createElement('span');
      nameSpan.className = 'category-name';
      nameSpan.textContent = item.name;
      infoDiv.appendChild(dotSpan);
      infoDiv.appendChild(nameSpan);
      const timePercentSpan = document.createElement('span');
      timePercentSpan.className = 'category-time-percent';
      timePercentSpan.appendChild(
        document.createTextNode(
          (typeof formatTime === 'function' ? formatTime(item.time, true) : item.time + 's') + ' '
        )
      );
      const percentSpanElement = document.createElement('span');
      percentSpanElement.className = 'category-percent';
      percentSpanElement.textContent = `(${displayPercentage}%)`;
      timePercentSpan.appendChild(percentSpanElement);
      itemDiv.appendChild(infoDiv);
      itemDiv.appendChild(timePercentSpan);
      summaryEl.appendChild(itemDiv);

      const segmentDiv = document.createElement('div');
      segmentDiv.className = 'progress-bar-segment';
      const widthPercentage = Math.max(0.5, item.percentage);
      segmentDiv.style.width = `${widthPercentage}%`;
      segmentDiv.style.backgroundColor =
        item.name === 'Other Websites' ? defaultOtherColor : websiteColors[index % websiteColors.length];
      segmentDiv.title = `${item.name}: ${
        typeof formatTime === 'function' ? formatTime(item.time, true) : item.time + 's'
      } (${displayPercentage}%)`;
      progressBarEl.appendChild(segmentDiv);
    });
    const totalSegmentWidth = Array.from(progressBarEl.children).reduce(
      (sum, el) => sum + parseFloat(el.style.width || 0),
      0
    );
    if (
      progressBarEl.children.length > 0 &&
      (totalSegmentWidth > 101 || totalSegmentWidth < 99) &&
      totalSegmentWidth !== 0
    ) {
      const scaleFactor = 100 / totalSegmentWidth;
      Array.from(progressBarEl.children).forEach((el) => {
        el.style.width = `${parseFloat(el.style.width || 0) * scaleFactor}%`;
      });
    }
  } else {
    summaryEl.textContent = 'No website activity tracked today.';
    progressBarEl.style.display = 'none';
  }
}

function updateSummaryDisplay(summaryEl, progressBarEl, summaryViewTitleEl) {
  if (!summaryEl || !progressBarEl || !summaryViewTitleEl) {
    console.warn('Summary display elements not ready for updateSummaryDisplay.');
    return;
  }
  if (showCategoriesInSummary) {
    summaryViewTitleEl.textContent = 'Top Categories';
    renderCategorySummary(summaryEl, progressBarEl, todaysCategoryDataForSummary, totalSecondsTodayForSummary);
  } else {
    summaryViewTitleEl.textContent = 'Top Websites';
    renderDomainSummary(summaryEl, progressBarEl, todaysDomainDataForSummary, totalSecondsTodayForSummary);
  }
}

// --- Main Logic ---
document.addEventListener('DOMContentLoaded', async () => {
  await loadTimeFormatPreference();
  await loadSummaryViewPreference();

  const totalTimeEl = document.getElementById('totalTimeToday');
  const dateEl = document.getElementById('currentDate');
  const summaryEl = document.getElementById('todaySummary');
  const progressBarEl = document.getElementById('categoryProgressBar');
  const optionsBtn = document.getElementById('optionsBtn');
  const hourlyChartCanvas = document.getElementById('hourlyChartCanvas');
  const focusScoreEl = document.getElementById('focusScoreToday');
  let hourlyChartCtx = null;

  const summaryToggleBtn = document.getElementById('summaryToggleBtn');
  const summaryViewTitleEl = document.getElementById('summaryViewTitle');

  const pomodoroPhaseEl = document.getElementById('pomodoro-phase');
  const pomodoroTimeEl = document.getElementById('pomodoro-time');
  const pomodoroStartPauseBtn = document.getElementById('pomodoro-start-pause-btn');
  const pomodoroResetBtn = document.getElementById('pomodoro-reset-btn');
  const pomodoroStatusMessageEl = document.getElementById('pomodoro-status-message');
  const pomodoroChangePhaseBtn = document.getElementById('pomodoro-change-phase-btn');
  const pomodoroTodayStatsEl = document.getElementById('pomodoro-today-stats');

  const pomodoroNotifyToggleBtn = document.getElementById('pomodoro-notify-toggle');
  const pomodoroNotifyIcon = document.getElementById('pomodoro-notify-icon');

  const customConfirmModalEl = document.getElementById('custom-confirm-modal');
  const customConfirmMessageEl = document.getElementById('custom-confirm-message');
  const customConfirmYesBtn = document.getElementById('custom-confirm-yes-btn');
  const customConfirmNoBtn = document.getElementById('custom-confirm-no-btn');
  let confirmYesCallback = null;
  let confirmNoCallback = null;

  if (hourlyChartCanvas) {
    try {
      hourlyChartCtx = hourlyChartCanvas.getContext('2d');
      if (!hourlyChartCtx) throw new Error('Canvas 2D context not supported or missing.');
      hourlyChartCanvas.addEventListener('click', () => {
        use24HourFormat = !use24HourFormat;
        saveTimeFormatPreference();
        if (hourlyChartCtx && Object.keys(todaysHourlyDataForToggle).length > 0) {
          renderHourlyChart(hourlyChartCtx, todaysHourlyDataForToggle);
        } else {
          console.log('Hourly data not yet loaded for chart format toggle, preference saved.');
        }
      });
    } catch (e) {
      console.error('Failed to get canvas context:', e);
      const chartWrapper = document.querySelector('.chart-wrapper');
      if (chartWrapper)
        chartWrapper.innerHTML =
          "<p style='color: red; font-size: small; text-align: center;'>Could not initialize chart canvas.</p>";
    }
  }

  if (summaryToggleBtn && summaryEl && progressBarEl && summaryViewTitleEl) {
    summaryToggleBtn.addEventListener('click', () => {
      showCategoriesInSummary = !showCategoriesInSummary;
      saveSummaryViewPreference(); // Ensure data is available before updating
      if (
        Object.keys(todaysCategoryDataForSummary).length > 0 ||
        Object.keys(todaysDomainDataForSummary).length > 0 ||
        totalSecondsTodayForSummary > 0
      ) {
        updateSummaryDisplay(summaryEl, progressBarEl, summaryViewTitleEl);
      } else {
        summaryEl.textContent = 'Loading data...'; // Or keep previous message
        progressBarEl.style.display = 'none'; // Title will be updated by updateSummaryDisplay when data is ready
      }
    });
  }

  if (dateEl) {
    const today = new Date();
    const displayOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    try {
      dateEl.textContent =
        typeof formatDisplayDate === 'function'
          ? formatDisplayDate(today.toISOString().split('T')[0])
          : today.toLocaleDateString(navigator.language || 'en-US', displayOptions);
    } catch (e) {
      console.warn('Could not format date using browser locale, using default.', e);
      dateEl.textContent = today.toDateString();
    }
  }

  const dateStringFetcher =
    typeof getCurrentDateString === 'function'
      ? getCurrentDateString
      : () => new Date().toISOString().split('T')[0].replace(/-/g, '-');
  const todayStr = dateStringFetcher();

  function formatPomodoroFocusedTime(seconds) {
    const safeSeconds = Math.max(0, Number(seconds) || 0);
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }

  function renderPomodoroTodayStats(allDailyStats = {}) {
    if (!pomodoroTodayStatsEl) return;
    const todayStats = allDailyStats?.[todayStr] || {};
    const sessions = Math.max(0, Math.floor(Number(todayStats.workSessions) || 0));
    const focusedTime = formatPomodoroFocusedTime(todayStats.totalWorkTime);
    pomodoroTodayStatsEl.textContent = `Today: ${sessions} ${sessions === 1 ? 'session' : 'sessions'} · ${focusedTime}`;
    pomodoroTodayStatsEl.title = pomodoroTodayStatsEl.textContent;
    pomodoroTodayStatsEl.hidden = false;
  }

  browser.storage.local
    .get('pomodoroStatsDaily')
    .then((result) => renderPomodoroTodayStats(result.pomodoroStatsDaily))
    .catch(() => {
      if (pomodoroTodayStatsEl) pomodoroTodayStatsEl.hidden = true;
    });

  if (browser.storage.onChanged?.addListener) {
    browser.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.pomodoroStatsDaily) {
        renderPomodoroTodayStats(changes.pomodoroStatsDaily.newValue);
      }
    });
  }

  browser.storage.local
    .get(['dailyDomainData', 'dailyCategoryData', 'hourlyData', 'categoryProductivityRatings'])
    .then((result) => {
      todaysCategoryDataForSummary = result.dailyCategoryData?.[todayStr] || {};
      todaysDomainDataForSummary = result.dailyDomainData?.[todayStr] || {};
      todaysHourlyDataForToggle = result.hourlyData?.[todayStr] || {};
      const userRatings = result.categoryProductivityRatings || {};

      let calculatedTotal = 0;
      const domainDataForTotal = result.dailyDomainData?.[todayStr] || {};
      if (domainDataForTotal && Object.keys(domainDataForTotal).length > 0) {
        calculatedTotal = Object.values(domainDataForTotal).reduce((sum, time) => sum + time, 0);
      } else {
        const categoryDataForTotal = result.dailyCategoryData?.[todayStr] || {};
        if (categoryDataForTotal && Object.keys(categoryDataForTotal).length > 0) {
          calculatedTotal = Object.values(categoryDataForTotal).reduce((sum, time) => sum + time, 0);
        }
      }
      totalSecondsTodayForSummary = calculatedTotal;

      if (totalTimeEl)
        totalTimeEl.textContent =
          typeof formatTime === 'function'
            ? formatTime(totalSecondsTodayForSummary, true)
            : totalSecondsTodayForSummary + 's';

      if (summaryEl && progressBarEl && summaryViewTitleEl) {
        updateSummaryDisplay(summaryEl, progressBarEl, summaryViewTitleEl);
      }

      if (hourlyChartCtx) renderHourlyChart(hourlyChartCtx, todaysHourlyDataForToggle);

      if (focusScoreEl) {
        try {
          const scoreData =
            typeof calculateFocusScore === 'function'
              ? calculateFocusScore(todaysCategoryDataForSummary, userRatings)
              : { score: 0 };
          focusScoreEl.textContent = `Focus Score: ${scoreData.score}%`;
          focusScoreEl.classList.remove('score-low', 'score-medium', 'score-high');
          if (scoreData.score < 40) focusScoreEl.classList.add('score-low');
          else if (scoreData.score < 70) focusScoreEl.classList.add('score-medium');
          else focusScoreEl.classList.add('score-high');
        } catch (scoreError) {
          console.error('[Popup] Error calculating focus score:', scoreError);
          focusScoreEl.textContent = 'Focus Score: Error';
        }
      }
    })
    .catch((error) => {
      console.error('Error loading data for popup:', error);
      if (totalTimeEl) totalTimeEl.textContent = 'Error';
      if (summaryEl) {
        summaryEl.textContent = 'Error loading summary data.';
        if (summaryViewTitleEl) summaryViewTitleEl.textContent = 'Error';
      }
      if (progressBarEl) progressBarEl.style.display = 'none';
      if (hourlyChartCtx && hourlyChartCtx.canvas) {
        hourlyChartCtx.clearRect(0, 0, hourlyChartCtx.canvas.width, hourlyChartCtx.canvas.height);
        hourlyChartCtx.font = '12px sans-serif';
        hourlyChartCtx.fillStyle = '#aaa';
        hourlyChartCtx.textAlign = 'center';
        hourlyChartCtx.fillText(
          'Error loading chart data.',
          hourlyChartCtx.canvas.width / 2,
          hourlyChartCtx.canvas.height / 2
        );
      }
    });

  if (optionsBtn) {
    optionsBtn.addEventListener('click', () => browser.runtime.openOptionsPage());
  }

  const POMODORO_PHASES = { WORK: 'Work', SHORT_BREAK: 'Short Break', LONG_BREAK: 'Long Break' };

  function formatTimeForDisplay(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  async function updatePomodoroDisplay(state) {
    if (
      !pomodoroPhaseEl ||
      !pomodoroTimeEl ||
      !pomodoroStartPauseBtn ||
      !pomodoroNotifyIcon ||
      !pomodoroNotifyToggleBtn
    ) {
      console.warn('[Pomodoro Popup] One or more Pomodoro UI elements are missing. Cannot update display.');
      return;
    }

    if (!state) {
      console.warn('[Pomodoro Popup] No state received to update display.');
      pomodoroPhaseEl.textContent = 'N/A';
      pomodoroTimeEl.textContent = '--:--';
      if (pomodoroStartPauseBtn) pomodoroStartPauseBtn.textContent = 'Start';
      if (pomodoroStatusMessageEl) pomodoroStatusMessageEl.textContent = 'Loading...';
      if (pomodoroNotifyIcon) pomodoroNotifyIcon.textContent = '🔕';
      if (pomodoroNotifyToggleBtn) {
        pomodoroNotifyToggleBtn.title = 'Enable Notifications / Setup';
        pomodoroNotifyToggleBtn.setAttribute('aria-label', 'Setup Notifications in Options');
      }
      return;
    }

    pomodoroPhaseEl.textContent = state.currentPhase;
    pomodoroPhaseEl.classList.remove('work', 'short-break', 'long-break');
    if (state.currentPhase === POMODORO_PHASES.WORK) pomodoroPhaseEl.classList.add('work');
    else if (state.currentPhase === POMODORO_PHASES.SHORT_BREAK) pomodoroPhaseEl.classList.add('short-break');
    else if (state.currentPhase === POMODORO_PHASES.LONG_BREAK) pomodoroPhaseEl.classList.add('long-break');

    pomodoroTimeEl.textContent = formatTimeForDisplay(state.remainingTime);

    if (pomodoroStartPauseBtn) {
      if (state.timerState === 'running') {
        pomodoroStartPauseBtn.textContent = 'Pause';
      } else if (state.timerState === 'paused') {
        pomodoroStartPauseBtn.textContent = 'Resume';
      } else {
        // 'stopped'
        pomodoroStartPauseBtn.textContent = 'Start';
      }
    }

    const isNotifyEffectivelyEnabled = state.notifyEnabled === true;

    if (isNotifyEffectivelyEnabled) {
      pomodoroNotifyIcon.textContent = '🔔';
      pomodoroNotifyToggleBtn.title = 'Notifications: On (Click to disable)';
      pomodoroNotifyToggleBtn.setAttribute('aria-label', 'Disable Notifications');
    } else {
      pomodoroNotifyIcon.textContent = '🔕';
      try {
        const hasPermission = await browser.permissions.contains({ permissions: ['notifications'] });
        if (hasPermission) {
          pomodoroNotifyToggleBtn.title = 'Notifications: Off (Click to enable)';
          pomodoroNotifyToggleBtn.setAttribute('aria-label', 'Enable Notifications');
        } else {
          pomodoroNotifyToggleBtn.title = 'Notifications: Setup Required (Click to open settings)';
          pomodoroNotifyToggleBtn.setAttribute('aria-label', 'Setup Notifications in Options');
        }
      } catch (err) {
        console.warn('[Popup] Error checking notification permission for title (updatePomodoroDisplay):', err);
        pomodoroNotifyToggleBtn.title = 'Notifications: Check Settings';
        pomodoroNotifyToggleBtn.setAttribute('aria-label', 'Check Notification Settings');
      }
    }

    /*****************************************************************
     * START of Added/Modified Code
     *****************************************************************/
    // This logic is now wrapped in a check to see if we are showing a temporary message.
    if (pomodoroStatusMessageEl && !isDisplayingTempStatus) {
      /*****************************************************************
       * END of Added/Modified Code
       *****************************************************************/
      if (state.timerState === 'paused') {
        pomodoroStatusMessageEl.textContent = 'Paused';
      } else if (
        state.timerState === 'stopped' &&
        state.currentPhase !== POMODORO_PHASES.WORK &&
        state.durations &&
        state.remainingTime < state.durations[state.currentPhase]
      ) {
        pomodoroStatusMessageEl.textContent = `${state.currentPhase} complete. Start next?`;
      } else if (
        state.timerState === 'stopped' &&
        state.currentPhase === POMODORO_PHASES.WORK &&
        state.workSessionsCompleted > 0 &&
        state.durations &&
        state.remainingTime < state.durations[state.currentPhase]
      ) {
        pomodoroStatusMessageEl.textContent = `Work session complete.`;
      } else {
        pomodoroStatusMessageEl.textContent = '';
      }
    }
  }

  function showCustomConfirm(message, onConfirm, onCancel) {
    if (customConfirmModalEl && customConfirmMessageEl) {
      customConfirmMessageEl.textContent = message;
      confirmYesCallback = onConfirm;
      confirmNoCallback = onCancel;
      customConfirmModalEl.style.display = 'flex';
    }
  }
  function hideCustomConfirm() {
    if (customConfirmModalEl) customConfirmModalEl.style.display = 'none';
    confirmYesCallback = null;
    confirmNoCallback = null;
  }
  if (customConfirmYesBtn) {
    customConfirmYesBtn.addEventListener('click', () => {
      if (typeof confirmYesCallback === 'function') confirmYesCallback();
      hideCustomConfirm();
    });
  }
  if (customConfirmNoBtn) {
    customConfirmNoBtn.addEventListener('click', () => {
      if (typeof confirmNoCallback === 'function') confirmNoCallback();
      hideCustomConfirm();
    });
  }
  if (customConfirmModalEl) {
    customConfirmModalEl.addEventListener('click', (event) => {
      if (event.target === customConfirmModalEl) {
        if (typeof confirmNoCallback === 'function') confirmNoCallback();
        hideCustomConfirm();
      }
    });
  }

  if (pomodoroStartPauseBtn) {
    pomodoroStartPauseBtn.addEventListener('click', () => {
      // Clear any pending message timeout when a new action is taken
      if (statusMessageTimeoutId) clearTimeout(statusMessageTimeoutId);
      isDisplayingTempStatus = false;

      const currentButtonText = pomodoroStartPauseBtn.textContent;
      const action =
        currentButtonText === 'Start' || currentButtonText === 'Resume' ? 'startPomodoro' : 'pausePomodoro';
      browser.runtime
        .sendMessage({ action: action })
        .then(fetchAndUpdatePomodoroStatus)
        .catch((err) => console.error(`Error sending ${action}:`, err));
    });
  }

  if (pomodoroResetBtn) {
    pomodoroResetBtn.addEventListener('click', () => {
      // Clear any pending message timeout when a new action is taken
      if (statusMessageTimeoutId) clearTimeout(statusMessageTimeoutId);
      isDisplayingTempStatus = false;

      browser.runtime
        .sendMessage({ action: 'getPomodoroStatus' })
        .then((state) => {
          if (!state || !state.durations) {
            console.error('Cannot reset, invalid state from background:', state);
            return;
          }
          const isAtStartOfPhase =
            state.timerState === 'stopped' &&
            state.durations &&
            state.remainingTime === state.durations[state.currentPhase];

          if (isAtStartOfPhase) {
            /*****************************************************************
             * START of Added/Modified Code
             *****************************************************************/
            if (pomodoroStatusMessageEl) {
              isDisplayingTempStatus = true; // Set the flag
              pomodoroStatusMessageEl.textContent = 'Timer is already at the start.';
              statusMessageTimeoutId = setTimeout(() => {
                if (
                  pomodoroStatusMessageEl &&
                  pomodoroStatusMessageEl.textContent === 'Timer is already at the start.'
                ) {
                  pomodoroStatusMessageEl.textContent = '';
                }
                isDisplayingTempStatus = false; // Clear the flag
              }, 3000);
            }
            /*****************************************************************
             * END of Added/Modified Code
             *****************************************************************/
            return;
          }
          const message = `Reset current ${state.currentPhase} timer?`;
          showCustomConfirm(message, () => {
            browser.runtime
              .sendMessage({ action: 'resetPomodoro', resetCycle: false })
              .then(fetchAndUpdatePomodoroStatus)
              .catch((err) => console.error('Error sending resetPomodoro:', err));
          });
        })
        .catch((err) => console.error('Error getting status for reset:', err));
    });
  }

  if (pomodoroChangePhaseBtn) {
    pomodoroChangePhaseBtn.addEventListener('click', () => {
      // Clear any pending message timeout when a new action is taken
      if (statusMessageTimeoutId) clearTimeout(statusMessageTimeoutId);
      isDisplayingTempStatus = false;

      browser.runtime
        .sendMessage({ action: 'getPomodoroStatus' })
        .then((state) => {
          if (!state) {
            console.error('Cannot switch timer, invalid state from background.');
            return;
          }
          if (state.timerState === 'running' || state.timerState === 'paused') {
            showCustomConfirm('Switching the timer will stop the current session. Continue?', () => {
              browser.runtime
                .sendMessage({ action: 'changePomodoroPhase' })
                .then(fetchAndUpdatePomodoroStatus)
                .catch((err) => console.error('Error sending changePomodoroPhase:', err));
            });
          } else {
            browser.runtime
              .sendMessage({ action: 'changePomodoroPhase' })
              .then(fetchAndUpdatePomodoroStatus)
              .catch((err) => console.error('Error sending changePomodoroPhase:', err));
          }
        })
        .catch((err) => console.error('Error getting status for switch timer:', err));
    });
  }

  async function handleNotifyToggleClick() {
    console.log('[Popup] handleNotifyToggleClick initiated.');
    if (!pomodoroNotifyToggleBtn) {
      console.error('[Popup] pomodoroNotifyToggleBtn not found in handleNotifyToggleClick.');
      return;
    }

    try {
      console.log('[Popup] Checking notification permissions...');
      const hasPermission = await browser.permissions.contains({ permissions: ['notifications'] });
      console.log(`[Popup] Notification permission present: ${hasPermission}`);

      if (hasPermission) {
        console.log('[Popup] Permission granted. Getting current Pomodoro status to determine toggle direction...');
        const currentState = await browser.runtime.sendMessage({ action: 'getPomodoroStatus' });

        if (currentState) {
          const currentNotifySettingEnabled = currentState.notifyEnabled;
          const newDesiredState = !currentNotifySettingEnabled;
          console.log(
            `[Popup] Current notifyEnabled from background: ${currentNotifySettingEnabled}. Requesting change to: ${newDesiredState}`
          );
          browser.runtime
            .sendMessage({
              action: 'updatePomodoroNotificationSetting',
              enabled: newDesiredState,
            })
            .catch((err) => {
              console.error('[Popup] Error sending notification toggle message to background:', err);
              fetchAndUpdatePomodoroStatus();
            });
        } else {
          console.error('[Popup] Could not get current Pomodoro status to determine toggle direction.');
          fetchAndUpdatePomodoroStatus();
        }
      } else {
        console.log('[Popup] Notification permission not granted. Opening options page to #pomodoro-settings-section.');
        const optionsUrl = browser.runtime.getURL('options/options.html#pomodoro-settings-section');
        browser.tabs.create({ url: optionsUrl });
        window.close();
      }
    } catch (err) {
      console.error('[Popup] Error in handleNotifyToggleClick:', err);
      try {
        browser.runtime.openOptionsPage();
        window.close();
      } catch (openErr) {
        console.error('[Popup] Could not open options page on error:', openErr);
      }
    }
  }

  if (pomodoroNotifyToggleBtn) {
    console.log('[Popup] Adding click listener to pomodoroNotifyToggleBtn.');
    pomodoroNotifyToggleBtn.addEventListener('click', handleNotifyToggleClick);
  } else {
    console.error('[Popup] pomodoroNotifyToggleBtn element not found. Cannot add listener.');
  }

  function fetchAndUpdatePomodoroStatus() {
    if (!browser.runtime || !browser.runtime.sendMessage) {
      console.warn('[Pomodoro Popup] Browser runtime or sendMessage not available. Cannot fetch status.');
      updatePomodoroDisplay(null);
      return Promise.resolve();
    }
    return browser.runtime
      .sendMessage({ action: 'getPomodoroStatus' })
      .then((response) => {
        if (response) {
          updatePomodoroDisplay(response);
        } else {
          console.warn('[Pomodoro Popup] No response or error from getPomodoroStatus.');
          updatePomodoroDisplay(null);
        }
      })
      .catch((err) => {
        console.error('Error fetching Pomodoro status:', err);
        updatePomodoroDisplay(null);
      });
  }

  fetchAndUpdatePomodoroStatus();

  if (popupUpdateIntervalId) {
    clearInterval(popupUpdateIntervalId);
  }
  popupUpdateIntervalId = setInterval(() => {
    if (document.visibilityState === 'visible') {
      fetchAndUpdatePomodoroStatus();
    }
  }, 1000);

  browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'pomodoroStatusUpdate' && request.status) {
      console.log('[Popup] Received direct pomodoroStatusUpdate from background:', request.status);
      updatePomodoroDisplay(request.status);
    }
    return true;
  });
});
