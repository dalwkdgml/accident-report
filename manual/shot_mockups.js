const puppeteer = require('puppeteer-core');
const path = require('path');

const ids = ['a1','a2','a3','a4','i1','i2','i3','i4'];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1200, deviceScaleFactor: 2 });
  const filePath = 'file:///' + path.resolve(__dirname, 'manual/mockups.html').replace(/\\/g, '/');
  await page.goto(filePath, { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 300));

  for (const id of ids) {
    const el = await page.$('#' + id);
    await el.screenshot({ path: path.resolve(__dirname, `manual/assets/install/${id}.png`) });
    console.log('captured', id);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
