# Plano do chat dos jogadores

Desenho do `arquiteto-solucoes` em 27/09/2026. Pedido e decisões do usuário: `PEDIDOS.md` (`7953006e`, `c32c5f86`).

Decisões do usuário: "sala" = mesma cena/mapa; canal da cena + canal global; mestre lê tudo (cena só leitura) e escreve no global; histórico no PC do mestre, jogador que volta vê de novo; imagem até 5 MB, vídeo até 25 MB; "@" marca jogador, que recebe destaque.

## 1. Mídia por HTTP, não pelo socket

O socket (axum, `desktop/src-tauri/src/net/server.rs`) corta frame > 64 KB (`:22`, `:361`), 30 msg/s (`:24`), fecha em binário (`:497`), fila de saída 256 (`:37`). Vídeo de 25 MB em base64 seria ~520 pedaços, duas travessias Rust↔webview por pedaço, fila estoura, perde tudo numa queda.

Fluxo:
1. jogador `chat.upload.ask` pelo socket;
2. host valida e pede ao Rust um ticket (comando novo `net_media_ticket`, registrado em `lib.rs`): uso único, 120 s, tipo e teto fixos, dono = `playerId` (não a conexão);
3. host responde `chat.upload.ready {url}`;
4. jogador `POST /media/up/{ticket}` com bytes crus;
5. Rust grava em disco em pedaços e emite `net:media {ticket}`;
6. host espalha `chat.msg` com `media`.

A rota `/media/{id}` já existe como esboço (`server.rs:326`, `media_stub :796`). `GET /media/{id}` precisa de `Range` (um intervalo por pedido) escrito à mão; não há `tower-http` e dependência nova só com aviso (regra 12).

## 2. Pasta e formato

Hoje a mesa vive no localStorage `lb-mesa:<tableId>` (`client/src/lib/savedTable.ts:42`); `tableId` = id da aventura ou do mapa (`App.tsx:384`). Mapas em `$APPDATA/maps/<id>/` (`client/src/lib/mapFileIO.ts:209`).

Chat em `$APPDATA/chat/<tableId>/`: `global.jsonl`, `cena-<sceneKey>.jsonl` (`sceneKey` = `MapData.id`), `media/<id128hex>.<ext>`. Fora de `maps/<id>/` para exportar/duplicar aventura não levar conversa (`mapExport.ts:36`). `tableId` e `sceneKey` casam `^[A-Za-z0-9_-]{1,64}$` e passam por `assertPathWithinRoot` (`mapFileIO.ts:235`).

Linha do JSONL: `{id, at, from, fromMaster?, text, mentions[], media?:{id,kind,mime}}`. Nome enviado pelo jogador é descartado; nome em disco = id gerado pelo Rust. Texto: append pelo lado TS numa fila em ordem. Mídia: gravada pelo Rust. Ao abrir, carrega as últimas 200 linhas por canal e pula linha quebrada.

## 3. Protocolo

Jogador para host:
- `chat.send {reqId, channel:'cena'|'global', text, mentions[]}`
- `chat.upload.ask {reqId, channel, kind:'image'|'video', bytes, text?}`

Host para jogador:
- `chat.history {channel, messages[]}` (substitui a lista do canal)
- `chat.msg {channel, msg}`
- `chat.send.result {reqId, ok, reason?}`
- `chat.upload.ready {reqId, url}`, `chat.upload.result {reqId, ok, reason?:'too_big'|'bad_type'|'too_soon'|'quota'}`

O jogador nunca recebe `sceneKey`, só `cena`/`global`.

Costuras: `PlayerMessage` `protocol.ts:974-1023`, `HostMessage` `:1574`, `parsePlayerMessage` `:2715` (casos ~`:2802`), `parseChatMessage` novo ao lado de `parseLetterMessage` `:2303`. `hostSession.ts`: switch `:7969-7972` ganha `chat.*`, handler novo no molde de `handleLetterSend` `:7651`. Cena do jogador: `sceneFor(playerId)` `:3534`; `null` (aguardando) = só global. Troca de cena: quando `tellScene` `:3638` registra cena nova, manda `chat.history` dela; também no join/volta, junto de `notes.book` `:3736`. `fogFilter.ts` fica fora: o corte é por canal.

