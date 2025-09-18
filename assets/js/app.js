        // Application State
        let appState = {
            currentTab: 'upload',
            uploadedFiles: [],
            fileContents: {},
            dataLoaded: false,
            hasSQL: false,
            sqlSnippets: [],
            extractedData: {
                company: '',
                role: '',
                metrics: [],
                strengths: [],
                gaps: [],
                gapDetails: [],
                panelists: [],
                panelistQuestions: {},
                questions: [],
                stories: [],
                companyIntel: '',
                companyIntelSource: '',
                candidateBackground: '',
                culturalNotes: ''
            },
            llmApiKey: '',
            llmKeyRemember: false,
            llmConfigWarningShown: false
        };

        // Metrics are not initialized on load; will render after file upload.

        // Initialize
document.addEventListener('DOMContentLoaded', async function() {
            setupEventListeners();
            initializeLlmControls();
            
            // Disable tabs until data is uploaded
            setTabsEnabled(false);
            // Hide countdown until a JD file provides a date
            const countdown = document.getElementById('interviewCountdown');
            if (countdown) countdown.style.display = 'none';
            updateDataStatus('Upload your materials to get started with personalized interview prep!', 'info');
            // PDF.js worker is configured when the library is lazy-loaded
            updateUploadChecklist();
            updateRequiresDataVisibility();
            updateSqlAvailabilityUI();
            // Disable process button until files are selected
            setProcessBtnEnabled(false);

            // LLM toggle (optional). When deployed with /api/llm, this enables LLM assists.
            window.__LLM_ENABLED__ = true;
            // Optional: auto-load test files when ?test=1
            try {
                const params = new URLSearchParams(window.location.search || '');
                if (params.get('test') === '1') {
                    await loadTestFilesFromFolder();
                }
                // Debug toggle: ?debug=1 to show extraction details
                if (params.get('debug') === '1') {
                    window.__DEBUG__ = true;
                    try { showToast('Debug mode enabled', 'info'); } catch (e) {}
                }
            } catch (e) { /* ignore */ }
        });

        async function initializeDashboard() {
            // No auto-load; require user uploads
            updateDataStatus('Upload your materials to get started with personalized interview prep!', 'info');
        }

        function setupEventListeners() {
            // Tab navigation
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const target = this.dataset.tab;
                    if (!appState.dataLoaded && target !== 'upload') {
                        showToast('Please upload your files to unlock tabs.', 'warning');
                        return;
                    }
                    if (target === 'sql' && !appState.hasSQL) {
                        showToast('Upload files containing SQL to enable SQL Practice.', 'warning');
                        return;
                    }
                    switchTab(target);
                });
            });

            // File upload
            const fileDropZone = document.getElementById('fileDropZone');
            const fileInput = document.getElementById('fileInput');
            
            if (fileDropZone && fileInput) {
                fileDropZone.addEventListener('click', () => fileInput.click());
                
                fileDropZone.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    fileDropZone.classList.add('dragover');
                });
                
                fileDropZone.addEventListener('dragleave', () => {
                    fileDropZone.classList.remove('dragover');
                });
                
                fileDropZone.addEventListener('drop', (e) => {
                    e.preventDefault();
                    fileDropZone.classList.remove('dragover');
                    handleFiles(e.dataTransfer.files);
                });
                
                fileInput.addEventListener('change', (e) => {
                    handleFiles(e.target.files);
                });
            }

            // Search functionality
            const searchInput = document.getElementById('questionSearch');
            if (searchInput) {
                searchInput.addEventListener('input', filterQuestions);
            }
            
            const categorySelect = document.getElementById('questionCategory');
            if (categorySelect) {
                categorySelect.addEventListener('change', filterQuestions);
            }
            const interviewerSelect = document.getElementById('interviewerFilter');
            if (interviewerSelect) {
                interviewerSelect.addEventListener('change', filterQuestions);
            }
            // Global delegated click handlers
            document.addEventListener('click', (e) => {
                const el = e.target.closest('[data-action]');
                if (!el) return;
                const action = el.dataset.action;
                switch (action) {
                    case 'mobile-nav-open':
                        toggleMobileNav();
                        break;
                    case 'mobile-nav-close':
                        closeMobileNav();
                        break;
                    case 'mobile-nav-switch':
                        if (el.dataset.tab) {
                            const target = el.dataset.tab;
                            if (!appState.dataLoaded && target !== 'upload') {
                                showToast('Please upload your files to unlock tabs.', 'warning');
                                return;
                            }
                            if (target === 'sql' && !appState.hasSQL) {
                                showToast('Upload files containing SQL to enable SQL Practice.', 'warning');
                                return;
                            }
                            switchTabMobile(target);
                        }
                        break;
                    case 'process-files':
                        processFiles();
                        break;
                    case 'load-test-files':
                        loadTestFilesFromFolder();
                        break;
                    // Sample loading disabled; require user uploads
                    case 'gen-power-intro':
                        generatePowerIntro();
                        break;
                    case 'gen-talking-points':
                        generateTalkingPoints();
                        break;
                    case 'gen-gap-strategies':
                        generateGapStrategies();
                        break;
                    case 'gen-cultural':
                        generateCulturalAnalysis();
                        break;
                    case 'add-panelist':
                        addPanelist();
                        break;
                    case 'gen-more-questions':
                        generateMoreQuestions();
                        break;
                    case 'filter-questions':
                        if (el.dataset.category) filterQuestions(el.dataset.category);
                        break;
                    case 'load-sql-scenario':
                        if (el.dataset.scenario) loadScenario(el.dataset.scenario);
                        break;
                    case 'validate-sql':
                        validateSQLSolution();
                        break;
                    case 'optimize-sql':
                        optimizeSQL();
                        break;
                    case 'show-sql-examples':
                        showExampleSolutions();
                        break;
                    case 'sql-load-snippet': {
                        const idx = parseInt(el.dataset.index, 10);
                        const editor = document.getElementById('sqlQuery');
                        if (!isNaN(idx) && editor && appState.sqlSnippets && appState.sqlSnippets[idx]) {
                            const sn = appState.sqlSnippets[idx];
                            editor.value = sn.code;
                            const note = document.getElementById('sqlSourceNote');
                            if (note) note.textContent = `Source: ${(sn.source||'').split('/').pop()}`;
                            showToast(`Loaded snippet from ${sn.source}`, 'success');
                        }
                        break;
                    }
                    case 'sql-copy-snippet': {
                        const idx = parseInt(el.dataset.index, 10);
                        if (!isNaN(idx) && appState.sqlSnippets && appState.sqlSnippets[idx]) {
                            const sn = appState.sqlSnippets[idx];
                            const text = sn.code;
                            try {
                                if (navigator.clipboard && navigator.clipboard.writeText) {
                                    navigator.clipboard.writeText(text).then(()=>showToast('Snippet copied!', 'success'));
                                } else {
                                    const ta = document.createElement('textarea');
                                    ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
                                    showToast('Snippet copied!', 'success');
                                }
                            } catch (e) {
                                showToast('Copy failed', 'error');
                            }
                        }
                        break;
                    }
                    case 'gen-rebuttal':
                        generateRebuttal();
                        break;
                    case 'gen-candidate-questions':
                        generateCandidateQuestions();
                        break;
                    case 'gen-plan':
                        generatePlan();
                        break;
                    case 'copy-metrics': {
                        const metrics = Array.isArray(appState.extractedData.metrics) ? appState.extractedData.metrics : [];
                        if (!metrics.length) { showToast('No metrics to copy', 'warning'); break; }
                        const md = metrics.map(m => `- ${m.label}: ${m.value}${m.growth?` (${m.growth})`:''}${m.context?` — ${m.context}`:''}`).join('\n');
                        try {
                            if (navigator.clipboard && navigator.clipboard.writeText) {
                                navigator.clipboard.writeText(md).then(()=>showToast('Metrics copied!', 'success'));
                            } else {
                                const ta = document.createElement('textarea'); ta.value = md; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); showToast('Metrics copied!', 'success');
                            }
                        } catch (err) { showToast('Copy failed', 'error'); }
                        break;
                    }
                    case 'copy-briefing': {
                        const md = appState.extractedData.companyIntel || '';
                        if (!md) { showToast('No briefing to copy', 'warning'); break; }
                        try {
                            if (navigator.clipboard && navigator.clipboard.writeText) {
                                navigator.clipboard.writeText(md).then(()=>showToast('Briefing copied!', 'success'));
                            } else {
                                const ta = document.createElement('textarea'); ta.value = md; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); showToast('Briefing copied!', 'success');
                            }
                        } catch (err) { showToast('Copy failed', 'error'); }
                        break;
                    }
                    case 'download-briefing': {
                        const md = appState.extractedData.companyIntel || '';
                        if (!md) { showToast('No briefing to download', 'warning'); break; }
                        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url; a.download = 'briefing.md';
                        document.body.appendChild(a); a.click(); document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        showToast('Briefing downloaded', 'success');
                        break;
                    }
                    case 'download-snapshot': {
                        const md = buildSnapshotMarkdown();
                        if (!md) { showToast('Nothing to export yet', 'warning'); break; }
                        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url; a.download = 'dashboard_snapshot.md';
                        document.body.appendChild(a); a.click(); document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        showToast('Snapshot downloaded', 'success');
                        break;
                    }
                    case 'copy-snapshot': {
                        const md = buildSnapshotMarkdown();
                        if (!md) { showToast('Nothing to copy yet', 'warning'); break; }
                        try {
                            if (navigator.clipboard && navigator.clipboard.writeText) {
                                navigator.clipboard.writeText(md).then(()=>showToast('Snapshot copied!', 'success'));
                            } else {
                                const ta = document.createElement('textarea'); ta.value = md; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); showToast('Snapshot copied!', 'success');
                            }
                        } catch (err) { showToast('Copy failed', 'error'); }
                        break;
                    }
                    case 'gen-quick-tips': {
                        updateQuickTipsFromData();
                        break;
                    }
                    case 'set-quick-question':
                        if (el.dataset.question) setQuickQuestion(el.dataset.question);
                        break;
                    case 'assistant-respond':
                        generateAssistantResponse();
                        break;
                    case 'gen-thank-you':
                        generateThankYou();
                        break;
                    case 'gen-panelist-question':
                        if (el.dataset.name) generatePanelistQuestion(el.dataset.name);
                        break;
                    case 'clear-llm-key':
                        clearLlmKey();
                        break;
                    case 'toggle-question':
                        if (el.dataset.index) toggleQuestionDetail(el.dataset.index);
                        break;
                    case 'question-mark-practiced':
                        if (el.dataset.index) { e.stopPropagation(); markPracticed(el.dataset.index); }
                        break;
                    case 'question-add-review':
                        if (el.dataset.index) { e.stopPropagation(); addToReview(el.dataset.index); }
                        break;
                    case 'story-show':
                        if (el.dataset.index) showStoryDetail(el.dataset.index);
                        break;
                    case 'story-enhance':
                        if (el.dataset.index) enhanceStory(el.dataset.index);
                        break;
                    case 'copy-outline':
                        if (el.dataset.index) { e.stopPropagation(); copyQuestionOutline(el.dataset.index); }
                        break;
                    case 'sql-copy-example': {
                        const sc = el.dataset.scenario || 'example1';
                        if (sc === 'example1') {
                            const sql = `WITH tier_transitions AS (
  SELECT
    member_id,
    current_tier,
    LAG(tier_level) OVER (
      PARTITION BY member_id
      ORDER BY tier_change_date
    ) AS previous_tier,
    tier_change_date
  FROM member_tier_history
  WHERE tier_change_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
)
SELECT
  CONCAT(previous_tier, ' → ', current_tier) AS transition,
  COUNT(*) AS transition_count,
  PERCENT_RANK() OVER (ORDER BY COUNT(*)) AS transition_percentile
FROM tier_transitions
WHERE previous_tier IS NOT NULL
GROUP BY previous_tier, current_tier;`;
                            const editor = document.getElementById('sqlQuery');
                            if (editor) {
                                editor.value = sql;
                                try {
                                    if (navigator.clipboard && navigator.clipboard.writeText) {
                                        navigator.clipboard.writeText(sql).catch(() => {});
                                    } else {
                                        editor.select();
                                        document.execCommand('copy');
                                    }
                                } catch (e) { /* ignore */ }
                                showToast('SQL example copied to editor!', 'success');
                            } else {
                                showToast('SQL editor not found', 'error');
                            }
                        } else {
                            copySQLExample(sc);
                        }
                        break;
                    }
                }
            });
        }

        // Removed duplicate switchTab (see enhanced version near end of file)

        function updateDataStatus(message, type = 'info') {
            const statusDiv = document.getElementById('dataStatus');
            if (!statusDiv) return;
            const colors = { success:'#22c55e', error:'#ef4444', warning:'#f59e0b', info:'#64748b' };
            const s = appState.uploadStatus || {};
            const d = appState.extractedData || {};
            const pills = [
                { label:'Resume', ok: !!s.hasResume },
                { label:'Job Description', ok: !!s.hasJD },
                { label:'Company Intel', ok: !!s.hasIntel },
                { label:'Additional Resources', ok: !!s.hasResources }
            ].map(p => `<span style="display:inline-block;margin:0 .5rem .5rem 0;padding:.25rem .5rem;border-radius:9999px;background:${p.ok?'#dcfce7':'#fee2e2'};color:${p.ok?'#166534':'#991b1b'};font-size:.75rem;transition:all .25s ease;">${p.ok?'✓':'✗'} ${p.label}</span>`).join('');
            const counts = [
                { k:'Panelists', v:(d.panelists||[]).length },
                { k:'Questions', v:(d.questions||[]).length },
                { k:'Stories', v:(d.stories||[]).length },
                { k:'Metrics', v:(d.metrics||[]).length },
                { k:'SQL Snippets', v:(appState.sqlSnippets||[]).length }
            ].map(c => `<div style="padding:.35rem .6rem;border-radius:.375rem;background:#f8fafc;">${c.k}: <strong>${c.v}</strong></div>`).join('');
            const header = message ? `<p style="color:${colors[type]}; margin-bottom:.5rem;">${message}</p>` : '';
            statusDiv.innerHTML = `${header}<div style="margin-bottom:.5rem;">${pills}</div><div style="display:flex;gap:.5rem;flex-wrap:wrap;">${counts}</div>`;
            try { statusDiv.animate([{opacity:.6},{opacity:1}], {duration:250,easing:'ease'}); } catch(e) {}
        }

        function setProcessBtnEnabled(enabled) {
            const btn = document.querySelector('[data-action="process-files"]');
            if (!btn) return;
            btn.disabled = !enabled;
            try { btn.animate([{opacity:0.9},{opacity:1}], {duration:180,easing:'ease'}); } catch(e) {}
        }

        function setTabsEnabled(enabled) {
            const buttons = document.querySelectorAll('.tab-btn');
            buttons.forEach(btn => {
                const tab = btn.dataset.tab;
                if (tab === 'upload') return;
                if (tab === 'sql' && !appState.hasSQL) {
                    btn.classList.add('disabled');
                    return;
                }
                if (enabled) {
                    btn.classList.remove('disabled');
                } else {
                    btn.classList.add('disabled');
                }
            });
        }

        function containsSQL(text) {
            if (!text) return false;
            const s = String(text);
            const patterns = [
                /\bSELECT\b[\s\S]*?\bFROM\b/i,
                /\bWITH\b\s+\w+\s+AS\s*\(/i,
                /\bJOIN\b\s+\w+/i,
                /\bGROUP\s+BY\b/i,
                /\bORDER\s+BY\b/i,
                /\bCREATE\s+(TABLE|VIEW)\b/i,
                /\bINSERT\s+INTO\b/i,
                /\bWINDOW\b|\bOVER\s*\(/i,
                /\bROW_NUMBER\s*\(/i
            ];
            return patterns.some(rx => rx.test(s));
        }

        function detectSQLInFiles() {
            const combined = Object.values(appState.fileContents || {}).join('\n');
            appState.hasSQL = containsSQL(combined);
        }

        function updateSqlAvailabilityUI() {
            const showSQL = !!appState.hasSQL;
            const tabBtn = document.querySelector('.tab-btn[data-tab="sql"]');
            const mobileItem = document.querySelector('.mobile-nav-item[data-tab="sql"]');
            const tabContent = document.getElementById('sql');
            if (tabBtn) tabBtn.style.display = showSQL ? '' : 'none';
            if (mobileItem) mobileItem.style.display = showSQL ? '' : 'none';
            if (!showSQL) {
                // If currently on SQL tab, redirect to upload
                const currentActive = document.querySelector('.tab-content.active');
                if (currentActive && currentActive.id === 'sql') {
                    switchTab('upload');
                }
            }
        }

        function extractSQLBlocksFromMarkdown(text) {
            const blocks = [];
            if (!text) return blocks;
            // ```sql ... ``` fenced blocks
            const reSql = /```sql\s*([\s\S]*?)```/gi;
            let m;
            while ((m = reSql.exec(text)) !== null) {
                const code = (m[1] || '').trim();
                if (code) blocks.push(code);
            }
            // Generic fenced blocks; include only if they look like SQL
            const reAny = /```\s*([\s\S]*?)```/g;
            while ((m = reAny.exec(text)) !== null) {
                const code = (m[1] || '').trim();
                if (code && containsSQL(code)) blocks.push(code);
            }
            return blocks;
        }

        function extractInlineSQLHeuristics(text) {
            const blocks = [];
            if (!text) return blocks;
            // Capture sequences starting with SELECT or WITH up to a semicolon or double newline
            const re = /(SELECT[\s\S]*?;)|(WITH\s+[\s\S]*?;)/gi;
            let m;
            while ((m = re.exec(text)) !== null) {
                const code = (m[0] || '').trim();
                if (code && containsSQL(code)) blocks.push(code);
            }
            // If none found, try shorter chunks ending at blank line
            if (blocks.length === 0) {
                const re2 = /(SELECT|WITH)[\s\S]*?(?:\n\s*\n|$)/gi;
                let m2;
                while ((m2 = re2.exec(text)) !== null) {
                    const code = (m2[0] || '').trim();
                    if (code && containsSQL(code)) blocks.push(code);
                }
            }
            return blocks;
        }

        function collectSQLSnippetsFromFiles() {
            const snippets = [];
            for (const [name, content] of Object.entries(appState.fileContents || {})) {
                if (!content) continue;
                const lower = name.toLowerCase();
                let blocks = [];
                if (lower.endsWith('.md') || /markdown/i.test(content.slice(0, 200))) {
                    blocks = extractSQLBlocksFromMarkdown(content);
                }
                // Heuristic extraction from any text file
                if (blocks.length === 0) {
                    blocks = extractInlineSQLHeuristics(content);
                }
                blocks.forEach(code => snippets.push({ source: name, code }));
            }
            // De-duplicate by code content
            const seen = new Set();
            const unique = [];
            for (const snip of snippets) {
                const key = snip.code.replace(/\s+/g, ' ').trim();
                if (!seen.has(key)) { seen.add(key); unique.push(snip); }
            }
            appState.sqlSnippets = unique;
        }

        function populateSQLEditorFromSnippets() {
            const editor = document.getElementById('sqlQuery');
            if (!editor) return;
            if (!Array.isArray(appState.sqlSnippets) || appState.sqlSnippets.length === 0) return;
            // Choose the longest snippet assuming it's the most complete
            const best = appState.sqlSnippets.reduce((a, b) => (b.code.length > a.code.length ? b : a));
            editor.value = best.code;
            try { showToast(`Loaded SQL from ${best.source}`, 'success'); } catch (e) { /* ignore */ }
        }

        function updateSqlSnippetList() {
            const container = document.getElementById('sqlSnippetList');
            if (!container) return;
            const snippets = Array.isArray(appState.sqlSnippets) ? appState.sqlSnippets : [];
            const filterSel = document.getElementById('sqlSnippetFilter');
            const listDiv = document.getElementById('sqlSnippetItems');
            if (!listDiv) return;
            if (!snippets.length) {
                listDiv.innerHTML = '<p style="color:#64748b; font-size: 0.9rem;">No SQL snippets detected. Include ```sql fenced blocks or queries starting with SELECT/WITH in your files.</p>';
                if (filterSel) filterSel.innerHTML = '';
                return;
            }
            // Populate filter options
            if (filterSel) {
                const sources = Array.from(new Set(snippets.map(s => (s.source || '').split('/').pop())));
                const current = filterSel.value || '';
                filterSel.innerHTML = ['<option value="">All files</option>']
                    .concat(sources.map(s => `<option value="${s}">${s}</option>`)).join('');
                if (current) filterSel.value = current;
            }
            const selected = (filterSel && filterSel.value) ? filterSel.value : '';
            const filtered = selected ? snippets.filter(s => ((s.source || '').split('/').pop()) === selected) : snippets;
            const items = filtered.map((snip, idx) => {
                const firstLine = (snip.code.split('\n')[0] || '').replace(/`/g,'').trim();
                const label = firstLine.slice(0, 60) + (firstLine.length > 60 ? '…' : '');
                const source = (snip.source || '').split('/').pop();
                return `
                    <div class="sql-snippet-item" style="border:1px solid #e2e8f0; border-radius:0.5rem; padding:0.5rem 0.75rem; margin:0.25rem 0; display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
                        <div data-action="sql-load-snippet" data-index="${idx}" style="flex:1; font-family: 'Courier New', monospace; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor:pointer;">${label}</div>
                        <div style="display:flex; align-items:center; gap:0.5rem;">
                            <span style="font-size:0.75rem; color:#64748b;">${source}</span>
                            <button class="btn btn-secondary" data-action="sql-copy-snippet" data-index="${idx}" title="Copy to clipboard" style="padding:0.35rem 0.6rem;">Copy</button>
                        </div>
                    </div>
                `;
            }).join('');
            listDiv.innerHTML = items;
            // Wire filter change
            if (filterSel && !filterSel._wired) {
                filterSel.addEventListener('change', () => updateSqlSnippetList());
                filterSel._wired = true;
            }
        }

        function buildSnapshotMarkdown() {
            const d = appState.extractedData || {};
            const title = `# Interview Prep Snapshot${(d.company||d.role)?` — ${[d.company,d.role].filter(Boolean).join(' | ')}`:''}`;
            const tech = deriveTechStack(getCombinedContent());
            const techMd = tech.length ? tech.map(t=>`- ${t}`).join('\n') : '- (detected from your files)';
            const metrics = Array.isArray(d.metrics)?d.metrics:[];
            const metricsMd = metrics.length ? metrics.map(m=>`- ${m.label}: ${m.value}${m.growth?` (${m.growth})`:''}${m.context?` — ${m.context}`:''}`).join('\n') : '- (provide metrics via CSV or docs)';
            const strengths = Array.isArray(d.strengths)?d.strengths:[];
            const gaps = Array.isArray(d.gaps)?d.gaps:[];
            const strengthsMd = strengths.length ? strengths.map(s=>`- ${s}`).join('\n') : '- (no strengths extracted)';
            const gapsMd = gaps.length ? gaps.map(g=>`- ${g}`).join('\n') : '- (no gaps extracted)';
            const panelists = Array.isArray(d.panelists)?d.panelists:[];
            const panelistsMd = panelists.length ? panelists.map(p=>`- ${p.name||''}${p.role?` — ${p.role}`:''}${p.archetype?` (${p.archetype})`:''}`).join('\n') : '- (no panelists extracted)';
            const questions = Array.isArray(d.questions)?d.questions:[];
            const qMd = questions.slice(0,10).map(q=>`- [${q.category||'general'}] ${q.question}`).join('\n') || '- (no questions extracted)';
            const snippets = Array.isArray(appState.sqlSnippets)?appState.sqlSnippets:[];
            const snMd = snippets.slice(0,5).map(s=>`- ${((s.code||'').split('\n')[0]||'').trim()} — ${((s.source||'').split('/').pop())}`).join('\n') || '- (no SQL detected)';
            const intel = typeof d.companyIntel === 'string' ? d.companyIntel : '';

            return [
                title,
                '\n## Tech Stack',
                techMd,
                '\n## Key Metrics',
                metricsMd,
                '\n## Strengths',
                strengthsMd,
                '\n## Potential Gaps',
                gapsMd,
                '\n## Panelists',
                panelistsMd,
                '\n## Q&A Highlights',
                qMd,
                '\n## SQL Snippets',
                snMd,
                '\n## Executive Brief',
                intel || '_Upload company intel or playbook files to generate a briefing._'
            ].join('\n');
        }

        function updateUploadChecklist() {
            const files = Object.keys(appState.fileContents || {});
            const hasResume = files.some(n => /resume/i.test(n));
            const hasJD = files.some(n => /jd|job\s*description/i.test(n));
            const hasIntel = files.some(n => /intel|playbook|strategy|brief|company/i.test(n));
            // Additional resources: anything uploaded besides resume/JD/intel
            const known = (n) => /resume/i.test(n) || /jd|job\s*description/i.test(n) || /intel|playbook|strategy|brief|company/i.test(n);
            const hasResources = files.some(n => !known(n));

            function setCheck(id, ok, type) {
                const el = document.getElementById(id);
                if (!el) return;
                el.style.transition = 'all .25s ease';
                if (id === 'check-resume') {
                    el.style.borderLeftColor = '#0ea5e9';
                    el.style.background = '#eff6ff';
                    el.style.boxShadow = ok ? '0 0 0 3px rgba(14,165,233,0.18)' : 'none';
                } else if (id === 'check-intel') {
                    el.style.borderLeftColor = '#eab308';
                    el.style.background = '#fefce8';
                    el.style.boxShadow = ok ? '0 0 0 3px rgba(234,179,8,0.18)' : 'none';
                } else if (id === 'check-jd') {
                    el.style.borderLeftColor = '#ef4444';
                    el.style.background = '#fff7ed';
                    el.style.boxShadow = ok ? '0 0 0 3px rgba(34,197,94,0.15)' : 'none';
                } else { // resources
                    el.style.borderLeftColor = '#22c55e';
                    el.style.background = '#f0fdf4';
                    el.style.boxShadow = ok ? '0 0 0 3px rgba(34,197,94,0.15)' : 'none';
                }
                try { el.animate([{transform:'scale(1)'},{transform:'scale(1.01)'},{transform:'scale(1)'}], {duration:250, easing:'ease'}); } catch(e) {}
            }

            setCheck('check-resume', hasResume, 'required');
            setCheck('check-jd', hasJD, 'required');
            setCheck('check-intel', hasIntel, 'intel');
            setCheck('check-resources', hasResources, 'resources');
        }

        function updateRequiresDataVisibility() {
            const hasQuestions = Array.isArray(appState.extractedData.questions) && appState.extractedData.questions.length > 0;
            const hasIntel = !!appState.extractedData.companyIntel;
            const hasMetrics = Array.isArray(appState.extractedData.metrics) && appState.extractedData.metrics.length > 0;
            const hasSQL = !!appState.hasSQL;
            const hasStrengths = Array.isArray(appState.extractedData.strengths) && appState.extractedData.strengths.length > 0;
            const hasGaps = Array.isArray(appState.extractedData.gaps) && appState.extractedData.gaps.length > 0;

            function show(id, should) {
                const el = document.getElementById(id);
                if (!el) return;
                el.style.display = should ? '' : 'none';
            }

            // Show interview context if we have any signals (populated dynamically)
            const hasPanelists = Array.isArray(appState.extractedData.panelists) && appState.extractedData.panelists.length > 0;
            show('interviewContextBar', appState.dataLoaded && (hasQuestions || hasIntel || hasPanelists || hasMetrics || hasStrengths));

            // SQL practice only if explicit SQL was found
            show('sqlContextCard', hasSQL);
            show('sqlChallengesCard', hasSQL);
            // Schema/scenarios get toggled based on derived content flags
            const schemaCard = document.getElementById('schemaCard');
            const scenariosCard = document.getElementById('scenariosCard');
            if (schemaCard) schemaCard.style.display = schemaCard.dataset.hascontent === 'true' ? '' : 'none';
            if (scenariosCard) scenariosCard.style.display = scenariosCard.dataset.hascontent === 'true' ? '' : 'none';

            // Keep quick tips hidden until we generate from data
            show('quickTipsCard', false);

            // Upload tab derived sections
            show('powerIntroCard', appState.dataLoaded);
            show('talkingPointsCard', appState.dataLoaded);
            show('strengthsCard', hasStrengths);
            show('gapsCard', hasGaps);
        }

        // -------- Dynamic Section Builders (agnostic) --------
        function getCombinedContent() {
            return Object.values(appState.fileContents || {}).join('\n');
        }

        function getFileContentsByPattern(regex) {
            const entries = Object.entries(appState.fileContents || {});
            return entries
                .filter(([name]) => regex.test(String(name || '').toLowerCase()))
                .map(([, content]) => (content || '').toString())
                .join('\n');
        }

        function deriveCandidateBackground(resumeText) {
            if (!resumeText) return '';
            const text = String(resumeText);
            const summaryMatch = text.match(/(?:Professional\s+Summary|Summary|Profile|About)\s*[:\n]+([\s\S]{0,600})/i);
            if (summaryMatch) {
                const section = summaryMatch[1].split(/\n{2,}/)[0].trim();
                if (section) return section.replace(/\n+/g, ' ');
            }

            const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            const sentenceLines = lines.filter(l => /\w/.test(l)).slice(0, 6);
            const bulletLines = sentenceLines.filter(l => /^[•\-\*]/.test(l)).map(l => l.replace(/^[•\-\*]\s*/, ''));
            if (bulletLines.length >= 2) {
                return bulletLines.slice(0, 3).join(' ');
            }
            const paragraph = sentenceLines.join(' ');
            return paragraph.length > 0 ? paragraph : '';
        }

        function deriveTechStack(text) {
            const terms = [
                'SQL','BigQuery','Snowflake','Redshift','PostgreSQL','MySQL','SQLite','Oracle','PL/SQL',
                'Python','Pandas','NumPy','R','Spark','Airflow',
                'Tableau','Looker','Power BI','PLX','dbt',
                'GCP','Google Cloud','AWS','Azure','Databricks'
            ];
            const found = [];
            const lower = (text || '').toLowerCase();
            terms.forEach(t => { if (lower.includes(t.toLowerCase())) found.push(t); });
            return Array.from(new Set(found));
        }

        // Infer company and role from raw text content
        function inferCompanyAndRoleFromText(text) {
            const out = { company: '', role: '' };
            if (!text) return out;
            try {
                const t = String(text).replace(/[\u2013\u2014]/g, '-');
                // Prefer explicit labels, even without newlines
                let m = t.match(/Company(?:\s*Name)?\s*[:\-–—]\s*([A-Z][A-Za-z0-9&().,'\-\s]{2,80})/i);
                if (m) out.company = (m[1] || '').trim();
                if (!out.company) {
                    m = t.match(/Employer\s*[:\-–—]\s*([A-Z][A-Za-z0-9&().,'\-\s]{2,80})/i);
                    if (m) out.company = (m[1] || '').trim();
                }

                // Role/Title extraction
                m = t.match(/(?:Job\s*Title|Title|Position|Role)\s*[:\-–—]\s*([^\n]{2,80})/i);
                if (m) out.role = (m[1] || '').trim();
                if (!out.role) {
                    const titleRx = /((Senior|Lead|Principal|Staff)\s+)?(BI|Business\s*Intelligence|Data|Analytics)\s+(Analyst|Engineer|Scientist|Manager|Architect)/i;
                    const m2 = t.match(titleRx);
                    if (m2) out.role = (m2[0] || '').trim();
                }
            } catch (e) { /* ignore */ }
            return out;
        }

        // Infer company and role from filenames (e.g., "JD - Acme Corp - Data Analyst.pdf")
        function inferCompanyAndRoleFromFilenames(files) {
            const out = { company: '', role: '' };
            if (!Array.isArray(files)) return out;
            for (const f of files) {
                const base = String(f || '').split(/[\\\/]/).pop().replace(/\.[^.]+$/, '');
                if (/\bJD\b/i.test(base) || /job\s*description/i.test(base)) {
                    // Remove anything before JD
                    let s = base.replace(/^.*?\b(JD|Job\s*Description)\b\s*[-–:]?\s*/i, '');
                    const parts = s.split(/\s*[-–]\s*/);
                    if (parts.length >= 2) {
                        if (!out.company) out.company = parts[0].trim();
                        if (!out.role) out.role = parts.slice(1).join(' - ').trim();
                    }
                }
                // Resume pattern like "ICT - Brandon Abbott Resume"
                if (!out.company && /resume/i.test(base)) {
                    const m = base.match(/^(.+?)\s*[-–]/);
                    if (m) out.company = (m[1] || '').trim();
                }
                if (out.company && out.role) break;
            }
            return out;
        }

        function extractTablesFromSQLSnippets() {
            const tables = new Set();
            const snippets = appState.sqlSnippets || [];
            const rx = /\b(?:FROM|JOIN)\s+([`\[]?[\w.]+[`\]]?)/gi;
            for (const snip of snippets) {
                let m;
                while ((m = rx.exec(snip.code)) !== null) {
                    let t = m[1].replace(/[`\[\]]/g,'');
                    tables.add(t);
                }
            }
            return Array.from(tables).slice(0, 20);
        }

        function updateInterviewContext() {
            const el = document.getElementById('interviewContextBar');
            if (!el) return;
            const text = getCombinedContent();
            const tech = deriveTechStack(text);
            const metrics = appState.extractedData.metrics || [];
            const panelists = appState.extractedData.panelists || [];

            const focus = [];
            if (tech.includes('SQL')) focus.push('SQL depth');
            if (tech.includes('BigQuery')) focus.push('BigQuery optimization');
            if (/segmentation|cluster/i.test(text)) focus.push('Segmentation');
            if (/retention|churn/i.test(text)) focus.push('Retention/Churn');
            if (/pipeline|etl|elt/i.test(text)) focus.push('Data pipelines');

            const business = [];
            const m1 = metrics.find(m => /users|members|customers/i.test(m.label));
            const m2 = metrics.find(m => /revenue|sales|impact/i.test(m.label));
            if (m1) business.push(`${m1.value} ${m1.label}`);
            if (m2) business.push(`${m2.value} ${m2.label}`);

            const interviewerHtml = panelists.slice(0,3).map(p => `• <strong>${p.name || ''}</strong>${p.role?': '+p.role:''}`).join('<br>');

            el.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">
                    <div>
                        <strong>🎯 Key Focus Areas:</strong><br>
                        ${focus.length ? focus.map(f=>`• ${f}`).join('<br>') : '• Derived from your materials'}
                    </div>
                    <div>
                        <strong>📊 Business Context:</strong><br>
                        ${business.length ? business.map(b=>`• ${b}`).join('<br>') : '• Metrics will appear when detected'}
                    </div>
                    <div>
                        <strong>👥 Interviewers:</strong><br>
                        ${interviewerHtml || '• Add panelists via your files'}
                    </div>
                </div>`;
        }

        function updateSQLContextCard() {
            const card = document.getElementById('sqlContextCard');
            if (!card) return;
            if (!appState.hasSQL) { card.style.display = 'none'; return; }
            const text = getCombinedContent();
            const metrics = appState.extractedData.metrics || [];
            const gapDetails = Array.isArray(appState.extractedData.gapDetails) ? appState.extractedData.gapDetails : [];
            const gaps = appState.extractedData.gaps || [];
            const panelists = appState.extractedData.panelists || [];
            const tech = deriveTechStack(text).slice(0,6);
            const focus = [];
            if (tech.includes('SQL')) focus.push('SQL depth');
            if (tech.includes('BigQuery')) focus.push('BigQuery optimization');
            if (/segmentation|cluster/i.test(text)) focus.push('Segmentation');
            if (/retention|churn/i.test(text)) focus.push('Retention/Churn');
            if (/pipeline|etl|elt/i.test(text)) focus.push('Pipelines');

            const scaleMetric = metrics.find(m => /users|members|customers|records|rows/i.test(m.label));
            const scaleText = scaleMetric ? `${scaleMetric.value} ${scaleMetric.label}` : '—';
            let queryVol = '—';
            const volMatch = text.match(/(\d+(?:\.\d+)?\s*(?:B|M|K)\+?)\s+(queries|transactions|events|rows|records)/i);
            if (volMatch) queryVol = `${volMatch[1]} ${volMatch[2]}`;
            const challenge = (gapDetails[0]?.title) || gaps[0] || (focus[0] || '—');
            const interviewers = panelists.slice(0,3).map(p => p.name).filter(Boolean).join(', ') || '—';

            // Rewrite the inner grid content while preserving title
            const titleEl = card.querySelector('h3');
            if (titleEl) titleEl.textContent = '🎯 Interview Focus';
            const grid = card.querySelector('div[style*="grid-template-columns"]');
            if (grid) {
                grid.innerHTML = `
                    <div>
                        <strong>Data Scale:</strong> ${scaleText}
                        <br><strong>Query Volume:</strong> ${queryVol}
                        <br><strong>Key Challenge:</strong> ${challenge}
                    </div>
                    <div>
                        <strong>Tech Stack:</strong> ${tech.length?tech.join(', '):'—'}<br>
                        <strong>Focus Areas:</strong> ${focus.length?focus.join(', '):'—'}<br>
                        <strong>Interviewers:</strong> ${interviewers}
                    </div>`;
            }
            card.style.display = '';
        }

        function updateSchemaCard() {
            const card = document.getElementById('schemaCard');
            if (!card) return;
            const tables = extractTablesFromSQLSnippets();
            if (!tables.length) { card.dataset.hascontent = 'false'; return; }
            const container = card.querySelector('div');
            if (container) {
                container.innerHTML = `<div style=\"color:#10b981; margin-bottom:0.5rem;\">-- Detected Tables</div>` +
                    tables.map(t=>`<div style=\"color:#f1f5f9;\"><strong style=\"color:#3b82f6;\">${t}</strong></div>`).join('');
            }
            card.dataset.hascontent = 'true';
        }

        function updateScenariosCard() {
            const card = document.getElementById('scenariosCard');
            if (!card) return;
            const text = getCombinedContent();
            const scenarios = [];
            if (/churn|retention/i.test(text)) scenarios.push({id:'retention', label:'Retention/Churn Analysis'});
            if (/segment|cluster/i.test(text)) scenarios.push({id:'segmentation', label:'Customer Segmentation'});
            if (/optimi[sz]e|performance|cost/i.test(text)) scenarios.push({id:'optimization', label:'Query/Cost Optimization'});
            if (/pipeline|etl|elt/i.test(text)) scenarios.push({id:'pipeline', label:'Pipeline Reliability'});
            const listContainers = card.querySelectorAll('div');
            const listContainer = listContainers && listContainers[1] ? listContainers[1] : card;
            if (scenarios.length && listContainer) {
                listContainer.innerHTML = scenarios.map(s => `
                    <button class=\"btn\" style=\"background:#0ea5e9; color:white; text-align:left; padding:0.75rem;\" data-action=\"load-sql-scenario\" data-scenario=\"${s.id}\">
                        <strong>${s.label}</strong>
                    </button>`).join('');
                card.dataset.hascontent = 'true';
            } else {
                card.dataset.hascontent = 'false';
            }
        }

        function updateTechBadges() {
            const wrap = document.getElementById('detectedTech');
            if (!wrap) return;
            const tech = deriveTechStack(getCombinedContent());
            if (!tech.length) { wrap.innerHTML = ''; return; }
            wrap.innerHTML = tech.map(t => `<span style="display:inline-block; padding:0.25rem 0.5rem; background:#f1f5f9; border:1px solid #e2e8f0; border-radius:9999px; font-size:0.75rem;">${t}</span>`).join(' ');
        }

        function updateQuickTipsFromData() {
            const card = document.getElementById('quickTipsCard');
            if (!card) return;
            if (!appState.dataLoaded) { card.style.display = 'none'; return; }
            const strengths = appState.extractedData.strengths || [];
            const gaps = appState.extractedData.gaps || [];
            const tech = deriveTechStack(getCombinedContent());
            const doTips = [];
            const avoidTips = [];
            if (strengths.length) doTips.push('Quantify results with concrete metrics');
            if (tech.length) doTips.push(`Reference your stack: ${tech.slice(0,4).join(', ')}`);
            doTips.push('Use STAR for behavioral answers');
            doTips.push('Tie answers to business impact');
            doTips.push('Validate cost and performance trade-offs');
            if (gaps.length) {
                avoidTips.push('Over-claiming beyond your experience');
                avoidTips.push('Ignoring mitigation steps for gaps');
            }
            avoidTips.push('Generic answers without concrete examples');
            avoidTips.push('Tool name-dropping without outcomes');

            // Rebuild inner content of quick tips card
            const sections = `
                <div class="grid grid-2">
                    <div style="background:#f0fdf4; padding:1rem; border-radius:0.5rem;">
                        <h4 style="color:#22c55e; margin-bottom:0.5rem;">✅ Do This</h4>
                        <ul style="margin:0; padding-left:1rem; font-size:0.875rem;">
                            ${doTips.map(x=>`<li>${x}</li>`).join('')}
                        </ul>
                    </div>
                    <div style="background:#fef3c7; padding:1rem; border-radius:0.5rem;">
                        <h4 style="color:#f59e0b; margin-bottom:0.5rem;">⚠️ Avoid This</h4>
                        <ul style="margin:0; padding-left:1rem; font-size:0.875rem;">
                            ${avoidTips.map(x=>`<li>${x}</li>`).join('')}
                        </ul>
                    </div>
                </div>`;
            // Keep existing title, replace the content section below title
            const titleH3 = card.querySelector('h3');
            card.innerHTML = '';
            if (titleH3) card.appendChild(titleH3);
            const contentDiv = document.createElement('div');
            contentDiv.innerHTML = sections;
            card.appendChild(contentDiv);
            card.style.display = '';
        }

        // Build a company intel markdown summary from uploaded content
        async function extractCompanyIntelAgnostic() {
            const company = cleanCompanyDisplayName(appState.extractedData.company || '') || '';
            const role = cleanRoleTitle(appState.extractedData.role || '') || '';

            const intelText = getFileContentsByPattern(/intelligence/i).trim();
            const resumeText = getFileContentsByPattern(/resume|curriculum\s*vitae|cv/i);
            const strategyText = getFileContentsByPattern(/strategic\s*foundation|experience\s*map|gemini/i);
            const fallback = getCombinedContent();
            const sourceText = intelText || strategyText || fallback;

            const derivedBackground = appState.extractedData.candidateBackground || deriveCandidateBackground(resumeText);
            if (derivedBackground) {
                appState.extractedData.candidateBackground = derivedBackground;
            }

            const tech = deriveTechStack(sourceText);
            const strengths = Array.isArray(appState.extractedData.strengths) ? appState.extractedData.strengths : [];
            const gapDetails = Array.isArray(appState.extractedData.gapDetails) ? appState.extractedData.gapDetails : [];
            const metrics = Array.isArray(appState.extractedData.metrics) ? appState.extractedData.metrics : [];

            const takeTop = (arr, count = 6) => Array.from(new Set(arr.filter(Boolean))).slice(0, count);
            const metricsText = takeTop(metrics.map(m => {
                if (!m || !m.label || !m.value) return '';
                const growth = m.growth ? ` (${m.growth})` : '';
                const context = m.context ? ` — ${m.context}` : '';
                return `${m.label}: ${m.value}${growth}${context}`;
            }), 8);
            const strengthsList = takeTop(strengths, 6);
            const gapsList = takeTop(gapDetails.map(d => d.title || ''), 5);

            const defaultFocus = [];
            if (/play\s*points/i.test(sourceText)) defaultFocus.push('Play Points loyalty growth & tier optimization');
            if (/android/i.test(sourceText)) defaultFocus.push('Android ecosystem scale & developer enablement');
            if (/ai|machine learning|gemini/i.test(sourceText)) defaultFocus.push('AI & Gemini acceleration across Google Play');
            if (/revenue|monetization/i.test(sourceText)) defaultFocus.push('Monetization and revenue efficiency');
            if (!defaultFocus.length) defaultFocus.push('Customer engagement & scalable analytics');

            const defaultRisks = [];
            if (/regulat|dma|compliance|lawsuit/i.test(sourceText)) defaultRisks.push('Regulatory pressure (DMA, antitrust, payment policies)');
            if (/competition|apple|app store/i.test(sourceText)) defaultRisks.push('Competitive pressure from Apple App Store');
            if (/churn|retention/i.test(sourceText)) defaultRisks.push('Member churn / retention headwinds');
            if (!defaultRisks.length) defaultRisks.push('Maintain data reliability & stakeholder trust');

            const defaultOpportunities = [];
            if (/expansion|international|global/i.test(sourceText)) defaultOpportunities.push('International expansion and localization gains');
            if (/personalization|ai|ml/i.test(sourceText)) defaultOpportunities.push('AI-powered personalization for loyalty members');
            if (/streaming|real[-\s]?time/i.test(sourceText)) defaultOpportunities.push('Real-time analytics and proactive interventions');
            if (!defaultOpportunities.length) defaultOpportunities.push('Cross-functional storytelling with quantified impact');

            let llmIntel = null;
            try {
                if (window.__LLM_ENABLED__ && sourceText.trim()) {
                    llmIntel = await llmExtract('companyIntel', sourceText.slice(0, 12000));
                }
            } catch (e) { /* ignore */ }

            const summary = llmIntel?.summary || (sourceText ? sourceText.split(/\n\s*\n/)[0].replace(/\n+/g, ' ').slice(0, 400) : '');
            const focusAreas = takeTop(llmIntel?.focusAreas || defaultFocus, 6);
            const opportunities = takeTop(llmIntel?.opportunities || defaultOpportunities, 5);
            const risks = takeTop(llmIntel?.risks || defaultRisks, 5);
            const metricHighlights = takeTop(llmIntel?.metrics || [], 6);

            const summaryBlock = summary ? `> ${summary}\n\n` : '';
            const focusMd = focusAreas.map(f => `- ${f}`).join('\n');
            const riskMd = risks.map(r => `- ${r}`).join('\n');
            const opportunityMd = opportunities.map(o => `- ${o}`).join('\n');
            const metricsMd = (metricHighlights.length ? metricHighlights : metricsText).map(m => `- ${m}`).join('\n') || '- Provide metrics in your materials to populate this section';
            const strengthsMd = strengthsList.length ? strengthsList.map(s => `- ${s}`).join('\n') : '- Add strengths in your materials to populate';
            const gapsMd = gapsList.length ? gapsList.map(g => `- ${g}`).join('\n') : '- Populate strategic documents to surface gaps to address';
            const backgroundMd = derivedBackground ? derivedBackground.replace(/\n+/g, ' ') : '';

            const techMd = tech.length ? tech.map(t => `- ${t}`).join('\n') : '- Tech signals will appear when detected';

            let md = `## Executive Brief\n\n${summaryBlock}**Company:** ${company || '—'}  \\
**Role:** ${role || '—'}\n\n### Strategic Focus Areas\n${focusMd}`;
            md += `\n\n### Detected Tech Stack\n${techMd}`;
            md += `\n\n### Key Metrics\n${metricsMd}`;
            md += `\n\n### Candidate Background\n${backgroundMd ? `- ${backgroundMd}` : '- Add a resume to surface your background summary'}`;
            md += `\n\n### Strengths\n${strengthsMd}`;
            md += `\n\n### Potential Gaps\n${gapsMd}`;
            md += `\n\n### Risks & Watchouts\n${riskMd}`;
            md += `\n\n### Opportunities\n${opportunityMd}`;

            const sourceLabel = intelText
                ? `Intelligence files${llmIntel ? ' (LLM-assisted)' : ''}`
                : strategyText
                    ? 'Strategic documents'
                    : 'Uploaded materials';

            appState.extractedData.companyIntel = md;
            appState.extractedData.companyIntelSource = sourceLabel;
        }

        // Small helper to render a consistent AI badge in templates
        function aiBadge() {
            return '<span class="ai-badge">AI</span>';
        }

        // Helpers to fetch text from .md/.docx/.pdf (and fallback)
        const __scriptCache = new Map();
        function loadScript(src) {
            if (__scriptCache.has(src)) return __scriptCache.get(src);
            const p = new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = src;
                s.async = true;
                s.onload = () => resolve();
                s.onerror = () => reject(new Error('Failed to load ' + src));
                document.head.appendChild(s);
            });
            __scriptCache.set(src, p);
            return p;
        }

        // Lightweight client helper to call our optional /api/llm endpoint.
        // Returns parsed data or null on any error/unavailability.
        async function llmExtract(task, text, model) {
            try {
                if (!window.__LLM_ENABLED__) return null;
                // Avoid calling API when running directly from file://
                if (typeof window !== 'undefined' && String(window.location.protocol).startsWith('file')) return null;
                const headers = { 'Content-Type': 'application/json' };
                if (appState.llmApiKey) {
                    headers['X-LLM-Key'] = appState.llmApiKey;
                }
                const res = await fetch('/api/llm', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ task, text, model }),
                    credentials: 'same-origin'
                });
                if (res.status === 501) {
                    if (!appState.llmConfigWarningShown) {
                        try { showToast('LLM assist not configured. Add a Gemini API key to enable AI features.', 'warning'); } catch (e) {}
                        appState.llmConfigWarningShown = true;
                    }
                    return null;
                }
                if (!res.ok) return null;
                const json = await res.json().catch(() => null);
                if (!json || json.ok !== true) return null;
                return json.data || null;
            } catch (e) {
                return null;
            }
        }

        function updateLlmKeyStatus() {
            const statusEl = document.getElementById('llmKeyStatus');
            if (!statusEl) return;
            const hasKey = !!appState.llmApiKey;
            statusEl.textContent = hasKey
                ? 'LLM assist enabled. Optional AI enrichments will use your key until you clear it.'
                : 'LLM assist is currently disabled. Deterministic parsing only.';
            statusEl.style.color = hasKey ? '#15803d' : '#64748b';
        }

        function setLlmApiKey(rawKey, { persist = false, silent = false } = {}) {
            const key = String(rawKey || '').trim();
            appState.llmApiKey = key;
            appState.llmKeyRemember = !!(persist && key);
            appState.llmConfigWarningShown = false;
            const input = document.getElementById('llmKeyInput');
            if (input && input.value !== key) input.value = key;
            const remember = document.getElementById('llmKeyRemember');
            if (remember) remember.checked = !!(persist && key);
            if (persist && key) {
                try { sessionStorage.setItem('dashboard.llmKey', key); } catch (e) {}
            } else {
                try { sessionStorage.removeItem('dashboard.llmKey'); } catch (e) {}
            }
            updateLlmKeyStatus();
            if (!silent) {
                if (key) {
                    try { showToast('LLM assist enabled for this session.', 'success'); } catch (e) {}
                } else {
                    try { showToast('LLM assist disabled. Falling back to deterministic parsing.', 'info'); } catch (e) {}
                }
            }
        }

        function handleLlmKeySubmit(event) {
            event.preventDefault();
            const form = event.target;
            const input = form.querySelector('#llmKeyInput');
            const remember = form.querySelector('#llmKeyRemember');
            const key = input ? input.value : '';
            const persist = !!(remember && remember.checked);
            setLlmApiKey(key, { persist });
        }

        function clearLlmKey() {
            setLlmApiKey('', { persist: false });
        }

        function initializeLlmControls() {
            const form = document.getElementById('llmKeyForm');
            if (form) {
                form.addEventListener('submit', handleLlmKeySubmit);
            }
            try {
                const stored = sessionStorage.getItem('dashboard.llmKey');
                if (stored) {
                    setLlmApiKey(stored, { persist: true, silent: true });
                } else {
                    updateLlmKeyStatus();
                }
            } catch (e) {
                updateLlmKeyStatus();
            }
        }

        async function ensurePapaParse() {
            if (window.Papa) return;
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.3.2/papaparse.min.js');
        }

        async function ensureMammoth() {
            if (window.mammoth) return;
            await loadScript('https://unpkg.com/mammoth/mammoth.browser.min.js');
        }

        async function ensurePdfJs() {
            if (window.pdfjsLib) return;
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
            try {
                if (window.pdfjsLib) {
                    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                }
            } catch (e) { /* ignore */ }
        }
        async function fetchText(path) {
            try {
                if (path.endsWith('.md') || path.endsWith('.txt') || path.endsWith('.csv') || path.endsWith('.json')) {
                    const res = await fetch(path);
                    if (!res.ok) return '';
                    return await res.text();
                }
                if (path.endsWith('.docx')) {
                    const res = await fetch(path);
                    if (!res.ok) return '';
                    const buf = await res.arrayBuffer();
                    await ensureMammoth();
                    if (window.mammoth && mammoth.extractRawText) {
                        const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
                        return value || '';
                    }
                    return '';
                }
                if (path.endsWith('.pdf')) {
                    await ensurePdfJs();
                    if (window.pdfjsLib) {
                        const doc = await pdfjsLib.getDocument(path).promise;
                        let text = '';
                        for (let i = 1; i <= doc.numPages; i++) {
                            const page = await doc.getPage(i);
                            const content = await page.getTextContent();
                            text += '\n' + content.items.map(it => it.str).join(' ');
                        }
                        return text;
                    }
                }
                const res = await fetch(path);
                if (res.ok) return await res.text();
            } catch (e) { /* ignore */ }
            return '';
        }

        async function fetchTextForCandidates(paths) {
            let joined = '';
            for (const p of paths) {
                const t = await fetchText(p);
                if (t) joined += '\n' + t;
            }
            return { text: joined.trim() };
        }

        function handleFiles(files) {
            const fileList = document.getElementById('fileList');
            fileList.innerHTML = '<p style="font-weight: 500; margin-bottom: 0.5rem;">Selected Files:</p>';
            
            appState.uploadedFiles = Array.from(files);
            
            appState.uploadedFiles.forEach(file => {
                const fileItem = document.createElement('div');
                fileItem.style.cssText = 'padding: 0.5rem; background: #f8fafc; border-radius: 0.25rem; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;';
                
                const fileInfo = document.createElement('span');
                fileInfo.textContent = `📄 ${file.name} (${(file.size / 1024).toFixed(1)}KB)`;
                
                fileItem.appendChild(fileInfo);
                fileList.appendChild(fileItem);
            });
            // Enable process button if files selected
            setProcessBtnEnabled(appState.uploadedFiles.length > 0);
        }

        async function readFileContent(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onerror = reject;
                const name = (file.name || '').toLowerCase();
                if (name.endsWith('.docx')) {
                    reader.onload = async (e) => {
                        try {
                            await ensureMammoth();
                            const buf = e.target.result;
                            if (window.mammoth && mammoth.extractRawText) {
                                const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
                                resolve(value || '');
                            } else {
                                resolve('');
                            }
                        } catch (err) {
                            resolve('');
                        }
                    };
                    reader.readAsArrayBuffer(file);
                } else if (name.endsWith('.pdf')) {
                    reader.onload = async (e) => {
                        try {
                            await ensurePdfJs();
                            if (!window.pdfjsLib) { resolve(''); return; }
                            const buf = e.target.result;
                            const doc = await pdfjsLib.getDocument({ data: buf }).promise;
                            let text = '';
                            for (let i = 1; i <= doc.numPages; i++) {
                                const page = await doc.getPage(i);
                                const content = await page.getTextContent();
                                text += '\n' + content.items.map(it => it.str).join(' ');
                            }
                            resolve(text);
                        } catch (err) {
                            resolve('');
                        }
                    };
                    reader.readAsArrayBuffer(file);
                } else {
                    reader.onload = (e) => resolve(e.target.result);
                    reader.readAsText(file);
                }
            });
        }

        async function processFiles() {
            const processBtn = document.querySelector('#processBtnText');
            const processBtnEl = document.querySelector('[data-action="process-files"]');
            if (!appState.uploadedFiles || appState.uploadedFiles.length === 0) {
                updateDataStatus('No files selected. Please add files to process.', 'warning');
                showToast('Please add files to process', 'warning');
                return;
            }
            if (processBtn) {
                processBtn.textContent = 'Processing...';
            }
            if (processBtnEl) processBtnEl.disabled = true;
            
            showToast('Processing files...', 'info');
            
            try {
                let processedCount = 0;
                for (const file of appState.uploadedFiles) {
                    const content = await readFileContent(file);
                    appState.fileContents[file.name] = content;
                    if (content && String(content).trim().length > 0) processedCount++;
                    
                    // Check if this is a CSV file with questions
                    if (file.name.toLowerCase().includes('questions') && file.name.endsWith('.csv')) {
                        await ensurePapaParse();
                        // Parse CSV for questions
                        const results = Papa.parse(content, {
                            header: true,
                            skipEmptyLines: true
                        });
                        
                        // Process questions from CSV
                        const csvQuestions = results.data.map(row => {
                            const question = row['Question'] || '';
                            const prepNotes = row['My Prep Notes (test, STAR link, follow-ups)'] || '';
                            
                            let category = 'behavioral';
                            if (question.includes('[Technical]')) {
                                category = 'technical';
                            } else if (question.includes('[Behavioral]')) {
                                category = 'behavioral';
                            } else if (question.includes('[Situational]')) {
                                category = 'situational';
                            }
                            
                            const cleanQuestion = question
                                .replace(/\[.*?\]\s*/, '')
                                .trim();
                            
                            const answer = prepNotes
                                .replace(/Tests:/, 'Focus:')
                                .replace(/STAR:/, 'Use STAR:')
                                .replace(/Follow-ups:/, 'Prepare for:')
                                .trim();
                            
                            return {
                                question: cleanQuestion,
                                answer: answer || 'Review prep notes and STAR examples',
                                category: category,
                                fromCSV: true
                            };
                        }).filter(q => q.question);
                        
                        if (csvQuestions.length > 0) {
                            appState.extractedData.questions = csvQuestions;
                        }
                    }

                    // Metrics CSV detection and parsing
                    if (file.name.toLowerCase().includes('metric') && file.name.endsWith('.csv')) {
                        await ensurePapaParse();
                        const results = Papa.parse(content, {
                            header: true,
                            skipEmptyLines: true
                        });
                        const rows = Array.isArray(results.data) ? results.data : [];
                        const parsedMetrics = [];
                        const get = (row, keys) => {
                            for (const k of keys) {
                                if (row[k] && String(row[k]).trim()) return String(row[k]).trim();
                            }
                            return '';
                        };
                        const isValidValue = (v) => {
                            if (!v) return false;
                            const s = String(v).trim();
                            if (s.length > 20) return false;
                            return /^(\$?\d[\d,.]*)([MBK]\+?)?$/.test(s) || /^(\d+%|\d+\+?)$/.test(s);
                        };
                        rows.forEach(row => {
                            const label = get(row, ['Category', 'Label', 'Metric', 'Name']);
                            const value = get(row, ['Value', 'Amount', 'Figure']);
                            const growth = get(row, ['Growth', 'Change']);
                            const context = get(row, ['Context', 'Source', 'Notes']);
                            if (label && isValidValue(value)) {
                                parsedMetrics.push({ label, value, growth, context });
                            }
                        });
                        if (parsedMetrics.length) {
                            appState.extractedData.metrics = parsedMetrics.slice(0, 12);
                        }
                    }
                }
                
                await extractDataFromFiles();
                updateUploadChecklist();
                appState.dataLoaded = true;
                setTabsEnabled(true);
                detectSQLInFiles();
                updateSqlAvailabilityUI();
                collectSQLSnippetsFromFiles();
                updateDashboard();
                updateRequiresDataVisibility();
                // Initialize countdown now that files are available
                await initializeInterviewCountdown();
                // Fill SQL editor if we found any snippets
                populateSQLEditorFromSnippets();
                updateSqlSnippetList();
                if (processedCount > 0) {
                    updateDataStatus('Files processed successfully!', 'success');
                    showToast('Files processed successfully!', 'success');
                    switchTab('command');
                } else {
                    updateDataStatus('No readable content found in the selected files.', 'warning');
                    showToast('No readable content found. Please try different files.', 'warning');
                }

            } catch (error) {
                console.error('Error processing files:', error);
                updateDataStatus('Error processing files. Please try again with supported files.', 'error');
            } finally {
                if (processBtn) {
                    processBtn.textContent = 'Process Files';
                }
                if (processBtnEl) processBtnEl.disabled = !(appState.uploadedFiles && appState.uploadedFiles.length > 0);
            }
        }

        async function extractDataFromFiles() {
            // Enhanced extraction logic
            const combinedContent = Object.values(appState.fileContents).join('\n');
            const fileNames = Object.keys(appState.fileContents || {});
            const hasJDFile = fileNames.some(n => /\b(jd|job\s*description)\b/i.test(n));
            
            // Detect candidate name early (from resume files) to avoid false panelists
            try { detectCandidateNameFromUploads(); } catch (e) { /* ignore */ }

            // Prefer company + role from JD uploads if present
            try {
                const fromJD = extractCompanyRoleFromJDUploads();
                if (fromJD.company) appState.extractedData.company = fromJD.company;
                if (fromJD.role) appState.extractedData.role = fromJD.role;
            } catch (e) { /* ignore */ }

            // Extract company and role from uploaded text and filenames (agnostic)
            const inferredTxt = inferCompanyAndRoleFromText(combinedContent);
            const inferredNames = inferCompanyAndRoleFromFilenames(Object.keys(appState.fileContents || {}));
            const roleLineMatch = combinedContent.match(/(?:^|\n)\s*(Role|Position|Title)\s*[:\-–]\s*([^\n]+)/i);
            const companyLineMatch = combinedContent.match(/(?:^|\n)\s*(Company|Company Name|Employer|Organization|Client)\s*[:\-–]\s*([^\n]+)/i);
            const candidates = {
                company: appState.extractedData.company || (companyLineMatch && companyLineMatch[2].trim()) || inferredTxt.company || inferredNames.company,
                role: appState.extractedData.role || (roleLineMatch && roleLineMatch[2].trim()) || inferredTxt.role || inferredNames.role
            };
            if (candidates.company) appState.extractedData.company = candidates.company;
            if (candidates.role) appState.extractedData.role = candidates.role;

            // LLM assist for company/role if still missing
            try {
                if (window.__LLM_ENABLED__ && (!appState.extractedData.company || !appState.extractedData.role)) {
                    const cr = await llmExtract('companyRole', combinedContent);
                    if (cr) {
                        if (!appState.extractedData.company && cr.company) appState.extractedData.company = cleanCompanyDisplayName(cr.company);
                        if (!appState.extractedData.role && cr.role) appState.extractedData.role = cleanRoleTitle(cr.role);
                    }
                }
            } catch (e) { /* ignore */ }
            
            // Prefer JD-derived panelists; only use generic sources if no JD file is present
            if (!hasJDFile) {
                try { extractInterviewerInfo(combinedContent); } catch (e) { /* ignore */ }
                try { extractPanelistDetailsFromQA(combinedContent); } catch (e) { /* ignore */ }
            }

            // Populate/override panelists from uploaded JD file(s)
            try { await extractPanelistsFromJDUploads(); } catch (e) { /* ignore */ }
            
            // Extract STAR stories from documents
            extractSTARStories(combinedContent);
            try {
                if ((appState.extractedData.stories || []).length < 2 && window.__LLM_ENABLED__) {
                    const llmStories = await llmExtract('star', combinedContent);
                    if (Array.isArray(llmStories) && llmStories.length) {
                        const merged = mergeStories((appState.extractedData.stories || []), llmStories);
                        appState.extractedData.stories = merged.slice(0, 12);
                    }
                }
            } catch (e) { /* ignore */ }
            
            // Extract key metrics (text + CSV), then optional LLM supplement
            extractKeyMetrics(combinedContent);
            try {
                if (window.__LLM_ENABLED__ && (!appState.extractedData.metrics || appState.extractedData.metrics.length === 0)) {
                    const mx = await llmExtract('metrics', combinedContent);
                    if (Array.isArray(mx) && mx.length) {
                        const existing = new Set((appState.extractedData.metrics||[]).map(m => `${m.label}|${m.value}`));
                        const merged = (appState.extractedData.metrics||[]).slice();
                        mx.forEach(m => {
                            const key = `${m.label}|${m.value}`;
                            if (!existing.has(key)) merged.push(m);
                        });
                        appState.extractedData.metrics = merged.slice(0, 12);
                    }
                }
            } catch (e) { /* ignore */ }
            
            // Extract strengths and gaps
            extractStrengthsAndGaps(combinedContent);
            try {
                if (window.__LLM_ENABLED__) {
                    const sg = await llmExtract('strengths', combinedContent);
                    if (sg) {
                        if (Array.isArray(sg.strengths)) {
                            const curr = new Set((appState.extractedData.strengths||[]));
                            sg.strengths.forEach(s => curr.add(s));
                            appState.extractedData.strengths = Array.from(curr).slice(0, 18);
                        }
                        if (Array.isArray(sg.gaps)) {
                            const existingDetails = Array.isArray(appState.extractedData.gapDetails) ? appState.extractedData.gapDetails.slice() : [];
                            const seen = new Set(existingDetails.map(d => (d.title || '').toLowerCase()));
                            sg.gaps.forEach(raw => {
                                const title = String(raw || '').trim();
                                if (!title) return;
                                const key = title.toLowerCase();
                                if (seen.has(key)) return;
                                existingDetails.push({
                                    title,
                                    reason: 'Identified by LLM analysis of your materials.',
                                    mitigation: 'Prepare how you will bridge this area (ramp plan, transferable project, or quick case study).'
                                });
                                seen.add(key);
                            });
                            const limited = existingDetails.slice(0, 8);
                            appState.extractedData.gapDetails = limited;
                            appState.extractedData.gaps = limited.map(detail => detail.title);
                        }
                    }
                }
            } catch (e) { /* ignore */ }
            // Enhance strengths with resume content if available
            try { mergeResumeStrengthsFromUploads(); } catch (e) { /* ignore */ }
            
            // Do not set hardcoded defaults; remain agnostic until files provide context
            
            // Extract questions from Q&A documents
            extractQuestionsFromContent(combinedContent);
            try {
                if (window.__LLM_ENABLED__ && (!appState.extractedData.questions || appState.extractedData.questions.length === 0)) {
                    const qs = await llmExtract('questions', combinedContent);
                    if (Array.isArray(qs) && qs.length) {
                        appState.extractedData.questions = qs;
                    }
                }
            } catch (e) { /* ignore */ }
            
            // Extract company intelligence (agnostic)
            await extractCompanyIntelAgnostic();

            // Fallback: infer role from resume if not already set
            try {
                if (!appState.extractedData.role) {
                    const inferredRole = inferRoleFromResumeUploads();
                    if (inferredRole) appState.extractedData.role = inferredRole;
                }
            } catch (e) { /* ignore */ }
            
            // Preserve existing questions if they were already loaded from CSV
            if (!appState.extractedData.questions || appState.extractedData.questions.length === 0) {
                appState.extractedData.questions = [];
            }

            // Final sanitation: never include candidate as panelist
            try { ensureCandidateNotListedAsPanelist(); } catch (e) { /* ignore */ }
        }

        // --- Company/Role extraction from JD uploads ---
        function cleanRoleTitle(title) {
            let s = String(title || '').trim();
            if (!s) return '';
            s = s.replace(/https?:\/\/\S+/g, '')
                 .replace(/[\u2013\u2014]/g, '-')
                 .replace(/^[\-:•\s]+|[\-:•\s]+$/g, '')
                 .replace(/\s{2,}/g, ' ');
            // Stop at section labels that sometimes get concatenated in PDFs
            s = s.replace(/\s*(?:Location|Department|Employment\s*Type|Salary|Website|Company|Recruiter|Contact|Reports?\s*To)\b[\s\S]*$/i, '').trim();
            // Remove trailing parenthetical fragments
            s = s.replace(/\s*\([^)]*\)\s*$/, '').trim();
            // Drop obvious non-role noise
            if (/\b(questions?|playbook|brief|analysis|intel|strategy|notes?)\b/i.test(s)) return '';
            const roleRx = /(Analyst|Engineer|Scientist|Manager|Architect|Director|Lead|Head|Specialist|Consultant)/i;
            if (!roleRx.test(s)) return '';
            // Limit to 8 words to avoid run-on text
            const words = s.split(/\s+/);
            if (words.length > 8) s = words.slice(0,8).join(' ');
            // Title-case
            s = s.split(' ').map(w => (/^[A-Z0-9]{2,}$/.test(w) ? w : (w.charAt(0).toUpperCase()+w.slice(1).toLowerCase()))).join(' ');
            return s.substring(0, 80).trim();
        }

        function extractCompanyRoleFromJDText(text) {
            if (!text) return { company: '', role: '' };
            const t = String(text).replace(/[\u2013\u2014]/g, '-');
            let company = '';
            let role = '';
            let m;
            m = t.match(/Company\s*Name\s*[:\-–—]\s*([^\n]{2,180})/i) || t.match(/Company\s*[:\-–—]\s*([^\n]{2,180})/i) || t.match(/Employer\s*[:\-–—]\s*([^\n]{2,180})/i);
            if (m) {
                // Trim at sentence/punctuation or section keyword to avoid pulling full paragraph
                let raw = (m[1] || '').trim();
                raw = raw.split(/\s*(?:\.|;|\||\-|\bWebsite\b|\bJob\s*Title\b|\bLocation\b|\bDepartment\b)\s*/i)[0];
                company = cleanCompanyDisplayName(raw);
            }
            m = t.match(/(Job\s*Title|Title|Position|Role)\s*[:\-–—]\s*([^\n]{2,160})/i);
            if (m) role = cleanRoleTitle(m[2]);
            return { company, role };
        }

        function extractCompanyRoleFromJDUploads() {
            const entries = Object.entries(appState.fileContents || {});
            const jdEntries = entries.filter(([name]) => /\bjd\b/i.test(name) || /job\s*description/i.test(name));
            let best = { company: '', role: '' };
            for (const [name, text] of jdEntries) {
                const { company, role } = extractCompanyRoleFromJDText(text || '');
                if (company && !best.company) best.company = company;
                if (role && !best.role) best.role = role;
                if (best.company && best.role) break;
            }
            // Fallback to filename if still missing
            if ((!best.company || !best.role) && jdEntries.length) {
                const base = jdEntries[0][0];
                const fromName = inferCompanyAndRoleFromFilenames([base]);
                if (!best.company && fromName.company) best.company = cleanCompanyDisplayName(fromName.company);
                if (!best.role && fromName.role) best.role = cleanRoleTitle(fromName.role);
            }
            return best;
        }

        // Parse panelists from uploaded JD files (filenames containing 'JD')
        async function extractPanelistsFromJDUploads() {
            const entries = Object.entries(appState.fileContents || {});
            const dbg = { viaLinkedIn: [], viaBullets: [], viaFallback: [], viaLLM: [], viaRescue: [], final: [] };
            if (!Array.isArray(appState.extractedData.panelists)) appState.extractedData.panelists = [];
            // Prefer files likely to be JD
            // Only consider canonical JD files; avoid Q&A/Interview banks that include the word "interview"
            const jdEntries = entries.filter(([name]) => /\b(jd|job\s*description)\b/i.test(name));
            let all = [];
            if (jdEntries.length > 0) {
                jdEntries.forEach(([name, text]) => {
                    // 1) Anchor on LinkedIn URLs which are highly reliable in this JD
                    let found = extractPanelistsViaLinkedIn(text || '');
                    if (found.length) dbg.viaLinkedIn.push(...found.map(p=>({source:name,...p})));
                    // 2) Structured bullets parser
                    if (!found.length) found = parsePanelistsFromJDText(text || '');
                    if (found.length) { all.push(...found); dbg.viaBullets.push(...found.map(p=>({source:name,...p}))); }
                    // Fallback heuristics if the structured parser finds nothing
                    if (!found.length) {
                        const alt = robustPanelistsFromPdf(text || '');
                        if (alt.length) { all.push(...alt); dbg.viaFallback.push(...alt.map(p=>({source:name,...p}))); }
                    }
                });
                // 3) Optional LLM assist over combined JD content
                try {
                    if (window.__LLM_ENABLED__) {
                        const combinedJD = jdEntries.map(([n,t]) => t || '').join('\n');
                        const llm = await llmExtract('panelists', combinedJD);
                        if (Array.isArray(llm) && llm.length) {
                            const mapped = llm.map(p => ({
                                name: p.name,
                                role: p.role,
                                linkedin: p.linkedin || '',
                                archetype: determineArchetypeFromRole(p.role)
                            }));
                            all.push(...mapped);
                            dbg.viaLLM.push(...mapped);
                        }
                        // Always run rescue to capture any leftover link/name pairs
                        const rescued = rescuePanelistsFromLinks(combinedJD);
                        if (rescued.length) { all.push(...rescued); dbg.viaRescue.push(...rescued); }
                    }
                } catch (e) { /* ignore */ }
            }
            // Fallback: search across all content for an "Interviewing With" section
            if (all.length === 0 && jdEntries.length === 0) {
                const combined = Object.values(appState.fileContents || {}).join('\n');
                all = parsePanelistsFromJDText(combined || '');
                if (!all.length) {
                    all = robustPanelistsFromPdf(combined || '');
                }
            }
            if (all.length === 0) return;
            // Deduplicate by name (case-insensitive)
            const byName = new Map();
            all.forEach(p => {
                if (!p || !p.name) return;
                const key = p.name.toLowerCase();
                if (!byName.has(key)) byName.set(key, p);
            });
            const jdPanelists = Array.from(byName.values());
            // Remove any that match the candidate's name
            let filtered = removeCandidateFromList(jdPanelists);
            // Prefer entries that have LinkedIn links and valid roles
            const roleRx = /(CIO|CTO|CEO|CFO|Chief\s+\w+|Director|Manager|Architect|Engineer|Scientist|Lead|Head|Recruiter|Talent|Solution|Power\s*BI|Developer|Analyst|Consultant)/i;
            const score = p => (p.linkedin && /linkedin\.com\/in/i.test(p.linkedin) ? 2 : 0) + (p.role && (/[a-z]/.test(p.role) || roleRx.test(p.role)) ? 1 : 0);
            filtered = filtered.sort((a,b) => score(b)-score(a));
            if (filtered.length) {
                appState.extractedData.panelists = filtered;
            } else {
                // If JD parsing fails, fall back to the broader Q&A/notes heuristics so panel strategy still populates.
                const combined = getCombinedContent ? getCombinedContent() : '';
                if (combined) {
                    const priorCount = (appState.extractedData.panelists || []).length;
                    try { extractPanelistDetailsFromQA(combined); } catch (e) { /* ignore */ }
                    let afterCount = (appState.extractedData.panelists || []).length;
                    if (afterCount === priorCount) {
                        try { extractInterviewerInfo(combined); } catch (e) { /* ignore */ }
                        afterCount = (appState.extractedData.panelists || []).length;
                    }
                    if (afterCount === priorCount) {
                        appState.extractedData.panelists = [];
                    }
                } else {
                    appState.extractedData.panelists = [];
                }
            }
            const finalPanelists = Array.isArray(appState.extractedData.panelists) ? appState.extractedData.panelists : [];
            // Save debug snapshot
            try { window.__PANELIST_DEBUG__ = { ...dbg, final: finalPanelists }; } catch (e) {}
        }

        function renderPanelistDebug() {
            if (!window.__DEBUG__) return;
            const host = document.getElementById('panelistsContainer');
            if (!host) return;
            let box = document.getElementById('panelistDebug');
            if (!box) {
                box = document.createElement('div');
                box.id = 'panelistDebug';
                box.style.cssText = 'margin-bottom:1rem; padding:0.75rem; background:#fff7ed; border:1px solid #fde68a; border-radius:8px;';
                host.parentNode.insertBefore(box, host);
            }
            const d = window.__PANELIST_DEBUG__ || {};
            const fmt = (arr) => (Array.isArray(arr) && arr.length) ? arr.map(p=>`${p.name}${p.role?` — ${p.role}`:''}${p.linkedin?` (${p.linkedin})`:''}`).join('<br>') : '<em>none</em>';
            box.innerHTML = `
                <details open>
                    <summary style="cursor:pointer; font-weight:600; color:#b45309;">Debug: Panelist Extraction</summary>
                    <div style="font-size:0.9rem; line-height:1.5; margin-top:0.5rem;">
                        <div><strong>LinkedIn‑anchored:</strong><br>${fmt(d.viaLinkedIn)}</div>
                        <div style="margin-top:0.5rem;"><strong>Bullets:</strong><br>${fmt(d.viaBullets)}</div>
                        <div style="margin-top:0.5rem;"><strong>Fallback (PDF):</strong><br>${fmt(d.viaFallback)}</div>
                        <div style="margin-top:0.5rem;"><strong>LLM:</strong><br>${fmt(d.viaLLM)}</div>
                        <div style="margin-top:0.5rem;"><strong>Rescued:</strong><br>${fmt(d.viaRescue)}</div>
                        <div style="margin-top:0.5rem;"><strong>Final:</strong><br>${fmt(d.final)}</div>
                    </div>
                </details>`;
        }

        // Rescue pass: for documents where the link lines detached from the bullets,
        // pair each linkedin.com/in URL with the nearest above line that looks like a person name.
        function rescuePanelistsFromLinks(text) {
            const out = [];
            if (!text) return out;
            const lines = String(text).split(/\r?\n/);
            const linkRe = /https?:\/\/www\.linkedin\.com\/in\/[A-Za-z0-9\-_%]+\/?/i;
            const nameRoleLoose = /^\s*(?:[-*•–·]|\d+\.)?\s*([A-Z][A-Za-z'’.\-]+(?:\s+[A-Z][A-Za-z'’.\-]+){1,2})\s*,?\s*([^()]{0,160})?\s*$/;
            for (let i = 0; i < lines.length; i++) {
                const ln = (lines[i]||'').trim();
                const m = ln.match(linkRe);
                if (!m) continue;
                const link = m[0];
                const prev = (lines[i-1]||'').trim();
                const prev2 = (lines[i-2]||'').trim();
                const tryLine = (s) => {
                    const mm = s.match(nameRoleLoose);
                    if (!mm) return false;
                    const name = (mm[1]||'').trim();
                    let role = (mm[2]||'').trim();
                    if (!name) return false;
                    if (!/^([A-Z][a-z'’.\-]+\s+[A-Z][a-z'’.\-]+(?:\s+[A-Z][a-z'’.\-]+)?)$/.test(name)) return false;
                    if (!role || role.length < 2) role = '';
                    out.push({ name, role, linkedin: link, archetype: determineArchetypeFromRole(role) });
                    return true;
                };
                if (tryLine(prev)) continue;
                tryLine(prev2);
            }
            // Deduplicate by name
            const byName = new Map();
            out.forEach(p => { const k = p.name.toLowerCase(); if (!byName.has(k)) byName.set(k, p); });
            return Array.from(byName.values());
        }

        // Use LinkedIn anchors to reliably extract Name, Role near each link
        function extractPanelistsViaLinkedIn(text) {
            if (!text) return [];
            const results = [];
            const t = String(text).replace(/[\u2013\u2014]/g, '-')
                                  .replace(/\s{2,}/g, ' ')
                                  .replace(/(•|\u2022|\u25CF)/g, '\n• ');
            const linkRe = /https?:\/\/www\.linkedin\.com\/in\/[A-Za-z0-9\-_%]+\/?/gi;
            const isLikelyPersonName = (n) => {
                if (!n) return false;
                const tokens = n.trim().split(/\s+/);
                if (tokens.length < 2 || tokens.length > 3) return false;
                // Reject ALLCAPS tokens and ensure title case-ish
                let ok = 0;
                for (const tok of tokens) {
                    if (/^[A-Z][a-z'’.\-]+$/.test(tok)) ok++;
                    if (/^[A-Z]{3,}$/.test(tok)) return false;
                }
                return ok >= 2;
            };
            const roleRx = /(CIO|CTO|CEO|CFO|Chief\s+\w+|Director|Manager|Architect|Engineer|Scientist|Lead|Head|Recruiter|Talent|Solution|Power\s*BI|Developer|Analyst|Consultant)/i;
            const isValidRole = r => r && r.length >= 2 && (/[a-z]/.test(r) || roleRx.test(r));

            let m;
            while ((m = linkRe.exec(t)) !== null) {
                const link = m[0];
                const start = Math.max(0, m.index - 220); // look back a couple hundred chars
                const before = t.slice(start, m.index);
                // Try last comma segment as role and preceding as name
                let seg = before.replace(/\n/g, ' ').trim();
                // remove trailing punctuation
                seg = seg.replace(/[()]+$/g, '').trim();
                // Pull "Name, Role" near the end
                let mr = seg.match(/([A-Z][A-Za-z'’.\-]+(?:\s+[A-Z][A-Za-z'’.\-]+){1,2})\s*,\s*([^,;|()]{2,160})$/);
                if (!mr) {
                    // fallback: previous line heuristic
                    const lines = before.split(/\n/).map(s=>s.trim()).filter(Boolean);
                    const last = lines[lines.length-1] || '';
                    const prev = lines[lines.length-2] || '';
                    mr = last.match(/([A-Z][A-Za-z'’.\-]+(?:\s+[A-Z][A-Za-z'’.\-]+){1,2})\s*,\s*([^,;|()]{2,160})$/) ||
                         prev.match(/([A-Z][A-Za-z'’.\-]+(?:\s+[A-Z][A-Za-z'’.\-]+){1,2})\s*,\s*([^,;|()]{2,160})$/);
                    // second fallback: scan last 120 chars for a likely name, then take words after comma as role
                    if (!mr) {
                        const tail = seg.slice(-120);
                        const nameOnly = tail.match(/([A-Z][A-Za-z'’.\-]+(?:\s+[A-Z][A-Za-z'’.\-]+){1,2})\s*,?\s*([^,;|()]{0,160})/);
                        if (nameOnly) mr = nameOnly; // role may be empty; we'll keep the entry anyway
                    }
                }
                if (mr) {
                    const name = mr[1].trim();
                    const role = (mr[2] || '').trim();
                    if (isLikelyPersonName(name) && isValidRole(role)) {
                        const item = { name, role, linkedin: link, archetype: determineArchetypeFromRole(role) };
                        if (!results.some(p => p.name.toLowerCase() === name.toLowerCase())) results.push(item);
                    } else if (isLikelyPersonName(name)) {
                        // keep if name is valid even when role couldn't be parsed
                        const item = { name, role: role || '', linkedin: link, archetype: determineArchetypeFromRole(role || '') };
                        if (!results.some(p => p.name.toLowerCase() === name.toLowerCase())) results.push(item);
                    }
                }
            }
            return results.slice(0, 6);
        }

        function parsePanelistsFromJDText(text) {
            if (!text) return [];
            // Normalize dashes and inject newlines before bullets to handle PDF text without line breaks
            let t = String(text).replace(/[\u2013\u2014]/g, '-')
                                .replace(/(•|\u2022|\u25CF)/g, '\n• ');
            const sectionHasLinkedin = /linkedin\.com\/in/i.test(t);
            const roleRx = /(CIO|CTO|CEO|CFO|Chief\s+\w+|Director|Manager|Architect|Engineer|Scientist|Lead|Head|Recruiter|Talent|Solution|Power\s*BI|Developer|Analyst|Consultant)/i;
            const isValidRole = r => r && r.length >= 3 && (/[a-z]/.test(r) || roleRx.test(r));
            const isLikelyPersonName = n => {
                if (!n) return false;
                const tokens = n.trim().split(/\s+/);
                if (tokens.length < 2 || tokens.length > 3) return false;
                let lowerCount = 0;
                for (const tok of tokens) {
                    if (/^[A-Z][a-z'’.\-]+$/.test(tok)) lowerCount++;
                    if (/^[A-Z]{3,}$/.test(tok)) return false; // reject ALLCAPS chunks like SAP
                }
                return lowerCount >= 2;
            };
            // Find the "Interviewing With" window to reduce false positives
            const startMatch = t.match(/interview\w*\s*with\s*[:\-–—]?/i) || t.match(/panelists?\s*[:\-–—]?/i) || t.match(/interviewers?\s*[:\-–—]?/i);
            if (startMatch) {
                const start = startMatch.index;
                const after = t.slice(start);
                const stopMatch = after.match(/\b(Job\s*Summary|Summary|About\s+the\s+Role|Responsibilities|Overview|Requirements|Qualifications)\b/i);
                const end = stopMatch ? start + stopMatch.index : Math.min(t.length, start + 1500);
                t = t.slice(start, end);
            }
            const lines = t.split(/\r?\n+/).map(s => s.trim()).filter(Boolean);
            const results = [];
            let inSection = false;
            let sectionCountdown = 60;
            const sectionRx = /(interview\w*\s*with|panel|panelists|interviewers?)/i;
            const bulletRx = /^\s*(?:[-*•–·]|\d+\.|\*)\s*/;
            const nameRoleRx = /^(?:[-*•–·]|\d+\.|\*)?\s*([A-Z][A-Za-z'’.\-]+(?:\s+[A-Z][A-Za-z'’.\-]+)+)\s*(?:[,–—-]|:\s*)?\s*([^()]{0,120}?)?\s*(?:\((https?:\/\/[^)]+)\))?\s*$/;

            for (let i = 0; i < lines.length; i++) {
                const raw = lines[i];
                if (!raw) continue;
                if (!inSection && sectionRx.test(raw)) { inSection = true; sectionCountdown = 60; continue; }
                if (!inSection) continue;
                if (sectionCountdown-- <= 0) break;

                // Attach bare URL to the matching bullet line above; if the previous
                // pushed entry is not the intended one (PDF line breaks), attempt to
                // infer the name/role from the preceding 1–2 lines and create/merge.
                const urlMatch = raw.match(/https?:\/\/\S+/);
                if (urlMatch) {
                    const link = urlMatch[0];
                    let attached = false;
                    if (results.length && !results[results.length - 1].linkedin) {
                        results[results.length - 1].linkedin = link;
                        attached = true;
                    } else {
                        const prev = (lines[i-1]||'').trim();
                        const prev2 = (lines[i-2]||'').trim();
                        const nameRoleLoose = /^\s*(?:[-*•–·]|\d+\.)?\s*([A-Z][A-Za-z'’.\-]+(?:\s+[A-Z][A-Za-z'’.\-]+){1,2})\s*,?\s*([^()]{0,160})?\s*$/;
                        const tryLine = (ln) => {
                            const m2 = ln.match(nameRoleLoose);
                            if (m2) {
                                const name = (m2[1]||'').trim();
                                let role = (m2[2]||'').trim();
                                if (!name) return false;
                                if (!isLikelyPersonName(name)) return false;
                                if (!isValidRole(role)) role = role || '';
                                if (!results.some(r => r.name.toLowerCase() === name.toLowerCase())) {
                                    results.push({ name, role, linkedin: link, archetype: determineArchetypeFromRole(role) });
                                } else {
                                    const idx = results.findIndex(r => r.name.toLowerCase() === name.toLowerCase());
                                    if (idx >= 0 && !results[idx].linkedin) results[idx].linkedin = link;
                                }
                                return true;
                            }
                            return false;
                        };
                        if (prev && !attached) attached = tryLine(prev);
                        if (!attached && prev2) attached = tryLine(prev2);
                    }
                    if (attached) continue; // handled the URL line
                }

                // Allow entries even without bullet prefix
                if (!bulletRx.test(raw) && !nameRoleRx.test(raw)) continue;
                const m = raw.match(nameRoleRx);
                if (m) {
                    const name = (m[1] || '').trim();
                    let role = (m[2] || '').trim();
                    const link = (m[3] || '').trim();
                    if (!isLikelyPersonName(name)) continue;
                    if (sectionHasLinkedin && !/linkedin\.com\/in/i.test(link)) continue;
                    // If role couldn't be parsed reliably, keep the entry with empty role (we'll still show the panelist)
                    if (!isValidRole(role)) role = role || '';
                    results.push({ name, role, linkedin: link || '', archetype: determineArchetypeFromRole(role) });
                }
            }
            // Inline scanner: handle no line breaks by scanning window text for Name, Role pairs
            if (results.length === 0 && t) {
                const reInline = /([A-Z][A-Za-z'’.\-]+(?:\s+[A-Z][A-Za-z'’.\-]+){1,2})\s*,\s*([^,;|()]{2,80})(?:\s*\((https?:\/\/[^)]+)\))?/g;
                let m;
                while ((m = reInline.exec(t)) !== null) {
                    const name = m[1].trim();
                    let role = (m[2] || '').trim();
                    const link = (m[3] || '').trim();
                    // exclude false positives where role looks like a sentence continuation
                    if (/\b(Job\s*Summary|Summary|About\s+the\s+Role)\b/i.test(role)) continue;
                    if (!isLikelyPersonName(name)) continue;
                    if (!isValidRole(role)) role = role || '';
                    if (sectionHasLinkedin && !/linkedin\.com\/in/i.test(link)) continue;
                    results.push({ name, role, linkedin: link || '', archetype: determineArchetypeFromRole(role) });
                }
            }
            return results.slice(0, 10);
        }

        // Robust fallback parser for PDFs with poor line structure
        function toTitleCaseName(n) {
            const isAllCaps = /^[A-Z][A-Z'’.\-]+(?:\s+[A-Z][A-Z'’.\-]+){1,3}$/.test(n);
            if (!isAllCaps) return n;
            return n.toLowerCase().replace(/\b([a-z])/g, m => m.toUpperCase());
        }

        function robustPanelistsFromPdf(text) {
            if (!text) return [];
            let t = String(text).replace(/[\u2013\u2014]/g, '-')
                                .replace(/\s{2,}/g, ' ')
                                .replace(/(•|\u2022|\u25CF)/g, '\n• ');
            // Limit to a window after the interviewer anchor if possible
            const anchor = t.search(/interview\w*\s*with/i);
            if (anchor >= 0) t = t.slice(anchor, Math.min(t.length, anchor + 2000));

            const results = [];
            const sectionHasLinkedin = /linkedin\.com\/in/i.test(t);
            const roleRx = /(CIO|CTO|CEO|CFO|Chief\s+\w+|Director|Manager|Architect|Engineer|Scientist|Lead|Head|Recruiter|Talent|Solution|Power\s*BI|Developer|Analyst|Consultant)/i;
            const isValidRole = r => r && r.length >= 3 && (/[a-z]/.test(r) || roleRx.test(r));
            const isLikelyPersonName = n => {
                if (!n) return false;
                const tokens = n.trim().split(/\s+/);
                if (tokens.length < 2 || tokens.length > 3) return false;
                let lowerCount = 0;
                for (const tok of tokens) {
                    if (/^[A-Z][a-z'’.\-]+$/.test(tok)) lowerCount++;
                    if (/^[A-Z]{3,}$/.test(tok)) return false;
                }
                return lowerCount >= 2;
            };
            const push = (name, role, link) => {
                if (!name) return;
                let n = name.trim();
                n = toTitleCaseName(n);
                if (!/^([A-Z][A-Za-z'’.\-]+(?:\s+[A-Z][A-Za-z'’.\-]+){1,3})$/.test(n)) return;
                const r = (role || '').trim();
                const lnk = (link || '').trim();
                if (!isLikelyPersonName(n) || !isValidRole(r)) return;
                if (sectionHasLinkedin && !/linkedin\.com\/in/i.test(lnk)) return;
                const item = { name: n, role: r, linkedin: lnk, archetype: determineArchetypeFromRole(r) };
                if (!results.some(p => p.name.toLowerCase() === item.name.toLowerCase())) results.push(item);
            };

            // Pattern 1: single-line "Name, Role (link)"
            const re1 = /(?:^|\n)\s*(?:[-*•–·]\s*)?([A-Z][A-Za-z'’.\-]+(?:\s+[A-Z][A-Za-z'’.\-]+){1,3})\s*,\s*([^\n()]{2,160})\s*(?:\((https?:\/\/[^)]+)\))?(?=\n|$)/g;
            let m;
            while ((m = re1.exec(t)) !== null) push(m[1], m[2], m[3]);

            // Pattern 2: line break between name and role
            if (results.length === 0) {
                const lines = t.split(/\r?\n+/).map(s => s.trim()).filter(Boolean);
                for (let i = 0; i < lines.length - 1; i++) {
                    const ln = lines[i];
                    const nx = lines[i+1];
                    const nm = ln.match(/^([A-Z][A-Za-z'’.\-]+(?:\s+[A-Z][A-Za-z'’.\-]+){1,3}),?\s*$/);
                    const roleRx = /(CIO|CTO|CEO|CFO|Chief\s+\w+|Director|Manager|Architect|Engineer|Scientist|Lead|Head|Recruiter|Talent|Program\s*Manager|Product\s*Manager|Solution|IT\s+.+|Power\s*BI\s+Architect|Developer)/i;
                    if (nm && roleRx.test(nx)) {
                        const link = (lines[i+2] && /https?:\/\//.test(lines[i+2])) ? lines[i+2] : '';
                        push(nm[1], nx.replace(/^[\-:•\s]+/, ''), link);
                    }
                }
            }

            return results.slice(0, 10);
        }

        // --- Candidate name detection and panelist sanitization ---
        function detectCandidateNameFromUploads() {
            // Derive candidate name from resume filenames and content
            const entries = Object.entries(appState.fileContents || {});
            const nameCandidates = [];

            // From filenames
            for (const [fname] of entries) {
                if (!/resume|cv/i.test(fname)) continue;
                const base = String(fname || '').split(/[\\\/]/).pop().replace(/\.[^.]+$/, '');
                const cleaned = base.replace(/resume|cv/ig, ' ').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
                const m = cleaned.match(/([A-Z][a-z'’.\-]+(?:\s+[A-Z][a-z'’.\-]+){1,3})/);
                if (m) nameCandidates.push(m[1].trim());
            }

            // From resume text (first lines)
            const resumeText = entries.filter(([n]) => /resume|cv/i.test(n)).map(([,c]) => c || '').join('\n');
            if (resumeText) {
                const lines = resumeText.split(/\r?\n/).map(s => s.trim()).filter(Boolean).slice(0, 40);
                for (const ln of lines) {
                    if (/summary|experience|education|skills|linkedin|github|email|phone|address|profile|portfolio/i.test(ln)) continue;
                    const s = ln.replace(/^\s*[•–\-*·]+\s*/, '');
                    const m = s.match(/^([A-Z][A-Za-z'’.\-]+(?:\s+[A-Z][A-Za-z'’.\-]+){1,3})$/);
                    if (m && m[1].length <= 60) { nameCandidates.push(m[1].trim()); break; }
                }
            }

            if (nameCandidates.length) {
                // Choose the candidate with the most tokens
                nameCandidates.sort((a, b) => b.split(/\s+/).length - a.split(/\s+/).length);
                appState.extractedData.candidateName = nameCandidates[0];
            }
        }

        function normalizeNameForCompare(name) {
            return String(name || '').toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
        }

        function removeCandidateFromList(panelists) {
            const cand = normalizeNameForCompare(appState?.extractedData?.candidateName || '');
            if (!cand) return panelists || [];
            const filtered = (panelists || []).filter(p => {
                const n = normalizeNameForCompare(p?.name || '');
                if (!n) return false;
                // exact or contains full candidate name
                if (n === cand) return false;
                if (n.includes(cand)) return false;
                return true;
            });
            return filtered;
        }

        function ensureCandidateNotListedAsPanelist() {
            if (!Array.isArray(appState.extractedData.panelists)) return;
            appState.extractedData.panelists = removeCandidateFromList(appState.extractedData.panelists);
        }

        function pickFromFilenameCompany(files) {
            try {
                const { company } = inferCompanyAndRoleFromFilenames(files || []);
                return company || '';
            } catch (e) { return ''; }
        }

        function cleanCompanyDisplayName(name) {
            if (!name) return '';
            let s = String(name).trim();
            // Strip obvious URL or extension noise
            s = s.replace(/https?:\/\/\S+/gi, '')
                 .replace(/\.html?\b.*$/i, '')
                 .replace(/\.pdf\b.*$/i, '')
                 .replace(/\.docx?\b.*$/i, '')
                 .replace(/\s*\|.*$/, '');
            // Normalize separators
            s = s.replace(/\s*[-_/|]+\s*/g, ' ').replace(/\s+/g, ' ').trim();
            // Cut at the first parenthesis (e.g., "(ICT)") and anything after
            s = s.replace(/\s*\(.*/, '').trim();
            // Remove common stopwords if they make up the whole result
            const stop = /^(of|the|and|for|with|in|at|on|to|a|an)$/i;
            if (stop.test(s)) s = '';
            // If still very long, try to pick a likely company-like segment from common delimiters
            if (s.length > 60 || s.length < 3) {
                const raw = String(name);
                const parts = raw.split(/\s*[|–—-]+\s*/).map(p=>p.trim()).filter(Boolean);
                const bad = /\b(of|the|and|for|with|in|at|on|to|a|an)\b|announc|public|launch|interview|resume|questions|playbook|brief|analysis|mapping|stories|battle|plan|bank|final|round|panel|date|metrics|csv|pdf|docx|html|md/i;
                const candidates = parts.filter(p => !bad.test(p) && /[A-Za-z]/.test(p) && p.length <= 45);
                if (candidates.length) s = candidates[0];
            }
            // Cut before verbs like "is/are/provides" that indicate sentence continuation
            s = s.split(/\s+(?:is|are|provides|provide|was|were)\b/i)[0].trim();
            // De-duplicate repeated starting phrase (e.g., "Acme Corp Acme Corp ...")
            const tokens = s.split(/\s+/);
            for (let k = 2; k <= 4 && 2*k <= tokens.length; k++) {
                const a = tokens.slice(0,k).join(' ').toLowerCase();
                const b = tokens.slice(k,2*k).join(' ').toLowerCase();
                if (a && a === b) { s = tokens.slice(0,k).concat(tokens.slice(2*k)).join(' '); break; }
            }
            // If the result is very long, clamp to first 6 words (most company names fit)
            if (s.split(/\s+/).length > 6) {
                s = s.split(/\s+/).slice(0,6).join(' ');
            }
            // Title-case words but preserve acronyms
            s = s.split(' ').map(w => (/^[A-Z0-9]{2,}$/.test(w) ? w : (w.charAt(0).toUpperCase()+w.slice(1).toLowerCase()))).join(' ');
            if (s.length < 3) {
                // Fallback to text-derived label if available
                try {
                    const fromText = inferCompanyAndRoleFromText(getCombinedContent()).company;
                    if (fromText && fromText.length > 2) {
                        return fromText.trim();
                    }
                } catch (e) { /* ignore */ }
            }
            return s.trim();
        }

        function updateDashboard() {
            const data = appState.extractedData;
            
            // Update header
            const titleElement = document.getElementById('dashboardTitle');
            const files = Object.keys(appState.fileContents || {});
            const preferredCompany = cleanCompanyDisplayName(data.company || pickFromFilenameCompany(files));
            titleElement.textContent = preferredCompany || 'Master Interview Prep Dashboard';
            
            // Update all sections
            updateCommandCenter();
            updateCompanyIntel();
            updatePanelStrategy();
            updateQuestionBank();
            updateStarStories();
            updateDebriefDropdown();
            
            // Update data status
            const statusMessage = `
                ✅ Data loaded successfully!<br>
                • Company: ${data.company}<br>
                • Role: ${data.role}<br>
                • Panelists: ${data.panelists.length}<br>
                • Questions: ${data.questions.length}<br>
                • Stories: ${data.stories.length}
            `;
            document.getElementById('dataStatus').innerHTML = statusMessage;
            updateRequiresDataVisibility();
            // Build dynamic sections
            try { updateInterviewContext(); } catch (e) {}
            try { updateSQLContextCard(); } catch (e) {}
            try { updateSchemaCard(); } catch (e) {}
            try { updateScenariosCard(); } catch (e) {}
            try { updateTechBadges(); } catch (e) {}
            try { updateQuickTipsFromData(); } catch (e) {}
        }

        // No default metrics helper; data comes from uploaded files only.

        function updateCommandCenter() {
            const data = appState.extractedData;
            
            // Update metrics with uploaded data only
            const metricsContainer = document.getElementById('keyMetrics');
            if (metricsContainer) {
                const isValidValue = (v) => {
                    if (!v) return false;
                    const s = String(v).trim();
                    if (s.length > 20) return false;
                    return /^(\$?\d[\d,.]*)([MBK]\+?)?$/.test(s) || /^(\d+%|\d+\+?)$/.test(s);
                };
                // Start with validated numeric/currency/percent metrics
                let metricsToShow = (Array.isArray(data.metrics) ? data.metrics : []).filter(m => m && m.label && isValidValue(m.value));
                // Merge in tiles derived from strengths (resume/context) to enrich the view
                const strengthTiles = buildTilesFromStrengths(data.strengths || []);
                const combined = [];
                const seen = new Set();
                const pushIfNew = (t) => {
                    if (!t || !t.label || !t.value) return;
                    const key = (String(t.label)+'|'+String(t.value)).toLowerCase();
                    if (seen.has(key)) return;
                    combined.push(t); seen.add(key);
                };
                metricsToShow.forEach(pushIfNew);
                strengthTiles.forEach(t => { if (combined.length < 8) pushIfNew(t); });
                metricsToShow = combined;
                if (!metricsToShow.length) {
                    metricsContainer.innerHTML = '<p style="color:#64748b;">No metrics available. Upload files to populate metrics.</p>';
                } else {
                    const colors = ['#4f46e5', '#22c55e', '#f59e0b', '#8b5cf6', '#0ea5e9', '#ec4899', '#14b8a6'];
                    metricsContainer.innerHTML = metricsToShow.map((metric, index) => {
                        const bgColor = `linear-gradient(135deg, ${colors[index % colors.length]} 0%, ${colors[(index + 1) % colors.length]} 100%)`;
                        const label = String(metric.label || '').trim().slice(0, 60);
                        const value = String(metric.value || '').trim();
                        const growth = metric.growth ? String(metric.growth).trim().slice(0, 40) : '';
                        const context = metric.context ? String(metric.context).trim().slice(0, 60) : '';
                        return `
                            <div class="metric-tile" style="background: ${bgColor}; padding: 1.5rem; border-radius: 0.75rem; color: white; transition: all 0.3s ease; cursor: pointer; min-height: 140px; display: flex; flex-direction: column; justify-content: center; position: relative; overflow: hidden;">
                                <div style="font-size: 2rem; font-weight: 700; margin-bottom: 0.5rem; z-index: 2;">${value}</div>
                                ${growth ? `<div style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem; z-index: 2;">${growth}</div>` : ''}
                                <div style="font-size: 0.875rem; font-weight: 600; margin-bottom: 0.25rem; z-index: 2;">${label}</div>
                                ${context ? `<div style="font-size: 0.75rem; opacity: 0.8; z-index: 2;">${context}</div>` : ''}
                            </div>
                        `;
                    }).join('');
                }
            }
            
            // Update strengths
            const strengthsList = document.getElementById('strengthsList');
            if (strengthsList && data.strengths.length > 0) {
                strengthsList.innerHTML = data.strengths.map(strength => 
                    `<div class="strength-item">✓ ${strength}</div>`
                ).join('');
            }
            
            // Update gaps
            const gapsList = document.getElementById('gapsList');
            if (gapsList) {
                const gapDetails = Array.isArray(data.gapDetails) ? data.gapDetails : [];
                if (gapDetails.length > 0) {
                    gapsList.innerHTML = gapDetails.map(detail => {
                        const reason = detail.reason ? `<div style="font-size:0.8rem; color:#64748b; margin-top:0.25rem;">${detail.reason}</div>` : '';
                        return `<div class="gap-item" style="margin-bottom:0.5rem;">
                            <strong>→ ${detail.title}</strong>
                            ${reason}
                        </div>`;
                    }).join('');
                } else {
                    gapsList.innerHTML = '<p style="color:#64748b;">No potential gaps detected yet.</p>';
                }
            }
        }

        // Build Command Center tiles from strengths when metrics CSV not provided
        function buildTilesFromStrengths(strengths) {
            const tiles = [];
            const add = (label, value, growth = '', context = '') => {
                if (!value || !label) return;
                tiles.push({ label, value, growth, context });
            };
            const uniq = new Set();
            (strengths || []).forEach(s => {
                if (!s || typeof s !== 'string') return;
                const t = s.trim();
                // 80% automation / effort reduction / efficiency
                let m = t.match(/(\d{1,3})%\s*(?:manual|effort|reduction|automation|efficiency)/i);
                if (m && !uniq.has('automation')) { add('Automation', `${m[1]}%`, 'Efficiency Gain'); uniq.add('automation'); }
                // 95% query optimization / performance
                m = t.match(/(\d{1,3})%\s*(?:query|performance|optimization|speed)/i);
                if (m && !uniq.has('query')) { add('Query Speed', `${m[1]}%`, 'Faster'); uniq.add('query'); }
                // 30% adoption increase
                m = t.match(/(\d{1,3})%\s*(?:dashboard\s*)?adoption/i);
                if (m && !uniq.has('adoption')) { add('Dashboard Adoption', `${m[1]}%`, 'Increase'); uniq.add('adoption'); }
                // $M impact
                m = t.match(/\$(\d+(?:\.\d+)?)\s*M/i);
                if (m && !uniq.has('impact')) { add('Business Impact', `$${m[1]}M`, 'Outcome'); uniq.add('impact'); }
                // 100M+ daily records
                m = t.match(/(\d+M\+)\s*(?:daily\s*)?(?:records|transactions|rows)/i);
                if (m && !uniq.has('daily')) { add('Daily Processing', m[1], 'Records'); uniq.add('daily'); }
                // 500M+ records scale
                m = t.match(/(\d+M\+|\d+\.\d+M\+)\s*(?:SKU|records)/i);
                if (m && !uniq.has('scale')) { add('Your Scale', m[1], 'Records'); uniq.add('scale'); }
                // Stakeholders / sessions counts
                m = t.match(/(\d{2,4}\+)\s*(stakeholders|users|people)/i);
                if (m && !uniq.has('stakeholders')) { add('Stakeholders', m[1], 'Trained/Served'); uniq.add('stakeholders'); }
                m = t.match(/(\d{2,4}\+)\s*(?:training|sessions?)/i);
                if (m && !uniq.has('sessions')) { add('Sessions', m[1], 'Delivered'); uniq.add('sessions'); }
                // Tech keyword tiles for aesthetics/coverage
                if (/\bpython\b/i.test(t) && !uniq.has('python')) { add('Language', 'Python'); uniq.add('python'); }
                if (/bigquery|snowflake/i.test(t) && !uniq.has('cloud_dw')) { add('Cloud DW', 'BigQuery/Snowflake'); uniq.add('cloud_dw'); }
                if (/tableau|looker|power\s*bi/i.test(t) && !uniq.has('bi')) { add('BI Tools', 'Tableau/Looker/Power BI'); uniq.add('bi'); }
                if (/(A\/B|experiment|causal)/i.test(t) && !uniq.has('ab')) { add('Experimentation', 'A/B Testing'); uniq.add('ab'); }
                if (/etl|elt|pipeline/i.test(t) && !uniq.has('etl')) { add('Pipelines', 'ETL/ELT'); uniq.add('etl'); }
                if (/cross[-\s]?functional|stakeholder/i.test(t) && !uniq.has('xf')) { add('Collaboration', 'Cross-functional'); uniq.add('xf'); }
                if (/executive|c-?suite/i.test(t) && !uniq.has('exec')) { add('Communication', 'Executive'); uniq.add('exec'); }
                if (/lean\s*six\s*sigma/i.test(t) && !uniq.has('lss')) { add('Process', 'Lean Six Sigma'); uniq.add('lss'); }
            });
            // Keep up to 8 tiles for variety
            return tiles.slice(0, 8);
        }

        function updateCompanyIntel() {
            const data = appState.extractedData;

            // Update Company Metrics Tiles only when data present
            const metricsContainer = document.getElementById('companyMetrics');
            if (metricsContainer) {
                if (!data.companyIntel) {
                    metricsContainer.innerHTML = '<p style="color:#64748b;">No company intelligence yet. Upload files to populate.</p>';
                } else {
                    metricsContainer.innerHTML = '';
                }
            }

            const briefingDiv = document.getElementById('companyBriefing');
            if (briefingDiv) {
                let intel;
                try {
                    intel = typeof data.companyIntel === 'string' ? JSON.parse(data.companyIntel) : data.companyIntel;
                } catch (e) {
                    intel = null;
                }
                
                if (intel && intel.executiveBrief) {
                    let briefingHTML = `
                        <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 1.5rem; border-radius: 0.75rem; margin-bottom: 1.5rem;">
                            <h3 style="color: white; margin-bottom: 1rem; font-size: 1.25rem;">🎯 Executive Brief</h3>
                            <div style="display: grid; gap: 0.75rem;">
                                <div><strong>Q4 Performance:</strong> ${intel.executiveBrief.q4Performance}</div>
                                <div><strong>Play Points Scale:</strong> ${intel.executiveBrief.playPointsScale}</div>
                                <div><strong>Market Position:</strong> ${intel.executiveBrief.marketPosition}</div>
                                <div><strong>Financial Strength:</strong> ${intel.executiveBrief.financialStrength}</div>
                                <div><strong>AI Investment:</strong> ${intel.executiveBrief.aiInvestment}</div>
                            </div>
                        </div>
                    `;

                    // Business Performance Section
                    briefingHTML += '<div style="margin-bottom: 2rem;">';
                    briefingHTML += '<h4 style="color: #4f46e5; margin-bottom: 1rem; font-size: 1.1rem; font-weight: 600;">📊 Business Performance</h4>';
                    
                    // Revenue breakdown
                    briefingHTML += '<div style="background: #f8fafc; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem;">';
                    briefingHTML += '<h5 style="margin-bottom: 0.75rem; font-weight: 600;">Revenue Breakdown (Q4 2024)</h5>';
                    briefingHTML += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 0.5rem;">';
                    for (const [key, value] of Object.entries(intel.businessPerformance.revenue)) {
                        briefingHTML += `<div style="padding: 0.5rem; background: white; border-radius: 0.25rem; border-left: 3px solid #4f46e5;"><strong>${key}:</strong> ${value}</div>`;
                    }
                    briefingHTML += '</div></div>';

                    // Key metrics
                    briefingHTML += '<div style="background: #f0fdf4; padding: 1rem; border-radius: 0.5rem;">';
                    briefingHTML += '<h5 style="margin-bottom: 0.75rem; font-weight: 600;">Key Metrics</h5>';
                    briefingHTML += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.5rem;">';
                    for (const [key, value] of Object.entries(intel.businessPerformance.keyMetrics)) {
                        briefingHTML += `<div style="padding: 0.5rem; background: white; border-radius: 0.25rem; border-left: 3px solid #22c55e;"><strong>${key}:</strong> ${value}</div>`;
                    }
                    briefingHTML += '</div></div>';
                    briefingHTML += '</div>';

                    // Strategic Initiatives Section
                    briefingHTML += '<div style="margin-bottom: 2rem;">';
                    briefingHTML += '<h4 style="color: #4f46e5; margin-bottom: 1rem; font-size: 1.1rem; font-weight: 600;">🚀 Strategic Initiatives</h4>';
                    
                    const initiatives = [
                        { title: 'AI/ML Integration', items: intel.strategicInitiatives.aiMlIntegration, color: '#8b5cf6' },
                        { title: 'Play Store Platform', items: intel.strategicInitiatives.playStorePlatform, color: '#0ea5e9' },
                        { title: 'Data Modernization', items: intel.strategicInitiatives.dataModernization, color: '#22c55e' }
                    ];

                    initiatives.forEach(({ title, items, color }) => {
                        briefingHTML += `<div style="background: #f8fafc; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem; border-left: 4px solid ${color};">`;
                        briefingHTML += `<h6 style="margin-bottom: 0.75rem; font-weight: 600; color: ${color};">${title}</h6>`;
                        briefingHTML += '<ul style="margin: 0; padding-left: 1rem;">';
                        items.forEach(item => briefingHTML += `<li style="margin-bottom: 0.25rem;">${item}</li>`);
                        briefingHTML += '</ul></div>';
                    });
                    briefingHTML += '</div>';

                    // Challenges & Opportunities
                    briefingHTML += '<div style="margin-bottom: 2rem;">';
                    briefingHTML += '<h4 style="color: #4f46e5; margin-bottom: 1rem; font-size: 1.1rem; font-weight: 600;">⚖️ Challenges & Opportunities</h4>';
                    
                    const challenges = [
                        { title: 'Regulatory Challenges', items: intel.challengesOpportunities.regulatory, color: '#f59e0b' },
                        { title: 'Competitive Landscape', items: intel.challengesOpportunities.competitive, color: '#ef4444' },
                        { title: 'Growth Opportunities', items: intel.challengesOpportunities.opportunities, color: '#22c55e' }
                    ];

                    challenges.forEach(({ title, items, color }) => {
                        briefingHTML += `<div style="background: #f8fafc; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem; border-left: 4px solid ${color};">`;
                        briefingHTML += `<h6 style="margin-bottom: 0.75rem; font-weight: 600; color: ${color};">${title}</h6>`;
                        briefingHTML += '<ul style="margin: 0; padding-left: 1rem;">';
                        items.forEach(item => briefingHTML += `<li style="margin-bottom: 0.25rem;">${item}</li>`);
                        briefingHTML += '</ul></div>';
                    });
                    briefingHTML += '</div>';

                    // Technology Ecosystem
                    briefingHTML += '<div style="margin-bottom: 2rem;">';
                    briefingHTML += '<h4 style="color: #4f46e5; margin-bottom: 1rem; font-size: 1.1rem; font-weight: 600;">⚙️ Technology Ecosystem</h4>';
                    
                    briefingHTML += '<div style="background: #f8fafc; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem;">';
                    briefingHTML += '<h6 style="margin-bottom: 0.75rem; font-weight: 600;">Core Technology Stack</h6>';
                    briefingHTML += '<div style="display: grid; gap: 0.5rem;">';
                    for (const [key, value] of Object.entries(intel.technologyEcosystem.coreStack)) {
                        briefingHTML += `<div style="padding: 0.5rem; background: white; border-radius: 0.25rem; border-left: 3px solid #8b5cf6;"><strong>${key}:</strong> ${value}</div>`;
                    }
                    briefingHTML += '</div></div>';

                    briefingHTML += '<div style="background: #f0fdf4; padding: 1rem; border-radius: 0.5rem;">';
                    briefingHTML += '<h6 style="margin-bottom: 0.75rem; font-weight: 600;">Recent Advancements</h6>';
                    briefingHTML += '<ul style="margin: 0; padding-left: 1rem;">';
                    intel.technologyEcosystem.recentAdvancements.forEach(advancement => {
                        briefingHTML += `<li style="margin-bottom: 0.25rem;">${advancement}</li>`;
                    });
                    briefingHTML += '</ul></div></div>';

                    // Role-Specific Intelligence
                    briefingHTML += '<div>';
                    briefingHTML += '<h4 style="color: #4f46e5; margin-bottom: 1rem; font-size: 1.1rem; font-weight: 600;">👤 Role-Specific Intelligence</h4>';
                    
                    briefingHTML += `<div style="background: linear-gradient(135deg, #f0f9ff, #e0f2fe); padding: 1rem; border-radius: 0.5rem; border-left: 4px solid #0ea5e9; margin-bottom: 1rem;">`;
                    briefingHTML += `<div style="margin-bottom: 0.5rem;"><strong>Department:</strong> ${intel.roleSpecificIntel.department}</div>`;
                    briefingHTML += `<div style="margin-bottom: 0.5rem;"><strong>Focus:</strong> ${intel.roleSpecificIntel.focus}</div>`;
                    briefingHTML += `<div><strong>Team Structure:</strong> ${intel.roleSpecificIntel.teamStructure}</div>`;
                    briefingHTML += '</div>';

                    briefingHTML += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">';
                    
                    briefingHTML += '<div style="background: #f8fafc; padding: 1rem; border-radius: 0.5rem;">';
                    briefingHTML += '<h6 style="margin-bottom: 0.75rem; font-weight: 600;">Key Projects</h6>';
                    briefingHTML += '<ul style="margin: 0; padding-left: 1rem; font-size: 0.875rem;">';
                    intel.roleSpecificIntel.projects.forEach(project => {
                        briefingHTML += `<li style="margin-bottom: 0.25rem;">${project}</li>`;
                    });
                    briefingHTML += '</ul></div>';

                    briefingHTML += '<div style="background: #f8fafc; padding: 1rem; border-radius: 0.5rem;">';
                    briefingHTML += '<h6 style="margin-bottom: 0.75rem; font-weight: 600;">Key Stakeholders</h6>';
                    briefingHTML += '<ul style="margin: 0; padding-left: 1rem; font-size: 0.875rem;">';
                    intel.roleSpecificIntel.keyStakeholders.forEach(stakeholder => {
                        briefingHTML += `<li style="margin-bottom: 0.25rem;">${stakeholder}</li>`;
                    });
                    briefingHTML += '</ul></div>';
                    
                    briefingHTML += '</div></div>';
                    
                    briefingDiv.innerHTML = briefingHTML;
                } else if (data.companyIntel) {
                    // Safely render markdown with sanitization when available
                    if (window.DOMPurify && window.marked) {
                        briefingDiv.innerHTML = DOMPurify.sanitize(marked.parse(data.companyIntel));
                    } else if (window.marked) {
                        briefingDiv.innerHTML = marked.parse(data.companyIntel);
                    } else {
                        // Fallback: plain text
                        briefingDiv.textContent = data.companyIntel;
                    }
                }
            }

            const culturalDiv = document.getElementById('culturalFit');
            if (culturalDiv) {
                let intel;
                try {
                    intel = typeof data.companyIntel === 'string' ? JSON.parse(data.companyIntel) : data.companyIntel;
                } catch (e) {
                    intel = null;
                }
                
                if (intel && intel.cultureWorkplace) {
                    let culturalHTML = '<div>';
                    
                    // Employee Satisfaction
                    culturalHTML += '<h5 style="color: #22c55e; margin-bottom: 1rem; font-weight: 600;">📈 Employee Satisfaction</h5>';
                    culturalHTML += '<div style="background: #f0fdf4; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1.5rem;">';
                    for (const [key, value] of Object.entries(intel.cultureWorkplace.satisfaction)) {
                        culturalHTML += `<div style="margin-bottom: 0.5rem;"><strong>${key}:</strong> ${value}</div>`;
                    }
                    culturalHTML += '</div>';

                    // Work Environment
                    culturalHTML += '<h5 style="color: #3b82f6; margin-bottom: 1rem; font-weight: 600;">🏢 Work Environment</h5>';
                    culturalHTML += '<div style="background: #eff6ff; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1.5rem;">';
                    culturalHTML += '<ul style="margin: 0; padding-left: 1rem;">';
                    intel.cultureWorkplace.workEnvironment.forEach(item => {
                        culturalHTML += `<li style="margin-bottom: 0.5rem;">${item}</li>`;
                    });
                    culturalHTML += '</ul></div>';

                    // Benefits
                    culturalHTML += '<h5 style="color: #8b5cf6; margin-bottom: 1rem; font-weight: 600;">💼 Benefits & Compensation</h5>';
                    culturalHTML += '<div style="background: #f3e8ff; padding: 1rem; border-radius: 0.5rem;">';
                    culturalHTML += '<ul style="margin: 0; padding-left: 1rem;">';
                    intel.cultureWorkplace.benefits.forEach(benefit => {
                        culturalHTML += `<li style="margin-bottom: 0.5rem;">${benefit}</li>`;
                    });
                    culturalHTML += '</ul></div>';
                    
                    culturalHTML += '</div>';
                    culturalDiv.innerHTML = culturalHTML;
                } else {
                    // Fallback content
                    let culturalHTML = '<p><strong>Signals to Convey:</strong></p><ul>';
                    ['Data-first rigor and clarity', 'Collaboration and user-centricity', 'Technical depth with concise storytelling'].forEach(signal => {
                        culturalHTML += `<li>${signal}</li>`;
                    });
                    culturalHTML += '</ul>';
                    culturalDiv.innerHTML = culturalHTML;
                }
            }

            // Update source tag when available
            const sourceType = document.getElementById('sourceType');
            if (sourceType) {
                sourceType.textContent = data.companyIntelSource || 'Strategic Intelligence Analysis';
            }
        }

        function updatePanelStrategy() {
            const container = document.getElementById('panelistsContainer');
            if (!container) return;
            const list = (appState.extractedData.panelists || []).filter(p => p && p.name);
            if (list.length === 0) { container.innerHTML = ''; if (window.__DEBUG__) try{renderPanelistDebug();}catch(e){} return; }
            
            const archetypeColors = {
                'Champion': 'panel-champion',
                'Ally': 'panel-ally',
                'Skeptic': 'panel-skeptic',
                'Gatekeeper': 'panel-gatekeeper',
                'Technical Expert': 'panel-technical',
                'Technical Validator': 'panel-technical',
                'Process Champion': 'panel-champion'
            };
            
            const archetypeBadgeColors = {
                'Champion': 'background: #22c55e; color: white;',
                'Ally': 'background: #3b82f6; color: white;',
                'Skeptic': 'background: #f59e0b; color: white;',
                'Gatekeeper': 'background: #64748b; color: white;',
                'Technical Expert': 'background: #8b5cf6; color: white;',
                'Technical Validator': 'background: #8b5cf6; color: white;',
                'Process Champion': 'background: #22c55e; color: white;'
            };
            
            const defaults = {
                motivation: {
                    'Champion': 'Business impact and alignment',
                    'Ally': 'Candidate experience and culture add',
                    'Skeptic': 'Risk, trade-offs, and rigor',
                    'Gatekeeper': 'Process, compliance, and fit',
                    'Technical Expert': 'Technical depth and correctness'
                },
                anxiety: {
                    'Champion': 'Execution risk and stakeholder buy-in',
                    'Ally': 'Long-term retention and team fit',
                    'Skeptic': 'Over-claims or shallow analysis',
                    'Gatekeeper': 'Policy adherence and signal quality',
                    'Technical Expert': 'Statistical rigor and scalability'
                }
            };

            container.innerHTML = list.map(p => `
                <div class="panel-card ${archetypeColors[p.archetype] || 'panel-ally'}">
                    <div class="archetype-badge" style="${archetypeBadgeColors[p.archetype] || ''}">${p.archetype}</div>
                    <h3 style="font-weight: 600; font-size: 1.125rem; margin-bottom: 0.25rem;">${p.name}</h3>
                    <p style="color: #64748b; font-size: 0.875rem; margin-bottom: 0.5rem;">${p.role || ''}</p>
                    ${(() => {
                        const link = (p.linkedin || p.website || p.link || p.url || '').trim();
                        if (!link) return '';
                        const safe = link.replace(/"/g, '&quot;');
                        const label = safe.replace(/^https?:\/\//, '');
                        return `<div style="margin-bottom: 0.75rem;"><a href="${safe}" target="_blank" rel="noopener noreferrer" style="color:#2563eb; font-size:0.85rem; text-decoration:underline;">${label}</a></div>`;
                    })()}
                    <div style="font-size: 0.875rem; margin-bottom: 0.5rem;">
                        <strong>Motivation:</strong> ${p.motivation || defaults.motivation[p.archetype] || ''}
                    </div>
                    <div style="font-size: 0.875rem; margin-bottom: 1rem;">
                        <strong>Anxiety:</strong> ${p.anxiety || defaults.anxiety[p.archetype] || ''}
                    </div>
                    ${p.talkingPoints ? `<div style="background:#f8fafc; border-radius:0.5rem; padding:0.75rem; margin-bottom:0.75rem;">
                        <strong>Key Talking Points:</strong>
                        <ul style="margin-top:0.5rem; list-style:disc; padding-left:1rem; font-size:0.85rem;">
                            ${p.talkingPoints.map(tp => `<li>${tp}</li>`).join('')}
                        </ul>
                    </div>` : ''}
                    <button class="btn btn-primary btn-bottom" style="width: 100%;" data-action="gen-panelist-question" data-name="${p.name.replace(/'/g, "&apos;")}">
                        <span>✨</span> Generate a question
                        <span class="ai-badge">AI</span>
                    </button>
                    <div id="question-${p.name.replace(/\s/g, '-')}" style="margin-top: 1rem;"></div>
                </div>
            `).join('');
            if (window.__DEBUG__) try{renderPanelistDebug();}catch(e){}
        }

        function updateQuestionBank() {
            // Do not inject defaults; only render what was extracted from files
            updateQuestionList();
        }

        function toHtml(text) {
            if (!text) return '';
            // If seems like HTML already, return as-is
            if (/<\w+[^>]*>/.test(text)) return text;
            return convertMarkdownToHtml(text);
        }

        function isGenericAnswer(ans) {
            if (!ans) return true;
            const s = ans.trim().toLowerCase();
            return s.length < 20 ||
                   s.includes('review prep notes') ||
                   s === 'n/a' || s === 'tbd' || s === 'todo';
        }

        function pickStoryForCategory(category) {
            const stories = appState?.extractedData?.stories || [];
            if (stories.length === 0) return null;
            const cat = (category || '').toLowerCase();
            // Prefer story with metrics/result
            let byMetric = stories.find(s => s.result && /\$|%|\d/.test(s.result));
            if (cat.includes('tech')) {
                return byMetric || stories[0];
            }
            if (cat.includes('behavior')) {
                return stories[0];
            }
            return byMetric || stories[0];
        }

        function synthesizeAnswer(q) {
            const cat = (q.category || 'general').toLowerCase();
            const strengths = appState?.extractedData?.strengths || [];
            const metrics = appState?.extractedData?.metrics || [];
            const company = appState?.extractedData?.company || 'the company';
            const story = pickStoryForCategory(cat);
            const metricTile = (metrics[0] && metrics[0].value) ? `${metrics[0].value} ${metrics[0].label}` : 'key business metrics';

            if (cat.includes('tech')) {
                return `
                    <div>
                        <strong>30s Summary:</strong> I will frame data sources, then implement a scalable BigQuery solution using CTEs and window functions, and validate cost/performance with partitioning and clustering.<br>
                        <strong>Approach:</strong>
                        <ol style="margin:0.5rem 0 0 1.25rem;">
                            <li>Clarify schema and desired KPI(s) for ${company} (${metricTile}).</li>
                            <li>Model with 1–2 CTEs for readability; apply window functions for cohorts/tiers.</li>
                            <li>Use <code>PARTITION BY date</code> and <code>CLUSTER BY member_id, tier_level</code> to control cost/latency.</li>
                            <li>Validate with sample queries and compare before/after timings; add comments and tests.</li>
                        </ol>
                        <strong>Proof:</strong> ${toHtml(strengths[0] || 'Reduced query time by 95% (10min→30s) and automated 80% of manual work on large datasets.')}<br>
                        ${story ? `<strong>Example:</strong> ${toHtml(story.result || '')}` : ''}
                    </div>`;
            }
            if (cat.includes('behavior')) {
                return story ? `
                    <div>
                        <strong>S/T:</strong> ${toHtml(story.situation || '')} ${toHtml(story.task || '')}<br>
                        <strong>A:</strong> ${toHtml(story.action || '')}<br>
                        <strong>R:</strong> ${toHtml(story.result || '')}
                    </div>` : `
                    <div>
                        <strong>Situation:</strong> Complex, ambiguous problem with scale considerations.<br>
                        <strong>Task:</strong> Own analysis and drive a measurable outcome.<br>
                        <strong>Action:</strong> Partner with stakeholders, prototype in BigQuery, validate findings, and iterate quickly.<br>
                        <strong>Result:</strong> Quantified business impact; learning documented and shared.
                    </div>`;
            }
            // Situational or general
            return `
                <div>
                    <strong>Framework:</strong> Clarify goal, constraints, success metrics; evaluate levers; run a small experiment; scale with guardrails.<br>
                    <strong>Plan:</strong>
                    <ul style="margin:0.5rem 0 0 1.25rem;">
                        <li>Define leading indicators and guardrails (cost, latency, churn).</li>
                        <li>Segment users, prioritize high-lift cohorts (e.g., Gold→Platinum).</li>
                        <li>Prototype analysis in BigQuery; instrument dashboards for monitoring.</li>
                        <li>Roll out iteratively; measure impact and adjust.</li>
                    </ul>
                </div>`;
        }

        // -------- Test Loader (input_files_test) --------
        async function loadTestFilesFromFolder() {
            try {
                showToast('Loading test files...', 'info');
                const res = await fetch('input_files_test/manifest.json', { cache: 'no-cache' });
                if (!res.ok) {
                    showToast('Test manifest not found', 'error');
                    return;
                }
                const manifest = await res.json();
                if (!Array.isArray(manifest) || manifest.length === 0) {
                    showToast('No files listed in test manifest', 'warning');
                    return;
                }
                const files = [];
                for (const relPath of manifest) {
                    try {
                        const url = encodeURI(relPath);
                        const ext = url.split('.').pop().toLowerCase();
                        const typeMap = {
                            pdf: 'application/pdf',
                            docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                            csv: 'text/csv',
                            md: 'text/markdown',
                            txt: 'text/plain',
                            json: 'application/json'
                        };
                        const r = await fetch(url);
                        if (!r.ok) continue;
                        const blob = await r.blob();
                        const file = new File([blob], url.split('/').pop(), { type: typeMap[ext] || blob.type || 'application/octet-stream' });
                        files.push(file);
                    } catch (e) { /* skip file */ }
                }
                if (!files.length) {
                    showToast('No test files could be loaded', 'warning');
                    return;
                }
                // Display and set as selected
                handleFiles(files);
                // Auto-process
                setTimeout(() => processFiles(), 50);
            } catch (e) {
                console.error('Failed to load test files', e);
                showToast('Failed to load test files', 'error');
            }
        }

        function questionMeta(q) {
            const category = (q.category || 'general').toLowerCase();
            const isTech = category.includes('tech');
            const isBehavioral = category.includes('behavior');
            const isSituational = category.includes('situat');
            const outline = isTech
                ? [
                    'Problem: define dataset, volume, and business objective',
                    'Approach: CTEs, window functions, partition/cluster strategy',
                    'Optimization: cost/perf trade-offs and validation',
                    'Impact: before/after metrics and stakeholder value'
                  ]
                : isBehavioral
                ? [
                    'Situation: brief context + constraint',
                    'Task: clear objective and your role',
                    'Action: 3–4 actions highlighting skills + collaboration',
                    'Result: quantified impact + learning'
                  ]
                : [
                    'Clarify assumptions and constraints',
                    'Prioritize levers and define success metrics',
                    'Stepwise plan with risks and mitigations',
                    'Measurement/next steps'
                  ];
            const tests = isTech
                ? ['SQL fluency (CTEs, windows)', 'BigQuery scale thinking', 'Optimization and cost-awareness']
                : isBehavioral
                ? ['Ownership and bias-for-action', 'Stakeholder management', 'Quantified outcomes']
                : ['Product sense', 'Framing/communication', 'Data-driven decision making'];
            const pitfalls = isTech
                ? ['Vague schemas or ignoring partitioning', 'No validation/edge cases']
                : isBehavioral
                ? ['Story without numbers', 'Ambiguous role/ownership']
                : ['Jumping to solution without clarifying goal', 'No trade-off discussion'];
            const success = isTech
                ? ['Correctness, performance, cost, and readability addressed']
                : isBehavioral
                ? ['Clear role, concrete actions, and measurable impact']
                : ['Clear framework, metrics, and pragmatic plan'];
            const metrics = [
                'Scale (rows/users/transactions)',
                'Performance (latency/cost)',
                'Impact (revenue/retention/activation)'
            ];
            const time = q.interviewRound?.includes('phone') ? '60–90s' : (isTech ? '2–3 min walkthrough' : '60–120s');
            return { outline, tests, pitfalls, success, metrics, time };
        }

        function copyQuestionOutline(index) {
            try {
                const el = document.getElementById(`qa-outline-${index}`);
                if (!el) { showToast('Outline not found', 'error'); return; }
                const text = el.innerText || el.textContent || '';
                if (navigator.clipboard?.writeText) {
                    navigator.clipboard.writeText(text).then(() => showToast('Outline copied!', 'success')).catch(() => showToast('Copied outline to clipboard', 'success'));
                } else {
                    const sel = window.getSelection();
                    const range = document.createRange();
                    range.selectNodeContents(el);
                    sel.removeAllRanges();
                    sel.addRange(range);
                    document.execCommand('copy');
                    sel.removeAllRanges();
                    showToast('Outline copied!', 'success');
                }
            } catch (e) {
                showToast('Could not copy outline', 'error');
            }
        }

        function updateQuestionList() {
            const container = document.getElementById('questionList');
            if (!container) return;
            
            const questions = appState.extractedData.questions;
            const searchTerm = document.getElementById('questionSearch')?.value.toLowerCase() || '';
            const category = document.getElementById('questionCategory')?.value || '';
            const interviewer = document.getElementById('interviewerFilter')?.value.toLowerCase() || '';
            
            const filtered = questions.filter(q => {
                const matchesSearch = !searchTerm || 
                    q.question.toLowerCase().includes(searchTerm) || 
                    (q.answer && q.answer.toLowerCase().includes(searchTerm));
                const matchesCategory = !category ||
                    (q.category && q.category.toLowerCase().includes(category.toLowerCase())) ||
                    (q.categoryDisplay && q.categoryDisplay.toLowerCase().includes(category.toLowerCase()));
                const matchesInterviewer = !interviewer ||
                    (q.likelyAsker && q.likelyAsker.toLowerCase().includes(interviewer));
                return matchesSearch && matchesCategory && matchesInterviewer;
            });
            
            container.innerHTML = filtered.map(q => {
                // Format the answer for better readability
                // Build HTML answer: prefer extracted answer (converted to HTML), otherwise synthesize
                let formattedAnswer = '';
                if (q.answer && !isGenericAnswer(q.answer)) {
                    const pre = q.answer
                        .replace(/Focus:/g, '<strong>Focus:</strong>')
                        .replace(/Use STAR:/g, '<br><strong>STAR Example:</strong>')
                        .replace(/Prepare for:/g, '<br><strong>Follow-ups:</strong>')
                        .replace(/\n\s*\n/g, '\n');
                    formattedAnswer = toHtml(pre);
                } else {
                    formattedAnswer = synthesizeAnswer(q);
                }

                // Confidence level styling
                const confidenceColor = q.confidence >= 90 ? '#22c55e' : q.confidence >= 80 ? '#f59e0b' : '#ef4444';
                const confidenceText = q.confidence >= 90 ? 'HIGH' : q.confidence >= 80 ? 'MED' : 'LOW';
                const idx = filtered.indexOf(q);
                const meta = questionMeta(q);
                
                return `
                    <div class="question-item" style="background: white; border-radius: 0.75rem; padding: 1.25rem; margin-bottom: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; transition: all 0.3s ease; cursor: pointer;" 
                         data-action="toggle-question" data-index="${idx}">
                        
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                            <div style="flex: 1;">
                                <div style="margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                                    <span style="display: inline-block; padding: 0.25rem 0.75rem; background: ${getCategoryColor(q.category)}; color: white; border-radius: 1rem; font-size: 0.75rem; font-weight: 600;">
                                        ${q.category?.toUpperCase()}
                                    </span>
                                    ${q.categoryDisplay ? `<span style="display: inline-block; padding: 0.25rem 0.75rem; background: ${getCategoryColor(q.categoryDisplay)}; color: white; border-radius: 1rem; font-size: 0.75rem; font-weight: 600;">${q.categoryDisplay.toUpperCase()}</span>` : ''}
                                    ${q.difficulty ? `<span style="display: inline-block; padding: 0.25rem 0.75rem; background: #8b5cf6; color: white; border-radius: 1rem; font-size: 0.75rem; font-weight: 600;">${q.difficulty}</span>` : ''}
                                    ${q.confidence ? `<span style="display: inline-block; padding: 0.25rem 0.75rem; background: ${confidenceColor}; color: white; border-radius: 1rem; font-size: 0.75rem; font-weight: 600;">${confidenceText} ${q.confidence}%</span>` : ''}
                                    ${q.likelyAsker ? `<span style="display: inline-block; padding: 0.25rem 0.5rem; background: #0ea5e9; color: white; border-radius: 9999px; font-size: 0.7rem;">👤 ${q.likelyAsker}</span>` : ''}
                                    ${q.source ? `<span style="display: inline-block; padding: 0.125rem 0.5rem; background: #22c55e; color: white; border-radius: 9999px; font-size: 0.625rem;">FROM ${q.source.toUpperCase()}</span>` : ''}
                                    ${q.fromCSV ? '<span style="display: inline-block; padding: 0.125rem 0.5rem; background: #22c55e; color: white; border-radius: 9999px; font-size: 0.625rem;">Q&A BANK</span>' : ''}
                                    ${q.aiGenerated ? '<span class="ai-badge">AI</span>' : ''}
                                    ${q.interviewRound ? `<span style="display: inline-block; padding: 0.125rem 0.5rem; background: #f59e0b; color: white; border-radius: 9999px; font-size: 0.625rem;">${q.interviewRound}</span>` : ''}
                                </div>
                                
                                <div style="display: flex; align-items: start; gap: 1rem;">
                                    <div style="flex: 1;">
                                        <h3 style="font-weight: 600; margin-bottom: 0.5rem; color: #1e293b; font-size: 1.1rem; line-height: 1.4;">${q.question}</h3>
                                    </div>
                                    <div style="color: #9ca3af; font-size: 1.2rem; transition: transform 0.3s ease;" id="chevron-${idx}">▶</div>
                                </div>
                            </div>
                        </div>
                        
                        <div id="question-detail-${idx}" style="display: none; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e5e7eb;">
                            <div style="background: linear-gradient(135deg, #fef3c7, #fde68a); padding: 0.75rem; border-radius: 0.5rem; margin-bottom: 1rem; border-left: 4px solid #f59e0b;">
                                <strong style="color: #92400e;">💡 What This Tests:</strong>
                                <div style="margin-top: 0.5rem; color: #78350f;">
                                    ${q.prepNotes ? toHtml(q.prepNotes) : `<ul style='margin:0.5rem 0 0 1rem;'><li>${questionMeta(q).tests.join('</li><li>')}</li></ul>`}
                                </div>
                            </div>
                            
                            <div style="background: #f8fafc; padding: 0.75rem; border-radius: 0.5rem; margin-bottom: 1rem; border-left: 4px solid #22c55e;">
                                <div style="display:flex;justify-content:space-between;align-items:center;">
                                    <strong style="color:#14532d;">🧭 Suggested Answer Outline (${meta.time})</strong>
                                    <button class="btn btn-sm" data-action="copy-outline" data-index="${idx}" style="background:#22c55e;color:white;padding:0.25rem 0.5rem;border:none;border-radius:0.375rem;">Copy</button>
                                </div>
                                <ul id="qa-outline-${idx}" style="margin:0.5rem 0 0 1rem; color:#14532d;">
                                    ${meta.outline.map(i => `<li>${i}</li>`).join('')}
                                </ul>
                            </div>

                            <div style="display:grid;grid-template-columns: repeat(auto-fit,minmax(220px,1fr));gap:0.75rem;">
                                <div style="background:#ecfeff;padding:0.75rem;border-radius:0.5rem;border-left:4px solid #06b6d4;">
                                    <strong style="color:#0e7490;">✅ Success Criteria</strong>
                                    <ul style="margin:0.5rem 0 0 1rem;color:#0e7490;">
                                        ${meta.success.map(s => `<li>${s}</li>`).join('')}
                                    </ul>
                                </div>
                                <div style="background:#fff7ed;padding:0.75rem;border-radius:0.5rem;border-left:4px solid #fb923c;">
                                    <strong style="color:#c2410c;">⚠️ Pitfalls</strong>
                                    <ul style="margin:0.5rem 0 0 1rem;color:#c2410c;">
                                        ${meta.pitfalls.map(p => `<li>${p}</li>`).join('')}
                                    </ul>
                                </div>
                                <div style="background:#f0fdf4;padding:0.75rem;border-radius:0.5rem;border-left:4px solid #22c55e;">
                                    <strong style="color:#166534;">📊 Metrics To Mention</strong>
                                    <ul style="margin:0.5rem 0 0 1rem;color:#166534;">
                                        ${meta.metrics.map(m => `<li>${m}</li>`).join('')}
                                    </ul>
                                </div>
                            </div>

                            ${q.starLink ? `<div style="background: linear-gradient(135deg, #dbeafe, #bfdbfe); padding: 0.75rem; border-radius: 0.5rem; margin-bottom: 1rem; border-left: 4px solid #3b82f6;">
                                <strong style="color: #1d4ed8;">⭐ Recommended STAR Story:</strong>
                                <div style="margin-top: 0.5rem; color: #1e40af; font-weight: 500;">${q.starLink}</div>
                            </div>` : ''}
                            
                            ${q.followUps ? `<div style="background: linear-gradient(135deg, #f3e8ff, #e9d5ff); padding: 0.75rem; border-radius: 0.5rem; margin-bottom: 1rem; border-left: 4px solid #8b5cf6;">
                                <strong style="color: #6b21a8;">🔄 Potential Follow-ups:</strong>
                                <div style="margin-top: 0.5rem; color: #7c2d92;">${q.followUps}</div>
                            </div>` : ''}

                            <div style="background: linear-gradient(135deg, #f8fafc, #f1f5f9); padding: 1rem; border-radius: 0.5rem; border-left: 4px solid ${getCategoryColor(q.category)};">
                                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
                                    <span style="font-size: 1.2rem;">💡</span>
                                    <strong style="color: #374151;">Preparation Notes:</strong>
                                </div>
                                <div style="color: #4b5563; line-height: 1.6;">${formattedAnswer || 'No preparation notes available. Consider adding specific talking points and examples.'}</div>
                            </div>
                            
                            <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                                <button class="btn btn-sm" style="background: #10b981; color: white; padding: 0.5rem 1rem; border: none; border-radius: 0.375rem; font-size: 0.875rem; cursor: pointer;" 
                                        data-action="question-mark-practiced" data-index="${idx}">
                                    ✅ Mark as Practiced
                                </button>
                                <button class="btn btn-sm" style="background: #f59e0b; color: white; padding: 0.5rem 1rem; border: none; border-radius: 0.375rem; font-size: 0.875rem; cursor: pointer;" 
                                        data-action="question-add-review" data-index="${idx}">
                                    📌 Add to Review
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            
            if (filtered.length === 0) {
                container.innerHTML = '<p style="padding: 1rem; color: #64748b;">No questions found. Try adjusting your search or generate more questions.</p>';
            }
        }

        // Removed duplicate getCategoryColor (see consolidated version below)

        function updateStarStories() {
            const container = document.getElementById('storyList');
            if (!container) return;
            
            if (appState.extractedData.stories.length === 0) {
                container.innerHTML = '<p style="color: #64748b;">No stories loaded yet. Upload files to populate.</p>';
                return;
            }
            
            container.innerHTML = appState.extractedData.stories.map((story, index) => {
                const fromDocs = story.fromDocument || story.fromDocuments;
                return `
                <div style="padding: 1rem; background: #f8fafc; border-radius: 0.5rem; margin-bottom: 1rem; cursor: pointer;" 
                     data-action="story-show" data-index="${index}">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div style="flex: 1;">
                            <h4 style="font-weight: 600;">${story.title}</h4>
                            <p style="font-size: 0.875rem; color: #64748b;">Problem: ${story.problem || 'Click to view'}</p>
                            <p style="font-size: 0.875rem; color: #4f46e5; font-weight: 600;">Metric: ${story.metric || 'N/A'}</p>
                            ${fromDocs ? '<span style="display: inline-block; padding: 0.125rem 0.5rem; background: #22c55e; color: white; border-radius: 9999px; font-size: 0.625rem; margin-top: 0.5rem;">FROM DOCUMENTS</span>' : ''}
                        </div>
                    </div>
                </div>
            `;
            }).join('');
        }

        // Simple function to convert basic markdown to HTML
        function convertMarkdownToHtml(text) {
            if (!text) return text;
            return text
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')  // **bold** -> <strong>bold</strong>
                .replace(/\*(.*?)\*/g, '<em>$1</em>')              // *italic* -> <em>italic</em>
                .replace(/#{6}\s*(.*)/g, '<h6>$1</h6>')            // ###### -> h6
                .replace(/#{5}\s*(.*)/g, '<h5>$1</h5>')            // ##### -> h5
                .replace(/#{4}\s*(.*)/g, '<h4>$1</h4>')            // #### -> h4
                .replace(/#{3}\s*(.*)/g, '<h3>$1</h3>')            // ### -> h3
                .replace(/#{2}\s*(.*)/g, '<h2>$1</h2>')            // ## -> h2
                .replace(/#{1}\s*(.*)/g, '<h1>$1</h1>')            // # -> h1
                .replace(/\n/g, '<br>');                           // newlines -> <br>
        }

        function showStoryDetail(index) {
            const idx = Number(index);
            if (Number.isNaN(idx)) return;
            const story = (appState.extractedData.stories || [])[idx];
            if (!story) return;
            const detailDiv = document.getElementById('storyDetail');
            if (!detailDiv) return;
            const fromDocs = story.fromDocument || story.fromDocuments;

            detailDiv.innerHTML = `
                <h3 style="font-weight: 600; margin-bottom: 1rem;">${story.title}</h3>
                ${fromDocs ? '<span style="display: inline-block; padding: 0.125rem 0.5rem; background: #22c55e; color: white; border-radius: 9999px; font-size: 0.625rem; margin-bottom: 1rem;">FROM DOCUMENTS</span>' : ''}
                <div style="background: #f8fafc; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem;">
                    <strong>Situation:</strong> ${convertMarkdownToHtml(story.situation)}
                </div>
                <div style="background: #f8fafc; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem;">
                    <strong>Task:</strong> ${convertMarkdownToHtml(story.task)}
                </div>
                <div style="background: #f8fafc; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem;">
                    <strong>Action:</strong> ${convertMarkdownToHtml(story.action)}
                </div>
                <div style="background: #e0f2fe; padding: 1rem; border-radius: 0.5rem; border-left: 4px solid #0284c7;">
                    <strong>Result:</strong> ${convertMarkdownToHtml(story.result)}
                </div>
                ${story.additionalMetrics ? `
                    <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 1rem; border-radius: 0.5rem; margin-top: 1rem;">
                        <strong>📊 Enhanced Metrics:</strong> ${story.additionalMetrics}
                    </div>
                ` : ''}
                <button class="btn btn-primary" style="margin-top: 1rem;" data-action="story-enhance" data-index="${index}">
                    <span>✨</span> ${story.additionalMetrics ? 'Re-enhance' : 'Enhance this'} Story
                    <span class="ai-badge">AI</span>
                </button>
            `;
        }

        function updateDebriefDropdown() {
            const select = document.getElementById('interviewerSelect');
            if (!select) return;
            
            if (appState.extractedData.panelists.length === 0) {
                select.innerHTML = '<option value="">No panelists loaded</option>';
            } else {
                select.innerHTML = appState.extractedData.panelists.map(p => 
                    `<option value="${p.name}">${p.name} - ${p.role}</option>`
                ).join('');
            }
        }

        function filterQuestions(categoryOrEvent) {
            let categoryToApply = '';

            if (typeof categoryOrEvent === 'string') {
                categoryToApply = categoryOrEvent;
            } else if (categoryOrEvent && typeof categoryOrEvent === 'object') {
                const { target } = categoryOrEvent;
                if (target && target.id === 'questionCategory') {
                    categoryToApply = target.value;
                }
            }

            if (categoryToApply) {
                const select = document.getElementById('questionCategory');
                if (select) select.value = categoryToApply;
            }

            updateQuestionList();
        }

        // Enhanced question display functions (handler implemented later with index-based toggle)

        function getCategoryColor(category) {
            const colors = {
                'technical': '#dc2626',
                'behavioral': '#7c3aed', 
                'situational': '#059669',
                'company': '#0ea5e9',
                'role-specific': '#f59e0b'
            };
            return colors[category] || '#64748b';
        }

        function getCategoryIcon(category) {
            const icons = {
                'technical': '🔧',
                'behavioral': '👤',
                'situational': '🎯',
                'company': '🏢',
                'role-specific': '📊'
            };
            return icons[category] || '❓';
        }

        // Function to load questions from CSV file
        async function loadQuestionsFromCSV() {
            try {
                await ensurePapaParse();
                const response = await fetch('input_files/anticipated_questions_google_play_bi.csv');
                const csvText = await response.text();
                
                // Parse CSV using Papa Parse
                const results = Papa.parse(csvText, {
                    header: true,
                    skipEmptyLines: true
                });
                
                // Transform CSV data to our question format
                const questions = results.data.map(row => {
                    const question = row['Question'] || '';
                    const prepNotes = row['My Prep Notes (test, STAR link, follow-ups)'] || '';
                    
                    // Determine category from question prefix
                    let category = 'behavioral';
                    if (question.includes('[Technical]')) {
                        category = 'technical';
                    } else if (question.includes('[Behavioral]')) {
                        category = 'behavioral';
                    } else if (question.includes('[Situational]')) {
                        category = 'situational';
                    }
                    
                    // Clean up the question text
                    const cleanQuestion = question
                        .replace(/\[.*?\]\s*/, '') // Remove category prefix
                        .trim();
                    
                    // Extract key points from prep notes
                    const answer = prepNotes
                        .replace(/Tests:/, 'Focus:')
                        .replace(/STAR:/, 'Use STAR:')
                        .replace(/Follow-ups:/, 'Prepare for:')
                        .trim();
                    
                    return {
                        question: cleanQuestion,
                        answer: answer || 'Review prep notes and STAR examples',
                        category: category,
                        fromCSV: true
                    };
                }).filter(q => q.question); // Filter out any empty questions
                
                return questions;
            } catch (error) {
                console.error('Error loading CSV:', error);
                return [];
            }
        }

        // Function to load questions from Markdown file
        async function loadQuestionsFromMarkdown() {
            try {
                console.log('🔍 Loading questions from Google Q&A Bank.md...');
                const res = await fetch('input_files/Google Q&A Bank.md');
                if (!res.ok) {
                    console.log('❌ Could not fetch Q&A file');
                    return [];
                }
                
                const text = await res.text();
                const lines = text.split(/\r?\n/);
                const questions = [];
                let currentQuestion = '';
                let currentAnswer = '';
                let currentCategory = '';
                let currentLikelyAsker = '';
                let isInAnswer = false;
                
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    
                    // Detect category sections like "## CATEGORY 1: ROLE-SPECIFIC TECHNICAL QUESTIONS"
                    if (line.match(/^## .*CATEGORY \d+:/)) {
                        currentCategory = line.replace(/^## .*CATEGORY \d+:\s*/, '').toLowerCase();
                        console.log(`📂 Found category: ${currentCategory}`);
                        continue;
                    }
                    
                    // Detect questions like "### Q1: "How would you design a data mart for Google Play Points tier progression analytics?""
                    if (line.match(/^### Q\d+:/)) {
                        // Save previous question if exists (relaxed requirement - question is enough)
                        if (currentQuestion) {
                            questions.push({
                                question: currentQuestion.replace(/^[""]|[""]$/g, ''), // Remove quotes
                                answer: currentAnswer.trim() || 'Review prep notes and Q&A content',
                                category: currentCategory || 'general',
                                likelyAsker: currentLikelyAsker || 'Unknown'
                            });
                            console.log(`✅ Saved question: ${currentQuestion.substring(0, 30)}... (Asker: ${currentLikelyAsker})`);
                        }
                        
                        // Start new question
                        currentQuestion = line.replace(/^### Q\d+:\s*/, '').replace(/^[""]|[""]$/g, '');
                        currentAnswer = '';
                        currentLikelyAsker = '';
                        isInAnswer = false;
                        console.log(`❓ Found question: ${currentQuestion.substring(0, 50)}...`);
                    }
                    
                    // Detect likely asker lines like "*Likely Asker: Nikki Diman*"
                    else if (line.match(/^\*Likely Asker:/)) {
                        currentLikelyAsker = line.replace(/^\*Likely Asker:\s*/, '').replace(/\*$/, '').trim();
                        console.log(`👤 Likely asker: ${currentLikelyAsker}`);
                    }
                    
                    // Detect answer sections - look for patterns like "**30-Second Core:**", "**60-Second Standard:**", etc.
                    else if (line.match(/^\*\*(30-Second|60-Second|90-Second|Your Response|Response).*:\*\*/)) {
                        isInAnswer = true;
                        // Extract the answer content after the colon
                        const answerStart = line.indexOf(':') + 1;
                        if (answerStart > 0) {
                            currentAnswer += line.substring(answerStart).replace(/^\*+/, '').trim() + ' ';
                        }
                    }
                    
                    // Continue collecting answer content
                    else if (isInAnswer && currentQuestion && line && !line.startsWith('#') && !line.startsWith('*Likely Asker:')) {
                        // Skip SQL code blocks and technical content for cleaner answers
                        if (!line.startsWith('```') && !line.startsWith('FROM') && !line.startsWith('SELECT')) {
                            currentAnswer += line + ' ';
                        }
                        
                        // Stop answer collection at next question or major section
                        if (line.startsWith('### Q') || line.startsWith('## ')) {
                            isInAnswer = false;
                        }
                    }
                }
                
                // Don't forget the last question
                if (currentQuestion) {
                    questions.push({
                        question: currentQuestion.replace(/^[""]|[""]$/g, ''),
                        answer: currentAnswer.trim() || 'Review prep notes and Q&A content',
                        category: currentCategory || 'general',
                        likelyAsker: currentLikelyAsker || 'Unknown'
                    });
                    console.log(`✅ Saved final question: ${currentQuestion.substring(0, 30)}... (Asker: ${currentLikelyAsker})`);
                }
                
                console.log(`✅ Extracted ${questions.length} questions from Q&A file`);
                return questions;
                
            } catch(e) { 
                console.error('❌ Error loading Q&A markdown:', e);
                return []; 
            }
        }

        // Rich parser: load questions from Markdown with HTML-formatted answers
        async function loadQuestionsFromMarkdownRich() {
            try {
                console.log('🔍 Loading questions (rich) from Google Q&A Bank.md...');
                const res = await fetch('input_files/Google Q&A Bank.md');
                if (!res.ok) { return []; }

                const text = await res.text();
                const lines = text.split(/\r?\n/);

                function normalizeCategory(heading) {
                    const h = (heading || '').toLowerCase();
                    let category = 'general';
                    let display = '';
                    if (h.includes('technical')) category = 'technical';
                    else if (h.includes('business')) category = 'situational';
                    else if (h.includes('cultural')) category = 'behavioral';
                    if (h.includes('role-specific')) display = 'role-specific';
                    return { category, display };
                }
                function mdListToHtml(block) {
                    if (!block) return '';
                    const rows = block.trim().split(/\r?\n/).filter(r => r.trim() !== '');
                    const isList = rows.every(r => r.trim().startsWith('- ') || r.trim().startsWith('• '));
                    if (isList) {
                        return '<ul style="margin:0.25rem 0 0 1rem;">' + rows.map(r => `<li>${r.replace(/^[-•]\s*/, '')}</li>`).join('') + '</ul>';
                    }
                    return convertMarkdownToHtml(block.trim());
                }

                let cat = { category: 'general', display: '' };
                let current = null;
                let section = '';
                let buffers = {};

                function beginQuestion(title) {
                    if (current) finishQuestion();
                    current = {
                        question: title.replace(/^["\“\”]+|["\“\”]+$/g, ''),
                        answer: '',
                        category: cat.category,
                        categoryDisplay: cat.display,
                        likelyAsker: '',
                        source: 'Q&A BANK'
                    };
                    buffers = {};
                    section = '';
                }
                function finishQuestion() {
                    const order = ['30-Second Core', '60-Second Standard (with STAR)', '90-Second Deep Dive', 'Your Approach', 'Your Response', 'Expected Impact'];
                    let html = '';
                    order.forEach(name => {
                        const key = name.toLowerCase();
                        const content = buffers[key];
                        if (content && content.length) {
                            html += `<div style="margin-bottom:0.5rem;"><strong>${name}:</strong> ${mdListToHtml(content.join('\n'))}</div>`;
                        }
                    });
                    current.answer = html || 'Review prep notes and Q&A content';
                    results.push(current);
                    current = null;
                    section = '';
                    buffers = {};
                }
                function startSection(line) {
                    const titles = ['30-Second Core', '60-Second Standard (with STAR)', '90-Second Deep Dive', 'Your Approach', 'Your Response', 'Expected Impact'];
                    for (const t of titles) {
                        const re = new RegExp(`^\\*\\*${t}\\*\\*:?`);
                        if (re.test(line)) {
                            section = t.toLowerCase();
                            const after = line.replace(re, '').trim();
                            buffers[section] = buffers[section] || [];
                            if (after) buffers[section].push(after);
                            return true;
                        }
                    }
                    return false;
                }

                const results = [];
                for (let i = 0; i < lines.length; i++) {
                    const raw = lines[i];
                    const line = raw.trim();
                    if (/^## .*CATEGORY \d+:/i.test(line)) {
                        const heading = line.replace(/^## .*CATEGORY \d+:\s*/i, '');
                        cat = normalizeCategory(heading);
                        continue;
                    }
                    if (/^### Q\d+:/i.test(line)) {
                        const title = line.replace(/^### Q\d+:\s*/i, '');
                        beginQuestion(title);
                        continue;
                    }
                    if (/^\*Likely Asker:/i.test(line)) {
                        if (current) current.likelyAsker = line.replace(/^\*Likely Asker:\s*/i, '').replace(/\*$/, '').trim();
                        continue;
                    }
                    if (startSection(line)) continue;
                    if (/^### Q\d+:/i.test(line) || /^##\s+/i.test(line)) continue;

                    if (current) {
                        if (line.startsWith('```')) continue; // ignore code fences
                        if (!section) { section = 'your response'; buffers[section] = buffers[section] || []; }
                        // Skip heavy SQL lines for prep display
                        if (!/^SELECT|^FROM|^CREATE|^WITH\s/i.test(line)) buffers[section].push(line);
                    }
                }
                if (current) finishQuestion();

                console.log(`✅ Extracted ${results.length} questions (rich)`);
                return results;
            } catch (e) {
                console.error('❌ Error loading rich Q&A:', e);
                return [];
            }
        }

        // Function to load strategic questions I should ask interviewers from Q&A Bank
        async function loadStrategicQuestionsFromMarkdown() {
            try {
                console.log('🎤 Loading strategic questions from Google Q&A Bank.md...');
                const res = await fetch('input_files/Google Q&A Bank.md');
                if (!res.ok) {
                    console.log('❌ Could not fetch Q&A file for strategic questions');
                    return {};
                }
                
                const text = await res.text();
                const lines = text.split(/\r?\n/);
                const strategicQuestions = {};
                let currentPanelist = '';
                let inStrategicSection = false;
                
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    
                    // Look for Strategic Questions Bank section
                    if (line.match(/^## 🎤 STRATEGIC QUESTIONS BANK/)) {
                        inStrategicSection = true;
                        console.log('📋 Found Strategic Questions Bank section');
                        continue;
                    }
                    
                    // Stop if we hit the next major section
                    if (inStrategicSection && line.match(/^## [^🎤]/)) {
                        break;
                    }
                    
                    if (inStrategicSection) {
                        // Look for panelist headers like "### For Nikki Diman:"
                        const panelistMatch = line.match(/^### For (.+):/);
                        if (panelistMatch) {
                            currentPanelist = panelistMatch[1].trim();
                            strategicQuestions[currentPanelist] = [];
                            console.log(`👤 Found strategic questions for: ${currentPanelist}`);
                            continue;
                        }
                        
                        // Look for numbered questions like '1. **"question text"**'
                        const questionMatch = line.match(/^\d+\.\s*\*\*"(.+)"\*\*/);
                        if (questionMatch && currentPanelist) {
                            const question = questionMatch[1].trim();
                            strategicQuestions[currentPanelist].push(question);
                            console.log(`❓ Added strategic question: ${question.substring(0, 50)}...`);
                        }
                    }
                }
                
                console.log(`✅ Extracted strategic questions for ${Object.keys(strategicQuestions).length} panelists`);
                return strategicQuestions;
                
            } catch(e) { 
                console.error('❌ Error loading strategic questions:', e);
                return {}; 
            }
        }

        // Function to load STAR stories from uploaded documents (.md/.docx/.pdf)
        async function loadSTARStoriesFromDocuments() {
            try {
                const combined = Object.values(appState.fileContents || {}).join('\n');
                const found = extractSTARStoriesFromText(combined);
                return found.slice(0, 12);
            } catch (e) {
                console.log('⚠️ STAR extraction failed:', e);
                return [];
            }
        }

        function extractSTARStoriesFromPlaybook(content) {
            console.log('📖 Parsing STAR stories from Interview Playbook content...');
            const stories = [];
            
            // Split by STAR story sections - look for "### STAR #N:"
            const starSections = content.split(/### STAR #\d+:/);
            
            for (let i = 1; i < starSections.length; i++) { // Skip first empty section
                const section = starSections[i];
                const lines = section.split('\n');
                
                let title = '';
                let situation = '';
                let task = '';
                let action = '';
                let result = '';
                let learning = '';
                let googleApplication = '';
                
                let currentField = '';
                let content = '';
                
                for (const line of lines) {
                    const trimmed = line.trim();
                    
                    // Extract title from the first meaningful line
                    if (!title && trimmed && !trimmed.startsWith('**') && !trimmed.startsWith('#')) {
                        title = trimmed;
                        continue;
                    }
                    
                    // Look for STAR components
                    if (trimmed.match(/^\*\*Situation\*\*/)) {
                        if (currentField && content) {
                            assignField(currentField, content.trim());
                        }
                        currentField = 'situation';
                        content = trimmed.replace(/^\*\*Situation\*\*[^:]*:\s*/, '');
                    } else if (trimmed.match(/^\*\*Task\*\*/)) {
                        if (currentField && content) {
                            assignField(currentField, content.trim());
                        }
                        currentField = 'task';
                        content = trimmed.replace(/^\*\*Task\*\*[^:]*:\s*/, '');
                    } else if (trimmed.match(/^\*\*Action\*\*/)) {
                        if (currentField && content) {
                            assignField(currentField, content.trim());
                        }
                        currentField = 'action';
                        content = trimmed.replace(/^\*\*Action\*\*[^:]*:\s*/, '');
                    } else if (trimmed.match(/^\*\*Result\*\*/)) {
                        if (currentField && content) {
                            assignField(currentField, content.trim());
                        }
                        currentField = 'result';
                        content = trimmed.replace(/^\*\*Result\*\*[^:]*:\s*/, '');
                    } else if (trimmed.match(/^\*\*Learning\*\*/)) {
                        if (currentField && content) {
                            assignField(currentField, content.trim());
                        }
                        currentField = 'learning';
                        content = trimmed.replace(/^\*\*Learning\*\*[^:]*:\s*/, '');
                    } else if (trimmed.match(/^\*\*Google Play Application\*\*/)) {
                        if (currentField && content) {
                            assignField(currentField, content.trim());
                        }
                        currentField = 'googleApplication';
                        content = trimmed.replace(/^\*\*Google Play Application\*\*[^:]*:\s*/, '');
                    } else if (currentField && trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('**')) {
                        content += ' ' + trimmed;
                    }
                }
                
                // Handle the last field
                if (currentField && content) {
                    assignField(currentField, content.trim());
                }
                
                function assignField(field, value) {
                    switch(field) {
                        case 'situation': situation = value; break;
                        case 'task': task = value; break;
                        case 'action': action = value; break;
                        case 'result': result = value; break;
                        case 'learning': learning = value; break;
                        case 'googleApplication': googleApplication = value; break;
                    }
                }
                
                // Only add story if it has meaningful content
                if (title && (situation || task || action || result)) {
                    stories.push({
                        title: title,
                        situation: situation || 'Not specified',
                        task: task || 'Not specified', 
                        action: action || 'Not specified',
                        result: result || 'Not specified',
                        learning: learning || '',
                        googleApplication: googleApplication || '',
                        fromPlaybook: true
                    });
                    console.log(`📝 Extracted story: ${title.substring(0, 50)}...`);
                }
            }
            
            return stories;
        }

        // Extract interviewer information from all documents
        function extractInterviewerInfo(content) {
            const panelists = [];
            
            // Enhanced extraction for Nikki Diman
            if (content.includes('Nikki Diman') || content.includes('NIKKI DIMAN')) {
                const nikkiInfo = {
                    name: 'Nikki Diman',
                    role: 'Service Delivery Manager (Primary Interviewer)',
                    background: '',
                    hotButtons: [],
                    interviewStyle: '',
                    likelyQuestions: [],
                    expertise: []
                };
                
                // Extract from Q&A doc
                const nikkiQA = content.match(/NIKKI DIMAN[^#]{0,1000}/i);
                if (nikkiQA) {
                    const hotButtonMatch = nikkiQA[0].match(/Hot Buttons?:([^\n]+)/i);
                    if (hotButtonMatch) {
                        nikkiInfo.hotButtons = hotButtonMatch[1].split(',').map(s => s.trim());
                    }
                    const backgroundMatch = nikkiQA[0].match(/Background:([^\n]+)/i);
                    if (backgroundMatch) {
                        nikkiInfo.background = backgroundMatch[1].trim();
                    }
                    const styleMatch = nikkiQA[0].match(/(?:Interview Style|Response Style):([^\n]+)/i);
                    if (styleMatch) {
                        nikkiInfo.interviewStyle = styleMatch[1].trim();
                    }
                }
                
                // Extract from Strategic Intelligence
                const nikkiIntel = content.match(/Nikki Diman[^#]{0,2000}/i);
                if (nikkiIntel) {
                    // Extract professional background
                    const expMatch = nikkiIntel[0].match(/(?:Experience|Background):[^\n]{0,300}/i);
                    if (expMatch && !nikkiInfo.background) {
                        nikkiInfo.background = expMatch[0].replace(/^[^:]+:/, '').trim();
                    }
                    
                    // Extract expertise areas
                    if (nikkiIntel[0].includes('19+ years')) {
                        nikkiInfo.expertise.push('19+ years global recruiting');
                    }
                    if (nikkiIntel[0].includes('President') && nikkiIntel[0].includes('Circle')) {
                        nikkiInfo.expertise.push('President\'s Circle Winner 2018-2022');
                    }
                    if (nikkiIntel[0].includes('Program Manager')) {
                        nikkiInfo.expertise.push('Program Manager at Google via Scalence LLC');
                    }
                }
                
                // Extract likely questions
                const questions = [];
                if (content.includes('Gold-to-Platinum progression')) {
                    questions.push('How would you diagnose and fix stagnant Gold-to-Platinum progression?');
                }
                if (content.includes('stakeholder') && content.includes('conflict')) {
                    questions.push('Describe managing conflicting priorities between teams');
                }
                if (content.includes('ambiguous requirements')) {
                    questions.push('How do you handle ambiguous requirements from stakeholders?');
                }
                nikkiInfo.likelyQuestions = questions;
                
                // Set enhanced defaults from Interview Playbook
                if (!nikkiInfo.background) {
                    nikkiInfo.background = '19+ years recruiting experience, Program Manager at Google via Scalence LLC. President\'s Circle Winner 2018-2022. Service Delivery Manager focused on creative problem-solving with minimal data and stakeholder management.';
                }
                if (nikkiInfo.hotButtons.length === 0) {
                    nikkiInfo.hotButtons = ['Creative problem-solving with minimal data', 'Stakeholder management across functions', 'Thought process over perfect solutions', 'Cross-functional collaboration', 'Business impact focus'];
                }
                if (!nikkiInfo.interviewStyle) {
                    nikkiInfo.interviewStyle = 'Scenario-based questions, practical business problems, values thought process and creative solutions over technical perfection';
                }
                
                // Add enhanced interview preparation notes
                nikkiInfo.philosophyNotes = 'Values creative problem-solving with minimal data and stakeholder management excellence';
                nikkiInfo.preparationTips = ['Lead with business impact', 'Emphasize collaboration and stakeholder management', 'Show creative problem-solving process', 'Reference cross-functional success', 'Focus on practical solutions'];
                nikkiInfo.likelyTopics = ['Play Points tier progression optimization', 'Stakeholder alignment challenges', 'Data-driven decision making with incomplete information', 'Cross-functional project management'];
                nikkiInfo.rapportPoints = ['President\'s Circle achievement', 'Google/Scalence experience', 'Service delivery excellence', 'Recruiting industry insights'];
                
                panelists.push(nikkiInfo);
            }
            
            // Enhanced extraction for Brian Mauch
            if (content.includes('Brian Mauch') || content.includes('BRIAN MAUCH')) {
                const brianInfo = {
                    name: 'Brian Mauch',
                    role: 'Associate Director of Recruiting (Optional)',
                    background: '',
                    hotButtons: [],
                    interviewStyle: '',
                    likelyQuestions: []
                };
                
                const brianSection = content.match(/BRIAN MAUCH[^#]{0,500}/i);
                if (brianSection) {
                    const hotButtonMatch = brianSection[0].match(/Hot Buttons?:([^\n]+)/i);
                    if (hotButtonMatch) {
                        brianInfo.hotButtons = hotButtonMatch[1].split(',').map(s => s.trim());
                    }
                    const backgroundMatch = brianSection[0].match(/Background:([^\n]+)/i);
                    if (backgroundMatch) {
                        brianInfo.background = backgroundMatch[1].trim();
                    }
                }
                
                // Set enhanced defaults from Interview Playbook
                if (!brianInfo.background) {
                    brianInfo.background = 'Associate Director of Recruiting at Scalence LLC. Technical validation focus with emphasis on scalability experience and cultural fit assessment.';
                }
                if (brianInfo.hotButtons.length === 0) {
                    brianInfo.hotButtons = ['Technical validation depth', 'Scalability experience', 'Cultural fit assessment', 'Team collaboration', 'BigQuery/SQL expertise'];
                }
                if (!brianInfo.interviewStyle) {
                    brianInfo.interviewStyle = 'Technical depth validation, hands-on SQL/BigQuery scenarios, team collaboration assessment';
                }
                
                // Enhanced likely questions from Interview Playbook
                brianInfo.likelyQuestions = [
                    'How does the team approach balancing technical debt with rapid feature development?',
                    'What role do contractors typically play in driving strategic initiatives versus maintenance?',
                    'What are the biggest technical challenges in processing data for 220M+ Play Points members?'
                ];
                
                // Add enhanced interview preparation notes
                brianInfo.preparationTips = ['Include technical specifics (SQL, BigQuery, Python)', 'Demonstrate scale experience (millions/billions of records)', 'Show optimization techniques', 'Reference performance improvements', 'Prepare SQL examples'];
                brianInfo.technicalFocus = ['BigQuery optimization', 'SQL performance tuning', 'Data pipeline architecture', 'Scalability patterns'];
                brianInfo.sqlExamples = [
                    'Partitioning strategies for Play Points transactions',
                    'Window function optimization for member analytics',
                    'CTE usage for complex tier progression queries',
                    'Materialized views for dashboard performance'
                ];
                
                panelists.push(brianInfo);
            }
            
            // Enhanced extraction for Jolly Jayaprakash
            if (content.includes('Jolly Jayaprakash') || content.includes('JOLLY JAYAPRAKASH')) {
                const jollyInfo = {
                    name: 'Jolly Jayaprakash',
                    role: 'Recruiter (Process Coordinator)',
                    background: '',
                    hotButtons: [],
                    interviewStyle: '',
                    likelyQuestions: []
                };
                
                const jollySection = content.match(/JOLLY JAYAPRAKASH[^#]{0,500}/i);
                if (jollySection) {
                    const hotButtonMatch = jollySection[0].match(/Hot Buttons?:([^\n]+)/i);
                    if (hotButtonMatch) {
                        jollyInfo.hotButtons = hotButtonMatch[1].split(',').map(s => s.trim());
                    }
                    const backgroundMatch = jollySection[0].match(/Background:([^\n]+)/i);
                    if (backgroundMatch) {
                        jollyInfo.background = backgroundMatch[1].trim();
                    }
                }
                
                // Set defaults
                if (!jollyInfo.background) {
                    jollyInfo.background = '10+ years with current company, supports Google and Apple clients';
                }
                if (jollyInfo.hotButtons.length === 0) {
                    jollyInfo.hotButtons = ['Immediate availability', 'Flexibility for Pacific hours', 'SQL expertise validation', 'FTE conversion potential'];
                }
                if (!jollyInfo.interviewStyle) {
                    jollyInfo.interviewStyle = 'Direct, enthusiastic, emphasize availability and technical readiness';
                }
                
                // Add likely questions
                jollyInfo.likelyQuestions = [
                    'Why Google? Why contractor role?',
                    'What\'s your 5-year goal?',
                    'What makes successful contractors stand out?'
                ];
                
                panelists.push(jollyInfo);
            }
            
            if (panelists.length > 0) {
                appState.extractedData.panelists = panelists;
            }
        }
        
        // Extract additional panelist details from Q&A document format
        function extractPanelistDetailsFromQA(content) {
            // This is specifically for the structured Q&A document
            const panelistData = [];
            
            // Enhanced Nikki extraction
            const nikkiMatch = content.match(/NIKKI DIMAN[^#]{0,2000}/i);
            if (nikkiMatch) {
                const nikkiText = nikkiMatch[0];
                const nikki = {
                    name: 'Nikki Diman',
                    role: 'Service Delivery Manager (Primary Interviewer)',
                    archetype: 'Champion',
                    background: '19+ years global recruiting, President\'s Circle Winner 2018-2022, Program Manager at Google via Scalence LLC',
                    hotButtons: [
                        'Creative problem-solving with minimal data',
                        'Cross-functional stakeholder management', 
                        'Extracting insights from vast datasets',
                        'Thought process over perfect solutions'
                    ],
                    interviewStyle: 'Scenario-based problems, stakeholder conflict resolution, data quality challenges',
                    likelyQuestions: [
                        'How would you design a data mart for Google Play Points tier progression analytics?',
                        'Walk me through investigating a sudden spike in Play Points churn rate',
                        'Google Play Points has stagnant Gold-to-Platinum progression. How would you diagnose and fix this?',
                        'Describe managing conflicting priorities between Product and Marketing teams',
                        'How do you handle ambiguous requirements from stakeholders?'
                    ],
                    motivation: 'Finding analysts who can think creatively and communicate effectively with stakeholders',
                    anxiety: 'Candidates who over-engineer solutions without considering business context'
                };
                panelistData.push(nikki);
            }
            
            // Enhanced Brian extraction  
            const brianMatch = content.match(/BRIAN MAUCH[^#]{0,1000}/i);
            if (brianMatch) {
                const brian = {
                    name: 'Brian Mauch',
                    role: 'Associate Director of Recruiting (Optional)',
                    archetype: 'Technical Expert',
                    background: 'Associate Director at Scalence LLC, limited public information',
                    hotButtons: [
                        'Technical validation',
                        'Cultural fit',
                        'Scalability experience'
                    ],
                    interviewStyle: 'Technical depth validation, team collaboration scenarios',
                    likelyQuestions: [
                        'How does the team approach balancing technical debt with rapid feature development?',
                        'What role do contractors typically play in driving strategic initiatives versus maintenance?',
                        'What are the biggest technical challenges in processing data for 220M+ Play Points members?'
                    ],
                    motivation: 'Validating technical depth and cultural alignment',
                    anxiety: 'Surface-level technical knowledge without practical application'
                };
                panelistData.push(brian);
            }
            
            // Enhanced Jolly extraction
            const jollyMatch = content.match(/JOLLY JAYAPRAKASH[^#]{0,1000}/i);
            if (jollyMatch) {
                const jolly = {
                    name: 'Jolly Jayaprakash', 
                    role: 'Recruiter (Process Coordinator)',
                    archetype: 'Gatekeeper',
                    background: '10+ years with current company, supports Google and Apple clients',
                    hotButtons: [
                        'Immediate availability',
                        'Flexibility for Pacific hours',
                        'SQL expertise validation',
                        'FTE conversion potential'
                    ],
                    interviewStyle: 'Direct, enthusiastic, emphasize availability and technical readiness',
                    likelyQuestions: [
                        'What typically drives contractor-to-FTE conversion decisions in data roles?',
                        'With your 10 years supporting Google, what makes successful contractors stand out?',
                        'What\'s the typical timeline for FTE transitions in the analytics team?'
                    ],
                    motivation: 'Ensuring smooth onboarding and long-term fit',
                    anxiety: 'Candidates not genuinely interested in the role or lacking availability'
                };
                panelistData.push(jolly);
            }
            
            // Merge with existing panelists or replace
            if (panelistData.length > 0) {
                appState.extractedData.panelists = panelistData;
                
                // Also populate panelistQuestions for War Room
                appState.extractedData.panelistQuestions = {};
                panelistData.forEach(panelist => {
                    const questions = [];
                    
                    if (panelist.name === 'Nikki Diman') {
                        questions.push(
                            'With Play Points serving 220M+ members globally, how does your team balance standardized global metrics with local market insights?',
                            'Given the upcoming ML expansion in 6-12 months, what specific AI initiatives are planned for Play Points personalization?',
                            'With your extensive stakeholder management experience, what strategies work best when Product, Engineering, and Marketing have conflicting priorities?'
                        );
                    } else if (panelist.name === 'Brian Mauch') {
                        questions.push(
                            'How does the team approach balancing technical debt with rapid feature development in the Play Store ecosystem?',
                            'What role do contractors typically play in driving strategic initiatives versus maintenance work?',
                            'What are the biggest technical challenges in processing data for 220M+ Play Points members?'
                        );
                    } else if (panelist.name === 'Jolly Jayaprakash') {
                        questions.push(
                            'You mentioned potential for conversion to FTE - what typically drives those decisions?',
                            'With your 10 years supporting Google, what makes successful contractors stand out?',
                            'What\'s the typical timeline for contractor-to-FTE conversions in data roles?'
                        );
                    }
                    
                    if (questions.length > 0) {
                        appState.extractedData.panelistQuestions[panelist.name] = questions;
                    }
                });
            }
        }
        
        // Extract STAR stories from documents (only from uploaded materials)
        function extractSTARStories(content) {
            const stories = extractSTARStoriesFromText(content);
            if (stories.length > 0) {
                const seen = new Set();
                const uniq = [];
                for (const s of stories) {
                    const key = ((s.situation||'').slice(0,120) + '|' + (s.result||'').slice(0,120)).toLowerCase();
                    if (!seen.has(key)) { seen.add(key); uniq.push(s); }
                }
                appState.extractedData.stories = uniq.slice(0, 12);
            }
        }
        
        // Extract key metrics from documents and CSVs
        function extractKeyMetrics(content) {
            const metrics = [];
            const addedMetrics = new Set();
            // NOTE: Do NOT attempt to parse CSV-like lines from arbitrary text.
            // Metrics from CSVs are handled during file processing only.
            
            // Extract from text content
            const textMetrics = [
                { pattern: /Alphabet Q4 2024 Revenue[^\n]*\$96\.5[^\n]*/i, label: 'Alphabet Q4 2024', value: '$96.5B', growth: '+12% YoY' },
                { pattern: /Google Play Revenue[^\n]*\$11\.63B/i, label: 'Play Store Revenue', value: '$11.63B', growth: 'Q4 2024' },
                { pattern: /220\+?\s*million\s*(?:members|Play Points)/i, label: 'Play Points Members', value: '220+ Million', growth: 'Global' },
                { pattern: /3\+?\s*billion\s*users/i, label: 'Google Play Users', value: '3+ Billion', growth: 'Worldwide' },
                { pattern: /5\s*(?:levels|tiers)/i, label: 'Loyalty Tiers', value: '5 Levels', growth: 'Bronze to Diamond' },
                { pattern: /\$58\.1\s*billion[^\n]*2024/i, label: 'Play Store Annual', value: '$58.1B', growth: '2024 Est.' },
                { pattern: /183,323[^\n]*employee/i, label: 'Google Employees', value: '183,323', growth: 'End 2024' },
                { pattern: /SQL[^\n]*52\.9%/i, label: 'SQL Demand', value: '52.9%', growth: 'Of job postings' },
                { pattern: /23%[^\n]*2032/i, label: 'Analytics Growth', value: '23%', growth: 'By 2032' }
            ];
            
            textMetrics.forEach(({ pattern, label, value, growth }) => {
                if (pattern.test(content)) {
                    const key = label + value;
                    if (!addedMetrics.has(key)) {
                        metrics.push({ label, value, growth, context: '' });
                        addedMetrics.add(key);
                    }
                }
            });
            
            // Add your personal metrics
            const personalMetrics = [
                { pattern: /500M\+\s*(?:SKU|records)/i, label: 'Your Scale', value: '500M+ Records', growth: 'Home Depot' },
                { pattern: /100M\+\s*daily/i, label: 'Daily Processing', value: '100M+', growth: 'Trulieve' },
                { pattern: /12%\s*(?:retention|improvement)/i, label: 'Retention Impact', value: '12%', growth: '$3.2M Revenue' },
                { pattern: /80%\s*(?:manual|reduction|automation)/i, label: 'Efficiency Gain', value: '80%', growth: 'Automation' },
                { pattern: /95%\s*(?:query|optimization|improvement)/i, label: 'Query Speed', value: '95%', growth: 'Faster' }
            ];
            
            personalMetrics.forEach(({ pattern, label, value, growth }) => {
                if (pattern.test(content)) {
                    const key = label + value;
                    if (!addedMetrics.has(key)) {
                        metrics.push({ label, value, growth, context: 'Your Experience' });
                        addedMetrics.add(key);
                    }
                }
            });
            
            // Limit to most important metrics
            if (metrics.length > 0) {
                if (!Array.isArray(appState.extractedData.metrics) || appState.extractedData.metrics.length === 0) {
                    appState.extractedData.metrics = metrics.slice(0, 12);
                } else {
                    // Merge without duplicates on label+value
                    const existing = new Set(appState.extractedData.metrics.map(m => `${m.label}|${m.value}`));
                    const merged = [...appState.extractedData.metrics];
                    metrics.forEach(m => {
                        const key = `${m.label}|${m.value}`;
                        if (!existing.has(key)) merged.push(m);
                    });
                    appState.extractedData.metrics = merged.slice(0, 12);
                }
            }
        }
        
        // Extract strengths and dynamically infer potential gaps from uploaded materials
        function extractStrengthsAndGaps(content) {
            const strengths = [];
            const files = appState.fileContents || {};
            const entries = Object.entries(files);

            const jdText = entries
                .filter(([name]) => /\b(jd|job\s*description|requisition|posting)\b/i.test(name))
                .map(([, text]) => text || '')
                .join('\n');
            const resumeText = entries
                .filter(([name]) => /resume|curriculum\s*vitae|cv/i.test(name))
                .map(([, text]) => text || '')
                .join('\n');
            const supplementalText = entries
                .filter(([name]) => !/\b(jd|job\s*description|requisition|posting)\b/i.test(name) && !/resume|curriculum\s*vitae|cv/i.test(name))
                .map(([, text]) => text || '')
                .join('\n');

            const strategyText = entries
                .filter(([name]) => /strategic\s*foundation|experience\s*map|gemini/i.test(name))
                .map(([, text]) => text || '').join('\n');

            const combinedText = strategyText.trim() ? strategyText : String(content || '');
            const candidateText = resumeText || supplementalText || combinedText;
            const candidateLower = candidateText.toLowerCase();
            const combinedLower = (candidateText + '\n' + supplementalText + '\n' + combinedText).toLowerCase();
            const rawJdLower = jdText ? jdText.toLowerCase() : '';
            const jdLower = (jdText || combinedText).toLowerCase();

            const candidateBackground = deriveCandidateBackground(resumeText);
            if (candidateBackground) {
                appState.extractedData.candidateBackground = candidateBackground;
            }

            const pushStrength = (value) => {
                if (value && !strengths.includes(value)) strengths.push(value);
            };

            // Technical strengths (derived from explicit signals in the materials)
            if (/8\+?\s*years?\s*sql/i.test(combinedText)) {
                pushStrength('8+ years advanced SQL expertise (CTEs, window functions, optimization)');
            }
            if (/bigquery/i.test(combinedText) && /500m\+/i.test(combinedText)) {
                pushStrength('BigQuery experience operating over 500M+ record datasets');
            }
            if (/python/i.test(combinedText) && /pipeline/i.test(combinedText)) {
                pushStrength('Python pipelines processing 100M+ daily records');
            }
            if (/(power\s*bi|tableau|looker|superset|data studio)/i.test(combinedText)) {
                pushStrength('Dashboard development across modern BI platforms');
            }

            // Business impact strengths
            if (/12%\s*(?:retention|improvement)/i.test(combinedText)) {
                pushStrength('12% customer retention improvement delivering $3.2M revenue impact');
            }
            if (/80%\s*(?:manual|reduction|automation)/i.test(combinedText)) {
                pushStrength('80% manual effort reduction translating to multimillion-dollar savings');
            }
            if (/30%\s*adoption/i.test(combinedText)) {
                pushStrength('30% dashboard adoption increase across 200+ stakeholders');
            }
            if (/95%\s*(?:query|optimization|latency)/i.test(combinedText)) {
                pushStrength('95% query optimization (10 minutes → 30 seconds)');
            }

            // Scale experience strengths
            if (/500m\+\s*(?:sku|record)/i.test(combinedText)) {
                pushStrength('500M+ record data warehousing experience');
            }
            if (/100m\+\s*(?:daily|transactions|events)/i.test(combinedText)) {
                pushStrength('100M+ daily transactions ingestion at scale');
            }
            if (/2,?000\+\s*stores/i.test(combinedText)) {
                pushStrength('Analytics supporting 2,000+ retail locations');
            }

            // Soft skills strengths
            if (/cross[-\s]?functional/i.test(combinedText) && /stakeholder/i.test(combinedText)) {
                pushStrength('Cross-functional stakeholder collaboration (Product, Marketing, Engineering)');
            }
            if (/c-(?:suite|level)|executive/i.test(combinedText)) {
                pushStrength('Executive presentation and C-suite communication');
            }
            if (/50\+\s*(?:training|sessions)/i.test(combinedText)) {
                pushStrength('Coaching & enablement (50+ training sessions delivered)');
            }

            // --- Dynamic gap inference ---
            const gapDetails = [];
            const seenGaps = new Set();

            const firstMatch = (text, keywords = []) => {
                if (!text) return null;
                for (const key of keywords) {
                    if (text.includes(String(key).toLowerCase())) return key;
                }
                return null;
            };

            const addGapDetail = (title, reason, mitigation, id) => {
                const key = (id || title || '').toLowerCase();
                if (!title || seenGaps.has(key)) return;
                gapDetails.push({ title, reason, mitigation });
                seenGaps.add(key);
            };

            const gapRules = [
                {
                    id: 'modern_bi',
                    label: 'Modern BI tooling (Looker/LookML)',
                    jdKeywords: ['looker', 'lookml', 'looker studio', 'lookerstudio'],
                    resumeKeywords: ['looker', 'lookml', 'looker studio', 'look ml'],
                    mitigation: 'Connect your Tableau/Power BI experience to Looker workflows and share a concrete ramp plan (sandbox project, course, documentation deep dive).'
                },
                {
                    id: 'dbt',
                    label: 'dbt or modular SQL transformations',
                    jdKeywords: ['dbt', 'data build tool', 'semantic layer'],
                    resumeKeywords: ['dbt', 'data build tool', 'semantic layer'],
                    mitigation: 'Highlight your data modeling approach and outline how you are leveling up on dbt (courses, certification, mini project).'
                },
                {
                    id: 'orchestration',
                    label: 'Workflow orchestration (Airflow/Dagster/Prefect)',
                    jdKeywords: ['airflow', 'dagster', 'prefect', 'cloud composer', 'scheduler', 'orchestration'],
                    resumeKeywords: ['airflow', 'dagster', 'prefect', 'composer', 'scheduler', 'orchestration'],
                    mitigation: 'Tie similar automation you have built to the named platform and describe your ramp plan (tutorials, sandbox DAGs).'
                },
                {
                    id: 'experimentation',
                    label: 'Experimentation & A/B testing',
                    jdKeywords: ['a/b', 'ab test', 'experiment', 'hypothesis', 'multivariate'],
                    resumeKeywords: ['a/b', 'ab test', 'experiment', 'hypothesis', 'multivariate'],
                    mitigation: 'Prepare a story that shows how you validate ideas with experiments or outline the framework you would use.'
                },
                {
                    id: 'ml_ai',
                    label: 'Machine learning / predictive analytics',
                    jdKeywords: ['machine learning', ' ml', 'ml ', 'predictive', 'modeling', 'forecast', 'regression', 'classification'],
                    resumeKeywords: ['machine learning', 'ml', 'predictive', 'modeling', 'forecast', 'regression', 'classification'],
                    mitigation: 'Connect adjacent analytical work (segmentation, forecasting) and explain how you partner with ML teams or plan to upskill.'
                },
                {
                    id: 'domain_loyalty',
                    label: 'Loyalty / CRM domain expertise',
                    jdKeywords: ['loyalty', 'rewards', 'subscription', 'crm', 'lifecycle', 'retention', 'points', 'gamification'],
                    resumeKeywords: ['loyalty', 'rewards', 'subscription', 'crm', 'retention', 'points', 'lifecycle'],
                    mitigation: 'Tie your customer segmentation or retention analytics to loyalty mechanics and prepare a quick tear-down of the company program.'
                },
                {
                    id: 'cloud_gcp',
                    label: 'Google Cloud / BigQuery depth',
                    jdKeywords: ['google cloud', 'gcp', 'bigquery', 'dataflow', 'cloud composer', 'pub/sub'],
                    resumeKeywords: ['google cloud', 'gcp', 'bigquery', 'dataflow', 'cloud composer', 'pub/sub'],
                    mitigation: 'Map your cloud experience to GCP services and mention labs, credentials, or sandbox work you are pursuing.'
                },
                {
                    id: 'cloud_aws',
                    label: 'AWS analytics stack',
                    jdKeywords: ['aws', 'redshift', 'athena', 'glue', 'lambda', 'kinesis'],
                    resumeKeywords: ['aws', 'redshift', 'athena', 'glue', 'lambda', 'kinesis'],
                    mitigation: 'Explain comparable tooling you have used and outline how you would ramp on the named AWS services.'
                },
                {
                    id: 'cloud_azure',
                    label: 'Azure analytics services',
                    jdKeywords: ['azure', 'synapse', 'fabric', 'data factory', 'adf'],
                    resumeKeywords: ['azure', 'synapse', 'fabric', 'data factory', 'adf'],
                    mitigation: 'Share analogous experience and note any Azure upskilling (Microsoft Learn paths, sandbox environment).'
                },
                {
                    id: 'leadership',
                    label: 'People leadership / mentorship stories',
                    jdKeywords: ['leadership', 'manage a team', 'lead a team', 'mentor', 'coaching', 'people manager'],
                    resumeKeywords: ['led', 'manage', 'manager', 'mentored', 'mentorship', 'coached', 'team lead'],
                    mitigation: 'Prepare examples showing how you led initiatives or mentored others, even without formal management authority.'
                },
                {
                    id: 'executive_story',
                    label: 'Executive storytelling & influence',
                    jdKeywords: ['executive', 'c-suite', 'vp', 'storytelling', 'narrative', 'influence', 'stakeholder'],
                    resumeKeywords: ['executive', 'c-suite', 'vp', 'storytelling', 'narrative', 'stakeholder', 'briefed'],
                    mitigation: 'Rehearse narratives that show how you communicate insights to senior leaders and drive decisions.'
                },
                {
                    id: 'quant_impact',
                    label: 'Quantified impact storytelling',
                    requireJD: false,
                    shouldApply: ({ jdLowerText }) => /impact|metric|kpi|okr|roi|business outcome|results/i.test(jdLowerText || ''),
                    resumeTest: () => /\d+%|\$\d|\d+(?:k|m|b)/i.test(candidateText),
                    reason: () => 'Interviewers expect quantified outcomes. Add explicit numbers to your resume bullets and stories.',
                    mitigation: 'Audit your resume and stories to ensure each one has before/after metrics so interviewers feel the impact.'
                }
            ];

            gapRules.forEach(rule => {
                const requireJD = rule.requireJD !== false;
                const jdKeyword = rule.jdKeywords ? firstMatch(rawJdLower || jdLower, rule.jdKeywords) : null;
                if (requireJD && !jdKeyword) return;
                if (rule.shouldApply && !rule.shouldApply({ jdLowerText: rawJdLower, candidateLower, combinedLower })) return;

                let resumeHasSignal = false;
                if (typeof rule.resumeTest === 'function') {
                    resumeHasSignal = !!rule.resumeTest(candidateLower, candidateText, combinedLower);
                } else {
                    resumeHasSignal = !!firstMatch(candidateLower, rule.resumeKeywords || rule.jdKeywords || []);
                }
                if (resumeHasSignal) return;

                const title = rule.label || rule.id;
                const reason = rule.reason
                    ? (typeof rule.reason === 'function'
                        ? rule.reason(jdKeyword)
                        : rule.reason.replace('{keyword}', jdKeyword || rule.jdKeywords?.[0] || title))
                    : (jdKeyword
                        ? `The job description highlights ${jdKeyword}, but it doesn't appear in your materials yet.`
                        : 'Highlight how you will close this perceived gap.');
                const mitigation = typeof rule.mitigation === 'function'
                    ? rule.mitigation(jdKeyword)
                    : (rule.mitigation || 'Prepare a mitigation story that shows your ramp-up plan.');

                addGapDetail(title, reason, mitigation, rule.id);
            });

            const strengthList = Array.from(new Set(strengths));
            appState.extractedData.strengths = strengthList;

            const limitedGaps = gapDetails.slice(0, 8);
            appState.extractedData.gapDetails = limitedGaps;
            appState.extractedData.gaps = limitedGaps.map(detail => detail.title);
        }
        
        // Extract questions from Q&A documents
        function extractQuestionsFromContent(content) {
            const questions = appState.extractedData.questions || [];
            const existingQuestions = new Set(questions.map(q => q.question));
            
            // Extract Q&A pairs from markdown format
            const qaPatterns = [
                /###?\s*Q\d*:?\s*"?([^"\n]+)"?\s*\n([^#]+?)(?=###?\s*Q\d*:|$)/gi,
                /\*\*Q\d*:?\*\*\s*"?([^"\n]+)"?\s*\n([^*]+?)(?=\*\*Q\d*:|\n\n|$)/gi
            ];
            
            qaPatterns.forEach(pattern => {
                let match;
                while ((match = pattern.exec(content)) !== null) {
                    const question = match[1].trim();
                    const answer = match[2].trim();
                    
                    if (!existingQuestions.has(question)) {
                        const category = determineQuestionCategory(question);
                        questions.push({
                            question: question,
                            answer: answer.substring(0, 500),
                            category: category,
                            fromDocument: true
                        });
                        existingQuestions.add(question);
                    }
                }
            });
            
            // Extract rapid-fire Q&As
            if (content.includes('RAPID-FIRE') || content.includes('Quickfire')) {
                const rapidSection = content.match(/(?:RAPID-FIRE|Quickfire)[^#]+/i);
                if (rapidSection) {
                    const rapidQAs = rapidSection[0].match(/"([^"]+)"\s*→\s*"([^"]+)"/g);
                    if (rapidQAs) {
                        rapidQAs.forEach(qa => {
                            const parts = qa.match(/"([^"]+)"\s*→\s*"([^"]+)"/);
                            if (parts && !existingQuestions.has(parts[1])) {
                                questions.push({
                                    question: parts[1],
                                    answer: parts[2],
                                    category: 'technical',
                                    fromDocument: true
                                });
                                existingQuestions.add(parts[1]);
                            }
                        });
                    }
                }
            }
            
            appState.extractedData.questions = questions;
        }
        
        // Extract company intelligence
        function extractCompanyIntel(content) {
            const intel = {
                executiveBrief: {
                    q4Performance: '$96.5B revenue (+12% YoY), $11.63B Play Store revenue (+8% YoY)',
                    playPointsScale: '220+ million members - one of the world\'s largest loyalty programs',
                    marketPosition: 'Google Play dominates Android ecosystem with 3.95M apps',
                    financialStrength: '$31B operating income (+31% YoY), $26.5B net income (+28% YoY)',
                    aiInvestment: '$75B planned CapEx investment in 2025 for AI infrastructure'
                },
                businessPerformance: {
                    revenue: {
                        'Alphabet Total Q4 2024': '$96.5B (+12% YoY)',
                        'Google Services Q4 2024': '$84.1B (+10% YoY)', 
                        'Google Play Store Q4 2024': '$11.63B (+8% YoY)',
                        'Google Cloud Q4 2024': '$12.0B (+30% YoY)',
                        'YouTube Ads Q4 2024': '$10.47B (+14% YoY)',
                        'Play Store Annual 2024 Est': '$58.1B vs Apple\'s $111.88B'
                    },
                    keyMetrics: {
                        'Play Points Members': '220+ million globally',
                        'Play Store Apps': '3.95 million active apps',
                        'Global Users': '3+ billion Play Store users',
                        'Employee Count': '183,323 (end 2024)',
                        'Free Cash Flow': '$72.8B (full year 2024)',
                        'Operating Margin': '32% (Q4 2024)'
                    }
                },
                strategicInitiatives: {
                    aiMlIntegration: [
                        'Gemini app team integrated into Google DeepMind',
                        'AI-powered payment method recommendations improving transaction completion',
                        'BigQuery ML enhanced capabilities for in-database machine learning',
                        'Vertex AI expanding with 70%+ of innovative gen AI companies',
                        'Full-stack approach to AI innovation across all products'
                    ],
                    playStorePlatform: [
                        'Play Points expansion: Diamond Valley mini-game, extended to Brazil',
                        'Gaming focus: Native PC titles support, multi-account gaming features',
                        'Commerce innovation: Cart abandonment reminders, subscription highlighting',
                        'Developer tools: Orders API expansion, pricing arbitrage protection',
                        'Payment library enhancement with regional options (QRIS Indonesia, Troy Turkey)'
                    ],
                    dataModernization: [
                        'BigQuery Studio: Generally available collaborative workspace',
                        'Lakehouse Foundation: Unifying data lakes and warehouses',
                        'Cross-Cloud Analytics: Enhanced BigQuery Omni',
                        'Real-time Processing: BigQuery continuous queries for streaming',
                        'Multimodal Analytics: Text, image, and video data processing'
                    ]
                },
                challengesOpportunities: {
                    regulatory: [
                        'Epic Games lawsuit: $205M settlement demand, structural changes required',
                        'EU Digital Markets Act: Potential 10% global revenue fine',
                        'Must allow alternative app stores and payment systems',
                        'Multiple US states settled similar cases for $700M',
                        'Enhanced pricing arbitrage protection across more countries'
                    ],
                    competitive: [
                        'Apple App Store revenue advantage: $111.88B vs Google Play $58.1B',
                        'Gaming revenue gap: Apple $50B vs Google Play $31.3B (2022)',
                        'Lower revenue per user but higher volume and global reach',
                        'Forced to allow competitors due to antitrust rulings'
                    ],
                    opportunities: [
                        'Enterprise AI: Growing demand for Google Cloud AI services',
                        'International expansion: Strong in Android-dominant markets',
                        'Play Points Diamond tier engagement optimization',
                        'Real-time analytics for 220M+ loyalty members',
                        'AI-powered personalization at global scale'
                    ]
                },
                technologyEcosystem: {
                    coreStack: {
                        'Data Platform': 'BigQuery (primary SQL-based data warehouse, serverless)',
                        'Analytics Tools': 'BigQuery ML, Looker, PLX (internal dashboard tool)',
                        'Development': 'BigQuery Studio (collaborative workspace), Apache Spark',
                        'AI/ML': 'Vertex AI, Gemini models integrated across products',
                        'Storage': 'BigLake unified storage engine (Iceberg, Hudi, Delta)'
                    },
                    recentAdvancements: [
                        'Gemini in BigQuery: AI-powered data preparation and analysis',
                        'Vector Embeddings: Support for multimodal analytics',
                        'Fine-tuning: LLM customization on enterprise data',
                        'Automated Optimization: AI-driven query performance recommendations',
                        'Real-time Streaming: Apache Kafka integration'
                    ]
                },
                cultureWorkplace: {
                    satisfaction: {
                        'Glassdoor Rating': '4.6/5 (ranked 8th best workplace globally)',
                        'Employee Reviews': '86% positive reviews (Comparably)',
                        'Indeed Data Analyst': '4.4/5 stars with positive feedback',
                        'Finance Team': '100% positive reviews'
                    },
                    workEnvironment: [
                        'Hybrid Model: 3 days/week in-office requirement',
                        'Badge tracking with attendance tied to performance reviews',
                        '4 weeks/year "Work From Anywhere" allowance',
                        'Year of Efficiency: Streamlined operations, reduced bureaucracy',
                        'Innovation culture: 20% time for passion projects still exists'
                    ],
                    benefits: [
                        'Highly competitive compensation (20-40% above market)',
                        'Comprehensive health, dental, vision coverage',
                        'Stock grants and performance bonuses',
                        'Free food, gym access, comprehensive perks',
                        '13 Google holidays + 5 PTO days minimum'
                    ]
                },
                roleSpecificIntel: {
                    department: 'Google Play - Data Science & Analytics Team',
                    focus: 'Supporting loyalty products (Play Points, Play Pass) with cross-functional collaboration',
                    teamStructure: 'Matrixed environment spanning multiple time zones and regions',
                    projects: [
                        'Play Points tier progression analytics (Bronze → Diamond)',
                        'User engagement patterns across 220M+ loyalty members',
                        'Revenue optimization for subscription and gaming segments',
                        'Real-time payment optimization and recommendation engines',
                        'Cross-platform analytics for gaming, entertainment, commerce'
                    ],
                    keyStakeholders: [
                        'Product teams for Play Points feature development',
                        'Marketing teams for user acquisition and retention',
                        'Engineering teams for data pipeline and infrastructure',
                        'Finance teams for revenue reporting and forecasting',
                        'Legal/Compliance teams for regulatory requirements'
                    ]
                },
                marketIntelligence: {
                    industryGrowth: [
                        'Data analytics jobs growing 23% through 2032 (BLS)',
                        'SQL appears in 52.9% of data analyst job postings (2024)',
                        'Mobile app market: Google Play 7.3% growth vs App Store 18.6%',
                        'Gaming segment particularly strong for revenue generation'
                    ],
                    competitivePositioning: [
                        'Scale advantage: 220+ million Play Points members',
                        'Full Google ecosystem integration leverage',
                        'Leadership in Android-dominant global markets',
                        'Advanced AI/ML capabilities through Vertex AI and BigQuery ML'
                    ]
                }
            };
            
            // Store as formatted string for display
            appState.extractedData.companyIntel = JSON.stringify(intel, null, 2);
            appState.extractedData.companyIntelSource = 'Strategic Intelligence Analysis';
        }
        
        // Helper function to determine question category
        function determineQuestionCategory(question) {
            const q = question.toLowerCase();
            if (q.includes('sql') || q.includes('query') || q.includes('bigquery') || q.includes('data') || q.includes('technical')) {
                return 'technical';
            }
            if (q.includes('tell me about') || q.includes('describe') || q.includes('time when') || q.includes('experience')) {
                return 'behavioral';
            }
            if (q.includes('would you') || q.includes('how would') || q.includes('what if')) {
                return 'situational';
            }
            if (q.includes('google') || q.includes('why') || q.includes('company')) {
                return 'company';
            }
            return 'behavioral';
        }
        
        // Helper functions
        function extractBetween(text, start, end) {
            const startIdx = text.indexOf(start);
            if (startIdx === -1) return '';
            const fromStart = text.substring(startIdx + start.length);
            const endIdx = fromStart.indexOf(end);
            return endIdx === -1 ? fromStart.trim() : fromStart.substring(0, endIdx).trim();
        }
        
        function extractHotButtons(text) {
            const hotButtons = [];
            const patterns = [
                /creative problem-solving/i,
                /stakeholder management/i,
                /minimal data/i,
                /thought process/i,
                /cross-functional/i
            ];
            patterns.forEach(pattern => {
                if (pattern.test(text)) {
                    hotButtons.push(pattern.source.replace(/\\/g, '').replace(/i$/, ''));
                }
            });
            return hotButtons.length > 0 ? hotButtons : ['Data-driven insights', 'Stakeholder collaboration'];
        }
        
        function extractTitle(text) {
            const match = text.match(/^([^\n:]{5,60})/);
            return match ? match[1].trim() : 'STAR Story';
        }
        
        function extractMetric(text) {
            const match = text.match(/(\d+%|\$[\d\.]+[MBK]?|\d+x)/);
            return match ? match[1] : '';
        }
        
        function extractSTARStoriesFromText(text) {
            const items = [];
            if (!text) return items;
            const lines = String(text).split(/\r?\n/);
            let buf = { title: '', situation: '', task: '', action: '', result: '' };
            let current = '';
            function flush() {
                const has = (v) => v && v.trim().length > 0;
                if ((has(buf.situation)||has(buf.task)||has(buf.action)) && has(buf.result)) {
                    const title = buf.title || (buf.result.split(/[.!?]/)[0] || buf.situation.split(/[.!?]/)[0] || 'STAR Story');
                    items.push({
                        title: title.substring(0,100),
                        situation: (buf.situation||'').trim(),
                        task: (buf.task||'').trim(),
                        action: (buf.action||'').trim(),
                        result: (buf.result||'').trim(),
                        metric: extractMetric((buf.result||'')) || extractMetric((buf.situation||'')) || '',
                        fromDocument: true
                    });
                }
                buf = { title: '', situation: '', task: '', action: '', result: '' };
                current = '';
            }
            for (let i=0;i<lines.length;i++) {
                const line = (lines[i]||'').trim();
                if (!line) continue;
                const m = line.match(/^(?:\*\*\s*)?(situation|task|action|result|s|t|a|r)\b[^:]*:\s*(.*)$/i);
                if (m) {
                    const label = m[1].toLowerCase()[0];
                    const val = m[2]||'';
                    if (label==='s') { if (current && current!=='s') flush(); current='s'; buf.situation += (buf.situation?' ':'')+val; }
                    else if (label==='t') { current='t'; buf.task += (buf.task?' ':'')+val; }
                    else if (label==='a') { current='a'; buf.action += (buf.action?' ':'')+val; }
                    else if (label==='r') { current='r'; buf.result += (buf.result?' ':'')+val; }
                } else if (current) {
                    if (current==='s') buf.situation += ' '+line;
                    else if (current==='t') buf.task += ' '+line;
                    else if (current==='a') buf.action += ' '+line;
                    else if (current==='r') buf.result += ' '+line;
                } else {
                    if (!buf.title && /^[A-Z][A-Za-z0-9 \-]{4,60}$/.test(line) && !/:$/.test(line)) {
                        buf.title = line;
                    }
                }
            }
            flush();
            // Also parse compact single-line "S:.. T:.. A:.. R:.." blocks
            const compactRe = /S\s*:\s*([^TAR\n]+)\s*T\s*:\s*([^AR\n]+)\s*A\s*:\s*([^R\n]+)\s*R\s*:\s*([^\n]+)/gi;
            let mm;
            while ((mm = compactRe.exec(text)) !== null) {
                items.push({
                    title: (mm[1].split(/[.!?]/)[0] || 'STAR Story').substring(0,100),
                    situation: mm[1].trim(),
                    task: mm[2].trim(),
                    action: mm[3].trim(),
                    result: mm[4].trim(),
                    metric: extractMetric(mm[4]) || extractMetric(mm[1]) || '',
                    fromDocument: true
                });
            }
            return items;
        }

        // Function to load panelist questions from Interview Playbook
        async function loadPanelistQuestionsFromPlaybook() {
            // No hard-coded panelist questions. Attempt to fetch the Playbook so future
            // parsing can be supported, but return an empty object today.
            try {
                // PDF version doesn't exist, using .md version instead
                // await fetch('input_files/Google - Interview Playbook.pdf');
            } catch (error) { /* ignore */ }
            return {};
        }

        // Function to generate AI-powered questions for panelists based on all input files
        async function generateAIPanelistQuestions(panelistName, panelistRole, panelistArchetype) {
            console.log(`🎯 Generating tailored questions for ${panelistName} (${panelistArchetype})`);
            let questions = [];

            // Prefer questions tagged to this panelist in uploaded Q&A
            const bank = (window.appState?.extractedData?.questions) || [];
            if (bank.length) {
                const byAsker = bank.filter(q => q.likelyAsker && q.likelyAsker.toLowerCase().includes(String(panelistName).toLowerCase()));
                if (byAsker.length) return byAsker.map(q => q.question);
            }

            // Role/Archetype heuristics (company‑agnostic)
            const r = String(panelistRole||'').toLowerCase();
            const isExec = /(cio|cto|cfo|chief|vp|director|head)/.test(r);
            const isMgr = /(manager|lead|program|product)/.test(r);
            const isTech = /(architect|engineer|developer|scientist|analyst|bi|power\s*bi|data)/.test(r);
            const isRecruiter = /(recruiter|talent|hr)/.test(r);

            if (isExec) {
                questions.push(
                    'What metrics would most influence your decision‑making in this role?',
                    'Where do you see the biggest opportunity for impact in the next 6–12 months?',
                    'How do you balance speed with quality for high‑visibility initiatives?'
                );
            }
            if (isMgr) {
                questions.push(
                    'How do you prioritize trade‑offs across competing stakeholders?',
                    'What does success look like for this team in 90 days?',
                    'How do you validate outcomes beyond dashboard metrics?'
                );
            }
            if (isTech) {
                questions.push(
                    'What technical guardrails matter most (cost, latency, reliability)?',
                    'What data model patterns work best for your core analytics?',
                    'How do you approach incident response and root‑cause analysis?'
                );
            }
            if (isRecruiter) {
                questions.push(
                    'What qualities separate successful hires on this team?',
                    'What are the must‑have skills for this role?',
                    'What does the interview timeline and decision process look like?'
                );
            }

            // Archetype refinement
            const a = String(panelistArchetype||'').toLowerCase();
            if (a.includes('gatekeeper')) questions.push('What are the key compliance or process expectations I should be aware of?');
            if (a.includes('technical')) questions.push('Which performance and data‑quality checks are most important to you?');
            if (a.includes('ally')) questions.push('How can I help the team deliver quick wins while building long‑term value?');
            if (a.includes('skeptic')) questions.push('Where have previous solutions fallen short, and how could this role address that?');

            if (appState.extractedData.company) {
                questions.push(`How does your team define success at ${appState.extractedData.company}?`);
            }
            return Array.from(new Set(questions)).slice(0, 8);
        }

        function addPanelist() {
            const name = document.getElementById('panelistName').value;
            const role = document.getElementById('panelistRole').value;
            const archetype = document.getElementById('panelistArchetype').value;
            
            if (!name || !role) {
                showToast('Please enter name and role', 'warning');
                return;
            }
            
            appState.extractedData.panelists.push({
                name,
                role,
                archetype,
                motivation: 'Evaluating overall fit for the role',
                anxiety: 'Looking for potential red flags'
            });
            
            updatePanelStrategy();
            updateDebriefDropdown();
            
            // Clear inputs
            document.getElementById('panelistName').value = '';
            document.getElementById('panelistRole').value = '';
            
            showToast('Panelist added!', 'success');
        }


        async function loadSampleData() {
            console.log('🚀 Loading comprehensive interview data...');
            updateDataStatus('Loading interview materials from files...', 'info');
            
            // Questions: prefer Markdown bank, then CSV fallback
            let questions = [];
            let strategicQuestions = {};
            try {
                console.log('📋 Loading questions from Q&A Bank...');
                // Prefer rich HTML-formatted parser
                const questionsFromMD = await loadQuestionsFromMarkdownRich();
                if (questionsFromMD && questionsFromMD.length > 0) {
                    questions = questionsFromMD;
                    console.log(`✅ Loaded ${questions.length} questions from Q&A Bank`);
                } else {
                    console.log('📋 Fallback to CSV questions...');
                const questionsFromCSV = await loadQuestionsFromCSV();
                questions = questionsFromCSV;
                    console.log(`✅ Loaded ${questions.length} questions from CSV`);
                }
                
                // Also load strategic questions I should ask them
                console.log('🎤 Loading strategic questions...');
                strategicQuestions = await loadStrategicQuestionsFromMarkdown();
                console.log(`✅ Loaded strategic questions for ${Object.keys(strategicQuestions).length} interviewers`);
            } catch (error) {
                console.log('❌ Could not load questions:', error);
                questions = [];
                strategicQuestions = {};
            }

            // STAR Stories from documents
            let stories = [];
            try {
                console.log('⭐ Loading STAR stories from documents...');
                stories = await loadSTARStoriesFromDocuments();
                console.log(`✅ Loaded ${stories.length} STAR stories`);
            } catch (error) {
                console.log('❌ Could not load STAR stories:', error);
                stories = [];
            }

            // Extract panelists from documents - with deduplication
            let panelists = [];
            let panelistQuestions = {};
            try {
                console.log('👥 Loading panelist information...');
                const extracted = await loadPanelistsFromDocuments();
                // Deduplicate panelists by name
                const panelistMap = new Map();
                (extracted.panelists || []).forEach(panelist => {
                    panelistMap.set(panelist.name.toLowerCase().trim(), panelist);
                });
                panelists = Array.from(panelistMap.values());
                panelistQuestions = extracted.panelistQuestions || {};
                console.log(`✅ Loaded ${panelists.length} unique panelists`);
            } catch (error) {
                console.log('❌ Could not extract panelists:', error);
                panelists = [];
            }

            // Panelist-specific questions: set from extracted docs if present

            // Enriched Company Intel (CSVs + Strategic Docs)
            let intel = { markdown: '', source: 'Strategic Intelligence' };
            try {
                const intelCSV = await loadCompanyIntelFromCSVs();
                const intelDocsMD = await loadCompanyIntelFromStrategicDocs();
                intel = {
                    markdown: intelCSV.markdown + (intelDocsMD ? '\n\n' + intelDocsMD : ''),
                    source: 'Strategic Intelligence'
                };
            } catch (error) {
                console.log('Could not load company intel:', error);
            }

            // Metrics for Command Center (from key metrics CSV)
            let metrics = [];
            try {
                metrics = await loadMetricsForCommandCenter();
            } catch (error) {
                console.log('Could not load metrics:', error);
                metrics = [];
            }

            // Infer company/role hints from available files/metrics
            let inferred = { company: '', role: '' };
            try {
                inferred = await inferCompanyAndRoleFromFiles(intel);
            } catch (error) {
                console.log('Could not infer company/role:', error);
            }

            // Extract comprehensive strengths and gaps from all documents
            let strengths = [];
            let gaps = [];
            
            // Core technical strengths (always include)
            const coreStrengths = [
                'Advanced SQL & BigQuery optimization (8+ years)',
                'Large-scale data processing (500M+ records, 100M+ daily transactions)',
                'Cloud data warehouse experience (Snowflake, BigQuery)',
                'Executive stakeholder management & dashboard adoption (200+ users)',
                'Cross-functional collaboration & process optimization',
                'Statistical analysis & A/B testing methodologies',
                'Data pipeline architecture & ETL/ELT design',
                'Performance optimization (95% query improvement achievements)',
                'Business impact quantification ($3.2M retention, $2M cost savings)',
                'Analytical problem-solving & root cause analysis',
                'Python data tooling (pandas, notebooks)',
                'Lean Six Sigma process improvement methodologies'
            ];
            
            try {
                console.log('💪 Loading strengths from strategic documents...');
                const sg = await extractStrengthsAndGapsFromStrategicDocs();
                const docStrengths = sg.strengths || [];
                const docGaps = sg.gaps || [];
                
                // Merge with core strengths, avoiding duplicates
                const allStrengths = [...coreStrengths, ...docStrengths];
                strengths = Array.from(new Set(allStrengths.map(s => s.trim()))).slice(0, 15);
                gaps = docGaps.length > 0 ? docGaps : [
                    'Google Cloud Platform specific experience',
                    'Play Points domain knowledge & user behavior patterns',
                    'Internal Google processes & collaboration tools'
                ];
                
                console.log(`✅ Compiled ${strengths.length} strengths and ${gaps.length} gaps`);
                
            } catch (e) {
                console.log('⚠️ Using core strengths as fallback');
                strengths = coreStrengths;
                gaps = [
                    'Google Cloud Platform specific experience',
                    'Play Points domain knowledge & user behavior patterns', 
                    'Internal Google processes & collaboration tools'
                ];
            }

            // Enhance with resume-specific achievements
            try {
                console.log('📄 Extracting additional strengths from resume...');
                const resumeStrengths = await extractStrengthsFromResume();
                if (resumeStrengths && resumeStrengths.length > 0) {
                    strengths = Array.from(new Set([...strengths, ...resumeStrengths])).slice(0, 18);
                    console.log(`✅ Enhanced to ${strengths.length} total strengths`);
                }
            } catch (e) {
                console.log('⚠️ Could not enhance from resume');
            }

            appState.extractedData = {
                company: inferred.company || '',
                role: inferred.role || '',
                metrics,
                strengths,
                gaps,
                gapDetails: gaps.map(g => ({ title: g, reason: '', mitigation: '' })),
                candidateBackground: 'Seasoned data & analytics leader delivering quantifiable impact across retail, loyalty, and operations with 8+ years of SQL/Python experience.',
                panelists,
                panelistQuestions,
                questions: questions,
                stories: stories,
                strategicQuestions: strategicQuestions,
                companyIntel: intel.markdown,
                companyIntelSource: intel.source,
                culturalNotes: `**Google Play Cultural Intelligence & Fit Signals:**

**🎯 Core Values Alignment:**
• **"Year of Efficiency"**: Emphasize automation, optimization, and scalable solutions (tie to your 80% manual effort reduction, 95% query performance improvements)
• **Data-Driven Decision Making**: Reference specific metrics and A/B testing methodologies from your experience
• **Cross-Functional Collaboration**: Highlight experience with C-suite, engineering, and product teams (200+ stakeholders trained)
• **User-Centric Innovation**: Connect Play Points member experience to your customer segmentation work (220M+ members parallel)

**🏢 Google-Specific Context Signals:**
• **Scale Comfort**: "I've successfully processed 500M+ records at Home Depot, positioning me well for Play Store's billions of daily transactions"
• **BigQuery Native**: "My BigQuery optimization experience reducing 10min → 30sec queries directly applies to Play Points analytics infrastructure"
• **AI/ML Ready**: "Excited about the 6-12 month AI/ML integration timeline - my clustering experience provides immediate value"
• **Contractor Excellence**: "I understand delivering exceptional value as a Scalence contractor while integrating seamlessly with Google teams"

**💬 Cultural Conversation Starters:**
• "What aspects of the Year of Efficiency initiative excite the team most?"
• "How does the Play Points team balance rapid experimentation with data rigor?"
• "I'm curious about the cross-functional dynamics between Product and Engineering on Play Points features"
• "What opportunities do you see for BigQuery optimization in the current Play Points infrastructure?"

**🚫 Cultural Pitfalls to Avoid:**
• Don't oversell - Google values humble confidence
• Avoid startup mentality references - emphasize enterprise scale thinking
• Don't criticize previous tools/approaches - focus on optimization opportunities
• Avoid generic answers - always tie back to Play Points context (220M members, tier progression, $11.63B ecosystem)

**📊 Metrics That Resonate:**
• Scale: 500M+ records, 100M+ daily processing, 220M+ members
• Efficiency: 95% performance improvement, 80% manual reduction
• Impact: $43M revenue impact, 12% retention improvement
• Adoption: 30% dashboard increase, 200+ stakeholders
• ROI: 2100% analytics investment return`
            };

            updateDashboard();
            showToast('Data loaded from input_files.', 'success');
            switchTab('command');
        }

        // AI Generation Functions (Mock implementations)
        async function generatePowerIntro() {
            const introDiv = document.getElementById('powerIntro');
            const company = appState.extractedData.company || '';
            const role = appState.extractedData.role || '';
            const metrics = appState.extractedData.metrics || [];
            const strengths = appState.extractedData.strengths || [];
            const tech = deriveTechStack(getCombinedContent());
            const m1 = metrics[0] ? `${metrics[0].value} ${metrics[0].label}` : '';
            const m2 = metrics[1] ? `${metrics[1].value} ${metrics[1].label}` : '';
            const s1 = strengths[0] || '';
            const s2 = strengths[1] || '';
            const t1 = tech[0] || '';
            const t2 = tech[1] || '';

            const hookRole = (company || role) ? `${company ? company + ' ' : ''}${role || 'role'}` : 'this role';
            const proofBullets = [m1, m2, s1, s2].filter(Boolean).slice(0,3).map(x=>`• ${x}`).join('<br>');
            const stackLine = [t1,t2].filter(Boolean).join(', ');

            introDiv.innerHTML = `
                <div style="padding: 2rem; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 0.75rem; border-left: 4px solid #0ea5e9;">
                    <div style="display: flex; align-items: center; margin-bottom: 1rem;">
                        <h3 style="color: #1e293b; margin: 0; margin-right: 0.5rem;">🎯 Strategic Opening Hook</h3>
                        ${aiBadge()}
                    </div>
                    <div style="background: white; padding: 1.5rem; border-radius: 0.5rem; margin-bottom: 1rem;">
                        <h4 style="color: #0ea5e9; margin-bottom: 1rem;">💼 Your 90-Second Power Hook</h4>
                        <p style="line-height: 1.6; font-size: 1rem;"><strong>"Thank you for the opportunity to discuss ${hookRole}.</strong></p>
                        <p style="line-height: 1.6; margin-top: 1rem;">I focus on measurable outcomes with a strong foundation in ${stackLine || 'modern analytics'} and rigorous SQL. Recently, I've delivered:</p>
                        <p style="line-height: 1.6; margin-top: 0.5rem;">${proofBullets || '• Quantified business impact<br>• Performance and cost improvements<br>• Clear communication with stakeholders'}</p>
                        <p style="line-height: 1.6; margin-top: 1rem;">I'm excited to apply this approach to your team's priorities—partnering cross-functionally, validating assumptions with data, and moving quickly while keeping quality high."</p>
                        <p style="line-height: 1.6; margin-top: 1rem; font-style: italic; color: #64748b;"><strong>Duration: ~90 seconds | Metrics-driven | Role-focused</strong></p>
                    </div>
                    <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 1rem; border-radius: 0.5rem;">
                        <h4 style="color: white; margin-bottom: 0.75rem;">🚀 Opening Impact Framework</h4>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div>
                                <strong>Hook (15s):</strong> Context + focus<br>
                                <strong>Proof (45s):</strong> 2–3 quantified outcomes<br>
                                <strong>Bridge (25s):</strong> Align to team priorities
                            </div>
                            <div>
                                <strong>Key Numbers:</strong> ${m1 || '—'} ${m2 ? ' | ' + m2 : ''}<br>
                                <strong>Tech:</strong> ${stackLine || '—'}<br>
                                <strong>Style:</strong> Clear, measurable, collaborative
                            </div>
                        </div>
                    </div>
                </div>`;
            showToast('Power intro generated from your materials!', 'success');
        }

        async function generateTalkingPoints() {
            const pointsDiv = document.getElementById('talkingPoints');
            const strengths = appState.extractedData.strengths || [];
            const gaps = appState.extractedData.gaps || [];
            const metrics = appState.extractedData.metrics || [];
            const tech = deriveTechStack(getCombinedContent());
            const techList = tech.slice(0,6).map(t=>`<li>${t}</li>`).join('') || '<li>Add more materials to detect tech stack</li>';
            const strengthList = strengths.slice(0,6).map(s=>`<li>${s}</li>`).join('') || '<li>Add strengths in your materials</li>';
            const metricList = metrics.slice(0,4).map(m=>`<li><strong>${m.value}</strong> — ${m.label}</li>`).join('') || '<li>Provide a metrics CSV or include metrics in your docs</li>';
            const diffList = [
                'Outcome-first storytelling with metrics',
                'Cross-functional collaboration with clear trade-offs',
                'Data rigor with practical cost/perf validation'
            ].map(d=>`<div>• ${d}</div>`).join('');
            pointsDiv.innerHTML = `
                <div style="padding: 2rem; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 0.75rem; border-left: 4px solid #22c55e;">
                    <div style="display: flex; align-items: center; margin-bottom: 1rem;">
                        <h3 style="color: #1e293b; margin: 0; margin-right: 0.5rem;">🎯 Strategic Talking Points</h3>
                        ${aiBadge()}
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                        <div style="background: white; padding: 1.5rem; border-radius: 0.5rem;">
                            <h4 style="color: #22c55e; margin-bottom: 1rem;">⚙️ Technical Relevance</h4>
                            <ul style="line-height: 1.8; margin: 0; padding-left: 1rem;">${techList}</ul>
                        </div>
                        <div style="background: white; padding: 1.5rem; border-radius: 0.5rem;">
                            <h4 style="color: #3b82f6; margin-bottom: 1rem;">📊 Proof Points</h4>
                            <ul style="line-height: 1.8; margin: 0; padding-left: 1rem;">${metricList}</ul>
                        </div>
                    </div>
                    <div style="background: white; padding: 1.5rem; border-radius: 0.5rem; margin-top: 1.5rem;">
                        <h4 style="color: #8b5cf6; margin-bottom: 1rem;">✅ Strengths To Emphasize</h4>
                        <ul style="line-height: 1.8; margin: 0; padding-left: 1rem;">${strengthList}</ul>
                    </div>
                    <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 1rem; border-radius: 0.5rem; margin-top: 1.5rem;">
                        <h4 style="color: white; margin-bottom: 0.75rem;">💡 Differentiators</h4>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">${diffList}</div>
                    </div>
                </div>`;
            showToast('Talking points generated from your materials!', 'success');
        }

        async function generateGapStrategies() {
            const gapsList = document.getElementById('gapsList');
            if (!gapsList) return;

            const gapDetails = Array.isArray(appState.extractedData.gapDetails) ? appState.extractedData.gapDetails : [];
            if (!gapDetails.length) {
                gapsList.innerHTML = '<p style="color:#64748b;">No gaps identified yet. Upload more context or rerun extraction.</p>';
                showToast('No gaps detected to generate strategies.', 'warning');
                return;
            }

            gapsList.innerHTML = gapDetails.map(detail => {
                const reason = detail.reason ? `<div style=\"font-size:0.85rem; color:#64748b; margin-bottom:0.5rem;\">${detail.reason}</div>` : '';
                const mitigation = detail.mitigation ? detail.mitigation : 'Outline how you will ramp up and tie a transferable win to this area.';
                return `
                    <div style="margin-top: 0.75rem; padding: 1rem; background: #fef3c7; border-radius: 0.5rem; border-left: 4px solid #0ea5e9;">
                        <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem;">${aiBadge()}<strong>${detail.title}</strong></div>
                        ${reason}
                        <div style="font-size:0.85rem; color:#0f172a;"><strong>Plan:</strong> ${mitigation}</div>
                    </div>`;
            }).join('');

            showToast('Gap strategies generated from your materials!', 'success');
        }

        async function generateCulturalAnalysis() {
            const culturalDiv = document.getElementById('culturalFit');
            if (!culturalDiv) return;

            const text = getCombinedContent();
            const company = cleanCompanyDisplayName(appState.extractedData.company || '');
            const role = cleanRoleTitle(appState.extractedData.role || '');
            const tech = deriveTechStack(text).slice(0, 8);
            const metrics = appState.extractedData.metrics || [];
            const panelists = appState.extractedData.panelists || [];

            // Try LLM-driven cultural summary first if enabled
            try {
                if (window.__LLM_ENABLED__) {
                    const llm = await llmExtract('culture', text);
                    if (llm && (llm.values?.length || llm.signals?.length || llm.workMode || llm.benefits?.length)) {
                        const panelistList = panelists.map(p => `${p.name}${p.role?` — ${p.role}`:''}`).join('<br>') || 'Derived from JD when available';
                        const html = `
                            <div>
                                <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.75rem;">${aiBadge()}<h4 style="margin:0; color:#0ea5e9;">Cultural Fit Signals${company?` — ${company}`:''}</h4></div>
                                ${llm.workMode ? `<div style=\"background:#f0fdf4; padding:1rem; border-radius:0.5rem; margin-bottom:1rem;\"><strong>Work Style:</strong> ${llm.workMode}${llm.officeDays?` (${llm.officeDays})`:''}</div>` : ''}
                                <div class="grid grid-2" style="gap:1rem;">
                                    <div style="background:#eff6ff; padding:1rem; border-radius:0.5rem;">
                                        <h5 style="margin:0 0 0.5rem 0; color:#2563eb;">What They Value</h5>
                                        <ul style="margin:0; padding-left:1rem;">${(llm.values||[]).map(v=>`<li>${v}</li>`).join('') || '<li>Collaboration</li><li>Data-driven decisions</li>'}</ul>
                                    </div>
                                    <div style="background:#f8fafc; padding:1rem; border-radius:0.5rem;">
                                        <h5 style="margin:0 0 0.5rem 0; color:#0ea5e9;">Signals To Emphasize</h5>
                                        <ul style="margin:0; padding-left:1rem;">${(llm.signals||[]).map(s=>`<li>${s}</li>`).join('') || '<li>Outcome-first stories</li><li>Partnering across functions</li>'}</ul>
                                    </div>
                                </div>
                                <div style="background:#f3e8ff; padding:1rem; border-radius:0.5rem; margin-top:1rem;">
                                    <h5 style="margin:0 0 0.5rem 0; color:#7c3aed;">Panelist Context</h5>
                                    <div style="font-size:0.95rem;">${panelistList}</div>
                                </div>
                                ${(llm.benefits||[]).length ? `<div style=\"background:#fff7ed; padding:1rem; border-radius:0.5rem; margin-top:1rem;\"><h5 style=\"margin:0 0 0.5rem 0; color:#f59e0b;\">Benefits Signals</h5><div>${(llm.benefits||[]).join(' · ')}</div></div>` : ''}
                            </div>`;
                        culturalDiv.innerHTML = html;
                        appState.extractedData.culturalNotes = html;
                        showToast('Cultural fit analysis generated (LLM-assisted)', 'success');
                        return;
                    }
                }
            } catch (e) { /* ignore */ }

            // Work mode and pace
            const workMode = (/hybrid/i.test(text) ? 'Hybrid' : /remote/i.test(text) ? 'Remote' : /on\s*site|onsite/i.test(text) ? 'Onsite' : '—');
            const officeDays = (text.match(/(\d)\s*(?:days|day)\s*\/\s*week\s*in\s*office/i) || [])[1] || '';
            const pace = (/fast[-\s]?paced|rapid(ly)?\s+growing|high\s+visibility/i.test(text) ? 'Fast-paced, high-visibility' : 'Balanced, outcomes-focused');

            // Values/behaviors from text
            const values = [];
            if (/collaborat/i.test(text) || /cross[-\s]?functional/i.test(text)) values.push('Collaboration with cross-functional partners');
            if (/data[-\s]?driven|evidence|metrics/i.test(text)) values.push('Data-driven decision making');
            if (/customer|user[-\s]?centric/i.test(text)) values.push('Customer- and user-centric thinking');
            if (/ownership|accountab/i.test(text)) values.push('Ownership and accountability');
            if (/innovation|continuous\s+improve|kaizen|six\s*sigma/i.test(text)) values.push('Continuous improvement and innovation');
            if (/communication|present/i.test(text)) values.push('Clear communication with executives');

            // Benefits/comp signals (best-effort)
            const benefits = [];
            if (/health|dental|vision/i.test(text)) benefits.push('Health/Dental/Vision');
            if (/bonus/i.test(text)) benefits.push('Annual Bonus');
            if (/pto|paid\s+time\s+off|vacation/i.test(text)) benefits.push('PTO / Vacation');
            if (/holiday/i.test(text)) benefits.push('Paid Holidays');

            // Signals to emphasize based on tech/metrics/panelists
            const signals = [];
            if (tech.includes('SQL')) signals.push('Rigor with SQL and data validation');
            if (tech.includes('Power BI') || tech.includes('Tableau') || tech.includes('Looker')) signals.push('Clarity in dashboard storytelling');
            if (/BigQuery|Snowflake|Redshift/i.test(text)) signals.push('Scalable analytics on modern cloud DW');
            if (metrics.length) signals.push(`Outcome orientation (e.g., ${metrics[0].value} ${metrics[0].label})`);
            if (panelists.some(p=>/CIO|Chief|Director/i.test(p.role||''))) signals.push('Executive-ready communication');

            const panelistList = panelists.map(p => `${p.name}${p.role?` — ${p.role}`:''}`).join('<br>') || 'Derived from JD when available';

            const html = `
                <div>
                    <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.75rem;">${aiBadge()}<h4 style="margin:0; color:#0ea5e9;">Cultural Fit Signals${company?` — ${company}`:''}</h4></div>
                    <div style="background:#f0fdf4; padding:1rem; border-radius:0.5rem; margin-bottom:1rem;">
                        <strong>Work Style:</strong> ${workMode}${officeDays?` (${officeDays} days/week in office)`:''} · ${pace}
                    </div>
                    <div class="grid grid-2" style="gap:1rem;">
                        <div style="background:#eff6ff; padding:1rem; border-radius:0.5rem;">
                            <h5 style="margin:0 0 0.5rem 0; color:#2563eb;">What They Value</h5>
                            <ul style="margin:0; padding-left:1rem;">
                                ${(values.length?values:['Collaboration','Data-driven decisions','Clear communication']).map(v=>`<li>${v}</li>`).join('')}
                            </ul>
                        </div>
                        <div style="background:#f8fafc; padding:1rem; border-radius:0.5rem;">
                            <h5 style="margin:0 0 0.5rem 0; color:#0ea5e9;">Signals To Emphasize</h5>
                            <ul style="margin:0; padding-left:1rem;">
                                ${(signals.length?signals:['Outcome-first stories with numbers','Partnering across functions','Speed with quality']).map(s=>`<li>${s}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                    <div style="background:#f3e8ff; padding:1rem; border-radius:0.5rem; margin-top:1rem;">
                        <h5 style="margin:0 0 0.5rem 0; color:#7c3aed;">Panelist Context</h5>
                        <div style="font-size:0.95rem;">${panelistList}</div>
                    </div>
                    ${benefits.length ? `<div style=\"background:#fff7ed; padding:1rem; border-radius:0.5rem; margin-top:1rem;\"><h5 style=\"margin:0 0 0.5rem 0; color:#f59e0b;\">Benefits Signals</h5><div>${benefits.join(' · ')}</div></div>` : ''}
                </div>`;

            culturalDiv.innerHTML = html;
            appState.extractedData.culturalNotes = html;
            showToast('Cultural fit analysis generated from your files!', 'success');
        }

        async function generatePanelistQuestion(name) {
            const questionDiv = document.getElementById(`question-${name.replace(/\s/g, '-')}`);

            // First try to get strategic questions I should ask them from Q&A Bank
            let questions = appState.extractedData.strategicQuestions?.[name];
            let questionSource = 'STRATEGIC QUESTIONS FROM Q&A BANK';
            let borderColor = '#22c55e';

            // If no strategic questions exist for this panelist, fallback to role-appropriate strategic questions
            if (!questions || questions.length === 0) {
                // Generate strategic questions based on their role
                if (name.includes('Nikki') || name.includes('Service Delivery')) {
                    questions = [
                        'What strategies work best when Product, Engineering, and Marketing have conflicting priorities?',
                        'How does your team balance global metrics with local market insights?',
                        'What upcoming AI initiatives are planned for Play Points in the next 6-12 months?'
                    ];
                } else if (name.includes('Brian') || name.includes('Associate Director')) {
                    questions = [
                        'How does the team balance technical debt with rapid feature development?',
                        'What role do contractors typically play in driving strategic initiatives?',
                        'What are the biggest technical challenges with 220M+ member data processing?'
                    ];
                } else if (name.includes('Jolly') || name.includes('Recruiter')) {
                    questions = [
                        'What typically drives contractor-to-FTE conversion decisions?',
                        'What makes successful contractors stand out in your experience?',
                        'What\'s the typical timeline for FTE transitions in analytics teams?'
                    ];
                } else {
                    questions = [
                        'What aspects of this role do you find most exciting?',
                        'How would you describe the team culture and collaboration style?',
                        'What growth opportunities exist for this position?'
                    ];
                }
                questionSource = 'STRATEGIC QUESTIONS (FALLBACK)';
                borderColor = '#fbbf24';
            }
            
            // Randomly select a question
            const randomIndex = Math.floor(Math.random() * questions.length);
            const selectedQuestion = questions[randomIndex];

            questionDiv.innerHTML = `
                <div style="padding: 1rem; background: white; border-radius: 0.5rem; border-left: 4px solid ${borderColor};">
                    <div style="display: flex; align-items: center; margin-bottom: 0.5rem;">
                        ${questionSource.includes('Q&A BANK') ? '<span class="source-note">From Q&A Bank Strategic Questions</span>' : ''}
                        ${questionSource.includes('FALLBACK') ? '<span class="source-note">Strategic Question (Fallback)</span>' : ''}
                    </div>
                    <strong>Strategic Question to Ask ${name}:</strong> "${selectedQuestion}"
                </div>
            `;

            const sourceMessage = questionSource.includes('Q&A BANK') ? 'Strategic question from Q&A Bank loaded!' : 
                                questionSource.includes('FALLBACK') ? 'Strategic question generated for this interviewer!' : 
                                'Strategic question ready!';
            showToast(sourceMessage, 'success');
        }

        async function generateMoreQuestions() {
            // Initialize with comprehensive questions if empty
            if (!appState.extractedData.questions || appState.extractedData.questions.length === 0) {
                appState.extractedData.questions = [];
                populateDetailedQuestions();
                return;
            }
            
            // Generate additional AI questions based on Google Play context
            const newQuestions = [
                { 
                    question: 'How would you support the upcoming AI/ML integration for Play Points personalization?', 
                    answer: 'Focus: BigQuery ML capabilities, real-time pipelines, A/B testing framework • Use STAR: ML implementation at Trulieve improving acquisition 12% • Prepare for: Model monitoring, feature engineering, ethical AI considerations',
                    category: 'technical',
                    interviewer: 'brian',
                    difficulty: 'hard',
                    starStory: 'At Trulieve, similar ML clustering initiatives drove $3.2M annual revenue increase through personalized customer segments.',
                    metrics: '• $3.2M revenue impact<br>• 12% acquisition improvement<br>• 8 distinct member personas<br>• BigQuery ML implementation',
                    aiGenerated: true 
                },
                { 
                    question: 'We need real-time dashboards for 200+ stakeholders. How would you approach this?', 
                    answer: 'Focus: Role-based design, caching strategies, self-service capabilities • Use STAR: Home Depot dashboard adoption success (30% increase) • Prepare for: Performance optimization, user training, maintenance',
                    category: 'situational',
                    interviewer: 'nikki', 
                    difficulty: 'medium',
                    starStory: 'From training 50+ users at Home Depot and achieving 30% adoption increase through stakeholder segmentation and targeted training.',
                    metrics: '• 200+ stakeholders<br>• 30% adoption increase<br>• 50+ training sessions<br>• Role-based dashboard design',
                    aiGenerated: true 
                },
                { 
                    question: 'How do you ensure data quality when working with 220+ million Play Points members?', 
                    answer: 'Focus: Automated validation, anomaly detection, data lineage • Use STAR: Home Depot data quality framework with 500M+ SKUs • Prepare for: Data governance, quality metrics, remediation processes',
                    category: 'technical',
                    interviewer: 'brian',
                    difficulty: 'medium', 
                    starStory: 'At Home Depot, I built automated data quality checks for 500M+ SKU records, reducing data inconsistencies by 80% and preventing downstream analytical errors.',
                    metrics: '• 500M+ records monitored<br>• 80% inconsistency reduction<br>• Automated validation rules<br>• Real-time anomaly detection',
                    aiGenerated: true 
                }
            ];
            
            appState.extractedData.questions.push(...newQuestions);
            updateQuestionList();
            showToast('Enhanced AI questions generated!', 'success');
        }

        // Populate detailed questions from prep materials
        function populateDetailedQuestions() {
            const detailedQuestions = [
                {
                    question: "How would you design a data mart for Google Play Points tier progression analytics?",
                    category: "technical",
                    difficulty: "hard",
                    interviewer: "nikki",
                    priority: "high",
                    quickAnswer: "Star schema with member_fact at center, partitioned by date, clustered by member_id and tier_level for optimal BigQuery performance.",
                    answer: "I'd create a **star schema** with member_fact at the center, dimension tables for tiers, time, geography, and redemption types. Using **BigQuery's partitioning by date** and **clustering by member_id and tier_level** for optimal query performance with 220M+ members.",
                    starStory: "At Trulieve, I designed a star-schema warehouse processing 100M+ daily records. This reduced query time from 10 minutes to 30 seconds at Home Depot using similar BigQuery optimization.",
                    metrics: "• 220M+ members globally<br>• 5 tier levels (Bronze → Silver → Gold → Platinum → Diamond)<br>• Query performance: 10min → 30sec improvement",
                    followUps: "• How would you handle real-time vs batch processing?<br>• What about data quality validation?<br>• How would you scale for international markets?",
                    googleApplication: "For Play Points, I'd implement similar partitioning strategies for 220M member transactions, using clustering on member_id and tier_level for optimal query performance."
                },
                {
                    question: "Walk me through investigating a sudden spike in Play Points churn rate",
                    category: "situational", 
                    difficulty: "medium",
                    interviewer: "nikki",
                    priority: "high",
                    quickAnswer: "Segment by tier level, cohort, geography using BigQuery CTEs. Compare pre/post spike behaviors, check external factors, build predictive model.",
                    answer: "I'd use a systematic approach: **1) Cohort analysis** using window functions, **2) Segment identification** (specific tiers, regions), **3) External factor examination** (policy changes, technical issues), **4) Predictive modeling** for at-risk members.",
                    starStory: "Similar to my Trulieve customer retention analysis that improved metrics by 12%, I built cohort analyses that recovered $3.2M in annual revenue by identifying at-risk customer segments.",
                    metrics: "• 15% churn spike target<br>• Gold tier members focus (600-2,999 pts)<br>• 30-day inactive threshold<br>• Expected 2-hour root cause identification",
                    followUps: "• What if the cause is external (competitor launch)?<br>• How would you prioritize which segments to address first?<br>• What intervention strategies would you recommend?",
                    googleApplication: "With Play Points' 220M members, I'd focus on the Gold→Platinum transition gap where the 5x point jump (2,999 to 3,000+) creates the highest churn risk."
                },
                {
                    question: "How would you optimize a slow BigQuery query processing billions of Play Store transactions?",
                    category: "technical",
                    difficulty: "hard", 
                    interviewer: "brian",
                    quickAnswer: "PARTITION BY DATE for time-series, CLUSTER BY frequently filtered columns, replace subqueries with CTEs, use materialized views.",
                    answer: "**Optimization strategy:** 1) **PARTITION BY DATE(transaction_date)** for time-series queries, 2) **CLUSTER BY member_id, tier_level** for member-focused queries, 3) **Replace nested subqueries with CTEs**, 4) **Materialized views** for dashboard aggregations, 5) **APPROX functions** for large-scale estimates.",
                    starStory: "At Home Depot, I optimized queries from 10 minutes to 30 seconds processing 500M+ SKU records by implementing proper partitioning, clustering, and converting nested subqueries to CTEs. This 95% performance improvement saved 1,040+ hours annually.",
                    metrics: "• 500M+ records processed<br>• 95% performance improvement (10min → 30sec)<br>• 1,040+ hours annual savings<br>• 80% reduction in manual effort",
                    followUps: "• How do you balance query performance vs storage costs?<br>• What about handling schema evolution?<br>• How would you monitor query performance over time?",
                    googleApplication: "For Play Points queries handling 220M+ members, I'd prioritize partitioning and clustering strategies, using APPROX_COUNT_DISTINCT for member estimates and materialized views for real-time dashboard performance."
                },
                {
                    question: "Google Play Points has stagnant Gold-to-Platinum progression. How would you diagnose and fix this?",
                    category: "situational",
                    difficulty: "medium",
                    interviewer: "nikki", 
                    priority: "high",
                    quickAnswer: "Analyze point-earning velocity by cohort, identify high-potential Gold members (70-80% toward threshold), design targeted interventions.",
                    answer: "**Diagnosis approach:** 1) **Cohort analysis** of Gold members' point-earning velocity, 2) **Identify high-potential segments** (70-80% toward Platinum threshold), 3) **A/B test interventions** (bonus events, progressive challenges), 4) **Monitor progression velocity** and ROI.",
                    starStory: "Based on my customer segmentation work improving retention 12% at Trulieve, I'd apply similar clustering techniques to identify Gold members losing momentum and design targeted interventions.",
                    metrics: "• Gold: 600-2,999 points (5x jump to Platinum)<br>• Target: 15-20% increase in Platinum progression<br>• Expected: $2-3M additional revenue<br>• Timeline: 6 months for results",
                    followUps: "• What if the 3,000 point threshold is fundamentally too high?<br>• How would you measure intervention success?<br>• What about international market variations?",
                    googleApplication: "I'd leverage BigQuery ML's K-Means clustering to segment Gold members by earning velocity, redemption patterns, and engagement frequency, focusing on the critical 2,500+ point range where members approach the Platinum threshold."
                },
                {
                    question: "Describe managing conflicting priorities between Product and Marketing teams",
                    category: "behavioral",
                    difficulty: "medium",
                    interviewer: "nikki",
                    quickAnswer: "Facilitate alignment workshops, document unified metrics definitions, propose primary KPIs with team-specific drill-downs.",
                    answer: "I focus on **finding common ground** through data. I facilitate workshops to align on shared objectives, document calculation methodologies, and create dashboards that serve both teams' needs while maintaining data consistency.",
                    starStory: "**Situation:** At Home Depot, supply chain and finance defined 'inventory turnover' differently. **Task:** Align both teams on unified metrics for Tableau dashboards. **Action:** Facilitated workshops, documented calculations, proposed primary metric with team-specific drill-downs. **Result:** Achieved consensus in 2 weeks, 30% adoption increase due to trust in data.",
                    metrics: "• 2 weeks to consensus<br>• 30% dashboard adoption increase<br>• Eliminated conflicting reports<br>• Single source of truth established",
                    followUps: "• What if teams fundamentally disagree on business priorities?<br>• How do you maintain alignment over time?<br>• What role does executive sponsorship play?",
                    googleApplication: "This experience directly applies to aligning Product, Engineering, and Marketing teams on Play Points KPIs, ensuring consistent definitions for member progression, engagement, and retention metrics."
                },
                {
                    question: "Why should we hire you over someone with more Google/tech industry experience?",
                    category: "company",
                    difficulty: "medium",
                    interviewer: "brian",
                    quickAnswer: "Proven scale experience (500M+ records), rapid learning ability, fresh perspective from diverse industries, immediate impact focus.",
                    answer: "**Three key advantages:** 1) **Scale experience** - I'm already working with Google-level data volumes (500M+ records), 2) **Diverse industry perspective** - My cannabis, retail, and logistics experience brings fresh approaches to loyalty program challenges, 3) **Proven rapid learning** - I've successfully adapted to new tech stacks and delivered results within 90 days.",
                    starStory: "My cross-industry experience actually accelerated success. At Trulieve, I applied Home Depot's inventory optimization techniques to cannabis retail, improving customer retention 12% in 90 days. This pattern of cross-pollinating solutions would benefit Play Points analytics.",
                    metrics: "• 500M+ records processing experience<br>• 12% retention improvement in 90 days<br>• $3.2M revenue impact<br>• 95% query performance improvement",
                    followUps: "• How would you adapt to Google's specific tech stack?<br>• What's your learning approach for new technologies?<br>• How do you stay current with industry trends?",
                    googleApplication: "My diverse background means I can approach Play Points challenges without industry assumptions, potentially identifying optimization opportunities that pure tech-industry experience might overlook."
                }
            ];
            
            appState.extractedData.questions = detailedQuestions;
            updateQuestionList();
        }

        async function generateSQLChallenge() {
            const challengeDiv = document.getElementById('sqlChallenge');
            challengeDiv.innerHTML = `
                <div style="padding: 1rem; background: #f8fafc; border-radius: 0.5rem; border-left: 4px solid #0ea5e9;">
                    <div style="display: flex; align-items: center; margin-bottom: 0.5rem;">${aiBadge()}</div>
                    <strong>Challenge:</strong> Find top 5 categories by revenue (last 30 days)
                    <br><br>
                    <strong>Requirements:</strong>
                    <ul>
                        <li>• Use window functions</li>
                        <li>• Include unique users</li>
                        <li>• Calculate average transaction</li>
                    </ul>
                </div>
            `;
            showToast('Challenge generated!', 'success');
        }

        async function optimizeSQL() {
            const query = document.getElementById('sqlQuery').value.trim();
            const feedbackDiv = document.getElementById('sqlFeedback');
            
            if (!query) {
                feedbackDiv.innerHTML = `<div style="padding: 1rem; background: #fef2f2; border-radius: 0.5rem; border-left: 4px solid #ef4444; color: #dc2626;">Please enter a query to optimize.</div>`;
                return;
            }
            
            // Advanced optimization suggestions based on Google Play scale
            const optimizations = [
                "PARTITION BY DATE(transaction_date) for time-series queries",
                "CLUSTER BY member_id, tier_level for member-focused queries", 
                "Use APPROX_COUNT_DISTINCT() for large-scale estimates (220M+ members)",
                "Replace nested subqueries with CTEs for better readability",
                "Add LIMIT clauses to prevent accidental full table scans",
                "Consider materialized views for dashboard aggregations",
                "Use STRUCT for related columns to reduce I/O"
            ];
            
            feedbackDiv.innerHTML = `
                <div style="padding: 1rem; background: #f0fdf4; border-radius: 0.5rem; border-left: 4px solid #10b981;">
                    <div style="display: flex; align-items: center; margin-bottom: 0.5rem;">${aiBadge()}</div>
                    <strong>🚀 BigQuery Optimizations for Google Play Scale:</strong>
                    <ul style="margin: 0.5rem 0; padding-left: 1rem;">
                        ${optimizations.slice(0, 4).map(opt => `<li style="margin: 0.25rem 0;">• ${opt}</li>`).join('')}
                    </ul>
                    <div style="margin-top: 1rem; padding: 0.75rem; background: #ecfdf5; border-radius: 0.375rem;">
                        <strong style="color: #059669;">💡 Pro Tip:</strong> For Play Points queries handling 220M+ members, always consider partitioning and clustering strategies first.
                    </div>
                </div>
            `;
            showToast('Query analyzed!', 'success');
        }

        // Load specific interview scenarios
        function loadScenario(scenarioType) {
            const detailsDiv = document.getElementById('scenarioDetails');
            const scenarios = {
                churn: {
                    title: "🚨 Churn Investigation: 15% Spike in Gold Tier Members",
                    context: "Nikki's scenario: 'We've noticed a 15% increase in Gold tier member churn over the past month. How would you investigate?'",
                    challenge: `WITH churn_analysis AS (
  SELECT 
    member_id,
    tier_level,
    DATE_DIFF(CURRENT_DATE(), last_activity, DAY) as days_inactive,
    points_velocity_30d / NULLIF(points_velocity_90d, 0) as velocity_decline,
    LAG(tier_level) OVER (PARTITION BY member_id ORDER BY activity_date) as previous_tier
  FROM member_activity
  WHERE tier_level = 'Gold' 
    AND DATE_DIFF(CURRENT_DATE(), last_activity, DAY) > 30
)
SELECT 
  tier_level,
  COUNT(*) as at_risk_members,
  AVG(days_inactive) as avg_inactive_days,
  COUNTIF(velocity_decline < 0.5) as declining_engagement
FROM churn_analysis
GROUP BY tier_level;`,
                    approach: [
                        "1. Segment churned vs retained Gold members",
                        "2. Analyze point earning/redemption patterns",
                        "3. Check for app store policy changes",
                        "4. Build predictive model for at-risk identification"
                    ]
                },
                progression: {
                    title: "📈 Tier Progression Analysis: Gold→Platinum Gap",
                    context: "Key business challenge: Gold members (600-2,999 pts) struggle with 5x jump to Platinum (3,000+ pts)",
                    challenge: `WITH progression_analysis AS (
  SELECT 
    member_id,
    tier_level,
    total_points,
    CASE 
      WHEN tier_level = 'Gold' AND total_points > 2500 THEN 'High_Potential'
      WHEN tier_level = 'Gold' AND total_points > 2000 THEN 'Medium_Potential'
      ELSE 'Standard'
    END as progression_segment,
    SUM(points_earned) OVER (
      PARTITION BY member_id 
      ORDER BY transaction_date 
      ROWS BETWEEN 30 PRECEDING AND CURRENT ROW
    ) as rolling_30d_velocity
  FROM play_points_members m
  JOIN play_points_transactions t ON m.member_id = t.member_id
  WHERE tier_level = 'Gold'
)
SELECT 
  progression_segment,
  COUNT(*) as member_count,
  AVG(rolling_30d_velocity) as avg_earning_velocity,
  PERCENT_RANK() OVER (ORDER BY AVG(total_points)) as percentile_rank
FROM progression_analysis
GROUP BY progression_segment;`,
                    approach: [
                        "1. Identify members 70-80% toward Platinum threshold",
                        "2. Analyze earning velocity patterns",
                        "3. Design A/B tests for intervention strategies",
                        "4. Expected outcome: 15-20% increase in Platinum progression"
                    ]
                },
                optimization: {
                    title: "⚡ Query Performance: 10min → 30sec Optimization",
                    context: "Home Depot experience: Optimized BigQuery queries processing 500M+ SKU records",
                    challenge: `-- BEFORE: Slow query
SELECT 
  m.tier_level,
  COUNT(*) as member_count,
  SUM(t.points_earned) as total_points
FROM play_points_members m
JOIN play_points_transactions t ON m.member_id = t.member_id
WHERE t.transaction_date >= '2024-01-01'
GROUP BY m.tier_level;

-- AFTER: Optimized with partitioning and clustering
CREATE TABLE play_points_fact
PARTITION BY DATE(transaction_date)
CLUSTER BY member_id, tier_level AS
SELECT 
  member_id,
  tier_level,
  transaction_date,
  points_earned,
  -- Pre-compute commonly used aggregations
  SUM(points_earned) OVER (
    PARTITION BY member_id 
    ORDER BY transaction_date
  ) as cumulative_points
FROM raw_transactions;`,
                    approach: [
                        "1. PARTITION BY DATE for time-series queries",
                        "2. CLUSTER BY frequently filtered columns", 
                        "3. Use materialized views for dashboards",
                        "4. Replace subqueries with CTEs"
                    ]
                },
                segmentation: {
                    title: "🎯 Member Behavioral Segmentation",
                    context: "Trulieve experience: Used ML clustering to improve retention 12% ($3.2M impact)",
                    challenge: `-- BigQuery ML clustering for member segmentation
CREATE OR REPLACE MODEL play_points_segments
OPTIONS(model_type='kmeans', num_clusters=8) AS
SELECT 
  -- Engagement features
  DATE_DIFF(CURRENT_DATE(), last_activity, DAY) as recency,
  AVG(points_earned) as avg_transaction_value,
  COUNT(DISTINCT DATE(transaction_date)) as frequency,
  -- Behavioral features
  COUNTIF(app_category = 'Games') / COUNT(*) as gaming_preference,
  COUNTIF(points_redeemed > 0) / COUNT(*) as redemption_rate,
  -- Tier progression velocity
  (total_points - tier_min_points) / (tier_max_points - tier_min_points) as tier_progress
FROM play_points_transactions t
JOIN play_points_members m ON t.member_id = m.member_id
WHERE transaction_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 180 DAY)
GROUP BY m.member_id, total_points, tier_min_points, tier_max_points, last_activity;`,
                    approach: [
                        "1. Extract behavioral features (RFM analysis)",
                        "2. Use BigQuery ML K-means clustering",
                        "3. Create 8 distinct member personas",
                        "4. Design persona-specific interventions"
                    ]
                }
            };
            
            const scenario = scenarios[scenarioType];
            detailsDiv.style.display = 'block';
            detailsDiv.innerHTML = `
                <div style="border-left: 4px solid #3b82f6; padding-left: 1rem;">
                    <h4 style="color: #1e40af; margin-bottom: 0.5rem;">${scenario.title}</h4>
                    <p style="color: #64748b; margin-bottom: 1rem; font-style: italic;">${scenario.context}</p>
                    
                    <div style="margin-bottom: 1rem;">
                        <strong style="color: #059669;">Approach:</strong>
                        <ul style="margin: 0.5rem 0; padding-left: 1rem; color: #374151;">
                            ${scenario.approach.map(step => `<li style="margin: 0.25rem 0;">${step}</li>`).join('')}
                        </ul>
                    </div>
                    
                    <button class="btn btn-primary" data-action="sql-copy-example" data-scenario="${scenarioType}">
                        📋 Copy SQL to Editor
                    </button>
                </div>
            `;
        }

        function copySQLExample(scenarioType) {
            const scenarios = {
                churn: `WITH churn_analysis AS (
  SELECT 
    member_id,
    tier_level,
    DATE_DIFF(CURRENT_DATE(), last_activity, DAY) as days_inactive,
    points_velocity_30d / NULLIF(points_velocity_90d, 0) as velocity_decline,
    LAG(tier_level) OVER (PARTITION BY member_id ORDER BY activity_date) as previous_tier
  FROM member_activity
  WHERE tier_level = 'Gold' 
    AND DATE_DIFF(CURRENT_DATE(), last_activity, DAY) > 30
)
SELECT 
  tier_level,
  COUNT(*) as at_risk_members,
  AVG(days_inactive) as avg_inactive_days,
  COUNTIF(velocity_decline < 0.5) as declining_engagement
FROM churn_analysis
GROUP BY tier_level;`,
                progression: `WITH progression_analysis AS (
  SELECT 
    member_id,
    tier_level,
    total_points,
    CASE 
      WHEN tier_level = 'Gold' AND total_points > 2500 THEN 'High_Potential'
      WHEN tier_level = 'Gold' AND total_points > 2000 THEN 'Medium_Potential'
      ELSE 'Standard'
    END as progression_segment,
    SUM(points_earned) OVER (
      PARTITION BY member_id 
      ORDER BY transaction_date 
      ROWS BETWEEN 30 PRECEDING AND CURRENT ROW
    ) as rolling_30d_velocity
  FROM play_points_members m
  JOIN play_points_transactions t ON m.member_id = t.member_id
  WHERE tier_level = 'Gold'
)
SELECT 
  progression_segment,
  COUNT(*) as member_count,
  AVG(rolling_30d_velocity) as avg_earning_velocity,
  PERCENT_RANK() OVER (ORDER BY AVG(total_points)) as percentile_rank
FROM progression_analysis
GROUP BY progression_segment;`,
                optimization: `-- Optimized with partitioning and clustering
CREATE TABLE play_points_fact
PARTITION BY DATE(transaction_date)
CLUSTER BY member_id, tier_level AS
SELECT 
  member_id,
  tier_level,
  transaction_date,
  points_earned,
  -- Pre-compute commonly used aggregations
  SUM(points_earned) OVER (
    PARTITION BY member_id 
    ORDER BY transaction_date
  ) as cumulative_points
FROM raw_transactions;`,
                segmentation: `-- BigQuery ML clustering for member segmentation
CREATE OR REPLACE MODEL play_points_segments
OPTIONS(model_type='kmeans', num_clusters=8) AS
SELECT 
  -- Engagement features
  DATE_DIFF(CURRENT_DATE(), last_activity, DAY) as recency,
  AVG(points_earned) as avg_transaction_value,
  COUNT(DISTINCT DATE(transaction_date)) as frequency,
  -- Behavioral features
  COUNTIF(app_category = 'Games') / COUNT(*) as gaming_preference,
  COUNTIF(points_redeemed > 0) / COUNT(*) as redemption_rate,
  -- Tier progression velocity
  (total_points - tier_min_points) / (tier_max_points - tier_min_points) as tier_progress
FROM play_points_transactions t
JOIN play_points_members m ON t.member_id = m.member_id
WHERE transaction_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 180 DAY)
GROUP BY m.member_id, total_points, tier_min_points, tier_max_points, last_activity;`
            };
            
            document.getElementById('sqlQuery').value = scenarios[scenarioType] || '';
            showToast('SQL example copied to editor!', 'success');
        }

        function validateSQLSolution() {
            const query = document.getElementById('sqlQuery').value.trim();
            const feedbackDiv = document.getElementById('sqlFeedback');
            
            if (!query) {
                feedbackDiv.innerHTML = `<div style="padding: 1rem; background: #fef2f2; border-radius: 0.5rem; border-left: 4px solid #ef4444; color: #dc2626;">Please enter a SQL query to validate.</div>`;
                return;
            }
            
            // Check for key Google Play concepts and best practices
            const checks = [
                { pattern: /WITH\s+\w+\s+AS/i, message: "✅ Uses CTEs for readability", points: 2 },
                { pattern: /PARTITION BY|CLUSTER BY/i, message: "✅ Includes partitioning/clustering", points: 3 },
                { pattern: /OVER\s*\(/i, message: "✅ Uses window functions", points: 2 },
                { pattern: /tier_level|play_points/i, message: "✅ References Google Play Points schema", points: 1 },
                { pattern: /DATE_DIFF|DATE_SUB/i, message: "✅ Proper date handling", points: 1 },
                { pattern: /COUNT|SUM|AVG/i, message: "✅ Includes aggregations", points: 1 }
            ];
            
            const passed = checks.filter(check => check.pattern.test(query));
            const totalPoints = passed.reduce((sum, check) => sum + check.points, 0);
            
            let feedback = `
                <div style="padding: 1rem; background: #f0fdf4; border-radius: 0.5rem; border-left: 4px solid #10b981;">
                    <div style="display: flex; align-items: center; margin-bottom: 0.5rem;">${aiBadge()}</div>
                    <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 1rem;">
                        <strong>📊 Solution Analysis</strong>
                        <span style="background: #059669; color: white; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.875rem;">Score: ${totalPoints}/10</span>
                    </div>
                    
                    <div style="margin-bottom: 1rem;">
                        ${passed.map(check => `<div style="color: #059669; margin: 0.25rem 0;">${check.message}</div>`).join('')}
                    </div>
            `;
            
            if (totalPoints >= 7) {
                feedback += `<div style="padding: 0.75rem; background: #dcfce7; border-radius: 0.375rem; color: #166534;">
                    <strong>🎉 Excellent!</strong> This query demonstrates strong BigQuery skills suitable for Google Play Points analytics.
                </div>`;
            } else if (totalPoints >= 4) {
                feedback += `<div style="padding: 0.75rem; background: #fef3c7; border-radius: 0.375rem; color: #92400e;">
                    <strong>👍 Good!</strong> Consider adding window functions and partitioning for Google scale.
                </div>`;
            } else {
                feedback += `<div style="padding: 0.75rem; background: #fee2e2; border-radius: 0.375rem; color: #991b1b;">
                    <strong>💡 Needs improvement:</strong> Add CTEs, window functions, and proper BigQuery optimization techniques.
                </div>`;
            }
            
            feedback += '</div>';
            feedbackDiv.innerHTML = feedback;
            showToast('Solution validated!', 'success');
        }

        function showExampleSolutions() {
            const examplesDiv = document.getElementById('exampleSolutions');
            const isVisible = examplesDiv.style.display !== 'none';
            
            if (isVisible) {
                examplesDiv.style.display = 'none';
                return;
            }
            
            examplesDiv.style.display = 'block';
            examplesDiv.innerHTML = `
                <div style="background: #1e293b; color: #f1f5f9; padding: 1rem; border-radius: 0.5rem; font-family: 'Courier New', monospace; font-size: 0.875rem;">
                    <div style="color: #10b981; margin-bottom: 0.5rem;">-- Example: Member Tier Progression Analysis</div>
                    <div style="color: #64748b;">WITH tier_transitions AS (</div>
                    <div style="padding-left: 1rem;">
                        <div>member_id,</div>
                        <div>current_tier,</div>
                        <div style="color: #fbbf24;">LAG(tier_level) OVER (</div>
                        <div style="padding-left: 1rem; color: #fbbf24;">PARTITION BY member_id ORDER BY tier_change_date</div>
                        <div style="color: #fbbf24;">) as previous_tier,</div>
                        <div>tier_change_date</div>
                    </div>
                    <div style="color: #64748b;">FROM member_tier_history</div>
                    <div style="color: #64748b;">WHERE tier_change_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)</div>
                    <div style="color: #64748b;">)</div>
                    <div style="margin: 0.5rem 0; color: #64748b;">SELECT</div>
                    <div style="padding-left: 1rem;">
                        <div>CONCAT(previous_tier, ' → ', current_tier) as transition,</div>
                        <div>COUNT(*) as transition_count,</div>
                        <div style="color: #fbbf24;">PERCENT_RANK() OVER (ORDER BY COUNT(*)) as transition_percentile</div>
                    </div>
                    <div style="color: #64748b;">FROM tier_transitions</div>
                    <div style="color: #64748b;">WHERE previous_tier IS NOT NULL</div>
                    <div style="color: #64748b;">GROUP BY previous_tier, current_tier;</div>
                </div>
                
                <button class="btn btn-secondary" style="width: 100%; margin-top: 0.5rem;" data-action="sql-copy-example" data-scenario="example1">
                    📋 Copy This Example
                </button>
            `;
        }

        async function generateRebuttal() {
            const question = document.getElementById('toughQuestion').value.trim();
            const strategyDiv = document.getElementById('rebuttalStrategy');
            
            if (!question) {
                showToast('Please enter a tough interview question first', 'warning');
                return;
            }
            
            // Extract actual strengths and stories from loaded content
            const loadedStories = appState.extractedData.stories || [];
            const loadedStrengths = appState.extractedData.strengths || [];
            const companyIntel = appState.extractedData.companyIntel || '';
            
            // Build dynamic strengths from actual STAR stories and loaded content
            const yourStrengths = {
                scale: loadedStories.find(s => s.title?.includes('BigQuery') || s.title?.includes('Scale'))?.result || '500M+ SKU records at Home Depot, 100M+ daily transactions at Trulieve',
                impact: loadedStories.find(s => s.result?.includes('$') || s.result?.includes('%'))?.result?.match(/(\$[\d.]+[MK]|\d+%[^,]*)/g)?.join(', ') || '$3.2M retention improvement, 12% customer acquisition',
                technical: loadedStories.find(s => s.title?.includes('BigQuery') || s.title?.includes('SQL'))?.result || '95% query optimization (10min→30sec), 99.9% pipeline uptime',
                stakeholders: loadedStories.find(s => s.title?.includes('Dashboard') || s.title?.includes('Stakeholder'))?.result || '200+ stakeholders enabled, C-level presentations, 30% adoption increase',
                skills: loadedStrengths.slice(0, 3).join(', ') || '8+ years advanced SQL, Snowflake/cloud expertise, statistical analysis'
            };
            
            // Analyze question for key concerns and craft intelligent response
            const questionLower = question.toLowerCase();
            let strategy = '';
            let approach = '';
            let evidence = '';
            let bridge = '';
            let counterPoints = [];
            
            // Deep analysis of question intent
            const concerns = {
                experience: questionLower.includes('experience') || questionLower.includes('years') || questionLower.includes('senior'),
                industry: questionLower.includes('industry') || questionLower.includes('tech') || questionLower.includes('google') || questionLower.includes('platform'),
                technical: questionLower.includes('bigquery') || questionLower.includes('gcp') || questionLower.includes('technical') || questionLower.includes('sql'),
                scale: questionLower.includes('scale') || questionLower.includes('billion') || questionLower.includes('performance'),
                team: questionLower.includes('team') || questionLower.includes('collaborate') || questionLower.includes('stakeholder'),
                culture: questionLower.includes('culture') || questionLower.includes('fit') || questionLower.includes('google'),
                contractor: questionLower.includes('contractor') || questionLower.includes('permanent') || questionLower.includes('fte'),
                gap: questionLower.includes('weakness') || questionLower.includes('gap') || questionLower.includes('lack') || questionLower.includes('without'),
                competition: questionLower.includes('other') || questionLower.includes('candidate') || questionLower.includes('why you') || questionLower.includes('instead'),
                failure: questionLower.includes('fail') || questionLower.includes('mistake') || questionLower.includes('wrong') || questionLower.includes('difficult')
            };
            
            // Count concerns to understand question complexity
            const concernCount = Object.values(concerns).filter(v => v).length;
            
            // Multi-layered response based on concerns
            if (concerns.industry && (concerns.experience || concerns.gap)) {
                approach = 'Reframe industry difference as advantage + prove transferable value';
                evidence = `${yourStrengths.scale} matching Google scale`;
                bridge = 'Analytics challenges are universal at scale - member segmentation = customer segmentation';
                counterPoints = [
                    'Fresh perspective valuable for Year of Efficiency initiatives',
                    'Cross-industry best practices bring innovation',
                    'Retail/healthcare analytics complexity rivals tech platforms'
                ];
                strategy = `**"That's a fair observation about my non-tech background. However, I see this as a strategic advantage for three reasons: First, I've already solved Google-scale problems - optimizing 500M+ SKU records at Home Depot directly parallels Play Points' billion-transaction challenges. Second, my retail and healthcare experience brings fresh perspectives on customer behavior that pure tech backgrounds might miss - my retention analysis improving metrics by 12% worth $3.2M proves this. Third, the analytical rigor required for healthcare compliance and retail inventory actually exceeds many tech scenarios. The core challenge isn't the industry - it's the scale and complexity, which I've mastered."**`;
            }
            else if (concerns.technical && (concerns.gap || concerns.experience)) {
                approach = 'Demonstrate technical depth + fast learning curve';
                evidence = `${yourStrengths.technical} proves optimization mindset`;
                bridge = 'Snowflake→BigQuery transition is syntax, not concepts';
                counterPoints = [
                    'Cloud-native SQL platforms share 80% architecture',
                    'Optimization principles universal across platforms',
                    'Track record of rapid tool adoption'
                ];
                strategy = `**"While I haven't used BigQuery specifically, my Snowflake expertise translates directly - both are columnar, cloud-native SQL platforms. The concepts I've mastered - partitioning, clustering, window functions, cost optimization - are identical. My track record proves this: I achieved 95% query optimization reducing processing from 10 minutes to 30 seconds, built pipelines with 99.9% uptime, and consistently adopt new tools rapidly. The difference between Snowflake and BigQuery is syntax, not capability. Given my deep SQL foundation and optimization mindset, I estimate a 2-week ramp to full productivity on BigQuery, not months."**`;
            }
            else if (concerns.competition) {
                approach = 'Differentiate with unique value proposition';
                evidence = 'Combination of scale + stakeholder + business impact';
                bridge = 'Position as the candidate who delivers both technical excellence AND business value';
                counterPoints = [
                    'Proven at Google scale already',
                    'Business impact quantification expertise',
                    'Stakeholder enablement differentiator'
                ];
                const relevantStory = loadedStories.find(s => s.title?.includes('Segmentation') || s.title?.includes('Pipeline') || s.result?.includes('$'));
                const storyExample = relevantStory ? `For example, ${relevantStory.title} - ${relevantStory.result?.substring(0, 100)}...` : '';
                strategy = `**"What differentiates me is the rare combination of three critical capabilities: First, I've already operated at Google scale - ${yourStrengths.scale} - so there's no learning curve on data volume challenges. Second, I don't just build analytics, I drive adoption - ${yourStrengths.stakeholders} by focusing on user needs. Third, I quantify business impact in dollars - ${yourStrengths.impact} - which aligns with Google's Year of Efficiency focus. ${storyExample} While others might excel in one area, I bring the complete package: technical depth, stakeholder success, and measurable business value."**`;
            }
            else if (concerns.contractor) {
                approach = 'Reposition contractor as strategic advantage';
                evidence = 'Immediate availability + prove value quickly + FTE interest';
                bridge = 'Contractor allows rapid value delivery without lengthy notice periods';
                counterPoints = [
                    'Available immediately vs 2-3 month notice for FTEs',
                    'Motivated to prove value for conversion',
                    'Same quality commitment regardless of status'
                ];
                const contractorExample = loadedStories.find(s => s.title?.includes('Trulieve') || s.result?.includes('$'))?.result || '$3.2M impact at Trulieve';
                strategy = `**"Actually, the contractor structure benefits both of us. I'm available immediately - no 2-3 month notice period delaying your Play Points initiatives. This arrangement lets me prove my value quickly while you evaluate cultural fit without long-term commitment. My track record shows I deliver the same quality regardless of employment type - ${contractorExample}. I'm genuinely interested in FTE conversion as Google Play's scale and AI/ML roadmap represent my ideal long-term opportunity. Think of it as an extended working interview where I can contribute immediately to your Q4 goals."**`;
            }
            else if (concerns.failure) {
                approach = 'Show learning mindset + resilience + growth';
                evidence = 'Specific failure that led to process improvement';
                bridge = 'Failure created systematic improvements preventing future issues';
                counterPoints = [
                    'Failure led to documented process improvements',
                    'Created preventive measures now standard practice',
                    'Demonstrates ownership and growth mindset'
                ];
                strategy = `**"I'll share a significant learning experience. At Home Depot, I initially underestimated the complexity of integrating multiple data sources for a supply chain dashboard. My first version had data discrepancies that weren't caught until executive review. I took full ownership, worked through the weekend to fix it, but more importantly, I created a comprehensive data validation framework that became the team standard. This 'failure' led to implementing automated testing that prevented similar issues across 50+ future dashboards. The experience taught me to always build validation into the initial design, not as an afterthought. This systematic approach to preventing errors would be valuable for Play Points' data integrity."**`;
            }
            else if (concerns.culture || concerns.team) {
                approach = 'Demonstrate collaborative success + cultural alignment';
                evidence = yourStrengths.stakeholders + ' proves collaboration skills';
                bridge = "Your stakeholder-first approach matches Google's user focus";
                counterPoints = [
                    'Cross-functional success with diverse stakeholders',
                    'Data democratization philosophy',
                    'Continuous learning mindset'
                ];
                strategy = `**"My collaborative approach aligns perfectly with Google's culture. I believe in democratizing data - at Home Depot, I didn't just build dashboards, I enabled 200+ stakeholders to self-serve, increasing adoption by 30%. I've successfully partnered with everyone from warehouse workers to C-suite executives, adapting my communication style to each audience. My Lean Six Sigma training emphasized cross-functional collaboration, which I've applied in every role. Google's emphasis on psychological safety and innovation matches my approach - I encourage questions, share knowledge openly, and see colleagues' success as my success. The Play Points team's mix of technical and business stakeholders is exactly the environment where I thrive."**`;
            }
            else if (concerns.scale) {
                approach = 'Prove scale experience + optimization expertise';
                evidence = yourStrengths.scale;
                bridge = 'Your scale experience eliminates the usual learning curve';
                counterPoints = [
                    'Already comfortable with billion-row datasets',
                    'Proven optimization reducing processing 95%',
                    'Cost-conscious approach to large-scale analytics'
                ];
                const scaleStory = loadedStories.find(s => s.title?.includes('BigQuery') || s.title?.includes('Scale') || s.result?.includes('records'));
                const specificOptimization = scaleStory?.result?.match(/(\d+%[^,]*|10 minutes to 30 seconds|80% reduction)/g)?.join(', ') || '95% performance improvements reducing query time from 10 minutes to 30 seconds';
                strategy = `**"Scale is actually my comfort zone. ${yourStrengths.scale}. I don't just handle large datasets - I optimize them, achieving ${specificOptimization}. I understand the cost implications of scanning billions of rows and consistently implement partitioning, clustering, and incremental processing strategies. For Play Points' 220M+ members and billions of daily events, I'd immediately apply these optimization patterns. There's no scale intimidation factor - I've been working at this magnitude for years."**`;
            }
            else if (concernCount === 0 || concernCount > 3) {
                // Complex or vague question - provide structured framework
                approach = 'Use STAR structure to address comprehensively';
                evidence = 'Multiple proof points from your background';
                bridge = 'Connect each element back to Play Points needs';
                counterPoints = [
                    'Address both technical and business aspects',
                    'Show progression and growth',
                    'Demonstrate immediate value potential'
                ];
                const comprehensiveExample = loadedStories.length > 0 ? loadedStories[0] : null;
                const situationExample = comprehensiveExample ? comprehensiveExample.situation?.substring(0, 80) + '...' : 'similar challenges in previous roles';
                const resultExample = comprehensiveExample ? comprehensiveExample.result : yourStrengths.impact;
                strategy = `**"Let me address that comprehensively. [Situation] ${situationExample} - the question touches on important considerations for this role. [Task] My goal is to demonstrate not just capability, but exceptional fit for Play Points analytics. [Action] Looking at my background: I've managed Google-scale data (${yourStrengths.scale}), delivered quantified business impact (${resultExample}), and enabled stakeholders through intuitive analytics. Each of these directly applies to Play Points' challenges with 220M+ members. [Result] The outcome is clear: I can contribute immediately to your analytics needs while bringing fresh perspectives from cross-industry experience. The upcoming AI/ML integration particularly excites me as it combines my expertise with Play Points' personalization goals."**`;
            }
            else {
                // Intelligent response based on question keywords
                approach = 'Analyze question keywords + provide targeted evidence + show enthusiasm';
                
                let relevantStrength = '';
                let specificApplication = '';
                
                if (questionLower.includes('data') || questionLower.includes('analytics')) {
                    relevantStrength = yourStrengths.scale;
                    specificApplication = "analyzing Play Points' 220M+ member behaviors to optimize tier progression";
                } else if (questionLower.includes('stakeholder') || questionLower.includes('team') || questionLower.includes('management')) {
                    relevantStrength = yourStrengths.stakeholders;
                    specificApplication = "collaborating across Product, Engineering, and Marketing teams for Play Points optimization";
                } else if (questionLower.includes('sql') || questionLower.includes('query') || questionLower.includes('performance')) {
                    relevantStrength = yourStrengths.technical;
                    specificApplication = "optimizing BigQuery performance for billion-row Play Store transaction datasets";
                } else if (questionLower.includes('impact') || questionLower.includes('business') || questionLower.includes('value')) {
                    relevantStrength = yourStrengths.impact;
                    specificApplication = "driving measurable business outcomes through Play Points analytics";
                } else {
                    relevantStrength = yourStrengths.skills;
                    specificApplication = "contributing immediately to Google Play's data challenges";
                }
                
                evidence = relevantStrength;
                bridge = `Specific application to ${specificApplication}`;
                strategy = `**"${question.includes('?') ? 'To answer directly:' : 'Let me address that:'} My experience specifically demonstrates this capability. ${relevantStrength} directly applies to ${specificApplication}. What excites me most about this role is the opportunity to leverage these proven skills at Google's scale while contributing to the upcoming AI/ML integration. Would you like me to elaborate on how I'd approach this challenge in the Play Points context?"**`;
            }
            
            strategyDiv.innerHTML = `
                <div style="padding: 1.5rem; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 0.75rem; border-left: 4px solid #f59e0b;">
                    <div style="display: flex; align-items: center; margin-bottom: 1rem;">
                        <h3 style="color: #1e293b; margin: 0; margin-right: 0.5rem;">⚡ Intelligent Rebuttal Strategy</h3>
                        ${aiBadge()}
                    </div>
                    
                    <div style="background: white; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem;">
                        <h4 style="color: #f59e0b; margin-bottom: 0.5rem;">❓ Your Question:</h4>
                        <p style="font-style: italic; color: #64748b;">"${question}"</p>
                    </div>
                    
                    <div style="background: white; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem;">
                        <h4 style="color: #f59e0b; margin-bottom: 0.75rem;">🎯 Strategic Approach:</h4>
                        <p style="margin-bottom: 0.5rem;"><strong>Method:</strong> ${approach}</p>
                        <p style="margin-bottom: 0.5rem;"><strong>Evidence to Use:</strong> ${evidence}</p>
                        <p><strong>Bridge to Role:</strong> ${bridge}</p>
                    </div>
                    
                    ${counterPoints.length > 0 ? `
                    <div style="background: white; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem;">
                        <h4 style="color: #8b5cf6; margin-bottom: 0.75rem;">🔄 Counter Points to Emphasize:</h4>
                        <ul style="margin: 0; padding-left: 1rem;">
                            ${counterPoints.map(point => `<li style="margin-bottom: 0.25rem;">${point}</li>`).join('')}
                        </ul>
                    </div>
                    ` : ''}
                    
                    <div style="background: #f8fafc; padding: 1rem; border-radius: 0.5rem; border-left: 3px solid #22c55e;">
                        <h4 style="color: #22c55e; margin-bottom: 0.75rem;">💬 Tailored Response:</h4>
                        <p style="line-height: 1.6;">${strategy}</p>
                    </div>
                    
                    <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 1rem; border-radius: 0.5rem; margin-top: 1rem;">
                        <h4 style="color: white; margin-bottom: 0.5rem;">💡 Delivery Excellence Tips:</h4>
                        <ul style="margin: 0; padding-left: 1rem;">
                            <li>Pause confidently before responding to show thoughtfulness</li>
                            <li>Use your specific metrics: 500M+ records, $3.2M impact, 95% optimization</li>
                            <li>Reference Play Points context: 220M+ members, $11.63B quarterly revenue</li>
                            <li>Close with a question to engage the interviewer</li>
                        </ul>
                    </div>
                </div>
            `;
            
            showToast('Tailored rebuttal strategy generated!', 'success');
        }

        async function generateCandidateQuestions() {
            const questionsDiv = document.getElementById('candidateQuestions');
            const allPanelistQuestions = appState.extractedData.panelistQuestions || {};
            
            let questionsHTML = '';
            
            // Show questions for all panelists if available
            if (Object.keys(allPanelistQuestions).length > 0) {
                Object.entries(allPanelistQuestions).forEach(([panelist, questions]) => {
                    questionsHTML += `
                        <div style="margin-bottom: 1.5rem;">
                            <h4 style="font-weight: 600; color: #4f46e5; margin-bottom: 0.5rem;">For ${panelist}:</h4>
                            <ul style="margin-left: 1rem;">
                                ${questions.map(q => `<li style="margin-bottom: 0.5rem;">${q}</li>`).join('')}
                            </ul>
                        </div>
                    `;
                });
                
                questionsDiv.innerHTML = `
                    <div style="padding: 1rem; background: #f0f9ff; border-radius: 0.5rem; border-left: 4px solid #0ea5e9;">
                        <div style="display: flex; align-items: center; margin-bottom: 1rem;">${aiBadge()}</div>
                        ${questionsHTML}
                    </div>
                `;
            } else {
                // Fallback questions if extraction didn't work
                questionsDiv.innerHTML = `
                    <div style="padding: 1rem; background: #f0f9ff; border-radius: 0.5rem; border-left: 4px solid #0ea5e9;">
                        <div style="display: flex; align-items: center; margin-bottom: 1rem;">${aiBadge()}</div>
                        <h4 style="font-weight: 600; color: #4f46e5; margin-bottom: 0.5rem;">Strategic Questions to Ask:</h4>
                        <ul style="margin-left: 1rem;">
                            <li style="margin-bottom: 0.5rem;">With Play Points serving 220M+ members globally, what are the biggest data challenges you're facing?</li>
                            <li style="margin-bottom: 0.5rem;">What specific AI/ML initiatives are planned for Play Points personalization in the next 6-12 months?</li>
                            <li style="margin-bottom: 0.5rem;">How does the team approach balancing technical debt with rapid feature development?</li>
                            <li style="margin-bottom: 0.5rem;">What opportunities exist for contractors to transition to FTE roles?</li>
                            <li style="margin-bottom: 0.5rem;">What aspect of the Play Points analytics roadmap excites the team most?</li>
                        </ul>
                    </div>
                `;
            }
            showToast('Questions generated!', 'success');
        }

        async function generatePlan() {
            const planDiv = document.getElementById('dayPlan');
            planDiv.innerHTML = `
                <div style="padding: 2rem; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); border-radius: 1rem;">
                    <div style="display: flex; align-items: center; margin-bottom: 1.5rem;">
                        <h2 style="color: #1e293b; margin: 0; font-size: 1.5rem;">🚀 Strategic 30-60-90 Day Execution Plan</h2>
                        ${aiBadge()}
                    </div>
                    <div style="color: #64748b; margin-bottom: 2rem; padding: 1rem; background: white; border-radius: 0.5rem; border-left: 4px solid #4f46e5;">
                        <strong>Context:</strong> Google Play BI/Data Analyst role supporting 220M+ Play Points members and $11.63B quarterly revenue with upcoming AI/ML integration expansion.
                    </div>

                    <!-- DAYS 1-30: Foundation & Learning -->
                    <div style="margin-bottom: 2.5rem; background: white; padding: 1.5rem; border-radius: 0.75rem; border-left: 5px solid #22c55e;">
                        <div style="display: flex; align-items: center; margin-bottom: 1rem;">
                            <div style="background: #22c55e; color: white; padding: 0.5rem 1rem; border-radius: 1.5rem; font-weight: 600; margin-right: 1rem;">Days 1-30</div>
                            <h3 style="color: #22c55e; margin: 0; font-size: 1.25rem;">🎯 Foundation & Technical Onboarding</h3>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-top: 1rem;">
                            <div>
                                <h4 style="color: #1e293b; font-size: 1rem; margin-bottom: 0.75rem;">📚 Technical Mastery</h4>
                                <ul style="margin: 0; padding-left: 1rem; line-height: 1.6;">
                                    <li><strong>BigQuery Deep Dive:</strong> Master Google-specific SQL optimizations for billion-row datasets</li>
                                    <li><strong>PLX Dashboard Tool:</strong> Learn internal visualization platform (similar to Power BI/Tableau)</li>
                                    <li><strong>Looker Integration:</strong> Understand LookML modeling and business logic definition</li>
                                    <li><strong>Play Points Data Schema:</strong> Map loyalty program data architecture (Bronze→Diamond tiers)</li>
                                    <li><strong>BigQuery ML Foundations:</strong> Prepare for upcoming AI/ML expansion (6-12 month timeline)</li>
                                </ul>
                            </div>
                            <div>
                                <h4 style="color: #1e293b; font-size: 1rem; margin-bottom: 0.75rem;">🤝 Stakeholder Network</h4>
                                <ul style="margin: 0; padding-left: 1rem; line-height: 1.6;">
                                    <li><strong>Product Teams:</strong> Understand Play Points feature development roadmap</li>
                                    <li><strong>Marketing Teams:</strong> Learn user acquisition and retention strategies</li>
                                    <li><strong>Engineering Teams:</strong> Align on data pipeline architecture and infrastructure</li>
                                    <li><strong>Finance Teams:</strong> Understand revenue reporting and forecasting requirements</li>
                                    <li><strong>Compliance Teams:</strong> Learn regulatory requirements (Epic Games settlement, EU DMA)</li>
                                </ul>
                            </div>
                        </div>
                        
                        <div style="background: #f0fdf4; padding: 1rem; border-radius: 0.5rem; margin-top: 1rem;">
                            <strong>🎯 Success Metrics (30 Days):</strong> Complete BigQuery certification, deliver first data quality assessment, establish weekly stakeholder touchpoints, identify top 3 optimization opportunities
                        </div>
                    </div>

                    <!-- DAYS 31-60: Quick Wins & Impact -->
                    <div style="margin-bottom: 2.5rem; background: white; padding: 1.5rem; border-radius: 0.75rem; border-left: 5px solid #3b82f6;">
                        <div style="display: flex; align-items: center; margin-bottom: 1rem;">
                            <div style="background: #3b82f6; color: white; padding: 0.5rem 1rem; border-radius: 1.5rem; font-weight: 600; margin-right: 1rem;">Days 31-60</div>
                            <h3 style="color: #3b82f6; margin: 0; font-size: 1.25rem;">⚡ Quick Wins & Optimization</h3>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-top: 1rem;">
                            <div>
                                <h4 style="color: #1e293b; font-size: 1rem; margin-bottom: 0.75rem;">📊 Data Optimization Projects</h4>
                                <ul style="margin: 0; padding-left: 1rem; line-height: 1.6;">
                                    <li><strong>Gold→Platinum Progression Analysis:</strong> Diagnose stagnant tier progression (600-2,999 to 3,000+ points gap)</li>
                                    <li><strong>Query Performance Optimization:</strong> Target 95% improvement (10min→30sec) for key reports</li>
                                    <li><strong>Member Churn Investigation:</strong> Analyze retention patterns across 220M+ members</li>
                                    <li><strong>Dashboard Consolidation:</strong> Streamline reporting to reduce manual effort by 80%</li>
                                    <li><strong>Payment Optimization Support:</strong> Analyze AI-powered recommendation effectiveness</li>
                                </ul>
                            </div>
                            <div>
                                <h4 style="color: #1e293b; font-size: 1rem; margin-bottom: 0.75rem;">🚀 Strategic Deliverables</h4>
                                <ul style="margin: 0; padding-left: 1rem; line-height: 1.6;">
                                    <li><strong>Executive Dashboard:</strong> C-level metrics for $11.63B Play Store performance</li>
                                    <li><strong>Tier Progression Playbook:</strong> Actionable insights for loyalty engagement</li>
                                    <li><strong>Revenue Impact Analysis:</strong> Quantify optimization opportunities ($3.2M+ potential)</li>
                                    <li><strong>Cross-Platform Integration:</strong> Gaming, entertainment, commerce data unification</li>
                                    <li><strong>Stakeholder Training:</strong> Enable 30% dashboard adoption increase</li>
                                </ul>
                            </div>
                        </div>
                        
                        <div style="background: #eff6ff; padding: 1rem; border-radius: 0.5rem; margin-top: 1rem;">
                            <strong>🎯 Success Metrics (60 Days):</strong> Deliver Gold→Platinum improvement recommendations, achieve 95% query optimization target, present executive-ready insights, increase stakeholder dashboard usage by 30%
                        </div>
                    </div>

                    <!-- DAYS 61-90: Leadership & Innovation -->
                    <div style="margin-bottom: 2rem; background: white; padding: 1.5rem; border-radius: 0.75rem; border-left: 5px solid #8b5cf6;">
                        <div style="display: flex; align-items: center; margin-bottom: 1rem;">
                            <div style="background: #8b5cf6; color: white; padding: 0.5rem 1rem; border-radius: 1.5rem; font-weight: 600; margin-right: 1rem;">Days 61-90</div>
                            <h3 style="color: #8b5cf6; margin: 0; font-size: 1.25rem;">🧠 Innovation & Strategic Leadership</h3>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-top: 1rem;">
                            <div>
                                <h4 style="color: #1e293b; font-size: 1rem; margin-bottom: 0.75rem;">🤖 AI/ML Preparation</h4>
                                <ul style="margin: 0; padding-left: 1rem; line-height: 1.6;">
                                    <li><strong>BigQuery ML Implementation:</strong> Pilot machine learning models for Play Points personalization</li>
                                    <li><strong>Vertex AI Integration:</strong> Design recommendation engine architecture</li>
                                    <li><strong>Gemini Analytics:</strong> Leverage AI-powered data preparation and analysis</li>
                                    <li><strong>Predictive Modeling:</strong> Build churn prediction models for loyalty members</li>
                                    <li><strong>Real-time Analytics:</strong> Design streaming data pipelines for instant insights</li>
                                </ul>
                            </div>
                            <div>
                                <h4 style="color: #1e293b; font-size: 1rem; margin-bottom: 0.75rem;">📈 Strategic Initiatives</h4>
                                <ul style="margin: 0; padding-left: 1rem; line-height: 1.6;">
                                    <li><strong>Q2 2025 Roadmap:</strong> Define analytics strategy for next quarter</li>
                                    <li><strong>Cross-Functional Leadership:</strong> Lead data governance initiative</li>
                                    <li><strong>Regulatory Compliance:</strong> Support Epic Games settlement and EU DMA requirements</li>
                                    <li><strong>Team Expansion Planning:</strong> Identify hiring needs for growing analytics team</li>
                                    <li><strong>Knowledge Transfer:</strong> Create documentation and training materials</li>
                                </ul>
                            </div>
                        </div>
                        
                        <div style="background: #f3e8ff; padding: 1rem; border-radius: 0.5rem; margin-top: 1rem;">
                            <strong>🎯 Success Metrics (90 Days):</strong> Launch ML pilot project, present Q2 strategic plan, establish data governance framework, mentor junior analysts, demonstrate $2M+ annual impact potential
                        </div>
                    </div>

                    <!-- Key Success Factors -->
                    <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 1.5rem; border-radius: 0.75rem;">
                        <h4 style="color: white; margin-bottom: 1rem; font-size: 1.1rem;">🏆 Key Success Factors for Maximum Impact</h4>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">
                            <div>
                                <strong>• Scale Experience Leverage:</strong> Apply your 500M+ record processing expertise to Google's billion-row datasets
                            </div>
                            <div>
                                <strong>• Stakeholder Mastery:</strong> Use your C-level presentation skills for cross-functional leadership
                            </div>
                            <div>
                                <strong>• Process Excellence:</strong> Apply Lean Six Sigma methodologies to Google's "Year of Efficiency"
                            </div>
                            <div>
                                <strong>• Technical Innovation:</strong> Bridge Snowflake/BigQuery expertise with emerging AI/ML capabilities
                            </div>
                        </div>
                    </div>
                </div>
            `;
            showToast('Comprehensive 30-60-90 day plan generated!', 'success');
        }

        async function generateThankYou() {
            const interviewer = document.getElementById('interviewerSelect').value;
            const notes = document.getElementById('interviewNotes').value;
            const noteDiv = document.getElementById('thankYouNote');

            if (!interviewer) {
                showToast('Please select an interviewer', 'warning');
                return;
            }

            // Find panelist details for personalization
            const panelist = appState.extractedData.panelists.find(p => p.name === interviewer);
            
            // Generate personalized content based on panelist
            let personalizedContent = '';
            let specificMentions = '';
            let roleRelevance = '';
            
            if (panelist) {
                switch (panelist.name) {
                    case 'Nikki Diman':
                        personalizedContent = 'Our discussion about cross-functional stakeholder management and creative problem-solving with minimal data particularly resonated with me.';
                        specificMentions = 'Your insights about the Gold-to-Platinum progression challenge within the 220M+ Play Points program highlighted the scale and complexity of analytics work at Google.';
                        roleRelevance = 'My experience processing 500M+ SKU records at Home Depot and improving retention by 12% at Trulieve directly aligns with the scalable data solutions needed for Play Points optimization.';
                        break;
                    case 'Brian Mauch':
                        personalizedContent = 'I appreciated your technical validation questions and focus on how contractors can drive strategic initiatives rather than just maintenance work.';
                        specificMentions = 'Your perspective on balancing technical debt with rapid feature development in the Play Store ecosystem was especially insightful.';
                        roleRelevance = 'My BigQuery experience with billion-row optimizations and 95% query performance improvements demonstrate the technical rigor needed for Google Play\'s infrastructure.';
                        break;
                    case 'Jolly Jayaprakash':
                        personalizedContent = 'Thank you for your enthusiastic discussion about the role and the potential pathways for contractor-to-FTE conversion.';
                        specificMentions = 'Your insights about what makes successful contractors stand out and the typical timeline for FTE transitions were very valuable.';
                        roleRelevance = 'My immediate availability and proven track record of delivering results in contractor roles positions me well for both immediate impact and long-term success.';
                        break;
                    default:
                        personalizedContent = 'Our discussion about the BI/Data Analyst role and Google Play\'s data-driven approach was truly engaging.';
                        specificMentions = 'Your insights about the team dynamics and project scope helped me understand how I can contribute effectively.';
                        roleRelevance = 'My experience with large-scale data analytics and stakeholder management aligns well with the role requirements.';
                }
            } else {
                personalizedContent = 'Our discussion about the BI/Data Analyst role and Google Play\'s strategic initiatives was truly enlightening.';
                specificMentions = 'Your insights about the team\'s approach to data analytics and the scale of Play Points operations were particularly valuable.';
                roleRelevance = 'My experience with large-scale data processing and cross-functional collaboration positions me well for this role.';
            }

            // Include interview notes if provided
            let notesSection = '';
            if (notes.trim()) {
                notesSection = `
                    <p>I wanted to follow up on a few key points from our conversation:</p>
                    <div style="background: #f8fafc; padding: 1rem; border-radius: 0.5rem; margin: 1rem 0; border-left: 3px solid #4f46e5;">
                        ${notes.split('\n').map(note => note.trim() ? `<p style="margin: 0.5rem 0;">• ${note}</p>` : '').join('')}
                    </div>
                `;
            }

            noteDiv.innerHTML = `
                <div style="padding: 1.5rem; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 0.75rem; border-left: 4px solid #0ea5e9;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem;">
                        <h3 style="color: #1e293b; margin: 0;">📧 Personalized Thank You Note</h3>
                        ${aiBadge()}
                    </div>
                    
                    <div style="background: white; padding: 1.5rem; border-radius: 0.5rem; line-height: 1.6; color: #374151;">
                        <p><strong>Subject:</strong> Thank you - Google Play BI/Data Analyst Interview</p>
                        <hr style="margin: 1rem 0; border: none; border-top: 1px solid #e5e7eb;">
                        
                        <p>Dear ${interviewer},</p>
                        
                        <p>${personalizedContent} ${specificMentions}</p>
                        
                        ${notesSection}
                        
                        <p>${roleRelevance}</p>
                        
                        <p>I'm genuinely excited about the opportunity to contribute to Google Play's continued growth and innovation. The scale of impact—supporting 220M+ Play Points members and $11.63B in quarterly revenue—combined with the upcoming AI/ML integration expansion, makes this role particularly compelling.</p>
                        
                        <p>Please let me know if you need any additional information from me. I look forward to the next steps in the process.</p>
                        
                        <p>Best regards,<br>
                        <strong>Brandon Abbott</strong><br>
                        <em>Data Analyst | SQL Expert | 8+ Years Experience</em></p>
                        
                        <div style="margin-top: 1.5rem; padding: 1rem; background: #f8fafc; border-radius: 0.5rem; border-left: 3px solid #22c55e;">
                            <p style="margin: 0; font-size: 0.875rem; color: #64748b;"><strong>Quick Stats Reminder:</strong> 500M+ records processed | 12% retention improvement | $3.2M revenue impact | 95% query optimization | Available immediately</p>
                        </div>
                    </div>
                </div>
            `;
            showToast('Personalized thank-you note generated!', 'success');
        }

        async function enhanceStory(index) {
            const story = appState.extractedData.stories[index];
            
            // Enhance with realistic projections and transferable value rather than fictional accomplishments
            const enhancements = {
                'Customer Segmentation': {
                    result: story.result + '\n\n🚀 <strong>Enhanced Strategic Value:</strong> This customer segmentation methodology demonstrates the analytical rigor needed for Google Play Points tier optimization. The approach of building personas from transaction data and measuring retention impact would directly translate to analyzing 220M+ Play Points member behavior patterns and identifying opportunities to improve Gold-to-Platinum progression rates.',
                    additionalMetrics: '• Methodology: Proven scalable<br>• Application: Play Points ready<br>• Transferability: High'
                },
                'BigQuery Pipeline': {
                    result: story.result + '\n\n🚀 <strong>Enhanced Strategic Value:</strong> This BigQuery architecture experience demonstrates readiness for Google Play\'s billion-row analytics challenges. The optimization techniques and automated pipeline approach would directly support the upcoming AI/ML integration expansion, particularly for real-time Play Points engagement analytics and personalized recommendation systems.',
                    additionalMetrics: '• Scale Ready: Billion+ rows<br>• Architecture: Cloud-native<br>• AI/ML: Pipeline ready'
                },
                'Dashboard Adoption': {
                    result: story.result + '\n\n🚀 <strong>Enhanced Strategic Value:</strong> This stakeholder enablement approach demonstrates the cross-functional collaboration skills essential for Google Play\'s matrixed environment. The training methodology and self-service analytics framework would directly support the diverse stakeholder ecosystem spanning Product, Marketing, Finance, and Engineering teams.',
                    additionalMetrics: '• Stakeholder Model: Cross-functional<br>• Training: Scalable<br>• Adoption: Proven'
                },
                'Lean Six Sigma': {
                    result: story.result + '\n\n🚀 <strong>Enhanced Strategic Value:</strong> This process optimization expertise aligns perfectly with Google\'s "Year of Efficiency" focus. The systematic approach to identifying and eliminating bottlenecks would be valuable for streamlining Play Points analytics workflows and supporting the team\'s rapid scaling needs as the loyalty program continues to grow.',
                    additionalMetrics: '• Process Excellence: Six Sigma certified<br>• Efficiency Focus: Google-aligned<br>• Scaling: Systematic'
                }
            };
            
            // Find matching enhancement based on story title keywords
            let enhancement = null;
            for (const [key, value] of Object.entries(enhancements)) {
                if (story.title.includes(key) || story.title.toLowerCase().includes(key.toLowerCase())) {
                    enhancement = value;
                    break;
                }
            }
            
            // Apply enhancement or provide generic improvement
            if (enhancement) {
                story.result = enhancement.result;
                story.additionalMetrics = enhancement.additionalMetrics;
            } else {
                // Generic enhancement for other stories
                story.result = story.result + '\n\n🚀 <strong>Enhanced Strategic Value:</strong> This achievement demonstrates the analytical problem-solving approach that would be valuable for Google Play\'s data challenges. The skills and methodology from this experience would transfer well to supporting Play Points analytics, stakeholder collaboration, and data-driven decision making in the Google ecosystem.';
                story.additionalMetrics = '• Skills: Transferable<br>• Methodology: Scalable<br>• Readiness: High';
            }
            
            showStoryDetail(index);
            showToast('Story enhanced with strategic context!', 'success');
        }

        function showToast(message, type = 'info') {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            
            const colors = {
                success: '#22c55e',
                error: '#ef4444',
                warning: '#f59e0b',
                info: '#3b82f6'
            };
            
            toast.style.background = colors[type] || colors.info;
            toast.classList.add('show');
            
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }

        // AI Assistant Functions
        function setQuickQuestion(question) {
            document.getElementById('assistantQuestion').value = question;
        }

        async function generateAssistantResponse() {
            const question = document.getElementById('assistantQuestion').value.trim();
            const responseDiv = document.getElementById('assistantResponse');
            
            if (!question) {
                showToast('Please enter a question first', 'warning');
                return;
            }
            
            // Analyze question and provide tailored response based on prep materials and role
            let response = '';
            const questionLower = question.toLowerCase();
            
            // Background/Experience Questions
            if (questionLower.includes('background') || questionLower.includes('emphasize') || questionLower.includes('highlight')) {
                response = `
                    <h4 style="color: #4f46e5; margin-bottom: 0.75rem;">🎯 Key Background Elements to Emphasize</h4>
                    <div style="background: #f0fdf4; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem;">
                        <strong>1. Scale Expertise:</strong> Your experience with 500M+ SKU records at Home Depot and 100M+ daily transactions at Trulieve demonstrates you're already operating at Google-level data volumes.
                    </div>
                    <div style="background: #eff6ff; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem;">
                        <strong>2. Measurable Impact:</strong> The $3.2M revenue impact and 12% retention improvement show you deliver business results, not just technical solutions.
                    </div>
                    <div style="background: #fef3c7; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem;">
                        <strong>3. Stakeholder Leadership:</strong> Your C-level presentation experience and 30% dashboard adoption across 200+ users is rare for contractor candidates.
                    </div>
                    <div style="background: #f3e8ff; padding: 1rem; border-radius: 0.5rem;">
                        <strong>4. Technical Transferability:</strong> Snowflake/BigQuery similarity and 95% query optimization show immediate contribution potential.
                    </div>
                `;
            }
            
            // Role Connection Questions
            else if (questionLower.includes('connect') || questionLower.includes('google play') || questionLower.includes('role') || questionLower.includes('specific')) {
                response = `
                    <h4 style="color: #22c55e; margin-bottom: 0.75rem;">🔗 Direct Role Connections</h4>
                    <div style="background: #f8fafc; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem; border-left: 3px solid #22c55e;">
                        <strong>Play Points Tier Analysis:</strong> Your customer segmentation expertise directly applies to analyzing the Gold-to-Platinum progression challenge (600-2,999 to 3,000+ points gap) across 220M+ members.
                    </div>
                    <div style="background: #f8fafc; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem; border-left: 3px solid #3b82f6;">
                        <strong>BigQuery Scale:</strong> Your billion-row optimization experience positions you perfectly for Google's real-time analytics infrastructure supporting $11.63B quarterly revenue.
                    </div>
                    <div style="background: #f8fafc; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem; border-left: 3px solid #8b5cf6;">
                        <strong>AI/ML Readiness:</strong> Your Python pipeline experience and automated ETL work aligns with the upcoming 6-12 month AI integration expansion.
                    </div>
                    <div style="background: #f8fafc; padding: 1rem; border-radius: 0.5rem; border-left: 3px solid #f59e0b;">
                        <strong>Process Excellence:</strong> Your Lean Six Sigma background directly supports Google's "Year of Efficiency" initiative.
                    </div>
                `;
            }
            
            // Questions to Ask
            else if (questionLower.includes('questions') || questionLower.includes('ask') || questionLower.includes('interviewer')) {
                response = `
                    <h4 style="color: #8b5cf6; margin-bottom: 0.75rem;">❓ Strategic Questions by Interviewer</h4>
                    <div style="background: #e0f2fe; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem;">
                        <strong>For Nikki Diman (Service Delivery Manager):</strong>
                        <ul style="margin: 0.5rem 0; padding-left: 1rem;">
                            <li>How does your team balance standardized global metrics with local market insights for 220M+ Play Points members?</li>
                            <li>What strategies work best when Product, Engineering, and Marketing have conflicting priorities?</li>
                            <li>What specific AI initiatives are planned for Play Points personalization in the next 6-12 months?</li>
                        </ul>
                    </div>
                    <div style="background: #f3e8ff; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem;">
                        <strong>For Brian Mauch (Technical Validation):</strong>
                        <ul style="margin: 0.5rem 0; padding-left: 1rem;">
                            <li>How does the team approach balancing technical debt with rapid feature development?</li>
                            <li>What role do contractors typically play in driving strategic initiatives versus maintenance?</li>
                            <li>What are the biggest technical challenges in processing data for 220M+ Play Points members?</li>
                        </ul>
                    </div>
                    <div style="background: #f0fdf4; padding: 1rem; border-radius: 0.5rem;">
                        <strong>For Jolly Jayaprakash (Recruiter):</strong>
                        <ul style="margin: 0.5rem 0; padding-left: 1rem;">
                            <li>What typically drives contractor-to-FTE conversion decisions in data roles?</li>
                            <li>With your 10 years supporting Google, what makes successful contractors stand out?</li>
                            <li>What's the typical timeline for FTE transitions in the analytics team?</li>
                        </ul>
                    </div>
                `;
            }
            
            // Contractor Concerns
            else if (questionLower.includes('contractor') || questionLower.includes('full-time') || questionLower.includes('fte') || questionLower.includes('concerns')) {
                response = `
                    <h4 style="color: #f59e0b; margin-bottom: 0.75rem;">🤝 Addressing Contractor Concerns</h4>
                    <div style="background: #f0fdf4; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem; border-left: 4px solid #22c55e;">
                        <strong>Reframe as Strategic Choice:</strong> "I chose the contractor path for this role because it offered immediate availability and the chance to prove my value quickly. I'm genuinely interested in potential FTE conversion - Google Play's scale represents exactly the kind of long-term challenge I want to build my career around."
                    </div>
                    <div style="background: #eff6ff; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem; border-left: 4px solid #3b82f6;">
                        <strong>Demonstrate Commitment:</strong> "My track record shows I deliver the same quality and dedication regardless of employment status. At Trulieve, I generated $3.2M impact as a contractor, and at Home Depot, I drove 30% dashboard adoption across 200+ stakeholders."
                    </div>
                    <div style="background: #fef3c7; padding: 1rem; border-radius: 0.5rem; border-left: 4px solid #f59e0b;">
                        <strong>Show Long-term Interest:</strong> "The upcoming AI/ML integration expansion and the opportunity to optimize analytics for 220M+ Play Points members is exactly why I'm interested in potential FTE conversion opportunities."
                    </div>
                `;
            }
            
            // Technical/BigQuery Questions
            else if (questionLower.includes('bigquery') || questionLower.includes('technical') || questionLower.includes('sql') || questionLower.includes('snowflake')) {
                response = `
                    <h4 style="color: #0ea5e9; margin-bottom: 0.75rem;">⚙️ Technical Expertise Positioning</h4>
                    <div style="background: #f0f9ff; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem;">
                        <strong>Snowflake → BigQuery Bridge:</strong> "Both are cloud-native, SQL-based platforms optimized for large-scale analytics. I've worked with similar concepts: columnar storage, partitioning, clustering, and cost optimization. My 95% query performance improvements demonstrate the optimization mindset critical for Google's scale."
                    </div>
                    <div style="background: #f0fdf4; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem;">
                        <strong>Scale Readiness:</strong> "I've already processed 500M+ records monthly at Home Depot and 100M+ daily transactions at Trulieve. This billion-row experience means I understand the architectural considerations needed for Google Play's data volumes."
                    </div>
                    <div style="background: #fef3c7; padding: 1rem; border-radius: 0.5rem;">
                        <strong>Learning Approach:</strong> "While I'd need to learn Google-specific syntax and PLX dashboards, my analytical problem-solving approach and experience with similar platforms means minimal ramp-up time. I've successfully transitioned between Snowflake, BigQuery, and other cloud platforms in previous roles."
                    </div>
                `;
            }
            
            // Generic question
            else {
                response = `
                    <h4 style="color: #4f46e5; margin-bottom: 0.75rem;">💡 General Interview Strategy</h4>
                    <div style="background: #f8fafc; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem; border-left: 4px solid #4f46e5;">
                        <strong>Always Connect to Google Play:</strong> For any question, tie your answer back to the 220M+ Play Points members, $11.63B quarterly revenue, or specific challenges like Gold-to-Platinum progression.
                    </div>
                    <div style="background: #f8fafc; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem; border-left: 4px solid #22c55e;">
                        <strong>Use Specific Numbers:</strong> Mention your key metrics (500M+ records, $3.2M impact, 95% optimization, 12% retention improvement) to demonstrate proven results.
                    </div>
                    <div style="background: #f8fafc; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem; border-left: 4px solid #f59e0b;">
                        <strong>Show Strategic Thinking:</strong> Reference the upcoming AI/ML expansion, regulatory challenges (Epic Games settlement), and Google's "Year of Efficiency" to show you understand the bigger picture.
                    </div>
                    <div style="background: #f8fafc; padding: 1rem; border-radius: 0.5rem; border-left: 4px solid #8b5cf6;">
                        <strong>Ask Follow-up Questions:</strong> End your answers with questions that show deeper interest, like asking about the AI/ML timeline or specific Play Points optimization opportunities.
                    </div>
                `;
            }
            
            responseDiv.innerHTML = `
                <div style="padding: 1.5rem; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 0.75rem; border-left: 4px solid #0ea5e9;">
                    <div style="display: flex; align-items: center; margin-bottom: 1rem;">
                        <h3 style="color: #1e293b; margin: 0; margin-right: 0.5rem;">🤖 AI Assistant Response</h3>
                        ${aiBadge()}
                    </div>
                    
                    <div style="background: white; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem;">
                        <h4 style="color: #64748b; margin-bottom: 0.5rem;">Your Question:</h4>
                        <p style="font-style: italic; color: #1e293b;">"${question}"</p>
                    </div>
                    
                    <div style="background: white; padding: 1.5rem; border-radius: 0.5rem;">
                        ${response}
                    </div>
                </div>
            `;
            
            showToast('AI guidance generated!', 'success');
        }

        // Build detailed Company Intel from strategic CSVs. Gracefully falls back if fetch fails.
        async function loadCompanyIntelFromCSVs() {
            try {
                await ensurePapaParse();
                const [metricsRes, keyRes] = await Promise.all([
                    fetch('input_files/google_intelligence_metrics.csv'),
                    fetch('input_files/google_interview_key_metrics.csv')
                ]);

                const [metricsCSV, keyCSV] = await Promise.all([
                    metricsRes.ok ? metricsRes.text() : '',
                    keyRes.ok ? keyRes.text() : ''
                ]);

                let metrics = [];
                let key = [];
                if (metricsCSV) {
                    const parsed = Papa.parse(metricsCSV, { header: true, skipEmptyLines: true });
                    metrics = parsed.data;
                }
                if (keyCSV) {
                    const parsed = Papa.parse(keyCSV, { header: true, skipEmptyLines: true });
                    key = parsed.data;
                }

                // Compose markdown sections
                const highlights = [];
                const pushHL = (label, value) => { if (value) highlights.push(`- ${label}: ${value}`); };

                const get = (rows, startsWith) => rows.find(r => (r['Metric/Data Point'] || r['Category'] || '').startsWith(startsWith));
                pushHL('Alphabet Q4 2024 Revenue', get(metrics, 'Alphabet Q4 2024 Revenue')?.Value);
                pushHL('Google Services Q4 2024 Revenue', get(metrics, 'Google Services Q4 2024 Revenue')?.Value);
                pushHL('Google Cloud Q4 2024 Revenue', get(metrics, 'Google Cloud Q4 2024 Revenue')?.Value);
                pushHL('Google Play Points Members', get(key, 'Google Play Points Members')?.Value);
                pushHL('Google Play Revenue Q4 2024', get(key, 'Google Play Revenue Q4 2024')?.Value);

                const riskRow = get(metrics, 'Google Antitrust Fine Risk');

                const md = `
### Google Play — Strategic Briefing

#### Key Financials
${highlights.join('\n')}

#### Product & Program Signals
- AI‑driven recommendations and subscription expansion across Play
- Loyalty scale: Play Points ${get(key, 'Google Play Points Members')?.Value || '200M+'}
- Store size: ${get(metrics, 'Google Play Store Apps (2024)')?.Value || '3M+'} apps

#### Risks & Regulatory
- ${riskRow ? `Regulatory exposure: ${riskRow['Metric/Data Point']} — ${riskRow.Value} (${riskRow['Change/Growth']})` : 'Regulatory monitoring: EU DMA and app store policy actions'}
- Ongoing Epic litigation and market conduct scrutiny

#### Organization & Talent
- Employees: ${get(metrics, 'Google Employee Count (End 2024)')?.Value || '180k+'}
- Culture reviews: Glassdoor ${get(metrics, 'Glassdoor Google Rating')?.Value || '4.5/5'}; Comparably ${get(metrics, 'Comparably Google Employee Reviews Positive')?.Value || '85%'} positive

#### Role Relevance (BI / Data Analyst)
- High demand for SQL and experimentation; Cloud (BigQuery) emphasis
- Executive‑ready storytelling and metric ownership are differentiators
- Privacy & policy changes (DMA, Sandbox) require defensible methodology
`;

                return { markdown: md, source: 'Strategic Intelligence' };
            } catch (e) {
                // Fallback copy if CSVs are unavailable
                return {
                    source: 'Source Materials',
                    markdown: `### Google Play — Strategic Briefing
- Q4 2024 Play revenue grew and loyalty scale exceeded 200M members
- Organization emphasizes AI‑powered products, experimentation, and rigor
- Regulatory headwinds (EU DMA, litigation) require careful metric design`
                };
            }
        }

        // Build additional Company Intel from the two Strategic Intelligence files (.md/.docx)
        async function loadCompanyIntelFromStrategicDocs() {
            try {
                const { text: combined } = await fetchTextForCandidates([
                    'input_files/Strategic Intelligence Analysis - Google Play BI Role.md',
                    'input_files/Strategic Intelligence Analysis - Google Play BI Role.docx',
                    'input_files/Strategic Intelligence Analysis_ Google Play BI_Da.md',
                    'input_files/Strategic Intelligence Analysis_ Google Play BI_Da.docx'
                ]);
                if (!combined) return '';

                const lines = combined.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

                // Capture top facts, opportunities, and risks
                const highlights = lines.filter(l => /^(\d+\.|[-•–])\s+/.test(l)).slice(0, 18)
                                        .map(l => '- ' + l.replace(/^(\d+\.|[-•–])\s+/, ''));
                const risks = lines.filter(l => /risk|dma|antitrust|regulat|privacy|compliance/i.test(l)).slice(0, 8)
                                   .map(l => '- ' + l);
                const opps = lines.filter(l => /opportunit|growth|expand|subscription|loyalty|points|monetiz/i.test(l)).slice(0, 8)
                                   .map(l => '- ' + l);

                let md = '';
                if (highlights.length) md += '#### Strategic Highlights (Docs)\n' + highlights.join('\n') + '\n\n';
                if (opps.length) md += '#### Opportunities (Docs)\n' + opps.join('\n') + '\n\n';
                if (risks.length) md += '#### Risks (Docs)\n' + risks.join('\n') + '\n';
                return md.trim();
            } catch (e) { return ''; }
        }

        // Extract Strengths and Gaps from Strategic Intelligence + Synthesis files (.md/.docx/.pdf)
        async function extractStrengthsAndGapsFromStrategicDocs() {
            console.log('🔍 Extracting strengths from Resume and Strategic Synthesis PDF...');
            try {
                let allStrengths = [];
                let allGaps = [];
                
                // Extract strengths from Strategic Synthesis PDF
                try {
                    await ensurePdfJs();
                    console.log('📄 Processing Strategic Synthesis PDF...');
                    const strategicRes = await fetch('input_files/Google - Strategic Synthesis + STAR + Experience Mapping.pdf');
                    if (strategicRes.ok && window.pdfjsLib) {
                        const arrayBuffer = await strategicRes.arrayBuffer();
                        const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
                        let pdfText = '';
                        for (let i = 1; i <= pdf.numPages; i++) {
                            const page = await pdf.getPage(i);
                            const textContent = await page.getTextContent();
                            const pageText = textContent.items.map(item => item.str).join(' ');
                            pdfText += pageText + '\n';
                        }
                        
                        const strategicStrengths = extractStrengthsFromStrategicText(pdfText);
                        allStrengths.push(...strategicStrengths);
                        console.log(`✅ Extracted ${strategicStrengths.length} strengths from Strategic Synthesis PDF`);
                    }
                } catch (e) {
                    console.log('⚠️ Could not process Strategic Synthesis PDF:', e);
                }
                
                // Extract strengths from Resume PDF
                try {
                    await ensurePdfJs();
                    console.log('📄 Processing Resume PDF...');
                    const resumeRes = await fetch('input_files/Brandon Abbott Resume - Google Data Analyst.pdf');
                    if (resumeRes.ok && window.pdfjsLib) {
                        const arrayBuffer = await resumeRes.arrayBuffer();
                        const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
                        let pdfText = '';
                        for (let i = 1; i <= pdf.numPages; i++) {
                            const page = await pdf.getPage(i);
                            const textContent = await page.getTextContent();
                            const pageText = textContent.items.map(item => item.str).join(' ');
                            pdfText += pageText + '\n';
                        }
                        
                        const resumeStrengths = extractStrengthsFromResumeText(pdfText);
                        allStrengths.push(...resumeStrengths);
                        console.log(`✅ Extracted ${resumeStrengths.length} strengths from Resume PDF`);
                    }
                } catch (e) {
                    console.log('⚠️ Could not process Resume PDF:', e);
                }
                
                // Remove duplicates and limit
                const uniqueStrengths = Array.from(new Set(allStrengths)).slice(0, 12);
                console.log(`✅ Total unique strengths extracted: ${uniqueStrengths.length}`);
                
                return { strengths: uniqueStrengths, gaps: allGaps };
                
            } catch (e) {
                console.error('❌ Error extracting strengths:', e);
                return { strengths: [], gaps: [] };
            }
        }

        function extractStrengthsFromStrategicText(text) {
            const strengths = [];
            const lines = text.split(/\r?\n/).map(l => l.trim());
            
            console.log('🔍 Parsing strategic text for strength indicators...');
            
            // Look for explicit strength sections
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                
                // Find strength headers
                if (line.match(/strengths?|advantages?|core competenc|key skills|expertise/i)) {
                    // Collect bullet points after strength headers
                    for (let k = i + 1; k < lines.length && k < i + 15; k++) {
                        const nextLine = lines[k];
                        if (/^(?:[-•–*]|\d+\.)\s+/.test(nextLine)) {
                            const strength = nextLine.replace(/^(?:[-•–*]|\d+\.)\s+/, '').trim();
                            if (strength.length > 15 && strength.length < 200) {
                                strengths.push(strength);
                            }
                        } else if (!nextLine || nextLine.match(/^(gaps?|weakness|areas for|challenges?)/i)) {
                            break;
                        }
                    }
                }
            }
            
            return strengths;
        }

        function extractStrengthsFromResumeText(text) {
            const strengths = [];
            const lines = text.split(/\r?\n/).map(l => l.trim());
            
            console.log('🔍 Parsing resume text for quantified achievements...');
            
            for (const line of lines) {
                // Look for quantified achievements and results
                if (line.match(/\d+%.*(?:improv|increas|reduc|optim|saved|generated|delivered)|(?:improv|increas|reduc|optim|saved|generated|delivered).*\d+%/i)) {
                    if (line.length > 25 && line.length < 150) {
                        strengths.push(line);
                    }
                }
                
                // Look for large scale metrics
                if (line.match(/\d+(?:M|million|B|billion).*(?:records?|transactions?|users?|members?)|(?:records?|transactions?|users?|members?).*\d+(?:M|million|B|billion)/i)) {
                    if (line.length > 20 && line.length < 130) {
                        strengths.push(line);
                    }
                }
                
                // Look for time/efficiency improvements
                if (line.match(/(?:reduced?|saved?).*\d+.*(?:hours?|minutes?|days?)|(?:\d+.*(?:hours?|minutes?|days?)).*(?:reduced?|saved?)/i)) {
                    if (line.length > 20 && line.length < 120) {
                        strengths.push(line);
                    }
                }
                
                // Look for technical expertise with years
                if (line.match(/(?:sql|bigquery|python|tableau|analytics).*\d+.*years?|\d+.*years?.*(?:sql|bigquery|python|tableau|analytics)/i)) {
                    if (line.length > 15 && line.length < 100) {
                        strengths.push(line);
                    }
                }
                
                // Look for leadership and scale achievements
                if (line.match(/(?:led|managed|trained|delivered).*\d+.*(?:team|users?|stakeholders?|projects?)|(?:\d+.*(?:team|users?|stakeholders?|projects?)).*(?:led|managed|trained|delivered)/i)) {
                    if (line.length > 20 && line.length < 120) {
                        strengths.push(line);
                    }
                }
            }
            
            return strengths;
        }

        // Resume-driven strengths extraction (no panelists)
        async function extractStrengthsFromResume() {
            const strengths = [];
            await ensurePdfJs();
            if (!window.pdfjsLib) return strengths;
            try {
                const p = 'input_files/Brandon Abbott Resume - Google Data Analyst.pdf';
                const doc = await pdfjsLib.getDocument(p).promise;
                let text = '';
                for (let i = 1; i <= doc.numPages; i++) {
                    const page = await doc.getPage(i);
                    const content = await page.getTextContent();
                    text += '\n' + content.items.map(it => it.str).join(' ');
                }
                const lines = text.split(/\r?\n/).map(s => s.trim());
                const addIf = (rx, label) => { if (rx.test(text)) strengths.push(label); };
                // Heuristics for core strengths
                addIf(/\bSQL\b/i, 'Advanced SQL for analytics and optimization');
                addIf(/BigQuery|Snowflake/i, 'Cloud DW experience (BigQuery/Snowflake)');
                addIf(/ETL|ELT|pipeline/i, 'ETL/ELT pipeline design and ops');
                addIf(/A\/B|experiment|hypothes/i, 'Experimentation and causal analysis');
                addIf(/dashboard|Looker|Tableau|Data Studio|looker/i, 'Executive dashboards and self-service analytics');
                addIf(/stakeholder|partner|cross[-\s]?functional/i, 'Cross-functional stakeholder management');
                addIf(/python|pandas|notebook|jupyter/i, 'Python data tooling (pandas, notebooks)');
                // Top bullets nearby "Skills" section
                const skillsIdx = lines.findIndex(l => /skills/i.test(l));
                if (skillsIdx !== -1) {
                    for (let k = skillsIdx + 1; k < Math.min(lines.length, skillsIdx + 12); k++) {
                        const ll = lines[k];
                        if (/^(?:[-•–*]|\d+\.)\s+/.test(ll)) strengths.push(ll.replace(/^(?:[-•–*]|\d+\.)\s+/, ''));
                        else if (/^[A-Z][A-Za-z\s]{3,}$/.test(ll)) break;
                    }
                }
                return Array.from(new Set(strengths)).slice(0, 10);
            } catch (e) {
                return strengths;
            }
        }

        // Merge strengths from any uploaded resume file (filename contains 'resume')
        function mergeResumeStrengthsFromUploads() {
            const entries = Object.entries(appState.fileContents || {});
            const resumeEntries = entries.filter(([name]) => /resume/i.test(name));
            if (!resumeEntries.length) return;
            let resumeText = '';
            resumeEntries.forEach(([name, content]) => { if (content) resumeText += '\n' + content; });
            if (!resumeText.trim()) return;
            const extra = extractStrengthsFromResumeText(resumeText) || [];
            if (!extra.length) return;
            const curr = Array.isArray(appState.extractedData.strengths) ? appState.extractedData.strengths : [];
            const merged = Array.from(new Set([...curr, ...extra])).slice(0, 18);
            appState.extractedData.strengths = merged;
        }

        // Infer role from uploaded resume files if not otherwise found
        function inferRoleFromResumeUploads() {
            const entries = Object.entries(appState.fileContents || {});
            const resumeEntries = entries.filter(([name]) => /resume/i.test(name));
            if (!resumeEntries.length) return '';
            const combined = resumeEntries.map(([n,c]) => c || '').join('\n');
            return inferRoleFromResumeText(combined);
        }

        function inferRoleFromResumeText(text) {
            if (!text) return '';
            const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            // Common title patterns
            const titleRx = new RegExp(
                '(?:Senior|Lead|Principal|Staff|Sr\.?|Jr\.?)?\s*' +
                '(?:BI|Business Intelligence|Data|Analytics|Reporting)\s*' +
                '(?:Analyst|Engineer|Scientist|Manager|Architect)',
                'i'
            );
            const genericRx = /(Analyst|Engineer|Scientist|Manager)/i;
            // Prefer lines near the top or labeled Experience with dates
            const dateRx = /(20\d{2}|201\d|202\d).*?(Present|Current|\d{4})/i;

            // 1) Look for a line with title + dates (most recent experience)
            const dated = lines.find(l => titleRx.test(l) && dateRx.test(l));
            if (dated) return (dated.match(titleRx) || [''])[0].trim();

            // 2) Look in the first 40 lines for a title match
            for (let i = 0; i < Math.min(lines.length, 40); i++) {
                const l = lines[i];
                if (titleRx.test(l)) return (l.match(titleRx) || [''])[0].trim();
            }

            // 3) Fallback: any title line
            const any = lines.find(l => titleRx.test(l) || genericRx.test(l));
            if (any) return (any.match(titleRx) || any.match(genericRx) || [''])[0].trim();

            return '';
        }

        // Build metric tiles for the Command Center grid from key-metrics CSV
        async function loadMetricsForCommandCenter() {
            try {
                const res = await fetch('input_files/google_interview_key_metrics.csv');
                if (!res.ok) return [];
                const csv = await res.text();
                await ensurePapaParse();
                const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true }).data;

                // Map first 6 meaningful rows to stat tiles
                const tiles = parsed.slice(0, 6).map(row => ({
                    value: row['Value'] || '',
                    label: row['Category'] || '',
                    context: row['Source'] || ''
                })).filter(t => t.value && t.label);
                return tiles;
            } catch (e) {
                return [];
            }
        }

        // Infer company/role hints from available inputs without hard-coding content
        async function inferCompanyAndRoleFromFiles(intel) {
            let company = '';
            let role = '';
            try {
                // Infer company from intel text if possible
                const md = intel?.markdown || '';
                if (/Google Play|Google\b/i.test(md)) company = 'Google';

                // Infer role from presence of JD or strategy docs
                // If a JD with role in filename is present, use that
                const jdPaths = [
                    'input_files/JD - Google - Data Analyst.pdf'
                ];
                for (const p of jdPaths) {
                    try {
                        const r = await fetch(p);
                        if (r.ok) { role = 'Data Analyst'; break; }
                    } catch (e) { /* ignore */ }
                }

                // If strategy docs reference BI role, fall back to BI/Data Analyst
                if (!role) {
                    try {
                        const r = await fetch('input_files/Strategic Intelligence Analysis - Google Play BI Role.md');
                        if (r.ok) role = 'BI/Data Analyst';
                    } catch (e) { /* ignore */ }
                }
            } catch (e) { /* ignore */ }
            return { company, role };
        }

        // Extract panelists from DOCX/PDF materials using simple heuristics
        async function loadPanelistsFromDocuments() {
            console.log('🔍 Loading panelists from job description and other files...');
            let panelists = [];
            let panelistQuestions = {};
            
            // First try to load from JD file
            try {
                const jdRes = await fetch('input_files/JD - Google - Data Analyst.md');
                if (jdRes.ok) {
                    const jdText = await jdRes.text();
                    const jdPanelists = extractPanelistsFromJD(jdText);
                    panelists.push(...jdPanelists);
                    console.log(`✅ Extracted ${jdPanelists.length} panelists from JD file`);
                }
            } catch (e) {
                console.log('⚠️ Could not load JD file:', e);
            }
            
            // Also try to load enhanced panelist info from Q&A file
            try {
                const qaRes = await fetch('input_files/Google Q&A Bank.md');
                if (qaRes.ok) {
                    const qaText = await qaRes.text();
                    const qaPanelists = extractPanelistsFromQAFile(qaText);
                    
                    // Merge with existing panelists
                    qaPanelists.forEach(qaPanelist => {
                        const existing = panelists.find(p => p.name === qaPanelist.name);
                        if (existing) {
                            Object.assign(existing, qaPanelist); // Merge additional details
                        } else {
                            panelists.push(qaPanelist);
                        }
                    });
                    console.log(`✅ Enhanced panelist info from Q&A file`);
                }
            } catch (e) {
                console.log('⚠️ Could not enhance from Q&A file:', e);
            }
            
            // Fallback to other sources if needed
            if (panelists.length === 0) {
                console.log('🔍 Trying alternative panelist sources...');
                const { text } = await fetchTextForCandidates([
                    'input_files/Strategic Intelligence Analysis - Google Play BI Role.md',
                    'input_files/Strategic Intelligence Analysis - Google Play BI Role.docx',
                    'input_files/Strategic Intelligence Analysis Google Play BI.md',
                    'input_files/Google - Interview Playbook.md',
                    'input_files/Google - Interview Playbook.docx'
                ]);
                const fallbackData = parsePanelistsAndQuestionsFromText(text);
                panelists = fallbackData.panelists || [];
                panelistQuestions = fallbackData.panelistQuestions || {};
            }
            
            return { panelists, panelistQuestions };
        }

        function extractPanelistsFromJD(content) {
            console.log('📖 Parsing panelists from JD content...');
            const panelists = [];
            const lines = content.split(/\r?\n/);
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                
                // Look for interviewer patterns in JD
                if (line.includes('Nikki Diman')) {
                    const emailMatch = line.match(/<([^>]+)>/);
                    panelists.push({
                        name: 'Nikki Diman',
                        role: 'Service Delivery Manager (Primary)',
                        email: emailMatch ? emailMatch[1] : 'ndiman@xwf.google.com',
                        company: 'Google via Scalence LLC',
                        type: 'Primary Interviewer'
                    });
                    console.log('👤 Found Nikki Diman');
                } else if (line.includes('Brian Mauch')) {
                    const emailMatch = line.match(/<([^>]+)>/);
                    panelists.push({
                        name: 'Brian Mauch',
                        role: 'Associate Director of Recruiting (Optional)',
                        email: emailMatch ? emailMatch[1] : 'brian.mauch@scalence.com',
                        company: 'Scalence LLC',
                        type: 'Optional Interviewer'
                    });
                    console.log('👤 Found Brian Mauch');
                } else if (line.includes('Jolly Jayaprakash')) {
                    panelists.push({
                        name: 'Jolly Jayaprakash',
                        role: 'Recruiter',
                        email: '',
                        company: 'Scalence LLC',
                        type: 'Recruiter'
                    });
                    console.log('👤 Found Jolly Jayaprakash');
                }
            }
            
            return panelists;
        }

        function extractPanelistsFromQAFile(content) {
            console.log('📖 Extracting comprehensive panelist profiles from Q&A file...');
            const panelists = [];
            const lines = content.split(/\r?\n/);
            
            let currentPanelist = null;
            let isInPanelistSection = false;
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                
                // Look for panelist sections like "### **NIKKI DIMAN - Service Delivery Manager**"
                const panelistMatch = line.match(/### \*\*([A-Z\s]+) - (.+)\*\*/);
                if (panelistMatch) {
                    if (currentPanelist) {
                        panelists.push(currentPanelist);
                    }
                    
                    const rawName = panelistMatch[1].trim();
                    const rawRole = panelistMatch[2].trim();
                    
                    // Normalize names to proper capitalization
                    let name = rawName;
                    let archetype = 'Champion';
                    
                    if (rawName.includes('NIKKI DIMAN')) {
                        name = 'Nikki Diman';
                        archetype = 'Gatekeeper';
                    } else if (rawName.includes('BRIAN MAUCH')) {
                        name = 'Brian Mauch'; 
                        archetype = 'Technical Validator';
                    } else if (rawName.includes('JOLLY JAYAPRAKASH')) {
                        name = 'Jolly Jayaprakash';
                        archetype = 'Process Champion';
                    }
                    
                    currentPanelist = {
                        name: name,
                        role: rawRole,
                        archetype: archetype,
                        hotButtons: '',
                        background: '',
                        likelyQuestions: '',
                        responseStyle: '',
                        motivation: '',
                        anxiety: '',
                        interviewStyle: '',
                        questions: []
                    };
                    
                    // Set motivation and anxiety based on profiles
                    if (name === 'Nikki Diman') {
                        currentPanelist.motivation = 'Assessing cross-functional collaboration skills and creative problem-solving with minimal data';
                        currentPanelist.anxiety = 'Generic answers without showing thought process or stakeholder awareness';
                        currentPanelist.interviewStyle = 'Scenario-based problems with business context emphasis';
                    } else if (name === 'Brian Mauch') {
                        currentPanelist.motivation = 'Validating technical depth and scalability experience for Google-scale challenges';
                        currentPanelist.anxiety = 'Lack of concrete technical experience or optimization strategies';
                        currentPanelist.interviewStyle = 'Technical validation with architecture focus';
                    } else if (name === 'Jolly Jayaprakash') {
                        currentPanelist.motivation = 'Ensuring candidate availability and cultural fit for Google pace';
                        currentPanelist.anxiety = 'Scheduling conflicts or lack of role enthusiasm';
                        currentPanelist.interviewStyle = 'Logistics and availability focused';
                    }
                    
                    isInPanelistSection = true;
                    console.log(`👤 Found comprehensive profile for: ${currentPanelist.name} (${currentPanelist.archetype})`);
                    continue;
                }
                
                // Extract panelist details
                if (isInPanelistSection && currentPanelist) {
                    if (line.startsWith('**Hot Buttons:**')) {
                        currentPanelist.hotButtons = line.replace(/^\*\*Hot Buttons:\*\*\s*/, '');
                    } else if (line.startsWith('**Background:**')) {
                        currentPanelist.background = line.replace(/^\*\*Background:\*\*\s*/, '');
                    } else if (line.startsWith('**Likely Questions:**')) {
                        currentPanelist.likelyQuestions = line.replace(/^\*\*Likely Questions:\*\*\s*/, '');
                        // Convert to array for questions
                        currentPanelist.questions = currentPanelist.likelyQuestions.split(',').map(q => q.trim()).filter(q => q);
                    } else if (line.startsWith('**Response Style Needed:**')) {
                        currentPanelist.responseStyle = line.replace(/^\*\*Response Style Needed:\*\*\s*/, '');
                    } else if (line.startsWith('### ') || line.startsWith('## ')) {
                        isInPanelistSection = false;
                    }
                }
            }
            
            // Don't forget the last panelist
            if (currentPanelist) {
                panelists.push(currentPanelist);
            }
            
            return panelists;
        }

        function parsePanelistsAndQuestionsFromText(text) {
            if (!text) return { panelists: [], panelistQuestions: {} };
            const rawLines = text.split(/\r?\n/).map(l => l.trim());

            // Prefer Interviewer sections
            let startIdx = rawLines.findIndex(l => /INTERVIEWER\s+DOSSIERS/i.test(l));
            if (startIdx === -1) startIdx = rawLines.findIndex(l => /INTERVIEWER[-\s]+SPECIFIC\s+CALIBRATION/i.test(l));
            if (startIdx === -1) startIdx = rawLines.findIndex(l => /^#+\s*INTERVIEWERS?/i.test(l));
            let endIdx = -1;
            if (startIdx !== -1) {
                for (let i = startIdx + 1; i < rawLines.length; i++) {
                    const L = rawLines[i];
                    // Heuristic: next big uppercase header or tab name stops the section
                    if (/^(PANEL STRATEGY|SQL PRACTICE|STAR STORIES|Q&A BANK|COMPANY INTEL|COMMAND CENTER|90-DAY PLAN|WAR ROOM|DEBRIEF)\b/i.test(L)) { endIdx = i; break; }
                    if (/^[A-Z0-9][A-Z0-9\s:&/\-]{10,}$/.test(L)) { endIdx = i; break; }
                }
            }
            const fixBrokenCaps = s => s.replace(/\b([A-Z])\s+([A-Z][A-Z]+)\b/g, '$1$2');
            const lines = (startIdx !== -1 ? rawLines.slice(startIdx, endIdx > startIdx ? endIdx : startIdx + 250) : rawLines)
                .map(s => fixBrokenCaps(s.trim())).filter(Boolean);

            // Only roles used for panelists; exclude generic 'Analyst' to avoid false positives
            const roleHint = /(Recruiter|Service\s*Delivery\s*Manager|Associate\s*Director|Director|Manager|Data\s*Scientist|Scientist|Engineer|Architect|Product\s*Manager|Program\s*Manager)/i;
            const allowedRole = s => roleHint.test(s);
            const namePatternStrict = /^([A-Z][a-zA-Z'.-]+(?:\s+[A-Z][a-zA-Z'.-]+){1,2})$/; // 2-3 tokens
            const badNameTokens = /(Strategic|Industry|Average|Levels|Google|Resume|Analysis|Role|Document|JD|KPI|SQL|Data\s*Analyst)/i;
            const isAllCapsName = n => /^[A-Z][A-Z'.-]+(?:\s+[A-Z][A-Z'.-]+){1,2}$/.test(n);
            const toTitle = n => n.replace(/\s+/g,' ').toLowerCase().replace(/\b([a-z])/g, m => m.toUpperCase());
            const cleanName = n => {
                let name = n.trim().replace(/\s{2,}/g, ' ');
                if (isAllCapsName(name)) name = toTitle(name);
                return name;
            };
            const isLikelyPersonName = n => {
                const t = cleanName(n);
                return namePatternStrict.test(t) && !badNameTokens.test(t) && !/^Brandon(\s|$)/.test(t) && !/Abbott/i.test(t);
            };
            const results = [];
            const questionsMap = {};
            const push = (name, role) => {
                if (!name || !role) return;
                name = name.trim(); role = role.trim();
                if (!allowedRole(role)) return;
                if (!isLikelyPersonName(name)) return;
                name = cleanName(name);
                if (results.some(p => p.name.toLowerCase() === name.toLowerCase())) return;
                const archetype = determineArchetypeFromRole(role);
                results.push({ name, role, archetype });
            };

            // Pattern: "Name - Role" or "Name — Role" only
            for (const line of lines) {
                if (!/[–—-]/.test(line)) continue;
                let m = line.match(/^([A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){1,2}|[A-Z][A-Z'.-]+(?:\s+[A-Z][A-Z'.-]+){1,2})\s*[–—-]\s*([^\n]{3,160})$/);
                if (m) { push(m[1], m[2]); continue; }
            }

            const panelists = results.slice(0, 6);

            // Attempt to extract Motivation/Anxiety and Questions blocks near mentions
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                for (const p of panelists) {
                    if (line.toLowerCase().includes(p.name.toLowerCase())) {
                        const windowLines = lines.slice(Math.max(0, i - 6), i + 12);
                        const mot = windowLines.find(l => /^motivation\s*:/i.test(l));
                        const anx = windowLines.find(l => /^anxiety\s*:/i.test(l));
                        if (mot && !p.motivation) p.motivation = mot.replace(/^motivation\s*:\s*/i, '');
                        if (anx && !p.anxiety) p.anxiety = anx.replace(/^anxiety\s*:\s*/i, '');

                        // Questions: capture bullets after a header
                        let qIdx = windowLines.findIndex(l => /questions?\s*(to ask|for|:)/i.test(l));
                        if (qIdx !== -1) {
                            const qs = [];
                            for (let k = qIdx + 1; k < windowLines.length; k++) {
                                const ll = windowLines[k];
                                if (/^(?:[-•–*]|\d+\.)\s+/.test(ll)) qs.push(ll.replace(/^(?:[-•–*]|\d+\.)\s+/, ''));
                                else if (/^\s*$/.test(ll) || /^(motivation|anxiety|talking points|profile|dossier)\s*:/i.test(ll)) break;
                            }
                            if (qs.length) questionsMap[p.name] = qs.slice(0, 6);
                        }

                        // Talking points
                        let tIdx = windowLines.findIndex(l => /talking points\s*:|key messages\s*:/i.test(l));
                        if (tIdx !== -1) {
                            const tps = [];
                            for (let k = tIdx + 1; k < windowLines.length; k++) {
                                const ll = windowLines[k];
                                if (/^(?:[-•–*]|\d+\.)\s+/.test(ll)) tps.push(ll.replace(/^(?:[-•–*]|\d+\.)\s+/, ''));
                                else if (/^\s*$/.test(ll) || /^(motivation|anxiety|questions|profile|dossier)\s*:/i.test(ll)) break;
                            }
                            if (tps.length) p.talkingPoints = tps.slice(0, 5);
                        }
                    }
                }
            }

            return { panelists, panelistQuestions: questionsMap };
        }

        function determineArchetypeFromRole(role) {
            const r = String(role || '').toLowerCase();
            // Ally: recruiting functions
            if (/\b(recruiter|talent|hr|people\s*ops)\b/.test(r)) return 'Ally';
            // Champion: executives and leadership
            if (/\b(cio|cto|cfo|ceo|coo|cso|cmo|chief|vp|vice\s*president|president|director|head)\b/.test(r)) return 'Champion';
            if (/\b(manager|lead|owner)\b/.test(r)) return 'Champion';
            // Technical expert: hands-on technical roles
            if (/\b(architect|engineer|developer|scientist|analyst|bi\s*architect|data\s+engineer|data\s+scientist)\b/.test(r)) return 'Technical Expert';
            // Gatekeeper: coordination and process-centric roles
            if (/\b(program\s*coordinator|operations|coordinator|gate\s*keep|compliance|procurement)\b/.test(r)) return 'Gatekeeper';
            // Program Manager: treat as leadership by default
            if (/\bprogram\s*manager\b/.test(r)) return 'Champion';
            return 'Ally';
        }

        // Load specific Google interview prep data
        async function loadGoogleInterviewData() {
            try {
                // Enhanced Nikki Diman profile with specific intelligence from Strategic Analysis
                const nikkiDiman = {
                    name: 'Nikki Diman',
                    role: 'Service Delivery Manager / Program Manager (Primary Interviewer)',
                    archetype: 'Gatekeeper',
                    company: 'Google via Scalence LLC',
                    location: 'San Diego, California',
                    linkedin: '500+ connections, active in talent acquisition space',
                    experience: '19+ years in global recruiting, workforce management, and program implementation',
                    previousRole: 'Director of Recruiting at Artech LLC (2015-2024), high-volume global recruiting',
                    awards: 'Presidents Circle Winner (2018-2022) - top performance indicator',
                    currentRole: 'Program Manager at Google through Scalence LLC (July 2024-Present)',
                    expertise: 'Data analytics recruiting, RPO/BPO management, engineering talent acquisition',
                    interviewStyle: 'Scenario-based questions, focuses on cross-functional collaboration and data-driven problem solving',
                    managementStyle: 'Data-driven recruiting, global team leadership, relationship building',
                    strengths: 'Quality and velocity of talent delivery, stakeholder management, process improvement',
                    focusAreas: 'Cross-functional collaboration, performance management, global team coordination',
                    hotButtons: 'Scenario-based problem solving, stakeholder relationship management, data-driven approaches',
                    motivation: 'Assessing cross-functional collaboration skills and ability to work with diverse stakeholders',
                    anxiety: 'Candidates not genuinely interested in the role, lacking availability, or giving generic answers without Google Play context',
                    connectionPoints: [
                        'Both have extensive experience with data/analytics teams',
                        'Your media industry experience aligns with her background', 
                        'Shared focus on stakeholder relationship management',
                        'Your Lean Six Sigma background matches her process improvement experience'
                    ],
                    likelyQuestions: [
                        'How does your team balance standardized global metrics with local market insights for 220M+ Play Points members?',
                        'What strategies work best when Product, Engineering, and Marketing have conflicting priorities?',
                        'What specific AI initiatives are planned for Play Points personalization in the next 6-12 months?'
                    ]
                };

                // Brian Mauch (optional interviewer) - Enhanced profile from Strategic Intelligence
                const brianMauch = {
                    name: 'Brian Mauch',
                    role: 'Associate Director of Recruiting (Optional/Secondary Interviewer)',
                    archetype: 'Technical Expert',
                    company: 'Scalence LLC',
                    email: 'brian.mauch@scalence.com',
                    confidence: 'MEDIUM - Limited information available',
                    interviewPhase: 'Technical screening phase, secondary contact from job description',
                    expertise: 'Technical recruiting, likely has technical background for screening',
                    interviewStyle: 'Technical deep-dive questions, assessing hands-on SQL and analytical skills',
                    motivation: 'Evaluating technical competency and ability to handle Google Play scale challenges',
                    anxiety: 'Candidates who cannot demonstrate practical technical skills or explain complex concepts clearly',
                    focusAreas: 'SQL optimization, data modeling, BigQuery performance, technical problem-solving',
                    likelyQuestions: [
                        'How does the team approach balancing technical debt with rapid feature development?',
                        'What role do contractors typically play in driving strategic initiatives versus maintenance?',
                        'What are the biggest technical challenges in processing data for 220M+ Play Points members?'
                    ]
                };

                // Jolly Jayaprakash (recruiter) - Complete profile from 8/28 screening call transcript
                const jollyJayaprakash = {
                    name: 'Jolly Jayaprakash',
                    role: 'Recruiter (Initial Screening - COMPLETED 8/28/25)',
                    archetype: 'Ally',
                    company: 'Scalence LLC (10+ years, dedicated Google/Apple recruiting)',
                    location: 'Seattle, Washington',
                    experience: '10+ years with current company, dedicated Google and Apple client support for past couple years',
                    screeningDate: 'August 28, 2025 17:24:38 - 32 minute phone screening COMPLETED',
                    personalityTraits: 'Friendly, conversational, process-focused, prefers call/text over email (inbox overwhelmed)',
                    communicationStyle: 'Direct but warm, thorough in process explanation, transparent about constraints',
                    processDetails: {
                        rateNegotiated: '$55/hour W2 (stretched from $50 baseline, locked in system)',
                        benefits: 'Subsidized health/dental/vision, 13 Google holidays paid, 5 days PTO',
                        teamStructure: '2-3 other resources on same project, working with Google full-timers',
                        startTarget: 'Mid-September 2025',
                        interviewTurnaround: 'Less than 2 weeks'
                    },
                    interviewProcess: {
                        round1: '30min scenario-based with Service Delivery Manager (Nikki Diman)',
                        round2: '30min SQL coding interview (3 questions, expect to complete 2)',
                        round3: '30min combination with hiring manager',
                        scheduling: 'Monday/Tuesday 9am-2pm Pacific (12-5pm Eastern) preference'
                    },
                    roleInsights: [
                        'Google Play BI/Data Science group - critical high visibility project',
                        '100% SQL focused for first 6-12 months, team may expand to data science later',
                        'Google BigQuery primary platform, PLX dashboards (internal, similar to Power BI/Tableau)',
                        'Working with cross-functional teams, heavy stakeholder management',
                        'Creative problem-solving with minimal data emphasized',
                        'Contract only - no conversion to permanent, but no restrictions on applying to Google FTE roles'
                    ],
                    keyQuotes: [
                        'They just want to know how creative you can be with cross-functional teams',
                        'With these clients, its hard to really fetch data from all these stakeholders',
                        'How creative you can be and come up with a solution with minimal data',
                        'You are going to be working with huge amount of data sets',
                        'These interviews are heavy - scenario based questions like investigating customer churn spikes'
                    ],
                    establishedRapport: [
                        'Discussed your friend at Alphabet subsidiary (aerospace)',
                        'Your tech recruiter friend at Datadog - understands process complexity',
                        'Snowflake early adopter since 2018 - impressed',
                        'SQL expertise 8+ years, Python 8.5/9 out of 10',
                        'Southern background connection (she misses SoCal weather)'
                    ],
                    nextSteps: 'Send tailored resume, confirm rate, schedule first interview with Nikki Diman for Mon/Tues',
                    likelyQuestions: [
                        'Are you comfortable with the $55/hour rate and W2 setup?',
                        'How do you handle working with difficult stakeholders across time zones?',
                        'Walk me through investigating a customer churn spike scenario',
                        'What advanced SQL techniques do you use most frequently?',
                        'How do you approach creative problem-solving with limited data?'
                    ]
                };

                // Load these into the app state
                appState.extractedData.panelists = [nikkiDiman, brianMauch, jollyJayaprakash];

                // Load specific anticipated questions with STAR mappings
                const anticipatedQuestions = [
                    {
                        question: 'Tell me about a time you owned a KPI end-to-end and made it the cross-org source of truth.',
                        category: 'Behavioral',
                        difficulty: 'High',
                        prepNotes: 'Tests: metrics ownership; SLOs; exec-ready storytelling',
                        starLink: 'Daily KPI Email Automation',
                        followUps: 'methodology changes and baseline resets; backfill & comms plan',
                        confidence: 85
                    },
                    {
                        question: 'Describe a stakeholder conflict you resolved between Product desire for richer data and Legal/Privacy constraints.',
                        category: 'Behavioral',
                        difficulty: 'High',
                        prepNotes: 'Tests: conflict navigation; privacy/retention guardrails; approvals',
                        starLink: 'Privacy-Safe Pipeline Rebuild',
                        followUps: 'Privacy Sandbox limits; data minimization choices',
                        confidence: 80
                    },
                    {
                        question: 'Walk me through a high-stakes metric down incident before an exec readout—what did you do in the first hour?',
                        category: 'Behavioral',
                        difficulty: 'High',
                        prepNotes: 'Tests: incident triage; structured thinking; comms under uncertainty',
                        starLink: 'Release-Day Anomaly War-Room',
                        followUps: 'methodology vs. behavior drop; RCA & prevention checklist',
                        confidence: 90
                    },
                    {
                        question: 'SQL: Compute 7-day retention and ARPPU by acquisition cohort from events (installs, sessions, purchases). Optimize for BigQuery.',
                        category: 'Technical',
                        difficulty: 'High',
                        prepNotes: 'Tests: cohorting; window functions; joins; partition/cluster strategy',
                        starLink: 'Retention & Monetization Cohorts',
                        followUps: 'late events; timezone; bytes-scanned limits',
                        confidence: 95
                    },
                    {
                        question: 'Data model: Design the marts for Google Play Points analytics (earn, burn, tiers, quests, perks).',
                        category: 'Technical',
                        difficulty: 'High',
                        prepNotes: 'Tests: fact/dim design; SCD; event taxonomy; attribution',
                        starLink: 'Loyalty Mart Re-Design',
                        followUps: 'perk uptake/LTV; quests instrumentation & logging',
                        confidence: 85
                    },
                    {
                        question: 'What if you have to investigate a sudden significant spike in customer churn - what data points would you be looking into?',
                        category: 'Behavioral',
                        difficulty: 'High',
                        prepNotes: 'Tests: scenario-based thinking, cross-functional stakeholder management, creative problem-solving with minimal data (from Jolly transcript)',
                        starLink: 'Customer Retention Analysis - $3.2M Recovery',
                        followUps: 'customer tenure, customer lifetime value, segmentation approach, root cause methodology',
                        confidence: 95,
                        source: 'Jolly screening call - direct example question',
                        interviewRound: 'Round 1 - Scenario-based with Nikki Diman'
                    }
                ];

                appState.extractedData.questions = anticipatedQuestions;

                // Load detailed STAR stories from Interview Playbook
                const detailedStories = [
                    {
                        title: 'Customer Segmentation Driving $3.2M Revenue Impact',
                        situation: 'At Trulieve, we were hemorrhaging customers—18% quarterly churn threatening $5M in annual revenue while targeting aggressive 15% growth. As Senior Data Analyst, I inherited a fragmented customer base across 100+ dispensaries with no unified understanding of customer segments. Marketing was spraying generic campaigns while inventory sat idle in wrong locations.',
                        task: 'I was tasked with leveraging our 100M+ transaction records to create actionable customer and store personas that would drive both retention and acquisition strategies.',
                        action: 'I architected a comprehensive segmentation solution: Built Python pipelines processing 100M+ daily records using K-Means and Hierarchical Clustering. Created 8 distinct customer personas based on purchase frequency, basket size, and product preferences. Developed store-level heat maps showing persona concentration by location. Designed Power BI dashboards with drill-down capabilities for marketing and operations teams. Implemented automated alerts when customer behavior indicated churn risk.',
                        result: 'Achieved 12% improvement in customer acquisition and retention within 90 days, translating to $3.2M annual revenue increase. Inventory waste decreased by 20% through persona-based stocking. Marketing ROI improved 35% through targeted campaigns.',
                        additionalMetrics: 'Process Excellence: Python ML pipelines | Impact Scale: 100M+ daily records | Business Value: $3.2M revenue increase, 20% waste reduction | Technical Skills: K-Means clustering, BigQuery optimization',
                        googlePlayApplication: 'This directly parallels optimizing Play Points 220M members across 5 tiers. I would apply similar clustering techniques in BigQuery ML to identify why Gold members struggle reaching Platinum, creating targeted interventions to improve tier progression.',
                        fromDocuments: true
                    },
                    {
                        title: 'BigQuery Pipeline Automation at Scale',
                        situation: 'Home Depot was drowning in 500 million SKU records monthly, with analysts spending 80% of their time on manual data processing instead of insights. As Data Analyst on the Supply Chain team, I discovered our 2,000+ stores suffered 25% mis-ship rates due to delayed inventory visibility. Teams manually consolidated data from 15 different systems.',
                        task: 'Design and implement BigQuery-based ETL pipelines to automate SKU-level data processing while providing real-time inventory visibility through dashboards.',
                        action: 'I architected a comprehensive BigQuery solution: Designed partitioned tables by date with clustering on SKU_ID and store_location. Built Python Cloud Functions for automated data ingestion from 15 source systems. Created incremental MERGE statements processing only changed records. Optimized queries using CTEs and materialized views, reducing runtime from 10 minutes to 30 seconds. Developed Tableau dashboards with BigQuery direct connection for real-time monitoring.',
                        result: 'Reduced manual effort by 80%, saving 20+ hours weekly. Mis-ship rates dropped 25% within 60 days. Query performance improved 95%, enabling real-time decision-making. Annual savings exceeded $2M in labor costs alone.',
                        additionalMetrics: 'Technical Excellence: 95% query performance improvement | Efficiency: 80% manual effort reduction | Business Impact: $2M annual savings | Scale: 500M monthly records',
                        googlePlayApplication: 'This experience directly applies to building Play Points data marts. I would implement similar partitioning strategies for 220M member transactions, using clustering on member_id and tier_level for optimal query performance.',
                        fromDocuments: true
                    },
                    {
                        title: 'Cross-Functional Dashboard Adoption Success',
                        situation: 'Home Depot invested $500K in Tableau but only 15% of executives actually used the dashboards, relying instead on Excel exports. Despite powerful analytics capabilities, senior leaders continued requesting manual reports. The disconnect between technical capabilities and business adoption threatened our entire BI strategy.',
                        task: 'Drive adoption of self-service analytics among 200+ stakeholders ranging from C-suite to store managers.',
                        action: 'I implemented a comprehensive adoption strategy: Conducted stakeholder interviews identifying three distinct user personas. Redesigned dashboards with role-based views (executive, operational, analytical). Created 15-minute video tutorials for each persona group. Developed quick-reference guides with business scenarios, not technical features. Ran 50+ hands-on training sessions focusing on business decisions, not tool features. Established office hours for ongoing support.',
                        result: 'Achieved 30% adoption increase within 90 days. Manual report requests decreased 50%. Executives began referencing dashboard metrics in meetings. Time-to-insight improved from days to minutes.',
                        additionalMetrics: 'Stakeholder Management: 200+ users across 3 personas | Adoption Success: 30% increase in 90 days | Efficiency: 50% reduction in manual requests | Leadership Impact: Executive dashboard usage',
                        googlePlayApplication: 'With Play Points serving diverse stakeholders from Product to Marketing, I would apply this same persona-based approach to PLX dashboard design, ensuring each team sees metrics relevant to their decisions.',
                        fromDocuments: true
                    },
                    {
                        title: 'Lean Six Sigma Process Optimization',
                        situation: '40% of projects delayed at Theatro Labs, threatening $3M in contracts due to SDLC inefficiencies.',
                        task: 'Apply Lean Six Sigma to identify and eliminate process bottlenecks.',
                        action: 'Mapped workflows, eliminated redundant handoffs, automated QA checks, and implemented continuous improvement cycles.',
                        result: '30% improvement in delivery time, 15% profit increase, zero contract losses.',
                        additionalMetrics: 'Process Excellence: Six Sigma certified | Efficiency Focus: Google-aligned | Scaling: Systematic approach to identifying and eliminating bottlenecks | Business Impact: $3M contracts saved',
                        googlePlayApplication: 'This efficiency-first mindset aligns perfectly with Google Year of Efficiency focus and the need to streamline Play Points analytics workflows and support the teams rapid scaling needs as the loyalty program continues to grow.',
                        fromDocuments: true
                    }
                ];

                appState.extractedData.stories = detailedStories;

                // Update all tabs with existing renderers
                updatePanelStrategy();
                updateQuestionBank();
                updateQuestionList();
                updateStarStories();
                
                showToast('Google interview data loaded successfully!', 'success');
            } catch (error) {
                console.error('Error loading Google interview data:', error);
                showToast('Could not load interview data', 'error');
            }
        }

        // Enhanced Q&A interactivity functions
        function toggleQuestionDetail(index) {
            const idx = Number(index);
            if (Number.isNaN(idx)) return;
            const detailElement = document.getElementById(`question-detail-${idx}`);
            if (!detailElement) return;
            const chevronElement = document.getElementById(`chevron-${idx}`);

            const computed = typeof window !== 'undefined' && window.getComputedStyle ? window.getComputedStyle(detailElement) : null;
            const isHidden = detailElement.style.display === 'none' || (computed && computed.display === 'none');

            if (isHidden) {
                detailElement.style.display = 'block';
                if (chevronElement) {
                    chevronElement.style.transform = 'rotate(90deg)';
                    chevronElement.textContent = '▼';
                }
            } else {
                detailElement.style.display = 'none';
                if (chevronElement) {
                    chevronElement.style.transform = 'rotate(0deg)';
                    chevronElement.textContent = '▶';
                }
            }
        }

        function markPracticed(index) {
            showToast('Question marked as practiced! 🎯', 'success');
            // You could add logic here to track practiced questions
        }

        function addToReview(index) {
            showToast('Added to review list! 📌', 'success');
            // You could add logic here to maintain a review queue
        }

        // Interview Countdown Function
        async function initializeInterviewCountdown() {
            // Helper: parse "**Interview Date:** ..." from JD file and convert to Date with TZ
            function tzAbbrevToOffset(abbrev) {
                const map = {
                    EDT: '-04:00', EST: '-05:00',
                    PDT: '-07:00', PST: '-08:00',
                    CDT: '-05:00', CST: '-06:00',
                    MDT: '-06:00', MST: '-07:00'
                };
                return map[abbrev] || null;
            }

            function monthToNum(name) {
                const m = {
                    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
                    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12
                };
                return m[name.toLowerCase()] || null;
            }

            function pad(n) { return String(n).padStart(2, '0'); }

            function parseJDInterviewDate(raw) {
                // Expect formats like: "Tuesday, September 4, 2025 | 5:00 PM EDT"
                if (!raw) return null;
                try {
                    const cleaned = raw.replace(/^\s*[A-Za-z]+,\s*/, '').trim();
                    const [datePart, timePartRaw] = cleaned.split('|').map(s => s.trim());
                    if (!datePart || !timePartRaw) return null;

                    // datePart: "September 4, 2025"
                    const dp = datePart.match(/([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/);
                    if (!dp) return null;
                    const month = monthToNum(dp[1]);
                    const day = parseInt(dp[2], 10);
                    const year = parseInt(dp[3], 10);
                    if (!month || !day || !year) return null;

                    // timePartRaw: "5:00 PM EDT" or "12:30 PM EDT"
                    const tp = timePartRaw.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*([A-Z]{2,4})?/i);
                    if (!tp) return null;
                    let hour = parseInt(tp[1], 10);
                    const minute = parseInt(tp[2], 10);
                    const ampm = tp[3].toUpperCase();
                    const tzAbbrev = (tp[4] || '').toUpperCase();

                    if (ampm === 'PM' && hour !== 12) hour += 12;
                    if (ampm === 'AM' && hour === 12) hour = 0;

                    const offset = tzAbbrevToOffset(tzAbbrev) || '-04:00'; // default to EDT if unspecified
                    const iso = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00${offset}`;
                    return { iso, display: raw.trim() };
                } catch (e) {
                    return null;
                }
            }

            // Find JD file among uploaded files and parse date
            const jdEntry = Object.entries(appState.fileContents).find(([name]) => /jd/i.test(name));
            const countdownEl = document.getElementById('interviewCountdown');
            const dateTextEl = document.getElementById('interviewDateText');
            const labelEl = document.getElementById('interviewLabel');

            if (!jdEntry) {
                if (countdownEl) countdownEl.style.display = 'none';
                return;
            }

            const jdText = jdEntry[1] || '';
            const match = jdText.match(/(?:\*\*)?Interview Date:(?:\*\*)?\s*([^\n]+)/i);
            if (!match || !match[1]) {
                if (countdownEl) countdownEl.style.display = 'none';
                return;
            }

            const parsed = parseJDInterviewDate(match[1]);
            if (!parsed) {
                if (countdownEl) countdownEl.style.display = 'none';
                return;
            }

            const interviewDate = new Date(parsed.iso);
            if (dateTextEl) dateTextEl.textContent = parsed.display;
            if (labelEl) {
                const c = appState?.extractedData?.company || '';
                const r = appState?.extractedData?.role || '';
                labelEl.textContent = (c || r) ? `${c}${c && r ? ' ' : ''}${r} Interview` : 'Interview Countdown';
            }
            if (countdownEl) countdownEl.style.display = '';

            function updateCountdown() {
                const now = new Date();
                const timeDiff = interviewDate - now;
                if (timeDiff <= 0) {
                    const el = document.getElementById('countdownDisplay');
                    if (el) el.textContent = 'Interview Time!';
                    return;
                }
                const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
                let countdownText = '';
                if (days > 0) countdownText = `${days}d ${hours}h ${minutes}m`;
                else if (hours > 0) countdownText = `${hours}h ${minutes}m ${seconds}s`;
                else countdownText = `${minutes}m ${seconds}s`;
                const el = document.getElementById('countdownDisplay');
                if (el) el.textContent = countdownText;
            }

            // Clear any previous countdown interval to avoid duplicates
            if (window.__interviewCountdownInterval) {
                clearInterval(window.__interviewCountdownInterval);
            }

            // Update immediately and then every second
            updateCountdown();
            const countdownInterval = setInterval(() => {
                const element = document.getElementById('countdownDisplay');
                if (!element || interviewDate <= new Date()) {
                    clearInterval(countdownInterval);
                    return;
                }
                updateCountdown();
            }, 1000);
            window.__interviewCountdownInterval = countdownInterval;
        }
        
        // Mobile Navigation Functions
        function toggleMobileNav() {
            const overlay = document.querySelector('.mobile-nav-overlay');
            const menu = document.querySelector('.mobile-nav-menu');
            
            overlay.classList.add('show');
            menu.classList.add('open');
            document.body.style.overflow = 'hidden';
        }
        
        function closeMobileNav() {
            const overlay = document.querySelector('.mobile-nav-overlay');
            const menu = document.querySelector('.mobile-nav-menu');
            
            overlay.classList.remove('show');
            menu.classList.remove('open');
            document.body.style.overflow = '';
        }
        
        function switchTabMobile(tabName) {
            // Switch to the tab
            switchTab(tabName);
            
            // Update mobile nav active state
            document.querySelectorAll('.mobile-nav-item').forEach(item => {
                item.classList.remove('active');
            });
            document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
            
            // Close mobile nav
            closeMobileNav();
        }
        
        // Enhanced tab switching with mobile support
        function switchTab(tabName) {
            // Hide all tab content
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Remove active class from all tab buttons
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            
            // Show selected tab content
            const targetTab = document.getElementById(tabName);
            if (targetTab) {
                targetTab.classList.add('active');
            }
            
            // Add active class to selected tab button
            const targetBtn = document.querySelector(`[data-tab="${tabName}"]`);
            if (targetBtn) {
                targetBtn.classList.add('active');
            }
            
            // Scroll to top on tab switch for better mobile UX
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        
        // Close mobile nav when clicking outside
        document.addEventListener('click', function(event) {
            const mobileNavToggle = document.querySelector('.mobile-nav-toggle');
            const mobileNavMenu = document.querySelector('.mobile-nav-menu');
            
            if (!mobileNavToggle.contains(event.target) && !mobileNavMenu.contains(event.target)) {
                closeMobileNav();
            }
        });
        
        // Handle escape key to close mobile nav
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                closeMobileNav();
            }
        });
        
        // Update mobile nav active state when regular tabs are clicked
        document.addEventListener('DOMContentLoaded', function() {
            // Override existing tab button clicks to update mobile nav
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const tabName = this.getAttribute('data-tab');
                    
                    // Update mobile nav active state
                    document.querySelectorAll('.mobile-nav-item').forEach(item => {
                        item.classList.remove('active');
                    });
                    const mobileItem = document.querySelector(`.mobile-nav-item[data-tab="${tabName}"]`);
                    if (mobileItem) {
                        mobileItem.classList.add('active');
                    }
                });
            });
        });
