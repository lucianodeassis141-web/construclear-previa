/* A obra em 3D: a casa se monta conforme a rolagem (planta, fundação, estrutura, painéis, vidros, paisagismo, entrega).
   Tudo em código, sem vídeo nem modelo externo. Arrastar para o lado gira a casa. */
import * as THREE from './three.module.min.js';

const secao = document.getElementById('obra3d');
const palco = secao.querySelector('.palco');
const canvas = secao.querySelector('canvas');
const etapas = [...secao.querySelectorAll('.etapa')];
const marcas = [...secao.querySelectorAll('.trilho li')];
const calmo = matchMedia('(prefers-reduced-motion: reduce)').matches;
const celular = matchMedia('(max-width: 760px)').matches;

const COR = { marinho: 0x123054, noite: 0x0B1F3A, turquesa: 0x3CA8BA, branco: 0xF3F2EF, areia: 0xD9D2C6, terra: 0xB49A78,
  grama: 0x7FA35C, madeira: 0xA8754B, vidro: 0x9CC4D3, ceu: 0xE7EDF1 };

// ---------- renderizador e cena ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, celular ? 1.5 : 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = !celular;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const cena = new THREE.Scene();
const fundoA = new THREE.Color(COR.noite), fundoB = new THREE.Color(COR.ceu);
cena.background = fundoA.clone();
cena.fog = new THREE.Fog(COR.noite, 45, 95);

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);

const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8576, 0.55);
cena.add(hemi);
const sol = new THREE.DirectionalLight(0xfff3e2, 2.1);
sol.position.set(18, 26, 14);
sol.castShadow = true;
sol.shadow.mapSize.set(2048, 2048);
Object.assign(sol.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 80 });
sol.shadow.bias = -0.0004;
cena.add(sol);

// ---------- utilidades ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const faixa = (p, a, b) => clamp((p - a) / (b - a));
const suave = t => t * t * (3 - 2 * t);
const saida = t => 1 - Math.pow(1 - t, 3);
const voltinha = t => { const c = 1.4; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

const pecas = []; // { obj, tipo, de, ate, base }
function peca(obj, tipo, de, ate) {
  obj.castShadow = obj.receiveShadow = true;
  obj.userData.base = { pos: obj.position.clone(), rot: obj.rotation.clone(), esc: obj.scale.clone() };
  pecas.push({ obj, tipo, de, ate });
  cena.add(obj);
  return obj;
}
function caixa(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

// ---------- materiais ----------
const matConcreto = new THREE.MeshStandardMaterial({ color: 0xCFCAC2, roughness: 0.9 });
const matLaje = new THREE.MeshStandardMaterial({ color: COR.branco, roughness: 0.75 });
const matMadeira = new THREE.MeshStandardMaterial({ color: COR.madeira, roughness: 0.7 });
const matVidro = new THREE.MeshPhysicalMaterial({ color: COR.vidro, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0, depthWrite: false });
const matAgua = new THREE.MeshStandardMaterial({ color: COR.turquesa, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.92 });
const matTronco = new THREE.MeshStandardMaterial({ color: 0x6E5640, roughness: 1 });
const matCopa = new THREE.MeshStandardMaterial({ color: 0x5E8C4A, roughness: 0.95, flatShading: true });
const matPiso = new THREE.MeshStandardMaterial({ color: 0xE6E1D8, roughness: 0.8 });

// painel: tela de aço sobre o núcleo, que vira parede branca no acabamento
const telaCv = document.createElement('canvas'); telaCv.width = telaCv.height = 256;
const telaCtx = telaCv.getContext('2d');
const telaTex = new THREE.CanvasTexture(telaCv);
telaTex.wrapS = telaTex.wrapT = THREE.RepeatWrapping;
telaTex.colorSpace = THREE.SRGBColorSpace;
let telaUltima = -1;
function desenhaTela(acab) {
  const a = Math.round(acab * 40) / 40;
  if (a === telaUltima) return; telaUltima = a;
  const g = telaCtx;
  g.fillStyle = '#F3F2EF'; g.fillRect(0, 0, 256, 256);
  g.globalAlpha = 1 - a;
  g.fillStyle = '#E4E6E8'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#9AA3AB'; g.lineWidth = 3;
  for (let i = 0; i <= 256; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); }
  g.globalAlpha = 1;
  telaTex.needsUpdate = true;
}
desenhaTela(0);
const matPainel = new THREE.MeshStandardMaterial({ map: telaTex, roughness: 0.85 });

// ---------- chão e planta ----------
const chaoMat = new THREE.MeshStandardMaterial({ color: COR.marinho, roughness: 1 });
const chao = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), chaoMat);
chao.rotation.x = -Math.PI / 2; chao.receiveShadow = true;
cena.add(chao);

