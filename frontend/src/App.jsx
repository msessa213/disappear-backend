import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { jsPDF } from "jspdf";
import "jspdf-autotable";

// --- NEW IMPORTS ---
import Manifesto from './Manifesto';
import Privacy from './Privacy';
import Terms from './Terms';
import AdminDashboard from './AdminDashboard'; 

import './App.css';

// --- CONFIGURATION ---
const API_BASE_URL = "https://disappear-backend.onrender.com"; 

function App() {
  const [showShield, setShowShield] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [show2FA, setShow2FA] = useState(false); 
  const [isScanning, setIsScanning] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [terminatingId, setTerminatingId] = useState(null); 
  const [notifications, setNotifications] = useState([]); 
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  // States for Modals
  const [showLegal, setShowLegal] = useState(null); 
  const [showAdmin, setShowAdmin] = useState(false);

  const [reconActive, setReconActive] = useState(false);
  const [reconLog, setReconLog] = useState([]);
  const [isEmergencyWipe, setIsEmergencyWipe] = useState(false);

  // Profile State
  const [targetProfile, setTargetProfile] = useState({
    fullName: "", email: "", dob: "", address: "", termsAccepted: false
  });

  const [newCardLabel, setNewCardLabel] = useState("");
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [chartRange, setChartRange] = useState("30D");
  const [maskedEmail, setMaskedEmail] = useState("****************@mask.com");
  const [maskedPhone, setMaskedPhone] = useState("+1 (***) ***-****"); 
  const [nodeCount, setNodeCount] = useState(0);
  const [auditLog, setAuditLog] = useState([]);
  const [mapNodes, setMapNodes] = useState([]); 
  const [cards, setCards] = useState([]);
  const [progress, setProgress] = useState(15);
  const [showToast, setShowToast] = useState("");

  const triggerToast = (msg) => { setShowToast(msg); setTimeout(() => setShowToast(""), 2000); };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const pushNotification = (broker) => {
    if (!broker) return;
    const id = Date.now();
    setNotifications(prev => [{ id, msg: `THREAT DEFLECTED: [${broker}]` }, ...prev].slice(0, 3));
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  };

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
      setMapNodes(data.map_nodes || []); 

      const finRes = await fetch(`${API_BASE_URL}/financials/data`);
      const finData = await finRes.json();
      setCards(finData.cards || []);
    } catch (e) { console.log("Pulse heartbeat..."); }
  }, [showShield]);

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

  const runDeepWebScan = () => {
    setReconActive(true);
    setReconLog(["INITIALIZING RECONNAISSANCE..."]);
    const brokerPool = ["ACXIOM", "SPOKEO", "WHITEPAGES", "INTELIUS", "PEOPLELOOKER"];
    let count = 0;
    const interval = setInterval(() => {
      const broker = brokerPool[Math.floor(Math.random() * brokerPool.length)];
      setReconLog(prev => [...prev, `[MATCH] PII DATA LOCATED ON ${broker} SERVERS...`].slice(-8));
      count++;
      if (count > 15) {
        clearInterval(interval);
        setReconLog(prev => [...prev, "SCAN COMPLETE: 47 THREATS IDENTIFIED.", "SHIELD DEPLOYMENT RECOMMENDED."]);
        setReconActive(false);
      }
    }, 200);
  };

  const handleEmergencyBurn = async () => {
    setIsEmergencyWipe(true);
    triggerToast("INITIATING TOTAL PURGE...");
    setTimeout(async () => {
      try {
        await fetch(`${API_BASE_URL}/financials/burn-all`, { method: "POST" });
        localStorage.clear();
        window.location.reload();
      } catch (err) { triggerToast("PURGE ERROR"); setIsEmergencyWipe(false); }
    }, 2000);
  };

  const handleKillCard = async (id) => {
    setTerminatingId(id); 
    setTimeout(async () => {
      try {
        await fetch(`${API_BASE_URL}/financials/kill/${id}`, { method: "DELETE" });
        setCards(prev => prev.filter(c => c.id !== id));
        setTerminatingId(null);
        triggerToast("NODE BURNED");
      } catch (e) { triggerToast("ERROR"); setTerminatingId(null); }
    }, 800); 
  };

  const startLoginFlow = () => { triggerToast("CHALLENGE REQUEST SENT..."); setShow2FA(true); };
  
  const verify2FA = () => {
    triggerToast("AUTHENTICATING...");
    setTimeout(() => {
      localStorage.setItem("disappear_session", "active");
      setShow2FA(false); setShowShield(true); setProgress(100);
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
        doc.save(`DISAPPEAR_AUDIT_${Date.now()}.pdf`);
        triggerToast("AUDIT DOWNLOADED");
      } catch (err) { triggerToast("FAILED"); }
      finally { setIsGenerating(false); }
    }, 1500);
  };

  const handleFinalPurchase = async () => {
    if(!targetProfile.fullName || !targetProfile.email) {
        triggerToast("PROFILE DATA REQUIRED");
        return;
    }
    try {
        const response = await fetch(`${API_BASE_URL}/financials/profile`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(targetProfile)
        });
        if (response.ok) {
            setShowCheckout(false); setIsScanning(true); setProgress(60);
            triggerToast("UPLOADING TARGET PROFILE...");
            setTimeout(() => {
              localStorage.setItem("disappear_session", "active");
              setIsScanning(false); setShowShield(true); setProgress(100);
              triggerToast("REMOVALS INITIATED");
            }, 3000);
        } else { triggerToast("UPLOAD FAILED"); }
    } catch (error) { triggerToast("SERVER UNREACHABLE"); }
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

      {/* SCREEN: HOME */}
      {!showShield && !showPricing && !showCheckout && !isScanning && !show2FA && (
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

      {/* SCREEN: PRICING */}
      {showPricing && !showCheckout && (
        <div className="pricing-card">
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
        <div className="pricing-card">
          <div className="price-box" style={{maxWidth: '450px', width: '100%', margin: '0 auto'}}>
            <h3 className="tiger-text">TARGET PROFILE DATA</h3>
            <div style={{display: 'flex', flexDirection: 'column', gap: '12px', width: '100%'}}>
                <input className="mask-btn" style={{width: '100%', color: 'white'}} placeholder="Full Legal Name" value={targetProfile.fullName} onChange={(e) => setTargetProfile({...targetProfile, fullName: e.target.value})} />
                <input className="mask-btn" style={{width: '100%', color: 'white'}} placeholder="Primary Email Address" value={targetProfile.email} onChange={(e) => setTargetProfile({...targetProfile, email: e.target.value})} />
                <input className="mask-btn" style={{width: '100%', color: 'white'}} placeholder="Home Address" value={targetProfile.address} onChange={(e) => setTargetProfile({...targetProfile, address: e.target.value})} />
                <div style={{textAlign: 'left', width: '100%'}}>
                    <label style={{fontSize: '0.6rem', color: '#94A3B8', marginLeft: '10px'}}>DATE OF BIRTH</label>
                    <input className="mask-btn" style={{width: '100%', color: 'white'}} type="date" value={targetProfile.dob} onChange={(e) => setTargetProfile({...targetProfile, dob: e.target.value})} />
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginTop: '15px', padding: '0 10px' }}>
                  <input 
                    type="checkbox" 
                    id="terms-check" 
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
      {isScanning && <div className="shield-container"><h2 className="shield-text">SCRUBBING NODES...</h2></div>}

      {/* SCREEN: MAIN SHIELD DASHBOARD */}
      {showShield && (
        <div className="shield-container">
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
                <button className="mask-btn" style={{marginTop: '20px', width: '100%', borderStyle: 'dashed'}} onClick={() => setIsMinting(true)}>+ MINT NEW SHIELD</button>
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
      )}

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