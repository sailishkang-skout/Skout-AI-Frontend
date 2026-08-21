/**
 * Docker overwrites this file with a string literal before `next build` so Edge
 * middleware can see GATE_TOKEN. Local `next dev` reads process.env instead.
 * Do not import this from client components.
 */
export const GATE_TOKEN_VALUE = process.env.GATE_TOKEN ?? "";
