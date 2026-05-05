@echo off
title MC Auth Server
cd /d "%~dp0auth-server"
node src/index.js
pause
