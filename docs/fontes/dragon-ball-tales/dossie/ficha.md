# Dossiê: ficha de personagem (One Piece hoje) e a costura para Dragon Ball Tales

Raiz: C:/dev/labirinto/client/src (referências relativas a ela). Leitura de 02/11/2026, commit ed1a13ae.
Vocabulário do código: "personagem" = ficha de personagem; "ficha" sozinho = TOKEN no mapa (ou o cartão recolhível do grimório). lib/travessiaDaFicha.ts é sobre TOKEN passando de cena, não sobre a ficha de personagem; components/grimorio/Ficha.tsx é um cartão recolhível genérico (acordeão), não a ficha de personagem.

## 1. Modelo de dados

### Personagem (lib/personagem.ts)
- TipoDePersonagem = 'jogador' | 'npc' personagem.ts:20. Jogador x NPC é só este campo (+ combate no NPC).
- interface Personagem personagem.ts:105-171:
  - id pers_<uuid> (novoIdDePersonagem :281), tipo, nome, descricao, retrato (midia:<id> ou data:image legado) :117
  - escolhas: Record<string,string> (Raça, Ofício, pela chave da EscolhaDoSistema) :119
  - etiquetas: string[] :120
  - recursos: Record<string,number> = ATUAL (HP 450) :122; maximos = máximo base :128; modificadoresDosRecursos :130
  - atributos: Record<string,number> = base :132; modificadoresDosAtributos :134
  - cartoesAtivos: string[] = ids de cartões ligados (transformações) :136
  - historico: RegistroDaFicha[] (máx 100) :138; registro :81-96
  - abas: Record<abaId, CartaoDaFicha[]> :140
  - só do mestre (removidos por paraOFio :272): dono (conta) :148, combate: MarcaDeCombate (forca 0.5..2, modeloId, criadoNaBatalha, invocadoPor/NaCena) :160 e :174-193, soCenario :162, nomeDoJogador :168, notaDoMestre :170.
- CartaoDaFicha :39-63: id, nome, campos: Record<campoId,string>, extras {nome,valor}[], atributos string[] (perícia), imagem, modificadores {atributo,delta}[], subcartoes CartaoDaFicha[], aMao?.
- Valores guardados POR CHAVE do sistema; o personagem NÃO guarda id de sistema. Trocar o sistema não apaga nada (comentário :11-13).
- Criação: novoPersonagem(sistema, tipo, nome) :298 (zera todo recurso/atributo, cria aba vazia por aba do sistema).
- Leitura tolerante do disco e da rede: personagemDoArquivo :464 (campo desconhecido é DESCARTADO; tipo desconhecido vira npc :468), personagensDoArquivo :520, sistemaDaAventuraDoArquivo :534.
- Força do NPC: RECURSO_QUE_A_FORCA_MULTIPLICA = 'hp' :224, forcaDe :232, aplicarForca :238.

### Sistema (lib/sistemaDeRpg.ts)
- SistemaDeRpg :157-173: formato, id, nome, versao, descricao, cor, escolhas, recursos (tom vida|energia|neutro, atualEMaximo) :44-55, atributos (abreviacao, rank {inicial, limiares}) :31-39, abas: AbaDoSistema[] :91-109 (campos com forma paragrafo|linha|destaque + flags extras/atributos/imagem/modificadores/subcartoes), livro? (capítulos), catalogos? com chaves FIXAS pericias/vantagens/desvantagens/racas/oficios :149-155.
- lerSistemaDeRpg :445 é o único leitor (disco E rede): campo novo no sistema é descartado se não for acrescentado aqui.
- One Piece embutido: lib/sistemaOnePiece.ts, ID_ONE_PIECE='one-piece' :30, SISTEMA_ONE_PIECE :32-196, SISTEMAS_EMBUTIDOS :199 (sempre na grade, nunca gravado nem apagado).

