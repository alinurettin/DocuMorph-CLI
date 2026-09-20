// DocuMorph-CLI v2.0.0 Interactive Studio Engine

let currentMode = 'markdown';
let activeView = 'rendered'; // 'rendered' or 'raw'
let rawOutputBuffer = '';
let eventSource = null;

const PRESETS = {
  markdown: `# Mathematical Physics & Distributed Systems

> "Simplicity is a prerequisite for reliability." — Edsger W. Dijkstra

Here is **bold emphasis**, *italic syntax*, and ~~deprecated protocols~~.

The Euler Identity is $e^{i\\pi} + 1 = 0$ and the Gaussian Normal Distribution is:

$$\\int_{-\\infty}^\\infty e^{-x^2} dx = \\sqrt{\\pi}$$

\`\`\`javascript
// Distributed Consensus Protocol
async function reachConsensus(nodes) {
  const quorum = Math.floor(nodes.length / 2) + 1;
  return { status: 'COMMITTED', quorum };
}
\`\`\`

| Node ID | Status | Role | Latency |
| --- | --- | --- | --- |
| node-1 | ONLINE | LEADER | 0.8ms |
| node-2 | ONLINE | FOLLOWER | 1.2ms |
| node-3 | ONLINE | FOLLOWER | 1.5ms |

- [x] Zero external dependencies
- [x] Sub-millisecond compilation
- [x] Publication-grade mathematical formatting
`,
  csv: `id,service_name,cluster_region,active,monthly_cost,description
1,"API Gateway","us-east-1",true,150.50,"Primary ingress controller, SSL termination"
2,"EventBus Broker","us-west-2",true,85.00,"Apache Kafka compatible pub/sub bus"
3,"DataDiff Reconciler","eu-west-1",false,0.00,"Anti-entropy Merkle repair, standby"
4,"VectorLite DB","ap-northeast-1",true,210.75,"Vector embeddings & similarity search"`,
  yaml: `service: DocuMorph-CLI
version: 2.0.0
cluster:
  region: us-east-1
  replicas: 3
  auto_scale: true
metrics:
  flesch_reading_ease: true
  token_ast: true
features:
  - markdown_latex
  - rfc_4180_csv
  - lcs_diff_engine`,
  diff: {
    orig: `function authenticateUser(req) {\n  const token = req.headers.authorization;\n  if (!token) throw new Error("Missing token");\n  return jwt.verify(token, SECRET);\n}`,
    mod: `function authenticateUser(req) {\n  const token = req.headers.authorization;\n  if (!token) {\n    logger.warn("Unauthorized attempt from " + req.ip);\n    throw new Error("Missing auth token");\n  }\n  return jwt.verify(token, process.env.JWT_SECRET);\n}`
  },
  metrics: `In computer science, software reliability describes the probability of failure-free software operation for a specified period of time in a specified environment. As systems scale across distributed clouds, maintaining consistency becomes challenging. Byzantine fault tolerance and anti-entropy reconciliation ensure data ledgers converge without centralized points of failure.`
};

document.addEventListener('DOMContentLoaded', () => {
  setupSSE();
  setupEventListeners();
  loadPreset();
});

// Setup Server-Sent Events (SSE)
function setupSSE() {
  const badge = document.getElementById('sseBadge');
  if (eventSource) eventSource.close();

  eventSource = new EventSource('/api/events/stream');

  eventSource.onopen = () => {
    badge.textContent = 'SSE: CONNECTED';
    badge.className = 'badge badge-active';
  };

  eventSource.onerror = () => {
    badge.textContent = 'SSE: DISCONNECTED';
    badge.className = 'badge badge-danger';
  };
}

// Load Preset
function loadPreset() {
  if (currentMode === 'diff') {
    document.getElementById('txtDiffOriginal').value = PRESETS.diff.orig;
    document.getElementById('txtDiffModified').value = PRESETS.diff.mod;
    runDiff();
  } else {
    document.getElementById('txtSourceInput').value = PRESETS[currentMode] || '';
    executeTransform();
  }
}

