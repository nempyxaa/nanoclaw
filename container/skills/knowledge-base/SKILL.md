---
name: knowledge-base
description: Ingest content (podcast transcripts, articles, documents) into a structured knowledge base. Extract key insights, store them searchably, and make them available for future reference. Use when asked to learn from, study, or absorb content.
allowed-tools: Bash(cat:*,ls:*,echo:*,wc:*,grep:*,mkdir:*), Read, Write, Edit, Glob, Grep, WebSearch, WebFetch
---

# Knowledge Base Management

## Structure

Knowledge base lives at `/workspace/group/knowledge/`:

```
knowledge/
  index.md           # Master index of all ingested content
  sources/           # Original source files
  insights/          # Extracted insights by topic
  podcasts/          # Podcast-specific content
    transcripts/     # Raw transcripts
    episodes.md      # Episode index with key takeaways
  articles/          # Article summaries
```

## Ingestion Workflow

### Podcasts

1. User provides transcript (file, URL, or paste)
2. Save raw transcript to `knowledge/sources/`
3. Extract structured insights:
   - Key claims and arguments
   - Action items or recommendations
   - Quotes worth remembering
   - People and concepts mentioned
   - Connections to existing knowledge
4. Append to `knowledge/podcasts/episodes.md`
5. File insights by topic under `knowledge/insights/`
6. Update `knowledge/index.md`

### Articles / Documents

1. Fetch or receive content
2. Save source to `knowledge/sources/`
3. Extract: summary, key points, implications
4. File by topic under `knowledge/insights/`
5. Update index

## Index Format (index.md)

```markdown
# Knowledge Base Index

## Topics
- AI/ML: insights/ai-ml.md (15 entries)
- Business: insights/business.md (8 entries)
- Productivity: insights/productivity.md (3 entries)

## Sources
| Date | Type | Title | File | Topics |
|------|------|-------|------|--------|
| 2026-03-04 | Podcast | My First Million #482 | sources/mfm-482.md | Business, AI |
```

## Querying

When the user asks about something:
1. Check `knowledge/index.md` for relevant topics
2. Read the topic file(s) under `knowledge/insights/`
3. Synthesize an answer referencing the original sources

## Integration with RAG (future)

When the RAG system is available, the knowledge base files will be automatically indexed for semantic search.
