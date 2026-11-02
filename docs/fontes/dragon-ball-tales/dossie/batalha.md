# Dossie: batalha One Piece (mapa para encaixar o motor Dragon Ball Tales)

Repo: C:/dev/labirinto, cliente em client/src. Caminhos abaixo relativos a client/src.
Levantado em 02/11/2026 no commit ed1a13ae. So leitura; nada foi executado.

## 1. Arquitetura (ponta a ponta)

### 1.1 Estado
- `stores/batalhaStore.ts:238` BatalhaState = { cenas: Record<sceneKey, BatalhaDaCena>, anuncio } + ~35 acoes (contrato :238-427).
- `stores/batalhaStore.ts:219` BatalhaDaCena extends BatalhaEmTurnos + { caminhos, trilhas, zerados, rev, turnosRev }.
  - caminhos/trilhas/zerados/rev = MODO BATALHA (movimento no grid; infra). turnosRev sobe a cada mudanca de ordem/registro/regras (dispara recorte ao jogador).
- `lib/batalha/ponte.ts:35` BatalhaEmTurnos = { turnos: TurnosDaCena, registro: LinhaDoRegistro[], regras: RegrasDaBatalha|null, efeitos?, judge? }.
- `lib/batalha/turnos.ts:80` TurnosDaCena: cartas, vez, rodada, desempate, d20, empates, extras, gastos (genericos) + OPCIONAIS One Piece: combate (recargas/usos/Overload/carga/armas), golpes, contras, formas, selos, invocados, invocacoes, lembretesDaMarca.
- `lib/batalha/turnos.ts:33` CartaDaOrdem { id, tokenId, personagemId, nome?, extra?, bando? }.
- `lib/batalha/turnos.ts:115` AutorDaAcao = mestre | jogador{playerId,nome}.
- Estado e SO da sessao do mestre: nao vai ao arquivo nem ao map.json (`stores/batalhaStore.ts:177-202`).

### 1.2 Fabrica e instancias
- `stores/batalhaStore.ts:949` estadoDaBatalha(mesa, set, get): corpo inteiro da store, preso a uma MesaDaBatalha.
- `stores/batalhaStore.ts:2338` criarBatalhaStore(mesa) -> zustand store nova.
- `stores/batalhaStore.ts:2346` useBatalhaStore = criarBatalhaStore(mesaDaAventura) (UNICA que App/host/ponte assinam).
- `stores/arenaStore.ts:107` batalhaDaArena = criarBatalhaStore(mesaDaArena) (isolada; ninguem da rede assina).
- `stores/batalhaStore.ts:2369` ponteDaBatalha: objeto fixo que delega a useBatalhaStore.getState() (preso a instancia real).

### 1.3 Autoridade
- O MESTRE (processo do host, mesmo processo Tauri) e a autoridade. Acao do mestre = chamada direta na store (ex.: `components/batalha/BatalhaDoMestre.tsx:434` agir, :343 reagir, :357 passarVez).
- Pedido do JOGADOR: fio -> `net/hostSession.ts:9749-9762` (switch) -> handleBatalha `net/hostSession.ts:7900` -> respostaDaBatalha :7911 -> `net/batalhaNoHost.ts` (posse, vez, rate-limit PEDIDOS_DE_BATALHA_POR_JANELA :184-195, reqId idempotente) -> PonteDaBatalha -> store (regra; d20 do host via secureRollDie em rolarD20, `stores/batalhaStore.ts:481`).
- O d20 nunca vem do jogador (`net/protocoloDaBatalha.ts:96-99`).

