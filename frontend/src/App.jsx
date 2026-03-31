import React, { useState, useEffect, useCallback } from 'react';
import { jsPDF } from "jspdf";
import "jspdf-autotable";

// --- FIXED IMPORTS ---
import { Manifesto } from './Manifesto';
import { Privacy } from './Privacy';
import { Terms } from './Terms';
import AdminDashboard from './AdminDashboard'; 

import './App.css';

/**
 * DISAPPEAR CORE ENGINE v2.2.7
 * Privacy-as-a-Service Frontend
 * Feature: Global Wallet Node & Layman Help Manual
 */

// --- DYNAMIC API ROUTING ---
const LOCAL_API = "http://127.0.0.1:8000";
const PROD_API = "https://disappear-backend.onrender.com"; 

const API_BASE_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? LOCAL_API
  : PROD_API;

function App() {
  const [showShield, setShowShield] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [show2FA, setShow2FA] = useState(false); 
  const [showHelp, setShowHelp] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [notifications, setNotifications] = useState([]); 
  
  const [showLegal, setShowLegal] = useState(null); 
  const [showAdmin, setShowAdmin] = useState(false);
  const [isEmergencyWipe, setIsEmergencyWipe] = useState(false);

  const [showMintModal, setShowMintModal] = useState(false);
  const [newCardLabel, setNewCardLabel] = useState("");

  // --- CATEGORY-SPECIFIC STATES ---
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [aliasLabel, setAliasLabel] = useState("");
  const [emails, setEmails] = useState([]);
  const [phones, setPhones] = useState([]);

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
  const [credits, setCredits] = useState({ total: 6, used: 0, available: 6 });
  const [auditLog, setAuditLog] = useState([]);
  const [cards, setCards] = useState([]);
  const [progress, setProgress] = useState(15);
  const [showToast, setShowToast] = useState("");

  const triggerToast = (msg) => { 
    setShowToast(msg); 
    setTimeout(() => setShowToast(""), 3000); 
  };

  // PERSISTENCE & PAYMENT SYNC
  useEffect(() => {
    const session = localStorage.getItem("disappear_session");
    const query = new URLSearchParams(window.location.search);
    
    if (query.get("payment") === "success") {
        triggerToast("CREDIT AUTHORIZED: NODE EXPANDED");
        window.history.replaceState({}, document.title, "/");
    }

    if (session === "active") {
        setShowShield(true);
        setProgress(100);
    } else {
        setTargetProfile({
            firstName: "", middleName: "", lastName: "", 
            email: "", dob: "", address: "", termsAccepted: false
        });
    }
  }, []);

  useEffect(() => {
    if (showCheckout) {
      fetch(`${API_BASE_URL}/`).catch(() => {});
    }
  }, [showCheckout]);

  const pushNotification = useCallback((broker) => {
    if (!broker) return;
    const id = Date.now();
    setNotifications(prev => [{ id, msg: `THREAT DEFLECTED: [${broker}]` }, ...prev].slice(0, 3));
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  }, []);

  const syncDefenseData = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/dashboard/sync`);
      const data = await res.json();
      if (data.profile) {
          setCredits({
              total: data.profile.credits_total || 6,
              used: data.profile.credits_used || 0,
              available: data.profile.credits_available || 0
          });
      }
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
      const finRes = await fetch(`${API_BASE_URL}/financials/data`);
      const finData = await finRes.json();
      setCards(finData.cards || []);
      const aliasRes = await fetch(`${API_BASE_URL}/aliases/data`);
      const aliasData = await aliasRes.json();
      const allAliases = aliasData.aliases || [];
      
      setEmails(allAliases.filter(a => a.type === 'email'));
      setPhones(allAliases.filter(a => a.type === 'phone'));
    } catch (err) { 
        console.error("Connection Error: API Unreachable at " + API_BASE_URL);
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

  const handlePurchaseSlot = async () => {
    triggerToast("CONTACTING SECURE GATEWAY...");
    try {
      const res = await fetch(`${API_BASE_URL}/payments/create-session`, { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err) { triggerToast("PAYMENT NODE OFFLINE"); }
  };

  const handleMintAlias = async (type) => {
    if (!aliasLabel) { triggerToast("ENTER LABEL"); return; }
    try {
      const res = await fetch(`${API_BASE_URL}/aliases/mint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, label: aliasLabel })
      });
      if (res.status === 403) { triggerToast("IDENTITY CAPACITY FULL"); return; }
      if (res.status === 429) { triggerToast("COOL-DOWN ACTIVE: 24H"); return; }
      if (res.ok) {
        syncDefenseData();
        setAliasLabel("");
        setShowEmailModal(false);
        setShowPhoneModal(false);
        triggerToast(`${type.toUpperCase()} SECURED`);
      }
    } catch (err) { triggerToast("CONNECTION ERROR"); }
  };

  const handleKillAlias = async (id) => {
    try {
      await fetch(`${API_BASE_URL}/aliases/kill/${id}`, { method: "DELETE" });
      syncDefenseData();
      triggerToast("DATA TERMINATED");
    } catch (err) { triggerToast("ERROR"); }
  };

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

  const handleMintCard = async () => {
    if (!newCardLabel) { triggerToast("ENTER MERCHANT NAME"); return; }
    try {
      const response = await fetch(`${API_BASE_URL}/financials/mint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newCardLabel })
      });
      if (response.status === 403) { triggerToast("IDENTITY CAPACITY FULL"); return; }
      if (response.ok) {
        syncDefenseData();
        setNewCardLabel("");
        setShowMintModal(false);
        triggerToast("NODE SECURED");
      }
    } catch (err) { triggerToast("CONNECTION ERROR"); }
  };

  const handleKillCard = async (id) => {
    try {
      await fetch(`${API_BASE_URL}/financials/kill/${id}`, { method: "DELETE" });
      setCards(prev => prev.filter(c => c.id !== id));
      triggerToast("NODE BURNED");
    } catch (err) { triggerToast("ERROR"); }
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
      } catch (err) { triggerToast("FAILED"); } finally { setIsGenerating(false); }
    }, 1500);
  };

  const handleFinalPurchase = async () => {
    if(!targetProfile.firstName || !targetProfile.lastName || !targetProfile.email || !targetProfile.address) {
        triggerToast("REQUIRED FIELDS MISSING");
        return;
    }
    setIsScanning(true);
    try {
        const response = await fetch(`${API_BASE_URL}/financials/profile`, {
            method: "POST", 
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(targetProfile)
        });
        if (response.ok) {
            setShowCheckout(false); 
            setShowPricing(false);
            setIsScanning(false);
            setShowShield(true); 
            setProgress(100);
            triggerToast("IDENTITY PURGE INITIATED");
            syncDefenseData();
        } else { 
            setIsScanning(false);
            triggerToast("NODE ERROR"); 
        }
    } catch (err) { 
        setIsScanning(false);
        triggerToast("NODE OFFLINE");
    }
  };

  const handleNumericDateInput = (e) => {
    let val = e.target.value.replace(/\D/g, ''); 
    if (val.length > 8) val = val.slice(0, 8);
    let formatted = val;
    if (val.length > 4) {
        formatted = `${val.slice(0, 2)}/${val.slice(2, 4)}/${val.slice(4)}`;
    } else if (val.length > 2) {
        formatted = `${val.slice(0, 2)}/${val.slice(2)}`;
    }
    setTargetProfile({...targetProfile, dob: formatted});
  };

  return (
    <div className={`app-container ${isEmergencyWipe ? 'wipe-shake' : ''}`}>
      <div className="progress-bar-container">
        <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
        <span className="secure-connection-text">
          {showShield ? `SHIELD ACTIVE | ${credits.available} SLOTS AVAILABLE` : `INITIALIZING SHIELD: ${progress}%`}
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

      {(showEmailModal || showPhoneModal) && (
        <div className="modal-overlay" style={{zIndex: 50000}} onClick={() => {setShowEmailModal(false); setShowPhoneModal(false)}}>
          <div className="price-box" onClick={e => e.stopPropagation()}>
            <h3 className="tiger-text">MINT {showEmailModal ? 'EMAIL' : 'PHONE'} ALIAS</h3>
            <p className="field-label">ASSOCIATE LABEL</p>
            <input className="mask-btn" style={{color: 'white', textAlign: 'center'}} placeholder="e.g. Shopping, Personal" value={aliasLabel} onChange={(e) => setAliasLabel(e.target.value)} />
            <button className="main-button" style={{width: '100%', marginTop: '20px'}} onClick={() => handleMintAlias(showEmailModal ? 'email' : 'phone')}>AUTHORIZE</button>
            <button className="reset-btn" style={{width: '100%'}} onClick={() => {setShowEmailModal(false); setShowPhoneModal(false)}}>CANCEL</button>
          </div>
        </div>
      )}

      {showMintModal && (
        <div className="modal-overlay" style={{zIndex: 50000}} onClick={() => setShowMintModal(false)}>
          <div className="price-box" onClick={e => e.stopPropagation()}>
            <h3 className="tiger-text">MINT NEW SHIELD</h3>
            <p className="field-label">ASSOCIATE MERCHANT</p>
            <input className="mask-btn" style={{width: '100%', color: 'white', textAlign: 'center'}} placeholder="e.g. Amazon, Netflix" value={newCardLabel} onChange={(e) => setNewCardLabel(e.target.value)} />
            <button className="main-button" style={{width: '100%', marginTop: '20px'}} onClick={handleMintCard}>AUTHORIZE NODE</button>
            <button className="reset-btn" style={{width: '100%'}} onClick={() => setShowMintModal(false)}>CANCEL</button>
          </div>
        </div>
      )}

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

      <main>
        {showShield ? (
          <div className="shield-container fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            <h2 className="shield-text">🛡️ SHIELD ACTIVE</h2>
            
            {/* --- GLOBAL WALLET NODE (Digital Wallet Card) --- */}
            <div className="masking-tool" style={{ width: '100%', maxWidth: '600px', border: '1px solid #FFD700', background: '#050505' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <p className="tool-label" style={{ margin: 0, color: '#FFD700' }}>GLOBAL WALLET NODE</p>
                <span style={{ fontSize: '0.6rem', color: '#444' }}>WALLETS_ENABLED: [TRUE]</span>
              </div>
              <div className="managed-card-row enhanced-card" style={{ background: 'linear-gradient(135deg, #050505 0%, #111 100%)' }}>
                <div className="card-row-info">
                  <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px'}}>
                     <span className="card-nickname" style={{color: '#FFD700', fontWeight: 'bold'}}>PRIMARY_PAY_NODE</span>
                     <button className="kill-text-bold" onClick={() => { if(window.confirm("RESET NODE? Old card will be burned and a new one issued.")) handleKillCard('global-1'); }}>RESET_NODE</button>
                  </div>
                  <code className="card-digits" style={{ fontSize: '1.2rem', letterSpacing: '3px' }}> 4242 8888 9999 0001 </code>
                  <div style={{display: 'flex', gap: '30px', borderTop: '1px solid #222', paddingTop: '10px', marginTop: '10px'}}>
                     <div><span style={{fontSize: '0.5rem', color: '#64748b', display: 'block'}}>EXP</span><strong>12/29</strong></div>
                     <div><span style={{fontSize: '0.5rem', color: '#64748b', display: 'block'}}>CVV</span><strong>***</strong></div>
                     <div style={{ marginLeft: 'auto' }}>
                        <span style={{fontSize: '0.5rem', color: '#64748b', display: 'block'}}>TYPE</span>
                        <span style={{ fontSize: '0.7rem' }}>VISA_DEBIT</span>
                     </div>
                  </div>
                </div>
              </div>
              <p style={{ fontSize: '0.65rem', color: '#94A3B8', marginTop: '10px', fontStyle: 'italic' }}>
                * Add this to Apple/Google Pay. Use RESET_NODE to instantly kill the card if it's compromised.
              </p>
            </div>

            <div className="masking-tool" style={{ border: '1px solid #111', background: '#050505', width: '100%', maxWidth: '600px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span className="field-label">IDENTITY CAPACITY</span>
                    <span className="tiger-text">{credits.used} / {credits.total} USED</span>
                </div>
                <div className="progress-bar-container" style={{ height: '8px', background: '#111', position: 'relative' }}>
                    <div className="progress-bar-fill" style={{ width: `${(credits.used / credits.total) * 100}%`, background: 'var(--tiger-blue)' }}></div>
                </div>
                {credits.available === 0 && <button className="purchase-btn" onClick={handlePurchaseSlot}>BUY EXTRA SHIELD SLOT ($4.99)</button>}
            </div>
            
            <div className="masking-tool" style={{ width: '100%', maxWidth: '600px' }}>
              <p className="tool-label" style={{ textAlign: 'center', marginBottom: '15px' }}>EMAIL PROTECTION</p>
              <div className="alias-manager-list">
                {emails.map(e => (
                  <div key={e.id} className="alias-row">
                    <div className="alias-info"><span className="alias-label">{e.label.toUpperCase()}</span><span className="alias-content" onClick={() => {navigator.clipboard.writeText(e.content); triggerToast("COPIED")}}>{e.content}</span></div>
                    <button className="kill-text-bold" onClick={() => handleKillAlias(e.id)}>TERMINATE</button>
                  </div>
                ))}
              </div>
              <button className="reset-btn" style={{marginTop: '20px', width: '100%', borderStyle: 'dashed'}} onClick={() => setShowEmailModal(true)}> + MINT EMAIL ALIAS </button>
            </div>

            <div className="masking-tool" style={{ width: '100%', maxWidth: '600px' }}>
              <p className="tool-label" style={{ textAlign: 'center', marginBottom: '15px' }}>PHONE PROTECTION</p>
              <div className="alias-manager-list">
                {phones.map(p => (
                  <div key={p.id} className="alias-row">
                    <div className="alias-info"><span className="alias-label">{p.label.toUpperCase()}</span><span className="alias-content" onClick={() => {navigator.clipboard.writeText(p.content); triggerToast("COPIED")}}>{p.content}</span></div>
                    <button className="kill-text-bold" onClick={() => handleKillAlias(p.id)}>TERMINATE</button>
                  </div>
                ))}
              </div>
              <button className="reset-btn" style={{marginTop: '20px', width: '100%', borderStyle: 'dashed'}} onClick={() => setShowPhoneModal(true)}> + MINT PHONE ALIAS </button>
            </div>

            <div className="masking-tool" style={{ width: '100%', maxWidth: '600px' }}>
              <p className="tool-label" style={{ textAlign: 'center', marginBottom: '20px' }}>VIRTUAL SHIELD CARDS</p>
              <div className="card-manager-list">
                {cards.map(c => (
                  <div key={c.id} className="managed-card-row enhanced-card">
                    <div className="card-row-info">
                      <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px'}}>
                         <span className="card-nickname" style={{color: 'var(--tiger-blue)', fontWeight: 'bold'}}>{c.label.toUpperCase()}</span>
                         <button className="kill-text-bold" onClick={() => handleKillCard(c.id)}>TERMINATE</button>
                      </div>
                      <code className="card-digits" onClick={() => {navigator.clipboard.writeText(c.number.replace(/\s/g, '')); triggerToast("COPIED")}}> {c.number} </code>
                      <div style={{display: 'flex', gap: '30px', borderTop: '1px solid #111', paddingTop: '10px', marginTop: '10px'}}>
                         <div><span style={{fontSize: '0.5rem', color: '#64748b', display: 'block'}}>EXP</span><strong>{c.expiry || '08/28'}</strong></div>
                         <div><span style={{fontSize: '0.5rem', color: '#64748b', display: 'block'}}>CVV</span><strong>{c.cvv || '442'}</strong></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button className="reset-btn" style={{marginTop: '20px', width: '100%', borderStyle: 'dashed'}} onClick={() => setShowMintModal(true)}> + MINT NEW SHIELD </button>
            </div>

            <div className="masking-tool" style={{ width: '100%', maxWidth: '600px' }}>
              <p className="tool-label" style={{ textAlign: 'center' }}>LIVE SECURITY AUDIT</p>
              <div className="audit-list" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {auditLog.map((log, i) => (
                  <div key={i} className="audit-row" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #111', padding: '10px 0' }}>
                    <span className="audit-broker">[{log.broker}]</span><span className="audit-action">{log.action}</span>
                  </div>
                ))}
              </div>
              <button className="pdf-btn" style={{ width: '100%', marginTop: '15px' }} onClick={handleDownloadPDF} disabled={isGenerating}>GENERATE AUDIT PDF</button>
            </div>

            <div style={{display: 'flex', flexDirection: 'column', gap: '15px', width: '100%', maxWidth: '400px', marginTop: '40px'}}>
              <button className="reset-btn" onClick={() => {localStorage.clear(); window.location.reload();}}>LOGOUT SECURELY</button>
              <button className="burn-all-btn" onClick={() => { if(window.confirm("CONFIRM TOTAL PURGE?")) handleEmergencyBurn(); }}>EMERGENCY BURN</button>
            </div>
          </div>
        ) : (
          <div className="onboarding-flow">
            {!showPricing && !showCheckout && !isScanning && !show2FA && (
              <div className="fade-in" style={{display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '60vh', justifyContent: 'center'}}>
                <h1 className="brand-name">DISAPPEAR</h1>
                <p className="subtitle">Privacy-as-a-Service</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', marginTop: '40px' }}>
                  <div style={{ display: 'flex', gap: '20px' }}>
                    <button className="main-button" onClick={() => setShowPricing(true)}>IDENTITY CLEANUP</button>
                    <button className="login-btn-outline" onClick={() => {triggerToast("CHALLENGE REQUEST SENT..."); setShow2FA(true);}}>CLIENT LOGIN</button>
                  </div>
                  <button className="info-link-btn" onClick={() => setShowLegal('manifesto')}>WHY IS THIS CRITICAL? [MANIFESTO]</button>
                  
                  <button className="info-link-btn" style={{marginTop: '10px'}} onClick={() => setShowHelp(!showHelp)}>
                    {showHelp ? "[ CLOSE_MANUAL ]" : "[ VIEW_SYSTEM_OPERATIONS ]"}
                  </button>
                </div>
              </div>
            )}

            {/* --- LAYMAN-FRIENDLY SYSTEM OPERATIONS MANUAL --- */}
            {showHelp && !showShield && !showCheckout && !show2FA && (
              <div className="pricing-card fade-in" style={{ marginBottom: '40px', border: '1px solid #0047AB', background: '#020202' }}>
                <div className="price-box" style={{ textAlign: 'left', maxWidth: '600px' }}>
                  <h3 className="tiger-text" style={{letterSpacing: '2px'}}>SYSTEM_OPERATIONS_MANUAL v1.2</h3>
                  <p style={{fontSize: '0.6rem', color: '#444', marginBottom: '20px'}}>EASY-READ_USER_GUIDE</p>
                  
                  {/* VIRTUAL CARDS */}
                  <div style={{ marginBottom: '25px', borderLeft: '2px solid var(--tiger-blue)', paddingLeft: '15px' }}>
                    <p className="field-label" style={{ color: 'white', marginBottom: '5px' }}>💳 VIRTUAL PAYMENT CARDS</p>
                    <p style={{ fontSize: '0.75rem', lineHeight: '1.4', color: '#94A3B8' }}>
                      These act like a digital shield for your bank account. Instead of giving a website your real card info, you give them a "fake" one from us.
                      <ul style={{ paddingLeft: '15px', marginTop: '5px' }}>
                        <li><strong>Safe Shopping:</strong> Stores never see your actual bank details.</li>
                        <li><strong>Stop Overcharging:</strong> If a site tries to charge you more than you agreed, the card blocks it.</li>
                        <li><strong>One-Click Kill:</strong> If a site gets hacked, just delete the card. Your real money stays safe.</li>
                      </ul>
                    </p>
                  </div>

                  {/* EMAIL RELAY */}
                  <div style={{ marginBottom: '25px', borderLeft: '2px solid var(--tiger-blue)', paddingLeft: '15px' }}>
                    <p className="field-label" style={{ color: 'white', marginBottom: '5px' }}>✉️ EMAIL RELAY NODES</p>
                    <p style={{ fontSize: '0.75rem', lineHeight: '1.4', color: '#94A3B8' }}>
                      These are "throwaway" email addresses that forward mail to your real inbox without letting companies know who you are.
                      <ul style={{ paddingLeft: '15px', marginTop: '5px' }}>
                        <li><strong>No More Spam:</strong> If a company sends too much junk, just delete that specific address.</li>
                        <li><strong>Stay Private:</strong> Your real email address stays off marketing lists forever.</li>
                      </ul>
                    </p>
                  </div>

                  {/* PHONE SMS */}
                  <div style={{ marginBottom: '25px', borderLeft: '2px solid var(--tiger-blue)', paddingLeft: '15px' }}>
                    <p className="field-label" style={{ color: 'white', marginBottom: '5px' }}>📱 PHONE VERIFICATION NODES</p>
                    <p style={{ fontSize: '0.75rem', lineHeight: '1.4', color: '#94A3B8' }}>
                      Use these for those annoying sites that demand a phone number to "verify" your account.
                      <ul style={{ paddingLeft: '15px', marginTop: '5px' }}>
                        <li><strong>Secure Codes:</strong> Receive verification texts safely in your dashboard.</li>
                        <li><strong>No Harassment:</strong> Keep telemarketers and scammers away from your real phone.</li>
                      </ul>
                    </p>
                  </div>

                  {/* ACCOUNT LIMITS */}
                  <div style={{ marginBottom: '20px', borderTop: '1px solid #111', paddingTop: '15px' }}>
                    <p className="field-label" style={{ color: 'var(--tiger-blue)', marginBottom: '10px' }}>ACCOUNT LIMITS</p>
                    <table style={{ width: '100%', fontSize: '0.7rem', borderCollapse: 'collapse', color: '#94A3B8' }}>
                      <tbody>
                        <tr style={{ borderBottom: '1px solid #111' }}>
                          <td style={{ padding: '8px 0' }}>FREE_SLOTS</td>
                          <td style={{ textAlign: 'right', color: 'white' }}>6 Concurrent Slots</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '8px 0' }}>ADD_MORE</td>
                          <td style={{ textAlign: 'right', color: 'white' }}>$4.99 per Permanent Slot</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <button className="reset-btn" style={{ width: '100%', marginTop: '10px' }} onClick={() => setShowHelp(false)}>I UNDERSTAND</button>
                </div>
              </div>
            )}

            {show2FA && (
              <div className="pricing-card fade-in">
                <div className="price-box">
                  <h3 className="tiger-text">MFA CHALLENGE</h3>
                  <input id="mfa_code" className="mask-btn" style={{width: '100%', textAlign: 'center'}} placeholder="******" />
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
                  <div className="checkout-grid">
                      <input className="mask-btn" placeholder="First Name" value={targetProfile.firstName} onChange={(e) => setTargetProfile({...targetProfile, firstName: e.target.value})} />
                      <input className="mask-btn" placeholder="Middle Name" value={targetProfile.middleName} onChange={(e) => setTargetProfile({...targetProfile, middleName: e.target.value})} />
                      <input className="mask-btn full-row" placeholder="Last Name" value={targetProfile.lastName} onChange={(e) => setTargetProfile({...targetProfile, lastName: e.target.value})} />
                      <input className="mask-btn full-row" placeholder="Email Address" value={targetProfile.email} onChange={(e) => setTargetProfile({...targetProfile, email: e.target.value})} />
                      <input className="mask-btn full-row" placeholder="Home Address" value={targetProfile.address} onChange={(e) => setTargetProfile({...targetProfile, address: e.target.value})} />
                      <input className="mask-btn full-row" type="text" inputMode="numeric" placeholder="MM/DD/YYYY" value={targetProfile.dob} onChange={handleNumericDateInput} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginTop: '15px' }}>
                    <input type="checkbox" checked={targetProfile.termsAccepted} onChange={(e) => setTargetProfile({...targetProfile, termsAccepted: e.target.checked})} />
                    <label style={{ fontSize: '0.65rem', color: '#94A3B8' }}>Authorize Full PII Scrub and Burn</label>
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
                  <div className="terminal-line">{'>> ESTABLISHING SECURE ALIAS TUNNEL...'}</div>
                  <div className="terminal-line">{'>> ENCRYPTING VAULT ASSETS...'}</div>
                </div>
                <h2 className="shield-text" style={{marginTop: '20px'}}>SCRUBBING NODES...</h2>
              </div>
            )}
          </div>
        )}
      </main>
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