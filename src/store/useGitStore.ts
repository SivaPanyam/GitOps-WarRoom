import { create } from 'zustand';
import {
  cloneState,
  executeCommand,
  hasConflictMarkers,
  processRebaseQueue,
} from '../engine/gitEngine';
import { SCENARIOS } from '../scenarios/scenarios';
import {
  AchievementBadge,
  AssertionResult,
  CIPipelineCheck,
  GitRepositoryState,
  PipelineWorkflowRun,
  PipelineWorkflowStep,
  RebaseTodoItem,
  Scenario,
  SlackMessage,
  TerminalLogItem,
} from '../types/git';

export const INITIAL_BADGES: AchievementBadge[] = [
  {
    id: 'clean-merge-history',
    name: 'Clean Merge History',
    description: 'Rebase, squash, or integrate changes cleanly without tangled merge bubbles or broken history.',
    category: 'History',
    icon: 'git-merge',
    unlockedAt: null,
    hint: 'Complete an interactive rebase squash or linear rebase without merge artifacts.',
    rarity: 'Rare',
  },
  {
    id: 'first-reflog-recovery',
    name: 'First Reflog Recovery',
    description: 'Rescued a detached HEAD or unreferenced dangling commit using git reflog.',
    category: 'Recovery',
    icon: 'history',
    unlockedAt: null,
    hint: 'Use git reflog and reset --hard to bring back a lost commit.',
    rarity: 'Epic',
  },
  {
    id: 'zero-force-push',
    name: 'Zero-Force Push',
    description: 'Resolved a diverged upstream crisis cleanly without ever using plain git push --force.',
    category: 'Safety',
    icon: 'shield-check',
    unlockedAt: null,
    hint: 'Safely integrate remote commits using --force-with-lease or fast-forward.',
    rarity: 'Common',
  },
  {
    id: 'secret-sanitizer',
    name: 'Secret Sanitizer',
    description: 'Purged high-entropy leaked AWS access keys from commit history using interactive rebase drop.',
    category: 'Safety',
    icon: 'lock',
    unlockedAt: null,
    hint: 'Drop or edit credentials commits from historical trees.',
    rarity: 'Rare',
  },
  {
    id: 'bisect-detective',
    name: 'Bisect Detective',
    description: 'Used binary search via git bisect to isolate a subtle silent production calculation regression.',
    category: 'Mastery',
    icon: 'zap',
    unlockedAt: null,
    hint: 'Start git bisect and mark bad/good commits to identify culprit SHA.',
    rarity: 'Rare',
  },
  {
    id: 'blob-hunter',
    name: 'Blob Hunter (GH001)',
    description: 'Saved GitHub remote from exceeding the 100MB file limit by soft-resetting before push.',
    category: 'Safety',
    icon: 'package',
    unlockedAt: null,
    hint: 'Run git reset --soft HEAD~1 to remove large binary files from history.',
    rarity: 'Common',
  },
  {
    id: 'staff-backporter',
    name: 'Staff Backporter',
    description: 'Isolated a high-severity security CVE and backported it to an Enterprise LTS branch without v2.0 pollution.',
    category: 'Mastery',
    icon: 'award',
    unlockedAt: null,
    hint: 'Cherry-pick a security patch to an LTS branch and push release tag.',
    rarity: 'Legendary',
  },
];

