# Campo ensolarado: variações (três casas, vila)

Pedido de 27/10/2026: duas variações da transição "Campo ensolarado" (aprovada em 12/10), uma com três casas ao fundo e outra com uma vila ao fundo, a partir de dois recortes do mapa do app.

**Aprovadas pelo mestre em 27/10/2026**, com uma única mudança pedida: "Na parte da vila tira os muros de pedra, só isso o resto tá perfeito e pode ser colocado em produção." Os muros saíram e as duas entraram em `client/src/animacoes/aprovadas.json`. O envio ao GitHub (`node scripts/pacote-animacoes.cjs --publicar`) ainda não foi feito.

## As três animações

- **Campo ensolarado** (a original, de 12/10): sem mudança. Estrada de terra, para, ergue o olhar ao sol e o sol toma a tela. A caminhada, a parada, o olhar ao sol, o branco, o preto e o som das variações são os dela. Só o fundo muda.
- **Três casas**: no fim da estrada há um terreiro de terra com três casas, como no mapa: a cinza, maior, atrás (com chaminé e um fio de fumaça), a lilás à esquerda, estreita e com a empena virada para a estrada, e a de madeira, larga e baixa, na frente à direita. A árvore grande fica atrás delas.
- **Vila**: a estrada chega a uma vila sem muro. O casario tem tamanhos e cores variados (salões de quatro águas, estalagem de várias águas e casas). Entre as casas da frente fica a praça de chão escuro com a feira de toldo listrado, e duas chaminés soltam fumaça, só na metade esquerda.

## A vila sem muro (27/10/2026)

- Saíram o muro de pedra com a faixa de reboco no alto, a guarita, a verga e o vão do portão, e as duas folhas de tábua em pé. O padrão de textura que só as folhas usavam também saiu.
- Nada ficou no lugar do muro: ele não recortava o chão e não tinha sombra própria. A praça continua com a mesma beira de antes (z = -122,7, onde o vão terminava) e a feira continua apoiada no chão.
- As casas, a feira e a fumaça ficaram como na versão aprovada: a semente do fundo é uma só, então as texturas são pintadas na mesma ordem de antes e os sorteios da folha do portão continuam gastos no mesmo ponto (`ORDEM_DE_PINTURA` em `_paisagemDoCampo.ts`).

## Código

- `client/src/animacoes/transicao/_campoEnsolarado.ts` tem a cena dividida (`criarCampo(fundo)`), e `_paisagemDoCampo.ts` tem o fundo. As três animações são wrappers de uma linha: `campo-ensolarado.ts`, `campo-ensolarado-tres-casas.ts` e `campo-ensolarado-vila.ts`, cada uma com o seu `.json`. Arquivos com `_` na frente não viram animação no pacote; cada módulo leva o código dividido embutido.
- Com o fundo `'nenhum'` (a original) a cena não cria nenhum objeto nem sorteio a mais.
- `prototipo.html` é gerado por `montar.cjs` a partir de `fonte.html` (`node docs/design/transicao-campo-ensolarado-variacoes/montar.cjs`, da raiz). Usa o mesmo código das cenas, empacotado pelo esbuild num IIFE, e `three@0.186.1` da CDN. Botões Original, Três casas e Vila.

## O que NÃO foi verificado

Por ordem do usuário em 27/10/2026 ("só faça testes se eu pedir"), nada disto rodou na versão sem muro:

- o teste `campo-ensolarado-variacoes.test.ts` (já escrito para a vila sem muro, sem rodar) e o `campo-ensolarado.test.ts`;
- `provas/gerar-provas.cjs` (digitais da original antes e depois da divisão, folhas de contato, quadros e desempenho): a pasta `provas/` só tem o gerador, sem nenhuma saída;
- nenhum print, nenhuma medição de quadro e nenhuma conferência de som.

A vila sem muro ainda não foi vista renderizada por ninguém: o mestre aprovou a versão com muro e pediu só a retirada. O que se sabe dela vem da leitura do código.
