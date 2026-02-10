from django.core.management.base import BaseCommand
from dashboard.models import Transaction
from dashboard.ml.risk_engine import RiskEngine

class Command(BaseCommand):
    help = 'Train the Isolation Forest model on all transactions in the database'

    def handle(self, *args, **kwargs):
        self.stdout.write('Fetching transactions for training...')
        txns = Transaction.objects.all().values(
            'account__account_id', 'date_time', 'type', 'amount', 'related_account'
        )
        
        if not txns:
            self.stdout.write(self.style.WARNING('No transactions found in database. Please seed data first.'))
            return

        # Format data for RiskEngine
        data = []
        for t in txns:
            data.append({
                'account_id': t['account__account_id'],
                'date': t['date_time'].strftime('%Y-%m-%d'),
                'time': t['date_time'].strftime('%H:%M:%S'),
                'type': t['type'],
                'amount': t['amount'],
                'related_account': t['related_account']
            })

        self.stdout.write(f'Training model on {len(data)} transactions...')
        engine = RiskEngine()
        engine.train(data)

        self.stdout.write(self.style.SUCCESS('Model trained and saved successfully.'))
