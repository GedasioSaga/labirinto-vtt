# Editor da habilidade novo: plano de construção (23/11/2026)

Plano do arquiteto-solucoes para o editor aprovado pelo dono em 23/11 ("gostei pode botar para jogo"). A especificação
são os dois protótipos: `editor/prototipo.html` + `editor/NOTAS.md` (direção C) e `requisitos/prototipo.html` +
`requisitos/NOTAS.md` (requisitos, evolução, Partes, pedido ao aliado, "Cumpriu?", tela 8 do Acumulador). Este plano
junta o editor ao `REQUISITOS.md` (as fases F e G de lá viram fases daqui), sem refazer o que `ALCANCE.md` e
`SISTEMA.md` já resolveram. Nada de código aqui. Implementam o `programador` (lib, motor, rede) e o
`programador-frontend` (telas, com revisão do `designer-opus`). Nenhum Rust.

## Em uma página

- **Um editor só para o cartão inteiro**, uma linha por pergunta (Ação, Golpe, Alcance, Dano, Acerto, Efeitos, Custo,
  Requisitos, Evolução, Jogadores, Campos extras) e, ao lado, o papel com a frase clicável, o mapa 13x13 e o Testar no
  boneco. Nasce em `components/batalha/editor/`, reaproveitando os controles dos `blocos/` de hoje.
- **Os campos de texto viram saída**: Ação, Tipo, Custo, Tempo, Dano e Efeito são escritos pelo app a partir das
  escolhas, num ponto só, sempre que a mecânica muda. Descrição continua texto livre. O motor segue lendo as peças.
- **O cartão só de texto não muda** até o mestre clicar em "Montar". Até lá os campos de texto ficam editáveis como
  hoje e a batalha lê o texto, como hoje.
- **O tipo do golpe é guardado como escolha** (`golpe` na mecânica) e vira peças de hoje na leitura do motor. Só duas
  peças são novas de verdade: o **teste do selo** ("com teste": o alvo rola para não pegar) e o **"+N no acumulador"**.
- **Mecânica versão 4**, gravada só quando a técnica usa golpe, teste do selo ou acumulador. O resto continua 1, 2 ou 3.
- **A categoria da ação não tem campo**: sai das peças (Simples, Completo, Overload, Apoio, Reação); Passiva é o
  cartão sem mecânica com Tipo "Passiva".
- **Envenenado, Congelado e Eletrizado** são selos montados com peças que já rodam; a tabela de selos por nome não muda
  (o portão de ouro fica igual).

## 1. O que existe hoje (conferido no código)

| Peça | Onde | O que importa para o plano |
|---|---|---|
| Editor das peças | `components/batalha/MecanicaDaTecnica.tsx` (489 linhas), `BlocosDaMecanica.tsx`, `blocos/*` (9 arquivos), `OsNumeros` | Usado em `FichaAbas.tsx:864` (técnica), `:891` (arma), `EfeitoDaArmaCampos.tsx:84` (catálogo), `EfeitoDoItemCampos.tsx:119` (Acervo) |
| Cartão na ficha | `FichaAbas.tsx` `CartaoEditavel` (:722) | Técnica montada esconde Ação, Custo, Tempo e Dano no dobrado "Texto antigo" (`CAMPOS_TROCADOS_PELAS_PECAS`, :338) |
| Texto gerado | `lib/livros/fraseDaArma.ts` `cartaoComOEfeitoDaMecanica` | Já escreve o Efeito da arma a partir da mecânica: é o molde do ponto único |
| Versões | `mecanica/modelo.ts`: `VERSAO_DA_MECANICA = 3`, `precisaDaVersao2/3`, `lerMecanica` | Chave desconhecida = mecânica inválida; versão maior = "atualize o app" (cartão à mão, nada se perde) |
| Leitores do motor | `mecanica/leitura.ts` (`pecasDoCartao`), `itemNaBatalha.ts`, `ensaioDoItem.ts`, `usarItemFora.ts`, `trazerDeOutraFicha.ts` | Os que chamam `lerMecanica` fora do editor |
| Selos | `condicoes.ts` (regra pelo nome: Atordoado, Cego, Sangrando, Queimando...), peças v2/v3 (`porTurno` HP e SP, `regra.curaRecebida`, `reageComDesvantagem`, `alcance`, `mods`) | Tudo o que os 3 selos novos precisam já roda como peça. Não existe teste por selo: o teste é da mecânica inteira |
| Testar | `lib/batalha/ensaio/ensaio.ts`, `components/ensaio/PainelDeEnsaio.tsx` | Já embutido no editor e no cartão lido; recebe um cartão de rascunho |
| Alcance | `components/batalha/alcance/` (`EscolhaDaForma`, `CampoDoAlcance`, `TestarDoAlcance`, `formaNaTela.ts`) | O mapa do papel é o mesmo do alcance |
| Acumulador | `requisitos/modelo.ts` (`AcumuladorDaFicha`, `PecaDoAcumulador`), avaliador da B1 lê o nível | Não existe motor (subir, cair, ganho); a Polaridade do Vagn ainda é `lib/batalha/contador.ts` |
| Modelos | `mecanica/modelos.ts`: 22, em Ataque, Cura e apoio, Condição, Reação | Viram "Começar de um modelo" |

