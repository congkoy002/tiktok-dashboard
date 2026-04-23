from flask import Flask, render_template, jsonify
from google.oauth2 import service_account
from googleapiclient.discovery import build
import os, json, requests, datetime

app = Flask(__name__)

SPREADSHEET_ID = '1Hdky0c7ojYPSE7eBc0b3PhvhIAMg0LBc9pWiakZ0gYc'

# ===== TELEGRAM =====
TOKEN = "8736136206:AAERH3X6xt423SnEdL4rOey-RM37L2_uwhk"
CHAT_ID = "6839559152"

sent_cache = {}

def send_telegram(msg):
    try:
        requests.get(
            f"https://api.telegram.org/bot{TOKEN}/sendMessage",
            params={"chat_id": CHAT_ID, "text": msg}
        )
    except:
        pass

# ===== GOOGLE AUTH =====
def get_creds():
    info = json.loads(os.environ['GOOGLE_CREDENTIALS'])
    return service_account.Credentials.from_service_account_info(
        info,
        scopes=['https://www.googleapis.com/auth/spreadsheets']
    )

def get_sheet():
    creds = get_creds()
    return build('sheets', 'v4', credentials=creds)

# ===== AI SCORING =====
def calc_score(followers, last_view, total_views):
    if followers == 0:
        return 0

    ratio = last_view / followers
    score = 0

    # Reach
    if ratio > 0.5: score += 40
    elif ratio > 0.2: score += 30
    elif ratio > 0.1: score += 20
    else: score += 5

    # Volume
    if total_views > 1_000_000: score += 30
    elif total_views > 100_000: score += 20
    else: score += 10

    # Momentum
    if last_view > 500: score += 20
    else: score += 5

    return min(score, 100)

# ===== PICK BEST CHANNEL =====
def pick_best_channel(data):
    best = None
    best_score = 0

    for d in data:
        followers = d["Followers"]
        last = d["LastView"]
        views = d["Views"]

        if followers == 0:
            continue

        reach = last / followers

        score = (
            reach * 50 +
            (last / 1000) * 20 +
            (views / 10000) * 10
        )

        if score > best_score:
            best_score = score
            best = d

    return best, int(best_score)

# ===== MAIN PROCESS =====
def process_data():
    service = get_sheet()

    rows = service.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range="Kenh!A2:Q"
    ).execute().get("values", [])

    today = datetime.date.today().isoformat()

    history_rows = []
    data = []

    for r in rows:
        username = r[0]

        followers = int(r[1]) if len(r)>1 and r[1].isdigit() else 0
        total_views = int(r[5]) if len(r)>5 and r[5].isdigit() else 0
        last_view = int(r[7]) if len(r)>7 and r[7].isdigit() else 0

        score = calc_score(followers, last_view, total_views)

        # AI decision
        if score >= 70:
            decision = "🔥 NUÔI MẠNH"
        elif score < 30:
            decision = "❌ BỎ"
        else:
            decision = "⚖️ THEO DÕI"

        # ALERT chống spam
        if score >= 80:
            key = f"{username}_viral"
            if key not in sent_cache:
                send_telegram(f"🔥 {username} viral! Score: {score}")
                sent_cache[key] = True

        if score < 20:
            key = f"{username}_flop"
            if key not in sent_cache:
                send_telegram(f"❌ {username} flop! Score: {score}")
                sent_cache[key] = True

        history_rows.append([
            today, username, followers, total_views, last_view, score
        ])

        data.append({
            "Username": username,
            "Followers": followers,
            "Views": total_views,
            "LastView": last_view,
            "Score": score,
            "Decision": decision
        })

    # Lưu history
    service.spreadsheets().values().append(
        spreadsheetId=SPREADSHEET_ID,
        range="History!A2",
        valueInputOption="RAW",
        body={"values": history_rows}
    ).execute()

    # chọn best
    best, best_score = pick_best_channel(data)

    if best:
        key = f"best_{best['Username']}"
        if key not in sent_cache:
            send_telegram(
                f"🚀 BEST CHANNEL:\n{best['Username']}\nScore: {best_score}"
            )
            sent_cache[key] = True

    return data, best, best_score

# ===== API =====
@app.route("/api/data")
def api_data():
    data, _, _ = process_data()
    return jsonify(data)

@app.route("/api/history")
def api_history():
    service = get_sheet()
    rows = service.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range="History!A2:F"
    ).execute().get("values", [])

    return jsonify(rows)

@app.route("/api/best")
def api_best():
    _, best, score = process_data()
    return jsonify({"channel": best, "score": score})

@app.route("/")
def home():
    return render_template("dashboard.html")

if __name__ == "__main__":
    app.run()
