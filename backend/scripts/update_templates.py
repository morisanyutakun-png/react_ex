#!/usr/bin/env python3
"""Update templates.json and templates_small.json with cleaner prompts."""
import json
import os

BASE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(BASE)

templates = {
    "\u6570\u5b66_\u5fae\u5206\u7a4d\u5206\u767a\u5c55": {
        "name": "\u6570\u5b66\uff08\u5fae\u5206\u7a4d\u5206\uff08\u767a\u5c55\uff09\uff09 \u30c6\u30f3\u30d7\u30ec\u30fc\u30c8",
        "description": "\u6570\u5b66\uff08\u5fae\u5206\u7a4d\u5206\uff08\u767a\u5c55\uff09\uff09 \u306e\u554f\u984c\u3092\u751f\u6210\u3059\u308b\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8",
        "prompt": "\u79d1\u76ee: {subject}\n\u5206\u91ce: \u5fae\u5206\u7a4d\u5206\uff08\u767a\u5c55\uff09\n\u96e3\u6613\u5ea6: {difficulty}\n\u51fa\u984c\u6570: {num_questions}\n\n\u6307\u793a:\n\u4ee5\u4e0b\u306e\u6761\u4ef6\u3067\u6570\u5b66\uff08\u5fae\u5206\u7a4d\u5206\uff08\u767a\u5c55\uff09\uff09\u306e\u554f\u984c\u3092\u51fa\u984c\u3057\u3066\u304f\u3060\u3055\u3044\u3002\n\u300c\u5fae\u5206\u7a4d\u5206\uff08\u767a\u5c55\uff09\u300d\u306e\u7bc4\u56f2\u3092\u91cd\u70b9\u7684\u306b\u6271\u3063\u3066\u304f\u3060\u3055\u3044\u3002\n\n- \u554f\u984c\u3068\u89e3\u7b54\u30fb\u89e3\u8aac\u3092\u5fc5\u305a\u542b\u3081\u308b\u3053\u3068\n- \u554f\u984c\u6570\u306f {num_questions} \u554f\n- \u96e3\u6613\u5ea6\u306f\u300c{difficulty}\u300d\u30ec\u30d9\u30eb",
        "metadata": {
            "subject": "\u6570\u5b66",
            "field": "\u5fae\u5206\u7a4d\u5206\uff08\u767a\u5c55\uff09",
            "is_stem": True,
            "auto_generated": True
        }
    },
    "\u60c5\u5831_javascript": {
        "name": "\u60c5\u5831\uff08JavaScript\uff09 \u30c6\u30f3\u30d7\u30ec\u30fc\u30c8",
        "description": "\u60c5\u5831\uff08JavaScript\uff09 \u306e\u554f\u984c\u3092\u751f\u6210\u3059\u308b\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8",
        "prompt": "\u79d1\u76ee: {subject}\n\u5206\u91ce: JavaScript\n\u96e3\u6613\u5ea6: {difficulty}\n\u51fa\u984c\u6570: {num_questions}\n\n\u6307\u793a:\n\u4ee5\u4e0b\u306e\u6761\u4ef6\u3067\u60c5\u5831\uff08JavaScript\uff09\u306e\u554f\u984c\u3092\u51fa\u984c\u3057\u3066\u304f\u3060\u3055\u3044\u3002\n\u300cJavaScript\u300d\u306e\u7bc4\u56f2\u3092\u91cd\u70b9\u7684\u306b\u6271\u3063\u3066\u304f\u3060\u3055\u3044\u3002\n\n- \u554f\u984c\u3068\u89e3\u7b54\u30fb\u89e3\u8aac\u3092\u5fc5\u305a\u542b\u3081\u308b\u3053\u3068\n- \u554f\u984c\u6570\u306f {num_questions} \u554f\n- \u96e3\u6613\u5ea6\u306f\u300c{difficulty}\u300d\u30ec\u30d9\u30eb",
        "metadata": {
            "subject": "\u60c5\u5831",
            "field": "JavaScript",
            "difficulty": "\u666e\u901a",
            "is_stem": True,
            "auto_generated": True
        }
    }
}

