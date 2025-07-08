#!/bin/bash
source ../venv/bin/activate
../venv/bin/python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000 