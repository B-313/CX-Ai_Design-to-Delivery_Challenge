#!/usr/bin/env python3
"""
rag_engine.py - Local RAG for Pharmaceutical Company Design-to-Delivery Accelerator
---------------------------------------------------------------------
Adds NotebookLM-style document understanding to your project.

Install once:
    pip install sentence-transformers chromadb pypdf flask flask-cors

Run:
    python rag_engine.py

Then open your app at http://localhost:8080 as normal.
This replaces server.py - it does everything server.py did PLUS RAG.

Drop any PDF/txt into the docs/ folder and they auto-load on startup.
"""

import os
import json
import re
import urllib.request
import urllib.error
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS

# ── RAG imports ──────────────────────────────────────────────────────────────
from sentence_transformers import SentenceTransformer
import chromadb

# ── Config ───────────────────────────────────────────────────────────────────
PORT        = 8080
OLLAMA_URL  = "http://localhost:11434/api/chat"
MODEL       = "llama3.2"        # change to phi3:mini for faster responses
DOCS_FOLDER = "./docs"            # drop your PDFs/txts here
CHUNK_SIZE  = 400                 # characters per chunk
CHUNK_OVER  = 80                  # overlap between chunks

# ── App setup ─────────────────────────────────────────────────────────────────
app = Flask(__name__, static_folder=".", static_url_path="")
CORS(app)

# ── Embedding model (downloads once, ~90MB, then cached locally) ──────────────
print("  Loading embedding model (first run downloads ~90MB)…")
embedder = SentenceTransformer("all-MiniLM-L6-v2")   # fast, good quality, free
print("  Embedding model ready ✓")

# ── Vector database (in-memory, no setup needed) ──────────────────────────────
chroma  = chromadb.Client()
try:
    collection = chroma.get_collection("pharmaceutical_company_docs")
    print("  Loaded existing vector collection ✓")
except:
    collection = chroma.create_collection("pharmaceutical_company_docs")
    print("  Created new vector collection ✓")


# ════════════════════════════════════════════════════════════════════════════
#  DOCUMENT LOADING
# ════════════════════════════════════════════════════════════════════════════

def chunk_text(text, source="unknown"):
    """Split text into overlapping chunks for better retrieval."""
    chunks, ids, metas = [], [], []
    text  = re.sub(r'\s+', ' ', text).strip()
    start = 0
    i     = 0
    while start < len(text):
        end   = start + CHUNK_SIZE
        chunk = text[start:end]
        if len(chunk.strip()) > 40:          # skip tiny scraps
            chunks.append(chunk)
            ids.append(f"{source}_{i}")
            metas.append({"source": source, "chunk": i})
            i += 1
        start = end - CHUNK_OVER             # overlap
    return chunks, ids, metas


def load_txt(path):
    return Path(path).read_text(errors="ignore")


def load_pdf(path):
    try:
        from pypdf import PdfReader
        reader = PdfReader(path)
        return " ".join(page.extract_text() or "" for page in reader.pages)
    except ImportError:
        print(f"  ⚠ pypdf not installed - skipping {path}. Run: pip install pypdf")
        return ""


def ingest_document(path):
    """Load a file, chunk it, embed it, store in ChromaDB."""
    path = Path(path)
    ext  = path.suffix.lower()

    if ext == ".pdf":
        text = load_pdf(path)
    elif ext in (".txt", ".md"):
        text = load_txt(path)
    else:
        print(f"  Skipping unsupported file: {path.name}")
        return 0

    if not text.strip():
        print(f"  ⚠ No text extracted from {path.name}")
        return 0

    chunks, ids, metas = chunk_text(text, source=path.name)
    if not chunks:
        return 0

    # Check which chunks are already stored (idempotent)
    existing = set(collection.get(ids=ids)["ids"])
    new_chunks = [(c, i, m) for c, i, m in zip(chunks, ids, metas) if i not in existing]

    if new_chunks:
        texts, new_ids, new_metas = zip(*new_chunks)
        vectors = embedder.encode(list(texts)).tolist()
        collection.add(documents=list(texts), embeddings=vectors,
                        ids=list(new_ids), metadatas=list(new_metas))
        print(f"  Indexed {len(new_chunks)} new chunks from {path.name} ✓")
    else:
        print(f"  {path.name} already indexed ✓")

    return len(new_chunks)


