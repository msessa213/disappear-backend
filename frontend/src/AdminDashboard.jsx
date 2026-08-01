import React, { useState, useEffect } from 'react';

export default function AdminDashboard({ API_BASE_URL }) {
  const [manualTasks, setManualTasks] = useState([]);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [verifications, setVerifications] = useState({});
  const [adminKey, setAdminKey] = useState("");
  const [analystName, setAnalystName] = useState(localStorage.getItem("disappear_analyst_name") || "");
  const [filterMode, setFilterMode] = useState("ALL"); // 'ALL', 'UNASSIGNED', 'MY_TASKS', 'COMPLETED'
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    if (adminKey.trim()) fetchBacklog();
  }, [adminKey]);

  const handleSaveAnalystName = (name) => {
    setAnalystName(name);
    localStorage.setItem("disappear_analyst_name", name);
  };

  const fetchBacklog = async (overrideKey) => {
    const keyToUse = (overrideKey !== undefined ? overrideKey : adminKey).trim();
    if (!keyToUse) return;

    setLoading(true);
    setAuthError("");
    try {
      const res = await fetch(`${API_BASE_URL}/admin/ops/backlog`, {
        headers: { "X-Disappear-Admin-Key": keyToUse }
      });
      if (res.status === 403) {
        setAuthError("INVALID ADMIN SECRET KEY — ACCESS DENIED");
        setManualTasks([]);
        setCompletedTasks([]);
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setAuthError(`SERVER ERROR (${res.status}) — UNABLE TO FETCH QUEUE`);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setManualTasks(data.manual_processing_required || []);
      setCompletedTasks(data.completed_tasks || []);
      setLoading(false);
    } catch (e) {
      console.error("Admin fetch error", e);
      setAuthError("NETWORK / CONNECTION ERROR");
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
        // Move from manualTasks to completedTasks
        const resolvedTask = manualTasks.find(t => t.task_id === taskId);
        if (resolvedTask) {
          setCompletedTasks(prev => [{
            ...resolvedTask,
            status: "REMOVED",
            resolved_by: activeAnalyst,
            manual_instruction_url: link
          }, ...prev]);
        }
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
    : filterMode === 'COMPLETED'
    ? completedTasks
    : manualTasks;

  if (loading) return <div style={{color: 'white', textAlign: 'center'}}>ACCESSING CENTRAL COMMAND...</div>;

  return (
    <div className="price-box" style={{ maxWidth: '900px', width: '100%', margin: '0 auto', textAlign: 'left', maxHeight: '85vh', overflowY: 'auto' }}>
      <h2 className="tiger-text" style={{ marginBottom: '5px' }}>PRODUCTION OPERATIONS & TASK QUEUE</h2>
      <p className="field-label" style={{ marginBottom: '20px' }}>MULTI-ASSOCIATE MANUAL DATA REMOVAL CONSOLE</p>
      
      {/* Associate Identity & Security Credentials Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '15px', background: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div>
          <label style={{ fontSize: '0.75rem', color: '#94A3B8', display: 'block', marginBottom: '6px' }}>ADMIN SECRET KEY:</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="password" 
              name="disappear_ops_admin_secret_key_no_fill"
              id="disappear_ops_admin_secret_key_no_fill"
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              data-lpignore="true"
              data-1p-ignore="true"
              data-form-type="other"
              className="mask-btn" 
              placeholder="Enter Admin Secret Key..." 
              value={adminKey} 
              onChange={(e) => setAdminKey(e.target.value)} 
              style={{ flex: 1 }}
            />
            <button className="reset-btn" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => fetchBacklog()}>
              🔄 REFRESH
            </button>
          </div>
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

      {authError && (
        <div style={{ background: '#3b0712', border: '1px solid #7f1d1d', color: '#ff4444', padding: '12px', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '15px', fontWeight: 'bold', textAlign: 'center' }}>
          ⚠️ {authError}
        </div>
      )}

      {/* Queue Filter Navigation */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid #334155', paddingBottom: '12px', flexWrap: 'wrap' }}>
        <button 
          className="reset-btn" 
          style={{ padding: '8px 14px', fontSize: '0.82rem', borderColor: filterMode === 'ALL' ? '#00D2FF' : '#334155', color: filterMode === 'ALL' ? '#00D2FF' : '#94A3B8' }}
          onClick={() => setFilterMode('ALL')}
        >
          ALL QUEUED ({manualTasks.length})
        </button>
        <button 
          className="reset-btn" 
          style={{ padding: '8px 14px', fontSize: '0.82rem', borderColor: filterMode === 'UNASSIGNED' ? '#fbbf24' : '#334155', color: filterMode === 'UNASSIGNED' ? '#fbbf24' : '#94A3B8' }}
          onClick={() => setFilterMode('UNASSIGNED')}
        >
          UNASSIGNED ({unassignedTasks.length})
        </button>
        <button 
          className="reset-btn" 
          style={{ padding: '8px 14px', fontSize: '0.82rem', borderColor: filterMode === 'MY_TASKS' ? '#60a5fa' : '#334155', color: filterMode === 'MY_TASKS' ? '#60a5fa' : '#94A3B8' }}
          onClick={() => setFilterMode('MY_TASKS')}
        >
          MY CLAIMED ({myTasks.length})
        </button>
        <button 
          className="reset-btn" 
          style={{ padding: '8px 14px', fontSize: '0.82rem', borderColor: filterMode === 'COMPLETED' ? '#10b981' : '#334155', color: filterMode === 'COMPLETED' ? '#10b981' : '#94A3B8' }}
          onClick={() => setFilterMode('COMPLETED')}
        >
          COMPLETED TASKS ({completedTasks.length})
        </button>
      </div>

      {displayedTasks.length === 0 ? (
        <p style={{ color: '#10b981', fontFamily: 'Courier New', padding: '20px', textAlign: 'center' }}>
          {filterMode === 'UNASSIGNED' 
            ? "NO UNASSIGNED TASKS IN QUEUE." 
            : filterMode === 'MY_TASKS' 
            ? "YOU HAVE NO ACTIVE CLAIMED TASKS." 
            : filterMode === 'COMPLETED'
            ? "NO COMPLETED TASKS RECORDED YET."
            : "ALL QUEUES CLEAR."}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
          {displayedTasks.map((task) => {
            const isAssignedToMe = task.assigned_analyst && analystName.trim() && task.assigned_analyst.toLowerCase() === analystName.trim().toLowerCase();
            const isCompleted = task.status === "REMOVED";

            return (
              <div key={task.task_id} style={{ border: isCompleted ? '1px solid #10b981' : isAssignedToMe ? '1px solid #10b981' : task.assigned_analyst ? '1px solid #3b82f6' : '1px solid #334155', padding: '16px', borderRadius: '8px', background: isCompleted ? '#031a10' : '#05070E' }}>
                
                {/* Task Header & Associate Status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <strong style={{ color: '#00D2FF', fontSize: '1.05rem', letterSpacing: '1px' }}>BROKER: {task.broker_name}</strong>
                    
                    {isCompleted ? (
                      <span style={{ fontSize: '0.72rem', backgroundColor: '#064e3b', color: '#34d399', padding: '4px 10px', borderRadius: '4px', border: '1px solid #059669', fontWeight: 'bold' }}>
                        ✅ REMOVAL COMPLETED BY: {(task.resolved_by || "STAFF ANALYST").toUpperCase()}
                      </span>
                    ) : task.assigned_analyst ? (
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
                    {/* Claim / Release / Re-assign Task Controls */}
                    {!isCompleted && (!task.assigned_analyst ? (
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
                        style={{ padding: '5px 10px', fontSize: '0.75rem', color: '#fbbf24', borderColor: '#d97706' }}
                        onClick={() => handleUnclaimTask(task.task_id)}
                      >
                        ↩️ UNASSIGN / RELEASE TASK
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button 
                          className="reset-btn" 
                          style={{ padding: '4px 10px', fontSize: '0.75rem', color: '#ff6b6b', borderColor: '#ef4444' }}
                          onClick={() => handleUnclaimTask(task.task_id)}
                          title="Remove currently assigned associate and return task to unassigned queue"
                        >
                          ❌ UNASSIGN ASSOCIATE
                        </button>
                        <button 
                          className="reset-btn" 
                          style={{ padding: '4px 10px', fontSize: '0.75rem', color: '#60a5fa', borderColor: '#3b82f6' }}
                          onClick={() => handleClaimTask(task.task_id)}
                          title="Re-assign task directly to yourself"
                        >
                          ⚡ RE-ASSIGN TO ME
                        </button>
                      </div>
                    ))}

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

                {/* Proof Link Input or Completed Proof Display */}
                {isCompleted ? (
                  <div style={{ fontSize: '0.85rem', color: '#34d399', background: 'rgba(16,185,129,0.08)', padding: '10px 14px', borderRadius: '6px', border: '1px solid rgba(16,185,129,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span><strong>PROOF / VERIFICATION:</strong> {task.manual_instruction_url || "Confirmed Deleted by Staff Analyst"}</span>
                    {task.manual_instruction_url && task.manual_instruction_url.startsWith('http') && (
                      <a href={task.manual_instruction_url} target="_blank" rel="noopener noreferrer" style={{ color: '#34d399', textDecoration: 'underline', fontWeight: 'bold' }}>
                        VIEW PROOF LINK ↗
                      </a>
                    )}
                  </div>
                ) : (
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
                )}

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}