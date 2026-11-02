# j3 — Especificação para motor de batalha manual (Dragon Ball Tales, Livro do Jogador V0.5)

Escopo: Cap. V (8.0-8.8), Cap. VI (9.0-9.7), Registros de Atualizações e Ficha (PDF p. 128). Páginas = **número impresso** (PDF = impresso + 1). Itens marcados **[FORA]** vêm de outros capítulos (cap. 2-3) e estão aqui só porque o motor precisa deles; confirmar com o dono daquele recorte. Itens **[AMBÍGUO]** precisam de decisão do usuário (lista no fim).

## 0. Grandezas do personagem

| Grandeza | Fórmula | Fonte |
|---|---|---|
| Modificador de atributo | 8 → -1, 10 → +0, 12 → +1, 14 → +2 (= floor((valor-10)/2)) | **[FORA]** 2.0, p. 6 |
| PK (Pontos de Ki) | `PK = Poder × 2`; **[FORA]** +1 a cada 10.000 PDL | 8.5, p. 105; 3.0.4 |
| CA | **[FORA]** `10 + mod DES + EP Base` (EP Bônus não soma) + armadura (+1/+2/+3) | 3.0.5; 8.3, p. 103 |
| ST (Slots de Técnica) | `20 + ((1 + mod SAB) × 5)`; +1 a cada 5.000 PDL | 8.6, p. 108-109 |
| Carga | `5 + mod FOR × 5` slots | 8.2, p. 100 |
| Deslocamento | 9,0 m base | 9.5.3, p. 116 |
| Escala de Poder (EP) | EP Base (+1 a cada 40.000 PDL **[FORA]**) + EP Bônus (transformação) | 8.1.1; 9.1 |
| CD de Salvaguarda/Condição | `8 + mod do Atributo de Acerto + EP (Base)` — sem EP Bônus | 8.1.2, p. 99 |

## 1. Rolagem padrão (p. 97)

- Teste: `1d20 + mod de atributo + EP (Base + Bônus) + modificadores temporários`. "Exemplo: Força +1 com Escala de Poder 2 = 1d20 + 3".
- Perícia: `1d20 + mod` ; se **treinado**, `+ EP Base` (nunca EP Bônus). CD 5/10/15/20/25/30; circunstancial -5 a +5 (p. 99-100).
- Teste resistido: maior valor vence (p. 99). Empate de resistido: **[AMBÍGUO]** não definido.
- **Vantagem/desvantagem**: usadas (flanqueamento, Caído, Envenenado, sob ameaça…) mas **não definidas** no livro. **[AMBÍGUO]** sugestão D20 padrão: 2d20, maior/menor.
- **[FORA]** 2.3.2: -1 no ataque por ponto de EP que o alvo tem acima do atacante.

## 2. Início do combate — Iniciativa (9.1, p. 113)

1. Cada um declara se **transforma antes do 1º turno** (opcional). Se sim, soma EP Bônus na iniciativa e começa com menos Ki (o custo da transformação sai do Ki inicial).
2. Rolar `1d20 + mod DES + EP Base (+ EP Bônus se transformou)`.
3. Ordem decrescente. Empate → maior **valor bruto de Destreza** → persistindo, rerolar só entre os empatados.
4. **20 natural**: age antes de todos (independente de total; vários 20 → mesmo desempate); imune a efeitos negativos no 1º turno; transformar nesse turno custa 0 Ki.
5. **1 natural**: perde o turno de ação do 1º turno; pode só reagir (se tiver Ki).

## 3. Rodada e turnos

- **Rodada** = cada combatente faz 1 Turno de Ação na ordem de iniciativa. Entre turnos, qualquer um pode ter **Turnos de Reação**.
- **Início do Turno de Ação** (ordem sugerida pelo motor; o livro não fixa a ordem):
  1. Restaurar Ki ao máximo (8.5, p. 105): `ki_atual = PK_max - ki_bloqueado_exaustao - debitos`; débitos = Ki faltante de Choque de Poder (9.5.6) e PK de 2º uso da transformação máxima (8.5.1.3).
  2. Armadura: `-5` ou `-10 Ki por turno` (8.3) **[AMBÍGUO]**: se sai do pool no início de cada turno.
  3. Testes de fim de condição "no início do turno" (Desnorteado, Intimidado, Quebrado-supressão) e rolagem de Confusão Mental; tentativa de soltar Agarrão.
  4. Expirar condições "até o início do seu próximo turno" (Exposto, supressão de Sangrando).
