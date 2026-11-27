# Portão de madeira: transição renderizada no Blender

Pedido do usuário (27/11/2026): "animação rápida de atravessar um portão grande de madeira, estilo Resident Evil 3
[...] sentir o peso do grande portão de madeira ao abrir lentamente, fundo preto". Respostas dele: ~7 s, com som
(rangido grave, trinco pesado, passos, baque surdo). Rascunho para aprovar pela `index.html`; **não empacotado**.

Mesmo caminho da `../armadura-cela/`: a cena sai inteira de script no Blender sem janela (EEVEE), o som é sintetizado
em Python na mesma linha do tempo, e a saída segue o formato do vídeo do pacote (`batalha/armaduras-despertam`:
WebM VP9 1280x720 a 30 fps, mudo). Portão, luz e poeira nossos; texturas CC0 da Poly Haven (`CREDITOS.md`).

| Arquivo | O que faz |
|---|---|
| `roteiro.py` | Python puro: todos os tempos e curvas (folhas, argolas, câmera, tremor, fade, lampião, eventos, poeira) |
| `cena.py` | Monta e anima a cena pelo roteiro, grava `grafico.json` e renderiza os quadros crus de 16 bits |
| `som.py` | Sintetiza o som do `grafico.json`, mede (LUFS, pico, cliques, cada evento a ±1 quadro) e desenha o gráfico |
| `montar.py` | Fade, vinheta e grão sobre os crus; `video.webm`, `video-com-som.webm/.mp4` e a folha de contato |
| `baixar-texturas.cjs` | Baixa as 4 texturas CC0 em 2k para `~/Animações/referencias/portao-madeira/texturas/` |
| `ferramentas/medir-wav.cjs` | Mede o wav com o `scripts/som/medidas.cjs` da casa (pico verdadeiro, cortes, DC, cliques) |
| `ferramentas/mosaico.py` | Junta quadros de prévia numa imagem só |

## Comandos, na ordem

```bash
B="/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"
S="C:/Users/gedasio.filho/Animações/saida/portao-madeira"
node docs/design/portao-madeira/baixar-texturas.cjs              # uma vez
cd docs/design/portao-madeira
# prévia rápida de alguns quadros (640x360, 16 amostras, ~1 s por quadro depois de ~35 s compilando shader)
"$B" --background --factory-startup --python cena.py -- "$S/teste" --escala 50 --amostras 16 --quadros 45,105,150
# os 210 quadros 1280x720, 32 amostras: ~2 s por quadro numa RTX 3050, 410 s no total (27/11/2026)
"$B" --background --factory-startup --python cena.py -- "$S/final" --escala 100 --amostras 32
# som: som.wav, medidas-som.json, som-e-movimento.png; sai com 1 se algum critério falhar (~25 s)
python som.py "$S/final/grafico.json" "$S/som"
# pós e vídeos na pasta de entrega (~2,5 min)
python montar.py "$S/final" "$S/som/som.wav" .
```

Mexeu só no roteiro sem mudar movimento (força de evento, fade)? `cena.py ... --so-grafico` regrava o `grafico.json`
sem renderizar; depois `som.py` e `montar.py`.

## Linha do tempo (`roteiro.py`)

| Trecho | Tempo | O que acontece |
|---|---|---|
| Sai do preto | 0-0,8 s | smoothstep (metade em 0,4 s) |
| Destrave | 0,88-1,40 s | a tranca de dentro sobe (folhas puxam 0,1 grau), arrasta em dois arranques, cai em 1,40 s: folhas assentam 0,22 grau e descem 4 mm, argolas balançam, pó, tremor |
| Arrancos | 1,62-2,51 s | três por folha, 0,25 a 0,9 grau cada |
| Abre | 2,32-4,93 s | inércia até ~40 graus/s; trancos em 2,88 e 3,58 s (esq.), 3,10 e 3,82 s (dir.) |
| Batidas | 4,80 s e 4,93 s | esquerda a 76 graus, direita a 71; voltam 1,6 grau e assentam 0,5 abaixo |
| Atravessa | 4,95-6,4 s | acelera em 0,4 s até 3,2 m/s; passos a cada 0,35 s (5,12 ... 6,52 s); passa o vão em ~6,2 s |
| Escuro | 6,4-7,0 s | ease-in, o último quadro já é preto |

## O que as medidas conferem (`medidas-som.json`)

LUFS integrado -23 a -18 (alvo -20), pico verdadeiro até -1 dBTP (teto do limitador -1,5), 0 amostras cortadas, 0
cliques (`detectarCliques` da casa), DC até 0,5%, amostras = 7,0 s x 48 kHz, último 1 ms em silêncio, cada evento
(trinco, trancos, batidas, passos 1-4) achado no som final a ±16,7 ms com subida de 6 dB ou mais (energia de 4 ms
sobre os 20 ms anteriores, passa-alta de 120 Hz), a janela de 0,1 s mais alta nas batidas e o destrave ao menos 3 dB
abaixo delas. **Medir não é ouvir**: timbre e gosto só o ouvido decide. Os botões para ajustar depois de ouvir estão no
topo do `som.py` (`GANHO_DB`, `REVERB_ENVIO_DB`, `RT60_S`, `MODOS_FOLHA`).
