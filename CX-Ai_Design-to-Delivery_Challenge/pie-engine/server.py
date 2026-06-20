"""
server.py  -  Pharma Design-to-Delivery Accelerator
See pie_new.py for the 5 classifiers.
Run: python server.py  (with ollama serve in another terminal)
"""
import json, urllib.request, urllib.error, datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from pie_new import run_pie

app = Flask(__name__, static_folder=".", static_url_path="")
CORS(app)

OLLAMA_URL     = "http://localhost:11434/api/chat"
MODEL          = "mistral:7b"
PORT           = 8080
AUDIT_LOG_FILE = "pie_audit_log.jsonl"


@app.route("/")
def index():
    return app.send_static_file("index.html")




@app.route("/api/health", methods=["GET"])
def health():
    ollama_ok = False
    try:
        with urllib.request.urlopen("http://localhost:11434/api/tags", timeout=2):
            ollama_ok = True
    except Exception:
        pass
    return jsonify({
        "status": "ok", "pie": "ready",
        "ollama": "ready" if ollama_ok else "not running - run: ollama serve",
        "model": MODEL,
    })


@app.route("/api/classify", methods=["POST"])
def classify():
    """
    Run PIE classifiers on a brief.
    Request:  { brief, country, dept, build_type, language, user_name }
    Response: full classifier outputs + enriched_prompt + pie_score
    """
    body = request.get_json() or {}
    brief = (body.get("brief_text") or body.get("brief") or "").strip()
    if not brief:
        return jsonify({"error": "brief is required"}), 400
    try:
        result = run_pie(
            brief_text = brief,
            country    = body.get("country", ""),
            dept       = body.get("dept", ""),
            build_type = body.get("build_type", ""),
            language   = body.get("language", "English"),
            user_name  = body.get("user_name", ""),
        )
        # Append to audit log (one JSON line per run)
        try:
            with open(AUDIT_LOG_FILE, "a") as f:
                f.write(json.dumps(result["audit_log"]) + "\n")
        except Exception:
            pass
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e), "pie_score": 0}), 500


@app.route("/api/chat", methods=["POST"])
def chat():
    """
    Proxy enriched prompt to Ollama.
    Returns Anthropic-compatible shape: { content: [{type, text}] }
    """
    body     = request.get_json() or {}
    system   = body.get("system", "")
    messages = body.get("messages", [])
    all_msgs = ([{"role": "system", "content": system}] if system else []) + messages
    payload  = json.dumps({
        "model": MODEL, "messages": all_msgs, "stream": False,
        "options": {"temperature": 0.3, "num_predict": 1200}
    }).encode()
    try:
        req = urllib.request.Request(
            OLLAMA_URL, data=payload,
            headers={"Content-Type": "application/json"}, method="POST"
        )
        with urllib.request.urlopen(req, timeout=180) as resp:
            text = json.loads(resp.read())["message"]["content"]
        return jsonify({"content": [{"type": "text", "text": text}]})
    except urllib.error.URLError:
        return jsonify({"error": "Ollama not reachable. Run: ollama serve",
                        "content": [{"type": "text", "text": "{}"}]}), 503
    except Exception as e:
        return jsonify({"error": str(e),
                        "content": [{"type": "text", "text": "{}"}]}), 500


if __name__ == "__main__":
    print(f"""
  Pharmaceutical Company DTA - PIE Server
  Open:   http://localhost:{PORT}
  Model:  {MODEL}
  Audit:  {AUDIT_LOG_FILE}

  Make sure Ollama is running: ollama serve
""")
    app.run(port=PORT, debug=False, threaded=True)
