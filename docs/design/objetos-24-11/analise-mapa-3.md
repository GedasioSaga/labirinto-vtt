# Mapa de referência 3 — City Slums (favela medieval)

Fonte: imagem 13.png (Kronos Battlemaps, 794x596), olhada em 6 recortes ampliados 3x.
Data: 24/11/2026. Só análise: nada foi desenhado nem registrado no app.

**Aviso:** `docs/design/objetos-24-11/CATALOGO.md` não existe no repo (o agente que levantou o inventário não tinha
escrita). A comparação abaixo foi feita direto no código: os nomes em `lib/mobilia/pecasNovas.ts` (FICHAS) e
`lib/mobilia.ts:73`, as construções em `lib/mobilia/construcoes.ts`, os chãos em `texturas/embutidas.ts:1405-1474`,
as paredes em `texturas/paredes/catalogo.ts:105` e os carimbos em `carimbos/novos/`.

## O que o mapa mostra, por região

- **Cima, esquerda:** casa de tábuas em L com mesa redonda e vela acesa, tapete vermelho puído, camas de catre,
  fogareiro redondo de ferro encostado na parede de fora com fumaça saindo, pilha de caixotes e barris do lado de fora,
  corredor com tapete azul redondo e uma escrivaninha.
- **Cima, centro:** quartos de catre lado a lado, mesa comprida com vela, caixotes empilhados na rua; casa de parede
  clara (reboco caiado, moldura branca) com escada interna, tapete vermelho e mesa redonda; carroça quebrada e
  tábuas espalhadas na lama; barris e um saco/bicho laranja deitado junto à parede.
- **Cima, direita:** casa de parede clara com tapete vermelho comprido e um redondo; sala grande com poltronas
  vermelhas em volta de uma lareira; corredor com tapetes estreitos de padrão e uma fileira de cubículos com catres
  desarrumados (cortiço).
- **Meio e baixo, esquerda:** quartos com catres amarrotados e trapos no chão, esteira redonda de palha, círculo
  riscado no chão com um corpo caído e sangue, montes de caixas quebradas e entulho do lado de fora.
- **Baixo, centro:** quarto em ângulo (parede diagonal) com camas, mesa com vela; sala com bancos compridos em
  fileira (refeitório ou capela pobre).
- **Baixo, direita:** oficina com bancada comprida e ferramentas, depósito de caixotes, lareira com fogo.
- **Rua:** terra escura e lama com cascalho, **passarelas de tábuas** deitadas sobre a lama ligando as casas,
  tábuas soltas, vãos de porta fechados por **cortina de pano** (a linha tracejada rosa nas portas).

Legenda: **novo** = o app não tem; **versão** = o app tem a peça, falta esta forma; **existe** = já dá para montar.
Complexidade: **complexo** = forma orgânica, muitas partes, luz/brilho, fumaça, água ou construção grande;
**simples** = móvel ou peça de forma direta.

## 1. OBJETOS

