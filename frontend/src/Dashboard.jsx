import React, { useState, useEffect, useMemo } from 'react';
import { Terminal, ShieldAlert, ShieldCheck, Loader2, AlertTriangle, CreditCard, Landmark, Trash2, Power, Plus, Eye, EyeOff, Lock, Globe, MapPin } from 'lucide-react';
import axios from 'axios';

const styles = {
  container: { padding: '20px', backgroundColor: '#05070a', color: '#fff', minHeight: '100vh', fontFamily: 'monospace', position: 'relative' },
  header: { display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0047AB', paddingBottom: '10px', marginBottom: '20px' },
  inputGroup: { display: 'flex', gap: '10px', marginBottom: '20px' },
  input: { flex: 1, background: '#000', border: '1px solid #1e293b', color: '#38bdf8', padding: '12px', outline: 'none' },
  btn: { background: '#0047AB', color: '#fff', border: 'none', padding: '0 25px', fontWeight: 'bold', cursor: 'pointer' },
  resultsList: { maxHeight: '450px', overflowY: 'auto', border: '1px solid #1e293b', background: '#070a0f', padding: '15px', borderRadius: '4px' },
  tabGroup: { display: 'flex', gap: '2px', marginBottom: '10px', borderBottom: '1px solid #1e293b', overflowX: 'auto' },
  tab: { padding: '10px 15px', fontSize: '11px', cursor: 'pointer', border: 'none', background: 'none', color: '#475569', transition: '0.2s', borderBottom: '2px solid transparent', whiteSpace: 'nowrap' },
  activeTab: { color: '#0047AB', borderBottomColor: '#0047AB', background: '#0047AB11' },
  cardRow: { background: '#0a0e14', border: '1px solid #111', padding: '15px', borderRadius: '4px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: '0.3s' },
  frozen: { opacity: 0.4, filter: 'grayscale(1)', borderStyle: 'dashed' },
  actionBtn: { background: 'none', border: '1px solid #1e293b', color: '#94a3b8', padding: '5px 10px', fontSize: '10px', cursor: 'pointer', marginLeft: '5px' },
  vaultItem: { background: '#000', padding: '12px', borderRadius: '4px', marginBottom: '10px', border: '1px solid #1e293b' },
  mapContainer: { height: '300px', background: '#020408', border: '1px solid #1e293b', position: 'relative', overflow: 'hidden', borderRadius: '4px' },
  breachItem: { padding: '10px', borderLeft: '2px solid #ef4444', background: '#0a0505', marginBottom: '8px', fontSize: '11px' }
};

const TacticalMap = ({ pings, isPro }) => {
  return (
    <div style={styles.mapContainer}>
      <svg viewBox="0 0 800 400" style={{ width: '100%', height: '100%', opacity: isPro ? 1 : 0.3 }}>
        <path d="M150,150 Q200,100 300,120 T500,150 T700,130" fill="none" stroke="#1e293b" strokeWidth="1" />
        {pings.map((ping, i) => {
          const x = (ping.lng + 180) * (800 / 360);
          const y = (90 - ping.lat) * (400 / 180);
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="3" fill={isPro ? "#ef4444" : "#334155"}>
                <animate attributeName="r" values="3;8;3" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="1;0.2;1" dur="2s" repeatCount="indefinite" />
              </circle>
              {isPro && <text x={x + 10} y={y + 5} fill="#ef4444" fontSize="8">{ping.location}</text>}
            </g>
          );
        })}
      </svg>
      {!isPro && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#ef4444', fontSize: '10px' }}>[GLOBAL_MASK_ACTIVE]</div>}
    </div>
  );
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [vaultData, setVaultData] = useState({ locked: true, items: [] });
  const [mapData, setMapData] = useState({ pings: [] });
  const [darkWebFeed, setDarkWebFeed] = useState([]);
  const [financials, setFinancials] = useState({ sources: [], cards: [] });
  const [profile, setProfile] = useState({ name: "", is_pro: 0 });
  const [activeTab, setActiveTab] = useState("LIVE_THREATS");
  const [logs, setLogs] = useState(["[SYSTEM] Secure Connection Established..."]);
  const [isScanning, setIsScanning] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // --- API CONFIG WITH TACTICAL TOKEN ---
  const api = useMemo(() => {
    const token = localStorage.getItem("disappear_session_token") || "tactical_session_active";
    return axios.create({
      baseURL: 'http://127.0.0.1:8000',
      headers: { 'X-Session-Token': token }
    });
  }, []);

  const addLog = (msg) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 5));
  };

  const fetchData = async () => {
    try {
      const [dashRes, vaultRes, mapRes, feedRes, finRes] = await Promise.all([
        api.get('/dashboard/sync'),
        api.get('/vault'), // Assuming vault/leak/darkweb are updated in main.py or still accessible
        api.get('/leak-map'),
        api.get('/dark-web-feed'),
        api.get('/financials/data')
      ]);
      
      setData(dashRes.data);
      setProfile(dashRes.data.profile);
      setVaultData(vaultRes.data);
      setMapData(mapRes.data);
      setDarkWebFeed(feedRes.data.feed);
      setFinancials(finRes.data);
    } catch (e) {
      if (e.response?.status === 401) addLog("SECURITY_ALERT: SESSION_EXPIRED");
    }
  };

  useEffect(() => { 
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [api]);

  // --- FINANCIAL ACTIONS ---
  const handleMint = async () => {
    if (financials.sources.length === 0) return addLog("ERROR: NO_FUNDING_SOURCE");
    try {
      await api.post('/financials/mint-vcc', { 
        label: "Shield Card", 
        funding_source_id: financials.sources[0].id 
      });
      addLog("SUCCESS: VIRTUAL_SHIELD_MINTED");
      fetchData();
    } catch (e) { addLog("MINT_FAILED"); }
  };

  const killCard = async (id) => {
    try {
      await api.delete(`/financials/kill-card/${id}`);
      addLog("SIGNAL_TERMINATED: CARD_DESTROYED");
      fetchData();
    } catch (e) { addLog("KILL_COMMAND_FAILED"); }
  };

  const linkBank = async () => {
    try {
      await api.post('/financials/link-card');
      addLog("BANK_LINKED: ENCRYPTING_VAULT");
      fetchData();
    } catch (e) { addLog("LINK_FAILED"); }
  };

  const handleScan = async () => {
    if (!profile.name) return addLog("INPUT_REQUIRED");
    setIsScanning(true);
    addLog(`INIT_VAPOR_SCAN: ${profile.name.toUpperCase()}`);
    try {
      await api.post('/initial-scan', { name: profile.name });
      setTimeout(() => { fetchData(); setIsScanning(false); addLog(`SCAN_SUCCESS: IDENTITY_LEAKS_MAPPED`); }, 2000);
    } catch (e) { setIsScanning(false); }
  };

  const liveResults = useMemo(() => data?.results?.filter(item => !item.status.includes('✅')) || [], [data]);

  return (
    <div style={styles.container}>
      <style>{`@keyframes pulseRed { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }`}</style>
      
      {showSuccess && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(5,7,10,0.95)', zIndex: 999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <ShieldCheck size={80} color="#10b981" />
          <h2 style={{ color: '#10b981', letterSpacing: '4px' }}>IDENTITY_VAPORIZED</h2>
        </div>
      )}

      {/* Header */}
      <div style={styles.header}>
        <div><h2 style={{ letterSpacing: '4px', margin: 0 }}>DISAPPEAR_DASHBOARD</h2><span style={{ color: '#0047AB', fontSize: '10px' }}>STATUS: {profile.is_pro ? "PRO_ACTIVE" : "UNPROTECTED"}</span></div>
        <div style={{ textAlign: 'right' }}><small>ANONYMITY_INDEX</small><div style={{ fontSize: '32px', color: (data?.privacy_score || 0) > 50 ? '#10b981' : '#ef4444' }}>{data?.profile?.privacy_score || 100}%</div></div>
      </div>

      <div style={styles.inputGroup}>
        <input style={styles.input} placeholder="ENTER_LEGAL_NAME" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
        <button style={styles.btn} onClick={handleScan} disabled={isScanning}>{isScanning ? <Loader2 className="animate-spin" size={16}/> : "SCAN"}</button>
      </div>

      {/* Tabs */}
      <div style={styles.tabGroup}>
        {["LIVE_THREATS", "DARK_WEB", "LEAK_MAP", "IDENTITY_VAULT", "VCC_MANAGER"].map(tab => (
          <button key={tab} style={{ ...styles.tab, ...(activeTab === tab ? styles.activeTab : {}) }} onClick={() => setActiveTab(tab)}>
            {tab.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div style={styles.resultsList}>
        
        {/* VCC MANAGER TAB */}
        {activeTab === "VCC_MANAGER" && (
          <div>
             <div style={{display: 'flex', gap: '10px', marginBottom: '20px'}}>
                <button style={{ ...styles.btn, flex: 1, height: '40px' }} onClick={handleMint}>
                   <Plus size={14} style={{display: 'inline', marginRight: '5px'}} /> MINT SHIELD CARD
                </button>
                <button style={{ ...styles.btn, background: '#1e293b', flex: 1 }} onClick={linkBank}>
                   <Landmark size={14} style={{display: 'inline', marginRight: '5px'}} /> LINK BANK
                </button>
             </div>

             <div style={{marginBottom: '20px'}}>
                <small style={{color: '#475569'}}>ACTIVE_FUNDING_SOURCES</small>
                {financials.sources.map(source => (
                  <div key={source.id} style={{fontSize: '10px', color: '#0047AB', marginTop: '5px'}}>
                    ● {source.bank} (****{source.last4}) - VERIFIED
                  </div>
                ))}
             </div>

            {financials.cards.map(card => (
              <div key={card.id} style={{ ...styles.cardRow, ...(card.active ? {} : styles.frozen) }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#0047AB' }}>{card.label.toUpperCase()}</div>
                  <div style={{ fontSize: '11px', color: '#fff', letterSpacing: '2px', margin: '5px 0' }}>{card.number}</div>
                  <div style={{ fontSize: '8px', color: '#475569' }}>EXP: {card.exp} | CVV: *** | SOURCE: {card.source_desc}</div>
                </div>
                <button style={{ ...styles.actionBtn, color: '#ef4444' }} onClick={() => killCard(card.id)}>
                  <Trash2 size={14}/>
                </button>
              </div>
            ))}
            {financials.cards.length === 0 && <div style={{textAlign: 'center', color: '#475569', padding: '40px'}}>NO_VIRTUAL_CARDS_MINTED</div>}
          </div>
        )}

        {activeTab === "DARK_WEB" && (
          <div style={{ padding: '10px' }}>
            <div style={{ fontSize: '10px', color: '#ef4444', marginBottom: '15px', animation: 'pulseRed 2s infinite' }}>
              <AlertTriangle size={12} /> MONITORING_LIVE_BREACH_SITES...
            </div>
            {darkWebFeed.map((item, i) => (
              <div key={i} style={styles.breachItem}>
                <div style={{ color: '#ef4444', fontWeight: 'bold' }}>SOURCE: {item.site}</div>
                <div style={{ color: '#94a3b8', marginTop: '4px' }}>{item.exposure}</div>
                <div style={{ fontSize: '8px', color: '#475569', marginTop: '4px' }}>TIMESTAMP: {item.timestamp}</div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "LEAK_MAP" && <TacticalMap pings={mapData.pings} isPro={profile.is_pro === 1} />}

        {activeTab === "IDENTITY_VAULT" && (
          vaultData.items.map((item, i) => (
            <div key={i} style={styles.vaultItem}>
              <div style={{ fontSize: '8px', color: '#38bdf8' }}>{item.data_type}</div>
              <div style={{ color: vaultData.locked ? '#1e293b' : '#fff', filter: vaultData.locked ? 'blur(4px)' : 'none' }}>{item.finding}</div>
            </div>
          ))
        )}

        {activeTab === "LIVE_THREATS" && (
          liveResults.map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #1e293b' }}>
              <div><div style={{ fontSize: '11px' }}>{item.broker_name}</div><div style={{ fontSize: '9px', color: '#ef4444' }}>{item.status}</div></div>
              <ShieldAlert size={14} color="#ef4444" />
            </div>
          ))
        )}
      </div>

      {/* System Logs Footer */}
      <div style={{ background: '#000', padding: '12px', marginTop: '20px', border: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px' }}>
            <Terminal size={12} color="#0047AB" /> <small style={{color: '#0047AB'}}>TACTICAL_FEED</small>
        </div>
        {logs.map((log, i) => (
          <div key={i} style={{ fontSize: '10px', color: i === 0 ? '#38bdf8' : '#1e293b' }}>{log}</div>
        ))}
      </div>
    </div>
  );
}