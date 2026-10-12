// Adaptador do scripts/conferir-som.cjs (não é código do app): a faixa demo
// tocada pelo AGENDADOR AO VIVO da tela da dança, o mesmo código, chamado a
// cada 250 ms com a janela de 1,5 s. O conferir-som finge o relógio
// (`ctx.currentTime` anda com o quadro), então o que se mede aqui é o que o
// jogador ouve: ataques agendados aos pedaços, sem render offline da faixa.
import { criarAgendadorDaFaixa, JANELA_DO_AGENDADOR_S, PASSO_DO_AGENDADOR_MS } from '@app/minigames/danca/tela/agendadorDaFaixa'
import { eventosDaDemo, GANHO_FAIXA } from '@app/minigames/danca/som'

/** A música começa um pouco depois do zero, como na tela (o "começar" sempre vem antes). */
const INICIO_S = 0.25

export default function criar() {
  return {
    criarSom(kit: { ctx: BaseAudioContext; destino: AudioNode }) {
      const bus = kit.ctx.createGain()
      bus.gain.value = GANHO_FAIXA
      bus.connect(kit.destino)
      const agendador = criarAgendadorDaFaixa(kit.ctx, bus, eventosDaDemo(), INICIO_S)
      let proximo = 0
      return {
        atualizar() {
          const agora = kit.ctx.currentTime
          if (agora + 1e-9 < proximo) return
          agendador.agendarAte(agora + JANELA_DO_AGENDADOR_S, agora)
          proximo += PASSO_DO_AGENDADOR_MS / 1000
        },
      }
    },
    atualizar() {},
    descartar() {},
  }
}