### 1.4 Protocolo de rede (`net/protocoloDaBatalha.ts`)
- Jogador -> host: batalha.passar :150, batalha.desfazer :157, batalha.agir :164, batalha.reagir :172, batalha.dano :179, batalha.armas :187, batalha.zerarCarga :195, batalha.passiva :206, batalha.evoluir :217, batalha.invocar :228, batalha.marcar :238, batalha.ajustar :245, batalha.contador :252.
- Host -> jogador: batalha.estado :279 (EstadoParaJogador|null), batalha.aliados :284, batalha.resultado :289 ({reqId, ok}), batalha.efeitos :296.
- Unioes: BatalhaPlayerMessage :258, BatalhaAcaoPlayerMessage :265, BatalhaHostMessage :301; entram em `net/protocol.ts:1197,1199,2049`; parse dispatch `net/protocol.ts:3438-3462`.
- Snapshot do mapa leva batalha?: true e caminhos? (`net/protocol.ts:1927`).
- Validacao estrita: lerEstadoParaJogador `net/protocoloDaBatalha.ts:1111` (campo torto derruba a mensagem inteira) -> um estado DBT dentro de batalha.estado seria REJEITADO pelo jogador.
- Jogador consome em `player/playerConnection.ts:4897-4925`; estado em batalhaEstado?: EstadoParaJogador (:373).
- Rust (desktop/src-tauri) nao conhece mensagens de batalha (sem allowlist): mensagem nova nao exige mudanca no Rust.

### 1.5 Host: recorte por conexao
- `net/batalhaNoHost.ts:179` criarBatalhaNoHost({ponte, agora, paraOFio}); instanciado em `net/hostSession.ts:3577`.
- `net/batalhaNoHost.ts:227` syncDe: ponte.cena(sceneKey) -> aliados -> vistaParaJogador (`lib/batalha/vistaDoJogador.ts:751`) -> diff por JSON -> efeitosParaJogador (:687).
- sync chamado em `net/hostSession.ts:5513` (entrou), :7907 (apos pedido), :11267 (broadcast).
- Onde a conexao esta: lugarNaBatalha `net/hostSession.ts:7655` (exige ponteDaBatalha e emBatalha).
- emBatalha `net/hostSession.ts:3723`: grid QUADRADO e options.getBatalha(sceneKey).
- Opcoes do host: getBatalha :1765, onBatalhaAndou :1767, getCaminhosDaBatalha :1773, ponteDaBatalha :1781.
- App liga tudo: `App.tsx:924-929` (getBatalha/onBatalhaAndou/getCaminhosDaBatalha/ponteDaBatalha) e `App.tsx:986`; subscribe `App.tsx:1033-1038` -> anunciarBatalha + notifyBatalhaChanged (`net/hostBridge.ts:731,738,3957,3963`) quando deveAvisarJogadores (`stores/batalhaStore.ts:2395`).
- Selectors do mapa do mestre: `App.tsx:1417-1425` (batalhaNaCenaAberta, vezTokenId, esperandoOMestre, judge, turnos).

### 1.6 Comecar a batalha a partir do mapa
- UI: `components/livro/LivroDaMesa.tsx:305` monta `components/livro/PaginaDaBatalha.tsx:21` -> ControleDaBatalha + (ligada) BatalhaDoMestre, PainelDoMestre.
- `components/livro/ControleDaBatalha.tsx:93`; atalho Shift+B (BATTLE_SHORTCUT `lib/keymap.ts:115`).
- confirmar `ControleDaBatalha.tsx:169`: quemPodeEntrar/precisaPerguntar (`lib/livros/combate.ts:296,326`) -> NPC sem ficha abre QuemEntraNaBatalha (`components/livro/QuemEntraNaBatalha.tsx:65`) -> confirmarQuemEntra :208 cria fichas (fichaDaEscolha `lib/livros/combate.ts:313`) e liga tokens (updateToken characterId).
- ligarBatalha `ControleDaBatalha.tsx:159-166`: sistema = sistemaPorId(biblioteca, sistemaAtivo(aventura)); combatentes = combatentesIniciais(map.tokens, personagens, sistema, incluir) (`lib/batalha/turnos.ts:255`: tira hidden, sem characterId e so-cenario; ordena por Agilidade) -> useBatalhaStore.ligar(sceneKey, abertura, {combatentes, regras, desempate}).
- ligar `stores/batalhaStore.ts:1644` -> cenaDoInicio :2349 (ordenarPelaAgilidade `turnos.ts:318` com d20 de desempate, passarVez para a 1a carta, lembretes de passivas de inicio).
- LADOS: a ordem nao tem lado; lado = EQUIPE (`lib/batalha/equipes.ts`, mesa.equipes()), usada no recorte (aliados) e na arena (EQUIPE_DO_LADO `lib/arena/tipos.ts:69`).

