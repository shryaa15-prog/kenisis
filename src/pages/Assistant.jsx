
import React, { useState } from 'react';
import { Sparkles, Send, User, Bot } from 'lucide-react';
import { assistantAnswers } from '../data/data';

// Use VITE_API_URL if configured; otherwise use the current website.
const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export default function Assistant() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  const ask = async (q) => {
    if (!q.trim() || busy) return;

    setInput('');
    setBusy(true);

    let answer;

    try {
      const response = await fetch(`${API}/api/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          question: q
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      answer = data.answer || 'Sorry, I could not find an answer.';
    } catch (error) {
      console.error('Kinesis assistant error:', error);

      answer =
        assistantAnswers[q] ||
        'Sorry, the assistant is temporarily unavailable. Please try again.';
    }

    setMessages((previous) => [...previous, { q, a: answer }]);
    setBusy(false);
  };

  return (
    <div className="page assistant">
      <div className="eyebrow">EXPLORE GOA. TRAVEL SMARTER.</div>

      <h1>Meet your Goa companion</h1>
      <p className="lead">
        A little local knowledge goes a long way.
      </p>

      <div className="chat">
        <div className="chatWelcome">
          <div className="aiIcon">
            <Sparkles />
          </div>

          <h2>Hello! Where shall we go?</h2>
          <p>
            Ask me about routes, places, or your next little adventure.
          </p>
        </div>

        <div className="suggestions">
          {Object.keys(assistantAnswers).map((question) => (
            <button
              onClick={() => ask(question)}
              key={question}
              disabled={busy}
            >
              {question}
            </button>
          ))}
        </div>

        {messages.map((message, index) => (
          <div className="chatPair" key={index}>
            <div className="bubble user">
              <User size={15} />
              {message.q}
            </div>

            <div className="bubble bot">
              <Bot size={15} />
              {message.a}
            </div>
          </div>
        ))}

        <div className="chatInput">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') ask(input);
            }}
            placeholder="Ask me anything about Goa…"
            disabled={busy}
          />

          <button onClick={() => ask(input)} disabled={busy || !input.trim()}>
            <Send size={17} />
          </button>
        </div>

        {busy && <p className="lead">Finding an answer…</p>}
      </div>
    </div>
  );
}
