# Mundo do livro de regras no app: plano por fases (M1 a M4)

Arquiteto, 30/10/2026, só leitura. Fonte: docs/design/livros-de-regras/ (README, prototipo.js, dados.js), PEDIDOS.md (30/10), código da main (685f0125) e projeto-rpg-v2 (gemini.ts, prompts.ts, extracao.ts, PainelIA.tsx). Nenhum .env ou segredo aberto.

Domínio: aplicação desktop (React/TS na webview + Rust/Tauri) com rede LAN. Heurísticas usadas: contrato antes, estado com dono escrito, o host é a fronteira de confiança, IPC listado comando a comando.

## 0. O que o código já tem e muda o plano

| Fato (arquivo) | Consequência |
|---|---|
| Fichas moram na PASTA (`<appData>/pastas/<id>/rpg.json`, `RpgDaPasta.personagens`) ou na aventura do mapa (`adventure.json`). `personagensAtivos()` (stores/adventureStore.ts:948) é a única leitura; `donoDosPersonagens()` (:967) é o único caminho de gravação. | O mundo do livro trabalha sobre a PASTA que usa o sistema (`RpgDaPasta.sistemaDeRpg`). Mapa com "Configurar só neste mapa" fica fora do mundo (o atalho no editor só aparece quando o mapa herda da pasta). |
| `editarRpgDaPasta(pastaId, mudar)` (stores/rpgDaPasta.ts:34) grava o disco e aplica a MESMA mudança na cópia aberta do editor, sem perder HP pendente. | Toda escrita do mundo passa por ela, venha da tela inicial ou do editor. Nada de segundo caminho. |
| CONTAS já existem (lib/contasDosJogadores.ts, nome + PIN). `Personagem.dono` = id da conta; `giveAccountTokens` (net/hostSession.ts:5587) entrega as fichas na entrada pela conta. Entrada só com nome hoje NÃO entrega ficha (só a "mesa guardada", `reclaimSeat`, :5336). Nome de conta digitado sem PIN não herda nada (:5496). | "Jogador pelo nome de entrada" vira um irmão de `giveAccountTokens`: `giveNamedTokens`, só para quem entra sem conta. Conta continua ganhando do nome. |
| `semDono` (hostSession.ts:7561) é o funil único de `Personagem` para o fio: lista do jogador (:7632) e batalha (`paraOFio`, :3537). Edição do jogador parte do personagem gravado (`aplicarPartes` sobre `alvo.atual`, :7785). | Campos só do mestre (nota, força, modelo, nome de entrada) saem num ponto só. Jogador não consegue gravar esses campos. |
| `combatentesIniciais` (lib/batalha/turnos.ts:229) põe na ordem todo token com personagem; token sem personagem fica fora. Chamado só em components/livro/ControleDaBatalha.tsx:132, que já tem um passo de escolha (abertura) antes de ligar. | "Quem entra na batalha?" é um passo novo depois da abertura, no mesmo componente. |
| Dano: `lerDano` e `danoDoAtaque` (lib/batalha/formula.ts:303 e :320) recebem o `personagem`. HP máximo: `maximoComposto` (lib/ajusteDaFicha.ts:107, 8 chamadores). | Força do NPC entra em 2 funis: dano em formula.ts, HP máximo em ajusteDaFicha.ts. Ficha, batalha e Comparar leem a mesma conta. |
| Leitores da F2: `lerCusto/lerAcao/lerTempo` (lib/batalha/leituraDaFicha.ts) e `LeituraDoDano` (valor, precisaArma, precisaAlvo, naoEntende, semDano). | A Saúde da ficha é um mapeamento puro desses tipos para Lido / Lê na hora / Não lê / À mão. Não precisa de leitor novo. |
| Tela inicial: screens/MainMenu.tsx (portas `HomeDoor`), `Screen` em types/screen.ts, pai em lib/navigation.ts, rotas em App.tsx:3002-3066. | Porta 04 = tela nova `livros` no mesmo molde do `roleplay`. |
| `FichaDePersonagemDialog` (components/) é guiada por props (`onSalvar`, `onAjustar`). | A gaveta da ficha no mundo reaproveita a janela de ficha do app; só troca o `onSalvar`. |
| livroOnePiece.ts tem os capítulos Perícias, Vantagens e Desvantagens no formato "**Nome:** texto **(Atributo)**". | O catálogo "Do livro" (M3) sai desses capítulos por um leitor puro, sem digitar nada. |
| Tokens de cor do protótipo (`--lb-color-*`, `--lb-font-*`) são os do app (main.css). | O CSS do protótipo é portado quase direto para um arquivo próprio, sem tocar no main.css. |
| tauri.conf.json: csp nulo (não há CSP). capabilities: o fs:scope libera toda a pasta APPDATA do app para a webview. reqwest 0.13 (native-tls) já é dependência. Há uma 2ª webview (visao_jogador, mesma URL do app). | Chave do Gemini em JSON no appData seria legível pela webview: vai para o Cofre do Windows e a chamada ao Google sai do Rust. A webview nunca vê a chave nem fala com googleapis, então não há CSP a liberar. |

## 1. As 6 decisões do README, já fechadas, como viram código

1. Jogador pelo nome de entrada: `Personagem.nomeDoJogador` (comparação por `normalizeName`, a mesma da sala). Dois entrando com o mesmo nome: só o primeiro recebe; o mestre vê aviso.
2. NPC sem ficha ao iniciar: oferta "Ficha mínima (HP 300, golpe 80)" marcada, ou "Como (modelo)".
3. Força só em HP e dano: funis em formula.ts e ajusteDaFicha.ts; Escudo e SP intocados.
4. Aba Itens na ficha One Piece: aba nova `itens` em lib/sistemaOnePiece.ts (nome, quantidade, efeito, descrição).
5. Anotações na IA só quando a ficha é citada: o montador de contexto só lê `notaDoMestre` das fichas citadas; o fio para o jogador nunca leva a nota.
6. Golpe à mão fora da saúde: `CartaoDaFicha.aMao` marca; aparece em cinza, fora da porcentagem.

## 2. Modelo de dados (todas as fases)

### 2.1 Campos novos em `Personagem` (lib/personagem.ts), todos opcionais

