import React, { useState } from 'react';
import {
  AlertTriangle,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Code2,
  Compass,
  ExternalLink,
  Flame,
  FolderGit2,
  GitBranch,
  GitCommit,
  GitPullRequest,
  HelpCircle,
  Layers,
  MessageSquare,
  Play,
  RotateCcw,
  Search,
  ShieldAlert,
  Sparkles,
  Terminal,
  Workflow,
  X,
} from 'lucide-react';
import { SCENARIOS } from '../scenarios/scenarios';
import { useGitStore } from '../store/useGitStore';

export const WarRoomModals: React.FC = () => {
  const {
    activeScenario,
    assertions,
    slackMessages,
    latestAlert,
    userCommandCount,
    isBriefingOpen,
    isHintModalOpen,
    isPostMortemOpen,
    isWelcomeOpen,
    isScenarioCatalogOpen,
    badges,
    recentlyUnlockedBadge,
    setBriefingOpen,
    setHintModalOpen,
    setPostMortemOpen,
    setWelcomeOpen,
    setScenarioCatalogOpen,
    dismissAlert,
    runTerminalCommand,
    selectScenario,
    resetScenario,
  } = useGitStore();

  const [welcomeTab, setWelcomeTab] = useState<'what-is-this' | 'how-it-works' | 'scenarios' | 'cheat-sheet'>('what-is-this');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogFilter, setCatalogFilter] = useState<'All' | 'Junior' | 'Mid-Level' | 'Senior / Staff' | 'GitHub'>('All');

  const passedCount = assertions.filter((a) => a.passed).length;
  const nextScenario =
    SCENARIOS.find((s) => s.number === activeScenario.number + 1) ||
    SCENARIOS[0];

  const handleRunOptimalStepByStep = () => {
    for (const cmd of activeScenario.optimalCommands) {
      runTerminalCommand(cmd);
    }
    setHintModalOpen(false);
  };

  const filteredScenarios = SCENARIOS.filter((s) => {
    const matchesSearch =
      s.title.toLowerCase().includes(catalogSearch.toLowerCase()) ||
      s.subtitle.toLowerCase().includes(catalogSearch.toLowerCase()) ||
      s.incidentTicker.toLowerCase().includes(catalogSearch.toLowerCase()) ||
      s.jira.key.toLowerCase().includes(catalogSearch.toLowerCase()) ||
      s.focusedSkills.some((skill) => skill.toLowerCase().includes(catalogSearch.toLowerCase()));

    if (!matchesSearch) return false;

    if (catalogFilter === 'All') return true;
    if (catalogFilter === 'GitHub') return s.category?.includes('GitHub') || s.title.includes('GitHub') || s.title.includes('PR');
    return s.difficulty === catalogFilter;
  });

  return (
    <>
      {/* Live Anti-Pattern Slack Toast Banner */}
      {latestAlert && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md bg-[#0F172A] border border-rose-500/60 rounded-xl shadow-2xl p-4 text-xs text-slate-100">
          <div className="flex items-start justify-between gap-3 mb-1.5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="font-semibold text-rose-300">
                Slack Alert · {latestAlert.sender}
              </span>
            </div>
            <button
              onClick={dismissAlert}
              className="text-slate-400 hover:text-slate-200 p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-slate-300 leading-relaxed">{latestAlert.text}</p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. WELCOME & INCIDENT SIMULATOR GUIDE MODAL ("What is this & How it works") */}
      {/* ========================================================================= */}
      {isWelcomeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-4xl bg-[#0B0F17] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-800/90 bg-[#090D14] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400/20 to-indigo-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400">
                  <Flame className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-semibold tracking-wider uppercase text-sky-400">
                      Production Git Incident Simulator
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
                      14 Active Scenarios
                    </span>
                  </div>
                  <h1 className="text-lg font-bold text-slate-100 mt-0.5">
                    Welcome to GitOps WarRoom
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setWelcomeOpen(false)}
                  className="px-4 py-1.5 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-lg transition-colors flex items-center gap-1.5 shadow-md shadow-sky-500/10"
                >
                  <span>Enter War Room</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setWelcomeOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800/80 transition-colors"
                  aria-label="Close Guide"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="px-6 border-b border-slate-800/80 bg-[#0D131F] flex items-center gap-6 shrink-0 text-xs font-medium">
              <button
                onClick={() => setWelcomeTab('what-is-this')}
                className={`py-3 flex items-center gap-2 border-b-2 transition-all ${
                  welcomeTab === 'what-is-this'
                    ? 'border-sky-400 text-sky-400 font-semibold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>What is this?</span>
              </button>
              <button
                onClick={() => setWelcomeTab('how-it-works')}
                className={`py-3 flex items-center gap-2 border-b-2 transition-all ${
                  welcomeTab === 'how-it-works'
                    ? 'border-sky-400 text-sky-400 font-semibold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Workflow className="w-3.5 h-3.5" />
                <span>How the Simulator Works</span>
              </button>
              <button
                onClick={() => setWelcomeTab('scenarios')}
                className={`py-3 flex items-center gap-2 border-b-2 transition-all ${
                  welcomeTab === 'scenarios'
                    ? 'border-sky-400 text-sky-400 font-semibold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <FolderGit2 className="w-3.5 h-3.5" />
                <span>14 Production Scenarios</span>
              </button>
              <button
                onClick={() => setWelcomeTab('cheat-sheet')}
                className={`py-3 flex items-center gap-2 border-b-2 transition-all ${
                  welcomeTab === 'cheat-sheet'
                    ? 'border-sky-400 text-sky-400 font-semibold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>CLI & War Room Tools</span>
              </button>
            </div>

            {/* Modal Body with Scrollable Tab Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs text-slate-300">
              {/* TAB 1: WHAT IS THIS */}
              {welcomeTab === 'what-is-this' && (
                <div className="space-y-6">
                  {/* Hero Callout */}
                  <div className="p-5 rounded-xl border border-sky-500/20 bg-gradient-to-r from-sky-950/30 via-slate-900/60 to-indigo-950/30 space-y-3">
                    <div className="flex items-center gap-2 text-sky-300 font-semibold text-sm">
                      <ShieldAlert className="w-4 h-4 text-sky-400" />
                      <span>Learn Git the Way Engineers Actually Experience It: In Production Outages</span>
                    </div>
                    <p className="text-slate-300 leading-relaxed text-xs">
                      Traditional Git tutorials teach basic <code className="px-1.5 py-0.5 rounded bg-slate-800 font-mono text-sky-300 text-[11px]">git add</code> and <code className="px-1.5 py-0.5 rounded bg-slate-800 font-mono text-sky-300 text-[11px]">git commit</code> on toy linear graphs.
                      <strong className="text-slate-100"> GitOps WarRoom</strong> places you in real SEV-1 and SEV-2 production emergencies: panicked Slack messages from Staff SREs, failing GitHub Actions CI/CD pipelines, detached HEADs, broken release trains, leaked cloud credentials, blocked 100MB GitHub asset pushes, and messy 3-way merge conflict hell.
                    </p>
                  </div>

                  {/* 3 Core Pillars */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/50 space-y-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <h2 className="font-semibold text-slate-100 text-xs">State-Based Evaluation</h2>
                      <p className="text-slate-400 text-[11px] leading-relaxed">
                        We don't check for one rigid command string. You are graded strictly on the resulting repository state: DAG topology, branch pointers, remote sync, file contents, and clean worktree.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/50 space-y-2">
                      <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                        <GitBranch className="w-4 h-4" />
                      </div>
                      <h2 className="font-semibold text-slate-100 text-xs">Live DAG & Ghost Commits</h2>
                      <p className="text-slate-400 text-[11px] leading-relaxed">
                        Watch commit nodes, branch pointers, and remote tracking update in real time. Unreachable commits fade to 35% dashed ghost nodes—recoverable anytime via <code className="font-mono text-sky-300">git reflog</code>!
                      </p>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/50 space-y-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                        <Terminal className="w-4 h-4" />
                      </div>
                      <h2 className="font-semibold text-slate-100 text-xs">Context-Aware CLI Autocomplete</h2>
                      <p className="text-slate-400 text-[11px] leading-relaxed">
                        Full interactive Git CLI supporting real porcelain commands (<code className="font-mono text-sky-300">rebase -i</code>, <code className="font-mono text-sky-300">bisect</code>, <code className="font-mono text-sky-300">cherry-pick</code>, <code className="font-mono text-sky-300">reset --soft</code>). Press <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">Tab</kbd> anytime for live suggestions!
                      </p>
                    </div>
                  </div>

                  {/* Anti-Pattern Guardrail Warning */}
                  <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-950/20 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-semibold text-rose-200">Staff SRE Anti-Pattern Detection</div>
                      <p className="text-slate-300 text-[11px] leading-relaxed">
                        If you execute dangerous commands like <code className="font-mono text-rose-300">git push --force</code> to a shared <code className="font-mono text-rose-300">main</code> branch, blindly discard uncommitted work, or overwrite coworker commits without <code className="font-mono text-emerald-300">--force-with-lease</code>, Staff Engineers will intercept you with real-time Slack incident alerts and explain why!
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: HOW THE SIMULATOR WORKS */}
              {welcomeTab === 'how-it-works' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-100 mb-1">The 4-Step Incident Resolution Loop</h2>
                    <p className="text-slate-400 text-[11px]">Follow these 4 steps to resolve any production Git catastrophe in the War Room:</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Step 1 */}
                    <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-sky-400">STEP 01</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20">Briefing Drawer</span>
                      </div>
                      <h3 className="font-semibold text-slate-100 text-xs">Read Slack Thread & Jira Acceptance Criteria</h3>
                      <p className="text-slate-400 text-[11px] leading-relaxed">
                        Open the <strong>Mission Briefing</strong> to see the exact SEV level, service name, panicked Slack messages from Staff Engineers, and the checklist of live verification assertions.
                      </p>
                    </div>

                    {/* Step 2 */}
                    <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-indigo-400">STEP 02</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">DAG & Internals</span>
                      </div>
                      <h3 className="font-semibold text-slate-100 text-xs">Inspect DAG Visualizer & 3 Git Trees</h3>
                      <p className="text-slate-400 text-[11px] leading-relaxed">
                        Look at the graph in the top-right pane. Contrast your local branches vs <code className="font-mono text-sky-300">origin/*</code> remotes. Switch to the <strong>.git Internals</strong> tab to compare the Working Tree, Staging Index, and HEAD.
                      </p>
                    </div>

                    {/* Step 3 */}
                    <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-amber-400">STEP 03</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">Code & Conflict Editor</span>
                      </div>
                      <h3 className="font-semibold text-slate-100 text-xs">Resolve Conflicts & Edit Rebase Todos</h3>
                      <p className="text-slate-400 text-[11px] leading-relaxed">
                        If a merge/rebase conflict hits, the Code Editor displays a 1-click CodeLens bar (<code className="text-emerald-400">Accept Current</code> / <code className="text-sky-400">Accept Incoming</code> / <code className="text-purple-400">Accept Both</code>). For <code className="font-mono text-amber-300">git rebase -i</code>, reorder and toggle squash/pick visually!
                      </p>
                    </div>

                    {/* Step 4 */}
                    <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-emerald-400">STEP 04</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">Verification</span>
                      </div>
                      <h3 className="font-semibold text-slate-100 text-xs">Execute in Terminal & Watch Assertions Pass</h3>
                      <p className="text-slate-400 text-[11px] leading-relaxed">
                        Use the interactive terminal to run your commands. As you fix the branch pointers and clean the workspace, verification assertion badges turn green and the GitHub CI pipeline turns passing!
                      </p>
                    </div>
                  </div>

                  {/* Resizable 4-Pane Cockpit Architecture */}
                  <div className="p-4 rounded-xl border border-slate-800 bg-[#090D14] space-y-2">
                    <div className="flex items-center gap-2 text-slate-200 font-semibold text-xs">
                      <Layers className="w-4 h-4 text-sky-400" />
                      <span>The 4 Resizable Workspace Zones</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                      <div className="p-2.5 rounded bg-slate-900/80 border border-slate-800">
                        <div className="text-sky-400 font-bold mb-1">Top-Left: Code & Conflict Editor</div>
                        <div className="text-slate-400">Tracked/Modified files, 3-way conflict lenses, git-rebase-todo interactive editor</div>
                      </div>
                      <div className="p-2.5 rounded bg-slate-900/80 border border-slate-800">
                        <div className="text-sky-400 font-bold mb-1">Top-Right: Live Git DAG Graph</div>
                        <div className="text-slate-400">Local vs origin branches, tags, HEAD pointer, 35% opacity reflog ghost commits</div>
                      </div>
                      <div className="p-2.5 rounded bg-slate-900/80 border border-slate-800">
                        <div className="text-amber-400 font-bold mb-1">Bottom-Left: Interactive Git CLI</div>
                        <div className="text-slate-400">Real terminal emulator, Tab autocomplete popup, command history, quick command chips</div>
                      </div>
                      <div className="p-2.5 rounded bg-slate-900/80 border border-slate-800">
                        <div className="text-emerald-400 font-bold mb-1">Bottom-Right: .git Internals & CI</div>
                        <div className="text-slate-400">3-Trees inspector (Working/Index/HEAD), reflog table, live GitHub Actions checks</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: SCENARIOS OVERVIEW */}
              {welcomeTab === 'scenarios' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-100">14 Production Incidents Library</h2>
                      <p className="text-slate-400 text-[11px]">From junior hotfixes to principal staff architect recoveries & GitHub PR collisions</p>
                    </div>
                    <button
                      onClick={() => {
                        setWelcomeOpen(false);
                        setScenarioCatalogOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/30 hover:bg-sky-500/20 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <span>Open Filterable Catalog</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {SCENARIOS.map((sc) => (
                      <div
                        key={sc.id}
                        onClick={() => {
                          selectScenario(sc.id);
                          setWelcomeOpen(false);
                        }}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                          activeScenario.id === sc.id
                            ? 'border-sky-400/80 bg-sky-950/20'
                            : 'border-slate-800/80 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/70'
                        }`}
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sky-400 text-xs">
                              #{sc.number.toString().padStart(2, '0')}
                            </span>
                            <span className="text-slate-200 font-semibold text-xs truncate">
                              {sc.title}
                            </span>
                            <span
                              className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                                sc.difficulty === 'Junior'
                                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                  : sc.difficulty === 'Mid-Level'
                                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                  : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                              }`}
                            >
                              {sc.difficulty}
                            </span>
                            {sc.category && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 hidden sm:inline-block">
                                {sc.category}
                              </span>
                            )}
                          </div>
                          <p className="text-slate-400 text-[11px] truncate">{sc.subtitle}</p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-1.5 hidden md:flex">
                            {sc.focusedSkills.slice(0, 2).map((skill, idx) => (
                              <code
                                key={idx}
                                className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-800 text-sky-300 border border-slate-700/60"
                              >
                                {skill}
                              </code>
                            ))}
                          </div>
                          <button className="px-3 py-1 rounded bg-slate-800 hover:bg-sky-400 hover:text-slate-950 text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1">
                            <Play className="w-2.5 h-2.5" />
                            <span>Play</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: CLI & CHEAT SHEET */}
              {welcomeTab === 'cheat-sheet' && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-100">Terminal Autocomplete & Incident Tools</h2>
                    <p className="text-slate-400 text-[11px]">Key commands supported in the War Room terminal</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 space-y-3">
                      <div className="font-semibold text-sky-400 flex items-center gap-2">
                        <Terminal className="w-4 h-4" />
                        <span>Core Recovery Commands</span>
                      </div>
                      <div className="space-y-2 text-[11px] font-mono">
                        <div className="p-2 rounded bg-slate-950/80 border border-slate-800/80">
                          <span className="text-sky-300 font-bold">$ git reflog</span>
                          <div className="text-slate-400 font-sans text-[10px] mt-0.5">Chronological record of every HEAD movement. Use to recover lost commits!</div>
                        </div>
                        <div className="p-2 rounded bg-slate-950/80 border border-slate-800/80">
                          <span className="text-sky-300 font-bold">$ git reset --hard HEAD@&#123;3&#125;</span>
                          <div className="text-slate-400 font-sans text-[10px] mt-0.5">Restore branch and working tree to a historical reflog SHA.</div>
                        </div>
                        <div className="p-2 rounded bg-slate-950/80 border border-slate-800/80">
                          <span className="text-sky-300 font-bold">$ git reset --soft HEAD~1</span>
                          <div className="text-slate-400 font-sans text-[10px] mt-0.5">Undo commit but keep changes staged. Great for purging 100MB accidental blobs!</div>
                        </div>
                        <div className="p-2 rounded bg-slate-950/80 border border-slate-800/80">
                          <span className="text-sky-300 font-bold">$ git clean -fd</span>
                          <div className="text-slate-400 font-sans text-[10px] mt-0.5">Delete all untracked files and untracked directories forcefully.</div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 space-y-3">
                      <div className="font-semibold text-emerald-400 flex items-center gap-2">
                        <GitPullRequest className="w-4 h-4" />
                        <span>Collaboration & Branch Workflows</span>
                      </div>
                      <div className="space-y-2 text-[11px] font-mono">
                        <div className="p-2 rounded bg-slate-950/80 border border-slate-800/80">
                          <span className="text-emerald-300 font-bold">$ git push --force-with-lease</span>
                          <div className="text-slate-400 font-sans text-[10px] mt-0.5">Safe force push that aborts if a coworker pushed new commits since last fetch.</div>
                        </div>
                        <div className="p-2 rounded bg-slate-950/80 border border-slate-800/80">
                          <span className="text-emerald-300 font-bold">$ git cherry-pick &lt;sha&gt;</span>
                          <div className="text-slate-400 font-sans text-[10px] mt-0.5">Copy an isolated security patch or hotfix onto a release or maintenance branch.</div>
                        </div>
                        <div className="p-2 rounded bg-slate-950/80 border border-slate-800/80">
                          <span className="text-emerald-300 font-bold">$ git revert -m 1 &lt;merge_sha&gt;</span>
                          <div className="text-slate-400 font-sans text-[10px] mt-0.5">Safely roll back a merged pull request on production trunk without force-pushing.</div>
                        </div>
                        <div className="p-2 rounded bg-slate-950/80 border border-slate-800/80">
                          <span className="text-emerald-300 font-bold">$ git bisect start / bad / good</span>
                          <div className="text-slate-400 font-sans text-[10px] mt-0.5">Binary search through commit history to identify the exact regression commit.</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-sky-500/20 bg-sky-950/20 flex items-center justify-between text-xs">
                    <span className="text-slate-300">
                      💡 <strong>Tab-Completion Tip:</strong> In the terminal, type <code className="font-mono text-sky-300">git </code> and press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 font-mono text-slate-200">Tab</kbd> to see all subcommands, or type <code className="font-mono text-sky-300">git checkout </code> and press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 font-mono text-slate-200">Tab</kbd> to autocomplete active branch names!
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-800/90 bg-[#090D14] flex items-center justify-between shrink-0">
              <div className="text-[11px] text-slate-500 flex items-center gap-2">
                <span>You can reopen this guide anytime by clicking <strong>"Guide"</strong> in the top navigation bar.</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setWelcomeOpen(false);
                    setScenarioCatalogOpen(true);
                  }}
                  className="px-4 py-1.5 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <FolderGit2 className="w-3.5 h-3.5" />
                  <span>Browse All 14 Scenarios</span>
                </button>
                <button
                  onClick={() => setWelcomeOpen(false)}
                  className="px-5 py-1.5 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-lg transition-colors flex items-center gap-1.5 shadow-md shadow-sky-500/10"
                >
                  <span>Start Simulating</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. ALL 14 PRODUCTION SCENARIOS BROWSER & CATALOG MODAL                     */}
      {/* ========================================================================= */}
      {isScenarioCatalogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-4xl bg-[#0D131F] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-[#0A0E17]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                  <FolderGit2 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-100">
                    Production Incident Catalog
                  </h2>
                  <p className="text-slate-400 text-xs">
                    Select from 14 real-world Git emergencies across Junior, Mid-Level, Senior, and GitHub workflows
                  </p>
                </div>
              </div>
              <button
                onClick={() => setScenarioCatalogOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800/80 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter and Search Bar */}
            <div className="px-6 py-3 border-b border-slate-800/80 bg-[#090D14] flex flex-wrap items-center justify-between gap-3 shrink-0">
              {/* Category Pills */}
              <div className="flex items-center gap-1.5">
                {(['All', 'Junior', 'Mid-Level', 'Senior / Staff', 'GitHub'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setCatalogFilter(filter)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      catalogFilter === filter
                        ? 'bg-sky-400 text-slate-950 font-semibold'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
                    }`}
                  >
                    {filter === 'All' ? 'All (14)' : filter === 'GitHub' ? 'GitHub PRs' : filter}
                  </button>
                ))}
              </div>

              {/* Search Input */}
              <div className="relative min-w-[240px]">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search scenarios or commands..."
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  className="w-full bg-slate-900/90 border border-slate-700/80 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-sky-400"
                />
              </div>
            </div>

            {/* Scenario Grid */}
            <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredScenarios.map((sc) => {
                const isCurrent = activeScenario.id === sc.id;
                return (
                  <div
                    key={sc.id}
                    onClick={() => {
                      selectScenario(sc.id);
                      setScenarioCatalogOpen(false);
                    }}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                      isCurrent
                        ? 'border-sky-400/90 bg-sky-950/20 shadow-md shadow-sky-500/5'
                        : 'border-slate-800/80 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/80'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-sky-400">
                            #{sc.number.toString().padStart(2, '0')}
                          </span>
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                              sc.difficulty === 'Junior'
                                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                : sc.difficulty === 'Mid-Level'
                                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                            }`}
                          >
                            {sc.difficulty}
                          </span>
                          {sc.category && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                              {sc.category}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-mono text-rose-400 font-semibold">
                          {sc.jira.severity}
                        </span>
                      </div>

                      <h3 className="text-sm font-semibold text-slate-100 mb-1 leading-snug">
                        {sc.title}
                      </h3>
                      <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                        {sc.subtitle}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {sc.focusedSkills.slice(0, 2).map((skill, idx) => (
                          <code
                            key={idx}
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 text-sky-300 border border-slate-800"
                          >
                            {skill}
                          </code>
                        ))}
                      </div>

                      <button
                        className={`px-3 py-1 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors ${
                          isCurrent
                            ? 'bg-sky-400 text-slate-950'
                            : 'bg-slate-800 text-slate-200 hover:bg-sky-400 hover:text-slate-950'
                        }`}
                      >
                        <Play className="w-2.5 h-2.5" />
                        <span>{isCurrent ? 'Current' : 'Launch'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-800 bg-[#0A0E17] flex items-center justify-between text-xs text-slate-500 shrink-0">
              <span>Showing {filteredScenarios.length} of {SCENARIOS.length} scenarios</span>
              <button
                onClick={() => setScenarioCatalogOpen(false)}
                className="px-4 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MISSION BRIEFING DRAWER                                                */}
      {/* ========================================================================= */}
      {isBriefingOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-[#0D131F] border-l border-slate-800 h-full flex flex-col overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-xs font-mono text-sky-400">
                  Scenario #{activeScenario.number} · {activeScenario.jira.key} ·{' '}
                  {activeScenario.difficulty}
                </div>
                <h2 className="text-base font-bold text-slate-100 mt-0.5">
                  {activeScenario.title}
                </h2>
              </div>
              <button
                onClick={() => setBriefingOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
              {/* Jira Ticket Details */}
              <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/50 space-y-2.5">
                <div className="flex items-center justify-between text-slate-400 font-mono">
                  <span>
                    {activeScenario.jira.key} · {activeScenario.jira.service}
                  </span>
                  <span className="text-rose-400 font-semibold">
                    {activeScenario.jira.severity}
                  </span>
                </div>
                <div className="text-sm font-semibold text-slate-100">
                  {activeScenario.jira.title}
                </div>
                <div className="space-y-1.5 pt-1">
                  <div className="text-slate-400 font-medium">
                    Acceptance Criteria:
                  </div>
                  {activeScenario.jira.acceptanceCriteria.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 text-slate-300 leading-relaxed"
                    >
                      <span className="font-mono text-sky-400">0{idx + 1}.</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Slack Incident Thread */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <MessageSquare className="w-4 h-4 text-sky-400" />
                  <span>War Room Slack Thread ({slackMessages[0]?.channel})</span>
                </div>
                <div className="space-y-2.5">
                  {slackMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-3.5 rounded-lg border ${
                        msg.isAlert
                          ? 'border-rose-500/40 bg-rose-950/20'
                          : 'border-slate-800 bg-slate-900/40'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-100">
                            {msg.sender}
                          </span>
                          <span className="text-slate-500">·</span>
                          <span className="text-slate-400">{msg.role}</span>
                        </div>
                        <span className="font-mono text-slate-500">
                          {msg.timestamp}
                        </span>
                      </div>
                      <p className="text-slate-300 leading-relaxed text-xs">
                        {msg.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live Verification Assertions Checklist */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>State-Based Verification Engine</span>
                  </div>
                  <span className="font-mono text-xs text-sky-400 font-semibold tabular-nums">
                    {passedCount} / {assertions.length} Passing
                  </span>
                </div>

                <div className="space-y-2">
                  {assertions.map((assertion) => (
                    <div
                      key={assertion.id}
                      className={`p-3 rounded-lg border transition-all ${
                        assertion.passed
                          ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300'
                          : 'border-slate-800 bg-slate-900/40 text-slate-300'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5">
                          {assertion.passed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border border-slate-600 shrink-0" />
                          )}
                        </div>
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <div
                            className={`font-semibold ${
                              assertion.passed
                                ? 'text-emerald-200'
                                : 'text-slate-200'
                            }`}
                          >
                            {assertion.label}
                          </div>
                          <div className="text-slate-400 text-[11px] leading-relaxed">
                            {assertion.description}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-800 bg-[#0B0F17] flex items-center justify-between">
              <button
                onClick={() => setHintModalOpen(true)}
                className="px-3 py-1.5 text-xs text-slate-300 hover:text-slate-100 flex items-center gap-1.5"
              >
                <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
                Staff SRE Runbook Hints
              </button>

              <button
                onClick={() => setBriefingOpen(false)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-lg transition-colors"
              >
                Back to Incident
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. SENIOR DEV HINTS / RUNBOOK MODAL                                       */}
      {/* ========================================================================= */}
      {isHintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-[#0D131F] border border-slate-800 rounded-xl shadow-2xl overflow-hidden text-xs">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#0B0F17]">
              <div className="flex items-center gap-2 text-sky-400 font-semibold">
                <HelpCircle className="w-4 h-4" />
                <span>Staff SRE Incident Runbook · Scenario #{activeScenario.number}</span>
              </div>
              <button
                onClick={() => setHintModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <div className="font-semibold text-slate-300">
                  Recommended Approach:
                </div>
                <div className="space-y-1.5">
                  {activeScenario.hints.map((hint, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg border border-slate-800/80 bg-slate-900/40 text-slate-300 flex items-start gap-2"
                    >
                      <span className="font-mono text-sky-400 shrink-0">
                        0{idx + 1}.
                      </span>
                      <span className="leading-relaxed">{hint}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="font-semibold text-slate-300">
                  Optimal Staff Engineer Command Sequence:
                </div>
                <div className="p-3 rounded-lg border border-slate-800 bg-[#070A10] font-mono space-y-1.5">
                  {activeScenario.optimalCommands.map((cmd, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 text-slate-200"
                    >
                      <span>
                        <span className="text-slate-500 mr-2">$</span>
                        {cmd}
                      </span>
                      <button
                        onClick={() => runTerminalCommand(cmd)}
                        className="px-2 py-0.5 text-[11px] bg-slate-800 hover:bg-sky-500/20 hover:text-sky-300 text-slate-300 rounded transition-colors flex items-center gap-1 shrink-0"
                      >
                        <Play className="w-2.5 h-2.5" />
                        Run
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-900/40 space-y-1">
                <div className="font-semibold text-slate-200">
                  Why This Matters in Production:
                </div>
                <p className="text-slate-400 leading-relaxed">
                  {activeScenario.staffPostMortem}
                </p>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-800 bg-[#0B0F17] flex items-center justify-between">
              {activeScenario.number <= 4 ? (
                <button
                  onClick={handleRunOptimalStepByStep}
                  className="px-3 py-1.5 text-xs font-medium text-sky-300 bg-sky-500/10 border border-sky-500/30 rounded-lg hover:bg-sky-500/20 transition-colors flex items-center gap-1.5"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  Auto-Run Optimal Sequence
                </button>
              ) : (
                <span className="text-[11px] text-slate-500">
                  Follow the runbook steps to execute in the Terminal
                </span>
              )}
              <button
                onClick={() => setHintModalOpen(false)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-lg transition-colors"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. CELEBRATORY INCIDENT RESOLVED / POST-MORTEM MODAL                     */}
      {/* ========================================================================= */}
      {isPostMortemOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-[#0D131F] border border-emerald-500/40 rounded-xl shadow-2xl overflow-hidden text-xs">
            <div className="px-6 py-5 border-b border-slate-800 bg-emerald-950/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Award className="w-6 h-6 text-emerald-400 shrink-0" />
                <div>
                  <div className="text-[11px] font-mono text-emerald-400 font-semibold">
                    INCIDENT RESOLVED · ALL {assertions.length} ASSERTIONS VERIFIED
                  </div>
                  <h3 className="text-base font-bold text-slate-100 mt-0.5">
                    {activeScenario.title}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setPostMortemOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Efficiency Comparison Strip */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-900/50">
                  <div className="text-slate-400">Your Git Operations</div>
                  <div className="text-xl font-bold font-mono text-slate-100 mt-1 tabular-nums">
                    {userCommandCount} command{userCommandCount === 1 ? '' : 's'}
                  </div>
                </div>
                <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-900/50">
                  <div className="text-slate-400">Staff Engineer Benchmark</div>
                  <div className="text-xl font-bold font-mono text-emerald-400 mt-1 tabular-nums">
                    {activeScenario.optimalCommands.length} commands
                  </div>
                </div>
              </div>

              {/* Verified Assertions List */}
              <div className="space-y-1.5">
                <div className="font-semibold text-slate-300">
                  Verified Repository State:
                </div>
                {assertions.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-2 text-emerald-300 py-1"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{a.label}</span>
                  </div>
                ))}
              </div>

              {/* Badges / Achievements System Panel */}
              <div className="p-4 rounded-xl border border-sky-500/30 bg-gradient-to-r from-sky-950/40 via-slate-900/60 to-indigo-950/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-400" />
                    <span className="font-semibold text-slate-100 text-xs">
                      Badges & Achievements
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/20 font-semibold">
                    {badges.filter((b) => b.unlockedAt).length} / {badges.length} Unlocked
                  </span>
                </div>

                {recentlyUnlockedBadge && (
                  <div className="p-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-200 flex items-center gap-2 animate-in fade-in">
                    <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-amber-300">
                        NEW UNLOCK: {recentlyUnlockedBadge.name} ({recentlyUnlockedBadge.rarity})
                      </div>
                      <div className="text-[11px] text-amber-200/90 truncate">
                        {recentlyUnlockedBadge.description}
                      </div>
                    </div>
                  </div>
                )}

                {/* Grid showing key achievements including Clean Merge History, First Reflog Recovery, Zero-Force Push */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {badges.slice(0, 3).map((badge) => {
                    const isUnlocked = Boolean(badge.unlockedAt);
                    return (
                      <div
                        key={badge.id}
                        className={`p-2.5 rounded-lg border text-[11px] flex items-center gap-2 transition-all ${
                          isUnlocked
                            ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-200'
                            : 'border-slate-800 bg-slate-900/50 text-slate-500'
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                            isUnlocked
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-slate-800 text-slate-600'
                          }`}
                        >
                          <Award className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div
                            className={`font-semibold truncate text-[11px] ${
                              isUnlocked ? 'text-emerald-300' : 'text-slate-400'
                            }`}
                          >
                            {badge.name}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {isUnlocked ? `Earned ${badge.unlockedAt}` : 'Locked'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Staff Post-Mortem Takeaway */}
              <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/60 space-y-1.5">
                <div className="font-semibold text-slate-200">
                  Principal Engineer Post-Mortem Note:
                </div>
                <p className="text-slate-300 leading-relaxed">
                  {activeScenario.staffPostMortem}
                </p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-800 bg-[#0B0F17] flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  setPostMortemOpen(false);
                  resetScenario();
                }}
                className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Replay Scenario
              </button>

              <button
                onClick={() => selectScenario(nextScenario.id)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <span>
                  Next: Scenario #{nextScenario.number} ({nextScenario.title})
                </span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
