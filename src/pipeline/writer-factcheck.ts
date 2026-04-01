import type {
  WriterFactCheckBudget,
  WriterFactCheckEntry,
  WriterFactCheckMode,
  WriterFactCheckReport,
  WriterFactCheckPolicy,
  WriterFactCheckSourceClass,
  WriterFactCheckUsage,
} from '../types.js';
import { dataSourceName } from './league-helpers.js';

export const WRITER_FACTCHECK_ARTIFACT_NAME = 'writer-factcheck.md' as const;
export const WRITER_FACTCHECK_SKILL_NAME = 'writer-fact-check' as const;

function localRuntimeSourceLabel(league: string): string {
  switch (league) {
    case 'mlb': return 'Local/runtime artifacts + Statcast helpers';
    case 'nba': return 'Local/runtime artifacts + NBA.com helpers';
    default: return 'Local/runtime artifacts + nflverse helpers';
  }
}

function getSourceLabels(league: string): Record<WriterFactCheckSourceClass, string> {
  return {
    local_runtime: localRuntimeSourceLabel(league),
    official_primary: 'Official primary sources',
    trusted_reference: 'Trusted reference sources',
  };
}

export const WRITER_FACTCHECK_POLICY: WriterFactCheckPolicy = {
  artifactName: WRITER_FACTCHECK_ARTIFACT_NAME,
  riskyClaimsOnly: true,
  rawWebSearchAllowed: false,
  editorRemainsFinalAuthority: true,
  volatileFactsRule: 'attribute_soften_or_omit',
  approvedSourceOrder: ['local_runtime', 'official_primary', 'trusted_reference'],
  freshDraft: {
    localDeterministicPasses: 1,
    externalChecks: 3,
    wallClockMinutes: 5,
  },
  revision: {
    localDeterministicPasses: 1,
    externalChecks: 1,
    wallClockMinutes: 5,
  },
};

const WRITER_FACTCHECK_LOCAL_ARTIFACTS = [
  'discussion-summary.md',
  'panel-factcheck.md',
  'roster-context.md',
  'fact-check-context.md',
] as const;

const DEFAULT_APPROVED_SOURCE_TIMEOUT_MS = 4_000;
const OFFICIAL_TEAM_PRIMARY_HOSTS = new Set([
  '49ers.com',
  'atlantafalcons.com',
  'baltimoreravens.com',
  'bengals.com',
  'buffalobills.com',
  'buccaneers.com',
  'azcardinals.com',
  'chargers.com',
  'chiefs.com',
  'chicagobears.com',
  'clevelandbrowns.com',
  'colts.com',
  'commanders.com',
  'dallascowboys.com',
  'denverbroncos.com',
  'detroitlions.com',
  'giants.com',
  'houstontexans.com',
  'jaguars.com',
  'miamidolphins.com',
  'neworleanssaints.com',
  'newyorkjets.com',
  'packers.com',
  'panthers.com',
  'patriots.com',
  'philadelphiaeagles.com',
  'raiders.com',
  'seahawks.com',
  'steelers.com',
  'titansonline.com',
  'therams.com',
  'vikings.com',
]);

function normalizeApprovedHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '');
}

function matchesApprovedHost(hostname: string, approvedHosts: Set<string>): boolean {
  for (const approvedHost of approvedHosts) {
    if (hostname === approvedHost || hostname.endsWith(`.${approvedHost}`)) {
      return true;
    }
  }
  return false;
}

interface ApprovedSourceRule {
  sourceClass: Exclude<WriterFactCheckSourceClass, 'local_runtime'>;
  label: string;
  matches: (hostname: string) => boolean;
}

const COMMON_APPROVED_SOURCE_RULES: ApprovedSourceRule[] = [
  {
    sourceClass: 'trusted_reference',
    label: 'Spotrac',
    matches: hostname => hostname === 'spotrac.com' || hostname.endsWith('.spotrac.com'),
  },
  {
    sourceClass: 'trusted_reference',
    label: 'ESPN',
    matches: hostname => hostname === 'espn.com' || hostname.endsWith('.espn.com'),
  },
];

