from django.db import models
from django.contrib.auth.models import User

class Account(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='accounts', null=True, blank=True)
    account_id = models.CharField(max_length=20)
    name = models.CharField(max_length=100)
    type = models.CharField(max_length=50)
    open_date = models.DateField()
    avg_balance = models.CharField(max_length=50)
    total_transactions = models.IntegerField()
    flagged_transactions = models.IntegerField()
    risk_history = models.JSONField(default=list)
    counterparties = models.JSONField(default=list)

    def __str__(self):
        return f"{self.name} ({self.account_id})"

    class Meta:
        unique_together = ('user', 'account_id')

class Alert(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='alerts', null=True, blank=True)
    alert_id = models.CharField(max_length=20)
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name='alerts')
    risk_score = models.IntegerField()
    type = models.CharField(max_length=100)
    date = models.DateField()
    time = models.TimeField()
    status = models.CharField(max_length=50)
    amount = models.CharField(max_length=50)
    transactions_count = models.IntegerField()
    priority = models.CharField(max_length=20)

    def __str__(self):
        return self.alert_id

    class Meta:
        unique_together = ('user', 'alert_id')

class Transaction(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='transactions', null=True, blank=True)
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name='recent_activity')
    date_time = models.DateTimeField()
    type = models.CharField(max_length=50)
    amount = models.CharField(max_length=50)
    related_account = models.CharField(max_length=20, blank=True, null=True) # from/to
    flag = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.type} - {self.amount}"

class ProcessingTask(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='tasks', null=True, blank=True)
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Processing', 'Processing'),
        ('Completed', 'Completed'),
        ('Failed', 'Failed'),
    ]
    task_id = models.CharField(max_length=50, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    progress = models.IntegerField(default=0)
    total_records = models.IntegerField(default=0)
    processed_records = models.IntegerField(default=0)
    error_message = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class OTPVerification(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='otp_verification')
    code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)

    def is_expired(self):
        from django.utils import timezone
        from datetime import timedelta
        return timezone.now() > self.created_at + timedelta(minutes=10)

    def __str__(self):
        return f"OTP for {self.user.username}"

    def __str__(self):
        return f"{self.task_id} - {self.status}"
