import React, { useState, useEffect } from 'react';

export default function AdminDashboard({ API_BASE_URL }) {
  const [manualTasks, setManualTasks] = useState([]);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [verifications, setVerifications] = useState({});
  const [adminKey, setAdminKey] = useState("");
  const [analystName, setAnalystName] = useState(localStorage.getItem("disappear_analyst_name") || "");
  const [filterMode, setFilterMode] = useState("ALL"); // 'ALL', 'UNASSIGNED', 'MY_TASKS', 'COMPLETED'
  const [searchQuery, setSearchQuery] = useState(""); // Live search query
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // --- COUPON MANAGEMENT STATES ---
  const [coupons, setCoupons] = useState([]);
  const [newCouponCode, setNewCouponCode] = useState("");
  const [newDiscountType, setNewDiscountType] = useState("percent");
  const [newDiscountValue, setNewDiscountValue] = useState("");
  const [newDuration, setNewDuration] = useState("permanent");
  const [couponStatusMsg, setCouponStatusMsg] = useState("");

  const [copiedTaskId, setCopiedTaskId] = useState(null);

  const handleCopyListingUrl = (taskId, url) => {
    if (!url) return;
    try {
      navigator.clipboard.writeText(url);
      setCopiedTaskId(taskId);
      setTimeout(() => setCopiedTaskId(null), 2500);
    } catch (e) {
      console.error("Copy error", e);
    }
  };

  const [editingListingUrls, setEditingListingUrls] = useState({});

  const handleSaveListingUrl = async (taskId) => {
    const newUrl = editingListingUrls[taskId];
    if (!newUrl || !newUrl.trim()) return;

    try {
      const res = await fetch(`${API_BASE_URL}/admin/ops/update-listing-url/${taskId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Disappear-Admin-Key": cleanHeaderKey(adminKey)
        },
        body: JSON.stringify({ target_listing_url: newUrl.trim() })
      });
      if (res.ok) {
        alert("Target Listing URL saved successfully!");
        fetchBacklog(adminKey);
      }
    } catch (e) {
      console.error("Save listing URL error", e);
    }
  };

  const cleanHeaderKey = (val) => {
    if (!val) return "";
    return String(val).trim().replace(/[^\x20-\x7E]/g, "");
  };

  const handleSaveAnalystName = (name) => {
    setAnalystName(name);
    localStorage.setItem("disappear_analyst_name", name);
  };

  const fetchBacklog = async (overrideKey) => {
    const rawKey = overrideKey !== undefined ? overrideKey : adminKey;
    const keyToUse = cleanHeaderKey(rawKey);
    if (!keyToUse) {
      setAuthError("PLEASE ENTER YOUR PRODUCTION ADMIN SECRET KEY.");
      return false;
    }

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
        setIsAuthenticated(false);
        return false;
      }
      if (!res.ok) {
        setAuthError(`SERVER ERROR (${res.status}) — UNABLE TO FETCH QUEUE`);
        setLoading(false);
        return false;
      }
      const data = await res.json();
      setManualTasks(data.manual_processing_required || []);
      setCompletedTasks(data.completed_tasks || []);
      setLoading(false);
      setIsAuthenticated(true);

      fetchCoupons(keyToUse);
      return true;
    } catch (e) {
      console.error("Admin fetch error", e);
      setAuthError("NETWORK / CONNECTION ERROR");
      setLoading(false);
      return false;
    }
  };

  const fetchCoupons = async (keyToUse) => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/coupons`, {
        headers: { "X-Disappear-Admin-Key": keyToUse }
      });
      if (res.ok) {
        const data = await res.json();
        setCoupons(data || []);
      }
    } catch (e) {
      console.error("Error fetching coupons", e);
    }
  };

  const handleCreateCoupon = async (e) => {
    if (e) e.preventDefault();
    setCouponStatusMsg("");

    const codeClean = newCouponCode.trim().toUpperCase();
    if (!codeClean) {
      setCouponStatusMsg("❌ COUPON CODE CANNOT BE EMPTY.");
      return;
    }

    const val = parseFloat(newDiscountValue);
    if (isNaN(val) || val <= 0) {
      setCouponStatusMsg("❌ PLEASE ENTER A VALID DISCOUNT VALUE GREATER THAN 0.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/admin/coupons`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Disappear-Admin-Key": cleanHeaderKey(adminKey)
        },
        body: JSON.stringify({
          code: codeClean,
          discount_type: newDiscountType,
          discount_value: val,
          duration: newDuration
        })
      });

      if (res.ok) {
        setCouponStatusMsg(`✅ COUPON '${codeClean}' CREATED SUCCESSFULLY!`);
        setNewCouponCode("");
        setNewDiscountValue("");
        fetchCoupons(cleanHeaderKey(adminKey));
      } else {
        const errData = await res.json();
        setCouponStatusMsg(`❌ ERROR: ${errData.detail || 'FAILED TO CREATE COUPON'}`);
      }
    } catch (e) {
      console.error("Create coupon error", e);
      setCouponStatusMsg("❌ NETWORK ERROR CREATING COUPON.");
    }
  };

  const handleDeleteCoupon = async (couponId) => {
    if (!window.confirm("Deactivate this coupon code?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/coupons/${couponId}`, {
        method: "DELETE",
        headers: { "X-Disappear-Admin-Key": cleanHeaderKey(adminKey) }
      });
      if (res.ok) {
        fetchCoupons(cleanHeaderKey(adminKey));
      }
    } catch (e) {
      console.error("Delete coupon error", e);
    }
  };

  const handleAssociateLogin = async (e) => {
    if (e) e.preventDefault();
    if (!analystName.trim()) {
      setAuthError("PLEASE ENTER YOUR ASSOCIATE / ANALYST NAME.");
      return;
    }
    handleSaveAnalystName(analystName.trim());
    const ok = await fetchBacklog(adminKey);
    if (ok) {
      window.location.hash = "#admin";
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setAdminKey("");
    setManualTasks([]);
    setCompletedTasks([]);
    window.location.hash = "#admin/login";
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
          "X-Disappear-Admin-Key": cleanHeaderKey(adminKey)
        },
        body: JSON.stringify({ analyst_name: activeAnalyst })
      });
      if (res.ok) {
        fetchBacklog(adminKey);
      } else {
        alert("Unable to claim task.");
      }
    } catch (e) {
      console.error("Claim error", e);
    }
  };

  const handleClaimAndLaunch = async (task) => {
    await handleClaimTask(task.task_id);
    const targetUrl = task.opt_out_url || `https://www.google.com/search?q=${task.broker_name}+opt+out+form`;
    window.open(targetUrl, '_blank');
  };

  const handleUnclaimTask = async (taskId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/ops/unclaim/${taskId}`, {
        method: "POST",
        headers: { 
          "X-Disappear-Admin-Key": cleanHeaderKey(adminKey)
        }
      });
      if (res.ok) {
        fetchBacklog(adminKey);
      }
    } catch (e) {
      console.error("Unclaim error", e);
    }
  };

  const handleResolve = async (taskId) => {
    const proofUrl = verifications[taskId] || "";
    const activeAnalyst = analystName.trim() || "STAFF_ANALYST";

    try {
      let res = await fetch(`${API_BASE_URL}/admin/ops/verify/${taskId}`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Disappear-Admin-Key": cleanHeaderKey(adminKey)
        },
        body: JSON.stringify({ 
          verification_link: proofUrl,
          notes: "Manual Opt-Out Form Submitted & Confirmed by Analyst",
          analyst_name: activeAnalyst
        })
      });

      if (!res.ok) {
        res = await fetch(`${API_BASE_URL}/admin/ops/resolve/${taskId}`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "X-Disappear-Admin-Key": cleanHeaderKey(adminKey)
          },
          body: JSON.stringify({ 
            verification_link: proofUrl,
            notes: "Manual Opt-Out Form Submitted & Confirmed by Analyst",
            analyst_name: activeAnalyst
          })
        });
      }

      if (res.ok) {
        alert(`Task #${taskId} successfully marked COMPLETE and verified!`);
        fetchBacklog(adminKey);
      } else {
        alert("Error verifying task completion.");
      }
    } catch (e) {
      console.error("Resolve error", e);
    }
  };

  // Filter & Search task list
  const getFilteredTasks = () => {
    let tasks = manualTasks;
    if (filterMode === 'UNASSIGNED') {
      tasks = manualTasks.filter(t => !t.assigned_analyst);
    } else if (filterMode === 'MY_TASKS') {
      tasks = manualTasks.filter(t => t.assigned_analyst && analystName.trim() && t.assigned_analyst.toLowerCase() === analystName.trim().toLowerCase());
    } else if (filterMode === 'COMPLETED') {
      tasks = completedTasks;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      tasks = tasks.filter(t => {
        const brokerMatch = t.broker_name && t.broker_name.toLowerCase().includes(q);
        const nameMatch = t.target_profile && `${t.target_profile.first_name} ${t.target_profile.last_name}`.toLowerCase().includes(q);
        const emailMatch = t.target_profile && t.target_profile.email && t.target_profile.email.toLowerCase().includes(q);
        return brokerMatch || nameMatch || emailMatch;
      });
    }

    return tasks;
  };

  const displayedTasks = getFilteredTasks();
  const unassignedCount = manualTasks.filter(t => !t.assigned_analyst).length;
  const myTasksCount = manualTasks.filter(t => t.assigned_analyst && analystName.trim() && t.assigned_analyst.toLowerCase() === analystName.trim().toLowerCase()).length;

  if (!isAuthenticated) {
    return (
      <div className="app-container" style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div className="pricing-card" style={{ maxWidth: '480px', width: '100%', border: '1px solid #00D2FF' }}>
          <h2 className="tiger-text" style={{ textAlign: 'center', marginBottom: '10px' }}>CENTRAL COMMAND ACCESS</h2>
          <p style={{ color: '#94A3B8', fontSize: '0.85rem', textAlign: 'center', marginBottom: '25px' }}>
            OPERATIONS ANALYST & COUPON MANAGEMENT PORTAL
          </p>

          {authError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#ff6b6b', padding: '10px 14px', borderRadius: '6px', fontSize: '0.82rem', marginBottom: '20px', textAlign: 'center' }}>
              {authError}
            </div>
          )}

          <form onSubmit={handleAssociateLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: '#00D2FF', letterSpacing: '1px', display: 'block', marginBottom: '5px' }}>ANALYST / ASSOCIATE NAME</label>
              <input 
                className="mask-btn" 
                placeholder="e.g. Analyst_Alpha" 
                style={{ width: '100%' }}
                value={analystName}
                onChange={(e) => setAnalystName(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: '#00D2FF', letterSpacing: '1px', display: 'block', marginBottom: '5px' }}>PRODUCTION ADMIN SECRET KEY</label>
              <input 
                type="password"
                className="mask-btn" 
                placeholder="Enter Admin Key..." 
                style={{ width: '100%' }}
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="main-button" style={{ width: '100%', marginTop: '10px' }} disabled={loading}>
              {loading ? "AUTHENTICATING..." : "AUTHENTICATE & ENTER PORTAL"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Top Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', paddingBottom: '15px', borderBottom: '1px solid rgba(0, 210, 255, 0.2)', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 className="tiger-text" style={{ margin: 0 }}>OPERATIONS COMMAND</h2>
          <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
            LOGGED IN AS: <strong style={{ color: '#00D2FF' }}>{analystName.toUpperCase()}</strong>
          </span>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button className="main-button" style={{ height: '38px', padding: '0 16px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => fetchBacklog(adminKey)}>
            🔄 REFRESH QUEUE
          </button>
          <button className="reset-btn" style={{ height: '38px', padding: '0 16px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onClick={handleLogout}>
            🚪 LOGOUT
          </button>
        </div>
      </div>

      {/* --- COUPON MANAGEMENT PANEL --- */}
      <div className="pricing-card" style={{ marginBottom: '30px', border: '1px solid var(--tiger-blue)' }}>
        <h3 className="tiger-text" style={{ marginBottom: '15px' }}>🎟️ COUPON & PROMO CODE MANAGEMENT</h3>
        
        {couponStatusMsg && (
          <div style={{ padding: '10px 14px', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '15px', background: couponStatusMsg.startsWith('✅') ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${couponStatusMsg.startsWith('✅') ? '#10b981' : '#ef4444'}`, color: couponStatusMsg.startsWith('✅') ? '#34d399' : '#ff6b6b' }}>
            {couponStatusMsg}
          </div>
        )}

        {/* Create Coupon Form */}
        <form onSubmit={handleCreateCoupon} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '15px', alignItems: 'flex-start', marginBottom: '20px', background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '0.75rem', color: '#94A3B8', marginBottom: '6px', fontWeight: 'bold' }}>COUPON CODE</label>
            <input 
              className="mask-btn" 
              placeholder="e.g. TACTICAL50" 
              style={{ width: '100%', textTransform: 'uppercase', height: '42px', boxSizing: 'border-box', margin: 0 }}
              value={newCouponCode}
              onChange={(e) => setNewCouponCode(e.target.value.toUpperCase())}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '0.75rem', color: '#94A3B8', marginBottom: '6px', fontWeight: 'bold' }}>DISCOUNT TYPE</label>
            <select 
              className="mask-btn" 
              style={{ width: '100%', color: '#FFF', background: '#0D1117', height: '42px', boxSizing: 'border-box', margin: 0 }}
              value={newDiscountType}
              onChange={(e) => setNewDiscountType(e.target.value)}
            >
              <option value="percent">Percentage (%) Off</option>
              <option value="amount">Fixed Dollar ($) Off</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '0.75rem', color: '#94A3B8', marginBottom: '6px', fontWeight: 'bold' }}>DISCOUNT VALUE</label>
            <input 
              type="number"
              step="0.01"
              className="mask-btn" 
              placeholder="e.g. 50 or 5.95" 
              style={{ width: '100%', height: '42px', boxSizing: 'border-box', margin: 0 }}
              value={newDiscountValue}
              onChange={(e) => setNewDiscountValue(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '0.75rem', color: '#94A3B8', marginBottom: '6px', fontWeight: 'bold' }}>DURATION</label>
            <select 
              className="mask-btn" 
              style={{ width: '100%', color: '#FFF', background: '#0D1117', height: '42px', boxSizing: 'border-box', margin: 0 }}
              value={newDuration}
              onChange={(e) => setNewDuration(e.target.value)}
            >
              <option value="permanent">Permanent (Every Month)</option>
              <option value="one_month">1-Month Promo Discount</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '0.75rem', color: 'transparent', marginBottom: '6px', userSelect: 'none' }}>ACTION</label>
            <button 
              type="submit" 
              className="main-button" 
              style={{ height: '42px', width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', margin: 0, padding: '0 16px', fontSize: '0.82rem', whiteSpace: 'nowrap' }}
            >
              ➕ CREATE COUPON
            </button>
          </div>
        </form>

        {/* Existing Coupons Table */}
        <h4 style={{ color: '#00D2FF', fontSize: '0.9rem', marginBottom: '10px' }}>ACTIVE COUPONS</h4>
        {coupons.filter(c => c.active).length === 0 ? (
          <p style={{ color: '#64748B', fontSize: '0.85rem', fontStyle: 'italic' }}>No active coupons created yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(0,210,255,0.3)', color: '#94A3B8' }}>
                  <th style={{ padding: '8px' }}>CODE</th>
                  <th style={{ padding: '8px' }}>DISCOUNT</th>
                  <th style={{ padding: '8px' }}>DURATION</th>
                  <th style={{ padding: '8px' }}>STATUS</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {coupons.filter(c => c.active).map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '8px', color: '#00D2FF', fontWeight: 'bold' }}>{c.code}</td>
                    <td style={{ padding: '8px', color: '#FFF' }}>
                      {c.discount_type === 'percent' ? `${c.discount_value}% OFF` : `$${c.discount_value.toFixed(2)} OFF`}
                    </td>
                    <td style={{ padding: '8px', color: c.duration === 'permanent' ? '#34d399' : '#fbbf24' }}>
                      {c.duration === 'permanent' ? '♾️ Permanent (Every Month)' : '⏳ 1-Month Promo'}
                    </td>
                    <td style={{ padding: '8px', color: '#34d399' }}>ACTIVE</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>
                      <button 
                        className="reset-btn" 
                        style={{ padding: '3px 8px', fontSize: '0.75rem', color: '#ff6b6b', borderColor: '#ef4444' }}
                        onClick={() => handleDeleteCoupon(c.id)}
                      >
                        ❌ DELETE
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- LIVE SEARCH & FILTER CONTROL BAR --- */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
        
        {/* Navigation Filter Tabs */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button 
            className={filterMode === 'ALL' ? "main-button" : "reset-btn"}
            style={{ height: '38px', padding: '0 16px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', margin: 0 }}
            onClick={() => setFilterMode('ALL')}
          >
            📋 ALL PENDING ({manualTasks.length})
          </button>

          <button 
            className={filterMode === 'UNASSIGNED' ? "main-button" : "reset-btn"}
            style={{ height: '38px', padding: '0 16px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', margin: 0, borderColor: unassignedCount > 0 ? '#fbbf24' : undefined }}
            onClick={() => setFilterMode('UNASSIGNED')}
          >
            ⚠️ UNASSIGNED ({unassignedCount})
          </button>

          <button 
            className={filterMode === 'MY_TASKS' ? "main-button" : "reset-btn"}
            style={{ height: '38px', padding: '0 16px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', margin: 0 }}
            onClick={() => setFilterMode('MY_TASKS')}
          >
            👤 MY CLAIMED ({myTasksCount})
          </button>

          <button 
            className={filterMode === 'COMPLETED' ? "main-button" : "reset-btn"}
            style={{ height: '38px', padding: '0 16px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', margin: 0, borderColor: '#10b981' }}
            onClick={() => setFilterMode('COMPLETED')}
          >
            ✅ COMPLETED ({completedTasks.length})
          </button>
        </div>

        {/* Live Search Input */}
        <div style={{ minWidth: '260px', flex: 1, maxWidth: '400px' }}>
          <input 
            className="mask-btn" 
            placeholder="🔍 Search Customer, Email, or Broker..." 
            style={{ width: '100%', height: '38px', boxSizing: 'border-box', margin: 0, fontSize: '0.82rem' }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

      </div>

      {displayedTasks.length === 0 ? (
        <p style={{ color: '#10b981', fontFamily: 'Courier New', padding: '30px', textAlign: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
          {searchQuery 
            ? `NO TASKS MATCHING SEARCH QUERY '${searchQuery.toUpperCase()}'.`
            : filterMode === 'UNASSIGNED' 
            ? "NO UNASSIGNED TASKS IN QUEUE." 
            : filterMode === 'MY_TASKS' 
            ? "YOU HAVE NO ACTIVE CLAIMED TASKS." 
            : filterMode === 'COMPLETED'
            ? "NO COMPLETED TASKS RECORDED YET."
            : "ALL QUEUES CLEAR — NO PENDING REMOVAL TASKS."}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
          {displayedTasks.map((task) => {
            const isAssignedToMe = task.assigned_analyst && analystName.trim() && task.assigned_analyst.toLowerCase() === analystName.trim().toLowerCase();
            const isCompleted = task.status === "REMOVED";

            return (
              <div key={task.task_id} style={{ border: isCompleted ? '1px solid #10b981' : isAssignedToMe ? '1px solid #10b981' : task.assigned_analyst ? '1px solid #3b82f6' : '1px solid #d97706', padding: '18px', borderRadius: '8px', background: isCompleted ? '#031a10' : '#05070E' }}>
                
                {/* Task Header & Associate Status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <strong style={{ color: '#00D2FF', fontSize: '1.1rem', letterSpacing: '1px' }}>BROKER: {task.broker_name}</strong>
                    
                    {isCompleted ? (
                      <span style={{ fontSize: '0.75rem', backgroundColor: '#064e3b', color: '#34d399', padding: '4px 10px', borderRadius: '4px', border: '1px solid #059669', fontWeight: 'bold' }}>
                        ✅ REMOVAL COMPLETED BY: {(task.resolved_by || "STAFF ANALYST").toUpperCase()}
                      </span>
                    ) : task.assigned_analyst ? (
                      <span style={{ fontSize: '0.75rem', backgroundColor: isAssignedToMe ? '#064e3b' : '#1e3a8a', color: isAssignedToMe ? '#34d399' : '#60a5fa', padding: '4px 10px', borderRadius: '4px', border: `1px solid ${isAssignedToMe ? '#059669' : '#2563eb'}`, fontWeight: 'bold' }}>
                        👤 ASSIGNED TO: {task.assigned_analyst.toUpperCase()}
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', backgroundColor: '#451a03', color: '#fbbf24', padding: '4px 10px', borderRadius: '4px', border: '1px solid #d97706', fontWeight: 'bold' }}>
                        ⚠️ UNASSIGNED TASK
                      </span>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {!isCompleted && (!task.assigned_analyst ? (
                      <button 
                        className="main-button" 
                        style={{ height: '34px', padding: '0 14px', fontSize: '0.78rem', background: 'linear-gradient(135deg, #d97706, #b45309)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', margin: 0 }}
                        onClick={() => handleClaimTask(task.task_id)}
                        title="Claim this task for yourself"
                      >
                        🎯 CLAIM TASK
                      </button>
                    ) : isAssignedToMe ? (
                      <button 
                        className="reset-btn" 
                        style={{ height: '34px', padding: '0 12px', fontSize: '0.75rem', color: '#fbbf24', borderColor: '#d97706', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', margin: 0 }}
                        onClick={() => handleUnclaimTask(task.task_id)}
                      >
                        ↩️ UNASSIGN / RELEASE TASK
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button 
                          className="reset-btn" 
                          style={{ height: '34px', padding: '0 10px', fontSize: '0.75rem', color: '#ff6b6b', borderColor: '#ef4444', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', margin: 0 }}
                          onClick={() => handleUnclaimTask(task.task_id)}
                          title="Remove currently assigned associate and return task to unassigned queue"
                        >
                          ❌ UNASSIGN ASSOCIATE
                        </button>
                        <button 
                          className="reset-btn" 
                          style={{ height: '34px', padding: '0 10px', fontSize: '0.75rem', color: '#60a5fa', borderColor: '#3b82f6', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', margin: 0 }}
                          onClick={() => handleClaimTask(task.task_id)}
                          title="Re-assign task directly to yourself"
                        >
                          ⚡ RE-ASSIGN TO ME
                        </button>
                      </div>
                    ))}

                    <a 
                      href={task.opt_out_url || `https://www.google.com/search?q=${task.broker_name}+opt+out+form`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="main-button" 
                      style={{ textDecoration: 'none', height: '34px', padding: '0 14px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxSizing: 'border-box', margin: 0 }}
                      title="Open direct broker data removal form"
                    >
                      🌐 LAUNCH OPT-OUT FORM
                    </a>

                    {task.target_listing_url && !task.target_listing_url.includes('google.com/search') && (
                      <a 
                        href={task.target_listing_url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="reset-btn" 
                        style={{ textDecoration: 'none', height: '34px', padding: '0 12px', fontSize: '0.78rem', color: '#00D2FF', borderColor: '#00D2FF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxSizing: 'border-box', margin: 0 }}
                        title="Open customer's exact broker profile listing page"
                      >
                        🎯 LAUNCH TARGET LISTING
                      </a>
                    )}
                  </div>
                </div>
                
                {/* Target Customer PII Details Card */}
                <div style={{ fontSize: '0.88rem', color: '#cbd5e1', marginBottom: '12px', background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                  <div><strong style={{ color: '#00D2FF' }}>CUSTOMER NAME:</strong> <br/><span style={{ color: '#FFF', fontSize: '1rem', fontWeight: 'bold' }}>{task.target_profile.first_name} {task.target_profile.middle_name} {task.target_profile.last_name}</span></div>
                  <div><strong style={{ color: '#00D2FF' }}>EMAIL ADDRESS:</strong> <br/><span style={{ color: '#FFF' }}>{task.target_profile.email}</span></div>
                  <div><strong style={{ color: '#00D2FF' }}>DATE OF BIRTH:</strong> <br/><span style={{ color: '#FFF' }}>{task.target_profile.dob}</span></div>
                  <div><strong style={{ color: '#00D2FF' }}>STREET ADDRESS:</strong> <br/><span style={{ color: '#FFF' }}>{task.target_profile.address}</span></div>
                </div>

                {/* Target Listing URL & Listing Finder Section */}
                <div style={{ fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '15px', background: 'rgba(0, 210, 255, 0.05)', padding: '12px 14px', borderRadius: '6px', border: '1px solid rgba(0, 210, 255, 0.2)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ flex: 1, minWidth: '240px' }}>
                      <strong style={{ color: '#00D2FF', letterSpacing: '0.5px' }}>🎯 BROKER TARGET LISTING PAGE URL:</strong>
                      <div style={{ color: '#FFF', wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '0.85rem', marginTop: '4px' }}>
                        {task.target_listing_url || "No direct profile listing URL saved yet."}
                      </div>
                    </div>
                    
                    {task.target_listing_url && (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button 
                          className="reset-btn" 
                          style={{ height: '32px', padding: '0 12px', fontSize: '0.75rem', color: copiedTaskId === task.task_id ? '#34d399' : '#00D2FF', borderColor: copiedTaskId === task.task_id ? '#10b981' : '#00D2FF', display: 'inline-flex', alignItems: 'center', gap: '4px', boxSizing: 'border-box', margin: 0 }}
                          onClick={() => handleCopyListingUrl(task.task_id, task.target_listing_url)}
                        >
                          {copiedTaskId === task.task_id ? "✅ COPIED!" : "📋 COPY LISTING URL"}
                        </button>
                      </div>
                    )}
                  </div>

                  {!isCompleted && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <input 
                        className="mask-btn" 
                        placeholder="Paste exact custom profile listing URL (e.g. Whitepages wpId=...)..." 
                        style={{ flex: 1, height: '32px', fontSize: '0.78rem', boxSizing: 'border-box', margin: 0 }}
                        value={editingListingUrls[task.task_id] !== undefined ? editingListingUrls[task.task_id] : (task.target_listing_url || "")}
                        onChange={(e) => setEditingListingUrls({...editingListingUrls, [task.task_id]: e.target.value})}
                      />
                      <button 
                        className="main-button" 
                        style={{ height: '32px', padding: '0 12px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', margin: 0, whiteSpace: 'nowrap' }}
                        onClick={() => handleSaveListingUrl(task.task_id)}
                      >
                        💾 SAVE CUSTOM LISTING URL
                      </button>
                    </div>
                  )}
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
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch' }}>
                    <input 
                      className="mask-btn" 
                      placeholder="Paste Removal Confirmation Link / Proof URL..." 
                      style={{ flex: 1, height: '42px', boxSizing: 'border-box', margin: 0 }}
                      value={verifications[task.task_id] || ""}
                      onChange={(e) => setVerifications({...verifications, [task.task_id]: e.target.value})}
                    />
                    <button className="reset-btn" style={{ borderColor: '#10b981', color: '#10b981', fontWeight: 'bold', height: '42px', padding: '0 18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', margin: 0, whiteSpace: 'nowrap' }} onClick={() => handleResolve(task.task_id)}>
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