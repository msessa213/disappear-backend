import React from 'react';
import './App.css'; 

const LandingPage = ({ onEnterVault }) => {
  return (
    <div className="landing-wrapper fade-in">
      <section className="hero-section">
        <h1 className="brand-name" style={{ fontSize: 'clamp(3.5rem, 12vw, 7rem)' }}>DISAPPEAR</h1>
        <p className="subtitle" style={{ letterSpacing: '8px', color: 'var(--tiger-blue)' }}>
          PRIVACY-AS-A-SERVICE [P-A-A-S]
        </p>
        <p className="hero-manifesto">
          The ultimate security doctrine for the digital age. Scramble your footprint. 
          Isolate your assets. Vanish at will.
        </p>
        
        <div className="cta-group">
          <button className="main-button" style={{ padding: '20px 50px', fontSize: '1rem' }} onClick={onEnterVault}>
            ACCESS WEB VAULT
          </button>
          <div className="download-badges" style={{ marginTop: '20px', display: 'flex', gap: '15px' }}>
            <span className="reset-btn" style={{ fontSize: '0.6rem', padding: '8px 15px', cursor: 'default' }}>APP STORE</span>
            <span className="reset-btn" style={{ fontSize: '0.6rem', padding: '8px 15px', cursor: 'default' }}>GOOGLE PLAY</span>
          </div>
        </div>
      </section>

      <section className="bento-grid">
        <div className="bento-item tall doctrine-block">
          <span className="field-label">01 // THE DOCTRINE</span>
          <h3>DATA SCARCITY</h3>
          <p>
            Privacy isn't a setting; it's an action. We believe the only data that cannot 
            be stolen is data that was never given. Our architecture replaces your 
            Personally Identifiable Information (PII) with clinical, encrypted proxies.
          </p>
          <div className="doctrine-seal" style={{ marginTop: '20px', fontSize: '0.55rem', color: 'var(--tiger-blue)', border: '1px solid var(--tiger-blue)', padding: '5px', textAlign: 'center' }}>SEALED_ENCRYPTION_ACTIVE</div>
        </div>

        <div className="bento-item phone-block">
          <span className="field-label">02 // COMMS</span>
          <h3>PHONE NODES</h3>
          <p>Burner lines for 2FA bypass and anonymous comms. Stop universal key tracking.</p>
        </div>

        <div className="bento-item vcc-block">
          <span className="field-label">03 // FINANCE</span>
          <h3>VCC NODES</h3>
          <p>Merchant-locked digits. Isolate spending habits from data aggregators.</p>
        </div>

        <div className="bento-item wide threat-block">
          <span className="field-label" style={{color: 'var(--alert-red)'}}>WARNING // THE INVISIBLE AUCTION</span>
          <p style={{ marginTop: '10px' }}>
            Data brokers possess a digital ghost of you. They sell your "Golden Record" 
            for pennies. <strong>Re-identification</strong> is permanent. You cannot 
            un-leak your life. Disappear provides the firewall.
          </p>
        </div>

        <div className="bento-item purge-block">
          <span className="field-label">04 // FAIL-SAFE</span>
          <h3>TOTAL PURGE</h3>
          <p>One command. Total scrub. S3-backed audit receipt. Vanish in 3 seconds.</p>
        </div>
      </section>

      <div className="landing-stats">
        <div className="stat-node">
          <span className="tiger-text" style={{ fontSize: '1.5rem' }}>1.2M+</span>
          <span className="field-label">PII_SCRUBBED</span>
        </div>
        <div className="stat-node">
          <span className="tiger-text" style={{ fontSize: '1.5rem' }}>0.0ms</span>
          <span className="field-label">DATA_RETENTION</span>
        </div>
        <div className="stat-node">
          <span className="tiger-text" style={{ fontSize: '1.5rem' }}>AES-256</span>
          <span className="field-label">VAULT_STANDARD</span>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;