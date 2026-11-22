# Armas: o que ela faz, numa fonte só (22/11/2026)

Plano do arquiteto-solucoes para o pedido de 22/11 11h25 (literal no PEDIDOS.md) e as 4 respostas do dono.
Nada de código aqui. Implementa o `programador` (lib e rede) e o `programador-frontend` (telas), Opus 5.5 xhigh.

## Em uma página

- **A fonte é a entrada de ARMA do catálogo do livro** (`livros/<sistema>/catalogo.json`, `lib/livros/catalogo.ts`).
  Ela já é a REGRA no desenho COISA x REGRA (`lib/livros/coisaERegra.ts`): dano, efeito, balas e `mecanica`.
- **A ligação é o `itemId` que já existe**: cartão da aba Armas `itemId` = `acervoId` da entrada = id da coisa no Acervo.
  Nenhum campo novo no disco nem no fio: app 0.5.90/0.5.91 e Worker velho não apagam nada.
- **Cópia travada, não referência na batalha.** O cartão da ficha continua levando a `mecanica` e os campos (é o
  que o host, o jogador e o app velho leem hoje). Só que essa cópia só é escrita pela fonte: salvar a arma em
  QUALQUER um dos 3 lugares grava a entrada e reescreve todas as cópias na hora; abrir a pasta conserta a cópia
  que divergiu (a fonte ganha). O host lê a cópia, que é igual à fonte por construção.
- **20 modelos de arma** no "O que ela faz", a mesma tela do item (`MecanicaDaTecnica`, `doQue="arma"`).
- **A batalha já conta os usos** (menu mostra "1/3 usos", host bloqueia no 4º, Desfazer devolve): só muda a frase
  para "Restam 2 de 3".
- **Boomerang:** já está igual no livro e na ficha do Vincent (conferido no disco do dono, só leitura); falta ligar o
  cartão (`itemId`), tirar a frase velha "(à mão até o app ter efeito de arma com usos)" e mostrar no Acervo.

## 1. O que existe hoje (conferido no código e no disco do dono, só leitura)

| Lugar | Guarda o quê da arma | Arquivo |
|---|---|---|
| Cartão da aba Armas | `campos` (dano, efeito, categoria, Soma no ataque), `mecanica`, `itemId?`, balas (subcartões) | `lib/personagem.ts:47` |
| Entrada do catálogo (lápis) | `campos`, `balas`, `mecanica`, `acervoId?` | `lib/livros/catalogo.ts:51` |
| Coisa do Acervo | nome, imagem, descrição, categoria "Arma", `municoes`; o `efeito` é só de item | `lib/acervoDeItens.ts:80` |
| Vaga da mochila | a coisa dada, com `itemId` | `types/map.ts` |

- Editor da mecânica da arma: só na ficha (`FichaAbas.tsx:866`). O diálogo do catálogo só carrega a `mecanica` de
  volta (`EntradaDoCatalogoDialog.tsx:214`), não edita. O Acervo não mostra nada para arma.
- Modelos da arma: 2 (`mecanica/arma.ts:57`, `atordoa` e `golpeComSelo`). O que a arma aceita está em
  `motivoDaArmaNasPecas` (`arma.ts:28`): alvo inimigo, forma `um` ou `varios`, reação normal ou não erra, custo só ao
  usar, sem Overload. **Área pela grade e teste de resistência (metade se passar) a arma RECUSA hoje.**
- Disco do dono (22/11): catálogo One Piece com 13 armas, 1 ligada (Boomerang, `acervoId item_54cf…`) e 1 montada;
  fichas com 13 cartões de arma, **0 com `itemId`**, 1 montado (Boomerang do Vincent: mecânica igual à do catálogo,
  campos iguais, frase velha nos dois); a vaga do Boomerang na mochila tem o `itemId`; o Acervo está no índice v4,
  sem efeito em nada. O que o dono viu ("à mão até...") é a frase velha, que os dois lugares ainda dizem.

## 2. Decisão 1: onde mora a verdade

