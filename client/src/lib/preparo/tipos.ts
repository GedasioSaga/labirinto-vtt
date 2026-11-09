import { booleano, ehRegistro, intacto, lista, numero, objeto, opcional, qualquer, texto, umDe, type Molde, type Valor } from './molde'

/**
 * OS ARQUIVOS DO PRELÚDIO (docs/planos/preludio-2026-11-08.md §2), um molde
 * por pedaço. O tipo de cada um sai do próprio molde (`Valor<typeof X>`), então
 * o que o TypeScript conhece é exatamente o que a leitura confere.
 *
 *   <appData>/preparo/preparo.json             o índice: as campanhas
 *   <appData>/preparo/verbetes/<id>.json       1 arquivo por verbete (sessão e página também são verbetes)
 *   <appData>/preparo/ligacoes.json            as ligações entre verbetes
 *   <appData>/preparo/tempo.json               eras, faixas e eventos
 *   <appData>/preparo/quadros/<id>.json        o quadro (mapa mental), com a foto do tldraw intacta
 *   <appData>/preparo/atlas/<id>.json          a imagem do mapa-múndi e os marcadores
 *   <appData>/preparo/revelado/<campanha>.json o que foi revelado, e a quem
 *
 * Todo arquivo tem `formato`, a versão. Só acrescentou campo opcional: o
 * formato fica (a versão antiga guarda a chave nova em `extras`). Mudou o
 * sentido ou o tipo de um campo: o formato sobe, e a versão antiga passa a
 * abrir o arquivo só para leitura (`disco.ts`).
 */

// ─── Texto do editor ─────────────────────────────────────────────────────────

/**
 * O texto rico é o documento do editor (TipTap) em JSON, não HTML: com JSON dá
 * para tirar o segredo e desenhar no site sem HTML (a ideia de `lib/marcacaoLeve.ts`).
 * Fica guardado inteiro; aqui só a casca é conferida, e quem anda pelos nós
 * (o filtro do revelado, a busca) confere cada um.
 */
export interface TextoRico {
  type: 'doc'
  content?: unknown[]
}

/** As 3 peças nossas dentro do texto (plano §2). */
export const PECAS_DO_TEXTO = Object.freeze({
  /** Bloco de segredo: nunca sai do PC. */
  segredo: 'segredo',
  /** @menção a um verbete; `attrs.verbeteId`. */
  mencao: 'mencao',
  /** Link para a mesa; `attrs` com a cena, o pino ou a ficha. */
  ligacaoMesa: 'ligacaoMesa',
})

function ehTextoRico(bruto: unknown): bruto is TextoRico {
  return ehRegistro(bruto) && bruto.type === 'doc' && (bruto.content === undefined || Array.isArray(bruto.content))
}

const TEXTO_RICO: Molde<TextoRico> = intacto(ehTextoRico, 'um documento do editor de texto')

// ─── Origem: de onde veio o que foi importado ────────────────────────────────

export const ORIGEM_NO_GRIMORIO = objeto({
  id: texto(),
  /** Caminho do arquivo dentro do cofre do Grimório (`vinculos.json` para a ligação). */
  caminho: texto(),
  /**
   * SHA-256 do que foi importado (verbete, quadro, ligação ou campanha), sem
   * `origem` e sem `formato` (`importar/reimportar.ts`). Na reimportação: o que
   * não bate mais com este hash foi editado no Prelúdio e fica como está. Quem
   * salva nunca recalcula este campo.
   */
  hash: opcional(texto()),
})

/** De onde veio, para a reimportação achar o mesmo (verbete, quadro, ligação e campanha). */
export const ORIGEM = objeto({
  grimorio: opcional(ORIGEM_NO_GRIMORIO),
})

// ─── Índice: preparo.json ────────────────────────────────────────────────────

/** As campanhas são etiquetas (como o "participa" do Grimório); cada uma pode apontar para 1 pasta do Labirinto. */
export const CAMPANHA = objeto({
  id: texto(),
  nome: texto(),
  /** A pasta de mapas (que é a campanha do Lobby). Ausente = "sem pasta". Só existe no Prelúdio: a reimportação nunca mexe. */
  pastaId: opcional(texto()),
  origem: opcional(ORIGEM),
})

export const INDICE_DO_PREPARO = objeto({
  formato: numero(),
  campanhas: lista(CAMPANHA),
})

// ─── Verbete: verbetes/<id>.json ─────────────────────────────────────────────

