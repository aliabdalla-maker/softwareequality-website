/*!
 * Software Equality - Enterprise JS
 * enterprise.js  |  ~500 lines
 */

(function () {
  'use strict';

  /* ============================================================
     UTILITIES
  ============================================================ */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

  const debounce = (fn, ms) => {
    let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  };

  /* ============================================================
     1. MEGA NAV
  ============================================================ */
  function initMegaNav() {
    const items = $$('.se-nav-item[data-mega]');
    let closeTimer = null;

    items.forEach(item => {
      const mega = item.querySelector('.se-mega');
      if (!mega) return;

      const openMenu = () => {
        clearTimeout(closeTimer);
        // Close all others
        items.forEach(i => i !== item && i.classList.remove('open'));
        item.classList.add('open');
      };

      const closeMenu = () => {
        closeTimer = setTimeout(() => item.classList.remove('open'), 200);
      };

      item.addEventListener('mouseenter', openMenu);
      item.addEventListener('mouseleave', closeMenu);
      mega.addEventListener('mouseenter', () => clearTimeout(closeTimer));
      mega.addEventListener('mouseleave', closeMenu);

      // Keyboard
      const trigger = item.querySelector('.se-nav-link');
      if (trigger) {
        trigger.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            item.classList.toggle('open');
          }
          if (e.key === 'Escape') item.classList.remove('open');
        });
      }
    });

    // Close on outside click
    document.addEventListener('click', e => {
      if (!e.target.closest('.se-nav-item')) {
        items.forEach(i => i.classList.remove('open'));
      }
    });
  }

  /* ============================================================
     2. MOBILE NAV
  ============================================================ */
  function initMobileNav() {
    const hamburger = $('.se-hamburger');
    const mobileNav = $('.se-mobile-nav');
    const overlay   = $('.se-mobile-overlay');
    const closeBtn  = $('.se-mobile-close');

    if (!hamburger || !mobileNav) return;

    const open = () => {
      hamburger.classList.add('open');
      hamburger.setAttribute('aria-expanded', 'true');
      mobileNav.classList.add('open');
      if (overlay) overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    };

    const close = () => {
      hamburger.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
      mobileNav.classList.remove('open');
      if (overlay) overlay.classList.remove('active');
      document.body.style.overflow = '';
    };

    hamburger.addEventListener('click', () =>
      mobileNav.classList.contains('open') ? close() : open()
    );

    if (closeBtn) closeBtn.addEventListener('click', close);
    if (overlay) overlay.addEventListener('click', close);

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && mobileNav.classList.contains('open')) close();
    });

    // Mobile sub-menu toggles
    $$('.se-mobile-link[data-sub]').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        const subId = link.dataset.sub;
        const sub = $('#' + subId);
        if (sub) {
          const isOpen = sub.classList.contains('open');
          $$('.se-mobile-sub.open').forEach(s => s !== sub && s.classList.remove('open'));
          sub.classList.toggle('open', !isOpen);
        }
      });
    });
  }

  /* ============================================================
     3. STICKY NAV (add .scrolled on scroll > 50px)
  ============================================================ */
  function initStickyNav() {
    const nav = $('.se-nav');
    if (!nav) return;

    const toggle = () => nav.classList.toggle('scrolled', window.scrollY > 50);
    window.addEventListener('scroll', toggle, { passive: true });
    toggle();
  }

  /* ============================================================
     4. ACTIVE NAV (highlight current page link)
  ============================================================ */
  function initActiveNav() {
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    $$('.se-nav-link, .se-footer-links a').forEach(a => {
      const href = (a.getAttribute('href') || '').split('/').pop();
      if (href && href !== '#' && href === currentPath) a.classList.add('active');
    });
  }

  /* ============================================================
     5. SCROLL REVEAL (IntersectionObserver)
  ============================================================ */
  function initScrollReveal() {
    const els = $$('[class*="reveal"]');
    if (!els.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

    els.forEach(el => observer.observe(el));
  }

  /* ============================================================
     6. COUNT-UP ANIMATION
  ============================================================ */
  function initCountUp() {
    const els = $$('.count-up');
    if (!els.length) return;

    const easeOutQuart = t => 1 - Math.pow(1 - t, 4);

    const animateCount = (el) => {
      const target  = parseFloat(el.dataset.target || el.textContent) || 0;
      const suffix  = el.dataset.suffix || '';
      const prefix  = el.dataset.prefix || '';
      const dec     = el.dataset.decimals ? parseInt(el.dataset.decimals) : 0;
      const dur     = parseInt(el.dataset.duration || 2000);
      let start     = null;

      const step = (timestamp) => {
        if (!start) start = timestamp;
        const elapsed = timestamp - start;
        const progress = Math.min(elapsed / dur, 1);
        const eased    = easeOutQuart(progress);
        const current  = target * eased;
        el.textContent = prefix + (dec ? current.toFixed(dec) : Math.floor(current)) + suffix;
        if (progress < 1) requestAnimationFrame(step);
        else el.textContent = prefix + (dec ? target.toFixed(dec) : target) + suffix;
      };

      requestAnimationFrame(step);
    };

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCount(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });

    els.forEach(el => observer.observe(el));
  }

  /* ============================================================
     7. SMOOTH SCROLL
  ============================================================ */
  function initSmoothScroll() {
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href').slice(1);
      if (!id) return;
      const target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      const nav = $('.se-nav');
      const offset = nav ? nav.offsetHeight + 16 : 80;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  }

  /* ============================================================
     8. ACCORDION
  ============================================================ */
  function initAccordion() {
    $$('.se-accordion-trigger').forEach(trigger => {
      trigger.addEventListener('click', () => {
        const item = trigger.closest('.se-accordion-item');
        if (!item) return;
        const isOpen = item.classList.contains('open');
        // Close siblings in same accordion
        const parent = item.closest('.se-accordion');
        if (parent) {
          $$('.se-accordion-item.open', parent).forEach(i => i !== item && i.classList.remove('open'));
        }
        item.classList.toggle('open', !isOpen);
        trigger.setAttribute('aria-expanded', String(!isOpen));
      });
    });
  }

  /* ============================================================
     9. TABS
  ============================================================ */
  function initTabs() {
    $$('.se-tabs-nav').forEach(nav => {
      const tabs   = $$('.se-tab', nav);
      const parent = nav.closest('.se-tabs') || nav.parentElement;

      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
          tab.classList.add('active');
          tab.setAttribute('aria-selected', 'true');

          const panelId = tab.dataset.panel;
          $$('.se-tab-panel', parent).forEach(p => p.classList.remove('active'));
          const panel = $('#' + panelId, parent) || $('[data-panel-id="' + panelId + '"]', parent);
          if (panel) panel.classList.add('active');
        });
      });

      // Activate first tab
      if (tabs[0]) tabs[0].click();

      // Mouse wheel horizontal scroll on tab nav
      nav.addEventListener('wheel', e => {
        if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) {
          e.preventDefault();
          nav.scrollLeft += e.deltaY;
        }
      }, { passive: false });

      // Mouse drag horizontal scroll on tab nav
      let tabDragging = false, tabDragX = 0, tabScrollX = 0;
      nav.style.cursor = 'default';
      nav.addEventListener('mousedown', e => {
        if (e.target.closest('.se-tab')) return; // let tab clicks still work
        tabDragging = true; tabDragX = e.clientX; tabScrollX = nav.scrollLeft;
        nav.style.cursor = 'grabbing'; e.preventDefault();
      });
      document.addEventListener('mouseup', () => {
        if (!tabDragging) return;
        tabDragging = false; nav.style.cursor = 'default';
      });
      document.addEventListener('mousemove', e => {
        if (!tabDragging) return;
        nav.scrollLeft = tabScrollX - (e.clientX - tabDragX);
      });
    });
  }

  /* ============================================================
     10. COOKIE BANNER
  ============================================================ */
  function initCookieBanner() {
    const banner = $('.se-cookie-banner');
    if (!banner) return;

    if (localStorage.getItem('se_cookies_accepted')) return;

    setTimeout(() => banner.classList.add('visible'), 1500);

    const accept = banner.querySelector('[data-cookie-accept]');
    const decline = banner.querySelector('[data-cookie-decline]');

    if (accept) {
      accept.addEventListener('click', () => {
        localStorage.setItem('se_cookies_accepted', '1');
        banner.classList.remove('visible');
      });
    }
    if (decline) {
      decline.addEventListener('click', () => {
        banner.classList.remove('visible');
      });
    }
  }

  /* ============================================================
     11. BACK TO TOP
  ============================================================ */
  function initBackToTop() {
    const btn = $('.back-to-top');
    if (!btn) return;

    const toggle = () => btn.classList.toggle('visible', window.scrollY > 400);
    window.addEventListener('scroll', toggle, { passive: true });

    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    toggle();
  }

  /* ============================================================
     12. TESTIMONIAL CAROUSEL
  ============================================================ */
  function initCarousel() {
    $$('.se-carousel').forEach(carousel => {
      const track  = carousel.querySelector('.se-carousel-track');
      const slides = $$('.se-carousel-slide', carousel);
      const dots   = $$('.se-carousel-dot', carousel);
      if (!track || slides.length < 2) return;

      let current = 0;
      let timer   = null;

      const goTo = (idx) => {
        current = (idx + slides.length) % slides.length;
        track.style.transform = `translateX(-${current * 100}%)`;
        dots.forEach((d, i) => d.classList.toggle('active', i === current));
      };

      const next = () => goTo(current + 1);

      const start = () => { timer = setInterval(next, 5000); };
      const stop  = () => clearInterval(timer);

      dots.forEach((dot, i) => dot.addEventListener('click', () => { stop(); goTo(i); start(); }));

      // Touch swipe
      let startX = 0;
      track.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
      track.addEventListener('touchend', e => {
        const diff = startX - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) { stop(); diff > 0 ? next() : goTo(current - 1); start(); }
      });

      // Mouse drag
      let isDragging = false, dragStartX = 0;
      track.style.cursor = 'grab';
      track.addEventListener('mousedown', e => {
        isDragging = true; dragStartX = e.clientX;
        track.style.cursor = 'grabbing';
        stop();
      });
      document.addEventListener('mousemove', e => {
        if (!isDragging) return;
        e.preventDefault();
      }, { passive: false });
      document.addEventListener('mouseup', e => {
        if (!isDragging) return;
        isDragging = false;
        track.style.cursor = 'grab';
        const diff = dragStartX - e.clientX;
        if (Math.abs(diff) > 40) { diff > 0 ? next() : goTo(current - 1); }
        start();
      });
      track.addEventListener('mouseleave', () => {
        if (isDragging) { isDragging = false; track.style.cursor = 'grab'; start(); }
      });

      carousel.addEventListener('mouseenter', stop);
      carousel.addEventListener('mouseleave', () => { if (!isDragging) start(); });

      goTo(0);
      start();
    });
  }

  /* ============================================================
     13. LAZY LOAD IMAGES
  ============================================================ */
  function initLazyLoad() {
    const imgs = $$('img[data-src]');
    if (!imgs.length) return;

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
          observer.unobserve(img);
        }
      });
    }, { rootMargin: '200px' });

    imgs.forEach(img => observer.observe(img));
  }

  /* ============================================================
     14. ANNOUNCEMENT BAR CLOSE
  ============================================================ */
  function initAnnouncement() {
    const bar = $('.se-announcement');
    const btn = bar && bar.querySelector('.close-ann');
    if (!btn) return;

    const key = 'se_ann_closed_v1';
    if (sessionStorage.getItem(key)) {
      if (bar) bar.style.display = 'none';
      return;
    }

    btn.addEventListener('click', () => {
      bar.style.maxHeight = bar.offsetHeight + 'px';
      requestAnimationFrame(() => {
        bar.style.transition = 'max-height 0.3s ease, opacity 0.3s ease';
        bar.style.maxHeight = '0';
        bar.style.overflow  = 'hidden';
        bar.style.opacity   = '0';
      });
      sessionStorage.setItem(key, '1');
    });
  }

  /* ============================================================
     15. FORM VALIDATION
  ============================================================ */
  function initForms() {
    $$('.se-form').forEach(form => {
      form.addEventListener('submit', e => {
        let valid = true;

        $$('[required]', form).forEach(field => {
          const errEl = field.parentElement.querySelector('.se-error-msg');
          if (!field.value.trim()) {
            field.classList.add('error');
            if (errEl) errEl.classList.add('visible');
            valid = false;
          } else {
            field.classList.remove('error');
            if (errEl) errEl.classList.remove('visible');
          }

          // Email
          if (field.type === 'email' && field.value.trim()) {
            const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!re.test(field.value.trim())) {
              field.classList.add('error');
              if (errEl) { errEl.textContent = 'Please enter a valid email address.'; errEl.classList.add('visible'); }
              valid = false;
            }
          }
        });

        if (!valid) e.preventDefault();
      });

      // Live validation
      $$('[required]', form).forEach(field => {
        field.addEventListener('blur', () => {
          const errEl = field.parentElement.querySelector('.se-error-msg');
          if (!field.value.trim()) {
            field.classList.add('error');
            if (errEl) errEl.classList.add('visible');
          } else {
            field.classList.remove('error');
            field.classList.add('success');
            if (errEl) errEl.classList.remove('visible');
          }
        });
      });
    });
  }

  /* ============================================================
     16. TOAST NOTIFICATIONS
  ============================================================ */
  window.seToast = function(msg, type = '', dur = 3000) {
    let toast = $('.se-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'se-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.className = 'se-toast' + (type ? ' se-toast-' + type : '');
    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(() => toast.classList.remove('visible'), dur);
  };

  /* ============================================================
     INIT ALL
  ============================================================ */
  document.addEventListener('DOMContentLoaded', () => {
    initMegaNav();
    initMobileNav();
    initStickyNav();
    initActiveNav();
    initScrollReveal();
    initCountUp();
    initSmoothScroll();
    initAccordion();

  /* ============================================================
     ANIMATION ENGINE — Flash / Dreamweaver style effects
  ============================================================ */

  /* --- Particle Canvas ---------------------------------------- */
  function initParticles() {
    const canvas = document.createElement('canvas');
    canvas.id = 'se-particles';
    document.body.prepend(canvas);
    const ctx = canvas.getContext('2d');
    let W, H, particles = [], raf;

    function resize() {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const COUNT = window.innerWidth < 768 ? 40 : 80;
    for (let i = 0; i < COUNT; i++) {
      particles.push({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 1.8 + 0.5,
        a: Math.random(),
        c: ['#0B1530','#00D4FF','#7C3AED','#FFBF40'][Math.floor(Math.random()*4)]
      });
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.c;
        ctx.globalAlpha = p.a;
        ctx.fill();
      });
      // Draw connecting lines between nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = '#00D4FF';
            ctx.globalAlpha = (1 - dist/100) * 0.12;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    }
    draw();
  }

  /* --- 3D Card Tilt ------------------------------------------- */
  function initCardTilt() {
    if (window.innerWidth < 768) return; // disable on mobile
    $$('.se-card, .se-card-glass, .se-stat-card, .se-price-card').forEach(card => {
      card.classList.add('se-tilt');
      card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width  - 0.5;
        const y = (e.clientY - r.top)  / r.height - 0.5;
        card.style.transform = `perspective(800px) rotateX(${-y * 8}deg) rotateY(${x * 8}deg) translateY(-4px)`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  }

  /* --- Sparkle on hover --------------------------------------- */
  function initSparkles() {
    if (window.innerWidth < 768) return;
    $$('.btn-primary, .btn-secondary, .se-nav-cta .btn').forEach(btn => {
      btn.classList.add('se-sparkle-host');
      btn.addEventListener('mouseenter', () => fireSparkles(btn));
    });
  }

  function fireSparkles(el) {
    const colors = ['#0B1530','#FFBF40','#00D4FF','#ffffff'];
    for (let i = 0; i < 8; i++) {
      const s = document.createElement('span');
      s.className = 'se-sparkle';
      const angle = (i / 8) * 360;
      const dist  = 24 + Math.random() * 20;
      const sx = Math.cos(angle * Math.PI/180) * dist;
      const sy = Math.sin(angle * Math.PI/180) * dist;
      s.style.cssText = `
        left:${40 + Math.random()*20}%; top:${30+Math.random()*40}%;
        background:${colors[i%colors.length]};
        --sx:${sx}px; --sy:${sy}px;
        animation-delay:${i*0.05}s;
        width:${4+Math.random()*4}px; height:${4+Math.random()*4}px;
      `;
      el.appendChild(s);
      setTimeout(() => s.remove(), 900);
    }
  }

  /* --- Ripple effect on buttons ------------------------------- */
  function initRipple() {
    $$('.btn, .se-chip, .se-tab').forEach(el => {
      el.classList.add('se-ripple-host');
      el.addEventListener('click', e => {
        const r = el.getBoundingClientRect();
        const ripple = document.createElement('span');
        ripple.className = 'se-ripple';
        const size = Math.max(r.width, r.height);
        ripple.style.cssText = `
          width:${size}px; height:${size}px;
          left:${e.clientX - r.left - size/2}px;
          top:${e.clientY - r.top  - size/2}px;
        `;
        el.appendChild(ripple);
        setTimeout(() => ripple.remove(), 700);
      });
    });
  }

  /* --- Stagger grid reveal ------------------------------------ */
  function initStagger() {
    const grids = $$('.grid-2, .grid-3, .grid-4, .se-service-grid, .grid-auto');
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('se-stagger');
          setTimeout(() => e.target.classList.add('in-view'), 50);
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.1 });
    grids.forEach(g => {
      g.classList.add('se-stagger');
      io.observe(g);
    });
  }

  /* --- Typewriter effect -------------------------------------- */
  function initTypewriter() {
    $$('[data-typewrite]').forEach(el => {
      const phrases = el.dataset.typewrite.split('|');
      let pi = 0, ci = 0, deleting = false;
      el.classList.add('se-typewriter');
      function tick() {
        const phrase = phrases[pi];
        el.textContent = deleting ? phrase.slice(0, ci--) : phrase.slice(0, ci++);
        if (!deleting && ci === phrase.length + 1) { deleting = true; setTimeout(tick, 1800); return; }
        if (deleting && ci < 0) { deleting = false; pi = (pi + 1) % phrases.length; setTimeout(tick, 400); return; }
        setTimeout(tick, deleting ? 50 : 90);
      }
      tick();
    });
  }

  /* --- Animated stat counters --------------------------------- */
  function initCounters() {
    $$('.count-up, [data-count]').forEach(el => {
      const io = new IntersectionObserver(entries => {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        const target = parseFloat(el.dataset.count || el.textContent.replace(/[^0-9.]/g,''));
        const suffix = (el.dataset.suffix || el.textContent.replace(/[0-9.]/g,'').trim() || '');
        const prefix = el.dataset.prefix || '';
        const dur = 1800;
        const start = performance.now();
        const isFloat = String(target).includes('.');
        function update(now) {
          const p = Math.min((now - start) / dur, 1);
          const ease = 1 - Math.pow(1 - p, 3); // ease-out cubic
          const val = target * ease;
          el.textContent = prefix + (isFloat ? val.toFixed(1) : Math.floor(val).toLocaleString()) + suffix;
          if (p < 1) requestAnimationFrame(update);
        }
        requestAnimationFrame(update);
      }, { threshold: 0.5 });
      io.observe(el);
    });
  }

  /* --- Glowing blob background -------------------------------- */
  function initBlobs() {
    const hero = $('.se-hero');
    if (!hero) return;
    const positions = [
      { top: '10%', left: '5%' },
      { top: '60%', right: '5%' },
      { top: '30%', left: '50%' },
    ];
    positions.forEach((pos, i) => {
      const blob = document.createElement('div');
      blob.className = `se-blob se-blob-${i+1}`;
      Object.assign(blob.style, pos);
      hero.appendChild(blob);
    });
  }

  /* --- Scanline on code/terminal elements --------------------- */
  function initScanlines() {
    $$('.se-visual-panel, .mono, pre').forEach(el => el.classList.add('se-scanline'));
  }

  /* --- Cursor glow (desktop only) ----------------------------- */
  function initCursorGlow() {
    if (window.innerWidth < 1024 || window.matchMedia('(hover:none)').matches) return;
    const glow = document.createElement('div');
    glow.style.cssText = `
      position:fixed; width:300px; height:300px; border-radius:50%;
      background:radial-gradient(circle, rgba(37,99,235,0.04) 0%, transparent 70%);
      pointer-events:none; z-index:1; transform:translate(-50%,-50%);
      transition:opacity 0.3s; opacity:0;
    `;
    document.body.appendChild(glow);
    document.addEventListener('mousemove', e => {
      glow.style.opacity = '1';
      glow.style.left = e.clientX + 'px';
      glow.style.top  = e.clientY + 'px';
    });
  }

  /* --- Float effect on icons/badges --------------------------- */
  function initFloatElements() {
    $$('[data-float]').forEach((el, i) => {
      el.classList.add(i % 2 === 0 ? 'se-float' : 'se-float-slow');
    });
  }

  /* --- Init all animations ------------------------------------ */
  function initAnimations() {
    try { initParticles(); }   catch(e) {}
    try { initCardTilt(); }    catch(e) {}
    try { initSparkles(); }    catch(e) {}
    try { initRipple(); }      catch(e) {}
    try { initStagger(); }     catch(e) {}
    try { initTypewriter(); }  catch(e) {}
    try { initCounters(); }    catch(e) {}
    try { initBlobs(); }       catch(e) {}
    try { initScanlines(); }   catch(e) {}
    try { initCursorGlow(); }  catch(e) {}
    try { initFloatElements(); } catch(e) {}
  }

    initTabs();
    initCookieBanner();
    initBackToTop();
    initCarousel();
    initLazyLoad();
    initAnnouncement();
    initForms();
    initAnimations();


    /* WordPress-like enhancements */
    initReadingProgress();
    initTOC();
    initShareBar();
    initReadingTime();
    initCopyCode();
    initLightbox();
    initSiteSearch();
  });

  /* ============================================================
     WP-1. READING PROGRESS BAR
  ============================================================ */
  function initReadingProgress() {
    const bar = document.createElement('div');
    bar.id = 'se-progress-bar';
    document.body.prepend(bar);
    const update = () => {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docHeight > 0 ? Math.min((window.scrollY / docHeight) * 100, 100) : 0;
      bar.style.width = pct + '%';
    };
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  /* ============================================================
     WP-2. TABLE OF CONTENTS
  ============================================================ */
  function initTOC() {
    const headings = Array.from(document.querySelectorAll('main h2, main h3, .sec h2, .sec h3, article h2, article h3'))
      .filter(h => !h.closest('.se-nav') && !h.closest('.se-footer') && !h.closest('.se-mobile-nav'));

    if (headings.length < 3) return;

    headings.forEach((h, i) => {
      if (!h.id) {
        h.id = 'toc-' + h.textContent.trim().toLowerCase()
          .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + i;
      }
    });

    const panel = document.createElement('div');
    panel.id = 'se-toc-panel';
    const titleEl = document.createElement('div');
    titleEl.className = 'se-toc-title';
    titleEl.textContent = 'On this page';
    panel.appendChild(titleEl);

    const ul = document.createElement('ul');
    ul.className = 'se-toc-list';
    headings.forEach(h => {
      const li = document.createElement('li');
      li.className = h.tagName === 'H3' ? 'se-toc-h3' : 'se-toc-h2';
      const a = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = h.textContent.trim();
      a.dataset.target = h.id;
      li.appendChild(a);
      ul.appendChild(li);
    });
    panel.appendChild(ul);
    document.body.appendChild(panel);

    const show = () => {
      const pct = window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      panel.classList.toggle('se-toc-visible', pct > 0.05);
    };
    window.addEventListener('scroll', show, { passive: true });
    show();

    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const link = panel.querySelector('[data-target="' + entry.target.id + '"]');
        if (link) link.classList.toggle('se-toc-active', entry.isIntersecting);
      });
    }, { rootMargin: '-10% 0px -80% 0px' });
    headings.forEach(h => io.observe(h));
  }

  /* ============================================================
     WP-3. SOCIAL SHARE BAR
  ============================================================ */
  function initShareBar() {
    const url   = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(document.title);

    const bar = document.createElement('div');
    bar.id = 'se-share-bar';

    const liBtn = document.createElement('a');
    liBtn.className = 'se-share-btn';
    liBtn.href = 'https://www.linkedin.com/shareArticle?mini=true&url=' + url + '&title=' + title;
    liBtn.target = '_blank';
    liBtn.rel = 'noopener';
    liBtn.setAttribute('data-tooltip', 'Share on LinkedIn');
    liBtn.setAttribute('aria-label', 'Share on LinkedIn');
    liBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>';

    const twBtn = document.createElement('a');
    twBtn.className = 'se-share-btn';
    twBtn.href = 'https://twitter.com/intent/tweet?url=' + url + '&text=' + title;
    twBtn.target = '_blank';
    twBtn.rel = 'noopener';
    twBtn.setAttribute('data-tooltip', 'Share on X');
    twBtn.setAttribute('aria-label', 'Share on X');
    twBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'se-share-btn';
    copyBtn.id = 'se-share-copy';
    copyBtn.setAttribute('data-tooltip', 'Copy link');
    copyBtn.setAttribute('aria-label', 'Copy link');
    copyBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';

    const printBtn = document.createElement('button');
    printBtn.className = 'se-share-btn';
    printBtn.setAttribute('data-tooltip', 'Print page');
    printBtn.setAttribute('aria-label', 'Print');
    printBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>';
    printBtn.addEventListener('click', function() { window.print(); });

    bar.appendChild(liBtn);
    bar.appendChild(twBtn);
    bar.appendChild(copyBtn);
    bar.appendChild(printBtn);
    document.body.appendChild(bar);

    copyBtn.addEventListener('click', function() {
      navigator.clipboard.writeText(window.location.href).then(function() {
        window.seToast('Link copied!', 'success');
        copyBtn.setAttribute('data-tooltip', 'Copied!');
        setTimeout(function() { copyBtn.setAttribute('data-tooltip', 'Copy link'); }, 2000);
      }).catch(function() {
        window.seToast('Could not copy', 'error');
      });
    });

    var show = function() {
      bar.classList.toggle('se-share-visible', window.scrollY > 300);
    };
    window.addEventListener('scroll', show, { passive: true });
    show();
  }

  /* ============================================================
     WP-4. READING TIME ESTIMATE
  ============================================================ */
  function initReadingTime() {
    var content = document.querySelector('main') || document.querySelector('.sec');
    if (!content) return;
    var text = content.innerText || '';
    var words = text.trim().split(/\s+/).length;
    var mins  = Math.max(1, Math.round(words / 238));
    var hero  = document.querySelector('.se-page-hero .inner, .se-hero .inner');
    if (!hero) return;
    var badge = document.createElement('div');
    badge.className = 'se-reading-time';
    badge.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ' + mins + ' min read';
    hero.appendChild(badge);
  }

  /* ============================================================
     WP-5. COPY CODE BUTTON
  ============================================================ */
  function initCopyCode() {
    document.querySelectorAll('pre').forEach(function(pre) {
      var wrap = document.createElement('div');
      wrap.className = 'se-code-wrap';
      pre.parentNode.insertBefore(wrap, pre);
      wrap.appendChild(pre);

      var btn = document.createElement('button');
      btn.className = 'se-copy-btn';
      btn.textContent = 'Copy';
      btn.setAttribute('aria-label', 'Copy code');
      wrap.appendChild(btn);

      btn.addEventListener('click', function() {
        var code = pre.querySelector('code') || pre;
        navigator.clipboard.writeText(code.innerText).then(function() {
          btn.textContent = 'Copied!';
          btn.classList.add('copied');
          setTimeout(function() { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
        }).catch(function() {
          btn.textContent = 'Error';
          setTimeout(function() { btn.textContent = 'Copy'; }, 2000);
        });
      });
    });
  }

  /* ============================================================
     WP-6. IMAGE LIGHTBOX
  ============================================================ */
  function initLightbox() {
    var overlay = document.createElement('div');
    overlay.id = 'se-lightbox';

    var img = document.createElement('img');
    img.id = 'se-lb-img';
    img.alt = '';

    var closeBtn = document.createElement('button');
    closeBtn.id = 'se-lightbox-close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '×';

    var caption = document.createElement('div');
    caption.id = 'se-lightbox-caption';

    overlay.appendChild(img);
    overlay.appendChild(closeBtn);
    overlay.appendChild(caption);
    document.body.appendChild(overlay);

    function open(src, alt) {
      img.src = src;
      img.alt = alt || '';
      caption.textContent = alt || '';
      caption.style.display = alt ? 'block' : 'none';
      overlay.classList.add('se-lb-open');
      document.body.style.overflow = 'hidden';
    }
    function close() {
      overlay.classList.remove('se-lb-open');
      document.body.style.overflow = '';
      setTimeout(function() { img.src = ''; }, 300);
    }

    overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
    closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') close(); });

    document.querySelectorAll('img').forEach(function(el) {
      if (el.closest('.se-nav') || el.closest('.se-footer') || el.closest('.se-mobile-nav')) return;
      if (el.closest('a')) return;
      el.style.cursor = 'zoom-in';
      el.addEventListener('click', function() { open(el.src, el.alt); });
    });
  }

  /* ============================================================
     WP-7. SITE SEARCH (Ctrl+K)
  ============================================================ */
  function initSiteSearch() {
    var PAGES = [
      { url:'index.html',         icon:'Home',         title:'Home',                    desc:'AI-powered software engineering and consultancy' },
      { url:'about.html',         icon:'Team',         title:'About Us',                 desc:'Meet the team behind Software Equality' },
      { url:'services.html',      icon:'Services',     title:'Services Overview',         desc:'Full range of AI and software engineering services' },
      { url:'ai-consultancy.html',icon:'AI',           title:'AI Consultancy',            desc:'Enterprise AI strategy, design and deployment' },
      { url:'agentic-ai.html',    icon:'Agents',       title:'Agentic AI',                desc:'Building production-grade autonomous AI agents' },
      { url:'ai-governance.html', icon:'Governance',   title:'AI Governance',             desc:'EU AI Act compliance and risk management' },
      { url:'adlc.html',          icon:'ADLC',         title:'ADLC Methodology',          desc:'7-phase AI Development Lifecycle methodology' },
      { url:'sdlc.html',          icon:'SDLC',         title:'SDLC Integration',          desc:'Integrating AI into your software development lifecycle' },
      { url:'framework.html',     icon:'SPARC',        title:'SPARC Framework',           desc:'Requirements framework for AI system specification' },
      { url:'bootcamp.html',      icon:'Training',     title:'AI Bootcamps',              desc:'Hands-on AI engineering training programmes' },
      { url:'ai-projects.html',   icon:'Cases',        title:'Case Studies',              desc:'Real enterprise AI projects and outcomes' },
      { url:'resources.html',     icon:'Resources',    title:'Resources Hub',             desc:'Guides, articles and tools for AI practitioners' },
      { url:'industries.html',    icon:'Industries',   title:'Industries',                desc:'AI solutions across finance, healthcare, legal and more' },
      { url:'book.html',          icon:'Book',         title:'Book a Call',               desc:'Schedule a free 30-minute consultation' },
      { url:'contact.html',       icon:'Contact',      title:'Contact Us',                desc:'Get in touch with the Software Equality team' },
      { url:'faq.html',           icon:'FAQ',          title:'FAQ',                       desc:'Frequently asked questions about our services' },
      { url:'terms.html',         icon:'Terms',        title:'Terms of Service',          desc:'Legal terms governing use of our services' },
      { url:'privacy.html',       icon:'Privacy',      title:'Privacy Policy',            desc:'How we collect and protect your personal data' },
      { url:'cookies.html',       icon:'Cookies',      title:'Cookie Policy',             desc:'Information about cookies on this website' }
    ];

    var overlay = document.createElement('div');
    overlay.id = 'se-search-overlay';

    var modal = document.createElement('div');
    modal.id = 'se-search-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-label', 'Site search');

    var inputWrap = document.createElement('div');
    inputWrap.id = 'se-search-input-wrap';
    inputWrap.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';

    var searchInput = document.createElement('input');
    searchInput.id = 'se-search-input';
    searchInput.type = 'text';
    searchInput.placeholder = 'Search pages…';
    searchInput.autocomplete = 'off';
    searchInput.setAttribute('spellcheck', 'false');

    var closeBtn = document.createElement('button');
    closeBtn.id = 'se-search-close-btn';
    closeBtn.textContent = 'Esc';

    inputWrap.appendChild(searchInput);
    inputWrap.appendChild(closeBtn);

    var resultsEl = document.createElement('div');
    resultsEl.id = 'se-search-results';

    var footer = document.createElement('div');
    footer.id = 'se-search-footer';
    footer.innerHTML = '<span><kbd class="se-search-kbd">↑↓</kbd> navigate &nbsp; <kbd class="se-search-kbd">↵</kbd> open</span><span>Ctrl+K to search</span>';

    modal.appendChild(inputWrap);
    modal.appendChild(resultsEl);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    var selectedIdx = 0;

    function openSearch() {
      overlay.classList.add('se-search-open');
      searchInput.value = '';
      renderResults('');
      setTimeout(function() { searchInput.focus(); }, 50);
    }
    function closeSearch() {
      overlay.classList.remove('se-search-open');
    }

    overlay.addEventListener('click', function(e) { if (e.target === overlay) closeSearch(); });
    closeBtn.addEventListener('click', closeSearch);

    document.addEventListener('keydown', function(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        overlay.classList.contains('se-search-open') ? closeSearch() : openSearch();
      }
      if (e.key === 'Escape' && overlay.classList.contains('se-search-open')) closeSearch();
    });

    function esc(str) {
      return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    function highlight(text, query) {
      if (!query) return esc(text);
      var safe = esc(text);
      var safeQ = esc(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return safe.replace(new RegExp('(' + safeQ + ')', 'gi'), '<mark>$1</mark>');
    }

    function renderResults(query) {
      var q = query.trim().toLowerCase();
      var filtered = q
        ? PAGES.filter(function(p) {
            return p.title.toLowerCase().indexOf(q) > -1 ||
                   p.desc.toLowerCase().indexOf(q) > -1 ||
                   p.url.indexOf(q) > -1;
          })
        : PAGES.slice(0, 8);

      if (!filtered.length) {
        resultsEl.innerHTML = '<div id="se-search-empty">No pages found for &ldquo;' + esc(query) + '&rdquo;</div>';
        return;
      }

      resultsEl.innerHTML = filtered.map(function(p, i) {
        return '<a class="se-search-item' + (i === selectedIdx ? ' se-search-selected' : '') +
               '" href="' + p.url + '" data-idx="' + i + '">' +
               '<div class="se-search-item-icon" style="font-size:0.7rem;font-weight:700;color:#fff;font-family:var(--font-sans)">' + p.icon.substring(0,4) + '</div>' +
               '<div class="se-search-item-text">' +
               '<div class="se-search-item-title">' + highlight(p.title, query) + '</div>' +
               '<div class="se-search-item-desc">' + highlight(p.desc, query) + '</div>' +
               '</div></a>';
      }).join('');

      resultsEl.querySelectorAll('.se-search-item').forEach(function(item) {
        item.addEventListener('click', closeSearch);
      });
    }

    searchInput.addEventListener('input', function() {
      selectedIdx = 0;
      renderResults(searchInput.value);
    });

    searchInput.addEventListener('keydown', function(e) {
      var items = resultsEl.querySelectorAll('.se-search-item');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIdx = Math.min(selectedIdx + 1, items.length - 1);
        items.forEach(function(el, i) { el.classList.toggle('se-search-selected', i === selectedIdx); });
        if (items[selectedIdx]) items[selectedIdx].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIdx = Math.max(selectedIdx - 1, 0);
        items.forEach(function(el, i) { el.classList.toggle('se-search-selected', i === selectedIdx); });
        if (items[selectedIdx]) items[selectedIdx].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        var sel = items[selectedIdx];
        if (sel) { closeSearch(); window.location.href = sel.getAttribute('href'); }
      }
    });

    /* Add search trigger button to nav */
    var navLinks = document.querySelector('.se-nav-links');
    if (navLinks) {
      var trigger = document.createElement('button');
      trigger.className = 'se-search-trigger';
      trigger.setAttribute('aria-label', 'Search site (Ctrl+K)');
      trigger.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Search <kbd class="se-search-kbd">Ctrl+K</kbd>';
      trigger.addEventListener('click', openSearch);
      navLinks.parentNode.insertBefore(trigger, navLinks.nextSibling);
    }
  }

})();
