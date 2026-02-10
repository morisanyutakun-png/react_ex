import json
from backend.db import connect_db


def backfill():
    conn = connect_db()
    cur = conn.cursor()
    # fetch id and normalized_json
    cur.execute("SELECT id, normalized_json FROM problems")
    rows = cur.fetchall()
    updated = 0
    for r in rows:
        pid = r[0]
        nj = r[1]
        if not nj:
            continue
        try:
            parsed = json.loads(nj)
        except Exception:
            continue
        prob = parsed.get('problem') if isinstance(parsed, dict) else None
        if not prob:
            continue
        updates = {}
        if 'final_answer' in prob and prob.get('final_answer') is not None:
            updates['final_answer_text'] = str(prob.get('final_answer'))
            try:
                if isinstance(prob.get('final_answer'), (int, float)):
                    updates['final_answer_numeric'] = float(prob.get('final_answer'))
            except Exception:
                pass
        if 'checks' in prob and prob.get('checks') is not None:
            updates['checks_json'] = json.dumps(prob.get('checks'), ensure_ascii=False)
        if 'assumptions' in prob and prob.get('assumptions') is not None:
            updates['assumptions_json'] = json.dumps(prob.get('assumptions'), ensure_ascii=False)
        if 'selected_reference' in prob and prob.get('selected_reference') is not None:
            updates['selected_reference_json'] = json.dumps(prob.get('selected_reference'), ensure_ascii=False)
        if 'solvable' in parsed and parsed.get('solvable') is not None:
            updates['solvable'] = 1 if parsed.get('solvable') else 0
        if updates:
            # build SET clause
            cols = ', '.join([f"{k} = %s" for k in updates.keys()])
            vals = list(updates.values())
            vals.append(pid)
            try:
                cur.execute(f"UPDATE problems SET {cols} WHERE id = %s", vals)
                updated += 1
            except Exception:
                # ignore update errors
                pass
    conn.commit()
    cur.close()
    conn.close()
    print('Backfilled rows:', updated)


if __name__ == '__main__':
    backfill()
