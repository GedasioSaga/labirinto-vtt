# Lobby dos jogadores — plano único (05/11/2026)

> Junta os 5 desenhos por área (Nuvem, App do mestre, Site, Treino, Chat/Segurança), as 5 críticas por área e as 2 críticas cruzadas (Segurança e Integração). Onde os desenhos discordavam, este documento escolhe **um** caminho e diz por quê (seção 11). Este plano é a fonte de verdade: se um desenho antigo disser outra coisa, vale o que está aqui.

**Resposta curta à pergunta "todas as mudanças vão ficar salvas?": sim, com este plano, com uma ressalva que é decisão sua.** A ressalva: no **site**, se o jogador fechar a aba **sem internet** com mudança ainda a caminho, ignorar o aviso de "mudanças não enviadas" **e** depois limpar os dados do navegador, essas poucas mudanças se perdem (no app do mestre isso não acontece: a fila fica no disco). A pergunta 12.20 deixa você escolher entre aceitar esse caso ou travar a edição no site enquanto houver pendência. Mudança que o servidor recusa por regra (op negada) nunca some em silêncio: fica guardada e aparece em vermelho até alguém decidir (5.6). Os desenhos originais ainda tinham 9 jeitos de perder mudança sem aviso (telas que gravam por fora do funil, o Salvar de uma janela antiga desfazendo mudança do jogador, celular e PC do mesmo jogador gravando um por cima do outro, marcador da mochila que some ao reabrir, fila no disco sem troca segura de arquivo, entre outros). Todos foram fechados aqui, e a seção 5.7 lista os casos que sobram e o que acontece em cada um.

---

## 1. Objetivo

Um site grátis, sempre no ar, em `labirintolobby.pages.dev`, onde:

- o jogador entra com a conta Google, vê as fichas da campanha (a dele e as dos colegas) e edita a própria ficha e a mochila;
- o mestre entra com Google no site **e** continua mexendo no app; os dois lados editam a mesma ficha;
- cada mudança é pequena (um campo), fica no histórico com autor e hora e pode ser desfeita;
- nenhuma mudança se perde, nem com a internet caindo no meio da sessão.

v1 = fichas reais, edição pelos dois lados, mochila morando na ficha, login.
v2 = chat (sala e privado) e treino One Piece (luta contra inimigo, 100 lutas, testar build, duelo ao vivo), entregues juntos.

---

## 2. Decisões do usuário

(cópia intacta da lista do grilling de 05/11/2026; são lei)

- Site gratis, endereco fixo labirintolobby.pages.dev (Cloudflare Pages). Sempre no ar. Custo zero.
- Login com Google. Contas de jogador do app (client/src/lib/contasDosJogadores.ts:70, nome+PIN) ganham o e-mail Google; quem entra com aquele Google ve as fichas daquela conta. O MESTRE tambem entra no site com Google e ve/edita tudo.
- Campanha = Pasta de mapas (client/src/lib/pastasDeMapas.ts; <appData>/pastas/<id>/rpg.json; Jogadores principais = uma copia da ficha para todos os mapas da pasta). Cada pasta publicada vira uma campanha no Lobby.
- Ficha E mochila editadas pelos dois lados (mestre no app ou no site; jogador no site). Mochila e moedas passam a morar na FICHA (hoje Token.mochila/Token.moedas em client/src/types/map.ts:1537-1541, no map.json de cada cena); o boneco so mostra; NPC sem ficha continua com mochila no boneco; mapas antigos convertidos ao abrir.
- Conflito: mudanca pequena por campo (+1 Pocao, Vida 30 para 25), nunca a ficha inteira. Campos diferentes nunca brigam. Mesmo campo mudado quase junto: o segundo ve aviso (O mestre acabou de mudar para X) e escolhe.
- Historico mostra quem mudou o que e quando, com DESFAZER: cada um desfaz o seu; o mestre desfaz qualquer um.
- TODA MUDANCA FICA SALVA (pergunta explicita do usuario): nenhuma mudanca se perde. Mudanca so conta como feita depois de gravada no servidor; o servidor guarda o historico completo; o app do mestre mantem a copia completa no disco dele.
- Mesa nunca para: o app funciona sem internet, guarda as mudancas numa fila no disco e manda quando a rede voltar, passando pelo mesmo sistema de conflito.
- Jogador ve TUDO dos colegas da mesma campanha (so ve; nao edita ficha alheia).
- Chat: sala por campanha + privado entre dois. O mestre NAO le o privado dos jogadores.
- Treino (sistema ONE PIECE primeiro): luta de treino turno a turno contra inimigo; simulacao automatica de 100 lutas com % de vitoria; testar build numa copia da ficha; duelo entre jogadores AO VIVO turno a turno. Treino nunca altera a ficha real. Inimigos: so os que o mestre libera no app (segredo nao vaza). Robo simples primeiro (golpe mais forte que pode pagar no alvo mais ferido; melhor defesa).
- Ordem: v1 = fichas reais + edicao pelos dois lados + mochila na ficha + login. Depois chat e treino JUNTOS.
- Testes liberados SO no nucleo de sincronizacao (mescla, fila offline, desfazer, migracao da mochila) e no robo/semente das 100 lutas. Tela sem teste. Nenhum outro teste (regra do usuario).
- Repo GitHub PUBLICO: nada de ficha real nem segredo no repo. Release so por scripts/publicar-versao.cjs (atualizador le latest.json). Escritores trabalham direto na main, sem worktree, em caminhos disjuntos (regra do usuario no Labirinto).
- Usuario e vibe coder; o codigo e escrito por agentes. Disco C: vive no limite (piso 8 GB livres).

---

## 3. Arquitetura

### 3.1 As peças

```
 Navegador do jogador / do mestre                App do mestre (Tauri)
 ┌──────────────────────────────┐               ┌──────────────────────────────────┐
 │ site (client/src/lobby-site) │               │ telas e stores do app            │
 │  + núcleo puro (lib/nuvem)   │               │  + núcleo puro (lib/nuvem)       │
 │  fila de envio no IndexedDB  │               │  + net/nuvem (fila e diário no   │
 └──────────────┬───────────────┘               │    disco, sincronizador)         │
                │ WebSocket, mesma origem       │  + nuvem.rs (Rust: HTTP + cofre) │
                ▼                               └───────────────┬──────────────────┘
 ┌────────────────────────────────────────────┐                 │ HTTPS + Service Token
 │ Cloudflare Access (Google) na frente de     │◄────────────────┘
 │ labirintolobby.pages.dev e *.labirintolobby │
 └──────────────┬─────────────────────────────┘
                ▼
 ┌────────────────────────────────────────────┐
 │ Pages: arquivos do site + functions/api     │  portão: valida o JWT do Access,
 │ (lobby/site/functions/api/[[rota]].ts)      │  monta a identidade, repassa
 └──────────────┬─────────────────────────────┘
                │ binding interno (sem rota pública)
                ▼
 ┌────────────────────────────────────────────┐
 │ Worker labirinto-nuvem (lobby/nuvem)        │  só define as classes; workers_dev=false
 │  DO Campanha (1 por pasta publicada, SQLite)│  único escritor: rev, conflito, log,
 │  DO Diretório (e-mail -> campanhas)         │  mídia, chat e duelo (v2)
 └────────────────────────────────────────────┘
```

Tudo no plano grátis da Cloudflare. **Nada de D1, KV, R2 nem Supabase.**

### 3.2 Onde mora cada dado (um dono por coisa)

| Dado | Dono (verdade) | Cópias | Observação |
|---|---|---|---|
| Ficha publicada (doc completo, inclusive campos do mestre) | DO Campanha, tabela `fichas` | app: `rpg.json` da pasta; site: store em memória | o jogador só recebe a **projeção** (seção 6.4) |
| Histórico de mudanças (log) | DO Campanha, tabela `ops` (só cresce) | app: `<appData>/nuvem/<campanhaId>/diario-AAAA-MM.jsonl` | cópia completa no disco do mestre (lei) |
| Mudança local ainda não confirmada | app: `fila.jsonl`; site: IndexedDB | — | só sai da fila com o "ok" do servidor |
| Conflito aberto | app: linha em `fila.jsonl`; site: IndexedDB; servidor: `recusadas` | — | sobrevive a fechar o app/aba |
| Ficha de pasta **não** publicada, ficha de NPC, mapas, cenas, tokens | app (disco do mestre) | — | nunca sobe |
| Mochila e moedas de personagem com ficha | **a ficha** (`Personagem.mochila`, `Personagem.moedas`) | espelho em memória em `Token.mochila/moedas` | NPC sem ficha continua com a mochila no boneco |
| Membros da campanha (e-mail, contaId, nome, papel) | DO Campanha, tabela `membros` | DO Diretório (índice e-mail -> campanhas) | origem: contas do app + e-mail do mestre |
| E-mail Google do jogador | app: `<appData>/contas/contas.json` (campo novo `email`) | DO `membros` | nunca no repo |
| Imagens | DO Campanha, tabela `midia` (pedaços de 512 KiB) | app: `<appData>/pastas/<id>/midia/` | só por hash `midia:<sha256>.<ext>` |
| Credencial do app (Service Token) | Gerenciador de Credenciais do Windows, via Rust | — | nunca na webview, nunca em arquivo |
| Chat (v2) | DO Campanha, tabelas `chat_sala` e `chat_dm` | app: só a sala, em `chat-sala.jsonl` | o privado nunca vai para o app do mestre |
| Duelo ao vivo (v2) | DO Campanha, tabela `duelos` | — | treino nunca grava na ficha real |
| Rascunho de build do treino (v2) | navegador (localStorage, por campanha e ficha) | — | marcado como rascunho; nunca vira op |
| Navegação do site | URL | — | — |

### 3.3 Quem é dono de que código (um dono por pasta; escritores em caminhos disjuntos na main)

| Pasta / arquivo | Área dona | O que tem |
|---|---|---|
| `client/src/lib/nuvem/` | **Nuvem** | núcleo puro: tipos, caminho+esquema, aplicar, diferenças, conflito, lote, desfazer, permissão, projeção, fila (com armazenamento injetado), limites, `VERSAO_DO_FORMATO`. **Sem** `@tauri-apps`, sem store, sem API da Cloudflare. Única fonte do formato da operação. |
| `lobby/nuvem/` | Nuvem | Worker com DO Campanha e DO Diretório, `wrangler.toml` sem segredo, `fumaca.mjs` |
| `lobby/site/` | Site | projeto Pages: `functions/api/[[rota]].ts` (portão, escrito pela Nuvem dentro desta pasta, ver F-W2), `wrangler.toml` do Pages |
| `desktop/src-tauri/src/nuvem.rs` | Nuvem (executor: `programador-rust`) | ponte HTTP + cofre |
| `desktop/src-tauri/capabilities/default.json` | App (executor: `engenheiro-desktop`) | `fs:allow-rename` |
| `client/src/lib/mochila/` | App | junção e espelho da mochila, puros |
| `client/src/net/nuvem/` | App | tudo do app que toca disco ou store: fila no disco, diário, sincronizador, emissor, aplicar remoto, publicar, migração da mochila |
| `client/src/stores/nuvemStore.ts` | App | estado das campanhas no app |
| `client/src/components/nuvem/` | App | telas do app; `AvisoDeConflito.tsx` **puro por props**, reaproveitado pelo site |
| `client/lobby-site/index.html`, `client/src/lobby-site/`, `client/vite.lobby.config.ts`, `client/public-lobby/` | Site | site inteiro |
| `client/src/lib/treino/`, `client/src/stores/batalhaFabrica.ts` | Treino (v2) | motor fora do app, robô, 100 lutas, duelo puro |
| `scripts/conferir-repo-publico.cjs`, etapa Lobby de `scripts/publicar-versao.cjs` | Segurança / Site | guarda do repo público e publicação |

Pastas descartadas para não haver dois núcleos: `client/src/lobby/` (desenho App) e `client/src/lib/sincronia/` (desenho Site). O código do site **não** fica numa pasta que tenha código com Tauri: a guarda de build vale só em `client/src/lobby-site/` e nas pastas que ele importa.

---

## 4. Modelo de dados

### 4.1 Mudanças no tipo `Personagem` (`client/src/lib/personagem.ts:107`)

- `mochila?: CarriedItem[]` e `moedas?: number` (novos). `CarriedItem.id` é a vaga (estável, `crypto.randomUUID`); `CarriedItem.itemId` é o item do acervo (empilhável soma na vaga do mesmo `itemId`, `client/src/lib/items.ts:212`). `CarriedItem.imagem` já é `midia:<id>` (`client/src/types/map.ts:707-711`), não precisa de conversão.
- `historico` **não** é sincronizado: o log do servidor substitui. O app continua gravando o dele localmente; op remota numérica ganha uma linha nele com o nome do autor.
- `paraOFio` (`personagem.ts:283`) passa a tirar também `mochila` e `moedas` — **só para a sala LAN** (o jogador da sala recebe a mochila pelo espelho do token). O Lobby usa outra função, `projetarParaJogador` (seção 6.4), que **mantém** a mochila.

### 4.2 Marcador da migração da mochila

No `rpg.json` da pasta (ou no `adventure.json` de aventura sem pasta): `mochilaMigrada: 1` (número de versão). Fica no **nível da pasta**, não na ficha, porque `readCarriedItems` devolve `undefined` para lista vazia (`items.ts:114-122`) e um marcador "mochila definida mesmo vazia" sumiria ao reabrir. Com o marcador da pasta, **toda** ficha da pasta é tratada como migrada, inclusive ficha criada depois (nasce com a mochila do token ligado, ou vazia).

### 4.3 Conta de jogador (`client/src/lib/contasDosJogadores.ts:70`)

Campo novo `email?: string` (minúsculas, sem espaços). Um nome só (o desenho App chamava de `emailGoogle`; fica `email`).

### 4.4 Arquivos do app (`<appData>/nuvem/<campanhaId>/`)

