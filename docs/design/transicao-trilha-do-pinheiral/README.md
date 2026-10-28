# Trilha do pinheiral (dia e em chamas)

Pedido de 27/10/2026: uma pessoa andando por um caminho de terra com uma floresta de pinheiros escura à frente, e a mesma animação à noite com a floresta pegando fogo. **Ainda não aprovadas**: os ids não estão em `client/src/animacoes/aprovadas.json` e o pacote (`scripts/pacote-animacoes.cjs`) não foi rodado.

## As duas animações (7 s cada, mesmo roteiro e mesma câmera)

- **Trilha do pinheiral** (`transicao/trilha-do-pinheiral`): fim de tarde frio, céu fechado. A pessoa (capa cor de ferrugem com capuz, mochila com rolo de dormir) anda de costas para a câmera por uma trilha de terra entre tufos de capim. À frente, um pinheiral escuro e denso com neblina na borda. A câmera recua enquanto fecha o campo de visão, então a pessoa fica quase do mesmo tamanho e a mata cresce até tomar o quadro. No fim, o escuro fecha a tela. Som: vento nos pinheiros, passos na terra e um corvo ao longe.
- **Trilha do pinheiral: em chamas** (`transicao/trilha-do-pinheiral-em-chamas`): a mesma caminhada à noite, com o pinheiral pegando fogo: chamas nas copas e no chão da borda, brasas subindo, fumaça iluminada por baixo, céu escuro com clarão laranja, e luz de fogo tremendo na trilha e na pessoa, que vira silhueta. Som: os mesmos passos, rugido grave, estalos do fogo e vento baixo.

Com movimento reduzido, a câmera quase não anda nem fecha, e o fogo só respira devagar, sem piscar.

## Código

- `client/src/animacoes/transicao/_roteiroDoPinheiral.ts`: tempos, trilha, ciclo de passos e fade.
- `_trilhaDoPinheiral.ts`: a cena (`criarTrilha('dia' | 'chamas')`).
- `_fogoDoPinheiral.ts`: chamas, brasas e fumaça em shader, mais as luzes do fogo.
- `_somDoPinheiral.ts`: o som, todo sintetizado.
- Os wrappers `trilha-do-pinheiral.ts` e `trilha-do-pinheiral-em-chamas.ts`, cada um com o seu `.json`.
- `prototipo.html` é gerado por `montar.cjs` a partir de `fonte.html` (`node docs/design/transicao-trilha-do-pinheiral/montar.cjs`, rodado da raiz do repositório). O three@0.186.1 vem da CDN; o protótipo precisa de internet.

## O que NÃO foi verificado

O usuário pediu pressa e poucos testes. Por isso:

- não há teste escrito nem rodado (vitest, Playwright, folha de contato, gráfico do movimento, medição de quadro);
- o som não foi ouvido nem medido (volume, pico, cliques);
- só passou pelo `tsc` e por uma conferência no Chromium headless (SwiftShader): o protótipo abre sem erro no console, e um print de cada variação no meio da animação mostrou a cena desenhando. Depois desses prints, a mata ficou mais escura, as árvores do fogo viraram carvão, o capim baixou e a neblina foi para a frente da mata. Essa versão ajustada não foi vista em imagem; só se conferiu que abre sem erro;
- o começo e o fim da animação não foram vistos em imagem, nem a tela estreita (celular), nem o modo de movimento reduzido;
- não foi conferido no app (galeria, miniatura no quadro de 3 s, motor de transição).
