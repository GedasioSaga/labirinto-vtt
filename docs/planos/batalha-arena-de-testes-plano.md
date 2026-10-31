# Arena de testes de batalha — plano (30/10/2026)

Pedido literal (PEDIDOS.md:1994, 30/10/2026): "quando colocar o juiz, eu quero tambem que você crie um ambiente de testes, de teste de batalhas, onde eu vou poder testar os bonecos um contra os outros e sozinhos, no caso de sozinho o juiz fica como um boneco."
Decisões já tomadas: fim de docs/planos/batalha-one-piece-f3-plano.md ("Respostas do usuário", linha "Arena de testes").

Domínio: aplicação desktop/web (TS/React/Pixi no client). Nada em Rust, nada de rede, nada de disco novo.

## 1. Entendimento

O mestre abre um marcador "Arena de testes" no mundo do livro de regras, monta dois lados com CÓPIAS de fichas (jogadores e NPCs de combate da pasta) ou um lado só contra o Judge-boneco, e joga a batalha inteira (ordem, menu de tiras, golpe, reação d20, dano, forma, selos, registro com Desfazer) numa grade pequena, controlando todos os lados. Nada grava nas fichas reais. No modo boneco, o Judge vira o alvo: vida infinita (ajustável), Escudo e modificador de reação ajustáveis, reage com d20 ou fica parado, e um placar (dano por golpe, total, média por rodada).

## 2. O que a investigação achou (o que dá para reaproveitar)

