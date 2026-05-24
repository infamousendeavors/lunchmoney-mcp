/* ============================================================
   lunchmoney-mcp — main.js
   Vanilla JS, no dependencies. Progressive enhancement.
   ============================================================ */

'use strict';

/* ── Utilities ───────────────────────────────────────────── */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

// Cache once per page load — the value won't change without a reload
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function prefersReducedMotion() { return reducedMotion; }

/* ── Nav: scroll-solidify + mobile hamburger ─────────────── */
function initNav() {
  const nav       = $('.nav');
  const hamburger = $('.nav__hamburger');
  const mobileMenu = $('.nav__mobile');

  if (!nav) return;

  // Scroll: add .scrolled class
  function onScroll() {
    if (window.scrollY > 12) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  }
  onScroll(); // run on init
  window.addEventListener('scroll', onScroll, { passive: true });

  // Hamburger toggle
  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      const isOpen = mobileMenu.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', String(isOpen));
      hamburger.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
    });

    // Close on mobile nav link click
    $$('.nav__mobile .nav__link').forEach(link => {
      link.addEventListener('click', () => {
        mobileMenu.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
        hamburger.setAttribute('aria-label', 'Open menu');
      });
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!nav.contains(e.target) && !mobileMenu.contains(e.target)) {
        mobileMenu.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
      }
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mobileMenu.classList.contains('open')) {
        mobileMenu.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
        hamburger.focus();
      }
    });
  }
}

/* ── Terminal animation ──────────────────────────────────── */
function initTerminal() {
  const container = $('.terminal__body');
  if (!container) return;

  const lines = [
    { type: 'command', parts: [
      { cls: 't-prompt', text: '$ ' },
      { cls: 't-cmd',    text: 'npx @infamousendeavors/lunchmoney-mcp setup' }
    ]},
    { type: 'output', parts: [
      { cls: 't-success', text: '✓' },
      { cls: 't-output',  text: ' Token validated — welcome, Joe!' }
    ]},
    { type: 'output', parts: [
      { cls: 't-success', text: '✓' },
      { cls: 't-output',  text: ' Stored in macOS Keychain' }
    ]},
    { type: 'blank' },
    { type: 'command', parts: [
      { cls: 't-prompt', text: '$ ' },
      { cls: 't-cmd',    text: 'npx @infamousendeavors/lunchmoney-mcp' }
    ]},
    { type: 'output', parts: [
      { cls: 't-output', text: 'Lunch Money MCP Server started (stdio)' }
    ]},
    { type: 'output', parts: [
      { cls: 't-muted',  text: 'Ready to accept connections...' }
    ]},
    { type: 'pause', duration: 2000 },
    { type: 'blank' },
    { type: 'command', parts: [
      { cls: 't-prompt', text: '$ ' },
      { cls: 't-cmd',    text: '"What did I spend on groceries last month?"' }
    ]},
    { type: 'pause', duration: 400 },
    { type: 'output', parts: [
      { cls: 't-success', text: '\u2192 ' },
      { cls: 't-output',  text: 'Groceries: $412.83 across 47 transactions' }
    ]},
    { type: 'output', parts: [
      { cls: 't-muted',  text: '  Budget remaining: $87.17 (82% used)' }
    ]},
  ];

  if (prefersReducedMotion()) {
    // Render all at once
    container.innerHTML = '';
    lines.forEach(line => {
      if (line.type === 'pause') return;
      const el = document.createElement('span');
      el.className = 'terminal__line';
      if (line.type === 'blank') {
        el.innerHTML = '\u00a0';
      } else {
        el.innerHTML = line.parts.map(p => `<span class="${p.cls}">${escHtml(p.text)}</span>`).join('');
      }
      container.appendChild(el);
    });
    return;
  }

  container.innerHTML = '';
  let lineIndex = 0;

  // Add cursor
  const cursor = document.createElement('span');
  cursor.className = 'terminal__cursor';
  cursor.setAttribute('aria-hidden', 'true');
  container.appendChild(cursor);

  function typeLine(lineIdx, done) {
    const line = lines[lineIdx];

    if (line.type === 'pause') {
      setTimeout(done, line.duration || 1000);
      return;
    }

    const el = document.createElement('span');
    el.className = 'terminal__line';
    container.insertBefore(el, cursor);

    if (line.type === 'blank') {
      el.innerHTML = '\u00a0';
      setTimeout(done, 80);
      return;
    }

    // For output lines, reveal entire line at once after small delay
    if (line.type === 'output') {
      el.innerHTML = line.parts
        .map(p => `<span class="${p.cls}">${escHtml(p.text)}</span>`)
        .join('');
      setTimeout(done, 60);
      return;
    }

    // For command lines, type character by character
    const fullText = line.parts.map(p => p.text).join('');
    const charDelay = 38;
    let charIdx = 0;

    // Render prompt instantly
    const promptSpan = document.createElement('span');
    promptSpan.className = line.parts[0].cls;
    promptSpan.textContent = line.parts[0].text;
    el.appendChild(promptSpan);

    // The typed portion
    const cmdSpan = document.createElement('span');
    cmdSpan.className = line.parts[1].cls;
    el.appendChild(cmdSpan);

    const cmdText = line.parts[1].text;
    let i = 0;

    function typeChar() {
      if (i >= cmdText.length) {
        setTimeout(done, 260);
        return;
      }
      cmdSpan.textContent += cmdText[i];
      i++;
      container.scrollTop = container.scrollHeight;
      setTimeout(typeChar, charDelay + (Math.random() * 18 - 9));
    }
    setTimeout(typeChar, 120);
  }

  function nextLine() {
    if (lineIndex >= lines.length) {
      // Hide cursor after done
      cursor.style.display = 'none';
      return;
    }
    typeLine(lineIndex, () => {
      lineIndex++;
      nextLine();
    });
  }

  // Kick off after short delay
  setTimeout(nextLine, 600);
}

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* ── Scroll-reveal with IntersectionObserver ─────────────── */
function initReveal() {
  if (prefersReducedMotion()) {
    $$('.reveal').forEach(el => el.classList.add('visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px'
  });

  $$('.reveal').forEach(el => observer.observe(el));
}

/* ── Copy to clipboard ───────────────────────────────────── */
function initCopyButtons() {
  $$('.copy-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const target = btn.dataset.target;
      const sourceEl = target ? document.getElementById(target) : btn.closest('.code-block')?.querySelector('pre');
      if (!sourceEl) return;

      const text = sourceEl.textContent || '';
      try {
        await navigator.clipboard.writeText(text.trim());
        btn.classList.add('copied');
        const original = btn.innerHTML;
        btn.innerHTML = `<span aria-hidden="true">✓</span> Copied`;
        btn.setAttribute('aria-label', 'Copied!');
        setTimeout(() => {
          btn.classList.remove('copied');
          btn.innerHTML = original;
          btn.removeAttribute('aria-label');
        }, 2000);
      } catch {
        // Fallback for older browsers
        const ta = document.createElement('textarea');
        ta.value = text.trim();
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
    });
  });
}

