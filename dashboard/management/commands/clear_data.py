from django.core.management.base import BaseCommand
from dashboard.models import Account, Alert, Transaction

class Command(BaseCommand):
    help = 'Clear all accounts, transactions, and alerts from the database'

    def handle(self, *args, **kwargs):
        self.stdout.write('Clearing all data...')
        
        alert_count = Alert.objects.count()
        txn_count = Transaction.objects.count()
        acc_count = Account.objects.count()
        
        Alert.objects.all().delete()
        Transaction.objects.all().delete()
        Account.objects.all().delete()
        
        self.stdout.write(self.style.SUCCESS(
            f'Successfully deleted {alert_count} alerts, {txn_count} transactions, and {acc_count} accounts.'
        ))
