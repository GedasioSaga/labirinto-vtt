# Explorador: site do Lobby (26/11/2026)

Só leitura. Árvore da main suja (outro agente no rework de itens); os achados valem para o HEAD 8447a266 salvo aviso.
Caminhos relativos a `client/src/` quando não dito.

## 1. BUILD QUEBRADO: a cadeia exata até o `@tauri-apps`

Erro real (rodei só o passo `vite build --config vite.lobby.config.ts`; o `tsc --noEmit` do `build:lobby` não terminou em 5 min nesta máquina e foi cortado):

    [plugin lobby:guarda-de-import] site do Lobby não pode importar "@tauri-apps/api/core"
    (importado por C:/dev/labirinto/client/src/stores/acervoDeItensStore.ts)

Cadeia (grafo de import estático, do site até o Tauri):

1. `lobby-site/main.tsx:7` importa `lobby-site/telas/Site.tsx`
2. `lobby-site/telas/Site.tsx:16` importa `lobby-site/telas/TelaFicha.tsx`
3. `lobby-site/telas/TelaFicha.tsx:9` importa `player/PlayerFicha.tsx`
4. `player/PlayerFicha.tsx:4` importa `components/dbt/registroDeFichas.ts`
5. `components/dbt/registroDeFichas.ts:4` importa `components/FichaDePersonagem.tsx`
6. `components/FichaDePersonagem.tsx:13` importa `components/FichaAbas.tsx`
7. `components/FichaAbas.tsx:4` importa `components/EquipamentoDaFicha.tsx`  (no HEAD, linha 5)
8. **`components/EquipamentoDaFicha.tsx`** abre DOIS ramos proibidos:
   - ramo A (o que o build acusa): `EquipamentoDaFicha.tsx:8` importa `stores/acervoDeItensStore.ts`, que na linha 4 importa `@tauri-apps/api/core` (e nas linhas 5-15 o `lib/acervoDeItens.ts`).
   - ramo B (o build acusaria logo depois): `EquipamentoDaFicha.tsx:4` importa `lib/mochila/acervoDaMochila.ts`, que na linha 1 importa `itemParaDar` de `lib/acervoDeItens.ts`, que nas linhas 1-2 importa `@tauri-apps/plugin-fs` e `@tauri-apps/api/path` (e na linha 10 o `lib/mapFileIO.ts`, que puxa `lib/fsDaJanela.ts`, `lib/midiaDaPasta.ts` e `lib/midiaNoDisco.ts`, todos com Tauri).

Quando quebrou: `030a5d29` (26/11 04:41, "sheet Mochila e equipamento tab replaces Armas and Itens (E4b)") criou o `EquipamentoDaFicha.tsx` e o pôs no `FichaAbas`. O `3459a8f6` mexeu em outro ciclo (o TDZ do `CATEGORIAS_DE_ARMA` no app), não neste.

Prova de que é o único elo: no grafo, tirando só o `EquipamentoDaFicha.tsx`, o site não alcança mais nenhum `@tauri-apps`, `pixi` nem `three` (881 módulos, zero proibidos). Ressalva: o grafo é por regex (import, export from, import()), não pelo Rollup; o build é a prova final.

### Conserto mínimo (só o `EquipamentoDaFicha.tsx` sai do caminho)

O componente só usa do Acervo o `item(id)` (tipo e pente). No site o store nunca carrega, então lá ele já funciona hoje com o Acervo vazio (`tipoDaVaga` e `penteDaArma` caem na cópia da vaga: `lib/mochila/armaNaMochila.ts` linhas 42-54).

- Menor de todos: o `EquipamentoDaFicha` recebe o Acervo de fora em vez de importar o store e o `acervoDaMochila`. Um módulo puro novo (contexto React ou store zustand mínimo, só com `itens: ItemDoCatalogo[]` por `import type`, padrão vazio) que o app preenche a partir do `useAcervoDeItensStore`; o componente monta o próprio Map por id (só precisa do `item`). Mexe em `EquipamentoDaFicha.tsx` linhas 4, 8 e 41-42, no módulo novo e no ponto do app que o alimenta.
- Recomendado junto (fecha o ramo B para qualquer import futuro): tirar `itemParaDar`, `efeitoParaDar`, `requisitosParaDar` e `municoesParaDar` de `lib/acervoDeItens.ts` (linhas 416-454) para um módulo puro (ex.: `lib/itens/itemParaDar.ts`), com re-export no `acervoDeItens.ts` para os chamadores não mudarem, e `acervoDaMochila.ts` linha 1 importando do puro. Conferi: o fecho do `lib/batalha/mecanica/resumoDoItem.ts` (a única dependência pesada deles) tem 105 módulos e nenhum Tauri. Hoje o comentário de `acervoDaMochila.ts` (linhas 4-8) diz que ele foi separado "para as regras puras não puxarem o disco do Acervo", mas a linha 1 puxa.
- Conferir: `npx vite build --config vite.lobby.config.ts` dentro de `client/` (sem o tsc, uns 2 s até a guarda).

