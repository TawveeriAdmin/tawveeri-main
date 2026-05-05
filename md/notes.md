# Etlaq Project - Client Meeting Questions & Discussion Points

**Date:** October 27, 2025  
**Project:** Price Comparison Platform - 10-Week Implementation  
**Meeting Purpose:** Requirements Clarification & Project Scope Discussion

---

## 1. Store Integration & Data Management

### Store Integration Strategy
- **API vs Web Scraping**: Will stores provide official APIs, or do we need to implement web scraping?
  - If web scraping: Are you aware of potential legal/terms-of-service issues?
  - If APIs: Do you have existing agreements with Extra, Jarir, Almanea, Noon, and Amazon.sa?
  - What's the data refresh frequency requirement (real-time vs hourly vs daily)?
  - What happens when stores change their website structure?

### Store Onboarding Portal
- Should stores be a separate user role with their own dashboard?
- What approval process for new stores joining the platform?
- Can stores update their own product feeds directly?
- Who manages store relationships and partnerships?

### Data Accuracy & Quality
- How do we handle price discrepancies or errors?
- What's the process for validating store data?
- Who's responsible for product catalog management?

---

## 2. User Authentication & Access

### Multiple Login Options
- Priority order for social login integration (Google, Apple ID, Facebook)?
  - Do we need all of them at launch, or can some be Phase 2?
  - Any preference based on Saudi user behavior?

### Guest Access
- What limitations should guest users have vs registered users?
- Can guests save wishlists/favorites?
- At what point do we encourage registration?

### Security & Privacy
- Any specific Saudi data privacy laws we must comply with?
- Password requirements and security standards?
- Two-factor authentication needed?

---

## 3. Notifications & Alerts

### Notification Channels
Which notification types for launch?
- **Email**: What service? (SendGrid, AWS SES, Mailgun, other?)
- **SMS**: What service? (Twilio, local Saudi provider like Unifonic, Oursms?)
- **Push Notifications**: Which service? (Firebase Cloud Messaging, OneSignal, other?)
- **In-App Notifications**: Should we build this?

### Notification Triggers
Confirm all scenarios:
- **Price drops**: What percentage/amount threshold triggers notification?
- **Back in stock**: Immediate notification?
- **Daily deals**: What time of day?
- **New offers/sales**: How frequently?

### User Control
- Can users customize notification preferences (frequency, channels, types)?
- Opt-in or opt-out by default?
- Notification settings per product or global?

---

## 4. Localization & Regional Requirements

### Language & Default Settings
- **Default Language**: Arabic or English as default? (Based on user location or browser?)
- Should users be able to switch languages easily?

### Currency Display
- Should we show SAR symbol differently for Arabic (ر.س) vs English (SAR)?
- Display format for large numbers? (1,000 vs ١٬٠٠٠)

### Date & Calendar
- **Date Format**: Preference between Hijri and Gregorian? Display both?
- Should users be able to choose their preferred calendar?
- How to handle date ranges and historical data?

### Legal Compliance
- Specific Saudi e-commerce regulations we must follow?
- Consumer protection laws relevant to price comparison?
- Do you have legal counsel reviewing this?
- Terms of service and privacy policy - who provides these?

---

## 5. Reviews & Ratings System

### Store Ratings
- **When can users rate stores?**
  - Only after purchase through your platform?
  - After viewing store page?
  - After clicking through to store?
  - Any verification needed?

### Rating Mechanics
- What's the rating scale? (1-5 stars, 1-10, thumbs up/down?)
- Can users edit their ratings?
- How long after purchase can they rate?

### Review Content
- **Product Reviews vs Store Reviews**: Which are we implementing?
  - Most stores only allow product reviews after purchase - how do we handle this?
  - Are we aggregating store-level reviews or product-level reviews?

### Moderation
- Who moderates reviews?
- What's the approval process?
- How do we handle fake or spam reviews?
- Can stores respond to reviews?

---

## 6. Monetization & Tracking

### Commission Tracking
- **How exactly will this work?**
  - Do you have affiliate agreements with stores?
  - What tracking mechanism? (affiliate links, unique IDs, UTM parameters?)
  - How do you track conversions and attribute sales?
  - What's the commission structure?

### Phase 2 Revenue
- When do you plan to start monetization?
- Commission rates agreed upon with stores?
- Alternative revenue streams? (premium listings, ads, subscriptions?)

### Analytics Requirements
- What metrics are critical for tracking?
- How detailed should conversion tracking be?
- Real-time analytics or daily reports?

---

## 7. Advanced Features - Priority Clarification

### Must-Have vs Nice-to-Have
Please help prioritize these features:

#### High Priority Questions:
- **Barcode/QR Scanner**: Is this essential for Week 10 launch?
  - Requires mobile app or camera web access
  - Development complexity is significant

