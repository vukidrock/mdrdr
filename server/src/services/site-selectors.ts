// server/src/services/site-selectors.ts
export const SITE_SELECTORS: Record<string, string[]> = {
  // Tech blogs / Eng
  "blog.cloudflare.com": [".post-content", "article .post-content", "main article"],
  "netflixtechblog.com": [".main-article", ".post-content", "main article", "article"],
  "dropbox.tech": [".post__content", ".post-content", "article", "main article"],
  "shopify.engineering": [".article__body", ".rte", "article", "main article"],
  "engineering.atspotify.com": [".post-content", ".article-body", "article", "main article"],
  "stripe.com": [".article-body", ".content", "main article"],
  "airbnb.io": [".post-content", "article", "main article"],

  // Vendors
  "aws.amazon.com": [".lb-content-wide article", ".blog-post", "main article"],
  "cloud.google.com": [".devsite-article-body", "article", "main article"],
  "azure.microsoft.com": [".article__content", ".content", "main article"],

  // Media / Longform
  "smashingmagazine.com": [".article__content", ".c-gar article", "main article"],
  "css-tricks.com": [".article-content", ".entry-content", "article", "main article"],
  "quantamagazine.org": ["main article", ".c-article__body", ".post-content"],

  // Company research
  "openai.com": [".article-content", "main article", ".prose"],
  "deepmind.google": [".article-content", ".rich-text", "main article"],
  "anthropic.com": [".article-content", "article", "main article"],
  "huggingface.co": [".blog-post-content", ".post-content", "article", "main article"],

  // Community
  "stackoverflow.blog": [".entry-content", "article .entry-content", "main article"],

  // Personal
  "markmanson.net": [".article-content", ".entry-content", "article", "main article"],
  "paulgraham.com": ["table", "article", "main article"],

  // Đặc thù đã hỗ trợ riêng
  "substack.com": [
    ".available-content .body.markup",
    ".available-content .body",
    "main article",
    "article",
  ],
  "medium.com": [
    "article .pw-post-body-paragraph, article section",
    "article",
    "main article",
  ],
};

export const DEFAULT_SELECTORS: string[] = [
  "main article", "article",
  ".entry-content",".post-content",".article-content",".article-body",".post-body",
  ".content",".section-content",".post .content",".single-post .content",
];

export function getSelectorsFor(hostname: string): string[] {
  const host = hostname.toLowerCase();
  if (SITE_SELECTORS[host]) return SITE_SELECTORS[host];
  const hit = Object.keys(SITE_SELECTORS).find((d) => host === d || host.endsWith(`.${d}`));
  return hit ? SITE_SELECTORS[hit] : DEFAULT_SELECTORS;
}
