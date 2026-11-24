# Plano: Cegueira no app

Fonte: protótipo aprovado (`prototipo.html`, estado 5; `NOTAS.md`, commit 02d34ac1) e PEDIDOS.md, 23/11 19h19 em diante. O Companion é outra frente; daqui só se lê `temCegueira` de `lib/caracteristicas/tipos.ts` e o campo `Personagem.caracteristicas`.

## A regra

- A ficha com Cegueira enxerga com o raio pela **metade**, em todo recorte do host (snapshot, porta, item, alavanca, tela da mesa, batalha: todos passam pelo mesmo raio).
- Quem está até o raio **normal** dessa ficha, medido de centro a centro, e não saiu no recorte, chega ao jogador só como **onda**: a posição, nada mais. A parede não para a onda; quem está atrás de parede dentro da metade também vira onda.
- O mestre vê tudo como hoje e vê a tela do cego pelo "Ver tela" do Grupo (a janela de visão de jogador já usa o recorte real).

## Como a visão funciona hoje (mapa)

1. `net/hostSession.ts:2936` `tokenRadiusIn(playerId, map)` monta o raio de cada ficha (dono da emprestada, "Visão nesta cena", fator, período). Todo recorte recebe esse raio (41 chamadas).
2. `lib/fogFilter.ts:2814` `filterMapForGroup` → `recorteDoGrupo`: `radiusByToken` (2877), `radiusOf` (3001: Sala com "Raio de visão aqui" vence, fumaça só reduz), anéis por olho em `sightFrom` (3452, raycast de `lib/visibility.ts`), fichas que saem em `playerTokens` (4699, centro + 8 pontos da borda contra os anéis), lista branca `tokenForPlayer` (1975).
3. `hostSession.ts:3640` `snapshotFor` põe o recorte no `snapshot` (`net/protocol.ts:2330`); `net/viewPatch.ts` manda só o que mudou (`patch`).
4. Jogador: `player/playerConnection.ts` (`recusarTela`, `applySnapshot`, `applyPatch`, `PlayerState`) → `player/PlayerView.tsx` (`redraw`, névoa por máscara em `redrawFog`, fichas acima da névoa).

## Contrato do fio

- `snapshot`, `delta` e `patch` ganham `ondas?: { x: number; y: number }[]`: o centro de cada onda em px de mundo, arredondado, em ordem de posição (y, depois x), sem repetidos. Nunca id, nome, retrato, tamanho, cor ou piso.
- Só sai para quem tem pelo menos um olho cego com alguém na faixa. Ausente = nenhuma onda (o snapshot de quem não é cego fica idêntico ao de hoje, e o golden não muda).
- O jogador confere o campo (lista de pontos finitos, no máximo 200) e ignora o torto.

## Fatias (1 commit cada)

1. **Host.** `lib/fogFilter.ts`: marca `comCegueira(raio, cegas)` no raio (como `raioDoPeriodo`); `radiusOf` divide por 2 a ficha cega depois da Sala e antes da fumaça; `PlayerMapView.ondas` calculado no `recorteDoGrupo`. Fica fora da onda: ficha escondida, fora da camada do jogador, "Oculto para jogadores", em sala secreta fechada, em zona oculta, levada por outro piso, e todo o recorte visto de cima (terreno alto). `net/hostSession.ts`: o conjunto de fichas cegas vem de `world.rpg.personagens` (`temCegueira`) e entra no `tokenRadiusIn`; `snapshotFor` põe `ondas`. `net/protocol.ts` e `net/viewPatch.ts`: o campo. Testes: metade do raio e onda atrás da parede (fogFilter); o recorte do cego sem nome nem id de quem é onda (hostSession).
2. **Jogador.** `player/playerConnection.ts`: estado `ondas`, conferência e patch. `player/ondasDaCegueira.ts` (conta pura do anel) e `player/camadaDasOndas.ts` (Pixi): 3 anéis de pergaminho, 2,1 s cada, um a cada 700 ms, abrindo em linha reta de 0,18 a 1 (2,6 casas), opacidade 0 → 0,85 aos 14% → 0; miolo parado; fase por onda; entra em 150 ms, sai na hora; movimento reduzido = anéis parados (0,4/0,7/1 com 0,62/0,40/0,22). Camada logo abaixo das fichas, acima da névoa. Só escala e alfa por quadro; sem onda, o ticker não faz nada.
3. **Provas e diagrama.** Folha de contato de 12 quadros no app, gráfico do raio a cada 0,1 s, p95 do quadro no maior mapa com e sem onda, tarefas longas, prova por gestos numa cópia dos dados do dono, prints em `tmp/cegueira-app/`, diagrama `docs/diagrams/cegueira.html` e linha no INDEX.

## Riscos

- **Vazamento.** A onda é a única coisa nova que sai; o teste do recorte procura nome e id no JSON inteiro do snapshot. A ordem das ondas é por posição para não repetir a ordem das fichas.
- **Noite e luz.** À noite a metade vale para o raio; o claro das luzes na linha de visão continua contando como hoje (a Cegueira corta o raio, não apaga a luz). Se o dono quiser o cego sem luz de longe, é uma linha a mais.
- **Teto fechado não para a onda** (é parede); sala secreta e zona oculta param (são segredo do mestre). Decisão minha, pela regra "a parede não para a onda".
- **Tela da mesa (TV)** recebe a metade do raio, mas não as ondas (é a tela do grupo).
- **Arquivos do Companion** (batalha, ficha) não são tocados; se `hostSession.ts` tiver mudança dele no mesmo commit, o commit leva só os meus pedaços.
- **Desempenho.** A onda custa olhos cegos × fichas da camada por recorte (distância ao quadrado, sem raycast). No jogador, 3 anéis por onda só com escala e alfa.
