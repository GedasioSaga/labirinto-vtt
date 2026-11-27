# Mapa do código: rework do editor de habilidades (26/11/2026)

Leitura do código (arquiteto, só leitura) para o rework aprovado em 26/11 23:23 (PEDIDOS.md, entradas de 22:40 em diante; lacunas em `docs/explorador/editor-x-leitura.md`; telas e decisões em `prototipo.html`, commit 6cc7a401). Só One Piece: o Dragon Ball (`lib/dbt/*`, `components/dbt/*`) fica fora, como no rework de itens. Caminhos relativos a `client/src/` quando não dizem outra coisa. O plano de construção está em `PLANO.md`.

## 1. O modelo de dados de hoje

### 1.1 Tudo é um cartão

Habilidade, técnica, forma, passiva e a definição do acumulador são `CartaoDaFicha` (`lib/personagem.ts:58`). O que importa ao rework:

| Campo | O que guarda | Quem lê | Onde |
|---|---|---|---|
| `campos` (texto) | Descrição, Ação, Tipo, Efeito, Custo, Tempo, Dano; na forma também Duração, Requisito, Grupo, Dano recebido, Deslocamento, Ataques extras, Usos | a batalha, por leitura de texto | molde em `lib/sistemaOnePiece.ts:78` (habilidades) e `:124` (transformações) |
| `extras` | campos extras, Evolução, Opção 2, o "Texto de antes" que o Montar guarda | `escolhaEEvolucao.ts`, `invocacao.ts`, `marca.ts` | `personagem.ts:35`, `:45` |
| `mecanica` | as peças, versões 1 a 4, opacas | `lerMecanica` (`lib/batalha/mecanica/modelo.ts:1289`) | `personagem.ts:90` |
| `mecanicaProposta` | a mecânica que o dono montou e espera o mestre | o mestre aceita ou recusa | `personagem.ts:97`; `EditorDaHabilidade.tsx:268` |
| `requisitos` | bloco v1: `usar`, `evoluir`, `aoUsar.sobeParte`, `forma.{partesEmOrdem, soLigaPor}` | `requisitos/ler.ts`, `avaliar.ts` | `lib/batalha/requisitos/modelo.ts:209` |
| `marcas`, `alcance` | marcas ("Fogo"); alcance do cartão de texto | requisito G2; `alcanceDoCartao.ts` | `personagem.ts:106`, `:121` |
| `acumulador` | a definição (nome, máximo, sobe, desce, ganho) | `acumuladorNaBatalha.ts:38`, requisito A4 | `personagem.ts:130`; tipo em `requisitos/modelo.ts:363` |
| `imagem`, `modificadores`, `subcartoes` | imagem; +N nos atributos da forma ligada; técnicas da forma | `ajusteDaFicha.ts:95` (`cartoesQueLigam`), `leituraDaFicha.ts:199` (`tecnicasComForma`) | `personagem.ts:71-74` |
| `oculta`, `revelaAoUsar`, `aMao` | habilidade oculta; golpe à mão | `habilidadeOculta.ts` | `personagem.ts:81`, `:137` |

Na ficha (`Personagem`, `personagem.ts:225`): `abas[abaId]` guarda os cartões; `cartoesAtivos` (`:256`) as formas ligadas (os modificadores entram nos totais); `escolhas.raca` dá a chave da raça; `condicoes` (`:335`) as condições na ficha do rework de itens.

### 1.2 Onde mora cada coisa

