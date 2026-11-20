import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ImagemDaMesa } from '../../../components/ImagemDaMesa'
import { idDoItemDaPeca } from '../../../lib/acervoDeItens'
import { resolverComBase, URL_DA_MIDIA_NA_SALA, type ResolverDeImagem } from '../../../lib/midia'
import { IDS_DAS_PECAS_DESENHADAS, urlDaPeca } from '../../../puzzles/arte/pecas'
import { progressoInicial } from '../../../puzzles/motor'
import { combinacaoPadrao } from '../../../puzzles/combinacao'
import { PECAS_DESENHADAS, puzzleDoModelo } from '../../../puzzles/padroes'
import { CATEGORIA_DA_PECA_DE_PUZZLE } from '../../../puzzles/tipos'
import type { IdDaPecaDesenhada, PecaDoAcervo, ProgressoDoPuzzle, Puzzle, QuemMexe } from '../../../puzzles/tipos'
import { themeCss } from '../../../theme'
import type { CarriedItem } from '../../../types/map'
import { useJogoLocalDoPuzzle, type JogoLocalDoPuzzle } from '../jogoLocal'
import { TelaDoPuzzle } from '../TelaDoPuzzle'

/**
 * VITRINE DA TELA DO JOGADOR NO PUZZLE — só para desenvolvimento e provas, fora
 * do build (não está nas entradas do vite.config.ts). O motor e o recorte de
 * verdade rodam no navegador (`jogoLocal.ts`), no lugar do host, até a ligação
 * com a rede (onda 4). Sair mostra o puzzle "de fora"; Examinar volta com
 * tudo guardado.
 *
 *   npm run dev  ->  http://localhost:1420/src/player/puzzle/vitrine/vitrine.html
 *   ?puzzle=fonte (padrão) | porta | altar | imagem
 *   ?desfecho=texto | cena   (troca o modo do desfecho do puzzle escolhido)
 *   window.__vitrinePuzzle.estado()  o progresso, a mochila e os PV de agora
 */

const parametros = new URLSearchParams(location.search)

const estilo = document.createElement('style')
estilo.textContent = `${themeCss()}\nbody { font-family: var(--lb-font-sans); color: var(--lb-color-parchment); }`
document.head.append(estilo)

// A vitrine desenha as peças pelo SVG de `arte/pecas.ts`, sem gravar na mídia; o resto como na sala.
const daSala = resolverComBase(URL_DA_MIDIA_NA_SALA)
const resolverDaVitrine: ResolverDeImagem = (valor) => (typeof valor === 'string' && valor.startsWith('data:image/svg+xml') ? valor : daSala(valor))

// ------------------------------------------------------------------ o acervo de mentira

function pecaDesenhada(id: IdDaPecaDesenhada): PecaDoAcervo {
  return { nome: PECAS_DESENHADAS[id].nome, descricao: PECAS_DESENHADAS[id].descricao, imagem: urlDaPeca(id), categoria: CATEGORIA_DA_PECA_DE_PUZZLE, itemId: idDoItemDaPeca(id) }
}

function pecaSemDesenho(itemId: string, nome: string): PecaDoAcervo {
  return { nome, categoria: CATEGORIA_DA_PECA_DE_PUZZLE, itemId }
}

const PEDRAS = {
  leve: pecaSemDesenho('item_pedra_leve', 'Pedra de rio'),
  media: pecaSemDesenho('item_pedra_media', 'Pedra de muro'),
  pesada: pecaSemDesenho('item_pedra_pesada', 'Pedra de moinho'),
}
const METADES = {
  dentes: pecaSemDesenho('item_metade_dentes', 'Metade com dentes'),
  eixo: pecaSemDesenho('item_metade_eixo', 'Metade com eixo'),
}
const CORDA: PecaDoAcervo = { nome: 'Corda de cânhamo', categoria: 'Ferramenta', itemId: 'item_corda' }
const POCAO: PecaDoAcervo = { nome: 'Poção vermelha', categoria: 'Consumível', itemId: 'item_pocao', quantidade: 2 }

