// app.js — the admin dashboard

(function () {
  // --- Auth guard ---------------------------------------------------------
  if (!Session.getToken()) {
    window.location.href = "login.html";
    return;
  }
  const admin = Session.getAdmin();
  document.getElementById("adminEmail").textContent = admin ? admin.email : "Admin";

  document.getElementById("logoutBtn").addEventListener("click", () => {
    Session.clear();
    window.location.href = "login.html";
  });

  // --- State ---------------------------------------------------------------
  let allLeads = [];
  let currentLeadId = null;
  let dragLeadId = null;

  const STATUS_META = {
    new: { label: "New", col: "colNew", count: "countNew" },
    contacted: { label: "Contacted", col: "colContacted", count: "countContacted" },
    converted: { label: "Converted", col: "colConverted", count: "countConverted" },
  };

  // --- Toast -----------------------------------------------------------------
  let toastTimer;
  function toast(msg, isError = false) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.toggle("error", isError);
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
  }

  // --- Formatting helpers ------------------------------------------------------
  function timeAgo(iso) {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
  }

  function fullDate(iso) {
    return new Date(iso).toLocaleString();
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
  }

  // --- Data loading ----------------------------------------------------------
  async function loadAnalytics() {
    try {
      const data = await apiFetch("/api/leads/analytics/summary", { auth: true });
      document.getElementById("statTotal").textContent = data.total;
      document.getElementById("statNewWeek").textContent = `${data.newThisWeek} new this week`;
      document.getElementById("statNew").textContent = data.byStatus.new || 0;
      document.getElementById("statContacted").textContent = data.byStatus.contacted || 0;
      document.getElementById("statConverted").textContent = data.byStatus.converted || 0;
      document.getElementById("statConversion").textContent = `${data.conversionRate}% conversion rate`;
    } catch (err) {
      console.error(err);
    }
  }

  async function loadLeads() {
    const search = document.getElementById("searchInput").value;
    const sort = document.getElementById("sortSelect").value;
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (sort) params.set("sort", sort);

    try {
      const data = await apiFetch(`/api/leads?${params.toString()}`, { auth: true });
      allLeads = data.leads;
      renderBoard();
    } catch (err) {
      toast(err.message, true);
    }
  }

  function refreshAll() {
    loadLeads();
    loadAnalytics();
  }

  // --- Rendering the pipeline board -------------------------------------------
  function renderBoard() {
    Object.keys(STATUS_META).forEach((status) => {
      const meta = STATUS_META[status];
      const container = document.getElementById(meta.col);
      const leads = allLeads.filter((l) => l.status === status);
      document.getElementById(meta.count).textContent = leads.length;

      if (leads.length === 0) {
        container.innerHTML = `<div class="empty-col">No leads here</div>`;
        return;
      }

      container.innerHTML = leads.map(leadCardHtml).join("");
    });

    // wire up card interactions after re-render
    document.querySelectorAll(".lead-card").forEach((card) => {
      card.addEventListener("click", () => openModal(card.dataset.id));
      card.addEventListener("dragstart", (e) => {
        dragLeadId = card.dataset.id;
        card.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
      });
      card.addEventListener("dragend", () => card.classList.remove("dragging"));
    });
  }

  function leadCardHtml(lead) {
    return `
      <div class="lead-card" draggable="true" data-id="${lead.id}">
        <div class="lead-card-name">${escapeHtml(lead.name)}</div>
        <div class="lead-card-company">${escapeHtml(lead.company || lead.email)}</div>
        <div class="lead-card-meta">
          <span class="lead-card-source">${escapeHtml(lead.source || "Unknown")}</span>
          <span class="lead-card-time mono">${timeAgo(lead.createdAt)}</span>
        </div>
      </div>
    `;
  }

  // --- Drag & drop between columns ---------------------------------------------
  document.querySelectorAll(".pipeline-col").forEach((col) => {
    col.addEventListener("dragover", (e) => {
      e.preventDefault();
      col.classList.add("drag-over");
    });
    col.addEventListener("dragleave", () => col.classList.remove("drag-over"));
    col.addEventListener("drop", async (e) => {
      e.preventDefault();
      col.classList.remove("drag-over");
      const newStatus = col.dataset.status;
      if (!dragLeadId) return;
      const lead = allLeads.find((l) => l.id === dragLeadId);
      if (lead && lead.status !== newStatus) {
        await updateStatus(dragLeadId, newStatus, { silent: true });
      }
      dragLeadId = null;
    });
  });

  // --- Modal -----------------------------------------------------------------
  const backdrop = document.getElementById("modalBackdrop");
  const modal = document.getElementById("modal");

  function openModal(leadId) {
    currentLeadId = leadId;
    renderModal();
    backdrop.style.display = "flex";
  }

  function closeModal() {
    backdrop.style.display = "none";
    currentLeadId = null;
  }

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && backdrop.style.display !== "none") closeModal();
  });

  function renderModal() {
    const lead = allLeads.find((l) => l.id === currentLeadId);
    if (!lead) {
      closeModal();
      return;
    }

    const notesHtml = lead.notes.length
      ? lead.notes
          .slice()
          .reverse()
          .map(
            (n) => `
        <div class="note-item">
          <div>${escapeHtml(n.text)}</div>
          <div class="note-time">${fullDate(n.createdAt)}</div>
        </div>`
          )
          .join("")
      : `<div class="state-msg" style="padding:16px 0;">No follow-up notes yet.</div>`;

    modal.innerHTML = `
      <div class="modal-head">
        <div>
          <h2>${escapeHtml(lead.name)}</h2>
          <div class="modal-sub">${escapeHtml(lead.email)}</div>
        </div>
        <button class="modal-close" id="closeModalBtn" aria-label="Close">&times;</button>
      </div>

      <div class="field-row">
        <div class="field">
          <div class="field-label">Phone</div>
          <div class="field-value">${escapeHtml(lead.phone) || "—"}</div>
        </div>
        <div class="field">
          <div class="field-label">Company</div>
          <div class="field-value">${escapeHtml(lead.company) || "—"}</div>
        </div>
        <div class="field">
          <div class="field-label">Source</div>
          <div class="field-value">${escapeHtml(lead.source)}</div>
        </div>
        <div class="field">
          <div class="field-label">Received</div>
          <div class="field-value mono">${fullDate(lead.createdAt)}</div>
        </div>
      </div>

      <div class="message-box">${escapeHtml(lead.message) || "No message included."}</div>

      <div class="status-switch" id="statusSwitch">
        ${Object.keys(STATUS_META)
          .map(
            (s) => `<button class="status-btn ${s === lead.status ? "active " + s : ""}" data-status="${s}">${STATUS_META[s].label}</button>`
          )
          .join("")}
      </div>

      <div class="notes-section">
        <h3>Follow-up notes</h3>
        <div id="notesList">${notesHtml}</div>
        <form class="note-form" id="noteForm">
          <textarea id="noteText" placeholder="Log a call, email, or next step…" required></textarea>
          <button type="submit" class="btn btn-primary">Add note</button>
        </form>
      </div>

      <div class="modal-footer">
        <button class="btn btn-danger" id="deleteLeadBtn">Delete lead</button>
        <button class="btn" id="closeModalBtn2">Close</button>
      </div>
    `;

    document.getElementById("closeModalBtn").addEventListener("click", closeModal);
    document.getElementById("closeModalBtn2").addEventListener("click", closeModal);

    modal.querySelectorAll(".status-btn").forEach((btn) => {
      btn.addEventListener("click", () => updateStatus(lead.id, btn.dataset.status));
    });

    document.getElementById("noteForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const textarea = document.getElementById("noteText");
      const text = textarea.value.trim();
      if (!text) return;
      try {
        const data = await apiFetch(`/api/leads/${lead.id}/notes`, {
          method: "POST",
          auth: true,
          body: { text },
        });
        updateLeadInState(data.lead);
        renderModal();
        toast("Note added.");
      } catch (err) {
        toast(err.message, true);
      }
    });

    document.getElementById("deleteLeadBtn").addEventListener("click", async () => {
      if (!confirm(`Delete the lead "${lead.name}"? This can't be undone.`)) return;
      try {
        await apiFetch(`/api/leads/${lead.id}`, { method: "DELETE", auth: true });
        allLeads = allLeads.filter((l) => l.id !== lead.id);
        closeModal();
        renderBoard();
        loadAnalytics();
        toast("Lead deleted.");
      } catch (err) {
        toast(err.message, true);
      }
    });
  }

  function updateLeadInState(updated) {
    const idx = allLeads.findIndex((l) => l.id === updated.id);
    if (idx !== -1) allLeads[idx] = updated;
  }

  async function updateStatus(leadId, status, opts = {}) {
    try {
      const data = await apiFetch(`/api/leads/${leadId}/status`, {
        method: "PATCH",
        auth: true,
        body: { status },
      });
      updateLeadInState(data.lead);
      renderBoard();
      loadAnalytics();
      if (currentLeadId === leadId) renderModal();
      if (!opts.silent) toast(`Marked as ${STATUS_META[status].label.toLowerCase()}.`);
    } catch (err) {
      toast(err.message, true);
    }
  }

  // --- Toolbar events ----------------------------------------------------------
  let searchDebounce;
  document.getElementById("searchInput").addEventListener("input", () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(loadLeads, 250);
  });
  document.getElementById("sortSelect").addEventListener("change", loadLeads);
  document.getElementById("refreshBtn").addEventListener("click", refreshAll);

  // --- Init ----------------------------------------------------------------------
  refreshAll();
})();