const mockJobs = [
  {
    id: 'job-1',
    type: 'article-draft',
    state: 'completed',
    status: 'ready_for_review',
    data: {
      title: 'Patrick Mahomes Signs Record Extension with Chiefs',
      summary: 'Kansas City Chiefs quarterback Patrick Mahomes has agreed to a record-breaking contract extension worth $503 million over 10 years.',
      body: 'The Kansas City Chiefs and quarterback Patrick Mahomes have agreed to the largest contract in NFL history. The 10-year extension is worth $503 million, with $141.5 million guaranteed. The deal keeps Mahomes in Kansas City through the 2031 season.\n\nMahomes, who has led the Chiefs to multiple Super Bowl appearances and victories, expressed excitement about his future with the organization. "Kansas City is my home," Mahomes said during the press conference. "I want to be here for my entire career."\n\nThe deal surpasses the previous record set by Deshaun Watson\'s fully guaranteed contract with the Cleveland Browns. NFL analysts suggest this extension sets a new benchmark for quarterback compensation.',
      significance: 9.2,
      sourceTransaction: { id: 'tx-001', value: 503_000_000 },
    },
    token_usage: { model: 'haiku', input: 1200, output: 1800, cost: 0.0072 },
    created_at: '2026-03-14T08:30:00Z',
    audit_log: [
      { action: 'drafted', actor: 'system', timestamp: '2026-03-14T08:30:00Z' },
      { action: 'reviewed', actor: 'system', timestamp: '2026-03-14T08:31:00Z' },
    ],
  },
  {
    id: 'job-2',
    type: 'article-draft',
    state: 'completed',
    status: 'approved',
    data: {
      title: 'NFL Draft 2026: Top Prospects and Mock Draft Analysis',
      summary: 'With the 2026 NFL Draft approaching, analysts are projecting the top picks and potential trades.',
      body: 'The 2026 NFL Draft is shaping up to be one of the most anticipated in recent memory. With several franchise-altering prospects available, teams are jockeying for position.\n\nThe consensus top prospect is a generational quarterback talent from Ohio State, who has drawn comparisons to Peyton Manning. Multiple teams in the top five are reportedly interested in trading up to secure the pick.',
      significance: 7.8,
      sourceTransaction: { id: 'tx-002', value: 0 },
    },
    token_usage: { model: 'haiku', input: 900, output: 1400, cost: 0.0055 },
    created_at: '2026-03-14T09:15:00Z',
    audit_log: [
      { action: 'drafted', actor: 'system', timestamp: '2026-03-14T09:15:00Z' },
      { action: 'approved', actor: 'editor', timestamp: '2026-03-14T09:45:00Z' },
    ],
  },
  {
    id: 'job-3',
    type: 'article-draft',
    state: 'completed',
    status: 'drafted',
    data: {
      title: 'Seahawks Acquire Star Wide Receiver in Blockbuster Trade',
      summary: 'The Seattle Seahawks have completed a major trade, acquiring a top wide receiver to bolster their offense.',
      body: 'In a stunning move, the Seattle Seahawks have traded multiple draft picks for one of the league\'s premier wide receivers. The deal, which includes two first-round picks and a third-round pick, signals Seattle\'s intention to compete for a Super Bowl.\n\nThe receiver, coming off a 1,400-yard season, is expected to immediately become the number one target in Seattle\'s passing attack.',
      significance: 8.5,
      sourceTransaction: { id: 'tx-003', value: 125_000_000 },
    },
    token_usage: { model: 'haiku', input: 800, output: 1200, cost: 0.0048 },
    created_at: '2026-03-14T10:00:00Z',
    audit_log: [
      { action: 'drafted', actor: 'system', timestamp: '2026-03-14T10:00:00Z' },
    ],
  },
  {
    id: 'job-4',
    type: 'article-draft',
    state: 'completed',
    status: 'rejected',
    data: {
      title: 'NFL Salary Cap Increases for 2026 Season',
      summary: 'The NFL has announced the salary cap will increase to $255 million per team for the 2026 season.',
      body: 'The NFL announced that the salary cap for the 2026 season will be $255 million per team, an increase of $10 million from the previous year. This increase gives teams additional flexibility in free agency and contract negotiations.\n\nTeams with significant cap space are expected to be aggressive in the free agent market.',
      significance: 5.5,
      sourceTransaction: { id: 'tx-004', value: 0 },
    },
    token_usage: { model: 'haiku', input: 600, output: 900, cost: 0.0036 },
    created_at: '2026-03-14T11:00:00Z',
    audit_log: [
      { action: 'drafted', actor: 'system', timestamp: '2026-03-14T11:00:00Z' },
      { action: 'rejected', actor: 'editor', timestamp: '2026-03-14T11:30:00Z', reason: 'Low significance score' },
    ],
  },
  {
    id: 'job-5',
    type: 'article-draft',
    state: 'completed',
    status: 'published',
    data: {
      title: 'Super Bowl LVIII Breaks Viewership Records',
      summary: 'Super Bowl LVIII drew over 123 million viewers, making it the most-watched broadcast in US television history.',
      body: 'Super Bowl LVIII has officially become the most-watched broadcast in United States television history, drawing an average audience of 123.4 million viewers across all platforms. The game exceeded the previous record by over 8 million viewers.\n\nThe matchup between the two top-seeded teams delivered a dramatic finish, with the game decided in the final minute. Advertising rates for the broadcast averaged $7 million per 30-second spot.',
      significance: 9.8,
      sourceTransaction: { id: 'tx-005', value: 0 },
    },
    token_usage: { model: 'opus', input: 1500, output: 2200, cost: 0.0185 },
    created_at: '2026-03-13T20:00:00Z',
    audit_log: [
      { action: 'drafted', actor: 'system', timestamp: '2026-03-13T20:00:00Z' },
      { action: 'approved', actor: 'editor', timestamp: '2026-03-13T21:00:00Z' },
      { action: 'published', actor: 'editor', timestamp: '2026-03-13T21:05:00Z' },
    ],
  },
  {
    id: 'job-6',
    type: 'article-draft',
    state: 'active',
    status: 'pending',
    data: {
      title: 'Generating: Free Agency Tracker 2026',
      summary: '',
      body: '',
      significance: 0,
      sourceTransaction: { id: 'tx-006', value: 0 },
    },
    token_usage: { model: 'haiku', input: 0, output: 0, cost: 0 },
    created_at: '2026-03-14T12:00:00Z',
    audit_log: [
      { action: 'queued', actor: 'system', timestamp: '2026-03-14T12:00:00Z' },
    ],
  },
];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getJobs() {
  await delay(300);
  return [...mockJobs];
}

