<!-- Não gravei este arquivo: sou agente só de leitura. Salvar como C:/dev/labirinto/docs/auditoria-fichas/vagn-kane.md -->
# Auditoria da ficha: Vagn Kane (pasta One Piece), 07/11/2026

Só leitura: a ficha foi lida do rpg.json da pasta One Piece no appData e nada foi gravado. Caminhos relativos a `C:/dev/labirinto/client/src/`.
Legenda das provas:
- "Leitura": li o código.
- "Regex": copiei a expressão do app para o node e rodei sobre o texto real da ficha.
- "Suspeita": não provei; virou pergunta.

O app e os testes não foram rodados. O `00-sistema.md` não existe: a base foi o `00-bugs-do-sistema.md`.

## 1. Resumo
Jogador, lunariano sem asas, ferreiro. HP 1000, SP 120, Escudo 100. Força 50, Resistência 50, Determinação 40, Espírito 35, Intuição 30; Agilidade, Percepção e Carisma 0.
Luta com uma fruta magnética: Polaridade 1 a 3 (+10/+20/+30 de dano, carregada com a reação), 5 técnicas (Atração Relâmpago, Campo de Contenção, Projeção Letal, Chuva, Armadura Humana) e os 2 modos lunarianos (Ignição e Resiliente, grupo Lunariano).
O app já faz sozinho: custo, recarga, dano da Projeção (55) e da Chuva (65), Polaridade, Ignição e Resiliente. Quebrado: Armadura Humana na reação, Perfurante da Projeção e Campo de Contenção; e a ficha não tem HP nem SP máximo.

## 2. Habilidades
| Item | O que a ficha diz | Hoje no app | Onde |
|---|---|---|---|
| Atacar (sem arma) | Força | Automática: 50 (+Polaridade) | `lib/batalha/formula.ts:207-212` |
| Mecânicas gerais da fruta (passiva) | CD = 10 + Proficiência em Fruta + modificador de Espírito; campo de 2Q, +1Q por nível; a Reação carrega a Polaridade (máx 3: +10/20/30); CD com concentração 11/14/acerta | Parcial. Polaridade automática: Carregar gasta a reação e o selo "Polaridade N" soma no dano. CD, campo e concentração do teste não existem. Na tira Passivas aparece "Vale sempre" | `lib/batalha/contador.ts:62-91`, `stores/batalhaFabrica.ts:1363-1397` |
| Atração Relâmpago | Reação ou Simples, 15 SP, Tempo 1, sem dano; o alvo testa Força, é puxado e fica vulnerável no próximo turno | Parcial: cobra 15 SP, recarga 1, linha no registro; sem teste, sem puxão, sem selo. Na REAÇÃO vem "Rolar" marcado (por causa da palavra "teste") | `lib/batalha/tiposDaHabilidade.ts:141`, `:165-171` |
| Campo de Contenção | Completa, 15 SP por turno enquanto mantém, Tempo 2, dano 0; quem tem metal não ataca, quem veste armadura fica paralisado; teste de Espírito; 3 concentrações = 3,5x no fim | Quebrada (V3, V4). O efeito nos inimigos fica à mão | `lib/batalha/leituraDaFicha.ts:56`, `:67` |
| Projeção Letal | Simples, 20 SP, Tempo 1, Espírito + 20, em linha reta; "perfurante ou cortante"; Imbuir Fogo: Sim | Dano automático 55 (+Polaridade); Perfurante já vem ligado (V2); o fogo não existe | `lib/batalha/acoes.ts:292` |
| Chuva | Completa, 40 SP, Tempo 2, Espírito + 30, área de 2Q | Automática: 65 (+Polaridade); alvos marcados à mão (até 12); a área não é medida | `lib/batalha/golpe.ts:161-171` |
| Armadura Humana LVL 1 | Reação ou Completa, 25 SP, Tempo 4; defender = −10% de dano; atacar = toma tudo e devolve dano ÷ 7 | Quebrada (V1). Usada na vez (Completa), só gasta SP e recarga. O nome termina em ":" e o registro sai "LVL 1::" | `lib/batalha/tiposDaHabilidade.ts:142`, `:163` |
| Ignição (forma) | Livre; velocidade até 1,2x; +2 quadrados; 1 ataque adicional por rodada ao Atacar; 2 vezes por batalha; sem Controle do Fogo | Automática: liga sem gastar ação (só na vez dele), +2 blocos, 1 adicional por rodada, 2 ativações (V6). O 1,2x não existe | `lib/batalha/transformacao.ts:49-66`, `:131-135` |
| Resiliente (forma) | Livre; −20% de dano; no máximo 6 quadrados; lâminas e balas não perfuram; só dura enquanto tiver resistência | Automática: −20% no golpe e no dano livre. O teto de 6 só aparece na conta, não trava (`lib/batalha/acoes.ts:31-32`). "Não perfuram" e "enquanto tiver resistência" não existem | `stores/batalhaFabrica.ts:874-879`, `:2195-2196` |
| Controle do Fogo (raça) | Imbuir fogo nos ataques: +10 de dano | Não suportada: nada no app lê "Imbuir" além do texto do livro | `lib/livroOnePiece.ts:90` |
| HP 1000 / SP 120 / Escudo 100 | Sem máximo gravado | Quebrada (V8) | `lib/ajusteDaFicha.ts:120-123` |
| Corpo Vigoroso | +100 de HP | À mão (só texto); não sei se já está nos 1000 | — |
| Recuperação Espantosa | 1 vez por batalha: depois de desmaiar, volta após uns turnos com HP | Não suportada | — |
| Sensitivo, Armadura de Músculos, Coragem, Má Fama, Trauma | Vantagem ou desvantagem em testes; o Trauma pede teste de Espírito | Não suportada: o One Piece do app não rola com vantagem | — |
| Impulsivo, Orgulho Cego, Linhagem Demoníaca; 5 perícias | Interpretação; testes fora da luta | Não se aplica à batalha | — |

