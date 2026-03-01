---
name: google
description: Access Google services — Gmail, Calendar, Drive, Docs, Sheets, Slides, Forms, Contacts, Tasks, Chat, Keep, Groups, People, and Apps Script. Use `--account <alias>` to select which Google account to use and `--json` for structured output.
allowed-tools: Bash(gog:*)
---

# Google Services with gogcli

## Accounts

Always specify `--account <alias>` to select which Google account to use.

| Alias | Email | Notes |
|-------|-------|-------|
| personal | pantropov@gmail.com | Personal Gmail |
| work-ai | piotr.a@wonderful.ai | Wonderful AI (Workspace) |
| work-lokalise | petr@lokalise.com | Lokalise (Workspace) |
| personal2 | stul4ak@gmail.com | Secondary personal |

**Default pattern:** `gog --account personal <command> --json`

## Gmail

```bash
# Search & read
gog --account <alias> gmail search '<query>' --max 10 --json
gog --account <alias> gmail messages search '<query>' --include-body --json
gog --account <alias> gmail thread get <threadId> --json
gog --account <alias> gmail thread get <threadId> --download --out-dir ./attachments
gog --account <alias> gmail get <messageId> --json

# Send
gog --account <alias> gmail send --to <email> --subject "Subject" --body "Body"
gog --account <alias> gmail send --to <email> --subject "Subject" --body-html "<h1>HTML</h1>"
gog --account <alias> gmail send --reply-to-message-id <id> --quote --to <email> --subject "Re: ..." --body "Reply"
gog --account <alias> gmail send --to <email> --cc <email> --bcc <email> --subject "Subject" --body "Body"

# Labels
gog --account <alias> gmail labels list --json
gog --account <alias> gmail labels get <label> --json
gog --account <alias> gmail labels create "Label Name"
gog --account <alias> gmail thread modify <threadId> --add "Label" --remove "INBOX"

# Drafts
gog --account <alias> gmail drafts list --json
gog --account <alias> gmail drafts create --to <email> --subject "Subject" --body "Body"
gog --account <alias> gmail drafts send <draftId>

# Batch operations
gog --account <alias> gmail batch modify <msgId1> <msgId2> --add "Label" --remove "UNREAD"
gog --account <alias> gmail batch delete <msgId1> <msgId2>

# Filters
gog --account <alias> gmail filters list --json
gog --account <alias> gmail filters create --from '<email>' --add-label 'Label'
gog --account <alias> gmail filters delete <filterId>

# Settings
gog --account <alias> gmail vacation get --json
gog --account <alias> gmail vacation enable --subject "OOO" --message "I'm away"
gog --account <alias> gmail vacation disable
gog --account <alias> gmail delegates list --json
gog --account <alias> gmail sendas list --json
```

## Calendar

```bash
# List events
gog --account <alias> calendar events primary --today --json
gog --account <alias> calendar events primary --tomorrow --json
gog --account <alias> calendar events primary --week --json
gog --account <alias> calendar events primary --days 7 --json
gog --account <alias> calendar events primary --from "2025-01-15" --to "2025-01-20" --json
gog --account <alias> calendar events --all --today --json
gog --account <alias> calendar search "meeting" --today --json

# Calendars
gog --account <alias> calendar calendars --json

# Create events
gog --account <alias> calendar create primary --summary "Meeting" --from "2025-01-15T10:00" --to "2025-01-15T11:00"
gog --account <alias> calendar create primary --summary "Lunch" --from "2025-01-15T12:00" --to "2025-01-15T13:00" --attendees "a@x.com,b@x.com" --location "Office"
gog --account <alias> calendar create primary --summary "Weekly" --from "2025-01-15T10:00" --to "2025-01-15T11:00" --rrule "FREQ=WEEKLY;COUNT=10"

# Update & delete
gog --account <alias> calendar update primary <eventId> --summary "New Title" --from "2025-01-15T11:00" --to "2025-01-15T12:00"
gog --account <alias> calendar update primary <eventId> --add-attendee "new@x.com" --send-updates all
gog --account <alias> calendar delete primary <eventId> --force
gog --account <alias> calendar respond primary <eventId> --status accepted --send-updates all

# Availability
gog --account <alias> calendar freebusy --calendars "primary,other@x.com" --from "2025-01-15T09:00" --to "2025-01-15T18:00" --json
gog --account <alias> calendar conflicts --calendars "primary" --today --json

# Special event types
gog --account <alias> calendar focus-time --from "2025-01-15T14:00" --to "2025-01-15T16:00"
gog --account <alias> calendar out-of-office --from "2025-01-20" --to "2025-01-24" --all-day

# Team (Workspace)
gog --account <alias> calendar team <group@x.com> --today --json
```

