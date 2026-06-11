/* ============================================================
   AI MEETING ASSISTANT — app.js
   All API keys live here. Replace the placeholder strings
   with your real keys before opening the app.
   ============================================================ */

/* ------------------------------------------------------------------ */
/*  🔑  API KEY CONFIGURATION — EDIT THESE VALUES                      */
/* ------------------------------------------------------------------ */
const KEYS = {
  // Anthropic Claude  →  https://console.anthropic.com/settings/keys
  anthropic: "YOUR_ANTHROPIC_API_KEY",

  // OpenAI GPT-4o     →  https://platform.openai.com/api-keys
  openai: "YOUR_OPENAI_API_KEY",

  // Google Gemini     →  https://aistudio.google.com/app/apikey
  gemini: "YOUR_GEMINI_API_KEY",

  // Notion integration token  →  https://www.notion.so/my-integrations
  notion: "YOUR_NOTION_INTEGRATION_TOKEN",
  // The ID of the Notion parent page where new pages will be created
  notionPageId: "YOUR_NOTION_PARENT_PAGE_ID",

  // Slack Bot OAuth token  →  https://api.slack.com/apps
  slack: "YOUR_SLACK_BOT_TOKEN",
  // Default Slack channel to post to (can be overridden in Integrations tab)
  slackChannel: "#general",

  // Google OAuth2 access token  →  https://developers.google.com/oauthplayground
  // Scopes needed: calendar.events, drive.file
  google: "YOUR_GOOGLE_OAUTH_ACCESS_TOKEN",
  // Leave "primary" to use the user's default calendar, or paste a calendar ID
  googleCalendarId: "primary",
};
/* ------------------------------------------------------------------ */

/* ---- ACTIVE AI PROVIDER: "anthropic" | "openai" | "gemini" ---- */
let AI_PROVIDER = "anthropic";

/* ---- API ENDPOINTS ---- */
const ENDPOINTS = {
  anthropic: "https://api.anthropic.com/v1/messages",
  openai:    "https://api.openai.com/v1/chat/completions",
  gemini:    "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent",
  notion:    "https://api.notion.com/v1/pages",
  slack:     "https://slack.com/api/chat.postMessage",
  gcal:      "https://www.googleapis.com/calendar/v3/calendars",
  gdrive:    "https://www.googleapis.com/upload/drive/v3/files",
};

/* ============================================================
   STATE
   ============================================================ */
let state = {
  meeting: {
    title: "", objective: "", participants: [], stakeholders: [],
    timeline: "", project: "", prevOutcomes: "", agenda: [],
    startTime: null, isActive: false
  },
  notes: [], actions: [], decisions: [], risks: [],
  decisionCounter: 1, riskCounter: 1, timerInterval: null
};

/* ============================================================
   UNIFIED AI CALL
   Routes to the correct provider based on AI_PROVIDER.
   Returns the plain-text response string.
   ============================================================ */
