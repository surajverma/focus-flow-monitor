const PRUNE_ALARM_NAME = 'dailyDataPruneCheck'; // Used for the daily data pruning alarm

// --- State Update Queue ---
let eventQueue = [];
let isProcessingQueue = false;

// New function to process the state update queue sequentially
async function processStateUpdateQueue() {
  if (isProcessingQueue || eventQueue.length === 0) {
    return;
  }
  isProcessingQueue = true;
  const eventContext = eventQueue.shift(); // Get the oldest event

  await updateTrackingStateImplementation(eventContext); // from tracking.js

  isProcessingQueue = false;
  // Process the next item in the queue if any exist
  processStateUpdateQueue();
}

// New function to update the in-memory cache for blocking rules
async function updateRuleAndAssignmentCache() {
  try {
    const result = await browser.storage.local.get(['rules', 'categoryAssignments']);
    const persistedRules = result.rules || [];
    // Merge persisted rules with ephemeral Pomodoro rules (if any)
    const ephemeral = Array.isArray(FocusFlowState.ephemeralPomodoroRules)
      ? FocusFlowState.ephemeralPomodoroRules
      : [];
    FocusFlowState.activeBlockingRules = [...persistedRules, ...ephemeral];
    FocusFlowState.activeCategoryAssignments = result.categoryAssignments || {};
    // Keep the base assignments in sync for getCategoryForDomain utility
    FocusFlowState.categoryAssignments = result.categoryAssignments || {};
    console.log('[Cache] Updated active blocking rules and assignments in memory.');
  } catch (err) {
    console.error('[Cache] Failed to update caches:', err);
    // Fallback to empty on error to prevent faulty blocking
    FocusFlowState.activeBlockingRules = [];
    FocusFlowState.activeCategoryAssignments = {};
  }
}

const POMODORO_PHASES = { WORK: 'Work', SHORT_BREAK: 'Short Break', LONG_BREAK: 'Long Break' };

// Default settings, will be overridden by loaded settings
let pomodoroSettings = {
  durations: {
    [POMODORO_PHASES.WORK]: 25 * 60,
    [POMODORO_PHASES.SHORT_BREAK]: 5 * 60,
    [POMODORO_PHASES.LONG_BREAK]: 15 * 60,
  },
  sessionsBeforeLongBreak: 4,
  notifyEnabled: true,
  // New settings for dynamic blocking during Work phase
  blockDuringWorkEnabled: false,
  blockedCategoriesDuringWork: [],
};

// Active state of the timer
let pomodoroState = {
  currentPhase: POMODORO_PHASES.WORK,
  remainingTime: pomodoroSettings.durations[POMODORO_PHASES.WORK], // Initialize with default or loaded work duration
  workSessionsCompleted: 0,
  timerState: 'stopped', // 'stopped', 'running', 'paused'
  timerIntervalId: null,
};

/**
 * Sends the current Pomodoro status to any open popups.
 * It now reconciles notifyEnabled with actual permission before sending.
 */
async function sendPomodoroStatusToPopups() {
  if (browser.runtime && browser.runtime.sendMessage) {
    // Reconcile notifyEnabled before sending
    let notifyStateChanged = false;
    if (pomodoroSettings.notifyEnabled) {
      try {
        const hasPermission = await browser.permissions.contains({ permissions: ['notifications'] });
        if (!hasPermission) {
          console.log(
            '[Pomodoro Background] sendPomodoroStatusToPopups: notifyEnabled was true, but permission missing. Updating to false.'
          );
          pomodoroSettings.notifyEnabled = false;
          notifyStateChanged = true;
        }
      } catch (err) {
        console.error('[Pomodoro Background] sendPomodoroStatusToPopups: Error checking notification permission:', err);
        if (pomodoroSettings.notifyEnabled) {
          pomodoroSettings.notifyEnabled = false; // Assume no permission on error
          notifyStateChanged = true;
        }
      }
    }

    if (notifyStateChanged) {
      await savePomodoroStateAndSettings(); // Save the reconciled notifyEnabled state
    }

    const statusPayload = {
      ...pomodoroState,
      durations: pomodoroSettings.durations, // Send current durations
      notifyEnabled: pomodoroSettings.notifyEnabled,
    };
    browser.runtime
      .sendMessage({
        action: 'pomodoroStatusUpdate',
        status: statusPayload,
      })
      .catch((err) => {
        // This error is common if no popup is open, so often benign.
      });
  }
}

