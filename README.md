# توفيري Tawveeri - Price Comparison Platform

> منصة مقارنة الأسعار للإلكترونيات في المملكة العربية السعودية
>
> Saudi Arabia's Premier Electronics Price Comparison Platform

[![Next.js](https://img.shields.io/badge/Next.js-16.0-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-green)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8)](https://tailwindcss.com/)

---

## 📖 Table of Contents

1. [What is Tawveeri?](#-what-is-tawveeri)
2. [How Does It Work?](#-how-does-it-work-simple-explanation)
3. [What You Need to Know](#-what-you-need-to-know-before-starting)
4. [Installation Guide](#-installation-guide-step-by-step)
5. [Running the Project](#-running-the-project)
6. [Project Structure](#-project-structure-explained)
7. [Key Concepts Explained](#-key-concepts-explained)
8. [Common Tasks](#-common-tasks)
9. [Troubleshooting](#-troubleshooting)
10. [Adding New Features](#-adding-new-features)
11. [Deployment](#-deployment)

---

## 🎯 What is Tawveeri?

**Tawveeri** (توفيري) is a price comparison website for electronics in Saudi Arabia. Think of it like Google Shopping, but specifically for Saudi stores.

### What It Does:
- **Searches** 8 Saudi stores at once: Amazon SA, Noon, Jarir, Extra, Almanea, Shaker, Samsung KSA, Al-Shetaa Wal-Saif (SWSG)
- **Compares prices** so users can find the best deal
- **Tracks price history** to see if prices are going up or down
- **Sends alerts** when prices drop
- **Works in Arabic and English**

### Who Uses It:
- **Customers** looking for the best prices on electronics
- **Store owners** who want to list their products
- **Admins** who manage the platform

---

## 🔧 How Does It Work? (Simple Explanation)

This project has **3 main parts** that work together:

```
┌─────────────────────────────────────────────────────────┐
│                    YOUR BROWSER                         │
│  (What you see: Search page, product cards, etc.)      │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ User searches for "iPhone"
                     │
┌────────────────────▼────────────────────────────────────┐
│              NEXT.JS APPLICATION                        │
│  (TypeScript/React - The main website)                 │
│  - Shows the search page                               │
│  - Displays results                                    │
│  - Handles user interactions                           │
└────────────┬──────────────────────┬────────────────────┘
             │                      │
             │                      │
    ┌────────▼────────┐    ┌────────▼────────┐
    │   FLASK API     │    │    SUPABASE     │
    │   (Python)      │    │   (Database)    │
    │                 │    │                 │
    │ Scrapes stores  │    │ Stores user     │
    │ Gets real-time  │    │ data, products,│
    │ prices          │    │ wishlists, etc.│
    └─────────────────┘    └─────────────────┘
```

### The Flow:
1. **User types** "iPhone" in the search box
2. **Next.js** sends request to Flask API
3. **Flask** scrapes Amazon, Noon, Jarir, Extra websites
4. **Flask** returns product data (price, image, link)
5. **Next.js** displays results to the user
6. **Supabase** saves search history, wishlists, etc.

---

## 📚 What You Need to Know Before Starting

### Technologies Used:

| Technology | What It Is | Why We Use It |
|------------|-----------|---------------|
| **Next.js** | A React framework | Makes building websites easier |
| **TypeScript** | JavaScript with types | Prevents bugs, easier to read |
| **Python** | Programming language | Used for web scraping |
| **Flask** | Python web framework | Creates the scraping API |
| **Supabase** | Database service | Stores user data, products |
| **Tailwind CSS** | CSS framework | Makes styling easier |

### You Don't Need to Know Everything!
- **If you know JavaScript/TypeScript**: You can work on the Next.js parts
- **If you know Python**: You can work on the Flask/scraping parts
- **If you know SQL**: You can work on the database parts
- **If you're new**: Start with the installation guide below!

---

## 🚀 Installation Guide (Step-by-Step)

### Step 1: Install Required Software

#### 1.1 Install Node.js
- **Download**: [https://nodejs.org/](https://nodejs.org/)
- **Version**: 18 or higher
- **How to check**: Open terminal and type `node --version`
- **Should show**: `v18.x.x` or higher

#### 1.2 Install Python
- **Download**: [https://www.python.org/downloads/](https://www.python.org/downloads/)
- **Version**: 3.8 or higher
- **How to check**: Open terminal and type `python3 --version`
- **Should show**: `Python 3.8.x` or higher
- **Important**: During installation, check "Add Python to PATH"

#### 1.3 Install PostgreSQL Client (psql)
- **macOS**: `brew install postgresql`
- **Windows**: Download from [https://www.postgresql.org/download/windows/](https://www.postgresql.org/download/windows/)
- **Linux**: `sudo apt-get install postgresql-client`

#### 1.4 Create Supabase Account
- **Sign up**: [https://supabase.com/](https://supabase.com/)
- **Free tier**: Perfect for development
- **You'll need**: Project URL and API key (we'll set this up later)

### Step 2: Clone the Repository

```bash
# Open terminal/command prompt
git clone <repository-url>
cd tawveeri
```

### Step 3: Install Dependencies

```bash
# Install Node.js dependencies (for Next.js)
npm install

# This will take 2-5 minutes
# You'll see lots of packages being installed
```

### Step 4: Install Python Dependencies

```bash
# Install Python packages (for Flask/scraping)
npm run flask:install

# This installs:
# - Flask (web framework)
# - requests (HTTP library)
# - beautifulsoup4 (HTML parsing)
# - curl-cffi (for scraping)
```

### Step 5: Configure Environment Variables

```bash
# Copy the example environment file
cp .env.example .env.local

# Open .env.local in a text editor
# You'll need to add your Supabase credentials
```

**What to add to `.env.local`:**

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_DB_URL=postgresql://postgres:password@host:5432/postgres

# Flask API Configuration
FLASK_API_URL=http://127.0.0.1:5000
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# Other settings
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**How to get Supabase credentials:**
1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project (or create one)
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`
5. Go to **Settings** → **Database**
6. Copy **Connection string** → `SUPABASE_DB_URL`

### Step 6: Setup Database

```bash
# This creates all database tables and sets up security
npm run db:setup

# This will:
# 1. Create tables (users, products, stores, etc.)
# 2. Set up security policies
# 3. Insert sample data
```

**If you get errors:**
- Make sure `SUPABASE_DB_URL` is correct in `.env.local`
- Make sure PostgreSQL client (`psql`) is installed
- Check the [Troubleshooting](#-troubleshooting) section below

---

## 🏃 Running the Project

**Important**: This project needs **2 services** running at the same time!

### Option 1: Manual (Recommended for Learning)

#### Terminal 1: Start Flask (Python Scraping Service)

```bash
npm run flask:start
```

**You should see:**
```
🛍️  Saudi Price Compare - Multi-Store Price Comparison
=======================================================
   Flask running on http://127.0.0.1:5000
   Press CTRL+C to quit
```

**Keep this terminal open!** Don't close it.

#### Terminal 2: Start Next.js (Main Website)

```bash
npm run dev
```

**You should see:**
```
▲ Next.js 15.5.6
- Local:        http://localhost:3000
✓ Ready in 2.2s
```

#### Open Your Browser

Go to: [http://localhost:3000](http://localhost:3000)

You should see the Tawveeri homepage!

### Option 2: Using Scripts

```bash
# Terminal 1
./scripts/scraping/start-flask.sh

# Terminal 2
npm run dev
```

### Stopping the Services

- **Flask**: Press `CTRL+C` in Terminal 1
- **Next.js**: Press `CTRL+C` in Terminal 2

---

## 📁 Project Structure Explained

```
tawveeri/
│
├── src/                          # Main source code
│   ├── app/                      # Next.js pages (what users see)
│   │   ├── [locale]/            # Pages with language support
│   │   │   ├── search/          # Search page
│   │   │   ├── products/        # Product pages
│   │   │   └── ...              # Other pages
│   │   └── api/                 # API routes (server-side)
│   │       └── search/
│   │           └── scrape/      # Scraping API endpoint
│   │
│   ├── components/              # Reusable UI components
│   │   ├── ui/                  # Basic components (Button, Input, etc.)
│   │   ├── products/             # Product-related components
│   │   └── search/              # Search-related components
│   │
│   └── lib/                     # Utility functions and helpers
│       ├── scraping/            # Scraping-related code
│       ├── database/            # Database helpers
│       └── utils.ts             # General utilities
│
├── scripts/                     # Helper scripts
│   ├── scraping/                # Python scraping code
│   │   ├── app.py              # Flask API server
│   │   ├── amazon_sa_scraper.py # Amazon scraper
│   │   ├── noon_scraper.py     # Noon scraper
│   │   ├── jarir_scraper.py    # Jarir scraper
│   │   └── extra_sa_scraper.py # Extra scraper
│   │
│   └── database/                # Database setup scripts
│       ├── 01-schema.sql       # Creates tables
│       ├── 02-rls-policies.sql # Security policies
│       └── 03-seed-data.sql    # Sample data
│
├── messages/                    # Translations
│   ├── en/                     # English translations
│   └── ar/                     # Arabic translations
│
├── public/                      # Static files (images, etc.)
│
├── .env.local                  # Environment variables (DON'T COMMIT!)
├── package.json                # Node.js dependencies
├── next.config.ts              # Next.js configuration
└── README.md                   # This file!
```

### Key Files Explained:

| File | What It Does |
|------|--------------|
| `src/app/[locale]/search/page.tsx` | The search page users see |
| `src/app/api/search/scrape/route.ts` | API that calls Flask |
| `scripts/scraping/app.py` | Flask server that scrapes stores |
| `scripts/scraping/jarir_scraper.py` | Code that scrapes Jarir website |
| `src/lib/scraping/python-mapper.ts` | Converts Python data to TypeScript format |

---

## 🧠 Key Concepts Explained

### 1. What is Web Scraping?

**Web scraping** means automatically visiting websites and extracting information.

**Example:**
- You visit Amazon SA manually → You see iPhone price: 3,999 SAR
- Scraper visits Amazon SA automatically → Gets price: 3,999 SAR
- Scraper returns this data → We show it on our website

**Why we scrape:**
- Stores don't provide APIs (ways to get data automatically)
- We need real-time prices
- We want to compare across multiple stores

**Files involved:**
- `scripts/scraping/amazon_sa_scraper.py` - Scrapes Amazon
- `scripts/scraping/noon_scraper.py` - Scrapes Noon
- `scripts/scraping/jarir_scraper.py` - Scrapes Jarir

### 2. What is Flask?

**Flask** is a Python web framework. It creates an API (Application Programming Interface).

**Think of it like:**
- **Restaurant**: Flask is the kitchen
- **Menu**: API endpoints (`/search`, `/health`)
- **Order**: Your request ("Get me iPhone prices")
- **Food**: The response (list of products)

**How it works:**
```python
# Flask receives request: "Search for iPhone"
@app.route('/search', methods=['POST'])
def search():
    # Scrape stores
    products = scrape_stores("iPhone")
    # Return results
    return jsonify(products)
```

**File:** `scripts/scraping/app.py`

### 3. What is Next.js?

**Next.js** is a React framework for building websites.

**What it does:**
- **Frontend**: Shows pages to users (search page, product cards)
- **Backend**: API routes that talk to Flask and Supabase
- **Routing**: Handles URLs (`/search`, `/products/123`)

**Example flow:**
1. User visits `/search`
2. Next.js shows search page (`src/app/[locale]/search/page.tsx`)
3. User searches for "iPhone"
4. Next.js calls Flask API (`src/app/api/search/scrape/route.ts`)
5. Next.js displays results

### 4. What is Supabase?

**Supabase** is a database service (like Firebase, but open-source).

**What it stores:**
- User accounts
- Product data
- Wishlists
- Search history
- Price alerts

**Why we use it:**
- Easy to set up
- Free tier for development
- Built-in authentication
- Real-time updates

### 5. How Data Flows

```
User searches "iPhone"
    ↓
Next.js page (search/page.tsx)
    ↓
Next.js API (api/search/scrape/route.ts)
    ↓
Flask API (app.py)
    ↓
Scrapers (amazon_sa_scraper.py, etc.)
    ↓
Store websites (Amazon, Noon, Jarir)
    ↓
Results come back
    ↓
Flask formats data
    ↓
Next.js API receives data
    ↓
Next.js page displays results
    ↓
User sees products!
```

---

## 🛠️ Common Tasks

### Adding a New Store

**Step 1**: Create scraper file
```bash
# Create: scripts/scraping/newstore_scraper.py
# Copy from: scripts/scraping/amazon_sa_scraper.py
# Modify to scrape your store
```

**Step 2**: Add to Flask app
```python
# In scripts/scraping/app.py
from newstore_scraper import NewStoreScraper

# In search_store function:
elif store == 'newstore':
    scraper = NewStoreScraper()
    raw_products = scraper.search_all_pages(query, pages)
```

**Step 3**: Add store config
```python
# In scripts/scraping/app.py
STORES = {
    'newstore': {
        'name': 'New Store',
        'url': 'https://newstore.com',
        'logo': '🛒',
        'color': '#FF0000',
        'enabled': True,
    }
}
```

**Step 4**: Update Next.js types
```typescript
// In src/lib/scraping/search-types.ts
// Add 'newstore' to store types
```

### Adding a New Page

**Step 1**: Create page file
```bash
# Create: src/app/[locale]/newpage/page.tsx
```

**Step 2**: Add content
```tsx
export default function NewPage() {
  return <div>Hello from new page!</div>
}
```

**Step 3**: Add navigation (if needed)
```tsx
// In navigation component
<Link href="/newpage">New Page</Link>
```

### Adding Translations

**Step 1**: Add to English
```json
// messages/en/common.json
{
  "newKey": "New Text"
}
```

**Step 2**: Add to Arabic
```json
// messages/ar/common.json
{
  "newKey": "نص جديد"
}
```

**Step 3**: Use in code
```tsx
import { useTranslations } from 'next-intl'

const t = useTranslations('common')
<p>{t('newKey')}</p>
```

### Debugging

**Check Flask logs:**
- Look at Terminal 1 (where Flask is running)
- You'll see scraping progress and errors

**Check Next.js logs:**
- Look at Terminal 2 (where Next.js is running)
- You'll see API calls and errors

**Check browser console:**
- Press `F12` in browser
- Go to "Console" tab
- See JavaScript errors

**Check network requests:**
- Press `F12` in browser
- Go to "Network" tab
- See API calls and responses

---

## 🐛 Troubleshooting

### Flask won't start

**Error**: `python: command not found`
```bash
# Use python3 instead
python3 --version

# If that doesn't work, install Python
```

**Error**: `ModuleNotFoundError: No module named 'flask'`
```bash
# Install dependencies
npm run flask:install
```

**Error**: Port 5000 already in use
```bash
# Find what's using port 5000
lsof -i :5000  # macOS/Linux
netstat -ano | findstr :5000  # Windows

# Kill the process or change port in app.py
```

### Next.js can't connect to Flask

**Error**: `Failed to connect to scraping service`
```bash
# 1. Check Flask is running (Terminal 1)
curl http://127.0.0.1:5000/health

# Should return: {"status": "ok"}

# 2. Check .env.local has:
FLASK_API_URL=http://127.0.0.1:5000

# 3. Restart Next.js
```

### Database errors

**Error**: `Connection refused`
```bash
# Check SUPABASE_DB_URL in .env.local
# Make sure it's correct from Supabase dashboard
```

**Error**: `relation does not exist`
```bash
# Run database setup
npm run db:setup
```

### Images not loading

**Jarir images not showing:**
- This is a known issue
- Images are fetched from product pages (slow)
- Check Flask logs for errors

**Other stores:**
- Check `next.config.ts` has image domains
- Check browser console for errors

### Search returns no results

**Check:**
1. Flask is running (Terminal 1)
2. Flask logs show scraping activity
3. Network tab shows API calls
4. No errors in browser console

**Try:**
- Search for common terms: "laptop", "phone", "iphone"
- Check if specific store is working
- Check Flask terminal for errors

---

## ➕ Adding New Features

### Example: Add Price Alert Feature

**Step 1**: Create database table
```sql
-- scripts/database/07-price-alerts.sql
CREATE TABLE price_alerts (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  product_id UUID REFERENCES products(id),
  target_price DECIMAL,
  created_at TIMESTAMP
);
```

**Step 2**: Create API endpoint
```typescript
// src/app/api/alerts/route.ts
export async function POST(request: Request) {
  // Create price alert
}
```

**Step 3**: Create UI component
```tsx
// src/components/alerts/price-alert-form.tsx
export function PriceAlertForm() {
  // Form to create alert
}
```

**Step 4**: Add to page
```tsx
// src/app/[locale]/products/[id]/page.tsx
import { PriceAlertForm } from '@/components/alerts/price-alert-form'
```

### Best Practices

1. **Start small**: Add one feature at a time
2. **Test locally**: Make sure it works before committing
3. **Follow patterns**: Look at existing code for examples
4. **Add translations**: Always add English and Arabic
5. **Update docs**: Document your changes

---

## 🚀 Deployment

### Development vs Production

**Development** (what you're doing now):
- Flask runs on `localhost:5000`
- Next.js runs on `localhost:3000`
- Database is Supabase free tier
- Everything runs on your computer

**Production** (live website):
- Flask needs to run on a server (Railway, Render, etc.)
- Next.js can deploy to Vercel
- Database stays on Supabase
- Users can access from anywhere

### Deployment Options

**Option 1: Separate Services** (Recommended)
- **Next.js**: Deploy to Vercel (free)
- **Flask**: Deploy to Railway or Render (paid)
- **Database**: Supabase (free tier available)

**Option 2: Docker Compose** (Single Server)
- Both services in Docker containers
- Deploy to any VPS (DigitalOcean, AWS, etc.)
- See `docker-compose.yml`

**Option 3: PM2** (Process Manager)
- Run both services with PM2
- See `ecosystem.config.js`
- Deploy to VPS

**For detailed deployment guide**, see: [`md/DEPLOYMENT.md`](./md/DEPLOYMENT.md)

---

## 📚 Additional Resources

### Documentation Files

- **[QUICK_START.md](./QUICK_START.md)** - Quick setup guide
- **[md/DATABASE_SETUP.md](./md/DATABASE_SETUP.md)** - Database setup details
- **[md/PYTHON_SCRAPING_INTEGRATION.md](./md/PYTHON_SCRAPING_INTEGRATION.md)** - Scraping architecture
- **[md/DEPLOYMENT.md](./md/DEPLOYMENT.md)** - Deployment guide
- **[CLAUDE.md](./CLAUDE.md)** - AI assistant guidelines

### Learning Resources

- **Next.js**: [https://nextjs.org/docs](https://nextjs.org/docs)
- **TypeScript**: [https://www.typescriptlang.org/docs/](https://www.typescriptlang.org/docs/)
- **Flask**: [https://flask.palletsprojects.com/](https://flask.palletsprojects.com/)
- **Supabase**: [https://supabase.com/docs](https://supabase.com/docs)
- **Tailwind CSS**: [https://tailwindcss.com/docs](https://tailwindcss.com/docs)

---

## 🎯 Quick Reference

### Essential Commands

```bash
# Development
npm run dev              # Start Next.js
npm run flask:start      # Start Flask
npm run build            # Build for production

# Database
npm run db:setup         # Setup database
npm run db:schema        # Create tables only
npm run db:seed          # Add sample data

# Testing
npm test                 # Run tests
npm run lint             # Check code quality
```

### Important Files

- `.env.local` - Environment variables (DON'T COMMIT!)
- `package.json` - Node.js dependencies
- `scripts/scraping/app.py` - Flask server
- `src/app/api/search/scrape/route.ts` - Scraping API endpoint
- `next.config.ts` - Next.js configuration

### Ports

- **3000**: Next.js (main website)
- **5000**: Flask (scraping API)

### Admin Credentials

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env.local`, then run:

```bash
npm run db:create-admin
```

---

## ❓ Getting Help

### If You're Stuck:

1. **Check logs**: Look at terminal output
2. **Check browser console**: Press F12
3. **Check documentation**: Read files in `md/` folder
4. **Check existing code**: Look for similar features
5. **Ask team**: Reach out to other developers

### Common Questions

**Q: Do I need to restart Flask after code changes?**
A: Yes, Flask doesn't auto-reload. Restart with `CTRL+C` then `npm run flask:start`

**Q: Do I need to restart Next.js after code changes?**
A: No, Next.js auto-reloads. Just save your file.

**Q: Where do I add new components?**
A: `src/components/` folder. Create subfolders by feature.

**Q: How do I test scraping?**
A: Start Flask, then search on the website. Check Flask terminal for logs.

**Q: Can I run Flask and Next.js in same terminal?**
A: No, they need separate terminals. Use `&` to run in background (advanced).

---

## 🎉 You're Ready!

You now have everything you need to start working on Tawveeri. Remember:

1. **Start Flask first** (Terminal 1)
2. **Then start Next.js** (Terminal 2)
3. **Open browser** to `http://localhost:3000`
4. **Make changes** and see them update
5. **Check logs** if something doesn't work

**Happy coding!** 🚀

---

**Built with ❤️ for Saudi Arabia**

توفيري - وفر أكثر، اشتري أذكى
*Save More, Shop Smarter*
