# Ferramentas do jogador em batalha (protótipo da B6)

Pedido de 27/10/2026: "como eu começo uma batalha?". Esta é a fatia B6 de `docs/planos/modo-batalha-2026-10-24.md`. O protótipo serve para o mestre aprovar antes de qualquer código no app. É só HTML, e nada em `client/` mudou.

- Página: `prototipo.html`. É um arquivo só, sem nada de fora, e abre direto no navegador.
- Cenas prontas para conferir o desenho: `prototipo.html#prova=cone` e `prototipo.html#prova=esbarrou`.

## O que dá para fazer

Você joga como a Lia, a ficha de latão. A coluna "Tela do mestre" simula o que chega na mesa.

- **Andar.** Arraste a ficha da Lia, ou use as setas e Enter. A prévia mostra o caminho e "N blocos", contados com as paredes que ela conhece, com diagonal valendo 1 e quina recusada. Um fantasma da ficha encaixa no bloco de destino. Casa ocupada, fora do chão e sem caminho aparecem no rótulo antes de soltar.
- **Caminho andado.** Cada passo andado fica numerado no mapa e o painel soma o total. O do Bruno, já andado, aparece em azul. O "Zerar caminhos" do mestre apaga todos, e o jogador recebe o aviso "O mestre zerou os caminhos."
- **Medir.** Conta em linha reta, casa a casa, com diagonal valendo 1. Cada casa mostra o número do seu bloco.
- **Círculo.** É quadrado: raio 2 pega 25 blocos. Só a borda do mapa corta.
- **Cone.** Tem 8 direções e meia abertura de atan(1/2), a do `casasNoCone`. Q e E giram, + e − mudam o tamanho.
- **Visão.** A linha fica verde até o alvo, ou mostra um X na primeira parede que o jogador conhece e segue tracejada até o alvo.
- **Mostrar a…** aparece com a medida solta. É o mesmo fluxo do `PlayerRouteShare` atual: procura os colegas, mostra os nomes, e cada nome manda a medida. O mestre vê o que chegou.
- **Revela e avisa.** Há uma parede invisível no salão. Leve a Lia para junto do goblin de cima. A ficha para na última casa legal, dá um tranco contra a parede, e a parede aparece em brasa e esfria até a cor normal. O aviso traz o número real: "andou 7 blocos, não 8". O mestre recebe "Lia esbarrou na parede invisível."
- O interruptor "Mostrar o que o jogador não vê" desenha tracejadas a parede invisível (vermelha) e as da névoa (azul). Com ele dá para ver que a Visão, o Cone e o Medir passam por elas.

## De onde vêm as regras

- As contas são porte, para JavaScript, de `client/src/lib/batalha/blocos.ts` (`conferirPasso`, `menorCaminhoEmBlocos`) e de `medicao.ts` (`casasNoCirculo`, `casasNoCone`, `direcaoMaisPerto`, `linhaDeVisao`). Aqui a parede só existe na aresta da casa, e com isso a regra da quina vira "nenhuma das 4 arestas que encostam na quina". O porte não foi testado contra o código do app.
- O host simulado segue a opção D: anda o caminho que o jogador pediu, com todas as paredes, e para antes do primeiro passo que não vale. A prévia e as medidas usam só o recorte do jogador, porque parede invisível não corta a medição (regra do usuário, 27/10).
- A cara vem do painel do jogador: tokens `--lb-*` copiados de `client/src/theme.ts`, a peça que vira placa de latão, o rótulo da régua (`.pp-measure-label`) e o aviso em pílula. O chão é a pedra `praca` do Meio-Termo. A grade fica acima do mapa e da névoa e abaixo das fichas, como diz a decisão 2.
- Movimento: a ficha anda 150 ms por bloco (no máximo 900 ms), em ease-in-out. O tranco leva 200 ms, e a parede revelada esfria em 900 ms. Com movimento reduzido não há deslize nem tranco, só a cor.

## Para decidir

1. Medir conta em linha reta, sem olhar parede. O caminho de verdade aparece ao arrastar a ficha. Fica assim?
2. Em batalha, o Medir de sempre passa a contar blocos, e Círculo, Cone e Visão só aparecem em batalha. Pode ser?
3. "Zerar caminhos" fica só com o mestre, ou o jogador também zera o dele?
4. O jogador vê o caminho andado dos colegas, como o do Bruno aqui, ou só o dele?
5. O aviso ao esbarrar diz "uma parede que você não via". Ele separa a parede de uma porta escondida só depois que ela aparece no mapa. Serve?

## O que ficou de fora

- Aqui só há mapa quadrado e ficha de tamanho 1. Também ficaram de fora o hex, o passo máximo da cena e a troca de andar.
- O protótipo não mostra a tela do colega que recebe a medida, nem como ela some de lá. O que o colega lê aparece só no aviso do mestre.
- Verificação: a sintaxe foi conferida pelo parser do Node. As três cenas abriram no Chrome sem erro de script. Tirei dois prints, um em 1440 com o cone e outro em 1080 com o esbarrão. Ninguém clicou nas telas nem passou o teclado de verdade.
