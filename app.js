// ─────────────────────────────────────────────────────────────
// KONFIGURATION – hier anpassen
// ─────────────────────────────────────────────────────────────
const CONFIG = {
  AUTH0_DOMAIN: "dev-ompvmvxk02ucpm3p.us.auth0.com",
  AUTH0_CLIENT_ID: "alAJW2uzmK4f55iAvRC3JhwMND0rbRUT",
  AUTH0_AUDIENCE: "https://api.automatisierungen-ki.de",
  API_BASE: "https://api.automatisierungen-ki.de",
  N8N_WEBHOOK_BASE: "https://automatisierung.automatisierungen-ki.de/webhook",
  POLL_INTERVAL: 5000,
};

// ─────────────────────────────────────────────────────────────
// TENANT POLICIES – Auswahl-Analyse sauber pro Kunde trennen
// ─────────────────────────────────────────────────────────────
const COMPANY_IDS = Object.freeze({
  KOPIETZ_KI: 1,
  BRAND4SOCIAL: 2,
  VIRALITYFILMS: 3,
  COMPANY4_RECRUITING: 4,
  RC360: 6
});

function getCurrentCompanyId() {
  return Number(companyData?.id || 0);
}

function isKopietzCompany() {
  return getCurrentCompanyId() === COMPANY_IDS.KOPIETZ_KI;
}

function isBrand4SocialCompany() {
  return getCurrentCompanyId() === COMPANY_IDS.BRAND4SOCIAL;
}

function isViralityFilmsCompany() {
  return getCurrentCompanyId() === COMPANY_IDS.VIRALITYFILMS;
}

function isCompany4RecruitingCompany() {
  return getCurrentCompanyId() === COMPANY_IDS.COMPANY4_RECRUITING;
}

function isRC360Company() {
  return getCurrentCompanyId() === COMPANY_IDS.RC360;
}

function usesCompany1Crm() {
  return isKopietzCompany() || isRC360Company();
}

function usesAdvancedManufacturingScan() {
  return isViralityFilmsCompany() || isRC360Company();
}

function usesImplisenseSerperDiscoveryScan() {
  return isKopietzCompany() || usesAdvancedManufacturingScan();
}

function usesSharedSalesCrm() {
  return isKopietzCompany() || isViralityFilmsCompany() || isCompany4RecruitingCompany() || isRC360Company();
}

const K1_PIPELINE_CRM_STATUSES = [
  "analyzed",
  "email_sent",
  "email_opened",
  "bounced",
  "video_opened",
  "meeting",
  "won",
  "existing_customer",
  "no_interest",
  "lost"
];

function getSelectedAnalysisPolicy() {
  if (isKopietzCompany()) {
    return {
      enabled: true,
      key: "kopietz_ki_solution",
      maxLeads: 50,
      requiresCallApproval: false,
      allowedStatuses: ["hubspot_imported", "new", "no_email", "ready", "enriched", "contact_confirmed", "ready_for_analysis", "called", "approved"]
    };
  }

  if (isBrand4SocialCompany()) {
    return {
      enabled: true,
      key: "brand4social",
      maxLeads: 20,
      requiresCallApproval: false,
      allowedStatuses: ["hubspot_imported", "new", "no_email", "ready", "contact_confirmed"]
    };
  }

  if (isViralityFilmsCompany()) {
    return {
      enabled: true,
      key: "viralityfilms",
      maxLeads: 50,
      requiresCallApproval: true,
      allowedStatuses: ["new", "no_email", "contact_confirmed", "ready_for_analysis", "called", "approved", "ready"]
    };
  }

  if (isCompany4RecruitingCompany()) {
    return {
      enabled: true,
      key: "company4_recruiting",
      maxLeads: 750,
      videoLimit: 250,
      emailOnlyLimit: 500,
      creditsMode: "video_only",
      requiresCallApproval: false,
      allowedStatuses: ["new", "no_email", "ready", "enriched", "contact_confirmed"]
    };
  }

  if (isRC360Company()) {
    return {
      enabled: true,
      key: "rc360",
      maxLeads: 50,
      requiresCallApproval: false,
      allowedStatuses: [
        "hubspot_imported",
        "new",
        "no_email",
        "ready",
        "outreach_failed",
        "contact_confirmed",
        "ready_for_analysis",
        "called",
        "approved",
        "enriched"
      ]
    };
  }

  return {
    enabled: false,
    key: "unsupported",
    maxLeads: 0,
    requiresCallApproval: false,
    allowedStatuses: []
  };
}

function getLeadEmail(lead) {
  if (!lead) return "";

  // Company 3 bearbeitet Kontaktdaten manuell im Dashboard.
  // Deshalb hat die manuelle E-Mail Vorrang vor automatisch gefundenen E-Mail-Feldern.
  if (usesCompany1Crm() || isViralityFilmsCompany()) {
    return lead.email || lead.final_email || lead.findymail_email || "";
  }

  return lead.final_email || lead.findymail_email || lead.email || "";
}

function getLeadContactPerson(lead) {
  if (!lead) return "–";

  const ownerName = lead.inhaber_vorname
    ? `${lead.inhaber_vorname} ${lead.inhaber_nachname || ""}`.trim()
    : "";

  if (isViralityFilmsCompany()) {
    return lead.contact_person || ownerName || lead.managing_director || "–";
  }

  return ownerName || lead.contact_person || lead.managing_director || "–";
}

function getLeadDisplayStatus(lead) {
  if (!lead) return "new";

  const crmStatus = String(lead.crm_status || "").toLowerCase();
  if (
    usesSharedSalesCrm() &&
    (usesCompany1Crm()
      ? K1_PIPELINE_CRM_STATUSES
      : ["follow_up", "meeting", "won", "lost", "existing_customer", "no_interest"]
    ).includes(crmStatus)
  ) return crmStatus;

  const outreachStatus = lead.outreach_status || "";
  const status = lead.status || "";
  const outreachPriority = [
    "replied",
    "bounced",
    "unsubscribed",
    "email_clicked",
    "email_opened",
    "email_sent",
    "sent",
    "active"
  ];

  if (outreachPriority.includes(outreachStatus)) return outreachStatus;
  if (status === "outreach_active" && outreachStatus) return outreachStatus;
  return status || outreachStatus || "new";
}

function getLeadPipelineStatus(lead) {
  if (usesSharedSalesCrm()) {
    const status = String(lead?.status || "").toLowerCase();
    const crmStatus = String(lead?.crm_status || "").toLowerCase();
    const outreachStatus = String(lead?.outreach_status || "").toLowerCase();

    if (usesCompany1Crm() && K1_PIPELINE_CRM_STATUSES.includes(crmStatus)) return crmStatus;
    if (crmStatus === "analyzed") return "analyzed";
    if (crmStatus === "no_interest") return "no_interest";
    if (["lost", "disqualified"].includes(crmStatus || status)) return "lost";
    if (["existing_customer", "customer"].includes(crmStatus || status)) return "existing_customer";
    if ((crmStatus || status) === "won") return "won";
    if ((crmStatus || status) === "meeting") return "meeting";
    if (status === "bounced" || outreachStatus === "bounced") return "bounced";

    const videoWasOpened =
      status === "video_opened" ||
      lead?.pitchlane_video_opened === true ||
      Number(lead?.pitchlane_video_view_count || 0) > 0 ||
      Boolean(lead?.pitchlane_first_opened_at);
    if (videoWasOpened) return "video_opened";

    if (
      ["email_opened", "email_clicked", "replied"].includes(status) ||
      ["email_opened", "email_clicked", "replied"].includes(outreachStatus)
    ) return "email_opened";

    if (
      ["email_sent", "sent", "active", "outreach_active"].includes(status) ||
      ["email_sent", "sent", "active"].includes(outreachStatus) ||
      Boolean(lead?.outreach_sent_at)
    ) return "email_sent";

    return "analyzed";
  }

  const status = getLeadDisplayStatus(lead);
  if (isOutreachVisibleStatus(status)) return "sent";
  return status;
}

function isOutreachVisibleStatus(value) {
  return [
    "sent",
    "active",
    "outreach_active",
    "email_sent",
    "email_opened",
    "email_clicked",
    "replied",
    "bounced",
    "unsubscribed"
  ].includes(value);
}

function getLeadVideoUrl(lead) {
  if (!lead) return null;
  return lead.pitchlane_video_url || lead.video_url || null;
}

function isVideoProcessing(lead) {
  if (!lead) return false;

  return (
    lead.video_status === "pending" ||
    lead.video_status === "video_requested" ||
    lead.pitchlane_status === "pending" ||
    ["QUEUED_FOR_RECORDING", "RENDERING", "PROCESSING"].includes(lead.pitchlane_rendering_status)
  );
}

function getOutreachSyncLabel(lead) {
  const status = getLeadDisplayStatus(lead);
  const label = formatStatusLabel(status);

  if (lead?.pitchlane_hot_lead) return "Ja – Video vollständig angesehen";
  if (lead?.pitchlane_engagement_status) return `Ja – ${formatStatusLabel(lead.pitchlane_engagement_status)}`;
  if (isOutreachVisibleStatus(status)) return `Ja – ${label}`;
  return "Nein";
}

function isEditingCallApprovalForm() {
  if (!isViralityFilmsCompany() || !selectedLeadId) return false;

  const activeId = document.activeElement?.id;
  return [
    "callCompanyName",
    "callContactPerson",
    "callEmail",
    "callPhone",
    "callApproved",
    "callNotes"
  ].includes(activeId);
}

// ─────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────
let auth0Client = null;
let accessToken = null;
let currentUser = null;
let companyData = null;
let leads = [];
let scans = [];
let selectedLeadId = null;
let activeK1LeadListKey = "";
let activeScanId = null;
let scanPollTimer = null;
let activeQuickFilter = "all";
let activeArchiveMode = false;
let selectedAnalysisLeadIds = [];
let isStartingSelectedAnalysis = false;
let isSavingCallApproval = false;

// ─────────────────────────────────────────────────────────────
// AUTH0 INIT
// ─────────────────────────────────────────────────────────────
async function initAuth() {
  try {
    auth0Client = await auth0.createAuth0Client({
      domain: CONFIG.AUTH0_DOMAIN,
      clientId: CONFIG.AUTH0_CLIENT_ID,
      authorizationParams: {
        redirect_uri: window.location.origin,
        audience: CONFIG.AUTH0_AUDIENCE,
        scope: "openid profile email"
      },
      cacheLocation: "localstorage",
      useRefreshTokens: true
    });

    // Nach Redirect-Callback verarbeiten
    if (window.location.search.includes("code=") || window.location.search.includes("error=")) {
      try {
        await auth0Client.handleRedirectCallback();
      } catch(cbErr) {
        console.warn("Callback Fehler:", cbErr);
      }
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const isAuthenticated = await auth0Client.isAuthenticated();

    if (isAuthenticated) {
      currentUser = await auth0Client.getUser();
      try {
        accessToken = await auth0Client.getTokenSilently();
      } catch(tokenErr) {
        console.warn("Token silent Fehler:", tokenErr);
        accessToken = null;
      }
      await initApp();
    } else {
      await auth0Client.loginWithRedirect();
    }

  } catch (err) {
    console.error("Auth0 Fehler:", err);
    // Trotzdem App zeigen
    showLoader(false);
    showApp();
    setupUI();
    bindEvents();
    showToast("Login fehlgeschlagen – bitte Seite neu laden.", "error");
  }
}

// ─────────────────────────────────────────────────────────────
// APP INITIALISIERUNG (nach Login)
// ─────────────────────────────────────────────────────────────
async function initApp() {
  showLoader(true);
  try {
    // 1. Company zuerst laden – alle anderen Calls brauchen company_id
    await loadCompanyData();

    // 2. Parallel laden sobald company_id bekannt
    await Promise.all([loadStats(), loadScans(), loadLeads()]);

    setupUI();
    bindEvents();
    showLoader(false);
    showApp();
    startCrmReminderPolling();

    // 3. Nochmal laden nach App-Start um sicher alles zu haben
    setTimeout(async () => {
      await Promise.all([loadStats(), loadScans(), loadLeads()]);
    }, 500);

  } catch (err) {
    console.error("App init Fehler:", err);
    showLoader(false);
    showApp();
    setupUI();
    bindEvents();
    showToast("Fehler beim Laden der Daten.", "error");
  }
}

// ─────────────────────────────────────────────────────────────
// API HELPER
// ─────────────────────────────────────────────────────────────
async function apiRequest(path, options = {}) {
  const url = `${CONFIG.API_BASE}${path}`;
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${accessToken}`,
    ...options.headers
  };

  try {
    // Token ggf. aktualisieren
    accessToken = await auth0Client.getTokenSilently();
    headers["Authorization"] = `Bearer ${accessToken}`;

    const res = await fetch(url, { ...options, headers });

    if (res.status === 401) {
      await auth0Client.loginWithRedirect();
      return null;
    }

    if (!res.ok) {
      const responseText = await res.text();
      let err = {};
      try {
        err = responseText ? JSON.parse(responseText) : {};
      } catch {
        err = { details: responseText };
      }
      const detail = err.error || err.message || err.details || `API Fehler ${res.status}`;
      const stage = err.stage ? ` [${err.stage}]` : "";
      throw new Error(`${detail}${stage}`);
    }

    return await res.json();
  } catch (err) {
    console.error(`API ${path}:`, err);
    throw err;
  }
}

async function webhookRequest(path, body) {
  const url = `${CONFIG.N8N_WEBHOOK_BASE}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`Webhook Fehler ${res.status}`);
  return await res.json().catch(() => ({}));
}

// ─────────────────────────────────────────────────────────────
// DATEN LADEN
// ─────────────────────────────────────────────────────────────
async function loadCompanyData() {
  try {
    const data = await apiRequest("/companies");
    companyData = Array.isArray(data) ? data[0] : data;
    applyCompanyBranding();
    syncK1UploadUi();
  } catch (err) {
    console.warn("Company-Daten konnten nicht geladen werden:", err);
  }
}

async function loadStats() {
  try {
    const companyParam3 = companyData?.id ? `?company_id=${companyData.id}` : "";
    const data = await apiRequest(`/leads/stats${companyParam3}`);
    renderStats(data);
  } catch (err) {
    // Fallback: aus Leads berechnen
    renderStats(null);
  }
}

async function loadLeads(page = 1) {
  try {
    // company_id immer mitschicken wenn vorhanden
    const cid = companyData?.id;
    const companyParam = cid ? `&company_id=${cid}` : "";
    const archiveParam = activeArchiveMode ? "&archived=true" : "&archived=false";
    const leadLimit = Number(cid) === COMPANY_IDS.KOPIETZ_KI ? 8000 : 500;
    console.log("loadLeads company_id:", cid, "archive:", activeArchiveMode);
    const data = await apiRequest(`/leads?page=${page}&limit=${leadLimit}${archiveParam}${companyParam}`);
    leads = Array.isArray(data) ? data : (data.leads || data.data || []);
    selectedAnalysisLeadIds = selectedAnalysisLeadIds.filter(id => {
      const lead = leads.find(l => Number(l.id) === Number(id));
      return lead && isLeadSelectable(lead);
    });
    console.log("Leads geladen:", leads.length);
    renderAll();
    // Drawer nur neu rendern, wenn gerade kein VF-Kontaktformular bearbeitet/gespeichert wird.
    if (selectedLeadId && !isSavingCallApproval && !isEditingCallApprovalForm()) {
      renderDrawer(selectedLeadId);
    }
  } catch (err) {
    console.error("Leads laden:", err);
    leads = [];
    renderAll();
  }
}

async function loadScans() {
  try {
    const companyParam2 = companyData?.id ? `&company_id=${companyData.id}` : "";
    const data = await apiRequest(`/scans?limit=10${companyParam2}`);
    scans = Array.isArray(data) ? data : (data.scans || data.data || []);
    renderScans();
    renderRecentScans();
  } catch (err) {
    console.error("Scans laden:", err);
    scans = [];
  }
}

// ─────────────────────────────────────────────────────────────
// SCAN STARTEN
// ─────────────────────────────────────────────────────────────
async function startScan() {
  const industry = document.getElementById("industryInput").value.trim();
  const region = document.getElementById("regionInput").value.trim();
  const leadLimit = parseInt(document.getElementById("leadLimitInput").value, 10) || 25;

  if (!industry || !region) {
    showToast(
      usesImplisenseSerperDiscoveryScan()
        ? (isKopietzCompany()
            ? "Bitte Zielgruppe und Bundesland auswählen."
            : "Bitte Branche und Bundesland auswählen.")
        : "Bitte Branche und Region eingeben.",
      "error"
    );
    return;
  }

  if (!companyData?.id) {
    showToast("Keine Company-ID gefunden.", "error");
    return;
  }

  const btn = document.getElementById("startScanBtn");
  const statusEl = document.getElementById("scanStatus");
  const statusText = document.getElementById("scanStatusText");

  btn.disabled = true;
  statusEl.classList.remove("hidden");
  statusText.textContent = "Scan wird erstellt…";

  // Basis-Payload
  const scanBody = {
    company_id: companyData.id,
    industry,
    region,
    lead_limit: leadLimit
  };

  // Company 1, Company 3 und Company 6 nutzen die erweiterten Scan-Parameter.
  if (usesImplisenseSerperDiscoveryScan()) {
    const city = (document.getElementById("vfCityInput")?.value || "").trim();
    const defaultMinEmployees = isViralityFilmsCompany() ? 51 : 1;
    const defaultMaxEmployees = isViralityFilmsCompany() ? 200 : 100000;
    const minEmp = parseInt(document.getElementById("vfMinEmpInput")?.value, 10) || defaultMinEmployees;
    const maxEmp = parseInt(document.getElementById("vfMaxEmpInput")?.value, 10) || defaultMaxEmployees;

    if (minEmp > maxEmp) {
      btn.disabled = false;
      statusEl.classList.add("hidden");
      showToast("Mitarbeiter (von) darf nicht größer als Mitarbeiter (bis) sein.", "error");
      return;
    }

    if (city) scanBody.city = city;
    scanBody.min_employees = minEmp;
    scanBody.max_employees = maxEmp;
    scanBody.source = isViralityFilmsCompany() ? "apollo_outscraper" : "implisense_serper";
  }

  try {
    // 1. Scan in DB anlegen via API
    const scanData = await apiRequest("/scans", {
      method: "POST",
      body: JSON.stringify(scanBody)
    });

    const scanId = scanData?.scan?.id || scanData?.id || scanData?.scan_id;
    activeScanId = scanId;
    statusText.textContent = `Scan #${scanId} gestartet – analysiere Leads…`;

    // n8n wird bereits von der API getriggert
    addActivity("Scan gestartet", `Scan #${scanId} für "${industry}" in ${region} gestartet.`);
    showToast(`Scan #${scanId} läuft!`);

    // 3. Polling starten
    startScanPolling(scanId);

  } catch (err) {
    console.error("Scan starten:", err);
    showToast(`Fehler: ${err.message}`, "error");
    btn.disabled = false;
    statusEl.classList.add("hidden");
  }
}