| Arquivo | Forma | Regra |
|---|---|---|
| `fila.jsonl` | só acrescenta linha: `{t:'op',...}`, `{t:'ack',opId,rev}`, `{t:'conflito',...}`, `{t:'negado',opId,motivo}`, `{t:'resolvido',opId}` | linha cortada no fim é ignorada; compactado (reescrito) só quando tudo foi confirmado e passa de 256 KB |
| `diario-AAAA-MM.jsonl` | só acrescenta: cada `OpGravada` confirmada, na ordem de `rev` | cópia completa do log; nunca recebe snapshot no lugar de ops |
| `estado.json` | `{campanhaId, pastaId, revRecebida, revNoRpg, clienteId, versaoDoFormato}` | pequeno, gravado pela fila única de gravação |
| `rpg.json` da pasta | o de sempre | atualizado sozinho ~1 s depois (seção 5.6) |

Lista das campanhas publicadas: `<appData>/nuvem/campanhas.json`.

### 4.5 SQLite do DO Campanha

- `meta(chave PK, valor JSON)`: campanhaId, nome, sistema publicado (JSON do `SistemaDeRpg`, em pedaços se passar do teto da linha), rev atual, versão do esquema.
- `membros(contaId PK, email UNIQUE, nome, papel 'mestre'|'jogador', estado 'ativo'|'removido')`. O mestre tem `contaId = 'mestre'`.
- `fichas(id PK 'pers_<uuid>', doc JSON completo, visivel 'mesa'|'treino'|'mestre', dono contaId, apagada INT, rev INT)`.
- `ops(rev INTEGER PK, opId UNIQUE, loteId, fichaId, caminho TEXT, acao, valor JSON, delta REAL, antes JSON, baseRev, autorContaId, autorNome, origem 'app'|'site'|'mesa', clienteId, atestadoPeloApp INT, quando INT, quandoCliente INT, desfaz TEXT, resolve TEXT)` com índice `(fichaId, rev)`. Nunca apagada nem editada.
- `recusadas(opId PK, op JSON, motivo 'conflito', revAtual, quando, resposta JSON, autorContaId)` — **só conflito**. `resposta` (o `conflito` dado) e `autorContaId` vieram da N2: o reenvio do mesmo `opId` recebe a mesma resposta e um `opId` alheio é negado sem vazar nada (8.1.1, item 2). Op negada vira só contador em `cotas`, sem payload (para não dar escrita grátis a quem não tem permissão); quem guarda a op negada é o **cliente** que a mandou, na fila, até alguém decidir (5.6). Op `adiado` (cota/ritmo) não é negada: não conta aqui.
- `cotas(chave PK 'conta:<id>:<dia>' | 'campanha:<dia>', ops, bytes, midiaBytes, negadas, paceAt)` — limitador persistido (sobrevive à hibernação).
- `midia(hash, parte, bytes BLOB) PK(hash,parte)` + `midia_meta(hash PK, tipo, tamanho, partes, enviadoPor, quando)`.
- v2: `chat_sala(id PK ordenável, autorContaId, texto, mencoes, criadaEm, apagadaEm, idDoCliente, UNIQUE(autorContaId,idDoCliente))`, `chat_dm(id, par 'a|b', ...)` em tabela própria (fica fora de qualquer exportação), `lidas(contaId, canal, ateId)`, `duelos(id PK, status, jogadorA, jogadorB, estadoJson, seq, versaoDoMotor, prazo INT NULL, apagarEm INT NULL, atualizadoEm)`.

DO Diretório: `campanhasDoEmail(email, campanhaId, papel)`, atualizado pelo DO Campanha quando `membros` muda.

### 4.6 A operação (tipo único, em `client/src/lib/nuvem/tipos.ts`)

```
Op = {
  opId: uuid do cliente            // idempotência
  loteId: uuid                     // ops geradas no mesmo instante
  atomico?: true                   // troca/pagamento de itens e ficha trocada inteira (tudo ou nada; desvio da N1, 8.1.1 item 4)
  fichaId: 'pers_<uuid>'
  caminho: string[]                // tabela 4.7
  acao: 'definir' | 'somar' | 'criar' | 'apagar' | 'ordenar'
  valor?: Json   delta?: number
  baseRev: number                  // rev de onde saiu a BASE que o autor viu (não a rev de agora)
  clienteId: uuid                  // uma por instalação do app / por navegador+conta
  quandoCliente: number            // só para mostrar
  desfaz?: opId   resolve?: opId
  autorDeclarado?: contaId         // só aceito com identidade do app (mesa LAN)
}
OpGravada = Op + { rev, antes, autorContaId, autorNome, origem, atestadoPeloApp, quando }
```

O desenho App (`de`/`para`, troca condicional) e o desenho Site (`antes`/`depois`, `baseSeq`) foram descartados (seção 11). O "de" que o App queria mostrar no aviso vem do `antes` da `OpGravada` concorrente.

### 4.7 Tabela única de caminhos (com esquema)

| Caminho | Ações | Tipo e teto | Quem escreve |
|---|---|---|---|
| `[]` (ficha inteira) | criar, apagar | doc ≤ 256 KiB; retrato e imagem de cada cartão e subcartão só `midia:` ou vazio (Si7) | só mestre |
| `['nome']` | definir | string ≤ 120 | dono, mestre |
| `['descricao']` | definir | string ≤ 16 KiB | dono, mestre |
| `['retrato']` | definir | `ehRefDeMidia` (só `midia:`, Si7) ou vazio | mestre (v1); dono só se a pergunta 12.4 liberar |
| `['etiquetas', etiqueta]` | criar, apagar | string ≤ 60, ≤ 30 itens | dono, mestre |
| `['escolhas', k]` | definir | string ≤ 200 | dono, mestre |
| `['recursos'\|'maximos'\|'modificadoresDosRecursos'\|'atributos'\|'modificadoresDosAtributos', k]` | definir | `Number.isFinite`, faixa ±1e7 | dono, mestre |
| `['cartoesAtivos', cartaoId]` | definir | boolean | dono, mestre |
| `['abas', aba, cartaoId]` | criar, apagar | cartão ≤ 32 KiB; imagem dele e dos subcartões só `midia:` ou vazio (Si7) | dono, mestre |
| `['abas', aba, '#ordem']` | ordenar | lista de ids existentes | dono, mestre |
| `['abas', aba, cartaoId, 'nome'\|'aMao'\|'extras'\|'modificadores'\|'atributos']` | definir | por tipo | dono, mestre |
| `['abas', aba, cartaoId, 'imagem']` | definir | `ehRefDeMidia` (só `midia:`, Si7) ou vazio | como retrato |
| `['abas', aba, cartaoId, 'campos', campoId]` | definir | string ≤ 8 KiB | dono, mestre |
| `['abas', aba, cartaoId, 'subcartoes', subId, ...]` | recursivo | idem | dono, mestre |
| `['mochila', vagaId]` | criar, apagar | item ≤ 4 KiB; criar com `itemId` empilhável já presente vira `somar` na vaga existente | dono, mestre (política 12.3) |
| `['mochila', vagaId, 'quantidade']` | somar | usa `quantidadeDe` (ausente = 1) e o teto `ITEM_QUANTIDADE_MAX` | dono, mestre |
| `['mochila', vagaId, campo]` | definir | por tipo (`DadosDoItem`) | dono, mestre |
| `['moedas']` | somar | finito, 0 ≤ x ≤ teto do sistema | dono, mestre |
| `['dbt', chaveDeTopo]` | definir | atômico; **fora da v1**: pasta DBT não pode ser publicada na v1 (12.21), porque dois campos do mesmo bloco brigariam | dono, mestre |
| `['dono']`, `['combate']`, `['soCenario']`, `['nomeDoJogador']`, `['notaDoMestre']`, `['dbt','npc']` | definir | por tipo | **só mestre**; nunca difundido a jogador |

Regras de caminho (em `caminho.ts`): cada segmento `/^[A-Za-z0-9_:.#-]{1,80}$/` **e** diferente de `__proto__`, `prototype`, `constructor`. Leitura com `Object.hasOwn`, escrita em cópia feita com `structuredClone`, `JSON.parse` com reviver que descarta essas três chaves em qualquer nível do valor. Op fora da tabela = `negado`.

---

## 5. Protocolo

### 5.1 Operação por campo

- **Como nasce no app:** só em dois funis. (1) `donoDosPersonagens.gravar`, ramo da pasta (`client/src/stores/adventureStore.ts:975`), por onde passam `salvarPersonagem`, `ajustarPersonagem`, `adicionarPersonagens`, `trocarImagensDosPersonagens`, `apagarPersonagem`, o dano da batalha (`mesaDaAventura.ts:71`) e as variações reescritas por `sincronizarVariacoes`. (2) `editarRpgDaPasta` (`client/src/stores/rpgDaPasta.ts:33`), comparando o lido com o novo — cobre Mundo do Livro (`mundoDoLivroStore.ts:124`), `PaginaItens.tsx:131,282`, `comum.tsx:97,111`, `LoadMapScreen.tsx:382`, mesmo com a pasta fechada. `mudarRpgDaPasta` (`adventureStore.ts:1769`) **não** emite (senão a mesma mudança sai duas vezes). Carregar `rpg.json` do disco **nunca** é comparado como mudança do mestre.
- **Filtro do emissor:** só fichas `tipo:'jogador'` sem `combate.invocadoNaCena`. NPC não gera op (não vaza e não gasta cota). Troca de tipo jogador↔npc vira `apagar`/`criar` de `[]`.
- **A base certa (o erro mais grave dos desenhos):** a op sai de `diferencas(baseQueOAutorViu, rascunho)` com `baseRev` = rev dessa base, e é aplicada sobre a ficha de agora. Três lugares mudam para isso:
  - Salvar da janela do mestre (`FichaDePersonagemDialog.tsx:95` + `ajusteDaFicha.ts:440`): guarda a ficha e a rev de quando a janela abriu; no Salvar calcula as ops contra essa base e aplica sobre a atual. Se o mesmo campo mudou nos dois lados, aparece o aviso.
  - Edição do jogador pela sala LAN (`aplicarPartes`, `net/edicaoDoPersonagem.ts:168`): o host guarda, por conexão, a última ficha que **enviou** àquele jogador (lista do jogador, `hostSession.ts:7726`) e usa como base; o autor vira `autorDeclarado` = contaId da conta na sala (`hostSession.ts:1396-1399`).
  - Site: a casca registra a rev no momento em que o Editar abre (prop nova `aoAbrirEdicao` no `PlayerFicha`) e a usa como `baseRev`.
- **Ações:** número e texto da ficha = `definir` (o Ajuste de hoje já é valor absoluto, `ajusteDaFicha.ts:48-57`); quantidade de item e moedas = `somar`; cartão, item, etiqueta e a ficha inteira = `criar`/`apagar`; ordem de cartões = `ordenar`.

### 5.2 Revisão, conflito e aviso

- O DO numera cada op aceita com `rev` global da campanha (crescente, sem buraco).
- **Conflito:** existe op gravada da mesma ficha com `rev > baseRev`, caminho que **sobrepõe** o da op nova (igual, ou um é prefixo do outro — por exemplo, apagar o cartão × mudar um campo dele; apagar o item × quantidade dele) e **chave de autoria diferente**. Chave de autoria = `(clienteId, autorEfetivo)`. Assim:
  - a fila offline do mesmo aparelho passa em sequência;
  - o mesmo jogador no celular e no PC (clienteIds diferentes) **conflita** e vê aviso;
  - o mestre no app e no site conflita consigo ("Você (no app) mudou para X");
  - dois jogadores na mesa LAN (mesmo app, `autorDeclarado` diferente) conflitam.
- Op em ficha apagada = conflito com a escolha "recriar".
- `baseRev > revAtual` ou `< 0` = `negado`.
- **Resposta ao autor:** `conflito{opId, valorAtual, quem (nome), quando, revAtual}`. A tela mostra "O mestre acabou de mudar Vida para 25. Você pôs 28." com [Ficar com 25] (grava `{t:'resolvido'}` na fila, nada vai ao servidor), [Usar 28] (op nova com `baseRev = revAtual` e `resolve = opId`) e, só em `somar`, [Somar o meu também].
- **Lote:** ops do mesmo instante vão no mesmo `loteId`. Por padrão o servidor aplica **op por op** (campo diferente nunca é derrubado por conflito de outro campo). Só `atomico:true` (troca e pagamento de itens, gerados juntos por `applyItemsInScene`, e, desvio vindo da N1, o `apagar`+`criar` de `[]` da ficha trocada inteira, 8.1.1 item 4) é tudo-ou-nada dentro do mesmo `transactionSync`.
- **Aviso no app:** só para op do mestre recusada; ops pendentes na mesma chave do mesmo lote viram um aviso só; op remota numa chave que tem op local pendente espera a resposta do servidor. O aviso não trava a mesa. Lista "Mudanças para decidir" no app.

### 5.3 Histórico e desfazer

- Histórico = consulta a `ops` por ficha (rev decrescente, 50 por página), passada pela projeção do jogador. Mostra autor (nome; "atestado pelo app" quando veio da mesa LAN), de → para, quando, e se já foi desfeita.
- `Desfazer(opId)`: o servidor monta a inversa **só** a partir da `OpGravada` alvo (ignora caminho/valor que vierem junto): `definir` → definir `antes`; `somar` → somar `-delta`, ou definir `antes` se o teto cortou o valor; `criar` → `apagar`; `apagar` → `criar` com `antes`. A inversa usa `baseRev = rev do alvo` e passa pelo mesmo detector: se alguém mudou depois, vem "Depois disso, Fulano mudou para Z. Desfazer volta para W. Confirmar?"; a confirmação vira op com `baseRev` atual.
- Permissão: jogador desfaz só op cujo autor efetivo é ele **e** só se ainda tem permissão de escrita na ficha hoje; mestre desfaz qualquer uma. Desfazer o desfazer = refazer. Item que outro já tirou = "já foi tirado", nada a gravar.
- `resolve` só pode citar recusada do mesmo autor.
- **No v1 o painel de desfazer fica no site** (o mestre também entra lá). O app mostra o histórico local como hoje (pergunta 12.5).

