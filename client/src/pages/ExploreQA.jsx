import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Search, Filter, Plus } from 'lucide-react';
import QuestionCard from '../components/QuestionCard';

const ExploreQA = () => {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  
  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (category) params.append('category', category);
      if (status) params.append('status', status);
      
      const response = await axios.get(`/api/questions?${params.toString()}`);
      if (response.data.success) {
        setQuestions(response.data.questions);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, [search, category, status]);

  const categories = [
    "General Health", "Skin", "Heart", "Mental Health", "Digestive Health", 
    "Child Health", "Women's Health", "ENT", "Eye", "Dental", "Other"
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container max-w-6xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Explore Q&A</h1>
            <p className="text-gray-500 mt-1">Find answers to common health questions from verified doctors.</p>
          </div>
          <Link to="/questions/ask" className="btn btn-primary flex items-center gap-2 rounded-full px-6 shadow-md hover:shadow-lg transition-all shrink-0">
            <Plus size={18} /> Ask a Question
          </Link>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-8 flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Search questions..." 
              className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors bg-gray-50"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <div className="flex gap-4">
            <div className="relative shrink-0">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <select 
                className="pl-10 pr-8 py-3 rounded-lg border border-gray-200 focus:outline-none focus:border-primary bg-gray-50 appearance-none font-medium text-gray-700"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">All Categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            
            <select 
              className="px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:border-primary bg-gray-50 font-medium text-gray-700"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="Answered">Answered</option>
              <option value="Open">Waiting for Answer</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-64 bg-gray-200 animate-pulse rounded-xl"></div>
            ))}
          </div>
        ) : questions.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-gray-100 shadow-sm">
            <HelpCircle size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-xl font-bold text-gray-700 mb-2">No questions found</h3>
            <p className="text-gray-500">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {questions.map((q) => (
              <div key={q._id}>
                <QuestionCard question={q} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// HelpCircle import missing above, adding mock
const HelpCircle = ({size, className}) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>;

export default ExploreQA;
