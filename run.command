#!/bin/zsh -l
cd "$(dirname "$0")"
echo "========================================================"
echo "Starting Chiba Cinema Finder (Local Web Server)..."
echo "Access at: http://localhost:8000"
echo "(Press Ctrl+C to stop)"
echo "========================================================"

python3 server.py
if [ $? -ne 0 ]; then
  echo "'python3' failed. Trying 'python'..."
  python server.py
  if [ $? -ne 0 ]; then
    echo ""
    echo "=================================================="
    echo "ERROR: Failed to start the server."
    echo "Please check if Python 3 is installed."
    echo "=================================================="
    echo "Press [Enter] to close this window..."
    read
  fi
fi