| Campo | Tipo | Quem vê | Regra |
|---|---|---|---|
| `combate` | `{ forca: number; modeloId?: string }` | só mestre | NPC de combate. `forca` de 0,5 a 2, passo 0,05, padrão 1. `modeloId` = é variação. |
| `soCenario` | `true` | só mestre | NPC fora da batalha (lista "Só no cenário"). |
| `nomeDoJogador` | `string` (máx. 32, `cleanPlayerName`) | só mestre | Liga a ficha ao nome digitado na entrada. Ignorado se `dono` (conta) existir. |
| `notaDoMestre` | `string` (máx. 4000) | só mestre | Anotação. Entra na IA só se a ficha for citada. |

Em `CartaoDaFicha`: `aMao?: true` (M2). Vai ao jogador (é da ficha dele, inofensivo). Todos os campos novos passam pelo leitor `personagemDoArquivo` (tolerante: valor torto sai).

Regras puras novas (lib/livros/combate.ts):
- `entraNaBatalha(p)`: jogador sim; NPC sim, salvo `soCenario`. NPC antigo sem marca nenhuma conta como de combate (nada muda para quem já usa a F2).
- `forcaDe(p)`: força do NPC; 1 para jogador ou NPC sem `combate`.
- `trocarForca(p, nova)`: grava a força e reescala o HP atual na mesma proporção (NPC a 50% continua a 50%).
- Variação MATERIALIZADA: a variação guarda a ficha inteira, copiada do modelo. `sincronizarVariacoes(lista)` copia do modelo atributos, modificadoresDosAtributos, maximos, modificadoresDosRecursos, abas, escolhas, etiquetas e descricao; mantém da variação id, nome, retrato (se tiver), recursos (o atual), cartoesAtivos, historico, combate e notaDoMestre. Idempotente e devolve a MESMA referência quando nada muda (o host compara por referência para não reenviar). Modelo apagado: as variações perdem `modeloId` e viram NPC único.
  - Por que materializar: dezenas de leitores (ficha, batalha, rede, IA) leem `Personagem` cru. Resolver herança na leitura obrigaria a mexer em todos; materializar mexe em 1 funil de gravação.
- `fichaMinima(sistema, nome)`: `novoPersonagem` + HP 300/300 + técnica "Golpe" com dano "80", `combate.forca = 1`. Sistema sem recurso `hp` ou sem aba `habilidades`: ficha vazia com o nome.
- `novaVariacao(modelo, nome)`: cópia com id novo, `combate = { forca: 1, modeloId }`, HP cheio.

### 2.2 Onde cada coisa mora no disco

| Dado | Onde | Escopo | Fase |
|---|---|---|---|
| Fichas de jogador e NPC (com os campos novos) | `<appData>/pastas/<id>/rpg.json` (já existe) | por pasta (campanha) | M1 |
| Nomes vistos na mesa (`{ nome, vistoEm }[]`, máx. 64) | `<appData>/livros/jogadores-vistos.json` | do app, como as contas | M1 |
| Grupo e inimigos do Comparar | memória (store) | sessão | M2 |
| Catálogo de armas, habilidades e itens | `<appData>/livros/<sistemaId>/catalogo.json`: `{ formato: 1, itens: [{ id, tipo, nome, texto, campos }] }`, máx. 2000 | por sistema (o mesmo livro em toda campanha) | M3 |
| Perícias, vantagens e desvantagens "Do livro" | lidas dos capítulos do livro do sistema, sem disco | por sistema | M3 |
| Chaves do Gemini (até 3) e índice da ativa | Cofre do Windows (Credential Manager), alvo `labirinto-vtt.gemini`, um JSON só | do usuário do Windows | M4 |
| Modelo escolhido da IA | `<appData>/livros/ia.json` com `{ modelo }` (não secreto) | do app | M4 |
| Conversa com a IA | memória, some ao fechar | sessão | M4 |

### 2.3 Rede: o que o jogador recebe

- `semDono` vira `paraOFio(p)`: tira `dono`, `nomeDoJogador`, `notaDoMestre`, `combate`, `soCenario`. É o mesmo funil da lista do jogador e da batalha (aliados vendo o perfil um do outro). Entra já na M1, antes de existir tela de anotação.
- NPC continua sem ir ao jogador (`fichasDoPersonagem` já filtra). A força só aparece nos números de dano que chegam, já multiplicados.
- O host continua dono: a edição do jogador parte do personagem gravado, então ele não grava força nem nota. Conferir que `personagem.criar` monta o novo por `novoPersonagem` + partes (sem campos do mestre).
- Mundo do livro, catálogo, Comparar, Saúde e IA: nada vai pela rede. Só o mestre.
- Mensagem nova no fio: nenhuma. `giveNamedTokens` só muda quais tokens o jogador recebe na entrada, pelas mensagens que já existem.

## 3. Casca comum (vale para todas as fases)

- Rota: `Screen` ganha `'livros'`; `SCREEN_PARENT.livros = 'menu'`. App.tsx renderiza `LivrosScreen` como faz com o `roleplay`.
- `LivrosScreen` (screens/LivrosScreen.tsx): passo 1 = escolha do sistema (cartões da biblioteca `useRpgStore().biblioteca`, com "N pastas usam"); passo 2 = escolha da campanha só quando mais de 1 pasta usa o sistema (lembra a última); passo 3 = `MundoDoLivro`. Sistema sem pasta: tela vazia com o caminho "Carregar Mapa, configurar pasta, Sistema universal".
- `MundoDoLivro` (components/livros/MundoDoLivro.tsx): marcadores à esquerda, página no meio, coluna da IA à direita (só da M4 em diante). Abre por cima do editor também (atalho), em camada própria; Esc e "Fechar" voltam ao mapa.
- Store `stores/mundoDoLivroStore.ts` (estado de TELA, não de dado):
  - `aberto: { sistemaId, pastaId, origem: 'inicio' | 'editor' } | null`, `aba`, `daPasta: Personagem[] | null` (cópia lida do disco), `erro`.
  - `abrir`, `fechar`, `trocarAba`, `recarregar()`.
  - `mudar(m)`: chama `editarRpgDaPasta(pastaId, f)` onde `f` aplica `m` na lista e depois `sincronizarVariacoes`; atualiza `daPasta`.
  - Hook `usePersonagensDoMundo()`: se o editor está aberto num mapa que herda DESTA pasta, lê `personagensAtivos` (a cópia viva, com HP da mesa); senão, `daPasta`. Um dono só por situação, escrito aqui.
