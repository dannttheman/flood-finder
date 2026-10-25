"""Exercise orchestration with fake AWS/Docker/DNS/HTTP commands; creates no resources."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

LAUNCH = Path(__file__).with_name('launch.sh').resolve()
MOCK = r'''#!/usr/bin/env python3
import sys,os,json,pathlib
name=pathlib.Path(sys.argv[0]).name; args=sys.argv[1:]; line=' '.join(args)
state=pathlib.Path(os.environ['STATE_DIR'])
def emit(data): print(json.dumps(data))
if name=='aws':
    with (state/'calls.txt').open('a') as f: f.write(line+'\n')
    if line.startswith('sts get-caller-identity'): print('123456789012')
    elif line.startswith('cloudformation describe-stacks'):
        if '--query' in args:
            print('operator@example.com');sys.exit(0)
        if os.environ.get('NEW_STACK')=='1' and not (state/'created').exists():
            print('Stack does not exist',file=sys.stderr);sys.exit(1)
        emit({'Stacks':[{'StackStatus':'CREATE_COMPLETE','Parameters':[{'ParameterKey':'Domain','ParameterValue':'floodfinderusa.com'}], 'Outputs':[{'OutputKey':'PublicIp','OutputValue':'192.0.2.10'},{'OutputKey':'InstanceId','OutputValue':'i-test'}]}]})
    elif line.startswith('ec2 describe-instance-type-offerings'): print('us-east-1a')
    elif line.startswith('ecr describe-repositories'): emit({})
    elif line.startswith('ecr get-login-password'): print('fake-test-login')
    elif line.startswith('ecr describe-images'): print('sha256:'+'a'*64)
    elif line.startswith('cloudformation validate-template'): emit({})
    elif line.startswith('cloudformation create-stack'):
        (state/'created').touch();emit({'StackId':'test'})
    elif line.startswith('cloudformation wait stack-create-complete'): pass
    elif line.startswith('route53 list-hosted-zones'):
        emit({'HostedZones':[{'Id':'/hostedzone/test','Name':'floodfinderusa.com.','Config':{'PrivateZone':False}}]})
    elif line.startswith('route53 get-hosted-zone'):
        emit({'DelegationSet':{'NameServers':['ns1.example.com','ns2.example.com']}})
    elif line.startswith('route53 list-resource-record-sets'):
        records=[{'Name':'floodfinderusa.com.','Type':'A','TTL':300,'ResourceRecords':[{'Value':'192.0.2.20'}]}, {'Name':'floodfinderusa.com.','Type':'AAAA','TTL':300,'ResourceRecords':[{'Value':'2001:db8::1'}]}, {'Name':'mail.floodfinderusa.com.','Type':'A','TTL':300,'ResourceRecords':[{'Value':'192.0.2.30'}]}]
        if os.environ.get('ROUTED')=='1': records[0]['SetIdentifier']='weighted';records[0]['Weight']=50
        emit({'ResourceRecordSets':records})
    elif line.startswith('route53 change-resource-record-sets'): print('/change/test')
    elif line.startswith('route53 wait'): pass
    else: print('Unexpected AWS call: '+line,file=sys.stderr);sys.exit(2)
elif name=='dig':
    print('ns1.example.com.\nns2.example.com.' if os.environ.get('EXTERNAL')!='1' else 'other.example.com.')
elif name=='curl':
    url=next((a for a in args if a.startswith('http')), '')
    if url.endswith('/api/ready'):
        pathlib.Path(args[args.index('-o')+1]).write_text('{"ok":true}')
    elif url.endswith('/api/stream'):
        print(': connected' if os.environ.get('BROKEN_STREAM')!='1' else 'not a stream');sys.exit(28)
    elif '--write-out' in args: print('308',end='')
    else: pathlib.Path(args[args.index('-o')+1]).write_text('<section id="homeView"></section>')
elif name=='timeout':
    import subprocess
    sys.exit(subprocess.call(args[1:]))
elif name=='docker': pass
else: print('Unexpected command '+name,file=sys.stderr);sys.exit(2)
'''

class LaunchTests(unittest.TestCase):
    def run_script(self, **flags):
        with tempfile.TemporaryDirectory() as folder:
            base=Path(folder); tools=base/'bin'; tools.mkdir(); state=base/'state'; state.mkdir()
            for name in ['aws','docker','curl','dig','timeout']:
                file=tools/name;file.write_text(MOCK);file.chmod(0o755)
            env={**os.environ,'PATH':str(tools)+':'+os.environ['PATH'],'STATE_DIR':str(state),**flags}
            result=subprocess.run(['bash',str(LAUNCH)],env=env,input='\n',text=True,capture_output=True)
            files={p.name:p.read_text() for p in state.iterdir()}
            return result,files

    def test_new_stack_builds_image_and_preserves_failed_resources(self):
        result,files=self.run_script(NEW_STACK='1')
        self.assertEqual(result.returncode,0,result.stderr+result.stdout)
        self.assertIn('--disable-rollback',files['calls.txt'])
        self.assertIn('stack-create-complete',files['calls.txt'])
        params={p['ParameterKey']:p['ParameterValue'] for p in json.loads(files['parameters.json'])}
        self.assertEqual(params['Domain'],'floodfinderusa.com')
        self.assertEqual(params['AvailabilityZone'],'us-east-1a')
        self.assertTrue(params['ImageUri'].endswith('@sha256:'+'a'*64))

    def test_resume_updates_only_apex_and_verifies_live_connection(self):
        result,files=self.run_script()
        self.assertEqual(result.returncode,0,result.stderr+result.stdout)
        self.assertIn('SUCCESS:',result.stdout)
        changes=json.loads(files['dns-change.json'])['Changes']
        self.assertEqual([c['ResourceRecordSet']['Type'] for c in changes],['A','AAAA','A'])
        self.assertTrue(all(c['ResourceRecordSet']['Name']=='floodfinderusa.com.' for c in changes))
        self.assertIn('mail.floodfinderusa.com',files['dns-before.json'])
        self.assertNotIn('create-stack',files['calls.txt'])

    def test_non_authoritative_zone_is_not_changed(self):
        result,files=self.run_script(EXTERNAL='1')
        self.assertEqual(result.returncode,0,result.stderr+result.stdout)
        self.assertIn('ACTION REQUIRED',result.stdout)
        self.assertNotIn('change-resource-record-sets',files['calls.txt'])

    def test_failed_live_stream_does_not_report_success(self):
        result,_=self.run_script(BROKEN_STREAM='1')
        self.assertNotEqual(result.returncode,0)
        self.assertNotIn('SUCCESS:',result.stdout)

    def test_routed_dns_is_preserved(self):
        result,files=self.run_script(ROUTED='1')
        self.assertNotEqual(result.returncode,0)
        self.assertNotIn('change-resource-record-sets',files['calls.txt'])

if __name__=='__main__': unittest.main()
