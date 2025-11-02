# Quick Setup Guide

Follow these steps to get your Stripe Revenue Dashboard up and running.

## Step 1: Install Dependencies

\`\`\`bash
cd nextjs-dashboard
npm install
\`\`\`

This will install all required packages including:
- Next.js 14
- React 18
- shadcn/ui components
- Stripe SDK
- Recharts
- Tailwind CSS
- TypeScript

## Step 2: Configure Environment Variables

Create a `.env.local` file in the `nextjs-dashboard` directory:

\`\`\`bash
touch .env.local
\`\`\`

Add your Stripe secret key:

\`\`\`
STRIPE_SECRET_KEY=sk_test_51ABC...
\`\`\`

### Where to find your Stripe Secret Key:

1. Log in to your [Stripe Dashboard](https://dashboard.stripe.com)
2. Click on **Developers** in the left sidebar
3. Click on **API keys**
4. Copy your **Secret key** (it starts with `sk_test_` for test mode or `sk_live_` for live mode)

**⚠️ Important:** Never commit your `.env.local` file to version control. It's already in `.gitignore`.

## Step 3: Run the Development Server

\`\`\`bash
npm run dev
\`\`\`

## Step 4: Open the Dashboard

Open your browser and navigate to:

\`\`\`
http://localhost:3000
\`\`\`

You should see your revenue dashboard loading data from Stripe!

## Troubleshooting

### Issue: "STRIPE_SECRET_KEY is not set in environment variables"

**Solution:** Make sure you created `.env.local` (not just `.env`) and it contains:
\`\`\`
STRIPE_SECRET_KEY=sk_test_your_actual_key_here
\`\`\`

Then restart the development server.

### Issue: "No subscription data found in your Stripe account"

**Solution:** You need to have at least one subscription in your Stripe account. To create test subscriptions:

1. Go to your [Stripe Dashboard](https://dashboard.stripe.com)
2. Make sure you're in **Test mode** (toggle in the top right)
3. Go to **Products** → Create a product with a recurring price
4. Go to **Customers** → Create a test customer
5. Create a subscription for that customer

### Issue: Charts not displaying

**Solution:** 
- Check the browser console for errors
- Verify data is loading by opening the Network tab and checking the `/api/stripe` request
- Make sure you have subscription data spanning multiple months

### Issue: Port 3000 already in use

**Solution:** Either stop the other process using port 3000, or run on a different port:
\`\`\`bash
PORT=3001 npm run dev
\`\`\`

## Next Steps

- **Customize the UI:** Edit colors in `app/globals.css`
- **Add more metrics:** Modify `lib/data-processor.ts`
- **Deploy:** Use Vercel, AWS, or any Node.js hosting provider

## Building for Production

When you're ready to deploy:

\`\`\`bash
npm run build
npm start
\`\`\`

Make sure to set `STRIPE_SECRET_KEY` in your production environment variables.

## Need Help?

- [Next.js Documentation](https://nextjs.org/docs)
- [shadcn/ui Documentation](https://ui.shadcn.com)
- [Stripe API Reference](https://stripe.com/docs/api)
- [Recharts Documentation](https://recharts.org)

