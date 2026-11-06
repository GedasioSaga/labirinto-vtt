import { useEffect, useMemo, useState } from 'react'
import { dueloParaOFio, type JogadaDoDuelo } from '../../../lib/treino/duelo'
import { sementeNova } from '../../../lib/treino/sorteio'
import type { CasaDaArena } from '../../../lib/arena/grade'
import { SISTEMA_DO_LOBBY, useDoSite } from '../contexto'
import { ArenaDaLuta, assentarAnimacao, nomeDaVez } from './ArenaDaLuta'
import { bonecosDoDuelo } from './grade/bonecosDoDuelo'
import { GradeDaArena } from './grade/GradeDaArena'
import { comecarLutaLocal, jogarNaLuta, lutaAteOFim, passoDoInimigo, problemaDaMontagem, type LutaLocal, type MontagemDaLuta } from './lutaDeTreino'
import { oQueEsperaDeMim, PainelDaVez } from './PainelDaVez'
import { contar, textoDaRecusa, textoDoFim, tomDoFim } from './textosDoTreino'

/**
 * A LUTA TURNO A TURNO do treino (fatia T7): você joga o seu lado, o robô
 * joga o inimigo com uma pausa curta para dar tempo de ler o registro. A
 * semente fica à vista: "Repetir esta luta" volta ao começo com a mesma
 * semente (mesmos dados; com as mesmas escolhas, o mesmo fim) e "Nova
 * semente" sorteia outra. "O robô joga por mim" deixa os dois lados no robô,
 * e aí a mesma semente dá sempre a mesma luta.
 */

/** A pausa do robô antes de cada jogada dele (e da sua, quando ele joga por você). */
const PAUSA_DO_ROBO_MS = 650
const PAUSA_COM_ROBO_POR_MIM_MS = 380

/** A linha de estado: de quem é a vez, ou a sua defesa (a vez ainda é de quem golpeou). */
function textoDoEstado(vez: { nome: string; lado: 'a' | 'b' } | null, esperaDeMim: 'reagir' | 'agir' | null, roboPorMim: boolean): string {
  if (vez === null) return ''
  if (roboPorMim) return `Vez de ${vez.nome}: o robô está jogando…`
  if (esperaDeMim === 'reagir') return `${vez.nome} golpeou: a defesa é sua.`
  if (vez.lado === 'b') return `Vez de ${vez.nome}: o robô está jogando…`
  // A vez é sua mas não espera nada de você: o golpe espera a defesa do inimigo.
  return esperaDeMim === null ? `${vez.nome} golpeou: o robô está defendendo…` : `Vez de ${vez.nome}.`
}

