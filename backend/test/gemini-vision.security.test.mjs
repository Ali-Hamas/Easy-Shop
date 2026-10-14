import assert from "node:assert/strict";
import { isPrivateAddress } from "../dist/modules/ai-replies/gemini-vision.service.js";

const blocked = [
  "::",
  "::1",
  "::ffff:127.0.0.1",
  "::ffff:7f00:1",
  "0:0:0:0:0:ffff:7f00:1",
  "fe80::1",
  "fec0::1",
  "fc00::1",
  "fd00::1",
  "ff02::1",
  "64:ff9b::c0a8:0101",
];
for (const address of blocked) assert.equal(isPrivateAddress(address), true, address);

for (const address of ["2001:4860:4860::8888", "2001:db8::1"]) {
  assert.equal(isPrivateAddress(address), false, address);
}

console.log(`IPv6 SSRF regression checks passed: ${blocked.length} blocked forms.`);
