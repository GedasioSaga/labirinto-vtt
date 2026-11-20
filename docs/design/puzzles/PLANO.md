# Plano da 1ª leva: puzzles e Documento

19/11/2026, para aprovação do dono. Fontes: `PEDIDOS.md` (grilling de 19/11 ~18h10, as 12 respostas de 20h36, a versão Porta de 21h30, a aprovação de 21h43 com a 17 desfeita, e o acréscimo do Documento), `docs/design/puzzles/prototipo-v2.html` (aprovado), `docs/design/puzzles/prototipo.html` (o v1, que traz Juntar peças e Troca de peso) e `docs/design/puzzles/provas-v2/verificar.cjs`.

Regras que valem em todas as fases: o portão é `rtk proxy npx tsc --noEmit` em `client/`; nenhum teste novo sem pedido do dono (só rodar os que existem e consertar os que quebrarem por causa da mudança); conferência no navegador; nada de push nem release sem o ok dele; tudo direto na main, no máximo 3 escritores ao mesmo tempo, cada um em arquivos que os outros não tocam, e cada um commita só os próprios caminhos.

---

## 0. A decisão central

O puzzle vira um **jogo novo do registro de minigames** (`'puzzle'`, da subcategoria "Puzzles"), guardado como um **Desafio** do mapa. Assim ele ganha de graça o que já funciona para a pesca e o tiro: o lugar (ponto ou objeto), o selo, o alcance, o "encostar e tocar", o "Marcar no mapa", o Ctrl+K e o recorte. O Documento vira **entidade própria**: o texto mora numa **biblioteca "Documentos" do app** (fora do acervo e fora da campanha), o papel no chão mora no **mapa**, e a lista de quem leu mora na **ficha do personagem**.

Abordagens consideradas:

| Puzzle | Escolha |
|---|---|
| A. Jogo `'puzzle'` dentro de `REGISTRO_DE_MINIGAMES`, guardado em `Desafio` | **Escolhida.** Usa o lugar, o selo, o pino derivado, o recorte, o "Quem vê" e a página Jogos que já existem. O custo são cerca de 12 tabelas que exigem uma entrada por jogo (seção 5.1), de 1 a 10 linhas cada. |
| B. Entidade nova `MapData.puzzles` com registro próprio | Rejeitada: duplicaria o selo, o alcance, o recorte, o marcar no mapa e o Ctrl+K (cerca de 600 linhas a mais), e seriam dois caminhos que divergem com o tempo. |
| C. Jogo de objeto (`REGISTRO_DE_JOGOS_DE_OBJETO`, como o baú) | Rejeitada: amarra o puzzle a um móvel, e o dono pediu também ponto do mapa. |

| Documento | Escolha |
|---|---|
| A. Biblioteca do app + `MapData.documentos` (o papel no chão) + `Personagem.documentos` (a lista) | **Escolhida.** É o que o dono pediu ("biblioteca separada", "lista na ficha") e deixa o texto fora do recorte. |
| B. Guardar nas pistas `!`/`?` (`lib/clues.ts`, `ClueReadMessage`) | Rejeitada como lugar de guardar: o caderno é memória da sessão do host (`cluebooks` em `net/hostSession.ts`, teto de 30, some ao fechar o app) e não fica na ficha. **O desenho é aproveitado**: o host confere o alcance e o recorte antes de aceitar a leitura e manda ao jogador só o que ele pode ler, como em `handleClueRead`. |
| C. Tipo de móvel novo `'documento'` em `lib/mobilia/tipos.ts` | Rejeitada: tipo de móvel novo exige arte em `texturas/meioTermo/moveis/index.ts`, `PERFIS`, `LUGARES_DE_MATERIAL`, `ROTULO_MOBILIA` e `NOME_COM_ARTIGO`, e o papel não é um móvel. |

---

## 1. Modelo de dados

### 1.1 Onde cada coisa mora

| Dado | Onde | Arquivo no disco | Vai ao jogador? |
|---|---|---|---|
| "Meus puzzles" (modelos do mestre) | app, fora da campanha | `<appData>/puzzles/puzzles.json` (novo, no molde de `lib/acervoDeItens.ts`: `.invalido`, `.anterior`, fila de gravação, `lido`) | nunca |
| Cópia do puzzle num lugar | mapa: `Desafio.minigame` com `jogo: 'puzzle'` | `map.json` da cena | nunca inteira; só a `VistaDoPuzzle` (2.3) |
| Progresso ao vivo | mapa: `Desafio.progressoDoPuzzle` | `map.json` | só o que a `VistaDoPuzzle` deixa |
| Peças de puzzle | acervo de itens, categoria nova "Peça de puzzle" | `<appData>/itens/itens.json` (índice sobe para a versão 4) | na mochila, como qualquer item |
| Biblioteca "Documentos" | app, fora da campanha e fora do acervo | `<appData>/documentos/documentos.json` (novo, mesmo molde) | nunca inteira; só o `DocumentoNoFio` (2.3) |
| Papel no chão | mapa: `MapData.documentos` | `map.json` | só lugar, papel e título |
| Lista do jogador | ficha: `Personagem.documentos` | `adventure.json` (os personagens moram na aventura) e o lobby | sim, só os metadados |
| Imagens (fundo do puzzle, peça própria, papel próprio, imagem da página, brasão) | mídia da mesa `midia:<sha256>` | `<appData>/midia/` (já existe, `lib/midiaNoDisco.ts`); o jogador busca em `/media/<id>` (`desktop/src-tauri/src/net/media.rs`, sem mudança) | a referência, só quando ele entra no puzzle ou lê o documento |
| Quem está dentro de cada puzzle agora | memória do host (`porJogador.registrar` em `hostSession.ts`) | nada | a contagem, para o mestre |

Todo mapa novo já nasce aventura de 1 cena (`da6ee04c`), então sempre há onde guardar a ficha. No mapa solto antigo, o jogador lê o documento mas a lista não fica guardada, e o mestre recebe o aviso para abrir o mapa como aventura.

### 1.2 Tipos do puzzle (`client/src/puzzles/tipos.ts`, novo)

O sufixo "DoPuzzle" é de propósito: `MapData.encaixeNaGrade` já existe e quer dizer outra coisa.

