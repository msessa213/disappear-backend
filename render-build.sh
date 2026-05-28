#!/usr/bin/env bash
set -o errexit

# Upgrade pip and install with the flag that bypasses the PEP 668 restriction
pip install --upgrade pip --break-system-packages
pip install -r backend/requirements.txt --break-system-packages