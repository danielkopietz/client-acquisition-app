const API_BASE = "https://api.automatisierungen-ki.de";

const state = {
  companies: [],
  leads: [],
  scans: [],
  selectedLead: null,
};

const elements = {
  apiStatusText: document.getElementById("apiStatusText"),
  apiStatusDetail: document.getElementById("apiStatusDetail"),
  sidebarCompanyName: document.getElementById("sidebarCompanyName"),
  sidebarPlan: document.getElementById("sidebarPlan"),
  sidebarCredits: document.getElementById("sidebarCredits"),

  statCompanies: document.getElementById("statCompanies"),
  statLeads: document.getElementById("statLeads"),
  statScans: document.getElementById("statScans"),
  statALeads: document.getElementById("statALeads"),

  companyCard: document.getElementById("companyCard"),
  scanList: document.getElementById("scanList"),

  leadsTableBody: document.getElementById("leadsTableBody"),
  scansTableBody: document.getElementById("scansTableBody"),

  leadDetail: document.getElementById("leadDetail"),
  auditDetail: document.getElementById("auditDetail"),

  refreshDataBtn: document.getElementById("refreshDataBtn"),
  searchInput: document.getElementById("searchInput"),
  priorityFilter: document.getElementById("priorityFilter"),
};

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

async function loadHealth() {
  try {
    const data = await fetchJson(`${API_BASE}/health`);
    elements.apiStatusText.textContent = data.healthy ? "API & DB online" : "Fehler";
    elements.apiStatusDetail.textContent = data.healthy
      ? "Backend und Datenbank sind verbunden."
      : "Backend läuft, aber DB antwortet nicht.";
  } catch (error) {
    elements.apiStatusText.textContent = "Nicht erreichbar";
    elements.apiStatusDetail.textContent = "Healthcheck konnte nicht geladen werden.";
  }
}

async function loadData() {
  try {
    const [companies, leads, scans] = await Promise.all([
      fetchJson(`${API_BASE}/companies`),
      fetchJson(`${API_BASE}/leads`),
      fetchJson(`${API_BASE}/scans`),
    ]);

    state.companies = companies;
    state.leads = leads;
    state.scans = scans;

    renderDashboard();
    renderLeads();
    renderScans();
  } catch (error) {
    console.error(error);
  }
}

function renderDashboard() {
  const company = state.companies[0] || null;
  const aLeads = state.leads.filter((lead) => lead.priority === "A").length;

  elements.statCompanies.textContent = state.companies.length;
  elements.statLeads.textContent = state.leads.length;
  elements.statScans.textContent = state.scans.length;
  elements.statALeads.textContent = aLeads;

  if (company) {
    elements.sidebarCompanyName.textContent = company.company_name;
    elements.sidebarPlan.textContent = `Plan: ${company.plan}`;
    elements.sidebarCredits.textContent = `${company.credits_used} / ${company.credits_total}`;

    elements.companyCard.classList.remove("empty-state");
    elements.companyCard.innerHTML = `
      <div class="company-meta">
        <div class="meta-box">
          <span>Company</span>
          <strong>${company.company_name}</strong>
        </div>
        <div class="meta-box">
          <span>Plan</span>
          <strong>${company.plan}</strong>
        </div>
        <div class="meta-box">
          <span>Status</span>
          <strong>${company.status}</strong>
        </div>
        <div class="meta-box">
          <span>Prompt Profile</span>
          <strong>${company.prompt_profile || "default"}</strong>
        </div>
        <div class="meta-box">
          <span>Credits Total</span>
          <strong>${company.credits_total}</strong>
        </div>
        <div class="meta-box">
          <span>Credits Used</span>
          <strong>${company.credits_used}</strong>
        </div>
      </div>
    `;
  }

  if (state.scans.length) {
    elements.scanList.classList.remove("empty-state");
    elements.scanList.innerHTML = state.scans
      .slice(0, 5)
      .map(
        (scan) => `
          <div class="scan-item">
            <h4>Scan #${scan.id}</h4>
            <p><strong>Branche:</strong> ${scan.industry}</p>
            <p><strong>Region:</strong> ${scan.region}</p>
            <p><strong>Status:</strong> ${scan.status}</p>
            <p><strong>Lead Limit:</strong> ${scan.lead_limit}</p>
          </div>
        `
      )
      .join("");
  } else {
    elements.scanList.className = "scan-list empty-state";
    elements.scanList.textContent = "Keine Scans vorhanden.";
  }
}

