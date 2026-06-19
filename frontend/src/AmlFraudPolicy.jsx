import React from 'react';

// Use "export const" instead of "const"
export const AmlFraudPolicy = () => {
  return (
    <div className="legal-document">
      <h2 className="tiger-text">AML & FRAUD PREVENTION POLICY [v2026.1]</h2>
      <p><strong>Effective Date: March 20, 2026</strong></p>

      <h3 style={{ color: 'white', marginTop: '20px' }}>I. ANTI-MONEY LAUNDERING (AML) COMPLIANCE</h3>
      <p>
        Disappear is committed to the highest standards of financial integrity and compliance. 
        While our service provides digital privacy shields, burnable aliases, and virtual payment 
        cards, we strictly prohibit the use of our services to facilitate, disguise, or execute 
        money laundering, terrorist financing, or sanction evasion. 
      </p>

      <h3 style={{ color: 'white', marginTop: '20px' }}>II. IDENTITY VERIFICATION & KYC PROTOCOLS</h3>
      <p>
        To preserve the safety and legitimacy of the network, user registration and 
        creation of virtual payment cards are subject to Know Your Customer (KYC) and 
        Customer Identification Programs (CIP). In accordance with applicable 2026 financial 
        regulations, we or our regulated banking partners may require verification of your physical identity. 
        All verification data is encrypted using zero-knowledge protocols and is sequestered from 
        the active public marketing intelligence layers.
      </p>

      <h3 style={{ color: 'white', marginTop: '20px' }}>III. FRAUD DETECTION & TRANSACTION VELOCITY</h3>
      <p>
        Our core systems implement advanced, real-time risk modeling and velocity monitoring. 
        Any attempt to use virtual shielding cards, Encrypted Phone Aliases, or Burnable Email Nodes 
        for deceptive practices, unauthorized billing schemes, or chargeback manipulation 
        will result in immediate termination of the offending assets under our <strong>"Emergency Burn"</strong> 
        protocols and the permanent blacklisting of the user account.
      </p>

      <h3 style={{ color: 'white', marginTop: '20px' }}>IV. PROHIBITED ACTIVITIES</h3>
      <p>
        The following actions are strictly prohibited on the Disappear network:
      </p>
      <ul style={{ marginTop: '10px', color: '#cbd5e1' }}>
        <li>Structuring transactions to evade regulatory reporting thresholds.</li>
        <li>Registering accounts using synthetic, stolen, or spoofed identification documents.</li>
        <li>Conducting illegal commercial operations or fraudulent card-not-present transactions.</li>
        <li>Utilizing communications nodes to orchestrate social engineering or phishing campaigns.</li>
      </ul>

      <h3 style={{ color: 'white', marginTop: '20px' }}>V. LEGAL COOPERATION & ASSET FORFEITURE</h3>
      <p>
        Disappear cooperates fully with lawful requests and warrants issued by competent judicial authorities 
        in investigating financial crimes and fraud. We reserve the absolute right to suspend, freeze, or 
        terminate any node or virtual asset suspected of being involved in illicit activity.
      </p>

      <p style={{ marginTop: '30px', fontStyle: 'italic', color: 'var(--tiger-blue)', fontSize: '0.8rem' }}>
        Privacy is a right; fraud is a crime. We protect your privacy, never your fraud.
      </p>
    </div>
  );
};

// IMPORTANT: Do NOT include "export default AmlFraudPolicy" at the bottom.
