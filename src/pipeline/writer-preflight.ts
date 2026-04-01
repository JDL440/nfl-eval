import { extractClaims, type ContractClaim, type DraftClaim, type ExtractedClaims, type StatClaim } from './claim-extractor.js';

export interface WriterPreflightIssue {
  severity: 'blocking' | 'advisory' | 'warning';
  code: string;
  message: string;
}

export interface WriterPreflightState {
  blockingIssues: WriterPreflightIssue[];
  advisoryIssues: WriterPreflightIssue[];
  warnings: WriterPreflightIssue[];
}

export interface WriterPreflightSourceArtifact {
  name: string;
  content?: string | null;
}

export const WRITER_PREFLIGHT_ARTIFACT_NAME = 'writer-preflight.md';

const WRITER_PREFLIGHT_HEADER = 'Before you return the draft, run this short editor-style preflight on only the top blockers:';
const WRITER_PREFLIGHT_CHECKS = [
  '- Names: prefer exact names from supplied artifacts for consistency, but do not stop the draft over harmless name expansions or alternate full-name wording alone.',
  '- Precise facts: if you state a contract figure, date, draft fact, or stat, it must come from supplied artifacts or the bounded writer fact-check. Otherwise attribute it, soften it, or cut it.',
  '- No guesswork: do not add new unsupported specifics just to make the prose sound smoother.',
] as const;

