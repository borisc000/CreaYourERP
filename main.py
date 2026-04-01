"""
Compatibility bootstrap for the current ERP app.

Running the server from the repository root used to start an older, reduced
version of the API. This wrapper always loads the full application living in
YOUR_ERP_CORE/main.py so routes like /app/accreditation, /app/signature-center
and /app/cross-correspondence are available no matter where the server starts.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent
CORE_DIR = ROOT_DIR / "YOUR_ERP_CORE"
CORE_MAIN_PATH = CORE_DIR / "main.py"

if str(CORE_DIR) not in sys.path:
    sys.path.insert(0, str(CORE_DIR))

_spec = importlib.util.spec_from_file_location("your_erp_core_app", CORE_MAIN_PATH)
if _spec is None or _spec.loader is None:
    raise RuntimeError(f"Could not load ERP app from {CORE_MAIN_PATH}")

_core_app = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_core_app)

app = _core_app.app
erp_framework = getattr(_core_app, "erp_framework", None)


if __name__ == "__main__":
    import uvicorn

    print("")
    print("    +-------------------------------------------+")
    print("    |       YOUR ERP - Unified Bootstrap        |")
    print("    |      Loading app from YOUR_ERP_CORE       |")
    print("    +-------------------------------------------+")
    print("")
    print(f"  Core app: {CORE_MAIN_PATH}")
    print("  Server running at: http://localhost:8000")
    print("  Frontend: /app/login")
    print("  Acreditaciones: /app/accreditation")
    print("  Correspondencia: /app/cross-correspondence")
    print("  Firmas: /app/signature-center")

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level="info",
    )
