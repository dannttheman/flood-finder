# AWS launch foundation

This is a **single-instance** EC2 deployment for the current SQLite application. It creates billable resources only when you deploy the CloudFormation stack. Nothing in this repository automatically deploys or publishes it.

## Architecture

Internet → Elastic IP → Caddy (HTTP redirects to automatic HTTPS) → Node application on the private Docker network → encrypted gp3 EBS data volume. Only ports 80 and 443 are public. Administration uses AWS Systems Manager Session Manager; SSH and port 3000 are not exposed. EC2 requires IMDSv2. The application runs as a non-root user with a read-only container filesystem and dropped capabilities. Caddy replaces forwarded client headers before the app trusts them.

The template creates its own VPC, public subnet, route, EC2 role, EBS storage, Elastic IP, EC2 status alarm, and daily AWS Backup plan with 30-day retention. Data volumes and backup vaults are retained when the stack is deleted. Retained resources keep incurring charges. Daily verified SQLite copies run at 03:00 UTC; volume snapshots run at 05:00 UTC. Snapshot backup selection covers only the data volume, not the disposable operating-system disk.

**Do not run multiple app instances against this database.** SQLite, live event broadcasts, upstream caches, and request throttles are local to one process. This architecture has host/AZ downtime and is not high availability. Horizontal scaling requires a separate PostgreSQL migration plus shared event delivery and rate limiting. Do not put SQLite WAL files on EFS/NFS.

## Before deployment

- AWS account, AWS CLI authentication, Docker, a domain you control, and permission to create CloudFormation/IAM/VPC/EC2/EBS/ECR/Backup resources.
- Use a single account and AWS region for the private ECR image and stack. The default instance is `t3.small` (x86-64, 2 GiB RAM). Pick an AZ in that region.
- Set a real contact email for certificate issuance and National Weather Service identification. No government-data API key is required. No long-lived AWS keys belong in the application or repository; EC2 uses an instance role.
- Review EC2, EBS, Elastic IP, ECR, data transfer, and AWS Backup pricing. Keep a budget alarm in your AWS account.
- The host needs outbound HTTPS to ECR/S3 image layers, Amazon Linux package repositories, GitHub Compose releases, Docker Hub, certificate authorities, and application providers. Runtime providers include `api.weather.gov`, `geocoding.geo.census.gov`, `photon.komoot.io`, `api.zippopotam.us`, and `router.project-osrm.org`; map library assets are served locally and browser map tiles use OpenStreetMap. Public provider usage limits apply. Choose production service arrangements before traffic grows.

## Build and publish an immutable image

Run from the repository root. Choose values for your own account; the example region is not a recommendation.

```sh
export AWS_REGION=us-east-1
export AWS_DEFAULT_REGION="$AWS_REGION"
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export REPOSITORY=flood-finder
# First deployment only; omit this command if the repository already exists.
aws ecr create-repository --repository-name "$REPOSITORY" \
  --image-tag-mutability IMMUTABLE --image-scanning-configuration scanOnPush=true
export REGISTRY="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
aws ecr get-login-password | docker login --username AWS --password-stdin "$REGISTRY"
export IMAGE_TAG=$(git rev-parse HEAD)
docker build --platform linux/amd64 -t "$REGISTRY/$REPOSITORY:$IMAGE_TAG" .
docker push "$REGISTRY/$REPOSITORY:$IMAGE_TAG"
export IMAGE_DIGEST=$(aws ecr describe-images --repository-name "$REPOSITORY" \
  --image-ids imageTag="$IMAGE_TAG" --query 'imageDetails[0].imageDigest' --output text)
export IMAGE_URI="$REGISTRY/$REPOSITORY@$IMAGE_DIGEST"
```

Review ECR image scan findings before deployment. Patch and rebuild base images regularly; the runtime and proxy tags are pinned for repeatability, not automatically updated.

## Create the stack

Set `DOMAIN`, `CONTACT_EMAIL`, and `AVAILABILITY_ZONE` to your chosen values first. Use a stack name that is unique in the region.

```sh
export STACK=flood-finder
aws cloudformation validate-template --template-body file://deploy/aws/stack.json
aws cloudformation deploy --stack-name "$STACK" \
  --template-file deploy/aws/stack.json --capabilities CAPABILITY_IAM \
  --parameter-overrides ImageUri="$IMAGE_URI" Domain="$DOMAIN" \
    ContactEmail="$CONTACT_EMAIL" AvailabilityZone="$AVAILABILITY_ZONE"
aws cloudformation describe-stacks --stack-name "$STACK" \
  --query 'Stacks[0].Outputs'
```

The host signals successful application startup to CloudFormation; failed bootstrap does not silently produce a successful stack. Stack completion proves internal app readiness, **not public HTTPS readiness**. Create the domain's DNS **A record** pointing to the output `PublicIp`. Remove conflicting AAAA records unless you separately configure IPv6. Allow DNS propagation and certificate issuance, then run:

```sh
curl --fail --show-error "https://$DOMAIN/api/ready"
curl --fail --show-error "https://$DOMAIN/" -o /tmp/flood-finder-home.html
```

Check that HTTPS is valid, HTTP redirects, the landing page loads, map assets and location searches work, registration/sign-in succeeds, a test community report persists after a restart, and event updates reconnect. Remove any test report through the normal moderation process. Do not load test public upstream services.

## Operations and updates

Open an SSM session to the `InstanceId` output. The deployment is in `/opt/flood-finder`; persistent data lives under `/srv/flood-finder`. Bootstrap logs: `/var/log/flood-finder-bootstrap.log`. Application/proxy logs: `sudo docker compose --project-directory /opt/flood-finder logs --tail 100` (Docker log rotation is configured). Protect logs and backups as account data; do not publish them.

