"""より説明可能で多次元な難易度／トリッキー度推定器。

設計方針:
- 多数の特徴量を抽出して正規化する
- 重み付けされた線形結合＋非線形マッピング（シグモイド）でスコアを得る
- トリッキー度は選択肢の類似性、誤誘導の痕跡、解答量と演算量の不一致などを評価
- 説明用に各特徴量の寄与を返せる（デバッグ・較正に有用）

互換性: 既存呼び出しは (diff, level, trick) の3要素を受け取れる。
追加で詳細を得たいときは estimate_difficulty_verbose を使ってください。
"""

from typing import Tuple, Dict, Any
import re
import math


# --- configuration: 重みや概念難度の辞書はここで調整可能 ---
FEATURE_WEIGHTS = {
    'len': 0.12,
    'math_expr_count': 0.12,
    'latex_complexity': 0.12,
    'nesting_depth': 0.08,
    'ops': 0.08,
    'solution_len': 0.15,
    'steps': 0.12,
    'concept_density': 0.08,
    'diagram_presence': 0.03,
}

CONCEPT_BASE_WEIGHTS = {
    # 高いほどその概念は難しく扱う
    '積分': 0.9,
    '微分': 0.8,
    '行列': 0.85,
    '確率': 0.9,
    '証明': 0.95,
    '図形': 0.7,
    '数列': 0.75,
    '方程式': 0.6,
}

TRAP_KEYWORDS = ['だが', 'しかし', 'ただし', 'only', 'ただ', '急に', '注意']
DIAGRAM_WORDS = ['図', 'グラフ', '図形', '描け', 'プロット']


# --- low-level helpers ---
def _extract_solution_snippet(text: str) -> str:
    m = re.search(r'(解答|解説|方針|解説：|回答|解答例)', text)
    if not m:
        return ''
    start = m.start()
    return text[start: start + 5000]


def _count_steps(snippet: str) -> int:
    if not snippet:
        return 0
    pattern = r'(?:^|\n)\s*\d+\s*(?:[\)\]\.|\uFF0E\uFF09])'
    n1 = len(re.findall(pattern, snippet))
    n2 = len(re.findall(r'ステップ|Step|手順', snippet))
    return max(n1, n2)


def _count_operations(text: str) -> int:
    return len([c for c in text if c in '+-*/=±×÷'])


def _extract_mc_options(text: str) -> list:
    opts = []
    m = re.findall(r'\([A-D]\)\s*([^\(\n]+)', text)
    if m:
        return [o.strip() for o in m]
    lines = text.splitlines()
    for ln in lines:
        m = re.match(r'\s*([A-D])(?:\.|\)|：|:)\s*(.+)', ln)
        if m:
            opts.append(m.group(2).strip())
    return opts


def _options_similarity(opts: list) -> float:
    if not opts or len(opts) < 2:
        return 0.0
    def toks(s):
        return set(re.findall(r"[A-Za-z0-9一-龥ぁ-んァ-ヴ]+", s.lower()))
    pairs = 0
    total = 0.0
    for i in range(len(opts)):
        for j in range(i + 1, len(opts)):
            a = toks(opts[i])
            b = toks(opts[j])
            if not a and not b:
                sim = 0.0
            else:
                sim = len(a & b) / float(len(a | b))
            total += sim
            pairs += 1
    return total / pairs if pairs else 0.0


def _domain_keyword_density(text: str) -> float:
    words = re.findall(r"[A-Za-z0-9一-龥ぁ-んァ-ヴ]+", text)
    if not words:
        return 0.0
    hits = 0
    score = 0.0
    for w in words:
        for k, v in CONCEPT_BASE_WEIGHTS.items():
            if k in w:
                hits += 1
                score += v
    if hits == 0:
        return 0.0
    # 平均的にどれくらい高難度概念が含まれるか
    return (score / hits)


def _latex_features(text: str) -> Dict[str, Any]:
    # math blocks and common LaTeX constructs
    math_inline = len(re.findall(r'\$[^$]+\$|\\\([^\)]+\\\)', text))
    math_display = len(re.findall(r'\\\[[^\]]+\\\]|\\begin\{equation\}', text))
    frac = len(re.findall(r'\\frac\s*\{', text))
    integral = len(re.findall(r'\\int', text))
    summ = len(re.findall(r'\\sum', text))
    supers = len(re.findall(r'\^\{', text))
    subs = len(re.findall(r'_\{', text))
    # nesting depth approximation by maximum bracket depth
    max_depth = 0
    depth = 0
    for ch in text:
        if ch in '({[':
            depth += 1
            if depth > max_depth:
                max_depth = depth
        elif ch in ')}]':
            depth = max(0, depth - 1)
    return {
        'math_inline': math_inline,
        'math_display': math_display,
        'frac': frac,
        'integral': integral,
        'sum': summ,
        'supers': supers,
        'subs': subs,
        'max_depth': max_depth,
    }


