import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { addLabProduct, labStatus, runLabChat } from "./test-lab.service.js";

const productSchema = z.object({ name: z.string().trim().min(2).max(180), description: z.string().trim().max(1000).default(""), price: z.number().finite().min(0), stock: z.number().int().min(0), image: z.string().trim().min(20) });
const chatSchema = z.object({ text: z.string().trim().max(1000).optional(), image: z.string().trim().optional() });

export async function registerTestLabRoutes(app: FastifyInstance) {
  app.get("/status", async (request) => labStatus(request.authUser!.id));
  app.post("/products", async (request, reply) => reply.code(201).send(await addLabProduct(request.authUser!.id, productSchema.parse(request.body))));
  app.post("/chat", async (request) => runLabChat(request.authUser!.id, chatSchema.parse(request.body)));
  app.get("/ui", async (_request, reply) => reply.type("text/html; charset=utf-8").send(TEST_LAB_HTML));
}

const TEST_LAB_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI Vision Lab</title><style>
body{font:15px system-ui;max-width:900px;margin:32px auto;padding:0 18px;color:#202735}main{display:grid;grid-template-columns:1fr 1fr;gap:20px}section{border:1px solid #d8dee8;border-radius:8px;padding:18px}input,textarea,button{font:inherit;width:100%;box-sizing:border-box;margin:6px 0;padding:10px}button{cursor:pointer;background:#172033;color:white;border:0;border-radius:5px}pre{white-space:pre-wrap;background:#f5f7fa;padding:12px;min-height:100px}small{color:#667085}@media(max-width:700px){main{grid-template-columns:1fr}}
</style></head><body><h1>AI Vision Lab</h1><p><small>Gemini image embeddings -> shop-local vector match -> Gemini ambiguous judge -> Groq grounded reply.</small></p><p id="status">Loading...</p><main><section><h2>1. Add catalog product</h2><input id="name" placeholder="Product name"><input id="price" type="number" placeholder="Price"><input id="stock" type="number" placeholder="Stock"><textarea id="description" placeholder="Description"></textarea><input id="productImage" type="file" accept="image/*"><button onclick="addProduct()">Save and vectorize</button><pre id="productResult"></pre></section><section><h2>2. Test buyer image</h2><input id="buyerImage" type="file" accept="image/*"><textarea id="question" placeholder="What product is this? Is it in stock?"></textarea><button onclick="runTest()">Recognize image and reply</button><pre id="result"></pre></section></main><script>
const read=file=>new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=no;r.readAsDataURL(file)});
async function refresh(){const r=await fetch('/api/test-lab/status');const j=await r.json();document.querySelector('#status').textContent=r.ok?'Shop: '+j.shop.name+' | Products: '+j.products.length+' | Vectorized images: '+j.embeddedCount:j.message||'Login required';}
async function addProduct(){const f=document.querySelector('#productImage').files[0];if(!f)return;const body={name:name.value,price:Number(price.value),stock:Number(stock.value),description:description.value,image:await read(f)};const r=await fetch('/api/test-lab/products',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});productResult.textContent=JSON.stringify(await r.json(),null,2);refresh();}
async function runTest(){const f=document.querySelector('#buyerImage').files[0];if(!f)return;const body={image:await read(f),text:question.value};const r=await fetch('/api/test-lab/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});result.textContent=JSON.stringify(await r.json(),null,2);}
refresh();</script></body></html>`;
