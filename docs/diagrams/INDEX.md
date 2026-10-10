# Diagramas do Labirinto

- [visao-de-jogador](visao-de-jogador.html) — Visão de jogador: ponte de teste no editor sobre o mundo vivo + camada descartável, tela real do jogador na segunda janela pelo canal, pedidos e fantasma de volta ao editor — fontes: client/src/net/visaoDeTeste/, client/src/player/visaoDeTeste/, client/src/pixi/fantasmaDeTeste.ts, client/src/components/Toast.tsx, desktop/src-tauri/src/visao_jogador.rs
- [vinculo-regiao-parede](vinculo-regiao-parede.html) — do gesto na barra de ferramentas até a parede na tela: ferramentas de sala convergem no modelo de N pontos vinculados — fontes: client/src/pixi/PixiCanvas.tsx, client/src/stores/mapStore.ts
- [arquitetura-render-editor](arquitetura-render-editor.html) — arquitetura de render do editor (camadas do Pixi) — fontes: client/src/pixi/
- [chat-envio-midia](chat-envio-midia.html) — sequência do envio de imagem e vídeo no chat — fontes: client/src/net/, client/src/player/
- [gauntlet-loop-v2](gauntlet-loop-v2.html) — como uma rodada do gauntlet loop anda (processo de trabalho, não código do app)
- [pacote-de-animacoes](pacote-de-animacoes.html) — atualização automática e pacote de animações: scripts assinam com a chave do mestre, GitHub entrega, Rust verifica, registros no editor (transição, porta, cenário, textura, carimbo) e servidor da sala para o jogador — fontes: scripts/publicar-versao.cjs, scripts/pacote-animacoes.cjs, desktop/src-tauri/src/net/animacoes.rs, client/src/lib/pacoteDeAnimacoes.ts, client/src/lib/atualizacao.ts
