# Vila no Estilo Mother (protótipo para aprovar)

A mesma vila do protótipo anterior (`docs/design/vila/`), com as mesmas 7 casas no mesmo lugar, as mesmas portas, as mesmas funções, o mesmo poço e o mesmo mercado. Muda só o jeito de pintar: um livro de histórias visto de cima, inspirado no estilo do print que o usuário mandou em 21/10/2026. Não é pixel art. É desenho com contorno colorido.

Do print saiu só o estilo: paleta, formas, contorno e quanto detalhe tem no chão. Nenhum sprite, mapa, nome ou texto do jogo entrou no repositório, e o print também não entrou (o repo é público). As cores marcadas como amostradas na tabela abaixo foram lidas pixel a pixel do print, numa cópia que ficou fora do repo.

- Página: `prototipo/index.html`, um arquivo só, sem imagem nem fonte de fora (a moldura da página usa Barlow, como o protótipo anterior).
- Seletor com 3 modos e a mesma câmera: **Hoje** (a recriação do mapa de hoje), **Textura** (o protótipo v1, commit fb945938) e **Estilo Mother** (novo, abre selecionado).
- Nada em `client/` mudou. Nada em `docs/design/vila/` mudou.

## Como montar e provar

```
node docs/design/vila-estilo-mother/prototipo/montar.cjs
node docs/design/vila-estilo-mother/provas/gerar-provas.cjs
```

O `montar.cjs` reaproveita o motor do protótipo anterior sem copiar arquivo grande. Ele lê `vila.js` e `pagina.js` de `docs/design/vila/prototipo`, o pintor de objetos de `docs/design/objetos/prototipo/objetos.js` e o telhado do app (empacotado pelo esbuild a partir de `client/src`, para o modo Textura). Depois abre esses arquivos em 22 pontos conferidos: cada trecho precisa casar o número exato de vezes, senão a montagem para com erro. O que é novo mora em `prototipo/mother.js` (pintores, paleta e cenário) e `prototipo/fonte.html` (a página).

## Paleta

São 27 cores base, todas num bloco só (`// <PALETA>` em `mother.js`). Uma prova confere que não existe cor escrita fora desse bloco. Cada cor gera quatro tons: base, realce (luz de cima à esquerda, puxado para o amarelo), sombra e contorno (o escuro da própria cor, nunca preto). Também gera um traço para o padrão do telhado. Ao todo são 135 tons.

| Token | Base | Origem | Onde |
|---|---|---|---|
| grama | `#86eab8` (sombra `#66ca98`, contorno `#2ea268`) | amostrado, com 10% menos saturação (ver abaixo) | chão liso, tufos, beira do barranco |
| terra | `#f8b868` (realce `#f8c878`, sombra `#e8a058`) | amostrado | estradas e saídas |
| praca | `#d8f8e8` (realce `#e8fcf4`, rejunte `#c8e8d8`) | amostrado | pedras redondas da praça, piso do templo |
| barranco | `#b87058` (realce `#d08870`, sombra `#a06040`) | amostrado | a borda do mundo |
| amarelo, violeta, branco, laranja | `#f8e060`, `#b078e0`, `#f8f8f0`, `#f86830` | amostrado | flores, maçanetas, jardineiras |
| rosa | `#f4a8d8` | escolhido no tom do print | flores, cogumelos |
| agua | `#68b0d8` | escolhido | poço, aparador |
| madeiraClara, madeira, madeiraEscura | `#f8c890`, `#d09060`, `#a06828` | amostrado | placas, bancos, barris, folha da porta |
| reboco, papel | `#f8f8d8`, `#f8f0c0` | amostrado | fresta de parede, pino, cartazes |
| pedra, metal | `#c4d0c8`, `#7a8a8c` | escolhido | lajes da soleira, degrau, aros, lampião |
| folha, folhaEscura | `#48c088`, `#38a878` | escolhido perto do verde do print | copas, sebes, vasos |
| fogo, vidro | `#f89820`, `#8898c8` | amostrado | fogueira (o vidro ficou sem uso no mapa) |
| telhaAzul, telhaAzulClara, telhaCinza, telhaTerracota, telhaVerde | `#7896d6`, `#94bce4`, `#a8b0b8`, `#e08058`, `#a0c878` | as famílias do app, em tom doce | telhados de 5 casas |
| palha | `#f8d850` (realce `#f8f080`, sombra `#e8c040`, contorno `#b07810`) | amostrado | telhado do estábulo |
| ardosia | `#687878` (realce `#a0b0a8`, sombra `#586868`) | amostrado | telhado do empório e as sombras no chão |

