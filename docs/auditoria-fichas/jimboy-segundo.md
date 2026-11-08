NOTA AO ORQUESTRADOR: não gravei o arquivo. Este agente só lê e não pode escrever relatório. Salve o texto abaixo, a partir da linha "# Jimboy Segundo", em C:/dev/labirinto/docs/auditoria-fichas/jimboy-segundo.md.

# Jimboy Segundo: auditoria da ficha (07/11/2026)

- **De onde li a ficha:** `%APPDATA%/com.labirinto.app/pastas/<pasta One Piece>/rpg.json`. Só li, nada foi gravado. Comparei com o `rpg.json.anterior` (31/10): só mudaram o Requisito e o Grupo das 2 formas.
- **Base do sistema:** `docs/auditoria-fichas/00-bugs-do-sistema.md`. O `00-sistema.md` pedido não existe.
- **Caminhos:** contam a partir de `C:/dev/labirinto/client/src/`. Arquivo citado sem pasta está em `lib/batalha/`.
- **O que cada etiqueta quer dizer:**
  - "Provado": rodei em node a regex ou a fórmula do app, copiada, com o texto da ficha.
  - "Leitura": só li o código.
  - "Suspeita": não deu para provar; virou pergunta.

## 1. Resumo
- Tritão cozinheiro de 70 anos, lutador de Karatê Tritão com a Neko Neko no Mi (leopardo). Tem 2 técnicas base e 2 formas do grupo "Neko Neko no Mi", cada forma com 2 técnicas.
- HP 1000, SP 60, Escudo 80, sem máximo gravado. FOR 20, AGI 20, PER 10, RES 40, INT 10, ESP 25, CAR 20, DET 45. No Híbrido: FOR 45, AGI 35, PER 15, RES 65. No Full: FOR 35, AGI 55, PER 30, RES 60.
- O app já faz sozinho dano, custo, recarga, Overload e troca de forma. Falha em três lugares: no Overload (custa mais SP do que ele tem), no Rapid Dash (que tem 2 golpes) e em tudo que é teste, vantagem ou gasto "por turno".

