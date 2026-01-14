'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDebateStore } from '@/store/debate';
import { LUMIS, UMBRA } from '@/lib/agents';
import OracleOrb from './OracleOrb';
import MessageBubble from './MessageBubble';
import TopicInput from './TopicInput';
import ReactionBar from './ReactionBar';

export default function DebateChamber() {
  const {
    topic,
    messages,
    synthesis,
    isDebating,
    currentSpeaker,
    debateId,
    startDebate,
    addMessage,
    setSynthesis,
    setCurrentSpeaker,
    endDebate,
    resetDebate,
  } = useDebateStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, synthesis]);

  useEffect(() => {
    if (topic && !isDebating && !hasStartedRef.current) {
      hasStartedRef.current = true;
      runDebate();
    }
  }, [topic]);

  useEffect(() => {
    if (!topic && !isDebating) {
      hasStartedRef.current = false;
    }
  }, [topic, isDebating]);

  const runDebate = async () => {
    startDebate();

    try {
      const response = await fetch('/api/debate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          conversationHistory: [],
        }),
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
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
                case 'error':
                  console.error('Debate error:', data.message);
                  endDebate();
                  break;
              }
            } catch {
              // Skip invalid JSON lines
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to run debate:', error);
      endDebate();
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Epic Header */}
      <header className="text-center pt-8 pb-4 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
        >
          {/* Decorative line */}
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-amber-500/50" />
            <span className="text-amber-400/60 text-xs tracking-[0.5em]">☀</span>
            <div className="h-px w-8 bg-gradient-to-r from-amber-500/50 via-purple-500/50 to-violet-500/50" />
            <span className="text-violet-400/60 text-xs tracking-[0.5em]">☾</span>
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-violet-500/50" />
          </div>

          <motion.h1
            className="text-5xl md:text-6xl lg:text-7xl font-extralight tracking-[0.15em] uppercase"
            style={{
              background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 25%, #a78bfa 50%, #8b5cf6 75%, #7c3aed 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
            animate={{
              backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
            }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          >
            Duality Oracle
          </motion.h1>

          <motion.p
            className="text-gray-500 mt-3 text-sm tracking-[0.3em] uppercase"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Two minds • One truth • Infinite wisdom
          </motion.p>
        </motion.div>
      </header>

      {/* Oracle Orbs - Larger spacing */}
      <div className="flex justify-center items-start gap-4 md:gap-16 lg:gap-24 py-6 px-4">
        <OracleOrb
          agent={LUMIS}
          isActive={!!topic}
          isSpeaking={currentSpeaker === 'lumis'}
        />

        {/* Energy connection between orbs */}
        <div className="hidden md:flex flex-col items-center justify-center h-64 w-24 lg:w-32">
          {/* Vertical energy beam */}
          <motion.div
            className="relative w-full h-1"
            style={{
              background: 'linear-gradient(90deg, rgba(251,191,36,0.6), rgba(139,92,246,0.6))',
              boxShadow: '0 0 20px rgba(147,51,234,0.5)',
            }}
            animate={{
              opacity: isDebating ? [0.4, 1, 0.4] : 0.3,
              scaleX: isDebating ? [1, 1.1, 1] : 1,
            }}
            transition={{ duration: 2, repeat: Infinity }}
          />

          {/* Center symbol */}
          <motion.div
            className="my-4 text-2xl"
            animate={{
              opacity: [0.5, 1, 0.5],
              scale: isDebating ? [1, 1.2, 1] : 1,
              rotate: [0, 180, 360],
            }}
            transition={{
              opacity: { duration: 2, repeat: Infinity },
              scale: { duration: 2, repeat: Infinity },
              rotate: { duration: 8, repeat: Infinity, ease: 'linear' },
            }}
            style={{
              color: 'rgba(147,51,234,0.8)',
              textShadow: '0 0 20px rgba(147,51,234,0.8)',
            }}
          >
            ✧
          </motion.div>

          <motion.div
            className="relative w-full h-1"
            style={{
              background: 'linear-gradient(90deg, rgba(251,191,36,0.6), rgba(139,92,246,0.6))',
              boxShadow: '0 0 20px rgba(147,51,234,0.5)',
            }}
            animate={{
              opacity: isDebating ? [0.4, 1, 0.4] : 0.3,
              scaleX: isDebating ? [1, 1.1, 1] : 1,
            }}
            transition={{ duration: 2, repeat: Infinity, delay: 1 }}
          />

          {/* Speaking indicator */}
          {isDebating && currentSpeaker && currentSpeaker !== 'synthesis' && (
            <motion.div
              className="absolute w-4 h-4 rounded-full"
              style={{
                background: currentSpeaker === 'lumis' ? '#fbbf24' : '#8b5cf6',
                boxShadow: `0 0 20px ${currentSpeaker === 'lumis' ? '#fbbf24' : '#8b5cf6'}`,
              }}
              animate={{
                x: currentSpeaker === 'lumis' ? -40 : 40,
                scale: [1, 1.3, 1],
              }}
              transition={{ duration: 0.5 }}
            />
          )}
        </div>

        <OracleOrb
          agent={UMBRA}
          isActive={!!topic}
          isSpeaking={currentSpeaker === 'umbra'}
        />
      </div>

      {/* Current Topic */}
      <AnimatePresence>
        {topic && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center px-4 mb-4"
          >
            <div className="inline-block px-6 py-3 bg-gray-900/50 rounded-2xl border border-gray-800/50 backdrop-blur-sm">
              <p className="text-xs text-gray-500 mb-1 tracking-widest uppercase">Contemplating</p>
              <p className="text-lg md:text-xl text-gray-200 italic font-light">&ldquo;{topic}&rdquo;</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages Area */}
      <div className="flex-1 overflow-auto px-4 py-4 max-w-4xl mx-auto w-full">
        <AnimatePresence>
          {messages.map((message, index) => (
            <MessageBubble key={message.id} message={message} index={index} />
          ))}
        </AnimatePresence>

        <AnimatePresence>
          {synthesis && (
            <>
              <MessageBubble
                message={{
                  id: 'synthesis',
                  agent: 'synthesis',
                  content: synthesis,
                  timestamp: Date.now(),
                }}
                index={messages.length}
              />
              <ReactionBar debateId={debateId} />
            </>
          )}
        </AnimatePresence>

        {/* Thinking indicator */}
        <AnimatePresence>
          {isDebating && currentSpeaker && !synthesis && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`flex items-center gap-2 my-4 ${
                currentSpeaker === 'lumis' ? 'justify-start' :
                currentSpeaker === 'umbra' ? 'justify-end' : 'justify-center'
              }`}
            >
              <div
                className="flex items-center gap-3 px-5 py-2.5 rounded-full backdrop-blur-sm"
                style={{
                  background: currentSpeaker === 'lumis'
                    ? 'rgba(251,191,36,0.1)'
                    : currentSpeaker === 'umbra'
                    ? 'rgba(139,92,246,0.1)'
                    : 'rgba(147,51,234,0.1)',
                  border: `1px solid ${
                    currentSpeaker === 'lumis'
                      ? 'rgba(251,191,36,0.3)'
                      : currentSpeaker === 'umbra'
                      ? 'rgba(139,92,246,0.3)'
                      : 'rgba(147,51,234,0.3)'
                  }`,
                }}
              >
                <motion.span
                  animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className={
                    currentSpeaker === 'lumis' ? 'text-amber-400' :
                    currentSpeaker === 'umbra' ? 'text-violet-400' : 'text-purple-400'
                  }
                >
                  {currentSpeaker === 'lumis' ? '☀' : currentSpeaker === 'umbra' ? '☾' : '✧'}
                </motion.span>
                <span className="text-sm text-gray-400 tracking-wide">
                  {currentSpeaker === 'synthesis' ? 'Reaching synthesis...' : `${currentSpeaker.toUpperCase()} contemplates...`}
                </span>
                <motion.span
                  className="flex gap-1"
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  <span className="w-1.5 h-1.5 rounded-full bg-current" style={{ animationDelay: '0.2s' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-current" style={{ animationDelay: '0.4s' }} />
                </motion.span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* Reset Button */}
      <AnimatePresence>
        {synthesis && !isDebating && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="flex justify-center py-4"
          >
            <motion.button
              onClick={resetDebate}
              className="group px-8 py-3 bg-gradient-to-r from-amber-500/10 to-violet-500/10 text-gray-300 rounded-full border border-gray-700/50 hover:border-purple-500/50 hover:text-white transition-all duration-300"
              whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(139,92,246,0.3)' }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="flex items-center gap-3">
                <span className="text-amber-400 group-hover:rotate-180 transition-transform duration-500">☀</span>
                Ask Another Question
                <span className="text-violet-400 group-hover:-rotate-180 transition-transform duration-500">☾</span>
              </span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Topic Input */}
      <div className="p-4 pb-16 border-t border-gray-800/30">
        {!topic && <TopicInput />}
      </div>
    </div>
  );
}