function startScanPolling(scanId) {
  if (scanPollTimer) clearInterval(scanPollTimer);

  const statusText = document.getElementById("scanStatusText");

  scanPollTimer = setInterval(async () => {
    try {
      const scan = await apiRequest(`/scans/${scanId}`);
      const status = scan.status;

      if (status === "finished") {
        clearInterval(scanPollTimer);
        scanPollTimer = null;
        activeScanId = null;

        document.getElementById("startScanBtn").disabled = false;
        document.getElementById("scanStatus").classList.add("hidden");

        addActivity("Scan abgeschlossen", `Scan #${scanId}: ${scan.total_inserted || 0} Leads gespeichert.`);
        showToast(`Scan abgeschlossen! ${scan.total_inserted || 0} neue Leads.`, "success");

        await loadLeads();
        await loadScans();

      } else if (status === "processing") {
        const processed = scan.total_processed || 0;
        const found = scan.total_found || 0;
        statusText.textContent = `Scan läuft… ${processed}/${found} Leads verarbeitet`;

      } else if (status === "failed") {
        clearInterval(scanPollTimer);
        scanPollTimer = null;
        document.getElementById("startScanBtn").disabled = false;
        document.getElementById("scanStatus").classList.add("hidden");
        showToast("Scan fehlgeschlagen.", "error");
      }
    } catch (err) {
      console.warn("Scan-Status Fehler:", err);
    }
  }, CONFIG.POLL_INTERVAL);
}

// ─────────────────────────────────────────────────────────────
// VIDEO GENERIEREN
// ─────────────────────────────────────────────────────────────
async function generateVideo(leadId) {
  const lead = leads.find(l => l.id === leadId);
  if (!lead) return;

  document.getElementById("actionOutputText").textContent = "Video wird generiert…";
  document.getElementById("actionOutput").classList.remove("hidden");

  try {
    const res = await webhookRequest("/generate-video", {
      lead_id: leadId,
      company_id: companyData.id
    });

    if (res.success || res.status === "pending") {
      addActivity("Video generiert", `Pitchlane Video für ${lead.lead_name} wird gerendert.`);
      showToast("Video wird gerendert. Du wirst benachrichtigt wenn es fertig ist.");
      document.getElementById("actionOutputText").textContent = "Video-Rendering gestartet. Bitte warte einige Minuten – das Video erscheint automatisch hier.";
      startVideoPolling(leadId);
    } else {
      showToast(res.message || "Fehler beim Video-Start.", "error");
    }
  } catch (err) {
    showToast(`Video-Fehler: ${err.message}`, "error");
  }
}

function startVideoPolling(leadId) {
  let attempts = 0;
  const maxAttempts = 24; // 2 Minuten

  const timer = setInterval(async () => {
    attempts++;
    if (attempts > maxAttempts) {
      clearInterval(timer);
      return;
    }
    try {
      const data = await apiRequest(`/leads/${leadId}`);
      const readyVideoUrl = isBrand4SocialCompany()
        ? (data.pitchlane_video_url || data.video_url)
        : (data.video_status === "completed" ? data.video_url : null);

      if (readyVideoUrl) {
        clearInterval(timer);
        // Lead in Array aktualisieren
        const idx = leads.findIndex(l => l.id === leadId);
        if (idx >= 0) leads[idx] = data;
        if (selectedLeadId === leadId) renderDrawer(leadId);
        showToast("Video ist fertig!", "success");
      }
    } catch (err) {
      console.warn("Video-Poll:", err);
    }
  }, 5000);
}

// ─────────────────────────────────────────────────────────────
// OUTREACH ÜBERGEBEN
// ─────────────────────────────────────────────────────────────
async function sendToOutreach(leadId) {
  const lead = leads.find(l => l.id === leadId);
  if (!lead) return;

  document.getElementById("actionOutputText").textContent = "Wird übergeben…";
  document.getElementById("actionOutput").classList.remove("hidden");

  try {
    const res = await webhookRequest("/send-to-outreach", {
      lead_id: leadId,
      company_id: companyData.id
    });

    if (res.success) {
      addActivity("Outreach übergeben", `${lead.lead_name} wurde an Instantly übergeben.`);
      showToast(`${lead.lead_name} erfolgreich übergeben!`, "success");
      document.getElementById("actionOutputText").textContent = `Lead erfolgreich an Outreach übergeben.`;

      // Status im Array aktualisieren
      const idx = leads.findIndex(l => l.id === leadId);
      if (idx >= 0) leads[idx].outreach_status = "sent";
      renderLeadTable();
    } else {
      showToast(res.message || "Fehler bei Outreach-Übergabe.", "error");
      document.getElementById("actionOutputText").textContent = res.message || "Fehler.";
    }
  } catch (err) {
    showToast(`Outreach-Fehler: ${err.message}`, "error");
  }
}

// ─────────────────────────────────────────────────────────────
// E-MAIL ERNEUT ÜBER INSTANTLY SENDEN
// ─────────────────────────────────────────────────────────────
function canResendCompany3Email(lead) {
  if (!(usesCompany1Crm() || isViralityFilmsCompany()) || !lead) return false;
  if (isViralityFilmsCompany() && lead.call_approved !== true) return false;
  if (!getLeadEmail(lead)) return false;

  const resendableStatuses = new Set([
    "sent",
    "active",
    "email_sent",
    "email_opened",
    "email_clicked",
    "replied",
    "outreach_active",
    "outreach_completed"
  ]);

  return Boolean(
    lead.instantly_lead_id ||
    lead.outreach_sent_at ||
    resendableStatuses.has(String(lead.outreach_status || "").toLowerCase()) ||
    resendableStatuses.has(String(lead.status || "").toLowerCase())
  );
}

function syncCompany3ResendButton(lead) {
  let button = document.getElementById("resendInstantlyEmailBtn");

  if (!(usesCompany1Crm() || isViralityFilmsCompany())) {
    button?.remove();
    return;
  }

  const actionContainer = document.getElementById("saveCallApprovalBtn")?.parentElement;
  if (!actionContainer) return;

  if (!button) {
    button = document.createElement("button");
    button.id = "resendInstantlyEmailBtn";
    button.type = "button";
    button.className = "btn btn-ghost";
    button.style.cssText = "padding:9px 14px;font-size:13px;border:1px solid var(--border);";
    button.textContent = "E-Mail erneut senden";
    button.title = "Sendet die E-Mail mit den aktuell gespeicherten Kontaktdaten erneut über Instantly";
    button.addEventListener("click", () => {
      if (selectedLeadId) resendCompany3Email(selectedLeadId);
    });
    actionContainer.appendChild(button);
  }

  button.classList.toggle("hidden", !canResendCompany3Email(lead));
  button.disabled = false;
  button.textContent = "E-Mail erneut senden";
}

async function resendCompany3Email(leadId) {
  if (!(usesCompany1Crm() || isViralityFilmsCompany())) return;

  const lead = leads.find(item => Number(item.id) === Number(leadId));
  if (!lead || !canResendCompany3Email(lead)) {
    showToast("Der Lead ist noch nicht für einen Wiederholungsversand bereit.", "error");
    return;
  }

  const formLeadName = document.getElementById("callCompanyName")?.value.trim() || "";
  const formContactPerson = document.getElementById("callContactPerson")?.value.trim() || "";
  const formEmail = document.getElementById("callEmail")?.value.trim() || "";
  const formPhone = document.getElementById("callPhone")?.value.trim() || "";
  const email = formEmail || getLeadEmail(lead);
  const contactPerson = formContactPerson || lead.contact_person || lead.managing_director || "";
  const leadName = formLeadName || lead.lead_name || lead.company_name || "";
  const phone = formPhone || lead.phone || "";

  if (!email) {
    showToast("Bitte zuerst eine E-Mail-Adresse speichern oder eintragen.", "error");
    return;
  }

  if (!confirm(`Die E-Mail an ${email} wirklich erneut über Instantly senden?`)) return;

  const button = document.getElementById("resendInstantlyEmailBtn");
  if (button) {
    button.disabled = true;
    button.textContent = "Versand wird angefordert...";
  }

  try {
    const result = await apiRequest("/instantly/resend", {
      method: "POST",
      body: JSON.stringify({
        lead_id: Number(leadId),
        lead_name: leadName,
        contact_person: contactPerson,
        email,
        phone
      })
    });

    const requestedAt = result?.requested_at || new Date().toISOString();
    Object.assign(lead, {
      updated_at: requestedAt,
      instantly_lead_id: result?.instantly_lead_id || lead.instantly_lead_id,
      instantly_campaign_id: result?.instantly_campaign_id || lead.instantly_campaign_id,
      email: result?.email || email,
      final_email: result?.email || lead.final_email || email,
      final_email_type: result?.email ? "manual" : lead.final_email_type,
      contact_person: result?.contact_person || contactPerson,
      managing_director: result?.contact_person || contactPerson || lead.managing_director,
      phone: result?.phone || phone
    });

    addTimelineEntry(
      Number(leadId),
      "E-Mail erneut angefordert",
      `Wiederholungsversand an ${lead.contact_person ? `${lead.contact_person} <${lead.email}>` : lead.email} wurde bei Instantly angefordert.`
    );

    const actionOutput = document.getElementById("actionOutput");
    const actionOutputText = document.getElementById("actionOutputText");
    if (actionOutput && actionOutputText) {
      actionOutputText.textContent = result?.message || "Erneuter Versand wurde angefordert.";
      actionOutput.classList.remove("hidden");
    }

    renderDrawer(leadId);
    renderLeadTable();
    showToast("Erneuter E-Mail-Versand wurde mit aktuellen Kontaktdaten angefordert.", "success");
  } catch (error) {
    showToast(`Wiederholungsversand fehlgeschlagen: ${error.message}`, "error");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "E-Mail erneut senden";
    }
  }
}

// ─────────────────────────────────────────────────────────────
// RC360 / COMPANY 6 – DIALFIRE CALL VORBEREITEN
// ─────────────────────────────────────────────────────────────
function syncDialfireCallButton(lead) {
  let button = document.getElementById("dialfireCallBtn");
  let recordingLink = document.getElementById("dialfireRecordingLink");

  if (!isRC360Company()) {
    button?.remove();
    recordingLink?.remove();
    return;
  }

  const actionContainer = document.getElementById("saveCallApprovalBtn")?.parentElement;
  if (!actionContainer) return;

  if (!button) {
    button = document.createElement("button");
    button.id = "dialfireCallBtn";
    button.type = "button";
    button.className = "btn btn-primary";
    button.style.cssText = "padding:9px 14px;font-size:13px;";
    button.addEventListener("click", () => {
      if (selectedLeadId) startDialfireCall(selectedLeadId);
    });
    actionContainer.prepend(button);
  }

  const phoneInput = document.getElementById("callPhone");
  if (phoneInput && phoneInput.dataset.dialfireInputBound !== "true") {
    phoneInput.dataset.dialfireInputBound = "true";
    phoneInput.addEventListener("input", () => {
      const activeLead = leads.find(item => Number(item.id) === Number(selectedLeadId));
      syncDialfireCallButton(activeLead || lead);
    });
  }

  const currentPhone = phoneInput?.value.trim() || lead?.phone || "";
  button.disabled = !currentPhone;
  button.textContent = currentPhone ? "Mit Dialfire anrufen" : "Keine Telefonnummer";
  button.title = currentPhone
    ? "Kontakt an Dialfire übergeben und Dialfire öffnen"
    : "Bitte zuerst eine Telefonnummer eintragen";

  const recordingUrl = String(lead?.dialfire_recording_url || "").trim();
  if (recordingUrl) {
    if (!recordingLink) {
      recordingLink = document.createElement("a");
      recordingLink.id = "dialfireRecordingLink";
      recordingLink.className = "btn btn-ghost";
      recordingLink.style.cssText = "padding:9px 14px;font-size:13px;border:1px solid var(--border);";
      recordingLink.target = "_blank";
      recordingLink.rel = "noopener noreferrer";
      recordingLink.textContent = "Aufzeichnung öffnen";
      actionContainer.appendChild(recordingLink);
    }
    recordingLink.href = recordingUrl;
    recordingLink.classList.remove("hidden");
  } else {
    recordingLink?.remove();
  }
}

async function startDialfireCall(leadId) {
  if (!isRC360Company()) return;

  const lead = leads.find(item => Number(item.id) === Number(leadId));
  if (!lead) return;

  const leadName = document.getElementById("callCompanyName")?.value.trim() || lead.lead_name || "";
  const contactPerson = document.getElementById("callContactPerson")?.value.trim() || lead.contact_person || "";
  const email = document.getElementById("callEmail")?.value.trim() || getLeadEmail(lead);
  const phone = document.getElementById("callPhone")?.value.trim() || lead.phone || "";
  const callNotes = document.getElementById("callNotes")?.value.trim() || lead.call_notes || "";

  if (!phone) {
    showToast("Bitte zuerst eine Telefonnummer eintragen.", "error");
    return;
  }

  // Das Fenster wird synchron zum Klick geöffnet, damit Browser-Popup-Blocker
  // die spätere Weiterleitung nach dem API-Aufruf nicht verhindern.
  const dialfireWindow = window.open("about:blank", "_blank");
  if (dialfireWindow) {
    dialfireWindow.opener = null;
    dialfireWindow.document.title = "Dialfire wird vorbereitet";
    dialfireWindow.document.body.innerHTML = "<p style='font-family:sans-serif;padding:24px'>Dialfire wird vorbereitet …</p>";
  }

  const button = document.getElementById("dialfireCallBtn");
  if (button) {
    button.disabled = true;
    button.textContent = "Dialfire wird vorbereitet …";
  }

  try {
    // Aktuelle Formularwerte zuerst speichern, damit der n8n-Workflow stets
    // den gerade sichtbaren und bestätigten Datenstand aus der API erhält.
    const savedLead = await apiRequest(`/leads/${leadId}`, {
      method: "PATCH",
      body: JSON.stringify({
        lead_name: leadName,
        contact_person: contactPerson,
        email,
        phone,
        call_notes: callNotes
      })
    });
    Object.assign(lead, savedLead || {}, { lead_name: leadName, contact_person: contactPerson, email, phone, call_notes: callNotes });

    const result = await apiRequest(`/leads/${leadId}/dialfire/prepare`, {
      method: "POST",
      body: JSON.stringify({})
    });

    Object.assign(lead, {
      dialfire_contact_id: result?.dialfire_contact_id || lead.dialfire_contact_id,
      dialfire_campaign_id: result?.campaign_id || lead.dialfire_campaign_id,
      dialfire_task_name: result?.task_name || lead.dialfire_task_name,
      dialfire_external_ref: result?.external_ref || lead.dialfire_external_ref,
      dialfire_last_status: "prepared",
      dialfire_call_requested_at: result?.requested_at || new Date().toISOString(),
      dialfire_call_requested_by: currentUser?.email || "dashboard",
      dialfire_last_error: null
    });

    addTimelineEntry(
      Number(leadId),
      "Dialfire vorbereitet",
      `Kontakt ${contactPerson || leadName} wurde für den Anruf an Dialfire übergeben.`
    );

    const openUrl = String(result?.open_url || "").trim();
    if (openUrl && dialfireWindow) {
      dialfireWindow.location.replace(openUrl);
    } else if (openUrl) {
      window.open(openUrl, "_blank", "noopener,noreferrer");
    } else {
      dialfireWindow?.close();
      showToast("Kontakt wurde übergeben, aber die Dialfire-URL fehlt.", "error");
    }

    renderDrawer(leadId);
    renderLeadTable();
    showToast("Kontakt wurde an Dialfire übergeben.", "success");
  } catch (error) {
    dialfireWindow?.close();
    showToast(`Dialfire konnte nicht geöffnet werden: ${error.message}`, "error");
  } finally {
    const currentLead = leads.find(item => Number(item.id) === Number(leadId));
    syncDialfireCallButton(currentLead || lead);
  }
}


// ─────────────────────────────────────────────────────────────
// TELEFONISCHE KONTAKTFREIGABE SPEICHERN
// ─────────────────────────────────────────────────────────────
async function disqualifyLead(leadId) {
  if (!(usesCompany1Crm() || isViralityFilmsCompany())) return;
  if (!confirm("Lead als 'Kein Interesse' markieren? Diese Aktion kann nicht rückgängig gemacht werden.")) return;
  try {
    const updatedLead = await apiRequest(`/leads/${leadId}`, {
      method: "PATCH",
      body: JSON.stringify({
        crm_status: "no_interest",
        status: "no_interest",
        call_notes: (document.getElementById("callNotes")?.value || "") + " [Kein Interesse – manuell markiert]"
      })
    });
    const idx = leads.findIndex(l => Number(l.id) === Number(leadId));
    if (idx >= 0) leads[idx] = { ...leads[idx], crm_status: "no_interest", ...updatedLead };
    addTimelineEntry(leadId, "Kein Interesse", "Lead wurde als 'Kein Interesse' markiert.");
    renderDrawer(leadId);
    renderLeadTable();
    showToast("Lead als 'Kein Interesse' markiert.", "success");
  } catch (err) {
    showToast("Fehler beim Speichern: " + err.message, "error");
  }
}

