This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3001](http://localhost:3001) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Mapbox Configuration

The defense dashboard uses Mapbox GL JS for the live map. Supply a valid token via environment variables before running the app:

1. Create a `.env.local` file in the project root (if it does not already exist).
2. Add your Mapbox token:
   ```
   MAPBOX_ACCESS_TOKEN=pk.your-token-goes-here
   ```
3. Restart the Next.js dev server so the new environment variable is loaded.

The frontend requests the token via `GET /api/mapbox/token`. If the variable is missing or invalid, the request returns an error and the dashboard will show an overlay explaining how to retry.  
If you prefer to embed a token directly in the bundle, you can optionally set `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`, which is used as a fallback when the API route is unreachable.