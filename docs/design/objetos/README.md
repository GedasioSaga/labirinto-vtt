# Objetos do mapa com textura (protótipo)

Pedido de 20/10/2026 (literal em `PEDIDOS.md`, seção "objetos bonitos com textura"): colocar textura e deixar bonitos, em 2D ou 2,5D, os 11 móveis do painel Objetos > Móvel. Nada no `client/` foi mexido; isto é para aprovar antes.

- Protótipo: `prototipo/index.html` (página avulsa, para publicar como Artifact). É montado por `node docs/design/objetos/prototipo/montar.cjs`, que cola `objetos.js` (o desenho) e `pagina.js` (a página) dentro de `fonte.html`.
- Provas: `node docs/design/objetos/provas/gerar-provas.cjs` (da raiz do repo). Monta o protótipo, roda as provas no Chromium do Playwright e grava `testes.json`, `folha-contato.png`, `folha-materiais.png`, `desktop-1440.png` e `celular-390.png`.

## O que foi feito

Decisões do usuário (20/10): mostrar as duas vistas com um botão claro, textura feita pelo código, material no lugar da cor livre e nada se mexendo.

- **Duas vistas, mesmas peças.**
  - **De cima com volume** é o mapa de hoje: o móvel visto reto de cima. A luz vem de cima à esquerda, a mesma do telhado. As bordas têm chanfro e cada peça faz sombra no chão.
  - **3/4** sobe o tampo pela altura do móvel e mostra a frente embaixo dele, mais escura, como em Zelda e Stardew. O móvel ocupa a mesma pegada, mas a imagem passa dela para cima.
- **Textura pelo código**, pixel a pixel, como a do telhado (`client/src/texturas/telhado.ts`). Nenhum arquivo de imagem.
  - Madeira: tábuas de largura fixa, veio ondulado, emenda de topo e fresta escura.
  - Topo de tora: anéis.
  - Ferro e latão: mancha e brilho.
  - Linho: trama. Lã: fofa, com amassado no lençol e no cobertor.
  - Pedra: granito pintado, arenito em camadas e ardósia.
  - Palha: trançada.
  - Corda: torcida.
  - Lenha: casca de carvalho, de pinho ou de bétula, queimada no meio.
- **Cor contida.** Toda variação de textura é de poucos por cento, e as madeiras usam os tons do telhado aprovado em 19/10. Nenhum veio é reto, porque linha reta e fina vira hachura no zoom de 50%. O brilho e a sombra levam um ruído de meio tom, para o degradê não virar anéis.
- **Nada se mexe.** A fogueira tem brasa parada no meio, um brilho quente no chão e, no 3/4 e de lado, uma chama baixa desenhada e parada. Só os botões respondem ao toque.
- **Opções de hoje mantidas**:
  - vista Frente/Lado na cadeira, no baú, no armário, no aparador, na fogueira e no tapete;
  - tapete retangular ou redondo;
  - cerca reta ou curva (a sala tem uma de cada; a curva tem régua de 0° a 180°).
- **Tela.**
  - A sala de exemplo segue o estilo do mapa do app: chão chapado, parede fina e porta pequena. A casa tem o chão do app (`#a8776a`) e o pátio, chão de terra.
  - Os 12 móveis estão no tamanho real das casas.
  - O zoom vai de 50% a 200%, pela roda do mouse, pela pinça ou pelos botões.
  - Tocar num móvel abre o painel com a prévia de perto e as amostras de material. No celular, o painel é uma folha de baixo que fecha arrastando a alça ou com Esc, e a página rola para o mapa ficar inteiro acima da folha.
  - O catálogo mostra os 11 móveis no desenho escolhido.
  - O tema escuro acompanha o sistema.
- **Desempenho.**
  - Cada imagem é gerada uma vez por móvel, material, vista e resolução, e fica guardada. Cada quadro só cola imagens prontas.
  - A primeira pintura sai em 1x. A sala fica nítida em seguida, uma imagem por vez.
  - Depois do zoom, a imagem mais nítida só é gerada quando a câmera para, para não travar o gesto.

## Materiais

| Móvel | Escolhas (padrão em negrito) |
|---|---|
| Barril | Madeira: **Carvalho**, Nogueira, Pinho, Cerejeira, Madeira velha · Aros: **Ferro**, Latão |
| Caixa | Madeira: Carvalho, Nogueira, **Pinho**, Cerejeira, Madeira velha |
| Baú | Madeira: as 5 (**Nogueira**) · Ferragens: Ferro, **Latão** |
| Cama | Madeira: as 5 (**Carvalho**) · Cobertor: Linho cru, **Lã vinho**, Lã azul, Lã musgo, Lã ocre · Travesseiro: os mesmos 5 tecidos (**Linho cru**) |
| Mesa | Madeira: as 5 (**Carvalho**) |
| Cadeira | Madeira: as 5 (**Carvalho**) · Assento: Madeira (a mesma da cadeira), **Palha** |
| Cerca | Mourões: as 5 madeiras (**Carvalho**) · Entre os mourões: **Varas** (da mesma madeira), Corda, Arame |
| Armário de cozinha | Madeira: as 5 (**Pinho**) · Puxadores: **Ferro**, Latão |
| Aparador | Madeira: as 5 (**Nogueira**) · Puxadores: Ferro, **Latão** |
| Fogueira | Pedras: **Granito**, Arenito, Ardósia · Lenha: **Carvalho**, Pinho, Bétula |
| Tapete | Tecido: Linho cru, Lã vinho, **Lã azul**, Lã musgo, Lã ocre (a borda e o medalhão saem do mesmo tecido, mais escuros, com fio claro) |

