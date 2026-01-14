'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useDebateStore } from '@/store/debate';
import { VIRAL_TOPICS, LUMIS, UMBRA } from '@/lib/agents';

export default function OraclePage() {
  const [input, setInput] = useState('');
  const [randomTopics, setRandomTopics] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    topic,
    messages,
    synthesis,
    isDebating,
    currentSpeaker,
    setTopic,
    startDebate,
    addMessage,
    setSynthesis,
    setCurrentSpeaker,
    endDebate,
    resetDebate,
  } = useDebateStore();

  useEffect(() => {
    const shuffled = [...VIRAL_TOPICS].sort(() => Math.random() - 0.5);
    setRandomTopics(shuffled.slice(0, 4));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, synthesis]);

  useEffect(() => {
    if (topic && !isDebating && messages.length === 0) {
      runDebate();
    }
  }, [topic]);

  const runDebate = async () => {
    startDebate();

    try {
      const response = await fetch('/api/debate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, conversationHistory: [] }),
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

        for (const line of lines) {
          const data = JSON.parse(line.slice(6));

          switch (data.type) {
            case 'agent_start':
              setCurrentSpeaker(data.agent);
              break;
            case 'agent_message':
              addMessage({
                id: `msg_${Date.now()}`,
                agent: data.agent,
                content: data.content,
                timestamp: Date.now(),
              });
              break;
            case 'synthesis':
              setCurrentSpeaker('synthesis');
              setSynthesis(data.content);
              break;
            case 'complete':
              endDebate();
              break;
          }
        }
      }
    } catch (error) {
      console.error('Debate error:', error);
      endDebate();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isDebating) {
      resetDebate();
      setTopic(input.trim());
      setInput('');
    }
  };

  const selectTopic = (t: string) => {
    if (!isDebating) {
      resetDebate();
      setTopic(t);
    }
  };

  const handleNewQuestion = () => {
    resetDebate();
    const shuffled = [...VIRAL_TOPICS].sort(() => Math.random() - 0.5);
    setRandomTopics(shuffled.slice(0, 4));
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-white/5">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex items-center">
              <span className="text-amber-400 text-lg">☀</span>
              <span className="text-violet-400 text-lg">☾</span>
            </div>
            <span className="text-lg font-semibold tracking-tight">DUALITY</span>
          </Link>
          <a
            href="https://pump.fun"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-white text-black text-sm font-medium rounded-full hover:bg-gray-200 transition-colors"
          >
            Buy $DUAL
          </a>
        </div>
      </nav>

      <main className="pt-24 pb-32 px-6">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-4 mb-4">
              <span className="text-3xl">☀</span>
              <span className="text-gray-600">×</span>
              <span className="text-3xl">☾</span>
            </div>
            <h1 className="text-2xl font-bold mb-2">The Oracle Chamber</h1>
            <p className="text-gray-500 text-sm">Ask anything. Two minds will seek the truth.</p>
          </div>

          {/* Messages */}
          {messages.length > 0 && (
            <div className="space-y-4 mb-8">
              {/* Topic */}
              <div className="text-center mb-8">
                <span className="text-xs text-gray-500 uppercase tracking-wider">Topic</span>
                <p className="text-gray-300 mt-1">{topic}</p>
              </div>

              {/* Debate messages */}
              {messages.map((message, index) => {
                const isLumis = message.agent === 'lumis';
                const agent = isLumis ? LUMIS : UMBRA;

                return (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`flex ${isLumis ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-md p-4 rounded-2xl ${
                        isLumis
                          ? 'bg-amber-950/30 border border-amber-500/20'
                          : 'bg-violet-950/30 border border-violet-500/20'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span style={{ color: agent.color }}>
                          {isLumis ? '☀' : '☾'}
                        </span>
                        <span
                          className="text-xs font-bold tracking-wider"
                          style={{ color: agent.color }}
                        >
                          {agent.name}
                        </span>
                      </div>
                      <p className="text-gray-200 text-sm leading-relaxed">
                        {message.content}
                      </p>
                    </div>
                  </motion.div>
                );
              })}

              {/* Thinking indicator */}
              {isDebating && currentSpeaker && currentSpeaker !== 'synthesis' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`flex ${currentSpeaker === 'lumis' ? 'justify-start' : 'justify-end'}`}
                >
                  <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <motion.span
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      {currentSpeaker === 'lumis' ? '☀' : '☾'}
                    </motion.span>
                    <span>thinking...</span>
                  </div>
                </motion.div>
              )}

              {/* Synthesis */}
              {synthesis && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-8"
                >
                  <div className="p-6 rounded-2xl bg-gradient-to-r from-amber-950/20 via-purple-950/30 to-violet-950/20 border border-purple-500/30">
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <span className="text-amber-400">☀</span>
                      <span className="text-xs font-bold tracking-widest text-purple-400">
                        SYNTHESIS
                      </span>
                      <span className="text-violet-400">☾</span>
                    </div>
                    <p className="text-gray-100 text-center leading-relaxed">
                      {synthesis}
                    </p>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}

          {/* New question button after synthesis */}
          {synthesis && !isDebating && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center mb-8"
            >
              <button
                onClick={handleNewQuestion}
                className="px-6 py-3 bg-white/5 border border-white/10 rounded-full text-sm text-gray-300 hover:bg-white/10 transition-colors"
              >
                Ask Another Question
              </button>
            </motion.div>
          )}

          {/* Input form - show when no active debate */}
          {!topic && (
            <>
              <form onSubmit={handleSubmit} className="mb-8">
                <div className="flex gap-3 p-2 bg-white/5 rounded-xl border border-white/10">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="What truth shall we seek?"
                    disabled={isDebating}
                    className="flex-1 px-4 py-3 bg-transparent text-gray-100 placeholder-gray-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || isDebating}
                    className="px-6 py-3 bg-white text-black font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                  >
                    Ask
                  </button>
                </div>
              </form>

              {/* Suggested topics */}
              <div>
                <p className="text-xs text-gray-500 text-center mb-4 uppercase tracking-wider">
                  Or try one of these
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {randomTopics.map((t, i) => (
                    <button
                      key={i}
                      onClick={() => selectTopic(t)}
                      className="px-4 py-2 text-sm bg-white/5 text-gray-400 rounded-full border border-white/5 hover:border-white/20 hover:text-gray-200 transition-all"
                    >
                      {t.length > 40 ? t.slice(0, 40) + '...' : t}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 py-4 px-6 bg-[#0a0a0a]/90 backdrop-blur-md border-t border-white/5">
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-6 text-sm text-gray-500">
          <span className="flex items-center gap-2">
            <span className="text-amber-400">☀</span>
            $DUAL
            <span className="text-violet-400">☾</span>
          </span>
          <span>•</span>
          <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition-colors">
            Twitter
          </a>
          <span>•</span>
          <a href="https://t.me" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition-colors">
            Telegram
          </a>
        </div>
      </footer>
    </div>
  );
}
