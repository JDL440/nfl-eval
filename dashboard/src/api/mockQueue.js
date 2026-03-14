// Mock data for Backend M1 - represents a BullMQ queue
export const mockJobs = [
  {
    id: "job-1",
    type: "article-draft",
    state: "completed",
    data: {
      title: "NFL Trade: Bills Acquire Pro Bowler",
      summary: "Buffalo trades 2026 2nd-round pick for edge rusher",
      body: "The Buffalo Bills have made a significant move in free agency, acquiring an elite edge rusher in exchange for a 2026 second-round draft pick. This move addresses a critical need on the defensive line and signals the team's commitment to competing in 2026. The player, known for his consistent pass-rush production, is expected to make an immediate impact.",
      significance: 8.5,
      sourceTransaction: { value: 125_000_000 }
    },
    token_usage: { model: "haiku", input: 800, output: 1200, cost: 0.0048 },
    created_at: "2026-03-14T10:00:00Z",
    status: "ready_for_review",
    audit_log: [
      { action: "drafted", actor: "system", timestamp: "2026-03-14T10:00:00Z" }
    ]
  },
  {
    id: "job-2",
    type: "article-draft",
    state: "completed",
    data: {
      title: "Seahawks Sign Veteran Cornerback",
      summary: "Seattle adds defensive depth ahead of 2026 draft",
      body: "The Seattle Seahawks have added veteran cornerback depth to their secondary. The signing comes after a series of departures in free agency, addressing the team's secondary concerns. The player brings experience and leadership to the cornerback room.",
      significance: 6.2,
      sourceTransaction: { value: 75_000_000 }
    },
    token_usage: { model: "haiku", input: 650, output: 950, cost: 0.0042 },
    created_at: "2026-03-14T11:30:00Z",
    status: "ready_for_review",
    audit_log: [
      { action: "drafted", actor: "system", timestamp: "2026-03-14T11:30:00Z" }
    ]
  },
  {
    id: "job-3",
    type: "article-draft",
    state: "completed",
    data: {
      title: "49ers Release Kirk Cousins",
      summary: "San Francisco makes surprise QB decision",
      body: "The San Francisco 49ers have released veteran quarterback Kirk Cousins in a surprising move. The decision clears cap space and signals the team's direction moving forward. Cousins is now available as a free agent for other teams.",
      significance: 9.1,
      sourceTransaction: { value: 200_000_000 }
    },
    token_usage: { model: "haiku", input: 920, output: 1450, cost: 0.0055 },
    created_at: "2026-03-14T12:15:00Z",
    status: "pending_approval",
    audit_log: [
      { action: "drafted", actor: "system", timestamp: "2026-03-14T12:15:00Z" }
    ]
  },
  {
    id: "job-4",
    type: "article-draft",
    state: "completed",
    data: {
      title: "Cards Trade for Top EDGE Prospect",
      summary: "Arizona makes bold move in draft preparation",
      body: "The Arizona Cardinals have executed a trade for premium edge rusher prospects. The move demonstrates the team's commitment to strengthening their pass rush defense.",
      significance: 7.8,
      sourceTransaction: { value: 150_000_000 }
    },
    token_usage: { model: "haiku", input: 700, output: 1100, cost: 0.0046 },
    created_at: "2026-03-14T13:00:00Z",
    status: "pending_approval",
    audit_log: [
      { action: "drafted", actor: "system", timestamp: "2026-03-14T13:00:00Z" }
    ]
  },
  {
    id: "job-5",
    type: "article-draft",
    state: "completed",
    data: {
      title: "Rams Release Aaron Donald",
      summary: "Los Angeles makes veteran decision",
      body: "The Los Angeles Rams have released defensive tackle Aaron Donald. This move clears significant cap space for the franchise.",
      significance: 8.9,
      sourceTransaction: { value: 180_000_000 }
    },
    token_usage: { model: "haiku", input: 880, output: 1320, cost: 0.0052 },
    created_at: "2026-03-14T14:00:00Z",
    status: "approved",
    audit_log: [
      { action: "drafted", actor: "system", timestamp: "2026-03-14T14:00:00Z" },
      { action: "approved", actor: "joe@example.com", timestamp: "2026-03-14T14:30:00Z" }
    ]
  },
  {
    id: "job-6",
    type: "article-draft",
    state: "completed",
    data: {
      title: "NFL Practice Squad Roster Moves",
      summary: "Teams make minor depth adjustments",
      body: "Multiple NFL teams have adjusted their practice squad rosters.",
      significance: 2.1,
      sourceTransaction: { value: 5_000_000 }
    },
    token_usage: { model: "haiku", input: 300, output: 450, cost: 0.0022 },
    created_at: "2026-03-14T09:00:00Z",
    status: "archived",
    audit_log: [
      { action: "drafted", actor: "system", timestamp: "2026-03-14T09:00:00Z" },
      { action: "rejected", actor: "editor@example.com", timestamp: "2026-03-14T09:15:00Z" }
    ]
  }
];

export default mockJobs;
