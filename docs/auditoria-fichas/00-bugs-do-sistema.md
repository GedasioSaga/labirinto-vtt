# Bugs do sistema de ficha e batalha (auditoria de 07/11/2026)

Só leitura. Fichas lidas da pasta One Piece (`%APPDATA%/com.labirinto.app/pastas/<pasta One Piece>/rpg.json`, 11 fichas); nada gravado no app nem no appData.
Como provei: rodei as funções de verdade do app (a store da batalha `criarBatalhaStore`, `lib/batalha/*`, `lib/ajusteDaFicha.ts`, `net/edicaoDoPersonagem.ts`) em memória, com uma cópia das fichas, por `esbuild` (o global do npm, entrada pelo stdin) + `node`, com o `zustand/vanilla` trocado por um stub em `data:`. Nenhum arquivo escrito. O `client/node_modules` está vazio: vitest e o app não rodam aqui.
"Provado" = rodei e vi o número. "Leitura" = comparação de código, sem rodar. "Suspeita" = não provei; virou pergunta.

## Resumo, do mais grave ao menos grave

| # | Gravidade | O que o jogador sente | Prova |
|---|---|---|---|
| 1 | ALTA | Clica num botão da batalha e nada acontece, sem aviso | leitura |
| 2 | ALTA | Depois de umas rodadas ninguém mais consegue atacar | provado |
| 3 | ALTA | Desfazer a "Vez" trava técnica que foi desfeita e apaga recarga/selo de outras linhas | provado |
| 4 | ALTA | HP/SP máximo encolhe sozinho ao digitar o atual na edição (7 fichas de jogador) | provado |
| 5 | MÉDIA | Dano de golpe some quando o jogador usa o −/+ no mesmo momento | provado |
| 6 | MÉDIA | O Salvar do jogador desfaz o que o mestre mudou na mesma aba | provado |
| 7 | MÉDIA | A vez pula alguém (duplo clique do mestre, ou mestre e jogador passam juntos) | provado |
| 8 | MÉDIA | Na vez da ficha emprestada (ou do NPC que ele controla) o menu aparece, mas só "Passar" funciona | leitura |
| 9 | BAIXA | Forma que dá HP/SP: ativar e desfazer cura de graça (ainda não aconteceu) | provado |
| 10 | BAIXA | Custo "por turno" só é cobrado uma vez | provado |
| 11 | BAIXA | Gravação recusada pelo Lobby conta como feita | leitura |
| 12 | BAIXA | Barra do Escudo conta um valor que foi desfeito | leitura |

## 1. ALTA. Recusa muda: o jogador clica e nada acontece
- Onde: `client/src/player/playerConnection.ts:5007-5010` recebe `batalha.resultado` e só chama `responderPedidoDeBatalha(msg.reqId)` (`:2804-2809`); o `ok` (`client/src/net/protocoloDaBatalha.ts:1253-1257`) nunca é lido, e `components/batalha/BatalhaDoJogador.tsx:407` ignora o resultado. O host recusa "sem motivo" (`client/src/net/batalhaNoHost.ts:410`) e, acima de 20 pedidos em 5 s, nem responde (`:308`, `:409`); aí o mesmo pedido fica preso 8 s no cliente (`playerConnection.ts:2795-2799`, prazo em `:326`).
- Reproduzir: qualquer recusa serve. Os jeitos certos de cair nela são o bug 2 (20 golpes esperando) e o bug 8 (ficha emprestada); também a vez que mudou entre a tela e o host (o pedido sai com a vez velha).
- Causa: não há caminho de volta para a recusa; a tela só sabe que "o pedido saiu".
- Conserto sugerido: com `ok: false`, mostrar "A mesa não aceitou: <motivo curto>"; o host manda um código (vez passou, recarga, SP, golpes demais) sem contar cartas escondidas.
- Validar: teste do `playerConnection` que recebe `ok:false` e espera o aviso no estado.

