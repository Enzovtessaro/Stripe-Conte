import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime, timedelta
import os
from utils.stripe_client import StripeClient
from utils.data_processor import DataProcessor

# Configure page
st.set_page_config(
    page_title="Revenue Dashboard",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Initialize clients
@st.cache_resource
def get_stripe_client():
    """Initialize Stripe client with API key from environment"""
    api_key = os.getenv("STRIPE_SECRET_KEY")
    if not api_key:
        st.error("❌ Stripe API key not found in environment variables. Please set STRIPE_SECRET_KEY.")
        st.stop()
    return StripeClient(api_key)

@st.cache_data(ttl=300)  # Cache for 5 minutes
def load_revenue_data():
    """Load and process revenue data from Stripe"""
    try:
        stripe_client = get_stripe_client()
        data_processor = DataProcessor()
        
        # Get subscription data from Stripe
        subscriptions = stripe_client.get_subscriptions()
        
        if not subscriptions:
            return None, "No subscription data found in your Stripe account."
        
        # Process the data to calculate all metrics
        mrr_data = data_processor.calculate_new_mrr_by_month(subscriptions)
        arr = data_processor.calculate_arr(subscriptions)
        churn_metrics = data_processor.calculate_churn_metrics(subscriptions)
        customer_trends = data_processor.calculate_customer_trends(subscriptions)
        revenue_by_plan = data_processor.calculate_revenue_by_plan(subscriptions)
        
        if mrr_data.empty:
            return None, "No MRR data could be calculated from your subscriptions."
        
        return {
            'mrr_data': mrr_data,
            'arr': arr,
            'churn_metrics': churn_metrics,
            'customer_trends': customer_trends,
            'revenue_by_plan': revenue_by_plan,
            'subscriptions': subscriptions
        }, None
        
    except Exception as e:
        return None, f"Error loading data: {str(e)}"

def create_mrr_chart(df):
    """Create styled bar chart for New MRR per month"""
    if df.empty:
        return None
    
    # Create bar chart with Plotly
    fig = go.Figure()
    
    fig.add_trace(go.Bar(
        x=df['month'],
        y=df['new_mrr'],
        name='New MRR',
        marker=dict(
            color='#3366CC',
            line=dict(color='#3366CC', width=0)
        ),
        text=df['new_mrr'].apply(lambda x: f"${x:,.0f}"),
        textposition='outside',
        textfont=dict(size=12, color='#333333'),
        hovertemplate='<b>%{x}</b><br>New MRR: $%{y:,.0f}<extra></extra>'
    ))
    
    # Update layout for modern appearance with rounded corners
    fig.update_layout(
        title=dict(
            text="New Monthly Recurring Revenue (MRR)",
            font=dict(size=24, color='#1f2937'),
            x=0.5,
            xanchor='center'
        ),
        xaxis=dict(
            title="Month",
            titlefont=dict(size=14, color='#6b7280'),
            tickfont=dict(size=12, color='#6b7280'),
            showgrid=True,
            gridcolor='#f3f4f6',
            gridwidth=1
        ),
        yaxis=dict(
            title="New MRR ($)",
            titlefont=dict(size=14, color='#6b7280'),
            tickfont=dict(size=12, color='#6b7280'),
            showgrid=True,
            gridcolor='#f3f4f6',
            gridwidth=1,
            tickformat='$,.0f'
        ),
        plot_bgcolor='white',
        paper_bgcolor='white',
        showlegend=False,
        height=500,
        margin=dict(t=80, b=60, l=80, r=60),
        bargap=0.3,
        barcornerradius=8
    )
    
    return fig

def create_mrr_line_chart(df):
    """Create line chart for MRR trends over time"""
    if df.empty:
        return None
    
    fig = go.Figure()
    
    fig.add_trace(go.Scatter(
        x=df['month'],
        y=df['new_mrr'],
        mode='lines+markers',
        name='New MRR',
        line=dict(color='#3366CC', width=3),
        marker=dict(size=8, color='#3366CC'),
        hovertemplate='<b>%{x}</b><br>New MRR: $%{y:,.0f}<extra></extra>'
    ))
    
    fig.update_layout(
        title=dict(
            text="MRR Trend Over Time",
            font=dict(size=20, color='#1f2937'),
            x=0.5,
            xanchor='center'
        ),
        xaxis=dict(
            title="Month",
            titlefont=dict(size=14, color='#6b7280'),
            tickfont=dict(size=12, color='#6b7280'),
            showgrid=True,
            gridcolor='#f3f4f6'
        ),
        yaxis=dict(
            title="New MRR ($)",
            titlefont=dict(size=14, color='#6b7280'),
            tickfont=dict(size=12, color='#6b7280'),
            showgrid=True,
            gridcolor='#f3f4f6',
            tickformat='$,.0f'
        ),
        plot_bgcolor='white',
        paper_bgcolor='white',
        height=400,
        margin=dict(t=60, b=40, l=60, r=40)
    )
    
    return fig

def create_revenue_pie_chart(df):
    """Create pie chart for revenue breakdown by plan"""
    if df.empty:
        return None
    
    fig = go.Figure(data=[go.Pie(
        labels=df['plan'],
        values=df['mrr'],
        hole=0.4,
        marker=dict(colors=['#3366CC', '#DC3912', '#FF9900', '#109618', '#990099', '#0099C6']),
        textinfo='label+percent',
        hovertemplate='<b>%{label}</b><br>MRR: $%{value:,.0f}<br>%{percent}<extra></extra>'
    )])
    
    fig.update_layout(
        title=dict(
            text="Revenue by Plan/Product",
            font=dict(size=20, color='#1f2937'),
            x=0.5,
            xanchor='center'
        ),
        height=400,
        margin=dict(t=60, b=40, l=40, r=40),
        showlegend=True,
        legend=dict(
            orientation="v",
            yanchor="middle",
            y=0.5,
            xanchor="left",
            x=1.05
        )
    )
    
    return fig

def create_customer_trends_chart(df):
    """Create chart for customer count trends"""
    if df.empty:
        return None
    
    fig = go.Figure()
    
    fig.add_trace(go.Bar(
        x=df['month'],
        y=df['new_customers'],
        name='New Customers',
        marker=dict(color='#109618', cornerradius=6),
        yaxis='y',
        hovertemplate='<b>%{x}</b><br>New Customers: %{y}<extra></extra>'
    ))
    
    fig.add_trace(go.Scatter(
        x=df['month'],
        y=df['cumulative_customers'],
        name='Total Customers',
        mode='lines+markers',
        line=dict(color='#DC3912', width=3),
        marker=dict(size=8),
        yaxis='y2',
        hovertemplate='<b>%{x}</b><br>Total Customers: %{y}<extra></extra>'
    ))
    
    fig.update_layout(
        title=dict(
            text="Customer Growth Trends",
            font=dict(size=20, color='#1f2937'),
            x=0.5,
            xanchor='center'
        ),
        xaxis=dict(
            title="Month",
            titlefont=dict(size=14, color='#6b7280'),
            tickfont=dict(size=12, color='#6b7280')
        ),
        yaxis=dict(
            title="New Customers",
            titlefont=dict(size=14, color='#109618'),
            tickfont=dict(size=12, color='#109618')
        ),
        yaxis2=dict(
            title="Total Customers",
            titlefont=dict(size=14, color='#DC3912'),
            tickfont=dict(size=12, color='#DC3912'),
            overlaying='y',
            side='right'
        ),
        plot_bgcolor='white',
        paper_bgcolor='white',
        height=400,
        margin=dict(t=60, b=40, l=60, r=60),
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=1.02,
            xanchor="right",
            x=1
        )
    )
    
    return fig

