/* Equality Software site navigation: mega menus, mobile drawer, active page, search shortcut. */
(function () {
  'use strict';
  var header = document.getElementById('se5-header');
  if (!header) return;
  var items = Array.prototype.slice.call(header.querySelectorAll('[data-se5-menu]'));
  var burger = header.querySelector('.se5-burger');
  var drawer = document.getElementById('se5-drawer');
  var canHover = window.matchMedia('(hover: hover) and (min-width: 1081px)');
  var closeTimer = null;

  function setOpen(item, open) {
    var btn = item.querySelector('.se5-top');
    item.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  function closeAll(except) {
    items.forEach(function (it) { if (it !== except) setOpen(it, false); });
  }

  items.forEach(function (item) {
    var btn = item.querySelector('.se5-top');
    var panel = item.querySelector('.se5-panel');
    btn.addEventListener('click', function () {
      var open = !item.classList.contains('is-open');
      closeAll(item);
      setOpen(item, open);
    });
    item.addEventListener('mouseenter', function () {
      if (!canHover.matches) return;
      clearTimeout(closeTimer);
      closeAll(item);
      setOpen(item, true);
    });
    item.addEventListener('mouseleave', function () {
      if (!canHover.matches) return;
      closeTimer = setTimeout(function () { setOpen(item, false); }, 180);
    });
    item.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && item.classList.contains('is-open')) {
        setOpen(item, false);
        btn.focus();
      }
      if (e.key === 'ArrowDown' && document.activeElement === btn) {
        e.preventDefault();
        if (!item.classList.contains('is-open')) { closeAll(item); setOpen(item, true); }
        var first = panel && panel.querySelector('a');
        if (first) setTimeout(function () { first.focus(); }, 60);
      }
    });
    item.addEventListener('focusout', function (e) {
      if (!item.contains(e.relatedTarget)) setOpen(item, false);
    });
  });

  document.addEventListener('click', function (e) {
    if (!e.target.closest('[data-se5-menu]')) closeAll();
  });

  /* Mobile drawer */
  function setDrawer(open) {
    if (!drawer || !burger) return;
    drawer.hidden = !open;
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    header.classList.toggle('drawer-open', open);
    document.documentElement.classList.toggle('se5-lock', open);
    if (open) { var f = drawer.querySelector('button, a, summary'); if (f) f.focus(); }
  }
  if (burger) burger.addEventListener('click', function () { setDrawer(drawer.hidden); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && drawer && !drawer.hidden) { setDrawer(false); burger.focus(); }
  });
  window.addEventListener('resize', function () { if (window.innerWidth > 1080 && drawer && !drawer.hidden) setDrawer(false); });

  /* Search: reuse the site search overlay (Ctrl+K) from enterprise.js */
  Array.prototype.forEach.call(document.querySelectorAll('[data-se5-search]'), function (b) {
    b.addEventListener('click', function () {
      setDrawer(false);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });
  });

  /* Active page */
  var path = window.location.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
  Array.prototype.forEach.call(document.querySelectorAll('.se5-header a[href^="/"], .se5-footer a[href^="/"]'), function (a) {
    var href = a.getAttribute('href').replace(/\/$/, '') || '/';
    if (href === path) {
      a.setAttribute('aria-current', 'page');
      var item = a.closest('.se5-item');
      if (item) item.classList.add('is-current');
      var group = a.closest('.se5-d-group');
      if (group) group.open = true;
    }
  });

  /* Shadow once the page scrolls */
  function onScroll() { header.classList.toggle('is-scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
/* Hide the floating reading aids once the footer is on screen */
(function () {
  var footer = document.querySelector('.se5-footer');
  if (!footer || !('IntersectionObserver' in window)) return;
  new IntersectionObserver(function (entries) {
    var hide = entries[0].isIntersecting;
    ['se-toc-panel', 'se-share-bar'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.style.visibility = hide ? 'hidden' : '';
    });
  }).observe(footer);
})();

/* Load site-wide interaction fixes once. Kept separate so the repair can be
   iterated without disturbing the navigation contract. */
(function () {
  if (window.__seInteractionFixesRequested) return;
  window.__seInteractionFixesRequested = true;
  var s = document.createElement('script');
  s.src = '/interaction-fixes.js?v=1';
  s.defer = true;
  s.async = false;
  document.head.appendChild(s);
})();