Register the operator account in the browser, then promote it on the running host:

```sh
cd /opt/flood-finder
sudo docker compose exec -T app node scripts/admin.js promote YOUR_REGISTERED_EMAIL
```

Sign in again. Never seed a shared administrator password.

For an update, publish a new immutable image, open an SSM session, log Docker into ECR again with the instance role, change only `APP_IMAGE` in `/opt/flood-finder/.env` to the new digest URI, and run `sudo docker compose up -d --wait --wait-timeout 180`. Verify `/api/ready`, sign-in, and a report query. Update the stack's `ImageUri` parameter to match for reproducibility. Changing EC2 user data through CloudFormation can stop/start the host, and existing instances do not rerun first-boot scripts; changing the parameter alone does not deploy an image. Future host replacement will use the saved parameter.

To roll back application code, restore the prior digest in `.env` and restart the container. Before any future schema migration, create a verified backup and write an explicit schema rollback plan. Never overwrite a newer database blindly.

## Backups and recovery

Run `sudo /usr/local/bin/flood-finder-backup` and verify a new file under `/srv/flood-finder/backups`. The backup utility uses SQLite's online backup API and `PRAGMA integrity_check`, rather than copying a live database file without its WAL. The daily job retains approximately seven days of local copies; AWS Backup independently retains daily volume recovery points for 30 days. Inspect job success in AWS Backup after the first scheduled run. A failed daily copy is logged in `/var/log/flood-finder-backup.log` and needs investigation.

For file recovery: stop the app, preserve the current database and its `-wal`/`-shm` companions together, replace the database with a verified backup, remove stale WAL/SHM files only after preserving them, set ownership to UID/GID 1000, and restart. Verify accounts and report counts before reopening public access. Never restore while the app is writing.

For host or stack loss: restore the retained EBS volume or a recovery point to a new encrypted volume **in the chosen AZ**. Stop/detach any previous writer. Deploy a new stack using `ExistingDataVolumeId=vol-...`; bootstrap mounts that volume without formatting an existing filesystem. It creates fresh app configuration and TLS storage remains on the volume. Point DNS at the new stack's Elastic IP. Verify database integrity, accounts, reports, and HTTPS. Restored snapshots are crash-consistent; the verified SQLite copies are an additional recovery option. Recovery must be rehearsed in your AWS account before launch; no AWS restore has been performed by the code checks.

Do not change AZ, replace an in-use volume, or run two stacks on one data volume. Plan downtime for host replacement. Record the volume ID and backup vault outside the stack. Deleting a stack does not remove retained data or backups.

## Public launch checklist

- Set operator identity, privacy contact, data retention/deletion process, and service terms. The privacy page accurately describes current behavior but does not invent an operator contact.
- Decide whether the current lack of self-service password recovery, email verification, and account deletion meets your launch requirements. Those account features are not implemented by this deployment foundation.
- Test backup restore, registration, roles, source labeling, provider outage states, report moderation, and mobile/keyboard flows in staging.
- Subscribe an SNS destination to the EC2 alarm, add external HTTPS availability monitoring, and route backup failure notifications to your operations channel. The template's EC2 alarm has no notification destination until you configure one.
- Restrict AWS administrator access, configure MFA and budget alerts, review logs and storage access, and patch the host and images.
- Public map/geocoder/routing endpoints are not service guarantees. Confirm usage policies and production capacity. Public launch requires an operator to own moderation and support.

## Maintain and validate the template

`stack.json` embeds `compose.yaml` and `Caddyfile` so a host needs no Git credentials. After editing either file or bootstrap configuration, run `python deploy/aws/generate-stack.py` and commit the regenerated template. Validate with `cfn-lint deploy/aws/stack.json` (CI uses 1.58.0). Local checks do not provision AWS resources, issue a real certificate, test IAM permissions, or prove DNS/SSM/backup operations in your account.

## Guided CloudShell launch for floodfinderusa.com

Run `bash deploy/aws/launch.sh` from a current checkout in AWS CloudShell. This creates billable resources in `us-east-1` under stack `floodfinder-live`, builds and publishes the current source, chooses an available `t3.small` zone, and preserves a failed instance for diagnostics. It reuses an existing completed stack on repeat runs; it does not deploy code updates to that existing stack. Old failed stacks and their retained volumes/vaults are not deleted. The new stack uses a fresh database; it does not migrate prior accounts or reports.

The script reuses the contact email from the earlier `floodfinder` stack or prompts for one. It updates the root domain's A record only when exactly one matching public Route 53 zone is accessible and its nameservers match public delegation. Existing apex A/AAAA/CNAME records are saved locally before replacement; unrelated records are preserved. Routed DNS policies require administrator handling. External DNS requires the displayed manual record change.

It checks public database readiness over valid HTTPS, the homepage, HTTP redirect, and an SSE connection before printing success. Those checks do not establish all incident workflows or backups have passed; test a report across browsers and rehearse recovery before operational reliance. On startup failure it attempts to collect SSM diagnostics and stops with resources preserved. Rerunning does not automatically repair a failed stack. State and previous DNS records are under `$HOME/.flood-finder-launch/floodfinder-live` in CloudShell; keep a separate copy for recovery.

Run the mocked orchestration checks with `python deploy/aws/test_launch.py`; they create no AWS resources. A real AWS account deployment remains required to validate bootstrap, IAM, DNS, and certificates.
