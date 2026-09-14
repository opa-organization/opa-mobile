export type AuthFormValues = {
  email: string
  password: string
  username: string
  displayName: string
  acceptTerms: boolean
}

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const USERNAME_REGEX = /^[a-z0-9._]+$/
