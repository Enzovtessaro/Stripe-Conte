# Stripe Revenue Dashboard - Next.js + shadcn/ui

A modern, beautiful revenue analytics dashboard built with Next.js 14, shadcn/ui, and Stripe API integration.

## Features

- 📊 **Comprehensive Revenue Metrics** - Track MRR, ARR, churn rate, and customer growth
- 📈 **Interactive Charts** - Beautiful visualizations using Recharts
- 🎨 **Modern UI** - Built with shadcn/ui components and Tailwind CSS
- 🔄 **Real-time Data** - Fetch live data from Stripe API
- 📱 **Responsive Design** - Works perfectly on all screen sizes
- ⚡ **Fast & Performant** - Built on Next.js 14 with App Router

## Screenshots

The dashboard includes:
- Key metrics cards (Total MRR, New MRR, ARR, Churn Rate, Active Customers)
- Monthly Recurring Revenue stacked bar chart
- Growth trends line chart
- Revenue by plan pie chart
- Customer insights dual-axis chart
- Period comparisons (MoM, YoY)
- Date range filtering

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **UI Components:** shadcn/ui + Radix UI
- **Styling:** Tailwind CSS
- **Charts:** Recharts
- **API:** Stripe Node SDK
- **Language:** TypeScript
- **Date Handling:** date-fns

## Prerequisites

- Node.js 18+ installed
- A Stripe account with subscription data
- Stripe Secret Key (starts with `sk_test_` or `sk_live_`)

## Installation

1. **Navigate to the project directory:**

\`\`\`bash
cd nextjs-dashboard
\`\`\`

2. **Install dependencies:**

\`\`\`bash
npm install
\`\`\`

3. **Set up environment variables:**

Create a `.env.local` file in the root directory:

\`\`\`bash
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
\`\`\`

Replace `sk_test_your_stripe_secret_key_here` with your actual Stripe secret key.

4. **Run the development server:**

\`\`\`bash
npm run dev
\`\`\`

5. **Open your browser:**

Navigate to [http://localhost:3000](http://localhost:3000) to see the dashboard.

## Project Structure

\`\`\`
nextjs-dashboard/
├── app/
│   ├── api/
│   │   └── stripe/
│   │       └── route.ts          # API route for Stripe data
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Main dashboard page
├── components/
│   ├── dashboard/
│   │   ├── customer-chart.tsx    # Customer insights chart
│   │   ├── growth-chart.tsx      # Growth trends chart
│   │   ├── metric-card.tsx       # Metric display card
│   │   ├── mrr-chart.tsx         # MRR bar chart
│   │   └── revenue-pie-chart.tsx # Revenue by plan pie chart
│   └── ui/                       # shadcn/ui components
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── select.tsx
│       └── tabs.tsx
├── lib/
│   ├── data-processor.ts         # Data processing logic
│   ├── stripe.ts                 # Stripe client
│   └── utils.ts                  # Utility functions
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── README.md
\`\`\`

## Building for Production

\`\`\`bash
npm run build
npm start
\`\`\`

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `STRIPE_SECRET_KEY` | Your Stripe secret API key | Yes |

## Features Breakdown

### Key Metrics
- **Total MRR:** Current monthly recurring revenue with growth percentage
- **New MRR:** Revenue from new subscriptions this month
- **Annual Revenue (ARR):** Annualized recurring revenue
- **Churn Rate:** Percentage of customers who canceled
- **Active Customers:** Current active subscription count

### Charts
1. **MRR Analysis:** Stacked bar chart showing new vs existing MRR by month
2. **Growth Trends:** Line chart displaying MRR trends over time
3. **Revenue by Plan:** Pie chart with revenue breakdown by product/plan
4. **Customer Insights:** Combined chart showing new customers and cumulative total

### Filters
- All Time
- Last 3 Months
- Last 6 Months
- Last 12 Months

## Customization

### Adding New shadcn/ui Components

\`\`\`bash
npx shadcn-ui@latest add [component-name]
\`\`\`

### Modifying Colors

Edit the CSS variables in `app/globals.css` to change the color scheme.

### Adding New Metrics

1. Add calculation logic to `lib/data-processor.ts`
2. Update the API route in `app/api/stripe/route.ts`
3. Create or update components to display the new metrics

## Troubleshooting

### "STRIPE_SECRET_KEY is not set"
Make sure you've created a `.env.local` file with your Stripe key.

### "No subscription data found"
Ensure your Stripe account has active or past subscriptions. You can create test subscriptions in Stripe's test mode.

### Charts not displaying
Check your browser console for errors. Make sure all data is loading correctly from the API.

## Comparison with Streamlit Version

| Feature | Streamlit | Next.js + shadcn/ui |
|---------|-----------|---------------------|
| UI Framework | Python-based | React-based |
| Components | Custom CSS | shadcn/ui |
| Performance | Server-side | Client + Server |
| Interactivity | Limited | Rich |
| Customization | Moderate | High |
| Deployment | Streamlit Cloud | Vercel/Any |

## License

MIT

## Support

For issues or questions:
1. Check the Stripe API documentation
2. Review shadcn/ui documentation
3. Check Next.js documentation

---

Built with ❤️ using Next.js, shadcn/ui, and Stripe

