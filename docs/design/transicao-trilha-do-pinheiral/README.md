# Trilha do pinheiral (dia e em chamas)

Pedido de 27/10/2026: um caminho de terra com uma floresta de pinheiros escura à frente, e a mesma animação à noite com a floresta pegando fogo. Pedido do mestre no mesmo dia: **primeira pessoa, como as outras transições** (a primeira versão seguia uma pessoa de capa, de costas, em terceira pessoa). **Ainda não aprovadas**: os ids não estão em `client/src/animacoes/aprovadas.json` e o pacote (`scripts/pacote-animacoes.cjs`) não foi rodado.

## As duas animações (7 s cada, mesmo roteiro e mesmos olhos)

A câmera é os olhos de quem anda, como no Campo ensolarado: nenhum corpo aparece. Passo do Campo (1,45 m/s, 2 passos por segundo), com balanço na altura dos olhos (desce quando o pé assenta), leve vaivém lateral e rolagem que trocam de lado a cada passo. Os olhos miram a boca da trilha na mata, um pouco acima do horizonte. Aos 4 s freia sem tranco e para a ~8 m da primeira fileira (o último pé assenta no meio da freada); aos 4,45 s ergue o olhar para as copas, puxando um pouco para a direita, até 5,65 s, e segue subindo bem devagar enquanto o escuro fecha a tela (5,8 a 6,85 s).

- **Trilha do pinheiral** (`transicao/trilha-do-pinheiral`): fim de tarde frio, céu fechado. Trilha de terra entre tufos de capim, pinheiral escuro e denso com neblina na borda, que cresce à frente; parado, o olhar sobe e as copas escuras tomam o quadro. O corvo grita à direita aos 4,45 s, no começo do olhar. Som: vento nos pinheiros, passos na terra (param na freada) e o corvo.
- **Trilha do pinheiral: em chamas** (`transicao/trilha-do-pinheiral-em-chamas`): a mesma caminhada à noite, com o pinheiral pegando fogo. O holofote do fogo mira a trilha uns passos à frente dos olhos, então a luz laranja treme no chão da trilha à frente e o capim estica a sombra na direção de quem anda. Fumaça baixa sai da borda da mata, vem pela trilha na direção dos olhos e cresce; as brasas de perto nascem entre os olhos e a mata e derivam para quem anda. O olhar final sobe para as copas em chamas. Som: os mesmos passos, rugido grave, estalos e vento baixo.

Com movimento reduzido: sem balanço de passo (os olhos deslizam), o olhar sobe menos (60%) e mais devagar (até 6 s), sem a subida lenta do fim; o fogo só respira, sem piscar, e a fumaça baixa anda bem mais devagar. Em tela estreita (aspecto < 0,8) o campo de visão abre para 66°, como no Campo ensolarado.

## Código

- `client/src/animacoes/transicao/_roteiroDoPinheiral.ts`: tempos, trilha, passo e freada, fade e `estadoDaTrilha(t, reduzir)`, a pose dos olhos (pura: só depende de t).
- `_trilhaDoPinheiral.ts`: a cena (`criarTrilha('dia' | 'chamas')`).
- `_fogoDoPinheiral.ts`: chamas, brasas e fumaça em shader, mais as luzes do fogo.
- `_somDoPinheiral.ts`: o som, todo sintetizado; os passos seguem `passoEm` do roteiro.
- Os wrappers `trilha-do-pinheiral.ts` e `trilha-do-pinheiral-em-chamas.ts`, cada um com o seu `.json` (7 s, miniatura aos 3 s).
- `prototipo.html` é gerado por `montar.cjs` a partir de `fonte.html` (`node docs/design/transicao-trilha-do-pinheiral/montar.cjs`, rodado da raiz do repositório). O three@0.186.1 vem da CDN; o protótipo precisa de internet.

Detalhes que a primeira pessoa pediu: a neblina e a fumaça baixa somem devagar quando os olhos chegam perto do plano delas (sprite atravessando a câmera sumiria de estalo), e uma sentinela da borda que chegasse com os galhos de baixo aos olhos parados não é plantada (o resto do sorteio da mata não muda de ordem).

## O que NÃO foi verificado

Pedido do usuário: sem testes. Por isso:

- não há teste escrito nem rodado (vitest, Playwright como teste, folha de contato, gráfico do movimento, medição de quadro);
- o som não foi ouvido nem medido; os passos agora são 9 e param na freada;
- passou pelo `tsc` (client e e2e) e por uma conferência no Chromium headless (SwiftShader): o protótipo abre e as duas variações rodam de 0,5 a 6,9 s sem erro nem aviso no console;
- vi só 2 prints, de uma versão intermediária (parada a ~6,8 m da mata, passo mais lento): dia aos 3 s e chamas aos 3,5 s. Nenhum corpo aparece, a trilha leva para a mata e, nas chamas, a luz quente pega a trilha à frente. Depois deles a parada foi para ~8 m, o passo virou o do Campo, o olhar andando subiu um pouco e a fumaça baixa ficou mais clara. **Essa versão final não foi vista em imagem**, nem o começo, nem o olhar para as copas, nem o fim;
- nos prints, sob a neblina da borda, as saias de baixo das árvores do fundo aparecem como blocos cinza de borda reta; de perto, em primeira pessoa, isso aparece mais que na versão antiga. Não mexi;
- não vi a tela estreita, o movimento reduzido, nem o app (galeria, miniatura no quadro de 3 s, motor de transição).