- **Turno de Ação** (9.2, p. 113-114): gastar Ki em quantas ações quiser.
  - Movimento: 0 Ki, **1 vez por turno**, até o deslocamento. Correr: +1 Ki por 1,5 m extra.
  - Ações narrativas: 0 Ki.
  - Ataque/técnica/talento/transformação: custo de Ki da própria técnica (definido em outros capítulos).
  - **Mesma ação não pode ser repetida em sequência**, exceto rótulo "Ataque Básico": redutor acumulado 0, -1, -2, … (vale entre técnicas diferentes com o mesmo rótulo).
  - **>3 ataques básicos**: anunciar antes de rolar; senão, limite 3. Com >3, **uma rolagem só**: `1d20 + mods - Σ(0..n-1)` (5 ataques → `1d20 -10`). **[AMBÍGUO]** como o resultado único vira dano de n ataques.
- **Fim do Turno de Ação**: expirar condições "até o fim do seu próximo turno (de ação)" (Silenciado, Paralisado, Cego, Alucinação, Desequilibrado, Quebra de Guarda); decrementar Lacuna Mental (2 turnos de ação).
- **Fim da rodada**: expirar Atordoado ("até o final da rodada em que foi atingido"); descartar Ação Oculta não disparada ("até o fim da rodada seguinte").

## 4. Turno de Reação (9.3, p. 114)

- Abre quando alguém **é atingido** (errar por CA = esquiva/bloqueio já embutidos; não há reação de esquiva contra erro).
- Quem pode reagir: o alvo, aliados e inimigos que tenham reação aplicável; **sem movimento** no turno de reação (posicionamento importa).
- **Ordem**: primeiro o alvo (dono do turno de reação), depois os demais **por ordem de iniciativa**.
- Custo: o texto diz "ST" — **[AMBÍGUO]** tratar como Ki (8.5: "ações fora do turno … também consomem Ki — e ele não se regenera até o turno seguinte").
- Limite (Registro V0.3, p. 124): cada técnica reativa **1× por inimigo por turno de reação**, salvo rótulo "Técnica Básica"; pode repetir em turnos de reação distintos. Gatilho Passivo: só reativa no início do próximo turno de ação.
- Reações listadas no livro: aparar, esquivar, bloquear, contra-atacar (via talentos/técnicas), Choque de Poder, Ataque de Oportunidade, Estabilizar voo, disparo de Ação Oculta.

## 5. Resolução de ataque (8.4 e 9.4, p. 103-115)

```
d = 1d20
se d == 20 (ou dentro da margem de crítico, ex. Exposto 16-20): CRÍTICO
se d == 1: ERRO CRÍTICO
total = d + mod_atributo_de_acerto + EP(Base+Bônus) + temporários - redutores (ataque básico, Desnorteado -2, [FORA] -dif EP)
margem = total - CA_alvo   (CA_alvo já com -2 de Desnorteado etc.)
```

| Margem | Estágio | Dano |
|---|---|---|
| ≤ 0 | Erro | 0 |
| 1-2 | Mínimo (raspão) | 25% (¼) do dano total |
| 3-5 | Médio | 50% (½) |
| ≥ 6 | Total | 100% |

- **[FORA]** 2.3.3: cada ponto de EP do atacante acima do alvo desloca os três limiares em -1 (+2 EP → mínimo 0, médio 1-3, total 4+).
- **Sangrando** no alvo: estágio sobe 1 (mínimo→médio→total) se acertar. **Quebra de Guarda**: próximo ataque que atingir ignora CA (**[AMBÍGUO]** = dano total?).
- **Crítico** (20 natural): acerto automático, dano total, **dano final ×2** (após bônus); efeitos extras podem ser potencializados (Mestre). Destrói a armadura do alvo ("Qualquer armadura, é destruída caso se receba um dano crítico").
- **Erro crítico** (1 natural): falha automática; o alvo ganha **ação gratuita imediata**, 0 Ki, qualquer técnica/ataque, e o atacante não pode reagir a ela (critério do Mestre).
- "Dano total da técnica" = valor definido na técnica (capítulo de técnicas, **[FORA]**). Arredondamento de ¼ e ½: **[AMBÍGUO]** não definido.
- Agarrar: após acertar, trocar dano por agarrão (ver §8).
- Dano a 0 PV ou abaixo → Salvaguarda Contra a Morte (§9).