- `adventureStore.donoDosPersonagens().gravar` passa a aplicar `sincronizarVariacoes` (editar o modelo pela ficha do mapa também atualiza as variações).
- CSS: components/livros/mundo.css, portado de prototipo.css (mesmos tokens). main.css não é tocado.
- Design: o protótipo está aprovado; o porte é fiel. Quem escreve tela segue a §2l (emil-design-eng primeiro) e respeita `prefers-reduced-motion`. A página "No mapa" do protótipo não vira tela: ela vira o atalho real e a caixa real do Iniciar batalha.
- Ritmo (memória do projeto): tudo na main, sem worktree; no máximo 3 escritores, caminhos disjuntos, cada um commita só os próprios caminhos; Rust 1 por vez; sem testes novos (o usuário pede quando quiser); cada fase fecha com commit + linha no PEDIDOS.md; publicar só quando o usuário mandar (scripts/publicar-versao.cjs).
- Arquivos quentes e dono único em cada fase: App.tsx, net/hostSession.ts, stores/adventureStore.ts, lib/personagem.ts, lib/batalha/formula.ts, lib/ajusteDaFicha.ts, lib/batalha/turnos.ts, components/livro/ControleDaBatalha.tsx, lib/sistemaOnePiece.ts.

---

## M1. Porta, mundo, Jogadores, NPCs de combate e "Quem entra na batalha?"  (versão 0.5.19)

### O que o usuário vê
1. Tela inicial com a porta "04 · Livros de regras" (Opções, quando ligada, passa a 05).
2. Porta abre a escolha do sistema (One Piece). Escolheu: entra no mundo com os marcadores Jogadores e NPCs de combate (os outros marcadores só aparecem quando a fase deles chega).
3. Jogadores: cada ficha de jogador da pasta com um seletor "jogador" (contas primeiro, depois nomes já vistos na mesa), estado "Entra como beto, visto hoje, nos N mapas da pasta"; embaixo, "Entraram na mesa e não têm ficha" com "Criar ficha para kaio".
4. NPCs de combate: lista de modelos e variações com a força ao lado; detalhe com deslizante x0,5 a x2 (e atalhos x0,5, x0,75, x1, x1,25, x1,5, x2), HP e dano de cada golpe riscado e novo na hora; variações ("Nova variação"); bloco "Só no cenário" com "Dar ficha"; "Novo NPC" (do zero, ou de um modelo); "Abrir ficha" abre a janela de ficha do app.
5. No editor, seção Personagens do livro do mestre: botão "Abrir o mundo do One Piece" (só quando o mapa herda da pasta). Fecha e volta ao mapa.
6. Jogador ligado pelo nome entra na sala e já recebe os tokens da ficha dele (em todos os mapas da pasta). Se outro entrar com o mesmo nome, o mestre vê o aviso.
7. Iniciar batalha (botão ou Shift+B), depois da abertura: se houver token de NPC sem ficha de combate na cena, aparece "Quem entra na batalha?" (com ficha marcados; sem ficha desmarcados, cada um com "Ficha mínima (HP 300, golpe 80)" ou "Como Recruta da Marinha"). Sem esses tokens, segue direto como hoje. NPC "Só no cenário" não entra na ordem.

### Arquivos
Novos:
- lib/livros/combate.ts: regras puras da seção 2.1.
- lib/livros/jogadores.ts: `ligacaoDe(p)` (conta, nome ou nenhum), `jogadoresSemFicha(vistos, personagens, contas)`, `ligarAoNome`, `ligarAConta` (exclusivos: ligar um apaga o outro), aviso de nome repetido na ligação.
- lib/livros/jogadoresVistos.ts: ler, gravar e `registrarVistos(lista, nomes, agora)` (máx. 64, mais velho sai), disco em appData/livros.
- stores/mundoDoLivroStore.ts (seção 3).
- screens/LivrosScreen.tsx; components/livros/MundoDoLivro.tsx, PaginaJogadores.tsx, PaginaNpcs.tsx, NovoNpcDialog.tsx, GavetaDaFicha.tsx (envolve FichaDePersonagemDialog com `onSalvar` = `mundo.mudar`), mundo.css.
- components/livro/QuemEntraNaBatalha.tsx (a caixa do Iniciar).

Alterados:
- lib/personagem.ts: 4 campos + leitura no `personagemDoArquivo`.
- types/screen.ts, lib/navigation.ts: tela `livros`.
- lib/ajusteDaFicha.ts: `maximoComposto` multiplica o total do recurso `hp` pela `forcaDe` (só NPC); `salvarSobreOAtual` preserva do atual `nomeDoJogador`, `notaDoMestre`, `combate`, `soCenario` (como já faz com `dono`: mudam no mundo, não na ficha).
- lib/batalha/formula.ts: `lerDano` e `danoDoAtaque` multiplicam o valor final pela `forcaDe(ctx.personagem)` e mostram a conta ("x1,5") só para o mestre.
- lib/batalha/turnos.ts: `combatentesIniciais(tokens, personagens, sistema, incluir?)`: pula personagem que não `entraNaBatalha`; `incluir` (ids de token) limita aos marcados.
- stores/adventureStore.ts: `sincronizarVariacoes` no `gravar` de `donoDosPersonagens`.
- net/hostSession.ts: `semDono` vira `paraOFio` (tira os 4 campos + dono); `giveNamedTokens(playerId, nomeDigitado, world)` chamado em `handleJoin` quando não é resume, não é nome de conta e não houve `reclaimSeat`; antes do `welcome` (como a conta). Personagem com `dono` não entra pelo nome. Token que outro jogador já segura não é dado; o resultado ganha `fichasPeloNome: { playerId, nome, tokenIds, jaComOutro }` para o aviso.
- net/hostBridge.ts: repassa `fichasPeloNome` ao App (como `contaEntrou`).
- components/livro/ControleDaBatalha.tsx: depois de confirmar a abertura, se há candidatos sem ficha, abre `QuemEntraNaBatalha`; ao confirmar, cria as fichas (mínima ou variação do modelo, com o nome do token), grava (`salvarPersonagem`), liga `token.characterId` (`updateToken`, entra no desfazer do mapa) e chama `combatentesIniciais` com `incluir`.
- App.tsx: rota `livros`; mundo por cima do editor quando a origem aberta é o editor; ao mudar a lista de jogadores da sala, `registrarVistos` (debounce de 2 s, fora do render); aviso de `fichasPeloNome` ("beto entrou com Bruno Ferrolho" ou "Outro beto já está com a ficha de Bruno").
- screens/MainMenu.tsx: prop `onLivros` e a porta.
- components/PersonagensSection.tsx: prop `onAbrirMundo` e o botão.

