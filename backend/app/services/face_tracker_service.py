import cv2
import numpy as np
import logging
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional
from app.config import settings

logger = logging.getLogger(__name__)

class FaceTrackerService:
    def __init__(self):
        # Locate YuNet model under storage/models/opencv
        models_dir = settings.MODELS_DIR / "opencv"
        self.yunet_model_path = models_dir / "face_detection_yunet_2023mar.onnx"
        self.haar_model_path = models_dir / "haarcascade_frontalface_default.xml"
        self.detector = None
        self.haar_cascade = None
        self._init_detector()

    def _init_detector(self):
        """Initialize YuNet DNN detector with Haar cascade fallback."""
        if self.yunet_model_path.exists():
            try:
                # Initialize with placeholder input size (will update per frame resolution)
                self.detector = cv2.FaceDetectorYN.create(
                    str(self.yunet_model_path),
                    "",
                    (320, 320),
                    score_threshold=0.6,
                    nms_threshold=0.3,
                    top_k=5000
                )
                logger.info("YuNet face detector initialized successfully.")
                return
            except Exception as e:
                logger.warning(f"Failed to initialize YuNet detector: {e}")

        # Fallback to Haar cascade if available
        if self.haar_model_path.exists():
            try:
                self.haar_cascade = cv2.CascadeClassifier(str(self.haar_model_path))
                logger.info("Haar cascade face detector initialized successfully.")
            except Exception as e:
                logger.warning(f"Failed to initialize Haar cascade: {e}")

    def detect_faces_in_frame(self, frame: np.ndarray) -> List[Tuple[int, int, int, int]]:
        """
        Detect face bounding boxes in a single BGR frame.
        Returns list of (x, y, w, h).
        """
        h, w = frame.shape[:2]
        faces = []

        if self.detector is not None:
            try:
                self.detector.setInputSize((w, h))
                _, detected = self.detector.detect(frame)
                if detected is not None:
                    for det in detected:
                        # YuNet output: [x, y, w, h, x_re, y_re, x_le, y_le, x_nt, y_nt, x_rcm, y_rcm, x_lcm, y_lcm, score]
                        box = [int(v) for v in det[:4]]
                        faces.append((box[0], box[1], box[2], box[3]))
                    return faces
            except Exception as e:
                logger.debug(f"YuNet detection failed: {e}")

        if self.haar_cascade is not None:
            try:
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                detected = self.haar_cascade.detectMultiScale(
                    gray, scaleFactor=1.2, minNeighbors=5, minSize=(30, 30)
                )
                for (x, y, fw, fh) in detected:
                    faces.append((x, y, fw, fh))
                return faces
            except Exception as e:
                logger.debug(f"Haar detection failed: {e}")

        return faces

    def analyze_crop_trajectory(
        self,
        video_path: Path,
        start_time: float,
        end_time: float,
        target_aspect_ratio: str = "9:16",
        framing_mode: str = "auto_face",
        manual_position: float = 0.5,
        sample_fps: float = 6.0,
        smoothing_alpha: float = 0.12
    ) -> Dict[str, Any]:
        """
        Sample frames across clip range and compute a smooth camera panning trajectory.
        Outputs static or smoothed crop window (w, h, x, y) suitable for vertical 9:16 reframing.
        """
        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            logger.warning(f"Could not open video {video_path} for face analysis. Falling back to center crop.")
            return self._default_center_crop(1920, 1080, target_aspect_ratio)

        src_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 1920
        src_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 1080
        fps = float(cap.get(cv2.CAP_PROP_FPS)) or 30.0

        # Calculate crop width and height for target aspect ratio
        if target_aspect_ratio == "9:16":
            # For landscape source (e.g. 1920x1080), height is full src_h, width is src_h * 9 / 16
            crop_h = src_h
            crop_w = int(crop_h * 9 / 16)
            if crop_w > src_w:
                crop_w = src_w
                crop_h = int(crop_w * 16 / 9)
        elif target_aspect_ratio == "1:1":
            crop_size = min(src_w, src_h)
            crop_w = crop_size
            crop_h = crop_size
        else:  # "16:9" or original
            cap.release()
            return {"crop_w": src_w, "crop_h": src_h, "crop_x": 0, "crop_y": 0, "mode": "original"}

        # If manual positioning is requested
        if framing_mode == "manual":
            cap.release()
            max_x = max(0, src_w - crop_w)
            crop_x = int(max_x * max(0.0, min(1.0, manual_position)))
            crop_y = max(0, (src_h - crop_h) // 2)
            return {
                "crop_w": crop_w,
                "crop_h": crop_h,
                "crop_x": crop_x,
                "crop_y": crop_y,
                "mode": "manual",
                "filter_str": f"crop={crop_w}:{crop_h}:{crop_x}:{crop_y}"
            }

        # If center crop is requested or source is already portrait
        if framing_mode == "center" or crop_w >= src_w:
            cap.release()
            crop_x = max(0, (src_w - crop_w) // 2)
            crop_y = max(0, (src_h - crop_h) // 2)
            return {
                "crop_w": crop_w,
                "crop_h": crop_h,
                "crop_x": crop_x,
                "crop_y": crop_y,
                "mode": "center",
                "filter_str": f"crop={crop_w}:{crop_h}:{crop_x}:{crop_y}"
            }

        # Auto Face Tracking: Sample frames across the clip
        clip_duration = max(0.5, end_time - start_time)
        frame_interval = max(1, int(fps / sample_fps))
        start_frame = int(start_time * fps)
        end_frame = int(end_time * fps)

        cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
        cur_frame_idx = start_frame

        detected_centers_x = []
        default_center_x = src_w // 2

        while cur_frame_idx <= end_frame:
            ret, frame = cap.read()
            if not ret:
                break

            if (cur_frame_idx - start_frame) % frame_interval == 0:
                faces = self.detect_faces_in_frame(frame)
                if faces:
                    # Select the most prominent face (largest area and closest to center)
                    best_face = None
                    best_score = -1.0
                    for (x, y, w, h) in faces:
                        area = w * h
                        center_dist = abs((x + w / 2) - default_center_x)
                        score = area / (1.0 + center_dist * 0.5)
                        if score > best_score:
                            best_score = score
                            best_face = (x, y, w, h)

                    if best_face:
                        fx, fy, fw, fh = best_face
                        face_cx = fx + (fw / 2.0)
                        detected_centers_x.append(face_cx)
                else:
                    detected_centers_x.append(None)

            cur_frame_idx += 1

        cap.release()

        # If no faces were detected in any sampled frame, use center crop
        valid_centers = [cx for cx in detected_centers_x if cx is not None]
        if not valid_centers:
            logger.info("No faces detected in clip duration; using center crop.")
            crop_x = max(0, (src_w - crop_w) // 2)
            crop_y = max(0, (src_h - crop_h) // 2)
            return {
                "crop_w": crop_w,
                "crop_h": crop_h,
                "crop_x": crop_x,
                "crop_y": crop_y,
                "mode": "center_fallback",
                "filter_str": f"crop={crop_w}:{crop_h}:{crop_x}:{crop_y}"
            }

        # Apply Exponential Moving Average (EMA) smoothing over detected positions
        smoothed_positions = []
        last_smooth_x = valid_centers[0]

        for cx in detected_centers_x:
            target_x = cx if cx is not None else last_smooth_x
            last_smooth_x = smoothing_alpha * target_x + (1.0 - smoothing_alpha) * last_smooth_x
            # Clamp crop window within source frame bounds [0, src_w - crop_w]
            desired_left = int(last_smooth_x - (crop_w / 2.0))
            clamped_left = max(0, min(src_w - crop_w, desired_left))
            smoothed_positions.append(clamped_left)

        # Compute stable representative anchor point (median of smoothed camera movement)
        # Prevents micro-jitter and gives a steady, professional broadcast crop
        median_crop_x = int(np.median(smoothed_positions))
        crop_y = max(0, (src_h - crop_h) // 2)

        filter_str = f"crop={crop_w}:{crop_h}:{median_crop_x}:{crop_y}"

        return {
            "crop_w": crop_w,
            "crop_h": crop_h,
            "crop_x": median_crop_x,
            "crop_y": crop_y,
            "faces_detected_count": len(valid_centers),
            "mode": "smart_face_tracking",
            "filter_str": filter_str
        }

    def _default_center_crop(self, src_w: int, src_h: int, target_aspect_ratio: str) -> Dict[str, Any]:
        if target_aspect_ratio == "9:16":
            crop_h = src_h
            crop_w = int(crop_h * 9 / 16)
        elif target_aspect_ratio == "1:1":
            crop_w = min(src_w, src_h)
            crop_h = crop_w
        else:
            crop_w, crop_h = src_w, src_h

        crop_x = max(0, (src_w - crop_w) // 2)
        crop_y = max(0, (src_h - crop_h) // 2)
        return {
            "crop_w": crop_w,
            "crop_h": crop_h,
            "crop_x": crop_x,
            "crop_y": crop_y,
            "mode": "center",
            "filter_str": f"crop={crop_w}:{crop_h}:{crop_x}:{crop_y}"
        }

face_tracker = FaceTrackerService()
