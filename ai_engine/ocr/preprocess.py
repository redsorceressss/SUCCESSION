"""Image preprocessing pipelines for scale display photography."""

import cv2
import numpy as np

def detect_glare(img_bgr: np.ndarray) -> float:
    """Returns fraction of image that is blown out with white reflection/glare (0.0 to 1.0)."""
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    glare_pixels = np.count_nonzero(gray > 248)
    return float(glare_pixels) / float(gray.size)

def deskew_image(img_bgr: np.ndarray, max_angle: float = 20.0) -> np.ndarray:
    """Detects dominant orientation of display edges and straightens if within max_angle."""
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150, apertureSize=3)
    lines = cv2.HoughLines(edges, 1, np.pi / 180, 100)
    if lines is None:
        return img_bgr

    angles = []
    for line in lines[:10]:
        rho, theta = line[0]
        deg = np.rad2deg(theta) - 90
        if -max_angle <= deg <= max_angle:
            angles.append(deg)

    if not angles:
        return img_bgr

    median_angle = float(np.median(angles))
    if abs(median_angle) < 1.0:
        return img_bgr

    h, w = img_bgr.shape[:2]
    center = (w // 2, h // 2)
    mat = cv2.getRotationMatrix2D(center, median_angle, 1.0)
    return cv2.warpAffine(img_bgr, mat, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)

def preprocess_scale_image(
    img_bgr: np.ndarray,
    target_width: int = 800,
    enhance_contrast: bool = True,
    auto_deskew: bool = True,
) -> np.ndarray:
    """Standardizes scale photograph geometry, resolution, orientation, and contrast."""
    h, w = img_bgr.shape[:2]
    if w > target_width:
        scale = target_width / float(w)
        img_bgr = cv2.resize(img_bgr, (target_width, int(h * scale)), interpolation=cv2.INTER_AREA)
    elif w < 300:
        scale = 300 / float(w)
        img_bgr = cv2.resize(img_bgr, (300, int(h * scale)), interpolation=cv2.INTER_CUBIC)

    if auto_deskew:
        img_bgr = deskew_image(img_bgr)

    if enhance_contrast:
        # Apply CLAHE to luminance channel in LAB color space
        lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
        l_enhanced = clahe.apply(l)
        lab = cv2.merge((l_enhanced, a, b))
        img_bgr = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

    return img_bgr

