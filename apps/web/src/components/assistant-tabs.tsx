'use client';

import { useState } from 'react';
import { ChatConsole } from '@/components/chat-console';
import { AssistantConsole } from '@/components/assistant-console';

/**
 * Two ways to work with the AI Assistant: an open conversational **Chat** for
 * asking anything and building on earlier turns, and structured **Writing
 * tools** for one-shot tasks (full drafts, proofreading, titles…). Both share
 * the same plan gating and never-fabricate contract.
 */
export function AssistantTabs({ webAllowed = true }: { webAllowed?: boolean }) {
  const [tab, setTab] = useState<'chat' | 'tools'>('chat');

  return (
    <div>
      <div className="mb-4 inline-flex rounded-lg border border-rt-border bg-rt-white p-1 text-sm">
        <button
          type="button"
          onClick={() => setTab('chat')}
          className={
            tab === 'chat'
              ? 'rounded-md bg-rt-blue px-4 py-1.5 font-medium text-white'
              : 'rounded-md px-4 py-1.5 text-rt-muted hover:text-rt-text'
          }
        >
          💬 Chat
        </button>
        <button
          type="button"
          onClick={() => setTab('tools')}
          className={
            tab === 'tools'
              ? 'rounded-md bg-rt-blue px-4 py-1.5 font-medium text-white'
              : 'rounded-md px-4 py-1.5 text-rt-muted hover:text-rt-text'
          }
        >
          🛠 Writing tools
        </button>
      </div>

      {tab === 'chat' ? <ChatConsole webAllowed={webAllowed} /> : <AssistantConsole webAllowed={webAllowed} />}
    </div>
  );
}
