param(
    [Parameter(Mandatory = $true)][ValidateSet('Start', 'Stop')][string]$Action,
    [switch]$NoBrowser
)
$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\')
$outputDirectory = Join-Path $projectRoot 'output'
$stateFile = Join-Path $outputDirectory 'server-state.json'
$pidFile = Join-Path $outputDirectory 'server.pid'
$mutex = $null
$hasLock = $false

function Get-ProcessInfo([int]$ProcessNumber) {
    Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessNumber" -ErrorAction Stop
}

function Test-ProjectProcess($ProcessInfo) {
    if (-not $ProcessInfo -or $ProcessInfo.Name -ne 'node.exe') { return $false }
    $command = ([string]$ProcessInfo.CommandLine).Replace('/', '\')
    return $command.IndexOf($projectRoot + '\', [StringComparison]::OrdinalIgnoreCase) -ge 0 -and $command -match 'server\.ts'
}

function Get-TrackedProcess {
    if (Test-Path -LiteralPath $stateFile) {
        $saved = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
        if ($saved.projectRoot -ne $projectRoot) { throw 'Запись запуска относится к другой папке. Остановка отменена.' }
        $processInfo = Get-ProcessInfo ([int]$saved.pid)
        if (-not $processInfo) { return $null }
        $expected = [DateTime]::Parse($saved.startedUtc).ToUniversalTime()
        if (-not (Test-ProjectProcess $processInfo) -or [Math]::Abs(($processInfo.CreationDate.ToUniversalTime() - $expected).TotalSeconds) -gt 1) {
            throw 'Номер процесса занят другой программой. Она не будет остановлена.'
        }
        return @{ Process = $processInfo; Port = [int]$saved.port }
    }
    # Adopt the previously launched version only when its PID, time and project path agree.
    if (Test-Path -LiteralPath $pidFile) {
        $processInfo = Get-ProcessInfo ([int](Get-Content -LiteralPath $pidFile -Raw).Trim())
        if (-not $processInfo) { return $null }
        $timestamp = (Get-Item -LiteralPath $pidFile).LastWriteTimeUtc
        $children = @(Get-CimInstance Win32_Process -Filter "ParentProcessId=$($processInfo.ProcessId)")
        $owned = (Test-ProjectProcess $processInfo) -or @($children | Where-Object { Test-ProjectProcess $_ }).Count -gt 0
        if ($processInfo.Name -ne 'node.exe' -or -not $owned -or [Math]::Abs(($timestamp - $processInfo.CreationDate.ToUniversalTime()).TotalSeconds) -gt 15) {
            throw 'Не удалось подтвердить принадлежность старого процесса поузеру. Другие программы не затронуты.'
        }
        return @{ Process = $processInfo; Port = 3000 }
    }
    return $null
}

function Get-ProcessTree($ParentInfo) {
    foreach ($child in @(Get-CimInstance Win32_Process -Filter "ParentProcessId=$($ParentInfo.ProcessId)")) {
        if ($child.CreationDate -ge $ParentInfo.CreationDate) { Get-ProcessTree $child }
    }
    $ParentInfo
}

function Stop-OwnedTree($ParentInfo) {
    foreach ($target in @(Get-ProcessTree $ParentInfo)) {
        $current = Get-ProcessInfo ([int]$target.ProcessId)
        if ($current -and $current.CreationDate -eq $target.CreationDate) {
            Stop-Process -Id ([int]$current.ProcessId) -Force -ErrorAction SilentlyContinue
        }
    }
}

try {
    $hash = [System.Security.Cryptography.SHA256]::Create()
    try { $key = [BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($projectRoot.ToLowerInvariant()))).Replace('-', '').Substring(0, 20) }
    finally { $hash.Dispose() }
    $mutex = New-Object System.Threading.Mutex($false, "Local\PoseStudio-$key")
    try { $hasLock = $mutex.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $hasLock = $true }
    if (-not $hasLock) { throw 'Запуск или остановка поузера уже выполняется. Подождите завершения.' }

    $tracked = Get-TrackedProcess
    if ($Action -eq 'Stop') {
        if ($tracked) {
            Stop-OwnedTree $tracked.Process
            Write-Host 'Pose Studio остановлен.' -ForegroundColor Green
        } else { Write-Host 'Pose Studio уже остановлен.' }
        foreach ($file in @($stateFile, $pidFile)) {
            if (Test-Path -LiteralPath $file) { Remove-Item -LiteralPath $file -Force }
        }
    } elseif ($tracked) {
        Write-Host 'Pose Studio уже запущен.' -ForegroundColor Green
        if (-not $NoBrowser) { Start-Process "http://127.0.0.1:$($tracked.Port)/" }
    } else {
        Set-Location -LiteralPath $projectRoot
        $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
        if (-not $nodeCommand) { throw 'Установите Node.js версии 22.15 или новее.' }
        $nodeVersion = [version]((& $nodeCommand.Source --version).Trim().TrimStart('v'))
        if ($nodeVersion -lt [version]'22.15.0') { throw 'Требуется Node.js версии 22.15 или новее.' }
        if (-not (Test-Path -LiteralPath 'node_modules\tsx\package.json')) {
            Write-Host 'Устанавливаются необходимые библиотеки...'
            & npm.cmd ci
            if ($LASTEXITCODE -ne 0) { throw 'Не удалось установить библиотеки приложения.' }
        }
        Write-Host 'Подготовка Pose Studio...'
        & npm.cmd run build
        if ($LASTEXITCODE -ne 0) { throw 'Не удалось собрать приложение.' }
        $serverFile = Join-Path $projectRoot 'server.ts'
        $portText = & $nodeCommand.Source --import tsx $serverFile --print-port
        if ($LASTEXITCODE -ne 0) { throw 'Не удалось прочитать настройки запуска.' }
        $listenPort = 0
        if (-not [int]::TryParse([string]$portText, [ref]$listenPort) -or $listenPort -lt 1 -or $listenPort -gt 65535) { throw 'В настройке PORT указан неверный номер порта.' }
        New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
        $serverFile = Join-Path $projectRoot 'server.ts'
        $started = Start-Process -FilePath $nodeCommand.Source -ArgumentList @('--import', 'tsx', ('"' + $serverFile + '"'), '--production') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $outputDirectory 'server.log') -RedirectStandardError (Join-Path $outputDirectory 'server-error.log') -PassThru
        $started.Id | Set-Content -LiteralPath $pidFile -Encoding ASCII
        @{ pid = $started.Id; projectRoot = $projectRoot; startedUtc = $started.StartTime.ToUniversalTime().ToString('o'); port = $listenPort } | ConvertTo-Json | Set-Content -LiteralPath $stateFile -Encoding UTF8
        $ready = $false
        $deadline = [DateTime]::UtcNow.AddSeconds(25)
        while ([DateTime]::UtcNow -lt $deadline) {
            $started.Refresh()
            if ($started.HasExited) { break }
            try {
                $health = Invoke-RestMethod -Uri "http://127.0.0.1:$listenPort/api/health" -TimeoutSec 2
                if ($health.app -eq 'pose-studio' -and [int]$health.pid -eq $started.Id) { $ready = $true; break }
            } catch { }
            Start-Sleep -Milliseconds 250
        }
        if (-not $ready) {
            $failed = Get-TrackedProcess
            if ($failed) { Stop-OwnedTree $failed.Process }
            foreach ($file in @($stateFile, $pidFile)) { if (Test-Path -LiteralPath $file) { Remove-Item -LiteralPath $file -Force } }
            throw 'Приложение не запустилось. Возможно, порт занят. Подробности: output\server-error.log.'
        }
        Write-Host "Pose Studio запущен: http://127.0.0.1:$listenPort/" -ForegroundColor Green
        if (-not $NoBrowser) { Start-Process "http://127.0.0.1:$listenPort/" }
    }
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
} finally {
    if ($hasLock) { $mutex.ReleaseMutex() }
    if ($mutex) { $mutex.Dispose() }
}
