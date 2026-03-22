
import os
from ultralytics import YOLO

# =========================================================
# CONFIG
# =========================================================
MODEL_PATH = "models/joel.pt"
IMAGE_FOLDER = "video_test_frames"
CONF_THRESHOLD = 0.40

# Keep knife only for pretrained yolov8s.pt
TARGET_LABELS = {"knife"}


# =========================================================
# HELPERS
# =========================================================
def get_names_map(model):
    names = model.names
    if isinstance(names, dict):
        return {int(k): str(v) for k, v in names.items()}
    return {i: str(name) for i, name in enumerate(names)}


def get_available_target_ids(model, target_labels):
    names_map = get_names_map(model)
    target_lower = {label.lower() for label in target_labels}

    class_ids = [
        idx for idx, name in names_map.items()
        if name.lower() in target_lower
    ]

    available_labels = [
        name for _, name in names_map.items()
        if name.lower() in target_lower
    ]

    print("\n[INFO] Model classes:")
    print(names_map)
    print()
    print(f"[INFO] Requested target labels: {sorted(target_labels)}")
    print(f"[INFO] Supported target labels in this model: {sorted(available_labels)}")
    print()

    if not class_ids:
        print("[WARNING] None of the requested labels exist in this model.")
        print("[WARNING] Detection results will always be empty for these targets.\n")

    return class_ids, names_map


def is_image_file(filename):
    filename = filename.lower()
    return filename.endswith((".jpg", ".jpeg", ".png", ".webp", ".avif"))


# =========================================================
# MAIN
# =========================================================
def main():
    model = YOLO(MODEL_PATH)
    target_class_ids, names_map = get_available_target_ids(model, TARGET_LABELS)

    if not os.path.isdir(IMAGE_FOLDER):
        print(f"[ERROR] Image folder not found: {IMAGE_FOLDER}")
        return

    image_files = [
        f for f in os.listdir(IMAGE_FOLDER)
        if is_image_file(f)
    ]

    if not image_files:
        print("[ERROR] No image files found in folder.")
        return

    total_images = 0
    detected_images = 0

    for filename in sorted(image_files):
        image_path = os.path.join(IMAGE_FOLDER, filename)
        total_images += 1

        if target_class_ids:
            results = model.predict(
                source=image_path,
                conf=CONF_THRESHOLD,
                classes=target_class_ids,
                verbose=False
            )
        else:
            results = model.predict(
                source=image_path,
                conf=CONF_THRESHOLD,
                verbose=False
            )

        result = results[0]
        found_target = False

        if result.boxes is not None and len(result.boxes) > 0:
            cls_ids = result.boxes.cls.int().cpu().tolist()
            confs = result.boxes.conf.float().cpu().tolist()

            print(f"\n{filename}")

            for cls_id, conf in zip(cls_ids, confs):
                label = names_map.get(int(cls_id), str(cls_id))
                print(f"  detected: {label} | conf={conf:.3f}")

                if label.lower() in TARGET_LABELS:
                    found_target = True

        if found_target:
            detected_images += 1
            print(f"  --> TARGET DETECTED in {filename}")
        else:
            print(f"\n{filename}")
            print("  --> no target detected")
        result.save(filename=f"runs/debug/{filename}")
    print("\n=========================================================")
    print("SUMMARY")
    print("=========================================================")
    print(f"Total images tested: {total_images}")
    print(f"Images with target detected: {detected_images}")
    print(f"Detection rate: {detected_images / total_images:.2%}")

if __name__ == "__main__":
    main()
