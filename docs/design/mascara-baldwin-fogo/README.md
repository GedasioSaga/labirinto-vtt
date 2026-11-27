# Máscara em chamas: abertura de batalha (rascunho para aprovar)

Pedido do dono (27/11/2026): "faz uma animação dessa máscara pegando fogo, é para uma iniciação de batalha". O modelo
é a máscara de Balduíno IV (CC BY 4.0, créditos em `CREDITOS.md`). **Não está no pacote**: o dono aprova primeiro
pela página `index.html`.

## Formato (igual ao da "Armaduras despertam")

A abertura aprovada (`client/src/animacoes/batalha/armaduras-despertam.ts`) é um vídeo WebM VP9 1280x720 a 30 fps,
4,2 s (126 quadros), sem som, que sai do preto (véu aberto em 0,45 s); o app fecha a cortina em 0,3 s depois do
último quadro (duração natural 4,5 s). Este rascunho segue o mesmo: `video.webm` é o arquivo que entraria no pacote.
A diferença é o caminho de produção: a "Armaduras despertam" é a gravação de uma página three.js; esta sai do
Blender sem janela (como a `../armadura-cela/`), porque o pedido era fogo crível, de simulação.

O som (`som.wav`, 4,5 s = vídeo + cortina) é novo: a "Armaduras despertam" toca muda (`video.muted = true`). Para o
som tocar no app ele teria de ir à parte, como no `transicao/portao-de-madeira.ts` (`som.webm` + `criarSom`).

## Linha do tempo

| Tempo | O que acontece |
|---|---|
| 0 a 0,45 s | véu preto abre; a máscara aparece recortada por uma luz fria de cima |
| 0,25 s | brasa nos olhos (anel que anda a partir da borda dos furos) |
| 0,6 s | brasa na borda da máscara |
| 0,7 s | primeiras línguas de fogo saindo dos olhos; faíscas raras |
| 1,45 s | ignição: o fogo pega atrás e na borda (whoosh) |
| 1,45 a 3,5 s | o fogo cresce e envolve a máscara; fumaça subindo; brilho laranja tremulando no metal |
| 3,5 s | clímax: parede de fogo para cima pela silhueta, fogo estourando pelos olhos, rajada de faíscas, clarão e tremor de câmera |
| 3,5 a 4,2 s | máscara ardendo no auge (último quadro em 4,17 s) |
| 4,2 a 4,5 s | cortina do app fechando para o preto |

## Comandos, na ordem

Rode em `docs/design/mascara-baldwin-fogo`. `B` é o Blender sem janela; `S` a pasta de saída (fora do repo).

```bash
B="/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"
M="C:/Users/gedasio.filho/Animações/entrada/baldwin-mask/source/123.glb"
S="C:/Users/gedasio.filho/Animações/saida/mascara-baldwin-fogo/final"
# 1. monta a cena, simula o fogo (Mantaflow), mede a chama e as faíscas (grafico.json) e renderiza os 126 quadros
"$B" --background --factory-startup --python cena.py -- "$M" "$S" --resolucao-fogo 80 --amostras 64
# 2. o som na linha do tempo do grafico.json: som.wav, envoltoria.json, medidas-som.json (sai com 1 se falhar)
python -I som.py "$S/grafico.json" "$S"
# 3. régua da casa sobre o wav (LUFS, pico verdadeiro, cortes, cliques)
node medir-som.cjs "$S/som.wav" "$S/medidas-som-casa.json"
# 4. pós (véu, brilho, clarão, vinheta, grão, cortina), video.webm e previa-com-som.mp4
python -I post.py "$S/quadros" "$S/grafico.json" "$S" --som "$S/som.wav"
# 5. provas: folha de contato (16 quadros) e som x movimento
python -I folha.py "$S/final" folha-de-contato.png 4 400 q000.png q009.png q018.png q027.png q036.png q045.png q054.png q066.png q078.png q090.png q100.png q104.png q106.png q110.png q118.png q125.png
python -I grafico.py "$S/grafico.json" "$S/envoltoria.json" "$S/luma.json" "$S/medidas-som.json" som-x-movimento.png
```

Opções do `cena.py`: `--resolucao-fogo 64` (rascunho: assa em 3,5 a 8 min em vez de 18 a 22 com o padrão 80), `--escala 50`,
`--amostras 16`, `--quadros 96,104,106` (só esses), `--so-grafico` (simula e mede, sem render), `--so-montar` (só
monta e confere, nada vai para o disco). `inspecionar.py` faz as 4 vistas e o inventário do .glb; `ler-glb.cjs` lê o
JSON de dentro do .glb sem executar nada.

