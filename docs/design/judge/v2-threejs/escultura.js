/*
 * Escultura: as ferramentas que fazem o Judge v2 parecer esculpido, e não montado
 * com bolas e cilindros.
 *  - campos de distância (SDF) com união suave: as formas se fundem como argila;
 *  - surface nets: o campo vira uma malha lisa, com a normal tirada do próprio campo;
 *  - oclusão de ambiente assada no vértice (os cantos escurecem, como numa pintura);
 *  - penas em cartões com alfa, tubos afinados (chifre, rédea);
 *  - texturas pintadas em canvas (penas, pincelada, céu, fundo, brilho do cartão).
 *
 * Script clássico (abre por file://): usa o THREE global e publica window.Escultura.
 * Tudo é determinístico: mesma semente, mesmo modelo.
 */
(function () {
  'use strict'
  const T = THREE

  // ---------------- números ----------------
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x)
  const mix = (a, b, t) => a + (b - a) * t
  function smoothstep(a, b, x) {
    const t = clamp((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)
  }
  /** União suave: k é o raio da "massa" que junta as duas formas. */
  function smin(a, b, k) {
    if (k <= 0) return a < b ? a : b
    const h = Math.max(k - Math.abs(a - b), 0) / k
    return (a < b ? a : b) - h * h * k * 0.25
  }
  const smax = (a, b, k) => -smin(-a, -b, k)

  /** Gerador com semente (mulberry32). */
  function aleatorio(semente) {
    let a = semente >>> 0
    return function () {
      a = (a + 0x6d2b79f5) >>> 0
      let t = a
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  // ---------------- ruído de valor 3D (-1..1) ----------------
  function hash3(i, j, k) {
    let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(k, 1274126177)
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    h ^= h >>> 16
    return (h >>> 0) / 4294967295
  }
  function ruido(x, y, z) {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const zi = Math.floor(z)
    const xf = x - xi
    const yf = y - yi
    const zf = z - zi
    const u = xf * xf * (3 - 2 * xf)
    const v = yf * yf * (3 - 2 * yf)
    const w = zf * zf * (3 - 2 * zf)
    const a = hash3(xi, yi, zi)
    const b = hash3(xi + 1, yi, zi)
    const c = hash3(xi, yi + 1, zi)
    const d = hash3(xi + 1, yi + 1, zi)
    const e = hash3(xi, yi, zi + 1)
    const f = hash3(xi + 1, yi, zi + 1)
    const g = hash3(xi, yi + 1, zi + 1)
    const h = hash3(xi + 1, yi + 1, zi + 1)
    const x1 = a + (b - a) * u
    const x2 = c + (d - c) * u
    const x3 = e + (f - e) * u
    const x4 = g + (h - g) * u
    const y1 = x1 + (x2 - x1) * v
    const y2 = x3 + (x4 - x3) * v
    return (y1 + (y2 - y1) * w) * 2 - 1
  }
  function fbm(x, y, z, oitavas) {
    let s = 0
    let amp = 0.5
    let f = 1
    for (let i = 0; i < oitavas; i++) {
      s += amp * ruido(x * f + i * 17.3, y * f, z * f)
      f *= 2.03
      amp *= 0.5
    }
    return s
  }

  // ---------------- primitivas (campo < 0 dentro) ----------------
  /** Matriz que leva do mundo para o espaço local da peça (transposta da rotação). */
  function rotacao(r) {
    if (!r) return null
    const e = new T.Matrix4().makeRotationFromEuler(new T.Euler(r[0] || 0, r[1] || 0, r[2] || 0)).elements
    return [e[0], e[1], e[2], e[4], e[5], e[6], e[8], e[9], e[10]]
  }

  function esfera(c, r) {
    const cx = c[0]
    const cy = c[1]
    const cz = c[2]
    return (x, y, z) => {
      const dx = x - cx
      const dy = y - cy
      const dz = z - cz
      return Math.sqrt(dx * dx + dy * dy + dz * dz) - r
    }
  }

  function elipsoide(c, r, rot) {
    const cx = c[0]
    const cy = c[1]
    const cz = c[2]
    const ia = 1 / r[0]
    const ib = 1 / r[1]
    const ic = 1 / r[2]
    const m = rotacao(rot)
    const menor = Math.min(r[0], r[1], r[2])
    return (x, y, z) => {
      let px = x - cx
      let py = y - cy
      let pz = z - cz
      if (m) {
        const lx = m[0] * px + m[1] * py + m[2] * pz
        const ly = m[3] * px + m[4] * py + m[5] * pz
        const lz = m[6] * px + m[7] * py + m[8] * pz
        px = lx
        py = ly
        pz = lz
      }
      const ax = px * ia
      const ay = py * ib
      const az = pz * ic
      const k0 = Math.sqrt(ax * ax + ay * ay + az * az)
      const bx = ax * ia
      const by = ay * ib
      const bz = az * ic
      const k1 = Math.sqrt(bx * bx + by * by + bz * bz)
      return k1 < 1e-9 ? -menor : (k0 * (k0 - 1)) / k1
    }
  }

  /** Cone de pontas redondas (raio r1 em a, r2 em b). Exato. */
  function coneRedondo(a, b, r1, r2) {
    const ax = a[0]
    const ay = a[1]
    const az = a[2]
    const bax = b[0] - ax
    const bay = b[1] - ay
    const baz = b[2] - az
    const l2 = bax * bax + bay * bay + baz * baz
    const rr = r1 - r2
    const a2 = l2 - rr * rr
    const il2 = 1 / l2
    const srr = Math.sign(rr) * rr * rr
    return (x, y, z) => {
      const pax = x - ax
      const pay = y - ay
      const paz = z - az
      const yy = pax * bax + pay * bay + paz * baz
      const zz = yy - l2
      const qx = pax * l2 - bax * yy
      const qy = pay * l2 - bay * yy
      const qz = paz * l2 - baz * yy
      const x2 = qx * qx + qy * qy + qz * qz
      const y2 = yy * yy * l2
      const z2 = zz * zz * l2
      const k = srr * x2
      if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2
      if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1
      return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - r1
    }
  }

  /** Tronco de cone de tampas retas (as placas da armadura). Exato. */
  function coneCortado(a, b, ra, rb) {
    const ax = a[0]
    const ay = a[1]
    const az = a[2]
    const bax = b[0] - ax
    const bay = b[1] - ay
    const baz = b[2] - az
    const baba = bax * bax + bay * bay + baz * baz
    const rba = rb - ra
    const kk = rba * rba + baba
    return (x, y, z) => {
      const pax = x - ax
      const pay = y - ay
      const paz = z - az
      const papa = pax * pax + pay * pay + paz * paz
      const paba = (pax * bax + pay * bay + paz * baz) / baba
      const xx = Math.sqrt(Math.max(0, papa - paba * paba * baba))
      const cax = Math.max(0, xx - (paba < 0.5 ? ra : rb))
      const cay = Math.abs(paba - 0.5) - 0.5
      const f = clamp((rba * (xx - ra) + paba * baba) / kk, 0, 1)
      const cbx = xx - ra - f * rba
      const cby = paba - f
      const s = cbx < 0 && cay < 0 ? -1 : 1
      return s * Math.sqrt(Math.min(cax * cax + cay * cay * baba, cbx * cbx + cby * cby * baba))
    }
  }

  /** Caixa de cantos arredondados (meia-medida h, raio do canto r). */
  function caixa(c, h, r, rot) {
    const m = rotacao(rot)
    const hx = h[0] - r
    const hy = h[1] - r
    const hz = h[2] - r
    return (x, y, z) => {
      let px = x - c[0]
      let py = y - c[1]
      let pz = z - c[2]
      if (m) {
        const lx = m[0] * px + m[1] * py + m[2] * pz
        const ly = m[3] * px + m[4] * py + m[5] * pz
        const lz = m[6] * px + m[7] * py + m[8] * pz
        px = lx
        py = ly
        pz = lz
      }
      const qx = Math.abs(px) - hx
      const qy = Math.abs(py) - hy
      const qz = Math.abs(pz) - hz
      const ox = qx > 0 ? qx : 0
      const oy = qy > 0 ? qy : 0
      const oz = qz > 0 ? qz : 0
      return Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(qx, Math.max(qy, qz)), 0) - r
    }
  }

  /** Toro deitado no plano xz local (eixo = y local). */
  function toro(c, R, r, rot) {
    const m = rotacao(rot)
    return (x, y, z) => {
      let px = x - c[0]
      let py = y - c[1]
      let pz = z - c[2]
      if (m) {
        const lx = m[0] * px + m[1] * py + m[2] * pz
        const ly = m[3] * px + m[4] * py + m[5] * pz
        const lz = m[6] * px + m[7] * py + m[8] * pz
        px = lx
        py = ly
        pz = lz
      }
      const q = Math.sqrt(px * px + pz * pz) - R
      return Math.sqrt(q * q + py * py) - r
    }
  }

  /** Corrente de cones redondos fundidos: pontos = [[x,y,z,r], ...]. */
  function cadeia(pontos, k) {
    const partes = []
    for (let i = 0; i < pontos.length - 1; i++) {
      const a = pontos[i]
      const b = pontos[i + 1]
      partes.push(coneRedondo([a[0], a[1], a[2]], [b[0], b[1], b[2]], a[3], b[3]))
    }
    return (x, y, z) => {
      let d = partes[0](x, y, z)
      for (let i = 1; i < partes.length; i++) d = smin(d, partes[i](x, y, z), k)
      return d
    }
  }

  /** Plano: distância com sinal até o plano que passa por p com normal n (n aponta para "fora"). */
  function plano(p, n) {
    const L = Math.hypot(n[0], n[1], n[2])
    const nx = n[0] / L
    const ny = n[1] / L
    const nz = n[2] / L
    const d0 = nx * p[0] + ny * p[1] + nz * p[2]
    return (x, y, z) => nx * x + ny * y + nz * z - d0
  }

  // ---------------- surface nets ----------------
  const OFF_ARESTAS = [0, 1, 2, 3, 4, 5, 6, 7, 0, 2, 1, 3, 4, 6, 5, 7, 0, 4, 1, 5, 2, 6, 3, 7]

  /**
   * Transforma um campo em malha. caixa = [x0, y0, z0, x1, y1, z1], celula = lado da célula.
   * Amostra em banda estreita (blocos longe da superfície herdam o sinal do centro),
   * põe um vértice por célula cortada, puxa o vértice para a superfície e tira a normal
   * do gradiente do campo. Devolve { pos, nor, idx }.
   */
  function malhaDoCampo(f, cx0, celula) {
    const x0 = cx0[0]
    const y0 = cx0[1]
    const z0 = cx0[2]
    const nx = Math.ceil((cx0[3] - x0) / celula) + 1
    const ny = Math.ceil((cx0[4] - y0) / celula) + 1
    const nz = Math.ceil((cx0[5] - z0) / celula) + 1
    const nxy = nx * ny
    const v = new Float32Array(nxy * nz)

    // 1) amostrar
    const B = 4
    const longe = 1.6 * (((B - 1) / 2) * celula * Math.sqrt(3) + celula)
    for (let bk = 0; bk < nz; bk += B) {
      const k1 = Math.min(bk + B, nz)
      for (let bj = 0; bj < ny; bj += B) {
        const j1 = Math.min(bj + B, ny)
        for (let bi = 0; bi < nx; bi += B) {
          const i1 = Math.min(bi + B, nx)
          const dc = f(x0 + ((bi + i1 - 1) / 2) * celula, y0 + ((bj + j1 - 1) / 2) * celula, z0 + ((bk + k1 - 1) / 2) * celula)
          const perto = Math.abs(dc) <= longe
          for (let k = bk; k < k1; k++) {
            const z = z0 + k * celula
            for (let j = bj; j < j1; j++) {
              const y = y0 + j * celula
              let o = bi + nx * (j + ny * k)
              for (let i = bi; i < i1; i++, o++) v[o] = perto ? f(x0 + i * celula, y, z) : dc
            }
          }
        }
      }
    }

    // 2) um vértice por célula cortada (média dos cruzamentos nas 12 arestas)
    const cx = nx - 1
    const cy = ny - 1
    const cz = nz - 1
    const idCel = new Int32Array(cx * cy * cz).fill(-1)
    const pos = []
    const OFF = [0, 1, nx, nx + 1, nxy, nxy + 1, nxy + nx, nxy + nx + 1]
    const c = new Float32Array(8)
    for (let k = 0; k < cz; k++) {
      for (let j = 0; j < cy; j++) {
        let o = nx * (j + ny * k)
        for (let i = 0; i < cx; i++, o++) {
          let mask = 0
          for (let q = 0; q < 8; q++) {
            const val = v[o + OFF[q]]
            c[q] = val
            if (val < 0) mask |= 1 << q
          }
          if (mask === 0 || mask === 255) continue
          let sx = 0
          let sy = 0
          let sz = 0
          let n = 0
          for (let e = 0; e < 24; e += 2) {
            const a = OFF_ARESTAS[e]
            const b = OFF_ARESTAS[e + 1]
            const va = c[a]
            const vb = c[b]
            if (va < 0 === vb < 0) continue
            const t = va / (va - vb)
            sx += (a & 1) + ((b & 1) - (a & 1)) * t
            sy += ((a >> 1) & 1) + (((b >> 1) & 1) - ((a >> 1) & 1)) * t
            sz += ((a >> 2) & 1) + (((b >> 2) & 1) - ((a >> 2) & 1)) * t
            n++
          }
          idCel[i + cx * (j + cy * k)] = pos.length / 3
          pos.push(x0 + (i + sx / n) * celula, y0 + (j + sy / n) * celula, z0 + (k + sz / n) * celula)
        }
      }
    }

    // 3) faces: cada aresta da grade que troca de sinal vira um quadrilátero
    const idx = []
    const cel = (i, j, k) => idCel[i + cx * (j + cy * k)]
    function quad(a, b, cc, d, dentro) {
      if (a < 0 || b < 0 || cc < 0 || d < 0) return
      if (dentro) idx.push(a, b, cc, a, cc, d)
      else idx.push(a, cc, b, a, d, cc)
    }
    for (let k = 0; k < nz; k++) {
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const o = i + nx * (j + ny * k)
          const dentro = v[o] < 0
          if (i < cx && j > 0 && k > 0 && j < cy && k < cz && dentro !== v[o + 1] < 0) {
            quad(cel(i, j - 1, k - 1), cel(i, j, k - 1), cel(i, j, k), cel(i, j - 1, k), dentro)
          }
          if (j < cy && i > 0 && k > 0 && i < cx && k < cz && dentro !== v[o + nx] < 0) {
            quad(cel(i - 1, j, k - 1), cel(i - 1, j, k), cel(i, j, k), cel(i, j, k - 1), dentro)
          }
          if (k < cz && i > 0 && j > 0 && i < cx && j < cy && dentro !== v[o + nxy] < 0) {
            quad(cel(i - 1, j - 1, k), cel(i, j - 1, k), cel(i, j, k), cel(i - 1, j, k), dentro)
          }
        }
      }
    }

    // 4) puxar para a superfície (1 passo de Newton) e normal pelo gradiente
    const nV = pos.length / 3
    const P = new Float32Array(pos)
    const N = new Float32Array(nV * 3)
    const h = celula * 0.5
    const maxPasso = celula * 0.75
    for (let q = 0; q < nV; q++) {
      let x = P[3 * q]
      let y = P[3 * q + 1]
      let z = P[3 * q + 2]
      const d = f(x, y, z)
      let gx = f(x + h, y, z) - f(x - h, y, z)
      let gy = f(x, y + h, z) - f(x, y - h, z)
      let gz = f(x, y, z + h) - f(x, y, z - h)
      const g2 = gx * gx + gy * gy + gz * gz
      if (g2 > 1e-14) {
        const kk = (d * 2 * h) / g2
        let dx = -kk * gx
        let dy = -kk * gy
        let dz = -kk * gz
        const L = Math.sqrt(dx * dx + dy * dy + dz * dz)
        if (L > maxPasso) {
          const s = maxPasso / L
          dx *= s
          dy *= s
          dz *= s
        }
        x += dx
        y += dy
        z += dz
        gx = f(x + h, y, z) - f(x - h, y, z)
        gy = f(x, y + h, z) - f(x, y - h, z)
        gz = f(x, y, z + h) - f(x, y, z - h)
      }
      const L = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1
      P[3 * q] = x
      P[3 * q + 1] = y
      P[3 * q + 2] = z
      N[3 * q] = gx / L
      N[3 * q + 1] = gy / L
      N[3 * q + 2] = gz / L
    }

    // 5) o lado de fora tem que olhar para fora (confere pela normal do campo)
    let soma = 0
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t] * 3
      const b = idx[t + 1] * 3
      const cc = idx[t + 2] * 3
      const e1x = P[b] - P[a]
      const e1y = P[b + 1] - P[a + 1]
      const e1z = P[b + 2] - P[a + 2]
      const e2x = P[cc] - P[a]
      const e2y = P[cc + 1] - P[a + 1]
      const e2z = P[cc + 2] - P[a + 2]
      soma += (e1y * e2z - e1z * e2y) * N[a] + (e1z * e2x - e1x * e2z) * N[a + 1] + (e1x * e2y - e1y * e2x) * N[a + 2]
    }
    if (soma < 0) {
      for (let t = 0; t < idx.length; t += 3) {
        const tmp = idx[t + 1]
        idx[t + 1] = idx[t + 2]
        idx[t + 2] = tmp
      }
    }
    return { pos: P, nor: N, idx: new Uint32Array(idx) }
  }

  // ---------------- oclusão de ambiente por grade ----------------
  /**
   * Amostra o campo da cena numa grade grossa uma vez só; depois cada vértice
   * pergunta "quanta coisa há perto de mim, para fora da minha normal?".
   */
  function criarOclusao(campo, cx0, celula) {
    const x0 = cx0[0]
    const y0 = cx0[1]
    const z0 = cx0[2]
    const nx = Math.ceil((cx0[3] - x0) / celula) + 1
    const ny = Math.ceil((cx0[4] - y0) / celula) + 1
    const nz = Math.ceil((cx0[5] - z0) / celula) + 1
    const g = new Float32Array(nx * ny * nz)
    let o = 0
    for (let k = 0; k < nz; k++) {
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) g[o++] = campo(x0 + i * celula, y0 + j * celula, z0 + k * celula)
      }
    }
    function amostra(x, y, z) {
      const fx = clamp((x - x0) / celula, 0, nx - 1.001)
      const fy = clamp((y - y0) / celula, 0, ny - 1.001)
      const fz = clamp((z - z0) / celula, 0, nz - 1.001)
      const i = fx | 0
      const j = fy | 0
      const k = fz | 0
      const u = fx - i
      const v = fy - j
      const w = fz - k
      const a = i + nx * (j + ny * k)
      const nxy = nx * ny
      const c00 = g[a] + (g[a + 1] - g[a]) * u
      const c10 = g[a + nx] + (g[a + nx + 1] - g[a + nx]) * u
      const c01 = g[a + nxy] + (g[a + nxy + 1] - g[a + nxy]) * u
      const c11 = g[a + nxy + nx] + (g[a + nxy + nx + 1] - g[a + nxy + nx]) * u
      const c0 = c00 + (c10 - c00) * v
      const c1 = c01 + (c11 - c01) * v
      return c0 + (c1 - c0) * w
    }
    const PASSOS = [0.05, 0.1, 0.17, 0.27]
    const PESOS = [1, 0.7, 0.5, 0.35]
    return function oclusao(x, y, z, nx2, ny2, nz2) {
      let occ = 0
      for (let s = 0; s < 4; s++) {
        const hh = PASSOS[s]
        const d = amostra(x + nx2 * hh, y + ny2 * hh, z + nz2 * hh)
        occ += PESOS[s] * Math.max(0, hh - d) / hh
      }
      return clamp(1 - occ * 0.42, 0, 1)
    }
  }

  // ---------------- tubos (chifre, rédea) ----------------
  /**
   * Tubo ao longo de uma curva, com raio que muda (raio(t)) e seção achatada.
   * Escreve em geo (cria se não vier). t de 0 a 1 vai no atributo uv.y.
   */
  function tubo(pontos, raio, nComp, nRad, opcoes, geo) {
    const o = opcoes || {}
    const sx = o.achatar ? o.achatar[0] : 1
    const sy = o.achatar ? o.achatar[1] : 1
    const curva = new T.CatmullRomCurve3(pontos, false, 'centripetal')
    const quadros = curva.computeFrenetFrames(nComp, false)
    const nVert = (nComp + 1) * (nRad + 1)
    let g = geo
    if (!g) {
      g = new T.BufferGeometry()
      g.setAttribute('position', new T.BufferAttribute(new Float32Array(nVert * 3), 3))
      g.setAttribute('normal', new T.BufferAttribute(new Float32Array(nVert * 3), 3))
      const uv = new Float32Array(nVert * 2)
      const idx = []
      for (let i = 0; i <= nComp; i++) {
        for (let j = 0; j <= nRad; j++) {
          uv[2 * (i * (nRad + 1) + j)] = j / nRad
          uv[2 * (i * (nRad + 1) + j) + 1] = i / nComp
        }
      }
      for (let i = 0; i < nComp; i++) {
        for (let j = 0; j < nRad; j++) {
          const a = i * (nRad + 1) + j
          const b = a + nRad + 1
          idx.push(a, b, a + 1, b, b + 1, a + 1)
        }
      }
      g.setAttribute('uv', new T.BufferAttribute(uv, 2))
      g.setIndex(idx)
    }
    const pos = g.attributes.position
    const p = new T.Vector3()
    let n = 0
    for (let i = 0; i <= nComp; i++) {
      const t = i / nComp
      curva.getPointAt(t, p)
      const r = raio(t)
      const N = quadros.normals[i]
      const Bn = quadros.binormals[i]
      for (let j = 0; j <= nRad; j++) {
        const a = (j / nRad) * Math.PI * 2
        const ca = Math.cos(a) * r * sx
        const sa = Math.sin(a) * r * sy
        pos.setXYZ(n++, p.x + ca * N.x + sa * Bn.x, p.y + ca * N.y + sa * Bn.y, p.z + ca * N.z + sa * Bn.z)
      }
    }
    pos.needsUpdate = true
    g.computeVertexNormals()
    g.computeBoundingSphere()
    return g
  }

  // ---------------- penas em cartões ----------------
  function novoLote() {
    return { pos: [], nor: [], cor: [], uv: [], idx: [] }
  }

  const _d = new T.Vector3()
  const _l = new T.Vector3()
  const _n = new T.Vector3()
  const _c = new T.Color()

  /**
   * Uma pena: um cartão curvo de 4 x 2 quadrados com a textura do atlas (tipo 0..3).
   * o = { base, dir, lado, comp, larg, tipo, curva, concha, corBase, corPonta, normal, mistura, ao, cima }
   * A normal de cada vértice puxa para a normal "de volume" (o corpo embaixo), para a
   * pena acender e escurecer junto com o corpo, e não como uma lasca solta.
   */
  function pena(lote, o) {
    const d = _d.copy(o.dir).normalize()
    const l = _l.copy(o.lado).addScaledVector(d, -o.lado.dot(d)).normalize()
    const n = _n.crossVectors(l, d).normalize()
    if (o.cima && n.dot(o.cima) < 0) {
      n.negate()
      l.negate()
    }
    const L = o.segs || 4
    const base = lote.pos.length / 3
    const mist = o.mistura === undefined ? 0.55 : o.mistura
    const vol = o.normal || n
    const ao = o.ao === undefined ? 1 : o.ao
    const aoPonta = o.aoPonta === undefined ? 1 : o.aoPonta
    for (let i = 0; i <= L; i++) {
      const s = i / L
      const dobra = (o.curva || 0) * s * s * o.comp
      for (let j = 0; j <= 2; j++) {
        const u = j - 1
        const conc = (o.concha || 0) * o.larg * u * u
        const px = o.base.x + d.x * s * o.comp + l.x * u * o.larg * 0.5 - n.x * (dobra + conc)
        const py = o.base.y + d.y * s * o.comp + l.y * u * o.larg * 0.5 - n.y * (dobra + conc)
        const pz = o.base.z + d.z * s * o.comp + l.z * u * o.larg * 0.5 - n.z * (dobra + conc)
        lote.pos.push(px, py, pz)
        // a normal tomba junto com a dobra da ponta
        const tomba = (o.curva || 0) * 2 * s
        let qx = n.x - d.x * tomba
        let qy = n.y - d.y * tomba
        let qz = n.z - d.z * tomba
        qx = qx * (1 - mist) + vol.x * mist
        qy = qy * (1 - mist) + vol.y * mist
        qz = qz * (1 - mist) + vol.z * mist
        const q = Math.hypot(qx, qy, qz) || 1
        lote.nor.push(qx / q, qy / q, qz / q)
        lote.uv.push((o.tipo + 0.04 + ((u + 1) / 2) * 0.92) / 4, s)
        _c.copy(o.corBase).lerp(o.corPonta, Math.pow(s, 1.25))
        const sombra = mix(ao, aoPonta, s)
        lote.cor.push(_c.r * sombra, _c.g * sombra, _c.b * sombra)
      }
    }
    for (let i = 0; i < L; i++) {
      const a = base + i * 3
      lote.idx.push(a, a + 1, a + 4, a, a + 4, a + 3, a + 1, a + 2, a + 5, a + 1, a + 5, a + 4)
    }
  }

  function geometriaDoLote(lote) {
    const g = new T.BufferGeometry()
    g.setAttribute('position', new T.Float32BufferAttribute(lote.pos, 3))
    g.setAttribute('normal', new T.Float32BufferAttribute(lote.nor, 3))
    g.setAttribute('color', new T.Float32BufferAttribute(lote.cor, 3))
    g.setAttribute('uv', new T.Float32BufferAttribute(lote.uv, 2))
    g.setIndex(lote.idx)
    g.computeBoundingSphere()
    return g
  }

  // ---------------- texturas pintadas ----------------
  function canvas(w, h) {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    return c
  }

  /** Atlas de penas em 4 colunas: rêmige, coberteira, penugem, mecha. Branco: a cor vem do vértice. */
  function texturaPenas() {
    const W = 128
    const H = 512
    const c = canvas(W * 4, H)
    const g = c.getContext('2d')
    const r = aleatorio(11)
    desenharPena(g, 0, W, H, r, { larg: 0.88, base: 0.07, ponta: 5, assim: 0.32, cortes: 5 })
    desenharPena(g, W, W, H, r, { larg: 0.94, base: 0.05, ponta: 2.4, assim: 0.08, cortes: 2 })
    desenharTufo(g, 2 * W, W, H, r)
    desenharMecha(g, 3 * W, W, H, r)
    const t = new T.CanvasTexture(c)
    t.colorSpace = T.SRGBColorSpace
    t.anisotropy = 4
    return t
  }

  function desenharPena(g, x0, W, H, r, o) {
    g.save()
    g.translate(x0, 0)
    g.beginPath()
    g.rect(2, 0, W - 4, H)
    g.clip()
    const cx = W / 2
    const meia = (W / 2 - 6) * o.larg
    // contorno: a base é embaixo (v = 0), a ponta em cima
    const larg = (s, lado) => {
      if (s < o.base) return 0
      const sobe = smoothstep(o.base, o.base + 0.16, s)
      const fecha = Math.pow(Math.max(0, 1 - Math.pow(s, o.ponta)), 0.55)
      return meia * sobe * fecha * (lado < 0 ? 1 - o.assim : 1)
    }
    const passos = 64
    g.beginPath()
    for (let i = 0; i <= passos; i++) {
      const s = i / passos
      const y = H - s * H
      g.lineTo(cx - larg(s, -1), y)
    }
    for (let i = passos; i >= 0; i--) {
      const s = i / passos
      g.lineTo(cx + larg(s, 1), H - s * H)
    }
    g.closePath()
    const grad = g.createLinearGradient(0, H, 0, 0)
    grad.addColorStop(0, 'rgb(170,170,170)')
    grad.addColorStop(0.45, 'rgb(225,225,225)')
    grad.addColorStop(1, 'rgb(255,255,255)')
    g.fillStyle = grad
    g.fill()
    // barbas: riscos finos saindo da raque para cima
    g.save()
    g.clip()
    for (let y = H; y > 0; y -= 3) {
      const s = 1 - y / H
      const lum = 150 + Math.round(r() * 60)
      g.strokeStyle = `rgba(${lum},${lum},${lum},0.35)`
      g.lineWidth = 1.2
      g.beginPath()
      g.moveTo(cx, y)
      g.lineTo(cx - meia * 1.1, y - 26 - s * 10)
      g.moveTo(cx, y)
      g.lineTo(cx + meia * 1.1, y - 22 - s * 10)
      g.stroke()
    }
    // borda clara da pena (o friso de luz que a pintura tem)
    g.restore()
    g.strokeStyle = 'rgba(255,255,255,0.75)'
    g.lineWidth = 4
    g.stroke()
    // raque
    g.strokeStyle = 'rgba(250,246,238,0.9)'
    g.lineWidth = 3
    g.beginPath()
    g.moveTo(cx, H)
    g.lineTo(cx + 1, H * 0.06)
    g.stroke()
    // cortes no vane (a pena gasta, não de plástico)
    g.globalCompositeOperation = 'destination-out'
    for (let i = 0; i < o.cortes; i++) {
      const s = 0.3 + r() * 0.6
      const lado = r() < 0.5 ? -1 : 1
      const y = H - s * H
      const x = cx + lado * larg(s, lado)
      g.beginPath()
      g.moveTo(x + lado * 4, y - 3)
      g.lineTo(x - lado * (8 + r() * 12), y - 10 - r() * 8)
      g.lineTo(x + lado * 4, y - 16)
      g.fill()
    }
    g.restore()
  }

  function desenharTufo(g, x0, W, H, r) {
    g.save()
    g.translate(x0, 0)
    g.beginPath()
    g.rect(2, 0, W - 4, H)
    g.clip()
    g.lineCap = 'round'
    // miolo macio
    const miolo = g.createRadialGradient(W / 2, H * 0.62, 4, W / 2, H * 0.62, W * 0.5)
    miolo.addColorStop(0, 'rgba(240,240,240,1)')
    miolo.addColorStop(1, 'rgba(240,240,240,0)')
    g.fillStyle = miolo
    g.beginPath()
    g.ellipse(W / 2, H * 0.6, W * 0.36, H * 0.36, 0, 0, Math.PI * 2)
    g.fill()
    // fios abrindo do pé para a ponta
    for (let i = 0; i < 120; i++) {
      const a = (r() - 0.5) * 1.1
      const comp = H * (0.45 + r() * 0.5)
      const bx = W / 2 + (r() - 0.5) * W * 0.25
      const by = H - 4
      const ex = clamp(bx + Math.sin(a) * W * 0.62, 6, W - 6)
      const ey = by - comp
      const lum = 200 + Math.round(r() * 55)
      g.strokeStyle = `rgba(${lum},${lum},${lum},${0.55 + r() * 0.45})`
      g.lineWidth = 2 + r() * 4
      g.beginPath()
      g.moveTo(bx, by)
      g.quadraticCurveTo(bx + Math.sin(a) * W * 0.2 + (r() - 0.5) * 18, by - comp * 0.55, ex, ey)
      g.stroke()
    }
    g.restore()
  }

  function desenharMecha(g, x0, W, H, r) {
    g.save()
    g.translate(x0, 0)
    g.beginPath()
    g.rect(2, 0, W - 4, H)
    g.clip()
    g.lineCap = 'round'
    for (let i = 0; i < 70; i++) {
      const bx = W / 2 + (r() - 0.5) * W * 0.7
      const fase = r() * Math.PI * 2
      const amp = 4 + r() * 8
      const fim = H * (0.08 + r() * 0.25)
      const lum = 190 + Math.round(r() * 65)
      g.strokeStyle = `rgba(${lum},${lum},${lum},${0.6 + r() * 0.4})`
      g.lineWidth = 2.5 + r() * 4
      g.beginPath()
      g.moveTo(bx, H - 2)
      for (let s = 0; s <= 1.0001; s += 0.1) {
        const y = H - 2 - s * (H - 2 - fim)
        const junta = 1 - s * 0.85
        const x = W / 2 + (bx - W / 2) * junta + Math.sin(fase + s * 5) * amp * junta
        g.lineTo(x, y)
      }
      g.stroke()
    }
    g.restore()
  }

  /** Pinceladas cinzas que repetem sem emenda: modulam a cor e a aspereza no shader. */
  function texturaPincel() {
    const N = 256
    const c = canvas(N, N)
    const g = c.getContext('2d')
    g.fillStyle = 'rgb(128,128,128)'
    g.fillRect(0, 0, N, N)
    const r = aleatorio(23)
    g.lineCap = 'round'
    for (let i = 0; i < 1100; i++) {
      const x = r() * N
      const y = r() * N
      const ang = (r() - 0.5) * 1.2 + (i % 2 ? 0.5 : -0.4)
      const comp = 6 + r() * 26
      const lum = Math.round(128 + (r() - 0.5) * 120)
      g.strokeStyle = `rgba(${lum},${lum},${lum},${0.25 + r() * 0.4})`
      g.lineWidth = 2 + r() * 6
      const dx = Math.cos(ang) * comp * 0.5
      const dy = Math.sin(ang) * comp * 0.5
      for (let ox = -N; ox <= N; ox += N) {
        for (let oy = -N; oy <= N; oy += N) {
          g.beginPath()
          g.moveTo(x - dx + ox, y - dy + oy)
          g.lineTo(x + dx + ox, y + dy + oy)
          g.stroke()
        }
      }
    }
    const t = new T.CanvasTexture(c)
    t.wrapS = t.wrapT = T.RepeatWrapping
    t.colorSpace = T.NoColorSpace
    return t
  }

  /**
   * Céu para o metal refletir (equirretangular): claro em cima, chumbo embaixo, e o
   * clarão frio atrás e à esquerda, como o céu da pintura.
   */
  function texturaCeu() {
    const W = 512
    const H = 256
    const c = canvas(W, H)
    const g = c.getContext('2d')
    const grad = g.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, '#f2f5ff')
    grad.addColorStop(0.3, '#c3d0ec')
    grad.addColorStop(0.47, '#93a3c2')
    grad.addColorStop(0.53, '#6a7590')
    grad.addColorStop(0.75, '#4a5266')
    grad.addColorStop(1, '#2c303a')
    g.fillStyle = grad
    g.fillRect(0, 0, W, H)
    const r = aleatorio(5)
    // nuvens escuras soltas no meio do céu
    for (let i = 0; i < 14; i++) {
      const x = r() * W
      const y = H * (0.12 + r() * 0.3)
      const rr = 30 + r() * 60
      const n = g.createRadialGradient(x, y, 2, x, y, rr)
      n.addColorStop(0, 'rgba(70,86,120,0.5)')
      n.addColorStop(1, 'rgba(70,86,120,0)')
      g.fillStyle = n
      g.fillRect(x - rr, y - rr, rr * 2, rr * 2)
    }
    // clarão atrás-esquerda (contraluz) e o sol da frente-esquerda (luz principal)
    const claro = (x, y, rr, cor) => {
      const n = g.createRadialGradient(x, y, 1, x, y, rr)
      n.addColorStop(0, cor)
      n.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = n
      g.fillRect(x - rr, y - rr, rr * 2, rr * 2)
    }
    claro(W * 0.13, H * 0.3, 95, 'rgba(255,255,255,1)')
    claro(W * 0.84, H * 0.24, 70, 'rgba(255,246,232,0.85)')
    const t = new T.CanvasTexture(c)
    t.mapping = T.EquirectangularReflectionMapping
    t.colorSpace = T.SRGBColorSpace
    return t
  }

  /** Fundo da vista grande: céu de tempestade pintado, claro no alto à esquerda. */
  function texturaFundo() {
    const W = 1024
    const H = 1200
    const c = canvas(W, H)
    const g = c.getContext('2d')
    const grad = g.createLinearGradient(0, 0, W * 0.55, H)
    grad.addColorStop(0, '#dfe6f4')
    grad.addColorStop(0.35, '#9fb0d0')
    grad.addColorStop(0.7, '#56668a')
    grad.addColorStop(1, '#2a3350')
    g.fillStyle = grad
    g.fillRect(0, 0, W, H)
    const r = aleatorio(31)
    const mancha = (x, y, rx, ry, cor) => {
      g.save()
      g.translate(x, y)
      g.scale(1, ry / rx)
      const n = g.createRadialGradient(0, 0, 1, 0, 0, rx)
      n.addColorStop(0, cor)
      n.addColorStop(1, cor.replace(/[\d.]+\)$/, '0)'))
      g.fillStyle = n
      g.fillRect(-rx, -rx, rx * 2, rx * 2)
      g.restore()
    }
    // nuvens escuras pesadas nas bordas, clarão no meio-alto
    for (let i = 0; i < 26; i++) {
      const lado = r() < 0.5
      mancha(lado ? r() * W * 0.3 : W * (0.65 + r() * 0.35), H * (0.1 + r() * 0.8), 120 + r() * 220, 70 + r() * 120, 'rgba(48,60,92,0.45)')
    }
    mancha(W * 0.42, H * 0.22, 380, 260, 'rgba(250,252,255,0.85)')
    mancha(W * 0.3, H * 0.4, 260, 200, 'rgba(225,233,250,0.5)')
    // pinceladas largas por cima, para o fundo não ficar gradiente de app
    g.lineCap = 'round'
    for (let i = 0; i < 260; i++) {
      const x = r() * W
      const y = r() * H
      const ang = -0.5 + (r() - 0.5) * 0.7
      const comp = 40 + r() * 140
      const claro = r() < 0.45
      g.strokeStyle = claro ? `rgba(235,240,252,${0.05 + r() * 0.08})` : `rgba(30,40,70,${0.05 + r() * 0.08})`
      g.lineWidth = 10 + r() * 30
      g.beginPath()
      g.moveTo(x - Math.cos(ang) * comp, y - Math.sin(ang) * comp)
      g.lineTo(x + Math.cos(ang) * comp, y + Math.sin(ang) * comp)
      g.stroke()
    }
    const t = new T.CanvasTexture(c)
    t.colorSpace = T.SRGBColorSpace
    return t
  }

  /** Brilho vermelho do cartão (soma de luz, sem borda). */
  function texturaBrilho() {
    const N = 128
    const c = canvas(N, N)
    const g = c.getContext('2d')
    const n = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2)
    n.addColorStop(0, 'rgba(255,96,72,0.9)')
    n.addColorStop(0.2, 'rgba(255,58,40,0.6)')
    n.addColorStop(0.5, 'rgba(230,30,24,0.2)')
    n.addColorStop(1, 'rgba(220,20,16,0)')
    g.fillStyle = n
    g.fillRect(0, 0, N, N)
    const t = new T.CanvasTexture(c)
    t.colorSpace = T.SRGBColorSpace
    return t
  }

  /** Chão da vista grande: lajes do Meio-Termo que somem nas bordas. */
  function texturaChao() {
    const N = 512
    const c = canvas(N, N)
    const g = c.getContext('2d')
    g.fillStyle = '#6d6a66'
    g.fillRect(0, 0, N, N)
    const r = aleatorio(41)
    const casa = N / 4
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const l = Math.round(150 + r() * 40)
        g.fillStyle = `rgb(${l},${l - 8},${l - 22})`
        g.beginPath()
        g.roundRect(x * casa + 3, y * casa + 3, casa - 6, casa - 6, 10)
        g.fill()
        for (let i = 0; i < 40; i++) {
          const v = r() < 0.5 ? 'rgba(255,250,240,0.12)' : 'rgba(60,50,40,0.12)'
          g.fillStyle = v
          g.fillRect(x * casa + r() * casa, y * casa + r() * casa, 3 + r() * 6, 2 + r() * 4)
        }
      }
    }
    const t = new T.CanvasTexture(c)
    t.colorSpace = T.SRGBColorSpace
    return t
  }

  function texturaSumir() {
    const N = 256
    const c = canvas(N, N)
    const g = c.getContext('2d')
    const n = g.createRadialGradient(N / 2, N / 2, N * 0.18, N / 2, N / 2, N / 2)
    n.addColorStop(0, '#ffffff')
    n.addColorStop(1, '#000000')
    g.fillStyle = n
    g.fillRect(0, 0, N, N)
    const t = new T.CanvasTexture(c)
    t.colorSpace = T.NoColorSpace
    return t
  }

  window.Escultura = {
    clamp,
    mix,
    smoothstep,
    smin,
    smax,
    aleatorio,
    ruido,
    fbm,
    esfera,
    elipsoide,
    coneRedondo,
    coneCortado,
    caixa,
    toro,
    cadeia,
    plano,
    malhaDoCampo,
    criarOclusao,
    tubo,
    novoLote,
    pena,
    geometriaDoLote,
    texturaPenas,
    texturaPincel,
    texturaCeu,
    texturaFundo,
    texturaBrilho,
    texturaChao,
    texturaSumir,
  }
})()
