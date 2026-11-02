# Digest mecânico — Livro do Jogador V0.5, Cap. I–III (p. 5–55)

Escopo: Introdução, Atributos (2.0–2.3), Criação (3.0), Raças (4.0–4.7), Talentos e Movimentos Marciais (5.0–5.2).
Páginas = numeração impressa (PDF = impressa + 1). Transcrição completa em `md/j1-*.md`; catálogos em `json/j1-*.json`.
Fora do escopo, mas citado aqui: estágios de dano das técnicas, rótulos, Exaustão de Ki, perícias (cap. IV/V).

## 1. Atributos primários (p. 6–7)

| Id | Nome | Usa o quê | Afeta |
|---|---|---|---|
| FOR | Força | modificador | acerto de técnicas **físicas**; capacidade de carga (cada +1 de mod. = espaços extras) |
| DES | Destreza | modificador | **CA** |
| CON | Constituição | **valor** | **PV** (CON × 5) |
| INT | Inteligência | modificador | acerto de técnicas **de Ki**; uso científico em algumas raças |
| SAB | Sabedoria | modificador | **Slots de Técnica** |
| POD | Poder | **valor** | **PK** (POD × 2) |
| PRE | Presença | modificador | carisma/intimidação/persuasão; acerto de técnicas mágicas/espirituais |

- **Modificador** (p. 6): 8 → −1, 10 → +0, 12 → +1, 14 → +2 "e assim por diante". Fórmula que bate com os exemplos: `mod = floor((valor − 10) / 2)`. O texto diz "a cada número acima disso, +1", o que contradiz os exemplos; use a fórmula dos exemplos.
- O modificador entra em **rolagens com o atributo** (testes e acertos).

## 2. Criação do personagem, passo a passo (3.0, p. 12–14)

1. **Raça** (e variante) — define vida extra por 10.000 PDL, traços, características especiais e transformações (3.0.1).
2. **Atributos (compra de pontos)**: todos começam em **8**; distribuir **28 pontos**, **1:1**, **sem limite inicial** (3.0.2). Não há dados na criação.
3. **PDL e EP iniciais**: definidos pela campanha. "Um personagem começa no mínimo com 10,000 PDL, mas é possível começar com menos". Exemplos: Clássico = PDL 0 / EP 0; Saga Saiyajin = 10.000–20.000 PDL e EP Base 1. **Recomendado: EP 1** (3.0.2).
4. Calcular **PV, PK, CA, ST** (fórmulas abaixo).
5. **5 perícias** à escolha, permanentes (3.0.7).
6. **3 Talentos/Movimentos Marciais** grátis, mistura livre (3.0.7 e 5.0). Depois, +1 a cada 20.000 PDL.
7. Alinhar com o Mestre (itens iniciais, EP base inicial) (3.0.8); criar técnicas (cap. IV) (3.0.9); história (3.0.10).
8. Se o PDL inicial já passa de marcos, aplicar os marcos (seção 4).

## 3. Fórmulas dos secundários

| Estat. | Fórmula | Página |
|---|---|---|
| **PV** | `CON × 5 + vidaRaça + vidaRaça × floor(PDL / 10.000)` | 8, 12–13 |
| **PK** | `POD × 2 + floor(PDL / 10.000)` | 8, 13 |
| **CA** | `10 + mod(DES) + EP_base` (EP de transformação **não** soma) | 13 |
| **ST** | `20 + (1 + mod(SAB)) × 5 + 2 × floor(PDL / 10.000)` | 8, 13 |
| **ST (Humano Marcial)** | `20 + (1 + mod(SAB)) × 10 + 2 × floor(PDL / 10.000)` | 33 |
| **EP_base** | `EP_inicial + floor(PDL / 40.000)` | 9, 13 |
| **EP_total** | `EP_base + EP de transformação ativa` | 9 |
| **Bônus de EP** | `+EP_total` em **todas** as rolagens (2.3.1) | 9 |

Exemplos oficiais: CON 12 + raça 12 → 60 + 12 = **72 PV**; aos 10.000 PDL → **84 PV** (p. 13). POD 14 → **28 PK** (p. 13). Atributo 8 em SAB → mod −1 → ST = 20 + 0 × 5 = **20**.

