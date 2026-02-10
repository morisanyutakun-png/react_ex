"""Normalize `stem` values in the problems table to make them more human/readable.

Modes:
  --dry-run (default): report suggested changes without applying
  --apply: perform updates (creates a CSV backup `data/stem_normalization_backup.csv`)

Heuristics:
 - If stem looks like JSON blob (starts with '{' or contains 'schema_version' or 'request_id'), replace it with normalized_json->problem->stem if present, else with normalized_text, else skip.
 - Trim very long stems (>2000 chars) to first sentence-ish snippet.
"""
import argparse
import csv
import json
import re
from backend.db import connect_db


def extract_from_blob(normalized_json):
    try:
        parsed = json.loads(normalized_json)
        if isinstance(parsed, dict):
            prob = parsed.get('problem') or parsed
            s = prob.get('stem') or prob.get('normalized_text')
            if s:
                return s
    except Exception:
        return None
    return None


def shortify(s: str, maxlen=400):
    if not s:
        return s
    s = s.strip()
    if len(s) <= maxlen:
        return s
    # attempt to cut at sentence boundary
    m = re.search(r'(.{200,400}?)[\n。.]', s)
    if m:
        return m.group(1).strip() + '...'
    return s[:maxlen].strip() + '...'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--limit', type=int, default=1000)
    args = parser.parse_args()

    conn = connect_db(None)
    cur = conn.cursor()
    cur.execute('SELECT id, stem, normalized_json, normalized_text FROM problems ORDER BY id LIMIT %s', (args.limit,))
    rows = cur.fetchall()

    changes = []
    for r in rows:
        pid = r[0]
        stem = r[1] or ''
        norm_json = r[2]
        norm_text = r[3] or ''
        suggestion = None
        if not stem:
            # if empty stem, try to fill from normalized_text
            if norm_text:
                suggestion = shortify(norm_text)
        elif stem.strip().startswith('{') or 'schema_version' in stem or 'request_id' in stem:
            # extract from normalized_json preferentially
            candidate = None
            if norm_json:
                candidate = extract_from_blob(norm_json)
            if not candidate and norm_text:
                candidate = norm_text
            if candidate:
                suggestion = shortify(candidate)
        elif len(stem) > 2000:
            suggestion = shortify(stem)

        if suggestion and suggestion != stem:
            changes.append((pid, stem, suggestion))

    if not changes:
        print('No suggested changes')
        cur.close()
        conn.close()
        return

    print(f'Found {len(changes)} candidate changes (limit {args.limit})')
    for pid, old, new in changes[:20]:
        print(pid, 'OLD_LEN=', len(old), 'NEW_LEN=', len(new), 'NEW_SNIPPET=', new[:120])

    if args.apply:
        # backup CSV
        with open('data/stem_normalization_backup.csv', 'w', encoding='utf-8', newline='') as f:
            w = csv.writer(f)
            w.writerow(['id', 'old_stem', 'new_stem'])
            for pid, old, new in changes:
                w.writerow([pid, old, new])
        # apply
        for pid, old, new in changes:
            cur.execute('UPDATE problems SET stem = %s WHERE id = %s', (new, pid))
        conn.commit()
        print('Applied changes and wrote backup to data/stem_normalization_backup.csv')
    else:
        print('Dry run (no changes applied). Use --apply to apply suggested updates.')

    cur.close()
    conn.close()


if __name__ == '__main__':
    main()
