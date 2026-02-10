from django.core.management.base import BaseCommand
from dashboard.models import Account, Alert, Transaction
from dashboard.ml.risk_engine import RiskEngine
from django.utils import timezone

class Command(BaseCommand):
    help = 'Generate alerts for all accounts using RiskEngine'

    def handle(self, *args, **kwargs):
        self.stdout.write('Fetching transactions...')
        txns = Transaction.objects.all().values(
            'account__account_id', 'date_time', 'type', 'amount', 'related_account'
        )
        
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

        self.stdout.write('Running RiskEngine...')
        engine = RiskEngine(data)
        results = engine.analyze()

        self.stdout.write(f'Generated {len(results)} suspicious patterns. Saving alerts...')
        
        alerts_to_create = []
        for res in results:
            # Create an alert for each flagged account
            alerts_to_create.append(Alert(
                alert_id=f"AL-{res['accountId']}-{timezone.now().strftime('%m%d%H%M')}",
                account=Account.objects.get(account_id=res['accountId']),
                risk_score=res['riskScore'],
                type=" + ".join(res['patterns']),
                date=timezone.now().date(),
                time=timezone.now().time(),
                status='Open',
                amount=f"₹{res['totalVolume']:,.2f}",
                transactions_count=res['transactionCount'],
                priority='Critical' if res['riskScore'] > 90 else 'High'
            ))

        Alert.objects.bulk_create(alerts_to_create)
        self.stdout.write(self.style.SUCCESS(f'Successfully generated {len(alerts_to_create)} alerts.'))
