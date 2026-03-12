import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { jsPDF } from "jspdf";
import "jspdf-autotable";
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
  
  const [reconActive, setReconActive] = useState(false);
  const [reconLog, setReconLog] = useState([]);
  const [isEmergencyWipe, setIsEmergencyWipe] = useState(false);

  // Target Profile State for Customer Info
  const [targetProfile, setTargetProfile] = useState({
    fullName: "", email: "", dob: "", address: ""
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

  // Mobile Detection Logic
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const pushNotification = (broker) => {
    const id = Date.now();
    setNotifications(prev => [{ id, msg: `THREAT DEFLECTED: [${broker}]` }, ...prev].slice(0, 3));
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  };

  const historyData = useMemo(() => {
    const points = chartRange === "30D" ? 30 : 60;
    return Array.from({ length: points }, (_, i) => ({
      name: i,
      threats: Math.floor(Math.random() * 20) + 5
    }));
  }, [chartRange]);

  // STABILITY FIX: Wrapped in useCallback to prevent re-creation on every render
  const syncDefenseData = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/dashboard/sync`);
      const data = await res.json();
      
      // Update data quietly without triggering an immediate loop
      setAuditLog(prevLog => {
        // Only trigger notification if the time has actually changed (prevents spam)
        if (data.recent_audit?.length > 0 && prevLog.length > 0) {
            if (data.recent_audit[0].time !== prevLog[0].time) {
                pushNotification(data.recent_audit[0].broker);
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
  }, [showShield]); // Depend only on showShield

  // THE HEARTBEAT FIX: Forced to 10 seconds. No circular dependencies.
  useEffect(() => {
    let interval;
    if (showShield) {
      syncDefenseData(); // Initial sync
      interval = setInterval(() => {
        syncDefenseData();
      }, 10000); // FIXED 10 SECOND SYNC TO STOP JUMPING
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

      {showInfo && (
        <div className="modal-overlay" onClick={() => setShowInfo(false)}>
          <div className="info-modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="tiger-text">SYSTEM MANIFESTO</h2>
            <div className="info-grid">
              <div className="info-item"><h4>Broker Removal</h4><p>Scrub PII from aggregators selling your data.</p></div>
              <div className="info-item"><h4>Identity Masking</h4><p>Burnable aliases to stop tracking.</p></div>
              <div className="info-item"><h4>Shield Cards</h4><p>Proxy finances for total anonymity.</p></div>
            </div>
            <button className="reset-btn" onClick={() => setShowInfo(false)}>DISMISS</button>
          </div>
        </div>
      )}

      {show2FA && (
        <div className="modal-overlay">
          <div className="price-box" style={{maxWidth: '350px'}}>
            <h3 className="tiger-text">{isMobile ? "BIOMETRIC AUTH" : "VERIFICATION REQUIRED"}</h3>
            <p style={{fontSize: '0.7rem', color: '#94A3B8', margin: '10px 0'}}>
              {isMobile ? "PLACE THUMB ON SCANNER" : "ENTER 6-DIGIT ENCRYPTED TOKEN"}
            </p>
            {isMobile ? (
              <div className="biometric-scan-circle" onClick={verify2FA}>
                <span style={{fontSize: '2.5rem'}}>🔒</span>
              </div>
            ) : (
              <input className="mask-btn" style={{width: '100%', margin: '20px 0', textAlign: 'center', letterSpacing: '10px', fontSize: '1.2rem', color: 'white'}} placeholder="******" maxLength="6" />
            )}
            {!isMobile && <button className="main-button" style={{width: '100%'}} onClick={verify2FA}>VERIFY IDENTITY</button>}
            <button className="reset-btn" style={{width: '100%', marginTop: '10px'}} onClick={() => setShow2FA(false)}>CANCEL</button>
          </div>
        </div>
      )}

      {isMinting && (
        <div className="modal-overlay">
          <div className="price-box" style={{maxWidth: '350px'}}>
            <h3 className="tiger-text">MINT SHIELD CARD</h3>
            <input className="mask-btn" style={{width: '100%', margin: '20px 0', padding: '12px', color: 'white'}} placeholder="Merchant Name" value={newCardLabel} onChange={(e) => setNewCardLabel(e.target.value)} />
            <div style={{display: 'flex', gap: '10px'}}>
              <button className="main-button" style={{flex: 1}} onClick={() => {
                 fetch(`${API_BASE_URL}/financials/mint`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ label: newCardLabel })
                  }).then(r => r.json()).then(newCard => {
                    setCards([newCard, ...cards]); setIsMinting(false); setNewCardLabel(""); triggerToast("SHIELD MINTED");
                  });
              }}>MINT</button>
              <button className="reset-btn" style={{margin: 0, flex: 1}} onClick={() => setIsMinting(false)}>CANCEL</button>
            </div>
          </div>
        </div>
      )}

      {!showShield && !showPricing && !showCheckout && !isScanning && !show2FA && (
        <div className="fade-in" style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
          <h1 className="brand-name">DISAPPEAR</h1>
          <p className="subtitle">Privacy-as-a-Service</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', marginTop: '40px' }}>
            <div style={{ display: 'flex', gap: '20px' }}>
              <button className="main-button" onClick={() => setShowPricing(true)}>IDENTITY CLEANUP</button>
              <button className="login-btn-outline" onClick={startLoginFlow}>CLIENT LOGIN</button>
            </div>
            <button className="info-link-btn" onClick={() => setShowInfo(true)}>WHY IS THIS CRITICAL? [MANIFESTO]</button>
          </div>
        </div>
      )}

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
          </div>
        </div>
      )}

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
            </div>
            <button className="main-button" style={{width: '100%', marginTop: '25px'}} onClick={handleFinalPurchase}>CONFIRM & INITIATE SCRUB</button>
            <button className="reset-btn" style={{width: '100%', marginTop: '10px'}} onClick={() => setShowCheckout(false)}>BACK</button>
          </div>
        </div>
      )}

      {isScanning && <div className="shield-container"><h2 className="shield-text">SCRUBBING NODES...</h2></div>}

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

            <div className="masking-tool full-width-tool terminal-bg">
               <div style={{padding: '0 30px'}}>
                <p className="tool-label">DEEP WEB RECONNAISSANCE</p>
                <div className="recon-terminal">
                  {reconLog.map((line, i) => <div key={i} className="terminal-line" style={{fontSize: '0.7rem'}}>{`> ${line}`}</div>)}
                </div>
                <button className="pdf-btn" onClick={runDeepWebScan} disabled={reconActive}>RUN GLOBAL THREAT SCAN</button>
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
    </div>
  );
}

export default App;