# Sons ao vivo, F5: plano técnico (23/10/2026)

Plano do arquiteto (só leitura) para a F5 de `docs/planos/sons-ao-vivo-2026-10-23.md`: o jogador e a tela da mesa tocam, com a faixinha "toque para ouvir", e o servidor em Rust entrega o arquivo só a quem o host liberou. Este documento é o CONTRATO entre as fatias F5a (Rust) e F5b (TypeScript). Não reabrir sem avisar o orquestrador.

## Achado que vem primeiro

Os sons provavelmente JÁ saem hoje por `/media/{id}`, sem chave nenhuma, desde a F1. A importação grava o áudio em `<appData>/midia` (`lib/sons/bibliotecaNoDisco.ts:6` usa `guardarAudio`; `lib/midiaNoDisco.ts:23` aponta `pastaDaMidia` para `appDataDir/midia`). É a pasta que `media_file` serve (`server.rs:837-845`, configurada em `commands.rs:263`), sem token e sem limite por IP. O oráculo 200/404 e o download existem desde a F1. Fechar isso quebra a dança, que baixa a música por `/media` (`minigames/danca/tela/musicaImportada.ts:35`); por isso virou a fatia F5d, que precisa entrar no mesmo dia da mudança na dança. O primeiro teste da F5a confirma o achado (importar som, `GET /media/<id>` devolve 200 hoje).

## 1. O que existe e o que falta

- **Rust:** `media.rs:112` `tipo_do_id`, `:122` `tipo_dos_bytes`, `:167` `ler_midia` (usa `metadata`, que segue symlink, e não confere caminho real). `server.rs`: `next_id` `:570`; `kick` `:273-279` e a saída do loop `:538-539` limpam a conexão; `limit_key` e `effective_client_ip` `:427-453` já servem para limite por IP; `rand = "0.9"` já está no Cargo. Falta: chave por conexão, liberação por conexão, pasta da aventura, rota segura.
- **TypeScript:** o host já anota `midiasLiberadas` por conexão (`hostBridge.ts:1626`, limpa em `:1635`). A saída é ordenada por cliente (`sendToClient` `:1536`, `criarSaidaEmOrdem` em `pacoteComprimido.ts:208`). O jogador guarda os loops (`playerConnection.ts:3086-3110`, `:4165`) e limpa na queda (`handleSocketLost`). O motor recebe o carregador por injeção: `criarMotorAoVivoDoNavegador(carregarBytes)` em `motor.ts:731`, com evento `esperando` (`:155`) e motivo `sem-gesto`. A TV é outra raiz: `TableApp` em `player/TableScreen.tsx:136`, conexão criada em `:150`. Falta: carregador, instalador, faixinha e o envio da chave.

## 2. Desenho do servidor (rota nova `/sons/{id}`; `/media` intacta até a F5d)

- **Chave por conexão:** o Rust sorteia 32 bytes (`rand::rngs::OsRng`) em `handle_socket`, logo depois de `await_join`, e envia `{"type":"midia.chave","chave":"<64 hex>"}` como PRIMEIRO frame da fila (antes do `insert` em `:491`), portanto antes do `welcome` do host. A chave nunca passa pelo IPC: o host só conhece `clientId`. A TV é uma conexão ws comum (`?mesa`) e recebe a chave do mesmo jeito.
- **Estado no Rust** (`net/sons.rs`, `Room.sons: Mutex<SonsDaSala>`): `raiz: Option<PathBuf>` canônica, `chaves: HashMap<[u8;32], ClientId>`, `liberadas: HashMap<ClientId, HashSet<String>>` (teto de 256 por conexão) e `em_voo` por chave. `esquecer(client_id)` roda em `:538` e em `kick`. Trocar a aventura zera todas as liberações. Fechar a sala derruba o `Room` inteiro.
- **Liberar sem corrida:** `net_send` ganha o parâmetro opcional `liberar: Option<Vec<String>>`. No Rust: valida cada id (`tipo_do_id` mais `eh_audio`, até 32), libera e só então faz `try_send`; se o envio falhar, desfaz a liberação. No TypeScript, o callback de `sendToClient` passa `liberar = midiasDaMensagem(carga)` (puro, novo `net/liberacaoDosSons.ts`): `som.tocar` devolve `[fonte.midia]`, `som.precarregar` devolve `midias`, o resto devolve nada. Assim a ordem por cliente vem de graça e o liberado é, por construção, exatamente o que saiu para aquela conexão. Entrar, voltar, sair e mudar a audiência já passam por `reconciliarSons` e `dispatch`, então a pré-carga reconcilia sozinha. REVOGAR é implícito: queda, kick, `session.replaced` (já vira `net_kick` em `hostBridge.ts:3182`), troca de aventura e fim da sala. Não há comando de revogar (YAGNI).
- **Pasta da aventura:** comando novo `net_sons_aventura({ pasta: string | null })`. Exige caminho absoluto, diretório, sem symlink (`symlink_metadata`) e `adventure.json` presente. Guarda `canonicalize(pasta/midia)`. Quem chama: a ponte, ao registrar a rede (`hostBridge.ts:3667-3668`) e a cada mudança de `useBibliotecaDeSonsStore.dir`. É só uma assinatura de leitura, sem editar `adventureStore`.
- **Ordem do handler `/sons/{id}`:**
  1. só GET;
  2. `Host` literal ou o túnel (como `dev_fallback_permitido` `:776`);
  3. taxa por IP (30 por 10 s em `limit_key`) e buscas simultâneas (2 por chave, 6 no total): 429 com `Retry-After`, decidido ANTES de olhar o id;
  4. cabeçalho `X-Labirinto-Chave` (64 hex) mapeia a conexão;
  5. id liberado àquela conexão;
  6. `symlink_metadata` não pode ser link; `canonicalize(arquivo).starts_with(raiz)`;
  7. o resto de `ler_midia`: teto de 15 MB, assinatura, hash; leitura e hash em `spawn_blocking`.
  Qualquer recusa responde o MESMO 404: corpo vazio, `Cache-Control: no-store`, `nosniff`. O 200 leva tipo pela assinatura, `nosniff`, `no-store` (a URL não leva a chave, então cache imutável vazaria entre sessões), `Cross-Origin-Resource-Policy: same-origin` e `Vary: X-Labirinto-Chave`. Sem Range.
