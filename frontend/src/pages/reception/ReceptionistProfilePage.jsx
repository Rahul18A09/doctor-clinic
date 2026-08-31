import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { authService } from '@/api/auth'
import { Button, Input, Modal, ModalSpinner, PasswordInput } from '@/components/ui'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/hooks/useAuth'
import { CLINIC_NAME } from '@/utils/constants'

const ROLE_LABELS = {
  ADMIN: 'Doctor',
  RECEPTIONIST: 'Receptionist',
}

function roleLabel(role) {
  return ROLE_LABELS[role] || role || '—'
}

function formatPhone(mobile) {
  const digits = String(mobile || '').replace(/\D/g, '')
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`
  }
  return mobile || '—'
}

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

function apiMessage(err, fallback) {
  const data = err.response?.data
  const firstFieldError = data?.errors ? Object.values(data.errors).flat()[0] : null
  return firstFieldError || data?.message || err.message || fallback
}

function Icon({ children, className = 'h-[18px] w-[18px]' }) {
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
  user: (
    <Icon>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </Icon>
  ),
  mail: (
    <Icon>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </Icon>
  ),
  phone: (
    <Icon>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </Icon>
  ),
  idCard: (
    <Icon>
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <path d="M2 10h20" />
      <path d="M6 14h2" />
      <path d="M12 14h6" />
    </Icon>
  ),
  shieldCheck: (
    <Icon>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </Icon>
  ),
  shield: (
    <Icon>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </Icon>
  ),
  wrench: (
    <Icon>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </Icon>
  ),
  clock: (
    <Icon>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </Icon>
  ),
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
  pencil: (
    <Icon>
      <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
      <path d="m15 5 4 4" />
    </Icon>
  ),
  userAvatar: (
    <Icon className="h-10 w-10">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </Icon>
  ),
}

function StatusPill({ active }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-green-600' : 'bg-red-600'}`} />
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