| Item | Tipo | Base no app | Complexidade | Nota |
|---|---|---|---|---|
| Catre / cama simples | existe | `catre` | simples | O mapa inteiro usa. |
| Catre desarrumado (lençol amarrotado, coberta caída) | versão | `catre` | simples | A cama mais vista no mapa; hoje a cama é sempre arrumada. |
| Colchão de palha no chão (enxergão) | novo | — | simples | Vários cubículos têm só o colchão, sem estrado. |
| Cama de trapos (monte de panos para dormir) | novo | — | complexo | Forma orgânica de pano; aparece nos quartos de baixo. |
| Cama de caixotes/paletes | versão | `catre` / `paletesDeMadeira` | simples | Tema do mapa: móvel improvisado. |
| Mesa redonda com cadeiras | existe | `mesaRedonda` + `cadeira` | simples | |
| Mesa de caixote (caixote virado com pano) | versão | `mesa` / `caixa` | simples | Não aparece igual, combina com o tema. |
| Cadeira remendada/quebrada (perna amarrada) | versão | `cadeira` | simples | Hoje a cadeira só tem madeira e assento. |
| Banco comprido de tábua (refeitório) | versão | `banqueta` / `bancosDeCapela` | simples | A sala de baixo tem fileiras; o banco de capela tem encosto, este não. |
| Toco de vela solto (vela no pires, acesa) | novo | — | complexo | Luz; as mesas do mapa têm vela sozinha. Hoje só há `criadoMudo` com vela e `centroDeMesa`. |
| Lampião | existe | `lampiao` | simples | |
| Lampião de lata (latão amassado) | versão | `lampiao` | simples | Material novo `lata` no lugar de metal fino. |
| Fogareiro de ferro barrigudo (salamandra) com cano | novo | — | complexo | Brasa + fumaça; encostado na parede de fora em 3 casas. |
| Lareira | existe | `lareira` | simples | Sala das poltronas e oficina. |
| Poltrona | existe | `poltrona` | simples | |
| Poltrona rasgada (espuma/palha saindo) | versão | `poltrona` | simples | Combina com o tema. |
| Tapete retangular e redondo | existe | `tapete` (formas retangular/redondo) | simples | |
| Tapete puído (borda roída, furos) | versão | `tapete` | simples | Os tapetes do mapa são gastos. Atenção: arquivo do tapete está com outro agente. |
| Tapete longo de padrão (corredor) | existe | `tapeteLongo` | simples | |
| Esteira redonda de palha trançada | novo | — | simples | Quarto de baixo, à esquerda. |
| Cortina de pano no vão da porta | novo | — | simples | Toda porta interna do mapa usa; rente à parede, sem barrar. |
| Pilha de caixas / caixa quebrada / barril quebrado | existe | `pilhaDeCaixas`, `caixaQuebrada`, `barrilQuebrado` | simples | |
| Barril / barris deitados | existe | `barril`, `barrisDeitados` | simples | |
| Destroços de madeira | existe | `destrocosDeMadeira` | simples | |
| Monte de entulho e lixo (saco rasgado, cacos, trapo) | novo | — | complexo | Muitas partes; está em volta de quase toda casa. |
| Saco de trapos / trouxa de roupa | novo | — | simples | Aparece encostado nas paredes. |
| Penico | novo | — | simples | Tema do mapa. |
| Balde de água | existe | `balde` | simples | |
| Balde de lata enferrujado | versão | `balde` | simples | |
| Panelas e bacias | existe | `panelasEBacias` | simples | |
| Prateleira de potes | existe | `prateleiraDePotes` | simples | |
| Prateleira de tábua torta (sobre tijolos) | versão | `prateleiraDePotes` | simples | Combina com o tema. |
| Bancada de ferramentas | existe | `bancadaDeFerramentas` | simples | Oficina de baixo. |
| Escrivaninha | existe | `escrivaninha` | simples | |
| Carroça quebrada | existe | `carrocaQuebrada` | simples | Rua de cima. |
| Círculo riscado no chão | existe | `circuloMagico` | simples | |
| Sangue no chão | existe | `sangueNoChao` | simples | |
| Corpo caído coberto por lençol | novo | — | complexo | Forma orgânica; quarto de baixo à esquerda. |
| Ratos (2-3 ratos) | novo | — | complexo | Bicho, forma orgânica; combina com o tema. |
| Cachorro vira-lata deitado | novo | — | complexo | Há um vulto laranja deitado na rua de cima; não dá para ter certeza do que é. |
| Varal de roupa | existe | `varalDeRoupa` | simples | Não aparece, mas cabe no tema. |
| Escada de mão encostada | versão | `escadaDeCerco` | simples | A de cerco é grande; esta é uma escadinha de 2 casas. |

## 2. CONSTRUÇÕES

