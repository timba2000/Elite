---
name: elite-todo
description: Add a feature idea to the Elite game roadmap (elite_todo.md). Use whenever Tim says "add to the elite todo", "add to the todo list", "add to the roadmap", "todo: ...", or describes a gameplay feature idea for the Elite game that should be captured for later rather than built now.
argument-hint: <feature idea>
---

# Add an item to the Elite feature todo list

The roadmap lives in `elite_todo.md` on the `worktree-elite-todo` branch. It is a
curated game-design document, not a scratchpad — every entry is written in a house
style and filed under a themed section.

## 1. Locate the file

Check in this order:

1. `elite_todo.md` at the repo root of the current checkout (in case the branch was
   merged to main).
2. `.claude/worktrees/elite-todo/elite_todo.md` — the `worktree-elite-todo` worktree.
   Confirm with `git worktree list`.
3. If neither exists, recreate the worktree from the remote branch:
   `git fetch origin worktree-elite-todo` then
   `git worktree add .claude/worktrees/elite-todo worktree-elite-todo`.

## 2. Understand the idea, then file it

Read the whole file first. The document's framing: the core loop is
**trade → earn credits → upgrade → trade bigger**, and every feature should feed that
loop or add a new way to earn.

Pick the best-fitting numbered section:

1. Trading depth · 2. Ship upgrades & progression · 3. Ways to earn beyond trading ·
4. Combat & danger · 5. World & exploration · 6. Reputation & factions ·
7. Character progression (levels & skills) · 8. Friends, crew & the player's company ·
9. Quality of life / meta

Only if the idea genuinely fits none of them, add a new numbered section just before
the "Suggested build order" heading.

Before adding, scan for an existing entry that already covers the idea — if one does,
extend that entry instead of duplicating it.

## 3. Write the entry in house style

Format (match the file exactly):

```
- [ ] **Feature name** — one to three lines of concrete game-design detail: what the
      player does, what it costs or risks, and what it feeds into
```

- Bold name, spaced em dash, wrap near 90 columns with 6-space continuation indent.
- Flesh out a terse idea into a real design note — mechanics, numbers where natural,
  and the hook back to the core loop. Match the specificity of neighboring entries.
- Cross-reference related sections with `(§N)` when the feature depends on or feeds
  another one, as existing entries do.
- Do NOT touch the "Suggested build order" list unless Tim explicitly asks; if the new
  feature obviously belongs in it, mention that in your reply instead of editing it.

## 4. Commit and push

If the file is in the `elite-todo` worktree, commit there on its branch and push:

```
git -C .claude/worktrees/elite-todo add elite_todo.md
git -C .claude/worktrees/elite-todo commit -m "Add <feature name> to Elite todo"
git -C .claude/worktrees/elite-todo push origin worktree-elite-todo
```

If the file is at the repo root on main instead, follow the normal rules for the
session (isolate/branch before committing; never commit directly to main from a
background job without a worktree).

## 5. Confirm

Reply with the section it was filed under and the exact entry text as added, so Tim
can see how the idea was phrased.
