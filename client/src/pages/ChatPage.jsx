import React from 'react';
import Chatbot from '../components/Chatbot/Chatbot';

const ChatPage = () => (
  <main className="sc-page flex-1">
    <div className="container py-6 md:py-10 flex flex-col items-center animate-fade-in">
      <div className="text-center mb-6 md:mb-8 max-w-2xl">
        <h1 className="display text-3xl sm:text-4xl md:text-5xl mb-3">AI Health Assistant</h1>
        <p className="text-muted text-base md:text-lg">
          Get instant guidance on your health concerns, find doctors, and learn about medicines.
          Always consult a professional for serious symptoms.
        </p>
      </div>
      <Chatbot />
    </div>
  </main>
);

export default ChatPage;
