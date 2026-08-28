const {chromium} = require('./node_modules/playwright/index.js');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage();
  await p.setViewportSize({ width: 1440, height: 900 });
  await p.goto('http://localhost:3000');
  await p.waitForTimeout(1500);
  await p.screenshot({ path: 'C:/Users/Administrator/accident-report/ui-sidebar-new.png' });
  await b.close();
  console.log('done');
})();
