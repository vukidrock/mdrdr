import { useEffect, useMemo } from "react";
import DOMPurify from "dompurify";

function loadOnce(src: string) {
  if (document.querySelector(`script[src="${src}"]`)) return;
  const s = document.createElement("script");
  s.async = true; s.src = src;
  document.body.appendChild(s);
}

/** Bổ sung/enrich thuộc tính allow cho iframe (Spotify cần encrypted-media) */
function enrichIframeAllow(html: string) {
  let s = html;

  // Ép width/height responsive trước khi bơm allow
  s = s.replace(/width="\d+"/gi, 'width="100%"')
       .replace(/height="\d+"/gi, 'height="420"');

  const allowNeeded = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";

  // Nếu đã có allow → thêm encrypted-media nếu thiếu
  if (/<iframe[^>]*\sallow="/i.test(s)) {
    if (!/encrypted-media/i.test(s)) {
      s = s.replace(
        /<iframe([^>]*\sallow=")([^"]*)"/i,
        (_m, p1, p2) => `<iframe${p1}${p2}; encrypted-media"`
      );
    }
  } else {
    // Chưa có allow → thêm mới đầy đủ
    s = s.replace(
      /<iframe/i,
      `<iframe allow="${allowNeeded}"`
    );
  }

  // Spotify đôi khi trả src không https tuyệt đối → chuẩn hoá https cho chắc
  s = s.replace(
    /(<iframe[^>]*\ssrc=")(\/\/)?open\.spotify\.com/gi,
    (_m, p1) => `${p1}https://open.spotify.com`
  );

  return s;
}

export default function EmbedHTML({ html }: { html: string }) {
  const safe = useMemo(() => {
    const cleaned = DOMPurify.sanitize(html, {
      ADD_TAGS: ["iframe","blockquote"],
      ADD_ATTR: [
        "allow","allowfullscreen","frameborder","scrolling","src",
        "width","height","class","data-instgrm-permalink","data-instgrm-version",
        "loading","referrerpolicy","title"
      ],
      ALLOWED_URI_REGEXP: /^(?:(?:(?:https?:)?\/\/)[^ ]+|data:image\/[^;]+;base64,)/i
    });
    return enrichIframeAllow(cleaned);
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
