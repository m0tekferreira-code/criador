import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx'
import LoginPage from './components/LoginPage.tsx'
import { Loader2 } from 'lucide-react'
import { runMigrations } from './lib/migrations.ts'

// Roda migrations pendentes no startup
runMigrations().catch(err => console.error('[Migrations] Erro:', err));

function Root() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#86868b] animate-spin" />
      </div>
    )
  }

  return user ? <App /> : <LoginPage />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <Root />
    </AuthProvider>
  </StrictMode>,
)
