'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import styles from './landing.module.css';

export default function LandingPage() {
  const router = useRouter();
  const canvasRef = useRef(null);

  // Cursor particle effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let mouse = { x: -100, y: -100 };
    let particles = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    class Particle {
      constructor(x, y) {
        this.x = x + (Math.random() - 0.5) * 40;
        this.y = y + (Math.random() - 0.5) * 40;
        this.size = Math.random() * 3 + 1;
        this.speedX = (Math.random() - 0.5) * 1.5;
        this.speedY = (Math.random() - 0.5) * 1.5;
        this.life = 1;
        this.color = ['rgba(124,106,255,', 'rgba(224,64,251,', 'rgba(56,189,248,'][Math.floor(Math.random() * 3)];
      }
      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life -= 0.015;
        this.size *= 0.99;
      }
      draw(ctx) {
        ctx.fillStyle = this.color + this.life + ')';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Background stars
    const stars = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 1.5 + 0.5,
      twinkle: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.02 + 0.005,
    }));

    const handleMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      for (let i = 0; i < 3; i++) {
        particles.push(new Particle(mouse.x, mouse.y));
      }
    };

    window.addEventListener('mousemove', handleMove);

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw stars
      stars.forEach((s) => {
        s.twinkle += s.speed;
        const alpha = 0.3 + Math.sin(s.twinkle) * 0.3;
        ctx.fillStyle = `rgba(180, 200, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw cursor glow
      const gradient = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 200);
      gradient.addColorStop(0, 'rgba(124,106,255,0.08)');
      gradient.addColorStop(0.5, 'rgba(224,64,251,0.03)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(mouse.x - 200, mouse.y - 200, 400, 400);

      // Draw particles
      particles.forEach((p, i) => {
        p.update();
        p.draw(ctx);
        if (p.life <= 0) particles.splice(i, 1);
      });

      if (particles.length > 150) particles.splice(0, particles.length - 150);

      animId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMove);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div className={styles.landing}>
      <canvas ref={canvasRef} className={styles.bgCanvas} />

      {/* ── Navbar ── */}
      <nav className={styles.nav}>
        <div className={styles.navLogo}>
          <div className={styles.navLogoIcon}>▶</div>
          CreatorFind
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
      <section className={styles.hero}>
        <div className={styles.fadeUp}>
          <div className={styles.heroBadge}>
            <span className={styles.heroBadgeDot} />
            YouTube creator outreach, automated.
          </div>
          <h1 className={styles.heroTitle}>
            Discover, contact,<br />and convert<br />
            <span className={styles.heroGradient}>creators.</span>
          </h1>
          <p className={styles.heroDesc}>
            CreatorFind finds the right YouTubers in your niche, fills your
            channel database, and runs personalised outreach campaigns — all
            in one premium workflow.
          </p>
          <div className={styles.heroBtns}>
            <button className={styles.heroCtaBtn} onClick={() => router.push('/login')}>
              Launch CreatorFind <span>→</span>
            </button>
            <button className={styles.heroSecBtn} onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>
              See how it works
            </button>
          </div>
        </div>

        {/* 3D Orb with avatar images */}
        <div className={`${styles.orbContainer} ${styles.fadeUpD2}`}>
          <div className={styles.orbGlow} />
          <div className={styles.orbRing1} />
          <div className={styles.orbRing2} />
          <div className={styles.orb}>
            <div className={styles.orbSheen} />
            <div className={styles.orbInner}>
              <div className={styles.playIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#0D1322">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
              </div>
            </div>
          </div>
          {/* AI Avatar images */}
          <div className={`${styles.floatingAvatar} ${styles.avatar1}`}>
            <img src="/avatars/creator1.png" alt="Creator" />
            <div className={styles.avatarRing} />
          </div>
          <div className={`${styles.floatingAvatar} ${styles.avatar2}`}>
            <img src="/avatars/creator2.png" alt="Creator" />
            <div className={styles.avatarRing} />
          </div>
          <div className={`${styles.floatingAvatar} ${styles.avatar3}`}>
            <img src="/avatars/creator3.png" alt="Creator" />
            <div className={styles.avatarRing} />
          </div>
          {/* Floating sub badges */}
          <div className={styles.floatBadge1}>🎬 12.4k subs</div>
          <div className={styles.floatBadge2}>📈 Trending</div>
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
          <div key={i} className={`${styles.statItem} ${styles[`fadeUpD${i + 1}`]}`}>
            <div className={styles.statNumber}>{s.num}</div>
            <div className={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </section>

      {/* ── Features ── */}
      <section id="features" className={styles.features}>
        <h2 className={styles.sectionTitle}>
          Everything you need to <span className={styles.heroGradient}>run outreach.</span>
        </h2>
        <p className={styles.sectionSub}>
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
            <div key={i} className={styles.featCard}>
              <div className={styles.featIcon} style={{ background: f.color }}>{f.icon}</div>
              <h3 className={styles.featTitle}>{f.title}</h3>
              <p className={styles.featDesc}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Dashboard Preview ── */}
      <section id="how" className={styles.preview}>
        <div className={styles.previewFrame}>
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
      </section>

      {/* ── CTA ── */}
      <section className={styles.cta}>
        <div className={styles.ctaCard}>
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