### 5.4 Mensagens

**Site ↔ DO, WebSocket na mesma origem** `wss://labirintolobby.pages.dev/api/c/:campanhaId/ws` (Hibernation; ping por `setWebSocketAutoResponse`, que não acorda nem cobra).

- Cliente → servidor: `ola{desdeRev|null, v:VERSAO_DO_FORMATO, clienteId}`; `ops{lote ≤ 50 ops, frame ≤ 64 KiB}`; `desfazer{opId, novoOpId, confirmar?}`; `historico{fichaId, antesDeRev?, limite}`.
- Servidor → cliente: `estado{rev, fichas projetadas, membros projetados, eu}` (só em `desdeRev:null` ou mais de 1.000 ops atrás — **só para o site**); `ops{desde, ate, lista}`; `ack{opId, rev}`; `conflito{...}`; `negado{opId, motivo}` (definitivo: fora do esquema, sem permissão, acima do teto do caminho ou da mídia, doc > 256 KiB, `baseRev` inválida — repetir não adianta); `adiado{opId, motivo:'cota'|'ritmo', tentarDepoisDe}` (temporário: a op fica na fila e vai de novo sozinha; **não** conta como violação); `aplicada{op projetada}`; `historico{...}`; `versao{versaoDoFormato}`.

**App ↔ DO, HTTPS pelo Rust** (Service Token; nada de WebSocket no app na v1):

| Rota | Uso |
|---|---|
| `GET /api/eu` | quem sou, campanhas |
| `POST /api/c/:id/publicar` | cria campanha, membros, meta e **só as fichas que ainda não existem**; fichas que já existem sobem como ops normais (diferença contra a base) |
| `POST /api/c/:id/membros` | reenviado sozinho quando mudam contas, e-mail ou dono de ficha publicada |
| `POST /api/c/:id/ops` | lote; resposta por op (ou do lote atômico) |
| `GET /api/c/:id/desde/:rev?limite=500` | **sempre ops, nunca snapshot**, paginado até alcançar a rev atual (o diário no disco não pode ter buraco) |
| `PUT`/`GET /api/c/:id/midia/:hash` | mídia (seção 6.6) |
| `GET /api/c/:id/exportar?deRev&ateRev` | exportação paginada (lista fechada de tabelas; nunca `chat_dm`) |
| v2: `GET /api/c/:id/chat/sala?desde=<cursor>` | cópia da sala, com lápides alteradas desde o cursor |

O enum de rotas do Rust (`nuvem.rs`) cobre exatamente essas, com URL base fixa no binário; v2 acrescenta a variante `SalaDoChat`.

**Rotas do site:** `GET /api/eu`, `WS /api/c/:id/ws`, `GET /api/c/:id/midia/:hash`, `GET /api/versao`. As rotas `/api/campanhas/...` do desenho Site e `/api/midia/:hash` sem campanha foram descartadas.

### 5.5 Snapshot e reconexão

- Site: `ola{desdeRev}` com a última rev aplicada; o servidor manda as ops faltantes, ou `estado` se estiver mais de 1.000 atrás. Depois o site manda a fila pendente em ordem.
- App: ao abrir e a cada ciclo, `GET /desde/:revRecebida` paginado; grava no diário e no `rpg.json`; **só então** avança `revRecebida`/`revNoRpg` em `estado.json`. Queda no meio = busca de novo, sem duplicar (aplicar a mesma op duas vezes dá o mesmo resultado; o diário ignora rev repetida).
- **Eco:** o app recebe também as próprias ops (mesmo `opId`); aplica pela mesma função, o que não muda nada.
- Ritmo do app: a cada 5 s com campanha aberta e janela visível; com a janela minimizada ou sem campanha aberta, só ao focar a janela ou a cada 10 min (a duração do DO é o recurso mais apertado, seção 7). Sem rede: espera crescente 2, 5, 10, 30, 60 s.

### 5.6 Fila offline

- **App (mesa nunca para):** a mudança vai para `fila.jsonl` (acrescentar linha, `writeTextFile` com `append`, plugin-fs 2.5.1) **antes** de aparecer como "salvando…". Uma cadeia de promessas por arquivo (uma gravação por vez). Sem rede, a fila cresce; na volta, primeiro puxa `desde`, depois envia em ordem; ack remove da lista de pendentes; conflito vai para "Mudanças para decidir" **e fica gravado na fila** até ser resolvido. A fila **não** funde ops (cada passo fica no histórico; a economia de cota vem do lote).
- **`rpg.json` no app:** numa campanha publicada, gravado sozinho ~1 s depois da mudança por um **gravador leve** (lê o disco, aplica só as ops, grava com `writeTextFileSafely`, sem `.anterior` e sem copiar mídia), dentro de **uma fila única por pasta** que também envolve o ler-mudar-gravar inteiro de `editarRpgDaPasta` e o Salvar. Mudança remota não marca `pastaSuja`. O Descartar não desfaz mudança já aceita pelo servidor.
- **Ao abrir o app:** reaplica no `rpg.json` e no store as ops pendentes e as confirmadas com `rev > revNoRpg` (seguro, idempotente), reapresenta os conflitos abertos.
- **Site:** sem rede, a edição **nova** fica pausada (faixa "Sem internet: suas mudanças anteriores estão guardadas e vão assim que voltar"); o que já estava a caminho fica no IndexedDB, **uma entrada por opId**, numa base por `e-mail + campanha` (duas abas não se atropelam; dois logins no mesmo navegador não misturam fila). Reenvio com o mesmo `opId`. Conflito ou recusa vindos do reenvio ficam numa lista "precisam da sua decisão", mostrada na faixa em qualquer tela. Com pendência, fechar a aba dispara `beforeunload`. Cada entrada leva a versão do formato; numa troca de versão o site esvazia a fila (o Worker aceita N-1) antes de pedir "recarregue".
- **Validação antes de aplicar (app e site):** o emissor passa cada op pelo mesmo `ESQUEMA_DO_CAMINHO` e pelos mesmos tetos que o servidor usa (4.7, `limites.ts`) **antes** de aplicar no store e de acrescentar na fila. Op que não passa não é aplicada: a tela mostra o motivo na hora ("Texto grande demais: máximo 16 KiB") e o valor anterior fica.
- **Op negada pelo servidor** (`negado`, mesmo depois da validação local — por exemplo, permissão mudou ou versão diferente): nunca é descartada em silêncio. Vira linha `{t:'negado',opId,motivo}` na fila (app: `fila.jsonl`; site: IndexedDB), entra em "Mudanças para decidir" / "precisam da sua decisão" com aviso **vermelho** e o motivo em português, e fica lá até alguém escolher: [Desfazer aqui] (o app volta o campo ao valor do servidor, e o gravador leve regrava o `rpg.json`) ou [Guardar como nota] (o valor vai para um arquivo `negadas.jsonl` em `<appData>/nuvem/<campanhaId>/`, nunca apagado). Enquanto não decide, o app mostra a ficha com o valor local e o selo "não aceito pelo servidor".
- **Op adiada** (`adiado`, cota ou ritmo): fica pendente na fila e é reenviada sozinha a partir de `tentarDepoisDe`; indicador "Lobby: N esperando (limite do dia)".
- A mesma função pura de fila (`criarFila(armazenamento)`) serve aos dois: o app injeta o adaptador de disco, o site o de IndexedDB.

### 5.7 Garantia de que toda mudança fica salva

| Situação | O que acontece | Mudança se perde? |
|---|---|---|
| App cai logo depois da mudança | está em `fila.jsonl` (linha acrescentada antes de aparecer); ao abrir, reaplica e reenvia | não |
| App cai no meio da gravação da fila | `append` só corta a última linha; o resto fica | só a linha cortada, que nunca apareceu como feita |
| App cai antes de atualizar o `rpg.json` | reaplica da fila/diário ao abrir | não |
| Internet cai durante a sessão | fila no disco; reenvio na volta; conflito vira aviso | não |
| Mesmo campo mudado por dois | o segundo recebe aviso; a recusada fica salva em `recusadas` e na fila até decidir | não |
| Mestre salva janela aberta antes da mudança do jogador | ops contra a base da janela; só o que ele mudou vai; se o mesmo campo mudou, aviso | não |
| Tela do Mundo do Livro / página Itens grava | passa por `editarRpgDaPasta`, que emite | não |
| Celular e PC do mesmo jogador | clienteIds diferentes → aviso | não |
| Desfazer | op nova no log; o original continua | não |
| Servidor fora / cota do dia estourada | servidor responde `adiado` (não `negado`); app guarda na fila e reenvia sozinho; site mostra "servidor descansando" e guarda o pendente. A conta do mestre e o Service Token não têm teto por conta (6.5), então a mesa não para por cota no meio da sessão | não (atrasa) |
| Servidor recusa a op por regra (`negado`: fora do esquema, sem permissão, acima do teto, mídia acima de 300 MB, doc > 256 KiB, `baseRev` inválida) | o cliente já valida antes de aplicar, então é raro; se vier, a op fica na fila como "precisa da sua decisão", aviso vermelho com o motivo, nunca descartada sozinha (5.6) | não (fica guardada até alguém decidir) |
| Disco do mestre cheio | falha ao acrescentar na fila = aviso vermelho e a mudança **não** aparece como feita | não (não aceita) |
| App ficou dias fechado | `desde` paginado, nunca snapshot; diário sem buraco | não |
| Aba do site fechada **offline** com pendência, aviso ignorado e dados do navegador limpos | único caso fora do controle do sistema; a edição nova já fica pausada offline, então é só o que estava a caminho | **sim, esse pouco** — ressalva na resposta curta do topo; decisão sua na pergunta 12.20 (aceitar ou travar a edição no site enquanto houver pendência) |
| Chat privado | não vai para o disco do mestre, de propósito | fica só no servidor |

O servidor nunca apaga `ops` nem `recusadas`. "Nada é apagado sem ordem do usuário."

---

## 6. Autenticação e autorização

### 6.1 Login

- **Cloudflare Access** (Zero Trust Free, até 50 usuários) cobrindo `labirintolobby.pages.dev` e `*.labirintolobby.pages.dev` (prévias), com o passo de apagar o curinga do subdomínio quando o painel pedir.
- Provedor: Google. Se o Google não estiver disponível no Free (não confirmado), **One-time PIN** por e-mail do próprio Access. Nada mais muda: a identidade continua sendo o e-mail.
- **Política A (pessoas):** grupo do Access com os e-mails convidados (recomendado; quem não é membro nem invoca a Function e não gasta cota). Alternativa: "qualquer Google" (pergunta 12.1). A checagem de membro no DO continua sendo a fronteira de verdade.
- **Política B (app):** Service Auth com o Service Token do app.

### 6.2 O portão (`lobby/site/functions/api/[[rota]].ts`)

- Valida `Cf-Access-Jwt-Assertion`: só `RS256`, `kid` presente nas certs do time (cache), `iss = https://<time>.cloudflareaccess.com`, `aud` contém o AUD, `exp` e `nbf`. Nunca usa `Cf-Access-Authenticated-User-Email`.
- Identidade: claim `email` (pessoa) **ou** `common_name` sem `email` (Service Token, mapeado ao mestre por `MAPA_DO_APP`, gravado com `wrangler secret put`). Os dois juntos = 401.
- Apaga qualquer `X-Identidade` que venha do cliente e grava a sua com `headers.set`. Confere `Origin` em POST e no upgrade do WS (o app não manda Origin de navegador: passa pelo Rust).
- Loga só rota, status e contaId; nunca o pedido nem os cabeçalhos.
- Modo dev sem Access: constante de compilação do `wrangler dev`, nunca variável de produção.
- `_routes.json` com `include: ['/api/*']`: arquivo estático não invoca a Function.
- Prévias do Pages **sem** binding de DO (ou com namespace separado).

### 6.3 O Worker dos DOs (`lobby/nuvem/`)

`workers_dev = false`, nenhuma rota, `fetch` padrão devolve 404. Só é alcançado pelo binding do portão. Plano B, se o Pages não repassar WebSocket ao DO por `script_name` (não confirmado): service binding Pages → Worker → DO, ainda na mesma origem. **Nunca** `workers.dev` aberto.

### 6.4 Autorização no DO (a cada mensagem, não só no upgrade)

- Não membro (ou removido) = mesma resposta de "não existe".
- **Jogador:** lê fichas `visivel:'mesa'` pela projeção; escreve só em ficha cujo `dono` (lido do doc **completo** no servidor) está nas contas dele; nunca em caminho do mestre; nunca cria/apaga ficha; histórico e desfazer só de ficha que ele vê.
- **Mestre:** tudo.
- `projetarParaJogador(doc)` (Lobby): tira dono, combate, soCenario, nomeDoJogador, notaDoMestre e dbt.npc; **mantém mochila e moedas**; acrescenta fora do objeto `ehMinha` e o nome da conta dona (o site precisa saber o que pode editar).
- `projetarOpParaJogador(op, visivel)`: null se a ficha não é `mesa` (ou é `treino` fora da projeção do treino); se o caminho é prefixo de campo do mestre ou vice-versa (inclusive `[]` e `['dbt']`), aplica a mesma remoção a `valor` e `antes`. Usada em quatro lugares: snapshot `estado`, difusão `aplicada`, `historico` e `exportar` para não mestre.
- `membros` projetados para jogador: `{contaId, nome, papel}`, sem e-mail. Só `/api/eu` devolve o próprio e-mail. O histórico mostra nome, nunca e-mail.
- Remover membro ou trocar dono: o DO fecha os sockets daquele e-mail (tag no `acceptWebSocket`) e passa a negar já na mensagem seguinte.
- `autorDeclarado` só é aceito com identidade do Service Token e com contaId que está em `membros`; fica marcado `atestadoPeloApp`.

### 6.5 Limites (em `client/src/lib/nuvem/limites.ts`, aplicados pelo DO)

