import argparse
import json
import sys
from pathlib import Path

import requests


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Update a Backblaze B2 bucket CORS configuration from a JSON file."
    )
    parser.add_argument("--key-id", required=True, help="Backblaze application key ID")
    parser.add_argument(
        "--application-key", required=True, help="Backblaze application key secret"
    )
    parser.add_argument("--bucket-name", required=True, help="Bucket name to update")
    parser.add_argument(
        "--cors-file",
        default="cors-rules.json",
        help="Path to the JSON file containing corsRules",
    )
    parser.add_argument(
        "--insecure",
        action="store_true",
        help="Disable SSL certificate verification for this request flow.",
    )
    return parser.parse_args()


def authorize(key_id: str, application_key: str, verify: bool) -> dict:
    response = requests.get(
        "https://api.backblazeb2.com/b2api/v3/b2_authorize_account",
        auth=(key_id, application_key),
        timeout=30,
        verify=verify,
    )
    response.raise_for_status()
    return response.json()


def get_storage_api_url(auth: dict) -> str:
    if "apiUrl" in auth:
        return auth["apiUrl"]
    return auth["apiInfo"]["storageApi"]["apiUrl"]


def list_bucket(auth: dict, bucket_name: str, verify: bool) -> dict:
    response = requests.post(
        f"{get_storage_api_url(auth)}/b2api/v3/b2_list_buckets",
        headers={"Authorization": auth["authorizationToken"]},
        json={"accountId": auth["accountId"], "bucketName": bucket_name},
        timeout=30,
        verify=verify,
    )
    response.raise_for_status()
    payload = response.json()
    buckets = payload.get("buckets", [])
    if not buckets:
        raise RuntimeError(f"Bucket '{bucket_name}' was not found.")
    return buckets[0]


def update_bucket(auth: dict, bucket: dict, cors_rules: list, verify: bool) -> dict:
    response = requests.post(
        f"{get_storage_api_url(auth)}/b2api/v3/b2_update_bucket",
        headers={"Authorization": auth["authorizationToken"]},
        json={
            "accountId": auth["accountId"],
            "bucketId": bucket["bucketId"],
            "bucketType": bucket["bucketType"],
            "corsRules": cors_rules,
        },
        timeout=30,
        verify=verify,
    )
    response.raise_for_status()
    return response.json()


def main() -> int:
    args = parse_args()
    cors_path = Path(args.cors_file)

    if not cors_path.exists():
        print(f"CORS file not found: {cors_path}", file=sys.stderr)
        return 1

    try:
        cors_rules = json.loads(cors_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"Invalid JSON in {cors_path}: {exc}", file=sys.stderr)
        return 1

    try:
        auth = authorize(args.key_id, args.application_key, verify=not args.insecure)
        bucket = list_bucket(auth, args.bucket_name, verify=not args.insecure)
        result = update_bucket(
            auth, bucket, cors_rules=cors_rules, verify=not args.insecure
        )
    except requests.HTTPError as exc:
        detail = exc.response.text if exc.response is not None else str(exc)
        print(f"Backblaze API request failed: {detail}", file=sys.stderr)
        return 1
    except requests.RequestException as exc:
        print(f"Network request failed: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:  # noqa: BLE001
        print(str(exc), file=sys.stderr)
        return 1

    print("Updated bucket CORS successfully.")
    print(json.dumps(result.get("corsRules", []), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