- **Habilidade / técnica**: aba `habilidades` (`ABA_DAS_TECNICAS`, `leituraDaFicha.ts:28`). Ou só texto (a batalha lê Ação, Custo, Tempo, Dano), ou montada (`mecanica` v1 a v4; tudo ou nada: com peças o texto vira descrição, `modelo.ts:13`). O Tipo (Ativa, Passiva, Reação, Buff, Debuff, Evolução, Escolha, Invocação) é o campo `tipo` (`tiposDaHabilidade.ts:31`), deduzido da Ação quando vazio (`:75`).
- **Forma (transformação)**: aba `transformacoes`, cartão de texto com modificadores, imagem e subcartões "Técnicas da forma" (`sistemaOnePiece.ts:124-150`). Nunca tem `mecanica` hoje. Ligada = id em `cartoesAtivos`; na batalha, `TurnosDaCena.formas` guarda imagem e duração (`lib/batalha/combate.ts:861`).
- **Passiva**: não tem aba. É o Tipo "Passiva" (ou Ação "Passiva...") num cartão de Habilidades e, por decisão de 23/11, é o cartão SEM peças (`mecanica/categoria.ts:8`, `mecanica/textoGerado.ts:198`, `editor/linhas/LinhaDaAcao.tsx:28`). Gatilho, selo e efeito por turno saem do texto (`lib/batalha/passivas.ts:147`, `:266`, `:303`). Nunca ativa sozinha: lembrete "Ativar / Agora não" (`passivas.ts:31`).
- **Acumulador**: `cartao.acumulador` num cartão dono; o "+ Acumulador" da ficha cria um cartão só para ele (`components/batalha/acumulador/acumuladoresDaFicha.ts:49`, `:236`). O contador de antes (Polaridade) sai dos extras (`lib/batalha/contador.ts`) e vira acumulador em memória. O nível mora na batalha (`CombateDoPersonagem.acumuladores`, `combate.ts:138`).
- **Regras escritas à mão**: `MECANICAS_A_MAO` por `cartaoId` real (`lib/batalha/mecanicasAMao.ts:500`), chaves `raca:<nome>` e `ficha:<id>` (`:490`), cópia do "Trazer" com `.copia-` (`:848`). Cartão montado vence a tabela (`:883`).
- **Catálogo do livro**: `ItemDoCatalogo` (`lib/livros/catalogo.ts:52`) guarda `campos`, `mecanica`, `requisitos`, `marcas`, `alcance`. NÃO guarda `acumulador`, `imagem`, `modificadores` nem subcartões; o tipo `habilidade` sempre vai para a aba `habilidades` (`catalogo.ts:44`, `abaDeDestino` `:290`, cartão novo `:362`).
- **Condições**: dois sistemas. O selo da batalha (`SeloDaBatalha`, `combate.ts:877`, com `mods`, `porVez`, `regra`, `marca`) é o que as técnicas põem. A condição na ficha (`CondicaoNaFicha`, `lib/itens/modelo.ts:199`) é a do "Ao acertar" do item, com o gatilho "depois de X turnos" da 0.6.4 (`itens/modelo.ts:188`, motor em `lib/condicoes/gatilho.ts:79`); a ponte acende a pastilha (`lib/ponteDasCondicoes.ts`). O selo da técnica já aceita `gatilho`, mas o motor das técnicas não o lê (`modelo.ts:283`).

### 1.3 Onde é salvo

| Lugar | O quê | Leitor |
|---|---|---|
| `<appData>/pastas/<id>/rpg.json` (ou o próprio mapa) | `Adventure.personagens` | `cartaoDoArquivo` (`personagem.ts:599`) |
| `<appData>/livros/<sistema>/catalogo.json` | o catálogo | `lib/livros/catalogoNoDisco.ts:20`; cópia `.antes-itens-v2` em `:94` |
| Worker (Durable Object, SQLite) | as fichas publicadas e as edições do site | `lobby/nuvem/src/banco.ts:37`; entra por `personagemDoArquivo` (`lobby/nuvem/src/publicar.ts:224`) |
| Fio LAN | a ficha do jogador e a edição dele | `net/protocoloDoPersonagem.ts`, com o mesmo `mecanicaDoArquivo` |
| Batalha | selos, combate por personagem, formas | `TurnosDaCena` (`lib/batalha/turnos.ts:89`) dentro do `BatalhaDaCena` |

O leitor do cartão só guarda chaves que conhece (`personagem.ts:599-621`): campo novo fora de `mecanica`, `requisitos` ou `acumulador` some no app velho, no fio LAN e no Worker. A `mecanica` é opaca até 16.000 caracteres (`MECANICA_GUARDADA_MAX`, `personagem.ts:643`); acima disso o leitor a descarta em silêncio.

### 1.4 Quem lê

