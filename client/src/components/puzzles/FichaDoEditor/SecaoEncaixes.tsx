import { CampoLiga } from '../../grimorio/CampoLiga'
import { CampoSeg } from '../../grimorio/CampoSeg'
import { classes } from '../../grimorio/comum'
import { FORMAS_DO_ENCAIXE, NOME_DA_PECA_MAX, TAMANHO_DO_ENCAIXE_MAX, TAMANHO_DO_ENCAIXE_MIN, type EncaixeDoPuzzle, type FormaDoEncaixe, type Puzzle } from '../../../puzzles/tipos'
import { NOME_DA_COMBINACAO } from '../../../puzzles/combinacao'
import { NOME_DAS_GIRATORIAS } from '../../../puzzles/giratorias/giratorias'
import { NOME_DOS_INTERRUPTORES } from '../../../puzzles/interruptores/interruptores'
import { comEncaixe, comMecanica, encaixeComPeca, encaixeComViraDoPar, encaixeDoJeito, encaixeDoTamanho, mecanicaDoEditor, type MecanicaDoEditor } from '../edicao'
import { imagemDoItem, NOMES_DAS_PECAS_INTEIRAS, viraDoPar, type PecaDoEditor, type PecasDoEditor } from '../pecasDoEditor'
import { Secao, SeletorDePeca, type PropsDaSecao, type UsarPeca } from './comum'

const NOME_DA_FORMA: Readonly<Record<FormaDoEncaixe, string>> = {
  redondo: 'Redondo',
  brasao: 'Brasão',
  joia: 'Joia',
  quadrado: 'Quadrado',
}

/** As duas metades, pela posição em `metades`. */
const LADOS: readonly (0 | 1)[] = [0, 1]

const MECANICAS: readonly { valor: MecanicaDoEditor; rotulo: string }[] = [
  { valor: 'encaixe', rotulo: 'Encaixe' },
  { valor: 'ordem', rotulo: 'Ordem certa' },
  { valor: 'numeros', rotulo: NOME_DA_COMBINACAO.numeros },
  { valor: 'simbolos', rotulo: NOME_DA_COMBINACAO.simbolos },
  { valor: 'relogio', rotulo: NOME_DA_COMBINACAO.relogio },
  { valor: 'botoes', rotulo: NOME_DA_COMBINACAO.botoes },
  { valor: 'giratorias', rotulo: NOME_DAS_GIRATORIAS },
  { valor: 'interruptores', rotulo: NOME_DOS_INTERRUPTORES },
]

const JEITOS: readonly { valor: EncaixeDoPuzzle['jeito']; rotulo: string }[] = [
  { valor: 'peca', rotulo: 'Uma peça' },
  { valor: 'metades', rotulo: 'Duas metades' },
]

/** "Mecânica" (v2): Encaixe, com ou sem "qualquer peça em qualquer encaixe", Ordem certa, ou um dos 4 tipos de combinação. */
export function SecaoMecanica({ puzzle, mudar }: PropsDaSecao) {
  const mecanica = mecanicaDoEditor(puzzle)
  return (
    <Secao titulo="Mecânica">
      <CampoSeg
        nomeAcessivel="Mecânica do puzzle"
        opcoes={MECANICAS}
        valor={mecanica}
        forma="grade"
        onChange={(valor) => {
          if (valor !== mecanica) mudar((atual) => comMecanica(atual, valor))
        }}
      />
      {mecanica === 'giratorias' ? (
        <p className="pze-nota">Peças giratórias: o jogador gira os anéis do medalhão até o desenho fechar (ou os símbolos certos ficarem sob a marca). A resposta fica só com você, e girar errado não castiga. Os encaixes ficam guardados para quando voltar ao Encaixe.</p>
      ) : mecanica === 'interruptores' ? (
        <p className="pze-nota">Interruptores com estado: um painel de lampiões a gás, cada um com a sua alavanca. Puxar uma alavanca acende ou apaga o lampião dela e os ligados a ela; o painel cede quando os lampiões ficam como o objetivo pede. A regra fica só com você, e puxar não castiga. Os encaixes ficam guardados para quando voltar ao Encaixe.</p>
      ) : mecanica !== 'encaixe' && mecanica !== 'ordem' ? (
        <p className="pze-nota">Combinação: a resposta fica só com você. O jogador mexe no controle sobre a imagem e tenta; errar castiga. Os encaixes ficam guardados para quando voltar ao Encaixe.</p>
      ) : mecanica === 'encaixe' ? (
        <CampoLiga
          rotulo="Qualquer peça do puzzle serve em qualquer encaixe"
          ajuda={puzzle.regra === 'qualquerLugar' ? 'Como a Fonte: as peças certas formam um conjunto, e a ordem não importa.' : 'Como o Altar: cada encaixe só aceita a peça dele, e a errada nem entra.'}
          ligado={puzzle.regra === 'qualquerLugar'}
          onChange={(ligado) => mudar({ ...puzzle, regra: ligado ? 'qualquerLugar' : 'lugarCerto' })}
        />
      ) : (
        <p className="pze-nota">Ordem certa: qualquer peça do puzzle entra em qualquer encaixe, e a tranca só cede com cada peça no seu número. Errar a ordem castiga.</p>
      )}
    </Secao>
  )
}

