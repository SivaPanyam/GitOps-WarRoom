import {
  FileTreeMap,
  GitCommit,
  GitRepositoryState,
  RebaseTodoItem,
  SlackMessage,
} from '../types/git';

export interface CommandExecutionOutput {
  newState: GitRepositoryState;
  output: string;
  status: 'success' | 'error' | 'info' | 'warning';
  antiPatternAlert?: SlackMessage;
  clearTerminal?: boolean;
}

// Deterministic short hash generator from content + salt
export function generateSha(seed: string): string {
  let h1 = 0xdeadbeef ^ seed.length;
  let h2 = 0x41c6ce57 ^ seed.length;
  for (let i = 0, ch; i < seed.length; i++) {
    ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex = ((h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0')).slice(0, 7);
  return hex;
}

export function cloneState(state: GitRepositoryState): GitRepositoryState {
  return JSON.parse(JSON.stringify(state));
}

export function getHeadSha(repo: GitRepositoryState): string {
  if (repo.head.type === 'branch') {
    return repo.branches[repo.head.ref] || '';
  }
  return repo.head.ref;
}

export function getHeadCommit(repo: GitRepositoryState): GitCommit | undefined {
  const sha = getHeadSha(repo);
  return repo.commits[sha];
}

export function hasConflictMarkers(content: string): boolean {
  return (
    content.includes('<<<<<<<') &&
    content.includes('=======') &&
    content.includes('>>>>>>>')
  );
}

export function isWorkingTreeClean(repo: GitRepositoryState): boolean {
  if (repo.conflictedFiles.length > 0) return false;
  const headCommit = getHeadCommit(repo);
  const headTree = headCommit ? headCommit.tree : {};

  const allKeys = new Set([
    ...Object.keys(headTree),
    ...Object.keys(repo.stagingIndex),
    ...Object.keys(repo.workingTree),
  ]);

  for (const key of allKeys) {
    if (repo.workingTree[key] !== headTree[key]) return false;
    if (repo.stagingIndex[key] !== headTree[key]) return false;
  }
  return true;
}

export function addReflog(
  repo: GitRepositoryState,
  newSha: string,
  action: string,
  message: string
) {
  const updated = repo.reflog.map((entry) => ({
    ...entry,
    index: entry.index + 1,
  }));
  repo.reflog = [
    {
      index: 0,
      sha: newSha,
      action,
      message,
      timestamp: 'just now',
    },
    ...updated,
  ];
}

// Resolve revision expressions: HEAD, HEAD~2, HEAD^, HEAD@{3}, main, origin/main, v2.1.0, sha prefix
export function resolveRevision(repo: GitRepositoryState, rev: string): string | null {
  if (!rev) return null;
  const trimmed = rev.trim();

  // Check reflog syntax: HEAD@{n}
  const reflogMatch = trimmed.match(/^HEAD@\{(\d+)\}$/);
  if (reflogMatch) {
    const idx = parseInt(reflogMatch[1], 10);
    const entry = repo.reflog.find((r) => r.index === idx);
    return entry ? entry.sha : null;
  }

  // Check ~N or ^ syntax
  const tildeMatch = trimmed.match(/^(.+?)(~(\d*)|\^(\d*))$/);
  if (tildeMatch) {
    const baseRev = tildeMatch[1];
    const isTilde = tildeMatch[2].startsWith('~');
    const countStr = isTilde ? tildeMatch[3] : tildeMatch[4];
    const steps = countStr === '' ? 1 : parseInt(countStr, 10);

    const resolvedBase = resolveRevision(repo, baseRev);
    if (!resolvedBase) return null;
    let currentSha: string = resolvedBase;

    if (isTilde) {
      for (let i = 0; i < steps; i++) {
        const c: GitCommit | undefined = repo.commits[currentSha];
        if (!c || c.parents.length === 0) return null;
        currentSha = c.parents[0];
      }
      return currentSha;
    } else {
      const c: GitCommit | undefined = repo.commits[currentSha];
      const parentIdx = Math.max(0, steps - 1);
      if (!c || !c.parents[parentIdx]) return null;
      return c.parents[parentIdx];
    }
  }

  if (trimmed === 'HEAD' || trimmed === '@') {
    return getHeadSha(repo);
  }

  // Local branch
  if (repo.branches[trimmed]) {
    return repo.branches[trimmed];
  }

  // Remote branch: origin/<branch>
  if (trimmed.startsWith('origin/')) {
    const remoteBranch = trimmed.slice('origin/'.length);
    if (repo.remote.branches[remoteBranch]) {
      return repo.remote.branches[remoteBranch];
    }
  }

  // Tag
  if (repo.tags[trimmed]) {
    return repo.tags[trimmed];
  }

  // Direct SHA or prefix in local commits
  if (repo.commits[trimmed]) {
    return trimmed;
  }
  const matchingSha = Object.keys(repo.commits).find((sha) =>
    sha.startsWith(trimmed)
  );
  if (matchingSha) {
    return matchingSha;
  }

  return null;
}

export function getReachableShas(
  commits: Record<string, GitCommit>,
  startShas: string[]
): Set<string> {
  const visited = new Set<string>();
  const queue = [...startShas.filter(Boolean)];
  while (queue.length > 0) {
    const sha = queue.shift()!;
    if (visited.has(sha)) continue;
    const commit = commits[sha];
    if (!commit) continue;
    visited.add(sha);
    for (const p of commit.parents) {
      if (!visited.has(p)) {
        queue.push(p);
      }
    }
  }
  return visited;
}

export function isAncestor(
  commits: Record<string, GitCommit>,
  possibleAncestorSha: string,
  descendantSha: string
): boolean {
  if (possibleAncestorSha === descendantSha) return true;
  const reachable = getReachableShas(commits, [descendantSha]);
  return reachable.has(possibleAncestorSha);
}

export function findCommonAncestor(
  commits: Record<string, GitCommit>,
  shaA: string,
  shaB: string
): string | null {
  const ancestorsA = getReachableShas(commits, [shaA]);
  const queue = [shaB];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (visited.has(curr)) continue;
    visited.add(curr);
    if (ancestorsA.has(curr)) return curr;
    const c = commits[curr];
    if (c) {
      queue.push(...c.parents);
    }
  }
  return null;
}

// Returns commits from (exclusive) baseSha up to (inclusive) tipSha in topological oldest-first order
export function getCommitsBetween(
  commits: Record<string, GitCommit>,
  baseSha: string,
  tipSha: string
): GitCommit[] {
  const baseAncestors = getReachableShas(commits, [baseSha]);
  const result: GitCommit[] = [];
  let curr: string | undefined = tipSha;
  const visited = new Set<string>();

  while (curr && !baseAncestors.has(curr) && !visited.has(curr)) {
    visited.add(curr);
    const c: GitCommit | undefined = commits[curr];
    if (!c) break;
    result.unshift(c);
    curr = c.parents[0];
  }
  return result;
}

// Perform a 3-way merge of two file trees relative to a base tree
export function threeWayMergeTrees(
  baseTree: FileTreeMap,
  oursTree: FileTreeMap,
  theirsTree: FileTreeMap,
  oursLabel: string,
  theirsLabel: string
): { mergedTree: FileTreeMap; conflicts: string[] } {
  const allFiles = new Set([
    ...Object.keys(baseTree),
    ...Object.keys(oursTree),
    ...Object.keys(theirsTree),
  ]);

  const mergedTree: FileTreeMap = {};
  const conflicts: string[] = [];

  for (const file of allFiles) {
    const baseContent = baseTree[file];
    const oursContent = oursTree[file];
    const theirsContent = theirsTree[file];

    if (oursContent === theirsContent) {
      if (oursContent !== undefined) {
        mergedTree[file] = oursContent;
      }
      continue;
    }

    if (oursContent === baseContent) {
      // Ours didn't change, take theirs (even if deleted)
      if (theirsContent !== undefined) {
        mergedTree[file] = theirsContent;
      }
      continue;
    }

    if (theirsContent === baseContent) {
      // Theirs didn't change, keep ours
      if (oursContent !== undefined) {
        mergedTree[file] = oursContent;
      }
      continue;
    }

    // Both changed differently! Try line-level non-overlapping merge or emit conflict block
    const conflictContent = buildConflictContent(
      baseContent || '',
      oursContent || '',
      theirsContent || '',
      oursLabel,
      theirsLabel
    );
    mergedTree[file] = conflictContent;
    conflicts.push(file);
  }

  return { mergedTree, conflicts };
}

function buildConflictContent(
  base: string,
  ours: string,
  theirs: string,
  oursLabel: string,
  theirsLabel: string
): string {
  const baseLines = base.split('\n');
  const oursLines = ours.split('\n');
  const theirsLines = theirs.split('\n');

  // Find common prefix and suffix to wrap only the conflicting region cleanly
  let prefixLen = 0;
  const minLen = Math.min(baseLines.length, oursLines.length, theirsLines.length);
  while (
    prefixLen < minLen &&
    oursLines[prefixLen] === theirsLines[prefixLen] &&
    oursLines[prefixLen] === baseLines[prefixLen]
  ) {
    prefixLen++;
  }

  let suffixLen = 0;
  while (
    suffixLen < minLen - prefixLen &&
    oursLines[oursLines.length - 1 - suffixLen] ===
      theirsLines[theirsLines.length - 1 - suffixLen] &&
    oursLines[oursLines.length - 1 - suffixLen] ===
      baseLines[baseLines.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  const prefix = oursLines.slice(0, prefixLen);
  const suffix = suffixLen > 0 ? oursLines.slice(oursLines.length - suffixLen) : [];
  const oursMid = oursLines.slice(prefixLen, oursLines.length - suffixLen);
  const theirsMid = theirsLines.slice(prefixLen, theirsLines.length - suffixLen);

  return [
    ...prefix,
    `<<<<<<< ${oursLabel}`,
    ...oursMid,
    '=======',
    ...theirsMid,
    `>>>>>>> ${theirsLabel}`,
    ...suffix,
  ].join('\n');
}

// Tokenize command line respecting quotes
export function parseArgs(cmdLine: string): string[] {
  const args: string[] = [];
  let current = '';
  let inQuotes: '"' | "'" | null = null;

  for (let i = 0; i < cmdLine.length; i++) {
    const ch = cmdLine[i];
    if (inQuotes) {
      if (ch === inQuotes) {
        inQuotes = null;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      inQuotes = ch;
    } else if (/\s/.test(ch)) {
      if (current.length > 0) {
        args.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (current.length > 0) {
    args.push(current);
  }
  return args;
}

// Helper for bisect step computation
function evaluateBisectStep(repo: GitRepositoryState): string {
  const { badSha, goodShas } = repo.bisect;
  if (!badSha || goodShas.length === 0) {
    return 'Bisect state updated. Waiting for both good and bad commits.';
  }

  // Find all commits reachable from badSha but NOT reachable from any goodSha
  const goodReachable = getReachableShas(repo.commits, goodShas);
  const chain: GitCommit[] = [];
  let curr: string | undefined = badSha;
  while (curr && !goodReachable.has(curr)) {
    const c: GitCommit | undefined = repo.commits[curr];
    if (!c) break;
    chain.unshift(c); // oldest first
    curr = c.parents[0];
  }

  repo.bisect.candidates = chain.map((c) => c.sha);

  if (chain.length <= 1) {
    const culprit = chain[0] || repo.commits[badSha];
    repo.bisect.foundCulpritSha = culprit.sha;
    return [
      `${culprit.sha} is the first bad commit`,
      `commit ${culprit.sha}`,
      `Author: ${culprit.author}`,
      `Date:   ${culprit.timestamp}`,
      ``,
      `    ${culprit.message}`,
      ``,
      `Tip: Run 'git bisect reset' to return to your branch, then 'git revert ${culprit.sha}'.`,
    ].join('\n');
  }

  // Pick midpoint excluding badSha itself (which is last in chain)
  const testable = chain.slice(0, chain.length - 1);
  const midIdx = Math.floor(testable.length / 2);
  const midCommit = testable[midIdx];

  repo.head = { type: 'detached', ref: midCommit.sha };
  repo.workingTree = { ...midCommit.tree };
  repo.stagingIndex = { ...midCommit.tree };
  repo.conflictedFiles = [];
  repo.bisect.stepsTaken += 1;

  const leftCount = testable.length - 1;
  const approxSteps = Math.max(1, Math.ceil(Math.log2(testable.length + 1)));

  return [
    `Bisecting: ${leftCount} revision${leftCount === 1 ? '' : 's'} left to test after this (roughly ${approxSteps} step${approxSteps === 1 ? '' : 's'})`,
    `[${midCommit.sha}] ${midCommit.message}`,
    `Tip: Run './test_billing.sh' to test this commit, then mark 'git bisect good' or 'git bisect bad'.`,
  ].join('\n');
}

// Execute Interactive Rebase Todo queue from current state
export function processRebaseQueue(
  repo: GitRepositoryState
): { output: string; status: 'success' | 'warning' | 'error' } {
  const ir = repo.interactiveRebase;
  if (!ir) {
    return { output: 'No interactive rebase in progress.', status: 'error' };
  }

  while (ir.remainingTodos.length > 0) {
    const item = ir.remainingTodos.shift()!;
    const sourceCommit = repo.commits[item.sha];
    if (!sourceCommit) continue;

    if (item.action === 'drop') {
      continue;
    }

    // Look ahead for any immediately following 'squash' or 'fixup' items so we can coalesce their tree & message cleanly
    let effectiveCommit = sourceCommit;
    let effectiveMessage = item.message;
    const parentSha = sourceCommit.parents[0];
    const baseCommit = parentSha ? repo.commits[parentSha] : undefined;
    const baseTree = baseCommit ? baseCommit.tree : {};

    while (
      ir.remainingTodos.length > 0 &&
      (ir.remainingTodos[0].action === 'squash' ||
        ir.remainingTodos[0].action === 'fixup')
    ) {
      const nextTodo = ir.remainingTodos.shift()!;
      const nextCommit = repo.commits[nextTodo.sha];
      if (nextCommit) {
        effectiveCommit = nextCommit;
        if (
          nextTodo.action === 'squash' &&
          nextTodo.message &&
          nextTodo.message !== nextCommit.message
        ) {
          effectiveMessage = nextTodo.message;
        }
      }
    }

    const currentTipCommit = repo.commits[ir.currentHeadSha];

    const { mergedTree, conflicts } = threeWayMergeTrees(
      baseTree,
      currentTipCommit.tree,
      effectiveCommit.tree,
      `HEAD (${currentTipCommit.message})`,
      `${effectiveCommit.sha} (${effectiveMessage})`
    );

    if (conflicts.length > 0) {
      ir.phase = 'conflict';
      ir.conflictingCommit = {
        ...effectiveCommit,
        message: effectiveMessage,
      };
      repo.head = { type: 'detached', ref: ir.currentHeadSha };
      repo.workingTree = mergedTree;
      repo.stagingIndex = { ...currentTipCommit.tree };
      repo.conflictedFiles = conflicts;
      return {
        status: 'warning',
        output: [
          `Auto-merging ${conflicts.join(', ')}`,
          `CONFLICT (content): Merge conflict in ${conflicts.join(', ')}`,
          `error: could not apply ${effectiveCommit.sha}... ${effectiveMessage}`,
          `Resolve all conflicts manually in the Code Editor, mark them as resolved with`,
          `"git add <file>", then run "git rebase --continue".`,
        ].join('\n'),
      };
    }

    if (item.action === 'squash' || item.action === 'fixup') {
      // Fold into currentHeadSha commit
      const prevCommit = repo.commits[ir.currentHeadSha];
      const combinedMsg =
        item.action === 'squash' ? effectiveMessage : prevCommit.message;
      const newSha = generateSha(
        `${prevCommit.parents.join(',')}:${combinedMsg}:${JSON.stringify(mergedTree)}:${Date.now()}`
      );
      const squashedCommit: GitCommit = {
        sha: newSha,
        message: combinedMsg,
        author: prevCommit.author,
        timestamp: 'just now',
        parents: [...prevCommit.parents],
        tree: mergedTree,
      };
      repo.commits[newSha] = squashedCommit;
      ir.currentHeadSha = newSha;
      repo.workingTree = { ...mergedTree };
      repo.stagingIndex = { ...mergedTree };
    } else {
      // pick or reword (possibly coalesced with trailing squash/fixup)
      const newSha = generateSha(
        `${ir.currentHeadSha}:${effectiveMessage}:${JSON.stringify(mergedTree)}:${repo.reflog.length}`
      );
      const newCommit: GitCommit = {
        sha: newSha,
        message: effectiveMessage,
        author: effectiveCommit.author,
        timestamp: 'just now',
        parents: [ir.currentHeadSha],
        tree: mergedTree,
      };
      repo.commits[newSha] = newCommit;
      ir.currentHeadSha = newSha;
      repo.workingTree = { ...mergedTree };
      repo.stagingIndex = { ...mergedTree };
    }
  }

  // Check if any remaining consecutive squash/fixup message overrides were provided
  const finalSha = ir.currentHeadSha;
  if (ir.originalBranch) {
    repo.branches[ir.originalBranch] = finalSha;
    repo.head = { type: 'branch', ref: ir.originalBranch };
  } else {
    repo.head = { type: 'detached', ref: finalSha };
  }
  const finalCommit = repo.commits[finalSha];
  repo.workingTree = { ...finalCommit.tree };
  repo.stagingIndex = { ...finalCommit.tree };
  repo.conflictedFiles = [];
  addReflog(
    repo,
    finalSha,
    'rebase (finish)',
    `returning to refs/heads/${ir.originalBranch || 'HEAD'}`
  );
  repo.interactiveRebase = null;

  return {
    status: 'success',
    output: `Successfully rebased and updated refs/heads/${ir.originalBranch || 'HEAD'} -> ${finalSha} (${finalCommit.message}).`,
  };
}

export function executeCommand(
  rawCommand: string,
  currentState: GitRepositoryState,
  customScriptRunner?: (
    scriptName: string,
    repo: GitRepositoryState
  ) => { output: string; exitCode: number }
): CommandExecutionOutput {
  const trimmedCmd = rawCommand.trim();
  const repo = cloneState(currentState);

  if (!trimmedCmd) {
    return { newState: repo, output: '', status: 'info' };
  }

  const args = parseArgs(trimmedCmd);
  const bin = args[0];

  // Utility shell commands
  if (bin === 'clear') {
    return { newState: repo, output: '', status: 'info', clearTerminal: true };
  }

  if (bin === 'help') {
    return {
      newState: repo,
      status: 'info',
      output: [
        'GitOps WarRoom Terminal — Supported Commands:',
        '  Porcelain:  git status | git log [--oneline] [--graph] [--all] | git diff [--staged]',
        '  Branches:   git branch [-a | -d | -D | -f <name> <rev>] | git checkout [-b] <ref> | git switch [-c] <ref>',
        '  Staging:    git add <file | .> | git rm [--cached] <file> | git commit [-m "<msg>"] [--amend]',
        '  History:    git rebase [-i] <upstream> | git rebase --continue | git rebase --abort',
        '  Recovery:   git reflog | git reset [--soft | --mixed | --hard] <rev> | git cherry-pick <sha> | git revert <sha>',
        '  Debugging:  git bisect <start | bad | good | reset | run ./test_billing.sh> | git stash [push | pop | list]',
        '  Remotes:    git fetch [origin] | git pull [--rebase] | git push [--force | --force-with-lease | --tags] [origin <ref>]',
        '  Shell:      ls | cat <file> | rm <file> | ./test_billing.sh | clear',
      ].join('\n'),
    };
  }

  if (bin === 'ls') {
    const files = Object.keys(repo.workingTree).sort();
    return {
      newState: repo,
      status: 'info',
      output: files.length > 0 ? files.join('  ') : '(empty working directory)',
    };
  }

  if (bin === 'cat') {
    const file = args[1];
    if (!file) {
      return { newState: repo, status: 'error', output: 'usage: cat <filename>' };
    }
    if (repo.workingTree[file] === undefined) {
      return {
        newState: repo,
        status: 'error',
        output: `cat: ${file}: No such file or directory`,
      };
    }
    return {
      newState: repo,
      status: 'info',
      output: repo.workingTree[file],
    };
  }

  if (bin === 'rm') {
    const file = args[args.length - 1];
    if (!file || repo.workingTree[file] === undefined) {
      return {
        newState: repo,
        status: 'error',
        output: `rm: cannot remove '${file || ''}': No such file or directory`,
      };
    }
    delete repo.workingTree[file];
    return {
      newState: repo,
      status: 'success',
      output: `Removed '${file}' from working tree. (Run 'git add ${file}' or 'git rm ${file}' to stage deletion)`,
    };
  }

  if (bin.startsWith('./')) {
    if (customScriptRunner) {
      const res = customScriptRunner(bin, repo);
      return {
        newState: repo,
        status: res.exitCode === 0 ? 'success' : 'error',
        output: res.output,
      };
    }
    return {
      newState: repo,
      status: 'error',
      output: `bash: ${bin}: No test script configured for this scenario`,
    };
  }

  if (bin !== 'git') {
    return {
      newState: repo,
      status: 'error',
      output: `bash: ${bin}: command not found. Type 'help' for supported Git and shell commands.`,
    };
  }

  const sub = args[1];
  const subArgs = args.slice(2);

  switch (sub) {
    case 'status':
      return handleStatus(repo);
    case 'log':
      return handleLog(repo, subArgs);
    case 'reflog':
      return handleReflog(repo);
    case 'diff':
      return handleDiff(repo, subArgs);
    case 'show':
      return handleShow(repo, subArgs);
    case 'branch':
      return handleBranch(repo, subArgs);
    case 'checkout':
      return handleCheckout(repo, subArgs);
    case 'switch':
      return handleSwitch(repo, subArgs);
    case 'add':
      return handleAdd(repo, subArgs);
    case 'rm':
      return handleGitRm(repo, subArgs);
    case 'commit':
      return handleCommit(repo, subArgs);
    case 'reset':
      return handleReset(repo, subArgs);
    case 'revert':
      return handleRevert(repo, subArgs);
    case 'cherry-pick':
      return handleCherryPick(repo, subArgs);
    case 'merge':
      return handleMerge(repo, subArgs);
    case 'rebase':
      return handleRebase(repo, subArgs);
    case 'tag':
      return handleTag(repo, subArgs);
    case 'stash':
      return handleStash(repo, subArgs);
    case 'clean':
      return handleClean(repo, subArgs);
    case 'bisect':
      return handleBisect(repo, subArgs, customScriptRunner);
    case 'fetch':
      return handleFetch(repo);
    case 'pull':
      return handlePull(repo, subArgs);
    case 'push':
      return handlePush(repo, subArgs);
    default:
      return {
        newState: repo,
        status: 'error',
        output: `git: '${sub || ''}' is not a git command. See 'help'.`,
      };
  }
}

function handleStatus(repo: GitRepositoryState): CommandExecutionOutput {
  const lines: string[] = [];
  if (repo.head.type === 'branch') {
    lines.push(`On branch ${repo.head.ref}`);
    const remoteSha = repo.remote.branches[repo.head.ref];
    const localSha = repo.branches[repo.head.ref];
    if (remoteSha && localSha) {
      if (remoteSha === localSha) {
        lines.push(`Your branch is up to date with 'origin/${repo.head.ref}'.`);
      } else if (isAncestor(repo.commits, remoteSha, localSha)) {
        const ahead = getCommitsBetween(repo.commits, remoteSha, localSha).length;
        lines.push(
          `Your branch is ahead of 'origin/${repo.head.ref}' by ${ahead} commit${ahead === 1 ? '' : 's'}.`
        );
      } else if (isAncestor(repo.commits, localSha, remoteSha)) {
        const behind = getCommitsBetween(repo.commits, localSha, remoteSha).length;
        lines.push(
          `Your branch is behind 'origin/${repo.head.ref}' by ${behind} commit${behind === 1 ? '' : 's'}.`
        );
      } else {
        lines.push(
          `Your branch and 'origin/${repo.head.ref}' have diverged.`
        );
      }
    }
  } else {
    lines.push(`HEAD detached at ${repo.head.ref}`);
  }

  if (repo.interactiveRebase) {
    lines.push(
      `interactive rebase in progress; onto ${repo.interactiveRebase.baseSha}`
    );
    lines.push(
      `  (fix conflicts and then run "git rebase --continue", or "git rebase --abort")`
    );
  }

  if (repo.bisect.active) {
    lines.push(
      `You are currently bisecting, started from ${repo.bisect.originalHead.ref}.`
    );
  }

  const headCommit = getHeadCommit(repo);
  const headTree = headCommit ? headCommit.tree : {};

  const stagedChanges: string[] = [];
  const unstagedChanges: string[] = [];
  const untrackedFiles: string[] = [];

  const allFiles = new Set([
    ...Object.keys(headTree),
    ...Object.keys(repo.stagingIndex),
    ...Object.keys(repo.workingTree),
  ]);

  for (const f of Array.from(allFiles).sort()) {
    if (repo.conflictedFiles.includes(f)) continue;
    const inHead = headTree[f];
    const inStage = repo.stagingIndex[f];
    const inWork = repo.workingTree[f];

    if (inHead !== inStage) {
      if (inHead === undefined && inStage !== undefined) {
        stagedChanges.push(`        new file:   ${f}`);
      } else if (inHead !== undefined && inStage === undefined) {
        stagedChanges.push(`        deleted:    ${f}`);
      } else {
        stagedChanges.push(`        modified:   ${f}`);
      }
    }

    if (inStage !== inWork) {
      if (inStage === undefined && inWork !== undefined) {
        untrackedFiles.push(`        ${f}`);
      } else if (inStage !== undefined && inWork === undefined) {
        unstagedChanges.push(`        deleted:    ${f}`);
      } else {
        unstagedChanges.push(`        modified:   ${f}`);
      }
    }
  }

  if (repo.conflictedFiles.length > 0) {
    lines.push('');
    lines.push('Unmerged paths:');
    lines.push('  (use "git add <file>..." to mark resolution)');
    for (const cf of repo.conflictedFiles) {
      lines.push(`        both modified:   ${cf}`);
    }
  }

  if (stagedChanges.length > 0) {
    lines.push('');
    lines.push('Changes to be committed:');
    lines.push(...stagedChanges);
  }

  if (unstagedChanges.length > 0) {
    lines.push('');
    lines.push('Changes not staged for commit:');
    lines.push(...unstagedChanges);
  }

  if (untrackedFiles.length > 0) {
    lines.push('');
    lines.push('Untracked files:');
    lines.push(...untrackedFiles);
  }

  if (
    repo.conflictedFiles.length === 0 &&
    stagedChanges.length === 0 &&
    unstagedChanges.length === 0 &&
    untrackedFiles.length === 0
  ) {
    lines.push('nothing to commit, working tree clean');
  }

  return { newState: repo, status: 'info', output: lines.join('\n') };
}

function handleLog(repo: GitRepositoryState, args: string[]): CommandExecutionOutput {
  const oneline = args.includes('--oneline');
  const showAll = args.includes('--all');
  const headSha = getHeadSha(repo);

  const startShas = showAll
    ? [
        headSha,
        ...Object.values(repo.branches),
        ...Object.values(repo.remote.branches),
        ...Object.values(repo.tags),
      ]
    : [headSha];

  const reachable = getReachableShas(repo.commits, startShas);
  const commitsList = Array.from(reachable)
    .map((sha) => repo.commits[sha])
    .filter(Boolean)
    .reverse();

  // Build decorations map
  const decorations = new Map<string, string[]>();
  const addDeco = (sha: string, label: string) => {
    const arr = decorations.get(sha) || [];
    arr.push(label);
    decorations.set(sha, arr);
  };

  if (repo.head.type === 'branch') {
    addDeco(headSha, `HEAD -> ${repo.head.ref}`);
  } else {
    addDeco(headSha, 'HEAD');
  }

  for (const [b, sha] of Object.entries(repo.branches)) {
    if (repo.head.type === 'branch' && repo.head.ref === b) continue;
    addDeco(sha, b);
  }
  for (const [rb, sha] of Object.entries(repo.remote.branches)) {
    addDeco(sha, `origin/${rb}`);
  }
  for (const [t, sha] of Object.entries(repo.tags)) {
    addDeco(sha, `tag: ${t}`);
  }

  const lines = commitsList.map((c) => {
    const decos = decorations.get(c.sha);
    const decoStr = decos && decos.length > 0 ? ` (${decos.join(', ')})` : '';
    if (oneline) {
      return `* ${c.sha}${decoStr} ${c.message}`;
    }
    return [
      `commit ${c.sha}${decoStr}`,
      `Author: ${c.author}`,
      `Date:   ${c.timestamp}`,
      ``,
      `    ${c.message}`,
      ``,
    ].join('\n');
  });

  return {
    newState: repo,
    status: 'info',
    output: lines.join('\n') || 'No commits yet.',
  };
}

function handleReflog(repo: GitRepositoryState): CommandExecutionOutput {
  const lines = repo.reflog.map(
    (entry) => `${entry.sha} HEAD@{${entry.index}}: ${entry.action}: ${entry.message}`
  );
  return {
    newState: repo,
    status: 'info',
    output: lines.join('\n'),
  };
}

function handleDiff(repo: GitRepositoryState, args: string[]): CommandExecutionOutput {
  const isStaged = args.includes('--staged') || args.includes('--cached');
  const headCommit = getHeadCommit(repo);
  const headTree = headCommit ? headCommit.tree : {};

  const leftTree = isStaged ? headTree : repo.stagingIndex;
  const rightTree = isStaged ? repo.stagingIndex : repo.workingTree;

  const allFiles = new Set([...Object.keys(leftTree), ...Object.keys(rightTree)]);
  const diffs: string[] = [];

  for (const file of Array.from(allFiles).sort()) {
    const a = leftTree[file];
    const b = rightTree[file];
    if (a === b) continue;
    diffs.push(`diff --git a/${file} b/${file}`);
    if (a === undefined) {
      diffs.push(`--- /dev/null`);
      diffs.push(`+++ b/${file}`);
      for (const line of (b || '').split('\n')) {
        diffs.push(`+${line}`);
      }
    } else if (b === undefined) {
      diffs.push(`--- a/${file}`);
      diffs.push(`+++ /dev/null`);
      for (const line of a.split('\n')) {
        diffs.push(`-${line}`);
      }
    } else {
      diffs.push(`--- a/${file}`);
      diffs.push(`+++ b/${file}`);
      const aLines = a.split('\n');
      const bLines = b.split('\n');
      for (const l of aLines) {
        if (!bLines.includes(l)) diffs.push(`-${l}`);
      }
      for (const l of bLines) {
        if (!aLines.includes(l)) diffs.push(`+${l}`);
      }
    }
  }

  return {
    newState: repo,
    status: 'info',
    output: diffs.length > 0 ? diffs.join('\n') : '(no diff)',
  };
}

function handleShow(repo: GitRepositoryState, args: string[]): CommandExecutionOutput {
  const rev = args[0] || 'HEAD';
  const sha = resolveRevision(repo, rev);
  if (!sha || !repo.commits[sha]) {
    return {
      newState: repo,
      status: 'error',
      output: `fatal: ambiguous argument '${rev}': unknown revision`,
    };
  }
  const c = repo.commits[sha];
  const files = Object.keys(c.tree).join(', ');
  return {
    newState: repo,
    status: 'info',
    output: [
      `commit ${c.sha}`,
      `Author: ${c.author}`,
      `Date:   ${c.timestamp}`,
      ``,
      `    ${c.message}`,
      ``,
      `Files in snapshot: ${files}`,
    ].join('\n'),
  };
}

function handleBranch(repo: GitRepositoryState, args: string[]): CommandExecutionOutput {
  if (args.length === 0 || args.includes('-a') || args.includes('--all')) {
    const showAll = args.includes('-a') || args.includes('--all');
    const lines: string[] = [];
    if (repo.head.type === 'detached') {
      lines.push(`* (HEAD detached at ${repo.head.ref})`);
    }
    for (const b of Object.keys(repo.branches).sort()) {
      const prefix = repo.head.type === 'branch' && repo.head.ref === b ? '* ' : '  ';
      lines.push(`${prefix}${b}`);
    }
    if (showAll) {
      for (const rb of Object.keys(repo.remote.branches).sort()) {
        lines.push(`  remotes/origin/${rb}`);
      }
    }
    return { newState: repo, status: 'info', output: lines.join('\n') };
  }

  if (args[0] === '-d' || args[0] === '-D') {
    const branchName = args[1];
    if (!branchName || !repo.branches[branchName]) {
      return {
        newState: repo,
        status: 'error',
        output: `error: branch '${branchName || ''}' not found.`,
      };
    }
    if (repo.head.type === 'branch' && repo.head.ref === branchName) {
      return {
        newState: repo,
        status: 'error',
        output: `error: Cannot delete branch '${branchName}' checked out at current working tree.`,
      };
    }
    const deletedSha = repo.branches[branchName];
    delete repo.branches[branchName];
    return {
      newState: repo,
      status: 'success',
      output: `Deleted branch ${branchName} (was ${deletedSha}).`,
    };
  }

  if (args[0] === '-f') {
    const branchName = args[1];
    const targetRev = args[2] || 'HEAD';
    const targetSha = resolveRevision(repo, targetRev);
    if (!branchName || !targetSha) {
      return {
        newState: repo,
        status: 'error',
        output: `fatal: Not a valid object name: '${targetRev}'.`,
      };
    }
    repo.branches[branchName] = targetSha;
    return {
      newState: repo,
      status: 'success',
      output: `Reset branch '${branchName}' to ${targetSha}.`,
    };
  }

  // Create branch: git branch <name> [start-point]
  const newBranch = args[0];
  const startRev = args[1] || 'HEAD';
  const startSha = resolveRevision(repo, startRev);
  if (!startSha) {
    return {
      newState: repo,
      status: 'error',
      output: `fatal: Not a valid object name: '${startRev}'.`,
    };
  }
  repo.branches[newBranch] = startSha;
  return {
    newState: repo,
    status: 'success',
    output: `Created branch '${newBranch}' at ${startSha}.`,
  };
}

function handleCheckout(repo: GitRepositoryState, args: string[]): CommandExecutionOutput {
  if (args.length === 0) {
    return { newState: repo, status: 'error', output: 'usage: git checkout [-b] <branch|commit>' };
  }

  // git checkout -- <file>
  if (args[0] === '--' && args[1]) {
    const file = args[1];
    if (repo.stagingIndex[file] !== undefined) {
      repo.workingTree[file] = repo.stagingIndex[file];
      repo.conflictedFiles = repo.conflictedFiles.filter((f) => f !== file);
      return {
        newState: repo,
        status: 'success',
        output: `Updated 1 path from the index (${file})`,
      };
    }
    return {
      newState: repo,
      status: 'error',
      output: `error: pathspec '${file}' did not match any file(s) known to git`,
    };
  }

  if (args[0] === '-b' || args[0] === '-B') {
    const newBranch = args[1];
    const startRev = args[2] || 'HEAD';
    if (!newBranch) {
      return { newState: repo, status: 'error', output: 'fatal:branch name required' };
    }
    const targetSha = resolveRevision(repo, startRev);
    if (!targetSha || !repo.commits[targetSha]) {
      return {
        newState: repo,
        status: 'error',
        output: `fatal: '${startRev}' is not a commit and a branch '${newBranch}' cannot be created from it`,
      };
    }
    const prevRef = repo.head.ref;
    repo.branches[newBranch] = targetSha;
    repo.head = { type: 'branch', ref: newBranch };
    const commit = repo.commits[targetSha];
    repo.workingTree = { ...commit.tree };
    repo.stagingIndex = { ...commit.tree };
    repo.conflictedFiles = [];
    addReflog(repo, targetSha, 'checkout', `moving from ${prevRef} to ${newBranch}`);
    return {
      newState: repo,
      status: 'success',
      output: `Switched to a new branch '${newBranch}'`,
    };
  }

  const target = args[0];
  const prevRef = repo.head.ref;

  if (repo.branches[target]) {
    const sha = repo.branches[target];
    const commit = repo.commits[sha];
    repo.head = { type: 'branch', ref: target };
    repo.workingTree = { ...commit.tree };
    repo.stagingIndex = { ...commit.tree };
    repo.conflictedFiles = [];
    addReflog(repo, sha, 'checkout', `moving from ${prevRef} to ${target}`);
    return {
      newState: repo,
      status: 'success',
      output: `Switched to branch '${target}'`,
    };
  }

  const resolvedSha = resolveRevision(repo, target);
  if (resolvedSha && repo.commits[resolvedSha]) {
    const commit = repo.commits[resolvedSha];
    repo.head = { type: 'detached', ref: resolvedSha };
    repo.workingTree = { ...commit.tree };
    repo.stagingIndex = { ...commit.tree };
    repo.conflictedFiles = [];
    addReflog(repo, resolvedSha, 'checkout', `moving from ${prevRef} to ${resolvedSha}`);
    return {
      newState: repo,
      status: 'info',
      output: [
        `Note: switching to '${target}'.`,
        `You are in 'detached HEAD' state. You can look around, make experimental`,
        `changes and commit them, or create a new branch via 'git switch -c <new-branch-name>'.`,
        `HEAD is now at ${resolvedSha} ${commit.message}`,
      ].join('\n'),
    };
  }

  // Check if target is a file in stagingIndex
  if (repo.stagingIndex[target] !== undefined) {
    repo.workingTree[target] = repo.stagingIndex[target];
    repo.conflictedFiles = repo.conflictedFiles.filter((f) => f !== target);
    return {
      newState: repo,
      status: 'success',
      output: `Updated 1 path from the index (${target})`,
    };
  }

  return {
    newState: repo,
    status: 'error',
    output: `error: pathspec '${target}' did not match any file(s) or branch known to git`,
  };
}

function handleSwitch(repo: GitRepositoryState, args: string[]): CommandExecutionOutput {
  if (args[0] === '-c' || args[0] === '-C') {
    return handleCheckout(repo, ['-b', ...args.slice(1)]);
  }
  return handleCheckout(repo, args);
}

function handleAdd(repo: GitRepositoryState, args: string[]): CommandExecutionOutput {
  if (args.length === 0) {
    return { newState: repo, status: 'error', output: 'Nothing specified, nothing added.' };
  }

  if (args[0] === '.' || args[0] === '-A' || args[0] === '--all') {
    repo.stagingIndex = { ...repo.workingTree };
    // Clear conflict status ONLY for files that no longer contain conflict markers
    repo.conflictedFiles = repo.conflictedFiles.filter((f) =>
      hasConflictMarkers(repo.workingTree[f] || '')
    );
    return {
      newState: repo,
      status: 'success',
      output: 'Staged all changes in working tree.',
    };
  }

  for (const file of args) {
    if (repo.workingTree[file] !== undefined) {
      repo.stagingIndex[file] = repo.workingTree[file];
      if (!hasConflictMarkers(repo.workingTree[file])) {
        repo.conflictedFiles = repo.conflictedFiles.filter((f) => f !== file);
      }
    } else if (repo.stagingIndex[file] !== undefined) {
      delete repo.stagingIndex[file];
      repo.conflictedFiles = repo.conflictedFiles.filter((f) => f !== file);
    } else {
      return {
        newState: repo,
        status: 'error',
        output: `fatal: pathspec '${file}' did not match any files`,
      };
    }
  }

  return {
    newState: repo,
    status: 'success',
    output: `Staged ${args.join(', ')}`,
  };
}

function handleGitRm(repo: GitRepositoryState, args: string[]): CommandExecutionOutput {
  const isCached = args.includes('--cached');
  const files = args.filter((a) => !a.startsWith('-'));
  if (files.length === 0) {
    return { newState: repo, status: 'error', output: 'usage: git rm [--cached] <file>' };
  }

  for (const f of files) {
    if (repo.stagingIndex[f] === undefined && repo.workingTree[f] === undefined) {
      return {
        newState: repo,
        status: 'error',
        output: `fatal: pathspec '${f}' did not match any files`,
      };
    }
    delete repo.stagingIndex[f];
    if (!isCached) {
      delete repo.workingTree[f];
    }
  }

  return {
    newState: repo,
    status: 'success',
    output: `rm '${files.join("', '")}'`,
  };
}

function handleCommit(repo: GitRepositoryState, args: string[]): CommandExecutionOutput {
  const isAmend = args.includes('--amend');
  const stageAll = args.includes('-a') || args.includes('-am');

  if (stageAll) {
    for (const k of Object.keys(repo.stagingIndex)) {
      if (repo.workingTree[k] !== undefined) {
        repo.stagingIndex[k] = repo.workingTree[k];
      } else {
        delete repo.stagingIndex[k];
      }
    }
  }

  // Anti-pattern check: committing unresolved conflict markers!
  for (const [file, content] of Object.entries(repo.stagingIndex)) {
    if (hasConflictMarkers(content)) {
      return {
        newState: repo,
        status: 'error',
        output: `error: Committing file '${file}' with unresolved conflict markers (<<<<<<< / ======= / >>>>>>>) is blocked!`,
        antiPatternAlert: {
          id: `alert-${Date.now()}`,
          sender: 'Elena Vance (Staff SRE)',
          role: 'Staff Engineer',
          channel: '#incidents-war-room',
          timestamp: 'Just now',
          isAlert: true,
          text: `🚨 Hold on! You just tried to commit '${file}' while it still contains raw Git merge conflict markers (<<<<<<<). If that hits production, the parser will crash immediately. Open '${file}' in the Code Editor and resolve the conflict blocks first!`,
        },
      };
    }
  }

  let message = '';
  const mIndex = args.findIndex((a) => a === '-m' || a === '-am');
  if (mIndex !== -1 && args[mIndex + 1]) {
    message = args[mIndex + 1];
  } else if (isAmend) {
    const prevCommit = getHeadCommit(repo);
    message = prevCommit ? prevCommit.message : 'Amended commit';
  } else if (repo.inProgressOperation) {
    message = repo.inProgressOperation.message;
  } else {
    return {
      newState: repo,
      status: 'error',
      output: 'error: please provide a commit message using -m "<message>"',
    };
  }

  const headSha = getHeadSha(repo);
  const headCommit = repo.commits[headSha];
  const parents = isAmend && headCommit ? [...headCommit.parents] : headSha ? [headSha] : [];

  const newSha = generateSha(
    `${parents.join(',')}:${message}:${JSON.stringify(repo.stagingIndex)}:${repo.reflog.length}`
  );

  const newCommit: GitCommit = {
    sha: newSha,
    message,
    author: 'You <oncall@warroom.dev>',
    timestamp: 'just now',
    parents,
    tree: { ...repo.stagingIndex },
  };

  repo.commits[newSha] = newCommit;
  if (repo.head.type === 'branch') {
    repo.branches[repo.head.ref] = newSha;
  } else {
    repo.head.ref = newSha;
  }
  repo.conflictedFiles = [];
  repo.inProgressOperation = null;

  addReflog(
    repo,
    newSha,
    isAmend ? 'commit (amend)' : 'commit',
    message
  );

  const branchLabel = repo.head.type === 'branch' ? repo.head.ref : 'detached HEAD';
  return {
    newState: repo,
    status: 'success',
    output: `[${branchLabel} ${newSha}] ${message}`,
  };
}

function handleReset(repo: GitRepositoryState, args: string[]): CommandExecutionOutput {
  let mode: 'soft' | 'mixed' | 'hard' = 'mixed';
  const filteredArgs: string[] = [];

  for (const a of args) {
    if (a === '--soft') mode = 'soft';
    else if (a === '--mixed') mode = 'mixed';
    else if (a === '--hard') mode = 'hard';
    else filteredArgs.push(a);
  }

  // Check if resetting a single file: git reset HEAD <file>
  if (
    filteredArgs.length === 2 &&
    filteredArgs[0] === 'HEAD' &&
    repo.stagingIndex[filteredArgs[1]] !== undefined
  ) {
    const file = filteredArgs[1];
    const headCommit = getHeadCommit(repo);
    if (headCommit && headCommit.tree[file] !== undefined) {
      repo.stagingIndex[file] = headCommit.tree[file];
    } else {
      delete repo.stagingIndex[file];
    }
    return {
      newState: repo,
      status: 'info',
      output: `Unstaged changes after reset:\nM       ${file}`,
    };
  }

  const targetRev = filteredArgs[0] || 'HEAD';
  const targetSha = resolveRevision(repo, targetRev);
  if (!targetSha || !repo.commits[targetSha]) {
    return {
      newState: repo,
      status: 'error',
      output: `fatal: ambiguous argument '${targetRev}': unknown revision`,
    };
  }

  const targetCommit = repo.commits[targetSha];
  if (repo.head.type === 'branch') {
    repo.branches[repo.head.ref] = targetSha;
  } else {
    repo.head.ref = targetSha;
  }

  if (mode === 'mixed' || mode === 'hard') {
    repo.stagingIndex = { ...targetCommit.tree };
  }
  if (mode === 'hard') {
    repo.workingTree = { ...targetCommit.tree };
    repo.conflictedFiles = [];
    repo.inProgressOperation = null;
    repo.interactiveRebase = null;
  }

  addReflog(repo, targetSha, `reset`, `moving to ${targetRev}`);

  return {
    newState: repo,
    status: 'success',
    output: `HEAD is now at ${targetSha} ${targetCommit.message}`,
  };
}

function handleRevert(repo: GitRepositoryState, args: string[]): CommandExecutionOutput {
  const mIndex = args.indexOf('-m');
  const parentNumber = mIndex !== -1 ? parseInt(args[mIndex + 1], 10) : null;
  const rev = args.find((a, i) => !a.startsWith('-') && (mIndex === -1 || (i !== mIndex && i !== mIndex + 1)));
  if (!rev) {
    return { newState: repo, status: 'error', output: 'usage: git revert [-m <parent-number>] <commit-sha>' };
  }
  const targetSha = resolveRevision(repo, rev);
  if (!targetSha || !repo.commits[targetSha]) {
    return {
      newState: repo,
      status: 'error',
      output: `fatal: bad revision '${rev}'`,
    };
  }

  const targetCommit = repo.commits[targetSha];
  if (targetCommit.parents.length > 1 && !parentNumber) {
    return {
      newState: repo,
      status: 'error',
      output: `error: commit ${targetSha} is a merge but no -m option was given.\nfatal: revert failed`,
    };
  }

  const parentIdx = parentNumber ? Math.max(0, parentNumber - 1) : 0;
  const parentSha = targetCommit.parents[parentIdx] || targetCommit.parents[0];
  const parentTree = parentSha && repo.commits[parentSha] ? repo.commits[parentSha].tree : {};
  const headSha = getHeadSha(repo);
  const headCommit = repo.commits[headSha];

  // Reverting targetCommit means merging parentTree (as target) against targetCommit.tree (as base) into headCommit.tree
  const { mergedTree, conflicts } = threeWayMergeTrees(
    targetCommit.tree,
    headCommit.tree,
    parentTree,
    'HEAD',
    `parent of ${targetSha}`
  );

  if (conflicts.length > 0) {
    repo.workingTree = mergedTree;
    repo.conflictedFiles = conflicts;
    return {
      newState: repo,
      status: 'warning',
      output: `error: could not revert ${targetSha}... ${targetCommit.message}\nResolve conflicts and commit.`,
    };
  }

  const revertMsg = `Revert "${targetCommit.message}"`;
  const newSha = generateSha(
    `${headSha}:${revertMsg}:${JSON.stringify(mergedTree)}:${repo.reflog.length}`
  );

  const newCommit: GitCommit = {
    sha: newSha,
    message: revertMsg,
    author: 'You <oncall@warroom.dev>',
    timestamp: 'just now',
    parents: [headSha],
    tree: mergedTree,
    revertedFromSha: targetSha,
  };

  repo.commits[newSha] = newCommit;
  if (repo.head.type === 'branch') {
    repo.branches[repo.head.ref] = newSha;
  } else {
    repo.head.ref = newSha;
  }
  repo.workingTree = { ...mergedTree };
  repo.stagingIndex = { ...mergedTree };
  addReflog(repo, newSha, 'revert', revertMsg);

  return {
    newState: repo,
    status: 'success',
    output: `[${repo.head.ref} ${newSha}] ${revertMsg}`,
  };
}

function handleCherryPick(repo: GitRepositoryState, args: string[]): CommandExecutionOutput {
  if (args[0] === '--abort') {
    const headCommit = getHeadCommit(repo);
    if (headCommit) {
      repo.workingTree = { ...headCommit.tree };
      repo.stagingIndex = { ...headCommit.tree };
    }
    repo.conflictedFiles = [];
    repo.inProgressOperation = null;
    return { newState: repo, status: 'info', output: 'Cherry-pick aborted.' };
  }

  if (args[0] === '--continue') {
    if (!repo.inProgressOperation || repo.inProgressOperation.type !== 'cherry-pick') {
      return { newState: repo, status: 'error', output: 'error: no cherry-pick in progress' };
    }
    return handleCommit(repo, ['-m', repo.inProgressOperation.message]);
  }

  const rev = args[0];
  const targetSha = resolveRevision(repo, rev);
  if (!targetSha || !repo.commits[targetSha]) {
    return {
      newState: repo,
      status: 'error',
      output: `fatal: bad revision '${rev || ''}'`,
    };
  }

  const sourceCommit = repo.commits[targetSha];
  const parentSha = sourceCommit.parents[0];
  const baseTree = parentSha && repo.commits[parentSha] ? repo.commits[parentSha].tree : {};
  const headSha = getHeadSha(repo);
  const headCommit = repo.commits[headSha];

  const { mergedTree, conflicts } = threeWayMergeTrees(
    baseTree,
    headCommit.tree,
    sourceCommit.tree,
    'HEAD',
    `${sourceCommit.sha} (${sourceCommit.message})`
  );

  if (conflicts.length > 0) {
    repo.workingTree = mergedTree;
    repo.conflictedFiles = conflicts;
    repo.inProgressOperation = {
      type: 'cherry-pick',
      sourceRef: rev,
      sourceSha: targetSha,
      message: sourceCommit.message,
    };
    return {
      newState: repo,
      status: 'warning',
      output: [
        `Auto-merging ${conflicts.join(', ')}`,
        `CONFLICT (content): Merge conflict in ${conflicts.join(', ')}`,
        `error: could not apply ${sourceCommit.sha}... ${sourceCommit.message}`,
        `hint: after resolving the conflicts, mark them with 'git add <paths>' and run 'git cherry-pick --continue'`,
      ].join('\n'),
    };
  }

  const newSha = generateSha(
    `${headSha}:${sourceCommit.message}:${JSON.stringify(mergedTree)}:${repo.reflog.length}`
  );
  const newCommit: GitCommit = {
    sha: newSha,
    message: sourceCommit.message,
    author: sourceCommit.author,
    timestamp: 'just now',
    parents: [headSha],
    tree: mergedTree,
    cherryPickedFromSha: sourceCommit.sha,
  };

  repo.commits[newSha] = newCommit;
  if (repo.head.type === 'branch') {
    repo.branches[repo.head.ref] = newSha;
  } else {
    repo.head.ref = newSha;
  }
  repo.workingTree = { ...mergedTree };
  repo.stagingIndex = { ...mergedTree };
  addReflog(repo, newSha, 'cherry-pick', sourceCommit.message);

  return {
    newState: repo,
    status: 'success',
    output: `[${repo.head.ref} ${newSha}] ${sourceCommit.message}`,
  };
}

function handleMerge(repo: GitRepositoryState, args: string[]): CommandExecutionOutput {
  if (args[0] === '--abort') {
    const headCommit = getHeadCommit(repo);
    if (headCommit) {
      repo.workingTree = { ...headCommit.tree };
      repo.stagingIndex = { ...headCommit.tree };
    }
    repo.conflictedFiles = [];
    repo.inProgressOperation = null;
    return { newState: repo, status: 'info', output: 'Merge aborted.' };
  }

  const targetRef = args[0];
  const targetSha = resolveRevision(repo, targetRef);
  if (!targetSha || !repo.commits[targetSha]) {
    return {
      newState: repo,
      status: 'error',
      output: `merge: ${targetRef || ''} - not something we can merge`,
    };
  }

  const headSha = getHeadSha(repo);
  if (headSha === targetSha || isAncestor(repo.commits, targetSha, headSha)) {
    return { newState: repo, status: 'info', output: 'Already up to date.' };
  }

  // Fast-forward check
  if (isAncestor(repo.commits, headSha, targetSha)) {
    const targetCommit = repo.commits[targetSha];
    if (repo.head.type === 'branch') {
      repo.branches[repo.head.ref] = targetSha;
    } else {
      repo.head.ref = targetSha;
    }
    repo.workingTree = { ...targetCommit.tree };
    repo.stagingIndex = { ...targetCommit.tree };
    addReflog(repo, targetSha, `merge ${targetRef}`, 'Fast-forward');
    return {
      newState: repo,
      status: 'success',
      output: `Updating ${headSha}..${targetSha}\nFast-forward`,
    };
  }

  const commonSha = findCommonAncestor(repo.commits, headSha, targetSha);
  const baseTree = commonSha && repo.commits[commonSha] ? repo.commits[commonSha].tree : {};
  const headCommit = repo.commits[headSha];
  const targetCommit = repo.commits[targetSha];

  const { mergedTree, conflicts } = threeWayMergeTrees(
    baseTree,
    headCommit.tree,
    targetCommit.tree,
    'HEAD',
    targetRef
  );

  if (conflicts.length > 0) {
    repo.workingTree = mergedTree;
    repo.conflictedFiles = conflicts;
    repo.inProgressOperation = {
      type: 'merge',
      sourceRef: targetRef,
      sourceSha: targetSha,
      message: `Merge branch '${targetRef}' into ${repo.head.ref}`,
    };
    return {
      newState: repo,
      status: 'warning',
      output: [
        `Auto-merging ${conflicts.join(', ')}`,
        `CONFLICT (content): Merge conflict in ${conflicts.join(', ')}`,
        `Automatic merge failed; fix conflicts and then commit the result.`,
      ].join('\n'),
    };
  }

  const mergeMsg = `Merge branch '${targetRef}' into ${repo.head.ref}`;
  const newSha = generateSha(
    `${headSha},${targetSha}:${mergeMsg}:${JSON.stringify(mergedTree)}`
  );
  const mergeCommit: GitCommit = {
    sha: newSha,
    message: mergeMsg,
    author: 'You <oncall@warroom.dev>',
    timestamp: 'just now',
    parents: [headSha, targetSha],
    tree: mergedTree,
  };
  repo.commits[newSha] = mergeCommit;
  if (repo.head.type === 'branch') {
    repo.branches[repo.head.ref] = newSha;
  } else {
    repo.head.ref = newSha;
  }
  repo.workingTree = { ...mergedTree };
  repo.stagingIndex = { ...mergedTree };
  addReflog(repo, newSha, `merge ${targetRef}`, 'Merge made by the ort strategy.');

  return {
    newState: repo,
    status: 'success',
    output: `Merge made by the 'ort' strategy.`,
  };
}

function handleRebase(repo: GitRepositoryState, args: string[]): CommandExecutionOutput {
  if (args[0] === '--abort') {
    if (!repo.interactiveRebase) {
      return { newState: repo, status: 'error', output: 'fatal: No rebase in progress?' };
    }
    const { originalBranch, originalHeadSha } = repo.interactiveRebase;
    if (originalBranch) {
      repo.branches[originalBranch] = originalHeadSha;
      repo.head = { type: 'branch', ref: originalBranch };
    } else {
      repo.head = { type: 'detached', ref: originalHeadSha };
    }
    const origCommit = repo.commits[originalHeadSha];
    repo.workingTree = { ...origCommit.tree };
    repo.stagingIndex = { ...origCommit.tree };
    repo.conflictedFiles = [];
    repo.interactiveRebase = null;
    addReflog(repo, originalHeadSha, 'rebase (abort)', `returning to ${originalBranch || originalHeadSha}`);
    return {
      newState: repo,
      status: 'info',
      output: `Rebase aborted. Restored HEAD to ${originalHeadSha}.`,
    };
  }

  if (args[0] === '--continue') {
    const ir = repo.interactiveRebase;
    if (!ir) {
      return { newState: repo, status: 'error', output: 'fatal: No rebase in progress?' };
    }
    // Verify no conflict markers remain in workingTree or stagingIndex
    for (const [f, content] of Object.entries(repo.workingTree)) {
      if (hasConflictMarkers(content)) {
        return {
          newState: repo,
          status: 'error',
          output: `error: '${f}' still contains conflict markers (<<<<<<<). Resolve them in the Code Editor and run 'git add ${f}' first.`,
          antiPatternAlert: {
            id: `alert-${Date.now()}`,
            sender: 'Elena Vance (Staff SRE)',
            role: 'Staff Engineer',
            channel: '#incidents-war-room',
            timestamp: 'Just now',
            isAlert: true,
            text: `⚠️ You ran 'git rebase --continue' while '${f}' still has unresolved conflict markers! Use the "Accept Current / Incoming / Both" actions in the Code Editor, then stage with 'git add ${f}'.`,
          },
        };
      }
    }

    if (repo.conflictedFiles.length > 0) {
      return {
        newState: repo,
        status: 'error',
        output: `error: you must stage all resolved files with 'git add <file>' before running 'git rebase --continue'.`,
      };
    }

    if (ir.conflictingCommit) {
      const msg = ir.conflictingCommit.message;
      const newSha = generateSha(
        `${ir.currentHeadSha}:${msg}:${JSON.stringify(repo.stagingIndex)}:${Date.now()}`
      );
      const newCommit: GitCommit = {
        sha: newSha,
        message: msg,
        author: ir.conflictingCommit.author,
        timestamp: 'just now',
        parents: [ir.currentHeadSha],
        tree: { ...repo.stagingIndex },
      };
      repo.commits[newSha] = newCommit;
      ir.currentHeadSha = newSha;
      ir.conflictingCommit = undefined;
      ir.phase = 'todo';
    }

    const res = processRebaseQueue(repo);
    return { newState: repo, status: res.status, output: res.output };
  }

  const isInteractive = args.includes('-i') || args.includes('--interactive');

  const ontoIdx = args.indexOf('--onto');
  if (ontoIdx !== -1 && args[ontoIdx + 1] && args[ontoIdx + 2]) {
    const newbaseArg = args[ontoIdx + 1];
    const upstreamArg = args[ontoIdx + 2];
    const branchArg = args[ontoIdx + 3];

    if (branchArg && repo.branches[branchArg]) {
      repo.head = { type: 'branch', ref: branchArg };
      const bCommit = repo.commits[repo.branches[branchArg]];
      repo.workingTree = { ...bCommit.tree };
      repo.stagingIndex = { ...bCommit.tree };
    }

    const newbaseSha = resolveRevision(repo, newbaseArg);
    const upstreamSha = resolveRevision(repo, upstreamArg);
    if (!newbaseSha || !upstreamSha) {
      return {
        newState: repo,
        status: 'error',
        output: `fatal: could not resolve --onto target or upstream`,
      };
    }

    const headSha = getHeadSha(repo);
    const commitsToReplay = getCommitsBetween(repo.commits, upstreamSha, headSha);

    const todos: RebaseTodoItem[] = commitsToReplay.map((c) => ({
      action: 'pick',
      sha: c.sha,
      message: c.message,
      author: c.author,
    }));

    repo.interactiveRebase = {
      active: true,
      phase: 'todo',
      baseSha: newbaseSha,
      targetName: newbaseArg,
      originalBranch: repo.head.type === 'branch' ? repo.head.ref : null,
      originalHeadSha: headSha,
      todos,
      remainingTodos: [...todos],
      currentHeadSha: newbaseSha,
      accumulatedMessage: '',
    };

    if (isInteractive) {
      return {
        newState: repo,
        status: 'info',
        output: [
          `Interactive rebase started onto ${newbaseSha} (${newbaseArg}).`,
          `Opened Interactive Rebase Todo Editor in the top-left Code Pane (${todos.length} commits).`,
        ].join('\n'),
      };
    }
    const res = processRebaseQueue(repo);
    return { newState: repo, status: res.status, output: res.output };
  }

  const targetArg = args.find((a) => !a.startsWith('-'));
  if (!targetArg) {
    return {
      newState: repo,
      status: 'error',
      output: 'usage: git rebase [-i] <upstream> OR git rebase --onto <newbase> <upstream> [branch]',
    };
  }

  const targetSha = resolveRevision(repo, targetArg);
  if (!targetSha || !repo.commits[targetSha]) {
    return {
      newState: repo,
      status: 'error',
      output: `fatal: invalid upstream '${targetArg}'`,
    };
  }

  const headSha = getHeadSha(repo);
  const commonBase = findCommonAncestor(repo.commits, targetSha, headSha) || targetSha;
  const commitsToReplay = getCommitsBetween(repo.commits, commonBase, headSha);

  if (commitsToReplay.length === 0) {
    // Fast-forward branch onto targetSha
    if (repo.head.type === 'branch') {
      repo.branches[repo.head.ref] = targetSha;
    } else {
      repo.head.ref = targetSha;
    }
    const targetCommit = repo.commits[targetSha];
    repo.workingTree = { ...targetCommit.tree };
    repo.stagingIndex = { ...targetCommit.tree };
    return {
      newState: repo,
      status: 'success',
      output: `Current branch ${repo.head.ref} is up to date with ${targetArg}.`,
    };
  }

  const todos: RebaseTodoItem[] = commitsToReplay.map((c) => ({
    action: 'pick',
    sha: c.sha,
    message: c.message,
    author: c.author,
  }));

  repo.interactiveRebase = {
    active: true,
    phase: 'todo',
    baseSha: targetSha,
    targetName: targetArg,
    originalBranch: repo.head.type === 'branch' ? repo.head.ref : null,
    originalHeadSha: headSha,
    todos,
    remainingTodos: [...todos],
    currentHeadSha: targetSha,
    accumulatedMessage: '',
  };

  if (isInteractive) {
    return {
      newState: repo,
      status: 'info',
      output: [
        `Interactive rebase started onto ${targetSha} (${targetArg}).`,
        `Opened Interactive Rebase Todo Editor in the top-left Code Pane (${todos.length} commits).`,
        `Choose pick / squash / fixup / reword / drop and click "Execute Rebase".`,
      ].join('\n'),
    };
  }

  // Non-interactive rebase: immediately process the queue
  const res = processRebaseQueue(repo);
  return { newState: repo, status: res.status, output: res.output };
}

function handleTag(repo: GitRepositoryState, args: string[]): CommandExecutionOutput {
  if (args.length === 0) {
    const tags = Object.keys(repo.tags).sort();
    return { newState: repo, status: 'info', output: tags.join('\n') };
  }

  if (args[0] === '-d') {
    const tagName = args[1];
    if (!tagName || !repo.tags[tagName]) {
      return {
        newState: repo,
        status: 'error',
        output: `error: tag '${tagName || ''}' not found.`,
      };
    }
    delete repo.tags[tagName];
    return { newState: repo, status: 'success', output: `Deleted tag '${tagName}'` };
  }

  const filtered = args.filter((a) => a !== '-a' && a !== '-f');
  let tagName = filtered[0];
  let targetRev = filtered[1] || 'HEAD';
  const mIdx = args.indexOf('-m');
  if (mIdx !== -1) {
    const withoutM = args.filter((_, idx) => idx !== mIdx && idx !== mIdx + 1 && _ !== '-a');
    tagName = withoutM[0];
    targetRev = withoutM[1] || 'HEAD';
  }

  const sha = resolveRevision(repo, targetRev);
  if (!tagName || !sha) {
    return {
      newState: repo,
      status: 'error',
      output: `fatal: Failed to resolve '${targetRev}' as a valid ref.`,
    };
  }

  repo.tags[tagName] = sha;
  return {
    newState: repo,
    status: 'success',
    output: `Created tag '${tagName}' at ${sha}`,
  };
}

function handleClean(repo: GitRepositoryState, args: string[]): CommandExecutionOutput {
  const isForce = args.includes('-f') || args.includes('--force') || args.includes('-fd') || args.includes('-df');
  if (!isForce) {
    return {
      newState: repo,
      status: 'error',
      output: 'fatal: clean.requireForce defaults to true and neither -i, -n, nor -f given; refusing to clean',
    };
  }
  const headCommit = getHeadCommit(repo);
  const headTree = headCommit ? headCommit.tree : {};
  const removed: string[] = [];
  for (const f of Object.keys(repo.workingTree)) {
    if (headTree[f] === undefined && repo.stagingIndex[f] === undefined) {
      delete repo.workingTree[f];
      removed.push(f);
    }
  }
  return {
    newState: repo,
    status: 'success',
    output: removed.length > 0 ? `Removing ${removed.join('\nRemoving ')}` : 'Nothing to clean',
  };
}

function handleStash(repo: GitRepositoryState, args: string[]): CommandExecutionOutput {
  let sub = args[0] || 'push';
  let stashMsg = '';

  const mIdx = args.findIndex((a) => a === '-m' || a === '--message');
  if (mIdx !== -1 && args[mIdx + 1]) {
    stashMsg = args[mIdx + 1];
  } else if (args[1] && !args[1].startsWith('-')) {
    stashMsg = args[1];
  }

  if (sub.startsWith('-')) {
    sub = 'push';
  }

  if (sub === 'list') {
    const lines = repo.stashes.map(
      (s, idx) => `stash@{${idx}}: WIP on ${s.branchOrSha}: ${s.message}`
    );
    return {
      newState: repo,
      status: 'info',
      output: lines.length > 0 ? lines.join('\n') : '(no stashes saved)',
    };
  }

  if (sub === 'push' || sub === 'save') {
    if (isWorkingTreeClean(repo)) {
      return {
        newState: repo,
        status: 'info',
        output: 'No local changes to save',
      };
    }
    const headCommit = getHeadCommit(repo);
    const finalMsg = stashMsg || (headCommit ? headCommit.message : 'uncommitted changes');
    repo.stashes.unshift({
      id: `stash@{0}`,
      message: finalMsg,
      branchOrSha: repo.head.ref,
      workingTree: { ...repo.workingTree },
      stagingIndex: { ...repo.stagingIndex },
    });
    if (headCommit) {
      repo.workingTree = { ...headCommit.tree };
      repo.stagingIndex = { ...headCommit.tree };
    }
    repo.conflictedFiles = [];
    return {
      newState: repo,
      status: 'success',
      output: `Saved working directory and index state WIP on ${repo.head.ref}: ${finalMsg}`,
    };
  }

  if (sub === 'pop' || sub === 'apply') {
    if (repo.stashes.length === 0) {
      return { newState: repo, status: 'error', output: 'error: No stash entries found.' };
    }
    const entry = sub === 'pop' ? repo.stashes.shift()! : repo.stashes[0];
    repo.workingTree = { ...repo.workingTree, ...entry.workingTree };
    repo.stagingIndex = { ...repo.stagingIndex, ...entry.stagingIndex };
    return {
      newState: repo,
      status: 'success',
      output: `Applied stash on ${repo.head.ref}${sub === 'pop' ? ' and dropped refs/stash@{0}' : ''}`,
    };
  }

  return { newState: repo, status: 'error', output: `git stash: unknown subcommand '${sub}'` };
}

function handleBisect(
  repo: GitRepositoryState,
  args: string[],
  customScriptRunner?: (
    scriptName: string,
    repo: GitRepositoryState
  ) => { output: string; exitCode: number }
): CommandExecutionOutput {
  const action = args[0];

  if (action === 'start') {
    repo.bisect = {
      active: true,
      badSha: null,
      goodShas: [],
      candidates: [],
      stepsTaken: 0,
      foundCulpritSha: null,
      originalHead: { ...repo.head },
    };
    return {
      newState: repo,
      status: 'info',
      output: 'status: waiting for both good and bad commits',
    };
  }

  if (action === 'reset') {
    const orig = repo.bisect.originalHead;
    repo.bisect = {
      active: false,
      badSha: null,
      goodShas: [],
      candidates: [],
      stepsTaken: 0,
      foundCulpritSha: null,
      originalHead: { type: 'branch', ref: 'main' },
    };
    if (orig && orig.ref) {
      return handleCheckout(repo, [orig.ref]);
    }
    return { newState: repo, status: 'info', output: 'Bisect reset.' };
  }

  if (!repo.bisect.active) {
    return {
      newState: repo,
      status: 'error',
      output: 'You need to start by "git bisect start"',
    };
  }

  if (action === 'bad') {
    const rev = args[1] || 'HEAD';
    const sha = resolveRevision(repo, rev);
    if (!sha) {
      return { newState: repo, status: 'error', output: `Bad rev '${rev}'` };
    }
    repo.bisect.badSha = sha;
    const msg = evaluateBisectStep(repo);
    return { newState: repo, status: 'info', output: msg };
  }

  if (action === 'good') {
    const rev = args[1] || 'HEAD';
    const sha = resolveRevision(repo, rev);
    if (!sha) {
      return { newState: repo, status: 'error', output: `Good rev '${rev}'` };
    }
    if (!repo.bisect.goodShas.includes(sha)) {
      repo.bisect.goodShas.push(sha);
    }
    const msg = evaluateBisectStep(repo);
    return { newState: repo, status: 'info', output: msg };
  }

  if (action === 'run') {
    const script = args[1] || './test_billing.sh';
    if (!customScriptRunner) {
      return { newState: repo, status: 'error', output: `Cannot run ${script}` };
    }
    const logs: string[] = [];
    let guard = 0;
    while (!repo.bisect.foundCulpritSha && guard < 12) {
      guard++;
      const currentSha = getHeadSha(repo);
      logs.push(`running ${script} on [${currentSha}]...`);
      const res = customScriptRunner(script, repo);
      logs.push(res.output);
      if (res.exitCode === 0) {
        if (!repo.bisect.goodShas.includes(currentSha)) {
          repo.bisect.goodShas.push(currentSha);
        }
      } else {
        repo.bisect.badSha = currentSha;
      }
      const stepMsg = evaluateBisectStep(repo);
      logs.push(stepMsg);
      if (repo.bisect.foundCulpritSha) break;
    }
    return { newState: repo, status: 'success', output: logs.join('\n') };
  }

  return {
    newState: repo,
    status: 'error',
    output: 'usage: git bisect [start | bad [rev] | good [rev] | run <cmd> | reset]',
  };
}

function handleFetch(repo: GitRepositoryState): CommandExecutionOutput {
  let imported = 0;
  for (const [sha, commit] of Object.entries(repo.remote.commits)) {
    if (!repo.commits[sha]) {
      repo.commits[sha] = { ...commit };
      imported++;
    }
  }
  return {
    newState: repo,
    status: 'success',
    output:
      imported > 0
        ? `From origin\n   Fetched ${imported} new commit object(s) from origin.`
        : `From origin\n   Already up to date with remote origin.`,
  };
}

function handlePull(repo: GitRepositoryState, args: string[]): CommandExecutionOutput {
  handleFetch(repo);
  const isRebase = args.includes('--rebase') || args.includes('-r');
  const currentBranch = repo.head.type === 'branch' ? repo.head.ref : 'main';
  const remoteRef = `origin/${currentBranch}`;
  if (isRebase) {
    return handleRebase(repo, [remoteRef]);
  }
  return handleMerge(repo, [remoteRef]);
}

function handlePush(repo: GitRepositoryState, args: string[]): CommandExecutionOutput {
  const isForceWithLease = args.includes('--force-with-lease');
  const isPlainForce = args.includes('--force') || args.includes('-f');
  const pushTags = args.includes('--tags');

  const positional = args.filter((a) => !a.startsWith('-'));
  const remoteName = positional[0] === 'origin' ? 'origin' : 'origin';
  const refArg = positional[0] === 'origin' ? positional[1] : positional[0];

  const targetRef =
    refArg || (repo.head.type === 'branch' ? repo.head.ref : '');

  if (pushTags) {
    for (const [tag, sha] of Object.entries(repo.tags)) {
      repo.remote.tags[tag] = sha;
      if (repo.commits[sha]) {
        repo.remote.commits[sha] = { ...repo.commits[sha] };
      }
    }
  }

  // Check if pushing a specific tag
  if (targetRef && repo.tags[targetRef]) {
    const tagSha = repo.tags[targetRef];
    repo.remote.tags[targetRef] = tagSha;
    const reachable = getReachableShas(repo.commits, [tagSha]);
    for (const s of reachable) {
      repo.remote.commits[s] = { ...repo.commits[s] };
    }
    return {
      newState: repo,
      status: 'success',
      output: `To ${remoteName}\n * [new tag]         ${targetRef} -> ${targetRef}`,
    };
  }

  if (!targetRef || !repo.branches[targetRef]) {
    if (pushTags) {
      return {
        newState: repo,
        status: 'success',
        output: `To ${remoteName}\n * [new tags]        pushed all tags to origin`,
      };
    }
    return {
      newState: repo,
      status: 'error',
      output: `fatal: The current HEAD is detached or branch '${targetRef}' does not exist.`,
    };
  }

  const localSha = repo.branches[targetRef];
  const remoteSha = repo.remote.branches[targetRef];

  // Anti-pattern 1: Force pushing to main
  if (targetRef === 'main' && (isPlainForce || isForceWithLease)) {
    repo.forcePushedMain = true;
    return {
      newState: repo,
      status: 'error',
      output: `remote: error: GH006: Protected branch update failed for refs/heads/main.\nremote: error: Cannot force-push to a protected branch 'main'.`,
      antiPatternAlert: {
        id: `alert-${Date.now()}`,
        sender: 'Marcus Chen (Principal Architect)',
        role: 'Principal Engineer',
        channel: '#incidents-war-room',
        timestamp: 'Just now',
        isAlert: true,
        text: `🚨 WHOA! Never run 'git push --force' on 'main'! Rewriting shared history on main breaks every developer's local checkout and invalidates active deployment artifacts. Use 'git revert' or a fast-forward commit instead.`,
      },
    };
  }

  // GitHub Hook Simulation: GH001 Large File rejection (e.g. assets > 100MB)
  const reachableLocalShas = getReachableShas(repo.commits, [localSha]);
  for (const s of reachableLocalShas) {
    const c = repo.commits[s];
    if (c) {
      for (const [filepath, content] of Object.entries(c.tree)) {
        if (
          filepath.endsWith('.bin') ||
          filepath.endsWith('.mp4') ||
          filepath.includes('weights_v1.bin') ||
          (typeof content === 'string' && content.includes('[LARGE_BINARY_ASSET_142MB]'))
        ) {
          return {
            newState: repo,
            status: 'error',
            output: [
              `remote: error: GH001: Large files detected.`,
              `remote: error: Trace: 4b29c1e0a81177ff9c12`,
              `remote: error: See https://gh.io/lfs for more information.`,
              `remote: error: File ${filepath} is 142.00 MB; this exceeds GitHub's file size limit of 100.00 MB`,
              `To https://github.com/warroom-corp/checkout-service.git`,
              ` ! [remote rejected] ${targetRef} -> ${targetRef} (pre-receive hook declined)`,
              `error: failed to push some refs to 'https://github.com/warroom-corp/checkout-service.git'`,
            ].join('\n'),
            antiPatternAlert: {
              id: `alert-large-file-${Date.now()}`,
              sender: 'Elena Vance (Staff SRE)',
              role: 'Staff Engineer',
              channel: '#incidents-war-room',
              timestamp: 'Just now',
              isAlert: true,
              text: `🛑 GitHub rejected your push (GH001)! You committed a 142MB binary file (${filepath}). GitHub blocks files > 100MB. Do NOT just commit a deletion (git rm)—the blob remains in git history! Instead, run 'git reset --soft HEAD~1', remove the binary file, and recommit!`,
            },
          };
        }
      }
    }
  }

  // Check if non-fast-forward
  if (remoteSha && remoteSha !== localSha && !isAncestor(repo.commits, remoteSha, localSha)) {
    if (!isPlainForce && !isForceWithLease) {
      return {
        newState: repo,
        status: 'error',
        output: [
          `To origin`,
          ` ! [rejected]        ${targetRef} -> ${targetRef} (non-fast-forward)`,
          `error: failed to push some refs to 'origin'`,
          `hint: Updates were rejected because the tip of your current branch is behind`,
          `hint: its remote counterpart. If you rewrote history intentionally, integrate`,
          `hint: remote changes first and use 'git push --force-with-lease'.`,
        ].join('\n'),
      };
    }

    // Check if coworker pushed a commit to remote that is NOT an ancestor of localSha
    // and whether the user used plain --force instead of --force-with-lease or didn't rebase coworker commit!
    if (isPlainForce && !isForceWithLease) {
      repo.overwroteRemoteCommitWithoutLease = true;
      // Sync remote anyway to show what happened, plus trigger anti-pattern alert
      const reachable = getReachableShas(repo.commits, [localSha]);
      for (const s of reachable) {
        repo.remote.commits[s] = { ...repo.commits[s] };
      }
      repo.remote.branches[targetRef] = localSha;
      return {
        newState: repo,
        status: 'warning',
        output: `To origin\n + ${remoteSha}...${localSha} ${targetRef} -> ${targetRef} (forced update - WARNING: used --force without lease!)`,
        antiPatternAlert: {
          id: `alert-${Date.now()}`,
          sender: 'Elena Vance (Staff SRE)',
          role: 'Staff Engineer',
          channel: '#incidents-war-room',
          timestamp: 'Just now',
          isAlert: true,
          text: `⚠️ Careful! You used raw 'git push --force' instead of 'git push --force-with-lease'! In collaborative branches, '--force' blindly nukes any commits a teammate pushed since your last fetch. Always integrate upstream commits and push with '--force-with-lease'.`,
        },
      };
    }
  }

  if (isForceWithLease) {
    repo.lastPushUsedForceWithLease = true;
  }

  const reachable = getReachableShas(repo.commits, [localSha]);
  for (const s of reachable) {
    repo.remote.commits[s] = { ...repo.commits[s] };
  }
  repo.remote.branches[targetRef] = localSha;

  return {
    newState: repo,
    status: 'success',
    output: `To origin\n   ${remoteSha || '0000000'}..${localSha}  ${targetRef} -> ${targetRef}${isForceWithLease ? ' (forced with lease)' : ''}`,
  };
}