export const TIPO_DE_VERBETE = umDe('personagem', 'lugar', 'item', 'faccao', 'pagina', 'sessao')

export const SECAO = objeto({
  /** A seção se revela sozinha (plano: "verbete e partes, uma a uma"), então tem id próprio. */
  id: texto(),
  titulo: texto(),
  texto: TEXTO_RICO,
  /** Seção de segredo: nunca sai do PC. */
  segredo: booleano(),
})

export const IMAGEM_DA_FORMA = objeto({
  /** `midia/<sha256>.<ext>` dentro de preparo/. */
  midia: texto(),
  legenda: texto(),
})

export const ITEM_DO_ACERVO = objeto({
  itemId: texto(),
  qtd: numero(),
})

/** Formas do mesmo verbete (Dia/Noite, Bruce/Hulk): revelar uma não revela a outra. */
export const FORMA = objeto({
  id: texto(),
  nome: texto(),
  /** `midia/<sha256>.<ext>`. */
  retrato: opcional(texto()),
  resumo: texto(),
  secoes: lista(SECAO),
  imagens: lista(IMAGEM_DA_FORMA),
  acervo: opcional(lista(ITEM_DO_ACERVO)),
})

/** Verbete ↔ ficha do Livro: pelo `Personagem.id` do `rpg.json` da pasta. */
export const LIGA_FICHA = objeto({
  pastaId: texto(),
  personagemId: texto(),
})

/** Verbete ↔ cena e pino: chave do mapa em `<appData>/maps`, cena e, se houver, o pino. */
export const LIGA_CENA = objeto({
  chave: texto(),
  sceneId: texto(),
  pinoId: opcional(texto()),
})

export const LIGA = objeto({
  fichas: lista(LIGA_FICHA),
  cenas: lista(LIGA_CENA),
})

export const RECOMPENSA = objeto({
  valor: numero(),
  moeda: texto(),
  quando: texto(),
})

/** Cartaz de procurado (F9). */
export const CARTAZ = objeto({
  /** O histórico da recompensa, em ordem. */
  recompensas: lista(RECOMPENSA),
  situacao: texto(),
  crime: texto(),
})

export const VERBETE = objeto({
  formato: numero(),
  id: texto(),
  tipo: TIPO_DE_VERBETE,
  titulo: texto(),
  apelidos: lista(texto()),
  /** Ids das campanhas (etiquetas) do índice. */
  campanhas: lista(texto()),
  /** Lugar dentro de lugar, página dentro de página. */
  paiId: opcional(texto()),
  /** No plano sem detalhe ainda: fica guardado como veio até a fatia que o usa. */
  organizacao: opcional(lista(qualquer())),
  formas: lista(FORMA),
  formaAtivaId: texto(),
  liga: opcional(LIGA),
  cartaz: opcional(CARTAZ),
  origem: opcional(ORIGEM),
})

// ─── Ligações: ligacoes.json ─────────────────────────────────────────────────

export const LIGACAO = objeto({
  id: texto(),
  /** Id do verbete de onde a ligação sai. */
  de: texto(),
  /** Id do verbete aonde ela chega. */
  para: texto(),
  tipo: texto(),
  notas: texto(),
  segredo: booleano(),
  /** Ausente = criada no Prelúdio: a reimportação não toca. */
  origem: opcional(ORIGEM),
})

export const LIGACOES = objeto({
  formato: numero(),
  ligacoes: lista(LIGACAO),
})

// ─── Linha do tempo: tempo.json ──────────────────────────────────────────────

/** A ordem das eras é a ordem da lista. */
export const ERA = objeto({
  id: texto(),
  nome: texto(),
})

export const FAIXA = objeto({
  id: texto(),
  nome: texto(),
})

/** Era + ano, mês e dia opcionais, rótulo livre (resposta do mestre, 08/11). */
export const QUANDO = objeto({
  /** Id da era. */
  era: texto(),
  ano: numero(),
  mes: opcional(numero()),
  dia: opcional(numero()),
  rotulo: opcional(texto()),
})

export const EVENTO = objeto({
  id: texto(),
  titulo: texto(),
  quando: QUANDO,
  ate: opcional(QUANDO),
  /** Id da faixa. */
  faixa: opcional(texto()),
  /** Ids dos verbetes do evento. */
  verbetes: lista(texto()),
  resumo: texto(),
  segredo: booleano(),
  sessaoId: opcional(texto()),
})

export const TEMPO = objeto({
  formato: numero(),
  eras: lista(ERA),
  faixas: lista(FAIXA),
  eventos: lista(EVENTO),
})

