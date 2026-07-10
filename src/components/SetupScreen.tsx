export function SetupScreen() {
  return (
    <div className="centered-screen">
      <div className="auth-card">
        <h1>🗺️ Where I've Been</h1>
        <p>Supabase isn't configured yet. To finish setup:</p>
        <ol className="setup-steps">
          <li>
            Create a project at <code>supabase.com</code>, then run <code>supabase/schema.sql</code>{' '}
            in its SQL editor.
          </li>
          <li>
            Copy <code>.env.example</code> to <code>.env.local</code> and fill in{' '}
            <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> from Project
            Settings → API. (On Vercel, set the same two environment variables.)
          </li>
          <li>Restart the dev server / redeploy.</li>
        </ol>
      </div>
    </div>
  )
}
