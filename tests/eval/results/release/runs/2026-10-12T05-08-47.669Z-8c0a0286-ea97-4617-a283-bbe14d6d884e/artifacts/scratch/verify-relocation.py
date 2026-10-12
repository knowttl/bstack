import hashlib, json, pathlib, sys
scratch = pathlib.Path(__file__).parent
repo = pathlib.Path('[fixture]')
plan = json.loads((scratch / 'apply-plan.json').read_text())
preview = '--preview' in sys.argv
contents = {e['path']: e['proposedContent'] if preview else (repo / e['path']).read_text() for e in plan['edits']}
for e in plan['edits']:
    assert hashlib.sha256(contents[e['path']].encode()).hexdigest() == e['proposedHash']
rule = 'External modules use the public ledger package.\nThe ledger owns entries and all balance calculations.\n'
assert contents['CODING_STANDARDS.md'].count(rule) == 1
assert rule not in contents['CONTRIBUTING.md']
assert '[Public ledger ownership](CODING_STANDARDS.md#public-ledger-ownership).' in contents['CONTRIBUTING.md']
assert '## Public ledger ownership\n' in contents['CODING_STANDARDS.md']
assert 'Use native Python checks and preserve balanced postings.\n' in contents['CONTRIBUTING.md']
for name, digest in json.loads((scratch / 'original-hashes.json').read_text()).items():
    if name != 'CONTRIBUTING.md':
        assert hashlib.sha256((repo / name).read_bytes()).hexdigest() == digest, name
print('PASS: exact document bytes, single ownership authority, link anchor, retained guidance and unchanged other tracked files')
