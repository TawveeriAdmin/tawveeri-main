#!/bin/bash

# Flask Scraping Service Startup Script
# This script checks Python environment and starts the Flask service

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Starting Flask Scraping Service..."
echo ""

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Error: Python 3 is not installed"
    echo "   Please install Python 3.8 or higher"
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
echo "✅ Python version: $(python3 --version)"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install/upgrade requirements
if [ ! -f "requirements.txt" ]; then
    echo "❌ Error: requirements.txt not found"
    exit 1
fi

echo "📥 Installing/updating dependencies..."
pip install --upgrade pip > /dev/null 2>&1
pip install -r requirements.txt

# Load environment variables if .env exists
if [ -f ".env" ]; then
    echo "📋 Loading environment variables from .env..."
    export $(cat .env | grep -v '^#' | xargs)
fi

# Set defaults if not set
export FLASK_HOST=${FLASK_HOST:-127.0.0.1}
export FLASK_PORT=${FLASK_PORT:-5000}
export FLASK_DEBUG=${FLASK_DEBUG:-false}
export ALLOWED_ORIGINS=${ALLOWED_ORIGINS:-"http://localhost:3000,http://127.0.0.1:3000"}

echo ""
echo "✅ Environment ready"
echo "   Host: $FLASK_HOST"
echo "   Port: $FLASK_PORT"
echo "   Debug: $FLASK_DEBUG"
echo ""

# Start Flask app
echo "🌐 Starting Flask server..."
python3 app.py


