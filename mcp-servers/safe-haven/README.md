# Safe Haven MCP Server

Safe Haven exposes its child-safety governance layer as a portable Model Context
Protocol server. Any MCP-capable developer tool can launch this server and use
the same locked rules, context policy, audit trail, and evaluation helpers that
power the dashboard.

## Run

From the repository root:

```sh
npm install
npm run mcp:safe-haven
```

The server communicates over stdio. It is intended to be launched by an MCP
client, not opened in a browser.

## OpenCode Configuration

`opencode.json` includes:

```json
{
  "mcp": {
    "safe-haven": {
      "type": "local",
      "command": ["npm", "run", "mcp:safe-haven"],
      "enabled": true
    }
  }
}
```

For another MCP client, use the same command:

```sh
npm run mcp:safe-haven
```

or the direct Node entrypoint:

```sh
node mcp-servers/safe-haven/server.mjs
```

## Tools

### `safe_haven_classify_prompt`

Runs the Safe Haven decision tree for a prompt. It returns:

- selected context policy
- matched locked/custom rules
- risk score and risk level
- final action
- retention mode
- human-review requirement
- source-backed explanation
- metadata-only audit event

The tool does not store full prompt text by default. If `appendAudit` is true,
it appends a metadata-only governance entry to
`audit-trail/decisions.jsonl`, including a prompt hash instead of the full
conversation.

### `safe_haven_review_feature_plan`

Reviews a proposed AI/chat feature before implementation. This is the primary
Copilot guardrail tool. It returns whether governance is required, matched
locked rules, risk level, required controls, blocked design choices, recommended
tests, retention guidance, and a Copilot instruction.

Example feature:

```text
Build a teen mental-health chatbot that stores chat history, detects self-harm,
and notifies guardians for high-risk cases.
```

Expected governance themes:

- child-safe defaults
- self-harm escalation
- metadata-only or redacted-excerpt retention
- proportional guardian notification
- audit trail entries
- high-risk and false-positive tests

### `safe_haven_review_code_diff`

Reviews a patch for missing child-safe defaults, audit events, retention
controls, escalation thresholds, and tests.

### `safe_haven_review_retention_policy`

Reviews a logging, analytics, training-data, or chat-history policy. It warns
against full child conversation retention by default and recommends minimization
controls.

### `safe_haven_generate_required_tests`

Generates test cases for the matched rules or proposed feature.

### `safe_haven_generate_audit_finding`

Creates a metadata-only audit finding for a developer governance decision. It
can append the finding to `audit-trail/decisions.jsonl` when `appendAudit` is
true.

### `safe_haven_list_locked_rules`

Returns the 16 locked source-backed rules, including UNICEF, UNICEF Innocenti,
UNESCO, AESIA, and model-card references.

### `safe_haven_validate_audit_trail`

Validates `audit-trail/decisions.jsonl` for required paper-trail fields and
checks MCP-added hash-chain fields when present.

### `safe_haven_summarize_audit_trail`

Returns a metadata-only summary suitable for a human-readable governance report.

### `safe_haven_evaluate_jsonl`

Evaluates a local JSONL dataset with `prompt` and `is_safe` fields. It returns a
confusion matrix, precision, recall, F1, false-positive rate, and
false-negative rate.

## Resources

- `safe-haven://rules/locked`
- `safe-haven://audit/summary`
- `safe-haven://docs/architecture`

## Governance Defaults

- Child-directed and mixed-audience services use child-safe defaults.
- Unknown age is context, not harm evidence by itself.
- High-risk or rights-sensitive outcomes require human oversight.
- Prompt content is minimized; audit entries use hashes by default.
- External semantic or LLM signals can be passed in, but final action remains
  controlled by the locked decision tree.
