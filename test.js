const { chromium } = require('playwright');
const fs = require('fs');
const { google } = require('googleapis');
const credentials = require('./credentials.json');

const auth = new google.auth.GoogleAuth({
  credentials: credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheets = google.sheets({
  version: 'v4',
  auth
});

const spreadsheetId = '1Hdky0c7ojYPSE7eBc0b3PhvhIAMg0LBc9pWiakZ0gYc';
const sheetName = 'Kenh';

// ===== FULL PROFILE (3 → 8) =====
const chromeProfiles = [
  'C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 3',
  'C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 4',
  'C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 5',
  'C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 6',
  'C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 7',
  'C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 8'
];

// ===== PARSE NUMBER =====
function parseNumber(text) {
  if (!text) return 0;

  let num = text.toString().toUpperCase().replace(/,/g, '').trim();

  if (num.includes('K')) return parseFloat(num.replace('K', '')) * 1000;
  if (num.includes('M')) return parseFloat(num.replace('M', '')) * 1000000;
  if (num.includes('B')) return parseFloat(num.replace('B', '')) * 1000000000;

  return parseFloat(num) || 0;
}

// ===== GET USERNAMES =====
async function getUsernamesFromSheet() {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetName + '!A2:A'
  });

  const rows = response.data.values || [];

  return rows
    .map(row => row[0])
    .filter(username => username && username.trim() !== '');
}

(async () => {
  const usernames = await getUsernamesFromSheet();

  console.log('Usernames:', usernames);

  const results = [];

  let profileIndex = 0;
  let context = null;
  let page = null;

  async function openProfile(profilePath) {
    try {
      if (context) await context.close();
    } catch (e) {}

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

  await openProfile(chromeProfiles[profileIndex]);

  for (const username of usernames) {
    try {
      console.log('\n====', username);

      await page.goto(`https://www.tiktok.com/@${username}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      await page.waitForTimeout(8000);

      const followers = await page.locator('[data-e2e="followers-count"]').innerText().catch(()=>'0');
      const following = await page.locator('[data-e2e="following-count"]').innerText().catch(()=>'0');
      const likes = await page.locator('[data-e2e="likes-count"]').innerText().catch(()=>'0');

      const videoCount = await page.locator('[data-e2e="user-post-item"]').count().catch(()=>0);

      const views = await page.$$eval(
        '[data-e2e="user-post-item"] strong',
        els => els.map(e => e.innerText)
      ).catch(() => []);

      const totalViews = views.reduce((s,v)=>s+parseNumber(v),0);
      const avgViews = videoCount ? Math.round(totalViews / videoCount) : 0;
      const lastView = views[0] ? parseNumber(views[0]) : 0;

      const updateTime = new Date().toLocaleString();

      const row = [
        username,
        followers,
        following,
        likes,
        videoCount,
        totalViews,
        avgViews,
        lastView,
        chromeProfiles[profileIndex],
        updateTime
      ];

      results.push(row);

      await page.waitForTimeout(3000);

    } catch (err) {
      console.log('Error:', username, err.message);

      results.push([
        username, 'Error', '', '', '', '', '', '',
        chromeProfiles[profileIndex],
        new Date().toLocaleString()
      ]);
    }

    // rotate profile (GIỮ LOGIC CỦA BẠN)
    profileIndex++;
    if (profileIndex >= chromeProfiles.length) {
      profileIndex = 0;
    }

    await openProfile(chromeProfiles[profileIndex]);
  }

  // ===== FIX GOOGLE SHEET (CHUẨN 100%) =====
  try {
    console.log('\nUpdating Google Sheet...');

    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: sheetName + '!A1:Z'
    });

    const values = [
      [
        'Username',
        'Followers',
        'Following',
        'Likes',
        'Videos',
        'Total Views',
        'Avg Views',
        'Last Video View',
        'Chrome Profile',
        'Last Update'
      ],
      ...results
    ];

    const res = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: sheetName + '!A1',
      valueInputOption: 'RAW',
      requestBody: { values }
    });

    console.log('Google Sheet updated:', res.status);

  } catch (err) {
    console.log('Sheet error:', err.message);
  }

  fs.writeFileSync('tiktok_results.json', JSON.stringify(results, null, 2));

  console.log('DONE');

  if (context) await context.close();
})();