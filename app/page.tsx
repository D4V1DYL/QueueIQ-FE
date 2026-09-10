'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  ShoppingCart,
  Clock3,
  Layers,
  Activity,
  MoveRight,
  ShieldCheck,
  Camera,
  ScanLine,
  ChevronDown,
  Users,
} from 'lucide-react';
const stages = [
  'See the basket',
  'Estimate the workload',
  'Find the fastest lane',
  'Guide the shopper',
];
export default function Landing() {
  const [stage, setStage] = useState(0);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    if (
      !playing ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;
    const id = setInterval(() => setStage((s) => (s + 1) % 4), 2600);
    return () => clearInterval(id);
  }, [playing]);
  useEffect(() => {
    const obs = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('revealed');
            obs.unobserve(e.target);
          }
        }),
      { threshold: 0.1 },
    );
    document.querySelectorAll('.reveal').forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);
  return (
    <div className="landing">
      <nav className="landing-nav">
        <Link href="/" className="brand">
          <img src="/queueiq-logo.jpg" alt="QueueIQ logo" />
          <strong>
            Queue<span>IQ</span>
          </strong>
        </Link>
        <div className="nav-links">
          <a href="#how-it-works">How it works</a>
          <a href="#intelligence">The intelligence</a>
          <a href="#demo">Live demo</a>
        </div>
        <Link className="nav-cta" href="/dashboard">
          Launch demo <ArrowUpRight size={16} />
        </Link>
      </nav>
      <section className="hero">
        <div className="hero-copy">
          <div className="hero-label">
            <i /> AI-POWERED CHECKOUT INTELLIGENCE
          </div>
          <h1>
            The shortest line
            <br />
            isn’t always
            <br />
            <em>the fastest.</em>
          </h1>
          <p>
            Count what’s in the basket. Not just who’s in line.
            <br className="desktop-break" /> QueueIQ turns overhead vision into
            basket-aware wait estimates—and a clear signal for where to go.
          </p>
          <div className="hero-actions">
            <Link href="/dashboard" className="primary cta">
              Experience the demo <ArrowUpRight size={19} />
            </Link>
            <a href="#how-it-works" className="secondary-cta">
              See how it works <ArrowRight size={17} />
            </a>
          </div>
          <div className="hero-proof">
            <span>
              <Check size={14} /> Interactive checkout simulation
            </span>
            <span>
              <Check size={14} /> Live AI mode: YOLOv8 + online learning
            </span>
          </div>
        </div>
        <div className="hero-system">
          <div className="system-bar">
            <span>
              <i /> CHECKOUT VISION ENGINE
            </span>
            <span>SIMULATED LIVE VIEW</span>
          </div>
          <div className="orbital checkout-orbital">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="orbit orbit-three" />
            <div className="signal">
              <ScanLine size={40} strokeWidth={1.5} />
              <span>
                Basket<span>IQ</span>
              </span>
            </div>
            <div className="floating-request req-one">
              <span className="req-icon">
                <Camera size={18} />
              </span>
              <div>
                <small>OVERHEAD VISION / BASKET 103</small>
                <strong>3 packaged · 1 produce</strong>
              </div>
              <span className="lime-dot" />
            </div>
            <div className="floating-request req-two">
              <span className="req-icon teal">
                <ShoppingCart size={18} />
              </span>
              <div>
                <small>RECOMMENDATION</small>
                <strong>Lane 02 · 1:42 estimated wait</strong>
              </div>
              <Check size={16} />
            </div>
            <div className="system-tag">
              BASKET CONTENTS <MoveRight size={14} /> BETTER DECISIONS
            </div>
          </div>
          <div className="hero-lanes">
            <div>
              <i className="red" />
              <span>LANE 01</span>
              <strong>4:46</strong>
              <small>2 shoppers</small>
            </div>
            <div className="recommended">
              <i className="green" />
              <span>LANE 02</span>
              <strong>1:42</strong>
              <small>3 shoppers · fastest</small>
            </div>
            <div>
              <i className="amber" />
              <span>LANE 03</span>
              <strong>3:29</strong>
              <small>2 shoppers</small>
            </div>
          </div>
          <div className="engine-progress">
            <div className="engine-label">
              <span key={stage} className="stage-name">
                <i /> {stages[stage]}
              </span>
              <button
                onClick={() => setPlaying(!playing)}
                aria-label={playing ? 'Pause animation' : 'Play animation'}
              >
                {playing ? 'Pause' : 'Play'}
              </button>
            </div>
            <div className="stage-buttons">
              {stages.map((s, i) => (
                <button
                  key={s}
                  className={i <= stage ? 'done' : ''}
                  onClick={() => {
                    setStage(i);
                    setPlaying(false);
                  }}
                  aria-label={`Show step ${i + 1}: ${s}`}
                  aria-pressed={i === stage}
                >
                  <span>
                    {i < stage ? (
                      <Check size={13} />
                    ) : (
                      String(i + 1).padStart(2, '0')
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <a className="scroll-cue" href="#how-it-works">
          A BETTER CHECKOUT STARTS HERE <ChevronDown size={14} />
        </a>
      </section>
      <section className="principles">
        <div>
          <span>01 /</span> See beyond the headcount
        </div>
        <div>
          <span>02 /</span> Predict the actual workload
        </div>
        <div>
          <span>03 /</span> Make the next move obvious
        </div>
      </section>
      <section id="how-it-works" className="section reveal">
        <div className="section-intro">
          <div>
            <div className="eyebrow">01 — FROM VISION TO DIRECTION</div>
            <h2>
              Every basket tells a story.
              <br />
              <span>We turn it into a shorter wait.</span>
            </h2>
          </div>
          <p>
            One overhead view. A clearer checkout.
            <br />
            Designed to connect computer vision to real-time guidance.
          </p>
        </div>
        <div className="steps">
          {[
            {
              Icon: Camera,
              title: 'See what’s inside',
              text: 'An overhead camera provides the view. Computer vision is designed to estimate item quantities and basket composition.',
            },
            {
              Icon: Layers,
              title: 'Predict the workload',
              text: 'Combine the basket’s item mix, shoppers ahead, and cashier speed to estimate time until checkout.',
            },
            {
              Icon: Activity,
              title: 'Guide with a signal',
              text: 'Green, amber, or red lights communicate congestion. The dashboard shows the fastest lane and the reason behind it.',
            },
          ].map(({ Icon, title, text }, i) => (
            <article key={title}>
              <div className="step-top">
                <Icon size={24} />
                <span>0{i + 1}</span>
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section id="intelligence" className="section features reveal">
        <div className="section-intro">
          <div>
            <div className="eyebrow">
              02 — BASKET-AWARE, NOT HEADCOUNT-BLIND
            </div>
            <h2>
              Two people. Fifty items.
              <br />
              <span>Still think it’s the faster line?</span>
            </h2>
          </div>
        </div>
        <div className="feature-grid">
          <article className="feature-main">
            <div className="feature-copy">
              <span className="feature-label">
                <ScanLine size={17} /> THE WORKLOAD TELLS THE REAL STORY
              </span>
              <h3>
                More people can mean
                <br />
                less waiting.
              </h3>
              <p>
                In our demo, Lane 02 has more shoppers but smaller baskets.
                QueueIQ recommends it because the predicted checkout workload is
                lower.
              </p>
            </div>
            <div className="mini-table">
              <div className="mini-tabs">
                <span>Basket-aware prediction</span>
                <span>Example simulation</span>
              </div>
              {[
                ['Lane 01', '2 shoppers · 44 items', '4:46', 'red'],
                ['Lane 02', '3 shoppers · 11 items', '1:42', 'green'],
                ['Lane 03', '2 shoppers · 28 items', '3:29', 'amber'],
              ].map((r) => (
                <div className="mini-row" key={r[0]}>
                  <div>
                    <small>{r[1]}</small>
                    <strong>
                      {r[0]}
                      {r[3] === 'green' ? ' · Recommended' : ''}
                    </strong>
                  </div>
                  <span className={'light-badge ' + r[3]}>
                    <i className={r[3]} />
                    {r[2]}
                  </span>
                </div>
              ))}
            </div>
          </article>
          <article className="feature-small">
            <Clock3 size={25} />
            <h3>
              A signal anyone
              <br />
              can understand.
            </h3>
            <p>
              No app needed for shoppers. A traffic-light indicator gives an
              immediate read on each lane’s estimated wait.
            </p>
            <div className="signal-demo">
              <div>
                <i className="green" />
                <span>Fast</span>
                <small>Up to 2 min</small>
              </div>
              <div>
                <i className="amber" />
                <span>Moderate</span>
                <small>2–4 min</small>
              </div>
              <div>
                <i className="red" />
                <span>Busy</span>
                <small>Over 4 min</small>
              </div>
            </div>
          </article>
          <article className="feature-strip">
            <ShieldCheck size={30} />
            <div>
              <h3>The basket is the signal.</h3>
              <p>
                The demo uses simulated item counts. No camera access, facial
                recognition, or shopper identity is needed to explore it.
              </p>
            </div>
            <Link href="/dashboard" aria-label="Explore the checkout dashboard">
              <ArrowUpRight size={25} />
            </Link>
          </article>
        </div>
      </section>
      <section id="demo" className="section demo-section reveal">
        <div className="eyebrow">
          <i /> DON’T JUST WATCH THE QUEUE. CHANGE IT.
        </div>
        <h2>
          Make the line longer.
          <br />
          <span>Watch the recommendation change.</span>
        </h2>
        <p>
          Add a shopper. Change their basket. Advance checkout.
          <br />
          See wait estimates and lane signals respond in real time.
        </p>
        <div className="hero-actions demo-actions">
          <Link href="/dashboard" className="primary cta">
            Enter the simulation <ArrowUpRight size={20} />
          </Link>
          <Link href="/live" className="secondary-cta">
            Open the live AI control room <ArrowRight size={17} />
          </Link>
        </div>
        <small>
          Simulation runs in the browser alone. Live mode connects to the
          QueueIQ vision server on your local network: drop in your own photo of
          a checkout line with carts or baskets and watch YOLOv8 count the
          shoppers, rate every basket, and predict the wait.
        </small>
        <div className="big-word" aria-hidden="true">
          QueueIQ
        </div>
      </section>
      <footer className="landing-footer">
        <Link href="/" className="brand">
          <strong>
            Queue<span>IQ</span>
          </strong>
        </Link>
        <span>SMARTER BASKETS. BETTER QUEUES.</span>
        <a href="#how-it-works">
          Back to how it works <ArrowUpRight size={14} />
        </a>
      </footer>
    </div>
  );
}
