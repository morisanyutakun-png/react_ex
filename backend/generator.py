"""Simple quiz generator for arithmetic + vocabulary exercises.

Provides deterministic generation via seed and small template set.
Designed as a drop-in alternative to brittle PDF ingestion: standardize content
and generate many variants programmatically.

API:
- generate_quiz(num_questions=3, seed=None) -> dict with questions and answers

Each question object:
{
  'id': int,
  'type': 'arith'|'vocab',
  'prompt': str,
  'options': list[str]  # for vocab
  'answer': str,
  'explanation': str,
}

This is intentionally small and dependency-free. We can expand to use i18n,
LLM-based paraphrasing, difficulty levels, or store templates in DB later.
"""
from __future__ import annotations

import random
from typing import List, Dict, Any, Optional

# Small vocabulary bank: word -> correct meaning (Japanese simple)
VOCAB_BANK = {
    "report": "報告（書）",
    "need": "必要である",
    "wait": "待つ",
    "write": "書く",
    "travel": "旅行する",
    "build": "作る",
    "change": "変える",
    "enjoy": "楽しむ",
}

# Distractor pool (meanings) - used to form options
DISTRACTORS = [
    "国",
    "色",
    "心配",
    "計画",
    "楽しみ",
    "変更",
    "作成",
    "報告（書）",
]


def _gen_arith_question(min_a=10, max_a=99, min_b=10, max_b=99, allow_carry=True) -> Dict[str, Any]:
    a = random.randint(min_a, max_a)
    b = random.randint(min_b, max_b)
    # For now only addition, can extend to subtraction/multiplication
    prompt = f"計算してください：{a}+{b}"
    answer = str(a + b)
    explanation = (
        f"{a}+{b}の計算。1の位を足して、繰り上がりがあれば十の位に加えます。よって {a}+{b} = {answer}。"
    )
    return {
        "type": "arith",
        "prompt": prompt,
        "options": [],
        "answer": answer,
        "explanation": explanation,
    }


def _gen_vocab_question() -> Dict[str, Any]:
    word = random.choice(list(VOCAB_BANK.keys()))
    correct = VOCAB_BANK[word]

    # build options: include correct plus 3 distractors
    pool = [d for d in DISTRACTORS if d != correct]
    opts = random.sample(pool, k=3) if len(pool) >= 3 else pool[:]
    opts.append(correct)
    random.shuffle(opts)

    prompt = f"次の英単語の意味として最も適切なものを選びなさい：{word}"
    explanation = f"{word}は「{correct}」という意味です。"

    return {
        "type": "vocab",
        "prompt": prompt,
        "options": opts,
        "answer": correct,
        "explanation": explanation,
    }


def generate_quiz(num_questions: int = 3, seed: Optional[int] = None, mix: bool = True) -> Dict[str, Any]:
    """Generate a quiz with num_questions items.

    If seed is provided, generation is deterministic.
    If mix is True, alternate between arithmetic and vocab where possible.
    """
    if seed is not None:
        random.seed(seed)

    questions: List[Dict[str, Any]] = []
    for i in range(num_questions):
        if mix:
            # alternate types for variety
            if i % 2 == 0:
                q = _gen_arith_question()
            else:
                q = _gen_vocab_question()
        else:
            # default to arithmetic then vocab
            if random.random() < 0.5:
                q = _gen_arith_question()
            else:
                q = _gen_vocab_question()

        q["id"] = i + 1
        questions.append(q)

    meta = {"num_questions": num_questions, "seed": seed}
    return {"meta": meta, "questions": questions}


if __name__ == "__main__":
    # quick demo
    import json

    demo = generate_quiz(3, seed=42)
    print(json.dumps(demo, ensure_ascii=False, indent=2))


def quiz_to_latex(quiz: Dict[str, Any], title: str = "小テスト") -> str:
    """Render a generated quiz dict into a simple LaTeX document string.

    The LaTeX is intentionally minimal and safe (no shell-escape, no custom macros).
    """
    lines = [
        r"\\documentclass[12pt]{article}",
        r"\\usepackage{iftex}",
        r"\\usepackage{enumitem}",
        r"\\usepackage{amsmath,amssymb,mathtools}",
        r"\\usepackage{geometry}",
        r"\\geometry{margin=1in}",
        r"\\ifPDFTeX",
        r"  \\usepackage[utf8]{inputenc}",
        r"  \\usepackage[T1]{fontenc}",
        r"  \\usepackage{CJKutf8}",
        r"  \\AtBeginDocument{\\begin{CJK*}{UTF8}{min}}",
        r"  \\AtEndDocument{\\end{CJK*}}",
        r"\\else",
        r"  \\usepackage{fontspec}",
        r"  \\ifLuaTeX",
        r"    \\usepackage{luatexja}",
        r"    \\usepackage{luatexja-fontspec}",
        r"    \\IfFontExistsTF{Hiragino Sans}{\\setmainjfont{Hiragino Sans}}{\\IfFontExistsTF{Noto Sans CJK JP}{\\setmainjfont{Noto Sans CJK JP}}{}}",
        r"  \\else",
        r"    \\usepackage{xeCJK}",
        r"    \\IfFontExistsTF{Hiragino Sans}{\\setCJKmainfont{Hiragino Sans}}{\\IfFontExistsTF{Noto Sans CJK JP}{\\setCJKmainfont{Noto Sans CJK JP}}{}}",
        r"  \\fi",
        r"\\fi",
        r"\\begin{document}",
        f"\\section*{{{title}}}",
        "\\begin{enumerate}[leftmargin=*]",
    ]

    for q in quiz.get("questions", []):
        if q["type"] == "arith":
            prompt = q["prompt"]
            # escape underscore/braces minimally
            prompt_esc = prompt.replace("_", "\\_")
            lines.append("\\item " + prompt_esc)
            # include answer in solution environment later
        elif q["type"] == "vocab":
            prompt = q["prompt"]
            opts = q.get("options", [])
            # render options as (A) etc
            opt_lines = []
            labels = ["(A)", "(B)", "(C)", "(D)"]
            for i, o in enumerate(opts[:4]):
                opt_lines.append(f"{labels[i]} {o}")
            prompt_esc = prompt.replace("_", "\\_")
            lines.append("\\item " + prompt_esc)
            lines.append("\\begin{itemize}")
            for ol in opt_lines:
                lines.append("\\item[] " + ol)
            lines.append("\\end{itemize}")
        else:
            lines.append("\\item " + q.get("prompt", ""))

    lines.append("\\end{enumerate}")

    # Solutions
    lines.append("\\clearpage")
    lines.append("\\section*{解答}")
    lines.append("\\begin{enumerate}[leftmargin=*]")
    for q in quiz.get("questions", []):
        ans = q.get("answer", "")
        lines.append("\\item " + str(ans))
    lines.append("\\end{enumerate}")
    lines.append("\\end{document}")

    return "\n".join(lines)