### 1.7 Ordem / vez
- passarVez store `stores/batalhaStore.ts:1702` -> `turnos.ts:398` passarVez (desconta selos, desce recargas, pula caidos via tokensCaidos `turnos.ts:156`, vira rodada, remove extras de rodada); linha "vez" com reversao.
- darVez :1734, moverCarta, ordenarPelaAgilidade :1788, incluirCombatente :1809, tirarCombatente :1818, normalizarCena :1869.
- agilidadeDe `turnos.ts:232` le o atributo "agilidade" via valorDoRank (One Piece).

### 1.8 Acoes, reacoes, dano (regras One Piece)
- agir `stores/batalhaStore.ts:1929` -> (transformar) mudarForma :977 | agirComACarta -> golpe.ts: podeAgir :215, lancarGolpe :312, custo via leituraDaFicha.
- agirComInvocado :1946; reagir :2067 -> rolarReacao `golpe.ts:413`, saidasPossiveis `reacao.ts:26` (d20 vs total: critico/cheio/metade/esquiva/contra), resolverAlvo :425, reacaoComTecnica.
- Dano no alvo: danoNoAlvo (`stores/batalhaStore.ts`, :837) -> ajustesDoDano `lib/batalha/reacao.ts:104` (Escudo + Perfurante) -> mexerNaFicha :724.
- darDano livre :2165. Acoes da vez (Simples/Completa/Bonus/Mov) em `lib/batalha/acoes.ts`.

### 1.9 Registro e Desfazer
- `lib/batalha/registro.ts:198` LinhaDoRegistro {id, seq, quando, rodada, autor, tipo, texto, envolve, reversao, desfeita?}.
- `registro.ts:51` TipoDaLinha e `registro.ts:70` Reversao: UNIAO FECHADA com ~30 variantes One Piece (golpe, contra, forma, selo, invocacao*, marca*, contador...).
- Escrita: comMudanca (`stores/batalhaStore.ts`, :505; usa comLinha `registro.ts:327`, proximoSeq :332; REGISTRO_MAX 300 :228).
- Desfazer: store desfazer :1914 -> desfazerLinha :1403 -> reverterTurnos `registro.ts:568` + desfazerFicha `registro.ts:837` (delta sobre o valor de agora).
- Jogador so desfaz as dele, tipos em TIPOS_QUE_O_JOGADOR_DESFAZ `registro.ts:237`; podeDesfazer :247; recorte registroParaJogador :298.
- Ajuste rapido de ficha durante a batalha vira linha: registrarAjuste `stores/batalhaStore.ts:1900` (o host chama em `net/hostSession.ts:7878`).

### 1.10 Fim da batalha
- desligar `stores/batalhaStore.ts:1663` (tira invocados via mesa, apaga a cena). Chamado por encerrar `ControleDaBatalha.tsx:140`.
- O host manda batalha.estado: null uma vez (`net/batalhaNoHost.ts:230-236`).
- Nao ha vitoria automatica: o mestre encerra.

### 1.11 Vista do jogador
- Recorte: `lib/batalha/vistaDoJogador.ts:139` EstadoParaJogador (rodada, turno N/M, vez, cartas, registro, regras, acoes, meus, reacoes, golpes, contras, judge, aparencias, retratos): muito One Piece.
- Tela: `player/main.tsx:1544-1546` monta `components/batalha/BatalhaDoJogador.tsx:110` (props :71: estado, efeitos, meus, fichas, sistema, conexao, consulta, alvoDoMapa, onMirando, onTremor, textoDaVez, tamanhoDaCasa).
- Mira no mapa (alvo por toque na ficha): `player/main.tsx:1535` aoEscolherFicha + alvoDoMapa.

## 2. Infra agnostica x regra One Piece

