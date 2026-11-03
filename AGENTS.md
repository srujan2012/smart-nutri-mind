<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Intelligence layer architecture
- All AI food suggestions pass through `src/lib/safety.ts` (allergen derivative filter + medical-claim scrub) before reaching any screen; never bypass it.
- Meal macros come from `src/lib/nutrition-engine.ts` (structured food-database rows) when ≥60% of items match and the engine agrees in magnitude with the AI estimate; otherwise the AI estimate is kept and labeled as such. Uncertainty ranges (`src/lib/uncertainty.ts`) must be shown, not hidden.
- Cross-screen data freshness is event-driven via `src/lib/app-events.ts` + the central AppShell subscription — emit events instead of ad-hoc invalidateQueries in components.
- Offline reads mirror through `src/lib/offline.ts` (`withOfflineCache`) and cached data must be labeled with its age.