```ts
export const VERSAO_DO_PUZZLE = 1

/** Desafio gravado: o que entra em MinigamesPorJogo['puzzle']. */
export interface MinigamePuzzle {
  jogo: 'puzzle'
  versao: number                 // 1 nesta leva; o leitor migra ao subir
  npc: ''                        // exigido por nomePadraoDoDesafio; sempre vazio
  modeloId: string | null        // de qual "Meus puzzles" veio; null = feito aqui
  mudadaAqui?: true              // a cópia mudou depois de sair do modelo
  puzzle: Puzzle
}

export interface Puzzle {
  nome: string                   // do mestre
  nomePublico: string            // o título que o jogador vê (pode ser vazio)
  regra: RegraDoPuzzle
  visual: VisualDoPuzzle
  encaixes: EncaixeDoPuzzle[]    // 0..12
  troca: TrocaDePeso | null      // Troca de peso (v1: o pedestal e a bandeja)
  dica: DicaDoPuzzle
  desfecho: DesfechoDoPuzzle
  castigo: CastigoDoPuzzle
  controle: { x: number; y: number; s: number }   // posição dos controles (v2)
  futuro?: MecanicaFutura        // ver 1.6; nesta leva sempre ausente
}

/** Encaixe: qualquer peça do conjunto em qualquer lugar (a Fonte), cada encaixe a sua (o Altar), ou Ordem certa (a Porta). */
export type RegraDoPuzzle = 'qualquerLugar' | 'lugarCerto' | 'ordem'

export type VisualDoPuzzle =
  | { tipo: 'modelo'; modelo: 'fonte' | 'porta' | 'cofre' | 'altar'; cores: { parede: string; chao: string; objeto: string }; inscricao: string; moldura: 'original' | 'porta' }
  | { tipo: 'imagem'; imagem: string /* midia:<id> */ }

export type FormaDoEncaixe = 'redondo' | 'brasao' | 'joia' | 'quadrado'
```

```ts
export type EncaixeDoPuzzle =
  | { id: string; x: number; y: number; t: number; forma: FormaDoEncaixe; jeito: 'peca'; itemId: string | null }
  /** Juntar peças: as duas metades entram no mesmo encaixe e viram uma peça só, que existe só no puzzle. */
  | { id: string; x: number; y: number; t: number; forma: FormaDoEncaixe; jeito: 'metades'; metades: [string | null, string | null]; vira: { nome: string; imagem: string | null } }

/** Troca de peso: a peça guardada sai do pedestal quando a bandeja pesa o pedido. */
export interface TrocaDePeso {
  guarda: string                 // itemId do acervo que vai para a mochila
  peso: number                   // 1..8
  pesos: Record<string, number>  // itemId -> peso; mora aqui, e não no item, para não mexer no esquema da mochila
  x: number; y: number
}

export type DicaDoPuzzle = { tipo: 'texto'; texto: string } | { tipo: 'documento'; docId: string }

export interface DesfechoDoPuzzle {
  modo: 'texto' | 'cena'         // a escolha que VOLTOU (decisão 17 desfeita)
  texto: string
  itens: ItemNoConteudo[]        // o mesmo tipo do baú (lib/conteudoDoObjeto.ts)
  moedas: number
  documentos: string[]           // ids da biblioteca "Documentos"
  abrePorta: boolean             // só com moldura Porta ou modelo 'porta'; a parede é Desafio.portaLigada
}

export type CastigoDoPuzzle =
  | { tipo: 'nada' }
  | { tipo: 'dano'; pv: number; texto: string }
  | { tipo: 'armadilha'; pv: number; texto: string }
  | { tipo: 'barulho'; texto: string }   // avisa o mestre com toast
```

No `Desafio` (`types/map.ts`) entra um campo novo e opcional, separado da configuração, para que editar a cópia ou o Ctrl+Z do mestre não apaguem o progresso:

```ts
interface Desafio {
  // ...o que já existe; portaLigada passa a valer para a dança E para o puzzle
  progressoDoPuzzle?: ProgressoDoPuzzle   // só com minigame.jogo === 'puzzle'
}

export interface ProgressoDoPuzzle {
  rev: number                    // sobe a cada mudança; tela velha é recusada
  encaixes: Record<string, PecaPosta | MetadesPostas | null>
  bandeja: PecaPosta[]           // Troca de peso
  trocaFeita: boolean
  resolvido: { por: string; em: number } | null
  erros: number
}
export interface PecaPosta {
  vaga: CarriedItem              // a vaga inteira, para voltar igual à mochila de quem pôs
  por: { personagemId: string | null; tokenId: string; nome: string }
}
export interface MetadesPostas { a: PecaPosta | null; b: PecaPosta | null }
```

As regras do progresso são as do protótipo: a peça sai da mochila ao encaixar; volta à mochila de **quem pôs** se alguém a tirar antes de resolver; depois de resolvido fica gasta (presa no progresso, nunca volta). Juntar peças: ao tirar, voltam as duas metades (decisão do Claude: a peça inteira não existe no acervo). Troca de peso: as pedras da bandeja voltam até a troca dar certo; depois ficam presas, e a peça guardada vai para quem apertou "Trocar".

### 1.3 "Meus puzzles" (`client/src/puzzles/meusPuzzles.ts`, novo)

```ts
export interface ModeloDePuzzle { id: string; criadoEm: number; mudadoEm: number; puzzle: Puzzle }
export interface IndiceDeMeusPuzzles { versao: 1; modelos: ModeloDePuzzle[] }
```

"Pôr no lugar" copia o `Puzzle` para um `Desafio` novo, com `modeloId` apontando o modelo. Editar a cópia marca `mudadaAqui`; editar o modelo não muda as cópias (como a conferência do protótipo "Editar a cópia do lugar não muda o modelo").

### 1.4 Peça de puzzle (acervo)

Sem campo novo no item: a peça é um `ItemDoCatalogo` com `categoria: 'Peça de puzzle'` e imagem `midia:<id>`. A biblioteca de peças desenhadas (os 13 SVGs do protótipo: brasões, chaves, engrenagens, joias e medalhões) vira arte do app em `client/src/puzzles/arte/pecas.ts`. "Pôr no acervo" rasteriza o SVG num PNG de 256 px e grava pela mídia (`guardarMidia`). Assim a vaga da mochila, o lobby e a tela do jogador mostram a peça sem mexer no esquema do `CarriedItem`. O encaixe compara pelo `itemId` da vaga (`DadosDoItem.itemId`).

Migração: `VERSAO_DO_INDICE` de `lib/acervoDeItens.ts` sobe de 3 para 4. O índice velho ganha a categoria "Peça de puzzle" e uma pasta com o mesmo nome, uma vez só, como a Munição ganhou na versão 2 (`CATEGORIA_DA_MUNICAO`).

### 1.5 Documento (`client/src/documentos/tipos.ts`, novo)