### Infra (reaproveitavel sem mexer)
- Contrato de mesa: `lib/batalha/mesa.ts:19` MesaDaBatalha (personagens, sistema, equipes, ajustarPersonagem, trocarEquipe, invocado*). Implementacoes: `stores/mesaDaAventura.ts:69`, `stores/arenaStore.ts:84`.
- Movimento no grid: `lib/batalha/blocos.ts`, `caminhoAndado.ts`, `movimentoEmBatalha.ts`, `medicao.ts` (sem regra).
- Equipes: `lib/batalha/equipes.ts` (aliadosDe, equipeDe).
- Diff e desfazer de ficha: `registro.ts:716` partesDoAjuste, `registro.ts:837` desfazerFicha, `lib/ajusteDaFicha.ts:328` aplicarAjustes (recurso/maximo/cartao, generico por SistemaDeRpg).
- Vida/caidos: `lib/vidaDaFicha.ts:55` recursoDeVida (tom vida), `turnos.ts:156` tokensCaidos.
- Helpers puros de ordem: cartaDaVez :124, turnoNoM :136, proximaCarta :177, novaCarta :221, ordenarPelaAgilidade :318 (recebe Map de numeros: serve a iniciativa DBT).
- UI apresentacional: `components/batalha/FaixaDaOrdem.tsx`, `CartaDaOrdem.tsx`, `RegistroDaBatalha.tsx`, `MenuDaCarta.tsx` (so consomem view-models DadosDaCarta/DadosDaFaixa/LinhaNaTela, `components/batalha/dadosDaFaixa.ts:39,130,416`).
- Transporte: batalhaNoHost (rate-limit, reqId, diff JSON, efeitos por seq): generico na forma, mas tipado nas mensagens OP.
- Judge (mascote no mapa) `lib/batalha/judge.ts`; abertura/transicao (AberturaDaBatalha `stores/batalhaStore.ts:205`, aberturaLembrada.ts).
- Arena: `lib/arena/montagem.ts`, `copias.ts`, `tipos.ts` (grade, lados a/b), `components/arena/PalcoDaArena.tsx` (so props; Pixi em pixi/palcoDaArena).

### Regra One Piece (nao reusar no DBT)
- formula.ts, golpe.ts, reacao.ts (d20 -> saidas), reacaoComTecnica.ts, acoes.ts (Simples/Completa/Bonus), leituraDaFicha.ts (abas armas/habilidades, custo SP/HP, Overload, Perfurante, balas), transformacao.ts, invocacao.ts, marca.ts, selos.ts (mods/turnos), passivas.ts, contador.ts, escolhaEEvolucao.ts, tiposDaHabilidade.ts, calculadora.ts, regrasDoCampo.ts (blocos por rank de Agilidade), combate.ts (tipos de pedido/efeito OP).
- Mistos (infra + OP no mesmo arquivo): turnos.ts (passarVez desconta selos e recargas; agilidadeDe = atributo agilidade), registro.ts (Reversao fechada OP), vistaDoJogador.ts, batalhaStore.ts, protocoloDaBatalha.ts, batalhaNoHost.ts, dadosDaFaixa.ts (le selos/formas/escudo/bando).
- Componentes OP: BatalhaDoMestre, BatalhaDoJogador, MenuDaVez, MiraDoGolpe, CaixaDeReacao, ListaDeTecnicas, ListaDeFormas, PassivasDaBatalha, InvocacoesDoMestre, SeloDialog, CalculadoraDeDano, EfeitosDaBatalha (saidas do d20), FaixaDoMestre/FaixaDoJogador (contador, formas, passivas).

## 3. Leitura e escrita da ficha
- Leitura sempre na hora pela mesa: fichasDaMesa `stores/batalhaStore.ts:477` -> mesa.personagens() / mesa.sistema().
- Leitura OP: `lib/batalha/leituraDaFicha.ts` le texto livre dos cartoes (aba habilidades :21, campos acao/custo/tempo :27-29, lerCusto :61, lerAcao :82, lerTempo :110, tecnicasComForma :176 inclui subcartoes das formas ligadas, recursoDoCusto :203 sp/hp, recursoDoEscudo :209).
- Atributos: valorDoRank `lib/ajusteDaFicha.ts:113`; vida: vidaDoPersonagem `lib/vidaDaFicha.ts:61`.
- Escrita: mexerNaFicha `stores/batalhaStore.ts:724` (lista de Ajuste -> aplicarAjustes -> mesa.ajustarPersonagem) e trocarFicha :888 (personagem novo pronto); as duas devolvem ParteDaFicha[] para a Reversao "ficha".
- Mesa real: mesaDaAventura.ajustarPersonagem -> useAdventureStore.ajustarPersonagem (`stores/mesaDaAventura.ts:72`): historico da ficha cresce e o jogador recebe pelo syncPersonagens de sempre.
- Arena: so nas copias (`stores/arenaStore.ts:90-98`).

