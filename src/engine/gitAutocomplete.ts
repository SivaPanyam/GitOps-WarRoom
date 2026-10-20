import { GitRepositoryState, Scenario } from '../types/git';

export type AutocompleteCategory =
  | 'command'
  | 'branch'
  | 'remote'
  | 'tag'
  | 'file'
  | 'commit'
  | 'flag'
  | 'action';

export interface AutocompleteItem {
  id: string;
  value: string;
  display: string;
  description?: string;
  category: AutocompleteCategory;
  categoryLabel: string;
  fullCommandReplacement?: string;
}

const COMMON_GIT_COMMANDS: { name: string; desc: string }[] = [
  { name: 'status', desc: 'Show working tree and staging index status' },
  { name: 'log --oneline --all', desc: 'Display all branch commits in graph' },
  { name: 'reflog', desc: 'Inspect chronological HEAD movements and recovery SHAs' },
  { name: 'checkout', desc: 'Switch branches or restore files' },
  { name: 'switch', desc: 'Switch to a local branch (-c to create)' },
  { name: 'branch -a', desc: 'List all local and remote branches' },
  { name: 'add .', desc: 'Stage all modified and untracked files' },
  { name: 'commit -m "', desc: 'Record staged changes with a message' },
  { name: 'rebase -i', desc: 'Interactive rebase (squash, reword, drop)' },
  { name: 'cherry-pick', desc: 'Apply a specific commit onto current HEAD' },
  { name: 'reset --hard', desc: 'Reset HEAD, index, and working tree to a commit' },
  { name: 'revert', desc: 'Safely revert a commit on protected branches' },
  { name: 'bisect start', desc: 'Start binary search to isolate regression' },
  { name: 'stash', desc: 'Stash changes in dirty working directory' },
  { name: 'tag', desc: 'List or create release tags' },
  { name: 'fetch origin', desc: 'Fetch latest commits from remote origin' },
  { name: 'pull --rebase', desc: 'Fetch and rebase local commits onto upstream' },
  { name: 'push origin', desc: 'Push current branch to remote origin' },
  { name: 'push --force-with-lease origin', desc: 'Safe forced push to remote' },
  { name: 'diff', desc: 'View unstaged or staged changes' },
  { name: 'clear', desc: 'Clear the terminal output buffer' },
  { name: 'help', desc: 'Display supported Git commands cheat-sheet' },
];

