/**
 * AI Privacy Guard — risk.js
 *
 * Deterministic risk scoring. Same findings in → same result out.
 *
 * Rules:
 *   - No findings                         → LOW
 *   - Overall level = highest severity found
 *   - 3+ distinct HIGH-severity types     → escalates to CRITICAL
 *   - score (0–100) = sum of per-finding weights, capped (for future UI/telemetry-free use)
 */
(function (root) {
  'use strict';

  const APG = (root.APG = root.APG || {});

  const LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const WEIGHTS = { LOW: 0, MEDIUM: 10, HIGH: 30, CRITICAL: 60 };

  function rank(level) { return LEVELS.indexOf(level); }

  /** Group findings by type for display, most severe first. */
  function summarize(findings) {
    const byType = new Map();
    for (const f of findings) {
      const g = byType.get(f.type) || { type: f.type, label: f.label, severity: f.severity, count: 0 };
      g.count++;
      byType.set(f.type, g);
    }
    return [...byType.values()].sort((a, b) => rank(b.severity) - rank(a.severity) || a.label.localeCompare(b.label));
  }

  function assess(findings) {
    if (!findings || findings.length === 0) {
      return { level: 'LOW', score: 0, groups: [] };
    }
    const groups = summarize(findings);
    let level = 'LOW';
    let score = 0;
    for (const f of findings) {
      if (rank(f.severity) > rank(level)) level = f.severity;
      score += WEIGHTS[f.severity] || 0;
    }
    const distinctHigh = groups.filter((g) => g.severity === 'HIGH').length;
    if (level === 'HIGH' && distinctHigh >= 3) level = 'CRITICAL';

    return { level, score: Math.min(100, score), groups };
  }

  APG.risk = { assess, summarize, LEVELS };
})(typeof globalThis !== 'undefined' ? globalThis : this);
