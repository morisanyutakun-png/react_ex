-- 009: LaTeX出力形式プリセットテーブル
CREATE TABLE IF NOT EXISTS latex_presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  preamble TEXT NOT NULL,
  document_wrapper TEXT,
  prompt_instruction TEXT,
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 初期プリセット 6種
INSERT INTO latex_presets (id, name, description, preamble, document_wrapper, prompt_instruction, metadata) VALUES

-- 1) 試験問題形式
('exam', '試験問題', '定期テスト・入試形式（配点・解答欄付き）',
E'\\\\documentclass[12pt]{article}\n\\\\usepackage{iftex}\n\\\\usepackage{amsmath,amssymb,mathtools}\n\\\\usepackage{geometry}\n\\\\geometry{margin=1in}\n\\\\usepackage{enumitem}\n\\\\ifPDFTeX\n  \\\\usepackage[utf8]{inputenc}\n  \\\\usepackage[T1]{fontenc}\n  \\\\usepackage{CJKutf8}\n  \\\\AtBeginDocument{\\\\begin{CJK*}{UTF8}{min}}\n  \\\\AtEndDocument{\\\\end{CJK*}}\n\\\\else\n  \\\\usepackage{fontspec}\n  \\\\ifLuaTeX\n    \\\\usepackage{luatexja}\n    \\\\usepackage{luatexja-fontspec}\n    \\\\IfFontExistsTF{Hiragino Sans}{\\\\setmainjfont{Hiragino Sans}}{\\\\IfFontExistsTF{Noto Sans CJK JP}{\\\\setmainjfont{Noto Sans CJK JP}}{}}\n  \\\\else\n    \\\\usepackage{xeCJK}\n    \\\\IfFontExistsTF{Hiragino Sans}{\\\\setCJKmainfont{Hiragino Sans}}{\\\\IfFontExistsTF{Noto Sans CJK JP}{\\\\setCJKmainfont{Noto Sans CJK JP}}{}}\n  \\\\fi\n\\\\fi',
E'\\\\begin{document}\n\\\\maketitle\n__CONTENT__\n\\\\end{document}',
E'以下の形式でLaTeXコードを出力してください：\n- 試験問題形式（定期テスト風）\n- 各問題に配点を明記（例: [10点]）\n- \\begin{enumerate} で問題を番号付きリストにする\n- 最後に「解答」セクションを設け、各問の解答・解説を記載\n- \\documentclass{article} から \\end{document} まで完全な文書として出力',
'{"format_type": "exam"}'),

-- 2) 学習プリント形式
('worksheet', '学習プリント', '演習用ワークシート（名前欄・日付欄付き）',
E'\\\\documentclass[12pt]{article}\n\\\\usepackage{iftex}\n\\\\usepackage{amsmath,amssymb,mathtools}\n\\\\usepackage{geometry}\n\\\\geometry{margin=0.75in}\n\\\\usepackage{enumitem}\n\\\\usepackage{ulem}\n\\\\ifPDFTeX\n  \\\\usepackage[utf8]{inputenc}\n  \\\\usepackage[T1]{fontenc}\n  \\\\usepackage{CJKutf8}\n  \\\\AtBeginDocument{\\\\begin{CJK*}{UTF8}{min}}\n  \\\\AtEndDocument{\\\\end{CJK*}}\n\\\\else\n  \\\\usepackage{fontspec}\n  \\\\ifLuaTeX\n    \\\\usepackage{luatexja}\n    \\\\usepackage{luatexja-fontspec}\n    \\\\IfFontExistsTF{Hiragino Sans}{\\\\setmainjfont{Hiragino Sans}}{\\\\IfFontExistsTF{Noto Sans CJK JP}{\\\\setmainjfont{Noto Sans CJK JP}}{}}\n  \\\\else\n    \\\\usepackage{xeCJK}\n    \\\\IfFontExistsTF{Hiragino Sans}{\\\\setCJKmainfont{Hiragino Sans}}{\\\\IfFontExistsTF{Noto Sans CJK JP}{\\\\setCJKmainfont{Noto Sans CJK JP}}{}}\n  \\\\fi\n\\\\fi',
E'\\\\begin{document}\n\\\\begin{flushright}\n名前：\\\\underline{\\\\hspace{5cm}} \\\\quad 日付：\\\\underline{\\\\hspace{3cm}}\n\\\\end{flushright}\n\\\\begin{center}{\\\\Large\\\\bfseries __TITLE__}\\\\end{center}\n\\\\vspace{1em}\n__CONTENT__\n\\\\end{document}',
E'以下の形式でLaTeXコードを出力してください：\n- 学習プリント形式（演習シート風）\n- 冒頭に名前欄・日付欄を配置\n- 問題は番号付きで、解答スペース（空行）を各問の後に設ける\n- 解答・解説は別ページに記載\n- \\documentclass{article} から \\end{document} まで完全な文書として出力',
'{"format_type": "worksheet"}'),

