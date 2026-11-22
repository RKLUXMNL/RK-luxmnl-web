import { HttpError } from "./security";
export async function checkSpam(token?: string) {
  if (!process.env.TURNSTILE_SECRET_KEY) return;
  if (!token) throw new HttpError(400, "Please complete the verification.");
  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: new URLSearchParams({
        secret: process.env.TURNSTILE_SECRET_KEY,
        response: token,
      }),
    },
  );
  const result = await res.json();
  if (!result.success)
    throw new HttpError(400, "Verification expired. Please try again.");
}