function renderLeads() {
  const query = (elements.searchInput.value || "").toLowerCase();
  const priority = elements.priorityFilter.value;

  const filtered = state.leads.filter((lead) => {
    const matchesSearch = !query || lead.lead_name.toLowerCase().includes(query);
    const matchesPriority = priority === "all" || lead.priority === priority;
    return matchesSearch && matchesPriority;
  });

  if (!filtered.length) {
    elements.leadsTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-row">Keine Leads gefunden.</td>
      </tr>
    `;
    return;
  }

  elements.leadsTableBody.innerHTML = filtered
    .map(
      (lead) => `
        <tr class="clickable" data-id="${lead.id}">
          <td><strong>${lead.lead_name}</strong></td>
          <td>${lead.website || "-"}</td>
          <td>${lead.instagram_status || "-"}</td>
          <td>${lead.ads_status || "-"}</td>
          <td>${lead.opportunity_score ?? "-"}</td>
          <td><span class="badge ${String(lead.priority || "").toLowerCase()}">${lead.priority || "-"}</span></td>
          <td><span class="badge status">${lead.status || "-"}</span></td>
        </tr>
      `
    )
    .join("");

  document.querySelectorAll("#leadsTableBody tr.clickable").forEach((row) => {
    row.addEventListener("click", () => {
      const id = row.dataset.id;
      loadLeadDetail(id);
      activateTab("audit");
    });
  });
}

function renderScans() {
  if (!state.scans.length) {
    elements.scansTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-row">Keine Scans vorhanden.</td>
      </tr>
    `;
    return;
  }

  elements.scansTableBody.innerHTML = state.scans
    .map(
      (scan) => `
        <tr>
          <td>${scan.id}</td>
          <td>${scan.company_id}</td>
          <td>${scan.industry}</td>
          <td>${scan.region}</td>
          <td>${scan.lead_limit}</td>
          <td>${scan.status}</td>
          <td>${new Date(scan.created_at).toLocaleString("de-DE")}</td>
        </tr>
      `
    )
    .join("");
}

async function loadLeadDetail(id) {
  try {
    const data = await fetchJson(`${API_BASE}/leads/${id}`);
    state.selectedLead = data;
    renderLeadDetail();
  } catch (error) {
    console.error(error);
  }
}

function renderLeadDetail() {
  if (!state.selectedLead || !state.selectedLead.lead) {
    elements.leadDetail.className = "detail-card empty-state";
    elements.auditDetail.className = "audit-card empty-state";
    elements.leadDetail.textContent = "Noch kein Lead ausgewählt.";
    elements.auditDetail.textContent = "Noch kein Audit geladen.";
    return;
  }

  const { lead, audit, outreach_actions } = state.selectedLead;

  elements.leadDetail.classList.remove("empty-state");
  elements.leadDetail.innerHTML = `
    <div class="detail-section">
      <h4>${lead.lead_name}</h4>
      <p><strong>Website:</strong> ${lead.website || "-"}</p>
      <p><strong>Instagram:</strong> ${lead.instagram_status || "-"}</p>
      <p><strong>Ads:</strong> ${lead.ads_status || "-"}</p>
      <p><strong>Website Score:</strong> ${lead.website_score ?? "-"}</p>
      <p><strong>Opportunity Score:</strong> ${lead.opportunity_score ?? "-"}</p>
      <p><strong>Priorität:</strong> ${lead.priority || "-"}</p>
      <p><strong>Kanal:</strong> ${lead.channel || "-"}</p>
      <p><strong>Status:</strong> ${lead.status || "-"}</p>
    </div>

    <div class="detail-section">
      <h4>Sales Hook</h4>
      <p>${lead.sales_hook || "-"}</p>
    </div>

    <div class="detail-section">
      <h4>Notizen</h4>
      <p>${lead.notes || "-"}</p>
    </div>

    <div class="detail-section">
      <h4>Outreach Actions</h4>
      <p>${outreach_actions.length ? outreach_actions.map(a => `${a.action_type} (${a.status})`).join(", ") : "Keine Aktionen vorhanden."}</p>
    </div>
  `;

  if (audit) {
    elements.auditDetail.classList.remove("empty-state");
    elements.auditDetail.innerHTML = `
      <div class="detail-section">
        <h4>Audit Summary</h4>
        <p>${audit.audit_summary || "-"}</p>
      </div>
      <div class="detail-section">
        <h4>Audit HTML</h4>
        <div class="audit-html">${audit.audit_html || "-"}</div>
      </div>
    `;
  } else {
    elements.auditDetail.className = "audit-card empty-state";
    elements.auditDetail.textContent = "Kein Audit vorhanden.";
  }
}

function activateTab(tabId) {
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });

  document.querySelectorAll(".tab-content").forEach((tab) => {
    tab.classList.toggle("active", tab.id === tabId);
  });
}

function initTabs() {
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      activateTab(btn.dataset.tab);
    });
  });
}

function initFilters() {
  elements.searchInput.addEventListener("input", renderLeads);
  elements.priorityFilter.addEventListener("change", renderLeads);
  elements.refreshDataBtn.addEventListener("click", async () => {
    await loadHealth();
    await loadData();
  });
}

async function init() {
  initTabs();
  initFilters();
  await loadHealth();
  await loadData();
}

init();