| Abordagem | Prós | Contras | |
|---|---|---|---|
| A. Entrada do catálogo + cópia travada no cartão | É a REGRA do desenho de hoje; por sistema (a fórmula usa atributos do sistema); o Boomerang já está lá; zero campo novo; host e app velho seguem lendo o cartão | A cópia existe: precisa de escrita única e conserto ao abrir | **Escolhida** |
| B. Coisa do Acervo (como o efeito do item) | Igual ao item | O Acervo é de todos os sistemas e a fórmula é do sistema; dano, balas e texto ficam no livro: a regra partida em 2 lugares é o problema de volta | Rejeitada |
| C. Referência por id resolvida no host a cada golpe | Sem cópia | O menu do jogador calcula pela ficha dele (usos, motivo) e discordaria; 0.5.90 perde a mecânica; o host precisaria do catálogo carregado na batalha | Rejeitada |

**Regra única:** a entrada de arma é a fonte de TUDO o que a arma faz: `mecanica`, os campos da aba Armas e as balas.
O cartão ligado é cópia; nenhum caminho de escrita grava a cópia sem passar pela fonte.

**O que é da ficha e nunca é sobrescrito:** `id` do cartão (os usos, a batalha salva e os caminhos do Lobby são por
ele), `armaPadrao`, `municaoPeloNome`, `oculta`/`revelaAoUsar`, `mecanicaProposta` (vira pedido ao mestre), a imagem, e
nas balas o `id` e a ligação (`itemId`, `municaoPeloNome`) de cada subcartão, casado pelo nome.

**Fluxo:**
```
editar em 1 dos 3 lugares -> gravarRegraDaArma(entrada) -> catalogo.json (fonte)
   -> mundo.mudar: cada cartão com itemId = entrada.acervoId recebe comARegraDaArma(cartao, entrada)
   -> fichas (rpg.json) -> LAN (host manda a ficha) e Lobby (ops do mestre: mecanicaDoCartao, textoDoCartao)
abrir a pasta -> conferirArmas(fichas, catalogo) -> cópia diferente? a fonte ganha (com backup, seção 4)
batalha -> host lê o cartão (= fonte) -> armaNaVez / motivoDaArmaNaVez de hoje
```

**Na batalha, o host:** nada muda no motor. Ao começar a batalha, o host roda `conferirArmas` nas fichas da luta
(barato: 13 cartões), para cobrir a cópia mexida por app velho ou Lobby antes da 1ª jogada.

**Itens (pergunta do coordenador):** sim, o item tem o mesmo buraco: o "Atualizar as cópias" é manual
(`PaginaItens.tsx:1029`), então a vaga pode dizer um efeito e o Acervo outro. Compartilhar é pequeno: chamar o
`fichaComOEfeitoDoItem` (`lib/mochila/efeitoNasCopias.ts`) sozinho ao salvar a coisa e ao abrir a pasta. Fica na F6,
recomendada, com o ok do dono (muda o comportamento de um botão que ele já conhece).

## 3. Decisão 2: arma sem ligação

| Caso | O que acontece |
|---|---|
| Só na ficha (sem entrada de mesmo nome, sem `itemId`) | O cartão é a fonte dele mesmo: um lugar só não diverge. Edita no cartão como hoje. Selo "Só nesta ficha" e botão "Levar ao livro" (cria entrada + coisa + liga) |
| Só no livro (entrada sem coisa e sem ficha) | A entrada é a fonte. O "Pôr em" cria antes a coisa no Acervo (categoria Arma, mesmo nome) e liga; daí vira o caso ligado |
| Ligada (entrada com `acervoId`) | Fonte = entrada; cartões e Acervo mostram e editam a mesma |
| Só na mochila, coisa com regra no livro | O conserto ao abrir põe o cartão (o que o "Pôr em" da coisa já faz, `porCoisaNaFicha`) |
| Só na mochila, coisa sem regra | Como hoje: à mão (`armaDaMochila`, dano digitado) |
| Coisa do Acervo sem regra neste sistema | O "O que ela faz" no Acervo cria a entrada ligada ao salvar |
| Mesmo nome em 2 fichas, sem entrada | NÃO junta sozinho (podem ser duas facas diferentes); aparece na lista do "Juntar as armas" como opção |