Já decidido em 01/11 (`PEDIDOS.md:2023-2025`):
- os dois modos valem para o Vagn (a descrição ainda diz "só usa resiliente");
- o "Nível de Polaridade" das técnicas não é conferido;
- a Ignição não trava o fogo;
- o efeito da fruta em quem tem metal fica com a mesa.

## 3. Bugs
**V1. ALTA (regex + leitura). A Armadura Humana na REAÇÃO anula o golpe e ainda dá uma ação extra.** `lib/batalha/tiposDaHabilidade.ts:142` (/devolve/) casa com "absorver e devolver o dano" da Descrição e já marca "Contra". O comentário em `:163` diz que devia sair "escolher". Contra = dano 0 (`lib/batalha/reacao.ts:54-56`) + contra-ataque (`stores/batalhaFabrica.ts:1494-1497`). No Duelo do site, a saída lida da ficha é obrigatória (`lib/treino/duelo.ts:427`).
Caso: Harvey acerta 100 → Vagn usa a Armadura com o que veio marcado → toma 0, paga 25 SP, recarga 4 e ganha Atacar/Habilidade/Mover fora da vez. Pela ficha: toma 90 (defender) ou toma 100 e devolve 14 (atacar).

**V2. ALTA se a P2 for "tipo do corte" (regex). A Projeção Letal abre com Perfurante ligado.** O caminho:
- `lib/batalha/leituraDaFicha.ts:134` (/perfura/) casa com "o dano é perfurante ou cortante";
- passa por `lib/batalha/acoes.ts:292` e `components/batalha/dadosDoMenu.ts:441`;
- em `components/batalha/MiraDoGolpe.tsx:205` o interruptor nasce ligado;
- em `lib/batalha/reacao.ts:104-121` o dano vai direto no HP.

Caso: Projeção (55) num NPC com Escudo 50 e HP 300 que recebe o golpe cheio, sem mexer no interruptor → Escudo 50, HP 245. Esperado: Escudo 0, HP 295.

