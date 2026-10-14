
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, MapPin } from 'lucide-react';

export const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const examples = [
  'I want to travel to Margao',
  'Panaji to Calangute tomorrow morning',
  'Take me to Palolem Beach'
];

export default function AskTrip({
  defaultOrigin,
  when,
  initial = '',
  chips = true
}) {
  const [text, setText] = useState(initial);
  const nav = useNavigate();

  useEffect(() => {
    setText(initial);
  }, [initial]);

  const go = (value = text) => {
    const query = value.trim();

    if (!query) return;

    const params = new URLSearchParams();
    params.set('q', query);

    if (defaultOrigin) {
      params.set('from', defaultOrigin);
    }

    if (when) {
      params.set('when', when);
    }

    nav(`/routes?${params.toString()}`);
  };

  return (
    <div className="askTrip">
      <label>
        <span>
          <Sparkles size={14} /> TELL KINESIS WHERE YOU WANT TO GO
        </span>

        <div className="askRow">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') go();
            }}
            placeholder="e.g. I want to travel to Margao"
            maxLength={300}
          />

          <button
            type="button"
            className="primary"
            onClick={() => go()}
            disabled={!text.trim()}
            aria-label="Search journey"
          >
            <ArrowRight size={17} />
          </button>
        </div>
      </label>

      {chips && (
        <div className="askChips">
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                setText(example);
                go(example);
              }}
            >
              {example}
            </button>
          ))}
        </div>
      )}

      <div className="askHint">
        <MapPin size={13} />
        KINESIS will automatically use your current location when available.
      </div>
    </div>
  );
}
