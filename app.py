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
        
        # Process the data to calculate MRR metrics
        mrr_data = data_processor.calculate_new_mrr_by_month(subscriptions)
        
        if mrr_data.empty:
            return None, "No MRR data could be calculated from your subscriptions."
        
        return mrr_data, None
        
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
            line=dict(color='#3366CC', width=1)
        ),
        text=df['new_mrr'].apply(lambda x: f"${x:,.0f}"),
        textposition='outside',
        textfont=dict(size=12, color='#333333'),
        hovertemplate='<b>%{x}</b><br>New MRR: $%{y:,.0f}<extra></extra>'
    ))
    
    # Update layout for modern appearance
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
        margin=dict(t=80, b=60, l=80, r=60)
    )
    
    # Add rounded corners effect by updating bar shape
    fig.update_traces(
        marker=dict(
            line=dict(width=0),
            opacity=0.8
        )
    )
    
    return fig

def display_key_metrics(df):
    """Display key revenue metrics in a clean layout"""
    if df.empty:
        st.warning("No data available for metrics calculation.")
        return
    
    # Calculate metrics
    latest_month_mrr = df['new_mrr'].iloc[-1] if not df.empty else 0
    previous_month_mrr = df['new_mrr'].iloc[-2] if len(df) > 1 else 0
    
    # Calculate month-over-month growth
    if previous_month_mrr > 0:
        growth_rate = ((latest_month_mrr - previous_month_mrr) / previous_month_mrr) * 100
    else:
        growth_rate = 0 if latest_month_mrr == 0 else 100
    
    # Calculate total MRR (sum of all new MRR)
    total_mrr = df['new_mrr'].sum()
    
    # Display metrics in columns
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric(
            label="Current Month New MRR",
            value=f"${latest_month_mrr:,.0f}",
            delta=f"{growth_rate:+.1f}%" if growth_rate != 0 else None
        )
    
    with col2:
        st.metric(
            label="Previous Month New MRR",
            value=f"${previous_month_mrr:,.0f}"
        )
    
    with col3:
        st.metric(
            label="Total New MRR (All Time)",
            value=f"${total_mrr:,.0f}"
        )
    
    with col4:
        st.metric(
            label="Data Points",
            value=f"{len(df)} months"
        )

def main():
    """Main application function"""
    
    # Header
    st.title("📊 Revenue Dashboard")
    st.markdown("### Monthly Recurring Revenue Analytics")
    
    # Add refresh button
    col1, col2 = st.columns([1, 4])
    with col1:
        if st.button("🔄 Refresh Data", type="primary"):
            st.cache_data.clear()
            st.rerun()
    
    # Load data
    with st.spinner("Loading revenue data from Stripe..."):
        mrr_data, error_message = load_revenue_data()
    
    if error_message:
        st.error(error_message)
        st.markdown("""
        **Setup Instructions:**
        1. Ensure your Stripe API key is set as the environment variable `STRIPE_SECRET_KEY`
        2. Make sure your Stripe account has subscription data
        3. Verify the API key has the necessary permissions to read subscription data
        """)
        return
    
    if mrr_data is None or mrr_data.empty:
        st.warning("No MRR data available to display.")
        st.markdown("""
        **Possible reasons:**
        - No subscriptions found in your Stripe account
        - Subscriptions don't have the required data for MRR calculation
        - Data processing encountered an issue
        """)
        return
    
    # Display key metrics
    st.markdown("### Key Metrics")
    display_key_metrics(mrr_data)
    
    st.markdown("---")
    
    # Display chart
    st.markdown("### Monthly Breakdown")
    chart = create_mrr_chart(mrr_data)
    
    if chart:
        st.plotly_chart(chart, use_container_width=True)
    else:
        st.error("Unable to generate chart from the available data.")
    
    # Display raw data table
    with st.expander("View Raw Data"):
        st.dataframe(
            mrr_data,
            column_config={
                "month": "Month",
                "new_mrr": st.column_config.NumberColumn(
                    "New MRR ($)",
                    format="$%.0f"
                ),
                "subscription_count": "New Subscriptions"
            },
            hide_index=True
        )
    
    # Footer
    st.markdown("---")
    st.markdown(
        "**Data Source:** Stripe API | **Last Updated:** " + 
        datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    )

if __name__ == "__main__":
    main()