// ─── Quadro: quadros/<id>.json ───────────────────────────────────────────────

export const QUADRO = objeto({
  formato: numero(),
  nome: texto(),
  campanhaId: opcional(texto()),
  sessaoId: opcional(texto()),
  /** A foto do documento do tldraw, intacta: o tldraw tem esquema e migração próprios. */
  tldraw: qualquer(),
  origem: opcional(ORIGEM),
})

// ─── Atlas: atlas/<id>.json ──────────────────────────────────────────────────

export const MARCADOR = objeto({
  id: texto(),
  /** De 0 a 1, da esquerda para a direita da imagem. */
  x: numero(),
  /** De 0 a 1, de cima para baixo. */
  y: numero(),
  verbeteId: opcional(texto()),
  /** Mapa dentro de mapa: o atlas que este marcador abre. */
  atlasFilhoId: opcional(texto()),
  rotulo: texto(),
})

export const ATLAS = objeto({
  formato: numero(),
  /** `midia/<sha256>.<ext>`. */
  imagem: texto(),
  paiId: opcional(texto()),
  marcadores: lista(MARCADOR),
})

// ─── Revelado: revelado/<campanhaId>.json ────────────────────────────────────

export const ALVO_DA_REVELACAO = objeto({
  tipo: umDe('verbete', 'forma', 'secao', 'ligacao', 'evento', 'marcador', 'atlas', 'cartaz'),
  id: texto(),
})

const TODOS = 'todos'
const CONTAS = lista(texto())

/** `'todos'` = o grupo inteiro; senão, os ids das contas dos jogadores escolhidos. */
const PARA_QUEM: Molde<typeof TODOS | string[]> = {
  ler: (bruto, onde) => (bruto === TODOS ? { ok: true, valor: TODOS } : CONTAS.ler(bruto, onde)),
  gravar: (valor) => valor,
}

/** Tudo começa oculto: só o que tem revelação aqui chega ao jogador. */
export const REVELACAO = objeto({
  alvo: ALVO_DA_REVELACAO,
  para: PARA_QUEM,
  /** Quando foi revelado (ISO 8601). */
  quando: texto(),
  sessaoId: opcional(texto()),
})

export const REVELADO = objeto({
  formato: numero(),
  revelacoes: lista(REVELACAO),
})

// ─── O que veio do Grimório e é só leitura no Prelúdio ───────────────────────
//
// O chat de IA, as posições da Teia e a lixeira do Grimório entram como vieram
// (plano §4, passo 4) e a reimportação troca inteiros: o Prelúdio ainda não
// edita nenhum dos três.

/** Um arquivo do cofre guardado como veio: o caminho dele no cofre e o JSON. */
export const ARQUIVO_COMO_VEIO = objeto({
  caminho: texto(),
  conteudo: qualquer(),
})

/** chats/<donoId>.json: o chat de IA da sessão, do caderno ou do quadro dono (pode haver mais de um com o mesmo dono). */
export const CHATS = objeto({
  formato: numero(),
  donoId: texto(),
  chats: lista(ARQUIVO_COMO_VEIO),
})

/** `{ x, y }` em fração da moldura, por escopo (`cofre` ou `campanha:<id>`) e id: o `layout-teia.json` com os ids do Prelúdio. */
function ehPosicoesDaTeia(bruto: unknown): bruto is Readonly<Record<string, Readonly<Record<string, { x: number; y: number }>>>> {
  if (!ehRegistro(bruto)) return false
  return Object.values(bruto).every(
    (escopo) =>
      ehRegistro(escopo) &&
      Object.values(escopo).every((posicao) => ehRegistro(posicao) && typeof posicao.x === 'number' && Number.isFinite(posicao.x) && typeof posicao.y === 'number' && Number.isFinite(posicao.y)),
  )
}

/** teia.json: as posições que o mestre arrumou na Teia do Grimório. */
export const TEIA = objeto({
  formato: numero(),
  porEscopo: intacto(ehPosicoesDaTeia, 'as posições da Teia (escopo → id → {x, y})'),
  origem: opcional(ORIGEM),
})

/** lixeira/do-grimorio/<id>.json: uma entrada da lixeira do Grimório (`.lixeira/<id>/`), com o que foi apagado. */
export const ENTRADA_DA_LIXEIRA = objeto({
  formato: numero(),
  id: texto(),
  arquivos: lista(ARQUIVO_COMO_VEIO),
  origem: opcional(ORIGEM),
})

