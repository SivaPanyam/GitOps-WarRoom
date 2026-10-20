import React from 'react';
import {
  Activity,
  CheckCircle2,
  Clock,
  FolderGit2,
  History,
  Workflow,
  XCircle,
} from 'lucide-react';
import { generateSha, getHeadCommit } from '../engine/gitEngine';
import { useGitStore } from '../store/useGitStore';
import { PipelineMonitor } from './PipelineMonitor';

export const InternalsInspector: React.FC = () => {
  const {
    repo,
    ciChecks,
    assertions,
    activeInspectorTab,
    setActiveInspectorTab,
    selectedCommitSha,
    setSelectedCommitSha,
    selectFile,
    runTerminalCommand,
    pipelineRuns,
  } = useGitStore();

  const headCommit = getHeadCommit(repo);
  const headTree = headCommit ? headCommit.tree : {};

  const allFiles = Array.from(
    new Set([
      ...Object.keys(headTree),
      ...Object.keys(repo.stagingIndex),
      ...Object.keys(repo.workingTree),
    ])
  ).sort();

  const blobHash = (content: string | undefined) =>
    content !== undefined ? generateSha(content) : 'deleted';

  return (
    <div className="flex flex-col h-full w-full bg-[#0B0F17] text-slate-200 overflow-hidden">
      {/* Header with Segmented Filter Controls */}
      <div className="px-4 py-2 border-b border-slate-800/80 bg-[#0D131F] flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-1 p-0.5 bg-slate-900 rounded-md border border-slate-800">
          <button
            onClick={() => setActiveInspectorTab('trees')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeInspectorTab === 'trees'
                ? 'bg-slate-800 text-slate-100 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderGit2 className="w-3.5 h-3.5 text-sky-400" />
            3-Trees (.git Index)
          </button>

          <button
            onClick={() => setActiveInspectorTab('reflog')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeInspectorTab === 'reflog'
                ? 'bg-slate-800 text-slate-100 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5 text-amber-400" />
            Live Reflog ({repo.reflog.length})
          </button>

          <button
            onClick={() => setActiveInspectorTab('cicd')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeInspectorTab === 'cicd'
                ? 'bg-slate-800 text-slate-100 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            CI/CD & Assertions ({assertions.filter((a) => a.passed).length}/
            {assertions.length})
          </button>

          <button
            onClick={() => setActiveInspectorTab('pipelines')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeInspectorTab === 'pipelines'
                ? 'bg-slate-800 text-slate-100 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Workflow className="w-3.5 h-3.5 text-purple-400" />
            GitHub Actions ({pipelineRuns.length})
          </button>
        </div>

        <div className="text-[11px] font-mono text-slate-500 truncate hidden sm:block">
          HEAD: {headCommit ? `${headCommit.sha} (${headCommit.message})` : 'none'}
        </div>
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeInspectorTab === 'trees' && (
          <div className="space-y-3">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>
                Comparing blob SHA checksums across Git’s 3 internal trees.
                Click any file row to inspect it in the Code Editor.
              </span>
            </div>

            <div className="border border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-medium">
                    <th className="py-2 px-3">File Path</th>
                    <th className="py-2 px-3">1. Working Tree</th>
                    <th className="py-2 px-3">2. Staging Index</th>
                    <th className="py-2 px-3">3. HEAD Commit</th>
                    <th className="py-2 px-3 text-right">Sync State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {allFiles.map((file) => {
                    const wHash = blobHash(repo.workingTree[file]);
                    const sHash = blobHash(repo.stagingIndex[file]);
                    const hHash = blobHash(headTree[file]);
                    const isSynced = wHash === sHash && sHash === hHash;
                    const isConflict = repo.conflictedFiles.includes(file);

                    return (
                      <tr
                        key={file}
                        onClick={() => selectFile(file)}
                        className="hover:bg-slate-900/60 cursor-pointer transition-colors"
                      >
                        <td className="py-2 px-3 text-slate-200 font-medium truncate max-w-[160px]">
                          {file}
                        </td>
                        <td
                          className={`py-2 px-3 tabular-nums ${
                            wHash !== sHash ? 'text-amber-300 font-semibold' : 'text-slate-400'
                          }`}
                        >
                          {wHash}
                        </td>
                        <td
                          className={`py-2 px-3 tabular-nums ${
                            sHash !== hHash ? 'text-emerald-300 font-semibold' : 'text-slate-400'
                          }`}
                        >
                          {sHash}
                        </td>
                        <td className="py-2 px-3 text-slate-400 tabular-nums">
                          {hHash}
                        </td>
                        <td className="py-2 px-3 text-right font-sans">
                          {isConflict ? (
                            <span className="text-rose-400 font-semibold">
                              Unmerged Conflict
                            </span>
                          ) : isSynced ? (
                            <span className="text-slate-500">Clean</span>
                          ) : wHash !== sHash ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                runTerminalCommand(`git add ${file}`);
                              }}
                              className="text-sky-400 hover:underline font-medium"
                            >
                              Stage (git add)
                            </button>
                          ) : (
                            <span className="text-emerald-400 font-medium">
                              Staged for commit
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeInspectorTab === 'reflog' && (
          <div className="space-y-2.5">
            <div className="text-xs text-slate-400">
              Click any <code className="font-mono text-amber-300">HEAD@&#123;n&#125;</code> entry to highlight that commit in the DAG visualizer above, or restore directly.
            </div>
            <div className="border border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-medium">
                    <th className="py-2 px-3">Ref</th>
                    <th className="py-2 px-3">SHA</th>
                    <th className="py-2 px-3">Action</th>
                    <th className="py-2 px-3">Details</th>
                    <th className="py-2 px-3 text-right">Quick Recovery</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {repo.reflog.map((entry) => {
                    const isSelected = selectedCommitSha === entry.sha;
                    return (
                      <tr
                        key={`${entry.index}-${entry.sha}`}
                        onClick={() => setSelectedCommitSha(entry.sha)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-sky-500/15 text-sky-200'
                            : 'hover:bg-slate-900/60 text-slate-300'
                        }`}
                      >
                        <td className="py-2 px-3 text-amber-300 font-semibold tabular-nums whitespace-nowrap">
                          HEAD@&#123;{entry.index}&#125;
                        </td>
                        <td className="py-2 px-3 text-sky-400 font-semibold tabular-nums">
                          {entry.sha}
                        </td>
                        <td className="py-2 px-3 text-slate-400 whitespace-nowrap">
                          {entry.action}
                        </td>
                        <td className="py-2 px-3 font-sans text-slate-200 truncate max-w-[220px]">
                          {entry.message}
                        </td>
                        <td className="py-2 px-3 text-right whitespace-nowrap">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              runTerminalCommand(`git reset --hard ${entry.sha}`);
                            }}
                            className="px-2 py-0.5 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors"
                          >
                            reset --hard {entry.sha}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeInspectorTab === 'cicd' && (
          <div className="space-y-4">
            {/* Simulated GitHub Actions CI/CD Checks */}
            <div>
              <h4 className="text-xs font-semibold text-slate-300 mb-2">
                Simulated CI/CD Pipeline Checks
              </h4>
              <div className="space-y-2">
                {ciChecks.map((check) => (
                  <div
                    key={check.id}
                    className="p-2.5 rounded-lg border border-slate-800 bg-slate-900/50 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      {check.status === 'passing' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-slate-200">
                            {check.name}
                          </span>
                          <span className="text-slate-600">·</span>
                          <span className="font-mono text-[11px] text-slate-400">
                            {check.targetRef}
                          </span>
                        </div>
                        <p className="text-slate-400 text-[11px] mt-0.5 truncate">
                          {check.summary}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500 shrink-0 tabular-nums">
                      <Clock className="w-3 h-3" />
                      {check.duration}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Live State-Based Verification Assertions */}
            <div>
              <h4 className="text-xs font-semibold text-slate-300 mb-2">
                Live Verification Assertions (State-Based Grading)
              </h4>
              <div className="space-y-1.5">
                {assertions.map((a) => (
                  <div
                    key={a.id}
                    className={`p-2.5 rounded-lg border flex items-start gap-2.5 text-xs transition-colors ${
                      a.passed
                        ? 'border-emerald-500/30 bg-emerald-950/15 text-emerald-200'
                        : 'border-slate-800 bg-slate-900/30 text-slate-300'
                    }`}
                  >
                    {a.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-slate-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-medium">{a.label}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {a.description}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: GitHub Actions Pipelines */}
        {activeInspectorTab === 'pipelines' && (
          <div className="flex-1 min-h-0 p-3 overflow-hidden">
            <PipelineMonitor embedded={true} />
          </div>
        )}
      </div>
    </div>
  );
};
