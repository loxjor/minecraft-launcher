import axios from 'axios'
import { AuthMode } from './config'

export interface AuthProfile {
  accessToken: string
  clientToken: string
  username: string
  uuid: string        // no dashes
  email: string
}

// Build the correct auth endpoint URL per mode
function authUrl(mode: AuthMode, customBase: string, path: string): string {
  if (mode === 'ely')    return `https://authserver.ely.by/auth${path}`
  if (mode === 'mojang') return `https://authserver.mojang.com${path}`
  return `${customBase}/authserver${path}`
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
  mode: AuthMode,
  serverUrl: string,
  username: string,
  password: string,
  clientToken?: string
): Promise<AuthProfile> {
  const res = await axios.post(
    authUrl(mode, serverUrl, '/authenticate'),
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

export async function validate(mode: AuthMode, serverUrl: string, accessToken: string, clientToken: string): Promise<boolean> {
  try {
    await axios.post(authUrl(mode, serverUrl, '/validate'), { accessToken, clientToken }, { timeout: 5000 })
    return true
  } catch {
    return false
  }
}

export async function logout(mode: AuthMode, serverUrl: string, accessToken: string): Promise<void> {
  try {
    await axios.post(authUrl(mode, serverUrl, '/invalidate'), { accessToken }, { timeout: 5000 })
  } catch {
    // ignore errors on logout
  }
}
