import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv
from utils.stripe_client import StripeClient
from utils.data_processor import DataProcessor

# Load environment variables from .env file
load_dotenv()

# Configure page
st.set_page_config(
    page_title="Revenue Dashboard",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Minimalist CSS styling - 3 colors only: white, gray, and accent
st.markdown("""
<style>
    /* Import clean, minimalist font */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
    
    /* Color palette: White (#FFFFFF), Gray (#6B7280), Accent (#3B82F6) */
    
    /* Global styles */
    .main {
        padding: 2rem 0;
        background: #FFFFFF;
    }
    
    /* Hide Streamlit branding */
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    header {visibility: hidden;}
    
    /* Clean header */
    .dashboard-header {
        background: #FFFFFF;
        padding: 3rem 0 2rem 0;
        margin: -1rem -1rem 3rem -1rem;
        border-bottom: 1px solid #F3F4F6;
    }
    
    .dashboard-header h1 {
        font-family: 'Inter', sans-serif;
        font-weight: 600;
        font-size: 2.5rem;
        color: #111827;
        margin: 0;
        text-align: center;
    }
    
    .dashboard-header p {
        font-family: 'Inter', sans-serif;
        font-weight: 400;
        font-size: 1.1rem;
        color: #6B7280;
        margin: 0.5rem 0 0 0;
        text-align: center;
    }
    
    /* Metric cards - clean and minimal */
    .metric-container {
        background: #FFFFFF;
        border: 1px solid #E5E7EB;
        border-radius: 8px;
        padding: 1.5rem;
        margin-bottom: 1rem;
        transition: border-color 0.2s ease;
    }
    
    .metric-container:hover {
        border-color: #3B82F6;
    }
    
    .metric-value {
        font-family: 'Inter', sans-serif;
        font-weight: 600;
        font-size: 2rem;
        color: #111827;
        margin: 0;
    }
    
    .metric-label {
        font-family: 'Inter', sans-serif;
        font-weight: 500;
        font-size: 0.875rem;
        color: #6B7280;
        margin: 0.5rem 0 0 0;
        text-transform: uppercase;
        letter-spacing: 0.025em;
    }
    
    .metric-delta {
        font-family: 'Inter', sans-serif;
        font-weight: 500;
        font-size: 0.875rem;
        margin-top: 0.5rem;
    }
    
    /* Buttons - solid, no borders */
    .stButton > button {
        background: #3B82F6;
        color: #FFFFFF;
        border: none;
        border-radius: 6px;
        padding: 0.75rem 1.5rem;
        font-family: 'Inter', sans-serif;
        font-weight: 500;
        font-size: 0.875rem;
        transition: background-color 0.2s ease;
    }
    
    .stButton > button:hover {
        background: #2563EB;
    }
    
    /* Tabs - clean and minimal */
    .stTabs [data-baseweb="tab-list"] {
        gap: 0;
        border-bottom: 1px solid #E5E7EB;
    }
    
    .stTabs [data-baseweb="tab"] {
        background: #FFFFFF;
        border: none;
        border-bottom: 2px solid transparent;
        border-radius: 0;
        padding: 1rem 1.5rem;
        font-family: 'Inter', sans-serif;
        font-weight: 500;
        color: #6B7280;
        transition: all 0.2s ease;
    }
    
    .stTabs [aria-selected="true"] {
        background: #FFFFFF;
        color: #3B82F6;
        border-bottom-color: #3B82F6;
    }
    
    /* Section headers */
    .section-title {
        font-family: 'Inter', sans-serif;
        font-weight: 600;
        font-size: 1.25rem;
        color: #111827;
        margin: 2rem 0 1rem 0;
        padding-bottom: 0.5rem;
        border-bottom: 1px solid #E5E7EB;
    }
    
    /* Form elements */
    .stSelectbox > div > div {
        border: 1px solid #D1D5DB;
        border-radius: 6px;
        background: #FFFFFF;
    }
    
    .stSelectbox > div > div:focus-within {
        border-color: #3B82F6;
    }
    
    .stDateInput > div > div {
        border: 1px solid #D1D5DB;
        border-radius: 6px;
        background: #FFFFFF;
    }
    
    .stDateInput > div > div:focus-within {
        border-color: #3B82F6;
    }
    
    /* Charts container */
    .chart-wrapper {
        background: #FFFFFF;
        border: 1px solid #E5E7EB;
        border-radius: 8px;
        padding: 1.5rem;
        margin: 1rem 0;
    }
    
    /* Data tables */
    .stDataFrame {
        border: 1px solid #E5E7EB;
        border-radius: 8px;
        overflow: hidden;
    }
    
    /* Alerts and info boxes */
    .stAlert {
        border: 1px solid #E5E7EB;
        border-radius: 8px;
        background: #FFFFFF;
    }
    
    /* Expander */
    .streamlit-expanderHeader {
        background: #FFFFFF;
        border: 1px solid #E5E7EB;
        border-radius: 6px;
        font-family: 'Inter', sans-serif;
        font-weight: 500;
    }
    
    /* Loading spinner */
    .stSpinner > div {
        border-top-color: #3B82F6;
    }
    
    /* Responsive design */
    @media (max-width: 768px) {
        .dashboard-header h1 {
            font-size: 2rem;
        }
        .metric-value {
            font-size: 1.5rem;
        }
    }
    
    /* Subtle animations */
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    
    .fade-in {
        animation: fadeIn 0.3s ease-out;
    }
</style>
""", unsafe_allow_html=True)

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
        
        # Collect unique product IDs from subscriptions to fetch names
        product_ids = set()
        for sub in subscriptions:
            items = sub.get('items', {}).get('data', [])
            for item in items:
                price = item.get('price', {})
                product = price.get('product')
                if product and isinstance(product, str):
                    product_ids.add(product)
        
        # Fetch product names from Stripe
        product_names = stripe_client.get_products_batch(list(product_ids)) if product_ids else {}
        
        # Process the data to calculate all metrics
        mrr_data = data_processor.calculate_new_vs_existing_mrr_by_month(subscriptions)
        arr = data_processor.calculate_arr(subscriptions)
        churn_metrics = data_processor.calculate_churn_metrics(subscriptions)
        customer_trends = data_processor.calculate_customer_trends(subscriptions)
        revenue_by_plan = data_processor.calculate_revenue_by_plan(subscriptions, product_names)
        
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
    """Create stacked bar chart showing New MRR and Existing MRR"""
    if df.empty:
        return None
    
    # Create stacked bar chart with Plotly
    fig = go.Figure()
    
    # Add Existing MRR bars (bottom of stack)
    if 'existing_mrr' in df.columns:
        fig.add_trace(go.Bar(
            x=df['month'],
            y=df['existing_mrr'],
            name='Existing MRR',
            marker=dict(
                color='#109618',
                line=dict(color='#109618', width=0)
            ),
            hovertemplate='<b>%{x}</b><br>Existing MRR: $%{y:,.0f}<extra></extra>'
        ))
    
    # Add New MRR bars (top of stack)
    if 'new_mrr' in df.columns:
        fig.add_trace(go.Bar(
            x=df['month'],
            y=df['new_mrr'],
            name='New MRR',
            marker=dict(
                color='#3366CC',
                line=dict(color='#3366CC', width=0)
            ),
            hovertemplate='<b>%{x}</b><br>New MRR: $%{y:,.0f}<extra></extra>'
        ))
    
    # Add total MRR text labels on top of stacked bars
    if 'total_mrr' in df.columns:
        fig.add_trace(go.Scatter(
            x=df['month'],
            y=df['total_mrr'],
            mode='text',
            text=df['total_mrr'].apply(lambda x: f"${x:,.0f}"),
            textposition='top center',
            textfont=dict(size=12, color='#333333'),
            showlegend=False,
            hoverinfo='skip'
        ))
    
    # Update layout for minimalist design
    fig.update_layout(
        title=dict(
            text="Monthly Recurring Revenue",
            font=dict(size=18, color='#111827', family='Inter'),
            x=0.5,
            xanchor='center'
        ),
        xaxis=dict(
            title="Month",
            title_font=dict(size=12, color='#6B7280', family='Inter'),
            tickfont=dict(size=11, color='#6B7280', family='Inter'),
            showgrid=True,
            gridcolor='#E5E7EB',
            gridwidth=1,
            linecolor='#E5E7EB',
            linewidth=1
        ),
        yaxis=dict(
            title="MRR ($)",
            title_font=dict(size=12, color='#6B7280', family='Inter'),
            tickfont=dict(size=11, color='#6B7280', family='Inter'),
            showgrid=True,
            gridcolor='#E5E7EB',
            gridwidth=1,
            tickformat='$,.0f',
            linecolor='#E5E7EB',
            linewidth=1
        ),
        plot_bgcolor='rgba(0,0,0,0)',
        paper_bgcolor='rgba(0,0,0,0)',
        barmode='stack',
        showlegend=True,
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=1.02,
            xanchor="right",
            x=1,
            font=dict(family='Inter', size=11, color='#6B7280')
        ),
        height=400,
        margin=dict(t=60, b=40, l=60, r=40),
        bargap=0.2
    )
    
    return fig

