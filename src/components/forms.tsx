"use client";
import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { api } from "@/lib/client";
export function SpamField() {
  return (
    <>
      <div className="honeypot" aria-hidden="true">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <Captcha />
    </>
  );
}
type Turnstile = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
    },
  ) => string;
  remove: (id: string) => void;
};
function Captcha() {
  const [ready, setReady] = useState(false),
    [token, setToken] = useState("");
  const element = useRef<HTMLDivElement>(null);
  const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  useEffect(() => {
    const provider = (window as unknown as { turnstile?: Turnstile }).turnstile;
    if (!ready || !provider || !sitekey || !element.current) return;
    const id = provider.render(element.current, {
      sitekey,
      callback: setToken,
      "expired-callback": () => setToken(""),
    });
    return () => provider.remove(id);
  }, [ready, sitekey]);
  if (!sitekey) return null;
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        onReady={() => setReady(true)}
      />
      <div ref={element} />
      <input type="hidden" name="turnstileToken" value={token} />
    </>
  );
}
export function useSubmit(kind: "inquiry" | "viewing" | "custom") {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(false);
  const previous = useRef({ body: "", key: "" });
  async function submit(data: Record<string, unknown>) {
    if (busy) return false;
    setBusy(true);
    setError("");
    const body = JSON.stringify(data);
    if (previous.current.body !== body)
      previous.current = { body, key: crypto.randomUUID() };
    try {
      await api(`/api/requests/${kind}`, {
        ...data,
        submissionKey: previous.current.key,
      });
      setSuccess(true);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, success, submit };
}
