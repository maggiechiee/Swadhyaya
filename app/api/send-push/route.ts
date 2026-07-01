import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const REMINDERS = {
  morning: [
    { title: 'Good morning \u2728', body: 'Time for your morning ritual. Start with sunlight.', tag: 'morning-ritual' },
    { title: 'Supplements \uD83D\uDC8A', body: 'Have you taken your morning supplements?', tag: 'supplements' },
  ],
  lunch: [
    { title: 'Log your lunch \uD83C\uDF71', body: 'What did you eat? Takes 30 seconds.', tag: 'food-log' },
  ],
  evening: [
    { title: 'Evening check-in \uD83C\uDF19', body: 'Log dinner and how you\'re feeling today.', tag: 'evening-log' },
  ],
  night: [
    { title: 'Bedtime \uD83D\uDE34', body: 'Log your sleep time and tomorrow starts fresh.', tag: 'sleep-log' },
  ],
};

async function sendWebPush(subscription: any, payload: string) {
  const sub = typeof subscription === 'string' ? JSON.parse(subscription) : subscription;
  const endpoint = sub.endpoint;
  const keys = sub.keys;

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY!;

  // Use the web-push npm package via dynamic import to avoid build-time issues
  const webpush = await import('web-push');
  webpush.default.setVapidDetails(
    'mailto:support@swadhyaya.app',
    vapidPublicKey,
    vapidPrivateKey
  );
  await webpush.default.sendNotification(sub, payload);
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hour = new Date().getUTCHours() + 5;
  let reminderType: keyof typeof REMINDERS | null = null;
  if (hour >= 6 && hour < 9) reminderType = 'morning';
  else if (hour >= 12 && hour < 14) reminderType = 'lunch';
  else if (hour >= 19 && hour < 21) reminderType = 'evening';
  else if (hour >= 22) reminderType = 'night';

  if (!reminderType) return Response.json({ skipped: true, hour });

  const { data: subs } = await supabase.from('push_subscriptions').select('*');
  if (!subs?.length) return Response.json({ sent: 0 });

  const messages = REMINDERS[reminderType];
  const msg = messages[Math.floor(Math.random() * messages.length)];
  let sent = 0;

  for (const row of subs) {
    try {
      const settings = row.reminder_settings || {};
      if (settings[reminderType] === false) continue;
      await sendWebPush(row.subscription, JSON.stringify(msg));
      sent++;
    } catch (err: any) {
      console.error('Push failed for user', row.user_id, err.message);
      if (err.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('user_id', row.user_id);
      }
    }
  }

  return Response.json({ sent, type: reminderType });
}
