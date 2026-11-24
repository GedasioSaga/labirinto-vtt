# Lista de 24/11/2026: objetos, construções, texturas e carimbos dos 8 mapas

Feita pelo Claude (diretor de arte) a partir das 8 análises em `docs/design/objetos-24-11/analise-mapa-*.md`. O que cada mapa pediu, e para onde cada pedido foi, está em `ANALISE.md`, nesta mesma pasta.

O dono mandou escolher sempre o recomendado, sem perguntar. Toda escolha aqui é **decisão do Claude**.

## Como a lista foi montada

1. Juntei os 8 mapas e tirei os repetidos. Por exemplo, a cadeira de ferro aparece em 4 mapas e a rachadura no chão em 6; cada uma virou um item só.
2. Descartei o que o app já tem igual. Fiquei só com os itens **novos** e as **versões novas**.
3. A tarefa limita a lista a 12 lotes de até 10 itens, ou seja, 120 itens. Os mapas pediram mais que isso. Passou na frente o que:
   - aparece em mais de um mapa;
   - aparece desenhado no mapa, e não só como "combina com o tema";
   - tapa um buraco do app (rachadura, sangue espalhado, móveis de ferro, cripta).

   O resto ficou na **Fila da próxima leva**, no fim deste arquivo. Não foi descartado.
4. Sistema novo inteiro não entrou. Exemplos: parede que deixa a visão passar, peça pré-montada de várias partes, água com desnível, fumaça animada. Esses estão em **Propostas para depois**.
5. Cada lote tem um tema e é todo simples ou todo complexo. Dois lotes nunca escrevem no mesmo arquivo. Todos os arquivos listados abaixo são **novos**: conferi em 24/11 que nenhum deles existe e que nenhum id está em uso.

## Regras de arte (valem para todos os desenhistas)

- Antes de desenhar, carregue a skill `emil-design-eng` e depois `frontend-design`.
- Siga o estilo Meio-Termo de `docs/design/ESTILO-DO-RPG.md`:
  - contorno no tom escuro da própria cor, nunca preto puro;
  - cores contidas, pastel e nunca neon, sem listra gritante;
  - volume com luz de cima e à esquerda, como nos móveis vizinhos;
  - sombra pousada no chão;
  - grão leve na madeira, na pedra e no metal;
  - desenho determinístico: a mesma entrada dá a mesma imagem.
- **Desenho próprio, por código.** Os mapas são de criadores comerciais. Use só o *tipo* de objeto como inspiração: não copie forma, sprite nem paleta deles.
- **Leitura na grade.** A 100% de zoom, numa casa, o objeto tem que ser reconhecido de relance. Se o detalhe miúdo atrapalha a silhueta, tire o detalhe.
- Sangue e corpo: vinho velho e apagado, nunca vermelho vivo. Corpo sempre embrulhado, sem rosto e sem ferida.
- Luz (fogo, cristal, globo): o brilho do desenho é fraco. Quem ilumina é a entrada em `LUZ_DOS_OBJETOS` ou em `LUZ_DOS_CARIMBOS`, que o integrador registra. Avise no relatório a cor e o raio que você sugere.
- Cada objeto e construção leva a sua folha para aprovação em `docs/design/objetos/<id-em-kebab>.png`, com as vistas que o tipo tem.
- **O desenhista só cria os arquivos da coluna "Arquivos novos".** Os arquivos de registro (`tipos.ts`, `pecasNovas.ts`, `gruposDoObjeto.ts`, `construcoes.ts`, `materiais.ts`, `moveis/index.ts`, `tresQuartos.ts`, `icons.tsx`, `luzDoFogo.ts`, `embutidas.ts`, `carimbos/novos/index.ts` e `paredes/catalogo.ts`) são só do integrador.
- Versão de um objeto que já existe é **um tipo novo, com arquivo próprio**. O arquivo base não muda, porque outro lote ou o mapa salvo pode depender dele. Pode importar ajudante do motor (`moveis/motor.ts`, `moveis/contexto.ts`, `moveis/formas.ts`). Não importe arquivo de outro lote desta lista, porque os lotes correm ao mesmo tempo.

## Como ler a tabela

- **Tipo**: *novo* (não há nada parecido no app) ou *versão* (variante nova de um tipo que já existe; a coluna **Base** diz qual).
- **Mapas**: os números dos mapas de referência que pediram o item.
- Os caminhos são relativos a `C:/dev/labirinto/`. A coluna "Arquivos novos" usa abreviações:
  - `M/` = `client/src/texturas/meioTermo/moveis/`
  - `F/` = `docs/design/objetos/` (a folha de aprovação)
  - `K/` = `client/src/carimbos/novos/`
  - `C/` = `client/src/texturas/chaos/`
  - `P/` = `client/src/texturas/paredes/imagens/`
  - `L/` = `client/src/lib/mobilia/` (só para o módulo de forma de um tipo novo que tem mais de uma forma)

---

## L01 Prisão: ferro e cela (simples)

| Nº | Nome visível | Id | Categoria | Tipo | Base | Mapas | Arquivos novos |
|---|---|---|---|---|---|---|---|
| 1 | Cadeira de ferro | `cadeiraDeFerro` | objeto | versão | cadeira | 1, 2, 4, 7 | `M/cadeiraDeFerro.ts`, `F/cadeira-de-ferro.png` |
| 2 | Mesa de ferro | `mesaDeFerro` | objeto | versão | mesa | 1, 2, 4, 7 | `M/mesaDeFerro.ts`, `F/mesa-de-ferro.png` |
| 3 | Catre de ferro | `catreDeFerro` | objeto | versão | catre | 1, 2, 4, 5, 7 | `M/catreDeFerro.ts`, `F/catre-de-ferro.png` |
| 4 | Esteira de palha | `esteiraDePalha` | objeto | novo | | 1, 2, 3, 4 | `M/esteiraDePalha.ts`, `F/esteira-de-palha.png` |
| 5 | Balde de dejetos | `baldeDeDejetos` | objeto | versão | balde | 1, 2, 3, 7 | `M/baldeDeDejetos.ts`, `F/balde-de-dejetos.png` |
| 6 | Grilhões de parede | `grilhoesDeParede` | objeto | versão | corrente | 1, 2, 4, 7 | `M/grilhoesDeParede.ts`, `F/grilhoes-de-parede.png` |
| 7 | Bola de ferro com corrente | `bolaDeFerroComCorrente` | objeto | novo | | 2 | `M/bolaDeFerroComCorrente.ts`, `F/bola-de-ferro-com-corrente.png` |
| 8 | Latrina de cela | `latrinaDeCela` | objeto | novo | | 2 | `M/latrinaDeCela.ts`, `F/latrina-de-cela.png` |
| 9 | Banco de pedra | `bancoDePedra` | objeto | novo | | 2, 8 | `M/bancoDePedra.ts`, `F/banco-de-pedra.png` |
| 10 | Palha espalhada | `palhaEspalhada` | carimbo | novo | | 1 | `K/palhaEspalhada.ts` |

