---
name: reminders
description: Create smart conditional reminders. Use when the user says "remind me if...", "check if... by...", "follow up on... if...", or any conditional time-based check.
allowed-tools: Bash(cat:*,ls:*,echo:*), Read, Write, Edit, mcp__nanoclaw__schedule_task, mcp__nanoclaw__send_message
---

# Smart Reminders

## Overview

Smart reminders let users set conditional checks: "remind me if X hasn't happened by Y time."

## How It Works

1. User requests a conditional reminder
2. You extract: the condition, the check time, and the action if condition is not met
3. Store the reminder in `/workspace/group/reminders.json`
4. Create a scheduled task (type: 'once') at the check time

## Reminder Storage

Read and update `/workspace/group/reminders.json`:

```json
{
  "reminders": [
    {
      "id": "rem-1709312000-abc123",
      "created": "2026-03-04T10:00:00",
      "checkTime": "2026-03-04T17:00:00",
      "condition": "User hasn't submitted the report",
      "action": "Send reminder about the report",
      "context": "User mentioned needing to submit Q1 report by EOD",
      "status": "pending"
    }
  ]
}
```

## When the Scheduled Task Fires

The task prompt should include:
1. The condition to check
2. How to check it (look at conversations, files, calendar, etc.)
3. What to do if the condition is NOT met (send reminder)
4. What to do if the condition IS met (mark complete, optionally notify)

## Creating the Scheduled Task

Use the schedule_task tool with:
- schedule_type: "once"
- schedule_value: ISO timestamp (e.g., "2026-03-04T17:00:00")
- context_mode: "group" (so it can check conversation history)
- prompt: A self-contained instruction that includes the condition and action

Example prompt for the task:
```
[SMART REMINDER CHECK]

Reminder ID: rem-1709312000-abc123
Created: 2026-03-04T10:00:00

CONDITION TO CHECK: User hasn't submitted the Q1 report
HOW TO CHECK: Look through recent conversations in /workspace/group/conversations/ for mentions of submitting or completing the Q1 report after 2026-03-04T10:00:00.

IF CONDITION IS NOT MET (report not submitted):
Send a reminder via send_message: "Hey! Just checking — did you submit the Q1 report? You mentioned wanting to get it done today."

IF CONDITION IS MET (report was submitted):
Send via send_message: "Looks like the Q1 report is done. Nice!"

After checking, update /workspace/group/reminders.json to set this reminder's status to "checked".
```

## Parsing User Requests

Common patterns:
- "Remind me to X by Y" → check at Y if X was done
- "If I haven't X by Y, remind me" → check at Y for X
- "Follow up on X in 2 hours" → check in 2 hours
- "Check if X by end of day" → check at 17:00 today

Always confirm the reminder with the user before creating it.
