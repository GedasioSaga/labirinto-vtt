import { useId } from 'react'
import {
  DIRECOES_DO_VENTO,
  EFEITOS_DO_PAINEL,
  FORCA_DO_VENTO_MAX,
  FORCA_DO_VENTO_MIN,
  INTENSIDADE_MAX,
  INTENSIDADE_MIN,
  chaoMolhaLigado,
  efeitoDoMapa,
  nomeDaIntensidade,
  nomeDoVento,
  relampagoDoMapa,
  somDaChuvaLigado,
  temPincelDoEfeito,
  tipoDeFolhas,
  ventoDoMapa,
  type EfeitoDoPainel,
} from '../lib/ambiente'
import { DENSIDADE_MAX, DENSIDADE_MIN, FORCA_DA_NEBLINA_MAX, FORCA_DA_NEBLINA_MIN, neblinaDoMapa, type ModoDaNeblina } from '../lib/neblina'
import { mapaDoPiso } from '../lib/pisos'
import { TAMANHO_DO_PINCEL_MAX, TAMANHO_DO_PINCEL_MIN } from '../lib/texturas'
import { useMapStore } from '../stores/mapStore'
import { usePincelDaNeblina } from '../stores/pincelDaNeblina'
import type { DirecaoDoVento, EfeitoDoAmbiente, FrequenciaDoRelampago, TipoDeFolhas } from '../types/map'
import { Toggle } from './Toggle'

const NOMES: Record<EfeitoDoPainel, string> = {
  neblina: 'Neblina',
  chuva: 'Chuva',
  brasas: 'Brasas',
  neve: 'Neve',
  folhas: 'Folhas e cinzas',
  fumaca: 'Fumaça',
}

/** O nome no meio da frase ("Apagar toda a chuva pintada"). */
const NOMES_NA_FRASE: Record<EfeitoDoPainel, string> = {
  neblina: 'a neblina',
  chuva: 'a chuva',
  brasas: 'as brasas',
  neve: 'a neve',
  folhas: 'as folhas e cinzas',
  fumaca: 'a fumaça',
}

const APAGAR: Record<EfeitoDoPainel, string> = {
  neblina: 'Apagar toda a neblina pintada',
  chuva: 'Apagar toda a chuva pintada',
  brasas: 'Apagar todas as brasas pintadas',
  neve: 'Apagar toda a neve pintada',
  folhas: 'Apagar todas as folhas e cinzas pintadas',
  fumaca: 'Apagar toda a fumaça pintada',
}

/** O que cada efeito faz, com a regra de dentro de casa (a mesma do protótipo aprovado). */
const SOBRE: Record<EfeitoDoPainel, string> = {
  neblina: 'Uma bruma lenta por cima da cena, à vista também de noite e no escuro. Entra em casa só pela porta aberta.',
  chuva: 'Gotas em diagonal pelo vento, de garoa a tempestade, com respingo no chão. Não cai dentro de casa de teto fechado nem de cômodo fechado.',
  brasas: 'Fagulhas que sobem e flutuam; à noite elas brilham, mas não iluminam. Com fogo na cena, nascem dos fogos. Entram em casa só pela porta aberta.',
  neve: 'Flocos que caem devagar balançando e embranquecem o chão aos poucos. Não cai dentro de casa de teto fechado nem de cômodo fechado.',
  folhas: 'Folhas secas rodando com o vento, ou cinza caindo de um incêndio. Não caem dentro de casa de teto fechado nem de cômodo fechado.',
  fumaca: 'Fumaça escura subindo devagar com o vento. Com fogo na cena, nasce dos fogos. Entra em casa só pela porta aberta.',
}

const MODOS: Array<{ modo: ModoDaNeblina; rotulo: string }> = [
  { modo: 'pincel', rotulo: 'Pincel' },
  { modo: 'borracha', rotulo: 'Borracha' },
]

