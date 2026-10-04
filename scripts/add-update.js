#!/usr/bin/env node
// scripts/add-update.js
// Adds the signed beta .xpi for the current package.json version to updates.json.
// Put the .xpi downloaded from Mozilla in web-ext-artifacts/, then run: npm run add-update
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { version } = require('../package.json');

const REPO_URL = 'https://github.com/SurajVerma/focus-flow-monitor';
const MAX_UPDATE_ENTRIES = 5;
const artifactsDir = path.join(__dirname, '..', 'web-ext-artifacts');
const updatesJsonPath = path.join(__dirname, '..', 'updates.json');
const manifestBetaPath = path.join(__dirname, '..', 'manifest-beta.json');

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

if (!version) fail('Version not found in package.json.');

// The signed file from Mozilla is named <prefix>-<version>.xpi
const xpiSuffix = `-${version}.xpi`;
const allXpiFiles = fs.existsSync(artifactsDir)
  ? fs.readdirSync(artifactsDir).filter((name) => name.toLowerCase().endsWith('.xpi'))
  : [];
const matchingFiles = allXpiFiles.filter((name) => name.endsWith(xpiSuffix));

if (matchingFiles.length === 0) {
  const found = allXpiFiles.length ? ` Found: ${allXpiFiles.join(', ')}` : '';
  fail(`No .xpi for version ${version} in web-ext-artifacts/ (expected a name ending in "${xpiSuffix}").${found}`);
}
if (matchingFiles.length > 1) {
  fail(`More than one .xpi for version ${version} in web-ext-artifacts/: ${matchingFiles.join(', ')}`);
}

const xpiName = matchingFiles[0];
const addonId = JSON.parse(fs.readFileSync(manifestBetaPath, 'utf-8')).browser_specific_settings.gecko.id;

const updatesSource = fs.readFileSync(updatesJsonPath, 'utf-8');
const updatesData = JSON.parse(updatesSource);
const addon = updatesData.addons && updatesData.addons[addonId];
if (!addon || !Array.isArray(addon.updates)) {
  fail(`updates.json has no update list for addon ID ${addonId}.`);
}
if (addon.updates.some((update) => update.version === version)) {
  fail(`updates.json already has an entry for version ${version}. Nothing was changed.`);
}

const hash = crypto
  .createHash('sha256')
  .update(fs.readFileSync(path.join(artifactsDir, xpiName)))
  .digest('hex')
  .toUpperCase();

addon.updates.unshift({
  version,
  update_link: `${REPO_URL}/releases/download/v${version}/${xpiName}`,
  update_hash: `sha256:${hash}`,
  update_info_url: `${REPO_URL}/releases/tag/v${version}`,
});

// The list is newest first; keep only the latest MAX_UPDATE_ENTRIES
const removedUpdates = addon.updates.splice(MAX_UPDATE_ENTRIES);

// Keep the file's existing line endings
const eol = updatesSource.includes('\r\n') ? '\r\n' : '\n';
fs.writeFileSync(updatesJsonPath, JSON.stringify(updatesData, null, 2).replace(/\n/g, eol) + eol);

console.log(`Added version ${version} to updates.json`);
console.log(`  file: ${xpiName}`);
console.log(`  hash: sha256:${hash}`);
if (removedUpdates.length) {
  console.log(`  removed older entries: ${removedUpdates.map((update) => update.version).join(', ')}`);
}
console.log('Upload the .xpi to the GitHub release before publishing updates.json.');
