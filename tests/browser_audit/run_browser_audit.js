/**
 * SUCCESSION Live Browser Integration & Verification Audit
 * Connects directly to headless Chrome via Chrome DevTools Protocol (CDP).
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
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const cb = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) cb.reject(msg.error);
          else cb.resolve(msg.result);
        } else if (msg.method) {
          const listeners = this.eventListeners.get(msg.method) || [];
          for (const l of listeners) l(msg.params);
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

  on(method, listener) {
    if (!this.eventListeners.has(method)) {
      this.eventListeners.set(method, []);
    }
    this.eventListeners.get(method).push(listener);
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
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
  console.log('Connecting to Chrome CDP...');
  const targets = await getJson('http://127.0.0.1:9222/json/list');
  const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
  if (!pageTarget) throw new Error('No page target found');

  const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await client.connect();
  console.log('Connected to CDP session.');

  const consoleLogs = [];
  const networkRequests = [];
  const networkErrors = [];

  client.on('Runtime.consoleAPICalled', (params) => {
    const text = params.args.map((a) => a.value || JSON.stringify(a)).join(' ');
    consoleLogs.push({ type: params.type, text });
  });

  client.on('Runtime.exceptionThrown', (params) => {
    consoleLogs.push({ type: 'error', text: params.exceptionDetails.text });
  });

  client.on('Network.responseReceived', (params) => {
    networkRequests.push({
      url: params.response.url,
      status: params.response.status,
      mimeType: params.response.mimeType,
    });
    if (params.response.status >= 400) {
      networkErrors.push({ url: params.response.url, status: params.response.status });
    }
  });

  client.on('Network.loadingFailed', (params) => {
    networkErrors.push({ url: params.requestId, errorText: params.errorText });
  });

  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Network.enable');

  const auditDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(auditDir)) fs.mkdirSync(auditDir, { recursive: true });

  console.log('\n--- 1. Navigating to http://127.0.0.1:3000 ---');
  await client.setViewport(1440, 900);
  await client.send('Page.navigate', { url: 'http://127.0.0.1:3000' });
  await sleep(1500);

  const initialTitle = await client.eval('document.title');
  const initialHtml = await client.eval('document.getElementById("app-root") ? document.getElementById("app-root").innerHTML.length : 0');
  console.log('Page Title:', initialTitle);
  console.log('App root rendered HTML length:', initialHtml);

  // Check login form or already logged in
  const isLoginForm = await client.eval('!!document.getElementById("login-form")');
  console.log('Is Login Form Present:', isLoginForm);

  if (isLoginForm) {
    console.log('\n--- 2. Performing Login as jeweller_demo ---');
    await client.eval(`
      document.getElementById('login-username').value = 'jeweller_demo';
      document.getElementById('login-password').value = 'JewellerPass123!';
      document.getElementById('login-form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    `);
    await sleep(2000);
  }

  const currentHash = await client.eval('window.location.hash');
  console.log('Current URL Hash after login:', currentHash);

  // Verify Dashboard Metrics
  console.log('\n--- 3. Verifying Dashboard Metrics & Components ---');
  const dashboardAudit = await client.eval(`(() => {
    const statCards = Array.from(document.querySelectorAll('.card-sm')).map(c => {
      const sub = c.querySelector('.metric-subheader')?.innerText || '';
      const num = c.querySelector('.metric-number')?.innerText || '';
      return { sub, num };
    });
    const headerTitle = document.querySelector('.page-title')?.innerText || '';
    const connectivity = document.getElementById('connectivity-status')?.innerText || '';
    const userRoleBadge = document.querySelector('.page-title .badge')?.innerText || '';
    const tableRows = document.querySelectorAll('table tbody tr').length;
    const orderItems = document.querySelectorAll('.list-group-item').length;
    return {
      headerTitle,
      userRoleBadge,
      connectivity,
      statCards,
      tableRows,
      orderItems
    };
  })()`);
  console.log('Dashboard Audit Data:', JSON.stringify(dashboardAudit, null, 2));

  // Responsive Screenshots
  console.log('\n--- 4. Capturing Responsive Viewport Screenshots ---');
  const viewports = [
    { name: 'desktop_1440x900', w: 1440, h: 900, mobile: false },
    { name: 'laptop_1366x768', w: 1366, h: 768, mobile: false },
    { name: 'tablet_768x1024', w: 768, h: 1024, mobile: false },
    { name: 'mobile_390x844', w: 390, h: 844, mobile: true },
    { name: 'small_mobile_360x800', w: 360, h: 800, mobile: true },
  ];

  for (const vp of viewports) {
    await client.setViewport(vp.w, vp.h, vp.mobile);
    await sleep(600);
    const ssPath = path.join(auditDir, `${vp.name}.png`);
    await client.screenshot(ssPath);
    console.log(`Saved screenshot: ${vp.name}.png (${fs.statSync(ssPath).size} bytes)`);
  }

  // Restore Desktop Viewport
  await client.setViewport(1440, 900);

  // Screen Navigation Audit
  console.log('\n--- 5. Testing Screen Navigation ---');
  const navScreens = [
    { hash: '#/orders', name: 'Orders' },
    { hash: '#/issue', name: 'Issue Gold' },
    { hash: '#/return', name: 'Return Gold' },
    { hash: '#/passbook', name: 'Passbook' },
    { hash: '#/disputes', name: 'Disputes' },
    { hash: '#/settlement', name: 'Settlement' },
    { hash: '#/notifications', name: 'Notifications' },
    { hash: '#/settings', name: 'Settings' },
    { hash: '#/dashboard', name: 'Dashboard' },
  ];

  const screenResults = [];
  for (const s of navScreens) {
    await client.eval(`window.location.hash = '${s.hash}';`);
    await sleep(800);
    const screenInfo = await client.eval(`(() => {
      const activeLink = document.querySelector('.navbar-vertical .nav-link.active')?.innerText?.trim() || '';
      const text = document.getElementById('app-root')?.innerText?.slice(0, 100) || '';
      return { activeLink, hasContent: text.length > 10, snippet: text.replace(/\\n/g, ' ') };
    })()`);
    screenResults.push({ screen: s.name, hash: s.hash, ...screenInfo });
    console.log(`Navigated to ${s.name} (${s.hash}): Content length > 10: ${screenInfo.hasContent}`);
  }

  // Language Switching Audit
  console.log('\n--- 6. Testing Language Switching ---');
  const langResults = [];
  for (const lang of ['hi', 'kn', 'en']) {
    await client.eval(`(() => {
      const sel = document.getElementById('lang-picker') || document.getElementById('lang-select');
      if (sel) {
        sel.value = '${lang}';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
    })()`);
    await sleep(1500);
    const langInfo = await client.eval(`(() => {
      const activeNav = document.querySelector('.navbar-vertical .nav-link.active')?.innerText?.trim() || '';
      const subheader = document.querySelector('.metric-subheader')?.innerText || '';
      const title = document.querySelector('.page-title')?.innerText || '';
      return { lang: '${lang}', activeNav, subheader, title };
    })()`);
    langResults.push(langInfo);
    console.log(`Language switched to '${lang}': activeNav='${langInfo.activeNav}', subheader='${langInfo.subheader}'`);
  }

  // Console and Network Audit Summary
  console.log('\n--- 7. Console & Network Summary ---');
  console.log(`Total Console Messages: ${consoleLogs.length}`);
  const errLogs = consoleLogs.filter((l) => l.type === 'error');
  console.log(`Console Errors (${errLogs.length}):`, errLogs);

  console.log(`Total Network Requests: ${networkRequests.length}`);
  console.log(`Network Errors (${networkErrors.length}):`, networkErrors);

  const manifestRequest = networkRequests.find((r) => r.url.includes('manifest.webmanifest'));
  const icon192Request = networkRequests.find((r) => r.url.includes('icon-192.png'));
  console.log('Manifest status in network:', manifestRequest ? manifestRequest.status : 'Not requested yet');
  console.log('Icon 192 status in network:', icon192Request ? icon192Request.status : 'Not requested yet');

  // Save report JSON
  const report = {
    initialTitle,
    dashboardAudit,
    screenResults,
    langResults,
    consoleErrors: errLogs,
    networkErrors,
    totalRequests: networkRequests.length,
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(path.join(__dirname, 'audit_result.json'), JSON.stringify(report, null, 2));
  console.log('\nAudit complete! Result written to audit_result.json');
}

main().catch((e) => {
  console.error('Audit failed with error:', e);
  process.exit(1);
});
