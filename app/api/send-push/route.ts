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

// IST is UTC+5:30, not a flat +5 -- the previous version was off by half an
// hour, which matters right at the edges of each reminder window.
function getISTDateStr(): string {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const year = ist.getUTCFullYear();
  const month = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const day = String(ist.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getISTHour(): number {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return ist.getUTCHours();
}

// Mirrors taskOccursOnDate() in components/Swadhyaya.jsx -- keep these two
// in sync if the recurrence rules ever change on the client.
type Task = {
  startDate?: string;
  endDate?: string;
  recurrence?: string;
  weekDays?: number[];
  everyNDays?: string | number;
  title?: string;
};

function taskOccursOnDate(task: Task, dateStr: string): boolean {
  if (!task.startDate) return false;
  if (dateStr < task.startDate) return false;
  if (task.endDate && dateStr > task.endDate) return false;
  const d = new Date(dateStr + 'T12:00:00');
  const start = new Date(task.startDate + 'T12:00:00');
  switch (task.recurrence) {
    case 'once': return dateStr === task.startDate;
    case 'daily': return true;
    case 'weekly': return (task.weekDays || []).includes(d.getDay());
    case 'monthly': return d.getDate() === start.getDate();
    case 'custom': {
      const every = parseInt(String(task.everyNDays), 10) || 1;
      const diff = Math.round((d.getTime() - start.getTime()) / 86400000);
      return diff >= 0 && diff % every === 0;
    }
    default: return false;
  }
}

type Goal = { targetDate?: string; title?: string; done?: boolean };

// Builds today's digest for one user. Returns null when there's nothing due,
// so the caller can fall back to the existing canned morning message instead
// of sending an empty-sounding notification.
function buildDigest(tasks: Task[], goals: Goal[], todayStr: string): { title: string; body: string; tag: string } | null {
  const dueTasks = (tasks || []).filter(t => taskOccursOnDate(t, todayStr));
  const dueGoals = (goals || []).filter(g => g.targetDate === todayStr && !g.done);

  const total = dueTasks.length + dueGoals.length;
  if (total === 0) return null;

  const names = [...dueTasks.map(t => t.title), ...dueGoals.map(g => g.title)].filter(Boolean) as string[];
  const preview = names.slice(0, 3).join(', ');
  const extra = names.length > 3 ? ` +${names.length - 3} more` : '';

  return {
    title: `Today: ${total} to do \u2728`,
    body: `${preview}${extra}`,
    tag: 'daily-digest',
  };
}

async function sendWebPush(subscription: any, payload: string) {
  const sub = typeof subscription === 'string' ? JSON.parse(subscription) : subscription;

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

  const hour = getISTHour();
  let reminderType: keyof typeof REMINDERS | null = null;
  if (hour >= 6 && hour < 9) reminderType = 'morning';
  else if (hour >= 12 && hour < 14) reminderType = 'lunch';
  else if (hour >= 19 && hour < 21) reminderType = 'evening';
  else if (hour >= 22) reminderType = 'night';

  if (!reminderType) return Response.json({ skipped: true, hour });

  const { data: subs } = await supabase.from('push_subscriptions').select('*');
  if (!subs?.length) return Response.json({ sent: 0 });

  const messages = REMINDERS[reminderType];
  const fallbackMsg = messages[Math.floor(Math.random() * messages.length)];
  const todayStr = getISTDateStr();
  let sent = 0;
  let digestsSent = 0;

  for (const row of subs) {
    try {
      const settings = row.reminder_settings || {};
      if (settings[reminderType] === false) continue;

      let msg = fallbackMsg;

      // Only the morning slot gets personalized -- lunch/evening/night stay
      // as lightweight canned nudges so the digest doesn't feel repeated
      // four times a day.
      if (reminderType === 'morning') {
        const { data: profileRow } = await supabase
          .from('profiles')
          .select('tasks, goals')
          .eq('id', row.user_id)
          .single();

        const digest = profileRow
          ? buildDigest(profileRow.tasks || [], profileRow.goals || [], todayStr)
          : null;

        if (digest) {
          msg = { ...digest, url: '/?section=today' } as any;
          digestsSent++;
        }
      }

      await sendWebPush(row.subscription, JSON.stringify(msg));
      sent++;
    } catch (err: any) {
      console.error('Push failed for user', row.user_id, err.message);
      if (err.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('user_id', row.user_id);
      }
    }
  }

  return Response.json({ sent, digestsSent, type: reminderType });
}
