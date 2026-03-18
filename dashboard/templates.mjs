/**
 * templates.mjs — Server-rendered HTML templates for the pipeline dashboard.
 *
 * No template engine dependency — just tagged template literals. Each export
 * returns a complete HTML string ready to send as a response.
 */

import { STAGE_NAMES, DEPTH_NAMES } from "./data.mjs";
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
<footer><p>NFL Lab Dashboard v1 · Read-only · Data from pipeline.db + article artifacts</p></footer>
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

    const tableRows = board.map(row => `
        <tr class="${row.hasDrift ? "drift-row" : ""}">
            <td><a href="/article/${encodeURIComponent(row.slug)}">${esc(row.title)}</a></td>
            <td>${esc(row.primaryTeam || "—")}</td>
            <td>${statusBadge(row.status)}</td>
            <td><span class="badge ${stageBadgeClass(row.inferredStage)}">S${row.inferredStage}</span> ${esc(row.stageName)}</td>
            <td>${row.hasDrift ? `<span class="drift-flag" title="DB says S${row.dbStage}, artifacts say S${row.inferredStage}">⚠ DB:S${row.dbStage}</span>` : ""}</td>
            <td>${esc(row.nextAction || "—")}</td>
            <td>${verdictBadge(row.editorVerdict)}</td>
            <td>${esc(row.depthName)}</td>
            <td>${row.substackUrl ? `<a href="${esc(row.substackUrl)}" target="_blank">Live</a>` : row.draftUrl ? `<a href="${esc(row.draftUrl)}" target="_blank">Draft</a>` : "—"}</td>
        </tr>`
    ).join("");

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
                <th>Title</th>
                <th>Team</th>
                <th>Status</th>
                <th>Stage</th>
                <th>Drift</th>
                <th>Next Action</th>
                <th>Editor</th>
                <th>Depth</th>
                <th>Link</th>
            </tr>
        </thead>
        <tbody>
            ${tableRows}
        </tbody>
    </table>
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
            const badge = tr.querySelector('td:nth-child(4) .badge');
            const match = badge?.textContent?.startsWith('S' + val);
            tr.style.display = match ? '' : 'none';
        });
    }
    function filterByStatus(val) {
        document.querySelectorAll('#board-table tbody tr').forEach(tr => {
            if (!val) { tr.style.display = ''; return; }
            const badge = tr.querySelector('td:nth-child(3) .badge');
            tr.style.display = badge?.textContent === val ? '' : 'none';
        });
    }
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
    const { slug, article, inferred, artifacts, images, documents, transitions, editorReviews, publisherPass, panels, notes, prompt, hasDrift, validationResults } = detail;
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
    const publishDocs = docs.filter(d => d.group === "publish");
    const otherDocs   = docs.filter(d => d.group === "other");

    // Tabs
    const tabs = [
        { id: "overview", label: "Overview", content: overviewTab(inferred, artifacts, images, overviewDocs, slug) },
        { id: "panel", label: "Prompt & Panel", content: panelTab(prompt, panels, slug, artifacts, panelDocs) },
        { id: "draft", label: "Draft & Edits", content: draftTab(slug, editorReviews, artifacts, draftDocs) },
        { id: "assets", label: "Assets", content: assetsTab(artifacts, images, otherDocs, slug) },
        { id: "preview", label: "Preview", content: `<div id="preview-pane"><a href="/preview/${encodeURIComponent(slug)}" target="_blank" class="btn">Open Canonical Preview →</a><p class="note">Preview renders draft.md through the publisher ProseMirror pipeline with subscribe-button injection, hero-image enforcement, and dense-table warnings.</p></div>` },
        { id: "validation", label: "Validation", content: validationTab(slug, article, validationResults) },
        { id: "publish", label: "Publish / Notes", content: publishTab(publisherPass, notes, article, publishDocs, slug) },
        { id: "timeline", label: "Timeline", content: timelineTab(transitions) },
    ];

    const tabNav = tabs.map((t, i) =>
        `<button class="tab-btn${i === 0 ? " active" : ""}" onclick="showTab('${t.id}')">${t.label}</button>`
    ).join("");

    const tabPanes = tabs.map((t, i) =>
        `<div class="tab-pane${i === 0 ? " active" : ""}" id="tab-${t.id}">${t.content}</div>`
    ).join("");

    const body = `
    <div class="detail-layout">
        ${leftRail}
        <div class="detail-content">
            <div class="tab-bar">${tabNav}</div>
            ${tabPanes}
        </div>
    </div>
    <script>
    function showTab(id) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        document.querySelector('[onclick="showTab(\\'' + id + '\\')"]').classList.add('active');
        document.getElementById('tab-' + id).classList.add('active');
    }
    </script>`;

    return layout(title, body, "");
}

// ── Tab renderers ────────────────────────────────────────────────────────────

function overviewTab(inferred, artifacts, images, overviewDocs, slug) {
    let html = `
    <h3>Stage Inference</h3>
    <p><strong>${esc(inferred.stageName)}</strong> — ${esc(inferred.detail)}</p>
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

function draftTab(slug, editorReviews, artifacts, draftDocs) {
    let html = "<h3>Draft</h3>";
    const draftFileDocs = draftDocs.filter(d => /^draft(?:-.+)?\.md$/.test(d.name));
    if (draftFileDocs.length > 0) {
        html += `<p><a href="/preview/${encodeURIComponent(slug)}" target="_blank" class="btn">Open Canonical Preview →</a></p>`;
        html += docGroup(draftFileDocs, slug);
    } else {
        html += `<p class="dim">No draft.md found.</p>`;
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

function publishTab(publisherPass, notes, article, publishDocs, slug) {
    let html = "<h3>Publisher Pass</h3>";
    if (publisherPass) {
        const checks = [
            ["Title final", publisherPass.title_final],
            ["Subtitle final", publisherPass.subtitle_final],
            ["Body clean", publisherPass.body_clean],
            ["Section assigned", publisherPass.section_assigned],
            ["Tags set", publisherPass.tags_set],
            ["URL slug set", publisherPass.url_slug_set],
            ["Cover image set", publisherPass.cover_image_set],
            ["Paywall set", publisherPass.paywall_set],
            ["Names verified", publisherPass.names_verified],
            ["Numbers current", publisherPass.numbers_current],
            ["No stale refs", publisherPass.no_stale_refs],
        ];
        html += '<div class="checklist">';
        for (const [label, val] of checks) {
            html += `<div class="check-item">${val ? "✅" : "❌"} ${esc(label)}</div>`;
        }
        html += "</div>";
    } else {
        html += `<p class="dim">No publisher pass recorded in DB.</p>`;
    }

    if (publishDocs.length > 0) {
        html += docGroup(publishDocs, slug);
    }

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
