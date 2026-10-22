# Roteiro depois do redesign (decisões de 22/10/2026)

Tudo aqui foi decidido pelo usuário em perguntas de 22/10/2026 (rodadas de grilling) e vale para execução SEM interrupção: cada fase só para se houver bloqueio. Pedidos literais em `PEDIDOS.md` (seções de 22/10/2026). Plano do redesign em andamento: `~/.claude/plans/compressed-sprouting-kahan.md`.

## Ordem

1. Terminar o redesign: faixas A (porta), B (escada e páginas), C (jogador 390 px), fatias 20 e 21, e a etapa A3 (porta no desenho do protótipo e as cinco animações novas).
2. **Camadas.**
3. **Aplicar o Meio-Termo no app.**
4. **Otimizar e refinar o máximo possível** (revisão final "sem lag, sem defeito, sem bug").
5. Sistemas novos, nesta ordem: **1 Luz e Dia/Tarde/Noite, 2 Modo batalha, 3 Caminhos (rotina dos NPCs e clicar para andar), 4 Sons.**

Regras de execução: um commit por fatia na main (ou por faixa, em worktree, juntada por mim); aceite escrito antes de codar; revisão de otimização depois de cada fatia; sem push e sem instalador até o usuário pedir; mapa salvo antes abre igual (campo novo opcional).

## 2. Camadas

Decisões:
- **Dois olhos por camada:** "Mestre vê" e "Jogadores veem", independentes. Mapa antigo: oculta continua significando "some para todos".
- **Também por camada:** travar e opacidade.
- **Ordem:** a lista de camadas manda (por cima e por baixo); qualquer tipo de objeto pode estar em qualquer camada. Mapa antigo abre com a ordem de hoje.
- **Camadas padrão novas:** "Terreno" (textura, relevo, carimbos, nuvens) e "Telhados"; texto e caminho ficam em "Anotações". Tudo pode ser movido.
- **Camadas livres, nomeadas pelo mestre:** MODELO COMPARTILHADO da aventura (nomes e ordem numa lista só). O estado (oculta, travada, opacidade, jogadores veem) é POR CENA.
- Num lugar só: página Cena do livro do mestre (hoje seção "Camadas").
- Plano detalhado aprovado em 22/10/2026 depois de nova rodada de grilling (13 camadas padrão, 8 fatias): `docs/planos/camadas-fase3-2026-10-22.md`.

Aceite (antes de codar): mapa antigo abre idêntico; camada oculta só para jogadores nunca chega ao jogador (`lib/fogFilter.ts`); travada respeitada também por pino, linha, marcador, textura e carimbo; arrastar item para outra camada funciona e desfaz; ordem de render do editor e do jogador seguem a lista; `isMapShape` do jogador aceita mapa sem os campos novos; custo de `filterByLayer` medido (quadro p95 <= 20 ms).

Riscos mapeados: cerca de 35 arquivos importam `lib/layers.ts`; as listas de ordem de render do editor (`pixi/PixiCanvas.tsx`) e do jogador (`player/PlayerView.tsx`) diferem de propósito; 63 arquivos de teste citam `hiddenLayers` ou `lockedLayers`.

## 3. Meio-Termo no app

Decisões:
- **Tudo muda de uma vez:** todo mapa passa a usar o estilo ao abrir; não há chave por mapa para o estilo. Quem quiser o antigo refaz o mapa. (É mudança de desenho: o arquivo do mapa não é regravado por isso.)
- **Móveis, as duas vistas** (de cima com volume e 3/4), com chave por mapa (padrão de cima, a confirmar no plano). As versões antigas de linhas continuam no catálogo para mapas novos; os objetos já colocados nos mapas migram para as versões novas.
- **Peças novas, todas no painel de Objetos:** barraca, carroça, lampião, quadro de avisos, vasos, árvore do Mother, sebe, jardineira, arco do portão, placa de seta; e as pedidas por você: tapete longo (o tapete retangular com comprimento livre e borda ornamentada, como no seu print), mesa quadrada e mesa redonda, lápides, grade de prisão (parede de grade que deixa ver e não deixa passar, com a porta de grade da cela).
- **Aprovação das peças novas:** direto no app (sem protótipo antes).
- **Telhado:** palha em espinha de peixe como terceiro modelo (6 cores e cor livre) e chaminé opcional por sala.
- Ordem proposta em `docs/design/ESTILO-DO-RPG.md`: portas, placas com ícone, poço e peças, chão e barranco, sombra do beiral e chaminé.

