"use client";

import { useEffect } from "react";

import {
  RECENT_VIEWS_COOKIE_NAME,
  buildRecentViewsCookieValue,
  getRecentViewSlugsFromCookie,
  mergeRecentViewSlug,
} from "../lib/recentViews";

interface RecentViewTrackerProps {
  slug: string;
}

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export default function RecentViewTracker({ slug }: RecentViewTrackerProps) {
  useEffect(() => {
    const existingSlugs = getRecentViewSlugsFromCookie(document.cookie);
    const nextSlugs = mergeRecentViewSlug(existingSlugs, slug);
    const value = buildRecentViewsCookieValue(nextSlugs);

    document.cookie = `${RECENT_VIEWS_COOKIE_NAME}=${value}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
  }, [slug]);

  return null;
}
