# Requisitos: o que precisa estar certo para usar, evoluir e transformar (23/11/2026)

Plano do arquiteto-solucoes para o pedido de 23/11 (literal no PEDIDOS.md) e a lista aprovada
`REQUISITOS-LISTA.md` (46 tipos, A1 a J2). Nada de código aqui. Implementa o `programador` (lib, host, rede), o
`programador-frontend` (telas) e o `especialista-dados` (proposta dos antigos). Nenhum Rust. A cara das telas vem do
protótipo do designer em `docs/design/habilidades/requisitos/` (feito em paralelo; as fases de tela esperam a aprovação).

## Em uma página

- **Um campo novo `requisitos` no cartão**, fora da mecânica: vale para técnica de texto, técnica montada, arma, item e
  forma, do mesmo jeito. A mecânica continua na versão 3; nenhum cartão muda de leitura.
- **Uma função pura julga** (`lib/batalha/requisitos/avaliar.ts`): recebe o estado da batalha, quem usa, o alvo e o
  campo e devolve "cumpre", "falta" (com a lista dos motivos) ou "pergunta" (aliado, mestre, caixa, teste). A mesma
  conta no menu do mestre, no do jogador, no host, no Testar e no treino do Lobby.
- **Cinza com motivo**: "Falta: polaridade 2, tem 1". O mestre usa mesmo assim (`forcarRequisitos`), e o registro diz
  "(o mestre forçou: faltava ...)".
- **Grupos**: a raiz é sempre "Todos estes"; dentro dela pode haver grupos "Um destes" de um nível só (sem grupo dentro
  de grupo). Cobre o Caça às Bruxas e todos os exemplos da lista; o que não couber vira requisito personalizado.
- **Pedido ao aliado** vira uma pendência no estado da batalha: o aliado vê "Aceitar / Recusar" na tela dele (NPC: o
  mestre), prazo de 60 s, nada é gasto antes do aceite, e o golpe aceito sai numa linha só, com Desfazer.
- **Caixa "Cumpriu?"**: quem usa marca, a resposta vai no campo `respostas` que o pedido já tem, o registro diz
  "(declarou: ...)" e o mestre desfaz pela linha.
- **Evolução e subida de Parte viram dados**: o Caça às Bruxas e a Forma Híbrida da Ryoko saem de `mecanicasAMao.ts`
  e passam a morar nos cartões, com o mesmo comportamento de hoje.
