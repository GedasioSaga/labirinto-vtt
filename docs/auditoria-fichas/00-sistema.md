Não gravei o arquivo: sou um agente só de leitura. O texto abaixo é o conteúdo pronto de `C:/dev/labirinto/docs/auditoria-fichas/00-sistema.md`.

# 00 · Sistema: o que a batalha One Piece faz sozinha e o que é feito à mão (07/11/2026)

**Fonte das fichas:** `%APPDATA%/com.labirinto.app/pastas/pasta_2289218d-…/rpg.json` (pasta "One Piece"), lido sem alterar. São 10 jogadores mais "Saga", que está vazia. Somam 44 habilidades (só 19 com Tipo preenchido), 9 transformações com 13 técnicas dentro e 9 armas. O arquivo mudou às 21:07, no meio da leitura: a arma "Pá" do Harvey apareceu. Revalidei todos os casos às 21:14.

**Legenda do estado:**
- **AUTO**: o app faz sozinho. É sugestão que a pessoa pode editar.
- **PARCIAL**: faz uma parte.
- **MÃO**: a pessoa faz pelo Ajustar, pelo Dar dano ou editando o selo.
- **NÃO**: não existe no motor.

**Onde ficam os arquivos citados** (os nomes curtos abaixo apontam para estas pastas):
- `C:/dev/labirinto/client/src/lib/batalha/`: formula, leituraDaFicha, tiposDaHabilidade, selos, combate, golpe, acoes, reacao, reacaoComTecnica, turnos, passivas, transformacao, invocacao, escolhaEEvolucao, marca, contador, ferramentasDoJogador
- `C:/dev/labirinto/client/src/stores/`: batalhaFabrica.ts, batalhaStore.ts
- `C:/dev/labirinto/client/src/lib/`: ajusteDaFicha.ts, sistemaOnePiece.ts, personagem.ts, livros/saude.ts, treino/duelo.ts
- `C:/dev/labirinto/client/src/components/batalha/`: MiraDoGolpe.tsx, PassivasDaBatalha.tsx, CaixaDeReacao.tsx, dadosDoMenu.ts
- `C:/dev/labirinto/client/src/net/batalhaNoHost.ts`

## Mapa

