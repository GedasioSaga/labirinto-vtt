# Conserto e automação das fichas (08/11/2026)

Base: `docs/auditoria-fichas/00-bugs-do-sistema.md` (12 bugs), os 11 relatórios por personagem e as
respostas do grilling em `docs/auditoria-fichas/respostas-do-grilling.md` (tudo respondido em 07-08/11).

Regra de trabalho: a batalha (`client/src/lib/batalha/`, `client/src/stores/batalhaFabrica.ts`) é um
sistema só, então tem **1 dono por vez, em sequência** (nada de vários escritores na batalha ao mesmo
tempo). Testes: no máximo 2 por situação durante a construção; a bateria completa só no fim.

## F0. Dados das fichas (sem código; app FECHADO e backup antes)
- Gravar os máximos (bug 4): Saga 700/60, Jimboy 1000/60, May 700/60, Aira HP 900, Vagn 1000/120,
  Ryoko 700/240, Harvey 700/60, Siegfried 900/140.
- Devolver as mochilas apagadas pela migração (B1): Vincent, Aira, Alexei, May.
- Corrigir dados: Rifle 20, Lança 20, Pá 10 em todos os golpes do Harvey, Bala de Prata como tipo de
  bala (+metade da Percepção), Boomerang como arma de arremesso, 1 Acrobacia, "Cirurgia", Vagn 21 anos
  Ferreiro, Harvey "Amaldiçoado: Infâmia", textos novos da Aira e do Alexei, formas (Caçada do Alexei
  como forma), arma padrão do Siegfried.
- Depois: "Publicar no Lobby" para o site ficar igual.

