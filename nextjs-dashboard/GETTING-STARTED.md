# Getting Started with Your New Dashboard

## 🚀 Quick Start (5 minutes)

### 1. Install Dependencies

```bash
cd nextjs-dashboard
npm install
```

**What this does:** Installs Next.js, React, shadcn/ui components, Stripe SDK, Recharts, and all other dependencies.

### 2. Set Up Stripe API Key

Create a `.env.local` file:

```bash
echo "STRIPE_SECRET_KEY=your_stripe_key_here" > .env.local
```

Or manually create `.env.local` and add:

```
STRIPE_SECRET_KEY=sk_test_51ABC...your_actual_key...
```

**Where to get your Stripe key:**
1. Go to https://dashboard.stripe.com/apikeys
2. Copy your "Secret key" (starts with `sk_test_` or `sk_live_`)

### 3. Run the Dashboard

```bash
npm run dev
```

### 4. Open Your Browser

Visit: **http://localhost:3000**

🎉 **Done!** Your dashboard should be loading data from Stripe.

---

## 📋 What You Get

Your new dashboard includes:

### Key Metrics Cards
- **Total MRR** - Current monthly recurring revenue with growth %
- **New MRR** - Revenue from new subscriptions this month
- **Annual Revenue (ARR)** - Annualized recurring revenue
- **Churn Rate** - Customer cancellation rate
- **Active Customers** - Current subscriber count

### Interactive Charts
1. **MRR Analysis** - Stacked bar chart (New vs Existing MRR)
2. **Growth Trends** - Multi-line chart showing revenue trends
3. **Revenue by Plan** - Pie chart with product breakdown
4. **Customer Insights** - Dual-axis chart (new + total customers)

### Features
- ✅ Date range filtering (3m, 6m, 12m, all time)
- ✅ Period comparisons (Month-over-Month, Year-over-Year)
- ✅ Real-time data refresh
- ✅ Fully responsive (mobile, tablet, desktop)
- ✅ Beautiful, modern UI with shadcn/ui components

---

## 🎨 Customization

### Change Colors

Edit `app/globals.css` and modify the CSS variables:

```css
:root {
  --primary: 221.2 83.2% 53.3%;  /* Main blue color */
  --destructive: 0 84.2% 60.2%;   /* Red for errors */
  /* ... more colors ... */
}
```

### Add New Metrics

1. **Add calculation** in `lib/data-processor.ts`
2. **Update API** in `app/api/stripe/route.ts`
3. **Display metric** in `app/page.tsx` using `<MetricCard />`

Example:
```tsx
<MetricCard
  title="Your New Metric"
  value="$1,234"
  delta="+5.2%"
/>
```

### Modify Charts

All charts are in `components/dashboard/`:
- `mrr-chart.tsx` - MRR bar chart
- `growth-chart.tsx` - Line chart
- `revenue-pie-chart.tsx` - Pie chart
- `customer-chart.tsx` - Customer chart

They use Recharts - highly customizable!

---

## 🏗️ Project Structure

```
nextjs-dashboard/
├── app/                      # Next.js App Router
│   ├── api/stripe/          # API endpoint for Stripe data
│   ├── globals.css          # Global styles & theme
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Main dashboard page
│
├── components/
│   ├── dashboard/           # Dashboard-specific components
│   │   ├── metric-card.tsx
│   │   ├── mrr-chart.tsx
│   │   ├── growth-chart.tsx
│   │   ├── revenue-pie-chart.tsx
│   │   └── customer-chart.tsx
│   └── ui/                  # shadcn/ui base components
│       ├── button.tsx
│       ├── card.tsx
│       ├── tabs.tsx
│       └── select.tsx
│
├── lib/                     # Utilities & business logic
│   ├── data-processor.ts   # Stripe data calculations
│   ├── stripe.ts           # Stripe API client
│   └── utils.ts            # Helper functions
│
└── Configuration files
    ├── package.json
    ├── tsconfig.json
    ├── tailwind.config.ts
    └── next.config.mjs
```

---

## 🐛 Troubleshooting

### Problem: "STRIPE_SECRET_KEY is not set"

**Solution:**
- Create `.env.local` file in the `nextjs-dashboard` folder
- Add your Stripe key: `STRIPE_SECRET_KEY=sk_test_...`
- Restart the dev server (`npm run dev`)

### Problem: "No subscription data found"

**Solution:**
- Make sure you're using the correct Stripe key
- Verify your Stripe account has subscriptions
- For testing, create test subscriptions in Stripe Dashboard (test mode)

### Problem: Charts not showing

**Solution:**
- Open browser DevTools (F12)
- Check Console for errors
- Check Network tab - look for `/api/stripe` request
- Ensure you have subscription data spanning multiple months

### Problem: Port 3000 already in use

**Solution:**
```bash
# Option 1: Use different port
PORT=3001 npm run dev

# Option 2: Kill process on port 3000
# Mac/Linux
lsof -ti:3000 | xargs kill -9

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

---

## 📦 Deployment

### Deploy to Vercel (Recommended - Free)

1. Push your code to GitHub
2. Go to https://vercel.com
3. Import your repository
4. Add environment variable: `STRIPE_SECRET_KEY`
5. Deploy! ✨

### Deploy to Other Platforms

**Build for production:**
```bash
npm run build
npm start
```

**Supported platforms:**
- Vercel (easiest)
- Netlify
- AWS Amplify
- Railway
- Render
- Any Node.js host

**Important:** Always set `STRIPE_SECRET_KEY` in your production environment variables!

---

## 📚 Learn More

### Documentation
- [Next.js Docs](https://nextjs.org/docs)
- [shadcn/ui Docs](https://ui.shadcn.com)
- [Stripe API Docs](https://stripe.com/docs/api)
- [Recharts Docs](https://recharts.org)
- [Tailwind CSS Docs](https://tailwindcss.com)

### Add More shadcn/ui Components

```bash
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add popover
npx shadcn-ui@latest add dropdown-menu
```

See all available components: https://ui.shadcn.com/docs/components

---

## 🎯 Next Steps

1. **Customize the theme** - Edit colors in `app/globals.css`
2. **Add more metrics** - Extend `data-processor.ts`
3. **Create new charts** - Add components in `components/dashboard/`
4. **Add authentication** - Use NextAuth.js or Clerk
5. **Deploy to production** - Use Vercel for easy deployment

---

## 💡 Tips

- Use `npm run dev` for development (hot reload enabled)
- TypeScript will catch errors before runtime
- Components are fully typed for better IntelliSense
- Tailwind CSS allows rapid styling
- shadcn/ui components are customizable and accessible

---

## ❓ Need Help?

Check out:
- `README.md` - Comprehensive documentation
- `SETUP.md` - Detailed setup guide
- `COMPARISON.md` - Streamlit vs Next.js comparison
- GitHub Issues - Report bugs or ask questions

---

**Happy building! 🚀**

Your dashboard is production-ready and fully customizable. Make it yours!

