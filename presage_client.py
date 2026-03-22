import os
from dotenv import load_dotenv

load_dotenv()

PRESAGE_API_KEY = os.getenv("PRESAGE_API_KEY")
PRESAGE_MODE = os.getenv("PRESAGE_MODE", "sdk")


def analyze_with_presage(video_path: str) -> dict:
    """
    Temporary Presage wrapper for CampusShield.

    Right now this returns mock data so you can:
    - test your Python pipeline
    - verify Supabase columns update correctly
    - show vitals on the frontend

    Later, replace the mock section with the real Presage SDK/API call.
    """

    if not video_path:
        return {
            "pulse_bpm": None,
            "breathing_rate_bpm": None,
            "confidence": None,
            "status": "no_video",
            "sample_seconds": None,
            "notes": "No video path provided for Presage analysis."
        }

    if not os.path.exists(video_path):
        return {
            "pulse_bpm": None,
            "breathing_rate_bpm": None,
            "confidence": None,
            "status": "missing_file",
            "sample_seconds": None,
            "notes": f"Video file not found: {video_path}"
        }

    if not PRESAGE_API_KEY:
        return {
            "pulse_bpm": None,
            "breathing_rate_bpm": None,
            "confidence": None,
            "status": "missing_api_key",
            "sample_seconds": None,
            "notes": "PRESAGE_API_KEY is not set in root .env.local"
        }

    try:
        if PRESAGE_MODE == "sdk":
            return _mock_presage_result(video_path)

        return {
            "pulse_bpm": None,
            "breathing_rate_bpm": None,
            "confidence": None,
            "status": "unsupported_mode",
            "sample_seconds": None,
            "notes": f"Unsupported PRESAGE_MODE: {PRESAGE_MODE}"
        }

    except Exception as e:
        return {
            "pulse_bpm": None,
            "breathing_rate_bpm": None,
            "confidence": None,
            "status": "error",
            "sample_seconds": None,
            "notes": f"Presage analysis failed: {str(e)}"
        }


def _mock_presage_result(video_path: str) -> dict:
    """
    Mock result for testing the CampusShield flow end-to-end.
    Replace this later with the real Presage implementation.
    """
    file_size_mb = round(os.path.getsize(video_path) / (1024 * 1024), 2)

    return {
        "pulse_bpm": 102,
        "breathing_rate_bpm": 20,
        "confidence": 0.85,
        "status": "mock_success",
        "sample_seconds": 15.0,
        "notes": f"Mock Presage result generated for {os.path.basename(video_path)} ({file_size_mb} MB)."
    }