## 2. Abordagens consideradas

| Ponto | Escolha | Rejeitadas |
|---|---|---|
| Tela | Componente novo por linhas, usando os controles de hoje por dentro | Reescrever tudo (perde o que já foi testado); remendar `MecanicaDaTecnica` (os degraus de hoje não cabem na direção C) |
| Tipo do golpe | Guardar a escolha (`golpe`) e expandir em peças só na leitura do motor | Gravar as peças soltas (a escolha se perde e o mestre edita o mesmo selo em dois lugares); motor que entende tipos (refaz o que já roda) |
| Categoria da ação | Sai das peças | Campo `categoria` (obrigaria a versão 4 em toda mecânica salva) |
| Selos novos | Peças de hoje com o nome do selo | Linha nova na tabela por nome (o "Envenenado" que os cartões de texto já põem ganharia regra: o portão de ouro muda) |
| Campos de texto | Escritos ao salvar, por uma função pura, num ponto só | Gerar na hora de ler (o app velho e o site não teriam); deixar editáveis (duas fontes) |
| Passiva | Cartão sem mecânica, Tipo "Passiva" | Peça vazia na mecânica (decisão de hoje: Passiva sem peças) |

## 3. Modelo de dados

### 3.1 Mecânica versão 4 (`lib/batalha/mecanica/modelo.ts` e `golpe.ts`)

```ts
// esboço: a 4 é a 3 com três acréscimos opcionais
interface MecanicaV2 { /* ...o de hoje... */ golpe?: GolpeDaMecanica }
interface GolpeDaMecanica {
  bate?: { tipo: "impacto" | "cortante" | "perfurante"; regra: RegraDoTipo }
  causa?: readonly { tipo: "queimadura" | "veneno" | "congelamento" | "choque" | "cegueira" | "enfraquecer" | "outro"; regra: RegraDoTipo }[]
}
interface RegraDoTipo {
  quando: "sempre" | "teste" | "soTipo"       // "só o tipo" = só dá nome ao golpe (Caça às Bruxas: fogo que não queima)
  teste?: { atributo: string; cd: CdDoTeste }   // só com "teste"
  vezes?: number; porVez?: number; casas?: number; porcento?: number; forca?: number; dano?: number; nome?: string
}
// Efeito "selo" ganha: pega?: { atributo: string; cd: CdDoTeste }   (o alvo rola; passou = não pega)
// Efeito novo: { tipo: "acumulador"; acumulador: Referencia; quanto: number; quando: "aoUsar" | "seAcertar" }
```

`precisaDaVersao4` = tem `golpe`, algum selo com `pega` ou algum efeito `acumulador`. `VERSAO_DA_MECANICA = 4`; quem grava
continua escolhendo a menor versão que cabe (1, 2, 3 ou 4). O selo que vem do tipo só cai em quem o golpe acertou. O
teto de 3 condições no mesmo golpe (`SELOS_NO_GOLPE_MAX`) vale para o tipo e os Efeitos somados.

### 3.2 O que cada tipo vira (padrões aprovados no protótipo; tudo mudável)

