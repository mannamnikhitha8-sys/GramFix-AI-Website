
import React, { useEffect, useRef, useState } from "react";

const API = "https://gramfix-ai-backend.onrender.com/api";

const languages = [
  { name: "Telugu", code: "te-IN" },
  { name: "Hindi", code: "hi-IN" },
  { name: "Malayalam", code: "ml-IN" },
  { name: "Tamil", code: "ta-IN" },
  { name: "Kannada", code: "kn-IN" },
  { name: "English", code: "en-IN" }
];

const categories = [
  "Auto Detect",
  "Water Supply",
  "Road Damage",
  "Drainage",
  "Streetlight",
  "Garbage",
  "Sanitation",
  "Other"
];

const numberWords = {
  // Telugu
  "ఒకటి": 1, "ఒక": 1, "రెండు": 2, "మూడు": 3,
  "నాలుగు": 4, "ఐదు": 5, "ఆరు": 6, "ఏడు": 7,
  "ఎనిమిది": 8, "తొమ్మిది": 9, "పది": 10,
  "పదకొండు": 11, "పన్నెండు": 12, "పదమూడు": 13,
  "పద్నాలుగు": 14, "పదిహేను": 15, "పదహారు": 16,
  "పదిహేడు": 17, "పద్దెనిమిది": 18, "పంతొమ్మిది": 19,
  "ఇరవై": 20, "ముప్పై": 30, "నలభై": 40, "యాభై": 50,

  // Hindi
  "एक": 1, "दो": 2, "तीन": 3, "चार": 4,
  "पांच": 5, "पाँच": 5, "छह": 6, "सात": 7,
  "आठ": 8, "नौ": 9, "दस": 10, "ग्यारह": 11,
  "बारह": 12, "तेरह": 13, "चौदह": 14,
  "पंद्रह": 15, "सोलह": 16, "सत्रह": 17,
  "अठारह": 18, "उन्नीस": 19, "बीस": 20,

  // Malayalam
  "ഒന്ന്": 1, "രണ്ട്": 2, "മൂന്ന്": 3, "നാല്": 4,
  "അഞ്ച്": 5, "ആറ്": 6, "ഏഴ്": 7, "എട്ട്": 8,
  "ഒമ്പത്": 9, "പത്ത്": 10, "പതിനൊന്ന്": 11,
  "പന്ത്രണ്ട്": 12, "പതിമൂന്ന്": 13, "പതിനാല്": 14,
  "പതിനഞ്ച്": 15, "പതിനാറ്": 16, "പതിനേഴ്": 17,
  "പതിനെട്ട്": 18, "പത്തൊമ്പത്": 19, "ഇരുപത്": 20,

  // Tamil
  "ஒன்று": 1, "ஒரு": 1, "இரண்டு": 2, "மூன்று": 3,
  "நான்கு": 4, "ஐந்து": 5, "ஆறு": 6, "ஏழு": 7,
  "எட்டு": 8, "ஒன்பது": 9, "பத்து": 10,
  "பதினொன்று": 11, "பன்னிரண்டு": 12,
  "பதின்மூன்று": 13, "பதினான்கு": 14,
  "பதினைந்து": 15, "பதினாறு": 16,
  "பதினேழு": 17, "பதினெட்டு": 18,
  "பத்தொன்பது": 19, "இருபது": 20,

  // Kannada
  "ಒಂದು": 1, "ಎರಡು": 2, "ಮೂರು": 3, "ನಾಲ್ಕು": 4,
  "ಐದು": 5, "ಆರು": 6, "ಏಳು": 7, "ಎಂಟು": 8,
  "ಒಂಬತ್ತು": 9, "ಹತ್ತು": 10, "ಹನ್ನೊಂದು": 11,
  "ಹನ್ನೆರಡು": 12, "ಹದಿಮೂರು": 13, "ಹದಿನಾಲ್ಕು": 14,
  "ಹದಿನೈದು": 15, "ಹದಿನಾರು": 16, "ಹದಿನೇಳು": 17,
  "ಹದಿನೆಂಟು": 18, "ಹತ್ತೊಂಬತ್ತು": 19, "ಇಪ್ಪತ್ತು": 20,

  // English
  "one": 1, "two": 2, "three": 3, "four": 4,
  "five": 5, "six": 6, "seven": 7, "eight": 8,
  "nine": 9, "ten": 10, "eleven": 11, "twelve": 12,
  "thirteen": 13, "fourteen": 14, "fifteen": 15,
  "sixteen": 16, "seventeen": 17, "eighteen": 18,
  "nineteen": 19, "twenty": 20, "thirty": 30,
  "forty": 40, "fifty": 50
};

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findNumber(text, units) {
  const unitPattern = units.map(escapeRegex).join("|");

  // Numeric values: 500 people, 100 మంది, 3 days
  const digitMatch = text.match(
    new RegExp("(\\d+)\\s*(?:" + unitPattern + ")", "i")
  );

  if (digitMatch) {
    return Number(digitMatch[1]);
  }

  // Spoken number words
  const words = Object.entries(numberWords).sort(
    (a, b) => b[0].length - a[0].length
  );

  for (const [word, number] of words) {
    const pattern = new RegExp(
      escapeRegex(word) + "\\s*(?:" + unitPattern + ")",
      "i"
    );

    if (pattern.test(text)) return number;
  }

  return null;
}

