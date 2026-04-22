import React, { useState, useEffect, useCallback } from 'react';
import { jsPDF } from "jspdf";
import "jspdf-autotable";

// --- FIXED IMPORTS ---
import { Manifesto } from './Manifesto';
import { Privacy } from './Privacy';
import { Terms } from './Terms';
import AdminDashboard from './AdminDashboard'; 
import LandingPage from './LandingPage'; // Integration: Authority Website Layer

import './App.css';

/**
 * DISAPPEAR CORE ENGINE
 * Refactor: Separated Marketing Intelligence + Secure Vault Gateway
 * Feature: Full Doctrine Integration & Instruction Authority
 */

// --- DYNAMIC API ROUTING ---
const LOCAL_API = "http://127.0.0.1:8000";
const PROD_API = "https://disappear-backend.onrender.com"; 

const API_BASE_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? LOCAL_API
  : PROD_API;

function App() {
  // --- CORE VIEW NAVIGATION (UPDATED) ---
  const [showLanding, setShowLanding] = useState(true); 
  const [showShield, setShowShield] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [show2FA, setShow2FA] = useState(false); 
  const [showHelp, setShowHelp] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEncrypting, setIsEncrypting] = useState(false); 
  const [purgeStatus, setPurgeStatus] = useState(""); 
  const [isProcessingPayment, setIsProcessingPayment] = useState(false); 
  const [notifications, setNotifications] = useState([]); 
  
  const [showLegal, setShowLegal] = useState(null); 
  const [showAdmin, setShowAdmin] = useState(false);
  const [isEmergencyWipe, setIsEmergencyWipe] = useState(false);

  const [showMintModal, setShowMintModal] = useState(false);
  const [newCardLabel, setNewCardLabel] = useState("");

  // --- SUPPORT & FAQ STATES ---
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showFaqModal, setShowFaqModal] = useState(false); 
  const [activeFaqNode, setActiveFaqNode] = useState(null);
  const [supportData, setSupportData] = useState({ subject: "TECHNICAL_ERR", message: "" });

  // --- CATEGORY-SPECIFIC STATES ---
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [aliasLabel, setAliasLabel] = useState("");
  const [emails, setEmails] = useState([]);
  const [phones, setPhones] = useState([]);

  const [targetProfile, setTargetProfile] = useState({
    firstName: "", middleName: "", lastName: "", 
    email: "", dob: "", address: "", termsAccepted: false
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
        syncDefenseData();
    }

    if (session === "active") {
        setShowLanding(false); // Bypass website for active agents
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

  const pushNotification = useCallback((msg) => {
    if (!msg) return;
    const id = `notif-${Date.now()}-${Math.random()}`; 
    setNotifications(prev => [{ id, msg: msg.includes(':') ? msg : `SYSTEM_EVENT: [${msg}]` }, ...prev].slice(0, 3));
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
                pushNotification(`THREAT DEFLECTED: [${latest.broker}]`);
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
        console.error("Connection Error: API Unreachable");
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

  const handlePurchaseExpansion = async (type) => {
    if (isProcessingPayment) return;
    setIsProcessingPayment(true);
    const msg = type === 'phone' ? "REQUESTING SECURE LINE..." : "EXPANDING VAULT CAPACITY...";
    triggerToast(msg);
    try {
      const res = await fetch(`${API_BASE_URL}/payments/create-session`, { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expansion_type: type })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("Handshake failed");
      }
    } catch (err) { 
      triggerToast("PAYMENT NODE OFFLINE"); 
      setIsProcessingPayment(false);
    }
  };

  const handleSendTicket = async () => {
    if (!supportData.message) { triggerToast("ENTER MESSAGE"); return; }
    try {
        const res = await fetch(`${API_BASE_URL}/support/ticket`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(supportData)
        });
        if (res.ok) {
            triggerToast("TICKET TRANSMITTED");
            setSupportData({ subject: "TECHNICAL_ERR", message: "" });
            setShowSupportModal(false);
        }
    } catch (err) { triggerToast("UPLINK FAILURE"); }
  };

  const handleMintAlias = async (type) => {
    if (!aliasLabel) { triggerToast("ENTER LABEL"); return; }
    if (type === 'phone' && phones.length >= 2) {
      triggerToast("PHONE CAPACITY REACHED [MAX 2]");
      return;
    }
    setPurgeStatus(`ENCRYPTING ${type.toUpperCase()}...`);
    setIsEncrypting(true); 
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
    finally { setIsEncrypting(false); setPurgeStatus(""); } 
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
    setIsEncrypting(true);
    setPurgeStatus("TOTAL PURGE IN EFFECT...");
    pushNotification("GLOBAL_NODE_SHUTDOWN");
    try {
      await fetch(`${API_BASE_URL}/financials/receipt`, { method: "POST" });
      pushNotification("S3_AUDIT_STORED");
      setTimeout(async () => {
        setPurgeStatus("TERMINATING ALL ACTIVE NODES...");
        await fetch(`${API_BASE_URL}/financials/burn-all`, { method: "POST" });
        pushNotification("DATABASE_SCRUB_COMPLETE");
        setTimeout(() => {
          setPurgeStatus("PURGE COMPLETED. VAULT IS CLEAN.");
          pushNotification("SESSION_TERMINATING");
          setIsEmergencyWipe(false); 
          setTimeout(() => {
            localStorage.clear();
            window.location.reload();
          }, 3000); 
        }, 1500);
      }, 1500);
    } catch (err) { 
      triggerToast("PURGE ERROR"); 
      setIsEmergencyWipe(false); 
      setIsEncrypting(false);
    }
  };

  const handleMintCard = async () => {
    if (!newCardLabel) { triggerToast("ENTER MERCHANT NAME"); return; }
    setPurgeStatus("GENERATING PROTECTED DIGITS...");
    setIsEncrypting(true); 
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
    finally { setIsEncrypting(false); setPurgeStatus(""); } 
  };

  const handleKillCard = async (id) => {
    try {
      await fetch(`${API_BASE_URL}/financials/kill/${id}`, { method: "DELETE" });
      if (id !== 'global-1') {
        setCards(prev => prev.filter(c => c.id !== id));
      }
      triggerToast(id === 'global-1' ? "NODE ROTATED" : "NODE BURNED");
    } catch (err) { triggerToast("ERROR"); }
  };

  const verify2FA = () => {
    triggerToast("AUTHENTICATING...");
    setTimeout(() => {
      localStorage.setItem("disappear_session", "active");
      setShow2FA(false); 
      setShowLanding(false); // Switch to app
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
            setShowLanding(false);
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

  const handleManageBilling = async () => {
    triggerToast("UPLINKING TO STRIPE PORTAL...");
    try {
        const res = await fetch(`${API_BASE_URL}/payments/customer-portal`, { method: "POST" });
        const data = await res.json();
        if (data.url) window.location.href = data.url;
    } catch (err) { triggerToast("PORTAL OFFLINE"); }
  };

  return (
    <div className={`app-container ${isEmergencyWipe ? 'wipe-shake' : ''}`}>
      
      {/* 1. SEPARATE MARKETING WEBSITE (Intelligence Hub) */}
      {showLanding ? (
        <LandingPage 
          onEnterVault={() => setShowLanding(false)} 
          onLoginRequest={() => { setShowLanding(false); setShow2FA(true); }}
        />
      ) : (
        <>
          {/* 2. CORE APP HEADER */}
          <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
            <span className="secure-connection-text">
              {showShield ? `SHIELD ACTIVE | ELITE OPERATIVE` : `INITIALIZING SHIELD: ${progress}%`}
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

          {/* --- INTERACTIVE FAQ MODAL --- */}
          {showFaqModal && (
            <div className="modal-overlay" style={{zIndex: 70000}} onClick={() => setShowFaqModal(false)}>
              <div className="price-box" style={{maxWidth: '650px', textAlign: 'left', overflowY: 'auto', maxHeight: '85vh'}} onClick={e => e.stopPropagation()}>
                <h3 className="tiger-text">FAQ</h3>
                <p className="field-label" style={{marginBottom: '20px'}}>SELECT NODE FOR INTELLIGENCE</p>

                <div className="faq-item" onClick={() => setActiveFaqNode(activeFaqNode === 'global' ? null : 'global')} style={{cursor: 'pointer', borderBottom: '1px solid #111', padding: '15px 0'}}>
                    <div className="faq-trigger" style={{color: '#FFD700', fontWeight: 'bold'}}>
                      {activeFaqNode === 'global' ? '[-] GLOBAL WALLET NODE' : '[+] GLOBAL WALLET NODE'}
                    </div>
                    {activeFaqNode === 'global' && (
                        <div className="faq-content fade-in" style={{fontSize: '0.8rem', color: '#94A3B8', marginTop: '10px', paddingLeft: '10px', borderLeft: '2px solid #FFD700'}}>
                            <p><strong>USAGE:</strong> Best for high-trust merchants and in-person Digital Wallet (Apple/Google Pay) usage.</p>
                            <strong style={{color: 'white', display: 'block', marginTop: '10px'}}>OPERATION STEPS:</strong>
                            <ol style={{paddingLeft: '15px'}}>
                                <li>Retrieve digits from the 'GLOBAL WALLET NODE' module at the top of your dashboard.</li>
                                <li>Add the 16-digit card number, EXP, and CVV to your smartphone wallet.</li>
                                <li><strong>CORE ARCHITECTURE:</strong> This is a multi-merchant node. Use it for general recurring trust-based purchases.</li>
                                <li>Click 'RESET NODE' if you believe merchant processors have logged the card info.</li>
                            </ol>
                        </div>
                    )}
                </div>

                <div className="faq-item" onClick={() => setActiveFaqNode(activeFaqNode === 'vcc' ? null : 'vcc')} style={{cursor: 'pointer', borderBottom: '1px solid #111', padding: '15px 0'}}>
                    <div className="faq-trigger" style={{color: 'var(--tiger-blue)', fontWeight: 'bold'}}>
                      {activeFaqNode === 'vcc' ? '[-] CREDIT CARD PROTECTION' : '[+] CREDIT CARD PROTECTION'}
                    </div>
                    {activeFaqNode === 'vcc' && (
                        <div className="faq-content fade-in" style={{fontSize: '0.8rem', color: '#94A3B8', marginTop: '10px', paddingLeft: '10px', borderLeft: '1px solid var(--tiger-blue)'}}>
                            <p><strong>USAGE:</strong> Best for individual subscriptions and untrusted merchant endpoints.</p>
                            <strong style={{color: 'white', display: 'block', marginTop: '10px'}}>OPERATION STEPS:</strong>
                            <ol style={{paddingLeft: '15px'}}>
                                <li>Click 'GENERATE CARD PROTECTION' and label it (e.g., Netflix).</li>
                                <li>System provides isolated digits for that specific merchant.</li>
                                <li><strong>THE DIFFERENCE:</strong> Once used, this node "locks" to that merchant. If they are hacked, these digits are worthless anywhere else.</li>
                            </ol>
                        </div>
                    )}
                </div>

                <div className="faq-item" onClick={() => {setActiveFaqNode(activeFaqNode === 'email' ? null : 'email')}} style={{cursor: 'pointer', borderBottom: '1px solid #111', padding: '15px 0'}}>
                    <div className="faq-trigger" style={{color: 'var(--tiger-blue)', fontWeight: 'bold'}}>
                      {activeFaqNode === 'email' ? '[-] EMAIL RELAY NODES' : '[+] EMAIL RELAY NODES'}
                    </div>
                    {activeFaqNode === 'email' && (
                        <div className="faq-content fade-in" style={{fontSize: '0.8rem', color: '#94A3B8', marginTop: '10px', paddingLeft: '10px', borderLeft: '1px solid var(--tiger-blue)'}}>
                            <p><strong>USAGE:</strong> Protects your primary identity from marketing lists and data broker aggregators.</p>
                            <strong style={{color: 'white', display: 'block', marginTop: '10px'}}>OPERATION STEPS:</strong>
                            <ol style={{paddingLeft: '15px'}}>
                                <li>Assign a label (e.g., 'E-Commerce') and click 'GENERATE'.</li>
                                <li>Use the generated address for web registrations.</li>
                                <li>PII trackers are scrubbed before forwarding to your inbox.</li>
                            </ol>
                        </div>
                    )}
                </div>

                <div className="faq-item" onClick={() => setActiveFaqNode(activeFaqNode === 'phone' ? null : 'phone')} style={{cursor: 'pointer', borderBottom: '1px solid #111', padding: '15px 0'}}>
                    <div className="faq-trigger" style={{color: 'var(--tiger-blue)', fontWeight: 'bold'}}>
                      {activeFaqNode === 'phone' ? '[-] SMS VERIFICATION NODES' : '[+] SMS VERIFICATION NODES'}
                    </div>
                    {activeFaqNode === 'phone' && (
                        <div className="faq-content fade-in" style={{fontSize: '0.8rem', color: '#94A3B8', marginTop: '10px', paddingLeft: '10px', borderLeft: '1px solid var(--tiger-blue)'}}>
                            <p><strong>USAGE:</strong> Best for 2FA bypass and anonymous app verifications.</p>
                            <strong style={{color: 'white', display: 'block', marginTop: '10px'}}>OPERATION STEPS:</strong>
                            <ol style={{paddingLeft: '15px'}}>
                                <li>Generate a 'PHONE ALIAS' node.</li>
                                <li>Enter the provided +1 number into the verification field.</li>
                                <li>The incoming code appears instantly in the 'LIVE SECURITY AUDIT' on your dashboard.</li>
                            </ol>
                        </div>
                    )}
                </div>

                <button className="main-button" style={{width: '100%', marginTop: '30px'}} onClick={() => setShowFaqModal(false)}>EXIT FAQ</button>
              </div>
            </div>
          )}

          {/* --- SUPPORT MODAL --- */}
          {showSupportModal && (
            <div className="modal-overlay" style={{zIndex: 60000}} onClick={() => setShowSupportModal(false)}>
              <div className="price-box" onClick={e => e.stopPropagation()}>
                <h3 className="tiger-text">SUPPORT UPLINK</h3>
                <p className="field-label">ISSUE CATEGORY</p>
                <select className="mask-btn" style={{width: '100%', background: '#000', color: 'white', marginBottom: '15px'}} value={supportData.subject} onChange={(e) => setSupportData({...supportData, subject: e.target.value})}>
                  <option value="PAYMENT_ERR">PAYMENT_ISSUE</option>
                  <option value="NODE_ERR">NODE_FAILURE</option>
                  <option value="PURGE_ERR">PURGE_TIMEOUT</option>
                  <option value="OTHER">OTHER_INQUIRY</option>
                </select>
                <textarea className="mask-btn" style={{width: '100%', height: '100px', color: 'white', textAlign: 'left', paddingTop: '10px'}} placeholder="Describe the anomaly..." value={supportData.message} onChange={(e) => setSupportData({...supportData, message: e.target.value})} />
                <button className="main-button" style={{width: '100%', marginTop: '20px'}} onClick={handleSendTicket}>TRANSMIT_TICKET</button>
                <button className="reset-btn" style={{width: '100%'}} onClick={() => setShowSupportModal(false)}>ABORT</button>
              </div>
            </div>
          )}

          {/* --- ALIAS MINTING MODALS --- */}
          {(showEmailModal || showPhoneModal) && (
            <div className="modal-overlay" style={{zIndex: 50000}} onClick={() => {setShowEmailModal(false); setShowPhoneModal(false)}}>
              <div className="price-box" onClick={e => e.stopPropagation()}>
                <h3 className="tiger-text">GENERATE {showEmailModal ? 'EMAIL' : 'PHONE'} ALIAS</h3>
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
                <h3 className="tiger-text">GENERATE CARD PROTECTION</h3>
                <p className="field-label">ASSOCIATE MERCHANT</p>
                <input className="mask-btn" style={{width: '100%', color: 'white', textAlign: 'center'}} placeholder="e.g. Amazon, Netflix" value={newCardLabel} onChange={(e) => setNewCardLabel(e.target.value)} />
                <button className="main-button" style={{width: '100%', marginTop: '20px'}} onClick={handleMintCard}>AUTHORIZE NODE</button>
                <button className="reset-btn" style={{width: '100%'}} onClick={() => setShowMintModal(false)}>CANCEL</button>
              </div>
            </div>
          )}

          {/* --- LEGAL & ADMIN MODALS --- */}
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
              /* 3. SECURE APPLICATION ENGINE (Restored) */
              <div className="shield-container fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                <h2 className="shield-text">🛡️ SHIELD ACTIVE</h2>
                
                <div className="masking-tool" style={{ width: '100%', maxWidth: '600px', border: '1px solid #FFD700', background: '#050505', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <p className="tool-label" style={{ margin: 0, color: '#FFD700' }}>GLOBAL WALLET NODE</p>
                    <span style={{ fontSize: '0.6rem', color: '#444' }}>WALLETS_ENABLED: [TRUE]</span>
                  </div>
                  <div className="managed-card-row enhanced-card" style={{ background: 'linear-gradient(135deg, #050505 0%, #111 100%)' }}>
                    <div className="card-row-info">
                      <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px'}}>
                         <span className="card-nickname" style={{color: '#FFD700', fontWeight: 'bold'}}>PRIMARY_PAY_NODE</span>
                         <button className="kill-text-bold" onClick={() => { if(window.confirm("RESET NODE? Old card will be burned and a new one issued.")) handleKillCard('global-1'); }}>RESET NODE</button>
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
                </div>

                <div className="masking-tool" style={{ border: '1px solid #111', background: '#050505', width: '100%', maxWidth: '600px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <span className="field-label">VAULT CAPACITY (EMAIL/VCC)</span>
                        <span className="tiger-text">{credits.used} / {credits.total}</span>
                    </div>
                    <button className="purchase-btn" onClick={() => handlePurchaseExpansion('data')}>
                      + ADD PERMANENT VAULT SLOT ($4.99)
                    </button>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '25px', marginBottom: '10px' }}>
                        <span className="field-label">ACTIVE PHONE LINES</span>
                        <span className="tiger-text">{phones.length} / 2</span>
                    </div>
                    {phones.length >= 2 && (
                      <button className="purchase-btn" style={{borderColor: 'var(--tiger-blue)'}} onClick={() => handlePurchaseExpansion('phone')}>
                        + PROVISION EXTRA MOBILE LINE ($9.99/mo)
                      </button>
                    )}
                </div>
                
                <div className="masking-tool" style={{ width: '100%', maxWidth: '600px', position: 'relative' }}>
                  <p className="tool-label" style={{ textAlign: 'center', marginBottom: '15px' }}>EMAIL PROTECTION</p>
                  <div className="alias-manager-list">
                    {emails.map((e) => (
                      <div key={e.id} className="alias-row" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '15px' }}>
                        <div className="alias-info" style={{ width: '100%', wordBreak: 'break-all', marginBottom: '10px' }}>
                            <span className="alias-label" style={{ display: 'block', color: 'var(--tiger-blue)', marginBottom: '5px' }}>{e.label.toUpperCase()}</span>
                            <span className="alias-content" style={{ fontSize: '0.85rem' }} onClick={() => {navigator.clipboard.writeText(e.content); triggerToast("COPIED")}}>{e.content}</span>
                        </div>
                        <button className="kill-text-bold" onClick={() => handleKillAlias(e.id)}>TERMINATE_NODE</button>
                      </div>
                    ))}
                  </div>
                  <button className="reset-btn" style={{marginTop: '20px', width: '100%', borderStyle: 'dashed'}} onClick={() => setShowEmailModal(true)}> + GENERATE EMAIL ALIAS </button>
                </div>

                <div className="masking-tool" style={{ width: '100%', maxWidth: '600px', position: 'relative' }}>
                  <p className="tool-label" style={{ textAlign: 'center', marginBottom: '15px' }}>PHONE PROTECTION</p>
                  <div className="alias-manager-list">
                    {phones.map((p) => (
                      <div key={p.id} className="alias-row">
                        <div className="alias-info"><span className="alias-label">{p.label.toUpperCase()}</span><span className="alias-content" onClick={() => {navigator.clipboard.writeText(p.content); triggerToast("COPIED")}}>{p.content}</span></div>
                        <button className="kill-text-bold" onClick={() => handleKillAlias(p.id)}>TERMINATE</button>
                      </div>
                    ))}
                  </div>
                  <button className="reset-btn" style={{marginTop: '20px', width: '100%', borderStyle: 'dashed'}} onClick={() => setShowPhoneModal(true)}> + GENERATE PHONE ALIAS </button>
                </div>

                <div className="masking-tool" style={{ width: '100%', maxWidth: '600px', position: 'relative' }}>
                  <p className="tool-label" style={{ textAlign: 'center', marginBottom: '20px' }}>CREDIT CARD PROTECTION</p>
                  <div className="card-manager-list">
                    {cards.map((c) => (
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
                  <button className="reset-btn" style={{marginTop: '20px', width: '100%', borderStyle: 'dashed'}} onClick={() => setShowMintModal(true)}> + GENERATE CARD PROTECTION </button>
                </div>

                <div className="masking-tool" style={{ width: '100%', maxWidth: '600px', border: '1px solid #444' }}>
                  <p className="tool-label" style={{ textAlign: 'center' }}>SUBSCRIPTION_MANAGEMENT</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <div>
                        <span style={{ fontSize: '0.6rem', color: '#64748b', display: 'block' }}>CURRENT_PLAN</span>
                        <strong style={{ color: 'var(--tiger-blue)' }}>ELITE_OPERATIVE_{billingCycle.toUpperCase()}</strong>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.6rem', color: '#64748b', display: 'block' }}>STATUS</span>
                        <span style={{ color: '#00FF00', fontSize: '0.7rem' }}>[ACTIVE]</span>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                    <button className="reset-btn" style={{ fontSize: '0.7rem', padding: '12px 5px', whiteSpace: 'normal', lineHeight: '1.2' }} onClick={handleManageBilling}>
                      {billingCycle === 'monthly' ? "SWITCH_TO_ANNUAL" : "SWITCH_TO_MONTHLY"}
                    </button>
                    <button className="reset-btn" style={{ borderColor: '#ff4444', color: '#ff4444' }} onClick={() => { if(window.confirm("CANCEL SUBSCRIPTION? PII shielding will be deactivated at end of cycle.")) handleManageBilling(); }}>
                      CANCEL_PLAN
                    </button>
                  </div>
                </div>

                <div className="masking-tool" style={{ width: '100%', maxWidth: '600px', border: '1px solid var(--tiger-blue)' }}>
                  <p className="tool-label" style={{ textAlign: 'center', color: 'var(--tiger-blue)' }}>SYSTEM SUPPORT NODE</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                    <button className="reset-btn" onClick={() => setShowSupportModal(true)}>OPEN_TICKET</button>
                    <button className="reset-btn" onClick={() => setShowFaqModal(true)}>ACCESS FAQ</button>
                  </div>
                  <div style={{ marginTop: '20px', fontSize: '0.7rem', color: '#64748b', textAlign: 'center' }}>
                    <p className="faq-link" onClick={() => setShowFaqModal(true)} style={{cursor: 'pointer', textDecoration: 'underline'}}> Operation Manual </p>
                  </div>
                </div>

                <div className="masking-tool" style={{ width: '100%', maxWidth: '600px' }}>
                  <p className="tool-label" style={{ textAlign: 'center' }}>LIVE SECURITY AUDIT</p>
                  <div className="audit-list" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {auditLog.map((log, i) => (
                      <div key={`audit-${log.time}-${i}`} className="audit-row" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #111', padding: '10px 0' }}>
                        <span className="audit-broker">[{log.broker}]</span><span className="audit-action">{log.action}</span>
                      </div>
                    ))}
                  </div>
                  <button className="pdf-btn" style={{ width: '100%', marginTop: '15px' }} onClick={handleDownloadPDF} disabled={isGenerating}>GENERATE AUDIT PDF</button>
                </div>

                <div style={{display: 'flex', flexDirection: 'column', gap: '15px', width: '100%', maxWidth: '400px', marginTop: '40px'}}>
                  <button className="reset-btn" onClick={() => {localStorage.clear(); window.location.reload();}}>LOGOUT SECURELY</button>
                  <button className="burn-all-btn" onClick={() => { if(window.confirm("CONFIRM TOTAL PURGE? (S3 RECEIPT WILL BE ISSUED)")) handleEmergencyBurn(); }}>EMERGENCY BURN</button>
                </div>
              </div>
            ) : (
              /* 4. ONBOARDING & LOGIN FLOW (MOBILE OPTIMIZED) */
              <div className="onboarding-flow">
                {!showPricing && !showCheckout && !isScanning && !show2FA && (
                  <div className="fade-in" style={{display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '80vh', justifyContent: 'center', padding: '40px 20px'}}>
                    
                    {/* Main Content Container */}
                    <div style={{display: 'flex', width: '100%', maxWidth: '1100px', gap: '40px', alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'center'}}>
                      
                      {/* Left Side: Hero Brand */}
                      <div style={{flex: '1 1 300px', textAlign: 'left', minWidth: '280px'}}>
                        <h1 className="brand-name" style={{fontSize: 'clamp(2.5rem, 8vw, 4rem)', margin: '0'}}>DISAPPEAR</h1>
                        <h2 style={{color: 'white', fontSize: 'clamp(1.5rem, 5vw, 2.5rem)', fontWeight: '900', letterSpacing: '-1px', marginBottom: '20px'}}>STAY VIGILANT.</h2>
                        
                        <p style={{color: '#94A3B8', lineHeight: '1.6', fontSize: '1rem', marginBottom: '30px'}}>
                          Your identity is a target. In 2026, data brokers weaponize your PII for profit. 
                          <strong> Disappear</strong> is the tactical counter-measure: A Privacy-as-a-Service engine 
                          built to scorch your digital trail and replace exposure with synthetic security.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '25px', width: '100%' }}>
                          <button className="main-button" style={{padding: '18px 20px', fontSize: '1rem', width: '100%'}} onClick={() => setShowPricing(true)}>INITIATE IDENTITY SCRUB</button>
                          <button className="login-btn-outline" style={{padding: '18px 20px', width: '100%'}} onClick={() => {triggerToast("CHALLENGE REQUEST SENT..."); setShow2FA(true);}}>CLIENT LOGIN</button>
                        </div>

                        <p style={{fontSize: '0.65rem', color: '#444', letterSpacing: '1px', marginBottom: '40px'}}>
                          AUTOMATED PII REMOVAL // ENCRYPTED VAULT ARCHITECTURE
                        </p>
                      </div>

                      {/* Right Side: Intelligence Brief */}
                      <div className="masking-tool" style={{flex: '1 1 300px', background: '#050505', border: '1px solid #111', padding: '25px', width: '100%', boxSizing: 'border-box'}}>
                         <p className="field-label" style={{color: 'white', marginBottom: '25px', borderBottom: '1px solid #111', paddingBottom: '10px'}}>INTELLIGENCE BRIEF</p>
                         
                         <div style={{marginBottom: '25px'}}>
                            <h3 style={{fontSize: '2rem', color: 'white', margin: '0'}}>4.7B</h3>
                            <p style={{fontSize: '0.65rem', color: '#64748B', margin: '5px 0'}}>PROFILES INDEXED BY BROKERS</p>
                         </div>

                         <div style={{marginBottom: '25px'}}>
                            <h3 style={{fontSize: '2rem', color: 'white', margin: '0'}}>82%</h3>
                            <p style={{fontSize: '0.65rem', color: '#64748B', margin: '5px 0'}}>OF USERS HAVE EXPOSED PII</p>
                         </div>

                         <div style={{borderTop: '1px solid #111', paddingTop: '20px'}}>
                            <p style={{fontSize: '0.75rem', color: '#94A3B8', lineHeight: '1.4'}}>
                              <span style={{color: 'var(--tiger-blue)'}}>» CLOAK_STATUS:</span> Ongoing monitoring prevents re-indexing by third-party aggregators.
                            </p>
                         </div>
                      </div>
                    </div>

                    {/* Value Section: Why Disappear? */}
                    <div style={{width: '100%', maxWidth: '1100px', marginTop: '60px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px'}}>
                        <div className="masking-tool" style={{border: '1px solid #111', padding: '20px'}}>
                          <span style={{fontSize: '1.5rem', marginBottom: '10px', display: 'block'}}>📞</span>
                          <h4 style={{color: 'white', margin: '10px 0'}}>TERMINATE SPAM</h4>
                          <p style={{fontSize: '0.8rem', color: '#64748B'}}>Intercept lead lists at the source. Neutralize robocalls and SMS phishing before they reach your hardware.</p>
                        </div>
                        <div className="masking-tool" style={{border: '1px solid #111', padding: '20px'}}>
                          <span style={{fontSize: '1.5rem', marginBottom: '10px', display: 'block'}}>✉️</span>
                          <h4 style={{color: 'white', margin: '10px 0'}}>INBOX SANITIZATION</h4>
                          <p style={{fontSize: '0.8rem', color: '#64748B'}}>Scrub your primary email from 250+ marketing databases to collapse the volume of targeted tracking emails.</p>
                        </div>
                        <div className="masking-tool" style={{border: '1px solid #111', padding: '20px'}}>
                          <span style={{fontSize: '1.5rem', marginBottom: '10px', display: 'block'}}>💳</span>
                          <h4 style={{color: 'white', margin: '10px 0'}}>FINANCIAL SHIELD</h4>
                          <p style={{fontSize: '0.8rem', color: '#64748B'}}>Replace real card data with merchant-locked nodes to prevent synthetic identity creation and unauthorized inquiries.</p>
                        </div>
                    </div>

                  </div>
                )}

                {showHelp && !showShield && !showCheckout && !show2FA && (
                  <div className="pricing-card fade-in" style={{ marginBottom: '40px', border: '1px solid #0047AB', background: '#020202' }}>
                    <div className="price-box" style={{ textAlign: 'left', maxWidth: '600px' }}>
                      <h3 className="tiger-text" style={{letterSpacing: '2px'}}>Operation Manual v1.2</h3>
                      <p style={{fontSize: '0.6rem', color: '#444', marginBottom: '20px'}}>USER GUIDE</p>
                      
                      <div style={{ marginBottom: '20px', borderLeft: '2px solid var(--tiger-blue)', paddingLeft: '15px' }}>
                        <p className="field-label" style={{ color: 'white', marginBottom: '5px' }}>💳 CREDIT CARD PROTECTION</p>
                        <p style={{ fontSize: '0.75rem', lineHeight: '1.4', color: '#94A3B8' }}>
                          Generate merchant-locked virtual digits. These prevent your real banking data from being logged by retailers or leaked in breaches.
                        </p>
                      </div>

                      <div style={{ marginBottom: '20px', borderLeft: '2px solid var(--tiger-blue)', paddingLeft: '15px' }}>
                        <p className="field-label" style={{ color: 'white', marginBottom: '5px' }}>✉️ EMAIL RELAY NODES</p>
                        <p style={{ fontSize: '0.75rem', lineHeight: '1.4', color: '#94A3B8' }}>
                          Deploy forwarding addresses that scrub hidden PII trackers from incoming mail before they reach your primary inbox.
                        </p>
                      </div>

                      <div style={{ marginBottom: '20px', borderLeft: '2px solid var(--tiger-blue)', paddingLeft: '15px' }}>
                        <p className="field-label" style={{ color: 'white', marginBottom: '5px' }}>📱 PHONE ALIAS NODES</p>
                        <p style={{ fontSize: '0.75rem', lineHeight: '1.4', color: '#94A3B8' }}>
                          Generate secondary numbers for 2FA bypass and app verifications. Incoming SMS codes appear directly in your Live Security Audit.
                        </p>
                      </div>

                      <div style={{ marginBottom: '25px', borderLeft: '2px solid var(--tiger-blue)', paddingLeft: '15px' }}>
                        <p className="field-label" style={{ color: 'white', marginBottom: '5px' }}>🔥 DATA REMOVAL PROTOCOL</p>
                        <p style={{ fontSize: '0.75rem', lineHeight: '1.4', color: '#94A3B8' }}>
                          Automated legal requests are dispatched to major data brokers. Use the 'Emergency Burn' to instantly wipe all vault assets and profile data.
                        </p>
                      </div>

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
                    <div className="billing-toggle" style={{ display: 'flex', gap: '5px' }}>
                      <button className={billingCycle === 'monthly' ? 'mask-btn active-toggle' : 'mask-btn'} style={{ flex: 1 }} onClick={() => setBillingCycle('monthly')}>Monthly</button>
                      <button className={billingCycle === 'annual' ? 'mask-btn active-toggle' : 'mask-btn'} style={{ flex: 1 }} onClick={() => setBillingCycle('annual')}>Annual</button>
                    </div>
                    <div className="price-box">
                      <h3 className="tiger-text">ELITE PRIVACY P-A-A-S</h3>
                      <div className="price-amount">${billingCycle === 'monthly' ? '24.99' : '19.99'}</div>
                      <p style={{fontSize: '0.6rem', color: 'var(--text-dim)', marginBottom: '20px'}}>Includes 6 Global Slots + Total Purge Access</p>
                      <button className="main-button" style={{width: '100%'}} onClick={() => setShowCheckout(true)}>PROCEED</button>
                      <button className="reset-btn" style={{width: '100%', marginTop: '10px'}} onClick={() => setShowPricing(false)}>CANCEL</button>
                    </div>
                  </div>
                )}

                {showCheckout && !isScanning && (
                  <div className="pricing-card fade-in">
                    <div className="price-box" style={{maxWidth: '450px', width: '100%', margin: '0 auto'}}>
                      <h3 className="tiger-text">TARGET PROFILE DATA</h3>
                      <div className="checkout-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                          <input className="mask-btn" style={{ flex: '1 1 140px' }} placeholder="First Name" value={targetProfile.firstName} onChange={(e) => setTargetProfile({...targetProfile, firstName: e.target.value})} />
                          <input className="mask-btn" style={{ flex: '1 1 140px' }} placeholder="Middle Name" value={targetProfile.middleName} onChange={(e) => setTargetProfile({...targetProfile, middleName: e.target.value})} />
                          <input className="mask-btn full-row" style={{ width: '100%' }} placeholder="Last Name" value={targetProfile.lastName} onChange={(e) => setTargetProfile({...targetProfile, lastName: e.target.value})} />
                          <input className="mask-btn full-row" style={{ width: '100%' }} placeholder="Email Address" value={targetProfile.email} onChange={(e) => setTargetProfile({...targetProfile, email: e.target.value})} />
                          <input className="mask-btn full-row" style={{ width: '100%' }} placeholder="Home Address" value={targetProfile.address} onChange={(e) => setTargetProfile({...targetProfile, address: e.target.value})} />
                          <input className="mask-btn full-row" style={{ width: '100%' }} type="text" inputMode="numeric" placeholder="MM/DD/YYYY" value={targetProfile.dob} onChange={handleNumericDateInput} />
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
        </>
      )}

      <footer className="home-footer">
          <span onClick={() => setShowLegal('privacy')}>PRIVACY POLICY</span>
          <span className="footer-divider">|</span>
          <span onClick={() => setShowLegal('terms')}>TERMS OF SERVICE</span>
          <span className="admin-trigger" onClick={() => setShowAdmin(true)}>.</span>
      </footer>

      {/* --- GLOBAL ENCRYPTION & PURGE OVERLAY --- */}
      {isEncrypting && (
        <div className="encrypting-overlay">
          <div className="fade-in">{purgeStatus || "ENCRYPTING NODE..."}</div>
          <div className="status-subtext" style={{marginTop: '15px'}}>
            SECURE LINK ACTIVE | DO NOT INTERRUPT
          </div>
        </div>
      )}
    </div>
  );
}

export default App;