| Leitor | Como chega no cartão | Onde |
|---|---|---|
| Batalha do mestre (app) | menu, mira, golpe, vez, passivas, formas | `stores/batalhaFabrica.ts` + `stores/batalha/*.ts` + `lib/batalha/*.ts` |
| Worker do Lobby (Arena e duelo) | o Worker IMPORTA o motor: `lobby/nuvem/src/duelo.ts:1-31` e `luta.ts:1-44` puxam `lib/treino/duelo.ts`, que puxa `batalhaFabrica`, `mecanicasAMao`, `passivas`, `transformacao`, `marca`, `golpe` (`lib/treino/duelo.ts:1-51`); motor versionado em `lib/treino/luta.ts:71` | mesmo código do app |
| Site do Lobby (Pages) | `FichaAbas` + o editor, mestre ou dono | `lobby-site/telas/TelaFicha.tsx:383` |
| Jogador LAN (navegador servido pelo app do mestre) | ficha e editor do dono (`mecanicaProposta`); menu da batalha calculado no navegador | `player/PlayerFicha.tsx:509`, `player/main.tsx:2761` |
| Robô da Arena | golpes e passivas dos NPCs | `lib/treino/robo.ts:577`, `:706` |
| Testar no boneco | a mesma store numa mesa em memória | `lib/batalha/ensaio/ensaio.ts`, `components/ensaio/PainelDeEnsaio.tsx` |

## 2. Os arquivos que montam, leem e executam

### 2.1 Montar (tela)

- Editor: `components/batalha/editor/EditorDaHabilidade.tsx` (modos técnica, arma e item `:75`; props `:106`; rascunho `:153`; texto gerado `:197-206`; Montar do texto `:248`; Desmontar `:260`; proposta `:268`). Linhas em `editor/linhas/*` (Ação, Golpe, Alcance, Dano, Acerto, Efeitos, Custo, Gasto, Requisitos, Evolução, Campos); blocos em `components/batalha/blocos/*` (`BlocoDosEfeitos`, `PecasDoSelo`, `BlocoDosRequisitos` com 518 linhas); coluna `editor/ColunaDoPapel.tsx`, `PapelDoCartao.tsx`; modelos `ComecarDeUmModelo.tsx`, `modelosDoEditor.ts`; gravar `gravarNoCartao.ts`.
- Porta do editor: `editor/HabilidadeNaFicha.tsx` ("Só texto" `:106`, "Montar no editor" `:122`, "Abrir sem montar" `:129`).
- Ficha: `components/FichaAbas.tsx` (faixa Acumuladores `:247`, "Trazer de outra ficha" `:582` e `:699`, cartão novo `:635`, cartão em edição com "Editar como texto" `:797-960`, editor `:950`, arma `:987`, peça do mestre na forma `:991`). A mesma ficha serve o app, o site e o jogador.
- Livros > Habilidades: `components/livros/PaginaItens.tsx:715` e `EntradaDoCatalogoDialog.tsx` (só habilidade desde 01e21fbc; editor em `:572`).
- Acumuladores: `components/batalha/acumulador/AcumuladoresNaFicha.tsx:19`, `EditorDoAcumulador.tsx:142` (725 linhas), `acumuladoresDaFicha.ts:121`.
- Ligações de forma antigas: `components/livros/DarRequisitosAosAntigos.tsx:250` (único lugar que monta "Partes em ordem").
- Item e arma (NÃO mexer): `components/EfeitoDaArmaCampos.tsx:98` usa o mesmo editor com `doQue="arma"`.

### 2.2 Ler e traduzir (puro)