**Cuidado com o cache do fogo:** cada ajuste de propriedade do domínio (pelo script ou à mão) dispara um reset que
**apaga os arquivos** da pasta do cache. Por isso o `cena.py` define a pasta do cache por último, e cada rodada assa de
novo. Uma tentativa de reaproveitar o cache montando a cena de novo apagou o bake de 22 min (27/11/2026).

## Como o fogo é feito

- **A máscara é casca fechada** (tem espessura): olhos e boca são túneis, sem aresta de borda. Os furos e o contorno
  saem de raios de frente numa grade de 8 mm (`furos_por_raio`); a distância geodésica até a borda dos olhos e até o
  contorno vira atributo da malha (`d_olhos`, `d_borda`), e a brasa do material anda por ela.
- **Simulação Mantaflow** (gás com fogo e fumaça), domínio de 1,56 x 0,82 x 2,2 m com 80 divisões no eixo maior,
  cache OpenVDB em meia precisão. Cinco emissores com combustível animado por quadro: dentro dos olhos, faixa da
  borda, uma cópia da máscara atrás (o fogo grande), a frente (línguas no rosto, tarde) e a silhueta ampliada que só
  cospe no clímax. Os de trás e os olhos ganham velocidade para cima no clímax.
- **Volume no EEVEE**: a chama da simulação multiplicada por um ruído 4D que sobe com o tempo (rasga em línguas mais
  finas que a grade), cor por rampa (vermelho escuro nas pontas, laranja, amarelo-branco no núcleo), fumaça escura.
- **Luz**: o EEVEE não acende superfície com volume, então o laranja no metal vem de 7 luzes pontuais (olhos, lados,
  topo, queixo, costas) que seguem o combustível de cada emissor, com tremulação determinística; uma luz fria de lua
  recorta a máscara no começo.
- **Faíscas**: partículas (alongadas na direção da velocidade, cor e força pela idade), poucas desde as línguas,
  muitas depois da ignição e uma rajada no clímax.
- **Pós** (`post.py`): brilho em duas escalas, clarão quente de 2-3 quadros no clímax, vinheta, grão e o véu.

## Medidas do rascunho (27/11/2026)

| O quê | Valor |
|---|---|
| Simulação | 80 divisões no eixo maior, bake de 1099 s (1336 s com a CPU mais dividida), cache de 189 MB (fora do repo) |
| Render | 126 quadros 1280x720, EEVEE, 64 amostras, média de 3,7 s por quadro (RTX 3050) |
| Vídeo | `video.webm` VP9 1,2 MB, 4,2 s; `previa-com-som.mp4` H.264 + AAC 2,0 MB, 4,5 s |
| Pico de luma | quadro 106 (3,53 s): o clarão do clímax, a 1 quadro do impacto do som |
| Som (`som.py`) | -19,5 LUFS integrado; pico verdadeiro -3,9 dBTP; 0 amostras no limite; impacto em 3,502 s (alvo 3,500, +12,3 dB); baque da ignição em 1,457 s (alvo 1,450, +15,3 dB); última amostra em 4,498 s; janela de 0,1 s mais alta em 3,5 s; camada do rugido x chama medida r = 0,995 |
| Som (régua da casa, `scripts/som/medidas.cjs`) | -19,5 LUFS, -3,9 dBTP, 0 cortes, 0 cliques, DC 0%, nenhum motivo de reprovação |

Na mistura final, a faixa de 180 a 700 Hz contra a chama dá r = 0,65 na janela limpa (2,15 a 2,75 s, sem whoosh nem
riser): a janela é curta e a tremulação do rugido pesa. Fica só informativo; o critério é a camada.

## Som

Sintetizado (nenhuma amostra de terceiros), na linha do tempo do `grafico.json`. O rugido segue a chama **medida na
simulação** (`chama_total`, soma da grade de chama a cada quadro), e o crepitar tem taxa por ela; os tiques das faíscas
seguem as faíscas nascendo. Camadas: ambiente grave, brasa (chiado e estalinhos), dois sopros das línguas, whoosh e
baque da ignição, rugido, crepitar, faíscas, riser de 0,7 s e impacto no clímax (estrondo com queda de tom, sopro e o
anel de metal da máscara), cortina com a mesma curva do app e 4 ms de meio cosseno no fim. **Medir não é ouvir**: os
números conferem volume, pico, cliques e sincronia; timbre e gosto só o ouvido decide.
