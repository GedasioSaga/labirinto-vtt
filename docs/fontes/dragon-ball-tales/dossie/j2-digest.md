# Digest j2 — Técnicas, Técnicas Especiais e Transformações (Cap. IV)

> Fonte: "Livro do Jogador - V0.5 (3) (3).pdf". Páginas = numeração impressa (PDF = impressa + 1). Texto integral em `md/j2-60…j2-70`; dados em `json/j2-*.json`. O que está marcado **[derivado]** não está escrito literalmente no livro.

## 1. Tabela de Rank (p. 58)

| Rank | Nome | PDL mínimo | Dano Base min~max | Ki min~max | Pontos positivos base | Total c/ negativos | ST (p. 109) | Ki mín. técnica especial (p. 88-89) |
|---|---|---|---|---|---|---|---|---|
| E | Básica | 10.000 | 12~24 | 1~4 | 1 | 2 | 2 | 2 |
| D | Simples | 20.000 | 26~46 | 4~9 | 2 | 4 | 4 | 4 |
| C | Intermediária | 30.000 | 34~58 | 6~12 | 3 | 6 | 6 | 6 |
| B | Avançada | 40.000 | 44~84 | 8~18 | 4 | 8 | 8 | 8 |
| A | Épica | 80.000 | 68~124 | 12~26 | 5 | 10 | 10 | 10 |
| Z | Lendária | 120.000 | 130~234 | 18~44 | 6 | 12 | 14 | 12 |

- PDL = mínimo recomendado para desenvolver/aprender a técnica (p. 59).
- Técnica nasce com **Dano Base = mínimo do Rank** e **Ki = mínimo do Rank** (p. 59, p. 84 passo 4).
- Slots: +1 ST a cada 5.000 PDL; Técnicas Especiais e Transformações não gastam ST; trocar técnicas só a cada 10.000 PDL (p. 109, fora do Cap. IV).

## 2. Algoritmo do construtor de técnica

Entrada: tipo, Rank, lista de rótulos positivos (com nº de pontos investidos nos variáveis), lista de rótulos negativos.

1. **Tipo (rótulo base obrigatório, p. 61)**: Física (0, acerto FOR, dano físico) · de Ki (0, acerto INT, dano energético) · Mágica (1, acerto PRE, exige "Mago de Ki" salvo talento/raça) · Híbrida (2, FOR/INT/PRE conforme o tipo base). O custo do tipo conta como ponto positivo.
2. **Orçamento** (p. 60):
   - `P_base = pontos positivos base do Rank` (E1…Z6).
   - `N = Σ |valor| dos negativos`. Limite: `N ≤ P_base` (p. 60: "máximo de rótulos negativos … igual ao número de rótulos positivos base"; o exemplo p. 86 conta em pontos: Rank B com Somática −2 + Verbal −2 = 4).
   - Válido se `Σ custo dos positivos ≤ P_base + N` (teto absoluto = 2 × P_base).
   - Rótulo **"(?)"** (Técnica Básica, Técnica Reativa, Adicionar Salvaguarda, Gatilho Passivo, Técnica Expansiva – Ki): custa exatamente `P_base`; o resto só pode vir de negativos (p. 60).
   - Rótulo **"(X a Variável)"**: X é o mínimo; cada ponto extra investido amplia alcance/área e soma Ki (tabela em `md/j2-61`).
   - **[Efeito Negativo] (Variável)**: custa o valor da condição escolhida (lista de condições fica no capítulo de regras gerais, fora do j2); em técnica de **área** consome antes **todos** os positivos (p. 77).
