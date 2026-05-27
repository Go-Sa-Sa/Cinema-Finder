#!/bin/bash
cd "$(dirname "$0")"
echo "Starting Cinema Schedule Tool Server..."
python3 server.py
if [ $? -ne 0 ]; then
  echo "'python3' failed. Trying 'python'..."
  python server.py
fi
