#!/usr/bin/env python
"""Beginner-friendly runner for MammoFusion-XAI safe dataset ingestion."""

import sys
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.ingestion.pipeline import main

if __name__ == "__main__":
    main()

