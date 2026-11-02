# Dossiê do Narrador (lado do mestre no app)

Fontes: "Livro do Narrador - V0.1.pdf" (26 p.) e "Enma Daioh - 2025.pdf" (40 p., 7 fichas de PnJ + 1 raça bônus). Transcrição completa em `md/nar-*.md`; dados em `json/nar-*.json`. Fórmulas de jogador citadas aqui vêm do "Livro do Jogador - V0.5" (seções 2.2-3.0.6), conferidas só no trecho necessário.

## 1. O que o app precisa do lado do mestre

1. **Gerador/editor de PnJ** com: categoria (Comum / Elite / Chefão), Rank de referência (E, D, C, B, A, Z), ND (número de golpes), atributos com teto por categoria, PK/CA calculados, técnicas livres (sem limite de slots), transformações, passivas únicas e "mecânicas de batalha" em texto livre.
2. **Calculadora de PV do PnJ**: `PV = ND × vida_por_golpe[categoria][rank]` (`json/nar-nd-vida-por-golpe.json`).
3. **Medidor de ameaça**: diferença de Escala de Poder PnJ − jogadores → fácil / equilibrado / difícil / mortal (`json/nar-escala-poder.json`).
4. **Regra de desvantagem numérica** como opção do encontro (ver §5).
5. **Biblioteca de PnJs prontos**: as 7 fichas do Enma Daioh (`json/nar-npcs-enma.json`), com PV em branco para o mestre definir o ND.

## 2. Criação de PnJ (Livro do Narrador 4.0, p. 17-19)

| Etapa | Regra |
|---|---|
| 1 Papel | Considerar tamanho do grupo; solo contra o grupo?; antagonista principal / subchefe / oponente corriqueiro; 1x1 ou grupo x grupo. Influencia vida, dano esperado, escala e complexidade. |
| 2 Vida | PnJ **não** usa a regra de PV de jogador. "Escalonamento de Vida": com quantos golpes de um Rank ele cai. |
| 3 Escala | EP do PnJ define a ameaça; pode vir de transformação. |
| 4 Atributos | Boa prática, não regra rígida (tabela abaixo). |
| 5 Técnicas | Ofensivas seguem as regras do Livro do Jogador; especiais e únicas permitidas. **PnJ não segue a regra de Slots de Técnica**; muitas técnicas → compensar reduzindo vida. Cuidado com Bio-Androides/Majins que absorvem habilidades. |
| 6 Mecânicas | Ex.: só ferível após X ataques; intangível em parte do turno; técnica devastadora a cada 3 turnos. Quanto mais quebra o sistema, menos Vida/atributos. |
| 7 TPK | Narrativo: Esferas do Dragão, arco no Outro Mundo, consequências. (Numerada "4.0.6" duas vezes no original.) |

### Vida por golpe (PV)

| Rank | Comum | Elite | Chefão |
|---|---|---|---|
| E | 12 | 14 | 20 |
| D | 26 | 32 | 46 |
| C | 34 | 42 | 58 |
| B | 44 | 58 | 80 |
| A | 68 | 80 | 124 |
| Z | 130 | 175 | 234 |

Notação de ND: **"ND N – Rank X (Categoria)"**, N = golpes que aguenta. Exemplos do livro: ND 3 – Rank E (Comum) = 36 PV; ND 10 – Rank Z (Chefão) = 2.340 PV. O livro chama ND de "nível de dificuldade"; o suplemento chama de "Nível de Desafio". **ND não é uma escala de desafio no sentido D&D** (não há tabela ND → XP/recompensa); é só o multiplicador de vida.

### Atributos de PnJ

| Categoria | Teto | Demais | Exceder |
|---|---|---|---|
| Comum | 16 em um ou dois | 12 ou menos | −2 em outro atributo por ponto acima de 16 |
| Elite | 20 em um, 16 em outro | entre 14 e 12 | −3 em outro atributo por ponto acima de 20 |
| Chefão | até 30 em um | sem limite fixo | bom senso narrativo |