3. **Ki** = `Ki_min do Rank` + somatório dos acréscimos dos rótulos:
   - Alcances: Estocada/Vórtice/Rastro/Projétil/Coluna/Anel +2 (+2 por ponto extra); Explosivo/Engolfante/Arco/Paralelas/Meteórico +3 (+3/pt); Linha Quebrada +2 (+3/pt); Meia-Lua +4/pt (sem inicial no texto); Toque e Expansivo 0.
   - Fragmentação +6 (+4 Ki por +1,5m de raio); Aumentar Precisão +4/rótulo; Aumentar Dificuldade +8/rótulo; Técnica de Barreira +3/rótulo; Aumentar Dano por Ki: +1 Ki → +4 de dano.
   - Negativos: Dreno de Ki (+3 Ki por −1); Exaustiva (Ki ×2 no uso).
   - Teto: Aumentar Dano por Ki "não pode ultrapassar o limite máximo de Dano e de Ki por rank" (p. 74). Para os demais acréscimos o livro **não** diz se o teto do Rank limita (ver ambiguidades).
4. **Dano Base** = `Dano_min do Rank` (+4 por Ki investido via Aumentar Dano por Ki, até `Dano_max`).
5. **Ficha** (p. 84): Mínimo = ¼ base, Médio = ½ base, Completo = base. Arredondamento: o livro mostra ¼ de 50 = 12 (para baixo) e 44 ÷ 4 = 11.
6. **Restrições de combinação** a validar (texto em `json/j2-rotulos.json` campo `restricoes`): Explosivo precisa de outro alcance e não combina com área; Fragmentação e Expansiva só em alvo único (Expansiva exige Projétil); Adicionar Cura exige Técnica Mágica e não cura a si; Carga Crescente não combina com Salvaguarda; Golpe Cego só em longo alcance; Técnica Combinada exige o mesmo rótulo e tipo de dano na outra técnica; Cooperação exige a técnica em 2 personagens.

Validação com o exemplo (p. 85-86): Kamehameha Rank B = Técnica de Ki 0 + Engolfante 2 + Acumulação 4 + Rajada Contínua 2 = 8 positivos; P_base 4 + Somática 2 + Verbal 2 = 8. Dano 44 (11/22/44). Ki: 8 + Engolfante. O livro diz +4 → 12, e a ficha final diz 11; pela regra de 6.1 (+3) seriam 11.

## 3. Uso em combate (motor de batalha)

- **Ki = pontos de ação**: gasta-se por técnica; volta ao **máximo no início do próximo turno** (p. 59). Ex.: 15 Ki → 3 técnicas de 5.
- **Acerto**: d20 + atributo do tipo (FOR/INT/PRE) contra a **CA** do alvo. Margem `m = acerto − CA`: `m<0` erra · 1-2 mínimo (¼) · 3-5 médio (½) · ≥6 completo (p. 59). `m = 0` **não está coberto** pelo texto.
- **Gatilho dos tipos de dano** (6.2): "dano Crítico **ou** margem ≥ 2× o limite do estágio máximo" (ou seja, m ≥ 12) → alvo testa (CON, CON/DES, SAB, INT, PODER, conforme o rótulo) vs **o acerto rolado**; a falha por 1-2 / 3-5 / 6-11 / ≥12 escalona o efeito; repete o teste no início dos turnos quando o rótulo diz. "Não afetado pela escala de poder".
- Tipos sem esse gatilho, só "ao causar dano": Tracionante, Pregante, Laçante, Lancinante, Cisalhante, Farpante, Descompassante, Quebra, Pulsante; Desarmante só em dano máximo; Cerco = ×2 contra estruturas; Consumidor = no 0 de PV.
- **Crítico**: 20 natural; Golpe Crítico baixa 1 por rótulo (p. 76).
- **Salvaguarda no lugar do acerto** (Adicionar Salvaguarda, p. 78): CD = 8 + mod. do atributo de acerto + **EP base** (sem a EP bônus de transformação); falha 1-2 mínimo, 3-5 médio, ≥6 máximo; passou = nada.
- **Escala invertida** (Adicionar Cura p. 74; Técnica Defensiva p. 77): `acerto ≥ alvo` completo; 1~5 abaixo médio; 6+ abaixo mínimo (cura rola contra a CA do aliado; a defensiva usa o acerto inimigo como CA).
- **Estágios extras**: Acumulação (+1 estágio por carga; acima do máximo, + dano mínimo por carga; carga por Ki = custo normal por carga; não mistura os dois modos); Devastadora/Lancinante/Pulsante (+1 estágio; no máximo, + dano mínimo).
- **Ações**: técnica normal 1×/turno; Técnica Básica pode repetir no turno; Técnica Reativa usa-se como reação (1× por turno de reação); Gatilho Passivo dispara sozinho (1× até o início do próximo turno).
- **Manter**: Rajada Contínua = paga o Ki de novo a cada rodada, sem ações/reações, mantém o acerto original.
- Regras gerais citadas e **não definidas aqui**: Sob Ameaça, Ataque de Oportunidade, Escala de Poder (EP) e o ajuste de dano por escala, mitigação, condições do Efeito Negativo, Salvaguardas Contra Morte.

