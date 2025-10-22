// web/src/pages/Deletion.tsx
export default function Deletion() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Data Deletion Instructions</h1>
      <p className="text-sm text-zinc-500 mb-8">Last updated: 21 Oct 2025</p>

      <div className="prose max-w-none prose-zinc dark:prose-invert">
        <p>
          If you signed in with Facebook or Google and wish to delete your MDRDR account and associated personal data, please follow the steps below.
        </p>

        <h2>Delete via email request</h2>
        <ol>
          <li>Send an email to <a href="mailto:support@mdrdr.xyz">support@mdrdr.xyz</a> with subject: <strong>Account Deletion Request</strong>.</li>
          <li>Include the email you used to sign in and a brief confirmation that you want your data removed.</li>
        </ol>
        <p>
          We will verify your ownership and process your request within 30 days, then notify you by email once deletion is complete.
        </p>

        <h2>What will be deleted</h2>
        <ul>
          <li>Account profile (name, email, avatar reference).</li>
          <li>Authentication identifiers linked to your account.</li>
          <li>Your bookmarks and comments (or they will be anonymized).</li>
        </ul>

        <h2>What may be retained</h2>
        <p>
          Certain non-personal or aggregated data, and server logs needed for security, may be retained as allowed by law.
        </p>

        <h2>Immediate sign-out</h2>
        <p>
          You can sign out right now by clicking the button below (removes your session cookie on this device).
        </p>
        <form method="post" action="/api/auth/logout">
          <button
            className="rounded-lg border px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            type="submit"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