| Tipo de efeito | Estado | Onde o motor trata | O que fica de fora |
|---|---|---|---|
| Dano por fórmula (atributos, números, "x", parênteses, "1,5") | AUTO | formula.ts:496-538; golpe.ts:293-302 | Dado ("1d6"), texto solto; com "Dano 1:/Dano 2:" lê só o 1º e avisa (formula.ts:481-494); dano vazio = a pessoa digita |
| Dano em % da vida do alvo | PARCIAL | formula.ts:433-445 | O jogador não vê o HP do NPC, então digita |
| Dano da arma, bala, "Soma no ataque" | AUTO | formula.ts:207-212, 363-397 | Campos Ação e Modificador da arma nunca são lidos (sistemaOnePiece.ts:159-160); o Atacar é sempre Simples (golpe.ts:331); o Efeito da arma é só texto |
| Perfurante e % que perfura | AUTO (o interruptor já vem ligado) | leituraDaFicha.ts:134-167; reacao.ts:89-94 | Também lê a Descrição (B5) |
| Escudo absorve antes do HP | AUTO | reacao.ts:104-122 | O Escudo só volta pelo Ajustar |
| Custo em SP ou HP | AUTO (cobra uma vez) | leituraDaFicha.ts:56-79; golpe.ts:281-286 | Custo em % vira pergunta; custo extra opcional (Imbuir +10 SP) não tem campo, só dá para editar o custo quando ele é pergunta (MiraDoGolpe.tsx:550); "perde 200 de vida" escrito num extra não é cobrado |
| Custo "por turno" e manter forma ("Gasta N SP por turno") | MÃO | leituraDaFicha.ts:67 lê; dadosDoMenu.ts:294 só mostra; transformacao.ts:143-156 (Requisito só aparece na tela) | Campo de Contenção, Neko Full, Forma Híbrida 2 e 3 |
| Ação (Simples, Completa, Bônus, Livre, Reação) | AUTO | leituraDaFicha.ts:82-104; acoes.ts:81-150 | Bônus só existe quando o mestre dá (acoes.ts:88, 185) |
| Tempo: recarga N, "N vezes por combate", Overload | AUTO | leituraDaFicha.ts:106-125; golpe.ts:271-278; turnos.ts:470-483 | Tempo 1 = pode usar toda vez (decisão no plano F2, linha 223); um Overload usado trava todos os Overload do personagem (acoes.ts:236); limite escrito no Efeito ("3 vezes") não conta |
| Concentrar (carga 1 a 3) | AUTO, genérico | combate.ts:630-634; acoes.ts:316-331; reacao.ts:61-65 | Só multiplica o dano (×1,5, ×2, ×3,5) e zera em qualquer golpe (golpe.ts:370-371). O extra "Concentração" de cada técnica (alcance, duração, cura, teste automático) não é lido; só o Ultra da invocação lê (invocacao.ts:107) |
| Surpresa | AUTO | reacao.ts:61-65; golpe.ts:296 | ×1,5 e o alvo não reage |
| Reação d20 do alvo | AUTO | reacao.ts:20-70 | 1 natural = crítico ×1,5; total 10+ = metade, 15+ = esquiva, 20+ = contra. O modificador é digitado ou lembrado, mais os selos (CaixaDeReacao.tsx:61-62); nunca vem do atributo |
| Reação com técnica (esquiva, metade, contra, rolar) | PARCIAL | tiposDaHabilidade.ts:134-171; reacaoComTecnica.ts:210-239 | A saída é adivinhada do texto (B7). Condição ("corpo a corpo", "só fogo") não é conferida. Devolver dano não é calculado: Contra = 0 de dano e 1 ação a mais (batalhaFabrica.ts:1493-1497) |
| Contra-ataque (tirou 20) | AUTO | batalhaFabrica.ts:2159-2163; golpe.ts:131-136 | Ganha uma ação fora da vez |
| Selo de condição (Atordoado, Cego, Sangrando, Queimando, Envenenado, Paralisado, Lento, Preso, Confuso) | PARCIAL: só etiqueta com contagem | selos.ts:38, 69-119, 159-174; turnos.ts:376-382, 430-445 | Atordoado não pula a vez; Sangrando não tira HP; Lento e Preso não travam o movimento (acoes.ts:30-32: "conta, não trava"); 1 selo por golpe (combate.ts:413-414); a duração só sai de "por/durante N turnos" (B2) |
| Buff e Debuff com número (atributo, Dano, Reação) | AUTO (sugestão) | selos.ts:214-237, 315-452; formula.ts:348-355, 510-515 | Só inteiro fixo: "1,2x do Espírito", %, "precisão +20" e HP/SP ficam de fora (selos.ts:412-421); só soma no dano que a fórmula calculou |
| Cura de técnica (HP ou SP) | MÃO | Não existe caminho no golpe; lerMods exclui HP e SP | Ajustar (batalhaFabrica.ts:1315-1360). O jogador só ajusta a própria ficha (batalhaNoHost.ts:340-343, 580): curar aliado depende do mestre |
| Dano por turno, dreno de SP, roubo de vida | NÃO | Os selos só contam turnos (selos.ts:159-174) | Yamato, Chamas Celenas, Benção da Raposa, Planta Carnívora |
| Remover ou dobrar debuff | MÃO (só o mestre) | batalhaFabrica.ts:2314-2337; o jogador não tem esse pedido (batalhaStore.ts:86-102) | Revigorar, Explosão |
| Passiva com gatilho (início, rodada N, vida abaixo de N%) | PARCIAL por decisão | passivas.ts:29-44, 145-167, 404-417, 611-629 | Lembra e pergunta, nunca liga sozinha; "requisito" só aparece na tela; o efeito "a cada turno" sai pelo botão Aplicar (passivas.ts:301-312) |
| Transformação (mods, troca por Grupo, Livre, usos, deslocamento, ataque extra, dano recebido) | AUTO | transformacao.ts:28-142, 158-168, 278-299; batalhaFabrica.ts:874-879, 2188-2198 | Continua ligada depois do Encerrar (transformacao.ts:314-329); ligar pela ficha não dá o ganho nem gasta ação (transformacao.ts:15-16); só na vez do dono (batalhaNoHost.ts:348-349) |
| Invocação | AUTO (o mestre põe no mapa) | invocacao.ts:27-47, 226-282; batalhaFabrica.ts:776-797 | O invocado não reage (combate.ts:217-221) |
| Escolha "um ou outro" | AUTO | escolhaEEvolucao.ts:44, 146-156, 196-205 | Só extras chamados "Opção", "Variante" ou "Efeito N" |
| Evolução | PARCIAL | escolhaEEvolucao.ts:15-26 | A condição não é conferida; o custo é digitado |
| Marca (dobro de dano no próximo acerto) | AUTO | marca.ts:19-45, 172-207 | Não tem turnos (marca.ts:143) |
| Contador (Polaridade) | AUTO | contador.ts:8-22, 81-91; batalhaFabrica.ts:1363-1397 | O dano a mais só entra no dano que a fórmula calculou |
| Área e vários alvos | MÃO | combate.ts:619 (até 12 alvos); MiraDoGolpe.tsx:256-260 | Quem está na área é marcado à mão; Círculo e Cone só medem (ferramentasDoJogador.ts:16-37); "dano dividido" é à mão |
| Alcance | NÃO conferido | golpe.ts:161-172 não olha a distância | As ferramentas Medir e Visão ajudam |
| Teste de resistência com CD, disputa de dados | NÃO (fora o teste da marca) | reacao.ts:20-32; marca.ts:69-78 | Aira, Explosão, Gilgamesh, Corta Cenoura, Vagn |
| Vantagem e desvantagem; abas Perícias, Vantagens, Desvantagens, Itens | NÃO | Nenhuma leitura em lib/batalha | O "[AÉREO] não pode desviar" também não |
| Empurrar, puxar, armadilha, barreira, ataque de oportunidade | NÃO | — | O mestre arrasta o token |
| Atacar duas vezes, segundo golpe da técnica | PARCIAL | Ações extras do mestre (turnos.ts:55-63; batalhaFabrica.ts:2218); Ataques extras da forma (transformacao.ts:116-119) | O extra "Dano2" não é lido |
| Efeito colateral do Overload ("perde metade dos status") | MÃO | — | Está em toda técnica Overload das fichas |
| Requisito de técnica (alvo sob X, nível N, outra técnica ativa) | NÃO conferido | Só a passiva lê requisito (passivas.ts:62-67, 161-166) | Orquídea: Florescer, Nível de Polaridade |
| Força do NPC (Mundo do Livro) e cartão marcado "À mão" | AUTO | formula.ts:447-458; personagem.ts:61-67 | O cartão "À mão" é recusado no duelo do Lobby (duelo.ts:347); a "Saúde da ficha" só mede Custo, Dano, Ação e Tempo, nunca o Efeito (saude.ts:26-28) |