- `lib/batalha/mecanica/modelo.ts`: tipos (`MecanicaV2` `:302`, `Efeito` `:273`, golpe `:383`), versões (`:35`; `precisaDaVersao4/2/3` `:424`, `:445`, `:469`), peças ainda recusadas (`:538`, inclui "renovar o selo"), leitor `:1289`.
- `mecanica/leitura.ts`: as peças viram a MESMA linha da tabela à mão (`linhaDasPecas` `:325`, `linhaDoCartaoMontado` `:402`). É o ponto único de tradução: o motor só conhece `MecanicaAMao` (`mecanicasAMao.ts:293`).
- `mecanica/golpe.ts` (tipo do golpe em peças, `:155`), `categoria.ts`, `textoGerado.ts` (campos gerados `:133`, Texto de antes `:295`), `resumo.ts`, `modelos.ts`, `doTexto.ts` (texto para modelo).
- Texto: `leituraDaFicha.ts` (Ação, Custo, Tempo; Overload `:151`), `leituraDaTecnica.ts`, `tiposDaHabilidade.ts`, `escolhaEEvolucao.ts`, `invocacao.ts:226`, `marca.ts:94`, `contador.ts`, `requisitos/antigos.ts`, `alcance/antigos.ts`.

### 2.3 Executar (motor)

- Golpe: `lib/batalha/golpe.ts` (1718 linhas; Overload pela forma `:1113`, "de todo golpe" `:1132`, soma da raça `:1136`, selos `:1210-1216`), `stores/batalha/golpe.ts` (1492; marca `:159`, raça tira a esquiva `:1300`), `stores/batalha/selos.ts`, `lib/batalha/selos.ts` (criar `:167`, renovar `:189`, contar `:204`, somar `:268`), `condicoes.ts`, `reducaoDoDano.ts:59-61`, `reacaoComTecnica.ts`, `perguntaNaHora.ts`.
- Vez, passiva, forma: `lib/batalha/passivas.ts` (disparo `:618`, lembretes `:651`, `:667`), `stores/batalha/passivas.ts`, `stores/batalha/nucleo.ts` (cair a 0 `:84`, depois do dano `:123`, acumuladores `:153`, `:227`), `stores/batalha/vez.ts` (forma que desliga `:240`, lembretes `:562`), `lib/batalha/transformacao.ts` (campos `:31-42`, efeitos `:98`, ativar `:347`), `stores/batalha/formas.ts` (desligar `:81`, cansaço do Overload `:156`, duração `:247`, velocidade `:268`), `acoes.ts` (ataque adicional `:94`), `custoPorTurno.ts`, `recursosDaBatalha.ts:26` (cansaço), `acumuladorNaBatalha.ts:134`, `requisitos/partes.ts`, `requisitos/avaliar.ts:255` (Numa forma).
- Regras à mão: as funções de `mecanicasAMao.ts` aceitam o id OU o cartão (`ChaveDaMecanica`, `:837`). As que recebem só ids (`chavesDoDono` `:1254`, `racaDoDono` `:1261`, `emTodoGolpeDo` `:1046`, `golpesSaoOverload` `:1475`, `vezesDaForma` `:1470`, `fatorDaVelocidade` `:1465`, `perdaNoFimDaVez` `:1480`) só enxergam a tabela: uma peça montada de raça, imbuir ou forma Overload não entraria por elas.

### 2.4 Converter (o molde do rework de itens)

`stores/conversaoDosItens.ts` (cópia `.antes-itens-v2` uma vez `:23`, passo `:54`, chamado em `App.tsx:268`) + `lib/itens/conversao/{ficha,catalogo,acervo,comum}.ts` (puro, idempotente pela marca e pelo estado). O Montar de hoje já guarda o texto no extra "Texto de antes" (`textoGerado.ts:295`), que nenhuma vista mostra.

## 3. As 8 mecânicas: o que o motor já faz e o que é novo

