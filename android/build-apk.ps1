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
  [string]$AndroidJar,
  [string]$KeyStore,
  [string]$KeyAlias = 'release',
  [string]$StorePass = $env:KEYSTORE_PASS,
  [string]$KeyPass   = $env:KEYSTORE_PASS,
  [switch]$DebugKey
)

# 注意：aapt2 / javac 会把 note / warning 写到 stderr，Stop 会误判成异常
$ErrorActionPreference = 'Continue'

# d8.bat / apksigner 都要求能找到 java
$env:JAVA_HOME = $Jdk
$env:PATH = (Join-Path $Jdk 'bin') + ';' + $env:PATH
Set-Location (Join-Path $PSScriptRoot '..')

$root   = (Get-Location).Path
$work   = Join-Path $root 'android/build'
$appDir = Join-Path $work  'app'
$aapt2  = Join-Path $BuildTools 'aapt2.exe'
$zipAl  = Join-Path $BuildTools 'zipalign.exe'
$signer = Join-Path $BuildTools 'lib/apksigner.jar'
# android.jar 在 SDK 的 platforms/ 下，不在 build-tools 里；没显式给就自动找
if (-not $AndroidJar) {
  $sdkRoot = Split-Path (Split-Path $BuildTools -Parent) -Parent
  $AndroidJar = Get-ChildItem $sdkRoot -Recurse -Filter 'android.jar' -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $AndroidJar) { throw '找不到 android.jar，请用 -AndroidJar 指定（位于 SDK 的 platforms/android-XX/ 下）' }
$androidJar = $AndroidJar

foreach ($t in @($aapt2, $zipAl, $signer, $androidJar)) {
  if (-not (Test-Path $t)) { throw "找不到 $t，请检查 -BuildTools" }
}
if (-not (Test-Path (Join-Path $Jdk 'bin/javac.exe'))) { throw "找不到 javac，请检查 -Jdk" }

# ---------- 1. 准备工程目录 ----------
Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $appDir, "$appDir/assets", "$appDir/res/values", "$work/out", "$work/gen", "$work/dex" | Out-Null
Copy-Item (Join-Path $root 'android/AndroidManifest.xml') $appDir
Copy-Item (Join-Path $root 'android/src') "$appDir/src" -Recurse

# 资源：图标 + values/strings.xml + values/styles.xml 全都要（manifest 引用了 @string/app_name、@style/AppTheme）
$resSrc = Join-Path $root 'android/res'
if (Test-Path $resSrc) {
  Copy-Item (Join-Path $resSrc "*") "$appDir/res" -Recurse -Force   # 拷内容，别套成 res/res
  Write-Host "      资源文件 $((Get-ChildItem "$appDir/res" -Recurse -File).Count) 个"
} else {
  throw '缺少 android/res（图标与 strings/styles）'
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
if ($LASTEXITCODE -ne 0) { throw 'aapt2 compile 失败' }

# 注意：-R 要一个一个传编译后的 .flat 文件，传目录会报「failed to open file」
$flats = Get-ChildItem "$work/out" -Recurse -Filter *.flat | ForEach-Object { $_.FullName }
Write-Host "      编译产物 $($flats.Count) 个 .flat"
$aaptArgs = @('-o', "$work/base.apk", '-I', $androidJar, '--manifest', "$appDir/AndroidManifest.xml",
              '-A', "$appDir/assets", '--java', "$work/gen", '--auto-add-overlay')
foreach ($f in $flats) { $aaptArgs += @('-R', $f) }
& $aapt2 link @aaptArgs
if ($LASTEXITCODE -ne 0) { throw 'aapt2 link 失败' }

# ---------- 4. javac + d8 ----------
Write-Host '[3/6] javac'
$javaFiles = Get-ChildItem "$appDir/src" -Recurse -Filter *.java | ForEach-Object { $_.FullName }
& (Join-Path $Jdk 'bin/javac.exe') -encoding UTF-8 -source 8 -target 8 `
  -bootclasspath $androidJar -classpath $androidJar -d "$work/classes" $javaFiles

Write-Host '[4/6] d8'
$classes = Get-ChildItem "$work/classes" -Recurse -Filter *.class | ForEach-Object { $_.FullName }
& (Join-Path $BuildTools 'd8.bat') --release --min-api 21 --lib $androidJar `
  --output "$work/dex" $classes
if (-not (Test-Path "$work/dex/classes.dex")) { throw 'd8 没有产出 classes.dex（检查 JAVA_HOME）' }
Copy-Item "$work/dex/classes.dex" $work -Force

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
