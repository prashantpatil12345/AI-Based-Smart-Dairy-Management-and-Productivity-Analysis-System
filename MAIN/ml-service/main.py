"""
Cattle Breed Classifier & Roboflow Prediction Microservice for SmartDairy.
"""
import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, File, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl

from inference import inference_service
from breed_info import breed_info_service
from image_loader import load_image_from_url
from roboflow_service import roboflow_service

# Configure standard logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# --- Schemas ---

class PredictURLRequest(BaseModel):
    url: HttpUrl
    top_k: int = 3

class PredictionResult(BaseModel):
    breed: str
    confidence: float

class BreedInfoResponse(BaseModel):
    breed_name: str
    animal_type: str
    region: str
    avg_milk_liters_per_day: str
    lifespan_years: str
    primary_use: str
    description: str

class PredictResponse(BaseModel):
    predicted_breed: str
    confidence: float
    top_k: list[PredictionResult]
    breed_info: Optional[BreedInfoResponse] = None
    model_version: str
    inference_time_ms: float
    warning: Optional[str] = None

class RoboflowPredictResponse(BaseModel):
    success: bool = True
    breed: str
    confidence: float
    breed_info: Optional[BreedInfoResponse] = None
    warning: Optional[str] = None

# --- Application Setup ---

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("Starting Cattle Breed Classifier Service...")
    inference_service.load()
    breed_info_service.load()
    logger.info("Services loaded successfully")
    yield
    logger.info("Shutting down...")

app = FastAPI(
    title="SmartDairy Cattle Breed Classifier Service",
    description="Inference microservice with Roboflow integration.",
    lifespan=lifespan,
)

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Routes ---

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "model_loaded": inference_service.is_loaded,
        "roboflow_configured": bool(roboflow_service.api_key),
    }

@app.post("/api/breed-predict", response_model=RoboflowPredictResponse)
@app.post("/breed-predict", response_model=RoboflowPredictResponse)
async def breed_predict(file: UploadFile = File(...)):
    """
    POST /api/breed-predict
    Accepts uploaded cattle/buffalo image and predicts breed via Roboflow model (cattle-breed-wtkzl/2).
    Returns breed name, confidence percentage, and matched breed metadata.
    """
    if not file or not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No image file provided. Please upload a cattle or buffalo image."
        )

    # Validate content type if available
    content_type = file.content_type or ""
    valid_extensions = (".jpg", ".jpeg", ".png", ".webp", ".bmp", ".jfif")
    is_valid_type = content_type.startswith("image/") or file.filename.lower().endswith(valid_extensions)

    if not is_valid_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image format. Supported formats: JPEG, PNG, WEBP."
        )

    try:
        image_bytes = await file.read()
    except Exception as e:
        logger.error(f"Failed to read uploaded file: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to read the uploaded image file."
        )

    if not image_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded image file is empty."
        )

    # Max file size limit: 10MB
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image size exceeds maximum limit of 10MB."
        )

    try:
        # Call Roboflow Service
        res = roboflow_service.predict_image(image_bytes)
        predicted_breed = res["predicted_breed"]
        raw_confidence = res["confidence"]

        # Server-side logging of raw Roboflow response values (no API keys logged)
        logger.info(f"[Roboflow Model Inference] predicted_breed='{predicted_breed}', raw_confidence={raw_confidence}")

        # Standardize confidence score to percentage float (0.0 - 100.0) with 1 decimal place precision
        # e.g., 0.9234 -> 92.3%, 0.742 -> 74.2%, 0.008 -> 0.8%
        confidence_pct = raw_confidence * 100.0 if raw_confidence <= 1.0 else raw_confidence
        confidence_pct = round(confidence_pct, 1)

        # Match prediction against existing breed metadata
        breed_info = breed_info_service.get_breed_summary(predicted_breed)

        warning = None
        if confidence_pct < 40.0:
            warning = f"Prediction confidence is low ({confidence_pct}%). Try uploading a clearer side-view photo."
        elif not breed_info:
            warning = f"Prediction complete, but detailed metadata for breed '{predicted_breed}' is not in catalog."

        return RoboflowPredictResponse(
            success=True,
            breed=predicted_breed,
            confidence=confidence_pct,
            breed_info=breed_info,
            warning=warning
        )


    except ValueError as ve:
        logger.warning(f"Roboflow prediction validation notice: {ve}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except RuntimeError as re:
        logger.error(f"Roboflow prediction runtime error: {re}")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(re))
    except Exception as e:
        logger.error(f"Unexpected error during breed prediction: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal server error occurred while processing the prediction."
        )

@app.post("/predict/url", response_model=PredictResponse)
async def predict_url(request: PredictURLRequest):
    """Predict breed from an image URL using PyTorch model."""
    if not inference_service.is_loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Model not loaded. Service is unavailable."
        )

    try:
        image = load_image_from_url(str(request.url))
        result = inference_service.predict(image, top_k=request.top_k)
        
        breed_info = breed_info_service.get_breed_summary(result['predicted_breed'])
        if breed_info:
            result['breed_info'] = breed_info

        return result

    except ValueError as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Prediction failed: {e}")
        raise HTTPException(status_code=500, detail="Internal server error during prediction")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
