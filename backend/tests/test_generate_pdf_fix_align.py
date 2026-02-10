from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_generate_pdf_fix_align():
    # missing closing brace inside align*; the server should auto-fix and compile
    bad = "\\begin{align*}\n  f(x)=(x-2)^{2-1\n\\end{align*}"
    payload = {'generated': [{'latex': bad}], 'title': 'fixalign', 'return_url': False}
    r = client.post('/api/generate_pdf', json=payload)
    assert r.status_code == 200
    # content-type should be pdf when streaming
    assert 'application/pdf' in r.headers.get('content-type', '')
