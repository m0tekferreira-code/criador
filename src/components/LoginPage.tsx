import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AlertCircle, Loader2, Mail, Lock } from 'lucide-react';

export default function LoginPage() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null); setSuccess(null);

    if (mode === 'login') {
      const { error } = await signInWithEmail(email, password);
      if (error) setError(error);
    } else {
      const { error } = await signUpWithEmail(email, password);
      if (error) setError(error);
      else setSuccess('Verifique seu e-mail para confirmar o cadastro.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-semibold tracking-tighter text-[#1d1d1f] mb-2">
            AdCreative <span className="text-[#0071e3]">Pro</span>
          </h1>
          <p className="text-[#86868b] font-medium">Inteligencia Artificial para criacao publicitaria.</p>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100">
          <div className="flex p-1 bg-[#f5f5f7] rounded-xl mb-6">
            <button onClick={() => { setMode('login'); setError(null); setSuccess(null); }}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${mode === 'login' ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#86868b]'}`}>
              Entrar
            </button>
            <button onClick={() => { setMode('signup'); setError(null); setSuccess(null); }}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${mode === 'signup' ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#86868b]'}`}>
              Criar Conta
            </button>
          </div>

          <button onClick={signInWithGoogle}
            className="w-full py-3.5 bg-[#f5f5f7] hover:bg-[#e8e8ed] rounded-xl font-semibold text-[#1d1d1f] flex items-center justify-center gap-3 transition-colors mb-6 text-sm">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continuar com Google
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
            <div className="relative flex justify-center"><span className="px-4 bg-white text-xs text-[#86868b] font-medium">ou</span></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Mail className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full pl-12 pr-4 py-3.5 bg-[#f5f5f7] border-transparent rounded-xl outline-none focus:bg-white focus:border-gray-200 focus:ring-4 focus:ring-gray-100 text-[#1d1d1f] text-sm transition-all" />
            </div>
            <div className="relative">
              <Lock className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="password" placeholder="Senha (minimo 6 caracteres)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
                className="w-full pl-12 pr-4 py-3.5 bg-[#f5f5f7] border-transparent rounded-xl outline-none focus:bg-white focus:border-gray-200 focus:ring-4 focus:ring-gray-100 text-[#1d1d1f] text-sm transition-all" />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}
            {success && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-sm font-medium">
                {success}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3.5 bg-[#1d1d1f] hover:bg-black disabled:bg-[#e8e8ed] text-white disabled:text-[#86868b] font-semibold rounded-xl flex items-center justify-center gap-2 transition-all text-sm">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {mode === 'login' ? 'Entrar' : 'Criar Conta'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
