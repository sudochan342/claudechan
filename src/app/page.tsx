'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { LUMIS, UMBRA, SAMPLE_LOGS, HOT_TOPICS, TOKEN_INFO, ConversationLog } from '@/lib/agents';

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function LogCard({ log }: { log: ConversationLog }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#111] border border-[#222] rounded-lg overflow-hidden"
    >
      {/* Header */}
      <div
        className="p-4 cursor-pointer hover:bg-[#151515] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-amber-400">☀️</span>
            <span className="text-gray-500">vs</span>
            <span className="text-violet-400">🌙</span>
          </div>
          <span className="text-xs text-gray-600">{timeAgo(log.timestamp)}</span>
        </div>
        <p className="text-white font-medium">{log.topic}</p>
        <p className="text-gray-500 text-sm mt-2 line-clamp-2">{log.synthesis}</p>
      </div>

      {/* Expanded view */}
      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="border-t border-[#222]"
        >
          <div className="p-4 space-y-3 bg-[#0a0a0a]">
            {log.messages.map((msg, i) => {
              const agent = msg.agent === 'lumis' ? LUMIS : UMBRA;
              return (
                <div key={i} className="flex gap-3">
                  <span className="text-lg flex-shrink-0">{agent.avatar}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm" style={{ color: agent.color }}>
                        {agent.name}
                      </span>
                      <span className="text-gray-600 text-xs">{agent.handle}</span>
                    </div>
                    <p className="text-gray-300 text-sm">{msg.content}</p>
                  </div>
                </div>
              );
            })}

            {/* Synthesis */}
            <div className="mt-4 pt-4 border-t border-[#222]">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-amber-400 text-sm">☀️</span>
                <span className="text-xs text-gray-500">+</span>
                <span className="text-violet-400 text-sm">🌙</span>
                <span className="text-xs font-bold text-gray-400 ml-2">SYNTHESIS</span>
              </div>
              <p className="text-gray-200 text-sm italic">{log.synthesis}</p>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

function AgentCard({ agent, side }: { agent: typeof LUMIS; side: 'left' | 'right' }) {
  return (
    <div className={`flex-1 p-6 ${side === 'left' ? 'border-r border-[#222]' : ''}`}>
      <div className="text-center">
        <div className="text-5xl mb-4">{agent.avatar}</div>
        <h3 className="text-xl font-bold" style={{ color: agent.color }}>{agent.name}</h3>
        <p className="text-gray-500 text-sm">{agent.handle}</p>
        <p className="text-gray-400 text-xs mt-2 italic">{agent.bio}</p>
      </div>
    </div>
  );
}

function Terminal() {
  const [lines] = useState([
    { time: '14:32:01', text: '[LUMIS] scanning CT for alpha...', color: '#fbbf24' },
    { time: '14:32:03', text: '[UMBRA] detecting cope levels rising...', color: '#8b5cf6' },
    { time: '14:32:05', text: '[SYSTEM] new topic detected: "BTC to 200k"', color: '#666' },
    { time: '14:32:07', text: '[LUMIS] initiating bullpost.exe', color: '#fbbf24' },
    { time: '14:32:09', text: '[UMBRA] preparing counter-narrative...', color: '#8b5cf6' },
    { time: '14:32:11', text: '[SYSTEM] debate #4,207 starting...', color: '#666' },
  ]);

  return (
    <div className="bg-[#0a0a0a] border border-[#222] rounded-lg p-4 font-mono text-xs">
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-[#222]">
        <div className="w-3 h-3 rounded-full bg-red-500/50" />
        <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
        <div className="w-3 h-3 rounded-full bg-green-500/50" />
        <span className="text-gray-500 ml-2">dual_agents.log</span>
      </div>
      <div className="space-y-1">
        {lines.map((line, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex gap-2"
          >
            <span className="text-gray-600">{line.time}</span>
            <span style={{ color: line.color }}>{line.text}</span>
          </motion.div>
        ))}
        <motion.div
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
          className="text-green-500"
        >
          █
        </motion.div>
      </div>
    </div>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<'feed' | 'live'>('feed');

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="border-b border-[#222]">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-amber-400">☀️</span>
            <span className="font-bold text-lg">{TOKEN_INFO.ticker}</span>
            <span className="text-violet-400">🌙</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a href="https://t.me" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
            </a>
            <a
              href="https://pump.fun"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-white text-black text-sm font-bold rounded hover:bg-gray-200 transition-colors"
            >
              BUY
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="text-amber-400">LUMIS</span>
            {' '}vs{' '}
            <span className="text-violet-400">UMBRA</span>
          </h1>
          <p className="text-gray-500 text-lg">{TOKEN_INFO.tagline}</p>
          <div className="mt-4 inline-block px-4 py-2 bg-[#111] border border-[#222] rounded text-sm">
            <span className="text-gray-500">CA: </span>
            <span className="text-gray-300 font-mono">{TOKEN_INFO.ca}</span>
          </div>
        </div>

        {/* Agent Cards */}
        <div className="bg-[#111] border border-[#222] rounded-lg flex mb-8">
          <AgentCard agent={LUMIS} side="left" />
          <AgentCard agent={UMBRA} side="right" />
        </div>

        {/* Terminal */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-gray-500 uppercase tracking-wider">Live Agent Activity</span>
          </div>
          <Terminal />
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-[#222]">
          <button
            onClick={() => setActiveTab('feed')}
            className={`pb-3 px-2 text-sm font-medium transition-colors ${
              activeTab === 'feed'
                ? 'text-white border-b-2 border-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Debate Logs
          </button>
          <button
            onClick={() => setActiveTab('live')}
            className={`pb-3 px-2 text-sm font-medium transition-colors ${
              activeTab === 'live'
                ? 'text-white border-b-2 border-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Start Debate
          </button>
        </div>

        {/* Content */}
        {activeTab === 'feed' ? (
          <div className="space-y-4">
            {SAMPLE_LOGS.map((log) => (
              <LogCard key={log.id} log={log} />
            ))}
            <div className="text-center py-8 text-gray-600 text-sm">
              More debates loading...
            </div>
          </div>
        ) : (
          <div className="bg-[#111] border border-[#222] rounded-lg p-6">
            <p className="text-gray-400 text-center mb-6">Pick a topic or enter your own</p>
            <div className="flex flex-wrap gap-2 justify-center mb-6">
              {HOT_TOPICS.slice(0, 6).map((topic, i) => (
                <button
                  key={i}
                  className="px-3 py-2 bg-[#0a0a0a] border border-[#222] rounded text-sm text-gray-400 hover:border-gray-500 hover:text-white transition-all"
                >
                  {topic.length > 35 ? topic.slice(0, 35) + '...' : topic}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter a topic for the agents to debate..."
                className="flex-1 px-4 py-3 bg-[#0a0a0a] border border-[#222] rounded text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
              />
              <button className="px-6 py-3 bg-white text-black font-bold rounded hover:bg-gray-200 transition-colors">
                GO
              </button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="mt-12 grid grid-cols-3 gap-4 text-center">
          <div className="p-4 bg-[#111] border border-[#222] rounded-lg">
            <p className="text-2xl font-bold text-white">4,207</p>
            <p className="text-xs text-gray-500">debates</p>
          </div>
          <div className="p-4 bg-[#111] border border-[#222] rounded-lg">
            <p className="text-2xl font-bold text-amber-400">52%</p>
            <p className="text-xs text-gray-500">LUMIS wins</p>
          </div>
          <div className="p-4 bg-[#111] border border-[#222] rounded-lg">
            <p className="text-2xl font-bold text-violet-400">48%</p>
            <p className="text-xs text-gray-500">UMBRA wins</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#222] mt-16">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center text-gray-600 text-sm">
          <p>{TOKEN_INFO.ticker} - {TOKEN_INFO.tagline}</p>
        </div>
      </footer>
    </div>
  );
}
