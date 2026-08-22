'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, Button, Badge, Alert } from '@researchtrics/ui';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatResult {
  text: string;
  model: string;
  external: boolean;
  offline: boolean;
  diagnostic?: string;
  disclaimer: string;
}

const STARTERS = [
  'Help me find recent literature on my topic and summarise the key debates.',
  'Rephrase this paragraph to be clearer and more formal: …',
  'What research questions could I pursue in this area?',
  'Draft an outline for a paper on …',
];

/**
 * Conversational AI Assistant (§29, §48). Holds the message history client-side
 * and sends the whole thread each turn, so the assistant remembers the
 * discussion. Web browsing (premium) grounds answers in real sources.
 */
export function ChatConsole({ webAllowed = true }: { webAllowed?: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [web, setWeb] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disclaimer, setDisclaimer] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (trimmed.length < 2 || loading) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(next);
    setInput('');
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/v1/assistant/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: next, web: webAllowed && web }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? 'Something went wrong. Please try again.');
        return;
      }
      const data = json.data as ChatResult;
      setMessages((m) => [...m, { role: 'assistant', content: data.text || '…' }]);
      setDisclaimer(data.disclaimer);
      if (data.offline && data.diagnostic) {
        setError(`AI provider unavailable — showing a fallback. (${data.diagnostic})`);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="flex flex-col p-0">
      {/* Transcript */}
      <div ref={scrollRef} className="max-h-[28rem] min-h-[16rem] flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="py-6">
            <p className="text-sm text-rt-muted">
              Ask anything about your research — writing, planning, understanding a method,
              structuring an argument, or finding literature. I remember our conversation, so you can
              build on earlier answers.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-full border border-rt-border px-3 py-1.5 text-left text-xs text-rt-text hover:border-rt-blue hover:text-rt-blue"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ul className="space-y-4">
            {messages.map((m, i) => (
              <li key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={
                    m.role === 'user'
                      ? 'max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-rt-blue px-4 py-2.5 text-sm leading-relaxed text-white'
                      : 'max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-rt-border bg-rt-blue-light/20 px-4 py-2.5 text-sm leading-relaxed text-rt-text'
                  }
                >
                  {m.content}
                </div>
              </li>
            ))}
            {loading ? (
              <li className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm border border-rt-border bg-rt-blue-light/20 px-4 py-2.5 text-sm text-rt-muted">
                  {web && webAllowed ? 'Researching the web…' : 'Thinking…'}
                </div>
              </li>
            ) : null}
          </ul>
        )}
      </div>

      {error ? (
        <Alert variant="error" className="mx-4 mb-2">
          {error}
        </Alert>
      ) : null}

      {/* Composer */}
      <div className="border-t border-rt-border p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Ask the assistant… (Enter to send, Shift+Enter for a new line)"
            rows={2}
            className="min-w-0 flex-1 resize-y rounded-lg border border-rt-border bg-rt-white p-2.5 text-sm leading-relaxed text-rt-text focus:border-rt-blue focus:outline-none focus:ring-1 focus:ring-rt-blue"
          />
          <Button onClick={() => send(input)} disabled={loading || input.trim().length < 2} size="sm">
            {loading ? '…' : 'Send'}
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {webAllowed ? (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-rt-text">
              <input type="checkbox" checked={web} onChange={(e) => setWeb(e.target.checked)} />
              🌐 Browse the web for real, cited sources
            </label>
          ) : (
            <a
              href="/pricing"
              className="flex items-center gap-2 text-xs text-rt-muted hover:text-rt-blue"
              title="Web browsing is a Premium feature"
            >
              🌐 Browse the web{' '}
              <span className="rounded bg-rt-gold-light px-1.5 text-rt-blue-dark">Premium</span>
            </a>
          )}
          {messages.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                setMessages([]);
                setError(null);
                setDisclaimer(null);
              }}
              className="ml-auto text-xs text-rt-muted hover:text-rt-blue"
            >
              Clear conversation
            </button>
          ) : (
            <Badge variant="neutral" className="ml-auto">
              Never invents citations or data
            </Badge>
          )}
        </div>
        {disclaimer ? <p className="mt-2 text-xs text-rt-muted">{disclaimer}</p> : null}
      </div>
    </Card>
  );
}
