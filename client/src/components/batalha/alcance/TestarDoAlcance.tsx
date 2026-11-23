import { useEffect, useId, useMemo, useRef, useState, type PointerEvent } from 'react'
import { alcanceDoCartao, type CartaoComAlcance } from '../../../lib/batalha/alcanceDoCartao'
import { casasDaExplosao, casasDoAlcance } from '../../../lib/batalha/alcance/casas'
import { alcanceComCondicoes, type GrupoDoAlcance, type MudancaDoAlcance, type SeloQueMudaOAlcance } from '../../../lib/batalha/alcance/condicoes'
import { corDoAlcance, type CorDoAlcance } from '../../../lib/batalha/alcance/cor'
import { descreverAlcance, usaDirecao, type FormaDoAlcance } from '../../../lib/batalha/alcance/forma'
import type { Casa, Direcao } from '../../../lib/batalha/area'
import { normalizar } from '../../../lib/batalha/formula'
import { danoDaTecnica } from '../../../lib/batalha/leituraDaTecnica'
import { pecasDoCartao } from '../../../lib/batalha/mecanica/leitura'
import type { CartaoDaFicha, Personagem } from '../../../lib/personagem'
import type { SistemaDeRpg } from '../../../lib/sistemaDeRpg'
import type { Segment } from '../../../lib/visibility'
import './alcance.css'

/**
 * O TESTAR DO ALCANCE (fase F, ALCANCE.md §8; protótipo `pintarTeste`, fonte.html:1418-1457):
 * uma grade pequena de 13 x 13 com a ficha no meio e as casas que acendem na batalha, pela
 * MESMA conta da mesa (`alcanceDoCartao` → `alcanceComCondicoes` → `casasDoAlcance` /
 * `casasDaExplosao`) e a MESMA cor (`corDoAlcance`). As setas viram a ficha, "Pôr uma parede"
 * prova que a parede corta, e "Testar com condição" mostra o alcance com um selo que o muda.
 * O pedido do dono: "um teste visual mostrando de onde o personagem apareceria".
 */

const COLUNAS = 13
const LINHAS = 13
/** Px de tela por casa: 13 casas = 286 px, cabe na coluna do editor. */
const CASA_PX = 22
/** A ficha no meio da grade. */
const MEIO: Casa = { col: 6, row: 6 }
/** Casas para cada lado da ficha: passar disso não cabe na prévia. */
const CABE_NA_PREVIA = 6
/** Px de mundo por casa na conta (a parede do teste é medida nesta grade, como no mapa). */
const GRADE = 50
/** A parede do protótipo: em pé, 3 casas à direita, da linha 2 à 6 (corta o lado de cima à direita). */
const PAREDE_DO_TESTE: readonly Segment[] = [{ x1: 9 * GRADE, y1: 2 * GRADE, x2: 9 * GRADE, y2: 6 * GRADE }]

/** As tintas das casas, as do protótipo aprovado (`CORES`), as mesmas da mesa. */
const TINTAS: Record<CorDoAlcance, { base: string; forte: string; borda: string; contorno: string }> = {
  azul: { base: 'rgba(22, 100, 236, 0.6)', forte: 'rgba(48, 136, 255, 0.84)', borda: '#cdeeff', contorno: 'rgba(6, 18, 46, 0.6)' },
  verde: { base: 'rgba(104, 222, 104, 0.58)', forte: 'rgba(150, 242, 140, 0.86)', borda: '#ecffe2', contorno: 'rgba(10, 40, 14, 0.62)' },
}

const SETAS: readonly { direcao: Direcao; seta: string; rotulo: string }[] = [
  { direcao: 'oeste', seta: '←', rotulo: 'Virado para a esquerda' },
  { direcao: 'norte', seta: '↑', rotulo: 'Virado para cima' },
  { direcao: 'sul', seta: '↓', rotulo: 'Virado para baixo' },
  { direcao: 'leste', seta: '→', rotulo: 'Virado para a direita' },
]

