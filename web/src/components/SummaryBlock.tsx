export default function SummaryBlock({ html }: { html: string }) {
  return (
    <section
      className="ai-summary"
      style={{ padding:16, border:"1px solid #eee", borderRadius:14, background:"#fafafa", marginTop:12 }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