### Bugs com prova (entrada → saída)

- **B1. Habilidade com Ação "OVERLOAD / TRANSFORMAÇÃO" na aba Habilidades não tem como ser usada.** O menu apaga com "É transformação: use a tira Transformação" (acoes.ts:233). Só que a tira e o pedido olham apenas as abas com modificadores (transformacao.ts:200 e 215 → ajusteDaFicha.ts:87-88; sistemaOnePiece.ts:142), e o pedido é recusado com "Forma não encontrada" (golpe.ts:232-233). Caso: Alexei, "A Caçada Começa" fica apagada e a tira Transformação está vazia.
- **B2. Selo que nunca acaba.** Só "por/durante N turnos" vira duração (selos.ts:69), e o sinal `/paralisa/` não casa com "paralisia" (selos.ts:78). Saídas reais:
  - Pazada: "stun/paralisia de 1 turno" → Atordoado sem turnos.
  - Gilgamesh: "atordoamento de 1 turno" → Atordoado sem turnos.
  - Yamato: "pelos próximos 2 turnos" → Sangrando sem turnos.
  - Sai Dai Rin: "paralisia de 2 turnos" → selo "Sai Dai Rin: Rokuogan" sem turnos.

  Esse selo já vem marcado na mira (MiraDoGolpe.tsx:217) e só sai quando o mestre tira.
