import time
import json
import jwt
import requests

KEY_ID = 'SRQZ59GJ9Z'
ISSUER_ID = '3308fe5b-0199-4f43-999d-70be1b71d1de'
P8_PATH = '/Users/epresl/Downloads/AuthKey_SRQZ59GJ9Z.p8'
APP_ID = '6759405794'

with open(P8_PATH) as f:
    private_key = f.read()


def make_token():
    now = int(time.time())
    payload = {
        'iss': ISSUER_ID,
        'iat': now,
        'exp': now + 60 * 15,
        'aud': 'appstoreconnect-v1',
    }
    headers = {'alg': 'ES256', 'kid': KEY_ID, 'typ': 'JWT'}
    return jwt.encode(payload, private_key, algorithm='ES256', headers=headers)


V1 = 'https://api.appstoreconnect.apple.com/v1'


def auth_headers():
    return {
        'Authorization': f'Bearer {make_token()}',
        'Content-Type': 'application/json',
    }


out = []

resp = requests.get(
    f'{V1}/apps/{APP_ID}/builds',
    params={'limit': 30},
    headers=auth_headers(),
)
out.append(f'BUILDS STATUS {resp.status_code}')
data = resp.json()
with open('/tmp/asc_builds_raw.json', 'w') as f:
    json.dump(data, f, indent=2)

for item in data.get('data', []):
    attrs = item.get('attributes', {})
    out.append(
        f"id={item.get('id')} version={attrs.get('version')} "
        f"processingState={attrs.get('processingState')} uploadedDate={attrs.get('uploadedDate')} "
        f"expired={attrs.get('expired')}"
    )

with open('/tmp/asc_builds_check.txt', 'w') as f:
    f.write('\n'.join(out))
print('WROTE')
