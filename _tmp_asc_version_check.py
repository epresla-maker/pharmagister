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

# List app store versions (all platforms/states)
resp = requests.get(
    f'{V1}/apps/{APP_ID}/appStoreVersions',
    params={'limit': 20, 'include': 'build,appStoreVersionSubmission'},
    headers=auth_headers(),
)
out.append(f'VERSIONS STATUS {resp.status_code}')
data = resp.json()
with open('/tmp/asc_versions_raw.json', 'w') as f:
    json.dump(data, f, indent=2)

for item in data.get('data', []):
    attrs = item.get('attributes', {})
    rels = item.get('relationships', {})
    build_rel = rels.get('build', {}).get('data')
    submission_rel = rels.get('appStoreVersionSubmission', {}).get('data')
    out.append(
        f"id={item.get('id')} versionString={attrs.get('versionString')} "
        f"appStoreState={attrs.get('appStoreState')} platform={attrs.get('platform')} "
        f"build={build_rel} submission={submission_rel}"
    )

# Check current in-app purchases attached to first version found (if any)
if data.get('data'):
    first_version_id = data['data'][0]['id']
    resp2 = requests.get(
        f'{V1}/appStoreVersions/{first_version_id}/relationships/inAppPurchases',
        headers=auth_headers(),
    )
    out.append(f'IAP RELATIONSHIP for version {first_version_id} STATUS {resp2.status_code}')
    out.append(json.dumps(resp2.json(), indent=2))

with open('/tmp/asc_version_check.txt', 'w') as f:
    f.write('\n'.join(out))
print('WROTE')