### Fase 0 (contrato, 1 agente: `programador`, high, cerca de 1 h)
Escreve e commita SÓ tipos, assinaturas e esqueletos que compilam:
- lib/personagem.ts completo (campos + leitura).
- lib/livros/combate.ts, jogadores.ts, jogadoresVistos.ts com assinaturas e JSDoc (corpo provisório só onde ninguém chama ainda).
- stores/mundoDoLivroStore.ts: interface do estado e das ações.
- types/screen.ts e lib/navigation.ts.
- Props exportadas (corpo visual vazio) de LivrosScreen, MundoDoLivro e QuemEntraNaBatalha, para o App e o ControleDaBatalha montarem.
- Critério: `rtk proxy npx tsc --noEmit` em client/ com 0 erros.

### Escritores (3 em paralelo, caminhos disjuntos, na main)
| Escritor | Agente | Caminhos (dono único) |
|---|---|---|
| A. Regras, host e rede | `programador` (xhigh) | lib/livros/combate.ts, lib/livros/jogadores.ts, lib/livros/jogadoresVistos.ts, lib/ajusteDaFicha.ts, lib/batalha/formula.ts, lib/batalha/turnos.ts, stores/adventureStore.ts, net/hostSession.ts, net/hostBridge.ts |
| B. Telas do mundo | `programador-frontend` (xhigh) | screens/LivrosScreen.tsx, components/livros/*, stores/mundoDoLivroStore.ts |
| C. Montagens e batalha | `programador-frontend` (xhigh) | App.tsx, screens/MainMenu.tsx, components/PersonagensSection.tsx, components/livro/ControleDaBatalha.tsx, components/livro/QuemEntraNaBatalha.tsx |

C e B consomem as funções de A pelas assinaturas da fase 0. A é o menor e termina primeiro; B e C conferem na tela depois do commit de A.

### Critério de pronto (sem suíte)
- `rtk proxy npx tsc --noEmit` (client/) com 0 erros; `npx vite build` (client/) ok; nenhum .rs mudou.
- `rg -n "notaDoMestre|nomeDoJogador|soCenario" client/src/net/hostSession.ts` mostra a remoção em `paraOFio` e nenhum outro envio.
- Roteiro do usuário (12 passos): porta 04 abre; One Piece entra no mundo; ligar Aira a um nome; criar ficha para um nome visto; criar modelo "Recruta" e 2 variações; mudar a força do modelo para x1,5 e ver HP e dano mudarem; mudar o ataque do modelo pela ficha e ver a variação mudar junto; mandar um NPC para "Só no cenário"; no editor, abrir o mundo pelo atalho e voltar ao mapa; entrar no navegador com o nome ligado e já receber o token; Iniciar batalha com um token de cenário e escolher "Ficha mínima"; conferir que o NPC de cenário não marcado ficou fora da ordem e que o dano do NPC x1,5 sai multiplicado.

### Riscos
- `maximoComposto` tem 8 chamadores: algum pode aplicar a força 2 vezes ou gravar o máximo multiplicado de volta no disco. A lê os 8 antes; a força nunca é gravada no número, só entra na leitura.
- Variação materializada perde edição feita direto nela (técnica nova só na variação some no próximo sincronismo). A ficha da variação abre com o aviso "Variação de Recruta: técnicas e atributos vêm do modelo"; mexer nessas partes pede "Soltar do modelo" (vira NPC único).
- Entrega pelo nome é fraca por natureza (qualquer um digita "beto"). É a decisão do usuário; a conta continua mandando, o "Só com conta" continua valendo, e o mestre vê o aviso de nome repetido.
- Mundo aberto por cima do editor de um mapa de OUTRA pasta grava só no disco daquela pasta; a cópia aberta é de outra pasta e não conflita.
- MainMenu.test.tsx conta as portas e pode quebrar. Sem rodar agora (testes só quando o usuário pedir); anotar no PEDIDOS.md.

---

## M2. Comparar e balancear, Saúde da ficha, Anotações  (versão 0.5.20)

### O que o usuário vê
1. Marcador Comparar: escolhe 2 a 4 fichas (jogadores e NPCs, a força já aplicada); colunas com HP, SP, Escudo, os 8 atributos (rank) e cada golpe com o dano que a fórmula dá ("Na hora", "À mão" e "Não lê" em cinza). Embaixo, o peso do encontro: grupo x inimigos (com quantidade por NPC), rodadas para cada lado cair, veredito Fácil / Justo / Duro / Mortal e botões "Deixar Fácil / Justo / Duro", que ajustam a força dos inimigos (com Desfazer no aviso; avisa quando bate no limite x0,5 ou x2).
2. Marcador Saúde da ficha: 4 medidores (Custo, Dano, Ação, Tempo) com a porcentagem lida; lista do que não lê, filtrável, cada linha com o texto da ficha, o motivo e a sugestão; "Corrigir" edita o campo ali mesmo e mostra a releitura ao vivo; no Dano, "Deixar à mão". Variações não contam (herdam do modelo).
3. Marcador Anotações: lista à esquerda (jogadores e NPCs), texto à direita, "Só você vê", grava sozinho ("Guardada às 14:05"). A mesma nota aparece no detalhe do NPC e na janela de ficha do mestre.

### Modelo de dados
- `CartaoDaFicha.aMao?: true` (M2, fase 0) e `notaDoMestre` (já existe desde a M1, só ganha tela).
- Comparar: estado de sessão no mundoDoLivroStore (`comparar: string[]`, `grupo: string[]`, `inimigos: Record<string, number>`). Nada em disco.

### Regras puras novas
- lib/livros/encontro.ts: `melhorGolpe(p, sistema)` = maior dano que a ficha paga (custo cabe no SP máximo), sem OVERLOAD (`ehOverload`) e sem forma desligada, já com a força (vem da formula.ts); `pesoDoEncontro(grupo, inimigos, personagens, sistema)` com vida = HP máximo + Escudo, dano por rodada = melhor golpe x FATOR_DA_REACAO; razão = rodadas do grupo / rodadas dos inimigos; faixas 0,35 / 0,7 / 1 como no protótipo; `forcaParaOPeso(alvo)` = força x raiz(alvo / razão), arredondada a 0,05, presa em 0,5 e 2 (raiz porque a força mexe em HP e dano ao mesmo tempo). FATOR_DA_REACAO sai da tabela de lib/batalha/reacao.ts (crítico 5%, cheio 40%, metade 25%, resto 0 = 0,6), escrito como conta, não como número mágico.
- lib/livros/saude.ts: `lerSaude(personagens, sistema)` mapeia os leitores da F2: Custo (nada = vazio, valor = Lido, pergunta com sugestão = Lê na hora, sem sugestão = Não lê); Ação (ação nula com texto = Não lê); Tempo (texto = Não lê); Dano (valor = Lido; precisaArma e precisaAlvo = Lê na hora; naoEntende com texto = Não lê; vazio com `aMao` = À mão; semDano = fora). Porcentagem = (Lido + Lê na hora) / (Lido + Lê na hora + Não lê); À mão fica fora (decisão 6).
- lib/livros/sugestoes.ts: poucas regras, cada uma com o porquê: "ção X" vira "Ação X"; abreviação de atributo (FOR, AGI) vira o nome inteiro; "(ignora escudo)" sai do Dano e vira "Perfurante" no Efeito; custo com frase ("Seguir todas as condições") manda a frase para a Descrição e pede o número; dado ("2d6") sugere a média ou "Deixar à mão". Sem regra que serve: só "Corrigir" com releitura ao vivo.

### Arquivos
Novos: lib/livros/encontro.ts, saude.ts, sugestoes.ts; components/livros/PaginaComparar.tsx, PaginaSaude.tsx, PaginaAnotacoes.tsx (+ trechos no mundo.css).
Alterados: lib/personagem.ts (`aMao` no cartão, fase 0); components/livros/MundoDoLivro.tsx e PaginaNpcs.tsx (marcadores novos, bloco da nota); stores/mundoDoLivroStore.ts (estado do Comparar); components/FichaDePersonagemDialog.tsx (bloco "Anotação do mestre", só mestre, grava pelo mesmo `onSalvar`).

### Fase 0 (`programador`, high)
`aMao` em lib/personagem.ts; assinaturas e tipos de encontro.ts, saude.ts, sugestoes.ts; estado do Comparar na interface do store. tsc com 0 erros.

### Escritores (3)
| Escritor | Agente | Caminhos |
|---|---|---|
| A. Contas | `programador` (xhigh) | lib/livros/encontro.ts, saude.ts, sugestoes.ts |
| B. Comparar e Saúde | `programador-frontend` (xhigh) | components/livros/PaginaComparar.tsx, PaginaSaude.tsx, mundo.css, stores/mundoDoLivroStore.ts, MundoDoLivro.tsx |
| C. Anotações | `programador-frontend` (high) | components/livros/PaginaAnotacoes.tsx, PaginaNpcs.tsx, components/FichaDePersonagemDialog.tsx |

mundo.css: só B escreve; C manda as classes dele no relatório e B junta (ou C usa um anotacoes.css próprio, importado pela página: preferível, zero conflito).

### Critério de pronto
- tsc 0 erros, vite build ok, nenhum .rs.
- Conferência de número sem suíte: abrir Comparar com 2 fichas reais e conferir 1 golpe à mão com a fórmula (o mesmo número que o menu da vez mostra na batalha para a mesma ficha e arma).
- Roteiro: comparar 4 fichas; montar grupo de 4 contra 2 recrutas + 1 capitã; apertar "Deixar Justo" e ver a força mudar e o veredito virar Justo; Desfazer; Saúde: corrigir um "ção Bônus" e ver o medidor subir; "Deixar à mão" num dano com dado e ver sair da porcentagem; escrever nota na Aira, abrir a ficha da Aira no mapa e ver a nota; entrar como jogador e conferir que a nota não aparece na ficha dele.

### Riscos
- Os números do Comparar divergirem da batalha. Mitigação: encontro.ts só usa formula.ts e leituraDaFicha.ts, nunca uma cópia da conta.
- Porcentagem diferente do protótipo (84% custo, 57% dano): normal, as fichas reais são outras; o protótipo é forma, não meta.
- "Corrigir" grava no modelo e propaga às variações (esperado). Corrigir numa variação não existe: a Saúde não lista variação.

---

## M3. Itens, armas e habilidades  (versão 0.5.21)

### O que o usuário vê
1. Ficha One Piece ganha a aba Itens (nome, quantidade, efeito, descrição), no mapa e no mundo, para mestre e jogador (o jogador vê e edita a dele como as outras abas).
2. Marcador Itens: busca (atalho "/"), filtros Tudo / Armas / Habilidades / Itens / Perícias / Vantagens / Desvantagens, cartões com selo "Do livro" ou "Do catálogo"; à direita, "Ficha que recebe" (jogadores, modelos e NPCs únicos) com as seções; arrastar o cartão para a seção ou "Pôr em Aira"; aviso com Desfazer; arma além do "Armas por batalha" avisa "na batalha ela escolhe 1".
3. "+ Nova entrada" (arma, habilidade ou item) e editar/apagar; "Juntar das fichas da pasta" traz para o catálogo as armas e técnicas que já existem nas fichas (sem repetir nome).

### Modelo de dados
- Catálogo por SISTEMA em `<appData>/livros/<sistemaId>/catalogo.json`. Item: `{ id, tipo: 'arma' | 'habilidade' | 'item', nome (máx. 80), texto (máx. 600), campos: Record<string, string> }` com as chaves dos campos da aba de destino (`dano`, `acao`, `custo`, `tempo`, `efeito`, `quantidade`). Tolerante na leitura; máx. 2000 itens.
- Perícias, vantagens e desvantagens: lidas dos capítulos do livro do sistema (leitor de "**Nome:** texto **(Atributo)**"), só leitura, selo "Do livro". Sistema sem esses capítulos: o filtro some.
- Destino: tipo para aba fixa (arma = armas, habilidade = habilidades, item = itens, perícia = pericias, vantagem = vantagens, desvantagem = desvantagens). Pôr = `novoCartao` com os campos copiados. Variação não aparece no destino (herda do modelo).
- Sistema copiado pelo usuário (id novo) tem catálogo próprio e não ganha a aba Itens sozinho (a cópia é dele).

### Arquivos
Novos: lib/livros/catalogo.ts (tipos, leitura tolerante, `porNaFicha(personagem, item, sistema)`, `juntarDasFichas(personagens)`, busca normalizada), lib/livros/catalogoNoDisco.ts (ler/gravar, mesmo padrão de jogadoresVistos), lib/livros/catalogoDoLivro.ts (leitor dos capítulos), stores/catalogoStore.ts; components/livros/PaginaItens.tsx, EntradaDoCatalogoDialog.tsx, itens.css.
Alterados: lib/sistemaOnePiece.ts (aba `itens`); components/livros/MundoDoLivro.tsx (marcador).

### Fase 0 (`programador`, high)
Aba `itens` no sistemaOnePiece.ts; tipos e assinaturas de catalogo.ts, catalogoNoDisco.ts, catalogoDoLivro.ts e da store. tsc 0.

### Escritores (2)
| Escritor | Agente | Caminhos |
|---|---|---|
| A. Catálogo | `programador` (high) | lib/livros/catalogo.ts, catalogoNoDisco.ts, catalogoDoLivro.ts, stores/catalogoStore.ts |
| B. Página | `programador-frontend` (xhigh) | components/livros/PaginaItens.tsx, EntradaDoCatalogoDialog.tsx, itens.css, MundoDoLivro.tsx |

### Critério de pronto
- tsc 0, vite build ok, nenhum .rs.
- Roteiro: aba Itens aparece na ficha da Aira; criar "Sabre de serviço" (dano 35, Ação Simples); arrastar para a Aira; Desfazer; "Pôr em" pelo teclado; buscar "cura" acha a habilidade com "Cura" no Efeito; "/" foca a busca; "Juntar das fichas" traz as armas que já existem; o jogador abre a ficha dele e vê a aba Itens; na batalha, a arma posta pelo catálogo aparece na escolha de armas e o dano dela é lido.

### Riscos
- Arrastar e soltar: a janela main já tem dragDropEnabled false (tauri.conf.json:20), então o drag HTML5 interno funciona na WebView2. Mesmo assim o "Pôr em" é o caminho principal (teclado) e cobre qualquer falha do arrasto.
- Leitor dos capítulos: o texto do livro tem negrito torto ("**Natação: **", "**Dança**Você"). O leitor é tolerante e o que ele não entende não entra (melhor faltar que inventar).

---

## M4. Assistente da IA (Gemini)  (versão 0.5.22)

### O que o usuário vê
1. Coluna da direita do mundo: "Assistente do mestre", modos Conversa, Equilíbrio e Simulação, "Fichas na conversa" (até 4: citadas no texto entram sozinhas, ou "+ Pôr ficha"), linha "Lendo:" (seções de regra, catálogos, fichas, retratos), conversa e caixa de pergunta (Enter envia, Shift+Enter quebra linha).
2. Engrenagem: modelo (gemini-2.5-flash-lite padrão; lista do v2), até 3 chaves em campos de senha, "Guardar", "Apagar chaves". Depois de guardar, a tela só diz "2 chaves guardadas neste computador" e nunca mostra a chave de volta.
3. "Gerar NPC": pede em texto ("capitã da Marinha, forte em defesa"), recebe uma ficha pronta para revisar (atributos, HP, SP, técnicas, armas) e "Salvar no bestiário" como modelo ou NPC único.
4. Sem chave: aviso "Sem chave da IA" com "Pôr a chave". Cota esgotada numa chave: passa para a próxima e avisa. Sem internet, chave inválida ou cota acabada em todas: mensagem clara, nada trava.

### Segurança da chave (o desenho)
- A chave é segredo do usuário: mora no Cofre do Windows (Credential Manager), alvo `labirinto-vtt.gemini`, como um JSON com as chaves e o índice da ativa. Nunca em JSON do app, nunca no repositório, nunca no localStorage.
- A chamada ao Google sai do RUST, não da webview. A webview manda modelo + corpo e recebe a resposta; a chave nunca cruza o IPC na volta. Motivo: o fs:scope atual deixa a webview ler toda a pasta APPDATA do app, e qualquer segredo no lado JS fica exposto a qualquer bug ou dependência de front.
- CSP: tauri.conf.json tem csp nulo (sem CSP). Como a webview não fala com generativelanguage.googleapis.com, não há nada a liberar hoje; se um dia o CSP for ligado, a IA continua funcionando. Ligar CSP é endurecimento à parte, fora deste pedido.
- A visão do jogador (2ª webview, visao_jogador) também roda o código do app: todo comando da IA confere o rótulo da janela (só "main") e recusa o resto.

### Comandos IPC novos (lista fechada; nenhum acesso genérico)
| Comando | Entrada | Saída | Validação no Rust |
|---|---|---|---|
| `ia_chaves_estado` | nada | quantas chaves (0 a 3) | janela main |
| `ia_chaves_guardar` | lista de chaves | quantas ficaram | janela main; 1 a 3; cada uma aparada, 30 a 100 caracteres, só letras, dígitos, hífen e sublinhado; sem repetidas; grava com a ativa na primeira |
| `ia_chaves_apagar` | nada | nada | janela main; apaga a credencial |
| `ia_gerar` | modelo, corpo (texto JSON) | texto JSON da resposta e `trocouPara` (índice novo ou nulo) | janela main; modelo na lista fechada (a mesma do TS); corpo até 4 MiB e precisa ser objeto JSON; URL FIXA no código (generativelanguage.googleapis.com, v1beta, models, o modelo, generateContent); cabeçalho x-goog-api-key; timeout 90 s; resposta até 2 MiB; 429 passa para a próxima chave e grava a ativa nova no cofre; outro erro volta o status HTTP + até 300 caracteres do corpo do erro, com qualquer ocorrência da chave trocada por "(chave)"; nunca loga chave nem corpo |

Fora do Windows (não é alvo do app hoje): os 4 comandos respondem "Cofre indisponível neste sistema".

### Dependência (o usuário aprova ANTES da fase do Rust)
Recomendado: `keyring-core` 1.0.0 + `windows-native-keyring-store` 1.1.0 (só no alvo windows).
- Licença: MIT OR Apache-2.0 nas duas.
- Manutenção: organização open-source-cooperative (os mantenedores do keyring-rs); a família keyring está ativa em 2026 (keyring 4.1.6, de agosto de 2026, já está no cache local do cargo e usa estas duas).
- Tamanho: pacotes de 36 KB e 20 KB; puxam windows-sys 0.61.2 (versão nova no Cargo.lock, que hoje vai até 0.60.2; compila só as features usadas), byteorder e zeroize. rust-version 1.88; a máquina tem rustc 1.97.
- Antes de commitar: `trivy fs desktop/src-tauri` (regra 12) e o clippy da §2e.

Alternativa sem crate nova: `windows-sys` 0.60 (já no lock) como dependência direta com a feature Win32_Security_Credentials e cerca de 60 linhas de `unsafe` próprias (CredWriteW, CredReadW, CredDeleteW). Zero download, mas código inseguro nosso para revisar.
Rejeitada: `keyring` 4 completo (traz stores de Linux e Mac opcionais e mais superfície, sem ganho aqui). Rejeitada: DPAPI em arquivo no appData (o arquivo cifrado ficaria visível à webview pelo fs:scope; o cofre é o lugar certo).
HTTP: reqwest 0.13 (native-tls) já está no projeto; nenhuma crate nova para a chamada.

### Contexto que a IA recebe (porte do projeto-rpg-v2)
- lib/ia/gemini.ts: porte de `MODELOS_GEMINI`, `montarCorpo` (temperatura 0,2, topP 0,9, responseSchema quando houver), `extrairTexto`, erros SemChave e CotaEsgotada (vindos dos códigos do Rust). Sem fetch e sem chave no TS.
- lib/ia/prompts.ts: system prompt por modo (base `CABECALHO_SYSTEM`, `SYSTEM_PROMPT_ANALISE` e `SYSTEM_PROMPT_FICHA` do v2, com o texto do Labirinto); `detectarFichas` (porte de `detectarMencoes`: palavra de 4+ letras, flexão de até 2 letras, palavras comuns e títulos genéricos como "recruta" fora); índice do elenco (nome, tipo, 8 atributos) de todas as fichas da pasta; fichas detalhadas só das citadas (até 4): atributos com rank, HP/SP/Escudo máximos já com a força, técnicas com os campos, armas, itens, perícias, vantagens, e a `notaDoMestre` SÓ dessas; seções do livro pela pergunta (núcleo Mecânicas, Status e Ações de combate sempre, como `TITULOS_NUCLEO` do v2, mais as que a pergunta citar); catálogo resumido (nome + campos); teto de contexto (proposta: 120 mil caracteres; o catálogo encolhe primeiro). Equilíbrio sem ficha citada usa as do Comparar; Simulação sem NPC citado usa o encontro do Comparar.
- Retratos: só das fichas citadas, no máximo 4, reduzidos a 512 px antes de sair.
- lib/ia/gerarNpc.ts: responseSchema da ficha e `personagemDaIa(json, sistema)`, que valida tudo (número finito e dentro do limite, texto cortado, aba que o sistema não tem sai) e devolve NPC com força 1. A resposta da IA é texto não confiável: na conversa vira texto com a marcação leve do app (lib/marcacaoLeve.ts), nunca HTML.

### Arquivos
Rust: desktop/src-tauri/src/ia.rs (novo), src/lib.rs (registrar os 4 comandos e o estado), Cargo.toml e Cargo.lock.
TS novos: lib/ia/portaDaIa.ts (invoke tipado; fora do Tauri responde "IA só no app instalado"), lib/ia/gemini.ts, lib/ia/prompts.ts, lib/ia/gerarNpc.ts, lib/ia/retratos.ts, lib/ia/iaNoDisco.ts (só o modelo, em ia.json), stores/iaStore.ts; components/livros/PainelIA.tsx, ConfigDaIA.tsx, GerarNpcDialog.tsx, ia.css.
TS alterado: components/livros/MundoDoLivro.tsx (coluna da direita, botão de abrir e fechar o assistente).

### Fase 0 (`programador`, high)
lib/ia/portaDaIa.ts com os tipos exatos dos 4 comandos (nomes, campos, códigos de erro: sem_chave, cota_esgotada, http, rede, janela, corpo_invalido, modelo_invalido) e a lista fechada de modelos num lugar só no TS (o Rust copia a mesma lista com comentário apontando o arquivo TS). Assinaturas de prompts.ts, gerarNpc.ts e da iaStore. tsc 0.

### Escritores (3; Rust é 1 só)
| Escritor | Agente | Caminhos |
|---|---|---|
| R. Cofre e chamada | `programador-rust` (xhigh) | desktop/src-tauri/src/ia.rs, src/lib.rs, Cargo.toml, Cargo.lock |
| A. Contexto e geração | `programador` (xhigh) | lib/ia/gemini.ts, prompts.ts, gerarNpc.ts, retratos.ts, iaNoDisco.ts |
| B. Painel | `programador-frontend` (xhigh) | components/livros/PainelIA.tsx, ConfigDaIA.tsx, GerarNpcDialog.tsx, ia.css, stores/iaStore.ts, components/livros/MundoDoLivro.tsx |

R só começa depois do ok da dependência. A e B podem começar antes (a porta é o contrato).

### Critério de pronto
- tsc 0, vite build ok; em desktop/src-tauri o clippy da §2e (com -D warnings, unwrap_used e expect_used) limpo; trivy fs sem CVE alta nova.
- `rg -n "x-goog-api-key|generativelanguage" client/src` = 0 linhas (chave e URL só existem no Rust).
- Depois de guardar a chave: o Gerenciador de Credenciais do Windows (ou cmdkey com list) mostra a entrada labirinto-vtt.gemini sem mostrar o segredo; uma busca só por NOME de arquivo (rg -l) pelo prefixo das chaves do Google na pasta de dados do app não acha nada.
- Roteiro: guardar 1 chave; perguntar "Como funciona a reação no d20?" e ver a resposta com a regra; citar "Aira" e ver o chip entrar e o "Lendo:" mudar; Equilíbrio com 4 fichas; Simulação contra o encontro do Comparar; Gerar NPC, revisar e salvar no bestiário; chave errada dá mensagem clara; sem internet dá mensagem clara; abrir a visão do jogador e conferir que lá não há assistente.

### Riscos
- Dados da mesa vão ao Google (fichas citadas, notas citadas, retratos). É o desenho aprovado; a linha "Lendo:" mostra sempre o que sai.
- Texto das fichas pode conter instrução para a IA (injeção). Efeito máximo: resposta esquisita. A IA não executa nada; o Gerar NPC passa pela validação antes de virar ficha.
- Modelo some da API (id aposentado): a lista fechada fica num lugar só em cada lado; erro 404 vira "modelo indisponível, escolha outro".
- A credencial fica no Windows depois de desinstalar o app: o botão "Apagar chaves" resolve; a engrenagem diz isso.

---

## 4. Sequência e agentes (respeita: máx. 5 em voo, 3 escritores, Rust 1 por vez, tudo na main)

| Passo | O quê | Quem | Em paralelo com |
|---|---|---|---|
| 1 | Usuário responde as decisões da seção 5 (D1 a D6 mudam a M1; D7 a M3; D8 e D9 a M4) | usuário | nada |
| 2 | M1 fase 0 (contrato) + commit | programador | nada |
| 3 | M1 escritores A, B, C | programador + 2 programador-frontend | entre si |
| 4 | M1 conferência: tsc, vite build, rg do paraOFio; commit de fechamento; linha no PEDIDOS.md | orquestrador | nada |
| 5 | Usuário joga o roteiro M1; publica 0.5.19 se quiser | usuário | M2 fase 0 pode começar |
| 6 | M2 (fase 0 + A, B, C) | idem | nada |
| 7 | M3 (fase 0 + A, B) | idem | usuário responde D8 (dependência do cofre) |
| 8 | M4 (fase 0 + R, A, B) | programador-rust + programador + programador-frontend | nada |

Revisão opcional por fase (só se o usuário quiser gastar): 1 `revisor` focado em "nada de NPC, nota ou força vaza para o jogador" na M1 e 1 `auditor-seguranca` no ia.rs da M4.

## 5. Decisões que faltam (mudam o que o usuário vê)

D1. Jogador que tem CONTA (nome + PIN): ligar a ficha pela conta?
  Recomendo SIM. O seletor da página Jogadores mostra as contas primeiro (com "PIN") e os nomes vistos depois; ligar a uma conta usa o `dono` que já existe (mais seguro: ninguém pega a ficha digitando o nome). Nome só vale para quem entra sem conta.

D2. Jogador ligado entra num mapa da pasta onde ainda NÃO existe token da ficha dele.
  (a) o app cria o token sozinho, ao lado dos outros jogadores da cena (ou no centro), com aviso e Desfazer; (b) o mestre recebe o aviso "Bruno entrou sem token neste mapa" com o botão "Pôr token".
  Recomendo (b): token aparecendo sozinho pode cair numa sala escondida ou atravessar a névoa; com 1 clique o mestre decide onde. Onde o token já existe, ele chega com a ficha sozinho (é o caso comum, "em qualquer mapa deste livro").

D3. NPC de cenário que entrou na batalha com "Ficha mínima" ou "Como Recruta": depois da batalha, a ficha fica?
  Recomendo FICA no bestiário (selo "criado na batalha"; apagar é 1 clique). O registro da batalha e o Desfazer apontam para ela; apagar sozinho no fim quebraria o registro.

D4. Mais de uma pasta usando o One Piece: o mundo pergunta qual campanha?
  Recomendo perguntar só quando houver mais de uma, lembrando a última escolhida; com uma pasta só, entra direto (como no protótipo).

D5. NPCs que já existem nas pastas (sem a marca nova): contam como de combate?
  Recomendo SIM (nada muda na batalha de hoje). Quem só decora vai para "Só no cenário" com 1 clique na página NPCs de combate.

D6. Antes da M4, a coluna da IA aparece?
  Recomendo NÃO: o mundo fica com 2 colunas (marcadores e página) até a M4 chegar; nada de painel "em breve".

D7. Catálogo da M3 começa como?
  Recomendo VAZIO com "Juntar das fichas da pasta" (1 clique traz as armas e técnicas que suas fichas já têm) e "+ Nova entrada". Os itens do protótipo são inventados e não entram. Perícias, vantagens e desvantagens já vêm do livro.

D8. Cofre da chave (M4): crates `keyring-core` + `windows-native-keyring-store` (recomendado) ou código próprio com `windows-sys` já presente?
  Recomendo as crates: mantidas, licença MIT/Apache, pequenas, sem `unsafe` nosso. Detalhes na M4.

D9. Retratos das fichas citadas vão para o Google junto da pergunta?
  Recomendo SIM, só das fichas citadas, até 4, reduzidos a 512 px, sempre listados no "Lendo:". Alternativa: um interruptor "Mandar retratos" desligado por padrão.

## 6. Próximo passo
Agente: `programador` (fase 0 da M1), depois das respostas D1 a D6.
Input: este arquivo, seções 2.1, 2.3, 3 e "M1. Fase 0"; tocar só lib/personagem.ts, lib/livros/combate.ts, lib/livros/jogadores.ts, lib/livros/jogadoresVistos.ts, stores/mundoDoLivroStore.ts, types/screen.ts, lib/navigation.ts e os esqueletos de props de LivrosScreen, MundoDoLivro e QuemEntraNaBatalha. Pronto quando `rtk proxy npx tsc --noEmit` em client/ der 0 erros e o commit tiver só esses caminhos.

## Decisões D1 a D6 (30/10/2026)
- D1 Jogador com conta: ligado pela conta (usuário: "Sim, pela conta"). O nome de entrada só vale para quem entra sem conta.
- D2 Jogador ligado sem token no mapa: aviso com "Pôr token", nada é criado sozinho (usuário).
- D3 Ficha criada na batalha ("Quem entra na batalha?") fica no bestiário depois (orquestrador, pela recomendação).
- D4 Campanha: pergunta só se mais de uma pasta usar o sistema (usuário).
- D5 NPCs que já existem contam como de combate; o mestre desmarca os de cenário (usuário).
- D6 Sem coluna da IA antes da M4 (orquestrador, pela recomendação).
- D7 a D9 ficam para a M3 e a M4. Nota do orquestrador: o "programador" da divisão é trocado por "programador-frontend" (o código é TypeScript).
