#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# setup.sh  -  First-time setup for Pharmaceutical Company PIE
# Run this ONCE on your laptop: bash setup.sh
# ─────────────────────────────────────────────────────────────────

echo ""
echo "  Pharmaceutical Company Design-to-Delivery Accelerator"
echo "  Prompt Intelligence Engine - First Time Setup"
echo ""

# 1. Check Python
python3 --version || { echo "Python 3 not found - install from python.org"; exit 1; }

# 2. Install Python dependencies
echo "  Installing Python packages..."
pip install flask flask-cors transformers sentence-transformers textstat torch

# 3. Check Ollama
if command -v ollama &> /dev/null; then
    echo "  Ollama found."
else
    echo ""
    echo "  Ollama not found. Install it:"
    echo "  Mac/Linux:  curl -fsSL https://ollama.com/install.sh | sh"
    echo "  Windows:    download from https://ollama.com/download"
    echo ""
fi

# 4. Pull the model
echo "  Pulling mistral:7b (4.1GB - takes a few minutes)..."
ollama pull mistral:7b

# 5. Lighter alternative
echo ""
echo "  Optional: pull a lighter/faster model instead:"
echo "    ollama pull phi3:mini   (2.2GB, faster on CPU)"
echo "    To use it: edit MODEL = 'phi3:mini' in server.py"
echo ""

echo "  ✓ Setup complete!"
echo ""
echo "  To run:"
echo "    Terminal 1:  ollama serve"
echo "    Terminal 2:  python server.py"
echo "    Browser:     http://localhost:8080"
echo ""
