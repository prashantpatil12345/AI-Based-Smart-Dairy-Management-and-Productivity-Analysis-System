"""
Roboflow Integration Service for SmartDairy Cattle Breed Model.
Handles secure API request dispatch and prediction response parsing.
"""

import os
import base64
import logging
from typing import Optional, Tuple, Dict, Any
import requests
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Environment variable defaults
DEFAULT_API_URL = "https://serverless.roboflow.com"
DEFAULT_MODEL_ID = "cattle-breed-wtkzl/2"


class RoboflowService:
    """Service for Roboflow serverless API inference."""

    def __init__(self):
        self.api_url = os.getenv("ROBOFLOW_API_URL", DEFAULT_API_URL).rstrip("/")
        self.model_id = os.getenv("ROBOFLOW_MODEL_ID", DEFAULT_MODEL_ID).strip("/")
        self.api_key = os.getenv("ROBOFLOW_API_KEY", "").strip()

    def predict_image(self, image_bytes: bytes) -> Dict[str, Any]:
        """
        Send image bytes to Roboflow model inference API.
        Returns extracted prediction with breed name and confidence score.
        """
        if not image_bytes:
            raise ValueError("Empty image data provided")

        if not self.api_key:
            raise ValueError("ROBOFLOW_API_KEY is not configured on the backend server")

        # Encode image as base64 ascii string
        base64_data = base64.b64encode(image_bytes).decode("utf-8")

        # Roboflow inference URL
        url = f"{self.api_url}/{self.model_id}"

        # Send request with api_key query param
        try:
            # Roboflow endpoint accepts raw base64 string as post body with application/x-www-form-urlencoded
            # or plain text
            response = requests.post(
                url,
                params={"api_key": self.api_key},
                data=base64_data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=15,
            )
        except requests.exceptions.RequestException as req_err:
            logger.error("Roboflow API connection error occurred")
            raise RuntimeError(f"Failed to connect to Roboflow inference service: {str(req_err)}")

        if not response.ok:
            logger.error(f"Roboflow API returned error status: {response.status_code}")
            raise RuntimeError(f"Roboflow API error (status code: {response.status_code})")

        try:
            data = response.json()
        except Exception as json_err:
            logger.error("Failed to parse JSON from Roboflow response")
            raise RuntimeError("Invalid response payload received from Roboflow API")

        # Extract prediction details safely
        breed, confidence = self._extract_prediction(data)
        
        return {
            "predicted_breed": breed,
            "confidence": confidence,
            "raw_predictions": data.get("predictions", []),
        }

    def _extract_prediction(self, data: Dict[str, Any]) -> Tuple[str, float]:
        """
        Extract the top class/breed name and confidence float from Roboflow response format.
        Supports both classification and object detection payloads.
        """
        # 1. Classification response format: {"predictions": [{"class": "Gir", "confidence": 0.92}], ...}
        # or {"top": "Gir", "confidence": 0.92}
        if "top" in data and "confidence" in data:
            breed = str(data["top"]).strip()
            conf = float(data["confidence"])
            return breed, conf

        predictions = data.get("predictions")

        # Case A: predictions is a list
        if isinstance(predictions, list) and len(predictions) > 0:
            # Sort by confidence if available
            top_pred = max(
                predictions,
                key=lambda p: p.get("confidence", p.get("score", 0)) if isinstance(p, dict) else 0
            )
            if isinstance(top_pred, dict):
                breed = top_pred.get("class") or top_pred.get("label") or top_pred.get("name") or "Unknown"
                conf = float(top_pred.get("confidence") or top_pred.get("score") or 0.0)
                return str(breed).strip(), conf

        # Case B: predictions is a dict mapping class -> confidence
        elif isinstance(predictions, dict) and len(predictions) > 0:
            top_class = max(predictions.items(), key=lambda item: float(item[1]))
            return str(top_class[0]).strip(), float(top_class[1])

        # Case C: top-level predictions list is missing or empty
        predicted_class = data.get("predicted_class") or data.get("class")
        if predicted_class:
            conf = float(data.get("confidence", 0.0))
            return str(predicted_class).strip(), conf

        raise ValueError("Model returned no predictions for the provided image")


# Singleton instance
roboflow_service = RoboflowService()
