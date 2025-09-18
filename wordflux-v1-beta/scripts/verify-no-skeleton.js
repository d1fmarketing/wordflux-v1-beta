#!/usr/bin/env node

/**
 * verify-no-skeleton.js
 *
 * Build-time verification script to ensure NO skeleton/shimmer code
 * exists in the production build. Part of v108 nuclear defenses.
 *
 * Run after build to verify skeleton elimination is complete.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const FORBIDDEN_PATTERNS = [
  // Class name patterns
  /class[N|n]ame\s*=\s*["'][^"']*skeleton/gi,
  /class[N|n]ame\s*=\s*["'][^"']*shimmer/gi,
  /class[N|n]ame\s*=\s*["'][^"']*loading[-_]overlay/gi,

  // CSS class selectors
  /\.skeleton[^a-zA-Z]/g,
  /\.shimmer[^a-zA-Z]/g,
  /\.loading-overlay/g,

  // Animation keyframes
  /@keyframes\s+shimmer/gi,
  /@keyframes\s+skeleton/gi,
  /@keyframes\s+pulse(?!-width)/gi,  // Allow pulse-width but not pulse

  // Striped gradients
  /repeating-linear-gradient/g,
  /linear-gradient\([^)]*stripe/gi,

  // Data attributes
  /data-skeleton/gi,
  /data-loading\s*=\s*["']true/gi,
  /aria-busy\s*=\s*["']true/gi,
];

const ALLOWED_FILES = [
  'verify-no-skeleton.js',  // This file itself
  'globals.css',             // Contains nuclear defenses
  'BoardColumn.module.css',  // Contains nuclear defenses
];

let violations = [];

function checkFile(filePath) {
  const fileName = path.basename(filePath);

  // Skip allowed files
  if (ALLOWED_FILES.includes(fileName)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');

  FORBIDDEN_PATTERNS.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      violations.push({
        file: filePath,
        pattern: pattern.toString(),
        matches: matches.slice(0, 3),  // Show first 3 matches
        count: matches.length
      });
    }
  });
}

function scanDirectory(dir) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Skip node_modules and .git
      if (file !== 'node_modules' && file !== '.git' && file !== '.next') {
        scanDirectory(fullPath);
      }
    } else if (stat.isFile()) {
      // Check JS, JSX, TS, TSX, CSS files
      if (/\.(js|jsx|ts|tsx|css)$/.test(file)) {
        checkFile(fullPath);
      }
    }
  });
}

function scanBuildOutput() {
  const buildDir = path.join(process.cwd(), '.next');

  if (!fs.existsSync(buildDir)) {
    console.log('❌ Build directory .next not found. Run npm run build first.');
    process.exit(1);
  }

  // Scan built CSS files
  const cssDir = path.join(buildDir, 'static', 'css');
  if (fs.existsSync(cssDir)) {
    fs.readdirSync(cssDir).forEach(file => {
      if (file.endsWith('.css')) {
        checkFile(path.join(cssDir, file));
      }
    });
  }

  // Scan built JS files (chunks)
  const chunksDir = path.join(buildDir, 'static', 'chunks');
  if (fs.existsSync(chunksDir)) {
    fs.readdirSync(chunksDir).forEach(file => {
      if (file.endsWith('.js')) {
        const filePath = path.join(chunksDir, file);
        const content = fs.readFileSync(filePath, 'utf8');

        // Check for skeleton/shimmer strings in JS
        if (/skeleton|shimmer|loading.?overlay/i.test(content)) {
          // But allow our nuclear defenses
          if (!/NUCLEAR.*KILLER|kill.*skeleton/i.test(content)) {
            violations.push({
              file: filePath,
              pattern: 'Skeleton/shimmer reference in JS',
              matches: ['Found skeleton/shimmer strings'],
              count: 1
            });
          }
        }
      }
    });
  }
}

console.log('🔍 Verifying NO skeleton/shimmer code in build...\n');

// Scan source files
console.log('Scanning source files...');
scanDirectory(path.join(process.cwd(), 'app'));

// Scan build output
console.log('Scanning build output...');
scanBuildOutput();

// Report results
if (violations.length === 0) {
  console.log('\n✅ SUCCESS: No skeleton/shimmer code found!');
  console.log('🛡️ Nuclear defenses are working. Build is clean.\n');
  process.exit(0);
} else {
  console.log('\n❌ VIOLATIONS FOUND:\n');

  violations.forEach(v => {
    console.log(`📁 ${v.file}`);
    console.log(`   Pattern: ${v.pattern}`);
    console.log(`   Matches (${v.count} total):`, v.matches);
    console.log('');
  });

  console.log(`\n⚠️ Total violations: ${violations.length}`);
  console.log('Fix these issues before deploying!\n');
  process.exit(1);
}