1. Cadeira de ferro: barra e chapa rebitadas, espaldar reto, ferrugem só nas quinas. É a "versão de metal" que o dono deu como exemplo.
2. Mesa de ferro: tampo de chapa com rebites e pés de cantoneira. Serve ao guarda, ao refeitório e à mesa chumbada da arena (mapa 7).
3. Catre de ferro: estrado de barras preso à parede por duas correntes, colchão fino de lona e cobertor cinza dobrado. Serve à cela medieval e à moderna.
4. Esteira de palha: monte achatado de palha com fios soltos, rente ao chão (`ehMovelDoChao`). Junta "monte de palha", "catre de palha", "enxergão" e "colchão de palha".
5. Balde de dejetos: madeira escura, aro de ferro, tampa torta, conteúdo escuro e discreto. Faz também o papel do penico do cortiço (mapa 3).
6. Grilhões de parede: duas argolas chumbadas, corrente curta e algemas abertas. Junta a "argola de parede com corrente" do mapa 7.
7. Bola de ferro com corrente: bola fosca, elo grosso e tornozeleira aberta.
8. Latrina de cela: buraco de pedra com borda gasta, rente ao chão.
9. Banco de pedra: laje maciça sobre dois blocos. Serve à cela (mapa 2) e à cripta (mapa 8).
10. Palha espalhada: fios e tufos soltos, cor de feno apagado. A semente varia o desenho.

## L02 Masmorra: carcereiro e tortura (simples)

| Nº | Nome visível | Id | Categoria | Tipo | Base | Mapas | Arquivos novos |
|---|---|---|---|---|---|---|---|
| 11 | Mesa do carcereiro | `mesaDoCarcereiro` | objeto | versão | escrivaninha | 1 | `M/mesaDoCarcereiro.ts`, `F/mesa-do-carcereiro.png` |
| 12 | Quadro de chaves | `quadroDeChaves` | objeto | novo | | 1, 2, 4 | `M/quadroDeChaves.ts`, `F/quadro-de-chaves.png` |
| 13 | Jaula de chão | `jaulaDeChao` | objeto | versão | gaiolaSuspensa | 1, 2, 4 | `M/jaulaDeChao.ts`, `F/jaula-de-chao.png` |
| 14 | Ralo de masmorra | `raloDeMasmorra` | objeto | versão | bueiro | 2, 4 | `M/raloDeMasmorra.ts`, `F/ralo-de-masmorra.png` |
| 15 | Baú de ferro | `bauDeFerro` | objeto | versão | bau | 2 | `M/bauDeFerro.ts`, `F/bau-de-ferro.png` |
| 16 | Tábua de pregos | `tabuaDePregos` | objeto | novo | | 1 | `M/tabuaDePregos.ts`, `F/tabua-de-pregos.png` |
| 17 | Cepo do carrasco | `cepoDoCarrasco` | objeto | versão | tocoComMachado | 1 | `M/cepoDoCarrasco.ts`, `F/cepo-do-carrasco.png` |
| 18 | Poste de açoite | `posteDeAcoite` | objeto | novo | | 2 | `M/posteDeAcoite.ts`, `F/poste-de-acoite.png` |
| 19 | Grade de corredor | `gradeDeCorredor` | objeto | versão | portaoComGradeLevadica | 7 | `M/gradeDeCorredor.ts`, `F/grade-de-corredor.png` |
| 20 | Sangue espalhado | `respingosDeSangue` | carimbo | versão | sangueNoChao | 1, 2, 4, 7 | `K/respingosDeSangue.ts` |

11. Mesa do carcereiro: mesa rústica de madeira e ferro com livro de registro aberto, tinteiro e molho de chaves.
12. Quadro de chaves: tábua de parede com ganchos e argolas de chaves grandes de ferro. Junta o "molho de chaves no gancho" (mapa 1) e o "painel de chaves" (mapa 4).
13. Jaula de chão: jaula baixa de barras do tamanho de uma pessoa agachada, pousada no chão. Várias lado a lado fazem as "gaiolas empilhadas" do mapa 2.
14. Ralo de masmorra: grade quadrada de ferro, rente ao chão. O bueiro de hoje é redondo e de rua.
15. Baú de ferro: inteiro de chapa, com rebites, cadeado e cintas.
16. Tábua de pregos: prancha comprida cheia de pregos, com argolas para os pulsos e os tornozelos.
17. Cepo do carrasco: cepo escuro com o entalhe do pescoço, o machado encostado e uma mancha vinho velha.
18. Poste de açoite: tronco fincado com argola no alto e corda pendurada.
19. Grade de corredor: só a fileira de barras atravessando o vão, sem a torre do portão. Barra a passagem e não tapa a visão.
20. Sangue espalhado: respingos, gotas, rastro arrastado e poça. A semente escolhe o desenho. Junta "respingos" (mapa 1), "rastro de sangue" (mapas 2 e 4) e "poça de sangue" (mapa 7).

## L03 Tortura e fogo (complexo)

| Nº | Nome visível | Id | Categoria | Tipo | Base | Mapas | Arquivos novos |
|---|---|---|---|---|---|---|---|
| 21 | Corpo amortalhado | `corpoAmortalhado` | objeto | novo | | 1, 2, 3, 4 | `M/corpoAmortalhado.ts`, `F/corpo-amortalhado.png` |
| 22 | Prancha de tortura | `pranchaDeTortura` | objeto | novo | | 2 | `M/pranchaDeTortura.ts`, `F/prancha-de-tortura.png` |
| 23 | Braseiro com ferros de marcar | `braseiroComFerros` | objeto | versão | braseiro | 1, 2 | `M/braseiroComFerros.ts`, `F/braseiro-com-ferros.png` |
| 24 | Fosso de brasas | `fossoDeBrasas` | construção | novo | | 1, 2 | `M/fossoDeBrasas.ts`, `F/fosso-de-brasas.png` |
| 25 | Roda de tortura | `rodaDeTortura` | objeto | novo | | 1, 2 | `M/rodaDeTortura.ts`, `F/roda-de-tortura.png` |
| 26 | Guilhotina | `guilhotina` | objeto | novo | | 1, 2 | `M/guilhotina.ts`, `F/guilhotina.png` |
| 27 | Pertences confiscados | `pertencesConfiscados` | objeto | novo | | 1 | `M/pertencesConfiscados.ts`, `F/pertences-confiscados.png` |
| 28 | Guincho de corrente | `guinchoDeCorrente` | objeto | novo | | 2 | `M/guinchoDeCorrente.ts`, `F/guincho-de-corrente.png` |
| 29 | Brasas espalhadas | `brasasEspalhadas` | carimbo | versão | fendaEmBrasa | 1 | `K/brasasEspalhadas.ts` |
| 30 | Ratos | `ratos` | carimbo | novo | | 1, 3 | `K/ratos.ts` |

