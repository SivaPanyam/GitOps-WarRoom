import {
  getCommitsBetween,
  getReachableShas,
  hasConflictMarkers,
  isAncestor,
  isWorkingTreeClean,
} from '../engine/gitEngine';
import {
  AssertionResult,
  CIPipelineCheck,
  GitCommit,
  GitRepositoryState,
  Scenario,
} from '../types/git';

// ============================================================================
// SCENARIO 1: The Hotfix & Release Train Collision (cherry-pick & tags)
// ============================================================================
function createScenario1State(): GitRepositoryState {
  const c0: GitCommit = {
    sha: 'a010000',
    message: 'chore: initial payment service bootstrap',
    author: 'Marcus Chen <mchen@warroom.dev>',
    timestamp: '3 days ago',
    parents: [],
    tree: {
      'README.md': '# Checkout Payment Service\nProduction release train: v2.1.x\n',
      'src/checkout/paymentGateway.ts': [
        'export interface Customer {',
        '  id: string;',
        '  wallet?: { balanceCents: number; currency: string };',
        '}',
        '',
        'export function processCharge(customer: Customer, amountCents: number) {',
        '  // BUG: crashes when guest customer has no wallet object',
        '  const available = customer.wallet!.balanceCents;',
        '  if (available < amountCents) {',
        '    return { status: "declined", reason: "insufficient_funds" };',
        '  }',
        '  return { status: "approved", chargedCents: amountCents };',
        '}',
      ].join('\n'),
      'src/config/version.ts': 'export const RELEASE_VERSION = "2.0.0";\n',
    },
  };

  const c1: GitCommit = {
    sha: 'c102100',
    message: 'release: cut v2.1.0 production build',
    author: 'Release Bot <ci@warroom.dev>',
    timestamp: '2 days ago',
    parents: ['a010000'],
    tree: {
      ...c0.tree,
      'src/config/version.ts': 'export const RELEASE_VERSION = "2.1.0";\n',
    },
  };

  const c2: GitCommit = {
    sha: 'd201a11',
    message: 'feat(bnpl): wip add experimental split-pay schema [UNSTABLE]',
    author: 'Devon Brooks <dbrooks@warroom.dev>',
    timestamp: '6 hours ago',
    parents: ['c102100'],
    tree: {
      ...c1.tree,
      'src/bnpl/splitPay.ts': '// UNSTABLE: Do not ship in v2.1.1!\nexport const BNPL_ENABLED = true;\n',
    },
  };

  const c3: GitCommit = {
    sha: 'e302b22',
    message: 'feat(bnpl): wire unverified Affirm webhook endpoint [UNSTABLE]',
    author: 'Devon Brooks <dbrooks@warroom.dev>',
    timestamp: '4 hours ago',
    parents: ['d201a11'],
    tree: {
      ...c2.tree,
      'src/bnpl/webhook.ts': 'export function handleAffirmWebhook() { throw new Error("TODO: unimplemented"); }\n',
    },
  };

  const c4: GitCommit = {
    sha: 'f403c33',
    message: 'wip(bnpl): disable ledger validation for local testing [DO NOT RELEASE]',
    author: 'Devon Brooks <dbrooks@warroom.dev>',
    timestamp: '2 hours ago',
    parents: ['e302b22'],
    tree: {
      ...c3.tree,
      'src/bnpl/ledger.ts': 'export const SKIP_LEDGER_CHECK = true;\n',
    },
  };

  const fixCommit: GitCommit = {
    sha: 'f99a11b',
    message: 'fix(checkout): guard against null customer wallet on guest checkout',
    author: 'Elena Vance <evance@warroom.dev>',
    timestamp: '15 mins ago',
    parents: ['c102100'],
    tree: {
      ...c1.tree,
      'src/checkout/paymentGateway.ts': [
        'export interface Customer {',
        '  id: string;',
        '  wallet?: { balanceCents: number; currency: string };',
        '}',
        '',
        'export function processCharge(customer: Customer, amountCents: number) {',
        '  if (!customer?.wallet) {',
        '    return { status: "fallback_card_flow", chargedCents: amountCents };',
        '  }',
        '  const available = customer.wallet.balanceCents;',
        '  if (available < amountCents) {',
        '    return { status: "declined", reason: "insufficient_funds" };',
        '  }',
        '  return { status: "approved", chargedCents: amountCents };',
        '}',
      ].join('\n'),
    },
  };

  const commits: Record<string, GitCommit> = {
    [c0.sha]: c0,
    [c1.sha]: c1,
    [c2.sha]: c2,
    [c3.sha]: c3,
    [c4.sha]: c4,
    [fixCommit.sha]: fixCommit,
  };

  return {
    commits,
    branches: {
      main: c4.sha,
      'fix/null-wallet-guard': fixCommit.sha,
    },
    tags: {
      'v2.1.0': c1.sha,
    },
    head: { type: 'branch', ref: 'main' },
    workingTree: { ...c4.tree },
    stagingIndex: { ...c4.tree },
    conflictedFiles: [],
    reflog: [
      { index: 0, sha: c4.sha, action: 'commit', message: c4.message, timestamp: '2 hours ago' },
      { index: 1, sha: c3.sha, action: 'commit', message: c3.message, timestamp: '4 hours ago' },
      { index: 2, sha: c2.sha, action: 'commit', message: c2.message, timestamp: '6 hours ago' },
      { index: 3, sha: c1.sha, action: 'tag', message: 'v2.1.0 release', timestamp: '2 days ago' },
    ],
    stashes: [],
    bisect: {
      active: false,
      badSha: null,
      goodShas: [],
      candidates: [],
      stepsTaken: 0,
      foundCulpritSha: null,
      originalHead: { type: 'branch', ref: 'main' },
    },
    interactiveRebase: null,
    inProgressOperation: null,
    remote: {
      branches: {
        main: c4.sha,
        'fix/null-wallet-guard': fixCommit.sha,
      },
      tags: {
        'v2.1.0': c1.sha,
      },
      commits: { ...commits },
    },
    lastPushUsedForceWithLease: false,
    overwroteRemoteCommitWithoutLease: false,
    forcePushedMain: false,
  };
}

// ============================================================================
// SCENARIO 2: The Botched Rebase & Detached HEAD Recovery (reflog)
// ============================================================================
function createScenario2State(): GitRepositoryState {
  const c0: GitCommit = {
    sha: '100base',
    message: 'chore: core auth service initialization',
    author: 'Marcus Chen <mchen@warroom.dev>',
    timestamp: '4 days ago',
    parents: [],
    tree: {
      'src/auth/jwtVerifier.ts': [
        'export function verifyToken(token: string): boolean {',
        '  return token.startsWith("jwt_v1_");',
        '}',
      ].join('\n'),
      'src/auth/sessionStore.ts': 'export const SESSION_TTL_SEC = 3600;\n',
    },
  };

  const cMain: GitCommit = {
    sha: '200main',
    message: 'chore(security): bump session TTL to 7200s',
    author: 'Marcus Chen <mchen@warroom.dev>',
    timestamp: '1 day ago',
    parents: ['100base'],
    tree: {
      ...c0.tree,
      'src/auth/sessionStore.ts': 'export const SESSION_TTL_SEC = 7200;\n',
    },
  };

  const cAuth1: GitCommit = {
    sha: '890pkce',
    message: 'feat(auth): implement OAuth2 PKCE challenge generator',
    author: 'You <oncall@warroom.dev>',
    timestamp: '5 hours ago',
    parents: ['100base'],
    tree: {
      ...c0.tree,
      'src/auth/pkce.ts': [
        'export function generateCodeChallenge(verifier: string): string {',
        '  return `sha256_${verifier.length}_${verifier.slice(0, 8)}`;',
        '}',
      ].join('\n'),
    },
  };

  const cAuthGolden: GitCommit = {
    sha: 'a1b2c3d',
    message: 'feat(auth): complete OAuth2 PKCE token rotation & RS256 verifier',
    author: 'You <oncall@warroom.dev>',
    timestamp: '2 hours ago',
    parents: ['890pkce'],
    tree: {
      ...cAuth1.tree,
      'src/auth/jwtVerifier.ts': [
        'import { generateCodeChallenge } from "./pkce";',
        '',
        'export function verifyToken(token: string, verifier?: string): boolean {',
        '  if (!token.startsWith("rs256_")) return false;',
        '  if (verifier) {',
        '    const challenge = generateCodeChallenge(verifier);',
        '    return token.includes(challenge);',
        '  }',
        '  return true;',
        '}',
      ].join('\n'),
    },
  };

  const cBotched: GitCommit = {
    sha: 'd88bad2',
    message: 'wip: botched conflict resolution during rebase',
    author: 'You <oncall@warroom.dev>',
    timestamp: '10 mins ago',
    parents: ['200main'],
    tree: {
      'src/auth/jwtVerifier.ts': [
        'export function verifyToken(token: string): boolean {',
        '  // FIXME: accidentally deleted PKCE verifier logic during rebase!',
        '  return false;',
        '}',
      ].join('\n'),
      'src/auth/sessionStore.ts': 'export const SESSION_TTL_SEC = 7200;\n',
    },
  };

  const commits: Record<string, GitCommit> = {
    [c0.sha]: c0,
    [cMain.sha]: cMain,
    [cAuth1.sha]: cAuth1,
    [cAuthGolden.sha]: cAuthGolden,
    [cBotched.sha]: cBotched,
  };

  const dirtyWorkingTree = {
    ...cBotched.tree,
    'src/auth/jwtVerifier.ts': [
      '<<<<<<< HEAD',
      'export function verifyToken(token: string): boolean {',
      '  return false;',
      '=======',
      '  // BROKEN MERGE ATTEMPT - DO NOT COMMIT',
      '>>>>>>> a1b2c3d',
    ].join('\n'),
  };

  return {
    commits,
    branches: {
      main: cMain.sha,
    },
    tags: {},
    head: { type: 'detached', ref: cBotched.sha },
    workingTree: dirtyWorkingTree,
    stagingIndex: { ...cBotched.tree },
    conflictedFiles: ['src/auth/jwtVerifier.ts'],
    reflog: [
      { index: 0, sha: cBotched.sha, action: 'rebase (pick)', message: cBotched.message, timestamp: '10 mins ago' },
      { index: 1, sha: cMain.sha, action: 'rebase (start)', message: 'checkout 200main', timestamp: '14 mins ago' },
      { index: 2, sha: cMain.sha, action: 'branch', message: 'deleted refs/heads/feature/auth-v2 in panic', timestamp: '18 mins ago' },
      { index: 3, sha: cAuthGolden.sha, action: 'commit', message: cAuthGolden.message, timestamp: '2 hours ago' },
      { index: 4, sha: cAuth1.sha, action: 'commit', message: cAuth1.message, timestamp: '5 hours ago' },
    ],
    stashes: [],
    bisect: {
      active: false,
      badSha: null,
      goodShas: [],
      candidates: [],
      stepsTaken: 0,
      foundCulpritSha: null,
      originalHead: { type: 'detached', ref: cBotched.sha },
    },
    interactiveRebase: null,
    inProgressOperation: null,
    remote: {
      branches: { main: cMain.sha },
      tags: {},
      commits: { [c0.sha]: c0, [cMain.sha]: cMain },
    },
    lastPushUsedForceWithLease: false,
    overwroteRemoteCommitWithoutLease: false,
    forcePushedMain: false,
  };
}

// ============================================================================
// SCENARIO 3: Leaked AWS Credentials in History
// ============================================================================
function createScenario3State(): GitRepositoryState {
  const cBase: GitCommit = {
    sha: '110root',
    message: 'chore: initialize Stripe payment gateway service',
    author: 'Marcus Chen <mchen@warroom.dev>',
    timestamp: '2 days ago',
    parents: [],
    tree: {
      'src/stripeClient.ts': [
        'export class StripeClient {',
        '  constructor(private apiKey: string) {}',
        '}',
      ].join('\n'),
      '.gitignore': 'node_modules/\ndist/\n',
    },
  };

  const cLeak: GitCommit = {
    sha: 'e44sec1',
    message: 'chore(payments): add production environment config',
    author: 'Samira Patel <spatel@warroom.dev>',
    timestamp: '3 hours ago',
    parents: ['110root'],
    tree: {
      ...cBase.tree,
      '.env.production': [
        '# CRITICAL SECURITY LEAK - DO NOT COMMIT TO GIT',
        'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE',
        'AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        'STRIPE_LIVE_SECRET=sk_live_9948102948102948',
      ].join('\n'),
    },
  };

  const cVital1: GitCommit = {
    sha: 'b77pay2',
    message: 'feat(stripe): add idempotency key header to charge requests',
    author: 'Samira Patel <spatel@warroom.dev>',
    timestamp: '2 hours ago',
    parents: ['e44sec1'],
    tree: {
      ...cLeak.tree,
      'src/stripeClient.ts': [
        'export class StripeClient {',
        '  constructor(private apiKey: string) {}',
        '  async createCharge(amountCents: number, idempotencyKey: string) {',
        '    return { amountCents, headers: { "Idempotency-Key": idempotencyKey } };',
        '  }',
        '}',
      ].join('\n'),
    },
  };

  const cVital2: GitCommit = {
    sha: 'c88pay3',
    message: 'feat(stripe): retry webhook signature verification with exponential backoff',
    author: 'Samira Patel <spatel@warroom.dev>',
    timestamp: '1 hour ago',
    parents: ['b77pay2'],
    tree: {
      ...cVital1.tree,
      'src/webhookVerifier.ts': [
        'export function verifyWebhookSignature(payload: string, sig: string, retries = 3): boolean {',
        '  return sig.startsWith("whsec_") && retries > 0 && payload.length > 0;',
        '}',
      ].join('\n'),
    },
  };

  const cCoworkerRemote: GitCommit = {
    sha: 'd99cow4',
    message: 'docs(payments): add on-call webhook retry SLA runbook',
    author: 'Alex Rivera <arivera@warroom.dev>',
    timestamp: '20 mins ago',
    parents: ['c88pay3'],
    tree: {
      ...cVital2.tree,
      'RUNBOOK.md': '# Payments Webhook Runbook\nWebhook retries execute up to 3 times with backoff.\n',
    },
  };

  const localCommits: Record<string, GitCommit> = {
    [cBase.sha]: cBase,
    [cLeak.sha]: cLeak,
    [cVital1.sha]: cVital1,
    [cVital2.sha]: cVital2,
    [cCoworkerRemote.sha]: cCoworkerRemote,
  };

  return {
    commits: localCommits,
    branches: {
      main: cBase.sha,
      'feature/payments': cVital2.sha,
    },
    tags: {},
    head: { type: 'branch', ref: 'feature/payments' },
    workingTree: { ...cVital2.tree },
    stagingIndex: { ...cVital2.tree },
    conflictedFiles: [],
    reflog: [
      { index: 0, sha: cVital2.sha, action: 'commit', message: cVital2.message, timestamp: '1 hour ago' },
      { index: 1, sha: cVital1.sha, action: 'commit', message: cVital1.message, timestamp: '2 hours ago' },
      { index: 2, sha: cLeak.sha, action: 'commit', message: cLeak.message, timestamp: '3 hours ago' },
      { index: 3, sha: cBase.sha, action: 'checkout', message: 'moving from main to feature/payments', timestamp: '4 hours ago' },
    ],
    stashes: [],
    bisect: {
      active: false,
      badSha: null,
      goodShas: [],
      candidates: [],
      stepsTaken: 0,
      foundCulpritSha: null,
      originalHead: { type: 'branch', ref: 'feature/payments' },
    },
    interactiveRebase: null,
    inProgressOperation: null,
    remote: {
      branches: {
        main: cBase.sha,
        'feature/payments': cCoworkerRemote.sha,
      },
      tags: {},
      commits: { ...localCommits },
    },
    lastPushUsedForceWithLease: false,
    overwroteRemoteCommitWithoutLease: false,
    forcePushedMain: false,
  };
}

