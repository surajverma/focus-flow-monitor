// --- UI Population/Display Functions ---

function displayDomainTime(itemsToDisplay) {
  if (!UIElements.detailedTimeList) return;
  UIElements.detailedTimeList.replaceChildren();
  if (!itemsToDisplay || itemsToDisplay.length === 0) {
    const li = document.createElement('li');
    li.textContent =
      AppState.fullDomainDataSorted.length === 0 ? 'No domain data for this period.' : 'No domains on this page.';
    UIElements.detailedTimeList.appendChild(li);
    return;
  }
  itemsToDisplay.forEach((item) => {
    const li = document.createElement('li');
    const domainSpan = document.createElement('span');
    domainSpan.textContent = item.domain;
    domainSpan.className = 'domain';
    const timeSpan = document.createElement('span');
    timeSpan.textContent = formatTime(item.time, true); // From utils.js
    timeSpan.className = 'time';
    li.appendChild(domainSpan);
    li.appendChild(timeSpan);

    // Inline category info or assignment (for domains currently in 'Other')
    try {
      if (typeof getCategoryForDomain === 'function' && AppState && AppState.categoryAssignments && AppState.categories) {
        const currentCategory = getCategoryForDomain(
          item.domain,
          AppState.categoryAssignments,
          AppState.categories
        );

        const controlsContainer = document.createElement('span');
        controlsContainer.className = 'inline-category-control';

        if (currentCategory && currentCategory !== 'Other') {
          const catBadge = document.createElement('span');
          catBadge.className = 'inline-category-badge';
          catBadge.textContent = currentCategory;
          controlsContainer.appendChild(catBadge);
        } else {
          // Build a compact select to assign a category quickly
          const select = document.createElement('select');
          select.className = 'inline-category-select';
          const defaultOpt = document.createElement('option');
          defaultOpt.value = '';
          defaultOpt.textContent = 'Assign category…';
          select.appendChild(defaultOpt);
          // Populate with categories (excluding 'Other' to encourage classification)
          AppState.categories
            .filter((c) => c && c !== 'Other')
            .forEach((cat) => {
              const opt = document.createElement('option');
              opt.value = cat;
              opt.textContent = cat;
              select.appendChild(opt);
            });

          select.addEventListener('change', (e) => {
            const chosen = e.target.value;
            if (!chosen) return;
            if (typeof handleInlineAssignCategoryForDomain === 'function') {
              handleInlineAssignCategoryForDomain(item.domain, chosen, currentCategory || 'Other');
            }
          });
          controlsContainer.appendChild(select);
        }
        li.appendChild(controlsContainer);
      }
    } catch (err) {
      console.warn('[UI] Error building inline category assign control:', err);
    }
    UIElements.detailedTimeList.appendChild(li);
  });
}

function displayCategoryTime(dataToDisplay) {
  if (!UIElements.categoryTimeList) return;
  UIElements.categoryTimeList.replaceChildren();
  if (!dataToDisplay || Object.keys(dataToDisplay).length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No category data for this period.';
    UIElements.categoryTimeList.appendChild(li);
    return;
  }
  const sortedData = Object.entries(dataToDisplay)
    .map(([category, time]) => ({ category, time }))
    .filter((item) => item.time > 0.1)
    .sort((a, b) => b.time - a.time);

  if (sortedData.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No significant category data for this period.';
    UIElements.categoryTimeList.appendChild(li);
    return;
  }

  sortedData.forEach((item) => {
    const li = document.createElement('li');
    const nameSpan = document.createElement('span');
    nameSpan.textContent = item.category;
    nameSpan.className = 'category-name category-name-clickable'; // Use CSS class for styling
    nameSpan.title = `Click to see websites in ${item.category}`;
    nameSpan.dataset.categoryName = item.category;

    const timeSpan = document.createElement('span');
    timeSpan.textContent = formatTime(item.time, true);
    timeSpan.className = 'time';

    li.appendChild(nameSpan);
    li.appendChild(timeSpan);
    UIElements.categoryTimeList.appendChild(li);
  });
}

