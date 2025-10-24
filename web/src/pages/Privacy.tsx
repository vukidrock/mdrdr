// web/src/pages/Privacy.tsx
export default function Privacy() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>
      <p className="text-sm text-zinc-500 mb-8">Last updated: 21 Oct 2025</p>

      <div className="prose max-w-none prose-zinc dark:prose-invert">
        <h2>Who we are</h2>
        <p>
          MDRDR (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates the website at{" "}
          <strong>mdrdr.xyz</strong>.
        </p>

        <h2>What data we collect</h2>
        <ul>
          <li><strong>OAuth profile</strong>: basic profile info (name, avatar) and email when you sign in with Google or Facebook.</li>
          <li><strong>Authentication</strong>: we store a JWT in a secure cookie to keep you signed in.</li>
          <li><strong>App activity</strong>: likes, bookmarks, and comments that you create.</li>
          <li><strong>Technical</strong>: standard logs (IP, user agent) for security and debugging.</li>
        </ul>

        <h2>How we use data</h2>
        <ul>
          <li>Provide core features (sign-in, likes, bookmarks, comments).</li>
          <li>Maintain security and prevent abuse.</li>
          <li>Improve reliability and performance of the service.</li>
        </ul>

        <h2>Cookies</h2>
        <p>
          We use cookies for authentication (<code>token</code>) and basic preferences. The auth cookie is{" "}
          <em>HttpOnly</em>, <em>SameSite=Lax</em>, and set over HTTPS.
        </p>

        <h2>Data retention</h2>
        <p>
          Account data is retained while your account is active. You may request deletion of your account and associated personal data at any time (see
          <a href="/privacy/deletion"> Data Deletion Instructions</a>).
        </p>

        <h2>Third-party sign-in</h2>
        <p>
          When using Google or Facebook sign-in, their respective privacy policies apply:
          Google: <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">policies.google.com/privacy</a>,
          Facebook: <a href="https://www.facebook.com/policy.php" target="_blank" rel="noreferrer">facebook.com/policy.php</a>.
        </p>

        <h2>Your rights</h2>
        <ul>
          <li>Access, update, or delete your personal data.</li>
          <li>Withdraw consent for processing where applicable.</li>
        </ul>

        <h2>Contact</h2>
        <p>
          For privacy questions or data requests, contact:{" "}
          <a href="mailto:support@mdrdr.xyz">support@mdrdr.xyz</a>
        </p>
      </div>
    </div>
  );
}
