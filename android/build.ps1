param(
    [string]$SdkPath = (Join-Path $PSScriptRoot '..\.android-sdk'),
    [string]$JavaPath = 'E:\jdk'
)
$ErrorActionPreference = 'Stop'
$project = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$sdk = [IO.Path]::GetFullPath($SdkPath)
$toolDir = Get-ChildItem -LiteralPath (Join-Path $sdk 'build-tools') -Filter aapt2.exe -Recurse | Select-Object -First 1 -ExpandProperty DirectoryName
$platformJar = Get-ChildItem -LiteralPath (Join-Path $sdk 'platforms') -Filter android.jar -Recurse | Select-Object -First 1 -ExpandProperty FullName
if (!$toolDir -or !$platformJar) { throw 'Install Android SDK Build Tools 35 and Android Platform 35 before building.' }
if (!(Test-Path -LiteralPath (Join-Path $JavaPath 'bin\javac.exe'))) { throw 'Pass -JavaPath pointing to a JDK 17 installation.' }
$build = Join-Path $PSScriptRoot 'build'
$classes = Join-Path $build 'classes'
$dex = Join-Path $build 'dex'
$assets = Join-Path $build 'assets'
$www = Join-Path $assets 'www'
$dist = Join-Path $project 'dist'
$keys = Join-Path $PSScriptRoot 'keys'
foreach ($dir in @($build,$classes,$dex,$www,$dist,$keys)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
$env:JAVA_HOME = $JavaPath
function Invoke-Checked([string]$File, [string[]]$Arguments) {
    & $File @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Build command failed: $File ($LASTEXITCODE)" }
}
foreach ($file in @('index.html','styles.css','theme.css','ui.css','motion.css','motion.js','day-transfer.js','theme.js','course-schedule.js','timetable.js','date-picker.js','course-import.js','app.js','manifest.webmanifest')) { Copy-Item -LiteralPath (Join-Path $project $file) -Destination (Join-Path $www $file) -Force }
Copy-Item -LiteralPath (Join-Path $project 'assets') -Destination $www -Recurse -Force
Invoke-Checked (Join-Path $toolDir 'aapt2.exe') @('compile','--dir',(Join-Path $PSScriptRoot 'res'),'-o',(Join-Path $build 'resources.zip'))
Invoke-Checked (Join-Path $toolDir 'aapt2.exe') @('link','-o',(Join-Path $build 'base.apk'),'-I',$platformJar,'--manifest',(Join-Path $PSScriptRoot 'AndroidManifest.xml'),(Join-Path $build 'resources.zip'))
$javaFiles = @(Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'src') -Filter '*.java' -Recurse | Select-Object -ExpandProperty FullName)
Invoke-Checked (Join-Path $JavaPath 'bin\javac.exe') (@('-encoding','UTF-8','-source','8','-target','8','-classpath',$platformJar,'-d',$classes) + $javaFiles)
Invoke-Checked (Join-Path $JavaPath 'bin\jar.exe') @('cf',(Join-Path $build 'classes.jar'),'-C',$classes,'.')
Invoke-Checked (Join-Path $toolDir 'd8.bat') @('--release','--min-api','26','--lib',$platformJar,'--output',$dex,(Join-Path $build 'classes.jar'))
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::Open((Join-Path $build 'base.apk'),[IO.Compression.ZipArchiveMode]::Update)
try {
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,(Join-Path $dex 'classes.dex'),'classes.dex',[IO.Compression.CompressionLevel]::Optimal) | Out-Null
    # Some Windows aapt2 versions emit backslashes for nested assets. Add POSIX paths explicitly.
    foreach ($asset in @(Get-ChildItem -LiteralPath $assets -File -Recurse)) {
        $entryName = 'assets/' + $asset.FullName.Substring($assets.Length + 1).Replace('\','/')
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$asset.FullName,$entryName,[IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
} finally { $zip.Dispose() }
Invoke-Checked (Join-Path $toolDir 'zipalign.exe') @('-f','-P','16','4',(Join-Path $build 'base.apk'),(Join-Path $build 'aligned.apk'))
$keystore = Join-Path $keys 'kejian-release.p12'
$passwordFile = Join-Path $keys 'password.txt'
if (!(Test-Path -LiteralPath $keystore)) {
    $random = New-Object byte[] 32
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($random) } finally { $rng.Dispose() }
    [IO.File]::WriteAllText($passwordFile,[Convert]::ToBase64String($random),[Text.UTF8Encoding]::new($false))
    Invoke-Checked (Join-Path $JavaPath 'bin\keytool.exe') @('-genkeypair','-keystore',$keystore,'-storetype','PKCS12','-storepass:file',$passwordFile,'-alias','kejian','-keyalg','RSA','-keysize','3072','-validity','10000','-dname','CN=Kejian, OU=Mobile, O=Personal, C=CN','-noprompt')
}
if (!(Test-Path -LiteralPath $passwordFile)) { throw 'Signing password missing. Restore android/keys/password.txt.' }
$apk = Join-Path $dist 'kejian-1.7.3.apk'
Invoke-Checked (Join-Path $toolDir 'apksigner.bat') @('sign','--ks',$keystore,'--ks-key-alias','kejian','--ks-pass',"file:$passwordFile",'--out',$apk,(Join-Path $build 'aligned.apk'))
Invoke-Checked (Join-Path $toolDir 'apksigner.bat') @('verify','--verbose','--print-certs',$apk)
Invoke-Checked (Join-Path $toolDir 'zipalign.exe') @('-c','-P','16','4',$apk)
$verification = [IO.Compression.ZipFile]::OpenRead($apk)
try {
    foreach ($file in @('app.js','theme.js','theme.css','ui.css','motion.css','motion.js','day-transfer.js','course-schedule.js','timetable.js','date-picker.js','course-import.js','index.html','styles.css','manifest.webmanifest')) {
        $entry = $verification.GetEntry('assets/www/' + $file)
        if (!$entry) { throw "Missing APK asset: $file" }
        $reader = [IO.StreamReader]::new($entry.Open(),[Text.Encoding]::UTF8)
        try { $packed = $reader.ReadToEnd() } finally { $reader.Dispose() }
        if ($packed -cne [IO.File]::ReadAllText((Join-Path $project $file))) { throw "Outdated APK asset: $file" }
    }
    if (!$verification.GetEntry('classes.dex')) { throw 'DEX missing from APK' }
    foreach ($file in @('tesseract.min.js','worker.min.js','tesseract-core-lstm.wasm.js','tesseract-core-simd-lstm.wasm.js','tesseract-core.wasm.js','tesseract-core-simd.wasm.js','chi_sim.traineddata.gz','eng.traineddata.gz','LICENSE-core.txt','LICENSE-tesseract.txt','LICENSE-models.txt','README.txt')) {
        $entry = $verification.GetEntry('assets/www/assets/ocr/' + $file)
        if (!$entry) { throw "Missing offline OCR asset: $file" }
        $sha = [Security.Cryptography.SHA256]::Create()
        $packedStream = $entry.Open()
        try { $packedHash = [BitConverter]::ToString($sha.ComputeHash($packedStream)).Replace('-','') } finally { $packedStream.Dispose(); $sha.Dispose() }
        if ($packedHash -ne (Get-FileHash -LiteralPath (Join-Path $project ('assets/ocr/' + $file)) -Algorithm SHA256).Hash) { throw "Outdated OCR asset: $file" }
    }
    if ($verification.Entries | Where-Object { $_.FullName.Contains('\') -or $_.FullName -match 'password|\.p12|\.java|\.ps1' }) { throw 'Invalid path or build-only files inside APK' }
} finally { $verification.Dispose() }
$checksum = (Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText((Join-Path $dist 'kejian-1.7.3.apk.sha256'),"$checksum  kejian-1.7.3.apk`n",[Text.UTF8Encoding]::new($false))
Write-Host "APK ready: $apk"
Write-Host "SHA256: $checksum"