function populateCategoryList() {
  if (!UIElements.categoryList) {
    console.error('Category list UI element not found!');
    return;
  }
  UIElements.categoryList.replaceChildren();

  if (!AppState.categories || AppState.categories.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No categories defined.';
    UIElements.categoryList.appendChild(li);
    return;
  }

  const sortedCategories = [...AppState.categories].sort((a, b) => {
    if (a === 'Other') return 1;
    if (b === 'Other') return -1;
    return a.toLowerCase().localeCompare(b.toLowerCase());
  });

  sortedCategories.forEach((cat) => {
    const li = document.createElement('li');
    li.classList.add('category-list-item');
    li.dataset.categoryName = cat;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'category-name-display';
    nameSpan.textContent = cat;
    li.appendChild(nameSpan);

    const inputField = document.createElement('input');
    inputField.type = 'text';
    inputField.className = 'category-edit-input';
    inputField.value = cat;
    inputField.style.display = 'none';
    inputField.style.marginRight = '10px';
    li.insertBefore(inputField, nameSpan);

    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'category-controls';

    if (cat !== 'Other') {
      const editBtn = document.createElement('button');
      editBtn.textContent = 'Edit';
      editBtn.className = 'edit-btn category-edit-btn';
      editBtn.dataset.category = cat;
      controlsDiv.appendChild(editBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.className = 'delete-btn category-delete-btn';
      deleteBtn.dataset.category = cat;
      controlsDiv.appendChild(deleteBtn);

      const saveBtn = document.createElement('button');
      saveBtn.textContent = 'Save';
      saveBtn.className = 'save-btn category-save-btn';
      saveBtn.style.display = 'none';
      controlsDiv.appendChild(saveBtn);

      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'Cancel';
      cancelBtn.className = 'cancel-btn category-cancel-btn';
      cancelBtn.style.display = 'none';
      controlsDiv.appendChild(cancelBtn);
    } else {
      controlsDiv.style.minWidth = '80px';
    }

    li.appendChild(controlsDiv);
    UIElements.categoryList.appendChild(li);
  });
}

function populateCategorySelect() {
  if (UIElements.categorySelect) {
    UIElements.categorySelect.replaceChildren();
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select Category';
    UIElements.categorySelect.appendChild(defaultOption);
  }

  if (UIElements.breakdownCategorySelect) {
    UIElements.breakdownCategorySelect.replaceChildren();
    const defaultBreakdownOption = document.createElement('option');
    defaultBreakdownOption.value = '';
    defaultBreakdownOption.textContent = '-- Select Category --';
    UIElements.breakdownCategorySelect.appendChild(defaultBreakdownOption);
  }

  AppState.categories.forEach((cat) => {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = cat;
    if (UIElements.categorySelect) {
      UIElements.categorySelect.appendChild(option.cloneNode(true));
    }
    if (UIElements.breakdownCategorySelect) {
      UIElements.breakdownCategorySelect.appendChild(option.cloneNode(true));
    }
  });
}

function populateAssignmentList() {
  if (!UIElements.assignmentList) return;
  UIElements.assignmentList.replaceChildren();
  if (Object.keys(AppState.categoryAssignments).length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No domains assigned yet.';
    UIElements.assignmentList.appendChild(li);
    return;
  }
  const sortedAssignments = Object.entries(AppState.categoryAssignments).sort((a, b) => a[0].localeCompare(b[0]));

  sortedAssignments.forEach(([domain, category]) => {
    const li = document.createElement('li');
    li.classList.add('assignment-list-item');

    const domainSpan = document.createElement('span');
    domainSpan.textContent = domain;
    domainSpan.className = 'assignment-domain';
    li.appendChild(domainSpan);

    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'assignment-controls';

    const categorySpan = document.createElement('span');
    categorySpan.textContent = category;
    categorySpan.className = 'assignment-category';
    controlsDiv.appendChild(categorySpan);

    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.className = 'edit-btn assignment-edit-btn';
    editBtn.dataset.domain = domain;
    controlsDiv.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.className = 'delete-btn assignment-delete-btn';
    deleteBtn.dataset.domain = domain;
    controlsDiv.appendChild(deleteBtn);

    li.appendChild(controlsDiv);
    UIElements.assignmentList.appendChild(li);
  });
}

function populateRuleCategorySelect() {
  if (UIElements.ruleCategorySelect) {
    UIElements.ruleCategorySelect.replaceChildren();
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select Category';
    UIElements.ruleCategorySelect.appendChild(defaultOption);
    AppState.categories.forEach((cat) => {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      UIElements.ruleCategorySelect.appendChild(option);
    });
  }
  if (UIElements.editRuleCategorySelect) {
    UIElements.editRuleCategorySelect.replaceChildren();
    const defaultEditOption = document.createElement('option');
    defaultEditOption.value = '';
    defaultEditOption.textContent = 'Select Category';
    UIElements.editRuleCategorySelect.appendChild(defaultEditOption);
    AppState.categories.forEach((cat) => {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      UIElements.editRuleCategorySelect.appendChild(option);
    });
  } else {
    console.error('Edit rule category select element not found during population!');
  }
}

function populateEditAssignmentCategorySelect() {
  if (!UIElements.editAssignmentCategorySelect) {
    console.error('Edit assignment category select element not found!');
    return;
  }
  UIElements.editAssignmentCategorySelect.replaceChildren();
  AppState.categories.forEach((cat) => {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = cat;
    UIElements.editAssignmentCategorySelect.appendChild(option);
  });
}

function populateRuleList() {
  if (!UIElements.ruleList) return;
  UIElements.ruleList.replaceChildren();
  if (!AppState.rules || !Array.isArray(AppState.rules)) {
    const li = document.createElement('li');
    li.textContent = 'Error: Rule data is invalid.';
    UIElements.ruleList.appendChild(li);
    return;
  }
  if (AppState.rules.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No blocking or limiting rules are currently set.';
    UIElements.ruleList.appendChild(li);
    return;
  }
  try {
    AppState.rules.forEach((rule, index) => {
      if (!rule || typeof rule.type !== 'string' || typeof rule.value !== 'string') return;

      const li = document.createElement('li');
      const infoSpan = document.createElement('span');
      infoSpan.className = 'rule-info';
      let typeText = '',
        targetText = rule.value,
        detailContent = '',
        detailClass = '';

      let scheduleText = '';
      if (rule.type.includes('block-') && (rule.startTime || rule.days)) {
        const displayStartTime = rule.startTime ? formatTimeToAMPM(rule.startTime) : '';
        const displayEndTime = rule.endTime ? formatTimeToAMPM(rule.endTime) : '';
        const timePart = displayStartTime && displayEndTime ? `${displayStartTime}-${displayEndTime}` : 'All Day';
        const daysPart = rule.days ? rule.days.join(',') : 'All Week';
        if (rule.days || (displayStartTime && displayEndTime)) {
          scheduleText = ` (Schedule: ${timePart}, ${daysPart})`;
        } else {
          scheduleText = ' (Permanent)';
        }
      }

      if (rule.type === 'block-url' || rule.type === 'block-category') {
        typeText = rule.type === 'block-url' ? 'Block URL' : 'Block Cat';
        detailContent = scheduleText || '(Permanent)';
        detailClass = 'rule-blocked';
      } else if (rule.type === 'limit-url' || rule.type === 'limit-category') {
        typeText = rule.type === 'limit-url' ? 'Limit URL' : 'Limit Cat';
        detailContent = ` (Limit: ${formatTime(rule.limitSeconds || 0, false)}/day)`;
        detailClass = 'rule-limit';
      } else {
        typeText = 'Unknown Rule';
        targetText = JSON.stringify(rule.value);
      }

      const typeSpan = document.createElement('span');
      typeSpan.className = 'rule-type';
      typeSpan.textContent = `${typeText}:`;
      const targetSpan = document.createElement('span');
      targetSpan.className = 'rule-target';
      targetSpan.textContent = targetText;
      infoSpan.appendChild(typeSpan);
      infoSpan.appendChild(document.createTextNode(' '));
      infoSpan.appendChild(targetSpan);

      if (detailClass && detailContent) {
        infoSpan.appendChild(document.createTextNode(' '));
        const detailSpan = document.createElement('span');
        detailSpan.className = detailClass;
        detailSpan.textContent = detailContent;
        infoSpan.appendChild(detailSpan);
      }

      const buttonsDiv = document.createElement('div');
      buttonsDiv.style.whiteSpace = 'nowrap';
      const editBtn = document.createElement('button');
      editBtn.textContent = 'Edit';
      editBtn.className = 'edit-btn';
      editBtn.dataset.ruleIndex = index;
      buttonsDiv.appendChild(editBtn);
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.className = 'delete-btn';
      deleteBtn.dataset.ruleIndex = index;
      buttonsDiv.appendChild(deleteBtn);

      li.appendChild(infoSpan);
      li.appendChild(buttonsDiv);
      UIElements.ruleList.appendChild(li);
    });
  } catch (e) {
    console.error('Error populating rule list:', e);
    const li = document.createElement('li');
    li.textContent = 'Error displaying rules.';
    UIElements.ruleList.appendChild(li);
  }
}

function renderCalendar(year, month) {
  if (!UIElements.calendarGrid || !UIElements.currentMonthYearSpan) return;
  const todayStr = getCurrentDateString();
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  UIElements.currentMonthYearSpan.textContent = `${monthNames[month]} ${year}`;
  UIElements.calendarGrid.querySelectorAll('.calendar-day, .empty').forEach((cell) => cell.remove());
  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay();
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < startingDayOfWeek; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.classList.add('calendar-day', 'empty');
    fragment.appendChild(emptyCell);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dayCell = document.createElement('div');
    dayCell.classList.add('calendar-day');
    const date = new Date(year, month, day);
    const dateStr = formatDate(date);
    if (dateStr === todayStr) dayCell.classList.add('today');
    dayCell.dataset.date = dateStr;
    const dayNumberSpan = document.createElement('span');
    dayNumberSpan.classList.add('day-number');
    dayNumberSpan.textContent = day;
    dayCell.appendChild(dayNumberSpan);
    const dailyTotalSeconds = Object.values(AppState.dailyDomainData[dateStr] || {}).reduce(
      (sum, time) => sum + time,
      0
    );
    const timeSpan = document.createElement('span');
    timeSpan.classList.add('day-time');
    if (dailyTotalSeconds > 0) {
      timeSpan.textContent = formatTime(dailyTotalSeconds, false);
    } else {
      timeSpan.textContent = '-';
      timeSpan.classList.add('no-data');
    }
    dayCell.appendChild(timeSpan);
    dayCell.addEventListener('click', handleCalendarDayClick);
    if (dailyTotalSeconds > 0.1) {
      dayCell.style.cursor = 'pointer';
      dayCell.addEventListener('mouseover', handleCalendarMouseOver);
      dayCell.addEventListener('focus', handleCalendarMouseOver);
      dayCell.addEventListener('mouseout', handleCalendarMouseOut);
      dayCell.addEventListener('blur', handleCalendarMouseOut);
      dayCell.setAttribute('tabindex', '0');
    } else {
      dayCell.style.cursor = 'default';
    }
    fragment.appendChild(dayCell);
  }
  UIElements.calendarGrid.appendChild(fragment);
}

