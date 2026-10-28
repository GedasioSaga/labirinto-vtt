# Abertura de batalha: Caveira pirata

Pedido de 28/10/2026: "Outra coisa eu quero mais uma animação de luta, dessa vez é uma caveira, que vai ganhar um brilho vermelho nos olhos." Estilo escolhido: "Pirata, com ossos cruzados". Faz par com a Bandeira da Marinha (piratas contra a Marinha). O desenho é genérico e original (caveira de bandeira pirata com dois ossos cruzados atrás); não copia o símbolo de nenhuma tripulação de anime ou filme.

**Estado: protótipo para o mestre aprovar.** Nada em `client/`, nada em `client/src/animacoes/aprovadas.json`, nada enviado ao GitHub.

## Abrir

`prototipo.html` abre direto no navegador (precisa de internet para baixar o three.js da CDN). Tem o seletor de abertura (Caveira pirata, Bandeira da Marinha ou Espadas cruzadas, para comparar), Com nome / Sem nome (nas três; sem nome = nome vazio, como o app pode mandar), o campo do nome (padrão "Royals", até 24 letras), Repetir, Som (desligado ao abrir: o navegador só deixa tocar depois de um clique), Câmera lenta (1/4), Tela cheia, Movimento reduzido (já vem ligado se o sistema pede), "Ver um quadro" (para parar em qualquer instante), o mapa de exemplo que entra no fim em 260 ms, como no app, e a faixa "Para decidir". A página compila os shaders antes de soltar o relógio, como o motor do app.

## O que acontece (3,8 s)

| Tempo | O quê |
|---|---|
| 0 a 0,3 s | Sai do preto para uma noite fria de mar, só fumaça subindo; um sino de navio bate longe |
| 0,3 a 1,15 s | A caveira se forma da fumaça, do centro do crânio para fora; os ossos cruzados fecham por último e a câmera chega um pouco mais perto |
| 1,15 a 1,4 s | Pausa: a caveira inteira em luz fria, só o ronco grave |
| 1,4 a 1,55 s | A luz da cena cai um pouco e uma brasa acende no fundo das órbitas |
| 1,55 / 1,6 s | **Os olhos acendem em vermelho**, o esquerdo e logo o direito: clarão com um risco horizontal, um tranco curto na câmera, uma onda vermelha corre pela fumaça; som de fogo, baque grave e um acorde curto |
| 1,6 a 2,2 s | O vermelho vaza para a fumaça e tinge o osso em volta dos olhos (beirada das órbitas, maçãs, ponte do nariz), e assenta |
| 2,02 a 2,5 s | O nome se forma do ruído, com o vermelho dos olhos no alto das letras; um chiado de brasa |
| 2,38 e 3,0 s | Os olhos pulsam duas vezes, com um batimento (tum-tum) |
| 3,1 a 3,5 s | A caveira e o nome apagam; ficam só os olhos no escuro |
| 3,42 a 3,7 s | Os olhos se fecham como uma fresta e somem, com um suspiro |
| 3,62 a 3,8 s | Preto; o mapa entra em 260 ms |

Sem nome, a caveira fica no centro da tela e o resto da linha do tempo é igual.

Com movimento reduzido: a câmera não se mexe (sem aproximar, sem tranco), a fumaça fica parada, sem granulado, sem onda vermelha e sem a fresta no fim. A caveira entra por dissolução (0,1 a 1,05 s), os olhos acendem devagar (1,45 a 1,95 s), o nome só acende (2,0 a 2,45 s), apaga de 3,1 a 3,5 s e escurece a partir de 3,45 s. O som fica, mais curto.

Som sintetizado (WebAudio, nada gravado): ronco grave em ré com um trítono, sino de navio longe, sopro de vento, estalos de brasa, o "vum" do fogo nos olhos com baque e acorde curto, dois batimentos, o chiado do nome (só com nome) e um suspiro no fecho. Tudo passa por um reverb curto de enseada e por um limitador.

