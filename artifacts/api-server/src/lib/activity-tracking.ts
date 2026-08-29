import crypto from "node:crypto";
import type { Request } from "express";
import { count, countDistinct, eq, isNotNull } from "drizzle-orm";
import { activityEvents, databaseConfigured, db } from "@workspace/db";
import { logger } from "./logger";

export const clientActivityTypes = new Set([
  "visit",
  "page_view",
  "click",
  "engagement",
  "login_start",
  "signup_start",
]);

const sensitiveKeyPattern = /(access|refresh|oauth|proposal|session|secret|password|token|authorization|cookie|email|phone|loginid|account.?id)/i;
const metadataKeysByEvent: Record<string, Set<string>> = {
  visit: new Set(),
  page_view: new Set(),
  click: new Set(["element", "destination", "action"]),
  engagement: new Set(["seconds"]),
  login_start: new Set(["flow"]),
  signup_start: new Set(["flow"]),
  oauth_login_success: new Set(["flow"]),
  oauth_signup_success: new Set(["flow"]),
  oauth_failure: new Set(["reason"]),
  account_connection: new Set(["accountType", "action"]),
  market_scan: new Set(["scannedCount", "availableCount", "bestMarket"]),
  bot_run: new Set(["market", "mode", "status"]),
  trade_preview: new Set(["market", "contractType", "duration", "hasStopLoss"]),
  trade_accepted: new Set(["market", "contractType", "accountType", "duration"]),
  settlement: new Set(["status", "hasPayout", "settled"]),
  pnl_result: new Set(["result", "netProfit"]),
};

function safePath(value: unknown) {
  if (typeof value !== "string") return null;
  const path = value.split(/[?#]/, 1)[0]?.slice(0, 200);
  return path?.startsWith("/") ? path : null;
}

function safeMetadata(eventType: string, value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const output: Record<string, string | number | boolean | null> = {};
  const allowedKeys = metadataKeysByEvent[eventType] || new Set<string>();
  for (const [key, item] of Object.entries(value).slice(0, 20)) {
    if (!allowedKeys.has(key) || sensitiveKeyPattern.test(key)) continue;
    if (typeof item === "string" && /^[a-zA-Z0-9_./:-]{0,120}$/.test(item)) output[key] = item;
    else if (typeof item === "number" && Number.isFinite(item)) output[key] = item;
    else if (typeof item === "boolean" || item === null) output[key] = item;
  }
  return output;
}

function hashVisitor(visitorId: unknown) {
  if (typeof visitorId !== "string" || !/^[a-zA-Z0-9-]{16,80}$/.test(visitorId)) return null;
  return crypto.createHash("sha256")
    .update(`${process.env.SESSION_SECRET || "protraders-fx"}:${visitorId}`)
    .digest("hex");
}

export async function recordActivity(input: {
  eventType: string;
  req?: Request;
  visitorId?: unknown;
  ownerKey?: string | null;
  path?: unknown;
  metadata?: unknown;
}) {
  if (!databaseConfigured) return false;
  try {
    const eventType = input.eventType.slice(0, 80);
    await db.insert(activityEvents).values({
      eventType,
      visitorKeyHash: hashVisitor(input.visitorId ?? input.req?.body?.visitorId),
      ownerKey: input.ownerKey || null,
      path: safePath(input.path ?? input.req?.body?.path ?? input.req?.path),
      metadata: safeMetadata(eventType, input.metadata ?? input.req?.body?.metadata),
    });
    return true;
  } catch (error) {
    (input.req?.log || logger).warn({ err: error, eventType: input.eventType }, "Activity event could not be persisted");
    return false;
  }
}

export async function activitySummary() {
  if (!databaseConfigured) {
    return {
      visitors: 0,
      visits: 0,
      pagesViewed: 0,
      registrations: 0,
      oauthSuccesses: 0,
      fundedAccounts: null,
      events: {},
      persistent: false,
      note: "Persistent analytics require DATABASE_URL or POSTGRES_URL. Funded-account status remains available only in Deriv Partner Hub.",
    };
  }

  const [breakdown, uniqueVisitors] = await Promise.all([
    db.select({ eventType: activityEvents.eventType, total: count() })
      .from(activityEvents)
      .groupBy(activityEvents.eventType),
    db.select({ total: countDistinct(activityEvents.visitorKeyHash) })
      .from(activityEvents)
      .where(isNotNull(activityEvents.visitorKeyHash)),
  ]);
  const events = Object.fromEntries(breakdown.map((row) => [row.eventType, Number(row.total)]));
  return {
    visitors: Number(uniqueVisitors[0]?.total || 0),
    visits: Number(events.visit || 0),
    pagesViewed: Number(events.page_view || 0),
    registrations: Number(events.oauth_signup_success || 0),
    oauthSuccesses: Number(events.oauth_login_success || 0) + Number(events.oauth_signup_success || 0),
    fundedAccounts: null,
    events,
    persistent: true,
    note: "Aggregates contain privacy-conscious activity records only. Funded-account status remains available only in Deriv Partner Hub.",
  };
}