| Peça | Onde | Acoplamento | Reuso na arena |
|---|---|---|---|
| Motor da batalha (regras puras) | client/src/lib/batalha/* (turnos, golpe, reacao, registro, selos, transformacao, judge, vistaDoJogador, movimentoEmBatalha) | puro, sem store | 100%, sem mudar |
| Store da batalha | client/src/stores/batalhaStore.ts (1295 linhas) | singleton zustand; lê e grava a ficha SÓ por 5 pontos: mesaDoRpg() (l.267), ajustarPersonagem (l.349, 431, 499), trocarEquipe (l.357, 860), equipesAtivas/personagensAtivos (l.857-863) | refatorar em FÁBRICA com a "mesa" injetada (fase 0); a arena ganha uma instância própria |
| Assinatura do App | client/src/App.tsx:1032-1036 (anuncio e notifyBatalhaChanged vão aos jogadores) | só assina useBatalhaStore | a instância da arena não é assinada por ninguém: isolamento de graça |
| Menu de tiras, reação, efeitos, armas | components/batalha/BatalhaDoJogador.tsx | 100% por props: estado (EstadoParaJogador), conexao (ConexaoDaBatalha), meus, fichas, sistema, consulta, alvoDoMapa | reusar inteiro; conexao = chamada direta na store da arena com autor mestre |
| Faixa da ordem + registro com Desfazer | components/batalha/FaixaDaOrdem.tsx (papel "mestre") + dadosDaFaixa.ts (faixaDoMestre, linhasDoMestre, puros) | por props | reusar inteiro |
| Diálogos do mestre (dar dano, selo, ações extras) | DarDanoDialog, SeloDialog, AcoesExtrasDialog | por props | reusar; o hospedeiro deles (BatalhaDoMestre/DialogoDoMestreNaCena) NÃO serve: lê adventureStore e mapStore |
| BatalhaDoMestre, FaixaDoMestre, PainelDoMestre | components/batalha/ | presos a adventureStore, mapStore, useBatalhaStore | NÃO reusar; a arena tem o seu contêiner fino |
| Desenho das fichas | pixi/tokensRenderer.ts: createTokensRenderer(motion).draw(container, tokens, grid, sel, zoom, ..., vidas, ..., vezTokenId, fotoDaForma, selos) | independente de store | reusar no palco próprio |
| Grade da batalha | pixi/gradeDaBatalha.ts criarGradeDaBatalha() | independente | reusar |
| Judge | pixi/judgeDoMapa.ts createJudgeDoMapa({movimento}) + lib/batalha/judge.ts | independente (camada Pixi) | reusar: árbitro no modo lados, boneco no modo solo |
| Câmera | pixi/world.ts (panBy, zoomAt) | independente | reusar |
| Blocos andados | lib/batalha/movimentoEmBatalha.ts passoEmBatalha() | puro | reusar no soltar do arrasto, depois somarCaminho |
| Mundo do livro | components/livros/MundoDoLivro.tsx (MARCADORES, l.27) + stores/mundoDoLivroStore.ts (AbaDoMundo = "jogadores" ou "npcs", l.21) | personagens por usePersonagensDoMundo(), sistema por sistemaPorId(biblioteca, aberto.sistemaId) | marcador novo "arena" |

Achado decisivo: o mundo do livro abre também pela TELA INICIAL, sem aventura aberta. A store da batalha de hoje lê os personagens de useAdventureStore; na tela inicial ela não acharia ninguém. Por isso a ficha tem que vir de fonte injetada, não de "cena temporária na aventura".

## 3. Abordagens candidatas

### 3a. Motor (onde a batalha da arena vive)
- A1 (ESCOLHIDA) Fábrica criarBatalhaStore(mesa) + instância separada da arena com a mesa da arena (cópias em memória). Isolamento total: sem host, sem anúncio aos jogadores, sem App, sem registrarAjuste cruzando. Custo: refator mecânico de 1 arquivo quente, verificado por tsc.
- A2 (rejeitada) Mesma store, sceneKey "arena:" com roteamento por prefixo: mesaDoRpg não recebe sceneKey (teria de passar por todo helper), e App, host, ControleDaBatalha e FaixaDoMestre teriam de ignorar a chave da arena em todo lugar. Vazamento garantido.
- A3 (rejeitada) Aventura temporária na adventureStore: derruba a aventura aberta e não existe na tela inicial.

### 3b. Onde desenha
- D1 (ESCOLHIDA) Palco Pixi próprio e leve (PalcoDaArena, ~300 linhas) montado com tokensRenderer + gradeDaBatalha + judgeDoMapa + world.ts. Só props, sem store.
- D2 (rejeitada) PixiCanvas do editor com mapa temporário: o PixiCanvas (485 KB) lê o mapStore; trocar o mapa mexe em autosave, desfazer e "sujo"; e não existe editor na tela inicial.
- D3 (rejeitada) PlayerView (257 KB) com mapa gerado: traz névoa, visão, explorado, câmera de chegada e dezenas de props; peso e acoplamento escondido para ganhar pouco além do que o tokensRenderer já dá.
- D4 (rejeitada) Visão de jogador (net/visaoDeTeste: janela própria + BroadcastChannel + ponte de host de teste): é janela separada e a batalha dela ainda grava nas fichas reais.

### 3c. Rede
- Sem rede (ESCOLHIDA). Jogadores não veem a arena. Com rede exigiria ponte do host, recorte e protocolo novo; o pedido é "o mestre controla todos os lados".

## 4. Arquitetura

### 4.1 Fluxo
Mundo do livro (marcador Arena) -> Montagem (escolhe lados) -> arenaStore.lutar(): copia as fichas, gera grade e tokens, cria o boneco se for o caso, liga a batalha na instância da arena -> TelaDaArena lê a instância (cena "arena") -> ações do mestre vão direto à instância (autor mestre) -> a instância grava SÓ nas cópias pela mesa da arena -> placar derivado do registro.

Diagrama (texto):
  MundoDoLivro --aba arena--> PaginaArena (montagem)
  PaginaArena --lutar--> arenaStore (cópias, tokens, boneco, placar)
  arenaStore --mesa da arena--> batalhaDaArena = criarBatalhaStore(mesaDaArena)
  useBatalhaStore real = criarBatalhaStore(mesaDaAventura)   (App e host continuam só nela)
  TelaDaArena --props--> PalcoDaArena (Pixi) / FaixaDaOrdem mestre / BatalhaDoJogador / PlacarDoBoneco

### 4.2 Contrato da mesa (fase 0)
Arquivo novo client/src/lib/batalha/mesa.ts (só tipo):
  interface MesaDaBatalha {
    personagens(): readonly Personagem[]
    sistema(): SistemaDeRpg ou null
    equipes(): readonly Equipe[] ou undefined
    ajustarPersonagem(id: string, ajustar: (atual: Personagem) => Personagem): boolean
    trocarEquipe(id: string, equipeId: string ou null): boolean
  }
- batalhaStore.ts: export function criarBatalhaStore(mesa: MesaDaBatalha) devolve o hook zustand; mexerNaFicha, trocarFicha, desfazerReversao e mesaDoRpg passam a usar a mesa recebida (closure dentro da fábrica, ou parâmetro). export const useBatalhaStore = criarBatalhaStore(mesaDaAventura). Tipo exportado: type LojaDaBatalha = ReturnType<typeof criarBatalhaStore>.
- client/src/stores/mesaDaAventura.ts (novo): a mesa de hoje (useAdventureStore + useRpgStore), exatamente o que mesaDoRpg e as chamadas diretas fazem agora. O import de adventureStore sai da batalhaStore.
- ultimoSeqDeEfeito continua no módulo (compartilhado entre instâncias): só sobe, não atrapalha.
- Comportamento da batalha real: idêntico. Nenhum consumidor muda de import.

### 4.3 Modelo de dados da arena (memória da sessão, nada em disco)
client/src/lib/arena/tipos.ts (fase 0, só tipos e constantes):
  CENA_DA_ARENA = "arena"
  CASA_DA_ARENA = 64 (px); GRADE_PEQUENA = 12 x 8; GRADE_MEDIA = 16 x 10
  VIDA_INFINITA = 1_000_000 (mostrada como "∞")
  type LadoDaArena = "a" ou "b"
  interface EscolhaNaMontagem { personagemId (o real); lado: LadoDaArena; vezes: 1..6 (o mesmo NPC repetido) }
  interface MontagemDaArena { modo: "lados" ou "boneco"; escolhas: EscolhaNaMontagem[]; grade: "pequena" ou "media" }
  interface BonecoDaArena { tokenId; personagemId; infinito: boolean; hp: number; escudo: number; modificador: -99..99 (MODIFICADOR_DA_REACAO_MAX); reage: "d20" ou "parado" }
  interface GolpeNoPlacar { linhaId; rodada; atacante; golpe; escudo; hp; total }
  interface SessaoDaArena {
    fase: "montando" ou "lutando"
    montagem: MontagemDaArena
    sistemaId: string
    copias: Personagem[]              (id novo "arena_<uuid>", nome igual, histórico zerado)
    origemDe: Record<copiaId, realId> (só para mostrar)
    tokens: Token[]                   (gerados: id "arena_tok_<n>", characterId = cópia, x/y no centro da casa, color do lado, image/imageData do retrato quando resolver)
    ladoDe: Record<tokenId, LadoDaArena ou "boneco">
    boneco: BonecoDaArena ou null
    placarCongelado: GolpeNoPlacar[]  (golpes cujas linhas saíram do registro: REGISTRO_MAX = 300)
  }
  interface AcoesDaArena { escolher, tirar, trocarModo, lutar, moverFicha(tokenId, x, y), ajustarBoneco(parcial), recomecar, voltarAMontagem, sair }

Mesa da arena (dentro de stores/arenaStore.ts):
- personagens() = copias; sistema() = o do livro aberto (sistemaPorId); equipes() = duas equipes virtuais { id "arena-a" e "arena-b", nome "Lado A"/"Lado B", cor, membros = cópias do lado } (o boneco no lado b); ajustarPersonagem grava em copias; trocarEquipe devolve false (fora).
- Cópia: structuredClone da ficha real + id novo; o mesmo NPC repetido ganha sufixo no nome ("Marinheiro 2"). Id novo garante espelho (Bruno contra Bruno) sem colisão.

Boneco (lib/arena/boneco.ts, puro): fichaDoBoneco(sistema, boneco) monta um Personagem tipo npc, nome "Judge", com recursoDeVida(sistema) = hp (ou VIDA_INFINITA) e recursoDoEscudo(sistema) = escudo, máximos iguais, Agilidade 0, sem técnicas. Ajustar HP/Escudo pelo painel troca a cópia direto (sem linha no registro: é ajuste do laboratório, não da luta).

Placar (lib/arena/placar.ts, puro): placarDoBoneco(registro, bonecoPersonagemId, idVida, idEscudo, congelado) percorre as linhas NÃO desfeitas e, em cada reversão (composta inclusive) do tipo "ficha" do boneco, soma (de - para) das partes "recurso" de vida e escudo que DESCERAM. Uma linha = um golpe (o dano do alvo entra na linha do golpe por linhaAtualizada, batalhaStore.ts perto da l.462). Saída: lista por golpe, total, média por rodada = total / rodada atual (turnos.rodada). Desfazer some sozinho (linha desfeita não conta). Linhas que saem do teto do registro vão para placarCongelado antes de sumir.

Reação do boneco (lib/arena/reacaoDoBoneco.ts, puro + assinatura no arenaStore):
- "parado": golpe pendente com o boneco de alvo -> reagir { tipo "naoReagir" }.
- "d20": reagir { tipo "rolar", modificador do boneco }; quando a rolagem volta, escolhe a melhor saída defensiva entre saidasPossiveis (esquiva > metade > cheio; nunca "contra": o boneco não age; crítico entra quando o dado manda).
- Vez do boneco: a arena passa a vez dele sozinha (passarVez com VezEsperada), assim os selos dele contam (Q4).
- Atraso curto (~600 ms) antes de cada passo automático, para o d20 e o número aparecerem.

### 4.4 Telas
1. Marcador "Arena de testes" em MundoDoLivro (MARCADORES ganha a aba "arena", ícone novo em components/livros/icones.tsx; sem contagem). AbaDoMundo += "arena".
2. PaginaArena (a montagem, dentro da página do mundo): colunas Lado A / Lado B, lista das fichas da pasta (Jogadores e NPCs de combate, filtro entraNaBatalha), botões "+ A" / "+ B", repetir NPC (x2, x3), chave "Contra o Judge-boneco" (some o Lado B e aparece o cartão do boneco: HP ∞, Escudo, Mod. reação, Reage d20 / Parado), grade Pequena/Média, aviso fixo "As fichas aqui são cópias: nada mexe nas fichas de verdade", botão "Começar o teste" (precisa de 1 de cada lado, ou 1 contra o boneco).
3. TelaDaArena (camada cheia por cima do mundo):
   - barra do alto: "Arena de testes · Rodada N", Recomeçar, Voltar à montagem, Sair da arena;
   - PalcoDaArena no centro (grade, fichas com barra de vida, anel da vez, selos, foto da forma, Judge);
   - FaixaDaOrdem papel "mestre" (arrastar ordem; menu da carta: dar dano, ações extras, selo; registro com Desfazer);
   - BatalhaDoJogador por cima do palco: menu de tiras da carta da vez (de qualquer lado), caixa REAÇÃO para qualquer alvo, efeitos, escolha de armas;
   - modo boneco: PlacarDoBoneco (por golpe: rodada, quem, golpe, Escudo + HP = total; Total; Média por rodada) e AjustesDoBoneco (popover).
4. Recomeçar: copia de novo as fichas reais de AGORA, mesma montagem, posições iniciais, placar zerado, batalha religada.

Projeção para o menu (lib/arena/estadoDaArena.ts, puro): vistaParaJogador(cena, ctx) com meusTokens = TODOS os tokens da arena, tokensNoRecorte = todos, meusPersonagens = todas as cópias, aliados vazio, equipes = as duas virtuais. Assim minhaVez é sempre verdade, toda reação pendente aparece e todo contra-ataque guardado também. "SUA VEZ" do efeito vira "Vez de NOME": prop opcional textoDaVez no BatalhaDoJogador (o jogador real não muda).

Conexão do menu (TelaDaArena): agir -> loja.agir(CENA_DA_ARENA, MESTRE, vez, pedido); reagir, escolherArmas, passarVez (com VezEsperada) e zerarCarga idem (é o mesmo caminho que o PainelDaVezDoNpc do mestre já usa). Mira: tocar ficha no palco vira alvoDoMapa { tokenId, seq }. consulta = a ConsultaDaFicha que o palco publica (tokenId -> posição na tela).

Movimento: arrastar ficha no palco, soltar encaixa no centro da casa; arenaStore.moverFicha calcula blocos com passoEmBatalha (sem paredes) e chama loja.somarCaminho. Trilha desenhada fica fora da 1ª entrega (a conta de blocos vale).

### 4.5 Pontos de falha
| Falha | O que fazer |
|---|---|
| Sistema do livro não está no computador | a página da arena mostra o mesmo aviso do mundo (mu-vazio) e não monta |
| Retrato midia:ID não resolve sem aventura aberta (tela inicial) | ficha cai no disco com a cor do lado e a inicial; nada quebra |
| Ficha sem recurso de vida no sistema | entra, mas não cai; o placar usa só o que existir (Escudo opcional) |
| Reação automática do boneco não sai | o mestre ainda vê a caixa REAÇÃO do boneco e resolve à mão |
| Duas telas Pixi (editor atrás + arena) | medir; se travar, pausar o ticker do editor enquanto a arena está aberta |

## 5. Performance
- Sem volume: no máximo ~13 fichas (6 + 6 + boneco), grade até 16 x 10. Um Container, um tokensRenderer, um judgeDoMapa.
- A arena entra por React.lazy no MundoDoLivro: o pedaço novo não pesa no início do editor.
- Placar recalcula só quando turnosRev da cena da arena muda (seletor), O(linhas), teto 300.
- Duas aplicações Pixi quando o mundo abre por cima do editor = 2 contextos WebGL. Portão: nenhuma tarefa longa >= 200 ms ao atacar com 6 x 6 (medir só se o usuário pedir).

## 6. Divisão do trabalho (na main, sem worktree; 1 dono por arquivo)

ATENÇÃO: há uma build de release rodando agora. Ninguém começa a escrever antes de ela terminar e de o git status voltar à base.

### Fase 0 — 1 dono, sequencial (programador)
Arquivos (só ele): client/src/lib/batalha/mesa.ts (novo), client/src/stores/batalhaStore.ts, client/src/stores/mesaDaAventura.ts (novo), client/src/lib/arena/tipos.ts (novo: tipos, constantes, interfaces SessaoDaArena/AcoesDaArena e PalcoDaArenaProps), client/src/stores/mundoDoLivroStore.ts (só AbaDoMundo += "arena").
Pronto quando:
- rtk proxy npx tsc --noEmit (em client/) sem erro;
- npx vite build (em client/) passa;
- o diff de batalhaStore.ts só troca a fonte das fichas (nenhuma regra mexida); busca por useAdventureStore em batalhaStore.ts = 0 linhas;
- roteiro curto no editor: ligar batalha, atacar, reagir, Desfazer: igual a antes.
Commit: "refactor(batalha): store da batalha por fábrica com a mesa injetada".

### Fase 1 — até 3 escritores em paralelo, caminhos disjuntos
- Escritor A (programador) — lógica e sessão:
  client/src/lib/arena/copias.ts, boneco.ts, placar.ts, montagem.ts (grade; posições iniciais: Lado A nas 2 colunas da esquerda, Lado B nas 2 da direita, boneco no centro-direita, Judge árbitro ao norte da 1ª ficha por judgeInicial), reacaoDoBoneco.ts, estadoDaArena.ts; client/src/stores/arenaStore.ts (sessão, mesa da arena, instância batalhaDaArena = criarBatalhaStore(mesaDaArena), assinaturas da vez e da reação do boneco).
- Escritor B (programador-frontend) — o palco:
  client/src/components/arena/PalcoDaArena.tsx (+ client/src/pixi/palcoDaArena.ts se separar o Pixi). Só props (PalcoDaArenaProps da fase 0): tokens, grade, vezTokenId, vidas, selos, fotoDaForma, judge, judgeAlvo, gestoDoJudge, onMover, onTocarFicha, onConsulta. Pan com arrasto no vazio, zoom na roda, encaixe na casa, clique na ficha.
- Escritor C (programador-frontend, com as skills do Emil, emil-design-eng primeiro) — telas:
  client/src/components/arena/PaginaArena.tsx, TelaDaArena.tsx, PlacarDoBoneco.tsx, AjustesDoBoneco.tsx, arena.css; client/src/components/livros/MundoDoLivro.tsx (marcador + React.lazy); client/src/components/livros/icones.tsx (ícone); client/src/components/batalha/BatalhaDoJogador.tsx (só a prop opcional textoDaVez). Escreve contra as interfaces da fase 0.
Regra: cada um commita só os próprios caminhos (memória "tudo direto na main").

### Fase 2 — 1 dono (programador)
Ligar C em A e B, tsc, vite build, roteiro do usuário abaixo, HANDOFF.md, commit. Sem suíte (memória "Testes só quando pedir", 27/10).

## 7. Critério de pronto (sem suíte)
1. rtk proxy npx tsc --noEmit (client/) sem erro.
2. npx vite build (client/) passa; a arena sai em pedaço próprio (lazy).
3. Roteiro do usuário (app aberto, livro One Piece):
   a. Mundo do livro -> marcador "Arena de testes" aparece e abre a montagem.
   b. Bruno no Lado A, 2 Marinheiros no Lado B, Começar: ordem pela Agilidade, Judge ao norte.
   c. Na vez do Bruno: menu de tiras, Atacar um Marinheiro; a caixa REAÇÃO do Marinheiro abre para o mestre; rola d20; dano cai; o registro mostra a linha; Desfazer volta o HP.
   d. Forma e selo funcionam igual à mesa (ativar a forma do Bruno; pôr Atordoado num Marinheiro e ver contar na vez dele).
   e. Sair da arena, abrir a ficha real do Bruno: HP, SP, forma e histórico iguais a antes do teste.
   f. Modo "Contra o Judge-boneco": Bruno contra o Judge; 3 golpes; o placar mostra cada dano, total e média; Desfazer o último tira ele do placar; o Judge nunca cai com HP ∞.
   g. Ajustar o boneco: HP 500, Escudo 100, Mod. +5, Reage Parado e depois d20; o golpe gasta o Escudo primeiro e o modificador aparece no d20.
   h. Recomeçar: fichas cheias de novo, placar zerado.
   i. Com o mundo aberto por cima do editor e uma batalha real ligada na cena: a batalha real não ganha linha nem muda.

## 8. Fora da 1ª entrega
Jogadores vendo a arena (rede), salvar a arena em disco, paredes e terreno, regras do campo na arena, abertura com transição ("Royals"), editar a ficha da cópia (fora o boneco), trilha desenhada do caminho, exportar o placar, várias arenas ao mesmo tempo, qualquer mudança no Rust.

## 9. Riscos
| Risco | Como detectar cedo |
|---|---|
| Refator da batalhaStore (arquivo quente, sem teste próprio) muda a batalha real | fase 0 sozinha, diff só de fonte, roteiro curto e o passo 3i antes de abrir a fase 1 |
| Menu do jogador com ficha de NPC (ficha mínima, sem armas) mostra vazio ou quebra | passos b/c do roteiro com NPC de ficha mínima; Escritor C confere golpesDeAtaque com NPC |
| vistaParaJogador com "tudo é meu" mostra todas as reações juntas (golpe em área) | aceitável no laboratório; a caixa já lista várias; conferir golpe em área no roteiro |
| Linha do registro com autor "Mestre" | aceitável (é o mestre agindo); o texto já traz o nome da ficha |
| Retrato midia: sem aventura | abrir pela tela inicial no roteiro; cai na cor do lado |
| Duas telas Pixi pesam | medir tarefa longa ao abrir por cima do editor; se passar de 200 ms, pausar o editor |
| Escritor C antes do A | C escreve contra a interface da fase 0; a fase 2 liga |

## 10. Decisões que faltam ao usuário (com recomendação)
1. Reação do boneco no "d20": automática (rola com o modificador dele e escolhe sozinho a melhor defesa: esquiva > metade > cheio, nunca contra-ataque) ou o mestre escolhe a saída na caixa? Recomendo AUTOMÁTICA (a caixa continua lá se travar).
2. "Média por rodada": total dividido pela rodada atual, ou só pelas rodadas em que o boneco levou dano? Recomendo PELA RODADA ATUAL (conta as rodadas em que errou).
3. Onde a arena desenha: camada cheia por cima do mundo do livro, ou dentro da página ao lado dos marcadores? Recomendo CAMADA CHEIA (palco, faixa e menu precisam de espaço).
4. No modo "lados", o Judge fica de árbitro (ao norte, virando para a vez)? Recomendo SIM.
5. O mesmo NPC várias vezes no mesmo lado (3 Marinheiros)? Recomendo SIM, até 6 por lado.
6. Recomeçar pede confirmação? Recomendo NÃO (é teste).
