'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

interface ReactionBarProps {
  debateId: string | null;
}

export default function ReactionBar({ debateId }: ReactionBarProps) {
  const [reacted, setReacted] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reactions = [
    { id: 'agree', emoji: '🤝', label: 'I agree with this synthesis' },
    { id: 'disagree', emoji: '🤔', label: 'I see it differently' },
    { id: 'mindblown', emoji: '🌟', label: 'Mind blown!' },
  ];

  const handleReaction = async (reaction: string) => {
    if (reacted || isSubmitting || !debateId) return;

    setIsSubmitting(true);
    try {
      await fetch('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'react',
          debateId,
          reaction,
        }),
      });
      setReacted(reaction);
    } catch (error) {
      console.error('Failed to submit reaction:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-3 my-6"
    >
      <p className="text-sm text-gray-500">How did this resonate with you?</p>
      <div className="flex gap-3">
        {reactions.map((r) => (
          <motion.button
            key={r.id}
            onClick={() => handleReaction(r.id)}
            disabled={!!reacted || isSubmitting}
            className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${
              reacted === r.id
                ? 'bg-purple-900/30 border-purple-500/50'
                : reacted
                ? 'opacity-50 cursor-not-allowed border-gray-700/50'
                : 'bg-gray-800/30 border-gray-700/50 hover:border-purple-500/50 hover:bg-gray-800/50'
            }`}
            whileHover={!reacted ? { scale: 1.05 } : {}}
            whileTap={!reacted ? { scale: 0.95 } : {}}
          >
            <span className="text-2xl">{r.emoji}</span>
            <span className="text-xs text-gray-400 max-w-[80px] text-center leading-tight">
              {r.label}
            </span>
          </motion.button>
        ))}
      </div>
      {reacted && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-purple-400"
        >
          Thank you for sharing your perspective
        </motion.p>
      )}
    </motion.div>
  );
}
