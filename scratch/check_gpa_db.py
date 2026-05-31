import requests
import json

url = "https://kclkgikdygykcvpeokla.supabase.co/rest/v1/user_gpa_data"
headers = {
    "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjbGtnaWtkeWd5a2N2cGVva2xhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NTUxNTUsImV4cCI6MjA5NDMzMTE1NX0.dwoby1h15a0MQZ6HGWC2T9AQHzRGXdyeDGV6OS430bc",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjbGtnaWtkeWd5a2N2cGVva2xhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NTUxNTUsImV4cCI6MjA5NDMzMTE1NX0.dwoby1h15a0MQZ6HGWC2T9AQHzRGXdyeDGV6OS430bc"
}

print("Fetching user_gpa_data rows...")
r = requests.get(url, headers=headers)
print(f"Status: {r.status_code}")
try:
    data = r.json()
    print(f"Total rows found: {len(data)}")
    for i, row in enumerate(data):
        print(f"Row {i}: user_id={row['user_id']}, updated_at={row['updated_at']}")
        print(f"State keys: {list(row['gpa_state'].keys()) if row['gpa_state'] else 'None'}")
except Exception as e:
    print(f"Error or text output: {r.text}")
    print(e)