function updatePomodoroBadge() {
  let badgeText = '';
  let badgeColor = '#808080'; // Default grey

  if (pomodoroState.timerState === 'running') {
    const minutes = Math.floor(pomodoroState.remainingTime / 60);
    badgeText = minutes > 0 ? `${String(minutes)}` : pomodoroState.remainingTime > 0 ? '<1' : '0';
    badgeColor =
      pomodoroState.currentPhase === POMODORO_PHASES.WORK
        ? '#28a745' // Green for work
        : pomodoroState.currentPhase === POMODORO_PHASES.SHORT_BREAK
        ? '#fd7e14' // Orange for short break
        : '#ffc107'; // Yellow for long break
  } else if (pomodoroState.timerState === 'paused') {
    badgeText = '❚❚'; // Pause symbol
    badgeColor = '#808080'; // Grey for paused
  }

  try {
    browser.browserAction.setBadgeText({ text: badgeText });
    browser.browserAction.setBadgeBackgroundColor({ color: badgeColor });
  } catch (e) {
    console.error('[Pomodoro] Error setting badge text or color:', e);
  }
}

async function sendPomodoroNotification(phaseName, nextPhaseName) {
  if (!pomodoroSettings.notifyEnabled) {
    console.log('[Pomodoro] Notifications are disabled by user setting (notifyEnabled=false). Skipping notification.');
    return;
  }

  try {
    const hasPermission = await browser.permissions.contains({ permissions: ['notifications'] });
    if (!hasPermission) {
      console.log('[Pomodoro] Notification permission not granted. Skipping notification and updating setting.');
      if (pomodoroSettings.notifyEnabled) {
        // Should already be false due to checks in sendPomodoroStatusToPopups
        pomodoroSettings.notifyEnabled = false;
        await savePomodoroStateAndSettings(); // Save updated setting
        sendPomodoroStatusToPopups(); // Inform popups
      }
      return;
    }

    browser.notifications.create(`pomodoro-${Date.now()}`, {
      type: 'basic',
      iconUrl: browser.runtime.getURL('icons/icon-48.png'),
      title: `FocusFlow: ${phaseName} Complete!`,
      message: `Time for your ${nextPhaseName.toLowerCase()}. Click Start in the popup when ready.`,
      priority: 2,
    });
    console.log(`[Pomodoro] Notification sent for ${phaseName} completion.`);
  } catch (e) {
    console.error('[Pomodoro] Error creating notification:', e);
  }
}

async function savePomodoroStateAndSettings() {
  try {
    await browser.storage.local.set({
      [FocusFlowState.STORAGE_KEY_POMODORO_STATE]: {
        // Active timer state
        currentPhase: pomodoroState.currentPhase,
        remainingTime: pomodoroState.remainingTime,
        workSessionsCompleted: pomodoroState.workSessionsCompleted,
        timerState: pomodoroState.timerState,
      },
      [FocusFlowState.STORAGE_KEY_POMODORO_SETTINGS]: {
        // User configurations
        durations: pomodoroSettings.durations,
        sessionsBeforeLongBreak: pomodoroSettings.sessionsBeforeLongBreak,
        notifyEnabled: pomodoroSettings.notifyEnabled,
      },
      // Pomodoro stats are saved via FocusFlowState by performSave in storage.js
    });
    console.log('[Pomodoro Background] Saved Pomodoro state and settings to storage.');
  } catch (error) {
    console.error('[Pomodoro Background] Error saving state and settings:', error);
  }
}

