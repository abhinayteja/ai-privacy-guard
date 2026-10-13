<div align="center">

  <img src="icons/icon128.png" width="96" height="96" alt="AI Privacy Guard Logo" />

  # 🛡️ AI Privacy Guard

  <p><strong>Real-time, client-side sensitive data detection and redaction for AI chatbots.</strong></p>

  <p>Catch API keys, credentials, database URLs, and personal data locally in your browser before you accidentally hit send.</p>

  <p>
    <a href="https://developer.chrome.com/docs/extensions/mv3/"><img src="https://img.shields.io/badge/Manifest-V3-4285F4?style=flat-square&logo=googlechrome&logoColor=white" alt="Manifest V3" /></a>
    <img src="https://img.shields.io/badge/Version-0.2.0-informational?style=flat-square" alt="Version 0.2.0" />
    <img src="https://img.shields.io/badge/JavaScript-ES2022-F7DF1E?style=flat-square&logo=javascript&logoColor=black" alt="JavaScript ES2022" />
    <a href="#development--testing"><img src="https://img.shields.io/badge/Tests-43%20Passing-brightgreen?style=flat-square&logo=node.js&logoColor=white" alt="Tests 43 Passing" /></a>
    <img src="https://img.shields.io/badge/Dependencies-0-success?style=flat-square" alt="Dependencies 0" />
    <img src="https://img.shields.io/badge/Network%20Calls-0%20(100%25%20Local)-blueviolet?style=flat-square" alt="100% Local" />
    <a href="#contributing"><img src="https://img.shields.io/badge/PRs-Welcome-brightgreen?style=flat-square" alt="PRs Welcome" /></a>
  </p>

  <p>
    <a href="#overview">Overview</a> •
    <a href="#the-problem--the-solution">Problem & Solution</a> •
    <a href="#key-features">Key Features</a> •
    <a href="#demonstration">Demonstration</a> •
    <a href="#architecture-overview">Architecture</a> •
    <a href="#how-detection-works">How It Works</a> •
    <a href="#supported-categories--platforms">Supported Platforms</a> •
    <a href="#installation">Installation</a> •
    <a href="#development--testing">Testing</a> •
    <a href="#privacy--security-considerations">Privacy & Security</a> •
    <a href="#limitations--warnings">Limitations</a> •
    <a href="#roadmap">Roadmap</a> •
    <a href="#contributing">Contributing</a> •
    <a href="#license">License</a>
  </p>

</div>

---

<a id="overview"></a>
## 📖 Overview

**AI Privacy Guard** is a lightweight, zero-dependency browser extension built on Chrome Manifest V3 that inspects prompt inputs on AI chatbot interfaces in real time.

When engineers, researchers, and everyday users interact with AI platforms, they frequently paste terminal outputs, code snippets, logs, and configuration blocks. These snippets often contain live API tokens, passwords, private keys, connection strings, or customer personal identifiable information (PII).

AI Privacy Guard runs **entirely in browser memory**. It evaluates your text as you type or paste, assigns an immediate risk score, alerts you with a non-intrusive floating UI, and enables you to sanitize sensitive findings with typed tokens (e.g., `[REDACTED_API_KEY]`) before they ever leave your machine.

---

<a id="the-problem--the-solution"></a>
## ⚠️ The Problem & The Solution

### The Problem
- **Irreversible Exposure**: Once sensitive credentials or customer PII are submitted to a public LLM or AI provider, they are logged on remote servers, visible in chat histories, and potentially incorporated into training corpora.
- **Accidental Pastes**: Developers routinely copy entire `.env` files, configuration objects, curl commands, and stack traces into prompts to ask questions without manually checking for embedded credentials.
- **Heavy or Leaky Tooling**: Many data loss prevention (DLP) solutions require routing traffic through enterprise proxies or uploading prompts to third-party security APIs—ironically introducing another third-party privacy risk.

### The Solution
- **Zero-Latency In-Memory Guardrails**: AI Privacy Guard executes lightweight regular expressions and heuristic validators locally inside the web page's content script sandbox.
- **No Third-Party Transmission**: The extension makes **zero network requests**. It has no backend API, no analytics scripts, and no telemetry pings.
- **Granular Redaction with Syntactic Integrity**: Rather than simply deleting text, it replaces values with typed semantic placeholders (such as `password=[REDACTED_PASSWORD]`), preserving code syntax and prompt context so the AI model can still provide an accurate answer.