function getLeagueApprovedSourceRules(league: string): ApprovedSourceRule[] {
  switch (league) {
    case 'mlb':
      return [
        ...COMMON_APPROVED_SOURCE_RULES,
        {
          sourceClass: 'official_primary',
          label: 'Official MLB source',
          matches: h => h === 'mlb.com' || h.endsWith('.mlb.com')
            || h === 'baseballsavant.mlb.com' || h === 'fangraphs.com' || h.endsWith('.fangraphs.com'),
        },
        {
          sourceClass: 'trusted_reference',
          label: 'Baseball Reference',
          matches: h => h === 'baseball-reference.com' || h.endsWith('.baseball-reference.com'),
        },
      ];
    case 'nba':
      return [
        ...COMMON_APPROVED_SOURCE_RULES,
        {
          sourceClass: 'official_primary',
          label: 'Official NBA source',
          matches: h => h === 'nba.com' || h.endsWith('.nba.com'),
        },
        {
          sourceClass: 'trusted_reference',
          label: 'Basketball Reference',
          matches: h => h === 'basketball-reference.com' || h.endsWith('.basketball-reference.com'),
        },
      ];
    default:
      return [
        ...COMMON_APPROVED_SOURCE_RULES,
        {
          sourceClass: 'official_primary',
          label: 'Official NFL source',
          matches: hostname => hostname === 'nfl.com' || hostname.endsWith('.nfl.com'),
        },
        {
          sourceClass: 'official_primary',
          label: 'Official team source',
          matches: hostname => matchesApprovedHost(hostname, OFFICIAL_TEAM_PRIMARY_HOSTS),
        },
        {
          sourceClass: 'trusted_reference',
          label: 'OverTheCap',
          matches: hostname => hostname === 'overthecap.com' || hostname.endsWith('.overthecap.com'),
        },
        {
          sourceClass: 'trusted_reference',
          label: 'Pro Football Reference',
          matches: hostname =>
            hostname === 'pro-football-reference.com' || hostname.endsWith('.pro-football-reference.com'),
        },
      ];
  }
}

export interface ApprovedSourceCandidate {
  url: string;
  domain: string;
  sourceClass: Exclude<WriterFactCheckSourceClass, 'local_runtime'>;
  sourceLabel: string;
}

export interface ApprovedSourceFetchResult {
  ok: boolean;
  candidate: ApprovedSourceCandidate | null;
  httpStatus: number | null;
  title: string | null;
  contentType: string | null;
  asOf: string;
  error: string | null;
  attemptedFetch: boolean;
  wallClockLimited: boolean;
}

export interface WriterFactCheckUrlEvidence {
  url: string;
  claim: string;
  artifactName: string;
}

