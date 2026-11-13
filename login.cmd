@echo off
setlocal
chcp 65001 >nul
title HiFleet 登录（DeepSeek Harness 插件）
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 未找到 Node.js。请安装 Node.js 20.19 或更高版本，并确保 node 在 PATH 中。
  echo 下载地址: https://nodejs.org/
  pause
  exit /b 1
)

echo ==================================================
echo   HiFleet 账号登录（非官方工具）
echo   1) 输入 HiFleet 账号（邮箱/手机号）后回车
echo   2) 输入密码时屏幕不显示字符，输入完回车
echo   会话保存到: %USERPROFILE%\.hifleet\session.json
echo ==================================================
echo.

node "server\login.mjs" %*

set CODE=%errorlevel%
echo.
if "%CODE%"=="0" (
  echo [完成] 登录成功。现在可以直接回到 DSH 使用 HiFleet 工具了。
) else (
  echo [失败] 登录未成功（退出码 %CODE%），请看上面的错误提示后重试。
)
pause
exit /b %CODE%