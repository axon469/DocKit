package org.axon.dockit;

import android.app.Activity;
import android.app.Dialog;
import android.content.ContentValues;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private static final int FILE_CHOOSER_REQUEST = 4102;

    private static final String RELEASE_API =
            "https://api.github.com/repos/axon469/DocKit/releases/latest";

    private final ExecutorService updateExecutor =
            Executors.newSingleThreadExecutor();

    private boolean updateDialogShowing = false;

    private int dp(float value) {
        return (int) (value * getResources()
                .getDisplayMetrics().density + 0.5f);
    }

    private boolean isDark() {
        return (getResources().getConfiguration().uiMode
                & Configuration.UI_MODE_NIGHT_MASK)
                == Configuration.UI_MODE_NIGHT_YES;
    }

    private int backgroundColor() {
        return isDark() ? Color.rgb(27, 25, 39) : Color.WHITE;
    }

    private int foregroundColor() {
        return isDark() ? Color.rgb(248, 246, 255)
                : Color.rgb(49, 45, 68);
    }

    private int mutedColor() {
        return isDark() ? Color.rgb(190, 188, 208)
                : Color.rgb(92, 88, 110);
    }

    private final int purple = Color.rgb(132, 78, 230);

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        webView.setBackgroundColor(0xFF101114);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setSupportMultipleWindows(false);
        settings.setMixedContentMode(
                WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        webView.addJavascriptInterface(
                new DownloadBridge(), "DocKitAndroid");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(
                    WebView view, WebResourceRequest request) {

                String scheme = request.getUrl().getScheme();

                return !("http".equalsIgnoreCase(scheme)
                        || "https".equalsIgnoreCase(scheme)
                        || "file".equalsIgnoreCase(scheme)
                        || "blob".equalsIgnoreCase(scheme)
                        || "content".equalsIgnoreCase(scheme));
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(
                    WebView view,
                    ValueCallback<Uri[]> callback,
                    FileChooserParams params) {

                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }

                filePathCallback = callback;

                Intent intent =
                        new Intent(Intent.ACTION_OPEN_DOCUMENT);

                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                intent.putExtra(Intent.EXTRA_MIME_TYPES,
                        new String[]{
                                "application/pdf",
                                "image/*",
                                "text/*",
                                "application/*"
                        });
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);

                try {
                    startActivityForResult(
                            intent, FILE_CHOOSER_REQUEST);
                } catch (Exception e) {
                    filePathCallback = null;
                    showNotice("File picker unavailable",
                            "Your device could not open the file picker.",
                            "OK", null);
                    return false;
                }

                return true;
            }
        });

        if (savedInstanceState == null) {
            webView.loadUrl("file:///android_asset/index.html");
        } else {
            webView.restoreState(savedInstanceState);
        }

        checkForUpdates();
    }

    // GITHUB UPDATE CHECKER

    private void checkForUpdates() {
        updateExecutor.execute(() -> {
            HttpURLConnection connection = null;

            try {
                connection = (HttpURLConnection)
                        new URL(RELEASE_API).openConnection();

                connection.setRequestMethod("GET");
                connection.setConnectTimeout(8000);
                connection.setReadTimeout(8000);
                connection.setRequestProperty(
                        "Accept", "application/vnd.github+json");
                connection.setRequestProperty(
                        "User-Agent", "DocKit-Android");

                if (connection.getResponseCode() != 200) return;

                StringBuilder response = new StringBuilder();

                try (BufferedReader reader = new BufferedReader(
                        new InputStreamReader(
                                connection.getInputStream()))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        response.append(line);
                    }
                }

                JSONObject release =
                        new JSONObject(response.toString());

                if (release.optBoolean("draft", false)
                        || release.optBoolean("prerelease", false)) {
                    return;
                }

                String tag = release.optString("tag_name", "");
                String notes = release.optString("body", "");
                String releaseUrl = release.optString("html_url", "");

                String latestVersion =
                        tag.replaceFirst("^[vV]", "").trim();

                String currentVersion = getPackageManager()
                        .getPackageInfo(getPackageName(), 0)
                        .versionName.replaceFirst("^[vV]", "").trim();

                if (latestVersion.isEmpty()
                        || releaseUrl.isEmpty()
                        || !isNewerVersion(
                                latestVersion, currentVersion)) {
                    return;
                }

                SharedPreferences prefs =
                        getSharedPreferences(
                                "dockit_updates", MODE_PRIVATE);

                if (latestVersion.equals(
                        prefs.getString("dismissed_version", ""))) {
                    return;
                }

                runOnUiThread(() -> {
                    if (!isFinishing() && !isDestroyed()) {
                        showUpdateDialog(
                                latestVersion, notes, releaseUrl);
                    }
                });

            } catch (Exception ignored) {
                // Network errors must not stop DocKit opening.
            } finally {
                if (connection != null) connection.disconnect();
            }
        });
    }

    private boolean isNewerVersion(String latest, String current) {
        try {
            String[] a = latest.split("\\.");
            String[] b = current.split("\\.");

            for (int i = 0; i < Math.max(a.length, b.length); i++) {
                int av = i < a.length ? versionNumber(a[i]) : 0;
                int bv = i < b.length ? versionNumber(b[i]) : 0;

                if (av > bv) return true;
                if (av < bv) return false;
            }
        } catch (Exception ignored) {
            return false;
        }

        return false;
    }

    private int versionNumber(String part) {
        String digits = part.replaceAll("[^0-9].*$", "");
        return digits.isEmpty() ? 0 : Integer.parseInt(digits);
    }

    // REDESIGNED UPDATE POPUP

    private void showUpdateDialog(
            String version, String notes, String releaseUrl) {

        if (updateDialogShowing || isFinishing() || isDestroyed()) {
            return;
        }

        updateDialogShowing = true;

        int bg = backgroundColor();
        int fg = foregroundColor();
        int muted = mutedColor();
        boolean dark = isDark();

        Dialog dialog = new Dialog(this);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);

        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(20), dp(18), dp(20), dp(18));
        card.setBackground(rounded(bg, 26));

        // Rocket illustration panel

        LinearLayout hero = new LinearLayout(this);
        hero.setGravity(Gravity.CENTER);
        hero.setOrientation(LinearLayout.VERTICAL);
        hero.setBackground(rounded(
                dark ? Color.rgb(39, 27, 60)
                        : Color.rgb(215, 194, 255), 22));

        TextView stars = makeText(
                "✦       ·       ✧       ·       ✦",
                16, dark ? Color.WHITE : Color.rgb(103, 69, 164), false);
        stars.setGravity(Gravity.CENTER);
        hero.addView(stars, new LinearLayout.LayoutParams(-1, dp(27)));

        TextView rocket = makeText("🚀", 55, fg, false);
        rocket.setGravity(Gravity.CENTER);
        hero.addView(rocket, new LinearLayout.LayoutParams(-1, dp(88)));

        LinearLayout.LayoutParams heroParams =
                new LinearLayout.LayoutParams(-1, dp(135));
        heroParams.bottomMargin = dp(18);
        card.addView(hero, heroParams);

        // Status badge

        TextView badge = makeText(
                "UPDATE REQUIRED", 11,
                Color.rgb(39, 180, 128), true);
        badge.setGravity(Gravity.CENTER);
        badge.setPadding(dp(14), dp(8), dp(14), dp(8));
        badge.setBackground(rounded(
                dark ? Color.rgb(26, 67, 56)
                        : Color.rgb(225, 249, 238), 30));

        LinearLayout.LayoutParams badgeParams =
                new LinearLayout.LayoutParams(-2, -2);
        badgeParams.gravity = Gravity.CENTER_HORIZONTAL;
        badgeParams.bottomMargin = dp(13);
        card.addView(badge, badgeParams);

        TextView heading = makeText(
                "Update Required", 23, fg, true);
        heading.setGravity(Gravity.CENTER);
        card.addView(heading, matchWrap());

        TextView subtitle = makeText(
                "For a better, faster, and more secure experience, "
                        + "install the latest version of the application.",
                14, muted, false);
        subtitle.setGravity(Gravity.CENTER);
        subtitle.setLineSpacing(dp(4), 1f);
        subtitle.setPadding(dp(2), dp(10), dp(2), dp(18));
        card.addView(subtitle, matchWrap());

        // What's new

        TextView section = makeText("WHAT'S NEW", 13, fg, true);
        section.setPadding(0, 0, 0, dp(9));
        card.addView(section, matchWrap());

        TextView releaseNotes = makeText(
                formatNotes(notes), 14, muted, false);
        releaseNotes.setGravity(Gravity.TOP | Gravity.START);
        releaseNotes.setLineSpacing(dp(5), 1f);

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(false);
        scroll.setVerticalScrollBarEnabled(false);
        scroll.addView(releaseNotes);

        LinearLayout.LayoutParams scrollParams =
                new LinearLayout.LayoutParams(-1, dp(105));
        scrollParams.bottomMargin = dp(17);
        card.addView(scroll, scrollParams);

        // Main purple button

        TextView updateButton = makeButton(
                "Update Application   →", Color.WHITE);

        GradientDrawable gradient = new GradientDrawable(
                GradientDrawable.Orientation.LEFT_RIGHT,
                new int[]{
                        Color.rgb(177, 137, 255),
                        Color.rgb(124, 65, 218)
                });
        gradient.setCornerRadius(dp(14));
        updateButton.setBackground(gradient);
        card.addView(updateButton, buttonParams());

        updateButton.setOnClickListener(v -> {
            dialog.dismiss();
            openReleasePage(releaseUrl);
        });

        // Outlined reminder button

        TextView laterButton = makeButton(
                "Remind me later", purple);

        GradientDrawable outline = rounded(bg, 14);
        outline.setStroke(dp(1), purple);
        laterButton.setBackground(outline);

        LinearLayout.LayoutParams laterParams = buttonParams();
        laterParams.topMargin = dp(10);
        card.addView(laterButton, laterParams);

        laterButton.setOnClickListener(v -> {
            getSharedPreferences("dockit_updates", MODE_PRIVATE)
                    .edit()
                    .putString("dismissed_version", version)
                    .apply();
            dialog.dismiss();
        });

        dialog.setContentView(card);

        Window window = dialog.getWindow();
        if (window != null) {
            window.setBackgroundDrawableResource(
                    android.R.color.transparent);
            window.addFlags(
                    WindowManager.LayoutParams.FLAG_DIM_BEHIND);

            WindowManager.LayoutParams params = window.getAttributes();
            params.width = getResources().getDisplayMetrics().widthPixels
                    - dp(32);
            params.height = WindowManager.LayoutParams.WRAP_CONTENT;
            params.gravity = Gravity.CENTER;
            params.dimAmount = 0.72f;
            window.setAttributes(params);
        }

        dialog.setCancelable(true);
        dialog.setOnDismissListener(
                d -> updateDialogShowing = false);
        dialog.show();

        if (window != null) {
            window.setLayout(
                    getResources().getDisplayMetrics().widthPixels
                            - dp(32),
                    WindowManager.LayoutParams.WRAP_CONTENT);
        }
    }

    private String formatNotes(String notes) {
        if (notes == null || notes.trim().isEmpty()) {
            return "• Improved performance\n\n"
                    + "• Bug fixes and stability improvements\n\n"
                    + "• General improvements";
        }

        String result = notes.trim()
                .replaceAll("(?m)^#{1,6}\\s*", "")
                .replaceAll("(?m)^\\s*[-*+]\\s+", "• ")
                .replaceAll("(?m)^\\s*\\d+\\.\\s+", "• ")
                .replaceAll("\\*\\*(.*?)\\*\\*", "$1")
                .replaceAll("__(.*?)__", "$1");

        if (result.length() > 900) {
            result = result.substring(0, 900) + "…";
        }

        return result;
    }

    private void openReleasePage(String releaseUrl) {
        try {
            startActivity(new Intent(
                    Intent.ACTION_VIEW, Uri.parse(releaseUrl)));
        } catch (Exception e) {
            showNotice("Unable to open link",
                    "Please open the DocKit release page in your browser.",
                    "OK", null);
        }
    }

    // GENERAL MESSAGE DIALOG

    private void showNotice(
            String title, String message,
            String buttonText, Runnable action) {

        if (isFinishing() || isDestroyed()) return;

        Dialog dialog = new Dialog(this);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);

        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(24), dp(24), dp(24), dp(22));
        card.setBackground(rounded(backgroundColor(), 24));

        TextView heading = makeText(
                title, 21, foregroundColor(), true);
        heading.setPadding(0, 0, 0, dp(12));
        card.addView(heading, matchWrap());

        TextView body = makeText(
                message, 14, mutedColor(), false);
        body.setLineSpacing(dp(3), 1f);
        body.setPadding(0, 0, 0, dp(22));
        card.addView(body, matchWrap());

        TextView ok = makeButton(buttonText, Color.WHITE);
        ok.setBackground(rounded(purple, 14));
        card.addView(ok, buttonParams());

        ok.setOnClickListener(v -> {
            dialog.dismiss();
            if (action != null) action.run();
        });

        dialog.setContentView(card);

        Window window = dialog.getWindow();
        if (window != null) {
            window.setBackgroundDrawableResource(
                    android.R.color.transparent);
            window.addFlags(
                    WindowManager.LayoutParams.FLAG_DIM_BEHIND);
            window.setDimAmount(0.65f);
            window.setLayout(
                    getResources().getDisplayMetrics().widthPixels
                            - dp(40),
                    WindowManager.LayoutParams.WRAP_CONTENT);
        }

        dialog.show();

        if (window != null) {
            window.setLayout(
                    getResources().getDisplayMetrics().widthPixels
                            - dp(40),
                    WindowManager.LayoutParams.WRAP_CONTENT);
        }
    }

    // UI HELPERS

    private TextView makeText(
            String value, int size, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(color);
        view.setGravity(Gravity.CENTER_VERTICAL);
        view.setTypeface(Typeface.create(
                "sans-serif", bold ? Typeface.BOLD : Typeface.NORMAL));
        return view;
    }

    private TextView makeButton(String label, int foreground) {
        TextView view = makeText(label, 15, foreground, true);
        view.setGravity(Gravity.CENTER);
        view.setPadding(dp(12), dp(15), dp(12), dp(15));
        view.setBackground(rounded(purple, 14));
        view.setClickable(true);
        view.setFocusable(true);
        return view;
    }

    private GradientDrawable rounded(int color, int radius) {
        GradientDrawable shape = new GradientDrawable();
        shape.setColor(color);
        shape.setCornerRadius(dp(radius));
        return shape;
    }

    private LinearLayout.LayoutParams matchWrap() {
        return new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
    }

    private LinearLayout.LayoutParams buttonParams() {
        return new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
    }

    // FILE PICKER RESULT

    @Override
    protected void onActivityResult(
            int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == FILE_CHOOSER_REQUEST
                && filePathCallback != null) {
            Uri[] results = null;

            if (resultCode == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    int count = data.getClipData().getItemCount();
                    results = new Uri[count];

                    for (int i = 0; i < count; i++) {
                        results[i] = data.getClipData()
                                .getItemAt(i).getUri();
                    }
                } else if (data.getData() != null) {
                    results = new Uri[]{data.getData()};
                }
            }

            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        if (webView != null) webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        updateExecutor.shutdownNow();
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    // DOWNLOAD BRIDGE

    private class DownloadBridge {

        @JavascriptInterface
        public void saveBase64(
                final String filename, final String encoded) {

            runOnUiThread(() -> {
                try {
                    byte[] bytes = android.util.Base64.decode(
                            encoded, android.util.Base64.DEFAULT);

                    String safeName = filename == null
                            ? "DocKit-download"
                            : filename.replaceAll(
                                    "[\\\\/:*?\"<>|]", "_");

                    if (safeName.trim().isEmpty()) {
                        safeName = "DocKit-download";
                    }

                    ContentValues values = new ContentValues();
                    values.put(MediaStore.MediaColumns.DISPLAY_NAME,
                            safeName);
                    values.put(MediaStore.MediaColumns.MIME_TYPE,
                            mimeType(safeName));

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        values.put(
                                MediaStore.MediaColumns.RELATIVE_PATH,
                                Environment.DIRECTORY_DOWNLOADS);
                    }

                    Uri collection =
                            Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                                    ? MediaStore.Downloads.EXTERNAL_CONTENT_URI
                                    : MediaStore.Files.getContentUri("external");

                    Uri fileUri = getContentResolver().insert(
                            collection, values);

                    if (fileUri == null) {
                        throw new Exception("Could not create download file");
                    }

                    try (OutputStream output =
                                 getContentResolver().openOutputStream(fileUri)) {
                        if (output == null) {
                            throw new Exception("Could not open download file");
                        }
                        output.write(bytes);
                    }

                    showNotice("Download complete",
                            safeName + "\n\nYour file has been saved to Downloads.",
                            "Great!", null);

                } catch (Exception e) {
                    showNotice("Download failed",
                            "DocKit couldn't save this file.\n\n"
                                    + e.getMessage(),
                            "OK", null);
                }
            });
        }
    }

    private String mimeType(String name) {
        String lower = name.toLowerCase();

        if (lower.endsWith(".pdf")) return "application/pdf";
        if (lower.endsWith(".zip")) return "application/zip";
        if (lower.endsWith(".png")) return "image/png";

        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
            return "image/jpeg";
        }

        if (lower.endsWith(".txt")) return "text/plain";

        if (lower.endsWith(".docx")) {
            return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        }

        return "application/octet-stream";
    }
}
