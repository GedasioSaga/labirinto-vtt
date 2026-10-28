# Abertura de batalha: Bandeira da Marinha

Pedido de 28/10/2026: "eu quero que você coloque mais uma animação, mas dessa vez você vai fazer a bandeira da marinha esvoaçando e enchendo o local de água. Faça em design max e me mostre o protótipo." A referência é o símbolo da Marinha de One Piece (marca de terceiros), redesenhado aqui em vetor para este projeto livre e sem venda; a imagem de referência não entra no código.

**Estado: protótipo para o mestre aprovar.** Nada em `client/`, nada em `client/src/animacoes/aprovadas.json`, nada enviado ao GitHub.

## Abrir

`prototipo.html` abre direto no navegador (precisa de internet para baixar o three.js da CDN). Tem o seletor de abertura (Bandeira da Marinha ou Espadas cruzadas, para comparar), Com nome / Sem nome, o campo do nome (padrão "Royals", até 24 letras), Repetir, Som (desligado ao abrir: o navegador só deixa tocar depois de um clique), Câmera lenta (1/4), Tela cheia, Movimento reduzido (já vem ligado se o sistema pede), "Ver um quadro" (para parar em qualquer instante), o mapa de exemplo que entra no fim em 260 ms, como no app, e a faixa "Para decidir".

## O que acontece (3,8 s)

| Tempo | O quê |
|---|---|
| 0 a 0,45 s | Sai do preto com a bandeira já esvoaçando num mastro, contra um céu fechado; uma rajada corre do mastro até a ponta e o pano estala em 0,42 s |
| 0,45 a 0,87 s | Vento firme: ondas correm pelo pano, com luz e sombra nas dobras e a sombra lenta das nuvens |
| 0,87 a 1,3 s | O mar aparece embaixo e sobe; a superfície é vista de cima, com espuma em manchas |
| 1,3 a 1,75 s | A água cobre a bandeira: meio dentro, meio fora, com a linha da água no centro em 1,52 s (a subida segura um instante aqui) |
| 1,99 s | A linha passa do alto da tela: tudo debaixo d'água, um tranco curto na câmera, baque grave e bolhas |
| 2,02 a 2,5 s | O nome chega do borrão para o foco, subindo um pouco; raios de luz descem inclinados e o pano ondula devagar |
| 2,6 a 3,8 s | A câmera afunda devagar e a luz da superfície fica para trás |
| 3,35 a 3,8 s | Escurece até o preto; o mapa entra em 260 ms |

Com movimento reduzido: a bandeira fica parada numa pose ondulada, a câmera não se mexe, a água entra por dissolução (0,95 a 1,75 s), sem superfície, espuma ou tremor; os raios ficam parados, o nome só acende (2,0 a 2,45 s) e o fim é um escurecer a partir de 3,3 s. O som fica, mais curto.

Som sintetizado (WebAudio, nada gravado): vento, o pano batendo, o estalo, o mar subindo (abafa ao mergulhar), o baque do mergulho, o fundo do mar, quatro bolhas e um apito de navio abafado, longe. Tudo passa por um limitador.

Estilo: céu fechado e frio, pano branco com o símbolo em azul (#1543ae), mastro escuro com pomo de latão. A água é contida: verde-azulado fundo, sem azul neon; a espuma vem em formas (lóbulos na linha do vidro, manchas na superfície), nunca em pontinhos. O nome usa a fonte de título do app (Sitka Banner, com reservas) em pérola com contorno escuro.

## Código

- `src/animacoes/batalha/bandeira-da-marinha.ts` + `.json` (nome, `duracaoNaturalS` 3,8, `quadroDaMiniaturaS` 1,45). Esta `src/` espelha `client/src`: os imports `../../transicoes/...` são os do app, e o arquivo entra como está em `client/src/animacoes/batalha/`. Mesmo contrato `CriarCena` das Espadas (tempo vindo de fora, `ajustarTela`, `descartar`, `criarSom`), com o `nome` opcional. O campo `semNome` só o protótipo passa; no app o nome sempre aparece.
- Tudo é `ShaderMaterial`, sem luz na cena e sem imagem externa. O símbolo (`desenharSimboloDaMarinha`) e o nome são pintados em canvas na montagem. A água é um plano de verdade, com três ondas, e cada peça calcula a própria parte molhada: por isso a linha da água corta o pano, o mastro e o vidro no mesmo lugar.
- `prototipo.html` é gerado: `node docs/design/transicao-batalha-marinha/montar.cjs`, da raiz. O esbuild junta a cena desta pasta, as Espadas de `client/src` (só leitura) e o `client/src/transicoes` num IIFE; `three@0.186.1` vem da CDN, a versão do app.
- Conferir os tipos: `rtk proxy npx tsc --noEmit -p docs/design/transicao-batalha-marinha` (o `tsconfig.json` daqui junta esta `src/` com `client/src` por `rootDirs`).

## Desempenho (medido em 28/10, Chrome headless com a GPU Intel UHD desta máquina, 1920 × 1080 com MSAA)

- GPU por quadro, pela consulta de tempo do WebGL: 4,1 a 6,2 ms em toda a linha do tempo. As Espadas, no mesmo teste: 12,1 a 12,7 ms. O mais caro é o céu (2,9 ms enquanto aparece), depois o pano e a camada da frente (cerca de 1,5 ms cada).
- Tocando: nenhuma tarefa longa. A cadência no headless não serve de prova de 60 quadros: um canvas vazio já perde 20% dos quadros ali.
- Partida a frio (contexto novo, shaders sem cache): 199 ms no primeiro quadro (Espadas: 503 ms). O motor do app compila no primeiro quadro, já com o relógio andando, então essa espera come o começo da abertura nas duas. Fora desta pasta: o motor poderia chamar `renderer.compile(cena.scene, cena.camera)` antes de marcar o início (`client/src/transicoes/motor.ts`, linha do `inicio`).

## Para entrar no app (só depois do sim)

1. Copiar `src/animacoes/batalha/bandeira-da-marinha.ts` e `.json` para `client/src/animacoes/batalha/`.
2. Acrescentar `"batalha/bandeira-da-marinha"` em `client/src/animacoes/aprovadas.json` e publicar o pacote de animações (`scripts/pacote-animacoes.cjs`); o tipo `batalha` já existe lá e aceita de 1 a 10 s.

## O que NÃO foi verificado

Por ordem do usuário, nenhum teste automático. O que rodou: o `tsc` desta pasta e o do app (zero erro), a montagem, o console sem erro nem aviso, 8 quadros vistos por mim (símbolo contra a referência, e os instantes 0,30, 0,45, 1,10, 1,52, 1,80, 2,70 e 2,75 s; os de 0,30, 1,10, 1,52 e 2,70 s são de antes dos últimos ajustes de luz, da hora em que a câmera afunda e de desempenho), as medidas acima e um gráfico do movimento por números (a água, a força do vento, a câmera e o escurecer, sem saltos de velocidade fora dos três de propósito: a água entra já em velocidade abaixo da tela, a rajada bate de uma vez, o tranco do mergulho). O som não foi medido nem ouvido: só existe no código. Ninguém viu a animação tocando em tempo real numa tela de verdade. Também não conferido: Safari/WebKit e Firefox, tela estreita ou de celular, a TV, a miniatura do app a 320 × 180 e o tema escuro da página.
