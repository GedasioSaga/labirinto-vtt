import { useMapStore } from '../stores/mapStore'
import { TAMANHO_DO_PINCEL_DA_AGUA, useFerramentaDaAgua, type FormaDaAgua } from '../stores/ferramentaDaAgua'
import type { Agua, CorProntaDaAgua, TipoDeAgua } from '../types/map'
import { AJUSTE_PADRAO, CORES_DA_AGUA, LARGURA_DO_RIO, NOME_DO_TIPO_DE_AGUA, larguraDoRio, nomeDaAgua } from '../lib/agua/dados'
import { mapaDoPiso } from '../lib/pisos'
import { Toggle } from './Toggle'

/**
 * Painel da ferramenta ÁGUA (pedido de 12/11/2026, protótipo
 * `docs/design/agua/`): sem água escolhida, o que o PRÓXIMO traço faz (tipo,
 * cor, largura do rio, ajustes e, no lago e no mar, a forma: à mão, retângulo
 * ou ponto a ponto); com uma água escolhida (clique nela), a própria água:
 * como mexer na forma (bolinhas, pincel de água, pincel de areia no mar),
 * "Barra a passagem", Apagar e Soltar. O que não vale para o tipo fica
 * desligado, com o motivo escrito embaixo.
 */

const TIPOS: readonly TipoDeAgua[] = ['rio', 'lago', 'mar']

/** Como o lago e o mar nascem; o rio é sempre à mão. */
const FORMAS: readonly { id: FormaDaAgua; nome: string; dica: string }[] = [
  { id: 'mao', nome: 'À mão', dica: 'Arraste o contorno; ao soltar, a área fecha.' },
  { id: 'retangulo', nome: 'Retângulo', dica: 'Arraste de um canto ao outro.' },
  { id: 'pontos', nome: 'Ponto a ponto', dica: 'Clique em cada canto. Duplo clique ou Enter fecha; Esc cancela.' },
]
/** Lista vazia fixa: o seletor da store não pode devolver um array novo a cada leitura. */
const NENHUMA: readonly Agua[] = []

function casas(v: number): string {
  return `${v.toLocaleString('pt-BR')} ${v === 1 ? 'casa' : 'casas'}`
}

interface SeletorDeCorProps {
  id: string
  cor: string
  corPronta: CorProntaDaAgua | null
  onChange: (cor: string, corPronta: CorProntaDaAgua | null) => void
}

/** As cores prontas em botões com amostra, mais a cor livre (o raso e o fundo saem dela). */
function SeletorDeCor({ id, cor, corPronta, onChange }: SeletorDeCorProps) {
  return (
    <div className="lb-field">
      <span className="lb-label" id={`${id}-rotulo`}>
        Cor da água
      </span>
      <div className="lb-seg lb-seg--grid" role="radiogroup" aria-labelledby={`${id}-rotulo`}>
        {CORES_DA_AGUA.map((c) => (
          <button key={c.id} type="button" role="radio" aria-checked={corPronta === c.id} className="lb-seg__option" onClick={() => onChange(c.cor, c.id)}>
            <span aria-hidden="true" style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, marginRight: 6, background: c.cor, verticalAlign: 'middle' }} />
            {c.nome}
          </button>
        ))}
      </div>
      <div className="lb-section__row">
        <label className="lb-label" htmlFor={`${id}-livre`}>
          Cor livre
        </label>
        <input id={`${id}-livre`} type="color" value={cor} onChange={(event) => onChange(event.target.value, null)} />
      </div>
    </div>
  )
}

interface DeslizadorProps {
  id: string
  rotulo: string
  valor: number
  min: number
  max: number
  passo: number
  texto: string
  desligado?: string
  onChange: (valor: number) => void
}

