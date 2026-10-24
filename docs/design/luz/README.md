# Luz e Dia/Tarde/Noite: protótipo das cores (fatia L4a)

- **O que é:** um mapa de exemplo no estilo Meio-Termo (grama, terra, casa de palha, árvores, muro de pedra, fogueira, lampião e 2 fichas) visto de dia, de tarde e de noite. A tinta do período entra em multiply. A fogueira e o lampião somam uma luz quente que para na parede, montada como o `mapaDeLuz.ts` planejado para a L4b (`docs/planos/luz-dia-tarde-noite-2026-10-24.md`).
- **Como abrir:** duplo clique em `prototipo-dia-tarde-noite.html` (sem rede, só PC). As teclas 1, 2 e 3 trocam o período (1,5 s) e V troca entre mestre e jogador. Cada controle deslizante mostra o seu número, e o bloco "Constantes" copia tudo pronto para o código.
- **Recomendado:**
  - dia sem tinta (`#ffffff`; o mapa fica igual ao de hoje);
  - tarde pêssego-rosado `#f0aa98` a 60%;
  - noite azul-ardósia `#465a92` a 85%;
  - luz quente `#ffba7b` (calor 55%), com fogueira de 5 casas e lampião de 3,5 casas;
  - luz à tarde a 30%;
  - contorno creme `#f3efe2` de 2,5 px, só na ficha do próprio jogador;
  - mestre vê a tinta a 50%.
- **Alternativas no lado a lado:** à noite, azul-violeta `#5a5488` e verde-petróleo `#3d6672`; à tarde, âmbar `#f2b071` e dourado-lilás `#d9a8b8`. Cada cartão mede brilho e vivacidade (OKLCH) contra o dia e mostra cada material antes e depois da tinta, para achar o barro.
- **O que se aprendeu:** com multiply, a luz nunca passa da cor do dia. Por isso, à tarde, a luz forte só tira o laranja e deixa a grama verde em volta da fogueira, e ela entra a 30%. A ardósia mais morna (`#4f5f86`) deixava a palha e a terra num marrom-oliva barrento; a nova, mais azul, deixa um cinza frio.
- **Provas:** em `provas/`, 3 capturas do Playwright (Edge), 0 erro no console. Medidas à noite, na visão do jogador:
  - a parede barra a luz: brilho de 153 antes do muro e 83 atrás dele;
  - o telhado não acende: 75 no telhado contra 179 no chão sob o lampião;
  - o mestre vê mais claro: média de 131 contra 88 do jogador;
  - a transição tem 91 quadros em 1,5 s, cada um desenhado em no máximo 1,1 ms (p95 de 0,6 ms);
  - a maior tarefa longa foi de 60 ms, ao abrir a página.
- **Perguntas ao usuário:**
  1. Noite: azul-ardósia a 85%, ou violeta, petróleo, ou outra força?
  2. Tarde: pêssego-rosado a 60% (com a luz a 30%), ou âmbar, dourado-lilás, ou outra força?
  3. Luz e ficha: calor de 55%, fogueira de 5 casas e lampião de 3,5 casas servem de padrão? O contorno de 2,5 px ajuda a achar a sua ficha à noite?

## Decisão do usuário (24/10/2026)

Noite: azul-ardósia `#465a92` a 85%. Tarde: âmbar `#f2b071` a 60% (luz quente a 30% à tarde). Dia sem tinta. Pedido novo: ambiente configurável por mapa no programa (cor, força e visão por período); ver D7 em `docs/planos/luz-dia-tarde-noite-2026-10-24.md`.
