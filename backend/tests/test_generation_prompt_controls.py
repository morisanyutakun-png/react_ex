from backend.llm_helpers import make_generation_prompt_with_context


def test_generation_prompt_includes_difficulty_and_style():
    p = make_generation_prompt_with_context('平方完成', num=5, request_id='r', context_text='ctx', min_difficulty=0.2, max_difficulty=0.6, generation_style='olympiad', prohibited_tags=['proof','essay'], include_explanations=True)
    assert 'difficulty' in p
    assert 'between 0.2 and 0.6' in p
    assert 'Style: olympiad' in p
    assert 'Do NOT produce problems with these tags' in p
    assert 'explanation' in p or 'explanations' in p
