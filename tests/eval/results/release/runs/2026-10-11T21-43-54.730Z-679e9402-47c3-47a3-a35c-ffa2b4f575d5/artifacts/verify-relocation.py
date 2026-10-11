import hashlib, json, sys
from pathlib import Path
scratch=Path(__file__).parent
repo=Path('[fixture]')
phase=sys.argv[1]
plan=json.loads((scratch/'apply-plan.json').read_text())
original=(scratch/'CONTRIBUTING.original.md').read_text()
rule='External modules use the public ledger package.\nThe ledger owns entries and all balance calculations.\n'
contrib=next(e['proposedContent'] for e in plan['edits'] if e['path']=='CONTRIBUTING.md')
standards=next(e['proposedContent'] for e in plan['edits'] if e['path']=='CODING_STANDARDS.md')
assert original.replace(rule,'See [public-ledger ownership](CODING_STANDARDS.md#public-ledger-ownership).\n')==contrib
assert standards=='# Coding standards\n\n## Public-ledger ownership\n\n'+rule
assert (contrib+standards).count(rule)==1
assert 'CODING_STANDARDS.md#public-ledger-ownership' in contrib
assert '## Public-ledger ownership' in standards
for edit in plan['edits']:
    path=(scratch if phase=='preview' else repo)/edit['path']
    assert hashlib.sha256(path.read_bytes()).hexdigest()==edit['proposedHash'],path
for path,digest in json.loads((scratch/'original-inputs.json').read_text()).items():
    if path != 'CONTRIBUTING.md':
        assert hashlib.sha256((repo/path).read_bytes()).hexdigest()==digest,path
print('PASS: exact relocation, one rule authority, resolved link, all other tracked bytes preserved ('+phase+')')
