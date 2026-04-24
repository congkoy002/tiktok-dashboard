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

# ================= HOME =================
@app.route("/")
def home():
    return render_template("index.html")

# ================= DATA API =================
@app.route("/api/data")
def data():
    s = sheet()

    rows = s.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range="Kenh!A1:Z"
    ).execute().get("values", [])

    if not rows or len(rows) < 2:
        return jsonify([])

    data_rows = rows[1:]

    def g(r, i):
        return r[i] if i < len(r) else ""

    def n(x):
        try:
            return int(float(str(x).replace(",", "")))
        except:
            return 0

    out = []

    for r in data_rows:
        out.append({
            "Username": g(r,0),
            "Followers": n(g(r,1)),
            "Following": n(g(r,2)),
            "Likes": n(g(r,3)),
            "Videos": n(g(r,4)),
            "TotalViews": n(g(r,5)),
            "AvgViews": n(g(r,6)),
            "LastView": n(g(r,7)),
            "FollowerGrowth": n(g(r,8)),
            "LikeGrowth": n(g(r,9)),
            "ViewGrowth": n(g(r,10)),
            "Last3Views": g(r,11),

            "FlopStatus": g(r,12),
            "IsViral": g(r,13),

            "Score": n(g(r,14)),
            "ChannelStatus": g(r,15),
            "LastUpdate": g(r,16)
        })

    return jsonify(out)

# ================= /data alias =================
@app.route("/data")
def data_alias():
    return data()

# ================= HISTORY =================
@app.route("/api/history")
def history():
    s = sheet()

    rows = s.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range="History!A2:Q"
    ).execute().get("values", [])

    return jsonify(rows)

# ================= HEALTH =================
@app.route("/health")
def health():
    return {"status": "ok"}

# ================= RUN =================
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10000)
