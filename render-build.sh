#!/usr/bin/env bash
# Exit on error
set -o errexit

# Install dependencies using the system python
pip install --upgrade pip
pip install -r backend/requirements.txt