**Menta.** No print a grama é `#80f0b8`. A 100% numa tela de 1440, esse menta ao lado da praça quase branca ofuscava, então os três tons da grama perderam 10% de saturação: `#80f0b8` virou `#86eab8`. A diferença é pequena e se desfaz mudando uma linha.

**Contorno nunca preto.** O contorno de cada cor é o escuro dela mesma. Quando a conta deixaria a cor escura demais, ela clareia até passar da luminância 0,065. O mais escuro de toda a paleta é o do telhado azul, `#1f4493`. Observação honesta: o print usa um cinza neutro bem escuro, `#303030` (luminância 0,030), na silhueta de fora das casas e do barranco. Aqui ele não entrou, porque o pedido era contorno colorido. Fica como pergunta.

## O que mudou no cenário e por quê

- **Barranco no lugar do muro.** É uma faixa de terra avermelhada com contorno escuro da mesma cor, beira de baixo em zigue-zague e grama felpuda por cima. O preenchimento é liso, com um realce e uma sombra, sem hachura e sem parede grossa (as duas foram rejeitadas antes). Ele segue o traçado do muro antigo e tem a mesma colisão.
- **4 saídas.** O barranco abre em norte, sul, leste e oeste, com uma estrada de terra cortando cada abertura, como no print. A do sul e a do norte são as estradas do protótipo anterior e mantêm a placa "outro mapa". A do leste e a do oeste são novas, sem placa: só levam até a beira do mundo.
- **Ilha de grama do poço.** O poço fica numa ilha redonda de grama com um anel de 14 flores, no meio das pedras da praça.
- **Soleira.** As 3 lajes da porta até a praça agora são de pedra. Ficam na mesma linha do caminho de antes.
- **Peças.** São as 31 de antes, no mesmo lugar, mais o arco do portão sobre a estrada do sul e 2 jardineiras ao lado da saída da praça. Total: 34. Fora da conta ficam as 5 sebes, as 2 placas de direção e 31 árvores do lado de fora: menos que antes, porque o campo do print é aberto, e nenhuma em cima das saídas novas.
- **Chão.** Flores em grupinhos (rosa, amarelo, violeta, branco), tufos e uns poucos cogumelos, só na grama, longe de caminho, casa e peça. Tudo é sorteado por hash: abrir duas vezes dá a mesma imagem.
- **Telhados.** O pintor é novo e só deste protótipo; o do app não mudou. Cada água tem cor chapada, um realce no cume, uma sombra no beiral e contorno da própria cor. O padrão é desenhado à mão: escamas redondas na telha, tábuas na ferraria, fileiras na ardósia e espinha de peixe com franja na palha. As 7 cores são as famílias do app.
- **Porta e placa.** A porta tem 36 x 24 px e o vão continua com 34 px. Ela é em arco, com degrau de pedra, batente escuro, folha de tábua e maçaneta amarela. A placa de madeira com o ícone da função fica presa por um suporte, ao lado da porta. Porta e placa são desenhadas uma vez por casa e coladas a cada quadro.
- **Dentro das casas.** Assoalho de tábua; o templo tem pedra e o estábulo, terra com palha. Os móveis são os mesmos de antes, no traço novo. Uma fresta creme com vigas aparece no lado da sombra (sul e leste), além do beiral.

## Provas (34 de 34, Chromium 153 sem tela, esta máquina)

As metas foram escritas antes de codar. O resultado inteiro está em `provas/testes.json`.

