import os
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import cv2
from dotenv import load_dotenv
from supabase import Client, create_client
from ultralytics import YOLO
from presage_client import analyze_with_presage

# =========================================================
# LOAD ENV
# =========================================================
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env.local")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

print("SUPABASE_URL loaded:", bool(SUPABASE_URL))
print("SUPABASE_SERVICE_ROLE_KEY loaded:", bool(SUPABASE_SERVICE_ROLE_KEY))

# =========================================================
# CONFIG
# =========================================================
MODEL_PATH = "models/joel.pt"
VIDEO_SOURCE: Union[int, str] = "Knives/Videos/knife-videos/29511112-preview.mp4"

TARGET_LABELS = {"knife", "gun"}

# More permissive TESTING thresholds for now
MODEL_CONF_THRESHOLD = 0.12
ENTER_ALERT_THRESHOLD = 0.15
FINAL_ALERT_AVG_THRESHOLD = 0.15
FINAL_ALERT_PEAK_THRESHOLD = 0.22
MIN_CONFIRMATION_FRAMES = 2
GRACE_SECONDS = 1.5

# Video / display
NORMAL_MODE_FPS = 5
ALERT_MODE_FPS = 20
INFERENCE_WIDTH = 1280
INFERENCE_HEIGHT = 720
SHOW_LIVE_WINDOW = True
WINDOW_NAME = "CampusShield Monitor"
TRACKER_CONFIG = "bytetrack.yaml"

# Clip saving
MAX_CLIP_FRAMES = 300
CLIP_FPS = 10

# Storage / output
OUTPUT_DIR = Path("event_outputs")
FRAMES_DIR = OUTPUT_DIR / "frames"
CLIPS_DIR = OUTPUT_DIR / "clips"
EVIDENCE_BUCKET = "evidence"

# Optional metadata
DEFAULT_CAMERA_NAME = "Student Center Cam 6"

# =========================================================
# DATA STRUCTURES
# =========================================================
@dataclass
class TrackedEvent:
    event_id: int
    track_id: int
    object_label: str

    state: str = "alert_check"

    start_time_unix: float = 0.0
    last_seen_time_unix: float = 0.0
    end_time_unix: Optional[float] = None

    relevant_confidences: List[float] = field(default_factory=list)
    peak_confidence: float = 0.0

    best_box: Optional[List[int]] = None
    best_frame_bgr: Optional[Any] = None
    best_frame_path: Optional[str] = None

    clip_frames: List[Any] = field(default_factory=list)
    clip_path: Optional[str] = None

    presage_pulse_bpm: Optional[float] = None
    presage_breathing_rate_bpm: Optional[float] = None
    presage_confidence: Optional[float] = None
    presage_status: Optional[str] = None
    presage_sample_seconds: Optional[float] = None
    presage_notes: Optional[str] = None

    alert_sent: bool = False

    def avg_confidence(self) -> float:
        if not self.relevant_confidences:
            return 0.0
        return sum(self.relevant_confidences) / len(self.relevant_confidences)

    def relevant_frame_count(self) -> int:
        return len(self.relevant_confidences)


# =========================================================
# SETUP
# =========================================================
def ensure_dirs() -> None:
    FRAMES_DIR.mkdir(parents=True, exist_ok=True)
    CLIPS_DIR.mkdir(parents=True, exist_ok=True)


def get_supabase_client() -> Optional[Client]:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("[WARNING] Supabase env vars not set. Upload/upsert will be skipped.")
        return None
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


# =========================================================
# HELPERS
# =========================================================
def unix_to_iso(ts: Optional[float]) -> Optional[str]:
    if ts is None:
        return None
    return datetime.fromtimestamp(ts).isoformat(timespec="seconds")

def is_box_near_border(box, frame_shape, margin=45):
    x1, y1, x2, y2 = box
    h, w = frame_shape[:2]
    return x1 <= margin or y1 <= margin or x2 >= w - margin or y2 >= h - margin

def is_bad_box_shape(box, min_area=1800, max_aspect_ratio=3.2):
    x1, y1, x2, y2 = box
    w = max(1, x2 - x1)
    h = max(1, y2 - y1)
    area = w * h
    aspect_ratio = max(w / h, h / w)
    return area < min_area or aspect_ratio > max_aspect_ratio

def box_center(box):
    x1, y1, x2, y2 = box
    return ((x1 + x2) / 2, (y1 + y2) / 2)

