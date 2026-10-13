# Transição "Campo ensolarado"

Transição de viagem do pino, aprovada pelo mestre em 12/10/2026 ("Agora sim, ta perfeito, pode aplicar").

- 7 s em primeira pessoa: anda por uma estrada de terra num campo verde, para, ergue o olhar ao sol; o sol cresce até a tela branca, que escurece para preto no último meio segundo.
- Som: passos na terra, vento no capim, pássaros ao longe, brilho agudo no clarão.
- Código: `client/src/animacoes/transicao/campo-ensolarado.ts` (+ `.json`, `.test.ts`); sai pelo pacote de animações, sem instalador.
- `prototipo.html`: o protótipo aprovado (mesmo código da cena, `three@0.186.1` da CDN).
- `provas/`: gráfico do movimento, onda do som e medidas do `conferir-som` (-19,8 LUFS, pico -4,3 dBTP).
- Protótipo publicado: https://claude.ai/artifact/1aESTxucrTZXR6HZEVZ59f

Histórico: v1 com capim dourado; v2 trocou para campo verde a pedido do usuário e acabou com os "degraus" do capim na beira da estrada.
