---
name: remotion
description: Generate videos programmatically using Remotion. Create motion graphics, data visualizations, text animations, slideshows, and more. Use when the user asks for video content generation.
allowed-tools: Bash(remotion:*,npx:*,node:*,cat:*,ls:*,mkdir:*), Read, Write, Edit
---

# Video Generation with Remotion

## Quick Start

1. Create a Remotion project in /workspace/group/video/
2. Define your composition in React/TypeScript
3. Render to MP4

## Project Setup

```bash
mkdir -p /workspace/group/video
cd /workspace/group/video
npx create-video@latest --no-install my-video
cd my-video
npm install
```

## Rendering

```bash
cd /workspace/group/video/my-video
npx remotion render src/index.ts MyComposition out/video.mp4
```

## Common Patterns

### Text Animation
Create a composition with animated text using Remotion's `useCurrentFrame()` and `interpolate()`.

### Slideshow
Use `Sequence` components to create timed slides from images.

### Data Visualization
Animate charts and graphs by interpolating data values across frames.

## Key APIs

- `useCurrentFrame()` - current frame number
- `useVideoConfig()` - fps, width, height, duration
- `interpolate(frame, inputRange, outputRange)` - animate values
- `<Sequence from={30} durationInFrames={60}>` - timed sequences
- `<Img src={staticFile('image.png')} />` - static assets

## Output

Videos render to MP4 files in the project's `out/` directory. After rendering, you can send the file path to the user or upload it.