-- 3) 一問一答カード形式
('flashcard', '一問一答カード', 'フラッシュカード形式（問題と解答を交互に配置）',
E'\\\\documentclass[12pt]{article}\n\\\\usepackage{iftex}\n\\\\usepackage{amsmath,amssymb}\n\\\\usepackage{geometry}\n\\\\geometry{margin=0.5in}\n\\\\usepackage{array}\n\\\\usepackage{longtable}\n\\\\ifPDFTeX\n  \\\\usepackage[utf8]{inputenc}\n  \\\\usepackage[T1]{fontenc}\n  \\\\usepackage{CJKutf8}\n  \\\\AtBeginDocument{\\\\begin{CJK*}{UTF8}{min}}\n  \\\\AtEndDocument{\\\\end{CJK*}}\n\\\\else\n  \\\\usepackage{fontspec}\n  \\\\ifLuaTeX\n    \\\\usepackage{luatexja}\n    \\\\usepackage{luatexja-fontspec}\n    \\\\IfFontExistsTF{Hiragino Sans}{\\\\setmainjfont{Hiragino Sans}}{\\\\IfFontExistsTF{Noto Sans CJK JP}{\\\\setmainjfont{Noto Sans CJK JP}}{}}\n  \\\\else\n    \\\\usepackage{xeCJK}\n    \\\\IfFontExistsTF{Hiragino Sans}{\\\\setCJKmainfont{Hiragino Sans}}{\\\\IfFontExistsTF{Noto Sans CJK JP}{\\\\setCJKmainfont{Noto Sans CJK JP}}{}}\n  \\\\fi\n\\\\fi',
E'\\\\begin{document}\n\\\\begin{center}{\\\\Large\\\\bfseries __TITLE__}\\\\end{center}\n\\\\vspace{1em}\n__CONTENT__\n\\\\end{document}',
E'以下の形式でLaTeXコードを出力してください：\n- 一問一答カード形式\n- 2列の表で「問題」と「解答」を左右に並べる\n- longtable 環境を使い、\\hline で区切る\n- 短い問題と簡潔な解答のペアにする\n- \\documentclass{article} から \\end{document} まで完全な文書として出力',
'{"format_type": "flashcard"}'),

-- 4) 模試形式
('mock_exam', '模試', '模擬試験形式（制限時間・注意事項・大問構成）',
E'\\\\documentclass[12pt]{article}\n\\\\usepackage{iftex}\n\\\\usepackage{amsmath,amssymb,mathtools}\n\\\\usepackage{geometry}\n\\\\geometry{margin=1in}\n\\\\usepackage{fancyhdr}\n\\\\usepackage{enumitem}\n\\\\pagestyle{fancy}\n\\\\ifPDFTeX\n  \\\\usepackage[utf8]{inputenc}\n  \\\\usepackage[T1]{fontenc}\n  \\\\usepackage{CJKutf8}\n  \\\\AtBeginDocument{\\\\begin{CJK*}{UTF8}{min}}\n  \\\\AtEndDocument{\\\\end{CJK*}}\n\\\\else\n  \\\\usepackage{fontspec}\n  \\\\ifLuaTeX\n    \\\\usepackage{luatexja}\n    \\\\usepackage{luatexja-fontspec}\n    \\\\IfFontExistsTF{Hiragino Sans}{\\\\setmainjfont{Hiragino Sans}}{\\\\IfFontExistsTF{Noto Sans CJK JP}{\\\\setmainjfont{Noto Sans CJK JP}}{}}\n  \\\\else\n    \\\\usepackage{xeCJK}\n    \\\\IfFontExistsTF{Hiragino Sans}{\\\\setCJKmainfont{Hiragino Sans}}{\\\\IfFontExistsTF{Noto Sans CJK JP}{\\\\setCJKmainfont{Noto Sans CJK JP}}{}}\n  \\\\fi\n\\\\fi',
E'\\\\begin{document}\n\\\\begin{center}\n{\\\\LARGE\\\\bfseries __TITLE__}\n\\\\vspace{0.5em}\n\n{\\\\large 制限時間：＿＿分 \\\\quad 配点：100点}\n\\\\end{center}\n\\\\vspace{0.5em}\n\\\\noindent\\\\textbf{【注意事項】}\n\\\\begin{itemize}[nosep]\n\\\\item 解答はすべて解答欄に記入すること\n\\\\item 途中の計算過程も記述すること\n\\\\end{itemize}\n\\\\vspace{1em}\n__CONTENT__\n\\\\end{document}',
E'以下の形式でLaTeXコードを出力してください：\n- 模擬試験形式\n- 冒頭に試験タイトル・制限時間・配点を記載\n- 注意事項を箇条書きで記載\n- 大問（\\section*{第1問}等）と小問（\\begin{enumerate}）の構成\n- 各大問に配点を明記\n- 最後に解答・解説セクションを設ける\n- \\documentclass{article} から \\end{document} まで完全な文書として出力',
'{"format_type": "mock_exam"}'),