```ts
export const VERSAO_DO_DOCUMENTO = 1

/** Na biblioteca "Documentos" do app. */
export interface Documento {
  id: string
  versao: number
  titulo: string
  papel: 'alfinete' | 'carta' | 'diario' | 'bilhete' | 'pergaminho' | 'imagem'
  imagemDoPapel: string | null   // midia:<id>, só com papel 'imagem'
  paginas: PaginaDoDocumento[]   // 1..20
  dicaDe: string | null          // puzzle cuja dica é este documento (só para o mestre)
  extras: ExtrasDoDocumento      // ver 1.5.1; nasce com o padrão
  trechos: Record<string, TrechoProtegido>   // ver 1.5.1; nasce vazio
  criadoEm: number; mudadoEm: number
}
export interface PaginaDoDocumento {
  texto: string                  // **negrito**, *itálico* e as marcas {{cifra:ID}} e {{borrado:ID}}
  imagem: string | null          // midia:<id>
}

/** No mapa: o papel no chão (MapData.documentos). */
export interface DocumentoNoMapa extends NoPiso {
  id: string
  docId: string
  lugar: LugarDoDesafio          // 'ponto' ou 'objeto'; o mesmo tipo do desafio
  depois: 'fica' | 'some'        // padrão 'fica'
  pego?: { por: string; em: number }   // com 'some', o papel sai do recorte para todos
}

/** Na ficha do personagem (Personagem.documentos): só metadados. */
export interface DocumentoNaFicha {
  docId: string
  titulo: string                 // cópia: a lista abre no lobby e com o documento apagado
  papel: Documento['papel']
  em: number
  origem: 'mapa' | 'puzzle' | 'objeto' | 'mestre'
  de?: string                    // "Cofre do Capitão", "o mestre"
  novo?: true                    // o aviso de novo; sai quando ele lê
}
```

A lista tem teto de 200 por ficha. O texto **não** fica na ficha: o host monta o que o jogador lê na hora da leitura, a partir da biblioteca. Isso protege o trecho cifrado (2.3) e faz uma correção do mestre valer também para quem já leu. Documento apagado da biblioteca: a linha fica na lista com "O mestre apagou este documento" (o texto que o protótipo usa na dica), e o botão Apagar da biblioteca avisa antes: "N jogadores têm este documento".

#### 1.5.1 Os 4 extras (acréscimo do dono, ainda sem protótipo)

O modelo já nasce com eles, para não precisar de migração depois. A tela e o host entram na fase D5, depois do protótipo D0.

```ts
export interface ExtrasDoDocumento {
  letra: 'mao' | 'maquina' | 'impressa'                  // padrão 'mao'
  tinta: 'preta' | 'sepia' | 'vermelha' | 'sangue'       // padrão 'preta'
  desgaste: { cor: string | null; manchas: 0 | 1 | 2 | 3; bordaQueimada: boolean; dobras: boolean; rasgos: boolean }
  selo: { tipo: 'cera' | 'carimbo'; cor: string; arte: string | null } | null
  assinatura: string | null                              // linha no fim da última página
  brasao: { arte: string | null; imagem: string | null } | null   // no cabeçalho da 1ª página
}

/** Trecho que nem todo jogador lê. O texto claro mora SÓ aqui, e só no mestre. */
export type TrechoProtegido =
  | { tipo: 'borrado'; claro: string }                              // ninguém lê; vai embaralhado
  | { tipo: 'cifra'; claro: string; mostra: 'codigo' | 'lingua' | 'embaralhado'; textoCifrado: string; chaves: string[] /* itemIds: lente, dicionário, chave de cifra */ }
```

### 1.6 O que as levas 2 a 4 exigem do modelo (sem construir agora)

- **Combinações** (rodas de números e de símbolos, relógio, sequência de botões, já desenhadas no v2): `Puzzle.futuro = { tipo: 'combinacao', forma, resposta }`, com a resposta só no mestre, e o progresso ganha `controles: Record<string, number | number[]>`. A conferência é no host, pelo botão "Tentar". Por isso o motor já recebe uma ação genérica (`AcaoNoPuzzle`, 2.1), e não só "pôr e tirar".
- **Peças giratórias e luzes**: `futuro = { tipo: 'giratorias', grade, alvo }` e `{ tipo: 'luzes', ligacoes, alvo }`; o progresso ganha `rotacoes: number[]` e `luzes: boolean[]`; os fusíveis das luzes são encaixes comuns.
- **Empurrar estátuas** (no mapa, não na tela de perto): `futuro = { tipo: 'estatuas', alvos: { propId, x, y }[] }`. O progresso sai da posição dos objetos, e precisa de uma ação nova do jogador no mapa (empurrar), com colisão. É a maior das três.
- **Compatibilidade**: o leitor (`puzzles/leitor.ts`) guarda um `futuro` desconhecido como veio (`{ tipo: string, bruto }`), e a tela diz "Este puzzle é de uma versão mais nova do app". Assim um app velho não apaga um puzzle mais novo ao salvar o mapa.

### 1.7 Versão do arquivo e migração

O `map.json` não tem versão geral: a regra do arquivo é campo novo e opcional, e ausente quer dizer como antes (`lib/mapFile.ts`). Portanto:

- `Desafio.progressoDoPuzzle`, `MapData.documentos`, `Personagem.documentos` e `ConteudoDoObjeto.documentos` são opcionais e não têm linha de migração. Mapa velho abre igual.
- `MinigamePuzzle.versao` e `Documento.versao` são versões próprias, lidas por `lerPuzzleDoArquivo` e `lerDocumento`, que migram ao subir.
- Imagem `data:image/...` vinda de algum lugar: o leitor recusa dentro do mapa (o mapa não cresce), e o editor a converte na hora por `guardarDataUrl` antes de gravar.
- **Atenção**: hoje `lerMinigameDoArquivo` descarta o desafio de jogo desconhecido. Um app de antes desta leva que abrir e salvar um mapa com puzzle **apaga o puzzle**. Na prática o atualizador resolve, mas isso vai escrito nas notas da versão.

---

## 2. Rede

### 2.1 Um motor só

`client/src/puzzles/motor.ts` (puro, sem React e sem rede) recebe `(puzzle, progresso, mochila, acao)` e devolve `{ progresso, mochila, efeitos }`. Quem o chama é o **host** de verdade e o **Testar como jogador** do editor, este com uma mochila de mentira (as peças certas e mais 2 que não servem, como `pecasDeTeste` no v2). A conta é a mesma nos dois: o teste não pode mentir sobre o jogo.

```ts
type AcaoNoPuzzle =
  | { tipo: 'por'; encaixeId: string; vagaId: string; metade?: 'a' | 'b' }
  | { tipo: 'tirar'; encaixeId: string }
  | { tipo: 'porNaBandeja'; vagaId: string }
  | { tipo: 'tirarDaBandeja' }
  | { tipo: 'trocar' }
  // leva 2: 'girar' (controle, passo) e 'tentar'
type EfeitoDoPuzzle =
  | { tipo: 'recusado'; motivo: string }
  | { tipo: 'juntou'; encaixeId: string }
  | { tipo: 'errou' }
  | { tipo: 'resolveu' }
  | { tipo: 'trocou'; guarda: string }
```

Só há erro na Ordem certa (tudo cheio, ordem errada) e na Troca de peso (peso errado). No Encaixe a peça errada nem entra: é recusada na hora, como no v1.

