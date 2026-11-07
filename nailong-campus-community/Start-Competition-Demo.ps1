param(
    [ValidateRange(1024, 65535)]
    [int]$Port = 5179
)
$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    $nodeVersionText = (& node -p "process.versions.node").Trim()
    $nodeVersion = [version]$nodeVersionText
    if ($nodeVersion -lt [version]'22.5') {
        throw "需要 Node.js 22.5 或更新版本，当前为 $nodeVersionText。"
    }

    $portProbe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
    try {
        $portProbe.Start()
    } catch {
        throw "端口 $Port 正在使用。请先关闭该端口的旧服务，再运行此脚本。"
    } finally {
        $portProbe.Stop()
    }

    $runStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $env:PORT = "$Port"
    $env:CAMPUS_DATA_DIR = Join-Path $env:TEMP "nailong-campus-submit-$runStamp"

    Write-Host "正在构建参赛演示版本；独立演示数据目录：$env:CAMPUS_DATA_DIR" -ForegroundColor Cyan
    & npm run build
    if ($LASTEXITCODE -ne 0) {
        throw '网页构建失败，请修复错误后重新运行。'
    }

    Write-Host "构建完成。打开 http://127.0.0.1:$Port/ 体验；结束时按 Ctrl+C。" -ForegroundColor Green
    & npm start
} finally {
    Remove-Item Env:PORT -ErrorAction SilentlyContinue
    Remove-Item Env:CAMPUS_DATA_DIR -ErrorAction SilentlyContinue
    Pop-Location
}