templates_small = {
    "gen_short_answer": {
        "name": "\u77ed\u7b54\u554f\u984c\uff08\u6570\u7406\uff0f\u77ed\u6587\uff09",
        "description": "\u6307\u5b9a\u79d1\u76ee\u30fb\u96e3\u6613\u5ea6\u3067\u77ed\u3044\u554f\u984c\uff08\u89e3\u7b54\u306f1\u301c3\u884c\uff09\u3092\u751f\u6210\u3002\u51fa\u529b\u306f LaTeX \u5f62\u5f0f\u3002",
        "prompt": "\u3042\u306a\u305f\u306f\u6559\u80b2\u7528\u306e\u554f\u984c\u4f5c\u6210\u30a8\u30ad\u30b9\u30d1\u30fc\u30c8\u3067\u3059\u3002{subject} {difficulty}\u30021\u554f\u306e\u554f\u984c\u6587\u3068\u77ed\u3044\u89e3\u7b54\u3092LaTeX\u3067\u51fa\u529b\u3057\u3066\u304f\u3060\u3055\u3044\u3002\u51fa\u529b\u306e\u307f\u8fd4\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
        "metadata": {"type": "short", "latex": True}
    },
    "gen_multiple_choice": {
        "name": "\u56db\u629e\u554f\u984c\uff08\u9078\u629e\u5f0f\uff09",
        "description": "\u79d1\u76ee\u30fb\u96e3\u6613\u5ea6\u306b\u5408\u308f\u305b\u305f\u8907\u6570\u9078\u629e\u80a2\uff08A-D\uff09\u3092\u6301\u3064\u554f\u984c\u3092\u751f\u6210\u3002LaTeX \u5f62\u5f0f\u3067\u51fa\u529b\u3002",
        "prompt": "\u79d1\u76ee: {subject}\u3001\u96e3\u6613\u5ea6: {difficulty}\u3002A,B,C,D \u306e\u9078\u629e\u80a2\u3092\u6301\u3064\u554f\u984c\u30921\u554fLaTeX\u3067\u51fa\u529b\u3057\u3001\u6b63\u7b54\u3092\u793a\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
        "metadata": {"type": "mcq", "latex": True}
    },
    "gen_quadratic_ia": {
        "name": "\u4e8c\u6b21\u95a2\u6570\uff08\u6570\u5b66IA\uff09",
        "description": "\u6570\u5b66IA\u306e\u4e8c\u6b21\u95a2\u6570\u5206\u91ce\u306e\u554f\u984c\u30921\u554f\u751f\u6210\u3057\u3001\u89e3\u7b54\u3068\u89e3\u8aac\u3092\u4ed8\u3051\u308b\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u3002",
        "prompt": "\u3042\u306a\u305f\u306f\u9ad8\u6821\u6570\u5b66\uff08\u6570\u5b66IA\uff09\u306e\u6559\u6750\u4f5c\u6210\u30a8\u30ad\u30b9\u30d1\u30fc\u30c8\u3067\u3059\u3002\u30c6\u30fc\u30de: \u4e8c\u6b21\u95a2\u6570\u3002\u96e3\u6613\u5ea6: {difficulty}\u3002\n\n\u51fa\u529b\u5f62\u5f0f: \u53b3\u5bc6\u306b1\u3064\u306eJSON\u30aa\u30d6\u30b8\u30a7\u30af\u30c8\u306e\u307f\u3002\u4ed6\u306e\u30c6\u30ad\u30b9\u30c8\u306f\u4e00\u5207\u51fa\u529b\u3057\u306a\u3044\u3002\n\n\u5fc5\u9808\u30c8\u30c3\u30d7\u30ec\u30d9\u30eb\u30ad\u30fc:\n- \"explanation\" (string): \u65e5\u672c\u8a9e\u306e\u89e3\u8aac\n- \"answer_brief\" (string|null): \u7c21\u6f54\u306a\u89e3\u7b54\n- \"confidence\" (number 0.0-1.0)\n- \"references\" (array)\n- \"problem\" (object|null)\n\n\"problem\" \u306e\u5185\u90e8\u30d5\u30a3\u30fc\u30eb\u30c9:\n- \"source\", \"page\", \"stem\", \"normalized_text\", \"solution_outline\"\n- \"stem_latex\", \"difficulty\", \"difficulty_level\", \"trickiness\"\n- \"metadata\": {\"topic\", \"type\", \"expected_mistakes\", \"tags\"}\n\n\u30d5\u30a9\u30fc\u30eb\u30d0\u30c3\u30af:\n{\"answer_brief\": null, \"explanation\": \"\u7406\u7531\", \"confidence\": 0.0, \"references\": [], \"problem\": null}",
        "metadata": {"type": "quadratic", "subject": "\u6570\u5b66IA", "latex": True, "is_stem": True, "tags": ["\u4e8c\u6b21\u95a2\u6570", "\u6570\u5b66IA"]}
    }
}

with open(os.path.join(BACKEND, "templates.json"), "w", encoding="utf-8") as f:
    json.dump(templates, f, ensure_ascii=False, indent=2)
    f.write("\n")

with open(os.path.join(BACKEND, "templates_small.json"), "w", encoding="utf-8") as f:
    json.dump(templates_small, f, ensure_ascii=False, indent=2)
    f.write("\n")

print("OK: templates.json and templates_small.json updated")