async function loadPomodoroStateAndSettings() {
  try {
    const result = await browser.storage.local.get([
      FocusFlowState.STORAGE_KEY_POMODORO_STATE,
      FocusFlowState.STORAGE_KEY_POMODORO_SETTINGS,
    ]);

    const defaultDurations = {
      [POMODORO_PHASES.WORK]: 25 * 60,
      [POMODORO_PHASES.SHORT_BREAK]: 5 * 60,
      [POMODORO_PHASES.LONG_BREAK]: 15 * 60,
    };
    const defaultSessions = 4;

    if (result[FocusFlowState.STORAGE_KEY_POMODORO_SETTINGS]) {
      const loadedSettings = result[FocusFlowState.STORAGE_KEY_POMODORO_SETTINGS];
      pomodoroSettings.durations = loadedSettings.durations || defaultDurations;
      pomodoroSettings.sessionsBeforeLongBreak = loadedSettings.sessionsBeforeLongBreak || defaultSessions;
      pomodoroSettings.notifyEnabled = loadedSettings.notifyEnabled !== undefined ? loadedSettings.notifyEnabled : true;
      pomodoroSettings.blockDuringWorkEnabled = !!loadedSettings.blockDuringWorkEnabled;
      pomodoroSettings.blockedCategoriesDuringWork = Array.isArray(loadedSettings.blockedCategoriesDuringWork)
        ? loadedSettings.blockedCategoriesDuringWork
        : [];
    } else {
      // No settings saved, use defaults
      pomodoroSettings.durations = defaultDurations;
      pomodoroSettings.sessionsBeforeLongBreak = defaultSessions;
      pomodoroSettings.notifyEnabled = true; // Default to true
      pomodoroSettings.blockDuringWorkEnabled = false;
      pomodoroSettings.blockedCategoriesDuringWork = [];
      console.log('[Pomodoro Load] No stored settings, using defaults.');
    }

    if (result[FocusFlowState.STORAGE_KEY_POMODORO_STATE]) {
      const persisted = result[FocusFlowState.STORAGE_KEY_POMODORO_STATE];
      pomodoroState.currentPhase = persisted.currentPhase || POMODORO_PHASES.WORK;
      // Ensure the current phase from state exists in the potentially new settings, or default to WORK phase duration
      const currentPhaseDuration =
        pomodoroSettings.durations[pomodoroState.currentPhase] || pomodoroSettings.durations[POMODORO_PHASES.WORK];
      pomodoroState.remainingTime =
        persisted.remainingTime !== undefined
          ? Math.min(persisted.remainingTime, currentPhaseDuration) // Ensure remaining time isn't > new duration
          : currentPhaseDuration;
      pomodoroState.workSessionsCompleted = persisted.workSessionsCompleted || 0;
      // If the timer was 'running' when the browser closed/crashed, set it to 'paused' on load.
      pomodoroState.timerState = persisted.timerState === 'running' ? 'paused' : persisted.timerState || 'stopped';
    } else {
      // No persisted state, initialize from (potentially new) settings
      pomodoroState.currentPhase = POMODORO_PHASES.WORK;
      pomodoroState.remainingTime = pomodoroSettings.durations[POMODORO_PHASES.WORK];
      pomodoroState.workSessionsCompleted = 0;
      pomodoroState.timerState = 'stopped';
    }

    // Reconcile notifyEnabled with actual permissions
    let settingsChangedOnLoad = false;
    if (pomodoroSettings.notifyEnabled) {
      const hasPermission = await browser.permissions.contains({ permissions: ['notifications'] });
      if (!hasPermission) {
        console.warn('[Pomodoro Load] notifyEnabled was true in storage, but permission is missing. Setting to false.');
        pomodoroSettings.notifyEnabled = false;
        settingsChangedOnLoad = true; // Mark to save this reconciled state
      }
    }

    if (settingsChangedOnLoad) {
      await savePomodoroStateAndSettings(); // Save if notifyEnabled was changed due to permission check
    }

    console.log('[Pomodoro] Initial state/settings loaded/set:', pomodoroState, pomodoroSettings);
    updatePomodoroBadge();
    sendPomodoroStatusToPopups(); // Send initial status
  } catch (error) {
    console.error('[Pomodoro] Error loading state/settings:', error);
    // Fallback to defaults in case of error, ensuring pomodoroSettings has valid structure
    pomodoroSettings.durations = { work: 25 * 60, shortBreak: 5 * 60, longBreak: 15 * 60 };
    pomodoroSettings.sessionsBeforeLongBreak = 4;
    pomodoroSettings.notifyEnabled = true; // Default intent
    pomodoroState.currentPhase = POMODORO_PHASES.WORK;
    pomodoroState.remainingTime = pomodoroSettings.durations[POMODORO_PHASES.WORK];
    pomodoroState.workSessionsCompleted = 0;
    pomodoroState.timerState = 'stopped';
    updatePomodoroBadge();
    sendPomodoroStatusToPopups();
  }
}

// --- Ephemeral Pomodoro blocking rules helpers (global) ---
function clearEphemeralPomodoroRules() {
  FocusFlowState.ephemeralPomodoroRules = [];
}

