import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { cleanEmailReplyContent } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const supabase = getServiceClient();
    const body = await request.json().catch(() => ({}));
    const limit = typeof body?.limit === 'number' ? Math.min(Math.max(body.limit, 1), 2000) : 500;
    const dryRun = Boolean(body?.dryRun);

    const { data: activities, error: activitiesError } = await supabase
      .from('activities')
      .select('id, content, metadata, channel, type')
      .eq('channel', 'email')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (activitiesError) {
      return NextResponse.json({ error: 'Failed to fetch activities', details: activitiesError.message }, { status: 500 });
    }

    let activitiesUpdated = 0;
    for (const activity of activities || []) {
      const cleaned = cleanEmailReplyContent(activity.content || '');
      if (!cleaned.cleanedContent || cleaned.cleanedContent === activity.content) continue;
      activitiesUpdated += 1;
      if (!dryRun) {
        const currentMetadata =
          activity.metadata && typeof activity.metadata === 'object' && !Array.isArray(activity.metadata)
            ? activity.metadata
            : {};
        await supabase
          .from('activities')
          .update({
            content: cleaned.cleanedContent,
            metadata: {
              ...currentMetadata,
              raw_content: currentMetadata.raw_content || activity.content,
              email_cleaned: true,
            },
          })
          .eq('id', activity.id);
      }
    }

    // Legacy table fallback data cleanup.
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('id, content, channel')
      .eq('channel', 'email')
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (messagesError) {
      return NextResponse.json({ error: 'Failed to fetch legacy messages', details: messagesError.message }, { status: 500 });
    }

    let messagesUpdated = 0;
    for (const message of messages || []) {
      const cleaned = cleanEmailReplyContent(message.content || '');
      if (!cleaned.cleanedContent || cleaned.cleanedContent === message.content) continue;
      messagesUpdated += 1;
      if (!dryRun) {
        await supabase.from('messages').update({ content: cleaned.cleanedContent }).eq('id', message.id);
      }
    }

    return NextResponse.json({
      ok: true,
      dryRun,
      scanned: {
        activities: (activities || []).length,
        messages: (messages || []).length,
      },
      updated: {
        activities: activitiesUpdated,
        messages: messagesUpdated,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Backfill failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