**V3. MÉDIA (leitura). O Campo de Contenção (Dano "0") vira golpe que espera reação, e com Polaridade machuca.** "-" é lido como sem dano (`lib/batalha/formula.ts:526`), mas "0" é lido como valor 0 (`:536-537`). Alvo com dano diferente de nulo precisa reagir (`lib/batalha/golpe.ts:295-296`). A Polaridade soma em qualquer valor (`formula.ts:510-514`).
Caso: Campo em 2 NPCs → 2 alvos "esperando reação" de 0 de dano. Se o mestre não responde, eles entram na fila de 20 (bug 2 do sistema). Com Polaridade 2, a mira sugere 20 de dano em cada um.

**V4. MÉDIA (leitura). O Campo não se mantém de um turno para o outro.**
- "(Por turno)" é lido (`lib/batalha/leituraDaFicha.ts:56`, `:67`), mas só vira texto (`components/batalha/dadosDoMenu.ts:294`; bug 10 do sistema).
- Usar o Campo marca recarga 2 (`lib/batalha/golpe.ts:274`).
- A Completa gasta a Simples e o Movimento (`lib/batalha/acoes.ts:130`) e o Concentrar precisa da Simples (`:320`). Por isso não dá para manter e concentrar no mesmo turno, como pede o extra "Concentração".

Caso: rodada 1, Campo (SP 120 → 105); rodada 2, aparece "Recarga: 1 turno" e nada é cobrado; rodada 3, usa de novo.

**V5. MÉDIA (leitura). Carregar a Polaridade com um golpe já esperando: ele carrega e ainda reage.** O Carregar só confere a marca "sem reação" (`lib/batalha/contador.ts:134-138`, `stores/batalhaFabrica.ts:1376`). Essa marca só vale para golpe novo (`batalhaFabrica.ts:1573` → `lib/batalha/golpe.ts:296`). Rolar o d20 (`batalhaFabrica.ts:2117-2124`) e reagir com técnica (`:1459`) não conferem a marca.
Caso: Harvey ataca e o golpe espera reação → Vagn usa "Carregar Polaridade (0 de 3)" → aceito → Vagn rola o d20 desse golpe ou usa a Armadura → aceito. A regra R5 diz: sem reação até a vez dele.

**V6. MÉDIA, suspeita (P3). Ignição: o "2 vezes" conta quantas vezes a forma liga, não os ataques adicionais.** Cada ativação soma 1 uso (`stores/batalhaFabrica.ts:1033-1037`). Ligada, dá o adicional em toda rodada (`lib/batalha/transformacao.ts:131-135`). No livro, "pode ser usada 2 vezes por batalha" vem logo depois do ataque adicional (`lib/livroOnePiece.ts:90`). Caso: liga na rodada 1 e não desliga → 6 rodadas, 6 ataques adicionais.

**V7. BAIXA, suspeita (P10). A forma continua ligada depois da batalha.** É a decisão Q3 (`lib/batalha/transformacao.ts:15-16`). O efeito lê a ficha (`:82-97`), mas os usos zeram com a batalha (`lib/batalha/combate.ts:47-48`). Caso: a luta acaba com a Ignição ligada → a próxima começa com +2 e o adicional, e com 0 de 2 usos gastos. Com Resiliente, os −20% continuam sem ninguém ter ligado.

**V8. ALTA (dados; bug 4 do sistema). Sem HP nem SP máximo.** A ficha tem `maximos: {}`, então HP 1000 e SP 120 viram o máximo. Caso: tomou 200 fora da luta e o jogador digita HP 800 → o máximo também vira 800 (P5).

**V9. BAIXA (leitura). No Duelo do site não dá para carregar a Polaridade.** O duelo só aceita agir, reagir, passar, andar e montar (`lib/treino/duelo.ts:165-176`), e o robô nunca usa passiva (`lib/treino/robo.ts:52`).

