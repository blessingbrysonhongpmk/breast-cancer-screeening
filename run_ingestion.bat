@echo off
echo ========================================================
echo MammoFusion-XAI Risk - Dataset Ingestion Runner
echo ========================================================
py -3.10 run_ingestion.py %*
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Pipeline encountered an issue or requires attention.
)
pause