function createInitialPipelineRuns(scenario: Scenario, repo: GitRepositoryState): PipelineWorkflowRun[] {
  const ciChecks = scenario.evaluateCI(repo);
  const mainSha = repo.branches['main'] || Object.values(repo.branches)[0] || 'a010000';
  const headCommit = repo.commits[mainSha] || Object.values(repo.commits)[0];
  const allPassing = ciChecks.every((c) => c.status === 'passing');

  return [
    {
      id: `run-${Date.now()}-1`,
      name: 'CI / Production Build & Test',
      workflowFile: '.github/workflows/ci.yml',
      branchOrTag: 'main',
      commitSha: mainSha.slice(0, 7),
      commitMessage: headCommit ? headCommit.message : 'Initial repository bootstrap',
      author: headCommit ? headCommit.author : 'Release Bot',
      status: allPassing ? 'success' : 'failure',
      duration: '42s',
      triggerEvent: 'push',
      startedAt: '3 mins ago',
      steps: [
        { name: 'Set up Node.js v20', status: 'success', duration: '3s' },
        { name: 'Install dependencies (npm ci)', status: 'success', duration: '12s' },
        { name: 'Lint & TypeScript typecheck', status: 'success', duration: '9s' },
        {
          name: 'Run integration test suite',
          status: allPassing ? 'success' : 'failure',
          duration: '18s',
          logs: ciChecks.map((c) => `[${c.status.toUpperCase()}] ${c.name}: ${c.summary}`),
        },
      ],
    },
    {
      id: `run-${Date.now()}-2`,
      name: 'Security & Secret Scan (Trivy)',
      workflowFile: '.github/workflows/security.yml',
      branchOrTag: 'main',
      commitSha: mainSha.slice(0, 7),
      commitMessage: 'Automated secret audit',
      author: 'Security Bot',
      status: 'success',
      duration: '19s',
      triggerEvent: 'push',
      startedAt: '12 mins ago',
      steps: [
        { name: 'Checkout repository', status: 'success', duration: '2s' },
        { name: 'Scan high-entropy secrets', status: 'success', duration: '14s' },
        { name: 'Verify gitleaks ruleset', status: 'success', duration: '3s' },
      ],
    },
  ];
}

