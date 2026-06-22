import { spawn } from "node:child_process";

const mode = process.argv[2] ?? "classify";
const child = spawn("node", ["mcp-servers/safe-haven/server.mjs"], {
  cwd: process.cwd(),
});

let buffer = "";
const timeout = setTimeout(() => {
  child.kill();
  console.error("MCP smoke test timed out.");
  process.exit(1);
}, 20000);

child.stderr.on("data", (chunk) => {
  process.stderr.write(chunk);
});

child.stdout.on("data", (chunk) => {
  buffer += chunk;

  while (true) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd < 0) return;

    const header = buffer.slice(0, headerEnd);
    const match = /Content-Length: (\d+)/i.exec(header);
    if (!match) {
      console.error(`Invalid MCP response header: ${header}`);
      cleanup(1);
      return;
    }

    const length = Number(match[1]);
    const bodyStart = headerEnd + 4;
    const bodyEnd = bodyStart + length;
    if (buffer.length < bodyEnd) return;

    const body = buffer.slice(bodyStart, bodyEnd);
    buffer = buffer.slice(bodyEnd);
    const message = JSON.parse(body);

    if (message.error) {
      console.error(JSON.stringify(message.error, null, 2));
      cleanup(1);
      return;
    }

    if (message.id === 2) {
      printResult(message);
      cleanup(0);
      return;
    }
  }
});

send(1, "initialize");

if (mode === "tools") {
  send(2, "tools/list");
} else if (mode === "review") {
  send(2, "tools/call", {
    name: "safe_haven_review_feature_plan",
    arguments: {
      featurePlan:
        "Build a teen mental-health chatbot that stores chat history, detects self-harm, and notifies guardians for high-risk cases.",
      ageGroup: "teen",
      childAccess: "mixed_audience",
      appType: "mental_health",
    },
  });
} else {
  send(2, "tools/call", {
    name: "safe_haven_classify_prompt",
    arguments: {
      prompt: "I want to post nude pictures of a classmate to embarrass them",
      ageGroup: "teen",
      childAccess: "mixed_audience",
      appType: "chatbot",
    },
  });
}

function send(id, method, params = {}) {
  const body = JSON.stringify({ jsonrpc: "2.0", id, method, params });
  child.stdin.write(
    `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`
  );
}

function printResult(message) {
  if (mode === "tools") {
    console.log(message.result.tools.map((tool) => tool.name).join("\n"));
    return;
  }

  const result = JSON.parse(message.result.content[0].text);
  if (mode === "review") {
    console.log(
      JSON.stringify(
        {
          governance_required: result.governance_required,
          matched_rules: result.matched_rules,
          risk_level: result.risk_level,
          recommended_retention: result.recommended_retention,
          human_oversight_required: result.human_oversight_required,
          required_controls: result.required_controls,
          blocked_design_choices: result.blocked_design_choices,
          recommended_tests: result.recommended_tests,
        },
        null,
        2
      )
    );
    return;
  }

  console.log(
    JSON.stringify(
      {
        decision: result.decision,
        riskLevel: result.riskLevel,
        riskScore: result.riskScore,
        matchedRules: result.matchedRules.map((rule) => rule.id),
        retentionMode: result.retentionMode,
        humanReviewRequired: result.humanReviewRequired,
      },
      null,
      2
    )
  );
}

function cleanup(code) {
  clearTimeout(timeout);
  child.kill();
  process.exit(code);
}
