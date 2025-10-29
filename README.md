# توفيري Tawveeri - Price Comparison Platform

> منصة مقارنة الأسعار للإلكترونيات في المملكة العربية السعودية
>
> Saudi Arabia's Premier Electronics Price Comparison Platform

[![Next.js](https://img.shields.io/badge/Next.js-16.0-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-green)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8)](https://tailwindcss.com/)

## 🎯 Project Overview

Tawveeri is a comprehensive price comparison platform that enables customers in Saudi Arabia to compare prices of electronic devices across multiple stores including Extra, Jarir, Noon, Amazon.sa, and Almanea.

### Key Features

- 🔍 **Smart Search** - Category-based search with advanced filtering
- 💰 **Price Comparison** - Real-time price comparison across stores
- 📊 **Price History** - Track price trends over time
- 🔔 **Price Alerts** - Get notified when prices drop
- ⭐ **Store Reviews** - Rate and review stores
- 🌐 **Bilingual** - Full Arabic (RTL) and English (LTR) support
- 📱 **Responsive** - Works perfectly on mobile and desktop
- 🎨 **Modern UI** - 33 production-ready components

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ ([Download](https://nodejs.org/))
- PostgreSQL Client (`psql`) ([Install Guide](https://www.postgresql.org/download/))
- Supabase Account ([Sign up](https://supabase.com/))

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd tawveeri
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your Supabase credentials
   ```

4. **Setup database:**
   ```bash
   npm run db:setup
   ```

5. **Start development server:**
   ```bash
   npm run dev
   ```

6. **Visit:** [http://localhost:3000](http://localhost:3000)

📚 **For detailed setup instructions, see:** [`md/DATABASE_SETUP.md`](./md/DATABASE_SETUP.md)

## 📁 Project Structure

```
tawveeri/
├── src/
│   ├── app/                    # Next.js app router pages
│   │   ├── globals.css        # Global styles & theme
│   │   ├── layout.tsx         # Root layout
│   │   └── providers/         # Context providers
│   ├── components/
│   │   ├── ui/                # 33 base UI components
│   │   ├── comparison/        # Price comparison components
│   │   ├── layout/            # Layout components
│   │   └── common/            # Shared components
│   ├── lib/
│   │   ├── database/          # Supabase client & types
│   │   └── utils.ts           # Utility functions
│   └── config/                # App configuration
│
├── scripts/
│   ├── database/              # SQL scripts
│   │   ├── 01-schema.sql     # Database schema
│   │   ├── 02-rls-policies.sql # Security policies
│   │   └── 03-seed-data.sql  # Sample data
│   ├── setup-database.sh      # Main setup script
│   └── README.md             # Scripts documentation
│
├── tests/
│   └── database/              # Database tests
│
├── md/                        # Documentation
│   ├── DATABASE_SETUP.md      # Setup guide
│   ├── WEEK1_COMPLETION.md    # Week 1 report
│   └── COMPLETE-COMPONENT-LIBRARY.md
│
└── public/                    # Static assets
```

## 🛠️ Tech Stack

### Frontend
- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **UI Components:** Radix UI + shadcn/ui patterns
- **Icons:** Lucide React
- **Fonts:** IBM Plex Sans Arabic, Inter

### Backend
- **Database:** PostgreSQL (via Supabase)
- **Authentication:** Supabase Auth
- **Storage:** Supabase Storage
- **Real-time:** Supabase Realtime

### Features
- **Internationalization:** Built-in RTL/LTR support
- **Theme:** Dark/Light mode with next-themes
- **Type Safety:** Full TypeScript coverage
- **Security:** Row-Level Security (RLS)

## 📋 Available Scripts

### Development
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

### Database
```bash
npm run db:setup     # Complete database setup
npm run db:schema    # Create schema only
npm run db:policies  # Apply RLS policies only
npm run db:seed      # Insert sample data only
```

## 🗄️ Database

### Tables
- **users** - User accounts & profiles
- **stores** - Electronic stores
- **products** - Product catalog
- **product_stores** - Pricing & availability
- **price_history** - Historical prices
- **user_wishlists** - Saved products
- **search_history** - Search analytics
- **transactions** - Commission tracking
- **store_reviews** - Store ratings
- **notifications** - User notifications
- **price_alerts** - Price drop alerts
- **admin_logs** - System logs

### User Roles
- **Admin** - Full system access
- **Customer** - Browse, compare, save products
- **Store** - Manage store listings
- **Guest** - Anonymous browsing

## 🔐 Admin Access

**Email:** jfr3sam@gmail.com
**Password:** E1s2a3m4@

⚠️ **Important:** Change these credentials in production!

## 📱 Features by Week

### ✅ Week 1 - Foundation (Complete)
- Database schema design
- Security implementation (RLS)
- User roles setup
- Sample data
- Development environment

### 🚧 Week 2 - Authentication (In Progress)
- User registration (Email/Phone/Google)
- Guest access
- Account management
- Legal compliance

### 📅 Upcoming Weeks
- Search & Filtering (Week 3)
- Store Integration (Week 4)
- Product Experience (Week 5)
- Personalization (Week 6)
- Notifications (Week 7)
- Analytics (Week 8)
- Advanced Comparison (Week 9)
- Launch (Week 10)

## 🌍 Localization

Tawveeri supports both Arabic and English:

- **Default:** Arabic (RTL)
- **Secondary:** English (LTR)
- **Automatic:** Font and direction switching
- **Persistent:** Language preference saved

## 🎨 UI Components

33 production-ready components including:
- **Forms:** Button, Input, Select, Checkbox, Radio, Switch, Slider
- **Layout:** Card, Tabs, Accordion, Breadcrumb, Table, Pagination
- **Feedback:** Badge, Alert, Progress, Skeleton, Spinner
- **Overlays:** Dialog, Dropdown, Tooltip, Popover, Command
- **Notifications:** Toast system

📚 **See full component library:** [`md/COMPLETE-COMPONENT-LIBRARY.md`](./md/COMPLETE-COMPONENT-LIBRARY.md)

## 🧪 Testing

```bash
npm test                     # Run all tests
npm test tests/database/     # Run database tests
```

## 📚 Documentation

- **[Database Setup Guide](./md/DATABASE_SETUP.md)** - Complete database setup
- **[Week 1 Report](./md/WEEK1_COMPLETION.md)** - Foundation completion
- **[Component Library](./md/COMPLETE-COMPONENT-LIBRARY.md)** - UI components
- **[Setup Complete](./md/SETUP-COMPLETE.md)** - Initial setup details
- **[Scripts Documentation](./scripts/README.md)** - Database scripts
- **[CLAUDE.md](./CLAUDE.md)** - AI assistant guidance

## 🎯 Target Market

- **Location:** Saudi Arabia
- **Categories:** Laptops, TVs, Smartphones, Tablets, Audio, Gaming
- **Stores:** Extra, Jarir, Almanea, Noon, Amazon.sa
- **Currency:** SAR (Saudi Riyal)
- **Languages:** Arabic (primary), English

## 🔒 Security

- **SSL/TLS:** All connections encrypted
- **RLS:** Row-Level Security on all tables
- **Auth:** Secure multi-provider authentication
- **Compliance:** Saudi data privacy laws
- **Accessibility:** WCAG 2.1 compliant

## 🚀 Performance

- **Load Time:** < 3 seconds target
- **Scalability:** Designed for 1M+ users
- **Uptime:** 99.9% target
- **Optimization:** Turbopack, code splitting, caching

## 📊 Monetization

### Phase 1: Growth
- Focus on user acquisition
- Build store partnerships
- Establish market presence

### Phase 2: Profitability
- Commission-based revenue
- Premium store listings
- Loyalty programs
- Sponsored placements

## 🤝 Contributing

This is a private project. For team members:

1. Create feature branch
2. Make changes
3. Test thoroughly
4. Submit pull request

## 📄 License

Private - All rights reserved

## 📞 Support

For issues or questions:
- Check documentation in `md/` folder
- Review `scripts/README.md` for database help
- Check Supabase dashboard for logs

## 🎉 Current Status

**Week 1: Complete ✅**
- Database fully configured
- Security implemented
- Sample data loaded
- Development ready

**Next: Week 2** - User Authentication

---

**Built with ❤️ for Saudi Arabia**

توفيري - وفر أكثر، اشتري أذكى
