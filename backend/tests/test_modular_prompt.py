#!/usr/bin/env python3
"""Tests for the refactored modular prompt system.
   
Uses exec() to extract only the needed functions from main.py
without triggering heavy imports like sklearn/scipy.
"""
import sys
import os
import re

# Instead of importing main.py (which pulls in sklearn/scipy/etc.),
# read the source and extract just the functions we need.
MAIN_PY = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'main.py')

with open(MAIN_PY, 'r', encoding='utf-8') as f:
    source = f.read()

# Extract the relevant code blocks
namespace = {'Dict': dict, 'Any': None, 'Optional': None, 'List': list, 're': re}

# Find and execute: _STEM_SUBJECTS, _STEM_KEYWORDS, _NON_STEM_SUBJECTS, _is_stem_subject,
# _LATEX_CORE_RULES, _LATEX_MATH_RULES, etc.
# These are all between "# ── 科目分類" and "# Fallback preset definitions"
start_marker = '# ── 科目分類 & モジュラー・プロンプト部品'
end_marker = '# Fallback preset definitions'
start_idx = source.find(start_marker)
end_idx = source.find(end_marker, start_idx)
if start_idx == -1 or end_idx == -1:
    print("ERROR: Could not find the code block markers in main.py")
    sys.exit(1)

code_block = source[start_idx:end_idx]
exec(code_block, namespace)

_is_stem_subject = namespace['_is_stem_subject']
_build_latex_instructions = namespace['_build_latex_instructions']
_build_groq_system_prompt = namespace['_build_groq_system_prompt']

def test_subject_classification():
    """Test _is_stem_subject correctly classifies subjects."""
    # STEM subjects
    assert _is_stem_subject('数学', '') == True, 'math -> STEM'
    assert _is_stem_subject('物理', '') == True, 'physics -> STEM'
    assert _is_stem_subject('化学', '') == True, 'chemistry -> STEM'
    assert _is_stem_subject('情報', '') == True, 'info -> STEM'
    assert _is_stem_subject('数学IA', '') == True, 'math1A -> STEM'

    # Non-STEM subjects
    assert _is_stem_subject('英語', '') == False, 'english -> non-STEM'
    assert _is_stem_subject('国語', '') == False, 'japanese -> non-STEM'
    assert _is_stem_subject('社会', '') == False, 'social -> non-STEM'
    assert _is_stem_subject('日本史', '') == False, 'history -> non-STEM'
    assert _is_stem_subject('古文', '') == False, 'classical -> non-STEM'

    # Keyword detection from prompt
    assert _is_stem_subject('', '二次関数の問題') == True, 'keyword in prompt -> STEM'
    assert _is_stem_subject('', '英語の長文読解') == False, 'no keyword -> non-STEM'
    assert _is_stem_subject('', '微分の計算') == True, 'calculus keyword -> STEM'

    # Unknown subject defaults to non-STEM
    assert _is_stem_subject('体育', '') == False, 'unknown -> non-STEM'
    # Empty both -> defaults STEM (safety)
    assert _is_stem_subject('', '') == True, 'empty -> STEM (safety)'

    print('  [PASS] test_subject_classification')


def test_build_latex_instructions_stem():
    """STEM subjects get math rules."""
    instr = _build_latex_instructions(subject='数学', prompt_text='')
    assert 'frac' in instr, 'STEM should have frac rules'
    assert 'sqrt' in instr, 'STEM should have sqrt rules'
    assert 'sin' in instr, 'STEM should have trig rules'
    assert '中括弧' in instr, 'Should have brace balance rule'
    # Should NOT have humanities hints
    assert 'H1.' not in instr, 'STEM should NOT have humanities hints'
    print('  [PASS] test_build_latex_instructions_stem')


def test_build_latex_instructions_non_stem():
    """Non-STEM subjects get humanities hints, no math rules section."""
    instr = _build_latex_instructions(subject='英語', prompt_text='')
    # Should NOT have the STEM math rules section
    assert '数式の記述ルール（理系科目用）' not in instr, 'Non-STEM should NOT have STEM math section'
    assert 'M1.' not in instr, 'Non-STEM should NOT have M1 rule'
    assert 'H1.' in instr, 'Non-STEM should have humanities hints'
    assert '自然な日本語' in instr, 'Should have natural language hint'
    # Should still have core rules
    assert '$...$' in instr, 'Should still have inline math format'
    print('  [PASS] test_build_latex_instructions_non_stem')


def test_build_latex_instructions_with_preset():
    """Preset instructions are appended."""
    instr = _build_latex_instructions(
        subject='数学',
        preset_name='試験問題',
        preset_prompt_instr='テスト用のプリセット指示'
    )
    assert 'テスト用のプリセット指示' in instr, 'Preset instr should be included'
    assert '試験問題' in instr, 'Preset name should be included'
    print('  [PASS] test_build_latex_instructions_with_preset')


def test_build_groq_system_prompt_stem():
    """Groq STEM prompt has math rules."""
    prompt = _build_groq_system_prompt(subject='数学', prompt_text='')
    assert '理系' in prompt, 'STEM prompt should mention 理系'
    assert 'frac' in prompt, 'STEM prompt should have frac rules'
    assert '検算' in prompt, 'STEM prompt should have verification rule'
    print('  [PASS] test_build_groq_system_prompt_stem')


def test_build_groq_system_prompt_non_stem():
    """Groq non-STEM prompt omits math-specific rules."""
    prompt = _build_groq_system_prompt(subject='', prompt_text='英語の長文問題')
    assert '数式ルール（理系科目）' not in prompt, 'Non-STEM prompt should NOT have STEM math section'
    assert '検算' not in prompt, 'Non-STEM prompt should NOT have verification rule'
    # But should still have core LaTeX rules
    assert '$...$' in prompt, 'Should have inline math notation'
    print('  [PASS] test_build_groq_system_prompt_non_stem')


def test_no_contradictions():
    """Prompts should not contain contradictory instructions."""
    instr = _build_latex_instructions(subject='数学', prompt_text='')
    # Should NOT say things are "禁止" (too strict, causes misbehavior)
    # Core rules should say "使用しない" or "使わない" (softer, less confusing)
    assert '絶対禁止' not in instr, 'Should not use 絶対禁止 (too harsh)'
    # Should not mention \\(...\\) at all (was causing contradiction)
    assert '\\(...\\)' not in instr, 'Should not mention \\(...\\) (confusing)'
    assert '$$' not in instr or '$$ は使わない' in instr, 'Should use soft prohibition for $$'
    print('  [PASS] test_no_contradictions')


def test_quality_rules():
    """Quality rules are always included."""
    stem_instr = _build_latex_instructions(subject='数学')
    assert '教材品質' in stem_instr, 'Should have quality rule'
    assert '検算' in stem_instr, 'STEM should have verification rule'

    non_stem_instr = _build_latex_instructions(subject='英語')
    assert '教材品質' in non_stem_instr, 'Non-STEM should also have quality rule'
    assert '検算' not in non_stem_instr, 'Non-STEM should NOT have verification rule'
    print('  [PASS] test_quality_rules')


if __name__ == '__main__':
    print('Running modular prompt tests...')
    test_subject_classification()
    test_build_latex_instructions_stem()
    test_build_latex_instructions_non_stem()
    test_build_latex_instructions_with_preset()
    test_build_groq_system_prompt_stem()
    test_build_groq_system_prompt_non_stem()
    test_no_contradictions()
    test_quality_rules()
    print('\nAll tests passed!')
