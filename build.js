/**
 * ============================================================================
 *  BUILD SCRIPT
 * ============================================================================
 *  Reads config from .env (and/or environment variables), injects it into the
 *  files in templates/, and writes the finished pages to public/.
 *
 *  Run:  npm run build   (Vercel runs this automatically on every deploy)
 *
 *  No dependencies. Plain Node.js.
 *
 *  Token rules:
 *    - Any {{KEY}} in a template is replaced when KEY exists in the config.
 *    - Unknown tokens are LEFT UNTOUCHED. That's how {{GUEST_NAME}} survives in
 *      the email so your mail tool can fill it per recipient.
 *
 *  Config precedence (highest wins):
 *    process.env  >  .env file  >  built-in DEFAULTS
 *    (process.env lets you override via the Vercel dashboard without editing .env)
 * ============================================================================
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const TEMPLATES_DIR = path.join(ROOT, 'templates');
const OUT_DIR = path.join(ROOT, 'public');

// Files to build: [source template, output name]
// (The email is a standalone, hand-edited file — email.html at the repo root —
//  because email clients can't run a build. It is NOT part of this pipeline.)
const BUILDS = [
  ['index.template.html', 'index.html'],
];

// Every configurable key with a safe default, so the build never fails even
// with no .env present.
const DEFAULTS = {
  COUSIN_NAME: 'Your Cousin',
  DOWNLOAD_URL: 'https://drive.google.com/file/d/YOUR_GOOGLE_DRIVE_FILE_ID/view?usp=sharing',
  TRACKING_ENDPOINT: '',
  PARTY_DATE: 'July 15, 2026',
  PARTY_TIME: '4:00 PM',
};

/** Minimal .env parser (no dependency). Supports KEY=value and # comments. */
function parseEnv(text) {
  const out = {};
  text.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq === -1) return;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    // Strip a single pair of surrounding quotes, if present.
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key) out[key] = val;
  });
  return out;
}

/** Load config: DEFAULTS < .env file < process.env (for known keys). */
function loadConfig() {
  const config = Object.assign({}, DEFAULTS);

  const envPath = path.join(ROOT, '.env');
  if (fs.existsSync(envPath)) {
    Object.assign(config, parseEnv(fs.readFileSync(envPath, 'utf8')));
  }

  // Allow Vercel dashboard / shell env vars to override any known key.
  Object.keys(config).forEach((key) => {
    if (process.env[key] !== undefined && process.env[key] !== '') {
      config[key] = process.env[key];
    }
  });

  return config;
}

/** Replace every {{KEY}} that exists in config. Unknown tokens stay as-is. */
function inject(template, config) {
  let output = template;
  Object.keys(config).forEach((key) => {
    output = output.split('{{' + key + '}}').join(config[key]);
  });
  return output;
}

/** Warn (don't fail) when a value still looks like a placeholder. */
function warnPlaceholders(config) {
  const checks = [
    ['DOWNLOAD_URL', 'YOUR_GOOGLE_DRIVE_FILE_ID'],
  ];
  checks.forEach(([key, needle]) => {
    if ((config[key] || '').indexOf(needle) !== -1) {
      console.warn('  ⚠  ' + key + ' still looks like a placeholder — update it in .env');
    }
  });
  if (!config.TRACKING_ENDPOINT) {
    console.warn('  ⚠  TRACKING_ENDPOINT is blank — visitor tracking is disabled.');
  }
}

function main() {
  const config = loadConfig();

  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('Building birthday invite for "' + config.COUSIN_NAME + '"…');

  BUILDS.forEach(([src, outName]) => {
    const srcPath = path.join(TEMPLATES_DIR, src);
    const outPath = path.join(OUT_DIR, outName);
    const template = fs.readFileSync(srcPath, 'utf8');
    fs.writeFileSync(outPath, inject(template, config), 'utf8');
    console.log('  ✓ ' + path.relative(ROOT, outPath));
  });

  warnPlaceholders(config);
  console.log('Done. Output is in public/');
}

main();
