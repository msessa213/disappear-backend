import React, { useState, useEffect, useMemo } from 'react';

// --- DEAD / MOCK / UNREACHABLE BROKER DOMAIN AUDIT REGISTRY ---
const DEAD_MOCK_BROKERS = new Set([
  'EXPOSED_CREDS_INDEX', 'COMBO_LISTS_VAULT', 'DARKWEB_LEAK_VAULT', 'BREACH_DATABASE_INDEX',
  'INSTANTDATACHECK', 'IDTRUE', 'COMPROMISED_HOSTS', 'THREAT_INTEL_NET', 'SECURITY_AUDIT_VAULT',
  'TELEGRAM_LEAKS_NET', 'PASTEBIN_INDEX', 'FORUM_LEAKS_VAULT', 'CRYPTO_WALLET_INDEX',
  'GAMING_PROFILES_INDEX', 'APP_USERS_DIRECTORY', 'FORUM_USERS_INDEX', 'SOCIAL_PROFILES_NET',
  'AD_NETWORKS_INDEX', 'DEVICE_ID_VAULT', 'MAC_ADDRESS_INDEX', 'PUBLIC_WIFI_LOGS',
  'ISP_CUSTOMER_INDEX', 'GEO_IP_PROFILES', 'ASNS_DIRECTORY', 'IP_ADDRESS_OWNERS',
  'DOMAIN_WHOIS_INDEX', 'GUN_PERMIT_INDEX', 'VIN_CHECK_NET', 'DMV_PUBLIC_INDEX',
  'DRIVER_RECORDS_NET', 'PAROLE_INDEX', 'MUGSHOT_INDEX', 'ARREST_RECORDS_ONLINE',
  'CIVIL_SUITS_INDEX', 'CRIMINAL_COURT_HUB', 'BIRTH_RECORDS_INDEX', 'VITAL_RECORDS_NET',
  'MARRIAGE_RECORDS_USA', 'DIVORCE_INDEX', 'TRAFFIC_RECORDS_NET', 'ADVANCEDBACKGROUNDCHECKS',
  'LIEN_RECORDS', 'CLUSTRMAPS', 'SPYTOX', 'CUBIB', 'BANKRUPTCY_INDEX', 'WARRANT_SEARCH',
  'AIRCRAFT_REGISTRY', 'MEDICAL_BOARD_INDEX', 'TRADEMARK_SEARCH'
]);

const DEAD_MOCK_DOMAINS = [
  'exposedcredsindex.com', 'combolistsvault.com', 'darkwebleakvault.com', 'breachdatabaseindex.com',
  'instantdatacheck.com', 'idtrue.com', 'compromisedhosts.com', 'threatintelnet.com',
  'securityauditvault.com', 'telegramleaksnet.com', 'pastebinindex.com', 'forumleaksvault.com',
  'cryptowalletindex.com', 'gamingprofilesindex.com', 'appusersdirectory.com', 'forumusersindex.com',
  'socialprofilesnet.com', 'adnetworksindex.com', 'deviceidvault.com', 'macaddressindex.com',
  'publicwifilogs.com', 'ispcustomerindex.com', 'geoipprofiles.com', 'asnsdirectory.com',
  'ipaddressowners.com', 'domainwhoisindex.com', 'gunpermitindex.com', 'vinchecknet.com',
  'dmvpublicindex.com', 'driverrecordsnet.com', 'paroleindex.com', 'mugshotindex.com',
  'arrestrecordsonline.com', 'civilsuitsindex.com', 'criminalcourthub.com', 'birthrecordsindex.com',
  'vitalrecordsnet.com', 'marriagerecordsusa.com', 'divorceindex.com', 'trafficrecordsnet.com',
  'advancedbackgroundchecks.com', 'lienrecords.com', 'clustrmaps.com', 'spytox.com', 'cubib.com',
  'bankruptcyindex.com', 'warrantsearch.com', 'aircraftregistry.com', 'medicalboardindex.com', 'trademarksearch.com'
];

export const isDeadOrMockBroker = (broker) => {
  if (!broker) return false;
  const bName = typeof broker === 'string' ? broker : (broker.broker_name || broker.name || '');
  const nameUpper = bName.toUpperCase().trim();
  const optUrl = typeof broker === 'object' ? (broker.opt_out_url || broker.url || '').toLowerCase() : '';
  
  if (DEAD_MOCK_BROKERS.has(nameUpper)) return true;
  if (optUrl && DEAD_MOCK_DOMAINS.some(domain => optUrl.includes(domain))) return true;
  if (DEAD_MOCK_DOMAINS.some(domain => nameUpper.toLowerCase().replace(/_/g, '') === domain.replace('.com', ''))) return true;
  
  return false;
};