**V10. BAIXA (leitura). Com 8 selos na ficha, o Carregar fica aceso e nada acontece.** A loja recusa sem avisar (`stores/batalhaFabrica.ts:1381-1382`). O botão só apaga quando ele está sem reação ou no máximo (`components/batalha/FaixaDoJogador.tsx:232`). Junta com o bug 1 do sistema (recusa sem aviso).

Bugs do sistema que também pegam o Vagn (ver `00-bugs-do-sistema.md`):
- bug 2: fila de 20 golpes esperando (o V3 piora);
- bug 3: desfazer a Vez volta a foto do combate e pode devolver a reação gasta na Polaridade;
- P1: o Tempo 4 da Armadura trava 3 vezes dele;
- P5: "Me dar dano" com Resiliente desconta de novo;
- P8: fechar o app devolve os usos da Ignição.

## 4. Automações propostas
- **A1 (V1).** Saída da reação escrita na ficha: um extra "Saída da reação" que vence a leitura do texto. Duas saídas novas: "Reduz N%" e "Toma e devolve 1/N" (o dano volta no atacante, sem reação). Paliativo só de dados: trocar a palavra "devolver" na Descrição.
- **A2 (V2).** Perfurante só com "perfura N%", "ignora armadura/escudo" ou "direto no HP"; "perfurante ou cortante" passa a ser só o tipo do dano. Paliativo: escrever "de ponta ou de corte".
- **A3 (V3).** Dano "0" = sem dano, como "-". A Polaridade não soma em técnica sem dano.
- **A4 (V4).** Técnica mantida:
  - selo "Campo de Contenção" no Vagn, sem turnos;
  - no começo da vez dele, "Pagar 15 SP / Soltar" (o mesmo lembrete "a cada turno" das passivas, `lib/batalha/passivas.ts:670`);
  - recarga só quando soltar;
  - concentrar junto, se a P4 deixar.
- **A5.** Teste de resistência do alvo (Atração: Força; Campo: Espírito): o host rola d20 + modificador do rank do alvo contra a CD do Vagn, como já faz no teste da marca (`lib/batalha/marca.ts:29`, `:129`). Se falhar, põe o selo ("Vulnerável 1"; "Paralisado" até soltar). Paliativo: Tipo "Debuff" + Efeito "Vulnerável por 1 turno" (a reação d20 faz o papel do teste).
- **A6.** Fogo: interruptor "Imbuir fogo +10" na mira das técnicas com "Imbuir Fogo: Sim" (P8).
- **A7 (V5, V9, V10).** Carregar a Polaridade põe "sem reação" nos golpes que já esperam o Vagn (P6). Criar a jogada "carregar" no Duelo. Apagar o botão quando a ficha já tem 8 selos.
- **A8 (V6, V7).** Contar os "Usos por batalha" no ataque adicional (P3); formas "Livre" desligam ao encerrar a batalha (P10).
- **A9.** Resiliente: desliga sozinho quando a "resistência" acabar; golpe Perfurante no Vagn com Resiliente passa pelo Escudo (P9).
- **A10.** Recuperação Espantosa: quando ele cai (HP 0), um lembrete 1 vez por batalha: "Acordar com X HP daqui a N turnos" (P12).
- **A11 (V8).** Gravar HP e SP máximos (P5), com o app fechado e backup antes.

