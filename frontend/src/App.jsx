import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
import { checkBiometricAvailability, promptBiometricAuth, enableBiometricLogin, getBiometricCredentials, isBiometricEnabled } from './biometricService';
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

const isCapacitorNative = typeof window !== 'undefined' && (
  (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) ||
  window.location.protocol === 'file:' || 
  window.location.protocol === 'capacitor:' || 
  window.location.protocol === 'ionic:'
);

// Only use LOCAL_API if explicitly running on local Vite dev server (port 5173 on non-Capacitor web)
const isExplicitLocalDev = !isCapacitorNative && typeof window !== 'undefined' && 
  (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') && 
  window.location.port === '5173';

const API_BASE_URL = isCapacitorNative 
  ? PROD_API 
  : ((import.meta.env && import.meta.env.VITE_API_BASE_URL) || (isExplicitLocalDev ? LOCAL_API : PROD_API));

// --- TAB ISOLATION & SECURE SESSION STORAGE ENGINE ---
// Uses sessionStorage exclusively so each browser tab/window maintains its own strictly isolated session sandbox.
// Zero reading or writing of auth session credentials to global localStorage to prevent cross-tab state bleeding.
const getSessionItem = (key) => {
  try {
    const val = sessionStorage.getItem(key);
    if (val && val !== "undefined" && val !== "null") return val;
    return "";
  } catch (e) {
    return "";
  }
};

const setSessionItem = (key, value) => {
  try {
    if (value !== undefined && value !== null) {
      sessionStorage.setItem(key, value);
    }
  } catch (e) {}
};

const removeSessionItem = (key) => {
  try {
    sessionStorage.removeItem(key);
  } catch (e) {}
};

const clearSessionStorage = () => {
  try {
    sessionStorage.clear();
  } catch (e) {}
};

function App() {
  // --- SECURE BRIDGE LOGIC ---
  // This bridges the gap between the app and the server on native hardware
  const secureRequest = async (url, options = {}, retries = 3) => {
    const activeUserId = currentUserId 
      || getSessionItem("disappear_user_id") 
      || getSessionItem("user_id") 
      || (typeof localStorage !== "undefined" ? (localStorage.getItem("disappear_user_id") || localStorage.getItem("user_id")) : "") 
      || "";

    const headers = { 
      'Content-Type': 'application/json', 
      'Accept': 'application/json',
      'x-user-id': activeUserId, 
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      ...options.headers 
    };

    for (let i = 0; i < retries; i++) {
      try {
        if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() && window.CapacitorHttp) {
          try {
            const parsedData = (options.body && typeof options.body === 'string') ? JSON.parse(options.body) : options.body;
            const response = await CapacitorHttp.request({
              url,
              method: options.method || 'GET',
              data: parsedData,
              headers: headers
            });
            const isOk = response.status >= 200 && response.status < 300;
            if (response.status === 401 || response.status === 403) {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent("disappear_unauthorized_event"));
              }
            }
            const resData = (typeof response.data === 'string') ? JSON.parse(response.data) : (response.data || {});
            return { 
              ok: isOk, 
              status: response.status,
              json: () => Promise.resolve(resData) 
            };
          } catch (capErr) {
            console.warn("CapacitorHttp notice, falling back to window.fetch:", capErr);
          }
        }
        const fetchRes = await fetch(url, { ...options, headers });
        if (fetchRes.status === 401 || fetchRes.status === 403) {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent("disappear_unauthorized_event"));
          }
        }
        return fetchRes;
      } catch (err) {
        if (i === retries - 1) {
          return { ok: false, status: 0, json: async () => ({ detail: err.message || "Network request failed" }) };
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  };

  // --- CORE VIEW NAVIGATION (UPDATED) ---
  const [showLanding, setShowLanding] = useState(true); 
  const [currentUserId, setCurrentUserId] = useState(() => getSessionItem("disappear_user_id") || "");
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
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [hasBiometrics, setHasBiometrics] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedFundingSource, setSelectedFundingSource] = useState("");

  useEffect(() => {
    checkBiometricAvailability().then(available => {
      setHasBiometrics(available);
      if (available && isBiometricEnabled() && Capacitor.isNativePlatform()) {
        const creds = getBiometricCredentials();
        if (creds && creds.uid) {
          setTimeout(() => {
            handleBiometricLogin();
          }, 600);
        }
      }
    });
  }, []);

  // --- SUPPORT & FAQ STATES ---
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showFaqModal, setShowFaqModal] = useState(false); 
  const [showManualModal, setShowManualModal] = useState(false);
  const [activeFaqNode, setActiveFaqNode] = useState(null);
  const [supportData, setSupportData] = useState({ category: "GENERAL_INQUIRY", subject: "TECHNICAL_ERR", message: "" });

  // --- CATEGORY-SPECIFIC STATES ---
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [showTerminateAliasModal, setShowTerminateAliasModal] = useState(false);
  const [aliasToTerminate, setAliasToTerminate] = useState(null);
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
  const [selectedSenderAlias, setSelectedSenderAlias] = useState("");
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [showComposeSms, setShowComposeSms] = useState(false);
  const [composeSmsRecipient, setComposeSmsRecipient] = useState("");
  const [composeSmsBody, setComposeSmsBody] = useState("");
  const [expandedThreads, setExpandedThreads] = useState({});
  const [showOnboardingWelcomeModal, setShowOnboardingWelcomeModal] = useState(false);
  const [showDataRemovalNoticeModal, setShowDataRemovalNoticeModal] = useState(false);
  const [showSignupTargetNoticeModal, setShowSignupTargetNoticeModal] = useState(false);
  const [dashboardTab, setDashboardTab] = useState("aliases");

  const checkAndShowNoticeModal = (uid) => {
    const targetId = uid || currentUserId || getSessionItem("disappear_user_id") || getSessionItem("disappear_user_email");
    if (!targetId) return;
    const isAcked = getSessionItem(`disappear_notice_acked_${targetId}`) || 
                    localStorage.getItem(`disappear_notice_acked_${targetId}`) ||
                    getSessionItem("disappear_notice_acked_global") ||
                    localStorage.getItem("disappear_notice_acked_global");
    const isVerified = addyRecipientStatus === "VERIFIED" || 
                       getSessionItem(`disappear_addy_verified_${targetId}`) === "VERIFIED" ||
                       localStorage.getItem(`disappear_addy_verified_${targetId}`) === "VERIFIED";

    if (isAcked !== "true" && !isVerified) {
      setShowDataRemovalNoticeModal(true);
    }
  };

  const acknowledgeNoticeModal = () => {
    const targetId = currentUserId || getSessionItem("disappear_user_id") || getSessionItem("disappear_user_email");
    if (targetId) {
      setSessionItem(`disappear_notice_acked_${targetId}`, "true");
      try { localStorage.setItem(`disappear_notice_acked_${targetId}`, "true"); } catch(e){}
    }
    setSessionItem("disappear_notice_acked_global", "true");
    try { localStorage.setItem("disappear_notice_acked_global", "true"); } catch(e){}
    setShowDataRemovalNoticeModal(false);
  };

  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotCode, setForgotCode] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [isResetCodeSent, setIsResetCodeSent] = useState(false);
  const [isSendingResetCode, setIsSendingResetCode] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const [currentPasswordInput, setCurrentPasswordInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const [addyRecipientStatus, setAddyRecipientStatus] = useState(() => {
    const activeUid = getSessionItem("disappear_user_id");
    if (activeUid) {
      const cached = getSessionItem(`disappear_addy_verified_${activeUid}`);
      if (cached === "VERIFIED") return "VERIFIED";
    }
    return null;
  });
  const [addyRecipientEmail, setAddyRecipientEmail] = useState("");
  const [isCheckingAddyStatus, setIsCheckingAddyStatus] = useState(false);
  const [isResendingAddyVerification, setIsResendingAddyVerification] = useState(false);

  const [aliasMessages, setAliasMessages] = useState([]);
  const [replyAliasEmail, setReplyAliasEmail] = useState("");
  const [replyRecipientEmail, setReplyRecipientEmail] = useState("");
  const [replySubject, setReplySubject] = useState("");
  const [aliasReplyBody, setAliasReplyBody] = useState("");
  const [showAliasReplyModal, setShowAliasReplyModal] = useState(false);
  const [isSendingAliasReply, setIsSendingAliasReply] = useState(false);

  const isSyncingRef = useRef(false);
  const isFetchingSmsRef = useRef(false);
  const isFetchingMessagesRef = useRef(false);

  const fetchAliasMessages = useCallback(async () => {
    if (isFetchingMessagesRef.current) return;
    isFetchingMessagesRef.current = true;
    try {
      const activeUserId = currentUserId || getSessionItem("disappear_user_id");
      if (!activeUserId) return;
      const res = await secureRequest(`${API_BASE_URL}/aliases/messages?user_id=${encodeURIComponent(activeUserId)}`);
      if (res.ok) {
        const data = await res.json();
        setAliasMessages(data.messages || []);
      }
    } catch (e) {
      console.warn("Failed fetching alias messages:", e);
    } finally {
      isFetchingMessagesRef.current = false;
    }
  }, [secureRequest, currentUserId]);

  const [isRefreshingAliasData, setIsRefreshingAliasData] = useState(false);

  const handleRefreshAliasData = async () => {
    setIsRefreshingAliasData(true);
    triggerToast("🔄 REFRESHING ALIAS INBOX...");
    try {
      await Promise.all([
        syncDefenseData(),
        fetchAliasMessages()
      ]);
      triggerToast("✅ ALIAS INBOX & MESSAGES REFRESHED");
    } catch (e) {
      console.warn("Error refreshing alias data:", e);
    } finally {
      setIsRefreshingAliasData(false);
    }
  };

  const handleSendAliasReply = async (e) => {
    if (e) e.preventDefault();
    const activeSenderAlias = replyAliasEmail || (emails && emails.length > 0 ? emails[0].content : "");
    if (!activeSenderAlias || !replyRecipientEmail || !aliasReplyBody.trim()) {
      triggerToast("⚠️ PLEASE FILL IN ALIAS, RECIPIENT & MESSAGE");
      return;
    }

    const activeUserId = currentUserId 
      || getSessionItem("disappear_user_id") 
      || getSessionItem("user_id") 
      || (typeof localStorage !== "undefined" ? (localStorage.getItem("disappear_user_id") || localStorage.getItem("user_id")) : "") 
      || "";

    if (!activeUserId) {
      triggerToast("⚠️ PLEASE SIGN IN TO TRANSMIT ALIAS EMAIL");
      return;
    }

    setIsSendingAliasReply(true);
    triggerToast("⏳ TRANSMITTING ALIAS EMAIL...");

    console.log("✉️ MOBILE_EMAIL_DISPATCH_INITIATED:", {
      url: `${API_BASE_URL}/api/email/send?user_id=${encodeURIComponent(activeUserId)}`,
      alias_email: activeSenderAlias,
      recipient_email: replyRecipientEmail,
      user_id: activeUserId
    });

    try {
      const res = await secureRequest(`${API_BASE_URL}/api/email/send?user_id=${encodeURIComponent(activeUserId)}`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-User-ID": activeUserId
        },
        body: JSON.stringify({
          alias_email: activeSenderAlias,
          recipient_email: replyRecipientEmail,
          subject: replySubject || "Encrypted Alias Transmission",
          message_body: aliasReplyBody
        })
      });
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status} Response Parse Error` }));
      if (res.ok) {
        console.log("✅ MOBILE_EMAIL_DISPATCH_SUCCESS:", err);
        triggerToast("✅ ALIAS EMAIL DISPATCHED SUCCESSFULLY!");
        setAliasReplyBody("");
        setShowAliasReplyModal(false);
        fetchAliasMessages();
        syncDefenseData();
      } else {
        console.error("❌ MOBILE_EMAIL_DISPATCH_FAILED:", res.status, err);
        triggerToast(`❌ REASON: ${err.detail || `FAILED TO TRANSMIT EMAIL (${res.status})`}`);
      }
    } catch (err) {
      console.error("❌ MOBILE_EMAIL_DISPATCH_EXCEPTION:", err);
      triggerToast(`❌ NETWORK ERROR SENDING ALIAS EMAIL: ${err.message || "Connection failed"}`);
    } finally {
      setIsSendingAliasReply(false);
    }
  };

  const handleDeleteAliasMessage = async (id, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!id) return;
    try {
      setAliasMessages(prev => prev.filter(m => String(m.id) !== String(id)));
      triggerToast("🗑️ EMAIL DELETED FROM VAULT");
      await secureRequest(`${API_BASE_URL}/aliases/messages/${id}`, { method: "DELETE" });
      fetchAliasMessages();
    } catch (err) {
      console.error("Error deleting alias message:", err);
    }
  };

  const [relayCredits, setRelayCredits] = useState(500);
  const [relayCreditsTotal, setRelayCreditsTotal] = useState(500);
  const [isRefillingCredits, setIsRefillingCredits] = useState(false);

  // Memoized, stable SMS thread groups to prevent any text flickering or inline recalculations
  const groupedSmsThreads = useMemo(() => {
    if (!smsInbox || smsInbox.length === 0) return [];

    const extractContactPhone = (sms) => {
      if (!sms) return "VIRTUAL_LINE";
      const isOutbound = (sms.message && String(sms.message).startsWith("OUTBOUND"));

      if (isOutbound) {
        if (sms.to_phone) {
          const raw = sms.to_phone.replace(/\D/g, "");
          if (raw.length === 10) return `+1${raw}`;
          if (raw.length === 11 && raw.startsWith("1")) return `+${raw}`;
          if (raw.length > 0) return sms.to_phone;
        }
        const toMatch = String(sms.message).match(/To\s*[:\s]*\+?([0-9\s\-\(\)]+)/i);
        if (toMatch && toMatch[1]) {
          const rawNum = toMatch[1].replace(/\D/g, "");
          if (rawNum.length === 10) return `+1${rawNum}`;
          if (rawNum.length === 11 && rawNum.startsWith("1")) return `+${rawNum}`;
        }
      } else {
        if (sms.from_phone) {
          const raw = sms.from_phone.replace(/\D/g, "");
          if (raw.length === 10) return `+1${raw}`;
          if (raw.length === 11 && raw.startsWith("1")) return `+${raw}`;
          if (raw.length > 0) return sms.from_phone;
        }
        const fromMatch = String(sms.message).match(/From\s*[:\s]*\+?([0-9\s\-\(\)]+)/i);
        if (fromMatch && fromMatch[1]) {
          const rawNum = fromMatch[1].replace(/\D/g, "");
          if (rawNum.length === 10) return `+1${rawNum}`;
          if (rawNum.length === 11 && rawNum.startsWith("1")) return `+${rawNum}`;
        }
      }

      if (sms.line && sms.line !== "VIRTUAL_LINE" && sms.line !== "OUTBOUND_SMS") {
        return sms.line;
      }
      return "UNKNOWN_SENDER";
    };

    const groupedMap = new Map();
    smsInbox.forEach(sms => {
      const phone = extractContactPhone(sms);
      if (!groupedMap.has(phone)) {
        groupedMap.set(phone, []);
      }
      groupedMap.get(phone).push(sms);
    });

    const threadGroups = Array.from(groupedMap.entries()).map(([phone, messages]) => {
      const sortedMessages = [...messages].sort((a, b) => {
        const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return tB - tA;
      });
      const newestTime = sortedMessages[0]?.timestamp ? new Date(sortedMessages[0].timestamp).getTime() : 0;
      return { phone, messages: sortedMessages, newestTime };
    });

    threadGroups.sort((a, b) => b.newestTime - a.newestTime);
    return threadGroups;
  }, [smsInbox]);

  const [targetProfile, setTargetProfile] = useState({
      firstName: "", middleName: "", lastName: "", email: "", password: "", phone: "",
      dob: "", address: "", city: "", state: "", zip: "", termsAccepted: false, smsConsentAccepted: false
  });

  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");

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
      const basePrice = billingCycle === 'annual' ? 15.99 : 19.99;
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
  
  const [scrubStats, setScrubStats] = useState({
    total_brokers: 33,
    removed: 0,
    processing: 25,
    manual_pending: 8,
    progress_pct: 0
  });
  const [dataBrokers, setDataBrokers] = useState([]);
  const [brokerFilter, setBrokerFilter] = useState("ALL");

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

  const updateSmsInboxSafely = useCallback((newInbox) => {
    if (!Array.isArray(newInbox)) return;
    setSmsInbox(prev => {
      if (JSON.stringify(prev) === JSON.stringify(newInbox)) {
        return prev;
      }
      return newInbox;
    });
  }, []);

  const fetchSmsInbox = useCallback(async () => {
    if (isFetchingSmsRef.current) return;
    isFetchingSmsRef.current = true;
    try {
      const activeUserId = currentUserId || getSessionItem("disappear_user_id");
      if (!activeUserId) return;
      const res = await secureRequest(`${API_BASE_URL}/api/v1/sms-inbox/${activeUserId}`);
      if (res.ok) {
        const data = await res.json();
        updateSmsInboxSafely(data.inbox || []);
      }
    } catch (e) {
      console.error("SMS Inbox error", e);
    } finally {
      isFetchingSmsRef.current = false;
    }
  }, [currentUserId, updateSmsInboxSafely]);

  const fetchTargetEmails = useCallback(async () => {
    const activeUserId = currentUserId || getSessionItem("disappear_user_id");
    if (!activeUserId) return;
    try {
        const res = await secureRequest(`${API_BASE_URL}/profile/emails?user_id=${activeUserId}`);
        if(res.ok) setTargetEmails(await res.json());
    } catch(e) {}
  }, [currentUserId]);

  const syncDefenseData = useCallback(async (overrideUserId = null) => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    try {
      const activeUserId = overrideUserId || currentUserId || getSessionItem("disappear_user_id") || getSessionItem("disappear_user_email");
      if (!activeUserId) return;
      
      setSessionItem("disappear_last_active", Date.now().toString());
      
      if (activeUserId === "undefined") {
          removeSessionItem("disappear_user_id");
          removeSessionItem("disappear_session");
          window.location.reload();
          return;
      }
      
      // 1. Consolidated Sync Handshake
      const res = await secureRequest(`${API_BASE_URL}/dashboard/sync?user_id=${encodeURIComponent(activeUserId)}&t=${Date.now()}`);
      if (res.status === 401 || res.status === 403) {
        console.warn("🔒 SESSION EXPIRED OR UNAUTHENTICATED: Returning cleanly to login view");
        handleSecureLogout();
        return;
      }
      if (!res.ok) throw new Error("Sync failed");
      const data = await res.json();

      const isStructurallyEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

      // 2. Map Profile
      if (data.profile) {
          const newCredits = {
              vcc_total: data.profile.vcc_email_total || 6,
              vcc_used: data.profile.used_vcc_email || 0,
              phone_total: data.profile.phone_total || 2,
              phone_used: data.profile.used_phones || 0,
              phone_credits: data.profile.relay_credits !== undefined 
                ? data.profile.relay_credits 
                : (data.profile.phone_credits !== undefined ? data.profile.phone_credits : 500)
          };
          setCredits(prev => isStructurallyEqual(prev, newCredits) ? prev : newCredits);

          // PERMANENT PERSISTENCE SAFEGUARD: Re-hydrate Target Profile State directly from PostgreSQL
          if (data.profile && (data.profile.first_name || data.profile.last_name || data.profile.email || data.profile.address)) {
              setTargetProfile(prev => {
                  const updated = {
                      ...prev,
                      firstName: data.profile.first_name || prev.firstName || "",
                      middleName: data.profile.middle_name || prev.middleName || "",
                      nickname: data.profile.nickname || prev.nickname || "",
                      lastName: data.profile.last_name || prev.lastName || "",
                      email: data.profile.email || prev.email || "",
                      phone: data.profile.phone || prev.phone || "",
                      address: data.profile.address || prev.address || "",
                      dob: data.profile.dob || prev.dob || ""
                  };
                  return isStructurallyEqual(prev, updated) ? prev : updated;
              });
          }
          if (data.profile) {
              const isVerified = Boolean(data.profile.addy_verified || data.profile.addy_status === "VERIFIED");
              setAddyRecipientStatus(isVerified ? "VERIFIED" : "PENDING_VERIFICATION");
              if (activeUserId) {
                  setSessionItem(`disappear_addy_verified_${activeUserId}`, isVerified ? "VERIFIED" : "PENDING_VERIFICATION");
              }
          }
      }

      // 3. Map Real Purge History & Auto-Populate SMS Inbox
      if (Array.isArray(data.history)) {
        // Filter out SMS events from Live Security Audit Log (SMS shows ONLY in Incoming SMS box)
        const nonSmsHistory = data.history.filter(item => item && typeof item.action === 'string' && !item.action.toUpperCase().includes("SMS"));

        setAuditLog(prevLog => {
          if (isStructurallyEqual(prevLog, nonSmsHistory)) return prevLog;
          const latest = nonSmsHistory[0];
          const oldLatest = prevLog && prevLog.length > 0 ? prevLog[0] : null;
          if (latest && typeof latest.action === 'string' && (!oldLatest || latest.timestamp !== oldLatest.timestamp)) {
              pushNotification(`SYSTEM_UPDATE: [${latest.action}]`);
          }
          return nonSmsHistory;
        });

        // Audit log mapping complete
      }

      // 4. Map Cards
      if (data.cards) {
        setCards(prev => isStructurallyEqual(prev, data.cards) ? prev : data.cards);
      }

      // 5. Map Aliases (Emails & Phones)
      if (data.aliases) {
        const newEmails = data.aliases.filter(a => a.type === 'email');
        const newPhones = data.aliases.filter(a => a.type === 'phone');
        setEmails(prev => isStructurallyEqual(prev, newEmails) ? prev : newEmails);
        setPhones(prev => isStructurallyEqual(prev, newPhones) ? prev : newPhones);
      }

      // 6. Map Target Emails
      if (data.target_emails) {
        setTargetEmails(prev => isStructurallyEqual(prev, data.target_emails) ? prev : data.target_emails);
      }

      // 7. Map Payment Methods
      if (data.payment_methods) {
        setPaymentMethods(prev => isStructurallyEqual(prev, data.payment_methods) ? prev : data.payment_methods);
        if (data.payment_methods.length > 0 && !selectedFundingSource) {
          setSelectedFundingSource(data.payment_methods[0].id);
        }
      }

      // 8. Map Profile Phone Number (Initial load only to avoid polling overwrite)
      if (data.profile) {
        if (!hasLoadedPhone) {
          setDestinationPhone(data.profile.phone || "");
          setHasLoadedPhone(true);
        }
        if (data.profile.relay_credits !== undefined) setRelayCredits(data.profile.relay_credits);
        if (data.profile.relay_credits_total !== undefined) setRelayCreditsTotal(data.profile.relay_credits_total);
      }

      // 9. Map Referral Milestone Data
      if (data.referrals) {
        setReferralData(prev => isStructurallyEqual(prev, data.referrals) ? prev : data.referrals);
      }

      // 10. Map Live Data Broker Scrub Statistics & Registry List
      if (data.scrub_stats) {
        setScrubStats(prev => isStructurallyEqual(prev, data.scrub_stats) ? prev : data.scrub_stats);
      }
      if (Array.isArray(data.data_brokers)) {
        setDataBrokers(prev => isStructurallyEqual(prev, data.data_brokers) ? prev : data.data_brokers);
      }

      // 11. Sync Live SMS Inbox & Alias Messages
      fetchSmsInbox();
      fetchAliasMessages();
    } catch (err) { 
        console.warn("Network interrupted. Attempting silent reconnect on next cycle...");
    } finally {
        isSyncingRef.current = false;
    }
  }, [pushNotification, selectedFundingSource, hasLoadedPhone, fetchSmsInbox, fetchAliasMessages]);

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

  // --- REFERRAL LINK HANDLER & CREDENTIAL AUTOFILL ISOLATION FIREWALL ---
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref') || urlParams.get('referral_code') || urlParams.get('referral');
    if (refCode) {
      const cleanRef = refCode.trim().toUpperCase();
      const activeUser = currentUserId || getSessionItem("disappear_user_id");
      // Only clear session if visiting someone ELSE's referral link while not logged in
      if (!activeUser) {
        removeSessionItem("disappear_session");
        removeSessionItem("disappear_user_id");
      }

      // 2. Save Referral Code to BOTH localStorage & sessionStorage for full session persistence
      setSessionItem("disappear_referral_code", cleanRef);
      setSessionItem("disappear_ref_code", cleanRef);
      try {
        localStorage.setItem("disappear_referral_code", cleanRef);
        localStorage.setItem("disappear_ref_code", cleanRef);
      } catch (e) {}

      // 3. WIPE ALL INPUT STATES TO ENSURE 100% BLANK FORMS
      setLoginEmail("");
      setLoginPassword("");
      setLogin2FACode("");
      setSignupConfirmPassword("");
      setTargetProfile({
        firstName: "",
        middleName: "",
        lastName: "",
        email: "",
        password: "",
        phone: "",
        address: "",
        city: "",
        state: "",
        zip: "",
        dob: "",
        termsAccepted: false,
        smsConsentAccepted: false
      });

      // 4. ROUTE CLEANLY TO SIGNUP / PRICING VIEW
      setShowShield(false);
      setShow2FA(false);
      setShowLanding(false);
      setShowPricing(true);
      window.location.hash = "pricing";
    }
  }, []);

  // --- HASH ROUTING & POPSTATE BROWSER NAVIGATION CONTROLLER ---
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
        const activeSession = getSessionItem("disappear_session") === "active";
        setShowLegal(null);
        setShowAdmin(false);
        setShowAdminLogin(false);
        setShowPricing(false);
        setShow2FA(false);
        setShowCheckout(false);
        setShowKycModal(false);
        setShowSupportModal(false);
        setShowForgotPasswordModal(false);
        setShowFaqModal(false);
        if (activeSession) {
          setShowLanding(false);
          setShowShield(true);
        } else {
          setShowLanding(true);
          setShowShield(false);
        }
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
    };
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
    const query = new URLSearchParams(window.location.search);
    const isNative = Capacitor.isNativePlatform();

    let refCode = query.get("ref");
    if (!refCode && window.location.hash.includes("ref=")) {
      try {
        const hashQuery = window.location.hash.includes("?") ? window.location.hash.split("?")[1] : "";
        const hashParams = new URLSearchParams(hashQuery);
        refCode = hashParams.get("ref");
      } catch (e) {}
    }
    if (refCode) {
      const cleanRef = refCode.trim();
      setSessionItem("disappear_ref_code", cleanRef);
      setSessionItem("disappear_referral_code", cleanRef);
    }

    const now = Date.now();
    let isExpired = false;

    // Check both sessionStorage and localStorage for active persistent session
    let session = getSessionItem("disappear_session");
    let savedUid = getSessionItem("disappear_user_id") || getSessionItem("disappear_user_email") || "";

    // Auto-restore active session if persistent user ID or email exists
    if (savedUid && savedUid !== "undefined" && savedUid.length > 3) {
      session = "active";
    }

    // --- DIRECT POST-PAYMENT ROUTING GUARANTEE ---
    const queryPayment = query.get("payment");
    const querySetup = query.get("setup");
    const queryUid = query.get("user_id");

    if (queryPayment === "success" || querySetup === "success") {
      const activeUid = queryUid || savedUid || getSessionItem("disappear_user_id") || getSessionItem("disappear_user_email");
      if (activeUid && activeUid !== "undefined") {
        setSessionItem("disappear_session", "active");
        setSessionItem("disappear_last_active", now.toString());
        setSessionItem("disappear_user_id", activeUid);
        setCurrentUserId(activeUid);
        setShowLanding(false);
        setShowPricing(false);
        setShowCheckout(false);
        setShowShield(true);
        setProgress(100);
        
        triggerToast("⚡ PAYMENT AUTHORIZED — WELCOME TO YOUR ACTIVE DISAPPEAR SHIELD VAULT");
        window.history.replaceState({}, document.title, window.location.pathname);
        syncDefenseData(activeUid);
        return;
      }
    }

    if (querySetup === "success") {
      triggerToast("FUNDING SOURCE LINKED SUCCESSFULLY");
      window.history.replaceState({}, document.title, window.location.pathname);
      syncDefenseData();
      return;
    }

    // PERSISTENT SESSION VALIDATION ON MOUNT:
    // Automatically restore vault if persistent session or saved user ID exists
    if (session === "active" && !isExpired && savedUid && savedUid !== "undefined" && savedUid.length > 3) {
      setSessionItem("disappear_last_active", now.toString());
      setSessionItem("disappear_session", "active");
      setSessionItem("disappear_user_id", savedUid);
      setCurrentUserId(savedUid);
      setShowLanding(false);
      setShowPricing(false);
      setShowCheckout(false);
      setShowShield(true);
      setProgress(100);
      syncDefenseData(savedUid);
    } else {
      // DEFAULT TO PUBLIC LANDING PAGE ONLY WHEN NO USER CREDENTIALS EXIST AND NO ROUTE HASH IS PRESENT
      setCurrentUserId(null);
      const initialHash = window.location.hash;
      if (!initialHash || initialHash === '#' || initialHash === '') {
        setShowLanding(true);
        setShowShield(false);
        setShowPricing(false);
        setShowCheckout(false);
        setShow2FA(false);
      }
    }
  }, []);



  const handleSaveForwardingPhone = async () => {
    let activeUserId = currentUserId || getSessionItem("disappear_user_id");
    if (!activeUserId) return;

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


  const handleDeleteSmsMessage = async (id, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!id) return;
    try {
      setSmsInbox(prev => prev.filter(m => String(m.id) !== String(id)));
      triggerToast("🗑️ SMS DELETED FROM VAULT");
      await secureRequest(`${API_BASE_URL}/api/v1/sms-inbox/${id}`, { method: "DELETE" });
      fetchSmsInbox();
    } catch (err) {
      console.error("Error deleting SMS:", err);
    }
  };

  const getAliasLabel = (phoneNum) => {
    if (!phoneNum) return "";
    const cleanNum = phoneNum.replace(/\D/g, "");
    if (!cleanNum) return "";

    const phoneObj = (phones || []).find(p => {
      const num = (p.content || p.number || p || "").replace(/\D/g, "");
      return num && (num === cleanNum || cleanNum.endsWith(num) || num.endsWith(cleanNum));
    });
    if (phoneObj && phoneObj.label) return ` [${phoneObj.label}]`;

    return "";
  };

  const cleanMessageContent = (rawMsg) => {
    if (!rawMsg) return "";
    let clean = String(rawMsg);
    // Strip audit log prefixes like "SMS_RECEIVED [From ...]:" or "OUTBOUND [From ... To ...]:"
    clean = clean.replace(/^(?:SMS_RECEIVED|OUTBOUND|SMS_SENT|SMS_FORWARDED)\s*\[[^\]]+\]:\s*/i, "");
    // Strip redundant leading [Disappear] branding tags if present
    clean = clean.replace(/^(?:\[Disappear\]\s*)+/i, "");
    return clean.trim();
  };

  const sanitizePhoneAlias = (phoneStr) => {
    if (!phoneStr) return "";
    const str = String(phoneStr).trim();
    if (str.includes("***") || (str.includes("813") && str.includes("***"))) {
      const last4 = str.replace(/\D/g, "").slice(-4);
      const matchedUserAlias = (phones || []).find(p => {
        const pNum = (p.content || p.number || p || "").replace(/\D/g, "");
        return pNum && last4 && pNum.endsWith(last4);
      });
      if (matchedUserAlias) {
        const val = matchedUserAlias.content || matchedUserAlias.number || matchedUserAlias;
        return val.startsWith("+") ? val : `+1${val.replace(/\D/g, "")}`;
      }
      const firstAlias = (phones || [])[0];
      if (firstAlias) {
        const val = firstAlias.content || firstAlias.number || firstAlias;
        return val.startsWith("+") ? val : `+1${val.replace(/\D/g, "")}`;
      }
      return "";
    }
    return str;
  };

  const handleSendSmsReply = async (targetTo, bodyText, fromPhoneOverride) => {
    const rawTo = (typeof targetTo === 'string' && targetTo ? targetTo : replyRecipient || "").trim();
    const body = (typeof bodyText === 'string' && bodyText ? bodyText : replyBody || "").trim();
    const senderFrom = (typeof fromPhoneOverride === 'string' && fromPhoneOverride ? fromPhoneOverride : selectedSenderAlias || "").trim();

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

    // Validation passed: Reset form state and show progress toast
    setReplyBody("");
    setReplyRecipient("");
    setActiveReplyId(null);
    setShowComposeSms(false);

    const formattedTo = digitsOnly.length === 10 ? `+1${digitsOnly}` : `+${digitsOnly}`;
    triggerToast(`⏳ DISPATCHING SMS TO ${formattedTo}...`);

    const activeUserId = currentUserId 
      || getSessionItem("disappear_user_id") 
      || getSessionItem("user_id") 
      || (typeof localStorage !== "undefined" ? (localStorage.getItem("disappear_user_id") || localStorage.getItem("user_id")) : "") 
      || "ANONYMOUS_USER";

    if (!activeUserId) {
      triggerToast("⚠️ PLEASE SIGN IN TO SEND SMS");
      setIsSendingSms(false);
      return;
    }

    const digitsSender = senderFrom ? senderFrom.replace(/\D/g, "") : "";
    const cleanSenderFrom = digitsSender ? (digitsSender.length === 10 ? `+1${digitsSender}` : `+${digitsSender}`) : null;

    const smsPayload = {
      user_id: activeUserId,
      to_phone: formattedTo,
      message: body,
      from_phone: cleanSenderFrom
    };

    console.log("📱 MOBILE_SMS_DISPATCH_INITIATED:", {
      url: `${API_BASE_URL}/api/v1/send-sms`,
      payload: smsPayload,
      isCapacitor: typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.()
    });

    try {
      const res = await secureRequest(`${API_BASE_URL}/api/v1/send-sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(smsPayload)
      });
      const data = await res.json().catch(() => ({ detail: `HTTP ${res.status} Response Parse Error` }));
      if (res.ok) {
        const actualSender = data.from_phone || senderFrom || "+15855802036";
        console.log("✅ MOBILE_SMS_DISPATCH_SUCCESS:", data);
        triggerToast(`✅ SMS DELIVERED! (From: ${actualSender} ➔ To: ${formattedTo})`);
        
        const newOutboundItem = {
          id: `out_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          message: `OUTBOUND [From ${actualSender} To ${formattedTo}]: ${body}`,
          from_phone: actualSender,
          to_phone: formattedTo,
          line: "OUTBOUND_SMS"
        };
        setSmsInbox(prev => [newOutboundItem, ...prev]);
        fetchSmsInbox();
        syncDefenseData();
      } else {
        console.error("❌ MOBILE_SMS_DISPATCH_FAILED:", res.status, data);
        triggerToast(`❌ ${data.detail || `FAILED TO DELIVER SMS (${res.status})`}`);
      }
    } catch (e) {
      console.error("❌ MOBILE_SMS_DISPATCH_EXCEPTION:", e);
      triggerToast(`NETWORK ERROR SENDING SMS: ${e.message || "Connection refused"}`);
    } finally {
      setIsSendingSms(false);
    }
  };

  const handleSendResetCode = async (emailTarget) => {
    const targetEmail = emailTarget || forgotEmail;
    if (!targetEmail || !targetEmail.trim()) {
      triggerToast("⚠️ PLEASE ENTER YOUR REGISTERED ACCOUNT EMAIL");
      return;
    }
    setIsSendingResetCode(true);
    triggerToast("SENDING 6-DIGIT VERIFICATION CODE VIA SMS...");
    try {
      const res = await secureRequest(`${API_BASE_URL}/auth/send-reset-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setIsResetCodeSent(true);
        triggerToast("📱 6-DIGIT VERIFICATION CODE TEXTED TO YOUR PHONE!");
      } else {
        triggerToast(`❌ ${data.detail || "FAILED TO SEND SMS CODE"}`);
      }
    } catch (err) {
      triggerToast("NETWORK ERROR SENDING SMS CODE");
    } finally {
      setIsSendingResetCode(false);
    }
  };

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!forgotEmail.trim() || !forgotCode.trim() || !forgotNewPassword) {
      triggerToast("ENTER YOUR EMAIL, 6-DIGIT SMS CODE, & NEW PASSWORD");
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      triggerToast("PASSWORDS DO NOT MATCH");
      return;
    }
    if (forgotNewPassword.length < 6) {
      triggerToast("PASSWORD MUST BE AT LEAST 6 CHARACTERS");
      return;
    }
    setIsResettingPassword(true);
    triggerToast("VERIFYING SMS CODE & RESETTING PASSWORD...");
    try {
      const res = await secureRequest(`${API_BASE_URL}/auth/verify-reset-code-and-change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim(), code: forgotCode.trim(), new_password: forgotNewPassword })
      });
      const data = await res.json();
      if (res.ok) {
        triggerToast("✅ CODE VERIFIED! PASSWORD UPDATED & SMS ALERT SENT");
        setLoginEmail(forgotEmail);
        setLoginPassword(forgotNewPassword);
        setShowForgotPasswordModal(false);
        setForgotCode("");
        setForgotNewPassword("");
        setForgotConfirmPassword("");
        setIsResetCodeSent(false);
        verify2FA();
      } else {
        triggerToast(`❌ ${data.detail || "INVALID OR EXPIRED VERIFICATION CODE"}`);
      }
    } catch (err) {
      triggerToast("NETWORK ERROR RESETTING PASSWORD");
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleChangePasswordInProfile = async (e) => {
    e.preventDefault();
    if (forgotCode && forgotCode.trim()) {
      return handleForgotPasswordSubmit(e);
    }
    if (!newPasswordInput) {
      triggerToast("PLEASE ENTER YOUR NEW PASSWORD");
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      triggerToast("NEW PASSWORDS DO NOT MATCH");
      return;
    }
    if (newPasswordInput.length < 6) {
      triggerToast("NEW PASSWORD MUST BE AT LEAST 6 CHARACTERS");
      return;
    }
    setIsUpdatingPassword(true);
    triggerToast("UPDATING VAULT PASSWORD...");
    try {
      const activeUserId = currentUserId || getSessionItem("disappear_user_id");
      if (!activeUserId) {
        triggerToast("⚠️ PLEASE SIGN IN FIRST");
        setIsUpdatingPassword(false);
        return;
      }
      const res = await secureRequest(`${API_BASE_URL}/api/v1/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: activeUserId,
          current_password: currentPasswordInput || "",
          new_password: newPasswordInput
        })
      });
      const data = await res.json();
      if (res.ok) {
        triggerToast("✅ PASSWORD UPDATED SUCCESSFULLY!");
        setCurrentPasswordInput("");
        setNewPasswordInput("");
        setConfirmPasswordInput("");
        setForgotCode("");
      } else {
        triggerToast(`❌ ${data.detail || "INCORRECT CURRENT PASSWORD OR INVALID VERIFICATION CODE"}`);
      }
    } catch (err) {
      triggerToast("NETWORK ERROR UPDATING PASSWORD");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const clearAllUserDataState = useCallback(() => {
    setCurrentUserId(null);
    setSmsInbox([]);
    setPhones([]);
    setEmails([]);
    setCards([]);
    setAuditLog([]);
    setPaymentMethods([]);
    setTargetEmails({ primary: "", additional: [], slots: 1, used: 0 });
    setReferralData({
      code: "",
      link: "",
      count: 0,
      next_milestone_needed: 5,
      progress_pct: 0,
      free_months_earned: 0,
      free_months_redeemed: 0
    });
    setTargetProfile({
      firstName: "",
      middleName: "",
      lastName: "",
      email: "",
      password: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      zip: "",
      dob: "",
      termsAccepted: false,
      smsConsentAccepted: false
    });
  }, []);

  const handleSecureLogout = () => {
    clearSessionStorage();
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem("disappear_user_id");
        localStorage.removeItem("disappear_session");
        localStorage.removeItem("disappear_user_email");
        localStorage.removeItem("disappear_last_active");
        localStorage.removeItem("user_id");
      }
    } catch (e) {}
    clearAllUserDataState();
    setCurrentUserId("");

    // Unconditionally kill all active spinners, loaders, and action flags
    setIsScanning(false);
    setIsGenerating(false);
    setIsEncrypting(false);
    setIsMinting(false);
    setIsProcessingPayment(false);
    setIsRefillingCredits(false);
    setIsSendingSms(false);
    setIsSendingAliasReply(false);
    setIsCheckingAddyStatus(false);
    setIsRefreshingAliasData(false);

    // Unconditionally route to Sign-In Screen (show2FA)
    setShowShield(false);
    setShowAdmin(false);
    setShowAdminLogin(false);
    setShowCheckout(false);
    setShowPricing(false);
    setShowLegal(null);
    setShowLanding(false);
    setShow2FA(true);
    
    try {
      window.location.hash = "login";
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    } catch (e) {}

    triggerToast("🚪 SESSION EXPIRED / LOGOUT COMPLETE");
  };

  const handleLogout = handleSecureLogout;

  useEffect(() => {
    const handleUnauthorizedEvent = () => {
      console.warn("🔒 UNCONDITIONAL AUTH INTERCEPT: 401/403 Unauthorized detected. Redirecting to Sign-In.");
      handleSecureLogout();
    };
    window.addEventListener("disappear_unauthorized_event", handleUnauthorizedEvent);
    return () => window.removeEventListener("disappear_unauthorized_event", handleUnauthorizedEvent);
  }, [handleSecureLogout]);

  const handleRefillCredits = async () => {
    setIsRefillingCredits(true);
    triggerToast("⏳ INITIALIZING RELAY CREDIT REFILL...");
    try {
      const activeUserId = currentUserId || getSessionItem("disappear_user_id");
      if (!activeUserId) {
        triggerToast("⚠️ PLEASE SIGN IN FIRST");
        setIsRefillingCredits(false);
        return;
      }
      const res = await secureRequest(`${API_BASE_URL}/payments/create-refill-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: activeUserId, pack_type: "250_credits" })
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        triggerToast(`❌ ${data.detail || "FAILED TO INITIALIZE REFILL SESSION"}`);
      }
    } catch (err) {
      triggerToast("NETWORK ERROR INITIALIZING REFILL");
    } finally {
      setIsRefillingCredits(false);
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
    const activeUserId = currentUserId || getSessionItem("disappear_user_id") || "anonymous_agent";

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
    const activeUserId = currentUserId || getSessionItem("disappear_user_id") || "";
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
    const activeUserId = currentUserId || getSessionItem("disappear_user_id") || "UNAUTHENTICATED";
    const userEmail = (supportData.email || targetProfile.email || getSessionItem("disappear_user_email") || "").trim();

    if (!userEmail || !userEmail.includes("@")) {
      triggerToast("⚠️ PLEASE ENTER A VALID RETURN EMAIL ADDRESS");
      return;
    }
    if (!supportData.message || !supportData.message.trim()) { 
      triggerToast("⚠️ PLEASE ENTER A DETAILED INQUIRY DESCRIPTION"); 
      return; 
    }
    try {
        const payload = {
          category: supportData.category || "GENERAL_INQUIRY",
          subject: supportData.subject || supportData.category || "TECHNICAL_INQUIRY",
          message: supportData.message.trim(),
          user_id: activeUserId,
          email: userEmail.toLowerCase()
        };

        const res = await secureRequest(`${API_BASE_URL}/support/ticket?user_id=${activeUserId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
            triggerToast("✅ TICKET TRANSMITTED TO CUSTOMER SERVICE");
            setSupportData({ category: "GENERAL_INQUIRY", subject: "GENERAL_INQUIRY", email: userEmail, message: "" });
            setShowSupportModal(false);
        } else {
            console.error("SUPPORT_TICKET_API_ERROR:", data);
            const errDetail = typeof data.detail === 'string' ? data.detail : (Array.isArray(data.detail) ? data.detail[0]?.msg : "FAILED TO TRANSMIT SUPPORT TICKET");
            triggerToast(`❌ ${errDetail}`);
        }
    } catch (err) { 
        console.error("SUPPORT_TICKET_NETWORK_ERROR:", err);
        triggerToast("❌ NETWORK ERROR: COULD NOT TRANSMIT TICKET"); 
    }
  };

  const checkAddyRecipientStatus = async (showToastNotice = false) => {
    const activeUserId = currentUserId || getSessionItem("disappear_user_id");
    if (!activeUserId) return;
    setIsCheckingAddyStatus(true);
    try {
      const res = await secureRequest(`${API_BASE_URL}/aliases/recipient-status?user_id=${activeUserId}`);
      if (res.ok) {
        const data = await res.json();
        const isVerified = Boolean(data.verified || data.status === "VERIFIED");
        if (isVerified) {
          setAddyRecipientStatus("VERIFIED");
          setSessionItem(`disappear_addy_verified_${activeUserId}`, "VERIFIED");
          try { localStorage.setItem(`disappear_addy_verified_${activeUserId}`, "VERIFIED"); } catch(e){}
        } else if (addyRecipientStatus !== "VERIFIED") {
          setAddyRecipientStatus("PENDING_VERIFICATION");
        }
        if (data.email) setAddyRecipientEmail(data.email);
        
        if (showToastNotice) {
          if (isVerified) {
            triggerToast("✅ VERIFIED: EMAIL ALIAS FORWARDING UNLOCKED!");
          } else {
            triggerToast("⚠️ VERIFICATION PENDING: CHECK INBOX FOR ADDY.IO EMAIL");
          }
        }
      }
    } catch (err) {
      console.error("Failed checking Addy recipient status:", err);
      if (showToastNotice) {
        triggerToast("❌ COULD NOT CONNECT TO VERIFICATION SERVER");
      }
    } finally {
      setIsCheckingAddyStatus(false);
    }
  };

  const handleResendAddyVerification = async () => {
    const activeUserId = currentUserId || getSessionItem("disappear_user_id");
    if (!activeUserId) {
      triggerToast("⚠️ PLEASE REGISTER / LOGIN TO RESEND VERIFICATION");
      return;
    }
    setIsResendingAddyVerification(true);
    triggerToast("⏳ DISPATCHING FRESH VERIFICATION LINK...");
    try {
      const res = await secureRequest(`${API_BASE_URL}/aliases/resend-recipient-verification?user_id=${activeUserId}`, {
        method: "POST"
      });
      const data = await res.json();
      if (res.ok) {
        triggerToast("Verification email resent!");
        checkAddyRecipientStatus(false);
      } else {
        const errMsg = typeof data.detail === 'string' ? data.detail : "FAILED TO RESEND VERIFICATION EMAIL";
        if (data.status === "ALREADY_VERIFIED") {
          setAddyRecipientStatus("VERIFIED");
          triggerToast("✅ EMAIL IS ALREADY VERIFIED & ACTIVE!");
        } else {
          triggerToast(`❌ ${errMsg}`);
        }
      }
    } catch (err) {
      triggerToast("❌ NETWORK ERROR RESENDING VERIFICATION");
    } finally {
      setIsResendingAddyVerification(false);
    }
  };

  const handleMintAlias = async (type = 'email') => {
    if (!aliasLabel) { triggerToast("ENTER LABEL"); return; }
    
    setPurgeStatus(`ENCRYPTING ${type.toUpperCase()}...`);
    setIsEncrypting(true); 
    try {
      const activeUserId = currentUserId || getSessionItem("disappear_user_id") || "";
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

  const promptKillAlias = (aliasObj) => {
    if (!aliasObj) return;
    setAliasToTerminate(aliasObj);
    setShowTerminateAliasModal(true);
  };

  const confirmKillAlias = async () => {
    if (!aliasToTerminate || !aliasToTerminate.id) return;
    const targetId = aliasToTerminate.id;
    setShowTerminateAliasModal(false);
    setAliasToTerminate(null);
    try {
      triggerToast("⏳ TERMINATING ALIAS NODE...");
      await secureRequest(`${API_BASE_URL}/aliases/kill/${targetId}`, { method: "DELETE" });
      syncDefenseData();
      triggerToast("🗑️ ALIAS NODE PERMANENTLY TERMINATED");
    } catch (err) {
      triggerToast("❌ FAILED TO TERMINATE ALIAS NODE");
    }
  };

  const handleKillAlias = async (id) => {
    const aliasObj = [...(emails || []), ...(phones || [])].find(a => String(a.id) === String(id)) || { id };
    promptKillAlias(aliasObj);
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
            clearSessionStorage();
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
      const activeUserId = currentUserId || getSessionItem("disappear_user_id") || "";
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
      const activeUserId = currentUserId || getSessionItem("disappear_user_id") || "";
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
    const emailToUse = loginEmail ? loginEmail.trim() : "";
    const passwordToUse = loginPassword || "";
    if (!emailToUse || !passwordToUse) {
      triggerToast("❌ PLEASE ENTER YOUR EMAIL AND PASSWORD");
      return;
    }
    triggerToast("AUTHENTICATING...");
    try {
      const savedRefCode = getSessionItem("disappear_referral_code");
      const res = await secureRequest(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToUse, password: passwordToUse, referral_code: savedRefCode })
      });
      if (res.ok) {
        const data = await res.json();
        clearAllUserDataState();
        setSessionItem("disappear_session", "active");
        if (data.user_id) {
          setSessionItem("disappear_user_id", data.user_id);
          setSessionItem("disappear_user_email", data.email || emailToUse);
          setCurrentUserId(data.user_id);
          enableBiometricLogin(data.user_id, data.email || emailToUse);
        }
        window.location.hash = "vault";
        setShow2FA(false); 
        setShowLanding(false);
        setShowShield(true); 
        setProgress(100);
        checkAndShowNoticeModal(data.user_id);
        triggerToast(`WELCOME BACK, ${(data.first_name || 'OPERATIVE').toUpperCase()}`);
        syncDefenseData(data.user_id);
      } else {
        const data = await res.json().catch(() => ({}));
        triggerToast(`❌ ${data.detail || "INVALID LOGIN CREDENTIALS"}`);
      }
    } catch (err) {
      triggerToast("NETWORK ERROR DURING AUTHENTICATION");
    }
  };

  const handleBiometricLogin = async () => {
    try {
      const bioCreds = getBiometricCredentials();
      const storedUserId = currentUserId || bioCreds?.uid || getSessionItem("disappear_user_id");

      if (!storedUserId && !loginEmail) {
        triggerToast("ENTER REGISTERED EMAIL & PASSWORD FIRST TO LINK BIOMETRICS");
        return;
      }

      const verified = await promptBiometricAuth("Authenticate to unlock Disappear Vault");
      if (verified) {
        const targetUid = storedUserId || bioCreds?.uid;
        if (targetUid) {
          setSessionItem("disappear_session", "active");
          setSessionItem("disappear_user_id", targetUid);
          setSessionItem("disappear_last_active", Date.now().toString());
          setCurrentUserId(targetUid);
          setShow2FA(false); 
          setShowLanding(false);
          setShowShield(true); 
          setProgress(100);
          checkAndShowNoticeModal(targetUid);
          triggerToast("BIOMETRICS VERIFIED — VAULT UNLOCKED");
          syncDefenseData();
          return;
        }
        if (loginEmail && loginPassword) {
          return verify2FA();
        }
      }
    } catch (err) {
      console.warn("Biometric auth error/cancelled:", err);
      triggerToast("BIOMETRIC AUTH CANCELLED OR FAILED — PLEASE ENTER PASSWORD");
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
      agent_id: currentUserId || getSessionItem("disappear_user_id") || "AGENT_UNKNOWN",
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
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF();
      const agentId = currentUserId || getSessionItem("disappear_user_id") || "AGENT_UNKNOWN";
      
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
    if (isMinting) return;

    // Detailed Validation: Check specific missing fields and inform user
    const missing = [];
    if (!targetProfile.firstName) missing.push("First Name");
    if (!targetProfile.lastName) missing.push("Last Name");
    if (!targetProfile.email) missing.push("Email Address");
    if (!targetProfile.password) missing.push("Password");
    if (!signupConfirmPassword) missing.push("Confirm Password");
    if (!targetProfile.phone) missing.push("Phone Number");
    if (!targetProfile.address) missing.push("Street Address");
    if (!targetProfile.city) missing.push("City");
    if (!targetProfile.state) missing.push("State");
    if (!targetProfile.zip) missing.push("ZIP Code");

    if (missing.length > 0) {
      triggerToast(`⚠️ PLEASE COMPLETE: ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? "..." : ""}`);
      return;
    }

    if (targetProfile.password !== signupConfirmPassword) {
      triggerToast("⚠️ PASSWORDS DO NOT MATCH! PLEASE VERIFY BOTH PASSWORD FIELDS");
      return;
    }

    if (!targetProfile.termsAccepted) {
      triggerToast("⚠️ PLEASE CHECK 'Authorize Full PII Scrub and Burn' BOX");
      return;
    }

    if (!targetProfile.smsConsentAccepted) {
      triggerToast("⚠️ PLEASE CHECK THE SMS NOTIFICATIONS CONSENT BOX");
      return;
    }

    setIsMinting(true);
    try {
        let storedRefCode = getSessionItem("disappear_ref_code") || getSessionItem("disappear_referral_code");
        if (!storedRefCode) {
          try { storedRefCode = localStorage.getItem("disappear_ref_code") || ""; } catch (e) {}
        }
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
        
        let activeUserId = currentUserId || getSessionItem("disappear_user_id");
        if (profileRes.ok) {
            const profileData = await profileRes.json();
            
            // PREVENT SAVING 'undefined' if error was returned
            if (profileData.status === "error" || !profileData.profile_id) {
                triggerToast("PROFILE REGISTRATION FAILED");
                setIsMinting(false);
                return;
            }
            activeUserId = profileData.profile_id;
            setSessionItem("disappear_user_id", activeUserId);
            clearAllUserDataState();
            setCurrentUserId(activeUserId);
            setShowOnboardingWelcomeModal(true);
            triggerToast("PROFILE CREATED — CHECK EMAIL & PHONE VERIFICATION");
            
            triggerToast("AUTHORIZING SECURE PAYMENT NODE...");
            try {
                const stripeRes = await secureRequest(`${API_BASE_URL}/payments/create-session`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ 
                        expansion_type: "subscription_" + billingCycle,
                        user_id: activeUserId,
                        referred_by: storedRefCode,
                        coupon_code: appliedCoupon ? appliedCoupon.code : (couponInput ? couponInput.trim() : ""),
                        return_url: window.location.origin
                    })
                });
                if (stripeRes.ok) {
                    const stripeData = await stripeRes.json();
                    if (stripeData.url) {
                        window.location.href = stripeData.url;
                    } else {
                        triggerToast("PAYMENT SESSION INITIALIZATION FAILED");
                    }
                } else {
                    const errData = await stripeRes.json().catch(() => ({}));
                    triggerToast(`PAYMENT ERROR: ${errData.detail || "CHECKOUT FAILED"}`);
                }
            } catch (err) {
                triggerToast("NETWORK ERROR DURING PAYMENT HANDSHAKE");
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
    const activeUserId = currentUserId || getSessionItem("disappear_user_id") || "";
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

  if (showLanding && !showLegal && !showPricing && !showCheckout && !showAdmin && !show2FA && !showShield) {
    return (
      <div style={{ width: '100%', minHeight: '100vh', position: 'relative', background: '#000000', paddingBottom: '70px' }}>
        {/* FLOATING AI PRIVACY ASSISTANT CHAT WIDGET */}
        <PrivacyAiChat apiBaseUrl={API_BASE_URL} />
        
        <LandingPage 
          onEnterVault={() => {
            setShowLanding(false);
            setShowPricing(true);
            setShow2FA(false);
            setShowShield(false);
            setShowLegal(null);
            window.location.hash = "pricing";
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }} 
          onLoginRequest={() => {
            setShowLanding(false);
            setShow2FA(true);
            setShowPricing(false);
            setShowShield(false);
            setShowLegal(null);
            window.location.hash = "login";
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onReadManifesto={() => window.location.hash = "manifesto"}
        />

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

        {/* GLOBAL ENCRYPTION & PURGE OVERLAY */}
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

  return (
    <div className={`app-container ${isEmergencyWipe ? 'wipe-shake' : ''}`}>
      {/* FLOATING AI PRIVACY ASSISTANT CHAT WIDGET */}
      <PrivacyAiChat apiBaseUrl={API_BASE_URL} />
      
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
                
                {showEmailModal && addyRecipientStatus === "PENDING_VERIFICATION" && (
                  <div style={{
                    fontSize: '0.82rem',
                    color: '#F59E0B',
                    background: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.5)',
                    padding: '14px',
                    borderRadius: '10px',
                    marginBottom: '18px',
                    textAlign: 'left',
                    lineHeight: '1.45'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', fontWeight: 'bold', color: '#FCD34D', fontSize: '0.9rem' }}>
                      ⚠️ EMAIL VERIFICATION REQUIRED FROM ADDY.IO
                    </div>
                    <p style={{ margin: '0 0 10px 0', color: '#E2E8F0', fontSize: '0.8rem' }}>
                      Your destination email <strong>{addyRecipientEmail || "on file"}</strong> has not verified Addy.io forwarding permissions yet. Please check your inbox & Spam/Junk folder for an email from <code>noreply@addy.io</code> and click <em>Verify Email Address</em>.
                    </p>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button 
                        type="button" 
                        className="main-button" 
                        style={{ padding: '6px 12px', fontSize: '0.72rem', background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}
                        onClick={handleResendAddyVerification}
                        disabled={isResendingAddyVerification}
                      >
                        {isResendingAddyVerification ? "SENDING..." : "📩 RESEND VERIFICATION EMAIL"}
                      </button>
                      <button 
                        type="button" 
                        className="reset-btn" 
                        style={{ padding: '6px 12px', fontSize: '0.72rem', borderColor: '#F59E0B', color: '#FCD34D' }}
                        onClick={() => checkAddyRecipientStatus(true)}
                        disabled={isCheckingAddyStatus}
                      >
                        {isCheckingAddyStatus ? "CHECKING..." : "🔄 RE-CHECK STATUS"}
                      </button>
                    </div>
                  </div>
                )}

                {showEmailModal && (
                  <div style={{ fontSize: '0.75rem', color: '#00D2FF', background: 'rgba(0, 71, 171, 0.2)', border: '1px solid rgba(0, 210, 255, 0.3)', padding: '10px 12px', borderRadius: '8px', marginBottom: '15px', textAlign: 'left', lineHeight: '1.4' }}>
                    💡 <strong>VERIFICATION NOTE:</strong> Clicking your email verification link authorizes forwarding. If prompted on the verification page, <u>you do not need to log into Addy.io</u>—simply close that tab and return to Disappear!
                  </div>
                )}
                
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

                      <form onSubmit={(e) => { e.preventDefault(); handleSendTicket(); }} autoComplete="on" style={{ marginTop: '25px', display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
                        <div>
                          <p className="field-label" style={{ marginBottom: '4px' }}>YOUR EMAIL ADDRESS (FOR REPLY)</p>
                          <input
                            type="email"
                            name="disappear_legal_support_reply_email"
                            id="disappear_legal_support_reply_email"
                            autoComplete="email"
                            className="mask-btn"
                            style={{ width: '100%', color: 'white', fontSize: '0.85rem', boxSizing: 'border-box' }}
                            placeholder="customer@email.com"
                            value={supportData.email !== undefined ? supportData.email : (targetProfile.email || getSessionItem("disappear_user_email") || "")}
                            onChange={(e) => setSupportData({...supportData, email: e.target.value})}
                            required
                          />
                        </div>

                        <div>
                          <p className="field-label" style={{ marginBottom: '4px' }}>ISSUE CATEGORY</p>
                          <select className="mask-btn" style={{width: '100%', background: '#000', color: 'white', fontSize: '0.85rem', boxSizing: 'border-box'}} value={supportData.category || "GENERAL_INQUIRY"} onChange={(e) => setSupportData({...supportData, category: e.target.value, subject: e.target.value})}>
                            <option value="GENERAL_INQUIRY">GENERAL INQUIRY / ASSISTANCE</option>
                            <option value="PAYMENT_ERR">BILLING & PAYMENT ISSUE</option>
                            <option value="NODE_ERR">DATA BROKER OPT-OUT FAILURE</option>
                            <option value="PURGE_ERR">ALIAS / FORWARDING ISSUE</option>
                            <option value="OTHER">OTHER INQUIRY</option>
                          </select>
                        </div>

                        <div>
                          <p className="field-label" style={{ marginBottom: '4px' }}>INQUIRY / ANOMALY DESCRIPTION</p>
                          <textarea className="mask-btn" style={{width: '100%', height: '120px', color: 'white', textAlign: 'left', paddingTop: '10px', fontSize: '0.85rem', boxSizing: 'border-box'}} placeholder="Describe your request or question in detail..." value={supportData.message} onChange={(e) => setSupportData({...supportData, message: e.target.value})} required />
                        </div>

                        <button type="submit" className="main-button" style={{width: '100%', marginTop: '10px'}}>⚡ TRANSMIT SUPPORT TICKET</button>
                      </form>

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
              <div className="shield-container fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', width: '100%', maxWidth: '720px', margin: '0 auto' }}>
                
                {/* PROMINENT TOP DASHBOARD HEADER & DISCONNECT BUTTON */}
                <div 
                  className="top-vault-header" 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    width: '100%', 
                    padding: '12px 18px', 
                    background: '#05070D', 
                    border: '1px solid rgba(0, 210, 255, 0.3)', 
                    borderRadius: '10px', 
                    boxSizing: 'border-box', 
                    flexWrap: 'wrap', 
                    gap: '10px' 
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.2rem' }}>🛡️</span>
                    <div style={{ textAlign: 'left' }}>
                      <span className="tiger-text" style={{ fontSize: '0.95rem', display: 'block', letterSpacing: '1px' }}>DISAPPEAR VAULT</span>
                      <span style={{ fontSize: '0.72rem', color: '#10B981', fontWeight: 'bold', fontFamily: 'monospace' }}>● ENCRYPTED SESSION</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ background: 'rgba(0, 210, 255, 0.1)', border: '1px solid rgba(0, 210, 255, 0.3)', padding: '4px 10px', borderRadius: '6px', fontSize: '0.78rem', color: '#00D2FF', fontWeight: 'bold' }}>
                      ⚡ CREDITS: {credits.phone_credits !== undefined ? credits.phone_credits : 500}
                    </div>
                    <button 
                      type="button"
                      className="reset-btn" 
                      style={{ 
                        background: 'rgba(239, 68, 68, 0.15)', 
                        borderColor: '#EF4444', 
                        color: '#EF4444', 
                        fontWeight: 'bold', 
                        padding: '6px 14px', 
                        fontSize: '0.78rem', 
                        borderRadius: '6px',
                        cursor: 'pointer',
                        boxShadow: '0 0 10px rgba(239, 68, 68, 0.3)'
                      }} 
                      onClick={handleSecureLogout}
                    >
                      🚪 LOGOUT
                    </button>
                  </div>
                </div>

                {/* FLOATING NAVIGATION TABS */}
                <div 
                  className="floating-tabs-nav" 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    gap: '4px', 
                    width: '100%',
                    maxWidth: '100%', 
                    padding: '6px 4px', 
                    background: 'rgba(5, 7, 13, 0.95)', 
                    border: '1px solid rgba(0, 210, 255, 0.3)', 
                    borderRadius: '12px', 
                    backdropFilter: 'blur(10px)', 
                    boxShadow: '0 8px 25px rgba(0, 0, 0, 0.6)', 
                    flexWrap: 'wrap', 
                    boxSizing: 'border-box',
                    position: 'sticky',
                    top: '10px',
                    zIndex: 100,
                    overflowX: 'auto',
                    WebkitOverflowScrolling: 'touch'
                  }}
                >
                  <button 
                    type="button" 
                    style={{ 
                      flex: '1 1 110px', 
                      padding: '8px 12px', 
                      fontSize: '0.80rem', 
                      fontWeight: 'bold', 
                      borderRadius: '8px', 
                      border: dashboardTab === 'aliases' ? '1px solid #00D2FF' : '1px solid transparent', 
                      background: dashboardTab === 'aliases' ? 'linear-gradient(135deg, rgba(0, 71, 171, 0.6), rgba(0, 210, 255, 0.3))' : 'transparent', 
                      color: dashboardTab === 'aliases' ? '#FFFFFF' : '#94A3B8', 
                      cursor: 'pointer', 
                      transition: 'all 0.2s ease', 
                      boxShadow: dashboardTab === 'aliases' ? '0 0 15px rgba(0, 210, 255, 0.4)' : 'none', 
                      whiteSpace: 'nowrap' 
                    }} 
                    onClick={() => setDashboardTab('aliases')}
                  >
                    🛡️ ALIASES
                  </button>
                  
                  <button 
                    type="button" 
                    style={{ 
                      flex: '1 1 130px', 
                      padding: '8px 12px', 
                      fontSize: '0.80rem', 
                      fontWeight: 'bold', 
                      borderRadius: '8px', 
                      border: dashboardTab === 'removals' ? '1px solid #00D2FF' : '1px solid transparent', 
                      background: dashboardTab === 'removals' ? 'linear-gradient(135deg, rgba(0, 71, 171, 0.6), rgba(0, 210, 255, 0.3))' : 'transparent', 
                      color: dashboardTab === 'removals' ? '#FFFFFF' : '#94A3B8', 
                      cursor: 'pointer', 
                      transition: 'all 0.2s ease', 
                      boxShadow: dashboardTab === 'removals' ? '0 0 15px rgba(0, 210, 255, 0.4)' : 'none', 
                      whiteSpace: 'nowrap' 
                    }} 
                    onClick={() => setDashboardTab('removals')}
                  >
                    🧹 BROKER REMOVALS
                  </button>

                  <button 
                    type="button" 
                    style={{ 
                      flex: '1 1 100px', 
                      padding: '8px 12px', 
                      fontSize: '0.80rem', 
                      fontWeight: 'bold', 
                      borderRadius: '8px', 
                      border: dashboardTab === 'info' ? '1px solid #00D2FF' : '1px solid transparent', 
                      background: dashboardTab === 'info' ? 'linear-gradient(135deg, rgba(0, 71, 171, 0.6), rgba(0, 210, 255, 0.3))' : 'transparent', 
                      color: dashboardTab === 'info' ? '#FFFFFF' : '#94A3B8', 
                      cursor: 'pointer', 
                      transition: 'all 0.2s ease', 
                      boxShadow: dashboardTab === 'info' ? '0 0 15px rgba(0, 210, 255, 0.4)' : 'none', 
                      whiteSpace: 'nowrap' 
                    }} 
                    onClick={() => setDashboardTab('info')}
                  >
                    📊 INFO & LOGS
                  </button>

                  <button 
                    type="button" 
                    style={{ 
                      flex: '1 1 130px', 
                      padding: '8px 12px', 
                      fontSize: '0.80rem', 
                      fontWeight: 'bold', 
                      borderRadius: '8px', 
                      border: dashboardTab === 'account' ? '1px solid #00D2FF' : '1px solid transparent', 
                      background: dashboardTab === 'account' ? 'linear-gradient(135deg, rgba(0, 71, 171, 0.6), rgba(0, 210, 255, 0.3))' : 'transparent', 
                      color: dashboardTab === 'account' ? '#FFFFFF' : '#94A3B8', 
                      cursor: 'pointer', 
                      transition: 'all 0.2s ease', 
                      boxShadow: dashboardTab === 'account' ? '0 0 15px rgba(0, 210, 255, 0.4)' : 'none', 
                      whiteSpace: 'nowrap' 
                    }} 
                    onClick={() => setDashboardTab('account')}
                  >
                    ⚙️ MAINTENANCE
                  </button>
                </div>
                
                {/* TAB 1: ALIASES (EMAIL & MOBILE SMS MANAGEMENT) */}
                {dashboardTab === 'aliases' && (
                  <div className="tab-pane desktop-grid-2col fade-in" style={{ width: '100%' }}>
                    
                    {/* PROMINENT RELAY CREDITS & VAULT CAPACITY SUMMARY BAR */}
                    <div className="desktop-span-2" style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      width: '100%',
                      maxWidth: '600px',
                      padding: '12px 16px',
                      background: 'linear-gradient(135deg, rgba(0, 71, 171, 0.2) 0%, rgba(5, 7, 13, 0.95) 100%)',
                      border: '1px solid rgba(0, 210, 255, 0.4)',
                      borderRadius: '10px',
                      boxSizing: 'border-box',
                      flexWrap: 'wrap',
                      gap: '10px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ background: 'rgba(0, 210, 255, 0.15)', border: '1px solid rgba(0, 210, 255, 0.4)', padding: '5px 12px', borderRadius: '6px', fontSize: '0.85rem', color: '#00D2FF', fontWeight: 'bold' }}>
                          ⚡ CREDITS: {credits.phone_credits !== undefined ? credits.phone_credits : 500}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#CBD5E1', fontFamily: 'monospace' }}>
                          EMAILS: <strong style={{ color: '#00D2FF' }}>{emails.length}/{credits.vcc_total}</strong> | PHONES: <strong style={{ color: '#00D2FF' }}>{phones.length}/{credits.phone_total}</strong>
                        </div>
                      </div>
                      
                      <button 
                        type="button"
                        className="reset-btn"
                        style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 'bold', color: '#00D2FF', borderColor: '#00D2FF', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        onClick={handleRefillCredits}
                      >
                        + REFILL CREDITS ⚡
                      </button>
                    </div>

                    {/* EMAIL PROTECTION MODULE */}
                    <div className="masking-tool" style={{ width: '100%', maxWidth: '600px', position: 'relative', border: '1px solid var(--tiger-blue)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span className="tool-label" style={{ margin: 0, textAlign: 'left', fontWeight: 'bold' }}>EMAIL PROTECTION</span>
                          {addyRecipientStatus === "VERIFIED" ? (
                            <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', border: '1px solid #10B981', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                              ✅ VERIFIED & ACTIVE
                            </span>
                          ) : (
                            <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#FCD34D', border: '1px solid #F59E0B', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                              ⚠️ VERIFICATION PENDING
                            </span>
                          )}
                        </div>
                        <button 
                          type="button"
                          className="main-button" 
                          style={{ 
                            padding: '8px 14px', 
                            fontSize: '0.80rem', 
                            fontWeight: 'bold', 
                            letterSpacing: '0.5px',
                            background: 'linear-gradient(135deg, #00D2FF 0%, #0072FF 100%)',
                            border: 'none',
                            color: '#ffffff',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            boxShadow: '0 0 12px rgba(0, 210, 255, 0.35)',
                            whiteSpace: 'nowrap'
                          }} 
                          onClick={() => { setShowEmailModal(true); checkAddyRecipientStatus(false); }}
                        >
                          + GENERATE EMAIL ALIAS
                        </button>
                      </div>
                      
                      {/* ADDY.IO EMAIL VERIFICATION CALLOUT BANNER */}
                      {addyRecipientStatus === "PENDING_VERIFICATION" && (
                        <div style={{
                          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.22) 0%, rgba(217, 119, 6, 0.3) 100%)',
                          border: '2px solid #F59E0B',
                          borderRadius: '12px',
                          padding: '18px 20px',
                          marginBottom: '20px',
                          textAlign: 'left',
                          boxShadow: '0 0 30px rgba(245, 158, 11, 0.4)',
                          boxSizing: 'border-box'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                            <span style={{ fontSize: '1.5rem' }}>📩</span>
                            <div>
                              <h4 style={{ margin: 0, color: '#FCD34D', fontSize: '1.05rem', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                                ACTION REQUIRED: VERIFY YOUR EMAIL ADDRESS
                              </h4>
                              <p style={{ margin: '2px 0 0 0', color: '#FFF', fontSize: '0.82rem', fontWeight: 'bold' }}>
                                Verification Link Sent To: <span style={{ color: '#00D2FF', textDecoration: 'underline' }}>{addyRecipientEmail || "Your Registered Email"}</span>
                              </p>
                            </div>
                          </div>

                          <p style={{ color: '#E2E8F0', fontSize: '0.85rem', lineHeight: '1.5', margin: '0 0 12px 0' }}>
                            Your email alias forwarding is <strong>currently pending verification</strong> from Addy.io. Please open your email inbox (and check <strong>Spam/Junk</strong> folder) for an email from <code>noreply@addy.io</code> and click <strong>"Verify Email Address"</strong>.
                          </p>

                          <div style={{ 
                            background: 'rgba(5, 11, 20, 0.85)', 
                            border: '1px solid rgba(245, 158, 11, 0.4)', 
                            borderRadius: '8px', 
                            padding: '10px 14px', 
                            marginBottom: '14px', 
                            fontSize: '0.78rem', 
                            color: '#CBD5E1', 
                            lineHeight: '1.4' 
                          }}>
                            ⚡ <strong>Note:</strong> Once you click the link in your email, your aliases will automatically activate within seconds.
                          </div>

                          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="main-button"
                              style={{
                                padding: '8px 14px',
                                fontSize: '0.80rem',
                                fontWeight: 'bold',
                                background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                                border: 'none',
                                color: '#FFF',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                opacity: isResendingAddyVerification ? 0.7 : 1,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                              onClick={handleResendAddyVerification}
                              disabled={isResendingAddyVerification}
                            >
                              {isResendingAddyVerification ? (
                                <>
                                  <span className="cyberpunk-spinner" style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid #FFF', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></span>
                                  RESENDING LINK...
                                </>
                              ) : (
                                '📩 RESEND VERIFICATION EMAIL'
                              )}
                            </button>

                            <button
                              type="button"
                              className="reset-btn"
                              style={{
                                padding: '8px 14px',
                                fontSize: '0.80rem',
                                fontWeight: 'bold',
                                borderColor: '#F59E0B',
                                color: '#FCD34D',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                opacity: isCheckingAddyStatus ? 0.7 : 1,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                              onClick={() => checkAddyRecipientStatus(true)}
                              disabled={isCheckingAddyStatus}
                            >
                              {isCheckingAddyStatus ? (
                                <>
                                  <span className="cyberpunk-spinner" style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid #FCD34D', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></span>
                                  CHECKING STATUS...
                                </>
                              ) : (
                                '🔄 CHECK STATUS NOW'
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {emails.length === 0 ? (
                        <div className="terminal-line" style={{textAlign: 'center', opacity: 0.5, marginBottom: '15px'}}>NO ACTIVE EMAIL ALIASES CREATED</div>
                      ) : (
                        <div className="alias-manager-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
                          {emails.map((e) => (
                            <div key={e.id} style={{ background: '#05070D', border: '1px solid rgba(0, 210, 255, 0.25)', padding: '14px 16px', borderRadius: '10px', textAlign: 'left', width: '100%', boxSizing: 'border-box' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: '0.72rem', color: '#00D2FF', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
                                  ALIAS: {e.label.toUpperCase()}
                                </span>
                                <button className="kill-text-bold" style={{ padding: '3px 8px', fontSize: '0.7rem' }} onClick={() => promptKillAlias(e)}>TERMINATE ✖</button>
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
                      )}
                    </div>

                    {/* INBOUND ALIAS EMAIL MESSAGES & REPLY ROUTING UI CARD */}
                    <div className="masking-tool" style={{ width: '100%', maxWidth: '600px', border: '1px solid var(--tiger-blue)', position: 'relative' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="tool-label" style={{ margin: 0, textAlign: 'left', fontWeight: 'bold' }}>INBOUND ALIAS VAULT INBOX</span>
                          <span style={{ background: 'rgba(0, 210, 255, 0.15)', color: '#00D2FF', border: '1px solid rgba(0, 210, 255, 0.3)', padding: '2px 7px', borderRadius: '4px', fontSize: '0.70rem', fontWeight: 'bold' }}>
                            {aliasMessages.length} MESSAGES
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="main-button"
                            style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 'bold', background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', border: 'none', color: '#ffffff', borderRadius: '5px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                            onClick={() => {
                              if (emails.length > 0) setReplyAliasEmail(emails[0].content || "");
                              setReplyRecipientEmail("");
                              setReplySubject("");
                              setAliasReplyBody("");
                              setShowAliasReplyModal(true);
                            }}
                          >
                            ✉️ COMPOSE NEW EMAIL
                          </button>
                          <button
                            type="button"
                            className="reset-btn"
                            style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 'bold', borderColor: '#00D2FF', color: '#00D2FF', borderRadius: '5px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                            onClick={handleRefreshAliasData}
                            disabled={isRefreshingAliasData}
                          >
                            {isRefreshingAliasData ? "🔄 REFRESHING..." : "🔄 REFRESH"}
                          </button>
                        </div>
                      </div>

                      {aliasMessages.length === 0 ? (
                        <p style={{ fontSize: '0.78rem', color: '#64748B', margin: 0, textAlign: 'center', padding: '12px' }}>
                          No email messages received in your alias vault yet. Incoming emails sent to your active aliases will appear here.
                        </p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '350px', overflowY: 'auto' }}>
                          {aliasMessages.map((msg) => {
                            const emailBodyContent = msg.body || msg.text || msg.message || msg.content || msg.text_content || msg.snippet || (typeof msg.html === 'string' ? msg.html.replace(/<[^>]+>/g, '') : '') || "No message body";
                            return (
                              <div key={msg.id} style={{ background: '#05070D', border: '1px solid #1e293b', padding: '12px', borderRadius: '8px', textAlign: 'left' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                                  <div>
                                    <span style={{ fontSize: '0.82rem', color: '#FFFFFF', fontWeight: 'bold', display: 'block' }}>
                                      FROM: {msg.sender || "Unknown Sender"}
                                    </span>
                                    <span style={{ fontSize: '0.72rem', color: '#00D2FF', fontFamily: 'monospace' }}>
                                      TO ALIAS: {msg.alias_email || "Alias Node"}
                                    </span>
                                  </div>
                                  <span style={{ fontSize: '0.68rem', color: '#64748B' }}>
                                    {msg.received_at ? new Date(msg.received_at).toLocaleString() : "Recently"}
                                  </span>
                                </div>

                                {msg.subject && (
                                  <div style={{ fontSize: '0.78rem', color: '#FCD34D', fontWeight: 'bold', marginBottom: '6px' }}>
                                    SUBJECT: {msg.subject}
                                  </div>
                                )}

                                <div style={{ background: '#020202', padding: '8px 10px', borderRadius: '4px', border: '1px solid #111', fontSize: '0.78rem', color: '#CBD5E1', marginBottom: '8px', whiteSpace: 'pre-wrap', maxHeight: '120px', overflowY: 'auto' }}>
                                  {emailBodyContent}
                                </div>

                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                  <button
                                    type="button"
                                    className="reset-btn"
                                    style={{ padding: '3px 10px', fontSize: '0.70rem', color: '#10B981', borderColor: '#10B981', fontWeight: 'bold' }}
                                    onClick={() => {
                                      setReplyAliasEmail(msg.alias_email || (emails[0] ? emails[0].content : ""));
                                      setReplyRecipientEmail(msg.sender || "");
                                      setReplySubject(msg.subject ? (msg.subject.startsWith("Re:") ? msg.subject : `Re: ${msg.subject}`) : "Re: Your Message");
                                      setAliasReplyBody("");
                                      setShowAliasReplyModal(true);
                                    }}
                                  >
                                    💬 REPLY VIA ALIAS
                                  </button>
                                  <button
                                    type="button"
                                    className="reset-btn"
                                    style={{ padding: '3px 10px', fontSize: '0.70rem', color: '#EF4444', borderColor: '#EF4444', fontWeight: 'bold' }}
                                    onClick={(e) => handleDeleteAliasMessage(msg.id, e)}
                                  >
                                    🗑️ DELETE
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* MOBILE SMS PROTECTION MODULE */}
                    <div className="masking-tool" style={{ width: '100%', maxWidth: '600px', position: 'relative', border: '1px solid var(--tiger-blue)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                        <span className="tool-label" style={{ margin: 0, textAlign: 'left', fontWeight: 'bold' }}>MOBILE SMS PROTECTION</span>
                        <button 
                          type="button"
                          className="main-button" 
                          style={{ 
                            padding: '8px 14px', 
                            fontSize: '0.80rem', 
                            fontWeight: 'bold', 
                            letterSpacing: '0.5px',
                            background: 'linear-gradient(135deg, #00D2FF 0%, #0072FF 100%)',
                            border: 'none',
                            color: '#ffffff',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            boxShadow: '0 0 12px rgba(0, 210, 255, 0.35)',
                            whiteSpace: 'nowrap'
                          }} 
                          disabled={isProcessingPayment}
                          onClick={() => handlePurchaseExpansion('phone')}
                        >
                          + PROVISION MOBILE LINE
                        </button>
                      </div>

                      <div style={{ background: '#05070D', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '12px 14px', borderRadius: '8px', marginBottom: '16px', textAlign: 'left' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                          <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 'bold', textTransform: 'uppercase' }}>PHYSICAL DEVICE FORWARDING PHONE:</span>
                          <span style={{ fontSize: '0.85rem', color: '#10B981', fontFamily: 'monospace', fontWeight: 'bold' }}>
                            {destinationPhone ? destinationPhone : "NOT CONFIGURED"}
                          </span>
                        </div>
                      </div>

                      {phones.length === 0 ? (
                        <div className="terminal-line" style={{textAlign: 'center', opacity: 0.5, marginBottom: '15px'}}>NO ACTIVE VIRTUAL PHONE LINES</div>
                      ) : (
                        <div className="alias-manager-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
                          {phones.map((p) => (
                            <div key={p.id} style={{ background: '#05070D', border: '1px solid rgba(0, 210, 255, 0.25)', padding: '14px 16px', borderRadius: '10px', textAlign: 'left', width: '100%', boxSizing: 'border-box' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: '0.72rem', color: '#00D2FF', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
                                  ALIAS: {p.label.toUpperCase()}
                                </span>
                                <button className="kill-text-bold" style={{ padding: '3px 8px', fontSize: '0.7rem' }} onClick={() => promptKillAlias(p)}>TERMINATE ✖</button>
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
                      )}
                    </div>

                    {/* INBOUND MOBILE SMS VAULT INBOX MODULE */}
                    <div className="masking-tool" style={{ width: '100%', maxWidth: '600px', position: 'relative', border: '1px solid var(--tiger-blue)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="tool-label" style={{ margin: 0, textAlign: 'left', fontWeight: 'bold' }}>INBOUND MOBILE SMS VAULT</span>
                          <span style={{ background: 'rgba(0, 210, 255, 0.15)', color: '#00D2FF', border: '1px solid rgba(0, 210, 255, 0.3)', padding: '1px 6px', borderRadius: '4px', fontSize: '0.70rem', fontWeight: 'bold' }}>
                            {smsInbox.length} MSG
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="main-button"
                            style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 'bold', background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}
                            onClick={() => setShowComposeSms(!showComposeSms)}
                          >
                            {showComposeSms ? "✕ CLOSE SMS" : "✉️ SEND NEW SMS"}
                          </button>
                          <button
                            type="button"
                            className="reset-btn"
                            style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 'bold', color: '#00D2FF', borderColor: '#00D2FF' }}
                            onClick={() => fetchSmsInbox()}
                          >
                            🔄 REFRESH
                          </button>
                        </div>
                      </div>

                      {/* Standalone Compose SMS Panel */}
                      {showComposeSms && (
                        <div style={{ background: '#05070D', border: '1px solid #10B981', padding: '12px', borderRadius: '8px', marginBottom: '14px', textAlign: 'left' }}>
                          <div style={{ fontSize: '0.80rem', color: '#10B981', fontWeight: 'bold', marginBottom: '8px' }}>
                            ✉️ DISPATCH STANDALONE SMS MESSAGE
                          </div>
                          
                          <div style={{ marginBottom: '8px' }}>
                            <label style={{ fontSize: '0.72rem', color: '#94A3B8', display: 'block', marginBottom: '3px', fontWeight: 'bold' }}>
                              SELECT SENDER ALIAS LINE:
                            </label>
                            <select
                              value={selectedSenderAlias}
                              onChange={(e) => setSelectedSenderAlias(e.target.value)}
                              style={{ width: '100%', padding: '6px 10px', fontSize: '0.80rem', background: '#030712', border: '1px solid #1e293b', color: '#00D2FF', borderRadius: '4px', fontWeight: 'bold', boxSizing: 'border-box' }}
                            >
                              <option value="">+1 (585) 580-2036 (Disappear System Line)</option>
                              {phones.map((p, pIdx) => {
                                const numVal = p.content || "";
                                const labelVal = p.label ? `${p.label.toUpperCase()} (${numVal})` : numVal;
                                return (
                                  <option key={p.id || pIdx} value={numVal}>
                                    📱 {labelVal}
                                  </option>
                                );
                              })}
                            </select>
                          </div>

                          <input
                            type="text"
                            placeholder="Recipient Phone (+18135551234)"
                            value={composeSmsRecipient}
                            onChange={(e) => setComposeSmsRecipient(e.target.value)}
                            style={{ width: '100%', padding: '8px 10px', fontSize: '0.82rem', background: '#030712', border: '1px solid #1e293b', color: '#fff', borderRadius: '4px', marginBottom: '8px', boxSizing: 'border-box' }}
                          />
                          <textarea
                            placeholder="Type your message..."
                            value={composeSmsBody}
                            onChange={(e) => setComposeSmsBody(e.target.value)}
                            style={{ width: '100%', padding: '8px 10px', fontSize: '0.82rem', background: '#030712', border: '1px solid #1e293b', color: '#fff', borderRadius: '4px', marginBottom: '8px', height: '60px', boxSizing: 'border-box', resize: 'vertical' }}
                          />
                          <button
                            className="main-button"
                            type="button"
                            style={{ padding: '8px 12px', fontSize: '0.80rem', width: '100%', fontWeight: 'bold' }}
                            onClick={() => {
                              handleSendSmsReply(composeSmsRecipient, composeSmsBody, selectedSenderAlias);
                              setComposeSmsRecipient("");
                              setComposeSmsBody("");
                            }}
                          >
                            📤 SEND SMS
                          </button>
                        </div>
                      )}

                      {groupedSmsThreads.length === 0 ? (
                        <p style={{ fontSize: '0.78rem', color: '#64748B', margin: 0, textAlign: 'center', padding: '10px' }}>
                          No incoming text messages received yet. Any SMS sent to your alias will appear here instantly.
                        </p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '320px', overflowY: 'auto' }}>
                          {groupedSmsThreads.map(({ phone, messages }) => {
                            const formattedPhoneDisplay = phone.replace(/\+1([0-9]{3})([0-9]{3})([0-9]{4})/, "+1 ($1) $2-$3");
                            const isGroupReplying = activeReplyId === `group_${phone}`;
                            const newestMessage = messages[0];

                            return (
                              <div key={`thread_${phone}`} style={{ background: '#090d16', border: '1px solid #1e293b', borderRadius: '8px', padding: '10px 12px' }}>
                                <div className="sms-thread-header">
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '0.82rem', color: '#00D2FF', fontWeight: 'bold' }}>📱 CONTACT: {formattedPhoneDisplay}</span>
                                    <span style={{ fontSize: '0.65rem', background: '#1e293b', color: '#10B981', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                                      {messages.length} {messages.length === 1 ? 'MSG' : 'MSGS'}
                                    </span>
                                  </div>
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    <button
                                      className="reset-btn"
                                      type="button"
                                      style={{ padding: '2px 8px', fontSize: '0.68rem', color: '#10B981', borderColor: '#10B981' }}
                                      onClick={() => {
                                        if (isGroupReplying) {
                                          setActiveReplyId(null);
                                        } else {
                                          const cleanPhoneRecipient = phone.startsWith("+") ? phone : (phone ? `+${phone.replace(/\D/g, "")}` : "");
                                          const targetAliasLine = newestMessage?.to_phone || "";
                                          setActiveReplyId(`group_${phone}`);
                                          setReplyRecipient(cleanPhoneRecipient);
                                          setSelectedSenderAlias(targetAliasLine);
                                          setReplyBody("");
                                        }
                                      }}
                                    >
                                      {isGroupReplying ? "✕ CLOSE" : "💬 REPLY"}
                                    </button>

                                    <button
                                      className="reset-btn"
                                      type="button"
                                      style={{ padding: '2px 8px', fontSize: '0.68rem', color: '#EF4444', borderColor: '#EF4444' }}
                                      onClick={(e) => {
                                        messages.forEach(msg => handleDeleteSmsMessage(msg.id, e));
                                      }}
                                    >
                                      🗑️ DELETE
                                    </button>
                                  </div>
                                </div>

                                {/* SMS THREAD INDIVIDUAL MESSAGES FEED WITH BODY MAPPING */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', margin: '8px 0' }}>
                                  {messages.map((m, mIdx) => {
                                    const smsBodyContent = m.body || m.text || m.message || m.content || m.text_content || "No message body";
                                    const isOutbound = m.direction === 'outbound' || m.is_outbound;
                                    return (
                                      <div key={m.id || mIdx} style={{ background: isOutbound ? '#071828' : '#040b16', border: '1px solid #1e293b', borderRadius: '6px', padding: '8px 10px', textAlign: 'left' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                          <span style={{ fontSize: '0.70rem', color: isOutbound ? '#10B981' : '#00D2FF', fontWeight: 'bold' }}>
                                            {isOutbound ? '📤 SENT VIA ALIAS' : '📥 RECEIVED'} {m.to_phone ? `(${m.to_phone})` : ''}
                                          </span>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '0.65rem', color: '#64748B' }}>
                                              {m.timestamp || m.created_at ? new Date(m.timestamp || m.created_at).toLocaleString() : 'Recently'}
                                            </span>
                                            <button
                                              className="reset-btn"
                                              type="button"
                                              style={{ padding: '1px 5px', fontSize: '0.65rem', color: '#EF4444', borderColor: '#EF4444' }}
                                              onClick={(e) => handleDeleteSmsMessage(m.id, e)}
                                            >
                                              🗑️
                                            </button>
                                          </div>
                                        </div>
                                        <div style={{ fontSize: '0.80rem', color: '#E2E8F0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                          {smsBodyContent}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>

                                {isGroupReplying && (
                                  <div style={{ background: '#030712', border: '1px solid #10B981', padding: '8px', borderRadius: '6px', marginBottom: '8px', marginTop: '8px' }}>
                                    <textarea
                                      placeholder={`Reply to ${formattedPhoneDisplay}...`}
                                      value={replyBody}
                                      onChange={(e) => setReplyBody(e.target.value)}
                                      style={{ width: '100%', padding: '6px 10px', fontSize: '0.8rem', background: '#090d16', border: '1px solid #1e293b', color: '#fff', borderRadius: '4px', marginBottom: '6px', height: '45px', boxSizing: 'border-box', resize: 'vertical' }}
                                    />
                                    <button
                                      className="main-button"
                                      type="button"
                                      style={{ padding: '6px 12px', fontSize: '0.75rem', width: '100%', background: 'linear-gradient(135deg, #10B981, #059669)', border: 'none', color: '#fff', fontWeight: 'bold', borderRadius: '4px' }}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const targetAliasLine = newestMessage?.to_phone || selectedSenderAlias || "";
                                        handleSendSmsReply(
                                          phone.startsWith("+") ? phone : replyRecipient, 
                                          replyBody, 
                                          targetAliasLine
                                        );
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
                )}

                {/* TAB 2: DATA BROKER REMOVALS */}
                {dashboardTab === 'removals' && (
                  <div className="tab-pane fade-in" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                    
                    {/* OPERATIVE PRIVACY PROFILE & REMOVAL IDENTITY */}
                    <div className="masking-tool" style={{ width: '100%', maxWidth: '600px', border: '1px solid var(--tiger-blue)' }}>
                      <p className="tool-label" style={{ textAlign: 'center', marginBottom: '14px' }}>👤 OPERATIVE PRIVACY PROFILE & REMOVAL IDENTITY</p>
                      
                      <div style={{ background: '#05070D', border: '1px solid rgba(0, 210, 255, 0.3)', borderRadius: '10px', padding: '16px', marginBottom: '12px', textAlign: 'left' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
                          <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
                            TARGET REMOVAL PROFILE
                          </span>
                          <span style={{ fontSize: '0.68rem', color: '#10B981', background: 'rgba(16,185,129,0.12)', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(16,185,129,0.3)', fontWeight: 'bold' }}>
                            🟢 ACTIVE PROTECTION
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.86rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#94A3B8' }}>Legal Target Name:</span>
                            <strong style={{ color: '#00D2FF', fontFamily: 'monospace' }}>
                              {targetProfile.firstName || targetProfile.first_name || targetProfile.lastName || targetProfile.last_name 
                                ? `${targetProfile.firstName || targetProfile.first_name || ''} ${targetProfile.middleName || targetProfile.middle_name ? `${targetProfile.middleName || targetProfile.middle_name} ` : ''}${targetProfile.lastName || targetProfile.last_name || ''}`.trim() 
                                : (getSessionItem("disappear_user_email") || 'Registered Operative')}
                            </strong>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#94A3B8' }}>Primary Email:</span>
                            <span style={{ color: '#FFFFFF', fontFamily: 'monospace', fontWeight: 'bold' }}>
                              {targetProfile.email || getSessionItem("disappear_user_email") || 'Awaiting Sync...'}
                            </span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#94A3B8' }}>SMS Forwarding Phone:</span>
                            <span style={{ color: '#FFFFFF', fontFamily: 'monospace', fontWeight: 'bold' }}>
                              {targetProfile.phone || destinationPhone || 'No Phone Linked'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button 
                        className="main-button" 
                        style={{ width: '100%', fontSize: '0.82rem', padding: '10px 14px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
                        onClick={() => {
                          checkAndShowNoticeModal(currentUserId || getSessionItem("disappear_user_id"));
                        }}
                      >
                        ⚙️ REVIEW / EDIT TARGET PROFILE
                      </button>
                    </div>

                    {/* DATA BROKER TARGETS */}
                    <div className="masking-tool" style={{ width: '100%', maxWidth: '600px', border: '1px solid var(--tiger-blue)' }}>
                      <p className="tool-label" style={{ textAlign: 'center', marginBottom: '15px' }}>DATA BROKER TARGETS</p>
                      
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
                    </div>

                    {/* LIVE DATA BROKER SCRUB QUEUE & MONITOR */}
                    <div className="masking-tool" style={{ width: '100%', maxWidth: '600px', border: '1px solid var(--tiger-blue)' }}>
                      <p className="tool-label" style={{ textAlign: 'center', marginBottom: '12px' }}>🛡️ DATA BROKER PURGE QUEUE ({scrubStats.total_brokers || 410} REGISTRIES)</p>
                      
                      <div style={{
                        background: scrubStats.removed === 0 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                        border: scrubStats.removed === 0 ? '1px solid #F59E0B' : '1px solid #10B981',
                        color: scrubStats.removed === 0 ? '#FCD34D' : '#10B981',
                        padding: '12px 14px',
                        borderRadius: '8px',
                        marginBottom: '14px',
                        textAlign: 'left'
                      }}>
                        <div style={{ fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '4px', letterSpacing: '0.5px' }}>
                          {scrubStats.removed === 0 ? `🟡 INITIAL PRIVACY PURGE QUEUED | REMOVALS IN PROGRESS (${scrubStats.total_brokers || 410} TARGETS)` : `🟢 ACTIVE PURGE CYCLE | ${scrubStats.removed} OF ${scrubStats.total_brokers || 410} BROKERS SCRUBBED`}
                        </div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.9, lineHeight: '1.4' }}>
                          {scrubStats.removed === 0 
                            ? `Your target profile has been dispatched to ${scrubStats.total_brokers || 410} major data broker opt-out endpoints. Automated crawlers and human privacy analysts are actively processing opt-out filings.`
                            : `Continuous background scrubbers have finalized ${scrubStats.removed} verified removals (${scrubStats.progress_pct}% complete).`}
                        </div>

                        <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.5)', borderRadius: '4px', overflow: 'hidden', marginTop: '10px', border: '1px solid rgba(255,255,255,0.1)' }}>
                          <div style={{ width: `${scrubStats.progress_pct || 0}%`, height: '100%', background: 'linear-gradient(90deg, #F59E0B, #10B981)', borderRadius: '4px', transition: 'width 0.4s ease' }} />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
                        <div style={{ background: '#05070D', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '8px 10px', borderRadius: '6px', textAlign: 'center' }}>
                          <span style={{ fontSize: '0.65rem', color: '#FCD34D', display: 'block', fontWeight: 'bold' }}>IN PROGRESS</span>
                          <strong style={{ fontSize: '1rem', color: '#FFF' }}>{scrubStats.processing || 0}</strong>
                        </div>
                        <div style={{ background: '#05070D', border: '1px solid rgba(0, 210, 255, 0.3)', padding: '8px 10px', borderRadius: '6px', textAlign: 'center' }}>
                          <span style={{ fontSize: '0.65rem', color: '#00D2FF', display: 'block', fontWeight: 'bold' }}>MANUAL QUEUED</span>
                          <strong style={{ fontSize: '1rem', color: '#FFF' }}>{scrubStats.manual_pending || 0}</strong>
                        </div>
                        <div style={{ background: '#05070D', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '8px 10px', borderRadius: '6px', textAlign: 'center' }}>
                          <span style={{ fontSize: '0.65rem', color: '#10B981', display: 'block', fontWeight: 'bold' }}>SCRUBBED</span>
                          <strong style={{ fontSize: '1rem', color: '#FFF' }}>{scrubStats.removed || 0}</strong>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '5px', marginBottom: '12px' }}>
                        {["ALL", "PROCESSING", "REMOVED"].map(f => (
                          <button
                            key={f}
                            onClick={() => setBrokerFilter(f)}
                            style={{
                              flex: 1,
                              padding: '6px 0',
                              fontSize: '0.75rem',
                              fontWeight: 'bold',
                              borderRadius: '4px',
                              border: brokerFilter === f ? '1px solid #00D2FF' : '1px solid #1e293b',
                              background: brokerFilter === f ? 'rgba(0, 71, 171, 0.3)' : '#05070D',
                              color: brokerFilter === f ? '#00D2FF' : '#94A3B8',
                              cursor: 'pointer'
                            }}
                          >
                            {f === "PROCESSING" ? "IN PROGRESS" : f}
                          </button>
                        ))}
                      </div>

                      <div style={{ maxHeight: '240px', overflowY: 'auto', background: '#05070D', border: '1px solid rgba(0,210,255,0.2)', borderRadius: '8px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {(dataBrokers || [])
                          .filter(b => {
                            if (brokerFilter === "REMOVED") return b.status === "REMOVED";
                            if (brokerFilter === "PROCESSING") return b.status !== "REMOVED";
                            return true;
                          })
                          .map((b, bIdx) => {
                            const isRemoved = b.status === "REMOVED";
                            const isSubpoena = b.status === "SUBPOENA_FILED";
                            const isManual = b.status === "MANUAL_PENDING";

                            let badgeColor = "#FCD34D";
                            let badgeBg = "rgba(245, 158, 11, 0.15)";
                            let badgeBorder = "rgba(245, 158, 11, 0.4)";
                            let statusText = "🟡 REMOVAL IN PROGRESS";

                            if (isRemoved) {
                              badgeColor = "#10B981";
                              badgeBg = "rgba(16, 185, 129, 0.15)";
                              badgeBorder = "rgba(16, 185, 129, 0.4)";
                              statusText = "✅ SCRUBBED & VERIFIED";
                            } else if (isSubpoena) {
                              badgeColor = "#C084FC";
                              badgeBg = "rgba(192, 132, 252, 0.15)";
                              badgeBorder = "rgba(192, 132, 252, 0.4)";
                              statusText = "📜 SUBPOENA DISPATCHED";
                            } else if (isManual) {
                              badgeColor = "#00D2FF";
                              badgeBg = "rgba(0, 210, 255, 0.15)";
                              badgeBorder = "rgba(0, 210, 255, 0.4)";
                              statusText = "⏳ LEGAL OPT-OUT QUEUED";
                            }

                            return (
                              <div key={b.id || bIdx} style={{ background: '#0a0f1d', border: '1px solid #1e293b', borderRadius: '6px', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ textAlign: 'left' }}>
                                  <span style={{ fontSize: '0.82rem', fontWeight: 'bold', color: '#FFFFFF', letterSpacing: '0.5px', display: 'block' }}>
                                    {b.broker_name.toUpperCase()}
                                  </span>
                                  <span style={{ fontSize: '0.68rem', color: '#94A3B8' }}>
                                    {b.removal_type === "AUTOMATED" ? "🤖 AUTOMATED DIRECT OPT-OUT" : "👤 HUMAN ANALYST DISPATCH"}
                                  </span>
                                </div>
                                <span style={{ fontSize: '0.68rem', color: badgeColor, background: badgeBg, border: `1px solid ${badgeBorder}`, padding: '3px 8px', borderRadius: '4px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                                  {statusText}
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    </div>

                  </div>
                )}

                {/* TAB 3: INFO & SECURITY LOGS */}
                {dashboardTab === 'info' && (
                  <div className="tab-pane desktop-grid-2col fade-in" style={{ width: '100%' }}>
                    
                    {/* LIVE SECURITY AUDIT (HISTORY VIEW) */}
                    <div className="masking-tool" style={{ width: '100%', maxWidth: '600px', border: '1px solid var(--tiger-blue)' }}>
                      <p className="tool-label" style={{ textAlign: 'center', marginBottom: '15px' }}>LIVE SECURITY AUDIT</p>
                      
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

                      <div style={{ maxHeight: '300px', overflowY: 'auto', background: '#05070D', border: '1px solid rgba(0,210,255,0.2)', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '15px' }}>
                        {auditLog.length === 0 ? (
                          <p style={{ fontSize: '0.78rem', color: '#64748B', margin: 0, textAlign: 'center', padding: '15px' }}>
                            No security audit logs recorded for the selected timeframe.
                          </p>
                        ) : (
                          auditLog.map((item, idx) => (
                            <div key={item.id || idx} style={{ background: '#0a0f1d', border: '1px solid #1e293b', padding: '8px 12px', borderRadius: '6px', textAlign: 'left' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <span style={{ fontSize: '0.78rem', color: '#00D2FF', fontWeight: 'bold' }}>
                                  {item.action || item.action_type || "SECURITY_EVENT"}
                                </span>
                                <span style={{ fontSize: '0.68rem', color: '#64748B' }}>
                                  {item.timestamp ? new Date(item.timestamp).toLocaleString() : "Recently"}
                                </span>
                              </div>
                              {item.node_id && (
                                <span style={{ fontSize: '0.70rem', color: '#94A3B8', fontFamily: 'monospace', display: 'block' }}>
                                  NODE_ID: {item.node_id}
                                </span>
                              )}
                            </div>
                          ))
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button className="main-button" style={{ flex: 1, fontSize: '0.82rem', padding: '12px 5px', display: 'flex', justifyContent: 'center', alignItems: 'center', whiteSpace: 'nowrap' }} onClick={() => handleDownloadPDF(false)}>
                          📄 EXPORT AUDIT PDF
                        </button>
                        <button className="reset-btn" style={{ flex: 1, fontSize: '0.82rem', padding: '12px 5px', display: 'flex', justifyContent: 'center', alignItems: 'center', borderColor: 'var(--tiger-blue)', color: 'var(--tiger-blue)', whiteSpace: 'nowrap' }} onClick={handleExportJSON}>
                          💾 EXPORT SECURE BACKUP
                        </button>
                      </div>
                    </div>

                    {/* SYSTEM SUPPORT & MANUAL ACCESS */}
                    <div className="masking-tool" style={{ width: '100%', maxWidth: '600px', border: '1px solid var(--tiger-blue)' }}>
                      <p className="tool-label tiger-text" style={{ textAlign: 'center' }}>SYSTEM SUPPORT NODE</p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginTop: '10px' }}>
                        <button className="reset-btn" style={{ fontSize: '0.85rem', padding: '10px 5px', display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => setShowSupportModal(true)}>🎟️ OPEN TICKET</button>
                        <button className="reset-btn" style={{ fontSize: '0.85rem', padding: '10px 5px', display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => setShowFaqModal(true)}>❓ ACCESS FAQ</button>
                        <button className="reset-btn" style={{ fontSize: '0.85rem', padding: '10px 5px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#00D2FF', borderColor: '#00D2FF' }} onClick={() => window.dispatchEvent(new CustomEvent('open-ai-chat'))}>🤖 ASK AI SPECIALIST</button>
                      </div>
                      <div style={{ marginTop: '20px', fontSize: '0.9rem', color: '#cbd5e1', textAlign: 'center' }}>
                        <p className="faq-link" onClick={() => setShowManualModal(true)} style={{cursor: 'pointer', textDecoration: 'underline'}}> Operation Manual </p>
                      </div>
                    </div>

                  </div>
                )}

                {/* TAB 4: MAINTENANCE */}
                {dashboardTab === 'account' && (
                  <div className="tab-pane desktop-grid-2col fade-in" style={{ width: '100%' }}>
                    
                    {/* VAULT CAPACITY */}
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

                    {/* RELAY CREDIT POOL & REFILL */}
                    <div className="masking-tool" style={{ width: '100%', maxWidth: '600px', border: '1px solid var(--tiger-blue)' }}>
                      <p className="tool-label tiger-text" style={{ textAlign: 'center', marginBottom: '14px' }}>⚡ RELAY CREDIT POOL</p>
                      
                      <div style={{ background: '#05070D', border: '1px solid rgba(0, 210, 255, 0.3)', padding: '16px', borderRadius: '10px', marginBottom: '14px', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.78rem', color: '#94A3B8', display: 'block', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold', marginBottom: '4px' }}>REMAINING RELAY CREDITS</span>
                        <div style={{ fontSize: '2rem', color: '#00D2FF', fontWeight: 'bold', fontFamily: 'monospace' }}>
                          {credits.phone_credits !== undefined ? credits.phone_credits : 500} CREDITS
                        </div>
                        <p style={{ fontSize: '0.75rem', color: '#CBD5E1', margin: '6px 0 0 0' }}>
                          1 SMS = 1 Credit | 1 Voice Call / Forwarding Minute = 2 Credits
                        </p>
                      </div>

                      <button
                        type="button"
                        className="main-button"
                        style={{ width: '100%', fontSize: '0.85rem', padding: '12px 14px', fontWeight: 'bold', background: 'linear-gradient(135deg, #00D2FF 0%, #0072FF 100%)', border: 'none', color: '#FFF', borderRadius: '6px', cursor: 'pointer', boxShadow: '0 0 15px rgba(0, 210, 255, 0.4)' }}
                        disabled={isRefillingCredits}
                        onClick={handleRefillCredits}
                      >
                        {isRefillingCredits ? "⚡ REFILLING CREDITS..." : "⚡ REFILL RELAY CREDITS (+250 CREDITS / $5.95)"}
                      </button>
                    </div>

                    {/* REFERRAL MILESTONE REWARDS & SHARE CARD */}
                    <div className="masking-tool" style={{ width: '100%', maxWidth: '600px', border: '1px solid #00D2FF', background: 'linear-gradient(135deg, rgba(0,71,171,0.12) 0%, rgba(5,11,20,0.95) 100%)', borderRadius: '12px', padding: '16px', boxSizing: 'border-box' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <span className="tool-label tiger-text" style={{ margin: 0, fontSize: '0.95rem', display: 'block', fontWeight: 'bold' }}>🎁 REFERRAL MILESTONE REWARDS</span>
                          <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Earn 1 Free Month of Elite Protection for every 5 referred operatives</span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#10B981', background: 'rgba(16,185,129,0.15)', padding: '4px 10px', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.3)', fontWeight: 'bold' }}>
                          {referralData.free_months_earned || 0} FREE MONTHS UNLOCKED
                        </span>
                      </div>

                      {/* Referral Code & Link Box */}
                      <div style={{ background: '#05070D', border: '1px solid rgba(0, 210, 255, 0.3)', padding: '12px 14px', borderRadius: '8px', marginBottom: '14px', textAlign: 'left' }}>
                        <span style={{ fontSize: '0.70rem', color: '#94A3B8', fontWeight: 'bold', display: 'block', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '1px' }}>
                          YOUR UNIQUE SHAREABLE REFERRAL LINK:
                        </span>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <input 
                            type="text" 
                            readOnly 
                            value={referralData.link || (referralData.code ? `https://disappearco.com/?ref=${referralData.code}` : `https://disappearco.com/?ref=${getSessionItem("disappear_user_id") || "invite"}`)} 
                            style={{ flex: 1, minWidth: '200px', fontSize: '0.82rem', background: '#020202', color: '#00D2FF', fontFamily: 'monospace', fontWeight: 'bold', padding: '8px 12px', border: '1px solid rgba(0,210,255,0.3)', borderRadius: '6px', boxSizing: 'border-box' }} 
                          />
                          <button 
                            type="button"
                            className="main-button" 
                            style={{ padding: '8px 14px', fontSize: '0.80rem', fontWeight: 'bold', whiteSpace: 'nowrap' }} 
                            onClick={() => {
                              const linkToCopy = referralData.link || (referralData.code ? `https://disappearco.com/?ref=${referralData.code}` : `https://disappearco.com/?ref=${getSessionItem("disappear_user_id") || "invite"}`);
                              navigator.clipboard.writeText(linkToCopy);
                              triggerToast("📋 REFERRAL LINK COPIED TO CLIPBOARD!");
                            }}
                          >
                            COPY LINK 📋
                          </button>
                        </div>
                      </div>

                      {/* Progress Bar & Milestone Status */}
                      <div style={{ background: '#05070D', border: '1px solid rgba(255,255,255,0.08)', padding: '10px 14px', borderRadius: '8px', textAlign: 'left' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#CBD5E1', marginBottom: '6px', fontWeight: 'bold' }}>
                          <span>REFERRED OPERATIVES: <strong style={{ color: '#00D2FF' }}>{referralData.count || 0}</strong></span>
                          <span>NEXT REWARD: <strong style={{ color: '#10B981' }}>{referralData.next_milestone_needed || 5} MORE</strong></span>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.5)', borderRadius: '4px', overflow: 'hidden', border: '1px solid rgba(0,210,255,0.2)' }}>
                          <div style={{ width: `${referralData.progress_pct || 0}%`, height: '100%', background: 'linear-gradient(90deg, #00D2FF, #10B981)', borderRadius: '4px', transition: 'width 0.4s ease' }} />
                        </div>
                      </div>
                    </div>

                    {/* PASSWORD MANAGEMENT CARD (PROFILE SECURITY) */}
                    <div className="masking-tool" style={{ 
                      width: '100%', 
                      maxWidth: '600px', 
                      padding: '20px',
                      border: '1px solid rgba(0, 210, 255, 0.3)',
                      background: 'rgba(5, 7, 13, 0.95)',
                      borderRadius: '12px',
                      textAlign: 'left'
                    }}>
                  <p className="tool-label" style={{ textAlign: 'center', color: '#00D2FF', marginBottom: '14px' }}>🔐 USER PROFILE & PASSWORD SECURITY</p>
                  
                  {/* --- ADDY.IO EMAIL VERIFICATION STATUS & NOTICE CARD --- */}
                  <div style={{
                    background: addyRecipientStatus === "VERIFIED" ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.12)',
                    border: addyRecipientStatus === "VERIFIED" ? '1px solid #10B981' : '1px solid #F59E0B',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    marginBottom: '16px',
                    textAlign: 'left'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: addyRecipientStatus === "VERIFIED" ? '0px' : '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.85rem' }}>{addyRecipientStatus === "VERIFIED" ? "✅" : "⚠️"}</span>
                        <span style={{ 
                          color: addyRecipientStatus === "VERIFIED" ? '#10B981' : '#FCD34D', 
                          fontSize: '0.80rem', 
                          fontWeight: 'bold', 
                          letterSpacing: '0.5px' 
                        }}>
                          {addyRecipientStatus === "VERIFIED" 
                            ? "✅ Addy.io Email Verified & Active" 
                            : "⚠️ Addy.io Email Unverified"}
                        </span>
                      </div>

                      {addyRecipientStatus !== "VERIFIED" && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="main-button"
                            style={{
                              padding: '5px 10px',
                              fontSize: '0.72rem',
                              fontWeight: 'bold',
                              background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                              border: 'none',
                              color: '#FFF',
                              cursor: 'pointer',
                              opacity: isResendingAddyVerification ? 0.7 : 1,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                            onClick={handleResendAddyVerification}
                            disabled={isResendingAddyVerification}
                          >
                            {isResendingAddyVerification ? (
                              <>
                                <span className="cyberpunk-spinner" style={{ display: 'inline-block', width: '10px', height: '10px', border: '2px solid #FFF', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></span>
                                RESENDING...
                              </>
                            ) : (
                              '📩 RESEND VERIFICATION'
                            )}
                          </button>
                          <button
                            type="button"
                            className="reset-btn"
                            style={{
                              padding: '5px 10px',
                              fontSize: '0.72rem',
                              fontWeight: 'bold',
                              borderColor: '#F59E0B',
                              color: '#FCD34D',
                              cursor: 'pointer',
                              opacity: isCheckingAddyStatus ? 0.7 : 1,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                            onClick={() => checkAddyRecipientStatus(true)}
                            disabled={isCheckingAddyStatus}
                          >
                            {isCheckingAddyStatus ? (
                              <>
                                <span className="cyberpunk-spinner" style={{ display: 'inline-block', width: '10px', height: '10px', border: '2px solid #FCD34D', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></span>
                                CHECKING...
                              </>
                            ) : (
                              '🔄 CHECK STATUS'
                            )}
                          </button>
                        </div>
                      )}
                    </div>

                    {addyRecipientStatus !== "VERIFIED" && (
                      <p style={{ color: '#F8FAFC', fontSize: '0.76rem', margin: 0, lineHeight: '1.45' }}>
                        Your email relay forwarding is currently locked until you confirm the verification email sent from <code>noreply@addy.io</code> to <strong>{addyRecipientEmail || targetProfile.email || getSessionItem("disappear_user_email") || "your registered email"}</strong>.
                      </p>
                    )}
                  </div>

                  <p style={{ fontSize: '0.78rem', color: '#94A3B8', marginBottom: '15px', lineHeight: '1.4' }}>
                    Enter your registered account email to receive a 6-digit SMS verification code on your registered mobile phone.
                  </p>

                  <form onSubmit={handleChangePasswordInProfile} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 'bold' }}>REGISTERED ACCOUNT EMAIL</label>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                        <input 
                          type="email" 
                          className="mask-btn" 
                          style={{ flex: 1, color: 'white', fontSize: '0.85rem' }} 
                          placeholder="customer@email.com" 
                          value={forgotEmail || targetProfile.email || getSessionItem("disappear_user_email") || loginEmail || ""} 
                          onChange={(e) => setForgotEmail(e.target.value)} 
                        />
                        <button
                          type="button"
                          className="main-button"
                          style={{ padding: '8px 12px', fontSize: '0.72rem', whiteSpace: 'nowrap' }}
                          onClick={() => handleSendResetCode(forgotEmail || targetProfile.email || getSessionItem("disappear_user_email") || loginEmail)}
                          disabled={isSendingResetCode}
                        >
                          {isSendingResetCode ? "SENDING..." : (isResetCodeSent ? "RESEND 📱" : "SEND CODE 📱")}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 'bold' }}>📱 6-DIGIT SMS VERIFICATION CODE</label>
                      <input 
                        type="text" 
                        className="mask-btn" 
                        style={{ width: '100%', marginTop: '4px', color: '#00D2FF', fontSize: '1.1rem', letterSpacing: '4px', textAlign: 'center', fontWeight: 'bold', boxSizing: 'border-box' }} 
                        placeholder="123456" 
                        maxLength={6}
                        value={forgotCode} 
                        onChange={(e) => setForgotCode(e.target.value)} 
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 'bold' }}>NEW PASSWORD</label>
                      <input 
                        type="password"
                        name="disappear_reset_new_password"
                        autoComplete="new-password"
                        className="mask-btn"
                        style={{ width: '100%', marginTop: '4px', color: '#fff', fontSize: '0.85rem' }}
                        placeholder="New Password (min 6 characters)"
                        value={newPasswordInput}
                        onChange={(e) => { setNewPasswordInput(e.target.value); setForgotNewPassword(e.target.value); }}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 'bold' }}>CONFIRM NEW PASSWORD</label>
                      <input 
                        type="password"
                        name="disappear_reset_confirm_password"
                        autoComplete="new-password"
                        className="mask-btn"
                        style={{ width: '100%', marginTop: '4px', color: '#fff', fontSize: '0.85rem' }}
                        placeholder="Confirm New Password"
                        value={confirmPasswordInput}
                        onChange={(e) => { setConfirmPasswordInput(e.target.value); setForgotConfirmPassword(e.target.value); }}
                        required
                      />
                    </div>
                    <button 
                      type="submit" 
                      className="main-button"
                      disabled={isUpdatingPassword || isResettingPassword}
                      style={{ marginTop: '10px', padding: '12px', fontSize: '0.85rem' }}
                    >
                      {(isUpdatingPassword || isResettingPassword) ? "⚡ VERIFYING..." : "⚡ VERIFY CODE & UPDATE VAULT PASSWORD"}
                    </button>
                  </form>
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
                    <button className="reset-btn" style={{ fontSize: '0.95rem', padding: '14px 10px', display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }} onClick={handleSecureLogout}>
                      🚪 LOGOUT SECURELY
                    </button>
                    <button className="burn-all-btn" style={{ fontSize: '0.95rem', padding: '14px 10px', display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }} onClick={handleEmergencyBurn}>
                      🔥 INITIATE EMERGENCY BURN
                    </button>
                  </div>
                </div>

              </div>
            )}
          </div>
        ) : (
              /* 4. ONBOARDING & LOGIN FLOW (MOBILE OPTIMIZED) */
              <div className="onboarding-flow">
                {(show2FA && !showPricing && !showCheckout && !isScanning) && (
                  <div className="fade-in" style={{ maxWidth: '480px', margin: '0 auto', width: '100%' }}>
                    <div className="pricing-card" style={{ width: '100%' }}>
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
                          name="disappear_login_email_clean" 
                          id="disappear_login_email_clean"
                          autoComplete="username" 
                          className="mask-btn" 
                          style={{width: '100%', textAlign: 'center', marginBottom: '15px', color: 'white'}} 
                          placeholder="customer@email.com" 
                          value={loginEmail} 
                          onChange={(e) => setLoginEmail(e.target.value)} 
                          required
                        />
                        <p className="field-label">ACCOUNT PASSWORD</p>
                        <input 
                          type="password" 
                          name="disappear_login_password_clean" 
                          id="disappear_login_password_clean"
                          autoComplete="current-password" 
                          className="mask-btn" 
                          style={{width: '100%', textAlign: 'center', color: 'white', marginBottom: '10px'}} 
                          placeholder="••••••••" 
                          value={loginPassword} 
                          onChange={(e) => setLoginPassword(e.target.value)} 
                          required
                        />
                        <div style={{ textAlign: 'right', marginBottom: '15px' }}>
                          <span 
                            style={{ color: '#00D2FF', fontSize: '0.78rem', cursor: 'pointer', textDecoration: 'underline', fontWeight: 'bold' }}
                            onClick={() => {
                              setForgotEmail(loginEmail || "");
                              setShowForgotPasswordModal(true);
                            }}
                          >
                            🔑 FORGOT PASSWORD?
                          </span>
                        </div>
                        <button type="submit" className="main-button" style={{width: '100%', marginTop: '5px'}}>SIGN IN</button>
                      </form>
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
                </div>
              )}

                {showPricing && !showCheckout && !isScanning && (
                  <div className="onboarding-panels-container fade-in">
                    {/* Panel 1: Select Plan */}
                    <div className="pricing-card">
                      <div className="price-box">
                        <div className="billing-toggle" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', width: '100%', marginBottom: '15px' }}>
                          <button className={billingCycle === 'monthly' ? 'mask-btn active-toggle' : 'mask-btn'} onClick={() => setBillingCycle('monthly')} style={{ padding: '8px 10px', fontSize: '0.82rem' }}>Monthly ($19.99/mo)</button>
                          <button className={billingCycle === 'annual' ? 'mask-btn active-toggle' : 'mask-btn'} onClick={() => setBillingCycle('annual')} style={{ padding: '8px 10px', fontSize: '0.82rem' }}>
                            Annual ($217.38/yr) <span style={{ fontSize: '0.68rem', color: '#34D399', display: 'block', fontWeight: 'bold' }}>SAVE $22.50 FLAT</span>
                          </button>
                        </div>
                        <h3 className="tiger-text">ELITE PRIVACY PLAN</h3>
                        <div className="price-amount">${billingCycle === 'monthly' ? '19.99' : '217.38'}</div>
                        <div style={{ fontSize: '0.82rem', color: '#00D2FF', fontWeight: 'bold', marginBottom: '12px', textAlign: 'center' }}>
                          {billingCycle === 'monthly' ? '/ month (Cancel Anytime)' : '/ year ($18.11/mo - Reflects Flat $22.50 Annual Discount!)'}
                        </div>
                        <p style={{fontSize: '0.82rem', color: 'var(--text-dim)', marginBottom: '18px', textAlign: 'center'}}>Cancel or adjust subscription directly inside your dashboard in a single click.</p>
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
                            <span style={{ fontSize: '0.88rem', color: '#cbd5e1' }}><strong>5 Active Slots:</strong> Provision secure emails or phone relays.</span>
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
                        <form onSubmit={(e) => { e.preventDefault(); handleFinalPurchase(); }} autoComplete="on" style={{ width: '100%' }}>
                          <h3 className="tiger-text">TARGET PROFILE DATA</h3>

                          {/* LEGAL NAME & DATA REMOVAL TARGET NOTICE BANNER */}
                          <div style={{
                            background: 'rgba(0, 210, 255, 0.08)',
                            border: '1px solid #00D2FF',
                            borderRadius: '8px',
                            padding: '14px 16px',
                            marginBottom: '18px',
                            boxShadow: '0 0 20px rgba(0, 210, 255, 0.2)',
                            textAlign: 'left'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                                <h4 style={{ color: '#00D2FF', margin: 0, fontSize: '0.92rem', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                                  LEGAL NAME & DATA REMOVAL TARGET NOTICE
                                </h4>
                              </div>
                              <button
                                type="button"
                                className="reset-btn"
                                style={{ padding: '2px 8px', fontSize: '0.72rem', color: '#00D2FF', borderColor: '#00D2FF' }}
                                onClick={() => setShowSignupTargetNoticeModal(true)}
                              >
                                ℹ️ WHY REAL NAME?
                              </button>
                            </div>
                            <p style={{ color: '#F8FAFC', fontSize: '0.82rem', margin: 0, lineHeight: '1.45' }}>
                              <strong>IMPORTANT:</strong> Please enter your <strong>REAL LEGAL NAME</strong> and physical address below. The name entered here will be the <strong>exact target searched, scrubbed, and removed</strong> across all 400+ public data broker registries.
                            </p>
                          </div>

                          <div className="checkout-grid">
                              <input className="mask-btn" placeholder="First Name (Legal Name)" value={targetProfile.firstName || targetProfile.first_name || ""} onChange={(e) => setTargetProfile({...targetProfile, firstName: e.target.value, first_name: e.target.value})} />
                              <input className="mask-btn" placeholder="Middle Name (Legal Name)" value={targetProfile.middleName || targetProfile.middle_name || ""} onChange={(e) => setTargetProfile({...targetProfile, middleName: e.target.value, middle_name: e.target.value})} />
                              <input className="mask-btn full-row" placeholder="Nickname / Public Record Alias (e.g. Common Short Names / Former Names)" value={targetProfile.nickname || ""} onChange={(e) => setTargetProfile({...targetProfile, nickname: e.target.value})} />
                              <input className="mask-btn full-row" placeholder="Last Name (Legal Name)" value={targetProfile.lastName || targetProfile.last_name || ""} onChange={(e) => setTargetProfile({...targetProfile, lastName: e.target.value, last_name: e.target.value})} />
                              <input type="email" name="disappear_signup_email_clean" id="disappear_signup_email_clean" autoComplete="username" className="mask-btn full-row" placeholder="Email Address" value={targetProfile.email} onChange={(e) => setTargetProfile({...targetProfile, email: e.target.value})} required />
                              
                              {/* --- ADDY.IO VERIFICATION ADVANCE NOTICE CALLOUT --- */}
                              <div style={{
                                gridColumn: '1 / -1',
                                background: 'rgba(0, 210, 255, 0.06)',
                                border: '1px solid rgba(0, 210, 255, 0.25)',
                                borderRadius: '6px',
                                padding: '10px 14px',
                                marginTop: '2px',
                                marginBottom: '4px',
                                fontSize: '0.78rem',
                                color: '#E2E8F0',
                                lineHeight: '1.45',
                                textAlign: 'left'
                              }}>
                                ℹ️ <strong>Quick Note on Setup:</strong> After creating your account, you will receive a one-time verification email from <code>addy.io</code> to confirm your email forwarding address. Once you click "Verify" on <code>addy.io</code>, you can safely close that tab and return here to <code>disappearco.com</code> to log into your vault. You can also manage or re-trigger this verification anytime inside your Vault profile settings.
                              </div>
                              <input type="password" name="disappear_signup_password_clean" id="disappear_signup_password_clean" autoComplete="new-password" className="mask-btn full-row" placeholder="Account Password (min 6 characters)" value={targetProfile.password} onChange={(e) => setTargetProfile({...targetProfile, password: e.target.value})} required />
                              <input type="password" name="disappear_signup_confirm_password_clean" id="disappear_signup_confirm_password_clean" autoComplete="new-password" className="mask-btn full-row" placeholder="Confirm Account Password" value={signupConfirmPassword} onChange={(e) => setSignupConfirmPassword(e.target.value)} required />
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
                        <div style={{ 
                          marginTop: '20px', 
                          background: 'rgba(5, 11, 24, 0.85)', 
                          padding: '16px', 
                          borderRadius: '10px', 
                          border: '1px solid rgba(0, 210, 255, 0.3)',
                          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.4)'
                        }}>
                          <label style={{ 
                            fontSize: '0.82rem', 
                            fontWeight: 'bold', 
                            color: '#00D2FF', 
                            letterSpacing: '1.2px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '6px', 
                            marginBottom: '10px' 
                          }}>
                            🎟️ PROMO / DISCOUNTS / COUPON CODE
                          </label>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', width: '100%', alignItems: 'center' }}>
                            <input 
                              type="text"
                              placeholder="Enter Promo Code (e.g. TACTICAL50)" 
                              style={{ 
                                width: '100%', 
                                height: '48px', 
                                background: 'rgba(15, 23, 42, 0.9)', 
                                border: '1px solid rgba(0, 210, 255, 0.35)', 
                                borderRadius: '6px', 
                                color: '#FFFFFF', 
                                fontSize: '0.92rem', 
                                fontWeight: '600',
                                padding: '0 16px', 
                                textTransform: 'uppercase', 
                                letterSpacing: '1px',
                                outline: 'none',
                                boxSizing: 'border-box'
                              }}
                              value={couponInput}
                              onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                            />
                            <button 
                              type="button"
                              style={{ 
                                height: '48px', 
                                padding: '0 22px', 
                                fontSize: '0.88rem', 
                                fontWeight: 'bold', 
                                letterSpacing: '1px',
                                color: '#00D2FF',
                                background: 'rgba(0, 210, 255, 0.12)',
                                border: '1px solid #00D2FF',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxSizing: 'border-box',
                                transition: 'all 0.2s ease',
                                opacity: (!couponInput.trim() || isValidatingCoupon) ? 0.6 : 1
                              }}
                              onClick={handleApplyCoupon}
                              disabled={isValidatingCoupon || !couponInput.trim()}
                            >
                              {isValidatingCoupon ? "CHECKING..." : "APPLY CODE"}
                            </button>
                          </div>
                          {couponMsg && (
                            <div style={{ 
                              marginTop: '10px', 
                              fontSize: '0.85rem', 
                              color: couponMsg.startsWith('✔') ? '#34d399' : '#ff6b6b', 
                              fontWeight: 'bold',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}>
                              {couponMsg}
                            </div>
                          )}
                        </div>

                        {/* --- EXPLICIT ORDER SUMMARY & ANNUAL DISCOUNT CARD --- */}
                        <div style={{
                          background: 'rgba(5, 11, 24, 0.95)',
                          border: '1px solid rgba(0, 210, 255, 0.35)',
                          borderRadius: '10px',
                          padding: '16px',
                          marginTop: '20px',
                          marginBottom: '15px',
                          textAlign: 'left',
                          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.4)'
                        }}>
                          <div style={{ fontSize: '0.78rem', color: '#00D2FF', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '10px' }}>
                            💳 ORDER SUBSCRIPTION SUMMARY ({billingCycle.toUpperCase()})
                          </div>

                          {billingCycle === 'annual' ? (
                            <>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', color: '#CBD5E1', marginBottom: '6px' }}>
                                <span>Standard Monthly Rate (12 x $19.99/mo):</span>
                                <span style={{ textDecoration: 'line-through', color: '#94A3B8' }}>$239.88 / yr</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', color: '#34D399', fontWeight: 'bold', marginBottom: '8px' }}>
                                <span>Annual Plan Flat Discount:</span>
                                <span>-$22.50 FLAT SAVINGS</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', fontWeight: 'bold', color: '#FFF', paddingTop: '8px', borderTop: '1px dashed rgba(0,210,255,0.3)' }}>
                                <span>Discounted Annual Total:</span>
                                <span style={{ color: '#00D2FF', fontSize: '1.15rem' }}>$217.38 / yr</span>
                              </div>
                              <div style={{ fontSize: '0.72rem', color: '#38BDF8', marginTop: '4px', textAlign: 'right' }}>
                                (Equivalent to $18.11/mo billed annually)
                              </div>
                            </>
                          ) : (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', fontWeight: 'bold', color: '#FFF' }}>
                              <span>Monthly Total (Cancel Anytime):</span>
                              <span style={{ color: '#00D2FF', fontSize: '1.15rem' }}>$19.99 / mo</span>
                            </div>
                          )}
                        </div>

                        {/* --- EXPLICIT DISCOUNTED TOTAL SUMMARY CARD FOR COUPONS --- */}
                        {appliedCoupon && (
                          <div style={{
                            background: 'rgba(16, 185, 129, 0.08)',
                            border: '1px solid #10B981',
                            borderRadius: '10px',
                            padding: '14px 16px',
                            marginTop: '10px',
                            marginBottom: '15px',
                            textAlign: 'left',
                            boxShadow: '0 0 15px rgba(16, 185, 129, 0.2)'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <span style={{ fontSize: '0.78rem', color: '#94A3B8', fontWeight: 'bold', letterSpacing: '0.5px' }}>PROMO COUPON APPLIED:</span>
                              <span style={{ fontSize: '0.82rem', color: '#34D399', fontWeight: 'bold', background: 'rgba(16,185,129,0.2)', border: '1px solid #10B981', padding: '2px 8px', borderRadius: '4px' }}>
                                🎟️ {appliedCoupon.code || couponInput.toUpperCase()} ({appliedCoupon.discount_percent || appliedCoupon.discount_pct || 0}% OFF)
                              </span>
                            </div>
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.84rem', marginBottom: '4px' }}>
                              <span style={{ color: '#CBD5E1' }}>Pre-Coupon Subtotal:</span>
                              <span style={{ color: '#94A3B8', textDecoration: 'line-through' }}>
                                ${(appliedCoupon.original_price || (billingCycle === 'annual' ? 18.11 : 19.99)).toFixed(2)}/mo
                              </span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.84rem', marginBottom: '6px' }}>
                              <span style={{ color: '#34D399', fontWeight: 'bold' }}>Coupon Savings:</span>
                              <span style={{ color: '#34D399', fontWeight: 'bold' }}>
                                -${(appliedCoupon.savings || ((appliedCoupon.original_price || (billingCycle === 'annual' ? 18.11 : 19.99)) - appliedCoupon.final_price)).toFixed(2)}/mo
                              </span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.95rem', paddingTop: '8px', borderTop: '1px dashed rgba(16,185,129,0.3)', marginTop: '4px' }}>
                              <strong style={{ color: '#FFF' }}>FINAL DISCOUNTED TOTAL:</strong>
                              <strong style={{ color: '#34D399', fontSize: '1.15rem' }}>
                                ${appliedCoupon.final_price.toFixed(2)}/mo
                              </strong>
                            </div>
                          </div>
                        )}

                        <button 
                          className="main-button" 
                          style={{ 
                            width: '100%', 
                            marginTop: '15px', 
                            display: 'flex', 
                            flexDirection: 'column',
                            justifyContent: 'center', 
                            alignItems: 'center', 
                            gap: '4px',
                            background: appliedCoupon ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)' : 'linear-gradient(135deg, #00D2FF 0%, #0072FF 100%)',
                            color: '#ffffff',
                            fontWeight: 'bold',
                            fontSize: '1.05rem',
                            padding: '16px',
                            borderRadius: '8px',
                            boxShadow: appliedCoupon ? '0 0 25px rgba(16, 185, 129, 0.45)' : '0 0 20px rgba(0, 210, 255, 0.45)',
                            border: '1px solid rgba(255, 255, 255, 0.4)',
                            cursor: 'pointer',
                            letterSpacing: '1px',
                            transition: 'all 0.3s ease'
                          }} 
                          type="submit"
                          onClick={handleFinalPurchase}
                        >
                          {isMinting ? (
                            <><span className="cyberpunk-spinner"></span> INITIATING...</>
                          ) : appliedCoupon ? (
                            <>
                              <span>⚡ CONFIRM & INITIATE (${appliedCoupon.final_price.toFixed(2)}/mo)</span>
                              <span style={{ fontSize: '0.72rem', fontWeight: 'normal', opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                ✔ REFLECTS APPLIED COUPON DISCOUNT
                              </span>
                            </>
                          ) : billingCycle === 'annual' ? (
                            <>
                              <span>⚡ CONFIRM & INITIATE ($217.38/yr)</span>
                              <span style={{ fontSize: '0.72rem', fontWeight: 'normal', opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                ✔ INCLUDES $22.50 FLAT ANNUAL DISCOUNT
                              </span>
                            </>
                          ) : (
                            <>
                              <span>⚡ CONFIRM & INITIATE ($19.99/mo)</span>
                              <span style={{ fontSize: '0.72rem', fontWeight: 'normal', opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                ✔ MONTHLY SUBSCRIPTION (CANCEL ANYTIME)
                              </span>
                            </>
                          )}
                        </button>
                        
                        {appliedCoupon && (
                          <p style={{ fontSize: '0.78rem', color: '#34D399', margin: '8px 0 0 0', textAlign: 'center', fontWeight: 'bold' }}>
                            ✔ Coupon Applied: -${(appliedCoupon.savings || ((appliedCoupon.original_price || (billingCycle === 'annual' ? 18.11 : 19.99)) - appliedCoupon.final_price)).toFixed(2)}/mo savings applied to your order ({appliedCoupon.code || couponInput.toUpperCase()})
                          </p>
                        )}

                        <button type="button" className="reset-btn" style={{width: '100%', marginTop: '10px'}} onClick={() => window.location.hash = "pricing"}>BACK</button>
                      </form>
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

                        {/* --- STEP-BY-STEP ONBOARDING & VERIFICATION GUIDE --- */}
                        <div style={{
                          marginTop: '25px',
                          paddingTop: '20px',
                          borderTop: '1px dashed rgba(0, 210, 255, 0.3)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '16px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.82rem', color: '#00D2FF', fontWeight: 'bold', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                              🚀 YOUR ONBOARDING JOURNEY
                            </span>
                          </div>

                          {/* Step 1 */}
                          <div className="onboarding-journey-step" style={{
                            background: 'rgba(0, 71, 171, 0.08)',
                            border: '1px solid rgba(0, 71, 171, 0.3)',
                            borderRadius: '8px',
                            padding: '14px 16px',
                            display: 'flex',
                            flexDirection: 'row',
                            gap: '12px',
                            alignItems: 'flex-start'
                          }}>
                            <div style={{
                              background: 'var(--tiger-blue)',
                              color: '#FFF',
                              fontWeight: 'bold',
                              fontSize: '0.8rem',
                              borderRadius: '50%',
                              minWidth: '24px',
                              height: '24px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginTop: '2px',
                              flexShrink: 0
                            }}>1</div>
                            <div>
                              <div style={{ color: '#00D2FF', fontWeight: 'bold', fontSize: '0.88rem', marginBottom: '4px' }}>
                                Secure Checkout & Account Creation
                              </div>
                              <div style={{ color: '#cbd5e1', fontSize: '0.8rem', lineHeight: '1.4' }}>
                                Complete your secure checkout. Your encrypted account vault is created instantly.
                              </div>
                            </div>
                          </div>

                          {/* Step 2 */}
                          <div className="onboarding-journey-step" style={{
                            background: 'rgba(0, 71, 171, 0.08)',
                            border: '1px solid rgba(0, 71, 171, 0.3)',
                            borderRadius: '8px',
                            padding: '14px 16px',
                            display: 'flex',
                            flexDirection: 'row',
                            gap: '12px',
                            alignItems: 'flex-start'
                          }}>
                            <div style={{
                              background: 'var(--tiger-blue)',
                              color: '#FFF',
                              fontWeight: 'bold',
                              fontSize: '0.8rem',
                              borderRadius: '50%',
                              minWidth: '24px',
                              height: '24px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginTop: '2px',
                              flexShrink: 0
                            }}>2</div>
                            <div>
                              <div style={{ color: '#00D2FF', fontWeight: 'bold', fontSize: '0.88rem', marginBottom: '4px' }}>
                                Verification Email Check
                              </div>
                              <div style={{ color: '#cbd5e1', fontSize: '0.8rem', lineHeight: '1.4' }}>
                                Check your inbox for a quick verification message to activate your secure session and access your dashboard.
                              </div>
                            </div>
                          </div>

                          {/* Step 3 */}
                          <div className="onboarding-journey-step" style={{
                            background: 'rgba(0, 71, 171, 0.08)',
                            border: '1px solid rgba(0, 71, 171, 0.3)',
                            borderRadius: '8px',
                            padding: '14px 16px',
                            display: 'flex',
                            flexDirection: 'row',
                            gap: '12px',
                            alignItems: 'flex-start'
                          }}>
                            <div style={{
                              background: 'var(--tiger-blue)',
                              color: '#FFF',
                              fontWeight: 'bold',
                              fontSize: '0.8rem',
                              borderRadius: '50%',
                              minWidth: '24px',
                              height: '24px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginTop: '2px',
                              flexShrink: 0
                            }}>3</div>
                            <div>
                              <div style={{ color: '#00D2FF', fontWeight: 'bold', fontSize: '0.88rem', marginBottom: '4px' }}>
                                Generating Your First Alias
                              </div>
                              <div style={{ color: '#cbd5e1', fontSize: '0.8rem', lineHeight: '1.4' }}>
                                Once logged into your vault, head to the Aliases section to instantly generate your secure burner email and phone aliases to mask your real identity.
                              </div>
                            </div>
                          </div>

                          {/* Step 4 */}
                          <div className="onboarding-journey-step" style={{
                            background: 'rgba(0, 71, 171, 0.08)',
                            border: '1px solid rgba(0, 71, 171, 0.3)',
                            borderRadius: '8px',
                            padding: '14px 16px',
                            display: 'flex',
                            flexDirection: 'row',
                            gap: '12px',
                            alignItems: 'flex-start'
                          }}>
                            <div style={{
                              background: 'var(--tiger-blue)',
                              color: '#FFF',
                              fontWeight: 'bold',
                              fontSize: '0.8rem',
                              borderRadius: '50%',
                              minWidth: '24px',
                              height: '24px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginTop: '2px',
                              flexShrink: 0
                            }}>4</div>
                            <div>
                              <div style={{ color: '#00D2FF', fontWeight: 'bold', fontSize: '0.88rem', marginBottom: '4px' }}>
                                Continuous Data Removal
                              </div>
                              <div style={{ color: '#cbd5e1', fontSize: '0.8rem', lineHeight: '1.4' }}>
                                Once signed up, your identity data removal begins immediately and remains continuously active as long as your subscription is active.
                              </div>
                            </div>
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



      {/* --- ALIAS EMAIL REPLY & COMPOSE MODAL DIALOG --- */}
      {showAliasReplyModal && (
        <div 
          className="modal-overlay" 
          style={{ 
            zIndex: 60000, 
            display: 'flex', 
            alignItems: 'flex-start', 
            justifyContent: 'center', 
            padding: 'max(24px, env(safe-area-inset-top, 24px)) 12px max(24px, env(safe-area-inset-bottom, 24px)) 12px', 
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y'
          }} 
          onClick={() => setShowAliasReplyModal(false)}
        >
          <div 
            className="price-box" 
            style={{ 
              maxWidth: '540px', 
              width: '100%', 
              maxHeight: 'calc(100vh - 60px)', 
              overflowY: 'auto', 
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-y',
              textAlign: 'left', 
              boxSizing: 'border-box',
              padding: '24px',
              margin: 'auto 0',
              border: '1px solid var(--tiger-blue)'
            }} 
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 className="tiger-text" style={{ margin: 0, fontSize: '1.1rem' }}>
                {replyRecipientEmail ? "✉️ REPLY VIA ENCRYPTED ALIAS" : "✉️ COMPOSE OUTBOUND ALIAS EMAIL"}
              </h3>
              <button 
                type="button" 
                className="reset-btn" 
                style={{ padding: '2px 8px', fontSize: '0.8rem', color: '#94A3B8', borderColor: '#334155' }}
                onClick={() => setShowAliasReplyModal(false)}
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSendAliasReply} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#00D2FF', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>SELECT SENDER ALIAS IDENTITY</label>
                {emails && emails.length > 0 ? (
                  <select
                    className="mask-btn"
                    style={{ width: '100%', color: '#FCD34D', fontWeight: 'bold', background: '#020617', boxSizing: 'border-box', height: '42px', padding: '0 10px', margin: 0 }}
                    value={replyAliasEmail || (emails[0] ? emails[0].content : "")}
                    onChange={(e) => setReplyAliasEmail(e.target.value)}
                    required
                  >
                    {emails.map((e) => (
                      <option key={e.id} value={e.content}>
                        {e.label ? `${e.label.toUpperCase()} (${e.content})` : e.content}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    className="mask-btn"
                    style={{ width: '100%', color: '#FCD34D', fontWeight: 'bold', background: '#020617', boxSizing: 'border-box', height: '42px', padding: '0 10px', margin: 0 }}
                    placeholder="e.g. alias@anonaddy.me"
                    value={replyAliasEmail}
                    onChange={(e) => setReplyAliasEmail(e.target.value)}
                    required
                  />
                )}
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>RECIPIENT EMAIL ADDRESS</label>
                <input
                  type="email"
                  className="mask-btn"
                  style={{ width: '100%', color: '#FFF', boxSizing: 'border-box', height: '42px', padding: '0 10px', margin: 0 }}
                  placeholder="recipient@domain.com"
                  value={replyRecipientEmail}
                  onChange={(e) => setReplyRecipientEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>SUBJECT</label>
                <input
                  type="text"
                  className="mask-btn"
                  style={{ width: '100%', color: '#FFF', boxSizing: 'border-box', height: '42px', padding: '0 10px', margin: 0 }}
                  placeholder="Subject line..."
                  value={replySubject}
                  onChange={(e) => setReplySubject(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>MESSAGE BODY</label>
                <textarea
                  className="mask-btn"
                  style={{ width: '100%', color: '#FFF', minHeight: '120px', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'sans-serif', padding: '10px', margin: 0, lineHeight: '1.4' }}
                  placeholder="Type your message body..."
                  value={aliasReplyBody}
                  onChange={(e) => setAliasReplyBody(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '10px', flexWrap: 'wrap', width: '100%', boxSizing: 'border-box' }}>
                <button
                  type="submit"
                  className="main-button"
                  style={{ flex: 1, minWidth: '160px', height: '44px', margin: 0, padding: '0 16px', fontSize: '0.85rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}
                  disabled={isSendingAliasReply}
                >
                  {isSendingAliasReply ? "TRANSMITTING..." : (replyRecipientEmail ? "📤 DISPATCH ALIAS REPLY" : "📤 SEND ALIAS EMAIL")}
                </button>
                <button
                  type="button"
                  className="reset-btn"
                  style={{ flex: '0 0 auto', minWidth: '100px', height: '44px', margin: 0, padding: '0 16px', fontSize: '0.85rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}
                  onClick={() => setShowAliasReplyModal(false)}
                >
                  CANCEL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- DATA REMOVAL TARGET NOTICE MODAL (POPUP ON SIGN IN) --- */}
      {showDataRemovalNoticeModal && (
        <div className="modal-overlay" style={{ zIndex: 60050, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'max(16px, env(safe-area-inset-top, 16px)) 12px max(24px, env(safe-area-inset-bottom, 24px)) 12px', overflowY: 'auto' }} onClick={acknowledgeNoticeModal}>
          <div style={{ maxWidth: '540px', width: '100%', maxHeight: '82vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '24px 20px', textAlign: 'left', boxSizing: 'border-box', border: '1px solid #00D2FF', boxShadow: '0 10px 40px rgba(0,0,0,0.95), 0 0 35px rgba(0, 210, 255, 0.35)', borderRadius: '16px', background: 'linear-gradient(145deg, #090d16 0%, #030712 100%)', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.4rem' }}>🛡️</span>
                <h3 className="tiger-text" style={{ margin: 0, fontSize: '1.15rem', color: '#00D2FF', letterSpacing: '0.5px' }}>DATA REMOVAL TARGET NOTICE</h3>
              </div>
              <button type="button" className="reset-btn" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={acknowledgeNoticeModal}>✕ CLOSE</button>
            </div>

            {/* --- PROMINENT ADDY.IO EMAIL VERIFICATION CALLOUT BANNER --- */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.22) 0%, rgba(217, 119, 6, 0.28) 100%)',
              border: '2px solid #F59E0B',
              borderRadius: '10px',
              padding: '16px 18px',
              marginBottom: '18px',
              boxShadow: '0 0 25px rgba(245, 158, 11, 0.35)',
              textAlign: 'left'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '1.3rem' }}>⚠️</span>
                <h4 style={{ color: '#FCD34D', margin: 0, fontSize: '0.92rem', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                  ACTION REQUIRED: VERIFY YOUR EMAIL ADDRESS
                </h4>
              </div>

              <p style={{ color: '#F8FAFC', fontSize: '0.82rem', margin: '0 0 10px 0', lineHeight: '1.5' }}>
                Check your inbox for the verification email from <code>noreply@addy.io</code> and confirm your address to activate your secure email relays and complete your privacy shield setup.
              </p>

              <div style={{ fontSize: '0.78rem', color: '#00D2FF', background: 'rgba(5, 11, 20, 0.8)', padding: '8px 12px', borderRadius: '6px', borderLeft: '3px solid #00D2FF', marginBottom: '12px', lineHeight: '1.4' }}>
                💡 <strong>Note:</strong> Clicking your verification link authorizes forwarding. You do <u>not</u> need to log into Addy.io—simply close that tab once verified!
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button 
                  type="button" 
                  className="main-button" 
                  style={{ padding: '8px 14px', fontSize: '0.76rem', fontWeight: 'bold', background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)', border: 'none', color: '#FFF', cursor: 'pointer', boxShadow: '0 0 12px rgba(245, 158, 11, 0.4)' }}
                  onClick={handleResendAddyVerification}
                  disabled={isResendingAddyVerification}
                >
                  {isResendingAddyVerification ? "DISPATCHING..." : "📩 RESEND VERIFICATION EMAIL"}
                </button>
                <button 
                  type="button" 
                  className="reset-btn" 
                  style={{ padding: '8px 14px', fontSize: '0.76rem', fontWeight: 'bold', borderColor: '#F59E0B', color: '#FCD34D', cursor: 'pointer' }}
                  onClick={() => checkAddyRecipientStatus(true)}
                  disabled={isCheckingAddyStatus}
                >
                  {isCheckingAddyStatus ? "CHECKING..." : "🔄 CHECK VERIFICATION STATUS"}
                </button>
              </div>
            </div>

            <div style={{ padding: '14px', background: 'rgba(0, 210, 255, 0.08)', border: '1px solid rgba(0, 210, 255, 0.3)', borderRadius: '8px', marginBottom: '18px' }}>
              <p style={{ fontSize: '0.88rem', color: '#F8FAFC', margin: 0, lineHeight: '1.5' }}>
                ℹ️ <strong>IMPORTANT SERVICE DIRECTIVE:</strong> The legal name and profile details registered to your account will be the <strong>EXACT target searched, scrubbed, and removed</strong> across all 400+ data broker registries as part of your Data Freedom Solutions protection plan.
              </p>
            </div>

            {/* Target Details Card */}
            <div style={{ background: '#050B14', border: '1px solid #1E293B', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
                CURRENT TARGET PROFILE FOR DATA REMOVAL
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.84rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #0F172A', paddingBottom: '6px' }}>
                  <span style={{ color: '#94A3B8' }}>Legal Target Name:</span>
                  <strong style={{ color: '#00D2FF' }}>
                    {targetProfile.firstName || targetProfile.first_name || targetProfile.lastName || targetProfile.last_name 
                      ? `${targetProfile.firstName || targetProfile.first_name || ''} ${targetProfile.middleName || targetProfile.middle_name ? `${targetProfile.middleName || targetProfile.middle_name} ` : ''}${targetProfile.lastName || targetProfile.last_name || ''}`.trim() 
                      : (getSessionItem("disappear_user_email") || 'Registered Account Owner')}
                  </strong>
                </div>

                {(targetProfile.nickname || targetProfile.public_alias) && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #0F172A', paddingBottom: '6px' }}>
                    <span style={{ color: '#94A3B8' }}>Nickname / Public Record Alias:</span>
                    <strong style={{ color: '#FFD700' }}>
                      "{targetProfile.nickname || targetProfile.public_alias}"
                    </strong>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #0F172A', paddingBottom: '6px' }}>
                  <span style={{ color: '#94A3B8' }}>Target Address:</span>
                  <span style={{ color: '#E2E8F0', fontWeight: '500' }}>
                    {targetProfile.address || 'Address Not Set'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94A3B8' }}>Date of Birth:</span>
                  <span style={{ color: '#E2E8F0', fontWeight: '500' }}>
                    {targetProfile.dob || 'DOB Not Set'}
                  </span>
                </div>
              </div>
            </div>

            <p style={{ fontSize: '0.78rem', color: '#94A3B8', marginBottom: '22px', lineHeight: '1.4' }}>
              💡 If you need to update legal middle names, maiden names, or secondary addresses, click <strong>⚙️ REVIEW / EDIT PROFILE</strong> below.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                type="button" 
                className="main-button" 
                style={{ width: '100%', padding: '14px', fontSize: '0.9rem', fontWeight: 'bold' }}
                onClick={() => {
                  acknowledgeNoticeModal();
                }}
              >
                ✅ ACKNOWLEDGE & ENTER DASHBOARD
              </button>

              <button 
                type="button" 
                className="reset-btn" 
                style={{ width: '100%', padding: '10px', fontSize: '0.8rem', color: '#00D2FF', borderColor: '#00D2FF' }}
                onClick={() => {
                  acknowledgeNoticeModal();
                  window.location.hash = "vault";
                  setTimeout(() => {
                    const el = document.getElementById("profile");
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }, 300);
                }}
              >
                ⚙️ REVIEW / EDIT PROFILE DETAILS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- SIGNUP TARGET NAME NOTICE MODAL (POPUP ON SIGNUP) --- */}
      {showSignupTargetNoticeModal && (
        <div className="modal-overlay" style={{ zIndex: 60050, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'max(16px, env(safe-area-inset-top, 16px)) 12px max(24px, env(safe-area-inset-bottom, 24px)) 12px', overflowY: 'auto' }} onClick={() => setShowSignupTargetNoticeModal(false)}>
          <div style={{ maxWidth: '540px', width: '100%', maxHeight: '82vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '24px 20px', textAlign: 'left', boxSizing: 'border-box', border: '1px solid #00D2FF', boxShadow: '0 10px 40px rgba(0,0,0,0.95), 0 0 35px rgba(0, 210, 255, 0.35)', borderRadius: '16px', background: 'linear-gradient(145deg, #090d16 0%, #030712 100%)', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.4rem' }}>🛡️</span>
                <h3 className="tiger-text" style={{ margin: 0, fontSize: '1.15rem', color: '#00D2FF', letterSpacing: '0.5px' }}>REAL LEGAL NAME REQUIRED FOR SCRUBBING</h3>
              </div>
              <button type="button" className="reset-btn" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={() => setShowSignupTargetNoticeModal(false)}>✕ CLOSE</button>
            </div>

            <div style={{ padding: '14px', background: 'rgba(0, 210, 255, 0.08)', border: '1px solid rgba(0, 210, 255, 0.3)', borderRadius: '8px', marginBottom: '18px' }}>
              <p style={{ fontSize: '0.88rem', color: '#F8FAFC', margin: 0, lineHeight: '1.5' }}>
                ℹ️ <strong>SERVICE DIRECTIVE:</strong> The legal name entered during registration is the <strong>EXACT target searched, targeted, and removed</strong> across Whitepages, Spokeo, BeenVerified, LexisNexis, and 400+ public data broker registries.
              </p>
            </div>

            <div style={{ background: '#050B14', border: '1px solid #1E293B', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
              <h4 style={{ color: '#00D2FF', margin: '0 0 8px 0', fontSize: '0.88rem' }}>Why Your Real Legal Name & Address Are Mandatory:</h4>
              <ul style={{ margin: 0, paddingLeft: '20px', color: '#CBD5E1', fontSize: '0.82rem', lineHeight: '1.6' }}>
                <li>Public data brokers index individual profiles by their real legal full name and primary address.</li>
                <li>Entering a fake name or pseudonym will cause opt-out requests to fail against public records.</li>
                <li>Your real identity is kept 100% confidential inside your encrypted Disappear Vault.</li>
              </ul>
            </div>

            <button 
              type="button" 
              className="main-button" 
              style={{ width: '100%', padding: '14px', fontSize: '0.9rem', fontWeight: 'bold' }}
              onClick={() => setShowSignupTargetNoticeModal(false)}
            >
              ✅ UNDERSTOOD — I WILL ENTER MY REAL LEGAL NAME
            </button>
          </div>
        </div>
      )}

      {/* --- ONBOARDING & VERIFICATION INSTRUCTION MODAL --- */}
      {showOnboardingWelcomeModal && (
        <div className="modal-overlay" style={{ zIndex: 60000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 10px' }} onClick={() => setShowOnboardingWelcomeModal(false)}>
          <div className="price-box" style={{ maxWidth: '540px', width: '100%', padding: '28px', textAlign: 'left', boxSizing: 'border-box' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 className="tiger-text" style={{ margin: 0, fontSize: '1.15rem' }}>🚀 WELCOME TO DISAPPEAR — ONBOARDING GUIDE</h3>
              <button type="button" className="reset-btn" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={() => setShowOnboardingWelcomeModal(false)}>✕ CLOSE</button>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '18px', lineHeight: '1.5' }}>
              Your account profile, virtual relay nodes, and automated data scrub engine have been initialized! Follow this quick guide to complete email and phone forwarding setup:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '22px' }}>
              <div style={{ padding: '12px 16px', background: 'rgba(0, 71, 171, 0.15)', border: '1px solid rgba(0, 210, 255, 0.3)', borderRadius: '10px' }}>
                <h4 style={{ color: '#00D2FF', margin: '0 0 4px 0', fontSize: '0.9rem' }}>📧 Step 1: Email Verification Process</h4>
                <p style={{ fontSize: '0.8rem', color: '#cbd5e1', margin: '0 0 6px 0', lineHeight: '1.4' }}>
                  An activation email has been dispatched to your primary email address. Click the confirmation link inside to authorize continuous email alias forwarding to your inbox.
                </p>
                <div style={{ fontSize: '0.75rem', color: '#00D2FF', background: 'rgba(5, 11, 20, 0.7)', padding: '8px 12px', borderRadius: '6px', borderLeft: '3px solid #00D2FF', marginTop: '6px' }}>
                  💡 <strong>IMPORTANT:</strong> When you click the verification link and see <em>"Recipient verified"</em>, your email is 100% active! <u>You do NOT need to log into Addy.io</u>—simply close that browser tab and return to your Disappear Vault.
                </div>
              </div>

              <div style={{ padding: '12px 16px', background: 'rgba(0, 71, 171, 0.15)', border: '1px solid rgba(0, 210, 255, 0.3)', borderRadius: '10px' }}>
                <h4 style={{ color: '#00D2FF', margin: '0 0 4px 0', fontSize: '0.9rem' }}>📱 Step 2: Phone Relay Forwarding Setup</h4>
                <p style={{ fontSize: '0.8rem', color: '#94A3B8', margin: 0, lineHeight: '1.4' }}>
                  Incoming carrier text messages sent to your virtual burner numbers are logged to your Vault SMS Inbox and automatically forwarded via SMS to your real-world mobile device.
                </p>
              </div>

              <div style={{ padding: '12px 16px', background: 'rgba(0, 71, 171, 0.15)', border: '1px solid rgba(0, 210, 255, 0.3)', borderRadius: '10px' }}>
                <h4 style={{ color: '#00D2FF', margin: '0 0 4px 0', fontSize: '0.9rem' }}>🛡️ Step 3: Data Broker Opt-Out Engine</h4>
                <p style={{ fontSize: '0.8rem', color: '#94A3B8', margin: 0, lineHeight: '1.4' }}>
                  Our automated opt-out engine and human privacy analysts enforce continuous removals across 400+ major data broker databases.
                </p>
              </div>
            </div>

            <button 
              type="button" 
              className="main-button" 
              style={{ width: '100%', padding: '14px', fontSize: '0.9rem' }}
              onClick={() => {
                setShowOnboardingWelcomeModal(false);
                setShowLanding(false);
                setShowShield(true);
                syncDefenseData();
              }}
            >
              ⚡ UNDERSTOOD — ACCESS MY VAULT DASHBOARD
            </button>
          </div>
        </div>
      )}

      {/* --- ALIAS TERMINATION WARNING CONFIRMATION MODAL --- */}
      {showTerminateAliasModal && aliasToTerminate && (
        <div 
          className="modal-overlay" 
          style={{ 
            zIndex: 70000, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: 'max(20px, env(safe-area-inset-top, 20px)) 12px max(30px, env(safe-area-inset-bottom, 30px)) 12px', 
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y'
          }} 
          onClick={() => { setShowTerminateAliasModal(false); setAliasToTerminate(null); }}
        >
          <div 
            className="price-box" 
            style={{ 
              maxWidth: '480px', 
              width: '100%', 
              textAlign: 'center', 
              boxSizing: 'border-box',
              padding: '28px 22px',
              border: '2px solid #EF4444',
              boxShadow: '0 0 30px rgba(239, 68, 68, 0.45)',
              background: '#090305'
            }} 
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>⚠️</div>
            <h3 className="tiger-text" style={{ margin: '0 0 10px 0', fontSize: '1.2rem', color: '#EF4444', letterSpacing: '1px', textTransform: 'uppercase' }}>
              PERMANENT ALIAS TERMINATION
            </h3>
            
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.35)', padding: '12px', borderRadius: '6px', marginBottom: '16px', color: '#FCD34D', fontSize: '0.85rem', fontFamily: 'monospace', fontWeight: 'bold', wordBreak: 'break-all' }}>
              NODE: {aliasToTerminate.content || aliasToTerminate.label || "ALIAS NODE"}
            </div>

            <p style={{ fontSize: '0.85rem', color: '#E2E8F0', lineHeight: '1.5', margin: '0 0 22px 0' }}>
              <strong>Warning:</strong> Terminating this alias is <strong>permanent</strong>. You will no longer have access to incoming messages, emails, or calls associated with this number/address.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', width: '100%' }}>
              <button 
                type="button" 
                className="reset-btn" 
                style={{ padding: '10px 14px', fontSize: '0.80rem', fontWeight: 'bold', color: '#94A3B8', borderColor: '#475569', width: '100%' }}
                onClick={() => { setShowTerminateAliasModal(false); setAliasToTerminate(null); }}
              >
                ✕ CANCEL
              </button>
              <button 
                type="button" 
                className="main-button" 
                style={{ padding: '10px 14px', fontSize: '0.80rem', fontWeight: 'bold', background: 'linear-gradient(135deg, #DC2626, #991B1B)', border: '1px solid #EF4444', color: '#FFF', width: '100%' }}
                onClick={confirmKillAlias}
              >
                🗑️ CONFIRM TERMINATION
              </button>
            </div>
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
          <div className="price-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px', width: '100%', padding: '25px' }}>
            <h3 className="tiger-text" style={{ marginBottom: '15px' }}>🎟️ SUPPORT & ASSISTANCE UPLINK</h3>
            
            <form onSubmit={(e) => { e.preventDefault(); handleSendTicket(); }} autoComplete="on" style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
              <div>
                <p className="field-label" style={{ marginBottom: '4px' }}>YOUR EMAIL ADDRESS (FOR REPLY)</p>
                <input
                  type="email"
                  name="disappear_support_reply_email"
                  id="disappear_support_reply_email"
                  autoComplete="email"
                  className="mask-btn"
                  style={{ width: '100%', color: 'white', fontSize: '0.85rem', boxSizing: 'border-box' }}
                  placeholder="customer@email.com"
                  value={supportData.email !== undefined ? supportData.email : (targetProfile.email || getSessionItem("disappear_user_email") || "")}
                  onChange={(e) => setSupportData({...supportData, email: e.target.value})}
                  required
                />
              </div>

              <div>
                <p className="field-label" style={{ marginBottom: '4px' }}>ISSUE CATEGORY</p>
                <select className="mask-btn" style={{width: '100%', background: '#000', color: 'white', fontSize: '0.85rem', boxSizing: 'border-box'}} value={supportData.category || "GENERAL_INQUIRY"} onChange={(e) => setSupportData({...supportData, category: e.target.value, subject: e.target.value})}>
                  <option value="GENERAL_INQUIRY">GENERAL INQUIRY / ASSISTANCE</option>
                  <option value="PAYMENT_ERR">BILLING & PAYMENT ISSUE</option>
                  <option value="NODE_ERR">DATA BROKER OPT-OUT FAILURE</option>
                  <option value="PURGE_ERR">ALIAS / FORWARDING ISSUE</option>
                  <option value="OTHER">OTHER INQUIRY</option>
                </select>
              </div>

              <div>
                <p className="field-label" style={{ marginBottom: '4px' }}>INQUIRY DESCRIPTION</p>
                <textarea className="mask-btn" style={{width: '100%', height: '110px', color: 'white', textAlign: 'left', paddingTop: '10px', fontSize: '0.85rem', boxSizing: 'border-box'}} placeholder="Describe your question or issue in detail..." value={supportData.message} onChange={(e) => setSupportData({...supportData, message: e.target.value})} required />
              </div>

              <button type="submit" className="main-button" style={{width: '100%', marginTop: '10px'}}>⚡ TRANSMIT SUPPORT TICKET</button>
              <button type="button" className="reset-btn" style={{width: '100%'}} onClick={() => setShowSupportModal(false)}>CANCEL</button>
            </form>
          </div>
        </div>
      )}

      {/* --- GLOBAL FORGOT PASSWORD MODAL --- */}
      {showForgotPasswordModal && (
        <div 
          className="modal-overlay" 
          style={{ 
            zIndex: 60000, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            overflowY: 'auto', 
            WebkitOverflowScrolling: 'touch',
            padding: '20px 10px'
          }} 
          onClick={() => setShowForgotPasswordModal(false)}
        >
          <div 
            className="price-box" 
            style={{ 
              maxWidth: '420px', 
              width: '100%', 
              maxHeight: '85vh', 
              overflowY: 'auto', 
              WebkitOverflowScrolling: 'touch',
              padding: '25px', 
              textAlign: 'left',
              boxSizing: 'border-box'
            }} 
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 className="tiger-text" style={{ margin: 0, fontSize: '1.1rem' }}>🔑 RESET VAULT PASSWORD</h3>
              <button 
                type="button" 
                className="reset-btn" 
                style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                onClick={() => setShowForgotPasswordModal(false)}
              >
                ✕ CLOSE
              </button>
            </div>

            <p style={{ fontSize: '0.78rem', color: '#94A3B8', marginBottom: '15px', lineHeight: '1.4' }}>
              Enter your registered account email to receive a 6-digit SMS verification code on your registered mobile phone.
            </p>

            <form onSubmit={handleForgotPasswordSubmit} autoComplete="on" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <p className="field-label" style={{ marginBottom: '4px' }}>REGISTERED ACCOUNT EMAIL</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="email" 
                    name="disappear_forgot_email"
                    autoComplete="username"
                    className="mask-btn" 
                    style={{ flex: 1, color: 'white', fontSize: '0.85rem' }} 
                    placeholder="customer@email.com" 
                    value={forgotEmail} 
                    onChange={(e) => setForgotEmail(e.target.value)} 
                    required
                  />
                  <button
                    type="button"
                    className="main-button"
                    style={{ padding: '8px 12px', fontSize: '0.72rem', whiteSpace: 'nowrap' }}
                    onClick={() => handleSendResetCode(forgotEmail)}
                    disabled={isSendingResetCode}
                  >
                    {isSendingResetCode ? "SENDING..." : (isResetCodeSent ? "RESEND 📱" : "SEND CODE 📱")}
                  </button>
                </div>
              </div>

              <div>
                <p className="field-label" style={{ marginBottom: '4px' }}>📱 6-DIGIT SMS VERIFICATION CODE</p>
                <input 
                  type="text" 
                  className="mask-btn" 
                  style={{ width: '100%', color: '#00D2FF', fontSize: '1.1rem', letterSpacing: '4px', textAlign: 'center', fontWeight: 'bold', boxSizing: 'border-box' }} 
                  placeholder="123456" 
                  maxLength={6}
                  value={forgotCode} 
                  onChange={(e) => setForgotCode(e.target.value)} 
                  required
                />
              </div>

              <div>
                <p className="field-label" style={{ marginBottom: '4px' }}>NEW PASSWORD</p>
                <input 
                  type="password" 
                  name="disappear_forgot_new_password"
                  autoComplete="new-password"
                  className="mask-btn" 
                  style={{ width: '100%', color: 'white', fontSize: '0.85rem' }} 
                  placeholder="New Password (min 6 chars)" 
                  value={forgotNewPassword} 
                  onChange={(e) => setForgotNewPassword(e.target.value)} 
                  required
                />
              </div>

              <div>
                <p className="field-label" style={{ marginBottom: '4px' }}>CONFIRM NEW PASSWORD</p>
                <input 
                  type="password" 
                  name="disappear_forgot_confirm_password"
                  autoComplete="new-password"
                  className="mask-btn" 
                  style={{ width: '100%', color: 'white', fontSize: '0.85rem' }} 
                  placeholder="Confirm New Password" 
                  value={forgotConfirmPassword} 
                  onChange={(e) => setForgotConfirmPassword(e.target.value)} 
                  required
                />
              </div>

              <button 
                type="submit" 
                className="main-button" 
                disabled={isResettingPassword}
                style={{ width: '100%', marginTop: '10px' }}
              >
                {isResettingPassword ? "VERIFYING..." : "⚡ VERIFY CODE & RESET PASSWORD"}
              </button>
            </form>
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

    </div>
  );
}

export default App;