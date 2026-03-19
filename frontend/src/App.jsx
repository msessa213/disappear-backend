import React, { useState, useEffect, useCallback } from 'react';
import { jsPDF } from "jspdf";
import "jspdf-autotable";

// --- FIXED IMPORTS (Using curly braces for Named Exports) ---
import { Manifesto } from './Manifesto';
import { Privacy } from './Privacy';
import { Terms } from './Terms';
import AdminDashboard from './AdminDashboard'; 

import './App.css';

/**
 * DISAPPEAR CORE ENGINE v2.1.5
 * Privacy-as-a-Service Frontend
 */

const API_BASE_URL = "https://disappear-backend.onrender.com"; 

function App() {
  const [showShield, setShowShield] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [show2FA, setShow2FA] = useState(false); 
  const [isScanning, setIsScanning] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [notifications, setNotifications] = useState([]); 
  
  // States for Modals and Administrative Overlays
  const [showLegal, setShowLegal] = useState(null); 
  const [showAdmin, setShowAdmin] = useState(false);
  const [isEmergencyWipe, setIsEmergencyWipe] = useState(false);

  // NEW: MINTING STATES
  const [showMintModal, setShowMintModal] = useState(false);
  const [newCardLabel, setNewCardLabel] = useState("");

  // Target Profile Identity State
  const [targetProfile, setTargetProfile] = useState({
    firstName: "", 
    middleName: "", 
    lastName: "", 
    email: "", 
    dob: "", 
    address: "", 
    termsAccepted: false
  });

  // Dashboard Data Persistence States
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [maskedEmail, setMaskedEmail] = useState("****************@mask.com");
  const [maskedPhone, setMaskedPhone] = useState("+1 (***) ***-****"); 
  const [nodeCount, setNodeCount] = useState(0);
  const [auditLog, setAuditLog] = useState([]);
  const [cards, setCards] = useState([]);
  const [progress, setProgress] = useState(15);
  const [showToast, setShowToast] = useState("");

  /**
   * Triggers a global status notification toast
   * @param {string} msg - The message to display
   */
  const triggerToast = (msg) => { 
    setShowToast(msg); 
    setTimeout(() => setShowToast(""), 3000); 
  };

  // Pre-fetch health check to wake up Render node from sleep
  useEffect(() => {
    if (showCheckout) {
      console.log(">> Handshake initialized with scrubbing nodes...");
      fetch(`${API_BASE_URL}/`).catch(() => console.log("Wake-up pulse sent..."));
    }
  }, [showCheckout]);

  /**
   * Pushes a deflected threat notification to the stack
   */
  const pushNotification = useCallback((broker) => {
    if (!broker) return;
    const id = Date.now();
    setNotifications(prev => [{ id, msg: `THREAT DEFLECTED: [${broker}]` }, ...prev].slice(0, 3));
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  }, []);

  /**
   * Core Data Synchronization Hook
   * Fetches latest audit logs, aliases, and virtual cards
   */
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
      console.log("Heartbeat active - awaiting connection..."); 
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

  /**
   * Handles total platform purge (Emergency Burn)
   */
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

  /**
   * Mints a new virtual shield card via the backend (FIXED)
   */
  const handleMintCard = async () => {
    if (!newCardLabel) {
        triggerToast("ENTER MERCHANT NAME");
        return;
    }
    triggerToast("MINTING NEW SHIELD...");
    try {
      const response = await fetch(`${API_BASE_URL}/financials/mint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newCardLabel })
      });
      if (response.ok) {
        const newCard = await response.json();
        // Immediately add new card to top of list and close modal
        setCards(prev => [newCard, ...prev]);
        setNewCardLabel("");
        setShowMintModal(false);
        triggerToast("NODE SECURED");
      } else {
        triggerToast("MINT REJECTED BY SERVER");
      }
    } catch (err) {
      triggerToast("CONNECTION ERROR");
    }
  };

  /**
   * Destroys a single virtual card node
   */
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

  /**
   * Cycles identity aliases via backend regeneration
   */
  const handleCycleAliases = async () => {
    triggerToast("CYCLING IDENTITY NODES...");
    try {
      const res = await fetch(`${API_BASE_URL}/financials/regenerate`, { method: "POST" });
      const data = await res.json();
      setMaskedEmail(data.email_alias);
      setMaskedPhone(data.phone_alias);
      triggerToast("IDENTITY UPDATED");
    } catch (err) {
      triggerToast("BACKEND ERROR");
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
        doc.setFillColor(0, 0, 0); doc.rect(0, 0, 210, 40, 'F');
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
        const response = await fetch(`${API_BASE_URL}/financials/profile`, {
            method: "POST", 
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(targetProfile),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            setShowCheckout(false); 
            setShowPricing(false);
            setIsScanning(false);
            setShowShield(true); 
            setProgress(100);
            triggerToast("IDENTITY PURGE INITIATED");
            syncDefenseData(); // Pull data immediately
        } else { 
            setIsScanning(false);
            triggerToast(`NODE ERROR: ${response.status}`); 
        }
    } catch (err) { 
        setIsScanning(false);
        triggerToast("NODE OFFLINE");
    }
  };

  return (
    <div className={`app-container ${isEmergencyWipe ? 'wipe-shake' : ''}`}>
      {/* HUD OVERLAY: PROGRESS AND STATUS */}
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

      {/* MINTING MERCHANT MODAL */}
      {showMintModal && (
        <div className="modal-overlay" style={{zIndex: 50000}} onClick={() => setShowMintModal(false)}>
          <div className="price-box" onClick={e => e.stopPropagation()} style={{border: '1px solid var(--tiger-blue)'}}>
            <h3 className="tiger-text">MINT NEW SHIELD</h3>
            <p className="field-label">ASSOCIATE MERCHANT</p>
            <input 
              id="merchant_name"
              name="merchant_name"
              className="mask-btn" 
              style={{width: '100%', color: 'white', textAlign: 'center'}} 
              placeholder="e.g. Amazon, Netflix, Target" 
              value={newCardLabel}
              onChange={(e) => setNewCardLabel(e.target.value)}
            />
            <button className="main-button" style={{width: '100%', marginTop: '20px'}} onClick={handleMintCard}>AUTHORIZE NODE</button>
            <button className="reset-btn" style={{width: '100%'}} onClick={() => setShowMintModal(false)}>CANCEL</button>
          </div>
        </div>
      )}

      {/* GLOBAL MODALS */}
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

      {/* --- MAIN NAVIGATION VIEW --- */}
      <main>
        {showShield ? (
          /* SCREEN: MAIN SHIELD DASHBOARD (VERTICAL STACK FIX) */
          <div className="shield-container fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            <h2 className="shield-text">🛡️ SHIELD ACTIVE</h2>
            
            {/* 1. EMAIL ALIAS */}
            <div className="masking-tool" style={{ width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column' }}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 5px'}}>
                <p className="tool-label">ENCRYPTED IDENTITY EMAIL</p>
                <button 
                   className="main-button" 
                   style={{ fontSize: '0.65rem', padding: '8px 15px', width: 'auto', minWidth: '110px' }} 
                   onClick={handleCycleAliases}
                >
                  CYCLE ALIAS
                </button>
              </div>
              <div className="masked-display" onClick={() => {navigator.clipboard.writeText(maskedEmail); triggerToast("COPIED")}}>
                {maskedEmail}
              </div>
            </div>

            {/* 2. PHONE ALIAS (NEW CYCLE BUTTON ADDED) */}
            <div className="masking-tool" style={{ width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column' }}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 5px'}}>
                <p className="tool-label">ENCRYPTED PHONE ALIAS</p>
                <button 
                  className="main-button" 
                  style={{ fontSize: '0.65rem', padding: '8px 15px', width: 'auto', minWidth: '110px' }} 
                  onClick={handleCycleAliases}
                >
                  CYCLE ALIAS
                </button>
              </div>
              <div className="masked-display" onClick={() => {navigator.clipboard.writeText(maskedPhone); triggerToast("COPIED")}}>
                {maskedPhone}
              </div>
            </div>

            {/* 3. VIRTUAL SHIELD CARDS (Vertical Stack) */}
            <div className="masking-tool" style={{ width: '100%', maxWidth: '600px' }}>
              <p className="tool-label" style={{ textAlign: 'center', marginBottom: '20px' }}>VIRTUAL SHIELD CARDS</p>
              <div className="card-manager-list" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
              <button className="reset-btn" style={{marginTop: '20px', width: '100%', borderStyle: 'dashed'}} onClick={() => setShowMintModal(true)}>
                + MINT NEW SHIELD
              </button>
            </div>

            {/* 4. SECURITY AUDIT */}
            <div className="masking-tool" style={{ width: '100%', maxWidth: '600px' }}>
              <p className="tool-label" style={{ textAlign: 'center' }}>LIVE SECURITY AUDIT</p>
              <div className="audit-list" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {auditLog.map((log, i) => (
                  <div key={i} className="audit-row" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #111', padding: '10px 0' }}>
                    <span className="audit-broker">[{log.broker}]</span>
                    <span className="audit-action">{log.action}</span>
                  </div>
                ))}
              </div>
              <button className="pdf-btn" style={{ width: '100%', marginTop: '15px' }} onClick={handleDownloadPDF} disabled={isGenerating}>
                GENERATE AUDIT PDF
              </button>
            </div>

            {/* LOGOUT AND BURN */}
            <div style={{display: 'flex', flexDirection: 'column', gap: '15px', width: '100%', maxWidth: '400px', marginTop: '40px'}}>
              <button className="reset-btn" onClick={() => {localStorage.clear(); window.location.reload();}}>LOGOUT SECURELY</button>
              <button className="burn-all-btn" onClick={() => { if(window.confirm("CONFIRM TOTAL PURGE?")) handleEmergencyBurn(); }}>EMERGENCY BURN</button>
            </div>
          </div>
        ) : (
          /* SECONDARY VIEW (Onboarding/Sales Flow) */
          <div className="onboarding-flow">
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

            {show2FA && (
              <div className="pricing-card fade-in">
                <div className="price-box">
                  <h3 className="tiger-text">MFA CHALLENGE</h3>
                  <p style={{fontSize: '0.7rem', color: '#94A3B8', marginBottom: '20px'}}>ENTER SECURE ACCESS TOKEN</p>
                  <input 
                    id="mfa_code"
                    name="mfa_code"
                    className="mask-btn" 
                    style={{width: '100%', textAlign: 'center', fontSize: '1.2rem', letterSpacing: '5px'}} 
                    placeholder="******" 
                  />
                  <button className="main-button" style={{width: '100%', marginTop: '20px'}} onClick={verify2FA}>VERIFY</button>
                  <button className="reset-btn" style={{width: '100%'}} onClick={() => setShow2FA(false)}>CANCEL</button>
                </div>
              </div>
            )}

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
                  <button className="reset-btn" style={{width: '100%', marginTop: '10px'}} onClick={() => setShowPricing(false)}>CANCEL</button>
                </div>
              </div>
            )}

            {showCheckout && !isScanning && (
              <div className="pricing-card fade-in">
                <div className="price-box" style={{maxWidth: '450px', width: '100%', margin: '0 auto'}}>
                  <h3 className="tiger-text">TARGET PROFILE DATA</h3>
                  <div style={{display: 'flex', flexDirection: 'column', gap: '15px', textAlign: 'left'}}>
                      <input id="first_name" name="first_name" className="mask-btn" placeholder="First Name" value={targetProfile.firstName} onChange={(e) => setTargetProfile({...targetProfile, firstName: e.target.value})} />
                      <input id="middle_name" name="middle_name" className="mask-btn" placeholder="Middle Name" value={targetProfile.middleName} onChange={(e) => setTargetProfile({...targetProfile, middleName: e.target.value})} />
                      <input id="last_name" name="last_name" className="mask-btn" placeholder="Last Name" value={targetProfile.lastName} onChange={(e) => setTargetProfile({...targetProfile, lastName: e.target.value})} />
                      <input id="email" name="email" className="mask-btn" placeholder="Email Address" value={targetProfile.email} onChange={(e) => setTargetProfile({...targetProfile, email: e.target.value})} />
                      <input id="address" name="address" className="mask-btn" placeholder="Home Address" value={targetProfile.address} onChange={(e) => setTargetProfile({...targetProfile, address: e.target.value})} />
                      <input id="dob" name="dob" className="mask-btn" type="date" value={targetProfile.dob} onChange={(e) => setTargetProfile({...targetProfile, dob: e.target.value})} />
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginTop: '15px' }}>
                        <input type="checkbox" checked={targetProfile.termsAccepted} onChange={(e) => setTargetProfile({...targetProfile, termsAccepted: e.target.checked})} />
                        <label style={{ fontSize: '0.65rem', color: '#94A3B8' }}>Authorize Full PII Scrub and Burn</label>
                      </div>
                  </div>
                  <button className="main-button" style={{ width: '100%', marginTop: '25px' }} onClick={handleFinalPurchase} disabled={!targetProfile.termsAccepted}>CONFIRM & INITIATE</button>
                  <button className="reset-btn" style={{width: '100%', marginTop: '10px'}} onClick={() => setShowCheckout(false)}>BACK</button>
                </div>
              </div>
            )}

            {isScanning && (
              <div className="shield-container">
                <div className="recon-terminal" style={{maxWidth: '500px', margin: '0 auto'}}>
                  <div className="terminal-line">{'>> INITIATING HANDSHAKE...'}</div>
                  <div className="terminal-line">{'>> BYPASSING DATA BROKER FIREWALLS...'}</div>
                  <div className="terminal-line">{'>> UPLOADING PURGE REQUESTS...'}</div>
                  <div className="terminal-line">{'>> DECRYPTING BROKER RESPONSE NODES...'}</div>
                  <div className="terminal-line">{'>> VERIFYING IDENTITY FRAGMENTS...'}</div>
                  <div className="terminal-line">{'>> ESTABLISHING SECURE ALIAS TUNNEL...'}</div>
                  <div className="terminal-line">{'>> ENCRYPTING VAULT ASSETS...'}</div>
                  <div className="terminal-line">{'>> SHIELD ENGAGEMENT CONFIRMED...'}</div>
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
          <span className="admin-trigger" onClick={() => setShowAdmin(true)}>.</span>
      </footer>

    </div>
  );
}

export default App;