## 2. Bugs CERTOS

- `lobby-site/telas/TelaAcesso.tsx:29` com `lobby-site/dados/fonteReal.ts:123` (e 128, 132): a frase vira "O Lobby respondeu 404 Tente de novo em instantes." sem ponto, porque o `detalhe` não termina em ponto e é colado com espaço. Vale também para "Resposta do Lobby fora do formato". É o achado A2 do passeio.
- `lobby-site/telas/TelaAcesso.tsx:32` ("Tentar de novo" = `window.location.reload()`) com `vite.lobby.config.ts` sem `server.proxy`: no dev (porta 1430) o `/api/eu` não existe, sempre dá 404, e recarregar nunca resolve. O site real só anda com `wrangler pages dev` (topo de `lobby/site/fumaca.mjs`) ou na demo `?demo=1` (`dados/rotas.ts:128`). A tela não diz nada disso. Em produção o reload é razoável; para 404 (portão ausente ou rota errada) nunca é.
- `lobby-site/telas/galeria/TelaGaleria.tsx:112` e 119: o fetch da Galeria não usa `redirect: 'manual'` (o `/api/eu` usa, `fonteReal.ts:118`). Com o login do Access vencido, o navegador segue o redirect para outra origem, falha por CORS e a tela mostra o texto cru do navegador ("Failed to fetch"), porque TypeError é Error e o texto "Sem rede: tente de novo." nunca aparece. Corpo que não é JSON (linha 115) mostra "Unexpected token..." em inglês. Não há botão de tentar de novo.
- Guarda de import sem teste: só o `build:lobby` a roda; nenhum teste nem e2e confere o grafo do site (o `lib/nuvem/pureza.test.ts` só vê globais do `lib/nuvem`). O build ficou quebrado por 28 commits sem ninguém notar.

## 3. Bugs INCERTOS (precisam de prova)

- Laço "Entrar com Google": `lobby/site/src/portao.ts` (linhas 146-171) devolve 401 `sem-acesso` também para AUD errado, `service-token-fora-do-mapa` e `sem-identidade`; o site trata todo 401/403 como "sem login" (`fonteReal.ts:122`) e o botão só recarrega (`TelaAcesso.tsx:21`). Com login Google válido e o portão mal configurado, a pessoa fica em "Entrar" para sempre, sem explicação. Depende de como o Access reage.
- Validador por campo com vaga falsa (`lib/nuvem/caminho.ts` linhas 922-923): cada `campoDoItem` é julgado lendo `{ id, nome, [campo]: valor }` e exigindo igualdade exata com o que o leitor devolve. Foi o caso da Tocha (`acesa` depende da `luz`, corrigido na linha 921). Hoje nenhum outro campo depende de irmão, mas qualquer valor que o leitor normaliza (categoria com espaço nas pontas, descrição acima do teto, `quantidade: 1` ou `equipado: false` explícitos numa vaga nova em `lerItemNovo`, linhas 906-908) é recusado. E o app usa o mesmo juiz antes de aplicar (`net/nuvem/emissor.ts` linhas 329-355): numa pasta publicada a recusa trava a própria mudança no app ("O Lobby não aceita esta mudança"). Campo novo do rework de itens que dependa de outro repete a Tocha.
- Duas regras para a mesma edição no site: a aba Mochila confere a permissão do dono ANTES de mandar e manda tudo ou nada (`lib/nuvem/mochilaDoJogador.ts` linhas 125-133); o Salvar da aba Ficha não confere nada e manda as mudanças soltas, sem `atomico` (`lobby-site/telas/TelaFicha.tsx` linhas 302-317). Se a edição tocar numa vaga ligada ao Acervo ou numa arma do livro, parte entra e parte volta recusada (ficha salva pela metade). Para o jogador, o `diferencas` com papel também tira calado o que é só do mestre (`lib/nuvem/diferencas.ts:53`): só a imagem ganha aviso (`TelaFicha.tsx:307`).
- Mochila pelo site sem o Acervo (`mochilaDoJogador.ts:41`, `ACERVO_DA_VAGA`): vaga dada antes do E1 (sem `tipo` e `regra.pente` copiados) não mostra Equipar nem Recarregar no site, e o app mostra. Não conferi se `net/nuvem/migracaoDaMochila.ts` preenche as vagas antigas.
- Devolver balas com efeito: Recarregar trocando de bala e Tirar arma carregada sobem a quantidade da pilha de balas; se a pilha tiver `efeitoResumo`, `permissaoNaFichaDoDono` nega ("o jogador só gasta", `lib/nuvem/permissao.ts` linhas 154-163). No app passa. Só é bug se existir bala com efeito.
- O comentário de `mochilaDoJogador.ts` (linhas 29-30) diz que o `tipo` da vaga "só o mestre grava"; o `tipo` não está em `CAMPOS_DO_ITEM_DO_MESTRE` (`caminho.ts:158`). Na vaga ligada ao Acervo, `permissao.ts` (linhas 108-111) o tranca; na vaga livre o dono muda o tipo. Efeito prático pequeno (vaga livre não tem regra de arma), mas o comentário engana.
- `lobby-site/telas/enviar.ts:31`: sem sessão (inclusive no "ver como", `dados/lobbyStore.ts:562`) a falha sai como "Sem internet". As telas já escondem a edição no "ver como", então só aparece em corrida.

