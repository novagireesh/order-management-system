@echo off
title Order Management System
cd /d "%~dp0app"
echo Starting Order Management System ... (keep this window open)
python server.py
pause
