# Roadmap — Pre-launch fixes from the Nov 2026 deep review

Findings verified by code trace + live mobile pass (433×805). Fix top-down; items marked ⛔ are launch blockers.

## ⛔ Blockers
1. **Allergy vocabulary mismatch** — onboarding stores "Peanuts/Dairy/Eggs/Wheat-Gluten/Sulfites" but `src/lib/food-graph.ts` DERIVATIVES keys are "peanut/milk/egg/wheat/sulphites", so derivative filtering silently does nothing for those allergies. Normalize labels↔keys (or canonicalize on save + at check time).
2. **Allergy filter not applied on all AI food paths** — fridge recipes/groceries, planner meals, grocery substitutes, coach briefing text, chat prose, athlete travel advice ("Nuts… jerky/paneer"), coach budget staples (peanuts/curd/eggs), and graph complements (pairing not checked, only source food) reach users unfiltered. Route everything through `src/lib/safety.ts` / allergen check at save-or-render time.
3. **Teen calorie floor is wrong** — `nutrition-targets.ts` applies adult −500 kcal loss target with no age<18 branch or calorie floor; adaptive teen floor is 90% of an already-deficited baseline. Clamp: no deficit target for minors + absolute floor (e.g. 1500/1200) on every saved target path (onboarding, settings).
4. **Scan shows ranges from a rejected engine calc** — when `engineAgreesWithAi` fails, AI totals are kept but `engine.ranges` still displayed (may not contain the shown totals). Show AI-derived bands or recompute ranges for the adopted source.
5. **Account deletion incomplete** — `account.functions.ts` deletes only 5 tables + profile + auth user; health reports/consents/flags, training plans, plan adjustments and storage files remain. Add full deletion incl. storage objects, checked failures; also clear browser caches on logout.
6. **health-reports bucket privacy unverified** — storage policies are owner-scoped in code, but no migration sets the bucket private. Verify deployed bucket `public=false`, codify in migration.
7. **AI consent not enforced** — `consent_ai` toggle exists but no server path checks it (defaults true). Enforce before sending photos/profile data; check in every gateway-calling server fn that uses personal data.

## High
8. Scan "verified food-database entries" copy shows even when matched rows are unverified (`verified=false` seeded rows exist). Gate the copy on actual verification or say "database-matched".
9. Health report deletion checks only the final DB delete — a failed storage-object delete silently leaves the document. Check every result; add compensating cleanup for orphaned uploads.
10. Data export covers only 6 tables, swallows errors, may truncate at API row limit. Include health/coach/training tables + storage files, paginate, surface errors.
11. Browser caches (offline.ts, React Query, health keys) are not user-scoped and survive logout/account switch — namespace by user id and clear on sign-out.
12. Onboarding "Edit" re-opens with allergies reset to [] and saves them — hydrate existing values before save (data-loss risk).

## Medium (mobile)
13. Bottom nav: 15 destinations in one horizontal scroll, no "More" affordance — Coach/Health/Habits/Settings off-screen at 433px; last items clipped. Primary 5 tabs + More sheet.
14. Sub-44px tap targets: scan add-on Confirm/Cancel (~23px), health reminder/delete, athlete schedule buttons, insights range tabs, sign-out. Add min-h-11 / min-w-11.
15. Fridge "Retake" doesn't reset file inputs → same file re-picked won't fire onChange (scan.tsx already resets; mirror it).
16. Scan add-on confirmation squeezes description into narrow side column on mobile — stack vertically <sm; enlarge buttons.
17. iOS input focus zoom: text-sm (14px) inputs on scan/fridge/athlete/coach — raise to ≥16px.
18. Camera permission/mic failure has no recovery guidance; speech errors silently stop listening. Add toasts with gallery/settings guidance.

## Low
19. Health extracted-values table: horizontal scroll without hint; add word-break + scroll cue.
20. Lightbox: no focus trap/background scroll lock; close button small & not safe-area aware.
21. Insights "no AI guesses" copy is wrong for nutrition charts (logs contain AI estimates); reword.
22. Insights scenario slider allows −500 kcal at any age (display-only; still gate for minors).
23. Meal-photo lightbox: allow browser-zoom semantics / larger close target.

## Verified OK
- All 21 public tables have RLS + owner-scoped policies (only foods/exercises/sports public-read, intentional).
- No secrets in client bundle; auth middleware verifies tokens server-side.
- Linter: no findings; quick security scan: only the 3 intentional public reference tables (info).
- No horizontal overflow or console errors on 10 routes at 433×805.
- Deep security scan running in background (results in Security view).

## Current work
- [ ] Apply a consistent teen calorie floor to every target-generation and target-save path.
- [ ] Canonicalize allergy labels and enforce allergy checks across all food suggestions.
