'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchTemplates as apiFetchTemplates } from '@/lib/api';
import { SUBJECTS } from '@/lib/constants';

/**
 * テンプレートの読み込みと科目リスト管理
 */
export function useTemplates() {
  const [templates, setTemplates] = useState([]);
  const [subjects, setSubjects] = useState([...SUBJECTS]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const tpls = await apiFetchTemplates();
      setTemplates(tpls);
      // テンプレートのメタデータから科目を追加
      const extraSubjects = new Set(SUBJECTS);
      tpls.forEach((t) => {
        if (t.metadata?.subject) extraSubjects.add(t.metadata.subject);
      });
      setSubjects(Array.from(extraSubjects));
    } catch (e) {
      console.warn('templates fetch failed', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { templates, subjects, loading, refresh };
}
