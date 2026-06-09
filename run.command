#!/bin/zsh -l
cd "$(dirname "$0")"
echo "Starting Cinema Schedule Tool Server..."
python3 server.py
if [ $? -ne 0 ]; then
  echo "'python3' failed. Trying 'python'..."
  python server.py
  if [ $? -ne 0 ]; then
    echo ""
    echo "=================================================="
    echo "ERROR: Failed to start the server."
    echo "Please check if Python and dependencies are installed."
    echo "=================================================="
    echo "Press [Enter] to close this window..."
    read
  fi
fi
