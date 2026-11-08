## Mapa

Raiz **G** = `C:/Users/gedasio.filho/OneDrive - Vertis Capital/Área de Trabalho/Tudo/Projeto Obsidian/grimorio`. Todo `src/…`, `src-tauri/…` e `HANDOFF.md` abaixo fica dentro de G. **S** = `C:/Users/gedasio.filho/OneDrive - Vertis Capital/Área de Trabalho/Tudo/Projeto Obsidian/docs/superpowers/specs`.

**Versão:** o repositório está na v0.15.0 (`src-tauri/tauri.conf.json:4`, HEAD a146def de 01/10/2026, sem nada pendente para commitar). O instalado também é a 0.15.0 (`C:/Users/gedasio.filho/AppData/Local/Grimorio/grimorio.exe`, li só o metadado do arquivo, gravado em 01/10/2026). Usa Tauri 2, React 19, tldraw 4.5, TipTap 3 e zustand (`package.json:15-28`). Atualiza sozinho pelo GitHub (`tauri.conf.json:43-52`) e só tem versão para Windows.

### O que ele faz hoje (telas e recursos)
1. **Cofre:** o cofre é uma pasta no disco. Dá para registrar vários e trocar entre eles (`App.tsx:74`, `src/lib/cofres.ts:7-75`).
2. **Barra lateral** (`src/components/Sidebar.tsx`):
   - botões da Teia e de Opções (124-125) e o filtro "Campanha: Todas" (130-141);
   - Campanhas, cada uma com os grupos Escrita, Sessões, Personagens e Canvases (143-151, 219-231);
   - "Canvas e Mapa" numa lista só (153-173);
   - Personagens, Cenários e Itens em pastas aninhadas (175-182);
   - etiqueta que liga uma ficha ou pasta a campanhas (318); a pasta passa a campanha para o que tem dentro (`src/lib/herancaCampanha.ts`).
3. **Sessão:** canvas tldraw, caderno de páginas ao lado e assistente de IA (`App.tsx:101-111`, `src/components/Workspace.tsx:42-55,169-183`).
4. **Canvas** (é o "mapa mental" de hoje): quadro livre.
   - Cards de Personagem, Cenário e Item (`src/components/CanvasView.tsx:28`).
   - Setas criadas sozinhas a partir dos vínculos (`src/components/ligacoesCanvas.ts:59,78`).
   - Uma imagem pode virar ficha (`src/lib/transformarImagem.ts`), e o card de cenário mostra uma faixa com os itens dele (`FaixaItensCenario.tsx`).
   - Exporta PNG ou SVG (`src/components/exportarCanvas.ts:7-38`).
5. **Escrita** (caderno livre da campanha): páginas em árvore pai/filho, texto rico com imagem e IA no papel de "escritor" (`App.tsx:113-122`, `src/lib/notebookRepo.ts:14-20`, `Workspace.tsx:179`). Não tem mapa ao lado.
6. **Mapa** (planta de interior, estilo Resident Evil):
   - 15 tipos de peça registrados: sala, sala polígono, corredor, porta com vão, escada, muralha, torre, retângulo, linha, símbolo, pino de item e os 3 cards (`src/lib/montagemMapa.tsx:78-94`);
   - ferramentas próprias (`:133-139`) e o comando "Unir salas" (`HANDOFF.md:72,85`);
   - camadas que dá para travar, esconder e reordenar (`src/lib/types.ts:144-149`);
   - a sala se liga a um cenário pelo `cenarioId`, e o duplo clique abre a ficha (`src/lib/vaultRepo.ts:781`, `HANDOFF.md:128-131`);
   - a IA monta uma planta a partir de texto ou imagem (`src/lib/gerarMapaIA.ts:1-7`).
