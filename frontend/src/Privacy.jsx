import React from 'react';

// Use "export const" instead of "const"
export const Privacy = () => {
  return (
    <div className="legal-document">
      <h2 className="tiger-text">PRIVACY POLICY</h2>
      <p><strong>Effective Date: March 13, 2026</strong></p>
      
      <h3 style={{ color: 'white', marginTop: '20px' }}>I. DATA MINIMIZATION</h3>
      <p>Disappear operates on a "Zero-Knowledge" trajectory. We only collect the minimum amount of data required by law to provide financial services.</p>
      
      <h3 style={{ color: 'white', marginTop: '20px' }}>II. ENCRYPTED STORAGE</h3>
      <p>Your "Target Profile" data is used solely for the removal of your PII from data broker sites. This data is encrypted at rest and is never sold to third parties.</p>
      
      <h3 style={{ color: 'white', marginTop: '20px' }}>III. THE PURGE</h3>
      <p>Users have the right to initiate a "Total Purge." This action burns all active virtual cards and deletes your profile data from our active removal queues.</p>
    </div>
  );
};

// IMPORTANT: Do NOT include "export default Privacy" at the bottom anymore.