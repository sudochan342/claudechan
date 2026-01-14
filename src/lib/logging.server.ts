// Server-side logging implementation - only import in API routes
import { DebateSession } from './agents';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const DEBATES_FILE = path.join(DATA_DIR, 'debates.json');
const TOPICS_FILE = path.join(DATA_DIR, 'topics.json');
const ANALYTICS_FILE = path.join(DATA_DIR, 'analytics.json');

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

async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {
    // Directory exists
  }
}

async function readJsonFile<T>(filepath: string, defaultValue: T): Promise<T> {
  try {
    const data = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return defaultValue;
  }
}

async function writeJsonFile(filepath: string, data: unknown): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(filepath, JSON.stringify(data, null, 2));
}

// Save a complete debate session
export async function saveDebateLog(session: DebateSession): Promise<void> {
  const debates = await readJsonFile<DebateSession[]>(DEBATES_FILE, []);
  debates.push(session);

  // Keep last 1000 debates
  if (debates.length > 1000) {
    debates.splice(0, debates.length - 1000);
  }

  await writeJsonFile(DEBATES_FILE, debates);
  await updateAnalytics(session);
}

// Get recent debates
export async function getRecentDebates(limit = 20): Promise<DebateSession[]> {
  const debates = await readJsonFile<DebateSession[]>(DEBATES_FILE, []);
  return debates.slice(-limit).reverse();
}

// Save user topic submission
export async function saveTopicSubmission(topic: string): Promise<void> {
  const topics = await readJsonFile<TopicSuggestion[]>(TOPICS_FILE, []);

  const existing = topics.find(t => t.topic.toLowerCase() === topic.toLowerCase());
  if (existing) {
    existing.debateCount++;
  } else {
    topics.push({
      id: `topic_${Date.now()}`,
      topic,
      submittedAt: Date.now(),
      debateCount: 1,
      source: 'user',
    });
  }

  await writeJsonFile(TOPICS_FILE, topics);
}

// Get popular topics
export async function getPopularTopics(limit = 10): Promise<TopicSuggestion[]> {
  const topics = await readJsonFile<TopicSuggestion[]>(TOPICS_FILE, []);
  return topics.sort((a, b) => b.debateCount - a.debateCount).slice(0, limit);
}

// Update analytics
async function updateAnalytics(session: DebateSession): Promise<void> {
  const analytics = await readJsonFile<Analytics>(ANALYTICS_FILE, {
    totalDebates: 0,
    totalTopicsSubmitted: 0,
    topicFrequency: {},
    reactionCounts: { agree: 0, disagree: 0, mindblown: 0 },
    hourlyActivity: {},
    popularWords: {},
  });

  analytics.totalDebates++;

  // Track topic frequency
  const topicKey = session.topic.toLowerCase().slice(0, 50);
  analytics.topicFrequency[topicKey] = (analytics.topicFrequency[topicKey] || 0) + 1;

  // Track hourly activity
  const hour = new Date().getHours().toString();
  analytics.hourlyActivity[hour] = (analytics.hourlyActivity[hour] || 0) + 1;

  // Extract and count words from topic
  const words = session.topic.toLowerCase().split(/\s+/);
  for (const word of words) {
    if (word.length > 3) {
      analytics.popularWords[word] = (analytics.popularWords[word] || 0) + 1;
    }
  }

  await writeJsonFile(ANALYTICS_FILE, analytics);
}

// Record user reaction
export async function recordReaction(
  debateId: string,
  reaction: 'agree' | 'disagree' | 'mindblown'
): Promise<void> {
  const debates = await readJsonFile<DebateSession[]>(DEBATES_FILE, []);
  const debate = debates.find(d => d.id === debateId);

  if (debate) {
    debate.userReactions[reaction]++;
    await writeJsonFile(DEBATES_FILE, debates);

    // Update global analytics
    const analytics = await readJsonFile<Analytics>(ANALYTICS_FILE, {
      totalDebates: 0,
      totalTopicsSubmitted: 0,
      topicFrequency: {},
      reactionCounts: { agree: 0, disagree: 0, mindblown: 0 },
      hourlyActivity: {},
      popularWords: {},
    });
    analytics.reactionCounts[reaction]++;
    await writeJsonFile(ANALYTICS_FILE, analytics);
  }
}

// Get analytics
export async function getAnalytics(): Promise<Analytics> {
  return readJsonFile<Analytics>(ANALYTICS_FILE, {
    totalDebates: 0,
    totalTopicsSubmitted: 0,
    topicFrequency: {},
    reactionCounts: { agree: 0, disagree: 0, mindblown: 0 },
    hourlyActivity: {},
    popularWords: {},
  });
}
