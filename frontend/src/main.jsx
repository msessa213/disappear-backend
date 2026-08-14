import React, { Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Disappear Vault Render Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#000000',
          color: '#00D2FF',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'monospace',
          padding: '20px',
          textAlign: 'center'
        }}>
          <h1 style={{ color: '#FF3366', fontSize: '2rem', marginBottom: '20px' }}>🛡️ DISAPPEAR SECURITY VAULT</h1>
          <p style={{ color: '#FFFFFF', marginBottom: '30px' }}>SESSION RECOVERY GATEWAY</p>
          <button 
            onClick={() => {
              localStorage.clear();
              window.location.hash = "";
              window.location.reload();
            }}
            style={{
              padding: '15px 30px',
              backgroundColor: '#00D2FF',
              color: '#000',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            ⚡ RE-INITIALIZE VAULT SESSION
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)
