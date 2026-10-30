"""Junta os quadros do Blender nas folhas de sprites (Python do sistema + Pillow).

Uso:
    python montar_folhas.py <pasta_dos_quadros> [px_do_render]

Le d{0..7}_k{00..19}.png (render com px_do_render pixels por casa, padrao 128), reduz com Lanczos
em alfa pre-multiplicado (sem franja escura na borda) e grava, em ../folhas/:
    judge-blender-64px.png / .webp   (64 px por casa)
    judge-blender-48px.png / .webp   (48 px por casa)
    dados.js                         (tamanhos e pesos que o prototipo le)
Linhas = direcoes (sul, sudeste, leste, nordeste, norte, noroeste, oeste, sudoeste);
colunas = 12 quadros de respiro e depois 8 do cartao subindo.
"""
import json
import os
import sys

from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(os.path.dirname(AQUI), 'folhas')
QUADRO_L, QUADRO_A = 3.0, 3.75
N_DIR, N_COL = 8, 20


def reduzir(img, largura, altura):
    """Reduz em alfa pre-multiplicado: a cor transparente nao vaza para a borda."""
    pre = img.convert('RGBa').resize((largura, altura), Image.LANCZOS)
    return pre.convert('RGBA')


def kb(caminho):
    return round(os.path.getsize(caminho) / 1024)


def main():
    pasta = sys.argv[1]
    os.makedirs(SAIDA, exist_ok=True)
    dados = {'folhas': {}, 'extras': []}
    for px in (64, 48):
        fw, fh = int(QUADRO_L * px), int(QUADRO_A * px)
        folha = Image.new('RGBA', (fw * N_COL, fh * N_DIR), (0, 0, 0, 0))
        for d in range(N_DIR):
            for k in range(N_COL):
                q = Image.open(os.path.join(pasta, 'd%d_k%02d.png' % (d, k)))
                folha.paste(reduzir(q, fw, fh), (k * fw, d * fh))
        base = 'judge-blender-%dpx' % px
        png = os.path.join(SAIDA, base + '.png')
        webp = os.path.join(SAIDA, base + '.webp')
        folha.save(png, optimize=True)
        folha.save(webp, quality=88, method=6)
        dados['folhas'][str(px)] = {'arquivo': 'folhas/' + base + '.webp', 'largura': folha.width, 'altura': folha.height,
                                    'fw': fw, 'fh': fh, 'kb': kb(webp)}
        dados['extras'].append({'rotulo': base + '.png (mestre, sem perda)', 'tamanho': '%dx%d' % folha.size, 'kb': kb(png)})
        print(base, 'webp', kb(webp), 'KB  png', kb(png), 'KB')
    with open(os.path.join(SAIDA, 'dados.js'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('// gerado por fonte/montar_folhas.py\nwindow.JUDGE_FOLHAS = ' + json.dumps(dados, ensure_ascii=False, indent=2) + ';\n')


if __name__ == '__main__':
    main()
