# Transição "Portão de ferro"

Transição de viagem do pino ou da escada, no estilo da tela de porta do Resident Evil (1998, PlayStation). Aprovada pelo mestre em 15/10/2026 ("A animação ta ótima, só aplica.").

- 9 s em primeira pessoa, noite de neblina fria: chega pela laje de pedra, sobe o degrau (0,4–2,9 s), o trinco de queda solta com um estalo de ferro (3,0 s), as duas folhas de grade abrem devagar, pesadas, para longe da câmera (3,3–7,0 s), com um rangido longo de dobradiça que sobe e desce de tom com a velocidade; passam um pouco do ponto, voltam e assentam. A câmera atravessa (6,2–8,6 s), a neblina toma a tela e o último meio segundo vai ao preto.
- Abre numa curva só, sem emperrar (o que emperra é o "Portão pesado").
- Movimento reduzido: câmera parada na laje, mais perto, sem passo, sem respiração e sem balanço das folhas; o resto (trinco, abertura, neblina, preto) igual.
- Som: vento frio, passos na pedra, raspado e estalo do trinco, rangido das duas dobradiças (cada uma num lado), barras tilintando ao parar e um "iic" curto no balanço.
- Código: `client/src/animacoes/transicao/portao-de-ferro.ts` (+ `.json`, `.test.ts`); sai pelo pacote de animações, sem instalador. O ar de PlayStation é o mesmo pipeline do "Portão pesado" (imagem pequena ~430×240, cor de 15 bits, pontilhado de Bayer, uma luz fria com sombra).
- `prototipo.html`: o mesmo código da cena (empacotado pelo esbuild), `three@0.186.1` da CDN, luz convertida como no motor.
- `provas/`: gráfico do movimento com a envoltória do som no mesmo tempo, onda do som e medidas do `conferir-som` (-19,4 LUFS, pico -2,8 dBTP, sem clique nem corte). A folha de contato, o espectrograma e o `.wav` ficaram fora do repositório pelo tamanho.
- Protótipo publicado: https://claude.ai/artifact/E3tPz9Qfy8iqJbFVG1no9A
