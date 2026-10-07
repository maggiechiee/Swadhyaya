"use client";
import { useState, useEffect } from "react";

// Phone Clock apps are not open to websites. Android Chrome can hand a
// time to the built-in Clock app. Every phone can take a calendar file
// with an alert. While this tab is open, Swadhyaya also fires its own
// notification at the start time.

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const ICS_DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

export const EMOTIONS = [
  { id: "angry", label: "Angry" },
  { id: "sad", label: "Sad" },
  { id: "anxious", label: "Anxious" },
  { id: "overwhelmed", label: "Overwhelmed" },
  { id: "ashamed", label: "Ashamed" },
  { id: "numb", label: "Numb" },
  { id: "scared", label: "Scared" },
];

const TRIGGER_CHIPS = ["hunger", "poor sleep", "a person", "work", "money", "noise", "being ignored", "plans changed", "my body", "rejection"];
const BODY_CHIPS = ["heat", "tight chest", "crying", "shouting", "went quiet", "shaking"];

const CRISIS_RE = /suicid|kill myself|hurt myself|end my life|self-harm|self harm|want to die|don't want to live|do not want to live/i;

export function textLooksLikeCrisis(text) {
  return CRISIS_RE.test(text || "");
}

function pad(n) { return String(n).padStart(2, "0"); }

function formatClock(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(n => parseInt(n, 10));
  if (Number.isNaN(h)) return hhmm;
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 || 12;
  return `${hour}:${pad(m || 0)}${suffix}`;
}

function windowLabel(alarm) {
  if (alarm.endTime) return `${formatClock(alarm.startTime)}–${formatClock(alarm.endTime)}`;
  return formatClock(alarm.startTime);
}

function isAndroid() {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

export function openPhoneClock(alarm) {
  const [hour, minute] = (alarm.startTime || "0:0").split(":").map(n => parseInt(n, 10) || 0);
  const message = (alarm.title || "Reminder").replace(/[;#]/g, " ").slice(0, 80);
  const href = `intent:#Intent;action=android.intent.action.SET_ALARM;S.android.intent.extra.alarm.MESSAGE=${encodeURIComponent(message)};i.android.intent.extra.alarm.HOUR=${hour};i.android.intent.extra.alarm.MINUTES=${minute};end`;
  window.location.href = href;
}

function icsStamp(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function nextStart(alarm) {
  const [hour, minute] = (alarm.startTime || "09:00").split(":").map(n => parseInt(n, 10) || 0);
  const days = alarm.days && alarm.days.length ? alarm.days : [0, 1, 2, 3, 4, 5, 6];
  const now = new Date();
  for (let add = 0; add < 8; add++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + add, hour, minute, 0);
    if (!days.includes(d.getDay())) continue;
    if (d.getTime() > Date.now() - 60 * 1000) return d;
  }
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0);
}

function endFrom(start, alarm) {
  if (!alarm.endTime) return new Date(start.getTime() + 15 * 60 * 1000);
  const [hour, minute] = alarm.endTime.split(":").map(n => parseInt(n, 10) || 0);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate(), hour, minute, 0);
  if (end.getTime() <= start.getTime()) end.setDate(end.getDate() + 1);
  return end;
}

function localIcs(date) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
}