const grade = new THREE.GridHelper(60, 60, COR.turquesa, 0x2A4E78);
grade.material.transparent = true; grade.position.y = 0.01;
cena.add(grade);

// linhas da planta, desenhadas aos poucos
const pts = [];
function ret(x1, z1, x2, z2) { pts.push(x1, 0.03, z1, x2, 0.03, z1, x2, 0.03, z1, x2, 0.03, z2, x2, 0.03, z2, x1, 0.03, z2, x1, 0.03, z2, x1, 0.03, z1); }
function lin(x1, z1, x2, z2) { pts.push(x1, 0.03, z1, x2, 0.03, z2); }
ret(-6, -4, 6, 4);            // térreo
lin(-1.5, -4, -1.5, 1.2); lin(2.5, -4, 2.5, -0.5); lin(-6, -0.6, -1.5, -0.6); // paredes internas
ret(-5, -4.2, 8, 4.2);        // pavimento de cima (balanço)
ret(1, 6, 9, 9.5);            // piscina
ret(0, 5, 10, 10.5);          // deck
const planta = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)),
  new THREE.LineBasicMaterial({ color: 0x9FE3EC, transparent: true }));
const totalPontos = pts.length / 3;
cena.add(planta);

// ---------- a casa ----------
// fundação
peca(caixa(13, 0.4, 9, matConcreto, 0, 0.2, 0), 'sobe', 0.14, 0.20);
// pilares do térreo e de cima
const pilares = [[-6, -4], [-2, -4], [2, -4], [6, -4], [-6, 4], [-2, 4], [2, 4], [6, 4]];
pilares.forEach(([x, z], i) => peca(caixa(0.32, 3, 0.32, matConcreto, x, 1.9, z), 'sobe', 0.19 + i * 0.006, 0.24 + i * 0.006));
// paredes em painéis
function parede(x1, z1, x2, z2, y0, h, de, ate, lista) {
  const dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz), n = Math.max(1, Math.ceil(L / 1.25));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, w = L / n - 0.04;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.22), matPainel);
    m.position.set(x1 + dx * t, y0 + h / 2, z1 + dz * t);
    m.rotation.y = -Math.atan2(dz, dx);
    lista.push(m);
  }
}
const painelT = [], painelS = [];
parede(-6, -4, 6, -4, 0.4, 3, 0, 0, painelT);      // fundo
parede(-6, -4, -6, 4, 0.4, 3, 0, 0, painelT);      // lado esquerdo
parede(6, -4, 6, 4, 0.4, 3, 0, 0, painelT);        // lado direito
parede(-6, 4, -4, 4, 0.4, 3, 0, 0, painelT);       // frente, cantos
parede(4, 4, 6, 4, 0.4, 3, 0, 0, painelT);
painelT.forEach((m, i) => peca(m, 'encaixa', 0.27 + i * (0.10 / painelT.length), 0.31 + i * (0.10 / painelT.length)));
// laje do pavimento de cima (em balanço para a direita)
peca(caixa(13.6, 0.36, 8.8, matLaje, 1.5, 3.58, 0), 'desce', 0.39, 0.44);
parede(-5, -4.2, 8, -4.2, 3.76, 2.9, 0, 0, painelS);
parede(-5, -4.2, -5, 4.2, 3.76, 2.9, 0, 0, painelS);
parede(8, -4.2, 8, 4.2, 3.76, 2.9, 0, 0, painelS);
parede(-5, 4.2, -3, 4.2, 3.76, 2.9, 0, 0, painelS);
parede(6.5, 4.2, 8, 4.2, 3.76, 2.9, 0, 0, painelS);
painelS.forEach((m, i) => peca(m, 'encaixa', 0.42 + i * (0.08 / painelS.length), 0.46 + i * (0.08 / painelS.length)));
// cobertura
peca(caixa(14.6, 0.32, 9.6, matLaje, 1.5, 6.82, 0), 'desce', 0.50, 0.55);
// vidros
const vidros = [caixa(7.9, 2.9, 0.06, matVidro, 0, 1.9, 4), caixa(9.4, 2.8, 0.06, matVidro, 1.75, 5.18, 4.2),
  caixa(0.06, 2.4, 3.2, matVidro, -6.02, 1.9, 0.6)];