// ============================================================================
// SCENARIO 4: Hunting a Silent Calculation Regression (bisect)
// ============================================================================
function createScenario4State(): GitRepositoryState {
  const commitSpecs = [
    { sha: 'b001000', msg: 'release: v1.0.0 billing engine baseline', buggy: false },
    { sha: 'b011001', msg: 'feat(billing): support EUR and GBP currency symbols', buggy: false },
    { sha: 'b021002', msg: 'chore(deps): upgrade decimal formatter utility', buggy: false },
    { sha: 'b031003', msg: 'feat(tax): add EU VAT reverse-charge metadata', buggy: false },
    { sha: 'b041004', msg: 'refactor(invoice): extract line-item subtotal helper', buggy: false },
    { sha: 'b051005', msg: 'docs(billing): document enterprise tier discounts', buggy: false },
    { sha: 'b061006', msg: 'feat(billing): add webhook payload timestamp validation', buggy: false },
    { sha: 'b071007', msg: 'chore(metrics): emit Prometheus invoice latency histogram', buggy: false },
    { sha: 'b081008', msg: 'feat(export): add CSV invoice batch exporter', buggy: false },
    { sha: 'b091009', msg: 'refactor(cache): memoize customer tax rate lookup', buggy: false },
    { sha: 'b101010', msg: 'chore(lint): enforce strict null checks in billing module', buggy: false },
    { sha: '7f4b90b', msg: 'perf(math): optimize floating point tax accumulator', buggy: true },
    { sha: 'b121012', msg: 'feat(pdf): update invoice header typography', buggy: true },
    { sha: 'b131013', msg: 'chore(ci): parallelize unit test shards', buggy: true },
    { sha: 'b141014', msg: 'feat(notifications): add Slack alert on overdue invoice', buggy: true },
    { sha: 'b151015', msg: 'docs(api): update OpenAPI spec for /v1/invoices', buggy: true },
    { sha: 'b161016', msg: 'chore(release): prepare v1.1.0-rc1 changelog', buggy: true },
  ];

  const commits: Record<string, GitCommit> = {};
  let prevSha: string | null = null;
  let runningFiles: Record<string, string> = {
    'test_billing.sh': [
      '#!/usr/bin/env bash',
      '# Automated regression test for enterprise invoice rounding',
      'echo "Running invoice calculation suite: $19.99 * 1.0825 tax..."',
    ].join('\n'),
  };

  commitSpecs.forEach((spec, idx) => {
    const calcFile = spec.buggy
      ? [
          '// Billing Calculation Engine',
          'export function calculateInvoiceTotal(subtotal: number, taxRate: number): number {',
          '  const raw = subtotal * (1 + taxRate);',
          '  return Math.floor(raw * 100) / 100;',
          '}',
        ].join('\n')
      : [
          '// Billing Calculation Engine',
          'export function calculateInvoiceTotal(subtotal: number, taxRate: number): number {',
          '  const raw = subtotal * (1 + taxRate);',
          '  return Math.round((raw + Number.EPSILON) * 100) / 100;',
          '}',
        ].join('\n');

    runningFiles = {
      ...runningFiles,
      'src/billing/calculator.ts': calcFile,
      'src/billing/buildInfo.ts': `export const BUILD_STEP = ${idx};\n`,
    };

    commits[spec.sha] = {
      sha: spec.sha,
      message: spec.msg,
      author: idx === 11 ? 'Devon Brooks <dbrooks@warroom.dev>' : 'Billing Team <eng@warroom.dev>',
      timestamp: `${17 - idx} hours ago`,
      parents: prevSha ? [prevSha] : [],
      tree: { ...runningFiles },
    };
    prevSha = spec.sha;
  });

  const tipSha = 'b161016';

  return {
    commits,
    branches: { main: tipSha },
    tags: { 'v1.0.0': 'b001000' },
    head: { type: 'branch', ref: 'main' },
    workingTree: { ...commits[tipSha].tree },
    stagingIndex: { ...commits[tipSha].tree },
    conflictedFiles: [],
    reflog: [
      { index: 0, sha: tipSha, action: 'commit', message: commits[tipSha].message, timestamp: '1 hour ago' },
      { index: 1, sha: 'b001000', action: 'tag', message: 'v1.0.0 baseline', timestamp: '17 hours ago' },
    ],
    stashes: [],
    bisect: {
      active: false,
      badSha: null,
      goodShas: [],
      candidates: [],
      stepsTaken: 0,
      foundCulpritSha: null,
      originalHead: { type: 'branch', ref: 'main' },
    },
    interactiveRebase: null,
    inProgressOperation: null,
    remote: {
      branches: { main: tipSha },
      tags: { 'v1.0.0': 'b001000' },
      commits: { ...commits },
    },
    lastPushUsedForceWithLease: false,
    overwroteRemoteCommitWithoutLease: false,
    forcePushedMain: false,
  };
}

// ============================================================================
// SCENARIO 5: PR Cleanup & 3-Way Merge Conflict Hell
// ============================================================================
function createScenario5State(): GitRepositoryState {
  const cBase: GitCommit = {
    sha: '500base',
    message: 'chore(core): initial API gateway configuration',
    author: 'Marcus Chen <mchen@warroom.dev>',
    timestamp: '2 days ago',
    parents: [],
    tree: {
      'src/config.ts': [
        'export const gatewayConfig = {',
        '  serviceName: "edge-api-gateway",',
        '  maxConnections: 100,',
        '  timeoutMs: 5000,',
        '};',
      ].join('\n'),
      'src/rateLimiter.ts': '// Rate limiter module stub\n',
    },
  };

  const cOriginMain: GitCommit = {
    sha: '599main',
    message: 'perf(config): scale maxConnections to 250 for Black Friday traffic',
    author: 'Elena Vance <evance@warroom.dev>',
    timestamp: '1 hour ago',
    parents: ['500base'],
    tree: {
      ...cBase.tree,
      'src/config.ts': [
        'export const gatewayConfig = {',
        '  serviceName: "edge-api-gateway",',
        '  maxConnections: 250,',
        '  timeoutMs: 5000,',
        '};',
      ].join('\n'),
    },
  };

  const w1: GitCommit = {
    sha: '501wip1',
    message: 'wip',
    author: 'You <oncall@warroom.dev>',
    timestamp: '3 hours ago',
    parents: ['500base'],
    tree: {
      ...cBase.tree,
      'src/config.ts': [
        'export const gatewayConfig = {',
        '  serviceName: "edge-api-gateway",',
        '  maxConnections: 100,',
        '  rateLimit: { enabled: true, rpm: 500 },',
        '  timeoutMs: 5000,',
        '};',
      ].join('\n'),
    },
  };

  const w2: GitCommit = {
    sha: '502oops',
    message: 'oops',
    author: 'You <oncall@warroom.dev>',
    timestamp: '2.5 hours ago',
    parents: ['501wip1'],
    tree: {
      ...w1.tree,
      'src/rateLimiter.ts': 'export function checkRateLimit(rpm: number) { return rpm > 0; }\n',
    },
  };

  const w3: GitCommit = {
    sha: '503typo',
    message: 'fix typo',
    author: 'You <oncall@warroom.dev>',
    timestamp: '2 hours ago',
    parents: ['502oops'],
    tree: {
      ...w2.tree,
      'src/config.ts': [
        'export const gatewayConfig = {',
        '  serviceName: "edge-api-gateway",',
        '  maxConnections: 100,',
        '  rateLimit: { enabled: true, rpm: 1000 },',
        '  timeoutMs: 5000,',
        '};',
      ].join('\n'),
    },
  };

  const w4: GitCommit = {
    sha: '504mwip',
    message: 'more wip',
    author: 'You <oncall@warroom.dev>',
    timestamp: '90 mins ago',
    parents: ['503typo'],
    tree: {
      ...w3.tree,
      'src/rateLimiter.ts': [
        'export function checkRateLimit(clientId: string, rpm = 1200): boolean {',
        '  return Boolean(clientId) && rpm <= 1200;',
        '}',
      ].join('\n'),
    },
  };

  const w5: GitCommit = {
    sha: '505done',
    message: 'done',
    author: 'You <oncall@warroom.dev>',
    timestamp: '45 mins ago',
    parents: ['504mwip'],
    tree: {
      ...w4.tree,
      'src/config.ts': [
        'export const gatewayConfig = {',
        '  serviceName: "edge-api-gateway",',
        '  maxConnections: 100,',
        '  rateLimit: { enabled: true, rpm: 1200 },',
        '  timeoutMs: 5000,',
        '};',
      ].join('\n'),
    },
  };

  const commits: Record<string, GitCommit> = {
    [cBase.sha]: cBase,
    [cOriginMain.sha]: cOriginMain,
    [w1.sha]: w1,
    [w2.sha]: w2,
    [w3.sha]: w3,
    [w4.sha]: w4,
    [w5.sha]: w5,
  };

  return {
    commits,
    branches: {
      main: cBase.sha,
      'feat/rate-limiter': w5.sha,
    },
    tags: {},
    head: { type: 'branch', ref: 'feat/rate-limiter' },
    workingTree: { ...w5.tree },
    stagingIndex: { ...w5.tree },
    conflictedFiles: [],
    reflog: [
      { index: 0, sha: w5.sha, action: 'commit', message: 'done', timestamp: '45 mins ago' },
      { index: 1, sha: w4.sha, action: 'commit', message: 'more wip', timestamp: '90 mins ago' },
      { index: 2, sha: w3.sha, action: 'commit', message: 'fix typo', timestamp: '2 hours ago' },
      { index: 3, sha: w2.sha, action: 'commit', message: 'oops', timestamp: '2.5 hours ago' },
      { index: 4, sha: w1.sha, action: 'commit', message: 'wip', timestamp: '3 hours ago' },
    ],
    stashes: [],
    bisect: {
      active: false,
      badSha: null,
      goodShas: [],
      candidates: [],
      stepsTaken: 0,
      foundCulpritSha: null,
      originalHead: { type: 'branch', ref: 'feat/rate-limiter' },
    },
    interactiveRebase: null,
    inProgressOperation: null,
    remote: {
      branches: {
        main: cOriginMain.sha,
        'feat/rate-limiter': w5.sha,
      },
      tags: {},
      commits: { ...commits },
    },
    lastPushUsedForceWithLease: false,
    overwroteRemoteCommitWithoutLease: false,
    forcePushedMain: false,
  };
}

// ============================================================================
// SCENARIO 6: The Uncommitted Production Emergency (git stash & hot patch)
// ============================================================================
function createScenario6State(): GitRepositoryState {
  const cMain: GitCommit = {
    sha: '600main',
    message: 'release: stable production baseline',
    author: 'Marcus Chen <mchen@warroom.dev>',
    timestamp: '1 day ago',
    parents: [],
    tree: {
      'src/cache/redis.ts': [
        'export const redisConfig = {',
        '  host: "redis.prod.internal",',
        '  port: 6379,',
        '  maxRetries: 0, // BUG: zero retries causes immediate crash during network hiccups',
        '  timeoutMs: 1000,',
        '};',
      ].join('\n'),
      'src/db/schema.ts': 'export const SCHEMA_VERSION = 4;\n',
    },
  };

  const cFeat: GitCommit = {
    sha: '601db',
    message: 'feat(db): begin v5 schema migration scaffolding',
    author: 'You <oncall@warroom.dev>',
    timestamp: '2 hours ago',
    parents: ['600main'],
    tree: {
      ...cMain.tree,
      'src/db/schema.ts': 'export const SCHEMA_VERSION = 5;\nexport interface NewAccountTable {}\n',
    },
  };

  const dirtyWorkingTree = {
    ...cFeat.tree,
    'src/db/migration_wip.ts': '// UNCOMPILABLE IN-PROGRESS REFACTOR - DO NOT COMMIT\nconst broken = ();\n',
    'src/db/schema.ts': 'export const SCHEMA_VERSION = 5;\n// IN-PROGRESS DIRTY CHANGES\nexport interface InFlight {}\n',
  };

  const commits: Record<string, GitCommit> = {
    [cMain.sha]: cMain,
    [cFeat.sha]: cFeat,
  };

  return {
    commits,
    branches: {
      main: cMain.sha,
      'feat/db-migration': cFeat.sha,
    },
    tags: {},
    head: { type: 'branch', ref: 'feat/db-migration' },
    workingTree: dirtyWorkingTree,
    stagingIndex: { ...cFeat.tree },
    conflictedFiles: [],
    reflog: [
      { index: 0, sha: cFeat.sha, action: 'commit', message: cFeat.message, timestamp: '2 hours ago' },
      { index: 1, sha: cMain.sha, action: 'checkout', message: 'moving to feat/db-migration', timestamp: '3 hours ago' },
    ],
    stashes: [],
    bisect: {
      active: false,
      badSha: null,
      goodShas: [],
      candidates: [],
      stepsTaken: 0,
      foundCulpritSha: null,
      originalHead: { type: 'branch', ref: 'feat/db-migration' },
    },
    interactiveRebase: null,
    inProgressOperation: null,
    remote: {
      branches: { main: cMain.sha },
      tags: {},
      commits: { ...commits },
    },
    lastPushUsedForceWithLease: false,
    overwroteRemoteCommitWithoutLease: false,
    forcePushedMain: false,
  };
}

// ============================================================================
// SCENARIO 7: Diverged PR Branch & Ghost Merge Commits (git rebase --onto)
// ============================================================================
function createScenario7State(): GitRepositoryState {
  const cMain: GitCommit = {
    sha: '700main',
    message: 'release: v3.0 enterprise core',
    author: 'Marcus Chen <mchen@warroom.dev>',
    timestamp: '3 days ago',
    parents: [],
    tree: {
      'src/invoice.ts': 'export function renderInvoice() { return "v3"; }\n',
      'src/engine.ts': 'export const ENGINE = "v3_standard";\n',
    },
  };

  const x1: GitCommit = {
    sha: 'x101exp',
    message: 'experiment(v8): rewrite AST compiler in Rust bindings',
    author: 'Devon Brooks <dbrooks@warroom.dev>',
    timestamp: '2 days ago',
    parents: ['700main'],
    tree: { ...cMain.tree, 'src/engine.ts': 'export const ENGINE = "v8_experimental";\n' },
  };

  const x2: GitCommit = {
    sha: 'x102exp',
    message: 'experiment(v8): add experimental SIMD vectorizer',
    author: 'Devon Brooks <dbrooks@warroom.dev>',
    timestamp: '1 day ago',
    parents: ['x101exp'],
    tree: { ...x1.tree, 'src/simd.ts': 'export const SIMD = true;\n' },
  };

  const p1: GitCommit = {
    sha: 'p201pdf',
    message: 'feat(pdf): add PDF invoice template renderer',
    author: 'You <oncall@warroom.dev>',
    timestamp: '5 hours ago',
    parents: ['x102exp'],
    tree: {
      ...x2.tree,
      'src/pdfGenerator.ts': 'export function generatePDF(id: string) { return `PDF_${id}`; }\n',
    },
  };

  const p2: GitCommit = {
    sha: 'p202pdf',
    message: 'feat(pdf): attach QR payment code to invoice PDF',
    author: 'You <oncall@warroom.dev>',
    timestamp: '2 hours ago',
    parents: ['p201pdf'],
    tree: {
      ...p1.tree,
      'src/pdfGenerator.ts': 'export function generatePDF(id: string) { return `PDF_${id}_WITH_QR`; }\n',
    },
  };

  const commits: Record<string, GitCommit> = {
    [cMain.sha]: cMain,
    [x1.sha]: x1,
    [x2.sha]: x2,
    [p1.sha]: p1,
    [p2.sha]: p2,
  };

  return {
    commits,
    branches: {
      main: cMain.sha,
      'experiment/v8-engine': x2.sha,
      'feature/invoice-pdf': p2.sha,
    },
    tags: {},
    head: { type: 'branch', ref: 'feature/invoice-pdf' },
    workingTree: { ...p2.tree },
    stagingIndex: { ...p2.tree },
    conflictedFiles: [],
    reflog: [
      { index: 0, sha: p2.sha, action: 'commit', message: p2.message, timestamp: '2 hours ago' },
      { index: 1, sha: p1.sha, action: 'commit', message: p1.message, timestamp: '5 hours ago' },
      { index: 2, sha: x2.sha, action: 'checkout', message: 'branch from experiment/v8-engine', timestamp: '6 hours ago' },
    ],
    stashes: [],
    bisect: {
      active: false,
      badSha: null,
      goodShas: [],
      candidates: [],
      stepsTaken: 0,
      foundCulpritSha: null,
      originalHead: { type: 'branch', ref: 'feature/invoice-pdf' },
    },
    interactiveRebase: null,
    inProgressOperation: null,
    remote: {
      branches: {
        main: cMain.sha,
        'experiment/v8-engine': x2.sha,
        'feature/invoice-pdf': p2.sha,
      },
      tags: {},
      commits: { ...commits },
    },
    lastPushUsedForceWithLease: false,
    overwroteRemoteCommitWithoutLease: false,
    forcePushedMain: false,
  };
}

