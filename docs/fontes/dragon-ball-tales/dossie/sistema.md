# Dossiê: abstração de Sistema de RPG no Labirinto (para encaixar Dragon Ball Tales)

Raiz: C:/dev/labirinto/client/src. Read-only, grafo EM_DIA @ ed1a13ae. Sem testes rodados.

## 1. Tipo SistemaDeRpg (lib/sistemaDeRpg.ts)

- FORMATO_DO_SISTEMA = 1 (sistemaDeRpg.ts:19). Leitor recusa formato > 1 (sistemaDeRpg.ts:447-448); ausente = 1.
- SistemaDeRpg (sistemaDeRpg.ts:157-173):
  - formato, id (vira nome de arquivo e chave; ID_VALIDO :239, ate 64 chars), nome, versao, descricao, cor (#rrggbb, capa na grade).
  - escolhas: EscolhaDoSistema[] (:58) -> listas fechadas (Raca, Oficio) = chips no topo da ficha; valor em Personagem.escolhas[id].
  - recursos: RecursoDoSistema[] (:44) -> quadrinhos HP/SP/Escudo; tom vida/energia/neutro; atualEMaximo liga atual/max (Personagem.recursos/maximos/modificadoresDosRecursos).
  - atributos: AtributoDoSistema[] (:31) -> numeros com rank opcional (TabelaDeRank :26, rankDoValor :198). Personagem.atributos[id]. Sistema sem atributo e recusado (:453).
  - abas: AbaDoSistema[] (:91) -> abas de cartoes da ficha. CampoDoCartao (:74) forma paragrafo|linha|destaque (:72) + opcoes. Flags: extras, atributos (pericia), imagem, modificadores (transformacao), subcartoes {aba, rotulo}.
  - livro?: CapituloDoLivro[] (:116) -> {id, titulo, ordem, texto em marcacao leve}.
  - catalogos?: CatalogosDoSistema (:149) -> CHAVES FIXAS: pericias, vantagens, desvantagens, racas, oficios. Nao extensivel.
- Tetos (:176-195): 200 capitulos, titulo 120, capitulo 100k chars, livro total 600k, catalogo 500 itens/chave, item nome 120 / texto 8000, catalogos total 300k. Excedente e cortado em silencio (livroDoArquivo :349, catalogosDoArquivo :408).
- Leitor tolerante lerSistemaDeRpg (:445-481) monta objeto NOVO campo a campo -> QUALQUER CAMPO NOVO (ex.: motor) E DESCARTADO hoje. Mesmo leitor em: disco (bibliotecaDeSistemas.ts:74), import (:122), editor ao salvar (editorDeSistema.ts:613), jogador na rede (net/protocoloDoPersonagem.ts:416), pacote do livro (net/protocoloDoLivro.ts lerPacoteDoLivro).
- Nao existe discriminador kind/engine/motor.

## 2. Registro, armazenamento, escolha, rede

### Biblioteca (do APP, nao da aventura)
- lib/bibliotecaDeSistemas.ts: <appData>/sistemas/<id>.json, um arquivo por sistema (:18, :24).
- Embutidos vem do codigo: SISTEMAS_EMBUTIDOS = [SISTEMA_ONE_PIECE] (lib/sistemaOnePiece.ts:199). One Piece e BUILT-IN (nao copia em disco); id 'one-piece' (sistemaOnePiece.ts:30).
- ehEmbutido (:43); listarSistemas (:51) = embutidos + pasta; id repetido -> embutido vence (:80).
- Importar com id de embutido vira <id>-importado (:93-96).
- gravarSistema recusa embutido (:104). apagarSistema recusa embutido (:136) e remove <id>.json + qualquer .json com o mesmo id (:135-150).
- Store em memoria: stores/rpgStore.ts (biblioteca :39/:77, carregarBiblioteca :90, salvar :102, duplicar :107, apagar :114). sistemaPorId (:121) = lookup por id, usado em todo lugar.

### Escolha por aventura/pasta (so o ID e persistido)
- Aventura: adventure.json, sistemaDeRpg?: string (lib/adventure.ts:83) - "So o id, nao uma copia".
- Pasta de mapas: <appData>/pastas/<id>/rpg.json, sistemaDeRpg?: string (lib/pastasDeMapas.ts:23, :37, :68; serializa :265).
- Resolucao: sistemaAtivo (stores/adventureStore.ts:938): pasta manda se o mapa herda e ela tem sistema (pastaQueManda :921), senao adventure.sistemaDeRpg.
- Troca: setSistemaDeRpg (adventureStore.ts:1670-1683); UI: SistemasDialog onEscolher (components/RpgDialogs.tsx:63); screens/PastaDeMapasConfig.tsx:90-93.
- map.json nao guarda sistema.
- Personagem NAO guarda id de sistema (lib/personagem.ts:105-171). Ficha generica por chaves (atributos[id], abas[abaId]). Trocar sistema nao apaga dados; o que o novo nao conhece so some da tela (personagem.ts:11-13).
- Arena guarda sistemaId na sessao (lib/arena/tipos.ts:146; stores/arenaStore.ts:56, :60).

### Outros dados em disco por sistema
- <appData>/livros/<sistemaId>/catalogo.json: catalogo do Mundo do livro (armas/habilidades/itens) (lib/livros/catalogoNoDisco.ts:33-56; lib/livros/catalogo.ts:12). apagarSistema NAO remove (orfao inofensivo).
- localStorage 'lb-livros:ultima-pasta:'+sistemaId (screens/LivrosScreen.tsx:44-57).
- GLOBAL, compartilhado entre sistemas: <appData>/batalha/regras-do-campo.json (lib/batalha/regrasDoCampoNoDisco.ts:16-17). Motor novo NAO deve reaproveitar.

### Rede
- Host: hostWorldOf (adventureStore.ts:903-915) poe rpg {sistema, personagens, equipes} no mundo.
- mensagemDoSistema (net/hostSession.ts:7712-7716): 'rpg.sistema' com sistemaSemLivro(sistema) (lib/livroDeRegras.ts:49) + ResumoDoLivro (livroDeRegras.ts:41). Reenviado quando a REFERENCIA do sistema muda (hostSession.ts:7700) - por isso rpgStore troca a referencia ao salvar (rpgStore.ts:64-69).
- Jogador le com lerSistemaDeRpg (protocoloDoPersonagem.ts:412-419) -> estado sistemaDeRpg (player/playerConnection.ts:4432-4438).
- Livro sob demanda: 'livro.pedir' {sistemaId} (playerConnection.ts:6015-6026) -> handleLivroPedir (hostSession.ts:7794-7804), recusa se sistemaId != sistema da aventura; partesDoLivro (net/protocoloDoLivro.ts): pacote {sistemaId, livro, catalogos} partido em 48 KiB, max 64 partes (3 MiB). Jogador remonta e rele com livroDoArquivo/catalogosDoArquivo.

### Apagar/editar
- Apagar: SistemasDialog barra so o sistema EM USO na aventura aberta (components/SistemasDialog.tsx:251-259); outras aventuras que o usam ficam "sem sistema" (fichas preservadas; avisos em FichaDePersonagemDialog.tsx:235, PersonagensSection.tsx:134-136, livros/MundoDoLivro.tsx:200).
- Editar embutido = "Editar uma copia" (SistemasDialog.tsx:229-243 -> rascunhoDaCopia, editorDeSistema.ts:307). Copia mantem ids das partes.
- Independencia: como tudo e por id e a ficha nao referencia sistema, apagar o sistema X nunca toca dados de aventuras do Y. O acoplamento real esta no MOTOR DE BATALHA, que e implicitamente One Piece para qualquer sistema.

## 3. Onde o codigo depende de One Piece

### Referencias explicitas (nao-teste)
- screens/LivrosScreen.tsx:42 SISTEMAS_COM_MUNDO = new Set([ID_ONE_PIECE]); :115-117 gate do Mundo do livro (arena, NPCs de combate); :130 texto "batalha automatica" para todo embutido.
- stores/rpgStore.ts:77, lib/bibliotecaDeSistemas.ts:40/:52 (so via SISTEMAS_EMBUTIDOS).

### Acoplamento implicito por IDs de One Piece (o motor de batalha roda em QUALQUER sistema)
- A batalha nao checa sistema/motor: ControleDaBatalha.ligarBatalha (components/livro/ControleDaBatalha.tsx:159-167) usa o sistema ativo; batalhaStore so faz null-check (stores/batalhaStore.ts:566, :726, :890...).
- lib/batalha/leituraDaFicha.ts:19 ABA_DAS_ARMAS=armas, :21 ABA_DAS_TECNICAS=habilidades, :214 ABA_DAS_BALAS=balas; custo em sp ou hp (:34-78); recursoDoCusto procura id sp ou tom energia (:203-205); escudo por id/nome (:210).
- lib/batalha/acoes.ts:114-115 Agilidade por id/nome (iniciativa).
- lib/personagem.ts:224 RECURSO_QUE_A_FORCA_MULTIPLICA = hp.
- stores/batalhaStore.ts:1216-1276 custo em sp; lib/batalha/golpe.ts:200, invocacao.ts:398/456, passivas.ts:275-291/433, marca.ts:216-223, escolhaEEvolucao.ts:383, reacaoComTecnica.ts:88.
- components/batalha/dadosDoMenu.ts:335-336; components/batalha/CartaDaOrdem.tsx:190 (barra Escudo); lib/livros/combate.ts:34; lib/livros/encontro.ts:203/237; lib/livros/saude.ts:114.
- lib/livros/catalogo.ts:43-47: tipos do catalogo do Mundo -> abas fixas habilidades/itens/pericias/vantagens/desvantagens.
- A FICHA generica tem ganchos OP por id de aba: components/FichaAbas.tsx:6-10 importa lib/batalha/(escolhaEEvolucao, formula, leituraDaFicha) para campos especiais de armas/balas/tecnicas. Inertes se o DBT nao usar ids armas, balas, habilidades nem os campos especiais (CAMPO_DO_TIPO, CAMPO_DO_DANO, categoria, capacidade, atributoDoAtaque).
- lib/ia/prompts.ts:220-222 mapeia abas pericias/vantagens/desvantagens.

### Discriminador kind/engine
- NAO existe. Nenhum componente escolhe ficha ou motor por sistema. Seams que ja existem:
  - MesaDaBatalha (lib/batalha/mesa.ts:19-44) + fabrica criarBatalhaStore(mesa) (stores/batalhaStore.ts:2338); instancia real useBatalhaStore (:2346) com mesaDaAventura (stores/mesaDaAventura.ts:67-70); arena usa outra instancia (stores/arenaStore.ts:107). Padrao "motor recebe a mesa" pronto para reuso.
  - Protocolo de batalha isolado: net/protocoloDaBatalha.ts (mensagens batalha.* :150-296) + net/batalhaNoHost.ts (:236-296) + BatalhaDoJogador (player/main.tsx:1545).

### Pontos de montagem a ramificar por motor
- Ficha: components/FichaDePersonagemDialog.tsx:240, player/PlayerFicha.tsx:421, components/EditorDeSistemaDialog.tsx:265 (previa), components/batalha/PerfilDaCarta.tsx:44, components/livros/GavetaDaFicha.tsx:62 (via dialog).
- Batalha mestre: App.tsx:3286 EfeitosDoMestre, App.tsx:3319 FaixaDoMestre, App.tsx:4347 PaginaDaBatalha (-> components/livro/ControleDaBatalha.tsx), components/RpgDialogs.tsx:116 (registrarAjuste).
- Batalha jogador: player/main.tsx:1545; host: net/batalhaNoHost.ts.
- Mundo/Arena (comparar personagens): screens/LivrosScreen.tsx:42/115, components/livros/MundoDoLivro.tsx:223 PaginaArena, stores/arenaStore.ts:107.

## 4. UI do livro de regras

- components/LivroDeRegras.tsx:29 (props sistema, livro, catalogos). Secoes = capitulos ordenados + catalogos com itens (CATALOGOS_DO_LIVRO, lib/livroDeRegras.ts:13-19). Sumario em lista + select; capitulo renderizado inteiro (sem virtualizacao) por components/MarcacaoLeve.tsx.
- Busca: lib/buscaNoLivro.ts indexarLivro (:125), buscarNoLivro (:167), minimo 2 chars (:13), 30 resultados por grupo (:15), ignora acento (:23); filtrarItens (:194).
- Mestre: components/LivroDeRegrasDialog.tsx:75 (aberto por RpgDialogs.tsx:137). Jogador: player/PlayerFicha.tsx:387.
- Markdown: renderer PROPRIO lib/marcacaoLeve.ts (166 linhas). Blocos: titulo # ## ###, paragrafo, citacao >, lista (- * bullet e 1.), regua ---. Trechos: negrito (2 asteriscos), italico (1 asterisco), sublinhado (2 underscores), riscado (2 tils), codigo em crase (marcacaoLeve.ts:1-26). SEM TABELAS, sem link, sem imagem, sem HTML (intencional: texto nao confiavel). Aninhamento ate 4 (:43).
- Escolher do livro: FichaAbas.tsx:252 ofereceLivro, :324 EscolherDoLivro; itens via itensDaAba -> catalogoDaAba (lib/livroDeRegras.ts:58-67) SO para abas com id pericias, vantagens ou desvantagens; cartaoDoCatalogo (:82-93) copia descricao/efeito/atributos por valor. Racas/oficios nao viram cartao.
- Livro de ~130 paginas: 600k chars total e 100k/capitulo (130 pag ~ 250-450k chars: cabe, mas capitulos longos devem ser partidos); 200 capitulos; rede 3 MiB (ok). Tabelas do PDF: virar listas OU estender marcacaoLeve com bloco tabela (linhas com pipe) + MarcacaoLeve.tsx + textoSemMarcacao (:150, usado na busca).
- Catalogos do DBT (racas com descricao, tecnicas, itens, transformacoes) nao cabem nas 5 chaves fixas -> estender CatalogosDoSistema (ex.: mapa generico aba->itens) ou usar o catalogo por sistema do Mundo (lib/livros/catalogo.ts, hoje com abas OP fixas).

## 5. Editor de sistema

- components/EditorDeSistemaDialog.tsx (secoes geral/escolhas/recursos/atributos/abas/catalogos/livro + previa), lib/editorDeSistema.ts.
- rascunhoDoSistema (editorDeSistema.ts:213-283) -> sistemaDoRascunho (:579-615) reconstroi o objeto do zero e repassa por lerSistemaDeRpg (:613). Campo novo (motor) seria PERDIDO ao salvar se nao entrar no rascunho e no objeto final.
- O editor deixa apagar/renomear atributos, recursos e abas: um motor que le ids fixos quebraria em silencio numa copia editada.
- Embutido nao e editavel no lugar (so copia). Se DBT for embutido, Editar ja vira copia. Decidir: a copia herda o motor (ai travar secoes estruturais atributos/recursos/abas e liberar so livro, catalogos e textos) ou a copia cai para motor generico/OP.
- SUSPEITA: lib/editorDeSistema.ts:241 o rascunho dos campos nao copia CampoDoCartao.opcoes (so id/rotulo/forma) -> salvar uma copia editada do One Piece perde as opcoes de Tipo e Categoria (sistemaOnePiece.ts:86, :153). Nao confirmado em teste.

## Recomendacao de plug-in

1. Campo opcional motor (string) em SistemaDeRpg: one-piece ou dragon-ball-tales; ausente = one-piece (preserva todo sistema existente/importado/copias). Ler em lerSistemaDeRpg (sistemaDeRpg.ts:463-480) com lista fechada; carregar no rascunho do editor (editorDeSistema.ts:213 e :597). Considerar FORMATO 2 para arquivo com motor, para app antigo recusar em vez de rodar o motor errado.
2. Registro de motores (novo, ex.: lib/motores/): motor -> Ficha, criarBatalha(mesa), UI mestre (faixa/pagina/efeitos), UI jogador, handler host, temMundo/arena, idsExigidos. One Piece = adaptador fino sobre o codigo atual (sem mover logica).
3. DBT como embutido: lib/sistemaDragonBallTales.ts + lib/livroDragonBallTales.ts, entrando em SISTEMAS_EMBUTIDOS (sistemaOnePiece.ts:199; melhor mover a lista para modulo proprio). Id proprio dragon-ball-tales; aventuras existentes guardam one-piece ou ids importados, entao nada muda nelas.
4. Ramificar por motor nos pontos de montagem da secao 3 (ficha x5, batalha mestre x3 + ControleDaBatalha, jogador x1, host x1, gate do LivrosScreen). Motor DBT com store propria (fabrica no molde de criarBatalhaStore + MesaDaBatalha) e protocolo proprio (prefixo dbt.) para nao tocar batalha.*.
5. Persistencia do DBT em pasta propria de appData (nunca batalha/regras-do-campo.json).
6. Livro: estender marcacaoLeve com tabela, ou converter tabelas em listas.

## Nao coberto
- Conteudo interno de BatalhaDoJogador, vistaDoJogador.ts, batalhaNoHost.ts alem dos tipos de mensagem.
- ajusteDaFicha.ts (ajuste rapido) e a validacao da edicao do jogador em protocoloDoPersonagem.ts: nao lidos linha a linha.
- PaginaItens/catalogoStore do Mundo do livro: so os tipos.
- Arena (TelaDaArena/PaginaArena) alem do gate.
