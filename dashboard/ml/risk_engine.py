import pandas as pd
from datetime import datetime, timedelta
from sklearn.ensemble import IsolationForest
import numpy as np
import joblib
import os

class RiskEngine:
    MODEL_PATH = os.path.join(os.path.dirname(__file__), 'models', 'isolation_forest.joblib')

    def __init__(self, data=None):
        """
        data: List of dictionaries representing transactions.
        """
        if data is not None:
            self.df = pd.DataFrame(data)
            self._map_columns()
            self._prepare_data()
        else:
            self.df = None

    def _map_columns(self):
        """Map common column name variations to internal names"""
        mapping = {
            'account_id': ['account_id', 'account', 'account number', 'acc no', 'customer id', 'id'],
            'date': ['date', 'transaction date', 'txn date', 'date_time'],
            'time': ['time', 'transaction time', 'txn time'],
            'amount': ['amount', 'transaction amount', 'value', 'txn amount', 'debit', 'credit'],
            'type': ['type', 'transaction type', 'txn type', 'description'],
            'related_account': ['related_account', 'to', 'from', 'counterparty', 'beneficiary']
        }

        found_mapping = {}
        for internal_name, variations in mapping.items():
            for col in self.df.columns:
                if str(col).lower().strip() in variations:
                    found_mapping[col] = internal_name
                    break
        
        self.df = self.df.rename(columns=found_mapping)

        # Validation
        required = ['account_id', 'date', 'amount']
        missing = [col for col in required if col not in self.df.columns]
        if missing:
            raise ValueError(f"Missing required columns: {', '.join(missing)}. Found: {', '.join(self.df.columns)}")

    def _prepare_data(self):
        """Convert types and handle missing time"""
        try:
            if 'time' not in self.df.columns:
                # If time is missing, try to extract from date or default to 00:00:00
                self.df['datetime'] = pd.to_datetime(self.df['date'])
            else:
                dates = self.df['date'].astype(str)
                times = self.df['time'].astype(str)
                self.df['datetime'] = pd.to_datetime(dates + ' ' + times)
        except Exception as e:
            print(f"Error parsing datetime: {e}")
            self.df['datetime'] = pd.to_datetime(self.df['date'], errors='coerce')

        # Robust amount parsing
        def clean_amount(val):
            if pd.isna(val): return 0.0
            if isinstance(val, (int, float)):
                return float(val)
            return float(str(val).replace('₹', '').replace(',', '').replace('$', ''))

        self.df['amount'] = self.df['amount'].apply(clean_amount)
        
        # Ensure 'type' exists
        if 'type' not in self.df.columns:
            self.df['type'] = 'Unknown'
        
        # Ensure 'related_account' exists
        if 'related_account' not in self.df.columns:
            self.df['related_account'] = None

    def extract_features_vectorized(self, df):
        """
        Extract features for all accounts at once using vectorized operations.
        This is significantly faster for millions of records.
        """
        # 1. Total Volume
        stats = df.groupby('account_id')['amount'].agg(['sum', 'count']).rename(columns={'sum': 'total_volume', 'count': 'transaction_count'})
        
        # 2. Structuring Count (45k - 50k)
        df['is_structuring'] = (df['amount'] >= 45000) & (df['amount'] < 50000)
        structuring = df.groupby('account_id')['is_structuring'].sum().rename('structuring_count')
        
        # 3. Money Mule Score (Rapid In/Out)
        # We'll use a simplified vectorized version for scale: 
        # Accounts where total deposits approx equal total withdrawals within a short window
        # For true scale, we might use a rolling window or just flag high-frequency churn
        df = df.sort_values(['account_id', 'datetime'])
        df['prev_amount'] = df.groupby('account_id')['amount'].shift(1)
        df['prev_type'] = df.groupby('account_id')['type'].shift(1)
        df['time_diff'] = df.groupby('account_id')['datetime'].diff().dt.total_seconds()
        
        # Flag if Withdrawal follows Deposit of similar amount within 24h
        df['is_mule'] = (df['type'] == 'Withdrawal') & \
                        (df['prev_type'] == 'Deposit') & \
                        (df['time_diff'] <= 86400) & \
                        (df['amount'] >= 0.95 * df['prev_amount']) & \
                        (df['amount'] <= 1.05 * df['prev_amount'])
        
        mule_scores = df.groupby('account_id')['is_mule'].sum().rename('mule_score')
        
        # 4. Round Trip Count
        # Flag if related_account appears as both sender and receiver for the same account
        round_trips = df[df['related_account'].notna()].groupby(['account_id', 'related_account']).size()
        # If size > 1 for a pair, it's a potential round trip (simplification)
        round_trip_counts = round_trips[round_trips > 1].groupby('account_id').count().rename('round_trip_count')
        
        # Combine all features
        features_df = pd.concat([stats, structuring, mule_scores, round_trip_counts], axis=1).fillna(0)
        return features_df

    def train(self, data):
        self.df = pd.DataFrame(data)
        self._map_columns()
        self._prepare_data()
        
        features_df = self.extract_features_vectorized(self.df)
        X = features_df[['total_volume', 'structuring_count', 'mule_score', 'round_trip_count']].values
        
        clf = IsolationForest(random_state=42, contamination=0.1)
        clf.fit(X)
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(self.MODEL_PATH), exist_ok=True)
        joblib.dump(clf, self.MODEL_PATH)
        return clf

    def analyze(self, use_saved_model=True, chunk_mode=False):
        if self.df is None:
            return []

        # Extract features using vectorized logic
        features_df = self.extract_features_vectorized(self.df)
        
        if features_df.empty:
            return []

        X = features_df[['total_volume', 'structuring_count', 'mule_score', 'round_trip_count']].values

        if use_saved_model and os.path.exists(self.MODEL_PATH):
            clf = joblib.load(self.MODEL_PATH)
        else:
            clf = IsolationForest(random_state=42, contamination=0.1)
            clf.fit(X)
        
        scores = clf.decision_function(X)
        
        # Normalize scores
        min_score, max_score = scores.min(), scores.max()
        if max_score == min_score:
            normalized_scores = [50] * len(scores)
        else:
            normalized_scores = (1 - ((scores - min_score) / (max_score - min_score))) * 100

        results = []
        for i, (account_id, row) in enumerate(features_df.iterrows()):
            risk_score = int(normalized_scores[i])
            patterns = []
            if row['total_volume'] > 1000000: patterns.append('High Volume')
            if row['structuring_count'] >= 2: patterns.append('Structuring')
            if row['mule_score'] > 0: patterns.append('Money Mule')
            if row['round_trip_count'] > 0: patterns.append('Round Trip')
            if risk_score > 75 and not patterns: patterns.append('Anomalous Behavior')

            results.append({
                'accountId': account_id,
                'riskScore': risk_score,
                'patterns': patterns,
                'totalVolume': float(row['total_volume']),
                'transactionCount': int(row['transaction_count'])
            })

        return results