## Drive

```bash
# List & search
gog --account <alias> drive ls --max 20 --json
gog --account <alias> drive ls --parent <folderId> --json
gog --account <alias> drive search "<query>" --max 20 --json
gog --account <alias> drive get <fileId> --json
gog --account <alias> drive url <fileId>

# Upload & download
gog --account <alias> drive upload ./file.pdf --parent <folderId>
gog --account <alias> drive upload ./file.docx --convert
gog --account <alias> drive download <fileId> --out ./file.pdf
gog --account <alias> drive download <fileId> --format pdf --out ./export.pdf

# Organize
gog --account <alias> drive mkdir "Folder Name" --parent <folderId>
gog --account <alias> drive rename <fileId> "New Name"
gog --account <alias> drive move <fileId> --parent <destFolderId>
gog --account <alias> drive copy <fileId> "Copy Name"
gog --account <alias> drive delete <fileId>

# Permissions
gog --account <alias> drive permissions <fileId> --json
gog --account <alias> drive share <fileId> --to user --email <email> --role writer
gog --account <alias> drive share <fileId> --to domain --domain <domain> --role reader
gog --account <alias> drive unshare <fileId> --permission-id <permId>

# Shared drives (Workspace)
gog --account <alias> drive drives --json
```

## Docs

```bash
# Read
gog --account <alias> docs info <docId> --json
gog --account <alias> docs cat <docId>
gog --account <alias> docs cat <docId> --tab "Tab Name"
gog --account <alias> docs cat <docId> --all-tabs
gog --account <alias> docs list-tabs <docId> --json
gog --account <alias> docs export <docId> --format pdf --out ./doc.pdf

# Create & copy
gog --account <alias> docs create "Title" --file ./content.md
gog --account <alias> docs copy <docId> "Copy Name"

# Edit
gog --account <alias> docs find-replace <docId> "old text" "new text"
gog --account <alias> docs write <docId> --replace --markdown --file ./content.md
gog --account <alias> docs update <docId> --format markdown --content-file ./content.md

# Sed-style editing
gog --account <alias> docs sed <docId> 's/old/new/g'
gog --account <alias> docs sed <docId> 's/text/**text**/'         # bold
gog --account <alias> docs sed <docId> 's/text/*text*/'           # italic
gog --account <alias> docs sed <docId> 's/text/[text](url)/'     # link
gog --account <alias> docs sed <docId> 's/{{TABLE}}/|3x4|/'      # insert table
```

## Sheets

```bash
# Read
gog --account <alias> sheets metadata <spreadsheetId> --json
gog --account <alias> sheets get <spreadsheetId> 'Sheet1!A1:D10' --json
gog --account <alias> sheets notes <spreadsheetId> 'Sheet1!A1:D10' --json

# Create & copy
gog --account <alias> sheets create "Title" --sheets "Sheet1,Sheet2"
gog --account <alias> sheets copy <spreadsheetId> "Copy Name"

# Write (pipe = next column, comma = next row)
gog --account <alias> sheets update <spreadsheetId> 'Sheet1!A1' 'Name|Email,Alice|alice@x.com'
gog --account <alias> sheets update <spreadsheetId> 'Sheet1!A1' --values-json '[["Name","Email"],["Alice","alice@x.com"]]'
gog --account <alias> sheets append <spreadsheetId> 'Sheet1!A:B' 'Alice|alice@x.com'
gog --account <alias> sheets clear <spreadsheetId> 'Sheet1!A1:D10'

# Structure
gog --account <alias> sheets insert <spreadsheetId> "Sheet1" rows 5 --count 3
gog --account <alias> sheets insert <spreadsheetId> "Sheet1" cols 2 --after

# Export
gog --account <alias> sheets export <spreadsheetId> --format xlsx --out ./sheet.xlsx
```

