import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// Side-effect import: applies the saved dark/light preference to <html>
// immediately, before anything renders — see theme.ts for why the order
// matters here.
import './theme'
import App from './App.tsx'
import { AuthProvider } from './supabase/useAuth'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