### Ligação sistema <-> personagens <-> token
- Um sistema por AVENTURA (ou por PASTA de mapas): Adventure.sistemaDeRpg?: string (só o id) lib/adventure.ts:83; Adventure.personagens? :90; leitura :269-286.
- Pasta de mapas com "sistema universal": lib/pastasDeMapas.ts:56-85 (RpgDaPasta), leitura :241-247, gravação gravarRpgDaPasta :390.
- Quem manda: sistemaAtivo stores/adventureStore.ts:938, personagensAtivos :949, temRpgNoMapa :959, pastaQueManda (~:922). Objeto do sistema: sistemaPorId(biblioteca, id) stores/rpgStore.ts:121.
- Ações da store: setSistemaDeRpg adventureStore.ts:1670, salvarPersonagem :1685, ajustarPersonagem :1694, adicionarPersonagens :1704, apagarPersonagem :1724.
- Token para personagem: Token.characterId (string ou null) types/map.ts:1426. Ligar: FichaDePersonagemDialog (select "Ligar a um token") chama RpgDialogs.tsx:111 updateToken(tokenId, {characterId}); também TokenPersonagemControls (components/TokenPersonagemControls.tsx:23) montado por App.tsx:3910-3917 via livro/FichaDoToken.tsx:161-169. O jogador recebe characterId null (lib/fogFilter.ts:1671-1676).
- Barra de vida do token vem da ficha: lib/vidaDaFicha.ts:55 recursoDeVida = recurso tom 'vida' + atualEMaximo (genérico, não usa o id 'hp').

### Persistência em disco
- <appData>/maps/<chave>/adventure.json (ADVENTURE_FILE lib/adventure.ts:20; maps em lib/mapFileIO.ts:212): sistemaDeRpg + personagens.
- <appData>/pastas/<id>/rpg.json (+ midia/): lib/pastasDeMapas.ts:23-24; sistema universal + personagens + equipes.
- <appData>/sistemas/<id>.json: biblioteca de sistemas importados/editados (lib/bibliotecaDeSistemas.ts:18,33). Embutidos não vão ao disco.
- <appData>/livros/<sistemaId>/catalogo.json: catálogo de armas/habilidades/itens do mundo do livro (lib/livros/catalogoNoDisco.ts:10,19). Já é POR SISTEMA.
- <appData>/midia/<sha256>.<ext>: retratos e imagens de cartão por referência midia:<id> (lib/midia.ts, cabeçalho); migração da embutida: stores/midiaDosPersonagens.ts, lib/imagensDaFicha.ts:16,33.

### Rede (net/protocoloDoPersonagem.ts)
- Jogador para host: personagem.criar (tokenId) :94, personagem.editar (PartesDoPersonagem, só o que mudou, sem imagem) :81/:101, personagem.imagem :108, personagem.ajustar (Ajuste[]) :123.
- Host para jogador: personagens (só os dele + tokens) :143, rpg.sistema (sistema sem o livro + resumo) :155, personagem.resultado :167.
- Parsers: parsePartesDoPersonagem :293, parsePersonagensMessage :389 (passa por personagemDoArquivo), parseSistemaDeRpgMessage :413 (passa por lerSistemaDeRpg).
- Host: personagensDoJogador net/hostSession.ts:7623, personagensUpdate :7686 (envia paraOFio), mensagemDoSistema :7712, syncPersonagens :7719, handlePersonagemCriar (~:7810, novoPersonagem em :7826), handlePersonagemEditar (~:7850, aplicarPartes), handlePersonagemAjustar (~:7865, aplicarAjustes com o sistema), roteamento :9727-9733. RpgDoMundo {sistema, personagens, equipes} :288; montado por hostWorldOf adventureStore.ts:903-913.
- Integrador: hostBridge.ts:3641, depois net/playerChanges.ts:185 applyPersonagem, depois adventureStore.salvarPersonagem.
- Diferença e edição: net/edicaoDoPersonagem.ts partesMudadas :50, imagensMudadas :81, mensagensDoSalvar :115, aplicarPartes :150, aplicarImagem :167.
- Jogador: player/playerConnection.ts salvarPersonagem :5988, criar :5982, ajustar :2691, recepção rpg.sistema :4432 / personagens :4449 / personagem.resultado :4454.

## 2. UI da ficha

