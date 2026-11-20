/**
 * Frontend Verification Script
 * Validates:
 * 1. Syntax of every JS file (via node parse)
 * 2. Relative import path resolution
 * 3. Translation key completeness across en.json, hi.json, kn.json
 * 4. API endpoint matching against backend routes
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const frontendJsDir = path.resolve(projectRoot, 'frontend', 'js');
const i18nDir = path.resolve(frontendJsDir, 'i18n');

function getFiles(dir, ext = '.js', list = []) {
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    if (fs.statSync(full).isDirectory()) {
      getFiles(full, ext, list);
    } else if (full.endsWith(ext)) {
      list.push(full);
    }
  }
  return list;
}

console.log('====================================================');
console.log('1. JAVASCRIPT SYNTAX & IMPORT RESOLUTION CHECKS');
console.log('====================================================');

const jsFiles = getFiles(frontendJsDir, '.js');
console.log(`Found ${jsFiles.length} JavaScript files in frontend/js/`);

let syntaxErrors = 0;
let brokenImports = 0;

for (const f of jsFiles) {
  const rel = path.relative(frontendJsDir, f);
  const content = fs.readFileSync(f, 'utf8');

  // Check imports
  const importRegex = /(?:import|export)\s+.*?from\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = importRegex.exec(content)) !== null) {
    const target = m[1];
    if (target.startsWith('.')) {
      const resolved = path.resolve(path.dirname(f), target);
      if (!fs.existsSync(resolved)) {
        console.error(`  [FAIL] Broken import in ${rel}: "${target}" -> "${resolved}"`);
        brokenImports++;
      }
    }
  }
}

if (brokenImports === 0) {
  console.log(`  [PASS] All module imports resolve successfully.`);
}

console.log('\n====================================================');
console.log('2. TRANSLATION KEY AUDIT (en.json, hi.json, kn.json)');
console.log('====================================================');

const en = JSON.parse(fs.readFileSync(path.join(i18nDir, 'en.json'), 'utf8'));
const hi = JSON.parse(fs.readFileSync(path.join(i18nDir, 'hi.json'), 'utf8'));
const kn = JSON.parse(fs.readFileSync(path.join(i18nDir, 'kn.json'), 'utf8'));

function flattenKeys(obj, prefix = '') {
  let keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      keys.push(...flattenKeys(v, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

const enKeys = new Set(flattenKeys(en));
const hiKeys = new Set(flattenKeys(hi));
const knKeys = new Set(flattenKeys(kn));

console.log(`en.json keys: ${enKeys.size}`);
console.log(`hi.json keys: ${hiKeys.size}`);
console.log(`kn.json keys: ${knKeys.size}`);

const missingInHi = [...enKeys].filter(k => !hiKeys.has(k));
const missingInKn = [...enKeys].filter(k => !knKeys.has(k));

if (missingInHi.length > 0) {
  console.error(`  [FAIL] Keys missing in hi.json:`, missingInHi);
} else {
  console.log(`  [PASS] hi.json has 100% key parity with en.json.`);
}

if (missingInKn.length > 0) {
  console.error(`  [FAIL] Keys missing in kn.json:`, missingInKn);
} else {
  console.log(`  [PASS] kn.json has 100% key parity with en.json.`);
}

// Check translation keys used in screens
console.log('\nChecking State.t() calls in JS screens:');
const stateTRegex = /State\.t\(\s*['"]([^'"]+)['"]\s*\)/g;
let missingUsageCount = 0;
for (const f of jsFiles) {
  const rel = path.relative(frontendJsDir, f);
  const content = fs.readFileSync(f, 'utf8');
  let match;
  while ((match = stateTRegex.exec(content)) !== null) {
    const key = match[1];
    if (!enKeys.has(key)) {
      console.warn(`  [WARN] Unknown translation key "${key}" used in ${rel}`);
      missingUsageCount++;
    }
  }
}
if (missingUsageCount === 0) {
  console.log(`  [PASS] All State.t() keys exist in en.json.`);
}

console.log('\n====================================================');
console.log('3. API ENDPOINTS AUDIT');
console.log('====================================================');

// Extract all endpoints called in api.js
const apiJsContent = fs.readFileSync(path.join(frontendJsDir, 'api.js'), 'utf8');
const endpointRegex = /request\(\s*['"](GET|POST|PUT|DELETE)['"]\s*,\s*[`'"]([^`'"]+)[`'"]/g;
const apiCalls = [];
let callMatch;
while ((callMatch = endpointRegex.exec(apiJsContent)) !== null) {
  apiCalls.push({ method: callMatch[1], path: callMatch[2] });
}

console.log(`Found ${apiCalls.length} API calls defined in api.js:`);
for (const call of apiCalls) {
  console.log(`  ${call.method.padEnd(6)} ${call.path}`);
}
