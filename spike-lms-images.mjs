import { LMStudioClient } from "@lmstudio/sdk";
import fs from "fs";

const client = new LMStudioClient({ baseUrl: "ws://127.0.0.1:1234" });
const model = await client.llm.model("qwen3-4b-z-image-turbo-abliteratedv1");

// Try with much more tokens and explicit image generation prompt
const result = await model.respond([
  { role: "user", content: "Create a photorealistic image of an NFL football stadium at sunset. Output the complete image as a single base64-encoded PNG inside <image></image> tags. Only output the image, no text." }
], {
  maxPredictedTokens: 16384,
  temperature: 0.3,
});

console.log("=== Full response length:", result.content.length, "===");
// Write full response to file for inspection
fs.writeFileSync("spike-qwen-full-response.txt", result.content);
console.log("Saved full response to spike-qwen-full-response.txt");

// Check for image data
const match = result.content.match(/<image>([\s\S]+?)<\/image>/);
if (match) {
  console.log("Image base64 length:", match[1].trim().length);
  const buf = Buffer.from(match[1].trim(), "base64");
  console.log("Decoded size:", buf.length, "bytes");
  fs.writeFileSync("spike-qwen-image.png", buf);
  
  // Check if valid
  const isPNG = buf[0]===0x89 && buf[1]===0x50;
  console.log("Valid PNG:", isPNG);
  if (isPNG && buf.length > 100) {
    // Try to read dimensions from IHDR chunk
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    console.log("Dimensions:", w, "x", h);
  }
}

process.exit(0);
