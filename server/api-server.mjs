import { createServer } from "node:http";

const PORT = Number(process.env.PORT ?? 8787);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";

const RULE_IDS = new Set([
  "R1",
  "R2",
  "R3",
  "R4",
  "R5",
  "R6",
  "R7",
  "R8",
  "R9",
  "R10",
  "R11",
  "R12",
  "R13",
  "R14",
  "R15",
]);

const server = createServer(async (request, response) => {
  setCorsHeaders(response);
  const pathname = new URL(request.url ?? "/", `http://${request.headers.host}`).pathname;

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (pathname === "/api/health" && request.method === "GET") {
    sendJson(response, 200, {
      ok: true,
      provider: GEMINI_API_KEY ? "gemini" : "local_fallback",
      model: GEMINI_API_KEY ? GEMINI_MODEL : "local-semantic-fallback",
    });
    return;
  }

  if (pathname === "/" && request.method === "GET") {
    sendJson(response, 200, {
      service: "Safe Haven API",
      routes: ["GET /api/health", "POST /api/classify-context"],
    });
    return;
  }

  if (pathname !== "/api/classify-context" || request.method !== "POST") {
    sendJson(response, 404, { error: "Not found" });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const prompt = String(body.prompt ?? "").trim();
    const context = body.context ?? {};

    if (!prompt) {
      sendJson(response, 400, { error: "Missing prompt" });
      return;
    }

    const result = await classifyContext(prompt, context);
    const signals = sanitizeSignals(result.signals);

    console.log(
      JSON.stringify(
        {
          event: "context_extraction",
          provider: result.provider,
          model: result.model,
          promptPreview: summarize(prompt),
          context,
          signals,
        },
        null,
        2
      )
    );

    sendJson(response, 200, {
      ...result,
      signals,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(
      JSON.stringify(
        {
          event: "context_extraction_error",
          error: message,
        },
        null,
        2
      )
    );
    sendJson(response, 500, {
      provider: "server_error",
      model: "none",
      signals: [],
      error: message,
    });
  }
});

server.listen(PORT, () => {
  console.log(`Safe Haven API listening on http://localhost:${PORT}`);
  console.log(
    GEMINI_API_KEY
      ? `Gemini context extraction enabled with ${GEMINI_MODEL}.`
      : "GEMINI_API_KEY not set. Using local fallback signals only."
  );
});

async function classifyContext(prompt, context) {
  if (!GEMINI_API_KEY) {
    return {
      provider: "local_fallback",
      model: "local-semantic-fallback",
      signals: fallbackSignals(prompt, context),
    };
  }

  try {
    return await classifyWithGemini(prompt, context);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Gemini error";

    console.error(
      JSON.stringify(
        {
          event: "gemini_context_extraction_error",
          model: GEMINI_MODEL,
          error: message,
        },
        null,
        2
      )
    );

    return {
      provider: "gemini_error_fallback",
      model: "local-semantic-fallback",
      upstreamModel: GEMINI_MODEL,
      backendNote: summarizeProviderError(message),
      signals: fallbackSignals(prompt, context),
    };
  }
}

function summarizeProviderError(message) {
  if (message.includes("429") || message.includes("RESOURCE_EXHAUSTED")) {
    const retryDelay = message.match(/retryDelay\"?\s*:\s*\"?([0-9.]+s)\"?/)?.[1];
    return `Gemini quota or rate limit was reached.${
      retryDelay ? ` Retry after about ${retryDelay}.` : ""
    } Local fallback signals were used.`;
  }

  if (message.includes("400") || message.includes("INVALID_ARGUMENT")) {
    return "Gemini rejected the request format. Local fallback signals were used.";
  }

  if (message.includes("403") || message.includes("PERMISSION_DENIED")) {
    return "Gemini API key or project permissions were rejected. Local fallback signals were used.";
  }

  if (message.includes("404") || message.includes("NOT_FOUND")) {
    return "Gemini model or endpoint was not found. Local fallback signals were used.";
  }

  return "Gemini context extraction failed. Local fallback signals were used.";
}

async function classifyWithGemini(prompt, context) {
  const schema = {
    type: "object",
    properties: {
      signals: {
        type: "array",
        maxItems: 6,
        items: {
          type: "object",
          properties: {
            ruleId: {
              type: "string",
              enum: Array.from(RULE_IDS),
            },
            label: {
              type: "string",
              maxLength: 90,
            },
            confidence: {
              type: "number",
              minimum: 0,
              maximum: 1,
            },
            evidence: {
              type: "string",
              maxLength: 180,
            },
            rationale: {
              type: "string",
              maxLength: 240,
            },
          },
          required: ["ruleId", "label", "confidence", "evidence", "rationale"],
        },
      },
    },
    required: ["signals"],
  };
  const extractionPrompt = JSON.stringify({
    system:
      "You extract child-safety context signals for a governance decision tree. Do not decide the final action. Return only rule-level signals supported by the prompt. Prefer no signal when evidence is weak. In child, teen, mixed-audience, unknown-age, or child-directed contexts, questions about sexual activity, sexual boundaries, pornography, nude images, or graphic sexual content should usually map to R7 unless they clearly concern non-explicit safety education. If nude or sexual images may involve a minor or school peer, map to R1 and R3 as applicable.",
    task:
      "Map the prompt to applicable Safe Haven locked rule signals. Return concise evidence and rationale.",
    prompt,
    context,
    rules: {
      R1: "Child sexual exploitation, abuse, or suspected sexual images of minors.",
      R2: "Grooming, coercion, secrecy pressure, sextortion, or private-image pressure.",
      R3: "Non-consensual intimate images, leaks, threats, or image-based abuse.",
      R4: "Cyberbullying, peer harassment, humiliation, threats, or peer violence.",
      R5: "Self-harm, suicidal ideation, or severe distress.",
      R6: "Abuse, neglect, trafficking, exploitation, or unsafe home/adult authority concern.",
      R7: "Age-inappropriate sexual, pornographic, graphic, or violent content in child-safe contexts.",
      R8: "Hate, discrimination, or identity-based abuse.",
      R9: "Privacy, personal data, location, credentials, or doxxing.",
      R10: "Manipulative design or exploitative marketing.",
      R11: "Economic exploitation or digital child labour.",
      R12: "Violent recruitment, gangs, criminal networks, or exploitation.",
      R13: "Weapons, explosives, or severe physical danger.",
      R14: "Unsafe advice, harmful misinformation, or harmful intent toward animals/people.",
      R15: "Governance, audit, retention, silent escalation, or human oversight concern.",
    },
  });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      GEMINI_MODEL
    )}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: extractionPrompt }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema,
        },
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini context extraction failed: ${response.status} ${text}`);
  }

  const payload = await response.json();
  const outputText = extractGeminiOutputText(payload);
  const parsed = JSON.parse(outputText);

  return {
    provider: "gemini",
    model: GEMINI_MODEL,
    signals: parsed.signals ?? [],
  };
}

function fallbackSignals(prompt, context) {
  const text = prompt.toLowerCase();
  const signals = [];
  const childContext =
    ["child", "teen", "unknown"].includes(context.ageGroup) ||
    ["child_directed", "mixed_audience", "unknown"].includes(context.childAccess);

  if (
    /\b(sex|sexual|consensual sex|sleep with|hook up with)\b.*\b(1[0-7][ -]?(year[ -]?old|yo|y\/o)|minor|underage|child|kid|teen|teenager)\b/.test(
      text
    ) ||
    /\b(1[0-7][ -]?(year[ -]?old|yo|y\/o)|minor|underage|child|kid|teen|teenager)\b.*\b(sex|sexual|consensual sex|sleep with|hook up with)\b/.test(
      text
    )
  ) {
    signals.push(signal("R1", "Possible child sexual exploitation", 0.95, prompt));
  }

  if (
    childContext &&
    /\b(kid|child|minor|underage|teen|classmate|student|school)\b/.test(text) &&
    /\bnude\s+(pic|pics|picture|pictures|photo|photos|image|images)\b/.test(text)
  ) {
    signals.push(signal("R1", "Possible child sexual image material", 0.9, prompt));
  }

  if (
    /\b(post|share|upload|leak|send)\b/.test(text) &&
    /\b(nude|private|intimate)\b/.test(text) &&
    /\b(pic|pics|picture|pictures|photo|photos|image|images)\b/.test(text)
  ) {
    signals.push(signal("R3", "Non-consensual intimate image sharing", 0.88, prompt));
  }

  if (
    /\b(bullied|bully|harass|mean kid|make them feel bad|embarrass|humiliate|rumors?)\b/.test(
      text
    ) ||
    /\b(they|he|she|someone|kids?|classmates?)\s+(kicked|punched|hit|slapped|shoved|pushed|attacked|threatened)\s+me\b/.test(
      text
    )
  ) {
    signals.push(signal("R4", "Peer harm, bullying, or retaliation", 0.78, prompt));
  }

  if (
    childContext &&
    /\b(sexual activity|sex act|porn|explicit sexual|nude|graphic sexual|sexual content)\b/.test(
      text
    )
  ) {
    signals.push(
      signal("R7", "Age-inappropriate sexual content in child-safe context", 0.82, prompt)
    );
  }

  if (
    /\b(sex trafficking|human trafficking|traffic(?:king)? people|forced prostitution|exploit people for money)\b/.test(
      text
    )
  ) {
    signals.push(signal("R6", "Trafficking or exploitation concern", 0.9, prompt));
  }

  return signals;
}

function signal(ruleId, label, confidence, prompt) {
  return {
    ruleId,
    label,
    source: "llm_backend",
    confidence,
    evidence: summarize(prompt),
    rationale:
      "The prompt contains contextual language that maps to this locked child-safety rule.",
  };
}

function sanitizeSignals(signals) {
  if (!Array.isArray(signals)) return [];

  return signals
    .filter((signal) => RULE_IDS.has(signal.ruleId))
    .map((signal) => ({
      ruleId: signal.ruleId,
      label: String(signal.label ?? signal.ruleId).slice(0, 90),
      source: "llm_backend",
      confidence: clamp(Number(signal.confidence ?? 0.5), 0, 1),
      evidence: summarize(String(signal.evidence ?? "")),
      rationale: String(signal.rationale ?? "AI context signal.").slice(0, 240),
    }));
}

function extractGeminiOutputText(payload) {
  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("");

  if (!text) {
    throw new Error(`Gemini response did not include text: ${JSON.stringify(payload)}`);
  }

  return text;
}

async function readJsonBody(request) {
  let raw = "";

  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 20_000) throw new Error("Request body too large");
  }

  return JSON.parse(raw || "{}");
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload));
}

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function summarize(text) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length <= 180 ? normalized : `${normalized.slice(0, 177)}...`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