| # | Mecânica | Já existe (reaproveitar) | Motor novo |
|---|---|---|---|
| 1 | Pergunta que muda o golpe | `perguntas` + `respostasMudam` (dano, selo, perfurante, soma) e `respostasPadrao` para NPC (`mecanicasAMao.ts:296`, `:318`, `:902`, `:920`); a resposta já viaja (`respostas`, `net/protocoloDaBatalha.ts:568`, `:603`) | resposta que troca o tipo do golpe (impacto, cortante, perfurante: selo e perfuração da tabela de `mecanica/golpe.ts`); perfuração em % por resposta; até 3 perguntas por técnica |
| 2 | Imbuir com vários tipos | `emTodoGolpe` (pergunta em todo golpe do dono: +dano, −SP, desvantagem; Electro e Ogro, `:273`, `:1086`); `respostaVetada` (Ignição apaga o fogo, `:1158`); técnica mantida (`combate.ts:127`) | vários elementos numa pergunta, cada um com dano, condição, turnos, SP e desvantagem; vale só com a técnica ligada; "Não" grátis |
| 3 | Passiva que dispara sozinha | gatilhos início, rodada, vida abaixo de N% (`passivas.ts:57`); momento depois do dano (`nucleo.ts:123`); efeito por turno (`passivas.ts:303`); aviso ao cair (`nucleo.ts:84`); "uma vez" por `lembradas` | aplicar sem lembrete (com Desfazer) quando "Pergunta antes de disparar" está desligado; gatilhos começo da vez, ao receber dano, ao acertar, ao cair (ficar com N de vida); ler o gatilho da peça antes do texto |
| 4 | Passiva de raça | linha `raca` (−30% recebido, +20 corpo a corpo, só Defender: `mecanicasAMao.ts:505`, `:1270-1300`), redução somada em `reducaoDoDano.ts:61` | ler a raça de um cartão montado (hoje só `raca:<nome>` da tabela); "+N em golpe físico" além do corpo a corpo; conferir que o corte vem antes do Escudo (decisão 13) |
| 5 | Overload do tipo transformação | Overload 1 por batalha (`modelo.ts:91`); golpes que não se desviam e duração em vezes do dono (A Caçada, `mecanicasAMao.ts:716`); duração e ataques extras dos campos da forma (`transformacao.ts:41`, `:148`); +status pelos `modificadores`; técnica só na forma (requisito B3, `avaliar.ts:255`, e subcartões); marca ×2 (`marca.ts:47`) | ações a mais de qualquer tipo (hoje só o ataque adicional do Atacar, `acoes.ts:94`); marca automática a cada acerto com a forma ligada, valendo só para o golpe do dono; Fadiga como condição comum no fim (decisão 11), sem somar o cansaço antigo (`formas.ts:156`) |
| 6 | Soma ou muda status | selo com `mods` em quem usa ou no aliado, número ou fórmula (`modelo.ts:260`, `:284`) | nada no motor: é peça de tela que grava o selo de hoje |
| 7 | Formas e técnicas ligadas | `forma.soLigaPor` e `partesEmOrdem` (`requisitos/modelo.ts:214`, `requisitos/partes.ts`, `transformacao.ts:11`); `aoUsar.sobeParte`; Numa forma (B3); acumulador com requisito A4 e "+N" | descida nova "zera quando a técnica desliga" (`requisitos/modelo.ts:344` e `acumuladorNaBatalha.ts`); o resto é tela (as ligações só têm tela em `DarRequisitosAosAntigos.tsx`) |
| 8 | Diminui atributo do alvo | selo com `mods` negativos e turnos; `porTurno` (`modelo.ts:229`); gatilho "depois de X turnos" (só na condição da ficha, `condicoes/gatilho.ts`); "renovar o selo" previsto e ainda recusado (`modelo.ts:538`) | queda que cresce a cada vez de quem tem (dentro de `contarSelos`, `selos.ts:204`); começar no turno N; % do atributo (fixado no acerto); teto; golpe novo só recomeça o tempo (decisão 12) |

Também viram peça, com motor que já existe: Marca (`marca.ts`: ler a peça antes do texto), Invocação (`invocacao.ts:226`: idem), Devolve o golpe (`ReacaoDaMecanica.devolve`, `modelo.ts:527`; o "+ Força" é o `rebate.soma` da tabela, `mecanicasAMao.ts:240`, hoje recusado nas peças).

## 4. Riscos

