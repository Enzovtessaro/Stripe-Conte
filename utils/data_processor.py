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