async function saveCallApproval(leadId) {
  const lead = leads.find(l => Number(l.id) === Number(leadId));
  if (!lead) return;

  const leadName = document.getElementById("callCompanyName")?.value.trim() || "";
  const contactPerson = document.getElementById("callContactPerson")?.value.trim() || "";
  const email = document.getElementById("callEmail")?.value.trim() || "";
  const phone = document.getElementById("callPhone")?.value.trim() || "";
  const callApproved = document.getElementById("callApproved")?.checked === true;
  const callNotes = document.getElementById("callNotes")?.value.trim() || "";

  if (!leadName) {
    showToast("Bitte den Firmennamen eintragen.", "error");
    return;
  }

  if (callApproved && !contactPerson) {
    showToast("Für die Freigabe bitte den zuständigen Ansprechpartner eintragen.", "error");
    return;
  }

  if (callApproved && !email) {
    showToast("Für die Freigabe muss eine E-Mail-Adresse hinterlegt sein.", "error");
    return;
  }

  const updates = {
    lead_name: leadName,
    contact_person: contactPerson,
    email,
    phone,
    call_approved: callApproved,
    call_notes: callNotes
  };

  const button = document.getElementById("saveCallApprovalBtn");
  const originalText = button?.textContent || "Kontakt & Freigabe speichern";

  try {
    isSavingCallApproval = true;

    if (button) {
      button.disabled = true;
      button.textContent = "Wird gespeichert…";
    }

    const updatedLead = await apiRequest(`/leads/${leadId}`, {
      method: "PATCH",
      body: JSON.stringify(updates)
    });

    // WICHTIG: leads-Array ZUERST aktualisieren, dann renderDrawer aufrufen
    // Sonst überschreibt renderDrawer die Felder mit alten Werten
    const index = leads.findIndex(l => Number(l.id) === Number(leadId));
    if (index >= 0) {
      const manualEmailUpdate = (usesCompany1Crm() || isViralityFilmsCompany())
        ? {
            final_email: email || updatedLead?.final_email || "",
            final_email_type: email ? "manual" : (updatedLead?.final_email_type || null)
          }
        : {};

      leads[index] = {
        ...leads[index],
        ...updates,
        ...(updatedLead || {}),
        ...manualEmailUpdate,
        // call_approved explizit sichern – PATCH gibt es im RETURNING zurück
        call_approved: updatedLead?.call_approved ?? callApproved
      };
    }

    const newVideoStarted = updatedLead?.wf02b_triggered === true;
    addTimelineEntry(
      leadId,
      newVideoStarted
        ? "Neues Video angefordert"
        : (callApproved ? "E-Mail-Freigabe erteilt" : "Kontaktdaten aktualisiert"),
      newVideoStarted
        ? `Empfänger auf ${contactPerson} <${email}> aktualisiert. WF02b für neues Video und Versand gestartet.`
        : (callApproved
            ? `Telefonische Freigabe für ${email} dokumentiert.`
            : "Kontaktdaten gespeichert; noch keine Versandfreigabe.")
    );

    renderDrawer(leadId);
    renderLeadTable();
    await loadStats();
    // Frische DB-Daten nach kurzem Delay laden (DB braucht Zeit zum Schreiben)
    setTimeout(() => loadLeads().catch(() => {}), 800);

    showToast(
      newVideoStarted
        ? "Kontakt gespeichert. Neues Video und Versand wurden gestartet."
        : (callApproved ? "Kontakt und Freigabe gespeichert." : "Kontaktdaten gespeichert."),
      "success"
    );
  } catch (err) {
    showToast(`Speichern fehlgeschlagen: ${err.message}`, "error");
  } finally {
    isSavingCallApproval = false;

    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

// ─────────────────────────────────────────────────────────────
// CRM SPEICHERN
// ─────────────────────────────────────────────────────────────
const VF_CRM_STATUS_OPTIONS = [
  ["analyzed", "Analysiert"],
  ["follow_up", "Follow-up offen"],
  ["meeting", "Termin gebucht"],
  ["won", "Gewonnen"],
  ["lost", "Verloren"],
  ["existing_customer", "Bereits Kunde"],
  ["no_interest", "Kein Interesse"]
];

const K1_CRM_STATUS_OPTIONS = [
  ["analyzed", "Analysiert"],
  ["email_sent", "Mail gesendet"],
  ["email_opened", "Mail geöffnet"],
  ["bounced", "Bounce"],
  ["video_opened", "Video geöffnet"],
  ["meeting", "Termin gebucht"],
  ["won", "Gewonnen"],
  ["existing_customer", "Bereits Kunde"],
  ["no_interest", "Kein Interesse"],
  ["lost", "Verloren"]
];

const DEFAULT_CRM_STATUS_OPTIONS = [
  ["new", "Neu"],
  ["qualified", "Qualifiziert"],
  ["cold_call", "Cold Call bereit"],
  ["in_progress", "In Bearbeitung"],
  ["video_ready", "Video bereit"],
  ["sent", "An Outreach übergeben"],
  ["follow_up", "Follow-up offen"],
  ["meeting", "Termin gebucht"],
  ["won", "Gewonnen"],
  ["lost", "Verloren"]
];

function normalizeViralityCrmStatus(status) {
  const value = String(status || "").toLowerCase();
  if (["follow_up", "meeting", "won", "lost", "existing_customer", "no_interest"].includes(value)) return value;
  if (["disqualified"].includes(value)) return "lost";
  if (["customer"].includes(value)) return "existing_customer";
  return "analyzed";
}

function normalizeK1CrmStatus(status) {
  const value = String(status || "").toLowerCase();
  if (K1_PIPELINE_CRM_STATUSES.includes(value)) return value;
  if (["follow_up", "ready", "enriched", "contact_confirmed", "ready_for_analysis"].includes(value)) return "analyzed";
  if (["sent", "active", "outreach_active"].includes(value)) return "email_sent";
  if (["email_clicked", "replied"].includes(value)) return "email_opened";
  if (["disqualified"].includes(value)) return "lost";
  if (["customer"].includes(value)) return "existing_customer";
  return "analyzed";
}

function toDatetimeLocalValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function configureCrmStatusOptions(lead) {
  const select = document.getElementById("crmStatus");
  if (!select) return;
  const options = usesCompany1Crm()
    ? K1_CRM_STATUS_OPTIONS
    : usesSharedSalesCrm()
      ? VF_CRM_STATUS_OPTIONS
      : DEFAULT_CRM_STATUS_OPTIONS;
  select.innerHTML = options
    .map(([value, label]) => `<option value="${value}">${esc(label)}</option>`)
    .join("");
  select.value = usesCompany1Crm()
    ? normalizeK1CrmStatus(getLeadPipelineStatus(lead))
    : usesSharedSalesCrm()
      ? normalizeViralityCrmStatus(lead?.crm_status || lead?.status)
    : (lead?.status || "new");
}

function renderAfterLeadMutation(leadId) {
  renderStatsFromLeads();
  renderTopLeads();
  renderLeadTable();
  renderPipeline();
  renderReports();
  renderK1DataQuality();
  renderK1CampaignCockpit();
  renderK1IcpLearning();
  if (selectedLeadId && Number(selectedLeadId) === Number(leadId)) renderDrawer(leadId);
}

async function saveCrmData(leadId) {
  const lead = leads.find(l => l.id === leadId);
  if (!lead) return;

  const updates = {
    notes: document.getElementById("crmNotes").value,
    owner: document.getElementById("crmOwner").value,
    next_step: document.getElementById("crmNextStep").value,
    follow_up: document.getElementById("crmFollowUp").value
      ? new Date(document.getElementById("crmFollowUp").value).toISOString()
      : ""
  };
  if (usesSharedSalesCrm()) {
    updates.crm_status = document.getElementById("crmStatus").value;
  } else {
    updates.status = document.getElementById("crmStatus").value;
  }

  try {
    const savedLead = await apiRequest(`/leads/${leadId}`, {
      method: "PATCH",
      body: JSON.stringify(updates)
    });

    // Nur den vom Server bestätigten Stand lokal übernehmen.
    const idx = leads.findIndex(l => Number(l.id) === Number(leadId));
    if (idx >= 0) leads[idx] = { ...leads[idx], ...updates, ...savedLead };

    // Timeline-Eintrag
    addTimelineEntry(leadId, "CRM gespeichert", `Status: ${updates.crm_status || updates.status}`);
    showToast("Gespeichert!");
    renderAfterLeadMutation(leadId);
  } catch (err) {
    showToast(`Speichern fehlgeschlagen: ${err.message}`, "error");
  }
}

// Quick Actions
async function generateCallHook(leadId) {
  const lead = leads.find(l => l.id === leadId);
  if (!lead) return;

  const weaknesses = lead.weakness_tags || [];
  const hook = `"Mir ist aufgefallen, dass bei ${lead.lead_name} ${weaknesses.slice(0,2).join(" und ").toLowerCase()} sichtbar ist – das kostet täglich potenzielle Anfragen."`;

  document.getElementById("actionOutputText").textContent = hook;
  document.getElementById("actionOutput").classList.remove("hidden");
  addTimelineEntry(leadId, "Cold Call Hook", "Cold Call Hook wurde generiert.");
  showToast("Cold Call Hook generiert!");
}

async function generateMailDraft(leadId) {
  const lead = leads.find(l => l.id === leadId);
  if (!lead) return;

  const firstName = lead.inhaber_vorname || lead.contact_person?.split(" ")[0] || "dort";
  const compliment = lead.compliment || lead.sales_hook || "";
  const hook = lead.final_sales_hook || lead.sales_hook || "";

  const draft = `Betreff: Kurze Frage zu ${lead.lead_name}\n\nHallo ${firstName},\n\n${compliment}\n\n${hook}\n\nWäre ein kurzes Gespräch diese Woche möglich?\n\nBeste Grüße`;

  document.getElementById("actionOutputText").textContent = draft;
  document.getElementById("actionOutput").classList.remove("hidden");
  addTimelineEntry(leadId, "Erstmail erstellt", "Erstmail-Ansatz wurde generiert.");
  showToast("Erstmail generiert!");
}

// ─────────────────────────────────────────────────────────────
// BRANDING / MULTI-TENANT
// ─────────────────────────────────────────────────────────────
function applyCompanyBranding() {
  if (!companyData) return;

  // Tenant-spezifische Darstellungen bleiben strikt getrennt.
  document.documentElement.classList.toggle("tenant-company-1", isKopietzCompany());
  document.documentElement.classList.toggle("tenant-company-2", isBrand4SocialCompany());
  document.documentElement.classList.toggle("tenant-company-3", isViralityFilmsCompany());
  document.documentElement.classList.toggle("tenant-company-4", isCompany4RecruitingCompany());
  document.documentElement.classList.toggle("tenant-company-6", isRC360Company());
  document.documentElement.classList.toggle("company-k1-premium", isKopietzCompany());
  document.body?.classList.toggle("company-k1-premium", isKopietzCompany());

  // Firmenname
  if (companyData.company_name) {
    document.getElementById("sidebarCompanyName").textContent = companyData.company_name;
    document.title = `${companyData.company_name} – Client Acquisition OS`;
  }

  // Plan
  if (companyData.plan) {
    document.getElementById("sidebarPlan").textContent = companyData.plan;
  }

  // Credits
  const used = companyData.credits_used || 0;
  const total = companyData.credits_total || 0;
  const remaining = total - used;
  const pct = total > 0 ? Math.round((remaining / total) * 100) : 0;

  document.getElementById("sidebarCredits").textContent = remaining;
  document.getElementById("creditsBar").style.width = `${pct}%`;
  document.getElementById("creditsSub").textContent = `${remaining} / ${total} Credits verfügbar`;

  // Primärfarbe – falls das Unternehmen eine eigene Farbe hat
  if (companyData.primary_color) {
    document.documentElement.style.setProperty("--accent", companyData.primary_color);
  }

  // Sekundärfarbe (Gradient-Endwert) – falls gesetzt, sonst behält der
  // CSS-Fallback den jeweiligen Tenant-Standard (z.B. Orange).
  if (companyData.secondary_color) {
    document.documentElement.style.setProperty("--accent-2", companyData.secondary_color);
  }

  // Logo
  if (companyData.logo_url) {
    document.getElementById("sidebarLogo").src = companyData.logo_url;
    document.getElementById("loaderLogo").src = companyData.logo_url;
  }

  applyTenantCopy();
}

function setClosestLabelText(valueId, text) {
  const valueEl = document.getElementById(valueId);
  const labelEl = valueEl?.parentElement?.querySelector("p, .ts-label");
  if (labelEl) labelEl.textContent = text;
}

function setButtonText(selector, text) {
  const el = document.querySelector(selector);
  if (el) el.textContent = text;
}

function applyTenantCopy() {
  if (isRC360Company()) {
    document.querySelectorAll(".leads-table thead th").forEach(header => {
      const label = String(header.textContent || "").trim().toLowerCase();
      if (["website", "instagram", "meta ads"].includes(label)) header.style.display = "none";
    });
  }

  if (!isCompany4RecruitingCompany()) return;

  setText("topbarEyebrow", "RECRUITING OUTREACH OS");
  setClosestLabelText("topbarALeads", "Outreach");
  setClosestLabelText("statALeads", "Job-Signale");
  setClosestLabelText("statAvgScore", "Outreach aktiv");
  setClosestLabelText("statVideos", "Videos");

  const scanSub = document.querySelector(".scan-card .card-sub");
  if (scanSub) scanSub.textContent = "Stellenportale liefern neue Unternehmen mit Personalbedarf direkt ins Dashboard.";

  const opportunitiesSub = document.querySelector("#opportunitiesView .card-sub");
  if (opportunitiesSub) opportunitiesSub.textContent = "Unternehmen aus Stellenportalen auswählen und in Video- oder E-Mail-Kampagnen starten.";

  const toolbarKicker = document.querySelector(".selected-analysis-kicker");
  if (toolbarKicker) toolbarKicker.textContent = "Ausgewählte Kampagne";

  setButtonText('[data-filter="a-only"]', "Neu");
  setButtonText('[data-filter="no-ads"]', "Mit Job-Signal");
  setButtonText("#startSelectedAnalysisBtn", "Kampagne starten");

  const leadTableHeaders = document.querySelectorAll(".leads-table thead th");
  if (leadTableHeaders.length >= 10) {
    leadTableHeaders[1].textContent = "Unternehmen";
    leadTableHeaders[2].textContent = "Stelle";
    leadTableHeaders[3].textContent = "Kontakt";
    leadTableHeaders[4].textContent = "E-Mail";
    leadTableHeaders[5].textContent = "Website";
    leadTableHeaders[6].textContent = "Kampagne";
    leadTableHeaders[7].textContent = "Status";
    leadTableHeaders[8].textContent = "Ort";
  }
}

// ─────────────────────────────────────────────────────────────
// RENDER FUNCTIONS
// ─────────────────────────────────────────────────────────────
function renderAll() {
  ensureArchiveControls();
  renderK1LeadListFilter();
  renderStatsFromLeads();
  renderTopLeads();
  renderLeadTable();
  renderPipeline();
  renderReports();
  renderK1DataQuality();
  renderK1CampaignCockpit();
  renderK1IcpLearning();
}

function renderStats(data) {
  if (data) {
    setText("statLeads", data.total || 0);
    setText("statASP", data.asp_found || 0);
    setText("statEmail", data.email_found || 0);
    setText("statALeads", data.a_leads || 0);
    setText("statAvgScore", `${data.avg_score || 0}%`);
    setText("statVideos", data.videos || 0);
    setText("topbarLeads", data.total || 0);
    setText("topbarALeads", data.a_leads || 0);
    setText("archiveCount", data.archived || 0);
  }
}

function renderStatsFromLeads() {
  const scopedLeads = getK1ScopedLeads();
  const total = scopedLeads.length;
  setText("archiveModeLabel", activeArchiveMode ? "Archiv" : "Aktive Chancen");
  const aspFound = scopedLeads.filter(l => l.contact_person || l.managing_director).length;
  const emailFound = scopedLeads.filter(l => l.final_email || l.findymail_email || l.email).length;
  const aLeads = scopedLeads.filter(l => l.priority === "A").length;
  const avgScore = total > 0 ? Math.round(scopedLeads.reduce((s, l) => s + (l.opportunity_score || 0), 0) / total) : 0;
  const videos = scopedLeads.filter(l => l.video_status === "completed" || l.video_status === "ready" || l.video_url).length;

  setText("statLeads", total);
  setText("statASP", aspFound);
  setText("statEmail", emailFound);

  if (isCompany4RecruitingCompany()) {
    const jobSignals = scopedLeads.filter(l => l.jobs_found === true || getJobsCount(l) > 0).length;
    const outreachActive = scopedLeads.filter(l => isOutreachVisibleStatus(getLeadDisplayStatus(l))).length;
    setText("statALeads", jobSignals);
    setText("statAvgScore", outreachActive);
    setText("statVideos", videos);
    setText("topbarLeads", total);
    setText("topbarALeads", outreachActive);
    return;
  }

  setText("statALeads", aLeads);
  setText("statAvgScore", `${avgScore}%`);
  setText("statVideos", videos);
  setText("topbarLeads", total);
  setText("topbarALeads", aLeads);
}

function isArchivedLead(lead) {
  const archivedStatuses = ["archived", "completed", "done", "closed", "outreach_completed"];
  return archivedStatuses.includes(String(lead?.status || "").toLowerCase()) ||
    archivedStatuses.includes(String(lead?.crm_status || "").toLowerCase());
}

function getArchivePatchForLead(lead, archived = true) {
  return archived ? { status: "archived" } : { status: "new" };
}

async function setLeadArchived(leadId, archived = true) {
  const lead = leads.find(l => Number(l.id) === Number(leadId));
  if (!lead) return;

  const verb = archived ? "archivieren" : "reaktivieren";
  if (!window.confirm(`${lead.lead_name || "Lead"} wirklich ${verb}?`)) return;

  try {
    const update = getArchivePatchForLead(lead, archived);
    const savedLead = await apiRequest(`/leads/${leadId}`, {
      method: "PATCH",
      body: JSON.stringify(update)
    });

    leads = leads.filter(l => Number(l.id) !== Number(leadId));
    selectedAnalysisLeadIds = selectedAnalysisLeadIds.filter(id => Number(id) !== Number(leadId));
    closeDrawer();
    await Promise.all([loadStats(), loadLeads()]);
    addTimelineEntry(leadId, archived ? "Archiviert" : "Reaktiviert", `Lead wurde ${archived ? "ins Archiv verschoben" : "aus dem Archiv zurückgeholt"}.`);
    showToast(archived ? "Lead archiviert." : "Lead reaktiviert.", "success");
  } catch (err) {
    showToast(`Archiv-Aktion fehlgeschlagen: ${err.message}`, "error");
  }
}

function ensureArchiveControls() {
  const opportunitiesView = document.getElementById("opportunitiesView");
  if (!opportunitiesView || document.getElementById("archiveToggleBtn")) return;

  const target = opportunitiesView.querySelector(".card-sub") || opportunitiesView.querySelector(".card") || opportunitiesView.firstElementChild;
  if (!target) return;

  const wrapper = document.createElement("div");
  wrapper.id = "archiveControls";
  wrapper.style.cssText = "display:flex;gap:8px;align-items:center;justify-content:flex-end;margin:8px 0 12px;";
  wrapper.innerHTML = `
    <span id="archiveModeLabel" class="badge badge-new">Aktive Chancen</span>
    <button id="archiveToggleBtn" class="btn btn-ghost btn-sm" type="button">
      Archiv anzeigen <span id="archiveCount"></span>
    </button>
  `;

  target.insertAdjacentElement("afterend", wrapper);
  document.getElementById("archiveToggleBtn")?.addEventListener("click", async () => {
    activeArchiveMode = !activeArchiveMode;
    selectedAnalysisLeadIds = [];
    const btn = document.getElementById("archiveToggleBtn");
    if (btn) btn.textContent = activeArchiveMode ? "Aktive Chancen anzeigen" : "Archiv anzeigen";
    await loadLeads();
    await loadStats();
  });
}

function renderTopLeads() {
  const container = document.getElementById("topLeadsPreview");
  const topLeads = [...getK1ScopedLeads()]
    .sort((a, b) => {
      if (isCompany4RecruitingCompany()) {
        return (getJobsCount(b) - getJobsCount(a)) || (Number(b.id || 0) - Number(a.id || 0));
      }
      return (b.opportunity_score || 0) - (a.opportunity_score || 0);
    })
    .slice(0, 6);

  if (!topLeads.length) {
    container.innerHTML = '<div class="empty-state">Noch keine Leads vorhanden. Starte einen Scan.</div>';
    return;
  }

  if (isCompany4RecruitingCompany()) {
    container.innerHTML = topLeads.map(l => `
      <div class="lead-mini-card" onclick="openDrawer(${l.id})">
        <div class="lmc-name">${esc(l.lead_name)}</div>
        <div class="lmc-meta">${esc(l.region || l.city || "")}</div>
        <div class="lmc-score">${getJobsCount(l)} aktive Stelle${getJobsCount(l) === 1 ? "" : "n"}</div>
        <div class="lmc-badges">
          ${statusBadge(getLeadDisplayStatus(l))}
          ${l.channel ? `<span class="badge badge-new" style="font-size:10px">${esc(formatCampaignChannelLabel(l.channel))}</span>` : ""}
          ${getLeadVideoUrl(l) ? '<span class="badge badge-video" style="font-size:10px">Video</span>' : ""}
        </div>
      </div>
    `).join("");
    return;
  }

  container.innerHTML = topLeads.map(l => `
    <div class="lead-mini-card" onclick="openDrawer(${l.id})">
      <div class="lmc-name">${esc(l.lead_name)}</div>
      <div class="lmc-meta">${esc(l.city || "")}${l.industry ? ` · ${esc(l.industry)}` : ""}</div>
      <div class="lmc-score">${l.opportunity_score || 0}% Sales Potential</div>
      <div class="lmc-badges">
        ${priorityBadge(l.priority)}
        ${l.ads_found === false ? '<span class="badge badge-new" style="font-size:10px">Keine Ads</span>' : ""}
        ${l.video_status === "completed" ? '<span class="badge badge-video" style="font-size:10px">Video ✓</span>' : ""}
      </div>
    </div>
  `).join("");
}

function renderScans() {
  const container = document.getElementById("allScansTable");
  if (!scans.length) {
    container.innerHTML = '<div class="empty-state">Noch keine Scans.</div>';
    return;
  }
  container.innerHTML = scans.map(s => scanItemHTML(s)).join("");
}

function renderRecentScans() {
  const container = document.getElementById("recentScans");
  const recent = scans.slice(0, 5);
  if (!recent.length) {
    container.innerHTML = '<div class="empty-state">Noch keine Scans vorhanden.</div>';
    return;
  }
  container.innerHTML = recent.map(s => scanItemHTML(s)).join("");
}

function scanItemHTML(s) {
  return `
    <div class="scan-item">
      <div class="scan-item-info">
        <div class="scan-item-name">Scan #${s.id} – ${esc(s.industry || "")}</div>
        <div class="scan-item-meta">${esc(s.region || "")} · ${s.total_inserted || 0} Leads · ${formatDate(s.created_at)}</div>
      </div>
      <span class="scan-badge ${s.status}">${s.status}</span>
    </div>
  `;
}


// ─────────────────────────────────────────────────────────────
// SELECTED ANALYSIS – Lead-Auswahl für WF02
// ─────────────────────────────────────────────────────────────
function canUseSelectedAnalysis() {
  return getSelectedAnalysisPolicy().enabled === true;
}

function getCreditsRemaining() {
  if (!companyData) return 0;
  if (companyData.credits_remaining !== undefined && companyData.credits_remaining !== null) {
    return Number(companyData.credits_remaining) || 0;
  }
  return (Number(companyData.credits_total) || 0) - (Number(companyData.credits_used) || 0);
}

function getSelectedAnalysisSplit(count, policy = getSelectedAnalysisPolicy()) {
  if (policy.key !== "company4_recruiting") {
    return { videoCount: count, emailOnlyCount: 0, creditsRequired: count };
  }

  const videoCount = Math.min(count, policy.videoLimit || 250);
  const emailOnlyCount = Math.min(Math.max(0, count - videoCount), policy.emailOnlyLimit || 500);
  return { videoCount, emailOnlyCount, creditsRequired: videoCount };
}

function isLeadSelectable(lead) {
  if (!lead) return false;

  const policy = getSelectedAnalysisPolicy();
  if (!policy.enabled) return false;

  if (policy.requiresCallApproval) {
    return (
      lead.call_approved === true &&
      !!(lead.email || lead.final_email || lead.findymail_email) &&
      policy.allowedStatuses.includes(lead.status || "new")
    );
  }

  // Brand4Social: kein Call-Approval-Gate; nur noch nicht analysierte Leads auswählbar.
  return policy.allowedStatuses.includes(lead.status || "new");
}

function toggleAnalysisLead(leadId) {
  const id = Number(leadId);
  const lead = leads.find(l => Number(l.id) === id);
  if (!isLeadSelectable(lead)) return;

  if (selectedAnalysisLeadIds.includes(id)) {
    selectedAnalysisLeadIds = selectedAnalysisLeadIds.filter(x => x !== id);
  } else {
    const maxLeads = getSelectedAnalysisPolicy().maxLeads;
    if (selectedAnalysisLeadIds.length >= maxLeads) {
      showToast(`Bitte maximal ${maxLeads} Leads pro Analyse-Run auswählen.`, "error");
      return;
    }
    selectedAnalysisLeadIds = [...new Set([...selectedAnalysisLeadIds, id])];
  }

  renderLeadTable();
  renderK1CampaignCockpit();
}

function toggleAllVisibleAnalysisLeads() {
  const visible = filterLeads().filter(isLeadSelectable);
  const ids = visible.map(l => Number(l.id));
  if (!ids.length) return;

  const allSelected = ids.every(id => selectedAnalysisLeadIds.includes(id));
  if (allSelected) {
    selectedAnalysisLeadIds = selectedAnalysisLeadIds.filter(id => !ids.includes(id));
  } else {
    const maxLeads = getSelectedAnalysisPolicy().maxLeads;
    const remainingSlots = Math.max(0, maxLeads - selectedAnalysisLeadIds.length);
    const unselectedIds = ids.filter(id => !selectedAnalysisLeadIds.includes(id));
    const newIds = unselectedIds.slice(0, remainingSlots);

    selectedAnalysisLeadIds = [...new Set([...selectedAnalysisLeadIds, ...newIds])];

    if (newIds.length < unselectedIds.length) {
      showToast(`Es können maximal ${maxLeads} Leads pro Lauf ausgewählt werden.`, "error");
    }
  }

  renderLeadTable();
  renderK1CampaignCockpit();
}

function renderSelectedAnalysisToolbar() {
  const toolbar = document.getElementById("selectedAnalysisToolbar");
  const countEl = document.getElementById("selectedAnalysisCount");
  const creditEl = document.getElementById("selectedAnalysisCredits");
  const warningEl = document.getElementById("selectedAnalysisWarning");
  const btn = document.getElementById("startSelectedAnalysisBtn");
  const selectAllBox = document.getElementById("selectAllLeadsCheckbox");
  const selectHeader = document.getElementById("selectedAnalysisHeaderCell");

  const enabled = canUseSelectedAnalysis();
  const policy = getSelectedAnalysisPolicy();
  const remaining = getCreditsRemaining();
  const selectedCount = selectedAnalysisLeadIds.length;
  const hasEnoughCredits = selectedCount <= remaining;
  const visibleSelectable = filterLeads().filter(isLeadSelectable).map(l => Number(l.id));
  const allVisibleSelected = visibleSelectable.length > 0 && visibleSelectable.every(id => selectedAnalysisLeadIds.includes(id));
  const someVisibleSelected = visibleSelectable.some(id => selectedAnalysisLeadIds.includes(id));

  if (toolbar) toolbar.classList.toggle("hidden", !enabled);
  if (selectHeader) selectHeader.classList.toggle("hidden", !enabled || activeArchiveMode);
  if (countEl) countEl.textContent = selectedCount;
  const split = getSelectedAnalysisSplit(selectedCount, policy);
  const creditsRequired = split.creditsRequired;
  const hasEnoughCampaignCredits = creditsRequired <= remaining;

  if (creditEl) {
    creditEl.textContent = policy.key === "company4_recruiting"
      ? `${split.videoCount} Video-Credits · ${split.emailOnlyCount} E-Mail-only`
      : `${selectedCount} Credit${selectedCount === 1 ? "" : "s"}`;
  }
  if (warningEl) {
    warningEl.textContent = hasEnoughCampaignCredits ? "" : `Nicht genug Credits verfügbar (${remaining} übrig, benötigt: ${creditsRequired}).`;
    warningEl.classList.toggle("hidden", hasEnoughCampaignCredits);
  }
  if (btn) {
    btn.disabled = !enabled || selectedCount === 0 || !hasEnoughCampaignCredits || isStartingSelectedAnalysis;
    btn.textContent = isStartingSelectedAnalysis
      ? (policy.key === "company4_recruiting" ? "Kampagne startet…" : "Analyse startet…")
      : selectedCount > 0
        ? (policy.key === "company4_recruiting" ? `${selectedCount} Leads in Kampagne starten` : `${selectedCount} Leads analysieren`)
        : (policy.key === "company4_recruiting" ? "Kampagne starten" : "Ausgewählte Leads analysieren");
  }
  if (selectAllBox) {
    selectAllBox.checked = allVisibleSelected;
    selectAllBox.indeterminate = !allVisibleSelected && someVisibleSelected;
    selectAllBox.disabled = !enabled || visibleSelectable.length === 0;
  }
}

function isGenericMailbox(email) {
  const local = String(email || "").toLowerCase().split("@")[0] || "";
  return [
    "info", "kontakt", "office", "mail", "hello", "hallo", "support", "service",
    "team", "admin", "sales", "marketing", "bewerbung", "jobs", "karriere",
    "buchhaltung", "rechnung", "anfrage", "projekte", "datenschutz"
  ].includes(local);
}

function getK1LeadQuality(lead) {
  const email = getLeadEmail(lead);
  const hasWebsite = !!(lead.website || lead.website_url || lead._website_url);
  const hasContact = getLeadContactPerson(lead) !== "–" && getLeadContactPerson(lead) !== "â€“";
  const hasPhone = !!String(lead.phone || "").trim();
  const hasIndustry = !!String(lead.industry || "").trim();
  const hasCity = !!String(lead.city || "").trim();
  const hasPersonalEmail = !!email && !isGenericMailbox(email);
  const hasImpressum = !!(lead.imprint_url || lead.impressum_source_url || lead.imp_url);
  const hasPersonalization = !!(lead.sales_hook || lead.final_sales_hook || lead.personalization_summary || lead.marketing_analysis);

  const checks = [
    hasWebsite,
    !!email,
    hasPersonalEmail,
    hasContact,
    hasPhone,
    hasIndustry,
    hasCity,
    hasImpressum,
    hasPersonalization
  ];

  const issues = [];
  if (!hasWebsite) issues.push("Website fehlt");
  if (!email) issues.push("E-Mail fehlt");
  if (email && !hasPersonalEmail) issues.push("Nur generische E-Mail");
  if (!hasContact) issues.push("Ansprechpartner fehlt");
  if (!hasIndustry) issues.push("Branche fehlt");
  if (!hasImpressum) issues.push("Impressum nicht bestätigt");
  if (!hasPersonalization) issues.push("Personalisierung fehlt");
  if (String(lead.status || "").toLowerCase() === "no_interest" || String(lead.crm_status || "").toLowerCase() === "no_interest") issues.push("Kein Interesse");

  return {
    score: Math.round((checks.filter(Boolean).length / checks.length) * 100),
    issues,
    hasPersonalEmail,
    email,
    sourceCount: [hasWebsite, hasImpressum, hasIndustry, hasCity, hasPhone].filter(Boolean).length
  };
}

function k1InsightCard(label, value, sub = "") {
  return `
    <div class="k1-insight-card">
      <span class="k1-insight-label">${esc(label)}</span>
      <span class="k1-insight-value">${esc(value)}</span>
      ${sub ? `<div class="k1-insight-sub">${esc(sub)}</div>` : ""}
    </div>
  `;
}

function getK1LeadListKey(lead) {
  return String(lead?.source_pipeline || "kopietz_hubspot_csv_import").trim() || "kopietz_hubspot_csv_import";
}

function formatK1LeadListLabel(key) {
  const raw = String(key || "kopietz_hubspot_csv_import").trim();
  if (raw === "kopietz_hubspot_csv_import") return "Import 1 - HubSpot CSV";
  return raw
    .replace(/^k1_import_/, "")
    .replace(/^kopietz_/, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase()) || raw;
}

function getK1SelectedLeadListKey() {
  return activeK1LeadListKey || document.getElementById("k1LeadListFilter")?.value || "";
}

function getK1ScopedLeads() {
  if (!isKopietzCompany() || !activeK1LeadListKey) return leads;
  return leads.filter(lead => getK1LeadListKey(lead) === activeK1LeadListKey);
}

function renderK1LeadListFilter() {
  const select = document.getElementById("k1LeadListFilter");
  if (!select) return;
  if (!isKopietzCompany()) {
    select.classList.add("hidden");
    return;
  }

  const previous = select.value;
  const groups = new Map();
  leads.forEach(lead => {
    const key = getK1LeadListKey(lead);
    groups.set(key, (groups.get(key) || 0) + 1);
  });

  const options = [...groups.entries()]
    .sort((a, b) => {
      if (a[0] === "kopietz_hubspot_csv_import") return -1;
      if (b[0] === "kopietz_hubspot_csv_import") return 1;
      return formatK1LeadListLabel(a[0]).localeCompare(formatK1LeadListLabel(b[0]), "de");
    })
    .map(([key, count]) => `<option value="${esc(key)}">${esc(formatK1LeadListLabel(key))} (${count})</option>`)
    .join("");

  select.innerHTML = `<option value="">Alle Lead-Listen (${leads.length})</option>${options}`;
  select.value = groups.has(previous) ? previous : "";
  activeK1LeadListKey = select.value;
  select.classList.remove("hidden");
}

function renderK1DataQuality() {
  if (!isKopietzCompany()) return;
  const summary = document.getElementById("k1QualitySummary");
  const issuesEl = document.getElementById("k1QualityIssues");
  const leadList = document.getElementById("k1QualityLeadList");
  if (!summary || !issuesEl || !leadList) return;

  const scopedLeads = getK1ScopedLeads();
  const quality = scopedLeads.map(lead => ({ lead, quality: getK1LeadQuality(lead) }));
  const total = quality.length;
  const avg = total ? Math.round(quality.reduce((sum, item) => sum + item.quality.score, 0) / total) : 0;
  const personal = quality.filter(item => item.quality.hasPersonalEmail).length;
  const generic = quality.filter(item => item.quality.email && !item.quality.hasPersonalEmail).length;
  const ready = quality.filter(item => item.quality.score >= 70 && item.quality.email).length;

  summary.innerHTML = [
    k1InsightCard("Datenqualität", `${avg}%`, "Durchschnitt über aktive Leads"),
    k1InsightCard("Versandbereit", ready, "Score ab 70% und E-Mail vorhanden"),
    k1InsightCard("Persönliche E-Mails", personal, `${generic} generische Postfächer`),
    k1InsightCard("Handlungsbedarf", quality.filter(item => item.quality.issues.length).length, "Mindestens ein Datenproblem")
  ].join("");

  const issueCounts = new Map();
  quality.forEach(item => item.quality.issues.forEach(issue => issueCounts.set(issue, (issueCounts.get(issue) || 0) + 1)));
  const issueRows = [...issueCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  issuesEl.innerHTML = issueRows.length
    ? issueRows.map(([issue, count]) => `
      <div class="k1-insight-row">
        <div><strong>${esc(issue)}</strong><p>${Math.round((count / Math.max(total, 1)) * 100)}% der Leads betroffen</p></div>
        <div class="metric">${count}</div>
      </div>
    `).join("")
    : '<div class="empty-state">Keine Datenprobleme erkannt.</div>';

  leadList.innerHTML = quality
    .filter(item => item.quality.issues.length)
    .sort((a, b) => a.quality.score - b.quality.score)
    .slice(0, 12)
    .map(({ lead, quality }) => `
      <div class="k1-insight-row" onclick="openDrawer(${lead.id})">
        <div><strong>${esc(lead.lead_name || "Unbenannter Lead")}</strong><p>${esc(quality.issues.slice(0, 3).join(" · "))}</p></div>
        <div class="metric">${quality.score}%</div>
      </div>
    `).join("") || '<div class="empty-state">Alle sichtbaren Leads sind solide gepflegt.</div>';
}

function getK1CampaignKey(lead) {
  return lead.analysis_batch_id || lead.campaign_name || lead.instantly_campaign_id || lead.source_pipeline || "Noch keiner Kampagne zugeordnet";
}

function renderK1CampaignCockpit() {
  if (!isKopietzCompany()) return;
  const summary = document.getElementById("k1CampaignSummary");
  const list = document.getElementById("k1CampaignList");
  if (!summary || !list) return;

  const selectedCount = selectedAnalysisLeadIds.length;
  const scopedLeads = getK1ScopedLeads();
  const sent = scopedLeads.filter(l => l.outreach_sent_at || isOutreachVisibleStatus(getLeadDisplayStatus(l))).length;
  const opened = scopedLeads.filter(l => ["email_opened", "email_clicked", "replied"].includes(getLeadDisplayStatus(l)) || Number(l.pitchlane_video_view_count || 0) > 0).length;
  const replies = scopedLeads.filter(l => getLeadDisplayStatus(l) === "replied").length;
  const startBtn = document.getElementById("k1StartCampaignBtn");
  if (startBtn) {
    startBtn.disabled = selectedCount === 0 || isStartingSelectedAnalysis;
    startBtn.textContent = selectedCount ? `${selectedCount} Leads analysieren` : "Leads unter Chancen auswaehlen";
  }
  summary.innerHTML = [
    k1InsightCard("Ausgewählt", selectedCount, "Leads für den nächsten WF02 Lauf"),
    k1InsightCard("Gesendet", sent, "Instantly/Outreach dokumentiert"),
    k1InsightCard("Engagement", opened, "Mail oder Video geöffnet"),
    k1InsightCard("Antworten", replies, "Antwortstatus im Monitoring")
  ].join("");

  const groups = new Map();
  scopedLeads.forEach(lead => {
    const key = getK1CampaignKey(lead);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(lead);
  });

  list.innerHTML = [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 12)
    .map(([key, group]) => {
      const groupSent = group.filter(l => l.outreach_sent_at || isOutreachVisibleStatus(getLeadDisplayStatus(l))).length;
      const groupHot = group.filter(l => Number(l.pitchlane_video_finish_count || 0) > 0 || l.pitchlane_hot_lead === true || getLeadDisplayStatus(l) === "replied").length;
      return `
        <div class="k1-insight-row">
          <div><strong>${esc(key)}</strong><p>${groupSent} gesendet · ${groupHot} Hot/Antwort · Ø ${avgScore(group)}% Potential</p></div>
          <div class="metric">${group.length}</div>
        </div>
      `;
    }).join("") || '<div class="empty-state">Noch keine Kampagnenläufe sichtbar.</div>';
}

function avgScore(items) {
  return items.length ? Math.round(items.reduce((sum, lead) => sum + Number(lead.opportunity_score || 0), 0) / items.length) : 0;
}

function renderK1IcpLearning() {
  if (!isKopietzCompany()) return;
  const summary = document.getElementById("k1IcpSummary");
  const segments = document.getElementById("k1IcpSegments");
  const signals = document.getElementById("k1IcpSignals");
  if (!summary || !segments || !signals) return;

  const groups = new Map();
  const scopedLeads = getK1ScopedLeads();
  scopedLeads.forEach(lead => {
    const key = [lead.industry || "Unbekannte Branche", lead.region || lead.city || "Unbekannte Region"].join(" · ");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(lead);
  });

  const ranked = [...groups.entries()]
    .map(([key, group]) => {
      const engagement = group.filter(l => ["email_opened", "email_clicked", "replied"].includes(getLeadDisplayStatus(l)) || Number(l.pitchlane_video_view_count || 0) > 0).length;
      const personalEmailRate = Math.round((group.filter(l => !isGenericMailbox(getLeadEmail(l)) && getLeadEmail(l)).length / Math.max(group.length, 1)) * 100);
      return { key, group, engagement, personalEmailRate, score: avgScore(group) + engagement * 8 + personalEmailRate / 5 };
    })
    .sort((a, b) => b.score - a.score);

  const highPotential = scopedLeads.filter(l => Number(l.opportunity_score || 0) >= 70).length;
  const hot = scopedLeads.filter(l => getLeadDisplayStatus(l) === "replied" || Number(l.pitchlane_video_finish_count || 0) > 0 || l.pitchlane_hot_lead === true).length;
  summary.innerHTML = [
    k1InsightCard("Segmente", groups.size, "Branche + Region"),
    k1InsightCard("Hohe Chancen", highPotential, "Score ab 70%"),
    k1InsightCard("Hot Signals", hot, "Antwort oder starkes Video-Signal"),
    k1InsightCard("Top ICP Score", ranked[0] ? Math.round(ranked[0].score) : 0, ranked[0]?.key || "Noch kein Segment")
  ].join("");

  segments.innerHTML = ranked.slice(0, 10).map(item => `
    <div class="k1-insight-row">
      <div><strong>${esc(item.key)}</strong><p>${item.engagement} Engagement · ${item.personalEmailRate}% persönliche E-Mails · Ø ${avgScore(item.group)}%</p></div>
      <div class="metric">${item.group.length}</div>
    </div>
  `).join("") || '<div class="empty-state">Noch nicht genug Daten für ICP-Lernen.</div>';

  const signalRows = [
    ["Persönliche Entscheider-Mail", scopedLeads.filter(l => getLeadEmail(l) && !isGenericMailbox(getLeadEmail(l))).length],
    ["Generische Mailbox, trotzdem nutzbar", scopedLeads.filter(l => getLeadEmail(l) && isGenericMailbox(getLeadEmail(l))).length],
    ["Video geöffnet", scopedLeads.filter(l => Number(l.pitchlane_video_view_count || 0) > 0).length],
    ["Video vollständig gesehen", scopedLeads.filter(l => Number(l.pitchlane_video_finish_count || 0) > 0).length],
    ["Antwort erhalten", scopedLeads.filter(l => getLeadDisplayStatus(l) === "replied").length],
    ["Kein Interesse", scopedLeads.filter(l => String(l.crm_status || l.status || "").toLowerCase() === "no_interest").length]
  ];
  signals.innerHTML = signalRows.map(([label, count]) => `
    <div class="k1-insight-row">
      <div><strong>${esc(label)}</strong><p>${Math.round((count / Math.max(scopedLeads.length, 1)) * 100)}% der Leads</p></div>
      <div class="metric">${count}</div>
    </div>
  `).join("");
}

function renderK1PersonalizationPanel(lead) {
  const panel = document.getElementById("k1PersonalizationPanel");
  const target = document.getElementById("k1PersonalizationQuality");
  if (!panel || !target) return;
  const show = isKopietzCompany();
  panel.classList.toggle("hidden", !show);
  if (!show || !lead) return;

  const quality = getK1LeadQuality(lead);
  const confidence = String(lead.personalization_confidence || lead.ai_analysis_status || "").toLowerCase();
  const sources = [];
  if (lead.website || lead.website_url) sources.push("Website");
  if (lead.imprint_url || lead.impressum_source_url) sources.push("Impressum");
  if (lead.industry) sources.push("Branche");
  if (lead.city || lead.region) sources.push("Region");
  if (lead.imprint_meta_title || lead.imprint_meta_description) sources.push("Meta-Daten");
  if (lead.audit_summary || lead.notes) sources.push("HubSpot-Kontext");

  const emailLabel = !quality.email
    ? "Keine E-Mail"
    : quality.hasPersonalEmail
      ? "Persönliche E-Mail"
      : "Generische E-Mail";
  const confidenceLabel = confidence === "high" ? "hoch" : confidence === "medium" ? "mittel" : confidence === "low" ? "niedrig" : "nicht bewertet";

  target.innerHTML = `
    <div class="k1-quality-score">
      <div>
        <span class="k1-insight-label">Personalisierungsqualität</span>
        <strong>${quality.score}% · ${esc(confidenceLabel)}</strong>
        <p class="k1-insight-sub">${esc(emailLabel)} · ${sources.length} belegbare Quellen</p>
      </div>
      <div class="metric">${quality.hasPersonalEmail ? "Entscheider-Mail möglich" : "Automatischer Versand ok"}</div>
    </div>
    <div class="k1-quality-tags">
      ${sources.map(source => `<span class="k1-quality-tag">${esc(source)}</span>`).join("") || '<span class="k1-quality-tag">Keine Quellen</span>'}
      ${quality.issues.slice(0, 5).map(issue => `<span class="k1-quality-tag">${esc(issue)}</span>`).join("")}
    </div>
  `;
}

let k1SelectedCsvFile = null;

async function importK1CsvContacts() {
  if (!isKopietzCompany()) return;
  const file = k1SelectedCsvFile || document.getElementById("k1CsvFileInput")?.files?.[0];
  const statusEl = document.getElementById("k1UploadStatus");
  const button = document.getElementById("k1ImportCsvBtn");
  if (!file) {
    showToast("Bitte zuerst eine CSV-Datei auswählen.", "error");
    return;
  }
  if (button) button.disabled = true;
  if (statusEl) statusEl.textContent = "Datei wird gelesen und importiert...";
  try {
    const csv = await file.text();
    const listName = (document.getElementById("k1ImportListNameInput")?.value || file.name || "HubSpot CSV Import").trim();
    const result = await apiRequest("/contacts/import", {
      method: "POST",
      body: JSON.stringify({
        filename: file.name,
        list_name: listName,
        csv
      })
    });
    const inserted = Number(result.inserted || 0);
    const updated = Number(result.updated || 0);
    const valid = Number(result.valid_contacts || result.valid_count || 0);
    if (statusEl) statusEl.textContent = `Import abgeschlossen: ${inserted} neu, ${updated} aktualisiert, ${valid} gültig.`;
    showToast("CSV-Kontakte wurden importiert.", "success");
    addActivity("CSV importiert", `${inserted} neue und ${updated} aktualisierte Kontakte für ${listName}.`);
    await Promise.all([loadStats(), loadLeads()]);
  } catch (error) {
    if (statusEl) statusEl.textContent = `Import fehlgeschlagen: ${error.message}`;
    showToast(`CSV-Import fehlgeschlagen: ${error.message}`, "error");
  } finally {
    if (button) button.disabled = !k1SelectedCsvFile;
  }
}

function syncK1UploadUi() {
  const show = isKopietzCompany();
  document.querySelectorAll(".k1-only").forEach(el => el.classList.toggle("hidden", !show));
  const card = document.getElementById("k1UploadCard");
  if (card) card.classList.toggle("hidden", !show);
}

async function startSelectedAnalysis() {
  if (!selectedAnalysisLeadIds.length) return;

  const policy = getSelectedAnalysisPolicy();
  if (!policy.enabled) {
    showToast("Die Analyse-Auswahl ist für diesen Mandanten nicht aktiviert.", "error");
    return;
  }

  if (selectedAnalysisLeadIds.length > policy.maxLeads) {
    showToast(`Bitte maximal ${policy.maxLeads} Leads pro Analyse-Run auswählen.`, "error");
    return;
  }

  const remaining = getCreditsRemaining();
  const split = getSelectedAnalysisSplit(selectedAnalysisLeadIds.length, policy);
  if (split.creditsRequired > remaining) {
    showToast(`Nicht genug Credits verfügbar. Übrig: ${remaining}, benötigt: ${split.creditsRequired}`, "error");
    return;
  }

  const confirmText = isCompany4RecruitingCompany()
    ? `Die ersten ${split.videoCount} Leads gehen mit Video in die Kampagne, weitere ${split.emailOnlyCount} ohne Video. Es werden nur Video-Credits verbraucht.`
    : usesAdvancedManufacturingScan()
      ? "Die Leads werden vollständig analysiert und an Pitchlane + Instantly übergeben."
      : "Die Leads werden angereichert, analysiert, mit Pitchlane vorbereitet und an Instantly übergeben.";
  const confirmed = window.confirm(
    isCompany4RecruitingCompany()
      ? `${selectedAnalysisLeadIds.length} Leads in Kampagne starten?\n\nCredits: ${split.creditsRequired}\n${confirmText}`
      : `${selectedAnalysisLeadIds.length} Leads analysieren?\n\nEs werden ${selectedAnalysisLeadIds.length} Credits verbraucht.\n${confirmText}`
  );

  if (!confirmed) return;

  isStartingSelectedAnalysis = true;
  renderSelectedAnalysisToolbar();

  try {
    const result = await apiRequest("/analysis/start-selected", {
      method: "POST",
      body: JSON.stringify({
        lead_ids: selectedAnalysisLeadIds,
        requested_by: currentUser?.email || null,
        campaign_name: isKopietzCompany() ? (document.getElementById("k1CampaignNameInput")?.value || "").trim() : null,
        campaign_segment: isKopietzCompany() ? (document.getElementById("k1CampaignSegmentInput")?.value || "").trim() : null,
        campaign_offer: isKopietzCompany() ? (document.getElementById("k1CampaignOfferInput")?.value || "").trim() : null
      })
    });

    if (isCompany4RecruitingCompany()) {
      showToast(`${result.queued_count || selectedAnalysisLeadIds.length} Leads wurden in die Kampagne gestartet.`, "success");
      addActivity("Kampagne gestartet", `${result.video_count || 0} Video-Leads und ${result.email_only_count || 0} E-Mail-only-Leads wurden an WF02 übergeben.`);
    } else {
      showToast(`${result.queued_count || selectedAnalysisLeadIds.length} Leads wurden zur Analyse gestartet.`, "success");
      addActivity("Analyse gestartet", `${result.queued_count || selectedAnalysisLeadIds.length} ausgewählte Leads wurden an WF02 übergeben.`);
    }
    selectedAnalysisLeadIds = [];
    await loadCompanyData();
    await Promise.all([loadStats(), loadLeads()]);
  } catch (err) {
    console.error("Selected Analysis Fehler:", err);
    showToast(err.message || "Analyse konnte nicht gestartet werden.", "error");
  } finally {
    isStartingSelectedAnalysis = false;
    renderSelectedAnalysisToolbar();
    renderK1CampaignCockpit();
  }
}

function renderLeadTable() {
  const tbody = document.getElementById("leadTableBody");
  let filtered = filterLeads();
  const selectionEnabled = canUseSelectedAnalysis() && !activeArchiveMode;

  renderSelectedAnalysisToolbar();

  if (!filtered.length) {
    const visibleColumns = isRC360Company() ? (selectionEnabled ? 7 : 6) : (selectionEnabled ? 10 : 9);
    tbody.innerHTML = `<tr><td colspan="${visibleColumns}" class="empty-row">Keine Leads gefunden.</td></tr>`;
    return;
  }

  if (isCompany4RecruitingCompany()) {
    tbody.innerHTML = filtered.map(l => renderCompany4LeadRow(l, selectionEnabled)).join("");
    renderSelectedAnalysisToolbar();
    return;
  }

  tbody.innerHTML = filtered.map(l => {
    const email = getLeadEmail(l);
    const contact = getLeadContactPerson(l);
    const score = l.opportunity_score || 0;
    const scoreColor = score >= 70 ? "green" : score >= 45 ? "" : "amber";
    const selectable = selectionEnabled && isLeadSelectable(l);
    const checked = selectedAnalysisLeadIds.includes(Number(l.id));
    const selectionCell = selectionEnabled ? `
        <td class="select-cell" onclick="event.stopPropagation()">
          <input
            type="checkbox"
            class="lead-select-checkbox"
            ${selectable ? "" : "disabled"}
            ${checked ? "checked" : ""}
            onchange="toggleAnalysisLead(${l.id})"
            aria-label="Lead ${esc(l.lead_name)} auswählen"
          />
        </td>` : "";

    return `
      <tr onclick="openDrawer(${l.id})" class="${selectable ? "selectable-lead-row" : ""}">
        ${selectionCell}
        <td>
          <div class="td-name">${esc(l.lead_name)}</div>
          <div class="td-city">${esc(l.city || "")}${l.industry ? ` · ${esc(l.industry)}` : ""}</div>
          ${renderB4SJobsInlineSignal(l)}
        </td>
        <td>
          <div class="td-contact">${esc(contact)}</div>
          <div class="td-email">${email ? `<a href="mailto:${esc(email)}" onclick="event.stopPropagation()">${esc(email)}</a>` : "–"}</div>
        </td>
        ${isRC360Company() ? "" : `
        <td>${scoreCell(l.website_score || l.pagespeed_score || 0, "")}</td>
        <td>${l.instagram_found ? `${l.instagram_followers || 0} Follower` : '<span style="color:var(--muted)">–</span>'}</td>
        <td><span class="ads-badge ${l.ads_found ? "has-ads" : "no-ads"}">${l.ads_found ? "Aktiv" : "Keine Ads"}</span></td>`}
        <td>${scoreCell(score, scoreColor)}</td>
        <td>${statusBadge(getLeadDisplayStatus(l))}</td>
        <td>${priorityBadge(l.priority)}</td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); openDrawer(${l.id})">Öffnen</button>
          <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); setLeadArchived(${l.id}, ${activeArchiveMode ? "false" : "true"})">${activeArchiveMode ? "Zurück" : "Archiv"}</button>
        </td>
      </tr>
    `;
  }).join("");

  renderSelectedAnalysisToolbar();
}

function formatCampaignChannelLabel(value) {
  const map = {
    video: "Video",
    email_only: "E-Mail-only",
    email: "E-Mail"
  };
  return map[value] || value || "Noch nicht gestartet";
}

function extractFirstUrlFromText(value) {
  const match = String(value || "").match(/https?:\/\/[^\s|]+/i);
  return match ? match[0] : null;
}

function getCompany4JobUrl(lead) {
  return lead?.job_url || extractFirstUrlFromText(`${lead?.jobs_notes || ""}\n${lead?.notes || ""}`);
}

function getCompany4Website(lead) {
  return lead?.website || lead?.website_url || (lead?.domain ? `https://${lead.domain}` : "");
}

function cleanCompany4ContactName(value) {
  const raw = String(value || "").replace(/\s+/g, " ").trim();
  if (!raw || raw === "–") return "–";

  const afterColon = raw.includes(":") ? raw.split(":").pop().trim() : raw;
  const cleaned = afterColon
    .replace(/\b(geschäftsführer|geschaeftsfuehrer|geschäftsführender|geschaeftsfuehrender|gesellschafter|inhaber|vertreten durch|ender)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const nameMatch = cleaned.match(/([A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+){1,3})$/);
  return nameMatch ? nameMatch[1].trim() : cleaned || raw;
}

function getCompany4ContactPerson(lead) {
  return cleanCompany4ContactName(
    lead?.contact_person ||
    lead?.managing_director ||
    [lead?.inhaber_vorname, lead?.inhaber_nachname].filter(Boolean).join(" ")
  );
}

function renderCompany4LeadRow(l, selectionEnabled) {
  const email = getLeadEmail(l);
  const contact = getCompany4ContactPerson(l);
  const selectable = selectionEnabled && isLeadSelectable(l);
  const checked = selectedAnalysisLeadIds.includes(Number(l.id));
  const jobTitles = toCleanArray(l.jobs_titles);
  const shownJob = jobTitles[0] || "Stelle aus Jobportal";
  const jobsCount = getJobsCount(l);
  const website = getCompany4Website(l);
  const jobUrl = getCompany4JobUrl(l);
  const location = [l.city, l.region].filter(Boolean).join(" · ") || l.region || "–";
  const selectionCell = selectionEnabled ? `
      <td class="select-cell" onclick="event.stopPropagation()">
        <input
          type="checkbox"
          class="lead-select-checkbox"
          ${selectable ? "" : "disabled"}
          ${checked ? "checked" : ""}
          onchange="toggleAnalysisLead(${l.id})"
          aria-label="Lead ${esc(l.lead_name)} auswählen"
        />
      </td>` : "";

  return `
    <tr onclick="openDrawer(${l.id})" class="${selectable ? "selectable-lead-row" : ""}">
      ${selectionCell}
      <td>
        <div class="td-name">${esc(l.lead_name)}</div>
        <div class="td-city">${esc(l.country_code || l.land || "DE")}</div>
      </td>
      <td>
        <div class="td-contact">${jobsCount ? `${jobsCount} aktive Stelle${jobsCount === 1 ? "" : "n"}` : "Job-Signal"}</div>
        <div class="td-email">${jobUrl ? `<a href="${esc(jobUrl)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">${esc(shownJob)}</a>` : esc(shownJob)}</div>
      </td>
      <td>
        <div class="td-contact">${esc(contact)}</div>
        <div class="td-email">${l.phone ? esc(l.phone) : ""}</div>
      </td>
      <td>${email ? `<a href="mailto:${esc(email)}" onclick="event.stopPropagation()">${esc(email)}</a>` : "–"}</td>
      <td>${website ? `<a href="${esc(website)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">Website</a>` : '<span style="color:var(--muted)">–</span>'}</td>
      <td><span class="badge badge-new">${esc(formatCampaignChannelLabel(l.channel))}</span></td>
      <td>${statusBadge(getLeadDisplayStatus(l))}</td>
      <td><span class="badge badge-C">${esc(location)}</span></td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); openDrawer(${l.id})">Öffnen</button>
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); setLeadArchived(${l.id}, ${activeArchiveMode ? "false" : "true"})">${activeArchiveMode ? "Zurück" : "Archiv"}</button>
      </td>
    </tr>
  `;
}

function filterLeads() {
  const search = document.getElementById("searchInput")?.value?.toLowerCase() || "";
  const priorityVal = document.getElementById("priorityFilter")?.value || "";
  const statusVal = document.getElementById("statusFilter")?.value || "";
  const k1ListVal = isKopietzCompany() ? getK1SelectedLeadListKey() : "";

  return leads.filter(l => {
    const matchSearch = !search ||
      (l.lead_name || "").toLowerCase().includes(search) ||
      (l.contact_person || "").toLowerCase().includes(search) ||
      (l.city || "").toLowerCase().includes(search) ||
      (l.managing_director || "").toLowerCase().includes(search);

    const matchPriority = !priorityVal || l.priority === priorityVal;
    const matchK1List = !k1ListVal || getK1LeadListKey(l) === k1ListVal;
    const displayStatus = getLeadDisplayStatus(l);
    const matchStatus = !statusVal || displayStatus === statusVal || l.status === statusVal || l.outreach_status === statusVal;

    let matchFilter = true;
    if (isCompany4RecruitingCompany()) {
      if (activeQuickFilter === "a-only") matchFilter = ["new", "ready", "enriched", "no_email"].includes(l.status || "new");
      else if (activeQuickFilter === "no-ads") matchFilter = l.jobs_found === true || getJobsCount(l) > 0;
      else if (activeQuickFilter === "email-ready") matchFilter = !!(l.final_email || l.findymail_email || l.email);
      else if (activeQuickFilter === "video-ready") matchFilter = l.video_status === "completed" || l.video_status === "ready" || !!l.video_url;
    } else if (activeQuickFilter === "a-only") matchFilter = l.priority === "A";
    else if (activeQuickFilter === "no-ads") matchFilter = !l.ads_found;
    else if (activeQuickFilter === "email-ready") matchFilter = !!(l.final_email || l.findymail_email || l.email);
    else if (activeQuickFilter === "video-ready") matchFilter = l.video_status === "completed" || l.video_status === "ready" || !!l.video_url;

    return matchSearch && matchPriority && matchStatus && matchK1List && matchFilter;
  });
}

let crmReminderTimer = null;
let activeCrmReminder = null;

function startCrmReminderPolling() {
  if (!usesSharedSalesCrm() || crmReminderTimer) return;
  checkDueCrmReminders();
  crmReminderTimer = window.setInterval(checkDueCrmReminders, 60000);
}

async function checkDueCrmReminders() {
  if (!usesSharedSalesCrm() || activeCrmReminder) return;
  try {
    const reminders = await apiRequest("/leads/reminders/due");
    if (!Array.isArray(reminders) || !reminders.length) return;
    showCrmReminder(reminders[0]);
  } catch (err) {
    console.warn("CRM-Erinnerungen konnten nicht geladen werden:", err);
  }
}

function ensureK1ReminderToastStyles() {
  if (document.getElementById("k1ReminderToastStyles")) return;
  const style = document.createElement("style");
  style.id = "k1ReminderToastStyles";
  style.textContent = `
    .k1-crm-reminder-toast {
      position: fixed;
      right: 24px;
      bottom: 24px;
      z-index: 10020;
      width: min(420px, calc(100vw - 32px));
      padding: 18px;
      border: 1px solid rgba(255, 74, 23, 0.22);
      border-radius: 18px;
      background: rgba(255, 252, 249, 0.96);
      box-shadow: 0 24px 70px rgba(24, 16, 12, 0.22);
      backdrop-filter: blur(14px);
      color: var(--text, #181818);
    }
    .k1-crm-reminder-toast.hidden { display: none; }
    .k1-crm-reminder-toast .eyebrow {
      margin: 0 0 8px;
      color: var(--primary, #ff4a17);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    .k1-crm-reminder-toast h3 {
      margin: 0 0 8px;
      font-size: 22px;
      line-height: 1.15;
    }
    .k1-crm-reminder-toast p {
      margin: 0 0 8px;
      color: var(--muted, #625f5b);
      font-size: 14px;
      line-height: 1.4;
    }
    .k1-crm-reminder-toast .time {
      color: var(--primary, #ff4a17);
      font-weight: 800;
    }
    .k1-crm-reminder-toast .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 14px;
      flex-wrap: wrap;
    }
    .k1-crm-reminder-toast button {
      min-height: 38px;
      border-radius: 10px;
      border: 1px solid rgba(32, 24, 20, 0.12);
      background: #fff;
      padding: 0 14px;
      font-weight: 800;
      cursor: pointer;
    }
    .k1-crm-reminder-toast button.primary {
      border-color: var(--primary, #ff4a17);
      background: var(--primary, #ff4a17);
      color: #fff;
    }
  `;
  document.head.appendChild(style);
}

function ensureK1ReminderToast() {
  ensureK1ReminderToastStyles();
  let toast = document.getElementById("k1CrmReminderToast");
  if (toast) return toast;
  toast = document.createElement("div");
  toast.id = "k1CrmReminderToast";
  toast.className = "k1-crm-reminder-toast hidden";
  toast.innerHTML = `
    <div class="eyebrow">CRM Erinnerung</div>
    <h3>Follow-up ist fällig</h3>
    <p class="company"></p>
    <p class="step"></p>
    <p class="time"></p>
    <div class="actions">
      <button type="button" data-action="snooze">In 15 Min.</button>
      <button type="button" data-action="done">Erledigt</button>
      <button type="button" class="primary" data-action="open">Lead öffnen</button>
    </div>
  `;
  toast.querySelectorAll("button[data-action]").forEach(button => {
    button.addEventListener("click", () => handleCrmReminder(button.dataset.action));
  });
  document.body.appendChild(toast);
  return toast;
}

function showK1CrmReminderToast(reminder) {
  const toast = ensureK1ReminderToast();
  toast.querySelector(".company").textContent = reminder.lead_name || "Unbekannter Lead";
  toast.querySelector(".step").textContent = reminder.next_step || "Follow-up durchführen";
  toast.querySelector(".time").textContent = new Date(reminder.follow_up).toLocaleString("de-DE");
  toast.classList.remove("hidden");
}

function hideK1CrmReminderToast() {
  document.getElementById("k1CrmReminderToast")?.classList.add("hidden");
}

function showCrmReminder(reminder) {
  activeCrmReminder = reminder;
  if (isKopietzCompany()) {
    document.getElementById("crmReminderModal")?.classList.add("hidden");
    showK1CrmReminderToast(reminder);
    return;
  }
  document.getElementById("crmReminderCompany").textContent = reminder.lead_name || "Unbekannter Lead";
  document.getElementById("crmReminderStep").textContent =
    reminder.next_step || "Follow-up durchführen";
  document.getElementById("crmReminderTime").textContent =
    new Date(reminder.follow_up).toLocaleString("de-DE");
  document.getElementById("crmReminderModal").classList.remove("hidden");
}

async function handleCrmReminder(action) {
  if (!activeCrmReminder) return;
  const reminder = activeCrmReminder;
  try {
    await apiRequest(`/leads/${reminder.id}/reminder-ack`, {
      method: "POST",
      body: JSON.stringify({ action })
    });
    document.getElementById("crmReminderModal")?.classList.add("hidden");
    hideK1CrmReminderToast();
    activeCrmReminder = null;
    if (action === "open") openDrawer(reminder.id);
    window.setTimeout(checkDueCrmReminders, 500);
  } catch (err) {
    showToast(`Erinnerung konnte nicht aktualisiert werden: ${err.message}`, "error");
  }
}

let draggedPipelineLeadId = null;

function startPipelineDrag(event, leadId) {
  if (!usesSharedSalesCrm()) return;
  draggedPipelineLeadId = Number(leadId);
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", String(leadId));
}

function allowPipelineDrop(event) {
  if (!usesSharedSalesCrm()) return;
  event.preventDefault();
  event.currentTarget.classList.add("drag-over");
}

function leavePipelineDrop(event) {
  event.currentTarget.classList.remove("drag-over");
}

async function dropLeadToPipeline(event, status) {
  if (!usesSharedSalesCrm()) return;
  event.preventDefault();
  event.currentTarget.classList.remove("drag-over");

  const leadId = Number(event.dataTransfer.getData("text/plain") || draggedPipelineLeadId);
  const lead = leads.find(item => Number(item.id) === leadId);
  if (!lead || getLeadPipelineStatus(lead) === status) return;

  try {
    const manualStatuses = ["analyzed", "meeting", "won", "lost", "existing_customer", "no_interest"];
    const crmPipelineStatuses = usesCompany1Crm()
      ? K1_PIPELINE_CRM_STATUSES
      : manualStatuses;
    const update = status === "no_interest"
      ? { crm_status: "no_interest", status: "no_interest" }
      : crmPipelineStatuses.includes(status)
        ? { crm_status: status }
        : { status };
    const savedLead = await apiRequest(`/leads/${leadId}`, {
      method: "PATCH",
      body: JSON.stringify(update)
    });
    Object.assign(lead, update, savedLead);
    renderAfterLeadMutation(leadId);
    addTimelineEntry(leadId, "Pipeline aktualisiert", `Status: ${formatStatusLabel(status)}`);
    showToast(`Verschoben nach „${formatStatusLabel(status)}“.`, "success");
  } catch (err) {
    showToast(`Pipeline-Status konnte nicht gespeichert werden: ${err.message}`, "error");
  } finally {
    draggedPipelineLeadId = null;
  }
}

function renderPipeline() {
  const board = document.getElementById("pipelineBoard");
  const usesSalesCrm = usesSharedSalesCrm();
  const columns = usesSalesCrm
    ? ["analyzed", "email_sent", "email_opened", "bounced", "video_opened", "meeting", "won", "existing_customer", "no_interest", "lost"]
    : ["new", "qualified", "cold_call", "video_ready", "sent", "meeting", "won"];
  const colLabels = usesSalesCrm
    ? {
        analyzed: "Analysiert",
        email_sent: "Mail gesendet",
        email_opened: "Mail geöffnet",
        bounced: "Bounce",
        video_opened: "Video geöffnet",
        meeting: "Termin",
        won: "Gewonnen",
        existing_customer: "Bereits Kunde",
        no_interest: "Kein Interesse",
        lost: "Verloren"
      }
    : {
        new: "Neu",
        qualified: "Qualifiziert",
        cold_call: "Cold Call",
        video_ready: "Video bereit",
        sent: "Outreach",
        meeting: "Termin",
        won: "Gewonnen"
      };

  const scopedLeads = getK1ScopedLeads();
  board.innerHTML = columns.map(col => {
    const colLeads = scopedLeads.filter(l => getLeadPipelineStatus(l) === col);
    const dropAttributes = usesSalesCrm
      ? `data-pipeline-status="${col}" ondragover="allowPipelineDrop(event)" ondragleave="leavePipelineDrop(event)" ondrop="dropLeadToPipeline(event, '${col}')"`
      : "";
    return `
      <div class="pipeline-col" ${dropAttributes}>
        <div class="pipeline-col-header">
          <span>${colLabels[col]}</span>
          <span class="pipeline-col-count">${colLeads.length}</span>
        </div>
        ${colLeads.map(l => `
          <div class="pipeline-card"
               ${usesSalesCrm ? `draggable="true" ondragstart="startPipelineDrag(event, ${l.id})"` : ""}
               onclick="openDrawer(${l.id})">
            <div class="pipeline-card-name">${esc(l.lead_name)}</div>
            <div class="pipeline-card-meta">${l.opportunity_score || 0}% · ${esc(l.city || "")}</div>
          </div>
        `).join("")}
      </div>
    `;
  }).join("");
}

function renderReports() {
  const scopedLeads = getK1ScopedLeads();
  const total = scopedLeads.length;
  if (!total) return;

  const emailFound = scopedLeads.filter(l => l.final_email || l.findymail_email || l.email).length;
  const aLeads = scopedLeads.filter(l => l.priority === "A").length;
  const noAds = scopedLeads.filter(l => !l.ads_found).length;
  const videos = scopedLeads.filter(l => l.video_status === "completed" || l.video_status === "ready" || l.video_url).length;
  const sent = scopedLeads.filter(l => isOutreachVisibleStatus(getLeadDisplayStatus(l))).length;
  const avgScore = Math.round(scopedLeads.reduce((s, l) => s + (l.opportunity_score || 0), 0) / total);

  document.getElementById("reportSummary").innerHTML = `
    ${reportRow("Analysierte Unternehmen", total)}
    ${reportRow("E-Mail gefunden", emailFound)}
    ${reportRow("A-Chancen", aLeads)}
    ${reportRow("Ø Sales Potential", `${avgScore}%`)}
    ${reportRow("Ohne Meta Ads", noAds)}
    ${reportRow("Videos generiert", videos)}
    ${reportRow("An Outreach übergeben", sent)}
  `;
}

function reportRow(label, value) {
  return `<div class="report-row"><span>${label}</span><strong>${value}</strong></div>`;
}

function renderEngagementSummary(lead) {
  const tags = [];
  const viewCount = Number(lead.pitchlane_video_view_count || 0);
  const startCount = Number(lead.pitchlane_video_start_count || 0);
  const finishCount = Number(lead.pitchlane_video_finish_count || 0);
  const status = getLeadDisplayStatus(lead);

  if (lead.outreach_sent_at || isOutreachVisibleStatus(status)) {
    tags.push(`Mail: ${formatStatusLabel(status)}`);
  }
  if (viewCount > 0) tags.push(`Video geöffnet: ${viewCount}x`);
  if (startCount > 0) tags.push(`Video gestartet: ${startCount}x`);
  if (finishCount > 0) tags.push(`Video vollständig: ${finishCount}x`);
  if (lead.pitchlane_hot_lead) tags.push("Hot Lead");

  if (!tags.length) return "";

  return `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
      ${tags.map(tag => `<span class="tag service">${esc(tag)}</span>`).join("")}
    </div>
  `;
}

function addTimelineEvent(events, title, description, timestamp) {
  if (!timestamp) return;
  events.push({ title, description, created_at: timestamp });
}

function buildLeadTimelineEvents(lead) {
  const events = Array.isArray(lead.timeline) ? [...lead.timeline] : [];
  const status = getLeadDisplayStatus(lead);
  const statusTime = lead.updated_at || lead.outreach_sent_at || lead.created_at;

  addTimelineEvent(
    events,
    "Outreach gestartet",
    "Lead wurde an Instantly übergeben.",
    lead.outreach_sent_at
  );

  if (status === "email_sent" && !lead.outreach_sent_at) {
    addTimelineEvent(events, "Mail gesendet", "Instantly hat die E-Mail gesendet.", statusTime);
  }
  if (status === "email_opened") {
    addTimelineEvent(events, "Mail geöffnet", "Der Kontakt hat die E-Mail geöffnet.", statusTime);
  }
  if (status === "email_clicked") {
    addTimelineEvent(events, "Mail-Link geklickt", "Der Kontakt hat einen Link in der E-Mail geklickt.", statusTime);
  }
  if (status === "replied") {
    addTimelineEvent(events, "Antwort erhalten", "Der Kontakt hat auf die E-Mail geantwortet.", lead.outreach_completed_at || statusTime);
  }
  if (status === "bounced") {
    addTimelineEvent(events, "E-Mail Bounce", "Instantly hat einen Bounce für diese E-Mail gemeldet.", statusTime);
  }
  if (status === "unsubscribed") {
    addTimelineEvent(events, "Abmeldung", "Der Kontakt hat sich abgemeldet oder Opt-out ausgelöst.", statusTime);
  }

  addTimelineEvent(
    events,
    "Video geöffnet",
    `Pitchlane-Video wurde geöffnet${lead.pitchlane_video_view_count ? ` (${lead.pitchlane_video_view_count}x)` : ""}.`,
    lead.pitchlane_first_opened_at || lead.pitchlane_last_opened_at
  );
  addTimelineEvent(
    events,
    "Video gestartet",
    `Pitchlane-Video wurde gestartet${lead.pitchlane_video_start_count ? ` (${lead.pitchlane_video_start_count}x)` : ""}.`,
    lead.pitchlane_first_started_at || lead.pitchlane_last_started_at
  );
  addTimelineEvent(
    events,
    "Video vollständig angesehen",
    `Pitchlane-Video wurde vollständig angesehen${lead.pitchlane_video_finish_count ? ` (${lead.pitchlane_video_finish_count}x)` : ""}.`,
    lead.pitchlane_first_finished_at || lead.pitchlane_last_finished_at
  );

  addTimelineEvent(
    events,
    "Dialfire vorbereitet",
    "Kontakt wurde für einen Dialfire-Anruf bereitgestellt.",
    lead.dialfire_call_requested_at
  );

  if (lead.dialfire_last_called_at) {
    const duration = Number(lead.dialfire_call_duration_seconds || 0);
    const resultLabel = [lead.dialfire_last_status, lead.dialfire_status_detail].filter(Boolean).join(" / ") || "Anruf abgeschlossen";
    addTimelineEvent(
      events,
      "Dialfire-Anruf",
      `${resultLabel}${duration ? ` · ${duration} Sekunden` : ""}${lead.dialfire_agent ? ` · Agent: ${lead.dialfire_agent}` : ""}`,
      lead.dialfire_last_called_at
    );
  }

  return events
    .filter(event => event && (event.created_at || event.timestamp))
    .sort((a, b) => new Date(a.created_at || a.timestamp) - new Date(b.created_at || b.timestamp));
}

// ─────────────────────────────────────────────────────────────
// DRAWER
// ─────────────────────────────────────────────────────────────
function openDrawer(leadId) {
  selectedLeadId = leadId;
  renderDrawer(leadId);
  document.getElementById("detailDrawer").classList.remove("hidden");
  document.getElementById("drawerOverlay").classList.remove("hidden");
  setDrawerTab("overview");
}

function closeDrawer() {
  document.getElementById("detailDrawer").classList.add("hidden");
  document.getElementById("drawerOverlay").classList.add("hidden");
  selectedLeadId = null;
}

function toCleanArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (value === null || value === undefined || value === "") return [];

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
    } catch (_) {}

    return trimmed
      .replace(/^\{|\}$/g, "")
      .split(/[,;|]/)
      .map(x => x.trim().replace(/^"|"$/g, ""))
      .filter(Boolean);
  }

  return [String(value)].filter(Boolean);
}

function formatTagLabel(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, c => c.toUpperCase());
}