def create_mrr_line_chart(df):
    """Create line chart for MRR trends over time"""
    if df.empty:
        return None
    
    fig = go.Figure()
    
    # Add Total MRR line
    if 'total_mrr' in df.columns:
        fig.add_trace(go.Scatter(
            x=df['month'],
            y=df['total_mrr'],
            mode='lines+markers',
            name='Total MRR',
            line=dict(color='#DC3912', width=3),
            marker=dict(size=8, color='#DC3912'),
            hovertemplate='<b>%{x}</b><br>Total MRR: $%{y:,.0f}<extra></extra>'
        ))
    
    # Add New MRR line
    if 'new_mrr' in df.columns:
        fig.add_trace(go.Scatter(
            x=df['month'],
            y=df['new_mrr'],
            mode='lines+markers',
            name='New MRR',
            line=dict(color='#3366CC', width=3),
            marker=dict(size=8, color='#3366CC'),
            hovertemplate='<b>%{x}</b><br>New MRR: $%{y:,.0f}<extra></extra>'
        ))
    
    # Add Existing MRR line
    if 'existing_mrr' in df.columns:
        fig.add_trace(go.Scatter(
            x=df['month'],
            y=df['existing_mrr'],
            mode='lines+markers',
            name='Existing MRR',
            line=dict(color='#109618', width=3),
            marker=dict(size=8, color='#109618'),
            hovertemplate='<b>%{x}</b><br>Existing MRR: $%{y:,.0f}<extra></extra>'
        ))
    
    fig.update_layout(
        title=dict(
            text="Growth Trends",
            font=dict(size=18, color='#111827', family='Inter'),
            x=0.5,
            xanchor='center'
        ),
        xaxis=dict(
            title="Month",
            title_font=dict(size=12, color='#6B7280', family='Inter'),
            tickfont=dict(size=11, color='#6B7280', family='Inter'),
            showgrid=True,
            gridcolor='#E5E7EB',
            linecolor='#E5E7EB',
            linewidth=1
        ),
        yaxis=dict(
            title="MRR ($)",
            title_font=dict(size=12, color='#6B7280', family='Inter'),
            tickfont=dict(size=11, color='#6B7280', family='Inter'),
            showgrid=True,
            gridcolor='#E5E7EB',
            tickformat='$,.0f',
            linecolor='#E5E7EB',
            linewidth=1
        ),
        plot_bgcolor='rgba(0,0,0,0)',
        paper_bgcolor='rgba(0,0,0,0)',
        height=400,
        margin=dict(t=60, b=40, l=60, r=40),
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=1.02,
            xanchor="right",
            x=1,
            font=dict(family='Inter', size=11, color='#6B7280')
        )
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
            text="Revenue by Plan",
            font=dict(size=18, color='#111827', family='Inter'),
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
            x=1.05,
            font=dict(family='Inter', size=11, color='#6B7280')
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
            text="Customer Insights",
            font=dict(size=18, color='#111827', family='Inter'),
            x=0.5,
            xanchor='center'
        ),
        xaxis=dict(
            title="Month",
            title_font=dict(size=12, color='#6B7280', family='Inter'),
            tickfont=dict(size=11, color='#6B7280', family='Inter'),
            showgrid=True,
            gridcolor='#E5E7EB',
            linecolor='#E5E7EB',
            linewidth=1
        ),
        yaxis=dict(
            title="New Customers",
            title_font=dict(size=12, color='#6B7280', family='Inter'),
            tickfont=dict(size=11, color='#6B7280', family='Inter'),
            showgrid=True,
            gridcolor='#E5E7EB',
            linecolor='#E5E7EB',
            linewidth=1
        ),
        yaxis2=dict(
            title="Total Customers",
            title_font=dict(size=12, color='#6B7280', family='Inter'),
            tickfont=dict(size=11, color='#6B7280', family='Inter'),
            overlaying='y',
            side='right',
            showgrid=False
        ),
        plot_bgcolor='rgba(0,0,0,0)',
        paper_bgcolor='rgba(0,0,0,0)',
        height=400,
        margin=dict(t=60, b=40, l=60, r=60),
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=1.02,
            xanchor="right",
            x=1,
            font=dict(family='Inter', size=11, color='#6B7280')
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
    latest_month_total_mrr = mrr_df['total_mrr'].iloc[-1] if 'total_mrr' in mrr_df.columns and not mrr_df.empty else 0
    previous_month_total_mrr = mrr_df['total_mrr'].iloc[-2] if 'total_mrr' in mrr_df.columns and len(mrr_df) > 1 else 0
    latest_month_new_mrr = mrr_df['new_mrr'].iloc[-1] if 'new_mrr' in mrr_df.columns and not mrr_df.empty else 0
    
    # Calculate month-over-month growth
    if previous_month_total_mrr > 0:
        growth_rate = ((latest_month_total_mrr - previous_month_total_mrr) / previous_month_total_mrr) * 100
    else:
        growth_rate = 0 if latest_month_total_mrr == 0 else 100
    
    # Display metrics in columns with minimalist styling
    col1, col2, col3, col4, col5 = st.columns(5)
    
    metrics_data = [
        {
            "label": "Total MRR",
            "value": f"${latest_month_total_mrr:,.0f}",
            "delta": f"{growth_rate:+.1f}%" if growth_rate != 0 else None
        },
        {
            "label": "New MRR",
            "value": f"${latest_month_new_mrr:,.0f}",
            "delta": None
        },
        {
            "label": "Annual Revenue",
            "value": f"${arr:,.0f}",
            "delta": None
        },
        {
            "label": "Churn Rate",
            "value": f"{churn_metrics['churn_rate']:.1f}%",
            "delta": f"-{churn_metrics['churned_count']} customers" if churn_metrics['churned_count'] > 0 else "0 churned"
        },
        {
            "label": "Active Customers",
            "value": f"{churn_metrics['active_count']:,}",
            "delta": None
        }
    ]
    
    columns = [col1, col2, col3, col4, col5]
    
    for col, metric in zip(columns, metrics_data):
        with col:
            st.markdown(f"""
            <div class="metric-container fade-in">
                <div class="metric-value">{metric['value']}</div>
                <div class="metric-label">{metric['label']}</div>
                {f'<div class="metric-delta" style="color: #6B7280;">{metric["delta"]}</div>' if metric['delta'] else ''}
            </div>
            """, unsafe_allow_html=True)