| Tipo | Peças que a leitura do motor monta | Peça nova? |
|---|---|---|
| Impacto | selo Atordoado 1 com `pega` Resistência CD 12; "Empurra N casas" = lembrete `aMao` | `pega` |
| Cortante | selo Sangrando 3, `porTurno` HP 10 direto | não |
| Perfurante | `dano.perfuracao` (100% = `perfurante: true`) | não |
| Queimadura | selo Queimando 3, `porTurno` HP 10 (renova pela tabela, como hoje) | não |
| Veneno | selo Envenenado 3, `porTurno` HP 10, `regra.curaRecebida` pela metade | não |
| Congelamento | selo Congelado 2 com `pega` CD 12, `regra.reageComDesvantagem`, `alcance` soma -2 | `pega` |
| Choque | selo Eletrizado 2, `porTurno` SP 10 | não |
| Cegueira | selo Cego 2 com `pega` CD 12 (Percepção 0 pela tabela) | `pega` |
| Enfraquecer | selo Enfraquecido 2, debuff, `mods` Força -20 e Dano -10 | não |
| Outro | selo com o nome, a duração e o "tira por vez" escolhidos | não |

A expansão mora numa função pura, `pecasParaOMotor(mecanica)` (`mecanica/golpe.ts`), chamada por `pecasDoCartao` e pelos
outros leitores do motor da seção 1. O editor nunca vê a mecânica expandida: lê e grava a escolha. Selo do tipo com o
mesmo nome de um selo já posto nos Efeitos não entra duas vezes; o editor avisa e oferece tirar dos Efeitos.

### 3.3 Categoria da ação e "Tipo na batalha" (sem campo novo)

| Categoria na tela | Peças | Tipo gerado |
|---|---|---|
| Ataque Simples / Completo | `acao` simples / completa; alvo inimigos, todos ou escolha | Ativa (Debuff se não tem dano e só põe selo) |
| Overload | `limite.overload`, `acao` completa, `teste` naoErra (travados pela tela) | Ativa |
| Apoio | alvo aliados ou só em quem usa; sem reação | Buff |
| Reação | `uso` reacao (ativaOuReacao = "Reação, também ataca") | Reação |
| Passiva | sem mecânica | Passiva |

Bônus, Livre e "perguntar na hora" continuam (`acao` bonus, livre, perguntar), atrás do link discreto. A antiga
"Condição" é Ataque sem dano com um tipo. Com "Só o tipo", o golpe só ganha o nome no papel e no registro. A ED2 confere
quem lê o campo Tipo numa técnica montada (`tiposDaHabilidade.ts`): o Tipo gerado tem que dar a mesma leitura das peças.

### 3.4 Campos de texto gerados (uma fonte)

- `lib/batalha/mecanica/textoGerado.ts`: `textoDoCartao(mecanica, sistema)` devolve Ação, Tipo, Efeito, Custo, Tempo e
  Dano, no vocabulário que os leitores de texto de hoje entendem: Ação "Ação Completa", Custo "30 SP", Tempo
  "Recarga 2" ou "1 vez por batalha", Dano = a fórmula (`formulaDoDanoDasPecas`), Efeito = a frase do papel.
- **Ponto único**: `cartaoComTextoGerado(antes, depois, sistema)`, que absorve o `cartaoComOEfeitoDaMecanica` da arma.
  Roda quando o mestre muda a mecânica, quando aceita a proposta do dono e ao salvar a entrada do catálogo. A proposta do
  dono não mexe nos campos (eles seguem a mecânica que vale). Abrir a ficha não regrava nada.
- **O motor não lê esses campos** numa técnica montada (já é assim: `cartaoMontado` manda nas peças). Eles servem ao app
  de antes (que mostra o cartão à mão com o texto certo), ao site do Lobby, ao cartão lido e à lista do catálogo.
- Na tela ficam em "O que o app escreve nos campos de texto", só leitura, abaixo do papel.

### 3.5 O cartão só de texto (~230 cartões)

- Abre no editor novo em modo "Só texto": Nome, Descrição, a linha "Campos de texto" (Ação, Tipo, Efeito, Custo, Tempo e
  Dano editáveis como hoje, com o `CampoDeDano`), Alcance (`cartao.alcance`, como hoje), Requisitos, Evolução,
  Jogadores e Campos extras. Golpe, Acerto, Efeitos e a fórmula com botões aparecem numa linha só: "Escolher golpe,
  acerto e efeitos: [Montar a partir do texto] [Começar de um modelo]". A batalha segue lendo o texto.
- **Montar**: abre preenchido pelo texto e pela tabela à mão (`leituraDaTecnica`; a ED5 confere se o preenchimento do
  SISTEMA §10 já existe, senão nasce `mecanica/doTexto.ts`). O alcance do cartão passa para o alvo da mecânica. Ao
  salvar, os textos de antes vão uma vez para o extra "Texto de antes" e os campos passam a ser gerados.
