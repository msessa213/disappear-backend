import React, { useState, useRef, useEffect } from 'react';

export default function PrivacyAiChat({ apiBaseUrl }) {
  // Completely hidden by default (isOpen = false). Zero floating badges on load.
  const [isOpen, setIsOpen] = useState(false);
  const [inputMsg, setInputMsg] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: "Hello! I am your **Disappear AI Privacy Specialist**. Ask me any question about privacy protection, data broker scrubs, pricing, or how we compare to other services."
    }
  ]);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Listen for global 'open-ai-chat' custom events triggered from header, footer, or support node
  useEffect(() => {
    const handleGlobalOpen = () => setIsOpen(true);
    window.addEventListener('open-ai-chat', handleGlobalOpen);
    return () => window.removeEventListener('open-ai-chat', handleGlobalOpen);
  }, []);

  const handleSendMessage = async (textToSend) => {
    const text = textToSend || inputMsg;
    if (!text || !text.trim()) return;

    const userMessage = text.trim();
    setMessages(prev => [...prev, { sender: 'user', text: userMessage }]);
    if (!textToSend) setInputMsg("");
    setIsTyping(true);

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/ai-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage })
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(prev => [...prev, { sender: 'ai', text: data.reply || "I am standing by to assist with your privacy." }]);
      } else {
        setMessages(prev => [...prev, { 
          sender: 'ai', 
          text: "I am having trouble reaching the command server. Here is a quick overview:\n\n• **Elite Privacy Plan**: $19.99/month ($217.38/yr annual with $22.50 flat savings)\n• **Included**: 400+ broker data scrubs, 5 relay slots, human analyst audits, and emergency burn." 
        }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { 
        sender: 'ai', 
        text: "Our privacy shield is active! Our **Elite Plan is $19.99/mo** (or **$217.38/yr annual with $22.50 flat savings**). It includes continuous 400+ data broker scrubs, 5 burner email/phone relays, and emergency wipe." 
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  const quickPrompts = [
    { label: "🚨 What If My Data Is Breached?", query: "What happens if my data is breached?" },
    { label: "🏆 Why Disappear vs Others", query: "Why is Disappear better than DeleteMe, Incogni, or Optery?" },
    { label: "🛡️ How It Works (Step-by-Step)", query: "How does Disappear scrub my data and protect my privacy step by step?" },
    { label: "💳 Pricing & Plans", query: "What are your pricing and plan options?" },
    { label: "⚡ Emergency Burn", query: "What is Emergency Burn?" }
  ];

  // If closed, return null so zero elements or floating badges are rendered
  if (!isOpen) return null;

  return (
    <div className="privacy-ai-chat-container">
      <div
        className="ai-chat-modal-floating"
        style={{
          position: 'fixed',
          bottom: '25px',
          right: '25px',
          width: '360px',
          maxWidth: 'calc(100vw - 30px)',
          height: '520px',
          maxHeight: 'calc(100vh - 100px)',
          backgroundColor: '#0A0E17',
          border: '1px solid var(--tiger-blue, #0047AB)',
          borderRadius: '16px',
          boxShadow: '0 0 45px rgba(0, 210, 255, 0.4), 0 20px 50px rgba(0,0,0,0.95)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          zIndex: 999999,
          fontFamily: "'Inter', -apple-system, sans-serif"
        }}
      >
        {/* Header Bar with Prominent Close Button */}
        <div
          style={{
            padding: '12px 16px',
            background: 'linear-gradient(90deg, #050B14, #002A66)',
            borderBottom: '1px solid rgba(0, 71, 171, 0.4)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ display: 'inline-block', width: '10px', height: '10px', backgroundColor: '#10B981', borderRadius: '50%', boxShadow: '0 0 10px #10B981' }}></span>
            <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#FFFFFF', letterSpacing: '1px' }}>AI PRIVACY AGENT</span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            title="Close Chat"
            aria-label="Close Chat"
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '6px',
              color: '#FFFFFF',
              fontSize: '0.8rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              padding: '3px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            ✕ CLOSE
          </button>
        </div>

        {/* Quick Prompts Bar */}
        <div style={{ padding: '10px 12px', display: 'flex', gap: '6px', overflowX: 'auto', borderBottom: '1px solid rgba(255,255,255,0.05)', backgroundColor: '#05070D' }}>
          {quickPrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(p.query)}
              style={{
                whiteSpace: 'nowrap',
                background: 'rgba(0, 71, 171, 0.15)',
                border: '1px solid rgba(0, 210, 255, 0.3)',
                color: '#00D2FF',
                borderRadius: '12px',
                padding: '5px 10px',
                fontSize: '0.75rem',
                cursor: 'pointer'
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Chat Messages */}
        <div
          style={{
            flex: 1,
            padding: '16px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            backgroundColor: '#050811'
          }}
        >
          {messages.map((m, idx) => (
            <div
              key={idx}
              style={{
                alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                padding: '10px 14px',
                borderRadius: m.sender === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                backgroundColor: m.sender === 'user' ? '#0047AB' : '#111827',
                color: m.sender === 'user' ? '#FFFFFF' : '#E2E8F0',
                fontSize: '0.85rem',
                lineHeight: '1.45',
                border: m.sender === 'ai' ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
                boxShadow: m.sender === 'user' ? '0 0 10px rgba(0,71,171,0.4)' : 'none',
                whiteSpace: 'pre-wrap'
              }}
            >
              {m.text}
            </div>
          ))}
          {isTyping && (
            <div
              style={{
                alignSelf: 'flex-start',
                padding: '8px 14px',
                borderRadius: '14px',
                backgroundColor: '#111827',
                color: '#00D2FF',
                fontSize: '0.8rem',
                fontStyle: 'italic'
              }}
            >
              AI Assistant is typing...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div
          style={{
            padding: '12px',
            backgroundColor: '#0A0E17',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            gap: '8px'
          }}
        >
          <input
            type="text"
            placeholder="Ask a question about privacy, pricing..."
            value={inputMsg}
            onChange={(e) => setInputMsg(e.target.value)}
            onKeyDown={handleKeyPress}
            style={{
              flex: 1,
              backgroundColor: '#05070D',
              border: '1px solid rgba(0, 71, 171, 0.4)',
              borderRadius: '8px',
              padding: '10px 12px',
              color: '#FFFFFF',
              fontSize: '0.85rem',
              outline: 'none'
            }}
          />
          <button
            onClick={() => handleSendMessage()}
            style={{
              backgroundColor: '#0047AB',
              border: 'none',
              borderRadius: '8px',
              padding: '0 14px',
              color: '#FFFFFF',
              fontWeight: 'bold',
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            SEND
          </button>
        </div>
      </div>
    </div>
  );
}
