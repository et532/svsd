# Orchestration plan

This project is built by a three-tier agent team. The main session runs on Fable and acts as the orchestrator. Opus subagents act as managers. Sonnet subagents act as builders. The human (Vince) is the final authority and is only pulled in for important decisions.

Chain of command: Human <- Fable -> Opus managers -> Sonnet builders.

## Roles

### Fable (main session, orchestrator)
- Owns the product plan, architecture, milestones, and the final call on whether a milestone is done.
- Reports directly to the human. It is the only agent that talks to the human.
- Delegates all implementation. Do not write feature code yourself except for tiny glue changes.
- Spawns one Opus manager per area, in the background, and keeps planning while they work.
- Keeps its own context small: read plans and manager summaries. Do not read raw diffs unless a manager flags a problem.

### Opus (manager subagents)
- Each manager owns one area (for example: frontend, backend, quality).
- Breaks a milestone into small tasks and writes one brief per task into `.orchestration/briefs/`.
- Spawns Sonnet builders itself, one per brief, in parallel when briefs touch different files.
- Reviews each builder's work against the brief's acceptance check, then merges or sends it back.
- Sends Fable a short summary (under 150 words): what shipped, what failed, what needs a decision.
- Escalates to Fable after two failed attempts on the same task.

### Sonnet (builder subagents)
- Each builder gets exactly one brief and does only that.
- Runs in its own git worktree (isolation is set in its agent definition).
- Touches only the files listed in the brief. If more files need to change, stop and report back.
- Runs the acceptance check before reporting done.
- Reports in this format: files changed, acceptance check result, anything surprising.

## Flow of work

1. Fable reads `PLAN.md` and picks the next milestone(s).
2. Fable spawns the relevant Opus managers in the background, one per area, each with the milestone and its area scope.
3. Each manager writes briefs, then spawns Sonnet builders (background, worktree-isolated) for them.
4. Builders report to their manager. The manager reviews, merges approved work, and re-briefs or fixes the rest.
5. Each manager sends Fable a short summary. Fable checks it against the milestone.
6. Fable updates `PLAN.md` and `DECISIONS.md`, sends the human a digest if anything needs a decision, and moves on.

## Spawning setup

This design needs nested subagents (Fable -> manager -> builder), which means a spawn depth of 2. Put this in `.claude/settings.json`:

```json
{
  "env": {
    "CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH": "2",
    "CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS": "10"
  }
}
```

Fallback if nesting is not available in this version (the depth setting has no effect, or managers cannot spawn): Fable spawns the builders directly from the managers' briefs, and managers only plan and review. Everything else stays the same. Fable should test nesting once at the start of the project with a trivial task and record the result in `DECISIONS.md`.

Check the exact agent frontmatter field names (`isolation`, `background`, `tools`) against the current Claude Code docs or `/agents` before relying on them.

## Optional: agent teams for long-running areas

Subagents are the default because they are cheaper and simpler. If one area needs a long-lived session that talks to other areas directly (for example, frontend and backend agreeing on an API contract while both keep working), Fable may run that area as an agent-teams teammate instead. This is experimental and needs `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`. Teams use more tokens, so only switch an area over when subagent summaries are clearly not enough, and log the switch in `DECISIONS.md`.

## Shared files (the team's memory)

Agents read these instead of passing long chat history.

- `PLAN.md`: product goals, milestones, current status. Fable owns it.
- `DECISIONS.md`: every settled decision with a one-line reason and date. Check it before asking the human anything.
- `.orchestration/briefs/<task-id>.md`: one brief per task.
- `.orchestration/reports/<task-id>.md`: builder report and manager verdict.

### Brief template

```
# Task <id>: <short title>
Owner: <manager>   Builder: sonnet
Goal: <one or two sentences>
Files you may touch: <explicit list>
Do not touch: <anything off limits>
Acceptance check: <test command, or exact behavior to verify>
If blocked: stop and report. Do not guess at scope changes.
```

## Escalation rules

Fable must ask the human before any of these:
- Changing product scope or dropping a planned feature
- Anything that spends money or adds a paid service or vendor
- Choosing or changing the core stack, database, or hosting
- Touching auth, user data, privacy, or security behavior
- Anything destructive or hard to undo (deleting data, force pushes, schema drops)
- A tradeoff where both options are reasonable and the choice changes the product

Everything else: Fable decides, logs it in `DECISIONS.md`, and keeps going.

Batch questions. Send the human one short digest at a natural stopping point, not a ping per question. Each question should state the options, a recommendation, and what is blocked until answered.

Managers and builders never contact the human. They escalate upward: builder to manager, manager to Fable, Fable to human.

## Guardrails

- Builders run in isolated worktrees on branches named `task/<id>`. Only the owning manager merges them.
- Two failed attempts on a task means it goes up a level. No third blind retry.
- No agent edits `PLAN.md` or `DECISIONS.md` except Fable.
- Never commit secrets. Never push to main without the human's approval.
- Prefer small tasks. If a brief needs more than about five files or an hour of work, split it.
- Respect the concurrency cap. Managers should queue builders instead of spawning more than the limit.

## Agent definitions

Save these in `.claude/agents/`.

`.claude/agents/manager.md`
```
---
name: manager
description: Owns one area of the app. Plans a milestone into small briefs, spawns builders, and reviews their work. Use for task breakdown, delegation, and review, not for writing features.
model: opus
background: true
tools: Agent, Read, Grep, Glob, Bash, Write, Edit
---
You are a manager on a three-tier team. Follow ORCHESTRATION.md.
Break the assigned milestone into small tasks and write one brief each using the brief template.
Spawn one builder subagent per brief and run independent ones in parallel.
When builders report back, compare their output to the brief's acceptance check. Merge approved work, send the rest back, and escalate to the orchestrator after two failures on the same task.
Reply to the orchestrator in under 150 words. Never contact the human.
```

`.claude/agents/builder.md`
```
---
name: builder
description: Implements exactly one scoped task from a brief, in an isolated worktree. Use for small, well-defined coding tasks.
model: sonnet
background: true
isolation: worktree
tools: Read, Grep, Glob, Bash, Write, Edit
---
You are a builder. Follow ORCHESTRATION.md.
Read your brief, touch only the files it allows, run the acceptance check, and report in the required format.
If the brief is unclear or needs more files, stop and report instead of guessing.
```

## Starting a session

1. Run the main session on Fable (`/model`).
2. Confirm `.claude/settings.json` has the spawn depth settings above.
3. Fill in the project section of `PLAN.md` (app goal, target users, first milestones).
4. Tell Fable: "Read ORCHESTRATION.md and PLAN.md, test that nested spawning works, then start the next milestone."
