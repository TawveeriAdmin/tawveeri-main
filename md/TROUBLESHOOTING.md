# Troubleshooting Guide

Common issues and solutions for Tawveeri setup and development.

## Database Connection Issues

### Error: "Network is unreachable" (IPv6 Issue)

**Problem:**
```bash
psql: error: connection to server at "db.xxxxx.supabase.co" (2406:da1c:...) failed: Network is unreachable
```

This happens when your system tries to connect via IPv6 but doesn't have IPv6 configured.

**Solution 1: Use Connection Pooler (Recommended)**

Instead of the direct database URL, use Supabase's connection pooler which works better with IPv4:

1. Go to Supabase Dashboard → **Settings** → **Database**
2. Scroll to **Connection string** section
3. Select **Connection pooling** → **Transaction mode**
4. Copy the **URI** (it will have `6543` as port instead of `5432`)
5. Update your `.env.local`:

```bash
# Use this format (note port 6543):
SUPABASE_DB_URL=postgresql://postgres.xxxxx:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
```

**Solution 2: Force IPv4**

Add `-4` flag to psql commands in the scripts:

Edit `scripts/setup-database.sh` and replace `psql` with `psql -4`:

```bash
# Before
psql "$SUPABASE_DB_URL" -f scripts/database/01-schema.sql

# After
psql -4 "$SUPABASE_DB_URL" -f scripts/database/01-schema.sql
```

**Solution 3: Use Supabase SQL Editor**

If psql connection continues to fail:

1. Go to Supabase Dashboard → **SQL Editor**
2. Click **New query**
3. Copy contents of each SQL file and run them:
   - Copy `scripts/database/01-schema.sql` → Run
   - Copy `scripts/database/02-rls-policies.sql` → Run
   - Copy `scripts/database/03-seed-data.sql` → Run

### Error: "Connection refused"

**Problem:**
```bash
psql: error: connection to server failed: Connection refused
```

**Solutions:**

1. **Check your database password**
   - Make sure you're using the correct password from Supabase
   - Password should be URL-encoded in the connection string

2. **Verify project is active**
   - Go to Supabase Dashboard
   - Ensure your project status is "Active"
   - If paused, resume it

3. **Check database URL format**
   ```bash
   # Correct format:
   postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres

   # Make sure:
   # - No spaces
   # - Password is correct
   # - Host is correct
   ```

### Error: "psql: command not found"

**Problem:**
PostgreSQL client not installed.

**Solutions:**

**macOS:**
```bash
brew install postgresql@15
# Add to PATH
echo 'export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install postgresql-client
```

