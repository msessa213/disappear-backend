import React, { useState, useRef, useEffect } from 'react';

export default function PrivacyAiChat({ apiBaseUrl }) {
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
          text: "I am having trouble reaching the command server. Here is a quick overview:\n\n• **Elite Privacy Plan**: $19.99/month ($15.99/mo annual)\n• **Included**: 47+ broker data scrubs, 6 relay slots, human analyst audits, and emergency burn." 
        }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { 
        sender: 'ai', 
        text: "Our privacy shield is active! Our **Elite Plan is $19.99/mo** (or **$15.99/mo annual**). It includes continuous 47+ data broker scrubs, burner email/phone relays, and emergency wipe." 
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

  return (
    <div className="privacy-ai-chat-container">
      {/* Modern Streamlined Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          title="Open AI Privacy Assistant"
          style={{
            background: 'rgba(5, 11, 20, 0.88)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            color: '#FFFFFF',
            border: '1px solid rgba(0, 210, 255, 0.4)',
            borderRadius: '50px',
            padding: '8px 18px 8px 10px',
            fontSize: '0.85rem',
            fontWeight: '600',
            letterSpacing: '0.8px',
            cursor: 'pointer',
            boxShadow: '0 8px 32px rgba(0, 71, 171, 0.4), inset 0 1px 0 rgba(255,255,255,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            position: 'relative'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-3px)';
            e.currentTarget.style.borderColor = 'rgba(0, 210, 255, 0.8)';
            e.currentTarget.style.boxShadow = '0 12px 35px rgba(0, 210, 255, 0.6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.borderColor = 'rgba(0, 210, 255, 0.4)';
            e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 71, 171, 0.4)';
          }}
        >
          {/* Sleek Vector Shield Badge */}
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #0047AB, #00D2FF)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 14px rgba(0, 210, 255, 0.6)',
            position: 'relative'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="m9 12 2 2 4-4"/>
            </svg>
            <span style={{
              position: 'absolute',
              top: '0px',
              right: '0px',
              width: '9px',
              height: '9px',
              backgroundColor: '#10B981',
              borderRadius: '50%',
              border: '2px solid #050B14'
            }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: '700', color: '#FFFFFF', letterSpacing: '0.5px' }}>AI Privacy Shield</span>
            <span style={{ fontSize: '0.68rem', color: '#00D2FF', opacity: 0.9 }}>Ask any question</span>
          </div>
        </button>
      )}

      {/* Floating Chat Modal */}
      {isOpen && (
        <div
          className="ai-chat-modal-floating"
          style={{
            position: 'fixed',
            bottom: '80px',
            right: '25px',
            width: '370px',
            maxWidth: 'calc(100vw - 30px)',
            height: '540px',
            maxHeight: 'calc(100vh - 110px)',
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
          {/* Header */}
          <div
            style={{
              padding: '14px 18px',
              background: 'linear-gradient(90deg, #050B14, #002A66)',
              borderBottom: '1px solid rgba(0, 71, 171, 0.4)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', backgroundColor: '#10B981', borderRadius: '50%', boxShadow: '0 0 10px #10B981' }}></span>
              <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#FFFFFF', letterSpacing: '1px' }}>AI PRIVACY AGENT</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94A3B8',
                fontSize: '1.2rem',
                cursor: 'pointer',
                padding: '0 5px'
              }}
            >
              ✕
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
      )}
    </div>
  );
}