function showDayDetailsPopup(event) {
  const dayCell = event.target.closest('.calendar-day');
  if (!dayCell || !UIElements.calendarDetailPopup) return;
  const dateStr = dayCell.dataset.date;
  if (!dateStr) return;
  const dayDomainData = AppState.dailyDomainData[dateStr] || {};
  const totalSeconds = Object.values(dayDomainData).reduce((s, t) => s + t, 0);
  const topDomains = Object.entries(dayDomainData)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  UIElements.calendarDetailPopup.replaceChildren();
  const heading = document.createElement('strong');
  heading.textContent = formatDisplayDate(dateStr);
  UIElements.calendarDetailPopup.appendChild(heading);
  const totalText = document.createTextNode(`Total: ${formatTime(totalSeconds, true)}`);
  UIElements.calendarDetailPopup.appendChild(totalText);
  UIElements.calendarDetailPopup.appendChild(document.createElement('br'));
  if (topDomains.length > 0) {
    const sitesHeading = document.createTextNode('Top Sites:');
    const sitesList = document.createElement('ul');
    topDomains.forEach(([domain, time]) => {
      const li = document.createElement('li');
      li.textContent = `${domain}: ${formatTime(time, false)}`;
      sitesList.appendChild(li);
    });
    UIElements.calendarDetailPopup.appendChild(document.createElement('br'));
    UIElements.calendarDetailPopup.appendChild(sitesHeading);
    UIElements.calendarDetailPopup.appendChild(sitesList);
  } else {
    const noData = document.createTextNode('No site data recorded.');
    UIElements.calendarDetailPopup.appendChild(noData);
  }

  const container = document.querySelector('.calendar-container');
  if (!container) return;
  const dayRect = dayCell.getBoundingClientRect();
  let top = dayCell.offsetTop + dayCell.offsetHeight + 5;
  let left = dayCell.offsetLeft + dayCell.offsetWidth / 2;
  UIElements.calendarDetailPopup.style.position = 'absolute';
  UIElements.calendarDetailPopup.style.display = 'block';
  UIElements.calendarDetailPopup.style.left = `${left}px`;
  UIElements.calendarDetailPopup.style.top = `${top}px`;
  UIElements.calendarDetailPopup.style.transform = 'translateX(-50%)';
  const popupRect = UIElements.calendarDetailPopup.getBoundingClientRect();
  if (popupRect.bottom > window.innerHeight) top = dayCell.offsetTop - popupRect.height - 5;
  if (popupRect.right > window.innerWidth) {
    left = dayRect.right - popupRect.width;
    UIElements.calendarDetailPopup.style.transform = 'translateX(0)';
  } else if (popupRect.left < 0) {
    left = dayRect.left;
    UIElements.calendarDetailPopup.style.transform = 'translateX(0)';
  }
  UIElements.calendarDetailPopup.style.top = `${top}px`;
  UIElements.calendarDetailPopup.style.left = `${left}px`;
}