**Por que criar a coisa no Acervo em vez de um campo `regraId` no cartão:** campo novo seria apagado pelo app
0.5.90/0.5.91 ao gravar e recusado pelo Worker velho (tabela fechada de campos em `lib/nuvem/caminho.ts:96`). O
`itemId` já atravessa tudo desde a Fase 5. Custo: algumas coisas novas no Acervo (a contagem sai no ensaio da F2;
decisão do Claude para o dono confirmar).

## 4. Decisão 3: migração

**Botão "Juntar as armas" na página Itens do livro**, com ensaio antes: mostra a lista e só grava no "Confirmar".
Depois, o conserto ao abrir usa as mesmas regras sem perguntar (só os casos 1 a 3 abaixo; conflito sempre espera).

**Backup primeiro, como `itens.json.antes-dos-efeitos`:** antes da 1ª gravação, uma vez e nunca por cima:
`catalogo.json.antes-das-armas`, `rpg.json.antes-das-armas` em cada pasta e, se criar coisa,
`itens.json.antes-das-armas`. Sem a cópia, nada se grava (mesma regra de `acervoDeItens.ts:439`).

**Pareamento** (`lib/livros/regraDaArma.ts`, puro): cartão e entrada formam par se (a) `cartao.itemId` =
`entrada.acervoId`; senão (b) a mochila da ficha tem vaga com `itemId` = `acervoId` e o cartão tem o nome da entrada
(o Vincent); senão (c) uma única entrada de arma tem o nome do cartão (`chaveDoNomeDaEntrada`).

| # | Situação | Regra |
|---|---|---|
| 1 | Cartão e entrada iguais (mecânica, campos, balas) | Liga (`cartao.itemId`); entrada sem coisa ganha a coisa |
| 2 | Entrada montada, cartão sem mecânica e campos iguais | A entrada vai ao cartão |
| 3 | Cartão montado, entrada sem mecânica, 1 cartão só | O cartão vai à entrada (o que `mecanicasDasFichas` já faz) |
| 4 | Duas ou mais versões diferentes (entrada x cartão, ou cartão x cartão) | **Conflito:** lista lado a lado com o resumo de cada uma ("Livro", "Ficha do Vincent"); o mestre escolhe a que vale ou "Separar" (o cartão vira "Só nesta ficha", sem ligação). Nada automático |
| 5 | Só o campo de texto difere (ex.: Dano 10 x 20 do Rifle do Alexei) | Mesmo que 4: o texto também é "o que a arma faz" |
| 6 | Duas entradas de arma com o mesmo nome | Não liga por nome; vai à lista ("ligue à mão") |
| 7 | `acervoId` aponta para coisa apagada | A entrada segue fonte; a coisa é recriada com o mesmo id só se o mestre mandar |
| 8 | Cartão com `mecanicaProposta` | Fica; aceitar a proposta grava na fonte |
| 9 | Ficha de pasta fechada | Conserta quando a pasta abrir (`mundoDoLivroStore` é uma pasta por vez) |

**O Boomerang:** caso 1 (conferido). A F2 liga o cartão do Vincent ao `item_54cf…`, tira o trecho
" (à mão até o app ter efeito de arma com usos)" da fonte (o `conserto-fichas-f0.cjs:116` já queria isso) e a
propagação leva ao cartão. O Acervo passa a mostrar "O que ela faz: 1 inimigo reage; se acertar, Atordoado. Até 3
usos por batalha." Prova: as 3 telas mostram a mesma frase, e a 2ª rodada do "Juntar" muda 0.

## 5. Decisão 4: os 20 modelos