## 2. ALTA. Golpe esperando reação nunca vence; com 20 na cena, ninguém mais ataca
- Onde: `client/src/lib/batalha/golpe.ts:170-171` recusa todo Atacar/Técnica com alvo quando `turnos.golpes.length >= 20` (`lib/batalha/combate.ts:623`). A troca de vez e de rodada não mexe nos golpes (`lib/batalha/turnos.ts:398-416`); só saem quando cada alvo responde ou quando a ficha sai da cena (`turnos.ts:621-639`). Debuff espera reação mesmo sem dano. O menu não confere esse teto (`components/batalha/dadosDoMenu.ts`) e o jogador só recebe os golpes dele (`lib/batalha/vistaDoJogador.ts:612-640`).
- Reproduzir (provado, 10 fichas reais na ordem): cada um, na sua vez, dá um Atacar num colega que não responde (jogador ausente, ou o mestre não respondeu pelo NPC) e passa. Na rodada 3 há 20 golpes esperando e os 5 ataques seguintes são recusados ("Golpes demais esperando reação"). Para o jogador, pelo bug 1, o botão só não faz nada.
- Causa: pendência sem prazo + teto que vale para a cena inteira.
- Conserto sugerido: o alvo que não respondeu vira "Não reagiu" com linha no registro (quando: pergunta P3) e o mestre vê quantos golpes esperam.
- Validar: store com 2 fichas e 21 ataques sem resposta ao longo das rodadas: todos aceitos.

## 3. ALTA. Desfazer a linha "Vez" volta a FOTO inteira do combate
- Onde: `client/src/lib/batalha/registro.ts:570-579` (caso `'vez'`) põe de volta `combate`, `gastos`, `extras` e, se a vez mexeu, `selos` inteiros, guardados em `client/src/stores/batalhaFabrica.ts:1745` e `:1769`. O próprio código explica por que isso é errado (`registro.ts:530-536`: "o combate inteiro de antes apagaria ... o uso de uma linha posterior, e devolveria o que outra linha já desfez"), mas a "vez" não usa o `combateSemALinha` (`:537`).
- Reproduzir A, "o jogador quer trocar a ação" (provado, Vincent x Harvey): Vincent usa Desenhar o alvo (Tempo 3) → passa a vez → mestre desfaz o Desenhar (SP 30 → 60, recarga some) → mestre desfaz a Vez. Visto: a vez volta ao Vincent com SP 60, mas Desenhar fica "Recarga: 3 turnos". Esperado: livre.
- Reproduzir B (provado; na cópia o SP do Vincent subiu para 200 para caber as duas técnicas): Vincent passa → Harvey ataca → Vincent reage com Passo de Valsa (recarga 3, −35 SP) → mestre desfaz só a Vez. Visto: a recarga do Passo de Valsa some (ele pode usar de novo), os 35 SP seguem gastos e a linha da reação segue de pé. Com selo (provado): um "Queimado 2" posto depois da Vez some quando ela é desfeita, com a linha dele de pé.
- Causa: a reversão "vez" é foto, não diferença.
- Conserto sugerido: a "vez" guarda só o que ela mudou (recargas que desceram, `semReacao`, lembretes, extras "rodada", selos que descontaram) e volta campo a campo.
- Validar: os três roteiros acima viram teste da store.

## 4. ALTA. Ficha sem máximo gravado: digitar o atual baixa o máximo junto
- Dados: Aira (HP), Harvey, Jimboy, May, Ryoko, Siegfried e Vagn (HP e SP), e a Saga, não têm `maximos` gravado. Sem ele o máximo é o próprio atual (`client/src/lib/ajusteDaFicha.ts:120-123`) e a edição "digita os dois" (`ajusteDaFicha.ts:237-250`; campos Atual e Máximo em `components/FichaNumeros.tsx:333` e `:338`; no host, `net/edicaoDoPersonagem.ts:183`).
- Reproduzir (provado, Harvey 700/700): Editar → HP atual 650 (tomou 50 fora da batalha) → Salvar. Visto: 650/650; curar para 700 dá 650/650. A 1ª batalha também "congela" o máximo no atual daquele momento (`ajusteDaFicha.ts:172-175`).
- Causa: ficha antiga "de um número só" num sistema em que HP e SP têm atual e máximo.
- Conserto sugerido: gravar o máximo dessas fichas uma vez (valores na pergunta P7), com app fechado e backup; e a edição gravar o máximo antes de mudar o atual.
- Validar: 0 fichas sem `maximos.hp`/`maximos.sp`; digitar o atual não muda o máximo.