export function getAutocompleteSuggestions(
  rawInput: string,
  repo: GitRepositoryState,
  activeScenario?: Scenario
): {
  items: AutocompleteItem[];
  replaceRange: 'append' | 'last-token' | 'full';
} {
  const trimmed = rawInput.trim();

  // 1. Empty command line: show top commands & scenario shortcuts
  if (!trimmed) {
    const items: AutocompleteItem[] = [];

    // Scenario optimal commands first if available
    if (activeScenario && activeScenario.optimalCommands.length > 0) {
      activeScenario.optimalCommands.slice(0, 3).forEach((cmd, idx) => {
        items.push({
          id: `scenario-opt-${idx}`,
          value: cmd,
          display: cmd,
          description: `Scenario #${activeScenario.number} step ${idx + 1}`,
          category: 'action',
          categoryLabel: 'scenario',
          fullCommandReplacement: cmd,
        });
      });
    }

    // Common git commands
    COMMON_GIT_COMMANDS.slice(0, 7).forEach((cmd) => {
      const full = `git ${cmd.name}`;
      items.push({
        id: `empty-cmd-${cmd.name}`,
        value: full,
        display: full,
        description: cmd.desc,
        category: 'command',
        categoryLabel: 'git',
        fullCommandReplacement: full,
      });
    });

    return { items, replaceRange: 'full' };
  }

  // Tokenize input
  const tokens = rawInput.trimStart().split(/\s+/);
  const endsWithSpace = rawInput.endsWith(' ');
  const firstToken = tokens[0];

  // If typing the initial command (e.g. "gi", "g", "st", "ls", "cat", "cl")
  if (tokens.length === 1 && !endsWithSpace) {
    const query = firstToken.toLowerCase();
    const items: AutocompleteItem[] = [];

    // Check git subcommands if starting with "git"
    if (query === 'git') {
      COMMON_GIT_COMMANDS.forEach((cmd) => {
        items.push({
          id: `git-sub-${cmd.name}`,
          value: `git ${cmd.name}`,
          display: `git ${cmd.name}`,
          description: cmd.desc,
          category: 'command',
          categoryLabel: 'subcommand',
          fullCommandReplacement: `git ${cmd.name}`,
        });
      });
      return { items, replaceRange: 'full' };
    }

    if ('git'.startsWith(query)) {
      items.push({
        id: 'cmd-git',
        value: 'git ',
        display: 'git',
        description: 'Git version control system',
        category: 'command',
        categoryLabel: 'command',
        fullCommandReplacement: 'git ',
      });
    }

    ['ls', 'cat', 'rm', 'clear', 'help', './test_billing.sh'].forEach((sh) => {
      if (sh.startsWith(query)) {
        items.push({
          id: `sh-${sh}`,
          value: sh,
          display: sh,
          description: `Shell utility: ${sh}`,
          category: 'command',
          categoryLabel: 'shell',
          fullCommandReplacement: sh,
        });
      }
    });

    return { items, replaceRange: 'full' };
  }

  // When command starts with "git"
  if (firstToken === 'git') {
    const subCommand = tokens[1] || '';

    // Typing subcommand (e.g. "git " or "git ch" or "git re")
    if (tokens.length === 2 && !endsWithSpace) {
      const query = subCommand.toLowerCase();
      const items: AutocompleteItem[] = COMMON_GIT_COMMANDS.filter((c) =>
        c.name.split(' ')[0].startsWith(query)
      ).map((c) => ({
        id: `sub-${c.name}`,
        value: c.name.split(' ')[0],
        display: `git ${c.name}`,
        description: c.desc,
        category: 'command',
        categoryLabel: 'subcommand',
        fullCommandReplacement: `git ${c.name}`,
      }));
      return { items, replaceRange: 'full' };
    }

    // Command has a resolved subcommand: context-aware arguments!
    const effectiveSub = tokens[1];
    const currentToken = endsWithSpace ? '' : tokens[tokens.length - 1];
    const tokenQuery = currentToken.toLowerCase();

    // Context A: Branch & Tag targets (checkout, switch, branch, merge, diff)
    if (['checkout', 'switch', 'branch', 'merge'].includes(effectiveSub)) {
      const items: AutocompleteItem[] = [];

      // Local branches
      Object.entries(repo.branches).forEach(([branchName, sha]) => {
        if (!tokenQuery || branchName.toLowerCase().startsWith(tokenQuery)) {
          const isCurrent =
            repo.head.type === 'branch' && repo.head.ref === branchName;
          items.push({
            id: `branch-${branchName}`,
            value: branchName,
            display: branchName,
            description: isCurrent ? 'HEAD (current branch)' : `Branch at ${sha}`,
            category: 'branch',
            categoryLabel: 'branch',
          });
        }
      });

      // Remote tracking branches
      Object.entries(repo.remote.branches).forEach(([remoteBranch, sha]) => {
        const fullRemote = `origin/${remoteBranch}`;
        if (!tokenQuery || fullRemote.toLowerCase().startsWith(tokenQuery)) {
          items.push({
            id: `remote-${fullRemote}`,
            value: fullRemote,
            display: fullRemote,
            description: `Remote tracking branch (${sha})`,
            category: 'remote',
            categoryLabel: 'remote',
          });
        }
      });

      // Release Tags
      Object.entries(repo.tags).forEach(([tagName, sha]) => {
        if (!tokenQuery || tagName.toLowerCase().startsWith(tokenQuery)) {
          items.push({
            id: `tag-${tagName}`,
            value: tagName,
            display: tagName,
            description: `Tag pointing to ${sha}`,
            category: 'tag',
            categoryLabel: 'tag',
          });
        }
      });

      // Specific flags for checkout/switch/branch
      if (effectiveSub === 'checkout' || effectiveSub === 'switch') {
        const flag = effectiveSub === 'checkout' ? '-b' : '-c';
        if (!tokenQuery || flag.startsWith(tokenQuery)) {
          items.push({
            id: `flag-${flag}`,
            value: flag,
            display: `${flag} <new-branch>`,
            description: 'Create and switch to new branch',
            category: 'flag',
            categoryLabel: 'flag',
          });
        }
      }

      if (effectiveSub === 'branch') {
        ['-a', '-d', '-D', '-f'].forEach((flag) => {
          if (!tokenQuery || flag.startsWith(tokenQuery)) {
            items.push({
              id: `flag-${flag}`,
              value: flag,
              display: flag,
              description:
                flag === '-a'
                  ? 'List all local & remote branches'
                  : flag === '-d'
                  ? 'Delete branch safely'
                  : flag === '-D'
                  ? 'Force delete branch'
                  : 'Force reset branch to commit',
              category: 'flag',
              categoryLabel: 'flag',
            });
          }
        });
      }

      return {
        items,
        replaceRange: endsWithSpace ? 'append' : 'last-token',
      };
    }

    // Context B: File targets (add, rm, diff, checkout --)
    if (
      ['add', 'rm'].includes(effectiveSub) ||
      (effectiveSub === 'checkout' && tokens.includes('--'))
    ) {
      const items: AutocompleteItem[] = [];

      if (effectiveSub === 'add') {
        if (!tokenQuery || '.'.startsWith(tokenQuery)) {
          items.push({
            id: 'add-dot',
            value: '.',
            display: '.',
            description: 'Stage all modified & untracked workspace files',
            category: 'action',
            categoryLabel: 'stage all',
          });
        }
      }

      // Conflicted files first
      repo.conflictedFiles.forEach((file) => {
        if (!tokenQuery || file.toLowerCase().includes(tokenQuery)) {
          items.push({
            id: `file-conflict-${file}`,
            value: file,
            display: file,
            description: 'UNRESOLVED 3-way merge conflict (needs git add)',
            category: 'file',
            categoryLabel: 'conflict',
          });
        }
      });

      // Working tree & staging files
      const allFiles = Array.from(
        new Set([
          ...Object.keys(repo.workingTree),
          ...Object.keys(repo.stagingIndex),
        ])
      ).sort();

      allFiles.forEach((file) => {
        if (repo.conflictedFiles.includes(file)) return;
        if (!tokenQuery || file.toLowerCase().includes(tokenQuery)) {
          const inWork = repo.workingTree[file];
          const inStage = repo.stagingIndex[file];
          const isUnstaged = inWork !== inStage;
          items.push({
            id: `file-${file}`,
            value: file,
            display: file,
            description: isUnstaged ? 'Modified unstaged file' : 'Workspace file',
            category: 'file',
            categoryLabel: 'file',
          });
        }
      });

      return {
        items,
        replaceRange: endsWithSpace ? 'append' : 'last-token',
      };
    }

    // Context C: Commit SHAs & History Revisions (cherry-pick, revert, reset, show)
    if (['cherry-pick', 'revert', 'reset', 'show'].includes(effectiveSub)) {
      const items: AutocompleteItem[] = [];

      // Flags for reset
      if (effectiveSub === 'reset') {
        ['--hard', '--mixed', '--soft'].forEach((flag) => {
          if (!tokenQuery || flag.startsWith(tokenQuery)) {
            items.push({
              id: `reset-${flag}`,
              value: flag,
              display: flag,
              description:
                flag === '--hard'
                  ? 'Reset HEAD, index, and working tree'
                  : flag === '--soft'
                  ? 'Reset HEAD only, keeping changes staged'
                  : 'Reset HEAD and index, keeping files modified',
              category: 'flag',
              categoryLabel: 'flag',
            });
          }
        });
      }

      // Flags for cherry-pick / revert
      if (['cherry-pick', 'revert'].includes(effectiveSub)) {
        ['--continue', '--abort'].forEach((flag) => {
          if (!tokenQuery || flag.startsWith(tokenQuery)) {
            items.push({
              id: `revert-cp-${flag}`,
              value: flag,
              display: flag,
              description: `${flag} in-progress operation`,
              category: 'flag',
              categoryLabel: 'flag',
            });
          }
        });
      }

      // Reflog HEAD references
      repo.reflog.slice(0, 5).forEach((entry) => {
        const refLabel = `HEAD@{${entry.index}}`;
        if (
          !tokenQuery ||
          refLabel.toLowerCase().startsWith(tokenQuery) ||
          entry.sha.startsWith(tokenQuery)
        ) {
          items.push({
            id: `reflog-${entry.index}`,
            value: entry.sha,
            display: `${refLabel} → ${entry.sha}`,
            description: `${entry.action}: ${entry.message}`,
            category: 'commit',
            categoryLabel: 'reflog',
          });
        }
      });

      // Commits list
      Object.values(repo.commits)
        .slice(-8)
        .reverse()
        .forEach((c) => {
          if (
            !tokenQuery ||
            c.sha.startsWith(tokenQuery) ||
            c.message.toLowerCase().includes(tokenQuery)
          ) {
            items.push({
              id: `commit-${c.sha}`,
              value: c.sha,
              display: c.sha,
              description: c.message,
              category: 'commit',
              categoryLabel: 'commit',
            });
          }
        });

      // Branches & tags
      Object.keys(repo.branches).forEach((b) => {
        if (!tokenQuery || b.toLowerCase().startsWith(tokenQuery)) {
          items.push({
            id: `branch-target-${b}`,
            value: b,
            display: b,
            description: `Branch pointer (${repo.branches[b]})`,
            category: 'branch',
            categoryLabel: 'branch',
          });
        }
      });

      return {
        items,
        replaceRange: endsWithSpace ? 'append' : 'last-token',
      };
    }

    // Context D: Rebase (rebase -i, rebase --continue, upstream branches)
    if (effectiveSub === 'rebase') {
      const items: AutocompleteItem[] = [];

      ['--continue', '--abort', '-i'].forEach((flag) => {
        if (!tokenQuery || flag.startsWith(tokenQuery)) {
          items.push({
            id: `rebase-flag-${flag}`,
            value: flag,
            display: flag,
            description:
              flag === '-i'
                ? 'Interactive rebase todo editor'
                : flag === '--continue'
                ? 'Continue rebase after conflict resolution'
                : 'Abort rebase and return to original HEAD',
            category: 'flag',
            categoryLabel: 'flag',
          });
        }
      });

      // Remote tracking branches like origin/main
      Object.keys(repo.remote.branches).forEach((rb) => {
        const full = `origin/${rb}`;
        if (!tokenQuery || full.toLowerCase().startsWith(tokenQuery)) {
          items.push({
            id: `rebase-upstream-${full}`,
            value: full,
            display: full,
            description: `Upstream branch for rebase (${repo.remote.branches[rb]})`,
            category: 'remote',
            categoryLabel: 'upstream',
          });
        }
      });

      // Local branches
      Object.keys(repo.branches).forEach((b) => {
        if (!tokenQuery || b.toLowerCase().startsWith(tokenQuery)) {
          items.push({
            id: `rebase-local-${b}`,
            value: b,
            display: b,
            description: `Local branch upstream (${repo.branches[b]})`,
            category: 'branch',
            categoryLabel: 'branch',
          });
        }
      });

      // HEAD relative revisions
      ['HEAD~1', 'HEAD~2', 'HEAD~3', 'HEAD~4'].forEach((rev) => {
        if (!tokenQuery || rev.toLowerCase().startsWith(tokenQuery)) {
          items.push({
            id: `rebase-rev-${rev}`,
            value: rev,
            display: rev,
            description: `Rebase onto ${rev}`,
            category: 'commit',
            categoryLabel: 'revision',
          });
        }
      });

      return {
        items,
        replaceRange: endsWithSpace ? 'append' : 'last-token',
      };
    }

    // Context E: Push (remotes, flags, target branches)
    if (effectiveSub === 'push') {
      const items: AutocompleteItem[] = [];

      ['--force-with-lease', '--force', '--tags'].forEach((flag) => {
        if (!tokenQuery || flag.startsWith(tokenQuery)) {
          items.push({
            id: `push-flag-${flag}`,
            value: flag,
            display: flag,
            description:
              flag === '--force-with-lease'
                ? 'Safe force push (recommended)'
                : flag === '--force'
                ? 'Raw force push (overwrites remote)'
                : 'Push all local tags to remote',
            category: 'flag',
            categoryLabel: 'flag',
          });
        }
      });

      // Remotes
      if (!tokenQuery || 'origin'.startsWith(tokenQuery)) {
        items.push({
          id: 'remote-origin',
          value: 'origin',
          display: 'origin',
          description: 'Default remote repository',
          category: 'remote',
          categoryLabel: 'remote',
        });
      }

      // Branch names to push
      Object.keys(repo.branches).forEach((b) => {
        if (!tokenQuery || b.toLowerCase().startsWith(tokenQuery)) {
          items.push({
            id: `push-branch-${b}`,
            value: b,
            display: b,
            description: `Push local branch '${b}' to remote`,
            category: 'branch',
            categoryLabel: 'branch',
          });
        }
      });

      // Tags to push
      Object.keys(repo.tags).forEach((t) => {
        if (!tokenQuery || t.toLowerCase().startsWith(tokenQuery)) {
          items.push({
            id: `push-tag-${t}`,
            value: t,
            display: t,
            description: `Push release tag '${t}' to remote`,
            category: 'tag',
            categoryLabel: 'tag',
          });
        }
      });

      return {
        items,
        replaceRange: endsWithSpace ? 'append' : 'last-token',
      };
    }

    // Context F: Bisect
    if (effectiveSub === 'bisect') {
      const items: AutocompleteItem[] = [];
      [
        { val: 'start', desc: 'Initialize binary search session' },
        { val: 'bad', desc: 'Mark current or specified commit as bad' },
        { val: 'good', desc: 'Mark current or specified commit as good' },
        { val: 'run ./test_billing.sh', desc: 'Automate bisect with test script' },
        { val: 'reset', desc: 'End bisect and return to original branch' },
      ].forEach((act) => {
        if (!tokenQuery || act.val.startsWith(tokenQuery)) {
          items.push({
            id: `bisect-${act.val}`,
            value: act.val,
            display: act.val,
            description: act.desc,
            category: 'command',
            categoryLabel: 'bisect',
          });
        }
      });

      // Tags & commits for good/bad
      Object.keys(repo.tags).forEach((t) => {
        if (!tokenQuery || t.toLowerCase().startsWith(tokenQuery)) {
          items.push({
            id: `bisect-tag-${t}`,
            value: t,
            display: t,
            description: `Tag ${t} (${repo.tags[t]})`,
            category: 'tag',
            categoryLabel: 'tag',
          });
        }
      });

      return {
        items,
        replaceRange: endsWithSpace ? 'append' : 'last-token',
      };
    }
  }

  // General fallback: match any branch, tag, or file
  const currentToken = endsWithSpace ? '' : tokens[tokens.length - 1];
  const tokenQuery = currentToken.toLowerCase();
  const items: AutocompleteItem[] = [];

  Object.keys(repo.branches).forEach((b) => {
    if (!tokenQuery || b.toLowerCase().startsWith(tokenQuery)) {
      items.push({
        id: `fb-branch-${b}`,
        value: b,
        display: b,
        description: `Local branch (${repo.branches[b]})`,
        category: 'branch',
        categoryLabel: 'branch',
      });
    }
  });

  Object.keys(repo.tags).forEach((t) => {
    if (!tokenQuery || t.toLowerCase().startsWith(tokenQuery)) {
      items.push({
        id: `fb-tag-${t}`,
        value: t,
        display: t,
        description: `Tag (${repo.tags[t]})`,
        category: 'tag',
        categoryLabel: 'tag',
      });
    }
  });

  return {
    items,
    replaceRange: endsWithSpace ? 'append' : 'last-token',
  };
}
