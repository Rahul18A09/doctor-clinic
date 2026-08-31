export function getApiErrorMessage(error, fallback = 'Something went wrong.') {
  const data = error.response?.data

  if (!data) {
    if (error.request) return 'Unable to reach the server. Is the backend running?'
    return error.message || fallback
  }

  if (typeof data === 'string') return data

  if (data.message) return data.message

  if (data.errors) {
    const { errors } = data
    for (const key of Object.keys(errors)) {
      const value = errors[key]
      if (Array.isArray(value) && value.length > 0) return value[0]
      if (typeof value === 'string') return value
    }
  }

  return fallback
}
