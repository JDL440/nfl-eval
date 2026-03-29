# Traffic Growth Plan for NFL Lab

## Executive Summary

NFL Lab should treat growth as an asset-multiplication problem, not a "post links everywhere" problem. The repo is already set up to publish directly to production, auto-insert two native subscribe widgets, enforce a hero-safe first image for social/email sharing, and support native YouTube embeds, which means the fastest lift now is packaging each article into repeatable distribution assets rather than rebuilding the publishing layer.[^1][^2][^3][^4]

Substack should be the first layer of the plan because it already has built-in discovery and conversion surfaces. Substack says its network drives 25% of paid subscriptions across the platform, more than 25% of subscriptions originate in its apps, and its growth stack includes Recommendations, referrals, cross-posting, mentions, Boost, SEO, and the reader app.[^5]

External channels should then be used selectively as experiments. Reddit and Facebook groups can work when posts are discussion-led and rule-compliant, while short-form video is the most realistic "new surface" to test because YouTube Shorts and Meta both expose explicit discovery and analytics loops that can be tied back to article launches.[^9][^10][^11][^13][^14]

My recommendation is a three-layer program: (1) Substack-native distribution as the base system, (2) community-led external posting for the best-fit stories, and (3) a lightweight short-video workflow for breaking news and strong-opinion pieces. Instrumentation should come first so every experiment can be judged on subscriber conversion, not vibes.[^12][^15]

## What NFL Lab can already leverage immediately

NFL Lab already has several publishing capabilities that matter directly for traffic and conversion:

| Existing asset | Why it matters for growth | Evidence |
|---|---|---|
| Prod-first publishing | Faster launch on real audience-facing drafts; less staging friction for normal posts | `publish_to_substack` now defaults to `prod` and only uses `stage` for explicit testing.[^1] |
| Hero-safe first image enforcement | The first body image becomes the social/email share image, so the repo already protects the thumbnail slot | The publisher detects chart-like images and swaps in a safer later image when needed.[^2] |
| Two native subscribe widgets | New traffic already lands on articles with two built-in conversion opportunities | The publisher guarantees a subscribe widget after the opening and another near the end.[^3] |
| YouTube embeds in articles | NFL Lab can attach video explainers to written pieces without custom embed work | The Substack publishing skill supports `::youtube` embeds as native players.[^4] |
| Hero-image guidance in image generation | The current image workflow already treats `inline-1` as the social/share image | The image-generation skill explicitly requires `inline-1` to be hero-safe and non-chart-like.[^18] |

That means the next bottleneck is not article formatting. It is turning every article into a reusable distribution package: a Note, a recommendation angle, a referral ask, a community post, and optionally a short video.

## Recommended channel priority

| Priority | Channel | Why it should be prioritized | Confidence |
|---|---|---|---|
| 1 | Substack Notes | Native discovery, low production cost, fast publishing cadence, already close to the article workflow | High[^5][^6] |
| 2 | Substack Recommendations | Directly affects subscribe flow, homepage, and digest emails; measurable inside Substack | High[^5][^7] |
| 3 | Substack referrals | Uses current readers as a growth channel and is natively tracked | High[^5][^8] |
| 4 | Substack Chat | Gives breaking-news and community moments somewhere to live without leaving Substack | Medium-high[^16] |
| 5 | Substack video posts / clips | Lowest-friction video entry point because video, clips, transcripts, and podcast reuse are native | Medium-high[^17] |
| 6 | YouTube Shorts, Instagram Reels, Facebook Reels | Best off-platform top-of-funnel test because the same vertical video can be reused across platforms | Medium-high[^11][^13][^14] |
| 7 | Reddit | Can drive bursts of relevant traffic when the post is discussion-first and subreddit-compliant | Medium[^9] |
| 8 | X and Facebook groups | Worth testing, but treat as opportunistic rather than the foundation of the system | Medium-low[^11] |

## The Substack-first operating plan

### 1. Notes should become the always-on top-of-funnel

Notes are the easiest immediate win. Officially, Notes support short-form text, images, videos, links, quotes, and public interaction inside the Substack feed and profile layer.[^6] NFL Lab should use that by turning every article into a small cluster of Notes rather than a single launch post.

Recommended package per article:

1. A launch Note with the thesis, hero image, and link.
2. A second Note pulling the sharpest quote, disagreement, or stat.
3. A third Note phrased as a question or challenge to invite replies.
4. A weekend recirculation Note for evergreen or still-relevant stories.

