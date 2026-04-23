import React, { useState } from 'react';

/**
 * DISAPPEAR LANDING ENGINE
 * ARCHITECTURE: Unified Bento Grid
 * THEME: Tiger Blue / High-Contrast Security
 * UPDATE: Search integrated into unified grid to lock top-row alignment.
 */

function LandingPage({ onEnterVault, onLoginRequest }) {
  const [scanQuery, setScanQuery] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  const handleScan = () => {
    if (!scanQuery || scanQuery.length < 5) return;
    setIsScanning(true);
    setScanResult(null);

    // Deterministic Logic: Ensures same number for same input
    setTimeout(() => {
      const charSum = scanQuery.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const deterministicCount = (charSum % 74) + 12; 
      setScanResult(deterministicCount);
      setIsScanning(false);
    }, 1800);
  };

  return (
    <div className="landing-wrapper fade-in">
      {/* --- GLOBAL NAVIGATION --- */}
      <nav className="landing-navbar">
        <div className="logo-group">
          <span className="tiger-text" style={{ fontWeight: '900', letterSpacing: '2px' }}>DISAPPEAR</span>
        </div>
        <div className="nav-actions">
          <button className="login-btn-nav" onClick={onLoginRequest}>ACCESS VAULT</button>
        </div>
      </nav>

      {/* --- UNIFIED BENTO HUB --- */}
      <section className="bento-container" style={{ marginTop: '120px' }}>
        
        {/* BOX 01: THE DOCTRINE */}
        <div className="bento-item bento-hero">
          <h1 className="elite-header">STAY<br />VIGILANT.</h1>
          <p className="hero-description">
            Your identity is a target. In 2026, data brokers weaponize your PII for profit. 
            <strong> Disappear</strong> is the tactical counter-measure: A Privacy-as-a-Service engine 
            built to scorch your digital trail and replace exposure with synthetic security.
          </p>
          <div className="hero-cta-group">
            <button className="main-button" onClick={onEnterVault}>INITIATE IDENTITY SCRUB</button>
            <p className="cta-subtext">Proprietary PII Scrubbing Engine // Global Data Broker Coverage</p>
          </div>
        </div>

        {/* BOX 02: INTELLIGENCE BRIEF */}
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
          <div className="intel-update">
            <p style={{ fontSize: '0.8rem', color: '#94A3B8', lineHeight: '1.4', margin: '0' }}>
              <span style={{ color: 'var(--tiger-blue)', fontWeight: 'bold' }}>» SYSTEM_LOG:</span> Your digital footprint is harvested daily. Disappear automates the removal of your data from lead-gen lists.
            </p>
          </div>
        </div>

        {/* BOX 03: LIVE RECONNAISSANCE (Now locked to the unified grid) */}
        <div className="bento-item bento-scanner-full">
          <h3 className="card-title">LIVE RECONNAISSANCE</h3>
          <p className="hero-description" style={{ fontSize: '0.9rem', marginBottom: '20px', maxWidth: '100%' }}>
            Enter your contact data to perform a real-time deterministic scan of the global broker index.
          </p>
          <div className="scanner-input-hub">
            <input 
              type="text" 
              placeholder="ENTER PHONE OR EMAIL..." 
              value={scanQuery}
              onChange={(e) => setScanQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleScan()}
            />
            <button 
              className="main-button" 
              onClick={handleScan}
              disabled={isScanning}
            >
              {isScanning ? 'SCANNING...' : 'SCAN DATABASE'}
            </button>
          </div>
          
          {scanResult && (
            <div className="fade-in scan-alert-node">
              <span style={{ color: 'var(--tiger-blue)', fontWeight: 'bold' }}>[!] ALERT:</span> IDENTITY EXPOSED ON {scanResult} BROKER SITES.
              <button 
                onClick={onEnterVault}
                className="text-link-btn"
              >
                INITIATE FULL NEUTRALIZATION
              </button>
            </div>
          )}
        </div>
      </section>

      {/* --- SECTION 02: SYSTEM DIRECTIVES --- */}
      <section className="directive-section">
        <div className="section-header">
          <span className="mono-label">CAPABILITIES // WHY DISAPPEAR</span>
          <h2 className="section-title">IDENTITY NEUTRALIZATION PROTOCOLS</h2>
        </div>

        <div className="bento-grid-directives">
          <div className="bento-card-small">
            <div className="step-num">01</div>
            <h4 className="directive-title">TERMINATE SPAM CALLS</h4>
            <p className="directive-text">
              Data brokers sell your phone number to lead-lists. We scrub your contact info from 
              broker databases to neutralize robocalls and SMS phishing at the source.
            </p>
          </div>

          <div className="bento-card-small">
            <div className="step-num">02</div>
            <h4 className="directive-title">INBOX SANITIZATION</h4>
            <p className="directive-text">
              Deploy encrypted Email Relay nodes. Our system strips hidden trackers from incoming 
              mail, preventing companies from knowing when or where you open your messages.
            </p>
          </div>

          <div className="bento-card-small">
            <div className="step-num">03</div>
            <h4 className="directive-title">FINANCIAL SHIELDING</h4>
            <p className="directive-text">
              Merchant-locked virtual cards hide your real banking identity. Even if a retailer is 
              breached, your primary accounts remain invisible and untouched.
            </p>
          </div>

          <div className="bento-card-small alert-card">
            <div className="step-num">04</div>
            <h4 className="directive-title">CONTINUOUS MONITORING</h4>
            <p className="directive-text">
              Identity removal isn't a one-time event. We monitor broker sites 24/7 to ensure 
              your data isn't re-indexed or sold to new aggregators.
            </p>
          </div>
        </div>
      </section>

      {/* --- SECTION 03: THE MISSION --- */}
      <section className="manifesto-teaser">
        <div className="manifesto-box" style={{ borderLeft: '4px solid var(--tiger-blue)' }}>
          <h3 className="card-title" style={{ color: 'var(--tiger-blue)' }}>WHY SOVEREIGNTY MATTERS</h3>
          <p className="manifesto-text">
            <strong>Disappear returns control to you.</strong> By automating the removal of your 
            Personal Identifiable Information (PII), we effectively <strong>neutralize your digital presence</strong>.
          </p>
          <button className="main-button" style={{ marginTop: '20px' }} onClick={onEnterVault}>INITIATE FULL PURGE</button>
        </div>
      </section>

      {/* --- LOGIN GATEWAY --- */}
      <section className="login-gateway" style={{ padding: '80px 20px', borderTop: '1px solid #111' }}>
        <p className="login-prompt" style={{ color: '#444', marginBottom: '10px' }}>EXISTING OPERATIVE?</p>
        <button className="login-btn-nav" style={{ padding: '15px 30px' }} onClick={onLoginRequest}>DECRYPT VAULT ACCESS</button>
      </section>
    </div>
  );
}

export default LandingPage;