- **Voice Search**: Priority level?
  - Requires significant development and testing
  - Arabic voice recognition is complex
  - Budget for speech-to-text APIs?

- **Price History Tracking**: How far back should we track?
  - Requires historical data storage and scraping
  - When do we start collecting data?
  - Display as graphs/charts?

- **AI Recommendations**: 
  - What AI service do you want? (OpenAI, AWS SageMaker, Google AI, local model?)
  - Budget for AI API calls?
  - What's the expected accuracy/quality?
  - Can we start with rule-based recommendations first?

### Mobile Applications
- **Native iOS/Android apps in Week 10 seems very aggressive**
  - Can we launch responsive web first, then native apps in Phase 2?
  - Or should we build progressive web app (PWA) instead?
  - What's the priority split between web and mobile?

### Multi-Store Cart
- Is this realistic for Phase 1?
- How would checkout work across multiple stores?
- This seems like a Phase 2+ feature - confirm?

---

## 8. Technical & Performance

### Performance Targets
- **3-second load time**: Across all stores simultaneously or per store?
- What happens if one store is slow?
- Acceptable timeout duration for store responses?

### Scalability
- **1M+ users**: What's the realistic user count at launch?
- Expected growth trajectory?
- Peak traffic expectations?

### Infrastructure
- **Preferred cloud provider**: AWS, Azure, Google Cloud, local Saudi hosting?
- Any data residency requirements for Saudi Arabia?
- Backup and disaster recovery requirements?

### Development Stack
- Any preference for technology stack?
  - Frontend: React, Vue, Next.js?
  - Backend: Node.js, Python, .NET?
  - Database: PostgreSQL, MySQL, MongoDB?

### Hosting & Budget
- What's the monthly hosting budget?
- Expected traffic and bandwidth requirements?
- CDN requirements for fast content delivery?

---

## 9. Timeline & Scope Reality Check

### 10-Week Timeline Assessment
**This timeline is extremely aggressive for all listed features (70+ requirements)**

#### Recommended Approach:
- **MVP (Minimum Viable Product) for Weeks 1-7:**
  - User accounts and authentication
  - Basic search and filtering
  - Store integration (3-5 stores initially)
  - Product comparison
  - Basic notifications
  - Responsive web interface

- **Phase 2 (Weeks 8-10 and beyond):**
  - Advanced features (AI, voice search, mobile apps)
  - Additional store integrations
  - Analytics and monetization
  - Enhanced personalization

### Feature Prioritization Exercise
Can we categorize each feature as:
- **P0**: Must have for launch
- **P1**: Important but can wait 1-2 months
- **P2**: Nice to have, Phase 2+

### Mobile App Development
- **Building native iOS + Android apps in parallel with web is unrealistic**
- **Recommendation**: 
  - Launch responsive web application first
  - Ensure excellent mobile web experience
  - Native apps as Phase 2 (3-4 months post-launch)
  - OR consider Progressive Web App (PWA) approach

---

## 10. Business & Operations

### Initial Setup
- **Product Catalog**: 
  - How many products at launch?
  - Who enters initial product data?
  - Data format and structure?

### Customer Support
- How will customer support work?
- In-house team or outsourced?
- Support channels: email, chat, phone?
- Expected response times?

### Content Management
- Who manages daily deals, coupons, and featured products?
- Content update frequency?
- Who has access to admin panel?

### Analytics & Reporting
- Who needs access to admin dashboard?
- What metrics are most important to you?
- Reporting frequency and format?

### Marketing & Launch
- Launch marketing strategy?
- How will you acquire initial users?
- Beta testing plan?
- Soft launch vs full launch?

---

## 11. Missing Critical Information

### Brand & Design
- Do you have brand guidelines, logo, color scheme?
- Any existing design mockups or wireframes?
- Design inspiration or competitor examples?

### Content & Copy
- Product descriptions and categories - who provides this?
- Website copy and marketing content?
- Arabic and English content - professional translation?

### Testing Strategy
- User acceptance testing (UAT) plan?
- Beta testing period duration?
- Target number of beta users?
- Testing environment setup?

### Legal & Documentation
- Terms of service and privacy policy - ready?
- Cookie consent and GDPR-like compliance?
- Intellectual property considerations?

---

## 12. Critical Path Items (Need Immediate Answers)

### Blockers That Could Delay Project:
1. **Store Integration Approach** - This affects entire architecture
2. **Hosting Infrastructure** - Need to set up immediately
3. **Third-party Service Accounts** - SMS, Email, Payment gateways
4. **Legal Documentation** - Cannot launch without T&C and Privacy Policy
5. **Initial Store Partnerships** - Need agreements before integration

