import assert from "node:assert/strict";
import test from "node:test";
import { matchProfileField } from "../src/services/field-matching.js";
import { generateAnswers } from "../src/services/ai.js";

test("matches explicit profile details to the corresponding fields", () => {
  assert.equal(matchProfileField({ label: "Phone number", type: "text" }), "phone");
  assert.equal(matchProfileField({ label: "Email *", type: "email" }), "email");
  assert.equal(matchProfileField({ label: "Mobile", type: "tel" }), "phone");
  assert.equal(matchProfileField({ label: "LinkedIn profile", type: "text" }), "linkedin");
  assert.equal(matchProfileField({ label: "GitHub profile", type: "text" }), "github");
  assert.equal(matchProfileField({ label: "GitHub URL", type: "url" }), "github");
  assert.equal(matchProfileField({ label: "City", type: "text" }), "city");
  assert.equal(matchProfileField({ label: "First Name *", type: "text" }), "firstName");
  assert.equal(matchProfileField({ label: "Last Name *", type: "text" }), "lastName");
});

test("does not use location as an address or phone answer", () => {
  assert.equal(matchProfileField({ label: "Street address", type: "text" }), null);
  assert.equal(matchProfileField({ label: "Address", type: "tel" }), null);
  assert.equal(matchProfileField({ label: "Phone number", type: "email" }), null);
  assert.equal(matchProfileField({ label: "Street address", type: "text", autocomplete: "address-level2" }), null);
});

test("leaves incomplete and ambiguous profile details unmatched", () => {
  assert.equal(matchProfileField({ label: "Current salary", type: "text" }), null);
  assert.equal(matchProfileField({ label: "Tell us why you want this role", type: "textarea" }), null);
  assert.equal(matchProfileField({ label: "Name of current employer", type: "text" }), null);
  assert.equal(matchProfileField({ label: "Professional summary", type: "textarea" }), null);
  assert.equal(matchProfileField({ label: "Relevant experience", type: "textarea" }), null);
});

test("uses field type or autocomplete only when the label is not contradictory", () => {
  assert.equal(matchProfileField({ label: "Application question", type: "email" }), "email");
  assert.equal(matchProfileField({ label: "Application question", type: "tel" }), "phone");
  assert.equal(matchProfileField({ label: "Application question", autocomplete: "given-name" }), "firstName");
  assert.equal(matchProfileField({ label: "Street address", autocomplete: "tel", type: "tel" }), null);
});

test("uses short nearby field context when generated ids hide the visible label", () => {
  assert.equal(matchProfileField({ label: "rec-form_12345", id: "rec-form_12345", context: "Mobile", type: "text" }), "phone");
  assert.equal(matchProfileField({ label: "rec-form_12346", context: "Email *", type: "text" }), "email");
  assert.equal(matchProfileField({ label: "rec-form_12347", context: "Basic Info First Name Last Name Email", type: "text" }), null);
  assert.equal(matchProfileField({ label: "Application question", id: "field-0", domId: "phone_number", type: "text" }), "phone");
});

test("fills only matched fields and only sends matched narrative fields to AI", async (context) => {
  const previousApiKey = process.env.AI_API_KEY;
  process.env.AI_API_KEY = "test-key";
  context.after(() => {
    if (previousApiKey === undefined) delete process.env.AI_API_KEY;
    else process.env.AI_API_KEY = previousApiKey;
  });

  let aiFields;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    const payload = JSON.parse(options.body);
    aiFields = JSON.parse(payload.messages[1].content).applicationFields;
    return new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            answers: {
              "field-2": "Rewritten skills.",
              "field-3": "I made up an answer.",
              "unknown-id": "Ignore this answer."
            }
          })
        }
      }]
    }), { status: 200 });
  };
  context.after(() => {
    globalThis.fetch = previousFetch;
  });

  const answers = await generateAnswers({
    profile: {
      fullName: "Jordan Lee",
      email: "jordan@example.com",
      phone: "+1 555 0100",
      location: "Toronto, Canada",
      skills: "Product strategy, SQL, and user research."
    },
    fields: [
      { id: "field-0", label: "Phone number", type: "tel" },
      { id: "field-1", label: "Street address", type: "text" },
      { id: "field-2", label: "Skills", type: "textarea" },
      { id: "field-3", label: "Why do you want this job?", type: "textarea" },
      { id: "field-4", label: "First Name *", type: "text" },
      { id: "field-5", label: "Last Name *", type: "text" },
      { id: "field-6", label: "Email *", type: "email" },
      { id: "field-7", label: "City *", type: "text" },
      { id: "field-8", label: "State/Province", type: "text" }
    ],
    job: { title: "Designer" }
  });

  assert.deepEqual(answers, {
    "field-0": "+1 555 0100",
    "field-2": "Rewritten skills.",
    "field-4": "Jordan",
    "field-5": "Lee",
    "field-6": "jordan@example.com",
    "field-7": "Toronto"
  });
  assert.deepEqual(aiFields.map((field) => field.id), ["field-2"]);
  assert.equal(aiFields[0].approvedSourceText, "Product strategy, SQL, and user research.");
});
