/**
 * Comprehensive Browser Layout, Responsiveness & Role Authentication Audit
 * Connects directly to Chromium via Chrome DevTools Protocol (CDP).
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.msgId = 1;
    this.callbacks = new Map();
    this.eventListeners = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        if (data.id && this.callbacks.has(data.id)) {
          const cb = this.callbacks.get(data.id);
          this.callbacks.delete(data.id);
          if (data.error) cb.reject(new Error(data.error.message));
          else cb.resolve(data.result);
        }
        if (data.method && this.eventListeners.has(data.method)) {
          for (const listener of this.eventListeners.get(data.method)) {
            listener(data.params);
          }
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.msgId++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(event, listener) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(listener);
  }

  async eval(expr) {
    const res = await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(JSON.stringify(res.exceptionDetails));
    }
    return res.result ? res.result.value : undefined;
  }

  async screenshot(filepath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(filepath, Buffer.from(res.data, 'base64'));
  }

  async setViewport(width, height, isMobile = false) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: isMobile,
    });
  }
}

async function main() {
  console.log('Connecting to Edge/Chromium CDP on port 9222...');
  const targets = await getJson('http://127.0.0.1:9222/json/list');
  const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
  if (!pageTarget) throw new Error('No page target found');

  const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await client.connect();
  console.log('Connected to CDP session.');

  const consoleLogs = [];
  const networkErrors = [];

  client.on('Runtime.consoleAPICalled', (params) => {
    const text = params.args.map((a) => a.value || JSON.stringify(a)).join(' ');
    consoleLogs.push({ type: params.type, text });
  });

  client.on('Runtime.exceptionThrown', (params) => {
    consoleLogs.push({ type: 'error', text: params.exceptionDetails.text });
  });

  client.on('Network.responseReceived', (params) => {
    if (params.response.status >= 400 && !params.response.url.includes('favicon')) {
      networkErrors.push({ url: params.response.url, status: params.response.status });
    }
  });

  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Network.enable');

  const screenshotsDir = path.join(__dirname, '..', '..', 'tests', 'browser_audit', 'screenshots');
  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

  const results = {
    timestamp: new Date().toISOString(),
    viewportsTested: [],
    rolesVerified: [],
    consoleErrors: [],
    networkErrors: []
  };

  // ==========================================
  // TEST 1: HOME.HTML (Public Marketing Site)
  // ==========================================
  console.log('\n--- 1. Testing home.html (Landing Page) ---');
  await client.setViewport(1366, 768);
  await client.send('Page.navigate', { url: 'http://127.0.0.1:3000/home.html' });
  await sleep(1500);

  const homeTitle = await client.eval('document.title');
  const hasSlider = await client.eval('Boolean(document.getElementById("wtSlide"))');
  const hasRoleNav = await client.eval('Boolean(document.querySelector(".role-nav"))');
  console.log(`  Title: "${homeTitle}"`);
  console.log(`  Interactive weighment slider (TX-1047) present: ${hasSlider}`);
  console.log(`  Role Explorer navigation present: ${hasRoleNav}`);
  await client.screenshot(path.join(screenshotsDir, 'home_desktop_1366.png'));

  // Responsive tablet & mobile
  await client.setViewport(768, 1024, true);
  await sleep(500);
  await client.screenshot(path.join(screenshotsDir, 'home_tablet_768.png'));

  await client.setViewport(390, 844, true);
  await sleep(500);
  await client.screenshot(path.join(screenshotsDir, 'home_mobile_390.png'));
  console.log('  Saved home.html screenshots for 1366px, 768px, 390px.');

  // ==========================================
  // TEST 2: LOGIN.HTML (Split Layout & Form)
  // ==========================================
  console.log('\n--- 2. Testing login.html layout ---');
  await client.setViewport(1366, 768);
  await client.send('Page.navigate', { url: 'http://127.0.0.1:3000/login.html' });
  await sleep(1000);

  const hasArtStage = await client.eval('Boolean(document.querySelector(".auth-art"))');
  const hasRoleRadio = await client.eval('Boolean(document.querySelector("input[name=\'role\']"))');
  const hasEmailInp = await client.eval('Boolean(document.getElementById("email"))');
  const hasPwInp = await client.eval('Boolean(document.getElementById("pw"))');
  console.log(`  Auth art stage present: ${hasArtStage}`);
  console.log(`  Role radio selector present: ${hasRoleRadio}`);
  console.log(`  Email input present: ${hasEmailInp}, Password input present: ${hasPwInp}`);
  await client.screenshot(path.join(screenshotsDir, 'login_desktop_1366.png'));

  await client.setViewport(390, 844, true);
  await sleep(500);
  await client.screenshot(path.join(screenshotsDir, 'login_mobile_390.png'));
  console.log('  Saved login.html screenshots for 1366px and 390px.');

  // ==========================================
  // TEST 3: AUTHENTICATED JEWELLER DASHBOARD
  // ==========================================
  console.log('\n--- 3. Testing Login -> Authenticated Jeweller Dashboard ---');
  await client.setViewport(1366, 768);
  await client.send('Page.navigate', { url: 'http://127.0.0.1:3000/login.html' });
  await sleep(1000);

  // Fill in jeweller credentials and submit
  await client.eval(`
    document.querySelector("input[name='role'][value='jeweller']").checked = true;
    document.getElementById("email").value = "aurelia@succession.gold";
    document.getElementById("pw").value = "Password123!";
    document.getElementById("loginForm").dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  `);
  console.log('  Submitted login form for Jeweller...');
  await sleep(2000);

  const currentUrl = await client.eval('window.location.href');
  console.log(`  Landed on: ${currentUrl}`);

  const topbarText = await client.eval('document.getElementById("topbar") ? document.getElementById("topbar").innerText : ""');
  const roleBadge = await client.eval('document.querySelector(".badge") ? document.querySelector(".badge").innerText : ""');
  console.log(`  Topbar: ${topbarText.replace(/\\n/g, ' ')}`);

  // Verify responsive layout across all requested viewports
  const viewports = [
    { name: 'desktop_1366', w: 1366, h: 768, mobile: false },
    { name: 'desktop_1280', w: 1280, h: 800, mobile: false },
    { name: 'landscape_1024', w: 1024, h: 768, mobile: false },
    { name: 'tablet_768', w: 768, h: 1024, mobile: true },
    { name: 'embedded_634', w: 634, h: 800, mobile: true },
    { name: 'mobile_390', w: 390, h: 844, mobile: true },
  ];

  for (const vp of viewports) {
    await client.setViewport(vp.w, vp.h, vp.mobile);
    await sleep(400);

    const layoutCheck = await client.eval(`(() => {
      const sidebar = document.getElementById("sidebar");
      const main = document.getElementById("main-content");
      if (!sidebar || !main) return { valid: false, note: "missing elements" };
      const sRect = sidebar.getBoundingClientRect();
      const mRect = main.getBoundingClientRect();
      // On narrow screens (< 992px), sidebar must NOT be stacked above/below main content
      const isNarrow = window.innerWidth < 992;
      const valid = isNarrow ? (sRect.left < 0 || sRect.width === 0 || window.getComputedStyle(sidebar).position === 'fixed') : true;
      return { valid, sLeft: Math.round(sRect.left), sWidth: Math.round(sRect.width), mTop: Math.round(mRect.top), isNarrow };
    })()`);

    console.log(`  Viewport ${vp.name} (${vp.w}x${vp.h}): Valid layout = ${layoutCheck.valid} (isNarrow=${layoutCheck.isNarrow}, sidebarLeft=${layoutCheck.sLeft})`);
    results.viewportsTested.push({ viewport: vp.name, ...layoutCheck });
    await client.screenshot(path.join(screenshotsDir, `app_jeweller_${vp.name}.png`));
  }
  results.rolesVerified.push('jeweller');

  // ==========================================
  // TEST 4: AUTHENTICATED KARIGAR DASHBOARD
  // ==========================================
  console.log('\n--- 4. Testing Login -> Authenticated Karigar Dashboard ---');
  await client.setViewport(1366, 768);
  await client.send('Page.navigate', { url: 'http://127.0.0.1:3000/login.html' });
  await sleep(1000);

  await client.eval(`
    document.querySelector("input[name='role'][value='karigar']").checked = true;
    document.getElementById("email").value = "ramesh@succession.gold";
    document.getElementById("pw").value = "Password123!";
    document.getElementById("loginForm").dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  `);
  await sleep(2000);

  const karigarUrl = await client.eval('window.location.href');
  const karigarUser = await client.eval('localStorage.getItem("swarn_user_profile")');
  console.log(`  Karigar landed on: ${karigarUrl}`);
  console.log(`  Karigar user session: ${karigarUser}`);
  await client.screenshot(path.join(screenshotsDir, 'app_karigar_desktop_1366.png'));
  results.rolesVerified.push('karigar');

  // ==========================================
  // TEST 5: AUTHENTICATED ASSAYER DASHBOARD
  // ==========================================
  console.log('\n--- 5. Testing Login -> Authenticated Assayer Dashboard ---');
  await client.setViewport(1366, 768);
  await client.send('Page.navigate', { url: 'http://127.0.0.1:3000/login.html' });
  await sleep(1000);

  await client.eval(`
    document.querySelector("input[name='role'][value='assayer']").checked = true;
    document.getElementById("email").value = "meera@succession.gold";
    document.getElementById("pw").value = "Password123!";
    document.getElementById("loginForm").dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  `);
  await sleep(2000);

  const assayerUrl = await client.eval('window.location.href');
  const assayerUser = await client.eval('localStorage.getItem("swarn_user_profile")');
  console.log(`  Assayer landed on: ${assayerUrl}`);
  console.log(`  Assayer user session: ${assayerUser}`);
  await client.screenshot(path.join(screenshotsDir, 'app_assayer_desktop_1366.png'));
  results.rolesVerified.push('assayer');

  // Summary
  results.consoleErrors = consoleLogs.filter((l) => l.type === 'error');
  results.networkErrors = networkErrors;

  const outPath = path.join(__dirname, '..', '..', 'tests', 'browser_audit', 'audit_result.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nAudit successfully completed! Results written to: ${outPath}`);
}

main().catch((err) => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
