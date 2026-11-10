import shutil
import subprocess
import tempfile
import json
import logging
import math
import time
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List

from backend.config import settings

logger = logging.getLogger(__name__)


class MediaAnalyzer:
    """Extracts media evidence through installed local tools and configured providers."""

    @classmethod
    def analyze(
        cls,
        path: str,
        media_type: str,
        artifact_dir: Path | None = None,
        transcribe_speech: bool = True,
    ) -> Dict[str, Any]:
        file_path = Path(path)
        if not file_path.is_file():
            raise FileNotFoundError("Media file was not found")

        if media_type == "image":
            ocr = cls._ocr_image(file_path)
            return {
                "extraction_status": "complete" if ocr["available"] else "needs_review",
                "transcript": "",
                "ocr_text": ocr["text"],
                "extracted_text": ocr["text"],
                "findings": [],
                "capabilities": {"ocr": ocr["available"]},
                "missing_capabilities": [] if ocr["available"] else ["ocr"],
            }

        if media_type not in {"audio", "video"}:
            raise ValueError("media_type must be image, audio, or video")

        transcript = (
            cls._transcribe(file_path)
            if transcribe_speech
            else {"available": False, "text": "", "segments": []}
        )
        frames: List[Dict[str, Any]] = []
        video_duration = None
        if media_type == "video":
            video_duration = cls._probe_video_duration(file_path)
            frames = cls._analyze_video_frames(file_path, artifact_dir, video_duration)

        ocr_text = "\n".join(frame["text"] for frame in frames if frame.get("text")).strip()
        missing = []
        if not transcript["available"]:
            missing.append("speech_to_text")
        if media_type == "video" and not frames:
            missing.append("video_frame_extraction")
        if frames and not all(frame.get("ocr_available") for frame in frames):
            missing.append("ocr")

        extracted_text = "\n".join(
            part for part in [transcript["text"], ocr_text] if part
        ).strip()
        return {
            "extraction_status": "complete" if not missing else "needs_review",
            "transcript": transcript["text"],
            "transcript_segments": transcript.get("segments", []),
            "transcript_source": (
                transcript.get("source", "automatic") if transcript["available"] else "none"
            ),
            "transcript_confirmed": False,
            "ocr_text": ocr_text,
            "findings": frames,
            "frame_sampling": (
                {
                    "method": "uniform" if video_duration else "fixed_interval_fallback",
                    "sample_count": len(frames),
                    "sample_limit": 12,
                    "source_duration_seconds": video_duration,
                    "sample_limit_reached": len(frames) >= 12,
                    "exhaustive": False,
                    "coverage_note": (
                        "Frames are sampled points, not a complete review of every frame."
                    ),
                }
                if media_type == "video"
                else None
            ),
            "capabilities": {
                "speech_to_text": transcript["available"],
                "video_frame_extraction": bool(frames) if media_type == "video" else None,
                "ocr": (
                    bool(frames) and all(frame.get("ocr_available") for frame in frames)
                    if media_type == "video"
                    else None
                ),
                "ocr_text_detected": bool(ocr_text) if media_type == "video" else None,
            },
            "missing_capabilities": missing,
            "extracted_text": extracted_text,
        }

    @staticmethod
    def _transcribe(file_path: Path) -> Dict[str, Any]:
        try:
            model = MediaAnalyzer._load_whisper_model()
            segments, _ = model.transcribe(str(file_path))
            segment_data = []
            for segment in segments:
                text = segment.text.strip()
                if text:
                    segment_data.append({
                        "start_time": round(segment.start, 3),
                        "end_time": round(segment.end, 3),
                        "text": text,
                    })
            if segment_data:
                return {
                    "available": True,
                    "text": " ".join(segment["text"] for segment in segment_data),
                    "segments": segment_data,
                    "source": "faster-whisper",
                }
        except Exception:
            logger.exception(
                "Local speech transcription failed for %s; trying configured cloud fallback",
                file_path.name,
            )
        return MediaAnalyzer._transcribe_with_gemini(file_path)

    @staticmethod
    @lru_cache(maxsize=1)
    def _load_whisper_model():
        from faster_whisper import WhisperModel
        return WhisperModel("base", device="cpu", compute_type="int8")

    @staticmethod
    def _transcribe_with_gemini(file_path: Path) -> Dict[str, Any]:
        if (
            not settings.GEMINI_API_KEY
            or settings.GEMINI_API_KEY == "your_gemini_api_key_here"
            or settings.MODEL_PROVIDER in {"local", "private"}
        ):
            return {"available": False, "text": "", "segments": []}

        client = None
        uploaded_file = None
        try:
            from google import genai

            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            uploaded_file = client.files.upload(file=str(file_path))
            deadline = time.monotonic() + 120
            while getattr(getattr(uploaded_file, "state", None), "name", "") == "PROCESSING":
                if time.monotonic() >= deadline:
                    raise TimeoutError("Gemini media processing timed out")
                time.sleep(1)
                uploaded_file = client.files.get(name=uploaded_file.name)

            if getattr(getattr(uploaded_file, "state", None), "name", "") == "FAILED":
                raise RuntimeError("Gemini could not process the uploaded media")

            media_description = "video" if file_path.suffix.lower() in {
                ".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"
            } else "audio"
            response = client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=[
                    uploaded_file,
                    (
                        f"Transcribe the spoken words in this {media_description} verbatim. "
                        "Return only the transcript; do not summarize, correct, or add commentary."
                    ),
                ],
            )
            text = (getattr(response, "text", None) or "").strip()
            if not text:
                raise ValueError("Gemini returned an empty transcript")
            return {
                "available": True,
                "text": text,
                "segments": [],
                "source": "gemini",
            }
        except Exception:
            logger.exception("Gemini speech transcription failed for %s", file_path.name)
            return {"available": False, "text": "", "segments": []}
        finally:
            if client and uploaded_file and getattr(uploaded_file, "name", None):
                try:
                    client.files.delete(name=uploaded_file.name)
                except Exception:
                    logger.exception(
                        "Could not delete temporary Gemini media upload %s",
                        uploaded_file.name,
                    )

    @classmethod
    def _analyze_video_frames(
        cls,
        file_path: Path,
        artifact_dir: Path | None = None,
        duration_seconds: float | None = None,
    ) -> List[Dict[str, Any]]:
        ffmpeg = shutil.which("ffmpeg")
        if not ffmpeg:
            return []
        with tempfile.TemporaryDirectory(prefix="brand-frames-") as temp_dir:
            output_pattern = str(Path(temp_dir) / "frame-%03d.png")
            sampling_interval_seconds = (
                duration_seconds / 12 if duration_seconds and duration_seconds > 0 else 10
            )
            frame_rate = (
                f"12/{duration_seconds:.6f}"
                if duration_seconds and duration_seconds > 0
                else "1/10"
            )
            command = [
                ffmpeg, "-hide_banner", "-loglevel", "error", "-i", str(file_path),
                "-vf", f"fps={frame_rate}", "-frames:v", "12", output_pattern,
            ]
            try:
                subprocess.run(command, check=True, capture_output=True, timeout=120)
            except (subprocess.SubprocessError, OSError):
                return []

            frames = sorted(Path(temp_dir).glob("frame-*.png"))
            if not frames:
                sampling_interval_seconds = (
                    duration_seconds / 12 if duration_seconds and duration_seconds > 0 else 1
                )
                fallback_rate = (
                    f"12/{duration_seconds:.6f}"
                    if duration_seconds and duration_seconds > 0
                    else "1"
                )
                fallback_command = [
                    ffmpeg, "-hide_banner", "-loglevel", "error", "-i", str(file_path),
                    "-vf", f"fps={fallback_rate}", "-frames:v", "12", output_pattern,
                ]
                try:
                    subprocess.run(
                        fallback_command, check=True, capture_output=True, timeout=120
                    )
                except (subprocess.SubprocessError, OSError):
                    return []
                frames = sorted(Path(temp_dir).glob("frame-*.png"))

            results = []
            if artifact_dir:
                artifact_dir.mkdir(parents=True, exist_ok=True)
            for index, frame in enumerate(frames):
                ocr = cls._ocr_image(frame)
                frame_name = f"frame-{index + 1:03d}.png"
                frame_url = None
                if artifact_dir:
                    destination = artifact_dir / frame_name
                    shutil.copyfile(frame, destination)
                    frame_url = (
                        f"/static/{destination.relative_to(settings.STATIC_ROOT).as_posix()}"
                    )
                results.append({
                    "frame_number": index + 1,
                    "timestamp_seconds": index * sampling_interval_seconds,
                    "text": ocr["text"],
                    "ocr_available": ocr["available"],
                    "image_url": frame_url,
                })
            return results

    @staticmethod
    def _probe_video_duration(file_path: Path) -> float | None:
        ffprobe = shutil.which("ffprobe")
        if not ffprobe:
            return None
        try:
            completed = subprocess.run(
                [
                    ffprobe, "-v", "error", "-show_entries", "format=duration",
                    "-of", "json", str(file_path),
                ],
                capture_output=True,
                text=True,
                timeout=10,
                check=True,
            )
            duration = float(json.loads(completed.stdout)["format"]["duration"])
            if not math.isfinite(duration) or duration <= 0:
                logger.warning("Video duration probe returned an invalid duration for %s", file_path.name)
                return None
            return duration
        except (KeyError, TypeError, ValueError, json.JSONDecodeError, subprocess.SubprocessError, OSError):
            logger.warning("Video duration unavailable; using fixed-interval frame sampling for %s", file_path.name)
            return None

    @staticmethod
    def _ocr_image(file_path: Path) -> Dict[str, Any]:
        tesseract = shutil.which("tesseract")
        if not tesseract:
            return {"available": False, "text": ""}
        output_base = file_path.with_suffix("")
        try:
            completed = subprocess.run(
                [tesseract, str(file_path), str(output_base), "-l", "eng"],
                capture_output=True,
                text=True,
                timeout=30,
                check=True,
            )
            text_path = Path(f"{output_base}.txt")
            text = text_path.read_text(encoding="utf-8", errors="replace").strip()
            text_path.unlink(missing_ok=True)
            return {"available": True, "text": text}
        except (subprocess.SubprocessError, OSError):
            return {"available": False, "text": ""}
