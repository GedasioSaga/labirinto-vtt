import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ESCOLHA_DAS_ARMAS, LIMITE_DE_ARMAS_MAX, limiteDeArmas } from '../lib/batalha/leituraDaFicha'
import { quantidadeDe } from '../lib/items'
import { acervoDaMochila } from '../lib/mochila/acervoDaMochila'
import { armasEquipadas, balasParaOPente, penteDaArma, tipoDaVaga, type AcervoDaMochila } from '../lib/mochila/armaNaMochila'
import { bonusDaRoupa, bonusDoEquipamento, equipamentoDaVaga, textoDoBonusDaRoupa, type EquipamentoNoAcervo } from '../lib/mochila/bonusDaRoupa'
import type { TipoDoItem } from '../lib/itens/modelo'
import type { Personagem } from '../lib/personagem'
import { useAcervoDaFichaStore } from '../stores/acervoDaFichaStore'
import type { CarriedItem } from '../types/map'
import './EquipamentoDaFicha.css'

/** Os tipos que contam como arma no "Armas por batalha" (a roupa não conta, decisão 5). */
const TIPOS_DE_ARMA: ReadonlySet<TipoDoItem> = new Set(['corpo', 'fogo', 'hibrida', 'arremesso'])

/** O texto da escolha "Armas por batalha", igual às opções do sistema ("1 arma", "2 armas"). */
export function textoDoLimite(limite: number): string {
  return limite === 1 ? '1 arma' : `${limite} armas`
}

/** A ficha com o "Armas por batalha" novo; `null` = sem limite (a escolha sai). */
export function comLimiteDeArmas(personagem: Personagem, limite: number | null): Personagem {
  const { [ESCOLHA_DAS_ARMAS]: _antes, ...outras } = personagem.escolhas
  return { ...personagem, escolhas: limite === null ? outras : { ...outras, [ESCOLHA_DAS_ARMAS]: textoDoLimite(limite) } }
}

/**
 * O PENTE DA ARMA EQUIPADA, FORA DA BATALHA (pedido de 26/11/2026: "e se eu quiser editar ou o usuário
 * quiser recarregar arma antes de uma batalha?"). Quem monta é quem grava: o mestre na ficha dele
 * (`penteDoMestre.ts`), o jogador pelo pedido `mochila.recarregar` (o host confere), o site do Lobby pelas
 * mudanças da mochila (`pedidoDeRecarregar`). Na batalha, a recarga é a da vez, com o tempo da arma.
 */
export interface AcoesDoPente {
  /** Recarrega da pilha `balaVagaId` da mochila, na hora e sem gastar ação. O motivo de não ter recarregado, ou `null`. */
  recarregar: (arma: CarriedItem, balaVagaId: string) => string | null | Promise<string | null>
  /** Por que o Recarregar fica desligado agora (na batalha, sem conexão); `null` ou ausente = pode. */
  motivo?: string | null
  /** SÓ O MESTRE: o pente à mão, de 0 à capacidade, sem mexer na mochila. O motivo de não ter ajustado, ou `null`. */
  ajustar?: (arma: CarriedItem, n: number) => string | null
  /** SÓ O MESTRE: abre a arma no editor do item do Acervo. O motivo de não ter aberto, ou `null`. */
  editar?: (arma: CarriedItem) => string | null
  /**
   * SÓ O MESTRE (rodada 3, 28/11/2026): o toque "Arma padrão" no cartão de cada arma equipada, quando há mais
   * de uma. `marcar` = ela vira a padrão (a técnica com "Dano da Arma" a usa); senão, vale a primeira equipada.
   */
  armaPadrao?: (arma: CarriedItem, marcar: boolean) => string | null
}

export interface EquipamentoDaFichaProps {
  personagem: Personagem
  /** A mochila do dono, a mesma que a grade embaixo mostra. */
  itens: readonly CarriedItem[]
  /** Muda o "Armas por batalha" (o mestre, na hora; na edição, o rascunho). Ausente = só lê. */
  onLimite?: (limite: number | null) => void
  /** O Recarregar (e, do mestre, o ajuste à mão e o "Editar arma") no cartão da arma de pente. Ausente = só lê. */
  pente?: AcoesDoPente
}

