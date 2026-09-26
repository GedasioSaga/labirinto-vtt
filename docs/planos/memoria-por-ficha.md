# Memória por ficha — plano curto

Pedido da torre (6 vozes; lotes 4, 5 e 6): a memória do mapa é do jogador
(`memories`, por `playerId`, em `net/hostSession.ts`). Passar a ficha não
passa o que ela viu: Marina recebe a Lia e vê tudo preto; quem chega no meio
da campanha e pega uma ficha que já andou começa do zero; o que o substituto
explorou com a ficha fica com o substituto quando ela volta à dona.

## Dado novo e onde mora

- **`tokenMemories` na sessão do host**, ao lado de `memories`: por id da
  FICHA, uma memória por cena (mesmo formato da do jogador: explorado,
  portas lembradas com a ordem em que foram vistas). Mesmo teto de cenas
  (`MAX_SCENE_MEMORIES_PER_TOKEN`, igual ao do jogador).
- **`MapData` não muda.** A memória mora na sessão, como a posse e a memória
  do jogador já moram hoje: nada vai para o `map.json`, então mapa salvo
  antigo abre igual (nenhum campo novo no arquivo, `deserializeMap` intocado).
- `lib/exploration.ts` ganha `mergeExploration(destino, origem, proibido)`:
  soma o explorado da ficha ao do jogador, pulando célula que toca área
  proibida AGORA e contorno que encosta nela.
- `lib/fogFilter.ts` ganha `PlayerMapView.eyes`: a visão de CADA ficha que é
  olho do jogador (e as portas que ela vê). Só o host lê; não sai pela rede.

## Quem grava

- **O host, a cada snapshot** (`snapshotFor`): depois do recorte, cada ficha
  que é olho do jogador marca na memória DELA só o anel de visão DELA (com o
  mesmo `blocked` e o mesmo `forgetInside` do teto que a memória do jogador
  usa). Ficha do mestre (sem dono), ficha escondida e ajudante sem visão não
  marcam nada.
- **"Esconder planta"** apaga também a memória das fichas que o jogador tem
  (da cena, ou de todas) — senão a ficha devolveria a planta no broadcast
  seguinte.
- **O kick NÃO apaga** a memória da ficha: é ela que o próximo jogador herda.

## O que o jogador recebe

- A memória dele passa a ser: a dele mesmo + a de cada ficha que é olho dele
  NESTA cena. A soma acontece antes do recorte, então o que chega é o mesmo
  `explored` e as mesmas portas lembradas de sempre — nenhuma mensagem nova,
  nenhum campo novo no fio.
- Porta lembrada: vale o estado visto por último (da ficha ou dele).

## O que ele NUNCA recebe

- O que OUTRA ficha do dono anterior viu: cada ficha guarda só o próprio anel.
- Célula que hoje está em zona oculta ativa, sala secreta ou teto: a soma
  pula (`playerBlockedRings`), mesmo que a ficha tenha visto antes de o
  mestre esconder.
- Memória de outra cena: só entra a da cena onde o jogador está.
- Memória de ficha que ele segura sem ser olho (ajudante sem visão).
- `eyes` do recorte: fica no host.

## Fica para depois

- Guardar a memória das fichas em disco (`mesa.json`/retomar a mesa): hoje
  some ao fechar a sala, como a do jogador.
- "Levar o que este personagem viu / Começar do zero" no Passar a ficha.
- Cartão "Até aqui" para quem chega; raio de visão por ficha.
- Quem perde a ficha continua lembrando o que viu com ela (memória própria);
  tirar isso é decisão de produto.
- Teto por bytes em vez de 8 cenas (ficha e jogador).
