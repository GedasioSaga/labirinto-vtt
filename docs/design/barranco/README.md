# Barranco (protótipo para aprovar)

Pedido de 28/10/2026: dar a sensação de parte alta e parte baixa em mapa normal (vila, cidade, campo). Hoje o relevo só funciona em mapa de continente, porque sai de terra e mar. Num mapa de vila, o penhasco nem aparece.

- Página: `prototipo/index.html`. É um arquivo só, sem imagem nem fonte de fora, e abre direto no navegador.
- Nada em `client/` mudou.

## O que dá para fazer na página

- **Risco** (tecla `1`). Arraste para riscar uma beira. O lado alto começa para cima (norte), e a parede cai para o sul. O risco escolhido mostra a alça **Virar** no meio da linha, com a seta apontando para o lado baixo. Clicar nela recolhe a parede e a faz crescer do outro lado, em 220 ms. `F` vira na hora. Clique num risco para escolher, `Delete` apaga, `Esc` solta a escolha.
- **Área alta** (tecla `2`). Pinte a parte alta: a borda inteira vira barranco sozinha. Começar dentro de uma área alta sobe mais um degrau (área dentro de área). Segure `Alt`, ou use Descer, para baixar um degrau.
- **Altura** Baixo, Médio e Alto muda a espessura da parede: 10, 16 e 24 px a 100%, num quadrado de 32. Com um risco escolhido, muda ele na hora.
- **Rampa** (tecla `3`). Passe o ponteiro sobre um barranco e aparece a prévia. Clique para pôr, e clique numa rampa para tirar. A rampa abre 2 quadrados.
- **Ficha.** Arraste a ficha "A", ou use as setas e WASD com o mapa em foco (`Shift` anda um quadrado). Ela não atravessa o barranco e escorrega pela parede. Só passa numa rampa ou por fora da ponta, onde a linha acaba. Presa, ela mostra a linha de visão passando por cima do barranco. A frase embaixo do mapa diz onde a ficha está ("Na praça, um degrau acima da rua").
- **Estilo do mapa.** Atual (o barranco liso do Meio-Termo, `client/src/texturas/meioTermo/barranco.ts`) e Desenhado (o do protótipo `vila-estilo-mother`). Mesma vila, mesma câmera.
- Grade liga e desliga. Desfazer (`Ctrl+Z`), Refazer (`Ctrl+Y`) e Restaurar a cena.

A cena tem: a praça elevada (área, Médio) com duas casas e o poço; o terraço com a árvore dentro dela (área, Baixo, mais um degrau); a rua mais baixa; o barranco do rio (risco, Alto), que acaba no meio, e por ali uma trilha desce até a água; o morro (risco, Médio), sem rampa; e duas rampas (praça e terraço).

## Como entraram as 4 decisões de 28/10

1. **Os dois jeitos.** O risco funciona como o Penhasco: arrasta uma linha, escolhe a altura e vira o lado. A área é pintada por quadrado, e a borda dela vira barranco. Os dois convivem na cena, e área dentro de área faz mais um degrau.
2. **Segura o andar, não a visão.** O barranco segura a ficha, mas a visão passa por cima. A rampa é a passagem que o mestre põe.
3. **A cara segue o estilo.** Os tons vêm das paletas: Atual `#aa745c`, `#c28b71` e `#915f4a`, com o perfil de cor do `barranco.ts`; Desenhado `#b87058`, `#d08870` e `#a06040`. O contorno é o escuro da própria cor, nunca preto.
4. **Profundidade.** Três sinais, nenhum miúdo:
   - A parede é vista um pouco do sul, como nos RPGs. A virada para o sul aparece inteira; a do norte e as dos lados ficam com 36% da espessura. Na primeira versão a espessura era igual em volta toda, e a praça parecia cercada por um muro.
   - A luz vem de cima à esquerda. A parede virada para a luz é mais clara, e a de costas é mais escura e joga sombra no lado baixo.
   - O alto de cada área fica um pouco mais claro a cada degrau.

   Para seguir a regra de "nada de bolinha", no Desenhado a grama da beira é uma onda só e mansa; no Mother eram tufos redondos. O zigue-zague do pé ficou largo e baixo, com dentes de 20 a 34 px.

## Para decidir

As quatro perguntas estão na faixa da direita, e cada opção já vale no mapa.

1. O barranco segue a grade (cada quadrado alto ou baixo) ou corta livre? Sugestão: livre.
2. A rampa é vão (o barranco abre em terra) ou peça (escada de pedra)? Sugestão: vão.
3. Quantos degraus acima do chão: 1, 2 ou 3? Sugestão: 3.
4. Quem está embaixo vê o que está em cima? De cima para baixo já passa. Sugestão: vê.

## Fora do protótipo, para o usuário decidir

- **O Barranco se sobrepõe ao Penhasco.** O risco com altura Baixo/Médio/Alto é o mesmo gesto de `client/src/components/PenhascoControls.tsx`. Se o Barranco substitui o Penhasco, se o Penhasco fica só no mapa de continente, ou se os dois convivem, o protótipo não decide.
- **O dado entre telas.** No app, o barranco teria de aparecer também na tela do jogador, entrar na regra da névoa (visão) e no andar em blocos da batalha. Nada disso existe aqui: a página só mostra a tela do mestre.

## O que foi conferido

- No Chromium sem tela desta máquina, por um script de conferência fora do repo (não é teste): a página abriu sem erro de script. A ficha parou na praça, no rio e no morro; subiu pelas duas rampas e por uma rampa nova posta no morro; e passou pela ponta do rio. Riscar, virar, mudar a altura, desfazer, pintar a área, pintar um degrau dentro da praça, pôr e tirar rampa e andar pelo teclado funcionaram.
- Redesenhar o mapa inteiro, o que acontece a cada passo do pincel: 4 a 6 ms com tela 1x e 11 a 13 ms com tela 2x (mediana e pior de 12 vezes).
- Sem rolagem lateral em 1100, 760 e 390 px.
- 4 prints para conferir o layout, fora do repo.

## O que não foi conferido

- Ninguém usou com o mouse de verdade. O arrasto foi simulado.
- Safari e Firefox (o filtro `blur` da sombra no canvas é o ponto de risco).
- Se a altura "lê na hora" para quem joga: isso quem julga é o usuário.
- O porte para o app (Pixi, colisão por bloco, rede) não existe.