### Escala de Poder e ameaça

EP igual → equilibrado; +1 → difícil; +2 ou mais → mortal; abaixo → fácil.
Escala inicial de campanha: 0 (clássico), 1-2 (indicado para lutadores treinados), 3+ (elite). PDL inicial sugerido 100-1.000, abaixo de 10.000 (primeiro marco). Escala sobe +1 a cada 40.000 PDL; transformação pode subir vários pontos (ex.: 3 → 6 ou 7).

## 3. Formato do bloco de estatísticas (fichas Enma Daioh)

```
<Nome>
ND ( ) – <Categoria> Rank <X>
FOR: 14 (+2)  DES: 16 (+3)  CON: 15 (+2)  INT: 16 (+3)  POD: 14 (+2)  SAB: 12 (+1)  PRE: 13 (+1)
PV: ---   PK: 28   CA: 15   VEL: 9,0m   EP: 02
BACKGROUND – (Criador: <usuário>)
TÉCNICAS OFENSIVAS – <Nome>
  [<Técnica> – "<nome japonês>" – <Rank>]: <descrição> [Dano: a-b-c] [Ki: n] - Alcance: <...>
  - Rótulos Positivos (n): <lista>  - Rótulos Negativos (n): <lista>
TÉCNICAS ESPECIAIS – <Nome>
  [<Técnica> – <Rank>]: <descrição> [Ki: n | -- | Variável]  Efeito: • ...
TRANSFORMAÇÕES – <Nome>          (só Gorudan)
  <Forma> – Estágio N: <texto> [EP: +02] [KI: 06]
PASSIVAS E ATIVAS ÚNICAS – <Nome>
  <Nome> (Passiva | Passiva/Ativa): <texto>
```

| Sigla | Significado | Fórmula (Livro do Jogador) | Confere nas 7 fichas? |
|---|---|---|---|
| FOR, DES, CON, INT, POD, SAB, PRE | Força, Destreza, Constituição, Inteligência, Poder, Sabedoria, Presença | mod no padrão D&D (10-11 = +0, 12-13 = +1, ... 8-9 = −1) | sim, com 2 exceções (ver §7) |
| PV | Pontos de Vida | Jogador: (CON × 5) + pontos de raça. **PnJ: ND × vida-por-golpe** | todas "PV: ---" (em branco de propósito) |
| PK | Pontos de Ki (pool para técnicas, reações e transformações; a 0 o personagem fica exausto, sem atacar nem reagir) | POD × 2 (+1 a cada 10.000 PDL) | sim, 7/7 |
| CA | Classe de Armadura | 10 + mod DES + EP **Base** (EP Bônus de transformação não soma) | sim, 7/7 |
| VEL | Velocidade (deslocamento por turno) | não definida nos dois livros do meu escopo | 9,0m em todas |
| EP | Escala de Poder (bônus tipo proficiência; afeta rolagens, resistências, CA) | Base: +1 a cada 40.000 PDL; Bônus: transformação | 02 a 06 |
| ND | Nível de Desafio/Dificuldade = nº de golpes do Rank que aguenta | — | "ND ( )" em branco |
| [Dano: a-b-c] | Três estágios: Mínimo, Médio, Completo, conforme quanto o ataque supera a CA (Livro do Jogador 2.3.3: +1 / +2 a +4 / +5 ou mais) | — | — |
| [Ki: n] | Custo da técnica, pago em PK (o texto das especiais diz "gastar os PK's desta técnica") | — | — |

### Ficha de PnJ × ficha de jogador

