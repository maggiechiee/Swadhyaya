import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

webpush.setVapidDetails(
  'mailto:support@swadhyaya.app',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

// Reminder messages by type and time of day
const REMINDERS = {
  morning: [
    { title: 'Good morning ✨', body: 'Time for your morning ritual. Start with sunlight.', tag: 'morning-ritual' },
    { title: 'Supplements 💊', body: 'Have you taken your morning supplements?', tag: 'supplements' },
  ],
  lunch: [
    { title: 'Log your lunch 🍱', body: 'What did you eat? Takes 30 seconds.', tag: 'food-log' },
  ],
  evening: [
    { title: 'Evening check-in 🌙', body: 'Log dinner and how you\'re feeling today.', tag: 'evening-log' },
  ],
  night: [
    { title: 'Bedtime 😴', body: 'Log your sleep time and tomorrow starts fresh.', tag: 'sleep-log' },
  ],
};

export async function GET(req: Request) {
  // Vercel Cron hits this with a secret to prevent abuse
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hour = new Date().getUTCHours() + 5; // IST = UTC+5:30 approx
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
      // Respect per-user reminder preferences
      if (settings[reminderType] === false) continue;
      await webpush.sendNotification(JSON.parse(row.subscription), JSON.stringify(msg));
      sent++;
    } catch (err: any) {
      console.error('Push failed for user', row.user_id, err.message);
      // Remove stale subscriptions
      if (err.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('user_id', row.user_id);
      }
    }
  }

  return Response.json({ sent, type: reminderType });
}
