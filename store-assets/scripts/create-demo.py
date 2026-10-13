"""Build a disposable demo DB from the installed app's migrated schema.

Usage: python3 create-demo.py /tmp/original.db /tmp/demo.db
Copies schema and migration bookkeeping only; never copies academic data.
"""
import datetime as dt
import json
from pathlib import Path
import sqlite3
import sys
import uuid

source, destination = map(Path, sys.argv[1:3])
if destination.exists():
    raise SystemExit("Refusing to overwrite an existing demo database")
original = sqlite3.connect(source)
db = sqlite3.connect(destination)
objects = original.execute("SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END").fetchall()
for kind, name, sql in objects:
    db.execute(sql)
for row in original.execute('SELECT * FROM __drizzle_migrations'):
    db.execute('INSERT INTO __drizzle_migrations VALUES (?,?,?)', row)
db.execute('PRAGMA foreign_keys=ON')
uid = lambda name: str(uuid.uuid5(uuid.NAMESPACE_URL, 'bunkbuddy-demo/' + name))
today = dt.date(2026, 10, 12)
start, end = dt.date(2026, 8, 3), dt.date(2026, 12, 18)
now = int(dt.datetime(2026, 10, 12, 4, 11, tzinfo=dt.timezone.utc).timestamp() * 1000)
def insert(table, **row):
    db.execute(f'INSERT INTO "{table}" ({",".join(row)}) VALUES ({",".join("?" for _ in row)})', list(row.values()))
def entity(table, key, **row):
    insert(table, id=uid(key), created_at=now, updated_at=now, revision=1, **row)
sem, version, lecture = uid('semester'), uid('version'), uid('lecture')
entity('semesters', 'semester', name='Autumn semester', starts_on=str(start), ends_on=str(end), timezone='Asia/Kolkata', week_anchor=str(start), target_bps=7500)
entity('class_types', 'lecture', semester_id=sem, name='Lecture', normalized_name='lecture', default_counts_as=1)
entity('timetable_versions', 'version', semester_id=sem, label='Autumn timetable', effective_from=str(start))
names = ['Applied Logic', 'Creative Systems', 'Data Patterns', 'Digital Worlds', 'Visual Thinking', 'World of Numbers']
colors = ['#2F5276', '#2A6863', '#644C86', '#94485A', '#2B5E9C', '#2F5276']
slots = []
for i, name in enumerate(names):
    entity('subjects', f'subject-{i}', semester_id=sem, name=name, normalized_name=name.lower(), code=f'ST{101+i}', color=colors[i], credits=3, sort_order=i)
for day in range(1, 6):
    for period, i in enumerate(([0, 1, 2, 3] if day == 1 else [(day+offset-1) % 6 for offset in range(4)])):
        minute = [540, 610, 710, 780][period]
        key = f'slot-{day}-{period}'
        entity('timetable_slots', key, semester_id=sem, version_id=version, subject_id=uid(f'subject-{i}'), class_type_id=lecture, weekday=day, parity='all', start_minute=minute, end_minute=minute+50, room=f'Room {201+period}', counts_as=1)
        slots.append((key, day, i, minute, period))
counts = [0]*6
absent_indices = [{5, 11, 17, 23}, {3, 7, 11, 15, 19, 23, 27}, {2, 5, 9, 12, 16, 20, 23, 27}, {4, 12, 20, 28}, {5, 14, 23, 32}, {6, 16, 26}]
date = start
while date <= today:
    for key, day, i, minute, period in slots:
        if date.isoweekday() != day:
            continue
        # Keep two of today's classes unmarked to show the daily workflow.
        if date == today and period >= 2:
            continue
        counts[i] += 1
        absent = counts[i] in absent_indices[i]
        entity('attendance_records', f'mark-{key}-{date}', semester_id=sem, subject_id=uid(f'subject-{i}'), on_date=str(date), kind='occurrence', occurrence_key=f'slot:{uid(key)}:{date}', slot_id=uid(key), class_type_id=lecture, class_type_name='Lecture', start_minute=minute, end_minute=minute+50, room=f'Room {201+period}', counts_as=1, status='absent' if absent else 'present', attended_delta=0 if absent else 1, held_delta=1, source='manual')
    date += dt.timedelta(days=1)
entity('class_notes', 'note-today', semester_id=sem, subject_id=uid('subject-0'), on_date=str(today), occurrence_key=f'slot:{uid("slot-1-0")}:{today}', body='Review truth tables before the next class.')
preferences = {'activeSemesterId':sem, 'onboardingVersion':1, 'theme':'light', 'accent':'indigo', 'subjectSort':'name', 'backupPreferences':{'weekly':True,'includeFiles':False}, 'backupState':{'lastSuccess':0,'error':''}, 'hapticsEnabled':False}
for key, value in preferences.items():
    insert('settings', key=key, value=json.dumps(value), updated_at=now, revision=1)
assert db.execute('PRAGMA foreign_key_check').fetchall() == []
assert db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
db.commit()
for name, a, h in db.execute('SELECT s.name,SUM(a.attended_delta),SUM(a.held_delta) FROM subjects s JOIN attendance_records a ON a.subject_id=s.id GROUP BY s.id ORDER BY s.sort_order'):
    print(f'{name}: {a}/{h} ({100*a/h:.1f}%)')
db.close()
