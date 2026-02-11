export const START_WORK_TEMPLATE = `You are starting a Sisyphus work session.

## WHAT TO DO

1. **Detect tracking provider**: Check the oh-my-opencode config for \`ralph_loop.tracking_provider\`
   - If \`"linear"\` or \`"auto"\` with Linear MCP available + \`ralph_loop.linear.team_id\` configured:
     - Use **Linear mode** (see LINEAR WORKFLOW below)
   - Otherwise:
     - Use **Markdown mode** (see MARKDOWN WORKFLOW below)

---

## MARKDOWN WORKFLOW (default)

1. **Find available plans**: Search for Prometheus-generated plan files at \`.sisyphus/plans/\`

2. **Check for active boulder state**: Read \`.sisyphus/boulder.json\` if it exists

3. **Decision logic**:
   - If \`.sisyphus/boulder.json\` exists AND plan is NOT complete (has unchecked boxes):
     - **APPEND** current session to session_ids
     - Continue work on existing plan
   - If no active plan OR plan is complete:
     - List available plan files
     - If ONE plan: auto-select it
     - If MULTIPLE plans: show list with timestamps, ask user to select

4. **Create/Update boulder.json**:
   \`\`\`json
   {
     "active_plan": "/absolute/path/to/plan.md",
     "started_at": "ISO_TIMESTAMP",
     "session_ids": ["session_id_1", "session_id_2"],
     "plan_name": "plan-name"
   }
   \`\`\`

5. **Read the plan file** and start executing tasks according to atlas workflow

---

## LINEAR WORKFLOW

1. **Find active Linear issues**: Search for issues with label \`ralph-loop\` or your configured label prefix
   - Use Linear MCP tool: \`search_issues\` with label filter

2. **Check for active boulder state**: Read \`.sisyphus/boulder.json\` if it exists (shadow cache)

3. **Decision logic**:
   - If active Linear issue exists with incomplete sub-issues:
     - Continue work on existing issue
   - If no active issue:
     - List available Linear issues from the configured team
     - Ask user to select or create a new plan

4. **Update tracking state**:
   - Update Linear issue state to "In Progress" via \`update_issue\`
   - Update local \`.sisyphus/boulder.json\` shadow cache

5. **Read sub-issues** and start executing tasks
   - Each sub-issue = one task from the plan
   - Mark sub-issues as "Done" via \`update_issue\` when completed
   - Check parent issue completion after each sub-task

---

## OUTPUT FORMAT

When listing plans for selection:
\`\`\`
Available Work Plans

Current Time: {ISO timestamp}
Session ID: {current session id}
Provider: {markdown | linear}

1. [plan-name-1] - Progress: 3/10 tasks
2. [plan-name-2] - Progress: 0/5 tasks

Which plan would you like to work on? (Enter number or plan name)
\`\`\`

When resuming existing work:
\`\`\`
Resuming Work Session

Active Plan: {plan-name}
Provider: {markdown | linear}
Progress: {completed}/{total} tasks
Sessions: {count} (appending current session)

Reading plan and continuing from last incomplete task...
\`\`\`

## CRITICAL

- The session_id is injected by the hook - use it directly
- Always update boulder.json BEFORE starting work
- Read the FULL plan before delegating any tasks
- Follow atlas delegation protocols (7-section format)
- When using Linear mode, always update the shadow cache alongside Linear API calls`