async function updateEphemeralPomodoroRulesForPhase(phase) {
  try {
    if (phase === POMODORO_PHASES.WORK && pomodoroSettings.blockDuringWorkEnabled) {
      const cats = Array.isArray(pomodoroSettings.blockedCategoriesDuringWork)
        ? pomodoroSettings.blockedCategoriesDuringWork
        : [];
      FocusFlowState.ephemeralPomodoroRules = cats
        .filter(Boolean)
        .map((cat) => ({ type: 'block-category', value: cat }));
    } else {
      clearEphemeralPomodoroRules();
    }
  } catch (e) {
    console.error('[Pomodoro] Failed to update ephemeral rules for phase:', phase, e);
    clearEphemeralPomodoroRules();
  }
}

function setupPomodoroPhase(phase, sessionsCompleted = pomodoroState.workSessionsCompleted) {
  if (pomodoroState.timerIntervalId) clearInterval(pomodoroState.timerIntervalId);
  pomodoroState.timerIntervalId = null;
  pomodoroState.currentPhase = phase;
  pomodoroState.remainingTime = pomodoroSettings.durations[phase]; // Use configured duration
  pomodoroState.workSessionsCompleted = sessionsCompleted;
  pomodoroState.timerState = 'stopped';

  console.log(
    `[Pomodoro] Phase set up: ${phase}, Duration: ${pomodoroState.remainingTime}s, Sessions Completed: ${sessionsCompleted}`
  );
  updatePomodoroBadge();
  sendPomodoroStatusToPopups();
  savePomodoroStateAndSettings();

  // Update ephemeral rules based on phase
  updateEphemeralPomodoroRulesForPhase(phase).then(updateRuleAndAssignmentCache);
}

function recordPomodoroSession(phase, durationSeconds) {
  if (phase !== POMODORO_PHASES.WORK || durationSeconds <= 0) {
    return;
  }
  const todayStr = getCurrentDateString(); // from utils.js

  FocusFlowState.pomodoroDailyStats[todayStr] = FocusFlowState.pomodoroDailyStats[todayStr] || {
    workSessions: 0,
    totalWorkTime: 0,
  };
  FocusFlowState.pomodoroDailyStats[todayStr].workSessions += 1;
  FocusFlowState.pomodoroDailyStats[todayStr].totalWorkTime += durationSeconds;

  FocusFlowState.pomodoroAllTimeStats.totalWorkSessionsCompleted =
    (FocusFlowState.pomodoroAllTimeStats.totalWorkSessionsCompleted || 0) + 1;
  FocusFlowState.pomodoroAllTimeStats.totalTimeFocused =
    (FocusFlowState.pomodoroAllTimeStats.totalTimeFocused || 0) + durationSeconds;

  console.log(
    `[Pomodoro Stats] Recorded work session for ${todayStr}: ${durationSeconds}s. Total today: ${FocusFlowState.pomodoroDailyStats[todayStr].workSessions} sessions, ${FocusFlowState.pomodoroDailyStats[todayStr].totalWorkTime}s. All time: ${FocusFlowState.pomodoroAllTimeStats.totalWorkSessionsCompleted} sessions, ${FocusFlowState.pomodoroAllTimeStats.totalTimeFocused}s`
  );
  saveDataBatched(); // This will save FocusFlowState which now includes pomodoroDailyStats and pomodoroAllTimeStats
}

function pomodoroTick() {
  if (pomodoroState.timerState !== 'running' || pomodoroState.remainingTime <= 0) {
    if (pomodoroState.timerIntervalId) clearInterval(pomodoroState.timerIntervalId);
    pomodoroState.timerIntervalId = null;
    if (pomodoroState.remainingTime > 0 && pomodoroState.timerState === 'running') {
      // Timer was running but somehow remainingTime became non-positive without phase completion
      pomodoroState.timerState = 'paused'; // Safety pause
      updatePomodoroBadge();
      sendPomodoroStatusToPopups();
      savePomodoroStateAndSettings();
    }
    return;
  }

  pomodoroState.remainingTime--;
  updatePomodoroBadge(); // Update badge every second
  sendPomodoroStatusToPopups(); // Update popup every second

  if (pomodoroState.remainingTime <= 0) {
    if (pomodoroState.timerIntervalId) clearInterval(pomodoroState.timerIntervalId);
    pomodoroState.timerIntervalId = null;
    pomodoroState.timerState = 'stopped';

    const justFinishedPhase = pomodoroState.currentPhase;
    const durationOfPhase = pomodoroSettings.durations[justFinishedPhase]; // Get the configured duration

    let nextPhase;
    let sessions = pomodoroState.workSessionsCompleted;

    if (pomodoroState.currentPhase === POMODORO_PHASES.WORK) {
      sessions++;
      recordPomodoroSession(POMODORO_PHASES.WORK, durationOfPhase); // Record the completed work session
      console.log(`[Pomodoro Stats] Work session ${sessions} completed.`);
      nextPhase =
        sessions % pomodoroSettings.sessionsBeforeLongBreak === 0
          ? POMODORO_PHASES.LONG_BREAK
          : POMODORO_PHASES.SHORT_BREAK;
    } else {
      // Break finished
      nextPhase = POMODORO_PHASES.WORK;
      if (justFinishedPhase === POMODORO_PHASES.LONG_BREAK) {
        sessions = 0; // Reset session count after a long break
      }
    }
    sendPomodoroNotification(justFinishedPhase, nextPhase);
    setupPomodoroPhase(nextPhase, sessions); // This also saves state
  } else {
    // Save state periodically (e.g., every 10 seconds) to avoid too frequent writes
    if (pomodoroState.remainingTime % 10 === 0) {
      savePomodoroStateAndSettings();
    }
  }
}

