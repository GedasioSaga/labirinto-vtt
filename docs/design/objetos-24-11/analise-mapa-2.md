# Análise do mapa de referência 2: The Prison

Data: 24/11/2026. A imagem foi lida em quatro quadrantes ampliados 3x.
Base de comparação: o `CATALOGO.md` desta pasta ainda não existe, então o inventário saiu direto do código:
- `lib/mobilia/pecasNovas.ts` (os rótulos) e `lib/mobilia.ts:73`;
- `lib/mobilia/construcoes.ts:41`, `carimbos/novos/*` e `carimbos/embutidos.ts`;
- `texturas/embutidas.ts`, `texturas/paredes/catalogo.ts:105`;
- `texturas/meioTermo/materiais.ts:177` (para saber quais materiais cada peça já oferece).

Legenda:
- **novo**: o app não tem;
- **versão**: o app tem a peça, mas falta esta forma ou este material;
- **existe**: já dá para montar com o que há.

Complexidade: **complexo** quando a forma é orgânica, tem muitas partes, luz/brilho, água ou é construção grande. **Simples** quando é móvel ou peça de forma direta.

## O que tem no mapa, por região

- **Noroeste.** Rocha de caverna cinza fora da muralha. Uma passarela externa com telhado de telha vermelha em escama. Na parede, um mecanismo de corrente em leque (o guincho do portão).
  - Sala do carcereiro: escrivaninha com papéis, duas cadeiras e arandela amarela na parede.
  - Quarto do guarda: cama vermelha, tapete vermelho, almofadas e pufes vermelhos.
  - Celas com grade fina, catre de palha e balde. Pilares de tijolo com chapa de ferro aparafusada.
- **Nordeste.** Sala de tortura:
  - potro, mesa com corpo, prancha vertical com corpo amarrado e caixão encostado;
  - bancada de instrumentos, muito sangue e correntes;
  - gaiolas empilhadas na parede leste, uma fila de corpos embrulhados numa prancha comprida;
  - um fosso de brasa quadrado com grade, que brilha vermelho.
  - Ao lado corre o canal de água. Na cabeceira, um arco de pedra esculpido com hera e serpente, e degraus/grade descendo na água. Nos lados, estátuas de guardião em nicho e ornamentos de pedra em espiral, com tochas.
- **Centro.** Salão com piso rebaixado em degraus concêntricos e uma grade de dreno no meio. Tem bueiro redondo, paredes com quina curva e portas duplas.
- **Sudoeste.**
  - Alojamento: quatro camas com cobertor laranja e uma pilha de pano/bandeira vermelha.
  - Depósito: caixas, sacos, barris, pergaminhos e um forno de tijolo embutido aceso.
  - Duas grades de respiro em meia-lua, uma figura presa e celas com catre de palha.
- **Sudeste.** A muralha está rompida e dá na caverna. Lá tem:
  - um lago turquesa com duas cachoeiras e espuma;
  - pedregulhos, ossos e entulho, e folhagem verde rasteira de folha em estrela;
  - chão de terra escura.

## 1. OBJETOS