function SectionIcon({ children, tone = 'blue' }) {
  const tones = {
    blue: 'bg-primary-50 text-primary-600',
    green: 'bg-green-50 text-green-700',
  }
  return (
    <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${tones[tone]}`}>
      {children}
    </span>
  )
}

function PersonalInfoRow({ icon, label, value, last = false }) {
  return (
    <div
      className={`flex items-center justify-between gap-3 py-4 sm:gap-8 ${
        last ? '' : 'border-b border-slate-200'
      }`}
    >
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-slate-400">{icon}</span>
        <span className="text-sm font-semibold text-slate-700">{label}</span>
      </div>
      <p className="min-w-0 text-right text-sm font-medium text-slate-900 break-words">
        {value}
      </p>
    </div>
  )
}

function SecurityRow({ icon, label, detail, action, last = false }) {
  return (
    <div
      className={`flex items-center justify-between gap-2 py-4 sm:gap-4 ${
        last ? '' : 'border-b border-slate-200'
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="shrink-0 text-slate-400">{icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-700">{label}</p>
          {detail ? <p className="mt-0.5 truncate text-xs text-slate-500">{detail}</p> : null}
        </div>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  )
}

export function ReceptionistProfilePage() {
  const { user, refreshUser } = useAuth()
  const { showSuccess, showError } = useToast()
  const [editOpen, setEditOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)

  useEffect(() => {
    refreshUser().catch(() => {})
  }, [refreshUser])

  const role = roleLabel(user?.role)
  const active = Boolean(user?.is_active)

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Profile</h2>
        <p className="mt-1 text-sm text-muted">Manage your account and receptionist information.</p>
      </div>

      <section className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-card p-6 text-center shadow-sm sm:flex-row sm:items-center sm:gap-6 sm:p-7 sm:text-left">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-600">
          {icons.userAvatar}
        </div>
        <div className="flex min-w-0 flex-col items-center sm:flex-1 sm:items-start">
          <h3 className="text-xl font-bold text-foreground">{user?.full_name || '—'}</h3>
          <p className="mt-0.5 text-sm text-muted">{role}</p>
          <div className="mt-2.5">
            <StatusPill active={active} />
          </div>
        </div>
        <Button
          variant="secondary"
          className="w-full max-w-xs border-primary-600 text-primary-600 hover:bg-primary-50 sm:w-auto sm:max-w-none"
          onClick={() => setEditOpen(true)}
        >
          {icons.pencil}
          Edit Profile
        </Button>
      </section>

      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-card p-6 shadow-sm sm:p-7">
          <div className="mb-5 flex items-center gap-3">
            <SectionIcon>{icons.user}</SectionIcon>
            <h3 className="text-base font-semibold text-foreground">Personal Information</h3>
          </div>
          <PersonalInfoRow icon={icons.user} label="Full Name" value={user?.full_name || '—'} />
          <PersonalInfoRow icon={icons.mail} label="Email" value={user?.email || '—'} />
          <PersonalInfoRow icon={icons.phone} label="Phone Number" value={formatPhone(user?.mobile)} />
          <PersonalInfoRow icon={icons.idCard} label="Role" value={role} last />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-card p-6 shadow-sm sm:p-7">
          <div className="mb-5 flex items-center gap-3">
            <SectionIcon>{icons.shieldCheck}</SectionIcon>
            <h3 className="text-base font-semibold text-foreground">Account & Security</h3>
          </div>
          <SecurityRow
            icon={icons.wrench}
            label="Password"
            detail="Keep your account secure"
            action={
              <Button
                variant="secondary"
                size="sm"
                className="whitespace-nowrap border-primary-600 px-2.5 text-primary-600 hover:bg-primary-50 sm:px-3"
                onClick={() => setPasswordOpen(true)}
              >
                Change Password
              </Button>
            }
          />
          <SecurityRow
            icon={icons.clock}
            label="Last Login"
            detail={formatDateTime(user?.last_login)}
            action={
              <span className="inline-flex shrink-0 items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                This Device
              </span>
            }
          />
          <SecurityRow
            icon={icons.shield}
            label="Account Status"
            action={<StatusPill active={active} />}
            last
          />
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-card p-6 shadow-sm sm:p-7">
        <div className="mb-6 flex items-center gap-3">
          <SectionIcon tone="green">{icons.building}</SectionIcon>
          <h3 className="text-base font-semibold text-foreground">Clinic Information</h3>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 sm:gap-10">
          <div>
            <p className="text-xs font-medium text-slate-500">Clinic Name</p>
            <p className="mt-1.5 text-sm font-semibold text-slate-900">{CLINIC_NAME}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Your Role</p>
            <p className="mt-1.5 text-sm font-semibold text-slate-900">{role}</p>
          </div>
        </div>
      </section>

      <p className="pt-4 text-center text-xs text-muted">© {new Date().getFullYear()} {CLINIC_NAME}. All rights reserved.</p>

      <EditProfileModal
        open={editOpen}
        user={user}
        onClose={() => setEditOpen(false)}
        onSaved={refreshUser}
        showSuccess={showSuccess}
        showError={showError}
      />
      <ChangePasswordModal
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        showSuccess={showSuccess}
        showError={showError}
      />
    </div>
  )
}

function EditProfileModal({ open, user, onClose, onSaved, showSuccess, showError }) {
  const [submitting, setSubmitting] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: { full_name: '', mobile: '' },
  })

  useEffect(() => {
    if (!open) return
    reset({
      full_name: user?.full_name || '',
      mobile: user?.mobile || '',
    })
  }, [open, user, reset])

  const onSubmit = async (values) => {
    setSubmitting(true)
    try {
      await authService.updateProfile({
        full_name: values.full_name.trim(),
        mobile: values.mobile.trim(),
      })
      await onSaved()
      showSuccess('Profile updated successfully.')
      onClose()
    } catch (err) {
      showError(apiMessage(err, 'Failed to update profile.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="md" loading={submitting}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-2xl sm:p-8"
      >
        <h3 className="text-lg font-semibold text-foreground">Edit Profile</h3>
        <p className="mt-1 text-sm text-muted">You can update your full name and phone number.</p>
        <div className="mt-5 space-y-4">
          <Input
            id="profile_full_name"
            label="Full Name"
            placeholder="Enter full name"
            error={errors.full_name}
            {...register('full_name', { required: 'Full name is required' })}
          />
          <Input
            id="profile_mobile"
            label="Phone Number"
            type="tel"
            placeholder="10-digit mobile number"
            error={errors.mobile}
            {...register('mobile', {
              required: 'Phone number is required',
              pattern: {
                value: /^[0-9]{10}$/,
                message: 'Enter a valid 10-digit mobile number',
              },
            })}
          />
        </div>
        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <ModalSpinner />}
            {submitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function ChangePasswordModal({ open, onClose, showSuccess, showError }) {
  const [submitting, setSubmitting] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      current_password: '',
      new_password: '',
      confirm_password: '',
    },
  })

  useEffect(() => {
    if (open) {
      reset({ current_password: '', new_password: '', confirm_password: '' })
    }
  }, [open, reset])

  const newPassword = watch('new_password')

  const onSubmit = async (values) => {
    setSubmitting(true)
    try {
      await authService.changePassword({
        current_password: values.current_password,
        new_password: values.new_password,
        confirm_password: values.confirm_password,
      })
      showSuccess('Password changed successfully.')
      onClose()
    } catch (err) {
      showError(apiMessage(err, 'Failed to change password.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="md" loading={submitting}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-2xl sm:p-8"
      >
        <h3 className="text-lg font-semibold text-foreground">Change Password</h3>
        <p className="mt-1 text-sm text-muted">Enter your current password and choose a new one.</p>
        <div className="mt-5 space-y-4">
          <PasswordInput
            id="current_password"
            label="Current Password"
            autoComplete="current-password"
            error={errors.current_password}
            {...register('current_password', { required: 'Current password is required' })}
          />
          <PasswordInput
            id="new_password"
            label="New Password"
            autoComplete="new-password"
            error={errors.new_password}
            {...register('new_password', {
              required: 'New password is required',
              minLength: { value: 8, message: 'Password must be at least 8 characters' },
            })}
          />
          <PasswordInput
            id="confirm_password"
            label="Confirm Password"
            autoComplete="new-password"
            error={errors.confirm_password}
            {...register('confirm_password', {
              required: 'Confirm password is required',
              validate: (value) => value === newPassword || 'Passwords do not match',
            })}
          />
        </div>
        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <ModalSpinner />}
            {submitting ? 'Updating...' : 'Update Password'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
