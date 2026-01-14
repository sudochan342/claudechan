// Logging exports for client-side use only
// Server-side implementation is in api routes

import { DebateSession } from './agents';

// Re-export types for convenience
export type { DebateSession };

// Seed topics for the UI
export const SEED_TOPICS = [
  "Is consciousness an illusion or fundamental to reality?",
  "Should humanity pursue immortality?",
  "Can artificial intelligence truly be creative?",
  "Is free will compatible with a deterministic universe?",
  "Should we colonize other planets or fix Earth first?",
  "Is privacy a human right in the digital age?",
  "Can money buy happiness?",
  "Is truth objective or subjective?",
  "Should genetic engineering shape the future of humanity?",
  "Is technology bringing us closer together or driving us apart?",
];