async function callAI(systemPrompt, userPrompt, maxTokens = 1000) {
  if (AI_PROVIDER === "anthropic") {
    const resp = await fetch(ENDPOINTS.anthropic, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }]
      })
    });
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message);
    return data.content?.[0]?.text || "";
  }

  if (AI_PROVIDER === "openai") {
    const resp = await fetch(ENDPOINTS.openai, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${KEYS.openai}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userPrompt }
        ]
      })
    });
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message);
    return data.choices?.[0]?.message?.content || "";
  }

  if (AI_PROVIDER === "gemini") {
    const url = `${ENDPOINTS.gemini}?key=${KEYS.gemini}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
        generationConfig: { maxOutputTokens: maxTokens }
      })
    });
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message);
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  throw new Error("No AI provider configured");
}

/* ============================================================
   UTILITY
   ============================================================ */
function getTimestamp() {
  if (!state.meeting.startTime) return "--:--";
  const e = Date.now() - state.meeting.startTime;
  const h = String(Math.floor(e / 3600000)).padStart(2, "0");
  const m = String(Math.floor((e % 3600000) / 60000)).padStart(2, "0");
  const s = String(Math.floor((e % 60000) / 1000)).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function formatDate(d) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function todayISO() { return new Date().toISOString().split("T")[0]; }

function uuid() { return Math.random().toString(36).slice(2, 9); }

function showToast(msg, type = "info") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = `toast ${type} show`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = "toast"; }, 3000);
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function buildMeetingContext() {
  const m = state.meeting;
  return `
MEETING TITLE: ${m.title || "Untitled"}
OBJECTIVE: ${m.objective || "Not specified"}
PARTICIPANTS: ${m.participants.join(", ") || "Not specified"}
STAKEHOLDERS: ${m.stakeholders.join(", ") || "Not specified"}
TIMELINE: ${m.timeline || "Not specified"}
PROJECT: ${m.project || "Not specified"}
PREVIOUS OUTCOMES: ${m.prevOutcomes || "None"}
AGENDA: ${m.agenda.map((a,i)=>`${i+1}. ${a}`).join("; ") || "Not specified"}

LIVE NOTES (${state.notes.length}):
${state.notes.map(n=>`[${n.timestamp}] [${n.type.toUpperCase()}]${n.speaker?" "+n.speaker+":":""} ${n.text}`).join("\n") || "None"}

ACTION ITEMS (${state.actions.length}):
${state.actions.map(a=>`- ${a.task} | Owner: ${a.owner||"TBD"} | Due: ${a.due||"TBD"} | Priority: ${a.priority} | Status: ${a.status}`).join("\n") || "None"}

DECISIONS (${state.decisions.length}):
${state.decisions.map(d=>`- ${d.desc} | By: ${d.makers||"TBD"} | Reason: ${d.reasoning||"N/A"}`).join("\n") || "None"}

RISKS (${state.risks.length}):
${state.risks.map(r=>`- [${r.type}] ${r.desc} | Prob: ${r.probability} | Impact: ${r.impact} | Mitigation: ${r.mitigation||"TBD"}`).join("\n") || "None"}
`.trim();
}

/* ============================================================
   SIDEBAR & NAVIGATION
   ============================================================ */
function switchTab(tab) {
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  const btn = document.querySelector(`[data-tab="${tab}"]`);
  if (btn) btn.classList.add("active");
  const panel = document.getElementById(`tab-${tab}`);
  if (panel) panel.classList.add("active");
}

function initNav() {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
  document.getElementById("sidebarToggle").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("collapsed");
    document.querySelector(".main-wrapper").classList.toggle("expanded");
  });
  document.getElementById("menuBtn").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("mobile-open");
  });
}

/* ============================================================
   TAG INPUT
   ============================================================ */
function initTagInput(inputId, containerId, stateKey) {
  const input     = document.getElementById(inputId);
  const container = document.getElementById(containerId);

  function addTag(val) {
    val = val.trim();
    if (!val || state.meeting[stateKey].includes(val)) return;
    state.meeting[stateKey].push(val);
    renderTags();
    input.value = "";
    updateSpeakerDropdown();
  }

  function renderTags() {
    container.innerHTML = "";
    state.meeting[stateKey].forEach(name => {
      const span = document.createElement("span");
      span.className = "tag";
      span.innerHTML = `${escapeHtml(name)}<span class="tag-remove" data-name="${escapeHtml(name)}">&times;</span>`;
      container.appendChild(span);
    });
  }

  input.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(input.value); }
    else if (e.key === "Backspace" && !input.value) {
      state.meeting[stateKey].pop(); renderTags(); updateSpeakerDropdown();
    }
  });

  container.addEventListener("click", e => {
    if (e.target.classList.contains("tag-remove")) {
      const name = e.target.dataset.name;
      state.meeting[stateKey] = state.meeting[stateKey].filter(n => n !== name);
      renderTags(); updateSpeakerDropdown();
    }
  });
}

function updateSpeakerDropdown() {
  const sel = document.getElementById("speakerSelect");
  const all = [...new Set([...state.meeting.participants, ...state.meeting.stakeholders])];
  sel.innerHTML = '<option value="">— Speaker —</option>';
  all.forEach(name => {
    const opt = document.createElement("option");
    opt.value = name; opt.textContent = name;
    sel.appendChild(opt);
  });
}

/* ============================================================
   AGENDA BUILDER
   ============================================================ */
function initAgenda() {
  document.getElementById("addAgendaBtn").addEventListener("click", addAgendaItem);
  document.getElementById("agendaInput").addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); addAgendaItem(); }
  });
}

function addAgendaItem() {
  const input = document.getElementById("agendaInput");
  const val = input.value.trim();
  if (!val) return;
  state.meeting.agenda.push(val);
  input.value = "";
  renderAgenda();
}

function renderAgenda() {
  const list = document.getElementById("agendaList");
  list.innerHTML = "";
  state.meeting.agenda.forEach((item, i) => {
    const div = document.createElement("div");
    div.className = "agenda-item";
    div.innerHTML = `<span class="agenda-item-num">${String(i+1).padStart(2,"0")}</span>
      <span class="agenda-item-text">${escapeHtml(item)}</span>
      <button class="agenda-item-del" data-idx="${i}">×</button>`;
    list.appendChild(div);
  });
  list.querySelectorAll(".agenda-item-del").forEach(btn => {
    btn.addEventListener("click", () => {
      state.meeting.agenda.splice(parseInt(btn.dataset.idx), 1); renderAgenda();
    });
  });
}

/* ============================================================
   MEETING SETUP
   ============================================================ */
function initSetup() {
  document.getElementById("saveMeetingSetup").addEventListener("click", () => {
    const title     = document.getElementById("meetingTitle").value.trim();
    const objective = document.getElementById("meetingObjective").value.trim();
    if (!title)     { showToast("Please enter a meeting title", "error"); return; }
    if (!objective) { showToast("Please enter a meeting objective", "error"); return; }
    state.meeting.title       = title;
    state.meeting.objective   = objective;
    state.meeting.timeline    = document.getElementById("meetingTimeline").value.trim();
    state.meeting.project     = document.getElementById("meetingProject").value.trim();
    state.meeting.prevOutcomes= document.getElementById("prevOutcomes").value.trim();
    document.getElementById("topbarTitle").textContent = title;
    showToast("Meeting setup saved!", "success");
    switchTab("live");
  });
}

/* ============================================================
   MEETING TIMER
   ============================================================ */
function initMeetingToggle() {
  document.getElementById("toggleMeeting").addEventListener("click", () => {
    state.meeting.isActive ? stopMeeting() : startMeeting();
  });
}

function startMeeting() {
  state.meeting.isActive = true;
  state.meeting.startTime = Date.now();
  document.getElementById("toggleMeeting").textContent = "End Meeting";
  document.getElementById("toggleMeeting").classList.add("active");
  document.querySelector(".status-dot").className = "status-dot active";
  document.querySelector(".status-text").textContent = "Meeting in progress";
  state.timerInterval = setInterval(() => {
    document.getElementById("meetingTimer").textContent = getTimestamp();
  }, 1000);
  showToast("Meeting started!", "success");
}

function stopMeeting() {
  state.meeting.isActive = false;
  clearInterval(state.timerInterval);
  document.getElementById("toggleMeeting").textContent = "Start Meeting";
  document.getElementById("toggleMeeting").classList.remove("active");
  document.querySelector(".status-dot").className = "status-dot inactive";
  document.querySelector(".status-text").textContent = "Meeting ended";
  showToast("Meeting ended", "info");
}

/* ============================================================
   LIVE NOTES
   ============================================================ */
function initLiveNotes() {
  document.getElementById("addNoteBtn").addEventListener("click", addNote);
  document.getElementById("liveNoteInput").addEventListener("keydown", e => {
    if (e.key === "Enter" && e.ctrlKey) { e.preventDefault(); addNote(); }
  });
}

async function addNote() {
  const input  = document.getElementById("liveNoteInput");
  const text   = input.value.trim();
  if (!text) { showToast("Please enter a note", "error"); return; }

  const manualType = document.getElementById("noteTypeSelect").value;
  const speaker    = document.getElementById("speakerSelect").value;
  const timestamp  = state.meeting.isActive ? getTimestamp() : "--:--";

  if (manualType !== "auto") {
    const note = { id: uuid(), text, type: manualType, speaker, timestamp, aiClassified: false };
    state.notes.unshift(note); input.value = "";
    renderNote(note); autoExtract(note); return;
  }

  const proc = document.getElementById("aiProcessing");
  proc.style.display = "flex";
  input.disabled = true;

  try {
    const aiType = await classifyNote(text);
    const note   = { id: uuid(), text, type: aiType, speaker, timestamp, aiClassified: true };
    state.notes.unshift(note); input.value = "";
    renderNote(note); autoExtract(note);
  } catch {
    const note = { id: uuid(), text, type: "discussion", speaker, timestamp, aiClassified: false };
    state.notes.unshift(note); input.value = "";
    renderNote(note);
    showToast("AI unavailable — saved as discussion", "info");
  } finally {
    proc.style.display = "none";
    input.disabled = false; input.focus();
  }
}

async function classifyNote(text) {
  const raw = await callAI(
    `Classify meeting notes into exactly one of: decision, action, risk, question, discussion.
decision = something decided/agreed. action = task assigned. risk = blocker/concern raised.
question = open question needing answer. discussion = general info/status update.
Respond with ONLY the single lowercase word. No punctuation, no explanation.`,
    `Classify: "${text}"`
  );
  const valid = ["decision","action","risk","question","discussion"];
  const clean = raw.trim().toLowerCase();
  return valid.includes(clean) ? clean : "discussion";
}

function autoExtract(note) {
  if (note.type === "action") {
    state.actions.push({ id: uuid(), task: note.text, owner: note.speaker||"", due: "", priority: "Medium", status: "Open" });
    renderActionsTable();
  } else if (note.type === "decision") {
    state.decisions.push({ id: `D-${String(state.decisionCounter++).padStart(3,"0")}`, desc: note.text, makers: note.speaker||"", date: todayISO(), reasoning: "", impact: "" });
    renderDecisions();
  } else if (note.type === "risk") {
    state.risks.push({ id: uuid(), riskId: `R-${String(state.riskCounter++).padStart(3,"0")}`, desc: note.text, type: "Timeline", probability: "Medium", impact: "Medium", mitigation: "" });
    renderRisks();
  }
}

function renderNote(note) {
  const feed  = document.getElementById("liveFeed");
  const empty = feed.querySelector(".empty-state");
  if (empty) empty.remove();
  const div = document.createElement("div");
  div.className   = `note-entry type-${note.type}`;
  div.dataset.id  = note.id;
  const typeLabel = note.type.charAt(0).toUpperCase() + note.type.slice(1);
  div.innerHTML = `
    <div class="note-meta">
      <span class="note-timestamp">${note.timestamp}</span>
      <span class="note-type-badge badge-${note.type}">${typeLabel}</span>
    </div>
    <div class="note-content">
      ${note.speaker ? `<div class="note-speaker">${escapeHtml(note.speaker)}</div>` : ""}
      <div class="note-text">${escapeHtml(note.text)}</div>
      ${note.aiClassified ? `<div class="note-ai-label">✦ AI classified via ${AI_PROVIDER}</div>` : ""}
    </div>
    <button class="btn-tbl del" onclick="deleteNote('${note.id}')">✕</button>`;
  feed.insertBefore(div, feed.firstChild);
}

function deleteNote(id) {
  state.notes = state.notes.filter(n => n.id !== id);
  const el = document.querySelector(`.note-entry[data-id="${id}"]`);
  if (el) el.remove();
  if (!document.querySelector(".note-entry"))
    document.getElementById("liveFeed").innerHTML = `<div class="empty-state"><p>◎ Notes will appear here</p></div>`;
  showToast("Note deleted", "info");
}

/* ============================================================
   ACTION ITEMS
   ============================================================ */
function initActions() {
  document.getElementById("addActionBtn").addEventListener("click", () => openActionModal());
  document.getElementById("saveActionBtn").addEventListener("click", saveAction);
  document.getElementById("actionFilter").addEventListener("change", renderActionsTable);
  document.getElementById("priorityFilter").addEventListener("change", renderActionsTable);
}

function openActionModal(action = null) {
  document.getElementById("actionModalTitle").textContent = action ? "Edit Action Item" : "Add Action Item";
  document.getElementById("actionEditId").value      = action ? action.id       : "";
  document.getElementById("actionTask").value        = action ? action.task     : "";
  document.getElementById("actionOwner").value       = action ? action.owner    : "";
  document.getElementById("actionDue").value         = action ? action.due      : "";
  document.getElementById("actionPriority").value    = action ? action.priority : "Medium";
  document.getElementById("actionStatus").value      = action ? action.status   : "Open";
  openModal("actionModal");
}

function saveAction() {
  const task = document.getElementById("actionTask").value.trim();
  if (!task) { showToast("Task description is required", "error"); return; }
  const editId = document.getElementById("actionEditId").value;
  const data   = {
    id:       editId || uuid(),
    task,
    owner:    document.getElementById("actionOwner").value.trim(),
    due:      document.getElementById("actionDue").value,
    priority: document.getElementById("actionPriority").value,
    status:   document.getElementById("actionStatus").value
  };
  if (editId) { const i = state.actions.findIndex(a => a.id === editId); if (i !== -1) state.actions[i] = data; showToast("Updated","success"); }
  else        { state.actions.push(data); showToast("Added","success"); }
  closeModal("actionModal"); renderActionsTable();
}

function renderActionsTable() {
  const body    = document.getElementById("actionsTableBody");
  const statusF = document.getElementById("actionFilter").value;
  const priF    = document.getElementById("priorityFilter").value;
  const list    = state.actions.filter(a =>
    (statusF==="all"||a.status===statusF) && (priF==="all"||a.priority===priF));
  if (!list.length) { body.innerHTML=`<tr class="empty-row"><td colspan="7">No action items</td></tr>`; return; }
  body.innerHTML = list.map((a,i) => `
    <tr>
      <td><span style="font-family:JetBrains Mono,monospace;font-size:11px;color:var(--accent)">AI-${String(i+1).padStart(3,"0")}</span></td>
      <td style="max-width:300px">${escapeHtml(a.task)}</td>
      <td>${escapeHtml(a.owner||"—")}</td>
      <td>${a.due ? formatDate(a.due) : "—"}</td>
      <td><span class="priority-badge priority-${a.priority}">${a.priority}</span></td>
      <td><span class="status-badge status-${a.status.replace(" ","")}">${a.status}</span></td>
      <td><div class="table-actions">
        <button class="btn-tbl" onclick="editAction('${a.id}')">Edit</button>
        <button class="btn-tbl del" onclick="deleteAction('${a.id}')">Del</button>
      </div></td>
    </tr>`).join("");
}

function editAction(id)   { const a = state.actions.find(a => a.id===id); if(a) openActionModal(a); }
function deleteAction(id) {
  if (!confirm("Delete this action item?")) return;
  state.actions = state.actions.filter(a => a.id !== id);
  renderActionsTable(); showToast("Deleted","info");
}

/* ============================================================
   DECISIONS
   ============================================================ */
function initDecisions() {
  document.getElementById("addDecisionBtn").addEventListener("click", () => openDecisionModal());
  document.getElementById("saveDecisionBtn").addEventListener("click", saveDecision);
}

function openDecisionModal(dec = null) {
  document.getElementById("decisionEditId").value    = dec ? dec.id        : "";
  document.getElementById("decisionDesc").value      = dec ? dec.desc      : "";
  document.getElementById("decisionMakers").value    = dec ? dec.makers    : "";
  document.getElementById("decisionDate").value      = dec ? dec.date      : todayISO();
  document.getElementById("decisionReasoning").value = dec ? dec.reasoning : "";
  document.getElementById("decisionImpact").value    = dec ? dec.impact    : "";
  openModal("decisionModal");
}

function saveDecision() {
  const desc = document.getElementById("decisionDesc").value.trim();
  if (!desc) { showToast("Description required","error"); return; }
  const editId = document.getElementById("decisionEditId").value;
  const data = {
    id:        editId || `D-${String(state.decisionCounter++).padStart(3,"0")}`,
    desc,
    makers:    document.getElementById("decisionMakers").value.trim(),
    date:      document.getElementById("decisionDate").value,
    reasoning: document.getElementById("decisionReasoning").value.trim(),
    impact:    document.getElementById("decisionImpact").value.trim()
  };
  if (editId) { const i=state.decisions.findIndex(d=>d.id===editId); if(i!==-1) state.decisions[i]=data; showToast("Updated","success"); }
  else        { state.decisions.push(data); showToast("Logged","success"); }
  closeModal("decisionModal"); renderDecisions();
}

function renderDecisions() {
  const grid = document.getElementById("decisionsGrid");
  if (!state.decisions.length) { grid.innerHTML=`<div class="empty-state"><p>⊕ No decisions logged yet</p></div>`; return; }
  grid.innerHTML = state.decisions.map(d => `
    <div class="decision-card">
      <div class="decision-id">${d.id}</div>
      <div class="decision-desc">${escapeHtml(d.desc)}</div>
      <div class="decision-meta">
        ${d.makers    ? `<div class="decision-meta-row"><span class="decision-meta-key">By</span><span>${escapeHtml(d.makers)}</span></div>` : ""}
        ${d.date      ? `<div class="decision-meta-row"><span class="decision-meta-key">Date</span><span>${formatDate(d.date)}</span></div>` : ""}
        ${d.reasoning ? `<div class="decision-meta-row"><span class="decision-meta-key">Reason</span><span>${escapeHtml(d.reasoning)}</span></div>` : ""}
        ${d.impact    ? `<div class="decision-meta-row"><span class="decision-meta-key">Impact</span><span>${escapeHtml(d.impact)}</span></div>` : ""}
      </div>
      <div class="card-actions">
        <button class="btn-tbl" onclick="editDecision('${d.id}')">Edit</button>
        <button class="btn-tbl del" onclick="deleteDecision('${d.id}')">Delete</button>
      </div>
    </div>`).join("");
}

function editDecision(id)   { const d=state.decisions.find(d=>d.id===id); if(d) openDecisionModal(d); }
function deleteDecision(id) {
  if (!confirm("Delete this decision?")) return;
  state.decisions=state.decisions.filter(d=>d.id!==id); renderDecisions(); showToast("Deleted","info");
}

/* ============================================================
   RISKS
   ============================================================ */
function initRisks() {
  document.getElementById("addRiskBtn").addEventListener("click", () => openRiskModal());
  document.getElementById("saveRiskBtn").addEventListener("click", saveRisk);
}

function openRiskModal(risk = null) {
  document.getElementById("riskEditId").value      = risk ? risk.id          : "";
  document.getElementById("riskDesc").value        = risk ? risk.desc        : "";
  document.getElementById("riskType").value        = risk ? risk.type        : "Timeline";
  document.getElementById("riskProbability").value = risk ? risk.probability : "Medium";
  document.getElementById("riskImpact").value      = risk ? risk.impact      : "Medium";
  document.getElementById("riskMitigation").value  = risk ? risk.mitigation  : "";
  openModal("riskModal");
}

function saveRisk() {
  const desc = document.getElementById("riskDesc").value.trim();
  if (!desc) { showToast("Description required","error"); return; }
  const editId = document.getElementById("riskEditId").value;
  const data = {
    id:          editId || uuid(),
    riskId:      editId ? (state.risks.find(r=>r.id===editId)?.riskId || `R-${String(state.riskCounter).padStart(3,"0")}`) : `R-${String(state.riskCounter++).padStart(3,"0")}`,
    desc,
    type:        document.getElementById("riskType").value,
    probability: document.getElementById("riskProbability").value,
    impact:      document.getElementById("riskImpact").value,
    mitigation:  document.getElementById("riskMitigation").value.trim()
  };
  if (editId) { const i=state.risks.findIndex(r=>r.id===editId); if(i!==-1) state.risks[i]=data; showToast("Updated","success"); }
  else        { state.risks.push(data); showToast("Added","success"); }
  closeModal("riskModal"); renderRisks();
}

function renderRisks() {
  const grid = document.getElementById("risksGrid");
  if (!state.risks.length) { grid.innerHTML=`<div class="empty-state"><p>⚠ No risks identified yet</p></div>`; return; }
  grid.innerHTML = state.risks.map(r => `
    <div class="risk-card prob-${r.probability}">
      <div class="risk-header">
        <span style="font-family:JetBrains Mono,monospace;font-size:11px;color:var(--text-muted)">${r.riskId}</span>
        <span class="risk-type-badge">${r.type}</span>
      </div>
      <div class="risk-desc">${escapeHtml(r.desc)}</div>
      <div class="risk-scores">
        <div class="risk-score-item">Probability: <strong>${r.probability}</strong></div>
        <div class="risk-score-item">Impact: <strong>${r.impact}</strong></div>
      </div>
      ${r.mitigation ? `<div class="risk-mitigation"><strong>Mitigation</strong>${escapeHtml(r.mitigation)}</div>` : ""}
      <div class="card-actions" style="margin-top:12px">
        <button class="btn-tbl" onclick="editRisk('${r.id}')">Edit</button>
        <button class="btn-tbl del" onclick="deleteRisk('${r.id}')">Delete</button>
      </div>
    </div>`).join("");
}

function editRisk(id)   { const r=state.risks.find(r=>r.id===id); if(r) openRiskModal(r); }
function deleteRisk(id) {
  if (!confirm("Delete this risk?")) return;
  state.risks=state.risks.filter(r=>r.id!==id); renderRisks(); showToast("Deleted","info");
}

/* ============================================================
   AI — SUMMARY
   ============================================================ */
function initSummary() {
  document.getElementById("generateSummaryBtn").addEventListener("click", generateSummary);
}

async function generateSummary() {
  const type   = document.getElementById("summaryType").value;
  const output = document.getElementById("summaryOutput");
  output.innerHTML = `<div class="ai-loading"><div class="spinner"></div> Generating ${type} summary via ${AI_PROVIDER}…</div>`;
  const ctx = buildMeetingContext();
  const prompts = {
    executive: `Write a professional Executive Summary (2-4 paragraphs) for leadership. Focus on key outcomes, major decisions, and strategic implications.\n\n${ctx}`,
    detailed:  `Write detailed meeting minutes with sections: 1.Meeting Overview 2.Topics Discussed 3.Key Insights 4.Decisions Made 5.Action Items 6.Risks & Blockers 7.Open Questions 8.Next Steps\n\n${ctx}`,
    both:      `Write BOTH:\nA) EXECUTIVE SUMMARY (2-4 paragraphs for leadership)\nB) DETAILED MEETING MINUTES (all sections)\n\n${ctx}`
  };
  try {
    const text = await callAI(
      "You are an expert meeting facilitator. Generate clear, professional meeting summaries. Use ### headings.",
      prompts[type]
    );
    output.innerHTML = `<div class="ai-content">${renderMarkdown(text)}</div>`;
    showToast("Summary generated!", "success");
  } catch (err) {
    output.innerHTML = `<div class="empty-state"><p>Error: ${escapeHtml(err.message)}</p></div>`;
    showToast("Failed: " + err.message, "error");
  }
}

/* ============================================================
   AI — FOLLOW-UP EMAIL
   ============================================================ */
function initEmail() {
  document.getElementById("generateEmailBtn").addEventListener("click", generateEmail);
  document.getElementById("copyEmailBtn").addEventListener("click", () => {
    const text = document.getElementById("emailPreview").innerText;
    if (!text || text.includes("Click")) { showToast("No email yet","error"); return; }
    navigator.clipboard.writeText(text).then(()=>showToast("Copied!","success")).catch(()=>showToast("Copy failed","error"));
  });
  document.getElementById("sendSlackBtn").addEventListener("click", sendEmailToSlack);
  document.getElementById("sendEmailClientBtn").addEventListener("click", openInMailClient);
}

async function generateEmail() {
  const preview = document.getElementById("emailPreview");
  preview.innerHTML = `<div class="ai-loading"><div class="spinner"></div> Generating email via ${AI_PROVIDER}…</div>`;
  const ctx = buildMeetingContext();
  try {
    const text = await callAI(
      "You are an executive assistant writing professional follow-up emails. Format: Subject line first, then email body.",
      `Write a professional follow-up email. Include: Subject, greeting, key decisions, action items (owners/due dates), open questions, next steps.\n\n${ctx}\n\nRecipients: ${state.meeting.participants.join(", ")||"Team"}`
    );
    const lines = text.split("\n");
    const subLine = lines.find(l => l.toLowerCase().startsWith("subject:")) || "";
    const body    = subLine ? lines.slice(lines.indexOf(subLine)+1).join("\n").trim() : text;
    preview.innerHTML = subLine
      ? `<div class="email-subject">${escapeHtml(subLine)}</div><div class="email-body">${escapeHtml(body)}</div>`
      : `<div class="email-body">${escapeHtml(text)}</div>`;
    showToast("Email generated!", "success");
  } catch (err) {
    preview.innerHTML = `<div class="empty-state"><p>Error: ${escapeHtml(err.message)}</p></div>`;
    showToast("Failed: " + err.message, "error");
  }
}

function openInMailClient() {
  const preview = document.getElementById("emailPreview");
  const subject = preview.querySelector(".email-subject")?.textContent?.replace(/^Subject:\s*/i,"") || state.meeting.title + " – Meeting Follow-up";
  const body    = preview.querySelector(".email-body")?.textContent || "";
  const to      = state.meeting.participants.join(",");
  window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/* ---- Send the follow-up email text to Slack ---- */
async function sendEmailToSlack() {
  const preview = document.getElementById("emailPreview");
  const text    = preview.innerText;
  if (!text || text.includes("Click")) { showToast("Generate the email first","error"); return; }
  const channel = document.getElementById("slackChannel")?.value?.trim() || KEYS.slackChannel;
  await postToSlack(text, channel);
}

/* ============================================================
   AI — FINAL REPORT
   ============================================================ */
function initReport() {
  document.getElementById("generateReportBtn").addEventListener("click", generateReport);
  document.getElementById("copyReportBtn").addEventListener("click", () => {
    const text = document.getElementById("reportOutput").innerText;
    if (!text || text.includes("Full meeting")) { showToast("No report yet","error"); return; }
    navigator.clipboard.writeText(text).then(()=>showToast("Copied!","success")).catch(()=>showToast("Copy failed","error"));
  });
  document.getElementById("saveNotionBtn").addEventListener("click", pushToNotion);
  document.getElementById("saveGdriveBtn").addEventListener("click", saveToGoogleDrive);
  document.getElementById("createCalBtn").addEventListener("click", createCalendarEvent);
}

async function generateReport() {
  const output   = document.getElementById("reportOutput");
  output.innerHTML = `<div class="ai-loading"><div class="spinner"></div> Generating report via ${AI_PROVIDER}…</div>`;
  const ctx      = buildMeetingContext();
  const duration = state.meeting.startTime ? Math.round((Date.now()-state.meeting.startTime)/60000)+" minutes" : "Not tracked";
  try {
    const text = await callAI(
      "You are a professional meeting secretary. Generate formal meeting minutes with clear ### section headings.",
      `Generate a complete formal Meeting Report:\n### Meeting Overview\n### Attendees\n### Agenda\n### Key Discussion Points\n### Decisions Made\n### Action Items\n### Risks & Blockers\n### Open Questions\n### Next Steps\n### Executive Summary\n\nDuration: ${duration}\n\n${ctx}`
    );
    output.innerHTML = `<div class="ai-content">${renderMarkdown(text)}</div>`;
    showToast("Report generated!", "success");
  } catch (err) {
    output.innerHTML = `<div class="empty-state"><p>Error: ${escapeHtml(err.message)}</p></div>`;
    showToast("Failed: " + err.message, "error");
  }
}