**Vida extra por raça** (a cada 10.000 PDL base; também é a "Pontuação de Raça" somada no PDL 0):

| Raça | +PV | Página |
|---|---|---|
| Androide | 10 | 17 |
| Freeza Clan | 14 | 19 |
| Majin | 12 | 20 |
| Namekuseijin | 10 | 22 |
| Saiyajin | 12 | 25 |
| Glind | 8 | 28 |
| Terráqueo | 6 | 33 |

Nenhuma raça dá bônus direto de atributo.

## 4. Marcos de PDL (3.0.11, p. 14)

| A cada | Ganho |
|---|---|
| 10.000 PDL | +vida da raça, **+1 PK**, **+2 ST** |
| 20.000 PDL | +1 Talento **ou** Movimento Marcial (Humano Marcial: +1 Movimento Marcial grátis extra) |
| 30.000 PDL | +2 em um atributo **ou** +1 em dois |
| 40.000 PDL | +1 EP base |

Observação: o aumento de atributo **não** altera PV/PK pelos marcos já passados; recalcule a fórmula inteira (CON×5 e POD×2 usam o valor atual).

## 5. Acerto e dano contra CA (2.2.4, 2.3.3; p. 8, 10)

- Margem = resultado do ataque − CA do alvo. Sem diferença de EP: margem ≤ 0 → **erra**; 1–2 → **mínimo (1/4 do dano)**; 3–5 → **médio (1/2)**; 6+ → **completo (dano total)**.
- Atacante com EP maior: cada nível desloca as faixas em −1. Tabela oficial (margem mínima por estágio):

| Dif. EP | Mínimo | Médio | Completo |
|---|---|---|---|
| −1 | 1 | 2 a 4 | 5+ |
| −2 | 0 | 1 a 3 | 4+ |
| −3 | −1 | 0 a 2 | 3+ |
| −4 | −2 | −1 a 1 | 2+ |
| −5 | −3 | −2 a −1 | 0+ |
| −6 | −4 | −3 a −2 | −1+ |
| −7 | −5 | −4 a −3 | −2+ |
| −8 | −6 | −5 a −4 | −3+ |
| −9 | −7 | −6 a −5 | −4+ |
| −10 | −8 | −7 a −6 | −5+ |

- **Penalidade de acerto** (2.3.2): atacante com EP menor sofre −1 por nível de diferença nas rolagens de ataque.
- **Bônus passivo** (2.3.1): +EP em todas as rolagens (as duas regras se somam; o livro não diz se elas se anulam).
- **Vitória automática** (2.3.4): se EP_maior ≥ 2 × EP_menor, vence automaticamente (exemplos: 10 vs 5; 3 vs 1).

## 6. O que a ficha precisa mostrar

- Identidade: nome, raça, **variante**, PDL, EP base, EP bônus (transformação ativa), EP total.
- 7 atributos com **valor e modificador**; pontos de compra usados (28) e pontos de marco (30k) usados.
- **PV** (máximo/atual; temporários, ex.: Ōzaru), **PK** (máx/atual; negativo para Androide Ilimitado), **CA**, **ST** (total/usados por técnicas ativas).
- Bônus de EP em rolagens; vida extra da raça; próximos marcos de PDL.
- 5 perícias; talentos e movimentos marciais (3 + 1 a cada 20k; Humano Marcial +1 movimento na criação e +1 a cada 20k).
- Traços raciais, características especiais e transformações (EP + custo de KI).
- Técnicas conhecidas × ativas (troca só após descanso longo).
- Contadores de combate: acúmulo de Raça Guerreira, carga de Zenkai usada, Duro de Matar/Forma Alternativa, absorções do Majin (máx. = EP base), cargas comprimidas, posturas ativas.

## 7. Raças: o que mexe na ficha e no combate