const ACERVO = new Map<string, PecaDoAcervo>(
  [...IDS_DAS_PECAS_DESENHADAS.map(pecaDesenhada), ...Object.values(PEDRAS), ...Object.values(METADES), CORDA, POCAO].flatMap((peca) =>
    peca.itemId === undefined ? [] : [[peca.itemId, peca] as const],
  ),
)

function pecaDoAcervo(itemId: string): PecaDoAcervo | null {
  return ACERVO.get(itemId) ?? null
}

let vagas = 0
function vaga(peca: PecaDoAcervo): CarriedItem {
  vagas += 1
  return { ...peca, id: `vaga-${vagas}` }
}

const EU: QuemMexe = { personagemId: 'p-lara', tokenId: 't-lara', nome: 'Lara' }
const BENTO: QuemMexe = { personagemId: 'p-bento', tokenId: 't-bento', nome: 'Bento' }

// ------------------------------------------------------------------ os puzzles de exemplo (os do protótipo)

interface Exemplo {
  puzzle: Puzzle
  mochila: CarriedItem[]
  progresso?: ProgressoDoPuzzle
}

function pecasDoModelo(ids: IdDaPecaDesenhada[]): Partial<Record<IdDaPecaDesenhada, string>> {
  return Object.fromEntries(ids.map((id) => [id, idDoItemDaPeca(id)]))
}

function fonte(): Exemplo {
  const puzzle = puzzleDoModelo('fonte', pecasDoModelo(['med-garca', 'med-sapo', 'med-junco']))
  puzzle.nomePublico = 'Fonte das Três Garças'
  puzzle.dica = { tipo: 'texto', texto: 'Três bicos secos. Cada um espera um medalhão.' }
  puzzle.desfecho = {
    modo: 'cena',
    texto: 'A água volta a correr pelos três bicos. No fundo da bacia, uma chave pequena brilha.',
    itens: [{ item: pecaDesenhada('chave-jardim'), quantidade: 1 }],
    moedas: 12,
    documentos: [],
    abrePorta: false,
  }
  // Bento já pôs o Sapo no encaixe do meio: o "posto por Bento".
  const progresso = progressoInicial(puzzle)
  progresso.encaixes.e2 = { vaga: vaga(pecaDesenhada('med-sapo')), por: BENTO }
  progresso.rev = 1
  const mochila = [vaga(pecaDesenhada('med-garca')), vaga(CORDA), vaga(pecaDesenhada('med-junco')), vaga(pecaDesenhada('chave-latao')), vaga(POCAO), vaga(pecaDesenhada('engr-ferro'))]
  return { puzzle, mochila, progresso }
}

function porta(): Exemplo {
  const puzzle = puzzleDoModelo('porta', pecasDoModelo(['bra-carvalho', 'bra-lobo', 'bra-lua', 'bra-sol']))
  puzzle.nomePublico = 'Porta dos Quatro Brasões'
  puzzle.dica = { tipo: 'texto', texto: 'Da sombra à aurora.' }
  puzzle.castigo = { tipo: 'dano', pv: 3, texto: 'Dardos saem das frestas da porta.' }
  puzzle.desfecho = { modo: 'cena', texto: 'Os quatro brasões afundam juntos. A tranca cede e a porta range para dentro.', itens: [], moedas: 0, documentos: [], abrePorta: true }
  const mochila = (['bra-sol', 'bra-lua', 'bra-lobo', 'bra-carvalho', 'chave-latao'] as const).map((id) => vaga(pecaDesenhada(id)))
  return { puzzle, mochila }
}

