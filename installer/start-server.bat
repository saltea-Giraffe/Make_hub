@echo off
:: Make HUB - サーバー起動スクリプト
:: このファイルは NSSM Windows サービスから呼び出されます

cd /d "%~dp0"
set NODE_ENV=production
"%~dp0node\node.exe" "%~dp0backend\index.js"
