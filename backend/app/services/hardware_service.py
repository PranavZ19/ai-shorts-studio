import subprocess
import shutil
import platform
import psutil
import httpx
from typing import Dict, Any
from app.config import settings

def get_cpu_info() -> Dict[str, Any]:
    return {
        "processor": platform.processor(),
        "physical_cores": psutil.cpu_count(logical=False) or 1,
        "logical_cores": psutil.cpu_count(logical=True) or 1,
        "current_usage_percent": psutil.cpu_percent(interval=0.1)
    }

def get_ram_info() -> Dict[str, Any]:
    mem = psutil.virtual_memory()
    return {
        "total_gb": round(mem.total / (1024**3), 2),
        "available_gb": round(mem.available / (1024**3), 2),
        "used_gb": round(mem.used / (1024**3), 2),
        "percent_used": mem.percent
    }

def get_disk_info() -> Dict[str, Any]:
    disks = []
    for part in psutil.disk_partitions(all=False):
        try:
            usage = psutil.disk_usage(part.mountpoint)
            disks.append({
                "device": part.device,
                "mountpoint": part.mountpoint,
                "total_gb": round(usage.total / (1024**3), 2),
                "free_gb": round(usage.free / (1024**3), 2),
                "percent_used": usage.percent
            })
        except (PermissionError, OSError):
            continue
    return {
        "storage_root": str(settings.STORAGE_ROOT),
        "disks": disks
    }

def get_gpu_info() -> Dict[str, Any]:
    gpu_data = {
        "has_nvidia_gpu": False,
        "name": "None",
        "driver_version": "N/A",
        "vram_total_mb": 0,
        "vram_used_mb": 0,
        "cuda_available": False,
        "acceleration_mode": "cpu"
    }

    # First check torch CUDA if installed
    try:
        import torch
        if torch.cuda.is_available():
            gpu_data["cuda_available"] = True
            gpu_data["acceleration_mode"] = "cuda"
            gpu_data["name"] = torch.cuda.get_device_name(0)
    except Exception:
        pass

    # Try nvidia-smi for precise VRAM and driver
    nvidia_smi = shutil.which("nvidia-smi")
    if nvidia_smi:
        try:
            res = subprocess.run(
                [nvidia_smi, "--query-gpu=gpu_name,driver_version,memory.total,memory.used", "--format=csv,noheader,nounits"],
                capture_output=True,
                text=True,
                timeout=3
            )
            if res.returncode == 0 and res.stdout.strip():
                parts = [p.strip() for p in res.stdout.strip().split(",")]
                if len(parts) >= 4:
                    gpu_data["has_nvidia_gpu"] = True
                    gpu_data["name"] = parts[0]
                    gpu_data["driver_version"] = parts[1]
                    gpu_data["vram_total_mb"] = int(float(parts[2]))
                    gpu_data["vram_used_mb"] = int(float(parts[3]))
                    if not gpu_data["cuda_available"]:
                        gpu_data["acceleration_mode"] = "cuda_ready"
        except Exception:
            pass

    return gpu_data

def get_ffmpeg_info() -> Dict[str, Any]:
    ffmpeg_bin = settings.FFMPEG_BIN
    ffprobe_bin = settings.FFPROBE_BIN
    
    ffmpeg_ok = False
    ffmpeg_version = "Not found"
    nvenc_supported = False
    
    try:
        res = subprocess.run([ffmpeg_bin, "-version"], capture_output=True, text=True, timeout=3)
        if res.returncode == 0:
            ffmpeg_ok = True
            ffmpeg_version = res.stdout.split("\n")[0].strip()
            if "nvenc" in res.stdout.lower():
                nvenc_supported = True
    except Exception:
        pass

    ffprobe_ok = False
    ffprobe_version = "Not found"
    try:
        res = subprocess.run([ffprobe_bin, "-version"], capture_output=True, text=True, timeout=3)
        if res.returncode == 0:
            ffprobe_ok = True
            ffprobe_version = res.stdout.split("\n")[0].strip()
    except Exception:
        pass

    return {
        "ffmpeg_installed": ffmpeg_ok,
        "ffmpeg_bin": ffmpeg_bin,
        "ffmpeg_version": ffmpeg_version,
        "ffprobe_installed": ffprobe_ok,
        "ffprobe_bin": ffprobe_bin,
        "ffprobe_version": ffprobe_version,
        "nvenc_hardware_acceleration": nvenc_supported
    }

def get_ollama_status() -> Dict[str, Any]:
    try:
        # Use low connection timeout so it doesn't block if Ollama is not active
        with httpx.Client(timeout=httpx.Timeout(0.4, connect=0.4)) as client:
            resp = client.get(f"{settings.OLLAMA_API_URL}/api/tags")
            if resp.status_code == 200:
                data = resp.json()
                models = [m.get("name") for m in data.get("models", [])]
                return {
                    "running": True,
                    "url": settings.OLLAMA_API_URL,
                    "available_models": models
                }
    except Exception:
        pass

    return {
        "running": False,
        "url": settings.OLLAMA_API_URL,
        "available_models": []
    }

def get_complete_system_status() -> Dict[str, Any]:
    return {
        "os": {
            "system": platform.system(),
            "release": platform.release(),
            "version": platform.version(),
            "architecture": platform.machine()
        },
        "cpu": get_cpu_info(),
        "ram": get_ram_info(),
        "gpu": get_gpu_info(),
        "disk": get_disk_info(),
        "ffmpeg": get_ffmpeg_info(),
        "ollama": get_ollama_status()
    }