export interface ExecuteWriterFactCheckPassOptions {
  articleTitle: string;
  mode: WriterFactCheckMode;
  availableArtifacts: string[];
  existingArtifact?: string | null;
  factCheckContext?: string | null;
  contractClaims?: string[];
  urlEvidence?: WriterFactCheckUrlEvidence[];
  league?: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

function getBudgetForMode(mode: WriterFactCheckMode): WriterFactCheckBudget {
  return mode === 'revision'
    ? WRITER_FACTCHECK_POLICY.revision
    : WRITER_FACTCHECK_POLICY.freshDraft;
}

function formatMode(mode: WriterFactCheckMode): string {
  return mode === 'revision' ? 'Revision' : 'Fresh draft';
}

function formatDurationMinutes(ms: number): string {
  return (ms / 60_000).toFixed(2).replace(/\.00$/, '');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatEntry(entry: WriterFactCheckEntry): string {
  const details: string[] = [];
  if (entry.sourceClass) {
    details.push(`source class: \`${entry.sourceClass}\``);
  }
  if (entry.sourceLabel) {
    details.push(`source: ${entry.sourceLabel}`);
  }
  if (entry.domain) {
    details.push(`domain: \`${entry.domain}\``);
  }
  if (entry.sourceUrl) {
    details.push(`url: ${entry.sourceUrl}`);
  }
  if (entry.asOf) {
    details.push(`as of: ${entry.asOf}`);
  }
  if (entry.proseTreatment) {
    details.push(`prose: ${entry.proseTreatment}`);
  }
  if (entry.note) {
    details.push(`note: ${entry.note}`);
  }
  return `- ${entry.claim}${details.length > 0 ? ` — ${details.join('; ')}` : ''}`;
}

function formatEntries(entries: WriterFactCheckEntry[], fallback: string): string {
  return entries.length > 0 ? entries.map(formatEntry).join('\n') : fallback;
}

function readSection(markdown: string | null | undefined, heading: string): string | null {
  if (!markdown) return null;
  const escapedHeading = escapeRegExp(heading);
  const match = markdown.match(new RegExp(`## ${escapedHeading}\\r?\\n([\\s\\S]*?)(?=\\r?\\n## |$)`));
  const body = match?.[1]?.trim();
  return body ? body : null;
}

function getArtifactPatterns(league: string) {
  const sourceName = dataSourceName(league);
  return {
    verified: new RegExp(`\\*\\*${escapeRegExp(sourceName)} data\\*\\*\\s*\\(([^)]+)\\):`),
    missing: new RegExp(`\\*No data found in ${escapeRegExp(sourceName)} \\(([^)]+)\\)\\*`),
  };
}

function buildLocalRuntimeEntries(factCheckContext: string | null | undefined, league: string = 'nfl'): Pick<WriterFactCheckReport, 'verifiedFacts' | 'omittedClaims'> {
  if (!factCheckContext) {
    return { verifiedFacts: [], omittedClaims: [] };
  }

  const sourceName = dataSourceName(league);
  const patterns = getArtifactPatterns(league);
  const verifiedFacts: WriterFactCheckEntry[] = [];
  const omittedClaims: WriterFactCheckEntry[] = [];
  const claimBlocks = factCheckContext.split(/\r?\n\*\*Claim:\*\*\s*/).slice(1);

  for (const block of claimBlocks) {
    const trimmedBlock = block.trim();
    if (!trimmedBlock) continue;
    const [claimLine] = trimmedBlock.split(/\r?\n/, 1);
    const claim = claimLine.trim();
    const verifiedMatch = trimmedBlock.match(patterns.verified);
    const missingMatch = trimmedBlock.match(patterns.missing);

    if (verifiedMatch) {
      verifiedFacts.push({
        claim,
        status: 'verified',
        sourceClass: 'local_runtime',
        sourceLabel: `${sourceName} helper (${verifiedMatch[1]})`,
        sourceUrl: null,
        domain: null,
        note: 'Resolved in local deterministic fact-check context.',
        proseTreatment: 'Plain factual prose is acceptable if the draft matches the retrieved data.',
        asOf: null,
      });
      continue;
    }

    if (missingMatch) {
      omittedClaims.push({
        claim,
        status: 'omitted',
        sourceClass: 'local_runtime',
        sourceLabel: `${sourceName} helper (${missingMatch[1]})`,
        sourceUrl: null,
        domain: null,
        note: 'No local deterministic data was returned for this claim.',
        proseTreatment: 'Soften, omit, or leave for Editor.',
        asOf: null,
      });
    }
  }

  return { verifiedFacts, omittedClaims };
}

function buildContractEntries(contractClaims: string[]): WriterFactCheckEntry[] {
  return contractClaims.map((claim) => ({
    claim,
    status: 'omitted',
    sourceClass: null,
    sourceLabel: null,
    sourceUrl: null,
    domain: null,
    note: 'No deterministic contract helper exists in this slice; requires an approved external source or Editor review.',
    proseTreatment: 'Attribute cautiously, avoid false precision, or omit.',
    asOf: null,
  }));
}

function extractHtmlTitle(body: string): string | null {
  const match = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1]?.replace(/\s+/g, ' ').trim() || null;
}

export function resolveApprovedSource(url: string, league: string = 'nfl'): ApprovedSourceCandidate | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }

  const hostname = normalizeApprovedHostname(parsed.hostname);
  const rules = getLeagueApprovedSourceRules(league);
  const rule = rules.find(candidate => candidate.matches(hostname));
  if (!rule) return null;

  return {
    url: parsed.toString(),
    domain: hostname,
    sourceClass: rule.sourceClass,
    sourceLabel: rule.label,
  };
}

