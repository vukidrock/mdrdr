import crypto from "crypto";
export function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export async function createEmbedding(text: string): Promise<number[]> {
  const model = (process.env.EMBED_MODEL || "text-embedding-3-small").replace("openai:", "");

  const r = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ model, input: text.slice(0, 8000) })
  });

  const j = await r.json();

  if (!j.data || !j.data[0] || !Array.isArray(j.data[0].embedding)) {
    console.error("❌ Failed to get embedding from OpenAI:", j);
    // 👉 trả về null để DB nhận NULL thay vì "{}"
    return null as any;
  }

  return j.data[0].embedding as number[];
}

export async function extractKeywords(text: string): Promise<string[]> {
  const words = text.toLowerCase().replace(/[^a-z0-9\u00C0-\u024F\u1E00-\u1EFF\s-]/g," ").split(/\s+/);
  const stop = new Set(["the","and","a","to","of","in","is","for","on","that","và","của","là","một","những","các"]);
  const freq: Record<string, number> = {};
  for (const w of words) if (w && !stop.has(w) && w.length>=3) freq[w]=(freq[w]||0)+1;
  return Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k])=>k);
}
