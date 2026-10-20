import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Compass,
  FileText,
  Flame,
  FolderGit2,
  HelpCircle,
  Info,
  LayoutDashboard,
  RotateCcw,
  Sparkles,
  Terminal as TerminalIcon,
  Workflow,
} from 'lucide-react';
import { ConflictEditor } from './components/ConflictEditor';
import { GitGraph } from './components/GitGraph';
import { InternalsInspector } from './components/InternalsInspector';
import { LandingDashboard } from './components/LandingDashboard';
import { WarRoomModals } from './components/Modals';
import { Terminal } from './components/Terminal';
import { SCENARIOS } from './scenarios/scenarios';
import { useGitStore } from './store/useGitStore';

export default function App() {
  const {
    viewMode,
    setViewMode,
    activeScenario,
    assertions,
    selectScenario,
    resetScenario,
    setBriefingOpen,
    setHintModalOpen,
    setPostMortemOpen,
    setWelcomeOpen,
    setScenarioCatalogOpen,
    badges,
  } = useGitStore();

  // Resizable 4-pane split percentages
  const [leftColWidth, setLeftColWidth] = useState(48); // %
  const [leftTopHeight, setLeftTopHeight] = useState(55); // %
  const [rightTopHeight, setRightTopHeight] = useState(58); // %

  // Collapsible Quick-Guide Ribbon on the page
  const [showQuickGuide, setShowQuickGuide] = useState(false);

  const draggingRef = useRef<'col' | 'leftRow' | 'rightRow' | null>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!draggingRef.current || !workspaceRef.current) return;
    const rect = workspaceRef.current.getBoundingClientRect();

    if (draggingRef.current === 'col') {
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftColWidth(Math.min(72, Math.max(28, pct)));
    } else if (draggingRef.current === 'leftRow') {
      const pct = ((e.clientY - rect.top) / rect.height) * 100;
      setLeftTopHeight(Math.min(78, Math.max(24, pct)));
    } else if (draggingRef.current === 'rightRow') {
      const pct = ((e.clientY - rect.top) / rect.height) * 100;
      setRightTopHeight(Math.min(78, Math.max(24, pct)));
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    draggingRef.current = null;
    document.body.style.cursor = '';
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const passedCount = assertions.filter((a) => a.passed).length;
  const allPassed = passedCount === assertions.length;
  const unlockedBadgesCount = badges.filter((b) => b.unlockedAt).length;

  // Render Landing Dashboard if viewMode === 'landing'
  if (viewMode === 'landing') {
    return (
      <>
        <LandingDashboard />
        <WarRoomModals />
      </>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0B0F17] text-slate-100 overflow-hidden font-sans">
      {/* Zone 1: Top Navigation Bar (Strict 3-Zone Contract) */}
      <header className="flex items-center justify-between gap-6 px-5 py-2.5 border-b border-slate-800/90 bg-[#090D14] shrink-0">
        {/* Zone 1 Left: Brand & Dashboard Link */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setViewMode('landing')}
            className="flex items-center gap-2.5 group text-left"
            title="Return to Landing Page & Dashboard"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-sky-400/20 to-indigo-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400 group-hover:border-sky-400 transition-colors">
              <Flame className="w-4 h-4 text-amber-400" />
            </div>
            <span className="text-sm font-bold tracking-tight text-slate-100 group-hover:text-white transition-colors">
              GitOps WarRoom
            </span>
          </button>
          <span className="text-[11px] font-mono text-slate-500 hidden sm:inline-block border-l border-slate-800 pl-3">
            SEV IDE Cockpit
          </span>
        </div>

        {/* Zone 2 Center: Primary Navigation Controls */}
        <nav className="flex items-center gap-2 text-xs font-medium">
          <button
            onClick={() => setViewMode('landing')}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 transition-all flex items-center gap-1.5"
            title="Open Mission Dashboard & Landing Page"
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-sky-400" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => setWelcomeOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-sky-300 hover:text-sky-200 border border-slate-800 hover:border-slate-700 transition-all flex items-center gap-1.5"
            title="Overview: What is GitOps WarRoom & How to play"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>What & How</span>
          </button>

          <button
            onClick={() => setScenarioCatalogOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-slate-100 border border-slate-800 hover:border-slate-700 transition-all flex items-center gap-1.5"
            title="Browse all 14 production scenarios"
          >
            <FolderGit2 className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden md:inline">Browse Incidents</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20">
              14
            </span>
          </button>

          <button
            onClick={() => setHintModalOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-slate-100 border border-slate-800 hover:border-slate-700 transition-all flex items-center gap-1.5 hidden lg:flex"
            title="View Staff SRE runbook hints"
          >
            <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Staff Runbook</span>
          </button>
        </nav>

        {/* Zone 3 Right: Primary CTA (Mission Briefing) */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setShowQuickGuide((prev) => !prev)}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 ${
              showQuickGuide
                ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800'
            }`}
            title="Toggle Quick Simulator Walkthrough"
          >
            <Info className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Walkthrough</span>
            {showQuickGuide ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>

          <button
            onClick={() => setBriefingOpen(true)}
            className="px-4 py-1.5 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 shadow-sm shadow-sky-500/10"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Mission Briefing</span>
          </button>
        </div>
      </header>

      {/* Collapsible "What this is & How to play" Quick-Start Ribbon */}
      {showQuickGuide && (
        <div className="px-5 py-3 border-b border-sky-500/20 bg-gradient-to-r from-sky-950/40 via-slate-900/80 to-indigo-950/40 flex flex-wrap items-center justify-between gap-4 text-xs shrink-0 animate-in slide-in-from-top-1 duration-150">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-md bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
              <Workflow className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="font-semibold text-slate-100">How to Play GitOps WarRoom: </span>
              <span className="text-slate-300">
                1. Read the Slack & Jira briefing → 2. Inspect the live DAG & 3 Trees → 3. Use Terminal (press <kbd className="px-1 py-0.5 rounded bg-slate-800 text-sky-300 font-mono">Tab</kbd> for smart autocomplete) or 1-click CodeLens → 4. Verification assertions turn green!
              </span>
            </div>
          </div>
          <button
            onClick={() => setWelcomeOpen(true)}
            className="px-3 py-1 rounded bg-sky-400/20 text-sky-300 hover:bg-sky-400/30 font-medium text-[11px] shrink-0 transition-colors"
          >
            Open Full Guide Modal →
          </button>
        </div>
      )}

      {/* Secondary Workspace Incident Toolbar */}
      <div className="px-5 py-2 border-b border-slate-800/80 bg-[#0D131F] flex flex-wrap items-center justify-between gap-4 shrink-0 text-xs">
        {/* Left: Scenario Dropdown & Live Incident Ticker */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <select
            aria-label="Select Git Incident Scenario"
            value={activeScenario.id}
            onChange={(e) => selectScenario(e.target.value)}
            className="bg-slate-900 border border-slate-700/80 hover:border-slate-600 text-slate-100 text-xs font-medium rounded-md px-2.5 py-1.5 outline-none focus:border-sky-400 shrink-0 max-w-xs truncate"
          >
            <optgroup label="Junior On-Call (Scenarios 1, 2, 6, 8, 12)">
              {SCENARIOS.filter((s) => s.difficulty === 'Junior').map((s) => (
                <option key={s.id} value={s.id}>
                  #{s.number.toString().padStart(2, '0')}: {s.title}
                </option>
              ))}
            </optgroup>
            <optgroup label="Mid-Level Incidents (Scenarios 3, 4, 5, 10, 11)">
              {SCENARIOS.filter((s) => s.difficulty === 'Mid-Level').map((s) => (
                <option key={s.id} value={s.id}>
                  #{s.number.toString().padStart(2, '0')}: {s.title}
                </option>
              ))}
            </optgroup>
            <optgroup label="Senior / Staff & GitHub Workflows (Scenarios 7, 9, 13, 14)">
              {SCENARIOS.filter((s) => s.difficulty === 'Senior / Staff').map(
                (s) => (
                  <option key={s.id} value={s.id}>
                    #{s.number.toString().padStart(2, '0')}: {s.title}
                  </option>
                )
              )}
            </optgroup>
          </select>

          <span className="text-slate-600 hidden sm:inline">·</span>

          <div className="flex items-center gap-2 min-w-0 truncate">
            {allPassed ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              </div>
            )}
            <span
              className={`font-mono font-semibold truncate ${
                allPassed ? 'text-emerald-300' : 'text-rose-300'
              }`}
            >
              {allPassed
                ? `RESOLVED: ${activeScenario.jira.key} — All Production Checks Passing`
                : activeScenario.incidentTicker}
            </span>
          </div>
        </div>

        {/* Right: Assertions Progress, Hint / Staff Runbook, Reset Scenario */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() =>
              allPassed ? setPostMortemOpen(true) : setBriefingOpen(true)
            }
            className={`px-3 py-1 rounded-md border font-mono text-xs transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 tabular-nums ${
              allPassed
                ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300 font-semibold'
                : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-sky-400" />
            <span>
              Assertions: {passedCount}/{assertions.length}
            </span>
          </button>

          <button
            onClick={() => setHintModalOpen(true)}
            className="px-3 py-1 rounded-md border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Hint / Runbook</span>
          </button>

          <button
            onClick={resetScenario}
            className="px-3 py-1 rounded-md border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Repo</span>
          </button>
        </div>
      </div>

      {/* 4-Zone Resizable War Room IDE Viewport */}
      <div
        ref={workspaceRef}
        className="flex-1 flex min-h-0 w-full overflow-hidden relative"
      >
        {/* LEFT COLUMN: Code/Conflict Editor (Top) + Interactive Git Terminal (Bottom) */}
        <div
          style={{ width: `${leftColWidth}%` }}
          className="flex flex-col h-full min-w-0 overflow-hidden"
        >
          <div
            style={{ height: `${leftTopHeight}%` }}
            className="w-full min-h-0 overflow-hidden"
          >
            <ConflictEditor />
          </div>

          {/* Horizontal Resizer Handle (Left Column) */}
          <div
            onMouseDown={() => {
              draggingRef.current = 'leftRow';
              document.body.style.cursor = 'row-resize';
            }}
            className="h-1.5 w-full bg-slate-900 hover:bg-sky-500/50 border-y border-slate-800 cursor-row-resize transition-colors shrink-0"
          />

          <div
            style={{ height: `${100 - leftTopHeight}%` }}
            className="w-full min-h-0 overflow-hidden"
          >
            <Terminal />
          </div>
        </div>

        {/* Vertical Resizer Handle (Center Column Split) */}
        <div
          onMouseDown={() => {
            draggingRef.current = 'col';
            document.body.style.cursor = 'col-resize';
          }}
          className="w-1.5 h-full bg-slate-900 hover:bg-sky-500/50 border-x border-slate-800 cursor-col-resize transition-colors shrink-0"
        />

        {/* RIGHT COLUMN: Live Git DAG Visualizer (Top) + .git Internals & Reflog Inspector (Bottom) */}
        <div
          style={{ width: `${100 - leftColWidth}%` }}
          className="flex flex-col h-full min-w-0 overflow-hidden"
        >
          <div
            style={{ height: `${rightTopHeight}%` }}
            className="w-full min-h-0 overflow-hidden"
          >
            <GitGraph />
          </div>

          {/* Horizontal Resizer Handle (Right Column) */}
          <div
            onMouseDown={() => {
              draggingRef.current = 'rightRow';
              document.body.style.cursor = 'row-resize';
            }}
            className="h-1.5 w-full bg-slate-900 hover:bg-sky-500/50 border-y border-slate-800 cursor-row-resize transition-colors shrink-0"
          />

          <div
            style={{ height: `${100 - rightTopHeight}%` }}
            className="w-full min-h-0 overflow-hidden"
          >
            <InternalsInspector />
          </div>
        </div>
      </div>

      {/* Drawers, Hints, Anti-Pattern Alerts, Welcome Guide, and Post-Mortem Modals */}
      <WarRoomModals />
    </div>
  );
}