- **Desmontar** (só o mestre): tira a mecânica e devolve os campos do "Texto de antes". Ctrl+Z também desfaz.
- O cartão já montado com texto velho no "Texto antigo" ganha o mesmo "Texto de antes" na primeira edição.

### 3.6 Onde cada linha grava

| Linha | Campo | Linha | Campo |
|---|---|---|---|
| Nome, Descrição | `nome`, `campos.descricao` | Custo | `custos`, `limite`, `custoEmItem` |
| Ação | `acao`, `uso`, `limite.overload`, `alvo.quem` | Requisitos | `cartao.requisitos` (fora da mecânica) |
| Golpe | `golpe` (v4) | Evolução | extras "Evolução" e "Evolui para" + `requisitos.evoluir` |
| Alcance | `alvo` (ou `cartao.alcance` sem mecânica) | Jogadores | o "esconder" de hoje |
| Dano, Acerto | `dano`, `teste` | Campos extras | `extras` (sem os da evolução) |
| Efeitos | `efeitos` (+ "+N no acumulador") | Acumulador | definição na ficha, onde a B2 a pôs (decisão: no cartão) |

## 4. Motor

- **Teste do selo (`pega`)**: o host rola, para cada alvo acertado, d20 + mod do atributo contra a CD, depois do dano;
  passou, o selo não entra. Mesmo caminho do teste rolado de hoje (`disputaNoUso.ts`); o dado vai ao registro
  ("Resistência 9 contra CD 12: Atordoado"). O treino do Worker rola igual. O Testar mostra o passo com o d20 escolhível.
- **Acumulador** (`lib/batalha/acumulador.ts`, puro): sobe pelos eventos da definição, cai pela definição, dá o ganho
  por nível. O nível mora no combate da ficha, e cada linha guarda o antes e o depois (`combateSemALinha` desfaz). A
  Polaridade do Vagn passa a ser lida como `AcumuladorDaFicha` em memória (extras de hoje) e zera no fim da batalha.
- **Ordem no golpe**: requisitos conferem; o dano é calculado com o ganho do nível de AGORA; os gastos do requisito
  (A4 "e gasta") saem; o efeito "+N" soma (ao usar ou se acertar), até o máximo; uma linha no registro. Assim o golpe
  que gasta sai com a carga (decisão de 23/11).
- **"Carregar <nome>"** nasce da regra "sobe ao gastar a reação". A mensagem `contador` da rede ganha a forma genérica
  com o id do acumulador; a de hoje fica como apelido da Polaridade.

## 5. Tela

- `components/batalha/editor/EditorDaHabilidade.tsx` + `linhas/*.tsx` (uma por linha) + `ColunaDoPapel.tsx` (frase
  clicável que leva à linha, mapa pelo `formaNaTela.ts`, `PainelDeEnsaio` embutido) + `ComecarDeUmModelo.tsx` (22
  modelos em Ataque, Apoio e Reação, com aviso e Ctrl+Z). Por dentro, os controles de hoje: `controles.tsx`, `OsNumeros`
  (a fórmula com botões e "O app calcula sozinho"), `PecasDoSelo`, `EscolhaDaForma`.
- **Fachada**: `MecanicaDaTecnica` mantém o nome e as props enquanto os chamadores trocam; `doQue` escolhe as linhas.
  Técnica: todas. Arma: Golpe, Alcance, Dano, Acerto, Efeitos, Requisitos. Item: Alcance, Efeitos, Gasto, Requisitos.
- **Quem edita**: o mestre grava `mecanica`; o dono grava `mecanicaProposta` (como hoje); "ninguém" vê o papel lido.
- **Catálogo**: a entrada de habilidade em `EntradaDoCatalogoDialog.tsx` usa o mesmo editor com a ficha de treino; a
  arma segue por `EfeitoDaArmaCampos` (fonte única das armas inalterada).
- **Fluidez**: frase, mapa e Testar com `useDeferredValue`; nenhuma tarefa longa de 200 ms ou mais editando a Chuva.
- **No fim**: saem `BlocosDaMecanica.tsx`, os blocos-casca e os degraus; `MecanicaDaTecnica.test.tsx` sai junto com o
  comportamento que ele testava (nenhum teste novo entra).

## 6. Como as fases F e G do REQUISITOS.md entram