/* ── Tools tabs ──────────────────────────────────────────── */
function initToolsTabs() {
  const tabs   = $$('.tool-tab');
  const panels = $$('.tools__panel');

  if (!tabs.length || !panels.length) return;

  function activateTab(tab) {
    const target = tab.dataset.panel;

    tabs.forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    panels.forEach(p => p.classList.remove('active'));

    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');

    const panel = document.getElementById(target);
    if (panel) panel.classList.add('active');
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => activateTab(tab));

    // Keyboard: arrow keys for tab navigation
    tab.addEventListener('keydown', (e) => {
      const idx = tabs.indexOf(tab);
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const next = tabs[(idx + 1) % tabs.length];
        next.focus();
        activateTab(next);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const prev = tabs[(idx - 1 + tabs.length) % tabs.length];
        prev.focus();
        activateTab(prev);
      }
    });
  });

  // Activate first tab initially
  if (tabs[0]) activateTab(tabs[0]);
}

/* ── Try-it scenario switcher ────────────────────────────── */
function initTryIt() {
  const btns     = $$('.scenario-btn');
  const scenarios = $$('.tryit__scenario');

  if (!btns.length || !scenarios.length) return;

  function activateScenario(btn) {
    const target = btn.dataset.scenario;

    btns.forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
      b.setAttribute('tabindex', '-1');
    });
    scenarios.forEach(s => s.classList.remove('active'));

    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    btn.setAttribute('tabindex', '0');

    const panel = document.getElementById(target);
    if (panel) panel.classList.add('active');
  }

  btns.forEach(btn => {
    btn.addEventListener('click', () => activateScenario(btn));

    btn.addEventListener('keydown', (e) => {
      const idx = btns.indexOf(btn);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = btns[(idx + 1) % btns.length];
        next.focus();
        activateScenario(next);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = btns[(idx - 1 + btns.length) % btns.length];
        prev.focus();
        activateScenario(prev);
      }
    });
  });
}

/* ── Smooth scroll for anchor links ─────────────────────── */
function initSmoothScroll() {
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const id = link.getAttribute('href').slice(1);
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    // Update URL without jump
    history.pushState(null, '', `#${id}`);
    // Move focus for accessibility
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });
}

/* ── Counter animation (generic) ─────────────────────────── */
function initCounters() {
  const els = $$('[data-count-target]');
  if (!els.length) return;

  els.forEach(el => {
    const target = parseInt(el.dataset.countTarget, 10);
    if (isNaN(target)) return;

    if (prefersReducedMotion()) {
      el.textContent = target;
      return;
    }

    el.textContent = '0';
    let started = false;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !started) {
          started = true;
          observer.unobserve(el);

          const duration = 900; // ms
          const startTime = performance.now();

          function tick(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.round(eased * target);
            if (progress < 1) requestAnimationFrame(tick);
          }

          requestAnimationFrame(tick);
        }
      });
    }, { threshold: 0.5 });

    observer.observe(el);
  });
}

/* ── Init ────────────────────────────────────────────────── */
/* ── Dynamic version badge from npm registry ────────────── */
function initVersionBadge() {
  const badge = $('#version-badge');
  if (!badge) return;

  fetch('https://registry.npmjs.org/@infamousendeavors%2Flunchmoney-mcp/latest')
    .then(res => res.ok ? res.json() : null)
    .then(data => {
      if (data && data.version) {
        badge.textContent = 'v' + data.version;
      }
    })
    .catch(() => {
      // Fail silently — keep the hardcoded fallback version
    });
}

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initTerminal();
  initReveal();
  initCopyButtons();
  initToolsTabs();
  initTryIt();
  initSmoothScroll();
  initCounters();
  initVersionBadge();
});