This is the highest-ROI use of the current article inventory because it reuses work you already have: headline, subtitle, verdict, and hero image.[^2][^18]

### 2. Recommendations should be treated like partnership BD

Recommendations are not just a settings checkbox. Substack positions them as a human-powered discovery system that appears in subscribe flows, on publication homepages, and in automated emails.[^5] The official recommendations workflow also exposes who recommends you and how many free subscriptions those recommendations generated.[^7]

Practical plan:

- Build a target list of adjacent publications: NFL team newsletters, cap/contract writers, fantasy/draft newsletters, and general football analysis publications.
- Do small bilateral swaps first: "We recommend you, you recommend us."
- Offer guest posts or mentions around big news cycles, not just static homepage recs.

This is likely the highest-confidence subscriber-growth experiment after Notes because it plugs directly into Substack's own subscribe surfaces.[^5][^7]

### 3. Turn on referrals with low-cost, high-identity rewards

Substack's referral tooling is purpose-built for newsletter growth and automates tracking and reward logic.[^5][^8] NFL Lab should use rewards that feel insider-ish rather than expensive.

Good first reward ladder:

- 1 referral: shoutout or "supporter" recognition.
- 3 referrals: access to a private mailbag or AMA thread.
- 5 referrals: early access to a premium article or offseason board.
- 10 referrals: one month comped paid tier or a personalized mailbag answer.

This works especially well once a few articles start getting shared in team communities because the referral ask gives existing readers something concrete to do after reading.

### 4. Use Chat for breaking-news and reaction loops

Chat can be enabled for everyone or restricted to paid/founding subscribers, and Substack supports media in chat threads.[^16] For NFL Lab, Chat is a better near-term community surface than building a Discord because it keeps readers inside the same product as the newsletter.

Best uses:

- Breaking-news reaction thread right after a trade/signing story goes live.
- Weekly mailbag.
- Draft-night or free-agency live thread.
- Paid-only Q&A as an upgrade hook.

The point is not raw reach. The point is increasing reader habit and giving new subscribers a reason to stay and return.

### 5. Substack-native video is the easiest bridge into video

Before committing to a full YouTube workflow, NFL Lab should exploit what Substack already provides. Official Substack video tooling supports uploading or recording video posts, auto transcripts, clip trimming, thumbnails, audio/podcast reuse, and free previews.[^17]

That suggests a very practical first video motion:

- Publish the article.
- Record a 60-90 second reaction video summarizing the thesis.
- Clip the best 15-30 second moment into a Note.
- Embed the full video or a YouTube version into the article when relevant.[^4][^17]

This is the lowest-friction way to test whether NFL Lab's voice works on camera before building a real cross-platform video machine.

## External traffic options, realistically

### Reddit

Reddit can work, but only if NFL Lab behaves like a participant rather than a syndication bot. Reddit's content policy explicitly tells users to abide by each community's rules and not interfere with communities they are not part of.[^9]

That means the right Reddit playbook is:

- Post only into communities where the story has obvious fit.
- Lead with the argument, not the link.
- Use text posts or discussion prompts when link posts are restricted.
- Treat moderator removals or warnings as a hard stop.

Good Reddit story types:

- Sharp contract/talent disagreement pieces.
- Team-specific offseason arguments.
- Breaking-news reactions with a strong thesis.

Bad Reddit story types:

- Generic article dumps.
- Cross-posting the same text into many subreddits.
- Dropping links into communities with anti-promo rules.

### Facebook groups

Facebook groups can be useful when they are niche, team-specific, and discussion-friendly, but they should be approached like moderated communities, not like a distribution network. Meta's current creator guidance emphasizes reach, engagement, and guidelines as separate disciplines, which is the right mental model here: make native posts first, then only add links where group norms allow it.[^11]

The best Facebook-group pattern is likely:

- Native image or short native video with 2-3 key bullets.
- Link in comments only if the group allows it.
- Ask a specific question to trigger discussion.

### X

X is worth keeping in the mix because it is fast for breaking-news reactions, but it should be treated as a low-confidence experiment rather than the core of the strategy. The most sensible use is probably a short thread or image-led take tied to major news, then measured strictly on click-through and subscriber conversion. Because the best first-party growth evidence in this research set is on Substack, YouTube, and Meta, NFL Lab should avoid overcommitting to X until it proves conversion in the data.[^5][^11][^13]