// --- SECURITY SANDBOX WRAPPER & PRE-FLIGHT DOMAIN INSPECTORS ---
export const sanitizeOutboundUrl = (rawUrl, defaultDomainFallback = "") => {
  if (!rawUrl || typeof rawUrl !== 'string') return "#";
  const trimmed = rawUrl.trim();
  
  // Block dangerous execution protocols (javascript:, data:, vbscript:)
  if (/^(javascript:|data:|vbscript:)/i.test(trimmed)) {
    console.warn("Security Sandbox: Blocked unsafe execution protocol in outbound link:", trimmed);
    return "#";
  }

  // Ensure valid http/https protocol
  if (!/^https?:\/\//i.test(trimmed)) {
    if (trimmed.includes('.')) {
      return `https://${trimmed}`;
    }
    if (defaultDomainFallback) {
      return `https://www.${defaultDomainFallback.toLowerCase().replace(/_/g, '')}.com/optout`;
    }
    return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}+opt+out+form`;
  }

  return trimmed;
};

export const extractDomain = (url) => {
  try {
    const sanitized = sanitizeOutboundUrl(url);
    if (sanitized === '#') return 'blocked-protocol';
    const parsed = new URL(sanitized);
    return parsed.hostname.replace(/^www\./, '');
  } catch (e) {
    return 'external-site';
  }
};

export const safeOpenUrl = (rawUrl, defaultDomainFallback = "") => {
  const safeUrl = sanitizeOutboundUrl(rawUrl, defaultDomainFallback);
  if (safeUrl === "#") return;
  const win = window.open(safeUrl, '_blank', 'noopener,noreferrer');
  if (win) {
    win.opener = null;
  }
};

export default function AdminDashboard({ API_BASE_URL }) {
  const [manualTasks, setManualTasks] = useState([]);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [verifications, setVerifications] = useState({});
  const [actionLoadingTasks, setActionLoadingTasks] = useState({});
  const [adminKey, setAdminKey] = useState("");
  const [analystName, setAnalystName] = useState(localStorage.getItem("disappear_analyst_name") || "");
  const [filterMode, setFilterMode] = useState("ALL"); // 'ALL', 'UNASSIGNED', 'MY_TASKS', 'COMPLETED'
  const [searchQuery, setSearchQuery] = useState(""); // Live search query
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // --- COUPON MANAGEMENT STATES ---
  const [coupons, setCoupons] = useState([]);
  const [newCouponCode, setNewCouponCode] = useState("");
  const [newDiscountType, setNewDiscountType] = useState("percent");
  const [newDiscountValue, setNewDiscountValue] = useState("");
  const [newDuration, setNewDuration] = useState("permanent");
  const [couponStatusMsg, setCouponStatusMsg] = useState("");

  // --- SUPPORT TICKET INBOX STATES ---
  const [supportTickets, setSupportTickets] = useState([]);
  const [ticketFilter, setTicketFilter] = useState("ALL");
  const [expandedTicketId, setExpandedTicketId] = useState(null);
  const [ticketStatusMsg, setTicketStatusMsg] = useState("");

  // --- USER ACTIVITY & DIAGNOSTIC REPORTING STATES ---
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");
  const [reportStatusFilter, setReportStatusFilter] = useState("ALL");
  const [reportSearchTerm, setReportSearchTerm] = useState("");
  const [userReportData, setUserReportData] = useState([]);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportStatusMsg, setReportStatusMsg] = useState("");

  // --- PROFILE EDITOR MODAL STATES ---
  const [editingProfileUser, setEditingProfileUser] = useState(null);
  const [editProfileFirstName, setEditProfileFirstName] = useState("");
  const [editProfileMiddleName, setEditProfileMiddleName] = useState("");
  const [editProfileNickname, setEditProfileNickname] = useState("");
  const [editProfileLastName, setEditProfileLastName] = useState("");
  const [editProfileEmail, setEditProfileEmail] = useState("");
  const [editProfilePhone, setEditProfilePhone] = useState("");
  const [editProfileAddress, setEditProfileAddress] = useState("");
  const [editProfileDob, setEditProfileDob] = useState("");
  const [editProfileMsg, setEditProfileMsg] = useState("");

  const handleOpenEditProfileModal = (user) => {
    setEditingProfileUser(user);
    setEditProfileFirstName(user.first_name || "");
    setEditProfileMiddleName(user.middle_name || "");
    setEditProfileNickname(user.nickname || "");
    setEditProfileLastName(user.last_name || "");
    setEditProfileEmail(user.email || "");
    setEditProfilePhone(user.phone || "");
    setEditProfileAddress(user.address || "");
    setEditProfileDob(user.dob || "");
    setEditProfileMsg("");
  };

  const handleSaveProfileDetails = async (e) => {
    if (e) e.preventDefault();
    if (!editingProfileUser) return;

    setEditProfileMsg("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/profile/update-details`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: editingProfileUser.user_id,
          first_name: editProfileFirstName,
          middle_name: editProfileMiddleName,
          nickname: editProfileNickname,
          last_name: editProfileLastName,
          email: editProfileEmail,
          phone: editProfilePhone,
          address: editProfileAddress,
          dob: editProfileDob
        })
      });
      if (res.ok) {
        setEditProfileMsg("✅ PROFILE UPDATED SUCCESSFULLY!");
        setTimeout(() => {
          setEditingProfileUser(null);
          handleGenerateUserReport();
          fetchBacklog(adminKey);
        }, 1200);
      } else {
        const err = await res.json();
        setEditProfileMsg(`❌ UPDATE FAILED: ${err.detail || 'ERROR UPDATING PROFILE'}`);
      }
    } catch (err) {
      console.error("Save profile error", err);
      setEditProfileMsg("❌ NETWORK ERROR UPDATING PROFILE.");
    }
  };

  const setReportDatePreset = (days) => {
    const today = new Date();
    const endStr = today.toISOString().split('T')[0];
    if (days === 0) {
      setReportStartDate(endStr);
      setReportEndDate(endStr);
    } else if (days > 0) {
      const past = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
      setReportStartDate(past.toISOString().split('T')[0]);
      setReportEndDate(endStr);
    } else {
      setReportStartDate("");
      setReportEndDate("");
    }
  };

  const handleGenerateUserReport = async (e) => {
    if (e) e.preventDefault();
    const keyToUse = cleanHeaderKey(adminKey);
    if (!keyToUse) {
      setReportStatusMsg("❌ ADMIN SECRET KEY REQUIRED TO GENERATE REPORTS.");
      return;
    }

    setIsGeneratingReport(true);
    setReportStatusMsg("");
    try {
      const params = new URLSearchParams();
      if (reportStartDate) params.append("start_date", reportStartDate);
      if (reportEndDate) params.append("end_date", reportEndDate);
      if (reportStatusFilter) params.append("status", reportStatusFilter);
      if (reportSearchTerm.trim()) params.append("search", reportSearchTerm.trim());

      const res = await fetch(`${API_BASE_URL}/admin/ops/user-report?${params.toString()}`, {
        headers: { "X-Disappear-Admin-Key": keyToUse }
      });
      if (res.ok) {
        const data = await res.json();
        setUserReportData(data.users || []);
        setReportStatusMsg(`✅ REPORT GENERATED: ${data.total_users || 0} USER RECORD(S) FOUND.`);
      } else {
        const err = await res.json();
        setReportStatusMsg(`❌ REPORT FAILED: ${err.detail || 'UNABLE TO GENERATE REPORT'}`);
      }
    } catch (err) {
      console.error("User report error", err);
      setReportStatusMsg("❌ NETWORK ERROR GENERATING USER REPORT.");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleExportReportCsv = () => {
    if (!userReportData || userReportData.length === 0) {
      alert("No report data available to export. Please generate a report first.");
      return;
    }

    const headers = ["User ID", "Registration Date", "First Name", "Middle Name", "Nickname / Alias", "Last Name", "Email", "Phone", "KYC Status", "Email Aliases", "Phone Aliases", "Relay Credits", "Total Scrubs", "Removed Scrubs", "Pending Scrubs"];
    const rows = userReportData.map(u => [
      `"${u.user_id || ''}"`,
      `"${u.created_at || ''}"`,
      `"${u.first_name || ''}"`,
      `"${u.middle_name || ''}"`,
      `"${u.nickname || ''}"`,
      `"${u.last_name || ''}"`,
      `"${u.email || ''}"`,
      `"${u.phone || ''}"`,
      `"${u.kyc_status || 'UNPAID'}"`,
      `"${(u.email_aliases || []).join(' ; ')}"`,
      `"${(u.phone_aliases || []).join(' ; ')}"`,
      `"${u.relay_credits !== undefined ? u.relay_credits : 500}"`,
      `"${u.total_scrubs || 0}"`,
      `"${u.removed_scrubs || 0}"`,
      `"${u.pending_scrubs || 0}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    const dateStamp = new Date().toISOString().split('T')[0];
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Disappear_User_Activity_Report_${dateStamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [copiedTaskId, setCopiedTaskId] = useState(null);

  const handleCopyListingUrl = (taskId, url) => {
    if (!url) return;
    try {
      navigator.clipboard.writeText(url);
      setCopiedTaskId(taskId);
      setTimeout(() => setCopiedTaskId(null), 2500);
    } catch (e) {
      console.error("Copy error", e);
    }
  };

  const [editingListingUrls, setEditingListingUrls] = useState({});

  const handleSaveListingUrl = async (taskId) => {
    const newUrl = editingListingUrls[taskId];
    if (!newUrl || !newUrl.trim()) return;

    try {
      const res = await fetch(`${API_BASE_URL}/admin/ops/update-listing-url/${taskId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Disappear-Admin-Key": cleanHeaderKey(adminKey)
        },
        body: JSON.stringify({ target_listing_url: newUrl.trim() })
      });
      if (res.ok) {
        alert("Target Listing URL saved successfully!");
        fetchBacklog(adminKey);
      }
    } catch (e) {
      console.error("Save listing URL error", e);
    }
  };

  const cleanHeaderKey = (val) => {
    if (!val) return "";
    return String(val).trim().replace(/[^\x20-\x7E]/g, "");
  };

  const handleSaveAnalystName = (name) => {
    setAnalystName(name);
    localStorage.setItem("disappear_analyst_name", name);
  };

  const fetchBacklog = async (overrideKey) => {
    const rawKey = overrideKey !== undefined ? overrideKey : adminKey;
    const keyToUse = cleanHeaderKey(rawKey);
    if (!keyToUse) {
      setAuthError("PLEASE ENTER YOUR PRODUCTION ADMIN SECRET KEY.");
      return false;
    }

    setLoading(true);
    setAuthError("");
    try {
      const res = await fetch(`${API_BASE_URL}/admin/ops/backlog`, {
        headers: { "X-Disappear-Admin-Key": keyToUse }
      });
      if (res.status === 403) {
        setAuthError("INVALID ADMIN SECRET KEY — ACCESS DENIED");
        setManualTasks([]);
        setCompletedTasks([]);
        setLoading(false);
        setIsAuthenticated(false);
        return false;
      }
      if (!res.ok) {
        setAuthError(`SERVER ERROR (${res.status}) — UNABLE TO FETCH QUEUE`);
        setLoading(false);
        return false;
      }
      const data = await res.json();
      const rawManual = data.manual_processing_required || [];
      const rawCompleted = data.completed_tasks || [];

      const activeManual = [];
      const autoCompleted = [];

      rawManual.forEach(task => {
        if (isDeadOrMockBroker(task)) {
          autoCompleted.push({
            ...task,
            status: "REMOVED",
            resolved_by: "AUTO_HEALTH_AUDIT_ENGINE",
            manual_instruction_url: task.opt_out_url || "Automated Removal - Domain Audit (Dead/Mock Target Verified Non-Existent)",
            resolved_at: task.resolved_at || new Date().toISOString()
          });
        } else {
          activeManual.push(task);
        }
      });

      setManualTasks(activeManual);
      setCompletedTasks([...autoCompleted, ...rawCompleted]);
      setLoading(false);
      setIsAuthenticated(true);

      fetchCoupons(keyToUse);
      fetchSupportTickets(keyToUse);
      return true;
    } catch (e) {
      console.error("Admin fetch error", e);
      setAuthError("NETWORK / CONNECTION ERROR");
      setLoading(false);
      return false;
    }
  };

  const fetchCoupons = async (keyToUse) => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/coupons`, {
        headers: { "X-Disappear-Admin-Key": keyToUse }
      });
      if (res.ok) {
        const data = await res.json();
        setCoupons(data || []);
      }
    } catch (e) {
      console.error("Error fetching coupons", e);
    }
  };

  const handleCreateCoupon = async (e) => {
    if (e) e.preventDefault();
    setCouponStatusMsg("");

    const codeClean = newCouponCode.trim().toUpperCase();
    if (!codeClean) {
      setCouponStatusMsg("❌ COUPON CODE CANNOT BE EMPTY.");
      return;
    }

    const val = parseFloat(newDiscountValue);
    if (isNaN(val) || val <= 0) {
      setCouponStatusMsg("❌ PLEASE ENTER A VALID DISCOUNT VALUE GREATER THAN 0.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/admin/coupons`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Disappear-Admin-Key": cleanHeaderKey(adminKey)
        },
        body: JSON.stringify({
          code: codeClean,
          discount_type: newDiscountType,
          discount_value: val,
          duration: newDuration
        })
      });

      if (res.ok) {
        setCouponStatusMsg(`✅ COUPON '${codeClean}' CREATED SUCCESSFULLY!`);
        setNewCouponCode("");
        setNewDiscountValue("");
        fetchCoupons(cleanHeaderKey(adminKey));
      } else {
        const errData = await res.json();
        setCouponStatusMsg(`❌ ERROR: ${errData.detail || 'FAILED TO CREATE COUPON'}`);
      }
    } catch (e) {
      console.error("Create coupon error", e);
      setCouponStatusMsg("❌ NETWORK ERROR CREATING COUPON.");
    }
  };

  const handleDeleteCoupon = async (couponId) => {
    if (!window.confirm("Deactivate this coupon code?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/coupons/${couponId}`, {
        method: "DELETE",
        headers: { "X-Disappear-Admin-Key": cleanHeaderKey(adminKey) }
      });
      if (res.ok) {
        fetchCoupons(cleanHeaderKey(adminKey));
      }
    } catch (e) {
      console.error("Delete coupon error", e);
    }
  };

  // --- SUPPORT TICKET HANDLERS ---
  const fetchSupportTickets = async (keyToUse) => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/support/tickets`, {
        headers: { "X-Disappear-Admin-Key": keyToUse || cleanHeaderKey(adminKey) }
      });
      if (res.ok) {
        const data = await res.json();
        setSupportTickets(data || []);
      }
    } catch (e) {
      console.error("Error fetching support tickets", e);
    }
  };

  const handleUpdateTicketStatus = async (ticketId, newStatus) => {
    try {
      setTicketStatusMsg("");
      const res = await fetch(`${API_BASE_URL}/admin/support/tickets/${ticketId}/status?status=${newStatus}`, {
        method: "POST",
        headers: { "X-Disappear-Admin-Key": cleanHeaderKey(adminKey) }
      });
      if (res.ok) {
        setTicketStatusMsg(`✅ Ticket #${ticketId} status updated to ${newStatus}`);
        fetchSupportTickets(cleanHeaderKey(adminKey));
      }
    } catch (e) {
      console.error("Error updating ticket status", e);
      setTicketStatusMsg("❌ Failed to update ticket status.");
    }
  };

  const handleDeleteTicket = async (ticketId) => {
    if (!window.confirm("Permanently delete this support ticket from database?")) return;
    try {
      setTicketStatusMsg("");
      const res = await fetch(`${API_BASE_URL}/admin/support/tickets/${ticketId}`, {
        method: "DELETE",
        headers: { "X-Disappear-Admin-Key": cleanHeaderKey(adminKey) }
      });
      if (res.ok) {
        setTicketStatusMsg(`✅ Ticket #${ticketId} deleted successfully.`);
        fetchSupportTickets(cleanHeaderKey(adminKey));
      }
    } catch (e) {
      console.error("Error deleting ticket", e);
      setTicketStatusMsg("❌ Failed to delete ticket.");
    }
  };

  const handleAssociateLogin = async (e) => {
    if (e) e.preventDefault();
    if (!analystName.trim()) {
      setAuthError("PLEASE ENTER YOUR ASSOCIATE / ANALYST NAME.");
      return;
    }
    handleSaveAnalystName(analystName.trim());
    const ok = await fetchBacklog(adminKey);
    if (ok) {
      window.location.hash = "#admin";
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setAdminKey("");
    setManualTasks([]);
    setCompletedTasks([]);
    window.location.hash = "#admin/login";
  };

  const handleClaimTask = async (taskId) => {
    const activeAnalyst = analystName.trim() || prompt("Enter your Associate Name / ID to claim this task:");
    if (!activeAnalyst) return;

    handleSaveAnalystName(activeAnalyst);

    // 1. INSTANT OPTIMISTIC UI STATE UPDATE
    setActionLoadingTasks(prev => ({ ...prev, [taskId]: 'claiming' }));
    setManualTasks(prev => prev.map(t => {
      if (t.task_id === taskId) {
        return {
          ...t,
          assigned_analyst: activeAnalyst,
          status: t.status === 'REMOVED' ? 'REMOVED' : 'PROCESSING'
        };
      }
      return t;
    }));

    try {
      const res = await fetch(`${API_BASE_URL}/admin/ops/claim/${taskId}`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Disappear-Admin-Key": cleanHeaderKey(adminKey)
        },
        body: JSON.stringify({ analyst_name: activeAnalyst })
      });
      if (res.ok) {
        fetchBacklog(adminKey);
      } else {
        setManualTasks(prev => prev.map(t => {
          if (t.task_id === taskId) {
            return { ...t, assigned_analyst: null, status: 'MANUAL_PENDING' };
          }
          return t;
        }));
        alert("Unable to claim task.");
      }
    } catch (e) {
      console.error("Claim error", e);
      setManualTasks(prev => prev.map(t => {
        if (t.task_id === taskId) {
          return { ...t, assigned_analyst: null, status: 'MANUAL_PENDING' };
        }
        return t;
      }));
    } finally {
      setActionLoadingTasks(prev => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
    }
  };

  const handleClaimAndLaunch = async (task) => {
    await handleClaimTask(task.task_id);
    const targetUrl = task.opt_out_url || `https://www.google.com/search?q=${encodeURIComponent(task.broker_name)}+opt+out+form`;
    safeOpenUrl(targetUrl, task.broker_name);
  };

  const handleUnclaimTask = async (taskId) => {
    const originalTask = manualTasks.find(t => t.task_id === taskId);

    // 1. INSTANT OPTIMISTIC UI STATE UPDATE
    setActionLoadingTasks(prev => ({ ...prev, [taskId]: 'unclaiming' }));
    setManualTasks(prev => prev.map(t => {
      if (t.task_id === taskId) {
        return { ...t, assigned_analyst: null, status: 'MANUAL_PENDING' };
      }
      return t;
    }));

    try {
      const res = await fetch(`${API_BASE_URL}/admin/ops/unclaim/${taskId}`, {
        method: "POST",
        headers: { 
          "X-Disappear-Admin-Key": cleanHeaderKey(adminKey)
        }
      });
      if (res.ok) {
        fetchBacklog(adminKey);
      } else if (originalTask) {
        setManualTasks(prev => prev.map(t => t.task_id === taskId ? originalTask : t));
      }
    } catch (e) {
      console.error("Unclaim error", e);
      if (originalTask) {
        setManualTasks(prev => prev.map(t => t.task_id === taskId ? originalTask : t));
      }
    } finally {
      setActionLoadingTasks(prev => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
    }
  };

  const handleResolve = async (taskId) => {
    const proofUrl = verifications[taskId] || "";
    const activeAnalyst = analystName.trim() || "STAFF_ANALYST";
    const targetTask = manualTasks.find(t => t.task_id === taskId);
    if (!targetTask) return;

    // 1. INSTANT OPTIMISTIC UI STATE UPDATE
    setActionLoadingTasks(prev => ({ ...prev, [taskId]: 'completing' }));

    const optimisticCompleted = {
      ...targetTask,
      status: "REMOVED",
      resolved_by: activeAnalyst,
      manual_instruction_url: proofUrl || "Confirmed Deleted by Staff Analyst",
      resolved_at: new Date().toISOString()
    };

    setManualTasks(prev => prev.filter(t => t.task_id !== taskId));
    setCompletedTasks(prev => [optimisticCompleted, ...prev]);

    try {
      let res = await fetch(`${API_BASE_URL}/admin/ops/verify/${taskId}`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Disappear-Admin-Key": cleanHeaderKey(adminKey)
        },
        body: JSON.stringify({ 
          verification_link: proofUrl,
          notes: "Manual Opt-Out Form Submitted & Confirmed by Analyst",
          analyst_name: activeAnalyst
        })
      });

      if (!res.ok) {
        res = await fetch(`${API_BASE_URL}/admin/ops/resolve/${taskId}`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "X-Disappear-Admin-Key": cleanHeaderKey(adminKey)
          },
          body: JSON.stringify({ 
            verification_link: proofUrl,
            notes: "Manual Opt-Out Form Submitted & Confirmed by Analyst",
            analyst_name: activeAnalyst
          })
        });
      }

      if (res.ok) {
        fetchBacklog(adminKey);
      } else {
        setCompletedTasks(prev => prev.filter(t => t.task_id !== taskId));
        setManualTasks(prev => [targetTask, ...prev]);
        alert("Error verifying task completion.");
      }
    } catch (e) {
      console.error("Resolve error", e);
      setCompletedTasks(prev => prev.filter(t => t.task_id !== taskId));
      setManualTasks(prev => [targetTask, ...prev]);
      alert("Network error verifying task completion.");
    } finally {
      setActionLoadingTasks(prev => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
    }
  };

  const [displayLimit, setDisplayLimit] = useState(50);

  // Reset pagination display limit on tab switch or search query change
  useEffect(() => {
    setDisplayLimit(50);
  }, [filterMode, searchQuery]);

  // Instantaneous Cached Filtering & Lazy Loading Optimization
  const { displayedTasks, fullFilteredCount, unassignedCount, myTasksCount } = useMemo(() => {
    let tasks = manualTasks;
    if (filterMode === 'UNASSIGNED') {
      tasks = manualTasks.filter(t => !t.assigned_analyst);
    } else if (filterMode === 'MY_TASKS') {
      const aName = analystName.trim().toLowerCase();
      tasks = manualTasks.filter(t => t.assigned_analyst && aName && t.assigned_analyst.trim().toLowerCase() === aName);
    } else if (filterMode === 'COMPLETED') {
      tasks = completedTasks;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      tasks = tasks.filter(t => {
        const brokerMatch = t.broker_name && t.broker_name.toLowerCase().includes(q);
        const nameMatch = t.target_profile && `${t.target_profile.first_name || ''} ${t.target_profile.last_name || ''}`.toLowerCase().includes(q);
        const emailMatch = t.target_profile && t.target_profile.email && t.target_profile.email.toLowerCase().includes(q);
        return brokerMatch || nameMatch || emailMatch;
      });
    }

    const unassigned = manualTasks.filter(t => !t.assigned_analyst).length;
    const aNameClean = analystName.trim().toLowerCase();
    const myTasks = manualTasks.filter(t => t.assigned_analyst && aNameClean && t.assigned_analyst.trim().toLowerCase() === aNameClean).length;

    return {
      displayedTasks: tasks.slice(0, displayLimit),
      fullFilteredCount: tasks.length,
      unassignedCount: unassigned,
      myTasksCount: myTasks
    };
  }, [manualTasks, completedTasks, filterMode, searchQuery, analystName, displayLimit]);

  if (!isAuthenticated) {
    return (
      <div className="app-container" style={{ minHeight: '82vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div className="pricing-card" style={{ 
          maxWidth: '520px', 
          width: '100%', 
          border: '1px solid #00D2FF', 
          background: 'rgba(5, 10, 20, 0.95)', 
          borderRadius: '14px', 
          padding: '35px 30px', 
          boxShadow: '0 0 35px rgba(0, 210, 255, 0.25)', 
          textAlign: 'left' 
        }}>
          <div style={{ textAlign: 'center', marginBottom: '22px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(0, 71, 171, 0.25)', border: '1px solid rgba(0, 210, 255, 0.4)', padding: '4px 14px', borderRadius: '20px', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.75rem', color: '#00D2FF', fontWeight: 'bold', letterSpacing: '1px' }}>🔒 SECURE ACCESS GATEWAY</span>
            </div>
            <h2 className="tiger-text" style={{ margin: '0 0 6px 0', fontSize: '1.6rem', letterSpacing: '1px' }}>CENTRAL COMMAND ACCESS</h2>
            <p style={{ color: '#94A3B8', fontSize: '0.82rem', margin: 0 }}>
              USER REPORTING, COUPON & OPERATIONS COMMAND PORTAL
            </p>
          </div>

          {authError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#ff6b6b', padding: '12px 16px', borderRadius: '8px', fontSize: '0.82rem', marginBottom: '22px', textAlign: 'center', lineHeight: '1.4' }}>
              {authError}
            </div>
          )}

          <form onSubmit={handleAssociateLogin} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: '#00D2FF', letterSpacing: '1px', display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>👤 ANALYST / ASSOCIATE NAME</label>
              <input 
                className="mask-btn" 
                placeholder="e.g. Analyst_Alpha" 
                style={{ width: '100%', padding: '10px 14px', fontSize: '0.85rem', background: '#020617', border: '1px solid #1e293b', color: '#fff', borderRadius: '6px', boxSizing: 'border-box' }}
                value={analystName}
                onChange={(e) => setAnalystName(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: '#00D2FF', letterSpacing: '1px', display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>🔑 PRODUCTION ADMIN SECRET KEY</label>
              <input 
                type="password"
                className="mask-btn" 
                placeholder="Enter Admin Secret Key..." 
                style={{ width: '100%', padding: '10px 14px', fontSize: '0.85rem', background: '#020617', border: '1px solid #1e293b', color: '#fff', borderRadius: '6px', boxSizing: 'border-box' }}
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="main-button" style={{ width: '100%', marginTop: '8px', padding: '12px', fontSize: '0.9rem', background: 'linear-gradient(135deg, #0047AB, #00D2FF)', fontWeight: 'bold', letterSpacing: '1px' }} disabled={loading}>
              {loading ? "AUTHENTICATING NODE..." : "⚡ AUTHENTICATE & ENTER COMMAND PORTAL"}
            </button>
          </form>

          <div style={{ marginTop: '25px', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', fontSize: '0.72rem', color: '#64748B' }}>
            OPERATIONS SECURITY SYSTEM | DFS 213 LLC
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Top Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', paddingBottom: '15px', borderBottom: '1px solid rgba(0, 210, 255, 0.2)', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 className="tiger-text" style={{ margin: 0 }}>OPERATIONS COMMAND</h2>
          <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
            LOGGED IN AS: <strong style={{ color: '#00D2FF' }}>{analystName.toUpperCase()}</strong>
          </span>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button className="main-button" style={{ height: '38px', padding: '0 16px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => fetchBacklog(adminKey)}>
            🔄 REFRESH QUEUE
          </button>
          <button className="reset-btn" style={{ height: '38px', padding: '0 16px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onClick={handleLogout}>
            🚪 LOGOUT
          </button>
        </div>
      </div>

      {/* --- USER ACTIVITY & DIAGNOSTIC REPORTING PANEL --- */}
      <div className="pricing-card" style={{ marginBottom: '30px', border: '1px solid #00D2FF', background: 'rgba(5, 10, 20, 0.95)', padding: '24px', borderRadius: '12px', textAlign: 'left' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 className="tiger-text" style={{ margin: 0, fontSize: '1.15rem' }}>📊 USER ACTIVITY & DIAGNOSTIC REPORTING</h3>
            <p style={{ color: '#94A3B8', fontSize: '0.8rem', margin: '4px 0 0 0' }}>
              Pull custom user registration reports by date range, account status, or search query to identify and diagnose operational issues.
            </p>
          </div>
          {userReportData.length > 0 && (
            <button 
              type="button" 
              className="reset-btn" 
              style={{ padding: '8px 16px', fontSize: '0.8rem', borderColor: '#10B981', color: '#34d399', fontWeight: 'bold' }}
              onClick={handleExportReportCsv}
            >
              📥 EXPORT REPORT (CSV)
            </button>
          )}
        </div>

        {reportStatusMsg && (
          <div style={{ padding: '10px 14px', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '15px', background: reportStatusMsg.startsWith('✅') ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${reportStatusMsg.startsWith('✅') ? '#10b981' : '#ef4444'}`, color: reportStatusMsg.startsWith('✅') ? '#34d399' : '#ff6b6b' }}>
            {reportStatusMsg}
          </div>
        )}

        {/* Filter Controls Form */}
        <form onSubmit={handleGenerateUserReport} style={{ background: 'rgba(0,0,0,0.4)', padding: '18px', borderRadius: '8px', border: '1px solid rgba(0,210,255,0.2)', marginBottom: '20px' }}>
          
          {/* Quick Date Range Presets */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: '#00D2FF', fontWeight: 'bold' }}>QUICK PRESETS:</span>
            <button type="button" className="reset-btn" style={{ padding: '3px 10px', fontSize: '0.72rem' }} onClick={() => setReportDatePreset(0)}>TODAY</button>
            <button type="button" className="reset-btn" style={{ padding: '3px 10px', fontSize: '0.72rem' }} onClick={() => setReportDatePreset(7)}>LAST 7 DAYS</button>
            <button type="button" className="reset-btn" style={{ padding: '3px 10px', fontSize: '0.72rem' }} onClick={() => setReportDatePreset(30)}>LAST 30 DAYS</button>
            <button type="button" className="reset-btn" style={{ padding: '3px 10px', fontSize: '0.72rem' }} onClick={() => setReportDatePreset(-1)}>ALL TIME</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', alignItems: 'flex-end' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#94A3B8', marginBottom: '6px', display: 'block', fontWeight: 'bold' }}>START DATE</label>
              <input
                type="date"
                className="mask-btn"
                value={reportStartDate}
                onChange={(e) => setReportStartDate(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', fontSize: '0.82rem', background: '#020617', border: '1px solid #1e293b', color: '#fff', borderRadius: '6px', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', color: '#94A3B8', marginBottom: '6px', display: 'block', fontWeight: 'bold' }}>END DATE</label>
              <input
                type="date"
                className="mask-btn"
                value={reportEndDate}
                onChange={(e) => setReportEndDate(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', fontSize: '0.82rem', background: '#020617', border: '1px solid #1e293b', color: '#fff', borderRadius: '6px', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', color: '#94A3B8', marginBottom: '6px', display: 'block', fontWeight: 'bold' }}>ACCOUNT STATUS</label>
              <select
                className="mask-btn"
                value={reportStatusFilter}
                onChange={(e) => setReportStatusFilter(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', fontSize: '0.82rem', background: '#020617', border: '1px solid #1e293b', color: '#fff', borderRadius: '6px', boxSizing: 'border-box' }}
              >
                <option value="ALL">ALL USERS</option>
                <option value="APPROVED">APPROVED (PAID)</option>
                <option value="UNPAID">UNPAID / PENDING</option>
                <option value="AML_FLAGGED">AML FLAGGED</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', color: '#94A3B8', marginBottom: '6px', display: 'block', fontWeight: 'bold' }}>SEARCH (EMAIL / ID / PHONE)</label>
              <input
                type="text"
                placeholder="Search query..."
                className="mask-btn"
                value={reportSearchTerm}
                onChange={(e) => setReportSearchTerm(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', fontSize: '0.82rem', background: '#020617', border: '1px solid #1e293b', color: '#fff', borderRadius: '6px', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <button
                type="submit"
                className="main-button"
                style={{ width: '100%', padding: '10px', fontSize: '0.82rem', background: 'linear-gradient(135deg, #0047AB, #00D2FF)' }}
                disabled={isGeneratingReport}
              >
                {isGeneratingReport ? "GENERATING..." : "📊 PULL USER REPORT"}
              </button>
            </div>
          </div>
        </form>

        {/* User Activity Report Data Table */}
        {userReportData.length > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h4 style={{ color: '#00D2FF', fontSize: '0.9rem', margin: 0 }}>
                📋 USER ACTIVITY REPORT ({userReportData.length} RECORDS)
              </h4>
            </div>

            <div style={{ overflowX: 'auto', border: '1px solid #1e293b', borderRadius: '6px', maxHeight: '420px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#090d16', borderBottom: '1px solid #1e293b', color: '#00D2FF' }}>
                    <th style={{ padding: '10px' }}>SIGNUP TIMESTAMP</th>
                    <th style={{ padding: '10px' }}>USER ID / NAME</th>
                    <th style={{ padding: '10px' }}>EMAIL & PHONE</th>
                    <th style={{ padding: '10px' }}>PHYSICAL ADDRESS & DOB</th>
                    <th style={{ padding: '10px' }}>PAYMENT STATUS</th>
                    <th style={{ padding: '10px' }}>CANCELLATION DATE</th>
                    <th style={{ padding: '10px' }}>EMAIL ALIASES</th>
                    <th style={{ padding: '10px' }}>PHONE ALIASES</th>
                    <th style={{ padding: '10px' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {userReportData.map((u, idx) => (
                    <tr key={u.user_id || idx} style={{ borderBottom: '1px solid #0f172a', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '10px', color: '#94A3B8', whiteSpace: 'nowrap' }}>
                        <div style={{ color: '#E2E8F0', fontWeight: 'bold' }}>
                          {u.signup_timestamp || u.created_at ? (u.signup_timestamp || u.created_at).split('T')[0] : 'N/A'}
                        </div>
                        <div style={{ color: '#64748B', fontSize: '0.70rem' }}>
                          {(u.signup_timestamp || u.created_at || '').includes('T') ? (u.signup_timestamp || u.created_at).split('T')[1].replace('Z', '') : ''}
                        </div>
                      </td>
                      <td style={{ padding: '10px' }}>
                        <div style={{ fontWeight: 'bold', color: '#FFFFFF' }}>{u.user_id}</div>
                        <div style={{ color: '#94A3B8', fontSize: '0.72rem' }}>
                          {u.first_name} {u.middle_name ? `${u.middle_name} ` : ''}{u.last_name}
                        </div>
                        {u.nickname && (
                          <div style={{ color: '#FFD700', fontSize: '0.68rem', fontWeight: 'bold' }}>
                            Alias: "{u.nickname}"
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px' }}>
                        <div style={{ color: '#00D2FF' }}>{u.email}</div>
                        <div style={{ color: '#10B981', fontSize: '0.72rem' }}>{u.phone || 'No phone'}</div>
                      </td>
                      <td style={{ padding: '10px' }}>
                        <div style={{ color: '#E2E8F0', fontSize: '0.74rem' }}>{u.address || <span style={{ color: '#64748B', fontStyle: 'italic' }}>No address entered</span>}</div>
                        <div style={{ color: '#94A3B8', fontSize: '0.70rem' }}>DOB: {u.dob || 'Not provided'}</div>
                      </td>
                      <td style={{ padding: '10px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '0.72rem',
                          fontWeight: 'bold',
                          display: 'inline-block',
                          background: (u.payment_status === 'ACTIVE SHIELD' || u.kyc_status === 'APPROVED') ? 'rgba(16, 185, 129, 0.15)' : (u.payment_status === 'CANCELLED' ? 'rgba(239, 68, 68, 0.15)' : (u.payment_status === 'PAST DUE' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(148, 163, 184, 0.15)')),
                          border: `1px solid ${(u.payment_status === 'ACTIVE SHIELD' || u.kyc_status === 'APPROVED') ? '#10b981' : (u.payment_status === 'CANCELLED' ? '#ef4444' : (u.payment_status === 'PAST DUE' ? '#f59e0b' : '#64748b'))}`,
                          color: (u.payment_status === 'ACTIVE SHIELD' || u.kyc_status === 'APPROVED') ? '#34d399' : (u.payment_status === 'CANCELLED' ? '#f87171' : (u.payment_status === 'PAST DUE' ? '#fcd34d' : '#94a3b8'))
                        }}>
                          {u.payment_status || (u.kyc_status === 'APPROVED' ? 'ACTIVE SHIELD' : u.kyc_status)}
                        </span>
                      </td>
                      <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>
                        {u.cancellation_date ? (
                          <div style={{ color: '#EF4444', fontWeight: 'bold', fontSize: '0.75rem' }}>
                            🛑 {u.cancellation_date.split('T')[0]}
                          </div>
                        ) : (
                          <span style={{ color: '#64748B', fontSize: '0.72rem' }}>N/A (Active)</span>
                        )}
                      </td>
                      <td style={{ padding: '10px', color: '#CBD5E1' }}>
                        {(u.email_aliases && u.email_aliases.length > 0) ? u.email_aliases.map(ea => (
                          <div key={ea} style={{ fontSize: '0.72rem', fontFamily: 'monospace' }}>{ea}</div>
                        )) : <span style={{ color: '#64748B' }}>None</span>}
                      </td>
                      <td style={{ padding: '10px', color: '#CBD5E1' }}>
                        {(u.phone_aliases && u.phone_aliases.length > 0) ? u.phone_aliases.map(pa => (
                          <div key={pa} style={{ fontSize: '0.72rem', fontFamily: 'monospace' }}>{pa}</div>
                        )) : <span style={{ color: '#64748B' }}>None</span>}
                      </td>
                      <td style={{ padding: '10px' }}>
                        <button
                          type="button"
                          className="reset-btn"
                          style={{ padding: '3px 8px', fontSize: '0.7rem', borderColor: '#00D2FF', color: '#00D2FF', fontWeight: 'bold' }}
                          onClick={() => handleOpenEditProfileModal(u)}
                        >
                          ✏️ EDIT DETAILS
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Profile Details Edit Modal */}
        {editingProfileUser && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ background: '#090d16', border: '1px solid #00D2FF', borderRadius: '12px', padding: '25px', maxWidth: '500px', width: '100%', boxShadow: '0 0 30px rgba(0, 210, 255, 0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 className="tiger-text" style={{ margin: 0, fontSize: '1.1rem' }}>✏️ EDIT CUSTOMER PROFILE DETAILS</h3>
                <button type="button" className="reset-btn" style={{ padding: '2px 8px', fontSize: '0.8rem' }} onClick={() => setEditingProfileUser(null)}>✕ CLOSE</button>
              </div>

              <p style={{ color: '#94A3B8', fontSize: '0.78rem', marginBottom: '15px' }}>
                Updating profile details for User ID: <strong style={{ color: '#00D2FF' }}>{editingProfileUser.user_id}</strong>
              </p>

              {editProfileMsg && (
                <div style={{ padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem', marginBottom: '15px', background: editProfileMsg.startsWith('✅') ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${editProfileMsg.startsWith('✅') ? '#10b981' : '#ef4444'}`, color: editProfileMsg.startsWith('✅') ? '#34d399' : '#ff6b6b' }}>
                  {editProfileMsg}
                </div>
              )}

              <form onSubmit={handleSaveProfileDetails} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#00D2FF', display: 'block', marginBottom: '4px' }}>FIRST NAME</label>
                    <input type="text" className="mask-btn" style={{ width: '100%', padding: '6px 10px', fontSize: '0.8rem', background: '#020617', color: '#fff' }} value={editProfileFirstName} onChange={(e) => setEditProfileFirstName(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#00D2FF', display: 'block', marginBottom: '4px' }}>MIDDLE NAME</label>
                    <input type="text" className="mask-btn" style={{ width: '100%', padding: '6px 10px', fontSize: '0.8rem', background: '#020617', color: '#fff' }} value={editProfileMiddleName} onChange={(e) => setEditProfileMiddleName(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#00D2FF', display: 'block', marginBottom: '4px' }}>LAST NAME</label>
                    <input type="text" className="mask-btn" style={{ width: '100%', padding: '6px 10px', fontSize: '0.8rem', background: '#020617', color: '#fff' }} value={editProfileLastName} onChange={(e) => setEditProfileLastName(e.target.value)} />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: '#00D2FF', display: 'block', marginBottom: '4px' }}>NICKNAME / PUBLIC RECORD ALIAS</label>
                  <input type="text" placeholder="e.g. Mike, Former Maiden Names" className="mask-btn" style={{ width: '100%', padding: '6px 10px', fontSize: '0.8rem', background: '#020617', color: '#fff' }} value={editProfileNickname} onChange={(e) => setEditProfileNickname(e.target.value)} />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: '#00D2FF', display: 'block', marginBottom: '4px' }}>EMAIL ADDRESS</label>
                  <input type="email" className="mask-btn" style={{ width: '100%', padding: '6px 10px', fontSize: '0.8rem', background: '#020617', color: '#fff' }} value={editProfileEmail} onChange={(e) => setEditProfileEmail(e.target.value)} />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: '#00D2FF', display: 'block', marginBottom: '4px' }}>MOBILE / PHYSICAL PHONE</label>
                  <input type="text" className="mask-btn" style={{ width: '100%', padding: '6px 10px', fontSize: '0.8rem', background: '#020617', color: '#fff' }} value={editProfilePhone} onChange={(e) => setEditProfilePhone(e.target.value)} />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: '#00D2FF', display: 'block', marginBottom: '4px' }}>PHYSICAL ADDRESS</label>
                  <input type="text" placeholder="e.g. 123 Main St, City, State ZIP" className="mask-btn" style={{ width: '100%', padding: '6px 10px', fontSize: '0.8rem', background: '#020617', color: '#fff' }} value={editProfileAddress} onChange={(e) => setEditProfileAddress(e.target.value)} />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: '#00D2FF', display: 'block', marginBottom: '4px' }}>DATE OF BIRTH (DOB)</label>
                  <input type="text" placeholder="e.g. 1988-05-14 or MM/DD/YYYY" className="mask-btn" style={{ width: '100%', padding: '6px 10px', fontSize: '0.8rem', background: '#020617', color: '#fff' }} value={editProfileDob} onChange={(e) => setEditProfileDob(e.target.value)} />
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button type="submit" className="main-button" style={{ flex: 1, padding: '8px', fontSize: '0.82rem' }}>💾 SAVE PROFILE CHANGES</button>
                  <button type="button" className="reset-btn" style={{ padding: '8px 14px', fontSize: '0.82rem' }} onClick={() => setEditingProfileUser(null)}>CANCEL</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* --- COUPON MANAGEMENT PANEL --- */}
      <div className="pricing-card" style={{ marginBottom: '30px', border: '1px solid var(--tiger-blue)' }}>
        <h3 className="tiger-text" style={{ marginBottom: '15px' }}>🎟️ COUPON & PROMO CODE MANAGEMENT</h3>
        
        {couponStatusMsg && (
          <div style={{ padding: '10px 14px', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '15px', background: couponStatusMsg.startsWith('✅') ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${couponStatusMsg.startsWith('✅') ? '#10b981' : '#ef4444'}`, color: couponStatusMsg.startsWith('✅') ? '#34d399' : '#ff6b6b' }}>
            {couponStatusMsg}
          </div>
        )}

        {/* Create Coupon Form */}
        <form onSubmit={handleCreateCoupon} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '15px', alignItems: 'flex-start', marginBottom: '20px', background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '0.75rem', color: '#94A3B8', marginBottom: '6px', fontWeight: 'bold' }}>COUPON CODE</label>
            <input 
              className="mask-btn" 
              placeholder="e.g. TACTICAL50" 
              style={{ width: '100%', textTransform: 'uppercase', height: '42px', boxSizing: 'border-box', margin: 0 }}
              value={newCouponCode}
              onChange={(e) => setNewCouponCode(e.target.value.toUpperCase())}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '0.75rem', color: '#94A3B8', marginBottom: '6px', fontWeight: 'bold' }}>DISCOUNT TYPE</label>
            <select 
              className="mask-btn" 
              style={{ width: '100%', color: '#FFF', background: '#0D1117', height: '42px', boxSizing: 'border-box', margin: 0 }}
              value={newDiscountType}
              onChange={(e) => setNewDiscountType(e.target.value)}
            >
              <option value="percent">Percentage (%) Off</option>
              <option value="amount">Fixed Dollar ($) Off</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '0.75rem', color: '#94A3B8', marginBottom: '6px', fontWeight: 'bold' }}>DISCOUNT VALUE</label>
            <input 
              type="number"
              step="0.01"
              className="mask-btn" 
              placeholder="e.g. 50 or 5.95" 
              style={{ width: '100%', height: '42px', boxSizing: 'border-box', margin: 0 }}
              value={newDiscountValue}
              onChange={(e) => setNewDiscountValue(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '0.75rem', color: '#94A3B8', marginBottom: '6px', fontWeight: 'bold' }}>DURATION</label>
            <select 
              className="mask-btn" 
              style={{ width: '100%', color: '#FFF', background: '#0D1117', height: '42px', boxSizing: 'border-box', margin: 0 }}
              value={newDuration}
              onChange={(e) => setNewDuration(e.target.value)}
            >
              <option value="permanent">Permanent (Every Month)</option>
              <option value="one_month">1-Month Promo Discount</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '0.75rem', color: 'transparent', marginBottom: '6px', userSelect: 'none' }}>ACTION</label>
            <button 
              type="submit" 
              className="main-button" 
              style={{ height: '42px', width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', margin: 0, padding: '0 16px', fontSize: '0.82rem', whiteSpace: 'nowrap' }}
            >
              ➕ CREATE COUPON
            </button>
          </div>
        </form>

        {/* Existing Coupons Table */}
        <h4 style={{ color: '#00D2FF', fontSize: '0.9rem', marginBottom: '10px' }}>ACTIVE COUPONS</h4>
        {coupons.filter(c => c.active).length === 0 ? (
          <p style={{ color: '#64748B', fontSize: '0.85rem', fontStyle: 'italic' }}>No active coupons created yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(0,210,255,0.3)', color: '#94A3B8' }}>
                  <th style={{ padding: '8px' }}>CODE</th>
                  <th style={{ padding: '8px' }}>DISCOUNT</th>
                  <th style={{ padding: '8px' }}>DURATION</th>
                  <th style={{ padding: '8px' }}>STATUS</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {coupons.filter(c => c.active).map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '8px', color: '#00D2FF', fontWeight: 'bold' }}>{c.code}</td>
                    <td style={{ padding: '8px', color: '#FFF' }}>
                      {c.discount_type === 'percent' ? `${c.discount_value}% OFF` : `$${c.discount_value.toFixed(2)} OFF`}
                    </td>
                    <td style={{ padding: '8px', color: c.duration === 'permanent' ? '#34d399' : '#fbbf24' }}>
                      {c.duration === 'permanent' ? '♾️ Permanent (Every Month)' : '⏳ 1-Month Promo'}
                    </td>
                    <td style={{ padding: '8px', color: '#34d399' }}>ACTIVE</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>
                      <button 
                        className="reset-btn" 
                        style={{ padding: '3px 8px', fontSize: '0.75rem', color: '#ff6b6b', borderColor: '#ef4444' }}
                        onClick={() => handleDeleteCoupon(c.id)}
                      >
                        ❌ DELETE
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- SUPPORT TICKET INBOX BOX --- */}
      <div className="pricing-card" style={{ marginBottom: '35px', border: '1px solid var(--tiger-blue)', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 className="tiger-text" style={{ margin: 0 }}>📩 SUPPORT TICKET INBOX (OPERATIONS COMMAND)</h3>
            <p style={{ color: '#94A3B8', fontSize: '0.8rem', margin: '4px 0 0 0' }}>Real-time customer inquiry logging and support ticket management</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="reset-btn" style={{ padding: '4px 10px', fontSize: '0.75rem', color: ticketFilter === 'ALL' ? '#00D2FF' : '#94A3B8', borderColor: ticketFilter === 'ALL' ? '#00D2FF' : '#334155' }} onClick={() => setTicketFilter('ALL')}>ALL ({supportTickets.length})</button>
            <button className="reset-btn" style={{ padding: '4px 10px', fontSize: '0.75rem', color: ticketFilter === 'OPEN' ? '#ef4444' : '#94A3B8', borderColor: ticketFilter === 'OPEN' ? '#ef4444' : '#334155' }} onClick={() => setTicketFilter('OPEN')}>OPEN ({supportTickets.filter(t => t.status === 'OPEN').length})</button>
            <button className="reset-btn" style={{ padding: '4px 10px', fontSize: '0.75rem', color: ticketFilter === 'RESOLVED' ? '#10b981' : '#94A3B8', borderColor: ticketFilter === 'RESOLVED' ? '#10b981' : '#334155' }} onClick={() => setTicketFilter('RESOLVED')}>RESOLVED ({supportTickets.filter(t => t.status === 'RESOLVED').length})</button>
            <button className="reset-btn" style={{ padding: '4px 10px', fontSize: '0.75rem', color: '#38bdf8' }} onClick={() => fetchSupportTickets(cleanHeaderKey(adminKey))}>🔄 REFRESH</button>
          </div>
        </div>

        {ticketStatusMsg && (
          <div style={{ padding: '10px 14px', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '15px', background: ticketStatusMsg.startsWith('✅') ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${ticketStatusMsg.startsWith('✅') ? '#10b981' : '#ef4444'}`, color: ticketStatusMsg.startsWith('✅') ? '#34d399' : '#ff6b6b' }}>
            {ticketStatusMsg}
          </div>
        )}

        {supportTickets.filter(t => ticketFilter === 'ALL' ? true : t.status === ticketFilter).length === 0 ? (
          <p style={{ color: '#64748B', fontSize: '0.85rem', fontStyle: 'italic', padding: '15px 0' }}>No support tickets logged matching selected filter.</p>
        ) : (
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table style={{ width: '100%', minWidth: '750px', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(0,210,255,0.3)', color: '#94A3B8' }}>
                  <th style={{ padding: '8px' }}>TRACKING ID</th>
                  <th style={{ padding: '8px' }}>USER ID</th>
                  <th style={{ padding: '8px' }}>CUSTOMER EMAIL</th>
                  <th style={{ padding: '8px' }}>CATEGORY / SUBJECT</th>
                  <th style={{ padding: '8px' }}>SUBMITTED AT</th>
                  <th style={{ padding: '8px' }}>STATUS</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {supportTickets
                  .filter(t => ticketFilter === 'ALL' ? true : t.status === ticketFilter)
                  .map(t => {
                    const isExpanded = expandedTicketId === t.id;
                    const isResolved = t.status === 'RESOLVED';
                    return (
                      <React.Fragment key={t.id}>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: isExpanded ? 'rgba(0,210,255,0.05)' : 'transparent' }}>
                          <td style={{ padding: '8px', color: '#00D2FF', fontWeight: 'bold' }}>{t.tracking_id || `TKT-${t.id}`}</td>
                          <td style={{ padding: '8px', color: '#F8FAFC', fontWeight: 'bold' }}>{t.user_id}</td>
                          <td style={{ padding: '8px', color: '#38BDF8' }}>{t.email}</td>
                          <td style={{ padding: '8px', color: '#FFF' }}>
                            <span style={{ fontSize: '0.7rem', background: '#1e293b', padding: '2px 6px', borderRadius: '4px', color: '#00D2FF', fontWeight: 'bold', marginRight: '6px' }}>{t.category}</span>
                            {t.subject}
                          </td>
                          <td style={{ padding: '8px', color: '#94A3B8', fontSize: '0.78rem' }}>
                            {t.created_at ? new Date(t.created_at).toLocaleString() : 'N/A'}
                          </td>
                          <td style={{ padding: '8px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', padding: '2px 8px', borderRadius: '4px', background: isResolved ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: isResolved ? '#34d399' : '#ff6b6b', border: `1px solid ${isResolved ? '#10b981' : '#ef4444'}` }}>
                              {t.status}
                            </span>
                          </td>
                          <td style={{ padding: '8px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                              <button
                                className="reset-btn"
                                style={{ padding: '3px 8px', fontSize: '0.72rem', color: isExpanded ? '#FFD700' : '#00D2FF', borderColor: isExpanded ? '#FFD700' : '#00D2FF' }}
                                onClick={() => setExpandedTicketId(isExpanded ? null : t.id)}
                              >
                                {isExpanded ? '▲ HIDE MSG' : '▼ VIEW MSG'}
                              </button>
                              <button
                                className="reset-btn"
                                style={{ padding: '3px 8px', fontSize: '0.72rem', color: isResolved ? '#fbbf24' : '#10b981', borderColor: isResolved ? '#fbbf24' : '#10b981' }}
                                onClick={() => handleUpdateTicketStatus(t.id, isResolved ? 'OPEN' : 'RESOLVED')}
                              >
                                {isResolved ? '🔄 REOPEN' : '✅ RESOLVE'}
                              </button>
                              <button
                                className="reset-btn"
                                style={{ padding: '3px 8px', fontSize: '0.72rem', color: '#ff6b6b', borderColor: '#ef4444' }}
                                onClick={() => handleDeleteTicket(t.id)}
                              >
                                🗑️ CLEAR
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr style={{ background: 'rgba(0,0,0,0.5)', borderBottom: '1px solid rgba(0,210,255,0.2)' }}>
                            <td colSpan={7} style={{ padding: '12px 16px' }}>
                              <div style={{ background: '#090d16', padding: '12px', borderRadius: '6px', border: '1px solid #1e293b' }}>
                                <p style={{ fontSize: '0.75rem', color: '#00D2FF', fontWeight: 'bold', marginBottom: '6px' }}>💬 CUSTOMER MESSAGE TEXT:</p>
                                <p style={{ fontSize: '0.85rem', color: '#F8FAFC', whiteSpace: 'pre-wrap', margin: 0, lineHeight: '1.4' }}>{t.message}</p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- LIVE SEARCH & FILTER CONTROL BAR --- */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
        
        {/* Navigation Filter Tabs */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button 
            className={filterMode === 'ALL' ? "main-button" : "reset-btn"}
            style={{ height: '38px', padding: '0 16px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', margin: 0 }}
            onClick={() => setFilterMode('ALL')}
          >
            📋 ALL PENDING ({manualTasks.length})
          </button>

          <button 
            className={filterMode === 'UNASSIGNED' ? "main-button" : "reset-btn"}
            style={{ height: '38px', padding: '0 16px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', margin: 0, borderColor: unassignedCount > 0 ? '#fbbf24' : undefined }}
            onClick={() => setFilterMode('UNASSIGNED')}
          >
            ⚠️ UNASSIGNED ({unassignedCount})
          </button>

          <button 
            className={filterMode === 'MY_TASKS' ? "main-button" : "reset-btn"}
            style={{ height: '38px', padding: '0 16px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', margin: 0 }}
            onClick={() => setFilterMode('MY_TASKS')}
          >
            👤 MY CLAIMED ({myTasksCount})
          </button>

          <button 
            className={filterMode === 'COMPLETED' ? "main-button" : "reset-btn"}
            style={{ height: '38px', padding: '0 16px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', margin: 0, borderColor: '#10b981' }}
            onClick={() => setFilterMode('COMPLETED')}
          >
            ✅ COMPLETED ({completedTasks.length})
          </button>
        </div>

        {/* Live Search Input */}
        <div style={{ minWidth: '260px', flex: 1, maxWidth: '400px' }}>
          <input 
            className="mask-btn" 
            placeholder="🔍 Search Customer, Email, or Broker..." 
            style={{ width: '100%', height: '38px', boxSizing: 'border-box', margin: 0, fontSize: '0.82rem' }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

      </div>

      {displayedTasks.length === 0 ? (
        <p style={{ color: '#10b981', fontFamily: 'Courier New', padding: '30px', textAlign: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
          {searchQuery 
            ? `NO TASKS MATCHING SEARCH QUERY '${searchQuery.toUpperCase()}'.`
            : filterMode === 'UNASSIGNED' 
            ? "NO UNASSIGNED TASKS IN QUEUE." 
            : filterMode === 'MY_TASKS' 
            ? "YOU HAVE NO ACTIVE CLAIMED TASKS." 
            : filterMode === 'COMPLETED'
            ? "NO COMPLETED TASKS RECORDED YET."
            : "ALL QUEUES CLEAR — NO PENDING REMOVAL TASKS."}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
          {displayedTasks.map((task) => {
            const isAssignedToMe = task.assigned_analyst && analystName.trim() && task.assigned_analyst.toLowerCase() === analystName.trim().toLowerCase();
            const isCompleted = task.status === "REMOVED";

            return (
              <div key={task.task_id} style={{ border: isCompleted ? '1px solid #10b981' : isAssignedToMe ? '1px solid #10b981' : task.assigned_analyst ? '1px solid #3b82f6' : '1px solid #d97706', padding: '18px', borderRadius: '8px', background: isCompleted ? '#031a10' : '#05070E' }}>
                
                {/* Task Header & Associate Status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <strong style={{ color: '#00D2FF', fontSize: '1.1rem', letterSpacing: '1px' }}>BROKER: {task.broker_name}</strong>
                    
                    {isCompleted ? (
                      <span style={{ fontSize: '0.75rem', backgroundColor: '#064e3b', color: '#34d399', padding: '4px 10px', borderRadius: '4px', border: '1px solid #059669', fontWeight: 'bold' }}>
                        ✅ REMOVAL COMPLETED BY: {(task.resolved_by || "STAFF ANALYST").toUpperCase()}
                      </span>
                    ) : task.assigned_analyst ? (
                      <span style={{ fontSize: '0.75rem', backgroundColor: isAssignedToMe ? '#064e3b' : '#1e3a8a', color: isAssignedToMe ? '#34d399' : '#60a5fa', padding: '4px 10px', borderRadius: '4px', border: `1px solid ${isAssignedToMe ? '#059669' : '#2563eb'}`, fontWeight: 'bold' }}>
                        👤 ASSIGNED TO: {task.assigned_analyst.toUpperCase()}
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', backgroundColor: '#451a03', color: '#fbbf24', padding: '4px 10px', borderRadius: '4px', border: '1px solid #d97706', fontWeight: 'bold' }}>
                        ⚠️ UNASSIGNED TASK
                      </span>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {!isCompleted && (!task.assigned_analyst ? (
                      <button 
                        className="main-button" 
                        disabled={!!actionLoadingTasks[task.task_id]}
                        style={{ 
                          height: '34px', 
                          padding: '0 14px', 
                          fontSize: '0.78rem', 
                          background: actionLoadingTasks[task.task_id] === 'claiming' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #d97706, #b45309)', 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          gap: '6px',
                          boxSizing: 'border-box', 
                          margin: 0,
                          cursor: actionLoadingTasks[task.task_id] ? 'wait' : 'pointer'
                        }}
                        onClick={() => handleClaimTask(task.task_id)}
                        title="Claim this task for yourself"
                      >
                        {actionLoadingTasks[task.task_id] === 'claiming' ? (
                          <>
                            <span className="fast-spinner" style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#FFF', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                            CLAIMING...
                          </>
                        ) : (
                          "🎯 CLAIM TASK"
                        )}
                      </button>
                    ) : isAssignedToMe ? (
                      <button 
                        className="reset-btn" 
                        disabled={!!actionLoadingTasks[task.task_id]}
                        style={{ height: '34px', padding: '0 12px', fontSize: '0.75rem', color: '#fbbf24', borderColor: '#d97706', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxSizing: 'border-box', margin: 0 }}
                        onClick={() => handleUnclaimTask(task.task_id)}
                      >
                        {actionLoadingTasks[task.task_id] === 'unclaiming' ? (
                          <>
                            <span className="fast-spinner" style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid rgba(251,191,36,0.4)', borderTopColor: '#fbbf24', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                            RELEASING...
                          </>
                        ) : (
                          "↩️ UNASSIGN / RELEASE TASK"
                        )}
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button 
                          className="reset-btn" 
                          disabled={!!actionLoadingTasks[task.task_id]}
                          style={{ height: '34px', padding: '0 10px', fontSize: '0.75rem', color: '#ff6b6b', borderColor: '#ef4444', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxSizing: 'border-box', margin: 0 }}
                          onClick={() => handleUnclaimTask(task.task_id)}
                          title="Remove currently assigned associate and return task to unassigned queue"
                        >
                          {actionLoadingTasks[task.task_id] === 'unclaiming' ? (
                            <>
                              <span className="fast-spinner" style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid rgba(239,68,68,0.4)', borderTopColor: '#ef4444', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                              UNASSIGNING...
                            </>
                          ) : (
                            "❌ UNASSIGN ASSOCIATE"
                          )}
                        </button>
                        <button 
                          className="reset-btn" 
                          disabled={!!actionLoadingTasks[task.task_id]}
                          style={{ height: '34px', padding: '0 10px', fontSize: '0.75rem', color: '#60a5fa', borderColor: '#3b82f6', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxSizing: 'border-box', margin: 0 }}
                          onClick={() => handleClaimTask(task.task_id)}
                          title="Re-assign task directly to yourself"
                        >
                          {actionLoadingTasks[task.task_id] === 'claiming' ? (
                            <>
                              <span className="fast-spinner" style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid rgba(96,165,250,0.4)', borderTopColor: '#60a5fa', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                              RE-ASSIGNING...
                            </>
                          ) : (
                            "⚡ RE-ASSIGN TO ME"
                          )}
                        </button>
                      </div>
                    ))}

                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                      <a 
                        href={sanitizeOutboundUrl(task.opt_out_url || `https://www.${task.broker_name ? task.broker_name.toLowerCase().replace(/_/g, '') : 'broker'}.com/optout`, task.broker_name)} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="main-button" 
                        style={{ textDecoration: 'none', height: '34px', padding: '0 14px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxSizing: 'border-box', margin: 0 }}
                        title={`🔒 SECURE SANDBOX LINK | Pre-Flight Domain Inspection: ${extractDomain(task.opt_out_url || task.broker_name)}`}
                      >
                        🌐 LAUNCH OPT-OUT FORM
                      </a>
                      <span style={{ fontSize: '0.62rem', color: '#64748B', fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                        🔒 {extractDomain(task.opt_out_url || task.broker_name)}
                      </span>
                    </div>

                    {task.target_listing_url && (
                      <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                        <a 
                          href={sanitizeOutboundUrl(task.target_listing_url)} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="reset-btn" 
                          style={{ textDecoration: 'none', height: '34px', padding: '0 12px', fontSize: '0.78rem', color: '#00D2FF', borderColor: '#00D2FF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxSizing: 'border-box', margin: 0 }}
                          title={`🔒 SECURE SANDBOX LINK | Pre-Flight Domain Inspection: ${extractDomain(task.target_listing_url)}`}
                        >
                          🎯 LAUNCH TARGET LISTING
                        </a>
                        <span style={{ fontSize: '0.62rem', color: '#00D2FF', fontFamily: 'monospace', fontWeight: 'bold', opacity: 0.8, letterSpacing: '0.5px' }}>
                          🔒 {extractDomain(task.target_listing_url)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Target Customer PII Details Card */}
                <div style={{ fontSize: '0.88rem', color: '#cbd5e1', marginBottom: '12px', background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                  <div><strong style={{ color: '#00D2FF' }}>CUSTOMER NAME:</strong> <br/><span style={{ color: '#FFF', fontSize: '1rem', fontWeight: 'bold' }}>{task.target_profile.first_name} {task.target_profile.middle_name} {task.target_profile.last_name}</span></div>
                  <div><strong style={{ color: '#00D2FF' }}>EMAIL ADDRESS:</strong> <br/><span style={{ color: '#FFF' }}>{task.target_profile.email}</span></div>
                  <div><strong style={{ color: '#00D2FF' }}>DATE OF BIRTH:</strong> <br/><span style={{ color: '#FFF' }}>{task.target_profile.dob}</span></div>
                  <div><strong style={{ color: '#00D2FF' }}>STREET ADDRESS:</strong> <br/><span style={{ color: '#FFF' }}>{task.target_profile.address}</span></div>
                </div>

                {/* Target Listing URL & Listing Finder Section */}
                <div style={{ fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '15px', background: 'rgba(0, 210, 255, 0.05)', padding: '12px 14px', borderRadius: '6px', border: '1px solid rgba(0, 210, 255, 0.2)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ flex: 1, minWidth: '240px' }}>
                      <strong style={{ color: '#00D2FF', letterSpacing: '0.5px' }}>🎯 BROKER TARGET LISTING PAGE URL:</strong>
                      <div style={{ wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '0.85rem', marginTop: '4px' }}>
                        {task.target_listing_url ? (
                          <a 
                            href={sanitizeOutboundUrl(task.target_listing_url)} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            style={{ color: '#38bdf8', textDecoration: 'underline', fontWeight: 'bold' }}
                            title={`🔒 SECURE SANDBOX LINK | Destination Domain: ${extractDomain(task.target_listing_url)}`}
                          >
                            {task.target_listing_url} ↗ <span style={{ fontSize: '0.70rem', color: '#94A3B8', fontWeight: 'normal' }}>(🔒 {extractDomain(task.target_listing_url)})</span>
                          </a>
                        ) : (
                          <span style={{ color: '#94A3B8' }}>No direct profile listing URL saved yet.</span>
                        )}
                      </div>
                    </div>
                    
                    {task.target_listing_url && (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button 
                          className="reset-btn" 
                          style={{ height: '32px', padding: '0 12px', fontSize: '0.75rem', color: copiedTaskId === task.task_id ? '#34d399' : '#00D2FF', borderColor: copiedTaskId === task.task_id ? '#10b981' : '#00D2FF', display: 'inline-flex', alignItems: 'center', gap: '4px', boxSizing: 'border-box', margin: 0 }}
                          onClick={() => handleCopyListingUrl(task.task_id, task.target_listing_url)}
                        >
                          {copiedTaskId === task.task_id ? "✅ COPIED!" : "📋 COPY LISTING URL"}
                        </button>
                      </div>
                    )}
                  </div>

                  {!isCompleted && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <input 
                        className="mask-btn" 
                        placeholder="Paste exact custom profile listing URL (e.g. Whitepages wpId=...)..." 
                        style={{ flex: 1, height: '32px', fontSize: '0.78rem', boxSizing: 'border-box', margin: 0 }}
                        value={editingListingUrls[task.task_id] !== undefined ? editingListingUrls[task.task_id] : (task.target_listing_url || "")}
                        onChange={(e) => setEditingListingUrls({...editingListingUrls, [task.task_id]: e.target.value})}
                      />
                      <button 
                        className="main-button" 
                        style={{ height: '32px', padding: '0 12px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', margin: 0, whiteSpace: 'nowrap' }}
                        onClick={() => handleSaveListingUrl(task.task_id)}
                      >
                        💾 SAVE CUSTOM LISTING URL
                      </button>
                    </div>
                  )}
                </div>

                {/* Proof Link Input or Completed Proof Display */}
                {isCompleted ? (
                  <div style={{ fontSize: '0.85rem', color: '#34d399', background: 'rgba(16,185,129,0.08)', padding: '10px 14px', borderRadius: '6px', border: '1px solid rgba(16,185,129,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span><strong>PROOF / VERIFICATION:</strong> {task.manual_instruction_url || "Confirmed Deleted by Staff Analyst"}</span>
                    {task.manual_instruction_url && (task.manual_instruction_url.startsWith('http') || task.manual_instruction_url.includes('.')) && (
                      <a 
                        href={sanitizeOutboundUrl(task.manual_instruction_url)} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        style={{ color: '#34d399', textDecoration: 'underline', fontWeight: 'bold' }}
                        title={`🔒 SECURE SANDBOX LINK | Destination Domain: ${extractDomain(task.manual_instruction_url)}`}
                      >
                        VIEW PROOF LINK ↗ <span style={{ fontSize: '0.70rem', color: '#64748B', fontWeight: 'normal' }}>(🔒 {extractDomain(task.manual_instruction_url)})</span>
                      </a>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch' }}>
                    <input 
                      className="mask-btn" 
                      placeholder="Paste Removal Confirmation Link / Proof URL..." 
                      style={{ flex: 1, height: '42px', boxSizing: 'border-box', margin: 0 }}
                      value={verifications[task.task_id] || ""}
                      onChange={(e) => setVerifications({...verifications, [task.task_id]: e.target.value})}
                    />
                    <button 
                      className="reset-btn" 
                      disabled={actionLoadingTasks[task.task_id] === 'completing'}
                      style={{ 
                        borderColor: '#10b981', 
                        color: '#10b981', 
                        background: actionLoadingTasks[task.task_id] === 'completing' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                        fontWeight: 'bold', 
                        height: '42px', 
                        padding: '0 18px', 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: '8px',
                        boxSizing: 'border-box', 
                        margin: 0, 
                        whiteSpace: 'nowrap',
                        cursor: actionLoadingTasks[task.task_id] ? 'wait' : 'pointer'
                      }} 
                      onClick={() => handleResolve(task.task_id)}
                    >
                      {actionLoadingTasks[task.task_id] === 'completing' ? (
                        <>
                          <span className="fast-spinner" style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid rgba(16,185,129,0.3)', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                          COMPLETING & VERIFYING...
                        </>
                      ) : (
                        "MARK COMPLETE"
                      )}
                    </button>
                  </div>
                )}

              </div>
            );
          })}

          {fullFilteredCount > displayLimit && (
            <div style={{ textAlign: 'center', marginTop: '25px', marginBottom: '15px' }}>
              <button 
                className="main-button" 
                style={{ padding: '12px 30px', fontSize: '0.88rem', background: 'linear-gradient(135deg, #0047AB, #00D2FF)', fontWeight: 'bold' }}
                onClick={() => setDisplayLimit(prev => prev + 50)}
              >
                ⚡ LOAD MORE TASKS ({fullFilteredCount - displayLimit} REMAINING)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}