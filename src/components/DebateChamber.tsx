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

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, synthesis]);

  // Start debate when topic is set
  useEffect(() => {
    if (topic && !isDebating && !hasStartedRef.current) {
      hasStartedRef.current = true;
      runDebate();
    }
  }, [topic]);

  // Reset the ref when debate is reset
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
      {/* Header */}
      <header className="text-center py-8 px-4">
        <motion.h1
          className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-amber-400 via-purple-400 to-violet-400 bg-clip-text text-transparent mb-2"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          The Duality Oracle
        </motion.h1>
        <motion.p
          className="text-gray-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Two minds, one truth — watch them think together
        </motion.p>
      </header>

      {/* Oracle Orbs */}
      <div className="flex justify-center items-center gap-8 md:gap-24 py-8 px-4">
        <OracleOrb
          agent={LUMIS}
          isActive={!!topic}
          isSpeaking={currentSpeaker === 'lumis'}
        />

        {/* Connection between orbs */}
        <div className="hidden md:block relative w-32">
          <motion.div
            className="absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500/50 to-violet-500/50"
            animate={{
              opacity: isDebating ? [0.3, 0.8, 0.3] : 0.2,
            }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          {isDebating && (
            <motion.div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white"
              animate={{
                left: currentSpeaker === 'lumis' ? '0%' : currentSpeaker === 'umbra' ? '100%' : '50%',
                scale: [1, 1.2, 1],
              }}
              transition={{ duration: 0.5 }}
              style={{ boxShadow: '0 0 20px white' }}
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
            <p className="text-sm text-gray-500 mb-1">Contemplating:</p>
            <p className="text-xl text-gray-200 italic">&ldquo;{topic}&rdquo;</p>
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

        {/* Synthesis */}
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
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-800/50 rounded-full">
                <motion.span
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className={
                    currentSpeaker === 'lumis' ? 'text-amber-400' :
                    currentSpeaker === 'umbra' ? 'text-violet-400' : 'text-purple-400'
                  }
                >
                  {currentSpeaker === 'lumis' ? '◉' : currentSpeaker === 'umbra' ? '◎' : '✧'}
                </motion.span>
                <span className="text-sm text-gray-400">
                  {currentSpeaker === 'synthesis' ? 'Reaching synthesis...' : `${currentSpeaker.toUpperCase()} is contemplating...`}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* New Topic / Reset Button */}
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
              className="px-6 py-3 bg-gray-800/50 text-gray-300 rounded-xl border border-gray-700/50 hover:border-purple-500/50 hover:text-purple-300 transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Ask Another Question
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Topic Input */}
      <div className="p-4 border-t border-gray-800/50">
        {!topic && <TopicInput />}
      </div>
    </div>
  );
}
