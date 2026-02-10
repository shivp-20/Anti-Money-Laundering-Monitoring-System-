from rest_framework import viewsets, views, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from .models import Account, Alert, Transaction, ProcessingTask
from .serializers import AccountSerializer, AlertSerializer, TransactionSerializer
from .ml.risk_engine import RiskEngine
import pandas as pd
import io
import threading
import uuid
from django.db.models import Sum
from django.db.models.functions import Cast
from django.db.models import FloatField
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.contrib.auth.models import User
from rest_framework_simplejwt.tokens import RefreshToken
from google.oauth2 import id_token
from google.auth.transport import requests
from django.conf import settings

class AccountViewSet(viewsets.ModelViewSet):
    serializer_class = AccountSerializer
    lookup_field = 'account_id'

    def get_queryset(self):
        return Account.objects.filter(user=self.request.user)

    @action(detail=True, methods=['get'])
    def transactions(self, request, account_id=None):
        account = self.get_object()
        transactions = Transaction.objects.filter(account=account).order_by('-date_time')
        serializer = TransactionSerializer(transactions, many=True)
        return Response(serializer.data)

class AlertViewSet(viewsets.ModelViewSet):
    serializer_class = AlertSerializer
    
    def get_queryset(self):
        return Alert.objects.filter(user=self.request.user)
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        total_accounts = Account.objects.filter(user=request.user).count()
        flagged_accounts = Account.objects.filter(user=request.user, alerts__isnull=False).distinct().count()
        
        # Calculate suspicious volume
        try:
            volume_sum = Alert.objects.filter(user=request.user).aggregate(
                total=Sum(Cast('amount', FloatField()))
            )['total'] or 0
        except:
            volume_sum = 0
            for alert in Alert.objects.filter(user=request.user):
                try:
                    clean_amt = float(str(alert.amount).replace('₹', '').replace(',', '').strip())
                    volume_sum += clean_amt
                except:
                    continue
        
        # Format volume (e.g., ₹1.2M or ₹450K)
        if volume_sum >= 1000000:
            volume_str = f"₹{volume_sum/1000000:.1f}M"
        elif volume_sum >= 1000:
            volume_str = f"₹{volume_sum/1000:.1f}K"
        else:
            volume_str = f"₹{int(volume_sum)}"

        # Calculate detection rate
        if total_accounts > 0:
            rate = (flagged_accounts / total_accounts) * 100
            rate_str = f"{rate:.1f}%"
        else:
            rate_str = "0%"

        # 1. Alert Trends (Last 7 days)
        from django.utils import timezone
        from datetime import timedelta
        from django.db.models.functions import TruncDate
        from django.db.models import Count
        
        last_7_days = timezone.now().date() - timedelta(days=7)
        trends = Alert.objects.filter(user=request.user, date__gte=last_7_days)\
            .values('date')\
            .annotate(count=Count('id'))\
            .order_by('date')
        
        trend_data = []
        for i in range(7):
            day = last_7_days + timedelta(days=i+1)
            count = next((t['count'] for t in trends if t['date'] == day), 0)
            trend_data.append({"date": day.strftime('%d %b'), "count": count})

        # 2. Typology Distribution
        typologies = Alert.objects.filter(user=request.user).values('type')
        type_counts = {}
        for t in typologies:
            types = t['type'].split(', ')
            for tp in types:
                type_counts[tp] = type_counts.get(tp, 0) + 1
        
        dist_data = [{"name": name, "value": count} for name, count in type_counts.items()]

        # 3. Detection Funnel
        total_transactions = Transaction.objects.filter(user=request.user).count()

        # 4. Account Type Distribution
        acc_types = Account.objects.filter(user=request.user).values('type').annotate(count=Count('id'))
        acc_type_data = [{"name": a['type'], "value": a['count']} for a in acc_types]

        # 5. High-Impact Activity Feed (Unique)
        impact_feed = []
        recent_alerts = Alert.objects.filter(user=request.user).select_related('account').order_by('-date', '-time')[:5]
        for a in recent_alerts:
            impact_feed.append({
                "id": a.id,
                "account": a.account.account_id,
                "name": a.account.name,
                "reason": a.type.split(', ')[0], # Take primary reason
                "amount": a.amount,
                "time": f"{a.date.strftime('%d %b')} {a.time.strftime('%H:%M')}",
                "severity": a.priority
            })

        return Response({
            "critical_alerts": Alert.objects.filter(user=request.user, priority='Critical').count(),
            "flagged_accounts": flagged_accounts,
            "suspicious_volume": volume_str,
            "detection_rate": rate_str,
            "trend": trend_data,
            "distribution": dist_data,
            "acc_type_dist": acc_type_data,
            "impact_feed": impact_feed,
            "summary": {
                "total_accounts": total_accounts,
                "total_transactions": total_transactions,
                "total_alerts": Alert.objects.filter(user=request.user).count()
            }
        })