function formatChannelLabel(value) {
  const map = { email: "E-Mail", phone: "Telefon", linkedin: "LinkedIn" };
  return map[value] || value || "–";
}

function formatPriorityLabel(value) {
  const map = { A: "A-Lead", B: "B-Lead", C: "C-Lead", high: "High", medium: "Medium", low: "Low" };
  return map[value] || value || "–";
}

function formatStatusLabel(value) {
  const map = {
    new: "Neu",
    hubspot_imported: "Bereit",
    no_email: "Ohne E-Mail",
    processing: isCompany4RecruitingCompany() ? "In Kampagne" : "In Analyse",
    analyzed: "Analysiert",
    analysed: "Analysiert",
    enriched: "Angereichert",
    qualified: "Qualifiziert",
    video_requested: "Video läuft",
    video_ready: "Video bereit",
    outreach_active: "Outreach",
    sent: "Outreach",
    active: "Outreach",
    email_sent: "Mail gesendet",
    email_opened: "Mail geöffnet",
    email_clicked: "Mail geklickt",
    replied: "Antwort erhalten",
    bounced: "Bounce",
    unsubscribed: "Abgemeldet",
    video_opened: "Video geöffnet",
    video_started: "Video gestartet",
    video_finished: "Video vollständig angesehen",
    outreach_completed: "Abgeschlossen",
    no_interest: "Kein Interesse",
    disqualified: "Nicht qualifiziert",
    follow_up: "Follow-up offen",
    meeting: "Termin",
    won: "Gewonnen",
    lost: "Verloren",
    existing_customer: "Bereits Kunde"
  };
  return map[value] || value || "Neu";
}