21. Corpo amortalhado: vulto comprido enrolado em pano cru com listras apagadas e amarrado com cordas, sem rosto. Junta o "corpo enrolado" (mapa 1), a "mortalha" (mapa 2), o "corpo sob lençol" (mapa 3) e o "fardo embrulhado" (mapa 4).
22. Prancha de tortura: tábua em pé com argolas e cordas soltas, sem corpo. O mestre põe o token em cima.
23. Braseiro com ferros de marcar: bacia de ferro com brasa acesa e três ferros enfiados. Leva luz laranja.
24. Fosso de brasas: cova de 2x2 casas com borda de pedra, brasa viva e grade por cima. Barra a passagem, não tapa a visão e ilumina. Junta o "fosso de brasa com grade" e a "fornalha de incineração" do mapa 2.
25. Roda de tortura: roda grande de madeira num eixo, com cravos e tiras de couro.
26. Guilhotina: duas colunas, lâmina inclinada, cepo de meia-lua e cesto embaixo.
27. Pertences confiscados: monte de roupas dobradas, trouxas, botas e espada embainhada. Tem muitas partes: a silhueta do monte vem antes do detalhe.
28. Guincho de corrente: roda dentada de parede com correntes abertas em leque.
29. Brasas espalhadas: carvão e brasas soltas com brilho fraco. Vai em volta do fosso e dos braseiros e leva luz curta em `LUZ_DOS_CARIMBOS`.
30. Ratos: dois ou três ratos pequenos em poses que variam pela semente. Forma orgânica e cor de rato real, sem cartoon.

## L04 Fortaleza do ritual (complexo)

| Nº | Nome visível | Id | Categoria | Tipo | Base | Mapas | Arquivos novos |
|---|---|---|---|---|---|---|---|
| 31 | Fosso do salão | `fossoDoSalao` | construção | novo | | 1, 2 | `M/fossoDoSalao.ts`, `F/fosso-do-salao.png` |
| 32 | Pilar com braseiro | `pilarComBraseiro` | objeto | versão | pilar | 1 | `M/pilarComBraseiro.ts`, `F/pilar-com-braseiro.png` |
| 33 | Lanterna gradeada de parede | `lanternaGradeada` | objeto | versão | tochaDeParede | 2 | `M/lanternaGradeada.ts`, `F/lanterna-gradeada.png` |
| 34 | Globo de luz rubra | `globoDeLuzRubra` | objeto | novo | | 4 | `M/globoDeLuzRubra.ts`, `F/globo-de-luz-rubra.png` |
| 35 | Selo de órbitas | `seloDeOrbitas` | objeto | versão | circuloMagico | 4 | `M/seloDeOrbitas.ts`, `F/selo-de-orbitas.png` |
| 36 | Plataforma de ritual | `plataformaDeRitual` | construção | novo | | 4 | `M/plataformaDeRitual.ts`, `F/plataforma-de-ritual.png` |
| 37 | Gárgula | `gargula` | construção | novo | | 4 | `M/gargula.ts`, `F/gargula.png` |
| 38 | Estátua de besta | `estatuaDeBesta` | construção | novo | | 4 | `M/estatuaDeBesta.ts`, `F/estatua-de-besta.png` |
| 39 | Estátua encapuzada | `estatuaEncapuzada` | construção | versão | estatua | 4 | `M/estatuaEncapuzada.ts`, `F/estatua-encapuzada.png` |
| 40 | Ponte de corrente | `ponteDeCorrente` | construção | versão | ponte | 4 | `M/ponteDeCorrente.ts`, `F/ponte-de-corrente.png` |

31. Fosso do salão: piso rebaixado redondo de cerca de 6x6 casas, com anéis de degraus, grade em anel, círculo de letras gravadas e gema rubra no centro com brilho fraco. É chão: rente, não barra e não tapa. Junta o "fosso gradeado com inscrições" (mapa 1) e o "fosso escalonado" (mapa 2).
32. Pilar com braseiro: pilar quadrado de pedra com bacia de fogo no topo. Ilumina.
33. Lanterna gradeada: arandela de ferro com vidro e luz amarela, o ponto de luz que se repete no mapa 2.
34. Globo de luz rubra: anel de ferro no chão com globo vermelho aceso e pino. Leva luz vermelha.
35. Selo de órbitas: selo rente ao chão com elipses cruzadas, como órbitas, um yin-yang no centro e brilho azul fraco.
36. Plataforma de ritual: disco de pedra com borda de pilaretes, anel mágico verde e argolas para as correntes. Pisa-se nela, então não barra.
37. Gárgula: gárgula de pedra agachada, de asas fechadas, vista de cima. Vai no grupo Monumentos e colunas.
38. Estátua de besta: criatura grande de pedra, com chifres e asas, encostada na parede.
39. Estátua encapuzada: vulto de pedra de capuz e túnica, de mãos juntas.
40. Ponte de corrente: ponte suspensa de tábuas presas em correntes de ferro, para atravessar o abismo.

## L05 Cripta: pedra e jazigos (simples)

