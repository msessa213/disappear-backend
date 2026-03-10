import React, { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import './App.css';

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
  
  const [newCardLabel, setNewCardLabel] = useState("");
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [chartRange, setChartRange] = useState("30D");
  const [maskedEmail, setMaskedEmail] = useState("****************@mask.com");
  const [nodeCount, setNodeCount] = useState(0);
  const [auditLog, setAuditLog] = useState([]);
  const [mapNodes, setMapNodes] = useState([]); 
  const [cards, setCards] = useState([]);
  const [progress, setProgress] = useState(15);
  const [showToast, setShowToast] = useState("");

  const triggerToast = (msg) => { setShowToast(msg); setTimeout(() => setShowToast(""), 2000); };

  // --- NOTIFICATION ENGINE ---
  const pushNotification = (broker) => {
    const id = Date.now();
    const newNote = { id, msg: `THREAT DEFLECTED: [${broker}]` };
    setNotifications(prev => [newNote, ...prev].slice(0, 3));
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  };

  const historyData = useMemo(() => {
    const pointsMap = { "30D": 30, "90D": 45, "6M": 60, "1Y": 90 };
    const points = pointsMap[chartRange] || 30;
    return Array.from({ length: points }, (_, i) => ({
      name: i,
      threats: Math.floor(Math.random() * 20) + (i > points - 5 ? 15 : 5)
    }));
  }, [chartRange, auditLog]);

  // --- HEARTBEAT SYNC ---
  const syncDefenseData = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/dashboard/sync");
      const data = await res.json();
      
      if (data.recent_audit && data.recent_audit.length > 0 && showShield) {
        if (auditLog.length > 0 && data.recent_audit[0].time !== auditLog[0].time) {
          pushNotification(data.recent_audit[0].broker);
        }
      }

      setAuditLog(data.recent_audit || []);
      setMaskedEmail(data.profile?.email_alias || "");
      setNodeCount(data.profile?.active_nodes || 0);
      setMapNodes(data.map_nodes || []); 

      const finRes = await fetch("http://127.0.0.1:8000/financials/data");
      const finData = await finRes.json();
      setCards(finData.cards || []);
    } catch (e) {
      console.log("Tactical link heartbeat pulse...");
    }
  };

  useEffect(() => {
    let interval;
    if (showShield) {
      syncDefenseData();
      interval = setInterval(syncDefenseData, 5000);
    }
    return () => clearInterval(interval);
  }, [showShield, auditLog]);

  const handleKillCard = async (id) => {
    setTerminatingId(id); 
    setTimeout(async () => {
      try {
        await fetch(`http://127.0.0.1:8000/financials/kill/${id}`, { method: "DELETE" });
        setCards(prev => prev.filter(c => c.id !== id));
        setTerminatingId(null);
        triggerToast("NODE BURNED");
      } catch (e) { 
        triggerToast("ERROR");
        setTerminatingId(null);
      }
    }, 800); 
  };

  const startLoginFlow = () => { triggerToast("CHALLENGE REQUEST SENT..."); setShow2FA(true); };

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
        doc.setFillColor(0, 71, 171);
        doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.text("DISAPPEAR | PRIVACY AUDIT", 15, 25);
        doc.save(`DISAPPEAR_AUDIT_${Date.now()}.pdf`);
        triggerToast("AUDIT DOWNLOADED");
      } catch (err) { triggerToast("FAILED"); }
      finally { setIsGenerating(false); }
    }, 1500);
  };

  useEffect(() => {
    if (localStorage.getItem("disappear_session") === "active") {
      setShowShield(true);
      setProgress(100);
    }
  }, []);

  const handleFinalPurchase = () => {
    setShowCheckout(false);
    setIsScanning(true);
    setProgress(60);
    setTimeout(() => {
      localStorage.setItem("disappear_session", "active");
      setIsScanning(false);
      setShowShield(true);
      setProgress(100);
    }, 3000);
  };

  return (
    <div className="app-container">
      <div className="progress-bar-container">
        <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
        <span className="secure-connection-text">
          {showShield ? `SHIELD ACTIVE | ${nodeCount} NODES ONLINE` : `INITIALIZING SHIELD: ${progress}%`}
        </span>
      </div>

      {showToast && <div className="status-message toast-fixed">{showToast}</div>}

      <div className="notification-stack">
        {notifications.map(n => (
          <div key={n.id} className="notif-pill">
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
            <h3 className="tiger-text">VERIFICATION REQUIRED</h3>
            <p style={{fontSize: '0.7rem', color: '#94A3B8', margin: '10px 0'}}>ENTER 6-DIGIT ENCRYPTED TOKEN</p>
            <input className="mask-btn" style={{width: '100%', margin: '20px 0', textAlign: 'center', letterSpacing: '10px', fontSize: '1.2rem', color: 'white'}} placeholder="******" maxLength="6" />
            <button className="main-button" style={{width: '100%'}} onClick={verify2FA}>VERIFY IDENTITY</button>
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
                 const res = fetch("http://127.0.0.1:8000/financials/mint", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ label: newCardLabel })
                  }).then(r => r.json()).then(newCard => {
                    setCards([...cards, newCard]);
                    setIsMinting(false);
                    setNewCardLabel("");
                    triggerToast("SHIELD MINTED");
                  });
              }}>MINT</button>
              <button className="reset-btn" style={{margin: 0, flex: 1}} onClick={() => setIsMinting(false)}>CANCEL</button>
            </div>
          </div>
        </div>
      )}

      {!showShield && !showPricing && !showCheckout && !isScanning && !show2FA && (
        <div className="fade-in">
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
          <div className="price-box">
            <h3 className="tiger-text">SECURE CHECKOUT</h3>
            <div className="biometric-section">SCANNING BIOMETRIC DATA...</div>
            <button className="main-button" style={{width: '100%'}} onClick={handleFinalPurchase}>CONFIRM & ACTIVATE</button>
          </div>
        </div>
      )}

      {isScanning && <div className="shield-container"><h2 className="shield-text">SCRUBBING NODES...</h2></div>}

      {showShield && (
        <div className="shield-container">
          <h2 className="shield-text">🛡️ SHIELD ACTIVE</h2>
          <div className="tools-grid">
            
            {/* TOOL 1: EMAIL */}
            <div className="masking-tool">
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <p className="tool-label">ENCRYPTED IDENTITY EMAIL</p>
                <button className="filter-btn active" onClick={() => {
                   fetch("http://127.0.0.1:8000/financials/regenerate", { method: "POST" })
                   .then(r => r.json()).then(data => {
                     setMaskedEmail(data.email_alias);
                     triggerToast("IDENTITY EMAIL CYCLED");
                   });
                }}>CYCLE ALIAS</button>
              </div>
              <div className="masked-display" style={{marginTop: '20px', position: 'relative'}} onClick={() => {navigator.clipboard.writeText(maskedEmail); triggerToast("COPIED")}}>
                {maskedEmail} <span style={{position: 'absolute', right: '15px', opacity: 0.4}}>📋</span>
              </div>
            </div>

            {/* TOOL 2: VCC */}
            <div className="masking-tool">
              <p className="tool-label">VIRTUAL SHIELD CARDS</p>
              <div className="card-manager-list">
                {cards.map(c => (
                  <div key={c.id} className={`managed-card-row enhanced-card ${terminatingId === c.id ? 'burning' : ''}`}>
                    <div className="card-row-info">
                      <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px'}}>
                         <span className="card-nickname">{c.label}</span>
                         <button className="kill-text-bold" onClick={() => handleKillCard(c.id)}>TERMINATE</button>
                      </div>
                      <code className="card-digits clickable-card" onClick={() => {navigator.clipboard.writeText(c.number.replace(/\s/g, '')); triggerToast("COPIED")}}>
                        {c.number}
                      </code>
                      <div className="card-extra-info">
                        <span>EXP: <span className="blue-mono">12/28</span></span>
                        <span>CVV: <span className="blue-mono">771</span></span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button className="mask-btn" style={{marginTop: '20px', width: '100%', borderStyle: 'dashed'}} onClick={() => setIsMinting(true)}>+ MINT NEW SHIELD</button>
            </div>

            {/* TOOL 3: GLOBAL MAP (FULL WIDTH) */}
            <div className="masking-tool full-width-tool">
              <p className="tool-label" style={{paddingLeft: '30px'}}>GLOBAL SHIELD NETWORK [ACTIVE NODES]</p>
              <div className="map-container-tactical">
                <div className="map-grid-overlay"></div>
                {mapNodes.map(node => (
                  <div 
                    key={node.id} 
                    className={`map-node ${node.status === 'intercepting' ? 'node-alert' : ''}`}
                    style={{ left: `${node.x}%`, top: `${node.y}%` }}
                  >
                    <div className="node-tooltip">NODE_{node.id + 1000} | {node.status.toUpperCase()}</div>
                  </div>
                ))}
                <div className="map-legend">
                  <span className="blue-mono">●</span> ENCRYPTED NODE &nbsp;&nbsp;
                  <span style={{color: 'var(--alert-red)'}}>●</span> INTERCEPTION IN PROGRESS
                </div>
              </div>
            </div>

            {/* TOOL 4: SUPPRESSION CHART (FULL WIDTH) */}
            <div className="masking-tool full-width-tool">
              <div style={{display: 'flex', justifyContent: 'space-between', paddingRight: '30px'}}>
                <p className="tool-label" style={{paddingLeft: '30px'}}>SUPPRESSION HISTORY</p>
                <div className="chart-filters">
                  {["30D", "90D", "6M", "1Y"].map(range => (
                    <button key={range} className={chartRange === range ? "filter-btn active" : "filter-btn"} onClick={() => setChartRange(range)}>{range}</button>
                  ))}
                </div>
              </div>
              <div style={{ width: '100%', height: '220px', background: '#000', marginTop: '15px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={historyData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#111" vertical={false} />
                    <XAxis hide />
                    <YAxis hide />
                    <Tooltip contentStyle={{background:'#000', border:'1px solid #0047AB', color: '#fff'}} />
                    <Area type="monotone" dataKey="threats" stroke="#0047AB" fill="#0047AB" fillOpacity={0.2} animationDuration={1000} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* TOOL 5: AUDIT LOG */}
            <div className="masking-tool">
              <p className="tool-label">LIVE SECURITY AUDIT</p>
              <div className="audit-list" style={{maxHeight: '200px', overflowY: 'auto', marginBottom: '15px'}}>
                {auditLog.map((log, i) => (
                  <div key={i} className="audit-row">
                    <span className="audit-broker">[{log.broker}]</span>
                    <span className="audit-action">{log.action}</span>
                    <span style={{fontSize: '0.6rem', color: '#334155'}}>{log.time}</span>
                  </div>
                ))}
              </div>
              <button className="pdf-btn" onClick={handleDownloadPDF} disabled={isGenerating}>
                {isGenerating ? "ENCRYPTING DATA..." : "GENERATE AUDIT PDF"}
              </button>
            </div>
          </div>
          <button className="reset-btn" onClick={() => {localStorage.clear(); window.location.reload();}}>Logout Securely</button>
        </div>
      )}
    </div>
  );
}

export default App;