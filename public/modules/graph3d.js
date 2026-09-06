// 3D execution plane — a deliberately curated view, not "everything at once".
// Floor = X: cost of inaction, Z: importance. Only tasks the user has
// explicitly starred as a focus mission (task.is_focus) get a floor
// position; everything else (including their own non-focus subtasks) stays
// out of the chart entirely — this is the "few things worth coming back to"
// view, not a dump of the whole task list. Node size = importance x cost of
// inaction. Each action is tinted by the outcome it leads to (follow enable
// edges downstream to the nearest outcome); actions that reach no outcome
// stay grey. Outcome/identity tasks aren't scored actions, so they get no
// floor position either — they stay visible in Active Tasks and the node
// card instead.
// Rendered with Three.js (loaded via importmap: "three" + "three/addons/").

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { lucideSvg } from './lucideIcon.js';

const INK = '#111111';
const BOX = 10; // world box is BOX x BOX x BOX
// orbit centre: nudged up and toward the viewer so the floor plus the horizon
// bands behind it frame roughly centred instead of hugging the left.
// Backed off from an earlier, tighter framing that could clip the
// high-importance / high-cost-of-inaction far corner against the panel's
// top edge on shorter (mobile) viewports.
const TARGET = new THREE.Vector3(BOX / 2, 1.5, BOX / 2 + 1);
// Camera sits directly on the +Z side of TARGET (no X offset) so the two
// floor axes land on cardinal screen directions: cost of inaction (+X)
// reads left-to-right (east), importance (+Z) recedes away from the
// viewer toward the top of the panel (its near/high end reads south).
const HOME_CAM = new THREE.Vector3(BOX / 2, 16.6, BOX / 2 + 20.7);
// Radius of a sphere around TARGET that comfortably covers the floor's
// corners (± icon size). Used to re-derive camera distance from the
// viewport's actual aspect ratio — a portrait phone panel has a much
// narrower horizontal FOV than a wide desktop one at the same vertical
// FOV, so a fixed camera position clips the grid's left/right edges on
// narrow screens even though it fits fine on wide ones.
const CONTENT_RADIUS = 10;
// English axis captions keep the editorial serif; task-name labels (often Hangul) use Pretendard
const DISPLAY = 'Georgia,"Times New Roman",Times,serif';
const BODY = '"Pretendard Variable",Pretendard,-apple-system,"Apple SD Gothic Neo","Noto Sans KR",sans-serif';

// orientation-independent invisible hit target (icons themselves are CSS2D)
const PICK_GEO = new THREE.SphereGeometry(0.5, 10, 8);

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
// cost of inaction: what gets worse if this is deferred. Unset -> neutral 5.
function coiOf(t) { return t.cost_of_inaction == null ? 5 : num(t.cost_of_inaction); }
// cost of inaction is the spine; importance modulates it ~+/-50%. Range ~5..100.
function priority(t) { return coiOf(t) * (5 + num(t.importance) / 2); }
function clamp10(v) { return Math.max(0, Math.min(BOX, v)); }
function kindOf(t) { return t.kind || 'action'; }

// distinct tint per outcome, so actions can be colour-grouped by the goal they serve
const OUTCOME_PALETTE = ['#c9a227', '#b5651d', '#5f7d5f', '#4f6d7a', '#a15c5c', '#6b5b95', '#8a7d3f', '#7a5c8a'];
const UNROUTED = '#9aa0a0';

// goals ("outcome") and vision ("identity") are never placed on the floor
// or drawn as their own nodes — see the render() comment where their
// position assignment used to be for why.

// deterministic per-task offset so tasks sharing the same (cost of inaction,
// importance) don't stack into one unclickable blob
function jitter(id) {
  const h = (Number(id) * 2654435761) >>> 0;
  return { x: ((h & 255) / 255 - 0.5) * 1.6, z: (((h >> 8) & 255) / 255 - 0.5) * 1.6 };
}


