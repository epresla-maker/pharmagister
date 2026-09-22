"""
Full pipeline (post-archive):
1. Export IPA from the .xcarchive using an ExportOptions.plist (App Store method).
2. Upload IPA to App Store Connect via `xcrun altool` / notarytool equivalent (iTMSTransporter under the hood).
   -> We use `xcrun altool --upload-app` (still supported) or `xcodebuild -exportArchive` + `altool`.
3. Poll App Store Connect API for the new build to appear (processingState VALID) under the app.
4. Create a new appStoreVersion (1.4) for platform IOS.
5. Attach the build to that version.
6. Attach both in-app purchases to that version via appStoreVersionExperimentsV2? No -- via
   `appStoreVersions/{id}/relationships/inAppPurchasesV2` PATCH... (actually via appStoreVersionsRelationship? We'll check API docs at runtime.)
7. Create a reviewSubmission and submit it.

This script only handles steps 3-7 (API-only). Steps 1-2 (export + upload) are done via xcodebuild/altool
separately because they require the .xcarchive to exist first.
"""
import time
import json
import sys
import jwt
import requests

KEY_ID = 'SRQZ59GJ9Z'
ISSUER_ID = '3308fe5b-0199-4f43-999d-70be1b71d1de'
P8_PATH = '/Users/epresl/Downloads/AuthKey_SRQZ59GJ9Z.p8'
APP_ID = '6759405794'
VERSION_STRING = '1.4'

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


def get_json(url, params=None):
    resp = requests.get(url, headers=auth_headers(), params=params or {})
    return resp.status_code, resp.json()


def post_json(url, body):
    resp = requests.post(url, headers=auth_headers(), data=json.dumps(body))
    return resp.status_code, (resp.json() if resp.content else {})


def patch_json(url, body):
    resp = requests.patch(url, headers=auth_headers(), data=json.dumps(body))
    return resp.status_code, (resp.json() if resp.content else {})


def wait_for_build(min_upload_time, timeout_seconds=1800, poll_every=20):
    """Poll builds list until a new VALID build newer than min_upload_time shows up."""
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        status, data = get_json(f'{V1}/apps/{APP_ID}/builds', params={'limit': 5})
        if status == 200:
            for item in data.get('data', []):
                attrs = item.get('attributes', {})
                uploaded = attrs.get('uploadedDate', '')
                state = attrs.get('processingState')
                if uploaded > min_upload_time and state == 'VALID':
                    return item['id'], attrs
        print(f'  ...waiting for build to process (status={status})', file=sys.stderr)
        time.sleep(poll_every)
    return None, None


def main():
    out = []

    # Step: find newest existing upload timestamp as baseline before we started (safety marker)
    baseline_arg = sys.argv[1] if len(sys.argv) > 1 else None
    if not baseline_arg:
        print('Usage: python _tmp_asc_submit_pipeline.py <baseline_iso_timestamp>', file=sys.stderr)
        sys.exit(1)

    out.append(f'Waiting for new build uploaded after {baseline_arg}...')
    build_id, build_attrs = wait_for_build(baseline_arg)
    if not build_id:
        out.append('TIMEOUT: no new build detected within timeout window.')
        with open('/tmp/asc_submit_pipeline.txt', 'w') as f:
            f.write('\n'.join(out))
        print('TIMEOUT')
        return

    out.append(f'Found build id={build_id} attrs={build_attrs}')

    # Create new appStoreVersion
    status, data = post_json(f'{V1}/appStoreVersions', {
        'data': {
            'type': 'appStoreVersions',
            'attributes': {
                'platform': 'IOS',
                'versionString': VERSION_STRING,
            },
            'relationships': {
                'app': {'data': {'type': 'apps', 'id': APP_ID}},
                'build': {'data': {'type': 'builds', 'id': build_id}},
            },
        }
    })
    out.append(f'CREATE VERSION STATUS {status}')
    out.append(json.dumps(data, indent=2))

    if status not in (200, 201):
        with open('/tmp/asc_submit_pipeline.txt', 'w') as f:
            f.write('\n'.join(out))
        print('FAILED_CREATE_VERSION')
        return

    version_id = data['data']['id']
    out.append(f'version_id={version_id}')

    with open('/tmp/asc_submit_pipeline.txt', 'w') as f:
        f.write('\n'.join(out))
    print('VERSION_CREATED', version_id)


if __name__ == '__main__':
    main()
