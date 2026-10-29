# Abertura de batalha: Tiro na tela

Pedido de 29/10/2026: "Eu quero você faça mais 2 animações de incio de batalha: 1- Uma animação de um revolver girando e atirando na tela e tela quebrando". O revólver é desenho próprio (cano redondo, armação com janela do tambor, cão com espora, cabo de nogueira quadriculada), sem logotipo, medalhão, letra ou número de marca nenhuma. A foto de referência é de terceiros e não está no repositório.

**Estado: protótipo para o mestre aprovar.** Nada em `client/`, nada em `client/src/animacoes/aprovadas.json`, nada enviado ao GitHub.

## Abrir

`prototipo.html` abre direto no navegador (precisa de internet para baixar o three.js da CDN). Tem o seletor de abertura (Tiro na tela, Caveira pirata, Bandeira da Marinha ou Espadas cruzadas, para comparar), Com nome / Sem nome, o campo do nome (padrão "Royals", até 24 letras), Repetir, Som (desligado ao abrir: o navegador só deixa tocar depois de um clique), Câmera lenta (1/4), Tela cheia, Movimento reduzido (já vem ligado se o sistema pede), "Ver um quadro" (para parar em qualquer instante), o mapa de exemplo que entra no fim em 260 ms, como no app, e a faixa "Para decidir". A página compila os shaders antes de soltar o relógio, como o motor do app.

## O que acontece (3,8 s)

| Tempo | O quê |
|---|---|
| 0 a 0,12 s | Sai do preto para um salão escuro: um facho de luz entra pelo alto à esquerda, com poeira boiando e lampiões desfocados no fundo |
| 0 a 0,55 s | O revólver sobe de baixo já girando no dedo, pelo guarda-mato; o zunido do giro |
| 0,55 a 1,12 s | O giro perde força (de 4,4 para 1,35 volta por segundo, 2,8 voltas ao todo) e o aço pega a luz a cada volta: um lampejo corre pelo cano |
| 1,12 s | **Para seco na mão**: um tranco curto (passa 4,7° e assenta em 0,2 s) |
| 1,17 a 1,45 s | Vira e mira em quem vê (três quartos, o cano para a câmera); a câmera vai até a boca |
| 1,6 s | Engatilha: o cão vai para trás, o tambor roda uma câmara, dois cliques e um tranquinho |
| 1,6 a 1,92 s | Pausa de tensão: a câmera chega mais um pouco, um zumbido grave sobe |
| 1,92 s | **O tiro**: clarão na boca com língua de fogo, recuo de 13°, estrondo |
| 1,935 a 2,4 s | A bala bate no vidro da tela: estalo de luz, pó de vidro em volta do furo, a rachadura em estrela corre até as bordas (raios até 2,22 s, anéis até 2,4 s), onda e tremor; a fumaça sobe da boca |
| 2,2 a 2,58 s | O nome aparece em folha de ouro pintada no vidro, com um brilho que corre pelas letras |
| 2,82 s | O vidro range |
| 3,05 a 3,6 s | Os cacos cedem a partir do furo e caem capotando, cada um pegando a luz; o nome quebra junto |
| 3,6 a 3,8 s | Preto; o mapa entra em 260 ms |

Sem nome, a arma fica um pouco mais baixa na tela e o resto da linha do tempo é igual.

Com movimento reduzido: sem giro, sem queda dos cacos, sem tremor e sem granulado. A arma surge já na mira (0,1 a 0,75 s), engatilha em 1,25 s, atira em 1,7 s com clarão menor, a rachadura acende inteira (1,7 a 2,0 s), o nome acende (2,05 a 2,45 s) e tudo apaga de 3,1 a 3,55 s. O som fica, mais baixo.

Som sintetizado (WebAudio, nada gravado): zunido do giro, cliques do cão, o tiro em três camadas (estalido, corpo e estrondo), o golpe da bala no vidro, os estalos da rachadura correndo, o anel do vidro, o rangido, o estouro dos cacos e o tilintar deles caindo, um vento de fundo e o zumbido da tensão. Tudo passa por um compressor e por um teto suave.

Estilo: faroeste num salão escuro, luz quente de um facho, aço velho e gasto (quina clara e lisa, pátina em manchas, um pouco de ferrugem, riscos ao longo do cano, pites), nogueira com verniz e quadriculado, vidro com rachadura irregular (não uma teia certinha). Nada de sangue.

## Código

