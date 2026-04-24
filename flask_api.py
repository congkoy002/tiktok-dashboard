from flask import Flask, jsonify
import gspread
from oauth2client.service_account import ServiceAccountCredentials

app = Flask(__name__)

# ===== GOOGLE SHEET CONFIG =====
SPREADSHEET_ID = "1Hdky0c7ojYPSE7eBc0b3PhvhIAMg0LBc9pWiakZ0gYc"
SHEET_NAME = "Kenh"

scope = ["https://spreadsheets.google.com/feeds",
         "https://www.googleapis.com/auth/drive"]

creds = ServiceAccountCredentials.from_json_keyfile_name("credentials.json", scope)
client = gspread.authorize(creds)

sheet = client.open_by_key(SPREADSHEET_ID).worksheet(SHEET_NAME)

# ===== API =====
@app.route("/")
def home():
    return "API RUNNING"

@app.route("/data")
def get_data():
    rows = sheet.get_all_records()

    # đảm bảo number đúng kiểu (fix chart lỗi)
    for r in rows:
        r["TotalViews"] = int(r.get("TotalViews", 0))
        r["ViewGrowth"] = int(r.get("ViewGrowth", 0))
        r["Followers"] = int(r.get("Followers", 0))
        r["Likes"] = int(r.get("Likes", 0))
        r["Score"] = int(r.get("Score", 0))

    return jsonify(rows)

# ===== RUN =====
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10000)
