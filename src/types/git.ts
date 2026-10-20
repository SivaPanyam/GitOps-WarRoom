export type FileTreeMap = Record<string, string>;

export interface GitCommit {
  sha: string;
  message: string;
  author: string;
  timestamp: string;
  parents: string[]; // 1 parent for normal commit, 2 for merge commit, 0 for root
  tree: FileTreeMap; // Complete snapshot of files at this commit
  revertedFromSha?: string;
  cherryPickedFromSha?: string;
}

export interface ReflogEntry {
  index: number; // 0 = HEAD@{0}, 1 = HEAD@{1}, etc.
  sha: string;
  action: string; // e.g. "commit", "checkout: moving from main to hotfix", "reset: moving to a1b2c3d"
  message: string;
  timestamp: string;
}

export interface StashEntry {
  id: string; // e.g. "stash@{0}"
  message: string;
  branchOrSha: string;
  workingTree: FileTreeMap;
  stagingIndex: FileTreeMap;
}

export interface BisectState {
  active: boolean;
  badSha: string | null;
  goodShas: string[];
  candidates: string[];
  stepsTaken: number;
  foundCulpritSha: string | null;
  originalHead: { type: 'branch' | 'detached'; ref: string };
}

export type RebaseAction = 'pick' | 'squash' | 'fixup' | 'reword' | 'drop';

export interface RebaseTodoItem {
  action: RebaseAction;
  sha: string;
  message: string;
  author: string;
}

export interface InteractiveRebaseState {
  active: boolean;
  phase: 'todo' | 'conflict';
  baseSha: string;
  targetName: string; // e.g. "origin/main" or "HEAD~3"
  originalBranch: string | null;
  originalHeadSha: string;
  todos: RebaseTodoItem[];
  remainingTodos: RebaseTodoItem[];
  currentHeadSha: string;
  accumulatedMessage: string;
  conflictingCommit?: GitCommit;
}

export interface MergeOrCherryPickState {
  type: 'merge' | 'cherry-pick';
  sourceRef: string;
  sourceSha: string;
  message: string;
}

export interface RemoteState {
  branches: Record<string, string>; // e.g., { 'main': 'sha1', 'feature/payments': 'sha2' }
  tags: Record<string, string>;     // e.g., { 'v2.1.0': 'sha1' }
  commits: Record<string, GitCommit>;
}

export interface GitRepositoryState {
  commits: Record<string, GitCommit>;
  branches: Record<string, string>; // branchName -> sha
  tags: Record<string, string>;     // tagName -> sha
  head: {
    type: 'branch' | 'detached';
    ref: string; // branch name if 'branch', commit sha if 'detached'
  };
  workingTree: FileTreeMap;
  stagingIndex: FileTreeMap;
  conflictedFiles: string[];
  reflog: ReflogEntry[];
  stashes: StashEntry[];
  bisect: BisectState;
  interactiveRebase: InteractiveRebaseState | null;
  inProgressOperation: MergeOrCherryPickState | null;
  remote: RemoteState;
  lastPushUsedForceWithLease: boolean;
  overwroteRemoteCommitWithoutLease: boolean;
  forcePushedMain: boolean;
}

export interface AssertionResult {
  id: string;
  label: string;
  description: string;
  passed: boolean;
}

export interface SlackMessage {
  id: string;
  sender: string;
  role: string;
  channel: string;
  timestamp: string;
  text: string;
  isAlert?: boolean;
}

export interface JiraTicket {
  key: string;
  title: string;
  severity: 'SEV-1' | 'SEV-2' | 'SEV-3';
  service: string;
  acceptanceCriteria: string[];
}

export interface CIPipelineCheck {
  id: string;
  name: string;
  targetRef: string;
  status: 'passing' | 'failing' | 'running' | 'pending';
  summary: string;
  duration: string;
}

export interface Scenario {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  difficulty: 'Junior' | 'Mid-Level' | 'Senior / Staff';
  category?: 'Release & Tags' | 'Reflog & Recovery' | 'Security & Secrets' | 'Bisect & Debugging' | 'Rebase & Merge' | 'Stash & Workspace' | 'GitHub PR & Collaboration' | 'Clean & Sync';
  incidentTicker: string;
  focusedSkills: string[];
  jira: JiraTicket;
  slackThread: SlackMessage[];
  hints: string[];
  optimalCommands: string[];
  staffPostMortem: string;
  createInitialState: () => GitRepositoryState;
  verifyState: (repo: GitRepositoryState) => AssertionResult[];
  evaluateCI: (repo: GitRepositoryState) => CIPipelineCheck[];
  customScriptRunner?: (scriptName: string, repo: GitRepositoryState) => { output: string; exitCode: number };
}

export interface TerminalLogItem {
  id: string;
  command?: string;
  branchPrompt?: string;
  output: string;
  type: 'command' | 'info' | 'success' | 'warning' | 'error' | 'slack-alert';
  timestamp: string;
}

export interface AchievementBadge {
  id: string;
  name: string;
  description: string;
  category: 'History' | 'Recovery' | 'Safety' | 'Speed' | 'Mastery';
  icon: 'git-merge' | 'history' | 'shield-check' | 'zap' | 'flame' | 'award' | 'lock' | 'package';
  unlockedAt: string | null;
  hint: string;
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary';
}

export interface PipelineWorkflowStep {
  name: string;
  status: 'success' | 'failure' | 'running' | 'queued';
  duration: string;
  logs?: string[];
}

export interface PipelineWorkflowRun {
  id: string;
  name: string;
  workflowFile: string;
  branchOrTag: string;
  commitSha: string;
  commitMessage: string;
  author: string;
  status: 'success' | 'failure' | 'running' | 'queued';
  duration: string;
  triggerEvent: 'push' | 'pull_request' | 'tag' | 'workflow_dispatch';
  startedAt: string;
  steps: PipelineWorkflowStep[];
}

