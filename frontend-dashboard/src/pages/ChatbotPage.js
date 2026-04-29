/**
 * ============================================
 * Chatbot Page
 * ============================================
 * ChatGPT-like interface for querying data
 * using natural language.
 */

import React, { useState, useRef, useEffect } from 'react';
import api from '../utils/api';
import { HiOutlinePaperAirplane, HiOutlineLightBulb } from 'react-icons/hi';

// Suggested questions for quick access
const SUGGESTIONS = [
  'Show bench employees',
  'Active projects',
  'KPI summary',
  'Budget overview',
  'MEP engineers',
  'Utilization report',
  'Department breakdown',
  'Help',
];

export default function ChatbotPage() {
  const [messages, setMessages] = useState([
    {
      role: 'bot',
      text: "Hello! I'm your Smart Dashboard Assistant. Ask me anything about projects, employees, resources, or KPIs. Type **help** to see what I can do!",
      data: null,
      type: 'text',
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text) => {
    const message = text || input.trim();
    if (!message) return;

    // Add user message
    setMessages((prev) => [...prev, { role: 'user', text: message }]);
    setInput('');
    setIsTyping(true);

    try {
      const res = await api.post('/chat', { message });
      setMessages((prev) => [
        ...prev,
        { role: 'bot', text: res.data.text, data: res.data.data, type: res.data.type, columns: res.data.columns },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'bot', text: 'Sorry, something went wrong. Please try again.', type: 'error' },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Smart Chatbot</h1>
        <p className="text-sm text-gray-500">Ask questions about your data in natural language</p>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-auto p-6 space-y-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-2xl rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-800 shadow-sm'
              }`}
            >
              {/* Message Text (with basic markdown bold) */}
              <div className="text-sm whitespace-pre-wrap">
                {msg.text?.split('**').map((part, i) =>
                  i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                )}
              </div>

              {/* Table Data */}
              {msg.type === 'table' && msg.data && msg.data.length > 0 && (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        {(msg.columns || Object.keys(msg.data[0])).map((col) => (
                          <th
                            key={col}
                            className="px-3 py-2 text-left font-semibold text-gray-600 border-b border-gray-200 capitalize"
                          >
                            {col.replace(/([A-Z])/g, ' $1').trim()}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {msg.data.map((row, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          {(msg.columns || Object.keys(row)).map((col) => (
                            <td key={col} className="px-3 py-2 border-b border-gray-100">
                              {row[col] || '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm">
              <div className="flex space-x-1.5">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="px-6 pb-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
            <HiOutlineLightBulb size={14} />
            <span>Try asking:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="max-w-3xl mx-auto flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask a question about your data..."
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
            disabled={isTyping}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isTyping}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <HiOutlinePaperAirplane size={18} className="transform rotate-90" />
          </button>
        </div>
      </div>
    </div>
  );
}
