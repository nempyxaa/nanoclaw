---
name: rag
description: Search past conversations semantically. Use when asked to recall, find, or look up what was discussed previously.
allowed-tools: Bash(node:*)
---

# Search Past Conversations

Search archived conversations using semantic similarity.

## Commands

```bash
# Search for something discussed before
node /tmp/dist/rag.js search "query" [-n 5]

# Check index status
node /tmp/dist/rag.js status

# Manually rebuild index
node /tmp/dist/rag.js index
```

## Search

```bash
node /tmp/dist/rag.js search "what did we discuss about Remotion"
```

Returns JSON with ranked results:
```json
{
  "query": "...",
  "results": [
    { "score": 0.85, "source": "conversation-2025-01-15.md", "text": "..." }
  ]
}
```

Each result includes the relevance score (0-1), the source conversation file, and the matching text excerpt.

## Notes

- The index auto-updates on search when conversation files change — no need to manually index
- First run downloads the embedding model (~23MB), subsequent runs use the cached model
- Progress messages go to stderr; JSON results go to stdout
- Use `-n` to control number of results (default 5)
- Conversations are in `/workspace/group/conversations/`
