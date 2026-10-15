import assert from "node:assert/strict";
import http from "node:http";
import { loadEnvFile } from "../dist/shared/load-env.js";
import { config } from "../dist/shared/config.js";
import {
  OpenAiReplyProvider,
  GroundedRuleAiProvider,
} from "../dist/modules/ai-replies/ai-provider.js";

loadEnvFile(".env");

let checks = 0;

console.log("=== Running OpenAI Reply Provider Tests ===");

// Dummy baseline context
const baseContext = {
  shopId: "shop_test_123",
  customer: {
    id: "cust_123",
    name: "Rahim Ahmed",
    language: "en",
    tags: ["repeat_buyer"],
    staffNotes: ["Customer appreciates prompt responses."],
  },
  latestCustomerMessage: "Hi, do you have Cotton Panjabi White in stock? What is the price?",
  conversationHistory: [
    { sender: "customer", text: "Hello", createdAt: new Date().toISOString() },
    { sender: "staff", text: "Hello Rahim! How can we help?", createdAt: new Date().toISOString() },
  ],
  relevantProducts: [
    {
      id: "prod_panjabi",
      name: "Cotton Panjabi White",
      price: 2450,
      currency: "BDT",
      inStock: true,
      availableQuantity: 12,
      variants: [
        { id: "v_m", name: "M", price: 2450, availableQuantity: 6, inStock: true },
        { id: "v_l", name: "L", price: 2450, availableQuantity: 6, inStock: true },
      ],
    },
  ],
  channel: "messenger",
};

// ---------------------------------------------------------------------
// Test 1: Fallback when API key is missing
// ---------------------------------------------------------------------
{
  console.log("Test 1: Fallback when API key is empty");
  const fallback = new GroundedRuleAiProvider();
  const provider = new OpenAiReplyProvider({
    apiKey: "",
    fallbackProvider: fallback,
  });

  const res = await provider.generateReply(baseContext);
  assert.ok(res.replyText.includes("Cotton Panjabi White"), "Fallback reply contains product name");
  assert.equal(res.confidence, "review");
  assert.equal(res.needsHumanAttention, true);
  checks++;
}

// ---------------------------------------------------------------------
// Test 2: Timeout handling and fallback
// ---------------------------------------------------------------------
{
  console.log("Test 2: Timeout handling (1ms timeout) falls back gracefully");
  // Set timeout to 1ms against a mock server that hangs
  const hangServer = http.createServer((_req, _res) => {
    // deliberately do not respond
  });
  await new Promise((resolve) => hangServer.listen(0, "127.0.0.1", resolve));
  const port = hangServer.address().port;

  const fallback = new GroundedRuleAiProvider();
  const provider = new OpenAiReplyProvider({
    apiKey: "sk-mock-key-for-timeout",
    apiUrl: `http://127.0.0.1:${port}/v1/chat/completions`,
    timeoutMs: 10,
    fallbackProvider: fallback,
  });

  const res = await provider.generateReply(baseContext);
  hangServer.close();

  assert.ok(res.replyText, "Returns reply even when provider times out");
  assert.equal(res.confidence, "review");
  assert.equal(res.needsHumanAttention, true);
  checks++;
}

// ---------------------------------------------------------------------
// Test 3: Rate-limit (HTTP 429) handling and fallback
// ---------------------------------------------------------------------
{
  console.log("Test 3: Rate limit (HTTP 429) triggers fallback cleanly");
  const rateLimitServer = http.createServer((_req, res) => {
    res.writeHead(429, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: { message: "Rate limit reached", type: "requests" } }));
  });
  await new Promise((resolve) => rateLimitServer.listen(0, "127.0.0.1", resolve));
  const port = rateLimitServer.address().port;

  const fallback = new GroundedRuleAiProvider();
  const provider = new OpenAiReplyProvider({
    apiKey: "sk-mock-key-for-429",
    apiUrl: `http://127.0.0.1:${port}/v1/chat/completions`,
    fallbackProvider: fallback,
  });

  const res = await provider.generateReply(baseContext);
  rateLimitServer.close();

  assert.ok(res.replyText, "Returns fallback reply on 429");
  assert.equal(res.confidence, "review");
  checks++;
}

// ---------------------------------------------------------------------
// Test 4: Server error (HTTP 500) handling and fallback
// ---------------------------------------------------------------------
{
  console.log("Test 4: Server error (HTTP 500) triggers fallback cleanly");
  const errServer = http.createServer((_req, res) => {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: { message: "Internal server error" } }));
  });
  await new Promise((resolve) => errServer.listen(0, "127.0.0.1", resolve));
  const port = errServer.address().port;

  const fallback = new GroundedRuleAiProvider();
  const provider = new OpenAiReplyProvider({
    apiKey: "sk-mock-key-for-500",
    apiUrl: `http://127.0.0.1:${port}/v1/chat/completions`,
    fallbackProvider: fallback,
  });

  const res = await provider.generateReply(baseContext);
  errServer.close();

  assert.ok(res.replyText, "Returns fallback reply on 500");
  assert.equal(res.confidence, "review");
  checks++;
}

