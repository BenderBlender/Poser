$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Установите Node.js 22.15 или новее.' }
if (-not (Test-Path -LiteralPath 'node_modules')) {
    npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw 'Не удалось установить зависимости.' }
}
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Не удалось собрать приложение.' }
Write-Host 'Откройте http://127.0.0.1:3000 после сообщения Pose Studio.'
npm.cmd start
