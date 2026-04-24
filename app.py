from flask import Flask, jsonify
from googleapiclient.discovery import build
from google.oauth2 import service_account
import json, os

app = Flask(__name__)

SPREADSHEET_ID = "1Hdky0c7ojYPSE7eBc0b3PhvhIAMg0LBc9pWiakZ0gYc"

def sheet():
    creds = json.loads(os.environ["GOOGLE_CREDENTIALS"])
    return build(
        "sheets","v4",
        credentials=service_account.Credentials.from_service_account_info(
            creds,
            scopes=["https://www.googleapis.com/auth/spreadsheets"]
        )
    )

@app.route("/")
def home():
    return "🚀 Dashboard Running"

@app.route("/api/data")
def data():

    s = sheet()

    rows = s.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range="Kenh!A2:Q"
    ).execute().get("values",[])

    def n(x):
        try: return int(x)
        except: return 0

    out=[]

    for r in rows:
        out.append({
            "Username": r[0],
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
            "Flop": r[12] if len(r)>12 else "",
            "Viral": r[13] if len(r)>13 else "",
            "Score": n(r[14]),
            "Status": r[15] if len(r)>15 else ""
        })

    return jsonify(out)

@app.route("/api/history")
def history():

    s = sheet()

    rows = s.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range="Kenh!A2:Q"
    ).execute().get("values",[])

    return jsonify(rows)

if __name__=="__main__":
    app.run(host="0.0.0.0", port=10000)
