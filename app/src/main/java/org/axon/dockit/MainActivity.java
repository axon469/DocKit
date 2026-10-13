package org.axon.dockit;

import android.app.Activity;
import android.app.Dialog;
import android.content.ContentValues;
import android.content.Intent;
import android.content.SharedPreferences;
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
import android.widget.Toast;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Base64;
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

    private final int BG = Color.rgb(13, 16, 24);
    private final int CARD = Color.rgb(25, 30, 43);
    private final int ACCENT = Color.rgb(124, 92, 255);
    private final int WHITE = Color.rgb(248, 249, 255);
    private final int MUTED = Color.rgb(164, 173, 194);
    private final int GREEN = Color.rgb(69, 211, 151);

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

                Uri uri = request.getUrl();
                String scheme = uri.getScheme();

                if ("http".equalsIgnoreCase(scheme)
                        || "https".equalsIgnoreCase(scheme)
                        || "file".equalsIgnoreCase(scheme)
                        || "blob".equalsIgnoreCase(scheme)
                        || "content".equalsIgnoreCase(scheme)) {
                    return false;
                }

                return true;
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
                intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{
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
                    showNotice(
                            "File picker unavailable",
                            "Your device could not open the file picker.",
                            "OK",
                            null);
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

    // -------------------------------------------------
    // PREMIUM UPDATE CHECKER
    // -------------------------------------------------

    private void checkForUpdates() {
        updateExecutor.execute(() -> {
            HttpURLConnection connection = null;

            try {
                URL url = new URL(RELEASE_API);

                connection =
                        (HttpURLConnection) url.openConnection();

                connection.setRequestMethod("GET");
                connection.setConnectTimeout(8000);
                connection.setReadTimeout(8000);

                connection.setRequestProperty(
                        "Accept", "application/vnd.github+json");

                connection.setRequestProperty(
                        "User-Agent", "DocKit-Android");

                if (connection.getResponseCode() != 200) {
                    return;
                }

                StringBuilder response = new StringBuilder();

                try (BufferedReader reader =
                             new BufferedReader(
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

                String tag =
                        release.optString("tag_name", "");

                String title =
                        release.optString("name", "");

                String notes =
                        release.optString(
                                "body", "No release notes provided.");

                String releaseUrl =
                        release.optString("html_url", "");

                String latestVersion =
                        tag.replaceFirst("^[vV]", "").trim();

                String currentVersion =
        getPackageManager()
                .getPackageInfo(getPackageName(), 0)
                .versionName
                .replaceFirst("^[vV]", "").trim();

                if (latestVersion.isEmpty()
                        || releaseUrl.isEmpty()
                        || !isNewerVersion(
                                latestVersion, currentVersion)) {
                    return;
                }

                SharedPreferences preferences =
                        getSharedPreferences(
                                "dockit_updates", MODE_PRIVATE);

                String dismissedVersion =
                        preferences.getString(
                                "dismissed_version", "");

                if (latestVersion.equals(dismissedVersion)) {
                    return;
                }

                runOnUiThread(() -> {
                    if (!isFinishing()
                            && !isDestroyed()) {
                        showUpdateDialog(
                                latestVersion,
                                title,
                                notes,
                                releaseUrl);
                    }
                });

            } catch (Exception ignored) {
                // Network errors must not prevent DocKit from opening.
            } finally {
                if (connection != null) {
                    connection.disconnect();
                }
            }
        });
    }

    private boolean isNewerVersion(
            String latest, String current) {

        try {
            String[] latestParts = latest.split("\\.");
            String[] currentParts = current.split("\\.");

            int count = Math.max(
                    latestParts.length, currentParts.length);

            for (int i = 0; i < count; i++) {
                int a = i < latestParts.length
                        ? versionNumber(latestParts[i]) : 0;

                int b = i < currentParts.length
                        ? versionNumber(currentParts[i]) : 0;

                if (a > b) return true;
                if (a < b) return false;
            }
        } catch (Exception ignored) {
            return false;
        }

        return false;
    }

    private int versionNumber(String part) {
        String digits = part.replaceAll("[^0-9].*$", "");

        return digits.isEmpty()
                ? 0 : Integer.parseInt(digits);
    }

    // -------------------------------------------------
    // PREMIUM UPDATE POPUP
    // -------------------------------------------------

    private void showUpdateDialog(
            String version,
            String title,
            String notes,
            String releaseUrl) {

        if (updateDialogShowing
                || isFinishing()
                || isDestroyed()) {
            return;
        }

        updateDialogShowing = true;

        Dialog dialog = new Dialog(this);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);

        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(24), dp(25), dp(24), dp(22));
        card.setBackground(rounded(CARD, 28));

        // Header icon
        TextView icon = text(
                "↑", 34, WHITE, true);

        icon.setGravity(Gravity.CENTER);

        GradientDrawable iconBg =
                rounded(ACCENT, 22);

        icon.setBackground(iconBg);
        icon.setElevation(dp(4));

        LinearLayout.LayoutParams iconParams =
                new LinearLayout.LayoutParams(
                        dp(76), dp(76));

        iconParams.gravity = Gravity.CENTER_HORIZONTAL;
        iconParams.bottomMargin = dp(20);

        card.addView(icon, iconParams);

        // Small status label
        TextView badge = text(
                "  NEW VERSION AVAILABLE  ",
                11, GREEN, true);

        badge.setGravity(Gravity.CENTER);

        GradientDrawable badgeBg =
                rounded(Color.rgb(28, 65, 57), 30);

        badge.setBackground(badgeBg);
        badge.setPadding(
                dp(10), dp(8), dp(10), dp(8));

        LinearLayout.LayoutParams badgeParams =
                new LinearLayout.LayoutParams(
                        -2, -2);

        badgeParams.gravity = Gravity.CENTER_HORIZONTAL;
        badgeParams.bottomMargin = dp(13);

        card.addView(badge, badgeParams);

        // Main title
        TextView heading = text(
                "Time to upgrade",
                25, WHITE, true);

        heading.setGravity(Gravity.CENTER);

        card.addView(heading, matchWrap());

        TextView subtitle = text(
                "Discover what's new in DocKit.",
                14, MUTED, false);

        subtitle.setGravity(Gravity.CENTER);
        subtitle.setPadding(0, dp(9), 0, dp(19));

        card.addView(subtitle, matchWrap());

        // Version information
        LinearLayout versionRow =
                new LinearLayout(this);

        versionRow.setGravity(Gravity.CENTER);
        versionRow.setOrientation(LinearLayout.HORIZONTAL);
        versionRow.setPadding(
                dp(15), dp(13), dp(15), dp(13));

        versionRow.setBackground(
                rounded(Color.rgb(35, 42, 59), 16));

        TextView versionLabel = text(
                "LATEST VERSION",
                11, MUTED, true);

        TextView versionValue = text(
                "v" + version,
                15, WHITE, true);

        versionRow.addView(
                versionLabel,
                new LinearLayout.LayoutParams(
                        0, -2, 1));

        versionRow.addView(
                versionValue, wrapWrap());

        LinearLayout.LayoutParams rowParams =
                new LinearLayout.LayoutParams(
                        -1, -2);

        rowParams.bottomMargin = dp(17);

        card.addView(versionRow, rowParams);

        // Release notes heading
        TextView notesHeading = text(
                "WHAT'S NEW",
                12, WHITE, true);

        notesHeading.setPadding(0, 0, 0, dp(9));

        card.addView(notesHeading, matchWrap());

        // Scrollable release notes
        TextView notesText = text(
                cleanNotes(notes),
                14, MUTED, false);

        notesText.setLineSpacing(dp(3), 1f);

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(false);
        scroll.setOverScrollMode(View.OVER_SCROLL_IF_CONTENT_SCROLLS);

        scroll.addView(notesText);

        LinearLayout.LayoutParams scrollParams =
                new LinearLayout.LayoutParams(
                        -1, dp(115));

        scrollParams.bottomMargin = dp(22);

        card.addView(scroll, scrollParams);

        // Primary button
        TextView updateButton = button(
                "Update Now  →", ACCENT, WHITE);

        card.addView(updateButton, buttonParams());

        updateButton.setOnClickListener(v -> {
            dialog.dismiss();
            openReleasePage(releaseUrl);
        });

        // Secondary button
        TextView laterButton = button(
                "Update Later", CARD, MUTED);

        LinearLayout.LayoutParams laterParams =
                buttonParams();

        laterParams.topMargin = dp(10);

        card.addView(laterButton, laterParams);

        laterButton.setOnClickListener(v -> {
            getSharedPreferences(
                    "dockit_updates", MODE_PRIVATE)
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

            WindowManager.LayoutParams params =
                    window.getAttributes();

            params.width = getResources()
                    .getDisplayMetrics().widthPixels
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

        // Apply sizing after showing on different devices.
        if (window != null) {
            window.setLayout(
                    getResources().getDisplayMetrics().widthPixels
                            - dp(32),
                    WindowManager.LayoutParams.WRAP_CONTENT);
        }
    }

    private String cleanNotes(String notes) {
        if (notes == null || notes.trim().isEmpty()) {
            return "Bug fixes and improvements.";
        }

        String result = notes.trim();

        if (result.length() > 1600) {
            result = result.substring(0, 1600) + "\n\n…";
        }

        return result;
    }

    private void openReleasePage(String releaseUrl) {
        try {
            Intent intent = new Intent(
                    Intent.ACTION_VIEW, Uri.parse(releaseUrl));

            startActivity(intent);

        } catch (Exception e) {
            showNotice(
                    "Unable to open link",
                    "Please open the DocKit release page in your browser.",
                    "OK",
                    null);
        }
    }

    // -------------------------------------------------
    // PREMIUM MESSAGE DIALOGS
    // -------------------------------------------------

    private void showNotice(
            String title,
            String message,
            String buttonText,
            Runnable action) {

        if (isFinishing() || isDestroyed()) return;

        Dialog dialog = new Dialog(this);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);

        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(24), dp(24), dp(24), dp(22));
        card.setBackground(rounded(CARD, 24));

        TextView heading = text(title, 21, WHITE, true);
        heading.setPadding(0, 0, 0, dp(12));

        card.addView(heading, matchWrap());

        TextView body = text(message, 14, MUTED, false);
        body.setLineSpacing(dp(3), 1f);
        body.setPadding(0, 0, 0, dp(22));

        card.addView(body, matchWrap());

        TextView ok = button(buttonText, ACCENT, WHITE);

        card.addView(ok, buttonParams());

        ok.setOnClickListener(v -> {
            dialog.dismiss();

            if (action != null) {
                action.run();
            }
        });

        dialog.setContentView(card);

        Window window = dialog.getWindow();

        if (window != null) {
            window.setBackgroundDrawableResource(
                    android.R.color.transparent);

            window.addFlags(
                    WindowManager.LayoutParams.FLAG_DIM_BEHIND);

            WindowManager.LayoutParams params =
                    window.getAttributes();

            params.width = getResources()
                    .getDisplayMetrics().widthPixels - dp(40);

            params.height =
                    WindowManager.LayoutParams.WRAP_CONTENT;

            params.dimAmount = 0.65f;
            window.setAttributes(params);
        }

        dialog.show();

        if (window != null) {
            window.setLayout(
                    getResources().getDisplayMetrics().widthPixels
                            - dp(40),
                    WindowManager.LayoutParams.WRAP_CONTENT);
        }
    }

    // -------------------------------------------------
    // UI HELPERS
    // -------------------------------------------------

    private TextView text(
            String value, int size, int color, boolean bold) {

        TextView view = new TextView(this);

        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(color);
        view.setGravity(Gravity.CENTER_VERTICAL);
        view.setTypeface(
                Typeface.create(
                        "sans-serif",
                        bold ? Typeface.BOLD : Typeface.NORMAL));

        return view;
    }

    private TextView button(
            String label, int background, int foreground) {

        TextView view = text(label, 15, foreground, true);
        view.setGravity(Gravity.CENTER);
        view.setPadding(
                dp(12), dp(15), dp(12), dp(15));

        view.setBackground(rounded(background, 15));
        view.setClickable(true);
        view.setFocusable(true);

        return view;
    }

    private GradientDrawable rounded(
            int color, int radius) {

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

    private LinearLayout.LayoutParams wrapWrap() {
        return new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
    }

    private LinearLayout.LayoutParams buttonParams() {
        return new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
    }

    private int dp(int value) {
        return (int) (value * getResources()
                .getDisplayMetrics().density + 0.5f);
    }

    // -------------------------------------------------
    // FILE PICKER
    // -------------------------------------------------

    @Override
    protected void onActivityResult(
            int requestCode, int resultCode, Intent data) {

        super.onActivityResult(
                requestCode, resultCode, data);

        if (requestCode == FILE_CHOOSER_REQUEST
                && filePathCallback != null) {

            Uri[] results = null;

            if (resultCode == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    int count = data.getClipData().getItemCount();
                    results = new Uri[count];

                    for (int i = 0; i < count; i++) {
                        results[i] =
                                data.getClipData().getItemAt(i).getUri();
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
        if (webView != null) {
            webView.saveState(outState);
        }

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
        super.onDestroy();
    }

    // -------------------------------------------------
    // DOWNLOAD BRIDGE
    // -------------------------------------------------

    private class DownloadBridge {

        @JavascriptInterface
        public void saveBase64(
                final String filename, final String encoded) {

            runOnUiThread(() -> {
                try {
                    byte[] bytes;

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        bytes = Base64.getDecoder().decode(encoded);
                    } else {
                        bytes = android.util.Base64.decode(
                                encoded, android.util.Base64.DEFAULT);
                    }

                    String safeName = filename == null
                            ? "DocKit-download"
                            : filename.replaceAll(
                                    "[\\\\/:*?\"<>|]", "_");

                    if (safeName.trim().isEmpty()) {
                        safeName = "DocKit-download";
                    }

                    ContentValues values = new ContentValues();

                    values.put(
                            MediaStore.MediaColumns.DISPLAY_NAME,
                            safeName);

                    values.put(
                            MediaStore.MediaColumns.MIME_TYPE,
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

                    Uri fileUri =
                            getContentResolver().insert(
                                    collection, values);

                    if (fileUri == null) {
                        throw new Exception(
                                "Could not create download file");
                    }

                    try (OutputStream output =
                                 getContentResolver().openOutputStream(fileUri)) {

                        if (output == null) {
                            throw new Exception(
                                    "Could not open download file");
                        }

                        output.write(bytes);
                    }

                    showNotice(
                            "Download complete",
                            safeName
                                    + "\n\nYour file has been saved to Downloads.",
                            "Great!",
                            null);

                } catch (Exception e) {
                    showNotice(
                            "Download failed",
                            "DocKit couldn't save this file.\n\n"
                                    + e.getMessage(),
                            "OK",
                            null);
                }
            });
        }
    }

    private String mimeType(String name) {
        String lower = name.toLowerCase();

        if (lower.endsWith(".pdf")) return "application/pdf";
        if (lower.endsWith(".zip")) return "application/zip";
        if (lower.endsWith(".png")) return "image/png";

        if (lower.endsWith(".jpg")
                || lower.endsWith(".jpeg")) {
            return "image/jpeg";
        }

        if (lower.endsWith(".txt")) return "text/plain";

        if (lower.endsWith(".docx")) {
            return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        }

        return "application/octet-stream";
    }
}