Tons: carvalho `#8b6b47`, nogueira `#5f4532`, pinho `#a3875f` e madeira velha `#7b776e` vêm do telhado de madeira; cerejeira `#7c4b37` é nova. Ferro `#4c4e51`, latão `#9c8044`, linho cru `#c1b59c`, lã vinho `#6d3337`, lã azul `#41526a`, lã musgo `#5a6344` e lã ocre `#977842`. Granito `#7e7b76`, arenito `#9a8669` e ardósia `#585d61`.

## Provas (20/10/2026)

19 de 19 em `provas/testes.json`. Chromium headless nesta máquina; os tempos variam alguns ms entre rodadas.

1. **Primeira pintura da sala inteira**: 137 ms depois que o HTML chegou no computador e 137 ms no celular 390 px 2x (meta: 300 ms). A primeira pintura sai em 1x. A sala fica toda nítida 383 ms (computador) e 548 ms (celular) depois que o HTML chegou. Contando do pedido da página, o computador dá 326 ms, mas 189 ms disso são o navegador frio abrindo e lendo o arquivo, antes de a página existir.
2. **Cada imagem em até 50 ms**: as 242 combinações (cada móvel × cada material de cada escolha × as 2 vistas × Frente/Lado × forma do tapete × cerca reta e curva).
   - A 2 px por px do mapa: pior 27,9 ms, p95 19,1 ms.
   - A 3 px por px do mapa (zoom alto ou tela 2x): pior 40,2 ms (cama), p95 31,9 ms.
   - A margem a 3x é a mais curta. A 4x a cama passava de 50 ms, por isso a resolução para em 3x.
3. **Toda combinação desenha**: 242 de 242. A menor cobertura é a da cerca com arame vista de cima: 25% da pegada.
4. **Cor contida**: em cada móvel, 95% dos pixels têm saturação de no máximo 0,62. O mais saturado deu 0,59 (aparador de cerejeira com latão). A fogueira fica fora da regra por causa da brasa e da chama, e deu 0,70.
5. **Nenhum móvel some de tão escuro**: o mais escuro tem brilho médio 0,17 (armário de nogueira de lado).
6. **Os controles agem de verdade**, todos por clique ou tecla real:
   - clicar no móvel abre o painel, e clicar no chão fecha;
   - a amostra troca o móvel no mapa, o rótulo e o cartão (11 de 11);
   - a seta troca o material, e cada grupo de amostras é uma parada de Tab só;
   - Frente/Lado, tapete redondo e a régua da curva mudam o desenho;
   - o botão 3/4 troca os 12 móveis, e De cima volta todos;
   - Enter no cartão abre o painel, e Esc fecha e devolve o foco ao cartão.
7. **Sem travada**: andando e dando zoom com roda e arrasto de verdade, nas duas vistas, desenhar o mapa leva p95 0,3 ms e o intervalo entre quadros fica em p95 16,7 ms. Nenhuma tarefa longa passou de 200 ms em toda a sessão (a maior foi de 138 ms).
8. **Celular de 390 px**: sem rolagem para o lado. A folha de baixo abre com o mapa inteiro acima dela e fecha arrastando a alça.
9. **Tema escuro** troca o fundo e o texto, e `data-theme="light"` força o claro.
10. **Nenhum erro no console** nas 3 páginas.

Imagens:

- `provas/folha-contato.png`: os 11 móveis nas duas vistas e a vista Lado dos 6 tipos que a têm, mais a cerca curva e o tapete redondo, no zoom de 200%.
- `provas/folha-materiais.png`: cada material de cada móvel, vista de cima.
- `provas/desktop-1440.png` e `provas/celular-390.png`: a página.

Não conferido: celular de verdade, o app de verdade (com névoa, pinos e paredes por cima) e outra máquina mais fraca.

## Perguntas para o usuário

1. **Qual vista vai para o app**: de cima com volume, 3/4 ou as duas, à escolha do mestre?
2. **Os materiais estão certos?** Falta algum (por exemplo, couro ou pedra na mesa)? Sobra algum?
3. **Cor**: algum material ficou escuro demais, claro demais ou chamativo no seu chão? O ocre e a cerejeira são os mais vivos.
4. **Móveis que já existem nos mapas**: eles guardam cor livre. Proposta: trocar cada cor salva pelo material mais perto dela (a cama tem três cores, e cada uma vira uma escolha: madeira, cobertor e travesseiro). Ou prefere manter "Outra cor…" como última amostra?
5. **"Preencher" e "Cor da linha"** do painel de hoje não têm vez com textura. Somem?
6. **Girar o móvel**: aqui nada gira. No app, girar exige gerar a imagem de novo para cada ângulo, para a luz continuar vindo de cima à esquerda. A conta é barata (10 a 30 ms por móvel, pelas provas acima), mas precisa ser decidida.
7. **3/4 e o que fica atrás**: no 3/4, um móvel alto cobre um pouco da casa de trás (parede, pino). O app desenha o pino por cima ou por baixo?
8. **Vista Lado**: no protótipo, o armário e o aparador encostados na parede de cima ficam presos pela beira de cima ao trocar de vista. No app hoje o centro fica parado. Qual dos dois?