- `src/animacoes/batalha/tiro-na-tela.ts` + `.json` (nome, `duracaoNaturalS` 3,8, `quadroDaMiniaturaS` 2,7). Esta `src/` espelha `client/src`: os imports `../../transicoes/...` são os do app, e o arquivo entra como está em `client/src/animacoes/batalha/`. Mesmo contrato `CriarCena` das outras aberturas (tempo vindo de fora, `ajustarTela`, `descartar`, `criarSom`), com o `nome` opcional: vazio toca sem nome.
- A arma é geometria do three.js com `RawShaderMaterial` em GLSL 3 (aço, madeira, chumbo e o escuro do cano, por `#define`), desenhada por uma câmera própria numa textura com 4 amostras. O vidro é uma malha só, da tela inteira: uma teia polar sorteada (anéis e raios tortos, células unidas onde o vidro não racha) que mostra o salão e a arma e depois se parte em cacos que caem. O nome é pintado em canvas na montagem. Sem luz na cena e sem imagem externa.
- Para a placa integrada: no giro a arma vai para uma textura com 60% do lado (o borrão cobre a diferença); só a caixa da arma é limpa e desenhada; o ruído do aço e da madeira sai de uma textura 3D de 64³ (uma leitura no lugar de 8 sorteios); o clarão, a fumaça, a poeira, a onda e os fios da rachadura só são calculados onde aparecem.
- `prototipo.html` é gerado: `node docs/design/transicao-batalha-revolver/montar.cjs`, da raiz. O esbuild junta a cena desta pasta, a Caveira, a Marinha e as Espadas de `client/src` (só leitura) e o `client/src/transicoes` num IIFE; `three@0.186.1` vem da CDN, a versão do app.
- Conferir os tipos: `rtk proxy npx tsc --noEmit -p docs/design/transicao-batalha-revolver` (o `tsconfig.json` daqui junta esta `src/` com `client/src` por `rootDirs`).

## Desempenho (medido em 29/10, Chrome com a GPU desta máquina, 1920 × 1080 com MSAA)

- Partida a frio, como o motor faz (contexto novo, `compileAsync` antes do relógio): NVIDIA RTX 3050, criar a cena 34 ms, compilar 273 ms (antes do relógio), primeiro quadro 17 ms, segundo 2 ms, quadro do impacto 4 ms, nenhuma tarefa longa. Intel UHD: 39, 310, 51, 19 e 36 ms, com uma tarefa longa de 107 ms (no mesmo teste a Caveira faz 78 ms no primeiro quadro, com tarefa longa de 120 ms). Sem compilar antes, o primeiro quadro leva 407 ms (RTX) e 455 ms (Intel): a compilação antes do relógio é obrigatória aqui.
- Tocando, RTX (229 quadros): mediana 16,7 ms, p95 16,8 ms, máximo 16,9 ms, nenhuma tarefa longa. **Intel (214 quadros): mediana 16,7 ms, p95 33,3 ms**: perde quadros depois do tiro.
- GPU por quadro na Intel (desenha e espera a GPU): 10,8 ms no preto, 12,7 a 13,3 ms no giro, 15,8 a 16,1 ms na mira, 19,6 a 20,3 ms do tiro ao fim. No mesmo teste, a Caveira faz 11,2 a 12,3 ms. Na RTX, cerca de 2 ms.
- Som renderizado offline: pico −1,67 dBFS, pico real −1,62 dBTP, nenhuma amostra no teto, nenhum clique, −21,5 LUFS integrado (a Caveira faz −19,35), os últimos 20 ms já mudos (−132,8 dBFS, sem corte). Sem nome: −21,57 LUFS. Movimento reduzido: −23,25 LUFS e −1,65 dBTP. **Medir não é ouvir**: ninguém ouviu ainda.

## Para entrar no app (só depois do sim)

1. Copiar `src/animacoes/batalha/tiro-na-tela.ts` e `.json` para `client/src/animacoes/batalha/`.
2. Acrescentar `"batalha/tiro-na-tela"` em `client/src/animacoes/aprovadas.json` e publicar o pacote de animações (`scripts/pacote-animacoes.cjs`); o tipo `batalha` já existe lá e aceita de 1 a 10 s.
3. Atrás dos cacos aparece preto, porque a tela da abertura é opaca e o mapa só entra no fim. Ver o mapa pelos buracos exige a tela da abertura transparente: é mudança no motor, não nesta cena.

## O que NÃO foi verificado

Por ordem do usuário, nenhum teste automático. O que rodou: o `tsc` desta pasta e o do app (zero erro), a montagem, o console sem erro nem aviso, as medidas acima, o gráfico do movimento amostrado a cada 0,1 s (as propriedades do giro, da pegada, da mira, do recuo, da rachadura e do clarão conferidas) e três folhas de contato de 16 quadros vistas por mim (com nome, sem nome e movimento reduzido). O som foi medido, não ouvido. Ninguém viu a animação tocando em tempo real numa tela de verdade (só quadros e medidas no Chrome sem janela). Também não conferido: Safari/WebKit e Firefox, tela estreita ou de celular, a miniatura do app a 320 × 180, e a troca da textura do giro pela inteira em 1,15 s vista ao vivo (nos quadros não aparece; falta olhar em câmera lenta).
