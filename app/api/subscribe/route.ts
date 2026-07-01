import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { subscription, userId, reminderSettings } = await req.json();
    if (!subscription || !userId) {
      return Response.json({ error: 'Missing subscription or userId' }, { status: 400 });
    }
    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      subscription: JSON.stringify(subscription),
      reminder_settings: reminderSettings || {},
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (err: any) {
    console.error('Subscribe error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { userId } = await req.json();
    if (!userId) return Response.json({ error: 'Missing userId' }, { status: 400 });
    await supabase.from('push_subscriptions').delete().eq('user_id', userId);
    return Response.json({ ok: true });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
