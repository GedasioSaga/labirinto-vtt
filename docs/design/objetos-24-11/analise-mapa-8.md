# Mapa de referência 8: cripta com luz ciano

Análise de 24/11/2026. Fonte: imagem 18 da conversa (mapa da Terkographer, 812 x 1344), olhada inteira e em 5 recortes ampliados.
Conferido contra o código em `client/src/lib/mobilia/tipos.ts`, `pecasNovas.ts`, `texturas/embutidas.ts`, `texturas/meioTermo/materiais.ts`,
`lib/luzDoFogo.ts`, `carimbos/novos/` e `texturas/paredes/catalogo.ts`. O `CATALOGO.md` desta pasta ainda não existe; a comparação foi feita direto no código.

Legenda: **novo** = o app não tem; **versão** = o app tem o objeto, mas falta esta forma (a base vem entre parênteses); **existe** = já dá para pôr.
Complexidade: **complexo** = forma orgânica, muitas partes, luz/brilho, água ou construção grande; **simples** = peça de forma direta.

## O que tem no mapa, por região

- **Sala noroeste:** sarcófago claro no meio, com cristais ciano nascendo em volta da base; na frente, uma arca baixa azul que brilha (relicário). Seis colunas redondas com base quadrada junto às paredes. Piso de lajes em losango cinza-arroxeado, faixa de lajes quadradas na borda, fundo de lajeado escuro e escada larga descendo para o sul.
- **Salão norte:** sarcófago aceso no meio do piso em losango, seis colunas em duas fileiras.
- **Corredor curvo (nordeste):** nichos funerários na parede, um em cada recuo, alguns acesos de ciano.
- **Capela oeste:** quatro lajes tumulares baixas com cristalzinho ciano no canto, seis colunas e uma abside em meia-lua com uma estátua pequena.
- **Grande salão central:** lajeado poligonal escuro, quatro arcos no norte com um jazigo dentro de cada (arcossólios, acesos), pilastras quadradas ao longo das paredes, quatro colunas redondas lisas e grossas (sem capitel), mureta baixa separando a ponta leste de lajes quadradas.
- **Cruzamento:** selo de cristal em losango no chão, ciano, com o ponto de luz no meio; corredor de lajes que brilham; degraus largos para leste e oeste; faixas de pedra cor de vinho nas bordas.
- **Alas leste e oeste:** fileiras de nichos com laje fechada (gavetas), abside a leste.
- **Nave sul:** lajes quadradas, cristais ciano nos quatro cantos sobre bases curvas de pedra, estrado em meia-lua no fundo. Sala sudoeste com um bloco de pedra grande (sarcófago com tampa empurrada) e gavetas; sala sudeste com escada e três jazigos encostados na parede.
- **Paredes:** blocos de pedra clara irregulares em toda a cripta.

## OBJETOS

| # | Item | Tipo | Complexidade | Nota |
|---|---|---|---|---|
| 1 | Túmulo de pedra (sarcófago fechado) | existe (`tumuloDePedra`) | — | Já tem tampa, painel e epitáfio. |
| 2 | Sarcófago aceso com cristais | versão (`tumuloDePedra`) | complexo | O mesmo jazigo com um ninho de cristais ciano nascendo da base e luz fria em volta (entrada em `LUZ_DOS_OBJETOS`). |
| 3 | Sarcófago com a tampa empurrada | versão (`tumuloDePedra`) | simples | Tampa deslizada na diagonal, a fresta escura aparecendo. Bloco grande da sala sudoeste. |
| 4 | Sarcófago de bronze | versão (`tumuloDePedra`) | simples | A forma do túmulo em metal (verde de pátina), a versão de metal pedida pelo dono. |
| 5 | Caixão de ferro | versão (`caixao`) | simples | O caixão hoje é só de madeira; esta é a forma de chapa rebitada. |
| 6 | Relicário de cristal | novo | complexo | A arca azul baixa da sala noroeste: caixa de pedra com tampa de cristal que brilha. |
| 7 | Laje tumular no chão | novo | simples | Lápide deitada embutida no piso (rente, `ehMovelDoChao`), com epitáfio gasto. Capela oeste. |
| 8 | Laje tumular acesa | versão (laje tumular, item 7) | complexo | A mesma laje com o cristalzinho ciano no canto e luz curta. |
| 9 | Nicho funerário (gaveta) | novo | simples | Lóculo encostado na parede: moldura de pedra e laje fechada. Alas leste e oeste, corredor curvo. |
| 10 | Nicho funerário aberto | versão (nicho, item 9) | simples | A laje caída de lado e o crânio e os ossos aparecendo dentro. |
| 11 | Coluna redonda lisa | versão (`pilar`) | simples | Tambor grosso sem caneluras nem capitel, do grande salão. |
| 12 | Pilastra quadrada | versão (`pilar`) | simples | Bloco quadrado de pedra encostado na parede, ao longo do grande salão. |
| 13 | Pilar com base quadrada | existe (`pilar`) | — | As colunas das salas noroeste, norte e oeste. |
| 14 | Pedestal de canto com cristal | novo | complexo | Base curva de degraus em quarto de círculo, com cristais ciano em cima e luz. Cantos da nave sul. |
| 15 | Arandela de cristal | versão (`tochaDeParede`) | complexo | Suporte de parede de ferro com um cristal ciano no lugar do fogo; luz fria que não treme. |
| 16 | Estátua | existe (`estatua`) | — | A figura da abside da capela oeste. `anjoDePedra` também serve. |
| 17 | Mureta de pedra | existe (`muroBaixoDePedra`) | — | Divisória baixa da ponta leste do grande salão. |
| 18 | Altar de cristal | versão (`altar`) | complexo | Altar de pedra com um cristal ciano grande em cima. Não aparece no mapa; combina com o tema. |
| 19 | Braseiro de chama azul | versão (`braseiro`) | complexo | Mesma bacia, fogo frio ciano (luz própria). Tema. |
| 20 | Candelabro de chama fria | versão (`candelabroDeChao`) | complexo | Velas com chama ciano. Tema. |
| 21 | Urna funerária | novo | simples | Vaso de pedra com tampa, para cinzas, em cima de nicho ou pedestal. Tema. |
| 22 | Ossário (pilha de crânios) | novo | complexo | Crânios empilhados contra a parede, muitas partes. Tema. Hoje há `cranio` e `ossos` soltos. |
| 23 | Banco de pedra | versão (`bancoDePraca`) | simples | Banco maciço de laje sobre dois blocos. Tema (sala sudeste). |
| 24 | Crânio, ossos e teia de aranha | existe (`cranio`, `ossos`, `teiaDeAranha`) | — | Enfeites de tema que o app já tem. |