Por conta: ritmo GCRA reaproveitando `takeChatTurn` (`client/src/lib/chat.ts:187`), com `paceAt` gravado em `cotas` (sobrevive à hibernação e vale para os vários sockets da conta); ≤ 3 sockets; teto diário de ops, bytes gravados e MB de mídia. Por campanha: teto diário de ops e ≤ 36 sockets (3 por conta × 12 contas, seção 7). Vale para **todo** frame (não só envio). Depois de N violações, o socket é fechado e novo upgrade é recusado por alguns minutos; **violação** = frame malformado ou op `negado`, nunca op `adiado` por cota/ritmo (cota estourada só adia, 5.4). **A conta do mestre (`contaId 'mestre'`) e o Service Token não têm teto diário por conta** (quase todas as ~5.500 ops/dia da seção 7 saem do app do mestre): para eles vale só o teto da campanha. Números iniciais (ajustáveis num arquivo só): conta de jogador 2.000 ops/dia e 5 MB/dia; campanha 10.000 ops/dia (~1,8× a estimativa da seção 7, que já é pessimista; o limite de cima é o de linhas gravadas: no teto, ~62.500 das 100.000 do dia, seção 7); frame 64 KiB; lote 50 ops; op ≤ 24 KiB (sempre abaixo do frame). Tetos da campanha revistos em 05/11/2026 com a seção 7 para 12 contas; o `limites.ts` ainda está com os da conta antiga (8.000 e 20).

### 6.6 Mídia

PUT confere sha256 **e** o tipo pelos bytes (`tipoDosBytes`, `midia.ts:57-60`) contra a extensão; só `webp|png|jpg|gif`, nunca SVG; ≤ 2 MiB; pedaços de 512 KiB; ≤ 300 MB por campanha. GET com `Cache-Control: private, max-age=31536000, immutable`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; sandbox`. Na v1 só o app (mestre) sobe mídia.

### 6.7 Site e app contra XSS

- Site: texto só como filho React; CSP no `client/public-lobby/_headers` (`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'`), `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Robots-Tag: noindex`. Um `_headers` só.
- Guarda de build do site: falha se aparecer `@tauri-apps/*`, `pixi.js` ou `three`.
- `scripts/conferir-repo-publico.cjs`: gitleaks, e-mail que não é `@example.com`, nome de arquivo de dado real, `.dev.vars*` ou qualquer arquivo em `.wrangler/` rastreado pelo git (falha), print novo em `docs/verification` (falha, salvo a decisão 12.12), e `dangerouslySetInnerHTML|innerHTML|insertAdjacentHTML` em **todo** `client/src` (o app também recebe texto da internet agora) e no `client/dist-lobby`.
- CSP no app do mestre (`tauri.conf.json:24`, hoje `null`): fatia própria depois da v1 (pergunta 12.11).

---

## 7. Cotas do plano grátis (1 mestre + 11 jogadores = 12 contas, 1 sessão de 4 h por dia)

Refeita em 05/11/2026 para a pasta One Piece (11 jogadores e o mestre; a primeira conta usava 1 + 6). Os limites diários do plano grátis são os mesmos da primeira versão desta seção (não foram reconferidos nas docs nesta revisão): Workers/Functions 100.000 req; DO 100.000 req (mensagem WS recebida conta 1/20; enviada e ping não contam); SQLite 100.000 linhas gravadas e 5.000.000 lidas; duração do DO 13.000 GB-s; armazenamento 5 GB; Access 50 usuários.

Hipóteses:

- App do mestre aberto com a campanha durante a sessão (consulta a cada 5 s) e, para ficar do lado pessimista, aberto e minimizado no resto do dia (consulta a cada 10 min, 5.5): ~120 consultas a mais.
- **~5.500 ops no dia** (batalha incluída, em ~730 lotes de ~1 s): as 3.000 da primeira conta × 11/6, crescendo junto com as fichas de jogador. É pessimista: a sessão continua com 4 h e, com mais gente, cada um age menos vezes; o real deve ficar entre 3.000 e 5.500.
- Cada uma das 12 pessoas abre o site (ou reconecta) ~6 vezes no dia = 72 aberturas; ~100 mensagens WS recebidas por pessoa = 1.200.
- ~75 imagens por campanha (as 40 da primeira conta × 11/6: retrato e cartões crescem com as fichas), contadas como se cada pessoa baixasse todas todo dia (na prática é uma vez por aparelho, `immutable`, 6.6).
- Cada op grava ~6 linhas: a própria linha em `ops`, os 2 índices dela (`opId` e `(fichaId, rev)`), a ficha, a rev em `meta` e o contador da campanha em `cotas`; cada frame recebido grava mais 1 (`paceAt`, 6.5).

| Recurso (limite diário Free) | Conta | Estimativa | % |
|---|---|---|---|
| Workers/Functions (100.000 req) | app: 2.880 `desde` na sessão + 120 fora dela + 730 lotes; site: 72 aberturas × 3 (`/api/eu`, `/api/versao`, upgrade) + 12 × 75 imagens | ~4.850 | ~5% |
| DO (100.000 req; mensagem WS recebida = 1/20, enviada e ping grátis) | 3.000 `desde` + 730 lotes + 72 `/api/eu` (DO Diretório) + 72 upgrades + 900 imagens (moram no DO, 6.6) + 1.200 mensagens/20 | ~4.850 | ~5% |
| Linhas gravadas SQLite (100.000) | 5.500 ops × ~6 linhas + 1.930 `paceAt` (730 lotes + 1.200 mensagens) | ~35.000 | ~35% |
| Linhas lidas (5.000.000) | snapshots + `desde` + histórico + pedaços de imagem | < 200.000 | < 4% |
| Duração DO (13.000 GB-s) | sessão: DO acordado ~4 h pela consulta de 5 s, 14.400 s × 0,128 GB = ~1.850; fora dela: (72 aberturas do site + 72 `/api/eu` no Diretório + 120 consultas de 10 min) × ~30 s acordado × 0,128 GB = ~1.000 | ~2.850 | ~22% |
| Armazenamento (5 GB) | ~300 B/op × 5.500 → ~1,65 MB/dia (~600 MB/ano) + mídia ≤ 300 MB (teto por campanha, 6.6) | — | ~18% no 1º ano |
| Access (50 usuários) | 12 (o mestre e os 11 jogadores; o Service Token do app não é pessoa) | — | 24% |
| v2, a mais: chat ~3.400 msgs (2.000 × 12/7) + duelo ~550 msgs (300 × 11/6) | DO +~200 req; linhas +~11.300 (chat 3 por mensagem, duelo 2); armazenamento +~1 MB/dia | — | ~+11% nas linhas; ~+7% no armazenamento do 1º ano |

**Dia típico: nada passa de ~35%; com a v2, linhas gravadas ~46% e armazenamento ~25% no 1º ano.** O plano grátis continua cabendo com 12 contas.

**Dia no teto (6.5):** se a campanha bater as 10.000 ops do teto, são 10.000 × ~6 + ~2.530 `paceAt` = ~62.500 linhas gravadas (~63%; ~74% com o chat da v2). Linhas gravadas é o recurso que mais cresce com a mesa, e é ele que segura o teto da campanha: por isso 10.000 e não mais. Se a W1 gravar mais de ~6 linhas por op (um índice a mais, a ficha gravada duas vezes), esta conta e o teto mudam na mesma proporção.

**O teto é por campanha; a cota grátis é da conta Cloudflare inteira.** Duas campanhas no teto passariam de 100.000 linhas gravadas. Na v1 a única pasta prevista é a One Piece (DBT bloqueado, 12.21; Mapa de Teste fora, 12.7); antes de publicar uma segunda, refazer esta conta.

O que estoura primeiro se uma regra falhar é a **duração do DO**: se o app consultasse a cada 5 s o dia inteiro, iria a 86.400 s × 0,128 GB = ~11.060 GB-s, ~87% com o Diretório. Por isso a regra da seção 5.5 (5 s só com campanha aberta e janela visível; senão, ao focar ou a cada 10 min). O painel de uso fica em Cloudflare > Workers & Pages > Metrics; conferir na primeira semana, primeiro linhas gravadas e duração.

**O que mudou em relação à conta de 1 + 6:** ops, lotes, aberturas, mensagens e imagens cresceram para 12 contas e 11 fichas; entraram custos que a primeira conta não somava (imagens e `/api/eu` também batem num DO, `/api/versao` em cada abertura, e o DO acordado fora da sessão); o maior uso do dia típico passou a ser linhas gravadas (~19% → ~35%), com a duração subindo de ~14% para ~22%; Access foi de 7 para 12 (14% → 24%); e, na 6.5, o teto da campanha foi de 8.000 para 10.000 ops/dia e o de sockets por campanha de 20 para 36.

Não confirmado nas docs: repasse de WebSocket de Pages Functions para DO por `script_name`; tamanho máximo de linha/BLOB no SQLite do DO (o desenho já usa pedaços de 512 KiB). Cada um tem uma fatia que testa antes de depender dele. Google como provedor do Access no Free ficou confirmado na U0 (05/11/2026). Hipóteses desta revisão, também não confirmadas: quanto tempo o DO fica cobrado depois de cada despertar fora da sessão (aqui ~30 s, pessimista) e se cada índice conta como linha gravada (aqui conta).

---

## 8. Fatias

Regras para todas: tudo direto na `main`, sem worktree, cada fatia só nos seus caminhos (coluna "Caminhos"); commit só dos próprios caminhos ao fim da fatia. No máximo 5 agentes Opus em voo; Rust 1 por vez. Testes **só** onde está escrito "testes liberados". Comandos rodam em `C:/dev/labirinto/client` salvo indicação. `tsc` = `rtk proxy npx tsc --noEmit`.

### 8.1 v1 — fichas, edição, mochila, login

