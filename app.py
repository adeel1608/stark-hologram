from flask import Flask, render_template

app = Flask(__name__, static_folder="static", template_folder="templates")

@app.get("/")
def index():
    return render_template("index.html")

if __name__ == "__main__":
    # localhost only (safe). Use 0.0.0.0 if you want other devices to connect.
    app.run(host="127.0.0.1", port=5000, debug=True)

