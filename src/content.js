/**
 * AI Privacy Guard — content.js
 *
 * Watches AI site prompt boxes across all supported platforms (ChatGPT, Claude,
 * Gemini, Perplexity, DeepSeek, Poe, Mistral, Copilot, Grok, HuggingChat, v0,
 * Open WebUI, Ollama, LibreChat, and all generic AI interfaces).
 *
 * Runs local detection, displays a sleek warning card, and redacts sensitive data
 * securely inside the browser without network calls.
 */
(function () {
  'use strict';

  const APG = globalThis.APG;
  if (!APG || !APG.detector || APG.__contentLoaded) return;
  APG.__contentLoaded = true;

  /* ================================================================== */
  /* 1. Site adapters — Targeted selectors & generic fallback           */
  /* ================================================================== */
  APG.sites = APG.sites || [];
  APG.sites.push(
    {
      id: 'chatgpt',
      name: 'ChatGPT',
      matches: (loc) => /(^|\.)chatgpt\.com$/.test(loc.hostname) || loc.hostname === 'chat.openai.com',
      inputSelector: '#prompt-textarea, [contenteditable="true"]#prompt-textarea, div.ProseMirror[contenteditable="true"], form textarea',
    },
    {
      id: 'claude',
      name: 'Claude',
      matches: (loc) => loc.hostname === 'claude.ai',
      inputSelector: 'fieldset div.ProseMirror[contenteditable="true"], div.ProseMirror[contenteditable="true"], div[contenteditable="true"], textarea',
    },
    {
      id: 'gemini',
      name: 'Gemini',
      matches: (loc) => loc.hostname === 'gemini.google.com',
      inputSelector: 'rich-textarea div[contenteditable="true"], div.ql-editor[contenteditable="true"], rich-textarea, textarea',
    },
    {
      id: 'perplexity',
      name: 'Perplexity',
      matches: (loc) => /(^|\.)perplexity\.ai$/.test(loc.hostname),
      inputSelector: 'textarea[placeholder*="Ask"], textarea, div[contenteditable="true"]',
    },
    {
      id: 'deepseek',
      name: 'DeepSeek',
      matches: (loc) => loc.hostname === 'chat.deepseek.com',
      inputSelector: '#chat-input, textarea, div[contenteditable="true"]',
    },
    {
      id: 'poe',
      name: 'Poe',
      matches: (loc) => /(^|\.)poe\.com$/.test(loc.hostname),
      inputSelector: 'textarea[class*="ChatMessageInput"], textarea, div[contenteditable="true"]',
    },
    {
      id: 'mistral',
      name: 'Mistral',
      matches: (loc) => /(^|\.)mistral\.ai$/.test(loc.hostname) || loc.hostname === 'chat.mistral.ai',
      inputSelector: 'textarea, div[contenteditable="true"]',
    },
    {
      id: 'huggingface',
      name: 'Hugging Chat',
      matches: (loc) => loc.hostname === 'huggingface.co' && loc.pathname.startsWith('/chat'),
      inputSelector: 'textarea, div[contenteditable="true"]',
    },
    {
      id: 'copilot',
      name: 'Copilot',
      matches: (loc) => /(^|\.)copilot\.microsoft\.com$/.test(loc.hostname),
      inputSelector: '#searchbox, textarea, div[contenteditable="true"]',
    },
    {
      id: 'grok',
      name: 'Grok',
      matches: (loc) => /(^|\.)grok\.com$/.test(loc.hostname) || /(^|\.)x\.com$/.test(loc.hostname),
      inputSelector: 'textarea, div[contenteditable="true"]',
    },
    {
      id: 'ai_coding',
      name: 'AI Coding Tools',
      matches: (loc) => /(^|\.)v0\.dev$/.test(loc.hostname) || /(^|\.)bolt\.new$/.test(loc.hostname) || /(^|\.)replit\.com$/.test(loc.hostname),
      inputSelector: 'textarea, div[contenteditable="true"]',
    },
    {
      id: 'local_ai',
      name: 'Local AI Tools',
      matches: (loc) => loc.hostname === 'localhost' || loc.hostname === '127.0.0.1' || loc.hostname.endsWith('.local'),
      inputSelector: 'textarea, div[contenteditable="true"]',
    },
    {
      id: 'generic',
      name: 'All Websites',
      matches: () => true,
      inputSelector: 'textarea, div[contenteditable="true"][role="textbox"], div[contenteditable="true"], div.ProseMirror[contenteditable="true"], div.ql-editor[contenteditable="true"]',
    }
  );

  const site = APG.sites.find((s) => s.matches(location));
  if (!site) return;

  /* ================================================================== */
  /* 2. Settings & anonymous stats (numbers only)                        */
  /* ================================================================== */
  let enabled = true;

  function extensionAlive() {
    try { return !!(chrome && chrome.runtime && chrome.runtime.id); } catch { return false; }
  }

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  async function loadSettings() {
    if (!extensionAlive()) return;
    try {
      const { settings } = await chrome.storage.local.get('settings');
      enabled = !settings || settings.enabled !== false;
    } catch { /* storage unavailable — keep default */ }
  }

  async function bumpStat(field, amount) {
    if (!amount || !extensionAlive()) return;
    try {
      const { stats } = await chrome.storage.local.get('stats');
      const today = todayKey();
      const s = stats && stats.date === today ? stats : { date: today, detected: 0, redacted: 0 };
      s[field] = (s[field] || 0) + amount;
      await chrome.storage.local.set({ stats: s });
    } catch { /* ignore */ }
  }

  if (extensionAlive()) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes.settings) return;
      enabled = !changes.settings.newValue || changes.settings.newValue.enabled !== false;
      if (!enabled) ui.hide(); else scheduleScan();
    });
  }

  /* ================================================================== */
  /* 3. Shadow DOM & Input Discovery                                     */
  /* ================================================================== */
  
  /**
   * Recursively pierces shadow roots to find the active focused element.
   */
  function getDeepActiveElement(root = document) {
    let active = root.activeElement;
    while (active && active.shadowRoot && active.shadowRoot.activeElement) {
      active = active.shadowRoot.activeElement;
    }
    return active;
  }

  /**
   * Checks if an element matches the site's input selector or is an editable prompt input.
   */
  function isTargetInput(el) {
    if (!el || !(el instanceof Element)) return false;
    if (el.matches && el.matches(site.inputSelector)) return true;
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return true;
    if (el.getAttribute && (el.getAttribute('contenteditable') === 'true' || el.getAttribute('role') === 'textbox')) return true;
    return false;
  }

  /**
   * Helper to search for matching inputs within shadow trees.
   */
  function queryShadowSelector(root, selector) {
    if (!root) return null;
    let found = root.querySelector ? root.querySelector(selector) : null;
    if (found) return found;
    const children = Array.from(root.querySelectorAll ? root.querySelectorAll('*') : []);
    for (const child of children) {
      if (child.shadowRoot) {
        found = queryShadowSelector(child.shadowRoot, selector);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Find the relevant prompt input box.
   */
  function findInput(from) {
    // 1. From event composedPath / target
    if (from) {
      if (from instanceof Element && from.closest) {
        const el = from.closest(site.inputSelector);
        if (el) return el;
      }
      if (isTargetInput(from)) return from;
    }

    // 2. Active focused element
    const deepActive = getDeepActiveElement();
    if (deepActive && isTargetInput(deepActive) && deepActive.id !== 'apg-root' && !deepActive.closest('#apg-root')) {
      return deepActive;
    }

    // 3. Query document & shadow roots
    return queryShadowSelector(document, site.inputSelector);
  }

  function isTextarea(el) {
    return el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT');
  }

  /**
   * Read text content from input or contenteditable element, preserving newlines.
   */
  function readText(el) {
    if (!el) return '';
    if (isTextarea(el)) return el.value || '';
    
    // Check block elements for ProseMirror/Quill/Draft.js/Lexical
    const blocks = el.querySelectorAll(':scope > p, :scope > div, :scope > pre, :scope > li');
    if (blocks.length > 0) {
      return Array.from(blocks, (b) => b.innerText || b.textContent || '').join('\n');
    }
    
    return el.innerText || el.textContent || '';
  }

  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /**
   * Replace the prompt with `text` safely across all editor implementations (React, ProseMirror, Lexical, Draft.js, etc.).
   */
  async function writeText(el, text) {
    suppressScan = true;
    try {
      if (isTextarea(el)) {
        const setter = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value') ||
                       Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
        if (setter && setter.set) {
          setter.set.call(el, text);
        } else {
          el.value = text;
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return norm(readText(el)) === norm(text);
      }

      // Rich text editors (contenteditable)
      el.focus();

      // Strategy A: Native execCommand for rich text editors (updates React/ProseMirror/Lexical state)
      try {
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          const range = document.createRange();
          range.selectNodeContents(el);
          sel.addRange(range);
        }
        const execSuccess = document.execCommand('insertText', false, text);
        if (execSuccess && norm(readText(el)) === norm(text)) {
          el.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        }
      } catch { /* fallback to strategy B */ }

      // Strategy B: Structured HTML paragraph replacement
      const html = text.split('\n').map((l) => `<p>${l ? escapeHtml(l) : '<br>'}</p>`).join('');
      el.innerHTML = html;
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText' }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      await wait(50);

      return norm(readText(el)) === norm(text);
    } catch {
      return false;
    } finally {
      setTimeout(() => { suppressScan = false; }, 150);
    }
  }

  /* ================================================================== */
  /* 4. Scanning Engine                                                  */
  /* ================================================================== */
  const dismissedKeys = new Set();
  const countedKeys = new Set();
  let lastFindings = [];
  let activeInput = null;
  let scanTimer = null;
  let suppressScan = false;

  const keyOf = (f) => `${f.type}@${f.start}`;

  function scheduleScan(target) {
    if (!enabled || suppressScan) return;
    const el = findInput(target);
    if (!el) return;
    activeInput = el;
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 250);
  }

  function scan() {
    if (!enabled || !activeInput || !activeInput.isConnected) {
      activeInput = findInput();
      if (!activeInput) return;
    }
    const text = readText(activeInput);
    const findings = APG.detector.detect(text);
    lastFindings = findings;

    if (findings.length === 0) {
      dismissedKeys.clear();
      countedKeys.clear();
      if (ui.mode !== 'done' && ui.mode !== 'error') ui.hide();
      return;
    }

    const fresh = findings.filter((f) => !countedKeys.has(keyOf(f)));
    fresh.forEach((f) => countedKeys.add(keyOf(f)));
    bumpStat('detected', fresh.length);

    if (ui.mode === 'review') return;
    const hasUndismissed = findings.some((f) => !dismissedKeys.has(keyOf(f)));
    if (!hasUndismissed) return;

    ui.showSummary(findings, APG.risk.assess(findings));
  }

  // Handle events including Shadow DOM composedPath
  ['input', 'keyup', 'paste', 'drop', 'cut', 'focusin', 'click'].forEach((type) => {
    document.addEventListener(type, (e) => {
      const path = e.composedPath ? e.composedPath() : [e.target];
      let targetEl = null;
      for (const node of path) {
        if (node instanceof Element && (isTargetInput(node) || node.closest?.(site.inputSelector))) {
          targetEl = node;
          break;
        }
      }
      if (targetEl) {
        scheduleScan(targetEl);
      }
    }, true);
  });

  /* ================================================================== */
  /* 5. Warning Card UI                                                 */
  /* ================================================================== */
  const SEVERITY_CLASS = { CRITICAL: 'critical', HIGH: 'high', MEDIUM: 'medium', LOW: 'low' };

  function h(tag, attrs, children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v);
      }
    }
    (children || []).forEach((c) => c && el.append(c));
    return el;
  }

  function shieldIcon() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'apg-shield');
    svg.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', 'M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Zm-1 5h2v6h-2V7Zm0 8h2v2h-2v-2Z');
    svg.append(p);
    return svg;
  }

  const ui = {
    root: null,
    mode: 'hidden',
    findings: [],
    risk: null,
    hideTimer: null,

    ensureRoot() {
      if (this.root && this.root.isConnected) return this.root;
      this.root = h('div', { id: 'apg-root', role: 'region', 'aria-live': 'polite', 'aria-label': 'AI Privacy Guard' });
      this.root.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.dismiss(); });
      document.documentElement.append(this.root);
      return this.root;
    },

    render(card, mode) {
      clearTimeout(this.hideTimer);
      this.mode = mode;
      const root = this.ensureRoot();
      root.replaceChildren(card);
    },

    hide() {
      clearTimeout(this.hideTimer);
      this.mode = 'hidden';
      if (this.root) this.root.replaceChildren();
    },

    header(title, risk) {
      return h('div', { class: 'apg-header' }, [
        h('div', { class: `apg-icon apg-${SEVERITY_CLASS[risk || 'HIGH']}` }, [shieldIcon()]),
        h('div', { class: 'apg-title', text: title }),
        h('button', { class: 'apg-icon-btn', type: 'button', title: 'Minimize', 'aria-label': 'Minimize', text: '–', onclick: () => this.minimize() }),
        h('button', { class: 'apg-icon-btn', type: 'button', title: 'Dismiss', 'aria-label': 'Dismiss', text: '×', onclick: () => this.dismiss() }),
      ]);
    },

    showSummary(findings, risk) {
      this.findings = findings;
      this.risk = risk;
      if (this.mode === 'minimized') { this.renderPill(); return; }

      const list = h('ul', { class: 'apg-list' }, risk.groups.map((g) =>
        h('li', { class: 'apg-item' }, [
          h('span', { class: `apg-dot apg-${SEVERITY_CLASS[g.severity]}` }),
          h('span', { class: 'apg-item-label', text: g.label }),
          g.count > 1 ? h('span', { class: 'apg-count', text: `×${g.count}` }) : null,
        ])
      ));

      const card = h('div', { class: 'apg-card' }, [
        this.header('Privacy Risk Detected', risk.level),
        h('p', { class: 'apg-sub', text: 'Sensitive details found in prompt:' }),
        list,
        h('div', { class: 'apg-risk' }, [
          h('span', { text: 'Risk Level' }),
          h('span', { class: `apg-badge apg-${SEVERITY_CLASS[risk.level]}`, text: risk.level }),
        ]),
        h('p', { class: 'apg-note', text: '🔒 Checked locally. No data leaves your browser.' }),
        h('div', { class: 'apg-actions' }, [
          h('button', { class: 'apg-btn apg-primary', type: 'button', id: 'apg-review-btn', text: 'Review & Redact', onclick: () => this.showReview() }),
          h('button', { class: 'apg-btn apg-ghost', type: 'button', id: 'apg-continue-btn', text: 'Continue', onclick: () => this.dismiss() }),
        ]),
      ]);
      this.render(card, 'summary');
    },

    renderPill() {
      const pill = h('button', {
        class: `apg-pill apg-${SEVERITY_CLASS[this.risk.level]}`, type: 'button', id: 'apg-pill',
        title: 'Show privacy warning',
        onclick: () => { this.mode = 'summary'; this.showSummary(this.findings, this.risk); },
      }, [shieldIcon(), h('span', { text: `${this.findings.length} risk${this.findings.length > 1 ? 's' : ''} · ${this.risk.level}` })]);
      this.render(pill, 'minimized');
    },

    minimize() { if (this.risk) this.renderPill(); },

    dismiss() {
      lastFindings.forEach((f) => dismissedKeys.add(keyOf(f)));
      this.hide();
    },

    showReview() {
      const snapshotText = readText(activeInput);
      const findings = APG.detector.detect(snapshotText);
      if (!findings.length) { this.hide(); return; }
      const selected = new Set(findings.map((_, i) => i));

      const redactBtn = h('button', { class: 'apg-btn apg-primary', type: 'button', id: 'apg-redact-btn' });
      const updateBtn = () => {
        redactBtn.textContent = `Redact selected (${selected.size})`;
        redactBtn.disabled = selected.size === 0;
      };

      const rows = findings.map((f, i) => {
        const cb = h('input', { type: 'checkbox', class: 'apg-check', id: `apg-cb-${i}` });
        cb.checked = true;
        cb.addEventListener('change', () => { cb.checked ? selected.add(i) : selected.delete(i); updateBtn(); });
        return h('li', { class: 'apg-review-item' }, [
          h('label', { for: `apg-cb-${i}`, class: 'apg-review-label' }, [
            cb,
            h('span', { class: `apg-dot apg-${SEVERITY_CLASS[f.severity]}` }),
            h('span', { class: 'apg-review-text' }, [
              h('span', { class: 'apg-item-label', text: f.label }),
              h('code', { class: 'apg-masked', text: APG.detector.mask(f.value) }),
            ]),
          ]),
          h('span', { class: 'apg-arrow', text: `→ ${APG.redactor.placeholderFor(f.type)}` }),
        ]);
      });

      redactBtn.addEventListener('click', () => this.applyRedaction(snapshotText, findings, selected));
      updateBtn();

      const card = h('div', { class: 'apg-card apg-wide' }, [
        this.header('Review before redacting', this.risk ? this.risk.level : 'HIGH'),
        h('p', { class: 'apg-sub', text: 'Selected items will be replaced with placeholders. Nothing changes until you click Redact.' }),
        h('ul', { class: 'apg-review-list' }, rows),
        h('div', { class: 'apg-actions' }, [
          redactBtn,
          h('button', { class: 'apg-btn apg-ghost', type: 'button', text: 'Back', onclick: () => {
            this.mode = 'summary';
            const f = APG.detector.detect(readText(activeInput));
            f.length ? this.showSummary(f, APG.risk.assess(f)) : this.hide();
          } }),
        ]),
      ]);
      this.render(card, 'review');
      redactBtn.focus();
    },

    async applyRedaction(snapshotText, findings, selected) {
      const el = activeInput && activeInput.isConnected ? activeInput : findInput();
      if (!el) { this.showError(null); return; }

      let current = readText(el);
      let chosen = findings.filter((_, i) => selected.has(i));
      if (current !== snapshotText) {
        const wanted = new Set(chosen.map((f) => `${f.type}\u0000${f.value}`));
        chosen = APG.detector.detect(current).filter((f) => wanted.has(`${f.type}\u0000${f.value}`));
      }

      const result = APG.redactor.redact(current, chosen);
      if (result.count === 0) { this.hide(); return; }

      const ok = await writeText(el, result.text);
      if (!ok) { this.showError(result.text); return; }

      bumpStat('redacted', result.count);
      current = null;
      this.showDone(result.count);
      setTimeout(() => {
        const rest = APG.detector.detect(readText(el));
        rest.forEach((f) => dismissedKeys.add(keyOf(f)));
        lastFindings = rest;
      }, 200);
    },

    showDone(count) {
      const card = h('div', { class: 'apg-card apg-compact' }, [
        h('div', { class: 'apg-header' }, [
          h('div', { class: 'apg-icon apg-low' }, [shieldIcon()]),
          h('div', { class: 'apg-title', text: `Redacted ${count} item${count > 1 ? 's' : ''}` }),
          h('button', { class: 'apg-icon-btn', type: 'button', 'aria-label': 'Close', text: '×', onclick: () => this.hide() }),
        ]),
        h('p', { class: 'apg-note', text: 'Review your message before sending.' }),
      ]);
      this.render(card, 'done');
      this.hideTimer = setTimeout(() => this.hide(), 3500);
    },

    showError(redactedText) {
      const actions = [];
      if (redactedText) {
        actions.push(h('button', { class: 'apg-btn apg-primary', type: 'button', text: 'Copy redacted text', onclick: async (e) => {
          try { await navigator.clipboard.writeText(redactedText); e.target.textContent = 'Copied ✓'; } catch { e.target.textContent = 'Copy failed'; }
        } }));
      }
      actions.push(h('button', { class: 'apg-btn apg-ghost', type: 'button', text: 'Close', onclick: () => this.hide() }));
      const card = h('div', { class: 'apg-card' }, [
        this.header("Couldn't update the message box", 'MEDIUM'),
        h('p', { class: 'apg-sub', text: 'The site did not accept the automatic edit. Copy the redacted version and paste it over your message.' }),
        h('div', { class: 'apg-actions' }, actions),
      ]);
      this.render(card, 'error');
    },
  };

  /* ================================================================== */
  /* 6. Start                                                            */
  /* ================================================================== */
  loadSettings();
})();