### YouTube Shorts, Instagram Reels, and Facebook Reels

This is the most promising non-Substack expansion. YouTube says Shorts can be up to 3 minutes, are discoverable through the Shorts feed, search results, the homepage, channel homepage, subscriptions, and notifications, and now expose explicit Shorts analytics like views, subscribers, shown in feed, and how many viewers chose to watch instead of swiping away.[^13][^14] Meta's creator guidance likewise frames Reels growth around creation, engagement, reach, and metrics in the professional dashboard.[^11]

That makes short-form video a better bet than long-form YouTube right now. One vertical master edit can be syndicated to:

- YouTube Shorts
- Instagram Reels
- Facebook Reels
- Substack video clip / Note teaser

If NFL Lab can create one reusable 30-60 second format, it can test four surfaces at once.

## Should NFL Lab do long YouTube videos or Shorts/Reels first?

Short answer: start with Shorts/Reels first, then earn the right to do long-form.

Why Shorts/Reels first:

- The production burden is dramatically lower than full-length YouTube explainers.
- NFL Lab already has article hooks, verdicts, and hero imagery that can become a short script.[^2][^18]
- YouTube explicitly gives Shorts their own discovery surfaces and dedicated metrics, which is exactly what you want for early testing.[^13][^14]
- Meta is actively teaching creators how to improve Reels reach and engagement through its dashboard guidance.[^11]

When to move into long-form YouTube:

- After 5-10 Shorts identify a repeatable on-camera voice.
- After you know which topics get watch-through and subscriber lift.
- After you can publish shorts consistently without slowing the article pipeline.

In other words: Shorts first. Long-form later, if the team finds a host and a repeatable format.

## Experiment backlog: what to run first

| ID | Experiment | Hypothesis | Success metric | Guardrail |
|---|---|---|---|---|
| E1 | Notes cluster per article | 3-4 Notes per article drive more 48-hour traffic and subscriber adds than article-only publishing | Sessions from `utm_source=substack_notes`; free-sub conversion rate | Do not exceed sustainable editorial load |
| E2 | Recommendations sprint | 5-10 aligned newsletter recommendations increase free subscribers measurably | Recommendation-attributed free subscribers | Only partner with relevant, brand-safe pubs |
| E3 | Referral ladder | Small insider rewards convert readers into acquisition channel | Referred free subs; referred paid upgrades | Reward cost must stay below target value per subscriber |
| E4 | Breaking-news Chat | Live chat after a major story increases repeat visits and paid intent | Chat participants; linked article CTR; paid upgrade rate | Do not overuse chat when news value is low |
| E5 | Substack video reaction | A 60-90 second reaction video increases in-app engagement versus text-only launch | Video plays; article CTR; app-originated subscriptions | Keep video production under 30 minutes per post |
| E6 | Reddit text-first launch | Text-led posts outperform straight link drops in high-fit subreddits | Sessions, subscribe rate, comment depth | Zero tolerance for removals across multiple communities |
| E7 | X thread format test | Thread + image card beats single outbound-link post | CTR, profile visits, free-subscriber conversions | Stop if time cost exceeds returns |
| E8 | Facebook group native-summary test | Native summary + link-in-comments beats direct link post | Clicks, comments, conversion rate | Respect every group rule |
| E9 | Shorts/Reels POC | 30-60 second vertical clips can expand top-of-funnel reach beyond text | Shorts views, shown in feed, chose-to-view, subscribers gained | Do not let video production block core publishing |
| E10 | Hero-image derivative test | Custom 9:16 and 1:1 derivatives improve post performance over article-body image reuse | CTR and subscriber conversion by creative variant | Keep asset generation automated |

## POCs worth building in this repo

### POC 1: Social package generator

Build a small generator that reads an approved `draft.md` and outputs:

- 3 Notes
- 1 X thread
- 1 Reddit post draft
- 1 Facebook caption
- 1 45-second short-video script
- 3 UTM-tagged destination URLs

Why this is the right first POC: it directly leverages the existing article artifacts and reduces the marginal cost of distribution.

### POC 2: UTM builder and naming convention

GA4 explicitly supports manual UTM tagging and surfaces session source, medium, campaign, and source/medium inside the Traffic acquisition report.[^12][^15] NFL Lab should standardize link naming immediately.

Recommended schema:

- `utm_source`: `substack_notes`, `substack_chat`, `substack_recommendation`, `reddit`, `facebook`, `x`, `youtube`, `instagram`
- `utm_medium`: `organic_social`, `substack_network`, `short_video`, `community_post`
- `utm_campaign`: `{slug}-launch`, `{slug}-24h`, `{slug}-weekend-recirculation`
- `utm_content`: `hook-a`, `hook-b`, `chart-card`, `video-cut-1`, `thread-link-reply`

This is the minimum viable measurement layer for deciding which channels actually convert.

### POC 3: Social creative derivatives from the hero image

The repo already forces the first body image to be hero-safe because it drives the share image.[^2][^18] The next logical step is generating platform-shaped variants from that same source asset:

- 9:16 vertical for Shorts/Reels covers
- 1:1 square for Instagram/Facebook feed posts
- 1.91:1 or similar wide social card for X/FB link previews

This is a practical way to improve creative quality without asking the editorial workflow for entirely new art every time.

### POC 4: Video script and shot-list generator

Use article headline, subtitle, verdict, and 2-3 core bullets to generate:

- 15-second hook
- 30-45 second script
- optional B-roll / still-image beat list
- final CTA to subscribe or read the full piece

Because Substack video, YouTube Shorts, and Reels all reward tight hooks, the script generator should be optimized for first 2-3 seconds, not for essay-style narration.[^13][^14][^17]

### POC 5: Weekly experiment scorecard

Build a simple weekly report that joins article slug, channel, creative variant, sessions, engaged sessions, key events, subscriber adds, and paid conversions. GA4's Traffic acquisition report is the right starting point because it exposes session source/medium/campaign plus engagement and key-event metrics.[^12]

If NFL Lab cannot get subscriber conversion back into GA4 directly, keep a lightweight manual attribution sheet for now. Bad-but-consistent attribution beats no attribution.

## How to measure success

### North-star metrics

1. Free subscribers per article
2. Paid conversions within 30 days of first visit
3. Engaged sessions per article launch
4. Subscriber conversion rate by channel
5. Subscribers per 1,000 impressions or views

### Channel-specific metrics

| Channel | Primary metrics | Where to read them |
|---|---|---|
| Substack Notes | Views, likes, comments, restacks, article clicks, free subs | Substack notes and publication analytics[^6] |
| Recommendations | Attributed free subscriptions | Recommendations dashboard[^7] |
| Referrals | Referred subscribers and reward progress | Referral tooling[^8] |
| Chat | Participants, replies, linked article CTR, upgrade behavior | Chat activity + linked article analytics[^16] |
| Reddit / Facebook / X | Clicks, sessions, engaged sessions, subscribe rate, removals | UTM links + GA4 + manual moderation log[^9][^12][^15] |
| YouTube Shorts | Views, shown in feed, chose to view, likes, subscribers, traffic sources | YouTube Studio Shorts analytics[^14] |
| Reels | Reach, plays, engagement, follower growth, A/B test results where available | Meta professional dashboard[^11] |

### Measurement setup

1. Create a canonical UTM taxonomy and never break it.[^15]
2. In GA4, use `Traffic acquisition` for session-level performance and `User acquisition` for new-user source analysis.[^12]
3. Mark newsletter signup and paid conversion as key events so channel reports can be compared on actual business outcomes, not just traffic.[^12]
4. For Shorts, watch `shown in feed`, `how many chose to view`, subscribers gained, and traffic sources - those are the best early signals of whether a format is working.[^14]
5. Log moderator removals and spam complaints as negative outcomes for Reddit/Facebook-group tests; traffic is not worth account or community damage.[^9]

## A practical 30-day rollout

### Week 1: instrumentation and packaging

- Define UTM taxonomy.
- Build the social package generator.
- Pick 5 ready-to-publish or already-live articles as the first test cohort.

### Week 2: Substack-native launch system

- Run Notes clusters on all 5 articles.
- Turn on referrals.
- Start 5-10 recommendation outreach conversations.
- Test one Chat event on a breaking-news or high-disagreement story.

### Week 3: external distribution tests

- Test 2-3 Reddit posts in the best-fit communities.
- Test 2 X thread variants.
- Test 2 Facebook-group-native summary posts.

### Week 4: video POC

- Make 3-5 vertical videos from breaking-news or strongest-opinion stories.
- Publish to YouTube Shorts first, then cross-post to Reels and optionally clip into Substack.
- Compare video-led launches against text-only launches.

At the end of 30 days, double down only on the channels that produce subscriber growth efficiently.