Estilo: noite de mar fria e escura, osso em marfim gasto com poros e uma rachadura, luz fria de cima, órbitas bravas, dentes contornados. O vermelho é contido: aparece só nos olhos, no que vaza para a fumaça e num reflexo no osso em volta das órbitas; nada de sangue. O nome usa a fonte de título do app (Sitka Banner, com reservas).

## Código

- `src/animacoes/batalha/caveira-pirata.ts` + `.json` (nome, `duracaoNaturalS` 3,8, `quadroDaMiniaturaS` 2,45). Esta `src/` espelha `client/src`: os imports `../../transicoes/...` são os do app, e o arquivo entra como está em `client/src/animacoes/batalha/`. Mesmo contrato `CriarCena` das Espadas e da Marinha (tempo vindo de fora, `ajustarTela`, `descartar`, `criarSom`), com o `nome` opcional: vazio toca sem nome.
- Tudo é `ShaderMaterial`, sem luz na cena e sem imagem externa. A caveira, os ossos e a máscara (reflexo vermelho, órbitas) são pintados em canvas na montagem (`desenharEmblema`); o nome também. Seis camadas: fundo com fumaça de trás, emblema, olhos (soma de luz), fumaça da frente, nome e o acabamento da tela (vinheta e granulado).
- `prototipo.html` é gerado: `node docs/design/transicao-batalha-caveira/montar.cjs`, da raiz. O esbuild junta a cena desta pasta, a Marinha e as Espadas de `client/src` (só leitura) e o `client/src/transicoes` num IIFE; `three@0.186.1` vem da CDN, a versão do app.
- Conferir os tipos: `rtk proxy npx tsc --noEmit -p docs/design/transicao-batalha-caveira` (o `tsconfig.json` daqui junta esta `src/` com `client/src` por `rootDirs`).

## Desempenho (medido em 28/10, Chrome com a GPU desta máquina, 1920 × 1080 com MSAA)

- Partida a frio, como o motor faz (contexto novo, `compileAsync` antes do relógio): GPU Intel UHD, criar a cena 3 ms, compilar 80 ms (antes do relógio), primeiro quadro 33 ms, segundo 12 ms, nenhuma tarefa longa. NVIDIA RTX 3050: 4, 66, 12 e 2 ms. Sem compilar antes, o primeiro quadro na Intel leva 184 ms, com uma tarefa longa de 206 ms: por isso a compilação antes do relógio importa.
- Tocando (Intel, 229 quadros): mediana 16,7 ms, p95 16,8 ms, máximo 17,2 ms, nenhuma tarefa longa. NVIDIA: p95 16,8 ms, nenhuma.
- GPU por quadro, pela consulta de tempo do WebGL (Intel): 11,9 a 12,8 ms. No mesmo teste, a Marinha 7,0 a 8,7 ms e as Espadas 15,6 a 15,8 ms.
- Som renderizado offline: pico −2,4 dBFS, RMS −20,7 dBFS, nenhuma amostra no teto, nenhum salto (clique), nenhum valor inválido; termina em −71 dB aos 3,8 s. Movimento reduzido: pico −4,3 dBFS. **Medir não é ouvir**: ninguém ouviu ainda.

## Para entrar no app (só depois do sim)

1. Copiar `src/animacoes/batalha/caveira-pirata.ts` e `.json` para `client/src/animacoes/batalha/`.
2. Acrescentar `"batalha/caveira-pirata"` em `client/src/animacoes/aprovadas.json` e publicar o pacote de animações (`scripts/pacote-animacoes.cjs`); o tipo `batalha` já existe lá e aceita de 1 a 10 s.

## O que NÃO foi verificado

Por ordem do usuário, nenhum teste automático. O que rodou: o `tsc` desta pasta e o do app (zero erro), a montagem, o console sem erro nem aviso, as medidas acima e três folhas de contato de 16 quadros vistas por mim (com nome, sem nome e movimento reduzido). O som foi medido, não ouvido. Ninguém viu a animação tocando em tempo real numa tela de verdade. Também não conferido: Safari/WebKit e Firefox (o `roundRect` do canvas exige Safari 16), tela estreita ou de celular, a TV, a miniatura do app a 320 × 180 e o tema escuro da página.
