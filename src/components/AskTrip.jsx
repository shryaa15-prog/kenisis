
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, MapPin } from 'lucide-react';

// Use the deployed site's API by default.
// Set VITE_API_URL only if your backend is hosted separately.
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
    if (!value.trim()) return;

    nav(
      `/routes?q=${encodeURIComponent(value)}` +
      `&from=${encodeURIComponent(defaultOrigin || '')}` +
      `${when ? `&when=${encodeURIComponent(when)}` : ''}`
    );
  };

  return (
    <div className="askTrip">
      <label>
        <span>
          <Sparkles size={14} />
          TELL KINESIS WHERE YOU WANT TO GO
        </span>

        <div className="askRow">
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') go();
            }}
            placeholder="e.g. I want to travel to Margao"
            maxLength={300}
          />

          <button
            className="primary"
            onClick={() => go()}
            disabled={!text.trim()}
            type="button"
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
        KINESIS will automatically use your current location.
      </div>
    </div>
  );
}
