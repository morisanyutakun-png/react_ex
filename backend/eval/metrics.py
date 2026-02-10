"""
Evaluation metrics: Precision@k, MRR, NDCG.
"""
from typing import List
import math


def precision_at_k(retrieved: List[int], relevant: List[int], k: int) -> float:
    if k <= 0:
        return 0.0
    topk = retrieved[:k]
    if not topk:
        return 0.0
    hits = sum(1 for r in topk if r in relevant)
    return hits / float(k)


def mrr(retrieved: List[int], relevant: List[int]) -> float:
    """Mean Reciprocal Rank for a single query's retrieved list.
    Returns reciprocal rank of the first relevant item or 0.0 if none.
    """
    for i, r in enumerate(retrieved, start=1):
        if r in relevant:
            return 1.0 / float(i)
    return 0.0


def dcg_at_k(retrieved: List[int], relevant: List[int], k: int) -> float:
    """Discounted cumulative gain (binary relevance)"""
    dcg = 0.0
    for i, r in enumerate(retrieved[:k], start=1):
        rel = 1.0 if r in relevant else 0.0
        if i == 1:
            dcg += rel
        else:
            dcg += rel / math.log2(i + 0.0)
    return dcg


def idcg_at_k(relevant: List[int], k: int) -> float:
    # ideal DCG when all relevant docs are placed at top
    rels = min(len(relevant), k)
    idcg = 0.0
    for i in range(1, rels + 1):
        if i == 1:
            idcg += 1.0
        else:
            idcg += 1.0 / math.log2(i + 0.0)
    return idcg


def ndcg_at_k(retrieved: List[int], relevant: List[int], k: int) -> float:
    idcg = idcg_at_k(relevant, k)
    if idcg == 0:
        return 0.0
    return dcg_at_k(retrieved, relevant, k) / idcg