vidros.forEach(v => { v.renderOrder = 2; cena.add(v); v.castShadow = false; });
const caixilhos = [];
[[-4, 1.9, 4], [0, 1.9, 4], [4, 1.9, 4], [-3, 5.18, 4.2], [1.75, 5.18, 4.2], [6.5, 5.18, 4.2]].forEach(([x, y, z], i) => {
  const c = caixa(0.08, y > 4 ? 2.8 : 2.9, 0.1, new THREE.MeshStandardMaterial({ color: 0x1D2733, roughness: 0.5 }), x, y, z);
  caixilhos.push(peca(c, 'sobe', 0.55 + i * 0.006, 0.58 + i * 0.006));
});
// piso interno e deck
peca(caixa(11.8, 0.05, 7.8, matPiso, 0, 0.43, 0), 'aparece', 0.60, 0.66);
const deck = [caixa(10, 0.12, 1, matMadeira, 5, 0.06, 5.5), caixa(10, 0.12, 1, matMadeira, 5, 0.06, 10),
  caixa(1, 0.12, 3.5, matMadeira, 0.5, 0.06, 7.75), caixa(1, 0.12, 3.5, matMadeira, 9.5, 0.06, 7.75)];
deck.forEach((d, i) => peca(d, 'cresce', 0.72 + i * 0.01, 0.76 + i * 0.01));
const fundoPiscina = peca(caixa(8, 0.05, 3.5, new THREE.MeshStandardMaterial({ color: 0x2C7F8E, roughness: 0.6 }), 5, 0.02, 7.75), 'aparece', 0.72, 0.75);
const agua = new THREE.Mesh(new THREE.BoxGeometry(8, 0.1, 3.5), matAgua);
agua.position.set(5, 0.05, 7.75); agua.receiveShadow = true; agua.scale.y = 0.001; agua.visible = false; cena.add(agua);
// árvores
const arvores = [[-9, -7, 1.2], [-10, 3, 1], [11, -6, 1.3], [-8, 8, 0.9], [13, 4, 1.1], [-3, -9, 1], [8, -9, 0.85], [-12, -2, 0.8]];
arvores.forEach(([x, z, s], i) => {
  const g = new THREE.Group();
  const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 2.2, 6), matTronco); tr.position.y = 1.1;
  const co = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 0), matCopa); co.position.y = 3; co.scale.y = 1.2;
  tr.castShadow = co.castShadow = true; g.add(tr, co); g.position.set(x, 0, z); g.scale.setScalar(s);
  peca(g, 'cresce', 0.74 + i * 0.012, 0.80 + i * 0.012);
});
// brilhos da entrega (a estrela da logo)
const estrelaCv = document.createElement('canvas'); estrelaCv.width = estrelaCv.height = 64;
{ const g = estrelaCv.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(180,240,248,.9)'); gr.addColorStop(1, 'rgba(60,168,186,0)');
  g.fillStyle = gr; g.beginPath(); g.moveTo(32, 0); g.quadraticCurveTo(36, 28, 64, 32); g.quadraticCurveTo(36, 36, 32, 64);
  g.quadraticCurveTo(28, 36, 0, 32); g.quadraticCurveTo(28, 28, 32, 0); g.fill(); }
