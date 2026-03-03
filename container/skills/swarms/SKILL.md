---
name: swarms
description: Coordinate multiple agent teammates for complex tasks. Use when a task can be parallelized (e.g., researching multiple topics, analyzing different aspects simultaneously, or when you need specialized sub-agents).
allowed-tools: TeamCreate, TeamDelete, SendMessage, Task, TaskOutput, TaskStop
---

# Agent Swarms (Multi-Agent Coordination)

## When to Use

- Research tasks with multiple independent threads
- Analysis requiring different perspectives or specializations
- Tasks where parallel work saves significant time
- Complex multi-step workflows with independent phases

## How It Works

You can create teammate agents that run in parallel. Each gets their own context and tools. You coordinate by sending messages.

## Creating a Team

Use TeamCreate to spin up a teammate:
- Give them a clear role and specific task
- They inherit your tools (Bash, WebSearch, etc.)
- They can read/write files in the workspace

## Coordination Patterns

### Fan-Out (Parallel Research)
1. Create N teammates, each researching a different topic
2. Wait for all to complete
3. Synthesize their findings

### Pipeline (Sequential Processing)
1. Agent A processes raw data
2. Agent B analyzes Agent A's output
3. You compile the final result

### Specialist (Domain Experts)
1. Create agents with specific expertise prompts
2. Route questions to the right specialist
3. Aggregate responses

## Communication

- Use `SendMessage` to communicate with teammates
- Teammates write results to files in /workspace/group/
- Check TaskOutput for completion status

## Best Practices

- Keep teammate prompts focused and specific
- Define clear output format (file path, structure)
- Don't create more than 3-4 teammates (resource limits)
- Always wait for teammates to finish before synthesizing
- Sub-agents should NOT use send_message to the user unless explicitly told to