// ============================================================================
// SCENARIO 8: Accidental Commits on Protected main
// ============================================================================
function createScenario8State(): GitRepositoryState {
  const cMainRoot: GitCommit = {
    sha: '800root',
    message: 'chore: enterprise webhook gateway baseline',
    author: 'Marcus Chen <mchen@warroom.dev>',
    timestamp: '2 days ago',
    parents: [],
    tree: {
      'src/webhook.ts': 'export function handleWebhook() { return false; }\n',
      'README.md': '# Webhook Service\n',
    },
  };

  const w1: GitCommit = {
    sha: '801hook',
    message: 'feat(stripe): add HMAC-SHA256 signature verification',
    author: 'You <oncall@warroom.dev>',
    timestamp: '3 hours ago',
    parents: ['800root'],
    tree: {
      ...cMainRoot.tree,
      'src/webhook.ts': 'export function handleWebhook(sig: string) { return sig.length > 32; }\n',
    },
  };

  const w2: GitCommit = {
    sha: '802test',
    message: 'test(stripe): add replay attack signature test suite',
    author: 'You <oncall@warroom.dev>',
    timestamp: '1 hour ago',
    parents: ['801hook'],
    tree: {
      ...w1.tree,
      'tests/webhook.spec.ts': 'describe("replay attacks", () => {});\n',
    },
  };

  const commits: Record<string, GitCommit> = {
    [cMainRoot.sha]: cMainRoot,
    [w1.sha]: w1,
    [w2.sha]: w2,
  };

  return {
    commits,
    branches: {
      main: w2.sha,
    },
    tags: {},
    head: { type: 'branch', ref: 'main' },
    workingTree: { ...w2.tree },
    stagingIndex: { ...w2.tree },
    conflictedFiles: [],
    reflog: [
      { index: 0, sha: w2.sha, action: 'commit', message: w2.message, timestamp: '1 hour ago' },
      { index: 1, sha: w1.sha, action: 'commit', message: w1.message, timestamp: '3 hours ago' },
      { index: 2, sha: cMainRoot.sha, action: 'clone', message: 'initial clone', timestamp: '2 days ago' },
    ],
    stashes: [],
    bisect: {
      active: false,
      badSha: null,
      goodShas: [],
      candidates: [],
      stepsTaken: 0,
      foundCulpritSha: null,
      originalHead: { type: 'branch', ref: 'main' },
    },
    interactiveRebase: null,
    inProgressOperation: null,
    remote: {
      branches: { main: cMainRoot.sha },
      tags: {},
      commits: { [cMainRoot.sha]: cMainRoot },
    },
    lastPushUsedForceWithLease: false,
    overwroteRemoteCommitWithoutLease: false,
    forcePushedMain: false,
  };
}

// ============================================================================
// SCENARIO 9: The Botched Merge Rollback on Production (git revert -m 1)
// ============================================================================
function createScenario9State(): GitRepositoryState {
  const cMain0: GitCommit = {
    sha: '900base',
    message: 'release: v4.1.0 stable microservice baseline',
    author: 'Marcus Chen <mchen@warroom.dev>',
    timestamp: '2 days ago',
    parents: [],
    tree: {
      'src/worker/eventLoop.ts': [
        'export function runWorker() {',
        '  console.log("Worker healthy");',
        '}',
      ].join('\n'),
    },
  };

  const cFeatureBranch: GitCommit = {
    sha: '901leak',
    message: 'feat(worker): unbounded queue buffer [CAUSES OOM CRASH]',
    author: 'Samira Patel <spatel@warroom.dev>',
    timestamp: '4 hours ago',
    parents: ['900base'],
    tree: {
      'src/worker/eventLoop.ts': [
        'export function runWorker() {',
        '  const buffer = [];',
        '  setInterval(() => buffer.push(new Array(1000000)), 10); // MEMORY LEAK BUG',
        '}',
      ].join('\n'),
    },
  };

  const cMergeBad: GitCommit = {
    sha: 'm402bad',
    message: 'Merge pull request #402 from team/feat-worker-buffer',
    author: 'Merge Queue Bot <bot@github.com>',
    timestamp: '30 mins ago',
    parents: ['900base', '901leak'],
    tree: { ...cFeatureBranch.tree },
  };

  const commits: Record<string, GitCommit> = {
    [cMain0.sha]: cMain0,
    [cFeatureBranch.sha]: cFeatureBranch,
    [cMergeBad.sha]: cMergeBad,
  };

  return {
    commits,
    branches: { main: cMergeBad.sha },
    tags: {},
    head: { type: 'branch', ref: 'main' },
    workingTree: { ...cMergeBad.tree },
    stagingIndex: { ...cMergeBad.tree },
    conflictedFiles: [],
    reflog: [
      { index: 0, sha: cMergeBad.sha, action: 'merge', message: cMergeBad.message, timestamp: '30 mins ago' },
      { index: 1, sha: cMain0.sha, action: 'checkout', message: 'moving to main', timestamp: '2 days ago' },
    ],
    stashes: [],
    bisect: {
      active: false,
      badSha: null,
      goodShas: [],
      candidates: [],
      stepsTaken: 0,
      foundCulpritSha: null,
      originalHead: { type: 'branch', ref: 'main' },
    },
    interactiveRebase: null,
    inProgressOperation: null,
    remote: {
      branches: { main: cMergeBad.sha },
      tags: {},
      commits: { ...commits },
    },
    lastPushUsedForceWithLease: false,
    overwroteRemoteCommitWithoutLease: false,
    forcePushedMain: false,
  };
}

// ============================================================================
// SCENARIO 10: The Untracked Disaster & Fast-Forward Sync (git clean & pull)
// ============================================================================
function createScenario10State(): GitRepositoryState {
  const cOld: GitCommit = {
    sha: 'a100old',
    message: 'release: v2.4.0 edge gateway',
    author: 'Marcus Chen <mchen@warroom.dev>',
    timestamp: '1 day ago',
    parents: [],
    tree: {
      'src/entrypoint.ts': 'export function startServer() { return "listening:8080"; }\n',
      'package.json': '{\n  "name": "gateway",\n  "version": "2.4.0"\n}\n',
    },
  };

  const cUpstream: GitCommit = {
    sha: 'h700hot',
    message: 'fix(security): patch HTTP request smuggling in proxy parser',
    author: 'Elena Vance <evance@warroom.dev>',
    timestamp: '20 mins ago',
    parents: ['a100old'],
    tree: {
      ...cOld.tree,
      'src/entrypoint.ts': 'export function startServer() { return "listening:8080 (smuggling_guard: strict)"; }\n',
      'src/security.ts': 'export const SMUGGLING_GUARD = true;\n',
    },
  };

  const dirtyWorkingTree = {
    ...cOld.tree,
    'src/entrypoint.ts': 'export function startServer() { return "BROKEN LOCAL EDIT"; }\n',
    'build.tmp': 'ROGUE TEMPORARY COMPILED ARTIFACT\n',
    'debug_trace.log': 'LOG STACK OVERFLOW DUMP 99481\n',
    'dist/core.o': 'ELF BINARY JUNK\n',
  };

  const commits: Record<string, GitCommit> = {
    [cOld.sha]: cOld,
    [cUpstream.sha]: cUpstream,
  };

  return {
    commits,
    branches: { main: cOld.sha },
    tags: {},
    head: { type: 'branch', ref: 'main' },
    workingTree: dirtyWorkingTree,
    stagingIndex: { ...cOld.tree },
    conflictedFiles: [],
    reflog: [
      { index: 0, sha: cOld.sha, action: 'clone', message: cOld.message, timestamp: '1 day ago' },
    ],
    stashes: [],
    bisect: {
      active: false,
      badSha: null,
      goodShas: [],
      candidates: [],
      stepsTaken: 0,
      foundCulpritSha: null,
      originalHead: { type: 'branch', ref: 'main' },
    },
    interactiveRebase: null,
    inProgressOperation: null,
    remote: {
      branches: { main: cUpstream.sha },
      tags: {},
      commits: { ...commits },
    },
    lastPushUsedForceWithLease: false,
    overwroteRemoteCommitWithoutLease: false,
    forcePushedMain: false,
  };
}

// ============================================================================
// SCENARIO 11: GitHub PR Outdated Branch & Lockfile Conflict Hell
// ============================================================================
function createScenario11State(): GitRepositoryState {
  const cBase: GitCommit = {
    sha: 'b110base',
    message: 'chore: bootstrap webhook service with axios 1.4.0',
    author: 'Marcus Chen <mchen@warroom.dev>',
    timestamp: '2 days ago',
    parents: [],
    tree: {
      'package.json': [
        '{',
        '  "name": "billing-webhooks",',
        '  "version": "1.0.0",',
        '  "dependencies": {',
        '    "axios": "^1.4.0"',
        '  }',
        '}',
      ].join('\n'),
      'package-lock.json': '{\n  "name": "billing-webhooks",\n  "lockfileVersion": 3,\n  "packages": { "axios": "1.4.0" }\n}\n',
      'src/billing/stripeWebhook.ts': [
        'export function handleStripeEvent(event: any) {',
        '  console.log("Received raw event", event.type);',
        '  return { processed: true };',
        '}',
      ].join('\n'),
    },
  };

  const cMainAxios: GitCommit = {
    sha: 'm200axios',
    message: 'chore(deps): upgrade axios to v1.7.0 & inject telemetry header',
    author: 'Elena Vance <evance@warroom.dev>',
    timestamp: '1 day ago',
    parents: ['b110base'],
    tree: {
      'package.json': [
        '{',
        '  "name": "billing-webhooks",',
        '  "version": "1.0.0",',
        '  "dependencies": {',
        '    "axios": "^1.7.0"',
        '  }',
        '}',
      ].join('\n'),
      'package-lock.json': '{\n  "name": "billing-webhooks",\n  "lockfileVersion": 3,\n  "packages": { "axios": "1.7.0" }\n}\n',
      'src/billing/stripeWebhook.ts': [
        'import axios from "axios";',
        '',
        'export const TELEMETRY_ENABLED = true;',
        '',
        'export function handleStripeEvent(event: any) {',
        '  console.log("Telemetry event logged:", event.type);',
        '  return { processed: true, telemetry: true };',
        '}',
      ].join('\n'),
    },
  };

  const cFeatureHook: GitCommit = {
    sha: 'w100hook',
    message: 'feat(stripe): add webhook signature validation and stripe sdk',
    author: 'You <oncall@warroom.dev>',
    timestamp: '3 hours ago',
    parents: ['b110base'],
    tree: {
      'package.json': [
        '{',
        '  "name": "billing-webhooks",',
        '  "version": "1.0.0",',
        '  "dependencies": {',
        '    "axios": "^1.4.0",',
        '    "stripe": "^14.0.0"',
        '  }',
        '}',
      ].join('\n'),
      'package-lock.json': '{\n  "name": "billing-webhooks",\n  "lockfileVersion": 3,\n  "packages": { "axios": "1.4.0", "stripe": "14.0.0" }\n}\n',
      'src/billing/stripeWebhook.ts': [
        'export const STRIPE_SIGNATURE_KEY = "whsec_prod_live";',
        '',
        'export function handleStripeEvent(event: any, signature?: string) {',
        '  if (!signature) throw new Error("Missing stripe signature");',
        '  console.log("Signature validated for", event.type);',
        '  return { processed: true, validated: true };',
        '}',
      ].join('\n'),
    },
  };

  const commits: Record<string, GitCommit> = {
    [cBase.sha]: cBase,
    [cMainAxios.sha]: cMainAxios,
    [cFeatureHook.sha]: cFeatureHook,
  };

  return {
    commits,
    branches: {
      main: cMainAxios.sha,
      'feature/stripe-webhook': cFeatureHook.sha,
    },
    tags: {},
    head: { type: 'branch', ref: 'feature/stripe-webhook' },
    workingTree: { ...cFeatureHook.tree },
    stagingIndex: { ...cFeatureHook.tree },
    conflictedFiles: [],
    reflog: [
      { index: 0, sha: cFeatureHook.sha, action: 'commit', message: cFeatureHook.message, timestamp: '3 hours ago' },
      { index: 1, sha: cBase.sha, action: 'checkout', message: 'checkout: moving from main to feature/stripe-webhook', timestamp: '5 hours ago' },
    ],
    stashes: [],
    bisect: {
      active: false,
      badSha: null,
      goodShas: [],
      candidates: [],
      stepsTaken: 0,
      foundCulpritSha: null,
      originalHead: { type: 'branch', ref: 'feature/stripe-webhook' },
    },
    interactiveRebase: null,
    inProgressOperation: null,
    remote: {
      branches: {
        main: cMainAxios.sha,
        'feature/stripe-webhook': cFeatureHook.sha,
      },
      tags: {},
      commits: { ...commits },
    },
    lastPushUsedForceWithLease: false,
    overwroteRemoteCommitWithoutLease: false,
    forcePushedMain: false,
  };
}

// ============================================================================
// SCENARIO 12: GitHub Push Blocked: 100MB Binary Asset & GH001 Error
// ============================================================================
function createScenario12State(): GitRepositoryState {
  const cBase: GitCommit = {
    sha: 'a120base',
    message: 'feat(core): initial AI agent framework',
    author: 'Marcus Chen <mchen@warroom.dev>',
    timestamp: '1 day ago',
    parents: [],
    tree: {
      'src/ai/agent.ts': 'export function runAgent(prompt: string) { return `Agent: ${prompt}`; }\n',
      'README.md': '# AI Enrichment Engine\n',
    },
  };

  const cBloated: GitCommit = {
    sha: 'e990blob',
    message: 'feat(ai): add customer vector enrichment and checkpoint binary',
    author: 'You <oncall@warroom.dev>',
    timestamp: '10 mins ago',
    parents: ['a120base'],
    tree: {
      ...cBase.tree,
      'src/ai/enrichment.ts': [
        'export interface EnrichmentContext { customerId: string; tier: string; }',
        '',
        'export function enrichCustomer(ctx: EnrichmentContext) {',
        '  return { ...ctx, score: 98, enrichedAt: new Date().toISOString() };',
        '}',
      ].join('\n'),
      'models/weights_v1.bin': '[LARGE_BINARY_ASSET_142MB] -- Raw quantized FP16 tensor checkpoint exceeding GitHub 100MB threshold',
    },
  };

  const commits: Record<string, GitCommit> = {
    [cBase.sha]: cBase,
    [cBloated.sha]: cBloated,
  };

  return {
    commits,
    branches: {
      main: cBase.sha,
      'feature/ai-enrichment': cBloated.sha,
    },
    tags: {},
    head: { type: 'branch', ref: 'feature/ai-enrichment' },
    workingTree: { ...cBloated.tree },
    stagingIndex: { ...cBloated.tree },
    conflictedFiles: [],
    reflog: [
      { index: 0, sha: cBloated.sha, action: 'commit', message: cBloated.message, timestamp: '10 mins ago' },
      { index: 1, sha: cBase.sha, action: 'checkout', message: 'checkout: moving from main to feature/ai-enrichment', timestamp: '1 hour ago' },
    ],
    stashes: [],
    bisect: {
      active: false,
      badSha: null,
      goodShas: [],
      candidates: [],
      stepsTaken: 0,
      foundCulpritSha: null,
      originalHead: { type: 'branch', ref: 'feature/ai-enrichment' },
    },
    interactiveRebase: null,
    inProgressOperation: null,
    remote: {
      branches: {
        main: cBase.sha,
      },
      tags: {},
      commits: { [cBase.sha]: cBase },
    },
    lastPushUsedForceWithLease: false,
    overwroteRemoteCommitWithoutLease: false,
    forcePushedMain: false,
  };
}

// ============================================================================
// SCENARIO 13: Fork & Upstream Sync Desync (Open Source Contribution Conflict)
// ============================================================================
function createScenario13State(): GitRepositoryState {
  const cBase: GitCommit = {
    sha: 'u130base',
    message: 'feat(api): initial public router and authentication handler',
    author: 'OSS Core Team <maintainers@oss-gateway.org>',
    timestamp: '4 days ago',
    parents: [],
    tree: {
      'src/middleware/context.ts': [
        'export interface UserSession { id: string; role: string; }',
        '',
        'export function authenticateRequest(req: any) {',
        '  if (!req.headers["authorization"]) throw new Error("Unauthorized");',
        '  return { id: "user_1", role: "admin" };',
        '}',
      ].join('\n'),
      'README.md': '# Open Gateway Service\n',
    },
  };

  const cUpstreamBreaking: GitCommit = {
    sha: 'u900ctx',
    message: 'refactor(core)!: require TraceContext in authenticateRequest for distributed tracing',
    author: 'OSS Core Team <maintainers@oss-gateway.org>',
    timestamp: '1 day ago',
    parents: ['u130base'],
    tree: {
      'src/middleware/context.ts': [
        'export interface UserSession { id: string; role: string; }',
        'export interface TraceContext { traceId: string; spanId: string; }',
        '',
        'export function authenticateRequest(req: any, ctx: TraceContext) {',
        '  if (!req.headers["authorization"]) throw new Error("Unauthorized");',
        '  console.log(`[${ctx.traceId}] Authenticating request`);',
        '  return { id: "user_1", role: "admin", traceId: ctx.traceId };',
        '}',
      ].join('\n'),
      'README.md': '# Open Gateway Service\nIncludes OpenTelemetry context.\n',
    },
  };

  const cUserFeature: GitCommit = {
    sha: 't300trace',
    message: 'feat: add request latency metrics in authentication handler',
    author: 'You <contributor@warroom.dev>',
    timestamp: '2 hours ago',
    parents: ['u130base'],
    tree: {
      'src/middleware/context.ts': [
        'export interface UserSession { id: string; role: string; }',
        'export const METRICS_RECORDED = true;',
        '',
        'export function authenticateRequest(req: any) {',
        '  const startMs = Date.now();',
        '  if (!req.headers["authorization"]) throw new Error("Unauthorized");',
        '  const duration = Date.now() - startMs;',
        '  console.log(`Auth duration: ${duration}ms`);',
        '  return { id: "user_1", role: "admin", durationMs: duration };',
        '}',
      ].join('\n'),
      'README.md': '# Open Gateway Service\n',
    },
  };

  const commits: Record<string, GitCommit> = {
    [cBase.sha]: cBase,
    [cUpstreamBreaking.sha]: cUpstreamBreaking,
    [cUserFeature.sha]: cUserFeature,
  };

  return {
    commits,
    branches: {
      main: cUpstreamBreaking.sha,
      'feature/auth-tracing': cUserFeature.sha,
    },
    tags: {},
    head: { type: 'branch', ref: 'feature/auth-tracing' },
    workingTree: { ...cUserFeature.tree },
    stagingIndex: { ...cUserFeature.tree },
    conflictedFiles: [],
    reflog: [
      { index: 0, sha: cUserFeature.sha, action: 'commit', message: cUserFeature.message, timestamp: '2 hours ago' },
      { index: 1, sha: cBase.sha, action: 'checkout', message: 'checkout: moving from main to feature/auth-tracing', timestamp: '1 day ago' },
    ],
    stashes: [],
    bisect: {
      active: false,
      badSha: null,
      goodShas: [],
      candidates: [],
      stepsTaken: 0,
      foundCulpritSha: null,
      originalHead: { type: 'branch', ref: 'feature/auth-tracing' },
    },
    interactiveRebase: null,
    inProgressOperation: null,
    remote: {
      branches: {
        main: cUpstreamBreaking.sha,
        'feature/auth-tracing': cUserFeature.sha,
      },
      tags: {},
      commits: { ...commits },
    },
    lastPushUsedForceWithLease: false,
    overwroteRemoteCommitWithoutLease: false,
    forcePushedMain: false,
  };
}

