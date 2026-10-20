# Mescla para RECUPERAÇÃO: base = banco do PC (tem os projetos); por cima, todas as linhas da VPS
# (VPS vence em conflito de id). Por desenho, linhas apagadas na VPS que ainda existem no PC voltam
# — é esse o objetivo (recuperar projetos apagados). Não usar como sincronização de rotina.
# Colunas por NOME (interseção dos dois esquemas): independe da ordem física das colunas.
import shutil
import sqlite3
import sys

pc, vps, out = sys.argv[1:4]
shutil.copy(pc, out)
c = sqlite3.connect(out)
c.execute("PRAGMA foreign_keys=OFF")
c.execute("ATTACH ? AS v", (vps,))


def colunas(schema: str, tabela: str) -> list[str]:
    return [r[1] for r in c.execute(f'PRAGMA {schema}.table_info("{tabela}")')]


tabs = [r[0] for r in c.execute(
    "select name from main.sqlite_master where type='table' and name not like 'sqlite%' and name!='_prisma_migrations'")]
vps_tabs = {r[0] for r in c.execute("select name from v.sqlite_master where type='table'")}
for t in tabs:
    if t not in vps_tabs:
        continue
    comuns = [col for col in colunas("main", t) if col in set(colunas("v", t))]
    if not comuns:
        continue
    lista = ", ".join(f'"{col}"' for col in comuns)
    c.execute(f'INSERT OR REPLACE INTO main."{t}" ({lista}) SELECT {lista} FROM v."{t}"')
c.commit()
c.execute("DETACH v")
integridade = c.execute("PRAGMA integrity_check").fetchone()[0]
violacoes = c.execute("PRAGMA foreign_key_check").fetchall()
print("integrity:", integridade)
print("fk_violations:", len(violacoes))
for t in sorted(tabs):
    print(t, c.execute(f'select count(*) from main."{t}"').fetchone()[0])
c.execute("PRAGMA journal_mode=DELETE")
c.close()
if integridade != "ok" or violacoes:
    sys.exit("Mesclagem reprovada na conferência: banco de produção NÃO foi trocado.")
