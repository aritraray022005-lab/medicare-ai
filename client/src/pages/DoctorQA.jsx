import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { MessageSquare, AlertTriangle, CheckCircle } from 'lucide-react';

const DoctorQA = () => {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [answerInputs, setAnswerInputs] = useState({});
  const [submittingId, setSubmittingId] = useState(null);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        // Fetch only open questions
        const response = await axios.get('/api/questions?status=Open&limit=50', { withCredentials: true });
        if (response.data.success) {
          setQuestions(response.data.questions);
        }
      } catch (err) {
        setError('Failed to load questions. You might not be authorized.');
      } finally {
        setLoading(false);
      }
    };
    fetchQuestions();
  }, []);

  const handleAnswerChange = (qId, value) => {
    setAnswerInputs(prev => ({ ...prev, [qId]: value }));
  };

  const submitAnswer = async (qId) => {
    const answerText = answerInputs[qId];
    if (!answerText || answerText.length < 10) {
      alert("Answer must be at least 10 characters long.");
      return;
    }

    setSubmittingId(qId);
    try {
      const response = await axios.post(`/api/questions/${qId}/answers`, { answer: answerText }, { withCredentials: true });
      if (response.data.success) {
        alert("Answer submitted successfully!");
        setQuestions(prev => prev.filter(q => q._id !== qId)); // Remove answered question from list
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to submit answer.");
    } finally {
      setSubmittingId(null);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500 font-bold">Loading questions...</div>;
  if (error) return <div className="p-8 text-center text-red-500 font-bold">{error}</div>;

  return (
    <div className="container py-8 max-w-5xl">
      <div className="flex items-center gap-3 mb-8 pb-4 border-b border-gray-100">
        <MessageSquare className="text-primary" size={32} />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Patient Questions</h1>
          <p className="text-gray-500">Provide medical guidance to patients waiting for answers.</p>
        </div>
      </div>

      {questions.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 p-12 text-center rounded-2xl">
          <CheckCircle className="mx-auto text-green-500 mb-4" size={48} />
          <h2 className="text-xl font-bold text-gray-800 mb-2">You're all caught up!</h2>
          <p className="text-gray-500">There are no open questions waiting for answers right now.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {questions.map((q) => (
            <div key={q._id} className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 overflow-hidden">
              <div className="flex justify-between items-start mb-4">
                <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">{q.category}</span>
                <span className="text-xs text-gray-400">{new Date(q.createdAt).toLocaleString()}</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{q.title}</h3>
              <p className="text-gray-700 mb-6 bg-gray-50 p-4 rounded-xl text-sm leading-relaxed whitespace-pre-wrap">{q.description}</p>
              
              <div className="border-t border-gray-100 pt-6">
                <label className="block text-sm font-bold text-gray-700 mb-2">Your Answer</label>
                <textarea 
                  className="input-field min-h-[120px] resize-y mb-3 bg-gray-50 focus:bg-white"
                  placeholder="Write your professional guidance here..."
                  value={answerInputs[q._id] || ''}
                  onChange={(e) => handleAnswerChange(q._id, e.target.value)}
                />
                <div className="flex justify-end">
                  <button 
                    onClick={() => submitAnswer(q._id)}
                    disabled={submittingId === q._id}
                    className="btn btn-primary px-6 py-2 rounded-lg font-bold shadow-sm"
                  >
                    {submittingId === q._id ? 'Submitting...' : 'Submit Answer'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DoctorQA;
