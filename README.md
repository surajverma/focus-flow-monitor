# Focus Flow Monitor

**Track your time online, gain insights, control distractions, and stay productive with this privacy-focused Firefox extension.**

[![License: MPL 2.0](https://img.shields.io/badge/License-MPL_2.0-brightgreen.svg)](https://opensource.org/licenses/MPL-2.0)
[![Mozilla Add-on (Stable)](https://img.shields.io/amo/v/focusflow-monitor?label=Stable&color=007bff)](https://addons.mozilla.org/en-US/firefox/addon/focusflow-monitor/)
[![Latest Beta Release](https://img.shields.io/github/v/release/SurajVerma/focus-flow-monitor?include_prereleases&label=Beta&color=orange)](https://github.com/SurajVerma/focus-flow-monitor/releases)
[![GitHub last commit](https://img.shields.io/github/last-commit/SurajVerma/focus-flow-monitor)](https://github.com/SurajVerma/focus-flow-monitor/commits/main)
[![GitHub issues](https://img.shields.io/github/issues/SurajVerma/focus-flow-monitor)](https://github.com/SurajVerma/focus-flow-monitor/issues)
[![GitHub Stars](https://img.shields.io/github/stars/SurajVerma/focus-flow-monitor?style=social)](https://github.com/SurajVerma/focus-flow-monitor/stargazers)

Focus Flow Monitor helps you understand your online habits by tracking the time you spend on different websites. Gain insights through categorized statistics, visual charts, and a daily focus score. Set limits, schedule blocks, or permanently block distracting sites to stay productive. All your data stays local, prioritizing your privacy.

![Quick View Popup](https://github.com/user-attachments/assets/5b8d9bdc-af18-4fd0-ad0b-c738edf66169)

---

**Quick Links**

- [What's New](#whats-new-in-version-0901-beta)
- [Key Features](#key-features)
- [Privacy](#privacy)
- [Installation](#installation)
- [Beta Version & Data Management](#beta-version--data-management)
- [Usage Notes](#usage-notes)
- [Screenshots](#screenshots)
- [Contributing](#contributing)
  - [Development Setup](#development-setup)
- [License](#license)

---

## What's New in this Version

For more details on this and previous updates, check out the [Releases Page](https://github.com/SurajVerma/focus-flow-monitor/releases).

[⬆️ Back to Top](#focus-flow-monitor)
---

## Key Features

- **Automatic Time Tracking:** Monitors time spent on websites in your active browser tab. Pauses tracking during inactivity (configurable duration).
- **Website Categorization:** Automatically assigns websites to predefined or custom categories (e.g., Work, Social Media, Entertainment).
  - Easily edit existing categories and domain assignments (wildcards supported).
- **Detailed Statistics:** View comprehensive reports of time spent per website and category for various periods (Today, This Week, This Month, All Time).
- **Visual Charts:**
  - Doughnut chart for an intuitive visual breakdown of time by site or category on the statistics page.
  - Hourly activity bar chart in the popup for a quick daily overview.
- **Interactive Calendar View:** Explore daily time totals and top websites. Clicking any date updates all statistic displays (Category List, Website List, Focus Score, Chart) for that selected day.
- **Focus Score:** Rate your website categories (e.g., Productive, Neutral, Distracting) to generate a daily focus score, helping you gauge your productivity at a glance.
- **Site Blocking & Limiting:**
  - Set daily time limits for specific websites or entire categories.
  - Choose calendar-day, calendar-week, or calendar-month limits (weeks start Monday).
  - Permanently block access to distracting websites.
  - **Scheduled Blocking** – Define specific days and times for your block rules to be active.
  - Use domain, exact URL, or URL-prefix matching with explicit exceptions.
- **Current-site action:** Block or unblock the active website directly from the popup.
- **Focus profiles:** Create local allow-list profiles, start or stop them manually, and keep the active profile visible in the options page.
- **Weekly insights:** Review local focus score comparisons, top domains, category totals, daily limit periods, and best focus days.
- **Customizable Block Page:** Personalize the experience when a site is blocked with custom messages, motivational quotes, and control over displayed information.
- **Data Management:**
  - Export your complete tracking history and settings for backup.
  - Import previously exported data to restore your setup.
  - **Data Retention Settings:** Set a custom duration for how long tracking data is stored.
- **Tomato Clock** : Boost your productivity even further with Tomato Clock in Quick View Panel!
- **Theme Support:** Automatically matches your browser or operating system's light or dark theme.
- **Privacy Focused:** All your tracking data is stored locally within your browser. No data is ever sent to external servers.

[⬆️ Back to Top](#focus-flow-monitor)
---

## Privacy

**Privacy-first by design.**

Focus Flow Monitor does not employ any external tracking or analytics. Your Browse and time data stays local, stored entirely within your browser's storage, and is never transmitted elsewhere. You have full control over your data, including options to export it, clear it, and set data retention periods.

[⬆️ Back to Top](#focus-flow-monitor)
---

## Installation

Get the latest **stable version** from the official Firefox Add-ons page:

[**Install Focus Flow Monitor (AMO Stable)**](https://addons.mozilla.org/en-US/firefox/addon/focusflow-monitor/)

For the latest features and updates, you can install the **Beta version** directly from [GitHub Releases](https://github.com/SurajVerma/focus-flow-monitor/releases).

Make sure to pin the extension to your toolbar.

[⬆️ Back to Top](#focus-flow-monitor)
---

## Beta Version & Data Management

Starting with version 0.9.0.1, the version available on GitHub Releases will be tagged as **beta**. Beta versions are typically identified by a **four-part version number** (e.g., `0.9.0.1`), while stable AMO releases use a three-part version number (e.g., `0.9.0`).

- **Early Access:** Beta versions receive updates and new features first.
- **Testing:** While I test beta versions before releasing, they may contain bugs. Your feedback on these is invaluable!
- **Path to Stable:** These updates, along with any necessary fixes, will later be rolled out to the AMO (Mozilla Add-ons) version as stable releases.

**Important Notes for Beta Users:**

- **Separate Installations:** You can install both the AMO (stable) version and the GitHub (beta) version of Focus Flow Monitor simultaneously in Firefox. They will operate as two distinct extensions.
- **No Shared Data:** The data (tracking history, settings, etc.) is **not shared** between the AMO version and the GitHub beta version. Each installation maintains its own separate local storage.
- **Switching Between Versions:** If you wish to switch from one version to the other (e.g., from AMO to Beta, or Beta to AMO) and want to keep your data, you **must**:
  1.  **Export your data** from the version you are currently using (via the Options page > Data Management > Export All Data).
  2.  **Import that data** into the new version you've installed (via its Options page > Data Management > Import Data from File).

[⬆️ Back to Top](#focus-flow-monitor)
---

## Usage Notes

- **Rule precedence:** Disabled rules do not match; explicit URL modes are more specific than domain modes; a matching exception allows a broader block; among matching blocks, the most specific target wins.
- **Path matching:** Exact URL and URL-prefix rules use Firefox navigation URLs. Single-page applications that do not expose navigation changes may require a normal page navigation before a path rule can take effect.
- **Focus profiles:** An active profile allows only its configured domains and categories. Firefox internal pages and extension pages remain available. Stop the profile from the Options page to restore normal browsing.
- **Backups:** New `.ffm` files include schema version, extension version, and export timestamp. Legacy unversioned backups are accepted, sanitized, and migrated before storage.

- **Tracking Inactivity:** To accurately capture activities like video watching or reading, tracking pauses only when you're inactive (no mouse or keyboard input) for a duration you can configure (default is 30 minutes; options range from 1 minute to 1 hour, or can be disabled).
- **Accessing Options Page:** You can access detailed statistics, manage categories, set site rules (including schedules and block page customization), and configure all settings via the extension's options page.
  - Right-click the extension icon in the Firefox toolbar → "Manage Extension" → "Preferences/Options" (⚙️ icon).
  - Alternatively, click the gear (⚙️) icon in the extension popup.
- **How to use Tomato Clock:**

  - Click on the Focus Flow Monitor icon in your browser toolbar.
  - You'll find the "Tomato Clock" section right in the popup.
  - Click "Start" to begin your first work session!
  - A Pomodoro cycle consists of 4 work sessions, with a short break after each of the first 3 sessions, followed by a long break at the end. The timer will automatically guide you to the next stage—for example, after completing a work session, it will prompt you to start the short break. However, you're free to manually switch between timers if you prefer.
  - The remaining time will appear in the toolbar if the extension is pinned: ![image](https://github.com/user-attachments/assets/64ac383c-0406-4b57-b7ed-da80108d9b83). If you want **Focus Flow Monitor** to notify you when the timer ends, the extension will need notification permissions. You can grant this by clicking the bell icon in the popup which will take you to Tomato Clock settings on the Options page.

- **Active Development:** Focus Flow Monitor is actively maintained and improved. Feedback and suggestions are always welcome!

[⬆️ Back to Top](#focus-flow-monitor)
---

## Screenshots

**Dashboard**
![dashboard](https://github.com/user-attachments/assets/51a27e18-9b6b-4bea-8202-d221b1030f8a)

**Content Control**
![content-control](https://github.com/user-attachments/assets/abcbf7b4-616d-4808-acc2-ddb4dff6b854)

**Productivity**
![productivity](https://github.com/user-attachments/assets/8b6fc986-b892-43b8-b01b-66253ccdf3d9)

**Settings**
![settings](https://github.com/user-attachments/assets/85631834-fc34-464b-ab7a-23e9a7903b07)

**Blocked Page Example:**
![Blocked Page](https://github.com/user-attachments/assets/01c6ba2b-595c-41a1-943b-15ed34228b61)

[⬆️ Back to Top](#focus-flow-monitor)
---

## Contributing

We welcome contributions from the community! Whether it's reporting a bug, suggesting a new feature, or writing code, your help is appreciated.

- **Report Issues or Suggest Features:** Please use the [GitHub Issues](https://github.com/SurajVerma/focus-flow-monitor/issues) page.
- **Contribute Code:**
  1.  Fork the repository.
  2.  Create a new branch for your feature or bug fix (`git checkout -b feature/your-amazing-feature` or `fix/issue-number`).
  3.  Make your changes and commit them with clear messages.
  4.  Push your branch to your fork (`git push origin feature/your-amazing-feature`).
  5.  Open a Pull Request against the `main` (or relevant development) branch of this repository.

### Development Setup

1.  Clone the repository:
    ```bash
    git clone [https://github.com/SurajVerma/focus-flow-monitor.git](https://github.com/SurajVerma/focus-flow-monitor.git)
    cd focus-flow-monitor
    ```
2.  Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
3.  Click on "Load Temporary Add-on...".
4.  Browse to the directory where you cloned the repository and select the `manifest.json` file (or the specific manifest for the version you are working on, e.g., `manifest-beta.json` if you set one up).
5.  The extension will now be loaded. To see changes you make to the code, you'll typically need to reload the extension from the `about:debugging` page (using the "Reload" button for the extension).

### Local Development Commands

```bash
npm install
npm run check          # validation, lint, formatting, and Jest
npm test -- --watch   # focused development loop
npm run build:dev     # beta package in dist/beta
npm run build         # version-selected production package
npm run build:release # stable production package in dist/release
```

The background page loads browser-independent modules from `src/core/` before the Firefox Manifest V2 scripts. Tracking data, profiles, exclusions, and backups remain in `browser.storage.local`; the extension has no account, server, analytics, or remote-code path.

[⬆️ Back to Top](#focus-flow-monitor)
---

## License

This project is licensed under the **Mozilla Public License Version 2.0**.

You can view the full license text in the [LICENSE](LICENSE) file.

_In simple terms, this means you are free to use, modify, and distribute the software, but if you modify files licensed under MPL 2.0, you must make your modifications available under the same MPL 2.0 license. Please ensure you retain the original copyright and license notices._

[⬆️ Back to Top](#focus-flow-monitor)
---

_Created with ❤️ in India by Suraj_
