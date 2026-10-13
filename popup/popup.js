/**
 * AI Privacy Guard — popup.js
 * Clean & minimal state handler for popup UI.
 */
'use strict';

const $ = (id) => document.getElementById(id);

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function renderEnabled(enabled) {
  $('popup').classList.toggle('is-off', !enabled);
  $('status-text').textContent = enabled ? 'Active' : 'Paused';
  $('local-detection').textContent = enabled ? 'Enabled' : 'Paused';
  $('toggle-sub').textContent = enabled ? 'Monitoring AI prompts' : 'Protection is paused';
  $('toggle-protection').checked = enabled;
}

function renderStats(stats) {
  const s = stats && stats.date === todayKey() ? stats : { detected: 0, redacted: 0 };
  $('stat-detected').textContent = String(s.detected || 0);
  $('stat-redacted').textContent = String(s.redacted || 0);
}

async function init() {
  try {
    const { settings, stats } = await chrome.storage.local.get(['settings', 'stats']);
    let enabled = !settings || settings.enabled !== false;
    renderEnabled(enabled);
    renderStats(stats);

    $('toggle-protection').addEventListener('change', async (e) => {
      enabled = e.target.checked;
      renderEnabled(enabled);
      try {
        await chrome.storage.local.set({ settings: { enabled } });
      } catch (err) {
        console.error('AI Privacy Guard: could not save setting', err);
      }
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.stats) renderStats(changes.stats.newValue);
    });
  } catch (err) {
    console.error('AI Privacy Guard: could not load popup state', err);
  }
}

init();