const TIPOS: Array<{ tipo: TipoDeFolhas; rotulo: string }> = [
  { tipo: 'folhas', rotulo: 'Folhas' },
  { tipo: 'cinzas', rotulo: 'Cinzas' },
  { tipo: 'duas', rotulo: 'As duas' },
]

const RELAMPAGOS: Array<{ valor: FrequenciaDoRelampago; rotulo: string }> = [
  { valor: 'nao', rotulo: 'Não' },
  { valor: 'raro', rotulo: 'Raro' },
  { valor: 'frequente', rotulo: 'Frequente' },
]

/** As 8 setas na grade 3 x 3 (o meio é vazio), com o nome para o leitor de tela. */
const SETAS: Record<DirecaoDoVento, { seta: string; nome: string }> = {
  NO: { seta: '↖', nome: 'Para cima e à esquerda' },
  N: { seta: '↑', nome: 'Para cima' },
  NE: { seta: '↗', nome: 'Para cima e à direita' },
  O: { seta: '←', nome: 'Para a esquerda' },
  L: { seta: '→', nome: 'Para a direita' },
  SO: { seta: '↙', nome: 'Para baixo e à esquerda' },
  S: { seta: '↓', nome: 'Para baixo' },
  SE: { seta: '↘', nome: 'Para baixo e à direita' },
}

const GRADE_DO_VENTO = { display: 'grid', gridTemplateColumns: 'repeat(3, 2.25rem)', gap: '0.25rem' } as const

/**
 * O painel da ferramenta AMBIENTE (pedido de 12/11/2026; era a Neblina): o
 * efeito da vez, a chave do mapa inteiro dele com a intensidade, o pincel por
 * área, o vento da cena e as opções da chuva. Cada controle arrastado vira um
 * passo só no desfazer. Sem atalho de número: os dígitos 1 a 9 são os sons ao
 * vivo (`lib/keymap.ts`).
 */
export function AmbienteControls() {
  const efeito = usePincelDaNeblina((s) => s.efeito)
  const setEfeito = usePincelDaNeblina((s) => s.setEfeito)
  const ambiente = useMapStore((s) => s.map.ambiente)
  const neblinaCrua = useMapStore((s) => s.map.neblina)
  const pintado = useMapStore((s) => mapaDoPiso(s.map, s.pisoAtivo).ambientePintado)
  const temNeblinaPintada = useMapStore((s) => (mapaDoPiso(s.map, s.pisoAtivo).neblinaPintada ?? []).some((p) => p.tipo === 'pincel'))
  const neblina = neblinaDoMapa({ neblina: neblinaCrua })
  const comAmbiente = { ambiente }
  const temPintada = (e: EfeitoDoPainel): boolean => (e === 'neblina' ? temNeblinaPintada : temPincelDoEfeito(pintado, e))
  const ligadaNoMapa = (e: EfeitoDoPainel): boolean => (e === 'neblina' ? neblina.ligada : efeitoDoMapa(comAmbiente, e).ligada)

  function estado(e: EfeitoDoPainel): string {
    if (ligadaNoMapa(e)) {
      const valor = e === 'neblina' ? neblina.intensidade : efeitoDoMapa(comAmbiente, e).intensidade
      return `Mapa inteiro, ${nomeDaIntensidade(e, valor).toLowerCase()}${temPintada(e) ? ' e pintada' : ''}`
    }
    return temPintada(e) ? 'Pintada' : 'Desligada'
  }

  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Efeito</h2>
      <div role="radiogroup" aria-label="Efeito do ambiente" style={{ display: 'grid', gap: '0.25rem' }}>
        {EFEITOS_DO_PAINEL.map((e) => (
          <button
            key={e}
            type="button"
            role="radio"
            aria-checked={efeito === e}
            className="lb-seg__option"
            style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', textAlign: 'left' }}
            onClick={() => setEfeito(e)}
          >
            <span>{NOMES[e]}</span>
            <span className="lb-field__hint" style={{ margin: 0 }}>
              {estado(e)}
            </span>
          </button>
        ))}
      </div>
      <p className="lb-field__hint">{SOBRE[efeito]}</p>
      {efeito === 'neblina' ? <MapaInteiroDaNeblina /> : <MapaInteiroDoEfeito efeito={efeito} />}
      <PincelDoAmbiente efeito={efeito} temPintada={temPintada(efeito)} />
      <VentoDaCena />
      <OpcoesDaChuva />
    </section>
  )
}