Árvore (mestre, no editor de mapa):

    App.tsx:4441 <RpgDialogs>  (components/RpgDialogs.tsx:41)
      sistema = sistemaPorId(biblioteca, sistemaAtivo)          RpgDialogs.tsx:94
      <FichaDePersonagemDialog>                                  RpgDialogs.tsx:102 → FichaDePersonagemDialog.tsx:49
        casca: portal, foco preso, Esc, Editar/Salvar com RASCUNHO, "Ligar a um token", botão Livro,
               "sem sistema" :229-238, Anotação do mestre :251-278
        salvar → salvarSobreOAtual (lib/ajusteDaFicha.ts:437) + comNotaDoMestre
        <FichaDePersonagem>                                      FichaDePersonagem.tsx:52
          lado: EscolhasDoPersonagem :104 (chips/selects das escolhas + etiquetas)
                BlocoLido :174 (Retrato, nome, SeloDoTipo, Descricao, RecursosDaFicha, AtributosDaFicha, HistoricoDaFicha)
                BlocoEditavel :201 (retrato colar/escolher, nome, Tipo jogador/npc se tipoEditavel, descrição,
                                    RecursosEditaveis, AtributosEditaveis)
                inventario (InventarioDaFicha, montado por quem chama)
          principal: <FichaAbas> FichaAbas.tsx:33 (abas do sistema, CartaoLido :153, ListaEditavel :244,
                     CartaoEditavel :368, EscolherDoLivro, CampoDeDano, evolução de técnica)
        números: components/FichaNumeros.tsx (RecursosDaFicha :63, PainelDoRecurso :157, AtributosDaFicha :215,
                 PainelDoAtributo :281, RecursosEditaveis :316, AtributosEditaveis :360, ChipDoRank :26)
        peças: FichaPecas.tsx (ImagemOuIniciais :47, CampoNumero :75), AjusteRapido.tsx (menos/mais e HistoricoDaFicha :206)

Outros hospedeiros do MESMO FichaDePersonagem:
- Jogador: player/PlayerFicha.tsx:421 (tipoEditavel false, livro à parte, ajuste otimista); montado em player/main.tsx:1930, Salvar chama connection.salvarPersonagem (main.tsx:1937).
- Mundo do livro: components/livros/GavetaDaFicha.tsx:62 (FichaDePersonagemDialog com Salvar por gravarNoMundo, sem tokens), montado em MundoDoLivro.tsx:314.
- Batalha: components/batalha/PerfilDaCarta.tsx:44 (só leitura).
- Editor de sistema (prévia): components/EditorDeSistemaDialog.tsx:265 (personagem de exemplo, lib/editorDeSistema.ts:645).

Mestre x jogador:
- Mestre: rascunho local, Salvar grava tudo via store; ajuste rápido aplicarAjustes(..., NOME_DO_MESTRE) RpgDialogs.tsx:115-127 + registro na batalha.
- Jogador: PlayerFicha guarda {base, rascunho}; Salvar manda só as partes mudadas (mensagensDoSalvar); não edita tipo, dono nem campos do mundo do livro; o host revalida tudo e grava o histórico em nome dele.

Genérico x One Piece: a casca (Dialog), o bloco do personagem (retrato, nome, selo, descrição, escolhas, recursos, atributos, histórico) e a renderização das abas por molde LEEM o sistema (data-driven). O que é One Piece está na seção 5.

## 3. "Comparar personagens"

- Página: components/livros/PaginaComparar.tsx:400 PaginaComparar({personagens, sistema, onVerSaude}), aba 'comparar' de MundoDoLivro.tsx:206-207 (marcadores :37-45).
- Estado de sessão (nada em disco): stores/mundoDoLivroStore.ts:35-43 EncontroDoComparar {comparar (2 a 4 ids), grupo, inimigos}, alternarComparar :159-164, alternarNoGrupo, quantosInimigos, limparEncontro.
- Contas puras: lib/livros/encontro.ts; COMPARAR_MIN/MAX :39-40, ColunaDaComparacao :97 (hp, sp, escudo, atributos com rank, golpes), colunaDaComparacao :230, golpesDaFicha :186 (Atacar por arma + técnicas com Dano), melhorGolpe :213, pesoDoEncontro :268 (vida x dano por rodada com FATOR_DA_REACAO do d20 :56), ajusteDoPeso :327 (muda combate.forca dos inimigos).
- Lê: personagens de usePersonagensDoMundo (mundoDoLivroStore.ts:184, a pasta aberta) e o sistema; usa funis da batalha One Piece: lib/batalha/formula.ts (danoDoAtaque, CAMPO_DO_DANO), lib/batalha/leituraDaFicha.ts (armasDe, recursoDoCusto, recursoDoEscudo, tecnicasComForma), lib/batalha/reacao.ts, lib/ajusteDaFicha.ts (maximoComposto, valorDoRank), lib/livros/saude.ts (lerDanoDoCartao).
- Grava: só a força dos NPCs no "Deixar Fácil/Justo/Duro" via gravarNoMundo (PaginaComparar.tsx:445-461, components/livros/comum.tsx:94, mundoDoLivroStore.mudar, stores/rpgDaPasta.ts:33 editarRpgDaPasta).
- Também consumido por: IA (components/ia/PainelDaIa.tsx:80-103, fichas do Comparar entram no contexto), GerarNpc ("o grupo é o de Comparar", GerarNpc.tsx:96) e lib/ia/gerarNpc.ts:109-111 (média do grupo via colunaDaComparacao).
- Não há outro comparar/lado a lado/versus de personagens no app (busca rg); EscolherFichaDeTeste.tsx:131 é só ordenação.

