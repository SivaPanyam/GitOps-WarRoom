# GitOps WarRoom

GitOps WarRoom is an interactive, browser-based Git incident simulator. It lets engineers practise resolving realistic production Git and GitHub incidents without touching a real repository or remote.

The app places you in an on-call "war room": read the incident briefing, inspect the repository state, run Git commands in a simulated terminal, and watch validation checks and CI results respond to your decisions.

## What it teaches

The simulator includes 14 scenarios across junior, mid-level, and senior/staff difficulty levels. Exercises cover common high-pressure workflows, including:

- resolving merge and rebase conflicts
- recovering from a botched rebase with `git reflog`
- removing leaked credentials and repairing history
- using `git bisect` to isolate a regression
- cherry-picking hotfixes and backporting security patches
- safely updating branches with `--force-with-lease`
- fixing GitHub push rejections caused by oversized files
- synchronizing forks and rebasing pull-request branches
- cutting and publishing release tags

## How it works

Each scenario starts with a fresh, in-memory repository state. The interface provides:

- an incident dashboard with Slack-style context, Jira acceptance criteria, hints, and post-mortem guidance
- a Git terminal with command autocomplete and scenario-aware command handling
- a conflict editor for resolving files and staging changes
- a live commit DAG, branch, tag, and remote visualizer
- an inspector for working tree, staging area, Git internals, reflog activity, and simulated CI/CD checks
- assertions and badges that track successful recovery steps

Commands affect only the simulator's state in your browser. They do **not** execute against your local Git repository or push to GitHub.

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 20 or later
- npm

### Install and run

```bash
git clone https://github.com/SivaPanyam/GitOps-WarRoom.git
cd GitOps-WarRoom
npm install --legacy-peer-deps
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:3000`).

`--legacy-peer-deps` is currently needed because the dependency ranges in this project produce an npm peer-dependency resolution conflict.

## Available scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server on port 3000. |
| `npm run build` | Create a production build in `dist/`. |
| `npm run preview` | Serve the production build locally. |
| `npm run lint` | Run TypeScript type checking without emitting files. |

## Technology

- React 19 and TypeScript
- Vite
- Tailwind CSS
- Zustand for simulator state
- React Flow and Dagre for the commit graph
- Lucide icons and Motion animations

## Project structure

```text
src/
  components/   Interface panels: terminal, editor, graph, dashboards, and modals
  engine/       Simulated Git command engine and terminal autocomplete
  scenarios/    Incident definitions, initial repository states, and validations
  store/        Zustand state and simulated pipeline orchestration
  types/        Shared Git and scenario data types
```

## Configuration

The app does not require an API key for the Git simulator. `.env.example` documents optional values used by the original AI Studio environment. Keep real values in `.env.local`; `.env*` files are ignored by Git, except for `.env.example`.

## Contributing

Suggestions and pull requests are welcome. For a new scenario, define its repository state and validations in `src/scenarios/scenarios.ts`, then add any required simulated Git behavior in `src/engine/gitEngine.ts`.

## License

No license has been specified for this repository.