const brilhoGeo = new THREE.BufferGeometry();
const bp = []; for (let i = 0; i < 26; i++) bp.push((Math.random() - 0.4) * 17, 0.8 + Math.random() * 7, (Math.random() - 0.35) * 12);
brilhoGeo.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3));
const brilhoMat = new THREE.PointsMaterial({ size: 0.9, map: new THREE.CanvasTexture(estrelaCv), transparent: true, depthWrite: false, opacity: 0, blending: THREE.AdditiveBlending });
const brilhos = new THREE.Points(brilhoGeo, brilhoMat); cena.add(brilhos);

// ---------- câmera: pontos do passeio ----------
const voo = [ // progresso, posição, alvo
  [0.00, [0, 30, 14], [0, 0, 1.5]],
  [0.13, [2, 24, 18], [0.5, 0, 1.5]],
  [0.26, [20, 12, 20], [0, 1.5, 0]],
  [0.40, [-18, 9, 17], [0.5, 2.5, 0]],
  [0.55, [-12, 7, 22], [1, 3.2, 1]],
  [0.70, [17, 6, 21], [2, 2.6, 3]],
  [0.86, [8, 3.2, 22], [3, 3, 2]],
  [1.00, [24, 13, 27], [2, 2.5, 1]],
];
const vA = new THREE.Vector3(), vB = new THREE.Vector3(), alvo = new THREE.Vector3();
function posCamera(p, giro) {
  let i = 0; while (i < voo.length - 2 && p > voo[i + 1][0]) i++;
  const [p0, a0, t0] = voo[i], [p1, a1, t1] = voo[i + 1];
  const t = suave(clamp((p - p0) / (p1 - p0)));
  vA.fromArray(a0).lerp(vB.fromArray(a1), t);
  alvo.fromArray(t0).lerp(vB.fromArray(t1), t);
  // giro do usuário em volta do alvo
  // tela em pé: afasta a câmera para a casa caber na largura
  const k = camera.aspect < 0.8 ? 1.75 : camera.aspect < 1.25 ? 1.3 : 1;
  const dx = (vA.x - alvo.x) * k, dz = (vA.z - alvo.z) * k, c = Math.cos(giro), s = Math.sin(giro);
  camera.position.set(alvo.x + dx * c - dz * s, alvo.y + (vA.y - alvo.y) * k, alvo.z + dx * s + dz * c);
  camera.lookAt(alvo);
}

// ---------- aplicar o progresso ----------
const tmpCor = new THREE.Color();
function aplicar(p, tempo) {
  // planta: desenha, depois some
  const desenho = faixa(p, 0.01, 0.12);
  planta.geometry.setDrawRange(0, Math.floor(totalPontos * desenho / 2) * 2);
  planta.material.opacity = 1 - faixa(p, 0.30, 0.42);
  grade.material.opacity = 0.55 * (1 - faixa(p, 0.20, 0.36));
  // céu e chão: da prancheta ao terreno e ao jardim
  const dia = suave(faixa(p, 0.13, 0.30));
  cena.background.copy(fundoA).lerp(fundoB, dia);
  cena.fog.color.copy(cena.background);
  tmpCor.set(COR.marinho).lerp(new THREE.Color(COR.terra), dia).lerp(new THREE.Color(COR.grama), suave(faixa(p, 0.70, 0.80)));
  chaoMat.color.copy(tmpCor);
  const acab = faixa(p, 0.60, 0.72);
  hemi.intensity = 0.25 + 0.45 * dia + 0.35 * acab; sol.intensity = 0.6 + 1.6 * dia + 0.4 * acab;
  renderer.toneMappingExposure = 1.0 + 0.15 * acab;
  // peças
  for (const { obj, tipo, de, ate } of pecas) {
    const t = faixa(p, de, ate), b = obj.userData.base;
    obj.visible = t > 0;
    if (!obj.visible) continue;
    if (tipo === 'sobe') {
      const h = (obj.geometry && obj.geometry.parameters.height) || 1, s = Math.max(0.001, saida(t)), pe = b.pos.y - h / 2;
      obj.scale.set(b.esc.x, b.esc.y * s, b.esc.z); obj.position.y = pe + h * s / 2;
    }
    else if (tipo === 'encaixa') { const e = voltinha(t); obj.position.set(b.pos.x, b.pos.y + (1 - e) * 7, b.pos.z); obj.rotation.set(b.rot.x + (1 - t) * 0.5, b.rot.y, b.rot.z + (1 - t) * 0.3); }
    else if (tipo === 'desce') { obj.position.set(b.pos.x, b.pos.y + (1 - saida(t)) * 9, b.pos.z); }
    else if (tipo === 'cresce') { obj.scale.copy(b.esc).multiplyScalar(Math.max(0.001, voltinha(t))); }
    else if (tipo === 'aparece') { obj.scale.copy(b.esc); }
  }
  // vidro, acabamento, água, brilho
  matVidro.opacity = 0.42 * faixa(p, 0.55, 0.62);
  desenhaTela(suave(faixa(p, 0.60, 0.70)));
  agua.scale.y = Math.max(0.001, saida(faixa(p, 0.75, 0.82)));
  agua.position.y = 0.05 * agua.scale.y;
  agua.visible = agua.scale.y > 0.01;
  const b = faixa(p, 0.88, 0.95) * (1 - faixa(p, 0.985, 1.0) * 0.5);
  brilhoMat.opacity = b * (0.75 + 0.25 * Math.sin(tempo * 3));
  brilhoMat.size = 0.6 + 0.5 * b + 0.15 * Math.sin(tempo * 2.2);
}

