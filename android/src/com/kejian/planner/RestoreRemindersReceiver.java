package com.kejian.planner;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public final class RestoreRemindersReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        final PendingResult pending = goAsync();
        new Thread(() -> {try {ReminderScheduler.reschedule(context);} finally {pending.finish();}}).start();
    }
}