function detectComplaintDetails(text) {
  const lower = text.toLowerCase();
  const result = {};

  const categoryKeywords = [
    {
      category: "Water Supply",
      words: [
        "తాగునీటి", "నీటి సమస్య", "నీటి పైపు", "పైపు లీక్",
        "నీరు రావడం లేదు", "నీటి సరఫరా",
        "water supply", "water leakage", "pipeline",
        "drinking water", "पानी की समस्या", "पेयजल", "पानी",
        "വെള്ളം", "കുടിവെള്ളം", "ജലവിതരണം",
        "தண்ணீர்", "குடிநீர்", "நீர்",
        "ನೀರು", "ಕುಡಿಯುವ ನೀರು", "ನೀರಿನ ಸಮಸ್ಯೆ"
      ]
    },
    {
      category: "Road Damage",
      words: [
        "రోడ్డు", "రోడ్లు", "గుంతలు",
        "road damage", "damaged road", "pothole", "road",
        "सड़क", "गड्ढे", "റോഡ്", "കുഴികൾ",
        "சாலை", "சாலையில் பள்ளம்", "ರಸ್ತೆ", "ಗುಂಡಿ"
      ]
    },
    {
      category: "Drainage",
      words: [
        "డ్రైనేజీ", "డ్రైనేజ్", "మురుగు", "మురుగునీరు", "కాలువ",
        "drainage", "blocked drain", "sewage",
        "नाली", "नाला", "जल निकासी",
        "ഓട", "മാലിന്യജലം", "ഡ്രെയിനേജ്",
        "கழிவுநீர்", "சாக்கடை", "வடிகால்",
        "ಚರಂಡಿ", "ಕೊಳಚೆ ನೀರು"
      ]
    },
    {
      category: "Streetlight",
      words: [
        "వీధి దీపం", "వీధి లైట్", "స్ట్రీట్ లైట్",
        "streetlight", "street light", "light not working",
        "स्ट्रीट लाइट", "बत्ती", "തെരുവ് വിളക്ക്",
        "தெருவிளக்கு", "தெரு விளக்கு", "ಬೀದಿ ದೀಪ"
      ]
    },
    {
      category: "Garbage",
      words: [
        "చెత్త", "చెత్త పేరుకుపోయింది", "garbage", "waste",
        "rubbish", "कचरा", "कूड़ा", "മാലിന്യം", "ചവറ്",
        "குப்பை", "கழிவு", "ಕಸ", "ತ್ಯಾಜ್ಯ"
      ]
    },
    {
      category: "Sanitation",
      words: [
        "పారిశుధ్యం", "మరుగుదొడ్డి", "టాయిలెట్",
        "sanitation", "public toilet", "स्वच्छता", "शौचालय",
        "ശുചിത്വം", "കക്കൂസ്", "சுகாதாரம்", "கழிப்பறை",
        "ನೈರ್ಮಲ್ಯ", "ಶೌಚಾಲಯ"
      ]
    }
  ];

  for (const item of categoryKeywords) {
    if (item.words.some(word => lower.includes(word.toLowerCase()))) {
      result.category = item.category;
      break;
    }
  }

  // No upper limit on the people count
  const people = findNumber(text, [
    "మంది ప్రజలు", "మంది కుటుంబాలు", "మంది",
    "people", "persons", "person", "families",
    "लोग", "व्यक्ति", "परिवार",
    "പേർ", "ആളുകൾ", "കുടുംബങ്ങൾ",
    "பேர்", "மக்கள்", "குடும்பங்கள்",
    "ಜನರು", "ಮಂದಿ", "ಕುಟುಂಬಗಳು"
  ]);

  if (people !== null && people > 0) {
    result.people = String(people);
  }

  const duration = findNumber(text, [
    "రోజుల నుంచి", "రోజులుగా", "రోజులు", "రోజు",
    "days", "day", "दिनों से", "दिनों", "दिन",
    "ദിവസമായി", "ദിവസം", "ദിവസങ്ങളായി",
    "நாட்களாக", "நாட்கள்", "நாள்",
    "ದಿನಗಳಿಂದ", "ದಿನಗಳು", "ದಿನ"
  ]);

  if (duration !== null && duration > 0) {
    result.duration = String(duration);
  }

  return result;
}

