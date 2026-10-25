#!/usr/bin/env bash
# Run in AWS CloudShell. Creates real, billable AWS resources.
set -Eeuo pipefail
export AWS_PAGER=''
export AWS_REGION=us-east-1 AWS_DEFAULT_REGION=us-east-1
DOMAIN=floodfinderusa.com
STACK=${STACK:-floodfinder-live}
STATE_DIR=${STATE_DIR:-"$HOME/.flood-finder-launch/$STACK"}
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
mkdir -p "$STATE_DIR"
chmod 700 "$STATE_DIR"
export DOMAIN STACK STATE_DIR
for tool in aws docker python3 curl timeout; do
  command -v "$tool" >/dev/null || { echo "Missing required CloudShell tool: $tool"; exit 1; }
done
trap 'echo "Stopped at line $LINENO. Deployment state and diagnostics: $STATE_DIR. Existing AWS resources are preserved." >&2' ERR

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "Deploying https://$DOMAIN in account $ACCOUNT_ID, region $AWS_REGION, stack $STACK."
echo 'This creates paid EC2, storage, IP address, and backup resources. It does not delete previous stacks.'

# Reuse an existing stack on repeat runs rather than create another server.
if aws cloudformation describe-stacks --stack-name "$STACK" > "$STATE_DIR/stack.json" 2> "$STATE_DIR/describe-error.txt"; then
  STATUS=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["Stacks"][0]["StackStatus"])' "$STATE_DIR/stack.json")
  case "$STATUS" in
    CREATE_COMPLETE|UPDATE_COMPLETE|UPDATE_ROLLBACK_COMPLETE) MODE=existing ;;
    CREATE_IN_PROGRESS) MODE=waiting ;;
    *) echo "Stack $STACK is $STATUS. Inspect its Events and the preserved host; this script will not delete or replace its data."; exit 1 ;;
  esac
  SAVED_DOMAIN=$(python3 -c 'import json,sys;print(next(p["ParameterValue"] for p in json.load(open(sys.argv[1]))["Stacks"][0]["Parameters"] if p["ParameterKey"]=="Domain"))' "$STATE_DIR/stack.json")
  test "$SAVED_DOMAIN" = "$DOMAIN" || { echo 'Existing stack belongs to a different domain; stopping.'; exit 1; }
else
  grep -q 'does not exist' "$STATE_DIR/describe-error.txt" || { cat "$STATE_DIR/describe-error.txt"; exit 1; }
  MODE=new
fi

# Discover a public hosted zone. DNS is updated only if public delegation matches it.
DNS_ZONE=''
if aws route53 list-hosted-zones --output json > "$STATE_DIR/zones.json" 2> "$STATE_DIR/dns-access-error.txt"; then
  DNS_ZONE=$(python3 - "$STATE_DIR/zones.json" <<'PY'
import json,os,sys
zones=[z['Id'] for z in json.load(open(sys.argv[1]))['HostedZones'] if z['Name'].rstrip('.')==os.environ['DOMAIN'] and not z['Config']['PrivateZone']]
print(zones[0] if len(zones)==1 else '')
PY
)
fi
if [ -n "$DNS_ZONE" ]; then
  aws route53 get-hosted-zone --id "$DNS_ZONE" > "$STATE_DIR/zone.json"
  if ! command -v dig >/dev/null; then
    sudo yum install -y bind-utils
  fi
  if command -v dig >/dev/null; then
    dig +short NS "$DOMAIN" > "$STATE_DIR/public-nameservers.txt"
    if ! python3 - "$STATE_DIR" <<'PY'
import json,pathlib,sys
p=pathlib.Path(sys.argv[1]); expected={n.lower().rstrip('.') for n in json.loads((p/'zone.json').read_text())['DelegationSet']['NameServers']}
actual={n.lower().rstrip('.') for n in (p/'public-nameservers.txt').read_text().split()}
sys.exit(0 if expected==actual else 1)
PY
    then DNS_ZONE=''; fi
  else DNS_ZONE=''; fi
fi
if [ -z "$DNS_ZONE" ]; then
  echo "DNS is not confirmed as an authoritative Route 53 zone accessible to this account."
  echo "The script will give you the exact A record after the server starts. Your DNS provider must apply it."
fi

if [ "$MODE" = new ]; then
  CONTACT_EMAIL=${CONTACT_EMAIL:-}
  if [ -z "$CONTACT_EMAIL" ]; then
    CONTACT_EMAIL=$(aws cloudformation describe-stacks --stack-name floodfinder --query 'Stacks[0].Parameters[?ParameterKey==`ContactEmail`].ParameterValue | [0]' --output text 2>/dev/null || true)
    [ "$CONTACT_EMAIL" != None ] || CONTACT_EMAIL=''
  fi
  if [ -z "$CONTACT_EMAIL" ]; then read -r -p 'Your contact email for HTTPS certificates and weather-provider identification: ' CONTACT_EMAIL; fi
  export CONTACT_EMAIL
  python3 - <<'PY'