## 4. Costura por sistema

### Existe?
- NAO. A store nunca ramifica por sistema.id; mesa.sistema() so devolve o SistemaDeRpg ativo (`stores/mesaDaAventura.ts:71`).
- Unico ramo por id: `screens/LivrosScreen.tsx:42` SISTEMAS_COM_MUNDO = {ID_ONE_PIECE} (mundo do livro + arena so no One Piece). ID_ONE_PIECE = "one-piece" (`lib/sistemaOnePiece.ts:30`).
- Sistema ativo e por aventura: sistemaAtivo `stores/adventureStore.ts:938`; SistemaDeRpg tem id (`lib/sistemaDeRpg.ts:157`).
- Nenhum codigo nem sistema Dragon Ball no repo hoje.

### Costura recomendada
1. Motor escolhido pelo id do sistema, decidido no INICIO da batalha:
   - novo `lib/motorDaBatalha.ts` (fino): motorDoSistema(sistema) -> "onePiece" | "dbt" (ex.: sistema.id === "dragon-ball-tales"; padrao "onePiece", nada muda hoje).
2. Pastas paralelas, sem importar regra OP:
   - `lib/batalhaDB/`: estado proprio (ordem por iniciativa, vez, rodada, fase acao/reacao, Ki, estagios de dano, condicoes), regras puras, registro proprio (LinhaDB + ReversaoDB), vistaDoJogadorDB, leituraDaFichaDB (tecnicas com rank).
   - `stores/batalhaDBStore.ts`: criarBatalhaDBStore(mesa: MesaDaBatalha), MESMO contrato de mesa (reusa mesaDaAventura e o padrao da mesaDaArena).
   - `net/protocoloDaBatalhaDB.ts` com prefixo PROPRIO (batalhaDB.estado, batalhaDB.agir, batalhaDB.reagir, batalhaDB.passar, batalhaDB.desfazer, batalhaDB.resultado, batalhaDB.efeitos) e `net/batalhaDBNoHost.ts`.
   - `components/batalhaDB/`: PaginaDaBatalhaDB, BatalhaDoMestreDB, BatalhaDoJogadorDB.
3. Reusar por import, sem editar: MesaDaBatalha, movimento (blocos/caminhoAndado/movimentoEmBatalha), equipes, partesDoAjuste/desfazerFicha/aplicarAjustes, recursoDeVida/tokensCaidos, cartaDaVez/proximaCarta/turnoNoM/novaCarta/ordenarPelaAgilidade (com Map de iniciativa), FaixaDaOrdem/CartaDaOrdem/RegistroDaBatalha/MenuDaCarta via view-model proprio, Judge e abertura, secureRollDie (lib/dice).
4. Pontos de despacho (edicao ADITIVA em arquivos compartilhados, nao em regra OP):
   - `components/livro/LivroDaMesa.tsx:305`: PaginaDaBatalha ou PaginaDaBatalhaDB pelo motor do sistema ativo.
   - `App.tsx:924-929,986`: getBatalha = op.ligada(k) || db.ligada(k); onBatalhaAndou/getCaminhosDaBatalha vao a store que tem a cena; nova opcao ponteDaBatalhaDB.
   - `App.tsx:1033-1038`: segundo subscribe (useBatalhaDBStore) chamando notifyBatalhaChanged/anunciarBatalha.
   - `App.tsx:1417-1425`: selectors do mapa (vez, judge) lendo das duas stores.
   - `net/protocol.ts:1197,1199,2049,3438`: unioes e parse de batalhaDB.*.
   - `net/hostSession.ts:1781,3577,5513,7655,7900,9749,11267`: segunda ponte, instancia batalhaDBNoHost e cases novos.
   - `player/playerConnection.ts:373,4897`: estado batalhaDBEstado separado; `player/main.tsx:1544` monta BatalhaDoJogadorDB.