interface PropsDosEncaixes extends PropsDaSecao {
  pecas: PecasDoEditor
  escolhido: string | null
  onEscolher: (encaixeId: string | null) => void
  onTirar: (encaixeId: string) => void
  usarPeca: UsarPeca
}

export function SecaoEncaixes({ puzzle, mudar, pecas, escolhido, onEscolher, onTirar, usarPeca }: PropsDosEncaixes) {
  /**
   * A peça escolhida no seletor; a desenhada entra no acervo e só então vira a
   * peça certa (no puzzle de agora). No encaixe de metades, o par desenhado
   * completo preenche "Juntas, viram" com a peça inteira.
   */
  const escolherPeca = (encaixeId: string, peca: PecaDoEditor | null, aplicar: (encaixe: EncaixeDoPuzzle, itemId: string | null) => EncaixeDoPuzzle, completar = true) => {
    const aplicarEContar = (itemId: string | null) => {
      mudar((atual) => comEncaixe(atual, encaixeId, (encaixe) => aplicar(encaixe, itemId)))
      // As metades que ficam, pelo encaixe desta tela; se o puzzle mudou nesse meio, `encaixeComViraDoPar` não acha as mesmas e não mexe.
      const encaixe = puzzle.encaixes.find((candidato) => candidato.id === encaixeId)
      const depois = encaixe === undefined ? null : aplicar(encaixe, itemId)
      if (completar && depois?.jeito === 'metades') completarViraDoPar(encaixeId, depois.metades, pecas, usarPeca, mudar)
    }
    if (peca === null) {
      aplicarEContar(null)
      return
    }
    void usarPeca(peca).then((itemId) => {
      if (itemId !== null) aplicarEContar(itemId)
    })
  }
  return (
    <Secao titulo="Encaixes e peças certas" conta={puzzle.encaixes.length}>
      {puzzle.encaixes.length === 0 ? (
        <p className="pze-vazio">Nenhum encaixe. Use “Adicionar encaixe” embaixo do quadro.</p>
      ) : (
        <ol className="pze-encaixes">
          {puzzle.encaixes.map((encaixe, i) => (
            <LinhaDoEncaixe
              key={encaixe.id}
              puzzle={puzzle}
              encaixe={encaixe}
              numero={i + 1}
              escolhido={escolhido === encaixe.id}
              pecas={pecas}
              mudar={mudar}
              onEscolher={onEscolher}
              onTirar={onTirar}
              escolherPeca={escolherPeca}
            />
          ))}
        </ol>
      )}
      <p className="pze-nota">Também dá para arrastar uma peça da biblioteca até o encaixe no quadro.</p>
    </Secao>
  )
}

interface PropsDaLinha {
  puzzle: Puzzle
  encaixe: EncaixeDoPuzzle
  numero: number
  escolhido: boolean
  pecas: PecasDoEditor
  mudar: PropsDaSecao['mudar']
  onEscolher: (encaixeId: string | null) => void
  onTirar: (encaixeId: string) => void
  escolherPeca: (encaixeId: string, peca: PecaDoEditor | null, aplicar: (encaixe: EncaixeDoPuzzle, itemId: string | null) => EncaixeDoPuzzle, completar?: boolean) => void
}

