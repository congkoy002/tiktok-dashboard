from flask import Flask, render_template
from google.oauth2 import service_account
from googleapiclient.discovery import build
import os
import json

app = Flask(__name__)

SPREADSHEET_ID = '1Hdky0c7ojYPSE7eBc0b3PhvhIAMg0LBc9pWiakZ0gYc'
RANGE_NAME = 'Kenh!A2:Q'


def get_creds():
    try:
        info = json.loads(os.environ['GOOGLE_CREDENTIALS'])
        creds = service_account.Credentials.from_service_account_info(
            info,
            scopes=['https://www.googleapis.com/auth/spreadsheets.readonly']
        )
        return creds
    except Exception as e:
        print("❌ Lỗi credentials:", e)
        return None


def get_data():
    creds = get_creds()
    if not creds:
        return []

    try:
        service = build('sheets', 'v4', credentials=creds)
        sheet = service.spreadsheets()

        result = sheet.values().get(
            spreadsheetId=SPREADSHEET_ID,
            range=RANGE_NAME
        ).execute()

        rows = result.get('values', [])

        data = []

        for r in rows:
            data.append({
                "Username": r[0] if len(r) > 0 else '',
                "Followers": r[1] if len(r) > 1 else '',
                "Following": r[2] if len(r) > 2 else '',
                "Likes": r[3] if len(r) > 3 else '',
                "Videos": r[4] if len(r) > 4 else '',
                "TotalViews": r[5] if len(r) > 5 else '',
                "AvgViews": r[6] if len(r) > 6 else '',
                "LastView": r[7] if len(r) > 7 else '',
                "Flop": r[8] if len(r) > 8 else '',
                "Viral": r[9] if len(r) > 9 else '',
                "Profile": r[10] if len(r) > 10 else '',
                "UpdateTime": r[11] if len(r) > 11 else ''
            })

        return data

    except Exception as e:
        print("❌ Lỗi Google Sheets:", e)
        return []


@app.route("/")
def home():
    data = get_data()
    return render_template("index.html", data=data)


if __name__ == "__main__":
    app.run(debug=True)
