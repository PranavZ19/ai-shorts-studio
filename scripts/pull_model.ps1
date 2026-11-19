$env:OLLAMA_MODELS = "D:\AI-Shorts-Studio\storage\models\ollama"
$ollamaBin = "C:\Users\DELL\AppData\Local\Programs\Ollama\ollama.exe"

Write-Host "Starting Ollama server in background with OLLAMA_MODELS=$env:OLLAMA_MODELS..."
$serveProc = Start-Process -FilePath $ollamaBin -ArgumentList "serve" -PassThru -NoNewWindow
Start-Sleep -Seconds 3

Write-Host "Pulling lightweight model qwen2.5:3b into D:\AI-Shorts-Studio\storage\models\ollama..."
& $ollamaBin pull qwen2.5:3b

Write-Host "Listing models to verify download:"
& $ollamaBin list

Write-Host "Stopping Ollama temporary serve process (PID: $($serveProc.Id))..."
Stop-Process -Id $serveProc.Id -Force -ErrorAction SilentlyContinue
Write-Host "Done!"
