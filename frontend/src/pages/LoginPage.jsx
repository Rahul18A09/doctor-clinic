import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import clinicLogo from '@/assets/logo.svg'
import { Button, Input, PasswordInput } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { CLINIC_NAME, ROLE_DASHBOARD } from '@/utils/constants'

export function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [rememberMe, setRememberMe] = useState(true)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm({
    defaultValues: { email: '', password: '' },
    mode: 'onSubmit',
  })

  const onSubmit = async (formData) => {
    console.log('Login clicked')
    console.log('formData', formData)

    const credentials = {
      email: formData.email.toLowerCase().trim(),
      password: formData.password,
    }
    console.log('credentials before API call', credentials)

    try {
      const user = await login(credentials, rememberMe)
      console.log('[LoginPage] login success, user:', user)
      navigate(ROLE_DASHBOARD[user.role])
    } catch (err) {
      console.error('[LoginPage] login error (original):', err)
      console.error('[LoginPage] error message:', err?.message)
      console.error('[LoginPage] error response:', err?.response)
      setError('root', {
        message: err?.response?.data?.message || err?.message || String(err),
      })
    }
  }

  const onInvalid = (validationErrors) => {
    console.log('[LoginPage] handleSubmit validation failed — onSubmit was NOT called')
    console.log('[LoginPage] validation errors:', validationErrors)
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-gradient-to-br from-primary-600 to-primary-800 p-12 text-white">
        <div>
          <img
            src={clinicLogo}
            alt={CLINIC_NAME}
            className="h-20 w-auto object-contain drop-shadow-sm"
          />
          <h1 className="mt-8 text-4xl font-bold leading-tight">{CLINIC_NAME}</h1>
          <p className="mt-4 text-lg text-primary-100">
            Modern clinic management system for doctors and reception staff.
          </p>
        </div>
        <p className="text-sm text-primary-200">
          Secure · Reliable · Professional Healthcare Management
        </p>
      </div>

      {/* Right panel */}
      <div className="flex w-full flex-col items-center justify-center bg-surface px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center lg:text-left">
            <img
              src={clinicLogo}
              alt={CLINIC_NAME}
              className="mx-auto mb-4 h-14 w-auto object-contain lg:hidden"
            />
            <h2 className="text-2xl font-bold text-foreground">Welcome back</h2>
            <p className="mt-2 text-sm text-muted">Sign in to your account to continue</p>
          </div>

          <form
            noValidate
            onSubmit={handleSubmit(onSubmit, onInvalid)}
            className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-8"
          >
            <Input
              id="email"
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="you@clinic.com"
              error={errors.email}
              {...register('email', {
                required: 'Email is required',
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: 'Enter a valid email address',
                },
              })}
            />

            <PasswordInput
              id="password"
              label="Password"
              autoComplete="current-password"
              placeholder="Enter your password"
              error={errors.password}
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 6, message: 'Password must be at least 6 characters' },
              })}
            />

            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-muted">Remember me</span>
              </label>
              <button
                type="button"
                className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
                onClick={() => alert('Forgot password feature coming soon.')}
              >
                Forgot password?
              </button>
            </div>

            {errors.root && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
                {errors.root.message}
              </div>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
