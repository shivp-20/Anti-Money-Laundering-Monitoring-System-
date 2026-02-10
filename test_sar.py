import os
import django
import sys

# Setup Django environment
sys.path.append('g:/attempt2/attempt')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aml_backend.settings')
django.setup()

from django.conf import settings
from dashboard.rag.utils.sar_generator import SARGenerator

def test_sar():
    api_key = getattr(settings, 'GROQ_API_KEY', None)
    print(f"Using API Key: {api_key[:10]}...")
    
    generator = SARGenerator(api_key=api_key)
    
    customer_data = {'name': 'Test User', 'account_id': 'ACC999'}
    patterns = ['Structuring']
    risk_score = 95
    evidence = "- 2026-01-20: Deposit of ₹49900\n- 2026-01-21: Deposit of ₹49800"
    
    try:
        print("Generating report...")
        report = generator.generate_report(customer_data, patterns, risk_score, evidence)
        print("Report Generated Successfully!")
        print("-" * 30)
        print(report[:200] + "...")
        print("-" * 30)
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_sar()
