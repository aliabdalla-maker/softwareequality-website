/*!
 * Software Equality — Agentic AI Assistant
 * agentic-assistant.js
 *
 * Site-wide floating assistant. Talks to the /api/chat function, which holds the
 * provider credentials server-side — no API key is ever present in the browser.
 *
 * Include on any page with:  <script src="agentic-assistant.js" defer></script>
 */
(function () {
  'use strict';

  if (window.__seAssistantLoaded) return;
  window.__seAssistantLoaded = true;

  // Resolve the endpoint from wherever this script was served, so the same file
  // works both on softwareequality.com and when embedded on another domain
  // (e.g. the Squarespace build). Override with window.SE_ASSISTANT_ENDPOINT.
  var ENDPOINT = (function () {
    if (window.SE_ASSISTANT_ENDPOINT) return window.SE_ASSISTANT_ENDPOINT;
    var self = document.currentScript;
    if (self && self.src) {
      try {
        var origin = new URL(self.src, location.href).origin;
        if (origin !== location.origin) return origin + '/api/chat';
      } catch (e) {}
    }
    return '/api/chat';
  })();
  var STORE_KEY = 'se-assistant-thread';
  var SEEN_KEY = 'se-assistant-seen';
  var MAX_TURNS = 10;
  var SIZE_KEY = 'se-assistant-size';
  var SIZES = ['min', 'normal', 'max', 'custom'];
  var SIZE_MIN_W = 300;
  var SIZE_MIN_H = 300;

  var AGENTS = {
    knowledge: { label: 'Knowledge', hint: 'Methodology, services & company' },
    pricing:   { label: 'Pricing',   hint: 'Fees, plans & ROI' },
    scheduler: { label: 'Scheduler', hint: 'Discovery calls & availability' },
    research:  { label: 'Research',  hint: 'Data, standards & citations' }
  };

  /* ----------------------------------------------------------------
     Suggested openers — tuned to the page the visitor landed on
  ---------------------------------------------------------------- */
  function suggestionsForPage() {
    var path = (location.pathname || '').toLowerCase();
    var byPage = {
      'bootcamp':      ['What does the bootcamp cover?', 'How much is a corporate cohort?', 'Book a discovery call'],
      'adlc':          ['Explain the ADLC phases', 'How does ADLC differ from SDLC?', 'What is SPARC?'],
      'framework':     ['Walk me through SPARC', 'What artefacts do I get?', 'How long does a build take?'],
      'ai-governance': ['How do you handle ISO 42001?', 'What does the EU AI Act require?', 'Book a governance review'],
      'ai-projects':   ['Can you rescue a stalled AI project?', 'What is a 60-day Proof of Value?', 'What does it cost?'],
      'sdlc':          ['How does AI change our SDLC?', 'What is TEVV?', 'Train my engineering team'],
      'services':      ['Which service fits my team?', 'What are your day rates?', 'Book a discovery call'],
      'book':          ['How long is a discovery call?', 'What should I prepare?', 'What happens afterwards?'],
      'contact':       ['What are your response times?', 'Where are you based?', 'Book a discovery call'],
      'pricing':       ['What are your prices?', 'Do you offer payment plans?', 'Are there team discounts?']
    };
    for (var key in byPage) {
      if (path.indexOf(key) !== -1) return byPage[key];
    }
    return ['What does Equality Software do?', 'Explain the ADLC methodology', 'How much is a bootcamp?'];
  }

  /* ----------------------------------------------------------------
     Styles
  ---------------------------------------------------------------- */
  var CSS = [
    '#se-ai{--se-ai-cyan:#0284C7;--se-ai-gold:#2563EB;--se-ai-purple:#7C3AED;--se-ai-green:#00A97A;',
    'position:fixed;bottom:1.5rem;right:1.5rem;z-index:9999;font-family:var(--font-sans,Inter,system-ui,sans-serif)}',

    /* launcher */
    '#se-ai-toggle{all:unset;box-sizing:border-box;cursor:pointer;display:flex;align-items:center;gap:.55rem;',
    'padding:.8rem 1.15rem;border-radius:999px;background:linear-gradient(135deg,#2563EB,#0284C7);color:#fff;',
    'font-weight:700;font-size:.875rem;letter-spacing:.01em;box-shadow:0 10px 30px rgba(15,23,42,.28);',
    'transition:transform .25s cubic-bezier(.34,1.56,.64,1),box-shadow .25s;position:relative}',
    '#se-ai-toggle:hover{transform:translateY(-2px);box-shadow:0 16px 40px rgba(15,23,42,.34)}',
    '#se-ai-toggle:focus-visible{outline:3px solid #7C3AED;outline-offset:3px}',
    '#se-ai-toggle svg{width:18px;height:18px;flex:none}',
    '#se-ai-dot{width:7px;height:7px;border-radius:50%;background:#7CF7C6;box-shadow:0 0 0 0 rgba(124,247,198,.75);animation:se-ai-pulse 2.4s infinite}',
    '@keyframes se-ai-pulse{0%{box-shadow:0 0 0 0 rgba(124,247,198,.7)}70%{box-shadow:0 0 0 9px rgba(124,247,198,0)}100%{box-shadow:0 0 0 0 rgba(124,247,198,0)}}',
    '#se-ai-nudge{position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;border-radius:999px;',
    'background:#FF4444;color:#fff;font-size:11px;font-weight:800;display:none;align-items:center;justify-content:center}',
    '#se-ai.open #se-ai-nudge{display:none!important}',

    /* panel — the width/height come from the size-* class on #se-ai (see setSize) */
    '#se-ai-panel{position:absolute;bottom:calc(100% + .85rem);right:0;width:var(--se-ai-w,392px);',
    'max-width:calc(100vw - 2rem);height:var(--se-ai-h,min(560px,calc(100vh - 8rem)));',
    'max-height:calc(100vh - 7rem);display:flex;flex-direction:column;overflow:hidden;',
    'background:var(--surface,#FFFFFF);border:1px solid rgba(30,41,82,.16);border-radius:20px;',
    'box-shadow:0 28px 70px rgba(15,23,42,.26);transform-origin:bottom right;',
    'transition:opacity .22s ease,transform .22s cubic-bezier(.34,1.4,.64,1),visibility .22s,',
    'width .24s cubic-bezier(.4,0,.2,1),height .24s cubic-bezier(.4,0,.2,1)}',
    '#se-ai:not(.open) #se-ai-panel{opacity:0;visibility:hidden;transform:translateY(10px) scale(.96);pointer-events:none}',

    /* size presets: minimised (header only), standard, maximised. size-custom takes
       its dimensions from inline --se-ai-w/--se-ai-h set by the resize grip. */
    '#se-ai.size-normal #se-ai-panel{--se-ai-w:392px;--se-ai-h:min(560px,calc(100vh - 8rem))}',
    '#se-ai.size-max #se-ai-panel{--se-ai-w:min(760px,calc(100vw - 3rem));--se-ai-h:calc(100vh - 7rem)}',
    '#se-ai.size-min #se-ai-panel{--se-ai-w:344px;--se-ai-h:auto}',
    '#se-ai.size-min #se-ai-head{padding:.7rem .8rem}',
    '#se-ai.size-min #se-ai-head h2,#se-ai.size-min #se-ai-status{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#se-ai.size-min #se-ai-rail,#se-ai.size-min #se-ai-log,#se-ai.size-min #se-ai-chips,',
    '#se-ai.size-min #se-ai-form,#se-ai.size-min #se-ai-foot,#se-ai.size-min #se-ai-grip{display:none}',
    '#se-ai.size-min #se-ai-head{cursor:pointer}',
    '#se-ai.resizing #se-ai-panel{transition:none}',
    '#se-ai.resizing #se-ai-log,#se-ai.resizing #se-ai-form{pointer-events:none}',
    /* a reply that landed while minimised */
    '#se-ai.size-min.unread #se-ai-mark::after{content:"";position:absolute;top:-3px;right:-3px;width:9px;height:9px;',
    'border-radius:50%;background:#7CF7C6;box-shadow:0 0 0 2px #5B21B6;animation:se-ai-pulse 2.4s infinite}',

    /* drag grip — any size between the presets */
    '#se-ai-grip{position:absolute;top:0;left:0;width:24px;height:24px;z-index:4;cursor:nwse-resize;',
    'touch-action:none;border-top-left-radius:20px}',
    '#se-ai-grip::after{content:"";position:absolute;top:8px;left:8px;width:7px;height:7px;border-radius:2px 0 0 0;',
    'border-top:2px solid rgba(255,255,255,.65);border-left:2px solid rgba(255,255,255,.65);transition:border-color .2s}',
    '#se-ai-grip:hover::after{border-color:#fff}',

    /* header */
    '#se-ai-head{padding:.95rem 1.1rem;background:linear-gradient(135deg,#5B21B6,#0284C7);color:#fff;',
    'display:flex;align-items:center;gap:.7rem}',
    '#se-ai-head>div{min-width:0}',
    '#se-ai-mark{position:relative;width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,.16);',
    'display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.8rem;flex:none}',
    '#se-ai-head h2{all:unset;display:block;font-family:var(--font-heading,Poppins,Inter,sans-serif);',
    'font-size:.95rem;font-weight:700;color:#fff;line-height:1.2}',
    '#se-ai-status{font-size:.7rem;opacity:.85;display:flex;align-items:center;gap:.35rem;margin-top:.15rem}',
    '#se-ai-status i{width:6px;height:6px;border-radius:50%;background:#7CF7C6;display:inline-block}',
    '#se-ai-tools{margin-left:auto;flex:none;display:flex;align-items:center;gap:.22rem}',
    '.se-ai-icon{all:unset;box-sizing:border-box;cursor:pointer;width:28px;height:28px;border-radius:8px;',
    'display:flex;align-items:center;justify-content:center;color:#fff;font-size:1rem;line-height:1;',
    'background:rgba(255,255,255,.12);transition:background .2s}',
    '.se-ai-icon:hover{background:rgba(255,255,255,.26)}',
    '.se-ai-icon:focus-visible{outline:2px solid #fff;outline-offset:2px}',
    '.se-ai-icon svg{width:14px;height:14px;display:block}',
    '#se-ai-fold .i-restore,#se-ai-size .i-shrink{display:none}',
    '#se-ai.size-min #se-ai-fold .i-fold{display:none}',
    '#se-ai.size-min #se-ai-fold .i-restore{display:block}',
    '#se-ai.size-max #se-ai-size .i-grow{display:none}',
    '#se-ai.size-max #se-ai-size .i-shrink{display:block}',

    /* agent rail */
    '#se-ai-rail{display:flex;gap:.3rem;padding:.55rem .7rem;background:var(--surface2,#E8D5BE);',
    'border-bottom:1px solid rgba(30,41,82,.12);overflow-x:auto;scrollbar-width:none}',
    '#se-ai-rail::-webkit-scrollbar{display:none}',
    '.se-ai-agent{flex:1;min-width:74px;text-align:center;padding:.4rem .3rem;border-radius:9px;',
    'font-size:.68rem;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:rgba(0,0,0,.42);',
    'border:1px solid transparent;transition:all .2s;white-space:nowrap}',
    '.se-ai-agent.active{color:#fff;border-color:transparent}',
    '.se-ai-agent.knowledge.active{background:#0284C7}',
    '.se-ai-agent.pricing.active{background:#2563EB}',
    '.se-ai-agent.scheduler.active{background:#7C3AED}',
    '.se-ai-agent.research.active{background:#00A97A}',

    /* messages */
    '#se-ai-log{flex:1;overflow-y:auto;padding:1rem;display:flex;flex-direction:column;gap:.7rem;',
    'background:var(--bg,#F6F8FC);overscroll-behavior:contain}',
    '.se-ai-msg{max-width:88%;display:flex;flex-direction:column;gap:.3rem}',
    '.se-ai-msg.me{align-self:flex-end;align-items:flex-end}',
    '.se-ai-bubble{padding:.7rem .9rem;border-radius:14px;font-size:.845rem;line-height:1.65;',
    'color:var(--text,#0D0D0D);background:var(--surface,#FFFFFF);border:1px solid rgba(30,41,82,.12);',
    'box-shadow:0 2px 8px rgba(15,23,42,.06);word-wrap:break-word;overflow-wrap:anywhere}',
    '.se-ai-msg.me .se-ai-bubble{background:linear-gradient(135deg,#5B21B6,#7C3AED);color:#fff;border-color:transparent}',
    '.se-ai-bubble p{margin:0 0 .55rem;color:inherit;line-height:1.65}',
    '.se-ai-bubble p:last-child{margin-bottom:0}',
    '.se-ai-bubble ul,.se-ai-bubble ol{margin:.4rem 0 .4rem 1.1rem;padding:0}',
    '.se-ai-bubble li{margin-bottom:.28rem}',
    '.se-ai-bubble a{color:#7C3AED;font-weight:600;text-decoration:underline;text-underline-offset:2px}',
    '.se-ai-msg.me .se-ai-bubble a{color:#fff}',
    '.se-ai-tag{font-size:.62rem;font-weight:800;letter-spacing:.09em;text-transform:uppercase;',
    'padding:.15rem .45rem;border-radius:5px;align-self:flex-start;color:#fff}',
    '.se-ai-tag.knowledge{background:#0284C7}.se-ai-tag.pricing{background:#2563EB}',
    '.se-ai-tag.scheduler{background:#7C3AED}.se-ai-tag.research{background:#00A97A}',
    '.se-ai-typing{display:flex;gap:.25rem;padding:.75rem .9rem;background:var(--surface,#FFFFFF);',
    'border:1px solid rgba(30,41,82,.12);border-radius:14px;align-self:flex-start}',
    '.se-ai-typing span{width:6px;height:6px;border-radius:50%;background:#7C3AED;opacity:.4;',
    'animation:se-ai-bounce 1.3s infinite}',
    '.se-ai-typing span:nth-child(2){animation-delay:.18s}.se-ai-typing span:nth-child(3){animation-delay:.36s}',
    '@keyframes se-ai-bounce{0%,60%,100%{transform:translateY(0);opacity:.35}30%{transform:translateY(-5px);opacity:1}}',

    /* suggestion chips */
    '#se-ai-chips{display:flex;flex-wrap:wrap;gap:.35rem;padding:0 1rem .5rem;background:var(--bg,#F6F8FC)}',
    '#se-ai-chips:empty{display:none}',
    '.se-ai-chip{all:unset;box-sizing:border-box;cursor:pointer;font-size:.755rem;font-weight:600;',
    'padding:.42rem .7rem;border-radius:999px;color:var(--text,#0D0D0D);background:var(--surface,#FFFFFF);',
    'border:1px solid rgba(37,99,235,.4);transition:all .18s}',
    '.se-ai-chip:hover{background:#2563EB;color:#fff;border-color:#2563EB}',
    '.se-ai-chip:focus-visible{outline:2px solid #7C3AED;outline-offset:2px}',

    /* composer */
    '#se-ai-form{display:flex;gap:.5rem;align-items:flex-end;padding:.7rem;background:var(--surface2,#E8D5BE);',
    'border-top:1px solid rgba(30,41,82,.12)}',
    '#se-ai-input{flex:1;box-sizing:border-box;resize:none;max-height:96px;min-height:40px;',
    'padding:.6rem .8rem;border-radius:12px;border:1px solid rgba(30,41,82,.2);background:#FFFDF8;',
    'color:var(--text,#0D0D0D);font-family:inherit;font-size:.845rem;line-height:1.5;outline:none;transition:border-color .2s}',
    '#se-ai-input:focus{border-color:#7C3AED}',
    '#se-ai-send{all:unset;box-sizing:border-box;cursor:pointer;width:40px;height:40px;flex:none;border-radius:12px;',
    'background:linear-gradient(135deg,#2563EB,#0284C7);color:#fff;display:flex;align-items:center;justify-content:center;',
    'transition:transform .18s,opacity .18s}',
    '#se-ai-send:hover:not(:disabled){transform:scale(1.06)}',
    '#se-ai-send:disabled{opacity:.45;cursor:not-allowed}',
    '#se-ai-send:focus-visible{outline:2px solid #7C3AED;outline-offset:2px}',
    '#se-ai-send svg{width:17px;height:17px}',
    '#se-ai-foot{padding:0 .8rem .6rem;background:var(--surface2,#E8D5BE);font-size:.65rem;color:rgba(0,0,0,.45);text-align:center}',

    /* keep the existing back-to-top button clear of the launcher */
    'body.se-ai-ready .back-to-top{bottom:6.25rem}',

    /* mobile */
    '@media(max-width:560px){#se-ai{bottom:1rem;right:1rem;left:1rem}',
    '#se-ai-toggle{margin-left:auto}',
    '#se-ai-panel{width:auto;left:0;right:0;height:min(72vh,540px);max-height:calc(100vh - 6rem)}',
    '#se-ai.size-normal #se-ai-panel,#se-ai.size-custom #se-ai-panel{height:min(72vh,540px)}',
    '#se-ai.size-max #se-ai-panel{height:calc(100vh - 6rem)}',
    '#se-ai.size-min #se-ai-panel{height:auto}',
    '#se-ai-grip{display:none}',
    '#se-ai-toggle span.se-ai-label{display:none}',
    'body.se-ai-ready .back-to-top{bottom:5.5rem}}',

    '@media(prefers-reduced-motion:reduce){#se-ai *,#se-ai-panel{animation:none!important;transition:none!important}}'
  ].join('');

  /* ----------------------------------------------------------------
     Minimal HTML sanitiser for model output
  ---------------------------------------------------------------- */
  var ALLOWED = { A: 1, B: 1, STRONG: 1, I: 1, EM: 1, BR: 1, P: 1, UL: 1, OL: 1, LI: 1, CODE: 1, SPAN: 1 };

  // Dropped outright, contents included — keeping their text would print things
  // like raw script bodies into the conversation.
  var DROP = { SCRIPT: 1, STYLE: 1, IFRAME: 1, OBJECT: 1, EMBED: 1, NOSCRIPT: 1, TEMPLATE: 1, SVG: 1, MATH: 1, FORM: 1 };

  function safeHref(raw) {
    var href = (raw || '').trim();
    if (!href) return null;
    if (/^(https?:|mailto:|tel:)/i.test(href)) return href;
    if (/^[#/]/.test(href)) return href;
    if (/^[\w.-]+\.html(\?[^"'\s]*)?(#[\w-]*)?$/i.test(href)) return href;
    return null;
  }

  function sanitise(html) {
    var src = new DOMParser().parseFromString('<div>' + html + '</div>', 'text/html').body.firstChild;
    var out = document.createDocumentFragment();

    (function walk(from, to) {
      Array.prototype.forEach.call(from.childNodes, function (node) {
        if (node.nodeType === 3) {
          to.appendChild(document.createTextNode(node.nodeValue));
          return;
        }
        if (node.nodeType !== 1) return;

        if (DROP[node.tagName]) return;

        if (!ALLOWED[node.tagName]) {
          walk(node, to); // unwrap the tag, keep its text
          return;
        }

        var el = document.createElement(node.tagName.toLowerCase());
        if (node.tagName === 'A') {
          var href = safeHref(node.getAttribute('href'));
          if (!href) { walk(node, to); return; }
          el.setAttribute('href', href);
          if (/^https?:/i.test(href) && href.indexOf(location.host) === -1) {
            el.setAttribute('target', '_blank');
            el.setAttribute('rel', 'noopener noreferrer');
          }
        }
        walk(node, el);
        to.appendChild(el);
      });
    })(src, out);

    return out;
  }

  /* ----------------------------------------------------------------
     Thread persistence (survives navigation between pages)
  ---------------------------------------------------------------- */
  function loadThread() {
    try {
      var raw = sessionStorage.getItem(STORE_KEY);
      var parsed = raw ? JSON.parse(raw) : null;
      return Array.isArray(parsed) ? parsed.slice(-MAX_TURNS * 2) : [];
    } catch (e) { return []; }
  }

  function saveThread(thread) {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(thread.slice(-MAX_TURNS * 2))); } catch (e) {}
  }

  /* ----------------------------------------------------------------
     Panel size preference (minimised / standard / maximised / dragged)
  ---------------------------------------------------------------- */
  function loadSize() {
    try {
      var pref = JSON.parse(localStorage.getItem(SIZE_KEY) || 'null');
      if (!pref || SIZES.indexOf(pref.mode) === -1) return null;
      return pref;
    } catch (e) { return null; }
  }

  function saveSize(pref) {
    try { localStorage.setItem(SIZE_KEY, JSON.stringify(pref)); } catch (e) {}
  }

  /* ----------------------------------------------------------------
     Build
  ---------------------------------------------------------------- */
  function build() {
    if (document.getElementById('se-ai')) return;

    var style = document.createElement('style');
    style.id = 'se-ai-style';
    style.textContent = CSS;
    document.head.appendChild(style);

    var root = document.createElement('div');
    root.id = 'se-ai';
    root.innerHTML =
      '<div id="se-ai-panel" role="dialog" aria-modal="false" aria-labelledby="se-ai-title">' +
        '<div id="se-ai-grip" title="Drag to resize" aria-hidden="true"></div>' +
        '<div id="se-ai-head">' +
          '<div id="se-ai-mark" aria-hidden="true">ES</div>' +
          '<div>' +
            '<h2 id="se-ai-title">Equality Software AI</h2>' +
            '<div id="se-ai-status"><i aria-hidden="true"></i>4 specialist agents online</div>' +
          '</div>' +
          '<div id="se-ai-tools">' +
            '<button id="se-ai-fold" class="se-ai-icon" type="button" aria-label="Minimise the assistant" ' +
              'title="Minimise" aria-expanded="true" aria-controls="se-ai-log">' +
              '<svg class="i-fold" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ' +
                'stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>' +
              '<svg class="i-restore" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ' +
                'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>' +
            '</button>' +
            '<button id="se-ai-size" class="se-ai-icon" type="button" aria-label="Maximise the assistant" title="Maximise">' +
              '<svg class="i-grow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
                'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                '<path d="M14 4h6v6"/><path d="M10 20H4v-6"/><path d="M20 4l-7 7"/><path d="M4 20l7-7"/></svg>' +
              '<svg class="i-shrink" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
                'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                '<path d="M20 10h-6V4"/><path d="M4 14h6v6"/><path d="M14 10l6-6"/><path d="M10 14l-6 6"/></svg>' +
            '</button>' +
            '<button id="se-ai-close" class="se-ai-icon" type="button" aria-label="Close the assistant">&#10005;</button>' +
          '</div>' +
        '</div>' +
        '<div id="se-ai-rail" role="list" aria-label="Specialist agents">' +
          Object.keys(AGENTS).map(function (k) {
            return '<div class="se-ai-agent ' + k + '" role="listitem" data-agent="' + k + '" title="' +
              AGENTS[k].hint + '">' + AGENTS[k].label + '</div>';
          }).join('') +
        '</div>' +
        '<div id="se-ai-log" role="log" aria-live="polite" aria-atomic="false"></div>' +
        '<div id="se-ai-chips"></div>' +
        '<form id="se-ai-form">' +
          '<label class="se-ai-sr" for="se-ai-input" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Message the assistant</label>' +
          '<textarea id="se-ai-input" rows="1" placeholder="Ask about ADLC, pricing, bootcamps&hellip;" maxlength="2000"></textarea>' +
          '<button id="se-ai-send" type="submit" aria-label="Send message">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2 11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>' +
          '</button>' +
        '</form>' +
        '<div id="se-ai-foot">AI-generated. Verify details with the team before relying on them.</div>' +
      '</div>' +
      '<button id="se-ai-toggle" type="button" aria-expanded="false" aria-controls="se-ai-panel">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
        '<span class="se-ai-label">Ask our AI</span>' +
        '<span id="se-ai-dot" aria-hidden="true"></span>' +
        '<span id="se-ai-nudge" aria-hidden="true">1</span>' +
      '</button>';

    document.body.appendChild(root);
    document.body.classList.add('se-ai-ready');
    wire(root);
  }

  /* ----------------------------------------------------------------
     Behaviour
  ---------------------------------------------------------------- */
  function wire(root) {
    var panel = root.querySelector('#se-ai-panel');
    var toggle = root.querySelector('#se-ai-toggle');
    var closeBtn = root.querySelector('#se-ai-close');
    var foldBtn = root.querySelector('#se-ai-fold');
    var sizeBtn = root.querySelector('#se-ai-size');
    var head = root.querySelector('#se-ai-head');
    var grip = root.querySelector('#se-ai-grip');
    var log = root.querySelector('#se-ai-log');
    var chips = root.querySelector('#se-ai-chips');
    var form = root.querySelector('#se-ai-form');
    var input = root.querySelector('#se-ai-input');
    var send = root.querySelector('#se-ai-send');
    var nudge = root.querySelector('#se-ai-nudge');

    var thread = loadThread();
    var open = false;
    var busy = false;
    var page = document.title + ' | ' + location.pathname;

    /* size state — minimised, standard, maximised, or a dragged size in between */
    var pref = loadSize() || {};
    var size = pref.mode || 'normal';
    var custom = {
      w: typeof pref.w === 'number' ? pref.w : 392,
      h: typeof pref.h === 'number' ? pref.h : 560
    };
    // What to come back to when the panel is un-minimised.
    var lastOpenSize = size !== 'min' ? size : (pref.last && pref.last !== 'min' ? pref.last : 'normal');
    // What the maximise button toggles back to.
    var preMax = lastOpenSize !== 'max' ? lastOpenSize : 'normal';

    function sizeLimits() {
      return {
        w: Math.max(SIZE_MIN_W, window.innerWidth - 48),
        h: Math.max(SIZE_MIN_H, window.innerHeight - 112)
      };
    }

    function clampCustom() {
      var lim = sizeLimits();
      custom.w = Math.min(Math.max(Math.round(custom.w), SIZE_MIN_W), lim.w);
      custom.h = Math.min(Math.max(Math.round(custom.h), SIZE_MIN_H), lim.h);
    }

    function applyCustomVars() {
      panel.style.setProperty('--se-ai-w', custom.w + 'px');
      panel.style.setProperty('--se-ai-h', custom.h + 'px');
    }

    function setSize(mode) {
      if (SIZES.indexOf(mode) === -1) return;
      if (mode === 'custom') clampCustom();

      size = mode;
      SIZES.forEach(function (m) { root.classList.toggle('size-' + m, m === mode); });

      if (mode === 'custom') {
        applyCustomVars();
      } else {
        panel.style.removeProperty('--se-ai-w');
        panel.style.removeProperty('--se-ai-h');
      }

      if (mode !== 'min') {
        lastOpenSize = mode;
        root.classList.remove('unread');
      }
      if (mode !== 'min' && mode !== 'max') preMax = mode;

      foldBtn.setAttribute('aria-label', mode === 'min' ? 'Restore the assistant' : 'Minimise the assistant');
      foldBtn.setAttribute('title', mode === 'min' ? 'Restore' : 'Minimise');
      foldBtn.setAttribute('aria-expanded', String(mode !== 'min'));
      sizeBtn.setAttribute('aria-label', mode === 'max' ? 'Restore the assistant to its standard size' : 'Maximise the assistant');
      sizeBtn.setAttribute('title', mode === 'max' ? 'Restore size' : 'Maximise');

      saveSize({ mode: size, w: custom.w, h: custom.h, last: lastOpenSize });
      if (mode !== 'min') scrollDown();
    }

    function expand() {
      if (size === 'min') setSize(lastOpenSize);
    }

    function setAgent(agent) {
      root.querySelectorAll('.se-ai-agent').forEach(function (el) {
        el.classList.toggle('active', el.getAttribute('data-agent') === agent);
      });
    }

    function scrollDown() { log.scrollTop = log.scrollHeight; }

    function addUser(text) {
      var wrap = document.createElement('div');
      wrap.className = 'se-ai-msg me';
      var bubble = document.createElement('div');
      bubble.className = 'se-ai-bubble';
      bubble.textContent = text;
      wrap.appendChild(bubble);
      log.appendChild(wrap);
      scrollDown();
    }

    function addBot(html, agent) {
      var wrap = document.createElement('div');
      wrap.className = 'se-ai-msg';
      if (agent) {
        var tag = document.createElement('span');
        tag.className = 'se-ai-tag ' + agent;
        tag.textContent = AGENTS[agent] ? AGENTS[agent].label : agent;
        wrap.appendChild(tag);
      }
      var bubble = document.createElement('div');
      bubble.className = 'se-ai-bubble';
      bubble.appendChild(sanitise(html));
      wrap.appendChild(bubble);
      log.appendChild(wrap);
      scrollDown();
      if (open && size === 'min') root.classList.add('unread');
    }

    function showTyping() {
      var t = document.createElement('div');
      t.className = 'se-ai-typing';
      t.id = 'se-ai-typing';
      t.innerHTML = '<span></span><span></span><span></span>';
      log.appendChild(t);
      scrollDown();
    }

    function hideTyping() {
      var t = document.getElementById('se-ai-typing');
      if (t) t.remove();
    }

    function renderChips(list) {
      chips.innerHTML = '';
      (list || []).forEach(function (text) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'se-ai-chip';
        b.textContent = text;
        b.addEventListener('click', function () { submit(text); });
        chips.appendChild(b);
      });
    }

    function renderThread() {
      log.innerHTML = '';

      if (thread.length === 0) {
        addBot(
          'Hello. I am the <strong>Equality Software AI</strong> — four specialist agents covering our ' +
          'methodology, pricing, scheduling and research. Ask me anything, or pick a starting point below.',
          'knowledge'
        );
        renderChips(suggestionsForPage());
        setAgent('knowledge');
        return;
      }

      // Replay a conversation carried over from an earlier page.
      var lastAgent = 'knowledge';
      thread.forEach(function (m) {
        if (m.role === 'user') {
          addUser(m.content);
        } else {
          lastAgent = AGENTS[m.agent] ? m.agent : 'knowledge';
          addBot(m.content, lastAgent);
        }
      });
      renderChips([]);
      setAgent(lastAgent);
    }

    function setOpen(next) {
      open = next;
      root.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
      if (open) {
        expand();
        nudge.style.display = 'none';
        try { sessionStorage.setItem(SEEN_KEY, '1'); } catch (e) {}
        setTimeout(function () { if (size !== 'min') { input.focus(); scrollDown(); } }, 180);
      } else {
        toggle.focus();
      }
    }

    function submit(text) {
      var message = (text || input.value || '').trim();
      if (!message || busy) return;

      if (!open) setOpen(true);
      expand();
      renderChips([]);
      addUser(message);
      thread.push({ role: 'user', content: message });
      saveThread(thread);

      input.value = '';
      input.style.height = 'auto';
      busy = true;
      send.disabled = true;
      showTyping();

      var payload = thread.map(function (m) { return { role: m.role, content: m.content }; });

      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: payload.slice(-MAX_TURNS * 2), page: page })
      })
        .then(function (res) {
          return res.json().then(function (data) { return { ok: res.ok, data: data }; });
        })
        .then(function (result) {
          hideTyping();
          busy = false;
          send.disabled = false;

          if (!result.ok || !result.data || !result.data.reply) {
            var note = (result.data && result.data.error) ||
              'The assistant is unavailable right now.';
            addBot(note + ' You can still <a href="contact.html">contact the team</a> or ' +
              '<a href="book.html">book a discovery call</a>.', 'knowledge');
            return;
          }

          var agent = AGENTS[result.data.agent] ? result.data.agent : 'knowledge';
          setAgent(agent);
          addBot(result.data.reply, agent);
          thread.push({ role: 'assistant', content: result.data.reply, agent: agent });
          saveThread(thread);
        })
        .catch(function () {
          hideTyping();
          busy = false;
          send.disabled = false;
          addBot('Connection problem — please try again, or ' +
            '<a href="contact.html">contact the team</a> directly.', 'knowledge');
        });
    }

    /* events */
    toggle.addEventListener('click', function () { setOpen(!open); });
    closeBtn.addEventListener('click', function () { setOpen(false); });

    foldBtn.addEventListener('click', function () {
      if (size === 'min') { setSize(lastOpenSize); input.focus(); }
      else { setSize('min'); foldBtn.focus(); }
    });

    sizeBtn.addEventListener('click', function () {
      setSize(size === 'max' ? preMax : 'max');
      if (size !== 'min') input.focus();
    });

    /* the collapsed header is itself the restore target */
    head.addEventListener('click', function (e) {
      if (size !== 'min') return;
      if (e.target.closest && e.target.closest('.se-ai-icon')) return;
      setSize(lastOpenSize);
      input.focus();
    });

    /* drag the top-left grip for any size between the presets */
    var drag = null;

    grip.addEventListener('pointerdown', function (e) {
      if (size === 'min' || window.innerWidth <= 560) return;
      e.preventDefault();
      drag = { x: e.clientX, y: e.clientY, w: panel.offsetWidth, h: panel.offsetHeight, changed: false };
      root.classList.add('resizing');
      try { grip.setPointerCapture(e.pointerId); } catch (err) {}
    });

    grip.addEventListener('pointermove', function (e) {
      if (!drag) return;
      custom.w = drag.w + (drag.x - e.clientX);
      custom.h = drag.h + (drag.y - e.clientY);
      clampCustom();
      if (size !== 'custom') {
        size = 'custom';
        SIZES.forEach(function (m) { root.classList.toggle('size-' + m, m === 'custom'); });
      }
      drag.changed = true;
      applyCustomVars();
    });

    function endDrag(e) {
      if (!drag) return;
      var changed = drag.changed;
      drag = null;
      root.classList.remove('resizing');
      try { grip.releasePointerCapture(e.pointerId); } catch (err) {}
      if (changed) setSize('custom');
    }

    grip.addEventListener('pointerup', endDrag);
    grip.addEventListener('pointercancel', endDrag);
    grip.addEventListener('dblclick', function () { setSize('normal'); });

    /* keep a dragged size inside the viewport */
    window.addEventListener('resize', function () {
      if (size !== 'custom') return;
      clampCustom();
      applyCustomVars();
    });

    form.addEventListener('submit', function (e) { e.preventDefault(); submit(); });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
    });
    input.addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 96) + 'px';
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && open) setOpen(false);
    });

    /* public API so page content can hand a question to the assistant */
    window.seAssistant = {
      open: function () { setOpen(true); },
      close: function () { setOpen(false); },
      ask: function (text) { setOpen(true); submit(text); },
      minimise: function () { setOpen(true); setSize('min'); },
      maximise: function () { setOpen(true); setSize('max'); },
      restore: function () { setOpen(true); setSize('normal'); },
      setSize: function (mode) { setOpen(true); setSize(mode === 'custom' ? 'normal' : mode); },
      getSize: function () { return size; },
      reset: function () {
        thread = [];
        saveThread(thread);
        renderThread();
      }
    };

    /* any element with data-se-ai-ask opens the assistant with that question */
    document.addEventListener('click', function (e) {
      var trigger = e.target.closest && e.target.closest('[data-se-ai-ask]');
      if (!trigger) return;
      e.preventDefault();
      window.seAssistant.ask(trigger.getAttribute('data-se-ai-ask') || '');
    });

    setSize(size);
    renderThread();

    var seen = false;
    try { seen = sessionStorage.getItem(SEEN_KEY) === '1'; } catch (e) {}
    if (!seen) setTimeout(function () { if (!open) nudge.style.display = 'flex'; }, 9000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