def load_docs_folder():
    """Auto-load everything from the docs/ folder."""
    folder = Path(DOCS_FOLDER)
    if not folder.exists():
        folder.mkdir()
        # Create a starter doc if folder is empty
        (folder / "pharmaceutical_company_design_rules.txt").write_text(STARTER_DOC)
        print(f"  Created {DOCS_FOLDER}/ with starter design rules ✓")

    total = 0
    for f in sorted(folder.iterdir()):
        if f.suffix.lower() in (".pdf", ".txt", ".md"):
            total += ingest_document(f)
    return total


# Starter document - placeholder Pharmaceutical Company design rules
# Replace with real brand guidelines PDF for your demo
STARTER_DOC = """
Pharmaceutical Company Digital Design System - Core Rules

BRAND COLOURS
Primary blue: #0093D0. Dark blue: #003087. Use white (#FFFFFF) for backgrounds.
Never use gradients on body text. Headlines may use the blue gradient.

TYPOGRAPHY
Headlines: DM Serif Display or Georgia. Body: DM Sans or Calibri.
Minimum body font size: 16px. Line height minimum: 1.6.
Never use font sizes below 14px in body copy.

ACCESSIBILITY
All digital content must meet WCAG 2.1 AA minimum.
Colour contrast ratio: 4.5:1 for normal text, 3:1 for large text.
All images must have descriptive alt text.
All interactive elements must be keyboard-navigable.
Focus indicators must be clearly visible.

COMPLIANCE
Never make unsubstantiated medical claims.
All clinical data references must link to approved source material.
GDPR cookie consent banner is required on all public-facing pages.
EU Directive 2001/83/EC requires a legal disclaimer on all medicine-related pages.
Regulatory review is mandatory before any page goes live.

COMPONENTS
Hero Banner: full-width, Pharmaceutical Company blue gradient, white headline, max 12 words.
Card Grid: 3-up layout preferred. Cards must have equal height. Border-radius 10px.
CTA Button: Pharmaceutical Company blue background, white text, border-radius 6px, min 44px touch target.
Navigation: sticky top bar, white background, Pharmaceutical Company logo left-aligned.
Footer: dark blue (#003087) background, white text, must include legal disclaimer and cookie link.
Stat Callout: large number in DM Serif, caption in DM Sans, Pharmaceutical Company blue accent.

CONTENT RULES
Plain language standard: target Grade 8 reading level (Flesch score 60+).
Avoid jargon, especially for patient-facing content.
Use active voice throughout.
Oxford comma required.
Pharmaceutical Company tone: human, optimistic, scientifically credible.
Never use "cheap", "affordable" - use "accessible" instead.
Patient content must be reviewed by a Medical Affairs representative.
"""


# ════════════════════════════════════════════════════════════════════════════
#  RAG RETRIEVAL
# ════════════════════════════════════════════════════════════════════════════

def retrieve(query, n_results=4):
    """Find the most relevant document chunks for a query."""
    count = collection.count()
    if count == 0:
        return [], []

    n = min(n_results, count)
    query_vec = embedder.encode([query]).tolist()
    results   = collection.query(query_embeddings=query_vec, n_results=n)

    docs    = results["documents"][0]
    sources = [m["source"] for m in results["metadatas"][0]]
    return docs, sources


def build_rag_prompt(system, user_query):
    """Augment the system prompt with retrieved context."""
    chunks, sources = retrieve(user_query, n_results=4)

    if not chunks:
        return system   # no docs loaded - just use system prompt as-is

    context = "\n\n---\n\n".join(
        f"[From: {src}]\n{chunk}"
        for chunk, src in zip(chunks, sources)
    )

    return f"""{system}

══ RETRIEVED CONTEXT FROM DESIGN SYSTEM ══
The following rules and guidelines were automatically retrieved based on this request.
You MUST follow these rules. Cite the source when relevant.

{context}

══ END RETRIEVED CONTEXT ══
Apply the above rules when generating your response.
"""