**Windows:**
1. Download PostgreSQL from [postgresql.org](https://www.postgresql.org/download/windows/)
2. Or use WSL (Windows Subsystem for Linux):
   ```bash
   wsl --install
   # Then follow Ubuntu instructions
   ```

## Environment Configuration Issues

### Error: "Missing Supabase environment variables"

**Problem:**
App can't find Supabase credentials.

**Solutions:**

1. **Ensure `.env.local` exists:**
   ```bash
   # Copy example file
   cp .env.example .env.local
   ```

2. **Fill in all required variables:**
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
   SUPABASE_DB_URL=postgresql://...
   ```

3. **Get values from Supabase:**
   - Go to **Settings** → **API**
   - Copy URL and keys
   - For DB URL: **Settings** → **Database** → Connection string

4. **Restart dev server:**
   ```bash
   # Stop with Ctrl+C, then:
   npm run dev
   ```

### Error: ".env.local not loading"

**Problem:**
Environment variables not available in app.

**Solutions:**

1. **Restart development server** (must do after changing .env files)
2. **Check file is named correctly:** `.env.local` (not `env.local`)
3. **Check file location:** Must be in project root
4. **Don't use quotes:**
   ```bash
   # Correct:
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co

   # Wrong:
   NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"
   ```

## SQL Script Errors

### Error: "relation already exists"

**Problem:**
Trying to create tables that already exist.

**Solution:**

Drop all tables first via Supabase SQL Editor:

```sql
-- WARNING: This deletes all data!
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
```

Then re-run setup:
```bash
npm run db:setup
```

### Error: "permission denied"

**Problem:**
Not enough privileges to create tables.

**Solutions:**

1. **Use service role key** in `.env.local`
2. **Check Supabase project** is active
3. **Use SQL Editor** in Supabase Dashboard instead

## Authentication Issues

### Can't Login as Admin

**Problem:**
Admin authentication fails even with correct credentials.

**Solutions:**

1. **Verify user created in Supabase Auth:**
   - Go to **Authentication** → **Users**
   - Should see: `jfr3sam@gmail.com`
   - If not there, create it manually

2. **Create admin user:**
   - Click **Add user** in Supabase Auth
   - Email: `jfr3sam@gmail.com`
   - Password: `E1s2a3m4@`
   - **Auto Confirm User:** ✅ Check this!

3. **Check email verified:**
   - User should show "Verified" status
   - If not, click user → Confirm email

4. **Try password reset:**
   - If login still fails, use "Forgot password" flow

## Development Server Issues

### Error: "Port 3000 already in use"

**Problem:**
Another process is using port 3000.

**Solutions:**

**Option 1: Kill existing process**
```bash
# macOS/Linux:
lsof -ti:3000 | xargs kill -9

# Or:
killall node
```

**Option 2: Use different port**
```bash
PORT=3001 npm run dev
```

### Error: "Module not found"

**Problem:**
Dependencies not installed or corrupted.

**Solutions:**

1. **Reinstall dependencies:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Clear Next.js cache:**
   ```bash
   rm -rf .next
   npm run dev
   ```

## Build Issues

### Error: "Type errors"

**Problem:**
TypeScript compilation errors.

**Solutions:**

1. **Check database types are generated:**
   - File should exist: `src/lib/database/types.ts`
   - If missing, create it from `scripts/database/01-schema.sql`

2. **Clear TypeScript cache:**
   ```bash
   rm -rf .next tsconfig.tsbuildinfo
   npm run build
   ```

### Error: "Out of memory"

**Problem:**
Build process runs out of memory.

**Solutions:**

1. **Increase Node memory:**
   ```bash
   export NODE_OPTIONS="--max-old-space-size=4096"
   npm run build
   ```

2. **Update package.json:**
   ```json
   "scripts": {
     "build": "NODE_OPTIONS='--max-old-space-size=4096' next build"
   }
   ```

## Supabase Issues

### Error: "Project paused"

**Problem:**
Supabase free tier project auto-paused due to inactivity.

**Solutions:**

1. Go to Supabase Dashboard
2. Click **Resume project**
3. Wait ~2 minutes for restart
4. Re-run setup if needed

### Error: "Too many connections"

**Problem:**
Database connection limit reached.

**Solutions:**

1. **Use connection pooling** (see IPv6 issue solution above)
2. **Close unused connections** in other apps
3. **Upgrade Supabase plan** if consistently hitting limit

## Testing Issues

### Tests fail to connect

**Problem:**
Test files can't connect to database.

**Solutions:**

1. **Ensure `.env.local` is loaded:**
   ```bash
   # Add to test command
   npm test -- --env=./.env.local
   ```

2. **Check test environment:**
   - Tests need same environment variables
   - May need separate test database

## Performance Issues

### Slow query performance

**Problem:**
Queries taking too long.

**Solutions:**

1. **Check indexes exist:**
   - Run `01-schema.sql` to ensure all indexes created

2. **Use EXPLAIN in SQL Editor:**
   ```sql
   EXPLAIN ANALYZE
   SELECT * FROM products WHERE category = 'smartphone';
   ```

3. **Enable query insights:**
   - Supabase Dashboard → **Database** → **Query Performance**

## Getting More Help

If issues persist:

1. **Check Supabase Status:** [status.supabase.com](https://status.supabase.com/)
2. **Review Logs:**
   - Supabase Dashboard → **Logs**
   - Browser console (F12)
   - Terminal output

3. **Check Documentation:**
   - `README.md` - Project overview
   - `md/DATABASE_SETUP.md` - Detailed setup
   - `scripts/README.md` - Scripts info

4. **Common Resources:**
   - [Supabase Docs](https://supabase.com/docs)
   - [Next.js Docs](https://nextjs.org/docs)
   - [PostgreSQL Docs](https://www.postgresql.org/docs/)

## Quick Fixes Checklist

When something doesn't work, try these in order:

- [ ] Restart development server
- [ ] Clear `.next` folder: `rm -rf .next`
- [ ] Reinstall dependencies: `rm -rf node_modules && npm install`
- [ ] Check `.env.local` has all values
- [ ] Verify Supabase project is active
- [ ] Check database connection URL is correct
- [ ] Try using connection pooler URL
- [ ] Clear browser cache
- [ ] Check for typos in environment variables
- [ ] Review Supabase logs for errors

## Still Having Issues?

1. Check all files are in correct locations
2. Verify all steps in `md/DATABASE_SETUP.md` were completed
3. Review error messages carefully
4. Try setup on a different network (sometimes firewall/proxy issues)
5. Use Supabase SQL Editor as alternative to psql