| Nº | Nome visível | Id | Categoria | Tipo | Base | Mapas | Arquivos novos |
|---|---|---|---|---|---|---|---|
| 41 | Sarcófago entreaberto | `sarcofagoEntreaberto` | objeto | versão | tumuloDePedra | 8 | `M/sarcofagoEntreaberto.ts`, `F/sarcofago-entreaberto.png` |
| 42 | Sarcófago de bronze | `sarcofagoDeBronze` | objeto | versão | tumuloDePedra | 8 | `M/sarcofagoDeBronze.ts`, `F/sarcofago-de-bronze.png` |
| 43 | Caixão de ferro | `caixaoDeFerro` | objeto | versão | caixao | 8 | `M/caixaoDeFerro.ts`, `F/caixao-de-ferro.png` |
| 44 | Laje tumular | `lajeTumular` | objeto | novo | | 8 | `M/lajeTumular.ts`, `F/laje-tumular.png` |
| 45 | Nicho funerário | `nichoFunerario` | objeto | novo | | 8 | `M/nichoFunerario.ts`, `L/nichoFunerario.ts`, `F/nicho-funerario.png` |
| 46 | Coluna lisa | `colunaLisa` | objeto | versão | pilar | 8 | `M/colunaLisa.ts`, `F/coluna-lisa.png` |
| 47 | Pilastra quadrada | `pilastraQuadrada` | objeto | versão | pilar | 8 | `M/pilastraQuadrada.ts`, `F/pilastra-quadrada.png` |
| 48 | Urna funerária | `urnaFuneraria` | objeto | novo | | 8 | `M/urnaFuneraria.ts`, `F/urna-funeraria.png` |
| 49 | Columbário | `columbario` | construção | novo | | 8 | `M/columbario.ts`, `F/columbario.png` |
| 50 | Estrado em meia-lua | `estradoEmMeiaLua` | construção | novo | | 8 | `M/estradoEmMeiaLua.ts`, `F/estrado-em-meia-lua.png` |

41. Sarcófago entreaberto: tampa deslizada na diagonal, com a fresta escura aparecendo.
42. Sarcófago de bronze: a forma do túmulo em metal, com pátina verde contida. É a "versão de metal" pedida pelo dono.
43. Caixão de ferro: chapa rebitada com cinta, mais escuro que o caixão de madeira.
44. Laje tumular: lápide deitada embutida no piso, rente (`ehMovelDoChao`), com epitáfio gasto e ilegível.
45. Nicho funerário: lóculo de parede com moldura de pedra e laje fechada. Tem duas formas:
    - **fechado**, o padrão;
    - **aberto**, com a laje caída de lado e crânio e ossos à vista.

    O desenhista entrega o desenho das duas. O módulo `L/nichoFunerario.ts` grava a forma em `Prop.mobiliaForma`, como o `cova.ts`.
46. Coluna lisa: tambor grosso de pedra, sem caneluras nem capitel.
47. Pilastra quadrada: bloco quadrado de pedra encostado na parede.
48. Urna funerária: vaso de pedra para cinzas, com tampa, pequeno o bastante para ir em cima de um nicho.
49. Columbário: parede de 4 gavetas funerárias numa peça só. Barra a passagem e tapa a visão.
50. Estrado em meia-lua: degraus semicirculares de pedra clara, para o fundo de nave ou de capela. Não barra.

## L06 Cripta: cristal e chama fria (complexo)

| Nº | Nome visível | Id | Categoria | Tipo | Base | Mapas | Arquivos novos |
|---|---|---|---|---|---|---|---|
| 51 | Sarcófago de cristais | `sarcofagoDeCristais` | objeto | versão | tumuloDePedra | 8 | `M/sarcofagoDeCristais.ts`, `F/sarcofago-de-cristais.png` |
| 52 | Relicário de cristal | `relicarioDeCristal` | objeto | novo | | 8 | `M/relicarioDeCristal.ts`, `F/relicario-de-cristal.png` |
| 53 | Laje tumular acesa | `lajeTumularAcesa` | objeto | versão | lajeTumular (item 44) | 8 | `M/lajeTumularAcesa.ts`, `F/laje-tumular-acesa.png` |
| 54 | Pedestal com cristal | `pedestalComCristal` | objeto | novo | | 8 | `M/pedestalComCristal.ts`, `F/pedestal-com-cristal.png` |
| 55 | Arandela de cristal | `arandelaDeCristal` | objeto | versão | tochaDeParede | 8 | `M/arandelaDeCristal.ts`, `F/arandela-de-cristal.png` |
| 56 | Braseiro de chama fria | `braseiroDeChamaFria` | objeto | versão | braseiro | 4, 8 | `M/braseiroDeChamaFria.ts`, `F/braseiro-de-chama-fria.png` |
| 57 | Ossário | `ossario` | objeto | novo | | 8 | `M/ossario.ts`, `F/ossario.png` |
| 58 | Arcossólio | `arcossolio` | construção | novo | | 8 | `M/arcossolio.ts`, `F/arcossolio.png` |
| 59 | Cristais ciano | `cristaisCiano` | carimbo | versão | cristais | 8 | `K/cristaisCiano.ts` |
| 60 | Selo de cristal | `seloDeCristal` | objeto | novo | | 8 | `M/seloDeCristal.ts`, `F/selo-de-cristal.png` |

O ciano frio é a cor deste lote. Use a mesma paleta nos 10 itens, para que a cripta leia como um conjunto.

51. Sarcófago de cristais: o jazigo com um ninho de cristais ciano nascendo da base e luz fria em volta.
52. Relicário de cristal: arca baixa de pedra com tampa de cristal que brilha por dentro.
53. Laje tumular acesa: laje deitada no piso com um cristalzinho ciano no canto e luz curta. O desenho é próprio, sem importar o item 44, que corre noutro lote. O desenhista combina as duas pela paleta.
54. Pedestal com cristal: base curva de degraus em quarto de círculo, com cristais em cima. Vai no canto da sala e leva luz.
55. Arandela de cristal: suporte de parede de ferro com um cristal no lugar do fogo. A luz é fria e não treme.
56. Braseiro de chama fria: a bacia de ferro com fogo ciano e luz própria. A versão vermelha do mapa 4 ficou na fila.
57. Ossário: crânios empilhados contra a parede. Tem muitas partes, então a pilha tem que ler como massa e não como 30 círculos.
58. Arcossólio: arco de pedra na parede com um jazigo dentro e brilho ciano na boca. Barra a passagem.
59. Cristais ciano: ninho de prismas ciano. A semente também faz a versão pequena de duas ou três lascas soltas, que junta as "lascas de cristal" do mapa 8. Leva luz fria em `LUZ_DOS_CARIMBOS`.
60. Selo de cristal: losango de cristal embutido no chão, com um ponto de luz no meio. É objeto rente (como o `circuloMagico`), para poder ter luz.

## L07 Selva: ruína e água (simples)

