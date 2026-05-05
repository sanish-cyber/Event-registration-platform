/**
 * 3D-Effects.js — EventHub Visual Engine (v3 — drinksom.eu inspired)
 * ✓ Particle BG  ✓ Film grain  ✓ Text reveals  ✓ Scroll reveals
 * ✓ Floating hero  ✓ Glow pulse  ✓ VanillaTilt (cards only)
 * ✗ Custom cursor removed — default Windows pointer restored
 */

// ─── Helper: Dynamic Script Loader ────────────────────────────────────────────
function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
        const s = document.createElement('script');
        s.src = src; s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
    });
}

// ─── 1. Canvas Particle System ─────────────────────────────────────────────────
function initParticleCanvas() {
    const canvas = document.getElementById('particleCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let W = canvas.width  = window.innerWidth;
    let H = canvas.height = window.innerHeight;
    window.addEventListener('resize', () => {
        W = canvas.width  = window.innerWidth;
        H = canvas.height = window.innerHeight;
    });

    const particles = Array.from({ length: 70 }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 2 + 0.5,
        dx: (Math.random() - 0.5) * 0.4,
        dy: (Math.random() - 0.5) * 0.4,
        alpha: Math.random() * 0.5 + 0.15
    }));

    function animate() {
        ctx.clearRect(0, 0, W, H);
        particles.forEach(p => {
            p.x += p.dx; p.y += p.dy;
            p.dx *= 0.99; p.dy *= 0.99;
            if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
            if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;

            const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3);
            grad.addColorStop(0, `rgba(129,140,248,${p.alpha})`);
            grad.addColorStop(1, `rgba(99,102,241,0)`);
            ctx.beginPath();
            ctx.fillStyle = grad;
            ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
            ctx.fill();
        });

        // Connections
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const d  = Math.sqrt(dx*dx + dy*dy);
                if (d < 110) {
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(99,102,241,${0.1 * (1 - d/110)})`;
                    ctx.lineWidth = 0.7;
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();
                }
            }
        }
        requestAnimationFrame(animate);
    }
    animate();
}

// ─── 2. Film Grain Overlay ─────────────────────────────────────────────────────
function initFilmGrain() {
    if (document.querySelector('.grain-overlay')) return;
    const grain = document.createElement('div');
    grain.className = 'grain-overlay';
    document.body.appendChild(grain);
}

// ─── 3. Floating Orbs ─────────────────────────────────────────────────────────
function initFloatingOrbs() {
    if (document.querySelector('.orbs-container')) return;
    const orbs = document.createElement('div');
    orbs.className = 'orbs-container';
    orbs.innerHTML = `
        <div class="orb orb-1 glow-pulse"></div>
        <div class="orb orb-2 glow-pulse" style="animation-delay:2s;"></div>
        <div class="orb orb-3 glow-pulse" style="animation-delay:1s;"></div>
        <div class="orb orb-4 glow-pulse" style="animation-delay:3s;"></div>
    `;
    document.body.prepend(orbs);
}

// ─── 4. Hero Parallax ─────────────────────────────────────────────────────────
function initHeroParallax() {
    const hero = document.querySelector('.hero, .hero-section');
    if (!hero) return;
    document.addEventListener('mousemove', e => {
        const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
        const dx = (e.clientX - cx) / cx, dy = (e.clientY - cy) / cy;
        hero.style.backgroundPosition = `${50 + dx * 3}% ${50 + dy * 3}%`;
        const content = hero.querySelector('.hero-content, .hero h1');
        if (content) {
            content.style.transform = `perspective(1200px) rotateX(${-dy * 2}deg) rotateY(${dx * 2}deg)`;
            content.style.transition = 'transform 0.2s ease';
        }
    });
}

// ─── 5. Text Reveal (drinksom clip-mask style) ────────────────────────────────
function initTextReveals() {
    // Wrap hero headings in reveal markup automatically
    document.querySelectorAll('.hero h1, .hero h2, .hero-title, .page-header h1').forEach((el, idx) => {
        if (el.dataset.revealed) return;
        el.dataset.revealed = '1';
        const words = el.innerHTML.split(' ');
        el.innerHTML = words.map((w, i) =>
            `<span class="text-reveal-wrap"><span class="text-reveal delay-${Math.min((i+1)*100, 600)}">${w}</span></span>`
        ).join(' ');
        // Trigger after short delay so CSS is ready
        setTimeout(() => {
            el.querySelectorAll('.text-reveal').forEach(span => span.classList.add('revealed'));
        }, 100 + idx * 80);
    });
}

// ─── 6. Scroll Reveal (IntersectionObserver) ──────────────────────────────────
function initScrollReveals() {
    // Auto-tag existing content elements for scroll reveal
    const autoReveal = [
        { sel: '.stat-card',        cls: 'reveal-up'    },
        { sel: '.event-card',       cls: 'reveal-scale' },
        { sel: '.card:not(.event-card)', cls: 'reveal-up' },
        { sel: '.feature-card',     cls: 'reveal-fade'  },
        { sel: '.section-title, .card-header h3', cls: 'reveal-up' },
    ];

    autoReveal.forEach(({ sel, cls }) => {
        document.querySelectorAll(sel).forEach((el, i) => {
            if (el.dataset.revealInit) return;
            el.dataset.revealInit = '1';
            el.classList.add(cls);
            // Stagger by index (cap at 5)
            const delay = Math.min(i, 5) * 80;
            el.style.transitionDelay = `${delay}ms`;
        });
    });

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12 });

    document.querySelectorAll('.reveal-up, .reveal-left, .reveal-right, .reveal-scale, .reveal-fade')
        .forEach(el => observer.observe(el));

    // Re-observe dynamically added elements
    new MutationObserver(() => {
        document.querySelectorAll('.reveal-up:not([data-obs]), .reveal-scale:not([data-obs]), .reveal-fade:not([data-obs])')
            .forEach(el => { el.dataset.obs = '1'; observer.observe(el); });
    }).observe(document.body, { childList: true, subtree: true });
}

// ─── 7. Floating Hero Element ─────────────────────────────────────────────────
function initFloatingHero() {
    // Add float animation to hero image / icon if present
    document.querySelectorAll('.hero-image, .hero-icon, .hero img, .hero-visual').forEach(el => {
        el.classList.add('float-anim');
    });
}

// ─── 8. VanillaTilt on Cards ──────────────────────────────────────────────────
function initTilt() {
    if (!window.VanillaTilt) return;
    const els = document.querySelectorAll(
        '.stat-card:not([data-tilt="false"]), .event-card:not([data-tilt="false"]), .auth-card:not([data-tilt="false"])'
    );
    if (!els.length) return;
    VanillaTilt.init(els, {
        max: 6,
        speed: 400,
        glare: false,
        scale: 1.02,
        perspective: 1200
    });
}

// ─── 9. Page Load Fade-In ─────────────────────────────────────────────────────
function initPageTransition() {
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.55s ease';
    const reveal = () => { document.body.style.opacity = '1'; };
    window.addEventListener('load', reveal);
    setTimeout(reveal, 120);
}

// ─── BOOT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    initPageTransition();
    initFilmGrain();
    initFloatingOrbs();
    initParticleCanvas();
    initHeroParallax();
    initFloatingHero();

    // Text reveals after a brief paint
    setTimeout(initTextReveals, 60);

    // Scroll reveals after DOM settled
    setTimeout(initScrollReveals, 150);

    // VanillaTilt (for event cards)
    try {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/vanilla-tilt/1.8.1/vanilla-tilt.min.js');
        initTilt();
        new MutationObserver(() => initTilt()).observe(document.body, { childList: true, subtree: true });
    } catch (e) { console.warn('VanillaTilt load failed', e); }
});
