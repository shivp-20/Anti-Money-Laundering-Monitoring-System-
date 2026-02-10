import os
import sys
import django

# Setup Django environment
project_path = 'g:/attempt2/attempt'
if project_path not in sys.path:
    sys.path.append(project_path)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aml_backend.settings')
django.setup()

from django.test import RequestFactory
from django.contrib.auth.models import User
from dashboard.views import SARGenerationView
from dashboard.models import Alert, Account

def test_view():
    # Get a user and an alert
    user = User.objects.first()
    if not user:
        user = User.objects.create_user(username='testuser', password='password')
        
    alert = Alert.objects.filter(user=user).first()
    
    if not alert:
        print("No alerts found for user. Creating one...")
        from datetime import datetime
        acc, _ = Account.objects.get_or_create(account_id="TESTACC", user=user, defaults={
            "name": "Test Account", "type": "Savings", "open_date": datetime.now().date(), "avg_balance": "0", "total_transactions": 0, "flagged_transactions": 0
        })
        alert = Alert.objects.create(alert_id="TESTALERT", account=acc, user=user, risk_score=99, type="Structuring", date=datetime.now().date(), time=datetime.now().time(), status="Open", amount="50000", transactions_count=1, priority="Critical")

    factory = RequestFactory()
    request = factory.post(f'/api/generate-sar/{alert.id}/')
    request.user = user
    
    view = SARGenerationView.as_view()
    response = view(request, alert_id=alert.id)
    
    print(f"Status Code: {response.status_code}")
    print(f"Response Data: {response.data}")

if __name__ == "__main__":
    test_view()