- **B3. Dano "0" não é tratado como "sem dano".** Só "-" é sem dano (formula.ts:526; dadosDoMenu.ts:321-324). Com "0", o golpe sai com dano 0 e o alvo é obrigado a reagir (golpe.ts:295-296). Casos com Tipo vazio (vira Ativa): Medicina (Harvey), Fúria do Dragão (Ryoko), Campo de Contenção (Vagn). O registro escreve "recebeu 0".
- **B4. Selo sugerido cai no alvo errado.** Uma técnica Ativa lê o "durante N turnos" também da Descrição (tiposDaHabilidade.ts:119-121 → selos.ts:44, 113-119). Caso: "A Luz do Sol Brilha Sobre Todos" diz "Durante 1 turno, todos os aliados…" e o selo "A Luz do Sol Brilha Sobr 1" vai no INIMIGO atingido.
- **B5. Perfurante ligado pela Descrição** (leituraDaFicha.ts:142-146; o interruptor nasce ligado em MiraDoGolpe.tsx:205). "Projeção Letal" diz "perfurante ou cortante" e "Rapid Dash" diz "O segundo golpe é dano perfurante": as duas ligam o golpe inteiro. Se ninguém desligar, o dano pula o Escudo.
- **B6. O Ajustar não olha o gatilho de vida.** `ajustarNaBatalha` (batalhaFabrica.ts:1315-1360) não chama `lembrarDepoisDoDano`, ao contrário do Dar dano (batalhaFabrica.ts:2206-2210). Caso: May com 60%, o mestre ajusta o HP para 40% e a Fortaleza não lembra até o próximo dano.
- **B7. Armadura Humana (Vagn) sugere "Contra"**, isto é, 0 de dano e uma ação a mais. A leitura procura na ordem rolar, contra, esquiva, metade (tiposDaHabilidade.ts:140-145), e a Descrição tem "devolver o dano". A ficha diz −10% de dano, ou tomar tudo e causar o dano dividido por 7.
- **B8. Opção de passiva que é para si cai no oponente.** O alvo vem só do Efeito principal (passivas.ts:234-237) e a tela exige escolher um oponente (PassivasDaBatalha.tsx:251, 315-316). Caso: Melodia, opção "Dado de reação" (+1): o selo vai no oponente, e é o oponente que ganha +1 nas reações (selos.ts:214-237).
- **B9. Concentração contra a ficha.** Qualquer golpe zera a carga (golpe.ts:370-371). "Em Meio às Alegres Nuvens" (Aira) diz "Recebe um acúmulo de Concentração": o app tira em vez de dar.
- **B10. No duelo do Lobby, o Atacar ignora o bônus dos selos.** `duelo.ts:320` usa `danoSugeridoDoAtaque` (golpe.ts:501-503), que não recebe o bônus. A técnica soma (duelo.ts:343-345) e o Atacar do app também soma (dadosDoMenu.ts:523). Caso: Polaridade 2 (+20) → o Atacar no duelo sai sem os +20.
- **B11. Arma "Pá" (Harvey) com Dano "10 Força".** A fórmula não aceita palavra sobrando (formula.ts:238, 400-406). Resultado: o Atacar com a Pá cai em "digite o dano".

## Como se conecta