- **F vira a ED5**: a linha Requisitos é o `blocos/BlocoDosRequisitos.tsx` do plano dos requisitos; a linha Evolução é
  o grupo `evoluir`. O mesmo bloco entra no modo "Só texto", no item e no cartão da forma ("Para ligar", "Uma Parte por
  vez", "Só liga com a técnica") onde as formas se editam hoje. O "Testar mostra ok/falta" da F é o Testar daqui.
- **G continua como está no REQUISITOS.md**, com quatro acréscimos do protótipo: o medidor no topo do menu
  ("POLARIDADE 1/3"), a tira "Carregar <nome>", o selo dourado "+1 Polaridade" e o ícone do tipo do golpe na tira.
- A, B1, B2, B3, C, D, E, H e I não mudam. A tela 8 (editor do Acumulador) entra como ED6.

## 7. Compatibilidade

| Quem | O que acontece |
|---|---|
| Mecânicas 1, 2 e 3 | Leem e jogam igual; viram 4 só se o mestre puser golpe, teste do selo ou "+N" |
| App de antes (0.5.94) | Lê a 4 como "atualize o app": cartão à mão, com os campos gerados certos; nada se perde |
| Site do Lobby e Worker | Usam a mesma lib: saem junto com o app (fase I). O treino rola o teste do selo |
| Jogador na LAN | Usa o pacote do host; recebe o nível do próprio acumulador pelo recorte |
| Cartão de texto | Igual até "Montar"; "Desmontar" volta |
| Selos de hoje | A tabela por nome não muda; Envenenado de texto continua sem regra |
| Portão de ouro | 269 leituras e 122 ensaios iguais na cópia do `rpg.json` em toda fase que toca lib ou motor |

## 8. Fases

Direto na main; no máximo 3 escritores ao mesmo tempo, em arquivos que não se cruzam; cada um commita só os próprios
caminhos. Nenhum arquivo de teste novo: as provas são scripts de rascunho em `tmp/editor-fase-X/` e o app. Toda fase
fecha com `rtk proxy npx tsc --noEmit` limpo (client e `lobby/nuvem`) e o portão de ouro 269 + 122 com 0 diferenças.

| Fase | Quem | Arquivos | Pronto quando |
|---|---|---|---|
| **ED1. Golpe e versão 4** (agora, junto com B1 e B2) | `programador` | `mecanica/modelo.ts`, `golpe.ts` (novo), `leitura.ts`, `resumo.ts` | O script lê e relê os 10 tipos nos 3 modos; `pecasParaOMotor` dá as peças da tabela 3.2; guardar e ler de novo não muda nada (a expansão nunca vai ao disco); a 3 continua 3; um app com a versão 3 lê a 4 como "futura" |
| **ED2. Texto gerado** (junto com B3 e ED3) | `programador` | `mecanica/textoGerado.ts`, `categoria.ts` (novos), `lib/livros/fraseDaArma.ts` | Nos 22 modelos e nos montados do `rpg.json`: ler o texto gerado com os leitores de texto dá a mesma ação, custo, tempo e dano que as peças; a categoria sai certa nos 22; a arma gera o mesmo Efeito de hoje |
| **ED3. Casca do editor** (junto com B3 e ED2) | `programador-frontend` | `components/batalha/editor/*` (novos) | Ação, Alcance, Dano, Acerto, Efeitos e Custo montam a Chuva e o Caça às Bruxas numa página de prova, com papel, mapa e Testar; prints batem com o protótipo; nenhuma tarefa longa |
| **ED4. Motor** (depois da C; junto com D) | `programador` | `lib/batalha/acumulador.ts` (novo), resolução do golpe, `contador.ts`, nível no `combate.ts`, `registro.ts`, `ensaio.ts` | Arena: Impacto atordoa só quem falha, com o dado no registro; a Chuva com Polaridade 2 soma o ganho do nível 2, gasta 2 e o "+1" deixa 1; fim da batalha zera; Desfazer volta o nível; a Polaridade de hoje dá as mesmas leituras |
| **ED5. Editor inteiro** (= F; junto com E e ED6) | `programador-frontend` | `editor/*`, `blocos/BlocoDosRequisitos.tsx`, `FichaAbas.tsx` (só a técnica), `MecanicaDaTecnica.tsx` | Na ficha: montar os 4 exemplos do protótipo, salvar e reabrir igual; cartão de texto edita o texto como hoje, Monta e Desmonta sem perder nada; o dono propõe e os campos só mudam quando o mestre aceita; 22 modelos com Ctrl+Z |
| **ED6. Acumulador na ficha** (junto com E e ED5) | `programador-frontend` | `components/batalha/acumulador/*` (novos) | A tela 8 na ficha: criar a Fúria e o "Almas", trocar o nome e o A4 da Chuva acompanha; salvar e reabrir igual |
| **G. Menu e caixas** (depois da ED5) | `programador-frontend` | as do REQUISITOS.md + medidor e tira Carregar | O que o REQUISITOS.md pede, mais o medidor, a tira Carregar, o selo dourado e o ícone do golpe, como no protótipo |
| **ED7. Arma, item, catálogo e limpeza** (junto com H) | `programador-frontend` | `EfeitoDaArmaCampos.tsx`, `EfeitoDoItemCampos.tsx`, `EntradaDoCatalogoDialog.tsx`, arma em `FichaAbas.tsx`, os blocos que saem | Arma do livro, item do Acervo e entrada do catálogo abrem no editor novo e jogam igual; nenhum import aponta para o que saiu; portão de ouro igual |
| **I. Publicar e jogar** | `automacao-devops`, `verificador-realidade` | `scripts/publicar-versao.cjs` | Item por item contra o PEDIDOS de 23/11 (os três pedidos); app, site e Worker juntos; o dono monta uma habilidade nova e joga |

Ordem: ED1 já (2 escritores da B estão em voo); B3, ED2 e ED3; C; D e ED4; E, ED5 e ED6; G; H e ED7; I. Na ED4 entra
o diagrama `docs/diagrams/editor-da-habilidade.html` (escolha, expansão, motor, texto gerado) com a linha no INDEX.

## 9. Riscos e como ver cedo

| Risco | Como aparece | O que fazer |
|---|---|---|
| A expansão vai parar no disco | Sangrando duas vezes depois de salvar | Expansão só em `pecasParaOMotor`; a prova da ED1 guarda e relê |
| Selo do tipo e dos Efeitos juntos | Dois Atordoados no mesmo golpe | O leitor não repete o nome; o editor avisa |
| Texto gerado que o leitor de texto lê diferente | Site mostra "Ação Simples", motor faz Completa | Prova de ida e volta da ED2 nos 22 modelos e nos montados |
| O texto do mestre some ao montar | Nuance do texto antigo perdida | "Texto de antes" uma vez e Desmontar |
| Teste do selo diferente no host, no Testar e no Worker | Atordoa no Testar e não na mesa | Uma função de rolagem; o Testar usa a mesma com o d20 fixo |
| Golpe que gasta conta o nível depois | A Chuva sai sem o ganho da carga | Ordem da seção 4 escrita no código e no script da ED4 |
| Polaridade nova muda a velha | Portão de ouro com diferença no Vagn | Leitura em memória dos extras; portão de ouro na ED4 |
| `FichaAbas.tsx` (1169 linhas) com dois donos | Uma escrita apaga a outra | Um dono por vez: ED5 a técnica, ED7 a arma, em fases diferentes |
| App ou Worker velho com a versão 4 | Cartão à mão para quem não atualizou | Publicar os três juntos; os campos gerados mantêm o cartão legível |
| Editor lento com papel, mapa e Testar vivos | Quadro trava ao digitar a fórmula | `useDeferredValue`; medir tarefa longa na ED3 e na ED5 |

## 10. Para o dono confirmar

1. **Cartão só de texto**: fica texto, editável como hoje, até o mestre clicar em "Montar"; ao montar, o texto de antes
   fica guardado no extra "Texto de antes" e "Desmontar" o devolve. (Recomendado.)
2. **Campos gerados nos cartões já montados**: o app reescreve Ação, Tipo, Custo, Tempo, Dano e Efeito só quando o
   mestre edita aquela técnica, sem mexer em todas de uma vez. (Recomendado.)
3. **"Pôr selo" pelo nome**: Envenenado, Congelado e Eletrizado têm regra quando vêm do tipo do golpe; posto à mão só
   pelo nome, continua sem regra por enquanto (assim nenhum cartão de hoje muda). (Recomendado.)

## Próximo passo

`programador` na ED1 com este arquivo, a seção 3 e o `editor/prototipo.html` (as tabelas `FISICOS` e `ELEMENTOS`, a
partir da linha 563) como entrada; prova em `tmp/editor-fase-ed1/`.
