const { chromium } = require('playwright');
const fs = require('fs');
const { google } = require('googleapis');
const credentials = require('./credentials.json');

// ================= GOOGLE SHEET =================
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

// ================= CACHE GROWTH =================
const cacheFile = 'growth_cache.json';

let oldData = {};
if (fs.existsSync(cacheFile)) {
  oldData = JSON.parse(fs.readFileSync(cacheFile));
}

// ================= PROFILES =================
const chromeProfiles = [
  'C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 3',
  'C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 4',
  'C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 5',
  'C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 6',
  'C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 7',
  'C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 8'
];

// ================= PARSE NUMBER =================
function parseNumber(text) {
  if (!text) return 0;

  let num = text.toString().toUpperCase().replace(/,/g, '').trim();

  if (num.includes('K')) return parseFloat(num.replace('K', '')) * 1000;
  if (num.includes('M')) return parseFloat(num.replace('M', '')) * 1000000;
  if (num.includes('B')) return parseFloat(num.replace('B', '')) * 1000000000;

  return parseFloat(num) || 0;
}

// ================= GET USERNAMES =================
async function getUsernamesFromSheet() {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetName + '!A2:A'
  });

  return (response.data.values || [])
    .map(r => r[0])
    .filter(Boolean);
}

// ================= MAIN =================
(async () => {
  const usernames = await getUsernamesFromSheet();

  console.log('Usernames:', usernames);

  const results = [];

  let profileIndex = 0;
  let context, page;

  async function openProfile(profilePath) {
    if (context) await context.close().catch(() => {});

    console.log('👉 Open profile:', profilePath);

    context = await chromium.launchPersistentContext(profilePath, {
      channel: 'chrome',
      headless: false,
      viewport: null,
      args: ['--start-maximized']
    });

    page = context.pages()[0] || await context.newPage();
  }

  await openProfile(chromeProfiles[profileIndex]);

  // ================= SCRAPE =================
  for (const username of usernames) {
    try {
      console.log('\n====', username);

      await page.goto(`https://www.tiktok.com/@${username}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      await page.waitForTimeout(7000);

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

      const followersNumber = parseNumber(followers);
      const likesNumber = parseNumber(likes);

      const engagementRate = totalViews > 0
        ? ((likesNumber / totalViews) * 100).toFixed(2) + '%'
        : '0%';

      let shadowbanWarning = 'No';
      if (followersNumber > 0 && lastView < followersNumber * 0.01) {
        shadowbanWarning = 'Possible';
      }

      const updateTime = new Date().toLocaleString();

      // ================= GROWTH SYSTEM =================
      const prev = oldData[username] || {};

      const followGrowth = followersNumber - (prev.followers || 0);
      const likeGrowth = likesNumber - (prev.likes || 0);
      const viewGrowth = totalViews - (prev.views || 0);

      const row = [
        username,
        followers,
        following,
        likes,
        videoCount,
        totalViews,
        avgViews,
        lastView,
        engagementRate,
        shadowbanWarning,
        chromeProfiles[profileIndex],
        updateTime,
        followGrowth,
        likeGrowth,
        viewGrowth
      ];

      results.push(row);

      console.log(row);

      await page.waitForTimeout(3000);

    } catch (err) {
      console.log('Error:', username, err.message);

      results.push([
        username,'Error','','','','','','',
        '','Error',
        chromeProfiles[profileIndex],
        new Date().toLocaleString(),
        0,0,0
      ]);
    }

    // rotate profile
    profileIndex = (profileIndex + 1) % chromeProfiles.length;
    await openProfile(chromeProfiles[profileIndex]);
  }

  // ================= GOOGLE SHEET UPDATE =================
  try {
    console.log('\n🔄 Updating Google Sheet...');

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
        'Engagement Rate',
        'Shadowban Warning',
        'Chrome Profile',
        'Last Update',
        'Follow Growth',
        'Like Growth',
        'View Growth'
      ],
      ...results
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: sheetName + '!A1',
      valueInputOption: 'RAW',
      requestBody: { values }
    });

    console.log('✅ Google Sheet updated');

  } catch (err) {
    console.log('❌ Sheet error:', err.message);
  }

  // ================= SAVE CACHE =================
  const newCache = {};

  results.forEach(r => {
    if (r[0] && r[0] !== 'Error') {
      newCache[r[0]] = {
        followers: parseNumber(r[1]),
        likes: parseNumber(r[3]),
        views: r[5]
      };
    }
  });

  fs.writeFileSync(cacheFile, JSON.stringify(newCache, null, 2));

  console.log('💾 Cache updated');

  if (context) await context.close();
})();