## 6. Ki: gasto, recuperação e exaustão (8.5, p. 104-108)

- Ki = pontos de ação. Restaura **todo** no início do próprio turno; o gasto em reações fica fora até lá.
- Débitos que reduzem a restauração: Choque de Poder sem Ki suficiente (desconta no início do próximo turno; não se aplica se a reação for ofensiva); 2º+ uso da transformação máxima sem Descanso Longo (PK gasto nela fica bloqueado **no momento do uso**, valor direto).
- **Exaustão opcional** (aplicar **ao fim da batalha**, dura até Descanso Longo):
  - Técnica do Rank mais alto acessível, **a partir do Rank C**: +5% dos PK totais bloqueados **por uso** (6 usos → 30%; 30 PK → 9 bloqueados, 21 disponíveis).
  - Transformação **inferior** à máxima: Estágio 1 → 5%, 2 → 10%, 3 → 15%, +5% por estágio.
  - **[AMBÍGUO]** arredondamento; se várias fontes somam; se a % de transformação inferior é por uso ou por luta.
- Descanso Curto (30 min): recupera PV = valor base da Raça, até EP Base vezes. Descanso Longo (8 h): PV total, remove efeitos negativos básicos, zera exaustão, recarrega Choque de Poder. Cura não pode ser usada em si mesmo.

## 7. Movimento e posição

- Deslocamento 9,0 m; Correr 1 Ki/1,5 m extra (9.5.3). Grade: **[AMBÍGUO]** os custos usam passos de 1,5 m (Correr, apoio no Choque), mas 9.5.9 diz "3 metros (ou 1 quadrado de distância)".
- **Desengajar** (9.5.4): `max(2, EP_do_alvo × 2)` Ki; sai sem Ataque de Oportunidade.
- **Ataque de Oportunidade** (9.5.5): inimigo no alcance se afasta sem Desengajar → ação extra só contra ele, pode usar técnica de ação.
- **Flanqueamento** (9.5.8): aliado em espaço diretamente oposto, ambos adjacentes → **vantagem** em ataques corpo a corpo; no ar, todos no mesmo nível.
- **Sob ameaça** (9.5.9): técnica de longo alcance (alcance mínimo > 3 m) com inimigo corpo a corpo adjacente → **desvantagem**, salvo técnica com "queima-roupa", talento ou aval do Mestre. Recuar antes provoca AdO.
- **Voo** (9.5.7): iniciar 4 Ki; manter 0; níveis 0 solo, 1 até ~9 m, 2 de 9 a 20 m, 3 acima de 21 m; 2 Ki por nível alterado (**[AMBÍGUO]** exemplo diz 0→2 = 2 Ki). Corpo a corpo de baixo para cima não alcança. Derrubado: cai 1 nível (ou ao chão), `1d20` contundente por nível; reação 1 Ki + DES CD 15 evita.

## 8. Ações especiais (9.5, p. 115-120)

- **Ação Oculta**: gastar 1 ação + Ki no próprio turno; gatilho secreto ao Mestre; vale até o fim da rodada seguinte.
- **Agarrar**: acerto → sem dano → resistido: defensor rola DES **ou** FOR vs o **Acerto do Agarrão** (total do ataque). Falha → agarrado e imobilizado (não se move; só ataca quem agarra). Repete no início do próprio turno e sempre que o agarrador sofrer dano. Só alvos de tamanho igual ou menor.
- **Choque de Poder** (reação a técnica de Ki ou física): requisitos — mesma EP (aliados podem somar +1 EP cada com técnica de Rank ≥, gastando Ki; excedente vira +1 no acerto), técnica do defensor com Rank ≥ ao do atacante, 1× por Descanso Longo por personagem. Custo = Ki da ação ×2. Disputa: rolagens resistidas de Acerto até alguém ter **3 vitórias**; antes de cada rolagem, 5 Ki = +1. Perdedor sofre `dano_max(técnica vencedor) + dano_max(técnica perdedor)/2`, ignorando CA.
- **Salvaguarda Contra a Morte**: ver §9.

## 9. Morte (9.5.10, p. 119-120)

Ao chegar a exatamente 0 PV ou abaixo: rolar `1d20`; ≥10 sucesso, ≤9 fracasso; 3 sucessos → sobrevive inconsciente a 0 PV; 3 fracassos → morte. **[AMBÍGUO]** os marcadores dizem que uma única falha mata ("morre imediatamente"). Quando rolar (uma por turno? imediato?) não está definido.

