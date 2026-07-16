'use client'

import { useActionState, useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { signIn, requestPasswordReset } from '@/app/auth/actions'

const initialReset = { sent: false }
const initialSignIn: { error?: string; redirectTo?: string } = {}

function LoginForm() {
  const searchParams = useSearchParams()
  const errorParam = searchParams.get('error')
  const router = useRouter()

  const [view, setView] = useState<'signin' | 'forgot'>('signin')
  const [signInState, signInDispatch, signInPending] = useActionState(
    signIn,
    initialSignIn
  )

  useEffect(() => {
    if (signInState.redirectTo) {
      router.push(signInState.redirectTo)
    }
  }, [signInState.redirectTo, router])
  const [resetState, resetDispatch, resetPending] = useActionState(requestPasswordReset, initialReset)

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">PropVault</h1>
          <p className="mt-2 text-sm text-gray-500">
            {view === 'signin' ? 'Sign in to your account' : 'Reset your password'}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {view === 'signin' ? (
            <>
              {(signInState.error || errorParam) && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {signInState.error ?? errorParam}
                </div>
              )}

              <form onSubmit={e => { e.preventDefault(); void signInDispatch(new FormData(e.currentTarget)) }} className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email address
                  </label>
                  <input
                    id="email" name="email" type="email" autoComplete="email" required
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Password
                  </label>
                  <input
                    id="password" name="password" type="password" autoComplete="current-password" required
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit" disabled={signInPending || !!signInState.redirectTo}
                  className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-colors"
                >
                  {(signInPending || signInState.redirectTo) ? 'Signing in…' : 'Sign in'}
                </button>
              </form>

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setView('forgot')}
                  className="text-sm text-gray-500 hover:text-gray-900 underline underline-offset-2 transition-colors"
                >
                  Forgot your password?
                </button>
              </div>
            </>
          ) : (
            <>
              {resetState.sent ? (
                <div className="space-y-4">
                  <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
                    If an account exists for that email, a password reset link has been sent.
                  </div>
                  <button
                    type="button"
                    onClick={() => setView('signin')}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Back to sign in
                  </button>
                </div>
              ) : (
                <>
                  <p className="mb-5 text-sm text-gray-500">
                    Enter your email address and we&apos;ll send you a link to reset your password.
                  </p>
                  <form onSubmit={e => { e.preventDefault(); resetDispatch(new FormData(e.currentTarget)) }} className="space-y-5">
                    <div>
                      <label htmlFor="reset_email" className="block text-sm font-medium text-gray-700 mb-1.5">
                        Email address
                      </label>
                      <input
                        id="reset_email" name="email" type="email" autoComplete="email" required
                        className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                        placeholder="you@example.com"
                      />
                    </div>

                    <button
                      type="submit" disabled={resetPending}
                      className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-colors"
                    >
                      {resetPending ? 'Sending…' : 'Send reset link'}
                    </button>
                  </form>

                  <div className="mt-4 text-center">
                    <button
                      type="button"
                      onClick={() => setView('signin')}
                      className="text-sm text-gray-500 hover:text-gray-900 underline underline-offset-2 transition-colors"
                    >
                      Back to sign in
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