## 4. Coisas erradas (sem repetir o levantamento de mecânicas duplicadas)

- A mochila aparece duas vezes no site: a aba Mochila (`telas/PainelMochila.tsx`, com Equipar, Guardar, Recarregar e Tirar) e, dentro da aba Ficha, a aba "Mochila e equipamento" do `FichaAbas` (E4b, com o `EquipamentoDaFicha` e o "Armas por batalha"). Duas telas com regras de envio diferentes (ver as duas regras acima). Está em obra no rework; vale decidir qual fica no site.
- O site importa a ficha inteira do app (`TelaFicha.tsx:9` para `PlayerFicha` para `FichaAbas`, com editor de batalha, livro e mecânicas). Toda peça nova da ficha do app entra no site sem ninguém perceber; foi assim que o Tauri entrou. Uma fronteira (o `FichaAbas` recebendo Acervo, imagens e livro por props ou contexto) evita a próxima quebra.
- `build:lobby` = `tsc --noEmit` do client inteiro (app e testes) antes do vite: o site não publica se qualquer arquivo do app tiver erro de tipo, e o passo é lento. A guarda de import, que é o que protege o site, roda depois.
- Mensagens técnicas ao jogador: "O Lobby respondeu 404", "O Lobby recusou (500)", "Não deu para tirar (409)" (`TelaGaleria.tsx` linhas 114 e 133). O passeio pediu frase humana.

## 5. Performance

- (G) Primeira carga: o `TelaFicha` é import estático do `Site.tsx:16`. Do pedaço principal (317 módulos estáticos), uns 120 vêm só da ficha do app (`PlayerFicha` e o que ela puxa), baixados até na tela de login e na lista de mesas. Ganho: `lazy()` no `TelaFicha`, como já existe no treino (`Site.tsx:52`), corta uns 38% dos módulos da entrada. Risco baixo (o padrão do `TreinoNaoAbriu` já trata o pedaço que não chega). Não medi bytes: o build não fecha.
- (M) Galeria: cada `<video preload="metadata">` (`TelaGaleria.tsx:65`) faz um pedido com Range ao DO quando a página abre; com N cutscenes são N pedidos e o DO acorda N vezes. `preload="none"` com pôster, ou um vídeo carregado por vez, corta isso. Risco: perde a duração antes do play.
- (M) Modificações: cada rev nova da campanha dispara, 1,5 s depois, um pedido de `atualizarModificacoes` (`telas/lobby/NovidadesDaMesa.tsx` linhas 241-246 e `telas/mural/PainelModificacoes.tsx` linhas 47-53). Em batalha com muitas ops vira um pedido por pausa, em cima do WebSocket que já traz as ops. Ganho moderado com um teto (ex.: no máximo 1 a cada 10 s) ou montando as linhas a partir das ops recebidas. Risco: a lista atrasar alguns segundos.
- (P) Galeria sem cache: entrar e sair refaz o GET da galeria (`TelaGaleria.tsx` linhas 104-122). Lista pequena; ganho pequeno.
- Já está bom: a reconexão pede só o que falta (`ola` com `desdeRev`, `dados/sessaoDaCampanha.ts:389`), espera crescente de 2 s a 60 s (linha 59), ping de 25 s (`fonteReal.ts:30`), vigia de versão a cada 10 min (`dados/versaoDoSite.ts:19`).

## O que não cobri

- `lobby/nuvem/src/*` (Worker): só li o portão e confirmei que o Worker usa o mesmo núcleo puro (`lobby/nuvem/src/nucleo.ts`); não auditei `campanha.ts`, `galeria.ts` nem `midia.ts`.
- `lib/nuvem/aplicar.ts`, `projecao.ts`, `conflito.ts` e `net/nuvem/sincronizador.ts`: não li a fundo. O conflito app x site ficou só no nível do `baseRev` (`TelaFicha.tsx` linhas 285-309 e `emissor.ts` linhas 383-409), que parece certo.
- Chat, mural, duelo e lutas do site: fora.
- Nada foi testado em navegador; os bugs acima vêm da leitura do código.