| # | Item | Tipo | Base no app | Complexidade | Nota |
|---|------|------|-------------|--------------|------|
| O1 | Catre de palha de cela | versão | `catre` | simples | Esteira de palha no chão, sem estrutura. Hoje o catre é só de madeira com cobertor. |
| O2 | Cama de ferro presa à parede | versão | `catre` / `beliche` | simples | Estrutura de ferro com corrente na parede. O `beliche` já aceita ferro, o `catre` não. |
| O3 | Cadeira de ferro | versão | `cadeira` | simples | O pedido do dono: a versão de metal. Hoje a cadeira só tem madeira e assento. |
| O4 | Mesa de ferro rebitada | versão | `mesa` | simples | Mesa de guarda/refeitório de chapa. Hoje a mesa só tem madeira. |
| O5 | Banco de pedra de cela | novo | — | simples | Bloco de pedra encostado na parede. |
| O6 | Latrina de cela (buraco de pedra) | novo | — | simples | A `privada` e o `vasoSanitarioModerno` não servem para masmorra. |
| O7 | Balde de dejetos / penico | versão | `balde` | simples | Balde de madeira escura, sem água limpa. |
| O8 | Grilhões de parede | novo | — | simples | Par de argolas com corrente curta. A `corrente` hoje é solta. |
| O9 | Bola de ferro com corrente | novo | — | simples | Peça clássica de prisão. |
| O10 | Bandeja de comida de prisioneiro | novo | — | simples | Prato de lata, caneca e pão. |
| O11 | Quadro de chaves do carcereiro | novo | — | simples | Tábua de parede com chaveiro de argolas. |
| O12 | Baú todo de ferro | versão | `bau` | simples | Hoje é madeira com ferragens. Falta a forma de cofre de ferro. |
| O13 | Lanterna gradeada de parede | versão | `tochaDeParede` / `lampiao` | complexo | Arandela de ferro com vidro e luz amarela. Os pontos de luz do mapa são todos assim. |
| O14 | Arandela de meia-lua | novo | — | complexo | A luminária dourada em semicírculo da sala do carcereiro e do quarto. Tem luz. |
| O15 | Escrivaninha com papéis | existe | `escrivaninha` | — | Sala do carcereiro. |
| O16 | Cadeira de madeira | existe | `cadeira` | — | |
| O17 | Cama vermelha | existe | `camaDeCasal` / `catre` | — | Quarto do guarda. |
| O18 | Tapete vermelho | existe | `tapete` | — | Não mexer: outro agente está no tapete. |
| O19 | Pufe / almofada de chão | novo | — | simples | As peças vermelhas ao lado da cama. |
| O20 | Beliche / cama do alojamento | existe | `beliche` | — | |
| O21 | Potro de tortura | existe | `potroDeTortura` | — | |
| O22 | Prancha vertical de tortura | novo | — | complexo | Tábua em pé com corpo amarrado. A `damaDeFerro` é outra forma. |
| O23 | Mesa com corpo | existe | `mesaDeAutopsia` / `lajeDeSacrificio` | — | |
| O24 | Corpo envolto em mortalha | novo | — | complexo | A fila de corpos amarrados na prancha. Forma orgânica. |
| O25 | Caixão encostado | existe | `caixao` | — | |
| O26 | Mesa de instrumentos | existe | `mesaDeInstrumentos` | — | |
| O27 | Sangue no chão | existe | `sangueNoChao` | — | |
| O28 | Corrente | existe | `corrente` | — | |
| O29 | Gaiolas empilhadas de parede | versão | `gaiolaSuspensa` / `gaiolaComAves` | simples | Prateleira de gaiolas de ferro, de pé, junto da parede. |
| O30 | Fosso de brasa com grade | versão | `braseiro` / `fornalha` | complexo | Quadrado no chão com brasa e grade por cima, que brilha vermelho. Precisa de luz em `LUZ_DOS_OBJETOS`. |
| O31 | Braseiro com ferros de marcar | versão | `braseiro` | complexo | Combina com a sala de tortura. Tem luz. |
| O32 | Roda de tortura | novo | — | complexo | Do tema, não aparece no mapa. |
| O33 | Poste de açoite | novo | — | simples | Do tema, não aparece no mapa. |
| O34 | Guilhotina | novo | — | complexo | Do tema. A `forcaComCadafalso` já existe como construção. |
| O35 | Tronco de prisioneiro | existe | `troncoDePrisioneiro` | — | A figura presa no alojamento. |
| O36 | Guincho de corrente em leque | novo | — | complexo | Roda dentada com correntes em leque, presa na muralha. Abre o portão. |
| O37 | Grade de dreno quadrada | versão | `bueiro` | simples | No centro do salão. O `bueiro` é redondo. |
| O38 | Bueiro redondo | existe | `bueiro` | — | |
| O39 | Grade de respiro em meia-lua | novo | — | simples | Os dois leques escuros com raios cinza no depósito. |
| O40 | Pilha de caixas, sacos e barris | existe | `pilhaDeCaixas`, `sacosDeGrao`, `barril` | — | Depósito. |
| O41 | Pergaminhos enrolados | novo | — | simples | No depósito. Ainda não há rolo de papel solto. |
| O42 | Forno de tijolo embutido | existe | `fornoDePao` | — | Aceso, no depósito. |
| O43 | Pilha de roupas / trouxa | novo | — | simples | O monte de pano vermelho do alojamento. |
| O44 | Destroços / entulho de madeira | existe | `destrocosDeMadeira` | — | |
| O45 | Ossos / crânio | existe | `ossos`, `cranio` | — | Na caverna. |
| O46 | Estante de armas do guarda | existe | `suporteDeArmas` | — | |