// ============================================================================
// SCENARIO 14: GitHub Security Advisory Backport to Enterprise LTS Branch
// ============================================================================
function createScenario14State(): GitRepositoryState {
  const cLts183: GitCommit = {
    sha: 'lts1830',
    message: 'release: cut v1.8.3 enterprise LTS build',
    author: 'Release Bot <ci@warroom.dev>',
    timestamp: '3 weeks ago',
    parents: [],
    tree: {
      'src/auth/tokenValidator.ts': [
        'export function validateToken(token: string, issuer: string): boolean {',
        '  // VULNERABLE: allows wildcard issuer bypass (CVE-2026-8819)',
        '  if (issuer === "*" || issuer.includes("dev")) return true;',
        '  return token.startsWith("ey");',
        '}',
      ].join('\n'),
      'src/config/version.ts': 'export const VERSION = "1.8.3-lts";\n',
    },
  };

  const cMainBase: GitCommit = {
    sha: 'm000base',
    message: 'chore: branch off main for v2.0 development train',
    author: 'Marcus Chen <mchen@warroom.dev>',
    timestamp: '2 weeks ago',
    parents: ['lts1830'],
    tree: { ...cLts183.tree },
  };

  const cUnstable20_1: GitCommit = {
    sha: 'v200un1',
    message: 'feat(v2)!: completely remove legacy XML session parser [BREAKING]',
    author: 'Devon Brooks <dbrooks@warroom.dev>',
    timestamp: '5 days ago',
    parents: ['m000base'],
    tree: {
      ...cMainBase.tree,
      'src/v2/newParser.ts': 'export const V2_ONLY = true;\n',
    },
  };

  const cSecPatch: GitCommit = {
    sha: 'sec8819',
    message: 'fix(security): sanitize JWT issuer to prevent CVE-2026-8819 token forging',
    author: 'Elena Vance <evance@warroom.dev>',
    timestamp: '30 mins ago',
    parents: ['v200un1'],
    tree: {
      ...cUnstable20_1.tree,
      'src/auth/tokenValidator.ts': [
        'export function validateToken(token: string, issuer: string): boolean {',
        '  // PATCHED: strictly forbid wildcard issuer, verify exact cryptographic match',
        '  if (!issuer || issuer === "*" || issuer.includes("..")) return false;',
        '  return token.startsWith("ey") && issuer === "https://auth.enterprise.internal";',
        '}',
      ].join('\n'),
    },
  };

  const commits: Record<string, GitCommit> = {
    [cLts183.sha]: cLts183,
    [cMainBase.sha]: cMainBase,
    [cUnstable20_1.sha]: cUnstable20_1,
    [cSecPatch.sha]: cSecPatch,
  };

  return {
    commits,
    branches: {
      main: cSecPatch.sha,
      'lts/v1.8.x': cLts183.sha,
    },
    tags: {
      'v1.8.3': cLts183.sha,
    },
    head: { type: 'branch', ref: 'main' },
    workingTree: { ...cSecPatch.tree },
    stagingIndex: { ...cSecPatch.tree },
    conflictedFiles: [],
    reflog: [
      { index: 0, sha: cSecPatch.sha, action: 'commit', message: cSecPatch.message, timestamp: '30 mins ago' },
      { index: 1, sha: cUnstable20_1.sha, action: 'commit', message: cUnstable20_1.message, timestamp: '5 days ago' },
    ],
    stashes: [],
    bisect: {
      active: false,
      badSha: null,
      goodShas: [],
      candidates: [],
      stepsTaken: 0,
      foundCulpritSha: null,
      originalHead: { type: 'branch', ref: 'main' },
    },
    interactiveRebase: null,
    inProgressOperation: null,
    remote: {
      branches: {
        main: cSecPatch.sha,
        'lts/v1.8.x': cLts183.sha,
      },
      tags: {
        'v1.8.3': cLts183.sha,
      },
      commits: { ...commits },
    },
    lastPushUsedForceWithLease: false,
    overwroteRemoteCommitWithoutLease: false,
    forcePushedMain: false,
  };
}

