# Orchestration plan (Opus / Sonnet / Haiku)

A tiered agent team for any project. Opus plans and decides, Sonnet leads and builds, Sonnet validators check the work independently, Haiku handles trivial mechanical batches. The human is the final authority and is only pulled in for important decisions.

```
Human <-> Opus orchestrator -> Sonnet lead -> Sonnet builders
                                           -> Sonnet validators (independent)
                                           -> Haiku quick agents
                            -> Opus expert (hard tasks only)
```

## Roles

### Opus orchestrator (main session)
- Owns the product plan, architecture, milestones, and the final call on whether a milestone is done.
- The only agent that talks to the human.
- Has NO Write or Edit tools. It reads, reasons, decides, and delegates. It never edits files and never uses Bash tricks to write files either.
- Sends the lead a milestone and scope. Reads the lead's short summaries, not raw diffs, unless the lead flags a problem.
- Takes on very hard tasks (tricky algorithms, deep debugging, gnarly architecture) by spawning an `expert` agent (Opus, in a worktree) instead of doing the work itself.
- When PLAN.md or DECISIONS.md need updating, tells the lead exactly what to write.

### Sonnet lead
- Breaks a milestone into small tasks and writes one brief per task into `.orchestration/briefs/`.
- Spawns builders (one per brief, in parallel when briefs touch different files), then spawns an independent validator for each finished builder branch.
- Uses Haiku quick agents only for batches of mechanical work (see "When to use Haiku").
- Merges a branch only after its validator says PASS. Re-briefs or fixes anything that fails.
- Writes the report files, and updates PLAN.md and DECISIONS.md when the orchestrator says to.
- Sends Opus a summary under 150 words: what shipped, what failed validation, what needs a decision.
- Escalates to Opus after two failed attempts on the same task.
- Does not write feature code itself. Tiny glue changes are fine.

### Sonnet builder
- Gets exactly one brief and does only that. Runs in its own git worktree on branch `task/<id>`.
- Touches only the files in the brief. If more files need to change, stop and report.
- Runs the acceptance check before reporting done.
- Reports in its final message (not in a committed file): files changed, acceptance check result, anything surprising.

### Sonnet validator
- Independent from the builder. It gets the brief and the branch name, and nothing else. It never sees the builder's report or reasoning.
- Checks: acceptance check passes, only allowed files were touched, tests, lint and type checks if the project has them, and a read of the diff against the brief's goal.
- Does not fix anything and does not edit source files. It only reports PASS or FAIL with evidence.
- Writes its verdict to `.orchestration/reports/<id>-validation.md` in the main checkout.

### Haiku quick agent
- For very simple, fully specified, mechanical work. Runs in a worktree on branch `task/<id>`.
- If any judgment call is needed, stops and reports. It never guesses.
- Its output goes through a validator like everyone else's.

### Opus expert
- A builder with Opus brainpower, spawned by the orchestrator for the genuinely hard tasks.
- Same rules as a builder: one brief, listed files only, own worktree, acceptance check, report.
- Its work is still validated by a Sonnet validator.

## When to use Haiku (and when not to)

Spawning an agent has overhead: a brief, a context load, a report. Use Haiku when that overhead is worth it:
- Good: the same mechanical change across many files (rename, import path update, formatting), boilerplate from a clear template, running a test suite and summarizing failures, doc and comment touch-ups.
- Not worth it: a one-line change, anything needing judgment, anything touching auth, data, or security. The lead just does tiny stuff inline.

## Flow of work

1. Opus reads `PLAN.md` and picks the next milestone. (First time in a project: run the nesting test below.)
2. Opus spawns the lead in the background with the milestone and scope, then keeps planning. Hard tasks go to an `expert` instead.
3. The lead writes briefs, then spawns builders (and Haiku agents for mechanical batches).
4. When a builder reports, the lead spawns a validator for that branch.
5. On PASS the lead merges. On FAIL the lead re-briefs the builder. Two failures on a task go up to Opus.
6. The lead sends Opus a short summary. Opus checks it against the milestone.
7. Opus tells the lead what to record in `PLAN.md` and `DECISIONS.md`, sends the human a digest if anything needs a decision, and moves on.

## Spawning setup and the nesting test

This design needs a spawn depth of 2: Opus (depth 0) spawns the lead (depth 1), and the lead spawns builders, validators, and Haiku agents (depth 2). Put this in `~/.claude/settings.json` (merge it with what is already there):

```json
{
  "env": {
    "CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH": "2",
    "CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS": "10"
  }
}
```

Nesting test, run once at the start of each new setup: spawn a `lead`, and have it spawn one `quick` agent to echo a short string. If the string comes back, nesting works. If the lead says it cannot spawn agents, or the depth setting has no effect, use the fallback. Record the result in `DECISIONS.md`.

Fallback (flat spawning): the lead only plans and reviews. It writes the briefs and tells Opus which agents to spawn. Opus spawns the builders, validators, and Haiku agents itself (all depth 1) and hands their results back to the lead to review and merge. To allow this, edit `~/.claude/agents/orchestrator.md` and change its `tools` line from `Agent(lead, expert)` to `Agent`. Everything else stays the same.