### 2.2 Mensagens (`client/src/net/protocoloDoPuzzle.ts` e `protocoloDoDocumento.ts`, novos)

No molde de `net/protocoloDoObjeto.ts`: aditivas, com parser e tetos próprios; o jogador velho ignora, o mestre velho responde `invalid_message`.

| Direção | Mensagem | Conteúdo | O host confere |
|---|---|---|---|
| jogador → host | `puzzle.entrar` | `desafioId`, `tokenId` | o selo está no recorte dele, a ficha alcança (`tokenReachesPin` ou `fichaAlcancaObjeto`), não está congelado, a ficha é dele |
| host → jogador | `puzzle.vista` | `VistaDoPuzzle` (2.3) e `rev` | |
| jogador → host | `puzzle.acao` | `desafioId`, `rev`, `AcaoNoPuzzle` | ele está dentro; o `rev` é o atual; a vaga é da mochila dele; o motor aceita |
| host → quem está dentro | `puzzle.vista` | a vista nova (cada um com a mochila dele) | |
| host → quem agiu | `puzzle.recusado` | `motivo` (`longe`, `ocupado`, `velho`, `mudou`, `nao_encaixa`, `resolvido`) | |
| host → quem agiu | `puzzle.castigo` | `tipo`, `texto`, `pv` (o castigo só sai agora) | |
| host → quem está dentro | `puzzle.resolvido` | `por`, `modo`, `texto`, os itens, moedas e documentos que **ele** ganhou, `abriuPorta` | |
| jogador → host | `puzzle.sair` | `desafioId` | |
| host → quem está dentro | `puzzle.fechado` | o mestre mudou ou apagou o puzzle | |
| jogador → host | `documento.ler` | `{ noMapaId }` (encostou e tocou) ou `{ docId, daLista: true }` | do mapa: alcance, recorte e o `pego` do 'some'; da lista: o `docId` está em `Personagem.documentos` dele |
| host → jogador | `documento.conteudo` | `DocumentoNoFio` (2.3) e `guardado: boolean` | |
| jogador → host | `documento.lido` | `docId` (tira o "novo") | a linha é dele |
| host → jogador | `documento.recebido` | `docId`, `titulo`, `papel`, `de` (Dar a…, puzzle, baú) | |
| host → jogador | `documento.recusado` | `motivo` | |

O progresso do puzzle e a lista na ficha são gravados no mapa e na aventura do mestre pelo caminho do jogador (`net/playerChanges.ts`, fora do Ctrl+Z dele, como `applyObjetoAberto`), numa gravação só por ação: o mapa (progresso, porta) e a ficha (mochila, PV, documentos) juntos. Três aplicadores seguidos perderiam as primeiras mudanças da ficha, o mesmo motivo escrito em `minigames/desfecho.ts`.

### 2.3 O que o jogador pode ver (o recorte)

Os dois recortes são montados por **lista branca**, em `puzzles/recorte.ts` e `documentos/recorte.ts`, nunca copiando o objeto e apagando campos:

```ts
interface VistaDoPuzzle {
  desafioId: string; rev: number; titulo: string        // o nomePublico
  visual: VisualDoPuzzle                                // a arte e a imagem: o que ele vê olhando
  encaixes: {
    id: string; x: number; y: number; t: number; forma: FormaDoEncaixe; jeito: 'peca' | 'metades'
    posta: { nome: string; imagem: string | null; por: string } | null
    metadesPostas?: 0 | 1 | 2
  }[]
  troca: { x: number; y: number; pesoPedido: number; naBandeja: { nome: string; peso: number }[]; feita: boolean } | null
  dica: { tipo: 'texto'; texto: string } | { tipo: 'documento'; titulo: string; podeLer: boolean } | null
  resolvido: boolean
  contagem: { postos: number; total: number }
  mochila: { vagaId: string; nome: string; imagem: string | null; peca: boolean }[]   // a mochila DELE
}
```

Nunca vão ao jogador: o `itemId` certo de cada encaixe, a ordem certa, o `guarda` da troca antes da troca, os `pesos` das peças que ele não tem, o castigo antes do erro, o desfecho antes de resolver, a porta ligada, o `modeloId` e o nome do mestre. Na Troca de peso o peso pedido vai, porque o mostrador do v1 o mostra.

```ts
interface DocumentoNoFio {
  docId: string; titulo: string; papel: Documento['papel']; imagemDoPapel: string | null
  extras: ExtrasDoDocumento
  paginas: {
    blocos: ({ t: 'texto'; texto: string } | { t: 'protegido'; texto: string; lido: boolean })[]
    imagem: string | null
  }[]
}
```

O host (`documentos/resolver.ts`, puro) troca cada `{{cifra:ID}}` pelo `claro` **só** se a mochila da ficha de quem lê tem um item com `itemId` em `chaves`; senão, pelo `textoCifrado` do mestre ou por um embaralhado. Cada `{{borrado:ID}}` vira sempre embaralhado. O embaralhado sai de uma semente (doc + trecho): letras aleatórias, do mesmo tamanho e com os mesmos espaços. Não é uma cifra do texto claro, então não dá para desfazer. A conferência acontece a cada leitura, e quem pegar a lente depois e reler pela lista passa a ler.

No mapa, o recorte leva de cada `DocumentoNoMapa` só `{ id, x, y, piso, papel, titulo }`, e não leva o papel já pego com 'some'. O título é público porque o "Ler 'Bilhete na parede'" do protótipo aparece antes da leitura.

### 2.4 Autoridade do host

O host é o mestre. O jogador só **pede**, e o host confere tudo de novo a cada mensagem contra o mapa de agora (a cópia pode ter mudado com o jogador dentro). As ações chegam em fila, uma por vez. Se duas pessoas usam o mesmo encaixe, a segunda recebe `ocupado`. A tela velha (`rev` antigo) recebe `velho` e a vista nova. O "Testar como jogador" não passa pela rede.

---

## 3. Arquivos

### 3.1 Novos