| Nº | Nome visível | Id | Categoria | Tipo | Base | Mapas | Arquivos novos |
|---|---|---|---|---|---|---|---|
| 61 | Ponte de pedra quebrada | `ponteDePedraQuebrada` | construção | versão | ponte | 6 | `M/ponteDePedraQuebrada.ts`, `F/ponte-de-pedra-quebrada.png` |
| 62 | Ponte de tábuas quebrada | `ponteDeTabuasQuebrada` | construção | versão | ponte | 6 | `M/ponteDeTabuasQuebrada.ts`, `F/ponte-de-tabuas-quebrada.png` |
| 63 | Calçada sobre a água | `calcadaSobreAgua` | construção | versão | pier | 6 | `M/calcadaSobreAgua.ts`, `F/calcada-sobre-agua.png` |
| 64 | Muro em ruína | `muroEmRuina` | objeto | versão | muroBaixoDePedra | 6 | `M/muroEmRuina.ts`, `F/muro-em-ruina.png` |
| 65 | Pedestal entalhado | `pedestalEntalhado` | objeto | versão | altarRedondo | 6 | `M/pedestalEntalhado.ts`, `F/pedestal-entalhado.png` |
| 66 | Coluna com glifos | `colunaComGlifos` | objeto | versão | colunaQuebrada | 6 | `M/colunaComGlifos.ts`, `F/coluna-com-glifos.png` |
| 67 | Estela entalhada | `estelaMaia` | objeto | novo | | 6 | `M/estelaMaia.ts`, `F/estela-maia.png` |
| 68 | Cabana de lajes | `cabanaDeLajes` | construção | novo | | 6 | `M/cabanaDeLajes.ts`, `F/cabana-de-lajes.png` |
| 69 | Tanque com borda de pedra | `tanqueComBorda` | construção | novo | | 6 | `M/tanqueComBorda.ts`, `F/tanque-com-borda.png` |
| 70 | Blocos de cantaria | `blocosDeCantaria` | carimbo | versão | pedras | 6 | `K/blocosDeCantaria.ts` |

Paleta do lote: arenito bege, musgo verde-escuro contido e água turquesa apagada.

61. Ponte de pedra quebrada: laje de pedra com mureta e um buraco no meio. A ponte é uma peça só e não sabe barrar só o buraco, então **não barra**: o mestre decide quem passa.
62. Ponte de tábuas quebrada: tábuas faltando e cordas soltas.
63. Calçada sobre a água: píer de laje de arenito, o caminho entre os tanques.
64. Muro em ruína: trecho baixo em L, com falhas e blocos caídos. Vários trechos juntos fazem o "alicerce de casa em ruína".
65. Pedestal entalhado: disco baixo de pedra com entalhe geométrico.
66. Coluna com glifos: coluna entalhada com glifos e musgo, quebrada no alto.
67. Estela entalhada: laje de pé com glifos, baixa e chata.
68. Cabana de lajes: santuário pequeno com telhado de lajes de pedra verde-escuras. Barra a passagem e tapa a visão.
69. Tanque com borda de pedra: espelho d'água retangular desenhado dentro de uma moldura de lajes. É chão: rente, não barra.
70. Blocos de cantaria: blocos quadrados cortados, caídos e meio afundados. A semente varia o desenho.

## L08 Selva: templo e mata (complexo)

| Nº | Nome visível | Id | Categoria | Tipo | Base | Mapas | Arquivos novos |
|---|---|---|---|---|---|---|---|
| 71 | Pirâmide em degraus | `piramideEmDegraus` | construção | novo | | 6 | `M/piramideEmDegraus.ts`, `L/piramideEmDegraus.ts`, `F/piramide-em-degraus.png` |
| 72 | Topo do templo | `topoDoTemplo` | construção | novo | | 6 | `M/topoDoTemplo.ts`, `F/topo-do-templo.png` |
| 73 | Cabeça colossal | `cabecaColossal` | objeto | novo | | 6 | `M/cabecaColossal.ts`, `F/cabeca-colossal.png` |
| 74 | Ídolo dourado | `idoloDourado` | objeto | novo | | 6 | `M/idoloDourado.ts`, `F/idolo-dourado.png` |
| 75 | Cascata em degraus | `cascataEmDegraus` | construção | novo | | 2, 6 | `M/cascataEmDegraus.ts`, `F/cascata-em-degraus.png` |
| 76 | Ponte sobre pilares | `ponteSobrePilares` | construção | versão | ponte | 6 | `M/ponteSobrePilares.ts`, `F/ponte-sobre-pilares.png` |
| 77 | Palmeira de selva | `palmeiraDeSelva` | carimbo | versão | palmeira | 6 | `K/palmeiraDeSelva.ts` |
| 78 | Moita tropical | `moitaTropical` | carimbo | novo | | 6 | `K/moitaTropical.ts` |
| 79 | Cipós pendurados | `ciposPendurados` | carimbo | novo | | 6 | `K/ciposPendurados.ts` |
| 80 | Espuma d'água | `espumaDagua` | carimbo | novo | | 2, 6 | `K/espumaDagua.ts` |

71. Pirâmide em degraus: 4 degraus concêntricos de pedra com escadaria central. É a peça principal do mapa 6. Tem duas formas:
    - **seca**, o padrão;
    - **alagada**, com água e folhagem entre os degraus.

    O módulo `L/piramideEmDegraus.ts` grava a forma. Barra a passagem e não tapa a visão.
72. Topo do templo: laje do alto com escadinha descendo e o vão escuro da entrada.
73. Cabeça colossal: rosto de pedra com musgo, com feições próprias e não copiadas.
74. Ídolo dourado: estatueta de ouro num pedestal, com brilho contido. É tesouro e leva luz quente fraca.
75. Cascata em degraus: queda d'água parada, vista de cima, com espuma no pé. É desenho estático, porque a animação é sistema novo (ver Propostas). Junta a "cachoeira" do mapa 2.
76. Ponte sobre pilares: ponte larga de pedra, com os pilares à vista e a água correndo entre eles.
77. Palmeira de selva: copa cheia de folhas largas serrilhadas, sem coco. A semente às vezes mostra as raízes sobre a laje, o que junta a "palmeira com raízes" do mapa 6.
78. Moita tropical: folhagem baixa de folha larga e recortada, para as bordas dos degraus.
79. Cipós pendurados: trepadeira que cai de uma borda, vista de cima.
80. Espuma d'água: mancha de espuma branco-gelo (nunca branco puro) para o pé de uma queda ou de uma pedra no rio.

## L09 Cortiço (simples)