function MapaInteiroDaNeblina() {
  const neblina = neblinaDoMapa({ neblina: useMapStore((s) => s.map.neblina) })
  const setNeblinaDoMapa = useMapStore((s) => s.setNeblinaDoMapa)
  const intensidadeId = useId()
  const densidadeId = useId()
  const densidadeDicaId = useId()
  return (
    <>
      <h2 className="lb-eyebrow">Mapa inteiro</h2>
      <div className="lb-field">
        <Toggle label="Neblina no mapa inteiro" checked={neblina.ligada} onChange={(ligada) => setNeblinaDoMapa({ ligada, intensidade: neblina.intensidade, densidade: neblina.densidade })} />
      </div>
      <div className="lb-field">
        <div className="lb-section__row">
          <label className="lb-label" htmlFor={intensidadeId}>
            Intensidade
          </label>
          <span className="lb-num">
            {nomeDaIntensidade('neblina', neblina.intensidade)} · {neblina.intensidade}%
          </span>
        </div>
        <input
          id={intensidadeId}
          className="lb-range"
          type="range"
          min={INTENSIDADE_MIN}
          max={INTENSIDADE_MAX}
          step={5}
          value={neblina.intensidade}
          disabled={!neblina.ligada}
          onChange={(event) => setNeblinaDoMapa({ ligada: true, intensidade: Number(event.target.value), densidade: neblina.densidade }, 'intensidade')}
        />
      </div>
      <div className="lb-field">
        <div className="lb-section__row">
          <label className="lb-label" htmlFor={densidadeId}>
            Densidade
          </label>
          <span className="lb-num">{neblina.densidade}%</span>
        </div>
        <input
          id={densidadeId}
          className="lb-range"
          type="range"
          min={DENSIDADE_MIN}
          max={DENSIDADE_MAX}
          step={5}
          value={neblina.densidade}
          disabled={!neblina.ligada}
          aria-describedby={densidadeDicaId}
          onChange={(event) => setNeblinaDoMapa({ ligada: true, intensidade: neblina.intensidade, densidade: Number(event.target.value) }, 'densidade')}
        />
        <p id={densidadeDicaId} className="lb-field__hint">
          Pouca: tufos soltos, com buracos. Muita: cobre quase tudo.
        </p>
      </div>
    </>
  )
}