def _presence_of_diagram(text: str) -> int:
    return int(any(w in text for w in DIAGRAM_WORDS))


def _trap_keyword_score(text: str) -> float:
    # 文章中のトラップ/注意語の割合（簡易）
    cnt = sum(text.count(k) for k in TRAP_KEYWORDS)
    return min(1.0, cnt / 2.0)


# --- public API ---
def estimate_difficulty_verbose(text: str) -> Tuple[float, int, float, Dict[str, Any]]:
    """詳しい説明付き推定器。返り値: (diff(0..1), level(1..5), trick(0..1), details dict)

    details は各特徴量と正規化済み値、最終的な寄与を含む。
    """
    text = text or ''
    length = len(text)
    snippet = _extract_solution_snippet(text)
    sol_len = len(snippet)
    steps = _count_steps(snippet)
    ops = _count_operations(text)
    opts = _extract_mc_options(text)
    opt_sim = _options_similarity(opts)
    concept_density = _domain_keyword_density(text)
    latex = _latex_features(text)
    diagram = _presence_of_diagram(text)
    trap = _trap_keyword_score(text)

    # 正規化: 経験的な上限で割る
    f_len = min(1.0, length / 3000.0)
    f_math = min(1.0, (latex['math_inline'] + 2 * latex['math_display']) / 10.0)
    f_frac_integral = min(1.0, (latex['frac'] + latex['integral'] + latex['sum']) / 6.0)
    f_nest = min(1.0, latex['max_depth'] / 8.0)
    f_ops = min(1.0, ops / 20.0)
    f_sol = min(1.0, sol_len / 1500.0)
    f_steps = min(1.0, steps / 10.0)
    f_concept = min(1.0, concept_density)  # already 0..1-ish because CONCEPT weights ~0..1

    # combine some latex signals
    f_latex_complex = min(1.0, 0.5 * f_math + 0.5 * f_frac_integral + 0.4 * f_nest)

    # difficulty: 重み付け線形結合 + interaction terms
    features = {
        'len': f_len,
        'math_expr_count': f_math,
        'latex_complexity': f_latex_complex,
        'nesting_depth': f_nest,
        'ops': f_ops,
        'solution_len': f_sol,
        'steps': f_steps,
        'concept_density': f_concept,
        'diagram_presence': float(diagram),
    }

    # linear contribution
    linear = 0.0
    for k, v in FEATURE_WEIGHTS.items():
        linear += v * features.get(k, 0.0)

    # interactions (経験則): 高いlatex_complexity と long length は難易度を相乗的に上げる
    interaction = 0.0
    interaction += 0.08 * features['latex_complexity'] * features['len']
    interaction += 0.06 * features['ops'] * (1.0 - features['solution_len'])
    interaction += 0.05 * features['concept_density'] * features['steps']

    raw = linear + interaction

    # 非線形マッピング：シグモイドで0..1に押し込み、上限を0.98に
    diff = 1.0 / (1.0 + math.exp(-6.0 * (raw - 0.25)))  # ゲインとシフトは経験値
    diff = max(0.0, min(0.98, diff))

    # trickiness: 複合指標
    trap_factor = trap
    opt_factor = opt_sim
    mismatch = (1.0 - f_sol) * f_ops
    ambiguity = 0.0
    # MC 選択肢があり、選択肢類似度が高い → トリッキー
    if opts:
        ambiguity = opt_factor

    trick_raw = 0.35 * ambiguity + 0.25 * trap_factor + 0.3 * mismatch + 0.1 * features['latex_complexity']
    trick = max(0.0, min(0.98, trick_raw))

    # map difficulty to level (1..5) using thresholds tuned to sigmoid response
    if diff < 0.18:
        level = 1
    elif diff < 0.36:
        level = 2
    elif diff < 0.55:
        level = 3
    elif diff < 0.75:
        level = 4
    else:
        level = 5

    # prepare explanations: per-feature contributions (weight * value)
    contributions = {k: FEATURE_WEIGHTS.get(k, 0.0) * features.get(k, 0.0) for k in features}
    contributions['interaction'] = interaction
    contributions['linear_sum'] = linear
    contributions['raw'] = raw
    contributions['sigmoid_mapped'] = diff
    contributions['trick_raw'] = trick_raw

    details = {
        'features': features,
        'latex': latex,
        'opts': opts,
        'opt_sim': opt_sim,
        'steps': steps,
        'ops': ops,
        'snippet_len': sol_len,
        'trap_score': trap,
        'contributions': contributions,
    }

    return float(diff), int(level), float(trick), details


def estimate_difficulty(text: str) -> Tuple[float, int, float]:
    """互換性を保った簡易呼び出し: (diff, level, trick)

    内部では verbose 実行を呼び出す。
    """
    diff, level, trick, _ = estimate_difficulty_verbose(text)
    return diff, level, trick
