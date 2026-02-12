#!/bin/bash

# Quick script to check if Flask is running

echo "Checking Flask service status..."

if curl -s http://127.0.0.1:5000/health > /dev/null 2>&1; then
    echo "✅ Flask is running on http://127.0.0.1:5000"
    curl -s http://127.0.0.1:5000/health | python3 -m json.tool 2>/dev/null || echo "Health check response received"
else
    echo "❌ Flask is NOT running"
    echo ""
    echo "To start Flask, run:"
    echo "  npm run flask:start"
    echo ""
    echo "Or manually:"
    echo "  cd scripts/scraping"
    echo "  python3 app.py"
    exit 1
fi


