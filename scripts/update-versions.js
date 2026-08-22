// scripts/update-versions.js
const fs = require('fs');
const path = require('path');
const { version } = require('../package.json'); // Get version from package.json

if (!version) {
  console.error('Error: Version not found in package.json');
  process.exit(1);
}

console.log(`Processing version: ${version} for manifest updates.`);

const versionParts = version.split('.');
const isBetaVersion = versionParts.length === 4;
const isReleaseVersion = versionParts.length === 3;

const manifestBetaPath = path.join(__dirname, '../manifest-beta.json');
const manifestReleasePath = path.join(__dirname, '../manifest.json');
const updatesJsonPath = path.join(__dirname, '../updates.json');

/**
 * Updates a given manifest file with the current version.
 * @param {string} manifestPath - The path to the manifest file.
 * @param {string} currentVersion - The version to set.
 */
function updateManifestFile(manifestPath, currentVersion) {
  try {
    const manifestSource = fs.readFileSync(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestSource);
    const versionPattern = /("version"\s*:\s*)"[^"]+"/;
    const updatedSource = manifestSource.replace(versionPattern, `$1${JSON.stringify(currentVersion)}`);

    if (manifest.version === undefined || !versionPattern.test(manifestSource)) {
      throw new Error('Manifest does not contain a replaceable version field.');
    }

    JSON.parse(updatedSource);
    fs.writeFileSync(manifestPath, updatedSource);
    console.log(`Updated ${path.basename(manifestPath)} to version ${currentVersion}`);
  } catch (err) {
    console.error(`Error updating ${path.basename(manifestPath)}:`, err);
    process.exit(1); // Exit if manifest update fails
  }
}

/**
 * Checks and warns about updates.json version.
 * @param {string} currentVersion - The version from package.json.
 */
function checkUpdatesJson(currentVersion) {
  try {
    if (!fs.existsSync(updatesJsonPath)) {
      console.warn(`Warning: updates.json not found at ${updatesJsonPath}. Skipping updates.json check.`);
      return;
    }
    const updatesData = JSON.parse(fs.readFileSync(updatesJsonPath, 'utf-8'));
    // Assuming your addon ID for updates.json. Adjust if necessary.
    const addonId = 'focusflow-monitor@bleuflex.com';

    if (updatesData.addons && updatesData.addons[addonId] && updatesData.addons[addonId].updates.length > 0) {
      const latestUpdate = updatesData.addons[addonId].updates[0];
      if (latestUpdate.version !== currentVersion) {
        console.warn(
          `Warning: The latest version in updates.json (${latestUpdate.version}) for addon ${addonId} does not match package.json version (${currentVersion}).`
        );
        console.warn(`Please ensure updates.json is structured correctly for the new version.`);
      } else {
        console.log(
          `updates.json latest version (${latestUpdate.version}) for addon ${addonId} already matches package.json version (${currentVersion}).`
        );
      }
    } else {
      console.warn(
        `Could not find update entries in updates.json for addon ID: ${addonId}. Please check the file structure or addon ID.`
      );
    }
  } catch (err) {
    console.error(`Error processing updates.json:`, err);
    // Do not exit for updates.json errors, as it might be optional or handled differently.
  }
}

if (isBetaVersion) {
  console.log(`Updating for BETA version (${version}).`);
  updateManifestFile(manifestBetaPath, version);
  checkUpdatesJson(version); // Check updates.json for beta versions
} else if (isReleaseVersion) {
  console.log(`Updating for RELEASE version (${version}).`);
  updateManifestFile(manifestReleasePath, version);
  // Typically, updates.json is not directly modified or checked for public releases in the same way,
  // but you can add logic here if needed for your release workflow.
  console.log('Skipping updates.json check for release version.');
} else {
  console.warn(
    `WARNING: Version format (${version}) in package.json is not 3 (X.Y.Z for release) or 4 (X.Y.Z.B for beta) parts.`
  );
  console.warn('No manifest files were automatically updated by this script due to unrecognized version format.');
  // Optionally, you could decide to update both or neither in this fallback case.
  // For now, it updates none if the format is unexpected.
}

console.log('Version update script finished.');
