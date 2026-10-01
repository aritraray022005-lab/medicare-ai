import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Activity, AlertTriangle, Info, Calendar, ChevronRight, Stethoscope, Sparkles,
  Clock, User, RotateCcw, CheckCircle2, Siren, HeartPulse, ShieldCheck, Phone,
} from 'lucide-react';

const MAX_LEN = 600;
const QUICK_SYMPTOMS = ['Headache', 'Fever', 'Cough', 'Sore throat', 'Stomach pain', 'Nausea', 'Fatigue', 'Back pain', 'Dizziness', 'Rash'];
const DURATIONS = ['Few hours', '1-2 days', '3-7 days', '1-2 weeks', 'Over 2 weeks'];

const TRIAGE = {
  emergency: { cls: 'emergency', label: 'Emergency', icon: Siren, text: 'Seek emergency care right away.' },
  'urgent-care': { cls: 'urgent', label: 'Urgent care', icon: AlertTriangle, text: 'Get medical attention within the next few hours.' },
  'consult-doctor': { cls: 'consult', label: 'Consult a doctor', icon: Stethoscope, text: 'Book a visit with a doctor in the next few days.' },
  'self-care': { cls: 'selfcare', label: 'Self-care', icon: HeartPulse, text: 'Home care is likely enough. Monitor how you feel.' },
};