| Prova | Meta | Medido |
|---|---|---|
| Robô com 250 ms de atraso e erro de direção, sementes 1 a 5 | entra nas 7 portas, 35 de 35 | 35 de 35; mediana 3,6 s, pior 6,4 s, 1 replanejamento |
| Caminho andável | 7 casas e 4 saídas | 7 de 7 e 4 de 4 |
| Tamanho da porta a 100% | ≥ 18 x 24 px | 36 x 24 nas 7 |
| Nada cobre porta, caminho ou estrada | 0 | 7 portas livres, 11 caminhos livres |
| Folha da porta visível sobre o telhado | diferença de cor ≤ 40 | 0 nas 7 |
| Quadro andando e com zoom | p95 ≤ 20 ms, nenhuma tarefa ≥ 200 ms | p95 16,7 ms; nenhuma tarefa acima de 50 ms |
| Primeira pintura desde o HTML | ≤ 400 ms | 158 ms no computador, 153 ms no celular (390 px, 2x) |
| Erros no console | 0 | 0 |
| Rolagem lateral a 390 px | nenhuma | 390 de 390 px |
| Trocar de modo e voltar | mesma imagem | Mother, Hoje, Textura e Mother: a primeira e a última digital são iguais |
| Contorno nunca preto | nenhum pixel abaixo da luminância 0,04 | 0 pixels, na vila inteira e em 2 detalhes a 260%; o mais escuro tem 0,059 |
| Paleta | 8 a 40 cores base | 27 (135 tons derivados) |

Também passaram: o barranco segura o pino e a saída do oeste deixa passar, a parede segura e a porta deixa entrar, o telhado some em 283 ms (meta ≤ 320) e volta na saída, o clique e o toque levam o pino, os botões das casas, Grade, Nomes, zoom, setas e WASD, as setas nos 3 modos com o foco junto, Hoje com os controles travados e o motivo escrito, e a mesma imagem em duas aberturas.

**Como a travada foi medida.** A sessão de andar e dar zoom roda numa página nova, como a de quem abre o link. As provas de pixel leem o canvas (`getImageData`), e isso pode tirar o canvas da placa de vídeo. Na página já lida, o desenho de um quadro sobe de 14 para 20 ms (p95), e o intervalo entre quadros fica em 16,8 ms. Os dois números estão no detalhe da prova 25. Numa rodada antes de duas correções, a página já lida chegou a p95 de 33 ms. As correções foram: porta e placa coladas como imagem, e só o modo aberto gerando as imagens 2x. Depois delas, 4 rodadas seguidas passaram.

**Prints (5):** `desktop-1440.png`, `lado-a-lado.png` (Hoje, Textura e Estilo Mother com a mesma câmera), `celular-390.png`, `detalhe-poco.png`, `detalhe-porta.png`. O tema escuro da página foi olhado uma vez, sem virar print: a moldura escurece e o mapa continua o mesmo.

## O que NÃO foi conferido

- Celular de verdade e outra máquina. Tudo rodou no Chromium sem tela desta máquina; o celular é uma emulação de 390 px com tela 2x.
- Safari e Firefox.
- Se "parece Mother 3". Isso quem julga é o usuário.
- Se é gostoso de andar. O robô prova que dá para chegar, não que é bom.

## O que ficou de fora

- **Faixa de fachada 3/4.** Não foi implementada. Fica como pergunta, como pedido.
- **Nada foi para o app.** O pintor de telhado, a paleta e o barranco moram só neste protótipo.
- As saídas do leste e do oeste não levam a outro mapa: são só estrada até a beira.
- O modo Hoje continua sem nomes e sem a ida às portas, como no protótipo anterior (o motivo está escrito na tela).

## Perguntas para o usuário

1. A paleta está certa? Está doce sem ficar infantil, e quente o bastante?
2. O menta estoura? Com 10% menos saturação ficou bom, ou prefere o `#80f0b8` puro do print (ou ainda mais calmo)?
3. O barranco funciona como borda do mundo, no lugar do muro? E as 4 saídas?
4. Quer a faixa de fachada 3/4 (a parede da casa aparecendo embaixo do beiral, como no print)?
5. A palha em espinha de peixe entra no app como terceiro modelo de telhado, ao lado de telha e madeira?
6. Qual dos 3 modos vai para o app: Textura, Estilo Mother ou uma mistura? E o contorno de fora fica colorido, ou no cinza escuro `#303030` que o print usa?