/* ============================================================
   AI — INTELLIGENCE
   ============================================================ */
function initIntelligence() {
  document.getElementById("generateIntelBtn").addEventListener("click", generateIntelligence);
}

async function generateIntelligence() {
  const output = document.getElementById("intelligenceOutput");
  output.innerHTML = `<div class="ai-loading" style="grid-column:1/-1"><div class="spinner"></div> Analyzing via ${AI_PROVIDER}…</div>`;
  const ctx = buildMeetingContext();
  try {
    const raw = await callAI(
      `Analyze meetings and respond ONLY in valid JSON, no markdown fences, no preamble.
Return exactly: {"sentiment":{"value":"Positive|Neutral|Concerned|Conflicted","detail":"..."},"engagement":{"value":"Highly Engaged|Moderate Participation|Low Participation","detail":"..."},"alignment":{"value":"Consensus Reached|Partial Alignment|Significant Disagreement","detail":"..."},"recommendations":["..."],"missingStakeholders":["..."],"priorities":["..."],"processImprovements":["..."]}`,
      `Analyze this meeting:\n\n${ctx}`
    );
    const intel = JSON.parse(raw.replace(/```json|```/g,"").trim());
    renderIntelligence(intel);
    showToast("Analysis complete!", "success");
  } catch (err) {
    output.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><p>Error: ${escapeHtml(err.message)}</p></div>`;
    showToast("Failed: " + err.message, "error");
  }
}

function renderIntelligence(intel) {
  const sentimentMap  = { "Positive":"sentiment-positive","Neutral":"sentiment-neutral","Concerned":"sentiment-concerned","Conflicted":"sentiment-conflicted" };
  const engagementMap = { "Highly Engaged":"engagement-high","Moderate Participation":"engagement-moderate","Low Participation":"engagement-low" };
  const alignmentMap  = { "Consensus Reached":"alignment-consensus","Partial Alignment":"alignment-partial","Significant Disagreement":"alignment-disagreement" };
  document.getElementById("intelligenceOutput").innerHTML = `
    <div class="intel-card">
      <h4>Sentiment</h4>
      <div class="intel-value ${sentimentMap[intel.sentiment?.value]||""}">${intel.sentiment?.value||"Unknown"}</div>
      <div class="intel-detail">${escapeHtml(intel.sentiment?.detail||"")}</div>
    </div>
    <div class="intel-card">
      <h4>Engagement</h4>
      <div class="intel-value ${engagementMap[intel.engagement?.value]||""}">${intel.engagement?.value||"Unknown"}</div>
      <div class="intel-detail">${escapeHtml(intel.engagement?.detail||"")}</div>
    </div>
    <div class="intel-card">
      <h4>Alignment</h4>
      <div class="intel-value ${alignmentMap[intel.alignment?.value]||""}">${intel.alignment?.value||"Unknown"}</div>
      <div class="intel-detail">${escapeHtml(intel.alignment?.detail||"")}</div>
    </div>
    <div class="intel-card">
      <h4>Strategic Recommendations</h4>
      <div class="intel-detail">${(intel.recommendations||[]).map((r,i)=>`${i+1}. ${escapeHtml(r)}`).join("\n")||"None"}</div>
    </div>
    <div class="intel-card">
      <h4>Missing Stakeholders</h4>
      <div class="intel-detail">${(intel.missingStakeholders||[]).length ? intel.missingStakeholders.map(s=>`• ${escapeHtml(s)}`).join("\n") : "None identified"}</div>
    </div>
    <div class="intel-card">
      <h4>Priority Focus Areas</h4>
      <div class="intel-detail">${(intel.priorities||[]).map((p,i)=>`${i+1}. ${escapeHtml(p)}`).join("\n")||"None"}</div>
    </div>
    <div class="intel-card">
      <h4>Process Improvements</h4>
      <div class="intel-detail">${(intel.processImprovements||[]).map(p=>`• ${escapeHtml(p)}`).join("\n")||"None"}</div>
    </div>`;
}

/* ============================================================
   INTEGRATIONS
   ============================================================ */

/* ---- NOTION ---- */
async function pushToNotion() {
  const token    = KEYS.notion;
  const parentId = KEYS.notionPageId;
  if (!token || token.startsWith("YOUR_")) { showToast("Set KEYS.notion in app.js","error"); return; }
  if (!parentId || parentId.startsWith("YOUR_")) { showToast("Set KEYS.notionPageId in app.js","error"); return; }

  const reportEl = document.getElementById("reportOutput");
  const content  = reportEl?.querySelector(".ai-content")?.innerText;
  if (!content) { showToast("Generate the Final Report first","error"); return; }

  showToast("Pushing to Notion…","info");

  // Split content into 2000-char chunks (Notion paragraph limit)
  const chunks = [];
  for (let i = 0; i < content.length; i += 1900) chunks.push(content.slice(i, i+1900));

  const children = chunks.map(chunk => ({
    object: "block", type: "paragraph",
    paragraph: { rich_text: [{ type: "text", text: { content: chunk } }] }
  }));

  try {
    const resp = await fetch(ENDPOINTS.notion, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28"
      },
      body: JSON.stringify({
        parent:     { page_id: parentId },
        properties: { title: { title: [{ text: { content: `${state.meeting.title || "Meeting"} — Minutes ${todayISO()}` } }] } },
        children
      })
    });
    const data = await resp.json();
    if (data.object === "error") throw new Error(data.message);
    showToast("✓ Saved to Notion!", "success");
  } catch (err) {
    showToast("Notion error: " + err.message, "error");
    console.error("Notion:", err);
  }
}

/* ---- SLACK ---- */
async function postToSlack(text, channel) {
  const token = KEYS.slack;
  if (!token || token.startsWith("YOUR_")) { showToast("Set KEYS.slack in app.js","error"); return; }
  const ch = channel || KEYS.slackChannel;
  showToast("Sending to Slack…","info");
  try {
    const resp = await fetch(ENDPOINTS.slack, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ channel: ch, text: text.slice(0, 3000) })
    });
    const data = await resp.json();
    if (!data.ok) throw new Error(data.error);
    showToast(`✓ Sent to Slack ${ch}!`, "success");
  } catch (err) {
    showToast("Slack error: " + err.message, "error");
    console.error("Slack:", err);
  }
}

async function sendToSlack() {
  const channel = document.getElementById("slackChannel")?.value?.trim() || KEYS.slackChannel;
  const ctx     = buildMeetingContext();
  const summary = `*Meeting Summary: ${state.meeting.title || "Untitled"}*\n\n${ctx.slice(0, 2800)}`;
  await postToSlack(summary, channel);
}

/* ---- GOOGLE CALENDAR ---- */
async function createCalendarEvent() {
  const token = KEYS.google;
  if (!token || token.startsWith("YOUR_")) { showToast("Set KEYS.google in app.js","error"); return; }
  const dateVal = document.getElementById("calDate")?.value;
  const timeVal = document.getElementById("calTime")?.value || "10:00";
  if (!dateVal) { showToast("Pick a follow-up date first","error"); return; }

  const calId    = KEYS.googleCalendarId || "primary";
  const start    = new Date(`${dateVal}T${timeVal}:00`);
  const end      = new Date(start.getTime() + 60*60*1000); // +1 hour
  const toISO    = d => d.toISOString();

  const participants = state.meeting.participants.map(p => ({ email: p.includes("@") ? p : "" })).filter(a => a.email);

  showToast("Creating calendar event…","info");
  try {
    const resp = await fetch(`${ENDPOINTS.gcal}/${encodeURIComponent(calId)}/events`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        summary:     `Follow-up: ${state.meeting.title || "Meeting"}`,
        description: `Follow-up meeting.\nObjective: ${state.meeting.objective}\nAgenda: ${state.meeting.agenda.join(", ")}`,
        start:       { dateTime: toISO(start), timeZone: "UTC" },
        end:         { dateTime: toISO(end),   timeZone: "UTC" },
        attendees:   participants
      })
    });
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message);
    showToast("✓ Calendar event created!", "success");
  } catch (err) {
    showToast("Calendar error: " + err.message, "error");
    console.error("GCal:", err);
  }
}

/* ---- GOOGLE DRIVE ---- */
async function saveToGoogleDrive() {
  const token = KEYS.google;
  if (!token || token.startsWith("YOUR_")) { showToast("Set KEYS.google in app.js","error"); return; }

  const reportEl = document.getElementById("reportOutput");
  const content  = reportEl?.querySelector(".ai-content")?.innerText;
  if (!content) { showToast("Generate the Final Report first","error"); return; }

  const folderId = document.getElementById("gdriveFolderId")?.value?.trim();
  const filename = `${state.meeting.title || "Meeting"}_Minutes_${todayISO()}.txt`;
  const blob     = new Blob([content], { type: "text/plain" });
  const meta     = { name: filename, mimeType: "text/plain", ...(folderId ? { parents: [folderId] } : {}) };

  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(meta)], { type: "application/json" }));
  form.append("file", blob);

  showToast("Uploading to Google Drive…","info");
  try {
    const resp = await fetch(`${ENDPOINTS.gdrive}?uploadType=multipart`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` },
      body: form
    });
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message);
    showToast("✓ Saved to Google Drive!", "success");
  } catch (err) {
    showToast("Drive error: " + err.message, "error");
    console.error("Drive:", err);
  }
}

