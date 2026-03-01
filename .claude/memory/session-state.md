# Session State (last updated: 2026-03-01)

## Status: PAUSED

## Project: Persistent Chrome CDP + Browser Automation
Run a persistent Chrome instance with CDP enabled so NanoClaw agents can automate real browser sessions (LinkedIn, Miro, etc.). Log in once — agents reuse the session.

## Decision Log
- Started with headless Chrome on Hostinger VPS (187.77.108.22)
- User saw OpenClaw's approach: Docker container (Ubuntu + LXDE + noVNC) — better because visual login + CDP
- User wants residential IP — decided to run everything on local Mac laptop (home ISP = residential)
- User paused before pulling Docker image — reconsidering approach

## Completed
- Chrome 145 installed on VPS (may remove later)
- chrome-cdp.service running on VPS (may remove later)
- playwright-core installed on VPS

## Not Yet Done
- Docker container setup (Ubuntu + LXDE + noVNC + Chrome + CDP) on Mac
- browser-cdp.mjs CLI helper script
- browser-cdp SKILL.md for NanoClaw
- Deploy and verify

## Connections
- VPS: `ssh root@187.77.108.22` (Hostinger, Ubuntu)
- NanoClaw repo: `~/nanoclaw`
- Docker Desktop: must be started manually by user before container work
- Chrome CDP on VPS: `curl http://localhost:9222/json/version` (via SSH)

## Key Details
- Base image candidate: dorowu/ubuntu-desktop-lxde-vnc (user cancelled pull, may want different approach)
- Ports planned: 6080 (noVNC), 9222 (CDP), bound to 127.0.0.1
