# Digest — Suplementos de Saga (fichas de PnJ) do Dragon Ball Tales

Fontes (fan-made, CC BY-NC-SA, Projeto RR / VLiscius e FNishiguchi): `Saga Saiyajins.pdf`, `ilide.info-saga-freeza-pr_….pdf`, `ilide.info-saga-super-heroes-pr_….pdf`, `ilide.info-saga-zero-humanos-pr_….pdf`, `ilide.info-broly-pr_….pdf`.
Saídas: `json/saga-npcs-<saga>.json` (fichas), `md/saga-<saga>-regras.md` (regra fora de ficha). Extração automática por `scripts_saga/parse_saga.py` sobre `txt/*.txt` (pdftotext -layout); não foi possível renderizar páginas (pdftoppm ausente), então nenhuma ficha foi conferida visualmente na extração. Em 02/11/2026, 6 fichas foram conferidas contra a página renderizada (PyMuPDF); ver §5.

## 1. Contagem por saga

| Saga (chave) | NPCs | Técnicas | Transformações | Passivas/Ativas | Categoria × Rank |
|---|---|---|---|---|---|
| saiyajins | 11 | 80 (74 of. + 2 barreiras + 4 especiais) | 0 | 6 | Chefão D 1 · Elite D 4 · Elite C 1 · Comum D 3 · Comum C 2 |
| freeza (Saga Namekusei + Forças Especiais Ginyu) | 11 | 59 (52 + 2 + 5) | 1 | 7 | Chefão C 2 · Elite B 1 · Elite C 1 · Comum A 1 · Comum B 2 · Comum C 4 |
| super-heroes | 4 | 38 (36 + 2) | 5 | 7 | Chefão Z 2 · Elite Z 2 |
| zero-humanos | 7 | 122 (91 + 6 + 25) | 22 | 28 | Chefão A 5 · Chefão B 1 · Elite Z 1 |
| broly | 1 | 16 (15 + 1) | 3 | 9 | Chefão Z 1 |
| **Total** | **34** | **315** | **31** | **57** | |

NPCs: Saiyajins — Son Goku, Piccolo, Son Gohan, Kuririn, Tien Shinhan, Chiaotzu, Yamcha, Saibaman, Raditz, Nappa, Vegeta. Freeza — Goku SSJ, Vegeta, Kuririn, Piccolo, Freeza, Zarbon, Dodoria, Rikum, Gurdo, Burter, Capitão Ginyu. Super Hero — Beast Gohan, Piccolo, Gammas, Cell Max. Zero Humanos — Zamasu (Goku/Black), Zamasu (Futuro), Zamasu (Fusão), Goku SSJ Deus, Vegeta, Vegetto, Mirai Trunks. Broly — Broly, o Lendário Super Saiyajin.

Conferência automática: o número de linhas `[Nome – Rank]:` no texto bate com o número de técnicas extraídas em todos os arquivos (Broly: 18 no texto, 16 na ficha; as 2 sobrando são rótulos da regra de raça, nas págs. 5–6, e estão no `.md`). Passivas `(Passiva|Ativa|Ação|Reação):` e transformações `[EP: …]` também batem (Broly: 3 dos 6 `[EP:` estão na regra de raça).

## 2. Formato do bloco de estatísticas

```
<Nome> – <Saga>                    (Ginyu Force: "– Forças Especiais Ginyu"; Broly sem saga)
ND ( ) – <Categoria> Rank <R>      (Gohan Saiyajin: "Comum D", sem a palavra Rank)
FOR: 14 (+2) … PRE: 13 (+1)        7 atributos, valor (mod)
PV: ---   PK: 28   CA: 15   VEL: 9,0m   EP: 02
[citação opcional]                 (só Zamasu Fusão)
TÉCNICAS OFENSIVAS – <nome>
TÉCNICAS ESPECIAIS – <nome>        (opcional)
TRANSFORMAÇÕES – <nome>            (opcional)
PASSIVAS E ATIVAS ÚNICAS [DO PERSONAGEM] – <nome>   (Burter: "ATIVAS E PASSIVAS DO PERSONAGEM")
```

