import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { authService } from '@/api/auth'
import { apiMessage } from '@/components/profile/ProfileShared'
import { Button, Input, Modal, ModalSpinner, PasswordInput } from '@/components/ui'

export function EditProfileModal({ open, user, onClose, onSaved, showSuccess, showError }) {
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

export function ChangePasswordModal({ open, onClose, showSuccess, showError }) {
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