function escClass(value) {
  return String(value || "default").toLowerCase().replace(/[^a-z0-9_-]/g, "-");
}


// ─────────────────────────────────────────────────────────────
// COMPANY 2 / BRAND4SOCIAL – Recruiting-Signal im Dashboard
// ─────────────────────────────────────────────────────────────
function getJobsCount(lead) {
  const storedCount = Number(lead?.jobs_count || 0);
  const titlesCount = toCleanArray(lead?.jobs_titles).length;
  return Math.max(storedCount, titlesCount);
}

function getJobsSignalMeta(lead) {
  const count = getJobsCount(lead);
  const score = Number(lead?.jobs_score || 0);
  const found = lead?.jobs_found === true || count > 0;

  if (!found) {
    return {
      label: "Kein aktives Signal",
      levelClass: "none",
      description: "Keine aktiven Stellenanzeigen erkannt."
    };
  }

  if (score >= 80 || count >= 5) {
    return {
      label: "Sehr hoch",
      levelClass: "very-high",
      description: "Aktive Personalgewinnung signalisiert Wachstum und starkes Potenzial für Social Recruiting und Employer Branding."
    };
  }

  return {
    label: "Hoch",
    levelClass: "high",
    description: "Offene Stellen sind ein konkreter Ansatzpunkt für Social-Recruiting-Kampagnen."
  };
}