function hideDayDetailsPopup() {
  if (UIElements.calendarDetailPopup) UIElements.calendarDetailPopup.style.display = 'none';
}

function highlightSelectedCalendarDay(dateStrToSelect) {
  if (!UIElements.calendarGrid) return;
  UIElements.calendarGrid.querySelectorAll('.calendar-day').forEach((day) => {
    if (day.dataset.date === dateStrToSelect) day.classList.add('selected');
    else day.classList.remove('selected');
  });
}

function renderChart(data, periodLabel = 'Selected Period', viewMode = 'domain') {
  if (typeof Chart === 'undefined') {
    console.error('Chart.js not loaded.');
    clearChartOnError('Chart library not loaded.');
    return;
  }
  const canvas = document.getElementById('timeChartCanvas');
  const ctx = canvas?.getContext('2d');
  if (!ctx) {
    console.error('Canvas element not found.');
    return;
  }
  if (AppState.timeChart) {
    AppState.timeChart.destroy();
    AppState.timeChart = null;
  }
  if (!data || Object.keys(data).length === 0) {
    AppState.tempChartOtherDomainsData = []; // Clear other domains data
    clearChartOnError(`No data for ${periodLabel}`);
    return;
  }
  const maxSlices = 10;
  let sortedData, otherLabel;
  if (viewMode === 'category') {
    sortedData = Object.entries(data)
      .map(([n, t]) => ({ name: n, time: t }))
      .filter((i) => i.time > 0.1)
      .sort((a, b) => b.time - a.time);
    otherLabel = 'Other Categories';
  } else {
    // domain view
    sortedData = Object.entries(data)
      .map(([n, t]) => ({ name: n, time: t }))
      .filter((i) => i.time > 0.1)
      .sort((a, b) => b.time - a.time);
    otherLabel = 'Other Domains';
  }
  if (sortedData.length === 0) {
    AppState.tempChartOtherDomainsData = []; // Clear other domains data
    clearChartOnError(`No significant data for ${periodLabel}`);
    return;
  }

  let labels = sortedData.map((i) => i.name),
    times = sortedData.map((i) => i.time);
  AppState.tempChartOtherDomainsData = []; // Reset before populating

  if (sortedData.length > maxSlices) {
    const top = sortedData.slice(0, maxSlices - 1);
    labels = top.map((i) => i.name);
    times = top.map((i) => i.time);
    const otherSliceData = sortedData.slice(maxSlices - 1);
    const otherTime = otherSliceData.reduce((s, i) => s + i.time, 0);
    if (otherTime > 0.1) {
      labels.push(otherLabel);
      times.push(otherTime);
      if (viewMode === 'domain') {
        // Only populate for domain view
        AppState.tempChartOtherDomainsData = otherSliceData;
        console.log(
          '[RenderChart] Stored tempChartOtherDomainsData for "Other Domains" slice:',
          JSON.parse(JSON.stringify(AppState.tempChartOtherDomainsData))
        );
      }
    }
  }

  const defaultPalette = [
    'rgba(54, 162, 235, 0.8)',
    'rgba(255, 99, 132, 0.8)',
    'rgba(255, 206, 86, 0.8)',
    'rgba(75, 192, 192, 0.8)',
    'rgba(153, 102, 255, 0.8)',
    'rgba(255, 159, 64, 0.8)',
    'rgba(199, 199, 199, 0.8)',
    'rgba(83, 102, 255, 0.8)',
    'rgba(100, 255, 64, 0.8)',
    'rgba(255, 100, 100, 0.8)',
    'rgba(40, 100, 120, 0.8)',
  ];
  let backgroundColors;
  if (viewMode === 'category') {
    backgroundColors = labels.map((l) => getCategoryColor(l));
    if (labels.includes(otherLabel)) backgroundColors[labels.indexOf(otherLabel)] = getCategoryColor('Other');
  } else {
    backgroundColors = labels.map((_, i) => defaultPalette[i % defaultPalette.length]);
    if (labels.includes(otherLabel)) backgroundColors[labels.indexOf(otherLabel)] = getCategoryColor('Other');
  }
  try {
    AppState.timeChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{ label: 'Time Spent', data: times, backgroundColor: backgroundColors, hoverOffset: 4 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 12, padding: 15 } },
          title: { display: false },
          tooltip: {
            callbacks: {
              label: (c) => {
                let l = c.label || '';
                if (l) l += ': ';
                if (c.parsed !== null && c.parsed !== undefined) l += formatTime(c.parsed, true);
                return l;
              },
              afterBody: function (tooltipItems) {
                // const chartInstance = this.chart; // Not used currently
                const currentViewMode = AppState.currentChartViewMode;
                let additionalInfo = [];

                if (tooltipItems.length > 0) {
                  const tooltipItem = tooltipItems[0];
                  const label = tooltipItem.label;

                  if (currentViewMode === 'category' && label !== 'Other Categories') {
                    const categoryName = label;
                    const { domainData: currentPeriodDomainData } = getFilteredDataForRange(
                      UIElements.dateRangeSelect.value || AppState.selectedDateStr,
                      /^\d{4}-\d{2}-\d{2}$/.test(AppState.selectedDateStr) && UIElements.dateRangeSelect.value === ''
                    );

                    if (currentPeriodDomainData) {
                      const domainsInCategory = [];
                      for (const domain in currentPeriodDomainData) {
                        if (
                          typeof getCategoryForDomain === 'function' &&
                          getCategoryForDomain(domain, AppState.categoryAssignments, AppState.categories) ===
                            categoryName
                        ) {
                          domainsInCategory.push({ name: domain, time: currentPeriodDomainData[domain] });
                        }
                      }
                      const topDomains = domainsInCategory.sort((a, b) => b.time - a.time).slice(0, 2);
                      if (topDomains.length > 0) {
                        additionalInfo.push('');
                        additionalInfo.push('Top sites:');
                        topDomains.forEach((d) => additionalInfo.push(`  ${d.name} (${formatTime(d.time, false)})`));
                      }
                    }
                  } else if (
                    currentViewMode === 'domain' &&
                    label === 'Other Domains' &&
                    AppState.tempChartOtherDomainsData &&
                    AppState.tempChartOtherDomainsData.length > 0
                  ) {
                    const topOtherDomains = [...AppState.tempChartOtherDomainsData] // Use the stored data
                      .sort((a, b) => b.time - a.time)
                      .slice(0, 2);
                    if (topOtherDomains.length > 0) {
                      additionalInfo.push('');
                      additionalInfo.push('Includes:');
                      topOtherDomains.forEach((d) => additionalInfo.push(`  ${d.name} (${formatTime(d.time, false)})`));
                    }
                  }
                }
                return additionalInfo;
              },
            },
          },
        },
        onClick: (event, elements, chart) => {
          if (elements.length > 0) {
            const clickedElement = elements[0];
            const index = clickedElement.index;
            const label = chart.data.labels[index];
            console.log(`[Chart onClick] Clicked: ${label}, Current View: ${AppState.currentChartViewMode}`);

            if (label === 'Other Domains' && AppState.currentChartViewMode === 'domain') {
              console.log("[Chart onClick] 'Other Domains' slice clicked.");
              if (typeof handleChartOtherDomainsRequest === 'function') {
                handleChartOtherDomainsRequest();
              }
            } else if (AppState.currentChartViewMode === 'category') {
              const categoryName = label;
              console.log(`[Chart onClick] Category slice '${categoryName}' clicked.`);
              if (categoryName && categoryName !== 'Other Categories') {
                if (typeof handleCategoryBreakdownRequest === 'function') {
                  handleCategoryBreakdownRequest(categoryName);
                }
              }
            }
          }
        },
      },
    });
  } catch (e) {
    console.error('Error creating chart:', e);
    clearChartOnError('Error rendering chart.');
  }
}