## 4. Criação de NPC e o painel "livros"

- "Livros" = MUNDO DO LIVRO DE REGRAS: porta 04 da tela inicial, screens/LivrosScreen.tsx (passo sistema, depois campanha/pasta, depois MundoDoLivro). Gate: SISTEMAS_COM_MUNDO = new Set([ID_ONE_PIECE]) LivrosScreen.tsx:42. O "livro" é por SISTEMA + PASTA de mapas (as fichas são as do rpg.json da pasta). Abas: Jogadores, NPCs de combate (bestiário), Comparar e balancear, Saúde da ficha, Itens e habilidades (catálogo), Anotações, Arena de testes (MundoDoLivro.tsx:37-45, roteamento :204-227). Também abre por cima do editor (PersonagensSection.tsx:125-129 "Abrir o mundo do <sistema>").
- Bestiário: components/livros/PaginaNpcs.tsx (lista de NPC de combate, força x0,5 a x2 que multiplica HP e dano :17, :53-60, :230), abre NovoNpcDialog :453.
- NovoNpcDialog components/livros/NovoNpcDialog.tsx:54: modos 'novo' (ficha mínima, em branco, variação de modelo) e 'darFicha' (NPC "só cenário" ganha ficha) :20; cria por fichaMinima (lib/livros/combate.ts:189: HP 300 em 'hp' + "Golpe" dano 80 em 'habilidades'), novoPersonagem(...,'npc') + combate :102, novaVariacao :103 (combate.ts:244), trocarForca; grava gravarNoMundo :128/:134.
- IA: components/ia/GerarNpc.tsx (formulário + revisão, "Salvar no bestiário" :158 via gravarNoMundo); lógica lib/ia/gerarNpc.ts; esquemaDoNpc(sistema) :50 (montado do sistema, genérico), pedidoDoNpc :146, personagemDaIa :218 (novoPersonagem npc + combate :227). Mostra HP/SP/Escudo fixos GerarNpc.tsx:216-228.
- Jogadores: PaginaJogadores.tsx:257 cria novoPersonagem(sistema,'jogador',...); ligação à conta/nome em lib/livros/jogadores.ts.
- Editor (fora do mundo): PersonagensSection.tsx:233 cria jogador; importador One Piece importarFichasDoProjetoRpg (lib/importarDoProjetoRpg.ts) em PersonagensSection.tsx:3 e :63.
- Host cria a ficha do jogador: hostSession.ts:7826.
- Catálogo (EntradaDoCatalogoDialog.tsx:30-35): entradas arma/habilidade/item gravadas por sistema em <appData>/livros/<sistemaId>/catalogo.json; tipos e aba de destino FIXOS lib/livros/catalogo.ts:20-48 (arma em 'armas', habilidade em 'habilidades', item em 'itens', perícia/vantagem/desvantagem do livro). Não é catálogo de NPCs: NPCs moram só no rpg.json da pasta.

## 5. Onde o código assume One Piece (ids e regras fixos)

Na ficha (UI):
- FichaAbas.tsx:8 importa ABA_DAS_ARMAS='armas', ABA_DAS_BALAS='balas', ABA_DAS_TECNICAS='habilidades', CAMPO_DA_CATEGORIA, CAMPO_DA_CAPACIDADE (lib/batalha/leituraDaFicha.ts:19, 21, 214-219) e CAMPO_DO_DANO='dano', CAMPO_DO_ATRIBUTO_DO_ATAQUE='atributoDoAtaque' (lib/batalha/formula.ts:75, 82).
  - :36 aba 'balas' escondida sem cartões; :125 arma que não atira; :154 e :369 caso especial de arma; :345-347 técnicas = 'habilidades' + subcartões; :377 técnica com extras (evolução, lib/batalha/escolhaEEvolucao.ts); :436 avisos de Categoria e Soma no ataque; :439 CampoDeDano para o campo 'dano'.