7. **Fichas em janela (modal) com abas:**
   - Personagem: Descrição, Informações, História, Itens, Imagens, Extras, Anotações, Vínculos (`PerfilModal.tsx:27-38`);
   - Cenário: as mesmas, mais Conteúdo e Eventos (`CenarioModal.tsx:30-42`);
   - Item: Descrição, Informações, Efeito, Vínculos (`ItemModal.tsx:24-31`);
   - versões/formas como Dia/Noite ou Bruce/Hulk (`BarraVersoes*.tsx`), enquadramento do retrato, galeria, inventário em grade, e uma barra de localização para mover, criar subcenário e absorver como versão (`BarraLocalizacao.tsx`).
8. **Vínculos e Teia:** vínculos com tipo entre personagem, cenário e item (14 sugestões ou texto livre, `src/lib/vinculos.ts:7-11`). A **Teia** é o grafo de conexões em tela cheia, do cofre todo ou de uma campanha, e guarda as posições (`App.tsx:82`, `src/lib/grafoVinculos.ts:73`, `src/lib/grafoLayoutPersistido.ts:52`).
9. **IA Gemini** (`src/lib/modeloIA.ts:19`):
   - botões nas fichas, como "Sugerir segredos e ganchos", "Sugerir eventos", "Analisar imagem" e "Descrever…" (`PerfilModal.tsx:43,49`, `CenarioModal.tsx:47-67`, `ItemModal.tsx:36-52`);
   - o chat da sessão fica salvo no disco (`vaultRepo.ts:729-743`);
   - o chat da ficha **não** é salvo (`ChatEntidade.tsx:34,45`).
10. **Busca Ctrl+K:** acha só pelo **nome** da ficha e pelo **título** da página, não procura dentro do texto (`src/lib/buscaGlobal.ts:6-15`, `src/lib/buscaPaginas.ts:94`).
11. **Opções:** Cofre, Nuvem, Aparência, IA, Imagens e Lixeira (`Opcoes.tsx:30-36`).
    - 3 temas escuros (`src/lib/tema.ts:2-6`).
    - Lixeira com restaurar (`src/lib/lixeira.ts:6-28`).
    - "Organizar imagens" com prévia e desfazer (`HANDOFF.md:8-12`).
    - Sincronização pelo Google Drive entre PCs; quando os dois lados mudam, gera uma cópia "(conflito — …)" (`src/lib/sync/`, `src-tauri/src/drive.rs:694-870`, `src/lib/sync/preservar.ts:98`).

### Modelo de dados (`src/lib/types.ts`)
- **Personagem** {id, nome (espelho da forma ativa), versoes[], versaoAtivaId, criadoEm, modificadoEm} (37-44). Cada versão tem {nome, retrato, foco, resumo, textos HTML, imagens[{rel,legenda}], acervo[{itemId,qtd}]} (15-35).
- **Cenario** {id, nome, personagens[ids], versoes[], versaoAtivaId} (74-82). A versão tem ainda `eventos`, que é só texto ("vira entidade própria no futuro", 67), além de `itens` em texto e `acervo` (58-72). A hierarquia de cenários é a das pastas no disco.
- **Item** {id, nome, resumo, retrato, descricao, informacao, efeito}, sem versões (84-103).
- **Vinculo** {deTipo, deId, paraTipo, paraId, tipo, notas}. O alvo só pode ser personagem, cenário ou item. Fazer parte de uma campanha é um vínculo do tipo `'participa'` (105-125, `vinculos.ts:4`).
- **CanvasDoc** {id, nome, documento = snapshot do tldraw, camadas?, versaoCamadas?}. O mesmo formato serve para sessão, canvas, mapa e escrita (127-142).
- **Campanha** {id, nome, descricao} (151-157). **Pagina** {id, titulo, paiId, ordem, corpo HTML} (242-250).