## 2. Habilidades (dano que a mira sugere: base / Híbrido / Full)
| Item | O que diz | Como o app faz hoje | Situação | Onde |
|---|---|---|---|---|
| Atacar (do app, sem arma) | Karatê | Só a Força: 20 / 45 / 35 | automática | formula.ts:86-87, 207-208 |
| Quebra-Queixo | (FOR+40)×1,5; o ×1,5 só vale em ponto vital, depois de analisar; 35 SP, Simples, tempo 3 | 90 / 127 / 112, sempre com o ×1,5; custo e recarga certos | parcial | leituraDaFicha.ts:56, 110-118; formula.ts:496-538 |
| Corta Cenoura | FOR+25; Debuff: atordoa 1 turno se ele vencer uma disputa de d20 (FOR dele contra RES do alvo); 25 SP, tempo 2 | 45 / 70 / 60; sugere o selo "Atordoado 1" (provado), que pega em todo golpe não esquivado; não há disputa | parcial | tiposDaHabilidade.ts:97-123; selos.ts:73, 182-184 |
| NEKO Híbrido (forma) | FOR+25, AGI+15, PER+5, RES+25; 5 SP por turno | Ativar gasta Completa (dá para trocar na tela); bônus e imagem são automáticos; troca com o Full pelo Grupo; os 5 SP por turno só aparecem como texto | parcial | transformacao.ts:143-168, 193-196; components/batalha/ListaDeFormas.tsx:27, 210-220 |
| NEKO Full (forma) | AGI+35, FOR+15, PER+20, RES+20; 10 SP por turno; "anda +2" | Igual ao Híbrido; o +2 está na Descrição, e o app só lê o campo Deslocamento | parcial | transformacao.ts:106-114; lib/sistemaOnePiece.ts:137 |
| Sai Dai Rin: Rokuogan (Híbrido) | ((FOR+ESP)×1,5)×1,5+100; Overload 1 vez por batalha; direto na vida; paralisia de 2 turnos; 105 SP; ele perde metade dos status e 200 de HP; dor aguda por 1 turno | Daria 257 perfurante, sem reação, e travaria o Overload. Mas fica sempre apagada ("SP insuficiente: custa 105, você tem 60"), o selo sai errado e os efeitos nele mesmo não existem | quebrada | acoes.ts:236, 248-253; selos.ts:69, 78, 445-451; golpe.ts:296 |
| Rapid Water Triple Sting (Híbrido) | 20+PER+ESP; alcance 3 quadrados (com concentração 4/6/9); 25 SP, tempo 2 | 60; o alcance não é conferido; o Concentrar multiplica o dano (×1,5 / ×2 / ×3,5), não o alcance | parcial | golpe.ts:161-172, 295; combate.ts:632 |
| Rapid Dash (Full) | Dano 1 = 20+FOR+ESP; extra "Dano2" = metade do Dano 1, perfurante; 40 SP, Completa, tempo 3 | 80 com o golpe INTEIRO perfurante; o Dano2 só aparece como texto | quebrada | leituraDaFicha.ts:134-147; formula.ts:481-494 |
| Predador (Full) | FOR×1,2+AGI, perfurante; 25 SP, Completa, tempo 2 | 97 perfurante | automática | leituraDaFicha.ts:134-147 |
| Corpo Vigoroso | +100 HP | Não é lido (a aba Vantagens não tem bônus numérico). Os 1000 de HP batem com o livro: 900 da RES Rank 2 + 100 | à mão | lib/sistemaOnePiece.ts:103-112; lib/livroOnePiece.ts:30 |
| Preparação Para a Batalha | Ação Simples ou Bônus: +? no status principal por 2 turnos | Não aparece na batalha: só a aba Habilidades e as técnicas da forma ligada viram ação | não suportada | leituraDaFicha.ts:176-186 |
| Comandante Inato | Aliados com vantagem em Determinação; ele escolhe a ordem | O d20 não tem vantagem; a ordem só o mestre arrasta | à mão | lib/dice.ts:29-33; turnos.ts:498-507 |
| Armadura de Músculos, Sensitivo, Força Superior (raça) | Vantagem em: resistir a debuff físico; Intuição; Resistência e Força | A reação é d20 + número digitado + selos; não há vantagem | à mão | components/batalha/CaixaDeReacao.tsx:61-64 |
| Maestria Karatê e outros traços de Tritão | Karatê em potencial máximo; Natação Superior (mais dano na água) | Só texto na Descrição | à mão | lib/livroOnePiece.ts:82-84 |
| Má Fama, Sedutor Incorrigível, Ignorante | Desvantagem em Persuasão; não se concentra perto do interesse amoroso; "-" | Não são lidos; o Concentrar não sabe do Sedutor | à mão | leituraDaFicha.ts:176-186 |
| Perícias (Nutrição, Marcenaria, Culinária, Toxicologia; INT) e ofício Cozinheiro | Conhecimento | Só mostra a etiqueta do atributo; não rola nada | à mão | components/FichaAbas.tsx:157 |
| HP / SP / Escudo | 1000 / 60 / 80 | O Escudo absorve primeiro (certo); HP e SP sem máximo gravado (bug 4 do sistema) | parcial | reacao.ts:104-122; lib/ajusteDaFicha.ts:121-123 |

## 3. Bugs
- **B1. ALTA (leitura). O Sai Dai Rin nunca pode ser usado.**
  - O custo "-105" vira 105 SP (provado, leituraDaFicha.ts:56). Ele tem 60 de SP, e nenhuma forma soma SP. O livro também dá 60: ESP 25 = Rank 1, 20 + 40 (lib/livroOnePiece.ts:30).
  - O menu apaga a técnica com "SP insuficiente: custa 105, você tem 60" (acoes.ts:248-253), e o clique não faz nada (components/batalha/ListaDeTecnicas.tsx:112, 120-122). O host recusa do mesmo jeito (golpe.ts:254-265).
  - Passo a passo: vez do Jimboy → Ativar Híbrido → Técnicas → Sai Dai Rin aparece cinza. Só passa se o mestre subir o SP à mão. Ver Q1.
