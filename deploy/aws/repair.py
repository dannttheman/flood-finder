"""Resume the specific early awscli2 package failure on the preserved EC2 host."""
import argparse
import base64
import json
from pathlib import Path
import subprocess
import time

BAD = 'dnf install -y docker awscli2 cronie'
GOOD = 'command -v aws >/dev/null\ndnf install -y docker cronie'

def fix_template(value):
    if isinstance(value, str):
        return value.replace(BAD, GOOD)
    if isinstance(value, list):
        return [fix_template(v) for v in value]
    if isinstance(value, dict):
        return {k: fix_template(v) for k, v in value.items()}
    return value

def repair_script(source):
    if BAD not in source:
        raise ValueError('This repair applies only to the known awscli2 bootstrap failure; refusing an unrelated repair.')
    source=source.replace('mount /srv/flood-finder\n', 'mountpoint -q /srv/flood-finder || mount /srv/flood-finder\n')
    source=source.replace('echo "UUID=$UUID /srv/flood-finder ext4 defaults 0 2" >> /etc/fstab', 'grep -q "^UUID=$UUID " /etc/fstab || echo "UUID=$UUID /srv/flood-finder ext4 defaults 0 2" >> /etc/fstab')
    return source.replace(BAD, GOOD).replace("trap 'signal_result FAILURE' ERR", "trap 'echo \"Repair failed at line $LINENO\" >&2' ERR").replace('\nsignal_result SUCCESS\n', '\necho "Bootstrap repair completed"\n')

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--stack',required=True)
    parser.add_argument('--state-dir',required=True)
    args=parser.parse_args()
    state=Path(args.state_dir);state.mkdir(parents=True,exist_ok=True)
    def aws(*command):
        result=subprocess.run(['aws',*command,'--region','us-east-1','--output','json','--no-cli-pager'],text=True,capture_output=True)
        if result.returncode:
            raise RuntimeError(result.stderr.strip())
        return json.loads(result.stdout) if result.stdout.strip() else {}
    stack=aws('cloudformation','describe-stacks','--stack-name',args.stack)['Stacks'][0]
    if stack['StackStatus']!='CREATE_FAILED':
        raise RuntimeError('Expected CREATE_FAILED with preserved resources; no changes made.')
    instance=aws('cloudformation','describe-stack-resource','--stack-name',args.stack,'--logical-resource-id','Host')['StackResourceDetail']['PhysicalResourceId']
    attribute=aws('ec2','describe-instance-attribute','--instance-id',instance,'--attribute','userData')
    original=base64.b64decode(attribute['UserData']['Value']).decode()
    corrected=repair_script(original)
    template=aws('cloudformation','get-template','--stack-name',args.stack,'--template-stage','Original')['TemplateBody']
    if isinstance(template,str): template=json.loads(template)
    fixed=fix_template(template)
    if fixed==template: raise RuntimeError('Expected package error not present in saved template; stopping.')
    (state/'template-before-repair.json').write_text(json.dumps(template,indent=2))
    template_file=state/'template-repaired.json';template_file.write_text(json.dumps(fixed,indent=2))
    parameters=state/'repair-parameters.json'
    parameters.write_text(json.dumps([{'ParameterKey':p['ParameterKey'],'UsePreviousValue':True} for p in stack['Parameters']]))
    # Run on the same host and volume before updating CloudFormation. No new server is launched here.
    payload=base64.b64encode(corrected.encode()).decode()
    remote=state/'repair-command.json'
    remote.write_text(json.dumps({'commands':[f"echo '{payload}' | base64 -d > /tmp/flood-finder-repair.sh",'bash /tmp/flood-finder-repair.sh'],'executionTimeout':['1800']}))
    print(f'Resuming setup on preserved instance {instance}. Existing stack parameters and data volume are reused.',flush=True)
    sent=aws('ssm','send-command','--instance-ids',instance,'--document-name','AWS-RunShellScript','--parameters','file://'+str(remote))
    command_id=sent['Command']['CommandId']
    for _ in range(240):
        time.sleep(5)
        try: result=aws('ssm','get-command-invocation','--command-id',command_id,'--instance-id',instance)
        except RuntimeError as exc:
            if 'InvocationDoesNotExist' in str(exc): continue
            raise
        if result['Status'] in ['Pending','InProgress','Delayed']: continue
        (state/'repair-result.json').write_text(json.dumps(result,indent=2))
        print(result.get('StandardOutputContent',''))
        if result['Status']!='Success':
            raise RuntimeError(result.get('StandardErrorContent','') or 'Remote bootstrap repair failed.')
        break
    else: raise RuntimeError(f'Repair still running. Inspect SSM command {command_id}; do not launch another server.')
    print('Application startup passed. Saving corrected bootstrap to the existing CloudFormation stack.',flush=True)
    aws('cloudformation','update-stack','--stack-name',args.stack,'--template-body','file://'+str(template_file),'--parameters','file://'+str(parameters),'--capabilities','CAPABILITY_IAM','--disable-rollback')
    aws('cloudformation','wait','stack-update-complete','--stack-name',args.stack)
    print('Existing stack repaired and updated. Continuing with DNS and HTTPS verification.',flush=True)

if __name__=='__main__':
    try: main()
    except (RuntimeError,ValueError,KeyError) as exc:
        raise SystemExit(f'Repair stopped: {exc}')