| Sigla | Significado | Na ficha de jogador (Livro do Jogador 3.0.x / Narrador 4.0) |
|---|---|---|
| ND ( ) | Nível de Desafio — sempre em branco. O aviso de cada suplemento diz que o Narrador ajusta conforme a mesa (1x1, 1x5…) | Não existe para jogador. No Narrador 4.0.2: ND = nº de golpes daquele Rank que o PnJ aguenta; notação "ND N – Rank X (Categoria)" |
| Categoria | Comum / Elite / Chefão | Só PnJ. Define a tabela de vida por golpe e o teto de atributos (Narrador 4.0.4) |
| Rank | Rank de técnica usado para a vida por golpe (E, D, C, B, A, Z) | Mesmos ranks das técnicas do jogador |
| FOR DES CON INT POD SAB PRE | Força, Destreza, Constituição, Inteligência, Poder, Sabedoria, Presença | Iguais. Mod = (valor−10)/2 truncado para zero (09 → +0; 06 → −2) |
| PV | Pontos de Vida — sempre "---" | Jogador: CON×5 + pontos de raça. PnJ: **PV = ND × vida por golpe[Categoria][Rank]** (Comum D=26, Elite D=32, Chefão Z=234…), por isso fica vazio |
| PK | Pontos de Ki | Jogador: POD×2, +1 a cada 10.000 PDL. Nas sagas, os Comuns/Elites batem com POD×2; Chefões ficam acima (ex.: Freeza 46 vs 38) |
| CA | Classe de Armadura | 10 + mod DES + Escala de Poder **Base**. Bate em 30 de 34 fichas |
| VEL | Deslocamento — 9,0m em todas as 34 | Igual |
| EP | Escala de Poder (base) | Igual. Transformações somam "EP bônus" (`[EP: +0N]`), que não entra na CA |
| Técnica `[Nome – Rank]` | `[Dano: min-méd-máx]` ou `[Mitigação: …]` ou `[Cura: …]`, `[Ki: custo]`, `Alcance`, `Rótulos Positivos (pontos)`, `Rótulos Negativos (pontos)` | Mesmo formato das técnicas criadas pelo jogador (Livro do Jogador cap. 6). O aviso de cada suplemento afirma que as técnicas ofensivas seguem 100% essas regras |
| Transformação `Nome – Estágio N:` | texto + `[EP: +N] [KI: custo]` | Mesmo formato das transformações de raça do jogador |
| Passiva/Ativa `Nome (Passiva):` | habilidade única do personagem | Sem equivalente fixo na ficha do jogador (Narrador 4.0.5–4.0.6: "mecânicas personalizadas são bem-vindas") |

Não aparece em nenhuma ficha: Perícias, Talentos, PDL, Slots de Técnica (Narrador 4.0.5: "PnJ's não seguem a regra de Slot's de Técnica"), inventário. No JSON, `pericias` e `talentos` ficam `[]`.

### Campos do JSON (por NPC)
`nome, saga, titulo_ficha, nd, categoria, rank, categoria_rank_verbatim, atributos{FOR..PRE:{valor,mod}}, PV, PK, CA, VEL, EP, pericias[], tecnicas[], transformacoes[], talentos[], passivas_ativas[], outros[], pagina (PDF), pagina_impressa, arquivo`.
Técnica: `nome, tipo (Ofensiva | Ofensiva (reacao defensiva) | Especial), rank, custo, dano, mitigacao, cura, campos_colchete[[chave,valor]…], alcance, rotulos_positivos{pontos,lista}, rotulos_negativos{pontos,lista}, descricao, efeito (texto integral), pagina`.
Transformação: `nome, estagio, ep, custo_ki, efeitos (integral), pagina`. Passiva: `nome, tipo, texto, pagina`. `outros`: texto que não cabe em entrada (citação do Zamasu Fusão, introdução e linha "Todas as Presentes nos dois Personagens…" do Vegetto).

## 3. O que difere da ficha de jogador

- **Ranks de técnica fora da tabela**: `Variável` (Kikōhō, Tien), `Fusão` (Final Kamehameha, Vegetto), `Fusão Potara` (Halo Divino, Zamasu Fusão) e menção a **"Rank God"** (passiva Acesso ao Ki Divino: sem limite de rótulos positivos nem de Ki; os negativos continuam valendo).
- **Técnicas Especiais** sem dano tabelado (Kaio-Ken com multiplicadores de custo extra +02/+04/+06 Ki e 3 desvantagens; Genki-dama com dano 1d20 × Escala do planeta; Telecinese; Troca de Corpo; Espada da Esperança). Pelo Narrador 3.2.1, técnica especial ofensiva não é criável por jogador.
- **Barreiras de Ki** (Mitigação) aparecem dentro de TÉCNICAS OFENSIVAS; marquei como `Ofensiva (reacao defensiva)`.
- **Curas do Kaioh** (Zamasu Futuro/Fusão) usam `[Cura: x-y-z]` no lugar de Dano.
- **Ki Divino / Super Saiyajin Rosé**: a EP do estágio 5 conta como Escala **Base**, não bônus (muda a CA).
- **Vegetto** é declarado "Ficha Exemplificativa Sistemática" de fusão Potara: herda todas as técnicas de Goku e Vegeta e lista só as novas.
- **Regra de raça fora de ficha** (nos `.md`): Saibaman como raça jogável (Saiyajins, cap. II, PDF 36–38; lore em 34–36 omitida); Androides e Androide Gamma (Super Hero, cap. II, PDF 22–23); Saiyajin Lendário com 10 "Rótulos Lendários" e 3 estágios de transformação (Broly, PDF 5–8; o conto "A Lenda" em 4–5 foi omitido). Freeza e Zero Humanos não têm capítulo de regra.