1. **O Worker sai junto, sim.** Ele não guarda regra própria, mas embute o motor (§1.4): sem novo deploy, a Arena e o duelo leem a versão nova como "atualize o app" e a técnica fica à mão (não quebra, perde a automação). O `--publicar` normal de `scripts/publicar-versao.cjs` já envia Worker, depois Pages, depois o release (`:190-198`); o Worker vai antes e aceita o formato anterior. Nenhum arquivo de `lobby/nuvem/src` precisa mudar. `VERSAO_DO_MOTOR_DA_LUTA` (`lib/treino/luta.ts:71`) só sobe se o estado da luta mudar de um jeito que a luta antiga não leia; campos novos opcionais não pedem.
2. **`net/protocol.ts`: o rework não precisa tocar.** Ele só despacha mensagens (a outra sessão mexe em `:3953-3960`). As peças viajam dentro de `cartao.mecanica` (opaca no fio, `protocoloDoPersonagem.ts`); as respostas da pergunta e do imbuir vão no `respostas` que já existe; estado novo da batalha fica "só do host", como `porVez` e `regra` (`combate.ts:930-934`). Regra das faixas: nenhum tipo de mensagem novo, nem `protocol.ts` nem `protocoloDaBatalha.ts`. Se algo precisar aparecer no navegador do jogador, vira etapa própria no fim, depois da outra sessão, marcada.
3. **Busca por id não vê peça montada.** As funções de §2.3 que recebem só ids (raça, imbuir, forma Overload, velocidade) leem só a tabela. Passar o cartão (`ChaveDaMecanica`) muda as 9 chamadas de `chavesDoDono` em 7 arquivos (`BatalhaDoMestre.tsx`, `dadosDoMenu.ts`, `lib/batalha/golpe.ts`, `mecanicasAMao.ts`, `lib/treino/duelo.ts`, `stores/batalha/golpe.ts`, `stores/batalha/vez.ts`) e as que leem `cartoesAtivos`. Efeito colateral: o cartão da tabela que for montado perde a regra "de todo golpe" da tabela. Por isso a conversão NUNCA monta cartão com linha na tabela (`temLinhaNaTabela`, `mecanicasAMao.ts:864`, que cobre a cópia).
4. **Teto de 16.000 caracteres** (`personagem.ts:643`): o mesmo leitor no disco, no fio e no Worker descarta a mecânica acima disso, sem aviso. As peças guardam só o que difere do padrão; o editor recusa salvar acima de 12.000.
5. **Itens usam as mesmas peças e o mesmo editor** (`EfeitoDaArmaCampos.tsx:98`, `mecanica/modelosDeItem.ts`): a versão 5 é superconjunto da 4; os ramos arma e item do editor não mudam.
6. **Passiva deixa de ser "o cartão sem peças"**: `lerTipo` (`tiposDaHabilidade.ts:77`), `TIPOS_FORA_DAS_PECAS` (`textoGerado.ts:198`), `categoria.ts`, `LinhaDaAcao.tsx:28` e `ehPassiva` (`passivas.ts:397`) assumem o contrário.
7. **A forma de hoje é texto, e o app velho continua lendo texto**: a forma nova grava também os campos de antes (Duração, Usos, Ataques extras, Dano recebido, Deslocamento, Grupo, Ação, Custo) e os `modificadores`, gerados das peças, para o app velho, o site e o Worker. App velho noutro PC lê a técnica v5 como "atualize o app" sem perder nada; mexer à mão nele no texto gerado da forma se perde na próxima gravação do app novo (o mesmo aviso dos itens: atualizar todos os PCs).
8. **Dois sistemas de condição**: a técnica põe selo da batalha; só o item põe condição na ficha. "Diminui atributo" e "Fadiga" ficam no selo, que vale também na Arena e no treino, onde a condição na ficha não roda (`stores/batalha/condicoesNaFicha.ts:12`).
9. **Respostas por pedido**: `RESPOSTAS_MAX = 8` (`perguntaNaHora.ts:16`) soma as da técnica (até 3), o imbuir, o Ogro e os `req.*` dos requisitos. Subir o teto muda a validação do host e do Worker (sai no mesmo deploy).
10. **Main sem worktree**: cada faixa commita só os próprios caminhos (`git commit -- <caminhos>`); o `tsc` de uma faixa vê o trabalho em curso das outras (ignorar erro fora dos próprios arquivos; um `tsc` só no fim da onda); conferir o estado do repositório antes de cada onda para não pegar arquivo que a outra sessão esteja mexendo (hoje: `net/protocol.ts` e `stores/batalha/ordem.ts`).

## 5. Faixas de construção (arquivos disjuntos)