## What I would not do yet

- Do not start with wide, repetitive link-dumping into Reddit, Facebook groups, or X. That creates moderation risk and usually produces weak conversion quality.[^9]
- Do not launch a full long-form YouTube show before proving a repeatable short-video format.[^13][^14]
- Do not treat traffic as success if it does not produce subscribers, engaged sessions, or return visits.[^12]

## Bottom-line recommendation

If I were prioritizing this for NFL Lab right now, I would do the following in order:

1. Build the UTM and social-package layer.
2. Make Notes + Recommendations + Referrals the default launch motion for every article.
3. Use Chat on major news events.
4. Pilot 3-5 Shorts/Reels before building long-form video.
5. Use Reddit, Facebook groups, and X selectively for the stories that are naturally debatable.

That sequence best matches both the current repo capabilities and the strongest first-party growth surfaces in the research. It also keeps the team focused on subscriber growth, not just vanity reach.[^1][^2][^3][^5][^12][^14]

## Confidence Assessment

High confidence:

- Substack-first is the right first move because the platform itself exposes Recommendations, referrals, Notes, Chat, video, SEO, and app-based discovery, and the repo is already tuned for social-ready article publishing.[^1][^2][^3][^5][^6][^16][^17]
- Shorts/Reels are the most realistic video experiments because the production burden is low and the analytics are explicit.[^11][^13][^14]

Medium confidence:

- Reddit can work for NFL Lab, but only when the team posts like participants inside specific communities rather than as distributors.[^9]
- Facebook groups and X may produce useful bursts of traffic, but the business value should be judged strictly by subscriber conversion and repeat visits, not impressions alone.[^11][^12]

Lower confidence / inferred:

- The exact ranking between Reddit, X, and Facebook groups will depend on where NFL Lab's tone and topics resonate; that has to be learned experimentally.
- The right video host format is unknown today; the first 3-5 Shorts should be used to discover whether the strongest hook is a face-to-camera take, narrated stills, or graphic-led motion.

## Footnotes

[^1]: `C:\github\nfl-eval\.github\extensions\substack-publisher\extension.mjs:1303-1359`.
[^2]: `C:\github\nfl-eval\.github\extensions\substack-publisher\extension.mjs:785-835`.
[^3]: `C:\github\nfl-eval\.github\extensions\substack-publisher\extension.mjs:719-764`.
[^4]: `C:\github\nfl-eval\.squad\skills\substack-publishing\SKILL.md:150-178`.
[^5]: [Substack Growth Features](https://substack.com/growthfeatures).
[^6]: [Getting started on Substack Notes](https://support.substack.com/hc/en-us/articles/14564821756308-Getting-started-on-Substack-Notes).
[^7]: [How can I recommend other publications on Substack?](https://support.substack.com/hc/en-us/articles/5036794583828-How-can-I-recommend-other-publications-on-Substack).
[^8]: [What are subscriber referrals on Substack?](https://support.substack.com/hc/en-us/articles/16142857300372-What-are-subscriber-referrals-on-Substack).
[^9]: [Reddit Content Policy](https://www.redditinc.com/policies/content-policy).
[^10]: [YouTube Community Guidelines](https://support.google.com/youtube/answer/9288567?hl=en).
[^11]: [Introducing Best Practices, an Education Hub for Creators on Instagram](https://about.fb.com/news/2024/10/best-practices-education-hub-creators-instagram/).
[^12]: [[GA4] Traffic acquisition report](https://support.google.com/analytics/answer/12923437?hl=en&co=GENIE.Platform%3DDesktop).
[^13]: [Get started creating YouTube Shorts](https://support.google.com/youtube/answer/10059070?hl=en).
[^14]: [Tips to understand your Shorts performance](https://support.google.com/youtube/answer/12942217?hl=en&co=YOUTUBE._YTVideoType%3Dshorts).
[^15]: [Traffic-source dimensions, manual tagging, and auto-tagging](https://support.google.com/analytics/answer/11242870?hl=en).
[^16]: [How do I enable Chat on my Substack?](https://support.substack.com/hc/en-us/articles/10409888763668-How-do-I-enable-Chat-on-my-Substack).
[^17]: [Guide to video posts on Substack](https://support.substack.com/hc/en-us/articles/21093671091220-Guide-to-video-posts-on-Substack).
[^18]: `C:\github\nfl-eval\.squad\skills\image-generation\SKILL.md:32-48`.