function LinhaDoEncaixe({ puzzle, encaixe, numero, escolhido, pecas, mudar, onEscolher, onTirar, escolherPeca }: PropsDaLinha) {
  const mudarEste = (mudanca: (atual: EncaixeDoPuzzle) => EncaixeDoPuzzle, chave?: string) => mudar(comEncaixe(puzzle, encaixe.id, mudanca), chave)
  return (
    <li
      className={classes('pze-encaixe', escolhido && 'is-escolhido')}
      onFocus={() => {
        if (!escolhido) onEscolher(encaixe.id)
      }}
    >
      <span className="pze-num" aria-hidden="true">
        {numero}
      </span>
      {encaixe.jeito === 'peca' ? (
        <SeletorDePeca
          pecas={pecas}
          valor={encaixe.itemId}
          vazio="Escolha a peça certa…"
          rotulo={`Peça certa do encaixe ${numero}`}
          onEscolher={(peca) => escolherPeca(encaixe.id, peca, (atual, itemId) => (atual.jeito === 'peca' ? { ...atual, itemId } : atual))}
        />
      ) : (
        <span className="pze-encaixe__metades">Duas metades viram uma peça só</span>
      )}
      <button type="button" className="pze-bt-ico" aria-label={`Tirar o encaixe ${numero}`} title="Tirar o encaixe" onClick={() => onTirar(encaixe.id)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />
        </svg>
      </button>
      <div className="pze-encaixe__sub">
        <select className="gr-entrada" aria-label={`Forma do encaixe ${numero}`} value={encaixe.forma} onChange={(evento) => mudarEste((atual) => ({ ...atual, forma: formaLida(evento.currentTarget.value, atual.forma) }))}>
          {FORMAS_DO_ENCAIXE.map((forma) => (
            <option key={forma} value={forma}>
              {NOME_DA_FORMA[forma]}
            </option>
          ))}
        </select>
        <input
          type="range"
          className="pze-faixa"
          min={TAMANHO_DO_ENCAIXE_MIN}
          max={TAMANHO_DO_ENCAIXE_MAX}
          step={0.2}
          value={encaixe.t}
          aria-label={`Tamanho do encaixe ${numero}`}
          onChange={(evento) => mudarEste((atual) => encaixeDoTamanho(atual, Number(evento.currentTarget.value)), `tamanho:${encaixe.id}`)}
        />
      </div>
      <div className="pze-encaixe__sub pze-encaixe__sub--largo">
        <CampoSeg nomeAcessivel={`Jeito do encaixe ${numero}`} opcoes={JEITOS} valor={encaixe.jeito} onChange={(jeito) => jeito !== encaixe.jeito && mudarEste((atual) => encaixeDoJeito(atual, jeito))} />
      </div>
      {encaixe.jeito === 'metades' && (
        <div className="pze-encaixe__sub pze-encaixe__sub--largo pze-metades">
          {LADOS.map((lado) => (
            <SeletorDePeca
              key={lado}
              pecas={pecas}
              valor={encaixe.metades[lado]}
              vazio={lado === 0 ? 'Primeira metade…' : 'Segunda metade…'}
              rotulo={`${lado === 0 ? 'Primeira' : 'Segunda'} metade do encaixe ${numero}`}
              onEscolher={(peca) => escolherPeca(encaixe.id, peca, (atual, itemId) => (atual.jeito === 'metades' ? { ...atual, metades: lado === 0 ? [itemId, atual.metades[1]] : [atual.metades[0], itemId] } : atual))}
            />
          ))}
          <label className="gr-campo">
            <span className="gr-campo__rot">Juntas, viram</span>
            <input
              className="gr-entrada"
              value={encaixe.vira.nome}
              maxLength={NOME_DA_PECA_MAX}
              onChange={(evento) => {
                const nome = evento.currentTarget.value
                mudarEste((atual) => (atual.jeito === 'metades' ? { ...atual, vira: { ...atual.vira, nome } } : atual), `vira:${encaixe.id}`)
              }}
            />
          </label>
          <SeletorDePeca
            pecas={pecas}
            valor={null}
            vazio={encaixe.vira.imagem === null ? 'Imagem da peça inteira: nenhuma' : 'Imagem da peça inteira: escolhida'}
            rotulo={`Imagem da peça inteira do encaixe ${numero}`}
            onEscolher={(peca) =>
              // A desenhada que ainda não está no acervo entra antes: a imagem do jogador vem da mídia da mesa.
              escolherPeca(encaixe.id, peca, (atual, itemId) => (atual.jeito === 'metades' ? { ...atual, vira: { ...atual.vira, imagem: itemId === null ? null : imagemDoItem(itemId) } } : atual), false)
            }
          />
        </div>
      )}
    </li>
  )
}

function formaLida(valor: string, atual: FormaDoEncaixe): FormaDoEncaixe {
  return FORMAS_DO_ENCAIXE.find((forma) => forma === valor) ?? atual
}

/** Para a biblioteca e o quadro: põe a peça no encaixe (a peça certa, ou a metade que falta). */
export function comPecaNoEncaixe(puzzle: Puzzle, encaixeId: string, itemId: string): Puzzle {
  return comEncaixe(puzzle, encaixeId, (encaixe) => encaixeComPeca(encaixe, itemId))
}

/**
 * As metades `metades` do encaixe formam um par desenhado: "Juntas, viram"
 * ganha o nome e a imagem da peça inteira (posta no acervo antes), se o
 * encaixe ainda tem essas metades e o mestre não deu um nome dele.
 */
export function completarViraDoPar(encaixeId: string, metades: readonly [string | null, string | null], pecas: PecasDoEditor, usarPeca: UsarPeca, mudar: PropsDaSecao['mudar']): void {
  void viraDoPar(metades, pecas, usarPeca).then((vira) => {
    if (vira !== null) mudar((atual) => comEncaixe(atual, encaixeId, (encaixe) => encaixeComViraDoPar(encaixe, metades, vira, NOMES_DAS_PECAS_INTEIRAS)))
  })
}
