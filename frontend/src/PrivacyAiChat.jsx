import React, { useState, useRef, useEffect } from 'react';

export default function PrivacyAiChat({ apiBaseUrl }) {
  // 3-Stage Widget State:
  // Stage 1 = Minimized Pill Badge (Default)
  // Stage 2 = Expanded Preview / Greeting Widget Card
  // Stage 3 = Full Interactive Chat Box Window
  const [chatStage, setChatStage] = useState(() => {
    try {
      const saved = sessionStorage.getItem("disappear_ai_chat_stage");
      return saved ? parseInt(saved, 10) : 1;
    } catch (e) {
      return 1;
    }
  });

  const changeStage = (stageNum) => {
    setChatStage(stageNum);
    try {
      sessionStorage.setItem("disappear_ai_chat_stage", String(stageNum));
    } catch (e) {}
  };

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
    if (chatStage === 3) {
      scrollToBottom();
    }
  }, [messages, chatStage]);

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

  return (
    <div className="privacy-ai-chat-container">
      {/* ========================================================================= */}
      {/* STAGE 1: DEFAULT MINIMIZED FLOATING PILL BADGE                           */}
      {/* ========================================================================= */}
      {chatStage === 1 && (
        <button
          onClick={() => changeStage(2)}
          title="Open AI Privacy Assistant"
          aria-label="Open AI Privacy Assistant"
          className="ai-chat-trigger-btn"
          style={{
            background: 'rgba(5, 11, 20, 0.94)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            color: '#FFFFFF',
            border: '1px solid rgba(0, 210, 255, 0.45)',
            borderRadius: '50px',
            padding: '6px 14px 6px 8px',
            fontSize: '0.8rem',
            fontWeight: '600',
            letterSpacing: '0.5px',
            cursor: 'pointer',
            boxShadow: '0 8px 32px rgba(0, 71, 171, 0.45), inset 0 1px 0 rgba(255,255,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            position: 'relative'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-3px)';
            e.currentTarget.style.borderColor = 'rgba(0, 210, 255, 0.85)';
            e.currentTarget.style.boxShadow = '0 12px 35px rgba(0, 210, 255, 0.6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.borderColor = 'rgba(0, 210, 255, 0.45)';
            e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 71, 171, 0.45)';
          }}
        >
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #0047AB, #00D2FF)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 12px rgba(0, 210, 255, 0.6)',
            position: 'relative'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="m9 12 2 2 4-4"/>
            </svg>
            <span style={{
              position: 'absolute',
              top: '0px',
              right: '0px',
              width: '8px',
              height: '8px',
              backgroundColor: '#10B981',
              borderRadius: '50%',
              border: '2px solid #050B14',
              boxShadow: '0 0 6px #10B981'
            }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#FFFFFF', letterSpacing: '0.5px', lineHeight: '1.2' }}>AI Privacy Shield</span>
            <span style={{ fontSize: '0.65rem', color: '#00D2FF', opacity: 0.9 }}>Ask any question</span>
          </div>
        </button>
      )}

      {/* ========================================================================= */}
      {/* STAGE 2: EXPANDED INTERMEDIATE PREVIEW / GREETING WIDGET CARD            */}
      {/* ========================================================================= */}
      {chatStage === 2 && (
        <div
          className="ai-chat-preview-card"
          style={{
            position: 'fixed',
            bottom: '25px',
            right: '25px',
            width: '330px',
            maxWidth: 'calc(100vw - 30px)',
            backgroundColor: '#0A0E17',
            border: '1px solid var(--tiger-blue, #0047AB)',
            borderRadius: '16px',
            boxShadow: '0 0 35px rgba(0, 210, 255, 0.35), 0 15px 40px rgba(0,0,0,0.9)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            zIndex: 999999,
            fontFamily: "'Inter', -apple-system, sans-serif"
          }}
        >
          {/* Card Header Bar */}
          <div style={{
            padding: '12px 14px',
            background: 'linear-gradient(90deg, #050B14, #002A66)',
            borderBottom: '1px solid rgba(0, 71, 171, 0.4)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ display: 'inline-block', width: '9px', height: '9px', backgroundColor: '#10B981', borderRadius: '50%', boxShadow: '0 0 8px #10B981' }}></span>
              <span style={{ fontWeight: 'bold', fontSize: '0.8rem', color: '#FFFFFF', letterSpacing: '0.8px' }}>AI PRIVACY SHIELD</span>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => changeStage(1)}
                title="Minimize to badge"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#94A3B8', fontSize: '0.85rem', cursor: 'pointer', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >—</button>
              <button
                onClick={() => changeStage(1)}
                title="Close widget"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#94A3B8', fontSize: '0.85rem', cursor: 'pointer', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >✕</button>
            </div>
          </div>

          {/* Greeting Content */}
          <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: '#050811' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #0047AB, #00D2FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 10px rgba(0,210,255,0.5)', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  <path d="m9 12 2 2 4-4"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#FFF' }}>Disappear AI Specialist</div>
                <div style={{ fontSize: '0.7rem', color: '#10B981' }}>● Online & Standing By</div>
              </div>
            </div>

            <p style={{ fontSize: '0.78rem', color: '#94A3B8', margin: 0, lineHeight: '1.4' }}>
              Have questions about <strong>400+ data broker purges</strong>, <strong>burner relays</strong>, or <strong>pricing</strong>? Ask our AI assistant now.
            </p>

            {/* Quick Option Pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {quickPrompts.slice(0, 3).map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    handleSendMessage(p.query);
                    changeStage(3);
                  }}
                  style={{
                    background: 'rgba(0, 71, 171, 0.2)',
                    border: '1px solid rgba(0, 210, 255, 0.35)',
                    color: '#00D2FF',
                    borderRadius: '8px',
                    padding: '4px 8px',
                    fontSize: '0.7rem',
                    cursor: 'pointer'
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Primary Action Button */}
            <button
              onClick={() => changeStage(3)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #0047AB, #00D2FF)',
                border: 'none',
                color: '#FFFFFF',
                fontWeight: 'bold',
                fontSize: '0.82rem',
                letterSpacing: '0.5px',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(0, 71, 171, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '2px'
              }}
            >
              <span>💬 START FULL CHAT SESSION</span>
              <span>→</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STAGE 3: FULL INTERACTIVE CHAT WINDOW                                    */}
      {/* ========================================================================= */}
      {chatStage === 3 && (
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
          {/* Header Bar with Back/Minimize & Close Buttons */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => changeStage(2)}
                title="Back to Preview"
                aria-label="Back to Preview"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '6px',
                  color: '#94A3B8',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  width: '26px',
                  height: '26px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                —
              </button>
              <button
                onClick={() => changeStage(1)}
                title="Close to Badge"
                aria-label="Close to Badge"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '6px',
                  color: '#94A3B8',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  width: '26px',
                  height: '26px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ✕
              </button>
            </div>
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