function renderB4SJobsInlineSignal(lead) {
  if (!isBrand4SocialCompany() && !isCompany4RecruitingCompany()) return "";

  const count = getJobsCount(lead);
  if (!(lead?.jobs_found === true || count > 0)) return "";

  return `
    <div class="b4s-table-job-signal" title="${esc(lead.jobs_notes || "Aktive Stellenanzeigen erkannt")}">
      <span class="b4s-table-job-dot"></span>
      ${count} aktive Stelle${count === 1 ? "" : "n"}
    </div>
  `;
}

function removeB4SRecruitingPanels() {
  document.getElementById("b4sRecruitingOverviewCard")?.remove();
  document.getElementById("b4sRecruitingAnalysisCard")?.remove();
}

function insertB4SPanelBeforeAnchor(panel, anchorId) {
  const anchor = document.getElementById(anchorId);
  if (!anchor) return false;

  const reference = anchor.closest(
    ".insight-card, .detail-section, .overview-card, .analysis-section, .content-card, .analysis-box"
  ) || anchor.parentElement;

  if (!reference || !reference.parentNode) return false;
  reference.parentNode.insertBefore(panel, reference);
  return true;
}

function renderB4SRecruitingPanels(lead) {
  removeB4SRecruitingPanels();
  if (!isBrand4SocialCompany()) return;

  const count = getJobsCount(lead);
  const jobTitles = toCleanArray(lead.jobs_titles);
  const hasRecruitingData = lead.jobs_found === true || count > 0 || !!lead.jobs_status;
  if (!hasRecruitingData) return;

  const signal = getJobsSignalMeta(lead);
  const shownTitles = jobTitles.slice(0, 4);
  const remainingCount = Math.max(0, jobTitles.length - shownTitles.length);
  const notes = lead.jobs_notes || signal.description;

  const overviewCard = document.createElement("section");
  overviewCard.id = "b4sRecruitingOverviewCard";
  overviewCard.className = "b4s-recruiting-card b4s-recruiting-overview";
  overviewCard.innerHTML = `
    <div class="b4s-recruiting-head">
      <div>
        <div class="b4s-recruiting-kicker"><span></span>Recruiting-Signal</div>
        <div class="b4s-recruiting-value">${count} aktive Stellenanzeige${count === 1 ? "" : "n"} gefunden</div>
      </div>
      <span class="b4s-recruiting-level ${signal.levelClass}">${esc(signal.label)}</span>
    </div>
    <p class="b4s-recruiting-copy">${esc(signal.description)}</p>
    ${shownTitles.length ? `
      <div class="b4s-job-chips">
        ${shownTitles.map(title => `<span class="b4s-job-chip">${esc(title)}</span>`).join("")}
        ${remainingCount ? `<span class="b4s-job-chip more">+ ${remainingCount} weitere</span>` : ""}
      </div>
    ` : ""}
  `;
  insertB4SPanelBeforeAnchor(overviewCard, "dWeaknessTags");

  const analysisCard = document.createElement("section");
  analysisCard.id = "b4sRecruitingAnalysisCard";
  analysisCard.className = "b4s-recruiting-card b4s-recruiting-analysis";
  analysisCard.innerHTML = `
    <div class="b4s-recruiting-head">
      <div>
        <div class="b4s-recruiting-kicker"><span></span>Stellenanzeigen-Analyse</div>
        <div class="b4s-recruiting-value">${count} Treffer · Score ${Number(lead.jobs_score || 0)} / 100</div>
      </div>
      <span class="b4s-recruiting-level ${signal.levelClass}">${esc(signal.label)}</span>
    </div>
    <p class="b4s-recruiting-copy">${esc(notes)}</p>
    ${jobTitles.length ? `
      <ol class="b4s-job-list">
        ${jobTitles.map(title => `<li>${esc(title)}</li>`).join("")}
      </ol>
    ` : '<div class="b4s-job-empty">Keine konkreten Jobtitel verfügbar.</div>'}
  `;
  insertB4SPanelBeforeAnchor(analysisCard, "dMarketingAnalysis");
}