// ---------------------------------------------------------------------
// Test 5: Malformed JSON response handling and fallback
// ---------------------------------------------------------------------
{
  console.log("Test 5: Malformed JSON completion triggers fallback cleanly");
  const badJsonServer = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        choices: [{ finish_reason: "stop", message: { content: "{ invalid json string here... " } }],
      }),
    );
  });
  await new Promise((resolve) => badJsonServer.listen(0, "127.0.0.1", resolve));
  const port = badJsonServer.address().port;

  const fallback = new GroundedRuleAiProvider();
  const provider = new OpenAiReplyProvider({
    apiKey: "sk-mock-key-for-badjson",
    apiUrl: `http://127.0.0.1:${port}/v1/chat/completions`,
    fallbackProvider: fallback,
  });

  const res = await provider.generateReply(baseContext);
  badJsonServer.close();

  assert.ok(res.replyText, "Returns fallback reply on malformed JSON");
  assert.equal(res.confidence, "review");
  checks++;
}

// ---------------------------------------------------------------------
// Test 6: Malformed Schema structure (valid JSON, invalid schema)
// ---------------------------------------------------------------------
{
  console.log("Test 6: Invalid schema completion triggers fallback cleanly");
  const badSchemaServer = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: JSON.stringify({
                unexpectedKey: "missing replyText and confidence",
              }),
            },
          },
        ],
      }),
    );
  });
  await new Promise((resolve) => badSchemaServer.listen(0, "127.0.0.1", resolve));
  const port = badSchemaServer.address().port;

  const fallback = new GroundedRuleAiProvider();
  const provider = new OpenAiReplyProvider({
    apiKey: "sk-mock-key-for-badschema",
    apiUrl: `http://127.0.0.1:${port}/v1/chat/completions`,
    fallbackProvider: fallback,
  });

  const res = await provider.generateReply(baseContext);
  badSchemaServer.close();

  assert.ok(res.replyText, "Returns fallback reply on invalid schema");
  assert.equal(res.confidence, "review");
  checks++;
}

// ---------------------------------------------------------------------
// Test 7: Real live OpenAI call using the production environment key
// ---------------------------------------------------------------------
if (config.openaiApiKey) {
  console.log("Test 7: Real live OpenAI generation with verified product context");
  const provider = new OpenAiReplyProvider({
    apiKey: config.openaiApiKey,
    model: config.openaiModel,
  });

  const liveResult = await provider.generateReply(baseContext);
  assert.equal(liveResult.provider, "openai", "Live test must not silently use fallback");
  assert.ok(liveResult.replyText.length > 10, "Live reply text has substance");
  assert.equal(liveResult.confidence, "high");
  assert.equal(liveResult.needsHumanAttention, false);
  assert.ok(liveResult.groundingSummary.length > 5, "Grounding summary present");
  assert.ok(
    !liveResult.groundingSummary.toLowerCase().includes("chain-of-thought"),
    "No chain-of-thought in grounding summary",
  );
  assert.ok(
    liveResult.contextSources.some((s) => s.type === "product" && s.name.includes("Cotton Panjabi")),
    "Context sources include Cotton Panjabi",
  );
  checks++;

  console.log("Test 8: Real live OpenAI escalation on customer complaint/damaged item");
  const complaintContext = {
    ...baseContext,
    latestCustomerMessage: "I received a damaged shirt last week. I want a refund or exchange immediately!",
    relevantProducts: [],
  };

  const complaintResult = await provider.generateReply(complaintContext);
  assert.equal(complaintResult.provider, "openai");
  assert.ok(["review", "missing"].includes(complaintResult.confidence), "Complaint must need review or missing facts");
  assert.equal(complaintResult.needsHumanAttention, true, "Complaint must require human attention");
  assert.ok(
    complaintResult.escalationReason?.toLowerCase().includes("complaint") ||
      complaintResult.escalationReason?.toLowerCase().includes("return") ||
      complaintResult.escalationReason?.toLowerCase().includes("damage"),
    "Escalation reason mentions complaint/return/damage",
  );
  checks++;
} else {
  console.warn("Skipping real live tests: OPENAI_API_KEY is not configured.");
}

console.log(`\nAll ${checks} OpenAI Reply Provider unit and resilience tests PASSED!`);
