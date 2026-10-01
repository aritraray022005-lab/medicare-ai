import React from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Eye, Share2, User } from 'lucide-react';

const QuestionCard = ({ question }) => {
  const isAnswered = question.status === 'Answered';
  
  const handleShare = (e) => {
    e.preventDefault();
    if (navigator.share) {
      navigator.share({
        title: question.title,
        url: `/questions/${question._id}`
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(`${window.location.origin}/questions/${question._id}`);
      alert('Question link copied to clipboard!');
    }
  };

  const getDoctorImages = () => {
    if (!question.answers || question.answers.length === 0) return null;
    const uniqueDoctors = [];
    const seenIds = new Set();
    question.answers.forEach(ans => {
      if (ans.doctor && !seenIds.has(ans.doctor._id)) {
        seenIds.add(ans.doctor._id);
        uniqueDoctors.push(ans.doctor);
      }
    });
    
    return uniqueDoctors.slice(0, 3).map((doc, idx) => (
      <div key={idx} className="w-8 h-8 rounded-full border-2 border-white bg-blue-100 flex items-center justify-center -ml-2 first:ml-0 overflow-hidden z-10 relative">
        {doc.profilePicture ? (
          <img src={doc.profilePicture} alt={doc.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-blue-700 text-xs font-bold">{doc.name?.charAt(0)}</span>
        )}
      </div>
    ));
  };

  const doctorCount = question.answers ? new Set(question.answers.map(a => a.doctor?._id)).size : 0;

  return (
    <Link to={`/questions/${question._id}`} className="block h-full transition-transform hover:-translate-y-1">
      <div className="card h-full flex flex-col justify-between p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow bg-white rounded-xl min-w-[300px]">
        
        <div>
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold uppercase overflow-hidden">
                {question.patient?.name ? question.patient.name.charAt(0) : <User size={16} />}
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">{question.patient?.name || 'Patient'}</p>
                <p className="text-xs text-gray-400">{new Date(question.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
            
            <span className={`text-xs px-2 py-1 rounded-full font-bold ${isAnswered ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
              {isAnswered ? 'Answered' : 'Open'}
            </span>
          </div>

          <h3 className="font-bold text-gray-900 text-lg mb-2 line-clamp-2">{question.title}</h3>
          <p className="text-gray-500 text-sm line-clamp-2 mb-4">{question.description}</p>
        </div>

        <div className="mt-auto">
          {isAnswered ? (
            <div className="flex items-center gap-3 mb-4 bg-blue-50 p-3 rounded-lg">
              <div className="flex items-center">
                {getDoctorImages()}
              </div>
              <p className="text-sm font-medium text-blue-800">
                {doctorCount} {doctorCount === 1 ? 'Expert' : 'Experts'} Answered &rarr;
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 mb-4 text-orange-600 bg-orange-50 p-3 rounded-lg text-sm font-medium">
              <MessageSquare size={16} /> Waiting for expert response...
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-gray-400 text-sm">
            <div className="flex items-center gap-2">
              <Eye size={16} />
              <span>{question.views} Views</span>
            </div>
            <button onClick={handleShare} className="flex items-center gap-1 hover:text-primary transition-colors">
              <Share2 size={16} /> Share
            </button>
          </div>
        </div>
        
      </div>
    </Link>
  );
};

export default QuestionCard;
