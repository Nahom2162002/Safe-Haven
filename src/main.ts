import { LOCKED_GUIDELINES, type RuleDefinition } from "../lib/decisionEngine";
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
