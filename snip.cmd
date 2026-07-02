@echo off
:: Windows CMD wrapper — forwards all arguments to cli.js.
node "%~dp0cli.js" %*
