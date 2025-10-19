type SummInput = { title: string; excerpt: string; html: string; url: string };

export async function summarizeContent({ title, excerpt, html, url }: SummInput): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("❌ OPENAI_API_KEY is not set in .env");

  const prompt = `
  Bạn là một AI chuyên tóm tắt bài viết. Hãy đọc nội dung HTML sau đây và tạo tóm tắt ngắn gọn (3-5 đoạn),
  bao gồm các điểm chính, thông điệp chính và ý nghĩa cốt lõi.
  - Tiêu đề: ${title}
  - Trích đoạn: ${excerpt}
  - URL: ${url}
  - Nội dung: ${html.slice(0, 8000)}
  `;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Bạn là một AI chuyên phân tích và tóm tắt nội dung web." },
          { role: "user", content: prompt }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`❌ OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content?.trim();

    if (!summary) {
      console.error("⚠️ Không nhận được nội dung tóm tắt từ OpenAI:", JSON.stringify(data, null, 2));
      throw new Error("⚠️ OpenAI không trả về nội dung tóm tắt hợp lệ");
    }

    return `<div class="ai-summary">${summary}</div>`;
  } catch (err: any) {
    console.error("❌ summarizeContent() failed:", err.message);
    throw err;
  }
}
export async function summarize(html: string): Promise<string> {
  return summarizeContent({
    title: "Untitled",
    excerpt: html.slice(0, 200),
    html,
    url: "",
  });
}

export default summarize;