| Caminho | O quê |
|---|---|
| `client/src/puzzles/tipos.ts` | os tipos de 1.2, 1.3, 2.1 e 2.3 |
| `client/src/puzzles/motor.ts` | o motor único |
| `client/src/puzzles/recorte.ts` | `vistaDoPuzzle(...)`, por lista branca |
| `client/src/puzzles/leitor.ts` | `lerPuzzleDoArquivo`, migração por `versao`, `futuro` guardado |
| `client/src/puzzles/padroes.ts` | os 4 modelos prontos (o `BASE` do v2) e `puzzleDoModelo(m)` |
| `client/src/puzzles/meusPuzzles.ts` | o disco de "Meus puzzles" (molde do acervo) |
| `client/src/stores/meusPuzzlesStore.ts` | a lista na memória, salvar, pôr no lugar |
| `client/src/puzzles/arte/modelos.ts` | a arte SVG dos 4 modelos e das 3 molduras Porta (do v2: `arteFonte`, `artePorta`, `arteCofre`, `arteAltar`, `fontePorta`, `cofrePorta`, `altarPorta`, `passagem`, `verga`, `parede`, `chao`) |
| `client/src/puzzles/arte/pecas.ts` | os 13 desenhos de peça e o gerador de engrenagem |
| `client/src/puzzles/arte/rasterizar.ts` | SVG para PNG para `guardarMidia` |
| `client/src/puzzles/QuadroDoPuzzle.tsx` + `.css` | o quadro de perto (arte, encaixes, troca, porta abrindo), usado pelo jogador, pelo teste e pelo editor |
| `client/src/components/puzzles/EditorDoPuzzle.tsx` + `.css` | o editor em tela cheia por cima do mapa (é largo demais para a página do livro) |
| `client/src/components/puzzles/FichaDoEditor/*.tsx` | as seções Visual, Encaixes, Regra e troca, Dica, Desfecho e Castigo |
| `client/src/components/puzzles/BibliotecaDePecas.tsx` | as peças do acervo da categoria e as desenhadas, arrastáveis |
| `client/src/components/puzzles/MeusPuzzles.tsx` | modelos, cópias por lugar, "mudada só aqui" |
| `client/src/components/puzzles/TestarComoJogador.tsx` | o teste local, com a faixa "Teste" |
| `client/src/net/protocoloDoPuzzle.ts`, `net/puzzleNoHost.ts` | as mensagens; as contas do host (validação, mochila pela ficha com `darNaFicha` e `tirarDaMochilaDaFicha`, PV com `aplicarAjuste`) |
| `client/src/player/puzzle/TelaDoPuzzle.tsx` + `.css` | a tela do jogador: quadro, mochila, arrastar e tocar, sair, cartão do desfecho, castigo |
| `client/src/documentos/tipos.ts`, `recorte.ts`, `resolver.ts`, `leitor.ts` | os tipos de 1.5; o recorte do mapa; a montagem do `DocumentoNoFio`; a leitura do disco |
| `client/src/documentos/biblioteca.ts`, `client/src/stores/documentosStore.ts` | o disco e a memória da biblioteca |
| `client/src/documentos/Papel.tsx` + `.css` | o papel (5 tipos + imagem, páginas, depois os extras), para o mestre e o jogador |
| `client/src/components/livro/PaginaDocumentos.tsx`, `components/documentos/FichaDoDocumento.tsx` | a biblioteca do mestre no livro, a ficha do documento, Dar a todos e Dar a…, quem tem |
| `client/src/pixi/drawDocumentos.ts` | o papel no chão (mestre e jogador) |
| `client/src/net/protocoloDoDocumento.ts`, `net/documentoNoHost.ts` | as mensagens e as contas do host |
| `client/src/player/PlayerDocumentos.tsx` + `.css` | a lista e a leitura do jogador |

### 3.2 Mexidos

| Caminho | Mudança |
|---|---|
| `minigames/tipos.ts` | `MinigamePuzzle` na união `MinigameDoPino`; `'puzzle'` em `JOGOS_DO_MINIGAME`; a `entrada` de `MinigameVisivel` aceita a do puzzle |
| `minigames/registro.ts` | `puzzle` em `MinigamesPorJogo` e `REGISTRO_DE_MINIGAMES` (lugares ponto e objeto, entrada pelo pino, desfechos abrir porta, dar itens e dano); campo novo `categoria` (ação ou puzzle) nos 6 jogos; `ORDEM_DOS_JOGOS` |
| `minigames/simbolosDosJogos.ts` | o selo do puzzle |
| `components/MinigameControls.tsx` | `PAINEL_DO_JOGO.puzzle`: resumo, "Abrir editor", porta ligada, "Zerar progresso" (devolve as peças) |
| `components/livro/PaginaJogos.tsx`, `IconeDoJogo.tsx`, `paginaJogos.css` | 3 abas (Ação, Objetos, Puzzles); criar puzzle; Ao vivo com "N dentro, 2 de 3"; `sessoesAoVivo` ganha a fonte do puzzle |
| `lib/mapFile.ts` | `LEITORES_DO_ARQUIVO.puzzle`; `progressoDoPuzzle` no leitor do desafio; `MapData.documentos` |
| `lib/pins.ts` | o caso `'puzzle'` em `copiarMinigame` (cópia funda) |
| `lib/desafios.ts` | nada no patch (o progresso fica fora de `CHAVES_DO_PATCH`); `mapaComProgressoDoPuzzle(map, id, progresso)`, pura e reaplicável |
| `player/PlayerPinCard.tsx` | `TEXTOS_DO_JOGO.puzzle` e o botão "Examinar", que manda `puzzle.entrar` |
| `types/map.ts` | `Desafio.progressoDoPuzzle`, `MapData.documentos`, `ConteudoDoObjeto.documentos` |
| `lib/fogFilter.ts` | `documentos` no recorte (lista branca); conferir que o `progressoDoPuzzle` nunca passa |
| `lib/acervoDeItens.ts` | índice na versão 4, com "Peça de puzzle" |
| painel do acervo de itens (`AcervoDeItensPanel`) | "Pôr peça desenhada no acervo" |
| `lib/personagem.ts` | `documentos?: DocumentoNaFicha[]`; o leitor `documentosDoArquivo` dentro de `personagemDoArquivo` (sem ele a lista some ao salvar); `paraOFio` deixa passar |
| `net/edicaoDoPersonagem.ts` | a edição da ficha pelo jogador nunca escreve `documentos` |
| `lib/nuvem/caminho.ts`, `diferencas.ts`, `aplicar.ts`, `projecao.ts` | os caminhos `['documentos', docId]` (criar e apagar: o mestre) e `['documentos', docId, 'novo']` (definir: o dono ou o mestre) |
| `net/hostSession.ts` | só o despacho dos casos novos e o registro de quem está dentro; as contas ficam nos módulos `*NoHost.ts` |
| `net/hostBridge.ts`, `net/playerChanges.ts` | `applyPuzzle` e `applyDocumento` (gravação única de mapa e ficha, porta pelo aplicador `'abrir porta'`, toast com "Ver") |
| `player/playerConnection.ts` | o estado `puzzleAberto` e `documentoAberto`, os avisos de novo, o envio das mensagens |
| `player/PlayerPanel.tsx` + `player.css` | o ícone "Documentos" ao lado do Inventário, com o número de novos |
| `net/objetoNoHost.ts`, `lib/conteudoDoObjeto.ts`, `components/livro/ConteudoDoObjetoFicha.tsx` | o baú, a caixa e o barril também dão documento |
| `components/livro/LivroDoMestre.tsx` | o marcador da página Documentos |

---

## 4. Fases

