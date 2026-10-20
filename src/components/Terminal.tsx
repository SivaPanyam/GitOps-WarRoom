import React, { useEffect, useRef, useState } from 'react';
import {
  AlertOctagon,
  ChevronRight,
  Cloud,
  CornerDownLeft,
  FileCode,
  GitBranch,
  GitCommit as GitCommitIcon,
  Sparkles,
  Tag,
  Terminal as TerminalIcon,
  Trash2,
  X,
} from 'lucide-react';
import {
  AutocompleteCategory,
  AutocompleteItem,
  getAutocompleteSuggestions,
} from '../engine/gitAutocomplete';
import { isWorkingTreeClean } from '../engine/gitEngine';
import { useGitStore } from '../store/useGitStore';

export const Terminal: React.FC = () => {
  const {
    repo,
    activeScenario,
    terminalLogs,
    commandHistory,
    runTerminalCommand,
  } = useGitStore();

  const [input, setInput] = useState('');
  const [historyIdx, setHistoryIdx] = useState<number>(-1);

  // Autocomplete popup state
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<AutocompleteItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [replaceRange, setReplaceRange] = useState<'append' | 'last-token' | 'full'>('full');

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popupListRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal logs to bottom
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop =
        scrollContainerRef.current.scrollHeight;
    }
  }, [terminalLogs]);

  // Keep active suggestion in view in popup
  useEffect(() => {
    if (popupListRef.current && isPopupOpen) {
      const activeEl = popupListRef.current.children[selectedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, isPopupOpen]);

  const headLabel =
    repo.head.type === 'branch'
      ? repo.head.ref
      : `detached@${repo.head.ref}`;

  const isClean = isWorkingTreeClean(repo);

  const applySuggestion = (item: AutocompleteItem) => {
    if (item.fullCommandReplacement) {
      setInput(item.fullCommandReplacement);
    } else if (replaceRange === 'full') {
      setInput(item.value + ' ');
    } else if (replaceRange === 'append') {
      const base = input.trimEnd();
      setInput(`${base} ${item.value} `);
    } else {
      // replaceRange === 'last-token'
      const tokens = input.trimStart().split(/\s+/);
      tokens[tokens.length - 1] = item.value;
      setInput(tokens.join(' ') + ' ');
    }

    setIsPopupOpen(false);
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);

    // If popup is open, update suggestions live
    if (isPopupOpen) {
      const res = getAutocompleteSuggestions(val, repo, activeScenario);
      if (res.items.length === 0) {
        setIsPopupOpen(false);
      } else {
        setSuggestions(res.items);
        setReplaceRange(res.replaceRange);
        setSelectedIndex(0);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Escape closes the autocomplete popup
    if (e.key === 'Escape') {
      if (isPopupOpen) {
        e.preventDefault();
        setIsPopupOpen(false);
        return;
      }
    }

    // Tab key: trigger completion or navigate candidates
    if (e.key === 'Tab') {
      e.preventDefault();
      if (!isPopupOpen) {
        const res = getAutocompleteSuggestions(input, repo, activeScenario);
        if (res.items.length === 1) {
          // Exactly 1 match: complete directly
          applySuggestion(res.items[0]);
        } else if (res.items.length > 1) {
          // Multiple matches: open popup
          setSuggestions(res.items);
          setReplaceRange(res.replaceRange);
          setSelectedIndex(0);
          setIsPopupOpen(true);
        }
      } else {
        // Already open: cycle through items
        if (e.shiftKey) {
          setSelectedIndex((prev) =>
            prev <= 0 ? suggestions.length - 1 : prev - 1
          );
        } else {
          setSelectedIndex((prev) =>
            prev >= suggestions.length - 1 ? 0 : prev + 1
          );
        }
      }
      return;
    }

    // Arrow navigation when popup is open
    if (isPopupOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev >= suggestions.length - 1 ? 0 : prev + 1
        );
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev <= 0 ? suggestions.length - 1 : prev - 1
        );
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (suggestions[selectedIndex]) {
          applySuggestion(suggestions[selectedIndex]);
        }
        return;
      }
    }

    // Normal command execution when popup is closed
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!input.trim()) return;
      runTerminalCommand(input);
      setInput('');
      setHistoryIdx(-1);
      setIsPopupOpen(false);
      return;
    }

    // History navigation when popup is closed
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length === 0) return;
      const nextIdx =
        historyIdx === -1
          ? commandHistory.length - 1
          : Math.max(0, historyIdx - 1);
      setHistoryIdx(nextIdx);
      setInput(commandHistory[nextIdx]);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx === -1) return;
      if (historyIdx + 1 >= commandHistory.length) {
        setHistoryIdx(-1);
        setInput('');
      } else {
        const nextIdx = historyIdx + 1;
        setHistoryIdx(nextIdx);
        setInput(commandHistory[nextIdx]);
      }
      return;
    }
  };

  const renderCategoryIcon = (category: AutocompleteCategory) => {
    switch (category) {
      case 'branch':
        return <GitBranch className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
      case 'remote':
        return <Cloud className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
      case 'tag':
        return <Tag className="w-3.5 h-3.5 text-amber-300 shrink-0" />;
      case 'file':
        return <FileCode className="w-3.5 h-3.5 text-indigo-400 shrink-0" />;
      case 'commit':
        return <GitCommitIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
      case 'flag':
        return <Sparkles className="w-3.5 h-3.5 text-pink-400 shrink-0" />;
      case 'action':
        return <CornerDownLeft className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      default:
        return <TerminalIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    }
  };

  // Quick suggestions bar
  const quickSuggestions: string[] = [
    'git status',
    'git log --oneline --all',
    'git reflog',
    ...activeScenario.optimalCommands.slice(0, 3),
  ];

  return (
    <div
      className="flex flex-col h-full w-full bg-[#070A10] text-slate-200 font-mono text-xs overflow-hidden relative"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Terminal Header Bar */}
      <div className="px-4 py-2 border-b border-slate-800/80 bg-[#0D131F] flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <TerminalIcon className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span className="font-sans text-xs font-semibold text-slate-200 whitespace-nowrap">
            Interactive Git Shell
          </span>
          <span className="text-slate-600">·</span>
          <span className="text-[11px] text-slate-400 truncate">
            Press Tab for dynamic suggestions · Up/Down for history
          </span>
        </div>

        {/* Quick Command Suggestions */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {quickSuggestions.slice(0, 4).map((cmd) => (
            <button
              key={cmd}
              onClick={(e) => {
                e.stopPropagation();
                runTerminalCommand(cmd);
              }}
              className="px-2 py-0.5 text-[11px] font-mono text-slate-300 bg-slate-900 hover:bg-slate-800 hover:text-sky-300 border border-slate-800 rounded transition-colors whitespace-nowrap shrink-0"
              title={`Click to execute: ${cmd}`}
            >
              {cmd}
            </button>
          ))}
          <button
            onClick={(e) => {
              e.stopPropagation();
              runTerminalCommand('clear');
            }}
            className="p-1 text-slate-500 hover:text-slate-300 rounded hover:bg-slate-800 transition-colors shrink-0"
            title="Clear terminal"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Scrollable Output History */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 select-text"
      >
        {terminalLogs.map((item) => (
          <div key={item.id} className="space-y-1">
            {item.command && (
              <div className="flex items-center gap-2 text-slate-300">
                <span className="text-emerald-400 font-semibold">
                  oncall@warroom
                </span>
                <span className="text-slate-500">:</span>
                <span className="text-sky-400 font-semibold">
                  ({item.branchPrompt})
                </span>
                <span className="text-slate-500">$</span>
                <span className="text-slate-100 font-semibold">
                  {item.command}
                </span>
              </div>
            )}

            {item.type === 'slack-alert' ? (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-200 flex items-start gap-2.5 my-1">
                <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="text-xs font-sans leading-relaxed">
                  {item.output}
                </div>
              </div>
            ) : (
              item.output && (
                <pre
                  className={`whitespace-pre-wrap leading-relaxed pl-2 ${
                    item.type === 'error'
                      ? 'text-rose-400'
                      : item.type === 'warning'
                      ? 'text-amber-300'
                      : item.type === 'success'
                      ? 'text-emerald-300'
                      : 'text-slate-300'
                  }`}
                >
                  {item.output}
                </pre>
              )
            )}
          </div>
        ))}
      </div>

      {/* Interactive Autocomplete Suggestions Popup */}
      {isPopupOpen && suggestions.length > 0 && (
        <div className="absolute bottom-[46px] left-4 right-4 sm:right-auto sm:min-w-[440px] max-w-xl bg-[#0D131F]/98 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-2xl z-40 overflow-hidden flex flex-col text-xs animate-in fade-in slide-in-from-bottom-2 duration-150">
          {/* Popup Header */}
          <div className="px-3 py-1.5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400 select-none">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sky-400 font-mono">
                Tab Suggestions ({suggestions.length})
              </span>
              <span>·</span>
              <span className="text-slate-500">Tab / ↑↓ navigate · ↵ select</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsPopupOpen(false);
              }}
              className="text-slate-500 hover:text-slate-300 p-0.5 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Popup List */}
          <div
            ref={popupListRef}
            className="max-h-56 overflow-y-auto divide-y divide-slate-800/40 p-1"
          >
            {suggestions.map((item, idx) => {
              const isSelected = selectedIndex === idx;
              return (
                <div
                  key={item.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    applySuggestion(item);
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`px-2.5 py-1.5 rounded-md cursor-pointer transition-colors flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-sky-500/20 text-sky-100 font-medium'
                      : 'text-slate-300 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {renderCategoryIcon(item.category)}
                    <span className="font-mono font-semibold truncate text-slate-100">
                      {item.display}
                    </span>
                    {item.description && (
                      <span className="text-[11px] font-sans text-slate-400 truncate max-w-[200px]">
                        {item.description}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 shrink-0 uppercase tracking-wider">
                    {item.categoryLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Command Input Line */}
      <div className="px-4 py-2.5 border-t border-slate-800/80 bg-[#0B0F17] flex items-center gap-2 shrink-0 z-30">
        <span className="text-emerald-400 font-semibold shrink-0">
          oncall@warroom
        </span>
        <span className="text-sky-400 font-semibold shrink-0">
          ({headLabel}
          {repo.bisect.active ? '|BISECTING' : ''}
          {repo.interactiveRebase ? '|REBASE' : ''}
          {!isClean ? ' *' : ''})
        </span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a git command (Press Tab to autocomplete...)"
          className="flex-1 bg-transparent text-slate-100 placeholder-slate-600 outline-none font-mono text-xs"
          autoFocus
        />
        <button
          onClick={() => {
            if (!input.trim()) return;
            runTerminalCommand(input);
            setInput('');
            setIsPopupOpen(false);
          }}
          className="px-2.5 py-1 text-[11px] font-sans font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded flex items-center gap-1 transition-colors shrink-0"
        >
          <span>Run</span>
          <CornerDownLeft className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