function MapaInteiroDoEfeito({ efeito }: { efeito: EfeitoDoAmbiente }) {
  const ambiente = useMapStore((s) => s.map.ambiente)
  const setAmbiente = useMapStore((s) => s.setAmbiente)
  const atual = efeitoDoMapa({ ambiente }, efeito)
  const tipo = tipoDeFolhas({ ambiente })
  const intensidadeId = useId()
  const desligadaId = useId()
  return (
    <>
      <h2 className="lb-eyebrow">Mapa inteiro</h2>
      <div className="lb-field">
        <Toggle
          label={`${NOMES[efeito]} no mapa inteiro`}
          checked={atual.ligada}
          onChange={(ligada) => setAmbiente({ [efeito]: { ligada, intensidade: atual.intensidade } })}
        />
      </div>
      <div className="lb-field">
        <div className="lb-section__row">
          <label className="lb-label" htmlFor={intensidadeId}>
            Intensidade
          </label>
          <span className="lb-num">
            {nomeDaIntensidade(efeito, atual.intensidade)} · {atual.intensidade}%
          </span>
        </div>
        <input
          id={intensidadeId}
          className="lb-range"
          type="range"
          min={INTENSIDADE_MIN}
          max={INTENSIDADE_MAX}
          step={5}
          value={atual.intensidade}
          disabled={!atual.ligada}
          aria-describedby={atual.ligada ? undefined : desligadaId}
          onChange={(event) => setAmbiente({ [efeito]: { ligada: true, intensidade: Number(event.target.value) } }, `${efeito}-intensidade`)}
        />
        {!atual.ligada && (
          <p id={desligadaId} className="lb-field__hint">
            Ligue a chave acima para ajustar.
          </p>
        )}
      </div>
      {efeito === 'folhas' && (
        <div className="lb-seg" role="radiogroup" aria-label="O que cai">
          {TIPOS.map((opcao) => (
            <button
              key={opcao.tipo}
              type="button"
              role="radio"
              aria-checked={tipo === opcao.tipo}
              className="lb-seg__option"
              onClick={() => setAmbiente({ folhas: { ligada: atual.ligada, intensidade: atual.intensidade, tipo: opcao.tipo } })}
            >
              {opcao.rotulo}
            </button>
          ))}
        </div>
      )}
    </>
  )
}

function PincelDoAmbiente({ efeito, temPintada }: { efeito: EfeitoDoPainel; temPintada: boolean }) {
  const { modo, tamanho, forca, densidade, setModo, setTamanho, setForca, setDensidade } = usePincelDaNeblina()
  const apagarNeblina = useMapStore((s) => s.apagarTodaANeblinaPintada)
  const apagarEfeito = useMapStore((s) => s.apagarTodoOAmbientePintado)
  const tamanhoId = useId()
  const forcaId = useId()
  const densidadeId = useId()
  const borracha = modo === 'borracha'
  return (
    <>
      <h2 className="lb-eyebrow">Pincel</h2>
      <div className="lb-seg" role="radiogroup" aria-label={`Pincel de ${NOMES[efeito].toLowerCase()}`}>
        {MODOS.map((opcao) => (
          <button key={opcao.modo} type="button" role="radio" aria-checked={modo === opcao.modo} className="lb-seg__option" onClick={() => setModo(opcao.modo)}>
            {opcao.rotulo}
          </button>
        ))}
      </div>
      <p className="lb-field__hint">
        {borracha ? 'Arraste por cima do que foi pintado para tirar.' : `Arraste por cima do mapa para pintar ${NOMES_NA_FRASE[efeito]}. Segure Alt para apagar.`}
      </p>
      <div className="lb-field">
        <div className="lb-section__row">
          <label className="lb-label" htmlFor={tamanhoId}>
            Tamanho do pincel
          </label>
          <span className="lb-num">{tamanho}</span>
        </div>
        <input id={tamanhoId} className="lb-range" type="range" min={TAMANHO_DO_PINCEL_MIN} max={TAMANHO_DO_PINCEL_MAX} step={2} value={tamanho} onChange={(event) => setTamanho(Number(event.target.value))} />
      </div>
      <div className="lb-field">
        <div className="lb-section__row">
          <label className="lb-label" htmlFor={forcaId}>
            {borracha ? 'Quanto tira' : 'Intensidade'}
          </label>
          <span className="lb-num">{Math.round(forca * 100)}%</span>
        </div>
        <input
          id={forcaId}
          className="lb-range"
          type="range"
          min={FORCA_DA_NEBLINA_MIN}
          max={FORCA_DA_NEBLINA_MAX}
          step={0.05}
          value={forca}
          onChange={(event) => setForca(Number(event.target.value))}
        />
      </div>
      {efeito === 'neblina' && (
        <div className="lb-field">
          <div className="lb-section__row">
            <label className="lb-label" htmlFor={densidadeId}>
              Densidade
            </label>
            <span className="lb-num">{Math.round(densidade * 100)}%</span>
          </div>
          <input
            id={densidadeId}
            className="lb-range"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={densidade}
            disabled={borracha}
            onChange={(event) => setDensidade(Number(event.target.value))}
          />
        </div>
      )}
      {temPintada && (
        <button
          type="button"
          className="lb-btn lb-btn--ghost lb-btn--compact"
          onClick={() => (efeito === 'neblina' ? apagarNeblina() : apagarEfeito(efeito))}
        >
          {APAGAR[efeito]}
        </button>
      )}
    </>
  )
}