// Execute Transformation
async function executeTransform() {
  const input = document.getElementById('txtSourceInput').value;
  updateInputStats(input);

  // Auto-update metrics
  updateReadability(input);

  if (currentMode === 'markdown') {
    try {
      const res = await fetch('/api/transform/markdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown: input })
      });
      const data = await res.json();
      if (data.success) {
        document.getElementById('previewContainer').innerHTML = data.html;
        rawOutputBuffer = `// Semantic HTML5 Output:\n${data.html}\n\n// Abstract Syntax Tree (AST):\n${JSON.stringify(data.ast, null, 2)}`;
        document.getElementById('rawContainer').textContent = rawOutputBuffer;
        document.getElementById('lblOutputStats').textContent = `${(data.ast && data.ast.length) || 0} AST Nodes Generated`;
      }
    } catch (err) {
      document.getElementById('previewContainer').innerHTML = `<span class="danger">Error: ${escapeHtml(err.message)}</span>`;
    }
  } else if (currentMode === 'csv') {
    try {
      const res = await fetch('/api/transform/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: input, mode: 'markdown' })
      });
      const data = await res.json();

      const jsonRes = await fetch('/api/transform/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: input, mode: 'json' })
      });
      const jsonData = await jsonRes.json();

      if (data.success && jsonData.success) {
        // Render Markdown Table as HTML
        const tableHtmlRes = await fetch('/api/transform/markdown', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ markdown: data.table })
        });
        const tableHtml = await tableHtmlRes.json();

        document.getElementById('previewContainer').innerHTML = tableHtml.html || `<pre>${escapeHtml(data.table)}</pre>`;
        rawOutputBuffer = `// JSON Array Output:\n${JSON.stringify(jsonData.json, null, 2)}\n\n// Aligned Markdown Table:\n${data.table}`;
        document.getElementById('rawContainer').textContent = rawOutputBuffer;
        document.getElementById('lblOutputStats').textContent = `${jsonData.json.length} records parsed`;
      }
    } catch (err) {
      document.getElementById('previewContainer').innerHTML = `<span class="danger">Error: ${escapeHtml(err.message)}</span>`;
    }
  } else if (currentMode === 'yaml') {
    try {
      const res = await fetch('/api/transform/yaml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toJson', yaml: input })
      });
      const data = await res.json();
      if (data.success) {
        document.getElementById('previewContainer').innerHTML = `<pre><code>${escapeHtml(JSON.stringify(data.json, null, 2))}</code></pre>`;
        rawOutputBuffer = JSON.stringify(data.json, null, 2);
        document.getElementById('rawContainer').textContent = rawOutputBuffer;
        document.getElementById('lblOutputStats').textContent = 'Valid JSON Transpiled';
      }
    } catch (err) {
      document.getElementById('previewContainer').innerHTML = `<span class="danger">Error: ${escapeHtml(err.message)}</span>`;
    }
  } else if (currentMode === 'metrics') {
    updateReadability(input);
  }
}

