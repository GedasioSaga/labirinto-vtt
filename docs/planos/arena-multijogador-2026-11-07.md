# Arena multijogador (site do Lobby) — plano de 07/11/2026

Pedido e respostas do usuário: fim de `PEDIDOS.md` (07/11, "na parte de ajustar o judge..." e "aqui colocar opção de ser ao invés de 2..."). Desenho do arquiteto, só leitura, 07/11.

## 1. O que a regra já aceita
- `stores/batalhaFabrica.ts` e `lib/batalha/` não têm "lados": alvo livre, ordem pela Agilidade, equipes N (`EQUIPES_MAX=12`, `lib/batalha/equipes.ts`); NPC mira "equipe diferente" (`golpe.ts:455`); vista usa `aliados`/`equipes` (`vistaDoJogador.ts`). Já aceita várias fichas por lado e N lados.
- Só `lib/treino` trava em 2: `LadoDoTreino='a'|'b'` (`mesaEmMemoria.ts:35`: LADOS, EQUIPE_DO_LADO, casasIniciais), `fimDaLuta.ts` (`dePePorLado` só `{a,b}`), `duelo.ts` (`Record<LadoDoTreino,…>`, `PedidoDeDuelo a/b`), `vistaDoDuelo.ts`, `lib/arena/grade.ts:99 casasDoLado`, `montagem/regrasDaMontagem.ts`. `robo.ts:114` já mira por `!==`.
- Corte: `LadoDoTreino` vira letra `'a'..'l'` (até 12). Ids `a1`/`b1` e luta gravada v1 seguem valendo. Times: cada time é um lado. Todos contra todos: cada conta é o próprio lado. (Rejeitado: 2 lados virtuais.)
- Fim: vence o único lado com alguém de pé; empate se ninguém; tempo pelos tetos de hoje. Grade média 16x10 com mais de 2 lados ou mais de 6 fichas, largadas pelo perímetro.
- GUARDA de toda fatia: `git diff --stat <base> -- client/src/stores client/src/lib/batalha` vazio (a batalha do app segue igual).

## 2. Protocolo no DO (motor v4; o duelo 1x1 vira atalho de 2 lados)
- Tabelas novas: `lutas(id, status espera|andamento|fim, modo times|todos, estadoJson, seq, versaoDoMotor, prazo, apagarEm, atualizadoEm)` e `participantes(lutaId, contaId, papel jogador|juiz|arbitro|espectador, lado, ausenteDesde)`.
- Mensagens: `luta.criar {modo, lados[], convidados[{contaId,papel,lado}]}` (espera 5 min); `luta.aceitar {id,lado,fichas[]}`, `luta.recusar`, `luta.comecar` (criador, 2+ lados com ficha); `luta.jogar {id,jogada}` (montar/andar/agir/reagir/passar de hoje); `luta.arbitrar`; `luta.sair`; `luta.assistir`/`luta.parar`; `luta.lista` (convites e "Lutas acontecendo agora" com lados, rodada, quantos assistem); `luta.estado` (um por destinatário); `luta.fechada`.
- Vaga ganha `contaId`: no time cada conta só joga a própria ficha (`naoEDaConta`).
- Mestre como Judge: o lado dele leva o Judge e inimigos liberados (`visivel:'treino'`); ajustes do Judge no aceite, servidor monta pela função pura. Mestre fora 3 min: o robô assume o Judge.
- Ausência 3 min por conta (sem socket): sai da ordem (`tirarCombatente`), luta segue; lado vazio cai no `fimDaLuta`.
- Vista por papel: jogador (suas = eu, mesmo lado = aliados, resto = outro); espectador e mestre só assistindo (sem ficha própria, fio recortado de todos: sem combate, contra-ataques nem números das formas; montada uma vez para todos); árbitro vê tudo.
- Limites: 12 contas por luta, 1 luta por conta, 6 fichas por lado, 12 no total; 64 KiB só cliente→DO; a fumaça imprime o maior frame enviado.
- Reaproveitar: `aplicarJogada` com dano recalculado, recusa de surpresa e dano à mão, `seq`, `lerJogada` 64 KiB, d20 crypto, `alarm()` único, limpeza de outra versão, `transacao`, `verComo`, cota do dia.
- Site e Worker saem juntos (site velho recebe `versao`).

## 3. Árbitro (o mestre escolhe um papel por luta: Judge OU árbitro)
- Desfazer a última jogada (`store.desfazer`, autor mestre, linha riscada, só a última não riscada); ajustar HP/SP/Escudo (`store.ajustar`, linha "ficha"); decidir regra (`definirRegras`); passar a vez de quem sumiu (`passarVez`); pausar/retomar (`pausada` no motor; jogada na pausa volta `pausada`); encerrar (fim tipo `arbitro`, vencedor ou empate).
- Registro: as quatro primeiras assinadas "Mestre (árbitro)"; pausar/retomar/encerrar em `marcos[{seq,tipo,quando}]`.