function VentoDaCena() {
  const ambiente = useMapStore((s) => s.map.ambiente)
  const setAmbiente = useMapStore((s) => s.setAmbiente)
  const vento = ventoDoMapa({ ambiente })
  const forcaId = useId()
  const linhas: Array<DirecaoDoVento | null> = [...DIRECOES_DO_VENTO.slice(0, 4), null, ...DIRECOES_DO_VENTO.slice(4)]
  return (
    <>
      <h2 className="lb-eyebrow">Vento da cena</h2>
      <div role="radiogroup" aria-label="Direção do vento" style={GRADE_DO_VENTO}>
        {linhas.map((direcao, i) =>
          direcao === null ? (
            <span key={`meio-${i}`} aria-hidden="true" />
          ) : (
            <button
              key={direcao}
              type="button"
              role="radio"
              aria-checked={vento.direcao === direcao}
              aria-label={SETAS[direcao].nome}
              title={SETAS[direcao].nome}
              className="lb-seg__option"
              onClick={() => setAmbiente({ vento: { direcao, forca: vento.forca } })}
            >
              {SETAS[direcao].seta}
            </button>
          ),
        )}
      </div>
      <div className="lb-field">
        <div className="lb-section__row">
          <label className="lb-label" htmlFor={forcaId}>
            Força
          </label>
          <span className="lb-num">{nomeDoVento(vento.forca)}</span>
        </div>
        <input
          id={forcaId}
          className="lb-range"
          type="range"
          min={FORCA_DO_VENTO_MIN}
          max={FORCA_DO_VENTO_MAX}
          step={5}
          value={vento.forca}
          onChange={(event) => setAmbiente({ vento: { direcao: vento.direcao, forca: Number(event.target.value) } }, 'vento')}
        />
      </div>
    </>
  )
}

function OpcoesDaChuva() {
  const ambiente = useMapStore((s) => s.map.ambiente)
  const setAmbiente = useMapStore((s) => s.setAmbiente)
  const relampago = relampagoDoMapa({ ambiente })
  const relampagoDicaId = useId()
  return (
    <>
      <h2 className="lb-eyebrow">Chuva e neve</h2>
      <div className="lb-field">
        <span className="lb-label">Relâmpago na chuva forte</span>
        <div className="lb-seg" role="radiogroup" aria-label="Relâmpago na chuva forte" aria-describedby={relampagoDicaId}>
          {RELAMPAGOS.map((opcao) => (
            <button
              key={opcao.valor}
              type="button"
              role="radio"
              aria-checked={relampago === opcao.valor}
              className="lb-seg__option"
              onClick={() => setAmbiente({ relampago: opcao.valor })}
            >
              {opcao.rotulo}
            </button>
          ))}
        </div>
        <p id={relampagoDicaId} className="lb-field__hint">
          Só com a chuva no mapa inteiro a partir de 70%. Não acende o escuro dos jogadores.
        </p>
      </div>
      <div className="lb-field">
        <Toggle label="Som da chuva" checked={somDaChuvaLigado({ ambiente })} onChange={(somDaChuva) => setAmbiente({ somDaChuva })} />
      </div>
      <div className="lb-field">
        <Toggle label="Chão molha e junta neve" checked={chaoMolhaLigado({ ambiente })} onChange={(chaoMolha) => setAmbiente({ chaoMolha })} />
      </div>
    </>
  )
}