# ════════════════════════════════════════════════════════════════════════════
#  OLLAMA CALL
# ════════════════════════════════════════════════════════════════════════════

def call_ollama(system, messages):
    """Send a request to local Ollama and return the response text."""
    all_messages = [{"role": "system", "content": system}] + messages

    payload = json.dumps({
        "model":    MODEL,
        "messages": all_messages,
        "stream":   False
    }).encode()

    req = urllib.request.Request(
        OLLAMA_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    with urllib.request.urlopen(req, timeout=180) as resp:
        result = json.loads(resp.read())
        return result["message"]["content"]


# ════════════════════════════════════════════════════════════════════════════
#  FLASK ROUTES
# ════════════════════════════════════════════════════════════════════════════

@app.route("/")
def index():
    return app.send_static_file("index.html")


@app.route("/api/chat", methods=["POST"])
def chat():
    """Main AI endpoint - RAG-augmented chat via Ollama."""
    body     = request.get_json()
    system   = body.get("system", "You are a helpful assistant.")
    messages = body.get("messages", [])

    # Get the user's latest message for retrieval
    user_query = next(
        (m["content"] for m in reversed(messages) if m["role"] == "user"),
        ""
    )

    # Augment system prompt with retrieved context
    rag_system = build_rag_prompt(system, user_query)

    try:
        text = call_ollama(rag_system, messages)
        # Return in Anthropic-compatible shape - index.html expects this format
        return jsonify({"content": [{"type": "text", "text": text}]})

    except urllib.error.URLError:
        return jsonify({"error": "Ollama not running. Start it with: ollama serve"}), 503
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/upload", methods=["POST"])
def upload():
    """Upload a PDF or text file - chunks and indexes it immediately."""
    if "file" not in request.files:
        return jsonify({"error": "No file sent"}), 400

    f    = request.files["file"]
    name = f.filename
    path = Path(DOCS_FOLDER) / name
    f.save(path)

    count = ingest_document(path)
    total = collection.count()

    return jsonify({
        "message": f"Indexed {count} chunks from {name}",
        "total_chunks": total,
        "filename": name
    })


@app.route("/api/docs", methods=["GET"])
def list_docs():
    """List all indexed documents and chunk counts."""
    folder = Path(DOCS_FOLDER)
    files  = [f.name for f in folder.iterdir() if f.suffix in (".pdf",".txt",".md")]
    return jsonify({
        "files": files,
        "total_chunks": collection.count(),
        "model": MODEL
    })


@app.route("/api/search", methods=["POST"])
def search():
    """Debug endpoint - see what chunks get retrieved for a query."""
    query  = request.get_json().get("query", "")
    chunks, sources = retrieve(query, n_results=4)
    return jsonify([
        {"source": s, "text": c[:200] + "…"}
        for c, s in zip(chunks, sources)
    ])


# ════════════════════════════════════════════════════════════════════════════
#  STARTUP
# ════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print(f"""
  ╔══════════════════════════════════════════════════╗
  ║  Pharmaceutical Company DTA - RAG Server         ║
  ║  Model     : {MODEL:<36}║
  ║  Embedding : all-MiniLM-L6-v2 (local)            ║
  ║  Open      : http://localhost:{PORT}               ║
  ╚══════════════════════════════════════════════════╝

  Make sure Ollama is running: ollama serve
""")

    # Load all documents from docs/ folder
    print("  Loading documents…")
    n = load_docs_folder()
    print(f"  Total chunks in vector DB: {collection.count()}")
    print()
    print("  Drop PDFs into docs/ to add knowledge - they load automatically.")
    print("  Upload endpoint: POST /api/upload")
    print()

    app.run(port=PORT, debug=False)