function Deslizador({ id, rotulo, valor, min, max, passo, texto, desligado, onChange }: DeslizadorProps) {
  return (
    <div className="lb-field">
      <div className="lb-section__row">
        <label className="lb-label" htmlFor={id}>
          {rotulo}
        </label>
        <span className="lb-num">{texto}</span>
      </div>
      <input
        id={id}
        className="lb-range"
        type="range"
        min={min}
        max={max}
        step={passo}
        value={valor}
        disabled={desligado !== undefined}
        aria-describedby={desligado === undefined ? undefined : `${id}-motivo`}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {desligado !== undefined && (
        <p className="lb-field__hint" id={`${id}-motivo`}>
          {desligado}
        </p>
      )}
    </div>
  )
}

const SEM_CORRENTEZA = 'Só o rio tem correnteza.'
const SEM_ONDAS = 'O rio não tem ondas: a correnteza é o movimento dele.'

/** Os três ajustes e a largura, do próximo traço ou da água escolhida. */
function Medidas(props: {
  prefixo: string
  tipo: TipoDeAgua
  largura: number
  velocidade: number
  ondas: number
  espuma: number
  onLargura: (v: number) => void
  onAjuste: (qual: 'velocidade' | 'ondas' | 'espuma', v: number) => void
}) {
  const { prefixo, tipo } = props
  return (
    <>
      {tipo === 'rio' && (
        <Deslizador
          id={`${prefixo}-largura`}
          rotulo="Largura do rio"
          valor={props.largura}
          min={LARGURA_DO_RIO.min}
          max={LARGURA_DO_RIO.max}
          passo={0.25}
          texto={casas(props.largura)}
          onChange={props.onLargura}
        />
      )}
      <Deslizador
        id={`${prefixo}-velocidade`}
        rotulo="Correnteza"
        valor={props.velocidade}
        min={0}
        max={100}
        passo={5}
        texto={`${props.velocidade}%`}
        desligado={tipo === 'rio' ? undefined : SEM_CORRENTEZA}
        onChange={(v) => props.onAjuste('velocidade', v)}
      />
      <Deslizador
        id={`${prefixo}-ondas`}
        rotulo="Ondas"
        valor={props.ondas}
        min={0}
        max={100}
        passo={5}
        texto={`${props.ondas}%`}
        desligado={tipo === 'rio' ? SEM_ONDAS : undefined}
        onChange={(v) => props.onAjuste('ondas', v)}
      />
      <Deslizador id={`${prefixo}-espuma`} rotulo="Espuma" valor={props.espuma} min={0} max={100} passo={5} texto={`${props.espuma}%`} onChange={(v) => props.onAjuste('espuma', v)} />
    </>
  )
}

const AREIA_SOZINHA = 'O mar ganha areia sozinho na beira, menos junto de sala, de chão liso e na borda do mapa.'

const DICA_DAS_BOLINHAS = 'Arraste uma bolinha para mudar a forma. Arraste o meio de uma linha para criar outra. Alt+clique tira. Arraste por dentro para mover tudo.'

