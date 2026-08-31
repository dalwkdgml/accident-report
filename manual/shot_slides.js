const puppeteer = require('puppeteer-core');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1.2 });
  const filePath = 'file:///' + path.resolve(__dirname, 'manual/final_manual.html').replace(/\\/g, '/');
  await page.goto(filePath, { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 300));

  const slides = await page.$$('.slide');
  console.log('slide count', slides.length);
  for (let i = 0; i < slides.length; i++) {
    await slides[i].screenshot({ path: path.resolve(__dirname, `manual/slide_preview_${i}.png`) });
    console.log('captured slide', i);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
