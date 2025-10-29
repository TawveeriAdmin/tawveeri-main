🔴 THEME ISSUE DIAGNOSIS - ROOT CAUSE IDENTIFIED

  Critical Problems Found

  1. Missing Color Definitions in @theme Section

  Location: src/app/globals.css lines 12-68

  Problem: Your @theme section ONLY defines:
  - ✅ primary colors (50-950)
  - ✅ success colors (50-950)
  - ✅ warning colors (50-950)
  - ✅ featured colors (50-950)

  What's MISSING:
  - ❌ NO gray colors (50, 100, 200... 900, 950)
  - ❌ NO blue colors
  - ❌ NO green colors
  - ❌ NO amber colors
  - ❌ NO white/black defined

  2. Landing Page Uses Undefined Colors

  Location: src/app/[locale]/landing-client.tsx

  Line 61 (Main container):
  className="min-h-screen bg-gradient-to-b from-white via-gray-50 to-blue-50
             dark:from-gray-950 dark:via-gray-900 dark:to-gray-900"

  Line 503 (How It Works section):
  className="py-32 bg-gradient-to-br from-blue-50 via-green-50 to-amber-50
             dark:from-gray-950 dark:via-gray-900 dark:to-gray-950"

  The Problem: gray-950, gray-900, gray-50, blue-50, green-50, amber-50 are NOT defined in
  your @theme!

  3. Tailwind CSS v4 OKLCH Color Space Issue

  Why This Causes Dark Colors in Light Mode:

  1. Tailwind v4 Default Behavior: When you use a color class that's not defined in @theme,
   Tailwind v4 generates it using the OKLCH color space
  2. OKLCH Colors Render Differently: OKLCH colors can appear:
    - Darker than expected
    - With unexpected hue shifts
    - Inconsistent across browsers
  3. Your Overrides Don't Work on Gradients: Your globals.css has extensive overrides
  starting at line 75:
  html:not(.dark) .bg-gray-50 {
    background-color: #f9fafb !important;
  }

  3. BUT these overrides:
    - ❌ Don't apply to gradient color stops (from-gray-50, via-gray-900, to-blue-50)
    - ❌ Only work on direct background classes (bg-gray-50)
    - ❌ Don't cover gray-900, gray-950 which aren't defined

  4. The Cascade Failure

  Here's what happens when the page loads in LIGHT MODE:

  1. Browser applies: bg-gradient-to-b from-white via-gray-50 to-blue-50
                                        ↓         ↓          ↓
  2. Tailwind v4 looks up colors:      ✅ defined  ❌ not defined  ❌ not defined
                                       (exists)   (OKLCH fallback) (OKLCH fallback)

  3. Result: White → Dark OKLCH gray → Dark OKLCH blue
             ✅       ❌ DARK!          ❌ DARK!

  4. Your override attempts:   html:not(.dark) .bg-gray-50 { ... }
                              ↓
                              ❌ DOESN'T MATCH because it's "from-gray-50" not "bg-gray-50"

  Why Text Also Appears Dark

  Many text colors use undefined grays:
  - Line 194: text-gray-900 dark:text-white - gray-900 undefined, renders as OKLCH
  - Line 230: text-gray-900 dark:text-white - Same issue

  Why Your Override Strategy Failed

  Your globals.css attempts to override colors with !important, but:

  1. Incomplete Coverage: Only overrides ~40-50 specific utility classes
  2. No Gradient Support: Gradient stop classes like from-*, via-*, to-* are NOT covered
  3. Missing Colors: Doesn't define gray-900, gray-950, or other colors used in gradients
  4. Wrong Selector: Overrides bg-gray-50 but code uses from-gray-50

  Evidence Summary

  | File                   | Issue                           | Impact
           |
  |------------------------|---------------------------------|-----------------------------
  ---------|
  | globals.css:12-68      | No gray colors in @theme        | All gray usage falls back to
   OKLCH   |
  | globals.css:12-68      | No blue/green/amber defined     | Gradient sections render
  incorrectly |
  | landing-client.tsx:61  | Uses blue-50 (undefined)        | Hero gradient appears dark
           |
  | landing-client.tsx:503 | Uses green-50, amber-50         | Section gradients dark
           |
  | landing-client.tsx:61  | Uses gray-950, gray-900         | Even light mode gets dark
  colors     |
  | globals.css:75-427     | Overrides don't cover gradients | No effect on gradient stops
           |

  ---
  The Root Cause in One Sentence

  Your @theme section doesn't define gray, blue, green, or amber colors, so Tailwind v4 
  generates them using OKLCH color space which renders as dark colors, and your CSS 
  overrides don't apply to gradient color stops (from-*, via-*, to-*).

  ---
  Would you like me to provide the fixes for these issues? I can:
  1. Add missing color definitions to @theme
  2. Fix the gradient usage
  3. Ensure proper light/dark mode rendering
