from flask import Flask, render_template
from google.oauth2 import service_account
from googleapiclient.discovery import build

app = Flask(__name__)

SPREADSHEET_ID = '1Hdky0c7ojYPSE7eBc0b3PhvhIAMg0LBc9pWiakZ0gYc'
RANGE_NAME = 'Kenh!A2:Q'

def get_data():
    creds = service_account.Credentials.from_service_account_file(
        'credentials.json',
        scopes=['https://www.googleapis.com/auth/spreadsheets.readonly']
    )

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
            "Username": r[0] if len(r)>0 else '',
            "Followers": r[1] if len(r)>1 else '',
            "Following": r[2] if len(r)>2 else '',
            "Likes": r[3] if len(r)>3 else '',
            "Videos": r[4] if len(r)>4 else '',
            "TotalViews": int(r[5]) if len(r)>5 and r[5].isdigit() else 0,
            "AvgViews": int(r[6]) if len(r)>6 and r[6].isdigit() else 0,
            "LastView": int(r[7]) if len(r)>7 and r[7].isdigit() else 0,
            "FlopStatus": r[12] if len(r)>12 else '',
            "IsViral": r[13] if len(r)>13 else '',
            "ChannelStatus": r[15] if len(r)>15 else ''
        })

    return data


@app.route("/")
def home():
    data = get_data()
    return render_template("index.html", data=data)


if __name__ == "__main__":
    app.run()
