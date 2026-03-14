import React from 'react';

// Use "export const" instead of "const"
export const Terms = () => {
  return (
    <div className="legal-document">
      <h2 className="tiger-text">TERMS OF SERVICE</h2>
      
      <h3 style={{ color: 'white', marginTop: '20px' }}>1. SERVICE DESCRIPTION</h3>
      <p>Disappear provides a software interface for virtual payment aliases. Financial services are provided via regulated banking partners.</p>
      
      <h3 style={{ color: 'white', marginTop: '20px' }}>2. USER RESPONSIBILITY</h3>
      <p>While Disappear provides privacy "shields," the user remains responsible for all transactions and legal obligations incurred while using the service.</p>
      
      <h3 style={{ color: 'white', marginTop: '20px' }}>3. TERMINATION (THE BURN)</h3>
      <p>Burning a card immediately stops all future authorizations. It is the user's responsibility to update billing information with merchants if a legitimate debt is owed.</p>
    </div>
  );
};

// IMPORTANT: Do NOT include "export default Terms" at the bottom anymore.