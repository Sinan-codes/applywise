import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  CircleHelp,
  FileText,
  LoaderCircle,
  LockKeyhole,
  Sparkles,
  UserRound,
  WandSparkles
} from "lucide-react";

const API_URL = "http://localhost:3001/api";
const EMPTY_PROFILE = {
  fullName: "",
  email: "",
  phone: "",
  location: "",
  linkedin: "",
  website: "",
  github: "",
  skills: "",
  education: "",
  workAuthorization: "",
  sponsorship: "",
  salaryExpectation: ""
};
const PROFILE_FIELDS = [
  { key: "fullName", label: "Full name", placeholder: "Jordan Lee" },
  { key: "email", label: "Email address", placeholder: "jordan@email.com", type: "email" },
  { key: "phone", label: "Phone number", placeholder: "+1 (555) 123-4567", type: "tel" },
  { key: "location", label: "Location", placeholder: "City, Country" },
  { key: "linkedin", label: "LinkedIn", placeholder: "linkedin.com/in/you" },
  { key: "website", label: "Portfolio or website", placeholder: "yourportfolio.com" },
  { key: "github", label: "GitHub", placeholder: "github.com/you" },
  { key: "skills", label: "Skills", placeholder: "Product strategy, SQL, user research…", area: true },
  { key: "education", label: "Education", placeholder: "Degree, institution, graduation year" },
  { key: "workAuthorization", label: "Work authorization", placeholder: "For example, authorized to work in the United States" },
  { key: "sponsorship", label: "Visa sponsorship", placeholder: "For example, no sponsorship required" },
  { key: "salaryExpectation", label: "Salary expectation", placeholder: "For example, $100,000–$120,000 USD" }
];

async function request(path, options = {}) {
  const { token, ...fetchOptions } = options;
  const response = await fetch(`${API_URL}${path}`, {
    ...fetchOptions,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...fetchOptions.headers
    }
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(response.ok
      ? "The server returned an invalid response. Please try again."
      : "The server returned an unreadable error response. Please try again.");
  }

  if (!response.ok) {
    throw new Error(typeof data?.error === "string"
      ? data.error
      : "Something went wrong. Please try again.");
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("The server returned an unexpected response. Please try again.");
  }
  return data;
}

async function sendToActivePage(message) {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab?.id) {
    throw new Error("Could not find the active browser tab. Open the job page in a regular Chrome tab and try again.");
  }

  try {
    return await chrome.tabs.sendMessage(activeTab.id, message);
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "";
    if (/receiving end|could not establish connection|message port closed/i.test(messageText)) {
      throw new Error("Applywise can’t access this page yet. Refresh the job page and try again.");
    }
    if (/cannot access contents|cannot access a chrome/i.test(messageText)) {
      throw new Error("Chrome restricts extensions on this page. Try a regular http or https job application page.");
    }
    throw error;
  }
}