const NOME_DO_VALE: Record<MudancaDoAlcance['vale'], string> = { tudo: 'tudo', armas: 'só armas', habilidades: 'só habilidades', itens: 'só itens' }
const NOME_DO_GRUPO: Record<GrupoDoAlcance, string> = { armas: 'arma', habilidades: 'habilidade', itens: 'item' }

function quanto(mudanca: MudancaDoAlcance): string {
  return mudanca.mexe === 'teto' ? `máx ${mudanca.n}` : `${mudanca.n > 0 ? '+' : '−'}${Math.abs(mudanca.n)}`
}

/**
 * Os selos que mudam o alcance e que a ficha conhece: os das peças "selo" dos cartões montados
 * dela (e o do cartão que está sendo editado), um por nome e número. A tabela de condições pelo
 * nome ainda não tem alcance (a revisão das condições é o lote seguinte).
 */
export function selosQueMudamOAlcanceNaFicha(cartoes: Iterable<Pick<CartaoDaFicha, 'mecanica'>>): SeloQueMudaOAlcance[] {
  const vistos = new Map<string, SeloQueMudaOAlcance>()
  for (const cartao of cartoes) {
    const pecas = cartao.mecanica === undefined ? null : pecasDoCartao(cartao)
    for (const efeito of pecas?.efeitos ?? []) {
      if (efeito.tipo !== 'selo' || efeito.alcance === undefined) continue
      const nome = efeito.nome.trim().length > 0 ? efeito.nome.trim() : 'Selo sem nome'
      const chave = `${normalizar(nome)}|${efeito.alcance.mexe}|${efeito.alcance.n}|${efeito.alcance.vale}`
      if (!vistos.has(chave)) vistos.set(chave, { nome, alcance: efeito.alcance })
    }
  }
  return [...vistos.values()]
}

/** Até onde a forma chega da ficha (para dizer quando passa da prévia). */
function chegaAte(forma: FormaDoAlcance): number {
  switch (forma.tipo) {
    case 'si':
      return 0
    case 'frente':
      return forma.lado
    case 'ponto':
    case 'ficha':
      return forma.ate + (forma.raio ?? Math.floor(((forma.lado ?? 1) - 1) / 2))
    default:
      return forma.ate
  }
}

function pintarCasa(g: CanvasRenderingContext2D, casa: Casa, tinta: (typeof TINTAS)[CorDoAlcance], forte: boolean): void {
  const x = casa.col * CASA_PX
  const y = casa.row * CASA_PX
  const margem = 1.5
  g.fillStyle = forte ? tinta.forte : tinta.base
  g.fillRect(x + margem, y + margem, CASA_PX - 2 * margem, CASA_PX - 2 * margem)
  g.lineWidth = 2
  g.strokeStyle = tinta.contorno
  g.strokeRect(x + margem, y + margem, CASA_PX - 2 * margem, CASA_PX - 2 * margem)
  const dentro = margem + 2
  g.lineWidth = forte ? 2 : 1.25
  g.strokeStyle = forte ? '#ffffff' : tinta.borda
  g.strokeRect(x + dentro, y + dentro, CASA_PX - 2 * dentro, CASA_PX - 2 * dentro)
}

interface Pintura {
  acesas: readonly Casa[]
  fortes: readonly Casa[]
  cor: CorDoAlcance
  parede: boolean
  direcao: Direcao | null
  inicial: string
}