---

<a id="key-features"></a>
## ✨ Key Features

- **100% Local Processing**: All pattern matching, validation, and redaction logic run strictly within your browser's V8 runtime.
- **Debounced Real-Time Monitoring**: Inspects `input`, `keyup`, `paste`, `drop`, and `cut` events with an efficient 250 ms debounce to prevent UI lag.
- **Deep Shadow DOM & Rich Editor Support**: Pierces nested shadow roots to monitor modern web editors, including ProseMirror, Lexical, Quill, and standard textareas.
- **Context-Aware Heuristics**: Distinguishes real credentials from documentation examples and variable names (e.g., ignores `YOUR_API_KEY`, `process.env.KEY`, `max_tokens = 1000`, or `"password is strong"`).
- **Algorithmic Validation**: Verifies payment card candidates against the **Luhn algorithm** and inspects database URLs for authentication credentials.
- **Deterministic Risk Scoring**: Evaluates findings into standardized risk levels (**LOW**, **MEDIUM**, **HIGH**, **CRITICAL**) based on token type and variety.
- **Selective Redaction Dialog**: Review detected items with masked previews (`sk-proj-••••••7a`) and toggle checkboxes to redact only what you choose.
- **Editor-Safe In-Place Replacement**: Updates the active editor via native selection and `insertText` commands to preserve undo/redo history, with an automatic clipboard copy fallback.
- **Minimalist Popup Controls**: Toggle real-time protection on or off and review daily local detection counts from a clean popup dashboard.
- **Zero Dependencies**: Pure vanilla JavaScript. No bundling steps, no runtime node modules, and no external CDNs.

---

<a id="demonstration"></a>
## 🖥️ Demonstration

### In-Page Workflow

```text
1. User pastes code into AI prompt box:
   ┌────────────────────────────────────────────────────────────────────────┐
   │ Explain this config:                                                   │
   │ OPENAI_API_KEY=sk-proj-9f8e7d6c5b4a3210                                │
   │ DATABASE_URL=postgres://admin:S3cret123!@db.internal:5432/production  │
   │ contact: dev-lead@company.com                                          │
   └────────────────────────────────────────────────────────────────────────┘

2. Injected Card appears at bottom-right:
   ┌──────────────────────────────────────────────┐
   │ 🛡️ Privacy Risk Detected                 –  ×│
   │ Sensitive details found in prompt:           │
   │   ● API Key                                  │
   │   ● Database Connection URL                  │
   │   ● Email Address                            │
   │ Risk Level: [ HIGH ]                         │
   │ 🔒 Checked locally. No data leaves browser.  │
   │ [ Review & Redact ]            [ Continue ]  │
   └──────────────────────────────────────────────┘

3. User clicks "Review & Redact" to selectively sanitize:
   ┌──────────────────────────────────────────────────────────┐
   │ 🛡️ Review before redacting                           –  ×│
   │ Selected items will be replaced with placeholders.       │
   │ [✓] ● API Key   sk-p••••••10    → [REDACTED_API_KEY]     │
   │ [✓] ● DB URL    post••••••on    → [REDACTED_DATABASE_URL]│
   │ [✓] ● Email     d••••••@company → [REDACTED_EMAIL]       │
   │ [ Redact selected (3) ]                         [ Back ] │
   └──────────────────────────────────────────────────────────┘

4. Result written safely back into the prompt:
   ┌────────────────────────────────────────────────────────────────────────┐
   │ Explain this config:                                                   │
   │ OPENAI_API_KEY=[REDACTED_API_KEY]                                      │
   │ DATABASE_URL=[REDACTED_DATABASE_URL]                                   │
   │ contact: [REDACTED_EMAIL]                                              │
   └────────────────────────────────────────────────────────────────────────┘
```

> [!NOTE]
> **Visual Assets Placeholder**: Screenshot and GIF walkthroughs of the extension active on ChatGPT and Claude will be added to `assets/` in an upcoming release. Contributors can submit UI screenshots via pull requests.

---

<a id="architecture-overview"></a>
## 🏗️ Architecture Overview

The extension operates across three decoupled modules: DOM event interception, pure functional pattern matching/risk calculation, and non-destructive editor mutation.

