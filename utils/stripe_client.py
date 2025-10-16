import stripe
import streamlit as st
from datetime import datetime, timedelta
from typing import List, Dict, Any

class StripeClient:
    """Client for interacting with Stripe API"""
    
    def __init__(self, api_key: str):
        """Initialize Stripe client with API key"""
        stripe.api_key = api_key
        self.api_key = api_key
    
    def get_subscriptions(self, limit: int = 100) -> List[Dict[Any, Any]]:
        """
        Retrieve all active and past subscriptions from Stripe
        
        Args:
            limit: Maximum number of subscriptions to retrieve per request
            
        Returns:
            List of subscription objects
        """
        subscriptions = []
        
        try:
            # Get all subscriptions (active, canceled, past_due, etc.)
            has_more = True
            starting_after = None
            
            while has_more:
                params = {
                    'limit': limit,
                    'expand': ['data.items.data.price']  # Expand price data
                }
                
                if starting_after:
                    params['starting_after'] = starting_after
                
                response = stripe.Subscription.list(**params)
                
                subscriptions.extend(response.data)
                
                has_more = response.has_more
                if has_more and response.data:
                    starting_after = response.data[-1].id
            
            return subscriptions
            
        except stripe.error.AuthenticationError:
            st.error("❌ Invalid Stripe API key. Please check your STRIPE_SECRET_KEY environment variable.")
            return []
        except stripe.error.PermissionError:
            st.error("❌ Insufficient permissions. Please ensure your API key has access to read subscription data.")
            return []
        except stripe.error.StripeError as e:
            st.error(f"❌ Stripe API error: {str(e)}")
            return []
        except Exception as e:
            st.error(f"❌ Unexpected error: {str(e)}")
            return []
    
    def get_subscription_details(self, subscription_id: str) -> Dict[Any, Any]:
        """
        Get detailed information about a specific subscription
        
        Args:
            subscription_id: The Stripe subscription ID
            
        Returns:
            Subscription object with full details
        """
        try:
            subscription = stripe.Subscription.retrieve(
                subscription_id,
                expand=['items.data.price', 'customer']
            )
            return subscription
        except stripe.error.StripeError as e:
            st.error(f"Error retrieving subscription {subscription_id}: {str(e)}")
            return {}
    
    def test_connection(self) -> bool:
        """
        Test the Stripe API connection
        
        Returns:
            True if connection is successful, False otherwise
        """
        try:
            # Try to retrieve account information
            stripe.Account.retrieve()
            return True
        except stripe.error.AuthenticationError:
            return False
        except Exception:
            return False
