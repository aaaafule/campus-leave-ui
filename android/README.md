# Android 壳

把 `detail/` 和 `leave/` 两个页面装进一个 WebView，做成可安装的 APK。

## 思路

- 用 `loadDataWithBaseURL("https://appassets.local/", …)` 加载 assets 里的 HTML
  ——这样 localStorage / sessionStorage 可用，也绕开了 `file://` 的各种限制
- 页面之间的相对跳转（`../leave/index.html`）会再发一次请求到这个假域名，
  由 `shouldInterceptRequest` 从 assets 里取出来 —— **不联网，也不需要 INTERNET 权限**
- 因为 aapt2 在 Windows 上会把子目录写成反斜杠，assets 里的第二个页面平铺成
  `assets/leave.html`，在拦截里做一次路径映射

## 打包

需要 JDK 17 与 Android SDK build-tools（aapt2 / zipalign / apksigner）。

```powershell
pwsh android/build-apk.ps1 `
  -Jdk        "C:\path\to\jdk-17" `
  -BuildTools "C:\path\to\build-tools\34.0.0" `
  -KeyStore   "C:\path\to\your.jks"
```

没有 keystore 可以加 `-DebugKey`，用 build-tools 自带的调试证书签（能装，不能上架）。
口令通过 `-StorePass` 或环境变量 `KEYSTORE_PASS` 传入，**不要写进脚本**。

## 权限

零权限：不联网、不读相册、不读位置。页面本身不发起任何请求。

> 签名文件（`.jks` / `.keystore`）不要提交到仓库，`.gitignore` 已经排除。