export function downloadCalendarAlarm(alarm) {
  const start = nextStart(alarm);
  const end = endFrom(start, alarm);
  const days = alarm.days && alarm.days.length ? alarm.days : [0, 1, 2, 3, 4, 5, 6];
  const byday = days.slice().sort((a, b) => a - b).map(d => ICS_DAYS[d]).join(",");
  const rule = days.length === 7 ? "FREQ=DAILY" : `FREQ=WEEKLY;BYDAY=${byday}`;
  const summary = (alarm.title || "Reminder").replace(/[,;\\]/g, " ");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Swadhyaya//Alarms//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:sw-${alarm.id || Date.now()}@swadhyaya`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${localIcs(start)}`,
    `DTEND:${localIcs(end)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${windowLabel(alarm)}`,
    `RRULE:${rule}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${summary}`,
    "TRIGGER:PT0S",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${summary.replace(/\s+/g, "-").toLowerCase() || "alarm"}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function isNativeApp() {
  return typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();
}

function alarmNotifId(alarmId, add) {
  const s = String(alarmId) + ":" + add;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
  return (h % 2000000000) + 1;
}

export async function scheduleNativeAlarms(alarms) {
  let Capacitor;
  let LocalNotifications;
  try {
    ({ Capacitor } = await import("@capacitor/core"));
    ({ LocalNotifications } = await import("@capacitor/local-notifications"));
  } catch (e) {
    return;
  }
  if (!Capacitor.isNativePlatform()) return;
  const perm = await LocalNotifications.requestPermissions();
  if (perm.display !== "granted") return;
  try {
    await LocalNotifications.createChannel({
      id: "swadhyaya-alarms",
      name: "Swadhyaya alarms",
      description: "Meals, practice, and reading",
      importance: 5,
      visibility: 1,
      sound: "default",
      vibration: true,
    });
  } catch (e) {}
  const pending = await LocalNotifications.getPending();
  if (pending.notifications && pending.notifications.length) {
    await LocalNotifications.cancel({
      notifications: pending.notifications.map(n => ({ id: n.id })),
    });
  }
  const notifications = [];
  const now = Date.now();
  (alarms || []).forEach(alarm => {
    if (!alarm.startTime) return;
    const parts = alarm.startTime.split(":");
    const hour = parseInt(parts[0], 10) || 0;
    const minute = parseInt(parts[1], 10) || 0;
    const days = alarm.days && alarm.days.length ? alarm.days : [0, 1, 2, 3, 4, 5, 6];
    for (let add = 0; add < 21; add++) {
      const when = new Date();
      when.setSeconds(0, 0);
      when.setDate(when.getDate() + add);
      when.setHours(hour, minute, 0, 0);
      if (when.getTime() <= now + 15000) continue;
      if (!days.includes(when.getDay())) continue;
      notifications.push({
        id: alarmNotifId(alarm.id || alarm.title, add),
        title: alarm.title || "Swadhyaya",
        body: windowLabel(alarm),
        schedule: { at: when, allowWhileIdle: true },
        channelId: "swadhyaya-alarms",
      });
    }
  });
  for (let i = 0; i < notifications.length; i += 40) {
    await LocalNotifications.schedule({ notifications: notifications.slice(i, i + 40) });
  }
}

export function AlarmScheduler({ alarms }) {
  useEffect(() => {
    scheduleNativeAlarms(alarms || []);
  }, [alarms]);
  return null;
}

function daysLabel(days) {
  if (!days || days.length === 0 || days.length === 7) return "Every day";
  return days.slice().sort((a, b) => a - b).map(d => DAY_LABELS[d]).join(" ");
}

function shiftDate(dateStr, delta) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function sleepHours(entry) {
  if (!entry || !entry.bedtime || !entry.wakeTime) return null;
  const [bh, bm] = String(entry.bedtime).split(":").map(n => parseInt(n, 10));
  const [wh, wm] = String(entry.wakeTime).split(":").map(n => parseInt(n, 10));
  if ([bh, bm, wh, wm].some(n => Number.isNaN(n))) return null;
  let mins = (wh * 60 + wm) - (bh * 60 + bm);
  if (mins <= 0) mins += 24 * 60;
  return mins / 60;
}

export function buildFeelingInsight(logs, foodLogs, journalEntries) {
  const today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  })();
  const from = shiftDate(today, -13);
  const recent = (logs || []).filter(l => l.date >= from && l.date <= today);
  if (recent.length < 2) return { ready: false, recentCount: recent.length };

  const byTrigger = {};
  recent.forEach(l => {
    const t = (l.trigger || "").trim().toLowerCase();
    if (!t) return;
    if (!byTrigger[t]) byTrigger[t] = [];
    byTrigger[t].push(l);
  });
  const ranked = Object.entries(byTrigger).sort((a, b) => b[1].length - a[1].length);
  const top = ranked[0];
  const high = recent.filter(l => Number(l.intensity) >= 7);
  const angryOrSad = recent.filter(l => l.emotion === "angry" || l.emotion === "sad");
  const foodDates = new Set((foodLogs || []).map(f => String(f.date || "").slice(0, 10)).filter(Boolean));
  const noFood = recent.filter(l => !foodDates.has(l.date));
  const shortSleepDays = new Set();
  (journalEntries || []).forEach(j => {
    const hours = sleepHours(j);
    const date = String(j.date || "").slice(0, 10);
    if (date && hours != null && hours < 6) shortSleepDays.add(date);
  });
  const shortSleepHits = recent.filter(l => shortSleepDays.has(l.date));

  const lines = [`In the last 14 days you logged ${recent.length} episodes.`];
  if (angryOrSad.length) lines.push(`${angryOrSad.length} were angry or sad.`);
  if (top) lines.push(`The trigger you named most is “${top[0]}” (${top[1].length} ${top[1].length === 1 ? "time" : "times"}).`);
  if (ranked[1]) lines.push(`Next is “${ranked[1][0]}” (${ranked[1][1].length}).`);
  if (high.length) lines.push(`${high.length} reached intensity 7 or higher.`);
  if (noFood.length >= 2) lines.push(`${noFood.length} happened on days with no food logged. An empty stomach often makes anger and sadness sharper.`);
  if (shortSleepHits.length >= 2) lines.push(`${shortSleepHits.length} landed on days your sleep log was under 6 hours.`);

  const repeatingTrigger = top && top[1].length >= 3 && top[1].filter(x => Number(x.intensity) >= 6).length >= 2;
  const suggest = high.length >= 4 || repeatingTrigger || angryOrSad.length >= 6;
  const supportText = suggest
    ? "This is repeating often enough that talking to a counsellor is a reasonable next step. Swadhyaya can show the pattern in your moods, triggers, food, and sleep. It cannot diagnose you, and it is not treatment."
    : "Keep logging the spike and the trigger. Two weeks of this is enough for the pattern to get specific.";

  return { ready: true, lines, suggest, supportText, recentCount: recent.length };
}