### Riscos de estado compartilhado
- useBatalhaStore e instancia unica global (`stores/batalhaStore.ts:2346`) e ponteDaBatalha (:2369) esta presa a ela. Batalha DBT dentro dessa store exigiria editar a store OP: nao fazer; store separada.
- Mesma sceneKey nas duas stores: impedir no despachante do App (DB recusa ligar se op.ligada(k) e vice-versa), senao getBatalha/caminhos ficam ambiguos.
- Nomes de mensagem: reusar batalha.estado quebra o parse estrito do jogador (`net/protocoloDaBatalha.ts:1111`) e o recorte OP; usar prefixo novo.
- Rate-limit e reqId sao por instancia de batalhaNoHost: uma instancia DBT separada dobra o teto por jogador (aceitavel) ou compartilhar o contador.
- Shift+B e ouvido dentro do ControleDaBatalha; um ControleDaBatalhaDB montado junto disputaria o atalho: montar so uma pagina por vez (despacho no LivroDaMesa).
- registrarAjuste do host (`net/hostSession.ts:7878`) so avisa a ponte OP: ajuste de ficha durante batalha DBT nao vira linha do registro DB sem chamada nova.
- emBatalha exige grid quadrado (`net/hostSession.ts:3723`): vale para as duas.
- ultimoSeqDeEfeito e de modulo (`stores/batalhaStore.ts:701`): o DB precisa do seu.
- turnos.ts e quase generico, mas passarVez mexe em selos/recargas OP; se o DB importar passarVez, mudanca futura no OP muda o DB. Melhor ordem propria no DB e importar so os helpers puros de leitura.

## 5. Arena de testes
- Entrada: `components/livros/MundoDoLivro.tsx:52,223` (PaginaArena lazy), so para sistemas em SISTEMAS_COM_MUNDO (`screens/LivrosScreen.tsx:42,115`) = hoje so One Piece.
- `components/arena/PaginaArena.tsx:233` abre a sessao (useArenaStore.abrir(sistemaId) :240), montagem por lado, Comecar -> lutar(fichas) :266; na fase lutando monta TelaDaArena :374.
- Bootstrap `stores/arenaStore.ts:219` comecar: copiasDaMontagem (`lib/arena/copias.ts:47`, id arena_ + uuid, historico zerado) -> fichaDoBoneco (`lib/arena/boneco.ts:53`, OP: escudo e HP infinito) -> tokensDaArena (`lib/arena/montagem.ts:128`, grade 12x8 ou 16x10, lados a/b) -> combatentesIniciais -> batalhaDaArena.ligar(CENA_DA_ARENA, ...) :250 -> moverJudge.
- Mesa das copias `stores/arenaStore.ts:84` (MesaDaBatalha; trocarEquipe = false; sem invocacao).
- Boneco automatico: passoDoBoneco `lib/arena/reacaoDoBoneco.ts:60` (d20 OP), subscribe `stores/arenaStore.ts:355`; placar `lib/arena/placar.ts:121` le linhas de golpe OP.
- Luta: `components/arena/TelaDaArena.tsx` usa BatalhaDoJogador + vistaDaArena (`lib/arena/estadoDaArena.ts:62`, usa vistaParaJogador) e chama batalhaDaArena direto (:249-252).
- Segundo motor? Nao como esta: arenaStore amarra batalhaDaArena (OP) no modulo (:107), e boneco/placar/TelaDaArena sao OP. Caminho limpo: `stores/arenaDBStore.ts` + `components/arenaDB/TelaDaArenaDB.tsx`, reusando lib/arena/{tipos,montagem,copias}, PalcoDaArena e o padrao de mesa das copias; PaginaArena escolhe a tela pelo motor (ou PaginaArenaDB). Para a arena aparecer no DBT e preciso pôr o id DBT em SISTEMAS_COM_MUNDO (isso tambem liga a pagina de NPCs do mundo, `MundoDoLivro.tsx:227`).

## Pontas soltas (nao cobertas)
- Nao li por dentro: formula.ts, invocacao.ts, passivas.ts, selos.ts; EfeitosDaBatalha.tsx; o desenho Pixi de selos/formas nos tokens (pixi/tokenPhotoSprite); a tela da mesa (TV) alem do anunciarBatalha; jornadas e2e de batalha.
- Nao conferi em detalhe o recorte de caminhos no host (`net/hostSession.ts:4624,4709`); so que depende de getCaminhosDaBatalha.
- Diagrama existente: docs/diagrams/batalha-turnos.html (F1); planos em docs/planos/batalha-*.md.
