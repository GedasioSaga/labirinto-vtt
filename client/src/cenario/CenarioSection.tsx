import { useEffect, useId, useState } from 'react'
import { BotaoProcurarAnimacoes } from '../components/ProcurarAnimacoes'
import { CampoChips, type OpcaoDeChip } from '../components/grimorio/CampoChips'
import { CampoSeg, type OpcaoDoSeg } from '../components/grimorio/CampoSeg'
import { CampoSel, type OpcaoDoSel } from '../components/grimorio/CampoTexto'
import { Nota } from '../components/grimorio/Nota'
import { IconeDoLivro } from '../components/livro/icones'
import {
  CENARIO_DURACAO_MAX_S,
  CENARIO_DURACAO_MIN_S,
  CENARIO_DURACAO_NATURAL_S,
  CENARIO_PADRAO,
  MOVIMENTOS,
  cenarioComEstilo,
  type CenarioDoPino,
  type MovimentoId,
} from './catalogo'
import { CenarioPreviewDialog } from './CenarioPreviewDialog'
import { useEstilosDeCenario } from './estilosDeCenario'
import { PreviaDoCenario } from './PreviaDoCenario'
import './previaDoCenario.css'

interface CenarioSectionProps {
  cenario: CenarioDoPino | undefined
  /** A imagem do pino; sem ela não há o que animar. */
  imagem: string | null
  /** "Nome do local" e descrição do pino: a prévia mostra a revelação inteira. Ausentes = painel vazio. */
  nome?: string
  descricao?: string
  onChange: (cenario: CenarioDoPino | undefined) => void
}

type Quando = 'nao' | CenarioDoPino['quando']

const QUANDO: readonly OpcaoDoSel<Quando>[] = [
  { valor: 'nao', rotulo: 'Não, só o cartão' },
  { valor: 'primeira', rotulo: 'Só da primeira vez' },
  { valor: 'sempre', rotulo: 'Sempre' },
]

/** Os efeitos da panorâmica, ícones que ligam e desligam. */
type Efeito = 'nevoa' | 'raios' | 'particulas' | 'som'

const EFEITOS: readonly OpcaoDeChip<Efeito>[] = [
  { valor: 'nevoa', rotulo: 'Névoa', icone: <IconeDoLivro nome="nevoa" /> },
  { valor: 'raios', rotulo: 'Raios de sol', icone: <IconeDoLivro nome="luz" /> },
  { valor: 'particulas', rotulo: 'Partículas', icone: <IconeDoLivro nome="estrela" /> },
  { valor: 'som', rotulo: 'Som do vento', icone: <IconeDoLivro nome="som" /> },
]

/** Seta que mostra o sentido do movimento (ou o "aproximar"). */
function SetaDoMovimento({ id }: { id: MovimentoId }) {
  const caminho: Record<MovimentoId, string> = {
    sobe: 'M8 13V3M4 7l4-4 4 4',
    desce: 'M8 3v10M4 9l4 4 4-4',
    direita: 'M3 8h10M9 4l4 4-4 4',
    esquerda: 'M13 8H3M7 4 3 8l4 4',
    aproxima: 'M3 6V3h3M13 6V3h-3M3 10v3h3M13 10v3h-3',
  }
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={caminho[id]} />
    </svg>
  )
}

/** A câmera dentro da moldura: os movimentos só de ícone (o nome vai no balão e no leitor de tela). */
const CAMERAS: readonly OpcaoDoSeg<MovimentoId>[] = MOVIMENTOS.map((m) => ({ valor: m.id, rotulo: m.nome, icone: <SetaDoMovimento id={m.id} />, soIcone: true }))

/** Valor do seletor "Estilo" para a panorâmica embutida: nenhum id válido é vazio. */
const PANORAMICA = ''

/**
 * ANIMAÇÃO DO CENÁRIO na ficha do pino "!": a prévia viva no topo (Assistir,
 * Ver grande, a duração), o estilo, a câmera e os efeitos da panorâmica, a
 * duração e quando o jogador vê (nunca, só da primeira vez, sempre).
 */
export function CenarioSection({ cenario, imagem, nome = '', descricao = '', onChange }: CenarioSectionProps) {
  const tituloId = useId()
  const [grande, setGrande] = useState(false)
  const quando: Quando = cenario?.quando ?? 'nao'

  function escolherQuando(valor: Quando) {
    if (valor === quando) return
    if (valor === 'nao') onChange(undefined)
    else onChange({ ...(cenario ?? CENARIO_PADRAO), quando: valor })
  }

  return (
    <section className="lb-cenario-secao" aria-labelledby={tituloId}>
      <h3 id={tituloId} className="lb-label">
        Animação do Cenário
      </h3>
      {imagem === null ? (
        <Nota>Coloque uma imagem no pino para animar o cenário.</Nota>
      ) : (
        <>
          {cenario !== undefined && (
            <>
              <PreviaDoCenario imagem={imagem} cenario={cenario} nome={nome} descricao={descricao} onVerGrande={() => setGrande(true)} />
              <CamposDoCenario cenario={cenario} onChange={onChange} />
            </>
          )}
          <CampoSel rotulo="Quando o jogador vê" opcoes={QUANDO} valor={quando} onChange={escolherQuando} />
          {cenario !== undefined && (
            <>
              <p className="lb-travel__hint">
                {cenario.quando === 'sempre'
                  ? 'Toca toda vez que o jogador abre este pino; depois vem o cartão.'
                  : 'Toca na primeira vez que o jogador abre este pino; depois, só o cartão (com "Ver animação").'}
              </p>
              <CenarioPreviewDialog aberto={grande} imagem={imagem} cenario={cenario} nome={nome} descricao={descricao} onClose={() => setGrande(false)} />
            </>
          )}
        </>
      )}
    </section>
  )
}

