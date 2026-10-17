import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api, AuthError, type AuthConfig } from '../lib/api'

/**
 * Admin sign-in through Squawk (Nathan's auth service).
 *
 * Without `?login_challenge=` this page only offers "Sign in", which sends the
 * browser to /api/v1/auth/start → Squawk /oauth/authorize. Squawk parks the
 * request and sends the browser back here with a `login_challenge`; we then
 * complete a passkey or emailed-code ceremony through the backend proxies and
 * finally follow `redirect_to` (our /auth/callback, which sets the cookie).
 *
 * The username/password form only renders when the backend reports it as
 * enabled (no SQUAWK_ISSUER locally, or the ADMIN_PASSWORD_LOGIN break-glass).
 */

const CALLBACK_ERRORS: Record<string, string> = {
  access_denied: 'Sign-in was cancelled.',
  state_mismatch: 'This sign-in attempt expired or was already used. Start over.',
  invalid_token: 'Squawk returned a token this site could not verify.',
  invalid_grant: 'The sign-in code was rejected. Start over.',
  invalid_request: 'Malformed sign-in response. Start over.',
  signup_closed: 'No account exists for that identity.',
  server_error: 'The sign-in service is unavailable. Try again shortly.',
  login_expired: 'This sign-in attempt expired. Start over.',
}

// base64url <-> ArrayBuffer, the WebAuthn JSON convention (same helpers as the Squawk console).
const toBuf = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), c => c.charCodeAt(0))
const toB64 = (buf: ArrayBuffer | null) =>
  buf ? btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : undefined

function decodeAssertionOptions(pk: PublicKeyCredentialRequestOptionsJSON): PublicKeyCredentialRequestOptions {
  if ('parseRequestOptionsFromJSON' in PublicKeyCredential) {
    return PublicKeyCredential.parseRequestOptionsFromJSON(pk)
  }
  return {
    challenge: toBuf(pk.challenge),
    rpId: pk.rpId,
    timeout: pk.timeout,
    userVerification: pk.userVerification as UserVerificationRequirement | undefined,
    allowCredentials: (pk.allowCredentials ?? []).map(c => ({
      type: c.type as PublicKeyCredentialType,
      id: toBuf(c.id),
      transports: c.transports as AuthenticatorTransport[] | undefined,
    })),
    extensions: pk.extensions as AuthenticationExtensionsClientInputs | undefined,
  }
}

function decodeCreationOptions(pk: PublicKeyCredentialCreationOptionsJSON): PublicKeyCredentialCreationOptions {
  if ('parseCreationOptionsFromJSON' in PublicKeyCredential) {
    return PublicKeyCredential.parseCreationOptionsFromJSON(pk)
  }
  return {
    challenge: toBuf(pk.challenge),
    rp: pk.rp,
    user: { ...pk.user, id: toBuf(pk.user.id) },
    pubKeyCredParams: pk.pubKeyCredParams.map(p => ({ type: p.type as PublicKeyCredentialType, alg: p.alg })),
    timeout: pk.timeout,
    attestation: pk.attestation as AttestationConveyancePreference | undefined,
    authenticatorSelection: pk.authenticatorSelection,
    excludeCredentials: (pk.excludeCredentials ?? []).map(c => ({
      type: c.type as PublicKeyCredentialType,
      id: toBuf(c.id),
      transports: c.transports as AuthenticatorTransport[] | undefined,
    })),
    extensions: pk.extensions as AuthenticationExtensionsClientInputs | undefined,
  }
}

function encodeAttestation(cred: PublicKeyCredential) {
  if ('toJSON' in cred && typeof cred.toJSON === 'function') return cred.toJSON()
  const r = cred.response as AuthenticatorAttestationResponse
  return {
    id: cred.id,
    rawId: toB64(cred.rawId),
    type: cred.type,
    authenticatorAttachment: cred.authenticatorAttachment ?? undefined,
    clientExtensionResults: cred.getClientExtensionResults(),
    response: {
      clientDataJSON: toB64(r.clientDataJSON),
      attestationObject: toB64(r.attestationObject),
      transports: typeof r.getTransports === 'function' ? r.getTransports() : undefined,
    },
  }
}

/** A human label for the passkey, e.g. "MacIntel" — editable later in the Squawk console. */
const deviceName = () => (navigator.platform || 'This device').slice(0, 64)

