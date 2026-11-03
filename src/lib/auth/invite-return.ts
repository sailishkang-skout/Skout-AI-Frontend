/** The invite a person was accepting before they left to sign in (SSO or password). 30 minutes. */
export const INVITE_RETURN_COOKIE = "skout_invite_return";
export const INVITE_RETURN_MAX_AGE = 30 * 60;

/** Invite tokens are 64 hex characters; anything else is ignored. */
export function isInviteToken(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

/** Browser only: remember the invite so sign-in comes back to accept it. */
export function rememberInvite(token: string) {
  if (!isInviteToken(token)) return;
  document.cookie = `${INVITE_RETURN_COOKIE}=${token}; path=/; max-age=${INVITE_RETURN_MAX_AGE}; samesite=lax`;
}
