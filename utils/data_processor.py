import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Any
import streamlit as st

class DataProcessor:
    """Process Stripe subscription data to calculate MRR metrics"""
    
    def __init__(self):
        """Initialize data processor"""
        pass
    
    def calculate_new_mrr_by_month(self, subscriptions: List[Dict[Any, Any]]) -> pd.DataFrame:
        """
        Calculate New Monthly Recurring Revenue by month from subscription data
        
        Args:
            subscriptions: List of Stripe subscription objects
            
        Returns:
            DataFrame with columns: month, new_mrr, subscription_count
        """
        if not subscriptions:
            return pd.DataFrame()
        
        try:
            # Extract relevant subscription data
            subscription_data = []
            
            for sub in subscriptions:
                # Get subscription start date
                created_date = datetime.fromtimestamp(sub.get('created', 0))
                
                # Calculate MRR for this subscription
                mrr_amount = self._calculate_subscription_mrr(sub)
                
                if mrr_amount > 0:  # Only include subscriptions with positive MRR
                    subscription_data.append({
                        'subscription_id': sub.get('id'),
                        'created_date': created_date,
                        'mrr_amount': mrr_amount,
                        'status': sub.get('status'),
                        'month_year': created_date.strftime('%Y-%m')
                    })
            
            if not subscription_data:
                return pd.DataFrame()
            
            # Create DataFrame
            df = pd.DataFrame(subscription_data)
            
            # Group by month and calculate new MRR
            monthly_mrr = df.groupby('month_year').agg({
                'mrr_amount': 'sum',
                'subscription_id': 'count'
            }).reset_index()
            
            # Rename columns
            monthly_mrr.columns = ['month_year', 'new_mrr', 'subscription_count']
            
            # Convert month_year to proper date format for sorting
            monthly_mrr['month_date'] = pd.to_datetime(monthly_mrr['month_year'])
            monthly_mrr = monthly_mrr.sort_values('month_date')
            
            # Format month for display
            monthly_mrr['month'] = monthly_mrr['month_date'].dt.strftime('%b %Y')
            
            # Select final columns
            result_df = monthly_mrr[['month', 'new_mrr', 'subscription_count']].copy()
            
            return result_df
            
        except Exception as e:
            st.error(f"Error processing subscription data: {str(e)}")
            return pd.DataFrame()
    
    def _calculate_subscription_mrr(self, subscription: Dict[Any, Any]) -> float:
        """
        Calculate Monthly Recurring Revenue for a single subscription
        
        Args:
            subscription: Stripe subscription object
            
        Returns:
            Monthly recurring revenue amount
        """
        try:
            total_mrr = 0
            
            # Get subscription items
            items = subscription.get('items', {}).get('data', [])
            
            for item in items:
                price = item.get('price', {})
                quantity = item.get('quantity', 1)
                
                if not price:
                    continue
                
                # Get price amount and interval
                unit_amount = price.get('unit_amount', 0) / 100  # Convert from cents
                interval = price.get('recurring', {}).get('interval')
                interval_count = price.get('recurring', {}).get('interval_count', 1)
                
                # Convert to monthly amount
                if interval == 'month':
                    monthly_amount = unit_amount / interval_count
                elif interval == 'year':
                    monthly_amount = unit_amount / (12 * interval_count)
                elif interval == 'week':
                    monthly_amount = unit_amount * (52 / 12) / interval_count
                elif interval == 'day':
                    monthly_amount = unit_amount * (365 / 12) / interval_count
                else:
                    # Unknown interval, skip
                    continue
                
                total_mrr += monthly_amount * quantity
            
            return round(total_mrr, 2)
            
        except Exception as e:
            # Log error but don't fail the entire calculation
            print(f"Error calculating MRR for subscription {subscription.get('id', 'unknown')}: {str(e)}")
            return 0
    
    def calculate_mrr_growth(self, df: pd.DataFrame) -> Dict[str, float]:
        """
        Calculate MRR growth metrics
        
        Args:
            df: DataFrame with MRR data by month
            
        Returns:
            Dictionary with growth metrics
        """
        if df.empty or len(df) < 2:
            return {
                'current_month_mrr': 0,
                'previous_month_mrr': 0,
                'month_over_month_growth': 0,
                'total_new_mrr': 0
            }
        
        try:
            current_month_mrr = df['new_mrr'].iloc[-1]
            previous_month_mrr = df['new_mrr'].iloc[-2]
            total_new_mrr = df['new_mrr'].sum()
            
            # Calculate growth rate
            if previous_month_mrr > 0:
                growth_rate = ((current_month_mrr - previous_month_mrr) / previous_month_mrr) * 100
            else:
                growth_rate = 100 if current_month_mrr > 0 else 0
            
            return {
                'current_month_mrr': current_month_mrr,
                'previous_month_mrr': previous_month_mrr,
                'month_over_month_growth': round(growth_rate, 2),
                'total_new_mrr': total_new_mrr
            }
            
        except Exception as e:
            st.error(f"Error calculating growth metrics: {str(e)}")
            return {
                'current_month_mrr': 0,
                'previous_month_mrr': 0,
                'month_over_month_growth': 0,
                'total_new_mrr': 0
            }
    
    def calculate_arr(self, subscriptions: List[Dict[Any, Any]]) -> float:
        """
        Calculate Annual Recurring Revenue (ARR)
        
        Args:
            subscriptions: List of Stripe subscription objects
            
        Returns:
            Total ARR
        """
        total_arr = 0
        
        for sub in subscriptions:
            if sub.get('status') in ['active', 'trialing']:
                mrr = self._calculate_subscription_mrr(sub)
                total_arr += mrr * 12
        
        return round(total_arr, 2)
    
    def calculate_churn_metrics(self, subscriptions: List[Dict[Any, Any]]) -> Dict[str, Any]:
        """
        Calculate churn rate and related metrics
        
        Args:
            subscriptions: List of Stripe subscription objects
            
        Returns:
            Dictionary with churn metrics (churn for current month period)
        """
        try:
            from datetime import datetime
            from dateutil.relativedelta import relativedelta
            
            current_date = datetime.now()
            start_of_current_month = current_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            
            active_start_of_month = 0
            active_current = 0
            churned_this_month = 0
            
            for sub in subscriptions:
                created_date = datetime.fromtimestamp(sub.get('created', 0))
                canceled_date = None
                
                if sub.get('canceled_at'):
                    canceled_date = datetime.fromtimestamp(sub.get('canceled_at'))
                
                was_active_at_month_start = (
                    created_date < start_of_current_month and
                    (not canceled_date or canceled_date >= start_of_current_month)
                )
                
                is_active_now = (
                    created_date < current_date and
                    (not canceled_date or canceled_date >= current_date)
                )
                
                if was_active_at_month_start:
                    active_start_of_month += 1
                    
                    if not is_active_now and canceled_date and start_of_current_month <= canceled_date < current_date:
                        churned_this_month += 1
                
                if is_active_now:
                    active_current += 1
            
            churn_rate = (churned_this_month / active_start_of_month * 100) if active_start_of_month > 0 else 0
            
            return {
                'churn_rate': round(churn_rate, 2),
                'churned_count': churned_this_month,
                'active_count': active_current,
                'previous_active_count': active_start_of_month
            }
            
        except Exception as e:
            return {
                'churn_rate': 0,
                'churned_count': 0,
                'active_count': 0,
                'previous_active_count': 0
            }
    
    def calculate_customer_trends(self, subscriptions: List[Dict[Any, Any]]) -> pd.DataFrame:
        """
        Calculate customer count trends by month
        
        Args:
            subscriptions: List of Stripe subscription objects
            
        Returns:
            DataFrame with customer counts by month
        """
        try:
            customer_data = []
            
            for sub in subscriptions:
                created_date = datetime.fromtimestamp(sub.get('created', 0))
                month_year = created_date.strftime('%Y-%m')
                
                customer_data.append({
                    'month_year': month_year,
                    'customer_id': sub.get('customer'),
                    'created_date': created_date
                })
            
            if not customer_data:
                return pd.DataFrame()
            
            df = pd.DataFrame(customer_data)
            
            monthly_customers = df.groupby('month_year').agg({
                'customer_id': 'count'
            }).reset_index()
            
            monthly_customers.columns = ['month_year', 'new_customers']
            
            monthly_customers['month_date'] = pd.to_datetime(monthly_customers['month_year'])
            monthly_customers = monthly_customers.sort_values('month_date')
            
            monthly_customers['month'] = monthly_customers['month_date'].dt.strftime('%b %Y')
            monthly_customers['cumulative_customers'] = monthly_customers['new_customers'].cumsum()
            
            return monthly_customers[['month', 'new_customers', 'cumulative_customers']]
            
        except Exception as e:
            st.error(f"Error calculating customer trends: {str(e)}")
            return pd.DataFrame()
    
    def calculate_new_vs_existing_mrr_by_month(self, subscriptions: List[Dict[Any, Any]]) -> pd.DataFrame:
        """
        Calculate New MRR vs Existing MRR by month
        
        Args:
            subscriptions: List of Stripe subscription objects
            
        Returns:
            DataFrame with columns: month, new_mrr, existing_mrr, total_mrr
        """
        if not subscriptions:
            return pd.DataFrame()
        
        try:
            from dateutil.relativedelta import relativedelta
            
            subscription_data = []
            
            for sub in subscriptions:
                created_date = datetime.fromtimestamp(sub.get('created', 0))
                canceled_at = sub.get('canceled_at')
                canceled_date = datetime.fromtimestamp(canceled_at) if canceled_at else None
                status = sub.get('status')
                mrr_amount = self._calculate_subscription_mrr(sub)
                
                if mrr_amount > 0:
                    subscription_data.append({
                        'subscription_id': sub.get('id'),
                        'created_date': created_date,
                        'canceled_date': canceled_date,
                        'status': status,
                        'mrr_amount': mrr_amount
                    })
            
            if not subscription_data:
                return pd.DataFrame()
            
            df = pd.DataFrame(subscription_data)
            
            all_months = set()
            for _, row in df.iterrows():
                created_month = row['created_date'].replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                all_months.add(created_month)
                
                if row['canceled_date']:
                    canceled_month = row['canceled_date'].replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                    current = created_month
                    while current <= canceled_month:
                        all_months.add(current)
                        current = current + relativedelta(months=1)
                else:
                    current = created_month
                    now = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                    while current <= now:
                        all_months.add(current)
                        current = current + relativedelta(months=1)
            
            monthly_results = []
            
            for month in sorted(all_months):
                month_end = month + relativedelta(months=1) - timedelta(seconds=1)
                new_mrr = 0
                existing_mrr = 0
                
                for _, row in df.iterrows():
                    created_date = row['created_date']
                    canceled_date = row['canceled_date']
                    mrr = row['mrr_amount']
                    
                    is_active_in_month = (
                        created_date <= month_end and
                        (not canceled_date or canceled_date >= month)
                    )
                    
                    if is_active_in_month:
                        created_month = created_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                        if created_month == month:
                            new_mrr += mrr
                        else:
                            existing_mrr += mrr
                
                monthly_results.append({
                    'month_date': month,
                    'new_mrr': round(new_mrr, 2),
                    'existing_mrr': round(existing_mrr, 2),
                    'total_mrr': round(new_mrr + existing_mrr, 2)
                })
            
            result_df = pd.DataFrame(monthly_results)
            result_df = result_df.sort_values('month_date')
            result_df['month'] = result_df['month_date'].dt.strftime('%b %Y')
            
            return result_df[['month', 'new_mrr', 'existing_mrr', 'total_mrr']].copy()
            
        except Exception as e:
            st.error(f"Error calculating new vs existing MRR: {str(e)}")
            return pd.DataFrame()
    
    def calculate_revenue_by_plan(self, subscriptions: List[Dict[Any, Any]], product_names: Dict[str, str] = None) -> pd.DataFrame:
        """
        Calculate revenue breakdown by plan/product
        
        Args:
            subscriptions: List of Stripe subscription objects
            product_names: Optional dictionary mapping product IDs to product names
            
        Returns:
            DataFrame with revenue by plan
        """
        try:
            if product_names is None:
                product_names = {}
            
            plan_data = []
            
            for sub in subscriptions:
                if sub.get('status') not in ['active', 'trialing']:
                    continue
                
                items = sub.get('items', {}).get('data', [])
                
                for item in items:
                    price = item.get('price', {})
                    product = price.get('product', {})
                    
                    # Determine product name
                    if isinstance(product, dict):
                        # Product was expanded, use the name from it
                        product_name = product.get('name', 'Unknown Product')
                    elif isinstance(product, str):
                        # Product is an ID, look up the name from product_names map
                        product_name = product_names.get(product, product)
                    else:
                        product_name = 'Unknown Product'
                    
                    mrr = self._calculate_subscription_mrr({'items': {'data': [item]}})
                    
                    plan_data.append({
                        'product_name': product_name,
                        'mrr': mrr
                    })
            
            if not plan_data:
                return pd.DataFrame()
            
            df = pd.DataFrame(plan_data)
            
            plan_summary = df.groupby('product_name').agg({
                'mrr': 'sum'
            }).reset_index()
            
            plan_summary.columns = ['plan', 'mrr']
            plan_summary = plan_summary.sort_values('mrr', ascending=False)
            plan_summary['percentage'] = (plan_summary['mrr'] / plan_summary['mrr'].sum() * 100).round(2)
            
            return plan_summary
            
        except Exception as e:
            st.error(f"Error calculating revenue by plan: {str(e)}")
            return pd.DataFrame()