async function apiRequest(path, options = {}, token = "") {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Something went wrong.");
  }

  return data;
}

export default function App() {
  const [token, setToken] = useState(
    () => localStorage.getItem("gramfix_token") || ""
  );

  const [user, setUser] = useState(null);
  const [authPage, setAuthPage] = useState("login");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    mobile: "",
    password: "",
    confirmPassword: "",
    role: "Citizen",
    identifier: ""
  });

  const [complaints, setComplaints] = useState([]);

  const [form, setForm] = useState({
    name: "",
    description: "",
    location: "",
    category: "Auto Detect",
    people: "10",
    duration: "1"
  });

  const [language, setLanguage] = useState("te-IN");
  const [voiceStatus, setVoiceStatus] = useState("");

  const recognitionRef = useRef(null);
  const stoppingRef = useRef(false);

  const isStaff = user?.role === "Panchayat Staff";

  useEffect(() => {
    async function restoreSession() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const data = await apiRequest("/auth/me", {}, token);
        setUser(data.user);
        setForm(previous => ({
          ...previous,
          name: data.user.name
        }));
      } catch {
        localStorage.removeItem("gramfix_token");
        setToken("");
      } finally {
        setLoading(false);
      }
    }

    restoreSession();
  }, []);

  useEffect(() => {
    if (!token || !user) return;

    loadComplaints();

    const interval = setInterval(loadComplaints, 10000);
    return () => clearInterval(interval);
  }, [token, user]);

  async function loadComplaints() {
    try {
      const data = await apiRequest("/complaints", {}, token);
      setComplaints(Array.isArray(data) ? data : []);
    } catch (error) {
      setMessage(error.message);
    }
  }

  function updateAuth(field, value) {
    setAuthForm(previous => ({ ...previous, [field]: value }));
  }

  function updateForm(field, value) {
    setForm(previous => ({ ...previous, [field]: value }));
  }

  function saveSession(data) {
    localStorage.setItem("gramfix_token", data.token);
    setToken(data.token);
    setUser(data.user);
    setForm(previous => ({ ...previous, name: data.user.name }));
    setMessage("");
  }

  async function handleSignup(event) {
    event.preventDefault();
    setMessage("");

    if (authForm.password !== authForm.confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    try {
      const data = await apiRequest("/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          name: authForm.name,
          email: authForm.email,
          mobile: authForm.mobile,
          password: authForm.password,
          role: authForm.role
        })
      });

      saveSession(data);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    setMessage("");

    try {
      const data = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          identifier: authForm.identifier,
          password: authForm.password
        })
      });

      saveSession(data);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleLogout() {
    if (recognitionRef.current) {
      stoppingRef.current = true;
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }

    try {
      await apiRequest("/auth/logout", { method: "POST" }, token);
    } catch {}

    localStorage.removeItem("gramfix_token");
    setToken("");
    setUser(null);
    setComplaints([]);
    setMessage("");
    setVoiceStatus("");
    setAuthPage("login");
  }

  // Voice Assistant
  function startVoiceInput() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceStatus("Voice input is not supported. Please use Chrome.");
      return;
    }

    if (recognitionRef.current) {
      setVoiceStatus("Voice input is already running.");
      return;
    }

    const recognition = new SpeechRecognition();

    stoppingRef.current = false;
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setVoiceStatus("Listening... Speak now.");
    };

    recognition.onresult = event => {
      if (
        stoppingRef.current ||
        recognitionRef.current !== recognition
      ) return;

      let transcript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript;
        }
      }

      transcript = transcript.trim();
      if (!transcript) return;

      setForm(previous => {
        const description = previous.description
          ? previous.description + " " + transcript
          : transcript;

        const detected = detectComplaintDetails(description);

        return {
          ...previous,
          description,
          category: detected.category || previous.category,
          people: detected.people || previous.people,
          duration: detected.duration || previous.duration
        };
      });

      setVoiceStatus("Speech detected. Details updated.");
    };

    recognition.onerror = event => {
      if (event.error !== "aborted") {
        setVoiceStatus("Voice error: " + event.error);
      }
    };

    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
        stoppingRef.current = false;
        setVoiceStatus("Voice input stopped.");
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setVoiceStatus("Unable to start voice input.");
    }
  }

  function stopVoiceInput() {
    const recognition = recognitionRef.current;

    if (!recognition) {
      setVoiceStatus("Voice input is already stopped.");
      return;
    }

    stoppingRef.current = true;
    recognition.stop();
    setVoiceStatus("Stopping voice input...");
  }

  async function submitComplaint(event) {
    event.preventDefault();
    setMessage("");

    try {
      await apiRequest("/complaints", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          people: Number(form.people),
          duration: Number(form.duration)
        })
      }, token);

      setForm({
        name: user.name,
        description: "",
        location: "",
        category: "Auto Detect",
        people: "10",
        duration: "1"
      });

      setMessage("Complaint submitted successfully!");
      await loadComplaints();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function updateStatus(id, status) {
    try {
      await apiRequest(`/complaints/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      }, token);

      setMessage("Complaint status updated.");
      await loadComplaints();
    } catch (error) {
      setMessage(error.message);
    }
  }

  if (loading) {
    return <div className="loading-screen">Loading GRAMFIX AI...</div>;
  }

  // Sign In and Sign Up
  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="brand">
            <div className="brand-icon">G</div>
            <h1>GRAMFIX AI</h1>
            <p>Rural Issue Intelligence & Resolution</p>
          </div>

          <div className="auth-tabs">
            <button
              className={authPage === "login" ? "active" : ""}
              onClick={() => {
                setAuthPage("login");
                setMessage("");
              }}
            >
              Sign In
            </button>

            <button
              className={authPage === "signup" ? "active" : ""}
              onClick={() => {
                setAuthPage("signup");
                setMessage("");
              }}
            >
              Sign Up
            </button>
          </div>

          {authPage === "login" ? (
            <form onSubmit={handleLogin}>
              <h2>Welcome Back!</h2>

              <label>Email or Mobile Number</label>
              <input
                required
                value={authForm.identifier}
                onChange={e => updateAuth("identifier", e.target.value)}
                placeholder="Enter email or mobile number"
              />

              <label>Password</label>
              <input
                required
                type="password"
                value={authForm.password}
                onChange={e => updateAuth("password", e.target.value)}
                placeholder="Enter password"
              />

              <button className="primary-button" type="submit">
                Sign In
              </button>

              <p className="switch-text">
                Don't have an account?{" "}
                <button type="button" onClick={() => setAuthPage("signup")}>
                  Create Account
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleSignup}>
              <h2>Create Account</h2>

              <label>Full Name</label>
              <input
                required
                value={authForm.name}
                onChange={e => updateAuth("name", e.target.value)}
                placeholder="Enter full name"
              />

              <label>Email Address</label>
              <input
                required
                type="email"
                value={authForm.email}
                onChange={e => updateAuth("email", e.target.value)}
                placeholder="Enter email"
              />

              <label>Mobile Number (optional)</label>
              <input
                value={authForm.mobile}
                onChange={e => updateAuth("mobile", e.target.value)}
                placeholder="Enter mobile number"
              />

              <label>Account Type</label>
              <select
                value={authForm.role}
                onChange={e => updateAuth("role", e.target.value)}
              >
                <option value="Citizen">Citizen</option>
                <option value="Panchayat Staff">Panchayat Staff</option>
              </select>

              <label>Password (minimum 8 characters)</label>
              <input
                required
                minLength="8"
                type="password"
                value={authForm.password}
                onChange={e => updateAuth("password", e.target.value)}
                placeholder="Create password"
              />

              <label>Confirm Password</label>
              <input
                required
                type="password"
                value={authForm.confirmPassword}
                onChange={e => updateAuth("confirmPassword", e.target.value)}
                placeholder="Confirm password"
              />

              <button className="primary-button" type="submit">
                Create Account
              </button>

              <p className="switch-text">
                Already registered?{" "}
                <button type="button" onClick={() => setAuthPage("login")}>
                  Sign In
                </button>
              </p>
            </form>
          )}

          {message && <div className="message">{message}</div>}

          <div className="auth-footer">
            GRAMFIX AI · Building Better Villages
          </div>
        </div>
      </div>
    );
  }

  const total = complaints.length;

  const resolved = complaints.filter(
    item => item.status === "Resolved"
  ).length;

  const highPriority = complaints.filter(
    item => item.priority === "High" && item.status !== "Resolved"
  ).length;

  return (
    <div className="app">
      <header className="top-header">
        <div>
          <h1>GRAMFIX AI</h1>
          <p>Rural Issue Intelligence & Resolution Monitoring</p>
        </div>

        <div className="user-info">
          <div>
            <strong>{user.name}</strong>
            <span>{user.role}</span>
          </div>
          <button className="logout-button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard">
        <section className="welcome-banner">
          <h2>
            {isStaff ? "Panchayat Dashboard" : "A Better Village Starts With You"}
          </h2>
          <p>
            {isStaff
              ? "Monitor and manage village complaints."
              : "Report local problems and help make your village better."}
          </p>
        </section>

        <section className="stats-grid">
          <div className="stat-card">
            <span>Total Complaints</span>
            <strong>{total}</strong>
          </div>
          <div className="stat-card">
            <span>High Priority Open</span>
            <strong>{highPriority}</strong>
          </div>
          <div className="stat-card">
            <span>Resolved</span>
            <strong>{resolved}</strong>
          </div>
        </section>

        {!isStaff && (
          <section className="panel">
            <h2>Submit a Village Complaint</h2>
            <p className="form-subtitle">
              Type your complaint or use the Voice Assistant.
            </p>

            <form onSubmit={submitComplaint} className="complaint-form">
              <label>Your Name</label>
              <input
                required
                value={form.name}
                onChange={e => updateForm("name", e.target.value)}
                placeholder="Enter your name"
              />

              <label>Village / Location</label>
              <input
                required
                value={form.location}
                onChange={e => updateForm("location", e.target.value)}
                placeholder="Enter village or area"
              />

              <label>Voice Language</label>
              <select
                value={language}
                onChange={e => setLanguage(e.target.value)}
                disabled={!!recognitionRef.current}
              >
                {languages.map(item => (
                  <option key={item.code} value={item.code}>
                    {item.name}
                  </option>
                ))}
              </select>

              <label>Complaint Description</label>
              <textarea
                required
                rows="4"
                value={form.description}
                onChange={e => updateForm("description", e.target.value)}
                placeholder="Describe your village problem..."
              />

              <div className="voice-controls">
                <button
                  type="button"
                  onClick={startVoiceInput}
                  disabled={!!recognitionRef.current}
                >
                  🎤 Start Voice Input
                </button>

                <button
                  type="button"
                  onClick={stopVoiceInput}
                  disabled={!recognitionRef.current}
                >
                  Stop
                </button>

                <span>{voiceStatus}</span>
              </div>

              <label>Complaint Category</label>
              <select
                value={form.category}
                onChange={e => updateForm("category", e.target.value)}
              >
                {categories.map(item => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>

              <div className="two-columns">
                <div>
                  <label>People Affected</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.people}
                    onChange={e => updateForm("people", e.target.value)}
                  />
                </div>

                <div>
                  <label>Problem Duration (days)</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.duration}
                    onChange={e => updateForm("duration", e.target.value)}
                  />
                </div>
              </div>

              <button className="primary-button" type="submit">
                Submit Complaint
              </button>
            </form>
          </section>
        )}

        <section className="panel">
          <h2>
            {isStaff ? "All Village Complaints" : "My Recent Complaints"}
          </h2>

          {complaints.length === 0 ? (
            <p className="empty-state">No complaints found.</p>
          ) : (
            <div className="complaint-list">
              {complaints.map(complaint => (
                <article className="complaint-card" key={complaint.id}>
                  <div className="complaint-heading">
                    <h3>{complaint.category}</h3>
                    <span className="priority">
                      {complaint.priority} Priority
                    </span>
                  </div>

                  <p>{complaint.description}</p>

                  <div className="complaint-details">
                    <span>📍 {complaint.location}</span>
                    <span>👥 {complaint.people} people affected</span>
                    <span>📅 {complaint.duration} days</span>
                  </div>

                  {isStaff && (
                    <p>Reported by: {complaint.name}</p>
                  )}

                  {complaint.repeat_alert && (
                    <p className="repeat-alert">
                      Possible duplicate complaint detected.
                    </p>
                  )}

                  <div className="status-row">
                    <strong>Status: {complaint.status}</strong>

                    {isStaff && (
                      <select
                        value={complaint.status}
                        onChange={e =>
                          updateStatus(complaint.id, e.target.value)
                        }
                      >
                        <option>Received</option>
                        <option>Under Review</option>
                        <option>Assigned</option>
                        <option>Resolved</option>
                      </select>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {message && <div className="message">{message}</div>}
      </main>

      <footer className="app-footer">
        GRAMFIX AI · AI-assisted rural issue intelligence · Hackathon Prototype
      </footer>
    </div>
  );
}