def center_distance(box1, box2):
    c1x, c1y = box_center(box1)
    c2x, c2y = box_center(box2)
    return ((c1x - c2x) ** 2 + (c1y - c2y) ** 2) ** 0.5

def filename_time(ts: Optional[float] = None) -> str:
    ts = time.time() if ts is None else ts
    return datetime.fromtimestamp(ts).strftime("%Y-%m-%d_%H-%M-%S")


def should_process(now_unix: float, last_process_unix: float, target_fps: int) -> bool:
    if target_fps <= 0:
        return True
    return (now_unix - last_process_unix) >= (1.0 / target_fps)


def resize_for_inference(frame_bgr: Any) -> Any:
    return cv2.resize(frame_bgr, (INFERENCE_WIDTH, INFERENCE_HEIGHT), interpolation=cv2.INTER_LINEAR)


def get_names_map(model: YOLO) -> Dict[int, str]:
    names = model.names
    if isinstance(names, dict):
        return {int(k): str(v) for k, v in names.items()}
    return {i: str(name) for i, name in enumerate(names)}


def get_target_class_ids(model: YOLO, target_labels: set[str]) -> Tuple[List[int], Dict[int, str]]:
    names_map = get_names_map(model)
    target_lower = {label.lower() for label in target_labels}

    class_ids = [idx for idx, name in names_map.items() if name.lower() in target_lower]
    supported_labels = [name for _, name in names_map.items() if name.lower() in target_lower]

    print("\n[INFO] Model classes:")
    print(names_map)
    print()
    print(f"[INFO] Requested target labels: {sorted(target_labels)}")
    print(f"[INFO] Supported target labels in this model: {sorted(supported_labels)}")
    print()

    if not class_ids:
        print("[WARNING] None of the requested labels exist in this model.\n")

    return class_ids, names_map


def parse_detections(result: Any, names_map: Dict[int, str]) -> List[Dict[str, Any]]:
    detections: List[Dict[str, Any]] = []

    if result.boxes is None or len(result.boxes) == 0:
        return detections

    boxes = result.boxes
    ids_tensor = boxes.id

    if ids_tensor is None:
        track_ids = [None] * len(boxes)
    else:
        track_ids = [int(v) for v in ids_tensor.int().cpu().tolist()]

    xyxy_list = boxes.xyxy.int().cpu().tolist()
    cls_list = boxes.cls.int().cpu().tolist()
    conf_list = boxes.conf.float().cpu().tolist()

    for i in range(len(xyxy_list)):
        cls_id = int(cls_list[i])
        label = names_map.get(cls_id, str(cls_id))
        detections.append(
            {
                "track_id": track_ids[i],
                "label": label,
                "conf": float(conf_list[i]),
                "box": [int(v) for v in xyxy_list[i]],
            }
        )

    return detections


def put_text(frame: Any, text: str, x: int, y: int, color: Tuple[int, int, int], scale: float = 0.6) -> None:
    cv2.putText(
        frame,
        text,
        (x, y),
        cv2.FONT_HERSHEY_SIMPLEX,
        scale,
        color,
        2,
        cv2.LINE_AA,
    )


def draw_box(frame: Any, box: List[int], label: str, conf: float, track_id: int, color: Tuple[int, int, int]) -> None:
    x1, y1, x2, y2 = box
    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
    put_text(frame, f"{label} {conf:.2f} | track {track_id}", x1, max(20, y1 - 10), color, 0.55)


def draw_status_panel(frame: Any, mode: str, target_fps: int, events_by_track_id: Dict[int, TrackedEvent], processed_frames: int) -> None:
    y = 28
    mode_color = (0, 255, 255) if mode == "normal" else (0, 255, 0)

    put_text(frame, f"Mode: {mode}", 15, y, mode_color)
    y += 28
    put_text(frame, f"Target FPS: {target_fps}", 15, y, (255, 255, 0))
    y += 28
    put_text(frame, f"Processed frames: {processed_frames}", 15, y, (255, 255, 0))
    y += 28

    active_events = [e for e in events_by_track_id.values() if e.state in {"alert_check", "alerted"}]
    put_text(frame, f"Active events: {len(active_events)}", 15, y, (255, 255, 255))
    y += 30

    for event in sorted(active_events, key=lambda e: e.last_seen_time_unix, reverse=True)[:4]:
        line = (
            f"Event {event.event_id} | {event.object_label} | track {event.track_id} | "
            f"frames {event.relevant_frame_count()} | avg {event.avg_confidence():.2f} | "
            f"peak {event.peak_confidence:.2f} | {event.state}"
        )
        color = (0, 165, 255) if event.state == "alert_check" else (0, 0, 255)
        put_text(frame, line, 15, y, color, 0.50)
        y += 24

    h = frame.shape[0]
    put_text(frame, "q = quit", 15, h - 15, (200, 200, 200), 0.50)