O tamanho é em linhas novas aproximadas. Esforço: Opus 5.5 xhigh em tudo (regra do dono de 17/11). "1 dono" quer dizer que a fase mexe em arquivos que o resto também usa, então ninguém escreve ao lado nesses arquivos.

### Puzzle

**P1. Tipos, motor, recorte e leitor** · `programador` · ~700 · 1 dono
Arquivos: `puzzles/tipos.ts`, `motor.ts`, `recorte.ts`, `leitor.ts`, `padroes.ts`.
Pronto quando: tsc 0, e um rascunho descartável fora do repo, rodado com `npx tsx`, passa pelas 4 mecânicas com os puzzles do protótipo e imprime o progresso esperado: Fonte com 3 medalhões em qualquer lugar; Porta na ordem certa e na errada, com castigo; Altar com metades e troca de peso 4. O rascunho é apagado depois (não é teste novo). O primeiro commit é só o `tipos.ts`, para P3 e P4 poderem começar.

**P2. Registro, disco e selo** · `programador` · ~350 · 1 dono (registro, `mapFile`, `types/map`)
Depende de P1. Arquivos: as 12 tabelas de 5.1, `types/map.ts`, `lib/mapFile.ts`, `lib/desafios.ts`, `lib/fogFilter.ts` e `MinigameControls.tsx` (um painel provisório, só com o resumo).
Pronto quando: tsc 0; passam os testes existentes de `minigames/`, `lib/desafios`, `lib/mapFile`, `lib/fogFilter*` e `lib/pins` (os que contam "5 jogos" são ajustados, não criados); no navegador, um puzzle criado na página Jogos e marcado num ponto volta no mesmo lugar depois de salvar, fechar e reabrir, e o recorte do jogador mostra o selo sem nenhum campo do puzzle (conferido no `ws` da aba do jogador).

**P3. Peças no acervo** · `programador-frontend` · ~450 · em paralelo com P2 e P4
Depende só de `puzzles/tipos.ts`. Arquivos: `puzzles/arte/pecas.ts`, `arte/rasterizar.ts`, `lib/acervoDeItens.ts` e o painel do acervo.
Pronto quando: tsc 0; passam os testes existentes de `acervoDeItens`; no app, o acervo velho abre com a categoria e a pasta "Peça de puzzle" uma vez só (reabrir não duplica); "Pôr no acervo" num brasão cria o item com imagem `midia:`; a peça dada a um jogador aparece com a imagem na mochila dele, no navegador.

**P4. Arte dos modelos, moldura Porta e Quadro** · `programador-frontend` · ~900 · em paralelo com P2 e P3
Depende só de `puzzles/tipos.ts`. Arquivos: `puzzles/arte/modelos.ts` e `puzzles/QuadroDoPuzzle.tsx` + css.
Pronto quando: tsc 0; uma vitrine provisória (rota de desenvolvimento, apagada no fim da fase) mostra os 4 modelos nas 2 molduras, com cores e inscrição trocadas; trocar a moldura não move os encaixes; com movimento reduzido a porta abre só pela opacidade; p95 do quadro até 20 ms enquanto a porta abre (medido como no `verificar.cjs`).

**P5. Meus puzzles (disco e store)** · `programador` · ~350 · em paralelo com P7 e P8
Depende de P1. Arquivos: `puzzles/meusPuzzles.ts` e `stores/meusPuzzlesStore.ts`.
Pronto quando: tsc 0; no app, um modelo salvo volta igual depois de fechar e abrir o app; um índice estragado à mão vira `.invalido`, e o app não grava por cima.

**P6. Editor do mestre e página Puzzles** · `programador-frontend` · ~1.400
Depende de P2, P3, P4 e P5. Arquivos: `components/puzzles/*` (menos `TestarComoJogador.tsx`), `PaginaJogos.tsx`, `IconeDoJogo.tsx`, `paginaJogos.css` e o painel completo em `MinigameControls.tsx`.
O editor tem: visual (modelo, cores, inscrição e moldura Original ou Porta, ou imagem própria); encaixes arrastáveis com a alça de tamanho, novo, tirar e Ctrl+Z; a biblioteca de peças, arrastável até o encaixe; regra, metades e troca de peso; dica (texto ou documento); desfecho (**Texto ou Cena**, itens e moedas pelo seletor do baú, documentos, abrir a porta ligada); castigo; "Salvar nos meus puzzles"; e Meus puzzles com as cópias por lugar.
Pronto quando: tsc 0; no navegador, os passos do editor e de Meus puzzles do `verificar.cjs`, feitos à mão no app, dão certo (arrastar encaixe, alça, novo/Delete/Ctrl+Z, cor e texto, peça arrastada vira a certa, modelo salvo volta igual, editar a cópia não muda o modelo, moldura Porta mantém os encaixes e a porta escolhida), e nada vaza em 1366×768 nem em 1024×768.

**P7. Rede e host do puzzle** · `programador` · ~1.100 · 1 dono (`hostSession.ts`, `hostBridge.ts`, `playerChanges.ts`, `playerConnection.ts`)
Depende de P1 e P2. Arquivos: `net/protocoloDoPuzzle.ts`, `net/puzzleNoHost.ts`, o despacho em `hostSession.ts`, `hostBridge.ts`, `playerChanges.ts`, `playerConnection.ts` e a união em `protocol.ts`.
Pronto quando: tsc 0; passam os testes existentes de `net/`; com o mestre no app e 2 jogadores no navegador, ainda sem a tela pronta (pelo console da aba): entrar de longe é recusado; o jogador A põe uma peça, ela sai da mochila dele e a vista de B muda; B tira a peça de A e ela volta para A; a ordem errada castiga só quem errou; resolver entrega os itens a quem resolveu, abre a porta ligada no mapa do mestre e as peças não voltam mais; o F5 no meio mantém tudo; se o mestre muda a cópia com A dentro, A recebe `puzzle.fechado`.

**P8. Tela do jogador** · `programador-frontend` (skills do Emil na animação) · ~800 · em paralelo com P7: começa no motor local e liga na rede no fim
Depende de P4; a ligação final depende de P7. Arquivos: `player/puzzle/*` e `PlayerPinCard.tsx`.
Pronto quando: tsc 0; no navegador, os passos do v2 pelo lado do jogador dão certo: encostar e "Examinar"; arrastar e tocar a peça; recusa com o motivo; sair e voltar com tudo guardado; o cartão do desfecho com Texto e com Cena (a arte se mexe e depois vem o texto); o castigo à vista; a mochila com as peças primeiro; nada vaza em 1024×768; nenhuma tarefa longa de 200 ms.

**P9. Testar como jogador** · `programador-frontend` · ~300
Depende de P6 e P8. Arquivo: `components/puzzles/TestarComoJogador.tsx`.
Pronto quando: no app, resolver no teste mostra "Resolvido no teste. Aqui nada foi entregue", e nenhuma mochila, ficha, porta ou registro muda (conferido antes e depois); a moldura Porta abre as folhas só na tela.

