import requests
import json
import os

# Read keys from .env
env_vars = {}
with open(".env", "r") as f:
    for line in f:
        if "=" in line and not line.startswith("#"):
            k, v = line.strip().split("=", 1)
            env_vars[k.strip()] = v.strip()

url = "https://kclkgikdygykcvpeokla.supabase.co/rest/v1/users"
service_key = env_vars.get("SUPABASE_SERVICE_ROLE_KEY")

if not service_key:
    print("Error: SUPABASE_SERVICE_ROLE_KEY not found in .env!")
    exit(1)

headers = {
    "apikey": service_key,
    "Authorization": f"Bearer {service_key}"
}

print("Fetching users rows using SERVICE ROLE key (bypassing RLS)...")
r = requests.get(url, headers=headers)
print(f"Status: {r.status_code}")
try:
    data = r.json()
    print(f"Total users in DB: {len(data)}")
    for i, row in enumerate(data):
        print(f"User {i}: id={row['id']}, name={row['name']}, email={row['email']}, role={row['role']}, section_id={row['section_id']}")
except Exception as e:
    print(f"Error or text output: {r.text}")
    print(e)
