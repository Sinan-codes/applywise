function normalize(value) {
  return typeof value === "string"
    ? value.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().replace(/\blinked in\b/g, "linkedin").replace(/[^a-z0-9]+/g, " ").trim()
    : "";
}

function isExplicitlyUnmatched(text) {
  const withoutEmailAddress = text.replace(/\bemail address\b/g, "email");
  return /\b(address|street|postal|postcode|zip code|emergency|reference|current employer|company name|years of experience|current salary|salary history)\b/.test(withoutEmailAddress);
}

function hasMultipleFieldMarkers(text) {
  const markers = [
    /\b(first name|given name|forename)\b/,
    /\b(last name|family name|surname)\b/,
    /\b(email|e mail)\b/,
    /\b(phone|telephone|mobile|cell number)\b/,
    /\blinkedin\b/,
    /\b(github|git hub)\b/,
    /\b(portfolio|personal website|website url|personal url)\b/,
    /\b(work authorization|authorized to work|legally authorized|work eligibility)\b/,
    /\b(visa sponsorship|sponsorship required|require sponsorship|require visa sponsorship)\b/,
    /\b(expected salary|salary expectation|desired salary|desired compensation|compensation expectation|pay expectation|expected compensation|salary range)\b/,
    /\b(full name|legal name|your name|candidate name)\b/,
    /\b(city|location)\b/,
    /\b(education|degree|university|college|school)\b/,
    /\b(skill|skills|technical expertise|core competencies)\b/
  ];
  return markers.filter((marker) => marker.test(text)).length > 1;
}

function classify(text) {
  if (!text || isExplicitlyUnmatched(text)) return null;

  if (/\b(first name|given name|forename)\b/.test(text)) return "firstName";
  if (/\b(last name|family name|surname)\b/.test(text)) return "lastName";
  if (/\b(email|e mail)\b/.test(text)) return "email";
  if (/\b(phone|telephone|mobile|cell number)\b/.test(text)) return "phone";
  if (/\b(linkedin)\b/.test(text)) return "linkedin";
  if (/\b(github|git hub)\b/.test(text)) return "github";
  if (/\b(portfolio|personal website|website url|personal url)\b/.test(text)) return "website";
  if (/\b(work authorization|authorized to work|legally authorized|work eligibility)\b/.test(text)) {
    return "workAuthorization";
  }
  if (/\b(visa sponsorship|sponsorship required|require sponsorship|require visa sponsorship)\b/.test(text)) {
    return "sponsorship";
  }
  if (/\b(expected salary|salary expectation|desired salary|desired compensation|compensation expectation|pay expectation|expected compensation|salary range)\b/.test(text)) {
    return "salaryExpectation";
  }
  if (/\b(full name|legal name|your name|candidate name)\b/.test(text) || text === "name") {
    return "fullName";
  }
  if (/\b(city|location)\b/.test(text)) return /\bcity\b/.test(text) ? "city" : "location";
  if (/\b(education|degree|university|college|school)\b/.test(text)) return "education";
  if (/\b(skill|skills|technical expertise|core competencies)\b/.test(text)) return "skills";
  return null;
}

export function matchProfileField(field) {
  const label = normalize(field.label);
  if (isExplicitlyUnmatched(label)) return null;
  const inputType = typeof field.type === "string" ? field.type.toLowerCase() : "";
  const typeMatch = inputType === "email" ? "email" : inputType === "tel" ? "phone" : null;

  const labelMatch = classify(label);
  if (labelMatch) return typeMatch && typeMatch !== labelMatch ? null : labelMatch;

  const context = normalize(field.context);
  if (context && context !== label && !hasMultipleFieldMarkers(context)) {
    if (isExplicitlyUnmatched(context)) return null;
    const contextMatch = classify(context);
    if (contextMatch) return typeMatch && typeMatch !== contextMatch ? null : contextMatch;
  }

  const placeholderMatch = classify(normalize(field.placeholder));
  if (placeholderMatch) return typeMatch && typeMatch !== placeholderMatch ? null : placeholderMatch;

  const autocomplete = normalize(field.autocomplete);
  const autocompleteMatches = {
    email: "email",
    tel: "phone",
    "given name": "firstName",
    "family name": "lastName",
    "address level2": "city"
  };
  if (autocompleteMatches[autocomplete]) {
    const match = autocompleteMatches[autocomplete];
    return typeMatch && typeMatch !== match ? null : match;
  }

  if (typeMatch) return typeMatch;

  for (const attribute of [field.name, field.domId, field.id]) {
    const normalized = normalize(attribute);
    if (isExplicitlyUnmatched(normalized)) continue;
    const attributeMatch = classify(normalized);
    if (attributeMatch) return attributeMatch;
  }

  return null;
}
