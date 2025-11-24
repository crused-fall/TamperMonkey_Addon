// ==UserScript==
// @name         Copy MathJax -> LaTeX (no duplication, clean)
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  On copy, replace all MathJax/MathML rendered formulas with LaTeX source. Remove duplicates completely.
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  function wrapTex(tex, isDisplay) {
    tex = (tex || '').trim();
    if (!tex) return '';
    if (/^\$\$[\s\S]*\$\$$/.test(tex) || /^\$[\s\S]*\$/.test(tex) || /^\\\[/.test(tex) || /^\\\(/.test(tex)) {
      return tex;
    }
    return isDisplay ? `$$${tex}$$` : `$${tex}$`;
  }

  function extractTeXFromMath(el) {
    if (!el) return null;

    // 1) <annotation encoding="application/x-tex">
    const ann = el.querySelector('annotation[encoding="application/x-tex"], annotation[encoding="text/x-tex"]');
    if (ann) return ann.textContent.trim();

    // 2) <script type="math/tex">
    const script = el.querySelector('script[type^="math/tex"]');
    if (script) return script.textContent.trim();

    // 3) data attributes
    for (const a of ['data-tex', 'data-latex', 'data-original', 'data-math']) {
      const v = el.getAttribute && el.getAttribute(a);
      if (v) return v.trim();
    }

    // 4) aria-label (MathJax v3 often sets this)
    const aria = el.getAttribute && el.getAttribute('aria-label');
    if (aria && /\\|\\\(|\\\[|\$/.test(aria)) return aria.trim();

    return null;
  }

  function processContainer(container) {
    // Find and replace all MathJax outputs in one pass
    const mathNodes = container.querySelectorAll(
      'mjx-container, .MathJax, .MathJax_Display, .mjx-math, math, [role="math"]'
    );

    for (const el of mathNodes) {
      const tex = extractTeXFromMath(el);
      if (tex) {
        const isDisplay =
          el.classList.contains('MathJax_Display') ||
          el.tagName.toLowerCase() === 'mjx-container' && el.getAttribute('display') === 'true' ||
          (el.getAttribute('style') || '').includes('block');

        const tn = document.createTextNode(wrapTex(tex, isDisplay));
        el.parentNode.replaceChild(tn, el);
      } else {
        // remove pure rendered math without retrievable TeX (avoid duplicates)
        el.remove();
      }
    }

    // handle <script type="math/tex"> directly present (rare)
    const scripts = container.querySelectorAll('script[type^="math/tex"]');
    for (const s of scripts) {
      const type = s.getAttribute('type') || '';
      const isDisplay = /display/.test(type);
      const tex = s.textContent || '';
      const tn = document.createTextNode(wrapTex(tex, isDisplay));
      s.parentNode.replaceChild(tn, s);
    }
  }

  document.addEventListener('copy', function (e) {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;

    const frag = document.createDocumentFragment();
    for (let i = 0; i < sel.rangeCount; i++) {
      frag.appendChild(sel.getRangeAt(i).cloneContents());
    }

    const container = document.createElement('div');
    container.appendChild(frag);

    processContainer(container);

    const text = container.innerText;
    const html = container.innerHTML;

    const cb = e.clipboardData || window.clipboardData;
    if (cb) {
      e.preventDefault();
      cb.setData('text/plain', text);
      try { cb.setData('text/html', html); } catch (_) {}
    }
  }, true);
})();