def open_video_with_fallback(video_source: Union[int, str]) -> cv2.VideoCapture:
    if isinstance(video_source, int):
        return cv2.VideoCapture(video_source)

    source_path = Path(video_source)

    print(f"[INFO] Trying to open: {source_path}")
    print(f"[INFO] Absolute path: {source_path.resolve()}")
    print(f"[INFO] Exists: {source_path.exists()}")
    if source_path.exists():
        print(f"[INFO] Size bytes: {source_path.stat().st_size}")

    cap = cv2.VideoCapture(str(source_path))
    if cap.isOpened():
        print("[INFO] Opened video with default backend")
        return cap

    if hasattr(cv2, "CAP_FFMPEG"):
        cap = cv2.VideoCapture(str(source_path), cv2.CAP_FFMPEG)
        if cap.isOpened():
            print("[INFO] Opened video with CAP_FFMPEG")
            return cap

    print("[ERROR] Failed to open video")
    return cap


# =========================================================
# EVENT ASSET LOGIC
# =========================================================
def append_clip_frame(event: TrackedEvent, frame_bgr: Any) -> None:
    if len(event.clip_frames) < MAX_CLIP_FRAMES:
        event.clip_frames.append(frame_bgr.copy())


def save_best_frame(event: TrackedEvent, frame_bgr: Any, timestamp_unix: float) -> str:
    frame_name = f"event_{event.event_id}_best_{filename_time(timestamp_unix)}.jpg"
    frame_path = FRAMES_DIR / frame_name
    cv2.imwrite(str(frame_path), frame_bgr)
    event.best_frame_path = str(frame_path)
    return str(frame_path)


def save_event_clip(event: TrackedEvent, fps: int = CLIP_FPS) -> Optional[str]:
    if not event.clip_frames:
        return None

    h, w = event.clip_frames[0].shape[:2]
    clip_name = f"event_{event.event_id}_clip.mp4"
    clip_path = CLIPS_DIR / clip_name

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(clip_path), fourcc, fps, (w, h))

    for frame in event.clip_frames:
        writer.write(frame)

    writer.release()
    event.clip_path = str(clip_path)
    return str(clip_path)


def finalize_event_assets(event: TrackedEvent) -> None:
    if event.best_frame_bgr is not None and event.best_frame_path is None:
        save_best_frame(event, event.best_frame_bgr, event.last_seen_time_unix)

    if event.clip_path is None:
        save_event_clip(event, fps=CLIP_FPS)

    event.end_time_unix = event.last_seen_time_unix


def upload_file_to_supabase(supabase: Client, local_path: str, remote_path: str, content_type: str) -> Optional[str]:
    try:
        with open(local_path, "rb") as f:
            supabase.storage.from_(EVIDENCE_BUCKET).upload(
                path=remote_path,
                file=f,
                file_options={"content-type": content_type, "upsert": "true"},
            )

        public_url = supabase.storage.from_(EVIDENCE_BUCKET).get_public_url(remote_path)
        return public_url
    except Exception as e:
        print(f"[ERROR] Failed to upload {local_path}: {e}")
        return None


def upsert_alert_row(supabase: Optional[Client], event: TrackedEvent, camera_name: str = DEFAULT_CAMERA_NAME) -> None:
    if supabase is None:
        print("[INFO] Skipping Supabase upsert because client is not configured.")
        return

    best_frame_url = None
    clip_url = None

    if event.best_frame_path:
        best_frame_remote = f"event_{event.event_id}/best_frame.jpg"
        best_frame_url = upload_file_to_supabase(
            supabase,
            event.best_frame_path,
            best_frame_remote,
            "image/jpeg",
        )

    if event.clip_path:
        clip_remote = f"event_{event.event_id}/clip.mp4"
        clip_url = upload_file_to_supabase(
            supabase,
            event.clip_path,
            clip_remote,
            "video/mp4",
        )

    duration_seconds = 0
    if event.start_time_unix and event.end_time_unix:
        duration_seconds = max(0, int(event.end_time_unix - event.start_time_unix))

    print("[DEBUG] best_frame_path:", event.best_frame_path)
    print("[DEBUG] clip_path:", event.clip_path)
    print("[DEBUG] object_label:", event.object_label)
    print("[DEBUG] avg_confidence:", event.avg_confidence())
    print("[DEBUG] peak_confidence:", event.peak_confidence)

    payload = {
        "event_id": f"evt_{int(event.start_time_unix)}_{event.event_id}",
        "camera_id": camera_name,
        "status": "pending_review",
        "detected_object": event.object_label,
        "average_confidence": round(event.avg_confidence(), 2),
        "peak_confidence": round(event.peak_confidence, 2),
        "event_timestamp": unix_to_iso(event.start_time_unix),
        "best_frame_url": best_frame_url,
        "footage_clip_url": clip_url,
    }

    try:
        supabase.table("alerts").upsert(payload, on_conflict="event_id").execute()
        print(f"[SUPABASE] Upserted alert row for {payload['event_id']}")
    except Exception as e:
        print(f"[ERROR] Failed to upsert alert row: {e}")