function clearChartOnError(message = 'Error loading chart data') {
  const canvas = document.getElementById('timeChartCanvas');
  const ctx = canvas?.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (AppState.timeChart) {
      AppState.timeChart.destroy();
      AppState.timeChart = null;
    }
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'center';
    const words = message.split(' ');
    let line = '';
    let y = canvas.height / 2 - 10;
    const maxW = canvas.width * 0.8;
    for (let n = 0; n < words.length; n++) {
      let tLine = line + words[n] + ' ';
      let mW = ctx.measureText(tLine).width;
      if (mW > maxW && n > 0) {
        ctx.fillText(line, canvas.width / 2, y);
        line = words[n] + ' ';
        y += 18;
      } else line = tLine;
    }
    ctx.fillText(line, canvas.width / 2, y);
  }
}

function populateProductivitySettings() {
  if (!UIElements.productivitySettingsList) {
    console.error('Productivity settings list UI element not found!');
    return;
  }
  if (typeof PRODUCTIVITY_TIERS === 'undefined' || typeof defaultCategoryProductivityRatings === 'undefined') {
    console.error('Productivity constants not found. Ensure options-state.js is loaded first.');
    UIElements.productivitySettingsList.innerHTML = '<li>Error loading settings.</li>';
    return;
  }

  const userRatings = AppState.categoryProductivityRatings || {};
  const categories = AppState.categories || [];

  UIElements.productivitySettingsList.replaceChildren();

  if (!categories || categories.length === 0) {
    UIElements.productivitySettingsList.innerHTML = '<li>No categories found.</li>';
    return;
  }

  const sortedCategories = [...categories].sort((a, b) => {
    if (a === 'Other') return 1;
    if (b === 'Other') return -1;
    return a.toLowerCase().localeCompare(b.toLowerCase());
  });

  const fragment = document.createDocumentFragment();

  sortedCategories.forEach((category) => {
    const li = document.createElement('li');

    const nameSpan = document.createElement('span');
    nameSpan.className = 'category-name';
    nameSpan.textContent = category;
    li.appendChild(nameSpan);

    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'rating-controls';

    const currentRating =
      userRatings[category] ?? defaultCategoryProductivityRatings[category] ?? PRODUCTIVITY_TIERS.NEUTRAL;

    Object.entries(PRODUCTIVITY_TIERS).forEach(([tierName, tierValue]) => {
      const label = document.createElement('label');
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = `rating-${category.replace(/[^a-zA-Z0-9]/g, '-')}`;
      radio.value = tierValue;
      radio.dataset.category = category;
      radio.checked = currentRating === tierValue;

      label.appendChild(radio);
      const labelText = tierName.charAt(0) + tierName.slice(1).toLowerCase();
      label.appendChild(document.createTextNode(` ${labelText}`));
      controlsDiv.appendChild(label);
    });

    li.appendChild(controlsDiv);
    fragment.appendChild(li);
  });

  UIElements.productivitySettingsList.appendChild(fragment);
}

