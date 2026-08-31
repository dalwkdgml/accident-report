const puppeteer = require('puppeteer-core');

const shots = [
  { hash: '#/dashboard', file: 'home.png', wait: 2500 },
  { hash: '#/register', file: 'register.png', wait: 2000 },
  { hash: '#/actions', file: 'status.png', wait: 2500 },
  { hash: '#/actions/10', file: 'action_detail.png', wait: 2000 },
  { hash: '#/analytics', file: 'analytics.png', wait: 2500 },
];

const OUT_DIR = __dirname + '/assets';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });

  for (const s of shots) {
    await page.goto(`https://tkrhqhrh.onrender.com/${s.hash}`, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, s.wait));
    await page.screenshot({ path: `${OUT_DIR}/${s.file}` });
    console.log('captured', s.file);
  }

  await browser.close();
  console.log('all done');
})().catch(e => { console.error(e); process.exit(1); });
