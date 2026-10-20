import React, { useMemo } from 'react';
import {
  Background,
  Controls,
  Edge,
  Handle,
  MarkerType,
  Node,
  NodeProps,
  Position,
  ReactFlow,
} from '@xyflow/react';
import dagre from 'dagre';
import {
  Cloud,
  GitBranch,
  GitCommit as GitCommitIcon,
  Layers,
  Tag,
} from 'lucide-react';
import { getHeadSha, getReachableShas } from '../engine/gitEngine';
import { useGitStore } from '../store/useGitStore';
import { GitCommit } from '../types/git';

interface CommitNodeData extends Record<string, unknown> {
  commit: GitCommit;
  isHead: boolean;
  isDetachedHead: boolean;
  localBranches: string[];
  remoteBranches: string[];
  tags: string[];
  remoteTags: string[];
  isOrphaned: boolean;
  isSelected: boolean;
  hasSecretLeak: boolean;
  isBisectCandidate: boolean;
  isBisectCulprit: boolean;
  onSelect: (sha: string) => void;
}

const CommitNodeComponent: React.FC<NodeProps<Node<CommitNodeData>>> = ({
  data,
}) => {
  const {
    commit,
    isHead,
    isDetachedHead,
    localBranches,
    remoteBranches,
    tags,
    remoteTags,
    isOrphaned,
    isSelected,
    hasSecretLeak,
    isBisectCulprit,
    onSelect,
  } = data;

  return (
    <div
      onClick={() => onSelect(commit.sha)}
      style={{ opacity: isOrphaned ? 0.35 : 1 }}
      className={`w-[270px] rounded-lg border p-2.5 transition-all cursor-pointer select-none ${
        isSelected
          ? 'border-sky-400 bg-slate-900 shadow-lg shadow-sky-950/50'
          : isHead
          ? 'border-emerald-500/80 bg-[#0F172A]'
          : hasSecretLeak
          ? 'border-rose-500/70 bg-rose-950/20'
          : isBisectCulprit
          ? 'border-amber-500/80 bg-amber-950/20'
          : isOrphaned
          ? 'border-dashed border-slate-600 bg-slate-900/50 hover:opacity-80'
          : 'border-slate-800 bg-[#0D131F] hover:border-slate-700'
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-slate-600 !border-slate-900"
      />

      {/* Top row: SHA + Ref Pointers */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5">
          <GitCommitIcon
            className={`w-3.5 h-3.5 ${
              isHead
                ? 'text-emerald-400'
                : hasSecretLeak
                ? 'text-rose-400'
                : 'text-sky-400'
            }`}
          />
          <span className="font-mono text-xs font-bold text-slate-100 tabular-nums">
            {commit.sha}
          </span>
          {isOrphaned && (
            <span className="font-mono text-[10px] text-amber-300">
              · dangling (reflog)
            </span>
          )}
          {hasSecretLeak && (
            <span className="font-mono text-[10px] text-rose-400 font-semibold">
              · .env leaked
            </span>
          )}
        </div>
        <span className="text-[10px] font-mono text-slate-500 tabular-nums">
          {commit.timestamp}
        </span>
      </div>

      {/* Commit Message */}
      <div className="text-xs font-medium text-slate-200 truncate mb-1.5">
        {commit.message}
      </div>

      {/* Author & Ref Labels (Clean unboxed typography per design constitution) */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-mono border-t border-slate-800/80 pt-1.5">
        {isHead && (
          <span className="text-emerald-400 font-semibold">
            {isDetachedHead
              ? 'HEAD (detached)'
              : `HEAD -> ${localBranches[0] || ''}`}
          </span>
        )}

        {localBranches
          .filter((b, i) => !(isHead && !isDetachedHead && i === 0 && b === localBranches[0]))
          .map((b) => (
            <span key={b} className="text-sky-400 font-semibold flex items-center gap-0.5">
              <GitBranch className="w-3 h-3" />
              {b}
            </span>
          ))}

        {remoteBranches.map((rb) => (
          <span
            key={rb}
            className="text-purple-400 font-medium flex items-center gap-0.5"
          >
            <Cloud className="w-3 h-3" />
            origin/{rb}
          </span>
        ))}

        {tags.map((t) => {
          const onRemote = remoteTags.includes(t);
          return (
            <span
              key={t}
              className="text-amber-300 font-semibold flex items-center gap-0.5"
            >
              <Tag className="w-3 h-3" />
              {t}
              {onRemote ? ' (origin)' : ' (local)'}
            </span>
          );
        })}

        {!isHead &&
          localBranches.length === 0 &&
          remoteBranches.length === 0 &&
          tags.length === 0 && (
            <span className="text-slate-500 truncate">
              {commit.author.split('<')[0].trim()}
            </span>
          )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-slate-600 !border-slate-900"
      />
    </div>
  );
};

const nodeTypes = {
  commitNode: CommitNodeComponent,
};

export const GitGraph: React.FC = () => {
  const {
    repo,
    selectedCommitSha,
    setSelectedCommitSha,
    runTerminalCommand,
  } = useGitStore();

  const headSha = getHeadSha(repo);

  const { nodes, edges } = useMemo(() => {
    const activeStartShas = [
      headSha,
      ...Object.values(repo.branches),
      ...Object.values(repo.remote.branches),
      ...Object.values(repo.tags),
      ...Object.values(repo.remote.tags),
    ];

    const reachableSet = getReachableShas(repo.commits, activeStartShas);

    const g = new dagre.graphlib.Graph();
    g.setGraph({
      rankdir: 'LR',
      nodesep: 38,
      ranksep: 65,
      marginx: 24,
      marginy: 24,
    });
    g.setDefaultEdgeLabel(() => ({}));

    const commitList = Object.values(repo.commits);
    const createdNodes: Node<CommitNodeData>[] = [];
    const createdEdges: Edge[] = [];

    for (const c of commitList) {
      g.setNode(c.sha, { width: 270, height: 96 });
    }

    for (const c of commitList) {
      for (const parentSha of c.parents) {
        if (repo.commits[parentSha]) {
          // Edge flows from Parent (left) -> Child (right) for chronological DAG readability
          g.setEdge(parentSha, c.sha);
          const isOrphanEdge = !reachableSet.has(c.sha);
          createdEdges.push({
            id: `e-${parentSha}-${c.sha}`,
            source: parentSha,
            target: c.sha,
            animated: !isOrphanEdge && c.sha === headSha,
            style: {
              stroke: isOrphanEdge
                ? '#64748b'
                : c.sha === headSha
                ? '#10b981'
                : '#38bdf8',
              strokeWidth: isOrphanEdge ? 1.5 : 2,
              strokeDasharray: isOrphanEdge ? '5 5' : undefined,
              opacity: isOrphanEdge ? 0.35 : 0.85,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: isOrphanEdge
                ? '#64748b'
                : c.sha === headSha
                ? '#10b981'
                : '#38bdf8',
            },
          });
        }
      }
    }

    dagre.layout(g);

    for (const c of commitList) {
      const pos = g.node(c.sha);
      const localBranches = Object.entries(repo.branches)
        .filter(([, sha]) => sha === c.sha)
        .map(([name]) => name);

      // Keep HEAD branch first if applicable
      if (repo.head.type === 'branch') {
        localBranches.sort((a, b) =>
          a === repo.head.ref ? -1 : b === repo.head.ref ? 1 : 0
        );
      }

      const remoteBranches = Object.entries(repo.remote.branches)
        .filter(([, sha]) => sha === c.sha)
        .map(([name]) => name);

      const tags = Object.entries(repo.tags)
        .filter(([, sha]) => sha === c.sha)
        .map(([name]) => name);

      const remoteTags = Object.entries(repo.remote.tags)
        .filter(([, sha]) => sha === c.sha)
        .map(([name]) => name);

      const isOrphaned = !reachableSet.has(c.sha);
      const hasSecretLeak = Boolean(c.tree['.env.production']);

      createdNodes.push({
        id: c.sha,
        type: 'commitNode',
        position: {
          x: (pos?.x || 0) - 135,
          y: (pos?.y || 0) - 48,
        },
        data: {
          commit: c,
          isHead: c.sha === headSha,
          isDetachedHead: repo.head.type === 'detached' && c.sha === headSha,
          localBranches,
          remoteBranches,
          tags,
          remoteTags,
          isOrphaned,
          isSelected: selectedCommitSha === c.sha,
          hasSecretLeak,
          isBisectCandidate: repo.bisect.candidates.includes(c.sha),
          isBisectCulprit: repo.bisect.foundCulpritSha === c.sha,
          onSelect: (sha: string) =>
            setSelectedCommitSha(selectedCommitSha === sha ? null : sha),
        },
      });
    }

    return { nodes: createdNodes, edges: createdEdges };
  }, [repo, headSha, selectedCommitSha, setSelectedCommitSha]);

  const inspectedCommit = selectedCommitSha
    ? repo.commits[selectedCommitSha]
    : repo.commits[headSha];

  return (
    <div className="flex flex-col h-full w-full bg-[#090D16] relative overflow-hidden">
      {/* Graph Header & Legend Bar */}
      <div className="px-4 py-2 border-b border-slate-800/80 bg-[#0D131F] flex flex-wrap items-center justify-between gap-4 shrink-0 z-10">
        <div className="flex items-center gap-2.5">
          <Layers className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-xs font-semibold text-slate-200">
            Live Git DAG Topology (Local vs. Remote origin)
          </span>
        </div>

        {/* Clean Unboxed Legend */}
        <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
          <span className="text-emerald-400 font-semibold">HEAD</span>
          <span>·</span>
          <span className="text-sky-400">local branch</span>
          <span>·</span>
          <span className="text-purple-400">origin/*</span>
          <span>·</span>
          <span className="text-amber-300">tag</span>
          <span>·</span>
          <span className="text-slate-500">dashed = dangling (reflog)</span>
        </div>
      </div>

      {/* React Flow Canvas */}
      <div className="flex-1 w-full relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.22 }}
          minZoom={0.25}
          maxZoom={1.6}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#1e293b" gap={20} size={1} />
          <Controls showInteractive={false} position="bottom-left" />
        </ReactFlow>

        {/* Floating Selected Commit Inspector & Quick Git Plumbing Actions */}
        {inspectedCommit && (
          <div className="absolute bottom-3 right-3 max-w-md bg-[#0D131F]/95 backdrop-blur border border-slate-800 rounded-lg p-3 shadow-xl z-20 text-xs">
            <div className="flex items-center justify-between gap-4 mb-1">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sky-400">
                  {inspectedCommit.sha}
                </span>
                <span className="text-slate-500">·</span>
                <span className="text-slate-400 truncate max-w-[180px]">
                  {inspectedCommit.author.split('<')[0].trim()}
                </span>
              </div>
              <span className="font-mono text-[11px] text-slate-500">
                parents:{' '}
                {inspectedCommit.parents.length > 0
                  ? inspectedCommit.parents.join(', ')
                  : 'root'}
              </span>
            </div>
            <div className="text-slate-200 font-medium mb-2 truncate">
              {inspectedCommit.message}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-slate-800/80">
              <button
                onClick={() =>
                  runTerminalCommand(`git checkout ${inspectedCommit.sha}`)
                }
                className="px-2 py-0.5 text-[11px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors whitespace-nowrap shrink-0"
              >
                checkout {inspectedCommit.sha}
              </button>
              <button
                onClick={() =>
                  runTerminalCommand(`git cherry-pick ${inspectedCommit.sha}`)
                }
                className="px-2 py-0.5 text-[11px] font-mono bg-slate-800 hover:bg-slate-700 text-sky-300 rounded transition-colors whitespace-nowrap shrink-0"
              >
                cherry-pick
              </button>
              <button
                onClick={() =>
                  runTerminalCommand(`git revert ${inspectedCommit.sha}`)
                }
                className="px-2 py-0.5 text-[11px] font-mono bg-slate-800 hover:bg-slate-700 text-amber-300 rounded transition-colors whitespace-nowrap shrink-0"
              >
                revert
              </button>
              <button
                onClick={() =>
                  runTerminalCommand(`git reset --hard ${inspectedCommit.sha}`)
                }
                className="px-2 py-0.5 text-[11px] font-mono bg-slate-800 hover:bg-slate-700 text-rose-300 rounded transition-colors whitespace-nowrap shrink-0"
              >
                reset --hard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