Concurrency: the cap counts every running agent, validators included. The lead queues work instead of spawning past the limit.

Checked against the Claude Code subagent docs (Nov 2026):
- The frontmatter fields used here (`name`, `description`, `tools`, `model`, `background`, `isolation: worktree`) are all valid, and unknown fields are ignored without an error.
- Subagents can spawn subagents. The default already allows three layers below the main session. Setting the depth to 2 caps it at exactly what this design needs. A value of 1 turns nesting off.
- Running the main session with `--agent orchestrator` applies that agent's tool restrictions and model to the main session, so Opus really has no Write or Edit. Its prompt replaces the default Claude Code system prompt, and CLAUDE.md still loads.
- `tools: Agent(lead, expert)` limits the orchestrator to spawning only those two types. This only works for an agent running as the main session.
- `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` was not in the part of the docs I could read. If it does nothing, the lead's own queueing rule still applies.

The `/agents` wizard is gone in newer versions, so verify the install this way instead:
- Run `claude plugin validate ~/.claude/agents` (needs v2.1.233 or later). It reports any frontmatter that does not parse.
- Restart Claude Code if `~/.claude/agents` did not exist before you installed.
- Run `/doctor` to catch duplicate agent names.
- Run `claude --debug` and search the debug log for `does not recognize or apply` to find misspelled fields.

## Shared files (the team's memory)

Agents read these instead of passing long chat history.

- `PLAN.md`: product goals, milestones, current status.
- `DECISIONS.md`: every settled decision with a one-line reason and date. Check it before asking the human anything.
- `.orchestration/briefs/<task-id>.md`: one brief per task.
- `.orchestration/reports/<task-id>.md`: builder report and lead verdict (written by the lead).
- `.orchestration/reports/<task-id>-validation.md`: validator verdict.

Only the lead edits PLAN.md and DECISIONS.md, and only at Opus's direction.

### Brief template

```
# Task <id>: <short title>
Owner: lead   Builder: sonnet | haiku | opus-expert
Goal: <one or two sentences>
Files you may touch: <explicit list>
Do not touch: <anything off limits>
Acceptance check: <test command, or exact behavior to verify>
Validator should also check: <anything extra, or "standard checks">
If blocked: stop and report. Do not guess at scope changes.
```

### Validation verdict format

```
# Validation <id>: PASS | FAIL
Checks run: <list with results>
Files touched vs allowed: <ok, or the extras>
Problems: <specific, with file and line when possible, or "none">
```

## Escalation rules

Opus must ask the human before any of these:
- Changing product scope or dropping a planned feature
- Anything that spends money or adds a paid service or vendor
- Choosing or changing the core stack, database, or hosting
- Touching auth, user data, privacy, or security behavior
- Anything destructive or hard to undo (deleting data, force pushes, schema drops)
- A tradeoff where both options are reasonable and the choice changes the product

Everything else: Opus decides, has the lead log it in `DECISIONS.md`, and keeps going.

Batch questions. Send the human one short digest at a natural stopping point, not a ping per question. Each question should state the options, a recommendation, and what is blocked until answered.

Nobody below Opus contacts the human. Escalation goes up one level at a time: builder or validator to lead, lead to Opus, Opus to human.

## Guardrails

- Builders and Haiku agents work on branches named `task/<id>` in isolated worktrees. Only the lead merges, and only after a validator PASS.
- Two failed attempts on a task means it goes up a level. No third blind retry.
- Validators never edit source and never see the builder's reasoning.
- No agent edits `PLAN.md` or `DECISIONS.md` except the lead, at Opus's direction.
- Never commit secrets. Never push to main without the human's approval.
- Prefer small tasks. If a brief needs more than about five files or an hour of work, split it.
- Respect the concurrency cap.

## When to use this at all

Orchestration has overhead. Use it for milestones that touch roughly 4 or more files or have several independent parts. For small fixes and quick questions, a normal single session is faster and cheaper.

It only turns on when the session is started with `claude --agent orchestrator`. A plain `claude` session never self-triggers it. Even inside an orchestrator session, the orchestrator answers non-coding questions directly and points small changes back to a normal session.

## Install

1. Copy the agent files from `agents/` into `~/.claude/agents/`.
2. Copy this file to `~/.claude/ORCHESTRATION.md`.
3. Merge `settings.snippet.json` into `~/.claude/settings.json`.
4. In each project, add the lines from `CLAUDE.snippet.md` to that project's `CLAUDE.md`, and create `PLAN.md`, `DECISIONS.md`, and `.orchestration/briefs/` and `.orchestration/reports/`.
5. Verify the install with `claude plugin validate ~/.claude/agents`.
6. Start an orchestrated session with `claude --agent orchestrator`. A plain `claude` session stays a normal session, so small tasks do not pay the overhead.
7. Tell Opus: "Read ~/.claude/ORCHESTRATION.md and PLAN.md, run the nesting test, then start the next milestone."