- **Erros dos comandos** (texto fixo): `sem-sala`, `cliente-invalido`, `midia-invalida`, `limite-de-liberacao`, `pasta-invalida`.

## 3. Lado TypeScript

- `player/carregadorDeSons.ts`: `criarCarregadorDaSala({ chave, buscar })` devolve um `CarregadorDeBytes`. Recusa sem rede quando o id não passa em `ehIdDeAudio` ou não há chave. `fetch('/sons/'+id)` relativo, com o cabeçalho, `cache:'no-store'`, `credentials:'omit'`, `redirect:'error'`. Confere 200, `Content-Type` `audio/*` e teto de 15 MB (`Content-Length` e corpo). Em 429, uma nova tentativa dentro do `PRAZO_DO_CARREGAMENTO_MS`.
- `playerConnection.ts`: `case 'midia.chave'` com validação de 64 hex; expõe `chaveDaMidia()` e zera a chave na queda e em kicked, closed e replaced.
- `player/sonsAoVivoDoJogador.ts`: `instalarSonsAoVivo(conexao)` cria o motor e liga `ouvirSons` ao motor (`midia` vira `ref 'midia:'+id`). Recusa do motor vira `informarSomFalhou` com motivo da lista fechada. Loop em `esperando` vira `sem-gesto` uma vez, para o mestre saber que a TV não destravou. Status closed, kicked, replaced, error ou socket caído chama `pararTudo()` (precisa assinar o estado: a conexão limpa `loopsVivos` mas não avisa os ouvintes). Instalado ao lado de `main.tsx:2321` e no `TableApp`.
- `player/FaixaTocarParaOuvir.tsx`: montada em `main.tsx` (PlayerApp) e em `TableScreen.tsx`, NUNCA em `PlayerView.tsx`. Aparece com `esperando` e some com `tocando` ou fila vazia. No mesmo gesto, de forma síncrona: destrava o contexto (`contexto.ts`) e prepara 2 `<audio>` de reserva (`play()` de silêncio e `pause`). O `criarElementoDeAudio` do motor (`motor.ts:737`) passa a tirar da reserva: `criarMotorAoVivoDoNavegador(carregar, { reservas })`. `createMediaElementSource` vale uma vez por elemento; são 2 áudios grandes por gesto no iOS e a reserva é reposta no próximo toque. No Android a ativação do usuário fica valendo depois do primeiro toque, então basta o `resume`. Loop que chega antes do gesto espera sem prazo e começa no deslocamento corrigido (o motor já faz). Efeito curto expira em 2 s.
- **Mestre:** `PaginaSons` chama a ponte com alvo Todos e dispara a pré-carga dos favoritos de até 1 MB ao abrir a sala e ao carregar a biblioteca. `precarregarSonsAoVivo(midias, alvo?)` tem alvo opcional (ausente igual a Todos): a F5 passa SEMPRE o alvo.
- **Onde o auditor deve olhar:** URL montada só do id validado; chave fora de log, de toast e do `som.falhou`; Blob URL revogada; nenhum texto do host na faixinha; liberação só para quem recebeu a mensagem.

