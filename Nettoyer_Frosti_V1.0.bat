@echo off
setlocal
rem Frosti V1.0 - Placer ce fichier a cote de package.json.
set "FROSTI_CLEANUP_SCRIPT=%~f0"
set "FROSTI_CLEANUP_ROOT=%~dp0"
powershell.exe -NoLogo -NoProfile -Command "$text = Get-Content -LiteralPath $env:FROSTI_CLEANUP_SCRIPT -Raw; & ([scriptblock]::Create(($text -split '(?m)^# POWERSHELL_BEGIN\r?$', 2)[1]))"
if errorlevel 1 exit /b 1
pushd "%~dp0"
if errorlevel 1 exit /b 1
echo.
echo Verification de Frosti V1.0...
call npm run verify
set "FROSTI_VERIFY_RESULT=%errorlevel%"
popd
if not "%FROSTI_VERIFY_RESULT%"=="0" echo La verification a echoue. Conservez le message du terminal.
exit /b %FROSTI_VERIFY_RESULT%

# POWERSHELL_BEGIN
$ErrorActionPreference = 'Stop'
try {
    $root = (Get-Item -LiteralPath $env:FROSTI_CLEANUP_ROOT).FullName.TrimEnd('\')
    $packagePath = Join-Path $root 'package.json'
    if (-not (Test-Path -LiteralPath $packagePath -PathType Leaf)) {
        throw 'Placez ce .bat a la racine du projet Frosti, a cote de package.json.'
    }
    $package = Get-Content -LiteralPath $packagePath -Raw | ConvertFrom-Json
    if ($package.name -ne 'gestion-congelateur' -or -not (Test-Path -LiteralPath (Join-Path $root 'proxy.ts') -PathType Leaf)) {
        throw 'Ce dossier ne correspond pas au projet Frosti V1.0 attendu (package.json et proxy.ts). Aucun fichier deplace.'
    }
    $targets = @(
        'app\components\Header.tsx',
        'app\components\Footer.tsx',
        'app\components\InstallPrompt.tsx',
        'app\supabase',
        'utils\supabase',
        'middleware.ts'
    )
    $appPath = Join-Path $root 'app'
    if (Test-Path -LiteralPath $appPath -PathType Container) {
        $targets += @(Get-ChildItem -LiteralPath $appPath -Recurse -File | Where-Object { $_.Name -like '*Copie*' } | ForEach-Object { $_.FullName.Substring($root.Length + 1) })
    }
    $targets = @($targets | Sort-Object -Unique | Where-Object { Test-Path -LiteralPath (Join-Path $root $_) })
    if ($targets.Count -eq 0) {
        Write-Host 'Aucun ancien fichier a deplacer. Le nettoyage est deja fait.'
        exit 0
    }
    $suffix = (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + ([guid]::NewGuid().ToString('N').Substring(0, 8))
    $backup = Join-Path (Split-Path -Parent $root) ('Frosti_sauvegarde_avant_nettoyage_' + $suffix)
    New-Item -ItemType Directory -Path $backup | Out-Null
    $logPath = Join-Path $backup 'fichiers_deplaces.txt'
    ('Frosti V1.0 - Source : ' + $root) | Set-Content -LiteralPath $logPath -Encoding UTF8
    foreach ($relative in $targets) {
        $source = Join-Path $root $relative
        if (-not (Test-Path -LiteralPath $source)) { continue }
        $destination = Join-Path $backup $relative
        $parent = Split-Path -Parent $destination
        if (-not (Test-Path -LiteralPath $parent)) {
            New-Item -ItemType Directory -Path $parent -Force | Out-Null
        }
        Move-Item -LiteralPath $source -Destination $destination
        $relative | Add-Content -LiteralPath $logPath -Encoding UTF8
        Write-Host ('Sauvegarde : ' + $relative)
    }
    Write-Host ''
    Write-Host ('Sauvegarde disponible dans : ' + $backup)
    Write-Host 'Nettoyage termine. .env.local, proxy.ts et les sources actuelles sont conserves.'
    exit 0
} catch {
    Write-Host ('ERREUR : ' + $_.Exception.Message) -ForegroundColor Red
    Write-Host 'Verification npm non lancee. Les fichiers deja deplaces restent dans la sauvegarde indiquee.'
    exit 1
}
