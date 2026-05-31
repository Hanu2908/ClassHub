import requests
import json

url = "https://kclkgikdygykcvpeokla.supabase.co/rest/v1/users"
headers = {
    "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjbGtnaWtkeWd5a2N2cGVva2xhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NTUxNTUsImV4cCI6MjA5NDMzMTE1NX0.dwoby1h15a0MQZ6HGWC2T9AQHzRGXdyeDGV6OS430bc",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjbGtnaWtkeWd5a2N2cGVva2xhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NTUxNTUsImV4cCI6MjA5NDMzMTE1NX0.dwoby1h15a0MQZ6HGWC2T9AQHzRGXdyeDGV6OS430bc"
}

print("Fetching users rows...")
r = requests.get(url, headers=headers)
print(f"Status: {r.status_code}")
try:
    data = r.json()
    print(f"Total users found: {len(data)}")
    for i, row in enumerate(data):
        print(f"User {i}: id={row['id']}, name={row['name']}, email={row['email']}, role={row['role']}")
except Exception as e:
    print(f"Error or text output: {r.text}")
    print(e)
