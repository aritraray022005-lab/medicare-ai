import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Send, AlertTriangle } from 'lucide-react';

const AskQuestion = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: ''
  });

  const categories = [
    "General Health", "Skin", "Heart", "Mental Health", "Digestive Health", 
    "Child Health", "Women's Health", "ENT", "Eye", "Dental", "Other"
  ];

  // Verify authentication before rendering
  useEffect(() => {
    const checkAuth = async () => {
      try {
        await axios.get('/api/patients/profile', { withCredentials: true });
      } catch (err) {
        navigate('/login');
      }
    };
    checkAuth();
  }, [navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.description || !formData.category) {
      setError('Please fill out all fields.');
      return;
    }
    
    if (formData.title.length < 10) {
      setError('Question title must be at least 10 characters.');
      return;
    }

    if (formData.description.length < 20) {
      setError('Please provide more details in the description (at least 20 characters).');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await axios.post('/api/questions', formData, { withCredentials: true });
      if (response.data.success) {
        alert('Your question has been posted successfully.');
        navigate(`/questions/${response.data.question._id}`);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to post question. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container max-w-2xl mx-auto">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Ask a Question</h1>
          <p className="text-gray-500 mb-8">Your question will be posted anonymously and answered by verified doctors.</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm flex items-start gap-2">
                <AlertTriangle size={20} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="input-group">
              <label className="font-bold text-gray-700 mb-2 block">Question Summary</label>
              <input 
                type="text" 
                name="title"
                className="input-field bg-gray-50 focus:bg-white" 
                placeholder="e.g. What are the common reasons for frequent headaches?"
                value={formData.title}
                onChange={handleChange}
                maxLength={150}
                required 
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{formData.title.length}/150</p>
            </div>

            <div className="input-group">
              <label className="font-bold text-gray-700 mb-2 block">Detailed Description</label>
              <textarea 
                name="description"
                className="input-field min-h-[150px] resize-y bg-gray-50 focus:bg-white" 
                placeholder="Include how long you've had symptoms, your age, and any other relevant details..."
                value={formData.description}
                onChange={handleChange}
                maxLength={2000}
                required 
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{formData.description.length}/2000</p>
            </div>

            <div className="input-group">
              <label className="font-bold text-gray-700 mb-2 block">Category</label>
              <select 
                name="category"
                className="input-field bg-gray-50 focus:bg-white cursor-pointer"
                value={formData.category}
                onChange={handleChange}
                required
              >
                <option value="" disabled>Select a relevant category</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="btn btn-primary py-4 rounded-xl font-bold text-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 mt-4"
            >
              {loading ? 'Posting...' : <>Post Question <Send size={20} /></>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AskQuestion;