| Id | Entrega | Caminhos principais | Aceite (até este comando/teste passar) | Testes | Agente | Depende de | Pode rodar junto com |
|---|---|---|---|---|---|---|---|
| **U0** | Conta Cloudflare, projeto Pages `labirintolobby`, Zero Trust, Google (ou OTP), aplicação do Access com políticas A e B, Service Token, `wrangler login` | — (ação do usuário, seção 9) | Abrir `https://labirintolobby.pages.dev` numa janela anônima pede login e, depois dele, mostra a página placeholder | — | usuário | — | tudo |
| **N1** | Núcleo: `tipos.ts`, `caminho.ts` (com esquema e bloqueio de protótipo), `aplicar.ts`, `diferencas.ts` | `client/src/lib/nuvem/` | `npx vitest run src/lib/nuvem` passa com: ida e volta `aplicar(antes, diferencas(antes, depois)) == depois` em fichas inventadas One Piece e DBT (cartões, subcartões, mochila, reordenação); `historico` não gera op; criar item empilhável com `itemId` existente soma na vaga; `tsc` limpo. **Só com o ok da 12.18** (sem ok, saem do vitest e viram o passo 13 do roteiro manual da E1): `dono`/`notaDoMestre` nunca geram op de jogador; `__proto__` no caminho e aninhado no valor recusados; objeto em campo de texto e NaN/Infinity recusados | liberados (mescla); esquema/protótipo/permissão só com ok (12.18) | programador-frontend | — | A1, D1, S0, S1 |
| **N2** | Núcleo: `conflito.ts`, `lote.ts` (`processarLote`, atômico só com `atomico:true`, idempotência também por `recusadas`), `desfazer.ts`, `permissao.ts`, `projecao.ts` (ficha e op), `limites.ts` | `client/src/lib/nuvem/` | `npx vitest run src/lib/nuvem` passa com: 2 autores no mesmo campo (2º recusado); campos diferentes passam; apagar cartão × campo dele = conflito; fila do mesmo clienteId sem conflito; mesmo autor com 2 clienteIds = conflito; lote atômico com 1 conflito recusa tudo; lote comum com 1 conflito aplica o resto; opId repetido (aceito ou recusado) devolve a mesma resposta; desfazer com e sem mudança posterior; desfazer forjado com caminho/valor diferentes usa só o alvo; mestre desfaz de outro; `tsc` limpo. **Só com o ok da 12.18** (sem ok, saem do vitest e viram os passos 12 e 13 do roteiro manual da E1): `autorDeclarado` sem identidade do app = negado; jogador sem permissão = negado; `baseRev` > rev atual = negado; cota estourada = `adiado` (não `negado`); op de criar ficha com `notaDoMestre` sai projetada sem ela; op em ficha `mestre` = null para jogador | liberados (mescla, desfazer); permissão/projeção/negado só com ok (12.18) | programador-frontend | N1 | A1, A2, D1, S0, S1 |
| **N3** | Núcleo: `fila.ts` (armazenamento injetado, `vistaLocal`, rebase, conflito persistido) | `client/src/lib/nuvem/` | `npx vitest run src/lib/nuvem` passa com: 10 ops offline + 3 remotas em campos diferentes = todas aplicadas; 1 remota no mesmo campo = 1 conflito e 9 acks; reenvio depois da queda não duplica; linha cortada no fim ignorada; conflito sobrevive a recriar a fila do armazenamento; op respondida com `negado` fica na fila como "precisa de decisão" (não some, sobrevive a recriar a fila) e só sai com `resolvido`; op respondida com `adiado` continua pendente e é reenviada com o mesmo `opId`; `tsc` limpo | liberados (fila offline) | programador-frontend | N2 | A2, A3, S2 |
| **D1** | `fs:allow-rename` no escopo `$APPDATA` (troca segura de arquivo de verdade) | `desktop/src-tauri/capabilities/default.json` | `rg -n allow-rename C:/dev/labirinto/desktop/src-tauri/capabilities/default.json` acha a linha **e** `npm run tauri:dev` (na raiz) salva um mapa sem erro | — | engenheiro-desktop | — | N1, N2, A1 |
| **A1** | Mochila no tipo: `Personagem.mochila/moedas`, leitura em `personagemDoArquivo`, `paraOFio` tira mochila/moedas (só LAN), `salvarSobreOAtual` mantém `atual.mochila/moedas`, marcador `mochilaMigrada` no tipo do RPG da pasta, campo `email` na conta | `client/src/lib/personagem.ts`, `client/src/lib/ajusteDaFicha.ts`, `client/src/lib/pastasDeMapas.ts` (tipo), `client/src/lib/contasDosJogadores.ts` | `tsc` limpo | — | programador-frontend | — | N1, N2, D1 |
| **A2** | Junção pura e migração ao abrir: base = mochila/moedas da cena **gravada por último** (savedAt/mtime) por personagem; divergências das outras cenas no relatório; roda só depois de resolvida a recuperação (`recoveryAutosave`) e inclui o mapa recuperado em memória; cópia `rpg.json.antes-da-mochila` e `migracao-da-mochila.json`; grava o marcador na pasta | `client/src/lib/mochila/`, `client/src/net/nuvem/migracaoDaMochila.ts` | `npx vitest run src/lib/mochila` passa com: Poção x3 num mapa antigo e x1 no mais recente = x1 + linha no relatório; id diferente fica com os dois e é listado; moedas = cena mais recente + relatório; ficha nova depois da migração nasce com a mochila do token ligado; NPC sem ficha intocado; troca entre duas fichas mexe nas duas; **e**, numa **cópia** do appData, abrir um mapa antigo deixa `migracao-da-mochila.json` e `rg -c '"mochilaMigrada"' <cópia>/pastas/<id>/rpg.json` > 0; **e** abrir uma aventura sem pasta e uma aventura com mapa em "Configurar só neste mapa" (as fichas desse mapa ficam no `adventure.json`, `adventureStore.pastasDeMapas.test.ts:199`) (em **cópias** das pastas dessas aventuras) deixa `rg -c '"mochilaMigrada"' <cópia da aventura>/adventure.json` > 0 e a mochila dessas fichas preenchida | liberados (migração da mochila) | programador-frontend | A1 | N3, S2 |
| **A3** | Mochila mora na ficha em jogo: `applyItemsInScene` (`adventureStore.ts:2463`) desvia token ligado a ficha de pasta migrada para `ajustarPersonagem` e espelha em `map`, `past`, `future` e cenas de fundo; ao carregar cena, a ficha vence; troca/pagamento geram lote `atomico`; o mesmo vale para aventura sem pasta e mapa em "Configurar só neste mapa" (fichas no `adventure.json`) | `client/src/stores/adventureStore.ts` (só `applyItemsInScene` e espelho), `client/src/lib/mochila/` | `tsc` limpo **e** conferência manual: (a) dar uma Poção a Luffy na cena A, trocar para a cena B, a Poção está lá; (b) o mesmo numa aventura sem pasta; (c) o mesmo num mapa em "Configurar só neste mapa". Os casos de "separar mudança" no vitest **só com o ok da 12.18** (não são migração) | só com ok (12.18) | programador-frontend | A2 | N3, W1 |
| **W1** | Worker + DO Campanha/Diretório local: esquema SQLite, persistência do `processarLote` em `transactionSync`, WS Hibernation com auto-resposta do ping, rotas do app, exportar paginado, limitador, `workers_dev=false` | `lobby/nuvem/` | `cd C:/dev/labirinto/lobby/nuvem && npx wrangler deploy --dry-run` compila (sem `@tauri-apps` no bundle) **e** `node fumaca.mjs` contra `npx wrangler dev` imprime: publicar ok, 2 acks, 1 conflito, reenvio = mesma rev, recusada reenviada = mesma resposta, desfazer ok, exportar com todas as ops, `desde` paginado sem snapshot, cartão novo com imagem mandado pelo jogador = `negado`, publicar ficha com data URL = `negado` **e** os requisitos herdados 1, 2, 4, 5 e 6 da 8.1.1 | liberados (núcleo de sincronização no servidor: mescla, reenvio, desfazer); o script confere a saída esperada, então é teste, não "fumaça" | programador-frontend | N2, N3, S1 (o `.gitignore` com `.dev.vars*` e `**/.wrangler/` tem de existir antes do primeiro `wrangler dev`); ok do usuário para instalar o wrangler (12.9) | A3, S2, S3 |
| **W2** | Portão + layout do Pages + deploy: `lobby/site/functions/api/[[rota]].ts` (JWT completo, identidade, Origin, repasse por binding), `lobby/site/wrangler.toml`, `client/public-lobby/_routes.json`; deploy do Worker e do Pages (**só com ok explícito do usuário naquele momento**, passo 9.12; é o único deploy feito fora do `publicar-versao.cjs`, porque a etapa Lobby só nasce na S4, e só publica a página placeholder e o Worker — nada do app nem do GitHub); teste de WS pela Function | `lobby/site/`, `client/public-lobby/_routes.json` | (a) `curl -i https://labirintolobby.pages.dev/api/eu` sem login → redirecionamento/403 do Access; (b) logado no navegador, `/api/eu` mostra o e-mail; (c) `curl` com os cabeçalhos do Service Token devolve o mestre; (d) `curl -i https://labirinto-nuvem.<conta>.workers.dev` não responde (sem rota); (e) WS `/api/c/teste/ws` aberto no navegador recebe `estado` | — | programador-frontend | U0, W1 | A4, S3 |
| **W3** | Mídia: PUT/GET com sha256 + tipo pelos bytes, pedaços, tetos, cabeçalhos | `lobby/nuvem/src/midia.ts` | `node fumaca.mjs midia` sobe imagem de 2 MiB, baixa e imprime sha256 igual; hash errado imprime 400; `.png` com HTML dentro imprime 400 — **script com saída esperada = teste, só com o ok da 12.18**; sem ok, vira roteiro manual: no app, subir uma imagem de 2 MiB, abrir no site e conferir que aparece; renomear um `.html` para `.png` e tentar usar como retrato: o app avisa "imagem inválida" | só com ok (12.18) | programador-frontend | W1 | A4, S3 |
| **R1** | Ponte Rust `nuvem.rs`: credencial no Credential Manager (molde `ia.rs:153-192`), enum de rotas, URL fixa, timeout 15 s, upload de mídia lendo da pasta com id validado; comandos só na janela main | `desktop/src-tauri/src/nuvem.rs`, `lib.rs` (registro), capabilities (revisão do engenheiro-desktop) | `cargo clippy --all-targets --all-features -- -D warnings -W clippy::unwrap_used -W clippy::expect_used` (em `desktop/src-tauri`) passa **e**, no app em dev, guardar o token e chamar `Eu` mostra o e-mail do mestre | — | programador-rust (revisão: engenheiro-desktop) | W2 | A4, S3 |
| **A4** | Captura: emissor nos dois funis com filtro de NPC; Salvar da janela por ops contra a base da janela; base por conexão e `autorDeclarado` na LAN; `comAutor` | `client/src/net/nuvem/emissor.ts`, `client/src/stores/rpgDaPasta.ts`, `client/src/stores/adventureStore.ts` (só o ramo da pasta de `gravar`), `client/src/components/FichaDePersonagemDialog.tsx`, `client/src/net/hostSession.ts`, `client/src/net/playerChanges.ts`, `client/src/net/edicaoDoPersonagem.ts` | `tsc` limpo; `npx vitest run src/lib/nuvem` passa com o caso novo "janela aberta antes de mudança remota não a desfaz" (no núcleo, mescla); **e** roteiro manual dos funis — roda quando a A5 estiver pronta (só ela envia), e a A4 só fecha junto com ele: publicar a pasta de teste e fazer **uma** mudança por funil — Salvar da janela (`FichaDePersonagemDialog`), `ajustarPersonagem` (Ajuste), adicionar personagem, apagar personagem, `trocarImagensDosPersonagens`, dano de batalha (`mesaDaAventura.ts:71`), Mundo do Livro (`mundoDoLivroStore.ts:124`), `PaginaItens`, `LoadMapScreen.tsx:382`, edição do jogador pela sala LAN (`aplicarPartes`); depois `node lobby/nuvem/fumaca.mjs exportar <campanha>` lista uma op de cada, com autor certo (`Mestre (app)`; na LAN, a conta do jogador com `atestadoPeloApp`) e nenhuma op de NPC | liberados (mescla) | programador-frontend | N1, A3 (mesmo arquivo `adventureStore.ts`: em sequência) | W2, W3, R1, S3 |
| **A5** | Sincronizador do app: `fila.jsonl`, diário, `estado.json`, laço de busca/envio, gravador leve do `rpg.json` na fila única por pasta, aplicar remoto (fora do Ctrl+Z, sem reemitir), conflitos persistidos, reabertura | `client/src/net/nuvem/`, `client/src/stores/nuvemStore.ts`, `client/src/lib/pastasDeMapas.ts` (só `gravarRpgDaPasta` na fila única) | `tsc` limpo **e** roteiro: publicar pasta de teste; desligar o Wi-Fi; mudar Vida e +1 item no app; fechar e reabrir o app; religar; `node lobby/nuvem/fumaca.mjs exportar <campanha>` mostra as duas ops com autor `Mestre (app)`; `fila.jsonl` sem pendentes; `diario-AAAA-MM.jsonl` com as linhas **e** os requisitos herdados 3 e 5 da 8.1.1 | — (o núcleo já testado) | programador-frontend | N3, R1, A4, D1 | S3, S4 |
| **A6** | Telas do app: seção "Lobby" no Configurar pasta (publicar — bloqueado em pasta DBT na v1, com a explicação, 12.21 —, jogadores com conta e e-mail, "sem conta: só o mestre edita"), campo de e-mail nas contas, "Conta na nuvem" (colar o token), "Mudanças para decidir", `AvisoDeConflito` (puro, compartilhado), indicador "Lobby: tudo salvo / 3 esperando rede" | `client/src/components/nuvem/`, `client/src/screens/PastaDeMapasConfig.tsx`, `client/src/components/ContasDosJogadores.tsx` | `tsc` limpo e `npm run build --workspace=client` (na raiz) gera o build; sem teste de tela | — | designer-opus (tela) + programador-frontend (ligação) | A5 | S4, S5 |
| **S0** | Protótipo HTML das telas da v1 (sem acesso, campanhas, campanha, ficha com faixa de estado, conflito, histórico com desfazer, mochila), só dados inventados | `docs/design/lobby/prototipo.html` | o arquivo abre no navegador com as 7 telas navegáveis **e** o usuário diz "aprovado" | — | designer-opus | — | N1, N2, A1, D1 |
| **S1** | Esqueleto e build: `client/lobby-site/index.html` (sai `index.html` no `dist-lobby`), `vite.lobby.config.ts` (root `lobby-site`, outDir `../dist-lobby`, publicDir `../public-lobby`, guarda de import), `_headers`, script `build:lobby`; no `.gitignore`: `client/dist-lobby/`, `.dev.vars*` (segredos locais do `wrangler dev`, como AUD e `MAPA_DO_APP`) e `**/.wrangler/` (estado local do DO, com SQLite) | `client/lobby-site/`, `client/src/lobby-site/main.tsx`, `client/vite.lobby.config.ts`, `client/public-lobby/_headers`, `client/package.json` (script), `.gitignore` | `tsc` e `npm run build:lobby --workspace=client` passam; `rg -c "__TAURI\|@tauri-apps\|pixi" client/dist-lobby` não acha nada; um import de propósito de `@tauri-apps/plugin-fs` em `main.tsx` faz o build **falhar** (depois removido); `npx wrangler pages dev client/dist-lobby` abre `/` e `/c/x`; `rg -n "dev\.vars|\.wrangler" C:/dev/labirinto/.gitignore` acha as duas linhas | — | programador-frontend | S0 (só a direção visual) | N1, N2, A1 |
| **S2** | Camada de dados do site: fonte real (WS do protocolo 5.4), fonte demo (inventada, `?demo=1`), store da campanha, adaptador IndexedDB da fila (uma entrada por opId, base por e-mail+campanha), rotas | `client/src/lobby-site/dados/` | `tsc` e `build:lobby` passam e `npm run dev` com `/?demo=1` (config do lobby) lista as campanhas inventadas **e** o requisito herdado 5 da 8.1.1 (adaptador IndexedDB) | — | programador-frontend | S1, N3 | A2, A3, W1 |
| **S3** | Telas: Campanhas, Campanha (minhas primeiro; colegas "só ver"), Ficha (casca sobre `PlayerFicha` com props novas `somenteLeitura` e `aoAbrirEdicao`; troca de imagem desligada na v1), faixa de estado ("Salvo" só no ack; "N precisam da sua decisão"; `beforeunload`), conflito em lista acima da ficha (reusa `AvisoDeConflito`), histórico com desfazer, mochila sobre `InventarioDaFicha` | `client/src/lobby-site/telas/`, `client/src/player/PlayerFicha.tsx` (só as 2 props, padrão = comportamento de hoje) | `tsc` e `build:lobby` passam; na demo: mudar Vida 30→25 mostra "Enviando 1" e depois "Salvo"; botão de dev "simular mestre mudou Vida" mostra o aviso com as duas escolhas; "+1 Poção" gera 1 op `['mochila',<vaga>,'quantidade']`; ficha de colega sem botão Editar | — | designer-opus (tela) + programador-frontend | S2, S0 aprovado, A6 (o `AvisoDeConflito`) | W2, W3, R1, A4 |
| **S4** | Publicação no mesmo script: etapa Lobby em `publicar-versao.cjs` (build carimbado com a versão do `tauri.conf.json`, `versao.json`, `conferir-repo-publico.cjs` antes de qualquer envio, deploy do Worker, do Pages com cwd em `lobby/site`, só depois a release do GitHub), flag `--so-lobby`; checagem de versão do formato na abertura do site | `scripts/publicar-versao.cjs`, `scripts/conferir-repo-publico.cjs` | `node scripts/conferir-repo-publico.cjs` sai 0 no repo atual e sai 1 com um rascunho rastreado contendo um e-mail inventado do Gmail (nome qualquer + arroba gmail ponto com; o rascunho é removido depois; o e-mail não é escrito aqui para o próprio plano não disparar a guarda), sai 1 com um `.dev.vars` ou arquivo dentro de `.wrangler/` rastreado (`git add -f` de propósito, desfeito depois com `git rm --cached`) e sai 1 com um print novo em `docs/verification` fora da pasta de teste (12.12); `node scripts/publicar-versao.cjs --so-lobby` (sem `--publicar`) gera `client/dist-lobby/versao.json` com `versaoDoApp` igual à do `tauri.conf.json`, **sem** rodar `tauri:build` | — | programador-frontend | S1, W2 | A5, A6 |
| **E1** | Passeio de aceite da v1 (sem código): roteiro "toda mudança fica salva" com o mestre no app, o mestre no site e 1 jogador no site | — | o roteiro da seção 8.3 passa inteiro, com o `exportar` mostrando todas as ops, e o usuário responde "aceitou? refez?" | — | verificador-realidade + usuário | todas da v1 | — |

