#!/usr/bin/env bash
# Exit on error
set -o errexit

# Force remove the broken virtual environment
rm -rf /opt/render/project/src/.venv

# Install dependencies using the system python
pip install --upgrade pip
pip install -r backend/requirements.txt