export function LutaTurnoATurno({ montagem, nomeDoInimigo }: { montagem: MontagemDaLuta; nomeDoInimigo: string }) {
  const [semente, setSemente] = useState(() => sementeNova())
  const [luta, setLuta] = useState<LutaLocal | null>(null)
  /** A montagem com que a luta começou: o "Repetir" luta com ela, mesmo se a escolha mudou depois. */
  const [montagemDaLuta, setMontagemDaLuta] = useState<MontagemDaLuta | null>(null)
  const [roboPorMim, setRoboPorMim] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const demo = useDoSite((estado) => estado.demo)
  const fio =useMemo(() => (luta === null ? null : dueloParaOFio(luta.duelo)), [luta])
  const problema = problemaDaMontagem(montagem)

  // O robô joga quando a vez não é sua (ou quando ele joga por você), com uma pausa para dar tempo de ler.
  useEffect(() => {
    if (luta === null || fio === null || fio.fim !== null) return
    if (!roboPorMim && oQueEsperaDeMim(fio, 'a') !== null) return
    const id = window.setTimeout(
      () => {
        const depois = passoDoInimigo(luta, roboPorMim)
        if (depois !== null) setLuta(depois)
      },
      roboPorMim ? PAUSA_COM_ROBO_POR_MIM_MS : PAUSA_DO_ROBO_MS,
    )
    return () => window.clearTimeout(id)
  }, [luta, fio, roboPorMim])

  function comecar(qual: MontagemDaLuta, comSemente: number) {
    const comeco = comecarLutaLocal(qual, SISTEMA_DO_LOBBY, comSemente)
    setAviso(comeco.ok ? null : comeco.motivo)
    if (!comeco.ok) return
    setSemente(comSemente)
    setMontagemDaLuta(qual)
    setLuta(comeco.luta)
  }

  function jogar(jogada: JogadaDoDuelo) {
    if (luta === null) return
    const feito = jogarNaLuta(luta, jogada)
    if (!feito.ok) {
      setAviso(textoDaRecusa(feito.motivo))
      return
    }
    setAviso(null)
    setLuta(feito.luta)
  }

  /** Andar na grade: livre no seu lado, como na Arena do app; a regra recusa a casa ocupada ou fora da grade. */
  function andar(tokenId: string, casa: CasaDaArena): boolean {
    if (luta === null) return false
    const feito = jogarNaLuta(luta, { tipo: 'andar', seq: luta.duelo.seq, vez: null, tokenId, col: casa.col, row: casa.row })
    if (!feito.ok) {
      setAviso(textoDaRecusa(feito.motivo))
      return false
    }
    setAviso(null)
    setLuta(feito.luta)
    return true
  }

  function roboEscolhe() {
    if (luta === null) return
    const depois = passoDoInimigo(luta, true)
    setAviso(depois === null ? 'O robô não achou jogada agora.' : null)
    if (depois !== null) setLuta(depois)
  }

  const vez = fio === null || fio.fim !== null ? null : nomeDaVez(fio)
  const esperaDeMim = fio === null ? null : oQueEsperaDeMim(fio, 'a')

  return (
    <div className="lo-tr-luta">
      <div className="lo-tr-semente" role="group" aria-label="Semente da luta">
        <p className="lo-tr-semente__texto">
          Semente <span className="lo-tr-semente__numero">{semente}</span>
        </p>
        <div className="lo-tr-semente__botoes">
          {luta === null ? (
            <button type="button" className="lo-btn lo-btn--primario" disabled={problema !== null} onClick={() => comecar(montagem, semente)}>
              Começar a luta
            </button>
          ) : (
            <button type="button" className="lo-btn" disabled={montagemDaLuta === null} onClick={() => montagemDaLuta !== null && comecar(montagemDaLuta, semente)}>
              Repetir esta luta
            </button>
          )}
          <button
            type="button"
            className="lo-btn"
            disabled={problema !== null}
            onClick={() => {
              const nova = sementeNova()
              if (luta === null) setSemente(nova)
              else comecar(montagem, nova)
            }}
          >
            Nova semente
          </button>
        </div>
        <label className="lo-tr-chave">
          <input type="checkbox" checked={roboPorMim} onChange={(evento) => setRoboPorMim(evento.target.checked)} />
          <span>O robô joga por mim</span>
        </label>
      </div>

      {problema !== null && luta === null && <p className="lo-motivo">{problema}</p>}
      {aviso !== null && (
        <p className="lo-linha-aviso" role="alert">
          {aviso}
        </p>
      )}

      {luta === null || fio === null ? (
        <p className="lo-tr-explica">
          Mesma semente, mesmos dados: com as mesmas escolhas, a luta termina igual. O dano sai da ficha, ninguém digita. Nada aqui muda a sua ficha.
        </p>
      ) : (
        <>
          {fio.fim !== null ? (
            <div className="lo-tr-fim" data-tom={tomDoFim(fio.fim, 'a')} role="status" onAnimationEnd={assentarAnimacao}>
              <p className="lo-tr-fim__texto">{textoDoFim(fio.fim, 'a', nomeDoInimigo)}</p>
              <p className="lo-tr-fim__nota">
                Rodada {fio.turnos.rodada}, {contar(fio.seq, 'jogada', 'jogadas')}, semente {luta.semente}.
              </p>
            </div>
          ) : (
            <div className="lo-tr-estado">
              <p role="status">
                Rodada {fio.turnos.rodada}. {textoDoEstado(vez, esperaDeMim, roboPorMim)}
              </p>
              <button type="button" className="lo-btn lo-btn--fantasma" onClick={() => setLuta(lutaAteOFim(luta))}>
                Ir até o fim com o robô
              </button>
            </div>
          )}
          <GradeDaArena bonecos={bonecosDoDuelo(fio, demo, (vaga, emPe) => vaga.lado === 'a' && emPe)} trilhas={luta.duelo.cena.trilhas} onAndar={andar} rotulo="Grade da luta" />
          {fio.fim === null && !roboPorMim && esperaDeMim !== null && <PainelDaVez duelo={fio} meuLado="a" ocupado={false} onJogar={jogar} onRoboEscolhe={roboEscolhe} />}
          <ArenaDaLuta duelo={fio} meuLado="a" nomeDoMeuLado="Seu lado" nomeDoOutroLado="Inimigos" />
        </>
      )}
    </div>
  )
}
