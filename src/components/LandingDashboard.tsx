import React, { useState } from 'react';
import {
  AlertTriangle,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Code2,
  Compass,
  Cpu,
  ExternalLink,
  Flame,
  FolderGit2,
  GitBranch,
  GitCommit,
  GitPullRequest,
  HelpCircle,
  History,
  Layers,
  Lock,
  Package,
  Play,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  Workflow,
  XCircle,
  Zap,
} from 'lucide-react';
import { SCENARIOS } from '../scenarios/scenarios';
import { useGitStore } from '../store/useGitStore';
import { PipelineMonitor } from './PipelineMonitor';

export const LandingDashboard: React.FC = () => {
  const {
    activeScenario,
    selectScenario,
    setViewMode,
    badges,
    pipelineRuns,
    assertions,
    userCommandCount,
    setWelcomeOpen,
    setBriefingOpen,
  } = useGitStore();

  const [activeTab, setActiveTab] = useState<'all' | 'junior' | 'mid' | 'senior' | 'github'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const unlockedBadges = badges.filter((b) => b.unlockedAt);

  const filteredScenarios = SCENARIOS.filter((sc) => {
    const matchesSearch =
      sc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sc.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sc.jira.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sc.focusedSkills.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (activeTab === 'all') return true;
    if (activeTab === 'junior') return sc.difficulty === 'Junior';
    if (activeTab === 'mid') return sc.difficulty === 'Mid-Level';
    if (activeTab === 'senior') return sc.difficulty === 'Senior / Staff';
    if (activeTab === 'github')
      return sc.category?.includes('GitHub') || sc.title.includes('GitHub') || sc.title.includes('PR');

    return true;
  });

  const handleLaunchScenario = (scenarioId: string) => {
    selectScenario(scenarioId, true);
    setViewMode('ide');
  };

  return (
    <div className="min-h-screen w-full bg-[#070A10] text-slate-100 flex flex-col font-sans selection:bg-sky-500/30 selection:text-sky-200">
      {/* 1. TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-[#070A10]/90 backdrop-blur-md px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-400/20 via-indigo-500/20 to-amber-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400 shadow-md shadow-sky-500/10">
              <Flame className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                GitOps WarRoom
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  SEV Simulator
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Center Nav Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-400">
          <a href="#incidents" className="hover:text-slate-100 transition-colors">
            Incidents Library ({SCENARIOS.length})
          </a>
          <a href="#pipeline" className="hover:text-slate-100 transition-colors">
            GitHub Actions CI
          </a>
          <a href="#achievements" className="hover:text-slate-100 transition-colors">
            Achievements ({unlockedBadges.length}/{badges.length})
          </a>
          <a href="#architecture" className="hover:text-slate-100 transition-colors">
            Simulator Guide
          </a>
        </nav>

        {/* Right CTA */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setWelcomeOpen(true)}
            className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Overview Guide</span>
          </button>

          <button
            onClick={() => setViewMode('ide')}
            className="px-4 py-1.5 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-lg transition-all flex items-center gap-1.5 shadow-md shadow-sky-500/15 hover:shadow-sky-500/25"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Launch War Room IDE</span>
          </button>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="relative px-6 pt-16 pb-12 max-w-6xl mx-auto w-full flex flex-col items-center text-center space-y-6">
        {/* Glow backdrop */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

        {/* Hero Alert Pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-rose-500/30 bg-rose-950/20 text-rose-300 text-xs font-mono font-medium">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          <span>Active Outage Simulation: 14 High-Stakes Production Scenarios</span>
        </div>

        {/* Main Headline */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white max-w-4xl leading-[1.15]">
          Where Real Engineers Master <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-sky-400 via-indigo-300 to-amber-300 bg-clip-text text-transparent">
            Production Git Emergencies
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-slate-400 max-w-2xl text-sm sm:text-base leading-relaxed">
          Step beyond toy tutorials that only teach linear <code className="font-mono text-sky-300 bg-slate-900 px-1 py-0.5 rounded">git commit</code>.
          Inherit actual SEV-1 production outages, diverged GitHub pull requests, leaked credentials, 100MB asset push rejections, and broken release trains in an interactive 4-zone developer war room.
        </p>

        {/* Hero CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            onClick={() => handleLaunchScenario(activeScenario.id)}
            className="px-6 py-3 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-bold text-sm transition-all flex items-center gap-2 shadow-lg shadow-sky-500/20 hover:scale-[1.02]"
          >
            <Play className="w-4 h-4" />
            <span>Start Incident #{activeScenario.number}: {activeScenario.title}</span>
          </button>

          <a
            href="#incidents"
            className="px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 font-semibold text-sm transition-all flex items-center gap-2"
          >
            <FolderGit2 className="w-4 h-4 text-sky-400" />
            <span>Explore 14 Incidents</span>
          </a>
        </div>

        {/* Live Terminal & DAG Preview Card */}
        <div className="w-full max-w-4xl mt-8 rounded-2xl border border-slate-800 bg-[#090D14] shadow-2xl overflow-hidden text-left">
          <div className="px-4 py-3 border-b border-slate-800 bg-[#0B0F17] flex items-center justify-between text-xs font-mono text-slate-400">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
              <span className="ml-2 text-slate-300 font-semibold">warroom@prod-bastion:~/checkout-service (incident-{activeScenario.jira.key})</span>
            </div>
            <span className="text-[11px] text-sky-400">State-Based Evaluation Active</span>
          </div>

          <div className="p-5 font-mono text-xs space-y-2 text-slate-300 bg-[#05070B]">
            <div className="text-slate-500"># Current production git status:</div>
            <div className="text-rose-400 font-bold">$ git status</div>
            <div className="text-slate-400 pl-4">
              On branch main. Your branch is diverged from 'origin/main' by 3 commits.
              <br />
              (use "git pull --rebase" to integrate remote security patches)
            </div>
            <div className="text-slate-500 pt-2"># Interactive reflog & DAG recovery ready:</div>
            <div className="text-sky-300">$ git log --oneline --graph --all</div>
            <div className="text-slate-400 pl-4 space-y-0.5">
              <div>* <span className="text-amber-400">{activeScenario.createInitialState().head.ref}</span> (HEAD) {activeScenario.incidentTicker}</div>
              <div>* <span className="text-sky-400">c102100</span> (tag: v2.1.0) release: cut production build</div>
              <div>* <span className="text-slate-600">a010000</span> initial bootstrap</div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. METRICS & OPERATIONAL TELEMETRY STRIP */}
      <section className="border-y border-slate-800/80 bg-[#0A0E17] py-6 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-sky-400">14</div>
            <div className="text-xs text-slate-400 mt-1">Real Production Scenarios</div>
            <div className="text-[10px] text-slate-500 font-mono">Junior · Mid · Senior · Staff</div>
          </div>

          <div>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-400">100%</div>
            <div className="text-xs text-slate-400 mt-1">State-Based Grading</div>
            <div className="text-[10px] text-slate-500 font-mono">DAG, Refs & Clean Worktree</div>
          </div>

          <div>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-purple-400">Live</div>
            <div className="text-xs text-slate-400 mt-1">GitHub Actions Runner</div>
            <div className="text-[10px] text-slate-500 font-mono">Branches & Release Tags</div>
          </div>

          <div>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-amber-400">
              {unlockedBadges.length} / {badges.length}
            </div>
            <div className="text-xs text-slate-400 mt-1">Achievements Unlocked</div>
            <div className="text-[10px] text-slate-500 font-mono">Clean Merge, Reflog Hero</div>
          </div>
        </div>
      </section>

      {/* 4. INCIDENT COMMAND CENTER (SCENARIOS LIBRARY) */}
      <section id="incidents" className="px-6 py-16 max-w-6xl mx-auto w-full space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-sky-400 font-semibold uppercase tracking-wider">
              <FolderGit2 className="w-4 h-4" />
              <span>Incident Command Catalog</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mt-1">
              Select Your Next Production Fire
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">
              From fast junior fixes to staff-level merge reversions and GitHub pull request conflicts
            </p>
          </div>

          {/* Search bar */}
          <div className="relative min-w-[260px]">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search scenarios or commands..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-sky-400 transition-colors"
            />
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          {(
            [
              { id: 'all', label: 'All Incidents (14)' },
              { id: 'junior', label: 'Junior On-Call (5)' },
              { id: 'mid', label: 'Mid-Level Incidents (5)' },
              { id: 'senior', label: 'Senior / Staff (4)' },
              { id: 'github', label: 'GitHub Workflows (4)' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-3.5 py-1.5 rounded-lg whitespace-nowrap transition-colors font-medium ${
                activeTab === t.id
                  ? 'bg-sky-400 text-slate-950 font-semibold shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Scenarios Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          {filteredScenarios.map((sc) => {
            const isActive = activeScenario.id === sc.id;
            return (
              <div
                key={sc.id}
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between gap-4 group ${
                  isActive
                    ? 'border-sky-500/70 bg-gradient-to-br from-sky-950/20 to-slate-900/70 shadow-lg shadow-sky-500/5'
                    : 'border-slate-800/80 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/70'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-bold text-sky-400">
                      INCIDENT #{sc.number.toString().padStart(2, '0')}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                        sc.difficulty === 'Junior'
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                          : sc.difficulty === 'Mid-Level'
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                          : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                      }`}
                    >
                      {sc.difficulty}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white group-hover:text-sky-300 transition-colors">
                    {sc.title}
                  </h3>

                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                    {sc.subtitle}
                  </p>

                  <div className="pt-1 flex items-center gap-2 text-[11px] font-mono text-slate-500">
                    <span className="text-rose-400 font-semibold">{sc.jira.severity}</span>
                    <span>·</span>
                    <span>{sc.jira.key}</span>
                    <span>·</span>
                    <span>{sc.jira.service}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
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
                    onClick={() => handleLaunchScenario(sc.id)}
                    className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-sky-400 hover:bg-sky-300 text-slate-950 transition-colors flex items-center gap-1.5 shrink-0 shadow-sm"
                  >
                    <Play className="w-3 h-3" />
                    <span>Launch</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. GITHUB ACTIONS LIVE PIPELINE MONITOR SECTION */}
      <section id="pipeline" className="px-6 py-16 border-t border-slate-800/80 bg-[#0A0E17]/60">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-purple-400 font-semibold uppercase tracking-wider">
                <Workflow className="w-4 h-4" />
                <span>Simulated GitHub Actions</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mt-1">
                Live CI/CD Pipeline Monitor
              </h2>
              <p className="text-slate-400 text-xs sm:text-sm mt-1">
                Workflows automatically trigger when you execute <code className="font-mono text-sky-300">git push</code> or apply release tags
              </p>
            </div>

            <button
              onClick={() => setViewMode('ide')}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 transition-colors flex items-center gap-1.5 self-start sm:self-auto"
            >
              <span>Test inside War Room</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Embedded Visual Pipeline Monitor */}
          <div className="h-[460px] rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
            <PipelineMonitor embedded={false} />
          </div>
        </div>
      </section>

      {/* 6. ACHIEVEMENTS & TROPHY CASE */}
      <section id="achievements" className="px-6 py-16 border-t border-slate-800/80 max-w-6xl mx-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-amber-400 font-semibold uppercase tracking-wider">
              <Award className="w-4 h-4" />
              <span>Career Git Mastery</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mt-1">
              Badges & Achievements Trophy Case
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">
              Earn distinctive recognition for clean rebasing, zero-force-push discipline, and reflog recoveries
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl font-mono text-xs">
            <span className="text-slate-400">Unlocked:</span>
            <span className="font-bold text-amber-400">{unlockedBadges.length} / {badges.length}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {badges.map((badge) => {
            const isUnlocked = Boolean(badge.unlockedAt);
            return (
              <div
                key={badge.id}
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                  isUnlocked
                    ? 'border-amber-500/40 bg-gradient-to-br from-amber-950/20 via-slate-900/60 to-slate-900/90 shadow-lg shadow-amber-500/5'
                    : 'border-slate-800/80 bg-slate-900/30 opacity-70'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        isUnlocked
                          ? 'bg-amber-400/20 text-amber-400 border border-amber-400/30'
                          : 'bg-slate-800 text-slate-600 border border-slate-700/60'
                      }`}
                    >
                      {badge.icon === 'git-merge' && <GitPullRequest className="w-5 h-5" />}
                      {badge.icon === 'history' && <History className="w-5 h-5" />}
                      {badge.icon === 'shield-check' && <ShieldCheck className="w-5 h-5" />}
                      {badge.icon === 'lock' && <Lock className="w-5 h-5" />}
                      {badge.icon === 'zap' && <Zap className="w-5 h-5" />}
                      {badge.icon === 'package' && <Package className="w-5 h-5" />}
                      {badge.icon === 'award' && <Award className="w-5 h-5" />}
                    </div>

                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                        badge.rarity === 'Legendary'
                          ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                          : badge.rarity === 'Epic'
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                          : badge.rarity === 'Rare'
                          ? 'bg-sky-500/10 text-sky-300 border-sky-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {badge.rarity}
                    </span>
                  </div>

                  <div>
                    <h4 className={`text-sm font-bold ${isUnlocked ? 'text-amber-200' : 'text-slate-300'}`}>
                      {badge.name}
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {badge.description}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 text-[11px] font-mono flex items-center justify-between">
                  <span className="text-slate-500">How to unlock:</span>
                  <span className={isUnlocked ? 'text-emerald-400 font-semibold' : 'text-slate-400'}>
                    {isUnlocked ? `Unlocked at ${badge.unlockedAt}` : badge.hint}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 7. ARCHITECTURE & PHILOSOPHY SECTION */}
      <section id="architecture" className="px-6 py-16 border-t border-slate-800/80 bg-[#0A0E17]/50">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Why Toy Tutorials Fail in Production
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm">
              Git is not a checklist of commands—it is a Directed Acyclic Graph of immutable snapshots.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 space-y-3">
              <div className="text-rose-400 font-mono font-bold text-xs uppercase tracking-wider">
                Traditional Toy Tutorials
              </div>
              <ul className="space-y-2.5 text-xs text-slate-400 leading-relaxed list-disc list-inside">
                <li>Teaches basic add & commit with single-branch linear diagrams.</li>
                <li>Hides the reality of merge conflicts, remote divergence, and failing CI.</li>
                <li>Tests users on guessing one exact string command instead of repo state.</li>
                <li>Leaves developers terrified when dropped into detached HEAD or botched rebases.</li>
              </ul>
            </div>

            <div className="p-6 rounded-2xl border border-sky-500/30 bg-sky-950/20 space-y-3">
              <div className="text-sky-400 font-mono font-bold text-xs uppercase tracking-wider">
                GitOps WarRoom Simulator
              </div>
              <ul className="space-y-2.5 text-xs text-slate-200 leading-relaxed list-disc list-inside">
                <li>Simulates real SEV-1 production incidents with panicked Slack alerts and Jira criteria.</li>
                <li>Live DAG visualizer renders remote tracking, tags, and 35% opacity reflog ghost commits.</li>
                <li>Interactive 3-way merge conflict editor with 1-click CodeLens resolution.</li>
                <li>True state-based verification: if the topology and files match, you win!</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 8. FOOTER */}
      <footer className="mt-auto border-t border-slate-800/80 bg-[#070A10] px-6 py-8 text-xs text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-slate-300">GitOps WarRoom</span>
            <span>·</span>
            <span>Production Git Incident Simulator</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <button
              onClick={() => setWelcomeOpen(true)}
              className="hover:text-slate-200 transition-colors"
            >
              Simulator Guide
            </button>
            <span>·</span>
            <button
              onClick={() => setViewMode('ide')}
              className="hover:text-slate-200 transition-colors"
            >
              Open IDE Viewport
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
