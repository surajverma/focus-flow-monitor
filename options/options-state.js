// --- Storage Keys ---
const STORAGE_KEY_IDLE_THRESHOLD = 'idleThresholdSeconds';
const DEFAULT_IDLE_SECONDS = 1800;
const STORAGE_KEY_DATA_RETENTION_DAYS = 'dataRetentionPeriodDays';
const DEFAULT_DATA_RETENTION_DAYS = 90;

// Storage keys for Block Page Customization
const STORAGE_KEY_BLOCK_PAGE_CUSTOM_HEADING = 'blockPage_customHeading';
const STORAGE_KEY_BLOCK_PAGE_CUSTOM_MESSAGE = 'blockPage_customMessage';
const STORAGE_KEY_BLOCK_PAGE_CUSTOM_BUTTON_TEXT = 'blockPage_customButtonText';
const STORAGE_KEY_BLOCK_PAGE_SHOW_URL = 'blockPage_showUrl';
const STORAGE_KEY_BLOCK_PAGE_SHOW_REASON = 'blockPage_showReason';
const STORAGE_KEY_BLOCK_PAGE_SHOW_RULE = 'blockPage_showRule';
const STORAGE_KEY_BLOCK_PAGE_SHOW_LIMIT_INFO = 'blockPage_showLimitInfo';
const STORAGE_KEY_BLOCK_PAGE_SHOW_SCHEDULE_INFO = 'blockPage_showScheduleInfo';
const STORAGE_KEY_BLOCK_PAGE_SHOW_QUOTE = 'blockPage_showQuote';
const STORAGE_KEY_BLOCK_PAGE_USER_QUOTES = 'blockPage_userQuotes';
const STORAGE_KEY_POMODORO_SETTINGS = 'pomodoroUserSettings';

// Storage keys for Pomodoro Stats (must match values in background/state.js)
const STORAGE_KEY_POMODORO_STATS_DAILY = 'pomodoroStatsDaily';
const STORAGE_KEY_POMODORO_STATS_ALL_TIME = 'pomodoroStatsAllTime';

// --- Global App State ---
let AppState = {
  // Core Data
  trackedData: {},
  categoryTimeData: {},
  dailyDomainData: {},
  dailyCategoryData: {},
  hourlyData: {}, // Configuration
  categories: ['Other'],
  categoryAssignments: {},
  rules: [], // UI State
  timeChart: null,
  domainCurrentPage: 1,
  domainItemsPerPage: 10,
  fullDomainDataSorted: [],
  calendarDate: new Date(),
  selectedDateStr:
    typeof getCurrentDateString === 'function' ? getCurrentDateString() : new Date().toISOString().split('T')[0], // Ensure getCurrentDateString is available
  currentChartViewMode: 'domain',
  editingRuleIndex: -1,
  editingAssignmentOriginalDomain: null,
  categoryProductivityRatings: {}, // Block Page Customization Settings in AppState

  blockPageCustomHeading: '',
  blockPageCustomMessage: '',
  blockPageCustomButtonText: '',
  blockPageShowUrl: true,
  blockPageShowReason: true,
  blockPageShowRule: true,
  blockPageShowLimitInfo: true,
  blockPageShowScheduleInfo: true,
  blockPageShowQuote: false,
  blockPageUserQuotes: [],

  pomodoroNotifyEnabled: true,
  isRequestingPermission: false,

  pomodoroStatsToday: {
    sessionsCompleted: 0,
    timeFocused: 0, // in seconds
  },
  pomodoroStatsAllTime: {
    sessionsCompleted: 0,
    timeFocused: 0,
  },
  allPomodoroDailyStats: {}, // Will be populated from storage

  itemDetailCurrentPage: 1,
  itemDetailItemsPerPage: 10,
  currentBreakdownIdentifier: null, // Will store category name or null (for 'Other Chart Domains')
  tempChartOtherDomainsData: [], // Stores the domains that make up the "Other Domains" slice of the chart
};

// --- UI Element References ---
let UIElements = {};