export async function fetchApprovedSource(
  url: string,
  options: {
    league?: string;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
    remainingWallClockMs?: number;
    now?: () => Date;
  } = {},
): Promise<ApprovedSourceFetchResult> {
  const candidate = resolveApprovedSource(url, options.league ?? 'nfl');
  const now = options.now ?? (() => new Date());
  const asOf = now().toISOString().slice(0, 10);

  if (!candidate) {
    return {
      ok: false,
      candidate: null,
      httpStatus: null,
      title: null,
      contentType: null,
      asOf,
      error: 'blocked_domain',
      attemptedFetch: false,
      wallClockLimited: false,
    };
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    return {
      ok: false,
      candidate,
      httpStatus: null,
      title: null,
      contentType: null,
      asOf,
      error: 'fetch_unavailable',
      attemptedFetch: false,
      wallClockLimited: false,
    };
  }

  const requestedTimeoutMs = options.timeoutMs ?? DEFAULT_APPROVED_SOURCE_TIMEOUT_MS;
  const remainingWallClockMs = options.remainingWallClockMs;
  if (remainingWallClockMs !== undefined && remainingWallClockMs <= 0) {
    return {
      ok: false,
      candidate,
      httpStatus: null,
      title: null,
      contentType: null,
      asOf,
      error: 'wall_clock_exhausted',
      attemptedFetch: false,
      wallClockLimited: true,
    };
  }

  const timeoutMs = requestedTimeoutMs;
  const wallClockSignal = remainingWallClockMs === undefined
    ? null
    : AbortSignal.timeout(Math.max(1, remainingWallClockMs));
  const signal = wallClockSignal
    ? AbortSignal.any([AbortSignal.timeout(timeoutMs), wallClockSignal])
    : AbortSignal.timeout(timeoutMs);

  try {
    const response = await fetchImpl(candidate.url, {
      signal,
    });
    const body = await response.text();
    const title = extractHtmlTitle(body);
    const contentType = response.headers.get('content-type');

    if (!response.ok) {
      return {
        ok: false,
        candidate,
        httpStatus: response.status,
        title,
        contentType,
        asOf,
        error: `http_${response.status}`,
        attemptedFetch: true,
        wallClockLimited: false,
      };
    }

    return {
      ok: true,
      candidate,
      httpStatus: response.status,
      title,
      contentType,
      asOf,
      error: null,
      attemptedFetch: true,
      wallClockLimited: false,
    };
  } catch (error) {
    const errorName = error instanceof Error ? error.name : null;
    const wallClockLimited = wallClockSignal?.aborted ?? false;
    return {
      ok: false,
      candidate,
      httpStatus: null,
      title: null,
      contentType: null,
      asOf,
      error: wallClockLimited
        ? 'wall_clock_exhausted'
        : errorName === 'TimeoutError' || errorName === 'AbortError'
        ? 'timeout'
        : 'fetch_error',
      attemptedFetch: true,
      wallClockLimited,
    };
  }
}

