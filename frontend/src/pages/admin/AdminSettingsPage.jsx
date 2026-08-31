import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { settingsService } from '@/api/settings'
import { Button, Input, Select, Toggle } from '@/components/ui'
import { useToast } from '@/context/ToastContext'
import { CLINIC_NAME } from '@/utils/constants'

const WORKING_DAY_OPTIONS = [
  { value: 'MONDAY_FRIDAY', label: 'Monday - Friday' },
  { value: 'MONDAY_SATURDAY', label: 'Monday - Saturday' },
  { value: 'EVERY_DAY', label: 'All Days' },
]

const DATE_FORMAT_OPTIONS = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
]

const TIME_FORMAT_OPTIONS = [
  { value: '12_HOUR', label: '12 Hour' },
  { value: '24_HOUR', label: '24 Hour' },
]

const TIMEZONE_OPTIONS = [
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST)' },
  { value: 'Europe/London', label: 'Europe/London' },
  { value: 'America/New_York', label: 'America/New_York' },
]

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'gu', label: 'Gujarati' },
]

function apiMessage(err, fallback) {
  const data = err.response?.data
  const firstFieldError = data?.errors ? Object.values(data.errors).flat()[0] : null
  return firstFieldError || data?.message || err.message || fallback
}

function Icon({ children, className = 'h-5 w-5' }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

const icons = {
  building: (
    <Icon>
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
      <path d="M10 6h4" />
      <path d="M10 10h4" />
      <path d="M10 14h4" />
      <path d="M10 18h4" />
    </Icon>
  ),
  users: (
    <Icon>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Icon>
  ),
  bell: (
    <Icon>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </Icon>
  ),
  gear: (
    <Icon>
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </Icon>
  ),
  clock: (
    <Icon className="h-4 w-4">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </Icon>
  ),
  shield: (
    <Icon className="h-4 w-4">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </Icon>
  ),
  activity: (
    <Icon className="h-4 w-4">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </Icon>
  ),
}

function TimeField({ id, label, error, ...props }) {
  return (
    <div className="space-y-1">
      {label ? (
        <label htmlFor={id} className="block text-sm font-medium text-foreground">
          {label}
        </label>
      ) : null}
      <div className="relative">
        <input
          id={id}
          type="time"
          className={`block w-full rounded-xl border bg-card px-3 py-2.5 pr-10 text-sm text-foreground shadow-sm transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-y-0 [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-10 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 ${
            error ? 'border-red-500' : 'border-border'
          }`}
          {...props}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-primary-600">
          {icons.clock}
        </span>
      </div>
      {error ? <p className="text-sm text-red-500">{error.message}</p> : null}
    </div>
  )
}

function normalizeTokenFormat(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length >= 2) return digits.slice(-2)
  return digits
}

function SettingsCard({ icon, tone, title, subtitle, children, onSubmit, saving }) {
  const tones = {
    green: 'bg-green-50 text-green-600',
    blue: 'bg-primary-50 text-primary-600',
    purple: 'bg-violet-50 text-violet-600',
    amber: 'bg-amber-50 text-amber-600',
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-slate-200 bg-card p-5 shadow-sm sm:p-7"
    >
      <div className="mb-6 flex items-start gap-3">
        <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
          {icon}
        </span>
        <div>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="mt-0.5 text-sm text-muted">{subtitle}</p>
        </div>
      </div>
      {children}
      <div className="mt-6 flex justify-end">
        <Button
          type="submit"
          variant="secondary"
          disabled={saving}
          className="border-primary-600 text-primary-600 hover:bg-primary-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  )
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-8 w-32 rounded-lg bg-slate-200" />
        <div className="mt-2 h-4 w-64 max-w-full rounded bg-slate-200" />
      </div>
      <div className="h-80 rounded-2xl border border-slate-200 bg-card" />
      <div className="h-64 rounded-2xl border border-slate-200 bg-card" />
      <div className="h-56 rounded-2xl border border-slate-200 bg-card" />
      <div className="h-40 rounded-2xl border border-slate-200 bg-card" />
    </div>
  )
}