import os,re,sys
if not re.fullmatch(r'[A-Za-z0-9._+%\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}',os.environ['CONTACT_EMAIL']):
    sys.exit('A valid contact email is required.')
PY
  AZ=$(aws ec2 describe-instance-type-offerings --location-type availability-zone --filters Name=instance-type,Values=t3.small --query 'InstanceTypeOfferings[0].Location' --output text)
  [ "$AZ" != None ] && [ -n "$AZ" ] || { echo 'No available t3.small zone found.'; exit 1; }
  REGISTRY="$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
  if ! aws ecr describe-repositories --repository-names flood-finder > /dev/null 2> "$STATE_DIR/ecr-error.txt"; then
    grep -q RepositoryNotFoundException "$STATE_DIR/ecr-error.txt" || { cat "$STATE_DIR/ecr-error.txt"; exit 1; }
    aws ecr create-repository --repository-name flood-finder --image-tag-mutability IMMUTABLE --image-scanning-configuration scanOnPush=true > "$STATE_DIR/ecr-created.json"
  fi
  docker info >/dev/null
  aws ecr get-login-password | docker login --username AWS --password-stdin "$REGISTRY"
  # A unique tag permits safe retries even if the repository has immutable tags.
  IMAGE_TAG="launch-$(date -u +%Y%m%dT%H%M%S)-$RANDOM"
  docker build --platform linux/amd64 -t "$REGISTRY/flood-finder:$IMAGE_TAG" "$ROOT"
  docker push "$REGISTRY/flood-finder:$IMAGE_TAG"
  DIGEST=$(aws ecr describe-images --repository-name flood-finder --image-ids imageTag="$IMAGE_TAG" --query 'imageDetails[0].imageDigest' --output text)
  export IMAGE_URI="$REGISTRY/flood-finder@$DIGEST" AZ
  python3 - <<'PY'
import json,os,pathlib
params={'Domain':os.environ['DOMAIN'],'ContactEmail':os.environ['CONTACT_EMAIL'],'ImageUri':os.environ['IMAGE_URI'],'AvailabilityZone':os.environ['AZ']}
pathlib.Path(os.environ['STATE_DIR'],'parameters.json').write_text(json.dumps([{'ParameterKey':k,'ParameterValue':v} for k,v in params.items()]))
PY
  aws cloudformation validate-template --template-body "file://$ROOT/deploy/aws/stack.json" > /dev/null
  aws cloudformation create-stack --stack-name "$STACK" --template-body "file://$ROOT/deploy/aws/stack.json" --parameters "file://$STATE_DIR/parameters.json" --capabilities CAPABILITY_IAM --disable-rollback > "$STATE_DIR/create.json"
  MODE=waiting
fi

