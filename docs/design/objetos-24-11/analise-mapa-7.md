# Mapa de referência 7: arena redonda escura

Análise de 24/11/2026, feita olhando a imagem região por região (ampliada 2x).

**O que tem no mapa:**
- **Centro:** uma arena redonda. Tem um fosso de terra rachada, três degraus de pedra em anel (a arquibancada), quatro escadarias retas entrando no fosso e camarotes com balaustrada de madeira curva e cadeiras atrás.
- **Em volta:** um anel de corredor.
- **No alto, à direita:** um bloco de 14 celas, cada uma com um catre de cobertor cinza e um caixote de madeira.
- **No alto, à esquerda:** um refeitório com 4 mesas e cadeiras, um nicho com banco e uma escada em caracol que desce reta até uma sala de forja. Na forja há fornalha acesa, caixotes empilhados, uma prateleira e o chão avermelhado pelo brilho.
- **Saindo da forja:** uma passagem de caverna com névoa branca.
- **Embaixo, à esquerda:** uma sala redonda com uma laje em losango no centro.
- **À direita:** um poço redondo de líquido vermelho e dois quartos com cama.
- **Nas passagens:** fileiras de pontos de ferro atravessam os corredores. São grades levadiças vistas de cima.

Os ids entre crases são os do código hoje (`lib/mobilia/pecasNovas.ts`, `lib/mobilia.ts`, `carimbos/`, `texturas/`).

## OBJETOS

| Item | Tipo | Base | Complexidade | Nota |
|---|---|---|---|---|
| Catre de ferro de cela (estrutura de barra de ferro, cobertor cinza dobrado, travesseiro fino) | versão | `catre` | simples | A Cama (`catre`) só tem estrutura de madeira. Nas 14 celas é o objeto que mais se repete. |
| Cadeira de ferro (de prisão/refeitório, chapa e barra) | versão | `cadeira` | simples | A cadeira só tem madeira; o dono pediu exatamente esta versão como exemplo. |
| Mesa de ferro chumbada no chão (refeitório de prisão, com bancos fixos) | versão | `mesa` | simples | Mesa de madeira existe; a de ferro combina com o tema cela/arena. |
| Mesa de madeira com cadeiras (refeitório) | existe | `mesa` | simples | Mesa + Cadeira (madeira) cobrem as 4 mesas do refeitório. |
| Banco de madeira comprido sem encosto (nicho do refeitório) | versão | `bancoDePraca` | simples | Banco de praça tem encosto/ferro; falta o banco liso de tábua. |
| Caixote/banquinho de cela (ao lado de cada catre) | existe | `banqueta` | simples | Banqueta ou Caixa cobrem. |
| Balde de dejetos de cela (penico de madeira com tampa) | novo |  | simples | Não aparece explícito, mas é o par natural do catre de cela. |
| Fornalha acesa (sala da forja) | existe | `fornalha` | complexo | Fornalha de ferreiro, com luz. |
| Pilha de caixotes (cantos da forja) | existe | `pilhaDeCaixas` | simples | |
| Prateleira de parede (lado esquerdo da forja) | existe | `prateleiraDeDeposito` | simples | |
| Cama simples com criado-mudo (dois quartos à direita) | existe | `catre` | simples | Com `criadoMudo`. |
| Poço de sangue (borda de pedra, líquido vermelho escuro) | versão | `poco` | complexo | O Poço tem telhado e sarilho; aqui é só a boca de pedra com líquido. Tem líquido com brilho. |
| Grade levadiça solta (fileira de barras de ferro atravessando um corredor, sem a torre) | versão | `portaoComGradeLevadica` | simples | O app só tem o portão inteiro do castelo; no mapa é só a grade no vão do corredor (4 lugares). |
| Balaustrada curva de camarote (parapeito de madeira em arco com cadeiras atrás) | novo |  | complexo | Peça curva, várias partes. Aparece em 6 trechos em volta do fosso. |
| Laje de pressão em losango (centro da sala redonda) | novo |  | simples | Pode virar armadilha de piso. O Bueiro existe, mas é tampa de esgoto, não laje de pedra. |
| Argola de parede com corrente (de prender gladiador/prisioneiro) | versão | `corrente` | simples | A Corrente existe solta; falta a argola chumbada na parede. Combina com celas e arena. |
| Portão de jaula de fera (grade de ferro de abrir, para soltar o bicho na arena) | novo |  | simples | Não aparece, mas combina com a arena. É diferente da Cela com grade, que é uma cela inteira. |
| Suporte de armas de gladiador (tridente, rede, gládio, escudo redondo) | versão | `suporteDeArmas` | simples | O Suporte de armas existe; esta é a versão de arena. |
| Ossos e sangue no fosso | existe | `ossos` | simples | Mais `sangueNoChao`. |

## CONSTRUÇÕES