## 10. Condições (9.7, p. 120-123) — tique

| Quando | Condições |
|---|---|
| Ao aplicar | CD = 8 + mod Acerto + EP Base do aplicador. Quebrado acumula (não da mesma técnica); Envenenado: imunidade à mesma técnica após vencer |
| Início do turno do afetado | Teste para sair: Desnorteado (SAB ou CON), Intimidado (SAB), Confusão Mental (rola 1d20: 1-9 ataca aliado mais próximo com ataque básico mais forte, 10-16 perde o turno, 17-20 normal; depois teste SAB). Quebrado: CON suprime até fim do turno. Exposto expira se não foi atingido |
| Teste sem momento definido | Enraizado (DES), Envenenado (CON), Instável (INT ou POD), Sangrando (CON suprime até o início do próximo turno; só cura encerra) |
| Fim do próximo turno do afetado | Silenciado, Paralisado, Cego (de ação), Alucinação Sensorial, Desequilibrado, Quebra de Guarda (ou ao ser atingido) |
| Fim da rodada | Atordoado (perde o próximo turno de ação; reações custam Ki ×2) |
| Por contagem | Lacuna Mental: 2 turnos de ação |
| Por evento | Sobrecarregado (próxima técnica de Ki custa ×2); Caído (levantar = gastar o Ki do ataque que derrubou, pode dividir com aliado; desloc. ½; ataques contra têm vantagem); Controle Mental (Presença vs Sabedoria a cada rodada; termina com dano direto/quebra mágica/purificação) |
| Fim do combate | Quebrado (até fim do combate; cura/descanso longo) |

Efeitos de rolagem: Desnorteado -2 Acerto e -2 CA; Envenenado desvantagem em tudo; Intimidado desvantagem contra o intimidador; Cego desvantagem em rolagens de visão e sem ataque à distância; Alucinação desvantagem em ataques e sem técnicas de alvo único; Paralisado sem mover/atacar, reação ×2 Ki; Instável recebe metade do dano que causar com técnica ofensiva; Exposto margem de crítico 16-20 contra ele. 20 natural na iniciativa = imune no 1º turno.

## 11. Comparar personagens (PDL)

- PDL Base: número acumulado, dado pelo Mestre; é o que destrava progressão.
- **PDL Interpretativo = PDL Base × (EP × 10)** (8.7, p. 110), opcional e só narrativo ("não interfere nas regras de combate ou progressão"). Com EP 0 o livro usa o PDL Base.
- Marcos: +1 ST/5.000 (8.6); troca de técnicas a cada 10.000 (8.6); 1 Talento **ou** Mov. Marcial a cada 20.000 (Reg. V0.3). **[FORA]** 3.0.11: 10.000 → PV da raça, +1 PK, +2 ST; 30.000 → +2 atributo ou +1 em dois; 40.000 → +1 EP Base.
- Força real em combate é por **EP**, não por PDL: Choque só com EP igual; destruição/impedimento por EP (8.8: destruidor > 2× EP dos defensores → não podem impedir); **[FORA]** 2.3.4 vitória automática com EP o dobro.

## 12. Ambiguidades para decidir

1. Reação gasta "ST" (9.3) vs Ki (8.5/9.5.6).
2. Vantagem/desvantagem nunca definida.
3. Salvaguarda contra a morte: 3-de-3 vs uma rolagem decisiva.
4. Voo: 2 Ki/nível vs exemplo 0→2 = 2 Ki; nível 3 sem nome; faixa 20-21 m.
5. ST: fórmula `20+((1+mod)×5)` vs exemplo `12+mod×5`; soma do exemplo errada; +1/5.000 vs +2/10.000.
6. Radar das Esferas 2 vs 1 slot; "Armadura de batalha completa" 3 slots vs tabela 2/4/6.
7. Penalidade de armadura "-X Ki por turno": redução do máximo ou gasto por turno.
8. Arredondamento de ¼, ½ e das % de exaustão.
9. >3 ataques básicos condensados: como vira dano.
10. Número entre parênteses nas condições (5, 4, 3…) sem definição; provável "peso/rótulo".
11. Seção 9.6 inexistente; dois "8.1.2"; registro cita páginas de versões antigas.
12. Quebra de Guarda "ignora a CA": acerto automático ou dano total.
13. Empate em teste resistido e no Choque de Poder: não definido.