- **Os antigos**: o Claude lê textos e extras, propõe, o app guarda cópia e só grava no Confirmar ("Dar requisitos aos
  antigos", o mesmo jeito do "Dar alcance aos antigos").

## 1. O que existe hoje (conferido no código)

| Peça | Onde | Observação |
|---|---|---|
| Portão do host | `lib/batalha/golpe.ts:402` (`podeAgir`) → `lib/batalha/acoes.ts:227` (`motivoDaTecnica`) | Já confere passiva, evolução, Overload, recarga, usos, item, SP, ação. É onde o requisito entra |
| Menu cinza com motivo | `ListaDeTecnicas` (Tira) lendo `motivoDaTecnica` | A tela já sabe mostrar; só ganha motivos novos |
| Evolução | `lib/batalha/escolhaEEvolucao.ts` (`motivoDoEvoluir:406`, `evoluidas`, `semEvoluida:374`) | O botão Evoluir NÃO confere a condição (texto livre), só a do Sieg à mão |
| Regras à mão por id | `mecanicasAMao.ts`: `evoluirPede` (388, 739, lido em 1378), `voltaDepoisDoOverload` (390, lido em `acoes.ts:244`), `FURIA_DO_DRAGAO` (485, `sobeDeParte`), `PARTE_DA_FORMA_HIBRIDA` (489, `partesEmOrdem`); ids nas linhas 527-532 | São as três regras que viram dado |
| Partes da forma | `lib/batalha/transformacao.ts:453` (`motivoDaOrdemDasPartes`), `:465` (`subidaDeParte`), `stores/batalha/formas.ts` | A Fúria é subcartão de cada Parte e liga a Parte seguinte do grupo |
| Contador (polaridade) | `lib/batalha/contador.ts:108` (`nivelDoContador`) | `podeAgir` não lê |
| Selo exigido | `mecanica/modelo.ts` (`alvo.exigeSelo`) | Só olha o ALVO e só na mecânica montada |
| Pergunta na hora | `lib/batalha/perguntaNaHora.ts` (`respostas`, até 8, texto até 40) | Caminho pronto para a caixa e a escolha do "Um destes" |
| Pendência esperando alguém | `combate.ts:240` (`InvocacaoPendente`), `:295` (`FormaPendente`) | Molde do pedido ao aliado |
| Desfazer por campo | `registro.ts:631` (`combateSemALinha`) | Desfaz só o que a linha mudou no combate |
| Proposta dos antigos | `lib/batalha/alcance/antigos.ts`, `stores/alcanceDosAntigos.ts`, `components/livros/DarAlcanceAosAntigos.tsx` | Molde do fluxo proposta, cópia, Confirmar |
| Doar SP a aliado | não existe | Nasce aqui, só como parte de um requisito |

## 2. Abordagens consideradas

| Ponto | Escolha | Rejeitada (e por quê) |
|---|---|---|
| Onde mora | Campo `requisitos` no cartão (e na entrada do catálogo, no item, na vaga) | Dentro da mecânica (versão 4): a mecânica é tudo ou nada e ~230 cartões de texto ficariam de fora |
| Quem julga | Uma função pura em `lib/batalha/requisitos/` | Conta espalhada no menu e no host: um diria "pode" e o outro "não pode" |
| Grupos | Raiz "Todos estes" + "Um destes" de um nível | Árvore livre: editor difícil, frase ilegível, e nenhum caso real pede |
| Histórico (andou, acertou, última técnica) | Campos novos no combate de cada ficha, desfeitos pelo `combateSemALinha` | Ler do registro: a linha é texto e reversão, não diz "usou X" de forma segura |
| Pedido ao aliado | Pendência no estado da batalha + pedido de resposta | Mensagem solta fora do estado: some ao recarregar a tela, não aparece no recorte nem para o mestre |
| Regras que já existem (usos, recarga, custo por rodada, alvo caído, custo em item, selo no alvo) | Continuam onde estão; o editor de requisitos só as MOSTRA (linha "vem da mecânica") | Duplicar no `requisitos`: duas regras para a mesma coisa |
| Evolução | Continua no botão Evoluir, cinza até cumprir | Evoluir sozinho ao cumprir: surpresa, e gasto (50 SP) sem o jogador decidir |

## 3. Modelo de dados

### 3.1 O bloco (`lib/batalha/requisitos/modelo.ts`)

```ts
// esboço
interface RequisitosDoCartao {
  v: 1
  usar?: Grupo                                   // técnica, arma, item: usar; forma: ligar
  evoluir?: { grupo: Grupo; dura: 'umUso' }      // só na base de uma evolução (I3)
  aoUsar?: { sobeParte: true }                   // técnica: sobe uma Parte a forma de onde ela vem (I1)
  forma?: { partesEmOrdem?: true; soLigaPor?: RefDeCartao[] }   // forma: uma Parte por vez; só liga pela técnica X (I2)
}
type Grupo = { todos: (Requisito | { id: string; umDestes: Requisito[] })[] }   // até 12 na raiz, até 6 no "Um destes"
type RefDeCartao = { id?: string; nome: string }  // id na mesma ficha; nome quando veio do catálogo ou de outra ficha
type Requisito = { id: string; tipo: TipoDeRequisito; nao?: true; gasta?: true }   // mais os números de cada tipo
```

Tipos (código curto; a letra é a da lista): `sp` A1, `vida` A2, `escudo` A3, `contador` A4, `concentracao` A5,
`pagaVida` A6, `reacaoLivre` A7, `ligada` B1 (técnica e opção, lida pelo selo como o Sieg hoje), `selo` B2, `naForma`
B3, `parado` B4, `andou` B5, `apanhou` B6, `acertou` B7, `errou` B8, `rodada` C1, `depoisDe` C2, `jaUsada` C3,
`ordemNaVez` C4, `alvoComSelo` D1, `alvoVida` D2, `alvoMarcado` D3, `alvoTipo` D5, `alvoJaAgiu` D6, `aliadoPerto` E1,
`sozinho` E2, `semInimigoColado` E3, `inimigosPerto` E4, `luz` E5, `item` F1, `armaNaMao` F2, `municao` F3,
`pedirAoAliado` G1, `ajudaDeAliado` G2, `aliadoUsou` G3, `aliadosDePe` G4, `aliadoCaiu` G5, `teste` H1 (com o que
acontece se falhar: perde a ação, ou não gasta nada), `disputa` H2, `personalizado` J1 (texto até 120), `mestreDecide`
J2. São 39 tipos novos.

Sem tipo novo (já existem e o editor só mostra): C5 usos, C6 recarga, C7 custo por rodada (`custoPorTurno.ts`), D4
alvo caído, E6 ver o alvo (o alcance já confere). D1 e F1 de cartão montado continuam em `alvo.exigeSelo` e
`custoEmItem`; em cartão de texto vão para o bloco. I1, I2 e I3 são as chaves `aoUsar`, `forma` e `evoluir`.

`nao` vira o contrário ("sem Escudo", "não Atordoado"). `gasta` só nos tipos de recurso (A1, A4, A5, F1, F3, G1);
A6 e A7 sempre gastam. Tipo desconhecido (bloco de app mais novo) = o cartão fica cinza com "Requisito de app mais
novo: atualize o app" (o mestre pode forçar). Bloco torto inteiro = ignorado com aviso no editor, nunca derruba a ficha.

### 3.2 Onde o bloco mora

| Coisa | Campo | Quem copia |
|---|---|---|
| Técnica (de texto ou montada), subcartão, passiva | `CartaoDaFicha.requisitos` (`lib/personagem.ts`) | ninguém |
| Habilidade do livro | entrada do catálogo (`lib/livros/catalogo.ts`) | "Trazer" e "Juntar" levam ao cartão |
| Arma | entrada de arma do catálogo | `stores/armasNaFonte.ts`, pelo mesmo caminho do `alcance` (cópia travada) |
| Item | item do Acervo e a vaga da mochila | "Atualizar as cópias" (o mesmo do `efeito`); o host lê da cópia dele |
| Forma (transformação e Partes) | o cartão da forma | ninguém |

O jogador recebe os requisitos só dos próprios cartões (o recorte já não leva cartão de NPC).

## 4. A função que julga (`lib/batalha/requisitos/`)

Arquivos puros (sem store, sem rede, sem Pixi):

- `modelo.ts` e `ler.ts`: tipos, leitor tolerante, limites.
- `frases.ts`: a frase de cada requisito ("Polaridade 2 ou mais, gasta 2") e o motivo curto ("Falta: polaridade 2, tem
  1"; vários: "Falta: Melodia ligada; 50 SP ou ajuda de aliado com fogo").
- `contexto.ts`: `ContextoDosRequisitos` = rodada, carta da vez, ordem, selos, combates, fichas com HP, SP e Escudo,
  posições na grade, equipes, invocados, o rastro (seção 5), alvos escolhidos e a luz (só se algum requisito pede).
  Três montadores: do host (tudo), do mestre (tudo) e do jogador (o recorte; o que ele não vê fica `naoSei`).
- `avaliar.ts`: `avaliarRequisitos(grupo, ctx)` devolve `veredito` ('cumpre', 'falta' ou 'pergunta'), os `itens`
  (cada um com estado 'ok', 'falta', 'pergunta' ou 'naoSei', a frase e o motivo), os `gastos` e as `perguntas`. Ordem:
  tudo o que é automático primeiro; só se nada automático falta, os que perguntam viram `pergunta`. No "Um destes",
  vale se uma opção vale; se mais de uma vale e gasta, quem usa escolhe.
- `gastos.ts`: `aplicarGastos(ficha, combate, gastos)`, puro, devolve o novo estado para a linha do registro.

`naoSei` (o jogador não enxerga a vida do alvo, o NPC no escuro) deixa a técnica clicável com a nota "o mestre
confere"; o host decide com o contexto inteiro. Custo: até 12 itens por cartão, contas lineares no número de fichas; a
luz só é medida se um requisito `luz` existir. O menu guarda o resultado por versão do estado (`turnosRev`), não por
render.

## 5. O que o motor passa a guardar (o rastro)

Campos opcionais novos em `CombateDoPersonagem` (`combate.ts:48`), todos "ausente = zero", para a batalha salva antiga
abrir igual:

| Campo | Para | Zera |
|---|---|---|
| `rastro.vez`: chave da vez, casas andadas, ações feitas, acertou | B4, B5, B7, C4 | no começo da vez dele (antes, conferir se os `caminhos` do mestre já zeram por vez e servem para as casas) |
| `rastro.ultimoAtaque`: acertou ou errou | B8 | troca a cada ataque |
| `rastro.ultimaAcao`: o cartão, 'atacar' ou 'item' | C2 (combo: a ação imediatamente anterior DELE) | troca a cada ação |
| `rastro.usadas`: ids (até 64) | C3 (os `usos` de hoje só contam técnica com limite, `golpe.ts:552`) | batalha nova |
| `rastro.naRodada`: rodada e ids | G3 (lido no combate do aliado) | rodada nova |
| `rastro.danoDesdeAVez` | B6 | no começo da vez dele |
| `turnos.jaCairam`: tokenIds | G5 | batalha nova |

Rodada (C1), contador (A4), concentração (`carga`, A5), reação (`semReacao`, A7), marca (`marca.ts`, D3), quem já
agiu (D6, pela ordem), aliados de pé (G4), munição (`municaoDaFicha.ts`, F3) e luz (E5, `lib/luzDoFogo.ts`) já existem
ou saem de conta. Toda linha que muda o rastro guarda o antes e o depois, e `combateSemALinha` (`registro.ts:631`)
passa a desfazer cada campo do rastro; a linha de dano desfaz o `jaCairam` e o `danoDesdeAVez` do alvo.

## 6. Host: conferir, gastar e o mestre forçar

- **Um portão para cinco caminhos**: `motivoDosRequisitos(cartao, ctx, pedido)` chamado em `motivoDaTecnica` (técnica e
  reação), no Atacar com arma (`armaNaVez` e o motivo da arma), em `itemNaBatalha.ts`, na transformação (o ligar da
  forma) e no `motivoDoEvoluir` (o grupo `evoluir`). Dentro do `motivoDaTecnica`: depois de passiva, reação,
  transformação e evolução; antes de recarga, usos, custo e ação.
- **Gastos**: saem na mesma linha do golpe, depois do custo normal (SP, HP, contador, concentração, reação, item,
  munição, SP do aliado). Desfazer a linha devolve tudo.
- **Perguntas no pedido**: a caixa (chave `req.<id>` = sim) e a escolha do "Um destes" (chave `req.<grupo>` = id da
  opção) vão no campo `respostas` que já existe; o host confere cada uma contra a avaliação dele (resposta sem pergunta
  = recusa).
- **Teste (H1, H2)**: o host rola na hora do pedido, como a disputa no uso (`disputaNoUso.ts`). Falhou com "perde a
  ação": gasta a ação e o custo e o golpe não sai; com "não gasta": recusa sem gastar. O dado vai ao registro.
- **Mestre força**: pedido com `forcarRequisitos: true`, aceito só com autor mestre. Pula a conferência e os gastos dos
  requisitos que faltam; o custo normal da técnica continua. Registro: "(o mestre forçou: faltava Melodia ligada)".
- **Reação**: requisito que espera alguém (G1, G2, J2) não vale na reação (cinza "Não dá na reação"); a caixa vale.

## 7. Rede: pedido ao aliado e "o mestre decide"

Tudo aditivo em `net/protocoloDaBatalha.ts` e `net/batalhaNoHost.ts`:

1. **Pedir**: o pedido de ação ganha `ajudaDe?: tokenId` (quem usa escolhe o aliado na lista dos que podem pagar). O
   host confere o resto; se só falta a ajuda, cria a pendência em `turnos.pedidosDeAjuda` (no molde da
   `FormaPendente`): id `ajuda_<uuid>`, o pedido congelado, quem pede, para quem (tokenId ou mestre), o requisito, a
   frase ("Vagn pede 30 SP para Chuva de Raios"), criado em, vence em. Nada é gasto ainda. Uma pendência por ficha.
2. **Quem vê**: pelo recorte, o dono da ficha pedida vê o cartão "Aceitar / Recusar" com o tempo correndo; quem pede vê
   "Esperando Aira... [Cancelar]"; o mestre vê todas e responde por qualquer um. NPC aliado e J2: o mestre.
3. **Responder**: pedido novo do tipo `responderAjuda` (com `ajudaId` e `aceita`), do dono da ficha pedida ou do
   mestre; e `cancelarAjuda` (com `ajudaId`), de quem pede ou do mestre.
4. **Aceite**: o host roda o pedido congelado pelo portão inteiro de novo (o estado pode ter mudado). Passou: uma linha
   só ("Vagn usou Chuva de Raios; Aira deu 30 SP") e o Desfazer dela volta os dois. Não passou: avisa os dois.
5. **Prazo**: `PRAZO_DA_AJUDA_MS = 60_000` para aliado; sem prazo para o mestre. O host varre a cada segundo (como a
   janela das miras, `batalhaNoHost.ts:207`) e passar a vez cancela. Resposta depois do prazo = "o pedido venceu". O
   primeiro evento que chega ao host vence.
6. **Salvar**: a pendência não entra na batalha salva; ao reabrir, cai com aviso.
7. **Treino do Lobby (Worker)**: sem mestre e sem relógio de servidor neste lote: G1, G2 e J2 ficam cinza "Só na mesa";
   a caixa J1 vale; forçar não existe.

## 8. Evolução e subida de Parte como efeitos genéricos

- **Evoluir (I3)**: a base ganha `requisitos.evoluir`. O botão Evoluir fica cinza com o motivo até cumprir; ao apertar,
  gasta o que o grupo gasta, põe a base em `evoluidas` e a técnica vira a versão super/Overload. Usada uma vez, a base
  sai de `evoluidas` (`semEvoluida`) e volta a comum: o que `voltaDepoisDoOverload` faz hoje, agora para toda evolução
  com bloco. Evolução sem bloco segue exatamente como hoje.
- **Sobe uma Parte (I1)**: a técnica com `aoUsar.sobeParte` liga a Parte seguinte do grupo da forma de onde vem
  (`subidaDeParte` lê o bloco em vez da tabela; os mesmos motivos de hoje).
- **Uma Parte por vez e só liga por X (I2)**: `forma.partesEmOrdem` substitui a tabela em `motivoDaOrdemDasPartes`;
  `forma.soLigaPor` deixa o Ativar cinza ("Só liga com o Grito") e a técnica listada liga a forma ao ser usada, se o
  `usar` da forma for cumprido.
- **Precedência durante a troca**: cartão com bloco manda; sem bloco, a tabela à mão. A fase H tira da tabela os três.

## 9. Editor

- **`components/batalha/blocos/BlocoDosRequisitos.tsx`** (novo), usado em `MecanicaDaTecnica.tsx`, no editor do cartão
  de texto, em `EntradaDoCatalogoDialog.tsx`, no editor do item do Acervo e no da forma. Grava sempre no campo
  `requisitos` do cartão ou da entrada, nunca na mecânica.
- Lista "Todos estes" com "+ Requisito" (os 10 grupos da lista, com busca) e "+ Um destes". Cada linha: a frase, os
  números, "não ter" e "gasta" (só onde vale). As regras que já existem aparecem em cinza "vem da mecânica: Limite".
- Na base de evolução, "Para evoluir"; na forma, "Para ligar", "Uma Parte por vez" e "Só liga com a técnica"; na
  técnica de forma com Partes, "Ao usar, sobe uma Parte".
- **Testar**: o ensaio mostra ok/falta de cada requisito contra o boneco, com chaves para simular o que o boneco não
  tem (andou, apanhou, aliado perto, luz).

## 10. Menu e caixas

- Técnicas, Armas, Itens, Transformação e o botão Evoluir: cinza com o motivo curto; tocar abre a lista com ok/falta
  por requisito. O mestre vê "Usar mesmo assim".
- Com `pergunta`: clicável, com etiqueta ("pede ajuda", "Cumpriu?", "teste"). Ao usar, nesta ordem: escolha do "Um
  destes"; a caixa "Cumpriu: (texto)?" com "Sim, cumpri" e "Não"; a escolha do aliado; a mira de sempre.
- Visual, textos e animação: os do protótipo aprovado (revisão do `designer-opus`).

## 11. Os antigos: proposta, cópia e Confirmar

1. O `especialista-dados` (só leitura) lê uma CÓPIA do `rpg.json` e dos catálogos (texto, extras como "Condições da
   evolução", frases "só com", "apenas se", "gasta") e escreve fora do repo, na pasta de dados do app,
   `requisitos-propostos.json`: id, nome, bloco proposto, o trecho que justifica, certeza alta ou baixa. O que não dá
   para conferir sozinho vira `personalizado` com o texto original.
2. As três regras à mão entram com certeza alta e o bloco exato: Caça às Bruxas (`evoluir`: Todos estes = Melodia
   ligada na opção do dano; Um destes = gastar 50 SP ou ajuda de aliado com fogo); cada Fúria do Dragão
   (`aoUsar.sobeParte`); cada Parte da Forma Híbrida (`forma.partesEmOrdem`).
3. Botão "Dar requisitos aos antigos" nas páginas Habilidades e Itens (`requisitos/antigos.ts`,
   `stores/requisitosDosAntigos.ts`, `components/livros/DarRequisitosAosAntigos.tsx`, no molde do alcance): lista por
   ficha, linha editável, "não mexer". Backup `.antes-dos-requisitos` de `rpg.json`, `catalogo.json` e `itens.json`
   uma vez, antes da 1ª gravação. Confirmar grava; Cancelar não grava; rodar de novo mostra só o que falta.
4. Textos e extras ficam onde estão: o bloco é a regra, o texto continua para ler.

## 12. Compatibilidade

| Quem | O que acontece |
|---|---|
| Mecânica | Continua na versão 3 |
| App de antes | Ignora o campo (técnica sem requisito) e pode apagá-lo ao salvar: app, site e Worker saem juntos (fase I) |
| Leitores | Conferir na B2 se a ficha (app e Worker `lerFicha`), o catálogo e o Acervo guardam a chave nova (o Worker velho recusava chave nova no alcance) |
| Batalha salva antiga | Rastro ausente = zero; pendência nunca é salva |
| Pedido de ação | Campos opcionais (`ajudaDe`, `forcarRequisitos`) e tipos novos; o jogador usa o pacote do próprio host |
| Portão de ouro | Em toda fase que toca o motor: 269 leituras e 122 ensaios iguais na cópia do `rpg.json`. E o portão novo: os cenários das três regras à mão dão o mesmo veredito e o mesmo motivo antes e depois da troca |

## 13. Fases

Direto na main, no máximo 3 escritores ao mesmo tempo e só em arquivos que não se cruzam; cada um commita só os
próprios caminhos. Teste automático novo só se o dono pedir (regra de 27/10): a conferência é por script de rascunho
em `tmp/requisitos-fase-X/` e pelo app. Toda fase fecha com `rtk proxy npx tsc --noEmit` limpo (client e lobby/nuvem).

| Fase | Quem | Arquivos | Pronto quando |
|---|---|---|---|
| **A. Modelo e frases** | `programador` | `lib/batalha/requisitos/modelo.ts`, `ler.ts`, `frases.ts` (inclui os tipos da pendência de ajuda, para E e G não esperarem) | O script lê e relê os 39 tipos (com `nao` e `gasta`), recusa bloco torto sem derrubar, e as frases do Caça às Bruxas batem com a lista |
| **B1. Avaliador** (junto com B2 e B3) | `programador` | `requisitos/avaliar.ts`, `contexto.ts`, `gastos.ts` | Estados montados no script: cada tipo dá ok, falta e (onde cabe) naoSei; o Caça às Bruxas dá "falta" sem Melodia, "pergunta" com Melodia e 20 SP, "cumpre" com 50 SP |
| **B2. Disco e leitores** | `programador` | `lib/personagem.ts`, `lib/livros/catalogo.ts`, Acervo, `stores/armasNaFonte.ts`, Worker `lerFicha`, `vistaDoJogador.ts` | Ficha, entrada e item com `requisitos` abrem, salvam e reabrem iguais no app, no site e no Worker; o jogador não recebe bloco de NPC |
| **B3. Rastro** | `programador` | `combate.ts` (só o rastro), `registro.ts` (`combateSemALinha`), os pontos que andam, acertam e dão dano | Na Arena: andar 3, atacar, errar, apanhar e cair mudam o rastro; Desfazer de cada linha volta o rastro exato; batalha salva antiga abre; portão de ouro igual |
| **C. Portão no host** | `programador` | `acoes.ts`, `golpe.ts`, `itemNaBatalha.ts`, `transformacao.ts` e `escolhaEEvolucao.ts` (só o portão), leitor do pedido em `protocoloDaBatalha.ts`, `lib/treino/*` | Arena: "polaridade 2" cinza com "Falta: polaridade 2, tem 1" no menu e recusada no host; com 2 sai e gasta; o mestre força e o registro diz o que faltava; caixa "sim" sai com "(declarou: ...)"; teste falho perde a ação; Desfazer devolve tudo; portão de ouro igual |
| **D. Evolução e Partes em dados** | `programador` | `escolhaEEvolucao.ts`, `transformacao.ts`, `acoes.ts`, `mecanicasAMao.ts` | Numa cópia com os blocos dos três casos: Sieg evolui só com Melodia mais 50 SP (ou ajuda), a Super usada volta a comum; Fúria sobe 1, 2, 3 e na 3 diz "Já está na última Parte"; portão das três regras igual; a tabela ainda vale para cartão sem bloco |
| **E. Rede da ajuda** (junto com F e G) | `programador` | `net/protocoloDaBatalha.ts`, `net/batalhaNoHost.ts`, `turnos.pedidosDeAjuda`, recorte | Visão de teste com 2 jogadores: Vagn pede 30 SP, Aira aceita, sai uma linha e o Desfazer volta os dois; recusa, cancelar, prazo e passar a vez fecham a pendência; NPC aliado cai no mestre; resposta atrasada recusada |
| **F. Editor** (junto com E e G) | `programador-frontend` | `blocos/BlocoDosRequisitos.tsx`, `MecanicaDaTecnica.tsx`, editor do cartão de texto, `EntradaDoCatalogoDialog.tsx`, editores do item e da forma, ensaio | Montar o Caça às Bruxas e a Forma Híbrida pela tela, salvar e reabrir igual; Testar mostra ok/falta; nenhuma tarefa longa de 200 ms ou mais |
| **G. Menu e caixas** (junto com E e F) | `programador-frontend` (revisão do `designer-opus`) | `ListaDeTecnicas`, `dadosDoMenu.ts`, tiras de Armas, Itens e Transformação, botão Evoluir, caixas novas | Prints iguais ao protótipo (cinza com motivo, lista ok/falta, "Cumpriu?", escolha do aliado, cartão do pedido, Esperando); o mestre tem "Usar mesmo assim"; naoSei aparece como "o mestre confere" |
| **H. Os antigos** | `especialista-dados` (proposta), `programador-frontend` (tela) | `requisitos/antigos.ts`, store e tela do botão, entradas da tabela à mão | Backup existe antes da 1ª gravação; Confirmar grava; os três casos saem da tabela e o portão das três regras segue igual; rodar de novo lista só o que faltou |
| **I. Publicar e jogar** | `automacao-devops`, `verificador-realidade` | `scripts/publicar-versao.cjs`; app, site e Worker juntos | Item por item contra o texto do PEDIDOS de 23/11; o dono joga o Sieg e a Ryoko numa rodada com mestre e 2 jogadores e diz se o cinza, o pedido ao aliado e a caixa fizeram sentido |

Ordem: A; B1, B2 e B3 juntas; C; D; E, F e G juntas (F e G só depois do protótipo aprovado); H; I. Na fase C entra o
diagrama `docs/diagrams/requisitos.html` (pedido, avaliador, portão, gastos) com a linha no INDEX.

## 14. Riscos e como ver cedo

| Risco | Como aparece | O que fazer |
|---|---|---|
| Desfazer não volta o rastro | "Andou" ou "apanhou" errado depois de um Desfazer | `combateSemALinha` campo por campo na B3, com o caso no script |
| Duas regras vivas (tabela e bloco) | A Ryoko sobe duas Partes de uma vez | "Bloco manda" na fase D; a tabela sai na H; portão das três regras |
| Menu e host discordam | Jogador vê liberado e o host recusa | Mesma função; o que o jogador não vê é `naoSei` ("o mestre confere"), nunca "ok" |
| Motivo revela coisa escondida | "Alvo acima de 25%" entrega a vida de um NPC | O motivo de alvo só sai para quem já vê a barra dele; senão "O alvo não cumpre o requisito" |
| Corrida no pedido ao aliado | Aceite chega com o prazo vencido ou depois de passar a vez | O host é um só: o primeiro evento vence; o aceite roda o portão inteiro de novo |
| App ou Worker velho apaga ou recusa o campo | O requisito some depois de editar no site | Conferir os leitores na B2; publicar os três juntos (I) |
| Proposta errada nos antigos | Técnica travada à toa | Certeza baixa destacada, edição por linha, backup, Confirmar; o mestre sempre pode forçar |
| Menu lento com muitas técnicas | Quadro travando ao abrir a Tira | Resultado guardado por `turnosRev`; luz só calculada quando um requisito pede |
| Jogador marca a caixa sem cumprir | Abuso da caixa | É social: a linha "(declarou: ...)" fica destacada para o mestre, que desfaz |
