package com.sim.leave;

import android.annotation.SuppressLint;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;

/**
 * 用 WebView 承载 assets 里的两个单文件页面：
 *   assets/index.html      请假详情（转发 → 跳到 leave/）
 *   assets/leave.html 另一个学生的请假页
 *
 * 页面用 loadDataWithBaseURL 以 https://appassets.local/ 为源加载
 * （这样 localStorage 可用、file:// 限制也绕开了），
 * 页面之间的相对跳转（../leave/index.html）会再发一次请求回这个假域名，
 * 由 shouldInterceptRequest 从 assets 里取——不外网、不联网。
 */
public class MainActivity extends android.app.Activity {

    private static final String HOST = "appassets.local";
    private static final String BASE_URL = "https://" + HOST + "/";
    private WebView web;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window w = getWindow();
        w.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        w.setStatusBarColor(Color.WHITE);
        w.setNavigationBarColor(Color.WHITE);
        applyLightSystemBarIcons(w);

        web = new WebView(this);
        web.setBackgroundColor(Color.WHITE);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // localStorage（编辑内容持久化）
        s.setDatabaseEnabled(true);
        s.setLoadWithOverviewMode(false);
        s.setUseWideViewPort(false);           // 页面自带 viewport 缩放逻辑
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setTextZoom(100);                    // 不受系统字号设置影响
        s.setAllowFileAccess(false);           // 全部走 assets 拦截，不需要 file://
        s.setAllowContentAccess(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        if (Build.VERSION.SDK_INT >= 29) s.setForceDark(WebSettings.FORCE_DARK_OFF);  // 别自动反色

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (u == null || !HOST.equals(u.getHost())) return null;   // 外网一概不管（也没网络权限）
                String path = u.getPath();
                if (path == null || "/".equals(path)) path = "/index.html";
                if (path.startsWith("/")) path = path.substring(1);
                // 页面里跳转写的是 ../leave/index.html，而 aapt2 在 Windows 上会把子目录名写成
                // 反斜杠（assets/leave\index.html），Android 侧取不到 —— 所以文件平铺成
                // assets/leave.html，这里做一次映射。
                if ("leave/index.html".equals(path) || "leave/mobile.html".equals(path) ||
                    "leave/mobile.html".equals(path)) path = "leave.html";
                try {
                    InputStream in = getAssets().open(path);
                    return new WebResourceResponse(mimeOf(path), "UTF-8", in);
                } catch (IOException e) {
                    return null;
                }
            }
        });

        web.setLongClickable(false);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHapticFeedbackEnabled(false);

        setContentView(web);
        web.loadDataWithBaseURL(BASE_URL, readAsset("index.html"), "text/html", "UTF-8", null);
    }

    private static String mimeOf(String path) {
        if (path.endsWith(".js")) return "application/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
        return "text/html";
    }

    private void applyLightSystemBarIcons(Window w) {
        int flags = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
        if (Build.VERSION.SDK_INT >= 26) flags |= 0x00000010;   // LIGHT_NAVIGATION_BAR
        w.getDecorView().setSystemUiVisibility(flags);
    }

    private String readAsset(String name) {
        try (InputStream in = getAssets().open(name)) {
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) bos.write(buf, 0, n);
            return new String(bos.toByteArray(), "UTF-8");
        } catch (IOException e) {
            return "<html><body style='font:16px sans-serif;padding:24px'>资源读取失败：" + name + "</body></html>";
        }
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.loadUrl("about:blank");
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
