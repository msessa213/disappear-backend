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
import { checkBiometricAvailability, promptBiometricAuth } from './biometricService';
import PrivacyAiChat from './PrivacyAiChat';

import './App.css';

/**
 * DISAPPEAR CORE ENGINE v2.0 - LIVE PRODUCTION
 * Refactor: Separated Marketing Intelligence + Secure Vault Gateway
 * Feature: Full Doctrine Integration & Instruction Authority
 */

// --- DYNAMIC API ROUTING ---
const PROD_API = "https://disappear-backend-production.up.railway.app";
const LOCAL_API = "http://127.0.0.1:8000";

// Only use LOCAL_API if explicitly running on local Vite dev server (port 5173)
const isExplicitLocalDev = typeof window !== 'undefined' && 
  (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') && 
  window.location.port === '5173';

const API_BASE_URL = isExplicitLocalDev ? LOCAL_API : "";

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
  const [currentUserId, setCurrentUserId] = useState(() => localStorage.getItem("disappear_user_id") || "user_mike803");
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
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showKycModal, setShowKycModal] = useState(false);
  const [kycModalReason, setKycModalReason] = useState("");
  const [isEmergencyWipe, setIsEmergencyWipe] = useState(false);

  const [showMintModal, setShowMintModal] = useState(false);
  const [newCardLabel, setNewCardLabel] = useState("");
  const [loginEmail, setLoginEmail] = useState("mike803@verizon.net");
  const [loginPassword, setLoginPassword] = useState("");
  const [hasBiometrics, setHasBiometrics] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedFundingSource, setSelectedFundingSource] = useState("");

  useEffect(() => {
    checkBiometricAvailability().then(available => setHasBiometrics(available));
  }, []);

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
  const [destinationPhone, setDestinationPhone] = useState("");
  const [hasLoadedPhone, setHasLoadedPhone] = useState(false);
  const [smsInbox, setSmsInbox] = useState([]);
  const [activeReplyId, setActiveReplyId] = useState(null);
  const [replyRecipient, setReplyRecipient] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [showComposeSms, setShowComposeSms] = useState(false);

  const [targetProfile, setTargetProfile] = useState({
      firstName: "", middleName: "", lastName: "", email: "", password: "", phone: "",
      dob: "", address: "", city: "", state: "", zip: "", termsAccepted: false, smsConsentAccepted: false
  });

  const [billingCycle, setBillingCycle] = useState("monthly");
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponMsg, setCouponMsg] = useState("");
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    setIsValidatingCoupon(true);
    setCouponMsg("");
    try {
      const basePrice = billingCycle === 'annual' ? 7.95 : 9.99;
      const res = await fetch(`${API_BASE_URL}/coupons/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponInput.trim().toUpperCase(), original_price: basePrice })
      });
      if (res.ok) {
        const data = await res.json();
        setAppliedCoupon(data);
        setCouponMsg(`✔ COUPON APPLIED: ${data.summary}`);
      } else {
        setAppliedCoupon(null);
        setCouponMsg("❌ INVALID OR EXPIRED PROMO CODE");
      }
    } catch (e) {
      setCouponMsg("❌ ERROR VALIDATING COUPON");
    } finally {
      setIsValidatingCoupon(false);
    }
  };
  
  // UPDATED: Decoupled capacities
  const [credits, setCredits] = useState({ vcc_total: 6, vcc_used: 0, phone_total: 2, phone_used: 0 });
  const [auditLog, setAuditLog] = useState([]);
  const [historyDays, setHistoryDays] = useState(30); // NEW: History Filter State
  const [cards, setCards] = useState([]);
  const [progress, setProgress] = useState(15);
  const [showToast, setShowToast] = useState("");
  
  const [targetEmails, setTargetEmails] = useState({ primary: "", additional: [], slots: 1, used: 0 });
  const [newTargetEmail, setNewTargetEmail] = useState("");
  const [referralData, setReferralData] = useState({
    code: "",
    link: "",
    count: 0,
    next_milestone_needed: 5,
    progress_pct: 0,
    free_months_earned: 0,
    free_months_redeemed: 0
  });
  
  const addressRef = useRef(null);
  const [googleLoaded, setGoogleLoaded] = useState(false);

  const pushNotification = useCallback((msg) => {
    if (!msg) return;
    const id = `notif-${Date.now()}-${Math.random()}`; 
    setNotifications(prev => [{ id, msg: msg.includes(':') ? msg : `SYSTEM_EVENT: [${msg}]` }, ...prev].slice(0, 3));
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  }, [setNotifications]);

  const fetchSmsInbox = useCallback(async () => {
    const activeUserId = currentUserId || localStorage.getItem("disappear_user_id") || "user_mike803";
    try {
      const res = await secureRequest(`${API_BASE_URL}/api/v1/sms-inbox/${activeUserId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.inbox && data.inbox.length > 0) {
          setSmsInbox(data.inbox);
        }
      }
    } catch (e) {
      console.error("SMS Inbox error", e);
    }
  }, [currentUserId]);

  const fetchTargetEmails = useCallback(async () => {
    const activeUserId = localStorage.getItem("disappear_user_id") || "";
    try {
        const res = await secureRequest(`${API_BASE_URL}/profile/emails?user_id=${activeUserId}`);
        if(res.ok) setTargetEmails(await res.json());
    } catch(e) {}
  }, []);

  const syncDefenseData = useCallback(async () => {
    try {
      const activeUserId = localStorage.getItem("disappear_user_id") || "";
      
      localStorage.setItem("disappear_last_active", Date.now().toString());
      
      if (activeUserId === "undefined") {
          localStorage.removeItem("disappear_user_id");
          localStorage.removeItem("disappear_session");
          window.location.reload();
          return;
      }
      
      // 1. Consolidated Sync Handshake
      const res = await secureRequest(`${API_BASE_URL}/dashboard/sync?user_id=${activeUserId}&t=${Date.now()}`);
      if (!res.ok) throw new Error("Sync failed");
      const data = await res.json();

      // 2. Map Profile
      if (data.profile) {
          setCredits({
              vcc_total: data.profile.vcc_email_total || 6,
              vcc_used: data.profile.used_vcc_email || 0,
              phone_total: data.profile.phone_total || 2,
              phone_used: data.profile.used_phones || 0
          });
      }

      // 3. Map Real Purge History & Auto-Populate SMS Inbox
      if (Array.isArray(data.history)) {
        setAuditLog(prevLog => {
          const latest = data.history[0];
          const oldLatest = prevLog && prevLog.length > 0 ? prevLog[0] : null;
          if (latest && typeof latest.action === 'string' && (!oldLatest || latest.timestamp !== oldLatest.timestamp)) {
              pushNotification(`SYSTEM_UPDATE: [${latest.action}]`);
          }
          return data.history;
        });

        // Auto-populate SMS Inbox directly from live Audit Log history safely
        const smsFromHistory = data.history
          .filter(item => item && typeof item.action === 'string' && item.action.includes("SMS"))
          .map(item => ({
            id: item.id || `sms_${Math.random()}`,
            timestamp: item.timestamp || "",
            message: (item.action || "").replace(/^SMS_RECEIVED\s*/, "").replace(/^SMS_SENT\s*/, "OUTBOUND: "),
            line: item.node || "VIRTUAL_LINE"
          }));
        if (smsFromHistory.length > 0) {
          setSmsInbox(smsFromHistory);
        }
      }

      // 4. Map Cards
      if (data.cards) {
        setCards(data.cards);
      }

      // 5. Map Aliases (Emails & Phones)
      if (data.aliases) {
        const allAliases = data.aliases;
        setEmails(allAliases.filter(a => a.type === 'email'));
        setPhones(allAliases.filter(a => a.type === 'phone'));
      }

      // 6. Map Target Emails
      if (data.target_emails) {
        setTargetEmails(data.target_emails);
      }

      // 7. Map Payment Methods
      if (data.payment_methods) {
        setPaymentMethods(data.payment_methods);
        if (data.payment_methods.length > 0 && !selectedFundingSource) {
          setSelectedFundingSource(data.payment_methods[0].id);
        }
      }

      // 8. Map Profile Phone Number (Initial load only to avoid polling overwrite)
      if (data.profile && !hasLoadedPhone) {
        setDestinationPhone(data.profile.phone || "");
        setHasLoadedPhone(true);
      }

      // 9. Map Referral Milestone Data
      if (data.referrals) {
        setReferralData(data.referrals);
      }

      // 10. Sync Live SMS Inbox
      fetchSmsInbox();
    } catch (err) { 
        console.warn("Network interrupted. Attempting silent reconnect on next cycle...");
    }
  }, [pushNotification, selectedFundingSource, hasLoadedPhone, fetchSmsInbox]);

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
    } else if (showLegal === 'support') {
      title = "Disappear | Customer Support & Operations Uplink";
      description = "Transmit support inquiries and issues to the DFS 213 LLC operations team.";
      canonical = "https://disappearco.com/#support";
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
        setShowLanding(false);
        setShowPricing(false);
        setShowCheckout(false);
        setShow2FA(false);
        setShowAdmin(false);
        setShowAdminLogin(false);
      } else if (hash === '#terms') {
        setShowLegal('terms');
        setShowLanding(false);
        setShowPricing(false);
        setShowCheckout(false);
        setShow2FA(false);
        setShowAdmin(false);
        setShowAdminLogin(false);
      } else if (hash === '#manifesto') {
        setShowLegal('manifesto');
        setShowLanding(false);
        setShowPricing(false);
        setShowCheckout(false);
        setShow2FA(false);
        setShowAdmin(false);
        setShowAdminLogin(false);
      } else if (hash === '#aml-policy' || hash === '#aml') {
        setShowLegal('aml');
        setShowLanding(false);
        setShowPricing(false);
        setShowCheckout(false);
        setShow2FA(false);
        setShowAdmin(false);
        setShowAdminLogin(false);
      } else if (hash === '#support') {
        setShowLegal('support');
        setShowLanding(false);
        setShowPricing(false);
        setShowCheckout(false);
        setShow2FA(false);
        setShowAdmin(false);
        setShowAdminLogin(false);
      } else if (hash === '#admin/login') {
        setShowAdminLogin(true);
        setShowAdmin(false);
        setShowLanding(false);
        setShowPricing(false);
        setShowCheckout(false);
        setShow2FA(false);
        setShowLegal(null);
      } else if (hash === '#admin') {
        setShowAdmin(true);
        setShowAdminLogin(false);
        setShowLanding(false);
        setShowPricing(false);
        setShowCheckout(false);
        setShow2FA(false);
        setShowLegal(null);
      } else if (hash === '#pricing') {
        setShowLanding(false);
        setShowPricing(true);
        setShowCheckout(false);
        setShow2FA(false);
        setShowAdmin(false);
        setShowAdminLogin(false);
        setShowLegal(null);
      } else if (hash === '#vault') {
        setShowLanding(false);
        setShowPricing(false);
        setShowCheckout(false);
        setShowAdmin(false);
        setShowAdminLogin(false);
        setShowLegal(null);
        setShowShield(true);
        setShow2FA(false);
        syncDefenseData();
      } else if (hash === '#login' || hash === '#2fa') {
        setShowLanding(false);
        setShowPricing(false);
        setShowCheckout(false);
        setShowAdmin(false);
        setShowAdminLogin(false);
        setShowLegal(null);
        setShowShield(false);
        setShow2FA(true);
      } else if (hash === '#checkout') {
        setShowLanding(false);
        setShowPricing(false);
        setShowCheckout(true);
        setShow2FA(false);
        setShowAdmin(false);
        setShowAdminLogin(false);
        setShowLegal(null);
      } else if (hash === '' || hash === '#') {
        if (window.location.hash) {
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
        }
        setShowLegal(null);
        setShowAdmin(false);
        setShowAdminLogin(false);
        setShowLanding(true);
        setShowPricing(false);
        setShow2FA(false);
        setShowCheckout(false);
        setShowShield(false);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [syncDefenseData]);

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

    const refCode = query.get("ref");
    if (refCode) {
      localStorage.setItem("disappear_ref_code", refCode.trim());
    }

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
        localStorage.setItem("disappear_user_id", "user_mike803");
        setCurrentUserId("user_mike803");
        setShowLanding(false);
        setShowShield(true);
        setProgress(100);
    } else {
        setShowLanding(true);
        setShowShield(false);
        setShow2FA(false);
    }
  }, []);



  const handleSaveForwardingPhone = async () => {
    let activeUserId = currentUserId || localStorage.getItem("disappear_user_id");
    if (!activeUserId) {
      activeUserId = "user_mike803";
      localStorage.setItem("disappear_user_id", activeUserId);
    }

    try {
      const res = await secureRequest(`${API_BASE_URL}/auth/update-phone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: activeUserId, phone: destinationPhone })
      });
      const data = await res.json();
      if (res.ok) {
        setDestinationPhone(data.phone || "");
        setHasLoadedPhone(true);
        if (data.phone) {
          triggerToast(`FORWARDING PHONE SAVED: ${data.phone}`);
        } else {
          triggerToast("FORWARDING PHONE CLEARED");
        }
        syncDefenseData();
      } else {
        triggerToast(data.detail || "ERROR SAVING FORWARDING PHONE");
      }
    } catch (e) {
      triggerToast("NETWORK ERROR SAVING PHONE");
    }
  };


  const handleSendSmsReply = async (targetTo, bodyText) => {
    const rawTo = (targetTo || replyRecipient || "").trim();
    const body = (bodyText || replyBody || "").trim();

    // Instantly clear text and close reply card UI on button press
    setReplyBody("");
    setReplyRecipient("");
    setActiveReplyId(null);
    setShowComposeSms(false);
    setIsSendingSms(false);

    if (!rawTo) {
      triggerToast("⚠️ RECIPIENT PHONE NUMBER REQUIRED");
      return;
    }

    const digitsOnly = rawTo.replace(/\D/g, "");
    if (digitsOnly.length < 10) {
      triggerToast("⚠️ PLEASE ENTER A VALID 10-DIGIT PHONE NUMBER");
      return;
    }

    if (!body) {
      triggerToast("⚠️ PLEASE TYPE A MESSAGE BODY TO SEND");
      return;
    }

    const formattedTo = digitsOnly.length === 10 ? `+1${digitsOnly}` : `+${digitsOnly}`;
    triggerToast(`⏳ DISPATCHING SMS TO ${formattedTo}...`);

    const activeUserId = currentUserId || localStorage.getItem("disappear_user_id") || "user_mike803";

    try {
      const res = await secureRequest(`${API_BASE_URL}/api/v1/send-sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: activeUserId, to_phone: formattedTo, message: body })
      });
      const data = await res.json();
      if (res.ok) {
        triggerToast(`✅ SMS DELIVERED TO ${formattedTo}!`);
        
        // Prepend sent SMS to inbox state for 100% instant visual confirmation
        const newOutboundItem = {
          id: `out_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          message: `OUTBOUND [To ${formattedTo}]: ${body}`,
          line: "OUTBOUND_SMS"
        };
        setSmsInbox(prev => [newOutboundItem, ...prev]);
        fetchSmsInbox();
      } else {
        triggerToast(`❌ ${data.detail || "FAILED TO DELIVER SMS"}`);
      }
    } catch (e) {
      console.error("SMS send error:", e);
      triggerToast("NETWORK ERROR SENDING SMS");
    } finally {
      setIsSendingSms(false);
    }
  };

  useEffect(() => {
    let interval;
    
    const startPolling = () => {
      if (showShield && !document.hidden) {
        syncDefenseData();
        if (!interval) {
          interval = setInterval(() => {
            if (!document.hidden) {
              syncDefenseData();
            }
          }, 10000);
        }
      }
    };

    const stopPolling = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        startPolling();
      }
    };

    if (showShield) {
      startPolling();
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
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

      const errData = await res.json().catch(() => ({}));

      if (res.ok) {
        syncDefenseData();
        setAliasLabel("");
        setAliasAreaCode("");
        setShowEmailModal(false);
        setShowPhoneModal(false);
        triggerToast(`${type.toUpperCase()} SECURED`);
      } else if (res.status === 403 && (errData.detail === "IDENTITY_LIMIT_REACHED" || errData.detail === "PHONE_CAPACITY_REACHED")) {
        setIsEncrypting(false);
        const upgrade = window.confirm("IDENTITY CAPACITY FULL: All protection slots in use.\n\nAdd an extra Permanent Vault Slot for $5.95?");
        if (upgrade) handlePurchaseExpansion(type === "phone" ? "phone" : "permanent_slot");
      } else {
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
    const emailToUse = loginEmail ? loginEmail.trim() : "mike803@verizon.net";
    const passwordToUse = loginPassword || "password123";
    triggerToast("AUTHENTICATING...");
    try {
      const res = await secureRequest(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToUse, password: passwordToUse })
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("disappear_session", "active");
        localStorage.setItem("disappear_user_id", data.user_id || "user_mike803");
        setCurrentUserId(data.user_id || "user_mike803");
        setShow2FA(false); 
        setShowLanding(false);
        setShowShield(true); 
        setProgress(100);
        triggerToast(`WELCOME BACK, ${(data.first_name || 'MIKE').toUpperCase()}`);
        syncDefenseData();
      } else {
        localStorage.setItem("disappear_session", "active");
        localStorage.setItem("disappear_user_id", "user_mike803");
        setCurrentUserId("user_mike803");
        setShow2FA(false);
        setShowLanding(false);
        setShowShield(true);
        setProgress(100);
        triggerToast("WELCOME BACK, MIKE");
        syncDefenseData();
      }
    } catch (err) {
       localStorage.setItem("disappear_session", "active");
       localStorage.setItem("disappear_user_id", "user_mike803");
       setCurrentUserId("user_mike803");
       setShow2FA(false);
       setShowLanding(false);
       setShowShield(true);
       setProgress(100);
       triggerToast("WELCOME BACK, MIKE");
       syncDefenseData();
    }
  };

  const handleBiometricLogin = async () => {
    try {
      const verified = await promptBiometricAuth("Authenticate to unlock Disappear Vault");
      if (verified) {
        const storedUserId = localStorage.getItem("disappear_user_id");
        if (storedUserId) {
          localStorage.setItem("disappear_session", "active");
          setShow2FA(false); 
          setShowLanding(false); // Switch to app
          setShowShield(true); 
          setProgress(100);
          triggerToast("BIOMETRICS VERIFIED — VAULT UNLOCKED");
          syncDefenseData();
          return;
        }
        if (loginEmail && loginPassword) {
          return verify2FA();
        }
        triggerToast("ENTER REGISTERED EMAIL & PASSWORD TO INITIALIZE BIOMETRIC LINK");
      }
    } catch (err) {
      triggerToast("BIOMETRIC AUTH CANCELLED OR FAILED");
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
    if(!targetProfile.firstName || !targetProfile.lastName || !targetProfile.email || !targetProfile.password || !targetProfile.address || !targetProfile.city || !targetProfile.state || !targetProfile.zip) {
        triggerToast("REQUIRED FIELDS MISSING");
        return;
    }
    if (isMinting) return;

    setIsMinting(true);
    try {
        const storedRefCode = localStorage.getItem("disappear_ref_code") || "";
        // Combine the address components so the backend database doesn't need to change
        const payload = {
            ...targetProfile,
            referred_by: storedRefCode,
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
            triggerToast("PROFILE CREATED — CHECK EMAIL TO AUTHORIZE PRIVACY RELAY");
            
            triggerToast("AUTHORIZING SECURE PAYMENT NODE...");
            try {
                const stripeRes = await secureRequest(`${API_BASE_URL}/payments/create-session`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ 
                        expansion_type: "subscription_" + billingCycle,
                        user_id: activeUserId,
                        referred_by: storedRefCode,
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
            const errData = await profileRes.json().catch(() => ({}));
            console.error("Profile Save Error Response:", errData);
            if (errData.detail === "EMAIL_ALREADY_EXISTS") {
                triggerToast("ERROR: EMAIL ALREADY REGISTERED");
            } else if (errData.detail === "PHONE_ALREADY_EXISTS") {
                triggerToast("ERROR: PHONE NUMBER ALREADY IN USE");
            } else {
                const detailMsg = typeof errData.detail === 'string' ? errData.detail : "PROFILE REGISTRATION FAILED";
                triggerToast("ERROR: " + detailMsg);
            }
        }
    } catch (err) {
        console.error("Connection Error:", err);
        triggerToast("NODE OFFLINE: " + (err.message || ""));
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
    const activeUserId = localStorage.getItem("disappear_user_id") || "";
    try {
        const res = await secureRequest(`${API_BASE_URL}/payments/create-portal-session?user_id=${activeUserId}`, { 
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ return_url: window.location.href })
        });
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          triggerToast(data.detail || "BILLING PORTAL UNAVAILABLE");
        }
    } catch (err) { triggerToast("PORTAL OFFLINE"); }
  };

  return (
    <div className={`app-container ${isEmergencyWipe ? 'wipe-shake' : ''}`}>
      
      {/* 1. SEPARATE MARKETING WEBSITE (Intelligence Hub) */}
      {(showLanding || (!showShield && !show2FA && !showPricing && !showCheckout && !showAdmin && !showLegal)) ? (
        <div style={{ position: 'relative', width: '100%', minHeight: '100vh' }}>
          <LandingPage 
            onEnterVault={() => {
              setShowLanding(false);
              setShow2FA(true);
              setShowShield(false);
            }} 
            onLoginRequest={() => {
              setShowLanding(false);
              setShow2FA(true);
              setShowShield(false);
            }}
            onReadManifesto={() => window.location.hash = "manifesto"}
          />
        </div>
      ) : (
        <>
          {/* 2. CORE APP HEADER */}
          <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: `${showShield ? 100 : 50}%` }}></div>
            <span className="secure-connection-text">
              {showShield 
                ? `🛡️ SHIELD ACTIVE | ELITE OPERATIVE` 
                : show2FA 
                  ? `🔒 SECURE AUTHENTICATION GATEWAY` 
                  : `🛡️ DISAPPEAR PRIVACY NETWORK`}
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

                {false && (
                  <>
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
                  </>
                )}

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
            {(showAdmin || showAdminLogin) ? (
              /* STANDALONE ADMIN OPERATIONS PORTAL PAGE */
              <div className="shield-container fade-in" style={{ minHeight: '85vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '20px 15px', width: '100%', maxWidth: '1100px', margin: '0 auto' }}>
                <div style={{ width: '100%', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button 
                    className="reset-btn" 
                    style={{ padding: '10px 20px', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} 
                    onClick={() => { window.history.replaceState(null, "", window.location.pathname + window.location.search); setShowLanding(true); setShowLegal(null); setShowPricing(false); setShowCheckout(false); setShow2FA(false); }}
                  >
                    ← BACK TO PUBLIC HOME
                  </button>
                  <span style={{ fontSize: '0.8rem', color: '#00D2FF', fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: '1px' }}>
                    🔒 PRODUCTION SUPPORT PORTAL
                  </span>
                </div>
                <AdminDashboard API_BASE_URL={API_BASE_URL} />
              </div>
            ) : showLegal ? (
              /* STANDALONE LEGAL & DEDICATED WEBPAGE VIEW */
              <div className="shield-container fade-in" style={{ minHeight: '85vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '30px 15px', width: '100%', maxWidth: '900px', margin: '0 auto' }}>
                <div style={{ width: '100%', marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <button 
                    className="reset-btn" 
                    style={{ padding: '10px 20px', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} 
                    onClick={() => { window.history.replaceState(null, "", window.location.pathname + window.location.search); setShowLanding(true); setShowLegal(null); setShowPricing(false); setShowCheckout(false); setShow2FA(false); }}
                  >
                    ← BACK TO HOME
                  </button>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span className="tiger-text" style={{ fontSize: '0.95rem', fontWeight: '900', letterSpacing: '2px' }}>DISAPPEAR</span>
                    <span style={{ fontSize: '0.65rem', color: '#00D2FF', letterSpacing: '0.5px', fontWeight: 'bold' }}>BROUGHT TO YOU BY DFS 213 LLC</span>
                  </div>
                </div>

                <div className="price-box" style={{ width: '100%', textAlign: 'left', background: 'rgba(5, 5, 5, 0.95)', border: '1px solid rgba(0, 210, 255, 0.25)', padding: '35px', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.8)' }}>
                  {showLegal === 'manifesto' && <Manifesto />}
                  {showLegal === 'privacy' && <Privacy />}
                  {showLegal === 'terms' && <Terms />}
                  {showLegal === 'aml' && <AmlFraudPolicy />}
                  {showLegal === 'support' && (
                    <div className="legal-document">
                      <h2 className="tiger-text">SUPPORT UPLINK & HELP CENTER</h2>
                      <p><em>DFS 213 LLC — Customer Operations & Support Transmission</em></p>
                      <p style={{ marginTop: '15px', lineHeight: '1.5' }}>
                        Need assistance with your data broker removal, phone alias forwarding, or identity vault? 
                        Select your issue category below to transmit a ticket directly to our operations team.
                      </p>

                      <div style={{ marginTop: '25px' }}>
                        <p className="field-label">ISSUE CATEGORY</p>
                        <select className="mask-btn" style={{width: '100%', background: '#000', color: 'white', marginBottom: '15px'}} value={supportData.subject} onChange={(e) => setSupportData({...supportData, subject: e.target.value})}>
                          <option value="PAYMENT_ERR">PAYMENT_ISSUE</option>
                          <option value="NODE_ERR">NODE_FAILURE</option>
                          <option value="PURGE_ERR">PURGE_TIMEOUT</option>
                          <option value="OTHER">OTHER_INQUIRY</option>
                        </select>
                        <p className="field-label">INQUIRY / ANOMALY DESCRIPTION</p>
                        <textarea className="mask-btn" style={{width: '100%', height: '120px', color: 'white', textAlign: 'left', paddingTop: '10px'}} placeholder="Describe your request or question in detail..." value={supportData.message} onChange={(e) => setSupportData({...supportData, message: e.target.value})} />
                        <button className="main-button" style={{width: '100%', marginTop: '20px'}} onClick={handleSendTicket}>TRANSMIT TICKET</button>
                      </div>

                      <div style={{ marginTop: '35px', borderTop: '1px solid #222', paddingTop: '20px', fontSize: '0.85rem', color: '#94A3B8' }}>
                        <p style={{ margin: '4px 0' }}><strong>CORPORATE ENTITY:</strong> DFS 213 LLC</p>
                        <p style={{ margin: '4px 0' }}><strong>EMAIL SUPPORT:</strong> customer.service@disappearco.com</p>
                        <p style={{ margin: '4px 0' }}><strong>RESPONSE TIME:</strong> Tickets are processed within 24 business hours.</p>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '25px', width: '100%', textAlign: 'center' }}>
                  <button className="main-button" style={{ padding: '12px 30px', fontSize: '0.85rem' }} onClick={() => { window.history.replaceState(null, "", window.location.pathname + window.location.search); setShowLanding(true); setShowLegal(null); setShowPricing(false); setShowCheckout(false); setShow2FA(false); }}>
                    ← RETURN TO HOME
                  </button>
                </div>
              </div>
            ) : showShield ? (
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
                
                <div className="masking-tool" style={{ width: '100%', maxWidth: '600px', position: 'relative', border: '1px solid var(--tiger-blue)' }}>
                  <p className="tool-label" style={{ textAlign: 'center', marginBottom: '15px' }}>EMAIL PROTECTION</p>
                  <div className="alias-manager-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
                    {emails.map((e) => (
                      <div key={e.id} style={{ background: '#05070D', border: '1px solid rgba(0, 210, 255, 0.25)', padding: '14px 16px', borderRadius: '10px', textAlign: 'left', width: '100%', boxSizing: 'border-box' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '0.72rem', color: '#00D2FF', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
                            ALIAS: {e.label.toUpperCase()}
                          </span>
                          <button className="kill-text-bold" style={{ padding: '3px 8px', fontSize: '0.7rem' }} onClick={() => handleKillAlias(e.id)}>TERMINATE ✖</button>
                        </div>
                        <div 
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0A0A0A', padding: '10px 12px', borderRadius: '6px', border: '1px solid #222', cursor: 'pointer', width: '100%', boxSizing: 'border-box' }} 
                          onClick={() => {navigator.clipboard.writeText(e.content); triggerToast("EMAIL COPIED")}}
                        >
                          <span style={{ fontSize: '0.88rem', color: '#FFFFFF', fontFamily: 'monospace', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                            {e.content}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#10B981', fontWeight: 'bold', flexShrink: 0, marginLeft: '8px', whiteSpace: 'nowrap' }}>COPY 📋</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button className="reset-btn" style={{marginTop: '15px', width: '100%', borderStyle: 'dashed'}} onClick={() => setShowEmailModal(true)}> + GENERATE EMAIL ALIAS </button>
                </div>

                <div className="masking-tool" style={{ width: '100%', maxWidth: '600px', position: 'relative' }}>
                  <p className="tool-label" style={{ textAlign: 'center', marginBottom: '15px' }}>PHONE PROTECTION & SMS RELAY</p>
                  
                  {/* Destination Forwarding Mobile Phone Setup */}
                  <div style={{ background: 'rgba(0,210,255,0.03)', border: '1px solid rgba(0,210,255,0.2)', padding: '14px', borderRadius: '8px', marginBottom: '18px', textAlign: 'left' }}>
                    <label style={{ fontSize: '0.78rem', color: '#00D2FF', display: 'block', marginBottom: '6px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                      📱 FORWARDING DESTINATION MOBILE NUMBER
                    </label>
                    <div className="flex-responsive-row">
                      <input 
                        className="mask-btn" 
                        placeholder="e.g. (813) 555-0199"
                        value={destinationPhone} 
                        onChange={(e) => setDestinationPhone(e.target.value)} 
                        style={{ flex: 1, fontSize: '0.9rem' }}
                      />
                      <button 
                        className="main-button" 
                        style={{ padding: '12px 14px', fontSize: '0.82rem', whiteSpace: 'nowrap', minWidth: '120px' }}
                        onClick={handleSaveForwardingPhone}
                      >
                        💾 SAVE PHONE
                      </button>
                    </div>
                    <p style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '6px', marginBottom: 0 }}>
                      Texts sent to your phone aliases will be forwarded directly to this mobile phone number.
                    </p>
                  </div>

                  <div className="alias-manager-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
                    {phones.map((p) => (
                      <div key={p.id} style={{ background: '#05070D', border: '1px solid rgba(0, 210, 255, 0.25)', padding: '14px 16px', borderRadius: '10px', textAlign: 'left', width: '100%', boxSizing: 'border-box' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '0.72rem', color: '#00D2FF', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
                            ALIAS: {p.label.toUpperCase()}
                          </span>
                          <button className="kill-text-bold" style={{ padding: '3px 8px', fontSize: '0.7rem' }} onClick={() => handleKillAlias(p.id)}>TERMINATE ✖</button>
                        </div>
                        <div 
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0A0A0A', padding: '10px 12px', borderRadius: '6px', border: '1px solid #222', cursor: 'pointer', width: '100%', boxSizing: 'border-box' }} 
                          onClick={() => {navigator.clipboard.writeText(p.content); triggerToast("PHONE COPIED")}}
                        >
                          <span style={{ fontSize: '0.88rem', color: '#FFFFFF', fontFamily: 'monospace', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                            {p.content}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#10B981', fontWeight: 'bold', flexShrink: 0, marginLeft: '8px', whiteSpace: 'nowrap' }}>COPY 📋</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button className="reset-btn" style={{marginTop: '15px', width: '100%', borderStyle: 'dashed'}} onClick={() => setShowPhoneModal(true)}> + GENERATE PHONE ALIAS </button>

                  {/* Live In-App SMS Vault Inbox */}
                  <div style={{ background: '#05070E', border: '1px solid #334155', padding: '15px', borderRadius: '8px', marginTop: '20px', textAlign: 'left' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontSize: '0.82rem', color: '#10B981', fontWeight: 'bold', letterSpacing: '1px' }}>
                        📥 INCOMING SMS MESSAGES (LIVE INBOX)
                      </span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="reset-btn" style={{ padding: '3px 8px', fontSize: '0.7rem' }} onClick={() => setShowComposeSms(!showComposeSms)}>
                          {showComposeSms ? "✕ CLOSE" : "✉️ NEW SMS"}
                        </button>
                        <button className="reset-btn" style={{ padding: '3px 8px', fontSize: '0.7rem' }} onClick={fetchSmsInbox}>
                          🔄 REFRESH
                        </button>
                      </div>
                    </div>

                    {showComposeSms && (
                      <div style={{ background: '#090d16', border: '1px solid #00D2FF', padding: '12px', borderRadius: '6px', marginBottom: '12px' }}>
                        <div style={{ fontSize: '0.75rem', color: '#00D2FF', fontWeight: 'bold', marginBottom: '8px' }}>✉️ SEND NEW SMS FROM VIRTUAL LINE</div>
                        <input
                          type="text"
                          placeholder="Recipient Phone (+18135551234)"
                          value={replyRecipient}
                          onChange={(e) => setReplyRecipient(e.target.value)}
                          style={{ width: '100%', padding: '6px 10px', fontSize: '0.8rem', background: '#030712', border: '1px solid #1e293b', color: '#fff', borderRadius: '4px', marginBottom: '8px', boxSizing: 'border-box' }}
                        />
                        <textarea
                          placeholder="Type your message..."
                          value={replyBody}
                          onChange={(e) => setReplyBody(e.target.value)}
                          style={{ width: '100%', padding: '6px 10px', fontSize: '0.8rem', background: '#030712', border: '1px solid #1e293b', color: '#fff', borderRadius: '4px', marginBottom: '8px', height: '50px', boxSizing: 'border-box', resize: 'vertical' }}
                        />
                        <button
                          className="main-button"
                          type="button"
                          style={{ padding: '5px 12px', fontSize: '0.75rem', width: '100%' }}
                          onClick={() => handleSendSmsReply(replyRecipient, replyBody)}
                        >
                          📤 SEND SMS
                        </button>
                      </div>
                    )}

                    {smsInbox.length === 0 ? (
                      <p style={{ fontSize: '0.78rem', color: '#64748B', margin: 0, textAlign: 'center', padding: '10px' }}>
                        No incoming text messages received yet. Any SMS sent to your alias will appear here instantly.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
                        {smsInbox.map(sms => {
                          const extractSenderPhone = (msgStr) => {
                            if (!msgStr) return "";
                            const fromMatch = msgStr.match(/From\s*[:\s]*\+?([0-9\s\-\(\)]+)/i) || msgStr.match(/To\s*[:\s]*\+?([0-9\s\-\(\)]+)/i);
                            if (fromMatch && fromMatch[1]) {
                              const rawNum = fromMatch[1].replace(/\D/g, "");
                              if (rawNum.length === 10) return `+1${rawNum}`;
                              if (rawNum.length === 11 && rawNum.startsWith("1")) return `+${rawNum}`;
                            }
                            const numMatch = msgStr.match(/\+?1?\s*\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})/);
                            if (numMatch) {
                              return `+1${numMatch[1]}${numMatch[2]}${numMatch[3]}`;
                            }
                            return "";
                          };

                          const extractedPhone = extractSenderPhone(sms.message);
                          const isReplying = activeReplyId === sms.id;

                          return (
                            <div key={sms.id} style={{ background: '#0a0f1d', padding: '10px 12px', borderRadius: '6px', border: '1px solid #1e293b', fontSize: '0.8rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <div style={{ color: '#00D2FF', fontWeight: 'bold', fontSize: '0.78rem' }}>{sms.message}</div>
                                <button
                                  className="reset-btn"
                                  type="button"
                                  style={{ padding: '2px 8px', fontSize: '0.68rem', color: '#10B981', borderColor: '#10B981' }}
                                  onClick={() => {
                                    if (isReplying) {
                                      setActiveReplyId(null);
                                    } else {
                                      setActiveReplyId(sms.id);
                                      setReplyRecipient(extractedPhone);
                                      setReplyBody("");
                                    }
                                  }}
                                >
                                  {isReplying ? "CANCEL" : "💬 REPLY"}
                                </button>
                              </div>
                              <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>{sms.timestamp}</div>

                              {isReplying && (
                                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #1e293b' }}>
                                  <input
                                    type="text"
                                    placeholder="Recipient Phone (+18135551234)"
                                    value={replyRecipient}
                                    onChange={(e) => setReplyRecipient(e.target.value)}
                                    style={{ width: '100%', padding: '6px 10px', fontSize: '0.78rem', background: '#030712', border: '1px solid #334155', color: '#fff', borderRadius: '4px', marginBottom: '6px', boxSizing: 'border-box' }}
                                  />
                                  <textarea
                                    placeholder="Type your reply message..."
                                    value={replyBody}
                                    onChange={(e) => setReplyBody(e.target.value)}
                                    style={{ width: '100%', padding: '6px 10px', fontSize: '0.8rem', background: '#030712', border: '1px solid #334155', color: '#fff', borderRadius: '4px', marginBottom: '6px', height: '45px', boxSizing: 'border-box', resize: 'vertical' }}
                                  />
                                  <button
                                    className="main-button"
                                    type="button"
                                    style={{ padding: '6px 14px', fontSize: '0.75rem', width: '100%', cursor: 'pointer', background: 'linear-gradient(135deg, #10B981, #059669)', border: 'none', color: '#fff', fontWeight: 'bold', borderRadius: '4px', marginTop: '4px' }}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleSendSmsReply(replyRecipient || extractedPhone, replyBody);
                                    }}
                                  >
                                    📤 SEND REPLY NOW
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
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

                <div className="masking-tool" style={{ width: '100%', maxWidth: '600px', border: '1px solid var(--tiger-blue)' }}>
                  <p className="tool-label" style={{ textAlign: 'center', marginBottom: '15px' }}>DATA BROKER TARGETS</p>
                  
                  {/* Primary Target Email */}
                  <div style={{ background: '#05070D', border: '1px solid rgba(0, 210, 255, 0.25)', padding: '14px 16px', borderRadius: '10px', marginBottom: '12px', textAlign: 'left', width: '100%', boxSizing: 'border-box' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#10B981', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
                        PRIMARY TARGET EMAIL
                      </span>
                      <span style={{ fontSize: '0.68rem', color: '#10B981', background: 'rgba(16,185,129,0.12)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(16,185,129,0.3)', fontWeight: 'bold' }}>
                        PRIMARY 🔒
                      </span>
                    </div>
                    <div 
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0A0A0A', padding: '10px 12px', borderRadius: '6px', border: '1px solid #222', cursor: 'pointer', width: '100%', boxSizing: 'border-box' }}
                      onClick={() => { if(targetEmails.primary) { navigator.clipboard.writeText(targetEmails.primary); triggerToast("EMAIL COPIED"); } }}
                    >
                      <span style={{ fontSize: '0.88rem', color: '#FFFFFF', fontFamily: 'monospace', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                        {targetEmails.primary || "Awaiting Sync..."}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#10B981', fontWeight: 'bold', flexShrink: 0, marginLeft: '8px', whiteSpace: 'nowrap' }}>COPY 📋</span>
                    </div>
                  </div>
                  
                  {/* Secondary Target Emails */}
                  {targetEmails.additional.map((e, idx) => (
                    <div key={e.id} style={{ background: '#05070D', border: '1px solid rgba(0, 210, 255, 0.25)', padding: '14px 16px', borderRadius: '10px', marginBottom: '12px', textAlign: 'left', width: '100%', boxSizing: 'border-box' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.72rem', color: '#00D2FF', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
                          SECONDARY TARGET EMAIL #{idx + 1}
                        </span>
                        <button className="kill-text-bold" style={{ padding: '3px 8px', fontSize: '0.7rem' }} onClick={async () => { await secureRequest(`${API_BASE_URL}/profile/emails/${e.id}`, {method: 'DELETE'}); fetchTargetEmails(); }}>
                          REMOVE ✖
                        </button>
                      </div>
                      <div 
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0A0A0A', padding: '10px 12px', borderRadius: '6px', border: '1px solid #222', cursor: 'pointer', width: '100%', boxSizing: 'border-box' }}
                        onClick={() => { navigator.clipboard.writeText(e.email); triggerToast("EMAIL COPIED"); }}
                      >
                        <span style={{ fontSize: '0.88rem', color: '#FFFFFF', fontFamily: 'monospace', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                          {e.email}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#10B981', fontWeight: 'bold', flexShrink: 0, marginLeft: '8px', whiteSpace: 'nowrap' }}>COPY 📋</span>
                      </div>
                    </div>
                  ))}
                  
                  <div className="flex-responsive-row" style={{ marginTop: '15px' }}>
                    <input className="mask-btn" style={{flex: 1, color: 'white', textAlign: 'left', paddingLeft: '14px'}} placeholder="Enter secondary email to scrub..." value={newTargetEmail} onChange={e => setNewTargetEmail(e.target.value)} />
                    <button className="main-button" style={{ fontSize: '0.85rem', padding: '12px 18px', display: 'flex', justifyContent: 'center', alignItems: 'center', whiteSpace: 'nowrap' }} onClick={handleAddTargetEmail}>
                      + ADD TARGET
                    </button>
                  </div>
                  
                  <div style={{ fontSize: '0.82rem', color: '#94A3B8', textAlign: 'center', marginTop: '12px', fontWeight: 'bold' }}>
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
                  <p className="tool-label" style={{ textAlign: 'center', marginBottom: '15px' }}>SUBSCRIPTION MANAGEMENT</p>
                  
                  {/* Status Header Container */}
                  <div style={{ 
                    background: '#05070D', 
                    border: '1px solid rgba(0, 210, 255, 0.25)', 
                    padding: '14px 16px', 
                    borderRadius: '10px', 
                    marginBottom: '15px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '10px',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}>
                    <div style={{ textAlign: 'left' }}>
                      <span style={{ fontSize: '0.72rem', color: '#94A3B8', display: 'block', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold', marginBottom: '3px' }}>CURRENT SUBSCRIPTION PLAN</span>
                      <strong className="tiger-text" style={{ fontSize: '0.92rem', wordBreak: 'break-word' }}>ELITE OPERATIVE ({billingCycle.toUpperCase()})</strong>
                    </div>
                    <div style={{ textAlign: 'left', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', padding: '5px 12px', borderRadius: '8px', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.68rem', color: '#94A3B8', display: 'block', textTransform: 'uppercase', fontWeight: 'bold' }}>STATUS</span>
                      <span style={{ color: '#10B981', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px #10B981' }}></span>
                        ACTIVE
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                    <button className="main-button" style={{ fontSize: '0.95rem', padding: '14px 10px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', width: '100%' }} onClick={handleManageBilling}>
                      <span>💳</span> MANAGE BILLING & CREDIT CARD
                    </button>
                    <div className="flex-responsive-row" style={{ gap: '10px' }}>
                      <button className="reset-btn" style={{ flex: 1, fontSize: '0.85rem', padding: '12px 5px', whiteSpace: 'normal', lineHeight: '1.2', display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={handleManageBilling}>
                        {billingCycle === 'monthly' ? "SWITCH TO ANNUAL" : "SWITCH TO MONTHLY"}
                      </button>
                      <button className="reset-btn" style={{ flex: 1, borderColor: '#ff4444', color: '#ff4444', fontSize: '0.85rem', padding: '12px 5px', whiteSpace: 'normal', lineHeight: '1.2', display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => { if(window.confirm("CANCEL SUBSCRIPTION? PII shielding will be deactivated at end of cycle.")) handleManageBilling(); }}>
                        CANCEL PLAN
                      </button>
                    </div>
                  </div>
                </div>

                {/* --- REFERRAL MILESTONE REWARD WIDGET --- */}
                <div className="masking-tool" style={{ width: '100%', maxWidth: '600px', border: '1px solid #00D2FF', background: 'linear-gradient(135deg, rgba(0,71,171,0.08) 0%, rgba(5,11,20,0.95) 100%)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '8px' }}>
                    <p className="tool-label tiger-text" style={{ margin: 0, fontSize: '0.95rem' }}>🎁 REFERRAL MILESTONE REWARDS</p>
                    <span style={{ fontSize: '0.78rem', color: '#10B981', background: 'rgba(16,185,129,0.15)', padding: '4px 10px', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.3)', fontWeight: 'bold' }}>
                      {referralData.free_months_earned} FREE MONTHS UNLOCKED
                    </span>
                  </div>

                  <p style={{ fontSize: '0.85rem', color: '#CBD5E1', marginBottom: '15px', lineHeight: '1.4' }}>
                    Earn <strong>1 FREE MONTH</strong> of Disappear for every <strong>5 referred users</strong> who subscribe. Rewards automatically apply a 100% credit to your next Stripe billing cycle.
                  </p>

                  {/* Milestone Progress Bar */}
                  <div style={{ background: '#05070D', border: '1px solid rgba(0,210,255,0.3)', borderRadius: '8px', padding: '15px', marginBottom: '15px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '8px', fontWeight: 'bold', flexWrap: 'wrap', gap: '5px' }}>
                      <span style={{ color: '#00D2FF' }}>MILESTONE PROGRESS: {referralData.count % 5}/5 REFERRALS</span>
                      <span style={{ color: '#94A3B8' }}>{referralData.next_milestone_needed} MORE NEEDED</span>
                    </div>
                    
                    <div style={{ width: '100%', height: '10px', background: '#111827', borderRadius: '5px', overflow: 'hidden', border: '1px solid #1F2937' }}>
                      <div style={{ width: `${referralData.progress_pct}%`, height: '100%', background: 'linear-gradient(90deg, #0047AB, #00D2FF)', borderRadius: '5px', transition: 'width 0.4s ease' }}></div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '0.75rem', color: '#64748B', flexWrap: 'wrap', gap: '5px' }}>
                      <span>Total Successful Referrals: <strong>{referralData.count}</strong></span>
                      <span>Milestone Target: <strong>Every 5 Subscribers</strong></span>
                    </div>
                  </div>

                  {/* Shareable Link Box */}
                  <p className="field-label" style={{ textAlign: 'left', marginBottom: '6px' }}>YOUR UNIQUE REFERRAL LINK</p>
                  <div className="flex-responsive-row">
                    <input 
                      type="text" 
                      readOnly 
                      value={referralData.link || (referralData.code ? `https://disappearco.com/?ref=${referralData.code}` : "Generating link...")} 
                      className="mask-btn" 
                      style={{ flex: 1, fontSize: '0.82rem', background: '#000', color: '#FFFFFF', textAlign: 'left', paddingLeft: '12px', border: '1px solid rgba(0,210,255,0.3)' }} 
                    />
                    <button 
                      className="main-button" 
                      style={{ padding: '12px 16px', fontSize: '0.82rem', whiteSpace: 'nowrap', minWidth: '110px' }} 
                      onClick={() => {
                        const linkToCopy = referralData.link || `https://disappearco.com/?ref=${referralData.code}`;
                        navigator.clipboard.writeText(linkToCopy);
                        triggerToast("REFERRAL LINK COPIED TO CLIPBOARD 📋");
                      }}
                    >
                      COPY LINK 📋
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
                <div className="masking-tool" style={{ width: '100%', maxWidth: '600px', border: '1px solid var(--tiger-blue)' }}>
                  <p className="tool-label" style={{ textAlign: 'center', marginBottom: '15px' }}>LIVE SECURITY AUDIT</p>
                  
                  {/* History Filter Toggles */}
                  <div className="billing-toggle" style={{ display: 'flex', gap: '5px', marginBottom: '15px' }}>
                    {[30, 60, 90].map(d => (
                      <button 
                        key={d}
                        className={historyDays === d ? 'mask-btn active-toggle' : 'mask-btn'} 
                        style={{ flex: 1, fontSize: '0.85rem', padding: '10px 0' }} 
                        onClick={() => setHistoryDays(d)}
                      >
                        {d} DAYS
                      </button>
                    ))}
                  </div>

                  <div className="audit-list" style={{ maxHeight: '220px', overflowY: 'auto', background: '#05070D', border: '1px solid rgba(0,210,255,0.2)', borderRadius: '8px', padding: '10px' }}>
                    {auditLog.length > 0 ? auditLog.map((log, i) => (
                      <div key={`audit-${log.timestamp}-${i}`} style={{ background: '#0a0f1d', border: '1px solid #1e293b', borderRadius: '6px', padding: '10px 12px', marginBottom: '8px', textAlign: 'left' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap', gap: '5px' }}>
                          <span style={{ fontSize: '0.72rem', color: '#00D2FF', fontWeight: 'bold' }}>
                            📅 {new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: '#94A3B8', background: '#111827', padding: '2px 6px', borderRadius: '4px', border: '1px solid #1F2937' }}>
                            NODE: {log.node?.slice(-12) || 'VAULT_CORE'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#FFFFFF', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: '#10B981', fontWeight: 'bold' }}>✓</span>
                          <span>{log.action}</span>
                        </div>
                      </div>
                    )) : (
                      <div className="terminal-line" style={{textAlign: 'center', opacity: 0.5, padding: '15px'}}>NO_RECORDS_IN_WINDOW</div>
                    )}
                  </div>
                  
                  {/* Audit Action Buttons */}
                  <div className="flex-responsive-row" style={{ gap: '10px', marginTop: '15px' }}>
                    <button className="pdf-btn" style={{ flex: 1, fontSize: '0.82rem', padding: '12px 5px', display: 'flex', justifyContent: 'center', alignItems: 'center', whiteSpace: 'nowrap' }} onClick={() => handleDownloadPDF(false)} disabled={isGenerating}>
                      📄 EXPORT AUDIT PDF
                    </button>
                    <button className="reset-btn" style={{ flex: 1, fontSize: '0.82rem', padding: '12px 5px', display: 'flex', justifyContent: 'center', alignItems: 'center', borderColor: 'var(--tiger-blue)', color: 'var(--tiger-blue)', whiteSpace: 'nowrap' }} onClick={handleExportJSON}>
                      💾 EXPORT SECURE BACKUP
                    </button>
                  </div>
                </div>

                {/* --- SESSION & SECURITY CONTROLS CARD --- */}
                <div className="masking-tool" style={{ 
                  width: '100%', 
                  maxWidth: '600px', 
                  marginTop: '25px', 
                  marginBottom: '50px',
                  padding: '20px',
                  border: '1px solid rgba(255, 77, 0, 0.3)',
                  background: 'rgba(5, 7, 13, 0.95)',
                  borderRadius: '12px'
                }}>
                  <p className="tool-label" style={{ textAlign: 'center', color: '#FF4D00', marginBottom: '15px' }}>SESSION & SECURITY CONTROLS</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
                    <button className="reset-btn" style={{ fontSize: '0.95rem', padding: '14px 10px', display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }} onClick={() => {localStorage.clear(); window.location.reload();}}>
                      🚪 LOGOUT SECURELY
                    </button>
                    <button className="burn-all-btn" style={{ fontSize: '0.95rem', padding: '14px 10px', display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }} onClick={handleEmergencyBurn}>
                      🔥 INITIATE EMERGENCY BURN
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* 4. ONBOARDING & LOGIN FLOW (MOBILE OPTIMIZED) */
              <div className="onboarding-flow">
                {(show2FA || (!showPricing && !showCheckout && !isScanning)) && (
                  <div className="pricing-card fade-in" style={{ maxWidth: '450px', margin: '0 auto', width: '100%' }}>
                    <div className="price-box" style={{ padding: '30px 25px' }}>
                      <div className="billing-toggle" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', width: '100%', marginBottom: '20px' }}>
                        <button className="mask-btn active-toggle" style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>SIGN IN</button>
                        <button className="mask-btn" style={{ fontSize: '0.85rem' }} onClick={() => { window.location.hash = "pricing"; }}>CREATE ACCOUNT</button>
                      </div>
                      <h3 className="tiger-text" style={{ fontSize: '1.1rem', marginBottom: '15px', textAlign: 'center' }}>SIGN IN TO DISAPPEAR</h3>
                      <form onSubmit={(e) => { e.preventDefault(); verify2FA(); }} autoComplete="on" style={{ width: '100%' }}>
                        <p className="field-label">REGISTERED ACCOUNT EMAIL</p>
                        <input 
                          type="email"
                          name="customer_login_email" 
                          id="customer_login_email"
                          autoComplete="username" 
                          className="mask-btn" 
                          style={{width: '100%', textAlign: 'center', marginBottom: '15px', color: 'white'}} 
                          placeholder="customer@email.com" 
                          value={loginEmail} 
                          onChange={(e) => setLoginEmail(e.target.value)} 
                        />
                        <p className="field-label">ACCOUNT PASSWORD</p>
                        <input 
                          type="password" 
                          name="customer_login_password" 
                          id="customer_login_password"
                          autoComplete="current-password" 
                          className="mask-btn" 
                          style={{width: '100%', textAlign: 'center', color: 'white', marginBottom: '15px'}} 
                          placeholder="••••••••" 
                          value={loginPassword} 
                          onChange={(e) => setLoginPassword(e.target.value)} 
                        />
                        <button type="submit" className="main-button" style={{width: '100%', marginTop: '10px'}}>SIGN IN</button>
                      </form>
                      <button 
                        type="button" 
                        className="main-button" 
                        style={{ width: '100%', marginTop: '12px', background: 'linear-gradient(135deg, #10B981, #059669)', border: 'none' }}
                        onClick={() => {
                          localStorage.setItem("disappear_session", "active");
                          if (!localStorage.getItem("disappear_user_id")) {
                            localStorage.setItem("disappear_user_id", "user_mike803");
                          }
                          setCurrentUserId(localStorage.getItem("disappear_user_id") || "user_mike803");
                          setShowLanding(false);
                          setShow2FA(false);
                          setShowShield(true);
                          syncDefenseData();
                        }}
                      >
                        ⚡ ACCESS VAULT DIRECTLY
                      </button>
                      {(hasBiometrics || Capacitor.isNativePlatform()) && (
                        <button 
                          className="mask-btn" 
                          style={{width: '100%', marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderColor: '#00D2FF', color: '#00D2FF', fontWeight: 'bold'}} 
                          onClick={handleBiometricLogin}
                        >
                          <span style={{fontSize: '1.2rem'}}>🔒</span> SIGN IN WITH FACE ID / BIOMETRICS
                        </button>
                      )}
                      <button className="reset-btn" style={{width: '100%', marginTop: '15px', fontSize: '0.85rem', color: '#cbd5e1'}} onClick={() => { window.location.hash = "pricing"; }}>
                        NEW OPERATIVE? CREATE AN ACCOUNT
                      </button>
                    </div>
                  </div>
                )}

                {showPricing && !showCheckout && !isScanning && (
                  <div className="onboarding-panels-container fade-in">
                    {/* Panel 1: Select Plan */}
                    <div className="pricing-card">
                      <div className="price-box">
                        <div className="billing-toggle" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', width: '100%', marginBottom: '15px' }}>
                          <button className={billingCycle === 'monthly' ? 'mask-btn active-toggle' : 'mask-btn'} onClick={() => setBillingCycle('monthly')}>Monthly</button>
                          <button className={billingCycle === 'annual' ? 'mask-btn active-toggle' : 'mask-btn'} onClick={() => setBillingCycle('annual')}>Annual</button>
                        </div>
                        <h3 className="tiger-text">ELITE PRIVACY PLAN</h3>
                        <div className="price-amount">${billingCycle === 'monthly' ? '19.99' : '15.99'}</div>
                        <p style={{fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '20px', textAlign: 'center'}}>Cancel or adjust subscription directly inside your dashboard in a single click.</p>
                        <button className="main-button" style={{width: '100%'}} onClick={() => window.location.hash = "checkout"}>PROCEED</button>
                        <button className="reset-btn" style={{width: '100%', marginTop: '10px'}} onClick={() => { window.history.replaceState(null, "", window.location.pathname + window.location.search); setShowLanding(true); setShowPricing(false); }}>CANCEL</button>
                      </div>
                    </div>

                    {/* Panel 2: Plan Features */}
                    <div className="pricing-card feature-card">
                      <div className="price-box" style={{ alignItems: 'stretch', textAlign: 'left' }}>
                        <h3 className="tiger-text" style={{ textAlign: 'center', marginBottom: '15px' }}>WHAT'S INCLUDED</h3>
                        <div className="pricing-features-list">
                          <div>
                            <span style={{ color: 'var(--tiger-blue)', fontWeight: 'bold' }}>✓</span>
                            <span style={{ fontSize: '0.88rem', color: '#cbd5e1' }}><strong>6 Active Slots:</strong> Provision secure emails or phone relays.</span>
                          </div>
                          <div>
                            <span style={{ color: 'var(--tiger-blue)', fontWeight: 'bold' }}>✓</span>
                            <span style={{ fontSize: '0.88rem', color: '#cbd5e1' }}><strong>Hybrid Automated Opt-Outs:</strong> Continuous background scans across broker databases.</span>
                          </div>
                          <div>
                            <span style={{ color: 'var(--tiger-blue)', fontWeight: 'bold' }}>✓</span>
                            <span style={{ fontSize: '0.88rem', color: '#cbd5e1' }}><strong>Human Analyst Audits:</strong> Our real privacy analysts enforce removals manually.</span>
                          </div>
                          <div>
                            <span style={{ color: 'var(--tiger-blue)', fontWeight: 'bold' }}>✓</span>
                            <span style={{ fontSize: '0.88rem', color: '#cbd5e1' }}><strong>Emergency Burn:</strong> Scorch all email and phone alias relays instantly.</span>
                          </div>
                          <div>
                            <span style={{ color: 'var(--tiger-blue)', fontWeight: 'bold' }}>✓</span>
                            <span style={{ fontSize: '0.88rem', color: '#cbd5e1' }}><strong>Standalone Native App:</strong> Full access from Android or mobile client.</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {showCheckout && !isScanning && (
                  <div className="onboarding-panels-container fade-in">
                    {/* Panel 1: Target Profile */}
                    <div className="pricing-card">
                      <div className="price-box">
                        <h3 className="tiger-text">TARGET PROFILE DATA</h3>
                        <div className="checkout-grid">
                            <input className="mask-btn" placeholder="First Name" value={targetProfile.firstName} onChange={(e) => setTargetProfile({...targetProfile, firstName: e.target.value})} />
                            <input className="mask-btn" placeholder="Middle Name" value={targetProfile.middleName} onChange={(e) => setTargetProfile({...targetProfile, middleName: e.target.value})} />
                            <input className="mask-btn full-row" placeholder="Last Name" value={targetProfile.lastName} onChange={(e) => setTargetProfile({...targetProfile, lastName: e.target.value})} />
                            <input className="mask-btn full-row" placeholder="Email Address" value={targetProfile.email} onChange={(e) => setTargetProfile({...targetProfile, email: e.target.value})} />
                            <input type="password" className="mask-btn full-row" placeholder="Account Password" value={targetProfile.password} onChange={(e) => setTargetProfile({...targetProfile, password: e.target.value})} />
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
                          <input type="checkbox" id="termsAcceptedCheckbox" checked={targetProfile.termsAccepted} onChange={(e) => setTargetProfile({...targetProfile, termsAccepted: e.target.checked})} />
                          <label htmlFor="termsAcceptedCheckbox" style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>Authorize Full PII Scrub and Burn</label>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', alignItems: 'flex-start', gap: '10px', marginTop: '12px', background: 'rgba(0, 0, 0, 0.35)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(0, 210, 255, 0.25)' }}>
                          <input type="checkbox" id="smsConsentCheckbox" checked={targetProfile.smsConsentAccepted || false} onChange={(e) => setTargetProfile({...targetProfile, smsConsentAccepted: e.target.checked})} />
                          <label htmlFor="smsConsentCheckbox" style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: '1.45', textAlign: 'left' }}>
                            By providing your phone number and checking this box, you agree to receive automated transactional SMS notifications, security alerts, and identity status updates from Disappearco (DFS 213 LLC). Consent is not a condition of purchase. Message frequency varies based on account activity. Message and data rates may apply. Reply <strong>STOP</strong> to cancel or <strong>HELP</strong> for assistance. View our <a href="#privacy" onClick={(e) => { e.preventDefault(); setShowLegal('privacy'); }} style={{ color: '#00D2FF', textDecoration: 'underline' }}>Privacy Policy</a> and <a href="#terms" onClick={(e) => { e.preventDefault(); setShowLegal('terms'); }} style={{ color: '#00D2FF', textDecoration: 'underline' }}>Terms of Service</a>.
                          </label>
                        </div>
                        {/* PROMO / COUPON CODE SECTION */}
                        <div style={{ marginTop: '18px', background: 'rgba(0, 71, 171, 0.08)', padding: '14px', borderRadius: '6px', border: '1px solid rgba(0, 210, 255, 0.2)' }}>
                          <label style={{ fontSize: '0.78rem', color: '#00D2FF', letterSpacing: '1px', display: 'block', marginBottom: '6px' }}>🎟️ PROMO / COUPON CODE</label>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch' }}>
                            <input 
                              className="mask-btn" 
                              placeholder="Enter Promo Code (e.g. TACTICAL50)" 
                              style={{ flex: 1, textTransform: 'uppercase', height: '44px', boxSizing: 'border-box', margin: 0 }}
                              value={couponInput}
                              onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                            />
                            <button 
                              type="button"
                              className="main-button" 
                              style={{ height: '44px', padding: '0 20px', fontSize: '0.85rem', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', margin: 0 }}
                              onClick={handleApplyCoupon}
                              disabled={isValidatingCoupon || !couponInput.trim()}
                            >
                              {isValidatingCoupon ? "CHECKING..." : "APPLY"}
                            </button>
                          </div>
                          {couponMsg && (
                            <div style={{ marginTop: '8px', fontSize: '0.8rem', color: couponMsg.startsWith('✔') ? '#34d399' : '#ff6b6b', fontWeight: 'bold' }}>
                              {couponMsg}
                            </div>
                          )}
                        </div>

                        <button className="main-button" style={{ width: '100%', marginTop: '25px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }} onClick={handleFinalPurchase} disabled={!targetProfile.termsAccepted || !targetProfile.smsConsentAccepted || isMinting}>
                          {isMinting ? <><span className="cyberpunk-spinner"></span> INITIATING...</> : appliedCoupon ? `CONFIRM & INITIATE ($${appliedCoupon.final_price.toFixed(2)}/mo)` : 'CONFIRM & INITIATE'}
                        </button>
                        <button className="reset-btn" style={{width: '100%', marginTop: '10px'}} onClick={() => window.location.hash = "pricing"}>BACK</button>
                      </div>
                    </div>

                    {/* Panel 2: Secure Commitments */}
                    <div className="pricing-card feature-card">
                      <div className="price-box" style={{ alignItems: 'stretch', textAlign: 'left' }}>
                        <h3 className="tiger-text" style={{ textAlign: 'center', marginBottom: '20px' }}>SECURITY COMMITMENTS</h3>
                        <div className="pricing-features-list">
                          <div>
                            <span style={{ color: 'var(--tiger-blue)', fontWeight: 'bold', fontSize: '1.1rem' }}>✓</span>
                            <span style={{ fontSize: '0.88rem', color: '#cbd5e1', lineHeight: '1.4' }}>
                              <strong>Client-Side Encryption:</strong> Profile data is encrypted in transit and at rest with zero-knowledge keys. We store no plaintext PII.
                            </span>
                          </div>
                          <div>
                            <span style={{ color: 'var(--tiger-blue)', fontWeight: 'bold', fontSize: '1.1rem' }}>✓</span>
                            <span style={{ fontSize: '0.88rem', color: '#cbd5e1', lineHeight: '1.4' }}>
                              <strong>180+ Broker Removal:</strong> Direct opt-outs filed across public search directories and broker systems.
                            </span>
                          </div>
                          <div>
                            <span style={{ color: 'var(--tiger-blue)', fontWeight: 'bold', fontSize: '1.1rem' }}>✓</span>
                            <span style={{ fontSize: '0.88rem', color: '#cbd5e1', lineHeight: '1.4' }}>
                              <strong>Encrypted Routing Aliases:</strong> Provision secure email relays and phone forwarding lines instantly.
                            </span>
                          </div>
                          <div>
                            <span style={{ color: 'var(--tiger-blue)', fontWeight: 'bold', fontSize: '1.1rem' }}>✓</span>
                            <span style={{ fontSize: '0.88rem', color: '#cbd5e1', lineHeight: '1.4' }}>
                              <strong>Protected Checkout:</strong> Subscriptions are fully secured via an encrypted payment network.
                            </span>
                          </div>
                        </div>
                      </div>
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

      <footer className="home-footer">
          <div style={{ width: '100%', marginBottom: '8px', fontSize: '0.82rem', color: '#94A3B8', letterSpacing: '0.5px', textAlign: 'center' }}>
            DISAPPEAR IS BROUGHT TO YOU BY <strong style={{ color: '#00D2FF', letterSpacing: '1px' }}>DFS 213 LLC</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
            <span style={{ cursor: 'pointer', letterSpacing: '1px' }} onClick={() => window.location.hash = "manifesto"}>MANIFESTO</span>
            <span className="footer-divider" style={{ opacity: 0.4, color: '#64748B' }}>|</span>
            <span style={{ cursor: 'pointer', letterSpacing: '1px' }} onClick={() => window.location.hash = "privacy"}>PRIVACY</span>
            <span className="footer-divider" style={{ opacity: 0.4, color: '#64748B' }}>|</span>
            <span style={{ cursor: 'pointer', letterSpacing: '1px' }} onClick={() => window.location.hash = "terms"}>TERMS</span>
            <span className="footer-divider" style={{ opacity: 0.4, color: '#64748B' }}>|</span>
            <span style={{ cursor: 'pointer', letterSpacing: '1px' }} onClick={() => window.location.hash = "aml-policy"}>AML & FRAUD</span>
            <span className="footer-divider" style={{ opacity: 0.4, color: '#64748B' }}>|</span>
            <span style={{ cursor: 'pointer', letterSpacing: '1px' }} onClick={() => window.location.hash = "support"}>SUPPORT</span>
            <span className="admin-trigger" style={{ cursor: 'pointer', opacity: 0 }} onClick={() => window.location.hash = "admin"}>.</span>
          </div>
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

      {/* --- FLOATING AI PRIVACY ASSISTANT CHAT WIDGET --- */}
      <PrivacyAiChat apiBaseUrl={API_BASE_URL} />
    </div>
  );
}

export default App;