function startPomodoroTimer() {
  if (pomodoroState.timerState === 'running') return;

  pomodoroState.timerState = 'running';
  if (pomodoroState.timerIntervalId) clearInterval(pomodoroState.timerIntervalId);
  pomodoroState.timerIntervalId = setInterval(pomodoroTick, 1000);

  console.log('[Pomodoro] Timer started/resumed.');
  updatePomodoroBadge();
  sendPomodoroStatusToPopups();
  savePomodoroStateAndSettings();

  // If starting in Work, ensure ephemeral rules are active
  if (pomodoroState.currentPhase === POMODORO_PHASES.WORK) {
    updateEphemeralPomodoroRulesForPhase(POMODORO_PHASES.WORK).then(updateRuleAndAssignmentCache);
  }
}

function pausePomodoroTimer() {
  if (pomodoroState.timerState !== 'running') return;

  if (pomodoroState.timerIntervalId) clearInterval(pomodoroState.timerIntervalId);
  pomodoroState.timerIntervalId = null;
  pomodoroState.timerState = 'paused';

  console.log('[Pomodoro] Timer paused.');
  updatePomodoroBadge();
  sendPomodoroStatusToPopups();
  savePomodoroStateAndSettings();

  // On pause, remove ephemeral rules to unblock
  clearEphemeralPomodoroRules();
  updateRuleAndAssignmentCache();
}

function resetPomodoroTimer(resetCycle = false) {
  if (pomodoroState.timerIntervalId) clearInterval(pomodoroState.timerIntervalId);
  pomodoroState.timerIntervalId = null;

  let sessionsToSet = pomodoroState.workSessionsCompleted;
  if (resetCycle) {
    sessionsToSet = 0;
    pomodoroState.currentPhase = POMODORO_PHASES.WORK; // Reset to work phase if cycle is reset
  }
  // Set remaining time based on potentially updated settings for the current phase
  pomodoroState.remainingTime = pomodoroSettings.durations[pomodoroState.currentPhase];
  pomodoroState.timerState = 'stopped';
  pomodoroState.workSessionsCompleted = sessionsToSet;

  console.log(
    `[Pomodoro] Timer reset. Cycle reset: ${resetCycle}. Sessions now: ${pomodoroState.workSessionsCompleted}`
  );
  updatePomodoroBadge();
  sendPomodoroStatusToPopups();
  savePomodoroStateAndSettings();

  // On reset, remove ephemeral rules
  clearEphemeralPomodoroRules();
  updateRuleAndAssignmentCache();
}

function skipPomodoroPhase() {
  if (pomodoroState.currentPhase === POMODORO_PHASES.WORK) {
    console.log('[Pomodoro] Cannot skip Work phase. Use "Switch Timer" or let it complete.');
    return; // Or, alternatively, implement skipping work to next break if desired.
  }
  if (pomodoroState.timerIntervalId) clearInterval(pomodoroState.timerIntervalId);
  pomodoroState.timerIntervalId = null;

  console.log(`[Pomodoro] Skipping ${pomodoroState.currentPhase}. Setting up Work phase.`);
  setupPomodoroPhase(POMODORO_PHASES.WORK, pomodoroState.workSessionsCompleted);
}