if [ "$MODE" = waiting ]; then
  echo 'Waiting for EC2, storage, and application startup. This can take 10–20 minutes.'
  if ! aws cloudformation wait stack-create-complete --stack-name "$STACK"; then
    aws cloudformation describe-stack-events --stack-name "$STACK" --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`].[LogicalResourceId,ResourceStatusReason]' --output table
    INSTANCE=$(aws cloudformation describe-stack-resource --stack-name "$STACK" --logical-resource-id Host --query 'StackResourceDetail.PhysicalResourceId' --output text 2>/dev/null || true)
    if [[ "$INSTANCE" == i-* ]]; then
      echo "Preserved instance: $INSTANCE. Attempting to retrieve startup diagnostics."
      if COMMAND_ID=$(aws ssm send-command --instance-ids "$INSTANCE" --document-name AWS-RunShellScript --parameters 'commands=["tail -120 /var/log/flood-finder-bootstrap.log","journalctl -u flood-finder --no-pager -n 60","cd /opt/flood-finder && docker compose logs --tail 60"]' --query 'Command.CommandId' --output text 2> "$STATE_DIR/ssm-error.txt"); then
        aws ssm wait command-executed --command-id "$COMMAND_ID" --instance-id "$INSTANCE" || true
        aws ssm get-command-invocation --command-id "$COMMAND_ID" --instance-id "$INSTANCE" > "$STATE_DIR/startup-diagnostics.json"
        python3 -c 'import json,sys;d=json.load(open(sys.argv[1]));print(d.get("StandardOutputContent",""));print(d.get("StandardErrorContent",""))' "$STATE_DIR/startup-diagnostics.json"
      else
        cat "$STATE_DIR/ssm-error.txt"
        echo 'Use EC2 → instance → Connect → Session Manager to inspect /var/log/flood-finder-bootstrap.log.'
      fi
    fi
    echo 'Startup failed or timed out; no HTTPS success is claimed. Resources remain for diagnosis.'
    exit 1
  fi
fi
aws cloudformation describe-stacks --stack-name "$STACK" > "$STATE_DIR/stack.json"
PUBLIC_IP=$(python3 -c 'import json,sys;print(next(o["OutputValue"] for o in json.load(open(sys.argv[1]))["Stacks"][0]["Outputs"] if o["OutputKey"]=="PublicIp"))' "$STATE_DIR/stack.json")
export PUBLIC_IP
INSTANCE=$(python3 -c 'import json,sys;print(next(o["OutputValue"] for o in json.load(open(sys.argv[1]))["Stacks"][0]["Outputs"] if o["OutputKey"]=="InstanceId"))' "$STATE_DIR/stack.json")

if [ -n "$DNS_ZONE" ]; then
  aws route53 list-resource-record-sets --hosted-zone-id "$DNS_ZONE" > "$STATE_DIR/dns-before.json"
  python3 - <<'PY'
import json,os,pathlib
p=pathlib.Path(os.environ['STATE_DIR']); domain=os.environ['DOMAIN']+'.'
records=json.loads((p/'dns-before.json').read_text())['ResourceRecordSets']
changes=[]
for r in records:
    if r['Name']==domain and r['Type'] in ['A','AAAA','CNAME']:
        if 'SetIdentifier' in r: raise SystemExit('A routed DNS policy exists at this hostname. Update it with your DNS administrator; no DNS changes were made.')
        changes.append({'Action':'DELETE','ResourceRecordSet':r})
changes.append({'Action':'CREATE','ResourceRecordSet':{'Name':domain,'Type':'A','TTL':300,'ResourceRecords':[{'Value':os.environ['PUBLIC_IP']}]}})
(p/'dns-change.json').write_text(json.dumps({'Comment':'Flood Finder EC2 launch','Changes':changes}))
PY
  CHANGE_ID=$(aws route53 change-resource-record-sets --hosted-zone-id "$DNS_ZONE" --change-batch "file://$STATE_DIR/dns-change.json" --query 'ChangeInfo.Id' --output text)
  aws route53 wait resource-record-sets-changed --id "$CHANGE_ID"
  echo "Updated $DOMAIN to $PUBLIC_IP. Previous DNS records saved in $STATE_DIR/dns-before.json."
else
  echo "ACTION REQUIRED at your DNS provider: set the apex/root A record (@) for $DOMAIN to $PUBLIC_IP."
  echo 'Use TTL 300; remove conflicting AAAA records. For Cloudflare, use DNS only initially.'
  read -r -p 'Press Enter after you have applied that DNS change: ' _
fi

echo "Waiting up to 15 minutes for public DNS and valid HTTPS at https://$DOMAIN ..."
READY=false
for attempt in $(seq 1 60); do
  if curl --fail --silent --show-error --connect-timeout 5 --max-time 10 "https://$DOMAIN/api/ready" -o "$STATE_DIR/ready.json" 2> "$STATE_DIR/https-error.txt"; then
    if python3 -c 'import json,sys;sys.exit(0 if json.load(open(sys.argv[1])).get("ok") is True else 1)' "$STATE_DIR/ready.json"; then READY=true; break; fi
  fi
  sleep 5
done
if [ "$READY" != true ]; then
  cat "$STATE_DIR/https-error.txt"
  echo "HTTPS not yet verified. Confirm DNS points to $PUBLIC_IP and inspect proxy logs on $INSTANCE."
  exit 1
fi
curl --fail --silent --show-error --max-time 15 "https://$DOMAIN/" -o "$STATE_DIR/home.html"
grep -q 'id="homeView"' "$STATE_DIR/home.html" || { echo 'Unexpected homepage response.'; exit 1; }
HTTP_CODE=$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 15 "http://$DOMAIN/")
[[ "$HTTP_CODE" =~ ^30[1278]$ ]] || { echo "Expected HTTP→HTTPS redirect, received $HTTP_CODE"; exit 1; }
set +e
timeout 8 curl --fail --silent --show-error --no-buffer --max-time 7 "https://$DOMAIN/api/stream" > "$STATE_DIR/stream.txt" 2> "$STATE_DIR/stream-error.txt"
STREAM_EXIT=$?
set -e
case "$STREAM_EXIT" in 0|28|124) ;; *) cat "$STATE_DIR/stream-error.txt"; exit 1;; esac
grep -q ': connected' "$STATE_DIR/stream.txt" || { echo 'Live stream did not establish a connection.'; exit 1; }
echo "SUCCESS: https://$DOMAIN is serving the app over valid HTTPS. Database readiness, HTTP redirect, and live stream connection passed."
echo "Instance: $INSTANCE. Persistent deployment details: $STATE_DIR/stack.json."
echo 'Next: register your operator account, then promote it through EC2 Session Manager:'
echo 'cd /opt/flood-finder && sudo docker compose exec -T app node scripts/admin.js promote YOUR_REGISTERED_EMAIL'
echo 'Test a report in two browsers and rehearse backup recovery before operational reliance. No user accounts or test incidents were created by this script.'
