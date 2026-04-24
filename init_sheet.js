const { google } = require('googleapis');
const credentials = require('./credentials.json');

const spreadsheetId = '1Hdky0c7ojYPSE7eBc0b3PhvhIAMg0LBc9pWiakZ0gYc';

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheets = google.sheets({ version: 'v4', auth });

// ================= HEADER =================
const header = [[
  "Username",
  "Followers",
  "Following",
  "Likes",
  "Videos",
  "Total Views",
  "Avg Views",
  "Last Video View",
  "Follower Growth",
  "Like Growth",
  "View Growth",
  "Last 3 Views",
  "Flop Status",
  "Is Viral",
  "Score",
  "Channel Status",
  "Last Update"
]];

// ================= CREATE OR INIT =================
async function initSheet() {

  try {

    console.log("🚀 Checking sheet...");

    // check existing data
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Kenh!A1:Q1"
    }).catch(() => null);

    if (res && res.data && res.data.values) {
      console.log("✅ Sheet already initialized");
      return;
    }

    console.log("⚡ Creating header...");

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Kenh!A1",
      valueInputOption: "RAW",
      requestBody: {
        values: header
      }
    });

    console.log("🎉 Sheet initialized successfully");

  } catch (err) {
    console.log("❌ INIT ERROR:", err.message);
  }
}

initSheet();