import pytest
from backend.eval.metrics import precision_at_k, mrr, ndcg_at_k


def test_precision_at_k():
    assert precision_at_k([1,2,3], [2,4], 1) == 0.0
    assert precision_at_k([2,1,3], [2,4], 1) == 1.0
    assert precision_at_k([2,4,5], [2,4], 2) == 1.0


def test_mrr():
    assert mrr([3,4,5], [1,2]) == 0.0
    assert mrr([4,2,1], [2,3]) == 1.0/2.0


def test_ndcg():
    rel = [2]
    assert ndcg_at_k([2,3,4], rel, 3) == pytest.approx(1.0)
    assert ndcg_at_k([3,4,5], rel, 3) == pytest.approx(0.0)