## 2. CONSTRUÇÕES

| # | Item | Tipo | Base no app | Complexidade | Nota |
|---|------|------|-------------|--------------|------|
| C1 | Fosso escalonado (piso rebaixado em degraus) | novo | — | complexo | O coração do salão central. Os anéis de degraus descem até um quadrado com grade. É grande e tem relevo. |
| C2 | Cabeceira do canal (arco esculpido com serpente) | novo | — | complexo | O arco de pedra com hera e a boca de onde sai o canal, com degraus na água. Pedra entalhada mais água. |
| C3 | Estátua de guardião em nicho | versão | `estatua` | complexo | Guerreiro com espada dentro de moldura de pedra, na beira do canal. |
| C4 | Ornamento de pedra em espiral (mísula) | novo | — | complexo | As peças curvas presas no muro do canal. Muitas partes e forma orgânica. |
| C5 | Fornalha de incineração | versão | `fornalha` | complexo | O fosso de brasa grande com moldura de tijolo. É a variante construção do O30, quando ocupa 2x2 ou mais. |
| C6 | Portão da prisão com grade | existe | `portaoComGradeLevadica` | — | |
| C7 | Guarita | existe | `guarita` | — | |
| C8 | Torre de vigia | existe | `torreDeVigia` | — | Fora do mapa, mas é do tema. |
| C9 | Passarela coberta na muralha | novo | — | complexo | O caminho externo com telhado de escama vermelha. Pode bastar um telhado, ver T4. |
| C10 | Boca de caverna / túnel | novo | — | complexo | Entrada escura na rocha. Rocha orgânica com sombra. |
| C11 | Cela com grade | existe | `celaComGrade` | — | Ela já tem grade de metal e piso de pedra. |
| C12 | Pátio de exercício cercado | novo | — | complexo | Do tema: cerca alta de ferro com portão. |
| C13 | Brecha na muralha (parede desabada) | versão | `escombrosDePedra` | complexo | Muro de tijolo rompido com pedras caídas, como no canto sudeste. |
| C14 | Montanha / rocha de caverna | existe | `montanhaPequena`/`Media`/`Grande` | — | A rocha cinza dos cantos. |

## 3. TEXTURAS (chão, parede, telhado, escada, água)

