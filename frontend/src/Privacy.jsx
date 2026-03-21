import React from 'react';

// Use "export const" instead of "const"
export const Privacy = () => {
  return (
    <div className="legal-document">
      <h2 className="tiger-text">PRIVACY POLICY [v2026.1]</h2>
      <p><strong>Effective Date: March 20, 2026</strong></p>
      
      <h3 style={{ color: 'white', marginTop: '20px' }}>I. DATA MINIMIZATION & ZERO-KNOWLEDGE</h3>
      <p>
        Disappear operates on a "Zero-Knowledge" trajectory. We only collect the 
        absolute minimum amount of data required to provide our privacy services. 
        Once your "Target Profile" is ingested for scrubbing, the raw data is 
        encrypted and sequestered from the active application layer.
      </p>
      
      <h3 style={{ color: 'white', marginTop: '20px' }}>II. DATA BROKER REMOVAL & THE DELETE ACT</h3>
      <p>
        In compliance with 2026 privacy statutes and the California Delete Act, 
        Disappear acts as your authorized agent to interface with the 
        <strong> DROP (Delete Request and Opt-out Platform)</strong>. Your profile 
        data is used solely to facilitate the mandatory removal of your PII from 
        data broker registries, effectively starving the databases that fuel 
        scam call networks and phishing ecosystems.
      </p>

      <h3 style={{ color: 'white', marginTop: '20px' }}>III. ALIAS NODES & TELEMETRY</h3>
      <p>
        Telemetry for your <strong>Encrypted Phone Aliases</strong> and 
        <strong> Burnable Email Nodes</strong> is encrypted at rest using AES-256. 
        Disappear does not monitor, log, or sell the content of communications 
        passing through these nodes. By using these aliases, you ensure that 
        merchant-side data breaches never lead back to your primary personal inbox 
        or mobile device.
      </p>
      
      <h3 style={{ color: 'white', marginTop: '20px' }}>IV. THE TOTAL PURGE</h3>
      <p>
        Users maintain total sovereignty over their digital footprint. At any 
        time, you may initiate a <strong>"Total Purge."</strong> This action 
        executes an irreversible "Emergency Burn," destroying all active 
        virtual cards, cycling all aliases, and permanently deleting your 
        profile data from our active removal queues.
      </p>

      <p style={{ marginTop: '30px', fontStyle: 'italic', color: 'var(--tiger-blue)', fontSize: '0.8rem' }}>
        Your data belongs to you. We just provide the exit.
      </p>
    </div>
  );
};

// IMPORTANT: Do NOT include "export default Privacy" at the bottom anymore.