package com.kejian.planner;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public final class ReminderReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        final PendingResult pending = goAsync();
        new Thread(() -> {
            try {
                if (ReminderScheduler.TEST.equals(intent.getAction())) ReminderScheduler.deliverTest(context);
                else if (ReminderScheduler.REMIND.equals(intent.getAction())) ReminderScheduler.deliverDue(context);
            } finally {pending.finish();}
        }).start();
    }
}