## 4. Inconsistências da fonte (mantidas como estão no texto)

- Mod fora da fórmula: Gohan (Saiyajins) SAB 10 (+2) e PRE 13 (+2); Raditz CON 14 (+1); Cell Max INT 18 (+5); Vegetto FOR 24 (+6).
- PK do Vegetto = 345 (POD 26 → 52 base; parece erro de digitação ou soma de fusão). Zamasu Futuro PK 30 < POD×2 = 40.
- CA abaixo de 10+DES+EP: Goku (Namekusei) 15 vs 16; Yamcha, Rikum e Gurdo 10 vs 11.
- "Rótulos Positivos (N)" nem sempre fecha com a soma dos rótulos listados (o número entre parênteses parece ser o teto do rank). O parser guarda o número e a lista sem recalcular.
- Grafias do original mantidas (Saiayjin, Contudente, otpar, esquivalente).

## 5. Conferência visual (02/11/2026)

Páginas renderizadas com PyMuPDF (110 dpi) e lidas como imagem; comparadas campo a campo com o JSON da fonte e com `client/src/lib/dbt/dados/npcsProntosDados.ts`: categoria/rank, 7 atributos com mod, PV, PK, CA, VEL, EP, técnicas (nome, rank, faixa de dano/mitigação, Ki, alcance, pontos e lista de rótulos), transformações (estágio, EP, Ki) e passivas. As fichas não têm PDL nem ND preenchida (ND sempre "( )", PV sempre "---").

| Ficha | Páginas do PDF (impressa) | Resultado |
|---|---|---|
| Nappa (Saiyajins) | 27–28 (26–27) | bate |
| Freeza, o Imperador do Universo (Freeza) | 17–20 (16–19) | bate |
| Cell Max (Super Hero) | 18–20 (17–19) | bate |
| Vegetto (Zero Humanos) | 48–55 (47–54) | **corrigido**: Final Kamehameha tinha `rotulos_positivos`/`rotulos_negativos` = null; o PDF lista os rótulos com "(?)" no lugar dos pontos e o parser não reconheceu. Agora `pontos: null` + lista. O gerador passou a tirar a linha "Rótulos … (?):" do `efeito` |
| Broly, o Lendário Super Saiyajin (Broly) | 9–13 (8–12) | bate |
| Gorudan (Enma Daioh) | 13–16 (12–15) | bate |

Erro de transcrição em 1 de 6 fichas (abaixo do limite de 2 que pediria outra amostra). Varredura nos 6 JSONs de NPC: o caso "(?)" só ocorre no Final Kamehameha.

Confirmado na imagem (era só texto extraído): Vegetto PK 345 e FOR 24 (+6); Cell Max INT 18 (+5); Broly FOR 24 (+7). Página do PDF = impressa + 1 nos 5 suplementos de saga e no Enma Daioh (Gorudan: impressa 12 = PDF 13), o que confirma a nota "provavelmente impressa+1" de `nar-npcs-enma.json`.

### PDF ambíguo (dado mantido como está)

- **Final Kamehameha** (Vegetto, PDF 48): "Rótulos Positivos (?)" e "Rótulos Negativos (?)" — o próprio original não dá os pontos (rank "Fusão"). Pontos ficam `null`.
- **Spirit Sword** (Vegetto, PDF 53): sem etiqueta `[Ki: …]`; o texto diz que o Ki e o dano dependem do rank escolhido ao invocar (ex.: 44 de dano = Rank B = 08 Ki). Custo fica `null`.
- **Kaio-Ken** (Vegetto, PDF 49): `[KI: 06 ~ 12]` é uma faixa, mais `+02/+04/+06` por multiplicador; o custo fica como texto "06 ~ 12".
- **Gorudan** (Enma, PDF 15): as duas técnicas especiais têm o mesmo cabeçalho "Correntes do Juiz Supremo – Enma no Kusari – A" (Ki 14 e Ki 10); a segunda descreve a "Mão do Julgamento de Enma Daioh". Mantido, já anotado em `outros`.
- **Página das técnicas**: nas sagas, `pagina` da técnica é a página do PDF (Nappa, Esfera de Ki: 27), mas a `pagina` da ficha gerada é a impressa (26). No Enma as duas são a impressa. Não é erro do PDF; fica registrado para quem mostrar o número de página.
