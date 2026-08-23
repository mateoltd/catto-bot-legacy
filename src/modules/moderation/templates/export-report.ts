/**
 * Self-contained HTML report template for case export.
 * Uses inline CSS only, no external dependencies
 */

interface ReportCase {
  caseNumber: number;
  guildId: string;
  action: string;
  targetTag: string;
  targetId: string;
  moderatorTag: string;
  moderatorId: string;
  reason: string | null;
  status: string;
  createdAt: string;
  duration: number | null;
}

interface ReportEvidence {
  id: string;
  type: string;
  status: string;
  originalFilename: string | null;
  url: string | null;
  description: string | null;
  uploadedByTag: string;
  createdAt: string;
  sizeBytes: number | null;
  contentHash: string | null;
  tags: string[];
  localFilename: string | null;
  amendments: ReportAmendment[];
}

interface ReportAmendment {
  action: string;
  amendedByTag: string;
  reason: string | null;
  newValue: string | null;
  createdAt: string;
}

export interface ExportReportData {
  modCase: ReportCase;
  evidence: ReportEvidence[];
  exportedAt: string;
  exportedBy: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

function formatSize(bytes: number | null): string {
  if (!bytes) return 'N/A';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function generateExportReport(data: ExportReportData): string {
  const { modCase, evidence, exportedAt, exportedBy } = data;

  const evidenceRows = evidence
    .map(
      (e) => `
      <tr>
        <td>${escapeHtml(e.type)}</td>
        <td>${escapeHtml(e.status)}</td>
        <td>${e.localFilename ? `<a href="evidence/${escapeHtml(e.localFilename)}">${escapeHtml(e.originalFilename ?? e.localFilename)}</a>` : escapeHtml(e.originalFilename ?? e.url ?? e.id)}</td>
        <td>${escapeHtml(e.description ?? '')}</td>
        <td>${escapeHtml(e.uploadedByTag)}</td>
        <td>${formatDate(e.createdAt)}</td>
        <td>${formatSize(e.sizeBytes)}</td>
        <td>${e.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join(' ')}</td>
        <td class="mono">${e.contentHash ? escapeHtml(e.contentHash.slice(0, 16)) + '...' : 'N/A'}</td>
      </tr>
      ${
        e.amendments.length > 0
          ? `<tr><td colspan="9"><div class="amendments"><strong>Amendments:</strong><ul>${e.amendments
              .map(
                (a) =>
                  `<li><strong>${escapeHtml(a.action)}</strong> by ${escapeHtml(a.amendedByTag)} at ${formatDate(a.createdAt)}${a.reason ? ` — ${escapeHtml(a.reason)}` : ''}</li>`
              )
              .join('')}</ul></div></td></tr>`
          : ''
      }`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Case #${modCase.caseNumber} — Export Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #111; color: #ccc; padding: 2rem; line-height: 1.5; }
    h1 { color: #fff; font-size: 1.5rem; margin-bottom: 0.5rem; }
    h2 { color: #fff; font-size: 1.1rem; margin: 1.5rem 0 0.75rem; border-bottom: 1px solid #333; padding-bottom: 0.5rem; }
    .meta { color: #888; font-size: 0.8rem; margin-bottom: 1.5rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
    .card { border: 1px solid #333; background: #1a1a1a; padding: 1rem; }
    .card label { display: block; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; color: #666; margin-bottom: 0.25rem; }
    .card p { color: #eee; font-size: 0.9rem; }
    .status { display: inline-block; padding: 0.125rem 0.5rem; font-size: 0.75rem; border: 1px solid; }
    .status-OPEN { border-color: #166534; color: #4ade80; }
    .status-CLOSED { border-color: #555; color: #999; }
    .status-VOID { border-color: #991b1b; color: #f87171; }
    table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
    th, td { border: 1px solid #333; padding: 0.5rem; text-align: left; vertical-align: top; }
    th { background: #1a1a1a; color: #fff; font-weight: 600; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; }
    td { color: #ccc; }
    td a { color: #60a5fa; text-decoration: none; }
    td a:hover { text-decoration: underline; }
    .mono { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.75rem; }
    .tag { display: inline-block; border: 1px solid #444; padding: 0 0.375rem; font-size: 0.7rem; color: #aaa; margin-right: 0.25rem; }
    .amendments { padding: 0.5rem; background: #151515; }
    .amendments ul { padding-left: 1.25rem; font-size: 0.8rem; color: #999; }
    .amendments li { margin-bottom: 0.25rem; }
    .footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #333; font-size: 0.75rem; color: #555; }
  </style>
</head>
<body>
  <h1>Case #${modCase.caseNumber}</h1>
  <div class="meta">
    ${escapeHtml(modCase.action)} — ${escapeHtml(modCase.targetTag)} | Exported ${formatDate(exportedAt)} by ${escapeHtml(exportedBy)}
  </div>

  <h2>Case Details</h2>
  <div class="grid">
    <div class="card">
      <label>Target</label>
      <p>${escapeHtml(modCase.targetTag)} <span style="color:#666">(${escapeHtml(modCase.targetId)})</span></p>
    </div>
    <div class="card">
      <label>Moderator</label>
      <p>${escapeHtml(modCase.moderatorTag)} <span style="color:#666">(${escapeHtml(modCase.moderatorId)})</span></p>
    </div>
    <div class="card">
      <label>Action</label>
      <p>${escapeHtml(modCase.action)}</p>
    </div>
    <div class="card">
      <label>Status</label>
      <p><span class="status status-${escapeHtml(modCase.status)}">${escapeHtml(modCase.status)}</span></p>
    </div>
    <div class="card">
      <label>Created</label>
      <p>${formatDate(modCase.createdAt)}</p>
    </div>
    ${modCase.duration ? `<div class="card"><label>Duration</label><p>${modCase.duration}s</p></div>` : ''}
    <div class="card" style="grid-column: 1 / -1;">
      <label>Reason</label>
      <p>${escapeHtml(modCase.reason ?? 'No reason provided')}</p>
    </div>
  </div>

  <h2>Evidence (${evidence.length})</h2>
  ${
    evidence.length > 0
      ? `<table>
      <thead>
        <tr>
          <th>Type</th><th>Status</th><th>File</th><th>Description</th><th>Uploaded By</th><th>Date</th><th>Size</th><th>Tags</th><th>Hash</th>
        </tr>
      </thead>
      <tbody>${evidenceRows}</tbody>
    </table>`
      : '<p style="color:#666">No evidence attached to this case.</p>'
  }

  <div class="footer">
    <p>Guild ID: ${escapeHtml(modCase.guildId)} — Report generated automatically. Evidence files are in the /evidence directory.</p>
  </div>
</body>
</html>`;
}
