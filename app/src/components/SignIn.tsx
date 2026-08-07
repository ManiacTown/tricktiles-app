import { useState } from 'react';

interface SignInProps {
  onSignUp: (email: string, password: string, username: string) => Promise<{ needsEmailConfirmation: boolean }>;
  onSignIn: (email: string, password: string) => Promise<void>;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px',
  borderRadius: '8px',
  border: '1px solid var(--border)',
  fontSize: '14px',
  fontFamily: 'inherit',
  marginBottom: '10px',
};

export function SignIn({ onSignUp, onSignIn }: SignInProps) {
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === 'signup') {
      const trimmedUsername = username.trim();
      if (trimmedUsername.length < 2) {
        setError('Username must be at least 2 characters.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      setSubmitting(true);
      try {
        const result = await onSignUp(email.trim(), password, trimmedUsername);
        if (result.needsEmailConfirmation) {
          setCheckEmail(true);
          setSubmitting(false);
        }
        // otherwise useAuth's session listener picks up the new session
        // and this component unmounts on its own.
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.');
        setSubmitting(false);
      }
      return;
    }

    setSubmitting(true);
    try {
      await onSignIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setSubmitting(false);
    }
  }

  if (checkEmail) {
    return (
      <div className="card" style={{ margin: '40px auto' }}>
        <h2 className="stamp">CHECK YOUR EMAIL</h2>
        <p className="small" style={{ margin: '8px 0 0' }}>
          We sent a confirmation link to {email.trim()}. Click it, then come back and log in.
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ margin: '40px auto' }}>
      <h2 className="stamp">{mode === 'signup' ? 'CREATE ACCOUNT' : 'LOG IN'}</h2>
      <p className="small" style={{ margin: '8px 0 16px' }}>
        {mode === 'signup'
          ? "Create an account to play today's puzzle and join the leaderboard."
          : 'Log in to play today’s puzzle.'}
      </p>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          disabled={submitting}
          style={inputStyle}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          disabled={submitting}
          style={inputStyle}
        />
        {mode === 'signup' && (
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            maxLength={24}
            disabled={submitting}
            style={inputStyle}
          />
        )}
        {error && <div style={{ color: 'var(--invalid)', fontSize: '12px', marginBottom: '8px' }}>{error}</div>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Please wait...' : mode === 'signup' ? 'Create Account' : 'Log In'}
        </button>
      </form>
      <p className="small" style={{ marginTop: '16px', cursor: 'pointer' }} onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(null); }}>
        {mode === 'signup' ? 'Already have an account? Log in' : 'Need an account? Sign up'}
      </p>
    </div>
  );
}
