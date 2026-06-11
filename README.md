# AI Meeting Assistant

A complete, AI-powered meeting management application built with vanilla HTML, CSS, and JavaScript. Integrates with the Anthropic Claude API for intelligent note classification, summary generation, email drafting, and meeting intelligence.

---

## Features

### Pre-Meeting Setup
- Meeting title, objective, participants, stakeholders
- Timeline, project context, previous outcomes
- Agenda builder with drag-and-drop ordering

### Live Notes (During Meeting)
- Real-time note entry with automatic AI classification
- Types: Decision, Action Item, Risk, Open Question, Discussion
- Speaker attribution and timestamp tracking
- Auto-extraction: action items, decisions, and risks populate their respective trackers automatically

### Action Item Tracker
- Full CRUD: add, edit, delete
- Fields: Task, Owner, Due Date, Priority (High/Medium/Low), Status (Open/In Progress/Closed)
- Filter by status and priority

### Decision Log
- Structured decision records with IDs (D-001, D-002...)
- Fields: Description, Decision Makers, Date, Reasoning, Impact

### Risk Register
- Risk identification with types: Timeline, Budget, Resource, Technical, Compliance, Communication, Blocker, Dependency
- Probability and Impact ratings
- Mitigation strategies

### AI-Powered Summaries
- Executive Summary (leadership-focused, 2-4 paragraphs)
- Detailed Meeting Minutes (all sections)
- Both formats simultaneously

### Follow-up Email Generator
- Professional follow-up email with decisions, action items, open questions, and next steps

### Final Report
- Formal meeting minutes in structured format

### Meeting Intelligence
- Sentiment analysis (Positive/Neutral/Concerned/Conflicted)
- Engagement assessment
- Alignment measurement
- Strategic recommendations
- Missing stakeholder identification
- Priority focus areas
- Process improvement suggestions

---

## Getting Started

### Option 1: Open Directly
Simply open `index.html` in any modern browser. No server required.

### Option 2: Local Server (recommended for API calls)
```bash
# Python
python3 -m http.server 8080

# Node.js
npx serve .

# Then open: http://localhost:8080
```

---

## API Configuration

The app calls the Anthropic Claude API via the proxy layer. API keys are handled by the hosting environment (claude.ai). If running standalone, you may need to configure a proxy or add your API key.

To add your own API key for standalone use, open `js/app.js` and locate the `fetch` calls — they point to `https://api.anthropic.com/v1/messages`. Add your key to the Authorization header:

```javascript
headers: {
  "Content-Type": "application/json",
  "x-api-key": "YOUR_API_KEY",
  "anthropic-version": "2023-06-01",
  "anthropic-dangerous-direct-browser-access": "true"
}
```

> ⚠️ Warning: Never expose API keys in client-side code for production use. Use a server-side proxy.

---

## Project Structure

```
meeting-assistant/
├── index.html          # Main application
├── css/
│   └── styles.css      # Complete stylesheet
├── js/
│   └── app.js          # All application logic
└── README.md           # This file
```

---

## Usage Workflow

1. **Setup** — Enter meeting title, objective, participants, agenda
2. **Start Meeting** — Click "Start Meeting" to begin timer
3. **Live Notes** — Add notes as discussions happen; AI classifies each entry
4. **Track** — Review auto-populated Action Items, Decisions, and Risks tabs
5. **Summarize** — Generate AI summary (executive or detailed)
6. **Email** — Generate professional follow-up email
7. **Report** — Create formal meeting minutes
8. **Intelligence** — Analyze sentiment, engagement, and get recommendations
9. **Export** — Download all meeting data as JSON

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+Enter | Add live note |
| Escape | Close modal |

---

## Browser Support

Works in all modern browsers: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

---

## License

MIT License — free for personal and commercial use.
