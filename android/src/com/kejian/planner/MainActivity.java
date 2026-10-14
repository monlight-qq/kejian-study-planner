package com.kejian.planner;

import android.app.Activity;
import android.Manifest;
import android.content.Intent;
import android.content.res.Configuration;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;
import android.util.Base64;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import org.json.JSONObject;

/** Offline application shell. Only bundled HTTPS assets can reach the JS bridge. */
public final class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String HOME = "https://" + HOST + "/assets/index.html";
    private static final int EXPORT = 41, IMPORT = 42, COURSE_IMAGE = 43, NOTIFICATIONS = 51, MAX_BYTES = 10 * 1024 * 1024;
    private WebView web;
    private FrameLayout root;
    private String exportText;
    private boolean documentPickerOpen;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        root = new FrameLayout(this);
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                Insets ime = insets.getInsets(WindowInsets.Type.ime());
                view.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom));
                return WindowInsets.CONSUMED;
            }
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets();
        });
        root.requestApplyInsets();
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false);
        if (Build.VERSION.SDK_INT >= 33) settings.setAlgorithmicDarkeningAllowed(false);
        web.addJavascriptInterface(new Bridge(), "KejianNative");
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!trusted(uri) || !"GET".equals(request.getMethod())) return missing();
                String name = uri.getPath().substring("/assets/".length());
                if (name.isEmpty()) name = "index.html";
                if (name.contains("..") || name.contains("\\") || name.startsWith("/")) return missing();
                try {
                    String type = name.endsWith(".css") ? "text/css" : name.endsWith(".js") ? "text/javascript" : name.endsWith(".svg") ? "image/svg+xml" : name.endsWith(".png") ? "image/png" : name.endsWith(".webmanifest") ? "application/manifest+json" : name.endsWith(".gz") || name.endsWith(".wasm") ? "application/octet-stream" : name.endsWith(".txt") ? "text/plain" : "text/html";
                    return new WebResourceResponse(type, type.startsWith("image/") || type.equals("application/octet-stream") ? null : "UTF-8", 200, "OK", Collections.singletonMap("Cache-Control", "no-cache"), getAssets().open("www/" + name));
                } catch (Exception error) { return missing(); }
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return !trusted(request.getUrl()); }
            @Override public void onPageFinished(WebView view, String url) {refreshReminderUI();showNotificationEntry();}
        });
        updateNativeTheme(getPreferences(MODE_PRIVATE).getString("theme", "system"));
        ReminderScheduler.createChannel(this);
        if (state == null || web.restoreState(state) == null) web.loadUrl(HOME);
    }
    @Override public void onResume() {
        super.onResume();
        ReminderScheduler.reschedule(this);
        refreshReminderUI();
    }
    @Override public void onNewIntent(Intent intent) {super.onNewIntent(intent);setIntent(intent);showNotificationEntry();}
    private void showNotificationEntry() {
        String id = getIntent().getStringExtra("entryId");
        if (id == null || id.isEmpty()) return;
        web.evaluateJavascript("window.kejianOpenEntry && window.kejianOpenEntry(" + JSONObject.quote(id) + ")", null);
        getIntent().removeExtra("entryId");
    }
    private void refreshReminderUI() {if(web != null)web.evaluateJavascript("window.kejianRefreshReminderStatus && window.kejianRefreshReminderStatus()",null);}
    private void askNotificationPermission(boolean userRequested) {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED && !getPreferences(MODE_PRIVATE).getBoolean("notificationAsked", false)) {
            getPreferences(MODE_PRIVATE).edit().putBoolean("notificationAsked", true).apply();
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATIONS);
            return;
        }
        if (userRequested) {
            Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
            try {startActivity(intent);} catch (Exception error) {message("请在手机设置中开启课间通知");}
        }
    }
    @Override public void onRequestPermissionsResult(int request, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(request, permissions, results);
        if (request == NOTIFICATIONS) {ReminderScheduler.reschedule(this);refreshReminderUI();if(!ReminderScheduler.notificationsAllowed(this))message("通知未开启，可在设置中重新允许");}
    }

    private static boolean trusted(Uri uri) {
        return "https".equals(uri.getScheme()) && HOST.equals(uri.getHost()) && (uri.getPort() == -1 || uri.getPort() == 443) && uri.getPath() != null && uri.getPath().startsWith("/assets/");
    }
    private static WebResourceResponse missing() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
    }
    private boolean systemDark() { return (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES; }
    private void updateNativeTheme(String preference) {
        boolean dark = "dark".equals(preference) || ("system".equals(preference) && systemDark());
        int color = Color.parseColor(dark ? "#19171f" : "#f6f5f9");
        root.setBackgroundColor(color); web.setBackgroundColor(color);
        getWindow().setStatusBarColor(color); getWindow().setNavigationBarColor(color);
        getWindow().getDecorView().setSystemUiVisibility(dark ? 0 : View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                int mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                controller.setSystemBarsAppearance(dark ? 0 : mask, mask);
            }
        }
    }
    @Override public void onConfigurationChanged(Configuration config) {
        super.onConfigurationChanged(config);
        updateNativeTheme(getPreferences(MODE_PRIVATE).getString("theme", "system"));
        web.evaluateJavascript("window.kejianSystemThemeChanged && window.kejianSystemThemeChanged()", null);
    }
    @Override public void onSaveInstanceState(Bundle state) { web.saveState(state); super.onSaveInstanceState(state); }
    @Override public void onBackPressed() {
        web.evaluateJavascript("(function(){var d=document.querySelectorAll('dialog[open]'),top=document.activeElement && document.activeElement.closest('dialog[open]');if(d.length){(top || d[d.length-1]).close();return true;}if(location.hash && location.hash!=='#home'){location.hash='#home';return true;}return false;})()", handled -> { if (!"true".equals(handled)) finish(); });
    }
    @Override public void onDestroy() { web.removeJavascriptInterface("KejianNative"); root.removeView(web);web.destroy();super.onDestroy(); }

    private void message(String text) {
        runOnUiThread(() -> {
            if (isFinishing() || isDestroyed()) return;
            Toast.makeText(this, text, Toast.LENGTH_SHORT).show();
        });
    }
    public final class Bridge {
        @JavascriptInterface public void syncReminders(String raw) {
            try {
                ReminderScheduler.sync(MainActivity.this, raw);
                runOnUiThread(() -> {if(ReminderScheduler.hasPending(MainActivity.this) && !ReminderScheduler.notificationsAllowed(MainActivity.this))askNotificationPermission(false);refreshReminderUI();});
            } catch (Exception error) {message("提醒同步失败，请重新打开应用");}
        }
        @JavascriptInterface public String reminderStatus() {return ReminderScheduler.status(MainActivity.this);}
        @JavascriptInterface public void requestNotificationPermission() {runOnUiThread(() -> askNotificationPermission(true));}
        @JavascriptInterface public void requestExactAlarmPermission() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= 31 && !ReminderScheduler.exactAllowed(MainActivity.this)) {
                    try {startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + getPackageName())));} catch (Exception error) {message("请在手机设置中允许课间的闹钟与提醒");}
                }
            });
        }
        @JavascriptInterface public void testReminder() {
            runOnUiThread(() -> {
                if(!ReminderScheduler.notificationsAllowed(MainActivity.this)){askNotificationPermission(true);message("请开启通知后再次测试");return;}
                ReminderScheduler.scheduleTest(MainActivity.this);
                message(ReminderScheduler.exactAllowed(MainActivity.this) ? "10 秒后发送测试通知" : "已安排测试通知，系统可能延后发送");
            });
        }
        @JavascriptInterface public boolean isSystemDark() { return systemDark(); }
        @JavascriptInterface public void setTheme(String preference) {
            if (!"light".equals(preference) && !"dark".equals(preference) && !"system".equals(preference)) return;
            getPreferences(MODE_PRIVATE).edit().putString("theme", preference).apply();
            runOnUiThread(() -> updateNativeTheme(preference));
        }
        @JavascriptInterface public void exportBackup(String text, String name) {
            if (text == null || text.getBytes(StandardCharsets.UTF_8).length > MAX_BYTES) {message("备份文件过大");return;}
            runOnUiThread(() -> {
                if (documentPickerOpen) {message("请先完成当前文件操作");return;}
                exportText = text;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("application/json");
                intent.putExtra(Intent.EXTRA_TITLE, (name == null ? "课间-备份.json" : name).replaceAll("[/\\\\]", "_").substring(0, Math.min(name == null ? 10 : name.length(), 80)));
                try {documentPickerOpen = true; startActivityForResult(intent, EXPORT);} catch (Exception error) {documentPickerOpen = false;exportText = null;message("未找到文件保存工具");}
            });
        }
        @JavascriptInterface public void importBackup() {
            runOnUiThread(() -> {
                if (documentPickerOpen) {message("请先完成当前文件操作");return;}
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
                try {documentPickerOpen = true;startActivityForResult(intent, IMPORT);} catch (Exception error) {documentPickerOpen = false;message("未找到文件选择器");}
            });
        }
        @JavascriptInterface public void importCourseImage() {
            runOnUiThread(() -> {
                if(documentPickerOpen){message("请先完成当前文件操作");return;}
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("image/*");
                try {documentPickerOpen=true;startActivityForResult(intent,COURSE_IMAGE);}catch(Exception error){documentPickerOpen=false;message("未找到图片选择器");}
            });
        }
    }
    @Override public void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request != EXPORT && request != IMPORT && request != COURSE_IMAGE) return;
        documentPickerOpen = false;
        if (result != RESULT_OK || data == null || data.getData() == null) {exportText = null;return;}
        final Uri uri = data.getData();
        if(request==COURSE_IMAGE){
            new Thread(() -> {
                Bitmap bitmap=null;
                try {
                    BitmapFactory.Options options=new BitmapFactory.Options();options.inJustDecodeBounds=true;
                    try(InputStream stream=getContentResolver().openInputStream(uri)){BitmapFactory.decodeStream(stream,null,options);}
                    if(options.outWidth<80||options.outHeight<80||(long)options.outWidth*options.outHeight>40000000)throw new Exception("Invalid image dimensions");
                    options.inJustDecodeBounds=false;options.inSampleSize=1;
                    while(Math.max(options.outWidth,options.outHeight)/options.inSampleSize>2400)options.inSampleSize*=2;
                    try(InputStream stream=getContentResolver().openInputStream(uri)){bitmap=BitmapFactory.decodeStream(stream,null,options);}
                    if(bitmap==null)throw new Exception("Unsupported image");
                    try(ByteArrayOutputStream buffer=new ByteArrayOutputStream()){
                        bitmap.compress(Bitmap.CompressFormat.PNG,100,buffer);
                        if(buffer.size()>12*1024*1024)throw new Exception("Image too large");
                        final String image="data:image/png;base64,"+Base64.encodeToString(buffer.toByteArray(),Base64.NO_WRAP);
                        runOnUiThread(() -> {if(!isFinishing()&&!isDestroyed())web.evaluateJavascript("window.kejianCourseImage && window.kejianCourseImage("+JSONObject.quote(image)+")",null);});
                    }
                }catch(Exception error){runOnUiThread(() -> {if(!isFinishing()&&!isDestroyed())web.evaluateJavascript("window.kejianCourseImage && window.kejianCourseImage(null,'无法读取截图，请选择清晰的 PNG、JPG 或 WebP 图片')",null);});}
                finally{if(bitmap!=null)bitmap.recycle();}
            }).start();return;
        }
        if (request == EXPORT) {
            final String text = exportText;exportText = null;
            if (text == null) {message("保存已取消，请重新导出");return;}
            new Thread(() -> {
                try (OutputStream stream = getContentResolver().openOutputStream(uri, "wt")) {
                    if (stream == null) throw new Exception("No stream");
                    stream.write(text.getBytes(StandardCharsets.UTF_8));message("备份已保存");
                } catch (Exception error) {message("无法保存备份，请重试");}
            }).start();
        } else {
            new Thread(() -> {
                try (InputStream stream = getContentResolver().openInputStream(uri); ByteArrayOutputStream buffer = new ByteArrayOutputStream()) {
                    if (stream == null) throw new Exception("No stream");
                    byte[] chunk = new byte[8192];int count;
                    while ((count = stream.read(chunk)) != -1) {if(buffer.size() + count > MAX_BYTES) {message("备份文件不能超过 10 MB");return;}buffer.write(chunk, 0, count);}
                    final String text = buffer.toString("UTF-8");
                    runOnUiThread(() -> {if(!isFinishing() && !isDestroyed())web.evaluateJavascript("window.kejianImportBackup(" + JSONObject.quote(text) + ")", null);});
                } catch (Exception error) {message("无法读取备份，请重新选择");}
            }).start();
        }
    }
}
