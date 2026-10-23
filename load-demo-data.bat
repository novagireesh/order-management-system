@echo off
title Load demo data
cd /d "%~dp0app"
echo This DELETES the current database and fills it with fictional demo data.
pause
python seed_demo.py
pause