### Onde grava
O cofre do usuário fica em `C:/Users/gedasio.filho/OneDrive - Vertis Capital/Documentos/Grimorio` (`HANDOFF.md:316`).
```
campanhas/<slug>/campanha.json | sessoes/<x>.json + <x>.notas/(paginas .json, chat-ia.json) | escrita/ | canvases/ | personagens/ | assets/   (vaultRepo.ts:187-197, caminhos.ts:2-9)
canvases-soltos/ | mapas-soltos/   (vaultRepo.ts:179-183)
personagens-soltos/<pastas>/pasta.json + <slug>.json | itens/<pastas>/<slug>.json   (204-246)
cenarios/<pasta>/<cenario>/cenario.json, com os subcenários dentro   (530-545)
vinculos.json + layout-teia.json na raiz   (691-724)
imagens/{personagens/<Nome>/retrato.png, cenarios/<Pai>/<Filho>/, itens/, canvas/<Sessao>/01.png, mapas/<Mapa>/}   (HANDOFF.md:8)
.lixeira/<id>/entrada.json + o conteúdo   (lixeira.ts:6-26)
```
- **Fora do cofre:**
  - cofres recentes, tema, divisão de tela e filtro ficam no localStorage do WebView (`cofres.ts:7-11`, `tema.ts:10`, `Workspace.tsx:23`);
  - o manifesto do sync e o diário do "Organizar imagens" ficam em `%APPDATA%/com.gedasio.grimorio` (`src/lib/sync/ciclo.ts:46`, `HANDOFF.md:12`).
- **Como grava:** JSON indentado, gravação atômica (arquivo .tmp e depois rename, com 3 tentativas por causa do OneDrive; `src-tauri/src/lib.rs:18-30`). Há uma fila por arquivo (`vaultRepo.ts:168-173`) e o canvas salva sozinho 1 s depois da última mudança (`canvasDoc.ts:20`).
- **Imagens:** são arquivos soltos dentro do cofre, sempre apontados por caminho relativo (`rel`), então o cofre funciona em qualquer PC.
  - retrato e imagens das fichas: `types.ts:1-4,18,61,96`;
  - imagens do canvas: `meta.rel` (`canvasDoc.ts:22-53`);
  - imagens das páginas: `data-rel` no HTML (`types.ts:247`).
- **Versionamento:**
  - os JSON não têm campo de versão do formato; o app converte o formato antigo na hora de ler (formato plano → `versoes[]`, `corpo` → `descricao`; `vaultRepo.ts:53-81,102-128`);
  - o único campo versionado é `versaoCamadas` (`types.ts:139`); o tldraw tem esquema próprio e migração por peça (`HANDOFF.md:149`);
  - as "versões" das fichas são **estados** (Dia/Noite), não histórico;
  - não existe histórico de edições; a proteção é a lixeira, as cópias de conflito e o manifesto anterior do sync (`src/lib/sync/manifesto.ts:18-19`).

### Dados reais (só nomes, chaves e contagens)
- **No cofre real:**
  - 3 campanhas, 8 sessões, 3 cadernos de escrita (22 páginas, 9 delas dentro de outra), 1 canvas de campanha;
  - 2 canvases soltos e 2 mapas soltos (com camadas);
  - 106 personagens (16 com mais de uma forma, nenhum com itens);
  - 98 cenários (20 com mais de uma versão, 11 com itens, até 7 níveis, 2 ainda no formato antigo);
  - 49 itens e cerca de 1.463 imagens.
- **vinculos.json:** 309 vínculos, mas 301 são só "participa" em campanha. Relações de verdade são **8** (personagem com personagem, 4 tipos).
- **O que tem nas sessões:** 266 imagens, 93 cards de cenário, 84 de personagem, 62 setas, 39 frames, 32 cards de item. **Nos mapas:** 182 salas, 33 portas, 22 corredores, 17 escadas, 10 torres.
- **`C:/Users/gedasio.filho/Grimorio-copias-conflito-2026-08-14`:** 46 arquivos, todos cópias "(conflito — Grimorio dd-08 hhmm)" do sync de 12 a 14/08.
  - 33 canvases soltos (a última cópia tem 132 formas geo, 96 linhas e 16 textos);
  - 12 `cenario.json`, ainda com retrato no formato antigo `imagens-cenarios/retrato-<id>-<id>.png`;
  - 1 personagem; a pasta `campanhas/` está vazia;
  - as chaves batem com o modelo atual.

