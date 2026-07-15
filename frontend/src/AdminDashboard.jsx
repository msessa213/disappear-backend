import React, { useState, useEffect } from 'react';

export default function AdminDashboard({ API_BASE_URL }) {
  const [manualTasks, setManualTasks] = useState([]);
  const [verifications, setVerifications] = useState({});
  const [adminKey, setAdminKey] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (adminKey) fetchBacklog();
  }, [adminKey]);

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

  const handleResolve = async (taskId) => {
    const link = verifications[taskId] || "";
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/complete-manual-scrub/${taskId}`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Disappear-Admin-Key": adminKey
        },
        body: JSON.stringify({ verification_link: link, notes: "Processed via Admin Panel" })
      });
      
      if (res.ok) {
        // Remove from list
        setManualTasks(prev => prev.filter(t => t.task_id !== taskId));
      }
    } catch (e) {
      alert("Error resolving task.");
    }
  };

  if (loading) return <div style={{color: 'white', textAlign: 'center'}}>ACCESSING CENTRAL COMMAND...</div>;

  return (
    <div className="price-box" style={{ maxWidth: '800px', width: '100%', margin: '0 auto', textAlign: 'left', maxHeight: '80vh', overflowY: 'auto' }}>
      <h2 className="tiger-text">MANUAL REMOVAL INBOX</h2>
      <p className="field-label" style={{ marginBottom: '20px' }}>TASKS REQUIRING HUMAN VERIFICATION: {manualTasks.length}</p>
      
      <input 
        type="password" 
        className="mask-btn" 
        placeholder="Enter Admin Secret Key..." 
        value={adminKey} 
        onChange={(e) => setAdminKey(e.target.value)} 
        style={{ marginBottom: '20px' }}
      />

      {manualTasks.length === 0 ? (
        <p style={{ color: '#10b981', fontFamily: 'Courier New' }}>ALL QUEUES CLEAR.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
          {manualTasks.map((task) => (
            <div key={task.task_id} style={{ border: '1px solid #334155', padding: '15px', borderRadius: '8px', background: '#050505' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <strong style={{ color: 'white' }}>BROKER: {task.broker_name}</strong>
                  <span style={{ fontSize: '0.68rem', backgroundColor: '#3b0712', color: '#ff4444', padding: '2px 8px', borderRadius: '4px', border: '1px solid #7f1d1d', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Requires Manual Submission Form</span>
                </div>
                <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>{new Date(task.submitted_at).toLocaleDateString()}</span>
              </div>
              
              <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '15px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                <span><strong>TARGET:</strong> {task.target_profile.first_name} {task.target_profile.last_name}</span>
                <span><strong>DOB:</strong> {task.target_profile.dob}</span>
                <span><strong>EMAIL:</strong> {task.target_profile.email}</span>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <input 
                  className="mask-btn" 
                  placeholder="Paste URL/Confirmation Link here..." 
                  style={{ flex: 1 }}
                  value={verifications[task.task_id] || ""}
                  onChange={(e) => setVerifications({...verifications, [task.task_id]: e.target.value})}
                />
                <button className="reset-btn" onClick={() => handleResolve(task.task_id)}>MARK COMPLETE</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}