export async function getJob(id) {
  await delay(200);
  const job = mockJobs.find((j) => j.id === id);
  if (!job) throw new Error(`Job ${id} not found`);
  return { ...job };
}

export async function approveJob(id) {
  await delay(500);
  const job = mockJobs.find((j) => j.id === id);
  if (!job) throw new Error(`Job ${id} not found`);
  job.status = 'approved';
  job.audit_log.push({
    action: 'approved',
    actor: 'editor',
    timestamp: new Date().toISOString(),
  });
  return { ...job };
}

export async function rejectJob(id, reason) {
  await delay(500);
  const job = mockJobs.find((j) => j.id === id);
  if (!job) throw new Error(`Job ${id} not found`);
  job.status = 'rejected';
  job.audit_log.push({
    action: 'rejected',
    actor: 'editor',
    timestamp: new Date().toISOString(),
    reason,
  });
  return { ...job };
}

export async function unpublishJob(id) {
  await delay(500);
  const job = mockJobs.find((j) => j.id === id);
  if (!job) throw new Error(`Job ${id} not found`);
  job.status = 'drafted';
  job.audit_log.push({
    action: 'unpublished',
    actor: 'editor',
    timestamp: new Date().toISOString(),
  });
  return { ...job };
}

let publishCallCount = 0;

export async function publishArticle(id) {
  await delay(800);
  publishCallCount++;
  const job = mockJobs.find((j) => j.id === id);
  if (!job) throw new Error(`Job ${id} not found`);
  if (job.status !== 'approved') {
    throw new Error(`Cannot publish: article status is "${job.status}", must be "approved"`);
  }
  if (globalThis.__mockPublishFailure) {
    throw new Error('Substack API error: publish failed');
  }
  const slug = job.data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const substackUrl = `https://seahawksbotblog.substack.com/p/${slug}`;
  job.status = 'published';
  job.audit_log.push({
    action: 'published',
    actor: 'editor',
    timestamp: new Date().toISOString(),
  });
  return { ...job, substackUrl };
}
