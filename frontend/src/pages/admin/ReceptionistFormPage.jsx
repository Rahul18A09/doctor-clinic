import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { receptionistService } from '@/api/receptionists'
import { BackButton, Button, Input, PasswordInput, Select } from '@/components/ui'
import { useToast } from '@/context/ToastContext'
import { useNotifications } from '@/hooks/useNotifications'
import { GENDERS, ROUTES } from '@/utils/constants'

export function ReceptionistFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { showSuccess, showError } = useToast()
  const { refresh: refreshNotifications } = useNotifications()
  const [loading, setLoading] = useState(isEdit)
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      full_name: '',
      email: '',
      mobile: '',
      password: '',
      confirm_password: '',
      gender: '',
    },
  })

  useEffect(() => {
    if (!isEdit) return

    async function loadReceptionist() {
      try {
        const { data: res } = await receptionistService.get(id)
        const r = res.data.receptionist
        reset({
          full_name: r.full_name,
          email: r.email,
          mobile: r.mobile,
          gender: r.gender,
          password: '',
          confirm_password: '',
        })
      } catch (err) {
        showError(err.response?.data?.message || err.message)
        navigate(ROUTES.ADMIN_RECEPTIONISTS)
      } finally {
        setLoading(false)
      }
    }

    loadReceptionist()
  }, [id, isEdit, reset, navigate, showError])

  const onSubmit = async (formData) => {
    setSubmitting(true)
    try {
      if (isEdit) {
        const payload = {
          full_name: formData.full_name.trim(),
          email: formData.email.toLowerCase().trim(),
          mobile: formData.mobile.trim(),
          gender: formData.gender,
        }
        await receptionistService.update(id, payload)
        showSuccess('Receptionist updated successfully.')
      } else {
        await receptionistService.create({
          full_name: formData.full_name.trim(),
          email: formData.email.toLowerCase().trim(),
          mobile: formData.mobile.trim(),
          gender: formData.gender,
          password: formData.password,
          confirm_password: formData.confirm_password,
        })
        await refreshNotifications()
        showSuccess('Receptionist created successfully.')
      }
      navigate(ROUTES.ADMIN_RECEPTIONISTS)
    } catch (err) {
      const apiErrors = err.response?.data?.errors
      if (apiErrors) {
        const first = Object.values(apiErrors).flat()[0]
        showError(first || err.response?.data?.message)
      } else {
        showError(err.response?.data?.message || err.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    )
  }

  return (
    <div className="animate-in">
      <div className="mb-6">
        <BackButton to={ROUTES.ADMIN_RECEPTIONISTS}>Back to Receptionists</BackButton>
      </div>
      <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">
          {isEdit ? 'Edit Receptionist' : 'Add Receptionist'}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {isEdit ? 'Update receptionist details.' : 'Create a new receptionist account.'}
        </p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-5 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-8"
      >
        <Input
          id="full_name"
          label="Full Name"
          placeholder="Enter full name"
          error={errors.full_name}
          {...register('full_name', { required: 'Full name is required' })}
        />

        <Input
          id="email"
          label="Email"
          type="email"
          placeholder="receptionist@clinic.com"
          error={errors.email}
          {...register('email', {
            required: 'Email is required',
            pattern: {
              value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
              message: 'Enter a valid email address',
            },
          })}
        />

        <Input
          id="mobile"
          label="Mobile"
          type="tel"
          placeholder="10-digit mobile number"
          error={errors.mobile}
          {...register('mobile', {
            required: 'Mobile number is required',
            pattern: {
              value: /^[0-9]{10}$/,
              message: 'Enter a valid 10-digit mobile number',
            },
          })}
        />

        <Select
          id="gender"
          label="Gender"
          options={GENDERS}
          error={errors.gender}
          {...register('gender', { required: 'Gender is required' })}
        />

        {!isEdit && (
          <>
            <PasswordInput
              id="password"
              label="Password"
              placeholder="Create password"
              error={errors.password}
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 8, message: 'Password must be at least 8 characters' },
              })}
            />

            <PasswordInput
              id="confirm_password"
              label="Confirm Password"
              placeholder="Confirm password"
              error={errors.confirm_password}
              {...register('confirm_password', {
                required: 'Please confirm your password',
                validate: (val) =>
                  val === watch('password') || 'Passwords do not match',
              })}
            />
          </>
        )}

        <div className="flex flex-wrap gap-3 pt-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving...' : isEdit ? 'Update Receptionist' : 'Create Receptionist'}
          </Button>
          <Link to={ROUTES.ADMIN_RECEPTIONISTS}>
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
      </div>
    </div>
  )
}