Caminho crítico: N1 → N2 → N3 → W1 → W2 → R1 → A5 → A6 → S3 → E1. A trilha da mochila (A1 → A2 → A3) e a do site (S0 → S1 → S2) andam ao lado.

#### 8.1.1 Requisitos herdados de N1–N3 (auditoria da rodada 1, 05/11/2026)

Pendências dos relatórios de correção da N1, N2 e N3 que viraram requisito das fatias seguintes. Cada uma entra no aceite da fatia indicada (células da W1, A5 e S2 acima).

1. **W1: permissão pela mudança, não pelo caminho.** Toda checagem de escrita do servidor usa `quemEscreveAMudanca(m)` (`caminho.ts`), nunca `quemEscreve(caminho)`. A primeira olha o que vai dentro do `criar` de cartão (imagem nele ou num subcartão = só mestre, 12.4); a segunda olha só o caminho e deixaria o jogador pôr imagem criando um cartão. O `processarLote` do núcleo já usa a certa (`permissao.ts`): a W1 não reimplementa nem contorna. O `fumaca.mjs` cobre o cartão novo com imagem mandado pelo jogador (`negado`).
2. **W1: colunas novas em `recusadas`.** `resposta` (o `conflito` dado) e `autorContaId` (4.5), que a 4.5 original não tinha. Com elas o reenvio do mesmo `opId` recebe a mesma resposta e um `opId` alheio é negado sem vazar nada. O `fumaca.mjs` cobre a recusada reenviada (mesma resposta).
3. **A5: a base da fila é só o que o servidor confirmou.** O `rpg.json` é gravado a partir da vista, que já inclui as ops pendentes. A A5 não abre a fila (`criarFila`) com esse `rpg.json` como base, senão a soma pendente entra duas vezes. A base vem do confirmado (refeita pelo diário, ou guardada à parte).
4. **W1: `atomico` também na ficha trocada inteira (desvio da 4.6 e da 5.2).** Além de troca e pagamento, o `diferencas` marca `atomico` no `apagar`+`criar` de `[]` (troca de tipo jogador↔npc, bloco Dragon Ball trocado inteiro), para a ficha não sumir quando o `criar` é recusado. A W1 grava cada grupo atômico numa `transactionSync` só.
5. **W1, A5 e S2: primeira execução fora da memória.** O núcleo só rodou contra a campanha em memória (`campanha.fixture.ts`) e o armazenamento de texto em memória da fila. A W1 é a primeira vez contra um DO real; a A5, contra o adaptador real de disco (`fila.jsonl`, troca de arquivo com rename da D1); a S2, contra o adaptador real de IndexedDB, que grava cada `acrescentar` e cada `substituir` numa transação só, porque o registro `grupo` da fila leva vários `opId` numa entrada (diferente da "uma entrada por opId" da S2).
6. **W1: a rota `publicar` cria a ficha pelo `lerMudanca` (Si7, seção 11).** `POST /api/c/:id/publicar` (5.4) cria cada ficha nova passando pelo mesmo `lerMudanca` (`caminho.ts`) do `criar` de `[]`, nunca gravando a ficha direto no doc. É lá que `fichaComImagemForaDaMidia` recusa a foto embutida (data URL) no retrato e em qualquer cartão ou subcartão; gravada direto, a embutida entra no doc do servidor e deixa sem volta o desfazer de qualquer mudança sobre ela (a volta passa de novo por `lerMudanca`). O `fumaca.mjs` publica uma ficha com data URL e espera `negado` (`fora-do-esquema`).

### 8.2 v2 — chat e treino (juntos, só depois da E1)

| Id | Entrega | Caminhos principais | Aceite | Testes | Agente | Depende de | Pode rodar junto com |
|---|---|---|---|---|---|---|---|
| **C1** | Chat no DO Campanha (mesma conexão WS, mensagens `chat.*`): sala e privado em tabelas separadas; canal só `'sala'` ou `{dm: contaIdDoOutro}`, chave montada pelo servidor com o contaId do socket; `chat.desde` para a reconexão; lápide ao apagar; não lidas; limitador em todo frame; reaproveita `takeChatTurn`, `cleanChatText` (`chat.ts:136`) e `findMentions` (`chat.ts:204`), com `CHAT_MENTIONS_MAX` copiado (não importa `protocol.ts`) | `lobby/nuvem/src/chat.ts` | `npx wrangler deploy --dry-run` passa **e** `node fumaca.mjs chat` imprime: sala chega aos 3; dm A↔B não chega ao mestre; `chat.antes` com canal `'dm:a:b'` em string = recusa; 6º envio em rajada = `ritmo`; exportar sem nenhuma dm — **script com saída esperada = teste, só com o ok da 12.18**; sem ok, vira roteiro manual com três abas (mestre, A, B): mensagem na sala chega às três; privado A↔B não aparece na aba do mestre; 6 mensagens em rajada mostram "devagar"; `exportar` não tem nenhuma linha de privado | só com ok (12.18) | programador-frontend | E1 | T1, T2 |
| **C2** | Telas de chat no site (sala, privados, aviso honesto do privado com o texto aprovado na 12.19, não lidas no título, carregar anteriores, baixar minha conversa, "enviando…" até `chat.ok`) | `client/src/lobby-site/telas/chat/`, `client/src/lib/chat.ts` (canal generalizado sem quebrar `cena`/`global`) | `tsc` e `build:lobby` passam; no navegador o texto `<img src=x onerror=alert(1)>` aparece literal | — | designer-opus + programador-frontend | C1 | T3, T4 |
| **C3** | Cópia da sala no app (`chat-sala.jsonl` em `<appData>/nuvem/<id>/`, com lápides), variante `SalaDoChat` no enum do Rust, remover jogador fecha os sockets | `client/src/net/nuvem/chatSala.ts`, `desktop/src-tauri/src/nuvem.rs` | `tsc` e `cargo clippy ...` passam; conferência: remover o jogador B fecha a aba dele em até 5 s; `chat-sala.jsonl` tem a sala, as lápides e nenhuma dm | — | programador-frontend; depois programador-rust (Rust 1 por vez) | C1 | T5 |
| **T1** | Fábrica separada: `stores/batalhaFabrica.ts` com `criarBatalhaStore(mesa, {rolarD20, outraBatalhaLigada})`; os 6 pontos de d20 usam o rolador; `batalhaStore.ts` só instancia e reexporta | `client/src/stores/batalhaFabrica.ts`, `client/src/stores/batalhaStore.ts` | `tsc` limpo; `npm run build` ok; `npx esbuild src/stores/batalhaFabrica.ts --bundle --format=esm --external:react --outfile=<scratchpad>/f.js` e `rg -c tauri <scratchpad>/f.js` = 0; o usuário liga uma batalha One Piece no app e ela segue igual | — | programador-frontend | E1 (ordem da lei) | C1 |
| **T2** | `lib/treino/sorteio.ts`, `mesaEmMemoria.ts` (id determinístico por vaga), `fimDaLuta.ts` | `client/src/lib/treino/` | `npx vitest run src/lib/treino` passa: mesma semente = mesmos 50 d20; todo d20 em 1..20; fim cobre vitória A, vitória B, todos caídos e tempo | liberados (semente) | programador-frontend | T1 | C1 |
| **T3** | Robô e luta automática: dano preenchido com `tecnicasNoMenu(...).dano.valor` ou `danoSugeridoDoAtaque` (`golpe.ts:503`); técnica de "dano à mão" pulada; defesa por `reacaoDoBoneco`; tetos de rodada e passo | `client/src/lib/treino/` | `npx vitest run src/lib/treino` passa: 2×1 com semente 7 termina com vencedor (não por tempo); mesma semente 2× = mesmo resumo; luta pausada na rodada 3, gravada em JSON e recriada termina igual; robô sem SP ataca com a arma | liberados (robô) | programador-frontend | T2 | C2 |
| **T4** | 100 lutas e comparar build no Web Worker | `client/src/lib/treino/` | `npx vitest run src/lib/treino` passa: 100 lutas semente 1 dão o mesmo resultado 2× e vitórias+empates = 100; esbuild do worker ≤ 120 KB comprimido, sem `livroDragonBall` nem `tauri`; tempo impresso (alvo ≤ 5 s, teto 15 s), medição no grupo `desempenho` do vitest | liberados (robô/semente) | programador-frontend | T3 | C2 |
| **T5** | Regra pura do duelo: servidor **recalcula** dano e custo pela cópia (ignora os do cliente), recusa surpresa e "dano livre", exige `seq` do último estado em agir/reagir/passar, dono lido do doc completo, teto de 64 KiB só cliente→DO (estado leva só a cauda do registro) | `client/src/lib/treino/duelo.ts` | `tsc` limpo; `npx vitest run src/lib/treino` passa com "dois robôs pelo duelo.ts com semente 7 terminam igual à lutaAutomatica" (robô/semente) — e, só se o usuário liberar (12.13), "pedido com dano forjado = mesmo resultado que dano null" e "agir repetido com seq velho = recusado" | liberados (robô/semente); anti-trapaça só com ok | programador-frontend | T3 | C3 |
| **T6** | Duelo no DO: handler `duelo.*`, tabela `duelos` com `prazo`/`apagarEm`, **um** `alarm()` que percorre os vencidos e reagenda para o menor prazo (compartilhado com o resto do DO), ausente só quando a conta não tem mais nenhum socket, d20 por crypto | `lobby/nuvem/src/duelo.ts` | `npx wrangler deploy --dry-run` passa com o tamanho impresso **e** o usuário faz um duelo em duas abas com contas diferentes, fecha uma no meio, reabre antes de 3 min e continua | — | programador-frontend | T5, C1 | C2 |
| **T7** | Telas do treino: inimigo liberado, luta turno a turno (semente visível, "repetir"/"nova semente"), 100 lutas com progresso, testar build (rascunho guardado no localStorage por campanha+ficha, rotulado "rascunho de treino"), duelo com convite | `client/src/lobby-site/telas/treino/` | `build:lobby` passa e o usuário joga 3 lutas por dificuldade, roda 100 lutas, testa uma build (recarrega a página e o rascunho continua) e faz 1 duelo, respondendo as 3 perguntas da regra de teste de jogos | — | designer-opus + programador-frontend | T4, T6, C2 | — |
| **T8** | Inimigos liberados: lista `treino.inimigosLiberados: string[]` no `rpg.json` (não campo no Personagem); botão na ficha do NPC; publicar cópia em `visivel:'treino'` pela projeção do treino (sem notaDoMestre, dono, combate, mochila) | `client/src/net/nuvem/publicar.ts`, `client/src/components/nuvem/` | `tsc` limpo **e** "op de ficha `treino` projetada sem notaDoMestre/dono/combate/mochila": no vitest **só com o ok da 12.18** (projeção não está na faixa liberada); sem ok, roteiro manual: liberar um NPC com nota do mestre e, no DevTools do jogador, nenhuma resposta traz `notaDoMestre`, `dono`, `combate` nem `mochila` dele | só com ok (12.18) | programador-frontend | A6, C1 | T4 |

### 8.3 Roteiro da E1 (aceite final da v1)

1. Mestre publica a pasta de teste (fichas inventadas); jogador entra com Google e vê a própria ficha editável e a do colega "só ver".
2. Jogador muda um texto de cartão no site enquanto o mestre está com a janela da mesma ficha aberta no app mudando a descrição; o mestre salva; os dois textos sobrevivem.
3. Mestre e jogador mudam a Vida quase juntos; o segundo vê o aviso; escolhe; o histórico mostra os dois.
4. Mestre desliga o Wi-Fi, dá 2 danos e +1 Poção, fecha e reabre o app, religa; tudo chega ao site.
5. Mestre dá uma Poção pela página Itens do Mundo do Livro; aparece no site.
6. Jogador desfaz a própria mudança; tenta desfazer a do mestre (botão não aparece); o mestre desfaz a do jogador.
7. Jogador abre a ficha no celular e no PC e muda o mesmo campo nos dois; o segundo vê aviso.
8. Um jogador na sala LAN muda um campo da própria ficha pelo app do jogador; aparece no site com o nome dele e "atestado pelo app".
9. Mestre adiciona um personagem, apaga outro e troca a imagem de um terceiro no app; o site mostra os três (o apagado some da lista).
10. Mestre desliga o Wi-Fi e muda a Vida de uma ficha no app; enquanto isso o jogador muda a mesma Vida no site (que está online e grava primeiro); o mestre religa: o aviso "O jogador acabou de mudar para X" aparece no app, ele escolhe, e o histórico do site mostra as duas mudanças.
11. `node lobby/nuvem/fumaca.mjs exportar <campanha>` lista todas as mudanças dos passos 2–10; o `diario-AAAA-MM.jsonl` do mestre tem as mesmas revs, sem buraco; nenhuma op ficou em "precisa da sua decisão" sem ser decidida.
12. No DevTools do jogador, nenhuma resposta contém `notaDoMestre`, e-mail de colega nem ficha de NPC.
13. (só se a 12.18 **não** liberar os testes de validação) No console do site, como jogador, mandar à mão três ops: caminho com `__proto__`, ficha do colega e `autorDeclarado`; as três voltam `negado`, nada muda na ficha, e o aviso vermelho aparece com o motivo.

---

## 9. Passos do usuário (ação sua; nenhum segredo vai para o chat nem para o repo)

