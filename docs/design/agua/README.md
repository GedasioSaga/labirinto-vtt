# Água: protótipo

Pedido do mestre de 12/11/2026: água animada, rio e mar, com a cor trocável ("vai ver eu quero fazer um mar verde"), e "algo bem fluido". Decisões dele: ferramenta própria "Água", chave "Barra a passagem" em cada água (desligada de fábrica), cores prontas no estilo do mapa mais uma livre. Este protótipo mostra a proposta antes de qualquer mudança no app.

**Abrir:** dois cliques em `prototipo-agua.html`. Funciona sem internet e precisa de WebGL2 (qualquer Chrome, Edge ou Firefox recente). Leva menos de 1 segundo preparando a água.

## O que dá para fazer

- **Arrastar no mapa** traça uma água nova do tipo escolhido: **Rio** (tecla R) segue o traço; **Lago** (L) e **Mar** (M) fecham a área ao soltar. Um clique numa água escolhe essa água.
- **Cor da água:** Azul de rio, Azul de mar fundo, Verde-mar, Turquesa, Água de pântano, Água barrenta, ou a **Cor livre** (qualquer cor; o raso e o fundo saem dela).
- **A água escolhida:** trocar Lago e Mar, ligar **Barra a passagem** (a água que barra ganha a marca tracejada), Apagar (Del) e Soltar (Esc).
- **Medidas:** largura do rio de meia casa a seis (teclas `[` e `]`), velocidade da correnteza, tamanho das ondas e espuma. O que não vale para o tipo escolhido fica desligado com o motivo escrito embaixo.
- **Desenho:** Hoje (1) e Proposta (2). Segure **H** (ou o botão) para ver o de hoje sem tirar a mão.
- **Luz e visão:** Dia (D) e Noite (N). **Visão do jogador** (V): as setas andam com a ficha; fora da visão não aparece nada e o que ele já viu fica parado e escuro. "Esquecer o que viu" limpa a memória.
- **Parar o movimento** (P) e **Quadros por segundo** 60 ou 30, para comparar. Se o sistema pede menos movimento, a água já abre parada.
- **Mapa:** Desfazer (Ctrl+Z), Voltar ao exemplo, Limpar tudo; a roda do mouse aproxima, o botão direito (ou Espaço) arrasta o mapa e a tecla 0 mostra o mapa inteiro.
- **Fluidez:** o painel mostra o tempo entre quadros; "Medir o custo da água" mede quanto a água pesa na placa de vídeo.

O exemplo traz um mar com praia, que barra a passagem; um lago; um riacho que desce até o lago; um rio de 2 casas que sai do lago e deságua no mar; e um brejo cor de pântano.

## Para conferir

1. Tecla 1 (Hoje) e 2 (Proposta): no Hoje a água é a tinta Mar lisa, de borda dura e parada.
2. Aproxime a foz do rio no mar (roda do mouse): a correnteza se desfaz em uns 20 px dentro do mar, e a areia da praia e o barro do rio se juntam sem corte reto.
3. Escolha o Mar e troque para Verde-mar, depois suba as ondas e a espuma.
4. Tecla N: a água escurece com a mesma tinta da noite do app, e o brilho do sol vira o da lua.
5. Tecla V e ande com as setas até o mar: a ficha para na água que barra, e a margem que o jogador ainda não viu não ganha praia nem espuma.

## De onde vêm as coisas

- Cores e medidas da interface: `client/src/theme.ts`, as mesmas dos protótipos da Luz, das Sombras e do Chão e caminho.
- Tinta da noite (`#465a92` a 85%): `client/src/lib/periodo.ts`. Água do Meio-Termo (`#40707e`): `client/src/texturas/meioTermo/paleta.ts`. Grama do Campo Verde: `client/src/texturas/embutidas.ts`. A cor do Hoje é a tinta Mar de `client/src/lib/camadasDoChao.ts`.
- O shader segue o molde da neblina do app (`client/src/pixi/drawNeblina.ts`): um desenho só, e por quadro só muda o tempo.
- Proposta, alternativas, escolhas do mestre e o plano para o app: `tmp/novos-2026-11-12/agua/PROPOSTA.md`. Como é hoje e o que está ruim: `tmp/novos-2026-11-12/agua/ACHADOS.md`.

## Provas (`provas/`)

- `geral.png`: a Proposta, mapa inteiro.
- `foz.png`: o rio entrando no mar, de perto.
- `noite.png`: a mesma cena de noite.
- `jogador.png`: a visão do jogador perto do mar.
- `hoje.png`: o Hoje.
- `depois.png`: com um rio barrento e um lago verde-mar traçados pelo mouse.
- `folha-de-contato.png`: 12 quadros a cada 0,1 s da foz a 240%, com o tempo e a mudança entre quadros embaixo de cada um.
- `relato.txt`: os tempos medidos.

Scripts em `tmp/novos-2026-11-12/agua/`: `prova.mjs` (prints e medidas), `medir.mjs` (medidas sem print), `controles.mjs` (16 conferências dos controles, todas passaram; resultado em `controles.txt`).

## Medidas

Medido no Chromium headless deste PC (não num PC comum), com o mapa inteiro a 1240 x 900:

- **Quadros:** a 60 por segundo, mediana de 16,7 ms entre quadros, p95 de 16,8 a 16,9 ms, maior 17,2 ms. A 30, p95 de 33,5 ms. O trabalho do JavaScript por quadro foi de 0,2 ms, e nenhuma tarefa de 50 ms ou mais apareceu com a água mexendo.
- **Placa de vídeo:** a água sozinha custa de 0,1 a 0,3 ms por quadro.
- **Parada:** 0 quadros em 2 s. Só desenha quando há motivo.
- **Ao abrir:** a maior tarefa foi de 131 ms na primeira abertura (o navegador compilando o shader) e nenhuma acima de 50 ms na segunda, todas abaixo de 200.
- **Ao traçar:** o campo de um rio novo sai em 33 a 43 ms, e o de um lago em 19 a 22 ms.

## Limites do protótipo

- Só PC. Não foi medido numa placa de vídeo integrada nem em tela 4K.
- O mundo tem 36 x 24 casas de 40 px, e o campo da água tem 2 px por ponto. Acima de 240% fica macio.
- Na visão do jogador, a regra da margem não vista vale para lago e mar, e não para o rio.
- Dois rios que se juntam ou se cruzam não foram testados.
