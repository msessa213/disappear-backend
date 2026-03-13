import React, { useState, useEffect } from 'react';

const AdminDashboard = ({ API_BASE_URL }) => {
  const [stats, setStats] = useState({ total_users: 0, total_cards: 0, total_removals: 0 });

  useEffect(() => {
    fetch(`${API_BASE_URL}/admin/stats`)
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(err => console.log("Admin fetch error"));
  }, [API_BASE_URL]);

  return (
    <div className="info-modal-content" style={{ border: '1px solid #0047AB' }}>
      <h2 className="tiger-text">CENTRAL COMMAND</h2>
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <span className="admin-stat-label">Global Agents</span>
          <span className="admin-stat-val">{stats.total_users}</span>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-label">Active Shields</span>
          <span className="admin-stat-val">{stats.total_cards}</span>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-label">Records Purged</span>
          <span className="admin-stat-val" style={{color: '#10b981'}}>{stats.total_removals}</span>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;