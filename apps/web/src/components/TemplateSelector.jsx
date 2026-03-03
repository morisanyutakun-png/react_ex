'use client';

import { useState } from 'react';
import { SelectField, NumberField, Button, MetaTag, Icons } from './ui';
import { SUBJECTS, SUBJECT_TOPICS, DIFFICULTIES, buildTemplatePrompt, buildTemplateId } from '@/lib/constants';
import { createTemplate } from '@/lib/api';

/**
 * テンプレート選択 + パラメータ入力 + 新規テンプレート追加
 */
export default function TemplateSelector({
  templates,
  selectedId,
  onSelectTemplate,
  subject,
  onSubjectChange,
  difficulty,
  onDifficultyChange,
  numQuestions,
  onNumQuestionsChange,
  field,
  onFieldChange,
  showFieldInput = false,
  showSubjectFilter = false,
  onRefresh,
  setStatus,
  allSubjects,
}) {
  const [showNewForm, setShowNewForm] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newField, setNewField] = useState('');
  const [newDifficulty, setNewDifficulty] = useState('標準');
  const [saving, setSaving] = useState(false);

  const subjects = allSubjects || SUBJECTS;

  const filteredTemplates =
    showSubjectFilter && subject
      ? templates.filter((t) => !t.metadata?.subject || t.metadata.subject === subject)
      : templates;

  const selectedTemplate = templates.find((t) => t.id === selectedId) || null;

  const handleSaveTemplate = async () => {
    const s =
      newSubject === '__custom'
        ? document.getElementById('newTplCustomSubject')?.value?.trim() || ''
        : newSubject;
    if (!s) {
      setStatus?.('教科を選択してください');
      return;
    }
    const f = newField.trim();
    const label = f ? `${s}（${f}）` : s;
    const name = `${label} テンプレート`;
    const id = buildTemplateId(s, f);
    const desc = `${label} の問題を生成するテンプレート（自動生成）`;
    const prompt = buildTemplatePrompt(s, f);
    const body = {
      id,
      name,
      description: desc,
      prompt,
      metadata: { subject: s, field: f || null, difficulty: newDifficulty, auto_generated: true },
    };
    setSaving(true);
    setStatus?.(`テンプレート「${label}」を保存中...`);
    try {
      await createTemplate(body);
      setStatus?.(`テンプレート「${label}」を作成しました`);
      await onRefresh?.();
      onSelectTemplate?.(id);
      onSubjectChange?.(s);
      if (f && onFieldChange) onFieldChange(f);
      setNewSubject('');
      setNewField('');
      setNewDifficulty('標準');
      setShowNewForm(false);
    } catch (e) {
      setStatus?.(`保存失敗: ${e.message}`);
    }
    setSaving(false);
  };

  const templateOptions = [
    { value: '', label: '-- テンプレートを選択 --' },
    ...filteredTemplates.map((t) => ({
      value: t.id,
      label: `${t.name || t.id}${t.metadata?.subject ? ` [${t.metadata.subject}]` : ''}${t.metadata?.field ? ` (${t.metadata.field})` : ''}`,
    })),
  ];

  return (
    <div>
      {/* パラメータ行 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-4">
        {showSubjectFilter && (
          <SelectField
            label="科目フィルタ"
            value={subject}
            onChange={(v) => {
              onSubjectChange(v);
              onSelectTemplate?.('');
            }}
            options={[{ value: '', label: '全て' }, ...subjects.map((s) => ({ value: s, label: s }))]}
          />
        )}

        <SelectField
          label="テンプレート"
          value={selectedId}
          onChange={(v) => onSelectTemplate(v)}
          options={templateOptions}
          className="col-span-2 sm:col-span-2"
        />

        {!showSubjectFilter && (
          <SelectField
            label="科目"
            value={subject}
            onChange={onSubjectChange}
            options={subjects.map((s) => ({ value: s, label: s }))}
          />
        )}

        <SelectField
          label="難易度"
          value={difficulty}
          onChange={onDifficultyChange}
          options={DIFFICULTIES.map((d) => ({ value: d.value, label: `${d.label}（${d.description}）` }))}
        />

        <NumberField
          label="問数"
          value={numQuestions}
          onChange={onNumQuestionsChange}
          min={1}
        />

        {showFieldInput && (
          <div>
            <label className="block text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-2">
              分野
            </label>
            <input
              list="field-suggestions"
              value={field || ''}
              onChange={(e) => onFieldChange?.(e.target.value)}
              className="w-full pl-4 pr-4 py-3 rounded-2xl border border-blue-200/50 bg-white text-[#1e293b] text-sm font-medium
                         transition-all duration-300 hover:border-blue-300/50 hover:bg-white hover:shadow-md
                         focus:border-blue-300/70 focus:ring-2 focus:ring-blue-200/40 focus:shadow-md
                         outline-none placeholder:text-[#c7c7cc] shadow-sm"
              placeholder={subject ? `${subject}の分野を選択 or 自由入力` : '先に教科を選択...'}
            />
            {subject && SUBJECT_TOPICS[subject] && (
              <datalist id="field-suggestions">
                {SUBJECT_TOPICS[subject].map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            )}
          </div>
        )}
      </div>

      {/* 選択中テンプレート情報 */}
      {selectedTemplate && (
        <div className="p-3 bg-blue-50/60 rounded-xl mb-4 border border-blue-200/50 ">
          <div className="text-sm font-semibold text-[#1e293b]">
            {selectedTemplate.name || selectedTemplate.id}
          </div>
          {selectedTemplate.description && (
            <div className="text-xs text-[#64748b] mt-0.5">{selectedTemplate.description}</div>
          )}
          <div className="flex gap-2 mt-2 flex-wrap">
            <MetaTag value={selectedTemplate.metadata?.subject} color="indigo" />
            <MetaTag value={selectedTemplate.metadata?.field} color="emerald" />
            <MetaTag value={selectedTemplate.metadata?.difficulty} color="amber" />
          </div>
        </div>
      )}

      {/* アクションボタン */}
      {showSubjectFilter && (
        <div className="flex gap-2 items-center">
          <Button
            variant={showNewForm ? 'danger' : 'success'}
            size="sm"
            onClick={() => setShowNewForm((v) => !v)}
          >
            {showNewForm ? (
              <><Icons.Error className="w-3.5 h-3.5" /> 閉じる</>
            ) : (
              <><Icons.Success className="w-3.5 h-3.5" /> 追加</>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await onRefresh?.();
              setStatus?.('再読み込み完了');
            }}
            title="テンプレートを再読込"
          >
            <Icons.Info className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* 新規テンプレートフォーム */}
      {showNewForm && (
        <div className="mt-4 p-6 border border-blue-300/50 rounded-xl bg-blue-50/60 backdrop-blur-sm ">
          <div className="text-[15px] font-bold text-[#1e293b] mb-4 tracking-tight">新しいテンプレート</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-1.5">教科 *</label>
              <select
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-blue-200/50 bg-white text-[#1e293b] text-sm input-ring focus:border-blue-300/70 focus:ring-2 focus:ring-blue-200/40"
              >
                <option value="">選択</option>
                {subjects.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
                <option value="__custom">その他</option>
              </select>
            </div>
            {newSubject === '__custom' && (
              <div>
                <label className="block text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-1.5">教科名</label>
                <input
                  id="newTplCustomSubject"
                  className="w-full px-3 py-2.5 rounded-xl border border-blue-200/50 bg-white text-[#1e293b] text-sm input-ring focus:border-blue-300/70 focus:ring-2 focus:ring-blue-200/40"
                  placeholder="例: 情報"
                />
              </div>
            )}
            <div>
              <label className="block text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-1.5">分野</label>
              <input
                list="new-tpl-field-suggestions"
                value={newField}
                onChange={(e) => setNewField(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-blue-200/50 bg-white text-[#1e293b] text-sm input-ring focus:border-blue-300/70 focus:ring-2 focus:ring-blue-200/40"
                placeholder={newSubject && newSubject !== '__custom' ? `${newSubject}の分野...` : '例: 微分積分'}
              />
              {newSubject && newSubject !== '__custom' && SUBJECT_TOPICS[newSubject] && (
                <datalist id="new-tpl-field-suggestions">
                  {SUBJECT_TOPICS[newSubject].map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              )}
            </div>
            <SelectField
              label="難易度"
              value={newDifficulty}
              onChange={setNewDifficulty}
              options={DIFFICULTIES.map((d) => ({ value: d.value, label: `${d.label}（${d.description}）` }))}
            />
            <Button variant="success" size="sm" onClick={handleSaveTemplate} disabled={saving || !newSubject}>
              {saving ? '保存中...' : '作成'}
            </Button>
          </div>
          <p className="mt-2 text-[#64748b] text-[11px]">
            教科＋分野を入力するだけ。テンプレート名・ID・本文は自動生成されます。
          </p>
        </div>
      )}
    </div>
  );
}