/**
 * O ALTO DA ABA "MOCHILA E EQUIPAMENTO" (itens refeitos, E4b; tela G do protótipo aprovado): o
 * "Armas por batalha" com − e + (só a arma equipada ataca), e o que está em uso: as armas
 * equipadas, as vagas de arma livres e a roupa vestida. A grade da mochila vem embaixo (`FichaAbas`),
 * com o Equipar, o Guardar e o Recarregar de cada vaga (`MochilaDoMestre`).
 */
export function EquipamentoDaFicha({ personagem, itens, onLimite, pente: acoesDoPente }: EquipamentoDaFichaProps) {
  // O Acervo por um módulo puro (o site do Lobby, fora do Tauri, fica com a lista vazia).
  const doAcervo = useAcervoDaFichaStore((state) => state.itens)
  const acervo = useMemo(() => acervoDaMochila(doAcervo), [doAcervo])
  // Decisão 8: a roupa de cada item pelo Acervo de agora (sem ele, a cópia da vaga).
  const roupaNoAcervo = useMemo<EquipamentoNoAcervo>(() => {
    const porId = new Map(doAcervo.map((item) => [item.id, item.equipamento]))
    return (itemId) => porId.get(itemId)
  }, [doAcervo])
  const daRoupa = textoDoBonusDaRoupa(bonusDaRoupa(itens, roupaNoAcervo))
  const limite = limiteDeArmas(personagem)
  const equipadas = armasEquipadas(itens, acervo)
  const emUso = itens.filter((vaga) => vaga.equipado === true)
  const armas = emUso.filter((vaga) => {
    const tipo = tipoDaVaga(vaga, acervo)
    return tipo !== undefined && TIPOS_DE_ARMA.has(tipo)
  })
  const roupa = emUso.filter((vaga) => !armas.includes(vaga))
  // Rodada 3: com mais de uma arma equipada, a padrão (a marcada; sem marca, a primeira) é a da técnica com "Dano da Arma".
  const marcarPadrao = armas.length > 1 ? acoesDoPente?.armaPadrao : undefined
  const padrao = armas.find((vaga) => vaga.armaPadrao === true) ?? armas[0]
  const livres = limite === null ? 0 : Math.max(0, limite - armas.length)
  const menos = limite === null || limite <= 1 ? null : limite - 1
  const mais = limite === null ? Math.max(1, equipadas) : limite >= LIMITE_DE_ARMAS_MAX ? null : limite + 1

  return (
    <div className="eq-ficha">
      <div className="eq-ficha__limite">
        <span className="eq-ficha__rot" id={`eq-lim-${personagem.id}`}>
          Armas por batalha
        </span>
        {onLimite !== undefined ? (
          <div className="eq-ficha__passo" role="group" aria-labelledby={`eq-lim-${personagem.id}`}>
            <button type="button" aria-label="Uma arma a menos" disabled={menos === null} onClick={() => menos !== null && onLimite(menos)}>
              −
            </button>
            <output className="eq-ficha__valor" aria-live="polite">
              {limite === null ? 'Sem limite' : limite}
            </output>
            <button type="button" aria-label="Uma arma a mais" disabled={mais === null} onClick={() => mais !== null && onLimite(mais)}>
              +
            </button>
          </div>
        ) : (
          <span className="eq-ficha__valor">{limite === null ? 'Sem limite' : limite}</span>
        )}
        <p className="eq-ficha__nota">
          Só a arma equipada ataca. {limite === null ? `${equipadas} equipada${equipadas === 1 ? '' : 's'}` : `${equipadas} de ${limite} equipada${limite === 1 ? '' : 's'}`}. Trocar de arma é
          guardar uma e equipar outra.
        </p>
      </div>
      <h4 className="eq-ficha__subtit">Equipado</h4>
      <ul className="eq-ficha__vagas" aria-label="Armas e roupa em uso">
        {armas.map((vaga) => {
          const pente = penteDaArma(vaga, acervo)
          return (
            <li key={vaga.id} className="eq-vaga">
              <span className="eq-vaga__parte">Arma</span>
              <strong className="eq-vaga__nome">{vaga.nome}</strong>
              {pente !== null && acoesDoPente !== undefined ? (
                <PenteDoEquipado arma={vaga} capacidade={pente.capacidade} mochila={itens} acervo={acervo} acoes={acoesDoPente} />
              ) : (
                <span className="eq-vaga__det">{detalheDaArma(vaga, acervo)}</span>
              )}
              {marcarPadrao !== undefined && (
                <ArmaPadraoDoEquipado arma={vaga} padrao={vaga === padrao} marcar={marcarPadrao} />
              )}
            </li>
          )
        })}
        {Array.from({ length: livres }, (_, i) => (
          <li key={`livre-${i}`} className="eq-vaga eq-vaga--livre">
            <span className="eq-vaga__parte">Arma</span>
            <span className="eq-vaga__nome">Vaga de arma livre</span>
          </li>
        ))}
        {roupa.map((vaga) => (
          <li key={vaga.id} className="eq-vaga">
            <span className="eq-vaga__parte">Equipamento</span>
            <strong className="eq-vaga__nome">{vaga.nome}</strong>
            <span className="eq-vaga__det">{detalheDaRoupa(vaga, roupaNoAcervo)}</span>
          </li>
        ))}
        {roupa.length === 0 && (
          <li className="eq-vaga eq-vaga--livre">
            <span className="eq-vaga__parte">Corpo</span>
            <span className="eq-vaga__nome">Nada vestido</span>
          </li>
        )}
      </ul>
      {daRoupa !== '' && (
        <p className="eq-ficha__nota">
          A roupa vestida dá {daRoupa}. O Escudo da roupa enche no começo da batalha, antes da vida.
        </p>
      )}
    </div>
  )
}