export function extractUrlEvidence(artifacts: Array<{ name: string; content: string | null | undefined }>): WriterFactCheckUrlEvidence[] {
  const seen = new Set<string>();
  const evidence: WriterFactCheckUrlEvidence[] = [];

  for (const artifact of artifacts) {
    if (!artifact.content) continue;
    for (const line of artifact.content.split(/\r?\n/)) {
      const matches = line.match(/https?:\/\/[^\s)>\]]+/g);
      if (!matches) continue;
      const claim = line.replace(/https?:\/\/[^\s)>\]]+/g, '').replace(/[`*_]/g, '').trim() || `Referenced source in ${artifact.name}`;
      for (const rawUrl of matches) {
        const normalizedUrl = rawUrl.replace(/[.,;:]+$/, '');
        const key = `${artifact.name}:${normalizedUrl}`;
        if (seen.has(key)) continue;
        seen.add(key);
        evidence.push({
          url: normalizedUrl,
          claim,
          artifactName: artifact.name,
        });
      }
    }
  }

  return evidence;
}

export async function executeWriterFactCheckPass(
  options: ExecuteWriterFactCheckPassOptions,
): Promise<WriterFactCheckReport> {
  const league = options.league ?? 'nfl';
  const now = options.now ?? (() => new Date());
  const startedAt = now().getTime();
  const budget = getBudgetForMode(options.mode);
  const wallClockBudgetMs = budget.wallClockMinutes * 60_000;
  const verifiedFacts: WriterFactCheckEntry[] = [];
  const attributedFacts: WriterFactCheckEntry[] = [];
  const omittedClaims: WriterFactCheckEntry[] = [];
  const domainsTouched = new Set<string>();
  let localDeterministicPassesUsed = 0;
  let externalChecksUsed = 0;
  let blockedSourceCount = 0;
  let fetchFailureCount = 0;

  const localEntries = buildLocalRuntimeEntries(options.factCheckContext, league);
  if (localEntries.verifiedFacts.length > 0 || localEntries.omittedClaims.length > 0) {
    localDeterministicPassesUsed = 1;
    verifiedFacts.push(...localEntries.verifiedFacts);
    omittedClaims.push(...localEntries.omittedClaims);
  }

  if (options.contractClaims && options.contractClaims.length > 0) {
    const contractEntries = buildContractEntries(options.contractClaims);
    if (contractEntries.length > 0) {
      localDeterministicPassesUsed = 1;
      omittedClaims.push(...contractEntries);
    }
  }

  const urlEvidence = options.urlEvidence ?? [];
  let timeBudgetHit = false;
  for (const evidence of urlEvidence) {
    const resolved = resolveApprovedSource(evidence.url, league);
    if (!resolved) {
      let domain: string | null = null;
      try {
        domain = new URL(evidence.url).hostname.toLowerCase();
      } catch {
        domain = null;
      }
      blockedSourceCount += 1;
      omittedClaims.push({
        claim: evidence.claim,
        status: 'omitted',
        sourceClass: null,
        sourceLabel: null,
        sourceUrl: evidence.url,
        domain,
        note: `Blocked non-approved source from ${evidence.artifactName}.`,
        proseTreatment: 'Replace with an approved source or omit.',
        asOf: now().toISOString().slice(0, 10),
      });
      continue;
    }

    if (externalChecksUsed >= budget.externalChecks) {
      omittedClaims.push({
        claim: evidence.claim,
        status: 'omitted',
        sourceClass: resolved.sourceClass,
        sourceLabel: resolved.sourceLabel,
        sourceUrl: resolved.url,
        domain: resolved.domain,
        note: 'Approved-source budget exhausted before this fetch could run.',
        proseTreatment: 'Attribute cautiously, soften, or leave for Editor.',
        asOf: now().toISOString().slice(0, 10),
      });
      continue;
    }

    const elapsedMs = now().getTime() - startedAt;
    const remainingBudgetMs = wallClockBudgetMs - elapsedMs;
    const fetchResult = await fetchApprovedSource(resolved.url, {
      league,
      fetchImpl: options.fetchImpl,
      remainingWallClockMs: remainingBudgetMs,
      now,
    });

    if (fetchResult.attemptedFetch) {
      externalChecksUsed += 1;
      domainsTouched.add(resolved.domain);
    }

    if (!fetchResult.ok) {
      if (fetchResult.attemptedFetch) {
        fetchFailureCount += 1;
      }
      const wallClockExpiredBeforeFetch = !fetchResult.attemptedFetch && fetchResult.error === 'wall_clock_exhausted';
      const wallClockExpiredDuringFetch = fetchResult.attemptedFetch && fetchResult.error === 'wall_clock_exhausted';
      if (wallClockExpiredBeforeFetch || wallClockExpiredDuringFetch) {
        timeBudgetHit = true;
      }
      omittedClaims.push({
        claim: evidence.claim,
        status: 'omitted',
        sourceClass: resolved.sourceClass,
        sourceLabel: resolved.sourceLabel,
        sourceUrl: resolved.url,
        domain: resolved.domain,
        note: wallClockExpiredBeforeFetch
          ? 'Wall-clock budget exhausted before this fetch could run.'
          : wallClockExpiredDuringFetch
          ? 'Wall-clock budget expired during approved-source fetch.'
          : `Approved-source fetch failed (${fetchResult.error ?? 'unknown_error'}).`,
        proseTreatment: 'Do not promote to a plain factual sentence.',
        asOf: fetchResult.asOf,
      });
      continue;
    }

    const entry: WriterFactCheckEntry = {
      claim: evidence.claim,
      status: fetchResult.candidate?.sourceClass === 'official_primary' ? 'verified' : 'attributed',
      sourceClass: fetchResult.candidate?.sourceClass ?? null,
      sourceLabel: fetchResult.title ? `${resolved.sourceLabel}: ${fetchResult.title}` : resolved.sourceLabel,
      sourceUrl: resolved.url,
      domain: resolved.domain,
      note: `Approved URL referenced in ${evidence.artifactName}.`,
      proseTreatment: fetchResult.candidate?.sourceClass === 'official_primary'
        ? 'Keep the prose faithful to the official source.'
        : 'Attribute inline and avoid unsupported precision.',
      asOf: fetchResult.asOf,
    };

    if (entry.status === 'verified') {
      verifiedFacts.push(entry);
    } else {
      attributedFacts.push(entry);
    }
  }

  const wallClockMs = now().getTime() - startedAt;
  const usage: WriterFactCheckUsage = {
    localDeterministicPassesUsed,
    externalChecksUsed,
    wallClockMs,
    domainsTouched: [...domainsTouched].sort(),
    remainingStatus: externalChecksUsed === 0 && localDeterministicPassesUsed === 0
      ? 'unspent'
      : (
          externalChecksUsed >= budget.externalChecks ||
          timeBudgetHit ||
          wallClockMs >= wallClockBudgetMs
            ? 'exhausted'
            : 'available'
        ),
    claimCount: verifiedFacts.length + attributedFacts.length + omittedClaims.length,
    blockedSourceCount,
    fetchFailureCount,
  };

  return { verifiedFacts, attributedFacts, omittedClaims, usage };
}

export function buildWriterFactCheckArtifact(params: {
  articleTitle: string;
  mode: WriterFactCheckMode;
  availableArtifacts: string[];
  existingArtifact?: string | null;
  report?: WriterFactCheckReport | null;
  league?: string;
}): string {
  const { articleTitle, mode, availableArtifacts, existingArtifact, report } = params;
  const league = params.league ?? 'nfl';
  const sourceLabels = getSourceLabels(league);
  const budget = getBudgetForMode(mode);
  const availableArtifactSet = new Set(availableArtifacts);
  const availableEvidence = WRITER_FACTCHECK_LOCAL_ARTIFACTS
    .map((name) => `- \`${name}\` — ${availableArtifactSet.has(name) ? 'available' : 'missing'}`)
    .join('\n');
  const priorVerifiedFacts = readSection(existingArtifact, 'Verified Facts Used in Draft');
  const priorAttributedFacts = readSection(existingArtifact, 'Attributed but Not Fully Verified');
  const priorOmittedClaims = readSection(existingArtifact, 'Unverified / Omitted Claims');
  const verifiedFacts = report && report.verifiedFacts.length > 0
    ? formatEntries(report.verifiedFacts, '- _No claims were verified in this pass._')
    : (priorVerifiedFacts ?? '- _No writer-side verified claims recorded in this slice yet._');
  const attributedFacts = report && report.attributedFacts.length > 0
    ? formatEntries(report.attributedFacts, '- _No claims required cautious attribution in this pass._')
    : (priorAttributedFacts ?? '- _Use this section when a volatile fact is attributed but still requires cautious prose._');
  const omittedClaims = report && report.omittedClaims.length > 0
    ? formatEntries(report.omittedClaims, '- _No risky claims were omitted or deferred in this pass._')
    : (priorOmittedClaims ?? '- _Use this section when a risky claim is softened, removed, or handed to Editor._');
  const priorNotes = existingArtifact && !existingArtifact.includes('## Stage 5 Verification Contract')
    ? existingArtifact.trim()
    : null;
  const status = report
    ? 'Runtime pass recorded — local evidence was reused first and approved-source fetches stayed bounded.'
    : 'Contract scaffold only — this bounded slice persists the policy surface and durable artifact shape, but does not execute approved-source checks yet.';
  const usage = report?.usage;

  return `# Writer Fact-Check: ${articleTitle}

**Mode:** ${formatMode(mode)}  
**Artifact:** \`${WRITER_FACTCHECK_POLICY.artifactName}\`  
**Status:** ${status}

---

## Stage 5 Verification Contract

- Writer gets **bounded Stage 5 verification access**, not open-ended research autonomy.
- Writer verifies **specific risky claims only** and does not replace Editor.
- Approved source ladder:
  1. ${sourceLabels.local_runtime}
  2. ${sourceLabels.official_primary}
  3. ${sourceLabels.trusted_reference}
- Raw web search is **not allowed** in v1.
- Volatile facts must be attributed, softened, or omitted when unresolved.
- Revision mode must reuse the existing writer fact-check artifact before spending any new external check budget.

## Available Local/Runtime Evidence

${availableEvidence}

## Budget

| Resource | Limit |
| --- | --- |
| Local deterministic passes | ${budget.localDeterministicPasses} |
| External approved-source checks | ${budget.externalChecks} |
| Wall-clock budget | ${budget.wallClockMinutes} minutes |

## Verified Facts Used in Draft

${verifiedFacts}

## Attributed but Not Fully Verified

${attributedFacts}

## Unverified / Omitted Claims

${omittedClaims}

${priorNotes ? `## Prior Artifact Notes

${priorNotes}

` : ''}## Budget Summary

- Local deterministic passes used: ${usage?.localDeterministicPassesUsed ?? 0}/${budget.localDeterministicPasses}
- External approved-source checks used: ${usage?.externalChecksUsed ?? 0}/${budget.externalChecks}
- Domains touched: ${usage && usage.domainsTouched.length > 0 ? usage.domainsTouched.join(', ') : 'none'}
- Claims logged this pass: ${usage?.claimCount ?? 0}
- Blocked sources: ${usage?.blockedSourceCount ?? 0}
- Approved-source fetch failures: ${usage?.fetchFailureCount ?? 0}
- Wall-clock spent: ${usage ? formatDurationMinutes(usage.wallClockMs) : '0'}/${budget.wallClockMinutes} minutes
- Remaining status: ${usage?.remainingStatus ?? 'unspent'}
`;
}