function createPipelineRunOnPush(
  repo: GitRepositoryState,
  scenario: Scenario,
  command: string,
  event: 'push' | 'pull_request' | 'tag' | 'workflow_dispatch' = 'push'
): PipelineWorkflowRun {
  const ciChecks = scenario.evaluateCI(repo);
  const headSha =
    repo.head.type === 'branch' ? repo.branches[repo.head.ref] || 'HEAD' : repo.head.ref;
  const headCommit = repo.commits[headSha];
  const allPassing = ciChecks.every((c) => c.status === 'passing');

  const isTag = command.includes('tag') || command.includes('--tags') || event === 'tag';
  const targetRef = isTag
    ? Object.keys(repo.tags).find((t) => repo.tags[t] === headSha) || 'tag'
    : repo.head.type === 'branch'
    ? repo.head.ref
    : 'detached';

  return {
    id: `run-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: isTag ? `Release Deploy / tag:${targetRef}` : `CI / branch:${targetRef}`,
    workflowFile: isTag ? '.github/workflows/release.yml' : '.github/workflows/ci.yml',
    branchOrTag: targetRef,
    commitSha: headSha.slice(0, 7),
    commitMessage: headCommit ? headCommit.message : 'Update branch',
    author: headCommit ? headCommit.author : 'You <oncall@warroom.dev>',
    status: allPassing ? 'success' : 'failure',
    duration: `${Math.floor(Math.random() * 8 + 12)}s`,
    triggerEvent: isTag ? 'tag' : event,
    startedAt: 'just now',
    steps: [
      { name: 'Setup runner environment', status: 'success', duration: '2s' },
      { name: 'Checkout git repository', status: 'success', duration: '3s' },
      {
        name: 'Run verification tests & linters',
        status: allPassing ? 'success' : 'failure',
        duration: '10s',
        logs: ciChecks.map((c) => `[${c.status.toUpperCase()}] ${c.name}: ${c.summary}`),
      },
      {
        name: isTag ? 'Publish production release artifacts' : 'Deploy preview environment',
        status: allPassing ? 'success' : 'queued',
        duration: allPassing ? '4s' : '0s',
      },
    ],
  };
}

function checkAndUnlockBadges(
  badges: AchievementBadge[],
  scenario: Scenario,
  repo: GitRepositoryState,
  commandHistory: string[],
  allPassed: boolean
): { updatedBadges: AchievementBadge[]; newlyUnlocked: AchievementBadge | null } {
  const updated = [...badges];
  let newlyUnlocked: AchievementBadge | null = null;

  const markUnlock = (badgeId: string) => {
    const idx = updated.findIndex((b) => b.id === badgeId);
    if (idx !== -1 && !updated[idx].unlockedAt) {
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      updated[idx] = { ...updated[idx], unlockedAt: now };
      if (!newlyUnlocked) {
        newlyUnlocked = updated[idx];
      }
    }
  };

  if (allPassed) {
    // 1. Zero-Force Push: solved incident without force-pushing main or overwriting coworker without lease
    if (!repo.forcePushedMain && !repo.overwroteRemoteCommitWithoutLease) {
      markUnlock('zero-force-push');
    }

    // 2. Clean Merge History: completed an interactive rebase squash or clean rebase scenario
    if (
      [
        'rebase-squash-conflict-hell',
        'rebase-onto-pr-cleanup',
        'github-pr-lockfile-conflict',
        'github-fork-upstream-sync',
      ].includes(scenario.id)
    ) {
      markUnlock('clean-merge-history');
    }

    // 3. First Reflog Recovery: scenario 2 or used reflog
    if (scenario.id === 'botched-rebase-reflog' || commandHistory.some((c) => c.includes('reflog'))) {
      markUnlock('first-reflog-recovery');
    }

    // 4. Secret Sanitizer: scenario 3
    if (scenario.id === 'leaked-aws-credentials') {
      markUnlock('secret-sanitizer');
    }

    // 5. Bisect Detective: scenario 4
    if (scenario.id === 'bisect-calculation-regression') {
      markUnlock('bisect-detective');
    }

    // 6. Blob Hunter: scenario 12
    if (scenario.id === 'github-push-rejected-large-file') {
      markUnlock('blob-hunter');
    }

    // 7. Staff Backporter: scenario 14
    if (scenario.id === 'github-backport-security-cve') {
      markUnlock('staff-backporter');
    }
  }

  return { updatedBadges: updated, newlyUnlocked };
}

interface GitWarRoomStore {
  viewMode: 'landing' | 'ide';
  activeScenario: Scenario;
  repo: GitRepositoryState;
  assertions: AssertionResult[];
  ciChecks: CIPipelineCheck[];
  selectedFile: string;
  selectedCommitSha: string | null;
  terminalLogs: TerminalLogItem[];
  commandHistory: string[];
  userCommandCount: number;
  slackMessages: SlackMessage[];
  latestAlert: SlackMessage | null;
  activeInspectorTab: 'trees' | 'reflog' | 'cicd' | 'pipelines';
  badges: AchievementBadge[];
  recentlyUnlockedBadge: AchievementBadge | null;
  pipelineRuns: PipelineWorkflowRun[];
  isPipelineMonitorOpen: boolean;
  isBriefingOpen: boolean;
  isHintModalOpen: boolean;
  isPostMortemOpen: boolean;
  hasShownWinModal: boolean;
  isWelcomeOpen: boolean;
  isScenarioCatalogOpen: boolean;

  // Actions
  setViewMode: (mode: 'landing' | 'ide') => void;
  selectScenario: (scenarioId: string, switchViewToIde?: boolean) => void;
  resetScenario: () => void;
  runTerminalCommand: (rawCommand: string) => void;
  selectFile: (filename: string) => void;
  updateWorkingFile: (filename: string, newContent: string) => void;
  stageFile: (filename: string) => void;
  resolveConflictChoice: (
    filename: string,
    choice: 'current' | 'incoming' | 'both'
  ) => void;
  updateRebaseTodos: (todos: RebaseTodoItem[]) => void;
  executeInteractiveRebase: () => void;
  abortInteractiveRebase: () => void;
  setSelectedCommitSha: (sha: string | null) => void;
  setActiveInspectorTab: (tab: 'trees' | 'reflog' | 'cicd' | 'pipelines') => void;
  setBriefingOpen: (open: boolean) => void;
  setHintModalOpen: (open: boolean) => void;
  setPostMortemOpen: (open: boolean) => void;
  setWelcomeOpen: (open: boolean) => void;
  setScenarioCatalogOpen: (open: boolean) => void;
  setPipelineMonitorOpen: (open: boolean) => void;
  triggerPipelineRun: (
    branchOrTag: string,
    commitSha: string,
    event?: 'push' | 'pull_request' | 'tag' | 'workflow_dispatch'
  ) => void;
  unlockBadge: (badgeId: string) => void;
  clearRecentBadge: () => void;
  dismissAlert: () => void;
}

function getDefaultFile(repo: GitRepositoryState): string {
  if (repo.conflictedFiles.length > 0) {
    return repo.conflictedFiles[0];
  }
  const files = Object.keys(repo.workingTree);
  const codeFile = files.find((f) => f.startsWith('src/') || f.endsWith('.production'));
  return codeFile || files[0] || '';
}

function buildInitialWelcomeLogs(scenario: Scenario): TerminalLogItem[] {
  return [
    {
      id: `init-${scenario.id}`,
      output: [
        `=== GitOps WarRoom Simulator :: Scenario #${scenario.number}: ${scenario.title} ===`,
        `Incident Ticket: [${scenario.jira.key}] ${scenario.incidentTicker}`,
        `Type 'git status', 'git log --oneline --all', or 'help' to inspect the workspace.`,
      ].join('\n'),
      type: 'info',
      timestamp: 'now',
    },
  ];
}

