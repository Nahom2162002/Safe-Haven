import {
  LOCKED_GUIDELINES,
  childSafetyDecision,
  type AgeGroup,
  type DecisionResult,
  type InputType,
  type RetentionMode,
  type RuleDefinition,
  type ServiceChildAccess,
  type ServiceContext,
} from "../lib/decisionEngine";
import {
  PROMPT_RUBRIC,
  evaluateRubricResult,
  type PromptRubricCase,
  type PromptTestContext,
  type RubricEvaluation,
} from "./promptRubric";
import "./styles.css";

type CustomRule = RuleDefinition & {
  id: `CUSTOM_${string}`;
  locked: false;
};

type RuleFilter = "all" | "locked" | "custom" | "enabled" | "disabled";

const STORAGE_KEY = "safe-haven-custom-rules";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app root element.");
}

let customRules = loadCustomRules();
let activeFilter: RuleFilter = "all";
let searchTerm = "";
let pendingDeleteRuleId: CustomRule["id"] | null = null;

app.innerHTML = `
  <main class="dashboard-shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">Safe Haven</p>
        <h1>Rules Dashboard</h1>
      </div>
      <div class="summary-strip" aria-label="Rule summary">
        <div>
          <span data-count="locked">0</span>
          <small>Locked</small>
        </div>
        <div>
          <span data-count="custom">0</span>
          <small>Custom</small>
        </div>
        <div>
          <span data-count="enabled">0</span>
          <small>Enabled</small>
        </div>
      </div>
    </header>

    <section class="workspace">
      <aside class="rule-composer" aria-labelledby="add-rule-title">
        <h2 id="add-rule-title">Add Rule</h2>
        <form id="ruleForm">
          <label>
            Rule name
            <input
              id="ruleName"
              name="ruleName"
              type="text"
              maxlength="80"
              placeholder="Example: Limit late-night chat"
              required
            />
          </label>

          <label>
            Category
            <input
              id="ruleCategory"
              name="ruleCategory"
              type="text"
              maxlength="48"
              placeholder="wellbeing"
              required
            />
          </label>

          <label>
            Risk level
            <select id="ruleRisk" name="ruleRisk">
              <option value="low">Low</option>
              <option value="medium" selected>Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </label>

          <label>
            Description
            <textarea
              id="ruleDescription"
              name="ruleDescription"
              rows="5"
              maxlength="220"
              placeholder="What should this rule catch or guide?"
              required
            ></textarea>
          </label>

          <button class="primary-action" type="submit">
            <span aria-hidden="true">+</span>
            Add rule
          </button>
        </form>
      </aside>

      <section class="rules-panel" aria-label="Rules">
        <div class="panel-toolbar">
          <div class="tabs" role="tablist" aria-label="Rule filters">
            <button class="tab is-active" type="button" data-filter="all">All</button>
            <button class="tab" type="button" data-filter="locked">Locked</button>
            <button class="tab" type="button" data-filter="custom">Custom</button>
            <button class="tab" type="button" data-filter="enabled">Enabled</button>
            <button class="tab" type="button" data-filter="disabled">Disabled</button>
          </div>
          <label class="search">
            <span aria-hidden="true">⌕</span>
            <input id="ruleSearch" type="search" placeholder="Search rules" />
          </label>
        </div>

        <div id="rulesList" class="rules-list" aria-live="polite"></div>
      </section>
    </section>

    <section class="prompt-tester" aria-labelledby="prompt-tester-title">
      <div class="prompt-tester-header">
        <div>
          <p class="eyebrow">Prompt Tester</p>
          <h2 id="prompt-tester-title">Chatbot Rule Check</h2>
        </div>
        <label class="rubric-picker">
          Rubric case
          <select id="rubricCase">
            <option value="">Freeform prompt</option>
          </select>
        </label>
      </div>

      <div class="chatbot-grid">
        <form id="promptForm" class="prompt-form">
          <label>
            Message prompt
            <textarea
              id="promptText"
              name="promptText"
              rows="6"
              maxlength="1200"
              placeholder="Paste a user message, AI response, or developer setting to test against the dashboard rules."
              required
            ></textarea>
          </label>

          <div class="context-grid">
            <label>
              Input type
              <select id="inputType" name="inputType">
                <option value="user_message">User message</option>
                <option value="ai_output">AI output</option>
                <option value="developer_setting">Developer setting</option>
                <option value="guardian_setting">Guardian setting</option>
              </select>
            </label>

            <label>
              Age group
              <select id="ageGroup" name="ageGroup">
                <option value="teen">Teen</option>
                <option value="child">Child</option>
                <option value="unknown">Unknown</option>
                <option value="verified_adult">Verified adult</option>
              </select>
            </label>

            <label>
              Vulnerability
              <select id="vulnerability" name="vulnerability">
                <option value="none">None</option>
                <option value="moderate">Moderate</option>
                <option value="high">High</option>
              </select>
            </label>

            <label>
              Child access
              <select id="childAccess" name="childAccess">
                <option value="mixed_audience">Mixed audience</option>
                <option value="child_directed">Child directed</option>
                <option value="unknown">Unknown</option>
                <option value="verified_adult_only">Verified adult only</option>
              </select>
            </label>

            <label>
              App type
              <select id="appType" name="appType">
                <option value="chatbot">Chatbot</option>
                <option value="education">Education</option>
                <option value="social">Social</option>
                <option value="gaming">Gaming</option>
                <option value="mental_health">Mental health</option>
                <option value="adult_platform">Adult platform</option>
                <option value="general">General</option>
              </select>
            </label>

            <label>
              Requested retention
              <select id="requestedRetention" name="requestedRetention">
                <option value="">None</option>
                <option value="NO_CONTENT">No content</option>
                <option value="METADATA_ONLY">Metadata only</option>
                <option value="REDACTED_EXCERPT">Redacted excerpt</option>
                <option value="FULL_CONTENT_REQUIRES_JUSTIFICATION">Full content requires justification</option>
              </select>
            </label>
          </div>

          <fieldset class="flag-grid" aria-label="Prompt flags">
            <label>
              <input id="imminentRisk" type="checkbox" />
              Imminent risk
            </label>
            <label>
              <input id="repeatedAttempts" type="checkbox" />
              Repeated attempts
            </label>
            <label>
              <input id="involvesTrustedAdult" type="checkbox" />
              Trusted adult involved
            </label>
            <label>
              <input id="involvesPrivateImages" type="checkbox" />
              Private images
            </label>
            <label>
              <input id="involvesLocationOrPII" type="checkbox" />
              Location or PII
            </label>
            <label>
              <input id="couldEnableHarm" type="checkbox" />
              Could enable harm
            </label>
          </fieldset>

          <div class="tester-actions">
            <button class="primary-action" type="submit">Run check</button>
            <button class="secondary-action" type="button" id="runRubric">
              Run rubric suite
            </button>
          </div>
        </form>

        <section class="chatbot-output" aria-live="polite" aria-label="Chatbot output">
          <div id="chatbotResult" class="chatbot-empty">
            Run a prompt to see the decision, matched rules, and rubric checks.
          </div>
        </section>
      </div>
    </section>
  </main>

  <div class="modal-backdrop" id="deleteModal" hidden>
    <section
      class="confirm-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deleteModalTitle"
      aria-describedby="deleteModalText"
    >
      <div>
        <p class="modal-kicker">Delete rule</p>
        <h2 id="deleteModalTitle">Delete this rule?</h2>
        <p id="deleteModalText"></p>
      </div>
      <div class="modal-actions">
        <button class="secondary-action" type="button" id="cancelDelete">
          Cancel
        </button>
        <button class="danger-action" type="button" id="confirmDelete">
          Delete rule
        </button>
      </div>
    </section>
  </div>
`;