const SymptomChecker = () => {
  const navigate = useNavigate();
  const resultRef = useRef(null);
  const [formData, setFormData] = useState({ symptoms: '', age: '', duration: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  // Pre-fill age from the patient's profile (route access is guarded in App.jsx)
  useEffect(() => {
    let cancelled = false;
    axios.get('/api/patients/profile', { withCredentials: true })
      .then((res) => {
        const age = res.data?.user?.age;
        if (!cancelled && age) setFormData((prev) => (prev.age ? prev : { ...prev, age: String(age) }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // On small screens, bring the result into view once it arrives
  useEffect(() => {
    if ((result || loading) && window.innerWidth < 1024) {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [result, loading]);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const addSymptom = (s) => {
    const has = formData.symptoms.toLowerCase().includes(s.toLowerCase());
    if (has) return;
    const base = formData.symptoms.trim();
    const next = base ? `${base.replace(/[.,]$/, '')}, ${s.toLowerCase()}` : s;
    setFormData({ ...formData, symptoms: next.slice(0, MAX_LEN) });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.symptoms.trim() || !formData.age || !formData.duration.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    const ageNum = parseInt(formData.age, 10);
    if (Number.isNaN(ageNum) || ageNum < 0 || ageNum > 120) {
      setError('Please enter a valid age between 0 and 120.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await axios.post('/api/ai/symptom-check', formData, { withCredentials: true });
      if (response.data.success) {
        setResult(response.data.data);
      } else {
        setError(response.data.message || 'Failed to analyze symptoms.');
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'A network error occurred while communicating with the AI.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError('');
    setFormData((p) => ({ ...p, symptoms: '', duration: '' }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBookDoctor = () => {
    navigate('/dashboard', {
      state: { activeTab: 'appointments', appointmentView: 'book', recommendedSpecialty: result?.recommendedSpecialty },
    });
  };

  const triage = result ? (TRIAGE[result.triageLevel?.toLowerCase()] || { cls: 'unknown', label: result.triageLevel || 'Unknown', icon: Activity, text: '' }) : null;
  const TriageIcon = triage?.icon;

  return (
    <div className="sc-page">
      <div className="container py-8 md:py-12 animate-fade-in">
        {/* Header */}
        <header className="text-center mb-8 md:mb-10 max-w-2xl mx-auto">
          <span className="pill mb-4"><Sparkles size={15} /> AI-powered triage</span>
          <h1 className="display text-3xl sm:text-4xl md:text-5xl">Symptom Checker</h1>
          <p className="text-muted mt-3 text-base md:text-lg">
            Tell us how you feel and get informational guidance on urgency, likely causes and which specialist to see.
          </p>
        </header>

        <div className={`sc-grid ${result || loading ? 'has-result' : ''}`}>
          {/* ---------- Form ---------- */}
          <div className={result || loading ? 'sc-sticky' : ''}>
            <form onSubmit={handleSubmit} className="sc-card flex flex-col gap-5" noValidate>
              {error && (
                <div role="alert" className="bg-red-50 border border-red-100 text-red-700 p-3 rounded-xl text-sm flex items-start gap-2">
                  <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label htmlFor="symptoms" className="input-label">What are you feeling?</label>
                <textarea
                  id="symptoms"
                  name="symptoms"
                  className="input-field mt-1.5 min-h-[130px] resize-y"
                  placeholder="e.g. Throbbing headache on the right side with sensitivity to light since this morning…"
                  value={formData.symptoms}
                  onChange={handleChange}
                  maxLength={MAX_LEN}
                  required
                />
                <div className="flex items-start justify-between gap-3 mt-2">
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick add symptoms">
                    {QUICK_SYMPTOMS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="sc-chip"
                        aria-pressed={formData.symptoms.toLowerCase().includes(s.toLowerCase())}
                        onClick={() => addSymptom(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <span className="char-count shrink-0">{formData.symptoms.length}/{MAX_LEN}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="age" className="input-label">Age</label>
                  <div className="input-wrap mt-1.5">
                    <span className="input-icon" aria-hidden="true"><User size={18} /></span>
                    <input
                      id="age"
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max="120"
                      name="age"
                      className="input-field input-with-icon"
                      placeholder="e.g. 35"
                      value={formData.age}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="duration" className="input-label">How long?</label>
                  <div className="input-wrap mt-1.5">
                    <span className="input-icon" aria-hidden="true"><Clock size={18} /></span>
                    <input
                      id="duration"
                      type="text"
                      name="duration"
                      className="input-field input-with-icon"
                      placeholder="e.g. 2 days"
                      value={formData.duration}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 -mt-2" role="group" aria-label="Quick duration">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className="sc-chip"
                    aria-pressed={formData.duration === d}
                    onClick={() => setFormData({ ...formData, duration: d })}
                  >
                    {d}
                  </button>
                ))}
              </div>

              <button type="submit" disabled={loading} className="btn btn-primary btn-lg w-full">
                {loading ? (<><Activity className="animate-spin" size={20} /> Analyzing your symptoms…</>) : (<>Check symptoms <ChevronRight size={20} /></>)}
              </button>

              <p className="text-xs text-muted flex items-start gap-2">
                <ShieldCheck size={15} className="shrink-0 mt-0.5 text-primary" />
                Your answers are used only to generate this guidance. This is not a medical diagnosis.
              </p>
            </form>

            {/* Emergency strip */}
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-800">
              <Phone size={18} className="shrink-0 mt-0.5" />
              <p><b>Chest pain, trouble breathing, severe bleeding or sudden weakness?</b> Skip the checker and call your local emergency number now.</p>
            </div>
          </div>

          {/* ---------- Result column ---------- */}
          {(loading || result) && (
            <div ref={resultRef} className="scroll-mt-24">
              {loading && !result && (
                <div className="sc-card" aria-busy="true" aria-live="polite">
                  <div className="sc-skeleton h-16 mb-5" />
                  <div className="sc-skeleton h-5 w-1/3 mb-3" />
                  <div className="sc-skeleton h-24 mb-5" />
                  <div className="sc-skeleton h-5 w-1/3 mb-3" />
                  <div className="sc-skeleton h-20 mb-3" />
                  <div className="sc-skeleton h-20" />
                  <p className="text-center text-sm text-muted mt-5">Reviewing your symptoms…</p>
                </div>
              )}

              {result && (
                <div className="sc-card animate-fade-in">
                  <div className="flex items-center justify-between gap-3 mb-5">
                    <h2 className="text-2xl">Your analysis</h2>
                    <button type="button" onClick={reset} className="btn btn-outline" style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem' }}>
                      <RotateCcw size={15} /> New check
                    </button>
                  </div>

                  {/* Triage */}
                  <div className={`sc-triage ${triage.cls} mb-4`} role={triage.cls === 'emergency' ? 'alert' : 'status'}>
                    <TriageIcon size={26} className="shrink-0" />
                    <div>
                      <p className="font-bold text-lg leading-tight">{triage.label}</p>
                      {triage.text && <p className="text-sm mt-0.5 opacity-90">{triage.text}</p>}
                    </div>
                  </div>

                  {result.recommendedSpecialty && (
                    <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-teal-50 border border-teal-100 text-teal-900 font-semibold text-sm mb-6" style={{ background: '#ecfaf8', borderColor: '#c8ede8', color: '#0a5551' }}>
                      <Stethoscope size={18} /> Suggested specialty: {result.recommendedSpecialty}
                    </div>
                  )}

                  {/* Red flags first when present */}
                  {result.redFlags?.length > 0 && (
                    <div className="mb-6 bg-red-50 border border-red-200 p-4 sm:p-5 rounded-2xl">
                      <h3 className="text-red-800 font-bold mb-2 flex items-center gap-2 text-base" style={{ fontFamily: 'var(--font-sans)' }}>
                        <AlertTriangle size={19} /> Seek help immediately if you notice
                      </h3>
                      <ul className="space-y-1.5 text-red-700 text-sm font-medium">
                        {result.redFlags.map((item, idx) => (
                          <li key={idx} className="flex gap-2"><span aria-hidden="true">•</span><span>{item}</span></li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.summary && (
                    <div className="mb-6">
                      <h3 className="sc-section-title">Summary</h3>
                      <p className="text-gray-800 bg-slate-50 p-4 rounded-xl leading-relaxed" style={{ background: '#f6fbfa' }}>{result.summary}</p>
                    </div>
                  )}

                  {result.possibleCauses?.length > 0 && (
                    <div className="mb-6">
                      <h3 className="sc-section-title">Possible causes</h3>
                      <ol className="flex flex-col gap-3">
                        {result.possibleCauses.map((cause, idx) => (
                          <li key={idx} className="flex gap-3 border border-slate-200 p-4 rounded-xl bg-white">
                            <span className="shrink-0 grid place-items-center w-7 h-7 rounded-full text-xs font-bold" style={{ background: '#d3f3ee', color: '#0b6e68' }}>{idx + 1}</span>
                            <div className="min-w-0">
                              <p className="font-bold text-gray-900">{cause.name}</p>
                              <p className="text-sm text-gray-600 mt-0.5">{cause.reason}</p>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {result.selfCare?.length > 0 && (
                    <div className="mb-6">
                      <h3 className="sc-section-title">Self-care &amp; guidance</h3>
                      <ul className="space-y-2">
                        {result.selfCare.map((item, idx) => (
                          <li key={idx} className="flex gap-2.5 text-gray-700 text-sm">
                            <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-primary" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.recommendDoctor && (
                    <div className="mt-8 border-t border-slate-100 pt-6">
                      <button onClick={handleBookDoctor} className="btn btn-primary btn-lg w-full">
                        <Calendar size={20} /> Book a doctor now
                      </button>
                      <p className="text-center text-sm text-muted mt-2">
                        Connects you to available {result.recommendedSpecialty || 'doctors'}
                      </p>
                    </div>
                  )}

                  <div className="mt-6 bg-slate-50 p-4 rounded-xl flex gap-3 text-xs text-gray-500 border border-slate-200">
                    <Info size={16} className="shrink-0 text-gray-400 mt-0.5" />
                    <p>{result.disclaimer || 'This tool provides informational guidance and is not a medical diagnosis. If you are experiencing a medical emergency, contact your local emergency service immediately.'}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SymptomChecker;
