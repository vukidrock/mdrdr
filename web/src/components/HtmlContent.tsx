export default function HtmlContent({ html }: { html: string }) {
  return (
    <article
      className="article-content"
      style={{ marginTop:12 }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