| Nº | Nome visível | Id | Categoria | Tipo | Base | Mapas | Arquivos novos |
|---|---|---|---|---|---|---|---|
| 81 | Catre desarrumado | `catreDesarrumado` | objeto | versão | catre | 3 | `M/catreDesarrumado.ts`, `F/catre-desarrumado.png` |
| 82 | Cama de caixotes | `camaDeCaixotes` | objeto | versão | paletesDeMadeira | 3 | `M/camaDeCaixotes.ts`, `F/cama-de-caixotes.png` |
| 83 | Mesa de caixote | `mesaDeCaixote` | objeto | versão | mesa | 3 | `M/mesaDeCaixote.ts`, `F/mesa-de-caixote.png` |
| 84 | Cadeira remendada | `cadeiraRemendada` | objeto | versão | cadeira | 3 | `M/cadeiraRemendada.ts`, `F/cadeira-remendada.png` |
| 85 | Banco corrido | `bancoCorrido` | objeto | versão | bancosDeCapela | 3, 7 | `M/bancoCorrido.ts`, `F/banco-corrido.png` |
| 86 | Cortina de passagem | `cortinaDePassagem` | objeto | novo | | 3, 4 | `M/cortinaDePassagem.ts`, `F/cortina-de-passagem.png` |
| 87 | Trouxa de roupa | `trouxaDeRoupa` | objeto | novo | | 2, 3 | `M/trouxaDeRoupa.ts`, `F/trouxa-de-roupa.png` |
| 88 | Passarela de tábuas | `passarelaDeTabuas` | construção | versão | deckDeMadeira | 3 | `M/passarelaDeTabuas.ts`, `F/passarela-de-tabuas.png` |
| 89 | Lixo espalhado | `lixoEspalhado` | carimbo | novo | | 3, 5 | `K/lixoEspalhado.ts` |
| 90 | Mato na fresta | `matoNaFresta` | carimbo | novo | | 3, 5 | `K/matoNaFresta.ts` |

81. Catre desarrumado: lençol amarrotado e coberta caída de lado.
82. Cama de caixotes: colchão fino sobre caixotes ou paletes.
83. Mesa de caixote: caixote virado com um pano por cima.
84. Cadeira remendada: perna amarrada com corda e encosto partido.
85. Banco corrido: banco comprido de tábua, sem encosto. Serve ao refeitório do cortiço e ao nicho do refeitório da arena (mapa 7).
86. Cortina de passagem: pano pendurado no vão da porta, rente à parede. Não barra a passagem e tapa a visão. A cor do pano vem do material, se o integrador ligar `LUGARES_DE_MATERIAL`; o padrão é pano cru. Serve ao trapo do cortiço e ao reposteiro vermelho do mapa 4.
87. Trouxa de roupa: saco de pano amarrado, com roupa saindo. Junta a "pilha de roupas" do mapa 2.
88. Passarela de tábuas: tiras de tábua soltas sobre a lama, ligando as portas. É chão: não barra.
89. Lixo espalhado: trapo, caco, papel e lata miúdos, com cores apagadas. A semente varia o desenho.
90. Mato na fresta: tufos ralos e secos, para o pé do muro e as frestas.

## L10 Presídio moderno (simples)

| Nº | Nome visível | Id | Categoria | Tipo | Base | Mapas | Arquivos novos |
|---|---|---|---|---|---|---|---|
| 91 | Vaso com pia de aço | `vasoComPiaDeAco` | objeto | versão | vasoSanitarioModerno | 5 | `M/vasoComPiaDeAco.ts`, `F/vaso-com-pia-de-aco.png` |
| 92 | Mesinha de cela | `mesinhaDeCela` | objeto | novo | | 5 | `M/mesinhaDeCela.ts`, `F/mesinha-de-cela.png` |
| 93 | Mesa de pátio | `mesaDePatio` | objeto | novo | | 5 | `M/mesaDePatio.ts`, `F/mesa-de-patio.png` |
| 94 | Chuveiro coletivo | `chuveiroColetivo` | objeto | novo | | 5 | `M/chuveiroColetivo.ts`, `F/chuveiro-coletivo.png` |
| 95 | Armário de vestiário | `armarioDeVestiario` | objeto | versão | armarioDeFerro | 5 | `M/armarioDeVestiario.ts`, `F/armario-de-vestiario.png` |
| 96 | Cadeira de plástico | `cadeiraDePlastico` | objeto | versão | cadeira | 5 | `M/cadeiraDePlastico.ts`, `F/cadeira-de-plastico.png` |
| 97 | Máquina de lavar | `maquinaDeLavar` | objeto | novo | | 5 | `M/maquinaDeLavar.ts`, `F/maquina-de-lavar.png` |
| 98 | Leito hospitalar | `leitoHospitalar` | objeto | versão | macaComLencol | 5 | `M/leitoHospitalar.ts`, `F/leito-hospitalar.png` |
| 99 | Mesa com computador | `mesaComComputador` | objeto | versão | escrivaninha | 5 | `M/mesaComComputador.ts`, `F/mesa-com-computador.png` |
| 100 | Cerca de alambrado | `cercaDeAlambrado` | objeto | versão | cercaDeFerro | 5 | `M/cercaDeAlambrado.ts`, `F/cerca-de-alambrado.png` |

Paleta do lote: inox, concreto pintado e azul institucional apagado. Os tons vêm de `moveis/tonsDoBanheiroModerno.ts`, que pode ser lido.

91. Vaso com pia de aço: privada e pia num bloco de inox, sem tampa.
92. Mesinha de cela: tampo de aço preso à parede, com banquinho, papéis e caneca.
93. Mesa de pátio: mesa de ripas com dois bancos presos, como as de piquenique.
94. Chuveiro coletivo: ducha de parede numa baia aberta, com ralo. Várias em fila fazem o vestiário.
95. Armário de vestiário: 4 portas estreitas com respiro.
96. Cadeira de plástico: cadeira azul apagado de refeitório e de visita.
97. Máquina de lavar: industrial, com porta redonda de vidro. Várias em fila fazem a lavanderia.
98. Leito hospitalar: colchão azul com grade lateral e cabeceira de tubo.
99. Mesa com computador: mesa de escritório com monitor, teclado e papéis.
100. Cerca de alambrado: tela de arame com mourão. Barra a passagem e não tapa a visão.

## L11 Arena e cortiço: peças grandes e orgânicas (complexo)

