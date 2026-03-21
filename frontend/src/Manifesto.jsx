import React from 'react';

// Use "export const" instead of "const"
export const Manifesto = () => {
  return (
    <div className="legal-document">
      <h2 className="tiger-text">THE DISAPPEAR MANIFESTO</h2>
      
      <p>
        <strong>Privacy is not a luxury; it is a fundamental human right.</strong>
      </p>
      
      <p>
        In 2026, your identity is the most valuable commodity on earth. Data brokers 
        and hackers are fighting for a piece of your digital life. Every time you 
        use your "real" credit card, phone number, or primary email, you leave a 
        permanent trail that is bought, sold, and weaponized.
      </p>
      
      <p>
        <strong>We believe in the Right to be Invisible.</strong>
      </p>
      
      <p>
        Our mission is to provide you with a "Digital Hazmat Suit." By using Disappear, 
        you are severing the link between your physical person and your online transactions. 
        We provide the tools to navigate the digital world without leaving a footprint.
      </p>
      
      <ul style={{ marginTop: '20px' }}>
        <li>
          <strong>No Tracking:</strong> Merchants and trackers see a ghost, not a profile.
        </li>
        <li>
          <strong>Neutralize Scam Ecosystems:</strong> Scammers can't call a number they can't find. 
          By using our Encrypted Phone Aliases, you starve the auto-dialers and "spoofing" 
          networks that rely on leaked broker data.
        </li>
        <li>
          <strong>Kill Phishing at the Source:</strong> Your primary inbox is a target. Our 
          Burnable Email Nodes ensure that if a merchant is breached or a list is sold, 
          the spam and phishing attempts hit a dead-end alias, not your personal life.
        </li>
        <li>
          <strong>No Permanent Records:</strong> Every digital asset we issue is 
          designed to be burnable and temporary.
        </li>
        <li>
          <strong>Total Sovereignty:</strong> You decide when to exist and when to 
          disappear. You own your data; we just protect your exit.
        </li>
      </ul>

      <p style={{ marginTop: '20px', fontStyle: 'italic', color: 'var(--tiger-blue)' }}>
        Stay hidden. Stay secure. Disappear.
      </p>
    </div>
  );
};

// IMPORTANT: Do NOT include "export default Manifesto" at the bottom.