/**
 * importacoes/vindos-do-grimorio.json: os ids que alguma importação aplicada
 * gravou. Veio do Grimório, está aqui e não está mais no Prelúdio = o mestre
 * apagou, e a reimportação não traz de volta (plano §4, passo 7).
 */
export const VINDOS_DO_GRIMORIO = objeto({
  formato: numero(),
  verbetes: lista(texto()),
  quadros: lista(texto()),
  ligacoes: lista(texto()),
  campanhas: lista(texto()),
})

// ─── Os tipos ────────────────────────────────────────────────────────────────

export type ArquivoComoVeio = Valor<typeof ARQUIVO_COMO_VEIO>
export type Chats = Valor<typeof CHATS>
export type Teia = Valor<typeof TEIA>
export type EntradaDaLixeiraNoPreludio = Valor<typeof ENTRADA_DA_LIXEIRA>
export type VindosDoGrimorio = Valor<typeof VINDOS_DO_GRIMORIO>
export type Campanha = Valor<typeof CAMPANHA>
export type IndiceDoPreparo = Valor<typeof INDICE_DO_PREPARO>
export type TipoDeVerbete = Valor<typeof TIPO_DE_VERBETE>
export type Secao = Valor<typeof SECAO>
export type ImagemDaForma = Valor<typeof IMAGEM_DA_FORMA>
export type ItemDoAcervo = Valor<typeof ITEM_DO_ACERVO>
export type Forma = Valor<typeof FORMA>
export type LigaFicha = Valor<typeof LIGA_FICHA>
export type LigaCena = Valor<typeof LIGA_CENA>
export type Recompensa = Valor<typeof RECOMPENSA>
export type Cartaz = Valor<typeof CARTAZ>
export type Origem = Valor<typeof ORIGEM>
export type Verbete = Valor<typeof VERBETE>
export type Ligacao = Valor<typeof LIGACAO>
export type Ligacoes = Valor<typeof LIGACOES>
export type Era = Valor<typeof ERA>
export type Faixa = Valor<typeof FAIXA>
export type Quando = Valor<typeof QUANDO>
export type Evento = Valor<typeof EVENTO>
export type Tempo = Valor<typeof TEMPO>
export type Quadro = Valor<typeof QUADRO>
export type Marcador = Valor<typeof MARCADOR>
export type Atlas = Valor<typeof ATLAS>
export type AlvoDaRevelacao = Valor<typeof ALVO_DA_REVELACAO>
export type Revelacao = Valor<typeof REVELACAO>
export type Revelado = Valor<typeof REVELADO>

// ─── Os arquivos ─────────────────────────────────────────────────────────────

/** Um tipo de arquivo de preparo/: o molde e o formato que esta versão do app escreve e entende por inteiro. */
export interface ArquivoDoPreparo<T extends { formato: number }> {
  readonly formato: number
  readonly molde: Molde<T>
}

export const ARQUIVO_DO_INDICE: ArquivoDoPreparo<IndiceDoPreparo> = { formato: 1, molde: INDICE_DO_PREPARO }
export const ARQUIVO_DO_VERBETE: ArquivoDoPreparo<Verbete> = { formato: 1, molde: VERBETE }
export const ARQUIVO_DAS_LIGACOES: ArquivoDoPreparo<Ligacoes> = { formato: 1, molde: LIGACOES }
export const ARQUIVO_DO_TEMPO: ArquivoDoPreparo<Tempo> = { formato: 1, molde: TEMPO }
export const ARQUIVO_DO_QUADRO: ArquivoDoPreparo<Quadro> = { formato: 1, molde: QUADRO }
export const ARQUIVO_DO_ATLAS: ArquivoDoPreparo<Atlas> = { formato: 1, molde: ATLAS }
export const ARQUIVO_DO_REVELADO: ArquivoDoPreparo<Revelado> = { formato: 1, molde: REVELADO }
export const ARQUIVO_DOS_CHATS: ArquivoDoPreparo<Chats> = { formato: 1, molde: CHATS }
export const ARQUIVO_DA_TEIA: ArquivoDoPreparo<Teia> = { formato: 1, molde: TEIA }
export const ARQUIVO_DA_LIXEIRA: ArquivoDoPreparo<EntradaDaLixeiraNoPreludio> = { formato: 1, molde: ENTRADA_DA_LIXEIRA }
export const ARQUIVO_DOS_VINDOS: ArquivoDoPreparo<VindosDoGrimorio> = { formato: 1, molde: VINDOS_DO_GRIMORIO }
