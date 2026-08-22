#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const distPath = path.join(__dirname, '..', 'dist');
fs.rmSync(distPath, { recursive: true, force: true });