function encodeAssertion(cred: PublicKeyCredential) {
  if ('toJSON' in cred && typeof cred.toJSON === 'function') return cred.toJSON()
  const r = cred.response as AuthenticatorAssertionResponse
  return {
    id: cred.id,
    rawId: toB64(cred.rawId),
    type: cred.type,
    authenticatorAttachment: cred.authenticatorAttachment ?? undefined,
    clientExtensionResults: cred.getClientExtensionResults(),
    response: {
      clientDataJSON: toB64(r.clientDataJSON),
      authenticatorData: toB64(r.authenticatorData),
      signature: toB64(r.signature),
      userHandle: toB64(r.userHandle),
    },
  }
}

const inputClass =
  'w-full px-3.5 py-2.5 bg-white border border-mist rounded-lg text-sm text-ink placeholder-silver focus:outline-none focus:border-blue/50 focus:ring-2 focus:ring-blue/10 transition-all'
const labelClass = 'block font-mono text-[11px] text-steel mb-1.5 tracking-wider uppercase'
const primaryBtn =
  'w-full py-2.5 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors disabled:opacity-60 disabled:cursor-not-allowed'
const secondaryBtn =
  'w-full py-2.5 bg-white text-ink border border-mist font-mono text-xs font-semibold rounded-lg hover:border-blue/50 hover:text-blue transition-colors disabled:opacity-60 disabled:cursor-not-allowed'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const loginChallenge = params.get('login_challenge')
  const callbackError = params.get('error')
  // Set by the admin auth guard when /auth/verify failed with a 5xx / network error.
  const guardNotice = (location.state as { error?: string } | null)?.error ?? null

  const [config, setConfig] = useState<AuthConfig | null>(null)
  const [error, setError] = useState<string | null>(
    callbackError ? (CALLBACK_ERRORS[callbackError] ?? `Sign-in failed (${callbackError}).`) : null,
  )
  const [busy, setBusy] = useState(false)

  // Challenge-page state
  const [method, setMethod] = useState<'choose' | 'email' | 'setup'>('choose')
  const [email, setEmail] = useState('')
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [code, setCode] = useState('')

  // Password fallback state
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (loginChallenge) return
    api.auth.config().then(setConfig).catch(() => setConfig({ mode: 'squawk', password_login: false }))
  }, [loginChallenge])

  const fail = (err: unknown, fallback: string) => {
    setError(err instanceof AuthError ? err.message : fallback)
  }

  const startSquawk = () => {
    setBusy(true)
    window.location.assign(api.auth.startUrl)
  }

  const usePasskey = async () => {
    if (!loginChallenge) return
    setError(null)
    setBusy(true)
    try {
      const begin = await api.auth.passkeyBegin(loginChallenge)
      const cred = await navigator.credentials.get({ publicKey: decodeAssertionOptions(begin.options.publicKey) })
      if (!cred) throw new Error('no credential')
      const { redirect_to } = await api.auth.passkeyFinish(begin.challenge_id, encodeAssertion(cred as PublicKeyCredential))
      window.location.assign(redirect_to)
    } catch (err) {
      if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'AbortError')) {
        setError('Passkey prompt was cancelled.')
      } else {
        fail(err, 'Passkey sign-in failed.')
      }
      setBusy(false)
    }
  }

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!loginChallenge) return
    setError(null)
    setBusy(true)
    try {
      const { challenge_id } = method === 'setup'
        ? await api.auth.passkeySetupBegin(loginChallenge, email.trim())
        : await api.auth.emailBegin(loginChallenge, email.trim())
      setChallengeId(challenge_id)
      setCode('')
    } catch (err) {
      fail(err, 'Could not send a code.')
    } finally {
      setBusy(false)
    }
  }

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!challengeId) return
    setError(null)
    setBusy(true)
    try {
      if (method === 'setup') {
        const setup = await api.auth.passkeySetupFinish(challengeId, code)
        const cred = await navigator.credentials.create({ publicKey: decodeCreationOptions(setup.options.publicKey) })
        if (!cred) throw new Error('no credential')
        const { redirect_to } = await api.auth.passkeySetupRegister(
          setup.user_id, setup.challenge_id, deviceName(), encodeAttestation(cred as PublicKeyCredential))
        window.location.assign(redirect_to)
        return
      }
      const { redirect_to } = await api.auth.emailFinish(challengeId, code)
      window.location.assign(redirect_to)
    } catch (err) {
      if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'AbortError')) {
        // The code was consumed; the creation challenge is single-use, so start the setup over.
        setError('Passkey creation was cancelled. Request a new code to try again.')
        setChallengeId(null)
      } else {
        fail(err, 'That code was not accepted.')
        if (err instanceof AuthError && err.code !== 'code_rejected') setChallengeId(null)
      }
      setBusy(false)
    }
  }

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await api.auth.login(username, password)
      navigate('/admin')
    } catch {
      setError('Invalid username or password.')
    } finally {
      setBusy(false)
    }
  }

  const passwordForm = (
    <form onSubmit={submitPassword} className="space-y-5">
      <div>
        <label className={labelClass}>Username</label>
        <input type="text" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required className={inputClass} />
      </div>
      <button type="submit" disabled={busy} className={primaryBtn}>
        {busy ? 'Signing in…' : 'Sign in with password'}
      </button>
    </form>
  )

  let body: React.ReactNode
  if (loginChallenge && method !== 'choose' && challengeId) {
    body = (
      <form onSubmit={submitCode} className="space-y-5">
        <p className="text-xs text-steel">
          We emailed a 6-digit code to <span className="font-mono text-ink">{email}</span>. It expires in 10 minutes.
          {method === 'setup' && ' After the code, your browser will ask to create a passkey.'}
        </p>
        <div>
          <label className={labelClass}>Code</label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
            required
            autoFocus
            className={`${inputClass} font-mono tracking-[0.3em] text-center`}
          />
        </div>
        <button type="submit" disabled={busy || code.length !== 6} className={primaryBtn}>
          {busy ? (method === 'setup' ? 'Creating passkey…' : 'Checking…') : method === 'setup' ? 'Verify and create passkey' : 'Verify code'}
        </button>
        <button type="button" onClick={() => { setChallengeId(null); setError(null) }} className="w-full font-mono text-[11px] text-steel hover:text-blue transition-colors">
          Use a different address
        </button>
      </form>
    )
  } else if (loginChallenge && method !== 'choose') {
    body = (
      <form onSubmit={sendCode} className="space-y-5">
        {method === 'setup' && (
          <p className="text-xs text-steel">We verify the address of your passkey account with a code, then this device creates its passkey.</p>
        )}
        <div>
          <label className={labelClass}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required autoFocus className={inputClass} />
        </div>
        <button type="submit" disabled={busy} className={primaryBtn}>
          {busy ? 'Sending…' : 'Email me a code'}
        </button>
        <button type="button" onClick={() => { setMethod('choose'); setError(null) }} className="w-full font-mono text-[11px] text-steel hover:text-blue transition-colors">
          Back
        </button>
      </form>
    )
  } else if (loginChallenge) {
    body = (
      <div className="space-y-3">
        <button type="button" onClick={usePasskey} disabled={busy} className={primaryBtn}>
          {busy ? 'Waiting for passkey…' : 'Use passkey'}
        </button>
        <button type="button" onClick={() => { setMethod('email'); setError(null) }} disabled={busy} className={secondaryBtn}>
          Email me a code
        </button>
        <button type="button" onClick={() => { setMethod('setup'); setError(null) }} disabled={busy} className="w-full pt-1 font-mono text-[11px] text-steel hover:text-blue transition-colors disabled:opacity-60">
          Set up a passkey on this device
        </button>
      </div>
    )
  } else if (config === null) {
    body = (
      <div className="space-y-3 animate-pulse" aria-hidden>
        <div className="h-10 rounded-lg bg-mist/60" />
      </div>
    )
  } else if (config.mode === 'password') {
    body = passwordForm
  } else {
    body = (
      <div className="space-y-5">
        <button type="button" onClick={startSquawk} disabled={busy} className={primaryBtn}>
          {busy ? 'Redirecting…' : 'Sign in'}
        </button>
        <p className="font-mono text-[10px] text-silver tracking-wider text-center">PASSKEY OR EMAIL CODE VIA SQUAWK</p>
        {config.password_login && (
          <details className="pt-2 border-t border-mist">
            <summary className="cursor-pointer font-mono text-[11px] text-steel hover:text-blue transition-colors">Break-glass password login</summary>
            <div className="mt-4">{passwordForm}</div>
          </details>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cloud flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="bg-white border border-mist rounded-2xl p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-9 h-9 bg-blue rounded-lg flex items-center justify-center">
              <span className="font-mono text-white text-sm font-bold">NB</span>
            </div>
            <div>
              <span className="text-sm font-medium text-ink block leading-tight">Admin Panel</span>
              <span className="font-mono text-[10px] text-steel tracking-wider">PORTFOLIO CMS</span>
            </div>
          </div>

          {guardNotice && (
            <p className="mb-5 px-3 py-2 rounded-lg bg-ember/5 border border-ember/20 text-xs text-ember font-mono">{guardNotice}</p>
          )}

          {error && (
            <p className="mb-5 text-xs text-ember font-mono" role="alert">{error}</p>
          )}

          {body}
        </div>
      </div>
    </div>
  )
}