-- 5) レポート・解説形式
('report', 'レポート・解説', '解説重視のレポート形式（問題→解法→ポイント）',
E'\\\\documentclass[12pt]{article}\n\\\\usepackage{iftex}\n\\\\usepackage{amsmath,amssymb,mathtools}\n\\\\usepackage{geometry}\n\\\\geometry{margin=1in}\n\\\\usepackage{enumitem}\n\\\\ifPDFTeX\n  \\\\usepackage[utf8]{inputenc}\n  \\\\usepackage[T1]{fontenc}\n  \\\\usepackage{CJKutf8}\n  \\\\AtBeginDocument{\\\\begin{CJK*}{UTF8}{min}}\n  \\\\AtEndDocument{\\\\end{CJK*}}\n\\\\else\n  \\\\usepackage{fontspec}\n  \\\\ifLuaTeX\n    \\\\usepackage{luatexja}\n    \\\\usepackage{luatexja-fontspec}\n    \\\\IfFontExistsTF{Hiragino Sans}{\\\\setmainjfont{Hiragino Sans}}{\\\\IfFontExistsTF{Noto Sans CJK JP}{\\\\setmainjfont{Noto Sans CJK JP}}{}}\n  \\\\else\n    \\\\usepackage{xeCJK}\n    \\\\IfFontExistsTF{Hiragino Sans}{\\\\setCJKmainfont{Hiragino Sans}}{\\\\IfFontExistsTF{Noto Sans CJK JP}{\\\\setCJKmainfont{Noto Sans CJK JP}}{}}\n  \\\\fi\n\\\\fi',
E'\\\\begin{document}\n\\\\maketitle\n__CONTENT__\n\\\\end{document}',
E'以下の形式でLaTeXコードを出力してください：\n- レポート・解説形式\n- 各問題について「問題」→「解法」→「ポイント」の3部構成\n- 解法は途中の計算過程を詳しく記述\n- 「ポイント」では間違えやすい点や関連する公式をまとめる\n- \\section で問題ごとにセクション分け\n- \\documentclass{article} から \\end{document} まで完全な文書として出力',
'{"format_type": "report"}'),

-- 6) シンプル形式
('minimal', 'シンプル', '最小限のプレーンな形式',
E'\\\\documentclass[12pt]{article}\n\\\\usepackage{iftex}\n\\\\usepackage{amsmath,amssymb}\n\\\\usepackage{geometry}\n\\\\geometry{margin=1in}\n\\\\ifPDFTeX\n  \\\\usepackage[utf8]{inputenc}\n  \\\\usepackage[T1]{fontenc}\n  \\\\usepackage{CJKutf8}\n  \\\\AtBeginDocument{\\\\begin{CJK*}{UTF8}{min}}\n  \\\\AtEndDocument{\\\\end{CJK*}}\n\\\\else\n  \\\\usepackage{fontspec}\n  \\\\ifLuaTeX\n    \\\\usepackage{luatexja}\n    \\\\usepackage{luatexja-fontspec}\n    \\\\IfFontExistsTF{Hiragino Sans}{\\\\setmainjfont{Hiragino Sans}}{\\\\IfFontExistsTF{Noto Sans CJK JP}{\\\\setmainjfont{Noto Sans CJK JP}}{}}\n  \\\\else\n    \\\\usepackage{xeCJK}\n    \\\\IfFontExistsTF{Hiragino Sans}{\\\\setCJKmainfont{Hiragino Sans}}{\\\\IfFontExistsTF{Noto Sans CJK JP}{\\\\setCJKmainfont{Noto Sans CJK JP}}{}}\n  \\\\fi\n\\\\fi',
E'\\\\begin{document}\n__CONTENT__\n\\\\end{document}',
E'以下の形式でLaTeXコードを出力してください：\n- シンプルな形式（装飾なし）\n- 問題と解答をそのまま記述\n- \\documentclass{article} から \\end{document} まで完全な文書として出力',
'{"format_type": "minimal"}')

ON CONFLICT (id) DO NOTHING;
