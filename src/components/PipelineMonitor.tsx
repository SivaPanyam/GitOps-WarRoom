import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  GitBranch,
  GitCommit,
  GitPullRequest,
  Play,
  RotateCw,
  Tag,
  Terminal,
  Workflow,
  XCircle,
} from 'lucide-react';
import { PipelineWorkflowRun } from '../types/git';
import { useGitStore } from '../store/useGitStore';

interface PipelineMonitorProps {
  embedded?: boolean;
}

export const PipelineMonitor: React.FC<PipelineMonitorProps> = ({ embedded = false }) => {
  const { pipelineRuns, triggerPipelineRun, activeScenario, repo } = useGitStore();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'success' | 'failure'>('all');

  const filteredRuns = pipelineRuns.filter((r) => {
    if (filter === 'all') return true;
    return r.status === filter;
  });

  const activeRun = pipelineRuns.find((r) => r.id === selectedRunId) || pipelineRuns[0];

  const handleManualTrigger = () => {
    const headSha =
      repo.head.type === 'branch' ? repo.branches[repo.head.ref] || 'HEAD' : repo.head.ref;
    const refName = repo.head.type === 'branch' ? repo.head.ref : 'detached';
    triggerPipelineRun(refName, headSha, 'workflow_dispatch');
  };

  return (
    <div className={`flex flex-col h-full bg-[#090D14] text-slate-100 ${embedded ? '' : 'p-6 rounded-2xl border border-slate-800'}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800/80 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <Workflow className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono">
                GitHub Actions Pipeline Monitor
              </h3>
              <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Runner
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Active CI/CD builds for branches & tags responding to git push / release events
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 rounded-lg p-0.5 text-[11px]">
            {(['all', 'success', 'failure'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-2.5 py-0.5 rounded-md capitalize transition-colors ${
                  filter === tab
                    ? 'bg-slate-800 text-sky-300 font-medium'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Trigger Workflow dispatch button */}
          <button
            onClick={handleManualTrigger}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors"
            title="Dispatch a manual workflow run on current HEAD"
          >
            <Play className="w-3 h-3 text-sky-400" />
            <span>Dispatch CI</span>
          </button>
        </div>
      </div>

      {/* Main Content Split: Runs List & Detailed Step Log */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 pt-4 gap-4 overflow-hidden">
        {/* Left: Workflow Runs List */}
        <div className="lg:col-span-5 flex flex-col min-h-0 overflow-y-auto space-y-2 pr-1">
          {filteredRuns.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No workflow runs match filter. Push a commit or tag to trigger CI!
            </div>
          ) : (
            filteredRuns.map((run) => {
              const isSelected = activeRun?.id === run.id;
              const isPassing = run.status === 'success';
              const isTag = run.triggerEvent === 'tag';

              return (
                <div
                  key={run.id}
                  onClick={() => setSelectedRunId(run.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                    isSelected
                      ? 'border-sky-500/70 bg-slate-900/90 shadow-lg shadow-sky-500/5'
                      : 'border-slate-800/80 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/70'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {isPassing ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      )}
                      <span className="font-semibold text-xs text-slate-100 truncate">
                        {run.name}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold border shrink-0 ${
                        isPassing
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                      }`}
                    >
                      {isPassing ? 'Success' : 'Failure'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <div className="flex items-center gap-1.5 truncate">
                      {isTag ? (
                        <Tag className="w-3 h-3 text-purple-400 shrink-0" />
                      ) : (
                        <GitBranch className="w-3 h-3 text-sky-400 shrink-0" />
                      )}
                      <span className="text-slate-200 truncate">{run.branchOrTag}</span>
                      <span className="text-slate-600">@</span>
                      <span className="text-sky-400">{run.commitSha}</span>
                    </div>

                    <div className="flex items-center gap-1 text-slate-500 shrink-0">
                      <Clock className="w-3 h-3" />
                      <span>{run.duration}</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 truncate">
                    {run.commitMessage}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right: Selected Run Inspector & Job Logs */}
        <div className="lg:col-span-7 flex flex-col min-h-0 bg-[#070A10] border border-slate-800 rounded-xl overflow-hidden p-4 space-y-4">
          {activeRun ? (
            <>
              {/* Run Header Meta */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800/80 shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-400 font-semibold">
                      {activeRun.workflowFile}
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-400 text-xs">
                      triggered via <strong className="text-slate-200">{activeRun.triggerEvent}</strong>
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-100 mt-0.5">
                    {activeRun.name}
                  </h4>
                </div>

                <div className="text-right">
                  <div
                    className={`text-xs font-mono font-bold uppercase ${
                      activeRun.status === 'success' ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {activeRun.status.toUpperCase()}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    Total: {activeRun.duration}
                  </div>
                </div>
              </div>

              {/* Step By Step Execution Tree */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
                <div className="font-semibold text-slate-300 text-[11px] uppercase tracking-wider font-mono">
                  Workflow Execution Steps ({activeRun.steps.length})
                </div>

                {activeRun.steps.map((step, idx) => {
                  const stepSuccess = step.status === 'success';

                  return (
                    <div
                      key={idx}
                      className="border border-slate-800/90 rounded-lg bg-slate-900/50 overflow-hidden"
                    >
                      <div className="p-2.5 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {stepSuccess ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          )}
                          <span
                            className={`font-mono text-xs ${
                              stepSuccess ? 'text-slate-200' : 'text-rose-200 font-semibold'
                            }`}
                          >
                            {step.name}
                          </span>
                        </div>

                        <span className="text-[10px] font-mono text-slate-500">
                          {step.duration}
                        </span>
                      </div>

                      {/* Step logs if present */}
                      {step.logs && step.logs.length > 0 && (
                        <div className="p-2.5 bg-[#05070B] border-t border-slate-800 font-mono text-[11px] text-slate-300 space-y-1">
                          {step.logs.map((logLine, lIdx) => (
                            <div
                              key={lIdx}
                              className={
                                logLine.includes('PASS') || logLine.includes('0 vulnerabilities')
                                  ? 'text-emerald-400'
                                  : logLine.includes('FAIL')
                                  ? 'text-rose-400 font-semibold'
                                  : 'text-slate-400'
                              }
                            >
                              {logLine}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Quick tip footer */}
              <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 font-mono flex items-center justify-between shrink-0">
                <span>Commit: <strong className="text-sky-300">{activeRun.commitSha}</strong> ({activeRun.author})</span>
                <span className="text-slate-500">Started {activeRun.startedAt}</span>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs">
              Select a workflow run to view step execution logs.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