// Function to get references to all needed UI elements
function queryUIElements() {
  UIElements.detailedTimeList = document.getElementById('detailedTimeList');
  UIElements.categoryTimeList = document.getElementById('categoryTimeList');
  UIElements.categoryList = document.getElementById('categoryList');
  UIElements.assignmentList = document.getElementById('assignmentList');
  UIElements.ruleList = document.getElementById('ruleList');
  UIElements.newCategoryNameInput = document.getElementById('newCategoryName');
  UIElements.addCategoryBtn = document.getElementById('addCategoryBtn');
  UIElements.domainPatternInput = document.getElementById('domainPattern');
  UIElements.categorySelect = document.getElementById('categorySelect'); // Main select for assignments
  UIElements.assignDomainBtn = document.getElementById('assignDomainBtn');
  UIElements.cancelAssignDomainBtn = document.getElementById('cancelAssignDomainBtn');
  UIElements.ruleTypeSelect = document.getElementById('ruleTypeSelect');
  UIElements.rulePatternInput = document.getElementById('rulePatternInput');
  UIElements.ruleCategorySelect = document.getElementById('ruleCategorySelect');
  UIElements.ruleLimitInput = document.getElementById('ruleLimitInput');
  UIElements.ruleUnitSelect = document.getElementById('ruleUnitSelect');
  UIElements.addRuleBtn = document.getElementById('addRuleBtn');
  UIElements.timeLimitInputDiv = document.querySelector('.time-limit-input');

  UIElements.addRuleScheduleInputsDiv = document.querySelector('.add-rule-form .schedule-inputs');
  UIElements.ruleStartTimeInput = document.getElementById('ruleStartTime');
  UIElements.ruleEndTimeInput = document.getElementById('ruleEndTime');
  UIElements.ruleDayCheckboxes = document.querySelectorAll('.add-rule-form input[name="ruleDay"]');

  UIElements.dateRangeSelect = document.getElementById('dateRangeSelect');
  UIElements.statsPeriodSpans = document.querySelectorAll('.stats-period');
  UIElements.domainPaginationDiv = document.getElementById('domainPagination');
  UIElements.domainPrevBtn = document.getElementById('domainPrevBtn');
  UIElements.domainNextBtn = document.getElementById('domainNextBtn');
  UIElements.domainPageInfo = document.getElementById('domainPageInfo');
  UIElements.calendarGrid = document.getElementById('calendarGrid');
  UIElements.prevMonthBtn = document.getElementById('prevMonthBtn');
  UIElements.nextMonthBtn = document.getElementById('nextMonthBtn');
  UIElements.currentMonthYearSpan = document.getElementById('currentMonthYear');
  UIElements.calendarDetailPopup = document.getElementById('calendarDetailPopup');
  UIElements.chartTitleElement = document.getElementById('chartTitle');
  UIElements.chartViewRadios = document.querySelectorAll('input[name="chartView"]');

  UIElements.editRuleModal = document.getElementById('editRuleModal');
  UIElements.closeEditModalBtn = document.getElementById('closeEditModalBtn');
  UIElements.editRuleFormContent = document.getElementById('editRuleFormContent');
  UIElements.editRuleIndexInput = document.getElementById('editRuleIndex');
  UIElements.editRuleTypeDisplay = document.getElementById('editRuleTypeDisplay');
  UIElements.editRulePatternGroup = document.getElementById('editRulePatternGroup');
  UIElements.editRulePatternInput = document.getElementById('editRulePatternInput');
  UIElements.editRuleCategoryGroup = document.getElementById('editRuleCategoryGroup');
  UIElements.editRuleCategorySelect = document.getElementById('editRuleCategorySelect');
  UIElements.editRuleLimitGroup = document.getElementById('editRuleLimitGroup');
  UIElements.editRuleLimitInput = document.getElementById('editRuleLimitInput');
  UIElements.editRuleUnitSelect = document.getElementById('editRuleUnitSelect');
  UIElements.editRuleScheduleGroup = document.getElementById('editRuleScheduleGroup');
  UIElements.editRuleStartTimeInput = document.getElementById('editRuleStartTime');
  UIElements.editRuleEndTimeInput = document.getElementById('editRuleEndTime');
  UIElements.editRuleDayCheckboxes = document.querySelectorAll('#editRuleModal input[name="editRuleDay"]');
  UIElements.saveRuleChangesBtn = document.getElementById('saveRuleChangesBtn');
  UIElements.cancelEditRuleBtn = document.getElementById('cancelEditRuleBtn');

  UIElements.idleThresholdSelect = document.getElementById('idleThresholdSelect');
  UIElements.exportCsvBtn = document.getElementById('exportCsvBtn');

  UIElements.editAssignmentModal = document.getElementById('editAssignmentModal');
  UIElements.closeEditAssignmentModalBtn = document.getElementById('closeEditAssignmentModalBtn');
  UIElements.editAssignmentFormContent = document.getElementById('editAssignmentFormContent');
  UIElements.editAssignmentOriginalDomain = document.getElementById('editAssignmentOriginalDomain');
  UIElements.editAssignmentDomainInput = document.getElementById('editAssignmentDomainInput');
  UIElements.editAssignmentCategorySelect = document.getElementById('editAssignmentCategorySelect');
  UIElements.saveAssignmentChangesBtn = document.getElementById('saveAssignmentChangesBtn');
  UIElements.cancelEditAssignmentBtn = document.getElementById('cancelEditAssignmentBtn');

  UIElements.dataRetentionSelect = document.getElementById('dataRetentionSelect');

  UIElements.exportDataBtn = document.getElementById('exportDataBtn');
  UIElements.importDataBtn = document.getElementById('importDataBtn');
  UIElements.importFileInput = document.getElementById('importFileInput');
  UIElements.importStatus = document.getElementById('importStatus');

  UIElements.productivitySettingsList = document.getElementById('productivitySettingsList');
  UIElements.productivityScoreLabel = document.getElementById('productivityScoreLabel');
  UIElements.productivityScoreValue = document.getElementById('productivityScoreValue');

  UIElements.blockPageCustomHeadingInput = document.getElementById('blockPageCustomHeading');
  UIElements.blockPageCustomMessageTextarea = document.getElementById('blockPageCustomMessage');
  UIElements.blockPageCustomButtonTextInput = document.getElementById('blockPageCustomButtonText');
  UIElements.blockPageShowUrlCheckbox = document.getElementById('blockPageShowUrl');
  UIElements.blockPageShowReasonCheckbox = document.getElementById('blockPageShowReason');
  UIElements.blockPageShowRuleCheckbox = document.getElementById('blockPageShowRule');
  UIElements.blockPageShowLimitInfoCheckbox = document.getElementById('blockPageShowLimitInfo');
  UIElements.blockPageShowScheduleInfoCheckbox = document.getElementById('blockPageShowScheduleInfo');
  UIElements.blockPageShowQuoteCheckbox = document.getElementById('blockPageShowQuote');
  UIElements.blockPageUserQuotesContainer = document.getElementById('blockPageUserQuotesContainer');
  UIElements.blockPageUserQuotesTextarea = document.getElementById('blockPageUserQuotes');

  UIElements.totalTimeForRangeContainer = document.getElementById('totalTimeForRangeContainer');
  UIElements.totalTimeForRangeLabel = document.getElementById('totalTimeForRangeLabel');
  UIElements.totalTimeForRangeValue = document.getElementById('totalTimeForRangeValue');
  UIElements.averageTimeForRange = document.getElementById('averageTimeForRange');

  // --- Pomodoro Settings UI Elements ---
  UIElements.pomodoroWorkDurationInput = document.getElementById('pomodoroWorkDuration');
  UIElements.pomodoroShortBreakDurationInput = document.getElementById('pomodoroShortBreakDuration');
  UIElements.pomodoroLongBreakDurationInput = document.getElementById('pomodoroLongBreakDuration');
  UIElements.pomodoroSessionsInput = document.getElementById('pomodoroSessionsBeforeLongBreak');
  UIElements.savePomodoroSettingsBtn = document.getElementById('savePomodoroSettingsBtn');
  UIElements.resetPomodoroSettingsBtn = document.getElementById('resetPomodoroSettingsBtn');
  UIElements.pomodoroSettingsError = document.getElementById('pomodoroSettingsError');
  UIElements.pomodoroEnableNotificationsCheckbox = document.getElementById('pomodoroEnableNotificationsCheckbox');
  UIElements.pomodoroNotificationPermissionStatus = document.getElementById('pomodoroNotificationPermissionStatus');
  // Pomodoro Work blocking controls
  UIElements.pomodoroBlockDuringWorkCheckbox = document.getElementById('pomodoroBlockDuringWorkCheckbox');
  UIElements.pomodoroBlockedCategoriesSelect = document.getElementById('pomodoroBlockedCategoriesSelect');

  // --- Pomodoro Stats UI Elements (Dashboard) ---
  UIElements.pomodoroStatsContainer = document.getElementById('pomodoroStatsContainer');
  UIElements.pomodoroStatsLabel = document.getElementById('pomodoroStatsLabel');
  UIElements.pomodoroSessionsCompletedEl = document.getElementById('pomodoroSessionsCompleted');
  UIElements.pomodoroTimeFocusedEl = document.getElementById('pomodoroTimeFocused');
  // Insights banner
  UIElements.insightsBanner = document.getElementById('insightsBanner');
  UIElements.insightsBannerText = document.getElementById('insightsBannerText');

  // START: Updated UI element references for Breakdown Details Section
  UIElements.itemDetailSection = document.getElementById('itemDetailSection');
  UIElements.itemDetailTitle = document.getElementById('itemDetailTitle');
  // UIElements.itemDetailPeriodDisplay = document.getElementById('itemDetailPeriodDisplay');
  UIElements.itemDetailList = document.getElementById('itemDetailList');
  UIElements.itemDetailPagination = document.getElementById('itemDetailPagination');
  UIElements.itemDetailPrevBtn = document.getElementById('itemDetailPrevBtn');
  UIElements.itemDetailPageInfo = document.getElementById('itemDetailPageInfo');
  UIElements.itemDetailNextBtn = document.getElementById('itemDetailNextBtn');
  // References for the controls within the breakdown section
  // UIElements.breakdownTypeCategoryRadio = document.getElementById('breakdownTypeCategoryRadio'); // Removed
  // UIElements.breakdownTypeChartOtherRadio = document.getElementById('breakdownTypeChartOtherRadio'); // Removed
  UIElements.breakdownCategorySelect = document.getElementById('breakdownCategorySelect'); // Select for choosing category
  // END: Updated UI element references for Breakdown Details Section

  // Basic check to ensure critical elements were found
  if (
    !UIElements.detailedTimeList ||
    !UIElements.categoryList ||
    !UIElements.ruleList ||
    !UIElements.addCategoryBtn ||
    !UIElements.editAssignmentModal ||
    !UIElements.saveAssignmentChangesBtn ||
    !UIElements.dataRetentionSelect ||
    !UIElements.exportDataBtn ||
    !UIElements.importDataBtn ||
    !UIElements.importFileInput ||
    !UIElements.importStatus ||
    !UIElements.productivitySettingsList ||
    !UIElements.blockPageCustomHeadingInput ||
    !UIElements.blockPageShowUrlCheckbox ||
    !UIElements.blockPageShowQuoteCheckbox ||
    !UIElements.blockPageUserQuotesTextarea ||
    !UIElements.totalTimeForRangeContainer ||
    !UIElements.totalTimeForRangeLabel ||
    !UIElements.totalTimeForRangeValue ||
    !UIElements.averageTimeForRange ||
    !UIElements.pomodoroEnableNotificationsCheckbox ||
    !UIElements.pomodoroNotificationPermissionStatus ||
    !UIElements.pomodoroWorkDurationInput ||
    !UIElements.pomodoroShortBreakDurationInput ||
    !UIElements.pomodoroLongBreakDurationInput ||
    !UIElements.pomodoroSessionsInput ||
    !UIElements.savePomodoroSettingsBtn ||
    !UIElements.resetPomodoroSettingsBtn ||
    !UIElements.pomodoroSettingsError ||
    !UIElements.pomodoroStatsContainer ||
    !UIElements.pomodoroStatsLabel ||
    !UIElements.pomodoroSessionsCompletedEl ||
    !UIElements.pomodoroTimeFocusedEl ||
    !UIElements.itemDetailSection ||
    !UIElements.itemDetailTitle ||
    // !UIElements.itemDetailPeriodDisplay ||
    !UIElements.itemDetailList ||
    !UIElements.itemDetailPagination ||
    !UIElements.itemDetailPrevBtn ||
    !UIElements.itemDetailPageInfo ||
    !UIElements.itemDetailNextBtn ||
    // !UIElements.breakdownTypeCategoryRadio || // Removed
    // !UIElements.breakdownTypeChartOtherRadio || // Removed
    !UIElements.breakdownCategorySelect
  ) {
    console.error('One or more critical UI elements are missing from options.html!');
    return false; // Indicate failure
  }

  if (
    !UIElements.addRuleScheduleInputsDiv ||
    !UIElements.editRuleScheduleGroup ||
    !UIElements.ruleStartTimeInput ||
    !UIElements.editRuleStartTimeInput
  ) {
    console.warn('One or more schedule input elements might be missing.');
  }
  console.log('[System] UI element references obtained.');
  return true; // Indicate success
}

if (typeof getCurrentDateString === 'undefined') {
  function getCurrentDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
