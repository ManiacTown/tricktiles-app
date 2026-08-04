import { useState } from 'react';

interface SignInProps {
  onSignIn: (username: string) => Promise<void>;
}

export function SignIn({ onSignIn }: SignInProps) {
  const [username, setUsername] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = username.trim();
    if (trimmed.length < 2) {
      setError('Username must be at least 2 characters.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSignIn(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setSubmitting(false);
    }
  }

  return (
    <div className="card" style={{ margin: '40px auto' }}>
      <h2 className="stamp">DAILY CHALLENGE</h2>
      <p className="small" style={{ margin: '8px 0 16px' }}>
        Pick a username to play today's puzzle and join the leaderboard.
      </p>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          maxLength={24}
          disabled={submitting}
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            fontSize: '14px',
            fontFamily: 'inherit',
          }}
        />
        {error && <div style={{ color: 'var(--invalid)', fontSize: '12px', marginTop: '8px' }}>{error}</div>}
        <button type="submit" disabled={submitting} style={{ marginTop: '16px' }}>
          {submitting ? 'Joining...' : 'Play'}
        </button>
      </form>
    </div>
  );
}