| # | Item | Tipo | Base no app | Complexidade | Nota |
|---|------|------|-------------|--------------|------|
| T1 | Parede de tijolo vermelho com chapas de ferro rebitadas | versão | parede `tijolo` | simples | O tijolo cor de vinho do mapa, com chapa de ferro aparafusada nas juntas e quinas. Entra no FIM de `MATERIAIS_DA_PAREDE`. |
| T2 | Parede de grade de cela | novo | — | complexo | Barras finas de ferro que barram a passagem mas não a visão. Muda a regra da visão, por isso é complexo. |
| T3 | Laje de masmorra (pedra escura quadrada com limo) | versão | `lajotas-escuras` | simples | A `lajotas-escuras` chega perto. Falta a sujeira e o limo nas juntas. |
| T4 | Telha de barro em escama | versão | telhado (ardósia, metal, tabuinhas, palha) | simples | O vermelho escamado da passarela. |
| T5 | Piso de tijolo escuro de cela | versão | `rua-de-tijolos` | simples | O piso miúdo dentro das celas. |
| T6 | Grade de ferro no chão | existe | `chao-de-metal-grade` | — | O centro do fosso. |
| T7 | Escada de pedra escura | existe | escada `pedra` | — | |
| T8 | Água do canal | existe | ferramenta Água (`rio`, cor `turquesa`) | — | |
| T9 | Lago da caverna | existe | ferramenta Água (`lago`, cor `turquesa`) | — | |
| T10 | Chão de caverna (terra escura com cascalho) | existe | `terra`, `cascalho`, `rocha-de-caverna` | — | |
| T11 | Parede de rocha de caverna | existe | parede `rocha-de-caverna` | — | |
| T12 | Pedra lavrada do canal (bloco cinza claro) | versão | parede `castelo` | simples | Os blocos claros da cabeceira do canal, mais lisos que o castelo. |

## 4. CARIMBOS

| # | Item | Tipo | Base no app | Complexidade | Nota |
|---|------|------|-------------|--------------|------|
| K1 | Cachoeira (queda d'água com espuma) | novo | — | complexo | Duas no lago da caverna. É água com espuma branca e talvez movimento. |
| K2 | Espuma / correnteza | novo | — | complexo | A mancha branca onde a queda bate no lago. |
| K3 | Folhagem rasteira de caverna (folha em estrela) | novo | — | complexo | As plantinhas verdes vivas na rocha. A `samambaia` é outra forma. |
| K4 | Rachadura no chão | novo | — | simples | Não existe rachadura genérica. O piso da prisão é cheio delas. |
| K5 | Mancha de umidade / limo na parede | novo | — | simples | Escorrido escuro nas paredes de tijolo. |
| K6 | Ossada espalhada | existe | objeto `ossos` | — | Dá para usar o objeto. Não precisa de carimbo. |
| K7 | Pedregulhos / rochedo | existe | `pedras`, `rochedo-com-musgo`, `seixos` | — | |
| K8 | Lama / poça | existe | `lama`, `poca` | — | |
| K9 | Musgo | existe | `musgo` | — | |
| K10 | Teia de aranha | existe | objeto `teiaDeAranha` | — | |
| K11 | Respingo de sangue (rastro) | versão | objeto `sangueNoChao` | simples | O rastro arrastado até a mesa de tortura. Como carimbo, varia sozinho pela semente. |

## Resumo

- **Objetos:** 46 itens.
  - Novos: 17 (O5, O6, O8–O11, O14, O19, O22, O24, O32–O34, O36, O39, O41, O43).
  - Versões: 11 (O1–O4, O7, O12, O13, O29–O31, O37).
  - Os outros 18 já existem.
- **Construções:** 14 itens.
  - Novos: 6 (C1, C2, C4, C9, C10, C12), todos complexos. C12 (pátio de exercício) é ideia do tema e não aparece no mapa.
  - Versões: 3 (C3, C5, C13).
  - Existem: 5.
- **Texturas:** 12 itens.
  - Novo: 1 (T2, a parede de grade).
  - Versões: 5 (T1, T3, T4, T5, T12).
  - Existem: 6.
- **Carimbos:** 11 itens.
  - Novos: 5 (K1–K5).
  - Versão: 1 (K11).
  - Existem: 5.

**Prioridade sugerida (decisão do Claude):**
- A cara do mapa: T1 (tijolo com chapa) e T2 (parede de grade).
- O pedido do dono: as versões de metal (O2, O3, O4, O12).
- A peça marcante do salão: C1 (o fosso escalonado).
- A água viva: K1 (a cachoeira).
