package com.kejian.planner;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.Instant;
import java.util.HashSet;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/** Persist plans outside the WebView, and keep only the next alarm in Android. */
public final class ReminderScheduler {
    public static final String REMIND = "com.kejian.planner.REMIND", TEST = "com.kejian.planner.TEST_REMINDER";
    private static final String CHANNEL = "deadlines-v1";
    private static SharedPreferences prefs(Context context) { return context.getSharedPreferences("reminders-v1", Context.MODE_PRIVATE); }
    private static NotificationManager notifications(Context context) { return context.getSystemService(NotificationManager.class); }
    private static AlarmManager alarms(Context context) { return context.getSystemService(AlarmManager.class); }
    public static void createChannel(Context context) {
        NotificationChannel channel = new NotificationChannel(CHANNEL, "作业、考试与活动提醒", NotificationManager.IMPORTANCE_DEFAULT);
        channel.setDescription("在作业截止、考试或活动开始前 6 小时和前 3 小时各提醒一次，点击通知查看计划。");
        notifications(context).createNotificationChannel(channel);
    }
    public static boolean notificationsAllowed(Context context) {
        createChannel(context);
        if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return false;
        NotificationChannel channel = notifications(context).getNotificationChannel(CHANNEL);
        return notifications(context).areNotificationsEnabled() && channel != null && channel.getImportance() != NotificationManager.IMPORTANCE_NONE;
    }
    public static boolean exactAllowed(Context context) { return Build.VERSION.SDK_INT < 31 || alarms(context).canScheduleExactAlarms(); }
    private static PendingIntent alarmIntent(Context context, boolean test) {
        Intent intent = new Intent(context, ReminderReceiver.class).setAction(test ? TEST : REMIND).setData(Uri.parse(test ? "kejian://test-reminder" : "kejian://reminders"));
        return PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    private static JSONArray plans(Context context) {
        try { return new JSONArray(prefs(context).getString("plans", "[]")); } catch (Exception error) { return new JSONArray(); }
    }
    private static JSONObject sent(Context context) {
        try { return new JSONObject(prefs(context).getString("sent", "{}")); } catch (Exception error) { return new JSONObject(); }
    }
    private static int sentMask(JSONObject sent, JSONObject entry) {
        JSONObject record = sent.optJSONObject(entry.optString("id"));
        // v1 stored id -> date for a previous-day reminder, not either of the new stages.
        if (record == null) return 0;
        return ReminderTime.sentMask(entry.optString("date"), record.optString("date"), record.optBoolean("sixHours"), record.optBoolean("threeHours"));
    }
    private static long trigger(JSONObject entry, JSONObject sent, long now) {
        try {
            ZoneId zone = ZoneId.systemDefault();
            return ReminderTime.nextTrigger(now, ReminderTime.deadlineMillis(entry.getString("date"), zone), entry.optBoolean("reminder", true), entry.optBoolean("done", false), sentMask(sent, entry));
        } catch (Exception error) { return -1; }
    }
    public static synchronized void sync(Context context, String raw) throws Exception {
        if (raw == null || raw.length() > 10 * 1024 * 1024) throw new IllegalArgumentException("Too much reminder data");
        JSONObject backup = new JSONObject(raw);
        if (backup.getInt("version") != 1) throw new IllegalArgumentException("Unknown version");
        JSONArray incoming = backup.getJSONArray("entries"), normalized = new JSONArray();
        if (incoming.length() > 5000) throw new IllegalArgumentException("Too many entries");
        Set<String> ids = new HashSet<>();
        Map<String, JSONObject> replacements = new HashMap<>();
        for (int i = 0; i < incoming.length(); i++) {
            JSONObject entry = incoming.getJSONObject(i);
            String id = entry.getString("id"), date = entry.getString("date"), subject = entry.getString("subject"), title = entry.getString("title"), kind = entry.getString("kind");
            if (id.isEmpty() || id.length() > 100 || !ids.add(id) || subject.length() > 40 || title.length() > 120 || !("homework".equals(kind) || "exam".equals(kind) || "activity".equals(kind))) throw new IllegalArgumentException("Invalid reminder");
            ReminderTime.deadlineMillis(date, ZoneId.systemDefault());
            JSONObject record = new JSONObject().put("id", id).put("date", date).put("subject", subject).put("title", title).put("kind", kind).put("done", entry.getBoolean("done")).put("reminder", entry.optBoolean("reminder", true));
            normalized.put(record);
            replacements.put(id, record);
        }
        JSONArray old = plans(context);
        JSONObject delivered = sent(context);
        for (int i = 0; i < old.length(); i++) {
            JSONObject previous = old.getJSONObject(i), replacement = replacements.get(previous.getString("id"));
            String id = previous.getString("id");
            if (replacement == null || replacement.optBoolean("done") || !replacement.optBoolean("reminder", true) || !previous.getString("date").equals(replacement.getString("date"))) notifications(context).cancel(id, 0);
            if (replacement == null || !previous.getString("date").equals(replacement.getString("date"))) delivered.remove(id);
        }
        if (!prefs(context).edit().putString("plans", normalized.toString()).putString("sent", delivered.toString()).commit()) throw new IllegalStateException("Cannot save reminders");
        reschedule(context);
    }
    public static synchronized void reschedule(Context context) {
        PendingIntent operation = alarmIntent(context, false);
        alarms(context).cancel(operation);
        if (!notificationsAllowed(context)) return;
        JSONArray entries = plans(context);JSONObject delivered = sent(context);long now = System.currentTimeMillis(), next = Long.MAX_VALUE;
        for (int i = 0; i < entries.length(); i++) {
            JSONObject entry = entries.optJSONObject(i);if (entry == null) continue;
            long at = trigger(entry, delivered, now);if (at > 0) next = Math.min(next, at);
        }
        if (next != Long.MAX_VALUE) schedule(context, next, operation);
    }
    private static void schedule(Context context, long at, PendingIntent operation) {
        if (exactAllowed(context)) {
            try {alarms(context).setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, operation);return;} catch (SecurityException ignored) {}
        }
        alarms(context).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, operation);
    }
    public static synchronized void deliverDue(Context context) {
        if (!notificationsAllowed(context)) return;
        JSONArray entries = plans(context);JSONObject delivered = sent(context);long now = System.currentTimeMillis();ZoneId zone = ZoneId.systemDefault();
        for (int i = 0; i < entries.length(); i++) {
            JSONObject entry = entries.optJSONObject(i);if (entry == null) continue;
            try {
                String date = entry.getString("date"), id = entry.getString("id");
                long deadline = ReminderTime.deadlineMillis(date, zone);
                int mask = sentMask(delivered, entry);
                int stage = ReminderTime.dueStage(now, deadline, entry.optBoolean("reminder", true), entry.optBoolean("done"), mask);
                if (stage == ReminderTime.NONE) continue;
                boolean exam = "exam".equals(entry.optString("kind"));
                boolean activity = "activity".equals(entry.optString("kind"));
                String label = (activity ? "活动提醒" : entry.optString("subject") + (exam ? " · 考试提醒" : " · 作业截止提醒")) + " · 提前 " + stage + " 小时";
                String when = DateTimeFormatter.ofPattern("M 月 d 日 HH:mm").withZone(zone).format(Instant.ofEpochMilli(deadline));
                post(context, id, label, entry.optString("title") + "\n" + (activity ? "活动时间：" : exam ? "考试时间：" : "截止时间：") + when + "。提前安排，留一点从容。", id);
                int updatedMask = ReminderTime.markSent(mask, stage);
                delivered.put(id, new JSONObject().put("date", date).put("sixHours", (updatedMask & ReminderTime.SENT_SIX_HOURS) != 0).put("threeHours", (updatedMask & ReminderTime.SENT_THREE_HOURS) != 0));
            } catch (Exception ignored) { /* A malformed or revoked record must not stop other reminders. */ }
        }
        prefs(context).edit().putString("sent", delivered.toString()).commit();
        reschedule(context);
    }
    private static void post(Context context, String tag, String title, String content, String id) {
        Intent open = new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP).setData(Uri.parse("kejian://entry/" + Uri.encode(id))).putExtra("entryId", id);
        PendingIntent click = PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification notification = new Notification.Builder(context, CHANNEL).setSmallIcon(android.R.drawable.ic_popup_reminder).setContentTitle(title).setContentText(content.replace('\n', ' ')).setStyle(new Notification.BigTextStyle().bigText(content)).setContentIntent(click).setAutoCancel(true).setCategory(Notification.CATEGORY_REMINDER).build();
        notifications(context).notify(tag, 0, notification);
    }
    public static synchronized String status(Context context) {
        JSONArray entries = plans(context);JSONObject delivered = sent(context), status = new JSONObject();long now = System.currentTimeMillis(), next = Long.MAX_VALUE;int count = 0;
        for (int i = 0; i < entries.length(); i++) {JSONObject entry = entries.optJSONObject(i);if (entry == null) continue;long at = trigger(entry, delivered, now);if (at > 0) {count++;next = Math.min(next, at);}}
        try {status.put("notifications", notificationsAllowed(context)).put("exact", exactAllowed(context)).put("count", count).put("next", next == Long.MAX_VALUE ? 0 : next);} catch (Exception ignored) {}
        return status.toString();
    }
    public static boolean hasPending(Context context) { try {return new JSONObject(status(context)).getInt("count") > 0;} catch (Exception error) {return false;} }
    public static void scheduleTest(Context context) {schedule(context, System.currentTimeMillis() + 10000, alarmIntent(context, true));}
    public static void deliverTest(Context context) {if (notificationsAllowed(context)) post(context, "reminder-test", "课间 · 测试提醒", "提醒通道正常。作业、考试与活动将在截止或开始前 6 小时和前 3 小时各提醒一次。", "");}
}