## F0c. Dados que a F2 achou faltando na ficha (sem código; app FECHADO e backup antes)
- Alexei, A Caçada Começa: hoje está na aba Habilidades, com Ação "OVERLOAD | TRANSFORMAÇÃO" e sem o
  campo de ataques extras, então o app não liga a forma e o Alexei transformado ataca 1 vez só.
  Mover o cartão para a aba Transformações, com Ação "Completa" e Ataques extras "1" (o "pode atacar
  2 vezes" do mestre). O código já lê isso: `formasNoMenu` e `efeitosDasFormasLigadas`
  (`client/src/lib/batalha/transformacao.ts`); o teste `mecanicasAMao.fatiaC.test.ts` simula a ficha
  já mudada. Até o F0c gravar, o ataque duplo da Caçada não existe no app.
- Vagn, Mecânicas gerais da fruta: falta o número de "Pontos de Proficiência em Fruta" (a CD do Campo e da
  Atração é 10 + Proficiência + mod. de ESP). A ficha não diz; perguntar ao mestre e gravar onde a F2 do
  Campo for ler (a fatia D não criou extra com nome mágico para isso).
- Vagn, Projeção Letal: "em linha reta" sem alcance. Com o alcance (em casas) a mira pode marcar sozinha
  quem está na linha (`area.ts`, forma `linha`); até lá o jogador marca.

## F1. Regras do sistema e os 12 bugs (1 dono, em sequência)
- Bugs 1-12 (recusa muda, golpe sem resposta vira "Não reagiu" na virada da rodada, desfazer "Vez",
  máximo, −/+ rápido, Salvar do jogador, vez pula, ficha emprestada, desfazer forma tira o que deu,
  custo por turno, gravação recusada, barra do Escudo).
- Regras: Tempo N bloqueia N vezes; recarga e selo descem por vez (carta extra); batalha salva volta
  ao reabrir; +10 SP por vez sem gastar SP; técnica cara fica bloqueada com o motivo; Overload não erra
  (só outra Overload defende), gasta ação Completa, 1 por batalha, e deixa os atributos base pela metade
  até o fim; formas desligam no fim da batalha; Escudo volta cheio; Atordoado só "Passar a vez";
  vantagem/desvantagem = 2 d20; Sangramento com botão Aplicar, direto no HP; Determinação rank 4 avisa
  e aplica −10%; "Me dar dano" com Resiliente desconta e avisa; Preparação para a Batalha (+20 no
  atributo escolhido, pergunta no início); ao transformar, o app pergunta a ação ao jogador.

## F2. Automação por personagem (1 dono, em sequência, ficha por ficha, PROGRAMADA À MÃO)
Decisão do mestre (08/11): as fichas que já existem são programadas à mão; o construtor de mecânicas (docs/planos/construtor-de-mecanicas-2026-11-08.md) é para as próximas técnicas, principalmente de NPC.
Disputas que o app rola (Corta Cenoura, dança da Aira, Explosão, Entardecer, Imã-Gumelo, Campo de
Contenção com a CD da fruta), áreas (Aplauso 6x6, Giro de Pá, Lua Incandescente dividida, Projeção em
linha), selos (Aéreo, Cego zera Percepção, Ferido por prata só lembrete, Queimando 1 turno), perguntas
na hora (cortante ou perfurante, qual arma, vantagem da Ryoko), contas (Sai Dai Rin, Grande Chifre por
quadrado empurrado, Polaridade x3,5 no todo, furtivo x3 com Surpresa x1,5, Bala de Prata 72).

À mão DE PROPÓSITO até a armadilha virar token (peça do construtor, junto do companion da F3.5): as
armadilhas do Alexei. O Armadilhar (fatia C) só posiciona: cobra 20 SP, gasta a Simples, sai sem alvo e
põe a armadilha escolhida no registro (`client/src/lib/batalha/mecanicasAMao.ts`, cartão Armadilhar).
O app não sabe ONDE a armadilha ficou nem QUANDO alguém pisa, então não tem como achar quem está perto.
Por isso, linha por linha do grilling (Imã-Gumelo):
- "o app pergunta a cada um perto (inimigo e aliado) se tem metal grande": à mão. O mestre pergunta na
  mesa. Falta a posição da armadilha para achar o 5x5.
- "Imã-Gumelo, perto: ÁREA 5x5 em volta do cogumelo": à mão, pelo mesmo motivo (sem token, sem centro).
- "quem disser sim fica travado": à mão, ajudado. O mestre põe o selo "Preso pelo Imã-Gumelo" à mão
  em quem disse sim; a pílula do selo lembra a regra (`client/src/lib/batalha/condicoes.ts`, tabela de selos).
- "para mover ou arremessar, d20 puro >= 12": à mão, ajudado. O lembrete do selo diz "d20 12 ou mais";
  o mestre rola na hora em que a pessoa tenta. Automatizar pede o teste dentro do Mover e do arremesso,
  que é o mesmo trabalho do token de armadilha.
O mesmo vale para a Batata-mina (50 em todos na 3x3 de quem pisou) e a Emaranhalga (selo "Enraizado").

Fatia D (Vagn e Guilherme), feito em `client/src/lib/batalha/mecanicasAMao.ts` (tabela) e nas funções gerais
(`reacaoComTecnica.ts`, `disputaNoUso.ts`, `debuffs.ts`, `transformacao.ts`, `golpe.ts`, `contador.ts`):
Armadura Humana (Defender 90% / Atacar 100% e devolve ÷ 7), Resiliente o combate inteiro (já era; provado),
Projeção Letal (cortante = Sangramento 10 por 3; perfurante = direto no HP; Imbuir Fogo +10 vetado com a
Ignição), Ignição (liga sem limite; 2 ataques adicionais por batalha no total), Polaridade (297; não carrega
com golpe esperando), Campo sem dano e sem reação, Explosão (teste ao usar, não gasta se passar, 10% da vida
atual direto no HP, dobra os debuffs), Giro como reação (+1 sozinho, 10+ anula), Revigorar (tira os debuffs
e o cansaço, cura o Espírito, nele ou num aliado), Recuperação Espantosa do Guilherme (aviso).
Revisão da fatia D, a peça "técnica mantida" (campo `mantida` da tabela, `client/src/lib/batalha/mecanicasAMao.ts:291`
e `:317`): usar liga a técnica sem recarga (`golpe.ts:372`, também na reação); no começo de cada vez do dono sai o
lembrete na mesma faixa do custo da forma (`passivas.ts:682`; `custoPorTurno.ts:70` e `:147`). "Manter" paga (Giro 30 SP;
Campo os 15 SP "por turno" da ficha e +1 Concentração por vez até 3, `custoPorTurno.ts:94`); "Parar", ou não ter o SP,
desliga, começa a recarga (Tempo N trava esta vez e as N-1 seguintes, `custoPorTurno.ts:105`) e tira os selos que a
técnica pôs (store `custoDaMantidaNaVez`, `batalhaFabrica.ts:1452`). Campo: usar não gasta a carga guardada
(`mecanicasAMao.ts:718`, `golpe.ts:470`); os marcados ficam "Preso no Campo de Contenção" (`condicoes.ts:71`, a pílula
lembra o teste) e reagem com desvantagem sozinhos (`condicoes.ts:83`; `batalhaFabrica.ts:1999`, `:2990`, `:3021`).
Revigorar com 3 cargas cura Espírito × 3, o extra da ficha (`mecanicasAMao.ts:297`, `:707`; `batalhaFabrica.ts:2319`).
À mão DE PROPÓSITO, com dono:
- Teste de quem chega perto do Campo pela CD da fruta: precisa do F0c (Pontos de Proficiência em Fruta) e de saber
  quem ENTRA na área, a mesma peça de área/token do construtor que as armadilhas do Alexei (F3.5). Até lá o mestre rola,
  lembrado pela pílula do selo.
- Área 2 + 1 por polaridade: o jogador marca quem está no campo ao usar (mesma peça; a mira não marca sozinha).
- Revigorar com 1 ou 2 cargas: a ficha só fala do X3; hoje cura o Espírito e gasta a carga. Perguntar ao mestre.
- O Giro liga em qualquer uso (ataque ou reação, anulando ou não): o "Parar" do lembrete desliga na vez dele. Usar o
  Giro de novo enquanto ele está ligado cobra os 30 SP de novo (o mestre não disse). Perguntar ao mestre.
Ainda falta: a Velocidade x1,2 da Ignição (o app não tem atributo "Velocidade"; o Vagn tem Agilidade 0).

## F3. Recursos novos (decisão 08/11: feitos como PEÇAS DO CONSTRUTOR, fatias C6/C7/C1/C10 de docs/planos/construtor-de-mecanicas-2026-11-08.md)
1. Tela do mestre ao transformar ou invocar com números livres (Sulong, super lobo).
2. Habilidades ocultas: o jogador vê "???" até o mestre revelar.
3. Técnicas complementares (Orquídea → Florescer, redoma até o próximo golpe).
4. Efeito de arma com usos por combate (Boomerang atordoa, 3 por combate) e arma padrão.
5. Companion (Lovecats da Aira até 3, lobos e Planta do Alexei): ficha própria, vida, evolução, token no
   campo ou efeito especial. É o maior; plano próprio.

## F4. Entrega
Bateria completa de testes uma vez, verificador item por item contra as respostas do grilling,
versão nova do app e "Publicar no Lobby".

## Critério de pronto
Cada linha de `respostas-do-grilling.md` tem o arquivo:linha que a cumpre ou "à mão de propósito";
os 12 bugs têm o caso de reprodução do relatório passando; 0 fichas sem máximo; mochilas de volta.
