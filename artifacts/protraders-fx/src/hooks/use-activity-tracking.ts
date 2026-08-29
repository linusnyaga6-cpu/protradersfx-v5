import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

type ClientEventType = "visit" | "page_view" | "click" | "engagement" | "login_start" | "signup_start";

function visitorId() {
  const key = "ptfx_visitor_id";
  let value = localStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID();
    localStorage.setItem(key, value);
  }
  return value;
}

function send(type: ClientEventType, path: string, metadata: Record<string, string | number | boolean> = {}, beacon = false) {
  const body = JSON.stringify({ type, path: path.split(/[?#]/, 1)[0], visitorId: visitorId(), metadata });
  if (beacon && navigator.sendBeacon) {
    navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
    return;
  }
  void fetch("/api/track", {
    method: "POST",
    credentials: "same-origin",
    keepalive: true,
    headers: { "content-type": "application/json" },
    body,
  }).catch(() => undefined);
}

export function ActivityTracker() {
  const [location] = useLocation();
  const pageStartedAt = useRef(Date.now());

  useEffect(() => {
    if (!sessionStorage.getItem("ptfx_visit_recorded")) {
      sessionStorage.setItem("ptfx_visit_recorded", "1");
      send("visit", location);
    }
    send("page_view", location);
    pageStartedAt.current = Date.now();
  }, [location]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = (event.target as Element | null)?.closest<HTMLElement>("a,button,[data-track]");
      if (!target) return;
      const href = target instanceof HTMLAnchorElement ? target.getAttribute("href") || "" : "";
      const type: ClientEventType = href.startsWith("/api/deriv/signup")
        ? "signup_start"
        : href.startsWith("/api/deriv/login")
          ? "login_start"
          : "click";
      const destination = href.startsWith("/") ? href.split(/[?#]/, 1)[0] : "";
      send(type, location, {
        element: target.tagName.toLowerCase(),
        ...(destination ? { destination } : {}),
        ...(target.dataset.track ? { action: target.dataset.track.slice(0, 80) } : {}),
      }, type !== "click");
    };
    const onVisibility = () => {
      if (document.visibilityState !== "hidden") return;
      const seconds = Math.min(1_800, Math.max(1, Math.round((Date.now() - pageStartedAt.current) / 1_000)));
      send("engagement", location, { seconds }, true);
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [location]);

  return null;
}