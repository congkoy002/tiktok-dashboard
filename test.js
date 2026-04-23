const { chromium } = require('playwright');
const fs = require('fs');
const { google } = require('googleapis');
const { execSync } = require('child_process');

const credentials = require('./credentials.json');

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheets = google.sheets({
  version: 'v4',
  auth
});

const spreadsheetId = '1Hdky0c7ojYPSE7eBc0b3PhvhIAMg0LBc9pWiakZ0gYc';
const sheetName = 'Kenh';

// ✅ THÊM PROFILE 6,7,8
const chromeProfiles = [
  'C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 3',
  'C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 4',
  'C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 5',
  'C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 6',
  'C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 7',
  'C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 8'
];

// parse số
function parseNumber(text) {
  if (!text) return 0;
  let num = text.toUpperCase().replace(/,/g, '').trim();
  if (num.includes('K')) return parseFloat(num) * 1000;
  if (num.includes('M')) return parseFloat(num) * 1000000;
  if (num.includes('B')) return parseFloat(num) * 1000000000;
  return parseFloat(num) || 0;
}

// lấy username từ sheet
async function getUsernames() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetName + '!A2:A'
  });

  return (res.data.values || [])
    .map(r => r[0])
    .filter(x => x);
}

(async () => {
  const usernames = await getUsernames();
  console.log('Usernames:', usernames);

  let context, page;

  // mở profile
  async function openProfile(profilePath) {
    if (context) await context.close().catch(() => {});

    console.log('👉 Open profile:', profilePath);

    context = await chromium.launchPersistentContext(profilePath, {
      channel: 'chrome',
      headless: false,
      viewport: null,
      args: [
        '--start-maximized',
        '--disable-blink-features=AutomationControlled'
      ]
    });

    page = context.pages()[0] || await context.newPage();
  }

  let profileIndex = Math.floor(Math.random() * chromeProfiles.length);
  await openProfile(chromeProfiles[profileIndex]);

  const results = [];

  for (const username of usernames) {
    try {
      console.log('\n====', username);

      // delay random chống captcha
      await page.waitForTimeout(5000 + Math.random() * 5000);

      await page.goto(`https://www.tiktok.com/@${username}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      // giả lập người dùng
      await page.waitForTimeout(8000);
      await page.mouse.move(100, 200);
      await page.mouse.wheel(0, 500);

      // check captcha
      const content = await page.content();
      const url = page.url();

      if (
        url.includes('captcha') ||
        url.includes('verify') ||
        content.toLowerCase().includes('captcha')
      ) {
        console.log('⚠️ CAPTCHA → đổi profile');

        profileIndex = (profileIndex + 1) % chromeProfiles.length;
        await openProfile(chromeProfiles[profileIndex]);
        continue;
      }

      // lấy data
      const followers = await page.locator('[data-e2e="followers-count"]').innerText().catch(()=>'0');
      const following = await page.locator('[data-e2e="following-count"]').innerText().catch(()=>'0');
      const likes = await page.locator('[data-e2e="likes-count"]').innerText().catch(()=>'0');

      const videos = await page.locator('[data-e2e="user-post-item"]').count();

      const views = await page.$$eval(
        '[data-e2e="user-post-item"] strong',
        els => els.map(e => e.innerText)
      );

      const totalViews = views.reduce((s,v)=>s+parseNumber(v),0);
      const avgViews = videos ? Math.round(totalViews / videos) : 0;
      const lastView = views[0] ? parseNumber(views[0]) : 0;

      // flop check
      let flop = 'No';
      const last3 = views.slice(0,3).map(v=>parseNumber(v));
      if (last3.length === 3 && last3.every(v => v < 100)) flop = 'YES';

      // viral check
      let viral = 'No';
      if (lastView > parseNumber(followers) * 0.2) viral = 'YES';

      const updateTime = new Date().toLocaleString();

      const row = [
        username,
        followers,
        following,
        likes,
        videos,
        totalViews,
        avgViews,
        lastView,
        flop,
        viral,
        chromeProfiles[profileIndex],
        updateTime
      ];

      results.push(row);

      console.log(row);

      await page.waitForTimeout(5000);

    } catch (err) {
      console.log('❌ Error:', err.message);
    }
  }

  // update Google Sheet
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: sheetName + '!A2',
    valueInputOption: 'RAW',
    requestBody: {
      values: results
    }
  });

  console.log('\n✅ Updated Google Sheet');

  // auto push nếu bạn muốn
  try {
    execSync('git add .');
    execSync('git commit -m "auto update"');
    execSync('git push');
  } catch {}

  if (context) await context.close();
})();