## 5. MÉDIA. O −/+ rápido manda o valor final e apaga dano que chegou no meio
- Onde: o ajuste é absoluto (`client/src/lib/ajusteDaFicha.ts:48-57`); o jogador junta cliques por 400 ms e envia no máximo a cada 600 ms (`player/playerConnection.ts:300`, `:306`, `:2733-2736`, `:6127-6137`); a tela mostra o pendente por cima do que chega (`player/PlayerFicha.tsx:218-223`); o host grava o número como veio (`net/hostSession.ts:7946`).
- Reproduzir (provado com o Alexei, HP 365, Escudo 12): o jogador aperta "−" 10 vezes (pedido HP 355); antes de sair, um golpe de 112 entra (Escudo 0, HP 265); o pedido chega e grava HP 355. Os 100 de dano somem da ficha, a tela dele nunca mostrou 265, e o registro diz que ele tomou.
- Causa: "vale o último" sem saber de qual valor o jogador partiu.
- Conserto sugerido: o pedido leva o valor de partida; se o atual do host mudou desde então, aplica a diferença.
- Validar: teste do host com ajuste pendente e dano no meio: HP final 255.

## 6. MÉDIA. O Salvar do jogador desfaz o que o mestre mudou na mesma aba
- Onde: o host usa como base "a ficha que mandou por último a essa conexão" (`client/src/net/hostSession.ts:7912-7916`, `:7926`), mas o jogador calcula a mudança contra a ficha de quando ABRIU a edição (`player/PlayerFicha.tsx:335`) e manda a aba inteira (`net/edicaoDoPersonagem.ts:62-66`). Com base e atual iguais, a mescla não protege nada (`net/nuvem/emissor.ts:400-406`).
- Reproduzir (provado, Harvey): jogador abre Editar → mestre muda o custo da Pazada de 15 SP para 25 SP e salva → jogador muda a descrição do Giro de Pá e salva. Visto: Pazada volta a 15 SP. Com a base certa (a de quando o jogador abriu) fica 25 SP e a descrição entra.
- Causa: base errada na mescla. Vale para a aba inteira e para a lista de etiquetas (números e escolhas vão chave a chave e não perdem).
- Conserto sugerido: o jogador manda a marca da ficha em que começou a editar; o host mescla a partir dela.
- Validar: o roteiro acima vira teste de `edicaoDoPersonagem`/`hostSession`.

## 7. MÉDIA. A vez pula alguém
- Onde: o "Passar a vez" da faixa e do painel do mestre não manda a vez esperada (`client/src/components/batalha/FaixaDoMestre.tsx:200`, `components/batalha/PainelDoMestre.tsx:77`, sem `passandoVez`), e a store só confere quando recebe (`stores/batalhaFabrica.ts:1723`). O botão de `BatalhaDoMestre.tsx:357` manda.
- Reproduzir (provado, ordem Aira > May > Guilherme, vez da Aira): a Aira encerra a vez e, no mesmo instante, o mestre clica "Passar a vez". Visto: vez do Guilherme; a May não jogou. Duplo clique do mestre faz o mesmo (leitura).
- Conserto sugerido: os dois botões passam `{ cartaId, rodada }` da vez mostrada. Validar: dois `passarVez` com a mesma vez esperada; o 2º volta `false`.

## 8. MÉDIA. Vez da ficha emprestada: "sua vez" aparece, mas Atacar e Técnica são recusados
- Onde (leitura): a tela marca "sua vez" por `meusTokens` (`client/src/lib/batalha/vistaDoJogador.ts:781`), que são todos os tokens dele (`net/hostSession.ts:7698`); o host só aceita ação de ficha "de verdade" (`net/batalhaNoHost.ts:346-363`), que exclui emprestada, ajudante e token NPC (`hostSession.ts:7641-7653`). Passar a vez confere só `meusTokens` (`batalhaNoHost.ts:418`) e funciona.
- Reproduzir: empreste a ficha de um jogador a outro (ou dê a ele um NPC), ligue a batalha e dê a vez a essa ficha: o menu aparece, Atacar não faz nada (bug 1), Passar funciona.
- Pergunta: essa ficha pode agir? Se sim, alinhar o host; se não, esconder o menu.

## 9. BAIXA (latente). Forma que aumenta HP/SP: ativar e desfazer cura de graça
- Onde: Ativar soma ao atual a diferença do máximo (`client/src/lib/batalha/transformacao.ts:293-297`); Desfazer só corta no máximo (`:301-305`).
- Reproduzir (provado, cópia da Forma Híbrida da Ryoko com "HP +300"): 300/700 → ativa 600/1000 → desfaz 600/700 → ativa 900/1000 → desfaz 700/700. Forma "Livre" cura sem limite. Hoje nenhuma forma das 11 fichas mexe em HP, SP ou Escudo. Pergunta P4.