function App() {
  const [tab, setTab] = useState("apply");
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState({ kind: "", message: "" });
  const [fields, setFields] = useState([]);
  const [job, setJob] = useState(null);
  const [answers, setAnswers] = useState({});
  const [busy, setBusy] = useState("");
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(["apiToken"], async (stored) => {
      const savedToken = stored.apiToken || "";
      setToken(savedToken);
      setReady(true);
      if (!savedToken) return;
      try {
        const data = await request("/profile", { token: savedToken });
        if (data.profile) {
          setProfile(Object.fromEntries(
            Object.keys(EMPTY_PROFILE).map((key) => [key, data.profile[key] || ""])
          ));
        }
      } catch (error) {
        notify("error", error.message);
      }
    });
  }, []);

  function notify(kind, message) {
    setStatus({ kind, message });
  }

  async function saveProfile(event) {
    event.preventDefault();
    setBusy("save");
    notify("", "");
    try {
      await chrome.storage.local.set({ apiToken: token });
      await request("/profile", {
        method: "PUT",
        token,
        body: JSON.stringify(profile)
      });
      notify("success", "Profile saved. Your details are ready for the next application.");
    } catch (error) {
      notify("error", error.message);
    } finally {
      setBusy("");
    }
  }

  async function scanPage() {
    setBusy("scan");
    notify("", "");
    try {
      const result = await sendToActivePage({ type: "APPLYWISE_SCAN" });
      setFields(result.fields);
      setJob(result.job);
      setAnswers({});
      setScanned(true);
      notify(result.fields.length ? "success" : "info", result.fields.length
        ? `Found ${result.fields.length} fields to review.`
        : "No fillable application fields found on this page.");
    } catch (error) {
      notify("error", error.message || "Could not scan this page. Please try again.");
    } finally {
      setBusy("");
    }
  }

  async function generateAnswers() {
    setBusy("generate");
    notify("", "");
    try {
      const data = await request("/answers", {
        method: "POST",
        token,
        body: JSON.stringify({ profile, fields })
      });
      setAnswers(data.answers);
      const answerCount = Object.keys(data.answers).length;
      const unmatchedCount = fields.length - answerCount;
      const detectedLabels = fields
        .filter((field) => !data.answers[field.id])
        .slice(0, 5)
        .map((field) => `${field.label}${field.context ? ` [${field.context}]` : ""}${field.type ? ` (${field.type})` : ""}${field.placeholder ? ` — ${field.placeholder}` : ""}`)
        .join(", ");
      notify(
        answerCount ? "success" : "info",
        answerCount
          ? `Drafts are ready for ${answerCount} fields. ${unmatchedCount} unmatched fields will be left blank. Review each answer before filling the page.`
          : `No fields matched your profile, so nothing will be filled. Detected fields: ${detectedLabels || "no readable field labels"}.`
      );
    } catch (error) {
      notify("error", error.message);
    } finally {
      setBusy("");
    }
  }

  async function fillPage() {
    setBusy("fill");
    notify("", "");
    try {
      const result = await sendToActivePage({
        type: "APPLYWISE_FILL",
        answers
      });
      notify("success", `Filled ${result.filled} fields. Review the application before submitting.`);
    } catch (error) {
      notify("error", error.message || "Could not fill this page. Please try again.");
    } finally {
      setBusy("");
    }
  }

  function updateAnswer(fieldId, value) {
    setAnswers((current) => ({ ...current, [fieldId]: value }));
  }

  if (!ready) {
    return <main className="loading-screen"><LoaderCircle className="spin" size={22} /></main>;
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark"><WandSparkles size={18} strokeWidth={2.2} /></div>
        <div className="brand-copy">
          <span className="brand-name">applywise</span>
          <span className="brand-caption">YOUR JOB SEARCH, IN FLOW</span>
        </div>
        <button
          className="icon-button profile-shortcut"
          aria-label="Open your profile"
          onClick={() => { setTab("profile"); notify("", ""); }}
        >
          <UserRound size={17} />
        </button>
      </header>

      <nav className="tabs" aria-label="Main navigation">
        <button className={tab === "apply" ? "tab active" : "tab"} onClick={() => setTab("apply")}>
          <BriefcaseBusiness size={15} /> Apply
        </button>
        <button className={tab === "profile" ? "tab active" : "tab"} onClick={() => setTab("profile")}>
          <UserRound size={15} /> My profile
          {!profile.fullName && <span className="setup-dot" />}
        </button>
      </nav>

      {tab === "apply" ? (
        <section className="content">
          <div className="eyebrow"><span className="eyebrow-line" /> YOUR APPLICATION ASSISTANT</div>
          <h1>Make your next<br />move <span>count.</span></h1>
          <p className="intro">Thoughtful answers, tailored to the role. You stay in control of every word.</p>

          <div className="job-card">
            <div className="job-icon"><FileText size={17} /></div>
            <div className="job-copy">
              <strong>{job?.title || "Ready when you are"}</strong>
              <span>{job?.company || "Open a job application page to get started"}</span>
            </div>
            <ChevronDown size={16} className="job-chevron" />
          </div>

          {!profile.fullName && (
            <button className="profile-nudge" onClick={() => setTab("profile")}>
              <span className="nudge-icon"><CircleHelp size={15} /></span>
              <span><strong>First time here?</strong><small>Add your profile to get personalized answers.</small></span>
              <ArrowRight size={15} />
            </button>
          )}

          <button className="button button-secondary scan-button" onClick={scanPage} disabled={Boolean(busy)}>
            {busy === "scan" ? <LoaderCircle className="spin" size={17} /> : <FileText size={16} />}
            Scan this page
            <span className="button-trailing">{scanned ? "Rescan" : "Step 1"}</span>
          </button>

          {scanned && fields.length > 0 && (
            <div className="field-count">
              <span className="count-indicator"><Check size={12} /></span>
              <span><strong>{fields.length} fields found</strong><small>We’ll draft answers for your review.</small></span>
              <span className="step-label">STEP 2</span>
            </div>
          )}

          {scanned && fields.length > 0 && (
            <>
              <button className="button button-primary" onClick={generateAnswers} disabled={Boolean(busy) || !profile.fullName}>
                {busy === "generate" ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={16} />}
                {busy === "generate" ? "Writing your drafts…" : "Draft my answers"}
                {!busy && <ArrowRight size={16} />}
              </button>
              {!profile.fullName && <p className="inline-hint">Complete your profile before generating answers.</p>}
            </>
          )}

          {Object.keys(answers).length > 0 && (
            <div className="answers-section">
              <div className="section-heading"><span>YOUR DRAFTS</span><span>{Object.keys(answers).length} ANSWERS</span></div>
              {fields.map((field) => (
                answers[field.id] ? (
                  <label className="answer-card" key={field.id}>
                    <span className="answer-label">{field.label}{field.required && <i> · Required</i>}</span>
                    <textarea
                      value={answers[field.id]}
                      onChange={(event) => updateAnswer(field.id, event.target.value)}
                      rows={Math.min(5, Math.max(2, Math.ceil(answers[field.id].length / 55)))}
                    />
                  </label>
                ) : null
              ))}
              <button className="button button-primary fill-button" onClick={fillPage} disabled={Boolean(busy)}>
                {busy === "fill" ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}
                Fill reviewed answers
                {!busy && <ArrowRight size={16} />}
              </button>
              <p className="inline-hint">You can edit any draft above. Always check your answers before submitting.</p>
            </div>
          )}

          {status.message && <div className={`notice ${status.kind}`} role="status">{status.message}</div>}
          <div className="privacy-note"><LockKeyhole size={12} /> Your profile stays on your private Applywise server.</div>
        </section>
      ) : (
        <section className="content profile-content">
          <div className="eyebrow"><span className="eyebrow-line" /> A LITTLE ABOUT YOU</div>
          <h1>Your story,<br /><span>your advantage.</span></h1>
          <p className="intro">Give your AI copilot the context it needs to make every answer sound like you.</p>
          <form onSubmit={saveProfile}>
            <div className="form-section-title">YOUR DETAILS <span>01 / 03</span></div>
            <div className="profile-grid">
              {PROFILE_FIELDS.slice(0, 7).map((field) => (
                <ProfileInput key={field.key} field={field} profile={profile} setProfile={setProfile} />
              ))}
            </div>
            <div className="form-section-title">YOUR BACKGROUND <span>02 / 03</span></div>
            <div className="profile-grid">
              {PROFILE_FIELDS.slice(7, 9).map((field) => (
                <ProfileInput key={field.key} field={field} profile={profile} setProfile={setProfile} />
              ))}
            </div>
            <div className="form-section-title">PREFERENCES <span>03 / 03</span></div>
            <div className="profile-grid">
              {PROFILE_FIELDS.slice(9).map((field) => (
                <ProfileInput key={field.key} field={field} profile={profile} setProfile={setProfile} />
              ))}
            </div>
            <label className="token-field">
              <span>API access token <i>Required</i></span>
              <input
                type="password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="Set APPLYWISE_API_TOKEN on your server"
                autoComplete="off"
              />
              <small>Stored in this browser only. It protects your personal profile and AI requests.</small>
            </label>
            {status.message && <div className={`notice ${status.kind}`} role="status">{status.message}</div>}
            <button className="button button-primary save-button" type="submit" disabled={Boolean(busy)}>
              {busy === "save" ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}
              {busy === "save" ? "Saving your profile…" : "Save my profile"}
              {!busy && <ArrowRight size={16} />}
            </button>
          </form>
          <button className="back-link" onClick={() => { setTab("apply"); notify("", ""); }}>
            <ArrowLeft size={14} /> Back to applications
          </button>
        </section>
      )}
      <footer className="footer"><span>APPLYWISE</span><span>MADE FOR YOUR NEXT CHAPTER <span className="footer-star">✳</span></span></footer>
    </main>
  );
}

function ProfileInput({ field, profile, setProfile }) {
  return (
    <label className={`profile-field${field.area ? " full-width" : ""}`}>
      <span>{field.label}{["fullName", "email"].includes(field.key) && <i>Required</i>}</span>
      {field.area ? (
        <textarea
          value={profile[field.key]}
          placeholder={field.placeholder}
          rows={3}
          onChange={(event) => setProfile((current) => ({ ...current, [field.key]: event.target.value }))}
        />
      ) : (
        <input
          type={field.type || "text"}
          value={profile[field.key]}
          placeholder={field.placeholder}
          required={["fullName", "email"].includes(field.key)}
          onChange={(event) => setProfile((current) => ({ ...current, [field.key]: event.target.value }))}
        />
      )}
    </label>
  );
}

export default App;
