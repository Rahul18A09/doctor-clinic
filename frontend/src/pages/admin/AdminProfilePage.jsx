import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChangePasswordModal,
  EditProfileModal,
  LetterAvatar,
  PersonalInfoRow,
  SectionIcon,
  SecurityRow,
  StatusPill,
  apiMessage,
  formatDate,
  formatDateTime,
  formatPhone,
  profileIcons,
} from '@/components/profile'
import { Button } from '@/components/ui'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/hooks/useAuth'
import { CLINIC_NAME, ROUTES } from '@/utils/constants'

function ProfileSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-8 w-28 rounded-lg bg-slate-200" />
        <div className="mt-2 h-4 w-72 max-w-full rounded bg-slate-200" />
      </div>
      <div className="h-32 rounded-2xl border border-slate-200 bg-card" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-72 rounded-2xl border border-slate-200 bg-card" />
        <div className="h-72 rounded-2xl border border-slate-200 bg-card" />
      </div>
      <div className="h-36 rounded-2xl border border-slate-200 bg-card" />
    </div>
  )
}

export function AdminProfilePage() {
  const { user, refreshUser } = useAuth()
  const { showSuccess, showError } = useToast()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)

  const loadProfile = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      await refreshUser()
    } catch (err) {
      setLoadError(apiMessage(err, 'Failed to load profile.'))
      showError(apiMessage(err, 'Failed to load profile.'))
    } finally {
      setLoading(false)
    }
  }, [refreshUser, showError])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  if (loading && !user) {
    return <ProfileSkeleton />
  }

  if (loadError && !user) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-card p-6 text-center shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-foreground">Unable to load profile</h2>
        <p className="mt-2 text-sm text-muted">{loadError}</p>
        <Button className="mt-5" onClick={loadProfile}>
          Try again
        </Button>
      </div>
    )
  }

  const active = Boolean(user?.is_active)
  const lastLogin = formatDateTime(user?.last_login)
  const accountCreated = formatDate(user?.created_at)

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Profile</h2>
        <p className="mt-1 text-sm text-muted">Manage your administrator account and system access.</p>
      </div>

      <section className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-card p-6 text-center shadow-sm sm:flex-row sm:items-center sm:gap-6 sm:p-7 sm:text-left">
        <LetterAvatar name={user?.full_name} />
        <div className="flex min-w-0 flex-col items-center sm:flex-1 sm:items-start">
          <h3 className="text-xl font-bold text-foreground">{user?.full_name || '—'}</h3>
          <p className="mt-0.5 text-sm text-muted">System Administrator</p>
          <div className="mt-2.5">
            <StatusPill active={active} />
          </div>
        </div>
        <Button
          variant="secondary"
          className="w-full max-w-xs border-primary-600 text-primary-600 hover:bg-primary-50 sm:w-auto sm:max-w-none"
          onClick={() => setEditOpen(true)}
        >
          {profileIcons.pencil}
          Edit Profile
        </Button>
      </section>

      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-card p-6 shadow-sm sm:p-7">
          <div className="mb-5 flex items-center gap-3">
            <SectionIcon>{profileIcons.user}</SectionIcon>
            <h3 className="text-base font-semibold text-foreground">Personal Information</h3>
          </div>
          <PersonalInfoRow icon={profileIcons.user} label="Full Name" value={user?.full_name || '—'} />
          <PersonalInfoRow icon={profileIcons.mail} label="Email" value={user?.email || '—'} />
          <PersonalInfoRow icon={profileIcons.phone} label="Phone Number" value={formatPhone(user?.mobile)} />
          <PersonalInfoRow icon={profileIcons.idCard} label="Role" value="Administrator" last />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-card p-6 shadow-sm sm:p-7">
          <div className="mb-5 flex items-center gap-3">
            <SectionIcon>{profileIcons.shieldCheck}</SectionIcon>
            <h3 className="text-base font-semibold text-foreground">Account & Security</h3>
          </div>
          <SecurityRow
            icon={profileIcons.wrench}
            label="Password"
            detail="••••••••••••"
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
          {lastLogin ? (
            <PersonalInfoRow icon={profileIcons.clock} label="Last Login" value={lastLogin} />
          ) : null}
          <SecurityRow
            icon={profileIcons.shield}
            label="Account Status"
            action={<StatusPill active={active} />}
            last
          />
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-card p-6 shadow-sm lg:hidden sm:p-7">
        <div className="mb-4 flex items-center gap-3">
          <SectionIcon>{profileIcons.wrench}</SectionIcon>
          <h3 className="text-base font-semibold text-foreground">Admin tools</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            to={ROUTES.ADMIN_RECEPTIONISTS}
            className="rounded-xl border border-border px-4 py-3 text-sm font-medium text-foreground hover:bg-surface"
          >
            Receptionists
          </Link>
          <Link
            to={ROUTES.ADMIN_SETTINGS}
            className="rounded-xl border border-border px-4 py-3 text-sm font-medium text-foreground hover:bg-surface"
          >
            Settings
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-card p-6 shadow-sm sm:p-7">
        <div className="mb-6 flex items-center gap-3">
          <SectionIcon>{profileIcons.building}</SectionIcon>
          <h3 className="text-base font-semibold text-foreground">Clinic Information</h3>
        </div>
        <div
          className={`grid gap-6 ${
            accountCreated ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
          }`}
        >
          <div className="sm:border-r sm:border-slate-200 sm:pr-6">
            <p className="text-xs font-medium text-slate-500">Clinic Name</p>
            <p className="mt-1.5 text-sm font-semibold text-slate-900">{CLINIC_NAME}</p>
          </div>
          <div className={accountCreated ? 'sm:border-r sm:border-slate-200 sm:px-6' : 'sm:pl-6'}>
            <p className="text-xs font-medium text-slate-500">Your Role</p>
            <p className="mt-1.5 text-sm font-semibold text-slate-900">System Administrator</p>
          </div>
          {accountCreated ? (
            <div className="sm:pl-6">
              <p className="text-xs font-medium text-slate-500">Account Created</p>
              <p className="mt-1.5 text-sm font-semibold text-slate-900">{accountCreated}</p>
            </div>
          ) : null}
        </div>
      </section>

      <p className="pt-4 text-center text-xs text-muted">
        © {new Date().getFullYear()} {CLINIC_NAME}. All rights reserved.
      </p>

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
