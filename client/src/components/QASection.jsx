import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { ArrowRight, HelpCircle } from 'lucide-react';
import QuestionCard from './QuestionCard';

const QASection = () => {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const response = await axios.get('/api/questions?limit=6');
        if (response.data.success) {
          setQuestions(response.data.questions);
        }
      } catch (error) {
        console.error("Failed to load Q&A", error);
      } finally {
        setLoading(false);
      }
    };
    fetchQuestions();
  }, []);

  return (
    <section className="py-16 bg-gradient-to-b from-white to-gray-50">
      <div className="container">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <HelpCircle className="text-primary" size={32} />
              Free Expert Q&A
            </h2>
            <p className="text-gray-500 mt-2 text-lg">Ask health questions and get answers from verified doctors.</p>
          </div>
          <Link to="/questions" className="text-primary font-bold hover:underline flex items-center gap-1 shrink-0">
            Explore all <ArrowRight size={18} />
          </Link>
        </div>

        {loading ? (
          <div className="flex gap-6 overflow-x-auto pb-4 snap-x">
            {[1, 2, 3].map(i => (
              <div key={i} className="min-w-[300px] md:min-w-[350px] h-[250px] bg-gray-100 animate-pulse rounded-xl shrink-0 snap-start"></div>
            ))}
          </div>
        ) : questions.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
            <p className="text-gray-500">No questions have been posted yet.</p>
          </div>
        ) : (
          <div className="flex gap-6 overflow-x-auto pb-8 snap-x hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
            {questions.map((q) => (
              <div key={q._id} className="w-[85vw] sm:w-[350px] shrink-0 snap-start">
                <QuestionCard question={q} />
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 text-center bg-white p-8 rounded-2xl shadow-sm border border-primary/10">
          <h3 className="text-xl font-bold text-gray-900 mb-2">Got a health question?</h3>
          <p className="text-gray-500 mb-6">Ask anonymously and get reliable answers from our verified medical experts.</p>
          <Link to="/questions/ask" className="btn btn-primary px-8 py-3 rounded-full font-bold shadow-md hover:shadow-lg transition-all inline-flex items-center gap-2">
            Ask a Question <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default QASection;
