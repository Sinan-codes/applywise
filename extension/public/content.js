const FIELD_SELECTOR = [
  "input:not([type='hidden']):not([type='password']):not([type='file']):not([type='submit']):not([type='button']):not([type='reset']):not([type='checkbox']):not([type='radio']):not([type='image'])",
  "textarea",
  "select"
].join(",");
let scannedElements = new Map();

function getLabel(element) {
  const labels = Array.from(element.labels || [])
    .map((label) => label.innerText.trim())
    .filter(Boolean);
  const labelledBy = element.getAttribute("aria-labelledby");
  const ariaLabel = element.getAttribute("aria-label");
  const nearbyText = element.closest("label")?.innerText?.trim();
  const explicitLabel = element.id
    ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.innerText.trim()
    : "";

  return labels[0]
    || (labelledBy && document.getElementById(labelledBy)?.innerText.trim())
    || ariaLabel
    || explicitLabel
    || nearbyText
    || findNearbyLabel(element)
    || element.placeholder
    || findFieldContainerLabel(element)
    || element.name
    || element.id
    || "Application question";
}

function findFieldContainerLabel(element) {
  let current = element.parentElement;

  for (let depth = 0; current && depth < 5; depth += 1, current = current.parentElement) {
    const controls = current.querySelectorAll("input, select, textarea, button").length;
    if (controls > 3) continue;

    const clone = current.cloneNode(true);
    clone.querySelectorAll("input, select, textarea, button, svg, script, style").forEach((node) => node.remove());
    const text = clone.innerText.replace(/\s+/g, " ").trim();
    if (text && text.length <= 100) return text;
  }

  return "";
}

function findNearbyLabel(element) {
  let current = element;

  for (let depth = 0; current?.parentElement && depth < 6; depth += 1) {
    const parent = current.parentElement;
    for (let sibling = current.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
      const text = getVisibleText(sibling);
      if (!text || text.length > 120 || /^(basic info|address information|clear|optional)$/i.test(text)) continue;

      const looksLikeLabel = sibling.matches("label, legend, [class*='label'], [id*='label'], [data-testid*='label']")
        || /^(p|span|div|dt)$/i.test(sibling.tagName);
      if (looksLikeLabel) return text;
    }

    const candidates = Array.from(parent.querySelectorAll(
      "label, legend, [class*='label'], [id*='label'], [data-testid*='label']"
    )).filter((candidate) => !candidate.contains(element)
      && candidate.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING);
    const candidate = candidates.at(-1);
    const candidateText = getVisibleText(candidate);
    if (candidateText && candidateText.length <= 120
      && !/^(basic info|address information|clear|optional)$/i.test(candidateText)) {
      return candidateText;
    }
    current = parent;
  }

  return "";
}

function getVisibleText(element) {
  if (!element) return "";
  const clone = element.cloneNode(true);
  clone.querySelectorAll("input, select, textarea, button, svg, script, style").forEach((node) => node.remove());
  return clone.innerText.replace(/\s+/g, " ").trim();
}

function getJobContext() {
  const description = document.querySelector(
    "[data-testid*='job-description'], #jobDescriptionText, .job-description, [class*='jobDescription'], [class*='job-description']"
  );
  const title = document.querySelector("h1")?.innerText.trim();
  const company = document.querySelector(
    "[data-testid*='company-name'], [class*='company-name'], [class*='companyName']"
  )?.innerText.trim();

  return {
    title: title || document.title,
    company: company || "",
    description: (description?.innerText || "").slice(0, 6000)
  };
}

function scanForm() {
  scannedElements = new Map();
  const fields = Array.from(document.querySelectorAll(FIELD_SELECTOR))
    .filter((element) => !element.disabled && !element.readOnly)
    .map((element, index) => {
      const id = `field-${index}`;
      const options = element instanceof HTMLSelectElement
        ? Array.from(element.options)
          .filter((option) => option.value)
          .map((option) => option.text.trim())
          .slice(0, 30)
        : [];

      scannedElements.set(id, element);
      return {
        id,
        domId: element.id || "",
        label: getLabel(element).slice(0, 200),
        type: element.type || element.tagName.toLowerCase(),
        name: element.name || "",
        placeholder: element.placeholder || "",
        autocomplete: element.autocomplete || "",
        context: findFieldContainerLabel(element).slice(0, 200),
        required: element.required,
        options,
        value: element.value || ""
      };
    })
    .filter((field) => field.label && field.type !== "hidden");

  return { fields, job: getJobContext() };
}

function setNativeValue(element, value) {
  const prototype = element instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : element instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

  if (setter) setter.call(element, value);
  else element.value = value;

  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "APPLYWISE_SCAN") {
    sendResponse({ ok: true, ...scanForm() });
    return;
  }

  if (message?.type === "APPLYWISE_FILL") {
    let filled = 0;

    for (const [fieldId, answer] of Object.entries(message.answers || {})) {
      const element = scannedElements.get(fieldId);
      if (!element?.isConnected || element.disabled || element.readOnly
        || typeof answer !== "string" || !answer.trim()) continue;
      if (element instanceof HTMLSelectElement) {
        const matchingOption = Array.from(element.options).find((option) =>
          option.text.trim().toLowerCase() === answer.trim().toLowerCase()
          || option.value.trim().toLowerCase() === answer.trim().toLowerCase()
        );
        if (!matchingOption) continue;
        setNativeValue(element, matchingOption.value);
      } else {
        setNativeValue(element, answer);
      }
      filled += 1;
    }

    sendResponse({ ok: true, filled });
  }

  return false;
});