### Runtime Flow Diagram

```mermaid
flowchart TD
    subgraph Browser ["Web Browser Context"]
        A["User Inputs Prompt<br/>(Typing, Pasting, Drag-and-Drop)"] --> B["Capture Event Listener<br/>(input, keyup, paste, drop, cut)"]
        B --> C["Debounce Scheduler<br/>(250ms window)"]
        C --> D["DOM Input Extractor<br/>(Pierces Shadow DOM / Reads ContentEditable & Textarea)"]
    end

    subgraph DetectionEngine ["Detection Engine (In-Memory)"]
        D --> E["Regex Pattern Matcher<br/>(detector.js)"]
        E --> F["Heuristic Validators<br/>(Luhn Check, Stopwords, Env Templates, Context)"]
        F --> G["Conflict & Overlap Resolver<br/>(Priority & Match-Length Sorting)"]
        G --> H["Risk Assessment Engine<br/>(risk.js: LOW / MEDIUM / HIGH / CRITICAL)"]
    end

    subgraph UserInterface ["Injected UI (#apg-root)"]
        H --> I{"Findings Detected?"}
        I -- "No" --> J["Hide Card / Clear State"]
        I -- "Yes" --> K["Floating Warning Card or Minimized Pill"]
        K --> L{"User Action"}
        L -- "Dismiss / Continue" --> M["Suppress Warning for Findings"]
        L -- "Review & Redact" --> N["Review Dialog<br/>(Masked Previews & Checkboxes)"]
    end

    subgraph RedactionFlow ["Safe Redaction Pipeline (redactor.js)"]
        N --> O["User Confirms 'Redact selected'"]
        O --> P["Pure String Replacer<br/>(Replaces values with [REDACTED_*] tokens)"]
        P --> Q["In-Place Editor Writer<br/>(execCommand / Property Descriptor Setter)"]
        Q --> R{"Write Succeeded?"}
        R -- "Yes" --> S["Update Prompt & Show Success Toast"]
        R -- "No" --> T["Display Fallback Card:<br/>Copy Redacted Text to Clipboard"]
    end
```

### Component Structure

```mermaid
graph TD
    subgraph ExtensionPackage ["AI Privacy Guard Repository"]
        M["manifest.json<br/>(Manifest V3 • Permission: 'storage')"]
        
        subgraph ContentScript ["Injected Content Script (All URLs)"]
            C["src/content.js<br/>(Site adapters, shadow DOM traversal, UI lifecycle)"]
            D["src/detector.js<br/>(Regex rules, heuristics, Luhn validator, masking)"]
            RK["src/risk.js<br/>(Deterministic scoring & group categorization)"]
            RD["src/redactor.js<br/>(Pure functional placeholder substitution)"]
            S["src/styles.css<br/>(Encapsulated styles under #apg-root)"]
        end
        
        subgraph PopupUI ["Browser Action Popup"]
            PH["popup/popup.html<br/>(Dark interface)"]
            PC["popup/popup.css<br/>(Responsive styling)"]
            PJ["popup/popup.js<br/>(Settings toggle & local daily metrics)"]
        end
        
        subgraph TestSuite ["Automated Tests"]
            T["tests/detector.test.js<br/>(43 unit tests via Node.js • 0 dependencies)"]
        end
        
        subgraph Storage ["Browser Local Storage"]
            ST[("chrome.storage.local<br/>{ settings: { enabled }, stats: { date, detected, redacted } }")]
        end
    end

    C --> D
    C --> RK
    C --> RD
    C --> S
    PJ --> ST
    C --> ST
    T -.-> D
    T -.-> RK
    T -.-> RD
```

---

<a id="how-detection-works"></a>
## 🔬 How Detection Works

Detection is deterministic and multi-staged:

1. **Event Capture & Input Discovery**:
   - `content.js` attaches listeners for `input`, `keyup`, `paste`, `drop`, `cut`, `focusin`, and `click` in the capture phase.
   - It invokes `getDeepActiveElement()` and `queryShadowSelector()` to pierce open shadow roots and find the active editor.
2. **Debounce & Text Extraction**:
   - Updates are debounced at **250 ms**.
   - Input is read via `.value` (for standard inputs/textareas) or by traversing block tags (`<p>`, `<div>`, `<pre>`, `<li>`) to preserve linebreaks in rich-text editors.
   - Text inputs exceeding **100,000 characters** are truncated at the boundary to maintain UI responsiveness.