function renderCompany4JobAnalysisPanel(lead) {
  document.getElementById("c4JobAnalysisPanel")?.remove();
  if (!isCompany4RecruitingCompany()) return;

  const tab = document.getElementById("tab-analyse");
  if (!tab) return;

  const jobTitles = toCleanArray(lead.jobs_titles);
  const jobUrl = getCompany4JobUrl(lead);
  const website = getCompany4Website(lead);
  const contact = getCompany4ContactPerson(lead);
  const email = getLeadEmail(lead);
  const location = [lead.street, lead.postal_code, lead.city].filter(Boolean).join(", ") || lead.region || "–";
  const notes = lead.jobs_notes || lead.notes || "";

  const panel = document.createElement("div");
  panel.id = "c4JobAnalysisPanel";
  panel.className = "detail-section";
  panel.innerHTML = `
    <h4>Stelle aus Jobportal</h4>
    <div class="detail-grid">
      <div class="detail-row"><span class="detail-label">Stellentitel</span><span>${esc(jobTitles[0] || "–")}</span></div>
      <div class="detail-row"><span class="detail-label">Job-Link</span><span>${jobUrl ? `<a href="${esc(jobUrl)}" target="_blank" rel="noopener noreferrer">Anzeige öffnen</a>` : "–"}</span></div>
      <div class="detail-row"><span class="detail-label">Website</span><span>${website ? `<a href="${esc(website)}" target="_blank" rel="noopener noreferrer">${esc(website.replace(/^https?:\/\//, ""))}</a>` : "–"}</span></div>
      <div class="detail-row"><span class="detail-label">Kontakt</span><span>${esc(contact)}</span></div>
      <div class="detail-row"><span class="detail-label">E-Mail</span><span>${email ? `<a href="mailto:${esc(email)}">${esc(email)}</a>` : "–"}</span></div>
      <div class="detail-row"><span class="detail-label">Telefon</span><span>${esc(lead.phone || "–")}</span></div>
      <div class="detail-row"><span class="detail-label">Standort</span><span>${esc(location)}</span></div>
      <div class="detail-row"><span class="detail-label">Job-Signal</span><span>${getJobsCount(lead)} aktive Stelle${getJobsCount(lead) === 1 ? "" : "n"}</span></div>
      <div class="detail-row"><span class="detail-label">Kampagne</span><span>${esc(formatCampaignChannelLabel(lead.channel))}</span></div>
    </div>
    ${notes ? `<div class="analysis-box" style="margin-top:12px;">${esc(notes)}</div>` : ""}
  `;

  tab.prepend(panel);
}

function renderDrawer(leadId) {
  const lead = leads.find(l => Number(l.id) === Number(leadId));
  if (!lead) return;

  const priority = lead.priority || "medium";
  const status = getLeadDisplayStatus(lead);

  // Header – keine verschachtelten Badges, damit das Styling sauber greift
  setText("drawerTitle", lead.lead_name || "–");
  const priorityEl = document.getElementById("drawerPriority");
  if (priorityEl) {
    priorityEl.className = `badge badge-priority badge-${escClass(priority)}`;
    priorityEl.textContent = formatPriorityLabel(priority);
  }
  const statusEl = document.getElementById("drawerStatus");
  if (statusEl) {
    statusEl.className = `badge badge-status badge-status-${escClass(status)}`;
    statusEl.textContent = formatStatusLabel(status);
  }
  const scoreEl = document.getElementById("drawerScore");
  if (scoreEl) {
    scoreEl.className = "badge badge-score";
    scoreEl.textContent = `${Number(lead.opportunity_score || 0)}%`;
  }

  // Overview Tab: telefonisch bestätigbarer Kontakt, vorbefüllt aus dem Impressum
  const callCompanyName = document.getElementById("callCompanyName");
  const callContactPerson = document.getElementById("callContactPerson");
  const callEmail = document.getElementById("callEmail");
  const callPhone = document.getElementById("callPhone");
  const callApproved = document.getElementById("callApproved");
  const callNotes = document.getElementById("callNotes");
  const callApprovalState = document.getElementById("callApprovalState");
  const originalManagingDirector = document.getElementById("originalManagingDirector");
  const company4ContactPerson = isCompany4RecruitingCompany() ? getCompany4ContactPerson(lead) : null;

  if (callCompanyName) callCompanyName.value = lead.lead_name || lead.company_name || "";
  if (callContactPerson) {
    callContactPerson.value = isCompany4RecruitingCompany()
      ? (company4ContactPerson === "–" ? "" : company4ContactPerson)
      : (lead.contact_person || lead.managing_director || "");
  }
  if (callEmail) callEmail.value = getLeadEmail(lead);
  if (callPhone) callPhone.value = lead.phone || "";
  if (callApproved) callApproved.checked = lead.call_approved === true;
  if (callNotes) callNotes.value = lead.call_notes || "";

  const disqualifyState = document.getElementById("disqualifyState");
  if (disqualifyState && (usesCompany1Crm() || isViralityFilmsCompany())) {
    if (lead.status === "no_interest") {
      disqualifyState.classList.remove("hidden");
    } else {
      disqualifyState.classList.add("hidden");
    }
  }

  if (callApprovalState) {
    const approved = lead.call_approved === true;
    callApprovalState.textContent = approved ? "Freigabe erteilt" : "Nicht freigegeben";
    callApprovalState.className = approved ? "call-approval-state approved" : "call-approval-state";
  }

  // VF-spezifische UI-Elemente ein/ausblenden
  const isVFCompany = usesCompany1Crm() || isViralityFilmsCompany();

  // Telefonische Freigabe Box
  const vfSection = document.getElementById("vfCallApprovalSection");
  if (vfSection) vfSection.classList.toggle("hidden", !isVFCompany);
  syncCompany3ResendButton(lead);
  syncDialfireCallButton(lead);

  const callApprovedLabel = document.getElementById("callApprovedLabel");
  const k1CallApprovalHint = document.getElementById("k1CallApprovalHint");
  if (callApprovedLabel) callApprovedLabel.classList.toggle("hidden", usesCompany1Crm());
  if (k1CallApprovalHint) k1CallApprovalHint.classList.toggle("hidden", !usesCompany1Crm());
  if (callApprovalState && usesCompany1Crm()) {
    callApprovalState.textContent = lead.call_notes ? "Dokumentiert" : "Optional";
  }

  // Editierbare Felder (VF/K1) vs. readonly Spans (andere)
  document.querySelectorAll(".vf-show").forEach(el => el.classList.toggle("hidden", !isVFCompany));
  document.querySelectorAll(".vf-hide").forEach(el => el.classList.toggle("hidden", isVFCompany));

  // Readonly Spans immer befüllen (B4S sichtbar, VF versteckt via CSS)
  setText("dAnsp", isCompany4RecruitingCompany() ? company4ContactPerson : getLeadContactPerson(lead));
  setText("dEmail", getLeadEmail(lead) || "–");
  setText("dPhone", lead.phone || "–");

  if (originalManagingDirector) {
    const manuallyAdjusted = !isCompany4RecruitingCompany()
      && lead.managing_director
      && lead.contact_person
      && lead.managing_director !== lead.contact_person;
    if (manuallyAdjusted) {
      originalManagingDirector.textContent = `Im Impressum gefunden: ${lead.managing_director}`;
      originalManagingDirector.classList.remove("hidden");
    } else {
      originalManagingDirector.textContent = "";
      originalManagingDirector.classList.add("hidden");
    }
  }

  setText("dCity", lead.city || "–");
  setText("dIndustry", lead.industry || "–");
  setHTML("dWebsite", lead.website ? `<a href="${esc(lead.website)}" target="_blank" rel="noopener noreferrer">${esc(lead.website)}</a>` : "–");
  setText("dCrmSync", getOutreachSyncLabel(lead));

  const weaknesses = toCleanArray(lead.weakness_tags);
  const weaknessesEl = document.getElementById("dWeaknessTags");
  if (weaknessesEl) {
    weaknessesEl.innerHTML = weaknesses.length
      ? weaknesses.map(t => `<span class="tag tag-weakness">${esc(formatTagLabel(t))}</span>`).join("")
      : '<span class="tag tag-muted">Keine Tags</span>';
  }

  const services = toCleanArray(lead.recommended_services);
  const servicesEl = document.getElementById("dServiceTags");
  if (servicesEl) {
    servicesEl.innerHTML = services.length
      ? services.map(s => `<span class="tag service">${esc(formatTagLabel(s))}</span>`).join("")
      : '<span class="tag tag-muted">Keine Empfehlungen</span>';
  }

  setText("dPitch", lead.final_sales_hook || lead.sales_hook || "–");
  setText("dChannel", formatChannelLabel(lead.recommended_channel || "–"));

  // Nur Brand4Social / Company 2: Recruiting-Signal aus Jobs-Daten darstellen.
  renderB4SRecruitingPanels(lead);
  renderCompany4JobAnalysisPanel(lead);

  // Analyse Tab
  const ws = Number(lead.website_score ?? lead.pagespeed_score ?? lead.mobile_score ?? 0);
  const igs = Number(lead.instagram_score || 0);
  const ads = Number(lead.ads_score || 0);
  const total = Number(lead.opportunity_score || 0);

  document.getElementById("scoreWebsite").style.width = `${ws}%`;
  document.getElementById("scoreWebsiteNum").textContent = `${ws}%`;
  document.getElementById("scoreIG").style.width = `${igs}%`;
  document.getElementById("scoreIGNum").textContent = `${igs}%`;
  document.getElementById("scoreAds").style.width = `${ads}%`;
  document.getElementById("scoreAdsNum").textContent = `${ads}%`;
  document.getElementById("scoreTotal").style.width = `${total}%`;
  document.getElementById("scoreTotalNum").textContent = `${total}%`;

  setText("dAdsStatus", lead.ads_found ? `Aktiv (${lead.ads_active_count || 0} Ads)` : "Keine aktiven Ads");
  setText("dAuditPotential", total >= 70 ? "Hoch" : total >= 45 ? "Mittel" : "Niedrig");
  setText("dPriorityVal", lead.priority || "C");

  const displayVideoUrl = getLeadVideoUrl(lead);
  const videoIsProcessing = isVideoProcessing(lead);
  const engagementHtml = renderEngagementSummary(lead);

  if (displayVideoUrl) {
    document.getElementById("videoContent").innerHTML = `
      <div class="video-embed">
        <iframe
          src="${esc(displayVideoUrl)}"
          title="Personalisiertes Audit Video"
          allow="autoplay; fullscreen; picture-in-picture"
          allowfullscreen
        ></iframe>
      </div>
      ${engagementHtml}
    `;
  } else {
    document.getElementById("videoContent").innerHTML = `
      <div class="video-placeholder">
        <span class="video-badge">Audit Video</span>
        <p class="video-placeholder-title">${videoIsProcessing ? "Video wird gerendert…" : "Video noch nicht verfügbar"}</p>
        <p class="video-placeholder-sub">${videoIsProcessing ? "Bitte warte einige Minuten – die Vorschau erscheint nach Fertigstellung automatisch." : "Für diesen Lead ist aktuell keine abrufbare Video-URL gespeichert."}</p>
      </div>
      ${engagementHtml}
    `;
  }

  setText("dMarketingAnalysis", lead.marketing_analysis || "Noch keine Analyse vorhanden.");
  renderK1PersonalizationPanel(lead);

  // CRM Tab
  configureCrmStatusOptions(lead);
  document.getElementById("crmNotes").value = lead.notes || "";
  document.getElementById("crmOwner").value = lead.owner || lead.crm_owner || "";
  document.getElementById("crmNextStep").value = lead.next_step || lead.crm_next_step || "";
  document.getElementById("crmFollowUp").value = toDatetimeLocalValue(lead.follow_up || lead.crm_follow_up);

  // Timeline
  renderTimeline(lead);

  // Action Output zurücksetzen
  document.getElementById("actionOutput").classList.add("hidden");
}

function renderTimeline(lead) {
  const list = document.getElementById("timelineList");
  const events = buildLeadTimelineEvents(lead);

  if (!events.length) {
    list.innerHTML = '<div class="empty-state">Noch keine Aktivitäten.</div>';
    return;
  }

  list.innerHTML = [...events].reverse().map(e => `
    <div class="timeline-item">
      <div class="timeline-dot"></div>
      <div class="timeline-content">
        <div class="timeline-title">${esc(e.title || "")}</div>
        <div class="timeline-desc">${esc(e.description || "")}</div>
        <div class="timeline-time">${formatDate(e.created_at || e.timestamp)}</div>
      </div>
    </div>
  `).join("");
}

function addTimelineEntry(leadId, title, desc) {
  const lead = leads.find(l => l.id === leadId);
  if (!lead) return;
  if (!lead.timeline) lead.timeline = [];
  lead.timeline.push({ title, description: desc, created_at: new Date().toISOString() });
  if (selectedLeadId === leadId) renderTimeline(lead);
}

function setDrawerTab(tab) {
  document.querySelectorAll(".drawer-tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
  document.querySelectorAll(".tab-panel").forEach(p => {
    const panelId = `tab-${tab}`;
    p.classList.toggle("active", p.id === panelId);
    p.classList.toggle("hidden", p.id !== panelId);
  });
}

// ─────────────────────────────────────────────────────────────
// ACTIVITY FEED
// ─────────────────────────────────────────────────────────────
const activityLog = [];

function addActivity(title, text) {
  activityLog.unshift({ title, text, time: new Date() });
  if (activityLog.length > 20) activityLog.pop();
  renderActivityFeed();
}

function renderActivityFeed() {
  const container = document.getElementById("activityFeed");
  if (!activityLog.length) {
    container.innerHTML = '<div class="empty-state">Noch keine Aktivitäten.</div>';
    return;
  }
  container.innerHTML = activityLog.slice(0, 8).map(a => `
    <div class="activity-item">
      <div class="activity-dot"></div>
      <div>
        <div class="activity-text"><strong>${esc(a.title)}</strong> – ${esc(a.text)}</div>
        <div class="activity-time">${formatTime(a.time)}</div>
      </div>
    </div>
  `).join("");
}

// ─────────────────────────────────────────────────────────────
// UI SETUP
// ─────────────────────────────────────────────────────────────
function setupUI() {
  // User Info
  if (currentUser) {
    const initial = (currentUser.name || currentUser.email || "U")[0].toUpperCase();
    setText("userAvatar", initial);
    setText("userEmail", currentUser.email || "");
  }

  // Eigene Discovery-Zielgruppen und erweiterte Filter nur für Company 1, 3 und 6.
  if (usesImplisenseSerperDiscoveryScan()) {
    injectVFScanFields();
  }
}

function injectVFScanFields() {
  const industryOptions = isKopietzCompany()
    ? [
        "Social Media Agenturen",
        "Webdesign Agenturen",
        "Personaldienstleister",
        "SEO Agenturen",
        "Recruiting-Agenturen"
      ]
    : [
        "Maschinenbau",
        "Automotive / Zulieferer",
        "Metallverarbeitung",
        "Elektrotechnik",
        "Kunststofftechnik",
        "Logistik / Transport",
        "Bauunternehmen",
        "Handwerk / Handwerksbetrieb",
        "Lebensmittelproduktion",
        "Pharmaindustrie",
        "Medizintechnik",
        "IT-Dienstleister",
        "Unternehmensberatung",
        "Immobilien",
        "Einzelhandel"
      ];
  const regionOptions = [
    "Baden-Württemberg",
    "Bayern",
    "Berlin",
    "Brandenburg",
    "Bremen",
    "Hamburg",
    "Hessen",
    "Mecklenburg-Vorpommern",
    "Niedersachsen",
    "Nordrhein-Westfalen",
    "Rheinland-Pfalz",
    "Saarland",
    "Sachsen",
    "Sachsen-Anhalt",
    "Schleswig-Holstein",
    "Thüringen"
  ];
  const minEmployeeOptions = [
    [1, "ab 1"],
    [10, "ab 10"],
    [25, "ab 25"],
    [51, "51+"],
    [101, "101+"],
    [201, "201+"],
    [501, "501+"]
  ];
  const maxEmployeeOptions = [
    [50, "bis 50"],
    [100, "bis 100"],
    [200, "bis 200"],
    [500, "bis 500"],
    [1000, "bis 1.000"],
    [5000, "bis 5.000"],
    [100000, "ohne Obergrenze"]
  ];

  const replaceWithSelect = (id, options, selectedValue) => {
    const current = document.getElementById(id);
    if (!current || current.tagName === "SELECT") return;
    const select = document.createElement("select");
    select.id = id;
    select.className = current.className;
    select.innerHTML = options.map(option => {
      const value = Array.isArray(option) ? option[0] : option;
      const label = Array.isArray(option) ? option[1] : option;
      return `<option value="${esc(value)}">${esc(label)}</option>`;
    }).join("");
    select.value = String(selectedValue);
    current.replaceWith(select);
  };

  const defaultIndustry = isKopietzCompany() ? "Social Media Agenturen" : "Maschinenbau";
  const defaultMinEmployees = isViralityFilmsCompany() ? 51 : 1;
  const defaultMaxEmployees = isViralityFilmsCompany() ? 200 : 100000;

  replaceWithSelect("industryInput", industryOptions, defaultIndustry);
  replaceWithSelect("regionInput", regionOptions, "Bayern");
  replaceWithSelect("vfMinEmpInput", minEmployeeOptions, defaultMinEmployees);
  replaceWithSelect("vfMaxEmpInput", maxEmployeeOptions, defaultMaxEmployees);

  const extRow = document.getElementById("vfScanExtended");
  if (extRow) extRow.classList.remove("hidden");

  const leadLimit = document.getElementById("leadLimitInput");
  if (leadLimit) {
    leadLimit.value = "25";
    leadLimit.min = "1";
    leadLimit.max = "250";
  }

  const industryLabel = document.querySelector("#industryInput")?.closest(".form-group")?.querySelector("label");
  const regionLabel = document.querySelector("#regionInput")?.closest(".form-group")?.querySelector("label");
  const leadLimitLabel = document.querySelector("#leadLimitInput")?.closest(".form-group")?.querySelector("label");
  const minLabel = document.querySelector("#vfMinEmpInput")?.closest(".form-group")?.querySelector("label");
  const maxLabel = document.querySelector("#vfMaxEmpInput")?.closest(".form-group")?.querySelector("label");

  if (industryLabel) industryLabel.textContent = isKopietzCompany() ? "Zielgruppe" : "Branche";
  if (regionLabel) regionLabel.textContent = "Bundesland";
  if (leadLimitLabel) leadLimitLabel.textContent = "Anzahl Leads";
  if (minLabel) minLabel.textContent = "Mitarbeiter (von)";
  if (maxLabel) maxLabel.textContent = "Mitarbeiter (bis)";

  const scanSub = document.querySelector(".scan-card .card-sub");
  if (scanSub) {
    scanSub.textContent = isKopietzCompany()
      ? "Zielgruppe und Bundesland auswählen, optional eine Stadt eingeben und passende Agenturen oder Personaldienstleister finden."
      : "Branche und Bundesland auswählen, optional eine Stadt eingeben und passende Unternehmen finden.";
  }
}

function bindEvents() {
  // Scan
  document.getElementById("startScanBtn")?.addEventListener("click", startScan);
  document.getElementById("refreshScansBtn")?.addEventListener("click", async () => { await loadScans(); showToast("Scans aktualisiert."); });
  document.getElementById("refreshAllScansBtn")?.addEventListener("click", async () => { await loadScans(); });

  // Navigation
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  // Mobile menu
  document.getElementById("menuToggle")?.addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
  });

  // Drawer
  document.getElementById("closeDrawerBtn")?.addEventListener("click", closeDrawer);
  document.getElementById("drawerOverlay")?.addEventListener("click", closeDrawer);

  // Drawer tabs
  document.querySelectorAll(".drawer-tab").forEach(tab => {
    tab.addEventListener("click", () => setDrawerTab(tab.dataset.tab));
  });

  // Filters
  document.getElementById("searchInput")?.addEventListener("input", renderLeadTable);
  document.getElementById("priorityFilter")?.addEventListener("change", renderLeadTable);
  document.getElementById("statusFilter")?.addEventListener("change", renderLeadTable);
  document.getElementById("k1LeadListFilter")?.addEventListener("change", () => {
    activeK1LeadListKey = document.getElementById("k1LeadListFilter")?.value || "";
    selectedAnalysisLeadIds = [];
    renderStatsFromLeads();
    renderTopLeads();
    renderLeadTable();
    renderPipeline();
    renderReports();
    renderK1DataQuality();
    renderK1CampaignCockpit();
    renderK1IcpLearning();
  });

  // Selected analysis
  document.getElementById("selectAllLeadsCheckbox")?.addEventListener("change", toggleAllVisibleAnalysisLeads);
  document.getElementById("startSelectedAnalysisBtn")?.addEventListener("click", startSelectedAnalysis);
  document.getElementById("k1StartCampaignBtn")?.addEventListener("click", startSelectedAnalysis);
  document.getElementById("clearSelectedAnalysisBtn")?.addEventListener("click", () => { selectedAnalysisLeadIds = []; renderLeadTable(); renderK1CampaignCockpit(); });
  document.getElementById("k1ChooseCsvBtn")?.addEventListener("click", () => document.getElementById("k1CsvFileInput")?.click());
  document.getElementById("k1CsvFileInput")?.addEventListener("change", event => {
    k1SelectedCsvFile = event.target.files?.[0] || null;
    const nameEl = document.getElementById("k1UploadFileName");
    const metaEl = document.getElementById("k1UploadMeta");
    const statusEl = document.getElementById("k1UploadStatus");
    const importBtn = document.getElementById("k1ImportCsvBtn");
    if (nameEl) nameEl.textContent = k1SelectedCsvFile ? k1SelectedCsvFile.name : "CSV-Datei auswählen";
    if (metaEl) metaEl.textContent = k1SelectedCsvFile ? `${Math.round(k1SelectedCsvFile.size / 1024)} KB bereit zum Import.` : "Unterstützt HubSpot-Export mit Kontakten, Firmen, Website, Branche und Status.";
    if (statusEl) statusEl.textContent = k1SelectedCsvFile ? "Bereit zum Import." : "Noch keine Datei ausgewählt.";
    if (importBtn) importBtn.disabled = !k1SelectedCsvFile;
  });
  document.getElementById("k1ImportCsvBtn")?.addEventListener("click", importK1CsvContacts);

  // Quick filters
  document.querySelectorAll(".qf-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".qf-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeQuickFilter = btn.dataset.filter;
      renderLeadTable();
    });
  });

  // Telefonische Kontaktfreigabe
  document.getElementById("saveCallApprovalBtn")?.addEventListener("click", () => {
    const id = selectedLeadId;
    if (!id) { console.warn("saveCallApproval: kein selectedLeadId"); return; }
    saveCallApproval(id);
  });

  document.getElementById("disqualifyBtn")?.addEventListener("click", () => {
    const id = selectedLeadId;
    if (!id) return;
    disqualifyLead(id);
  });

  // CRM
  document.getElementById("saveCrmBtn")?.addEventListener("click", () => {
    const id = selectedLeadId;
    if (!id) return;
    saveCrmData(id);
  });

  // Quick Actions
  document.getElementById("genCallHookBtn")?.addEventListener("click", () => {
    const id = selectedLeadId;
    if (!id) return;
    generateCallHook(id);
  });
  document.getElementById("genMailBtn")?.addEventListener("click", () => {
    const id = selectedLeadId;
    if (!id) return;
    generateMailDraft(id);
  });
  document.getElementById("genVideoBtn")?.addEventListener("click", () => {
    const id = selectedLeadId;
    if (!id) return;
    generateVideo(id);
  });
  document.getElementById("sendOutreachBtn")?.addEventListener("click", () => {
    const id = selectedLeadId;
    if (!id) return;
    sendToOutreach(id);
  });

  // Reports
  document.getElementById("downloadReportBtn")?.addEventListener("click", downloadReport);

  // Logout
  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    await auth0Client.logout({ logoutParams: { returnTo: window.location.origin } });
  });
}

function switchView(view) {
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  document.querySelectorAll(".view-section").forEach(s => s.classList.toggle("active", s.id === `${view}View`));

  const titles = {
    dashboard: "Dashboard", opportunities: "Chancen",
    pipeline: "Pipeline", dataQuality: "Datenqualität",
    campaigns: "Kampagnen", icp: "ICP Lernen",
    scans: "Scans", reports: "Reports"
  };
  setText("topbarTitle", titles[view] || "Dashboard");
}

// ─────────────────────────────────────────────────────────────
// LOADER / APP SHELL
// ─────────────────────────────────────────────────────────────
function showLoader(show) {
  document.getElementById("authLoader").style.display = show ? "flex" : "none";
}

function showApp() {
  document.getElementById("appShell").classList.remove("hidden");
}

// ─────────────────────────────────────────────────────────────
// REPORT DOWNLOAD
// ─────────────────────────────────────────────────────────────
function downloadReport() {
  if (!leads.length) { showToast("Keine Daten fuer Report.", "error"); return; }

  const total = leads.length;
  const aLeads = leads.filter(function(l) { return l.priority === "A"; }).length;
  const emailFound = leads.filter(function(l) { return l.findymail_email || l.email; }).length;
  const avgScore = Math.round(leads.reduce(function(s, l) { return s + (l.opportunity_score || 0); }, 0) / total);
  const company = (companyData && companyData.company_name) ? companyData.company_name : "Agentur";
  const dateStr = new Date().toLocaleDateString("de-DE");

  const parts = [
    "<!DOCTYPE html><html><head>",
    "<meta charset='UTF-8'>",
    "<title>Report - " + company + "</title>",
    "<style>body{font-family:system-ui,sans-serif;padding:40px;color:#111}",
    "h1{color:#ff5c00}.card{border:1px solid #eee;border-radius:10px;padding:16px;margin-bottom:12px}",
    "strong{font-weight:700}</style></head><body>",
    "<h1>" + company + " - Management Report</h1>",
    "<p style='color:#888'>" + dateStr + "</p>",
    "<div class='card'><strong>Analysierte Leads:</strong> " + total + "</div>",
    "<div class='card'><strong>A-Chancen:</strong> " + aLeads + "</div>",
    "<div class='card'><strong>E-Mail gefunden:</strong> " + emailFound + "</div>",
    "<div class='card'><strong>Sales Potential:</strong> " + avgScore + "%</div>",
    "</body></html>"
  ];
  const html = parts.join("");

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `report-${Date.now()}.html`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(text, type = "") {
  const toast = document.getElementById("toast");
  const toastText = document.getElementById("toastText");
  toastText.textContent = text;
  toast.className = `toast${type ? " " + type : ""}`;
  toast.classList.remove("hidden");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 3500);
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function esc(str) {
  return String(str || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
function setHTML(id, val) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = val;
}
function formatDate(iso) {
  if (!iso) return "–";
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function formatTime(date) {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}
function priorityBadge(p) {
  const cls = { A: "badge-A", B: "badge-B", C: "badge-C" }[p] || "badge-C";
  return `<span class="badge ${cls}">${p || "C"}</span>`;
}
function statusBadge(s) {
  const map = {
    new: ["Neu", "badge-new"],
    hubspot_imported: ["Bereit", "badge-new"],
    no_email: ["Ohne E-Mail", "badge-B"],
    processing: [isCompany4RecruitingCompany() ? "In Kampagne" : "In Analyse", "badge-B"],
    analyzed: ["Analysiert", "badge-qualified"],
    analysed: ["Analysiert", "badge-qualified"],
    enriched: ["Angereichert", "badge-qualified"],
    qualified: ["Qualifiziert", "badge-qualified"],
    video_requested: ["Video läuft", "badge-video"],
    video_ready: ["Video ✓", "badge-video"],
    outreach_active: ["Outreach", "badge-sent"],
    sent: ["Outreach", "badge-sent"],
    active: ["Outreach", "badge-sent"],
    email_sent: ["Mail gesendet", "badge-sent"],
    email_opened: ["Mail geöffnet", "badge-sent"],
    email_clicked: ["Mail geklickt", "badge-sent"],
    replied: ["Antwort erhalten", "badge-qualified"],
    bounced: ["Bounce", "badge-B"],
    unsubscribed: ["Abgemeldet", "badge-B"],
    video_opened: ["Video geöffnet", "badge-video"],
    video_started: ["Video gestartet", "badge-video"],
    video_finished: ["Video angesehen", "badge-qualified"],
    outreach_completed: ["Abgeschlossen", "badge-qualified"],
    archived: ["Archiv", "badge-B"],
    completed: ["Abgeschlossen", "badge-qualified"],
    done: ["Abgeschlossen", "badge-qualified"],
    closed: ["Abgeschlossen", "badge-qualified"],
    no_interest: ["Kein Interesse", "badge-B"],
    disqualified: ["Nicht qualifiziert", "badge-B"],
    follow_up: ["Follow-up offen", "badge-B"],
    meeting: ["Termin", "badge-qualified"],
    won: ["Gewonnen", "badge-qualified"],
    lost: ["Verloren", "badge-B"],
    existing_customer: ["Bereits Kunde", "badge-qualified"]
  };
  const [label, cls] = map[s] || [s || "Neu", "badge-new"];
  return `<span class="badge ${cls}">${label}</span>`;
}
function scoreCell(score, colorClass) {
  return `<div class="score-cell">
    <div class="score-mini-bar"><div class="score-mini-fill ${colorClass}" style="width:${score}%"></div></div>
    <span style="font-size:12px;font-weight:700;color:var(--text-2)">${score}%</span>
  </div>`;
}

// Global helper für onclick in HTML
window.openDrawer = openDrawer;
window.switchView = switchView;
window.toggleAnalysisLead = toggleAnalysisLead;
window.toggleAllVisibleAnalysisLeads = toggleAllVisibleAnalysisLeads;

// ─────────────────────────────────────────────────────────────
// START
// ─────────────────────────────────────────────────────────────
initAuth();
