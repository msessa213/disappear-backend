import React, { useState, useEffect, useCallback, useRef } from 'react';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable"; // FIXED: Explicit import for plugin functionality
import { Capacitor, CapacitorHttp } from '@capacitor/core'; 
import CryptoJS from 'crypto-js';
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

// --- FIXED IMPORTS ---
import { Manifesto } from './Manifesto';
import { Privacy } from './Privacy';
import { Terms } from './Terms';
import { AmlFraudPolicy } from './AmlFraudPolicy';
import AdminDashboard from './AdminDashboard'; 
import LandingPage from './LandingPage'; // Integration: Authority Website Layer

import './App.css';

/**
 * DISAPPEAR CORE ENGINE
 * Refactor: Separated Marketing Intelligence + Secure Vault Gateway
 * Feature: Full Doctrine Integration & Instruction Authority
 */

// --- DYNAMIC API ROUTING ---
// IMPORTANT: This should be the final, public URL of your backend on AWS ECS
const PROD_API = "https://disappear-backend-production.up.railway.app";
const LOCAL_API = "http://127.0.0.1:8000";

// Uses local backend during local development, but forces Production for Native Apps and Live Web
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = (isLocal && !Capacitor.isNativePlatform()) ? LOCAL_API : PROD_API;

function App() {
  // --- SECURE BRIDGE LOGIC ---
  // This bridges the gap between the app and the server on native hardware
  const secureRequest = async (url, options = {}, retries = 3) => {
    const activeUserId = localStorage.getItem("disappear_user_id") || "";
    const headers = { 
      'Content-Type': 'application/json', 
      'x-user-id': activeUserId, 
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      ...options.headers 
    };

    for (let i = 0; i < retries; i++) {
      try {
        if (Capacitor.isNativePlatform()) {
          const response = await CapacitorHttp.request({
            url,
            method: options.method || 'GET',
            data: (options.body && typeof options.body === 'string') ? JSON.parse(options.body) : options.body,
            headers: headers
          });
          return { 
            ok: response.status >= 200 && response.status < 300, 
            status: response.status,
            json: () => Promise.resolve(response.data) 
          };
        }
        return await fetch(url, { ...options, headers });
      } catch (err) {
        if (i === retries - 1) throw err;
        // Wait progressively longer before each retry (1s, then 2s...)
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  };

  // --- CORE VIEW NAVIGATION (UPDATED) ---
  const [showLanding, setShowLanding] = useState(true); 
  const [showShield, setShowShield] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [show2FA, setShow2FA] = useState(false); 
  const [showHelp, setShowHelp] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEncrypting, setIsEncrypting] = useState(false); 
  const [isMinting, setIsMinting] = useState(false);
  const [mintedCardToken, setMintedCardToken] = useState("");
  const [purgeStatus, setPurgeStatus] = useState(""); 
  const [isProcessingPayment, setIsProcessingPayment] = useState(false); 
  const [notifications, setNotifications] = useState([]); 
  
  const [showLegal, setShowLegal] = useState(null); 
  const [showAdmin, setShowAdmin] = useState(false);
  const [showKycModal, setShowKycModal] = useState(false);
  const [kycModalReason, setKycModalReason] = useState("");
  const [isEmergencyWipe, setIsEmergencyWipe] = useState(false);

  const [showMintModal, setShowMintModal] = useState(false);
  const [newCardLabel, setNewCardLabel] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedFundingSource, setSelectedFundingSource] = useState("");

  // --- SUPPORT & FAQ STATES ---
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showFaqModal, setShowFaqModal] = useState(false); 
  const [showManualModal, setShowManualModal] = useState(false);
  const [activeFaqNode, setActiveFaqNode] = useState(null);
  const [supportData, setSupportData] = useState({ subject: "TECHNICAL_ERR", message: "" });

  // --- CATEGORY-SPECIFIC STATES ---
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [aliasLabel, setAliasLabel] = useState("");
  const [aliasAreaCode, setAliasAreaCode] = useState("");
  const [emails, setEmails] = useState([]);
  const [phones, setPhones] = useState([]);

  const [targetProfile, setTargetProfile] = useState({
      firstName: "", middleName: "", lastName: "", email: "", phone: "",
      dob: "", address: "", city: "", state: "", zip: "", termsAccepted: false
  });

  const [billingCycle, setBillingCycle] = useState("monthly");
  
  // UPDATED: Decoupled capacities
  const [credits, setCredits] = useState({ vcc_total: 6, vcc_used: 0, phone_total: 2, phone_used: 0 });
  const [auditLog, setAuditLog] = useState([]);
  const [historyDays, setHistoryDays] = useState(30); // NEW: History Filter State
  const [cards, setCards] = useState([]);
  const [progress, setProgress] = useState(15);
  const [showToast, setShowToast] = useState("");
  
  const [targetEmails, setTargetEmails] = useState({ primary: "", additional: [], slots: 1, used: 0 });
  const [newTargetEmail, setNewTargetEmail] = useState("");
  
  const addressRef = useRef(null);
  const [googleLoaded, setGoogleLoaded] = useState(false);

  // --- DYNAMIC SEO & METADATA ENGINE ---
  useEffect(() => {
    let title = "Disappear | Privacy-as-a-Service & Data Broker Removal";
    let description = "Reclaim your privacy. Disappear actively scrubs your phone number, email, and personal data (PII) from broker databases. Secure your digital trail.";
    let canonical = "https://disappearco.com/";

    if (showLanding) {
      title = "Disappear | Privacy-as-a-Service & Data Broker Removal";
      description = "Reclaim your privacy. Disappear actively scrubs your phone number, email, and personal data (PII) from broker databases. Secure your digital trail using real human analyst audits and encrypted aliases.";
      canonical = "https://disappearco.com/";
    } else if (showPricing) {
      title = "Disappear | Choose Your Shield Plan";
      description = "Get continuous data broker opt-outs, human analyst removals, and encrypted phone lines. Select a tactical privacy plan starting at $5.95.";
      canonical = "https://disappearco.com/#pricing";
    } else if (showCheckout) {
      title = "Disappear | Secure Checkout";
      description = "Complete your subscription and secure your identity vault slot.";
      canonical = "https://disappearco.com/#checkout";
    } else if (show2FA) {
      title = "Disappear | Decrypt Vault Access";
      description = "Authentication required. Enter your passcode to decrypt and unlock your digital protection vault.";
      canonical = "https://disappearco.com/#login";
    } else if (showLegal === 'manifesto') {
      title = "Disappear | The Privacy Manifesto: Digital Sovereignty";
      description = "Read the Disappear Privacy Manifesto. Understand why digital sovereignty matters and how data brokers weaponize your personal information for profit.";
      canonical = "https://disappearco.com/#manifesto";
    } else if (showLegal === 'privacy') {
      title = "Disappear | Privacy Policy";
      description = "Our commitment to data minimization and absolute user privacy. Learn how we handle your information with zero data retention policies.";
      canonical = "https://disappearco.com/#privacy";
    } else if (showLegal === 'terms') {
      title = "Disappear | Terms of Service";
      description = "Terms and conditions of our Privacy-as-a-Service (PaaS) and automated identity protection protocols.";
      canonical = "https://disappearco.com/#terms";
    } else if (showLegal === 'aml') {
      title = "Disappear | AML & Anti-Fraud Compliance Policy";
      description = "Disappear compliance guidelines under AML watchlist requirements and verification screening policies.";
      canonical = "https://disappearco.com/#aml-policy";
    } else if (showAdmin) {
      title = "Disappear | Central Operations Command";
      description = "Administrative portal for manual removal tasks and security operations.";
      canonical = "https://disappearco.com/#admin";
    } else {
      // User is logged in and viewing their private dashboard
      title = "Disappear | Operative Dashboard";
      description = "Active Identity Shield. Access secure email aliases, provision phone relays, and monitor pending automated and manual data scrubs.";
      canonical = "https://disappearco.com/#dashboard";
    }

    // Update Document Title
    document.title = title;

    // Update Meta Description
    let metaDescTag = document.querySelector('meta[name="description"]');
    if (!metaDescTag) {
      metaDescTag = document.createElement('meta');
      metaDescTag.name = "description";
      document.getElementsByTagName('head')[0].appendChild(metaDescTag);
    }
    metaDescTag.setAttribute("content", description);

    // Update Canonical URL
    let canonicalTag = document.querySelector('link[rel="canonical"]');
    if (!canonicalTag) {
      canonicalTag = document.createElement('link');
      canonicalTag.rel = "canonical";
      document.getElementsByTagName('head')[0].appendChild(canonicalTag);
    }
    canonicalTag.setAttribute("href", canonical);

    // Update Open Graph (og:) tags for high-performance social sharing
    const setOgTag = (property, content) => {
      let tag = document.querySelector(`meta[property="${property}"]`);
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('property', property);
        document.getElementsByTagName('head')[0].appendChild(tag);
      }
      tag.setAttribute("content", content);
    };

    setOgTag("og:title", title);
    setOgTag("og:description", description);
    setOgTag("og:url", canonical);
    setOgTag("og:type", "website");
    setOgTag("og:image", "https://disappearco.com/assets/og_shield_preview.png");

    // Update Twitter Card tags
    const setTwitterTag = (name, content) => {
      let tag = document.querySelector(`meta[name="${name}"]`);
      if (!tag) {
        tag = document.createElement('meta');
        tag.name = name;
        document.getElementsByTagName('head')[0].appendChild(tag);
      }
      tag.setAttribute("content", content);
    };

    setTwitterTag("twitter:card", "summary_large_image");
    setTwitterTag("twitter:title", title);
    setTwitterTag("twitter:description", description);
    setTwitterTag("twitter:image", "https://disappearco.com/assets/og_shield_preview.png");

  }, [showLanding, showPricing, showCheckout, show2FA, showLegal, showAdmin]);

  // --- HASH ROUTING CONTROLLER ---
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === '#privacy') {
        setShowLegal('privacy');
      } else if (hash === '#terms') {
        setShowLegal('terms');
      } else if (hash === '#manifesto') {
        setShowLegal('manifesto');
      } else if (hash === '#aml-policy' || hash === '#aml') {
        setShowLegal('aml');
      } else if (hash === '#admin') {
        setShowAdmin(true);
      } else if (hash === '#pricing') {
        setShowLanding(false);
        setShowPricing(true);
        setShowCheckout(false);
        setShow2FA(false);
        setShowLegal(null);
      } else if (hash === '#login') {
        setShowLanding(false);
        setShowPricing(false);
        setShowCheckout(false);
        setShow2FA(true);
        setShowLegal(null);
      } else if (hash === '' || hash === '#') {
        setShowLegal(null);
        setShowAdmin(false);
        // Only return to landing if not logged in
        const sessionActive = localStorage.getItem("disappear_session") === "active";
        const activeUserId = localStorage.getItem("disappear_user_id");
        if (!sessionActive || !activeUserId) {
          setShowLanding(true);
          setShowPricing(false);
          setShow2FA(false);
          setShowCheckout(false);
        }
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // --- GOOGLE MAPS PLACES AUTOCOMPLETE ---
  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.warn("GOOGLE MAPS: Missing VITE_GOOGLE_MAPS_API_KEY in .env");
      return;
    }
    if (window.google?.maps?.places) {
      setGoogleLoaded(true);
      return;
    }
    
    setOptions({
      apiKey: apiKey,
      version: "weekly"
    });

    importLibrary("places").then(() => {
      setGoogleLoaded(true);
    }).catch(e => {
      console.error("Google Maps failed to load", e);
    });
  }, []);

  useEffect(() => {
    let listener;
    // Small timeout ensures the DOM node is fully painted after the checkout screen opens
    const initTimer = setTimeout(() => {
      if (showCheckout && googleLoaded && addressRef.current) {
        const autocomplete = new window.google.maps.places.Autocomplete(addressRef.current, {
          fields: ['address_components'],
          types: ['address'],
          componentRestrictions: { country: "us" }
        });
        listener = autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (!place.address_components) return;
          
          let streetNumber = "", route = "", city = "", state = "", zip = "";

          for (const component of place.address_components) {
            const type = component.types[0];
            if (type === "street_number") streetNumber = component.long_name;
            if (type === "route") route = component.short_name;
            if (type === "locality" || type === "sublocality_level_1") city = component.long_name;
            if (type === "administrative_area_level_1") state = component.short_name;
            if (type === "postal_code") zip = component.long_name;
          }

          setTargetProfile(prev => ({
            ...prev,
            address: `${streetNumber} ${route}`.trim(),
            city: city,
            state: state,
            zip: zip
          }));
        });
      }
    }, 100);

    return () => {
      clearTimeout(initTimer);
      if (listener && window.google) window.google.maps.event.removeListener(listener);
    };
  }, [showCheckout, googleLoaded]);

  const triggerToast = (msg) => { 
    setShowToast(msg); 
    setTimeout(() => setShowToast(""), 3000); 
  };

  // PERSISTENCE & PAYMENT SYNC
  useEffect(() => {
    const session = localStorage.getItem("disappear_session");
    const lastActive = localStorage.getItem("disappear_last_active");
    const query = new URLSearchParams(window.location.search);
    const isNative = Capacitor.isNativePlatform();

    // Check for session timeout (e.g., 30 minutes of inactivity)
    const TIMEOUT_DURATION = 1800000; // 30 minutes
    const now = Date.now();
    let isExpired = false;

    if (session === "active" && lastActive) {
      const timeSinceLastActive = now - parseInt(lastActive, 10);
      if (timeSinceLastActive > TIMEOUT_DURATION) {
        localStorage.removeItem("disappear_session");
        localStorage.removeItem("disappear_user_id");
        localStorage.removeItem("disappear_last_active");
        isExpired = true;
      }
    }

    // UPDATE: Skip landing page on Native App to show Login/Signup flow
    if (isNative) {
        setShowLanding(false);
    }
    
    if (query.get("payment") === "success") {
        localStorage.setItem("disappear_session", "active");
        localStorage.setItem("disappear_last_active", now.toString());
        setShowLanding(false);
        setShowShield(true);
        setProgress(100);
        
        triggerToast("CREDIT AUTHORIZED: SECURE NODE EXPANDED");
        window.history.replaceState({}, document.title, "/");
        syncDefenseData();
    }

    if (query.get("setup") === "success") {
        triggerToast("FUNDING SOURCE LINKED SUCCESSFULLY");
        window.history.replaceState({}, document.title, "/");
        syncDefenseData();
    }

    if (session === "active" && !isExpired) {
        localStorage.setItem("disappear_last_active", now.toString());
        setShowLanding(false); // Bypass website for active agents
        setShowShield(true);
        setProgress(100);
    } else {
        if (isExpired) {
            triggerToast("SESSION EXPIRED: SECURITY BLOCK");
        }
        if (!isNative) {
            setTargetProfile({
                firstName: "", middleName: "", lastName: "", email: "", phone: "",
                dob: "", address: "", city: "", state: "", zip: "", termsAccepted: false
            });
        }
    }
  }, []);

  const fetchTargetEmails = useCallback(async () => {
    const activeUserId = localStorage.getItem("disappear_user_id") || "";
    try {
        const res = await secureRequest(`${API_BASE_URL}/profile/emails?user_id=${activeUserId}`);
        if(res.ok) setTargetEmails(await res.json());
    } catch(e) {}
  }, []);

  useEffect(() => {
    if (showCheckout) {
      secureRequest(`${API_BASE_URL}/`).catch(() => {});
    }
  }, [showCheckout]);

  const pushNotification = useCallback((msg) => {
    if (!msg) return;
    const id = `notif-${Date.now()}-${Math.random()}`; 
    setNotifications(prev => [{ id, msg: msg.includes(':') ? msg : `SYSTEM_EVENT: [${msg}]` }, ...prev].slice(0, 3));
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  }, [setNotifications]);

  const syncDefenseData = useCallback(async () => {
    try {
      // 1. Sync Base Dashboard Data
      const activeUserId = localStorage.getItem("disappear_user_id") || "";
      
      // Update last active timestamp
      localStorage.setItem("disappear_last_active", Date.now().toString());
      
      // FIX: Clean up corrupt state from previous errors
      if (activeUserId === "undefined") {
          localStorage.removeItem("disappear_user_id");
          localStorage.removeItem("disappear_session");
          window.location.reload();
          return;
      }
      const res = await secureRequest(`${API_BASE_URL}/dashboard/sync?user_id=${activeUserId}&t=${Date.now()}`);
      const data = await res.json();

      if (data.profile) {
          // FIXED: Parsing the new decoupled fields from main.py
          setCredits({
              vcc_total: data.profile.vcc_email_total || 6,
              vcc_used: data.profile.used_vcc_email || 0,
              phone_total: data.profile.phone_total || 2,
              phone_used: data.profile.used_phones || 0
          });
      }

      // 2. Sync Filtered Purge History (Replacing the static recent audit)
      const historyRes = await secureRequest(`${API_BASE_URL}/api/v1/history?days=${historyDays}`);
      const historyData = await historyRes.json();
      
      setAuditLog(prevLog => {
        const latest = historyData.history?.[0];
        const oldLatest = prevLog.length > 0 ? prevLog[0] : null;
        if (latest && (!oldLatest || latest.timestamp !== oldLatest.timestamp)) {
            pushNotification(`SYSTEM_UPDATE: [${latest.action}]`);
        }
        return historyData.history || [];
      });

      // 3. Sync Financial/Alias Nodes
      const finRes = await secureRequest(`${API_BASE_URL}/financials/data`);
      const finData = await finRes.json();
      setCards(finData.cards || []);
      const aliasRes = await secureRequest(`${API_BASE_URL}/aliases/data`);
      const aliasData = await aliasRes.json();
      const allAliases = aliasData.aliases || [];
      
      setEmails(allAliases.filter(a => a.type === 'email'));
      setPhones(allAliases.filter(a => a.type === 'phone'));
      
      // 4. Sync Target Emails
      await fetchTargetEmails();

      // 5. Sync Linked Funding Sources
      try {
        const methodsRes = await secureRequest(`${API_BASE_URL}/payments/methods?user_id=${activeUserId}`);
        if (methodsRes.ok) {
          const methodsData = await methodsRes.json();
          setPaymentMethods(methodsData.methods || []);
          if (methodsData.methods && methodsData.methods.length > 0 && !selectedFundingSource) {
            setSelectedFundingSource(methodsData.methods[0].id);
          }
        }
      } catch (e) {
        console.warn("Failed to sync payment methods");
      }
    } catch (err) { 
        console.warn("Network interrupted. Attempting silent reconnect on next cycle...");
    }
  }, [pushNotification, historyDays]);

  useEffect(() => {
    let interval;
    if (showShield) {
      syncDefenseData();
      interval = setInterval(() => {
        syncDefenseData();
      }, 10000);
    }
    return () => clearInterval(interval);
  }, [showShield, syncDefenseData, historyDays, fetchTargetEmails]);

  const handlePurchaseExpansion = async (type) => {
    if (isProcessingPayment) return;
    setIsProcessingPayment(true);
    
    // AUTHENTICATION_BRIDGE: Capture local user ID to bind payment event
    const activeUserId = localStorage.getItem("disappear_user_id") || "anonymous_agent";

    // UPDATED: Corrected mapping for Phone Line Expansion
    const mappedType = (type === 'phone') 
      ? 'phone_line_bonus' 
      : (type === 'permanent_slot' ? 'permanent_slot' 
      : (type === 'email' ? 'extra_email_slot' 
      : 'cooldown_bypass'));

    const msg = "AUTHORIZING PAYMENT NODE...";
    triggerToast(msg);
    
    try {
      const res = await secureRequest(`${API_BASE_URL}/payments/create-session`, { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            expansion_type: mappedType,
            user_id: activeUserId,
            return_url: window.location.origin
        })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("Handshake failed");
      }
    } catch (err) { 
      triggerToast("PAYMENT NODE OFFLINE"); 
      setIsProcessingPayment(false);
    } finally {
      setTimeout(() => setIsProcessingPayment(false), 5000);
    }
  };

  const handleAddTargetEmail = async () => {
    if(!newTargetEmail) return;
    const activeUserId = localStorage.getItem("disappear_user_id") || "";
    try {
        const res = await secureRequest(`${API_BASE_URL}/profile/emails?user_id=${activeUserId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: newTargetEmail })
        });
        if(res.status === 403) {
            if(window.confirm("EMAIL SLOT LIMIT REACHED. Add an extra target email slot for $2.50?")) {
                handlePurchaseExpansion('email');
            }
            return;
        }
        if(res.ok) {
            setNewTargetEmail("");
            triggerToast("TARGET EMAIL ADDED TO SCRUB QUEUE");
            fetchTargetEmails();
        }
    } catch(e) {}
  };

  const handleSendTicket = async () => {
    if (!supportData.message) { triggerToast("ENTER MESSAGE"); return; }
    try {
        const res = await secureRequest(`${API_BASE_URL}/support/ticket`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(supportData)
        });
        if (res.ok) {
            triggerToast("TICKET TRANSMITTED");
            setSupportData({ subject: "TECHNICAL_ERR", message: "" });
            setShowSupportModal(false);
        }
    } catch (err) { triggerToast("UPLINK FAILURE"); }
  };

  const handleMintAlias = async (type) => {
    if (!aliasLabel) { triggerToast("ENTER LABEL"); return; }
    
    setPurgeStatus(`ENCRYPTING ${type.toUpperCase()}...`);
    setIsEncrypting(true); 
    try {
      const activeUserId = localStorage.getItem("disappear_user_id") || "";
      const res = await secureRequest(`${API_BASE_URL}/aliases/mint?user_id=${activeUserId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, label: aliasLabel, area_code: aliasAreaCode })
      });

      // TRIGGER POPUP TO BUY MORE SLOTS IF AT MAX
      if (res.status === 403) { 
        setIsEncrypting(false); 
        const upgrade = window.confirm("IDENTITY CAPACITY FULL: All protection nodes active. \n\nAdd a Permanent Vault Slot for $5.95?");
        if (upgrade) handlePurchaseExpansion("permanent_slot");
        return; 
      }
      
      // EMERGENCY BYPASS LOGIC
      if (res.status === 429) { 
        setIsEncrypting(false);
        const confirmBypass = window.confirm(
          "EMERGENCY PROTOCOL: Node cooling down (12h window). \n\nInitiate Emergency Protocol Wipe for $1.99?"
        );
        if (confirmBypass) {
          handlePurchaseExpansion("cooldown_bypass");
        }
        return; 
      }

      if (res.ok) {
        syncDefenseData();
        setAliasLabel("");
        setAliasAreaCode("");
        setShowEmailModal(false);
        setShowPhoneModal(false);
        triggerToast(`${type.toUpperCase()} SECURED`);
      } else if (res.status !== 403 && res.status !== 429) {
        const errData = await res.json().catch(() => ({}));
        triggerToast(errData.detail || "MINT FAILURE: EXTERNAL API ERROR");
      }
    } catch (err) { triggerToast("CONNECTION ERROR"); }
    finally { setIsEncrypting(false); setPurgeStatus(""); }
  };

  const handleKillAlias = async (id) => {
    try {
      await secureRequest(`${API_BASE_URL}/aliases/kill/${id}`, { method: "DELETE" });
      syncDefenseData();
      triggerToast("DATA TERMINATED");
    } catch (err) { triggerToast("ERROR"); }
  };