const NAME_PATTERN = /([A-Z][a-z]+(?:[-'][A-Za-z]+)?[ \t]+[A-Z][A-Za-z'-]+(?:[ \t]+[A-Z][A-Za-z'-]+){0,2}(?:[ \t]+(?:Jr\.?|Sr\.?|II|III|IV))?)/g;
const ATTRIBUTION_PATTERN = /\b(according to|per\b|via\b|reported by|as noted by|cited by|from\b)\b/i;
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;
const DATE_PATTERN = new RegExp(`\\b(?:20\\d{2}|${MONTH_NAMES.join('|')})\\b`, 'i');
const HARD_DATE_EVENT_PATTERN = /\b(signed|injured|returned|traded|trade|released|announced|extension|contract|deal|drafted|picked)\b|agreed\s+to\b/i;
const RISK_KEYWORDS = [
  'contract', 'extension', 'deal', 'aav', 'guaranteed', 'guarantee', 'guarantees', 'cap hit', 'dead money', 'bonus',
  'yards', 'yard', 'touchdown', 'touchdowns', 'td', 'tds', 'epa', 'cpoe', 'completion', 'rating', 'sacks', 'sack',
  'targets', 'target share', 'snaps', 'success rate', 'pick', 'round', 'overall', 'signed', 'injured', 'returned',
  'traded', 'trade', 'released', 'announced', 'week', 'season', 'drafted',
] as const;
const DATE_RISK_KEYWORDS = [
  'signed', 'injured', 'returned', 'traded', 'trade', 'released', 'announced',
  'extension', 'contract', 'deal', 'drafted', 'picked',
] as const;
const BLOCKING_ISSUE_LIMIT = 3;
const PRECHECK_BOILERPLATE_LINE_PATTERNS = [
  /^[ \t]*\*\*By:\s+.*?\*\*[ \t]*$/gim,
  /^[ \t]*By:\s+.*$/gim,
  /^[ \t]*\*\*Next from the panel:\*\*.*$/gim,
  /^[ \t]*Next from the panel:.*$/gim,
] as const;

const BANNED_EXACT_NAMES = new Set([
  'Expert Panel',
  'Fact Check',
  'Writer Fact',
  'Panel Fact',
  'Primary Input',
  'Upstream Context',
  'Current Team',
  'Official Team',
  'Local Runtime',
]);
const BANNED_FIRST_TOKENS = new Set([
  'The', 'This', 'That', 'These', 'Those', 'Next', 'Current', 'Latest', 'Official', 'Primary', 'Upstream', 'Why',
  'Should', 'By', 'First', 'Second', 'Third', 'Fourth',
  'Writer', 'Editor', 'Panel', 'Draft', 'Article', 'Summary', 'Budget', 'Stage', 'Lab',
  'Defense', 'Offense', 'Special', 'Cap', 'Contract', 'Roster', 'Salary', 'Head', 'Assistant',
]);
const BANNED_LAST_TOKENS = new Set([
  'Panel', 'Check', 'Fact', 'Context', 'Summary', 'Prompt', 'Review', 'Input', 'Budget', 'Article', 'Verdict',
  'Analyst', 'Expert', 'Specialist', 'Coordinator', 'Strategist', 'Evaluator', 'Observer',
  'Cardinals', 'Falcons', 'Ravens', 'Bills', 'Panthers', 'Bears', 'Bengals', 'Browns', 'Cowboys', 'Broncos',
  'Lions', 'Packers', 'Texans', 'Colts', 'Jaguars', 'Chiefs', 'Raiders', 'Chargers', 'Rams', 'Dolphins',
  'Vikings', 'Patriots', 'Saints', 'Giants', 'Jets', 'Eagles', 'Steelers', '49ers', 'Seahawks', 'Buccaneers',
  'Titans', 'Commanders',
]);

function getLeagueBannedTokens(league: string): { exactNames: Set<string>; firstTokens: Set<string> } {
  const leagueUpper = league.toUpperCase();
  const exactNames = new Set(BANNED_EXACT_NAMES);
  exactNames.add(`The ${leagueUpper}`);
  const firstTokens = new Set(BANNED_FIRST_TOKENS);
  firstTokens.add(leagueUpper);
  return { exactNames, firstTokens };
}

export function buildWriterPreflightChecklist(): string {
  return [WRITER_PREFLIGHT_HEADER, ...WRITER_PREFLIGHT_CHECKS].join('\n');
}

export function buildWriterPreflightArtifact(params: {
  initialState: WriterPreflightState;
  finalState: WriterPreflightState;
  repairTriggered: boolean;
}): string {
  const { initialState, finalState, repairTriggered } = params;
  const allClear = finalState.blockingIssues.length === 0 && finalState.advisoryIssues.length === 0;
  const lines = [
    '# Writer Preflight',
    '',
    `**Status:** ${finalState.blockingIssues.length === 0 ? (finalState.advisoryIssues.length === 0 ? 'passed' : 'passed with advisories') : 'blocking issues remain'}`,
    `**Repair triggered:** ${repairTriggered ? 'yes' : 'no'}`,
    '',
    '## Final Blocking Issues',
    ...renderIssueLines(finalState.blockingIssues, 'No deterministic writer-preflight issues found.'),
  ];

  if (finalState.advisoryIssues.length > 0) {
    lines.push(
      '',
      '## Advisory Issues (for human review at publish time)',
      ...renderIssueLines(finalState.advisoryIssues, 'No advisory issues.'),
    );
  }

  if (repairTriggered) {
    lines.push(
      '',
      '## Initial Blocking Issues',
      ...renderIssueLines(initialState.blockingIssues, 'No initial blocking issues recorded.'),
    );
  }

  if (finalState.warnings.length > 0) {
    lines.push(
      '',
      '## Final Warnings',
      ...renderIssueLines(finalState.warnings, 'No final warnings recorded.'),
    );
  }

  return lines.join('\n');
}

export function runWriterPreflight(params: {
  draft: string;
  sourceArtifacts: WriterPreflightSourceArtifact[];
  league?: string;
}): WriterPreflightState {
  const league = params.league ?? 'nfl';
  const sourceText = params.sourceArtifacts
    .map((artifact) => artifact.content?.trim())
    .filter((content): content is string => Boolean(content))
    .map((content) => stripPreflightBoilerplate(content))
    .join('\n\n');
  const draftText = stripPreflightBoilerplate(params.draft);

  if (sourceText.trim().length === 0) {
    return { blockingIssues: [], advisoryIssues: [], warnings: [] };
  }

  const allIssues = dedupeIssues([
    ...findPlaceholderLeakageIssues(params.draft),
    ...findUnsourcedClaimIssues(draftText, sourceText),
    ...findUnsourcedDateIssues(draftText, sourceText),
  ]);
  const blockingIssues = allIssues.filter((i) => i.severity === 'blocking').slice(0, BLOCKING_ISSUE_LIMIT);
  const advisoryIssues = allIssues.filter((i) => i.severity === 'advisory');
  const warnings = dedupeIssues([
    ...findNameConsistencyIssues(draftText, sourceText, league),
  ]);

  return {
    blockingIssues,
    advisoryIssues,
    warnings,
  };
}

function findPlaceholderLeakageIssues(draft: string): WriterPreflightIssue[] {
  const issues: WriterPreflightIssue[] = [];
  const placeholderPatterns = [
    /\bTODO\b/i,
    /\bTBD\b/i,
    /\bTK\b/i,
    /headline options/i,
  ];

  for (const pattern of placeholderPatterns) {
    const match = draft.match(pattern);
    if (!match) continue;
    issues.push({
      severity: 'blocking',
      code: 'placeholder-leakage',
      message: `Draft still includes placeholder or scaffolding text ("${match[0]}"). Remove it before handing the article to Editor.`,
    });
    break;
  }

  return issues;
}

function findNameConsistencyIssues(draft: string, sourceText: string, league: string = 'nfl'): WriterPreflightIssue[] {
  const sourceNames = extractSupportedNames(sourceText, league);
  const sourceNameSet = new Set(sourceNames.map((name) => normalizeName(name)));
  const sourceLastNameMap = new Map<string, Set<string>>();

  for (const name of sourceNames) {
    const lastName = getLastName(name);
    if (!lastName) continue;
    const supported = sourceLastNameMap.get(lastName) ?? new Set<string>();
    supported.add(name);
    sourceLastNameMap.set(lastName, supported);
  }

  const issues: WriterPreflightIssue[] = [];
  for (const draftName of extractSupportedNames(draft, league)) {
    const normalizedDraftName = normalizeName(draftName);
    if (sourceNameSet.has(normalizedDraftName)) continue;

    const lastName = getLastName(draftName);
    if (!lastName) continue;

    const supportedNames = sourceLastNameMap.get(lastName);
    if (supportedNames && supportedNames.size > 0) {
        const preferredName = [...supportedNames][0] ?? draftName;
        issues.push({
          severity: 'warning',
          code: 'name-consistency',
          message: `Draft uses "${draftName}", but supplied artifacts support "${preferredName}". Prefer the supplied wording for consistency, but this alone should not block the draft.`,
        });
        continue;
      }

      if (hasStandaloneLastName(sourceText, lastName)) {
        issues.push({
          severity: 'warning',
          code: 'unsupported-name-expansion',
          message: `Draft expands "${draftName}" even though the supplied artifacts only support the "${lastName}" reference. Prefer the supplied wording or keep it generic, but do not block the draft over this alone.`,
        });
      }
  }

  return issues;
}

function findUnsourcedClaimIssues(draft: string, sourceText: string): WriterPreflightIssue[] {
  const draftClaims = extractClaims(draft);
  const sourceClaims = extractClaims(sourceText);
  const issues: WriterPreflightIssue[] = [];

  for (const claim of draftClaims.contractClaims) {
    if (ATTRIBUTION_PATTERN.test(claim.raw)) continue;
    if (claimHasSupport(claim.raw, sourceText)) continue;
    if (contractClaimHasSupport(claim, sourceClaims, sourceText)) continue;
    issues.push({
      severity: 'advisory',
      code: 'unsourced-contract-claim',
      message: `Draft includes unsupported precise contract language ("${claim.raw}"). Keep exact figures only when supplied artifacts support them; otherwise attribute, soften, or cut the claim.`,
    });
  }

  for (const claim of draftClaims.statClaims) {
    if (ATTRIBUTION_PATTERN.test(claim.raw)) continue;
    if (claimHasSupport(claim.raw, sourceText)) continue;
    if (statClaimHasSupport(claim, sourceClaims, sourceText)) continue;
    issues.push({
      severity: 'advisory',
      code: 'unsourced-stat-claim',
      message: `Draft includes unsupported precise stat language ("${claim.raw}"). Keep exact stats only when the supplied artifacts or bounded writer fact-check support them; otherwise attribute, soften, or cut the claim.`,
    });
  }

  for (const claim of draftClaims.draftClaims) {
    if (ATTRIBUTION_PATTERN.test(claim.raw)) continue;
    if (claimHasSupport(claim.raw, sourceText)) continue;
    if (draftClaimHasSupport(claim, sourceClaims, sourceText)) continue;
    issues.push({
      severity: 'advisory',
      code: 'unsourced-draft-claim',
      message: `Draft includes unsupported precise draft language ("${claim.raw}"). Keep exact draft details only when supplied artifacts support them; otherwise attribute, soften, or cut the claim.`,
    });
  }

  return issues;
}

function findUnsourcedDateIssues(draft: string, sourceText: string): WriterPreflightIssue[] {
  const issues: WriterPreflightIssue[] = [];

  for (const unit of splitDraftUnits(draft)) {
    if (ATTRIBUTION_PATTERN.test(unit)) continue;
    if (!DATE_PATTERN.test(unit) || !isBlockingDateUnit(unit)) continue;
    if (dateClaimHasSupport(unit, sourceText)) continue;
    issues.push({
      severity: 'advisory',
      code: 'unsourced-date-claim',
      message: `Draft includes unsupported precise date or timeline language ("${unit}"). Keep exact dates only when supplied artifacts support them; otherwise attribute, soften, or cut the claim.`,
    });
  }

  return issues;
}

function dateClaimHasSupport(unit: string, sourceText: string): boolean {
  return claimHasSupport(unit, sourceText) || fuzzySupportForDateUnit(unit, sourceText);
}

function statClaimHasSupport(claim: StatClaim, sourceClaims: ExtractedClaims, sourceText: string): boolean {
  const exactValue = normalizeNumericToken(claim.value);
  return sourceClaims.statClaims.some((sourceClaim) =>
    samePerson(sourceClaim.player, claim.player)
    && sourceClaim.metric === claim.metric
    && normalizeNumericToken(sourceClaim.value) === exactValue,
  ) || fuzzySupportForRiskUnit(claim.raw, sourceText);
}

function contractClaimHasSupport(claim: ContractClaim, sourceClaims: ExtractedClaims, sourceText: string): boolean {
  const draftNumbers = extractNumericTokens(claim.raw);
  return sourceClaims.contractClaims.some((sourceClaim) =>
    samePerson(sourceClaim.player, claim.player)
    && draftNumbers.every((token) => extractNumericTokens(sourceClaim.raw).includes(token)),
  ) || fuzzySupportForRiskUnit(claim.raw, sourceText);
}

function draftClaimHasSupport(claim: DraftClaim, sourceClaims: ExtractedClaims, sourceText: string): boolean {
  return sourceClaims.draftClaims.some((sourceClaim) =>
    samePerson(sourceClaim.player, claim.player)
    && (claim.round == null || sourceClaim.round === claim.round)
    && (claim.pick == null || sourceClaim.pick === claim.pick)
    && (claim.year == null || sourceClaim.year === claim.year),
  ) || fuzzySupportForRiskUnit(claim.raw, sourceText);
}

function fuzzySupportForRiskUnit(unit: string, sourceText: string): boolean {
  const source = normalizeText(sourceText);
  const numbers = extractNumericTokens(unit);
  const keywords = extractRiskKeywords(unit);
  const lastNames = extractSupportedNames(unit).map(getLastName).filter(Boolean);

  if (numbers.length === 0 || keywords.length === 0) return false;

  const numbersSupported = numbers.every((token) => source.includes(token));
  const keywordSupported = keywords.some((keyword) => source.includes(keyword));
  const nameSupported = lastNames.length === 0 || lastNames.some((lastName) => source.includes(lastName));

  return numbersSupported && keywordSupported && nameSupported;
}

function fuzzySupportForDateUnit(unit: string, sourceText: string): boolean {
  const source = normalizeText(sourceText);
  const years = extractYearTokens(unit);
  const months = extractMonthTokens(unit);
  const keywords = extractDateRiskKeywords(unit);
  const lastNames = extractSupportedNames(unit).map(getLastName).filter(Boolean);

  if ((years.length === 0 && months.length === 0) || keywords.length === 0) return false;

  const yearsSupported = years.every((token) => source.includes(token));
  const monthsSupported = months.every((token) => source.includes(token));
  const keywordSupported = keywords.some((keyword) => source.includes(keyword));
  const nameSupported = lastNames.length === 0 || lastNames.some((lastName) => source.includes(lastName));

  return yearsSupported && monthsSupported && keywordSupported && nameSupported;
}

function claimHasSupport(unit: string, sourceText: string): boolean {
  return normalizeText(sourceText).includes(normalizeText(unit));
}

function extractSupportedNames(text: string, league: string = 'nfl'): string[] {
  const stripped = stripMarkdown(text);
  const names = new Set<string>();
  const { exactNames, firstTokens } = getLeagueBannedTokens(league);

  let match: RegExpExecArray | null;
  NAME_PATTERN.lastIndex = 0;
  while ((match = NAME_PATTERN.exec(stripped)) !== null) {
    const name = cleanName(match[1] ?? '');
    if (!name) continue;

    const parts = name.split(/\s+/);
    const first = parts[0] ?? '';
    const last = parts[parts.length - 1] ?? '';
    if (
      parts.length < 2
      || exactNames.has(name)
      || firstTokens.has(first)
      || BANNED_LAST_TOKENS.has(last)
    ) {
      continue;
    }

    names.add(name);
  }

  return [...names];
}

function stripMarkdown(text: string): string {
  return stripPreflightBoilerplate(text)
    .replace(/\r\n/g, '\n')
    .replace(/`[^`]+`/g, ' ')
    .replace(/\*\*/g, '')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^\|.*$/gm, ' ');
}

function splitDraftUnits(text: string): string[] {
  return stripPreflightBoilerplate(text)
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((unit) => unit.trim())
    .filter((unit) => unit.length > 0)
    .filter((unit) => !unit.startsWith('#'))
    .filter((unit) => !unit.startsWith('> **📋 TLDR**'));
}

function samePerson(left: string, right: string): boolean {
  const leftLastName = getLastName(left);
  const rightLastName = getLastName(right);
  return leftLastName.length > 0 && leftLastName === rightLastName;
}

function getLastName(name: string): string {
  const normalized = normalizeName(name);
  const parts = normalized.split(' ').filter(Boolean);
  return parts[parts.length - 1] ?? '';
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, ' ').trim();
}

function cleanName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().replace(/[.,;:!?]+$/, '');
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9$\s%.-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function hasStandaloneLastName(text: string, lastName: string): boolean {
  if (!lastName) return false;
  const pattern = new RegExp(`\\b${escapeRegex(lastName)}\\b`, 'i');
  return pattern.test(text);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractNumericTokens(text: string): string[] {
  return [...text.matchAll(/\$?\d[\d,.]*%?/g)]
    .map((match) => normalizeNumericToken(match[0] ?? ''))
    .filter(Boolean);
}

function normalizeNumericToken(value: string): string {
  return value.toLowerCase().replace(/[$,%\s,]/g, '');
}

function extractRiskKeywords(text: string): string[] {
  const lowered = text.toLowerCase();
  return RISK_KEYWORDS.filter((keyword) => lowered.includes(keyword));
}

function extractDateRiskKeywords(text: string): string[] {
  const lowered = text.toLowerCase();
  const keywords: string[] = [...DATE_RISK_KEYWORDS.filter((keyword) => lowered.includes(keyword))];
  if (/\bagreed\s+to\b/i.test(text)) {
    keywords.push('agreed to');
  }
  return keywords;
}

function extractYearTokens(text: string): string[] {
  return [...text.matchAll(/\b20\d{2}\b/g)]
    .map((match) => match[0] ?? '')
    .filter(Boolean);
}

function extractMonthTokens(text: string): string[] {
  const monthPattern = new RegExp(`\\b(${MONTH_NAMES.join('|')})\\b`, 'gi');
  return [...text.matchAll(monthPattern)]
    .map((match) => (match[0] ?? '').toLowerCase())
    .filter(Boolean);
}

function isBlockingDateUnit(unit: string): boolean {
  return DATE_PATTERN.test(unit) && HARD_DATE_EVENT_PATTERN.test(unit);
}

function stripPreflightBoilerplate(text: string): string {
  let stripped = text.replace(/\r\n/g, '\n');
  for (const pattern of PRECHECK_BOILERPLATE_LINE_PATTERNS) {
    stripped = stripped.replace(pattern, '');
  }
  return stripped.replace(/\n{3,}/g, '\n\n').trim();
}

function dedupeIssues(issues: WriterPreflightIssue[]): WriterPreflightIssue[] {
  const seen = new Set<string>();
  const deduped: WriterPreflightIssue[] = [];

  for (const issue of issues) {
    const key = `${issue.code}:${issue.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(issue);
  }

  return deduped;
}

function renderIssueLines(issues: WriterPreflightIssue[], emptyLine: string): string[] {
  if (issues.length === 0) {
    return [`- ${emptyLine}`];
  }
  return issues.map((issue) => `- [${issue.code}] ${issue.message}`);
}
