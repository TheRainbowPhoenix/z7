import posthog from 'posthog-js';
import type { PostHogConfig } from 'posthog-js';

const posthogApiKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
const hasPosthogApiKey = typeof posthogApiKey === 'string' && posthogApiKey.length > 0;
const posthogOptions = {
  api_host: 'https://eu.i.posthog.com',
  defaults: '2025-05-24',
  capture_exceptions: import.meta.env.MODE === 'production',
  person_profiles: 'always',
  debug: false,
  rageclick: {
    css_selector_ignorelist: ['.ph-ignore-rageclick'],
  },
} satisfies Partial<PostHogConfig>;

if (hasPosthogApiKey) {
  if (posthog.__loaded) {
    posthog.set_config(posthogOptions);
  } else {
    posthog.init(posthogApiKey, posthogOptions);
  }
}

export { posthog };