const form = getElement<HTMLFormElement>("#ruleForm");
const ruleName = getElement<HTMLInputElement>("#ruleName");
const ruleCategory = getElement<HTMLInputElement>("#ruleCategory");
const ruleRisk = getElement<HTMLSelectElement>("#ruleRisk");
const ruleDescription = getElement<HTMLTextAreaElement>("#ruleDescription");
const rulesList = getElement<HTMLDivElement>("#rulesList");
const searchInput = getElement<HTMLInputElement>("#ruleSearch");
const deleteModal = getElement<HTMLDivElement>("#deleteModal");
const deleteModalText = getElement<HTMLParagraphElement>("#deleteModalText");
const cancelDelete = getElement<HTMLButtonElement>("#cancelDelete");
const confirmDelete = getElement<HTMLButtonElement>("#confirmDelete");
const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>(".tab"));
const promptForm = getElement<HTMLFormElement>("#promptForm");
const promptText = getElement<HTMLTextAreaElement>("#promptText");
const rubricCaseSelect = getElement<HTMLSelectElement>("#rubricCase");
const inputType = getElement<HTMLSelectElement>("#inputType");
const ageGroup = getElement<HTMLSelectElement>("#ageGroup");
const vulnerability = getElement<HTMLSelectElement>("#vulnerability");
const childAccess = getElement<HTMLSelectElement>("#childAccess");
const appType = getElement<HTMLSelectElement>("#appType");
const requestedRetention = getElement<HTMLSelectElement>("#requestedRetention");
const imminentRisk = getElement<HTMLInputElement>("#imminentRisk");
const repeatedAttempts = getElement<HTMLInputElement>("#repeatedAttempts");
const involvesTrustedAdult = getElement<HTMLInputElement>("#involvesTrustedAdult");
const involvesPrivateImages = getElement<HTMLInputElement>("#involvesPrivateImages");
const involvesLocationOrPII = getElement<HTMLInputElement>("#involvesLocationOrPII");
const couldEnableHarm = getElement<HTMLInputElement>("#couldEnableHarm");
const runRubric = getElement<HTMLButtonElement>("#runRubric");
const chatbotResult = getElement<HTMLDivElement>("#chatbotResult");

