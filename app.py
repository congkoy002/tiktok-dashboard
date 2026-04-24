from flask import Flask, jsonify
from googleapiclient.discovery import build
from google.oauth2 import service_account
import json, os

app = Flask(__name__)

SPREADSHEET_ID = '1Hdky0c7ojYPSE7eBc0b3PhvhIAMg0LBc9pWiakZ0gYc'

def get_sheet():
    creds = json.loads(os.environ['GOOGLE_CREDENTIALS'])
    return build('sheets','v4',credentials=service_account.Credentials.from_service_account_info(
        creds,
        scopes=['https://www.googleapis.com/auth/spreadsheets']
    ))

@app.route("/api/data")
def data():
    sheet = get_sheet()

    rows = sheet.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range="Kenh!A2:Q"
    ).execute().get("values", [])

    def g(r,i):
        return r[i] if len(r)>i else "0"

    def n(x):
        try:
            return int(str(x).replace(",",""))
        except:
            return 0

    data = []

    for r in rows:
        data.append({
            "Username": g(r,0),
            "Followers": n(g(r,1)),
            "Following": n(g(r,2)),
            "Likes": n(g(r,3)),
            "Videos": n(g(r,4)),
            "TotalViews": n(g(r,5)),
            "AvgViews": n(g(r,6)),
            "LastView": n(g(r,7)),
            "ViewGrowth": n(g(r,10)),
            "Flop": g(r,12),
            "Viral": g(r,13),
            "Score": n(g(r,14)),
            "Status": g(r,15)
        })

    return jsonify(data)

@app.route("/api/history")
def history():
    sheet = get_sheet()

    rows = sheet.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range="Kenh!A2:Q"
    ).execute().get("values", [])

    return jsonify(rows)

@app.route("/api/best")
def best():
    sheet = get_sheet()

    rows = sheet.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range="Kenh!A2:Q"
    ).execute().get("values", [])

    best = None
    score = 0

    for r in rows:
        s = int(r[14]) if len(r)>14 and r[14].isdigit() else 0
        if s > score:
            score = s
            best = r

    return jsonify({
        "channel": best,
        "score": score
    })

if __name__ == "__main__":
    app.run()