function changeToNextPomodoroPhase() {
  if (pomodoroState.timerIntervalId) clearInterval(pomodoroState.timerIntervalId);
  pomodoroState.timerIntervalId = null;
  pomodoroState.timerState = 'stopped';

  let nextPhase;
  let sessions = pomodoroState.workSessionsCompleted;

  switch (pomodoroState.currentPhase) {
    case POMODORO_PHASES.WORK:
      nextPhase = POMODORO_PHASES.SHORT_BREAK;
      break;
    case POMODORO_PHASES.SHORT_BREAK:
      nextPhase = POMODORO_PHASES.LONG_BREAK;
      break;
    case POMODORO_PHASES.LONG_BREAK:
    default: // Fallback if currentPhase is somehow unknown
      nextPhase = POMODORO_PHASES.WORK;
      sessions = 0; // Reset sessions if coming from long break or unknown state
      break;
  }
  console.log(
    `[Pomodoro] Manually changing phase from ${pomodoroState.currentPhase} to ${nextPhase}. Sessions to be set: ${sessions}`
  );
  setupPomodoroPhase(nextPhase, sessions);
}

async function setupAlarms() {
  try {
    const trackAlarm = await browser.alarms.get(FocusFlowState.ALARM_NAME);
    if (!trackAlarm || trackAlarm.periodInMinutes !== FocusFlowState.ALARM_PERIOD_MINUTES) {
      browser.alarms.create(FocusFlowState.ALARM_NAME, { periodInMinutes: FocusFlowState.ALARM_PERIOD_MINUTES });
      console.log(`[Alarm] ${trackAlarm ? 'Recreated' : 'Created'} tracking alarm: ${FocusFlowState.ALARM_NAME}`);
    }

    const pruneAlarm = await browser.alarms.get(PRUNE_ALARM_NAME);
    const dailyPeriod = 1440; // 24 hours in minutes
    if (!pruneAlarm) {
      browser.alarms.create(PRUNE_ALARM_NAME, { delayInMinutes: 15, periodInMinutes: dailyPeriod });
      console.log(`[Alarm] Created pruning alarm: ${PRUNE_ALARM_NAME} (runs daily, first run in ~15min)`);
    } else if (pruneAlarm.periodInMinutes !== dailyPeriod) {
      browser.alarms.clear(PRUNE_ALARM_NAME);
      browser.alarms.create(PRUNE_ALARM_NAME, { delayInMinutes: 1, periodInMinutes: dailyPeriod }); // Recreate with short delay if period was wrong
      console.log(`[Alarm] Recreated pruning alarm with correct period: ${PRUNE_ALARM_NAME}`);
    }
  } catch (error) {
    console.error('[Alarm] Error setting up alarms:', error);
  }
}

async function initializeExtension() {
  await loadData(); // from storage.js - also loads pomodoro stats
  await loadPomodoroStateAndSettings(); // Loads pomodoro timer state and user configurations

  await updateRuleAndAssignmentCache(); // Initialize the rule cache on startup

  await setupAlarms();

  try {
    if (
      browser.webRequest &&
      browser.webRequest.onBeforeRequest &&
      !browser.webRequest.onBeforeRequest.hasListener(handleBlockingRequest) // handleBlockingRequest from blocking.js
    ) {
      browser.webRequest.onBeforeRequest.addListener(
        handleBlockingRequest, // from blocking.js
        { urls: ['<all_urls>'], types: ['main_frame'] },
        ['blocking']
      );
      console.log('[System] Request listener for blocking registered.');
    } else if (browser.webRequest?.onBeforeRequest?.hasListener(handleBlockingRequest)) {
      console.log('[System] Request listener for blocking already registered.');
    } else {
      console.error('[System] browser.webRequest API not available for blocking. Blocking feature will not work.');
    }
  } catch (error) {
    console.error('[System] CRITICAL: Failed to register request listener for blocking.', error);
  }

  console.log('[System] Background script initialization complete.');
}

// Replace all listeners to use the queue system
browser.tabs.onActivated.addListener(() => {
  eventQueue.push('tabs.onActivated');
  processStateUpdateQueue();
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab && tab.url && getDomain(tab.url)) {
    browser.windows
      .getLastFocused({ populate: true, windowTypes: ['normal'] })
      .then((currentWindow) => {
        if (currentWindow && currentWindow.focused) {
          const activeTab = currentWindow.tabs.find((t) => t.active);
          if (activeTab && activeTab.id === tabId) {
            eventQueue.push('tabs.onUpdated (complete)');
            processStateUpdateQueue();
          }
        }
      })
      .catch((e) => {
        /* Benign error */
      });
  }
});

