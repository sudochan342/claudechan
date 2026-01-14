import { NextRequest, NextResponse } from 'next/server';
import {
  getPopularTopics,
  getRecentDebates,
  recordReaction,
  saveTopicSubmission,
  getAnalytics,
} from '@/lib/logging.server';

// GET - Fetch topics and analytics
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'popular';

  try {
    switch (type) {
      case 'popular':
        const topics = await getPopularTopics(10);
        return NextResponse.json({ topics });

      case 'recent':
        const debates = await getRecentDebates(20);
        return NextResponse.json({ debates });

      case 'analytics':
        const analytics = await getAnalytics();
        return NextResponse.json({ analytics });

      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Topics API error:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}

// POST - Submit topic or reaction
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, topic, debateId, reaction } = body;

    switch (action) {
      case 'submit_topic':
        if (!topic) {
          return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
        }
        await saveTopicSubmission(topic);
        return NextResponse.json({ success: true });

      case 'react':
        if (!debateId || !reaction) {
          return NextResponse.json({ error: 'debateId and reaction are required' }, { status: 400 });
        }
        if (!['agree', 'disagree', 'mindblown'].includes(reaction)) {
          return NextResponse.json({ error: 'Invalid reaction' }, { status: 400 });
        }
        await recordReaction(debateId, reaction);
        return NextResponse.json({ success: true });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Topics API error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