def close_event_and_push_to_supabase(supabase: Optional[Client], event: TrackedEvent, camera_name: str = DEFAULT_CAMERA_NAME) -> None:
    finalize_event_assets(event)

    if event.clip_path:
        vitals = analyze_with_presage(event.clip_path)
    else:
        vitals = {
            "pulse_bpm": None,
            "breathing_rate_bpm": None,
            "confidence": None,
            "status": "no_clip",
            "sample_seconds": None,
            "notes": "No saved clip available for Presage analysis.",
        }

    print(f"[PRESAGE] Event {event.event_id} vitals: {vitals}")

    event.presage_pulse_bpm = vitals.get("pulse_bpm")
    event.presage_breathing_rate_bpm = vitals.get("breathing_rate_bpm")
    event.presage_confidence = vitals.get("confidence")
    event.presage_status = vitals.get("status")
    event.presage_sample_seconds = vitals.get("sample_seconds")
    event.presage_notes = vitals.get("notes")

    upsert_alert_row(supabase, event, camera_name=camera_name)


# =========================================================
# EVENT STATE LOGIC
# =========================================================
def get_or_create_event(events_by_track_id: Dict[int, TrackedEvent], next_event_id: int, track_id: int, label: str, now_unix: float):
    if track_id in events_by_track_id:
        return events_by_track_id[track_id], next_event_id, False

    event = TrackedEvent(
        event_id=next_event_id,
        track_id=track_id,
        object_label=label,
        start_time_unix=now_unix,
        last_seen_time_unix=now_unix,
    )
    events_by_track_id[track_id] = event
    return event, next_event_id + 1, True


def update_event_from_detection(event: TrackedEvent, conf: float, box: List[int], display_frame: Any, now_unix: float) -> None:
    event.last_seen_time_unix = now_unix
    event.relevant_confidences.append(conf)

    append_clip_frame(event, display_frame)

    if conf > event.peak_confidence:
        event.peak_confidence = conf
        event.best_box = box
        event.best_frame_bgr = display_frame.copy()


def should_fire_final_alert(event: TrackedEvent) -> bool:
    return (
            not event.alert_sent
            and event.relevant_frame_count() >= MIN_CONFIRMATION_FRAMES
            and event.avg_confidence() >= FINAL_ALERT_AVG_THRESHOLD
            and event.peak_confidence >= FINAL_ALERT_PEAK_THRESHOLD
    )


def finalize_alert(event: TrackedEvent) -> None:
    event.alert_sent = True
    event.state = "alerted"

    print(
        f"[ALERT] Event {event.event_id} | label={event.object_label} | "
        f"track={event.track_id} | frames={event.relevant_frame_count()} | "
        f"avg={event.avg_confidence():.3f} | peak={event.peak_confidence:.3f}"
    )


def expire_stale_events(supabase: Optional[Client], events_by_track_id: Dict[int, TrackedEvent], now_unix: float, camera_name: str = DEFAULT_CAMERA_NAME) -> None:
    for event in events_by_track_id.values():
        if event.state in {"closed"}:
            continue

        if (now_unix - event.last_seen_time_unix) <= GRACE_SECONDS:
            continue

        if event.state in {"alert_check", "alerted"}:
            print(
                f"[EVENT END] Event {event.event_id} ended | "
                f"label={event.object_label} | avg={event.avg_confidence():.3f} | peak={event.peak_confidence:.3f}"
            )
            close_event_and_push_to_supabase(supabase, event, camera_name=camera_name)
            event.state = "closed"


