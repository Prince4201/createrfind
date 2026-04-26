'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useCallback } from 'react';
import api from '@/lib/api';
import styles from './landing.module.css';

export default function LandingPage() {
  const router = useRouter();
  const canvasRef = useRef(null);
  const orbRef = useRef(null);
  const heroRef = useRef(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [scrollY, setScrollY] = useState(0);
  const [previewMouse, setPreviewMouse] = useState({ x: 0, y: 0 });
  const [hoveringPreview, setHoveringPreview] = useState(false);

  // Ping backend to wake it up from sleep (Render free tier cold start fix)
  useEffect(() => {
    api.pingServer();
  }, []);

  // Scroll tracking
  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Intersection Observer for scroll animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.visible);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -50px 0px' }
    );

    document.querySelectorAll(`.${styles.reveal}`).forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Cursor parallax for orb
  const handleMouseMove = useCallback((e) => {
    const { clientX, clientY } = e;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    setMouse({
      x: (clientX - cx) / cx,
      y: (clientY - cy) / cy,
    });
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [handleMouseMove]);

  // Canvas particle + star effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let cursorPos = { x: -100, y: -100 };
    let particles = [];

    const resize = () => { 
      canvas.width = window.innerWidth; 
      canvas.height = Math.max(window.innerHeight, document.documentElement.scrollHeight); 
    };
    resize();
    window.addEventListener('resize', resize);

    class Particle {
      constructor(x, y) {
        this.x = x + (Math.random() - 0.5) * 60;
        this.y = y + (Math.random() - 0.5) * 60;
        this.size = Math.random() * 3.5 + 1;
        this.speedX = (Math.random() - 0.5) * 2;
        this.speedY = (Math.random() - 0.5) * 2;
        this.life = 1;
        const colors = ['124,106,255', '224,64,251', '56,189,248', '52,211,153'];
        this.color = colors[Math.floor(Math.random() * colors.length)];
      }
      update() { this.x += this.speedX; this.y += this.speedY; this.life -= 0.012; this.size *= 0.995; }
      draw(c) { c.fillStyle = `rgba(${this.color},${this.life})`; c.beginPath(); c.arc(this.x, this.y, this.size, 0, Math.PI * 2); c.fill(); }
    }

    const stars = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 1.8 + 0.3,
      twinkle: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.03 + 0.008,
    }));

    const onMove = (e) => {
      cursorPos = { x: e.clientX, y: e.clientY + window.scrollY };
      for (let i = 0; i < 4; i++) particles.push(new Particle(cursorPos.x, cursorPos.y));
    };
    window.addEventListener('mousemove', onMove);

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      stars.forEach((s) => {
        s.twinkle += s.speed;
        const alpha = 0.2 + Math.sin(s.twinkle) * 0.35;
        ctx.fillStyle = `rgba(180,200,255,${alpha})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Cursor glow — larger, more prominent
      const grd = ctx.createRadialGradient(cursorPos.x, cursorPos.y, 0, cursorPos.x, cursorPos.y, 280);
      grd.addColorStop(0, 'rgba(124,106,255,0.12)');
      grd.addColorStop(0.4, 'rgba(224,64,251,0.04)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(cursorPos.x, cursorPos.y, 280, 0, Math.PI * 2);
      ctx.fill();

      particles.forEach((p, i) => { p.update(); p.draw(ctx); if (p.life <= 0) particles.splice(i, 1); });
      if (particles.length > 200) particles.splice(0, particles.length - 200);

      animId = requestAnimationFrame(animate);
    };
    animate();

    return () => { window.removeEventListener('resize', resize); window.removeEventListener('mousemove', onMove); cancelAnimationFrame(animId); };
  }, []);

  // Orb parallax style
  const orbParallax = {
    transform: `translate(${mouse.x * 30}px, ${mouse.y * 20}px) rotateY(${mouse.x * 12}deg) rotateX(${-mouse.y * 8}deg)`,
  };
  const ring1Style = { transform: `translate(${mouse.x * 15}px, ${mouse.y * 10}px) rotate(${scrollY * 0.05}deg)` };
  const ring2Style = { transform: `translate(${mouse.x * -10}px, ${mouse.y * -8}px) rotate(${-scrollY * 0.08}deg)` };
  const av1Style = { translate: `${mouse.x * -20}px ${mouse.y * -15}px` };
  const av2Style = { translate: `${mouse.x * 25}px ${mouse.y * -20}px` };
  const av3Style = { translate: `${mouse.x * -15}px ${mouse.y * 25}px` };
  const badge1Style = { translate: `${mouse.x * -18}px ${mouse.y * 12}px` };
  const badge2Style = { translate: `${mouse.x * 22}px ${mouse.y * -14}px` };

  const handlePreviewMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    setPreviewMouse({
      x: (x - centerX) / centerX,
      y: (y - centerY) / centerY,
    });
  };

  const handlePreviewMouseEnter = (e) => {
    handlePreviewMouseMove(e);
    setHoveringPreview(true);
  };

  const previewParallax = hoveringPreview
    ? { transform: `rotateX(${-previewMouse.y * 12}deg) rotateY(${previewMouse.x * 12}deg) scale(1.02)` }
    : { transform: `rotateX(4deg) rotateY(-2deg)` };

  return (
    <div className={styles.landing}>
      <canvas ref={canvasRef} className={styles.bgCanvas} />

      {/* ── Navbar ── */}
      <nav className={styles.nav}>
        <div className={styles.navLogo}>
          <div className={styles.navLogoIcon}>▶</div>
          <span className={styles.navLogoText}>CreatorFind</span>
        </div>
        <div className={styles.navLinks}>
          <a href="#features" className={styles.navLink}>Features</a>
          <a href="#how" className={styles.navLink}>How it works</a>
          <a href="#faq" className={styles.navLink}>FAQ</a>
        </div>
        <button className={styles.navLoginBtn} onClick={() => router.push('/login')}>
          Login <span>→</span>
        </button>
      </nav>

      {/* ── Hero ── */}
      <section ref={heroRef} className={styles.hero}>
        <div className={styles.heroText}>
          <div className={`${styles.heroBadge} ${styles.reveal} ${styles.revD1}`}>
            <span className={styles.heroBadgeDot} />
            YouTube creator outreach, automated.
          </div>
          <h1 className={`${styles.heroTitle} ${styles.reveal} ${styles.revD2}`}>
            Discover, contact,<br />and convert<br />
            <span className={styles.heroGradient}>creators.</span>
          </h1>
          <p className={`${styles.heroDesc} ${styles.reveal} ${styles.revD3}`}>
            CreatorFind finds the right YouTubers in your niche, fills your
            channel database, and runs personalised outreach campaigns — all
            in one premium workflow.
          </p>
          <div className={`${styles.heroBtns} ${styles.reveal} ${styles.revD4}`}>
            <button className={styles.heroCtaBtn} onClick={() => router.push('/login')}>
              Launch CreatorFind <span>→</span>
            </button>
            <button className={styles.heroSecBtn} onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>
              See how it works
            </button>
          </div>
        </div>

        {/* 3D Orb with cursor parallax */}
        <div className={styles.orbContainer} ref={orbRef} style={{ perspective: '800px' }}>
          <div className={styles.orbGlow} style={{ transform: `translate(${mouse.x * 10}px, ${mouse.y * 10}px) scale(${1 + Math.abs(mouse.x) * 0.05})` }} />
          <div className={styles.orbRing1} style={ring1Style} />
          <div className={styles.orbRing2} style={ring2Style} />
          <div className={styles.orb} style={orbParallax}>
            <div className={styles.orbSheen} />
            <div className={styles.orbInner}>
              <div className={styles.playIcon}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="#FFFFFF"><polygon points="5,3 19,12 5,21" /></svg>
              </div>
            </div>
          </div>
          <div className={`${styles.floatingAvatar} ${styles.avatar1}`} style={av1Style}>
            <img src="/avatars/creator1.png" alt="Creator" />
          </div>
          <div className={`${styles.floatingAvatar} ${styles.avatar2}`} style={av2Style}>
            <img src="/avatars/creator2.png" alt="Creator" />
          </div>
          <div className={`${styles.floatingAvatar} ${styles.avatar3}`} style={av3Style}>
            <img src="/avatars/creator3.png" alt="Creator" />
          </div>
          <div className={styles.floatBadge1} style={badge1Style}>🎬 12.4k subs</div>
          <div className={styles.floatBadge2} style={badge2Style}>📈 Trending</div>
        </div>
      </section>

      {/* ── Stats Bar ── */}
      <section className={styles.statsBar}>
        {[
          { num: '10k+', label: 'Creators discovered' },
          { num: '50/run', label: 'Channels per search' },
          { num: '1-click', label: 'Sheet sync' },
          { num: '100%', label: 'Automated outreach' },
        ].map((s, i) => (
          <div key={i} className={`${styles.statItem} ${styles.reveal} ${styles[`revD${i + 1}`]}`}>
            <div className={styles.statNumber}>{s.num}</div>
            <div className={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </section>

      {/* ── Features ── */}
      <section id="features" className={styles.features}>
        <h2 className={`${styles.sectionTitle} ${styles.reveal}`}>
          Everything you need to <span className={styles.heroGradient}>run outreach.</span>
        </h2>
        <p className={`${styles.sectionSub} ${styles.reveal} ${styles.revD1}`}>
          One coherent workflow — from discovering creators to sending the first email and tracking every reply.
        </p>
        <div className={styles.featGrid}>
          {[
            { icon: '🔍', title: 'Smart Discovery', desc: 'Search YouTube by niche, subscribers and average views. Each run collects up to 50 verified channels — fully automated.', color: 'rgba(124,106,255,0.15)' },
            { icon: '📋', title: 'Channel Database', desc: 'Browse, filter and tag every creator you\'ve found, with rich metadata.', color: 'rgba(52,211,153,0.15)' },
            { icon: '✉️', title: 'Personalised Outreach', desc: 'Templates with variables like {{channelName}}. Sent from your own SMTP.', color: 'rgba(91,154,255,0.15)' },
            { icon: '🚀', title: 'Campaigns at Scale', desc: 'Group sends, track progress and iterate — all from one clean dashboard.', color: 'rgba(224,64,251,0.15)' },
            { icon: '📊', title: 'One-click Sheet Sync', desc: 'Push every discovered channel to Google Sheets with full details intact.', color: 'rgba(255,184,108,0.15)' },
          ].map((f, i) => (
            <div key={i} className={`${styles.featCard} ${styles.reveal} ${styles[`revD${(i % 4) + 1}`]}`}>
              <div className={styles.featIcon} style={{ background: f.color }}>{f.icon}</div>
              <h3 className={styles.featTitle}>{f.title}</h3>
              <p className={styles.featDesc}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Dashboard Preview ── */}
      <section id="how" className={styles.preview}>
        <h2 className={`${styles.sectionTitle} ${styles.reveal}`} style={{ marginBottom: 40 }}>
          See it in <span className={styles.heroGradient}>action.</span>
        </h2>
        <div className={`${styles.reveal} ${styles.revD2}`}>
          <div 
            className={styles.previewFrame} 
            style={previewParallax}
            onMouseEnter={handlePreviewMouseEnter}
            onMouseLeave={() => setHoveringPreview(false)}
            onMouseMove={handlePreviewMouseMove}
          >
          <div className={styles.previewBar}>
            <div className={styles.previewDot} style={{ background: '#FF5F57' }} />
            <div className={styles.previewDot} style={{ background: '#FFBD2E' }} />
            <div className={styles.previewDot} style={{ background: '#28C840' }} />
            <span className={styles.previewUrl}>creatorfind.app/dashboard</span>
          </div>
          <div className={styles.previewContent}>
            <div className={styles.previewSidebar}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, padding: '0 14px' }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#7C6AFF,#38BDF8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: 'white' }}>▶</div>
                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>CreatorFind</span>
              </div>
              {['Overview', 'Discover', 'Channels', 'Campaigns', 'Email History', 'Sheet Sync', 'Email Settings'].map((item, i) => (
                <div key={i} className={`${styles.previewSideItem} ${i === 0 ? styles.previewSideActive : ''}`}>{item}</div>
              ))}
            </div>
            <div className={styles.previewMain}>
              <h3 className={styles.previewMainTitle}>Dashboard Overview</h3>
              <p className={styles.previewMainSub}>Monitor your creator discovery and outreach performance</p>
              <div className={styles.previewStats}>
                {[
                  { icon: '📁', label: 'TOTAL CHANNELS', num: '14', bg: 'rgba(91,154,255,0.12)' },
                  { icon: '✉️', label: 'EMAILS SENT', num: '4', bg: 'rgba(52,211,153,0.12)' },
                  { icon: '🚀', label: 'CAMPAIGNS', num: '10', bg: 'rgba(224,64,251,0.12)' },
                  { icon: '🔍', label: 'DISCOVERY RUNS', num: '10', bg: 'rgba(255,184,108,0.12)' },
                ].map((s, i) => (
                  <div key={i} className={styles.previewStatCard}>
                    <div className={styles.previewStatIcon} style={{ background: s.bg }}>{s.icon}</div>
                    <div className={styles.previewStatLabel}>{s.label}</div>
                    <div className={styles.previewStatNum}>{s.num}</div>
                  </div>
                ))}
              </div>
              <div className={styles.previewCharts}>
                <div className={styles.previewChartCard}>
                  <div className={styles.previewChartTitle}>Discovery Activity</div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 60 }}>
                    {[30, 30, 30, 30, 55, 75].map((h, i) => (
                      <div key={i} style={{ width: 24, height: `${h}%`, borderRadius: 4, background: i >= 4 ? 'linear-gradient(180deg,#7C6AFF,#38BDF8)' : 'rgba(124,106,255,0.25)' }} />
                    ))}
                  </div>
                </div>
                <div className={styles.previewChartCard}>
                  <div className={styles.previewChartTitle}>Emails Sent Over Time</div>
                  <svg viewBox="0 0 200 60" style={{ width: '100%', height: 60 }}>
                    <polyline fill="none" stroke="#38BDF8" strokeWidth="2" points="0,50 30,48 60,45 90,42 120,38 150,30 180,25 200,20" />
                    {[0, 30, 60, 90, 120, 150, 180, 200].map((x, i) => (
                      <circle key={i} cx={x} cy={[50, 48, 45, 42, 38, 30, 25, 20][i]} r="3" fill="#38BDF8" />
                    ))}
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className={styles.cta}>
        <div className={`${styles.ctaCard} ${styles.reveal}`}>
          <div className={`${styles.ctaShape} ${styles.ctaShape1}`} />
          <div className={`${styles.ctaShape} ${styles.ctaShape2}`} />
          <div className={`${styles.ctaShape} ${styles.ctaShape3}`} />
          <h2 className={styles.ctaTitle}>
            Start finding your next<br />
            <span className={styles.heroGradient}>collaboration</span> today.
          </h2>
          <p className={styles.ctaDesc}>
            Launch CreatorFind and run your first discovery in under a minute.
          </p>
          <button className={styles.ctaBtn} onClick={() => router.push('/login')}>
            Launch CreatorFind <span>→</span>
          </button>
        </div>
      </section>
    </div>
  );
}