function altar(): Exemplo {
  const puzzle = puzzleDoModelo('altar', pecasDoModelo(['joia-ambar', 'joia-safira', 'engr-bronze']))
  puzzle.nomePublico = 'Altar da Roda'
  const [primeiro, segundo, terceiro] = puzzle.encaixes
  if (primeiro !== undefined && segundo !== undefined && terceiro !== undefined) {
    // O terceiro encaixe pede as duas metades: juntas, viram a engrenagem de bronze.
    puzzle.encaixes = [primeiro, segundo, { ...terceiro, jeito: 'metades', metades: [METADES.dentes.itemId ?? null, METADES.eixo.itemId ?? null], vira: { nome: 'Engrenagem de bronze', imagem: urlDaPeca('engr-bronze') } }]
  }
  puzzle.troca = {
    guarda: idDoItemDaPeca('joia-ambar'),
    peso: 4,
    pesos: { [PEDRAS.leve.itemId ?? '']: 1, [PEDRAS.media.itemId ?? '']: 2, [PEDRAS.pesada.itemId ?? '']: 3 },
    x: 79,
    y: 54,
  }
  puzzle.dica = { tipo: 'texto', texto: 'O fogo, o céu e a roda. A joia quente só sai por um peso igual.' }
  puzzle.castigo = { tipo: 'armadilha', pv: 2, texto: 'Uma lâmina corre rente ao pedestal.' }
  puzzle.desfecho = {
    modo: 'texto',
    texto: 'O altar range. Uma gaveta de pedra desliza para fora com um cálice e uma poção.',
    itens: [
      { item: { nome: 'Cálice de prata', categoria: 'Tesouro', itemId: 'item_calice' }, quantidade: 1 },
      { item: { ...POCAO, quantidade: undefined }, quantidade: 1 },
    ],
    moedas: 0,
    documentos: [],
    abrePorta: false,
  }
  const mochila = [vaga(pecaDesenhada('joia-safira')), vaga(METADES.dentes), vaga(METADES.eixo), vaga(PEDRAS.leve), vaga(PEDRAS.media), vaga(PEDRAS.pesada), vaga(pecaDesenhada('engr-ferro'))]
  return { puzzle, mochila }
}

function imagem(): Exemplo {
  const base = puzzleDoModelo('fonte', pecasDoModelo(['chave-jardim', 'chave-latao']))
  const puzzle: Puzzle = {
    ...base,
    nomePublico: 'Baú do escrivão',
    regra: 'lugarCerto',
    visual: { tipo: 'imagem', imagem: null },
    encaixes: [
      { id: 'e1', x: 40, y: 50, t: 9, forma: 'quadrado', jeito: 'peca', itemId: idDoItemDaPeca('chave-jardim') },
      { id: 'e2', x: 60, y: 50, t: 9, forma: 'quadrado', jeito: 'peca', itemId: idDoItemDaPeca('chave-latao') },
    ],
    desfecho: { modo: 'cena', texto: 'As duas fechaduras cedem ao mesmo tempo.', itens: [], moedas: 5, documentos: [], abrePorta: false },
  }
  const mochila = [vaga(pecaDesenhada('chave-latao')), vaga(pecaDesenhada('chave-jardim')), vaga(pecaDesenhada('joia-safira'))]
  return { puzzle, mochila }
}

/** O Cofre do Capitão do v2 (passo "Cadeia"): rodas de números, código 318, com dano ao errar. */
function cofre(): Exemplo {
  const puzzle = puzzleDoModelo('cofre')
  puzzle.nomePublico = 'Cofre do Capitão'
  puzzle.dica = { tipo: 'texto', texto: 'Conte os degraus antes de dormir.' }
  puzzle.castigo = { tipo: 'dano', pv: 3, texto: '' }
  puzzle.desfecho = { modo: 'cena', texto: 'A porta do cofre gira nas dobradiças. Dentro, um diário encadernado em couro.', itens: [], moedas: 30, documentos: [], abrePorta: false }
  return { puzzle, mochila: [vaga(CORDA), vaga(POCAO)] }
}

/** As outras três combinações do v2, sobre o mesmo Cofre (`?puzzle=simbolos`, `relogio`, `botoes`). */
function combinacaoNoCofre(forma: 'simbolos' | 'relogio' | 'botoes', nome: string, castigo: Puzzle['castigo']): () => Exemplo {
  return () => {
    const exemplo = cofre()
    exemplo.puzzle.futuro = combinacaoPadrao(forma)
    exemplo.puzzle.nomePublico = nome
    exemplo.puzzle.castigo = castigo
    return exemplo
  }
}