### Documento

**D0. Protótipo dos extras do documento** · `designer-opus` · ~800 linhas de HTML · em paralelo com qualquer fase (mexe só em `docs/`)
Foi pedido pelo dono no acréscimo, porque os 4 extras ainda não estão no protótipo. Arquivo: `docs/design/puzzles/prototipo-documento-extras.html`, com prints em `provas-documento/`. No mesmo papel do v2, mostra: a letra (à mão, máquina de escrever, impressa) e a tinta (preta, sépia, vermelha, sangue); o desgaste (cor, manchas, borda queimada, dobras, rasgos, trecho borrado); o selo de cera, o carimbo oficial, a assinatura e o brasão; e o trecho cifrado lido **com** e **sem** o item (lente, dicionário, chave de cifra), com o embaralhado.
Pronto quando: o dono aprova. **D5 não começa sem isso.**

**D1. Núcleo do documento** · `programador` · ~650 · 1 dono (`types/map.ts`, `mapFile.ts`, `fogFilter.ts`, `personagem.ts`)
Depende de P2 terminada (os mesmos arquivos). Arquivos: `documentos/tipos.ts`, `leitor.ts`, `recorte.ts`, `resolver.ts` (já com os trechos protegidos), `biblioteca.ts`, `stores/documentosStore.ts`, `types/map.ts`, `lib/mapFile.ts`, `lib/fogFilter.ts`, `lib/personagem.ts` e `net/edicaoDoPersonagem.ts`.
Pronto quando: tsc 0; passam os testes existentes de `personagem`, `mapFile`, `fogFilter` e `edicaoDoPersonagem`; no app, um personagem com `documentos` gravados à mão no `adventure.json` continua com eles depois de abrir e salvar; um mapa com `documentos` também; a biblioteca grava e volta depois de fechar o app.

**D2. Mestre: biblioteca, ficha e papel no mapa** · `programador-frontend` · ~1.200 · em paralelo com D4
Depende de D1. Arquivos: `components/livro/PaginaDocumentos.tsx`, `components/documentos/*`, `documentos/Papel.tsx` (os 5 papéis + imagem, ainda sem os extras), `pixi/drawDocumentos.ts` e `LivroDoMestre.tsx`.
A ficha tem: título, papel, páginas com negrito, itálico e imagem por página, "fica no mapa" ou "some depois de pego", "Marcar no mapa", quem tem, Dar a todos e Dar a…
Pronto quando: tsc 0; no app, um documento de 2 páginas posto no mapa aparece como papel no chão do mestre; Dar a… um personagem grava na ficha dele, com "novo".

**D3. Rede e jogador do documento** · `programador` (host) e `programador-frontend` (tela), em arquivos separados · ~900 · o lado do host é 1 dono
Depende de D1. Não roda junto com P7: as duas mexem em `hostSession.ts` e `playerConnection.ts`. Arquivos: `net/protocoloDoDocumento.ts`, `net/documentoNoHost.ts`, o despacho no host, `playerConnection.ts`, `player/PlayerDocumentos.tsx`, `PlayerPanel.tsx` e `player.css`.
Pronto quando: tsc 0; no navegador, os passos de documento do `verificar.cjs` dão certo no app real: encostar e tocar abre o papel; o documento lido entra em Documentos e continua lá depois do F5 e numa sessão nova; a seta troca a página; "some depois de pego" tira o papel do mapa para todos, e ele fica na lista de quem leu; Dar a… Bento: só ele recebe, com o aviso de novo; reler pela lista tira o "novo"; o ícone fica ao lado do Inventário e aparece também na barra da batalha.

**D4. Lobby: a lista na ficha dos dois lados** · `programador` · ~150 · 1 dono (`lib/nuvem/*`)
Depende de D1. Arquivos: `lib/nuvem/caminho.ts`, `diferencas.ts`, `aplicar.ts` e `projecao.ts`.
Pronto quando: tsc 0 em `client/` e no Worker (`lobby/nuvem`, que importa `caminho.ts`); passam os testes existentes de `lib/nuvem`, inclusive o de ida e volta, com a ficha que tem documentos. O Worker **tem de ir junto** quando a versão for publicada (só com o ok do dono).

**D5. Os 4 extras** · `programador-frontend` (papel) e `programador` (resolver no host) · ~700
Depende de D0 aprovado, de D2 e de D3. Arquivos: `documentos/Papel.tsx` + css, as seções novas de `components/documentos/FichaDoDocumento.tsx` e `documentos/resolver.ts`.
Pronto quando: tsc 0; no navegador, com 2 jogadores: quem tem a lente lê o trecho cifrado em claro, o outro vê o cifrado, e o texto claro **não aparece** em nenhuma mensagem que chegou à aba dele (procurado no tráfego do `ws`); o borrado nunca chega em claro a ninguém; quem pega a lente depois e relê pela lista passa a ler.

### Ligações e fecho

**L1. Puzzle e baú dão documento; dica por documento** · `programador` · ~250
Depende de P7, P8 e D3. Arquivos: `net/puzzleNoHost.ts`, `puzzles/recorte.ts`, `net/objetoNoHost.ts`, `lib/conteudoDoObjeto.ts` e `ConteudoDoObjetoFicha.tsx`.
Pronto quando: no navegador, o passo "Cadeia" do v2 dá certo: a dica do cofre aponta para o bilhete já lido, com "Ler"; quem não leu vê "está num documento que você ainda não leu"; resolver entrega o documento na lista, marcado como novo; o baú com documento entrega do mesmo jeito.

**F. Conferência final** · `verificador-realidade`, e depois o dono
tsc 0; a suíte existente uma vez (uma suíte pesada por vez na máquina); `vite build` 0; um passeio no navegador com o mestre e 2 jogadores pelos 4 modelos, pelas 2 molduras e pelo documento inteiro; auditoria item por item contra o texto do PEDIDOS.md, e não contra este plano. O dono joga por último (camada 7 da regra de jogos) e decide.

### 4.1 Ordem e paralelo

| Onda | Escritores ao mesmo tempo (no máximo 3, em arquivos disjuntos) |
|---|---|
| 1 | P1 · D0 (designer, só `docs/`) |
| 2 | P2 (1 dono) · P3 · P4 |
| 3 | P5 · P7 (1 dono) · P8 (começa local) |
| 4 | P6 · D1 (1 dono; P2 já fechou) · P8 (ligação na rede) |
| 5 | P9 · D2 · D4 |
| 6 | D3 (1 dono no host) · L1 logo depois dela |
| 7 | D5 (se D0 estiver aprovado) · F |

Nunca juntos: P2 com D1 (`types/map.ts`, `mapFile.ts`, `fogFilter.ts`); P7 com D3 (`hostSession.ts`, `playerConnection.ts`, `protocol.ts`); duas fases quaisquer em `PaginaJogos.tsx` ou `MinigameControls.tsx`.