Ordem por dependência; no máximo 3 escritores por onda na main; nenhum arquivo aparece em duas faixas da mesma onda; arquivo novo nasce na pasta da faixa dona. Detalhe, critérios e modelo por etapa em `PLANO.md`.

| Onda | Faixa | Arquivos (só ela escreve) | Depende de |
|---|---|---|---|
| 0 | **N** núcleo de dados v5 | `lib/batalha/mecanica/{modelo,leitura,golpe,categoria,textoGerado,resumo}.ts`, `lib/batalha/mecanica/pecas.ts` (novo), `lib/batalha/combate.ts` e `turnos.ts` (só tipos), `lib/batalha/tiposDaHabilidade.ts`, `lib/batalha/mecanicasAMao.ts` (só campos novos de `MecanicaAMao` e a troca id para cartão), os chamadores dessa troca (`components/batalha/BatalhaDoMestre.tsx`, `dadosDoMenu.ts`, `lib/batalha/golpe.ts`, `lib/treino/duelo.ts`, `stores/batalha/{golpe,vez,formas}.ts`), `components/batalha/editor/pecas/registro.ts` (novo, contrato vazio) | nada |
| 1 | **C** conversão e cópia | `lib/batalha/mecanica/conversao/*.ts` (novo), `stores/conversaoDasHabilidades.ts` (novo), `App.tsx` (uma linha), `lib/livros/catalogoNoDisco.ts` (cópia do catálogo) | N |
| 1 | **G** motor do golpe (1, 2, 4, 8, marca, devolve) | `lib/batalha/{golpe,mecanicasAMao,reducaoDoDano,marca,selos,condicoes,perguntaNaHora,reacaoComTecnica}.ts`, `stores/batalha/{golpe,selos}.ts`, `lib/treino/robo.ts` | N |
| 1 | **P** peças no editor | `components/batalha/editor/pecas/*` (novo; preenche o registro), `components/batalha/blocos/{BlocoDosRequisitos.tsx,requisitosNaTela.ts}`, `editor/linhas/LinhaDosRequisitos.tsx` | N |
| 2 | **V** motor da vez, passiva e forma (3, 5, 7) | `lib/batalha/{passivas,transformacao,acoes,acumuladorNaBatalha,custoPorTurno,recursosDaBatalha,invocacao}.ts`, `lib/batalha/requisitos/{ler,modelo}.ts`, `lib/condicoes/catalogo.ts` (Fadiga), `stores/batalha/{passivas,formas,vez,nucleo}.ts`, `components/batalha/{PassivasDaBatalha,ListaDeFormas}.tsx` | N, G |
| 2 | **E** editor único | `components/batalha/editor/{EditorDaHabilidade,HabilidadeNaFicha,ColunaDoPapel,PapelDoCartao,ComecarDeUmModelo}.tsx`, `editor/{gravarNoCartao,modelosDoEditor}.ts`, `editor/linhas/{LinhaDaAcao,LinhaDosCampos}.tsx`, `editor/editor.css`, `lib/batalha/mecanica/modelos.ts`, `lib/batalha/ensaio/ensaio.ts`, `components/ensaio/PainelDeEnsaio.tsx` | N, C, P |
| 2 | **F** ficha e Livros | `components/FichaAbas.tsx`, `components/habilidades/*` (novo: a lista), `components/batalha/acumulador/AcumuladoresNaFicha.tsx`, `components/livros/{PaginaItens,EntradaDoCatalogoDialog}.tsx`, `lib/livros/catalogo.ts` (o "Pôr em" leva a forma para a aba Transformações) | N, C |
| 3 | **T** testes e prints | só `*.test.ts(x)` novos e `docs/design/habilidades-rework/provas/` | todas |

Por que V fica na onda 2: os stores da vez e da forma (`stores/batalha/{vez,formas,nucleo,passivas}.ts`) e o do golpe chamam uns aos outros; com G e V na mesma onda, o `tsc` e o comportamento de um dependem do trabalho pela metade do outro (sistema acoplado = um dono por vez). Se a máquina aguentar um 4º escritor, V pode entrar na onda 1, desde que G não toque esses quatro stores.
