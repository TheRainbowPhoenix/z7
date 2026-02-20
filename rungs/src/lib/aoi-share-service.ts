import type { AOIDefinition } from '@repo/plc-core';
import { AOIDefinitionSchema } from '@repo/plc-core';
import { supabase } from './supabase-client';
import { analytics } from './posthog-analytics';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const RESET_TIME_FORMAT: Intl.DateTimeFormatOptions = {
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
};

const shareCache = new Map<string, { shareId: string; shareUrl: string }>();

export type RateLimitInfo = {
  remaining: number;
  resetAt?: Date;
};

export type ShareResult =
  | {
      success: true;
      shareId: string;
      shareUrl: string;
      fromCache?: boolean;
      rateLimit?: RateLimitInfo;
    }
  | { success: false; error: string; rateLimit?: RateLimitInfo };

export type GetShareResult =
  | { success: true; aoi: AOIDefinition }
  | { success: false; error: string };

async function hashAOI(aoi: AOIDefinition): Promise<string> {
  const aoiString = JSON.stringify(aoi);
  const encoder = new TextEncoder();
  const data = encoder.encode(aoiString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createShare(aoi: AOIDefinition): Promise<ShareResult> {
  if (!supabase || !supabaseUrl || !supabaseAnonKey) {
    return { success: false, error: 'Sharing is not configured' };
  }

  const aoiHash = await hashAOI(aoi);
  const cached = shareCache.get(aoiHash);
  if (cached) {
    return { success: true, ...cached, fromCache: true };
  }

  const aoiString = JSON.stringify(aoi);
  const aoiSizeBytes = new Blob([aoiString]).size;

  if (aoiSizeBytes > 102400) {
    return {
      success: false,
      error: `AOI too large to share (${Math.round(aoiSizeBytes / 1024)} KB). Maximum size is 100 KB.`,
    };
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/create-share`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supabaseAnonKey}`,
        apikey: supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ aoi_data: aoi }),
    });

    const result = (await response.json()) as {
      error?: string;
      shareId?: string;
      shareUrl?: string;
      remaining?: number;
    };

    const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
    const rateLimitReset = response.headers.get('x-ratelimit-reset');
    const rateLimit: RateLimitInfo | undefined =
      rateLimitRemaining != null
        ? {
            remaining: Number(rateLimitRemaining),
            resetAt: rateLimitReset ? new Date(Number(rateLimitReset)) : undefined,
          }
        : result.remaining != null
          ? { remaining: result.remaining }
          : undefined;

    if (!response.ok) {
      if (response.status === 429) {
        const resetAt = rateLimit?.resetAt;
        const formatted = resetAt?.toLocaleTimeString(undefined, RESET_TIME_FORMAT);
        const message = formatted
          ? `Rate limit exceeded. Try again after ${formatted}.`
          : 'Rate limit exceeded. Please try again later.';
        return { success: false, error: message, rateLimit };
      }

      return {
        success: false,
        error: result.error || `Request failed with status ${response.status}`,
        rateLimit,
      };
    }

    if (!result.shareId || !result.shareUrl) {
      return { success: false, error: result.error || 'Failed to create share', rateLimit };
    }

    shareCache.set(aoiHash, { shareId: result.shareId, shareUrl: result.shareUrl });

    analytics.trackShareCreated(aoi, result.shareId);

    return { success: true, shareId: result.shareId, shareUrl: result.shareUrl, rateLimit };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create share',
    };
  }
}

export async function getShare(shareId: string): Promise<GetShareResult> {
  if (!supabase) {
    return { success: false, error: 'Sharing is not configured' };
  }

  let data: { aoi_data: unknown } | null = null;
  let error: { code?: string; message: string } | null = null;

  try {
    const response = await supabase
      .from('shared_aois')
      .select('aoi_data')
      .eq('id', shareId)
      .eq('visibility', 'public')
      .single();
    data = response.data;
    error = response.error;
  } catch (caughtError) {
    return {
      success: false,
      error: caughtError instanceof Error ? caughtError.message : 'Failed to load shared AOI',
    };
  }

  if (error) {
    if (error.code === 'PGRST116') {
      return { success: false, error: 'Shared AOI not found' };
    }
    return { success: false, error: error.message };
  }

  if (!data) {
    return { success: false, error: 'Shared AOI not found' };
  }

  const parsed = AOIDefinitionSchema.safeParse(data.aoi_data);
  if (!parsed.success) {
    return { success: false, error: 'Invalid AOI data' };
  }

  await updateLastAccessed(shareId);

  analytics.trackSharedAoiLoaded(shareId, parsed.data);

  return { success: true, aoi: parsed.data };
}

async function updateLastAccessed(shareId: string): Promise<void> {
  if (!supabase) {
    return;
  }

  try {
    await supabase.rpc('update_shared_aoi_last_accessed', {
      share_id: shareId,
    });
  } catch { /* intentionally swallowed – fire-and-forget RPC */ }
}

export async function incrementForkCount(shareId: string): Promise<void> {
  if (!supabase) {
    return;
  }

  try {
    await supabase.rpc('increment_shared_aoi_fork_count', {
      share_id: shareId,
    });
  } catch { /* intentionally swallowed – fire-and-forget RPC */ }
}

export function isValidShareId(path: string): boolean {
  const shareIdPattern = /^\/[a-zA-Z0-9_-]{8}$/;
  return shareIdPattern.test(path);
}

export function extractShareId(path: string): string | null {
  if (isValidShareId(path)) {
    return path.slice(1);
  }
  return null;
}
