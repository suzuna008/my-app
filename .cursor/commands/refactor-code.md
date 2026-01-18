Refactor / consolidate / unify code that should obviously be modular (but don't over-do it).

Heuristics:
  - Split files with over 500 lines into modular components and files that have high internal coordination but otherwise a simple external interface
  - Single source of truth: from Supabase -> Svelte state -> UI
  - Bias towards code that is easy to reason about, and fails fast (instead of lots of defensive checks)
  - No useless comments, unless they're truly impactful
  - In general, the fewer the lines, the less code, the better.