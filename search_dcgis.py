import urllib.request
import json
import sys

base_url = "https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA?f=json"
req = urllib.request.Request(base_url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        services = [s['name'] for s in data.get('services', []) if s['type'] == 'MapServer']
except Exception as e:
    print(e)
    sys.exit(1)

for s in services:
    url = f"https://maps2.dcgis.dc.gov/dcgis/rest/services/{s}/MapServer?f=json"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            sdata = json.loads(response.read().decode())
            for l in sdata.get('layers', []):
                if 'flood' in l['name'].lower():
                    print(f"FOUND in {s}: Layer {l['id']} - {l['name']}")
    except Exception as e:
        pass
