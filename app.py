from flask import Flask, render_template
import json

app = Flask(__name__)

@app.route("/")
def home():
    try:
        with open("tiktok_results.json", "r", encoding="utf-8") as f:
            data = json.load(f)
    except:
        data = []
    return render_template("index.html", data=data)

# QUAN TRỌNG
if __name__ == "__main__":
    app.run()
