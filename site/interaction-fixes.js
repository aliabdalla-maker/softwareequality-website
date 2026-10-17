/*! Equality Software interaction recovery layer.
 * Keeps native mouse/touch scrolling predictable and improves the Agentic AI
 * assistant's runtime status without exposing provider credentials.
 */
(function () {
  'use strict';
  if (window.__seInteractionFixesLoaded) return;
  window.__seInteractionFixesLoaded = true;

  var style = document.createElement('style');
  style.id = 'se-interaction-fixes-style';
  style.textContent = [
    'html:not(.se5-lock){overflow-y:auto!important;overscroll-behavior-y:auto!important}',
    'html:not(.se5-lock) body{overscroll-behavior-y:auto!important}',
    '#se-ai-log{overscroll-behavior:auto!important;scrollbar-gutter:stable;touch-action:pan-y}',
    '#se-ai-panel{contain:layout paint}',
    '#se-ai-toggle{touch-action:manipulation}',
    '#se-ai.se-ai-degraded #se-ai-status i{background:#F59E0B!important}',
    '#se-ai.se-ai-offline #se-ai-status i{background:#EF4444!important}',
    '@media (pointer:fine){#se-ai-log{scrollbar-width:thin;scrollbar-color:#94A3B8 transparent}}'
  ].join('');
  document.head.appendChild(style);

  /* Preserve vertical mouse-wheel page scrolling over horizontal tab bars. */
  document.addEventListener('wheel', function (e) {
    var target = e.target && e.target.closest ? e.target.closest('.se-tabs-nav') : null;
    if (!target) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.stopImmediatePropagation();
    }
  }, { capture: true, passive: true });

  function allowScrollChaining(log) {
    if (!log || log.__seScrollFixed) return;
    log.__seScrollFixed = true;
    log.setAttribute('tabindex', '0');
    log.addEventListener('wheel', function (e) {
      var top = log.scrollTop <= 1;
      var bottom = log.scrollTop + log.clientHeight >= log.scrollHeight - 1;
      if ((e.deltaY < 0 && top) || (e.deltaY > 0 && bottom)) {
        e.stopPropagation();
      }
    }, { passive: true });
  }

  var healthPending = null;
  var healthFetchedAt = 0;

  function setAssistantStatus(root, text, state) {
    if (!root) return;
    var status = root.querySelector('#se-ai-status');
    if (!status) return;
    status.innerHTML = '<i aria-hidden="true"></i>';
    status.appendChild(document.createTextNode(text));
    root.classList.toggle('se-ai-degraded', state === 'degraded');
    root.classList.toggle('se-ai-offline', state === 'offline');
  }

  function refreshAssistantHealth(root, force) {
    var now = Date.now();
    if (!force && now - healthFetchedAt < 30000) return healthPending || Promise.resolve();
    if (healthPending) return healthPending;
    healthFetchedAt = now;
    healthPending = fetch('/api/health', { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('health ' + r.status); return r.json(); })
      .then(function (data) {
        var ai = data && data.ai;
        if (!ai || !ai.configured) {
          setAssistantStatus(root, 'Website knowledge fallback active', 'degraded');
          return;
        }
        if (ai.lastSuccessAt) {
          setAssistantStatus(root, '4 specialist agents online', 'ok');
          return;
        }
        if (ai.lastError) {
          setAssistantStatus(root, 'Website knowledge fallback active', 'degraded');
          return;
        }
        setAssistantStatus(root, 'AI service ready', 'ok');
      })
      .catch(function () {
        setAssistantStatus(root, 'Assistant service temporarily unavailable', 'offline');
      })
      .finally(function () { healthPending = null; });
    return healthPending;
  }

  function enhanceAssistant(root) {
    if (!root || root.__seEnhanced) return;
    root.__seEnhanced = true;
    allowScrollChaining(root.querySelector('#se-ai-log'));

    var toggle = root.querySelector('#se-ai-toggle');
    if (toggle) {
      toggle.addEventListener('click', function () {
        window.setTimeout(function () { refreshAssistantHealth(root, true); }, 0);
      });
    }

    var form = root.querySelector('#se-ai-form');
    var log = root.querySelector('#se-ai-log');
    if (form && log) {
      form.addEventListener('submit', function () {
        log.setAttribute('aria-busy', 'true');
        window.setTimeout(function () { log.removeAttribute('aria-busy'); }, 22000);
      }, true);
    }

    refreshAssistantHealth(root, false);
  }

  function scan() {
    enhanceAssistant(document.getElementById('se-ai'));
  }

  scan();
  if ('MutationObserver' in window) {
    new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
  } else {
    window.setTimeout(scan, 1500);
  }
})();
