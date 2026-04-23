const { chromium } = require('playwright');
const { google } = require('googleapis');
const fs = require('fs');

// ================= GOOGLE SHEETS =================
const credentials = require('./credentials.json');

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheets = google.sheets({ version: 'v4', auth });

const spreadsheetId = '1Hdky0c7ojYPSE7eBc0b3PhvhIAMg0LBc9pWiakZ0gYc';
const sheetName = 'Kenh';

// ================= CHROME PROFILES =================
const chromeProfiles = [
  'C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 3',
  'C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 4',
  'C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 5',
  'C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 6',
  'C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 7',
  'C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 8'
];

let profileIndex = 0;
let context = null;
let page = null;

// ================= SAFE PARSE =================
function parseNumber(text) {
  if (!text) return 0;

  let num = text.toString().toUpperCase().replace(/,/g, '').trim();

  if (num.includes('K')) return parseFloat(num) * 1000;
  if (num.includes('M')) return parseFloat(num) * 1000000;
  if (num.includes('B')) return parseFloat(num) * 1000000000;

  return parseFloat(num) || 0;
}

// ================= SHEET DATA =================
async function getUsernames() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetName + '!A2:A'
  });

  return (res.data.values || []).map(r => r[0]).filter(Boolean);
}

// ================= OPEN PROFILE =================
async function openProfile(index) {

  try {
    if (context) await context.close();
  } catch (e) {}

  console.log("👉 Open profile:", chromeProfiles[index]);

  context = await chromium.launchPersistentContext(chromeProfiles[index], {
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

// ================= CAPTCHA DETECT =================
function isCaptcha(content, url) {
  return (
    url.includes('captcha') ||
    url.includes('verify') ||
    content.toLowerCase().includes('captcha') ||
    content.toLowerCase().includes('verify')
  );
}

// ================= ROTATE PROFILE =================
async function rotateProfile() {
  profileIndex++;

  if (profileIndex >= chromeProfiles.length) {
    profileIndex = 0;
  }

  console.log("🔁 Rotate profile ->", profileIndex);

  await openProfile(profileIndex);
}

// ================= SCRAPE USER =================
async function scrapeUser(username) {

  for (let attempt = 0; attempt < 3; attempt++) {

    try {

      console.log(`\n===== ${username} TRY ${attempt} =====`);

      await page.goto(`https://www.tiktok.com/@${username}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      await page.waitForTimeout(5000);

      let url = page.url();
      let content = await page.content();

      if (isCaptcha(content, url)) {
        console.log("⚠️ CAPTCHA DETECTED");
        await rotateProfile();
        continue;
      }

      const followers = await page.locator('[data-e2e="followers-count"]').innerText().catch(()=>'0');
      const following = await page.locator('[data-e2e="following-count"]').innerText().catch(()=>'0');
      const likes = await page.locator('[data-e2e="likes-count"]').innerText().catch(()=>'0');

      const videos = await page.locator('[data-e2e="user-post-item"]').count().catch(()=>0);

      const views = await page.$$eval('[data-e2e="user-post-item"] strong',
        els => els.map(e => e.innerText)
      ).catch(()=>[]);

      const totalViews = views.reduce((a,b)=>a+parseNumber(b),0);
      const lastView = parseNumber(views[0]);

      return {
        username,
        followers,
        following,
        likes,
        videos,
        totalViews,
        lastView,
        profile: chromeProfiles[profileIndex],
        updateTime: new Date().toISOString()
      };

    } catch (err) {
      console.log("❌ ERROR:", err.message);
      await rotateProfile();
    }
  }

  return null;
}

// ================= UPDATE GOOGLE SHEET =================
async function updateSheet(results) {

  try {

    const values = results.map(r => [
      r.username,
      r.followers,
      r.following,
      r.likes,
      r.videos,
      r.totalViews,
      r.lastView,
      r.profile,
      r.updateTime
    ]);

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: sheetName + "!A2",
      valueInputOption: "RAW",
      requestBody: {
        values
      }
    });

    console.log("✅ GOOGLE SHEET UPDATED SUCCESS");

  } catch (err) {
    console.log("❌ SHEET ERROR:", err.message);

    // retry
    await new Promise(r => setTimeout(r, 3000));

    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: sheetName + "!A2",
        valueInputOption: "RAW",
        requestBody: { values }
      });

      console.log("🔁 RETRY SUCCESS");
    } catch (e) {
      console.log("❌ FINAL FAIL:", e.message);
    }
  }
}

// ================= MAIN QUEUE =================
async function run() {

  const usernames = await getUsernames();

  console.log("TOTAL:", usernames.length);

  await openProfile(profileIndex);

  let results = [];

  for (let i = 0; i < usernames.length; i++) {

    const data = await scrapeUser(usernames[i]);

    if (data) results.push(data);

    await page.waitForTimeout(3000 + Math.random() * 2000);
  }

  await updateSheet(results);

  if (context) await context.close();
}

// ================= CRASH SAFE =================
process.on("uncaughtException", err => {
  console.log("CRASH SAFE:", err.message);
});

// ================= START =================
run();