## 4. Fatias

- **F5a, `programador-rust`:** `net/sons.rs`, `server.rs` (chave, rota, limpeza), `commands.rs` (`net_send` com `liberar`, `net_sons_aventura`), `lib.rs` (registro), `tests/net_sons.rs`. Primeira linha de cada arquivo de `tests/`: `#![allow(clippy::unwrap_used, clippy::expect_used)]`. Portão: `cargo clippy --all-targets --all-features -- -D warnings -W clippy::unwrap_used -W clippy::expect_used` e `cargo test`.
- **F5b, `programador-frontend`:** todo o item 3, o callback de `sendToClient`, `ponteDosSons.ts` e o e2e. F5a e F5b podem rodar em paralelo: o contrato acima está congelado e o e2e usa o Rust de mentira (`e2e/helpers/mestreDeMentira.ts`, `page.route('/sons/*')` exigindo o cabeçalho). A prova real (`tauri dev` mais navegador) fica para o fim e só sob pedido do usuário.
- **F5c, `programador-frontend` com as skills do Emil:** seletor de audiência (Todos, Só a cena, Escolhidos).
- **F5d, Rust e depois TypeScript:** áudio em `/media` passa a exigir chave e liberação (imagem não muda); a dança manda o cabeçalho e o host libera a música dela. Entra no mesmo dia, senão a dança quebra na main entre os dois commits.

## 5. Arquivos quentes

F5a fica só em `desktop/src-tauri`. F5b toca `hostBridge.ts` (cerca de 5 linhas em `:1536` e na ponte), `playerConnection.ts`, `player/main.tsx`, `TableScreen.tsx`, `motor.ts` e `PaginaSons.tsx`; não toca `hostSession.ts`, `types/map.ts`, `fogFilter.ts`, `PlayerView.tsx` nem `adventureStore`.

## 6. Testes de aceite (vermelhos antes)

- **Rust:** `oraculo_todas_as_recusas_sao_o_mesmo_404` (sem chave, chave inventada, chave de outro, não liberado existente, liberado inexistente, id torto, mais de 15 MB, symlink, png com nome de mp3: status, cabeçalhos menos `date` e corpo idênticos byte a byte; mutações: 403 no não liberado, `no-store` faltando num caminho); `chave_e_o_primeiro_frame_e_unica_por_conexao`; `liberado_a_ana_nao_serve_ao_bruno`; `queda_e_kick_apagam_a_chave` (mutação: tirar a limpeza de `:538`); `symlink_e_juncao_nao_saem` (com unidade pura de caminho, porque symlink no Windows pode exigir privilégio); `trocar_aventura_revoga_e_so_serve_a_aberta`; `taxa_e_simultaneas_dao_429_igual_para_id_valido_e_invalido`; `tipo_pela_assinatura_com_nosniff`; `net_send_libera_antes_e_desfaz_se_falhar`; `liberar_recusa_imagem_e_id_torto`; F5d: `media_audio_sem_chave_404` e os `/media` de imagem seguem verdes.
- **TypeScript:** `carregadorDeSons.test` (cabeçalho, sem rede para id torto ou sem chave, 404, tipo errado, teto); `playerConnection.chave.test`; `sonsAoVivoDoJogador.test` (mutação tirando um dos 4 fins de sessão fica vermelha; loop pego no meio; curto descartado depois de 2 s com `sem-gesto`); `hostBridge` libera só a quem recebe, TV no Todos (mutação: liberar a todos); `FaixaTocarParaOuvir.test` (reservas preparadas dentro do handler); `main.sons.test` (instalado no PlayerApp e no TableApp); e2e `task-sons-ao-vivo-arquivo` (nada toca antes do gesto, faixinha, deslocamento, 1 busca para 2 toques, pré-carga, 2 MB por `<audio>` com seek, `room.closed` para, a TV toca).

## 7. Riscos e o que não foi verificado

- Não verificado: o vazamento de hoje por `/media` (o primeiro teste da F5a confirma); iPhone e Android de verdade (F7); banda do túnel com 15 MB sem Range; se comando próprio do app fica invocável na janela Visão de jogador (`WebviewUrl::App`, sem `build.rs` restringindo; risco baixo, o auditor deve olhar).
- Riscos: hard link não é detectável (o hash do conteúdo o torna inofensivo); 6 vezes 15 MB em memória chega a cerca de 90 MB no pico; a pré-carga de 16 jogadores pode bater no limite de taxa (medir e calibrar).
- Custo estimado em chamadas de agente: F5a cerca de 4 (implementar, revisor de segurança e auditor, correção); F5b cerca de 5; F5c cerca de 2 a 3; F5d cerca de 3.
