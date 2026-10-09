// Cartoon look: 3-band toon shading + inverted-hull black outlines.
import * as THREE from 'three';

const gradientMap = (() => {
  const data = new Uint8Array([90, 90, 90, 255, 180, 180, 180, 255, 255, 255, 255, 255]);
  const tex = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
})();

// Softer 3-step ramp for textured characters: keeps more of the painted detail in the shadows
export const softGradientMap = (() => {
  const data = new Uint8Array([165, 165, 165, 255, 220, 220, 220, 255, 255, 255, 255, 255]);
  const tex = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
})();

const matCache = new Map();

export function toon(color, opts = {}) {
  const key = `${color}|${opts.emissive ?? ''}|${opts.transparent ?? ''}|${opts.opacity ?? ''}`;
  if (!opts.map && matCache.has(key)) return matCache.get(key);
  const mat = new THREE.MeshToonMaterial({ color, gradientMap, ...opts });
  if (!opts.map) matCache.set(key, mat);
  return mat;
}

const outlineCache = new Map();

// Pushes vertices along their view-space normals by `thickness` world units, regardless of the
// mesh's own scale; works for regular, instanced and skinned meshes.
export function outlineMaterial(thickness = 0.03) {
  if (outlineCache.has(thickness)) return outlineCache.get(thickness);
  const mat = new THREE.ShaderMaterial({
    uniforms: { thickness: { value: thickness } },
    vertexShader: /* glsl */ `
      #include <common>
      #include <skinning_pars_vertex>
      uniform float thickness;
      void main() {
        #include <beginnormal_vertex>
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        #include <begin_vertex>
        #include <skinning_vertex>
        vec4 mvPosition = vec4(transformed, 1.0);
        vec3 n = objectNormal;
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
          n = mat3(instanceMatrix) * n;
        #endif
        mvPosition = modelViewMatrix * mvPosition;
        mvPosition.xyz += normalize(mat3(modelViewMatrix) * n) * thickness;
        gl_Position = projectionMatrix * mvPosition;
      }`,
    fragmentShader: /* glsl */ `void main() { gl_FragColor = vec4(0.08, 0.08, 0.08, 1.0); }`,
    side: THREE.BackSide,
  });
  outlineCache.set(thickness, mat);
  return mat;
}

/** Toon mesh with an outline child. */
export function part(geometry, color, { outline = 0.025, cast = true, receive = false, matOpts } = {}) {
  const mesh = new THREE.Mesh(geometry, typeof color === 'object' ? color : toon(color, matOpts));
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  if (outline > 0) {
    const ol = new THREE.Mesh(geometry, outlineMaterial(outline));
    ol.raycast = () => {};
    mesh.add(ol);
  }
  return mesh;
}

/** Instanced toon mesh + matching instanced outline. Returns a Group. */
export function instanced(geometry, color, matrices, { outline = 0.03, cast = true, colors } = {}) {
  const group = new THREE.Group();
  const mesh = new THREE.InstancedMesh(geometry, toon(colors ? 0xffffff : color), matrices.length);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
  if (colors) colors.forEach((c, i) => mesh.setColorAt(i, new THREE.Color(c)));
  group.add(mesh);
  if (outline > 0) {
    const ol = new THREE.InstancedMesh(geometry, outlineMaterial(outline), matrices.length);
    matrices.forEach((m, i) => ol.setMatrixAt(i, m));
    group.add(ol);
  }
  return group;
}

/** Canvas-texture helper for signs, badges and speech bubbles. */
export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export const FONT = '"Fredoka", "Comic Sans MS", sans-serif';

/** Hand-painted sign: wrapped lines centered on a paper background. */
export function signTexture(lines, { w = 512, h = 384, bg = '#fff8e6', fg = '#1e3fa0', size = 64, extra } = {}) {
  return canvasTexture(w, h, (ctx) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = fg;
    ctx.font = `600 ${size}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lh = size * 1.1;
    const y0 = h / 2 - ((lines.length - 1) * lh) / 2;
    lines.forEach((l, i) => ctx.fillText(l, w / 2, y0 + i * lh));
    extra?.(ctx, w, h);
  });
}
