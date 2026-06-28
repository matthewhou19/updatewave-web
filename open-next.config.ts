import { defineCloudflareConfig } from '@opennextjs/cloudflare'

// Minimal config: no R2/KV incremental cache binding, to keep the deploy on
// Cloudflare's free tier with zero extra products. ISR/`revalidate` pages fall
// back to per-isolate regeneration (acceptable for this app's low-churn pages).
// Add an incremental-cache override here later if persistent ISR is needed.
export default defineCloudflareConfig()