Aceite: print lado a lado com o protótipo Meio-Termo; chão sem repetição (0 blocos iguais de 96 px); robô chega às portas; mapa antigo abre sem erro e com os objetos migrados; primeira pintura e quadro p95 dentro da meta.

## 4. Otimização e refino

Inclui: desempenho dos desenhos no celular (280 a 560 ms ao descobrir lugar com CPU lenta; relevo do piso anterior fica 0,25 s), carregamento de textura para o jogador, e a revisão final "sem lag, sem defeito, sem bug" com lista do que testar no exe.

## 5.1 Luz e Dia/Tarde/Noite

Decisões:
- **Iluminação refeita por inteiro:** luz barrada por parede (pedido P8 de 17/09), visual bonito (gradiente suave, cor quente), o jogador vê a luz como o mestre, luz presa ao token fácil de configurar.
- **Estados Dia, Tarde e Noite, sem horas.** O relógio sai (`stores/clockStore.ts` e qualquer campo com hora).
- **Valor da sessão com exceção por cena:** um botão na sessão muda as cenas ao ar livre; a cena pode marcar "interior" (ignora) ou fixar um estado.
- **O que muda sozinho:** cor do ambiente; visão dos jogadores por mapa (cada mapa guarda quanto enxerga em cada estado); luzes acendem sozinhas (tocha, lampião, fogueira); som de ambiente por estado (cada mapa escolhe um loop por estado, troca suave; usa o sistema de sons).

## 5.2 Modo batalha

Decisões:
- **Sem turnos nem iniciativa.** Botão do mestre por cena, com atalho.
- **Grid por cima de tudo;** tokens andam por blocos (arrasto encaixa nos blocos). Diagonal conta 1 bloco.
- **Clicar para andar vale em batalha:** vai por blocos e conta os blocos andados.
- **Medição para os jogadores:** régua com distância em blocos, círculo e cone de alcance, caminho andado, linha de visão.
- **Confronto antigo sai** (modo escondido, faixa do jogador, código de iniciativa).
- **Vida:** nada de vida de token; vida e SP ficam só na ficha do sistema (a vida antiga do token já não é lida desde a fatia 10).

## 5.3 Caminhos (rotina dos NPCs e clicar para andar)

Decisões:
- **Um caminhamento compartilhado** (modelo: A* com colisão do protótipo da vila, `docs/design/vila/prototipo/vila.js`): NPC desvia de parede e de outros tokens, replaneja ou espera em vez de travar.
- **NPC abre e fecha a porta atrás de si** (destrancada); porta trancada ele não abre e a rotina avisa o mestre.
- **Tokens se contornam:** NPC desvia de jogadores e de NPCs; jogador não é bloqueado por token.
- **Rotina segue Dia, Tarde e Noite:** cada etapa pode valer para um período; junta os pedidos antigos de rotina fluida (sem teleporte) e patrulha.
- **Clicar para andar:** só para jogadores; o mestre segue arrastando. Marca no destino; o host valida cada passo (parede, porta, névoa, ficha congelada, modo batalha). Chave do mestre por cena, vem ligada.

## 5.4 Sons

Decisões:
- **Aba "Sons" no livro da mesa** (ao lado de Grupo, Chat, Cenas, Mesa): grade de botões grandes, bem organizada e leve.
- **Fonte:** arquivo de áudio (mp3, wav, ogg, guardado na aventura) E link do YouTube incorporado (sem baixar: baixar áudio de lá fere os termos do YouTube).
- **Recursos:** volume por efeito, Parar tudo, atalhos 1 a 9, pastas e favoritos, efeito em loop para ambiente.
- **Quem escuta, escolhido a cada vez:** todos da sessão (padrão), só a cena atual, ou jogadores escolhidos.
- **Desempenho:** carregar sob demanda, cache, limite de efeitos ao mesmo tempo.
- Alimenta o som de ambiente por Dia, Tarde e Noite (5.1).