| Raça / variante | Mecânica com número |
|---|---|
| Androide Ilimitado | Em 0 PK pode ir ao **negativo até −PK total**, rolagens com desvantagem; ao bater o limite fica atordoado até o fim da próxima rodada e **perde a CA**; imune à Exaustão de Ki |
| Androide Absorvente | Agarrar drena **10% do PK total do alvo por turno**; ao sofrer técnica de energia recupera **metade do Ki gasto** pelo inimigo (até o máximo) |
| Ciborgue | Imune a efeitos negativos que não destruam/imobilizem o corpo |
| Bio-Androide | Até **3 características raciais** (não especiais); cada extra: **−2 em dois atributos** (cumulativo) |
| Freeza Clan | **Duro de Matar**: luta até **−metade da vida total**, com desvantagem e alvo de vantagem; **metade dos ST** para aprender golpes; Forma Alternativa: PV pela metade e atributos redistribuídos ≤ forma verdadeira |
| Majin | Fim de rodada regenera **metade do maior dano individual** da rodada; morre só com dano negativo = vida total em 0 PV; troca de atributo custa **Ki = modificador trocado**; alcance de toque **6 m** (+1,5 m por 1 PK); absorção: máx. = **EP base** |
| Namek Guerreiro | Estica **+6 m por 1 PK**, +1,5 m por PK extra; regeneração custa o Ki que o inimigo gastou |
| Namek Dragão | Ganha o talento Mago de Ki; nº de desejos = **EP base / 2 (mín. 1)** |
| Saiyajin Puro | **Zenkai**: +10% de PDL base, PV e PK (1×/combate, após a batalha); **Raça Guerreira**: +1 cumulativo em todas as rolagens a cada 2 rodadas ativas; cauda agarrada = desvantagem |
| Ōzaru | **EP +1, KI 3**; PV temporários = PV total; ataques contra ele com vantagem; rajada 12 m / raio 6 m, **1 PK = 3 de dano** |
| Super Saiyajin 1/2/3 | **EP +2/+3/+4, KI 6/9/12**. SSJ1: gasta PK = diferença para virar falha em sucesso; SSJ2: PK→rolagem 1:1; SSJ3: Ki gasto na rodada vira dano extra |
| Glind | Teleporte leva aliados = EP; Potara: atributos = maior, **EP base somada**, PV = metade de cada somada, **PK = (soma) × 3** |
| Humano Marcial | ST com ×10; +1 movimento na criação e a cada 20.000 PDL |
| Humano Cientista | Não pode usar INT para golpes de Ki; ST viram "Slots de Criatividade"; 1 Androide por EP |

## 8. Talentos e movimentos (5.0–5.2, p. 37–55)

- **64 movimentos marciais** (`j1-movimentos_marciais.json`): custo `[KI: X]` de 01 a 10 (um "Variável", Punho Descarregado; **Nódulo de Supressão sem custo impresso**). 17 com * físico, 10 com * Ki (combináveis com técnica ofensiva), 37 sem *.
- **49 talentos** (`j1-talentos.json`): tipo Passiva / Ativa / Passiva-Ativa; sem tag de custo. Ex. de números: Ataque Genérico Poderoso (alcance 6 m, +1,5 m por PK, **1 PK = 2 de dano**), Resistência Inabalável (**3 de redução por 1 PK**), Mago de Ki (+06 Ki por alteração).
- Resistência padrão dos movimentos: "Teste de ATRIBUTO vs Acerto do Usuário".

## 9. Ambiguidades e erros do livro

1. Regra do modificador (texto × exemplos) — use os exemplos.
2. PV no PDL 0: 3.0.2 diz "abaixo de 10.000 PDL, vida = só o cálculo com a constituição", mas 3.0.3 e o exemplo somam os Pontos de Raça já no início.
3. Tabela de EP quebra o padrão a partir de −5 (completo 0+ em vez de 1+; médio vira faixa de 2).
4. A linha −1 da tabela não é o critério base (1–2 / 3–5 / 6+) menos 1: o mínimo fica só "1".
5. Numeração repetida/fora de ordem: Namek tem dois "4.4.1" (Guerreiro e Dragão); Saiyajin tem 4.5.1.1/4.5.1.2 depois de 4.5.2. Mantido como no livro.
6. Freeza "gastam metade dos Slots de Técnica" — não diz como arredondar.
7. Tabela do Cientista: linha 7.500 PDL sem "Invenção" (a célula de Cápsulas Multiuso parece mesclada).
8. "Slots de Poder" em Potara (provável "Slots de Técnica").
9. EP 2.3.2 (−1 por nível ao atacar alvo mais forte) e 2.3.1 (+EP em todas as rolagens) se somam; o livro não dá exemplo com as duas.
