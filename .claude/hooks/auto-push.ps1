param()

# Автокоммит и push в main после каждого ответа Claude.
# Путь к репозиторию берём от самого скрипта ($PSScriptRoot), а не из вывода git:
# Windows PowerShell 5.1 портит кириллицу в выводе git ("Рабочий стол"), и Set-Location падал.

$ErrorActionPreference = 'Stop'

try {
    $stdinRaw = [Console]::In.ReadToEnd()
    $data = $null
    if ($stdinRaw) {
        try { $data = $stdinRaw | ConvertFrom-Json } catch { $data = $null }
    }

    if ($data -and $data.stop_hook_active) {
        exit 0
    }

    $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
    Set-Location -LiteralPath $repoRoot

    if (-not (Test-Path -LiteralPath (Join-Path $repoRoot '.git'))) {
        exit 0
    }

    $statusOutput = git status --porcelain
    if (-not $statusOutput) {
        exit 0
    }

    git add -A
    if ($LASTEXITCODE -ne 0) { exit 1 }

    $commitMessage = "auto: session changes $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    git commit -m $commitMessage
    if ($LASTEXITCODE -ne 0) { exit 1 }

    git push origin main
    if ($LASTEXITCODE -ne 0) { exit 1 }

    exit 0
} catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
}