3. **Regex Scanning with Capture Indices**:
   - Rules in `detector.js` utilize the RegExp `d` flag (match indices) to record exact character boundaries (`start`, `end`) without mutating the original string.
4. **Context & False-Positive Filtering**:
   - **Stopwords**: Discards common schema keywords and placeholders (e.g., `string`, `null`, `undefined`, `placeholder`, `changeme`, `dummy`).
   - **Template & Variable Patterns**: Discards shell variables, environment lookups, and code interpolation (e.g., `process.env.X`, `os.environ[...]`, `os.getenv(...)`, `${VAR}`, `<password>`).
   - **Grammar Checks**: Plain dictionary words following conversational phrases (e.g., `"the password is strong"`) are ignored.
   - **Luhn Checksum**: Credit cards must pass the modulo 10 Luhn formula and contain non-identical digits.
   - **Connection URL Context**: Database URLs are only flagged when credentials exist (`user:pass@host`) or when explicitly assigned to a variable name like `DATABASE_URL = "..."`.
5. **Conflict Resolution**:
   - When multiple patterns match overlapping spans, rules with higher priority (lower numerical rank) win. For ties, the longest match is chosen.
6. **Risk Assessment**:
   - `risk.js` evaluates findings into an aggregate severity:
     - **LOW**: No findings detected.
     - **MEDIUM**: Only personal data present (Email, Phone, Credit Card).
     - **HIGH**: Any single credential, API key, token, JWT, or database URL.
     - **CRITICAL**: Any private key, or **3 or more distinct HIGH-severity categories**.
7. **Reverse-Offset Redaction**:
   - `redactor.js` replaces chosen items sorted in **descending offset order** (`b.start - a.start`). This guarantees that earlier offsets remain stable during string modification.
   - Replaced text is inserted via `document.execCommand('insertText')` or prototype value setters, triggering native `input` events for framework compatibility.

---

<a id="supported-categories--platforms"></a>
## 📋 Supported Categories & Platforms

### Detection Rules & Categories

| Severity | Category | Target Patterns & Identifiers | Verification / Filtering Logic | Redaction Token |
|:---|:---|:---|:---|:---|
| **CRITICAL** | **Private Key** | `-----BEGIN (RSA/EC/OPENSSH/...) PRIVATE KEY-----` | Requires at least 40 Base64 payload characters | `[REDACTED_PRIVATE_KEY]` |
| **HIGH** | **API Key** | OpenAI (`sk-...`, `sk-proj-...`, `sk-ant-...`, `sk-or-v1-...`), AWS (`AKIA...`, `ASIA...`), GitHub (`ghp_...`, `github_pat_...`), GitLab (`glpat-...`), Google/Firebase (`AIza...`), Slack (`xoxb-...`, `xoxp-...`), Stripe (`sk_live_...`, `rk_live_...`), Hugging Face (`hf_...`), Replicate (`r8_...`), SendGrid (`SG....`), Supabase (`sb_...`, `sbp_...`) | Filtered against placeholder stopwords, env syntax, and repeated symbols | `[REDACTED_API_KEY]` |
| **HIGH** | **Access Token** | `Bearer <token>` (min 12 chars), assignments to `auth_token`, `access_token`, `session_token` | Ignored if matching dummy placeholders or empty templates | `[REDACTED_TOKEN]` |
| **HIGH** | **JWT Token** | `eyJ....eyJ....` triple-segment tokens | Regex verification of base64url header, payload, and signature segments | `[REDACTED_JWT]` |
| **HIGH** | **Password** | Assignments to `password=...`, `DB_PASSWORD=...`, `pwd: ...`, `"password": "..."`, `my password is ...` | Excludes numeric length limits, placeholders, and plain dictionary adjectives | `[REDACTED_PASSWORD]` |
| **HIGH** | **Database URL** | `postgres://`, `mysql://`, `mongodb://`, `mongodb+srv://`, `redis://`, `mssql://`, `amqp://`, `cockroachdb://` | Must contain inline credentials (`user:pass@host`) or be assigned to a DB URL variable | `[REDACTED_DATABASE_URL]` |
| **MEDIUM** | **Credit Card** | 13–19 digit numeric sequences with spaces or hyphens | Must satisfy the **Luhn algorithm**; rejects repetitive single-digit sequences | `[REDACTED_CREDIT_CARD]` |
| **MEDIUM** | **Email Address** | Standard RFC-compliant email formats (`name@domain.tld`) | Rejects Git SSH URLs (`git@github.com:...`) | `[REDACTED_EMAIL]` |
| **MEDIUM** | **Phone Number** | International `+country` codes, US formats `(555) 123-4567`, `555-123-4567`, Indian 10-digit mobile, contextual keywords | Validated for 10–15 digits and checked against preceding context words (`phone:`, `tel:`, etc.) | `[REDACTED_PHONE]` |