def active_mode_from_events(events_by_track_id: Dict[int, TrackedEvent]) -> str:
    for event in events_by_track_id.values():
        if event.state in {"alert_check", "alerted"}:
            return "alert_check"
    return "normal"


# =========================================================
# MAIN
# =========================================================
def main() -> None:
    ensure_dirs()
    supabase = get_supabase_client()

    print("[INFO] Starting CampusShield monitor")
    print(f"[INFO] MODEL_PATH = {MODEL_PATH}")
    print(f"[INFO] VIDEO_SOURCE = {VIDEO_SOURCE}")
    print()

    model = YOLO(MODEL_PATH)
    target_class_ids, names_map = get_target_class_ids(model, TARGET_LABELS)

    cap = open_video_with_fallback(VIDEO_SOURCE)
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video source: {VIDEO_SOURCE}")

    ok, test_frame = cap.read()
    if not ok:
        raise RuntimeError("Video opened, but first frame could not be read.")

    if isinstance(VIDEO_SOURCE, str):
        cap.release()
        cap = open_video_with_fallback(VIDEO_SOURCE)

    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    events_by_track_id: Dict[int, TrackedEvent] = {}
    next_event_id = 1
    last_display_frame: Optional[Any] = None
    last_process_unix = 0.0
    processed_frames = 0

    while True:
        ok, raw_frame = cap.read()
        if not ok:
            print("[INFO] Video source ended")
            break

        now_unix = time.time()
        mode = active_mode_from_events(events_by_track_id)
        target_fps = NORMAL_MODE_FPS if mode == "normal" else ALERT_MODE_FPS

        if should_process(now_unix, last_process_unix, target_fps):
            processed_frames += 1
            last_process_unix = now_unix

            display_frame = resize_for_inference(raw_frame)

            if target_class_ids:
                results = model.track(
                    source=display_frame,
                    conf=MODEL_CONF_THRESHOLD,
                    classes=target_class_ids,
                    persist=True,
                    tracker=TRACKER_CONFIG,
                    verbose=False,
                    imgsz=max(INFERENCE_WIDTH, INFERENCE_HEIGHT),
                )
            else:
                results = model.track(
                    source=display_frame,
                    conf=MODEL_CONF_THRESHOLD,
                    persist=True,
                    tracker=TRACKER_CONFIG,
                    verbose=False,
                    imgsz=max(INFERENCE_WIDTH, INFERENCE_HEIGHT),
                )

            result = results[0]
            detections = parse_detections(result, names_map)

            for det in detections:
                track_id = det["track_id"]
                label = det["label"]
                conf = det["conf"]
                box = det["box"]

                if label.lower() not in TARGET_LABELS:
                    continue

                effective_track_id = track_id if track_id is not None else -1

                if is_bad_box_shape(box):
                    continue

                color = (0, 255, 255) if conf < ENTER_ALERT_THRESHOLD else (0, 0, 255)

                if conf >= 0.18:
                    draw_box(display_frame, box, label, conf, effective_track_id, color)

                if conf >= ENTER_ALERT_THRESHOLD:
                    event, next_event_id, created = get_or_create_event(
                        events_by_track_id,
                        next_event_id,
                        effective_track_id,
                        label,
                        now_unix,
                    )

                    if created:
                        print(f"[EVENT START] Event {event.event_id} created for track {effective_track_id} ({label})")

                    update_event_from_detection(event, conf, box, display_frame.copy(), now_unix)

                    if should_fire_final_alert(event):
                        finalize_alert(event)

            expire_stale_events(supabase, events_by_track_id, now_unix, camera_name=DEFAULT_CAMERA_NAME)
            draw_status_panel(display_frame, mode, target_fps, events_by_track_id, processed_frames)
            last_display_frame = display_frame

        elif last_display_frame is None:
            last_display_frame = resize_for_inference(raw_frame)
            draw_status_panel(last_display_frame, mode, target_fps, events_by_track_id, processed_frames)

        if SHOW_LIVE_WINDOW and last_display_frame is not None:
            cv2.imshow(WINDOW_NAME, last_display_frame)

        key = cv2.waitKey(1) & 0xFF
        if key == ord("q"):
            break

    expire_stale_events(
        supabase,
        events_by_track_id,
        time.time() + GRACE_SECONDS + 0.01,
        camera_name=DEFAULT_CAMERA_NAME,
        )

    cap.release()
    cv2.destroyAllWindows()
    print("[INFO] CampusShield monitor stopped")


if __name__ == "__main__":
    main()