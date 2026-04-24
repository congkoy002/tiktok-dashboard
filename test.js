const express = require("express");
const { chromium } = require("playwright");
const { google } = require("googleapis");
const credentials = require("./credentials.json");

const app = express();

// ===================== PORT (RENDER FIX) =====================
const PORT = process.env.PORT || 3000;

// ===================== SHEET CONFIG =====================
const spreadsheetId = "1Hdky0c7ojYPSE7eBc0b3PhvhIAMg0LBc9pWiakZ0gYc";
const sheetName = "Kenh";

// ===================== GOOGLE AUTH =====================
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});

const sheets = google.sheets({ version: "v4", auth });

// ===================== CHROME PROFILES =====================
const chromeProfiles = [
  "C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 3",
  "C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 4",
  "C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 5",
  "C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 6",
  "C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 7",
  "C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 8"
];

// ===================== PARSE NUMBER =====================
function parseNumber(t) {
  if (!t) return 0;
  t = t.toString().toUpperCase().replace(/,/g, "");
  if (t.includes("K")) return parseFloat(t) * 1000;
  if (t.includes("M")) return parseFloat(t) * 1000000;
  return parseFloat(t) || 0;
}

// ===================== HOME ROUTE (FIX NOT FOUND) =====================
app.get("/", (req, res) => {
  res.send("🚀 Bot Running OK on Render");
});

// ===================== HEALTH CHECK =====================
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// ===================== API DATA =====================
app.get("/api/data", async (req, res) => {
  try {
    const rows = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A2:Q`
    });

    const data = (rows.data.values || []).map(r => ({
      Username: r[0] || "",
      Followers: parseInt(r[1]) || 0,
      TotalViews: parseInt(r[5]) || 0,
      LastView: parseInt(r[7]) || 0,
      Score: parseInt(r[14]) || 0,
      Status: r[15] || ""
    }));

    res.json(data);

  } catch (err) {
    res.json({ error: err.message });
  }
});

// ===================== API HISTORY =====================
app.get("/api/history", async (req, res) => {
  try {
    const rows = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A2:Q`
    });

    res.json(rows.data.values || []);

  } catch (err) {
    res.json([]);
  }
});

// ===================== SCRAPER =====================
async function runScraper() {
  console.log("🚀 SCRAPER START");

  const usernames = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A2:A`
  });

  const users = (usernames.data.values || []).map(r => r[0]).filter(Boolean);

  let context, page;
  let profileIndex = 0;

  async function openProfile(p) {
    if (context) await context.close().catch(() => {});

    context = await chromium.launchPersistentContext(p, {
      channel: "chrome",
      headless: false
    });

    page = context.pages()[0] || await context.newPage();
  }

  await openProfile(chromeProfiles[profileIndex]);

  const results = [];

  for (const u of users) {
    try {
      await page.goto(`https://www.tiktok.com/@${u}`, {
        waitUntil: "domcontentloaded",
        timeout: 60000
      });

      await page.waitForTimeout(3000);

      const followers = await page.locator('[data-e2e="followers-count"]').innerText().catch(() => "0");
      const following = await page.locator('[data-e2e="following-count"]').innerText().catch(() => "0");
      const likes = await page.locator('[data-e2e="likes-count"]').innerText().catch(() => "0");

      const viewsRaw = await page.$$eval(
        '[data-e2e="user-post-item"] strong',
        els => els.map(e => e.innerText)
      ).catch(() => []);

      const views = viewsRaw.map(parseNumber);

      const total = views.reduce((a, b) => a + b, 0);
      const avg = views.length ? Math.round(total / views.length) : 0;
      const last = views[0] || 0;

      const last3 = views.slice(0, 3);

      const flop = (last3.length === 3 && last3.every(v => v < 50)) ? "YES" : "NO";
      const viral = (last3.length === 3 && last3.every(v => v > 2000)) ? "YES" : "NO";

      let score = 0;
      if (viral === "YES") score += 50;
      if (flop === "YES") score -= 30;
      score += Math.min(total / 1000, 30);
      score += Math.min(last / 100, 20);
      score = Math.max(0, Math.min(100, Math.round(score)));

      const status =
        viral === "YES" ? "🔥 VIRAL" :
        flop === "YES" ? "❌ FLOP" :
        score > 70 ? "📈 GROWING" : "⚖️ NORMAL";

      results.push([
        u,
        followers,
        following,
        likes,
        views.length,
        total,
        avg,
        last,
        JSON.stringify(last3),
        flop,
        viral,
        score,
        status,
        new Date().toLocaleString()
      ]);

      console.log("OK:", u);

    } catch (e) {
      console.log("ERR:", u);
    }
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A2`,
    valueInputOption: "RAW",
    requestBody: { values: results }
  });

  console.log("✅ SHEET UPDATED");
}

// ===================== START SERVER =====================
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});

// ===================== RUN SCRAPER =====================
runScraper();