- **Iguais**: os 7 atributos com modificador, PK, CA, VEL, EP, formato das técnicas (rank, dano em 3 estágios, custo Ki, alcance, rótulos positivos/negativos com pontos), técnicas especiais, transformações (com [EP: +n] e custo de manutenção [KI: n]).
- **Diferentes**: PV (regra de ND em vez de CON × 5 + raça); sem slots de técnica; teto de atributos por categoria em vez da regra de criação do jogador; campos novos **ND**, **Categoria**, **Rank de referência**; "Passivas e Ativas Únicas" (traços de personagem, inclusive fraquezas como Pavor, Vergonha, Trauma, Vício em Doces).
- **Ausentes nas fichas do suplemento**: perícias, talentos, PDL, raça/estilo de luta explícitos (a raça aparece só no background), Slots de Técnica, testes de resistência. O JSON mantém `pericias: []` e `talentos: []`.
- Todas as 7 fichas trazem as mesmas duas técnicas básicas: [Esfera de Ki – D] e [Golpe Marcial – D] (08-17-34, Ki 08).

## 4. Técnicas, especiais e transformações — o papel do narrador (Cap. II)

- **Ofensiva**: checklist estrutural — rank bate com dano base e custo de Ki; extras pagos com Ki extra; rótulos compatíveis com o tipo (Ofensiva, Suporte...); tipo de ataque (Toque, Alcance, Área) coerente; faz sentido para o personagem.
- **Especial** = o que não se faz com rótulos. **Especial ofensiva (causa dano): só o narrador cria**, como prêmio; sem rótulos; dano/Ki definidos pelo narrador; não repetível em qualquer turno. **Especial não ofensiva**: o jogador cria com aprovação; **máximo 1 ativa por ponto de Escala de Poder**. Critérios: não dá para fazer com rótulos; não causa dano; regras e limites claros; equilibrada (Ki alto, preparo, limite por combate, riscos); controlável pelo narrador.
- **Transformação** = "Técnica Especial Passiva e Contínua"; única coisa além do PDL que sobe a EP. Avaliar: conceito, passiva que define o conceito, escalável (estágios), equilibrada em relação à EP concedida, custo de Ki de manutenção progressivo; nada de "+2 no ataque / +1 na CA". "Comece pelo fim" (estágio final primeiro).
- **Itens (Cap. IV)**: não dão dano nem atributo direto; dão vantagem situacional, facilitam perícia, servem de chave/gatilho. Itens especiais podem liberar técnica ofensiva, ser a técnica (consome Ki ou Stamina) ou dar característica (voo, invisibilidade parcial, barreira). Nunca superar quem treinou habilidade parecida. Sem tabela de preço nem de raridade.

## 5. Rodando combate do lado do narrador (Cap. V)

- **Regra Especial de Reação em Desvantagem** (opcional, vale para PnJ e jogador): "Quando um personagem está enfrentando dois ou mais oponentes ao mesmo tempo, o Ki restante após seu turno NÃO é consumida ao realizar reações defensivas." No app: um interruptor por combatente, ativo quando ele enfrenta 2+ oponentes; reações defensivas custam 0 PK nesse estado. Justificativa do livro: superioridade numérica pesa mais que diferença de escala.
- **PvP** não é equilibrado; o narrador deve avisar a assimetria antes.
- Dicas de encontro: fases (vilão muda de forma, cenário desmorona, técnica liberada com Ki abaixo da metade), cenário ativo, variar alvos, descrição, decisões difíceis. Ideia para o app: gatilhos de fase por % de PV/PK e contador de rodadas (ex.: "a cada 3 turnos").
- Mecânicas de ciclo já presentes nas fichas: Rakthar alterna 7 "batimentos" por rodada e reinicia na 8ª (`batimentos` no JSON); Jota acumula "Marcas de Adaptação" até EP do inimigo × 5; Yama acumula "Conquista" até a própria EP. O app precisa de contadores por combatente e de efeitos que valem "até o próximo turno".
- Não há regras de recompensa/XP/PDL por encontro no Livro do Narrador; a única menção é PDL inicial como prêmio pelo histórico e técnica especial ofensiva como prêmio narrativo.