## 4. Técnicas Especiais (p. 87-92)

- Existem quando nenhum rótulo cobre a ideia. **Ofensivas**: só o narrador cria. **Não ofensivas**: jogador cria com aprovação; **1 por Escala de Poder** do personagem; não gastam ST.
- Ki mínimo por uso: E2 D4 C6 B8 A10 Z12. Limites de efeito por Rank em `json/j2-tecnicas_especiais.json`.
- Bônus de atributo ≤ nº de positivos base do Rank (o livro só fixa A = +5) **[derivado para os outros ranks]**. Toda técnica especial exige contrapartida (sem Ki por uma rodada, dano fixo, Ki extra ou rótulo negativo).
- Formato dos exemplos: `[Nome – Rank] texto [Ação|Reação|Ação ou Reação] [N KI]`.

## 5. Transformações (p. 92-95)

- **Ativar**: Ki = 3 × estágio (Estágio 6 = 18). **Bônus**: EP +estágio. **Efeito**: passiva-conceito que cresce por estágio (definida com o narrador).
- **Dura até**: atordoado ou inconsciente · Ki zera durante turno de Ação ou Reação · 0 PV.
- **Desgaste opcional** para formas fortes: Ki de ativação maior e/ou Ki constante por rodada.
- Desbloqueio narrativo + PDL e/ou evento e/ou pré-requisito único; não gasta ST.
- Exemplo SSJ: E1 [EP +02][KI 06], E2 [EP +03][KI 09], E3 [EP +04][KI 12]. Isso **não bate** com a regra (EP = estágio; Ki = 3 × estágio).

## 6. Ambiguidades para decidir antes de implementar

1. A margem = 0 (acerto igual à CA) não tem estágio definido.
2. O teto do Rank (Dano/Ki máx.) só é explícito para Aumentar Dano por Ki; os outros acréscimos de Ki o ultrapassam?
3. Limite de negativos: o texto fala em "número de rótulos", mas o exemplo conta pontos. O mais coerente é limitar em pontos (≤ P_base).
4. Engolfante: +3 (p. 62) ou +4 (p. 86)? Kamehameha: Ki 12 ou 11, mínimo 11 ou 12.
5. p. 59: "Rank E … alcançar no máximo 20 de dano" contra a tabela, que dá 24.
6. Dano Espiritual (p. 68) repete o texto da Drenagem ("tipo 'Drenagem'"): provável erro de cópia; o efeito diferente é Ki extra.
7. Meia-Lua não informa Ki inicial, só +4 por ponto extra.
8. Transformação: o exemplo SSJ contradiz as fórmulas de EP e Ki.
9. Técnica Híbrida custa 2 pontos; o texto de 6.0.1 diz "custo mais alto de Ki", sem número.
10. O livro classifica Adicionar Cura e Adicionar CA como rótulos de Ki (6.3), mas Cura exige Técnica Mágica.
11. Rótulos "(?)" em Rank E consomem só 1 ponto (barato); não há regra que proíba isso.
12. A "variação por escala" de dano/cura é citada mas definida fora do Cap. IV.