function populatePomodoroSettingsInputs(settings) {
  if (
    !UIElements.pomodoroWorkDurationInput ||
    !UIElements.pomodoroShortBreakDurationInput ||
    !UIElements.pomodoroLongBreakDurationInput ||
    !UIElements.pomodoroSessionsInput
  ) {
    console.warn('[Options UI] Pomodoro settings input elements not found for population.');
    return;
  }

  const { durations, sessionsBeforeLongBreak } = settings || {};

  const POMODORO_PHASES_WORK = 'Work';
  const POMODORO_PHASES_SHORT_BREAK = 'Short Break';
  const POMODORO_PHASES_LONG_BREAK = 'Long Break';

  const defaultDurations = {
    [POMODORO_PHASES_WORK]: 25 * 60,
    [POMODORO_PHASES_SHORT_BREAK]: 5 * 60,
    [POMODORO_PHASES_LONG_BREAK]: 15 * 60,
  };
  const defaultSessions = 4;

  const currentDurations = durations || defaultDurations;
  const currentSessions = sessionsBeforeLongBreak !== undefined ? sessionsBeforeLongBreak : defaultSessions;

  UIElements.pomodoroWorkDurationInput.value =
    (currentDurations[POMODORO_PHASES_WORK] || defaultDurations[POMODORO_PHASES_WORK]) / 60;
  UIElements.pomodoroShortBreakDurationInput.value =
    (currentDurations[POMODORO_PHASES_SHORT_BREAK] || defaultDurations[POMODORO_PHASES_SHORT_BREAK]) / 60;
  UIElements.pomodoroLongBreakDurationInput.value =
    (currentDurations[POMODORO_PHASES_LONG_BREAK] || defaultDurations[POMODORO_PHASES_LONG_BREAK]) / 60;
  UIElements.pomodoroSessionsInput.value = currentSessions;
}

async function displayPomodoroStats(periodLabel = 'Today', noDataForMainStats = false) {
  console.log(
    `[DEBUG Pomodoro UI - ENTRY] displayPomodoroStats called. periodLabel: "${periodLabel}", noDataForMainStats: ${noDataForMainStats}`
  );

  if (
    !UIElements.pomodoroStatsContainer ||
    !UIElements.pomodoroStatsLabel ||
    !UIElements.pomodoroSessionsCompletedEl ||
    !UIElements.pomodoroTimeFocusedEl
  ) {
    console.warn('[Options UI] Pomodoro stats UI elements not found. Aborting displayPomodoroStats.');
    return;
  }

  UIElements.pomodoroStatsLabel.textContent = `Tomato Clock Stats (${periodLabel})`;
  UIElements.pomodoroSessionsCompletedEl.textContent = `Work Sessions: N/A`;
  UIElements.pomodoroTimeFocusedEl.textContent = `Time Focused: N/A`;
  UIElements.pomodoroStatsContainer.style.display = 'block';

  console.log(`[DEBUG Pomodoro UI - POST UI CHECK] AppState.selectedDateStr: "${AppState.selectedDateStr}"`);

  const isMultiDayRangeLabel = periodLabel === 'This Week' || periodLabel === 'This Month';
  console.log(`[DEBUG Pomodoro UI] isMultiDayRangeLabel: ${isMultiDayRangeLabel} for periodLabel: "${periodLabel}"`);

  if (noDataForMainStats && isMultiDayRangeLabel) {
    console.log(
      '[DEBUG Pomodoro UI] Showing N/A due to noDataForMainStats and isMultiDayRangeLabel for a multi-day range.'
    );
    return;
  }

  try {
    let statsToDisplay = { workSessions: 0, totalWorkTime: 0 };
    const allDailyStats = AppState.allPomodoroDailyStats || {};
    console.log(
      '[DEBUG Pomodoro UI] AppState.allPomodoroDailyStats available:',
      Object.keys(allDailyStats).length > 0 ? JSON.parse(JSON.stringify(allDailyStats)) : '{}'
    );

    if (periodLabel === 'Today') {
      const todayStr =
        typeof getCurrentDateString === 'function' ? getCurrentDateString() : new Date().toISOString().split('T')[0];
      statsToDisplay = allDailyStats[todayStr] || { workSessions: 0, totalWorkTime: 0 };
      console.log(
        `[DEBUG Pomodoro UI] Case 'Today': dateStr: ${todayStr}, stats:`,
        JSON.parse(JSON.stringify(statsToDisplay))
      );
    } else if (periodLabel === 'This Week') {
      const today = new Date();
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateStr =
          typeof formatDate === 'function'
            ? formatDate(date)
            : new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString().split('T')[0];
        const dailyStat = allDailyStats[dateStr];
        if (dailyStat) {
          statsToDisplay.workSessions += dailyStat.workSessions || 0;
          statsToDisplay.totalWorkTime += dailyStat.totalWorkTime || 0;
        }
      }
      console.log(
        `[DEBUG Pomodoro UI] Case 'This Week': aggregated stats:`,
        JSON.parse(JSON.stringify(statsToDisplay))
      );
    } else if (periodLabel === 'This Month') {
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth();
      for (let day = 1; day <= today.getDate(); day++) {
        const date = new Date(year, month, day);
        const dateStr =
          typeof formatDate === 'function'
            ? formatDate(date)
            : new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString().split('T')[0];
        const dailyStat = allDailyStats[dateStr];
        if (dailyStat) {
          statsToDisplay.workSessions += dailyStat.workSessions || 0;
          statsToDisplay.totalWorkTime += dailyStat.totalWorkTime || 0;
        }
      }
      console.log(
        `[DEBUG Pomodoro UI] Case 'This Month': aggregated stats:`,
        JSON.parse(JSON.stringify(statsToDisplay))
      );
    } else if (periodLabel === 'All Time') {
      statsToDisplay = { workSessions: 0, totalWorkTime: 0 };
      if (Object.keys(allDailyStats).length > 0) {
        for (const dateStr_1 in allDailyStats) {
          const dailyStat_1 = allDailyStats[dateStr_1];
          if (dailyStat_1) {
            statsToDisplay.workSessions += dailyStat_1.workSessions || 0;
            statsToDisplay.totalWorkTime += dailyStat_1.totalWorkTime || 0;
          }
        }
      }
      console.log(`[DEBUG Pomodoro UI] Case 'All Time': stats:`, JSON.parse(JSON.stringify(statsToDisplay)));
    } else {
      const dateStrToUse =
        AppState.selectedDateStr ||
        (typeof getCurrentDateString === 'function' ? getCurrentDateString() : new Date().toISOString().split('T')[0]);
      console.log(
        `[DEBUG Pomodoro UI] Case 'Specific Date/Else': periodLabel: "${periodLabel}", determined dateStrToUse: "${dateStrToUse}"`
      );

      if (allDailyStats.hasOwnProperty(dateStrToUse)) {
        statsToDisplay = allDailyStats[dateStrToUse] || { workSessions: 0, totalWorkTime: 0 };
        console.log(`[DEBUG Pomodoro UI] Found data for ${dateStrToUse}:`, JSON.parse(JSON.stringify(statsToDisplay)));
      } else {
        statsToDisplay = { workSessions: 0, totalWorkTime: 0 };
        console.log(`[DEBUG Pomodoro UI] No data found for ${dateStrToUse} in allDailyStats. Using zeroed stats.`);
      }

      UIElements.pomodoroStatsLabel.textContent = `Tomato Clock Stats (${
        typeof formatDisplayDate === 'function' ? formatDisplayDate(dateStrToUse) : dateStrToUse
      })`;
    }

    UIElements.pomodoroSessionsCompletedEl.textContent = `Work Sessions: ${statsToDisplay.workSessions}`;
    UIElements.pomodoroTimeFocusedEl.textContent = `Time Focused: ${
      typeof formatTime === 'function'
        ? formatTime(statsToDisplay.totalWorkTime, false)
        : statsToDisplay.totalWorkTime / 60 + 'm'
    }`;
  } catch (error) {
    console.error('[Options UI] Error displaying Pomodoro stats:', error);
    UIElements.pomodoroSessionsCompletedEl.textContent = `Work Sessions: Error`;
    UIElements.pomodoroTimeFocusedEl.textContent = `Time Focused: Error`;
  }
}