// ============================================================================
// EXPORT ALL 14 FLAGSHIP PRODUCTION SCENARIOS
// ============================================================================
export const SCENARIOS: Scenario[] = [
  {
    id: 'hotfix-release-train',
    number: 1,
    title: 'The Hotfix & Release Train Collision',
    subtitle: 'Isolate a critical production patch onto v2.1.1 without shipping unstable commits on main',
    difficulty: 'Junior',
    incidentTicker: 'SEV-1: Guest Checkout NullPointer Exception on Tag v2.1.0',
    focusedSkills: ['git checkout -b', 'git cherry-pick', 'git tag', 'git push'],
    jira: {
      key: 'INC-4091',
      title: 'Patch guest checkout crash on v2.1.0 release train and cherry-pick to main',
      severity: 'SEV-1',
      service: 'checkout-payment-service',
      acceptanceCriteria: [
        'Cut a hotfix branch from tag v2.1.0 (c102100) and apply commit f99a11b via cherry-pick.',
        'Tag the hotfix commit as v2.1.1 and push tag v2.1.1 to origin.',
        'Ensure v2.1.1 does NOT include any of the 3 unstable BNPL commits from main.',
        'Cherry-pick f99a11b onto main as well so the fix is not lost in future releases.',
      ],
    },
    slackThread: [
      {
        id: 's1-1',
        sender: 'PagerDuty Bot',
        role: 'Automated Alert',
        channel: '#incidents-war-room',
        timestamp: '10:42 AM',
        isAlert: true,
        text: '[Triggered] SEV-1: TypeError: Cannot read properties of undefined (reading "balanceCents") in paymentGateway.ts on production release v2.1.0.',
      },
      {
        id: 's1-2',
        sender: 'Elena Vance (Staff SRE)',
        role: 'Staff Engineer',
        channel: '#incidents-war-room',
        timestamp: '10:43 AM',
        text: 'I pushed a fix commit `f99a11b` on branch `fix/null-wallet-guard` parented off `v2.1.0`. DO NOT deploy `main`—Devon merged 3 half-baked BNPL commits (`d201a11`, `e302b22`, `f403c33`) onto `main` that will corrupt the ledger.',
      },
      {
        id: 's1-3',
        sender: 'Marcus Chen (Principal Architect)',
        role: 'Principal Engineer',
        channel: '#incidents-war-room',
        timestamp: '10:44 AM',
        text: 'We need tag `v2.1.1` pointing to the hotfix commit directly on top of `v2.1.0` (`c102100`) and pushed to `origin`, PLUS cherry-pick `f99a11b` onto `main` so `main` gets the guard too.',
      },
    ],
    hints: [
      'First, cherry-pick the fix onto `main`: while on `main`, run `git cherry-pick f99a11b`.',
      'Next, create a hotfix branch starting at `v2.1.0`: `git checkout -b hotfix/v2.1.1 v2.1.0` and run `git cherry-pick f99a11b`.',
      'Finally, push the tag to remote: `git push origin v2.1.1`.',
    ],
    optimalCommands: [
      'git cherry-pick f99a11b',
      'git checkout -b hotfix/v2.1.1 v2.1.0',
      'git cherry-pick f99a11b',
      'git tag v2.1.1',
      'git push origin v2.1.1',
    ],
    staffPostMortem:
      'When main contains unreleased features, never cut a hotfix from main. Branching from the production release tag (v2.1.0) and cherry-picking the isolated patch guarantees zero feature leakage while keeping main updated.',
    createInitialState: createScenario1State,
    verifyState: (repo: GitRepositoryState): AssertionResult[] => {
      const tagSha = repo.tags['v2.1.1'];
      const tagCommit = tagSha ? repo.commits[tagSha] : undefined;
      const tagParentIsV210 = Boolean(
        tagCommit && tagCommit.parents.length === 1 && tagCommit.parents[0] === 'c102100'
      );
      const tagHasFix = Boolean(
        tagCommit && tagCommit.tree['src/checkout/paymentGateway.ts']?.includes('if (!customer?.wallet)')
      );
      const tagHasNoUnstable = Boolean(tagCommit && !tagCommit.tree['src/bnpl/splitPay.ts']);
      const tagPushed = Boolean(tagSha && repo.remote.tags['v2.1.1'] === tagSha);

      const mainSha = repo.branches['main'];
      const mainCommit = mainSha ? repo.commits[mainSha] : undefined;
      const mainHasFixAndFeatures = Boolean(
        mainCommit &&
          mainCommit.tree['src/checkout/paymentGateway.ts']?.includes('if (!customer?.wallet)') &&
          mainCommit.tree['src/bnpl/ledger.ts']
      );

      return [
        {
          id: 'tag-parent',
          label: 'Tag v2.1.1 is parented directly by v2.1.0 (c102100)',
          description: 'No unstable BNPL commits from main leaked into the v2.1.1 release tag.',
          passed: tagParentIsV210 && tagHasFix && tagHasNoUnstable,
        },
        {
          id: 'tag-pushed',
          label: 'Tag v2.1.1 is pushed to remote origin',
          description: 'origin/tags/v2.1.1 matches local v2.1.1 hotfix commit.',
          passed: tagPushed && tagParentIsV210 && tagHasFix,
        },
        {
          id: 'main-cherry-picked',
          label: 'Fix f99a11b is cherry-picked onto main',
          description: 'Branch main includes both the null-wallet fix and existing feature commits.',
          passed: mainHasFixAndFeatures,
        },
        {
          id: 'clean-tree',
          label: 'Working tree is clean',
          description: 'No untracked or unmerged changes left in workspace.',
          passed: isWorkingTreeClean(repo),
        },
      ];
    },
    evaluateCI: (repo: GitRepositoryState): CIPipelineCheck[] => {
      const remoteTagSha = repo.remote.tags['v2.1.1'];
      const tagCommit = remoteTagSha ? repo.commits[remoteTagSha] : undefined;
      const prodHealthy = Boolean(
        tagCommit &&
          tagCommit.parents[0] === 'c102100' &&
          tagCommit.tree['src/checkout/paymentGateway.ts']?.includes('if (!customer?.wallet)')
      );
      const mainCommit = repo.commits[repo.branches['main']];
      const mainFixed = Boolean(
        mainCommit?.tree['src/checkout/paymentGateway.ts']?.includes('if (!customer?.wallet)')
      );

      return [
        {
          id: 'ci-prod-tag',
          name: 'release-deploy / tag:v2.1.1',
          targetRef: remoteTagSha ? `v2.1.1 (${remoteTagSha})` : 'v2.1.1 (missing)',
          status: prodHealthy ? 'passing' : 'failing',
          summary: prodHealthy
            ? 'Guest checkout suite passed (0 errors, BNPL excluded)'
            : 'Awaiting clean v2.1.1 tag on origin parented by v2.1.0',
          duration: '14s',
        },
        {
          id: 'ci-main-unit',
          name: 'unit-tests / branch:main',
          targetRef: `main (${repo.branches['main']})`,
          status: mainFixed ? 'passing' : 'failing',
          summary: mainFixed
            ? 'paymentGateway.spec.ts passed on main'
            : 'NullPointer failure in paymentGateway.spec.ts on main',
          duration: '8s',
        },
      ];
    },
  },

  {
    id: 'botched-rebase-reflog',
    number: 2,
    title: 'The Botched Rebase & Detached HEAD Recovery',
    subtitle: 'Rescue lost OAuth2 PKCE work from the reflog after a catastrophic rebase and deleted branch',
    difficulty: 'Junior',
    incidentTicker: 'SEV-2: Lost OAuth2 PKCE Branch Pointer & Corrupted Working Tree',
    focusedSkills: ['git reflog', 'git checkout -b', 'git reset --hard', 'git branch -f'],
    jira: {
      key: 'INC-4108',
      title: 'Recover deleted feature/auth-v2 branch to pre-rebase commit a1b2c3d',
      severity: 'SEV-2',
      service: 'identity-auth-service',
      acceptanceCriteria: [
        'Inspect git reflog to locate the exact pre-rebase commit SHA (a1b2c3d at HEAD@{3}).',
        'Restore branch feature/auth-v2 pointing to a1b2c3d and attach HEAD to feature/auth-v2.',
        'Discard the corrupted conflict markers in src/auth/jwtVerifier.ts so the working tree is clean.',
      ],
    },
    slackThread: [
      {
        id: 's2-1',
        sender: 'You (On-Call Engineer)',
        role: 'SWE II',
        channel: '#team-identity',
        timestamp: '11:15 AM',
        text: 'Uh oh. I tried to rebase `feature/auth-v2` onto `main`, butchered the conflict resolution in `jwtVerifier.ts`, panicked, deleted `feature/auth-v2`, and now I am in detached HEAD at `d88bad2` with half my PKCE code gone.',
      },
      {
        id: 's2-2',
        sender: 'Elena Vance (Staff SRE)',
        role: 'Staff Engineer',
        channel: '#team-identity',
        timestamp: '11:16 AM',
        text: 'Breathe! Git almost never deletes committed objects immediately—they stay in the object database for 30–90 days referenced by the reflog. Look at the faded dashed commits in the DAG visualizer or run `git reflog`.',
      },
      {
        id: 's2-3',
        sender: 'Elena Vance (Staff SRE)',
        role: 'Staff Engineer',
        channel: '#team-identity',
        timestamp: '11:17 AM',
        text: 'Find your golden commit before the rebase started (`HEAD@{3}` / `a1b2c3d`), recreate `feature/auth-v2` pointing to it, and `git reset --hard a1b2c3d` to wipe out the mangled working tree.',
      },
    ],
    hints: [
      'Run `git reflog` in the terminal to see `a1b2c3d HEAD@{3}: commit: feat(auth): complete OAuth2 PKCE token rotation & RS256 verifier`.',
      'Recreate and switch to the branch at that commit: `git checkout -b feature/auth-v2 a1b2c3d`.',
    ],
    optimalCommands: [
      'git reflog',
      'git checkout -b feature/auth-v2 a1b2c3d',
    ],
    staffPostMortem:
      'Even when a branch is deleted with `git branch -D` or mangled by a bad `git rebase`, the original commits remain intact in `.git/objects` until garbage collection runs. `git reflog` is your chronological safety net.',
    createInitialState: createScenario2State,
    verifyState: (repo: GitRepositoryState): AssertionResult[] => {
      const branchSha = repo.branches['feature/auth-v2'];
      const pointsToGolden = branchSha === 'a1b2c3d';
      const headAttached = repo.head.type === 'branch' && repo.head.ref === 'feature/auth-v2';
      const pkceRestored = Boolean(
        repo.workingTree['src/auth/pkce.ts'] &&
          repo.workingTree['src/auth/jwtVerifier.ts']?.includes('generateCodeChallenge')
      );
      const clean = isWorkingTreeClean(repo);

      return [
        {
          id: 'branch-restored',
          label: 'Branch feature/auth-v2 points to a1b2c3d (HEAD@{3})',
          description: 'Dangling pre-rebase commit recovered and bound to feature/auth-v2.',
          passed: pointsToGolden,
        },
        {
          id: 'head-attached',
          label: 'HEAD is attached to branch feature/auth-v2',
          description: 'Exited detached HEAD state.',
          passed: headAttached,
        },
        {
          id: 'pkce-files-intact',
          label: 'OAuth2 PKCE verifier & challenge files restored',
          description: 'src/auth/pkce.ts and RS256 logic in jwtVerifier.ts are present.',
          passed: pkceRestored,
        },
        {
          id: 'clean-workspace',
          label: 'Working tree is clean with zero conflict markers',
          description: 'All broken merge conflict remnants discarded.',
          passed: clean,
        },
      ];
    },
    evaluateCI: (repo: GitRepositoryState): CIPipelineCheck[] => {
      const sha = repo.branches['feature/auth-v2'];
      const valid = sha === 'a1b2c3d' && isWorkingTreeClean(repo);
      return [
        {
          id: 'ci-auth-pkce',
          name: 'auth-pkce-suite / feature/auth-v2',
          targetRef: sha ? `feature/auth-v2 (${sha})` : 'branch missing',
          status: valid ? 'passing' : 'failing',
          summary: valid
            ? 'All 28 OAuth2 PKCE & RS256 rotation tests passing'
            : 'Branch feature/auth-v2 missing or pointing to corrupted commit',
          duration: '11s',
        },
      ];
    },
  },

  {
    id: 'leaked-aws-credentials',
    number: 3,
    title: 'Leaked AWS Credentials in History',
    subtitle: 'Purge a committed .env.production secret from branch history and push safely with --force-with-lease',
    difficulty: 'Mid-Level',
    incidentTicker: 'SEV-1: AWS_SECRET_ACCESS_KEY Committed & Pushed in .env.production',
    focusedSkills: ['git rebase -i', 'git fetch', 'git push --force-with-lease'],
    jira: {
      key: 'SEC-9920',
      title: 'Purge .env.production commit e44sec1 from feature/payments without losing teammate work',
      severity: 'SEV-1',
      service: 'stripe-payments-worker',
      acceptanceCriteria: [
        'Remove commit e44sec1 (.env.production) from feature/payments history using interactive rebase (drop) or rebase.',
        'Preserve both vital Stripe commits (b77pay2 idempotency key & c88pay3 webhook retry).',
        'Preserve coworker Alex Rivera’s remote commit (d99cow4 RUNBOOK.md) on origin/feature/payments.',
        'Push the sanitized history to origin/feature/payments using git push --force-with-lease (never raw --force).',
      ],
    },
    slackThread: [
      {
        id: 's3-1',
        sender: 'GitGuardian Security Scanner',
        role: 'Security Bot',
        channel: '#sec-ops-alerts',
        timestamp: '01:05 PM',
        isAlert: true,
        text: 'CRITICAL: High-entropy AWS Secret Access Key (`wJalrXUtnFEMI...`) and Stripe Live Secret detected in `.env.production` at commit `e44sec1` on `feature/payments`.',
      },
      {
        id: 's3-2',
        sender: 'Samira Patel (Senior SWE)',
        role: 'Senior Engineer',
        channel: '#incidents-war-room',
        timestamp: '01:06 PM',
        text: 'I already rotated the IAM key in AWS Console, but we MUST purge `e44sec1` from the commit graph before this branch can merge. Notice there are 2 vital Stripe commits (`b77pay2` and `c88pay3`) stacked on top of `e44sec1`!',
      },
      {
        id: 's3-3',
        sender: 'Alex Rivera (SWE III)',
        role: 'Software Engineer',
        channel: '#incidents-war-room',
        timestamp: '01:07 PM',
        text: 'Heads up! I just pushed `d99cow4` (`RUNBOOK.md`) to `origin/feature/payments` 20 mins ago. Pull/rebase my commit first, drop `e44sec1` via `git rebase -i 110root`, and push with `git push --force-with-lease` so you do not nuke my runbook!',
      },
    ],
    hints: [
      'First, incorporate Alex’s remote commit (`d99cow4`) onto your local branch: `git pull --rebase`.',
      'Next, start an interactive rebase from the root commit: `git rebase -i 110root`.',
      'In the Interactive Rebase Todo Editor, set `e44sec1` to `drop`, keep the other commits as `pick`, and click Execute Rebase.',
      'Finally, update the remote safely: `git push --force-with-lease origin feature/payments`.',
    ],
    optimalCommands: [
      'git pull --rebase',
      'git rebase -i 110root',
      'git push --force-with-lease origin feature/payments',
    ],
    staffPostMortem:
      'Deleting a leaked file in a new commit leaves the secret readable in historical blobs. Interactive rebase (`drop`) rewrites the commit lineage without the secret, and `--force-with-lease` protects concurrent teammate commits.',
    createInitialState: createScenario3State,
    verifyState: (repo: GitRepositoryState): AssertionResult[] => {
      const branchSha = repo.branches['feature/payments'];
      const reachable = branchSha
        ? Array.from(getReachableShas(repo.commits, [branchSha])).map((s) => repo.commits[s])
        : [];
      const secretInAnyCommit = reachable.some((c) => c && c.tree['.env.production'] !== undefined);
      const tipCommit = branchSha ? repo.commits[branchSha] : undefined;
      const hasVitalCommits = Boolean(
        tipCommit &&
          tipCommit.tree['src/stripeClient.ts']?.includes('Idempotency-Key') &&
          tipCommit.tree['src/webhookVerifier.ts']?.includes('verifyWebhookSignature')
      );
      const hasCoworkerRunbook = Boolean(tipCommit && tipCommit.tree['RUNBOOK.md'] !== undefined);
      const remoteSyncedWithLease = Boolean(
        branchSha &&
          repo.remote.branches['feature/payments'] === branchSha &&
          repo.lastPushUsedForceWithLease &&
          !repo.overwroteRemoteCommitWithoutLease
      );

      return [
        {
          id: 'no-secret-in-history',
          label: '.env.production is completely purged from all reachable commits',
          description: 'Zero commits in feature/payments history contain .env.production.',
          passed: Boolean(branchSha) && !secretInAnyCommit,
        },
        {
          id: 'vital-commits-kept',
          label: 'Both vital Stripe commits remain intact',
          description: 'stripeClient.ts and webhookVerifier.ts changes are preserved.',
          passed: hasVitalCommits,
        },
        {
          id: 'coworker-commit-kept',
          label: 'Coworker commit (RUNBOOK.md) from origin/feature/payments is preserved',
          description: 'Did not clobber Alex Rivera’s upstream commit.',
          passed: hasCoworkerRunbook,
        },
        {
          id: 'pushed-with-lease',
          label: 'Synced with origin/feature/payments using --force-with-lease',
          description: 'Used safe force-with-lease push without raw --force.',
          passed: remoteSyncedWithLease && !secretInAnyCommit && hasCoworkerRunbook,
        },
      ];
    },
    evaluateCI: (repo: GitRepositoryState): CIPipelineCheck[] => {
      const remoteSha = repo.remote.branches['feature/payments'];
      const reachable = remoteSha
        ? Array.from(getReachableShas(repo.commits, [remoteSha])).map((s) => repo.commits[s])
        : [];
      const leaked = reachable.some((c) => c?.tree['.env.production'] !== undefined);
      const tip = remoteSha ? repo.commits[remoteSha] : undefined;
      const complete = Boolean(!leaked && tip?.tree['RUNBOOK.md'] && tip?.tree['src/webhookVerifier.ts']);

      return [
        {
          id: 'ci-secret-scan',
          name: 'gitguardian / secret-history-scan',
          targetRef: `origin/feature/payments (${remoteSha || 'none'})`,
          status: !leaked ? 'passing' : 'failing',
          summary: !leaked
            ? '0 secrets detected across all reachable commits on origin'
            : 'CRITICAL: AWS_SECRET_ACCESS_KEY found in commit history (.env.production)',
          duration: '6s',
        },
        {
          id: 'ci-stripe-tests',
          name: 'stripe-integration / unit-tests',
          targetRef: `origin/feature/payments (${remoteSha || 'none'})`,
          status: complete ? 'passing' : 'failing',
          summary: complete
            ? 'Idempotency, webhook verifier, and runbook checks passed'
            : 'Awaiting sanitized push with all feature & runbook commits intact',
          duration: '12s',
        },
      ];
    },
  },

  {
    id: 'bisect-calculation-regression',
    number: 4,
    title: 'Hunting a Silent Calculation Regression',
    subtitle: 'Binary-search 16 commits with git bisect to isolate a rounding bug and safely revert it on main',
    difficulty: 'Mid-Level',
    incidentTicker: 'SEV-2: Enterprise Invoice Rounding Regression on Protected main',
    focusedSkills: ['git bisect start', 'git bisect good/bad', './test_billing.sh', 'git revert'],
    jira: {
      key: 'BILL-7741',
      title: 'Use git bisect across v1.0.0..HEAD to locate and revert the invoice rounding bug',
      severity: 'SEV-2',
      service: 'billing-ledger-microservice',
      acceptanceCriteria: [
        'Use git bisect (starting with HEAD as bad and v1.0.0 as good) to isolate the exact culprit commit (7f4b90b).',
        'Test commits during bisect using ./test_billing.sh (or automate with git bisect run ./test_billing.sh).',
        'Run git bisect reset to return to main, then create a clean revert commit via git revert 7f4b90b.',
        'Push the revert commit on main to origin/main (history rewriting on main is strictly forbidden).',
      ],
    },
    slackThread: [
      {
        id: 's4-1',
        sender: 'Finance Recon Bot',
        role: 'Automated Monitor',
        channel: '#billing-alerts',
        timestamp: '02:30 PM',
        isAlert: true,
        text: 'ALERT: Reconciliation mismatch detected! An invoice of $19.99 with 8.25% tax was billed as $21.63 instead of $21.64.',
      },
      {
        id: 's4-2',
        sender: 'Marcus Chen (Principal Architect)',
        role: 'Principal Engineer',
        channel: '#incidents-war-room',
        timestamp: '02:31 PM',
        text: 'Tag `v1.0.0` was 100% accurate yesterday, and `HEAD` is broken. There are 16 commits in between. Use `git bisect` to find the culprit!',
      },
      {
        id: 's4-3',
        sender: 'Elena Vance (Staff SRE)',
        role: 'Staff Engineer',
        channel: '#incidents-war-room',
        timestamp: '02:32 PM',
        text: 'We have a test script `./test_billing.sh` in the repo root. Once bisect finds the culprit SHA, run `git bisect reset`, `git revert <culprit-sha>`, and `git push origin main`.',
      },
    ],
    hints: [
      'Start bisecting: `git bisect start`, then `git bisect bad HEAD`, then `git bisect good v1.0.0`.',
      'Run `git bisect run ./test_billing.sh` to automatically binary-search all steps!',
      'Once `7f4b90b` is identified, run `git bisect reset`, then `git revert 7f4b90b`, and `git push origin main`.',
    ],
    optimalCommands: [
      'git bisect start',
      'git bisect bad HEAD',
      'git bisect good v1.0.0',
      'git bisect run ./test_billing.sh',
      'git bisect reset',
      'git revert 7f4b90b',
      'git push origin main',
    ],
    staffPostMortem:
      '`git bisect` reduces linear debugging across N commits to log2(N) steps. Paired with `git revert` on protected branches, you can remediate silent regressions in seconds without destabilizing shared history.',
    createInitialState: createScenario4State,
    customScriptRunner: (_scriptName: string, repo: GitRepositoryState) => {
      const calcCode = repo.workingTree['src/billing/calculator.ts'] || '';
      const isBuggy = calcCode.includes('Math.floor(raw * 100)');
      if (isBuggy) {
        return {
          exitCode: 1,
          output: [
            'Running ./test_billing.sh ...',
            '  [FAIL] calculateInvoiceTotal(19.99, 0.0825): expected 21.64, got 21.63',
            'Exit code: 1 (BAD COMMIT)',
          ].join('\n'),
        };
      }
      return {
        exitCode: 0,
        output: [
          'Running ./test_billing.sh ...',
          '  [PASS] calculateInvoiceTotal(19.99, 0.0825) === 21.64',
          'Exit code: 0 (GOOD COMMIT)',
        ].join('\n'),
      };
    },
    verifyState: (repo: GitRepositoryState): AssertionResult[] => {
      const mainSha = repo.branches['main'];
      const mainCommit = mainSha ? repo.commits[mainSha] : undefined;
      const historyIntact = Boolean(mainSha && isAncestor(repo.commits, 'b161016', mainSha));
      const reverted7f4b90b = Boolean(
        mainCommit &&
          (mainCommit.revertedFromSha === '7f4b90b' ||
            mainCommit.message.includes('perf(math): optimize floating point tax accumulator')) &&
          mainCommit.tree['src/billing/calculator.ts']?.includes('Math.round')
      );
      const bisectExited = !repo.bisect.active && repo.head.type === 'branch' && repo.head.ref === 'main';
      const pushedToOrigin = Boolean(mainSha && repo.remote.branches['main'] === mainSha && reverted7f4b90b);

      return [
        {
          id: 'reverted-culprit',
          label: 'Culprit commit 7f4b90b is reverted on main',
          description: 'Standard IEEE-754 Math.round calculation is restored via git revert.',
          passed: reverted7f4b90b,
        },
        {
          id: 'history-preserved',
          label: 'Shared main history was not rewritten',
          description: 'Protected branch history preserved; fix applied as a forward revert commit.',
          passed: historyIntact && !repo.forcePushedMain,
        },
        {
          id: 'bisect-finished',
          label: 'Exited git bisect session and returned to branch main',
          description: 'git bisect reset completed; HEAD is attached to main.',
          passed: bisectExited,
        },
        {
          id: 'origin-synced',
          label: 'Revert commit is pushed to origin/main',
          description: 'origin/main matches local main with passing billing suite.',
          passed: pushedToOrigin,
        },
      ];
    },
    evaluateCI: (repo: GitRepositoryState): CIPipelineCheck[] => {
      const remoteMain = repo.remote.branches['main'];
      const commit = remoteMain ? repo.commits[remoteMain] : undefined;
      const passes = Boolean(commit?.tree['src/billing/calculator.ts']?.includes('Math.round'));
      return [
        {
          id: 'ci-billing-regression',
          name: 'billing-regression-suite / origin/main',
          targetRef: `origin/main (${remoteMain})`,
          status: passes ? 'passing' : 'failing',
          summary: passes
            ? 'test_billing.sh: 142/142 currency rounding assertions passed'
            : 'FAIL: calculateInvoiceTotal(19.99, 0.0825) returned 21.63 (expected 21.64)',
          duration: '9s',
        },
      ];
    },
  },

  {
    id: 'rebase-squash-conflict-hell',
    number: 5,
    title: 'PR Cleanup & 3-Way Merge Conflict Hell',
    subtitle: 'Rebase onto origin/main, resolve 3-way conflict markers in config.ts, and squash 5 WIP commits into 1',
    difficulty: 'Senior / Staff',
    incidentTicker: 'PR BLOCKED: 5 Messy WIP Commits & Merge Conflict with origin/main',
    focusedSkills: ['git rebase -i origin/main', '3-Way Conflict Resolution', 'Squash / Fixup', 'Semantic Commit'],
    jira: {
      key: 'GATE-512',
      title: 'Rebase feat/rate-limiter onto origin/main, resolve config.ts conflict, and squash into 1 commit',
      severity: 'SEV-3',
      service: 'edge-api-gateway',
      acceptanceCriteria: [
        'Rebase feat/rate-limiter onto origin/main (599main).',
        'Resolve the 3-way merge conflict in src/config.ts keeping BOTH maxConnections: 250 and rateLimit: { enabled: true, rpm: 1200 }.',
        'Squash the 5 messy commits into 1 single commit with message: feat(config): enable rate limiting',
      ],
    },
    slackThread: [
      {
        id: 's5-1',
        sender: 'GitHub Actions Bot',
        role: 'CI / Merge Queue',
        channel: '#pr-reviews',
        timestamp: '04:10 PM',
        isAlert: true,
        text: 'PR #842 (`feat/rate-limiter`) cannot be merged: Conflicts with `origin/main` in `src/config.ts` and fails commit-lint (5 non-semantic commits).',
      },
      {
        id: 's5-2',
        sender: 'Marcus Chen (Principal Architect)',
        role: 'Principal Engineer',
        channel: '#pr-reviews',
        timestamp: '04:12 PM',
        text: 'Please squash your 5 commits into 1 semantic commit (`feat(config): enable rate limiting`) via `git rebase -i 500base` (or `git rebase -i origin/main`), and resolve the conflict in `src/config.ts`.',
      },
    ],
    hints: [
      'Squash locally first: `git rebase -i 500base`. In the Todo Editor, reword commit 1 to `feat(config): enable rate limiting` and squash/fixup the rest.',
      'Now rebase onto `origin/main`: `git rebase origin/main`.',
      'In Code Editor, click Accept Both Changes in `src/config.ts`, stage with `git add src/config.ts`, and run `git rebase --continue`.',
    ],
    optimalCommands: [
      'git rebase -i 500base',
      'git rebase origin/main',
      'git add src/config.ts',
      'git rebase --continue',
    ],
    staffPostMortem:
      'Squashing locally onto your branch base before rebasing onto origin/main collapses multiple conflicting commits into one, meaning you only resolve conflicts once instead of on every WIP step!',
    createInitialState: createScenario5State,
    verifyState: (repo: GitRepositoryState): AssertionResult[] => {
      const branchSha = repo.branches['feat/rate-limiter'];
      const originMainSha = repo.remote.branches['main'];
      const isBasedOnOriginMain = Boolean(branchSha && originMainSha && isAncestor(repo.commits, originMainSha, branchSha));
      const commitsAboveMain = branchSha && originMainSha ? getCommitsBetween(repo.commits, originMainSha, branchSha) : [];
      const singleSquashedCommit = commitsAboveMain.length === 1 && commitsAboveMain[0].message.trim() === 'feat(config): enable rate limiting';
      const configContent = repo.workingTree['src/config.ts'] || '';
      const noMarkers = !hasConflictMarkers(configContent);
      const hasBothConfigs = noMarkers && configContent.includes('maxConnections: 250') && configContent.includes('rpm: 1200');
      const rateLimiterFileOk = Boolean(repo.workingTree['src/rateLimiter.ts']?.includes('checkRateLimit'));

      return [
        {
          id: 'rebased-onto-origin-main',
          label: 'Branch feat/rate-limiter is rebased onto origin/main (599main)',
          description: 'Commit history is linear on top of origin/main.',
          passed: isBasedOnOriginMain,
        },
        {
          id: 'squashed-into-one',
          label: '5 messy commits squashed into 1 commit: "feat(config): enable rate limiting"',
          description: 'Exactly 1 commit sits between origin/main and feat/rate-limiter with semantic message.',
          passed: isBasedOnOriginMain && singleSquashedCommit,
        },
        {
          id: 'conflict-resolved-both',
          label: 'Resolved src/config.ts with maxConnections: 250 and rpm: 1200',
          description: 'No conflict markers remain; both upstream and feature changes preserved.',
          passed: hasBothConfigs && rateLimiterFileOk,
        },
        {
          id: 'clean-tree-s5',
          label: 'Rebase completed and working tree is clean',
          description: 'No active rebase or unstaged changes remain.',
          passed: !repo.interactiveRebase && isWorkingTreeClean(repo) && hasBothConfigs,
        },
      ];
    },
    evaluateCI: (repo: GitRepositoryState): CIPipelineCheck[] => {
      const branchSha = repo.branches['feat/rate-limiter'];
      const originMainSha = repo.remote.branches['main'];
      const commitsAbove = branchSha && originMainSha ? getCommitsBetween(repo.commits, originMainSha, branchSha) : [];
      const lintOk = commitsAbove.length === 1 && commitsAbove[0].message.trim() === 'feat(config): enable rate limiting';
      const config = repo.workingTree['src/config.ts'] || '';
      const buildOk = !hasConflictMarkers(config) && config.includes('maxConnections: 250') && config.includes('rpm: 1200') && isWorkingTreeClean(repo);

      return [
        {
          id: 'ci-commitlint',
          name: 'commitlint / conventional-commits',
          targetRef: `feat/rate-limiter (${commitsAbove.length} commit${commitsAbove.length === 1 ? '' : 's'})`,
          status: lintOk ? 'passing' : 'failing',
          summary: lintOk
            ? '1 semantic commit verified: "feat(config): enable rate limiting"'
            : `Expected 1 squashed commit "feat(config): enable rate limiting", found ${commitsAbove.length}`,
          duration: '4s',
        },
        {
          id: 'ci-gateway-build',
          name: 'gateway-typecheck-and-test',
          targetRef: `feat/rate-limiter (${branchSha || 'detached'})`,
          status: buildOk && lintOk ? 'passing' : 'failing',
          summary: buildOk
            ? 'src/config.ts & src/rateLimiter.ts compiled cleanly'
            : 'Conflict markers or missing maxConnections: 250 / rpm: 1200 in src/config.ts',
          duration: '10s',
        },
      ];
    },
  },

  {
    id: 'uncommitted-prod-emergency',
    number: 6,
    title: 'The Uncommitted Production Emergency',
    subtitle: 'Stash uncompilable work-in-progress, switch to main to patch a Sev-1 Redis cache outage, and restore work',
    difficulty: 'Junior',
    incidentTicker: 'SEV-1: Redis Cache Connection Exhaustion in Production',
    focusedSkills: ['git stash', 'git checkout main', 'git commit -am', 'git push', 'git stash pop'],
    jira: {
      key: 'CACHE-901',
      title: 'Emergency patch Redis maxRetries on main while preserving in-flight db migration',
      severity: 'SEV-1',
      service: 'redis-cache-cluster',
      acceptanceCriteria: [
        'Safely stash dirty uncommitted migration files on branch feat/db-migration.',
        'Checkout branch main, update src/cache/redis.ts to maxRetries: 5, and commit.',
        'Push the fix on main to origin/main.',
        'Switch back to feat/db-migration and pop your stashed uncommitted files.',
      ],
    },
    slackThread: [
      {
        id: 's6-1',
        sender: 'PagerDuty Bot',
        role: 'Automated Alert',
        channel: '#incidents-war-room',
        timestamp: '05:01 PM',
        isAlert: true,
        text: 'SEV-1: Redis connection pool exhausted! `maxRetries: 0` causes immediate unrecoverable cluster drops on any 10ms transient spike.',
      },
      {
        id: 's6-2',
        sender: 'Elena Vance (Staff SRE)',
        role: 'Staff Engineer',
        channel: '#incidents-war-room',
        timestamp: '05:02 PM',
        text: 'You have uncommitted syntax-breaking files on `feat/db-migration`. DO NOT commit them! Run `git stash`, switch to `main`, change `maxRetries: 5` in `src/cache/redis.ts`, commit and push to `origin/main`. Then return to `feat/db-migration` and `git stash pop`!',
      },
    ],
    hints: [
      'Stash your dirty working tree: `git stash`.',
      'Switch to main: `git checkout main`.',
      'Edit `src/cache/redis.ts` in the Code Editor to set `maxRetries: 5`, stage, and commit with `git commit -am "fix(cache): increase redis maxRetries to 5"`.',
      'Push to remote: `git push origin main`.',
      'Return to feature branch and pop your stash: `git checkout feat/db-migration` then `git stash pop`.',
    ],
    optimalCommands: [
      'git stash',
      'git checkout main',
      'git commit -am "fix(cache): increase redis maxRetries to 5"',
      'git push origin main',
      'git checkout feat/db-migration',
      'git stash pop',
    ],
    staffPostMortem:
      '`git stash` saves your local modifications away and reverts the working tree to match the HEAD commit, giving you a clean slate to jump branches and hotfix production emergencies without polluting history with broken WIP commits.',
    createInitialState: createScenario6State,
    verifyState: (repo: GitRepositoryState): AssertionResult[] => {
      const remoteMainSha = repo.remote.branches['main'];
      const remoteMainCommit = remoteMainSha ? repo.commits[remoteMainSha] : undefined;
      const redisFixedOnRemote = Boolean(
        remoteMainCommit?.tree['src/cache/redis.ts']?.includes('maxRetries: 5')
      );
      const onFeatBranch = repo.head.type === 'branch' && repo.head.ref === 'feat/db-migration';
      const stashPoppedAndWorkRestored = Boolean(
        repo.workingTree['src/db/migration_wip.ts']?.includes('UNCOMPILABLE')
      );
      const stashEmpty = repo.stashes.length === 0;

      return [
        {
          id: 'redis-fixed-pushed',
          label: 'Redis fix (maxRetries: 5) committed on main and pushed to origin/main',
          description: 'Production cluster hotfix is live on remote main.',
          passed: redisFixedOnRemote,
        },
        {
          id: 'returned-to-feat-branch',
          label: 'HEAD is back on branch feat/db-migration',
          description: 'Returned to development branch after hotfix deploy.',
          passed: onFeatBranch,
        },
        {
          id: 'stash-popped-cleanly',
          label: 'Stash popped and in-flight migration files restored in working tree',
          description: 'src/db/migration_wip.ts and dirty schema edits are restored.',
          passed: onFeatBranch && stashPoppedAndWorkRestored && stashEmpty,
        },
      ];
    },
    evaluateCI: (repo: GitRepositoryState): CIPipelineCheck[] => {
      const remoteMain = repo.remote.branches['main'];
      const commit = remoteMain ? repo.commits[remoteMain] : undefined;
      const fixed = Boolean(commit?.tree['src/cache/redis.ts']?.includes('maxRetries: 5'));
      return [
        {
          id: 'ci-redis-health',
          name: 'redis-cluster-health / origin/main',
          targetRef: `origin/main (${remoteMain || 'none'})`,
          status: fixed ? 'passing' : 'failing',
          summary: fixed ? 'Redis cluster reconnects successfully with maxRetries: 5' : 'Cluster dropping connections (maxRetries: 0)',
          duration: '5s',
        },
      ];
    },
  },

  {
    id: 'rebase-onto-pr-cleanup',
    number: 7,
    title: 'Diverged PR Branch & Ghost Merge Commits',
    subtitle: 'Re-root a pull request branch off main using git rebase --onto to purge unrelated experimental commits',
    difficulty: 'Mid-Level',
    incidentTicker: 'GITHUB PR BLOCKED: 14 Ghost Commits from experiment/v8-engine in Pull Request',
    focusedSkills: ['git rebase --onto', 'git push --force-with-lease', 'PR Branch Re-rooting'],
    jira: {
      key: 'PR-912',
      title: 'Clean GitHub PR #912: Re-root feature/invoice-pdf directly onto main',
      severity: 'SEV-2',
      service: 'billing-invoice-service',
      acceptanceCriteria: [
        'Re-root feature/invoice-pdf so its parent is main (700main) instead of experiment/v8-engine (x102exp).',
        'Purge the 2 experimental commits (x101exp and x102exp) from feature/invoice-pdf history.',
        'Preserve both PDF invoice commits (p201pdf and p202pdf).',
        'Update remote origin/feature/invoice-pdf using git push --force-with-lease.',
      ],
    },
    slackThread: [
      {
        id: 's7-1',
        sender: 'Marcus Chen (Principal Architect)',
        role: 'Principal Engineer',
        channel: '#pr-reviews',
        timestamp: '06:10 PM',
        text: 'Look at PR #912 (`feature/invoice-pdf`). Why are Devon’s unreviewed Rust/SIMD experiments (`x101exp`, `x102exp`) included in this PR? You accidentally created your branch off `experiment/v8-engine` instead of `main`!',
      },
      {
        id: 's7-2',
        sender: 'Elena Vance (Staff SRE)',
        role: 'Staff Engineer',
        channel: '#pr-reviews',
        timestamp: '06:12 PM',
        text: 'Use `git rebase --onto main experiment/v8-engine feature/invoice-pdf`. That takes only the commits between `experiment/v8-engine` and `feature/invoice-pdf` and replays them straight onto `main`. Then push with `--force-with-lease`!',
      },
    ],
    hints: [
      'Run `git rebase --onto main experiment/v8-engine feature/invoice-pdf` (or while on `feature/invoice-pdf`, `git rebase --onto main experiment/v8-engine`).',
      'Verify with `git log --oneline`: only your 2 PDF commits should sit on top of `main`.',
      'Push the sanitized branch: `git push --force-with-lease origin feature/invoice-pdf`.',
    ],
    optimalCommands: [
      'git rebase --onto main experiment/v8-engine feature/invoice-pdf',
      'git push --force-with-lease origin feature/invoice-pdf',
    ],
    staffPostMortem:
      '`git rebase --onto <newbase> <oldupstream> <branch>` is Git’s surgical transplant knife. It lets you detach a feature branch from a wrong base branch and transplant only your unique commits onto production main without dragging along ghost commits.',
    createInitialState: createScenario7State,
    verifyState: (repo: GitRepositoryState): AssertionResult[] => {
      const branchSha = repo.branches['feature/invoice-pdf'];
      const isParentedByMain = Boolean(
        branchSha && isAncestor(repo.commits, '700main', branchSha)
      );
      const commitsAboveMain =
        branchSha ? getCommitsBetween(repo.commits, '700main', branchSha) : [];
      const hasOnlyPdfCommits =
        commitsAboveMain.length === 2 &&
        commitsAboveMain.every((c) => c.tree['src/pdfGenerator.ts'] && !c.tree['src/simd.ts']);
      const pushed = Boolean(
        branchSha &&
          repo.remote.branches['feature/invoice-pdf'] === branchSha &&
          repo.lastPushUsedForceWithLease
      );

      return [
        {
          id: 'parented-by-main',
          label: 'Branch feature/invoice-pdf is re-rooted onto main (700main)',
          description: 'No longer based on experiment/v8-engine.',
          passed: isParentedByMain,
        },
        {
          id: 'ghost-commits-purged',
          label: 'Experimental commits (x101exp, x102exp) purged from PR history',
          description: 'Exactly 2 PDF commits exist on top of main with no SIMD files.',
          passed: isParentedByMain && hasOnlyPdfCommits,
        },
        {
          id: 'pushed-with-lease-s7',
          label: 'Updated origin/feature/invoice-pdf using --force-with-lease',
          description: 'Remote PR branch matches sanitized local history.',
          passed: pushed && hasOnlyPdfCommits,
        },
      ];
    },
    evaluateCI: (repo: GitRepositoryState): CIPipelineCheck[] => {
      const sha = repo.remote.branches['feature/invoice-pdf'];
      const commitsAbove = sha ? getCommitsBetween(repo.commits, '700main', sha) : [];
      const clean = commitsAbove.length === 2 && commitsAbove.every((c) => !c.tree['src/simd.ts']);

      return [
        {
          id: 'ci-pr-diff',
          name: 'github / pr-commit-validation',
          targetRef: `feature/invoice-pdf (${commitsAbove.length} commits)`,
          status: clean ? 'passing' : 'failing',
          summary: clean
            ? 'PR #912 cleanly isolated to 2 PDF invoice commits on top of main'
            : `PR #912 contains ${commitsAbove.length} commits (includes unmerged experiment/v8-engine code)`,
          duration: '6s',
        },
      ];
    },
  },

  {
    id: 'accidental-commits-on-main',
    number: 8,
    title: 'Accidental Commits on Protected main',
    subtitle: 'Migrate commits made mistakenly on main to a feature branch and reset main without losing work',
    difficulty: 'Mid-Level',
    incidentTicker: 'BLOCKED: Direct Commits on Protected main Rejected by GitHub Pre-Push Hook',
    focusedSkills: ['git branch <new-branch>', 'git reset --hard origin/main', 'git checkout <new-branch>'],
    jira: {
      key: 'HOOK-204',
      title: 'Move 2 unpushed webhook commits off main to feature/stripe-webhooks and restore main',
      severity: 'SEV-2',
      service: 'webhook-gateway',
      acceptanceCriteria: [
        'Preserve commits 801hook and 802test on a new branch named feature/stripe-webhooks.',
        'Reset local branch main back to match origin/main (800root).',
        'Attach HEAD to feature/stripe-webhooks with a clean working tree.',
      ],
    },
    slackThread: [
      {
        id: 's8-1',
        sender: 'You (On-Call Engineer)',
        role: 'SWE II',
        channel: '#team-backend',
        timestamp: '07:15 PM',
        text: 'I worked for 3 hours on Stripe signature validation and committed twice, but I just realized I was on `main` the whole time! GitHub blocked my push: `Protected branch: pull request required`.',
      },
      {
        id: 's8-2',
        sender: 'Elena Vance (Staff SRE)',
        role: 'Staff Engineer',
        channel: '#team-backend',
        timestamp: '07:16 PM',
        text: 'Do not panic and do not delete your files! Since `main` currently points to your latest commit, just create a new branch pointer right here: `git branch feature/stripe-webhooks`.',
      },
      {
        id: 's8-3',
        sender: 'Elena Vance (Staff SRE)',
        role: 'Staff Engineer',
        channel: '#team-backend',
        timestamp: '07:17 PM',
        text: 'Then reset `main` back to match `origin/main` (`git reset --hard origin/main`), and switch to your feature branch (`git checkout feature/stripe-webhooks`). Your work is 100% saved!',
      },
    ],
    hints: [
      'Create the feature branch at the current commit: `git branch feature/stripe-webhooks`.',
      'Roll back local main to match remote origin: `git reset --hard origin/main`.',
      'Switch to the new branch: `git checkout feature/stripe-webhooks`.',
    ],
    optimalCommands: [
      'git branch feature/stripe-webhooks',
      'git reset --hard origin/main',
      'git checkout feature/stripe-webhooks',
    ],
    staffPostMortem:
      'In Git, branches are just 41-byte files containing a SHA. Creating a branch pointer at the current commit freezes your work in place, allowing you to reset `main` safely without losing a single line of code.',
    createInitialState: createScenario8State,
    verifyState: (repo: GitRepositoryState): AssertionResult[] => {
      const mainSha = repo.branches['main'];
      const featSha = repo.branches['feature/stripe-webhooks'];
      const mainRestored = mainSha === '800root';
      const featHasCommits = featSha === '802test';
      const onFeat = repo.head.type === 'branch' && repo.head.ref === 'feature/stripe-webhooks';
      const clean = isWorkingTreeClean(repo);

      return [
        {
          id: 'feat-branch-created',
          label: 'Branch feature/stripe-webhooks points to latest commit (802test)',
          description: 'Webhook verification commits preserved on feature branch.',
          passed: featHasCommits,
        },
        {
          id: 'main-reset-clean',
          label: 'Local branch main reset to match origin/main (800root)',
          description: 'Protected main branch is in sync with upstream.',
          passed: mainRestored,
        },
        {
          id: 'head-on-feature',
          label: 'HEAD is checked out on feature/stripe-webhooks',
          description: 'Active workspace switched to feature branch with clean tree.',
          passed: onFeat && clean,
        },
      ];
    },
    evaluateCI: (repo: GitRepositoryState): CIPipelineCheck[] => {
      const mainSha = repo.branches['main'];
      const ok = mainSha === '800root';
      return [
        {
          id: 'ci-main-protect',
          name: 'github / protected-branch-ruleset',
          targetRef: `refs/heads/main (${mainSha})`,
          status: ok ? 'passing' : 'failing',
          summary: ok ? 'main is in exact fast-forward sync with origin/main' : 'Local main has unpushed unauthorized direct commits',
          duration: '3s',
        },
      ];
    },
  },

  {
    id: 'botched-merge-revert-m1',
    number: 9,
    title: 'The Botched Merge Rollback on Production',
    subtitle: 'Revert a faulty merge commit on main by specifying mainline parent (-m 1) during an out-of-memory outage',
    difficulty: 'Senior / Staff',
    incidentTicker: 'SEV-1: Memory Leak Outage Caused by Merged Pull Request #402',
    focusedSkills: ['git revert -m 1 <merge-commit>', 'Merge Commit Topology', 'git push origin main'],
    jira: {
      key: 'INC-709',
      title: 'Emergency rollback of merge commit m402bad on production main via git revert -m 1',
      severity: 'SEV-1',
      service: 'worker-eventloop-service',
      acceptanceCriteria: [
        'Revert merge commit m402bad on branch main specifying mainline parent 1 (-m 1).',
        'Verify that src/worker/eventLoop.ts restores the stable worker code.',
        'Push the revert commit to origin/main.',
      ],
    },
    slackThread: [
      {
        id: 's9-1',
        sender: 'Datadog Metrics Alert',
        role: 'Automated Monitor',
        channel: '#incidents-war-room',
        timestamp: '08:30 PM',
        isAlert: true,
        text: 'CRITICAL: Worker OOM Kill! Node.js heap jumped from 200MB to 4GB within 8 minutes of deploying PR #402.',
      },
      {
        id: 's9-2',
        sender: 'Marcus Chen (Principal Architect)',
        role: 'Principal Engineer',
        channel: '#incidents-war-room',
        timestamp: '08:31 PM',
        text: 'Revert the merge commit `m402bad` right now on `main`. Running plain `git revert m402bad` will fail with `commit is a merge but no -m option was given` because Git doesn’t know which parent branch to keep. You MUST pass `-m 1` for the mainline parent!',
      },
    ],
    hints: [
      'Ensure you are on branch `main`: `git checkout main`.',
      'Run `git revert -m 1 m402bad`.',
      'Push the revert to production: `git push origin main`.',
    ],
    optimalCommands: [
      'git checkout main',
      'git revert -m 1 m402bad',
      'git push origin main',
    ],
    staffPostMortem:
      'A merge commit has two parents (parent 1 = mainline `main`, parent 2 = incoming feature branch). `git revert -m 1` instructs Git to invert the diff introduced by the feature branch relative to mainline, restoring production immediately.',
    createInitialState: createScenario9State,
    verifyState: (repo: GitRepositoryState): AssertionResult[] => {
      const mainSha = repo.branches['main'];
      const mainCommit = mainSha ? repo.commits[mainSha] : undefined;
      const reverted = Boolean(
        mainCommit &&
          mainCommit.parents[0] === 'm402bad' &&
          mainCommit.tree['src/worker/eventLoop.ts']?.includes('Worker healthy') &&
          !mainCommit.tree['src/worker/eventLoop.ts']?.includes('setInterval')
      );
      const pushed = Boolean(mainSha && repo.remote.branches['main'] === mainSha && reverted);

      return [
        {
          id: 'merge-reverted-m1',
          label: 'Merge commit m402bad reverted on main with -m 1',
          description: 'Memory leak buffer code removed; healthy event loop restored.',
          passed: reverted,
        },
        {
          id: 'revert-pushed-to-origin',
          label: 'Rollback commit is pushed to origin/main',
          description: 'Production deployment triggered with clean worker service.',
          passed: pushed,
        },
        {
          id: 'clean-worktree-s9',
          label: 'Working tree is clean',
          description: 'No uncommitted or conflicting files.',
          passed: isWorkingTreeClean(repo),
        },
      ];
    },
    evaluateCI: (repo: GitRepositoryState): CIPipelineCheck[] => {
      const remoteMain = repo.remote.branches['main'];
      const commit = remoteMain ? repo.commits[remoteMain] : undefined;
      const healthy = Boolean(commit?.tree['src/worker/eventLoop.ts']?.includes('Worker healthy'));

      return [
        {
          id: 'ci-worker-memory',
          name: 'memory-leak-stress-test / origin/main',
          targetRef: `origin/main (${remoteMain || 'none'})`,
          status: healthy ? 'passing' : 'failing',
          summary: healthy ? 'Worker heap stable under load (142MB / 512MB)' : 'FATAL: Unbounded Array buffer leak detected (OOM Kill in 10s)',
          duration: '8s',
        },
      ];
    },
  },

  {
    id: 'untracked-disaster-clean-pull',
    number: 10,
    title: 'The Untracked Disaster & Fast-Forward Sync',
    subtitle: 'Nuke rogue build artifacts with git clean -fd, discard dirty edits, and fast-forward pull urgent upstream commits',
    difficulty: 'Senior / Staff',
    incidentTicker: 'BLOCKED: Cannot Pull Urgent Security Fix Due to Rogue Untracked Files and Local Edits',
    focusedSkills: ['git clean -fd', 'git checkout -- .', 'git pull origin main'],
    jira: {
      key: 'SEC-882',
      title: 'Wipe untracked build trash and fast-forward sync with origin/main HTTP smuggling hotfix',
      severity: 'SEV-1',
      service: 'edge-gateway-proxy',
      acceptanceCriteria: [
        'Use git clean -fd to wipe untracked build artifacts (build.tmp, debug_trace.log, dist/core.o).',
        'Discard local uncommitted edits in src/entrypoint.ts via git checkout -- . (or git reset --hard).',
        'Fast-forward pull the HTTP smuggling patch from origin/main (h700hot).',
      ],
    },
    slackThread: [
      {
        id: 's10-1',
        sender: 'Elena Vance (Staff SRE)',
        role: 'Staff Engineer',
        channel: '#incidents-war-room',
        timestamp: '09:15 PM',
        isAlert: true,
        text: 'I just pushed commit `h700hot` to `origin/main` fixing an active HTTP request smuggling vulnerability! You need to sync your local environment immediately.',
      },
      {
        id: 's10-2',
        sender: 'You (On-Call Engineer)',
        role: 'SWE II',
        channel: '#incidents-war-room',
        timestamp: '09:16 PM',
        text: '`git pull` fails! A broken Makefile generated dozens of rogue `.tmp`, `.log`, and `.o` files, and someone touched `src/entrypoint.ts`. Git says: `error: The following untracked working tree files would be overwritten by merge`.',
      },
      {
        id: 's10-3',
        sender: 'Elena Vance (Staff SRE)',
        role: 'Staff Engineer',
        channel: '#incidents-war-room',
        timestamp: '09:17 PM',
        text: 'Run `git clean -fd` to delete all untracked files and directories forcefully, run `git checkout -- .` to discard local file edits, and then run `git pull origin main`.',
      },
    ],
    hints: [
      'Wipe untracked files: `git clean -fd`.',
      'Discard modified tracked files: `git checkout -- .` (or `git reset --hard`).',
      'Pull upstream hotfix: `git pull origin main`.',
    ],
    optimalCommands: [
      'git clean -fd',
      'git checkout -- .',
      'git pull origin main',
    ],
    staffPostMortem:
      '`git clean -fd` removes untracked files and untracked directories that are not under source control. Coupled with `git checkout -- .` or `git reset --hard`, you can instantly sanitize a contaminated working tree and fast-forward sync with upstream.',
    createInitialState: createScenario10State,
    verifyState: (repo: GitRepositoryState): AssertionResult[] => {
      const mainSha = repo.branches['main'];
      const isSyncedWithUpstream = mainSha === 'h700hot';
      const noRogueFiles =
        repo.workingTree['build.tmp'] === undefined &&
        repo.workingTree['debug_trace.log'] === undefined &&
        repo.workingTree['dist/core.o'] === undefined;
      const entrypointHasGuard = Boolean(
        repo.workingTree['src/entrypoint.ts']?.includes('smuggling_guard')
      );
      const clean = isWorkingTreeClean(repo);

      return [
        {
          id: 'rogue-artifacts-cleaned',
          label: 'Untracked build artifacts (build.tmp, debug_trace.log, dist/core.o) deleted',
          description: 'git clean -fd cleared all untracked files.',
          passed: noRogueFiles,
        },
        {
          id: 'synced-with-origin-main',
          label: 'Fast-forward pulled commit h700hot from origin/main',
          description: 'Local main is in exact sync with upstream security patch.',
          passed: isSyncedWithUpstream && entrypointHasGuard,
        },
        {
          id: 'clean-worktree-s10',
          label: 'Working tree and staging index are 100% clean',
          description: 'Ready for production deployment.',
          passed: clean && isSyncedWithUpstream,
        },
      ];
    },
    evaluateCI: (repo: GitRepositoryState): CIPipelineCheck[] => {
      const mainSha = repo.branches['main'];
      const hasSecurity = mainSha === 'h700hot';
      return [
        {
          id: 'ci-smuggling-check',
          name: 'http-smuggling-prober / local-main',
          targetRef: `main (${mainSha})`,
          status: hasSecurity ? 'passing' : 'failing',
          summary: hasSecurity ? 'Proxy enforces strict smuggling guard (0 vulnerabilities)' : 'FAIL: Proxy parser allows CL.TE / TE.CL desync attacks',
          duration: '6s',
        },
      ];
    },
  },

  {
    id: 'github-pr-lockfile-conflict',
    number: 11,
    title: 'GitHub PR Outdated Branch & Lockfile Conflict Hell',
    subtitle: 'Resolve merge conflicts with origin/main on package.json & stripeWebhook.ts to unblock GitHub PR',
    difficulty: 'Mid-Level',
    category: 'GitHub PR & Collaboration',
    incidentTicker: 'GitHub PR #482 Blocked: Branch has conflicts that must be resolved (package.json + code)',
    focusedSkills: ['git fetch origin', 'git rebase origin/main', 'CodeLens 3-way conflict resolution', 'git push --force-with-lease'],
    jira: {
      key: 'GH-482',
      title: 'Rebase feature/stripe-webhook onto origin/main and resolve dependency conflict',
      severity: 'SEV-2',
      service: 'billing-webhooks',
      acceptanceCriteria: [
        'Rebase or merge origin/main into feature/stripe-webhook.',
        'Resolve conflicts in package.json (keep both axios ^1.7.0 and stripe ^14.0.0).',
        'Resolve conflicts in src/billing/stripeWebhook.ts (keep both signature validation and telemetry).',
        'Push updated branch to origin with --force-with-lease to unblock GitHub PR merge.',
      ],
    },
    slackThread: [
      {
        id: 's11-1',
        sender: 'Marcus Chen (Principal Architect)',
        role: 'Principal Engineer',
        channel: '#github-prs',
        timestamp: '10:45 AM',
        isAlert: true,
        text: 'PR #482 is blocking the billing sprint deployment! The base branch origin/main moved forward with axios v1.7.0 and telemetry. GitHub says: "This branch has conflicts that must be resolved".',
      },
      {
        id: 's11-2',
        sender: 'You (On-Call Engineer)',
        role: 'SWE II',
        channel: '#github-prs',
        timestamp: '10:46 AM',
        text: 'Both package.json and src/billing/stripeWebhook.ts diverged. I will rebase on origin/main, resolve the conflict, verify tests pass, and update the PR.',
      },
      {
        id: 's11-3',
        sender: 'Marcus Chen (Principal Architect)',
        role: 'Principal Engineer',
        channel: '#github-prs',
        timestamp: '10:47 AM',
        text: 'Remember to push with --force-with-lease so you don’t accidentally clobber any teammate comments or commits on the PR branch!',
      },
    ],
    hints: [
      'Rebase onto upstream: `git rebase origin/main` (or `git merge origin/main`).',
      'Open package.json and src/billing/stripeWebhook.ts in the editor and click "Accept Both Changes" in the CodeLens bar.',
      'Stage resolved files: `git add package.json src/billing/stripeWebhook.ts`.',
      'Continue rebase: `git rebase --continue`.',
      'Update GitHub PR: `git push --force-with-lease origin feature/stripe-webhook`.',
    ],
    optimalCommands: [
      'git rebase origin/main',
      'git add package.json src/billing/stripeWebhook.ts',
      'git rebase --continue',
      'git push --force-with-lease origin feature/stripe-webhook',
    ],
    staffPostMortem:
      'When collaborating on GitHub, branches quickly fall behind the main trunk. When package.json or core services diverge, rebasing on origin/main produces a clean linear Git history, while --force-with-lease guarantees you do not overwrite unexpected commits pushed by other contributors.',
    createInitialState: createScenario11State,
    verifyState: (repo: GitRepositoryState): AssertionResult[] => {
      const branchSha = repo.branches['feature/stripe-webhook'];
      const hasUpstreamCommit = branchSha ? isAncestor(repo.commits, 'm200axios', branchSha) : false;
      const pkgContent = repo.workingTree['package.json'] || '';
      const hookContent = repo.workingTree['src/billing/stripeWebhook.ts'] || '';

      const hasBothDeps = pkgContent.includes('axios') && pkgContent.includes('1.7.0') && pkgContent.includes('stripe') && pkgContent.includes('14.0.0');
      const hasBothLogic = hookContent.includes('STRIPE_SIGNATURE_KEY') && hookContent.includes('TELEMETRY_ENABLED');
      const noConflict = !hasConflictMarkers(pkgContent) && !hasConflictMarkers(hookContent) && repo.conflictedFiles.length === 0;
      const remoteSynced = repo.remote.branches['feature/stripe-webhook'] === branchSha && branchSha !== undefined;
      const clean = isWorkingTreeClean(repo);

      return [
        {
          id: 'rebased-onto-upstream-main',
          label: 'Branch feature/stripe-webhook incorporates origin/main (m200axios)',
          description: 'Local PR branch is rebased or merged with upstream changes.',
          passed: hasUpstreamCommit,
        },
        {
          id: 'deps-and-code-merged',
          label: 'Both axios 1.7.0 & stripe 14.0.0 and telemetry + signature validation kept',
          description: 'Conflict resolved cleanly with zero lost features.',
          passed: hasBothDeps && hasBothLogic && noConflict,
        },
        {
          id: 'pr-pushed-with-lease',
          label: 'Pushed to origin/feature/stripe-webhook with --force-with-lease',
          description: 'GitHub PR branch successfully updated and conflict-free.',
          passed: remoteSynced && hasBothLogic,
        },
        {
          id: 'clean-worktree-s11',
          label: 'Working tree is clean with zero conflict markers',
          description: 'All conflict resolutions staged and committed.',
          passed: clean && remoteSynced,
        },
      ];
    },
    evaluateCI: (repo: GitRepositoryState): CIPipelineCheck[] => {
      const branchSha = repo.branches['feature/stripe-webhook'];
      const pkgContent = repo.workingTree['package.json'] || '';
      const hookContent = repo.workingTree['src/billing/stripeWebhook.ts'] || '';
      const pass = Boolean(
        branchSha &&
          isAncestor(repo.commits, 'm200axios', branchSha) &&
          pkgContent.includes('1.7.0') &&
          pkgContent.includes('stripe') &&
          hookContent.includes('STRIPE_SIGNATURE_KEY') &&
          !hasConflictMarkers(pkgContent)
      );

      return [
        {
          id: 'ci-pr-conflict-check',
          name: 'github / pr-mergeability-prober',
          targetRef: `feature/stripe-webhook (${branchSha || 'missing'})`,
          status: pass ? 'passing' : 'failing',
          summary: pass
            ? 'PR #482 mergeable (0 conflicts detected, telemetry & signature suites pass)'
            : 'FAIL: PR branch conflicts with base branch refs/heads/main',
          duration: '8s',
        },
      ];
    },
  },

  {
    id: 'github-push-rejected-large-file',
    number: 12,
    title: 'GitHub Push Blocked: 100MB Binary Asset & GH001 Error',
    subtitle: 'Rescue a blocked branch rejected by GitHub pre-receive hook without leaving blobs in history',
    difficulty: 'Junior',
    category: 'Security & Secrets',
    incidentTicker: 'remote: error: GH001: Large files detected (models/weights_v1.bin is 142MB > 100MB)',
    focusedSkills: ['git reset --soft HEAD~1', 'rm models/weights_v1.bin', 'git commit', 'git push'],
    jira: {
      key: 'GH-1090',
      title: 'Purge 142MB models/weights_v1.bin from git commit history before pushing to GitHub',
      severity: 'SEV-2',
      service: 'ai-customer-enrichment',
      acceptanceCriteria: [
        'Undo commit e990blob using git reset --soft HEAD~1 so working tree changes remain intact.',
        'Remove models/weights_v1.bin from the workspace completely.',
        'Commit only the legitimate src/ai/enrichment.ts code.',
        'Push feature/ai-enrichment to origin cleanly without triggering GH001.',
      ],
    },
    slackThread: [
      {
        id: 's12-1',
        sender: 'Elena Vance (Staff SRE)',
        role: 'Staff Engineer',
        channel: '#incidents-war-room',
        timestamp: '02:10 PM',
        isAlert: true,
        text: 'Your git push to GitHub was rejected by hook pre-receive! You committed a 142MB binary file `models/weights_v1.bin`. GitHub blocks commits > 100MB.',
      },
      {
        id: 's12-2',
        sender: 'You (On-Call Engineer)',
        role: 'SWE II',
        channel: '#incidents-war-room',
        timestamp: '02:11 PM',
        text: 'Can I just run `git rm models/weights_v1.bin` and commit a deletion?',
      },
      {
        id: 's12-3',
        sender: 'Elena Vance (Staff SRE)',
        role: 'Staff Engineer',
        channel: '#incidents-war-room',
        timestamp: '02:12 PM',
        text: 'NO! That is the classic beginner trap. If you commit a deletion, the 142MB blob still remains permanently inside the parent commit in Git history! Use `git reset --soft HEAD~1`, delete the binary with `rm models/weights_v1.bin`, and recommit.',
      },
    ],
    hints: [
      'Rewind HEAD while preserving uncommitted work in the index: `git reset --soft HEAD~1`.',
      'Delete the heavy binary asset: `rm models/weights_v1.bin` (or `git rm models/weights_v1.bin`).',
      'Commit only the clean source files: `git commit -m "feat(ai): add customer vector enrichment pipeline"`.',
      'Push cleanly to GitHub: `git push origin feature/ai-enrichment`.',
    ],
    optimalCommands: [
      'git reset --soft HEAD~1',
      'rm models/weights_v1.bin',
      'git commit -m "feat(ai): add customer enrichment pipeline"',
      'git push origin feature/ai-enrichment',
    ],
    staffPostMortem:
      'Git is an immutable snapshot database. If you commit a 100MB+ binary file and subsequent commits delete it, the object remains in packfiles forever, causing GitHub push rejections. Using "git reset --soft HEAD~1" rewinds the branch pointer while preserving your working code, allowing you to unstage or remove the offending file before creating a clean commit.',
    createInitialState: createScenario12State,
    verifyState: (repo: GitRepositoryState): AssertionResult[] => {
      const branchSha = repo.branches['feature/ai-enrichment'];
      const commit = branchSha ? repo.commits[branchSha] : undefined;

      const noBinaryInHead = commit?.tree['models/weights_v1.bin'] === undefined;
      const noBinaryInTree = repo.workingTree['models/weights_v1.bin'] === undefined;
      const codePreserved = Boolean(commit?.tree['src/ai/enrichment.ts']?.includes('enrichCustomer'));
      const pushedToOrigin = repo.remote.branches['feature/ai-enrichment'] === branchSha && branchSha !== undefined && branchSha !== 'e990blob';
      const clean = isWorkingTreeClean(repo);

      return [
        {
          id: 'binary-purged-from-history',
          label: 'Heavy 142MB model weights binary removed from commit tree & workspace',
          description: 'No 100MB+ binary blob remains in the commit snapshot.',
          passed: noBinaryInHead && noBinaryInTree,
        },
        {
          id: 'enrichment-code-intact',
          label: 'Customer vector enrichment code (src/ai/enrichment.ts) preserved',
          description: 'Legitimate feature code committed cleanly.',
          passed: codePreserved,
        },
        {
          id: 'clean-push-to-origin',
          label: 'Branch feature/ai-enrichment pushed successfully to origin',
          description: 'Passed GitHub pre-receive file size hooks.',
          passed: pushedToOrigin,
        },
        {
          id: 'clean-worktree-s12',
          label: 'Working tree and staging index are 100% clean',
          description: 'No leftover uncommitted artifacts.',
          passed: clean && pushedToOrigin,
        },
      ];
    },
    evaluateCI: (repo: GitRepositoryState): CIPipelineCheck[] => {
      const branchSha = repo.branches['feature/ai-enrichment'];
      const commit = branchSha ? repo.commits[branchSha] : undefined;
      const valid = Boolean(
        commit &&
          commit.tree['models/weights_v1.bin'] === undefined &&
          commit.tree['src/ai/enrichment.ts']?.includes('enrichCustomer') &&
          repo.remote.branches['feature/ai-enrichment'] === branchSha
      );

      return [
        {
          id: 'ci-github-quota-check',
          name: 'github / pre-receive-quota-guard',
          targetRef: `feature/ai-enrichment (${branchSha || 'missing'})`,
          status: valid ? 'passing' : 'failing',
          summary: valid
            ? 'GitHub File Size Guard passed (Max file size: 1.2 KB / 100 MB quota)'
            : 'FAIL: GH001 Large files detected in commit tree',
          duration: '5s',
        },
      ];
    },
  },

  {
    id: 'github-fork-upstream-sync',
    number: 13,
    title: 'Fork & Upstream Sync Desync (Open Source Contribution)',
    subtitle: 'Rebase open-source PR branch against upstream breaking API change without messy merge commits',
    difficulty: 'Senior / Staff',
    category: 'GitHub PR & Collaboration',
    incidentTicker: 'GitHub PR #129 Diverged: Upstream breaking refactor in authenticateRequest signature',
    focusedSkills: ['git fetch origin', 'git rebase main', 'git add', 'git rebase --continue', 'git push --force-with-lease'],
    jira: {
      key: 'OSS-771',
      title: 'Rebase feature/auth-tracing onto upstream/main and adapt to TraceContext signature',
      severity: 'SEV-2',
      service: 'open-gateway',
      acceptanceCriteria: [
        'Rebase feature/auth-tracing onto main (which has upstream commit u900ctx).',
        'Resolve signature conflict in src/middleware/context.ts so authenticateRequest accepts TraceContext.',
        'Preserve durationMs metrics recording from feature branch.',
        'Push updated branch to origin fork with --force-with-lease.',
      ],
    },
    slackThread: [
      {
        id: 's13-1',
        sender: 'OSS Maintainer (Alex Rivera)',
        role: 'Core Maintainer',
        channel: '#open-source-prs',
        timestamp: '03:30 PM',
        isAlert: true,
        text: 'Hey contributor! Thanks for PR #129. We just merged PR #120 upstream which changed authenticateRequest(req) to authenticateRequest(req, ctx: TraceContext). Please rebase on main, update your metrics logic to accept ctx, and force-push with lease!',
      },
      {
        id: 's13-2',
        sender: 'You (Contributor)',
        role: 'OSS Contributor',
        channel: '#open-source-prs',
        timestamp: '03:32 PM',
        text: 'Got it! I will rebase my feature branch on main, merge the TraceContext argument with the latency span timer, and force-push.',
      },
    ],
    hints: [
      'Start rebase on updated main: `git rebase main`.',
      'Open src/middleware/context.ts and resolve the conflict: keep `ctx: TraceContext` and include `durationMs` metrics.',
      'Stage resolved file: `git add src/middleware/context.ts`.',
      'Continue rebase: `git rebase --continue`.',
      'Push with lease to fork: `git push --force-with-lease origin feature/auth-tracing`.',
    ],
    optimalCommands: [
      'git rebase main',
      'git add src/middleware/context.ts',
      'git rebase --continue',
      'git push --force-with-lease origin feature/auth-tracing',
    ],
    staffPostMortem:
      'In open-source workflows, maintainers reject PRs with redundant "Merge branch main into feature" merge bubbles. Rebasing onto upstream/main keeps project history immaculate, clean, and bisectable.',
    createInitialState: createScenario13State,
    verifyState: (repo: GitRepositoryState): AssertionResult[] => {
      const branchSha = repo.branches['feature/auth-tracing'];
      const hasUpstream = branchSha ? isAncestor(repo.commits, 'u900ctx', branchSha) : false;
      const fileContent = repo.workingTree['src/middleware/context.ts'] || '';

      const hasTraceCtx = fileContent.includes('TraceContext') && fileContent.includes('ctx.traceId');
      const hasMetrics = fileContent.includes('durationMs') || fileContent.includes('Date.now()');
      const noConflict = !hasConflictMarkers(fileContent) && repo.conflictedFiles.length === 0;
      const pushed = repo.remote.branches['feature/auth-tracing'] === branchSha && branchSha !== undefined && branchSha !== 't300trace';
      const clean = isWorkingTreeClean(repo);

      return [
        {
          id: 'rebased-onto-upstream-ctx',
          label: 'Branch feature/auth-tracing rebased cleanly on top of upstream commit u900ctx',
          description: 'Linear commit graph parented by latest upstream main.',
          passed: hasUpstream,
        },
        {
          id: 'trace-and-metrics-adapted',
          label: 'Signature adapted to TraceContext while preserving latency metrics',
          description: 'src/middleware/context.ts satisfies both upstream and feature requirements.',
          passed: hasTraceCtx && hasMetrics && noConflict,
        },
        {
          id: 'pushed-with-lease-s13',
          label: 'Pushed to origin fork with --force-with-lease',
          description: 'Remote fork branch synchronized safely.',
          passed: pushed,
        },
        {
          id: 'clean-worktree-s13',
          label: 'Working tree is clean with zero conflict markers',
          description: 'All rebase conflicts resolved and committed.',
          passed: clean && pushed,
        },
      ];
    },
    evaluateCI: (repo: GitRepositoryState): CIPipelineCheck[] => {
      const branchSha = repo.branches['feature/auth-tracing'];
      const fileContent = repo.workingTree['src/middleware/context.ts'] || '';
      const pass = Boolean(
        branchSha &&
          isAncestor(repo.commits, 'u900ctx', branchSha) &&
          fileContent.includes('TraceContext') &&
          fileContent.includes('durationMs') &&
          !hasConflictMarkers(fileContent)
      );

      return [
        {
          id: 'ci-upstream-integration',
          name: 'oss-gateway / context-metrics-suite',
          targetRef: `feature/auth-tracing (${branchSha || 'missing'})`,
          status: pass ? 'passing' : 'failing',
          summary: pass
            ? 'All OpenTelemetry context and latency benchmarks pass'
            : 'FAIL: authenticateRequest missing TraceContext or broken by merge conflict',
          duration: '10s',
        },
      ];
    },
  },

  {
    id: 'github-backport-security-cve',
    number: 14,
    title: 'GitHub Security Advisory Backport to Enterprise LTS Branch',
    subtitle: 'Safely backport high-severity CVE-2026-8819 patch to lts/v1.8.x without shipping v2.0 breaking changes',
    difficulty: 'Senior / Staff',
    category: 'Release & Tags',
    incidentTicker: 'CRITICAL: CVE-2026-8819 Wildcard Token Forgery on Enterprise LTS v1.8 (SEV-1)',
    focusedSkills: ['git checkout lts/v1.8.x', 'git cherry-pick sec8819', 'git tag v1.8.4', 'git push origin lts/v1.8.x', 'git push origin v1.8.4'],
    jira: {
      key: 'SEC-9941',
      title: 'Backport CVE-2026-8819 patch (sec8819) to lts/v1.8.x and tag v1.8.4',
      severity: 'SEV-1',
      service: 'identity-auth-service',
      acceptanceCriteria: [
        'Switch to branch lts/v1.8.x.',
        'Cherry-pick commit sec8819 from main.',
        'Ensure NONE of the v2.0 unstable commits (v200un1) are present on lts/v1.8.x.',
        'Tag the patched commit as v1.8.4.',
        'Push both lts/v1.8.x and tag v1.8.4 to origin.',
      ],
    },
    slackThread: [
      {
        id: 's14-1',
        sender: 'Elena Vance (Security Incident Lead)',
        role: 'Staff Security Engineer',
        channel: '#security-emergency',
        timestamp: '11:15 PM',
        isAlert: true,
        text: 'SEV-1 Security Advisory! A wildcard token forgery vulnerability (CVE-2026-8819) was disclosed. It was patched on main in commit sec8819. But 40 enterprise customers are running lts/v1.8.x!',
      },
      {
        id: 's14-2',
        sender: 'Elena Vance (Security Incident Lead)',
        role: 'Staff Security Engineer',
        channel: '#security-emergency',
        timestamp: '11:16 PM',
        text: 'DO NOT merge main into LTS—that would accidentally ship unstable v2.0 breaking refactors! Checkout lts/v1.8.x, cherry-pick sec8819, tag v1.8.4, and push both to origin.',
      },
    ],
    hints: [
      'Switch to LTS branch: `git checkout lts/v1.8.x`.',
      'Cherry-pick the security patch: `git cherry-pick sec8819`.',
      'Create release tag: `git tag v1.8.4`.',
      'Push branch to origin: `git push origin lts/v1.8.x`.',
      'Push tag to origin: `git push origin v1.8.4`.',
    ],
    optimalCommands: [
      'git checkout lts/v1.8.x',
      'git cherry-pick sec8819',
      'git tag v1.8.4',
      'git push origin lts/v1.8.x',
      'git push origin v1.8.4',
    ],
    staffPostMortem:
      'Backporting security patches to maintenance/LTS branches is a critical Staff Engineer responsibility. A naive merge from main would inadvertently ship breaking, unreleased code to production enterprise customers. Cherry-picking isolates the vulnerability patch cleanly and enables rapid, zero-risk tag releases.',
    createInitialState: createScenario14State,
    verifyState: (repo: GitRepositoryState): AssertionResult[] => {
      const ltsSha = repo.branches['lts/v1.8.x'];
      const commit = ltsSha ? repo.commits[ltsSha] : undefined;

      const hasSecPatch = Boolean(
        commit?.tree['src/auth/tokenValidator.ts']?.includes('if (!issuer || issuer === "*"')
      );
      const noUnstableV2 = ltsSha ? !isAncestor(repo.commits, 'v200un1', ltsSha) : true;
      const tagSha = repo.tags['v1.8.4'];
      const tagMatches = tagSha === ltsSha && ltsSha !== undefined;
      const branchPushed = repo.remote.branches['lts/v1.8.x'] === ltsSha && ltsSha !== 'lts1830';
      const tagPushed = repo.remote.tags['v1.8.4'] === ltsSha;
      const clean = isWorkingTreeClean(repo);

      return [
        {
          id: 'lts-security-patched',
          label: 'Branch lts/v1.8.x contains CVE-2026-8819 cryptographic validation patch',
          description: 'tokenValidator.ts rejects wildcard and invalid issuers.',
          passed: hasSecPatch,
        },
        {
          id: 'no-v2-pollution',
          label: 'LTS branch is 100% free of breaking v2.0 commits (v200un1)',
          description: 'Enterprise production stability preserved.',
          passed: noUnstableV2,
        },
        {
          id: 'tag-v184-created-pushed',
          label: 'Release tag v1.8.4 created and pushed to origin',
          description: 'Ready for enterprise customer artifact pull.',
          passed: tagMatches && tagPushed,
        },
        {
          id: 'lts-branch-pushed',
          label: 'Branch lts/v1.8.x pushed cleanly to origin',
          description: 'Remote enterprise branch synchronized.',
          passed: branchPushed && clean,
        },
      ];
    },
    evaluateCI: (repo: GitRepositoryState): CIPipelineCheck[] => {
      const ltsSha = repo.branches['lts/v1.8.x'];
      const commit = ltsSha ? repo.commits[ltsSha] : undefined;
      const pass = Boolean(
        commit &&
          commit.tree['src/auth/tokenValidator.ts']?.includes('if (!issuer || issuer === "*"') &&
          !isAncestor(repo.commits, 'v200un1', ltsSha) &&
          repo.remote.tags['v1.8.4'] === ltsSha
      );

      return [
        {
          id: 'ci-enterprise-lts-security',
          name: 'cve-scanner / tag:v1.8.4',
          targetRef: repo.remote.tags['v1.8.4'] ? `v1.8.4 (${repo.remote.tags['v1.8.4']})` : 'v1.8.4 (missing)',
          status: pass ? 'passing' : 'failing',
          summary: pass
            ? '0 CVE vulnerabilities detected on LTS v1.8.4 (LTS enterprise compatibility verified)'
            : 'FAIL: CVE-2026-8819 wildcard bypass vulnerable or tag v1.8.4 missing on origin',
          duration: '12s',
        },
      ];
    },
  },
];

