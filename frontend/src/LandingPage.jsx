import React from 'react';

/**
 * DISAPPEAR LANDING ENGINE v2.6.8
 * ARCHITECTURE: Bento-Grid Intelligence Hub
 * THEME: Tiger Blue / High-Contrast Security
 */

function LandingPage({ onEnterVault, onLoginRequest }) {
  return (
    <div className="landing-wrapper fade-in">
      {/* --- GLOBAL NAVIGATION --- */}
      <nav className="landing-navbar">
        <div className="logo-group">
          <span className="tiger-text" style={{ fontWeight: '900', letterSpacing: '2px' }}>DISAPPEAR</span>
          <span className="version-tag">v2.6 // PAAS</span>
        </div>
        <div className="nav-actions">
          <button className="login-btn-nav" onClick={onLoginRequest}>ACCESS VAULT</button>
        </div>
      </nav>

      {/* --- SECTION 01: THE DOCTRINE (Hero) --- */}
      <section className="bento-container" style={{ marginTop: '120px' }}>
        <div className="bento-item bento-hero">
          <div className="status-indicator">
            <span className="pulse-dot"></span>
            <span className="mono-label">SYSTEM_STATUS: DEFENSIVE_POSTURE_ACTIVE</span>
          </div>
          <h1 className="elite-header">STAY<br />VIGILANT.</h1>
          <p className="hero-description">
            Your identity is a target. In 2026, data brokers weaponize your PII for profit. 
            <strong> Disappear</strong> is the tactical counter-measure: A Privacy-as-a-Service engine 
            built to scorch your digital trail and replace exposure with synthetic security.
          </p>
          <div className="hero-cta-group">
            <button className="main-button" onClick={onEnterVault}>INITIATE IDENTITY SCRUB</button>
            <p className="cta-subtext">Secure Uplink via Stripe // 256-bit AES Encryption</p>
          </div>
        </div>

        <div className="bento-item bento-sidebar">
          <h3 className="card-title">INTELLIGENCE BRIEF</h3>
          <div className="intel-stat">
            <span className="stat-value">4.7B</span>
            <span className="stat-label">PROFILES INDEXED BY BROKERS</span>
          </div>
          <div className="intel-stat">
            <span className="stat-value">82%</span>
            <span className="stat-label">OF USERS HAVE EXPOSED PII</span>
          </div>
          <p className="intel-warning">
            » TRACE DETECTED: Your digital footprint is permanent until scrubbed.
          </p>
        </div>
      </section>

      {/* --- SECTION 02: SYSTEM DIRECTIVES (Manual) --- */}
      <section className="directive-section">
        <div className="section-header">
          <span className="mono-label">OPERATION MANUAL // DIRECTIVES</span>
          <h2 className="section-title">SYSTEM PROTOCOLS</h2>
        </div>

        <div className="bento-grid-directives">
          <div className="bento-card-small">
            <div className="step-num">01</div>
            <h4 className="directive-title">BIND PRIMARY NODE</h4>
            <p className="directive-text">
              Target your existing PII. Our Scrubber Node initiates legal removal requests 
              across 150+ major data aggregators simultaneously.
            </p>
          </div>

          <div className="bento-card-small">
            <div className="step-num">02</div>
            <h4 className="directive-title">DEPLOY ALIAS ASSETS</h4>
            <p className="directive-text">
              Provision encrypted phone and email nodes. Route all 2FA and registrations 
              through secure proxies. Never reveal your real data again.
            </p>
          </div>

          <div className="bento-card-small">
            <div className="step-num">03</div>
            <h4 className="directive-title">VIRTUAL FINANCIAL SHIELD</h4>
            <p className="directive-text">
              Generate merchant-locked digits. If a vendor is breached, your real 
              banking identity remains invisible and untouched.
            </p>
          </div>

          <div className="bento-card-small alert-card">
            <div className="step-num">04</div>
            <h4 className="directive-title">EMERGENCY BURN</h4>
            <p className="directive-text">
              One-click total purge. Instantly terminate all aliases, cards, and 
              profile data. Leave zero traces behind.
            </p>
          </div>
        </div>
      </section>

      {/* --- SECTION 03: THE MISSION (Vigilance) --- */}
      <section className="manifesto-teaser">
        <div className="manifesto-box">
          <h3 className="card-title" style={{ color: 'var(--tiger-blue)' }}>THE DOCTRINE OF SCARCITY</h3>
          <p className="manifesto-text">
            Privacy isn't about hiding secrets; it's about maintaining sovereignty. 
            In the age of automated surveillance, <strong>Scarcity is Security.</strong> 
            If the data doesn't exist, it cannot be weaponized. 
            We don't just protect data—we eliminate the need for it.
          </p>
          <button className="info-link-btn" onClick={onEnterVault}>JOIN THE PURGE</button>
        </div>
      </section>

      {/* --- LOGIN GATEWAY --- */}
      <section className="login-gateway">
        <p className="login-prompt">EXISTING OPERATIVE?</p>
        <button className="login-btn-nav" onClick={onLoginRequest}>DECRYPT VAULT ACCESS</button>
      </section>
    </div>
  );
}

export default LandingPage;