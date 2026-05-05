import axios from 'axios'

export interface AuthProfile {
  accessToken: string
  clientToken: string
  username: string
  uuid: string        // no dashes
  email: string
}

export async function register(
  serverUrl: string,
  username: string,
  email: string,
  password: string
): Promise<void> {
  const res = await axios.post(`${serverUrl}/api/register`, { username, email, password }, { timeout: 10000 })
  if (!res.data.success) {
    throw new Error(res.data.error || 'Registration failed')
  }
}

export async function login(
  serverUrl: string,
  username: string,
  password: string,
  clientToken?: string
): Promise<AuthProfile> {
  const res = await axios.post(
    `${serverUrl}/authserver/authenticate`,
    { username, password, clientToken, requestUser: true },
    { timeout: 10000 }
  )

  const data = res.data
  if (!data.accessToken) {
    throw new Error(data.errorMessage || 'Login failed')
  }

  return {
    accessToken: data.accessToken,
    clientToken: data.clientToken,
    username: data.selectedProfile.name,
    uuid: data.selectedProfile.id,
    email: data.user?.email || ''
  }
}

export async function validate(serverUrl: string, accessToken: string, clientToken: string): Promise<boolean> {
  try {
    await axios.post(`${serverUrl}/authserver/validate`, { accessToken, clientToken }, { timeout: 5000 })
    return true
  } catch {
    return false
  }
}

export async function logout(serverUrl: string, accessToken: string): Promise<void> {
  try {
    await axios.post(`${serverUrl}/authserver/invalidate`, { accessToken }, { timeout: 5000 })
  } catch {
    // ignore errors on logout
  }
}