## 5. Perguntas para o mestre (da mais importante para a menos)
1. **Armadura Humana na reação (V1):** (a) duas saídas: Defender toma 90%; Atacar toma 100% e devolve dano ÷ 7 (arredondado para baixo) no atacante; (b) só uma delas (qual?); (c) à mão, sem nada marcado. **Recomendo (a).** O −10% junto com o −20% do Resiliente dá −30% ou −28% (um aplicado depois do outro)? E quando ele usa na vez (Completa), o que acontece?
2. **"Perfurante ou cortante" da Projeção Letal (V2):** (a) é só o tipo do dano e passa pelo Escudo normalmente; (b) perfura tudo e vai direto no HP; (c) perfura só uma parte (quantos %?). **Recomendo (a).** E "em linha reta" acerta 1 alvo ou todos que estão na linha?
3. **Ignição, "2 vezes por batalha" (V6):** (a) 2 ataques adicionais por batalha (no máximo 1 por rodada), e a forma liga quantas vezes quiser; (b) 2 ativações, com adicional em toda rodada (como está hoje); (c) 2 ativações de 1 rodada cada. **Recomendo (a)**, pelo texto do livro.
4. **Campo de Contenção (V3, V4):** (a) fica ligado como um selo, cobra 15 SP no começo de cada vez dele (Pagar ou Soltar), recarga só quando soltar, sem dano e sem reação; (b) cobra por turno e pode ser usado de novo a cada turno, sem recarga; (c) à mão. **Recomendo (a).** Enquanto mantém o campo, ele pode Concentrar no mesmo turno? O "3,5x no final" vale para o próximo golpe depois de 3 concentrações?
5. **HP e SP máximos (V8):** (a) HP 1000 e SP 120; (b) outros números (quais?). **Recomendo (a), se ele estava cheio.** O +100 do Corpo Vigoroso já está dentro dos 1000?
6. **Polaridade com golpe esperando (V5):** (a) carregar põe "sem reação" nos golpes que já esperam o Vagn; (b) não deixa carregar enquanto houver golpe nele; (c) fica como está. **Recomendo (a).** E com Concentração 3: hoje a conta é (55 + 30) × 3,5 = 297; deveria ser 55 × 3,5 + 30 = 222?
7. **Teste de resistência dos alvos (Atração: Força; Campo: Espírito):** em 01/11 ficou com a mesa. Agora: (a) o app rola o teste e põe o selo; (b) usa a reação d20 de sempre (Tipo Debuff); (c) continua à mão. **Recomendo (a).** Quantos Pontos de Proficiência em Fruta ele tem? A CD com concentração (11/14/acerta) substitui a CD da fórmula?
8. **Imbuir Fogo (+10):** (a) interruptor na mira só nas técnicas com "Imbuir Fogo: Sim", apagado quando a Ignição está ligada; (b) +10 sempre nessas técnicas; (c) vale também no Atacar. **Recomendo (a).** Gasta SP?
9. **Resiliente:** "enquanto tiver resistência" quer dizer (a) SP acima de 0; (b) Escudo acima de 0; (c) o mestre decide na hora (fica só texto)? **Recomendo (a).** Golpe perfurante no Vagn com Resiliente passa pelo Escudo? Ele pode trocar de modo fora da vez dele? Hoje só na vez: `stores/batalhaFabrica.ts:992-998`.
10. **Formas no fim da batalha (V7):** (a) Ignição e Resiliente desligam sozinhas; (b) continuam ligadas (como está hoje); (c) continuam, mas a Ignição ligada já conta 1 uso na batalha seguinte. **Recomendo (a).**
11. **Atração Relâmpago como reação:** (a) puxa a arma ou o projétil de metal, o que vale como esquiva; (b) ele toma o golpe e o atacante fica vulnerável; (c) à mão, sem saída marcada. **Recomendo (c)** até essa regra existir.
12. **Recuperação Espantosa:** (a) quando ele cai, um lembrete 1 vez por batalha com o HP e os turnos que o mestre digita; (b) números fixos (quais?); (c) à mão. **Recomendo (a).**
13. **Descrição:** a ficha tem dois blocos (21 anos, Ferreiro; e 25 anos, Gatuno). (a) 21 anos e Ferreiro, que é o que a ficha escolheu; (b) 25 anos e Gatuno; (c) os dois ofícios. **Recomendo (a)** e apagar o outro bloco.

## Pontas soltas
- Nada foi rodado: os números (55, 65, 245, o "Contra" marcado) vêm da leitura do código e das regex no node, não da tela do app.
- A Saúde da ficha (`lib/livros/saude.ts:122`) marca tudo do Vagn como "Lido". Ela não confere Perfurante, saída da reação, Dano "0" nem custo por turno.
- Não olhei a fundo: as telas da caixa de reação e do painel do mestre, a Arena nova (commit 44eca0d2) e a luta automática do treino.