import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Dict, List

class MediaAnalyzer:
    """Extracts media evidence through installed local tools and configured providers."""

    @classmethod
    def analyze(cls, path: str, media_type: str) -> Dict[str, Any]:
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

        transcript = cls._transcribe(file_path)
        frames: List[Dict[str, Any]] = []
        if media_type == "video":
            frames = cls._analyze_video_frames(file_path)

        ocr_text = "\n".join(frame["text"] for frame in frames if frame.get("text")).strip()
        missing = []
        if not transcript["available"]:
            missing.append("speech_to_text")
        if media_type == "video" and not frames:
            missing.append("video_frame_extraction")
        if frames and not any(frame.get("text") for frame in frames):
            missing.append("ocr")

        extracted_text = "\n".join(
            part for part in [transcript["text"], ocr_text] if part
        ).strip()
        return {
            "extraction_status": "complete" if not missing else "needs_review",
            "transcript": transcript["text"],
            "transcript_segments": transcript.get("segments", []),
            "ocr_text": ocr_text,
            "findings": frames,
            "capabilities": {
                "speech_to_text": transcript["available"],
                "video_frame_extraction": bool(frames) if media_type == "video" else None,
                "ocr": bool(ocr_text) if media_type == "video" else None,
            },
            "missing_capabilities": missing,
            "extracted_text": extracted_text,
        }

    @staticmethod
    def _transcribe(file_path: Path) -> Dict[str, Any]:
        try:
            from faster_whisper import WhisperModel
        except ImportError:
            return {"available": False, "text": ""}

        try:
            model = WhisperModel("base", device="cpu", compute_type="int8")
            segments, _ = model.transcribe(str(file_path))
        except (OSError, RuntimeError, ValueError, TypeError, IndexError):
            return {"available": False, "text": ""}
        segment_data = []
        for segment in segments:
            text = segment.text.strip()
            if text:
                segment_data.append({
                    "start_time": round(segment.start, 3),
                    "end_time": round(segment.end, 3),
                    "text": text,
                })
        return {
            "available": bool(segment_data),
            "text": " ".join(segment["text"] for segment in segment_data),
            "segments": segment_data,
        }

    @classmethod
    def _analyze_video_frames(cls, file_path: Path) -> List[Dict[str, Any]]:
        ffmpeg = shutil.which("ffmpeg")
        if not ffmpeg:
            return []
        with tempfile.TemporaryDirectory(prefix="brand-frames-") as temp_dir:
            output_pattern = str(Path(temp_dir) / "frame-%03d.png")
            command = [
                ffmpeg, "-hide_banner", "-loglevel", "error", "-i", str(file_path),
                "-vf", "fps=1/10", "-frames:v", "12", output_pattern,
            ]
            try:
                subprocess.run(command, check=True, capture_output=True, timeout=120)
            except (subprocess.SubprocessError, OSError):
                return []

            frames = sorted(Path(temp_dir).glob("frame-*.png"))
            if not frames:
                fallback_command = [
                    ffmpeg, "-hide_banner", "-loglevel", "error", "-i", str(file_path),
                    "-vf", "fps=1", "-frames:v", "12", output_pattern,
                ]
                try:
                    subprocess.run(
                        fallback_command, check=True, capture_output=True, timeout=120
                    )
                except (subprocess.SubprocessError, OSError):
                    return []
                frames = sorted(Path(temp_dir).glob("frame-*.png"))

            results = []
            for index, frame in enumerate(frames):
                ocr = cls._ocr_image(frame)
                results.append({
                    "frame_number": index + 1,
                    "timestamp_seconds": index * 10,
                    "text": ocr["text"],
                    "ocr_available": ocr["available"],
                })
            return results

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