- **B2. MÉDIA (provado). O selo do Sai Dai Rin sai errado e nunca acaba.**
  - O Efeito diz "causa paralisia de 2 turnos". O app só lê a duração escrita como "por/durante N turnos" (selos.ts:69), e a palavra-chave "paralisa" não casa com "paralisia" (selos.ts:78).
  - Resultado: selo "Sai Dai Rin: Rokuogan" sem turnos (selos.ts:445-451), quando o esperado é "Paralisado 2".
  - Como o Overload tira a reação do alvo (golpe.ts:296), o selo sempre pega. Sem turnos, ele nunca desconta (selos.ts:164): o alvo fica preso até o mestre tirar.
  - Vale para qualquer ficha que escreva "paralisia" ou "de N turnos". Hoje fica escondido pelo B1; a mira deixa corrigir nome e turnos à mão (components/batalha/MiraDoGolpe.tsx:218-219).
- **B3. MÉDIA (provado na regex; o 2º golpe por leitura). Rapid Dash.**
  - O Perfurante liga no golpe inteiro, porque "perfurante" aparece em qualquer campo da técnica (leituraDaFicha.ts:134-147).
  - O 2º golpe (extra "Dano2") nunca vira dano. A fórmula só lê o campo Dano e só avisa quando a MESMA célula tem "Dano 1:" e "Dano 2:" (formula.ts:481-494).
  - Exemplo no Full, contra um alvo com Escudo 80 e HP 500: o app faz Escudo 80 e HP 420. Pela ficha seria Escudo 0 e HP 460 (80 pelo Escudo + 40 perfurante). Ver Q3.
- **B4. BAIXA (leitura). O "anda +2" do Full não entra.**
  - O texto está na Descrição; o app só lê o campo Deslocamento (transformacao.ts:106-114).
  - Exemplo: Full ligado, AGI 55 = Rank 2 → "Mov 2" por Movimento (acoes.ts:75-78, regrasDoCampo.ts:33). Com o +2 seriam 4.
- **B5. BAIXA (= bug 10 do sistema). Custo por turno das formas não é cobrado.**
  - Os 5 e 10 SP por turno só aparecem no Requisito, que o app só mostra (transformacao.ts:143-156).
  - Exemplo: 5 vezes dele com o Full ligado → o SP continua 60, quando deveria estar em 10.
- **B6. ALTA para ele (= bug 4 do sistema). Máximo de HP e SP não gravado.**
  - Se o jogador digitar o SP gasto fora da batalha (ex.: 25), o máximo também vira 25 (lib/ajusteDaFicha.ts:121-123, 246-250).
  - Na batalha, o 1º gasto grava 60, que está certo (lib/ajusteDaFicha.ts:215).
- **B7. Suspeita. Atordoado e Paralisado são só etiqueta.** Um alvo com "Atordoado 1" ataca e usa técnica normalmente, porque golpe.ts:215-268 não olha os selos. A Corta Cenoura e o Sai Dai Rin dependem disso. Ver Q4.

## 4. Automações propostas
**Só mudando dados da ficha (sem código; com o app fechado e backup, como no lote 4):**
- Gravar máximo HP 1000 e SP 60 (Q2). Resolve o B6 dele.
- No Full, pôr "+2" no campo Deslocamento (Q11). Resolve o B4.
- No Sai Dai Rin, trocar o Efeito por "Paralisa o alvo por 2 turnos. O Dano vai direto na vida." Provado: vira "Paralisado 2" e continua perfurante. Resolve o B2 nesta ficha.
- Custo por turno das formas (leitura, falta testar):
  - Em cada forma, criar uma técnica do Tipo Passiva, "Manter a forma", com Efeito "Gasta 10 SP por turno" (5 no Híbrido).
  - Depois de ligada uma vez, ela lembra "Aplicar SP −10 / pular" no começo de cada vez dele (passivas.ts:213-217, 301-312, 658-672) e some quando a forma desliga.
