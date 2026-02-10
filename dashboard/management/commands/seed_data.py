from django.core.management.base import BaseCommand
from dashboard.models import Account, Alert, Transaction
from datetime import datetime, time

class Command(BaseCommand):
    help = 'Seeds the database with mock data'

    def handle(self, *args, **kwargs):
        # Clear existing data
        Alert.objects.all().delete()
        Transaction.objects.all().delete()
        Account.objects.all().delete()

        # Create Account
        acc = Account.objects.create(
            account_id='ACC-45891',
            name='Rajesh Kumar',
            type='Individual',
            open_date='2025-08-15',
            avg_balance='₹245,000',
            total_transactions=127,
            flagged_transactions=15,
            risk_history=[45, 52, 61, 73, 88, 95],
            counterparties=['ACC-98765', 'ACC-11223', 'ACC-33445', 'ACC-77889', 'ACC-55667', 'ACC-22334']
        )

        # Create Alerts
        alerts_data = [
            { 'id': 'AML-2026-001', 'accountId': 'ACC-45891', 'accountName': 'Rajesh Kumar', 'riskScore': 95, 'type': 'Money Mule + Structuring', 'date': '2026-01-24', 'time': '14:30', 'status': 'Open', 'amount': '₹8,750,000', 'transactions': 15, 'priority': 'Critical' },
            { 'id': 'AML-2026-002', 'accountId': 'ACC-23456', 'accountName': 'Priya Sharma', 'riskScore': 92, 'type': 'High Volume', 'date': '2026-01-24', 'time': '12:15', 'status': 'Under Review', 'amount': '₹12,300,000', 'transactions': 8, 'priority': 'Critical' },
            { 'id': 'AML-2026-003', 'accountId': 'ACC-78923', 'accountName': 'Mohammed Ali', 'riskScore': 88, 'type': 'Round Trip', 'date': '2026-01-23', 'time': '16:45', 'status': 'Open', 'amount': '₹4,500,000', 'transactions': 12, 'priority': 'High' },
            { 'id': 'AML-2026-004', 'accountId': 'ACC-34567', 'accountName': 'Anita Desai', 'riskScore': 85, 'type': 'Structuring', 'date': '2026-01-23', 'time': '09:20', 'status': 'Closed', 'amount': '₹2,100,000', 'transactions': 9, 'priority': 'High' },
            { 'id': 'AML-2026-005', 'accountId': 'ACC-56789', 'accountName': 'Vikram Singh', 'riskScore': 78, 'type': 'High Volume', 'date': '2026-01-22', 'time': '11:30', 'status': 'Under Review', 'amount': '₹3,200,000', 'transactions': 6, 'priority': 'Medium' },
        ]

        for a in alerts_data:
            # Ensure account exists for other alerts (simplified: creating dummy accounts if needed)
            if a['accountId'] == 'ACC-45891':
                account = acc
            else:
                account, created = Account.objects.get_or_create(
                    account_id=a['accountId'],
                    defaults={
                        'name': a['accountName'],
                        'type': 'Individual',
                        'open_date': '2025-01-01',
                        'avg_balance': '₹100,000',
                        'total_transactions': 50,
                        'flagged_transactions': 5
                    }
                )
            
            Alert.objects.create(
                alert_id=a['id'],
                account=account,
                risk_score=a['riskScore'],
                type=a['type'],
                date=a['date'],
                time=a['time'],
                status=a['status'],
                amount=a['amount'],
                transactions_count=a['transactions'],
                priority=a['priority']
            )

        # Create Transactions for Rajesh
        transactions_data = [
            { 'date': '2026-01-24 14:30', 'type': 'Withdrawal', 'amount': '₹850,000', 'to': 'ACC-98765', 'flag': True },
            { 'date': '2026-01-24 14:15', 'type': 'Deposit', 'amount': '₹900,000', 'from': 'ACC-11223', 'flag': True },
            { 'date': '2026-01-24 09:20', 'type': 'Deposit', 'amount': '₹920,000', 'from': 'ACC-33445', 'flag': True },
            { 'date': '2026-01-23 16:45', 'type': 'Withdrawal', 'amount': '₹880,000', 'to': 'ACC-77889', 'flag': True },
            { 'date': '2026-01-23 11:30', 'type': 'Deposit', 'amount': '₹950,000', 'from': 'ACC-55667', 'flag': True },
        ]

        for t in transactions_data:
            dt = datetime.strptime(t['date'], '%Y-%m-%d %H:%M')
            Transaction.objects.create(
                account=acc,
                date_time=dt,
                type=t['type'],
                amount=t['amount'],
                related_account=t.get('to') or t.get('from'),
                flag=t['flag']
            )

        self.stdout.write(self.style.SUCCESS('Successfully seeded database'))
