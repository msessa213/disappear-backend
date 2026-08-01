import React, { useState, useEffect } from 'react';

export default function AdminDashboard({ API_BASE_URL }) {
  const [manualTasks, setManualTasks] = useState([]);
  const [verifications, setVerifications] = useState({});
  const [adminKey, setAdminKey] = useState("");
  const [analystName, setAnalystName] = useState(localStorage.getItem("disappear_analyst_name") || "");
  const [filterMode, setFilterMode] = useState("ALL"); // 'ALL', 'UNASSIGNED', 'MY_TASKS'
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (adminKey) fetchBacklog();
  }, [adminKey]);

  const handleSaveAnalystName = (name) => {
    setAnalystName(name);
    localStorage.setItem("disappear_analyst_name", name);
  };

  const fetchBacklog = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/ops/backlog`, {
        headers: { "X-Disappear-Admin-Key": adminKey }
      });
      if (res.status === 403) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      setManualTasks(data.manual_processing_required || []);
      setLoading(false);
    } catch (e) {
      console.error("Admin fetch error", e);
      setLoading(false);
    }
  };

  const handleClaimTask = async (taskId) => {
    const activeAnalyst = analystName.trim() || prompt("Enter your Associate Name / ID to claim this task:");
    if (!activeAnalyst) return;

    handleSaveAnalystName(activeAnalyst);

    try {
      const res = await fetch(`${API_BASE_URL}/admin/ops/claim/${taskId}`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Disappear-Admin-Key": adminKey
        },
        body: JSON.stringify({ analyst_name: activeAnalyst })
      });
      if (res.ok) {
        setManualTasks(prev => prev.map(t => t.task_id === taskId ? { ...t, assigned_analyst: activeAnalyst } : t));
      }
    } catch (e) {
      alert("Failed to claim task.");
    }
  };

  const handleUnclaimTask = async (taskId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/ops/unclaim/${taskId}`, {
        method: "POST",
        headers: { "X-Disappear-Admin-Key": adminKey }
      });
      if (res.ok) {
        setManualTasks(prev => prev.map(t => t.task_id === taskId ? { ...t, assigned_analyst: null } : t));
      }
    } catch (e) {
      alert("Failed to release task.");
    }
  };

  const handleResolve = async (taskId) => {
    const link = verifications[taskId] || "";
    const activeAnalyst = analystName.trim() || "Staff Analyst";
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/complete-manual-scrub/${taskId}`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Disappear-Admin-Key": adminKey
        },
        body: JSON.stringify({ 
          verification_link: link, 
          notes: `Processed via Operations Console by ${activeAnalyst}`,
          analyst_name: activeAnalyst
        })
      });
      
      if (res.ok) {
        setManualTasks(prev => prev.filter(t => t.task_id !== taskId));
      }
    } catch (e) {
      alert("Error resolving task.");
    }
  };

  // Filter Tasks
  const unassignedTasks = manualTasks.filter(t => !t.assigned_analyst);
  const myTasks = manualTasks.filter(t => t.assigned_analyst && t.assigned_analyst.toLowerCase() === analystName.trim().toLowerCase());
  
  const displayedTasks = filterMode === 'UNASSIGNED' 
    ? unassignedTasks 
    : filterMode === 'MY_TASKS' 
    ? myTasks 
    : manualTasks;

  if (loading) return <div style={{color: 'white', textAlign: 'center'}}>ACCESSING CENTRAL COMMAND...</div>;

  return (
    <div className="price-box" style={{ maxWidth: '900px', width: '100%', margin: '0 auto', textAlign: 'left', maxHeight: '85vh', overflowY: 'auto' }}>
      <h2 className="tiger-text" style={{ marginBottom: '5px' }}>PRODUCTION OPERATIONS & TASK QUEUE</h2>
      <p className="field-label" style={{ marginBottom: '20px' }}>MULTI-ASSOCIATE MANUAL DATA REMOVAL CONSOLE</p>
      
      {/* Associate Identity & Security Credentials Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px', background: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div>
          <label style={{ fontSize: '0.75rem', color: '#94A3B8', display: 'block', marginBottom: '6px' }}>ADMIN SECRET KEY:</label>
          <input 
            type="password" 
            className="mask-btn" 
            placeholder="Enter Admin Secret Key..." 
            value={adminKey} 
            onChange={(e) => setAdminKey(e.target.value)} 
            style={{ width: '100%' }}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: '#00D2FF', display: 'block', marginBottom: '6px' }}>YOUR ASSOCIATE / ANALYST NAME:</label>
          <input 
            type="text" 
            className="mask-btn" 
            placeholder="e.g. Sarah M. (Analyst #104)" 
            value={analystName} 
            onChange={(e) => handleSaveAnalystName(e.target.value)} 
            style={{ width: '100%', borderColor: '#00D2FF' }}
          />
        </div>
      </div>

      {/* Queue Filter Navigation */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #334155', paddingBottom: '12px' }}>
        <button 
          className="reset-btn" 
          style={{ padding: '8px 16px', fontSize: '0.85rem', borderColor: filterMode === 'ALL' ? '#00D2FF' : '#334155', color: filterMode === 'ALL' ? '#00D2FF' : '#94A3B8' }}
          onClick={() => setFilterMode('ALL')}
        >
          ALL QUEUED TASKS ({manualTasks.length})
        </button>
        <button 
          className="reset-btn" 
          style={{ padding: '8px 16px', fontSize: '0.85rem', borderColor: filterMode === 'UNASSIGNED' ? '#fbbf24' : '#334155', color: filterMode === 'UNASSIGNED' ? '#fbbf24' : '#94A3B8' }}
          onClick={() => setFilterMode('UNASSIGNED')}
        >
          UNASSIGNED QUEUE ({unassignedTasks.length})
        </button>
        <button 
          className="reset-btn" 
          style={{ padding: '8px 16px', fontSize: '0.85rem', borderColor: filterMode === 'MY_TASKS' ? '#10b981' : '#334155', color: filterMode === 'MY_TASKS' ? '#10b981' : '#94A3B8' }}
          onClick={() => setFilterMode('MY_TASKS')}
        >
          MY CLAIMED TASKS ({myTasks.length})
        </button>
      </div>

      {displayedTasks.length === 0 ? (
        <p style={{ color: '#10b981', fontFamily: 'Courier New', padding: '20px', textAlign: 'center' }}>
          {filterMode === 'UNASSIGNED' ? "NO UNASSIGNED TASKS IN QUEUE." : filterMode === 'MY_TASKS' ? "YOU HAVE NO ACTIVE CLAIMED TASKS." : "ALL QUEUES CLEAR."}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
          {displayedTasks.map((task) => {
            const isAssignedToMe = task.assigned_analyst && analystName.trim() && task.assigned_analyst.toLowerCase() === analystName.trim().toLowerCase();

            return (
              <div key={task.task_id} style={{ border: isAssignedToMe ? '1px solid #10b981' : task.assigned_analyst ? '1px solid #3b82f6' : '1px solid #334155', padding: '16px', borderRadius: '8px', background: '#05070E' }}>
                
                {/* Task Header & Associate Status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <strong style={{ color: '#00D2FF', fontSize: '1.05rem', letterSpacing: '1px' }}>BROKER: {task.broker_name}</strong>
                    
                    {task.assigned_analyst ? (
                      <span style={{ fontSize: '0.72rem', backgroundColor: isAssignedToMe ? '#064e3b' : '#1e3a8a', color: isAssignedToMe ? '#34d399' : '#60a5fa', padding: '4px 10px', borderRadius: '4px', border: `1px solid ${isAssignedToMe ? '#059669' : '#2563eb'}`, fontWeight: 'bold' }}>
                        👤 ASSIGNED TO: {task.assigned_analyst.toUpperCase()}
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.72rem', backgroundColor: '#451a03', color: '#fbbf24', padding: '4px 10px', borderRadius: '4px', border: '1px solid #d97706', fontWeight: 'bold' }}>
                        ⚠️ UNASSIGNED
                      </span>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {/* Claim / Release Task Buttons */}
                    {!task.assigned_analyst ? (
                      <button 
                        className="main-button" 
                        style={{ padding: '5px 12px', fontSize: '0.78rem', background: 'linear-gradient(135deg, #d97706, #b45309)' }}
                        onClick={() => handleClaimTask(task.task_id)}
                      >
                        🎯 CLAIM TASK
                      </button>
                    ) : isAssignedToMe ? (
                      <button 
                        className="reset-btn" 
                        style={{ padding: '4px 10px', fontSize: '0.75rem', color: '#94a3b8', borderColor: '#475569' }}
                        onClick={() => handleUnclaimTask(task.task_id)}
                      >
                        ↩️ RELEASE TASK
                      </button>
                    ) : null}

                    {/* Launch Broker Removal Portal Link */}
                    <a 
                      href={task.opt_out_url || `https://www.google.com/search?q=${task.broker_name}+opt+out+form`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="main-button" 
                      style={{ textDecoration: 'none', padding: '6px 14px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      🔗 LAUNCH PORTAL
                    </a>
                  </div>
                </div>
                
                {/* Target Customer PII Details Card */}
                <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '15px', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                  <div><strong>TARGET NAME:</strong> <span style={{ color: '#FFF' }}>{task.target_profile.first_name} {task.target_profile.middle_name} {task.target_profile.last_name}</span></div>
                  <div><strong>DOB:</strong> <span style={{ color: '#FFF' }}>{task.target_profile.dob}</span></div>
                  <div><strong>EMAIL:</strong> <span style={{ color: '#FFF' }}>{task.target_profile.email}</span></div>
                  <div><strong>ADDRESS:</strong> <span style={{ color: '#FFF' }}>{task.target_profile.address}</span></div>
                </div>

                {/* Proof Link Input & Resolution Trigger */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input 
                    className="mask-btn" 
                    placeholder="Paste Removal Confirmation Link / Proof URL..." 
                    style={{ flex: 1 }}
                    value={verifications[task.task_id] || ""}
                    onChange={(e) => setVerifications({...verifications, [task.task_id]: e.target.value})}
                  />
                  <button className="reset-btn" style={{ borderColor: '#10b981', color: '#10b981', fontWeight: 'bold' }} onClick={() => handleResolve(task.task_id)}>
                    MARK COMPLETE
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}