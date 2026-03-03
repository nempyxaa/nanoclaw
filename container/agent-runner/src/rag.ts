#!/usr/bin/env node

import { pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";
import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";

// Config
const MODEL_ID = "Xenova/all-MiniLM-L6-v2";
const CONVERSATIONS_DIR = "/workspace/group/conversations";
const INDEX_PATH = "/workspace/group/.rag-index.json";
const CACHE_DIR = "/workspace/group/.cache/transformers";
const PREBUILT_CACHE = "/app/.cache/transformers";
const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;
const DEFAULT_TOP_N = 5;

// Types
interface Chunk {
  id: string;
  source: string;
  text: string;
  embedding: number[];
}

interface RagIndex {
  version: number;
  model: string;
  indexedAt: string;
  files: Record<string, number>; // filename -> mtimeMs
  chunks: Chunk[];
}

// Embedder singleton
let embedder: FeatureExtractionPipeline | null = null;

async function getEmbedder(): Promise<FeatureExtractionPipeline> {
  if (embedder) return embedder;

  // Use prebuilt cache from Docker build if available, otherwise workspace cache
  const { existsSync } = await import("node:fs");
  const cacheDir = existsSync(PREBUILT_CACHE) ? PREBUILT_CACHE : CACHE_DIR;
  process.env.TRANSFORMERS_CACHE = cacheDir;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  embedder = await (pipeline as any)("feature-extraction", MODEL_ID, {
    dtype: "fp32",
  }) as FeatureExtractionPipeline;
  return embedder;
}

// Load existing index or create empty
async function loadIndex(): Promise<RagIndex> {
  try {
    const data = await readFile(INDEX_PATH, "utf-8");
    const index = JSON.parse(data) as RagIndex;
    if (index.version === 1 && index.model === MODEL_ID) return index;
  } catch {
    // No index or incompatible — start fresh
  }
  return { version: 1, model: MODEL_ID, indexedAt: "", files: {}, chunks: [] };
}

async function saveIndex(index: RagIndex): Promise<void> {
  index.indexedAt = new Date().toISOString();
  await writeFile(INDEX_PATH, JSON.stringify(index), "utf-8");
}

// Get conversation files and their mtimes
async function getConversationFiles(): Promise<Map<string, number>> {
  const files = new Map<string, number>();
  try {
    const entries = await readdir(CONVERSATIONS_DIR);
    for (const entry of entries) {
      if (!entry.endsWith(".md")) continue;
      const s = await stat(join(CONVERSATIONS_DIR, entry));
      files.set(entry, s.mtimeMs);
    }
  } catch {
    // Directory might not exist yet
  }
  return files;
}

// Split markdown into chunks at message boundaries
function chunkConversation(text: string, source: string): { text: string; source: string }[] {
  // Split at message boundaries
  const messages = text.split(/\n\n(?=\*\*(User|Assistant)\*\*:)/);
  const chunks: { text: string; source: string }[] = [];
  let buffer = "";

  for (const msg of messages) {
    const trimmed = msg.trim();
    if (!trimmed) continue;

    if (buffer.length + trimmed.length > CHUNK_SIZE && buffer.length > 0) {
      chunks.push({ text: buffer.trim(), source });
      // Keep overlap from end of previous chunk
      const overlapStart = Math.max(0, buffer.length - CHUNK_OVERLAP);
      buffer = buffer.slice(overlapStart) + "\n\n" + trimmed;
    } else {
      buffer = buffer ? buffer + "\n\n" + trimmed : trimmed;
    }
  }

  if (buffer.trim()) {
    chunks.push({ text: buffer.trim(), source });
  }

  return chunks;
}

// Embed an array of texts
async function embedTexts(texts: string[]): Promise<number[][]> {
  const model = await getEmbedder();
  const results: number[][] = [];

  // Process in batches of 32
  for (let i = 0; i < texts.length; i += 32) {
    const batch = texts.slice(i, i + 32);
    const output = await model(batch, { pooling: "mean", normalize: true });
    for (let j = 0; j < batch.length; j++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tensor = (output as any)[j];
      results.push(Array.from(tensor.data as Float32Array));
    }
  }

  return results;
}

// Cosine similarity (vectors are already normalized)
function cosineSim(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

// Index command
async function indexCmd(): Promise<void> {
  const index = await loadIndex();
  const currentFiles = await getConversationFiles();

  if (currentFiles.size === 0) {
    console.log(JSON.stringify({ status: "no_files", message: "No conversation files found in " + CONVERSATIONS_DIR }));
    return;
  }

  // Find files to add/update/remove
  const toEmbed: string[] = [];
  const toRemove: string[] = [];

  for (const [file, mtime] of currentFiles) {
    if (!index.files[file] || index.files[file] !== mtime) {
      toEmbed.push(file);
    }
  }

  for (const file of Object.keys(index.files)) {
    if (!currentFiles.has(file)) {
      toRemove.push(file);
    }
  }

  if (toEmbed.length === 0 && toRemove.length === 0) {
    console.log(JSON.stringify({
      status: "up_to_date",
      files: currentFiles.size,
      chunks: index.chunks.length,
    }));
    return;
  }

  // Remove stale chunks
  if (toRemove.length > 0 || toEmbed.length > 0) {
    const removeSet = new Set([...toRemove, ...toEmbed]);
    index.chunks = index.chunks.filter((c) => !removeSet.has(c.source));
    for (const file of toRemove) delete index.files[file];
  }

  // Chunk and embed new/updated files
  if (toEmbed.length > 0) {
    const allChunks: { text: string; source: string }[] = [];

    for (const file of toEmbed) {
      const content = await readFile(join(CONVERSATIONS_DIR, file), "utf-8");
      const chunks = chunkConversation(content, file);
      allChunks.push(...chunks);
    }

    console.error(`Embedding ${allChunks.length} chunks from ${toEmbed.length} files...`);
    const embeddings = await embedTexts(allChunks.map((c) => c.text));

    for (let i = 0; i < allChunks.length; i++) {
      index.chunks.push({
        id: `${allChunks[i].source}#${i}`,
        source: allChunks[i].source,
        text: allChunks[i].text,
        embedding: embeddings[i],
      });
    }

    // Update file mtimes
    for (const file of toEmbed) {
      index.files[file] = currentFiles.get(file)!;
    }
  }

  await saveIndex(index);

  console.log(JSON.stringify({
    status: "indexed",
    filesIndexed: toEmbed.length,
    filesRemoved: toRemove.length,
    totalFiles: Object.keys(index.files).length,
    totalChunks: index.chunks.length,
  }));
}

// Search command
async function searchCmd(query: string, topN: number): Promise<void> {
  // Auto-index if needed
  const index = await loadIndex();
  const currentFiles = await getConversationFiles();

  let needsReindex = false;
  for (const [file, mtime] of currentFiles) {
    if (!index.files[file] || index.files[file] !== mtime) {
      needsReindex = true;
      break;
    }
  }
  for (const file of Object.keys(index.files)) {
    if (!currentFiles.has(file)) {
      needsReindex = true;
      break;
    }
  }

  if (needsReindex) {
    console.error("Index stale, re-indexing...");
    await indexCmd();
    // Reload after indexing
    const freshIndex = await loadIndex();
    return searchWithIndex(query, topN, freshIndex);
  }

  return searchWithIndex(query, topN, index);
}

async function searchWithIndex(query: string, topN: number, index: RagIndex): Promise<void> {
  if (index.chunks.length === 0) {
    console.log(JSON.stringify({ query, results: [], message: "Index is empty" }));
    return;
  }

  const [queryEmbedding] = await embedTexts([query]);

  const scored = index.chunks.map((chunk) => ({
    score: cosineSim(queryEmbedding, chunk.embedding),
    source: chunk.source,
    text: chunk.text,
  }));

  scored.sort((a, b) => b.score - a.score);
  const results = scored.slice(0, topN).map((r) => ({
    score: Math.round(r.score * 1000) / 1000,
    source: r.source,
    text: r.text,
  }));

  console.log(JSON.stringify({ query, results }));
}

// Status command
async function statusCmd(): Promise<void> {
  const index = await loadIndex();
  const currentFiles = await getConversationFiles();

  let staleFiles = 0;
  for (const [file, mtime] of currentFiles) {
    if (!index.files[file] || index.files[file] !== mtime) staleFiles++;
  }

  console.log(JSON.stringify({
    indexExists: index.indexedAt !== "",
    indexedAt: index.indexedAt || null,
    model: MODEL_ID,
    indexedFiles: Object.keys(index.files).length,
    conversationFiles: currentFiles.size,
    staleFiles,
    totalChunks: index.chunks.length,
    indexPath: INDEX_PATH,
  }));
}

// CLI entry point
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "index":
      await indexCmd();
      break;
    case "search": {
      const query = args[1];
      if (!query) {
        console.error("Usage: rag.js search \"query\" [-n 5]");
        process.exit(1);
      }
      const nIdx = args.indexOf("-n");
      const topN = nIdx !== -1 ? parseInt(args[nIdx + 1], 10) || DEFAULT_TOP_N : DEFAULT_TOP_N;
      await searchCmd(query, topN);
      break;
    }
    case "status":
      await statusCmd();
      break;
    default:
      console.error("Usage: rag.js <index|search|status>");
      console.error("  index              Index all conversation files");
      console.error('  search "query" [-n 5]  Search conversations');
      console.error("  status             Show index stats");
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err.message || err);
  process.exit(1);
});