## 10. BAIXA. Custo "por turno" só é cobrado uma vez
- Onde: a leitura entende "(Por turno)" (`client/src/lib/batalha/leituraDaFicha.ts:56`, `:67`; provado: o Campo de Contenção do Vagn, "-15 (Por turno)", lê `porTurno: true`), mas isso só vira texto no menu (`components/batalha/dadosDoMenu.ts:294`); nada cobra nos turnos seguintes. As formas que "gastam X SP por turno" (Jimboy, Ryoko) têm isso só no Requisito, texto livre. Pergunta P6.

## 11. BAIXA. Gravação recusada pelo Lobby conta como feita
- Onde (leitura): `ajustarPersonagem` devolve `true` mesmo quando a pasta publicada recusa (`client/src/stores/adventureStore.ts:1759-1760`; recusa em `:986-989`), e a batalha já guardou as partes do dano (`stores/batalhaFabrica.ts:742-748`). O mesmo no Dar/Trazer da mochila (`adventureStore.ts:2603`).
- Efeito: linha no registro com dano que não entrou na ficha. A pasta One Piece está publicada desde 07/11; números pequenos passam no teto do Lobby, então é raro (não reproduzi).

## 12. BAIXA. Barra do Escudo: o "cheio" conta valor desfeito
- Onde (leitura): `client/src/lib/batalha/registro.ts:700-709` lê todas as linhas, inclusive as desfeitas, e só as últimas 300 (`:228`). Um Escudo 500 posto por engano e desfeito deixa a barra quase vazia até o fim da luta.

## Conferi e está certo
- Selo não desconta duas vezes na mesma rodada, nem com carta extra (`lib/batalha/selos.ts:159-174`, marca `contadoNaRodada`).
- Desfazer dano volta pela diferença e não apaga dano posterior (`lib/batalha/registro.ts:824-829`); o Ctrl+Z do mapa não mexe em ficha (a ficha mora na aventura/pasta, fora do desfazer do mapa).

## Perguntas para o grilling (regra que o código não tem como saber)
- P1. Tempo 3 bloqueia quantas vezes do dono? Hoje (provado): usa na rodada 1, bloqueada na 2 e na 3, usa de novo na 4.
- P2. Com carta extra (age 2 vezes na rodada), a recarga desce 2 vezes por rodada e o selo só 1. Qual regra vale para cada um?
- P3. Golpe sem resposta vira "Não reagiu" sozinho? Quando a vez do atacante voltar, ou na virada da rodada? (bug 2)
- P4. Desfazer a forma tira o HP/SP que ela deu ao ativar? (bug 9)
- P5. O "Me dar dano" do jogador com Resiliente ligado tira os 20% de novo (`stores/batalhaFabrica.ts:2195-2196`); se o jogador já descontou, fica em dobro. É isso?
- P6. Custo por turno: cobrar no começo da vez do dono, como lembrete com "Aplicar", ou fica manual? (bug 10)
- P7. Qual o HP e o SP máximo de verdade de cada ficha do bug 4? (o atual de hoje pode já estar abaixo)
- P8. A batalha (ordem, recargas, usos, selos, golpes) mora só na memória do app do mestre (decisão 1): fechar ou atualizar o app zera tudo, e "Usos por batalha" (Ignição 2x) e Overload voltam. Quer que a batalha volte ao reabrir?

## Suspeitas sem prova
- Reordenar no meio da rodada (Ordenar pela Agilidade, arrastar) mantém a vez na mesma carta: quem foi para trás dela pode jogar duas vezes e quem foi para a frente fica sem jogar nesta rodada (`lib/batalha/turnos.ts:318`, `:498-507`). Pode ser de propósito.
- Mochila: nenhuma ficha da pasta One Piece tem `mochila` (não migrou), então os caminhos novos da mochila na ficha não rodam nela; os 2 casos raros abertos em 05/11 (PEDIDOS, rodada 4) continuam. Nada novo achado.
- A redução da forma arredonda (`Math.round`, `lib/batalha/transformacao.ts:122-124`) e o resto do dano arredonda para baixo: 37 com −20% dá 30, e não 29.