function updateItemDetailDisplay(isInitialCall = false) {
  // Added isInitialCall parameter
  if (
    !UIElements.itemDetailSection ||
    !UIElements.itemDetailTitle ||
    !UIElements.itemDetailList ||
    !UIElements.breakdownCategorySelect
  ) {
    console.warn('[updateItemDetailDisplay] Critical UI elements for breakdown section are missing. Aborting.');
    if (UIElements.itemDetailSection) UIElements.itemDetailSection.style.display = 'none';
    return;
  }

  console.log(
    `[updateItemDetailDisplay] Current Breakdown Identifier: ${AppState.currentBreakdownIdentifier}, Initial Call: ${isInitialCall}`
  );

  let currentPeriodLabel = 'Selected Period';
  if (UIElements.dateRangeSelect.value === '' && AppState.selectedDateStr) {
    currentPeriodLabel =
      typeof formatDisplayDate === 'function' ? formatDisplayDate(AppState.selectedDateStr) : AppState.selectedDateStr;
  } else if (UIElements.dateRangeSelect.value) {
    currentPeriodLabel =
      UIElements.dateRangeSelect.options[UIElements.dateRangeSelect.selectedIndex]?.text || AppState.selectedDateStr;
  } else if (AppState.selectedDateStr) {
    currentPeriodLabel =
      typeof formatDisplayDate === 'function' ? formatDisplayDate(AppState.selectedDateStr) : AppState.selectedDateStr;
  }

  let titleBase = 'Breakdown Details';
  let dataForBreakdownList = [];

  const currentDashboardPeriodValue = UIElements.dateRangeSelect.value || AppState.selectedDateStr;
  const isSpecificDate =
    /^\d{4}-\d{2}-\d{2}$/.test(AppState.selectedDateStr) && UIElements.dateRangeSelect.value === '';
  const { domainData: currentPeriodDomainData } = getFilteredDataForRange(currentDashboardPeriodValue, isSpecificDate);

  if (AppState.currentBreakdownIdentifier === null) {
    titleBase = `Breakdown: Other Chart Domains`;
    dataForBreakdownList = [...AppState.tempChartOtherDomainsData].sort((a, b) => b.time - a.time);
    if (dataForBreakdownList.length === 0) {
      titleBase = "Details for 'Other Domains' (from Chart)";
    }
  } else if (typeof AppState.currentBreakdownIdentifier === 'string') {
    const categoryName = AppState.currentBreakdownIdentifier;
    titleBase = `Websites in: ${categoryName}`;
    if (currentPeriodDomainData) {
      const domainsInCategory = [];
      for (const domain in currentPeriodDomainData) {
        const actualCategory =
          typeof getCategoryForDomain === 'function'
            ? getCategoryForDomain(domain, AppState.categoryAssignments, AppState.categories)
            : 'Error';
        if (actualCategory === categoryName) {
          domainsInCategory.push({ name: domain, time: currentPeriodDomainData[domain] });
        }
      }
      dataForBreakdownList = domainsInCategory.sort((a, b) => b.time - a.time);
    } else {
      dataForBreakdownList = [];
    }
  } else {
    dataForBreakdownList = [];
    titleBase = 'Select an item to see details';
  }

  UIElements.itemDetailTitle.textContent = `${titleBase} (${currentPeriodLabel})`;
  UIElements.itemDetailList.innerHTML = '';

  if (dataForBreakdownList.length === 0) {
    const li = document.createElement('li');
    if (AppState.currentBreakdownIdentifier === null && AppState.tempChartOtherDomainsData.length === 0) {
      li.textContent = 'No "Other Domains" data from the current chart view, or this slice was not present/clicked.';
    } else if (typeof AppState.currentBreakdownIdentifier === 'string' && !AppState.currentBreakdownIdentifier) {
      li.textContent = 'Please select a category to see its website breakdown.';
    } else {
      li.textContent = 'No specific items to display for this selection.';
    }
    UIElements.itemDetailList.appendChild(li);
    if (UIElements.itemDetailPagination) UIElements.itemDetailPagination.style.display = 'none';
  } else {
    const totalItems = dataForBreakdownList.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / AppState.itemDetailItemsPerPage));
    AppState.itemDetailCurrentPage = Math.max(1, Math.min(AppState.itemDetailCurrentPage, totalPages));

    const startIndex = (AppState.itemDetailCurrentPage - 1) * AppState.itemDetailItemsPerPage;
    const endIndex = startIndex + AppState.itemDetailItemsPerPage;
    const paginatedItems = dataForBreakdownList.slice(startIndex, endIndex);

    paginatedItems.forEach((item) => {
      const li = document.createElement('li');
      const nameSpan = document.createElement('span');
      nameSpan.textContent = item.name;
      nameSpan.className = 'domain';

      const timeSpan = document.createElement('span');
      timeSpan.textContent = formatTime(item.time, true);
      timeSpan.className = 'time';

      li.appendChild(nameSpan);
      li.appendChild(timeSpan);
      // Inline category info or assignment (for domains currently in 'Other')
      try {
        if (
          typeof getCategoryForDomain === 'function' &&
          AppState &&
          AppState.categoryAssignments &&
          AppState.categories
        ) {
          const currentCategory = getCategoryForDomain(
            item.name,
            AppState.categoryAssignments,
            AppState.categories
          );

          const controlsContainer = document.createElement('span');
          controlsContainer.className = 'inline-category-control';

          if (currentCategory && currentCategory !== 'Other') {
            const catBadge = document.createElement('span');
            catBadge.className = 'inline-category-badge';
            catBadge.textContent = currentCategory;
            controlsContainer.appendChild(catBadge);
          } else {
            // Build a compact select to assign a category quickly
            const select = document.createElement('select');
            select.className = 'inline-category-select';
            const defaultOpt = document.createElement('option');
            defaultOpt.value = '';
            defaultOpt.textContent = 'Assign category…';
            select.appendChild(defaultOpt);
            // Populate with categories (excluding 'Other' to encourage classification)
            AppState.categories
              .filter((c) => c && c !== 'Other')
              .forEach((cat) => {
                const opt = document.createElement('option');
                opt.value = cat;
                opt.textContent = cat;
                select.appendChild(opt);
              });

            select.addEventListener('change', (e) => {
              const chosen = e.target.value;
              if (!chosen) return;
              if (typeof handleInlineAssignCategoryForDomain === 'function') {
                handleInlineAssignCategoryForDomain(item.name, chosen, currentCategory || 'Other');
              }
            });
            controlsContainer.appendChild(select);
          }
          li.appendChild(controlsContainer);
        }
      } catch (err) {
        console.warn('[UI] Error building inline category assign control (item detail):', err);
      }
      UIElements.itemDetailList.appendChild(li);
    });

    if (UIElements.itemDetailPageInfo)
      UIElements.itemDetailPageInfo.textContent = `Page ${AppState.itemDetailCurrentPage} of ${totalPages}`;
    if (UIElements.itemDetailPrevBtn) UIElements.itemDetailPrevBtn.disabled = AppState.itemDetailCurrentPage <= 1;
    if (UIElements.itemDetailNextBtn)
      UIElements.itemDetailNextBtn.disabled = AppState.itemDetailCurrentPage >= totalPages;
    if (UIElements.itemDetailPagination)
      UIElements.itemDetailPagination.style.display = totalPages > 1 ? 'flex' : 'none';
  }

  const shouldShowSection =
    dataForBreakdownList.length > 0 ||
    typeof AppState.currentBreakdownIdentifier === 'string' ||
    AppState.currentBreakdownIdentifier === null;
  UIElements.itemDetailSection.style.display = shouldShowSection ? 'block' : 'none';

  if (shouldShowSection) {
    if (isInitialCall) {
      // Only add 'scrolled-once' on initial load if section is shown, don't scroll
      if (!UIElements.itemDetailSection.classList.contains('scrolled-once')) {
        UIElements.itemDetailSection.classList.add('scrolled-once');
      }
    } else {
      // Subsequent calls (user interactions)
      if (!UIElements.itemDetailSection.classList.contains('scrolled-once')) {
        UIElements.itemDetailSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        UIElements.itemDetailSection.classList.add('scrolled-once');
      } else if (UIElements.itemDetailSection.classList.contains('scrolled-once-prompt')) {
        UIElements.itemDetailSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        UIElements.itemDetailSection.classList.remove('scrolled-once-prompt');
      }
    }
  } else {
    UIElements.itemDetailSection.classList.remove('scrolled-once', 'scrolled-once-prompt');
  }
}
