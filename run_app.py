#!/usr/bin/env python
"""Runner for MammoFusion-XAI Premium Luxury Frontend Server."""

import sys
import uvicorn
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

if __name__ == "__main__":
    print("================================================================")
    print("MammoFusion-XAI Risk — Luxury Feminine Medical AI Dashboard")
    print("Serving on: http://127.0.0.1:8000")
    print("================================================================")
    uvicorn.run("app.server:app", host="127.0.0.1", port=8000, reload=False)