def main():
    """Main application function"""
    
    # Clean minimalist header
    st.markdown("""
    <div class="dashboard-header fade-in">
        <h1>Revenue Dashboard</h1>
        <p>Comprehensive analytics from Stripe</p>
    </div>
    """, unsafe_allow_html=True)
    
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
    st.markdown('<h2 class="section-title fade-in">Key Metrics</h2>', unsafe_allow_html=True)
    display_key_metrics(filtered_mrr_data, arr, churn_metrics)
    
    st.markdown("---")
    
    # Chart selection tabs
    tab1, tab2, tab3, tab4 = st.tabs([
        "MRR Analysis", 
        "Growth Trends", 
        "Revenue by Plan", 
        "Customer Insights"
    ])
    
    with tab1:
        st.markdown('<div class="chart-wrapper fade-in">', unsafe_allow_html=True)
        st.markdown("### Monthly Recurring Revenue")
        chart = create_mrr_chart(filtered_mrr_data)
        if chart:
            st.plotly_chart(chart, use_container_width=True)
        else:
            st.error("Unable to generate chart from the available data.")
        st.markdown('</div>', unsafe_allow_html=True)
    
    with tab2:
        st.markdown('<div class="chart-wrapper fade-in">', unsafe_allow_html=True)
        st.markdown("### Growth Trends")
        line_chart = create_mrr_line_chart(filtered_mrr_data)
        if line_chart:
            st.plotly_chart(line_chart, use_container_width=True)
        else:
            st.info("Not enough data to display trend line.")
        st.markdown('</div>', unsafe_allow_html=True)
    
    with tab3:
        st.markdown('<div class="chart-wrapper fade-in">', unsafe_allow_html=True)
        st.markdown("### Revenue by Plan")
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
        st.markdown('</div>', unsafe_allow_html=True)
    
    with tab4:
        st.markdown('<div class="chart-wrapper fade-in">', unsafe_allow_html=True)
        st.markdown("### Customer Insights")
        if not filtered_customer_trends.empty:
            customer_chart = create_customer_trends_chart(filtered_customer_trends)
            if customer_chart:
                st.plotly_chart(customer_chart, use_container_width=True)
        else:
            st.info("No customer trend data available.")
        st.markdown('</div>', unsafe_allow_html=True)
    
    st.markdown("---")
    
    # Comparison views
    st.markdown('<h2 class="section-title fade-in">Period Comparisons</h2>', unsafe_allow_html=True)
    
    if len(filtered_mrr_data) >= 2:
        col1, col2 = st.columns(2)
        
        with col1:
            st.markdown('<div class="chart-wrapper fade-in">', unsafe_allow_html=True)
            st.markdown("#### Month-over-Month")
            current_mrr = filtered_mrr_data['total_mrr'].iloc[-1] if 'total_mrr' in filtered_mrr_data.columns else 0
            previous_mrr = filtered_mrr_data['total_mrr'].iloc[-2] if 'total_mrr' in filtered_mrr_data.columns else 0
            mom_change = current_mrr - previous_mrr
            mom_pct = (mom_change / previous_mrr * 100) if previous_mrr > 0 else 0
            
            st.metric(
                label="Latest Month vs Previous",
                value=f"${current_mrr:,.0f}",
                delta=f"${mom_change:+,.0f} ({mom_pct:+.1f}%)"
            )
            st.markdown('</div>', unsafe_allow_html=True)
        
        with col2:
            st.markdown('<div class="chart-wrapper fade-in">', unsafe_allow_html=True)
            st.markdown("#### Year-over-Year")
            if len(filtered_mrr_data) >= 13:
                current_mrr = filtered_mrr_data['total_mrr'].iloc[-1] if 'total_mrr' in filtered_mrr_data.columns else 0
                year_ago_mrr = filtered_mrr_data['total_mrr'].iloc[-13] if 'total_mrr' in filtered_mrr_data.columns else 0
                yoy_change = current_mrr - year_ago_mrr
                yoy_pct = (yoy_change / year_ago_mrr * 100) if year_ago_mrr > 0 else 0
                
                st.metric(
                    label="Latest Month vs Year Ago",
                    value=f"${current_mrr:,.0f}",
                    delta=f"${yoy_change:+,.0f} ({yoy_pct:+.1f}%)"
                )
            else:
                st.info("Need at least 13 months of data for YoY comparison")
            st.markdown('</div>', unsafe_allow_html=True)
    else:
        st.info("Need at least 2 months of data for period comparisons")
    
    # Display raw data table
    with st.expander("📋 View Raw MRR Data"):
        display_columns = {
            "month": "Month"
        }
        
        if 'new_mrr' in filtered_mrr_data.columns:
            display_columns["new_mrr"] = st.column_config.NumberColumn(
                "New MRR ($)",
                format="$%.0f"
            )
        
        if 'existing_mrr' in filtered_mrr_data.columns:
            display_columns["existing_mrr"] = st.column_config.NumberColumn(
                "Existing MRR ($)",
                format="$%.0f"
            )
        
        if 'total_mrr' in filtered_mrr_data.columns:
            display_columns["total_mrr"] = st.column_config.NumberColumn(
                "Total MRR ($)",
                format="$%.0f"
            )
        
        st.dataframe(
            filtered_mrr_data,
            column_config=display_columns,
            hide_index=True,
            use_container_width=True
        )
    
    # Minimalist footer
    st.markdown("---")
    st.markdown("""
    <div style="text-align: center; padding: 2rem 0; color: #6B7280; font-family: 'Inter', sans-serif; font-size: 0.875rem;">
        Data Source: Stripe API | Last Updated: """ + datetime.now().strftime("%Y-%m-%d %H:%M:%S") + """
    </div>
    """, unsafe_allow_html=True)

if __name__ == "__main__":
    main()