// topic -> glyph, matched against the task's category string (ko/en substrings)
const TOPIC_ICONS = [
  [['농사', '농지', '작물', '종자', '텃밭', 'farm', 'garden', 'plant'], 'sprout'],
  [['iot', '센서', '펌웨어', '하드웨어', '임베디드', 'esp32', 'stm32', 'raspberry', 'device'], 'cpu'],
  [['브랜딩', '마케팅', '콘텐츠', '유튜브', '인스타', 'brand', 'content', 'market', 'sns'], 'megaphone'],
  [['교육', '학습', '강의', '수료', 'course', 'study', 'school', 'learn'], 'graduation-cap'],
  [['소득', '수입', '경제', '판매', '직거래', 'income', 'revenue', 'sales', 'cash'], 'banknote'],
  [['건강', '운동', '헬스', '루틴', 'health', 'fitness', 'workout'], 'activity'],
  [['리서치', '조사', '분석', 'research', 'survey', 'analysis'], 'search'],
  [['관계', '사랑', '가족', '협업', 'relationship', 'love', 'family'], 'heart'],
  [['자기계발', '독서', '스킬', 'self', 'skill', 'read'], 'book-open'],
  [['차량', '자동차', 'car', 'vehicle'], 'car'],
  [['올리브', '나무', '과수', 'olive', 'tree'], 'trees'],
  [['서류', '행정', '신청', '비자', 'admin', 'visa', 'document'], 'file-text'],
  [['영상', '편집', '촬영', 'video', 'edit', 'film'], 'film'],
];
// old MDI values (and blank) count as "not chosen" so they fall through to topic matching
function isPlaceholderIcon(v) { return !v || v.startsWith('mdi-'); }

function iconFor(t) {
  const chosen = (t.icon || '').trim();
  if (!isPlaceholderIcon(chosen)) return chosen; // user picked a Lucide name
  const hay = `${t.category || ''} ${t.name || ''}`.toLowerCase();
  for (const [keys, icon] of TOPIC_ICONS) {
    if (keys.some((k) => hay.includes(k))) return icon;
  }
  return 'circle-dot';
}

// floor placement: X = cost of inaction, Z = importance. Spread tie-heavy boards
// across the floor: map a value to its percentile rank within the current set,
// then onto 0.5..BOX-0.5. Callers pass a tiny per-id epsilon into the ranked
// value (rankKey) so that a board where every task is rated 8-10 still fans out
// into a readable line instead of piling into one corner.
function rankMapper(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  return (v) => {
    if (n <= 1) return BOX / 2;
    let below = 0, equal = 0;
    for (const s of sorted) { if (s < v) below++; else if (s === v) equal++; }
    const pct = (below + equal / 2) / n;
    return 0.5 + pct * (BOX - 1);
  };
}
// deterministic epsilon per task id, smaller than the finest metric step (0.1),
// added to a ranked value so exact ties get distinct percentile slots
function rankEps(id) {
  const h = (Number(id) * 40503) >>> 0;
  return (h % 997) / 997 * 0.05;
}

export class Graph3D {
  constructor() {
    this.el = null;
    this.scene = this.camera = this.renderer = this.labelRenderer = this.controls = null;
    this.nodeGroup = this.edgeGroup = null;
    this.nodeMeshes = [];
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.hoverId = null;
    this.focusId = null;
    this._easeTarget = null;
    this.showRelationships = true;
    this.showSubtasks = true;
    this.rankMode = true; // floor position = percentile rank, not raw 0..10
    this._active = true;
    this._raf = null;
    this._clock = new THREE.Clock();
    this._lastTasks = this._lastRels = null;
    this._onResize = () => this.resize();
    this._onPointerMove = (e) => this._pointerMove(e);
    this._onPointerLeave = () => { this.hoverId = null; this._hideAnno(); };
    // OrbitControls preventDefaults pointerdown, which eats native 'click' -> detect it ourselves
    this._downXY = null;
    this._downT = 0;
    this._onPointerDown = (e) => {
      if (e.button !== 0) return;
      this._downXY = [e.clientX, e.clientY];
      this._downT = performance.now();
    };
    this._onPointerUp = (e) => {
      if (e.button !== 0 || !this._downXY) return;
      const moved = Math.hypot(e.clientX - this._downXY[0], e.clientY - this._downXY[1]);
      const dt = performance.now() - this._downT;
      this._downXY = null;
      if (moved < 6 && dt < 500) this._click(e);
    };
  }

