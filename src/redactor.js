/**
 * AI Privacy Guard — redactor.js
 *
 * Pure function: returns a NEW string with the chosen findings replaced
 * by placeholders such as [REDACTED_API_KEY]. It never touches the page;
 * content.js decides if/when to apply the result (only after the user
 * explicitly clicks "Redact").
 */
(function (root) {
  'use strict';

  const APG = (root.APG = root.APG || {});

  function placeholderFor(type) {
    const meta = APG.detector && APG.detector.TYPES[type];
    return (meta && meta.placeholder) || `[REDACTED_${type}]`;
  }

  /**
   * @param {string} text
   * @param {Array<{type:string,start:number,end:number,value:string}>} findings
   * @returns {{ text: string, count: number }}
   */
  function redact(text, findings) {
    // Apply from the end so earlier offsets stay valid.
    const sorted = [...findings].sort((a, b) => b.start - a.start);
    let out = text;
    let count = 0;
    for (const f of sorted) {
      // Safety: only replace if the text at that span is still the detected value.
      if (out.slice(f.start, f.end) !== f.value) continue;
      out = out.slice(0, f.start) + placeholderFor(f.type) + out.slice(f.end);
      count++;
    }
    return { text: out, count };
  }

  APG.redactor = { redact, placeholderFor };
})(typeof globalThis !== 'undefined' ? globalThis : this);