- Rapid Dash sem código, se a resposta da Q3 for A:
  - Dano "(20 de dano base + Força + Espírito) * 1,5" e Efeito "perfura 33%". Dá 120, com 39 direto no HP (a leitura do "perfura 33%" foi provada).
  - Perde a reação separada para cada golpe.
- Preparação Para a Batalha, depois da Q13: copiar para Habilidades como Tipo Buff, Ação Simples, Efeito "+N de <atributo> por 2 turnos". O texto atual ("durante os próximos dois turnos") não é lido (provado).

**Mudanças no código do app:**
- selos.ts:
  - Aceitar "paralisia/paralisado", "de N turnos" e "N turnos".
  - Avisar quando um Debuff não tem duração.
- Golpe em partes: "Dano 2" ou o extra "Dano2" viram um 2º golpe, cada parte com o seu Perfurante.
- Forma com custo por turno (Q6, = P6):
  - Cobrar no começo da vez do dono, com Desfazer.
  - Oferecer desligar a forma quando o SP não der.
- Overload (Q1, Q7):
  - Um custo que pode passar do SP (ou "todo o SP").
  - Efeitos em quem usa: −200 HP, selo "Overload" com −50% dos atributos, selo "Dor aguda 1".
- Disputa no Debuff (Q5, Q14):
  - O host rola d20 + modificador do rank (`modificadorDoTeste`, marca.ts:134-139), FOR do Jimboy contra RES do alvo.
  - O selo só pega se ele vencer.
  - Com vantagem (2 d20, fica o maior) quando a ficha tem.
- Selo que tira a vez (Q4).
- Aviso de alcance da técnica usando medicao.ts (Q10).

## 5. Perguntas para o mestre (da mais importante para a menos)
- **Q1.** Sai Dai Rin custa 105 SP e o Jimboy tem 60, que é o máximo pelo livro. Como ele usa?
  - A) O custo certo é outro, até 60 (qual?).
  - B) Overload pode gastar todo o SP que tiver, sem bloquear.
  - C) O SP máximo dele é maior (qual?).
  - Recomendo A agora (só dado); B se for regra de todo Overload.
- **Q2 (= P7).** HP 1000 e SP 60 são os máximos de verdade? O +100 do Corpo Vigoroso já está nos 1000?
  - A) Sim, gravar 1000 / 60.
  - B) O HP máximo é 1100.
  - C) Outros números.
  - Recomendo A: bate com o livro (RES Rank 2 = 900 + 100; ESP Rank 1 = 60).
- **Q3.** Como funciona o Rapid Dash?
  - A) Dois golpes: o 1º com o Dano 1 passando pelo Escudo, o 2º com metade, perfurante (120 no Full).
  - B) Um golpe só, com metade do dano ("metade do seu dano base"), perfurante.
  - C) Um golpe só, Dano 1 inteiro perfurante (como o app faz hoje).
  - Recomendo A.
- **Q4.** O que "stunado" e "paralisia" fazem na vez do alvo?
  - A) Só "Passar a vez" fica liberado.
  - B) Pode mover, mas não atacar nem usar técnica.
  - C) Só aviso; o mestre decide (como hoje).
  - Recomendo A para Atordoado e Paralisado.
- **Q5.** Como fica a disputa da Corta Cenoura?
  - A) Depois do acerto, o app rola a disputa (d20 + modificador de FOR do Jimboy, com vantagem da Força Superior, contra d20 + modificador de RES do alvo) e só põe Atordoado se ele vencer.
  - B) A reação do alvo já é a disputa: acertou, atordoou (como hoje).
  - C) O mestre rola e tira o selo à mão.
  - Recomendo A.
