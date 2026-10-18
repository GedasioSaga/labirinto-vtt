// Adaptador das provas-app (não é código do app): toca a SEQ do som.ts DO APP
// pelo kit do scripts/conferir-som.cjs, no barramento com o GANHO da tela.
// O conferir-som monta com Vite e resolve @app para client/src.
import { GANHO, sequencia } from '@app/minigames/pesca/som'

interface KitDoConferirSom {
  ctx: BaseAudioContext
  destino: AudioNode
}

export default function criar() {
  return {
    criarSom(kit: KitDoConferirSom) {
      const fx = kit.ctx.createGain()
      fx.gain.value = GANHO
      fx.connect(kit.destino)
      sequencia(kit.ctx, fx, kit.ctx.currentTime)
      return { atualizar() {} }
    },
    atualizar() {},
    descartar() {},
  }
}