## Slides

```bash
gog --account <alias> slides info <presentationId> --json
gog --account <alias> slides create "Title"
gog --account <alias> slides create-from-markdown "Title" --content-file ./slides.md
gog --account <alias> slides copy <presentationId> "Copy Name"
gog --account <alias> slides list-slides <presentationId> --json
gog --account <alias> slides export <presentationId> --format pdf --out ./slides.pdf
gog --account <alias> slides add-slide <presentationId> ./image.png --notes "Speaker notes"
```

## Forms

```bash
gog --account <alias> forms get <formId> --json
gog --account <alias> forms create --title "Form Title" --description "Description"
gog --account <alias> forms responses list <formId> --json
gog --account <alias> forms responses get <formId> <responseId> --json
```

## Contacts

```bash
# Personal contacts
gog --account <alias> contacts list --max 50 --json
gog --account <alias> contacts search "name" --json
gog --account <alias> contacts get <email> --json
gog --account <alias> contacts create --given "First" --family "Last" --email <email> --phone "+1234567890"
gog --account <alias> contacts update people/<resourceName> --given "First" --email <email>
gog --account <alias> contacts delete people/<resourceName>

# Other contacts & directory (Workspace)
gog --account <alias> contacts other list --json
gog --account <alias> contacts other search "name" --json
gog --account <alias> contacts directory list --json
gog --account <alias> contacts directory search "name" --json
```

## Tasks

```bash
# Task lists
gog --account <alias> tasks lists --json
gog --account <alias> tasks lists create "List Name"

# Tasks
gog --account <alias> tasks list <tasklistId> --json
gog --account <alias> tasks get <tasklistId> <taskId> --json
gog --account <alias> tasks add <tasklistId> --title "Task title"
gog --account <alias> tasks add <tasklistId> --title "Task" --due "2025-01-20" --repeat weekly
gog --account <alias> tasks update <tasklistId> <taskId> --title "Updated"
gog --account <alias> tasks done <tasklistId> <taskId>
gog --account <alias> tasks undo <tasklistId> <taskId>
gog --account <alias> tasks delete <tasklistId> <taskId>
```

## Chat (Workspace)

```bash
# Spaces
gog --account <alias> chat spaces list --json
gog --account <alias> chat spaces find "Space Name" --json
gog --account <alias> chat spaces create "Space Name" --member a@x.com --member b@x.com

# Messages
gog --account <alias> chat messages list spaces/<spaceId> --max 20 --json
gog --account <alias> chat messages send spaces/<spaceId> --text "Hello"
gog --account <alias> chat messages list spaces/<spaceId> --unread --json

# DMs
gog --account <alias> chat dm send <email> --text "Hello"
gog --account <alias> chat dm space <email> --json
```

## People (Workspace)

```bash
gog --account <alias> people me --json
gog --account <alias> people search "name" --json
gog --account <alias> people get people/<userId> --json
gog --account <alias> people relations --json
```

## Groups (Workspace)

```bash
gog --account <alias> groups list --json
gog --account <alias> groups members <group@x.com> --json
```

## Keep (Workspace)

```bash
gog --account <alias> keep list --json
gog --account <alias> keep get <noteId> --json
gog --account <alias> keep search "query" --json
```

## Apps Script

```bash
gog --account <alias> appscript get <scriptId> --json
gog --account <alias> appscript content <scriptId> --json
gog --account <alias> appscript create --title "Script" --parent-id <driveFileId>
gog --account <alias> appscript run <scriptId> <functionName> --params '{"key":"value"}' --json
```

## Auth (diagnostics)

```bash
gog auth list --json          # List authenticated accounts
gog auth list --check --json  # Verify tokens are valid
gog auth alias list --json    # List aliases
gog auth status --json        # Auth state
```