def filter_data_by_date_range(mrr_data, customer_trends, date_range, custom_start=None, custom_end=None):
    """Filter data based on selected date range"""
    if date_range == "All Time":
        return mrr_data, customer_trends
    
    # Calculate the cutoff date
    end_date = datetime.now()
    
    if date_range == "Last 3 Months":
        start_date = end_date - timedelta(days=90)
    elif date_range == "Last 6 Months":
        start_date = end_date - timedelta(days=180)
    elif date_range == "Last 12 Months":
        start_date = end_date - timedelta(days=365)
    elif date_range == "Custom" and custom_start and custom_end:
        start_date = datetime.combine(custom_start, datetime.min.time())
        end_date = datetime.combine(custom_end, datetime.max.time())
    else:
        return mrr_data, customer_trends
    
    # Filter MRR data
    if not mrr_data.empty and 'month' in mrr_data.columns:
        mrr_data_copy = mrr_data.copy()
        mrr_data_copy['date'] = pd.to_datetime(mrr_data_copy['month'], format='%b %Y')
        filtered_mrr = mrr_data_copy[(mrr_data_copy['date'] >= start_date) & (mrr_data_copy['date'] <= end_date)]
        filtered_mrr = filtered_mrr.drop('date', axis=1)
    else:
        filtered_mrr = mrr_data
    
    # Filter customer trends
    if not customer_trends.empty and 'month' in customer_trends.columns:
        customer_trends_copy = customer_trends.copy()
        customer_trends_copy['date'] = pd.to_datetime(customer_trends_copy['month'], format='%b %Y')
        filtered_customers = customer_trends_copy[(customer_trends_copy['date'] >= start_date) & (customer_trends_copy['date'] <= end_date)]
        filtered_customers = filtered_customers.drop('date', axis=1)
    else:
        filtered_customers = customer_trends
    
    return filtered_mrr, filtered_customers