function pintarGrade(canvas: HTMLCanvasElement, pintura: Pintura): void {
  const largura = COLUNAS * CASA_PX
  const altura = LINHAS * CASA_PX
  const dpr = window.devicePixelRatio || 1
  if (canvas.width !== Math.round(largura * dpr)) canvas.width = Math.round(largura * dpr)
  if (canvas.height !== Math.round(altura * dpr)) canvas.height = Math.round(altura * dpr)
  const g = canvas.getContext('2d')
  if (g === null) return
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  // O chão: lajes escuras alternadas e a linha da grade, como o chão do protótipo.
  for (let row = 0; row < LINHAS; row += 1) {
    for (let col = 0; col < COLUNAS; col += 1) {
      g.fillStyle = (col + row) % 2 === 0 ? '#2a2620' : '#26221d'
      g.fillRect(col * CASA_PX, row * CASA_PX, CASA_PX, CASA_PX)
    }
  }
  g.strokeStyle = 'rgba(86, 78, 62, 0.5)'
  g.lineWidth = 1
  g.beginPath()
  for (let i = 1; i < COLUNAS; i += 1) {
    g.moveTo(i * CASA_PX + 0.5, 0)
    g.lineTo(i * CASA_PX + 0.5, altura)
  }
  for (let i = 1; i < LINHAS; i += 1) {
    g.moveTo(0, i * CASA_PX + 0.5)
    g.lineTo(largura, i * CASA_PX + 0.5)
  }
  g.stroke()
  const tinta = TINTAS[pintura.cor]
  const fortes = new Set(pintura.fortes.map((casa) => `${casa.col},${casa.row}`))
  for (const casa of pintura.acesas) pintarCasa(g, casa, tinta, fortes.has(`${casa.col},${casa.row}`))
  for (const casa of pintura.fortes) if (!pintura.acesas.some((acesa) => acesa.col === casa.col && acesa.row === casa.row)) pintarCasa(g, casa, tinta, true)
  if (pintura.parede) {
    for (const [largo, cor] of [[6, 'rgba(12, 12, 14, 0.9)'], [3, '#d9cfb8']] as const) {
      g.lineWidth = largo
      g.strokeStyle = cor
      g.lineCap = 'round'
      g.beginPath()
      for (const seg of PAREDE_DO_TESTE) {
        g.moveTo((seg.x1 / GRADE) * CASA_PX, (seg.y1 / GRADE) * CASA_PX)
        g.lineTo((seg.x2 / GRADE) * CASA_PX, (seg.y2 / GRADE) * CASA_PX)
      }
      g.stroke()
    }
  }
  const cx = MEIO.col * CASA_PX + CASA_PX / 2
  const cy = MEIO.row * CASA_PX + CASA_PX / 2
  if (pintura.direcao !== null) {
    // A seta de para onde ele está virado, encostada na ficha.
    const [dx, dy] = pintura.direcao === 'norte' ? [0, -1] : pintura.direcao === 'sul' ? [0, 1] : pintura.direcao === 'leste' ? [1, 0] : [-1, 0]
    const ponta = CASA_PX * 0.62
    const base = CASA_PX * 0.44
    const meia = CASA_PX * 0.16
    g.fillStyle = tinta.borda
    g.beginPath()
    g.moveTo(cx + dx * ponta, cy + dy * ponta)
    g.lineTo(cx + dx * base - dy * meia, cy + dy * base + dx * meia)
    g.lineTo(cx + dx * base + dy * meia, cy + dy * base - dx * meia)
    g.closePath()
    g.fill()
  }
  // A ficha: o anel verde das fichas do mapa, com a inicial de quem usa.
  const raio = CASA_PX * 0.42
  g.fillStyle = '#34302a'
  g.beginPath()
  g.arc(cx, cy, raio, 0, Math.PI * 2)
  g.fill()
  g.lineWidth = 3.5
  g.strokeStyle = 'rgba(12, 12, 14, 0.9)'
  g.beginPath()
  g.arc(cx, cy, raio + 1.2, 0, Math.PI * 2)
  g.stroke()
  g.lineWidth = 2
  g.strokeStyle = '#7fb48a'
  g.stroke()
  g.fillStyle = '#eceae4'
  g.font = '600 10px system-ui, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(pintura.inicial, cx, cy + 0.5)
}

