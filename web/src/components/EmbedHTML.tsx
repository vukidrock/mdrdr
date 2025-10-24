import { useEffect, useMemo } from "react";
import DOMPurify from "dompurify";

function loadOnce(src: string) {
  if (document.querySelector(`script[src="${src}"]`)) return;
  const s = document.createElement("script");
  s.async = true; s.src = src;
  document.body.appendChild(s);
}

export default function EmbedHTML({ html }: { html: string }) {
  const safe = useMemo(() => {
    return DOMPurify.sanitize(html, {
      ADD_TAGS: ["iframe","blockquote"],
      ADD_ATTR: [
        "allow","allowfullscreen","frameborder","scrolling","src",
        "width","height","class","data-instgrm-permalink","data-instgrm-version",
        "loading","referrerpolicy","title"
      ],
      ALLOWED_URI_REGEXP: /^(?:(?:(?:https?:)?\/\/)[^ ]+|data:image\/[^;]+;base64,)/i
    });
  }, [html]);

  useEffect(() => {
    if (html.includes("instagram.com")) {
      loadOnce("https://www.instagram.com/embed.js");
      setTimeout(() => (window as any).instgrm?.Embeds?.process?.(), 300);
    }
    if (html.includes("twitter-tweet") || html.includes("platform.twitter.com")) {
      loadOnce("https://platform.twitter.com/widgets.js");
      setTimeout(() => (window as any).twttr?.widgets?.load?.(), 300);
    }
  }, [html]);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl shadow" style={{ paddingTop: "56.25%" }}>
      <div
        className="absolute inset-0 [&>iframe]:w-full [&>iframe]:h-full"
        dangerouslySetInnerHTML={{ __html: safe }}
      />
    </div>
  );
}
