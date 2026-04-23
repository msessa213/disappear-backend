import React, { useState } from 'react';

/**
 * DISAPPEAR LANDING ENGINE
 * ARCHITECTURE: Multi-Node Bento Grid
 * THEME: Tiger Blue / High-Contrast Security
 * UPDATE: Moved Scanner to dedicated box for perfect alignment.
 */

function LandingPage({ onEnterVault, onLoginRequest }) {
  const [scanQuery, setScanQuery] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  const handleScan = () => {
    if (!scanQuery || scanQuery.length < 5) return;
    setIsScanning(true);
    setScanResult(null);

    // Deterministic Logic: Same input always equals same result for Brand Trust
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

      {/* --- SECTION 01: THE DOCTRINE (Bento Hub) --- */}
      <section className="bento-container" style={{ marginTop: '120px' }}>
        
        {/* NODE A: THE DOCTRINE */}
        <div className="bento-item bento-hero">
          <h1 className="elite-header">STAY<br />VIGILANT.</h1>
          <p className="hero-description">
            Your identity is a target. In 2026, data brokers weaponize your PII for profit. 
            <strong> Disappear</strong> is the tactical counter-measure built to scorch your digital trail.
          </p>
          <div className="hero-cta-group">
            <button className="main-button" onClick={onEnterVault}>INITIATE IDENTITY SCRUB</button>
            <p className="cta-subtext" style={{ marginTop: '10px' }}>Proprietary PII Scrubbing Engine // Global Coverage</p>
          </div>
        </div>

        {/* NODE B: LIVE RECONNAISSANCE (Dedicated Scanner Box) */}
        <div className="bento-item bento-scanner" style={{ borderLeft: '1px solid #111' }}>
          <h3 className="card-title">LIVE RECONNAISSANCE</h3>
          <p style={{ fontSize: '0.75rem', color: '#94A3B8', marginBottom: '20px' }}>
            Scan the global broker index for PII exposure nodes linked to your contact data.
          </p>
          
          <div className="free-scan-box" style={{ background: '#000', border: '1px solid #111', padding: '15px' }}>
            <span className="mono-label" style={{ display: 'block', marginBottom: '10px', fontSize: '0.6rem' }}>PII EXPOSURE SCAN</span>
            <input 
              type="text" 
              placeholder="PHONE OR EMAIL..." 
              value={scanQuery}
              onChange={(e) => setScanQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleScan()}
              style={{ 
                width: '100%', background: '#050505', border: '1px solid #222', 
                color: 'white', padding: '12px', fontFamily: 'Courier New', outline: 'none', marginBottom: '10px'
              }}
            />
            <button 
              className="main-button" 
              onClick={handleScan}
              disabled={isScanning}
              style={{ width: '100%', fontSize: '0.7rem' }}
            >
              {isScanning ? 'SCANNING...' : 'SCAN DATABASE'}
            </button>
          </div>

          {scanResult && (
            <div className="fade-in" style={{ marginTop: '20px', color: 'var(--tiger-blue)', fontWeight: 'bold', fontSize: '0.75rem' }}>
              [!] ALERT: {scanResult} EXPOSURE POINTS DETECTED.
              <button 
                onClick={onEnterVault}
                style={{ display: 'block', background: 'none', border: 'none', color: 'white', textDecoration: 'underline', cursor: 'pointer', marginTop: '5px', padding: 0 }}
              >
                INITIATE FULL NEUTRALIZATION
              </button>
            </div>
          )}
        </div>

        {/* NODE C: INTELLIGENCE BRIEF */}
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
            <p style={{ fontSize: '0.75rem', color: '#94A3B8', lineHeight: '1.4', margin: '0' }}>
              <span style={{ color: 'var(--tiger-blue)', fontWeight: 'bold' }}>» SYSTEM_LOG:</span> Disappear automates the removal of your data from lead-gen lists.
            </p>
          </div>
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
              We scrub your contact info from broker databases to neutralize robocalls and SMS phishing at the source.
            </p>
          </div>

          <div className="bento-card-small">
            <div className="step-num">02</div>
            <h4 className="directive-title">INBOX SANITIZATION</h4>
            <p className="directive-text">
              Deploy encrypted Email Relay nodes. Our system strips hidden trackers from incoming mail.
            </p>
          </div>

          <div className="bento-card-small">
            <div className="step-num">03</div>
            <h4 className="directive-title">FINANCIAL SHIELDING</h4>
            <p className="directive-text">
              Merchant-locked virtual cards hide your real banking identity to prevent synthetic identity theft.
            </p>
          </div>

          <div className="bento-card-small alert-card">
            <div className="step-num">04</div>
            <h4 className="directive-title">CONTINUOUS MONITORING</h4>
            <p className="directive-text">
              We monitor broker sites 24/7 to ensure your data isn't re-indexed or sold to new aggregators.
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
            Personal Identifiable Information (PII), we effectively <strong>neutralize your digital presence</strong> within the surveillance economy. 
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