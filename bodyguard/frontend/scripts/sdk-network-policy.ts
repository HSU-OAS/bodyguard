import type { Plugin } from 'vite'

// NFR-08: enforce before SDK execution; no external reporting endpoint.
export const SDK_NETWORK_POLICY = [
  "default-src 'self'",
  "connect-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ')
// React/Vite's development-only refresh preamble; never in the production policy.
export const SDK_DEV_POLICY = SDK_NETWORK_POLICY.replace(
  "script-src 'self' 'wasm-unsafe-eval'",
  "script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline'",
)
export function sdkNetworkPolicyPlugin(): Plugin {
  return {
    name: 'bodyguard-sdk-network-policy',
    transformIndexHtml: {
      order: 'pre',
      handler(_html, context) {
        return [
          {
            tag: 'meta',
            attrs: {
              'http-equiv': 'Content-Security-Policy',
              content: context.server ? SDK_DEV_POLICY : SDK_NETWORK_POLICY,
            },
            injectTo: 'head-prepend',
          },
        ]
      },
    },
  }
}
