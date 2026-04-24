const { chromium } = require("playwright");
const { google } = require("googleapis");
const credentials = require("./credentials.json");

const spreadsheetId = "1Hdky0c7ojYPSE7eBc0b3PhvhIAMg0LBc9pWiakZ0gYc";
const sheetName = "Kenh";

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});

const sheets = google.sheets({ version: "v4", auth });

// ================= PROFILE ROTATION =================
const chromeProfiles = [
  "C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 3",
  "C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 4",
  "C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 5",
  "C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 6",
  "C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 7",
  "C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 8"
];

function parseNumber(t){
  if(!t) return 0;
  t = t.toString().toUpperCase().replace(/,/g,"");
  if(t.includes("K")) return parseFloat(t)*1000;
  if(t.includes("M")) return parseFloat(t)*1000000;
  return parseFloat(t)||0;
}

// ================= GET DATA =================
async function getOldData(){
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range:`${sheetName}!A2:Q`
  });

  const rows = res.data.values || [];
  const map = {};

  rows.forEach(r=>{
    map[r[0]] = {
      followers: parseInt(r[1])||0,
      likes: parseInt(r[3])||0,
      views: parseInt(r[5])||0
    };
  });

  return map;
}

// ================= USERS =================
async function getUsers(){
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range:`${sheetName}!A2:A`
  });

  return (res.data.values||[]).map(r=>r[0]).filter(Boolean);
}

// ================= SCRAPER =================
(async()=>{

  const users = await getUsers();
  const oldData = await getOldData();

  let context, page;
  let profileIndex = 0;

  async function openProfile(p){
    if(context) await context.close().catch(()=>{});

    context = await chromium.launchPersistentContext(p,{
      channel:"chrome",
      headless:false
    });

    page = context.pages()[0] || await context.newPage();
  }

  await openProfile(chromeProfiles[profileIndex]);

  const results = [];

  for(const u of users){

    try{

      await page.goto(`https://www.tiktok.com/@${u}`,{
        waitUntil:"domcontentloaded"
      });

      await page.waitForTimeout(3000);

      const followers = await page.locator('[data-e2e="followers-count"]').innerText().catch(()=>0);
      const following = await page.locator('[data-e2e="following-count"]').innerText().catch(()=>0);
      const likes = await page.locator('[data-e2e="likes-count"]').innerText().catch(()=>0);

      const viewsRaw = await page.$$eval(
        '[data-e2e="user-post-item"] strong',
        els=>els.map(e=>e.innerText)
      ).catch(()=>[]);

      const views = viewsRaw.map(parseNumber);

      const totalViews = views.reduce((a,b)=>a+b,0);
      const avgViews = views.length?Math.round(totalViews/views.length):0;
      const lastView = views[0]||0;

      const last3 = views.slice(0,3);

      // ================= FLOP / VIRAL =================
      const flop = (last3.length===3 && last3.every(v=>v<50)) ? "YES":"NO";
      const viral = (last3.length===3 && last3.every(v=>v>2000)) ? "YES":"NO";

      // ================= GROWTH =================
      const old = oldData[u] || {followers:0,likes:0,views:0};

      const followerGrowth = parseNumber(followers) - old.followers;
      const likeGrowth = parseNumber(likes) - old.likes;
      const viewGrowth = totalViews - old.views;

      // ================= SCORE =================
      let score = 0;
      if(viral==="YES") score += 50;
      if(flop==="YES") score -= 30;
      score += Math.min(totalViews/1000,30);
      score += Math.min(lastView/100,20);
      score = Math.max(0,Math.min(100,Math.round(score)));

      const status =
        viral==="YES" ? "🔥 VIRAL" :
        flop==="YES" ? "❌ FLOP" :
        score>70 ? "📈 GROWING" : "⚖️ NORMAL";

      results.push([
        u,
        followers,
        following,
        likes,
        views.length,
        totalViews,
        avgViews,
        lastView,
        followerGrowth,
        likeGrowth,
        viewGrowth,
        JSON.stringify(last3),
        flop,
        viral,
        score,
        status,
        new Date().toLocaleString()
      ]);

      console.log("OK:",u);

    }catch(e){
      console.log("ERR:",u);
    }
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range:`${sheetName}!A2`,
    valueInputOption:"RAW",
    requestBody:{values:results}
  });

  console.log("✅ UPDATED WITH GROWTH");

  await context.close();

})();