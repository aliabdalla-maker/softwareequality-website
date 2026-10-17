/*! Equality Software interaction recovery layer v2.
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
    'html:not(.se5-lock) body{overflow-y:visible!important;overscroll-behavior-y:auto!important}',
    '#se-ai-log{overflow-y:auto!important;overscroll-behavior:auto!important;scrollbar-gutter:stable;touch-action:pan-y;-webkit-overflow-scrolling:touch}',
    '#se-ai-panel{contain:layout paint}',
    '#se-ai-toggle{touch-action:manipulation}',
    '#se-ai.se-ai-degraded #se-ai-status i{background:#F59E0B!important}',
    '#se-ai.se-ai-offline #se-ai-status i{background:#EF4444!important}',
    '#se-ai.se-ai-online #se-ai-status i{background:#10B981!important}',
    '@media (pointer:fine){#se-ai-log{scrollbar-width:thin;scrollbar-color:#94A3B8 transparent}}'
  ].join('');
  document.head.appendChild(style);

  /*
   * enterprise.js converts vertical wheel input over .se-tabs-nav into
   * horizontal scrolling. Capture first and stop that handler, leaving the
   * browser's native vertical page scroll untouched.
   */
  document.addEventListener('wheel', function (e) {
    var tabs = e.target && e.target.closest ? e.target.closest('.se-tabs-nav') : null;
    if (!tabs) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) e.stopImmediatePropagation();
  }, { capture: true, passive: true });

  /*
   * A fixed chat panel should scroll its own transcript while there is more
   * transcript to show. At either edge, hand the wheel delta to the document
   * so the page never feels trapped by the assistant.
   */
  function allowScrollChaining(log) {
    if (!log || log.__seScrollFixed) return;
    log.__seScrollFixed = true;
    log.setAttribute('tabindex', '0');

    log.addEventListener('wheel', function (e) {
      if (!e.deltaY) return;
      var atTop = log.scrollTop <= 1;
      var atBottom = log.scrollTop + log.clientHeight >= log.scrollHeight - 1;
      var handToPage = (e.deltaY < 0 && atTop) || (e.deltaY > 0 && atBottom);
      if (!handToPage) return;

      e.preventDefault();
      e.stopPropagation();
      window.scrollBy({ top: e.deltaY, left: 0, behavior: 'auto' });
    }, { passive: false });
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
    root.classList.toggle('se-ai-online', state === 'online');
  }

  function refreshAssistantHealth(root, force) {
    var now = Date.now();
    if (!force && now - healthFetchedAt < 30000) return healthPending || Promise.resolve();
    if (healthPending) return healthPending;
    healthFetchedAt = now;

    healthPending = fetch('/api/health', {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    })
      .then(function (r) {
        if (!r.ok) throw new Error('health ' + r.status);
        return r.json();
      })
      .then(function (data) {
        var ai = data && data.ai;
        if (!ai || !ai.configured) {
          setAssistantStatus(root, 'Website knowledge mode', 'degraded');
          return;
        }
        if (ai.lastSuccessAt) {
          setAssistantStatus(root, '4 specialist agents online', 'online');
          return;
        }
        if (ai.lastError) {
          setAssistantStatus(root, 'Website knowledge mode', 'degraded');
          return;
        }
        setAssistantStatus(root, 'AI service ready', 'online');
      })
      .catch(function () {
        setAssistantStatus(root, 'Assistant service temporarily unavailable', 'offline');
      })
      .finally(function () { healthPending = null; });

    return healthPending;
  }

  /* Observe chat responses without changing the assistant's request contract. */
  if (!window.__seFetchStatusPatched && typeof window.fetch === 'function') {
    window.__seFetchStatusPatched = true;
    var nativeFetch = window.fetch.bind(window);
    window.fetch = function () {
      var args = arguments;
      return nativeFetch.apply(null, args).then(function (response) {
        try {
          var requestUrl = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
          if (/\/api\/chat(?:\?|$)/.test(requestUrl)) {
            response.clone().json().then(function (data) {
              var root = document.getElementById('se-ai');
              if (!root) return;
              if (data && data.aiPowered === true) {
                setAssistantStatus(root, '4 specialist agents online', 'online');
              } else if (data && data.reply) {
                setAssistantStatus(root, 'Website knowledge mode', 'degraded');
              }
            }).catch(function () {});
          }
        } catch (ignore) {}
        return response;
      });
    };
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
        window.setTimeout(function () {
          log.removeAttribute('aria-busy');
          refreshAssistantHealth(root, true);
        }, 22000);
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
