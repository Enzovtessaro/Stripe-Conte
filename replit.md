# Revenue Dashboard

## Overview

This is a comprehensive Streamlit-based revenue analytics dashboard that integrates with Stripe to visualize subscription metrics. The application retrieves subscription data from Stripe's API and processes it to calculate key business metrics including Monthly Recurring Revenue (MRR), Annual Recurring Revenue (ARR), churn metrics, customer trends, and revenue breakdown by subscription plan.

The dashboard provides real-time insights into subscription-based revenue performance through modern, interactive visualizations powered by Plotly. Data is cached for 5 minutes to balance performance with data freshness.

## Recent Changes (October 2025)

- Enhanced bar chart visualization with rounded top corners (barcornerradius=8)
- Added comprehensive metrics: ARR, churn rate, active customer count
- Implemented multiple chart types: bar chart, line chart, pie chart, dual-axis customer trends
- Added date range filtering (All Time, Last 3/6/12 Months, Custom date range)
- Created revenue breakdown by plan/product with table and pie chart visualization
- Implemented month-over-month and year-over-year comparison views
- Fixed churn calculation to accurately measure current month churn rate
- Added tabbed interface for easy navigation between different chart views

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: Streamlit web application with wide layout configuration
- **Visualization Library**: Plotly (Express and Graph Objects) for interactive charts and graphs
- **UI Organization**: Tab-based navigation for different chart views (MRR Bar Chart, MRR Trend Line, Revenue by Plan, Customer Trends)
- **Caching Strategy**: 
  - Resource caching for Stripe client initialization (singleton pattern)
  - Data caching with 5-minute TTL for revenue data to minimize API calls
- **Error Handling**: Graceful degradation with user-friendly error messages when API key is missing or data is unavailable
- **Date Filtering**: Interactive date range selector with preset options and custom date picker

### Backend Architecture
- **Modular Design**: Three-tier separation of concerns
  - `app.py`: Main application entry point, UI rendering, and chart creation
  - `utils/stripe_client.py`: Stripe API integration layer
  - `utils/data_processor.py`: Business logic and metrics calculation
- **Data Flow**: Stripe API → StripeClient → DataProcessor → Streamlit UI
- **Pagination Handling**: Automatic iteration through Stripe's paginated API responses using cursor-based pagination

### Data Processing
- **Metrics Calculated**:
  - New MRR by month (monthly cohort analysis)
  - ARR (Annual Recurring Revenue) - 12x active MRR
  - Churn metrics (current month churn rate based on active subscriptions at month start)
  - Customer trends (new customers per month and cumulative totals)
  - Revenue segmentation by subscription plan/product
  - Month-over-month and year-over-year comparisons
- **Data Transformation**: Raw Stripe subscription objects converted to pandas DataFrames for analysis
- **Time-based Aggregation**: Monthly grouping using subscription creation timestamps
- **MRR Calculation**: Handles various billing intervals (month, year, week, day) by normalizing to monthly values
- **Churn Calculation**: Measures subscriptions active at start of current month that cancelled during the month

### Chart Visualizations
1. **MRR Bar Chart**: New MRR per month with rounded corners, color-coded bars (#3366CC)
2. **MRR Line Chart**: Trend visualization with markers showing MRR growth over time
3. **Revenue Pie Chart**: Donut-style breakdown of revenue by plan/product with percentages
4. **Customer Trends Chart**: Dual-axis chart showing new customers (bars) and cumulative total (line)

### Authentication & Authorization
- **API Authentication**: Stripe secret key stored in environment variable `STRIPE_SECRET_KEY`
- **Security**: API key loaded from environment, never hardcoded
- **Access Control**: Relies on Stripe's API key permissions model

## External Dependencies

### Third-Party Services
- **Stripe API**: Core payment and subscription data source
  - Subscriptions endpoint with expanded price data
  - Supports all subscription statuses (active, canceled, past_due, etc.)
  - Cursor-based pagination for large datasets

### Python Libraries
- **streamlit**: Web application framework and UI components
- **pandas**: Data manipulation and analysis
- **plotly**: Interactive data visualization (express and graph_objects modules)
- **stripe**: Official Stripe Python SDK for API integration
- **python-dateutil**: Date manipulation for churn calculations

### Environment Configuration
- **Required Environment Variables**:
  - `STRIPE_SECRET_KEY`: Stripe API secret key for authentication

### API Integration Details
- **Stripe Subscription API**:
  - Retrieves subscription objects with expanded price information
  - Processes subscription metadata including creation timestamps, status, and pricing tiers
  - Handles multiple billing intervals for accurate MRR normalization