/** Como mexer na forma da escolhida: as bolinhas do contorno ou um pincel (lago e mar). */
function MexerNaForma({ agua }: { agua: Agua }) {
  const f = useFerramentaDaAgua()
  if (agua.tipo === 'rio') return <p className="lb-field__hint">{DICA_DAS_BOLINHAS}</p>
  // O pincel de areia é só do mar: no lago (o mar que virou lago) ficam as bolinhas.
  const pincel = f.pincel === 'areia' && agua.tipo !== 'mar' ? null : f.pincel
  return (
    <div className="lb-field">
      <span className="lb-label" id="lb-agua-mexer">
        Mexer na forma
      </span>
      <div className="lb-seg" role="radiogroup" aria-labelledby="lb-agua-mexer">
        <button type="button" role="radio" aria-checked={pincel === null} className="lb-seg__option" onClick={() => f.setPincel(null)}>
          Bolinhas
        </button>
        <button type="button" role="radio" aria-checked={pincel === 'agua'} className="lb-seg__option" onClick={() => f.setPincel('agua')}>
          Pincel de água
        </button>
        {agua.tipo === 'mar' && (
          <button type="button" role="radio" aria-checked={pincel === 'areia'} className="lb-seg__option" onClick={() => f.setPincel('areia')}>
            Pincel de areia
          </button>
        )}
      </div>
      {pincel === null && <p className="lb-field__hint">{DICA_DAS_BOLINHAS}</p>}
      {pincel === 'agua' && (
        <>
          <div className="lb-seg" role="radiogroup" aria-label="O que o pincel de água faz">
            <button type="button" role="radio" aria-checked={f.modoDaAgua === 'mais'} className="lb-seg__option" onClick={() => f.setModoDaAgua('mais')}>
              Mais água
            </button>
            <button type="button" role="radio" aria-checked={f.modoDaAgua === 'menos'} className="lb-seg__option" onClick={() => f.setModoDaAgua('menos')}>
              Menos água
            </button>
          </div>
          <p className="lb-field__hint">Pinte na beira para a água crescer ou encolher. Alt troca só neste traço.</p>
        </>
      )}
      {pincel === 'areia' && (
        <>
          <div className="lb-seg" role="radiogroup" aria-label="O que o pincel de areia faz">
            <button type="button" role="radio" aria-checked={f.modoDaAreia === 'tirar'} className="lb-seg__option" onClick={() => f.setModoDaAreia('tirar')}>
              Tirar areia
            </button>
            <button type="button" role="radio" aria-checked={f.modoDaAreia === 'por'} className="lb-seg__option" onClick={() => f.setModoDaAreia('por')}>
              Pôr areia
            </button>
          </div>
          <p className="lb-field__hint">Pinte na beira do mar. Sem areia, a água encosta direto na grama. Alt troca só neste traço.</p>
        </>
      )}
      {pincel !== null && (
        <Deslizador
          id="lb-agua-pincel-tamanho"
          rotulo="Tamanho do pincel"
          valor={f.tamanho}
          min={TAMANHO_DO_PINCEL_DA_AGUA.min}
          max={TAMANHO_DO_PINCEL_DA_AGUA.max}
          passo={0.5}
          texto={casas(f.tamanho)}
          onChange={f.setTamanho}
        />
      )}
    </div>
  )
}

/** A água escolhida no mapa. */
function AguaEscolhida({ agua, todas }: { agua: Agua; todas: readonly Agua[] }) {
  const mudarAgua = useMapStore((s) => s.mudarAgua)
  const apagarAgua = useMapStore((s) => s.apagarAgua)
  const escolher = useFerramentaDaAgua((s) => s.escolher)
  const nome = nomeDaAgua(agua, todas)
  return (
    <section className="lb-section" aria-label={`Água escolhida: ${nome}`}>
      <h2 className="lb-eyebrow">{nome}</h2>
      <MexerNaForma agua={agua} />
      {agua.tipo !== 'rio' && (
        <div className="lb-field">
          <span className="lb-label" id="lb-agua-escolhida-tipo">
            Tipo
          </span>
          <div className="lb-seg" role="radiogroup" aria-labelledby="lb-agua-escolhida-tipo">
            {(['lago', 'mar'] as const).map((t) => (
              <button key={t} type="button" role="radio" aria-checked={agua.tipo === t} className="lb-seg__option" onClick={() => mudarAgua(agua.id, { tipo: t })}>
                {NOME_DO_TIPO_DE_AGUA[t]}
              </button>
            ))}
          </div>
          {agua.tipo === 'mar' && <p className="lb-field__hint">{AREIA_SOZINHA}</p>}
        </div>
      )}
      <SeletorDeCor id="lb-agua-escolhida-cor" cor={agua.cor} corPronta={agua.corPronta ?? null} onChange={(cor, corPronta) => mudarAgua(agua.id, { cor, corPronta: corPronta ?? undefined }, 'cor')} />
      <Toggle label="Barra a passagem" checked={agua.barra === true} onChange={(liga) => mudarAgua(agua.id, { barra: liga ? true : undefined })} />
      <p className="lb-field__hint">{agua.barra === true ? 'A ficha do jogador não entra; a visão passa por cima.' : 'Desligada, a ficha entra na água.'}</p>
      <Medidas
        prefixo="lb-agua-escolhida"
        tipo={agua.tipo}
        largura={larguraDoRio(agua)}
        velocidade={agua.velocidade ?? AJUSTE_PADRAO.velocidade}
        ondas={agua.ondas ?? AJUSTE_PADRAO.ondas}
        espuma={agua.espuma ?? AJUSTE_PADRAO.espuma}
        onLargura={(v) => mudarAgua(agua.id, { largura: v }, 'largura')}
        onAjuste={(qual, v) => mudarAgua(agua.id, qual === 'velocidade' ? { velocidade: v } : qual === 'ondas' ? { ondas: v } : { espuma: v }, qual)}
      />
      <div className="lb-section__row">
        <button type="button" className="lb-btn" onClick={() => escolher(null)}>
          Soltar
        </button>
        <button
          type="button"
          className="lb-btn lb-btn--danger"
          onClick={() => {
            apagarAgua(agua.id)
            escolher(null)
          }}
        >
          Apagar
        </button>
      </div>
    </section>
  )
}

