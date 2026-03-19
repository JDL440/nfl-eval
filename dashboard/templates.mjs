/**
 * templates.mjs — Server-rendered HTML templates for the pipeline dashboard.
 *
 * No template engine dependency — just tagged template literals. Each export
 * returns a complete HTML string ready to send as a response.
 */

import { STAGE_NAMES, DEPTH_NAMES, PUBLISHER_PASS_FIELDS } from "./data.mjs";
import { renderMarkdownFragment } from "./render.mjs";

// ── Helpers ──────────────────────────────────────────────────────────────────

function esc(text) {
    return String(text ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function stageBadgeClass(stage) {
    if (stage <= 2) return "badge-gray";
    if (stage <= 4) return "badge-blue";
    if (stage === 5) return "badge-yellow";
    if (stage === 6) return "badge-orange";
    if (stage === 7) return "badge-purple";
    return "badge-green";
}

function verdictBadge(verdict) {
    if (!verdict) return "";
    const cls = verdict === "APPROVED" ? "badge-green" : verdict === "REVISE" ? "badge-yellow" : "badge-red";
    return `<span class="badge ${cls}">${esc(verdict)}</span>`;
}

function statusBadge(status) {
    const cls = {
        published: "badge-green",
        in_production: "badge-blue",
        in_discussion: "badge-blue",
        proposed: "badge-gray",
        approved: "badge-purple",
        archived: "badge-dim",
    }[status] || "badge-gray";
    return `<span class="badge ${cls}">${esc(status)}</span>`;
}

// ── Layout ───────────────────────────────────────────────────────────────────

function layout(title, body, activeNav = "") {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${esc(title)} — NFL Lab Pipeline</title>
    <link rel="stylesheet" href="/style.css">
</head>
<body>
<header>
    <nav>
        <a href="/" class="logo">🏈 NFL Lab Pipeline</a>
        <a href="/" class="${activeNav === "board" ? "active" : ""}">Board</a>
    </nav>
</header>
<main>${body}</main>
<footer><p>NFL Lab Dashboard v1 · Preview, validate, and publish from pipeline.db + article artifacts</p></footer>
</body>
</html>`;
}

// ── Board page ───────────────────────────────────────────────────────────────

export function boardPage(board) {
    // KPI strip
    const stageCounts = {};
    for (const s of Object.keys(STAGE_NAMES)) stageCounts[s] = 0;
    let driftCount = 0, publishReady = 0, needsImages = 0;
    for (const row of board) {
        stageCounts[row.inferredStage] = (stageCounts[row.inferredStage] || 0) + 1;
        if (row.hasDrift) driftCount++;
        if (row.inferredStage === 7) publishReady++;
        if (row.inferredStage === 6 && row.editorVerdict === "APPROVED" && row.imageCount < 2) needsImages++;
    }

    const kpiHtml = `
    <div class="kpi-strip">
        <div class="kpi"><span class="kpi-val">${board.length}</span><span class="kpi-label">Total</span></div>
        ${Object.entries(STAGE_NAMES).map(([num, name]) =>
            `<div class="kpi"><span class="kpi-val">${stageCounts[num] || 0}</span><span class="kpi-label">S${num}</span></div>`
        ).join("")}
        <div class="kpi kpi-warn"><span class="kpi-val">${driftCount}</span><span class="kpi-label">Drift</span></div>
        <div class="kpi kpi-ok"><span class="kpi-val">${publishReady}</span><span class="kpi-label">Pub Ready</span></div>
        <div class="kpi kpi-warn"><span class="kpi-val">${needsImages}</span><span class="kpi-label">Need Images</span></div>
    </div>`;

    const tableRows = board.map(row => {
        const canQuickPublish = row.inferredStage === 7 && row.status !== "published";
        const isPublished = row.inferredStage === 8 || row.status === "published" || !!row.substackUrl;
        const actionHtml = isPublished
            ? `<span class="badge badge-green" style="font-size:0.75rem">Published</span>`
            : canQuickPublish
                ? `<button class="btn-board-publish" data-slug="${esc(row.slug)}" title="Publish ${esc(row.title)}">🚀 Publish</button>`
                : `<span class="dim" style="font-size:0.8rem">S${row.inferredStage}</span>`;
        const checkboxHtml = canQuickPublish
            ? `<input type="checkbox" class="board-select" data-slug="${esc(row.slug)}" title="Select for batch publish">`
            : "";
        return `
        <tr class="${row.hasDrift ? "drift-row" : ""}" data-slug="${esc(row.slug)}" data-stage="${row.inferredStage}" data-published="${isPublished}">
            <td class="col-select">${checkboxHtml}</td>
            <td><a href="/article/${encodeURIComponent(row.slug)}">${esc(row.title)}</a></td>
            <td>${esc(row.primaryTeam || "—")}</td>
            <td>${statusBadge(row.status)}</td>
            <td><span class="badge ${stageBadgeClass(row.inferredStage)}">S${row.inferredStage}</span> ${esc(row.stageName)}</td>
            <td>${row.hasDrift ? `<span class="drift-flag" title="DB says S${row.dbStage}, artifacts say S${row.inferredStage}">⚠ DB:S${row.dbStage}</span>` : ""}</td>
            <td>${esc(row.nextAction || "—")}</td>
            <td>${verdictBadge(row.editorVerdict)}</td>
            <td>${actionHtml}</td>
            <td>${row.substackUrl ? `<a href="${esc(row.substackUrl)}" target="_blank">Live</a>` : row.draftUrl ? `<a href="${esc(row.draftUrl)}" target="_blank">Draft</a>` : "—"}</td>
        </tr>`;
    }).join("");

    const body = `
    <h1>Pipeline Board</h1>
    ${kpiHtml}
    <div class="filter-bar">
        <input type="text" id="search" placeholder="Filter by title, team, or slug…" oninput="filterTable(this.value)">
        <select id="stage-filter" onchange="filterByStage(this.value)">
            <option value="">All Stages</option>
            ${Object.entries(STAGE_NAMES).map(([n, name]) => `<option value="${n}">S${n} ${name}</option>`).join("")}
        </select>
        <select id="status-filter" onchange="filterByStatus(this.value)">
            <option value="">All Statuses</option>
            <option value="in_production">In Production</option>
            <option value="in_discussion">In Discussion</option>
            <option value="proposed">Proposed</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
        </select>
    </div>
    <div class="table-responsive">
    <table class="board-table" id="board-table">
        <thead>
            <tr>
                <th class="col-select"><input type="checkbox" id="select-all" title="Select all publishable"></th>
                <th>Title</th>
                <th>Team</th>
                <th>Status</th>
                <th>Stage</th>
                <th>Drift</th>
                <th>Next Action</th>
                <th>Editor</th>
                <th>Actions</th>
                <th>Link</th>
            </tr>
        </thead>
        <tbody>
            ${tableRows}
        </tbody>
    </table>
    </div>

    <div class="batch-bar" id="batch-bar" style="display:none">
        <div class="batch-bar-inner">
            <span id="batch-count">0 selected</span>
            <div class="batch-bar-channels">
                <label class="channel-toggle" title="Post a Substack Note for each article">
                    <input type="checkbox" id="batch-channel-note" checked>
                    <span>📝 Note</span>
                </label>
                <label class="channel-toggle" title="Post to Twitter/X for each article">
                    <input type="checkbox" id="batch-channel-twitter">
                    <span>🐦 Tweet</span>
                </label>
            </div>
            <button class="btn btn-publish" id="batch-publish-btn">🚀 Publish Selected</button>
            <button class="btn btn-sm btn-outline" id="batch-clear-btn">Clear</button>
        </div>
        <div id="batch-results"></div>
    </div>
    <script>
    function filterTable(query) {
        const q = query.toLowerCase();
        document.querySelectorAll('#board-table tbody tr').forEach(tr => {
            tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
        });
    }
    function filterByStage(val) {
        document.querySelectorAll('#board-table tbody tr').forEach(tr => {
            if (!val) { tr.style.display = ''; return; }
            const stage = tr.getAttribute('data-stage');
            tr.style.display = stage === val ? '' : 'none';
        });
    }
    function filterByStatus(val) {
        document.querySelectorAll('#board-table tbody tr').forEach(tr => {
            if (!val) { tr.style.display = ''; return; }
            const badge = tr.querySelector('td:nth-child(4) .badge');
            tr.style.display = badge?.textContent === val ? '' : 'none';
        });
    }
    function escHtml(s) {
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    // ── Batch selection ──
    function updateBatchBar() {
        const checked = document.querySelectorAll('.board-select:checked');
        const bar = document.getElementById('batch-bar');
        const count = document.getElementById('batch-count');
        if (checked.length > 0) {
            bar.style.display = 'block';
            count.textContent = checked.length + ' selected';
        } else {
            bar.style.display = 'none';
        }
    }

    document.getElementById('select-all').addEventListener('change', function() {
        const all = document.querySelectorAll('.board-select');
        all.forEach(cb => { if (cb.closest('tr').style.display !== 'none') cb.checked = this.checked; });
        updateBatchBar();
    });

    document.querySelectorAll('.board-select').forEach(cb => {
        cb.addEventListener('change', updateBatchBar);
    });

    document.getElementById('batch-clear-btn').addEventListener('click', function() {
        document.querySelectorAll('.board-select').forEach(cb => cb.checked = false);
        document.getElementById('select-all').checked = false;
        updateBatchBar();
    });

    // ── Single-row publish ──
    document.querySelectorAll('.btn-board-publish').forEach(btn => {
        btn.addEventListener('click', async function(e) {
            e.stopPropagation();
            const slug = this.dataset.slug;
            const row = this.closest('tr');
            this.disabled = true;
            this.textContent = '⏳…';

            try {
                const resp = await fetch('/api/publish/' + encodeURIComponent(slug), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ channels: ['substack_note'], target: 'prod' }),
                });
                let data = await resp.json();

                if (data.status === 'RUNNING') {
                    for (let i = 0; i < 40; i++) {
                        await new Promise(r => setTimeout(r, 3000));
                        const poll = await fetch('/api/publish/' + encodeURIComponent(slug));
                        data = await poll.json();
                        if (data.status !== 'RUNNING') break;
                    }
                }

                if (data.status === 'PASS') {
                    this.textContent = '✅ Done';
                    this.classList.add('btn-board-done');
                    if (data.publishedUrl) {
                        const linkTd = row.querySelector('td:last-child');
                        linkTd.innerHTML = '<a href="' + escHtml(data.publishedUrl) + '" target="_blank">Live</a>';
                    }
                } else {
                    this.textContent = '❌ Error';
                    this.title = data.error || data.reason || 'Unknown error';
                }
            } catch (err) {
                this.textContent = '❌ Failed';
                this.title = err.message;
            }
        });
    });

    // ── Batch publish ──
    document.getElementById('batch-publish-btn').addEventListener('click', async function() {
        const selected = Array.from(document.querySelectorAll('.board-select:checked')).map(cb => cb.dataset.slug);
        if (selected.length === 0) return;

        const channels = [];
        if (document.getElementById('batch-channel-note').checked) channels.push('substack_note');
        if (document.getElementById('batch-channel-twitter').checked) channels.push('twitter');

        this.disabled = true;
        this.textContent = '⏳ Publishing ' + selected.length + '…';
        const resultsDiv = document.getElementById('batch-results');
        resultsDiv.innerHTML = '';

        for (const slug of selected) {
            const item = document.createElement('div');
            item.className = 'batch-result-item';
            item.innerHTML = '<span class="batch-slug">' + escHtml(slug) + '</span> <span class="batch-status">⏳ Publishing…</span>';
            resultsDiv.appendChild(item);

            const rowBtn = document.querySelector('.btn-board-publish[data-slug="' + slug + '"]');
            if (rowBtn) { rowBtn.disabled = true; rowBtn.textContent = '⏳…'; }

            try {
                const resp = await fetch('/api/publish/' + encodeURIComponent(slug), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ channels, target: 'prod' }),
                });
                let data = await resp.json();

                if (data.status === 'RUNNING') {
                    for (let i = 0; i < 40; i++) {
                        await new Promise(r => setTimeout(r, 3000));
                        const poll = await fetch('/api/publish/' + encodeURIComponent(slug));
                        data = await poll.json();
                        if (data.status !== 'RUNNING') break;
                    }
                }

                if (data.status === 'PASS') {
                    item.querySelector('.batch-status').innerHTML = '✅ Published' + (data.publishedUrl ? ' — <a href="' + escHtml(data.publishedUrl) + '" target="_blank">View ↗</a>' : '');
                    if (rowBtn) { rowBtn.textContent = '✅ Done'; rowBtn.classList.add('btn-board-done'); }
                } else {
                    item.querySelector('.batch-status').innerHTML = '❌ ' + escHtml(data.error || data.reason || data.status);
                    if (rowBtn) { rowBtn.textContent = '❌ Error'; rowBtn.title = data.error || ''; }
                }
            } catch (err) {
                item.querySelector('.batch-status').innerHTML = '❌ ' + escHtml(err.message);
                if (rowBtn) { rowBtn.textContent = '❌ Failed'; }
            }
        }

        this.disabled = false;
        this.textContent = '🚀 Publish Selected';
    });
    </script>`;

    return layout("Board", body, "board");
}

// ── Document card helper ──────────────────────────────────────────────────────

function docCard(doc, slug) {
    const rendered = renderMarkdownFragment(doc.content, slug);
    const sourceId = `src-${doc.name.replace(/[^a-z0-9]/gi, "-")}`;
    const rawSafe = esc(doc.content.length > 60000 ? doc.content.slice(0, 60000) + "\n\n… (truncated)" : doc.content);
    return `<div class="doc-card">
        <div class="doc-card-header">
            <span class="doc-card-label">📄 ${esc(doc.label)}</span>
            <span class="dim doc-card-meta">${esc(doc.name)} · ${formatBytes(doc.size)}</span>
        </div>
        <div class="doc-card-body rendered-md">${rendered}</div>
        <details class="doc-source" id="${sourceId}">
            <summary>View source</summary>
            <pre><code>${rawSafe}</code></pre>
        </details>
    </div>`;
}

function docGroup(docs, slug, emptyMsg = "No documents found.") {
    if (!docs || docs.length === 0) return `<p class="dim">${esc(emptyMsg)}</p>`;
    return docs.map(d => docCard(d, slug)).join("");
}

// ── Article detail page ──────────────────────────────────────────────────────

export function articlePage(detail) {
    const { slug, article, inferred, artifacts, images, documents, transitions, editorReviews, publisherPass, panels, notes, prompt, hasDrift, validationResults, publishState, publishResults } = detail;
    const title = article?.title || slug;

    // Left rail summary
    const leftRail = `
    <div class="detail-rail">
        <h2>${esc(title)}</h2>
        ${article?.subtitle ? `<p class="subtitle">${esc(article.subtitle)}</p>` : ""}
        <dl>
            <dt>Slug</dt><dd><code>${esc(slug)}</code></dd>
            <dt>Team</dt><dd>${esc(article?.primary_team || "—")}</dd>
            <dt>Status</dt><dd>${statusBadge(article?.status || "proposed")}</dd>
            <dt>DB Stage</dt><dd>${article?.current_stage != null ? `S${article.current_stage}` : "—"}</dd>
            <dt>Inferred Stage</dt><dd><span class="badge ${stageBadgeClass(inferred.stage)}">S${inferred.stage}</span> ${esc(inferred.stageName)}</dd>
            ${hasDrift ? `<dt>Drift</dt><dd><span class="drift-flag">⚠ DB and artifacts disagree</span></dd>` : ""}
            <dt>Next Action</dt><dd>${esc(inferred.nextAction || "—")}</dd>
            <dt>Depth</dt><dd>${esc(DEPTH_NAMES[article?.depth_level] || "The Beat")}</dd>
            <dt>Publish Window</dt><dd>${esc(article?.publish_window || "—")}</dd>
            <dt>Target Date</dt><dd>${esc(article?.target_publish_date || "—")}</dd>
            ${article?.substack_url ? `<dt>Live URL</dt><dd><a href="${esc(article.substack_url)}" target="_blank">View on Substack ↗</a></dd>` : ""}
            ${article?.substack_draft_url ? `<dt>Draft URL</dt><dd><a href="${esc(article.substack_draft_url)}" target="_blank">Edit Draft ↗</a></dd>` : ""}
            <dt>Updated</dt><dd>${esc(article?.updated_at || "—")}</dd>
        </dl>
    </div>`;

    const docs = documents || [];
    const overviewDocs = docs.filter(d => d.group === "overview");
    const panelDocs   = docs.filter(d => d.group === "panel");
    const draftDocs   = docs.filter(d => d.group === "draft");
    const verifyDocs  = docs.filter(d => d.group === "verify");
    const publishDocs = docs.filter(d => d.group === "publish");
    const otherDocs   = docs.filter(d => d.group === "other");

    // Tabs
    const tabs = [
        { id: "overview", label: "Overview", content: overviewTab(inferred, artifacts, images, overviewDocs, slug) },
        { id: "panel", label: "Prompt & Panel", content: panelTab(prompt, panels, slug, artifacts, panelDocs) },
        { id: "draft", label: "Draft & Edits", content: draftTab(slug, editorReviews, artifacts, draftDocs, verifyDocs) },
        { id: "assets", label: "Assets", content: assetsTab(artifacts, images, otherDocs, slug) },
        { id: "preview", label: "Preview", content: `<div id="preview-pane"><a href="/preview/${encodeURIComponent(slug)}" target="_blank" class="btn">Open Canonical Preview →</a><p class="note">Preview renders draft.md through the publisher ProseMirror pipeline with subscribe-button injection, hero-image enforcement, and dense-table warnings.</p></div>` },
        { id: "validation", label: "Validation", content: validationTab(slug, article, validationResults) },
        { id: "publish", label: "Publish & Notes", content: publishTab(publisherPass, notes, article, publishDocs, slug, publishState, publishResults) },
        { id: "timeline", label: "Timeline", content: timelineTab(transitions) },
    ];

    const tabNav = tabs.map((t, i) =>
        `<button class="tab-btn${i === 0 ? " active" : ""}" onclick="showTab('${t.id}')">${t.label}</button>`
    ).join("");

    const tabPanes = tabs.map((t, i) =>
        `<div class="tab-pane${i === 0 ? " active" : ""}" id="tab-${t.id}">${t.content}</div>`
    ).join("");

    const body = `
    ${publishBar(slug, publishState, publishResults)}
    <div class="detail-layout">
        ${leftRail}
        <div class="detail-content">
            <div class="tab-bar">${tabNav}</div>
            ${tabPanes}
        </div>
    </div>
    ${publishBarScript(slug)}`;

    return layout(title, body, "");
}

// ── Publish bar (always visible at top of article page) ─────────────────────

function publishBar(slug, publishState, publishResults) {
    const noteChannel = publishState?.promotionChannels?.substack_note;
    const noteDefaultChecked = noteChannel?.defaultSelected ? "checked" : "";
    const noteDisabled = noteChannel?.blockedReason ? "disabled" : "";

    const twitterChannel = publishState?.promotionChannels?.twitter;
    const twitterDefaultChecked = twitterChannel?.defaultSelected ? "checked" : "";
    const twitterDisabled = twitterChannel?.blockedReason ? "disabled" : "";

    const isPublished = publishState?.isPublished;
    const canPublish = publishState?.canPublish;

    if (isPublished) {
        return `<div class="publish-bar publish-bar-done">
            <div class="publish-bar-status">✅ Published</div>
            <div class="publish-bar-links">
                ${publishResults?.publishedUrl ? `<a href="${esc(publishResults.publishedUrl)}" target="_blank" class="btn btn-sm">View Live Article ↗</a>` : ""}
                ${publishResults?.draftUrl ? `<a href="${esc(publishResults.draftUrl)}" target="_blank" class="btn btn-sm btn-outline">Edit Draft ↗</a>` : ""}
            </div>
        </div>`;
    }

    const blockedHtml = publishState?.blockedReasons?.length
        ? `<details class="publish-bar-blockers"><summary>⚠️ ${publishState.blockedReasons.length} blocking issue(s)</summary><ul>${publishState.blockedReasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul></details>`
        : "";

    return `<div class="publish-bar${canPublish ? " publish-bar-ready" : " publish-bar-blocked"}">
        <div class="publish-bar-main">
            <div class="publish-bar-controls">
                <button class="btn btn-publish${canPublish ? "" : " btn-disabled"}"
                    id="bar-btn-publish"
                    ${canPublish ? "" : "disabled"}>🚀 Publish Live</button>
                <div class="publish-bar-channels">
                    <label class="channel-toggle${noteChannel?.blockedReason ? " channel-toggle-disabled" : ""}" title="${esc(noteChannel?.blockedReason || "Post a Substack Note with article card")}">
                        <input type="checkbox" id="bar-channel-note" ${noteDefaultChecked} ${noteDisabled}>
                        <span>📝 Note</span>
                    </label>
                    <label class="channel-toggle${twitterChannel?.blockedReason ? " channel-toggle-disabled" : ""}" title="${esc(twitterChannel?.blockedReason || "Post article link to Twitter/X")}">
                        <input type="checkbox" id="bar-channel-twitter" ${twitterDefaultChecked} ${twitterDisabled}>
                        <span>🐦 Tweet</span>
                    </label>
                </div>
            </div>
            <div class="publish-bar-info">
                ${canPublish
                    ? `<span class="publish-bar-status-text">✅ Ready to publish</span>`
                    : `<span class="publish-bar-status-text">🚫 Not ready</span>`}
                ${publishState?.draftUrl
                    ? `<a href="${esc(publishState.draftUrl)}" target="_blank" class="dim">Draft ↗</a>`
                    : ""}
                <a href="/preview/${encodeURIComponent(slug)}" target="_blank" class="dim">Preview ↗</a>
            </div>
        </div>
        ${blockedHtml}
        <div id="bar-publish-result">${renderPublishResultCard(publishResults)}</div>
    </div>`;
}

function publishBarScript(slug) {
    return `<script>
    function showTab(id) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        document.querySelector('[onclick="showTab(\\'' + id + '\\')"]').classList.add('active');
        document.getElementById('tab-' + id).classList.add('active');
    }

    (function() {
        const publishBtn = document.getElementById('bar-btn-publish');
        if (!publishBtn) return;

        publishBtn.addEventListener('click', async function() {
            const noteCheckbox = document.getElementById('bar-channel-note');
            const twitterCheckbox = document.getElementById('bar-channel-twitter');
            const channels = [];
            if (noteCheckbox && noteCheckbox.checked && !noteCheckbox.disabled) channels.push('substack_note');
            if (twitterCheckbox && twitterCheckbox.checked && !twitterCheckbox.disabled) channels.push('twitter');

            publishBtn.disabled = true;
            publishBtn.textContent = '⏳ Publishing…';
            const barResult = document.getElementById('bar-publish-result');
            const tabResult = document.getElementById('publish-result');
            const statusHtml = '<div class="validation-running"><span class="spinner"></span> Publishing live article… this can take 15–30 seconds.</div>';
            barResult.innerHTML = statusHtml;
            if (tabResult) tabResult.innerHTML = statusHtml;

            try {
                const resp = await fetch('/api/publish/' + encodeURIComponent('${slug}'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ channels, target: 'prod' }),
                });
                const data = await resp.json();
                barResult.innerHTML = renderPublishResultCard(data);
                if (tabResult) tabResult.innerHTML = renderPublishResultCard(data);
                if (data.status === 'RUNNING') {
                    await pollPublishStatus('${slug}', barResult, tabResult);
                }
            } catch (err) {
                const errHtml = '<div class="validation-result validation-error"><strong>Publish request failed:</strong> ' + publishEscHtml(err.message || err) + '</div>';
                barResult.innerHTML = errHtml;
                if (tabResult) tabResult.innerHTML = errHtml;
            } finally {
                publishBtn.disabled = false;
                publishBtn.textContent = '🚀 Publish Live';
            }
        });
    })();

    async function pollPublishStatus(slug, barResult, tabResult) {
        for (let attempt = 0; attempt < 50; attempt += 1) {
            const resp = await fetch('/api/publish/' + encodeURIComponent(slug));
            const data = await resp.json();
            const html = renderPublishResultCard(data);
            barResult.innerHTML = html;
            if (tabResult) tabResult.innerHTML = html;
            if (!data || data.status !== 'RUNNING') return;
            await new Promise((resolve) => setTimeout(resolve, 3000));
        }
    }

    function renderPublishResultCard(data) {
        if (!data || (!data.status && !data.error)) return '<p class="dim">No publish attempts recorded yet.</p>';

        const statusIcon = { RUNNING: '⏳', PASS: '✅', PARTIAL: '⚠️', PREREQ_FAIL: '🚫', ERROR: '💥' }[data.status] || '❓';
        const statusClass = { RUNNING: 'validation-running-state', PASS: 'validation-pass', PARTIAL: 'validation-warn', PREREQ_FAIL: 'validation-prereq', ERROR: 'validation-error' }[data.status] || 'validation-warn';

        let html = '<div class="validation-result ' + statusClass + '">';
        html += '<p><strong>' + statusIcon + ' ' + publishEscHtml(data.status) + '</strong>';
        if (data.timestamp) html += ' <span class="dim">— ' + new Date(data.timestamp).toLocaleString() + '</span>';
        html += '</p>';

        if (data.reason) html += '<p>' + publishEscHtml(data.reason) + '</p>';
        if (data.error) html += '<p class="validation-error-text">' + publishEscHtml(data.error) + '</p>';
        if (data.target) html += '<p class="dim">Target: <strong>' + publishEscHtml(data.target) + '</strong></p>';
        if (data.filePath) html += '<p class="dim">Source: <code>' + publishEscHtml(data.filePath) + '</code></p>';
        if (data.draftUrl) html += '<p class="dim">Draft: <a href="' + publishEscHtml(data.draftUrl) + '" target="_blank">' + publishEscHtml(data.draftUrl) + '</a></p>';
        if (data.publishedUrl) html += '<p><strong>🔗 Live article:</strong> <a href="' + publishEscHtml(data.publishedUrl) + '" target="_blank">' + publishEscHtml(data.publishedUrl) + '</a></p>';
        if (data.heroWarning) html += '<p class="dim">' + publishEscHtml(data.heroWarning) + '</p>';
        if (data.tags && data.tags.length > 0) html += '<p class="dim">Tags: ' + data.tags.map(publishEscHtml).join(', ') + '</p>';

        if (data.warnings && data.warnings.length > 0) {
            html += '<details><summary>' + data.warnings.length + ' warning(s)</summary><ul>';
            data.warnings.forEach(function(w) { html += '<li>' + publishEscHtml(w) + '</li>'; });
            html += '</ul></details>';
        }

        if (data.channelResults && data.channelResults.substack_note) {
            const note = data.channelResults.substack_note;
            html += '<div class="publish-channel-card">';
            html += '<p><strong>📝 Substack Note</strong> — ' + publishEscHtml(note.status) + '</p>';
            if (note.teaserText) html += '<p class="dim">' + publishEscHtml(note.teaserText) + '</p>';
            if (note.noteUrl) html += '<p><a href="' + publishEscHtml(note.noteUrl) + '" target="_blank">View Note ↗</a></p>';
            if (note.error) html += '<p class="validation-error-text">' + publishEscHtml(note.error) + '</p>';
            if (note.reason) html += '<p class="dim">' + publishEscHtml(note.reason) + '</p>';
            html += '</div>';
        }

        if (data.channelResults && data.channelResults.twitter) {
            const tw = data.channelResults.twitter;
            html += '<div class="publish-channel-card">';
            html += '<p><strong>🐦 Twitter/X</strong> — ' + publishEscHtml(tw.status) + '</p>';
            if (tw.tweetText) html += '<p class="dim">' + publishEscHtml(tw.tweetText) + '</p>';
            if (tw.tweetUrl) html += '<p><a href="' + publishEscHtml(tw.tweetUrl) + '" target="_blank">View Tweet ↗</a></p>';
            if (tw.error) html += '<p class="validation-error-text">' + publishEscHtml(tw.error) + '</p>';
            if (tw.reason) html += '<p class="dim">' + publishEscHtml(tw.reason) + '</p>';
            html += '</div>';
        }

        if (data.blockedReasons && data.blockedReasons.length > 0) {
            html += '<details><summary>' + data.blockedReasons.length + ' blocking reason(s)</summary><ul>';
            data.blockedReasons.forEach(function(reason) { html += '<li>' + publishEscHtml(reason) + '</li>'; });
            html += '</ul></details>';
        }

        html += '</div>';
        return html;
    }

    function publishEscHtml(value) {
        const element = document.createElement('div');
        element.textContent = value == null ? '' : String(value);
        return element.innerHTML;
    }
    </script>`;
}

// ── Tab renderers ────────────────────────────────────────────────────────────

function overviewTab(inferred, artifacts, images, overviewDocs, slug) {
    const hasFactCheck = artifacts.some(a => a.name === "panel-factcheck.md");
    let html = `
    <h3>Stage Inference</h3>
    <p><strong>${esc(inferred.stageName)}</strong> — ${esc(inferred.detail)}${hasFactCheck ? ` <span class="badge badge-green">✓ Fact-Checked</span>` : ""}</p>
    ${inferred.nextAction ? `<p>Next: <strong>${esc(inferred.nextAction)}</strong></p>` : ""}
    ${inferred.editorVerdict ? `<p>Editor: ${verdictBadge(inferred.editorVerdict)}</p>` : ""}`;

    if (overviewDocs.length > 0) {
        html += `<h3>Idea</h3>${docGroup(overviewDocs, slug)}`;
    }

    html += `
    <h3>Artifacts (${artifacts.length})</h3>
    <ul class="artifact-list">
        ${artifacts.map(a => `<li>${a.isMarkdown ? "📄" : a.isImage ? "🖼️" : "📎"} ${esc(a.name)} <span class="dim">(${formatBytes(a.size)})</span></li>`).join("")}
    </ul>
    <h3>Images (${images.length})</h3>
    ${images.length > 0 ? `<div class="image-grid">${images.map(img => `<div class="thumb"><img src="/image/${encodeURIComponent(img.path)}" alt="${esc(img.name)}" loading="lazy"><span>${esc(img.name)}</span></div>`).join("")}</div>` : "<p class='dim'>No images found.</p>"}
    <h3>Token / Cost Telemetry</h3>
    <div class="placeholder-box">📊 Not yet instrumented — telemetry schema pending.</div>`;

    return html;
}

function panelTab(prompt, panels, slug, artifacts, panelDocs) {
    let html = "<h3>Discussion Prompt</h3>";

    const promptDoc = panelDocs.find(d => d.name === "discussion-prompt.md");
    if (promptDoc) {
        html += docCard(promptDoc, slug);
    } else if (prompt) {
        html += `<div class="artifact-card">
            <p><strong>Central Question:</strong> ${esc(prompt.central_question)}</p>
            <p><strong>Tension:</strong> ${esc(prompt.tension)}</p>
            ${prompt.why_worth_reading ? `<p><strong>Why Worth Reading:</strong> ${esc(prompt.why_worth_reading)}</p>` : ""}
        </div>`;
    } else {
        html += `<p class="dim">No discussion prompt found.</p>`;
    }

    const compositionDoc = panelDocs.find(d => d.name === "panel-composition.md");
    if (compositionDoc) {
        html += `<h3>Panel Composition</h3>${docCard(compositionDoc, slug)}`;
    }

    html += "<h3>Panel Positions</h3>";
    const positionDocs = panelDocs.filter(d => d.name.endsWith("-position.md"));
    if (positionDocs.length > 0) {
        html += docGroup(positionDocs, slug);
    } else if (panels.length > 0) {
        html += '<table class="mini-table"><thead><tr><th>Agent</th><th>Role</th><th>Done</th></tr></thead><tbody>';
        for (const p of panels) {
            html += `<tr><td>${esc(p.agent_name)}</td><td>${esc(p.role || "—")}</td><td>${p.analysis_complete ? "✅" : "⏳"}</td></tr>`;
        }
        html += "</tbody></table>";
    } else {
        html += `<p class="dim">No panel outputs found.</p>`;
    }

    const synthesisDocs = panelDocs.filter(d => /^discussion-(summary|synthesis)\.md$/.test(d.name));
    if (synthesisDocs.length > 0) {
        html += `<h3>Discussion Synthesis</h3>${docGroup(synthesisDocs, slug)}`;
    }

    return html;
}

function draftTab(slug, editorReviews, artifacts, draftDocs, verifyDocs) {
    let html = "<h3>Draft</h3>";
    const draftFileDocs = draftDocs.filter(d => /^draft(?:-.+)?\.md$/.test(d.name));
    if (draftFileDocs.length > 0) {
        html += `<p><a href="/preview/${encodeURIComponent(slug)}" target="_blank" class="btn">Open Canonical Preview →</a></p>`;
        html += docGroup(draftFileDocs, slug);
    } else {
        html += `<p class="dim">No draft.md found.</p>`;
    }

    html += "<h3>Fact-Check Verification</h3>";
    if (verifyDocs && verifyDocs.length > 0) {
        html += `<p><span class="badge badge-green">✓ Verification Complete</span></p>`;
        html += docGroup(verifyDocs, slug);
    } else {
        html += `<p class="dim">No fact-check artifact found. Run the preflight gate between Stage 4 and Stage 5.</p>`;
    }

    html += "<h3>Editor Reviews</h3>";
    const reviewDocs = draftDocs.filter(d => /^editor-/.test(d.name));
    if (reviewDocs.length > 0) {
        if (editorReviews.length > 0) {
            for (const r of editorReviews) {
                html += `<div class="review-card">
                    <p><strong>Review #${r.review_number}</strong> ${verdictBadge(r.verdict)}</p>
                    <p>🔴 ${r.error_count} errors · 🟡 ${r.suggestion_count} suggestions · 🟢 ${r.note_count} notes</p>
                    <p class="dim">${esc(r.reviewed_at)}</p>
                </div>`;
            }
        }
        html += docGroup(reviewDocs, slug);
    } else if (editorReviews.length > 0) {
        for (const r of editorReviews) {
            html += `<div class="review-card">
                <p><strong>Review #${r.review_number}</strong> ${verdictBadge(r.verdict)}</p>
                <p>🔴 ${r.error_count} errors · 🟡 ${r.suggestion_count} suggestions · 🟢 ${r.note_count} notes</p>
                <p class="dim">${esc(r.reviewed_at)}</p>
            </div>`;
        }
    } else {
        html += `<p class="dim">No editor reviews found.</p>`;
    }

    return html;
}

function assetsTab(artifacts, images, otherDocs, slug) {
    let html = `<h3>All Artifacts (${artifacts.length})</h3>`;
    html += '<table class="mini-table"><thead><tr><th>File</th><th>Size</th><th>Modified</th></tr></thead><tbody>';
    for (const a of artifacts) {
        html += `<tr><td>${a.isMarkdown ? "📄" : a.isImage ? "🖼️" : "📎"} ${esc(a.name)}</td><td>${formatBytes(a.size)}</td><td>${esc(a.modified.slice(0, 16))}</td></tr>`;
    }
    html += "</tbody></table>";

    if (images.length > 0) {
        html += `<h3>Images (${images.length})</h3>`;
        html += `<div class="image-grid">${images.map(img =>
            `<div class="thumb"><img src="/image/${encodeURIComponent(img.path)}" alt="${esc(img.name)}" loading="lazy"><span>${esc(img.name)}</span></div>`
        ).join("")}</div>`;
    }

    if (otherDocs.length > 0) {
        html += `<h3>Other Documents (${otherDocs.length})</h3>`;
        html += docGroup(otherDocs, slug);
    }

    return html;
}

function publishTab(publisherPass, notes, article, publishDocs, slug, publishState, publishResults) {
    let html = "<h3>Publisher Pass</h3>";
    if (publisherPass) {
        html += '<div class="checklist">';
        for (const { key, label } of PUBLISHER_PASS_FIELDS) {
            html += `<div class="check-item">${publisherPass[key] ? "✅" : "❌"} ${esc(label)}</div>`;
        }
        html += "</div>";
    } else {
        html += `<p class="dim">No publisher pass recorded in DB.</p>`;
    }

    if (publishDocs.length > 0) {
        html += docGroup(publishDocs, slug);
    }

    html += `<h3>Publish Details</h3>
    <div class="publish-section">
        <p class="note">The publish button at the top of the page creates or refreshes the Substack draft, publishes it live via the Substack API, and runs any selected promotion channels.</p>
        <dl class="publish-meta">
            <dt>Source article</dt><dd>${esc(publishState?.filePath || "—")}</dd>
            <dt>Current draft URL</dt><dd>${publishState?.draftUrl ? `<a href="${esc(publishState.draftUrl)}" target="_blank">Open Draft ↗</a>` : "No production draft stored yet — one will be created during publish."}</dd>
            <dt>Publish method</dt><dd>Direct Substack API (no browser automation)</dd>
        </dl>
        ${publishState?.previewWarnings?.length
            ? `<div class="publish-prereq-warn"><p><strong>Canonical preview blockers</strong></p><ul>${publishState.previewWarnings.map((warning) => `<li>${esc(warning.message)}</li>`).join("")}</ul></div>`
            : ""}
        ${publishState?.blockedReasons?.length
            ? `<div class="publish-prereq-warn"><p>⚠️ <strong>Publish blocked</strong></p><ul>${publishState.blockedReasons.map((reason) => `<li>${esc(reason)}</li>`).join("")}</ul></div>`
            : `<div class="validation-result validation-pass"><p><strong>✅ Ready for dashboard publish</strong></p><p>Publisher pass is complete and the dashboard can publish this article live.</p></div>`}
        <div id="publish-result">${renderPublishResultCard(publishResults)}</div>
    </div>`;

    html += "<h3>Notes</h3>";
    if (notes.length > 0) {
        for (const n of notes) {
            html += `<div class="note-card">
                <p><strong>${esc(n.note_type)}</strong> · ${esc(n.target)} · by ${esc(n.created_by || "—")} · ${esc(n.created_at)}</p>
                <p>${esc(n.content?.slice(0, 200))}${n.content?.length > 200 ? "…" : ""}</p>
                ${n.substack_note_url ? `<a href="${esc(n.substack_note_url)}" target="_blank">View Note ↗</a>` : ""}
            </div>`;
        }
    } else {
        html += `<p class="dim">No notes recorded.</p>`;
    }

    return html;
}

function renderPublishResultCard(result) {
    if (!result || (!result.status && !result.error)) return `<p class="dim">No publish attempts recorded yet.</p>`;

    const statusIcon = { RUNNING: "⏳", PASS: "✅", PARTIAL: "⚠️", PREREQ_FAIL: "🚫", ERROR: "💥" }[result.status] || "❓";
    const statusClass = { RUNNING: "validation-running-state", PASS: "validation-pass", PARTIAL: "validation-warn", PREREQ_FAIL: "validation-prereq", ERROR: "validation-error" }[result.status] || "validation-warn";

    let html = `<div class="validation-result ${statusClass}">`;
    html += `<p><strong>${statusIcon} ${esc(result.status)}</strong>`;
    if (result.timestamp) html += ` <span class="dim">— ${esc(result.timestamp)}</span>`;
    html += `</p>`;

    if (result.reason) html += `<p>${esc(result.reason)}</p>`;
    if (result.error) html += `<p class="validation-error-text">${esc(result.error)}</p>`;
    if (result.target) html += `<p class="dim">Target: <strong>${esc(result.target)}</strong></p>`;
    if (result.filePath) html += `<p class="dim">Source: <code>${esc(result.filePath)}</code></p>`;
    if (result.draftUrl) html += `<p class="dim">Draft: <a href="${esc(result.draftUrl)}" target="_blank">${esc(result.draftUrl)}</a></p>`;
    if (result.publishedUrl) html += `<p><strong>🔗 Live article:</strong> <a href="${esc(result.publishedUrl)}" target="_blank">${esc(result.publishedUrl)}</a></p>`;
    if (result.warnings?.length) {
        html += `<details><summary>${result.warnings.length} warning(s)</summary><ul>`;
        html += result.warnings.map((warning) => `<li>${esc(warning)}</li>`).join("");
        html += `</ul></details>`;
    }
    if (result.channelResults?.substack_note) {
        const note = result.channelResults.substack_note;
        html += `<div class="publish-channel-card">`;
        html += `<p><strong>Substack Note</strong> — ${esc(note.status)}</p>`;
        if (note.teaserText) html += `<p class="dim">${esc(note.teaserText)}</p>`;
        if (note.noteUrl) html += `<p><a href="${esc(note.noteUrl)}" target="_blank">View Note ↗</a></p>`;
        if (note.error) html += `<p class="validation-error-text">${esc(note.error)}</p>`;
        if (note.reason) html += `<p class="dim">${esc(note.reason)}</p>`;
        html += `</div>`;
    }
    html += `</div>`;
    return html;
}

function validationTab(slug, article, validationResults) {
    const hasDraftUrl = !!article?.substack_draft_url;
    const isStageDraft = hasDraftUrl && /stage/i.test(article.substack_draft_url);
    const canRunValidation = hasDraftUrl && isStageDraft;
    const encodedSlug = encodeURIComponent(slug);

    let html = `<h3>Live Validation</h3>
    <p class="note">Run Playwright-based browser validation against the Substack draft. Requires <code>SUBSTACK_TOKEN</code> in <code>.env</code> and a stage draft URL in pipeline.db. These do <strong>not</strong> run automatically — click to trigger.</p>`;

    if (!hasDraftUrl) {
        html += `<div class="validation-prereq-warn">
            <p>⚠️ <strong>No draft URL</strong> — this article must be published to Substack (Stage 7+) before browser validation is available.</p>
        </div>`;
    } else if (!isStageDraft) {
        html += `<div class="validation-prereq-warn">
            <p>⚠️ <strong>Stage-only guard</strong> — dashboard-triggered browser validation is only enabled for stage Substack drafts.</p>
        </div>`;
    }

    // Editor validation section
    html += `<div class="validation-section">
        <div class="validation-header">
            <h4>🖥️ Editor Schema Validation</h4>
            <button class="btn btn-sm${canRunValidation ? "" : " btn-disabled"}" id="btn-validate-editor"
                onclick="runValidation('editor', '${encodedSlug}')"
                ${canRunValidation ? "" : "disabled"}>Run Editor Check</button>
        </div>
        <p class="note">Opens draft in desktop Chromium, checks for ProseMirror RangeError / schema errors.</p>
        <div id="result-editor">${validationResultCard(validationResults?.editor, "editor", slug)}</div>
    </div>`;

    // Mobile validation section
    html += `<div class="validation-section">
        <div class="validation-header">
            <h4>📱 Mobile Preview Validation</h4>
            <button class="btn btn-sm${canRunValidation ? "" : " btn-disabled"}" id="btn-validate-mobile"
                onclick="runValidation('mobile', '${encodedSlug}')"
                ${canRunValidation ? "" : "disabled"}>Run Mobile Check</button>
        </div>
        <p class="note">Opens draft at 375px mobile viewport (2× DPR), captures screenshots, measures image readability.</p>
        <div id="result-mobile">${validationResultCard(validationResults?.mobile, "mobile", slug)}</div>
    </div>`;

    // Client-side JS for triggering validation
    html += `
    <script>
    async function runValidation(type, slug) {
        const btn = document.getElementById('btn-validate-' + type);
        const resultDiv = document.getElementById('result-' + type);
        btn.disabled = true;
        btn.textContent = 'Running…';
        resultDiv.innerHTML = '<div class="validation-running"><span class="spinner"></span> Launching browser and validating… this may take 30–60 seconds.</div>';

        try {
            const resp = await fetch('/api/validate/' + type + '/' + slug, { method: 'POST' });
            await resp.json();
            await pollValidation(type, slug, resultDiv);
        } catch (err) {
            resultDiv.innerHTML = '<div class="validation-result validation-error"><strong>Request failed:</strong> ' + (err.message || err) + '</div>';
        } finally {
            btn.disabled = false;
            btn.textContent = type === 'editor' ? 'Run Editor Check' : 'Run Mobile Check';
        }
    }

    async function pollValidation(type, slug, resultDiv) {
        for (let attempt = 0; attempt < 40; attempt += 1) {
            const resp = await fetch('/api/validation/' + slug);
            const data = await resp.json();
            const result = data ? data[type] : null;
            resultDiv.innerHTML = renderValidationResult(result, type, slug);
            if (!result || result.status !== 'RUNNING') return;
            await new Promise((resolve) => setTimeout(resolve, 3000));
        }
    }

    function renderValidationResult(data, type, slug) {
        if (!data || (!data.status && !data.error)) return '<p class="dim">No results yet.</p>';
        const statusIcon = { RUNNING: '⏳', PASS: '✅', FAIL: '❌', AUTH_FAIL: '🔑', UNCERTAIN: '⚠️', ERROR: '💥', PREREQ_FAIL: '🚫' }[data.status] || '❓';
        const statusClass = { RUNNING: 'validation-running-state', PASS: 'validation-pass', FAIL: 'validation-fail', AUTH_FAIL: 'validation-auth', UNCERTAIN: 'validation-warn', ERROR: 'validation-error', PREREQ_FAIL: 'validation-prereq' }[data.status] || 'validation-warn';
        let html = '<div class="validation-result ' + statusClass + '">';
        html += '<p><strong>' + statusIcon + ' ' + data.status + '</strong>';
        if (data.timestamp) html += ' <span class="dim">— ' + new Date(data.timestamp).toLocaleString() + '</span>';
        html += '</p>';
        if (data.reason) html += '<p>' + escHtml(data.reason) + '</p>';
        if (data.error) html += '<p class="validation-error-text">' + escHtml(data.error) + '</p>';
        if (data.errors && data.errors.length > 0) {
            html += '<details><summary>' + data.errors.length + ' error(s)</summary><ul>';
            data.errors.forEach(function(e) { html += '<li><code>' + escHtml(e) + '</code></li>'; });
            html += '</ul></details>';
        }
        if (data.screenshotPath) {
            html += '<p class="dim">📸 Screenshot: <code>' + escHtml(data.screenshotPath) + '</code> <a href="/image/' + encodeURIComponent(data.screenshotPath) + '" target="_blank">View</a></p>';
        }
        if (data.screenshotPaths && data.screenshotPaths.length > 0) {
            html += '<p class="dim">📸 ' + data.screenshotPaths.length + ' screenshot(s):</p><ul class="screenshot-list">';
            data.screenshotPaths.forEach(function(p) {
                html += '<li><code>' + escHtml(p) + '</code> <a href="/image/' + encodeURIComponent(p) + '" target="_blank">View</a></li>';
            });
            html += '</ul>';
        }
        if (data.images && data.images.length > 0) {
            html += '<details><summary>' + data.images.length + ' image(s) measured</summary><table class="mini-table"><thead><tr><th>Rendered</th><th>Natural</th><th>Eff. Font</th><th>Pass</th></tr></thead><tbody>';
            data.images.forEach(function(img) {
                html += '<tr><td>' + img.renderedWidth + '×' + img.renderedHeight + '</td><td>' + img.naturalWidth + '×' + img.naturalHeight + '</td><td>' + img.effectiveFont + 'px</td><td>' + (img.pass ? '✅' : '❌') + '</td></tr>';
            });
            html += '</tbody></table></details>';
        }
        if (data.draftUrl) html += '<p class="dim">Draft: <a href="' + escHtml(data.draftUrl) + '" target="_blank">' + escHtml(data.draftUrl) + '</a></p>';
        html += '</div>';
        return html;
    }

    function escHtml(s) {
        var d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }
    </script>`;

    return html;
}

function validationResultCard(result, type, slug) {
    if (!result) return `<p class="dim">No ${type} validation results yet. Click above to run.</p>`;

    const statusIcon = { RUNNING: "⏳", PASS: "✅", FAIL: "❌", AUTH_FAIL: "🔑", UNCERTAIN: "⚠️", ERROR: "💥", PREREQ_FAIL: "🚫" }[result.status] || "❓";
    const statusClass = { RUNNING: "validation-running-state", PASS: "validation-pass", FAIL: "validation-fail", AUTH_FAIL: "validation-auth", UNCERTAIN: "validation-warn", ERROR: "validation-error", PREREQ_FAIL: "validation-prereq" }[result.status] || "validation-warn";

    let html = `<div class="validation-result ${statusClass}">`;
    html += `<p><strong>${statusIcon} ${esc(result.status)}</strong>`;
    if (result.timestamp) html += ` <span class="dim">— ${esc(new Date(result.timestamp).toLocaleString())}</span>`;
    html += `</p>`;
    if (result.reason) html += `<p>${esc(result.reason)}</p>`;
    if (result.error) html += `<p class="validation-error-text">${esc(result.error)}</p>`;
    if (result.errors && result.errors.length > 0) {
        html += `<details><summary>${result.errors.length} error(s)</summary><ul>`;
        for (const e of result.errors) html += `<li><code>${esc(e)}</code></li>`;
        html += `</ul></details>`;
    }
    if (result.screenshotPath) {
        html += `<p class="dim">📸 Screenshot: <code>${esc(result.screenshotPath)}</code> <a href="/image/${encodeURIComponent(result.screenshotPath)}" target="_blank">View</a></p>`;
    }
    if (result.screenshotPaths && result.screenshotPaths.length > 0) {
        html += `<p class="dim">📸 ${result.screenshotPaths.length} screenshot(s):</p><ul class="screenshot-list">`;
        for (const p of result.screenshotPaths) {
            html += `<li><code>${esc(p)}</code> <a href="/image/${encodeURIComponent(p)}" target="_blank">View</a></li>`;
        }
        html += `</ul>`;
    }
    if (result.images && result.images.length > 0) {
        html += `<details><summary>${result.images.length} image(s) measured</summary><table class="mini-table"><thead><tr><th>Rendered</th><th>Natural</th><th>Eff. Font</th><th>Pass</th></tr></thead><tbody>`;
        for (const img of result.images) {
            html += `<tr><td>${img.renderedWidth}×${img.renderedHeight}</td><td>${img.naturalWidth}×${img.naturalHeight}</td><td>${img.effectiveFont}px</td><td>${img.pass ? "✅" : "❌"}</td></tr>`;
        }
        html += `</tbody></table></details>`;
    }
    if (result.draftUrl) html += `<p class="dim">Draft: <a href="${esc(result.draftUrl)}" target="_blank">${esc(result.draftUrl)}</a></p>`;
    html += `</div>`;
    return html;
}

function timelineTab(transitions) {
    if (transitions.length === 0) return `<p class="dim">No stage transitions recorded.</p>`;

    let html = '<div class="timeline">';
    for (const t of transitions) {
        html += `<div class="timeline-item">
            <span class="timeline-dot"></span>
            <div class="timeline-body">
                <p><strong>S${t.from_stage ?? "?"} → S${t.to_stage}</strong> by ${esc(t.agent || "—")}</p>
                ${t.notes ? `<p class="dim">${esc(t.notes)}</p>` : ""}
                <p class="dim">${esc(t.transitioned_at)}</p>
            </div>
        </div>`;
    }
    html += "</div>";
    return html;
}

// ── Preview page ─────────────────────────────────────────────────────────────

export function previewPage(slug, title, html, warnings = [], subtitle = null) {
    const warningBanner = warnings.length > 0
        ? `<div class="preview-warnings">
            <h3>⚠️ ${warnings.length} Preview Warning${warnings.length > 1 ? "s" : ""}</h3>
            <ul>${warnings.map(w => `<li class="warning-${esc(w.type || "info")}"><strong>${esc(w.type || "warning")}:</strong> ${esc(w.message)}</li>`).join("")}</ul>
           </div>`
        : "";

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Preview: ${esc(title)} — NFL Lab</title>
    <link rel="stylesheet" href="/style.css">
</head>
<body>
<header>
    <nav>
        <a href="/" class="logo">🏈 NFL Lab Pipeline</a>
        <a href="/article/${encodeURIComponent(slug)}">← Back to detail</a>
    </nav>
</header>
<main class="preview-container">
    <div class="preview-banner">Canonical ProseMirror preview — matches publisher extension semantics</div>
    ${warningBanner}
    <article class="preview-article">
        <h1>${esc(title)}</h1>
        ${subtitle ? `<p class="preview-subtitle"><em>${esc(subtitle)}</em></p>` : ""}
        ${html}
    </article>
</main>
</body>
</html>`;
}

// ── 404 page ─────────────────────────────────────────────────────────────────

export function notFoundPage(message) {
    return layout("Not Found", `<h1>404</h1><p>${esc(message || "Page not found.")}</p>`);
}

// ── Utility ──────────────────────────────────────────────────────────────────

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