Em `lib/batalha/mecanica/modelosDaArma.ts` (novo), com grupos como os do item. Os ids `atordoa` e `golpeComSelo` ficam
(o `.cjs` do conserto copia o `atordoa`). Todos passam no `motivoDaArmaNasPecas` de hoje. "Dano" = Dano da arma pela
fórmula do Atacar dela (`formulaDaArma`). Coluna v: 1 = lê em 0.5.90; 2 = pede 0.5.91+ (o 0.5.90 recusa com "atualize
o app", sem apagar). A F1 confere a versão gravada de cada um com `guardarMecanica`.

| Nº | Nome | Dica (1 linha) | Peças | v |
|---|---|---|---|---|
| A01 | Atordoa sem dano | Se acertar, Atordoado. 3 por batalha | reação; sem dano; selo Atordoado 1; usos 3 | 1 |
| A02 | Golpe com efeito | Dano e Sangrando no acerto. 2 por batalha | reação; dano; Sangrando 3; usos 2 | 1 |
| A03 | Lâmina que Sangra | Todo acerto deixa Sangrando | reação; dano; Sangrando 3; livre | 1 |
| A04 | Ponta em Brasa | Dano e Queimando; espera 2 vezes | reação; dano; Queimando 2; recarga 2 | 1 |
| A05 | Punhado de Areia | Sem dano: Cego no acerto. 2 por batalha | reação; sem dano; Cego 2; usos 2 | 1 |
| A06 | Mira do Caçador | Dano e Marcado por 3 vezes | reação; dano; Marcado 3; usos 3 | 1 |
| A07 | Descarga Paralisante | Dano e Paralisado. 1 por batalha | reação; dano; Paralisado 1; usos 1 | 1 |
| A08 | Rede de Pesca | Sem dano: Paralisado por 2. 1 por batalha | reação; sem dano; Paralisado 2; usos 1 | 1 |
| A09 | Golpe na Fresta | Perfurante: vai direto à vida. 2 por batalha | reação; dano perfurante; usos 2 | 1 |
| A10 | Fura-Couraça | Metade do dano vai direto à vida | reação; dano perfurante, perfuração 50; livre | 2 |
| A11 | Golpe e Volta | Dois golpes: o 2º com metade do dano | reação; dano; 2º golpe fração 0,5; recarga 2 | 2 |
| A12 | Arco Largo | Até 3 inimigos marcados na mira. 2 por batalha | reação; vários máx 3; dano; usos 2 | 1 |
| A13 | Leque de Lâminas | Até 3 inimigos, o dano dividido | reação; vários máx 3 dividir; dano; livre | 1 |
| A14 | Lâmina Sedenta | 30% do dano volta como vida. 3 por batalha | reação; dano; dreno HP 30; usos 3 | 2 |
| A15 | Tiro Certeiro | Não erra. 1 por batalha | não erra; dano; usos 1 | 1 |
| A16 | Golpe Pesado | Custa 20 SP; perfurante | reação; custo SP 20 ao usar; dano perfurante; livre | 1 |
| A17 | Preço de Sangue | Custa 10 de vida; dano e Sangrando | reação; custo HP 10 ao usar; dano; Sangrando 3; livre | 1 |
| A18 | Caçada ao Marcado | Só vale em quem está Marcado; perfurante | reação; exige selo Marcado; dano perfurante; livre | 2 |
| A19 | Pancada Atordoante | Dano e Atordoado; espera 3 vezes | reação; dano; Atordoado 1; recarga 3 | 1 |
| A20 | Pó Cegante e Corte | Dano, Sangrando e Cego. 1 por batalha | reação; dano; Sangrando 3 + Cego 2; usos 1 | 2 |

Grupos: **Sem dano** (A01 A05 A08), **Golpe e selo** (A02 A03 A04 A06 A07 A17 A19 A20), **Golpe forte** (A09 A10
A11 A14 A15 A16 A18), **Vários** (A12 A13). Nomes originais (nada de FF/RE).

**Fora desta leva, de propósito:** "área pela grade" e "metade se passar no teste". O motor resolve os dois na
técnica, mas o Atacar com arma os recusa (`arma.ts:34-35`). Abrir isso é mexer na mira do Atacar (grade "Onde cai" e
d20 de resistência), outra fatia (F7 sob demanda), com 2 modelos prontos: "Granada de Mão" (raio 1 num ponto) e
"Veneno no Fio" (resistência, metade se passar).

## 6. Decisão 5: o editor nos 3 lugares

Um componente só, `components/EfeitoDaArmaCampos.tsx` (novo), irmão do `EfeitoDoItemCampos.tsx`: monta um cartão de
leitura com a mecânica da entrada e põe o `MecanicaDaTecnica doQue="arma"`. Em cima, a frase "Vale em todo lugar: livro,
Acervo e N fichas"; embaixo, "Testar" (ver seção 7).

| Lugar | Arquivo | Mudança |
|---|---|---|
| Lápis do catálogo | `components/livros/EntradaDoCatalogoDialog.tsx` | Seção "O que ela faz" na arma; salvar = `gravarRegraDaArma` |
| Acervo, coisa de categoria Arma | `components/ItemDoCatalogoDialog.tsx` | Mostra `EfeitoDaArmaCampos` da regra do sistema ativo (`regraDaCoisa`); sem regra, cria ao salvar. O "O que ele faz" do item SOME para arma (2 efeitos = 2 verdades) |
| Cartão da ficha | `components/FichaAbas.tsx:866` | Cartão ligado: o `onChange` da mecânica e dos campos de regra vai a `gravarRegraDaArma`; selo "Do livro" com "muda em N fichas". Cartão solto: como hoje |
| Modelos no editor | `components/batalha/MecanicaDaTecnica.tsx:74` | Os 20 com os 4 grupos, como os do item |
| Cartão do livro | `components/livros/PaginaItens.tsx` | Frase "O que ela faz" no cartão da arma + "Juntar as armas" e a lista de conflitos. **Esperar o commit do designer** que mexe no `CartaoDaEntrada` agora |
| Lógica | `lib/livros/regraDaArma.ts` (novo), `stores/catalogoStore.ts` | Pareamento, `comARegraDaArma`, `conferirArmas`, `gravarRegraDaArma` (entrada + `mundo.mudar`) |

O jogador (dono da ficha) segue propondo (`mecanicaProposta`); o mestre aceita e isso grava na fonte.

## 7. Decisão 6: batalha

**Já existe** (sem mudar o motor): usos por arma em `combate.usos[arma.id]` (`acoes.ts:302-308`), conta em
`depoisDaTecnica` (`golpe.ts:535`), mesma regra na tira e no host (`motivoDoAtacarComArmaMontada`, `golpe.ts:371`),
Desfazer pelo registro `combate` antes/depois (`registro.ts:136`), zera na batalha nova, recarga idem.

**Falta:**
- Frase: a tira da arma diz "1/3 usos" (gastos). Trocar só na arma (`golpeDaArmaMontada`, `dadosDoMenu.ts:1303`)
  para "Restam 2 de 3"; a técnica fica como está (não mexe no portão das 241).
- Testar da arma: o botão some quando `naArma` (`MecanicaDaTecnica.tsx:287`). Ligar o Testar no boneco pelo caminho do
  Atacar (o ensaio já acha a arma padrão, `ensaio.ts:581`). Se o ensaio não souber atacar com arma montada, fica
  fora e a prova vai pela Arena.
- O `id` do cartão nunca muda na propagação: senão os usos gastos voltam a 0 no meio da luta.

## 8. Decisão 7: rede e privacidade

- **O jogador recebe o que já recebe:** o cartão da ficha dele com a `mecanica` (`caminho.ts:241`,
  `visivelAoJogador: true`). Precisa dela para o menu (usos, motivo) e o app 0.5.90 também. Esconder como o item
  quebraria os dois; não recomendo.
- **O que nunca sai do app do mestre:** o catálogo, o Acervo e a regra de arma que não está na ficha do jogador; o
  cartão oculto (fatia C7). Nada disso muda.
- **Buraco que este plano abre e fecha:** como a fonte é achada pelo `itemId`, quem muda o `itemId` do cartão escolhe
  qual regra o host copia para ele. Hoje o Lobby deixa o dono mudar (`caminho.ts:235`, `donoOuMestre`). Fechar:
  1. Lobby: `itemId` do cartão só do mestre, também dentro do cartão novo (como a vaga, `caminho.ts:139` e `:391`);
     campos de regra de cartão ligado só do mestre (`permissao.ts`, como `sobeItemComEfeito`). Frase: "Arma do livro:
     só o mestre muda o que ela faz". **Worker e site saem junto com o app.**
  2. LAN: o host já fica com o `itemId` e a `mecanica` dele (`net/edicaoDoPersonagem.ts:245`); falta ficar também com
     os campos de regra do cartão ligado (a edição do jogador neles é descartada, com aviso no app do mestre).
  3. Rede de segurança: `conferirArmas` no host ao abrir e ao começar a batalha.

## 9. Fases

F1 e F2 com 1 dono em sequência (mesma lib); depois até 3 escritores em caminhos disjuntos, direto na main, cada um
commita só os próprios caminhos. Testes: no máximo 2 por situação (regra do Labirinto de 06/11); o portão das
fichas (harness "portao" no scratchpad, ver HANDOFF) conta como 1.

**F1. Lib pura (programador).** `lib/batalha/mecanica/modelosDaArma.ts`, `arma.ts` (reexporta), `lib/livros/regraDaArma.ts`.
Aceite: os 20 passam em `armaLida` como `pecas` e o `guardarMecanica` dá a versão da tabela; `comARegraDaArma`
mantém `id`, `armaPadrao`, `municaoPeloNome` e os ids das balas; o par do Vincent sai "iguais"; nada ligado ainda,
então portão 241 cartões = 0 diferenças; tsc 0.

**F2. Gravação, conserto e migração (programador).** `stores/catalogoStore.ts`, `lib/livros/catalogoNoDisco.ts`
(backup), `stores/mundoDoLivroStore.ts` (conserto ao abrir e ao começar a batalha), `lib/acervoDeItens.ts` (criar
coisa + backup). Aceite numa CÓPIA dos dados do dono: o ensaio lista o Boomerang no caso 1 e a contagem dos outros;
os backups batem byte a byte com o de antes; depois do Confirmar, o cartão do Vincent tem o `itemId` e a frase nova;
2ª rodada muda 0; portão: técnicas 0 diferenças, armas só as da lista do ensaio.

**F3a. Editor nos diálogos (programador-frontend)**, em paralelo com F3b e F4.
`components/EfeitoDaArmaCampos.tsx`, `components/batalha/MecanicaDaTecnica.tsx`, `EntradaDoCatalogoDialog.tsx`,
`ItemDoCatalogoDialog.tsx`. Aceite no navegador: trocar o Boomerang para 2 usos no lápis e ver 2 no Acervo e na
ficha do Vincent sem recarregar; arma não mostra o "O que ele faz" de item; nenhuma longtask >= 200 ms.

**F3b. Ficha e livro (programador-frontend)**, só depois do commit do designer no `PaginaItens.tsx`.
`components/FichaAbas.tsx`, `components/livros/PaginaItens.tsx` (e o CSS dele). Aceite: selo "Do livro" e "Só nesta
ficha"; editar no cartão ligado muda o livro; "Juntar as armas" com ensaio e lista de conflitos ("Separar" funciona).

**F4. Rede (programador).** `net/edicaoDoPersonagem.ts`, `lib/nuvem/caminho.ts`, `lib/nuvem/permissao.ts` e os
testes de nuvem que já existem. Aceite: op do jogador em `itemId` de cartão e em campo de arma ligada recusada com a
frase; cartão novo com `itemId` vindo do jogador recusado; LAN: a edição do jogador num campo de arma ligada não
fica; tsc 0 no client e em `lobby/nuvem`; vitest de nuvem passa.

**F5. Batalha (programador)**, depois da F2. `components/batalha/dadosDoMenu.ts` (frase da arma) e o Testar da arma
se o ensaio couber. Aceite na Arena: Boomerang com 3 usos, o 4º recusa "Já usada nesta batalha", Desfazer volta a
"Restam 1 de 3"; A11 e A14 resolvem (2 golpes; vida volta a quem bate).

**F6. Itens iguais (opcional, com o ok do dono)**, depois da F3. `PaginaItens.tsx` (o botão vira conferência),
`ItemDoCatalogoDialog.tsx` (salvar propaga), `mundoDoLivroStore.ts` (conserto ao abrir), com `efeitoNasCopias.ts`.

**F7 (sob demanda).** Área pela grade e teste de resistência na arma, mais os 2 modelos da seção 5.

**Publicar.** App, Worker e site juntos (a F4 muda `lib/nuvem`, que o Worker importa). Antes, o
`verificador-realidade` audita item por item contra o literal do PEDIDOS.

## 10. Riscos e como ver cedo

| Risco | Como ver cedo | Saída |
|---|---|---|
| Propagação apaga uma versão de propósito de uma ficha (arma de mesmo nome com regra própria) | O ensaio da F2 lista os conflitos antes de gravar | Escolha do mestre, "Separar", backups `.antes-das-armas` |
| Propagação recria o cartão com outro `id` (usos zeram; no Lobby vira apagar + criar) | Teste da F1 de id igual; diff do Lobby na F2 só com `mecanica` e `campos` | `comARegraDaArma` só troca campos, nunca monta cartão novo |
| Jogador repontando o `itemId` pelo Worker velho ganha a regra de outra arma | Teste da F4 | Worker sai junto; o host também confere o `itemId` contra a mochila do dono |
| App 0.5.90/0.5.91 edita a cópia; o app novo desfaz ao abrir | Aviso no app do mestre ("voltei a arma X ao que diz o livro") | Nota da versão |
| Arma de modelo v2 recusada no jogador com 0.5.90 | A tira mostra "atualize o app" | Nota da versão |
| O catálogo é por sistema: Acervo aberto em outro sistema não acha a regra | O Acervo diz "sem regra no livro deste sistema" | Criar ali liga a coisa ao livro daquele sistema |
| Designer em voo no `PaginaItens.tsx` | `git status` antes da F3b | F3b só depois do commit dele |
| Disco (11 GB livres em 22/11, piso 8) | Conferir antes da F2 e do publicar | Os backups são de KB |

## 11. Nota da versão (aviso)

> Armas: o que a arma faz agora mora no livro e vale igual no livro, no Acervo e em todas as fichas. Atualize o app do
> mestre, dos jogadores e o site juntos. App antigo não apaga nada (não há campo novo), mas: (1) no app 0.5.90, arma
> com modelo novo fica recusada com "atualize o app"; (2) se alguém mudar a arma ligada num app antigo, o app novo
> volta ao que o livro diz ao abrir. Cópias de antes: `catalogo.json.antes-das-armas`, `rpg.json.antes-das-armas`,
> `itens.json.antes-das-armas`.

## 12. Decisões do Claude, para o dono confirmar

1. A fonte é o livro (entrada de arma do catálogo), não o Acervo. O Acervo mostra e edita a mesma.
2. Arma que está em 2 lugares ou mais sempre tem coisa no Acervo (cria se faltar), para ligar sem campo novo.
3. Conflito nunca é decidido sozinho; texto diferente também conta como conflito.
4. Coisa de categoria Arma no Acervo perde o "O que ele faz" de item.
5. O jogador continua vendo a mecânica da arma da própria ficha (o menu dele precisa).
6. "Restam X de Y" só na arma; a técnica fica "1/3 usos".
7. Área pela grade e "metade se passar" ficam para a F7.
8. Itens recebem a mesma regra (F6) só com o ok.

## Próximo passo

O coordenador mostra ao dono a decisão 1, a lista dos modelos e as 8 decisões; com o ok, o `programador` (Opus 5.5
xhigh) faz a F1 com este arquivo e `docs/design/habilidades/SISTEMA.md` §2 e §5 como entrada.
