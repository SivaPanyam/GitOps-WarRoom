# Dynamic Context-Aware Terminal Tab-Completion

1-2 sentence summary: Implement an intelligent, context-aware tab-completion engine and keyboard-navigable autocomplete popup for the GitOps WarRoom interactive terminal that dynamically queries repository state (branches, tags, files, commits, and subcommands).

## User Review & Critical Decisions

> [!IMPORTANT]
> The following design decisions were confirmed during the Phase 1 questionnaire and will govern the implementation:

- **Confirmed Decision 1 (Display Format)**: Interactive popup dropdown positioned directly above the input prompt with keyboard navigation (`Tab`, `Shift+Tab`, `ArrowUp`, `ArrowDown`, `Enter`, `Escape`).
- **Confirmed Decision 2 (Filtering Strategy)**: Subcommand-aware contextual filtering (e.g., `git checkout` suggests local/remote branches and tags; `git add` suggests modified/untracked files; `git cherry-pick` / `revert` suggests commit SHAs; `git push` suggests remotes and branches).
- **Confirmed Decision 3 (Empty Prompt Behavior)**: Pressing `Tab` on an empty command line displays common Git commands and scenario-specific shortcuts for fast onboarding.

---

## 1. Overview & Core Concept

### What It Does
When the developer interacts with the bottom-left terminal pane, pressing `Tab` or typing triggers an interactive suggestion menu that dynamically resolves:
1. **Git Subcommands**: `status`, `log`, `branch`, `checkout`, `switch`, `add`, `commit`, `rebase`, `cherry-pick`, `reset`, `revert`, `bisect`, `stash`, `tag`, `fetch`, `pull`, `push`.
2. **Dynamic Repository Branches**: All active local branches (e.g., `main`, `fix/null-wallet-guard`, `feature/payments`) and remote branches (`origin/main`, `origin/feature/payments`).
3. **Repository Tags & Revisions**: Tags (`v2.1.0`, `v2.1.1`), `HEAD`, `HEAD~1`, and reflog references.
4. **Workspace Files**: Tracked, modified, conflicted, and unstaged files filtered specifically when the command targets paths (e.g., `git add`, `git diff`, `git rm`, `cat`).
5. **Commit SHAs**: Suggests 7-character commit hashes with commit message titles when running `git cherry-pick`, `git revert`, `git reset`, or `git show`.

### Target Audience & Value
Engineers debugging high-stakes production incidents in the War Room can navigate complex branch names and revision hashes rapidly without typos or memorization overhead.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Empty Prompt Tab Trigger**:
   - User clicks into the terminal and presses `Tab`.
   - A sleek floating popup menu appears above the prompt displaying categorized suggestions (`command`, `scenario shortcut`).
2. **Context-Aware Subcommand Completion**:
   - User types `git switch ` or `git checkout ` and presses `Tab`.
   - The popup filters dynamically to show current branch candidates with active branch indicators and remote tracking refs.
3. **Keyboard Navigation & Insertion**:
   - User presses `ArrowDown` or `Tab` to cycle suggestions, or clicks an item with the mouse.
   - Pressing `Enter` or `Tab` completes the token into the input buffer and positions the caret.
   - Pressing `Escape` or typing a non-matching character cleanly dismisses the dropdown.

### Visual Identity & Theme
- **Color Palette & Styling**:
  - Background: `#0D131F` / `rgba(13, 19, 31, 0.95)` with backdrop blur and hairline border `border-slate-800`.
  - Selection: Active candidate highlighted with `bg-sky-500/15 border-sky-500/30 text-sky-200`.
  - Category Labels: Clean unboxed metadata in monospace (`branch` in sky-400, `tag` in amber-300, `command` in emerald-400, `file` in purple-400, `commit` in slate-400).
- **Typography**: Strict tabular monospace numbers and `JetBrains Mono` font tokens.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Floating Popover vs. In-Terminal Text Spilling**
  - *Chosen Approach*: Floating dropdown above the input line with maximum height limit (6 items visible with smooth scroll).
  - *Why*: Preserves terminal log scroll history readability and avoids cluttering terminal standard output buffer with transient completion lists.
- **Decision 2: Tokenizer Logic**
  - *Chosen Approach*: Split input by whitespace while preserving leading command context and quote handling.
  - *Why*: Ensures multi-word commands (like `git checkout -b <branch>` or `git push origin <branch>`) accurately identify the target token being autocompleted.

---

## 4. Technical Architecture & Component Structure

```
┌─────────────────────────────────────────────────────────────┐
│                       useGitStore                           │
│  - repo.branches, repo.tags, repo.remote, repo.commits      │
│  - repo.workingTree, repo.conflictedFiles                   │
│  - activeScenario.optimalCommands                           │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 getAutocompleteSuggestions                  │
│  (Input parser & context-aware repository state resolver)   │
│   - Tokenizes current input line                            │
│   - Identifies active subcommand & argument position        │
│   - Filters candidates (commands / branches / files / SHAs) │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                        Terminal.tsx                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │   AutocompletePopup (Floating dropdown above input)   │  │
│  │   - Keyboard nav (Up/Down/Tab/Enter/Escape)           │  │
│  │   - Categorized badges (branch, cmd, file, tag)       │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │   Terminal Input Row with active branch indicator     │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### State & Handler Interactions
1. `Terminal.tsx`:
   - State for `suggestions: AutocompleteItem[]`, `selectedSuggestionIndex: number`, `isPopupOpen: boolean`.
   - `handleKeyDown`: Intercepts `Tab`, `ArrowUp`, `ArrowDown`, `Enter`, and `Escape` when popup is open.
   - `applySuggestion(item: AutocompleteItem)`: Replaces the active trailing token or appends to the input string, closes popup, and refocuses input.