export function AdminSettingsPage() {
  const { showSuccess, showError } = useToast()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState('')

  const clinicForm = useForm({
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      address: '',
      working_days: 'MONDAY_SATURDAY',
      opening_time: '09:00',
      closing_time: '18:00',
    },
  })
  const queueForm = useForm({
    defaultValues: {
      token_format: '01',
      daily_token_reset: true,
      queue_start_time: '09:00',
      queue_end_time: '18:00',
      max_daily_tokens: 200,
    },
  })
  const notificationForm = useForm({
    defaultValues: {
      patient_registration: true,
      token_generated: true,
      token_approaching: true,
      consultation_completed: true,
    },
  })
  const preferenceForm = useForm({
    defaultValues: {
      date_format: 'DD/MM/YYYY',
      time_format: '12_HOUR',
      timezone: 'Asia/Kolkata',
      language: 'en',
    },
  })

  const applySettings = (settings) => {
    clinicForm.reset(settings.clinic)
    queueForm.reset({
      ...settings.queue,
      token_format: normalizeTokenFormat(settings.queue.token_format) || '01',
      max_daily_tokens: settings.queue.max_daily_tokens ?? '',
    })
    notificationForm.reset(settings.notifications)
    preferenceForm.reset(settings.preferences)
  }

  const loadSettings = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const { data: res } = await settingsService.get()
      applySettings(res.data.settings)
    } catch (err) {
      const message = apiMessage(err, 'Failed to load settings.')
      setLoadError(message)
      showError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
    // Load once when the settings page mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const saveSection = async (key, request, values, successMessage) => {
    setSaving(key)
    try {
      const { data: res } = await request(values)
      applySettings(res.data.settings)
      showSuccess(successMessage)
    } catch (err) {
      showError(apiMessage(err, 'Failed to save settings.'))
    } finally {
      setSaving('')
    }
  }

  if (loading) {
    return <SettingsSkeleton />
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-card p-6 text-center shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-foreground">Unable to load settings</h2>
        <p className="mt-2 text-sm text-muted">{loadError}</p>
        <Button className="mt-5" onClick={loadSettings}>
          Try again
        </Button>
      </div>
    )
  }

  const notifications = notificationForm.watch()
  const dailyReset = queueForm.watch('daily_token_reset')

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Settings</h2>
        <p className="mt-1 text-sm text-muted">Manage clinic, queue, notification, and system preferences.</p>
      </div>

      <SettingsCard
        icon={icons.building}
        tone="green"
        title="Clinic Settings"
        subtitle="Manage your clinic information and working hours."
        saving={saving === 'clinic'}
        onSubmit={clinicForm.handleSubmit((values) =>
          saveSection('clinic', settingsService.updateClinic, values, 'Clinic settings saved.'),
        )}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="clinic_name"
            label="Clinic Name"
            error={clinicForm.formState.errors.name}
            {...clinicForm.register('name', { required: 'Clinic name is required' })}
          />
          <Input
            id="clinic_phone"
            label="Clinic Phone"
            error={clinicForm.formState.errors.phone}
            {...clinicForm.register('phone', { required: 'Phone is required' })}
          />
          <Input
            id="clinic_email"
            label="Clinic Email"
            type="email"
            error={clinicForm.formState.errors.email}
            {...clinicForm.register('email', {
              required: 'Email is required',
              pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address' },
            })}
          />
          <Select
            id="working_days"
            label="Working Days"
            options={WORKING_DAY_OPTIONS}
            error={clinicForm.formState.errors.working_days}
            {...clinicForm.register('working_days', { required: 'Working days are required' })}
          />
          <div className="sm:col-span-1">
            <label htmlFor="clinic_address" className="mb-1 block text-sm font-medium text-foreground">
              Address
            </label>
            <textarea
              id="clinic_address"
              rows={4}
              className={`block w-full rounded-xl border bg-card px-3 py-2.5 text-sm text-foreground shadow-sm placeholder:text-muted focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 ${
                clinicForm.formState.errors.address ? 'border-red-500' : 'border-border'
              }`}
              {...clinicForm.register('address', { required: 'Address is required' })}
            />
            {clinicForm.formState.errors.address ? (
              <p className="mt-1 text-sm text-red-500">{clinicForm.formState.errors.address.message}</p>
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TimeField
              id="opening_time"
              label="Opening Time"
              error={clinicForm.formState.errors.opening_time}
              {...clinicForm.register('opening_time', { required: 'Opening time is required' })}
            />
            <TimeField
              id="closing_time"
              label="Closing Time"
              error={clinicForm.formState.errors.closing_time}
              {...clinicForm.register('closing_time', { required: 'Closing time is required' })}
            />
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        icon={icons.users}
        tone="blue"
        title="Queue & Token Settings"
        subtitle="Configure queue and token generation preferences."
        saving={saving === 'queue'}
        onSubmit={queueForm.handleSubmit((values) =>
          saveSection(
            'queue',
            settingsService.updateQueue,
            {
              ...values,
              token_format: normalizeTokenFormat(values.token_format),
              max_daily_tokens:
                values.max_daily_tokens === '' || values.max_daily_tokens == null
                  ? null
                  : Number(values.max_daily_tokens),
            },
            'Queue settings saved.',
          ),
        )}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="token_format" className="mb-1 block text-sm font-medium text-foreground">
              Token Format
            </label>
            <div
              className={`flex items-center rounded-xl border bg-card px-3 shadow-sm transition-all focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20 ${
                queueForm.formState.errors.token_format ? 'border-red-500' : 'border-border'
              }`}
            >
              <span className="text-sm text-muted">(</span>
              <input
                id="token_format"
                inputMode="numeric"
                maxLength={2}
                placeholder="01"
                className="w-full border-0 bg-transparent py-2.5 text-center text-sm font-medium text-foreground outline-none placeholder:text-muted"
                {...queueForm.register('token_format', {
                  required: 'Token format is required',
                  pattern: { value: /^\d{2}$/, message: 'Enter a 2-digit format such as 01' },
                })}
              />
              <span className="text-sm text-muted">)</span>
            </div>
            {queueForm.formState.errors.token_format ? (
              <p className="mt-1 text-sm text-red-500">{queueForm.formState.errors.token_format.message}</p>
            ) : (
              <p className="mt-1 text-xs text-muted">Two-digit token format, for example (01)</p>
            )}
          </div>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">Daily Token Reset</p>
              <p className="mt-0.5 text-xs text-muted">Reset token counter every day at start time</p>
            </div>
            <Toggle
              checked={Boolean(dailyReset)}
              label="Daily Token Reset"
              onChange={(value) => queueForm.setValue('daily_token_reset', value, { shouldDirty: true })}
            />
          </div>
          <TimeField
            id="queue_start_time"
            label="Queue Start Time"
            error={queueForm.formState.errors.queue_start_time}
            {...queueForm.register('queue_start_time', { required: 'Start time is required' })}
          />
          <TimeField
            id="queue_end_time"
            label="Queue End Time"
            error={queueForm.formState.errors.queue_end_time}
            {...queueForm.register('queue_end_time', { required: 'End time is required' })}
          />
          <div className="sm:col-span-2">
            <Input
              id="max_daily_tokens"
              label="Max Daily Tokens (Optional)"
              type="number"
              min="1"
              max="9999"
              error={queueForm.formState.errors.max_daily_tokens}
              {...queueForm.register('max_daily_tokens')}
            />
            <p className="mt-1 text-xs text-muted">Leave empty for unlimited</p>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        icon={icons.bell}
        tone="purple"
        title="Notification Settings"
        subtitle="Manage system notification preferences."
        saving={saving === 'notifications'}
        onSubmit={notificationForm.handleSubmit((values) =>
          saveSection(
            'notifications',
            settingsService.updateNotifications,
            values,
            'Notification settings saved.',
          ),
        )}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              key: 'patient_registration',
              title: 'Patient Registration',
              description: 'Notify when a new patient is registered',
              icon: icons.shield,
            },
            {
              key: 'token_generated',
              title: 'Token Generated',
              description: 'Notify when a new token is generated',
              icon: icons.bell,
            },
            {
              key: 'token_approaching',
              title: 'Token Approaching',
              description: 'Notify when token is about to be called',
              icon: icons.bell,
            },
            {
              key: 'consultation_completed',
              title: 'Consultation Completed',
              description: 'Notify when consultation is completed',
              icon: icons.activity,
            },
          ].map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 px-4 py-3"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 text-primary-600">{item.icon}</span>
                <div>
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <p className="mt-0.5 text-xs text-muted">{item.description}</p>
                </div>
              </div>
              <Toggle
                checked={Boolean(notifications[item.key])}
                label={item.title}
                onChange={(value) => notificationForm.setValue(item.key, value, { shouldDirty: true })}
              />
            </div>
          ))}
        </div>
      </SettingsCard>

      <SettingsCard
        icon={icons.gear}
        tone="amber"
        title="System Preferences"
        subtitle="Configure general system preferences."
        saving={saving === 'preferences'}
        onSubmit={preferenceForm.handleSubmit((values) =>
          saveSection(
            'preferences',
            settingsService.updatePreferences,
            values,
            'System preferences saved.',
          ),
        )}
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Select
            id="date_format"
            label="Date Format"
            options={DATE_FORMAT_OPTIONS}
            error={preferenceForm.formState.errors.date_format}
            {...preferenceForm.register('date_format', { required: 'Date format is required' })}
          />
          <Select
            id="time_format"
            label="Time Format"
            options={TIME_FORMAT_OPTIONS}
            error={preferenceForm.formState.errors.time_format}
            {...preferenceForm.register('time_format', { required: 'Time format is required' })}
          />
          <Select
            id="timezone"
            label="Timezone"
            options={TIMEZONE_OPTIONS}
            error={preferenceForm.formState.errors.timezone}
            {...preferenceForm.register('timezone', { required: 'Timezone is required' })}
          />
          <Select
            id="language"
            label="Language"
            options={LANGUAGE_OPTIONS}
            error={preferenceForm.formState.errors.language}
            {...preferenceForm.register('language', { required: 'Language is required' })}
          />
        </div>
      </SettingsCard>

      <p className="pt-2 text-center text-xs text-muted">
        © {new Date().getFullYear()} {CLINIC_NAME}. All rights reserved.
      </p>
    </div>
  )
}
