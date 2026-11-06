import mimetypes
import subprocess
import json
import wave
from pathlib import Path
from typing import Any, Dict

from PIL import Image


class LocalIntegrationAdapter:
    """Provider-neutral local adapters for content imported from external tools."""

    SUPPORTED_SOURCES = {"cms", "google_docs", "figma", "webflow", "hubspot"}

    @classmethod
    def normalize_text_import(cls, source: str, title: str, content: str) -> Dict[str, Any]:
        source_key = source.strip().lower()
        if source_key not in cls.SUPPORTED_SOURCES:
            raise ValueError(f"Unsupported integration source: {source}")
        if not title.strip() or not content.strip():
            raise ValueError("Imported title and content are required")
        return {
            "source": source_key,
            "title": title.strip(),
            "content_text": content,
            "content_type": "text",
        }

    @staticmethod
    def inspect_media(path: str, media_type: str) -> Dict[str, Any]:
        file_path = Path(path)
        if not file_path.is_file():
            raise FileNotFoundError("Imported media file was not found")
        detected_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
        result = {
            "media_type": media_type,
            "mime_type": detected_type,
            "size_bytes": file_path.stat().st_size,
        }
        if media_type == "image":
            with Image.open(file_path) as image:
                result.update({"width": image.width, "height": image.height, "format": image.format})
        elif media_type in {"audio", "video"}:
            result.update(LocalIntegrationAdapter._inspect_with_ffprobe(file_path))
            if media_type == "audio" and file_path.suffix.lower() == ".wav":
                result.update(LocalIntegrationAdapter._inspect_wav(file_path))
        else:
            raise ValueError("media_type must be image, audio, or video")
        return result

    @staticmethod
    def _inspect_with_ffprobe(file_path: Path) -> Dict[str, Any]:
        """Use ffprobe when installed; return an explicit fallback otherwise."""
        try:
            completed = subprocess.run(
                [
                    "ffprobe", "-v", "error", "-show_entries",
                    "format=duration,bit_rate,size:stream=index,codec_name,codec_type,width,height,channels,sample_rate",
                    "-of", "json", str(file_path),
                ],
                capture_output=True,
                text=True,
                timeout=10,
                check=True,
            )
            data = json.loads(completed.stdout)
            result: Dict[str, Any] = {"inspector": "ffprobe"}
            if data.get("format"):
                result["format_details"] = data["format"]
            if data.get("streams"):
                result["streams"] = data["streams"]
            return result
        except (FileNotFoundError, subprocess.SubprocessError, json.JSONDecodeError):
            return {"inspector": "basic", "technical_metadata_available": False}

    @staticmethod
    def _inspect_wav(file_path: Path) -> Dict[str, Any]:
        try:
            with wave.open(str(file_path), "rb") as wav_file:
                return {
                    "technical_metadata_available": True,
                    "duration_seconds": round(wav_file.getnframes() / wav_file.getframerate(), 3),
                    "sample_rate": wav_file.getframerate(),
                    "channels": wav_file.getnchannels(),
                    "sample_width_bytes": wav_file.getsampwidth(),
                }
        except (wave.Error, EOFError):
            return {"technical_metadata_available": False}