- components/escolhaDeCampo.ts:33-72: campo 'tipo' (tipos de habilidade, lib/batalha/tiposDaHabilidade.ts:22) e 'atributoDoAtaque' com padrão "Força" (formula.ts:84).
- FichaNumeros.tsx:19 faixaDoRank, :26 ChipDoRank "R7" (sistemaDeRpg.ts:209 rotuloDoRank), :260 e :382 rank pelo atributo.rank (genérico, mas o conceito de rank é do OP).
- Transformações: genérico pela flag aba.modificadores (lib/ajusteDaFicha.ts:83 cartoesQueLigam, "Ativar" em FichaAbas CartaoLido :172-178), mas os campos de forma (grupo, danoRecebido, deslocamento, ataquesExtras, usos, requisito) só a batalha lê (lib/batalha/transformacao.ts:26-37, 144).
- lib/ajusteDaFicha.ts:136-137 força só no recurso 'hp' (personagem.ts:224).
- Catálogos do livro com chaves fixas: sistemaDeRpg.ts:149-155; lib/livroDeRegras.ts:14-16, 58 (catalogoDaAba só pericias/vantagens/desvantagens).
Fora da ficha mas no mesmo fluxo:
- lib/batalha/leituraDaFicha.ts:203-211 recursoDoCusto procura id 'sp' (cai para tom energia) e recursoDoEscudo id/nome 'escudo'.
- lib/livros/encontro.ts:230-247 colunas fixas hp/sp/escudo; PaginaComparar.tsx:170-209 linhas "HP", "SP", "Escudo", "Vida e fôlego"; golpes = Atacar por arma + técnicas 'habilidades' com 'dano'.
- lib/livros/saude.ts:29-32 campos custo/dano/acao/tempo; PaginaSaude.
- lib/livros/combate.ts:28-35, 189-203 ficha mínima (HP 300, Golpe 80, aba 'habilidades', campo 'dano').
- PaginaNpcs.tsx:53-60, 230, 263 textos "HP máximo"/"dano das técnicas"; PaginaJogadores.tsx:316 "HP, SP, técnicas e armas".
- GerarNpc.tsx:216-228 HP/SP/Escudo; lib/ia/gerarNpc.ts:109-111.
- lib/livros/catalogo.ts:41-48 destinos de aba fixos.
- screens/LivrosScreen.tsx:42 gate do mundo; lib/sistemaOnePiece.ts inteiro; lib/importarDoProjetoRpg.ts (fichas do projeto-rpg-v2).
- Batalha inteira (lib/batalha/*, components/batalha/*, arena) lê os ids acima; não há gate por id de sistema (só sistema === null, BatalhaDoMestre.tsx:571).

## 6. Costura recomendada

Princípio: Dragon Ball Tales = OUTRO SistemaDeRpg embutido (id 'dragon-ball-tales', somado a SISTEMAS_EMBUTIDOS lib/sistemaOnePiece.ts:199, de preferência vindo de um lib/sistemaDragonBall.ts próprio), escolhido por aventura/pasta, e a TELA escolhida pelo sistema. Os personagens continuam Personagem no formato genérico; nenhum caminho One Piece é editado.

1. Ponto único de escolha do componente: um registro fichaDoSistema(sistema) (ex.: components/fichas/registro.ts) que devolve o miolo com a MESMA interface FichaDePersonagemProps (FichaDePersonagem.tsx:25-50). Padrão = FichaDePersonagem atual; 'dragon-ball-tales' = FichaDragonBall. Trocar a chamada direta nos 4 hospedeiros:
   - FichaDePersonagemDialog.tsx:240 (cobre RpgDialogs E GavetaDaFicha do mundo do livro)
   - player/PlayerFicha.tsx:421
   - components/batalha/PerfilDaCarta.tsx:44
   - components/EditorDeSistemaDialog.tsx:265 (prévia)
   Chave do registro: sistema.id é o mais simples e sobrevive a disco e rede. Se cópias editadas ("Duplicar" gera id novo, stores/rpgStore.ts:100) devem manter a ficha DB, acrescentar campo opcional ficha?: 'padrao' | 'dragon-ball' ao SistemaDeRpg; isso exige mexer em lerSistemaDeRpg sistemaDeRpg.ts:445 (senão some na rede e no disco) e na cópia do editor (lib/editorDeSistema.ts copiaDoSistema).
2. Dados: modelar DBT dentro das chaves genéricas (escolhas: raça...; recursos com tom vida/energia + atualEMaximo, ex. vida e ki; atributos com ou sem rank; abas: técnicas, transformações com modificadores/subcartoes, itens). Assim funcionam SEM mudança: disco (adventure.json, rpg.json), paraOFio, protocolo e diff de edição do jogador, ajuste rápido + histórico (aplicarAjustes), mídia do retrato e dos cartões, barra de vida do token (vidaDaFicha.ts:55 usa tom 'vida'), ligação token (characterId), esquema da IA (gerarNpc.ts:50 é montado do sistema).
   Se DBT precisar de dado estruturado que não cabe em recursos/atributos/escolhas/abas: UM campo opcional novo em Personagem (ex. dadosDoSistema) obriga a tocar, de forma aditiva: personagemDoArquivo personagem.ts:464, PartesDoPersonagem + parsePartesDoPersonagem protocoloDoPersonagem.ts:81 e :293, partesMudadas/aplicarPartes edicaoDoPersonagem.ts:50 e :150, salvarSobreOAtual ajusteDaFicha.ts:437. Sem isso o campo é apagado na leitura do disco e na volta do jogador.
3. Reutilizar como está: casca FichaDePersonagemDialog (rascunho, Esc, ligar token, nota do mestre, sem-sistema), FichaPecas (ImagemOuIniciais, CampoNumero), CampoQueColaImagem, AjusteRapido (BotaoPasso, PainelDeAjuste, HistoricoDaFicha), InventarioDaFicha, arquivosDaFicha/escolherImagemDaFicha, imagensDaFicha/midia, RpgDialogs/rpgStore (abrir/fechar), adventureStore (salvar/ajustar/apagar), hostSession personagens* e playerConnection inteiros, contas/nomeDoJogador.
4. Não reutilizar sem camada própria (One Piece por dentro): FichaAbas (armas, balas, técnicas, CampoDeDano, evolução), escolhaDeCampo, encontro.ts/PaginaComparar, saude.ts/PaginaSaude, combate.ts fichaMinima, catalogo.ts destinos, toda lib/batalha e a arena. Para o Comparar do DBT: um provedor de coluna por sistema (paralelo a colunaDaComparacao), escolhido pelo mesmo registro; o estado do Comparar no mundoDoLivroStore (ids, grupo, inimigos) é reaproveitável.
5. Mundo do livro: incluir o id DBT em SISTEMAS_COM_MUNDO (LivrosScreen.tsx:42) só quando as páginas por sistema existirem; MundoDoLivro.tsx:204-227 é o ponto para trocar páginas por sistema.

## Pontas soltas / não coberto
- Não li FichaAbas.tsx inteiro (702 linhas) nem PlayerFicha.tsx :99-400 linha a linha; os pontos One Piece de FichaAbas vêm de busca por constantes, pode haver mais regra embutida em texto.
- Batalha (lib/batalha/*, components/batalha/*, arena) só mapeada pelo contrato (lib/batalha/mesa.ts:20-27); o pedido DBT quer batalha manual nova, fora deste dossiê.
- CatalogosDoSistema tem chaves fixas; se o livro DBT tiver catálogos de outro tipo, o formato do sistema precisa crescer (sistemaDeRpg.ts:149, livroDeRegras.ts:14-16, net/protocoloDoLivro.ts).
- Não verifiquei se copiaDoSistema (editorDeSistema.ts) preserva campos fora do rascunho.
- Linhas com "~" (handlers do hostSession, pastaQueManda) são aproximadas pela leitura do bloco.
- Suspeita: recurso de vida do DBT com id diferente de 'hp' faz a força do NPC não valer no máximo (ajusteDaFicha.ts:136-137) nem em fichaMinima (combate.ts:191), sem erro.