## 4. Segurança

- Texto até 1000 caracteres; remove controle (menos `\n`) e bidi (U+202A-202E, U+2066-2069). Render só texto do React: sem `dangerouslySetInnerHTML`, sem autolink.
- Bytes mágicos no Rust, no primeiro pedaço: png `89 50 4E 47 0D 0A 1A 0A`; jpeg `FF D8 FF`; gif `GIF87a`/`GIF89a`; webp `RIFF....WEBP`; mp4 `ftyp` no offset 4 com marca isom/mp41/mp42/avc1/iso2..6/M4V; webm `1A 45 DF A3` + DocType `webm`. SVG fora. Marca `qt  ` (.mov): decisão do usuário pendente.
- Tamanho pelo teto do ticket, contado no stream (não confia em Content-Length). Grava `.part`, renomeia só se passar, apaga em qualquer falha.
- GET: Content-Type pelo tipo detectado, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: sandbox`, id de 32 hex.
- POST passa por `origin_allowed` (`server.rs:383`).
- Taxa: texto 1 por 700 ms com rajada de 5; mídia 1 ticket em andamento, 10 por 10 min, cota em disco por mesa.
- Menções refeitas pelo host: só jogador da mesa (no canal da cena, só quem está nela), como `handleLetterSend:7655`.

## 5. Fatias (um commit cada, na main, em sequência, um dono por vez)

- **A. Texto + @.** `protocol.ts`, `hostSession.ts` (histórico em memória), `hostBridge.ts`, `player/playerConnection.ts` (`handleMessage:2808`, casos `:2941`, `:3088`), `player/PlayerPanel.tsx:106` (aba `chat`), `PlayerChat.tsx` novo. Vermelhos: `hostSession.chat.test.ts` (cena A não vê cena B; global chega a todos; menção inexistente cai; `too_soon`; aguardando só tem global; trocar de cena manda `chat.history` da nova) e `main.chat.test.tsx` (`<img onerror>` vira texto; menção a mim acende ponto na aba).
- **B. Histórico em disco.** `lib/chatStore.ts` novo, dependências em `hostBridge.ts:286` no molde de `loadTable`, ligação em `App.tsx:633`. Vermelhos: `chatStore.test.ts` (ida e volta, linha quebrada pulada, teto 200, `sceneKey` com `..` recusado), `hostBridge.chat.test.ts` (quem volta recebe histórico; append a cada envio).
- **C. Imagem e vídeo.** `server.rs` (rotas `:321`, `:796`; `Room` `:87` ganha tickets e pasta), `net/magic.rs` novo, `commands.rs`, `lib.rs`, depois TS. Rust: png 201 e arquivo criado; `.exe` renomeado 415 sem arquivo; 25 MB + 1 dá 413 sem `.part`; ticket reusado 410; `Range: bytes=0-99` 206; GET com `nosniff`. TS: `upload.ask` acima do teto `too_big`; `net:media` vira `chat.msg` com `media`; tela usa `src=/media/<id>`, nunca o nome enviado.
- **D. Leitura do mestre.** `hostSession` expõe canais por cena; `session.masterChatSend` só no global; `MasterChatPanel.tsx` novo. Teste: canal de cena sem campo de escrita; mensagem do mestre chega a todos com `fromMaster`.

Donos: `programador-frontend` (A, B, D, TS da C); `programador-rust` (rota, magic, testes Rust); `engenheiro-desktop` revisa o comando IPC novo. Revisão de segurança dedicada depois de A e depois de C.

## 6. Em aberto

- `.mov`/HEVC do iPhone.
- Mídia acessível a quem tiver o id (128 bits, só chega a quem tem direito ao canal).
- Cota em disco por mesa; mestre apagar mensagem/mídia.
- Quem chega numa cena vê a conversa anterior (proposta: sim).
- Mestre envia mídia no global; `@mestre`.