/* ---- AI PROVIDER SWITCHER ---- */
function setAIProvider(provider) {
  AI_PROVIDER = provider;
  const labels = { anthropic: "Claude (Anthropic)", openai: "GPT-4o (OpenAI)", gemini: "Gemini 1.5 (Google)" };
  showToast(`AI provider set to ${labels[provider] || provider}`, "success");
}

/* ============================================================
   MODAL HELPERS
   ============================================================ */
function openModal(id) {
  document.getElementById("modalOverlay").classList.add("visible");
  const m = document.getElementById(id);
  m.style.display = "block";
  requestAnimationFrame(() => m.classList.add("open"));
}

function closeModal(id) {
  document.getElementById("modalOverlay").classList.remove("visible");
  const m = document.getElementById(id);
  m.classList.remove("open");
  setTimeout(() => { m.style.display = "none"; }, 200);
}

/* ============================================================
   MARKDOWN RENDERER (lightweight)
   ============================================================ */
function renderMarkdown(text) {
  return text
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/^### (.+)$/gm,"<h3>$1</h3>")
    .replace(/^## (.+)$/gm,"<h3>$1</h3>")
    .replace(/^# (.+)$/gm,"<h3>$1</h3>")
    .replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>")
    .replace(/\*(.+?)\*/g,"<em>$1</em>")
    .replace(/^- (.+)$/gm,"• $1")
    .replace(/\n{2,}/g,"</p><p>")
    .replace(/\n/g,"<br>");
}

/* ============================================================
   EXPORT JSON
   ============================================================ */
function initExport() {
  document.getElementById("exportBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ meeting:state.meeting, notes:state.notes, actions:state.actions, decisions:state.decisions, risks:state.risks, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `meeting-${(state.meeting.title||"export").replace(/\s+/g,"_")}-${todayISO()}.json`;
    a.click(); URL.revokeObjectURL(url);
    showToast("Exported!", "success");
  });
}

/* ============================================================
   RESET
   ============================================================ */
function initReset() {
  document.getElementById("clearBtn").addEventListener("click", () => {
    if (!confirm("Reset all meeting data?")) return;
    clearInterval(state.timerInterval);
    state = { meeting:{title:"",objective:"",participants:[],stakeholders:[],timeline:"",project:"",prevOutcomes:"",agenda:[],startTime:null,isActive:false}, notes:[], actions:[], decisions:[], risks:[], decisionCounter:1, riskCounter:1, timerInterval:null };
    ["meetingTitle","meetingObjective","meetingTimeline","meetingProject","prevOutcomes"].forEach(id=>{const e=document.getElementById(id);if(e)e.value="";});
    ["participantTags","stakeholderTags"].forEach(id=>{const e=document.getElementById(id);if(e)e.innerHTML="";});
    document.getElementById("agendaList").innerHTML         = "";
    document.getElementById("liveFeed").innerHTML           = `<div class="empty-state"><p>◎ Notes will appear here as you add them</p></div>`;
    document.getElementById("actionsTableBody").innerHTML   = `<tr class="empty-row"><td colspan="7">No action items yet</td></tr>`;
    document.getElementById("decisionsGrid").innerHTML      = `<div class="empty-state"><p>⊕ No decisions logged yet</p></div>`;
    document.getElementById("risksGrid").innerHTML          = `<div class="empty-state"><p>⚠ No risks identified yet</p></div>`;
    document.getElementById("summaryOutput").innerHTML      = `<div class="empty-state"><p>≡ Click "Generate Summary"</p></div>`;
    document.getElementById("emailPreview").innerHTML       = `<div class="empty-state"><p>✉ Click "Generate Email"</p></div>`;
    document.getElementById("reportOutput").innerHTML       = `<div class="empty-state"><p>📋 Full meeting report will appear here</p></div>`;
    document.getElementById("intelligenceOutput").innerHTML = `<div class="empty-state"><p>◈ Click "Analyze Meeting"</p></div>`;
    document.getElementById("topbarTitle").textContent      = "AI Meeting Assistant";
    document.getElementById("meetingTimer").textContent     = "00:00:00";
    document.getElementById("toggleMeeting").textContent   = "Start Meeting";
    document.getElementById("toggleMeeting").classList.remove("active");
    document.querySelector(".status-dot").className         = "status-dot inactive";
    document.querySelector(".status-text").textContent      = "No active meeting";
    document.getElementById("speakerSelect").innerHTML      = '<option value="">— Speaker —</option>';
    showToast("Meeting data cleared","info");
  });
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  initNav();
  initTagInput("participantInput","participantTags","participants");
  initTagInput("stakeholderInput","stakeholderTags","stakeholders");
  initAgenda();
  initSetup();
  initMeetingToggle();
  initLiveNotes();
  initActions();
  initDecisions();
  initRisks();
  initSummary();
  initEmail();
  initReport();
  initIntelligence();
  initExport();
  initReset();

  // Overlay click closes any open modal
  document.getElementById("modalOverlay").addEventListener("click", () => {
    ["actionModal","decisionModal","riskModal"].forEach(id => {
      const m = document.getElementById(id);
      if (m?.classList.contains("open")) closeModal(id);
    });
  });

  // Escape key
  document.addEventListener("keydown", e => {
    if (e.key === "Escape")
      ["actionModal","decisionModal","riskModal"].forEach(id => {
        const m = document.getElementById(id);
        if (m?.classList.contains("open")) closeModal(id);
      });
  });

  // Show which AI provider is active on load
  setAIProvider(AI_PROVIDER);

  console.log("AI Meeting Assistant initialized ✓");
  console.log("Active AI provider:", AI_PROVIDER);
  console.log("Configured keys:", Object.entries(KEYS).filter(([k,v])=>!v.startsWith("YOUR_")).map(([k])=>k));
});
