#!/usr/bin/env node
/**
 * Validates the extension structure and manifests
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
let hasErrors = false;

function error(msg) {
  console.error(`❌ ${msg}`);
  hasErrors = true;
}

function warn(msg) {
  console.warn(`⚠️  ${msg}`);
}

function success(msg) {
  console.log(`✓ ${msg}`);
}

// Check manifests
['manifest.json', 'manifest-beta.json'].forEach((manifestFile) => {
  const manifestPath = path.join(projectRoot, manifestFile);
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    // Check required fields
    if (!manifest.manifest_version) error(`${manifestFile}: missing manifest_version`);
    if (!manifest.name) error(`${manifestFile}: missing name`);
    if (!manifest.version) error(`${manifestFile}: missing version`);
    if (!manifest.permissions) error(`${manifestFile}: missing permissions`);

    // Check background scripts exist
    if (manifest.background && manifest.background.scripts) {
      manifest.background.scripts.forEach((script) => {
        const scriptPath = path.join(projectRoot, script);
        if (!fs.existsSync(scriptPath)) {
          error(`${manifestFile}: background script not found: ${script}`);
        }
      });
    }

    // Check UI files exist
    ['browser_action', 'options_ui'].forEach((key) => {
      if (manifest[key] && manifest[key].default_popup) {
        const uiPath = path.join(projectRoot, manifest[key].default_popup);
        if (!fs.existsSync(uiPath)) {
          error(`${manifestFile}: UI file not found: ${manifest[key].default_popup}`);
        }
      }
      if (manifest[key] && manifest[key].page) {
        const uiPath = path.join(projectRoot, manifest[key].page);
        if (!fs.existsSync(uiPath)) {
          error(`${manifestFile}: UI file not found: ${manifest[key].page}`);
        }
      }
    });

    // Check web-accessible resources
    if (manifest.web_accessible_resources) {
      manifest.web_accessible_resources.forEach((resource) => {
        const resourcePath = path.join(projectRoot, resource);
        if (!fs.existsSync(resourcePath)) {
          error(`${manifestFile}: web accessible resource not found: ${resource}`);
        }
      });
    }

    // Check icons
    if (manifest.icons) {
      Object.values(manifest.icons).forEach((icon) => {
        const iconPath = path.join(projectRoot, icon);
        if (!fs.existsSync(iconPath)) {
          error(`${manifestFile}: icon not found: ${icon}`);
        }
      });
    }

    success(`${manifestFile} structure valid`);
  } catch (err) {
    error(`${manifestFile}: ${err.message}`);
  }
});

// Check package.json version format
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  const versionParts = pkg.version.split('.');

  if (versionParts.length === 3) {
    success('package.json: release version format (X.Y.Z)');
  } else if (versionParts.length === 4) {
    success('package.json: beta version format (X.Y.Z.B)');
  } else {
    warn(`package.json: unusual version format: ${pkg.version}`);
  }
} catch (err) {
  error(`package.json: ${err.message}`);
}

// Check default config
try {
  const config = JSON.parse(fs.readFileSync(path.join(projectRoot, 'data/default_config.json'), 'utf8'));
  if (!Array.isArray(config.categories)) error('default_config.json: categories must be an array');
  if (!config.assignments || typeof config.assignments !== 'object')
    error('default_config.json: assignments must be an object');
  success('default_config.json structure valid');
} catch (err) {
  error(`default_config.json: ${err.message}`);
}

// Check available production builds.
['beta', 'release'].forEach((target) => {
  const distManifestPath = path.join(projectRoot, `dist/${target}/manifest.json`);
  if (!fs.existsSync(distManifestPath)) {
    warn(`dist/${target} build does not exist`);
    return;
  }
  try {
    const builtManifest = JSON.parse(fs.readFileSync(distManifestPath, 'utf8'));
    ['popup/popup.html', 'options/options.html', 'blocked/blocked.html'].forEach((asset) => {
      if (!fs.existsSync(path.join(projectRoot, `dist/${target}`, asset))) error(`dist/${target}: missing ${asset}`);
    });
    success(`dist/${target} build exists and manifest is valid (${builtManifest.version})`);
  } catch (err) {
    error(`dist/${target}/manifest.json is invalid: ${err.message}`);
  }
});

process.exit(hasErrors ? 1 : 0);
