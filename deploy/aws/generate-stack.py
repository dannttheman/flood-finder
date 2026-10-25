import json,base64
from pathlib import Path
import os
os.chdir(Path(__file__).resolve().parents[2])
b64=lambda p:base64.b64encode(Path(p).read_bytes()).decode()
script='''#!/bin/bash
set -euo pipefail
exec > >(tee /var/log/flood-finder-bootstrap.log | logger -t flood-finder) 2>&1
signal_result() { aws cloudformation signal-resource --stack-name '${AWS::StackName}' --logical-resource-id Host --unique-id host --status "$1" --region '${AWS::Region}'; }
trap 'signal_result FAILURE' ERR
dnf install -y docker awscli2 cronie
systemctl enable --now docker crond
mkdir -p /usr/local/lib/docker/cli-plugins /opt/flood-finder
curl -fsSL https://github.com/docker/compose/releases/download/v2.40.3/docker-compose-linux-x86_64 -o /tmp/docker-compose-linux-x86_64
curl -fsSL https://github.com/docker/compose/releases/download/v2.40.3/checksums.txt -o /tmp/compose-checksums.txt
(cd /tmp && grep ' [*]docker-compose-linux-x86_64$' compose-checksums.txt | sha256sum -c -)
install -m 0755 /tmp/docker-compose-linux-x86_64 /usr/local/lib/docker/cli-plugins/docker-compose
VOLUME_ID='${DataId}'
DEVICE=/dev/disk/by-id/nvme-Amazon_Elastic_Block_Store_$(echo "$VOLUME_ID" | tr -d '-')
for attempt in $(seq 1 120); do
  if [ -b "$DEVICE" ]; then break; fi
  if [ -b /dev/xvdf ]; then DEVICE=/dev/xvdf; break; fi
  sleep 2
done
test -b "$DEVICE"
if ! blkid "$DEVICE"; then mkfs.ext4 "$DEVICE"; fi
mkdir -p /srv/flood-finder
UUID=$(blkid -s UUID -o value "$DEVICE")
echo "UUID=$UUID /srv/flood-finder ext4 defaults 0 2" >> /etc/fstab
mount /srv/flood-finder
mkdir -p /srv/flood-finder/data /srv/flood-finder/backups
chown 1000:1000 /srv/flood-finder/data /srv/flood-finder/backups
chmod 700 /srv/flood-finder/data /srv/flood-finder/backups
COMPOSE_B64
CADDY_B64
cat > /opt/flood-finder/.env <<'ENV'
APP_IMAGE=${ImageUri}
DOMAIN=${Domain}
ACME_EMAIL=${ContactEmail}
NWS_USER_AGENT=FloodFinder/3.0 (${ContactEmail})
ENV
chmod 600 /opt/flood-finder/.env
aws ecr get-login-password --region '${AWS::Region}' | docker login --username AWS --password-stdin '${Registry}'
cat > /etc/systemd/system/flood-finder.service <<'UNIT'
[Unit]
Description=Flood Finder application and TLS proxy
Requires=docker.service
After=docker.service network-online.target
RequiresMountsFor=/srv/flood-finder
[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/flood-finder
ExecStart=/usr/bin/docker compose up -d --wait --wait-timeout 180
ExecStop=/usr/bin/docker compose stop
TimeoutStartSec=240
TimeoutStopSec=60
[Install]
WantedBy=multi-user.target
UNIT
cat > /usr/local/bin/flood-finder-backup <<'BACKUP'
#!/bin/bash
set -euo pipefail
cd /opt/flood-finder
stamp=$(date -u +%Y%m%dT%H%M%SZ)
docker compose exec -T app node scripts/backup.js "/app/data/backup-$stamp.sqlite"
mv "/srv/flood-finder/data/backup-$stamp.sqlite" /srv/flood-finder/backups/
find /srv/flood-finder/backups -name 'backup-*.sqlite' -mtime +7 -delete
BACKUP
chmod 700 /usr/local/bin/flood-finder-backup
cat > /etc/cron.d/flood-finder-backup <<'CRON'
0 3 * * * root /usr/local/bin/flood-finder-backup >> /var/log/flood-finder-backup.log 2>&1
CRON
systemctl daemon-reload
systemctl enable --now flood-finder
cd /opt/flood-finder
docker compose exec -T app node -e "fetch('http://127.0.0.1:3000/api/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
signal_result SUCCESS
'''.replace('COMPOSE_B64',f"echo '{b64('deploy/aws/compose.yaml')}' | base64 -d > /opt/flood-finder/compose.yaml").replace('CADDY_B64',f"echo '{b64('deploy/aws/Caddyfile')}' | base64 -d > /opt/flood-finder/Caddyfile")
ref=lambda x:{'Ref':x}
get=lambda a,b:{'Fn::GetAtt':[a,b]}
sub=lambda s:{'Fn::Sub':s}
resources={
'Network':{'Type':'AWS::EC2::VPC','Properties':{'CidrBlock':'10.42.0.0/16','EnableDnsSupport':True,'EnableDnsHostnames':True}},
'Gateway':{'Type':'AWS::EC2::InternetGateway'},
'GatewayAttachment':{'Type':'AWS::EC2::VPCGatewayAttachment','Properties':{'VpcId':ref('Network'),'InternetGatewayId':ref('Gateway')}},
'Subnet':{'Type':'AWS::EC2::Subnet','Properties':{'VpcId':ref('Network'),'CidrBlock':'10.42.1.0/24','AvailabilityZone':ref('AvailabilityZone'),'MapPublicIpOnLaunch':True}},
'RouteTable':{'Type':'AWS::EC2::RouteTable','Properties':{'VpcId':ref('Network')}},
'InternetRoute':{'Type':'AWS::EC2::Route','DependsOn':'GatewayAttachment','Properties':{'RouteTableId':ref('RouteTable'),'DestinationCidrBlock':'0.0.0.0/0','GatewayId':ref('Gateway')}},
'Routes':{'Type':'AWS::EC2::SubnetRouteTableAssociation','Properties':{'SubnetId':ref('Subnet'),'RouteTableId':ref('RouteTable')}},
'Firewall':{'Type':'AWS::EC2::SecurityGroup','Properties':{'GroupDescription':'Public HTTPS and certificate issuance only; administration through SSM','VpcId':ref('Network'),'SecurityGroupIngress':[{'IpProtocol':'tcp','FromPort':p,'ToPort':p,'CidrIp':'0.0.0.0/0'} for p in [80,443]]}},
'HostRole':{'Type':'AWS::IAM::Role','Properties':{'AssumeRolePolicyDocument':{'Version':'2012-10-17','Statement':[{'Effect':'Allow','Principal':{'Service':'ec2.amazonaws.com'},'Action':'sts:AssumeRole'}]},'ManagedPolicyArns':[sub('arn:${AWS::Partition}:iam::aws:policy/AmazonSSMManagedInstanceCore'),sub('arn:${AWS::Partition}:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly')],'Policies':[{'PolicyName':'SignalBootstrap','PolicyDocument':{'Version':'2012-10-17','Statement':[{'Effect':'Allow','Action':'cloudformation:SignalResource','Resource':ref('AWS::StackId')}]}}]}},
'HostProfile':{'Type':'AWS::IAM::InstanceProfile','Properties':{'Roles':[ref('HostRole')]}},
'Data':{'Type':'AWS::EC2::Volume','Condition':'CreateData','DeletionPolicy':'Retain','UpdateReplacePolicy':'Retain','Properties':{'AvailabilityZone':ref('AvailabilityZone'),'Encrypted':True,'Size':20,'VolumeType':'gp3','Tags':[{'Key':'Name','Value':sub('${AWS::StackName}-data')}]}},
'Host':{'Type':'AWS::EC2::Instance','DependsOn':['InternetRoute','Routes'],'CreationPolicy':{'ResourceSignal':{'Count':1,'Timeout':'PT20M'}},'Properties':{'ImageId':ref('Ami'),'InstanceType':ref('InstanceType'),'SubnetId':ref('Subnet'),'SecurityGroupIds':[ref('Firewall')],'IamInstanceProfile':ref('HostProfile'),'Volumes':[{'Device':'/dev/sdf','VolumeId':{'Fn::If':['CreateData',ref('Data'),ref('ExistingDataVolumeId')]}}],'MetadataOptions':{'HttpTokens':'required','HttpPutResponseHopLimit':1},'BlockDeviceMappings':[{'DeviceName':'/dev/xvda','Ebs':{'VolumeSize':16,'VolumeType':'gp3','Encrypted':True}}],'Tags':[{'Key':'Name','Value':sub('${AWS::StackName}-app')}],'UserData':{'Fn::Base64':{'Fn::Sub':[script,{'DataId':{'Fn::If':['CreateData',ref('Data'),ref('ExistingDataVolumeId')]},'Registry':{'Fn::Select':[0,{'Fn::Split':['/',ref('ImageUri')]}]}}]}}}},

'Address':{'Type':'AWS::EC2::EIP','DependsOn':'GatewayAttachment','Properties':{'Domain':'vpc'}},
'AddressAttachment':{'Type':'AWS::EC2::EIPAssociation','Properties':{'AllocationId':get('Address','AllocationId'),'InstanceId':ref('Host')}},
'BackupRole':{'Type':'AWS::IAM::Role','Properties':{'AssumeRolePolicyDocument':{'Version':'2012-10-17','Statement':[{'Effect':'Allow','Principal':{'Service':'backup.amazonaws.com'},'Action':'sts:AssumeRole'}]},'ManagedPolicyArns':[sub('arn:${AWS::Partition}:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup')]}},
'BackupVault':{'Type':'AWS::Backup::BackupVault','DeletionPolicy':'Retain','UpdateReplacePolicy':'Retain','Properties':{'BackupVaultName':sub('${AWS::StackName}-data')}},
'BackupPlan':{'Type':'AWS::Backup::BackupPlan','Properties':{'BackupPlan':{'BackupPlanName':sub('${AWS::StackName}-daily'),'BackupPlanRule':[{'RuleName':'Daily','TargetBackupVault':ref('BackupVault'),'ScheduleExpression':'cron(0 5 * * ? *)','StartWindowMinutes':60,'CompletionWindowMinutes':180,'Lifecycle':{'DeleteAfterDays':30}}]}}},
'BackupSelection':{'Type':'AWS::Backup::BackupSelection','Properties':{'BackupPlanId':ref('BackupPlan'),'BackupSelection':{'SelectionName':'SQLiteData','IamRoleArn':get('BackupRole','Arn'),'Resources':[{'Fn::Sub':['arn:${AWS::Partition}:ec2:${AWS::Region}:${AWS::AccountId}:volume/${Volume}',{'Volume':{'Fn::If':['CreateData',ref('Data'),ref('ExistingDataVolumeId')]}}]}]}}},
'HostStatusAlarm':{'Type':'AWS::CloudWatch::Alarm','Properties':{'AlarmDescription':'Host failure; configure SNS notifications before launch','Namespace':'AWS/EC2','MetricName':'StatusCheckFailed','Dimensions':[{'Name':'InstanceId','Value':ref('Host')}],'Statistic':'Maximum','Period':60,'EvaluationPeriods':2,'Threshold':0,'ComparisonOperator':'GreaterThanThreshold','TreatMissingData':'breaching'}}
}
stack={'AWSTemplateFormatVersion':'2010-09-09','Description':'Flood Finder single-instance launch foundation: encrypted persistent SQLite, TLS proxy, daily retained backups, SSM administration. Not a multi-instance architecture.','Parameters':{'AvailabilityZone':{'Type':'AWS::EC2::AvailabilityZone::Name'},'Domain':{'Type':'String','AllowedPattern':'[a-z0-9]+([.-][a-z0-9]+)*\\.[a-z]{2,}'},'ContactEmail':{'Type':'String','AllowedPattern':'[A-Za-z0-9._+%-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}'},'ImageUri':{'Type':'String','AllowedPattern':'[0-9]{12}\\.dkr\\.ecr\\.[a-z0-9-]+\\.amazonaws\\.com/[a-z0-9/_.-]+@sha256:[a-f0-9]{64}','Description':'Private ECR immutable digest URI in this account and region'},'InstanceType':{'Type':'String','Default':'t3.small','AllowedValues':['t3.small','t3.medium']},'ExistingDataVolumeId':{'Type':'String','Default':'','AllowedPattern':'(vol-[a-f0-9]+)?','Description':'Optional retained/restored data volume in the selected AZ. Never attach a volume in use.'},'Ami':{'Type':'AWS::SSM::Parameter::Value<AWS::EC2::Image::Id>','Default':'/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64'}},'Conditions':{'CreateData':{'Fn::Equals':[ref('ExistingDataVolumeId'),'']}},'Resources':resources,'Outputs':{'PublicIp':{'Value':ref('Address'),'Description':'Set the domain A record to this address'},'Url':{'Value':sub('https://${Domain}')},'InstanceId':{'Value':ref('Host')},'DataVolumeId':{'Value':{'Fn::If':['CreateData',ref('Data'),ref('ExistingDataVolumeId')]}},'BackupVaultName':{'Value':ref('BackupVault')}}}
Path('deploy/aws/stack.json').write_text(json.dumps(stack,indent=2)+'\n')
