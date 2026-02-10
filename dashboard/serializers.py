from rest_framework import serializers
from .models import Account, Alert, Transaction

class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = '__all__'

class AlertSerializer(serializers.ModelSerializer):
    account_name = serializers.CharField(source='account.name', read_only=True)
    account_id_display = serializers.CharField(source='account.account_id', read_only=True)
    trend = serializers.SerializerMethodField()

    class Meta:
        model = Alert
        fields = '__all__'
        extra_fields = ['account_name', 'account_id_display', 'trend']

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        representation['accountName'] = instance.account.name
        representation['accountId'] = instance.account.account_id
        return representation

    def get_trend(self, obj):
        from django.utils import timezone
        from datetime import timedelta
        
        try:
            # Get last 7 days
            end_date = timezone.now().date()
            start_date = end_date - timedelta(days=6)
            
            daily_vol = []
            
            # Get all transactions for this account in range
            txns = Transaction.objects.filter(
                account=obj.account, 
                date_time__date__gte=start_date
            )
            
            for i in range(7):
                d = start_date + timedelta(days=i)
                day_txns = [t for t in txns if t.date_time and t.date_time.date() == d]
                vol = 0.0
                for t in day_txns:
                    try:
                        clean_amt = float(str(t.amount).replace('₹','').replace(',','').replace('$',''))
                        vol += clean_amt
                    except:
                        pass
                daily_vol.append(vol)
                 
            return daily_vol
        except Exception as e:
            print(f"Error calculating trend: {e}")
            return [0] * 7

class AccountSerializer(serializers.ModelSerializer):
    alerts = AlertSerializer(many=True, read_only=True)
    recent_activity = TransactionSerializer(many=True, read_only=True)

    class Meta:
        model = Account
        fields = '__all__'
