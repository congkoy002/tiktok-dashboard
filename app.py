from flask import Flask, jsonify, render_template
from googleapiclient.discovery import build
from google.oauth2 import service_account
import json, os

app = Flask(__name__)

SPREADSHEET_ID = "1Hdky0c7ojYPSE7eBc0b3PhvhIAMg0LBc9pWiakZ0gYc"

# ================= SHEET =================
def sheet():
    creds = json.loads(os.environ["GOOGLE_CREDENTIALS"])
    return build(
        "sheets", "v4",
        credentials=service_account.Credentials.from_service_account_info(
            creds,
            scopes=["https://www.googleapis.com/auth/spreadsheets"]
        )
    )

# ================= HOME (FIX NOT FOUND) =================
@app.route("/")
def home():
    return render_template("index.html")

# ================= DATA API =================
@app.route("/api/data")
def data():
    s = sheet()

    rows = s.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range="Kenh!A2:Q"
    ).execute().get("values", [])

    def n(x):
        try:
            return int(float(x))
        except:
            return 0

    out = []

    for r in rows:
        out.append({
            "Username": r[0] if len(r)>0 else "",
            "Followers": n(r[1]),
            "Following": n(r[2]),
            "Likes": n(r[3]),
            "Videos": n(r[4]),
            "TotalViews": n(r[5]),
            "AvgViews": n(r[6]),
            "LastView": n(r[7]),
            "FollowerGrowth": n(r[8]),
            "LikeGrowth": n(r[9]),
            "ViewGrowth": n(r[10]),
            "Last3Views": r[11] if len(r)>11 else "",
            "Flop": r[12] if len(r)>12 else "NO",
            "Viral": r[13] if len(r)>13 else "NO",
            "Score": n(r[14]),
            "Status": r[15] if len(r)>15 else "NORMAL",
            "Update": r[16] if len(r)>16 else ""
        })

    return jsonify(out)

# ================= HISTORY =================
@app.route("/api/history")
def history():
    s = sheet()

    rows = s.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range="Kenh!A2:Q"
    ).execute().get("values", [])

    return jsonify(rows)

# ================= HEALTH =================
@app.route("/health")
def health():
    return {"status": "ok"}

# ================= RUN =================
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10000)