/**
 * O toque "Arma padrão" do cartão da arma equipada (rodada 3): ligado na padrão de agora. Ligar outra troca a
 * padrão; desligar a marcada volta à primeira equipada. O rótulo não muda: o estado é o `aria-pressed`.
 */
function ArmaPadraoDoEquipado({ arma, padrao, marcar }: { arma: CarriedItem; padrao: boolean; marcar: (arma: CarriedItem, marcar: boolean) => string | null }) {
  const idBase = useId()
  const [aviso, setAviso] = useState<string | null>(null)
  // A padrão sem marca (a primeira equipada) ganha a marca; a marcada a perde.
  const marcada = arma.armaPadrao === true
  return (
    <div className="eq-vaga__acoes">
      <button
        type="button"
        className={`lb-btn lb-btn--compact ${padrao ? 'lb-btn--primary' : 'lb-btn--ghost'}`}
        aria-pressed={padrao}
        aria-describedby={`${idBase}-dica`}
        onClick={() => setAviso(marcar(arma, !marcada))}
      >
        Arma padrão
      </button>
      <p className="eq-vaga__dica" id={`${idBase}-dica`} aria-live="polite">
        {aviso ?? (padrao ? 'A técnica com "Dano da Arma" usa esta.' : 'Toque para a técnica com "Dano da Arma" usar esta.')}
      </p>
    </div>
  )
}

/** "CA +2 · Escudo +5" da roupa da vaga; nada = vazio. */
function detalheDaRoupa(vaga: CarriedItem, roupaNoAcervo: EquipamentoNoAcervo): string {
  const equipamento = equipamentoDaVaga(vaga, roupaNoAcervo)
  return equipamento === undefined ? '' : textoDoBonusDaRoupa(bonusDoEquipamento(equipamento))
}

const FALHOU_O_PEDIDO = 'Não deu para pedir agora: confira a conexão e tente de novo.'

/** "6" vira 6; vazio ou torto = `null`. */
function inteiroDoTexto(texto: string): number | null {
  const limpo = texto.trim()
  return /^\d{1,6}$/.test(limpo) ? Number.parseInt(limpo, 10) : null
}

/** O Esc dentro do ajuste fecha só ele: sem isto o mesmo Esc fecharia a ficha inteira. */
function escFechaSo(fechar: () => void): (event: KeyboardEvent<HTMLElement>) => void {
  return (event) => {
    if (event.key !== 'Escape') return
    event.stopPropagation()
    fechar()
  }
}

