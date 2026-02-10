import pandas as pd
from django.core.management.base import BaseCommand
from dashboard.models import Account, Alert, Transaction
from django.utils.dateparse import parse_date, parse_time
from datetime import datetime

class Command(BaseCommand):
    help = 'Seed database with transactions from Excel file'

    def handle(self, *args, **kwargs):
        self.stdout.write('Clearing existing data...')
        Alert.objects.all().delete()
        Transaction.objects.all().delete()
        Account.objects.all().delete()

        self.stdout.write('Reading Excel file...')
        df = pd.read_excel('aml_20000_transactions.xlsx')
        
        # Ensure correct types
        df['amount'] = df['amount'].astype(str).str.replace('₹', '').str.replace(',', '').astype(float)
        
        self.stdout.write(f'Importing {len(df)} transactions...')
        
        accounts_to_create = {}
        transactions_to_create = []

        for _, row in df.iterrows():
            acc_id = str(row['account_id'])
            if acc_id not in accounts_to_create:
                accounts_to_create[acc_id] = Account(
                    account_id=acc_id,
                    name=f"Account {acc_id}",
                    type='Savings', # Default
                    open_date='2023-01-01', # Default
                    avg_balance='₹0',
                    total_transactions=0,
                    flagged_transactions=0,
                    risk_history=[],
                    counterparties=[]
                )
            
            # Parse date/time
            dt_str = f"{row['date']} {row['time']}"
            try:
                dt = pd.to_datetime(dt_str)
            except:
                dt = datetime.now()

            transactions_to_create.append(Transaction(
                account=accounts_to_create[acc_id],
                date_time=dt,
                type=row['type'],
                amount=f"₹{row['amount']}",
                related_account=str(row['related_account']) if not pd.isna(row['related_account']) else None,
                flag=False
            ))

        self.stdout.write('Saving accounts...')
        Account.objects.bulk_create(accounts_to_create.values())
        
        # Re-fetch accounts to get IDs for foreign keys
        account_map = {acc.account_id: acc for acc in Account.objects.all()}
        for txn in transactions_to_create:
            txn.account = account_map[txn.account.account_id]

        self.stdout.write('Saving transactions...')
        Transaction.objects.bulk_create(transactions_to_create)

        self.stdout.write(self.style.SUCCESS(f'Successfully seeded {len(accounts_to_create)} accounts and {len(transactions_to_create)} transactions.'))