interface TestarDoAlcanceProps {
  /** O cartão da tela (o rascunho): técnica, item ou arma. */
  cartao: CartaoComAlcance & Pick<CartaoDaFicha, 'nome' | 'campos'>
  quemUsa: Personagem
  sistema: SistemaDeRpg
  grupo: GrupoDoAlcance
}

export function TestarDoAlcance({ cartao, quemUsa, sistema, grupo }: TestarDoAlcanceProps) {
  const tituloId = useId()
  const condicaoId = useId()
  const canvas = useRef<HTMLCanvasElement>(null)
  const [direcao, setDirecao] = useState<Direcao>('norte')
  const [parede, setParede] = useState(false)
  const [condicao, setCondicao] = useState('')
  const [apontada, setApontada] = useState<Casa | null>(null)

  const base = useMemo(() => alcanceDoCartao(cartao), [cartao])
  // A arma vai pelo Atacar (sempre azul); o resto pela leitura de sempre do dano.
  const cor = useMemo<CorDoAlcance>(() => (grupo === 'armas' ? corDoAlcance({ tipo: 'atacar' }) : corDoAlcance({ tipo: 'cartao', dano: danoDaTecnica(cartao, { personagem: quemUsa, sistema, arma: null }) })), [cartao, grupo, quemUsa, sistema])
  const selos = useMemo(() => selosQueMudamOAlcanceNaFicha([cartao, ...Object.values(quemUsa.abas).flat()]), [cartao, quemUsa])
  const escolhido = selos.find((_selo, indice) => String(indice) === condicao) ?? null
  const efetivo = useMemo(() => (base === null ? null : alcanceComCondicoes(base.forma, grupo, escolhido === null ? [] : [escolhido])), [base, grupo, escolhido])
  const forma = efetivo?.forma ?? null
  const direcional = forma !== null && usaDirecao(forma)
  const areaLonge = forma !== null && (forma.tipo === 'ponto' || forma.tipo === 'ficha')

  const acesas = useMemo(() => {
    if (forma === null) return []
    return casasDoAlcance({ forma, quemUsa: { ...MEIO, tamanho: 1 }, direcao, segmentos: parede ? PAREDE_DO_TESTE : [], colunas: COLUNAS, linhas: LINHAS, grade: GRADE })
  }, [forma, direcao, parede])
  const apontadaAcesa = apontada !== null && acesas.some((casa) => casa.col === apontada.col && casa.row === apontada.row) ? apontada : null
  const fortes = useMemo(() => {
    if (forma === null || apontadaAcesa === null || (forma.tipo !== 'ponto' && forma.tipo !== 'ficha')) return []
    return casasDaExplosao({ forma, centro: { ...apontadaAcesa, tamanho: 1 }, segmentos: parede ? PAREDE_DO_TESTE : [], colunas: COLUNAS, linhas: LINHAS, grade: GRADE })
  }, [forma, apontadaAcesa, parede])

  const inicial = quemUsa.nome.trim().slice(0, 1).toUpperCase() || '?'
  useEffect(() => {
    if (canvas.current !== null) pintarGrade(canvas.current, { acesas, fortes, cor, parede, direcao: direcional ? direcao : null, inicial })
  }, [acesas, fortes, cor, parede, direcao, direcional, inicial])

  if (base === null || forma === null || efetivo === null) {
    return (
      <section className="lb-alc__testar" aria-labelledby={tituloId}>
        <h4 className="lb-alc__testar-titulo" id={tituloId}>
          Alcance
        </h4>
        <p className="lb-field__hint">Sem alcance definido: na mesa nada acende e a distância não é conferida.</p>
      </section>
    )
  }

  const aoApontar = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!areaLonge) return
    const caixa = event.currentTarget.getBoundingClientRect()
    const col = Math.floor(((event.clientX - caixa.left) / caixa.width) * COLUNAS)
    const row = Math.floor(((event.clientY - caixa.top) / caixa.height) * LINHAS)
    if (apontada?.col !== col || apontada.row !== row) setApontada({ col, row })
  }

  const passa = chegaAte(forma) > CABE_NA_PREVIA
  const nomeDoCartao = cartao.nome.trim().length > 0 ? cartao.nome.trim() : 'Esta habilidade'
  let nota: string
  if (escolhido !== null && escolhido.alcance !== undefined) {
    if (efetivo.aviso !== null) nota = `${efetivo.aviso}.${passa ? ' Passa da prévia: aqui cabem 6 casas para cada lado.' : ''}`
    else if (forma.tipo === 'frente') nota = `${escolhido.nome} não mexe no quadrado à frente: o lado fica o mesmo.`
    else if (forma.tipo === 'si') nota = `${escolhido.nome} não mexe no que é só em quem usa.`
    else nota = `${escolhido.nome} vale ${NOME_DO_VALE[escolhido.alcance.vale]}: ${nomeDoCartao} (${NOME_DO_GRUPO[grupo]}) não muda.`
  } else if (passa) nota = 'Passa da prévia: aqui cabem 6 casas para cada lado. Na mesa acende tudo.'
  else if (areaLonge) nota = 'Aponte uma casa acesa: a explosão aparece mais forte em volta dela, como na mesa.'
  else nota = 'Assim as casas aparecem na mesa, para todos, a partir da casa dele.'
  const conta = `${acesas.length} ${acesas.length === 1 ? 'casa acende' : 'casas acendem'}`

  return (
    <section className="lb-alc__testar" aria-labelledby={tituloId}>
      <div className="lb-alc__testar-cabeca">
        <h4 className="lb-alc__testar-titulo" id={tituloId}>
          Alcance: {descreverAlcance(forma)}
        </h4>
        <span className="lb-alc__testar-conta">{conta}</span>
      </div>
      <canvas
        ref={canvas}
        className="lb-alc__testar-palco"
        style={{ width: COLUNAS * CASA_PX, height: LINHAS * CASA_PX }}
        role="img"
        aria-label={`${descreverAlcance(forma)}: ${conta} em volta de ${quemUsa.nome}${parede ? ', com uma parede à direita' : ''}.`}
        onPointerMove={aoApontar}
        onPointerLeave={() => setApontada(null)}
      />
      <div className="lb-alc__testar-comandos">
        <div className="lb-alc__setas" role="group" aria-label="Para onde ele está virado">
          {SETAS.map((seta) => (
            <button key={seta.direcao} type="button" className="lb-alc__seta" aria-label={seta.rotulo} aria-pressed={direcional && seta.direcao === direcao} disabled={!direcional} onClick={() => setDirecao(seta.direcao)}>
              {seta.seta}
            </button>
          ))}
        </div>
        <label className="lb-mec__marcar">
          <input type="checkbox" checked={parede} onChange={(event) => setParede(event.target.checked)} />
          <span>Pôr uma parede</span>
        </label>
      </div>
      <label className="lb-alc__testar-condicao" htmlFor={condicaoId}>
        <span className="lb-mec__legenda">Testar com condição</span>
        <select id={condicaoId} className="lb-input" value={escolhido === null ? '' : condicao} onChange={(event) => setCondicao(event.target.value)}>
          <option value="">Nenhuma</option>
          {selos.map((selo, indice) =>
            selo.alcance === undefined ? null : (
              <option key={`${selo.nome}-${indice}`} value={String(indice)}>
                {`${selo.nome} ${quanto(selo.alcance)} (${NOME_DO_VALE[selo.alcance.vale]})`}
              </option>
            ),
          )}
        </select>
      </label>
      {selos.length === 0 && <p className="lb-field__hint">Nenhum selo desta ficha muda o alcance. No bloco Efeitos, um selo pode ganhar "Muda o alcance".</p>}
      <p className="lb-alc__testar-nota" aria-live="polite">
        {nota}
      </p>
    </section>
  )
}