| Item | Tipo | Base | Complexidade | Nota |
|---|---|---|---|---|
| Arquibancada de pedra em anel (degraus concêntricos em volta do fosso) | novo |  | complexo | Construção grande e curva. A Arquibancada de torneio existe, mas é reta e de madeira. Peça-chave do mapa. |
| Arquibancada de pedra reta (trecho de degraus) | versão | `arquibancadaDeTorneio` | complexo | Versão de pedra da de torneio, para arenas quadradas. |
| Fosso de arena (rebaixo redondo de terra com borda de pedra e rampa de entrada) | novo |  | complexo | Hoje se monta com textura e paredes; como construção daria o rebaixo, a borda e a sombra prontos. |
| Tribuna/camarote de honra (plataforma com balaustrada e trono) | novo |  | complexo | Não aparece exatamente; combina com o tema. O Trono existe e entraria em cima dela. |
| Cela com grade (bloco de 14 celas) | existe | `celaComGrade` | simples | No mapa as celas são feitas de paredes; a Cela com grade cobre uma por vez. |
| Ringue de luta | existe | `ringueDeLuta` | simples | Alternativa de arena que o app já tem (fica no Objeto). |
| Escada em caracol (alto, à esquerda) | existe |  | simples | É a ferramenta Escada na forma espiral (`computeSpiralPlan`), material Pedra. Não é um objeto. |
| Escada reta de pedra (entradas do fosso, descida até a forja e até a sala redonda) | existe |  | simples | Ferramenta Escada, material Pedra. |

## TEXTURAS

| Item | Tipo | Base | Complexidade | Nota |
|---|---|---|---|---|
| Granito escuro salpicado (chão de todos os corredores e salas) | novo |  | simples | Grão fino cinza-chumbo com pontos claros. Nenhuma das 52 bate: Cascalho é solto, Rocha de caverna é lisa e rachada, e Lajotas têm junta. |
| Terra batida rachada de arena (fundo do fosso) | novo |  | complexo | Marrom acinzentado, mancha clara no meio, rachaduras finas orgânicas. Terra existe, mas sem rachadura e mais clara. |
| Pedra de degrau gasta (anéis da arquibancada) | versão | `laje-de-templo` | simples | Pedra escura lisa com veios, sem junta aparente. Pode ser a forma nova do cartão Pisos de pedra. |
| Rocha de caverna (passagem natural com névoa) | existe | `rocha-de-caverna` | simples | Pisos de pedra, Rocha de caverna. |
| Parede de pedra rústica clara e fina (o contorno de todas as salas) | existe | `pedra-rustica` | simples | Material de parede existente. |
| Escada de pedra (degraus) | existe | `pedra` | simples | Material da escada Pedra (cascalho/pedregulhos). |

## CARIMBOS

| Item | Tipo | Base | Complexidade | Nota |
|---|---|---|---|---|
| Névoa saindo da caverna (bruma branca densa que vaza) | existe |  | complexo | Já é a ferramenta Neblina com pincel (`neblinaPintada`, `lib/neblina.ts`), não um carimbo. Não precisa de peça nova. |
| Rachaduras no chão (sem brasa) | versão | `fendaEmBrasa` | simples | Só existe a fenda com brasa acesa. A rachadura fria serve à arena e a qualquer masmorra; o catálogo diz que hoje não há rachadura genérica. |
| Poça de sangue | versão | `poca` | simples | A Poça é de água; a de sangue combina com a arena e com as celas. |
| Rastro de luta na terra (marcas de arrasto e pegadas revolvidas) | novo |  | simples | Não aparece, mas dá vida ao fundo do fosso. |
| Clarão de brasa no chão (mancha alaranjada em volta da fornalha e na escada) | existe |  | simples | Sai da luz do fogo (`LUZ_DOS_OBJETOS`) da Fornalha/Braseiro; não precisa de carimbo. |

## Resumo

- **Novos (10):**
  - Objetos: Balde de dejetos, Balaustrada curva de camarote, Laje de pressão e Portão de jaula de fera.
  - Construções: Arquibancada de pedra em anel, Fosso de arena e Tribuna de honra.
  - Texturas: Granito escuro salpicado e Terra batida rachada.
  - Carimbo: Rastro de luta.
- **Versões (12):**
  - Catre de ferro, Cadeira de ferro, Mesa de ferro e Banco de tábua.
  - Poço de sangue, Grade levadiça solta, Argola com corrente e Suporte de armas de gladiador.
  - Arquibancada de pedra reta e Pedra de degrau.
  - Rachadura fria e Poça de sangue.
- **Prioridade sugerida:**
  1. Arquibancada de pedra em anel e Granito escuro salpicado, porque dão a cara do mapa.
  2. Catre de ferro e Grade levadiça solta, porque são as peças que mais se repetem.
  3. Cadeira e mesa de ferro, a versão que o dono pediu como exemplo.