/** O painel inteiro da ferramenta Água. */
export function AguaControls() {
  const f = useFerramentaDaAgua()
  const todas = useMapStore((s) => mapaDoPiso(s.map, s.pisoAtivo).aguas ?? NENHUMA)
  const escolhida = f.escolhida === null ? undefined : todas.find((a) => a.id === f.escolhida)
  if (escolhida !== undefined) return <AguaEscolhida agua={escolhida} todas={todas} />
  return (
    <section className="lb-section" aria-label="Próxima água">
      <h2 className="lb-eyebrow">Próxima água</h2>
      <div className="lb-field">
        <span className="lb-label" id="lb-agua-tipo">
          Tipo
        </span>
        <div className="lb-seg" role="radiogroup" aria-labelledby="lb-agua-tipo">
          {TIPOS.map((t) => (
            <button key={t} type="button" role="radio" aria-checked={f.tipo === t} className="lb-seg__option" onClick={() => f.setTipo(t)}>
              {NOME_DO_TIPO_DE_AGUA[t]}
            </button>
          ))}
        </div>
        {f.tipo === 'rio' && <p className="lb-field__hint">Arraste o traço no sentido da correnteza.</p>}
      </div>
      {f.tipo !== 'rio' && (
        <div className="lb-field">
          <span className="lb-label" id="lb-agua-forma">
            Forma
          </span>
          <div className="lb-seg" role="radiogroup" aria-labelledby="lb-agua-forma">
            {FORMAS.map((forma) => (
              <button key={forma.id} type="button" role="radio" aria-checked={f.forma === forma.id} className="lb-seg__option" onClick={() => f.setForma(forma.id)}>
                {forma.nome}
              </button>
            ))}
          </div>
          <p className="lb-field__hint">
            {FORMAS.find((forma) => forma.id === f.forma)?.dica}
            {f.tipo === 'mar' ? ` ${AREIA_SOZINHA}` : ''}
          </p>
        </div>
      )}
      <SeletorDeCor id="lb-agua-cor" cor={f.cor} corPronta={f.corPronta} onChange={f.setCor} />
      <Medidas
        prefixo="lb-agua"
        tipo={f.tipo}
        largura={f.largura}
        velocidade={f.velocidade}
        ondas={f.ondas}
        espuma={f.espuma}
        onLargura={f.setLargura}
        onAjuste={f.setAjuste}
      />
      <p className="lb-field__hint">Clique numa água para escolher e mexer nela: forma, cor e "Barra a passagem".</p>
    </section>
  )
}
