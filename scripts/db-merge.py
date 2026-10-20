# Mescla: base = banco do PC (tem os projetos); por cima, todas as linhas da VPS (VPS vence em conflito).
import shutil
import sqlite3
import sys

pc, vps, out = sys.argv[1:4]
shutil.copy(pc, out)
c = sqlite3.connect(out)
c.execute("PRAGMA foreign_keys=OFF")
c.execute("ATTACH ? AS v", (vps,))
tabs = [r[0] for r in c.execute(
    "select name from main.sqlite_master where type='table' and name not like 'sqlite%' and name!='_prisma_migrations'")]
for t in tabs:
    c.execute(f'INSERT OR REPLACE INTO main."{t}" SELECT * FROM v."{t}"')
c.commit()
c.execute("DETACH v")
print("integrity:", c.execute("PRAGMA integrity_check").fetchone()[0])
print("fk_violations:", len(c.execute("PRAGMA foreign_key_check").fetchall()))
for t in sorted(tabs):
    print(t, c.execute(f'select count(*) from main."{t}"').fetchone()[0])
c.execute("PRAGMA journal_mode=DELETE")
c.close()