function cardStyle(C) {
  return { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 18px" };
}

function CrisisBox({ C }) {
  return (
    <div style={{ background: "rgba(180,40,40,0.35)", border: "1px solid rgba(248,113,113,0.7)", borderRadius: 14, padding: "16px 18px" }}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>If you might hurt yourself, contact a person now.</div>
      <div style={{ fontSize: 13, lineHeight: 1.7, color: C.text }}>
        India: Tele-MANAS 14416, iCall 9152987821, Vandrevala 1860-2662-345. If you are in immediate danger, call your local emergency number.
      </div>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 8, lineHeight: 1.6 }}>This app can keep the note. It cannot keep you safe in a crisis.</div>
    </div>
  );
}

export function AlarmsSection({ C, profile, up }) {
  const alarms = profile.alarms || [];
  const [draft, setDraft] = useState({ title: "", startTime: "13:00", endTime: "13:30", days: [0, 1, 2, 3, 4, 5, 6] });
  const [note, setNote] = useState("");
  const android = isAndroid();
  const [native, setNative] = useState(false);
  useEffect(() => { setNative(isNativeApp()); }, []);

  function toggleDay(day) {
    setDraft(d => {
      const has = d.days.includes(day);
      const days = has ? d.days.filter(x => x !== day) : [...d.days, day];
      return { ...d, days };
    });
  }

  function addAlarm() {
    const title = draft.title.trim();
    if (!title || !draft.startTime) {
      setNote("Add a name and a start time.");
      return;
    }
    const alarm = {
      id: Date.now(),
      title,
      startTime: draft.startTime,
      endTime: draft.endTime || "",
      days: draft.days.length ? draft.days : [0, 1, 2, 3, 4, 5, 6],
    };
    up("alarms", [...alarms, alarm].slice(0, 30));
    setDraft({ title: "", startTime: draft.startTime, endTime: "", days: draft.days });
    setNote(isNativeApp()
      ? "Saved. This phone will ring at that time, even if Swadhyaya is closed."
      : "Saved. Install the Swadhyaya app on your phone so this rings with the screen locked. From a browser, use the phone clock or calendar.");
  }

  function addPreset(preset) {
    const exists = alarms.some(a => a.title === preset.title && a.startTime === preset.startTime);
    if (exists) return;
    up("alarms", [...alarms, { ...preset, id: Date.now(), days: [0, 1, 2, 3, 4, 5, 6] }].slice(0, 30));
  }

  async function enableWhileOpen() {
    if (typeof Notification === "undefined") {
      setNote("This browser cannot show notifications.");
      return;
    }
    const permission = await Notification.requestPermission();
    setNote(permission === "granted"
      ? "While this tab is open, Swadhyaya will notify you at the start time. The phone clock or calendar is what rings when the app is closed."
      : "Notification permission was not granted. You can still use the phone clock or calendar.");
  }

  const sorted = alarms.slice().sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));

  return (
    <div style={{ padding: "18px 16px 40px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={{ fontSize: 28, fontFamily: "'Cormorant Garamond',serif", fontStyle: "italic" }}>Alarms</div>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, marginTop: 6 }}>
          {native ? "Lunch at 1, uke from 3 to 4, reading from 10 to 10:30. These ring on this phone even when the app is closed." : "Lunch at 1, uke from 3 to 4, reading from 10 to 10:30. Install the Swadhyaya app for alarms that ring with the phone locked. In a browser, use the phone clock or calendar."}
        </div>
      </div>

      <div style={cardStyle(C)}>
        <div style={{ fontSize: 11, color: C.accent, fontFamily: "'DM Mono',monospace", letterSpacing: 2, marginBottom: 12 }}>NEW ALARM</div>
        <input value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} placeholder="Lunch, play uke, read" style={inputStyle(C)} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
          <label style={{ fontSize: 11, color: C.muted }}>Start
            <input type="time" value={draft.startTime} onChange={e => setDraft(d => ({ ...d, startTime: e.target.value }))} style={{ ...inputStyle(C), marginTop: 4 }} />
          </label>
          <label style={{ fontSize: 11, color: C.muted }}>End, optional
            <input type="time" value={draft.endTime} onChange={e => setDraft(d => ({ ...d, endTime: e.target.value }))} style={{ ...inputStyle(C), marginTop: 4 }} />
          </label>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
          {DAY_LABELS.map((label, day) => {
            const on = draft.days.includes(day);
            return (
              <button key={day} onClick={() => toggleDay(day)} style={{
                width: 32, height: 32, borderRadius: 16, border: `1px solid ${on ? C.accent : C.border}`,
                background: on ? C.accent : "transparent", color: on ? "#fff" : C.muted, cursor: "pointer", fontSize: 12,
              }}>{label}</button>
            );
          })}
        </div>
        <button onClick={addAlarm} style={primaryBtn(C)}>Save alarm</button>
        {note && <div style={{ fontSize: 12, color: C.muted, marginTop: 10, lineHeight: 1.6 }}>{note}</div>}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[
          { title: "Lunch", startTime: "13:00", endTime: "13:30" },
          { title: "Play uke", startTime: "15:00", endTime: "16:00" },
          { title: "Read", startTime: "22:00", endTime: "22:30" },
        ].map(p => (
          <button key={p.title} onClick={() => addPreset(p)} style={ghostBtn(C)}>{p.title} · {windowLabel(p)}</button>
        ))}
      </div>

      <button onClick={enableWhileOpen} style={ghostBtn(C)}>Also notify while this app is open</button>

      {sorted.map(alarm => (
        <div key={alarm.id} style={cardStyle(C)}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{alarm.title}</div>
              <div style={{ fontSize: 13, color: C.accent, marginTop: 2 }}>{windowLabel(alarm)}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{daysLabel(alarm.days)}</div>
            </div>
            <button onClick={() => up("alarms", alarms.filter(a => a.id !== alarm.id))} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 12 }}>Delete</button>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {android && <button onClick={() => openPhoneClock(alarm)} style={primaryBtn(C, true)}>Set on phone clock</button>}
            <button onClick={() => downloadCalendarAlarm(alarm)} style={ghostBtn(C)}>Add to calendar</button>
          </div>
          {!android && <div style={{ fontSize: 11, color: C.muted, marginTop: 8, lineHeight: 1.6 }}>iPhone cannot hand an alarm to the Clock app from a website. Add to calendar, then allow the alert. That rings with the phone locked.</div>}
        </div>
      ))}

      {sorted.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>No alarms yet.</div>}
    </div>
  );
}

