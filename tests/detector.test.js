/**
 * AI Privacy Guard — detector tests (no dependencies).
 * Run:  node tests/detector.test.js
 */
'use strict';

require('../src/detector.js');
require('../src/risk.js');
require('../src/redactor.js');

const { detect } = globalThis.APG.detector;
const { assess } = globalThis.APG.risk;
const { redact } = globalThis.APG.redactor;

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${name}\n      ${err.message}`);
  }
}

function types(text) { return detect(text).map((f) => f.type); }

function expectTypes(text, expected) {
  const got = types(text);
  for (const t of expected) {
    if (!got.includes(t)) throw new Error(`expected ${t}, got [${got.join(', ')}]`);
  }
}

function expectNoMajor(text) {
  const { level } = assess(detect(text));
  if (level === 'HIGH' || level === 'CRITICAL') {
    throw new Error(`expected no major warning, got ${level}: [${types(text).join(', ')}]`);
  }
}

function expectNone(text) {
  const got = types(text);
  if (got.length) throw new Error(`expected nothing, got [${got.join(', ')}]`);
}

const JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

console.log('\nShould detect API Keys & Tokens');
check('API_KEY=sk-test123456', () => expectTypes('API_KEY=sk-test123456', ['API_KEY']));
check('OPENAI_API_KEY=sk-proj-1234567890abcdef', () => expectTypes('OPENAI_API_KEY=sk-proj-1234567890abcdef', ['API_KEY']));
check('ANTHROPIC_API_KEY=sk-ant-api03-1234567890abcdef', () => expectTypes('ANTHROPIC_API_KEY=sk-ant-api03-1234567890abcdef', ['API_KEY']));
check('GEMINI_API_KEY=AIzaSyA1234567890abcdef1234567890abcdef', () => expectTypes('GEMINI_API_KEY=AIzaSyA1234567890abcdef1234567890abcdef', ['API_KEY']));
check('AZURE_OPENAI_KEY=1234567890abcdef1234567890abcdef', () => expectTypes('AZURE_OPENAI_KEY=1234567890abcdef1234567890abcdef', ['API_KEY']));
check('SUPABASE_KEY=sb-1234567890abcdef12345', () => expectTypes('SUPABASE_KEY=sb-1234567890abcdef12345', ['API_KEY']));
check('AWS access key', () => expectTypes('aws key AKIAIOSFODNN7EXAMPLE', ['API_KEY']));
check('GitHub token', () => expectTypes('ghp_1234567890abcdefghijklmnopqrstuvwxyz', ['API_KEY']));
check('GitLab token', () => expectTypes('glpat-1234567890abcdefghij', ['API_KEY']));
check('Slack token', () => expectTypes('xoxb-123456789012-1234567890123-abcdef123456', ['API_KEY']));
check('SendGrid key', () => expectTypes('SG.1234567890123456789012.1234567890123456789012345678901234567890123', ['API_KEY']));
check('client_secret assignment', () => expectTypes('client_secret = "a8f5f167f44f4964e6c998dee827110c"', ['API_KEY']));
check('Authorization: Bearer <jwt>', () => expectTypes(`Authorization: Bearer ${JWT}`, ['JWT']));
check('Authorization: Bearer opaque token', () => expectTypes('Authorization: Bearer abcDEF1234567890xyz', ['TOKEN']));

console.log('\nShould detect Passwords & Credentials');
check('password=MySecret123', () => expectTypes('password=MySecret123', ['PASSWORD']));
check('DB_PASSWORD env var', () => expectTypes('DB_PASSWORD=hunter2!', ['PASSWORD']));
check('JSON password', () => expectTypes('{"password": "S3cr3t!pw"}', ['PASSWORD']));
check('"my password is hunter2"', () => expectTypes('my password is hunter2', ['PASSWORD']));

console.log('\nShould detect Database URLs');
check('Postgres URL with password', () => expectTypes('postgres://admin:S3cret!@db.example.com:5432/app', ['DATABASE_URL']));
check('Postgres URL with secret keyword', () => expectTypes('postgres://user:secret@localhost:5432/mydb', ['DATABASE_URL']));
check('MySQL URL with credentials', () => expectTypes('mysql://root:mypassword123@127.0.0.1:3306/prod_db', ['DATABASE_URL']));
check('MongoDB SRV URL', () => expectTypes('mongodb+srv://user:p4ssw0rd@cluster0.mongodb.net/db', ['DATABASE_URL']));
check('Redis URL with auth', () => expectTypes('redis://:myredispassword@redis.internal:6379', ['DATABASE_URL']));
check('DATABASE_URL assignment', () => expectTypes('DATABASE_URL="postgresql://postgres:pass@db.supabase.co:5432/postgres"', ['DATABASE_URL']));

console.log('\nShould detect Personal Data & Keys');
check('test@gmail.com', () => expectTypes('test@gmail.com', ['EMAIL']));
check('Private key block', () => expectTypes(
  '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA1c7+9z5Pad7OejecsQ0bu3aumhVVQdQvS3X8ap0AB7cRjyx\n-----END RSA PRIVATE KEY-----',
  ['PRIVATE_KEY']));
check('Visa test card (Luhn)', () => expectTypes('card 4111 1111 1111 1111', ['CREDIT_CARD']));
check('Phone with +country code', () => expectTypes('reach me at +91 98765 43210', ['PHONE']));
check('US phone format', () => expectTypes('(555) 123-4567', ['PHONE']));

console.log('\nShould NOT trigger false positives');
check('What is an API key?', () => expectNone('What is an API key?'));
check('Explain passwords in cybersecurity.', () => expectNone('Explain passwords in cybersecurity.'));
check('Write a Python program that validates an email.', () => expectNone('Write a Python program that validates an email.'));
check('"the password is strong"', () => expectNone('Make sure the password is strong.'));
check('password: string (schema)', () => expectNone('type User = { email: string; password: string }'));
check('token placeholder', () => expectNone('Authorization: Bearer YOUR_TOKEN_HERE'));
check('max_tokens = 1000', () => expectNone('max_tokens = 1000'));
check('tokenizer = AutoTokenizer...', () => expectNone('tokenizer = AutoTokenizer.from_pretrained("bert")'));
check('Year / small numbers', () => expectNone('In 2024 we had 1500 users and 300 orders.'));

console.log('\nRisk scoring');
check('Example prompt → HIGH', () => {
  const text = 'Hello, explain this code.\n\nOPENAI_API_KEY=sk-xxxxxxxxxxxx\nemail: test@example.com\npassword: MyPassword123';
  const r = assess(detect(text));
  if (r.level !== 'HIGH') throw new Error(`got ${r.level}`);
  const labels = r.groups.map((g) => g.type).sort().join(',');
  if (labels !== 'API_KEY,EMAIL,PASSWORD') throw new Error(`got ${labels}`);
});
check('Private key → CRITICAL', () => {
  const r = assess(detect('-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7\n-----END PRIVATE KEY-----'));
  if (r.level !== 'CRITICAL') throw new Error(`got ${r.level}`);
});

console.log('\nRedaction');
check('Replaces values with placeholders', () => {
  const text = 'My API key is sk-123456789abc\nand email is test@gmail.com';
  const out = redact(text, detect(text)).text;
  const expected = 'My API key is [REDACTED_API_KEY]\nand email is [REDACTED_EMAIL]';
  if (out !== expected) throw new Error(`got: ${JSON.stringify(out)}`);
});
check('Redacts database URL', () => {
  const text = 'connect to postgres://user:secret@localhost:5432/mydb';
  const out = redact(text, detect(text)).text;
  if (!out.includes('[REDACTED_DATABASE_URL]')) throw new Error(`got: ${out}`);
});
check('Redacts multiline secrets cleanly', () => {
  const text = 'Prompt with:\npassword=MyPass123!\nand email=dev@company.org';
  const out = redact(text, detect(text)).text;
  if (!out.includes('[REDACTED_PASSWORD]') || !out.includes('[REDACTED_EMAIL]')) {
    throw new Error(`multiline redaction failed, got: ${out}`);
  }
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);

