import { auth as authenticate, JWTPayload } from "express-oauth2-jwt-bearer";

export const auth0Middleware = authenticate({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
  tokenSigningAlg: "RS256",
});