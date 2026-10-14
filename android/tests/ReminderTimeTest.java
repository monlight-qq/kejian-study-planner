package com.kejian.planner;

import java.time.ZoneId;
import java.time.Instant;

public final class ReminderTimeTest {
    private static final long HOUR = 60 * 60 * 1000L;
    private static void equal(long actual, long expected) {if(actual != expected)throw new AssertionError(actual + " != " + expected);}
    private static void check(boolean value) {if(!value)throw new AssertionError();}
    private static long trigger(long now, long due, int mask) {return ReminderTime.nextTrigger(now, due, true, false, mask);}
    private static int dueStage(long now, long due, int mask) {return ReminderTime.dueStage(now, due, true, false, mask);}
    private static void rejects(Runnable action) {boolean rejected = false;try {action.run();}catch(IllegalArgumentException expected){rejected = true;}catch(java.time.DateTimeException expected){rejected = true;}check(rejected);}
    public static void main(String[] arguments) {
        ZoneId china = ZoneId.of("Asia/Shanghai");
        String date = "2026-11-20T18:00";
        long due = ReminderTime.deadlineMillis(date, china);
        long six = ReminderTime.reminderMillis(date, china, 6), three = ReminderTime.reminderMillis(date, china, 3);
        equal(due - six, 6 * HOUR);
        equal(due - three, 3 * HOUR);
        equal(trigger(six - 60000, due, 0), six);
        equal(dueStage(six - 1, due, 0), ReminderTime.NONE);
        equal(dueStage(six, due, 0), ReminderTime.SIX_HOURS);
        int firstSent = ReminderTime.markSent(0, ReminderTime.SIX_HOURS);
        equal(firstSent, ReminderTime.SENT_SIX_HOURS);
        equal(dueStage(six, due, firstSent), ReminderTime.NONE);
        equal(trigger(six, due, firstSent), three);
        equal(dueStage(three - 1, due, firstSent), ReminderTime.NONE);
        equal(dueStage(three, due, firstSent), ReminderTime.THREE_HOURS);
        int bothSent = ReminderTime.markSent(firstSent, ReminderTime.THREE_HOURS);
        equal(bothSent, ReminderTime.SENT_SIX_HOURS | ReminderTime.SENT_THREE_HOURS);
        equal(trigger(three, due, bothSent), -1);
        equal(dueStage(three, due, bothSent), ReminderTime.NONE);

        // Late additions, restore, restart or delayed alarms deliver only the relevant stage.
        long fourHoursLeft = due - 4 * HOUR, twoHoursLeft = due - 2 * HOUR;
        equal(trigger(fourHoursLeft, due, 0), fourHoursLeft + 2000);
        equal(dueStage(fourHoursLeft, due, 0), ReminderTime.SIX_HOURS);
        equal(trigger(fourHoursLeft, due, firstSent), three);
        equal(dueStage(three, due, 0), ReminderTime.THREE_HOURS);
        equal(trigger(twoHoursLeft, due, 0), twoHoursLeft + 2000);
        equal(dueStage(twoHoursLeft, due, 0), ReminderTime.THREE_HOURS);
        int caughtUp = ReminderTime.markSent(0, ReminderTime.THREE_HOURS);
        equal(dueStage(twoHoursLeft, due, caughtUp), ReminderTime.NONE);
        equal(trigger(twoHoursLeft, due, caughtUp), -1);
        equal(trigger(six, due, caughtUp), -1); // A backward clock change cannot revive the missed 6h stage.
        equal(trigger(due - 1000, due, 0), due - 1);
        equal(dueStage(due - 1, due, 0), ReminderTime.THREE_HOURS);
        equal(trigger(due, due, 0), -1);
        equal(dueStage(due, due, 0), ReminderTime.NONE);
        equal(dueStage(due + HOUR, due, 0), ReminderTime.NONE);

        // Toggling completion/reminders cancels scheduling, retaining previous-stage deduplication.
        equal(ReminderTime.nextTrigger(fourHoursLeft, due, false, false, 0), -1);
        equal(ReminderTime.nextTrigger(fourHoursLeft, due, true, true, 0), -1);
        equal(ReminderTime.dueStage(twoHoursLeft, due, false, false, 0), ReminderTime.NONE);
        equal(ReminderTime.dueStage(twoHoursLeft, due, true, true, 0), ReminderTime.NONE);
        equal(dueStage(twoHoursLeft, due, firstSent), ReminderTime.THREE_HOURS);
        equal(dueStage(twoHoursLeft, due, bothSent), ReminderTime.NONE);

        // Persisted flags survive a restart; an edited date is a new schedule. Legacy strings have no flags.
        equal(ReminderTime.sentMask(date, date, true, false), firstSent);
        equal(ReminderTime.sentMask(date, date, true, true), bothSent);
        equal(ReminderTime.sentMask(date, "2026-11-20T19:00", true, true), 0);
        equal(ReminderTime.sentMask(date, date, false, false), 0);
        equal(ReminderTime.sentMask(date, null, false, false), 0);
        equal(dueStage(fourHoursLeft, due, ReminderTime.sentMask(date, date, false, false)), ReminderTime.SIX_HOURS);
        equal(dueStage(twoHoursLeft, due, ReminderTime.sentMask(date, date, false, false)), ReminderTime.THREE_HOURS);

        String afterMidnight = "2026-11-21T02:00";
        equal(ReminderTime.reminderMillis(afterMidnight, china, 6), ReminderTime.deadlineMillis("2026-11-20T20:00", china));
        equal(ReminderTime.reminderMillis(afterMidnight, china, 3), ReminderTime.deadlineMillis("2026-11-20T23:00", china));

        // Elapsed hours remain exact across both daylight-saving transitions.
        ZoneId newYork = ZoneId.of("America/New_York");
        for (String dstDate : new String[]{"2026-03-08T06:00", "2026-11-01T05:00"}) {
            long dstDue = ReminderTime.deadlineMillis(dstDate, newYork);
            for (int hours : new int[]{6, 3}) equal(dstDue - ReminderTime.reminderMillis(dstDate, newYork, hours), hours * HOUR);
        }
        check(Instant.ofEpochMilli(ReminderTime.reminderMillis("2026-03-08T06:00", newYork, 6)).atZone(newYork).getHour() == 23);
        check(Instant.ofEpochMilli(ReminderTime.reminderMillis("2026-11-01T05:00", newYork, 6)).atZone(newYork).getHour() == 0);
        rejects(() -> ReminderTime.deadlineMillis("2026-02-30T18:00", china));
        rejects(() -> ReminderTime.deadlineMillis("2026-11-20", china));
        rejects(() -> ReminderTime.reminderMillis(date, china, 24));
        rejects(() -> ReminderTime.markSent(0, 24));
        System.out.println("PASS: exact 6h/3h boundaries, independent deduplication, latest-stage catch-up, restart/legacy/date-edit compatibility, completion/disable/expiry, cross-midnight and DST.");
    }
}