const handleEmergencyBurn = async () => {
    const confirmation = window.confirm("CONFIRM EMERGENCY BURN? \n\nAll active aliases and card nodes will be terminated immediately. Your scrub history will be vaulted in S3 before wipe.");
    if (!confirmation) return;

    setIsEmergencyWipe(true);
    setIsEncrypting(true);
    setPurgeStatus("UPLINKING FINAL AUDIT TO S3...");
    pushNotification("PRE_PURGE_UPLINK_INITIATED");
    
    try {
      // 1. Generate and Upload the Final Receipt to S3
      await handleDownloadPDF(true); 
      pushNotification("S3_AUDIT_VAULTED");
      
      setTimeout(async () => {
        setPurgeStatus("TERMINATING ALL ACTIVE NODES...");
        await secureRequest(`${API_BASE_URL}/financials/burn-all`, { method: "POST" });
        pushNotification("DATABASE_SCRUB_COMPLETE");
        
        setTimeout(() => {
          setPurgeStatus("PURGE COMPLETED. VAULT IS CLEAN.");
          pushNotification("SESSION_TERMINATING");
          setIsEmergencyWipe(false); 
          setTimeout(() => {
            localStorage.clear();
            window.location.reload();
          }, 3000); 
        }, 1500);
      }, 1500);
    } catch (err) { 
      triggerToast("PURGE ERROR"); 
      setIsEmergencyWipe(false); 
      setIsEncrypting(false);
    }
  };

  const handleLinkFundingSource = async () => {
    if (isProcessingPayment) return;
    setIsProcessingPayment(true);
    triggerToast("UPLINKING TO STRIPE SECURE VAULT...");
    try {
      const activeUserId = localStorage.getItem("disappear_user_id") || "";
      const res = await secureRequest(`${API_BASE_URL}/payments/create-setup-session?user_id=${activeUserId}`, { 
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ return_url: window.location.origin })
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else throw new Error("Handshake failed");
    } catch (err) {
      triggerToast("STRIPE VAULT OFFLINE");
    } finally {
      setTimeout(() => setIsProcessingPayment(false), 3000);
    }
  };

  const checkComplianceStatus = async (response) => {
    if (response && response.status === 403) {
      try {
        const errData = await response.clone().json().catch(() => ({}));
        const detail = errData.detail || "";
        if (detail.includes("COMPLIANCE_HOLD") || detail.includes("KYC") || detail.includes("AML")) {
          setKycModalReason(detail);
          setShowKycModal(true);
          return true;
        }
      } catch (err) {
        console.error("Compliance intercept error:", err);
      }
    }
    return false;
  };

  const handleMintCard = async () => {
    if (!newCardLabel) { triggerToast("ENTER MERCHANT NAME"); return; }
    setPurgeStatus("GENERATING PROTECTED DIGITS...");
    setIsEncrypting(true); 
    try {
      const activeUserId = localStorage.getItem("disappear_user_id") || "";
      const response = await secureRequest(`${API_BASE_URL}/financials/mint?user_id=${activeUserId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          label: newCardLabel,
          funding_source_id: selectedFundingSource
        })
      });
      
      const isComplianceHold = await checkComplianceStatus(response);
      if (isComplianceHold) {
        setIsEncrypting(false);
        setPurgeStatus("");
        return;
      }
      
      if (response.status === 403) { 
        setIsEncrypting(false); 
        const upgrade = window.confirm("IDENTITY CAPACITY FULL: All protection nodes are active. \n\nAdd a Permanent Vault Slot for $5.95?");
        if (upgrade) handlePurchaseExpansion("permanent_slot");
        return; 
      }

      if (response.ok) {
        syncDefenseData();
        setNewCardLabel("");
        setShowMintModal(false);
        triggerToast("NODE SECURED");
      } else {
        const errData = await response.json().catch(() => ({}));
        console.error("Mint Error:", errData);
        triggerToast(errData.detail || "MINT FAILURE: EXTERNAL API ERROR");
      }
    } catch (err) { console.error(err); triggerToast("CONNECTION ERROR"); }
    finally { setIsEncrypting(false); setPurgeStatus(""); } 
  };

  const handleKillCard = async (id) => {
    try {
      await secureRequest(`${API_BASE_URL}/financials/kill/${id}`, { method: "DELETE" });
      if (id !== 'global-1') {
        setCards(prev => prev.filter(c => c.id !== id));
      }
      triggerToast(id === 'global-1' ? "NODE ROTATED" : "NODE BURNED");
    } catch (err) { triggerToast("ERROR"); }
  };

  const verify2FA = async () => {
    if(!loginEmail) { triggerToast("ENTER REGISTERED EMAIL"); return; }
    triggerToast("AUTHENTICATING...");
    try {
      const res = await secureRequest(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail })
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("disappear_session", "active");
        localStorage.setItem("disappear_user_id", data.user_id);
        setShow2FA(false); 
        setShowLanding(false); // Switch to app
        setShowShield(true); 
        setProgress(100);
        triggerToast(`WELCOME BACK, ${data.first_name.toUpperCase()}`);
        syncDefenseData();
      } else {
        triggerToast("ACCESS DENIED: AGENT NOT FOUND");
      }
    } catch (err) {
       triggerToast("UPLINK FAILURE");
    }
  };

  const handleExportJSON = () => {
    const pwd = window.prompt("SECURITY CHECK: Create a password to encrypt this vault export. You will need it to decrypt the file later.");
    if (!pwd) {
      triggerToast("EXPORT ABORTED: PASSWORD REQUIRED");
      return;
    }
    
    triggerToast("ENCRYPTING VAULT CONFIGURATION...");
    const exportData = {
      agent_id: localStorage.getItem("disappear_user_id") || "AGENT_UNKNOWN",
      timestamp: new Date().toISOString(),
      vault_signature: "SIG_TIGER_BLUE_ALPHA",
      assets: {
        cards,
        emails,
        phones,
        target_emails: targetEmails
      },
      history: auditLog
    };
    
    // AES Client-Side Encryption
    const ciphertext = CryptoJS.AES.encrypt(JSON.stringify(exportData, null, 2), pwd).toString();
    
    const dataStr = "data:text/plain;charset=utf-8," + encodeURIComponent(ciphertext);
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `DISAPPEAR_VAULT_ENCRYPTED_${Date.now()}.disappear`);
    document.body.appendChild(downloadAnchorNode); 
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    triggerToast("VAULT EXPORTED SUCCESSFULLY");
  };

  const handleDownloadPDF = async (isSilentUplink = false) => {
    if (!isSilentUplink) setIsGenerating(true);
    if (!isSilentUplink) triggerToast("COMPILING ENCRYPTED AUDIT...");
    
    try {
      // 1. Fetch Real Scrub History from Backend with 404 safety
      let history = [];
      try {
          const scrubRes = await secureRequest(`${API_BASE_URL}/api/v1/scrub-history`);
          if (scrubRes.ok) {
              const scrubData = await scrubRes.json();
              history = scrubData.history || [];
          }
      } catch (e) { console.warn("Scrub history node currently unreachable - continuing with empty record."); }

      // 2. Build the "Total Purge" PDF Document
      const doc = new jsPDF();
      const agentId = localStorage.getItem("disappear_user_id") || "AGENT_UNKNOWN";
      
      // Cyberpunk Header
      doc.setFillColor(0, 71, 171); // Jesuit Tiger Blue
      doc.rect(0, 0, 210, 40, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.text("OFFICIAL PURGE RECEIPT", 15, 25);
      doc.setFontSize(10);
      doc.text(`DISAPPEAR P-A-A-S | SYSTEM REVISION 24`, 15, 33);

      // Audit Intelligence Section
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.text("AUDIT_METADATA", 15, 55);
      doc.setFontSize(10);
      doc.text(`AGENT_ID: ${agentId}`, 15, 65);
      doc.text(`TIMESTAMP: ${new Date().toUTCString()}`, 15, 72);
      doc.text(`VAULT_SIGNATURE: SIG_TIGER_BLUE_ALPHA`, 15, 79);

      // Data Broker Removal History Table
      doc.text("DATA_BROKER_REMOVAL_HISTORY", 15, 95);
      const tableData = history.length > 0 
        ? history.map(h => [h.broker_name, h.status, new Date(h.timestamp).toLocaleDateString()])
        : [["NO_REMOVALS_LOGGED", "NOMINAL", "---"]];

      // FIXED: Use the autoTable function directly
      autoTable(doc, {
        startY: 100,
        head: [['BROKER_ENTITY', 'STATUS', 'CLEARED_DATE']],
        body: tableData,
        headStyles: { fillColor: [0, 0, 0] },
        alternateRowStyles: { fillColor: [245, 245, 245] }
      });

      // 3. Convert PDF to Blob for S3 Uplink
      const pdfBlob = doc.output('blob');
      
      const formData = new FormData();
      formData.append('file', pdfBlob, `PURGE_${Date.now()}.pdf`);
      formData.append('user_id', agentId);

      // 4. Secure Uplink to AWS S3 via Backend
      try {
          const uploadRes = await fetch(`${API_BASE_URL}/financials/receipt/upload`, {
            method: "POST",
            body: formData
          });

          if (uploadRes.ok) {
            if (!isSilentUplink) triggerToast("AUDIT VAULTED IN S3");
          }
      } catch (uploadErr) {
          console.error("S3_UPLINK_FAILED:", uploadErr);
      }

      // 5. Provide Local Download (Unless it's a silent emergency burn)
      if (!isSilentUplink) {
        doc.save(`DISAPPEAR_AUDIT_${Date.now()}.pdf`);
        triggerToast("AUDIT DOWNLOADED");
      }
      
      return true;
    } catch (err) { 
      console.error("PDF_UPLINK_ERR:", err);
      if (!isSilentUplink) triggerToast("AUDIT FAILED"); 
      throw err;
    } finally { 
      if (!isSilentUplink) setIsGenerating(false); 
    }
  };

  const handleFinalPurchase = async () => {
    if(!targetProfile.firstName || !targetProfile.lastName || !targetProfile.email || !targetProfile.address || !targetProfile.city || !targetProfile.state || !targetProfile.zip) {
        triggerToast("REQUIRED FIELDS MISSING");
        return;
    }
    if (isMinting) return;

    setIsMinting(true);
    try {
        // Combine the address components so the backend database doesn't need to change
        const payload = {
            ...targetProfile,
            address: `${targetProfile.address}, ${targetProfile.city}, ${targetProfile.state} ${targetProfile.zip}`
        };
        
        // 1. Ingest Profile & Get User ID
        const profileRes = await secureRequest(`${API_BASE_URL}/financials/profile`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        
        let activeUserId = localStorage.getItem("disappear_user_id");
        if (profileRes.ok) {
            const profileData = await profileRes.json();
            
            // PREVENT SAVING 'undefined' if error was returned
            if (profileData.status === "error" || !profileData.profile_id) {
                triggerToast("PROFILE REGISTRATION FAILED");
                setIsMinting(false);
                return;
            }
            activeUserId = profileData.profile_id;
            localStorage.setItem("disappear_user_id", activeUserId);
            
            triggerToast("AUTHORIZING SECURE PAYMENT NODE...");
            try {
                const stripeRes = await secureRequest(`${API_BASE_URL}/payments/create-session`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ 
                        expansion_type: "subscription_" + billingCycle,
                        user_id: activeUserId,
                        return_url: window.location.origin
                    })
                });
                const stripeData = await stripeRes.json();
                if (stripeData.url) {
                    window.location.href = stripeData.url;
                } else {
                    throw new Error("Handshake failed");
                }
            } catch (err) {
                triggerToast("PAYMENT NODE OFFLINE");
            }
        } else {
            triggerToast("PROFILE REGISTRATION FAILED");
        }
    } catch (err) {
        console.error("Connection Error:", err);
        triggerToast("NODE OFFLINE");
    } finally {
        setIsMinting(false);
    }
  };

  const handleNumericDateInput = (e) => {
    let val = e.target.value.replace(/\D/g, ''); 
    if (val.length > 8) val = val.slice(0, 8);
    let formatted = val;
    if (val.length > 4) {
        formatted = `${val.slice(0, 2)}/${val.slice(2, 4)}/${val.slice(4)}`;
    } else if (val.length > 2) {
        formatted = `${val.slice(0, 2)}/${val.slice(2)}`;
    }
    setTargetProfile({...targetProfile, dob: formatted});
  };

  const handleManageBilling = async () => {
    triggerToast("UPLINKING TO STRIPE PORTAL...");
    try {
        const res = await secureRequest(`${API_BASE_URL}/payments/customer-portal`, { method: "POST" });
        const data = await res.json();
        if (data.url) window.location.href = data.url;
    } catch (err) { triggerToast("PORTAL OFFLINE"); }
  };

  return (
    <div className={`app-container ${isEmergencyWipe ? 'wipe-shake' : ''}`}>
      
      {/* 1. SEPARATE MARKETING WEBSITE (Intelligence Hub) */}
      {showLanding ? (
        <div style={{ position: 'relative', width: '100%', minHeight: '100vh' }}>
          <LandingPage 
            onEnterVault={() => window.location.hash = "pricing"} 
            onLoginRequest={() => window.location.hash = "login"}
            onReadManifesto={() => window.location.hash = "manifesto"}
          />
          {/* MOBILE DOWNLOAD BRIDGE: Fixed Positioning Fix */}
          {!Capacitor.isNativePlatform() && (
            <div style={{ 
              position: 'fixed', 
              bottom: '100px', 
              left: '0', 
              width: '100%', 
              display: 'flex', 
              justifyContent: 'center', 
              zIndex: 9999,
              padding: '0 20px'
            }}>
              <a 
                href="https://d3bipqcsrujl11.cloudfront.net/app-debug.apk" 
                download="Disappear_Shield.apk" 
                className="main-button" 
                style={{ 
                  textDecoration: 'none', 
                  boxShadow: '0 0 20px rgba(0, 71, 171, 0.6)',
                  width: '100%',
                  maxWidth: '300px',
                  textAlign: 'center',
                  display: 'block'
                }}
              >
                GET ANDROID APP
              </a>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* 2. CORE APP HEADER */}
          <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
            <span className="secure-connection-text">
              {showShield ? `SHIELD ACTIVE | ELITE OPERATIVE` : `INITIALIZING SHIELD: ${progress}%`}
            </span>
          </div>

          {showToast && <div className="status-message toast-fixed">{showToast}</div>}

          <div className="notification-stack">
            {notifications.map(n => (
              <div key={n.id} className="notif-pill fade-in">
                 <span className="pulse-dot"></span> {n.msg}
              </div>
            ))}
          </div>
{/* --- INTERACTIVE FAQ MODAL --- */}
          {showFaqModal && (
            <div className="modal-overlay" style={{zIndex: 70000}} onClick={() => setShowFaqModal(false)}>
              <div className="price-box" style={{maxWidth: '650px', textAlign: 'left', overflowY: 'auto', maxHeight: '85vh'}} onClick={e => e.stopPropagation()}>
                <h3 className="tiger-text">FAQ</h3>
                <p className="field-label" style={{marginBottom: '20px'}}>SELECT NODE FOR INTELLIGENCE</p>

                <div className="faq-item" onClick={() => setActiveFaqNode(activeFaqNode === 'global' ? null : 'global')} style={{cursor: 'pointer', borderBottom: '1px solid #111', padding: '15px 0'}}>
                    <div className="faq-trigger" style={{color: '#FFD700', fontWeight: 'bold'}}>
                      {activeFaqNode === 'global' ? '[-] GLOBAL WALLET NODE' : '[+] GLOBAL WALLET NODE'}
                    </div>
                    {activeFaqNode === 'global' && (
                        <div className="faq-content fade-in" style={{fontSize: '0.8rem', color: '#94A3B8', marginTop: '10px', paddingLeft: '10px', borderLeft: '2px solid #FFD700'}}>
                            <p><strong>USAGE:</strong> Best for high-trust merchants and in-person Digital Wallet (Apple/Google Pay) usage.</p>
                            <strong style={{color: 'white', display: 'block', marginTop: '10px'}}>OPERATION STEPS:</strong>
                            <ol style={{paddingLeft: '15px'}}>
                                <li>Retrieve digits from the 'GLOBAL WALLET NODE' module at the top of your dashboard.</li>
                                <li>Add the 16-digit card number, EXP, and CVV to your smartphone wallet.</li>
                                <li><strong>CORE ARCHITECTURE:</strong> This is a multi-merchant node. Use it for general recurring trust-based purchases.</li>
                                <li>Click 'RESET NODE' if you believe merchant processors have logged the card info.</li>
                            </ol>
                        </div>
                    )}
                </div>

                <div className="faq-item" onClick={() => setActiveFaqNode(activeFaqNode === 'vcc' ? null : 'vcc')} style={{cursor: 'pointer', borderBottom: '1px solid #111', padding: '15px 0'}}>
                    <div className="faq-trigger tiger-text">
                      {activeFaqNode === 'vcc' ? '[-] CREDIT CARD PROTECTION' : '[+] CREDIT CARD PROTECTION'}
                    </div>
                    {activeFaqNode === 'vcc' && (
                        <div className="faq-content fade-in" style={{fontSize: '0.95rem', color: '#cbd5e1', marginTop: '10px', paddingLeft: '10px', borderLeft: '1px solid var(--tiger-blue)'}}>
                            <p><strong>USAGE:</strong> Best for individual subscriptions and untrusted merchant endpoints.</p>
                            <strong style={{color: 'white', display: 'block', marginTop: '10px'}}>OPERATION STEPS:</strong>
                            <ol style={{paddingLeft: '15px'}}>
                                <li>Click 'GENERATE CARD PROTECTION' and label it (e.g., Netflix).</li>
                                <li>System provides isolated digits for that specific merchant.</li>
                                <li><strong>THE DIFFERENCE:</strong> Once used, this node "locks" to that merchant. If they are hacked, these digits are worthless anywhere else.</li>
                            </ol>
                        </div>
                    )}
                </div>

                <div className="faq-item" onClick={() => {setActiveFaqNode(activeFaqNode === 'email' ? null : 'email')}} style={{cursor: 'pointer', borderBottom: '1px solid #111', padding: '15px 0'}}>
                    <div className="faq-trigger tiger-text">
                      {activeFaqNode === 'email' ? '[-] EMAIL RELAY NODES' : '[+] EMAIL RELAY NODES'}
                    </div>
                    {activeFaqNode === 'email' && (
                        <div className="faq-content fade-in" style={{fontSize: '0.95rem', color: '#cbd5e1', marginTop: '10px', paddingLeft: '10px', borderLeft: '1px solid var(--tiger-blue)'}}>
                            <p><strong>USAGE:</strong> Protects your primary identity from marketing lists and data broker aggregators.</p>
                            <strong style={{color: 'white', display: 'block', marginTop: '10px'}}>OPERATION STEPS:</strong>
                            <ol style={{paddingLeft: '15px'}}>
                                <li>Assign a label (e.g., 'E-Commerce') and click 'GENERATE'.</li>
                                <li>Use the generated address for web registrations.</li>
                                <li>PII trackers are scrubbed before forwarding to your inbox.</li>
                            </ol>
                        </div>
                    )}
                </div>

                <div className="faq-item" onClick={() => setActiveFaqNode(activeFaqNode === 'phone' ? null : 'phone')} style={{cursor: 'pointer', borderBottom: '1px solid #111', padding: '15px 0'}}>
                    <div className="faq-trigger tiger-text">
                      {activeFaqNode === 'phone' ? '[-] SMS VERIFICATION NODES' : '[+] SMS VERIFICATION NODES'}
                    </div>
                    {activeFaqNode === 'phone' && (
                        <div className="faq-content fade-in" style={{fontSize: '0.95rem', color: '#cbd5e1', marginTop: '10px', paddingLeft: '10px', borderLeft: '1px solid var(--tiger-blue)'}}>
                            <p><strong>USAGE:</strong> Best for 2FA bypass and anonymous app verifications.</p>
                            <strong style={{color: 'white', display: 'block', marginTop: '10px'}}>OPERATION STEPS:</strong>
                            <ol style={{paddingLeft: '15px'}}>
                                <li>Generate a 'PHONE ALIAS' node.</li>
                                <li>Enter the provided +1 number into the verification field.</li>
                                <li>The incoming code appears instantly in the 'LIVE SECURITY AUDIT' on your dashboard.</li>
                            </ol>
                        </div>
                    )}
                </div>

                <button className="main-button" style={{width: '100%', marginTop: '30px'}} onClick={() => setShowFaqModal(false)}>EXIT FAQ</button>
              </div>
            </div>
          )}

          {/* --- OPERATION MANUAL MODAL --- */}
          {showManualModal && (
            <div className="modal-overlay" style={{zIndex: 70000}} onClick={() => setShowManualModal(false)}>
              <div className="price-box" style={{maxWidth: '650px', textAlign: 'left', overflowY: 'auto', maxHeight: '85vh'}} onClick={e => e.stopPropagation()}>
                <h3 className="tiger-text">OPERATION MANUAL v2.0</h3>
                <p className="field-label" style={{marginBottom: '20px'}}>STEP-BY-STEP NODE INSTRUCTIONS</p>

                {false && (
                  // VCC feature is disabled
                  <>
                    <div style={{ marginBottom: '20px', borderLeft: '2px solid var(--tiger-blue)', paddingLeft: '15px' }}>
                      <p className="field-label" style={{ color: 'white', marginBottom: '5px' }}>💳 GLOBAL WALLET NODE</p>
                      <ol style={{ fontSize: '0.95rem', lineHeight: '1.4', color: '#cbd5e1', paddingLeft: '20px', margin: 0 }}>
                        <li style={{ marginBottom: '5px' }}>Select "ACTIVATE GLOBAL NODE" to generate your primary digits.</li>
                        <li style={{ marginBottom: '5px' }}>Add the 16-digit card number, EXP, and CVV to your smartphone wallet (Apple/Google Pay).</li>
                        <li style={{ marginBottom: '5px' }}>Use this node for high-trust, in-person, or recurring trusted payments.</li>
                        <li>Click "RESET NODE" to instantly burn the old digits and generate a new set if you suspect a breach.</li>
                      </ol>
                    </div>
                    <div style={{ marginBottom: '20px', borderLeft: '2px solid var(--tiger-blue)', paddingLeft: '15px' }}>
                      <p className="field-label" style={{ color: 'white', marginBottom: '5px' }}>💳 CREDIT CARD PROTECTION</p>
                      <ol style={{ fontSize: '0.95rem', lineHeight: '1.4', color: '#cbd5e1', paddingLeft: '20px', margin: 0 }}>
                        <li style={{ marginBottom: '5px' }}>Click "GENERATE CARD PROTECTION".</li>
                        <li style={{ marginBottom: '5px' }}>Enter a label identifying the merchant (e.g., "Netflix" or "Amazon").</li>
                        <li style={{ marginBottom: '5px' }}>Select which of your linked funding sources (Stripe) will cover this specific virtual card.</li>
                        <li style={{ marginBottom: '5px' }}>Use the generated digits exclusively at that merchant.</li>
                        <li>Click "TERMINATE" to instantly destroy the card and block future charges when no longer needed.</li>
                      </ol>
                    </div>
                  </>
                )}

                <div style={{ marginBottom: '20px', borderLeft: '2px solid var(--tiger-blue)', paddingLeft: '15px' }}>
                  <p className="field-label" style={{ color: 'white', marginBottom: '5px' }}>✉️ EMAIL RELAY NODES</p>
                  <ol style={{ fontSize: '0.95rem', lineHeight: '1.4', color: '#cbd5e1', paddingLeft: '20px', margin: 0 }}>
                    <li style={{ marginBottom: '5px' }}>Click "GENERATE EMAIL ALIAS".</li>
                    <li style={{ marginBottom: '5px' }}>Assign a recognizable label to the alias.</li>
                    <li style={{ marginBottom: '5px' }}>Copy the generated <code style={{background: '#111', padding: '2px 4px', borderRadius: '3px'}}>@anonaddy.me</code> address and use it for web registrations.</li>
                    <li style={{ marginBottom: '5px' }}>Incoming mail will be stripped of hidden PII trackers and forwarded to your primary inbox.</li>
                    <li>Click "TERMINATE" to permanently block all mail sent to that specific alias.</li>
                  </ol>
                </div>

                <div style={{ marginBottom: '20px', borderLeft: '2px solid var(--tiger-blue)', paddingLeft: '15px' }}>
                  <p className="field-label" style={{ color: 'white', marginBottom: '5px' }}>📱 PHONE ALIAS NODES</p>
                  <ol style={{ fontSize: '0.95rem', lineHeight: '1.4', color: '#cbd5e1', paddingLeft: '20px', margin: 0 }}>
                    <li style={{ marginBottom: '5px' }}>Click "GENERATE PHONE ALIAS" to provision a secure +1 phone number.</li>
                    <li style={{ marginBottom: '5px' }}>Provide this number when signing up for services that require SMS 2FA.</li>
                    <li style={{ marginBottom: '5px' }}>Any incoming SMS messages will automatically appear in your "LIVE SECURITY AUDIT" feed.</li>
                    <li>Click "TERMINATE" to release the number back to the carrier and prevent future contact.</li>
                  </ol>
                </div>
                
                {false && (
                  <div style={{ marginBottom: '20px', borderLeft: '2px solid var(--tiger-blue)', paddingLeft: '15px' }}>
                    <p className="field-label" style={{ color: 'white', marginBottom: '5px' }}>🏦 EXTERNAL FUNDING SOURCES</p>
                    <ol style={{ fontSize: '0.95rem', lineHeight: '1.4', color: '#cbd5e1', paddingLeft: '20px', margin: 0 }}>
                      <li style={{ marginBottom: '5px' }}>Click "LINK REAL CARD (STRIPE)".</li>
                      <li style={{ marginBottom: '5px' }}>Securely enter your real credit/debit card into the encrypted Stripe vault.</li>
                      <li style={{ marginBottom: '5px' }}>Return to the dashboard to see your linked funding sources.</li>
                      <li>Assign these funding sources when generating new virtual cards for secure pass-through charging.</li>
                    </ol>
                  </div>
                )}

                <div style={{ marginBottom: '20px', borderLeft: '2px solid #ef4444', paddingLeft: '15px' }}>
                  <p className="field-label" style={{ color: '#ef4444', marginBottom: '5px' }}>🔥 EMERGENCY BURN PROTOCOL</p>
                  <ol style={{ fontSize: '0.95rem', lineHeight: '1.4', color: '#cbd5e1', paddingLeft: '20px', margin: 0 }}>
                    <li style={{ marginBottom: '5px' }}>Click "INITIATE EMERGENCY BURN" at the bottom of the dashboard.</li>
                    <li style={{ marginBottom: '5px' }}>The system will export and vault your entire removal history as a PDF.</li>
                    <li style={{ marginBottom: '5px' }}>All active phone and email aliases will be instantly terminated.</li>
                    <li>You will be securely logged out of the system.</li>
                  </ol>
                </div>

                <button className="main-button" style={{width: '100%', marginTop: '20px'}} onClick={() => setShowManualModal(false)}>CLOSE MANUAL</button>
              </div>
            </div>
          )}

          {/* --- ALIAS MINTING MODALS --- */}
          {(showEmailModal || showPhoneModal) && (
            <div className="modal-overlay" style={{zIndex: 50000}} onClick={() => {setShowEmailModal(false); setShowPhoneModal(false); setAliasLabel(""); setAliasAreaCode("");}}>
              <div className="price-box" onClick={e => e.stopPropagation()}>
                <h3 className="tiger-text">GENERATE {showEmailModal ? 'EMAIL' : 'PHONE'} ALIAS</h3>
                
                <p className="field-label">ASSOCIATE LABEL</p>
                <input className="mask-btn" style={{color: 'white', textAlign: 'center', marginBottom: '15px'}} placeholder="e.g. Shopping, Personal" value={aliasLabel} onChange={(e) => setAliasLabel(e.target.value)} />
                
                {showPhoneModal && (
                  <>
                    <p className="field-label">PREFERRED AREA CODE (OPTIONAL)</p>
                    <input className="mask-btn" style={{color: 'white', textAlign: 'center', marginBottom: '15px'}} placeholder="e.g. 212, 310, 800" maxLength={3} value={aliasAreaCode} onChange={(e) => setAliasAreaCode(e.target.value.replace(/\D/g, ''))} />
                  </>
                )}

                <button className="main-button" style={{width: '100%', marginTop: '20px'}} onClick={() => handleMintAlias(showEmailModal ? 'email' : 'phone')}>AUTHORIZE</button>
                <button className="reset-btn" style={{width: '100%'}} onClick={() => {setShowEmailModal(false); setShowPhoneModal(false); setAliasLabel(""); setAliasAreaCode("");}}>CANCEL</button>
              </div>
            </div>
          )}

          {showMintModal && (
            <div className="modal-overlay" style={{zIndex: 50000}} onClick={() => setShowMintModal(false)}>
              <div className="price-box" onClick={e => e.stopPropagation()}>
                <h3 className="tiger-text">GENERATE CARD PROTECTION</h3>
                
                <p className="field-label">ASSOCIATE MERCHANT / BILL</p>
                <input className="mask-btn" style={{width: '100%', color: 'white', textAlign: 'center', marginBottom: '10px'}} placeholder="e.g. Amazon, Electric Bill" value={newCardLabel} onChange={(e) => setNewCardLabel(e.target.value)} />
                
                <p className="field-label" style={{marginTop: '15px'}}>SELECT FUNDING SOURCE</p>
                {paymentMethods.length > 0 ? (
                    <select className="mask-btn" style={{width: '100%', background: '#000', color: 'white', marginBottom: '10px'}} value={selectedFundingSource} onChange={(e) => setSelectedFundingSource(e.target.value)}>
                        {paymentMethods.map(m => (
                            <option key={m.id} value={m.id}>{m.brand.toUpperCase()} ending in {m.last4}</option>
                        ))}
                    </select>
                ) : (
                    <div style={{ color: '#ff4444', fontSize: '0.85rem', marginBottom: '15px', textAlign: 'center' }}>
                        NO FUNDING SOURCES AVAILABLE. LINK A CARD FIRST.
                    </div>
                )}

                <button className="main-button" style={{width: '100%', marginTop: '20px'}} onClick={handleMintCard} disabled={paymentMethods.length === 0}>AUTHORIZE NODE</button>
                <button className="reset-btn" style={{width: '100%'}} onClick={() => setShowMintModal(false)}>CANCEL</button>
              </div>
            </div>
          )}

          <main>
            {showShield ? (
              /* 3. SECURE APPLICATION ENGINE (Restored) */
              <div className="shield-container fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                <h2 className="shield-text">🛡️ SHIELD ACTIVE</h2>
                
                {false && (
                  // VCC feature is disabled
                  <div className="masking-tool" style={{ width: '100%', maxWidth: '600px', border: '1px solid #FFD700', background: '#050505', position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                      <p className="tool-label" style={{ margin: 0, color: '#FFD700' }}>GLOBAL WALLET NODE</p>
                      <span style={{ fontSize: '0.85rem', color: '#94A3B8' }}>WALLETS_ENABLED: [TRUE]</span>
                    </div>
                    {(() => {
                      const globalCard = cards.find(c => c.label.toUpperCase() === 'PRIMARY_PAY_NODE' || c.label.toUpperCase().includes('GLOBAL'));
                      return globalCard ? (
                        <div className="managed-card-row enhanced-card" style={{ background: 'linear-gradient(135deg, #050505 0%, #111 100%)' }}>
                          <div className="card-row-info">
                            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px'}}>
                               <span className="card-nickname" style={{color: '#FFD700', fontWeight: 'bold'}}>{globalCard.label.toUpperCase()}</span>
                               <button className="kill-text-bold" onClick={() => { if(window.confirm("RESET NODE? Old card will be burned.")) handleKillCard(globalCard.id); }}>RESET NODE</button>
                            </div>
                            
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#020202', padding: '10px 12px', borderRadius: '6px', border: '1px solid #222', cursor: 'pointer', marginBottom: '12px' }} onClick={() => {navigator.clipboard.writeText(globalCard.number.replace(/\s/g, '')); triggerToast("CARD NUMBER COPIED")}}>
                              <code className="card-digits" style={{ fontSize: '1.2rem', letterSpacing: '3px', color: '#fff', margin: 0, padding: 0 }}>{globalCard.number}</code>
                              <span style={{ fontSize: '0.8rem', color: '#FFD700', fontWeight: 'bold' }}>COPY 📋</span>
                            </div>

                            <div style={{display: 'flex', gap: '30px', borderTop: '1px solid #222', paddingTop: '10px', marginTop: '10px'}}>
                               <div style={{ cursor: 'pointer' }} onClick={() => {navigator.clipboard.writeText(globalCard.expiry || '12/29'); triggerToast("EXPIRY COPIED")}}>
                                 <span style={{fontSize: '0.75rem', color: '#cbd5e1', display: 'block'}}>EXP 📋</span>
                                 <strong>{globalCard.expiry || '12/29'}</strong>
                               </div>
                               <div style={{ cursor: 'pointer' }} onClick={() => {navigator.clipboard.writeText(globalCard.cvv || '000'); triggerToast("CVV COPIED")}}>
                                 <span style={{fontSize: '0.75rem', color: '#cbd5e1', display: 'block'}}>CVV 📋</span>
                                 <strong>{globalCard.cvv || '***'}</strong>
                                </div>
                               <div style={{ marginLeft: 'auto' }}>
                                  <span style={{fontSize: '0.75rem', color: '#cbd5e1', display: 'block'}}>TYPE</span>
                                  <span style={{ fontSize: '0.9rem' }}>VIRTUAL_DEBIT</span>
                               </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '20px', border: '1px dashed #334155', borderRadius: '4px' }}>
                          <span style={{ color: '#94A3B8', fontSize: '0.85rem', display: 'block', marginBottom: '15px' }}>NO ACTIVE GLOBAL WALLET LINKED.</span>
                          <button className="reset-btn" style={{ fontSize: '0.85rem', padding: '8px 15px' }} onClick={() => { setNewCardLabel('PRIMARY_PAY_NODE'); setShowMintModal(true); }}>ACTIVATE GLOBAL NODE</button>
                        </div>
                      );
                    })()}
                  </div>
                )}

                <div className="masking-tool" style={{ border: '1px solid #111', background: '#050505', width: '100%', maxWidth: '600px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                        <div>
                            <span className="field-label" style={{ display: 'block', fontSize: '0.85rem', color: 'white', letterSpacing: '2px', fontWeight: 'bold', textTransform: 'uppercase' }}>VAULT CAPACITY</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--tiger-blue)', display: 'block', marginTop: '3px', fontWeight: 'bold', textTransform: 'uppercase' }}>EMAIL ALIAS NODES</span>
                        </div>
                        <span className="tiger-text" style={{ alignSelf: 'center' }}>{emails.length} / {credits.vcc_total}</span>
                    </div>
                    <button className="purchase-btn" disabled={isProcessingPayment} onClick={() => handlePurchaseExpansion('permanent_slot')}>
                      {isProcessingPayment ? "PROCESSING..." : "+ ADD PERMANENT VAULT SLOT ($5.95)"}
                    </button>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '25px', marginBottom: '10px' }}>
                        <div>
                            <span className="field-label" style={{ display: 'block', fontSize: '0.85rem', color: 'white', letterSpacing: '2px', fontWeight: 'bold', textTransform: 'uppercase' }}>ACTIVE PHONE LINES</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--tiger-blue)', display: 'block', marginTop: '3px', fontWeight: 'bold', textTransform: 'uppercase' }}>PHONE ALIAS NODES</span>
                        </div>
                        <span className="tiger-text" style={{ alignSelf: 'center' }}>{phones.length} / {credits.phone_total}</span>
                    </div>
                    <button 
                      className="purchase-btn" 
                      style={{borderColor: 'var(--tiger-blue)'}} 
                      disabled={isProcessingPayment} 
                      onClick={() => handlePurchaseExpansion('phone')}
                    >
                      {isProcessingPayment ? "PROCESSING..." : "+ PROVISION EXTRA MOBILE LINE ($5.95)"}
                    </button>
                </div>
                
                <div className="masking-tool" style={{ width: '100%', maxWidth: '600px', position: 'relative' }}>
                  <p className="tool-label" style={{ textAlign: 'center', marginBottom: '15px' }}>EMAIL PROTECTION</p>
                  <div className="alias-manager-list">
                    {emails.map((e) => (
                      <div key={e.id} className="alias-row" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '15px' }}>
                        <div className="alias-info" style={{ width: '100%', wordBreak: 'break-all', marginBottom: '10px' }}>
                            <span className="alias-label tiger-text" style={{ display: 'block', marginBottom: '5px' }}>{e.label.toUpperCase()}</span>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: '#0a0a0a', padding: '10px 12px', borderRadius: '6px', border: '1px solid #222', cursor: 'pointer', marginTop: '5px' }} onClick={() => {navigator.clipboard.writeText(e.content); triggerToast("EMAIL COPIED")}}>
                              <span className="alias-content" style={{ fontSize: '1rem', color: '#fff', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '10px', flex: 1 }}>{e.content}</span>
                              <span style={{ fontSize: '0.8rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold', flexShrink: 0 }}>COPY 📋</span>
                            </div>
                        </div>
                        <button className="kill-text-bold" onClick={() => handleKillAlias(e.id)}>TERMINATE</button>
                      </div>
                    ))}
                  </div>
                  <button className="reset-btn" style={{marginTop: '20px', width: '100%', borderStyle: 'dashed'}} onClick={() => setShowEmailModal(true)}> + GENERATE EMAIL ALIAS </button>
                </div>

                <div className="masking-tool" style={{ width: '100%', maxWidth: '600px', position: 'relative' }}>
                  <p className="tool-label" style={{ textAlign: 'center', marginBottom: '15px' }}>PHONE PROTECTION</p>
                  <div className="alias-manager-list">
                    {phones.map((p) => (
                      <div key={p.id} className="alias-row" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '15px' }}>
                        <div className="alias-info" style={{ width: '100%', wordBreak: 'break-all', marginBottom: '10px' }}>
                            <span className="alias-label tiger-text" style={{ display: 'block', marginBottom: '5px' }}>{p.label.toUpperCase()}</span>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: '#0a0a0a', padding: '10px 12px', borderRadius: '6px', border: '1px solid #222', cursor: 'pointer', marginTop: '5px' }} onClick={() => {navigator.clipboard.writeText(p.content); triggerToast("PHONE COPIED")}}>
                              <span className="alias-content" style={{ fontSize: '1rem', color: '#fff', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '10px', flex: 1 }}>{p.content}</span>
                              <span style={{ fontSize: '0.8rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold', flexShrink: 0 }}>COPY 📋</span>
                            </div>
                        </div>
                        <button className="kill-text-bold" onClick={() => handleKillAlias(p.id)}>TERMINATE</button>
                      </div>
                    ))}
                  </div>
                  <button className="reset-btn" style={{marginTop: '20px', width: '100%', borderStyle: 'dashed'}} onClick={() => setShowPhoneModal(true)}> + GENERATE PHONE ALIAS </button>
                </div>

                {false && (
                  // VCC feature is disabled
                  <div className="masking-tool" style={{ width: '100%', maxWidth: '600px', position: 'relative' }}>
                    <p className="tool-label" style={{ textAlign: 'center', marginBottom: '20px' }}>CREDIT CARD PROTECTION</p>
                    <div className="card-manager-list">
                      {cards.filter(c => {
                         const globalCard = cards.find(gc => gc.label.toUpperCase() === 'PRIMARY_PAY_NODE' || gc.label.toUpperCase().includes('GLOBAL'));
                         return !globalCard || c.id !== globalCard.id;
                      }).map((c) => (
                          <div key={c.id} className="managed-card-row enhanced-card">
                            <div className="card-row-info">
                              <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px'}}>
                                   <span className="card-nickname tiger-text">{c.label.toUpperCase()}</span>
                                   <button className="kill-text-bold" onClick={() => handleKillCard(c.id)}>TERMINATE</button>
                              </div>
                              
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#020202', padding: '10px 12px', borderRadius: '6px', border: '1px solid #222', cursor: 'pointer', marginBottom: '12px' }} onClick={() => {navigator.clipboard.writeText(c.number.replace(/\s/g, '')); triggerToast("CARD NUMBER COPIED")}}>
                                <code className="card-digits" style={{ fontSize: '1.15rem', letterSpacing: '2px', color: '#fff', margin: 0, padding: 0 }}>{c.number}</code>
                                <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 'bold' }}>COPY 📋</span>
                              </div>

                              <div style={{display: 'flex', gap: '30px', borderTop: '1px solid #111', paddingTop: '10px', marginTop: '10px'}}>
                                   <div style={{ cursor: 'pointer' }} onClick={() => {navigator.clipboard.writeText(c.expiry || '08/28'); triggerToast("EXPIRY COPIED")}}>
                                     <span style={{fontSize: '0.75rem', color: '#cbd5e1', display: 'block'}}>EXP 📋</span>
                                     <strong>{c.expiry || '08/28'}</strong>
                                   </div>
                                   <div style={{ cursor: 'pointer' }} onClick={() => {navigator.clipboard.writeText(c.cvv || '000'); triggerToast("CVV COPIED")}}>
                                     <span style={{fontSize: '0.75rem', color: '#cbd5e1', display: 'block'}}>CVV 📋</span>
                                     <strong>{c.cvv || '***'}</strong>
                                   </div>
                              </div>
                            </div>
                          </div>
                      ))}
                    </div>
                    <button className="reset-btn" style={{marginTop: '20px', width: '100%', borderStyle: 'dashed'}} onClick={() => { setNewCardLabel(""); setShowMintModal(true); }}> + GENERATE CARD PROTECTION </button>
                  </div>
                )}

                <div className="masking-tool" style={{ width: '100%', maxWidth: '600px', border: '1px solid #111' }}>
                  <p className="tool-label" style={{ textAlign: 'center', marginBottom: '15px' }}>DATA BROKER TARGETS</p>
                  
                  <div className="alias-row" style={{ marginBottom: '10px' }}>
                    <div className="alias-info"><span className="alias-label" style={{color: '#10b981'}}>PRIMARY</span><span className="alias-content">{targetEmails.primary || "Awaiting Sync..."}</span></div>
                  </div>
                  
                  {targetEmails.additional.map(e => (
                    <div key={e.id} className="alias-row" style={{ marginBottom: '10px' }}>
                      <div className="alias-info"><span className="alias-label tiger-text">SECONDARY</span><span className="alias-content">{e.email}</span></div>
                      <button className="kill-text-bold" onClick={async () => { await secureRequest(`${API_BASE_URL}/profile/emails/${e.id}`, {method: 'DELETE'}); fetchTargetEmails(); }}>REMOVE</button>
                    </div>
                  ))}
                  
                  <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                    <input className="mask-btn" style={{flex: 1, color: 'white', textAlign: 'center'}} placeholder="Add secondary email to scrub..." value={newTargetEmail} onChange={e => setNewTargetEmail(e.target.value)} />
                    <button className="reset-btn" style={{ fontSize: '0.95rem', padding: '0 15px', display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={handleAddTargetEmail}>ADD TARGET</button>
                  </div>
                  
                  <div style={{ fontSize: '0.95rem', color: '#cbd5e1', textAlign: 'center', marginTop: '10px' }}>
                    EXTRA EMAIL SLOTS USED: {targetEmails.used} / {targetEmails.slots}
                  </div>
                </div>

                {false && (
                  // VCC feature is disabled
                  <div className="masking-tool" style={{ width: '100%', maxWidth: '600px', border: '1px solid #111' }}>
                    <p className="tool-label" style={{ textAlign: 'center', marginBottom: '15px' }}>EXTERNAL FUNDING SOURCES</p>
                    {paymentMethods.length > 0 ? paymentMethods.map(m => (
                      <div key={m.id} className="alias-row" style={{ marginBottom: '10px' }}>
                        <div className="alias-info" style={{ display: 'flex', flexDirection: 'column' }}>
                          <span className="alias-label tiger-text">{m.brand.toUpperCase()}</span>
                          <span className="alias-content">**** **** **** {m.last4} (EXP {m.exp_month}/{m.exp_year})</span>
                        </div>
                      </div>
                    )) : (
                      <div className="terminal-line" style={{textAlign: 'center', opacity: 0.5, marginBottom: '15px'}}>NO FUNDING SOURCES LINKED</div>
                    )}
                    <button className="reset-btn" style={{ fontSize: '0.95rem', padding: '12px 5px', display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', borderStyle: 'dashed' }} onClick={handleLinkFundingSource} disabled={isProcessingPayment}>
                      {isProcessingPayment ? "UPLINKING..." : "+ LINK REAL CARD (STRIPE)"}
                    </button>
                  </div>
                )}

                <div className="masking-tool" style={{ width: '100%', maxWidth: '600px', border: '1px solid #444' }}>
                  <p className="tool-label" style={{ textAlign: 'center' }}>SUBSCRIPTION_MANAGEMENT</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <div>
                        <span style={{ fontSize: '0.85rem', color: '#cbd5e1', display: 'block' }}>CURRENT_PLAN</span>
                        <strong className="tiger-text">ELITE_OPERATIVE_{billingCycle.toUpperCase()}</strong>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.85rem', color: '#cbd5e1', display: 'block' }}>STATUS</span>
                        <span style={{ color: '#00FF00', fontSize: '0.9rem' }}>[ACTIVE]</span>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                    <button className="reset-btn" style={{ fontSize: '0.95rem', padding: '12px 5px', whiteSpace: 'normal', lineHeight: '1.2', display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={handleManageBilling}>
                      {billingCycle === 'monthly' ? "SWITCH_TO_ANNUAL" : "SWITCH_TO_MONTHLY"}
                    </button>
                    <button className="reset-btn" style={{ borderColor: '#ff4444', color: '#ff4444', fontSize: '0.95rem', padding: '12px 5px', whiteSpace: 'normal', lineHeight: '1.2', display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => { if(window.confirm("CANCEL SUBSCRIPTION? PII shielding will be deactivated at end of cycle.")) handleManageBilling(); }}>
                      CANCEL_PLAN
                    </button>
                  </div>
                </div>

                <div className="masking-tool" style={{ width: '100%', maxWidth: '600px', border: '1px solid var(--tiger-blue)' }}>
                  <p className="tool-label tiger-text" style={{ textAlign: 'center' }}>SYSTEM SUPPORT NODE</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                    <button className="reset-btn" style={{ fontSize: '0.95rem', padding: '12px 5px', display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => setShowSupportModal(true)}>OPEN_TICKET</button>
                    <button className="reset-btn" style={{ fontSize: '0.95rem', padding: '12px 5px', display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => setShowFaqModal(true)}>ACCESS FAQ</button>
                  </div>
                  <div style={{ marginTop: '20px', fontSize: '0.9rem', color: '#cbd5e1', textAlign: 'center' }}>
                    <p className="faq-link" onClick={() => setShowManualModal(true)} style={{cursor: 'pointer', textDecoration: 'underline'}}> Operation Manual </p>
                  </div>
                </div>

                {/* --- UPDATED: LIVE SECURITY AUDIT (HISTORY VIEW) --- */}
                <div className="masking-tool" style={{ width: '100%', maxWidth: '600px' }}>
                  <p className="tool-label" style={{ textAlign: 'center' }}>LIVE SECURITY AUDIT</p>
                  
                  {/* History Filter Toggles */}
                  <div className="billing-toggle" style={{ display: 'flex', gap: '5px', marginBottom: '15px' }}>
                    {[30, 60, 90].map(d => (
                      <button 
                        key={d}
                        className={historyDays === d ? 'mask-btn active-toggle' : 'mask-btn'} 
                        style={{ flex: 1, fontSize: '0.9rem' }} 
                        onClick={() => setHistoryDays(d)}
                      >
                        {d}_DAYS
                      </button>
                    ))}
                  </div>

                  <div className="audit-list" style={{ maxHeight: '200px', overflowY: 'auto', background: '#000', padding: '10px' }}>
                    {auditLog.length > 0 ? auditLog.map((log, i) => (
                      <div key={`audit-${log.timestamp}-${i}`} className="audit-row" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #111', padding: '10px 0' }}>
                        <span className="audit-broker tiger-text">[{new Date(log.timestamp).toLocaleDateString()}]</span>
                        <span className="audit-action" style={{fontSize: '0.9rem'}}>{log.action}</span>
                        <span style={{fontSize: '0.85rem', color: '#94A3B8'}}>{log.node?.slice(-6)}</span>
                      </div>
                    )) : (
                      <div className="terminal-line" style={{textAlign: 'center', opacity: 0.5}}>NO_RECORDS_IN_WINDOW</div>
                    )}
                  </div>
                  
                  {/* Backup: PDF logic still exists for vaulting but UI encourages live view */}
                  <div style={{ display: 'flex', gap: '10px', marginTop: '15px', width: '100%' }}>
                    <button className="pdf-btn" style={{ flex: 1, opacity: 0.8, fontSize: '0.85rem', padding: '12px 5px', display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => handleDownloadPDF(false)} disabled={isGenerating}>EXPORT_AUDIT_PDF</button>
                    <button className="reset-btn" style={{ flex: 1, opacity: 0.8, fontSize: '0.85rem', padding: '12px 5px', display: 'flex', justifyContent: 'center', alignItems: 'center', borderColor: 'var(--tiger-blue)', color: 'var(--tiger-blue)' }} onClick={handleExportJSON}>EXPORT_SECURE_BACKUP</button>
                  </div>
                </div>

                <div style={{display: 'flex', flexDirection: 'column', gap: '15px', width: '100%', maxWidth: '400px', marginTop: '40px'}}>
                  <button className="reset-btn" style={{ fontSize: '1rem', padding: '12px 10px', display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => {localStorage.clear(); window.location.reload();}}>LOGOUT SECURELY</button>
                  <button className="burn-all-btn" style={{ fontSize: '1rem', padding: '12px 10px', display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={handleEmergencyBurn}>INITIATE EMERGENCY BURN</button>
                </div>
              </div>
            ) : (
              /* 4. ONBOARDING & LOGIN FLOW (MOBILE OPTIMIZED) */
              <div className="onboarding-flow">
                {show2FA && (
                  <div className="pricing-card fade-in">
                    <div className="price-box">
                      <h3 className="tiger-text">AGENT AUTHENTICATION</h3>
                      <p className="field-label">REGISTERED EMAIL</p>
                      <input className="mask-btn" style={{width: '100%', textAlign: 'center', marginBottom: '10px', color: 'white'}} placeholder="agent@email.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
                      <p className="field-label">MFA CODE (OPTIONAL)</p>
                      <input className="mask-btn" style={{width: '100%', textAlign: 'center', color: 'white'}} placeholder="******" />
                      <button className="main-button" style={{width: '100%', marginTop: '20px'}} onClick={verify2FA}>VERIFY IDENTITY</button>
                      <button className="reset-btn" style={{width: '100%', marginTop: '10px'}} onClick={() => window.location.hash = ""}>CANCEL</button>
                    </div>
                  </div>
                )}

                {showPricing && !showCheckout && !isScanning && (
                  <div className="pricing-card fade-in">
                    <div className="price-box">
                      <div className="billing-toggle" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', width: '100%', marginBottom: '15px' }}>
                        <button className={billingCycle === 'monthly' ? 'mask-btn active-toggle' : 'mask-btn'} onClick={() => setBillingCycle('monthly')}>Monthly</button>
                        <button className={billingCycle === 'annual' ? 'mask-btn active-toggle' : 'mask-btn'} onClick={() => setBillingCycle('annual')}>Annual</button>
                      </div>
                      <h3 className="tiger-text">ELITE PRIVACY P-A-A-S</h3>
                      <div className="price-amount">${billingCycle === 'monthly' ? '19.99' : '15.99'}</div>
                      <p style={{fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '20px'}}>Includes 6 Global Slots + Hybrid Automated & Real Analyst Removal + Total Purge Access</p>
                      <button className="main-button" style={{width: '100%'}} onClick={() => setShowCheckout(true)}>PROCEED</button>
                      <button className="reset-btn" style={{width: '100%', marginTop: '10px'}} onClick={() => window.location.hash = ""}>CANCEL</button>
                    </div>
                  </div>
                )}

                {showCheckout && !isScanning && (
                  <div className="pricing-card fade-in">
                    <div className="price-box" style={{maxWidth: '450px', width: '100%', margin: '0 auto'}}>
                      <h3 className="tiger-text">TARGET PROFILE DATA</h3>
                      <div className="checkout-grid">
                          <input className="mask-btn" placeholder="First Name" value={targetProfile.firstName} onChange={(e) => setTargetProfile({...targetProfile, firstName: e.target.value})} />
                          <input className="mask-btn" placeholder="Middle Name" value={targetProfile.middleName} onChange={(e) => setTargetProfile({...targetProfile, middleName: e.target.value})} />
                          <input className="mask-btn full-row" placeholder="Last Name" value={targetProfile.lastName} onChange={(e) => setTargetProfile({...targetProfile, lastName: e.target.value})} />
                          <input className="mask-btn full-row" placeholder="Email Address" value={targetProfile.email} onChange={(e) => setTargetProfile({...targetProfile, email: e.target.value})} />
                          <input className="mask-btn full-row" placeholder="Real Phone Number (For SMS Forwarding)" value={targetProfile.phone} onChange={(e) => setTargetProfile({...targetProfile, phone: e.target.value})} />
                          <input ref={addressRef} className="mask-btn full-row" placeholder="Street Address" value={targetProfile.address} onChange={(e) => setTargetProfile({...targetProfile, address: e.target.value})} />
                          <input className="mask-btn" placeholder="City" value={targetProfile.city} onChange={(e) => setTargetProfile({...targetProfile, city: e.target.value})} />
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <input className="mask-btn" placeholder="State" value={targetProfile.state} onChange={(e) => setTargetProfile({...targetProfile, state: e.target.value})} />
                            <input className="mask-btn" placeholder="ZIP" value={targetProfile.zip} onChange={(e) => setTargetProfile({...targetProfile, zip: e.target.value})} />
                          </div>
                          <input className="mask-btn full-row" type="text" inputMode="numeric" placeholder="DATE OF BIRTH (MM/DD/YYYY)" value={targetProfile.dob} onChange={handleNumericDateInput} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', alignItems: 'flex-start', gap: '10px', marginTop: '15px' }}>
                        <input type="checkbox" checked={targetProfile.termsAccepted} onChange={(e) => setTargetProfile({...targetProfile, termsAccepted: e.target.checked})} />
                        <label style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>Authorize Full PII Scrub and Burn</label>
                      </div>
                      <button className="main-button" style={{ width: '100%', marginTop: '25px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }} onClick={handleFinalPurchase} disabled={!targetProfile.termsAccepted || isMinting}>
                        {isMinting ? <><span className="cyberpunk-spinner"></span> INITIATING...</> : 'CONFIRM & INITIATE'}
                      </button>
                      <button className="reset-btn" style={{width: '100%', marginTop: '10px'}} onClick={() => window.location.hash = "pricing"}>BACK</button>
                    </div>
                  </div>
                )}

                {isScanning && (
                  <div className="shield-container">
                    <div className="recon-terminal" style={{maxWidth: '500px', margin: '0 auto'}}>
                      <div className="terminal-line">{'>> INITIATING HANDSHAKE...'}</div>
                      <div className="terminal-line">{'>> BYPASSING DATA BROKER FIREWALLS...'}</div>
                      <div className="terminal-line">{'>> UPLOADING PURGE REQUESTS...'}</div>
                      <div className="terminal-line">{'>> ESTABLISHING SECURE ALIAS TUNNEL...'}</div>
                      <div className="terminal-line">{'>> ENCRYPTING VAULT ASSETS...'}</div>
                    </div>
                    <h2 className="shield-text" style={{marginTop: '20px'}}>SCRUBBING NODES...</h2>
                  </div>
                )}
              </div>
            )}
          </main>
        </>
      )}

      {/* --- LEGAL & ADMIN MODALS --- */}
      {showLegal && (
        <div className="modal-overlay" onClick={() => window.location.hash = ""}>
          <div className="info-modal-content" onClick={e => e.stopPropagation()}>
            {showLegal === 'manifesto' && <Manifesto />}
            {showLegal === 'privacy' && <Privacy />}
            {showLegal === 'terms' && <Terms />}
            {showLegal === 'aml' && <AmlFraudPolicy />}
            <button className="reset-btn" style={{marginTop: '20px', width: '100%'}} onClick={() => window.location.hash = ""}>CLOSE</button>
          </div>
        </div>
      )}

      {showAdmin && (
        <div className="modal-overlay" onClick={() => window.location.hash = ""}>
          <div onClick={e => e.stopPropagation()}>
            <AdminDashboard API_BASE_URL={API_BASE_URL} />
            <button className="reset-btn" style={{width: '100%', marginTop: '10px'}} onClick={() => window.location.hash = ""}>EXIT COMMAND</button>
          </div>
        </div>
      )}

      {/* --- KYC COMPLIANCE MODAL --- */}
      {showKycModal && (
        <div className="modal-overlay" style={{zIndex: 60000}} onClick={() => setShowKycModal(false)}>
          <div className="price-box" style={{border: '1px solid var(--tiger-blue)'}} onClick={e => e.stopPropagation()}>
            <h3 className="tiger-text" style={{color: '#ff4444'}}>COMPLIANCE REVIEW</h3>
            <p style={{marginTop: '15px', color: '#cbd5e1', fontSize: '0.9rem', lineHeight: '1.4rem'}}>
              {kycModalReason.includes("flagged") 
                ? "Your profile has been flagged under the AML & Fraud Prevention Policy. Asset creation is temporarily suspended. Please contact support to resolve this issue." 
                : "Your identity verification is currently pending or has been rejected. Under our AML guidelines, VCC minting requires active KYC clearance. Please upload verification details or contact support."}
            </p>
            <div style={{marginTop: '25px', display: 'flex', flexDirection: 'column', gap: '10px'}}>
              <button className="main-button" style={{width: '100%'}} onClick={() => { setShowKycModal(false); setShowSupportModal(true); }}>CONTACT SUPPORT</button>
              <button className="reset-btn" style={{width: '100%'}} onClick={() => setShowKycModal(false)}>CLOSE</button>
            </div>
          </div>
        </div>
      )}

      {/* --- GLOBAL SUPPORT MODAL --- */}
      {showSupportModal && (
        <div className="modal-overlay" style={{zIndex: 60000}} onClick={() => setShowSupportModal(false)}>
          <div className="price-box" onClick={e => e.stopPropagation()}>
            <h3 className="tiger-text">SUPPORT UPLINK</h3>
            <p className="field-label">ISSUE CATEGORY</p>
            <select className="mask-btn" style={{width: '100%', background: '#000', color: 'white', marginBottom: '15px'}} value={supportData.subject} onChange={(e) => setSupportData({...supportData, subject: e.target.value})}>
              <option value="PAYMENT_ERR">PAYMENT_ISSUE</option>
              <option value="NODE_ERR">NODE_FAILURE</option>
              <option value="PURGE_ERR">PURGE_TIMEOUT</option>
              <option value="OTHER">OTHER_INQUIRY</option>
            </select>
            <textarea className="mask-btn" style={{width: '100%', height: '100px', color: 'white', textAlign: 'left', paddingTop: '10px'}} placeholder="Describe the anomaly..." value={supportData.message} onChange={(e) => setSupportData({...supportData, message: e.target.value})} />
            <button className="main-button" style={{width: '100%', marginTop: '20px'}} onClick={handleSendTicket}>TRANSMIT_TICKET</button>
            <button className="reset-btn" style={{width: '100%'}} onClick={() => setShowSupportModal(false)}>ABORT</button>
          </div>
        </div>
      )}

      <footer className="home-footer" style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '15px',
          padding: '25px 15px',
          width: '100%',
          fontSize: '0.75rem',
          color: '#64748B',
          textAlign: 'center'
      }}>
          <span style={{ cursor: 'pointer', letterSpacing: '1px' }} onClick={() => window.location.hash = "manifesto"}>MANIFESTO</span>
          <span className="footer-divider" style={{ opacity: 0.4 }}>|</span>
          <span style={{ cursor: 'pointer', letterSpacing: '1px' }} onClick={() => window.location.hash = "privacy"}>PRIVACY</span>
          <span className="footer-divider" style={{ opacity: 0.4 }}>|</span>
          <span style={{ cursor: 'pointer', letterSpacing: '1px' }} onClick={() => window.location.hash = "terms"}>TERMS</span>
          <span className="footer-divider" style={{ opacity: 0.4 }}>|</span>
          <span style={{ cursor: 'pointer', letterSpacing: '1px' }} onClick={() => window.location.hash = "aml-policy"}>AML & FRAUD</span>
          <span className="footer-divider" style={{ opacity: 0.4 }}>|</span>
          <span style={{ cursor: 'pointer', letterSpacing: '1px' }} onClick={() => setShowSupportModal(true)}>SUPPORT</span>
          <span className="admin-trigger" style={{ cursor: 'pointer', opacity: 0 }} onClick={() => window.location.hash = "admin"}>.</span>
      </footer>

      {/* --- GLOBAL ENCRYPTION & PURGE OVERLAY --- */}
      {isEncrypting && (
        <div className="modal-overlay" style={{ zIndex: 99999, background: 'rgba(0, 0, 0, 0.9)' }}>
          <div className="price-box fade-in" style={{ textAlign: 'center', border: '1px solid var(--tiger-blue)' }}>
            <h3 className="tiger-text" style={{ marginBottom: '20px' }}>ENCRYPTING_NODE</h3>
            <div className="cyberpunk-spinner-large"></div>
            <p style={{ color: '#cbd5e1', fontSize: '0.9rem' }}>{purgeStatus || "SCRUBBING PII..."}</p>
            <p style={{ color: '#64748B', fontSize: '0.7rem', margin: '10px 0 0 0' }}>SECURE LINK ESTABLISHED</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;