  init() {
    this.el = document.getElementById('taskChart');
    if (!this.el) return;
    if (this.renderer) this.dispose();

    const w = this.el.clientWidth || 800;
    const h = this.el.clientHeight || 600;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 1000);
    this.camera.position.copy(HOME_CAM);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.domElement.style.display = 'block';
    this.el.appendChild(this.renderer.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(w, h);
    Object.assign(this.labelRenderer.domElement.style, {
      position: 'absolute', top: '0', left: '0', pointerEvents: 'none', zIndex: '2',
    });
    this.el.appendChild(this.labelRenderer.domElement);

    this._buildAnnotation();

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 60;
    this.controls.minPolarAngle = 0.35;            // keep some top-down tilt
    this.controls.maxPolarAngle = Math.PI / 2 - 0.12; // never look edge-on along the ridge
    this.controls.target.copy(TARGET);
    this._fitCameraDistance();

    this._buildStage();

    this.nodeGroup = new THREE.Group();
    this.edgeGroup = new THREE.Group();
    this.scene.add(this.nodeGroup, this.edgeGroup);

    this.renderer.domElement.addEventListener('pointermove', this._onPointerMove);
    this.renderer.domElement.addEventListener('pointerleave', this._onPointerLeave);
    this.renderer.domElement.addEventListener('pointerdown', this._onPointerDown);
    this.renderer.domElement.addEventListener('pointerup', this._onPointerUp);
    window.addEventListener('resize', this._onResize);
    // also react to the container itself changing size (view toggles, layout shifts),
    // not just the window — otherwise the canvas keeps a stale size and looks off-centre
    if (typeof ResizeObserver !== 'undefined') {
      this._ro = new ResizeObserver(() => this.resize());
      this._ro.observe(this.el);
    }

    this._active = true;
    this._loop();

    if (this._lastTasks) this.render(this._lastTasks, this._lastRels);
  }