const initialScenario = SCENARIOS[0];
const initialRepo = initialScenario.createInitialState();

export const useGitStore = create<GitWarRoomStore>((set, get) => ({
  viewMode: 'landing', // Starts in landing dashboard as requested!
  activeScenario: initialScenario,
  repo: initialRepo,
  assertions: initialScenario.verifyState(initialRepo),
  ciChecks: initialScenario.evaluateCI(initialRepo),
  selectedFile: getDefaultFile(initialRepo),
  selectedCommitSha: null,
  terminalLogs: buildInitialWelcomeLogs(initialScenario),
  commandHistory: [],
  userCommandCount: 0,
  slackMessages: [...initialScenario.slackThread],
  latestAlert: null,
  activeInspectorTab: 'trees',
  badges: [...INITIAL_BADGES],
  recentlyUnlockedBadge: null,
  pipelineRuns: createInitialPipelineRuns(initialScenario, initialRepo),
  isPipelineMonitorOpen: false,
  isBriefingOpen: false,
  isHintModalOpen: false,
  isPostMortemOpen: false,
  hasShownWinModal: false,
  isWelcomeOpen: false,
  isScenarioCatalogOpen: false,

  setViewMode: (mode: 'landing' | 'ide') => {
    set({ viewMode: mode });
  },

  selectScenario: (scenarioId: string, switchViewToIde = false) => {
    const found = SCENARIOS.find((s) => s.id === scenarioId) || SCENARIOS[0];
    const freshRepo = found.createInitialState();
    set((state) => ({
      activeScenario: found,
      repo: freshRepo,
      assertions: found.verifyState(freshRepo),
      ciChecks: found.evaluateCI(freshRepo),
      selectedFile: getDefaultFile(freshRepo),
      selectedCommitSha: null,
      terminalLogs: buildInitialWelcomeLogs(found),
      userCommandCount: 0,
      slackMessages: [...found.slackThread],
      latestAlert: null,
      pipelineRuns: createInitialPipelineRuns(found, freshRepo),
      isBriefingOpen: false,
      isHintModalOpen: false,
      isPostMortemOpen: false,
      hasShownWinModal: false,
      viewMode: switchViewToIde ? 'ide' : state.viewMode,
    }));
  },

  resetScenario: () => {
    const { activeScenario } = get();
    const freshRepo = activeScenario.createInitialState();
    set({
      repo: freshRepo,
      assertions: activeScenario.verifyState(freshRepo),
      ciChecks: activeScenario.evaluateCI(freshRepo),
      selectedFile: getDefaultFile(freshRepo),
      selectedCommitSha: null,
      terminalLogs: buildInitialWelcomeLogs(activeScenario),
      userCommandCount: 0,
      slackMessages: [...activeScenario.slackThread],
      latestAlert: null,
      isPostMortemOpen: false,
      hasShownWinModal: false,
    });
  },

  runTerminalCommand: (rawCommand: string) => {
    const state = get();
    const trimmed = rawCommand.trim();
    if (!trimmed) return;

    const branchPrompt =
      state.repo.head.type === 'branch'
        ? state.repo.head.ref
        : `detached:${state.repo.head.ref}`;

    const execResult = executeCommand(
      trimmed,
      state.repo,
      state.activeScenario.customScriptRunner
    );

    if (execResult.clearTerminal) {
      set({
        terminalLogs: [],
        commandHistory: [...state.commandHistory, trimmed],
      });
      return;
    }

    const newLogItem: TerminalLogItem = {
      id: `cmd-${Date.now()}`,
      command: trimmed,
      branchPrompt,
      output: execResult.output,
      type: execResult.status === 'error' ? 'error' : 'command',
      timestamp: 'now',
    };

    const newAssertions = state.activeScenario.verifyState(execResult.newState);
    const newCIChecks = state.activeScenario.evaluateCI(execResult.newState);
    const allPassed = newAssertions.every((a) => a.passed);

    let nextSelectedFile = state.selectedFile;
    if (
      execResult.newState.conflictedFiles.length > 0 &&
      !execResult.newState.conflictedFiles.includes(nextSelectedFile)
    ) {
      nextSelectedFile = execResult.newState.conflictedFiles[0];
    } else if (
      !execResult.newState.workingTree[nextSelectedFile] &&
      Object.keys(execResult.newState.workingTree).length > 0
    ) {
      nextSelectedFile = getDefaultFile(execResult.newState);
    }

    const nextLogs = [...state.terminalLogs, newLogItem];
    const nextSlack = [...state.slackMessages];
    let nextAlert = state.latestAlert;
    let nextPipelineRuns = state.pipelineRuns;

    // If git push or tag was executed, create a new pipeline run
    if (trimmed.startsWith('git push') || trimmed.startsWith('git tag')) {
      const newRun = createPipelineRunOnPush(execResult.newState, state.activeScenario, trimmed);
      nextPipelineRuns = [newRun, ...state.pipelineRuns.slice(0, 9)];
    }

    // Check Badges & Achievements
    const { updatedBadges, newlyUnlocked } = checkAndUnlockBadges(
      state.badges,
      state.activeScenario,
      execResult.newState,
      [...state.commandHistory, trimmed],
      allPassed
    );

    if (newlyUnlocked) {
      nextSlack.push({
        id: `badge-${Date.now()}`,
        sender: 'Engineering Lead (Achievement Bot)',
        role: 'System',
        channel: '#incidents-war-room',
        timestamp: 'Just now',
        text: `🏆 Achievement Unlocked: [${newlyUnlocked.name}] — ${newlyUnlocked.description}`,
      });
      nextLogs.push({
        id: `badge-log-${Date.now()}`,
        output: `🏆 ACHIEVEMENT UNLOCKED: [${newlyUnlocked.name}] (${newlyUnlocked.rarity}) — ${newlyUnlocked.description}`,
        type: 'success',
        timestamp: 'now',
      });
    }

    if (execResult.antiPatternAlert) {
      nextSlack.push(execResult.antiPatternAlert);
      nextAlert = execResult.antiPatternAlert;
      nextLogs.push({
        id: `alert-log-${Date.now()}`,
        output: `[Slack Alert from ${execResult.antiPatternAlert.sender}]: ${execResult.antiPatternAlert.text}`,
        type: 'slack-alert',
        timestamp: 'now',
      });
    }

    const isCountedCmd =
      trimmed.startsWith('git ') &&
      !trimmed.startsWith('git status') &&
      !trimmed.startsWith('git log') &&
      !trimmed.startsWith('git diff') &&
      !trimmed.startsWith('git show');

    const nextCmdCount = state.userCommandCount + (isCountedCmd ? 1 : 0);

    set({
      repo: execResult.newState,
      assertions: newAssertions,
      ciChecks: newCIChecks,
      selectedFile: nextSelectedFile,
      terminalLogs: nextLogs,
      commandHistory: [...state.commandHistory, trimmed],
      userCommandCount: nextCmdCount,
      slackMessages: nextSlack,
      latestAlert: nextAlert,
      pipelineRuns: nextPipelineRuns,
      badges: updatedBadges,
      recentlyUnlockedBadge: newlyUnlocked || state.recentlyUnlockedBadge,
      isPostMortemOpen: allPassed && !state.hasShownWinModal ? true : state.isPostMortemOpen,
      hasShownWinModal: allPassed ? true : state.hasShownWinModal,
    });
  },

  selectFile: (filename: string) => {
    set({ selectedFile: filename });
  },

  updateWorkingFile: (filename: string, newContent: string) => {
    const state = get();
    const nextRepo = cloneState(state.repo);
    nextRepo.workingTree[filename] = newContent;

    const newAssertions = state.activeScenario.verifyState(nextRepo);
    const newCIChecks = state.activeScenario.evaluateCI(nextRepo);
    const allPassed = newAssertions.every((a) => a.passed);

    set({
      repo: nextRepo,
      assertions: newAssertions,
      ciChecks: newCIChecks,
      isPostMortemOpen: allPassed && !state.hasShownWinModal ? true : state.isPostMortemOpen,
      hasShownWinModal: allPassed ? true : state.hasShownWinModal,
    });
  },

  stageFile: (filename: string) => {
    get().runTerminalCommand(`git add ${filename}`);
  },

  resolveConflictChoice: (
    filename: string,
    choice: 'current' | 'incoming' | 'both'
  ) => {
    const state = get();
    const content = state.repo.workingTree[filename];
    if (!content || !hasConflictMarkers(content)) return;

    const lines = content.split('\n');
    const outputLines: string[] = [];
    let stateMode: 'normal' | 'current' | 'incoming' = 'normal';
    let currentBuf: string[] = [];
    let incomingBuf: string[] = [];

    for (const line of lines) {
      if (line.startsWith('<<<<<<<')) {
        stateMode = 'current';
        currentBuf = [];
        incomingBuf = [];
      } else if (line.startsWith('=======')) {
        stateMode = 'incoming';
      } else if (line.startsWith('>>>>>>>')) {
        if (choice === 'current') {
          outputLines.push(...currentBuf);
        } else if (choice === 'incoming') {
          outputLines.push(...incomingBuf);
        } else if (choice === 'both') {
          outputLines.push(...mergeBothCleanly(currentBuf, incomingBuf));
        }
        stateMode = 'normal';
        currentBuf = [];
        incomingBuf = [];
      } else {
        if (stateMode === 'normal') {
          outputLines.push(line);
        } else if (stateMode === 'current') {
          currentBuf.push(line);
        } else if (stateMode === 'incoming') {
          incomingBuf.push(line);
        }
      }
    }

    const resolvedContent = outputLines.join('\n');
    const nextRepo = cloneState(state.repo);
    nextRepo.workingTree[filename] = resolvedContent;

    if (!hasConflictMarkers(resolvedContent)) {
      nextRepo.conflictedFiles = nextRepo.conflictedFiles.filter(
        (f) => f !== filename
      );
    }

    const newAssertions = state.activeScenario.verifyState(nextRepo);
    const newCIChecks = state.activeScenario.evaluateCI(nextRepo);

    set({
      repo: nextRepo,
      assertions: newAssertions,
      ciChecks: newCIChecks,
    });
  },

  updateRebaseTodos: (todos: RebaseTodoItem[]) => {
    const state = get();
    if (!state.repo.interactiveRebase) return;

    const nextRepo = cloneState(state.repo);
    nextRepo.interactiveRebase!.todos = todos;
    set({ repo: nextRepo });
  },

  executeInteractiveRebase: () => {
    const state = get();
    if (!state.repo.interactiveRebase) return;

    const nextRepo = cloneState(state.repo);
    const result = processRebaseQueue(nextRepo);

    const newAssertions = state.activeScenario.verifyState(nextRepo);
    const newCIChecks = state.activeScenario.evaluateCI(nextRepo);
    const allPassed = newAssertions.every((a) => a.passed);

    set({
      repo: nextRepo,
      assertions: newAssertions,
      ciChecks: newCIChecks,
      terminalLogs: [
        ...state.terminalLogs,
        {
          id: `rebase-exec-${Date.now()}`,
          output: result.output,
          type: result.status === 'error' ? 'error' : 'info',
          timestamp: 'now',
        },
      ],
      isPostMortemOpen: allPassed && !state.hasShownWinModal ? true : state.isPostMortemOpen,
      hasShownWinModal: allPassed ? true : state.hasShownWinModal,
    });
  },

  abortInteractiveRebase: () => {
    get().runTerminalCommand('git rebase --abort');
  },

  setSelectedCommitSha: (sha: string | null) => {
    set({ selectedCommitSha: sha });
  },

  setActiveInspectorTab: (tab: 'trees' | 'reflog' | 'cicd' | 'pipelines') => {
    set({ activeInspectorTab: tab });
  },

  setBriefingOpen: (open: boolean) => {
    set({ isBriefingOpen: open });
  },

  setHintModalOpen: (open: boolean) => {
    set({ isHintModalOpen: open });
  },

  setPostMortemOpen: (open: boolean) => {
    set({ isPostMortemOpen: open });
  },

  setWelcomeOpen: (open: boolean) => {
    set({ isWelcomeOpen: open });
  },

  setScenarioCatalogOpen: (open: boolean) => {
    set({ isScenarioCatalogOpen: open });
  },

  setPipelineMonitorOpen: (open: boolean) => {
    set({ isPipelineMonitorOpen: open });
  },

  triggerPipelineRun: (
    branchOrTag: string,
    commitSha: string,
    event: 'push' | 'pull_request' | 'tag' | 'workflow_dispatch' = 'workflow_dispatch'
  ) => {
    const state = get();
    const newRun = createPipelineRunOnPush(state.repo, state.activeScenario, branchOrTag, event);
    set({
      pipelineRuns: [newRun, ...state.pipelineRuns.slice(0, 9)],
    });
  },

  unlockBadge: (badgeId: string) => {
    set((state) => {
      const idx = state.badges.findIndex((b) => b.id === badgeId);
      if (idx === -1 || state.badges[idx].unlockedAt) return {};
      const updated = [...state.badges];
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      updated[idx] = { ...updated[idx], unlockedAt: now };
      return { badges: updated, recentlyUnlockedBadge: updated[idx] };
    });
  },

  clearRecentBadge: () => {
    set({ recentlyUnlockedBadge: null });
  },

  dismissAlert: () => {
    set({ latestAlert: null });
  },
}));

function mergeBothCleanly(currentBuf: string[], incomingBuf: string[]): string[] {
  const combined = [...currentBuf];
  for (const incLine of incomingBuf) {
    const trimmedInc = incLine.trim();
    if (trimmedInc.startsWith('maxConnections:')) {
      const existingIdx = combined.findIndex((l) =>
        l.trim().startsWith('maxConnections:')
      );
      if (existingIdx !== -1) {
        if (incLine.includes('250')) {
          combined[existingIdx] = incLine;
        }
        continue;
      }
    }
    if (!combined.includes(incLine)) {
      combined.push(incLine);
    }
  }
  return combined;
}