class SignupView(views.APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        email = request.data.get('email')

        if not username or not password:
            return Response({"error": "Username and password are required"}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(username=username).exists():
            return Response({"error": "Username already exists"}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(username=username, password=password, email=email)
        refresh = RefreshToken.for_user(user)
        
        return Response({
            "message": "User created successfully",
            "tokens": {
                "refresh": str(refresh),
                "access": str(refresh.access_token),
            },
            "user": {
                "username": user.username,
                "email": user.email
            }
        }, status=status.HTTP_201_CREATED)

class GoogleLoginView(views.APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        token = request.data.get('token')
        if not token:
            return Response({"error": "Token is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Verify the ID token
            idinfo = id_token.verify_oauth2_token(token, requests.Request(), settings.GOOGLE_CLIENT_ID)

            # ID token is valid. Get the user's Google ID and email.
            email = idinfo['email']
            username = email.split('@')[0] # Simple username from email

            # Get or create user
            user, created = User.objects.get_or_create(email=email, defaults={'username': username})
            
            # Generate JWT tokens
            refresh = RefreshToken.for_user(user)
            
            return Response({
                "tokens": {
                    "refresh": str(refresh),
                    "access": str(refresh.access_token),
                },
                "user": {
                    "username": user.username,
                    "email": user.email
                }
            })
        except ValueError:
            # Invalid token
            return Response({"error": "Invalid token"}, status=status.HTTP_400_BAD_REQUEST)

class TaskStatusView(views.APIView):
    def get(self, request, task_id):
        try:
            task = ProcessingTask.objects.get(task_id=task_id)
            return Response({
                "task_id": task.task_id,
                "status": task.status,
                "progress": task.progress,
                "total_records": task.total_records,
                "processed_records": task.processed_records,
                "error": task.error_message
            })
        except ProcessingTask.DoesNotExist:
            return Response({"error": "Task not found"}, status=status.HTTP_404_NOT_FOUND)

def background_process(task_id, file_data, filename, user_id):
    try:
        user = User.objects.get(id=user_id)
        task = ProcessingTask.objects.get(task_id=task_id)
        task.status = 'Processing'
        task.save()

        # Read file
        if filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(file_data))
        else:
            df = pd.read_excel(io.BytesIO(file_data))

        task.total_records = len(df)
        task.save()

        # Run Risk Engine
        engine = RiskEngine()
        engine.df = df
        engine._map_columns()
        engine._prepare_data()
        
        results = engine.analyze(use_saved_model=True)
        
        # Bulk save results for efficiency
        from datetime import datetime
        accounts_to_create = {}
        alerts_to_create = []
        transactions_to_create = []
        
        # Pre-fetch existing accounts for this user to avoid duplicates
        existing_accounts = {acc.account_id: acc for acc in Account.objects.filter(user=user)}
        
        total = len(results)
        for i, res in enumerate(results):
            if i % 1000 == 0:
                task.processed_records = i
                task.progress = int((i / total) * 100)
                task.save()

            acc_id = res['accountId']
            if acc_id not in accounts_to_create and acc_id not in existing_accounts:
                accounts_to_create[acc_id] = Account(
                    account_id=acc_id,
                    user=user,
                    name=f"Account {acc_id}",
                    type='Checking',
                    open_date=datetime.now().date(),
                    avg_balance="₹0",
                    total_transactions=res['transactionCount'],
                    flagged_transactions=1 if res['riskScore'] > 50 else 0
                )
        
        if accounts_to_create:
            Account.objects.bulk_create(accounts_to_create.values())
        
        # Refresh account maps
        all_accounts = {acc.account_id: acc for acc in Account.objects.filter(user=user)}
        
        for res in results:
            account = all_accounts.get(res['accountId'])
            if res['riskScore'] > 50:
                alerts_to_create.append(Alert(
                    alert_id=f"AL-{uuid.uuid4().hex[:10]}-{res['accountId']}",
                    account=account,
                    user=user,
                    risk_score=res['riskScore'],
                    type=", ".join(res['patterns']),
                    date=datetime.now().date(),
                    time=datetime.now().time(),
                    status='Open',
                    amount=str(res['totalVolume']),
                    transactions_count=res['transactionCount'],
                    priority='Critical' if res['riskScore'] > 90 else 'High'
                ))
            
            # Save a few sample transactions for evidence (top 5 by amount for example)
            # In a real app we'd save all, but for demo we'll take a subset to avoid DB bloat
            # Actually, let's extract them from the original dataframe
            sample_txns = df[df['account_id'] == res['accountId']].sort_values(by='amount', ascending=False).head(5)
            for _, row in sample_txns.iterrows():
                transactions_to_create.append(Transaction(
                    user=user,
                    account=account,
                    date_time=pd.to_datetime(row['date'] + ' ' + (row.get('time', '00:00:00'))),
                    type=row.get('type', 'Transfer'),
                    amount=f"₹{row['amount']}",
                    related_account=str(row.get('related_account', '')),
                    flag=res['riskScore'] > 50
                ))

        if alerts_to_create:
            Alert.objects.bulk_create(alerts_to_create, batch_size=1000)
        
        if transactions_to_create:
            Transaction.objects.bulk_create(transactions_to_create, batch_size=2000)

        task.status = 'Completed'
        task.progress = 100
        task.processed_records = total
        task.save()

    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Background Task Failed: {error_trace}")
        task = ProcessingTask.objects.get(task_id=task_id)
        task.status = 'Failed'
        task.error_message = str(e)
        task.save()

class UploadView(views.APIView):
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, *args, **kwargs):
        file_obj = request.data['file']
        if not file_obj:
            return Response({"error": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST)

        # Create a background task
        task_id = str(uuid.uuid4())
        task = ProcessingTask.objects.create(task_id=task_id, status='Pending', user=request.user)
        
        # Read file data to pass to thread (for small/medium files)
        # For truly massive files, we'd save to disk first
        file_data = file_obj.read()
        filename = file_obj.name

        # Start background thread
        thread = threading.Thread(target=background_process, args=(task_id, file_data, filename, request.user.id))
        thread.start()

        return Response({
            "message": "Analysis started in background",
            "task_id": task_id
        }, status=status.HTTP_202_ACCEPTED)
class SARGenerationView(views.APIView):
    def post(self, request, alert_id):
        try:
            print(f"Generating SAR for Alert ID: {alert_id}")
            alert = Alert.objects.get(id=alert_id, user=request.user)
            account = alert.account
            print(f"Account: {account.account_id}")
            
            # Fetch recent transactions for context
            recent_txns = Transaction.objects.filter(account=account).order_by('-date_time')[:10]
            print(f"Transactions found: {len(recent_txns)}")
            evidence = "\n".join([f"- {t.date_time.strftime('%Y-%m-%d')}: {t.type} of {t.amount} involving {t.related_account or 'N/A'}" for t in recent_txns])
            
            # Initialize Generator
            api_key = getattr(settings, 'GROQ_API_KEY', 'your-grok-api-key-here')
            print(f"API Key present: {api_key != 'your-grok-api-key-here'}")
            
            from .rag.utils.sar_generator import SARGenerator
            print("Imported SARGenerator")
            generator = SARGenerator(api_key=api_key)
            print("Initialized Generator")
            
            report = generator.generate_report(
                customer_data={
                    'name': account.name, 
                    'account_id': account.account_id,
                    'case_id': alert.alert_id
                },
                patterns=alert.type.split(', '),
                risk_score=alert.risk_score,
                evidence=evidence
            )
            print("Report generated successfully")
            
            return Response({"report": report})
            
        except Alert.DoesNotExist:
            print(f"Alert {alert_id} not found for user {request.user}")
            return Response({"error": "Alert not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"ERROR in SARGenerationView: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