const EXEMPLOS = {
  fonte,
  porta,
  altar,
  imagem,
  cofre,
  simbolos: combinacaoNoCofre('simbolos', 'Cofre das Marés', { tipo: 'barulho', texto: '' }),
  relogio: combinacaoNoCofre('relogio', 'Relógio da Torre', { tipo: 'armadilha', pv: 2, texto: '' }),
  botoes: combinacaoNoCofre('botoes', 'Painel dos Quatro Botões', { tipo: 'nada' }),
} as const
type NomeDoExemplo = keyof typeof EXEMPLOS

function ehNomeDoExemplo(valor: string): valor is NomeDoExemplo {
  return Object.hasOwn(EXEMPLOS, valor)
}

const pedido = parametros.get('puzzle') ?? 'fonte'
const exemplo = EXEMPLOS[ehNomeDoExemplo(pedido) ? pedido : 'fonte']()
const modo = parametros.get('desfecho')
if (modo === 'texto' || modo === 'cena') exemplo.puzzle.desfecho.modo = modo

// ------------------------------------------------------------------ a mesa

function Vitrine() {
  const jogo = useJogoLocalDoPuzzle({ desafioId: 'vitrine', puzzle: exemplo.puzzle, mochila: exemplo.mochila, quem: EU, pv: { atual: 20, max: 20 }, pecaDoAcervo, progresso: exemplo.progresso })
  const [dentro, setDentro] = useState(true)
  Reflect.set(window, '__vitrinePuzzle', { estado: () => ({ progresso: jogo.progresso, mochila: jogo.vista.mochila, pv: jogo.pv, dentro }) })
  return (
    <ImagemDaMesa.Provider value={resolverDaVitrine}>
      {dentro ? (
        <TelaDoPuzzle vista={jogo.vista} eu={EU.nome} pv={jogo.pv} acontecimentos={jogo.acontecimentos} onAgir={jogo.agir} onSair={() => setDentro(false)} />
      ) : (
        <Fora jogo={jogo} onExaminar={() => setDentro(true)} />
      )}
    </ImagemDaMesa.Provider>
  )
}

/** O puzzle visto do mapa (o `.fora__cartao` do v2): o progresso continua lá. */
function Fora({ jogo, onExaminar }: { jogo: JogoLocalDoPuzzle; onExaminar: () => void }) {
  const { vista } = jogo
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ display: 'grid', gap: 10, width: 'min(460px, 90vw)', padding: '14px 16px', borderRadius: 14, background: 'rgba(19, 19, 23, 0.94)', border: '1px solid var(--lb-color-line-panel)' }}>
        <h2 style={{ margin: 0, font: '400 15px/1.25 var(--lb-font-display)' }}>{vista.titulo}</h2>
        <p data-fora style={{ margin: 0, fontSize: 11.5, color: 'var(--lb-color-parchment-dim)' }}>
          {vista.resolvido ? 'Resolvido.' : `${vista.contagem.postos} de ${vista.contagem.total} no lugar. O que você pôs fica guardado.`}
        </p>
        <button type="button" onClick={onExaminar} style={{ justifySelf: 'start', minHeight: 32, padding: '0 12px', borderRadius: 6, border: '1px solid var(--lb-gr-filete-latao)', background: 'transparent', color: 'var(--lb-color-brass-bright)', font: 'inherit', cursor: 'pointer' }}>
          Examinar
        </button>
        <p style={{ margin: 0, fontSize: 10.5, color: 'var(--lb-color-parchment-faint)' }}>
          Outros exemplos: <a href="?puzzle=fonte">Fonte</a> · <a href="?puzzle=porta">Porta</a> · <a href="?puzzle=altar">Altar</a> · <a href="?puzzle=imagem">Imagem própria</a> · <a href="?puzzle=cofre">Cofre</a> · <a href="?puzzle=simbolos">Símbolos</a> ·{' '}
          <a href="?puzzle=relogio">Relógio</a> · <a href="?puzzle=botoes">Botões</a>
        </p>
      </div>
    </main>
  )
}

const raiz = document.getElementById('raiz')
if (raiz !== null) {
  // Sem exports, o Fast Refresh recarrega a página inteira em vez de montar uma segunda raiz.
  if (Reflect.get(window, '__vitrinePuzzleMontada') === true) location.reload()
  else {
    Reflect.set(window, '__vitrinePuzzleMontada', true)
    createRoot(raiz).render(<Vitrine />)
  }
}