| Nº | Nome visível | Id | Categoria | Tipo | Base | Mapas | Arquivos novos |
|---|---|---|---|---|---|---|---|
| 101 | Arquibancada de pedra curva | `arquibancadaDePedra` | construção | novo | | 7 | `M/arquibancadaDePedra.ts`, `F/arquibancada-de-pedra.png` |
| 102 | Fosso de arena | `fossoDeArena` | construção | novo | | 7 | `M/fossoDeArena.ts`, `F/fosso-de-arena.png` |
| 103 | Balaustrada de camarote | `balaustradaDeCamarote` | objeto | novo | | 7 | `M/balaustradaDeCamarote.ts`, `F/balaustrada-de-camarote.png` |
| 104 | Poço de sangue | `pocoDeSangue` | objeto | versão | poco | 7 | `M/pocoDeSangue.ts`, `F/poco-de-sangue.png` |
| 105 | Vela no pires | `velaNoPires` | objeto | novo | | 3 | `M/velaNoPires.ts`, `F/vela-no-pires.png` |
| 106 | Fogareiro de ferro | `salamandra` | objeto | novo | | 3 | `M/salamandra.ts`, `F/salamandra.png` |
| 107 | Monte de entulho | `monteDeEntulho` | objeto | novo | | 3 | `M/monteDeEntulho.ts`, `F/monte-de-entulho.png` |
| 108 | Cama de trapos | `camaDeTrapos` | objeto | novo | | 3 | `M/camaDeTrapos.ts`, `F/cama-de-trapos.png` |
| 109 | Terra rachada | `terra-rachada` | textura | novo | | 7 | `C/terraRachada.ts` |
| 110 | Poça de esgoto | `pocaDeEsgoto` | carimbo | versão | poca | 3 | `K/pocaDeEsgoto.ts` |

101. Arquibancada de pedra curva: um quarto de anel de degraus de pedra escura e lisa. Quatro peças giradas fecham o anel em volta do fosso. É onde se senta, então não barra.
102. Fosso de arena: rebaixo redondo de terra com borda de pedra, rampa de entrada e sombra na borda. É chão: rente, não barra.
103. Balaustrada de camarote: parapeito de madeira em arco, com cadeiras atrás. Barra a passagem e não tapa a visão.
104. Poço de sangue: só a boca redonda de pedra, com líquido vinho escuro de brilho fraco, sem telhado nem sarilho.
105. Vela no pires: toco de vela acesa num pires de lata. Leva luz curta e quente.
106. Fogareiro de ferro: fogareiro barrigudo (a salamandra) com cano, porta com brasa e pés curtos. Ilumina.
107. Monte de entulho: saco rasgado, cacos, tábua e trapo num monte só, com a silhueta antes do detalhe.
108. Cama de trapos: monte de panos para dormir, em forma orgânica de pano.
109. Terra rachada: terra batida marrom-acinzentada, mais clara no meio, com rachaduras finas e orgânicas, sem padrão que se repita. Os testes de `embutidas.test.ts` e o hash entram no registro.
110. Poça de esgoto: água escura com espuma suja. A semente varia o contorno.

## L12 Chão e parede (simples)

| Nº | Nome visível | Id | Categoria | Tipo | Base | Mapas | Arquivos novos |
|---|---|---|---|---|---|---|---|
| 111 | Piso de masmorra | `piso-de-masmorra` | textura | versão | Lajotas de pedra (3ª forma) | 1, 2 | `C/pisoDeMasmorra.ts` |
| 112 | Tijolo de cela | `tijolo-de-cela` | textura | versão | rua-de-tijolos | 2, 4 | `C/tijoloDeCela.ts` |
| 113 | Granito salpicado | `granito-salpicado` | textura | novo | | 7 | `C/granitoSalpicado.ts` |
| 114 | Lajeado poligonal | `lajeado-poligonal` | textura | novo | | 8 | `C/lajeadoPoligonal.ts` |
| 115 | Tábuas com frestas | `tabuas-com-frestas` | textura | versão | madeira-gasta (forma em Pisos de madeira) | 3 | `C/tabuasComFrestas.ts` |
| 116 | Ladrilho azulado | `ladrilho-azulado` | textura | versão | laje-de-templo (forma em Pisos de pedra) | 4 | `C/ladrilhoAzulado.ts` |
| 117 | Parede de tijolo com chapas | `tijolo-com-chapas` | parede | versão | tijolo | 2 | `P/tijolo-com-chapas.png`, `P/amostras/tijolo-com-chapas.png` |
| 118 | Parede de tábuas remendadas | `tabuas-remendadas` | parede | novo | | 3 | `P/tabuas-remendadas.png`, `P/amostras/tabuas-remendadas.png` |
| 119 | Parede de pedra de fortaleza | `pedra-de-fortaleza` | parede | versão | castelo | 4 | `P/pedra-de-fortaleza.png`, `P/amostras/pedra-de-fortaleza.png` |
| 120 | Rachadura no chão | `rachaduraNoChao` | carimbo | novo | | 1, 2, 4, 5, 7, 8 | `K/rachaduraNoChao.ts` |

As texturas de chão seguem o padrão do commit `ae53649d`: `{ id, nome, escala, cor(u,v), forma?, vida? }`. A cor é contida, sem branco puro e sem listra. O chão é gerado por posição e nunca repete (regra 2 do estilo).

As paredes saem do gerador Python do estúdio (`jogos/texturas-labirinto/prova/paredes/gerar_paredes_v2.py`), no padrão do commit `fd80757c`. A folha tem 512x512 e há uma amostra para cada parede. Só este lote mexe no gerador.

O integrador põe os 3 materiais **no fim** de `MATERIAIS_DA_PAREDE`, nesta ordem: 117, 118 e 119. A posição entra na semente das juntas.

111. Piso de masmorra: lajes de tamanhos diferentes com rejunte largo e escuro, umidade nos cantos e algumas rachadas. Entra como a 3ª forma do cartão Lajotas de pedra. Junta a "laje de masmorra" do mapa 2.
112. Tijolo de cela: tijolo miúdo, escuro e encardido, puxando para o vinho. Junta o "tijolo avermelhado" do mapa 4.
113. Granito salpicado: grão fino cinza-chumbo com pontos claros, sem junta. É o chão dos corredores da arena.
114. Lajeado poligonal: pedras chatas irregulares de muitos lados, cinza-azul escuro, com juntas finas.
115. Tábuas com frestas: tábua velha com frestas largas e escuras.
116. Ladrilho azulado: quadradinhos de pedra cinza-azulada, menores que a laje de templo.
117. Parede de tijolo com chapas: tijolo cor de vinho com chapa de ferro aparafusada nas juntas e nas quinas.
118. Parede de tábuas remendadas: tábuas de cores e larguras diferentes, com pregos à vista.
119. Parede de pedra de fortaleza: blocos de basalto quase preto, com junta fina.
120. Rachadura no chão: trinca fina e ramificada, sem brilho, no escuro do próprio chão (multiplica, não pinta de preto). Serve a qualquer piso. É o pedido que mais se repete: 6 dos 8 mapas.

---

## Fila da próxima leva (fora dos 120 por causa do teto de 12 lotes)

Todos estes itens cabem no sistema que já existe. Ficaram de fora só pelo teto da tarefa. Estão agrupados para virar os lotes L13 em diante.