populateRubricCases();

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const newRule: CustomRule = {
    id: `CUSTOM_${createId()}`,
    label: ruleName.value.trim(),
    description: ruleDescription.value.trim(),
    baseRisk: ruleRisk.value as RuleDefinition["baseRisk"],
    category: normalizeCategory(ruleCategory.value),
    locked: false,
    enabled: true,
  };

  customRules = [newRule, ...customRules];
  saveCustomRules();
  form.reset();
  ruleRisk.value = "medium";
  render();
});

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    activeFilter = tab.dataset.filter as RuleFilter;
    tabs.forEach((item) => item.classList.toggle("is-active", item === tab));
    render();
  });
});

searchInput.addEventListener("input", () => {
  searchTerm = searchInput.value.trim().toLowerCase();
  render();
});

rubricCaseSelect.addEventListener("change", () => {
  const selectedCase = getSelectedRubricCase();

  if (selectedCase) {
    applyPromptCase(selectedCase);
    runPromptCheck(selectedCase);
  }
});

promptForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runPromptCheck(getSelectedRubricCase());
});

runRubric.addEventListener("click", () => {
  runRubricSuite();
});

cancelDelete.addEventListener("click", closeDeleteModal);
deleteModal.addEventListener("click", (event) => {
  if (event.target === deleteModal) {
    closeDeleteModal();
  }
});
confirmDelete.addEventListener("click", () => {
  if (!pendingDeleteRuleId) return;

  customRules = customRules.filter((item) => item.id !== pendingDeleteRuleId);
  saveCustomRules();
  closeDeleteModal();
  render();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !deleteModal.hidden) {
    closeDeleteModal();
  }
});

function getElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Missing element: ${selector}`);
  }

  return element;
}

function populateRubricCases(): void {
  PROMPT_RUBRIC.forEach((rubricCase) => {
    const option = document.createElement("option");
    option.value = rubricCase.id;
    option.textContent = rubricCase.label;
    rubricCaseSelect.append(option);
  });
}

function getSelectedRubricCase(): PromptRubricCase | null {
  return (
    PROMPT_RUBRIC.find((rubricCase) => rubricCase.id === rubricCaseSelect.value) ??
    null
  );
}

function applyPromptCase(rubricCase: PromptRubricCase): void {
  promptText.value = rubricCase.prompt;
  applyPromptContext(rubricCase.context);
}

function applyPromptContext(context: PromptTestContext): void {
  inputType.value = context.inputType;
  ageGroup.value = context.ageGroup;
  vulnerability.value = context.vulnerability;
  childAccess.value = context.childAccess;
  appType.value = context.appType;
  requestedRetention.value = context.requestedRetention ?? "";
  imminentRisk.checked = Boolean(context.imminentRisk);
  repeatedAttempts.checked = Boolean(context.repeatedAttempts);
  involvesTrustedAdult.checked = Boolean(context.involvesTrustedAdult);
  involvesPrivateImages.checked = Boolean(context.involvesPrivateImages);
  involvesLocationOrPII.checked = Boolean(context.involvesLocationOrPII);
  couldEnableHarm.checked = Boolean(context.couldEnableHarm);
}

function getPromptContext(): PromptTestContext {
  return {
    inputType: inputType.value as InputType,
    ageGroup: ageGroup.value as AgeGroup,
    vulnerability: vulnerability.value as PromptTestContext["vulnerability"],
    childAccess: childAccess.value as ServiceChildAccess,
    appType: appType.value as ServiceContext["appType"],
    repeatedAttempts: repeatedAttempts.checked,
    imminentRisk: imminentRisk.checked,
    involvesTrustedAdult: involvesTrustedAdult.checked,
    involvesPrivateImages: involvesPrivateImages.checked,
    involvesLocationOrPII: involvesLocationOrPII.checked,
    couldEnableHarm: couldEnableHarm.checked,
    requestedRetention: requestedRetention.value
      ? (requestedRetention.value as RetentionMode)
      : undefined,
  };
}

function runPromptCheck(rubricCase: PromptRubricCase | null): void {
  const result = runDecision(promptText.value, getPromptContext());
  const evaluation = rubricCase
    ? evaluateRubricResult(result, rubricCase.expected)
    : null;

  renderPromptResult(result, evaluation, rubricCase);
}

function runDecision(prompt: string, context: PromptTestContext): DecisionResult {
  return childSafetyDecision(
    {
      text: prompt.trim(),
      inputType: context.inputType,
      repeatedAttempts: context.repeatedAttempts,
      imminentRisk: context.imminentRisk,
      involvesTrustedAdult: context.involvesTrustedAdult,
      involvesPrivateImages: context.involvesPrivateImages,
      involvesLocationOrPII: context.involvesLocationOrPII,
      couldEnableHarm: context.couldEnableHarm,
      requestedRetention: context.requestedRetention,
    },
    {
      ageGroup: context.ageGroup,
      vulnerability: context.vulnerability,
    },
    {
      childAccess: context.childAccess,
      appType: context.appType,
    },
    {
      policyVersion: "hackathon-v1",
    }
  );
}

function runRubricSuite(): void {
  const suiteResults = PROMPT_RUBRIC.map((rubricCase) => {
    const result = runDecision(rubricCase.prompt, rubricCase.context);
    const evaluation = evaluateRubricResult(result, rubricCase.expected);

    return {
      rubricCase,
      result,
      evaluation,
    };
  });
  const passedCount = suiteResults.filter((item) => item.evaluation.passed).length;

  chatbotResult.replaceChildren();
  chatbotResult.className = "chatbot-result";

  const title = document.createElement("h3");
  title.textContent = `Rubric suite: ${passedCount}/${suiteResults.length} passed`;
  chatbotResult.append(title);

  const list = document.createElement("div");
  list.className = "rubric-suite-list";

  suiteResults.forEach(({ rubricCase, result, evaluation }) => {
    const row = document.createElement("article");
    row.className = "suite-row";
    row.classList.toggle("is-pass", evaluation.passed);
    row.classList.toggle("is-fail", !evaluation.passed);

    const heading = document.createElement("div");
    heading.className = "suite-heading";

    const name = document.createElement("strong");
    name.textContent = rubricCase.label;

    const badge = document.createElement("span");
    badge.className = evaluation.passed ? "status-badge pass" : "status-badge fail";
    badge.textContent = evaluation.passed ? "PASS" : "FAIL";

    heading.append(name, badge);

    const details = document.createElement("p");
    details.textContent = `${result.decision} / ${result.riskLevel} / ${
      result.matchedRules.map((rule) => rule.id).join(", ") || "no rules"
    }`;

    row.append(heading, details);

    if (!evaluation.passed) {
      const failedChecks = document.createElement("ul");
      failedChecks.className = "check-list";
      evaluation.checks
        .filter((check) => !check.passed)
        .forEach((check) => {
          const item = document.createElement("li");
          item.textContent = `${check.label}: expected ${check.expected}, got ${check.actual}`;
          failedChecks.append(item);
        });
      row.append(failedChecks);
    }

    list.append(row);
  });

  chatbotResult.append(list);
}

function renderPromptResult(
  result: DecisionResult,
  evaluation: RubricEvaluation | null,
  rubricCase: PromptRubricCase | null
): void {
  chatbotResult.replaceChildren();
  chatbotResult.className = "chatbot-result";

  const header = document.createElement("div");
  header.className = "result-header";

  const title = document.createElement("h3");
  title.textContent = "Decision result";

  const badge = document.createElement("span");
  badge.className = `decision-badge ${result.riskLevel}`;
  badge.textContent = result.decision;

  header.append(title, badge);
  chatbotResult.append(header);

  const summary = document.createElement("dl");
  summary.className = "result-summary";
  appendMetric(summary, "Risk", result.riskLevel);
  appendMetric(summary, "Score", String(result.riskScore));
  appendMetric(summary, "Policy", result.appliedPolicy);
  appendMetric(summary, "Retention", result.retentionMode);
  appendMetric(summary, "Audit", result.auditRequired ? "required" : "not required");
  appendMetric(
    summary,
    "Human review",
    result.humanReviewRequired ? "required" : "not required"
  );
  chatbotResult.append(summary);

  const matchedRules = document.createElement("div");
  matchedRules.className = "matched-rules";

  const matchedTitle = document.createElement("h4");
  matchedTitle.textContent = "Matched rules";
  matchedRules.append(matchedTitle);

  if (result.matchedRules.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "No locked rules matched this prompt.";
    matchedRules.append(empty);
  } else {
    result.matchedRules.forEach((rule) => {
      const ruleItem = document.createElement("article");
      ruleItem.className = "matched-rule";

      const ruleHeading = document.createElement("strong");
      ruleHeading.textContent = `${rule.id}: ${rule.label}`;

      const ruleDescription = document.createElement("p");
      ruleDescription.textContent = rule.matchReason
        ? `${rule.description} ${rule.matchReason}`
        : rule.description;

      ruleItem.append(ruleHeading, ruleDescription);
      matchedRules.append(ruleItem);
    });
  }

  chatbotResult.append(matchedRules);

  const explanation = document.createElement("div");
  explanation.className = "explanation-box";

  const explanationTitle = document.createElement("h4");
  explanationTitle.textContent = "Chatbot explanation";

  const explanationText = document.createElement("p");
  explanationText.textContent = result.explanation;

  explanation.append(explanationTitle, explanationText);
  chatbotResult.append(explanation);

  if (evaluation && rubricCase) {
    renderRubricEvaluation(evaluation, rubricCase);
  }
}

function appendMetric(list: HTMLDListElement, label: string, value: string): void {
  const wrapper = document.createElement("div");
  const term = document.createElement("dt");
  const description = document.createElement("dd");

  term.textContent = label;
  description.textContent = value;
  wrapper.append(term, description);
  list.append(wrapper);
}

function renderRubricEvaluation(
  evaluation: RubricEvaluation,
  rubricCase: PromptRubricCase
): void {
  const rubric = document.createElement("section");
  rubric.className = "rubric-result";

  const header = document.createElement("div");
  header.className = "result-header";

  const title = document.createElement("h4");
  title.textContent = `Rubric: ${rubricCase.label}`;

  const badge = document.createElement("span");
  badge.className = evaluation.passed ? "status-badge pass" : "status-badge fail";
  badge.textContent = evaluation.passed ? "PASS" : "FAIL";

  header.append(title, badge);
  rubric.append(header);

  const list = document.createElement("ul");
  list.className = "check-list";

  evaluation.checks.forEach((check) => {
    const item = document.createElement("li");
    item.className = check.passed ? "is-pass" : "is-fail";
    item.textContent = `${check.label}: expected ${check.expected}, got ${check.actual}`;
    list.append(item);
  });

  rubric.append(list);
  chatbotResult.append(rubric);
}

function loadCustomRules(): CustomRule[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveCustomRules(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(customRules));
}

function createId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID().slice(0, 8).toUpperCase();
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    .slice(0, 8)
    .toUpperCase();
}

function normalizeCategory(category: string): string {
  return category.trim().toLowerCase().replaceAll(" ", "_");
}

function getRules(): RuleDefinition[] {
  return [...LOCKED_GUIDELINES, ...customRules];
}

function getVisibleRules(): RuleDefinition[] {
  return getRules().filter((rule) => {
    const matchesFilter =
      activeFilter === "all" ||
      (activeFilter === "locked" && rule.locked) ||
      (activeFilter === "custom" && !rule.locked) ||
      (activeFilter === "enabled" && rule.enabled) ||
      (activeFilter === "disabled" && !rule.enabled);

    const haystack = `${rule.id} ${rule.label} ${rule.description} ${rule.category}`
      .toLowerCase()
      .replaceAll("_", " ");
    const matchesSearch = !searchTerm || haystack.includes(searchTerm);

    return matchesFilter && matchesSearch;
  });
}

function render(): void {
  const allRules = getRules();
  const visibleRules = getVisibleRules();

  setCount("locked", LOCKED_GUIDELINES.length);
  setCount("custom", customRules.length);
  setCount(
    "enabled",
    allRules.filter((rule) => rule.enabled).length
  );

  rulesList.replaceChildren();

  if (visibleRules.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No rules match the current view.";
    rulesList.append(empty);
    return;
  }

  visibleRules.forEach((rule) => {
    rulesList.append(createRuleRow(rule));
  });
}

function setCount(kind: "locked" | "custom" | "enabled", value: number): void {
  const target = getElement<HTMLElement>(`[data-count="${kind}"]`);
  target.textContent = String(value);
}

function createRuleRow(rule: RuleDefinition): HTMLElement {
  const row = document.createElement("article");
  row.className = "rule-row";
  row.classList.toggle("is-locked", rule.locked);
  row.classList.toggle("is-disabled", !rule.enabled);

  row.innerHTML = `
    <div class="rule-main">
      <div class="rule-heading">
        <span class="rule-id"></span>
        <h3></h3>
        <span class="risk-pill"></span>
      </div>
      <p></p>
      <div class="rule-meta">
        <span class="category"></span>
        <span class="status"></span>
      </div>
    </div>
    <div class="rule-actions">
      <label class="switch">
        <input class="rule-toggle" type="checkbox" />
        <span></span>
      </label>
      <button class="delete-rule" type="button" aria-label="Delete rule">×</button>
    </div>
  `;

  const title = row.querySelector<HTMLHeadingElement>("h3")!;
  const id = row.querySelector<HTMLSpanElement>(".rule-id")!;
  const description = row.querySelector<HTMLParagraphElement>("p")!;
  const risk = row.querySelector<HTMLSpanElement>(".risk-pill")!;
  const category = row.querySelector<HTMLSpanElement>(".category")!;
  const status = row.querySelector<HTMLSpanElement>(".status")!;
  const toggle = row.querySelector<HTMLInputElement>(".rule-toggle")!;
  const deleteButton = row.querySelector<HTMLButtonElement>(".delete-rule")!;

  title.textContent = rule.label;
  id.textContent = rule.id.replace("CUSTOM_", "C-");
  description.textContent = rule.description;
  risk.textContent = rule.baseRisk;
  risk.dataset.risk = rule.baseRisk;
  category.textContent = rule.category.replaceAll("_", " ");
  status.textContent = rule.locked
    ? "locked guideline"
    : rule.enabled
      ? "enabled"
      : "disabled";
  toggle.checked = rule.enabled;
  toggle.disabled = rule.locked;
  toggle.setAttribute(
    "aria-label",
    rule.locked ? `${rule.label} is locked` : `Toggle ${rule.label}`
  );

  if (rule.locked) {
    deleteButton.hidden = true;
  } else {
    toggle.addEventListener("change", () => {
      customRules = customRules.map((item) =>
        item.id === rule.id ? { ...item, enabled: toggle.checked } : item
      );
      saveCustomRules();
      render();
    });

    deleteButton.addEventListener("click", () => {
      openDeleteModal(rule as CustomRule);
    });
  }

  return row;
}

function openDeleteModal(rule: CustomRule): void {
  pendingDeleteRuleId = rule.id;
  deleteModalText.textContent = `Do you want to delete "${rule.label}"? This rule will be removed from your custom rules.`;
  deleteModal.hidden = false;
  confirmDelete.focus();
}

function closeDeleteModal(): void {
  pendingDeleteRuleId = null;
  deleteModal.hidden = true;
}

render();