/**
 * O pente do cartão da arma equipada: "Pente 4 de 6 · Bala de Prata", a bala (com mais de uma que serve),
 * o Recarregar e, do mestre, o número que abre o ajuste à mão e o "Editar arma". O Recarregar desligado
 * diz o porquê na linha de baixo (sem bala na mochila, pente cheio, na batalha).
 */
function PenteDoEquipado({ arma, capacidade, mochila, acervo, acoes }: { arma: CarriedItem; capacidade: number; mochila: readonly CarriedItem[]; acervo: AcervoDaMochila; acoes: AcoesDoPente }) {
  const idBase = useId()
  const numeroRef = useRef<HTMLButtonElement>(null)
  const [escolhida, setEscolhida] = useState<string | null>(null)
  const [ajustando, setAjustando] = useState(false)
  const [esperando, setEsperando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const opcoes = balasParaOPente(mochila, arma.id, acervo)
  const carregado = arma.pente
  const noPente = carregado?.n ?? 0
  const bala = opcoes.find((vaga) => vaga.id === escolhida) ?? opcoes.find((vaga) => vaga.itemId === carregado?.balaId) ?? opcoes[0]
  // Bala de outro tipo com o pente carregado: o Recarregar devolve as de antes à mochila e põe esta (um tipo por vez).
  const troca = bala !== undefined && carregado !== undefined && carregado.n > 0 && bala.itemId !== carregado.balaId
  const cheio = bala !== undefined && !troca && noPente >= capacidade
  const motivo = acoes.motivo ?? (bala === undefined ? `Nenhuma bala que ${arma.nome} aceita na mochila.` : cheio ? 'O pente já está cheio.' : null)
  // A bala sem item no Acervo (o jogador, o site) tem o nome da pilha dela na mochila; sem pilha, fica sem nome.
  const nomeNoPente = carregado === undefined || carregado.n < 1 ? null : (acervo.paraDar(carregado.balaId)?.nome ?? mochila.find((vaga) => vaga.itemId === carregado.balaId)?.nome ?? null)
  const textoDoPente = `Pente ${noPente} de ${capacidade}`
  const dica = aviso ?? motivo

  const recarregar = () => {
    if (bala === undefined || motivo !== null || esperando) return
    setAviso(null)
    const resultado = acoes.recarregar(arma, bala.id)
    if (!(resultado instanceof Promise)) {
      setAviso(resultado)
      return
    }
    setEsperando(true)
    resultado.then(
      (recusa) => {
        setAviso(recusa)
        setEsperando(false)
      },
      () => {
        setAviso(FALHOU_O_PEDIDO)
        setEsperando(false)
      },
    )
  }
  const fecharOAjuste = () => {
    setAjustando(false)
    requestAnimationFrame(() => numeroRef.current?.focus())
  }
  const editar = acoes.editar
  const ajustar = acoes.ajustar

  return (
    <div className="eq-vaga__pente">
      <span className="eq-vaga__det">
        {ajustar !== undefined ? (
          <button
            ref={numeroRef}
            type="button"
            className="eq-vaga__numero"
            aria-expanded={ajustando}
            aria-label={`${textoDoPente}: ajustar à mão`}
            title="Ajustar o pente à mão (a mochila não muda)"
            onClick={() => setAjustando((aberto) => !aberto)}
          >
            {textoDoPente}
          </button>
        ) : (
          textoDoPente
        )}
        {nomeNoPente !== null && ` · ${nomeNoPente}`}
      </span>
      {ajustando && ajustar !== undefined && (
        <AjusteDoPente
          arma={arma}
          capacidade={capacidade}
          inicial={noPente}
          onPor={(n) => {
            const recusa = ajustar(arma, n)
            if (recusa === null) fecharOAjuste()
            return recusa
          }}
          onCancelar={fecharOAjuste}
        />
      )}
      <div className="eq-vaga__acoes">
        {opcoes.length > 1 && (
          <select className="lb-input eq-vaga__bala" aria-label={`Bala para o pente de ${arma.nome}`} value={bala?.id ?? ''} onChange={(event) => setEscolhida(event.target.value)}>
            {opcoes.map((vaga) => (
              <option key={vaga.id} value={vaga.id}>
                {vaga.nome} ({quantidadeDe(vaga).toLocaleString('pt-BR')})
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          className="lb-btn lb-btn--compact"
          aria-describedby={dica !== null ? `${idBase}-dica` : undefined}
          aria-busy={esperando}
          disabled={motivo !== null || esperando}
          onClick={recarregar}
        >
          {esperando ? 'Recarregando…' : troca ? `Trocar por ${bala.nome}` : 'Recarregar'}
        </button>
        {editar !== undefined && (
          <button
            type="button"
            className="lb-btn lb-btn--ghost lb-btn--compact"
            onClick={() => setAviso(editar(arma))}
          >
            Editar arma
          </button>
        )}
      </div>
      {dica !== null && (
        <p className="eq-vaga__dica" id={`${idBase}-dica`} aria-live="polite">
          {dica}
        </p>
      )}
    </div>
  )
}

/** O pente à mão (só o mestre): − n +, de 0 à capacidade; Enter põe, Esc cancela. `onPor` devolve o motivo de não ter posto, ou `null`. */
function AjusteDoPente({ arma, capacidade, inicial, onPor, onCancelar }: { arma: CarriedItem; capacidade: number; inicial: number; onPor: (n: number) => string | null; onCancelar: () => void }) {
  const idBase = useId()
  const [texto, setTexto] = useState(String(inicial))
  const [erro, setErro] = useState<string | null>(null)
  const atual = inteiroDoTexto(texto)
  const passo = (delta: number) => {
    setErro(null)
    setTexto(String(Math.min(Math.max((atual ?? inicial) + delta, 0), capacidade)))
  }
  const por = () => {
    if (atual === null || atual > capacidade) {
      setErro(`Diga quantas, de 0 a ${capacidade}.`)
      return
    }
    setErro(onPor(atual))
  }
  return (
    <div className="eq-vaga__ajuste" role="group" aria-label={`Pente de ${arma.nome} à mão`} onKeyDown={escFechaSo(onCancelar)}>
      <div className="eq-vaga__linha">
        <span className="eq-ficha__passo">
          <button type="button" aria-label="Uma bala a menos" disabled={(atual ?? inicial) <= 0} onClick={() => passo(-1)}>
            −
          </button>
          <input
            id={`${idBase}-n`}
            className="eq-vaga__campo"
            inputMode="numeric"
            autoComplete="off"
            aria-label={`Balas no pente de ${arma.nome}, de 0 a ${capacidade}`}
            aria-invalid={erro !== null}
            aria-describedby={erro !== null ? `${idBase}-erro` : undefined}
            value={texto}
            autoFocus
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => {
              setErro(null)
              setTexto(event.target.value)
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
              event.preventDefault()
              por()
            }}
          />
          <button type="button" aria-label="Uma bala a mais" disabled={(atual ?? inicial) >= capacidade} onClick={() => passo(1)}>
            +
          </button>
        </span>
        <span className="eq-vaga__det">de {capacidade}</span>
      </div>
      <div className="eq-vaga__acoes">
        <button type="button" className="lb-btn lb-btn--primary lb-btn--compact" onClick={por}>
          Pôr no pente
        </button>
        <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
      {erro !== null ? (
        <p className="eq-vaga__dica eq-vaga__dica--erro" id={`${idBase}-erro`} role="alert">
          {erro}
        </p>
      ) : (
        <p className="eq-vaga__dica">Correção de mesa: a mochila não muda.</p>
      )}
    </div>
  )
}

/** "Pente 4 de 6", "x2" (a pilha de granadas) ou nada. */
function detalheDaArma(vaga: CarriedItem, acervo: ReturnType<typeof acervoDaMochila>): string {
  const pente = penteDaArma(vaga, acervo)
  if (pente !== null) return `Pente ${vaga.pente?.n ?? 0} de ${pente.capacidade}`
  const quantos = quantidadeDe(vaga)
  return quantos > 1 ? `x${quantos}` : ''
}