## 4. Treino
- Builds com nome: `labirinto.lobby.builds.[demo.]<campanhaId>.<contaId>` no localStorage, `{versao:1, builds:[{id, nome≤40, base:{tipo:'minha'|'colega'|'juiz', fichaId}, atributos, maximos, recursos, tecnicas, salvoEm}]}`, até 30; guarda só a diferença sobre a base; base fora da mesa = build desligada com aviso; no "Ver como" nada é gravado.
- Cópia do colega no Judge: colegas já entram na montagem (`TelaTreino.tsx:52`); ajustes do Judge ganham `baseFichaId` (boneco ou "cópia de X" com os ajustes por cima, id `ID_DO_JUIZ`).

## 5. Fatias e aceite
- F1 builds e Judge do colega: `lobby-site/telas/treino/juiz/`, `telas/treino/buildsSalvas.ts` (novo), `TestarBuild.tsx`, `TelaTreino.tsx`, `client/src/lib/treino/juiz.ts` (novo, `fichaDoJuiz` pura). Aceite: tsc, build:lobby, `npx vitest run src/lobby-site/telas/treino/buildsSalvas` com 2 casos.
- F2 motor N lados (paralela à F1): `lib/treino/` (mesaEmMemoria, fimDaLuta, lutaAutomatica, `luta.ts` v4, `vistaDaLuta.ts`), `lib/arena/grade.ts` (função nova). Aceite: `npx vitest run src/lib/treino` com os testes de hoje sem mudança + 2 (4 robôs todos contra todos semente 7 = 1 vencedor e mesmo resumo 2x; vista do espectador sem combate/contra-ataque); `pureza.test.ts`; guarda vazio. Diagrama `docs/diagrams/arena-multijogador.html` + linha no INDEX.
- F3 árbitro e mestre-Judge no motor (mesmo dono da F2, em sequência). Aceite: 2 casos (desfazer do árbitro devolve as fichas, seq+1, linha riscada; jogada na pausa = `pausada`).
- F4 DO (INCLUI a seção 6: histórico de lutas): `lobby/nuvem/src/luta.ts` (novo), `esquema.ts`, `campanha.ts`, `fumaca.mjs` (modo `luta`), `client/src/lib/treino/lutaDoLobby.ts`. Aceite: tsc + dry-run com tamanho; `node fumaca.mjs luta` contra wrangler dev: 2x2 até o fim, todos contra todos com 3, colega de time = `naoEDaConta`, espectador = `naoJoga` e sem combate, desfazer do árbitro chega a todos, conta fora 3 min sai e a luta segue, 13ª conta recusada, maior frame impresso.
- F5 telas (INCLUI a seção 6: "Lutas acontecendo agora" e "Histórico de lutas" embaixo de Desafiar, também para o mestre): `lobby-site/telas/luta/` (criar, sala de espera, "Lutas acontecendo agora" + "Assistir", painel do árbitro), `lobby-site/dados/` (mensagens `luta.*` e demo). Aceite: tsc, build:lobby, tela sob demanda e JS da entrada sem crescer, passeio em `?demo=1`. Por último o usuário joga (3 abas, 2 times e 1 espectador, mestre árbitro) e responde as 3 perguntas da regra de teste de jogos.
## 6. Histórico de lutas e lutas rodando (pedido de 07/11, com print da tela Duelo: "embaixo de duelo bote historico de duelos e duelos que estão rodando para espectar")
- Na tela Duelo/Luta, embaixo de "Desafiar": (1) "Lutas acontecendo agora" com "Assistir" (já na F5); (2) "Histórico de lutas": data, modo (times/todos), quem lutou em cada lado, vencedor (ou empate/tempo/árbitro), rodadas; abrir uma luta antiga mostra o registro final só para ler.
- F4 (DO): ao fim de cada luta (e do duelo 1x1), gravar um resumo numa tabela própria `historicoDeLutas` (id, fim, modo, lados com contaId/nome/fichas, vencedor, motivo do fim, rodadas, registro final recortado como para o espectador), guardando as últimas 100 por campanha; mensagem `luta.historico {antesDe?, limite≤20}` paginada, para qualquer membro (vista pública, sem combate nem segredo). Caso na fumaça: uma luta terminada aparece no histórico com o vencedor certo.
- F5 (telas): as duas listas embaixo de "Desafiar", também para o mestre (que hoje vê só "Você precisa de um personagem na mesa para desafiar alguém").

- Riscos: estado grande x12 destinatários (CPU e cota: medir na F4 contra 62.500 das 100.000 linhas); espera longa com 12 fichas; lado do mestre com fichas de outra conta; site velho + Worker novo = `versao`.
