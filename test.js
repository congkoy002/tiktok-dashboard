const { chromium } = require('playwright');
const fs = require('fs');
const { google } = require('googleapis');
const credentials = require('./credentials.json');

const spreadsheetId = '1Hdky0c7ojYPSE7eBc0b3PhvhIAMg0LBc9pWiakZ0gYc';
const sheetName = 'Kenh';
const previousFile = 'previous_data.json';

const chromeProfiles = [
  'C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 8',
  'C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 7',
  'C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 6',
  'C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 5',
  'C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 4',
  'C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 3'
];

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheets = google.sheets({ version: 'v4', auth });

let previousData = {};
if (fs.existsSync(previousFile)) {
  previousData = JSON.parse(fs.readFileSync(previousFile));
}

function parseNumber(text) {
  if (!text) return 0;
  let num = text.toString().toUpperCase().replace(/,/g, '').trim();
  if (num.includes('K')) return parseFloat(num) * 1000;
  if (num.includes('M')) return parseFloat(num) * 1000000;
  return parseFloat(num) || 0;
}

async function getUsernames() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetName + '!A2:A'
  });
  return (res.data.values || []).map(r => r[0]).filter(x => x);
}

(async () => {

  console.log('START: ' + new Date().toLocaleString());

  const usernames = await getUsernames();
  const results = [];

  let profileIndex = 0;
  let context, page;

  async function openProfile(path) {
    if (context) await context.close().catch(()=>{});
    context = await chromium.launchPersistentContext(path, {
      channel: 'chrome',
      headless: false
    });
    page = context.pages()[0] || await context.newPage();
  }

  await openProfile(chromeProfiles[0]);

  for (const username of usernames) {
    try {

      await page.goto('https://www.tiktok.com/@' + username);
      await page.waitForTimeout(8000);

      const followers = await page.locator('[data-e2e="followers-count"]').innerText().catch(()=>0);
      const following = await page.locator('[data-e2e="following-count"]').innerText().catch(()=>0);
      const likes = await page.locator('[data-e2e="likes-count"]').innerText().catch(()=>0);

      const videoCount = await page.locator('[data-e2e="user-post-item"]').count().catch(()=>0);

      const views = await page.$$eval('[data-e2e="user-post-item"] strong', els =>
        els.map(e => e.innerText)
      ).catch(()=>[]);

      const totalViews = views.reduce((s,v)=>s+parseNumber(v),0);
      const avgViews = videoCount ? Math.round(totalViews/videoCount) : 0;
      const lastView = views[0] ? parseNumber(views[0]) : 0;

      // FLOP
      const last3 = views.slice(0,3).map(v=>parseNumber(v));
      const flopStatus = (last3.length>=3 && last3.every(v=>v<100)) ? 'YES' : 'NO';

      // VIRAL
      const viewGrowth = totalViews - ((previousData[username]||{}).views || 0);
      const isViral = lastView >= 1000 && viewGrowth > 500 && flopStatus === 'NO';

      const followersNum = parseNumber(followers);
      const likesNum = parseNumber(likes);

      const old = previousData[username] || {};

      const followerGrowth = followersNum - (old.followers || 0);
      const likeGrowth = likesNum - (old.likes || 0);

      // SCORE
      let score = 0;
      if (avgViews >= 1000) score += 2;
      else if (avgViews >= 300) score += 1;
      else score -= 1;

      if (lastView >= 300) score += 2;
      else if (lastView >= 100) score += 1;
      else score -= 2;

      if (followerGrowth > 0) score += 1;
      else score -= 1;

      if (flopStatus === 'YES') score -= 3;

      let channelStatus = 'NUOI';
      if (score <= -2) channelStatus = 'BO';
      else if (score <= 1) channelStatus = 'CANH BAO';

      const row = {
        Username: username,
        Followers: followers,
        Following: following,
        Likes: likes,
        Videos: videoCount,
        TotalViews: totalViews,
        AvgViews: avgViews,
        LastView: lastView,
        FollowerGrowth: followerGrowth,
        LikeGrowth: likeGrowth,
        ViewGrowth: viewGrowth,
        Last3Views: last3.join(','),
        FlopStatus: flopStatus,
        IsViral: isViral ? 'YES' : 'NO',
        Score: score,
        ChannelStatus: channelStatus,
        Time: new Date().toLocaleString()
      };

      results.push(row);
      console.log(row);

      await page.waitForTimeout(5000);

    } catch (e) {
      console.log('ERROR: ' + username);
    }
  }

  // UPDATE SHEET
  const values = [[
'Username','Followers','Following','Likes','Videos',
'Total Views','Avg Views','Last Video View',
'Follower Growth','Like Growth','View Growth',
'Last 3 Views','Flop Status','Is Viral','Score','Channel Status','Last Update'
]];

  results.forEach(r=>{
    values.push([
      r.Username,r.Followers,r.Following,r.Likes,r.Videos,
      r.TotalViews,r.AvgViews,r.LastView,
      r.FollowerGrowth,r.LikeGrowth,r.ViewGrowth,
      r.Last3Views,r.FlopStatus,r.IsViral,r.Score,r.ChannelStatus,r.Time
    ]);
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: sheetName + '!A1',
    valueInputOption: 'RAW',
    requestBody: { values }
  });

  // SAVE JSON
  fs.writeFileSync('tiktok_results.json', JSON.stringify(results, null, 2));

  const save = {};
  results.forEach(r=>{
    save[r.Username] = {
      followers: parseNumber(r.Followers),
      likes: parseNumber(r.Likes),
      views: r.TotalViews
    };
  });

  fs.writeFileSync(previousFile, JSON.stringify(save, null, 2));

  if (context) await context.close();

})();