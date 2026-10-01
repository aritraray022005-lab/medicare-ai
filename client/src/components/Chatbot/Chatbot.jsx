import React, { useState, useRef, useEffect } from 'react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import { sendChatMessage } from '../../services/aiApi';
import { Bot, AlertCircle } from 'lucide-react';

const Chatbot = () => {
  const [messages, setMessages] = useState([
    { id: 1, sender: 'ai', text: 'Hello! I am MedCare AI, your health guidance assistant. How can I help you today?' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (text) => {
    const userMessage = { id: Date.now(), sender: 'user', text };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      // Map previous messages to the format expected by the backend
      // We skip the default welcome message (id: 1) if desired, but here we'll include everything.
      const history = messages.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        text: msg.text
      }));

      const response = await sendChatMessage(text, history);
      if (response.success) {
        const aiMessage = { id: Date.now() + 1, sender: 'ai', text: response.reply };
        setMessages((prev) => [...prev, aiMessage]);
      } else {
        throw new Error(response.message || 'Failed to get response');
      }
    } catch (err) {
      const backendError = err.response?.data?.error || err.message;
      setError(`Error: ${backendError}. (Please try again)`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col bg-white rounded-xl shadow-lg border border-gray-100 h-[600px] max-h-[75dvh] min-h-[420px] w-full max-w-3xl mx-auto overflow-hidden">
      {/* Header */}
      <div className="bg-primary text-white p-4 flex items-center gap-3">
        <div className="bg-white text-primary p-2 rounded-full">
          <Bot size={24} />
        </div>
        <div>
          <h2 className="font-bold text-lg">MedCare AI Assistant</h2>
          <p className="text-xs opacity-90">Medical guidance & support</p>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50 flex flex-col">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        
        {isLoading && (
          <div className="flex w-full mb-4 justify-start">
            <div className="bg-gray-100 text-gray-800 p-3 rounded-lg rounded-bl-none border border-gray-200">
              <div className="flex items-center gap-2 text-sm opacity-70">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
        
        {error && (
          <div className="flex items-center gap-2 mt-2 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 self-center">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-gray-100">
        <div className="text-xs text-center text-gray-400 mb-2">
          MedCare AI can make mistakes. Always consult a real doctor for medical advice.
        </div>
        <ChatInput onSend={handleSendMessage} disabled={isLoading} />
      </div>
    </div>
  );
};

export default Chatbot;
