import React, { useState, useEffect, useCallback } from 'react';
import { jsPDF } from "jspdf";
import "jspdf-autotable";

// --- FIXED IMPORTS (Using curly braces for Named Exports) ---
import { Manifesto } from './Manifesto';
import { Privacy } from './Privacy';
import { Terms } from './Terms';
import AdminDashboard from './AdminDashboard'; 

import './App.css';

// --- CONFIGURATION ---
// Ensure this matches your Render service URL exactly
const API_BASE_URL = "https://disappear-backend.onrender.com"; 

function App() {
  const [showShield, setShowShield] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [show2FA, setShow2FA] = useState(false); 
  const [isScanning, setIsScanning] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [notifications, setNotifications] = useState([]); 
  
  // States for Modals
  const [showLegal, setShowLegal] = useState(null); 
  const [showAdmin, setShowAdmin] = useState(false);
  const [isEmergencyWipe, setIsEmergencyWipe] = useState(false);

  // Profile State
  const [targetProfile, setTargetProfile] = useState({
    firstName: "", 
    middleName: "", 
    lastName: "", 
    email: "", 
    dob: "", 
    address: "", 
    termsAccepted: false
  });

  const [billingCycle, setBillingCycle] = useState("monthly");
  const [maskedEmail, setMaskedEmail] = useState("****************@mask.com");
  const [maskedPhone, setMaskedPhone] = useState("+1 (***) ***-****"); 
  const [nodeCount, setNodeCount] = useState(0);
  const [auditLog, setAuditLog] = useState([]);
  const [cards, setCards] = useState([]);
  const [progress, setProgress] = useState(15);
  const [showToast, setShowToast] = useState("");

  const triggerToast = (msg) => { 
    setShowToast(msg); 
    setTimeout(() => setShowToast(""), 3000); 
  };

  // Pre-fetch health check to wake up Render node
  useEffect(() => {
    if (showCheckout) {
      // Poking the root endpoint to wake the service from sleep
      fetch(`${API_BASE_URL}/`).catch(() => console.log("Handshake initialized..."));
    }
  }, [showCheckout]);

  // Notification logic
  const pushNotification = useCallback((broker) => {
    if (!broker) return;
    const id = Date.now();
    setNotifications(prev => [{ id, msg: `THREAT DEFLECTED: [${broker}]` }, ...prev].slice(0, 3));
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  }, []);

  // Data Sync
  const syncDefenseData = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/dashboard/sync`);
      const data = await res.json();
      
      setAuditLog(prevLog => {
        if (data.recent_audit?.length > 0) {
            const latest = data.recent_audit[0];
            const oldLatest = prevLog.length > 0 ? prevLog[0] : null;
            if (!oldLatest || latest.time !== oldLatest.time) {
                pushNotification(latest.broker);
            }
        }
        return data.recent_audit || [];
      });

      setMaskedEmail(data.profile?.email_alias || "");
      setMaskedPhone(data.profile?.phone_alias || "");
      setNodeCount(data.profile?.active_nodes || 0);

      const finRes = await fetch(`${API_BASE_URL}/financials/data`);
      const finData = await finRes.json();
      setCards(finData.cards || []);
    } catch (err) { 
      console.log("Heartbeat active..."); 
    }
  }, [pushNotification]);

  useEffect(() => {
    let interval;
    if (showShield) {
      syncDefenseData();
      interval = setInterval(() => {
        syncDefenseData();
      }, 10000);
    }
    return () => clearInterval(interval);
  }, [showShield, syncDefenseData]);

  const handleEmergencyBurn = async () => {
    setIsEmergencyWipe(true);
    triggerToast("INITIATING TOTAL PURGE...");
    setTimeout(async () => {
      try {
        await fetch(`${API_BASE_URL}/financials/burn-all`, { method: "POST" });
        localStorage.clear();
        window.location.reload();
      } catch (err) { 
        triggerToast("PURGE ERROR"); 
        setIsEmergencyWipe(false); 
      }
    }, 2000);
  };

  const handleKillCard = async (id) => {
    triggerToast("TERMINATING NODE...");
    try {
      await fetch(`${API_BASE_URL}/financials/kill/${id}`, { method: "DELETE" });
      setCards(prev => prev.filter(c => c.id !== id));
      triggerToast("NODE BURNED");
    } catch (err) { 
      triggerToast("ERROR"); 
    }
  };

  const startLoginFlow = () => { 
    triggerToast("CHALLENGE REQUEST SENT..."); 
    setShow2FA(true); 
  };
  
  const verify2FA = () => {
    triggerToast("AUTHENTICATING...");
    setTimeout(() => {
      localStorage.setItem("disappear_session", "active");
      setShow2FA(false); 
      setShowShield(true); 
      setProgress(100);
      triggerToast("WELCOME BACK, AGENT");
    }, 1500);
  };

  const handleDownloadPDF = () => {
    if (auditLog.length === 0) { triggerToast("NO DATA"); return; }
    setIsGenerating(true);
    triggerToast("COMPILING ENCRYPTED AUDIT...");
    setTimeout(() => {
      try {
        const doc = new jsPDF();
        doc.setFillColor(0, 71, 171); doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255, 255, 255); doc.setFontSize(22);
        doc.text("DISAPPEAR | PRIVACY AUDIT", 15, 25);
        doc.save(`AUDIT_${Date.now()}.pdf`);
        triggerToast("AUDIT DOWNLOADED");
      } catch (err) { 
        triggerToast("FAILED"); 
      } finally { 
        setIsGenerating(false); 
      }
    }, 1500);
  };

  const handleFinalPurchase = async () => {
    if(!targetProfile.firstName || !targetProfile.lastName || !targetProfile.email || !targetProfile.address) {
        triggerToast("REQUIRED FIELDS MISSING");
        return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    setIsScanning(true);
    triggerToast("CONNECTING TO SCRUB NODES...");

    try {
        const targetURL = `${API_BASE_URL.replace(/\/$/, "")}/financials/profile`;
        
        const response = await fetch(targetURL, {
            method: "POST", 
            headers: { 
              "Content-Type": "application/json",
              "Accept": "application/json"
            },
            body: JSON.stringify({
              firstName: targetProfile.firstName,
              middleName: targetProfile.middleName || "",
              lastName: targetProfile.lastName,
              email: targetProfile.email,
              address: targetProfile.address,
              dob: targetProfile.dob
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            // THE FIX: Explicitly clear the pricing/checkout views before showing shield
            setShowCheckout(false); 
            setShowPricing(false);
            setIsScanning(false);
            setShowShield(true); 
            setProgress(100);
            triggerToast("IDENTITY PURGE INITIATED");
        } else { 
            setIsScanning(false);
            triggerToast(`NODE ERROR: ${response.status}`); 
        }
    } catch (err) { 
        setIsScanning(false);
        if (err.name === 'AbortError') {
          triggerToast("TIMEOUT: RETRYING HANDSHAKE...");
        } else {
          triggerToast("NODE OFFLINE: CHECK BACKEND"); 
        }
    }
  };

  return (
    <div className={`app-container ${isEmergencyWipe ? 'wipe-shake' : ''}`}>
      <div className="progress-bar-container">
        <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
        <span className="secure-connection-text">
          {showShield ? `SHIELD ACTIVE | ${nodeCount} NODES ONLINE` : `INITIALIZING SHIELD: ${progress}%`}
        </span>
      </div>

      {showToast && <div className="status-message toast-fixed">{showToast}</div>}

      <div className="notification-stack">
        {notifications.map(n => (
          <div key={n.id} className="notif-pill fade-in">
             <span className="pulse-dot"></span> {n.msg}
          </div>
        ))}
      </div>

      {/* MODALS */}
      {showLegal && (
        <div className="modal-overlay" onClick={() => setShowLegal(null)}>
          <div className="info-modal-content" onClick={e => e.stopPropagation()}>
            {showLegal === 'manifesto' && <Manifesto />}
            {showLegal === 'privacy' && <Privacy />}
            {showLegal === 'terms' && <Terms />}
            <button className="reset-btn" style={{marginTop: '20px', width: '100%'}} onClick={() => setShowLegal(null)}>CLOSE</button>
          </div>
        </div>
      )}

      {showAdmin && (
        <div className="modal-overlay" onClick={() => setShowAdmin(false)}>
          <div onClick={e => e.stopPropagation()}>
            <AdminDashboard API_BASE_URL={API_BASE_URL} />
            <button className="reset-btn" style={{width: '100%', marginTop: '10px'}} onClick={() => setShowAdmin(false)}>EXIT COMMAND</button>
          </div>
        </div>
      )}

      {/* --- MAIN NAVIGATION VIEW LOGIC (The Ternary Fix) --- */}
      <main>
        {showShield ? (
          /* SCREEN: MAIN SHIELD DASHBOARD (Now high-priority, prevents Pricing from showing) */
          <div className="shield-container fade-in">
            <h2 className="shield-text">🛡️ SHIELD ACTIVE</h2>
            <div className="tools-grid">
              <div className="masking-tool">
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <p className="tool-label">ENCRYPTED IDENTITY EMAIL</p>
                  <button className="filter-btn active" onClick={() => {
                     fetch(`${API_BASE_URL}/financials/regenerate`, { method: "POST" })
                     .then(r => r.json()).then(data => { 
                       setMaskedEmail(data.email_alias); setMaskedPhone(data.phone_alias);
                       triggerToast("ALIASES CYCLED"); 
                     });
                  }}>CYCLE ALIAS</button>
                </div>
                <div className="masked-display" onClick={() => {navigator.clipboard.writeText(maskedEmail); triggerToast("COPIED")}}>
                  {maskedEmail}
                </div>
              </div>

              <div className="masking-tool">
                <p className="tool-label">ENCRYPTED PHONE ALIAS</p>
                <div className="masked-display" onClick={() => {navigator.clipboard.writeText(maskedPhone); triggerToast("COPIED")}}>
                  {maskedPhone}
                </div>
              </div>

              <div className="masking-tool full-width-tool">
                <p className="tool-label" style={{paddingLeft: '30px'}}>VIRTUAL SHIELD CARDS</p>
                <div className="card-manager-list" style={{padding: '0 30px'}}>
                  {cards.map(c => (
                    <div key={c.id} className="managed-card-row enhanced-card">
                      <div className="card-row-info">
                        <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px'}}>
                           <span className="card-nickname" style={{color: 'var(--tiger-blue)', fontWeight: 'bold'}}>{c.label.toUpperCase()}</span>
                           <button className="kill-text-bold" onClick={() => handleKillCard(c.id)}>TERMINATE</button>
                        </div>
                        <code className="card-digits" onClick={() => {navigator.clipboard.writeText(c.number.replace(/\s/g, '')); triggerToast("COPIED")}}>
                          {c.number}
                        </code>
                        <div style={{display: 'flex', gap: '30px', borderTop: '1px solid #111', paddingTop: '10px', marginTop: '10px'}}>
                           <div><span style={{fontSize: '0.5rem', color: '#64748b', display: 'block'}}>EXP</span><strong style={{fontSize: '0.9rem'}}>{c.expiry || '08/28'}</strong></div>
                           <div><span style={{fontSize: '0.5rem', color: '#64748b', display: 'block'}}>CVV</span><strong style={{fontSize: '0.9rem'}}>{c.cvv || '442'}</strong></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{padding: '0 30px'}}>
                  <button className="mask-btn" style={{marginTop: '20px', width: '100%', borderStyle: 'dashed'}} onClick={() => triggerToast("MINTING...")}>+ MINT NEW SHIELD</button>
                </div>
              </div>

              <div className="masking-tool">
                <p className="tool-label">LIVE SECURITY AUDIT</p>
                <div className="audit-list">
                  {auditLog.map((log, i) => (
                    <div key={i} className="audit-row">
                      <span className="audit-broker">[{log.broker}]</span>
                      <span className="audit-action">{log.action}</span>
                    </div>
                  ))}
                </div>
                <button className="pdf-btn" onClick={handleDownloadPDF} disabled={isGenerating}>GENERATE AUDIT PDF</button>
              </div>
            </div>

            <div style={{display: 'flex', gap: '20px', marginTop: '40px'}}>
              <button className="reset-btn" onClick={() => {localStorage.clear(); window.location.reload();}}>Logout Securely</button>
              <button className="burn-all-btn" onClick={() => { if(window.confirm("CONFIRM TOTAL PURGE?")) handleEmergencyBurn(); }}>EMERGENCY BURN</button>
            </div>
          </div>
        ) : (
          /* SECONDARY VIEW (Onboarding/Sales Flow) */
          <div className="onboarding-flow">
            {/* SCREEN: HOME */}
            {!showPricing && !showCheckout && !isScanning && !show2FA && (
              <div className="fade-in" style={{display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '60vh', justifyContent: 'center'}}>
                <h1 className="brand-name">DISAPPEAR</h1>
                <p className="subtitle">Privacy-as-a-Service</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', marginTop: '40px' }}>
                  <div style={{ display: 'flex', gap: '20px' }}>
                    <button className="main-button" onClick={() => setShowPricing(true)}>IDENTITY CLEANUP</button>
                    <button className="login-btn-outline" onClick={startLoginFlow}>CLIENT LOGIN</button>
                  </div>
                  <button className="info-link-btn" onClick={() => setShowLegal('manifesto')}>WHY IS THIS CRITICAL? [MANIFESTO]</button>
                </div>
              </div>
            )}

            {/* SCREEN: 2FA LOGIN */}
            {show2FA && (
              <div className="pricing-card fade-in">
                <div className="price-box">
                  <h3 className="tiger-text">MFA CHALLENGE</h3>
                  <p style={{fontSize: '0.7rem', color: '#94A3B8', marginBottom: '20px'}}>ENTER SECURE ACCESS TOKEN</p>
                  <input 
                    id="mfa_input"
                    name="mfa_input"
                    className="mask-btn" 
                    style={{width: '100%', textAlign: 'center', fontSize: '1.2rem', letterSpacing: '5px'}} 
                    placeholder="******" 
                  />
                  <button className="main-button" style={{width: '100%', marginTop: '20px'}} onClick={verify2FA}>VERIFY</button>
                  <button className="reset-btn" style={{width: '100%'}} onClick={() => setShow2FA(false)}>CANCEL</button>
                </div>
              </div>
            )}

            {/* SCREEN: PRICING */}
            {showPricing && !showCheckout && !isScanning && (
              <div className="pricing-card fade-in">
                <div className="billing-toggle">
                  <button className={billingCycle === 'monthly' ? 'mask-btn active-toggle' : 'mask-btn'} onClick={() => setBillingCycle('monthly')}>Monthly</button>
                  <button className={billingCycle === 'annual' ? 'mask-btn active-toggle' : 'mask-btn'} onClick={() => setBillingCycle('annual')}>Annual</button>
                </div>
                <div className="price-box">
                  <h3 className="tiger-text">PREMIUM PAAS</h3>
                  <div className="price-amount">${billingCycle === 'monthly' ? '19.99' : '15.99'}</div>
                  <button className="main-button" style={{width: '100%'}} onClick={() => setShowCheckout(true)}>PROCEED</button>
                  <button className="reset-btn" style={{width: '100%'}} onClick={() => setShowPricing(false)}>CANCEL</button>
                </div>
              </div>
            )}

            {/* SCREEN: CHECKOUT/PROFILE */}
            {showCheckout && !isScanning && (
              <div className="pricing-card fade-in">
                <div className="price-box" style={{maxWidth: '450px', width: '100%', margin: '0 auto'}}>
                  <h3 className="tiger-text">TARGET PROFILE DATA</h3>
                  <div style={{display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', textAlign: 'left'}}>
                      
                      <div className="accessible-field">
                        <label htmlFor="firstName" className="field-label">First Name</label>
                        <input id="firstName" name="firstName" className="mask-btn" style={{width: '100%', color: 'white'}} placeholder="First Name" autoComplete="given-name" value={targetProfile.firstName} onChange={(e) => setTargetProfile({...targetProfile, firstName: e.target.value})} />
                      </div>

                      <div className="accessible-field">
                        <label htmlFor="middleName" className="field-label">Middle Name</label>
                        <input id="middleName" name="middleName" className="mask-btn" style={{width: '100%', color: 'white'}} placeholder="Middle Name (Optional)" autoComplete="additional-name" value={targetProfile.middleName} onChange={(e) => setTargetProfile({...targetProfile, middleName: e.target.value})} />
                      </div>

                      <div className="accessible-field">
                        <label htmlFor="lastName" className="field-label">Last Name</label>
                        <input id="lastName" name="lastName" className="mask-btn" style={{width: '100%', color: 'white'}} placeholder="Last Name" autoComplete="family-name" value={targetProfile.lastName} onChange={(e) => setTargetProfile({...targetProfile, lastName: e.target.value})} />
                      </div>
                      
                      <div className="accessible-field">
                        <label htmlFor="email" className="field-label">Email Address</label>
                        <input id="email" name="email" className="mask-btn" style={{width: '100%', color: 'white'}} placeholder="Primary Email Address" autoComplete="email" value={targetProfile.email} onChange={(e) => setTargetProfile({...targetProfile, email: e.target.value})} />
                      </div>
                      
                      <div className="accessible-field">
                        <label htmlFor="address" className="field-label">Home Address</label>
                        <input 
                          id="address"
                          name="address"
                          className="mask-btn" 
                          style={{width: '100%', color: 'white'}} 
                          placeholder="Home Address (Verified)" 
                          autoComplete="street-address"
                          value={targetProfile.address} 
                          onChange={(e) => setTargetProfile({...targetProfile, address: e.target.value})} 
                        />
                      </div>

                      <div className="accessible-field">
                          <label htmlFor="dob" className="field-label">Date of Birth</label>
                          <input id="dob" name="dob" className="mask-btn" style={{width: '100%', color: 'white'}} type="date" value={targetProfile.dob} onChange={(e) => setTargetProfile({...targetProfile, dob: e.target.value})} />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginTop: '15px', padding: '0 10px' }}>
                        <input 
                          type="checkbox" 
                          id="terms-check" 
                          name="terms-check"
                          style={{ marginTop: '4px' }}
                          checked={targetProfile.termsAccepted}
                          onChange={(e) => setTargetProfile({...targetProfile, termsAccepted: e.target.checked})}
                        />
                        <label htmlFor="terms-check" style={{ fontSize: '0.65rem', color: '#94A3B8', textAlign: 'left', lineHeight: '1.4' }}>
                          I agree to the <span className="legal-link" onClick={() => setShowLegal('terms')}>Terms of Service</span> and understand that burning a card does not absolve me of existing financial obligations.
                        </label>
                      </div>
                  </div>

                  <button 
                    className="main-button" 
                    style={{ 
                      width: '100%', 
                      marginTop: '25px', 
                      opacity: targetProfile.termsAccepted ? 1 : 0.4,
                      cursor: targetProfile.termsAccepted ? 'pointer' : 'not-allowed' 
                    }} 
                    onClick={handleFinalPurchase}
                    disabled={!targetProfile.termsAccepted}
                  >
                    CONFIRM & INITIATE SCRUB
                  </button>
                  <button className="reset-btn" style={{width: '100%', marginTop: '10px'}} onClick={() => setShowCheckout(false)}>BACK</button>
                </div>
              </div>
            )}

            {/* SCREEN: SCANNING ANIMATION */}
            {isScanning && (
              <div className="shield-container">
                <div className="recon-terminal" style={{maxWidth: '500px', margin: '0 auto'}}>
                  <div className="terminal-line">{'>> INITIATING HANDSHAKE...'}</div>
                  <div className="terminal-line">{'>> BYPASSING DATA BROKER FIREWALLS...'}</div>
                  <div className="terminal-line">{'>> UPLOADING PURGE REQUESTS...'}</div>
                  <div className="terminal-line">{'>> DECRYPTING BROKER RESPONSE NODES...'}</div>
                  <div className="terminal-line">{'>> VERIFYING IDENTITY FRAGMENTS...'}</div>
                  <div className="terminal-line">{'>> ESTABLISHING SECURE ALIAS TUNNEL...'}</div>
                </div>
                <h2 className="shield-text" style={{marginTop: '20px'}}>SCRUBBING NODES...</h2>
              </div>
            )}
          </div>
        )}
      </main>

      {/* PERSISTENT GLOBAL FOOTER */}
      <footer className="home-footer">
          <span onClick={() => setShowLegal('privacy')}>PRIVACY POLICY</span>
          <span className="footer-divider">|</span>
          <span onClick={() => setShowLegal('terms')}>TERMS OF SERVICE</span>
          <span style={{ opacity: 0.05, cursor: 'pointer', marginLeft: '10px' }} onClick={() => setShowAdmin(true)}>.</span>
      </footer>

    </div>
  );
}

export default App;