1. **Antes de instalar a versão com a mochila na ficha:** copiar `%APPDATA%\com.labirinto.app\pastas` para outro lugar (segunda garantia; a migração já guarda uma cópia) e conferir que o C: tem mais de 8 GB livres (hoje: 16 GB).
2. **Aprovar a instalação do wrangler** (CLI da Cloudflare, ~150–200 MB, versão fixa como devDependency da raiz, uma vez só) — pergunta 12.9.
3. **Cloudflare:** criar a conta grátis (se não tiver) e o projeto Pages com o nome `labirintolobby`.
4. **Zero Trust (Free):** ativar e escolher o nome do time (ex.: `labirinto` → `labirinto.cloudflareaccess.com`).
5. **Google (se for usar Google no Access):** no Google Cloud Console, criar a tela de consentimento e um cliente OAuth seguindo o guia da Cloudflare. **ID e segredo do cliente são colados só no painel da Cloudflare** (Zero Trust > Settings > Authentication). Se o Google não aparecer no plano Free, ligar "One-time PIN".
6. **Access:** criar a aplicação para `labirintolobby.pages.dev` e `*.labirintolobby.pages.dev`; política A com o grupo de e-mails convidados (ou "qualquer Google", conforme 12.1); política B "Service Auth". Se o painel pedir, apagar o curinga do subdomínio.
7. **Service Token:** Zero Trust > Access > Service Auth > criar. Anotar Client ID e Client Secret **e colar só na tela "Conta na nuvem" do app** (vai para o cofre do Windows).
8. **Valores do Worker:** copiar o AUD da aplicação do Access. O agente dá os comandos `npx wrangler secret put ...`; você digita os valores (AUD, domínio do time, Client ID → seu e-mail) no terminal.
9. Rodar `npx wrangler login` uma vez nesta máquina (abre o navegador; o login fica no seu perfil do Windows).
10. **No app**, em Contas dos jogadores, preencher o e-mail Google de cada jogador; em Configurar pasta, apertar "Publicar no Lobby" (a pasta precisa ter sistema universal e, na v1, não ser DBT — 12.21).
11. Depois da primeira abertura com a versão nova, ler `migracao-da-mochila.json` na pasta e conferir as divergências apontadas.
12. Aprovar o protótipo da S0, responder as perguntas da seção 12 e autorizar cada publicação real: o primeiro deploy do Worker e do Pages na W2 (pedido explícito na hora, antes de rodar) e, depois da S4, cada `publicar-versao.cjs --publicar` ou `--so-lobby --publicar`, como hoje. Nenhum agente faz deploy sem esse ok.

---

## 10. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Google no Access Free não funciona | U0 testa antes de qualquer código; desvio: One-time PIN, nada mais muda |
| Pages Functions não repassam WS ao DO por `script_name` | W2 testa com WS real antes das regras; desvio: service binding Pages → Worker → DO, mesma origem |
| Algum import transitivo de `personagem.ts` arrasta `@tauri-apps` para o Worker | o núcleo usa só `import type` de `personagem.ts` e tem lista própria em `projecao.ts`; `wrangler deploy --dry-run` no aceite da W1 |
| `diferencas` erra e uma mudança do mestre não vira op | teste de ida e volta (N1) sobre fichas One Piece e DBT completas |
| Mudança do jogador desfeita em silêncio por rascunho antigo | base da janela / base enviada na LAN / rev ao abrir Editar no site (5.1) + teste da A4 |
| Gravação do `rpg.json` muitas vezes sem rename | D1 antes da A5; gravador leve; `fila.jsonl` por append é a garantia |
| Migração ressuscita item gasto | cena mais recente como base + relatório; marcador na pasta; cópia de antes; testes liberados |
| Duração do DO estoura por consulta constante | 5 s só com campanha aberta e janela visível; senão ao focar / 10 min |
| Abuso de cota (conta Google qualquer, loop de membro) | grupo do Access; limitador persistido no DO em todo frame; negadas sem payload; tetos por caminho |
| Log enche os 5 GB | tetos por caminho (não 64 KiB para tudo); ~330 MB/ano no uso normal; nada apagado sem ordem |
| Vazamento de campo do mestre ou NPC | projeção por valor, não só por caminho, nos 4 pontos; NPC não emite; teste da N2 (se a 12.18 liberar); passos 12 e 13 da E1 |
| Credencial do app vazada | só no cofre do Windows via Rust; URL fixa e enum; revogável no painel |
| XSS com texto vindo da internet no app sem CSP | guarda de `innerHTML` em todo `client/src`; CSP do app como fatia própria (12.11) |
| Repo público recebe dado real ou e-mail | `conferir-repo-publico.cjs` antes de qualquer envio; fixtures `@example.com`; prints de ficha real só no scratchpad |
| Disco C: no limite | uma instalação do wrangler; `dist-lobby` pequeno e ignorado; diário por mês; tamanho mostrado na tela da conta |
| Duelo trapaceado pelo cliente | servidor recalcula dano/custo, recusa surpresa e dano livre, `seq` contra reenvio |
| Separar `batalhaStore.ts` (~2.400 linhas) quebra a batalha do mestre | T1 mecânica, sozinha, depois da v1, com passeio do usuário |
| Espelho da mochila marca a cena como "não salva" sem o mestre mexer | A3 confere como o `mapStore` decide "sujo"; se marcar, aceitar (o Salvar só regrava o espelho) e dizer ao usuário |
| Versões diferentes entre site, Worker e app | `VERSAO_DO_FORMATO`; Worker aceita N-1; ordem de publicação Worker → Pages → GitHub; site esvazia a fila antes de pedir recarregar |
| Granularidade grossa do bloco DBT (dois campos do mesmo bloco brigariam, contra a lei "campos diferentes nunca brigam") | v1 **bloqueia** publicar pasta DBT (o botão "Publicar no Lobby" explica por quê; pergunta 12.21); `['dbt', ...]` é detalhado por campo antes de liberar DBT |

---

## 11. Achados das críticas e como foram resolvidos

Legenda: **Nu** = crítica da Nuvem; **Ap** = App; **Si** = Site; **Tr** = Treino; **Ch** = Chat/Segurança; **XS** = cruzada de segurança; **XI** = cruzada de integração. "Aceito" = a correção proposta entrou no plano.

### Nuvem
| Achado | Resolução |
|---|---|
| Nu1 (alta) Caminhos que gravam ficha sem passar pelos ganchos (Mundo do Livro, PaginaItens, adicionar/apagar) | Aceito: dois funis, `gravar` e `editarRpgDaPasta` (5.1), com a lista de chamadores |
| Nu2 (alta) `diferencas(atual, salvo)` desfaz mudança remota | Aceito: base que o autor viu + rev dela; janela, LAN e site (5.1); teste na A4 |
| Nu3 Criar/apagar ficha sem op | Aceito: caminho `[]` criar/apagar, só mestre; op em ficha apagada = conflito com "recriar" |
| Nu4 Autoria da LAN vira "Mestre (app)" | Aceito: `autorDeclarado` só com Service Token, marcado "atestado pelo app" |
| Nu5 Mesmo autor em dois aparelhos não conflita | Aceito: chave de autoria `(clienteId, autorEfetivo)` |
| Nu6 Snapshot quebra a cópia completa no disco | Aceito: rota do app nunca devolve snapshot; `desde` paginado |
| Nu7 Duas gravações no mesmo `.tmp` | Aceito: cadeia de promessas por arquivo; fila e diário por append; D1 libera rename |
| Nu8 Publicar de novo grava por cima | Aceito: publicar só cria o que não existe; o resto vira op |
| Nu9 Jogador removido segue com socket | Aceito: checagem a cada mensagem e fechar sockets por tag |
| Nu10 Recusada reenviada dá erro de PK | Aceito: idempotência também por `recusadas` |
| Nu11 `somar` em quantidade ausente e teto | Aceito: `quantidadeDe`, teto, inversa usa `antes` quando cortou; empilhável soma na vaga do mesmo `itemId` |
| Nu12 Teto da op = teto do frame; exportar inteiro | Aceito: op ≤ 24 KiB < frame 64 KiB; exportar paginado |
| Nu13 Aceite da F8 depende do site | Aceito: aceite da A5 por `fumaca.mjs exportar`. Pergunta da imagem do item corrigida: já é `midia:` |

### App
| Achado | Resolução |
|---|---|
| Ap1 (alta) Marcador "mochila vazia" some ao reler | Aceito: marcador `mochilaMigrada` na pasta (4.2) |
| Ap2 (alta) Salvar entre F5 e F6 apaga a Poção | Aceito: A1 já faz `salvarSobreOAtual` manter `atual.mochila/moedas` |
| Ap3 Fichas novas depois da migração | Aceito: toda ficha da pasta migrada; nasce com a mochila do token ou vazia |
| Ap4 Junção por maior quantidade ressuscita item | Aceito: base = cena gravada por último + relatório; confirmação em 12.2 |
| Ap5 Migração ignora a recuperação | Aceito: espera a recuperação e inclui o mapa recuperado |
| Ap6 Lote atômico faz campos diferentes brigarem | Aceito: atômico só em troca/pagamento; resto op por op |
| Ap7 `editarRpgDaPasta` fora da fila | Aceito: ler-mudar-gravar inteiro na fila única por pasta |
| Ap8 Conflito só em memória | Aceito: conflito gravado na `fila.jsonl` até resolver |
| Ap9 Queda na janela de 1 s | Aceito: reaplicar pendentes e confirmadas com `rev > revNoRpg` ao abrir; eco aplicado |
| Ap10 Emissor sem filtro de NPC | Aceito: só `jogador` sem invocado; troca de tipo = criar/apagar |
| Ap11 Junção de ops na fila atravessa lotes | Aceito: a fila não funde ops |
| Ap12 Dono/jogador trocado só sobe no Publicar | Aceito: `POST membros` reenviado sozinho |
| Ap13 Autosave pelo `gravarRpgDaPasta` pesado | Aceito: gravador leve; A5 depende da D1 |

### Site
| Achado | Resolução |
|---|---|
| Si1 (alta) Sem `index.html` | Aceito: entrada `client/lobby-site/index.html`; aceite com `wrangler pages dev` em `/` e `/c/x` |
| Si2 (alta) `baseSeq` sem origem | Aceito: prop `aoAbrirEdicao` registra a rev ao abrir |
| Si3 (alta) `PlayerFicha` sem modo só leitura | Aceito: props `somenteLeitura` e `aoAbrirEdicao` (padrão = hoje); aviso de conflito em lista acima da ficha na v1, não "junto ao campo" |
| Si4 Conflito/recusa do reenvio some | Aceito: lista "precisam da sua decisão" persistida e mostrada na faixa |
| Si5 localStorage em duas abas | Aceito: IndexedDB, uma entrada por opId, base por e-mail+campanha |
| Si6 Remoção × quantidade, listas sem id, empilhável | Aceito: sobreposição por prefixo; etiquetas e cartoesAtivos por elemento; empilhável soma |
| Si7 Imagem como data URL na op | Aceito: troca de imagem desligada no site na v1 (12.4); op só aceita `midia:`. Feito na rodada 2 da N1 (`imagemDaOp`, `caminho.ts`): retrato, imagem de cartão e cartão novo com seus subcartões aceitam só `midia:` ou vazio, e a foto embutida antiga (data URL) é `fora-do-esquema`. A publicação (A6/W3) converte a foto antiga em `midia:` antes de subir. Fechado na rodada 3: o `criar` da ficha inteira (`[]`) também recusa a embutida no retrato e em qualquer cartão ou subcartão (`fichaComImagemForaDaMidia`), porque a embutida no doc do servidor deixava sem volta o desfazer de qualquer mudança sobre ela (a volta passa de novo por `lerMudanca`). Com isso, a ficha que a rota `publicar` da W1 cria tem de passar pelo mesmo `lerMudanca` do `criar` de `[]`, nunca gravada direto no doc |
| Si8 Desfazer sobrescreve sem aviso | Aceito: inversa com `baseRev` do alvo passa pelo detector |
| Si9 Dois históricos | Aceito: `historico` fora das diferenças; só o app escreve o local |
| Si10 Fila velha na troca de versão | Aceito: esvaziar a fila antes do "recarregue"; versão em cada entrada |
| Si11 Aceite da F8 roda `tauri:build` | Aceito: `--so-lobby` sem publicar. Aceite da F7 do site: o reenvio já é coberto pelo teste da fila do núcleo (N3) |
| Si12 Jogador removido segue recebendo | Aceito: igual Nu9 |

### Treino
| Achado | Resolução |
|---|---|
| Tr1 (alta) Robô sem dano = empate por tempo | Aceito: dano preenchido; "dano à mão" pulado; aceite da T3 exige vencedor |
| Tr2 Dano e custo do cliente no duelo | Aceito: servidor recalcula (T5) |
| Tr3 Jogada reenviada aplicada 2× | Aceito: `seq` obrigatório |
| Tr4 Um alarme por DO | Aceito: colunas `prazo`/`apagarEm` e um `alarm()` que varre |
| Tr5 `dono` some no `paraOFio` | Aceito: dono lido do doc completo no servidor |
| Tr6 Rascunho de build dito salvo sem fatia | Aceito: T7 grava no localStorage |
| Tr7 `duelo.estado` > 64 KiB | Aceito: teto só cliente→DO; estado com a cauda do registro |
| Tr8 Mesmo inimigo duas vezes | Aceito: id determinístico por vaga |
| Tr9 Ausente por conta, não por socket | Aceito |
| Tr10 T1 antes da v1 | Aceito: T1 depende da E1 (lei) |
| Tr11 Teste do duelo fora da faixa liberada | Parcial: o teste de robô/semente pelo `duelo.ts` fica (é robô/semente); os anti-trapaça dependem do ok (12.13); medição no grupo `desempenho` |

