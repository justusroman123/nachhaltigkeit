"""Liest einen QR-Code aus einem PNG (Hilfe fuer browser_smoke.js). Braucht opencv-python-headless."""
import sys

import cv2

img = cv2.imread(sys.argv[1], cv2.IMREAD_GRAYSCALE)
img = cv2.copyMakeBorder(img, 40, 40, 40, 40, cv2.BORDER_CONSTANT, value=255)   # Ruhezone
text, _, _ = cv2.QRCodeDetector().detectAndDecode(img)
print(text)