- **Prisão e tortura**:
  - roda de carroça encostada (mapa 1);
  - bandeja de prisioneiro (mapa 2);
  - grade de respiro em meia-lua (mapa 2);
  - pergaminhos enrolados (mapa 2);
  - pufe (mapa 2);
  - arandela de meia-lua (mapa 2);
  - corrente pendurada com gancho (mapa 4);
  - corrente longa traçada, no traçado do `muroDeFogo` (mapa 4);
  - portão de jaula de fera (mapa 7);
  - suporte de armas de gladiador (mapa 7);
  - laje de pressão em losango (mapas 6 e 7);
  - fuligem, carimbo (mapa 1).
- **Fortaleza do ritual**:
  - selo geométrico dourado (mapa 4);
  - arco ogival (mapa 4);
  - pilar de amarração (mapa 4);
  - flâmula vermelha (mapa 4);
  - banco estofado vermelho (mapa 4);
  - banco tombado (mapa 4);
  - barril aberto com líquido (mapa 4);
  - pá de forno (mapa 4);
  - tocha de chama vermelha (mapa 4);
  - braseiro de chama vermelha, como forma do item 56 (mapa 4);
  - cristais vermelhos, carimbo (mapa 4);
  - pilar de rocha no abismo, carimbo (mapa 4);
  - buraco na rocha, carimbo (mapa 4);
  - luz pela grade do teto e feixe de luar, carimbos de brilho (mapas 1 e 4).
- **Cripta**:
  - altar de cristal (mapa 8);
  - candelabro de chama fria (mapa 8).
- **Selva**:
  - estátua de jaguar ou serpente (mapa 6);
  - totem (mapa 6);
  - tocha tiki (mapa 6);
  - braseiro escalonado (mapa 6);
  - altar escalonado (mapa 6);
  - baú de pedra (mapa 6);
  - canoa (mapa 6);
  - urnas pintadas (mapa 6);
  - cabana de palafita (mapa 6);
  - bromélias, carimbo (mapa 6);
  - árvore de copa verde-azulada, carimbo (mapa 6);
  - folhagem rasteira de caverna, carimbo (mapa 2).
- **Canal e caverna (mapa 2)**:
  - cabeceira do canal;
  - estátua de guardião em nicho;
  - ornamento em espiral;
  - boca de caverna;
  - passarela coberta (depende da telha em escama).
- **Cortiço (mapa 3)**:
  - lampião de lata;
  - poltrona rasgada;
  - esteira redonda;
  - balde de lata;
  - prateleira torta;
  - escada de mão;
  - cachorro deitado (a leitura do mapa é incerta);
  - barraco pronto;
  - latrina de madeira;
  - bomba d'água;
  - vala de esgoto;
  - barraca remendada;
  - tábuas soltas, carimbo.
- **Arena (mapa 7)**:
  - arquibancada de pedra reta;
  - tribuna;
  - rastro de luta, carimbo.
- **Presídio moderno (mapa 5)**:
  - escada de metal vazada, mictório, pia coletiva, banco de vestiário, divisória de banheiro;
  - linha de servir, pilha de bandejas, mesa de aço com bancos fixos;
  - fogão industrial, bancada de inox, coifa, pia industrial, prateleira de despensa, carrinho de comida;
  - secadora, mesa de dobrar, carrinho de roupa, prateleira de uniformes;
  - cadeira de exame, suporte de soro, biombo hospitalar, armário de remédios, cadeira de rodas, mesa de exame;
  - caldeira, tanque de pressão, quadro elétrico, tubulação, boiler;
  - mesa de vigilância, pórtico detector, cabine de visita, balcão de recepção, cadeiras de espera, bebedouro, rack e escudo antimotim;
  - arquivo de aço, estação dupla, carteira, quadro branco;
  - pingue-pongue, TV, supino, barra fixa, halteres, saco de pancada, tabela de basquete, arquibancada de metal;
  - viatura, camburão, moto;
  - refletor de muro, poste moderno, balizador, caçamba;
  - torre de concreto, portão deslizante, quadra, torre de iluminação;
  - mancha de óleo, grafite de chão e mancha de umidade, carimbos.
- **Chão**:
  - pedra manchada de sangue (mapa 1);
  - rua de lama escura (mapa 3);
  - lama com lixo (mapa 3);
  - lajota em diagonal (mapa 4);
  - cascalho azulado (mapa 4);
  - pedra de degrau gasta (mapa 7);
  - laje de arenito rachada (mapa 6);
  - piso epóxi, lajota cerâmica cinza, carpete em placas e asfalto zebrado (mapa 5);
  - lajes que brilham (mapa 8);
  - mármore vinho (mapa 8);
  - losangos de pedra (mapa 8).
- **Parede**:
  - parede caiada (mapa 3);
  - bloco de concreto pintado (mapa 5);
  - pedra de templo entalhada (mapa 6);
  - pedra lavrada (mapa 2).
- **Telhado e escada**:
  - telha de barro em escama (mapa 2);
  - telhado remendado (mapa 3);
  - telhado de lajes com musgo (mapa 6);
  - degrau de arenito (mapa 6);
  - degrau de pedra talhada (mapa 8).
- **Tapete puído** (mapa 3): só depois que o outro agente soltar os arquivos do tapete.

## Propostas para depois (precisam de sistema novo)

1. **Parede que deixa a visão passar** (grade de cela e alambrado; mapas 1, 2 e 5): é regra nova de visão para um material de parede, não só imagem. Por enquanto, a frente de cela é a Cela com grade (`celaComGrade`) e a divisão do pátio é o item 100.
2. **Peça pré-montada de várias partes** (bloco de celas do mapa 4, sala pronta): hoje um Prop é uma peça só e barra a caixa inteira, então os tokens não entrariam nas celas. Pede um sistema de "kit" que solte paredes e objetos de uma vez.
3. **Textura que conhece o centro da sala** (piso radial em anéis do mapa 1): hoje a textura é `cor(u,v)` repetida e não sabe onde fica o centro. Por enquanto, o item 31 cobre o centro do salão.
4. **Água com desnível e correnteza animada** (corredeira e cascata dos mapas 2 e 6): a ferramenta Água é plana. Por enquanto, os itens 75 e 80 resolvem como desenho parado.
5. **Fumaça animada com transparência** (chaminé do mapa 3).
6. **Neblina com cor** (névoa roxa do mapa 4 e névoa ciano do mapa 8): a ferramenta Neblina já pinta, mas só numa cor.
7. **Decalque de parede** (mancha de umidade escorrendo no tijolo, mapa 2): o carimbo vai no chão. Pôr marca sobre a parede é sistema novo.
