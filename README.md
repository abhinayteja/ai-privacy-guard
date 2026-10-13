# AI Privacy Guard (Phase 1)

> **See what you're about to share with AI — before it leaves your browser.**

AI Privacy Guard watches the ChatGPT message box, finds secrets and personal data **locally**, warns you, and redacts them **only if you ask it to**.

- No backend. No API calls. No analytics.
- Prompts, passwords, and keys are never stored or sent anywhere.
- Only anonymous daily counters (numbers) are saved in `chrome.storage.local`.

---

## Folder structure

```text
ai-privacy-guard/
├── manifest.json          # MV3 manifest — only the "storage" permission
├── README.md
├── src/
│   ├── content.js         # site adapters, input monitoring, warning UI, redaction flow
│   ├── detector.js        # local regex + context detection
│   ├── risk.js            # deterministic risk level
│   ├── redactor.js        # pure text replacement → [REDACTED_*]
│   └── styles.css         # warning card styles (scoped to #apg-root)
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── icons/
│   └── icon128.png
└── tests/
    └── detector.test.js   # no-dependency Node tests
```

## Install / run

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select the `ai-privacy-guard/` folder.
4. Pin the extension (puzzle icon → pin) to see the popup.
5. Open <https://chatgpt.com> (reload the tab if it was already open).
6. Paste something like:

   ```text
   Hello, explain this code.

   OPENAI_API_KEY=sk-xxxxxxxxxxxx
   email: test@example.com
   password: MyPassword123
   ```

7. A small card appears at the bottom-right → **Review & Redact** → **Redact selected**.

After editing the code, click the **↻ reload** icon on the extension card in `chrome://extensions`, then reload the ChatGPT tab.

### Run the tests

```bash
cd ai-privacy-guard
node tests/detector.test.js
```

## How detection works

1. `content.js` listens (capture phase) for `input`, `keyup`, `paste`, `drop`, `cut` events coming from the prompt box.
2. Scans are debounced (350 ms). The prompt text is read from the DOM in memory.
3. `detector.js` runs each rule's regex and then a **validator**, which handles context and false positives:
   - Placeholders are ignored (`YOUR_TOKEN_HERE`, `<password>`, `xxxx`, `os.environ[...]`, `process.env.X`, `string`, `null`, ...).
   - Card numbers must pass the **Luhn** check.
   - Phone numbers need a `+country` code, a common format, or a nearby keyword (`phone`, `mobile`, `call`, ...).
   - Connection strings are flagged only when they include credentials (`user:pass@`).
   - "password **is** X" only counts when X isn't a plain word (so "the password is strong" is ignored).
4. When matches overlap, the more specific rule wins (for example, a JWT beats a generic token).
5. `risk.js` works out the overall level (see below), and the card shows grouped findings.
6. **Review & Redact** lists every item with a masked preview (`sk-t••••••89`) and a checkbox. Nothing changes until you click **Redact selected**.
7. `redactor.js` swaps each value for `[REDACTED_<TYPE>]`. It keeps key names, so `password=X` becomes `password=[REDACTED_PASSWORD]`. `content.js` then writes the text back in a way ChatGPT's ProseMirror editor accepts. If that fails, you get a "Copy redacted text" fallback.

### Risk levels (deterministic)

| Condition | Level |
|---|---|
| No findings | LOW (no card) |
| Only emails / phones / cards | MEDIUM |
| Any API key, password, token, JWT, DB URL | HIGH |
| Private key, **or** 3+ distinct HIGH types | CRITICAL |

## Supported patterns

| Severity | Type | Examples |
|---|---|---|
| CRITICAL | Private key | `-----BEGIN (RSA/EC/OPENSSH) PRIVATE KEY-----` blocks |
| HIGH | API key | `sk-…`, `sk-proj-…`, `sk-ant-…`, AWS `AKIA…`, GitHub `ghp_…`/`github_pat_…`, Google `AIza…`, Slack `xox?-…`, Stripe `sk_live_…`, Hugging Face `hf_…`, `API_KEY=…`, `client_secret: …` |
| HIGH | Access token | `Bearer …`, `access_token=…`, `auth_token: …` |
| HIGH | JWT | `eyJ….eyJ….…` |
| HIGH | Password | `password=…`, `DB_PASSWORD=…`, `"password": "…"`, `pwd: …`, `my password is hunter2` |
| HIGH | Database URL | `postgres://user:pass@host`, `mysql://`, `mongodb+srv://`, `redis://`, `amqp://`, ... |
| MEDIUM | Email | `name@domain.tld` |
| MEDIUM | Phone | `+91 98765 43210`, `(555) 123-4567`, `555-123-4567`, `9876543210`, or numbers near "phone:" |
| MEDIUM | Card number | 13–19 digits, Luhn-valid |

## Privacy guarantees

- Permissions: only `storage`. The content script runs only on `chatgpt.com` / `chat.openai.com`.
- There is no `fetch`, `XMLHttpRequest`, or WebSocket anywhere in the extension.
- Detected values live only in memory, so the user can review and redact them. They are never logged or persisted.
- Stored data is limited to `{ settings: { enabled }, stats: { date, detected, redacted } }`.

## Adding a new AI site (later)

Register an adapter in `content.js` (or in a new file loaded before it):

```js
APG.sites.push({
  id: 'claude',
  name: 'Claude',
  matches: (loc) => loc.hostname === 'claude.ai',
  inputSelector: 'div.ProseMirror[contenteditable="true"]',
});
```

Then add the domain to `content_scripts.matches` in `manifest.json`.

## Known limitations

- **It warns; it doesn't block.** You can still press Enter and send a prompt without redacting.
- Detection is regex-based. Secrets without a recognizable format or keyword (for example, a bare random string) are missed. Unusual phrasing can also cause false positives.
- ChatGPT's DOM changes often. If the prompt selector changes, update `inputSelector` in the adapter.
- Very large pastes can be turned into a file attachment by ChatGPT, which isn't scanned. Text is scanned up to 100,000 characters.
- Files, images, and voice input aren't scanned.
- Writing redacted text back depends on ChatGPT accepting synthetic paste or DOM edits. If it doesn't, a copy fallback is shown.
- "Detected" counts are approximate. Editing text before a finding can shift its position and count it again.
# ai-privacy-guard
