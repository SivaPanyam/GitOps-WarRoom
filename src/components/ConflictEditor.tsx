import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  FileCode,
  FileDiff,
  GitPullRequest,
  Play,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { getHeadCommit, hasConflictMarkers } from '../engine/gitEngine';
import { useGitStore } from '../store/useGitStore';
import { RebaseAction, RebaseTodoItem } from '../types/git';

const REBASE_ACTIONS: { value: RebaseAction; label: string; desc: string }[] = [
  { value: 'pick', label: 'pick', desc: 'Use commit as-is' },
  { value: 'reword', label: 'reword', desc: 'Use commit, edit message' },
  { value: 'squash', label: 'squash', desc: 'Meld into previous commit & keep message' },
  { value: 'fixup', label: 'fixup', desc: 'Meld into previous commit & discard message' },
  { value: 'drop', label: 'drop', desc: 'Remove commit from history completely' },
];

export const ConflictEditor: React.FC = () => {
  const {
    repo,
    selectedFile,
    selectFile,
    updateWorkingFile,
    stageFile,
    resolveConflictChoice,
    updateRebaseTodos,
    executeInteractiveRebase,
    abortInteractiveRebase,
    runTerminalCommand,
  } = useGitStore();

  const [viewMode, setViewMode] = useState<'editor' | 'diff'>('editor');

  const headCommit = getHeadCommit(repo);
  const headTree = headCommit ? headCommit.tree : {};

  // Collect all known files across HEAD, Staging, and Working Tree
  const allFileNames = Array.from(
    new Set([
      ...Object.keys(headTree),
      ...Object.keys(repo.stagingIndex),
      ...Object.keys(repo.workingTree),
    ])
  ).sort();

  const getFileStatus = (file: string) => {
    const inWork = repo.workingTree[file];
    const inStage = repo.stagingIndex[file];
    const inHead = headTree[file];

    if (
      repo.conflictedFiles.includes(file) ||
      (inWork && hasConflictMarkers(inWork))
    ) {
      return { code: 'C', label: 'Conflict', color: 'text-rose-400' };
    }
    if (inWork === undefined && inHead !== undefined) {
      return { code: 'D', label: 'Deleted', color: 'text-rose-400' };
    }
    if (inStage !== inWork) {
      if (inStage === undefined && inWork !== undefined) {
        return { code: 'U', label: 'Untracked', color: 'text-sky-400' };
      }
      return { code: 'M', label: 'Modified', color: 'text-amber-400' };
    }
    if (inHead !== inStage) {
      return { code: 'S', label: 'Staged', color: 'text-emerald-400' };
    }
    return { code: '', label: 'Tracked', color: 'text-slate-400' };
  };

  const isInteractiveTodoActive =
    repo.interactiveRebase && repo.interactiveRebase.phase === 'todo';

  const currentContent = repo.workingTree[selectedFile] ?? '';
  const stagedContent = repo.stagingIndex[selectedFile] ?? '';
  const headContent = headTree[selectedFile] ?? '';
  const fileHasConflict = hasConflictMarkers(currentContent);
  const isModifiedUnstaged = currentContent !== stagedContent && !fileHasConflict;
  const isStagedAndClean =
    currentContent === stagedContent &&
    stagedContent !== headContent &&
    !fileHasConflict;

  const handleTodoActionChange = (idx: number, action: RebaseAction) => {
    if (!repo.interactiveRebase) return;
    const next = [...repo.interactiveRebase.todos];
    next[idx] = { ...next[idx], action };
    updateRebaseTodos(next);
  };

  const handleTodoMessageChange = (idx: number, message: string) => {
    if (!repo.interactiveRebase) return;
    const next = [...repo.interactiveRebase.todos];
    next[idx] = { ...next[idx], message };
    updateRebaseTodos(next);
  };

  const handleMoveTodo = (idx: number, direction: -1 | 1) => {
    if (!repo.interactiveRebase) return;
    const next = [...repo.interactiveRebase.todos];
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= next.length) return;
    const temp = next[idx];
    next[idx] = next[targetIdx];
    next[targetIdx] = temp;
    updateRebaseTodos(next);
  };

  const handleQuickSquashPreset = () => {
    if (!repo.interactiveRebase) return;
    const next: RebaseTodoItem[] = repo.interactiveRebase.todos.map(
      (item, idx) => ({
        ...item,
        action: idx === 0 ? 'reword' : 'fixup',
        message:
          idx === 0 ? 'feat(config): enable rate limiting' : item.message,
      })
    );
    updateRebaseTodos(next);
  };

  return (
    <div className="flex h-full w-full bg-[#0B0F17] text-slate-200 select-none overflow-hidden">
      {/* Left File Explorer Sidebar */}
      <div className="w-56 shrink-0 border-r border-slate-800/80 bg-[#0D131F] flex flex-col">
        <div className="px-3.5 py-2.5 border-b border-slate-800/80 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300 tracking-wide">
            Workspace Files
          </span>
          <span className="text-xs font-mono text-slate-500 tabular-nums">
            {allFileNames.length}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto py-1.5">
          {allFileNames.map((file) => {
            const status = getFileStatus(file);
            const isSelected = selectedFile === file && !isInteractiveTodoActive;
            const isDeleted = repo.workingTree[file] === undefined;

            return (
              <button
                key={file}
                onClick={() => selectFile(file)}
                className={`w-full px-3 py-1.5 text-left flex items-center justify-between gap-2 text-xs transition-colors ${
                  isSelected
                    ? 'bg-sky-500/15 text-sky-200 font-medium'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileCode className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                  <span
                    className={`font-mono truncate ${
                      isDeleted ? 'line-through text-slate-500' : ''
                    }`}
                  >
                    {file}
                  </span>
                </div>
                {status.code && (
                  <span
                    className={`font-mono text-[11px] font-semibold shrink-0 ${status.color}`}
                    title={status.label}
                  >
                    {status.code}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Quick Git Status Summary Footer in File Tree */}
        <div className="p-3 border-t border-slate-800/80 bg-[#0B0F17]/60 text-[11px] text-slate-400 space-y-1">
          <div className="flex items-center justify-between">
            <span>HEAD Ref</span>
            <span className="font-mono text-slate-200 truncate max-w-[110px]">
              {repo.head.type === 'branch'
                ? repo.head.ref
                : `${repo.head.ref} (detached)`}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Conflicts</span>
            <span
              className={`font-mono tabular-nums ${
                repo.conflictedFiles.length > 0
                  ? 'text-rose-400 font-semibold'
                  : 'text-emerald-400'
              }`}
            >
              {repo.conflictedFiles.length}
            </span>
          </div>
        </div>
      </div>

      {/* Main Code / Conflict / Interactive Rebase Editor Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0B0F17]">
        {isInteractiveTodoActive && repo.interactiveRebase ? (
          /* INTERACTIVE REBASE TODO EDITOR */
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-900/70 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <GitPullRequest className="w-4 h-4 text-sky-400 shrink-0" />
                <span className="text-xs font-mono font-semibold text-slate-100 truncate">
                  git-rebase-todo — Interactive Rebase onto{' '}
                  {repo.interactiveRebase.targetName} (
                  {repo.interactiveRebase.baseSha})
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {repo.interactiveRebase.todos.length >= 4 && (
                  <button
                    onClick={handleQuickSquashPreset}
                    className="px-2.5 py-1 text-xs font-medium text-sky-300 bg-sky-500/10 border border-sky-500/30 rounded hover:bg-sky-500/20 transition-colors whitespace-nowrap shrink-0"
                  >
                    Auto-Configure Squash Into 1 Commit
                  </button>
                )}
                <button
                  onClick={abortInteractiveRebase}
                  className="px-2.5 py-1 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="w-3 h-3" />
                  Abort Rebase
                </button>
                <button
                  onClick={executeInteractiveRebase}
                  className="px-3 py-1 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Play className="w-3 h-3 fill-current" />
                  Execute Rebase
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <p className="text-xs text-slate-400 leading-relaxed">
                Commits are listed oldest-to-newest (top to bottom). Toggle{' '}
                <code className="text-sky-300">pick</code>,{' '}
                <code className="text-amber-300">reword</code>,{' '}
                <code className="text-purple-300">squash</code>,{' '}
                <code className="text-indigo-300">fixup</code>, or{' '}
                <code className="text-rose-300">drop</code>, reorder commits, or
                edit commit messages inline before executing.
              </p>

              <div className="space-y-2">
                {repo.interactiveRebase.todos.map((item, idx) => (
                  <div
                    key={item.sha}
                    className={`p-3 rounded-lg border transition-colors ${
                      item.action === 'drop'
                        ? 'border-rose-900/50 bg-rose-950/15 opacity-60'
                        : 'border-slate-800 bg-slate-900/60'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      {/* Action selector buttons */}
                      <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-md border border-slate-800">
                        {REBASE_ACTIONS.map((act) => (
                          <button
                            key={act.value}
                            onClick={() =>
                              handleTodoActionChange(idx, act.value)
                            }
                            title={act.desc}
                            className={`px-2 py-1 text-[11px] font-mono rounded transition-colors whitespace-nowrap shrink-0 ${
                              item.action === act.value
                                ? act.value === 'drop'
                                  ? 'bg-rose-500/20 text-rose-300 font-semibold'
                                  : act.value === 'squash' ||
                                    act.value === 'fixup'
                                  ? 'bg-purple-500/20 text-purple-300 font-semibold'
                                  : act.value === 'reword'
                                  ? 'bg-amber-500/20 text-amber-300 font-semibold'
                                  : 'bg-sky-500/20 text-sky-300 font-semibold'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {act.label}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                        <span className="font-mono text-xs text-sky-400 shrink-0">
                          {item.sha}
                        </span>
                        <input
                          type="text"
                          value={item.message}
                          onChange={(e) =>
                            handleTodoMessageChange(idx, e.target.value)
                          }
                          className="flex-1 bg-slate-950/90 border border-slate-800 focus:border-sky-500/60 rounded px-2.5 py-1 text-xs font-mono text-slate-100 outline-none"
                          placeholder="Commit message..."
                        />
                      </div>

                      {/* Reorder buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleMoveTodo(idx, -1)}
                          disabled={idx === 0}
                          className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-30 rounded hover:bg-slate-800"
                          title="Move commit up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMoveTodo(idx, 1)}
                          disabled={
                            idx === repo.interactiveRebase!.todos.length - 1
                          }
                          className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-30 rounded hover:bg-slate-800"
                          title="Move commit down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* STANDARD FILE & 3-WAY CONFLICT EDITOR */
          <>
            {/* Editor Header Tab Bar */}
            <div className="px-4 py-2 border-b border-slate-800/80 bg-[#0D131F] flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-xs font-semibold text-slate-200 truncate">
                  {selectedFile || 'No file selected'}
                </span>
                {fileHasConflict && (
                  <span className="text-xs text-rose-400 font-medium flex items-center gap-1 shrink-0">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Unresolved Merge Conflict
                  </span>
                )}
                {isModifiedUnstaged && (
                  <span className="text-xs text-amber-400 font-medium shrink-0">
                    · Modified (Unstaged)
                  </span>
                )}
                {isStagedAndClean && (
                  <span className="text-xs text-emerald-400 font-medium flex items-center gap-1 shrink-0">
                    <Check className="w-3.5 h-3.5" />
                    Staged in Index
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {selectedFile && !fileHasConflict && isModifiedUnstaged && (
                  <button
                    onClick={() => stageFile(selectedFile)}
                    className="px-2.5 py-1 text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded hover:bg-emerald-500/25 transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3 h-3" />
                    Stage File (git add)
                  </button>
                )}

                {selectedFile === '.env.production' && (
                  <button
                    onClick={() =>
                      runTerminalCommand('git rm .env.production')
                    }
                    className="px-2.5 py-1 text-xs font-medium bg-rose-500/15 text-rose-300 border border-rose-500/30 rounded hover:bg-rose-500/25 transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                    git rm .env.production
                  </button>
                )}

                <div className="flex items-center bg-slate-900 p-0.5 rounded border border-slate-800">
                  <button
                    onClick={() => setViewMode('editor')}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                      viewMode === 'editor'
                        ? 'bg-slate-800 text-slate-100'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Code Editor
                  </button>
                  <button
                    onClick={() => setViewMode('diff')}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 ${
                      viewMode === 'diff'
                        ? 'bg-slate-800 text-slate-100'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <FileDiff className="w-3 h-3" />
                    Diff vs HEAD
                  </button>
                </div>
              </div>
            </div>

            {/* 3-Way Conflict Resolution Action Banner (CodeLens) */}
            {fileHasConflict && (
              <div className="px-4 py-2.5 bg-rose-950/30 border-b border-rose-500/30 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-rose-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>
                    3-Way Merge Conflict detected in{' '}
                    <code className="font-mono font-semibold">
                      {selectedFile}
                    </code>
                    . Use quick CodeLens actions or edit the file directly:
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() =>
                      resolveConflictChoice(selectedFile, 'current')
                    }
                    className="px-2.5 py-1 text-xs font-medium bg-sky-500/15 text-sky-300 border border-sky-500/30 rounded hover:bg-sky-500/25 transition-colors whitespace-nowrap shrink-0"
                  >
                    Accept Current (HEAD)
                  </button>
                  <button
                    onClick={() =>
                      resolveConflictChoice(selectedFile, 'incoming')
                    }
                    className="px-2.5 py-1 text-xs font-medium bg-purple-500/15 text-purple-300 border border-purple-500/30 rounded hover:bg-purple-500/25 transition-colors whitespace-nowrap shrink-0"
                  >
                    Accept Incoming
                  </button>
                  <button
                    onClick={() => resolveConflictChoice(selectedFile, 'both')}
                    className="px-2.5 py-1 text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded hover:bg-emerald-500/30 transition-colors whitespace-nowrap shrink-0"
                  >
                    Accept Both (Smart Merge)
                  </button>
                </div>
              </div>
            )}

            {/* Main Code Body */}
            <div className="flex-1 overflow-auto relative flex">
              {viewMode === 'editor' ? (
                <div className="flex-1 flex min-h-full font-mono text-xs leading-6">
                  {/* Line Numbers Gutter */}
                  <div className="w-11 py-3 bg-[#090D14] border-r border-slate-800/60 text-right pr-3 text-slate-600 select-none shrink-0 tabular-nums">
                    {currentContent.split('\n').map((_, i) => (
                      <div key={i}>{i + 1}</div>
                    ))}
                  </div>

                  {/* Highlighted Backdrop + Editable Textarea Overlay */}
                  <div className="relative flex-1 min-h-full">
                    <div
                      aria-hidden="true"
                      className="pointer-events-none p-3 whitespace-pre font-mono text-xs leading-6"
                    >
                      {currentContent.split('\n').map((line, idx) => {
                        let lineBg = '';
                        let textClass = 'text-slate-200';
                        if (line.startsWith('<<<<<<<')) {
                          lineBg = 'bg-sky-500/20 -mx-3 px-3';
                          textClass = 'text-sky-300 font-bold';
                        } else if (line.startsWith('=======')) {
                          lineBg = 'bg-amber-500/20 -mx-3 px-3';
                          textClass = 'text-amber-300 font-bold';
                        } else if (line.startsWith('>>>>>>>')) {
                          lineBg = 'bg-purple-500/20 -mx-3 px-3';
                          textClass = 'text-purple-300 font-bold';
                        } else if (line.trim().startsWith('//') || line.trim().startsWith('#')) {
                          textClass = 'text-slate-500 italic';
                        } else if (
                          line.includes('AWS_SECRET_ACCESS_KEY') ||
                          line.includes('STRIPE_LIVE_SECRET')
                        ) {
                          lineBg = 'bg-rose-500/15 -mx-3 px-3';
                          textClass = 'text-rose-300 font-semibold';
                        }
                        return (
                          <div key={idx} className={`${lineBg} ${textClass} min-h-[24px]`}>
                            {line || ' '}
                          </div>
                        );
                      })}
                    </div>
                    <textarea
                      value={currentContent}
                      onChange={(e) =>
                        updateWorkingFile(selectedFile, e.target.value)
                      }
                      spellCheck={false}
                      className="absolute inset-0 w-full h-full p-3 bg-transparent text-transparent caret-sky-400 resize-none outline-none font-mono text-xs leading-6 whitespace-pre overflow-hidden"
                    />
                  </div>
                </div>
              ) : (
                /* Side-by-Side Diff View (HEAD vs Working Tree) */
                <div className="flex-1 grid grid-cols-2 divide-x divide-slate-800 font-mono text-xs">
                  <div className="p-3 overflow-auto">
                    <div className="text-[11px] font-sans font-semibold text-slate-400 mb-2 pb-1.5 border-b border-slate-800 flex items-center justify-between">
                      <span>HEAD Snapshot ({headCommit?.sha || 'none'})</span>
                      <span className="font-mono">{selectedFile}</span>
                    </div>
                    <pre className="leading-6 text-slate-400 whitespace-pre-wrap">
                      {headContent || '(File did not exist in HEAD)'}
                    </pre>
                  </div>
                  <div className="p-3 overflow-auto">
                    <div className="text-[11px] font-sans font-semibold text-sky-400 mb-2 pb-1.5 border-b border-slate-800 flex items-center justify-between">
                      <span>Working Tree (Live)</span>
                      <span className="font-mono">{selectedFile}</span>
                    </div>
                    <pre className="leading-6 text-slate-100 whitespace-pre-wrap">
                      {currentContent || '(File deleted in working tree)'}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
