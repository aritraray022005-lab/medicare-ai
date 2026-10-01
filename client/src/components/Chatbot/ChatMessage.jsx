import React from 'react';
import ReactMarkdown from 'react-markdown';

const ChatMessage = ({ message }) => {
  const isUser = message.sender === 'user';
  
  return (
    <div className={`flex w-full mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div 
        className={`max-w-[75%] p-3 rounded-lg ${
          isUser 
            ? 'bg-primary text-white rounded-br-none' 
            : 'bg-gray-100 text-gray-800 rounded-bl-none border border-gray-200'
        }`}
      >
        <div className="text-sm prose prose-sm max-w-none dark:prose-invert">
          {isUser ? (
            <div className="whitespace-pre-wrap">{message.text}</div>
          ) : (
            <ReactMarkdown
              components={{
                p: ({node, ...props}) => <p className="m-0 mb-2 last:mb-0" {...props} />,
                ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-2 last:mb-0" {...props} />,
                ol: ({node, ...props}) => <ol className="list-decimal pl-4 mb-2 last:mb-0" {...props} />,
                li: ({node, ...props}) => <li className="mb-1" {...props} />
              }}
            >
              {message.text}
            </ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