### Platform Compatibility

The extension specifies `<all_urls>` in its manifest content scripts and includes specialized DOM adapters for major AI platforms, along with a universal fallback:

| Platform | Hostname / Pattern | Adapter Target Selector |
|:---|:---|:---|
| **ChatGPT** | `chatgpt.com`, `chat.openai.com` | `#prompt-textarea`, `div.ProseMirror[contenteditable="true"]` |
| **Claude** | `claude.ai` | `fieldset div.ProseMirror[contenteditable="true"]`, `div[contenteditable="true"]` |
| **Google Gemini** | `gemini.google.com` | `rich-textarea div[contenteditable="true"]`, `div.ql-editor` |
| **Perplexity AI** | `perplexity.ai` | `textarea[placeholder*="Ask"]`, `textarea` |
| **DeepSeek** | `chat.deepseek.com` | `#chat-input`, `textarea`, `div[contenteditable="true"]` |
| **Poe** | `poe.com` | `textarea[class*="ChatMessageInput"]`, `textarea` |
| **Mistral AI** | `mistral.ai`, `chat.mistral.ai` | `textarea`, `div[contenteditable="true"]` |
| **Hugging Chat** | `huggingface.co/chat` | `textarea`, `div[contenteditable="true"]` |
| **Microsoft Copilot** | `copilot.microsoft.com` | `#searchbox`, `textarea`, `div[contenteditable="true"]` |
| **Grok** | `grok.com`, `x.com` | `textarea`, `div[contenteditable="true"]` |
| **AI Coding Tools** | `v0.dev`, `bolt.new`, `replit.com` | `textarea`, `div[contenteditable="true"]` |
| **Local AI UIs** | `localhost`, `127.0.0.1`, `*.local` (Ollama, Open WebUI, LibreChat) | `textarea`, `div[contenteditable="true"]` |
| **Universal Fallback** | *Any webpage across the web* | `textarea`, `div[contenteditable="true"][role="textbox"]`, `div.ProseMirror` |

---

<a id="installation"></a>
## 📦 Installation

To install AI Privacy Guard from source in Google Chrome (or any Chromium browser like Brave, Edge, or Arc):

1. **Clone the repository**:
   ```bash
   git clone https://github.com/abhinayteja/ai-privacy-guard.git
   cd ai-privacy-guard
   ```

2. **Open Extensions in Chrome**:
   - Open Chrome and navigate to `chrome://extensions/`.

3. **Enable Developer Mode**:
   - Toggle the **Developer mode** switch in the upper-right corner.

4. **Load Unpacked Extension**:
   - Click the **Load unpacked** button in the upper-left corner.
   - Select the `ai-privacy-guard` folder (the directory containing `manifest.json`).

5. **Pin the Extension**:
   - Click the Chrome extensions puzzle icon in the toolbar and pin **AI Privacy Guard** for quick access to the popup dashboard.

