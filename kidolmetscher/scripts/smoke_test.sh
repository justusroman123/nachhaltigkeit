#!/usr/bin/env bash
# Rauchtest der Pipeline. Backends ueber Umgebung, z. B.:
#   ASR_BACKEND=real MT_BACKEND=real TTS_BACKEND=real scripts/smoke_test.sh
set -euo pipefail
cd "$(dirname "$0")/.."
exec "${PYTHON:-python3}" scripts/smoke_test.py "$@"