// Compute Readability Metrics
async function updateReadability(text) {
  try {
    const res = await fetch('/api/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    const data = await res.json();
    if (data.success && data.metrics) {
      const m = data.metrics;
      document.getElementById('valWords').textContent = m.words;
      document.getElementById('valChars').textContent = `${m.characters} chars (${m.charactersNoSpaces} non-space)`;
      document.getElementById('valReadingEase').textContent = m.fleschReadingEase;
      document.getElementById('valGradeLevel').textContent = `Grade Level: ${m.fleschKincaidGrade}`;
      document.getElementById('valReadingTime').textContent = `${m.readingTimeMinutes}m`;

      if (currentMode === 'metrics') {
        let metricsHtml = `
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
            <div class="metric-card"><span class="m-label">TOTAL SENTENCES</span><span class="m-val">${m.sentences}</span></div>
            <div class="metric-card"><span class="m-label">PARAGRAPHS</span><span class="m-val">${m.paragraphs}</span></div>
            <div class="metric-card"><span class="m-label">AVG WORDS/SENTENCE</span><span class="m-val">${(m.words / Math.max(1, m.sentences)).toFixed(1)}</span></div>
            <div class="metric-card"><span class="m-label">READING EASE RATING</span><span class="m-val highlight">${getReadingEaseLabel(m.fleschReadingEase)}</span></div>
          </div>
        `;
        document.getElementById('previewContainer').innerHTML = metricsHtml;
        rawOutputBuffer = JSON.stringify(m, null, 2);
        document.getElementById('rawContainer').textContent = rawOutputBuffer;
      }
    }
  } catch (err) {
    console.error('Metrics failed:', err);
  }
}

function getReadingEaseLabel(score) {
  if (score >= 90) return 'Very Easy';
  if (score >= 80) return 'Easy';
  if (score >= 70) return 'Fairly Easy';
  if (score >= 60) return 'Standard';
  if (score >= 50) return 'Fairly Difficult';
  if (score >= 30) return 'Difficult';
  return 'Very Confusing';
}

// Run Diff
async function runDiff() {
  const textA = document.getElementById('txtDiffOriginal').value;
  const textB = document.getElementById('txtDiffModified').value;

  try {
    const res = await fetch('/api/diff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ textA, textB })
    });
    const data = await res.json();
    if (data.success && data.diff) {
      document.getElementById('txtUnifiedDiffOutput').textContent = data.diff.unifiedDiff;
    }
  } catch (err) {
    document.getElementById('txtUnifiedDiffOutput').textContent = 'Diff Error: ' + err.message;
  }
}

function updateInputStats(text) {
  const lines = text.split('\n').length;
  const chars = text.length;
  document.getElementById('lblInputStats').textContent = `${lines} lines | ${chars} chars`;
}

// Event Listeners
function setupEventListeners() {
  // Transform Button
  document.getElementById('btnTransform').addEventListener('click', () => {
    executeTransform();
  });

  // Load Preset Button
  document.getElementById('btnLoadPreset').addEventListener('click', () => {
    loadPreset();
  });

  // Mode Switch Tabs
  const tabs = document.querySelectorAll('#modeTabs .tab-btn');
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentMode = btn.getAttribute('data-mode');

      const diffBox = document.getElementById('diffContainer');
      const standardPanes = document.querySelector('.grid-two');

      if (currentMode === 'diff') {
        diffBox.classList.remove('hidden');
        standardPanes.classList.add('hidden');
      } else {
        diffBox.classList.add('hidden');
        standardPanes.classList.remove('hidden');
      }

      loadPreset();
    });
  });

  // Run Diff Button
  document.getElementById('btnRunDiff').addEventListener('click', () => {
    runDiff();
  });

  // Rendered vs Raw Toggle
  document.getElementById('btnViewRendered').addEventListener('click', () => {
    document.getElementById('btnViewRendered').classList.add('active');
    document.getElementById('btnViewRaw').classList.remove('active');
    document.getElementById('previewContainer').classList.remove('hidden');
    document.getElementById('rawContainer').classList.add('hidden');
  });

  document.getElementById('btnViewRaw').addEventListener('click', () => {
    document.getElementById('btnViewRaw').classList.add('active');
    document.getElementById('btnViewRendered').classList.remove('active');
    document.getElementById('rawContainer').classList.remove('hidden');
    document.getElementById('previewContainer').classList.add('hidden');
  });

  // Copy Output Button
  document.getElementById('btnCopyOutput').addEventListener('click', () => {
    const textToCopy = rawOutputBuffer || document.getElementById('previewContainer').innerText;
    navigator.clipboard.writeText(textToCopy).then(() => {
      alert('Output copied to clipboard!');
    }).catch(err => {
      alert('Copy failed: ' + err.message);
    });
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
