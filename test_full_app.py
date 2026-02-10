
import requests
import time
import os
import json

BASE_URL = "http://localhost:8000/api"
TEST_USER = "test_auditor_" + str(int(time.time()))
TEST_PASS = "TestPass123!"
TEST_EMAIL = f"{TEST_USER}@example.com"

def log(msg, type="INFO"):
    print(f"[{type}] {msg}")

def test_authentication():
    log("Testing Authentication...", "SECTION")
    
    # 1. Signup
    try:
        res = requests.post(f"{BASE_URL}/signup/", json={
            "username": TEST_USER,
            "password": TEST_PASS,
            "email": TEST_EMAIL
        })
        if res.status_code == 201:
            log("Signup Successful", "SUCCESS")
        else:
            log(f"Signup Failed: {res.text}", "ERROR")
            return None
    except Exception as e:
        log(f"Connection Failed: {e}", "CRITICAL")
        return None

    # 2. Login
    try:
        res = requests.post(f"{BASE_URL}/login/", json={
            "username": TEST_USER,
            "password": TEST_PASS
        })
        if res.status_code == 200:
            token = res.json()['access']
            log("Login Successful", "SUCCESS")
            return token
        else:
            log(f"Login Failed: {res.text}", "ERROR")
            return None
    except Exception as e:
        log(f"Login Exception: {e}", "ERROR")
        return None

def test_dashboard_flow(token):
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Stats
    log("Testing Dashboard Stats...", "SECTION")
    res = requests.get(f"{BASE_URL}/alerts/stats/", headers=headers)
    if res.status_code == 200:
        data = res.json()
        if "critical_alerts" in data and "trend" in data:
            log("Stats API Healthy", "SUCCESS")
        else:
            log(f"Stats Response Structure Invalid: {data.keys()}", "WARNING")
    else:
        log(f"Stats Failed: {res.status_code}", "ERROR")

    # 2. Alerts List (Initial - likely empty for new user)
    log("Testing Alerts List...", "SECTION")
    res = requests.get(f"{BASE_URL}/alerts/", headers=headers)
    if res.status_code == 200:
        log(f"Alerts Fetched: Found {len(res.json())}", "SUCCESS")
    else:
        log(f"Alerts Fetch Failed: {res.status_code}", "ERROR")

def test_file_upload_and_processing(token):
    log("Testing File Upload & Analysis Pipeline...", "SECTION")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Create a dummy CSV
    csv_content = """account_id,date,time,type,amount,related_account
ACC-001,2024-01-01,10:00:00,Deposit,50000,DIRECT-DEPOSIT
ACC-001,2024-01-02,11:00:00,Withdrawal,48000,CASH-WITHDRAWAL
ACC-002,2024-01-01,09:00:00,Transfer,1200000,ACC-999
"""
    files = {'file': ('test_txn.csv', csv_content, 'text/csv')}
    
    try:
        res = requests.post(f"{BASE_URL}/upload/", headers=headers, files=files)
        if res.status_code == 202:
            task_id = res.json().get('task_id')
            log(f"Upload Successful. Task ID: {task_id}", "SUCCESS")
            
            # Poll status
            log("Polling Task Status...", "INFO")
            for _ in range(10):
                status_res = requests.get(f"{BASE_URL}/task-status/{task_id}/", headers=headers)
                status_data = status_res.json()
                status = status_data.get('status')
                log(f"Task Status: {status} ({status_data.get('progress')}%)", "DEBUG")
                
                if status == 'Completed':
                    log("Analysis Processing Completed", "SUCCESS")
                    return True
                if status == 'Failed':
                    log(f"Analysis Failed: {status_data.get('error')}", "ERROR")
                    return False
                time.sleep(1)
            log("Analysis Timed Out", "ERROR")
            return False
        else:
            log(f"Upload Failed: {res.status_code} - {res.text}", "ERROR")
            return False
    except Exception as e:
        log(f"Upload Exception: {e}", "ERROR")
        return False

def test_deep_analysis_and_sar(token):
    log("Testing Deep Analysis & SAR...", "SECTION")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get Alerts (Should exist now after processing)
    alerts = requests.get(f"{BASE_URL}/alerts/", headers=headers).json()
    if not alerts:
        log("No alerts generated from analysis. Cannot test Deep Analysis.", "WARNING")
        return

    target_alert = alerts[0]
    alert_id = target_alert['id']
    account_id = target_alert['accountId']
    log(f"Targeting Alert ID: {alert_id} for Account: {account_id}", "INFO")

    # 1. Account Details
    res = requests.get(f"{BASE_URL}/accounts/{account_id}/", headers=headers)
    if res.status_code == 200:
        log("Account Details Loaded", "SUCCESS")
    else:
        log(f"Account Details Failed: {res.status_code}", "ERROR")

    # 2. Transactions
    res = requests.get(f"{BASE_URL}/accounts/{account_id}/transactions/", headers=headers)
    if res.status_code == 200:
        txns = res.json()
        log(f"Transactions Fetched: {len(txns)}", "SUCCESS")
        # Validate data for frontend graph
        if len(txns) > 0 and 'type' in txns[0] and 'amount' in txns[0]:
            log("Transaction Data Structure Valid", "SUCCESS")
        else:
            log("Transaction Data Structure Invalid/Empty", "WARNING")
    else:
        log(f"Transactions Fetch Failed: {res.status_code}", "ERROR")

    # 3. SAR Generation
    # Note: This might fail if LLM API key issues, but checking endpoint reachability
    log("Testing SAR Generation (may take time)...", "INFO")
    try:
        res = requests.post(f"{BASE_URL}/generate-sar/{alert_id}/", headers=headers, timeout=30)
        if res.status_code == 200:
            sar = res.json().get('report')
            if sar and len(sar) > 50:
                log("SAR Generation Successful", "SUCCESS")
            else:
                log("SAR Response Empty", "WARNING")
        else:
            log(f"SAR Generation Failed: {res.status_code} - {res.text}", "ERROR")
    except requests.exceptions.Timeout:
        log("SAR Generation Timed Out (Expected for slow LLMs)", "WARNING")
    except Exception as e:
        log(f"SAR Exception: {e}", "ERROR")

if __name__ == "__main__":
    print("=== STARTING FULL SYSTEM TEST ===")
    token = test_authentication()
    if token:
        test_dashboard_flow(token)
        if test_file_upload_and_processing(token):
            test_deep_analysis_and_sar(token)
    print("=== TEST COMPLETE ===")
