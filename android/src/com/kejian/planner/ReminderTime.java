package com.kejian.planner;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

/** Platform-independent reminder rules, shared with the JVM checks. */
public final class ReminderTime {
    public static final int NONE = 0, SIX_HOURS = 6, THREE_HOURS = 3;
    public static final int SENT_SIX_HOURS = 1, SENT_THREE_HOURS = 2;
    private static final long HOUR_MILLIS = 60 * 60 * 1000L;
    private ReminderTime() {}
    private static LocalDateTime parse(String date) {
        if (date == null || !date.matches("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}")) throw new IllegalArgumentException("Invalid deadline");
        return LocalDateTime.parse(date, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
    }
    public static long deadlineMillis(String date, ZoneId zone) { return parse(date).atZone(zone).toInstant().toEpochMilli(); }
    public static long reminderMillis(String date, ZoneId zone, int hours) {
        if (hours != SIX_HOURS && hours != THREE_HOURS) throw new IllegalArgumentException("Invalid reminder stage");
        return deadlineMillis(date, zone) - hours * HOUR_MILLIS;
    }
    /** Old one-day notifications have no stage flags and do not suppress the new reminders. */
    public static int sentMask(String date, String sentDate, boolean sixHours, boolean threeHours) {
        if (date == null || !date.equals(sentDate)) return 0;
        return (sixHours ? SENT_SIX_HOURS : 0) | (threeHours ? SENT_THREE_HOURS : 0);
    }
    private static int nextStage(long now, long deadline, boolean enabled, boolean done, int sentMask) {
        if (!enabled || done || deadline <= now || (sentMask & SENT_THREE_HOURS) != 0) return NONE;
        // After sleep or a late addition, only the most recent reminder window is useful.
        if (now >= deadline - THREE_HOURS * HOUR_MILLIS || (sentMask & SENT_SIX_HOURS) != 0) return THREE_HOURS;
        return SIX_HOURS;
    }
    public static long nextTrigger(long now, long deadline, boolean enabled, boolean done, int sentMask) {
        int stage = nextStage(now, deadline, enabled, done, sentMask);
        if (stage == NONE) return -1;
        long reminder = deadline - stage * HOUR_MILLIS;
        // A brief scheduling margin must never push a last-second reminder past its deadline.
        return Math.min(Math.max(reminder, now + 2000), deadline - 1);
    }
    public static int dueStage(long now, long deadline, boolean enabled, boolean done, int sentMask) {
        int stage = nextStage(now, deadline, enabled, done, sentMask);
        return stage != NONE && now >= deadline - stage * HOUR_MILLIS ? stage : NONE;
    }
    public static int markSent(int sentMask, int stage) {
        if (stage == SIX_HOURS) return sentMask | SENT_SIX_HOURS;
        // Retire a missed six-hour stage too so a clock change cannot resurrect it.
        if (stage == THREE_HOURS) return sentMask | SENT_SIX_HOURS | SENT_THREE_HOURS;
        throw new IllegalArgumentException("Invalid reminder stage");
    }
}