6. **Verify the Installation**:
   - Open [ChatGPT](https://chatgpt.com) or [Claude](https://claude.ai) in a new tab.
   - Paste a sample test prompt:
     ```text
     Review my API configuration:
     OPENAI_API_KEY=sk-proj-1234567890abcdef
     admin_email=admin@test.org
     ```
   - Verify that the floating warning card appears in the lower-right corner.

---

<a id="development--testing"></a>
## 🧪 Development & Testing

The project has **zero external build steps and zero runtime dependencies**. You do not need to run `npm install`.

### Prerequisites
- [Google Chrome](https://www.google.com/chrome/) or Chromium-based browser
- [Node.js](https://nodejs.org/) (v16.0.0 or later to run the test runner)

### Running Automated Unit Tests
The repository includes an automated test suite verifying pattern detection, context validators, Luhn checks, risk scoring, and redaction outputs:

```bash
# From the repository root
node tests/detector.test.js
```

**Expected Test Output**:
```text
Should detect API Keys & Tokens
  ✓ API_KEY=sk-test123456
  ✓ OPENAI_API_KEY=sk-proj-1234567890abcdef
  ✓ ANTHROPIC_API_KEY=sk-ant-api03-1234567890abcdef
  ✓ GEMINI_API_KEY=AIzaSyA1234567890abcdef1234567890abcdef
  ✓ AZURE_OPENAI_KEY=1234567890abcdef1234567890abcdef
  ✓ SUPABASE_KEY=sb-1234567890abcdef12345
  ✓ AWS access key
  ✓ GitHub token
  ✓ GitLab token
  ✓ Slack token
  ✓ SendGrid key
  ✓ client_secret assignment
  ✓ Authorization: Bearer <jwt>
  ✓ Authorization: Bearer opaque token

Should detect Passwords & Credentials
  ✓ password=MySecret123
  ✓ DB_PASSWORD env var
  ✓ JSON password
  ✓ "my password is hunter2"

Should detect Database URLs
  ✓ Postgres URL with password
  ✓ Postgres URL with secret keyword
  ✓ MySQL URL with credentials
  ✓ MongoDB SRV URL
  ✓ Redis URL with auth
  ✓ DATABASE_URL assignment

Should detect Personal Data & Keys
  ✓ test@gmail.com
  ✓ Private key block
  ✓ Visa test card (Luhn)
  ✓ Phone with +country code
  ✓ US phone format

Should NOT trigger false positives
  ✓ What is an API key?
  ✓ Explain passwords in cybersecurity.
  ✓ Write a Python program that validates an email.
  ✓ "the password is strong"
  ✓ password: string (schema)
  ✓ token placeholder
  ✓ max_tokens = 1000
  ✓ tokenizer = AutoTokenizer...
  ✓ Year / small numbers

Risk scoring
  ✓ Example prompt → HIGH
  ✓ Private key → CRITICAL

Redaction
  ✓ Replaces values with placeholders
  ✓ Redacts database URL
  ✓ Redacts multiline secrets cleanly

43 passed, 0 failed
```

### Developing Changes Locally
1. Edit any source file in `src/`, `popup/`, or `tests/`.
2. Re-run tests via `node tests/detector.test.js`.
3. In Chrome, open `chrome://extensions/` and click the **↻ (Reload)** button on the AI Privacy Guard card.
4. Reload your AI chatbot tab to apply the updated content script.

---

<a id="privacy--security-considerations"></a>
## 🔒 Privacy & Security Considerations

AI Privacy Guard was designed with a strict zero-trust security architecture:

- **Zero Outbound Network Calls**: The codebase contains no `fetch()`, `XMLHttpRequest`, `WebSocket`, `navigator.sendBeacon`, or dynamically injected `<script>` tags. It cannot transmit prompt data over the network.
- **Minimal Browser Permissions**: The extension requests only the `"storage"` permission in `manifest.json`. It does not request `webRequest`, `cookies`, `management`, or remote host permissions.
- **In-Memory Ephemeral Analysis**: Sensitive values extracted during scanning exist exclusively in local JavaScript heap memory to populate the review UI. Values are never written to `localStorage`, `chrome.storage`, IndexedDB, or browser devtools console logs.
- **Anonymous Metrics Only**: The data saved in `chrome.storage.local` is strictly restricted to:
  ```json
  {
    "settings": {
      "enabled": true
    },
    "stats": {
      "date": "2026-10-13",
      "detected": 3,
      "redacted": 3
    }
  }
  ```
  Only integer counts are incremented. No prompt excerpts, secret types, or URLs are recorded.
- **Visual Masking**: In the Review & Redact modal, sensitive values are masked (e.g., `sk-p••••••10`), showing only outer edge characters to prevent shoulder surfing.

---

<a id="limitations--warnings"></a>
## ⚠️ Limitations & Warnings

- **Advisory by Default**: AI Privacy Guard provides real-time warnings and redaction tools; it **does not hard-block** network requests or prevent users from pressing Enter or clicking the Send button if they choose to bypass the warning.
- **Regex & Heuristic Boundary**: Detection is pattern-driven. Custom or high-entropy random secrets without identifiable prefixes (such as an arbitrary 32-character hexadecimal token not assigned to a recognized variable name) cannot be reliably detected by regex alone.
- **False Positives / Negatives**: Natural language descriptions resembling assignment syntax or variable naming can occasionally trigger false positives. Conversely, obfuscated secrets (e.g. Base64-encoded strings or split concatenation) are not detected.
- **Input Modality Constraints**: Only text typed or pasted into monitored DOM inputs is inspected. Uploaded file attachments (PDFs, images, CSVs), voice dictation, and canvas elements are **not** scanned.
- **Paste Length Cap**: Prompts larger than **100,000 characters** are scanned only up to the first 100,000 characters to prevent browser UI freezing.
- **Dynamic Frontend Changes**: Web-based AI platforms regularly alter their DOM trees and editor frameworks. If an AI provider updates its input classes or shadow roots, an adapter update may be required. If programmatic text replacement fails, the extension automatically displays a "Copy redacted text" fallback button.

---

<a id="roadmap"></a>
## 🗺️ Roadmap

- [ ] **Custom Detection Rules**: Allow users to add custom regex patterns and company-specific secret formats via the popup settings.
- [ ] **Domain & Keyword Allowlists**: Support ignoring staging domains, dummy mock credentials, and synthetic test suites.
- [ ] **Optional Hard-Block Mode**: Configurable toggle to disable the prompt submission button until pending critical warnings are explicitly acknowledged.
- [ ] **Client-Side Shannon Entropy**: Implement offline entropy analysis to flag high-randomness tokens without fixed vendor prefixes.
- [ ] **Structured File Content Inspection**: Detect credentials inside pasted JSON, YAML, and `.env` snippets.
- [ ] **Expanded Platform Adapters**: Dedicated DOM adapters for NotebookLM, Cursor Web, and AI IDE webviews.
- [ ] **Automated GitHub Actions CI**: Continuous integration workflow running the Node.js test suite across pull requests and releases.

---

<a id="contributing"></a>
## 🤝 Contributing

Contributions from security engineers, open-source developers, and AI researchers are welcome! Here is how to get started:

### Contribution Steps

1. **Fork the Repository**:
   Click the **Fork** button at the top right of the GitHub repository page.

2. **Clone Your Fork**:
   ```bash
   git clone https://github.com/<your-username>/ai-privacy-guard.git
   cd ai-privacy-guard
   ```

3. **Create a Feature Branch**:
   ```bash
   git checkout -b feature/add-new-detector
   ```

4. **Implement Your Changes**:
   - To add a new detection rule: Update `RULES` in [src/detector.js](src/detector.js).
   - To add a site adapter: Update `APG.sites` in [src/content.js](src/content.js).
   - Keep code modular, well-commented, and free of external dependencies.

5. **Add and Run Tests**:
   - Add new test cases to [tests/detector.test.js](tests/detector.test.js).
   - Ensure all tests pass:
     ```bash
     node tests/detector.test.js
     ```

6. **Commit & Push**:
   ```bash
   git add .
   git commit -m "feat(detector): add detection for Datadog API keys"
   git push origin feature/add-new-detector
   ```

7. **Submit a Pull Request**:
   - Open a pull request against the `main` branch.
   - Describe the pattern or feature added, provide sample test inputs, and verify that no external network dependencies were introduced.

---

<a id="license"></a>
## 📄 License

This repository does not currently include a formal open-source license file. An open-source license (such as the MIT License or Apache 2.0) is pending selection by the project maintainer.

Until an official license file is added to the repository, all rights are reserved under standard GitHub Terms of Service. If you wish to use or package this software commercially, please contact the maintainer.

---

<div align="center">
  <h3>Protect your privacy while building with AI.</h3>
  <p>Contributions, pattern submissions, and feedback are warmly welcomed.</p>
  <p>
    <a href="https://github.com/abhinayteja/ai-privacy-guard/issues">Report an Issue</a> •
    <a href="https://github.com/abhinayteja/ai-privacy-guard/pulls">Submit a Pull Request</a> •
    <a href="#overview">Back to Top ↑</a>
  </p>
</div>