## CONSTRUÇÕES

| # | Item | Tipo | Complexidade | Nota |
|---|---|---|---|---|
| 1 | Arcossólio | novo | complexo | Arco de pedra na parede com um jazigo dentro e o brilho ciano na boca. Os quatro do norte do grande salão. |
| 2 | Parede de gavetas (columbário) | novo | simples | Fileira de 3 a 6 nichos funerários numa peça só, que barra. Alas leste e oeste. |
| 3 | Estrado em meia-lua | novo | simples | Degraus semicirculares de pedra clara no fundo da nave sul. |
| 4 | Abside com nicho de estátua | novo | complexo | Meia-lua de parede com o pedestal no meio (capela oeste e ala leste). Pode virar só objeto se a parede curva já resolver. |
| 5 | Mausoléu | existe (`mausoleu`) | — | Não aparece (o mapa é o lado de dentro), mas é a entrada natural de uma cripta. |

## TEXTURAS

| # | Item | Tipo | Complexidade | Nota |
|---|---|---|---|---|
| 1 | Lajotas de pedra | existe (`lajotas`, `lajotas-escuras`) | — | As lajes quadradas cinza-azuladas da nave sul e da capela. |
| 2 | Losangos de pedra | versão (`losangos`) | simples | O xadrez girado em pedra cinza-arroxeada, sem o filete de cerâmica. Salas noroeste e norte. |
| 3 | Lajeado poligonal escuro | novo | simples | Pedras chatas irregulares de muitos lados, cinza-azul escuro, juntas finas. O chão do grande salão e das alas. Nenhum dos 9 pisos de pedra é assim (o `paralelepipedo` é retangular, a `rocha-de-caverna` não tem junta). |
| 4 | Lajes que brilham | novo | complexo | Lajes de pedra com luz ciano saindo das juntas. O corredor do cruzamento. |
| 5 | Mármore vinho | versão (`marmore-negro`) | simples | Placas cor de ameixa com veio claro, as faixas das bordas do cruzamento e da nave sul. |
| 6 | Parede de pedra clara | existe (`castelo`, `pedra-rustica`) | — | Os blocos irregulares da cripta inteira. |
| 7 | Degrau de pedra talhada | versão (material de escada `pedra`) | simples | Degraus lisos de laje cinza; a pedra da escada hoje é só cascalho ou pedregulhos. |

## CARIMBOS

| # | Item | Tipo | Complexidade | Nota |
|---|---|---|---|---|
| 1 | Cristais ciano | versão (`cristais`, `cristais-verdes`) | complexo | O ninho de prismas em ciano frio, com luz em `LUZ_DOS_CARIMBOS` (o violeta e o verde já existem). É o enfeite que mais se repete no mapa. |
| 2 | Lascas de cristal | novo | simples | Dois ou três cristaizinhos soltos no chão, sem luz, para espalhar perto dos jazigos. |
| 3 | Névoa fria | novo | complexo | Mancha de névoa ciano rente ao chão, translúcida (o claro azulado em volta dos sarcófagos). |
| 4 | Rachadura no chão | novo | simples | Trinca fina e ramificada que o mestre põe em qualquer piso. O app ainda não tem nenhuma. |
| 5 | Estalagmite | existe (`estalagmite`) | — | Tema (cripta escavada na rocha). |
| 6 | Pedras e seixos | existe (`pedras`, `seixos`) | — | Entulho miúdo dos cantos. |
| 7 | Musgo | existe (`musgo`) | — | Tema. |

## Por onde eu começaria

O que mais aparece no mapa e o app não tem: os **cristais ciano** (carimbo), o **nicho funerário** e a **parede de gavetas**, o **sarcófago aceso** e o **lajeado poligonal escuro**. Com esses cinco, mais o que já existe (túmulo, pilar, lajotas, parede de castelo, estátua), dá para montar a cripta quase inteira.
