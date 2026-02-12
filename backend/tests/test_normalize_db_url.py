"""Quick smoke-test for _normalize_database_url and CORS changes."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from backend.db import _normalize_database_url

# 1: postgres:// → postgresql:// + sslmode added
url1 = 'postgres://user:pass@ep-xxx.us-east-2.aws.neon.tech/dbname'
r1 = _normalize_database_url(url1)
assert r1.startswith('postgresql://'), f'scheme not fixed: {r1}'
assert 'sslmode=require' in r1, f'sslmode not added: {r1}'
print(f'Test 1 OK: {r1}')

# 2: sslmode already present → don't duplicate
url2 = 'postgresql://user:pass@ep-xxx.neon.tech/db?sslmode=verify-full'
r2 = _normalize_database_url(url2)
assert 'sslmode=verify-full' in r2
assert r2.count('sslmode') == 1
print(f'Test 2 OK: {r2}')

# 3: localhost → no sslmode
url3 = 'postgresql://user:pass@localhost:5432/db'
r3 = _normalize_database_url(url3)
assert 'sslmode' not in r3
print(f'Test 3 OK: {r3}')

# 4: sqlite → passthrough
url4 = 'sqlite:///./data/examgen.db'
r4 = _normalize_database_url(url4)
assert r4 == url4
print(f'Test 4 OK: {r4}')

# 5: docker host 'db' → no sslmode
url5 = 'postgresql://user:pass@db:5432/examgen'
r5 = _normalize_database_url(url5)
assert 'sslmode' not in r5
print(f'Test 5 OK: {r5}')

# 6: None / empty
assert _normalize_database_url(None) is None
assert _normalize_database_url('') == ''
print('Test 6 OK: None/empty passthrough')

print('\nAll _normalize_database_url tests passed!')