Total aproximado: ~11.000 linhas (puzzle ~6.350, documento ~4.400 contando as ~800 do protótipo D0, ligações ~250). Antes de cada onda longa, conferir o espaço livre no disco C: (piso de 8 GB, da memória de 23/10).

---

## 5. Riscos

### 5.1 Tabelas "jogo novo sem X não compila"

Pôr `'puzzle'` no registro obriga uma entrada em cada uma destas tabelas. O tsc aponta todas, o que ajuda, mas é o maior ponto de toque da leva:

1. `MinigameDoPino` (a união) e `JogoDoMinigame`, em `minigames/tipos.ts`
2. `JOGOS_DO_MINIGAME`, em `minigames/tipos.ts`
3. `MinigameVisivel.entrada` (a união dos tipos de entrada)
4. `MinigamesPorJogo` e `REGISTRO_DE_MINIGAMES`, em `minigames/registro.ts`
5. `ORDEM_DOS_JOGOS` (a página cria com `ORDEM_DOS_JOGOS[0]`, então precisa passar a criar pela aba)
6. `SIMBOLO_DO_JOGO`, em `minigames/simbolosDosJogos.ts`
7. `PAINEL_DO_JOGO`, em `components/MinigameControls.tsx`
8. `LEITORES_DO_ARQUIVO`, em `lib/mapFile.ts`
9. `copiarMinigame` (as sobrecargas e o `switch`), em `lib/pins.ts`
10. `TEXTOS_DO_JOGO`, em `player/PlayerPinCard.tsx`
11. `IconeDoJogo` e `sessoesAoVivo`, em `components/livro/PaginaJogos.tsx`
12. os 4 pontos de `minigame.jogo` em `net/hostSession.ts` e o de `App.tsx`, que decidem entre pesca, tiro, fogo e bolha; o puzzle não pode cair em nenhum deles por engano

Há ainda: `nomePadraoDoDesafio` lê `minigame.npc` (por isso o `npc: ''`); o puzzle não pode virar pino ▷ antigo nem convite do mestre (por isso o lugar `'nenhum'` fica fora de `lugares`); e um puzzle num objeto que também é baú com minigame daria dois toques no mesmo móvel, então o editor recusa essa combinação. `JOGOS_PORTADOS` e `REGISTRO_DE_JOGOS_DE_OBJETO` não mudam. Os testes existentes que contam os 5 jogos vão quebrar, e são ajustados na P2.

### 5.2 Tamanho de imagem no arquivo do mapa

O desenho já resolve: o mapa guarda só `midia:<id>`, e a imagem vai para `<appData>/midia` reduzida (fundo do puzzle até 1600 px em WebP, peça e brasão até 256 px), dentro do teto de 2 MB de `MIDIA_MAX_BYTES`, servida pela rota que já existe. Restam três pontos: (a) levar a pasta da aventura para outro PC não leva as imagens, nem "Meus puzzles", nem a biblioteca Documentos, como já acontece com o acervo; (b) o protótipo guardava `data:` no localStorage, e nada disso pode entrar no app; (c) o jogador só recebe a referência ao entrar no puzzle ou ao ler o documento, para não descobrir antes que eles existem.

### 5.3 Sincronia da ficha (o lobby edita dos dois lados)

- `personagemDoArquivo` monta o personagem campo a campo. Sem `documentosDoArquivo`, a lista **some** no primeiro salvar. Isso entra na D1.
- O lobby só aceita os caminhos da tabela de `lib/nuvem/caminho.ts`, e o Worker importa esse arquivo. Sem a D4 e sem o Worker publicado junto, toda mudança em `documentos` vinda do mestre é recusada como `fora-do-esquema`, e os dois lados divergem.
- Pôr e tirar peça mexe na mochila da ficha (`tirarDaMochilaDaFicha` e `darNaFicha`), que o lobby já sincroniza vaga a vaga. Pode haver corrida: o site soma a quantidade de uma vaga enquanto o puzzle a apaga. Quem decide é a regra de `lib/nuvem/conflito.ts`, e o puzzle guarda a vaga inteira (`PecaPosta.vaga`) para devolver igual.
- Na sala, o jogador vê a mochila pelo boneco (`Token.mochila`, espelhada por `lib/mochila/espelho.ts`). Quando a mochila da ficha muda, o boneco tem de ser acertado na mesma gravação, como o baú já faz.
- A edição da ficha pelo próprio jogador (`net/edicaoDoPersonagem.ts`) não pode escrever `documentos`. O "novo" sai só pela mensagem `documento.lido`.
- Token sem ficha (NPC emprestado): a mochila no boneco funciona, mas a lista de documentos fica só na sessão, como o caderno de pistas, e o mestre é avisado.

### 5.4 Outros

- **Vazamento**: a vista e o documento são montados por lista branca. O ponto mais delicado é o texto claro dos trechos cifrado e borrado, conferido no tráfego do `ws` na D5.
- **O mestre edita com jogador dentro**: o host confere contra o mapa de agora a cada ação. Uma mudança que não cabe (tirar um encaixe com peça posta) o editor não deixa fazer ("tire a peça antes", ou "Zerar progresso devolve as peças a quem pôs"), e quem está dentro recebe `puzzle.fechado`.
- **App velho apaga puzzle novo** (1.7): vai escrito nas notas da versão.
- **`hostSession.ts` tem cerca de 11,6 mil linhas**: lá dentro entra só o despacho; as contas ficam nos módulos `*NoHost.ts`.
- **Desempenho**: a arte é memoizada por visual e só os encaixes se repintam (o v2 mediu p95 de 20 ms ao arrastar).

---

## 6. Decisões do Claude neste plano (o dono confirma ou troca)

1. Juntar peças: tirar devolve as duas metades, e não a peça inteira, que não existe no acervo.
2. "Cena" no desfecho = a arte do modelo se mexe e depois vem o texto (o sentido do v1). Com imagem própria, a cena é só o brilho e o texto. Ligar o desfecho a uma cutscene do app fica para a leva 2.
3. "Some depois de pego": o documento some para todos quando o primeiro o lê (como no protótipo).
4. No site do lobby, a lista de documentos mostra só o título e o papel. O texto se lê na mesa, porque mora no app do mestre.
5. O peso da Troca de peso mora no puzzle, não no item, para não mexer no esquema da mochila nem no lobby.
6. Castigo "dano" e "armadilha" tiram PV pela ficha de quem errou (o caminho do baú); "barulho" só avisa o mestre, com toast e texto.
7. O editor do puzzle abre em tela cheia por cima do mapa; a página Jogos fica só com a lista e o resumo.
8. "Pôr no acervo" uma peça desenhada grava um PNG na mídia, em vez de criar um campo novo de arte no item.
