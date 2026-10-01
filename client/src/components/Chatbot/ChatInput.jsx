import React, { useState } from 'react';
import { Send } from 'lucide-react';

const ChatInput = ({ onSend, disabled }) => {
  const [input, setInput] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full mt-2">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Type your message here..."
        aria-label="Message"
        className="flex-1 min-w-0 p-3 border border-gray-300 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-teal-100"
        disabled={disabled}
      />
      <button 
        type="submit" 
        disabled={disabled || !input.trim()}
        aria-label="Send message"
        className="bg-primary text-white p-3 rounded-xl flex items-center justify-center disabled:opacity-50 transition-colors hover:bg-primary-hover"
      >
        <Send size={20} />
      </button>
    </form>
  );
};

export default ChatInput;