### Chat/Segurança
| Achado | Resolução |
|---|---|
| Ch1 (alta) API em outra origem atrás do Access | Aceito: tudo em `/api/*` na mesma origem; `connect-src 'self'`; nada em `workers.dev` |
| Ch2 Service Token sem e-mail | Aceito: identidade por `email` ou `common_name` mapeado (6.2) |
| Ch3 Reconexão perde mensagens | Aceito: `chat.desde` |
| Ch4 Ping e frames não limitados | Aceito: auto-resposta do ping; ritmo em todo frame |
| Ch5 Limite das rotas HTTP no Worker sem estado | Aceito: limitador no DO, persistido |
| Ch6 Lápide não chega à cópia do app | Aceito: cursor de lápides na rota da sala |
| Ch7 Nome e contaId do mestre fora de `membros` | Aceito: `membros.nome`; mestre = `contaId 'mestre'` |
| Ch8 Site não sabe qual ficha é sua | Aceito: `ehMinha` fora do objeto |
| Ch9 `mentionsOf` não existe; `CHAT_MENTIONS_MAX` em `protocol.ts` | Aceito: `findMentions`; constante copiada |
| Ch10 GCRA zera na hibernação | Aceito: `paceAt` em `cotas` |

### Cruzada de segurança
| Achado | Resolução |
|---|---|
| XS1 Duelo trapaceável | Aceito (T5) |
| XS2 Protótipo e tipo na op | Aceito: bloqueio de chaves, `structuredClone`, reviver, `ESQUEMA_DO_CAMINHO` (4.7), testes na N1 |
| XS3 Vazamento pelo valor da op | Aceito: `projetarOpParaJogador` nos 4 pontos |
| XS4 Cota e armazenamento | Aceito: grupo do Access (12.1), limitador por conta/campanha, negadas sem payload, tetos por caminho, mídia só do mestre na v1, `_routes.json` |
| XS5 IDOR do privado e exportar | Aceito: canal tipado montado pelo servidor; `chat_dm` fora do exportar |
| XS6 Credencial do app na webview | Aceito: desenho Nuvem é lei; Rust + cofre; nenhuma rota fora do Access |
| XS7 Worker exposto e JWT incompleto | Aceito: `workers_dev=false`, sem fetch público, validação completa, prévias sem binding, dev por compilação |
| XS8 Desfazer/resolve/autor forjados | Aceito (5.3, 6.4) |
| XS9 Jogador cria itens e moedas | Política vai ao usuário (12.3); teto numérico por caminho entra de qualquer jeito |
| XS10 XSS no app sem CSP | Guarda em todo `client/src` aceita; CSP do app em fatia própria (12.11) |
| XS11 Núcleo único de validação | Aceito: um `processarLote`/validador para WS, POST do app e desfazer |
| XS12 E-mail dos colegas no `estado` | Aceito: membros projetados sem e-mail |
| XS13 Mídia com HTML disfarçado | Aceito: `tipoDosBytes` + CSP sandbox no GET |
| XS14 Gitleaks só nos commits; prints; logs | Aceito: guarda antes de qualquer envio, também no `dist-lobby`; prints novos em `docs/verification` **bloqueiam** por padrão (12.12); logs sem cabeçalho |

### Cruzada de integração
| Achado | Resolução |
|---|---|
| XI1 Três formatos de op | Aceito: um tipo `Op` no núcleo da Nuvem (4.6) |
| XI2 Núcleo e sincronizador duplicados | Aceito: Nuvem dona do núcleo; App dono dos ganchos e do sincronizador em `net/nuvem` (a F8 da Nuvem e as F1/F7/F8 do App viraram N1–N3 + A5) |
| XI3 Transporte do app | Aceito: HTTP pelo Rust; sem WS na webview |
| XI4 Lote atômico | Aceito: `atomico:true` só em troca/pagamento |
| XI5 `paraOFio` esvazia a mochila do site | Aceito: `paraOFio` (LAN) ≠ `projetarParaJogador` (Lobby) |
| XI6 Publicação sem campos do mestre | Aceito: sobe o doc completo; projeção no servidor; caminhos do mestre sincronizam |
| XI7 Caminhos divergentes | Aceito: tabela única 4.7 |
| XI8 Membros em D1 × DO | Aceito: membros, chat e duelo no DO Campanha; sem D1 |
| XI9 Layout do Pages | Aceito: projeto Pages em `lobby/site/`, deploy com cwd ali; um `_headers` |
| XI10 Protocolo do site | Aceito: site adota o protocolo da Nuvem (5.4) |
| XI11 Mídia sem campanha | Aceito: `/api/c/:id/midia/:hash` |
| XI12 Fila do navegador duas vezes | Aceito: pausa offline + IndexedDB, pela `criarFila` do núcleo |
| XI13 Identidade do autor | Aceito: `Identidade{email, contaId, nome, papel, origem 'app'|'site'|'mesa', clienteId}` |
| XI14 Inimigos liberados em 4 lugares | Aceito: lista no `rpg.json` + `visivel:'treino'` (T8) |
| XI15 T1 antes da v1 | Aceito (igual Tr10) |
| XI16 `client/src/lobby` compartilhado | Aceito: `client/src/lobby-site` (site) e `client/src/net/nuvem` (app); um `AvisoDeConflito` |
| XI17 Fila sem rename | Aceito: D1 antes da A5 + append |
| XI18 Rota da sala no enum Rust | Aceito: variante `SalaDoChat` na C3; pasta `<appData>/nuvem/` |
| XI19 Nome do e-mail e forma de publicar | Aceito: campo `email`; `POST publicar` + `POST membros` |
| XI20 Duas instalações do wrangler | Aceito: uma, na raiz (12.9) |

---

## 12. Perguntas abertas (decisões suas; cada uma com recomendação)

1. **Quem passa pelo login do Access:** só os e-mails convidados (recomendado: protege a cota grátis; a cada jogador novo você acrescenta o e-mail no grupo do Access, cabe nos 50) ou qualquer conta Google (sem passo no painel, mas qualquer pessoa gasta a cota antes de ser barrada)?
2. **Mochila divergente entre mapas na migração:** ficar com a da cena salva por último e listar as outras no relatório para você decidir (recomendado), ficar com a maior quantidade, ou somar?
3. **Quanto o jogador pode mexer na própria mochila pelo site:** tudo na ficha dele, com teto e com os aumentos destacados no histórico para você revisar (recomendado, segue "editada pelos dois lados"), ou só diminuir/tirar, deixando aumentar e criar item com você?
4. **Troca de imagem (retrato e cartão) pelo site na v1:** fica de fora e entra depois numa fatia curta (recomendado) ou já na v1?
5. **Desfazer no v1:** só no site, onde você também entra (recomendado), ou também um painel no app?
6. **Ficha de jogador sem conta (só o nome do jogador):** aparece aos colegas como "só ver" e só você edita (recomendado) ou fica fora do Lobby?
7. **Mapas "Configurar só neste mapa" e pastas sem sistema universal:** ficam fora do Lobby (recomendado)? A mochila dessas fichas (e das aventuras sem pasta) passa a morar na ficha do mesmo jeito, convertida ao abrir (lei); só não são publicadas.
8. **"Jogador vê TUDO dos colegas"** exclui a nota do mestre e o bloco de NPC? (recomendado: sim, excluídos — já são escondidos hoje até do próprio dono)
9. **Instalar o wrangler** (~150–200 MB, versão fixa na raiz do repo, uma vez só) — autoriza? (recomendado: sim; sem ele não há deploy)
10. **Ações de batalha feitas pelo jogador na mesa LAN:** no histórico aparecem como do jogador, marcadas "atestado pelo app" (recomendado), ou como "Mestre"?
11. **CSP no app do mestre** (proteção extra agora que texto da internet chega ao app): fatia própria logo depois da v1, com passeio no app (recomendado), ou deixar como está?
12. **Print novo em `docs/verification`:** a guarda de publicação bloqueia (recomendado: com o repo público, um print do app pode mostrar ficha real, e a lei diz "nada de ficha real no repo"; print de pasta de teste com dados inventados entra por uma lista de liberados no próprio script) ou só avisa?
13. (v2) **Liberar os 2 testes anti-trapaça do duelo** ("dano forjado = mesmo resultado" e "jogada repetida recusada")? Recomendado: sim — ficam fora da faixa de testes que você liberou.
14. (v2) **Números do inimigo liberado no navegador do jogador** (dá para ver pelo DevTools porque as 100 lutas rodam no navegador): aceitar (recomendado) ou rodar as lutas no servidor, gastando cota?
15. (v2) **Duelo:** 3 minutos para quem caiu voltar e nenhum tempo limite por turno na primeira versão (recomendado)?
16. (v2) **Chat privado do mestre com um jogador:** pode existir (recomendado: sim; o privado entre dois jogadores continua fechado para você)?
17. (v2) **Treino turno a turno:** dado com semente, com "repetir esta luta" e "nova semente" (recomendado), ou dado sempre aleatório?
18. **Testes fora da faixa que você liberou:** a faixa liberada é só mescla, fila offline, desfazer, migração da mochila e robô/semente. Estes casos ficam fora dela e só entram com seu ok: (a) **esquema e proteção** — caminho com `__proto__`, NaN, texto no lugar de número (N1); (b) **permissão** — jogador mexendo em ficha alheia, `autorDeclarado` forjado, `baseRev` inválida, cota que adia em vez de negar (N2); (c) **projeção** — nota do mestre e ficha de NPC nunca chegam ao jogador (N2, T8); (d) **separar mudança da mochila em jogo** (A3); (e) **mídia** — hash errado e `.png` com HTML dentro (W3); (f) **chat** — privado não chega ao mestre, rajada barrada (C1). Recomendado: **liberar os seis** — são os que pegam vazamento e trapaça, e um script automático confere melhor que um roteiro manual. Sem o ok, cada um sai do código de teste e vira passo de roteiro manual (indicado em cada fatia e nos passos 12–13 da E1).
19. **Sigilo do chat privado entre jogadores:** o mestre não lê o privado pelo app nem pelo site — o código não deixa. Mas o limite real é este: o servidor roda na **sua** conta Cloudflare e o código é público, então o dono da conta (você) poderia, em tese, publicar uma versão do servidor que leia o privado. Outro caminho, este fechado no código (achado da revisão da C1): quem liga cada conta a um e-mail é você, então trocar o e-mail da conta da Nami pelo de uma segunda conta Google sua (o botão "Trocar o e-mail") ou reativar a conta removida com outro e-mail abriria o privado Nami-Zoro. O servidor guarda o e-mail de cada lado de quando a mensagem foi escrita e só mostra a conversa enquanto as duas contas têm esses mesmos e-mails: depois da troca o privado recomeça vazio **para os dois lados**, e o antigo volta se o e-mail voltar. O que o código não impede: dali em diante, quem escreve por aquela conta é o dono do e-mail novo. Texto do aviso, mostrado uma vez ao abrir o primeiro privado e sempre no rodapé dele: *"O mestre não vê esta conversa no app nem no site. Ela fica guardada no servidor da mesa, que é do mestre; quem controla o servidor poderia mudá-lo. Se a conversa sumir de repente, a conta do outro lado mudou de e-mail: confirme com a pessoa antes de continuar. Não escreva aqui nada que você não diria perto da mesa."* Basta esse aviso (recomendado para a v2: simples, sem custo) ou você quer **criptografia ponta a ponta** no privado (nem o servidor consegue ler; fatia própria, mais trabalho, e quem trocar de aparelho perde as mensagens antigas)?
20. **Perda possível no site (a ressalva do topo):** aba fechada **sem internet** com mudança a caminho, aviso ignorado e dados do navegador limpos depois = essas mudanças se perdem. Aceitar esse caso raro (recomendado: a edição nova já fica pausada sem internet, então é pouco, e o aviso de fechar aparece) ou **travar a edição no site** enquanto houver qualquer pendência (cada mudança espera o "Salvo" antes de deixar fazer a próxima; mais lento na mesa)?
21. **Pasta DBT na v1:** no DBT, os campos de um bloco andam juntos, então dois campos diferentes do mesmo bloco brigariam (contra a lei "campos diferentes nunca brigam"). Bloquear publicar pasta DBT na v1 e liberar quando o bloco for detalhado campo a campo (recomendado; v1 é One Piece) ou detalhar o DBT já na v1 (mais trabalho na N1 e mais casos de teste)?

### Respostas do usuário (05/11/2026)

- **Ordem:** a trilha da mochila (D1, A1, A2, A3) vem **primeiro**, só no app, sem nuvem. O usuário testa nos mapas da pasta One Piece antes de o site existir. Pedido literal: "No programa em si sem ser no site tambem é bom [...] tirando o mapa teste tudo faz parte da mesma campanha ou seja mesmo que mude de mapa/aventura seria legal manter os itens".
- **12.2:** a mochila do mapa salvo por último vale; as diferenças das outras cenas vão para o relatório (recomendação aceita).
- **12.18:** os seis grupos de teste foram **liberados** (a até f).
- **12.1, 12.3 a 12.12, 12.20 e 12.21:** recomendações aceitas ("Aceitar todas"): login só para e-mails convidados; o jogador mexe à vontade na própria mochila, com os aumentos destacados; troca de imagem pelo site fica para depois; desfazer só no site; ficha sem conta aparece só para ver; "Configurar só neste mapa" (Mapa de Teste) fica fora do Lobby; nota do mestre e NPC ficam escondidos; o wrangler pode ser instalado; ações na mesa LAN aparecem como do jogador, "atestado pelo app"; CSP no app logo depois da v1; print com ficha real é bloqueado; a perda rara no site é aceita; pasta DBT fica para depois.
- **12.13 a 12.17 e 12.19 (v2):** perguntar quando a v2 começar.
- **Cotas:** refazer a conta da seção 7 para os 11 jogadores da pasta One Piece antes da W1.
- **Tela do mestre "Jogadores do Lobby" (pedido de 05/11):** no app (Configurar da pasta) e no site (só para o mestre), com nome, conta do app, e-mail Google, situação (convidado, já entrou, último acesso), as fichas ligadas a cada jogador (um jogador pode ter várias) e as fichas sem dono. O convite é automático: o app inclui o e-mail na lista do Access pela API da Cloudflare. Fatia nova **W4** (convite pela API, permissão exata a conferir na doc; a chave é criada pelo usuário) e a A6 ganha a aba. O protótipo vem antes, para aprovar.
