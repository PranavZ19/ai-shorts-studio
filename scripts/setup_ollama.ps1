$ErrorActionPreference = 'Stop'

$toolsDir = 'D:\AI-Shorts-Studio\tools'
$ollamaModelDir = 'D:\AI-Shorts-Studio\storage\models\ollama'

if (-not (Test-Path $toolsDir)) { New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null }
if (-not (Test-Path $ollamaModelDir)) { New-Item -ItemType Directory -Force -Path $ollamaModelDir | Out-Null }

Write-Host "Configuring OLLAMA_MODELS user environment variable..."
[Environment]::SetEnvironmentVariable('OLLAMA_MODELS', $ollamaModelDir, [EnvironmentVariableTarget]::User)
[Environment]::SetEnvironmentVariable('OLLAMA_MODELS', $ollamaModelDir, [EnvironmentVariableTarget]::Process)
$env:OLLAMA_MODELS = $ollamaModelDir

$installerPath = Join-Path $toolsDir "OllamaSetup.exe"
if (-not (Test-Path $installerPath)) {
    Write-Host "Downloading Ollama installer from https://ollama.com/download/OllamaSetup.exe ..."
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
    Invoke-WebRequest -Uri "https://ollama.com/download/OllamaSetup.exe" -OutFile $installerPath
    Write-Host "Downloaded Ollama installer ($((Get-Item $installerPath).Length) bytes)."
}

Write-Host "Running Ollama installer silently..."
$proc = Start-Process -FilePath $installerPath -ArgumentList "/SILENT" -Wait -PassThru
Write-Host "Installer finished with exit code: $($proc.ExitCode)"

# Check installed locations
$possibleOllamaPaths = @(
    "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe",
    "C:\Users\DELL\AppData\Local\Programs\Ollama\ollama.exe",
    "C:\Program Files\Ollama\ollama.exe"
)

$foundOllama = $null
foreach ($p in $possibleOllamaPaths) {
    if (Test-Path $p) {
        $foundOllama = $p
        break
    }
}

if ($foundOllama) {
    Write-Host "Found Ollama at: $foundOllama"
    $ollamaDir = Split-Path $foundOllama -Parent
    # Add to User PATH
    $userPath = [Environment]::GetEnvironmentVariable('Path', [EnvironmentVariableTarget]::User)
    if ($userPath -notlike "*$ollamaDir*") {
        [Environment]::SetEnvironmentVariable('Path', "$ollamaDir;$userPath", [EnvironmentVariableTarget]::User)
        Write-Host "Added Ollama to User PATH: $ollamaDir"
    }
    & $foundOllama --version
} else {
    Write-Host "Searching for ollama.exe..."
    Get-ChildItem -Path "$env:LOCALAPPDATA\Programs" -Filter "ollama.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object FullName
}