// ---------- rolagem, giro e laço ----------
const teste = new URLSearchParams(location.search).get('p3d'); // só para conferir uma etapa: ?p3d=0.5
let alvoP = teste ? +teste : (calmo ? 1 : 0), p = alvoP, giro = 0, giroAlvo = 0, rodando = false, ultimaEtapa = -1;
function lerRolagem() {
  if (calmo || teste) return;
  const r = secao.getBoundingClientRect();
  alvoP = clamp(-r.top / (r.height - innerHeight));
}
function etapaAtual(x) {
  let k = 0; etapas.forEach((e, i) => { if (x >= +e.dataset.de - 0.001) k = i; }); return k;
}
function quadro(ms) {
  const tempo = ms / 1000;
  p += (alvoP - p) * (calmo ? 1 : 0.09);
  giro += (giroAlvo - giro) * 0.12;
  if (!arrastando && Math.abs(giroAlvo) > 0.0001 && p < 0.97) giroAlvo *= 0.985; // volta devagar ao passeio
  aplicar(p, tempo);
  posCamera(p, giro);
  renderer.render(cena, camera);
  const k = etapaAtual(p);
  if (k !== ultimaEtapa) {
    etapas.forEach((e, i) => e.classList.toggle('ativa', i === k));
    marcas.forEach((m, i) => m.classList.toggle('feita', i <= k));
    ultimaEtapa = k;
  }
  secao.classList.toggle('claro', p > 0.22);
  if (rodando) requestAnimationFrame(quadro);
}
function medir() {
  const w = palco.clientWidth, h = palco.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < h ? 42 : 38;
  camera.updateProjectionMatrix();
}
addEventListener('resize', medir); medir();
addEventListener('scroll', lerRolagem, { passive: true }); lerRolagem();

// arrastar para o lado gira a casa (rolagem vertical continua normal no celular)
let arrastando = false, x0 = 0, g0 = 0;
canvas.addEventListener('pointerdown', e => { arrastando = true; x0 = e.clientX; g0 = giroAlvo; canvas.setPointerCapture(e.pointerId); secao.classList.add('girou'); });
canvas.addEventListener('pointermove', e => { if (arrastando) giroAlvo = g0 - (e.clientX - x0) * 0.008; });
['pointerup', 'pointercancel'].forEach(t => canvas.addEventListener(t, () => { arrastando = false; }));

new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting && !rodando) { rodando = true; requestAnimationFrame(quadro); }
  else if (!e.isIntersecting) rodando = false;
}), { rootMargin: '200px 0px' }).observe(secao);
secao.classList.add('pronto');