export function FeelingsSection({ C, profile, up, foodLogs, journalEntries }) {
  const logs = profile.feelingLogs || [];
  const now = new Date();
  const [draft, setDraft] = useState({
    emotion: "angry",
    intensity: 7,
    trigger: "",
    note: "",
    body: "",
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
  });
  const crisis = textLooksLikeCrisis(`${draft.trigger} ${draft.note}`);
  const insight = buildFeelingInsight(logs, foodLogs, journalEntries);

  function save() {
    if (!draft.trigger.trim() && !draft.note.trim()) return;
    const entry = {
      id: Date.now(),
      emotion: draft.emotion,
      intensity: Number(draft.intensity) || 1,
      trigger: draft.trigger.trim(),
      note: draft.note.trim(),
      body: draft.body,
      date: draft.date,
      time: draft.time,
    };
    up("feelingLogs", [entry, ...logs].slice(0, 400));
    setDraft(d => ({ ...d, trigger: "", note: "", body: "" }));
  }

  const grouped = {};
  logs.forEach(l => {
    if (!grouped[l.date]) grouped[l.date] = [];
    grouped[l.date].push(l);
  });
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div style={{ padding: "18px 16px 40px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={{ fontSize: 28, fontFamily: "'Cormorant Garamond',serif", fontStyle: "italic" }}>Feelings</div>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, marginTop: 6 }}>
          Log the spike while it is hot, or later the same day. You can come back and read: this date, this feeling, this trigger.
        </div>
      </div>

      {crisis && <CrisisBox C={C} />}

      <div style={cardStyle(C)}>
        <div style={{ fontSize: 11, color: C.accent, fontFamily: "'DM Mono',monospace", letterSpacing: 2, marginBottom: 12 }}>THIS EPISODE</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {EMOTIONS.map(e => (
            <button key={e.id} onClick={() => setDraft(d => ({ ...d, emotion: e.id }))} style={{
              padding: "6px 10px", borderRadius: 20, cursor: "pointer", fontSize: 12,
              border: `1px solid ${draft.emotion === e.id ? C.accent : C.border}`,
              background: draft.emotion === e.id ? C.accent : "transparent",
              color: draft.emotion === e.id ? "#fff" : C.text,
            }}>{e.label}</button>
          ))}
        </div>
        <label style={{ fontSize: 12, color: C.muted }}>Intensity {draft.intensity}/10
          <input type="range" min="1" max="10" value={draft.intensity} onChange={e => setDraft(d => ({ ...d, intensity: e.target.value }))} style={{ width: "100%", marginTop: 6 }} />
        </label>
        <div style={{ fontSize: 11, color: C.muted, margin: "12px 0 6px" }}>Trigger</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {TRIGGER_CHIPS.map(chip => (
            <button key={chip} onClick={() => setDraft(d => ({ ...d, trigger: chip }))} style={ghostBtn(C)}>{chip}</button>
          ))}
        </div>
        <input value={draft.trigger} onChange={e => setDraft(d => ({ ...d, trigger: e.target.value }))} placeholder="What set it off" style={inputStyle(C)} />
        <div style={{ fontSize: 11, color: C.muted, margin: "12px 0 6px" }}>In the body</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {BODY_CHIPS.map(chip => (
            <button key={chip} onClick={() => setDraft(d => ({ ...d, body: d.body === chip ? "" : chip }))} style={{
              ...ghostBtn(C),
              border: `1px solid ${draft.body === chip ? C.accent : C.border}`,
              color: draft.body === chip ? C.accent : C.muted,
            }}>{chip}</button>
          ))}
        </div>
        <textarea value={draft.note} onChange={e => setDraft(d => ({ ...d, note: e.target.value }))} placeholder="What happened, in a few lines" rows={3} style={{ ...inputStyle(C), marginTop: 8, resize: "vertical" }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
          <input type="date" value={draft.date} onChange={e => setDraft(d => ({ ...d, date: e.target.value }))} style={inputStyle(C)} />
          <input type="time" value={draft.time} onChange={e => setDraft(d => ({ ...d, time: e.target.value }))} style={inputStyle(C)} />
        </div>
        <button onClick={save} style={primaryBtn(C)}>Save this episode</button>
      </div>

      <div style={cardStyle(C)}>
        <div style={{ fontSize: 11, color: C.accent, fontFamily: "'DM Mono',monospace", letterSpacing: 2, marginBottom: 10 }}>WHAT THE LOGS SHOW</div>
        {!insight.ready && <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.7 }}>Log at least two episodes. Then this reads them against your food log and sleep, and says whether the pattern is worth taking to a counsellor.</div>}
        {insight.ready && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {insight.lines.map((line, i) => <div key={i} style={{ fontSize: 14, lineHeight: 1.65 }}>{line}</div>)}
            <div style={{ fontSize: 14, lineHeight: 1.7, marginTop: 4, color: insight.suggest ? "#fecaca" : C.text }}>{insight.supportText}</div>
          </div>
        )}
      </div>

      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.7 }}>
        Help, if you want a person: Tele-MANAS 14416 · iCall 9152987821 · Vandrevala 1860-2662-345. Outside India, use a local crisis line.
      </div>

      {dates.map(date => (
        <div key={date}>
          <div style={{ fontSize: 12, color: C.accent, fontFamily: "'DM Mono',monospace", letterSpacing: 1, margin: "6px 0" }}>{date}</div>
          {grouped[date].map(entry => {
            const emotion = EMOTIONS.find(e => e.id === entry.emotion);
            return (
              <div key={entry.id} style={{ ...cardStyle(C), marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{emotion ? emotion.label : entry.emotion} · {entry.intensity}/10</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{entry.time}</div>
                </div>
                {entry.trigger && <div style={{ fontSize: 13, marginTop: 6 }}>Trigger: {entry.trigger}</div>}
                {entry.body && <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Body: {entry.body}</div>}
                {entry.note && <div style={{ fontSize: 13, color: C.text, marginTop: 6, lineHeight: 1.6 }}>{entry.note}</div>}
                {textLooksLikeCrisis(`${entry.trigger} ${entry.note}`) && <div style={{ marginTop: 10 }}><CrisisBox C={C} /></div>}
                <button onClick={() => up("feelingLogs", logs.filter(l => l.id !== entry.id))} style={{ marginTop: 8, background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 11 }}>Remove</button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function inputStyle(C) {
  return {
    width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.border}`,
    background: "rgba(0,0,0,0.25)", color: C.text, fontSize: 14,
  };
}

function primaryBtn(C, compact) {
  return {
    marginTop: compact ? 0 : 12, padding: compact ? "8px 12px" : "11px 16px", borderRadius: 12, border: "none",
    background: `linear-gradient(135deg,${C.accent},${C.warm || C.accent})`, color: "#fff",
    cursor: "pointer", fontSize: 13, fontWeight: 600,
  };
}

function ghostBtn(C) {
  return {
    padding: "8px 12px", borderRadius: 20, border: `1px solid ${C.border}`, background: "transparent",
    color: C.muted, cursor: "pointer", fontSize: 12,
  };
}