- **Q6 (= P6).** Os 5 / 10 SP por turno das formas:
  - A) Cobrar sozinho no começo de cada vez dele e desligar a forma quando faltar SP.
  - B) Lembrete "Aplicar / pular" (dá para fazer hoje só com dado, ver seção 4).
  - C) À mão.
  - Também cobra na vez em que ele ativa? Recomendo B agora e A depois.
- **Q7.** Depois do Sai Dai Rin, "perde metade dos Status" é:
  - A) Metade de cada atributo até o fim da batalha.
  - B) Metade do HP e do SP atuais.
  - C) Só narrativo.
  - Os 200 de vida saem sempre, mesmo errando? E a "dor aguda" faz o quê?
  - Recomendo A, os 200 sempre, e a dor aguda como selo de 1 turno nele mesmo (o efeito do selo segue a Q4).
- **Q8.** No Sai Dai Rin, qual conta vale?
  - A) A fórmula do campo Dano: ((FOR+ESP)×1,5)×1,5+100 = 257.
  - B) A descrição: "dano crítico + 1,5x + a força base" (qual conta?).
  - Recomendo A.
- **Q9.** No Quebra-Queixo, o ×1,5:
  - A) Só vale no ponto vital: a mira pergunta "acertou ponto vital?"; sem ele, 60 na forma base.
  - B) Vale sempre (como hoje, 90).
  - C) "1,5x a mais" quer dizer ×2,5 no ponto vital.
  - E "analisar" gasta ação ou pede teste de Percepção? Ele não tem a perícia Analisar Criatura.
  - Recomendo A, com analisar sem custo.
- **Q10.** No Rapid Water, concentrar:
  - A) Só aumenta o alcance (4/6/9 quadrados), e o app para de multiplicar o dano dela.
  - B) Aumenta o alcance e o dano (como hoje).
  - Ela é Karatê Tritão (vale sem forma, iria para Habilidades) ou só existe no Híbrido? "Triple" quer dizer 3 golpes?
  - Recomendo A, e mantê-la só no Híbrido.
- **Q11.** O "anda +2" do Full é:
  - A) +2 casas em cada Movimento (como a Ignição).
  - B) +2 na vez inteira.
  - C) Só narrativo.
  - Recomendo A.
- **Q12.** Transformar (e trocar Híbrido ↔ Full) gasta:
  - A) Completa (hoje, com o campo Ação vazio).
  - B) Simples.
  - C) Bônus ou Livre.
  - Recomendo A, escrita no campo Ação das duas formas.
- **Q13.** Preparação Para a Batalha dá quanto, e em qual atributo?
  - A) +N de Força por 2 turnos (o dano dele usa Força).
  - B) +N de Determinação (o maior atributo dele, 45).
  - C) Fica narrativa.
  - Recomendo A, com o N dito pelo mestre.
- **Q14.** Vantagem em teste (Força Superior, Armadura de Músculos, Sensitivo, a Determinação do Comandante Inato) e a desvantagem da Má Fama:
  - A) O host rola 2 d20 e fica com o melhor ou o pior, na reação e na disputa.
  - B) Vira +N fixo no modificador.
  - C) À mão, no dado da sala.
  - Recomendo A, só dentro da batalha.
- **Q15 (P8).** A ficha diz Overload "uma vez na batalha"; o livro diz "uma vez no dia" (lib/livroOnePiece.ts:24). Hoje vale por batalha e zera se o app fechar.
  - A) Por batalha.
  - B) Por dia ou sessão.
  - Recomendo A.

## Pontas soltas
- Não rodei o app nem a store da batalha. "Provado" aqui é só a regex ou a fórmula do app copiada e rodada em node com o texto da ficha; o resto é leitura de código.
- O treino do Lobby usa as mesmas leituras (lib/treino/duelo.ts:4-16), então os bugs devem valer lá também. Não conferi a tela do jogador, o robô do treino nem a cópia publicada no Lobby.
- O livro não tem regra para a ação de transformar, para "stun" nem para "ponto vital". A Natação Superior (mais dano na água) não tem número.