browser.windows.onFocusChanged.addListener(() => {
  eventQueue.push('windows.onFocusChanged');
  processStateUpdateQueue();
});

browser.idle.onStateChanged.addListener((newState) => {
  eventQueue.push(`idle.onStateChanged (${newState})`);
  processStateUpdateQueue();
});

browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === FocusFlowState.ALARM_NAME) {
    eventQueue.push(FocusFlowState.ALARM_NAME);
    processStateUpdateQueue();
    await checkTimeLimitsAndRedirectIfNeeded(); // Async limit check
  } else if (alarm.name === PRUNE_ALARM_NAME) {
    console.log(`[Alarm] Triggered: ${PRUNE_ALARM_NAME}`);
    await pruneOldData(); // from storage.js
  }
});

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    if (
      request.action === 'categoriesUpdated' ||
      request.action === 'rulesUpdated' ||
      request.action === 'importedData'
    ) {
      console.log(`[System Background] Reloading config data due to ${request.action} message.`);
      await loadData();
      if (request.action === 'importedData') {
        await loadPomodoroStateAndSettings();
      }
      await updateRuleAndAssignmentCache(); // Update cache on any rule/category change
      sendResponse({ success: true, message: 'Config data and cache reloaded.' });
    }
    // --- The rest of the Pomodoro message handlers remain the same ---
    else if (request.action === 'pomodoroSettingsChanged') {
      console.log(`[System Background] Received pomodoroSettingsChanged. Reloading settings from storage.`);
      try {
        const result = await browser.storage.local.get(FocusFlowState.STORAGE_KEY_POMODORO_SETTINGS);
        if (result[FocusFlowState.STORAGE_KEY_POMODORO_SETTINGS]) {
          const loadedSettings = result[FocusFlowState.STORAGE_KEY_POMODORO_SETTINGS];
          // Define defaults here to ensure they are always available
          const defaultDurations = {
            [POMODORO_PHASES.WORK]: 25 * 60,
            [POMODORO_PHASES.SHORT_BREAK]: 5 * 60,
            [POMODORO_PHASES.LONG_BREAK]: 15 * 60,
          };
          const defaultSessions = 4;

          pomodoroSettings.durations = loadedSettings.durations || defaultDurations;
          pomodoroSettings.sessionsBeforeLongBreak = loadedSettings.sessionsBeforeLongBreak || defaultSessions;
          pomodoroSettings.notifyEnabled =
            loadedSettings.notifyEnabled !== undefined ? loadedSettings.notifyEnabled : true;
          pomodoroSettings.blockDuringWorkEnabled = !!loadedSettings.blockDuringWorkEnabled;
          pomodoroSettings.blockedCategoriesDuringWork = Array.isArray(loadedSettings.blockedCategoriesDuringWork)
            ? loadedSettings.blockedCategoriesDuringWork
            : [];

          if (
            pomodoroState.timerState === 'stopped' ||
            (pomodoroState.currentPhase &&
              pomodoroSettings.durations[pomodoroState.currentPhase] !== pomodoroState.remainingTime &&
              pomodoroState.timerState !== 'running')
          ) {
            const newPhaseDuration =
              pomodoroSettings.durations[pomodoroState.currentPhase] ||
              pomodoroSettings.durations[POMODORO_PHASES.WORK];
            if (pomodoroState.remainingTime !== newPhaseDuration || pomodoroState.timerState === 'stopped') {
              pomodoroState.remainingTime = newPhaseDuration;
            }
          }
          console.log(
            `[Pomodoro Background] Reloaded Pomodoro settings from storage. Durations:`,
            pomodoroSettings.durations,
            `Sessions: ${pomodoroSettings.sessionsBeforeLongBreak}`,
            `Notify: ${pomodoroSettings.notifyEnabled}`
          );
        } else {
          console.warn(
            `[Pomodoro Background] No pomodoroUserSettings found in storage on 'pomodoroSettingsChanged'. Using defaults.`
          );
          pomodoroSettings.durations = { work: 25 * 60, shortBreak: 5 * 60, longBreak: 15 * 60 };
          pomodoroSettings.sessionsBeforeLongBreak = 4;
          pomodoroSettings.notifyEnabled = true;
          pomodoroState.remainingTime =
            pomodoroSettings.durations[pomodoroState.currentPhase] || pomodoroSettings.durations[POMODORO_PHASES.WORK];
        }
        await sendPomodoroStatusToPopups();
        sendResponse({ success: true, message: 'Background acknowledged and reloaded Pomodoro settings.' });
      } catch (err) {
        console.error(`[System Background] Error reloading pomodoro settings in background:`, err);
        sendResponse({ success: false, message: 'Error reloading pomodoro settings in background.' });
      }
      // After settings reload, refresh ephemeral rules for current phase and cache
      await updateEphemeralPomodoroRulesForPhase(pomodoroState.currentPhase);
      await updateRuleAndAssignmentCache();
    } else if (request.action === 'getPomodoroStatus') {
      let currentNotifyEnabled = pomodoroSettings.notifyEnabled;
      let settingChangedInStorage = false;
      if (currentNotifyEnabled) {
        try {
          const hasPermission = await browser.permissions.contains({ permissions: ['notifications'] });
          if (!hasPermission) {
            console.log(
              '[Pomodoro Background] getPomodoroStatus: notifyEnabled was true, but permission missing. Updating to false.'
            );
            pomodoroSettings.notifyEnabled = false;
            currentNotifyEnabled = false;
            settingChangedInStorage = true;
          }
        } catch (err) {
          console.error('[Pomodoro Background] getPomodoroStatus: Error checking notification permission:', err);
          if (pomodoroSettings.notifyEnabled) {
            pomodoroSettings.notifyEnabled = false;
            currentNotifyEnabled = false;
            settingChangedInStorage = true;
          }
        }
      }
      if (settingChangedInStorage) {
        await savePomodoroStateAndSettings();
      }
      sendResponse({
        ...pomodoroState,
        durations: pomodoroSettings.durations,
        notifyEnabled: currentNotifyEnabled,
      });
    } else if (request.action === 'startPomodoro') {
      startPomodoroTimer();
      sendResponse({ success: true });
    } else if (request.action === 'pausePomodoro') {
      pausePomodoroTimer();
      sendResponse({ success: true });
    } else if (request.action === 'resetPomodoro') {
      resetPomodoroTimer(request.resetCycle || false);
      sendResponse({ success: true });
    } else if (request.action === 'skipPomodoro') {
      skipPomodoroPhase();
      sendResponse({ success: true });
    } else if (request.action === 'changePomodoroPhase') {
      changeToNextPomodoroPhase();
      sendResponse({ success: true });
    } else if (request.action === 'updatePomodoroNotificationSetting') {
      if (request.enabled !== undefined) {
        const userIntentEnabled = !!request.enabled;
        let finalNotifyEnabledState = userIntentEnabled;
        let settingActuallyChanged = false;

        if (userIntentEnabled) {
          try {
            const hasPermission = await browser.permissions.contains({ permissions: ['notifications'] });
            if (!hasPermission) {
              console.warn(
                '[Pomodoro Background] Popup requested to enable notifications, but permission is missing. Overriding intent: Forcing disabled.'
              );
              finalNotifyEnabledState = false;
            }
          } catch (err) {
            console.error(
              '[Pomodoro Background] Error checking notification permission during update from popup:',
              err
            );
            finalNotifyEnabledState = false;
          }
        }

        if (pomodoroSettings.notifyEnabled !== finalNotifyEnabledState) {
          pomodoroSettings.notifyEnabled = finalNotifyEnabledState;
          settingActuallyChanged = true;
        }

        if (settingActuallyChanged) {
          await savePomodoroStateAndSettings();
        }
        await sendPomodoroStatusToPopups();
        console.log(
          `[Pomodoro Background] Popup update. User intent: ${userIntentEnabled}, Actual setting in background: ${pomodoroSettings.notifyEnabled}`
        );
        sendResponse({ success: true, actualState: pomodoroSettings.notifyEnabled });
      } else {
        sendResponse({ success: false, error: "Missing 'enabled' parameter." });
      }
    } else if (request.action === 'getPomodoroStatsForDate') {
      const dateStr = request.date || getCurrentDateString();
      const dailyStats = FocusFlowState.pomodoroDailyStats[dateStr] || { workSessions: 0, totalWorkTime: 0 };
      console.log(`[Pomodoro Background] Responding to getPomodoroStatsForDate for ${dateStr}:`, dailyStats);
      sendResponse({ success: true, stats: dailyStats });
    }
  })();
  return true;
});

initializeExtension();