def display_key_metrics(mrr_df, arr, churn_metrics):
    """Display key revenue metrics in a clean layout"""
    if mrr_df.empty:
        st.warning("No data available for metrics calculation.")
        return
    
    # Calculate MRR metrics
    latest_month_mrr = mrr_df['new_mrr'].iloc[-1] if not mrr_df.empty else 0
    previous_month_mrr = mrr_df['new_mrr'].iloc[-2] if len(mrr_df) > 1 else 0
    
    # Calculate month-over-month growth
    if previous_month_mrr > 0:
        growth_rate = ((latest_month_mrr - previous_month_mrr) / previous_month_mrr) * 100
    else:
        growth_rate = 0 if latest_month_mrr == 0 else 100
    
    # Calculate total MRR (sum of all new MRR)
    total_mrr = mrr_df['new_mrr'].sum()
    
    # Display metrics in columns
    col1, col2, col3, col4, col5 = st.columns(5)
    
    with col1:
        st.metric(
            label="Current Month New MRR",
            value=f"${latest_month_mrr:,.0f}",
            delta=f"{growth_rate:+.1f}%" if growth_rate != 0 else None
        )
    
    with col2:
        st.metric(
            label="Annual Recurring Revenue",
            value=f"${arr:,.0f}"
        )
    
    with col3:
        st.metric(
            label="Churn Rate",
            value=f"{churn_metrics['churn_rate']:.1f}%",
            delta=f"-{churn_metrics['churned_count']} customers" if churn_metrics['churned_count'] > 0 else "0 churned",
            delta_color="inverse"
        )
    
    with col4:
        st.metric(
            label="Active Customers",
            value=f"{churn_metrics['active_count']:,}"
        )
    
    with col5:
        st.metric(
            label="Total New MRR",
            value=f"${total_mrr:,.0f}"
        )

