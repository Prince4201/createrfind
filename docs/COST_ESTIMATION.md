# Cost Estimation

Monthly estimates based on moderate usage (500 discovery runs/month targeting ~15,000 channels).

## Google Cloud Run
| Resource | Estimate |
|----------|----------|
| vCPU | 10 hrs/month → ~$0.48 |
| Memory | 512 MB × 10 hrs → ~$0.25 |
| Requests | ~5,000/month → free tier |
| **Subtotal** | **~$1/month** |

## Google Firestore
| Resource | Estimate |
|----------|----------|
| Reads | ~50,000/month → free tier covers 50K/day |
| Writes | ~15,000/month → free tier covers 20K/day |
| Storage | ~100 MB → ~$0.18 |
| **Subtotal** | **~$0.18/month** (mostly free tier) |

## YouTube Data API v3
| Resource | Estimate |
|----------|----------|
| Free quota | 10,000 units/day |
| search.list | 100 units/call |
| channels.list | 1 unit/call |
| videos.list | 1 unit/call |
| **Subtotal** | **Free** (within daily quota for moderate usage) |

## SendGrid
| Resource | Estimate |
|----------|----------|
| Free tier | 100 emails/day |
| Essentials plan | $19.95/month for 50K emails |
| **Subtotal** | **Free – $19.95/month** |

## Google Sheets API
| Resource | Estimate |
|----------|----------|
| Free tier | Unlimited reads/writes |
| **Subtotal** | **Free** |

## Firebase Authentication
| Resource | Estimate |
|----------|----------|
| Free tier | 10K phone auths, unlimited email/password |
| **Subtotal** | **Free** |

---

## Total Monthly Estimate

| Tier | Estimate |
|------|----------|
| **Low usage** (free tiers) | **~$0–1/month** |
| **Moderate usage** | **~$5–20/month** |
| **High usage** (50K+ emails) | **~$25–50/month** |
