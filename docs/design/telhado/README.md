# Telhado da sala (protótipo)

Pedido de 18/10/2026 (literal em `PEDIDOS.md`): de fora, o pino vê o telhado; quando entra pela porta, o telhado some e a sala aparece; quando sai, o telhado volta.

- Protótipo: `prototipo/index.html` (página avulsa; publicada como Artifact para aprovar).
- Provas: `node docs/design/telhado/provas/gerar-provas.cjs` (da raiz do repo). Gera `testes.json`, `folha-contato.png`, `grafico-movimento.png` e 3 prints de layout.

## Como funciona

- Visão de cima, igual ao mapa (escolha do usuário). Cada sala tem um telhado próprio que passa 8 px da parede (beiral) e faz sombra no chão.
- Sala: telhado de 4 águas em barro, com chaminé em cima da lareira. Depósito: 2 águas em ardósia. Cada água tem um tom (luz vinda de cima à esquerda); não tem desenho de telha, porque listra fina vira hachura.
- O telhado começa a sumir quando o centro do pino cruza a linha da parede (na porta). Some em 300 ms (escolha do usuário: "some suave, ~0,3 s") com ease-out e sobe 6 px / 3,5% enquanto some. Na saída ele volta pelo mesmo caminho. Se o pino entra e sai na hora, o telhado vira no meio, sem pular.
- O telhado é desenhado uma vez numa imagem própria, e essa imagem é que vai sumindo. Assim, no meio da transição, não aparecem as emendas entre as águas.
- Fichas dentro da sala (o mordomo) ficam escondidas pelo telhado para quem está fora.
- Visão do mestre: telhados a 32%, como vidro fosco; o mestre sempre vê o que tem dentro.
- Com movimento reduzido, o telhado só desbota (não sobe) e o fogo da lareira fica parado.

## Provas (18/10/2026)

22 de 22 em `provas/testes.json`: só a porta deixa passar, o telhado fica fechado enquanto o pino está fora, some em 225 ms depois de cruzar a porta (meta: <= 300 ms), volta em 225 ms, nunca pisca, entrar e sair na hora não pula (maior salto 0,29 por amostra de 25 ms), o mordomo fica escondido de fora e aparece de dentro e na visão do mestre (conferido pela cor do pixel), quadro p95 16,8 ms andando pela trilha, nenhuma tarefa longa, sem rolagem para o lado em 390 px, sem erro no console.

Não conferido: celular de verdade e o app real. Não tem som.

## Em aberto para levar ao app

1. Mestre: telhado a 32% (como aqui), só o contorno, ou sem telhado?
2. Casa com várias salas: abrir só a sala onde o pino está ou a casa inteira?
3. Jogador fora vê os pinos dos outros jogadores que estão dentro? Hoje, não: cada jogador vê pelo próprio pino.
4. Mestre escolhe o tipo (4 águas, 2 águas) e a cor (barro, ardósia...) nas propriedades da sala?
5. Como o telhado convive com a névoa do app.