def main():
    """Main application function"""
    
    # Header
    st.title("📊 Revenue Dashboard")
    st.markdown("### Comprehensive Revenue Analytics from Stripe")
    
    # Add refresh button and date filter
    col1, col2, col3 = st.columns([1, 2, 2])
    with col1:
        if st.button("🔄 Refresh Data", type="primary"):
            st.cache_data.clear()
            st.rerun()
    
    with col2:
        date_range = st.selectbox(
            "Date Range",
            ["All Time", "Last 3 Months", "Last 6 Months", "Last 12 Months", "Custom"],
            index=0
        )
    
    custom_start_date = None
    custom_end_date = None
    
    if date_range == "Custom":
        with col3:
            custom_dates = st.date_input(
                "Select Date Range",
                value=(datetime.now() - timedelta(days=180), datetime.now()),
                max_value=datetime.now()
            )
            if len(custom_dates) == 2:
                custom_start_date, custom_end_date = custom_dates
    
    # Load data
    with st.spinner("Loading revenue data from Stripe..."):
        data, error_message = load_revenue_data()
    
    if error_message:
        st.error(error_message)
        st.markdown("""
        **Setup Instructions:**
        1. Ensure your Stripe API key is set as the environment variable `STRIPE_SECRET_KEY`
        2. Make sure your Stripe account has subscription data
        3. Verify the API key has the necessary permissions to read subscription data
        """)
        return
    
    if data is None:
        st.warning("No data available to display.")
        return
    
    mrr_data = data['mrr_data']
    arr = data['arr']
    churn_metrics = data['churn_metrics']
    customer_trends = data['customer_trends']
    revenue_by_plan = data['revenue_by_plan']
    
    # Apply date filter
    filtered_mrr_data, filtered_customer_trends = filter_data_by_date_range(
        mrr_data, customer_trends, date_range, custom_start_date, custom_end_date
    )
    
    # Display key metrics
    st.markdown("### Key Metrics Overview")
    display_key_metrics(filtered_mrr_data, arr, churn_metrics)
    
    st.markdown("---")
    
    # Chart selection tabs
    tab1, tab2, tab3, tab4 = st.tabs([
        "📊 MRR Bar Chart", 
        "📈 MRR Trend Line", 
        "🥧 Revenue by Plan", 
        "👥 Customer Trends"
    ])
    
    with tab1:
        st.markdown("### New Monthly Recurring Revenue")
        chart = create_mrr_chart(filtered_mrr_data)
        if chart:
            st.plotly_chart(chart, use_container_width=True)
        else:
            st.error("Unable to generate chart from the available data.")
    
    with tab2:
        st.markdown("### MRR Growth Over Time")
        line_chart = create_mrr_line_chart(filtered_mrr_data)
        if line_chart:
            st.plotly_chart(line_chart, use_container_width=True)
        else:
            st.info("Not enough data to display trend line.")
    
    with tab3:
        st.markdown("### Revenue Distribution by Plan/Product")
        if not revenue_by_plan.empty:
            col1, col2 = st.columns([2, 1])
            with col1:
                pie_chart = create_revenue_pie_chart(revenue_by_plan)
                if pie_chart:
                    st.plotly_chart(pie_chart, use_container_width=True)
            with col2:
                st.markdown("#### Plan Breakdown")
                st.dataframe(
                    revenue_by_plan,
                    column_config={
                        "plan": "Plan/Product",
                        "mrr": st.column_config.NumberColumn("MRR", format="$%.2f"),
                        "percentage": st.column_config.NumberColumn("% of Total", format="%.1f%%")
                    },
                    hide_index=True,
                    use_container_width=True
                )
        else:
            st.info("No plan data available.")
    
    with tab4:
        st.markdown("### Customer Acquisition & Growth")
        if not filtered_customer_trends.empty:
            customer_chart = create_customer_trends_chart(filtered_customer_trends)
            if customer_chart:
                st.plotly_chart(customer_chart, use_container_width=True)
        else:
            st.info("No customer trend data available.")
    
    st.markdown("---")
    
    # Comparison views
    st.markdown("### 📊 Period Comparisons")
    
    if len(filtered_mrr_data) >= 2:
        col1, col2 = st.columns(2)
        
        with col1:
            st.markdown("#### Month-over-Month Comparison")
            current_mrr = filtered_mrr_data['new_mrr'].iloc[-1]
            previous_mrr = filtered_mrr_data['new_mrr'].iloc[-2]
            mom_change = current_mrr - previous_mrr
            mom_pct = (mom_change / previous_mrr * 100) if previous_mrr > 0 else 0
            
            st.metric(
                label="Latest Month vs Previous",
                value=f"${current_mrr:,.0f}",
                delta=f"${mom_change:+,.0f} ({mom_pct:+.1f}%)"
            )
        
        with col2:
            st.markdown("#### Year-over-Year Comparison")
            if len(filtered_mrr_data) >= 13:
                current_mrr = filtered_mrr_data['new_mrr'].iloc[-1]
                year_ago_mrr = filtered_mrr_data['new_mrr'].iloc[-13]
                yoy_change = current_mrr - year_ago_mrr
                yoy_pct = (yoy_change / year_ago_mrr * 100) if year_ago_mrr > 0 else 0
                
                st.metric(
                    label="Latest Month vs Year Ago",
                    value=f"${current_mrr:,.0f}",
                    delta=f"${yoy_change:+,.0f} ({yoy_pct:+.1f}%)"
                )
            else:
                st.info("Need at least 13 months of data for YoY comparison")
    else:
        st.info("Need at least 2 months of data for period comparisons")
    
    # Display raw data table
    with st.expander("📋 View Raw MRR Data"):
        st.dataframe(
            filtered_mrr_data,
            column_config={
                "month": "Month",
                "new_mrr": st.column_config.NumberColumn(
                    "New MRR ($)",
                    format="$%.0f"
                ),
                "subscription_count": "New Subscriptions"
            },
            hide_index=True,
            use_container_width=True
        )
    
    # Footer
    st.markdown("---")
    st.markdown(
        "**Data Source:** Stripe API | **Last Updated:** " + 
        datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    )

if __name__ == "__main__":
    main()