- A ficha é texto livre. Ela vem do `rpg.json` pela aventura, e leituraDaFicha, formula, tiposDaHabilidade, selos e passivas leem esse texto na hora; nenhuma regra fica gravada.
- A tela (dadosDoMenu → MiraDoGolpe, CaixaDeReacao, PassivasDaBatalha) mostra a sugestão, a pessoa edita, e o pedido passa pelo host (batalhaNoHost.ts) até a store (batalhaFabrica.ts: agir, reagir, passiva, invocar, ajustar).
- A store confere a regra (golpe.ts `podeAgir`, acoes.ts `motivoDaTecnica`) e cobra custo e dano na ficha (`mexerNaFicha`). Recargas, selos, carga e golpes pendentes ficam em `TurnosDaCena`, só na memória.
- O host confia no número de dano que vem da tela (golpe.ts:60-61). Só o duelo do Lobby recalcula pela ficha (duelo.ts:52-60).
- Na troca de vez, turnos.ts desconta selos e recargas e passivas.ts põe os lembretes.

## Pontas soltas

**Suspeitas (não testei):**
- **S1.** A batalha vive só na memória do app do mestre (batalhaStore.ts:80; turnos.ts:16-18; batalhaFabrica.ts:1672-1675). Fechar, recarregar ou atualizar o app no meio zera recargas, usos, Overload, carga, selos e golpes pendentes. HP, SP e formas ligadas ficam, porque estão na ficha. É forte candidato ao "bugou do nada".
- **S2.** O "Dar a vez" do mestre desce a recarga a cada começo de vez, sem trava por rodada (turnos.ts:423-428, 460-483). Passar a vez para outro e voltar pode zerar a recarga.
- **S3.** No duelo do Lobby, custo que é pergunta ("10% do HP", Chamas Celenas) vai como vazio (duelo.ts:362) e a store recusa (golpe.ts:262). Não segui a tela do duelo.
- **S4.** A Fortaleza continua lembrando "Aplicar" mesmo com a vida acima de 50%, porque o gatilho não é conferido de novo (passivas.ts:658-673). E "Agora não" faz o lembrete não voltar mais nesta luta (passivas.ts:538-542; batalhaFabrica.ts:1111-1113).
- **S5.** Tipo vazio vira Ativa (tiposDaHabilidade.ts:78). Revigorar, Medicina e Fúria do Dragão abrem a mira já no inimigo (MiraDoGolpe.tsx:190-195).

**Perguntas de sistema para o grilling** (valem para várias fichas):
1. Atordoado e Paralisado devem pular a vez sozinhos? Sangrando, Queimando e Envenenado devem tirar HP sozinhos? Quanto?
2. Custo "por turno" e "Gasta N SP por turno" das formas devem ser cobrados no começo da vez? Se o SP acabar, a forma cai?
3. Debuff com "teste CD" (Aira, Gilgamesh, Explosão, Corta Cenoura): troca a reação de sempre (15+ esquiva) por um teste contra a CD da ficha?
4. O extra "Concentração" de cada técnica deve valer no lugar do multiplicador de dano? Técnica sem dano deve zerar a carga?
5. Cura de técnica (Medicina, Revigorar, Recuperação de forças) deve ser aplicada sozinha, também em aliado?
6. A marca do Vincent dura 3 turnos (como diz a ficha) ou até o próximo acerto (como o app faz hoje)?
7. A forma ligada pelo menu deve desligar no Encerrar?
8. Ação Bônus: Orquídea: Florescer fica apagada sem bônus dado pelo mestre. É isso mesmo?
9. Tipo "Reação" com Ação "Simples/Reação" (Recuperação de forças) pode ser usado também na vez?
10. "Perde metade dos status" do Overload deve ser aplicado sozinho? E 1 Overload por batalha trava todos juntos?
11. Ignição e Resiliente estão no mesmo Grupo "Lunariano", então se trocam (Siegfried e Vagn não ficam com as duas ligadas). É isso mesmo?
12. Tempo "1" significa usar toda vez (como diz o plano) ou esperar 1 turno?

**Não coberto:**
- Batalha Dragon Ball (lib/dbt/batalha, stores/batalhaDBTStore.ts), a Arena (lib/arena), o Desfazer e o registro (registro.ts), a vista do jogador e a rede (vistaDoJogador.ts, net/), o robô e as lutas automáticas do treino.
- Não rodei o app nem os testes. As leituras de selo e de perfurante sobre as fichas reais eu conferi copiando as mesmas regras de leitura do app num script node à parte, sem executar o código do app.