  _buildStage() {
    // fewer, softer lines: a dense 1px grid moirés badly under perspective and
    // flickers as whole rows go edge-on. Half the divisions, drawn semi-transparent
    // and without depth writes so it reads as a calm ground, not a shimmering mesh.
    const grid = new THREE.GridHelper(BOX, BOX / 2, 0xc4c4c4, 0xe0e0e0);
    grid.position.set(BOX / 2, 0, BOX / 2);
    grid.material.transparent = true;
    grid.material.opacity = 0.55;
    grid.material.depthWrite = false;
    grid.renderOrder = -1;
    this.scene.add(grid);

    const inkMat = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.9, depthWrite: false });
    const border = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0), new THREE.Vector3(BOX, 0, 0),
        new THREE.Vector3(BOX, 0, BOX), new THREE.Vector3(0, 0, BOX),
      ]),
      inkMat,
    );
    this.scene.add(border);

    const axis = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, BOX, 0)]),
      inkMat,
    );
    this.scene.add(axis);

    this.scene.add(this._caption('COST OF INACTION  →', new THREE.Vector3(BOX / 2, -0.4, BOX + 0.7)));
    this.scene.add(this._caption('IMPORTANCE  →', new THREE.Vector3(-1.4, -0.4, BOX / 2)));
  }

  _caption(text, pos) {
    const d = document.createElement('div');
    d.textContent = text;
    d.style.cssText = `font-family:${DISPLAY};font-style:italic;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:${INK};white-space:nowrap;`;
    const o = new CSS2DObject(d);
    o.position.copy(pos);
    return o;
  }

  _makeLabel(text, strong) {
    const d = document.createElement('div');
    d.textContent = text;
    d.style.cssText =
      `font-family:${BODY};font-size:${strong ? '13px' : '11px'};font-weight:${strong ? '600' : '400'};color:${INK};` +
      'background:rgba(255,255,255,.82);padding:1px 5px;white-space:nowrap;transform:translateY(-16px);';
    return new CSS2DObject(d);
  }

  // hover annotation: ring + drawn leader line + bordered label, animated in
  _buildAnnotation() {
    const el = document.createElement('div');
    el.className = 'g3d-anno';
    el.innerHTML =
      '<svg class="g3d-anno__svg"><line class="g3d-anno__line" x1="0" y1="0" x2="0" y2="0"></line></svg>' +
      '<span class="g3d-anno__ring"></span>' +
      '<span class="g3d-anno__label"></span>';
    this.el.appendChild(el);
    this.anno = {
      root: el,
      line: el.querySelector('.g3d-anno__line'),
      ring: el.querySelector('.g3d-anno__ring'),
      label: el.querySelector('.g3d-anno__label'),
    };
    this._annoObj = null;
  }

  _showAnno(obj) {
    if (!this.anno) return;
    this._annoObj = obj;
    this.anno.label.textContent = obj.userData.task.name || `Task ${obj.userData.id}`;
    // restart the ease-in-out reveal for every new hover target
    this.anno.root.classList.remove('is-on');
    void this.anno.root.offsetWidth; // force reflow
    this._positionAnno();
    this.anno.root.classList.add('is-on');
  }

  _hideAnno() {
    this._annoObj = null;
    if (this.anno) this.anno.root.classList.remove('is-on');
  }

  _positionAnno() {
    if (!this._annoObj || !this.anno) return;
    const r = this.renderer.domElement;
    const w = r.clientWidth, h = r.clientHeight;
    const v = this._annoObj.position.clone().project(this.camera);
    const sx = (v.x * 0.5 + 0.5) * w;
    const sy = (-v.y * 0.5 + 0.5) * h;

    // label anchored up-and-right of the point, clamped to the container
    const lw = this.anno.label.offsetWidth || 190;
    const lh = this.anno.label.offsetHeight || 40;
    const lx = Math.min(Math.max(sx + 96, 8), Math.max(8, w - lw - 8));
    const ly = Math.min(Math.max(sy - 96, 8), Math.max(8, h - lh - 8));

    this.anno.ring.style.left = `${sx}px`;
    this.anno.ring.style.top = `${sy}px`;
    this.anno.label.style.left = `${lx}px`;
    this.anno.label.style.top = `${ly}px`;
    this.anno.line.setAttribute('x1', sx);
    this.anno.line.setAttribute('y1', sy);
    this.anno.line.setAttribute('x2', lx);
    this.anno.line.setAttribute('y2', ly + lh);
  }

  render(tasks, relationships) {
    this._lastTasks = tasks;
    this._lastRels = relationships;
    if (!this.renderer) this.init();
    if (!this.renderer) return;

    for (const m of this.nodeMeshes) {
      if (m.userData.iconObj) { m.userData.iconObj.element.remove(); m.remove(m.userData.iconObj); }
      m.material.dispose();
      this.nodeGroup.remove(m);
    }
    this.nodeMeshes = [];
    while (this.edgeGroup.children.length) {
      const c = this.edgeGroup.children.pop();
      c.geometry.dispose();
      c.material.dispose();
    }

    // done + "Not Sure" tasks drop off the chart entirely (still live in the table)
    const list = (Array.isArray(tasks) ? tasks : []).filter((t) => !t.done && t.status !== 'Not Sure');
    const rels = Array.isArray(relationships) ? relationships : [];
    const kindById = new Map(list.map((t) => [Number(t.id), kindOf(t)]));

    // Any starred ("focus") action gets its own ranked floor slot, no matter
    // how deep it's nested — a core mission buried under three parents is
    // still a core mission. Its own non-starred subtasks sit out of the
    // ranked floor entirely and are instead revealed as a small cluster
    // around it on focus, so a board with a lot of subtasks doesn't crowd
    // the floor.
    const focusActions = list.filter((t) => kindOf(t) === 'action' && t.is_focus);
    const subActions = list.filter((t) => kindOf(t) === 'action' && t.parent_id && !t.is_focus && kindById.get(Number(t.parent_id)) !== undefined);
    const actions = focusActions;
    const outcomes = list.filter((t) => kindOf(t) === 'outcome');

    // Icons need to shrink on two independent axes: a narrow (mobile) panel
    // makes the same icon footprint cover a much bigger share of the grid,
    // and a crowded board (many action nodes sharing the 10-unit floor) means
    // less room per icon regardless of screen size. Combine both instead of
    // just the panel-width factor, which wasn't enough on boards with 20+
    // actions even at full desktop width. Subtasks are hidden by default so
    // they don't count toward the density that matters here.
    const widthFactor = Math.min(1, (this.el.clientWidth || 480) / 480);
    const densityFactor = Math.min(1, 12 / Math.max(1, actions.length));
    const sizeScale = Math.max(0.4, widthFactor * densityFactor);

    // Floor plane: X = cost of inaction, Z = importance (percentile-ranked so
    // tie-heavy boards fan out). Action nodes sit flat on the floor.
    // rank keys carry a per-id epsilon so a wall of 8-10 ratings still fans out
    const cKey = (t) => coiOf(t) + rankEps(Number(t.id));
    const iKey = (t) => num(t.importance) + rankEps(Number(t.id) * 7 + 3);
    const rankC = this.rankMode ? rankMapper(actions.map(cKey)) : null;
    const rankI = this.rankMode ? rankMapper(actions.map(iKey)) : null;
    const pos = new Map(actions.map((t) => {
      const j = jitter(t.id);
      const cx = rankC ? rankC(cKey(t)) : clamp10(coiOf(t));
      const iz = rankI ? rankI(iKey(t)) : clamp10(num(t.importance));
      return [Number(t.id), new THREE.Vector3(clamp10(cx + j.x), 0, clamp10(iz + j.z))];
    }));
    // Subtasks orbit their parent's floor position in a small fixed-radius
    // ring instead of being independently ranked — kept out of frame
    // (display:none, see .g3d-node.is-subtask) until the parent is focused.
    const byParent = new Map();
    for (const t of subActions) {
      const pid = Number(t.parent_id);
      if (!byParent.has(pid)) byParent.set(pid, []);
      byParent.get(pid).push(t);
    }
    for (const [pid, kids] of byParent) {
      const parentPos = pos.get(pid);
      if (!parentPos) continue;
      kids.forEach((t, i) => {
        const angle = (i / kids.length) * Math.PI * 2;
        const r = 0.85;
        pos.set(Number(t.id), new THREE.Vector3(
          clamp10(parentPos.x + Math.cos(angle) * r),
          0,
          clamp10(parentPos.z + Math.sin(angle) * r)
        ));
      });
    }
    // Outcome/identity tasks are never placed on the floor and get no mesh —
    // they're goals/vision, not scored actions, and drawing them here (past
    // the grid edge, on their own bands) kept ending up as an illegible
    // cluster of overlapping labels. They stay fully visible everywhere else
    // (Active Tasks, node card, "Copy hierarchy") — just not in this view.

    // colour per outcome; each action inherits the colour of the nearest outcome
    // it leads to via enable edges (BFS downstream), else grey.
    const outcomeColor = new Map();
    outcomes.forEach((t, i) => outcomeColor.set(Number(t.id), OUTCOME_PALETTE[i % OUTCOME_PALETTE.length]));
    const enableAdj = new Map();
    for (const r of rels) {
      const a = Number(r.enabler_task_id);
      if (!enableAdj.has(a)) enableAdj.set(a, []);
      enableAdj.get(a).push(Number(r.enabled_task_id));
    }
    const routeColor = (id) => {
      const seen = new Set([id]);
      let frontier = [id];
      for (let depth = 0; depth < 12 && frontier.length; depth++) {
        const next = [];
        for (const cur of frontier) {
          for (const nb of (enableAdj.get(cur) || [])) {
            if (outcomeColor.has(nb)) return outcomeColor.get(nb);
            if (!seen.has(nb)) { seen.add(nb); next.push(nb); }
          }
        }
        frontier = next;
      }
      return UNROUTED;
    };
    const actionColor = new Map(actions.map((t) => [Number(t.id), routeColor(Number(t.id))]));
    // Subtasks inherit their parent's route colour rather than routing
    // independently — they read as "part of" the parent, not their own node.
    for (const t of subActions) {
      actionColor.set(Number(t.id), actionColor.get(Number(t.parent_id)) || UNROUTED);
    }

    // Each node = a topic glyph (MDI) via CSS2D; an invisible mesh is the click target.
    // Only actions ever get a floor position (see pos, above), so list here
    // is implicitly action-only once the `!p` guard runs.
    for (const t of list) {
      const id = Number(t.id);
      const mag = 0.55 + priority(t) / 100 * 0.85; // node size = importance x cost of inaction
      const p = pos.get(id);
      if (!p) continue;

      const mesh = new THREE.Mesh(PICK_GEO, new THREE.MeshBasicMaterial({ visible: false }));
      mesh.position.copy(p);
      mesh.scale.setScalar(0.1); // just a carrier for the CSS2D icon; picking is screen-space now

      const el = document.createElement('div');
      el.className = 'g3d-node';
      el.innerHTML = lucideSvg(iconFor(t)) || '&bull;';
      el.style.color = actionColor.get(id) || UNROUTED;
      const subMag = t.parent_id ? mag * 0.72 : mag;
      el.style.fontSize = `${Math.round((14 + subMag * 12) * sizeScale)}px`;
      if (t.status === 'in_progress') el.classList.add('is-doing');
      if (t.parent_id) el.classList.add('is-subtask'); // hidden by default; revealed when its parent is focused
      const iconObj = new CSS2DObject(el);
      mesh.add(iconObj);

      mesh.userData = {
        task: t, id, base: mag, inProgress: t.status === 'in_progress', iconObj, iconEl: el,
        parentId: t.parent_id ? Number(t.parent_id) : null
      };
      this.nodeGroup.add(mesh);
      this.nodeMeshes.push(mesh);
    }

    // hand-drawn curved connectors between related tasks (batched into one LineSegments)
    const segs = [];
    const cols = [];
    const seg = (p, q, c) => {
      segs.push(p.x, p.y, p.z, q.x, q.y, q.z);
      cols.push(c.r, c.g, c.b, c.r, c.g, c.b);
    };
    const hash01 = (a, b) => {
      const s = Math.sin((a.x + b.z) * 127.1 + (a.z + b.x) * 311.7) * 43758.5453;
      return s - Math.floor(s);
    };
    const curve = (a, b, hex, lift) => {
      const col = new THREE.Color(hex);
      const dir = b.clone().sub(a);
      const len = dir.length() || 1;
      const k = hash01(a, b);
      const perp = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
      const ctrl = a.clone().add(b).multiplyScalar(0.5)
        .add(new THREE.Vector3(0, len * lift, 0))
        .addScaledVector(perp, (k - 0.5) * len * 0.28);
      const P = new THREE.QuadraticBezierCurve3(a, ctrl, b).getPoints(20);
      for (let i = 1; i < P.length - 1; i++) {
        const w = (Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1;
        P[i].x += (w - 0.5) * 0.06;
        P[i].z += (w - 0.5) * 0.06;
      }
      for (let i = 0; i < P.length - 1; i++) seg(P[i], P[i + 1], col);
      // chevron at the "enabled" end
      const t = P[P.length - 1].clone().sub(P[P.length - 2]).normalize();
      const nrm = new THREE.Vector3(-t.z, 0, t.x);
      const back = b.clone().addScaledVector(t, -0.34);
      seg(b, back.clone().addScaledVector(nrm, 0.14), col);
      seg(b, back.clone().addScaledVector(nrm, -0.14), col);
    };

    let n = 0;
    if (this.showRelationships) {
      // Both ends are always actions now — outcomes/identities never get a
      // floor position, so an edge into one has no `b` and is skipped below.
      for (const r of rels) {
        if (n >= 220) break;
        const a = pos.get(Number(r.enabler_task_id));
        const b = pos.get(Number(r.enabled_task_id));
        if (!a || !b) continue;
        const hex = actionColor.get(Number(r.enabler_task_id)) || '#e0654b';
        curve(a, b, hex, 0.16);
        n++;
      }
    }
    if (this.showSubtasks) {
      for (const t of list) {
        if (n >= 220) break;
        if (!t.parent_id) continue;
        const a = pos.get(Number(t.parent_id));
        const b = pos.get(Number(t.id));
        if (a && b) { curve(a, b, '#c9c9c9', 0.10); n++; }
      }
    }
    if (segs.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      this.edgeGroup.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({
        vertexColors: true, transparent: true, opacity: 0.6,
      })));
    }

    this._applyFocus();
  }

  focusOnTask(taskId) {
    this.focusId = taskId == null ? null : Number(taskId);
    this._applyFocus();
    if (this.focusId != null) {
      const m = this.nodeMeshes.find((x) => x.userData.id === this.focusId);
      if (m) this._easeTarget = m.position.clone();
    }
  }

  // Snap back to a pulled-back overview angle that keeps the whole floor
  // (including the high-importance / high-cost-of-inaction far corner) inside
  // the frame — the default framing is tight enough that those top-edge nodes
  // can clip against the panel's own top border after a viewport resize or a
  // user drag. Same viewing direction as the initial camera, just backed off.
  resetView() {
    this._easeTarget = TARGET.clone();
    const dir = HOME_CAM.clone().sub(TARGET).normalize();
    // Never snap in tighter than the designed default framing (HOME_CAM's
    // own distance) — only push further out when a narrower aspect ratio
    // needs the extra room. Fit View previously always recomputed the
    // tightest fit for the current aspect, which could zoom in noticeably
    // closer than the initial view; this keeps the two consistent.
    const distance = Math.max(HOME_CAM.distanceTo(TARGET), this._contentFitDistance());
    this._easeCamPos = TARGET.clone().add(dir.multiplyScalar(distance));
  }

  _contentFitDistance() {
    const vFov = THREE.MathUtils.degToRad(this.camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
    const minHalfFov = Math.min(vFov, hFov) / 2;
    const raw = CONTENT_RADIUS / Math.sin(minHalfFov);
    return Math.min(Math.max(raw, this.controls.minDistance), this.controls.maxDistance);
  }

  // Re-derive the minimum camera distance from the current aspect ratio so
  // the floor's corners stay inside frame on any panel shape. Only pushes
  // the camera OUT when it's currently too close for this aspect (which
  // would clip); never yanks in a user's deliberate zoom-out on an
  // incidental resize.
  _fitCameraDistance() {
    if (!this.camera || !this.controls) return;
    const dir = this.camera.position.clone().sub(this.controls.target);
    const current = dir.length();
    if (dir.lengthSq() < 1e-6) dir.copy(HOME_CAM).sub(TARGET);
    const required = this._contentFitDistance();
    if (current >= required) return;
    dir.normalize().multiplyScalar(required);
    this.camera.position.copy(this.controls.target).add(dir);
  }

  _applyFocus() {
    const dim = this.focusId != null;
    for (const m of this.nodeMeshes) {
      const el = m.userData.iconEl;
      if (!el) continue;
      const isFocused = dim && m.userData.id === this.focusId;
      // Subtasks are hidden (display:none via .is-subtask) until their
      // parent is focused, at which point .is-focus-child reveals them
      // clustered around it and exempts them from the dim treatment.
      const isFocusChild = dim && m.userData.parentId === this.focusId;
      el.classList.toggle('is-focus', isFocused);
      el.classList.toggle('is-focus-child', isFocusChild);
      el.classList.toggle('is-dim', dim && !isFocused && !isFocusChild);
    }
  }

  // pick in SCREEN space: the node whose projected icon is closest to the cursor
  // (within a small pixel radius). Matches exactly what the user is pointing at,
  // regardless of camera angle / zoom, and never bulges over neighbours.
  _pick(e) {
    if (!this.renderer || !this.nodeMeshes.length) return null;
    const r = this.renderer.domElement.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    const v = new THREE.Vector3();
    let best = null;
    let bestD = 18; // px hit radius (~ icon half-size)
    for (const m of this.nodeMeshes) {
      // Hidden (unrevealed) subtasks still occupy a screen position around
      // their parent — skip them as pick targets so tapping near the
      // cluster always lands on the parent, not an invisible sibling.
      const el = m.userData.iconEl;
      if (el && el.classList.contains('is-subtask') && !el.classList.contains('is-focus-child')) continue;
      v.copy(m.position).project(this.camera);
      if (v.z > 1) continue; // behind the camera
      const sx = (v.x * 0.5 + 0.5) * r.width;
      const sy = (-v.y * 0.5 + 0.5) * r.height;
      const d = Math.hypot(sx - px, sy - py);
      if (d < bestD) { bestD = d; best = m; }
    }
    return best;
  }

  _pointerMove(e) {
    const obj = this._pick(e);
    const id = obj ? obj.userData.id : null;
    if (id === this.hoverId) return;
    this.hoverId = id;
    this.renderer.domElement.style.cursor = id != null ? 'pointer' : 'default';
    if (obj) this._showAnno(obj);
    else this._hideAnno();
  }

  _click(e) {
    const obj = this._pick(e);
    if (!obj) { window.dispatchEvent(new CustomEvent('node:deselect')); return; }
    const v = obj.position.clone().project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    window.dispatchEvent(new CustomEvent('node:select', {
      detail: {
        taskId: obj.userData.id,
        screenX: r.left + (v.x * 0.5 + 0.5) * r.width,
        screenY: r.top + (-v.y * 0.5 + 0.5) * r.height,
        task: obj.userData.task,
      },
    }));
    this.focusOnTask(obj.userData.id);
  }

  _loop() {
    this._raf = requestAnimationFrame(() => this._loop());
    if (!this._active || document.hidden || !this.renderer) return;

    // icon marks are DOM (CSS2D) and always face the viewer; the "doing" pulse
    // is a CSS animation, so nothing per-frame is needed for the nodes.

    if (this._easeTarget) {
      this.controls.target.lerp(this._easeTarget, 0.08);
      if (this.controls.target.distanceTo(this._easeTarget) < 0.02) this._easeTarget = null;
    }
    if (this._easeCamPos) {
      this.camera.position.lerp(this._easeCamPos, 0.08);
      if (this.camera.position.distanceTo(this._easeCamPos) < 0.05) this._easeCamPos = null;
    }

    if (this._annoObj) this._positionAnno();

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  }

  resize() {
    if (!this.renderer || !this.el) return;
    const w = this.el.clientWidth || 1;
    const h = this.el.clientHeight || 1;
    this.camera.aspect = w / h;
    this._fitCameraDistance();
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
  }

  setActive(on) { this._active = !!on; }

  dispose() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    window.removeEventListener('resize', this._onResize);
    if (this._ro) { this._ro.disconnect(); this._ro = null; }
    if (this.renderer) {
      this.renderer.domElement.removeEventListener('pointermove', this._onPointerMove);
      this.renderer.domElement.removeEventListener('pointerleave', this._onPointerLeave);
      this.renderer.domElement.removeEventListener('pointerdown', this._onPointerDown);
      this.renderer.domElement.removeEventListener('pointerup', this._onPointerUp);
      this.renderer.dispose();
      this.renderer.domElement.remove();
    }
    if (this.labelRenderer) this.labelRenderer.domElement.remove();
    if (this.anno) { this.anno.root.remove(); this.anno = null; }
    this._annoObj = null;
    this.scene = this.camera = this.renderer = null;
    this.labelRenderer = this.controls = null;
    this.nodeMeshes = [];
  }
}
