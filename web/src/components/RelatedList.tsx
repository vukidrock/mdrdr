export default function RelatedList({ items }: { items: {id:number; title:string; medium_url:string}[] }) {
  if (!items?.length) return null;
  return (
    <section style={{marginTop:28}}>
      <h3 style={{marginBottom:10}}>Bài liên quan</h3>
      <ul style={{paddingLeft:18}}>
        {items.map(it => (
          <li key={it.id}>
            <a href={`/read?url=${encodeURIComponent(it.medium_url)}`}>{it.title || it.medium_url}</a>
          </li>
        ))}
      </ul>
    </section>
  );
}