/** Estilo (com o "Procurar animações novas"), câmera e efeitos da panorâmica, e a duração. */
function CamposDoCenario({ cenario, onChange }: { cenario: CenarioDoPino; onChange: (cenario: CenarioDoPino) => void }) {
  const duracaoId = useId()
  const dicaId = useId()
  const estilos = useEstilosDeCenario()
  const estiloGravado = cenario.estilo
  const estilo = estiloGravado === undefined ? null : (estilos.find((e) => e.id === estiloGravado) ?? null)
  // Id de um pacote que este app ainda não baixou: a opção diz isso em vez de
  // virar "Panorâmica" calada; o seletor não mente sobre o pino.
  const naoInstalado = estiloGravado !== undefined && estilo === null ? estiloGravado : null
  const opcoesDeEstilo: OpcaoDoSel<string>[] = [
    { valor: PANORAMICA, rotulo: 'Panorâmica' },
    ...estilos.map((e) => ({ valor: e.id, rotulo: e.nome })),
    ...(naoInstalado !== null ? [{ valor: naoInstalado, rotulo: `Não instalado (${naoInstalado})` }] : []),
  ]
  const efeitos = EFEITOS.filter((e) => cenario[e.valor]).map((e) => e.valor)

  function mudar(patch: Partial<CenarioDoPino>) {
    onChange({ ...cenario, ...patch })
  }

  return (
    <>
      <CampoSel rotulo="Estilo" opcoes={opcoesDeEstilo} valor={estiloGravado ?? PANORAMICA} onChange={(id) => onChange(cenarioComEstilo(cenario, id === PANORAMICA ? null : id))} />
      <BotaoProcurarAnimacoes />
      {naoInstalado !== null && <Nota>Este estilo ainda não chegou neste app. Até chegar, o jogador vê a panorâmica.</Nota>}
      {/* Câmera, névoa, raios, partículas e vento são da panorâmica: num estilo do pacote não mudam nada. */}
      {estilo === null && (
        <>
          <CampoSeg rotulo="Câmera dentro da moldura" forma="icone" opcoes={CAMERAS} valor={cenario.movimento} onChange={(movimento) => mudar({ movimento })} />
          <CampoChips
            rotulo="Efeitos"
            forma="icones"
            opcoes={EFEITOS}
            valores={efeitos}
            onChange={(ligados) => mudar({ nevoa: ligados.includes('nevoa'), raios: ligados.includes('raios'), particulas: ligados.includes('particulas'), som: ligados.includes('som') })}
          />
        </>
      )}
      <DuracaoDoCenario
        key={`${estiloGravado ?? PANORAMICA}|${cenario.movimento}`}
        inputId={duracaoId}
        dicaId={dicaId}
        duracaoS={cenario.duracaoS}
        naturalS={estilo !== null ? estilo.duracaoNaturalS : CENARIO_DURACAO_NATURAL_S}
        onChange={(duracaoS) => mudar({ duracaoS })}
      />
    </>
  )
}

interface DuracaoProps {
  inputId: string
  dicaId: string
  duracaoS: number | undefined
  /** A natural do que está escolhido: a da panorâmica ou a do estilo do pacote. */
  naturalS: number
  onChange: (duracaoS: number | undefined) => void
}

/** Segundos: vazio = duração natural; grava ao sair do campo ou no Enter, preso ao teto. */
function DuracaoDoCenario({ inputId, dicaId, duracaoS, naturalS, onChange }: DuracaoProps) {
  const [texto, setTexto] = useState(duracaoS === undefined ? '' : String(duracaoS))
  useEffect(() => {
    setTexto(duracaoS === undefined ? '' : String(duracaoS))
  }, [duracaoS])

  function gravar() {
    const limpo = texto.trim().replace(',', '.')
    if (limpo === '') {
      onChange(undefined)
      return
    }
    const lido = Number(limpo)
    if (!Number.isFinite(lido)) {
      setTexto(duracaoS === undefined ? '' : String(duracaoS))
      return
    }
    const preso = Math.min(CENARIO_DURACAO_MAX_S, Math.max(CENARIO_DURACAO_MIN_S, Math.round(lido * 10) / 10))
    // Grava o que o mestre digitou, mesmo igual ao padrão: se o padrão mudar, a escolha dele não muda junto.
    onChange(preso)
    setTexto(String(preso))
  }

  return (
    <div className="gr-campo">
      <label className="gr-campo__rot" htmlFor={inputId}>
        Duração (segundos)
      </label>
      <input
        id={inputId}
        className="gr-entrada"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder={String(naturalS)}
        aria-describedby={dicaId}
        value={texto}
        onChange={(event) => setTexto(event.currentTarget.value)}
        onBlur={gravar}
        onKeyDown={(event) => {
          if (event.key === 'Enter') gravar()
        }}
      />
      <span id={dicaId} className="lb-travel__hint">
        Vazio = {naturalS.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} s. De {CENARIO_DURACAO_MIN_S} a {CENARIO_DURACAO_MAX_S} s.
      </span>
    </div>
  )
}