## 6. Biblioteca Enma Daioh (7 PnJs, 50 técnicas)

| PnJ | Cabeçalho | POD/PK | CA | EP | Técnicas (ofens./espec.) | Extras | Pág. |
|---|---|---|---|---|---|---|---|
| Mirio Jo | Elite Rank C | 14 / 28 | 15 | 02 | 6 / 1 | 5 passivas | 4-7 |
| Jota Pe | Elite Rank D | 13 / 26 | 15 | 02 | 5 / 2 | 2 passivas | 8-11 |
| Gorudan | Elite Rank C | 18 / 36 | 14 | 02 | 4 / 2 | Modo Assalto (Est. 1, EP +02, Ki 06); 2 passivas | 12-15 |
| Erik Ko'nuar | Elite Rank Z | 16 / 32 | 16 | 04 | 2 / 3 | — | 16-19 |
| Amai Kēki | Elite Rank D | 16 / 32 | 13 | 02 | 7 / 2 | 3 passivas | 20-23 |
| Yama | Elite Rank Z | 22 / 44 | 17 | 05 | 10 / 1 | 2 passivas | 24-28 |
| Majin Rakthar | **Chefão** Rank B | 22 / 44 | 22 | 06 | 5 / 0 | 1 passiva com 7 batimentos | 29-32 |

O suplemento traz ainda o **Clã Garunpo** (variação Namekuseijin, Cap. II, p. 34-39): `md/nar-enma-02-raca-bonus-cla-garunpo.md` (Pacto Sombrio em 7 marcos de PDL, de 10.000 a 180.000).

## 7. Ambiguidades e erros do original

- **ND em branco** em todas as fichas ("ND ( )") e **PV "---"**: de propósito; o mestre escolhe o ND conforme o confronto. O "Rank" do cabeçalho parece ser o rank de referência da tabela de vida, mas o suplemento não diz isso com todas as letras.
- Modificadores fora do padrão: **Erik POD 16 (+4)** (padrão daria +3) e **Rakthar CON 20 (+4)** (padrão daria +5). Os outros 47 conferem.
- As fichas não seguem à risca a "boa prática" de atributos Elite (20 / 16 / resto 12-14): Jota tem três 16; Erik tem dois 18; Gorudan tem 18-16-16; **Yama tem POD 22 e FOR 20** sem redução visível; Rakthar (Chefão) tem 22-22-20-20-18. Confirma que a tabela de atributos é guia, não validação; o app deve só avisar, nunca bloquear.
- PK = POD × 2 e CA = 10 + mod DES + EP conferem nas 7 fichas (checado por script).
- Danos com quebra de linha no PDF: 14-22-44 (Contra-Impacto Saiyajin, Dragon's Reversal: o 14 destoa do Rank B comum 11-22-44), 20-40-80, 32-65-130. Mantidos como impressos.
- Gorudan: duas especiais com o **mesmo nome** "Correntes do Juiz Supremo – Enma no Kusari – A"; a segunda é a "Mão do Julgamento".
- Erik: seção de especiais rotulada "– Gorudan" (erro de cópia).
- Amai: "Esfera de Cura" listada entre ofensivas ([Cura: 17-34-68]).
- Livro do Narrador: sumário omite 3.3; "Imponto Limites", "ROTERIZE", "ATRBITOS", dois "4.0.6"; sumário chama 2.2 de "Definindo EP e PDL".
- "Ki" e "PK" usados como sinônimos de custo: o livro diz "o Ki restante ... NÃO é consumida", as fichas dizem "[Ki: 08]" e "gastar os PK's".
- VEL não tem definição nos livros do meu escopo; Stamina aparece em Itens (5.0.1) sem definição.
- Página: números impressos; o PDF do Enma tem 40 páginas e o último número impresso é 39, então página do PDF ≈ impressa + 1 (não conferi visualmente: o poppler não está instalado e a tool Read não renderiza PDF aqui).
