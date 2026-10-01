import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, User, CheckCircle, Clock } from 'lucide-react';

const QuestionDetails = () => {
  const { id } = useParams();
  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const response = await axios.get(`/api/questions/${id}`);
        if (response.data.success) {
          setQuestion(response.data.question);
        }
      } catch (err) {
        setError('Failed to load question details.');
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [id]);

  if (loading) {
    return <div className="container py-20 text-center"><div className="animate-pulse flex flex-col items-center"><div className="h-8 bg-gray-200 w-1/3 rounded mb-4"></div><div className="h-32 bg-gray-200 w-2/3 rounded"></div></div></div>;
  }

  if (error || !question) {
    return <div className="container py-20 text-center text-red-500 font-bold">{error || 'Question not found.'}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container max-w-4xl mx-auto">
        <Link to="/questions" className="inline-flex items-center gap-2 text-gray-500 hover:text-primary mb-6 transition-colors">
          <ArrowLeft size={20} /> Back to questions
        </Link>

        {/* Question Section */}
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 font-bold text-lg uppercase shrink-0 overflow-hidden">
              {question.patient?.name ? question.patient.name.charAt(0) : <User size={24} />}
            </div>
            <div>
              <p className="font-bold text-gray-900">{question.patient?.name || 'Patient'}</p>
              <p className="text-sm text-gray-400 flex items-center gap-1">
                <Clock size={14} /> {new Date(question.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="ml-auto">
              <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">{question.category}</span>
            </div>
          </div>
          
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">{question.title}</h1>
          <p className="text-gray-700 whitespace-pre-wrap text-lg leading-relaxed">{question.description}</p>
        </div>

        {/* Answers Section */}
        <div className="mb-12">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            Answers ({question.answers?.length || 0})
          </h2>

          {!question.answers || question.answers.length === 0 ? (
            <div className="bg-orange-50 border border-orange-100 p-8 rounded-2xl text-center">
              <p className="text-orange-800 font-medium text-lg mb-2">Waiting for an expert's response</p>
              <p className="text-orange-600/80">Our verified doctors will answer this question soon.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {question.answers.map((ans) => (
                <div key={ans._id} className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-blue-100 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
                  
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
                    <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center text-primary shrink-0 overflow-hidden">
                      {ans.doctor?.profilePicture ? (
                        <img src={ans.doctor.profilePicture} alt={ans.doctor.name} className="w-full h-full object-cover" />
                      ) : (
                        <User size={28} />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-900 text-lg">{ans.doctor?.name}</p>
                        {ans.doctor?.isVerifiedByAdmin && (
                          <CheckCircle className="text-primary" size={18} title="Verified Doctor" />
                        )}
                      </div>
                      <p className="text-sm text-primary font-medium">{ans.doctor?.specialization}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{ans.doctor?.experience} Years Experience</p>
                    </div>
                    <div className="sm:ml-auto text-xs text-gray-400 flex items-center gap-1 mt-2 sm:mt-0">
                      <Clock size={14} /> {new Date(ans.createdAt).toLocaleString()}
                    </div>
                  </div>
                  
                  <div className="text-gray-700 whitespace-pre-wrap leading-relaxed text-lg bg-gray-50 p-5 rounded-xl border border-gray-100">
                    {ans.answer}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuestionDetails;
