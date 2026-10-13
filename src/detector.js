/**
 * AI Privacy Guard — detector.js
 *
 * Local, deterministic detection of sensitive data using regular
 * expressions plus light context checks. Nothing here touches the network
 * or storage. Works in the browser (content script) and in Node (tests).
 *
 * Public API (on globalThis.APG.detector):
 *   detect(text)  -> Finding[]   sorted by position, non-overlapping
 *   mask(value)   -> string      safe preview, e.g. "sk-p••••••56"
 *   TYPES         -> type metadata (label, severity, placeholder)
 *
 * Finding: { type, label, severity, start, end, value }
 *   `value` exists only in memory so the user can review/redact it.
 *   It must never be logged, stored, or transmitted.
 */
(function (root) {
  'use strict';

  const APG = (root.APG = root.APG || {});

  // Maximum characters scanned per analysis (keeps typing responsive on huge pastes).
  const MAX_SCAN_CHARS = 100000;

  const TYPES = {
    PRIVATE_KEY:  { label: 'Private Key',             severity: 'CRITICAL' },
    API_KEY:      { label: 'API Key',                 severity: 'HIGH' },
    TOKEN:        { label: 'Access Token',            severity: 'HIGH' },
    JWT:          { label: 'JWT Token',               severity: 'HIGH' },
    PASSWORD:     { label: 'Password',                severity: 'HIGH' },
    DATABASE_URL: { label: 'Database Connection URL', severity: 'HIGH' },
    CREDIT_CARD:  { label: 'Card Number',             severity: 'MEDIUM' },
    EMAIL:        { label: 'Email Address',           severity: 'MEDIUM' },
    PHONE:        { label: 'Phone Number',            severity: 'MEDIUM' },
  };
  Object.keys(TYPES).forEach((t) => { TYPES[t].placeholder = `[REDACTED_${t}]`; });

  /* ------------------------------------------------------------------ */
  /* Helpers                                                             */
  /* ------------------------------------------------------------------ */

  // Words that commonly follow "password:" / "token =" in docs & code
  // but are not real secrets.
  const STOPWORDS = new Set([
    'string', 'str', 'required', 'optional', 'null', 'none', 'nil', 'true', 'false',
    'undefined', 'empty', 'hidden', 'text', 'input', 'field', 'value', 'password',
    'passwd', 'secret', 'token', 'example', 'sample', 'dummy', 'placeholder',
    'changeme', 'redacted', 'masked', 'type', 'char', 'varchar', 'any', 'number',
    'boolean', 'object', 'test', 'demo', 'abc123', 'foo', 'bar',
  ]);

  function isPlaceholder(value) {
    if (typeof value !== 'string') return true;
    const v = value.trim();
    const lower = v.toLowerCase();
    if (!v) return true;
    if (STOPWORDS.has(lower)) return true;
    if (/^\[redacted_[a-z_]+\]$/i.test(v)) return true;                  // our own placeholders
    if (/^(?:<|\$\{|\{\{|\$[A-Za-z_]|%[sd(]|process\.env|os\.(?:environ|getenv)|getenv|env\.)/i.test(v)) return true;
    if (/[()[\]{}]/.test(v)) return true;                                  // function calls / indexing
    if (/^(?:\*+|\.+|#+|-+|_+|•+)$/i.test(v)) return true;                 // ****, ...., ----
    if (/^(?:your|enter|insert|put|my)[_-]?(?:own[_-]?)?(?:api[_-]?)?(?:password|pass|secret|key|token)s?(?:[_-]?here)?$/i.test(v)) return true;
    if (/^(?:your|enter|insert)[_-]/i.test(v) || /[_-]here$/i.test(v)) return true;
    if (/^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_.]*$/i.test(v) && !/\d/.test(v)) return true; // config.api_key
    return false;
  }

  function hasDigit(v) { return /\d/.test(v); }
  function isAllLetters(v) { return /^[A-Za-z]+$/.test(v); }

  function luhnValid(digits) {
    let sum = 0;
    let dbl = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let d = digits.charCodeAt(i) - 48;
      if (dbl) { d *= 2; if (d > 9) d -= 9; }
      sum += d;
      dbl = !dbl;
    }
    return sum % 10 === 0;
  }

  const PHONE_CONTEXT = /(?:phone|mobile|cell|tel|telephone|call|contact|whatsapp|sms|ph\.?|mob\.?)\b[^\n]{0,25}$/i;

  /* ------------------------------------------------------------------ */
  /* Rules                                                               */
  /*   priority: lower wins when two findings overlap (more specific).   */
  /*   group:    capture group that holds the sensitive value (0 = all). */
  /*   validate: (value, ctx) => boolean                                 */
  /* ------------------------------------------------------------------ */

  const RULES = [
    // ---- CRITICAL ----
    {
      type: 'PRIVATE_KEY', priority: 1,
      re: /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----[\s\S]*?(?:-----END (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----|$)/g,
      validate: (v) => (v.replace(/-----[^-]+-----/g, '').match(/[A-Za-z0-9+/=]/g) || []).length >= 40,
    },

    // ---- HIGH: well-known token formats ----
    {
      type: 'JWT', priority: 2,
      re: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
    },
    {
      // OpenAI / Anthropic / OpenRouter style: sk-..., sk-proj-..., sk-ant-..., sk-or-v1-...
      type: 'API_KEY', priority: 3,
      re: /\bsk-(?:proj-|svcacct-|admin-|ant-|or-v1-)?[A-Za-z0-9_-]{8,}/g,
      validate: (v) => !isPlaceholder(v),
    },
    { type: 'API_KEY', priority: 3, re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },                                    // AWS access key id
    { type: 'API_KEY', priority: 3, re: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{22,})/g },     // GitHub
    { type: 'API_KEY', priority: 3, re: /\bglpat-[A-Za-z0-9_-]{20,}\b/g },                                     // GitLab
    { type: 'API_KEY', priority: 3, re: /\bAIza[0-9A-Za-z_-]{35}/g },                                          // Google AI / Firebase
    { type: 'API_KEY', priority: 3, re: /\bxox[abposr]-[A-Za-z0-9-]{10,}/g },                                  // Slack
    { type: 'API_KEY', priority: 3, re: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}/g },                       // Stripe secret
    { type: 'API_KEY', priority: 3, re: /\bhf_[A-Za-z0-9]{30,}/g },                                            // Hugging Face
    { type: 'API_KEY', priority: 3, re: /\br8_[A-Za-z0-9]{30,}/g },                                            // Replicate
    { type: 'API_KEY', priority: 3, re: /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/g },                       // SendGrid
    { type: 'API_KEY', priority: 3, re: /\b(?:sb|sbp)_[a-z0-9]{20,}/g },                                       // Supabase

    {
      // Database connection strings (Postgres, MySQL, MongoDB, Redis, Cockroach, MSSQL, AMQP, etc.)
      type: 'DATABASE_URL', priority: 3,
      re: /\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|rediss?|mssql|sqlserver|amqps?|cockroachdb)(?:\+[a-z0-9]+)?:\/\/[^\s"'<>`]+/gi,
      validate: (v, ctx) => {
        // Has credentials in URL (scheme://user:pass@host or scheme://:pass@host or scheme://user@host)
        if (/:\/\/[^/\s@]+@/.test(v)) {
          return !/:\/\/[^/\s@]*<[^>]+>@/.test(v) && !/:\/\/[^/\s@]*\$\{[^}]+\}@/.test(v);
        }
        // Or assigned to a database URL variable (DATABASE_URL = "postgres://...")
        const before = ctx.text.slice(Math.max(0, ctx.start - 35), ctx.start);
        if (/(?:database[_-]?url|db[_-]?url|connection[_-]?string|db[_-]?uri|mongodb[_-]?uri|postgres[_-]?url|redis[_-]?url)\s*[:=]\s*["']?$/i.test(before)) {
          return true;
        }
        return false;
      },
    },

    {
      type: 'TOKEN', priority: 4, group: 1,
      re: /\bBearer\s+([A-Za-z0-9\-._~+/]{12,}=*)/gi,
      validate: (v) => !isPlaceholder(v),
    },

    // ---- HIGH: context-based (keyword + assignment) ----
    {
      // password=..., "password": "...", DB_PASSWORD=..., my password is ...
      type: 'PASSWORD', priority: 5, group: 2,
      re: /(?<![A-Za-z])(?:password|passwd|passphrase|passcode|pwd|pass(?![A-Za-z0-9_]))(?:_[A-Za-z0-9]+)*["']?(\s*[:=]\s*|\s+(?:is|was)\s+)["'`]?([^\s"'`,;]{4,})/gi,
      validate: (v, ctx) => {
        if (isPlaceholder(v)) return false;
        if (/^\d{1,5}$/.test(v)) return false;               // "password_length = 12"
        // "the password is strong" → plain word, not a secret.
        if (/\b(?:is|was)\b/i.test(ctx.match[1]) && isAllLetters(v)) return false;
        return true;
      },
    },
    {
      // API_KEY=..., client_secret: ..., AZURE_OPENAI_KEY = ..., SUPABASE_KEY = ..., etc.
      type: 'API_KEY', priority: 6, group: 2,
      re: /(?<![A-Za-z0-9])[A-Za-z0-9_]*?(api[_-]?key|apikey|secret[_-]?key|client[_-]?secret|app[_-]?secret|api[_-]?secret|access[_-]?key(?:[_-]?id)?|private[_-]?key|auth[_-]?token|access[_-]?token|refresh[_-]?token|bearer[_-]?token|session[_-]?token|token|[a-z0-9_]+[_-]key|[a-z0-9_]+[_-]secret|[a-z0-9_]+[_-]token)[A-Za-z0-9_]*["']?\s*[:=]\s*["'`]?([^\s"'`,;]{8,})/gi,
      typeFrom: (m) => (/token/i.test(m[0]) ? 'TOKEN' : 'API_KEY'),
      validate: (v) => !isPlaceholder(v),
    },

    // ---- MEDIUM: personal data ----
    {
      type: 'CREDIT_CARD', priority: 7,
      re: /(?<![\d-])(?:\d[ -]?){12,18}\d(?![\d-])/g,
      validate: (v) => {
        const d = v.replace(/\D/g, '');
        return d.length >= 13 && d.length <= 19 && !/^(\d)\1+$/.test(d) && luhnValid(d);
      },
    },
    {
      type: 'EMAIL', priority: 8,
      re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/g,
      validate: (v) => !/^git@/i.test(v),
    },
    {
      type: 'PHONE', priority: 9,
      re: /(?<![\w+./-])\+?(?:\(\d{1,4}\)[ .-]?)?\d[\d .-]{6,16}\d(?![\w/-])/g,
      validate: (v, ctx) => {
        const d = v.replace(/\D/g, '');
        if (d.length < 10 || d.length > 15) return false;
        if (v.startsWith('+')) return true;
        const before = ctx.text.slice(Math.max(0, ctx.start - 40), ctx.start);
        if (PHONE_CONTEXT.test(before)) return true;
        return (
          /^\(\d{3}\) ?\d{3}[-. ]\d{4}$/.test(v) ||   // (555) 123-4567
          /^\d{3}-\d{3}-\d{4}$/.test(v) ||            // 555-123-4567
          /^\d{5} \d{5}$/.test(v) ||                   // 98765 43210
          /^[6-9]\d{9}$/.test(v)                       // 9876543210 (IN mobile)
        );
      },
    },
  ];

  /* ------------------------------------------------------------------ */
  /* Engine                                                              */
  /* ------------------------------------------------------------------ */

  // Trim trailing punctuation that is almost never part of a secret.
  function trimTrailing(value, start) {
    const trimmed = value.replace(/[.,!?;:)\]}>]+$/, '');
    return { value: trimmed, start, end: start + trimmed.length };
  }

  function detect(input) {
    if (typeof input !== 'string' || input.length < 4) return [];
    const text = input.length > MAX_SCAN_CHARS ? input.slice(0, MAX_SCAN_CHARS) : input;
    const candidates = [];

    for (const rule of RULES) {
      const flags = rule.re.flags.includes('d') ? rule.re.flags : rule.re.flags + 'd';
      const re = new RegExp(rule.re.source, flags); // fresh copy: no shared lastIndex
      let m;
      while ((m = re.exec(text)) !== null) {
        if (m[0].length === 0) { re.lastIndex++; continue; }
        const g = rule.group || 0;
        if (m[g] == null) continue;
        const span = trimTrailing(m[g], m.indices[g][0]);
        if (!span.value) continue;
        const ctx = { text, match: m, start: span.start };
        if (rule.validate && !rule.validate(span.value, ctx)) continue;
        const type = rule.typeFrom ? rule.typeFrom(m) : rule.type;
        candidates.push({
          type,
          label: TYPES[type].label,
          severity: TYPES[type].severity,
          start: span.start,
          end: span.end,
          value: span.value,
          _priority: rule.priority,
        });
      }
    }

    // Resolve overlaps: most specific rule first, then longest match.
    candidates.sort((a, b) => a._priority - b._priority || (b.end - b.start) - (a.end - a.start));
    const accepted = [];
    for (const c of candidates) {
      if (accepted.some((a) => c.start < a.end && a.start < c.end)) continue;
      accepted.push(c);
    }
    accepted.sort((a, b) => a.start - b.start);
    return accepted.map(({ _priority, ...f }) => f);
  }

  // Safe on-screen preview: keeps a few edge characters only.
  function mask(value) {
    const v = String(value).replace(/\s+/g, ' ');
    if (/^-----BEGIN/.test(v)) return '-----BEGIN … PRIVATE KEY----- (hidden)';
    const at = v.indexOf('@');
    if (at > 0 && /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v)) {
      return v[0] + '•'.repeat(Math.min(6, Math.max(2, at - 1))) + v.slice(at);
    }
    if (v.length <= 6) return v[0] + '•'.repeat(v.length - 1);
    const head = v.length > 14 ? 4 : 2;
    const tail = 2;
    return v.slice(0, head) + '•'.repeat(Math.min(10, v.length - head - tail)) + v.slice(-tail);
  }

  APG.detector = { detect, mask, TYPES, MAX_SCAN_CHARS };
})(typeof globalThis !== 'undefined' ? globalThis : this);
