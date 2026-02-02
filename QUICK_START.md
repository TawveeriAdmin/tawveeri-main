# Quick Start Guide - Running the Scraping Service

## Prerequisites
- Node.js installed
- Python 3.8+ installed
- Two terminal windows/tabs

---

## Step 1: Install Python Dependencies

Open Terminal 1 and run:

```bash
cd /Users/abdulazizalhashim/Desktop/Repositories/tawveeri
npm run flask:install
```

This installs Flask, requests, beautifulsoup4, and curl-cffi.

---

## Step 2: Start Flask Service

Keep Terminal 1 open and run:

```bash
npm run flask:start
```

You should see:
```
🛍️  Saudi Price Compare - Multi-Store Price Comparison
=======================================================
   Supported stores:
   ✅ 🛒 Amazon SA
   ✅ 🌙 Noon
   ✅ 📚 Jarir
   ✅ 🔌 Extra
=======================================================
   Flask running on http://127.0.0.1:5000
   Debug mode: False
   Allowed origins: http://localhost:3000, http://127.0.0.1:3000

 * Serving Flask app 'app'
 * Running on http://127.0.0.1:5000
Press CTRL+C to quit
```

**Keep this terminal running!** Don't close it.

---

## Step 3: Start Next.js App

Open Terminal 2 (new terminal window/tab) and run:

```bash
cd /Users/abdulazizalhashim/Desktop/Repositories/tawveeri
npm run dev
```

You should see:
```
▲ Next.js 15.5.6
- Local:        http://localhost:3000
- Network:      http://192.168.8.167:3000

✓ Ready in 2.2s
```

---

## Step 4: Use the Application

1. Open your browser and go to: `http://localhost:3000`
2. Navigate to the search page
3. Enter a search query (e.g., "laptop", "phone", "iphone")
4. Click search or press Enter
5. Wait 10-30 seconds for results (scraping takes time)
6. Results from Amazon, Noon, and Jarir will appear

---

## Troubleshooting

### Flask won't start?
```bash
# Check Python version
python3 --version

# Should be 3.8 or higher
```

### "Command not found: python"?
- Use `python3` instead of `python` (already fixed in package.json)

### Next.js can't connect to Flask?
1. Make sure Flask is running (check Terminal 1)
2. Verify Flask is on port 5000: `curl http://127.0.0.1:5000/health`
3. Check `.env.local` has: `FLASK_API_URL=http://127.0.0.1:5000`

### Port 5000 already in use?
```bash
# Find what's using port 5000
lsof -i :5000

# Kill the process or change Flask port in scripts/scraping/app.py
```

---

## Stopping the Services

- **Flask**: In Terminal 1, press `CTRL+C`
- **Next.js**: In Terminal 2, press `CTRL+C`

---

## Alternative: Using the Startup Script

Instead of `npm run flask:start`, you can use:

```bash
./scripts/scraping/start-flask.sh
```

This script:
- Checks Python version
- Creates virtual environment (if needed)
- Installs dependencies
- Starts Flask

---

## Quick Commands Reference

```bash
# Install Flask dependencies
npm run flask:install

# Start Flask (Terminal 1)
npm run flask:start

# Start Next.js (Terminal 2)
npm run dev

# Check if Flask is running
npm run flask:check

# Or manually check
curl http://127.0.0.1:5000/health
```

---

## Important Notes

1. **Both services must run simultaneously:**
   - Flask on port 5000
   - Next.js on port 3000

2. **First search takes longer:**
   - 10-30 seconds depending on stores
   - Subsequent searches may be faster (if caching enabled)

3. **Flask terminal shows scraping progress:**
   - You'll see "Scraping page 1..." messages
   - "Found X products" when complete

4. **Keep both terminals open:**
   - Closing Flask will break the search functionality
   - Closing Next.js will stop the web app