| Item | Tipo | Base no app | Complexidade | Nota |
|---|---|---|---|---|
| Barraco de tábuas (casebre pronto, 1 cômodo, com telhado) | novo | — | complexo | Construção grande; hoje a casa só se monta parede a parede. |
| Passarela de tábuas sobre a lama | versão | `deckDeMadeira` / `ponte` | simples | Tiras de tábua deitadas ligando as portas; o deck é quadrado e liso. |
| Latrina de madeira (casinha com porta) | novo | — | simples | Tema do mapa; tem `privada`, mas não a casinha de fora. |
| Bomba d'água de ferro (manivela) com cocho | novo | — | simples | Água pública de cortiço; `poco` é de pedra. |
| Vala de esgoto a céu aberto com pranchas | novo | — | complexo | Água suja; trecho comprido. |
| Barraca de lona remendada | versão | `tenda` | simples | Tenda com remendos e cordas. |
| Degraus de madeira na porta | existe | ferramenta Escada (`lib/materialDaEscada.ts`, madeira) | simples | Casas de parede clara têm 3 degraus na entrada. |

## 3. TEXTURAS

| Item | Tipo | Base no app | Complexidade | Nota |
|---|---|---|---|---|
| Chão de tábua velha | existe | chão `madeira-gasta` | simples | Piso de todas as casas. |
| Tábuas com frestas (tábua solta, vão escuro entre elas) | versão | chão `madeira-gasta` | simples | O piso do mapa tem frestas largas; nova forma no cartão Pisos de madeira. |
| Rua de lama escura com cascalho | versão | chão `pedras-com-lama` / `terra` | simples | A rua do mapa é mais escura e molhada que a `terra`. |
| Lama de favela com lixo miúdo | novo | — | complexo | Cacos, palha e trapo espalhados; cuidado para não virar listra. |
| Parede de tábuas | existe | parede `madeira` / `madeira-gasta` | simples | |
| Parede de tábuas remendadas (tábuas de cores e larguras diferentes, pregos) | novo | — | simples | A parede típica do mapa. Entra no FIM de MATERIAIS_DA_PAREDE. |
| Parede caiada (reboco claro sobre madeira, pau-a-pique) | novo | — | simples | As casas de moldura branca. Entra no FIM da lista. |
| Telhado remendado (tábua + chapa de lata) | versão | telhado `tabuinhas` / `metal` | simples | Não aparece (mapa sem telhado), mas é o telhado do tema. |

## 4. CARIMBOS

| Item | Tipo | Base no app | Complexidade | Nota |
|---|---|---|---|---|
| Lama | existe | `lama` | simples | |
| Poça suja (esgoto, água escura com espuma) | versão | `poca` | complexo | Água. |
| Tábuas soltas espalhadas | versão | `galhosCaidos` | simples | Na rua de cima, em volta da carroça. |
| Lixo espalhado (trapo, osso, caco) | novo | — | simples | Pontos soltos para pintar a rua. |
| Mato seco entre as tábuas | novo | — | simples | Tufos ralos junto às paredes. |
| Folhas secas | existe | `folhasSecas` | simples | |
| Fumaça de chaminé | novo | — | complexo | As 3 casas da esquerda soltam fumaça branca pela parede; precisa de transparência e talvez movimento. |

## Resumo

- Objetos: 19 existem, 11 versões, 12 novos (7 complexos: cama de trapos, vela, fogareiro, entulho, corpo, ratos,
  cachorro).
- Construções: 1 existe, 2 versões, 4 novas.
- Texturas: 2 existem, 3 versões, 3 novas (lama com lixo é a única complexa).
- Carimbos: 2 existem, 2 versões, 3 novos.
- Peças mais vistas no mapa e que o app não tem: **catre desarrumado**, **cortina no vão da porta**, **passarela de
  tábuas**, **parede de tábuas remendadas**, **monte de entulho** e **fogareiro de ferro com fumaça**.
