import React from 'react';

// Use "export const" instead of "const"
export const Terms = () => {
  return (
    <div className="legal-document">
      <h2 className="tiger-text">TERMS OF SERVICE [v2026.1]</h2>
      
      <p><em>Effective Date: March 20, 2026</em></p>

      <h3 style={{ color: 'white', marginTop: '20px' }}>1. THE DIGITAL HAZMAT SUITE</h3>
      <p>
        Disappear is a software platform operated by <strong>DFS 213 LLC</strong> providing a unified interface for virtual payment aliases, 
        <strong> Burnable Email Nodes</strong>, and <strong>Encrypted Phone Aliases</strong>. 
        These tools are designed to provide a "Digital Hazmat Suit" for your 
        identity. Financial services are provided via regulated banking partners 
        and are subject to their respective compliance protocols.
      </p>
      
      <h3 style={{ color: 'white', marginTop: '20px' }}>2. AUTOMATED SCRUBBING AUTHORITY</h3>
      <p>
        By initiating a <strong>"Target Profile Scrub,"</strong> you grant Disappear 
        the legal authority to act as your authorized agent. This includes submitting 
        "Do Not Sell," "Request to Delete," and "Opt-Out" orders to third-party data 
        brokers and marketing aggregators in accordance with the <strong>California 
        Delete Act</strong> and other applicable 2026 privacy statutes.
      </p>
      
      <h3 style={{ color: 'white', marginTop: '20px' }}>3. SCAM & PHISHING MITIGATION</h3>
      <p>
        While our <strong>Alias Nodes</strong> are designed to neutralize scam call 
        ecosystems and kill phishing attempts at the source, Disappear is not 
        responsible for third-party merchant security. You acknowledge that 
        burning an alias will permanently sever communication with any entity 
        using that specific node.
      </p>

      <h3 style={{ color: 'white', marginTop: '20px' }}>4. THE "EMERGENCY BURN" PROTOCOL</h3>
      <p>
        Executing a <strong>"Burn"</strong> or <strong>"Total Purge"</strong> 
        immediately terminates the digital asset's connection to the node. 
        This action is irreversible. It is the user's absolute responsibility 
        to update billing information with merchants if a legitimate debt 
        is owed before terminating a virtual shield card.
      </p>

      <h3 style={{ color: 'white', marginTop: '20px' }}>5. USER RESPONSIBILITY</h3>
      <p>
        Users remain responsible for all transactions and legal obligations 
        incurred while using the service. Disappear privacy "shields" must 
        never be used for fraudulent activities, money laundering, or the 
        evasion of lawful debt.
      </p>

      <h3 style={{ color: 'white', marginTop: '20px' }}>6. SMS & MOBILE MESSAGING TERMS</h3>
      <p style={{ background: 'rgba(0, 210, 255, 0.05)', padding: '15px', borderLeft: '4px solid #00D2FF', borderRadius: '4px', lineHeight: '1.6' }}>
        <strong>SMS Messaging Program:</strong> By opting into SMS notifications from Disappear (DFS 213 LLC), you consent to receive automated transactional text messages, security alerts, multi-factor authentication codes, and account status updates to the mobile number provided.
      </p>
      <ul style={{ color: '#cbd5e1', paddingLeft: '20px', marginTop: '10px', lineHeight: '1.6' }}>
        <li><strong>Message Frequency:</strong> Message frequency varies depending on your account activity and security alerts.</li>
        <li><strong>Cost:</strong> Message and data rates may apply depending on your mobile carrier plan.</li>
        <li><strong>Opt-Out Instructions:</strong> You may cancel or opt-out of SMS notifications at any time by replying <strong>STOP</strong> to any text message. Upon sending STOP, you will receive a single confirmation text and no further automated messages will be sent.</li>
        <li><strong>Customer Support:</strong> Reply <strong>HELP</strong> for assistance, or contact our support team directly at <strong>customer.service@disappearco.com</strong>.</li>
        <li><strong>Carriers:</strong> Wireless carriers are not liable for delayed or undelivered messages.</li>
      </ul>

      <p style={{ marginTop: '30px', fontStyle: 'italic', color: 'var(--tiger-blue)', fontSize: '0.8rem' }}>
        Stay hidden. Stay secure. Disappear.
      </p>
    </div>
  );
};