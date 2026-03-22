import cv2
import os

VIDEO_PATH = "Knives/Videos/knife-videos/29511112-preview.mp4"
OUTPUT_DIR = "video_test_frames"
FRAME_SKIP = 15  # save every 15th frame

os.makedirs(OUTPUT_DIR, exist_ok=True)

cap = cv2.VideoCapture(VIDEO_PATH)
count = 0
saved = 0

while True:
    ret, frame = cap.read()
    if not ret:
        break

    if count % FRAME_SKIP == 0:
        out_path = os.path.join(OUTPUT_DIR, f"frame_{saved}.jpg")
        cv2.imwrite(out_path, frame)
        saved += 1

    count += 1

cap.release()
print(f"Saved {saved} frames to {OUTPUT_DIR}")