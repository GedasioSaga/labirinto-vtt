# Estilo do RPG: Meio-Termo

Decidido pelo usuário em 21/10/2026. Nome combinado: **Meio-Termo** (também "o estilo do RPG"). Direção aprovada, para melhorar sempre. **Ainda não está aplicado em `client/`.** O usuário quer aplicar no dia 21/10/2026, quando mandar.

> 21/10/2026: "Eu gostei do que vi, salva esse estilo, vai ser o estilo do RPG, vamos sempre estar melhorando. Não vamos aplicar agora mas ainda vamos aplicar hoje, salve tudo, e me diga o nome para que quando eu falar você me lembre."

## Onde está

- Protótipo: `docs/design/vila-meio-termo/` (`prototipo/index.html`, `README.md` com a paleta em tokens, `provas/`). Commit `bb0f5a23`.
- Publicado (privado): https://claude.ai/artifact/V5kvehGmMCybFUbN7BGj4U
- Antecessores, para comparar (a página tem um botão para cada um): `docs/design/vila/` (modo Textura, `fb945938`) e `docs/design/vila-estilo-mother/` (modo Estilo Mother, `6ea4d57b`).
- Pedidos e decisões: `PEDIDOS.md`, seções de 21/10/2026.

## A receita

O meio entre o realista (Textura) e o cartoon (Estilo Mother).

- **Da Textura:** os objetos (barril, caixa, baú, banco, carroça, barracas, mesa, quadro, lampião, fogueira, troncos), o poço e a **porta do Resident Evil, só polida** (batente escuro, folha de tábua, dobradiças, degrau de pedra, veio de madeira, ponto de luz na maçaneta). Sem porta em arco.
- **Do Estilo Mother:** a árvore, as lajes empilhadas dos caminhos, a jardineira de flores, o campo florido em volta do poço, o arco do portão com flor, a placa de seta com balão ("outro mapa"), o chão de grama com flores e tufos sem repetição, o barranco de terra, a trilha de terra e a chaminé no telhado.
- **Saiu:** a árvore da Textura (o usuário achou estranha) e a porta em arco do Estilo Mother.
- **Paleta:** grama de verde fresco em saturação intermediária, praça de pedra clara e quente, terra de caminho alaranjada e calma, contorno fino em tom escuro da própria cor, grão leve na madeira, na pedra e na telha, sombra suave. Valores em `docs/design/vila-meio-termo/README.md`, seção "Paleta (tokens)".

## Regras do estilo

1. Contorno nunca preto puro, sempre o tom escuro da própria cor.
2. O chão nunca repete: é gerado por posição, não por ladrilho. Prova: 0 blocos iguais de 96x96 px.
3. Barranco é preenchimento liso com realce. Sem hachura e sem parede grossa (rejeitadas pelo usuário).
4. Porta de 36x24 px a 100% e vão de 34 px (a prova com o robô mostrou que 30 px deixa portas sem caminho).
5. Cores contidas: pastel nunca neon. Se uma cor estourar no zoom 100%, baixar a saturação e dizer.
6. Textura por código, determinística (mesma entrada, mesma imagem).
7. O print do jogo de referência não entra no repositório (o repo é público). Pegamos o estilo, não sprite, mapa nem texto.

## Medidas do "meio" (relatório do designer, `provas/testes.json`)

- Croma médio: Textura 0,0380, Meio-Termo 0,0701, Mother 0,0863.
- Energia de borda: Textura 0,1514, Meio-Termo 0,1733, Mother 0,1848.
- 38 cores base; menor luminância de contorno 0,042.
- Provas: 41 de 41 (robô nas 7 portas, quadro p95 16,7 ms, primeira pintura 287 ms).

## Para melhorar (lista viva, registre cada ajuste aqui)

- A ilha de flores do poço ficou pequena e as flores quase não aparecem a 100%.
- A praça é grande e uniforme, toda bege; pode parecer vazia perto do Mother.
- A porta polida mudou pouco; pode ir mais longe.
- O barranco ficou fino.
- Sem resposta ainda: tamanho da chaminé (11 px a 100%), contorno de fora colorido ou cinza escuro, palha em espinha como terceiro modelo de telhado.

## Para aplicar no app (a combinar com o usuário)

- Já está no app: telhado de telha e madeira (v0.4.34) e portas de fora sobre o telhado (v0.4.35).
- Segundo o relatório do designer, não existem ainda no código do `client/`: palha em espinha e chaminé. Também faltam, a conferir no momento do plano: as peças novas (barraca, carroça, lampião, quadro de avisos, vasos, árvore, sebe, jardineira, arco, placa de seta), o barranco, o chão sem repetição e a ilha do poço.
- Ordem proposta (README da vila): 1) portas (tamanho, vão de 34 px, casas de baixo viradas para a praça); 2) placas com ícone e botão Nomes; 3) poço e peças novas no painel de objetos; 4) chão e borda (barranco); 5) sombra do beiral e chaminé.
- Antes de mexer em `client/`: plano em plan mode e perguntas. Uma fatia por commit, com teste (robô nas portas, quadro p95 até 20 ms, primeira pintura até 400 ms) e registro no `PEDIDOS.md`.