### O que está pela metade ou no backlog
- **Linha do tempo:** não existe (nenhuma ocorrência de timeline ou cronologia em `src`). Evento é só texto dentro do cenário (`types.ts:67`, `S/2026-07-14-cenarios-design.md:278`).
- **Mapa dentro do cenário** (aba "Planta") e **pastas em "Canvas e Mapa"**: não feitos (`G/docs/superpowers/specs/2026-08-14-mapas-design.md:138,142`). Mapa é uma lista simples, fora das campanhas (`types.ts:232-233`).
- **Mapa do mestre separado do mapa dos jogadores, andares e legenda automática:** ficaram para depois (`G/docs/superpowers/specs/2026-08-14-mapas-fatia-4-design.md:167-171`).
- **Escrita:** sem links `[[ ]]`, sem backlinks, sem exportar PDF e sem editor de blocos (`S/2026-07-13-grimorio-escrita-design.md:118-123`).
- **Fila do mapa:** corredor sem ligação com a sala, recortar área, copiar estilo, renomear direto no canvas (`HANDOFF.md:103-108`). Há 7 defeitos conhecidos de camadas (`HANDOFF.md:170-180`).
- **Nomear a imagem ao colar:** pedido de 27/09, não feito (`HANDOFF.md:24`).
- **Sync:** sem histórico no Drive e sem compartilhar o cofre com outra pessoa (`S/2026-07-26-sync-google-drive-design.md:434-435`).

### Comparado com o que o usuário marcou do vvd.world
- **Mapa de conexões:** já existe (a Teia), mas os dados reais quase não têm relações (8).
- **Enciclopédia revelada aos poucos:** não existe. Nenhum tipo em `types.ts` tem campo de "revelado" ou "visível", e o app é de um usuário só.
- **Mapa-mundi:** não existe. O mapa é planta de interior; a geografia hoje é a árvore de cenários.
- **Cartaz de procurado:** não existe. O mais perto é o card de personagem no canvas com exportar PNG.

## Como se conecta
- O store (`src/state/store.ts:209-266`) guarda cópias das fichas por id, os vínculos e o documento aberto. O App escolhe a tela pelo tipo do documento (`App.tsx:85-122`) e abre as fichas como janela por id (`App.tsx:124-126`).
- Tudo o que lê ou grava passa por VaultRepo (o cofre) e NotebookRepo (as páginas), depois por FsBridge, até os comandos em Rust (`src-tauri/src/lib.rs:13-179`).
- As ligações são sempre **por id**: `vinculos.json`, `Cenario.personagens[]`, `acervo[{itemId}]`, e os cards e salas guardam o id da ficha (`vaultRepo.ts:781`).
- A barra lateral é montada lendo as pastas do disco (`vaultRepo.ts:797-830`), e o filtro de campanha usa os vínculos "participa" (`vinculos.ts:57-70`).

## Pontas soltas
- Não li: a tela da Teia (`GrafoVinculos.tsx`), a regra de conflito do sync em detalhe, `OpcoesIA`, a bancada de testes de interface (`src/amostra/`) e os diagramas em `G/docs/diagrams/`.
- Não abri `%APPDATA%` nem o localStorage. O que digo que fica lá vem do código e do HANDOFF. Não li `.env` nem credenciais, de propósito.
- As contagens do cofre real foram lidas em 08/11 direto do OneDrive e podem incluir arquivo ainda sincronizando.
- `Imagens` e `imagens` são a mesma pasta no Windows, e a pasta antiga `imagens-cenarios/` ainda existe no cofre.