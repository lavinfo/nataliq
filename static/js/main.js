(() => {
  'use strict';

  const root = document.documentElement;
  root.classList.add('js');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- Analytics ----------
     Events go to window.dataLayer (GTM / GA4) and to a DOM event
     "nataliq:track" so any counter (Yandex.Metrika, Plausible, etc.)
     can subscribe without touching this file. */
  const track = (name, params = {}) => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: name, ...params });
    document.dispatchEvent(new CustomEvent('nataliq:track', { detail: { name, ...params } }));
  };

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[data-cta]');
    if (!link) return;
    const block = link.dataset.cta;
    track('telegram_click', { block, href: link.href });
    if (link.dataset.format) {
      track('format_click', { format: link.dataset.format, block });
    }
  });

  document.querySelectorAll('.faq__item').forEach((item) => {
    item.addEventListener('toggle', () => {
      if (item.open) {
        track('faq_open', { question: item.querySelector('summary').textContent.trim() });
      }
    });
  });

  /* ---------- Footer year ---------- */
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  /* ---------- Header state ---------- */
  const header = document.querySelector('.site-header');
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 12);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- Reveal on scroll ---------- */
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion.matches) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          revealObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
    );
    revealEls.forEach((el) => revealObserver.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-in'));
  }

  /* ---------- Sticky mobile CTA + final block tracking ---------- */
  const sticky = document.getElementById('sticky-cta');
  const hero = document.getElementById('hero');
  const final = document.getElementById('final');
  const footer = document.querySelector('.footer');

  const state = { heroVisible: true, endVisible: false };
  const syncSticky = () => {
    const show = !state.heroVisible && !state.endVisible;
    sticky.classList.toggle('is-visible', show);
    sticky.setAttribute('aria-hidden', String(!show));
    sticky.tabIndex = show ? 0 : -1;
  };

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      state.heroVisible = entry.isIntersecting;
      syncSticky();
    }, { threshold: 0, rootMargin: '-80px 0px 0px 0px' }).observe(hero);

    const visibleEnds = new Set();
    const endObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) visibleEnds.add(entry.target);
        else visibleEnds.delete(entry.target);
      });
      state.endVisible = visibleEnds.size > 0;
      syncSticky();
    }, { threshold: 0.2 });
    endObserver.observe(final);
    endObserver.observe(footer);

    const finalSeen = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      track('final_block_reached');
      finalSeen.disconnect();
    }, { threshold: 0.5 });
    finalSeen.observe(final);
  }

  /* ---------- Constellation canvas ---------- */
  const canvas = document.getElementById('stars');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let nodes = [];
  let rafId = 0;
  let running = false;

  const GOLD = '214, 185, 122';
  const CYAN = '111, 227, 225';

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.round(Math.min(70, Math.max(26, (width * height) / 22000)));
    nodes = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
      r: Math.random() * 1.4 + 0.5,
      tone: Math.random() < 0.28 ? CYAN : GOLD,
      phase: Math.random() * Math.PI * 2
    }));
  };

  const draw = (time = 0) => {
    ctx.clearRect(0, 0, width, height);
    const linkDist = width < 700 ? 90 : 130;

    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.hypot(dx, dy);
        if (dist < linkDist) {
          const alpha = (1 - dist / linkDist) * 0.22;
          ctx.strokeStyle = `rgba(${a.tone}, ${alpha})`;
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    for (const n of nodes) {
      const twinkle = 0.55 + 0.45 * Math.sin(time / 900 + n.phase);
      ctx.fillStyle = `rgba(${n.tone}, ${0.85 * twinkle})`;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const step = (time) => {
    for (const n of nodes) {
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < -10) n.x = width + 10;
      else if (n.x > width + 10) n.x = -10;
      if (n.y < -10) n.y = height + 10;
      else if (n.y > height + 10) n.y = -10;
    }
    draw(time);
    rafId = requestAnimationFrame(step);
  };

  const start = () => {
    if (running || reduceMotion.matches) return;
    running = true;
    rafId = requestAnimationFrame(step);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(rafId);
  };

  resize();
  draw();

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resize();
      draw();
    }, 150);
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) start();
      else stop();
    }).observe(canvas);
  } else {
    start();
  }

  reduceMotion.addEventListener('change', () => {
    if (reduceMotion.matches) {
      stop();
      draw();
    } else {
      start();
    }
  });
})();
