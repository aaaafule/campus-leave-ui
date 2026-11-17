#!/usr/bin/env pwsh
<#
  把 detail/ 与 leave/ 里的页面打成 APK。
  需要：JDK 17、Android SDK build-tools（提供 aapt2 / zipalign / apksigner）。

  例：
    pwsh android/build-apk.ps1 `
      -Jdk        "C:\jdk-17" `
      -BuildTools "C:\android-sdk\build-tools\34.0.0" `
      -KeyStore   "C:\keys\demo.jks"

  没有 keystore 时加 -DebugKey，用 build-tools 里的 debug 证书签（能装，但不能上架）。
#>
param(
  [Parameter(Mandatory = $true)][string]$Jdk,
  [Parameter(Mandatory = $true)][string]$BuildTools,
  [string]$KeyStore,
  [string]$KeyAlias = 'release',
  [string]$StorePass = $env:KEYSTORE_PASS,
  [string]$KeyPass   = $env:KEYSTORE_PASS,
  [switch]$DebugKey
)

$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

$root   = (Get-Location).Path
$work   = Join-Path $root 'android/build'
$appDir = Join-Path $work  'app'
$aapt2  = Join-Path $BuildTools 'aapt2.exe'
$zipAl  = Join-Path $BuildTools 'zipalign.exe'
$signer = Join-Path $BuildTools 'lib/apksigner.jar'
$androidJar = Join-Path $BuildTools 'android.jar'

foreach ($t in @($aapt2, $zipAl, $signer, $androidJar)) {
  if (-not (Test-Path $t)) { throw "找不到 $t，请检查 -BuildTools" }
}
if (-not $Test-Path (Join-Path $Jdk 'bin/javac.exe')) { throw "找不到 javac，请检查 -Jdk" }

# ---------- 1. 准备工程目录 ----------
Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $appDir, "$appDir/assets", "$appDir/res/values", "$work/out", "$work/gen" | Out-Null
Copy-Item (Join-Path $root 'android/AndroidManifest.xml') $appDir
Copy-Item (Join-Path $root 'android/src') "$appDir/src" -Recurse

# 图标：没有就跳过（用系统默认图标）
$icon = Join-Path $root 'android/res/mipmap-xxhdpi/ic_launcher.png'
if (Test-Path $icon) {
  New-Item -ItemType Directory -Force "$appDir/res/mipmap-xxhdpi" | Out-Null
  Copy-Item $icon "$appDir/res/mipmap-xxhdpi/"
}

# ---------- 2. 页面内联成单文件，塞进 assets ----------
Write-Host '[1/6] 构建单文件页面'
node tools/build-standalone.mjs detail
node tools/build-standalone.mjs leave
Copy-Item (Join-Path $root 'detail/mobile-standalone.html') "$appDir/assets/index.html"
Copy-Item (Join-Path $root 'leave/mobile-standalone.html')  "$appDir/assets/leave.html"

# MainActivity 里的映射与文件名保持一致：leave/index.html → leave.html
# ---------- 3. aapt2 ----------
Write-Host '[2/6] aapt2 compile / link'
& $aapt2 compile --dir "$appDir/res" -o "$work/out"
& $aapt2 link -o "$work/base.apk" -I $androidJar --manifest "$appDir/AndroidManifest.xml" `
  -A "$appDir/assets" -R "$work/out" --java "$work/gen" --auto-add-overlay

# ---------- 4. javac + d8 ----------
Write-Host '[3/6] javac'
$javaFiles = Get-ChildItem "$appDir/src" -Recurse -Filter *.java | ForEach-Object { $_.FullName }
& (Join-Path $Jdk 'bin/javac.exe') -encoding UTF-8 -source 8 -target 8 `
  -bootclasspath $androidJar -classpath $androidJar -d "$work/classes" $javaFiles

Write-Host '[4/6] d8'
$classes = Get-ChildItem "$work/classes" -Recurse -Filter *.class | ForEach-Object { $_.FullName }
& (Join-Path $BuildTools 'd8.bat') --release --min-api 21 --lib $androidJar `
  --output "$work/dex" $classes
Copy-Item "$work/dex/classes.dex" $work

# ---------- 5. 组装 + 对齐 ----------
Write-Host '[5/6] 组装 / zipalign'
Push-Location $work
& (Join-Path $Jdk 'bin/jar.exe') uf base.apk classes.dex
Pop-Location
& $zipAl -p 4 "$work/base.apk" "$work/aligned.apk"

# ---------- 6. 签名 ----------
Write-Host '[6/6] 签名'
if ($DebugKey) {
  if (-not $KeyStore) {
    $KeyStore = Join-Path $env:USERPROFILE '.android/debug.keystore'
    $StorePass = 'android'; $KeyPass = 'android'; $KeyAlias = 'androiddebugkey'
  }
}
if (-not $KeyStore -or -not (Test-Path $KeyStore)) { throw "需要 -KeyStore，或加 -DebugKey 用调试证书" }
if (-not $StorePass) { throw '请通过 -StorePass 或环境变量 KEYSTORE_PASS 提供口令' }

$outApk = Join-Path $root 'android/build/leave-demo.apk'
& (Join-Path $Jdk 'bin/java.exe') -jar $signer sign `
  --ks $KeyStore --ks-key-alias $KeyAlias --ks-pass "pass:$StorePass" --key-pass "pass:$KeyPass" `
  --out $outApk "$work/aligned.apk"

& (Join-Path $Jdk 'bin/java.exe') -jar $signer verify --verbose $outApk
Write-Host "`nOK → $outApk" -ForegroundColor Green
