// Server-side logging implementation
// Note: On Vercel, filesystem is read-only, so we use in-memory + console logging
// For production persistence, integrate a database (Vercel KV, Supabase, etc.)

import { DebateSession } from './agents';

interface TopicSuggestion {
  id: string;
  topic: string;
  submittedAt: number;
  debateCount: number;
  source: 'user' | 'system';
}

interface Analytics {
  totalDebates: number;
  totalTopicsSubmitted: number;
  topicFrequency: Record<string, number>;
  reactionCounts: {
    agree: number;
    disagree: number;
    mindblown: number;
  };
  hourlyActivity: Record<string, number>;
  popularWords: Record<string, number>;
}

// In-memory storage (resets on cold start - fine for demo)
const memoryStore = {
  debates: [] as DebateSession[],
  topics: [] as TopicSuggestion[],
  analytics: {
    totalDebates: 0,
    totalTopicsSubmitted: 0,
    topicFrequency: {},
    reactionCounts: { agree: 0, disagree: 0, mindblown: 0 },
    hourlyActivity: {},
    popularWords: {},
  } as Analytics,
};

// Save a complete debate session
export async function saveDebateLog(session: DebateSession): Promise<void> {
  memoryStore.debates.push(session);

  // Keep last 100 debates in memory
  if (memoryStore.debates.length > 100) {
    memoryStore.debates.shift();
  }

  // Update analytics
  memoryStore.analytics.totalDebates++;
  const topicKey = session.topic.toLowerCase().slice(0, 50);
  memoryStore.analytics.topicFrequency[topicKey] =
    (memoryStore.analytics.topicFrequency[topicKey] || 0) + 1;

  // Log for monitoring
  console.log('[Debate]', { topic: session.topic, id: session.id });
}

// Get recent debates
export async function getRecentDebates(limit = 20): Promise<DebateSession[]> {
  return memoryStore.debates.slice(-limit).reverse();
}

// Save user topic submission
export async function saveTopicSubmission(topic: string): Promise<void> {
  const existing = memoryStore.topics.find(
    t => t.topic.toLowerCase() === topic.toLowerCase()
  );

  if (existing) {
    existing.debateCount++;
  } else {
    memoryStore.topics.push({
      id: `topic_${Date.now()}`,
      topic,
      submittedAt: Date.now(),
      debateCount: 1,
      source: 'user',
    });
  }

  memoryStore.analytics.totalTopicsSubmitted++;
  console.log('[Topic Submitted]', topic);
}

// Get popular topics
export async function getPopularTopics(limit = 10): Promise<TopicSuggestion[]> {
  return [...memoryStore.topics]
    .sort((a, b) => b.debateCount - a.debateCount)
    .slice(0, limit);
}

// Record user reaction
export async function recordReaction(
  debateId: string,
  reaction: 'agree' | 'disagree' | 'mindblown'
): Promise<void> {
  const debate = memoryStore.debates.find(d => d.id === debateId);

  if (debate) {
    debate.userReactions[reaction]++;
    memoryStore.analytics.reactionCounts[reaction]++;
    console.log('[Reaction]', { debateId, reaction });
  }
}

// Get analytics
export async function getAnalytics(): Promise<Analytics> {
  return memoryStore.analytics;
}
