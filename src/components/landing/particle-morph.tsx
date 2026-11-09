"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { AdditiveBlending, NormalBlending, type BufferAttribute, type Group, type Points, ShaderMaterial } from "three";

/**
 * Conceptual particle geometries. They are illustrative silhouettes only —
 * none of them encodes experimental data, flame dimensions, or hardware geometry.
 */
export type ShapeKey = "droplet" | "solidFuel" | "enclosure" | "aerosol" | "corpus" | "chamber";

type Rng = () => number;
function makeRng(seed: number): Rng {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
function gauss(r: Rng) {
  return Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r());
}

function buildShape(key: ShapeKey, n: number): Float32Array {
  const out = new Float32Array(n * 3);
  const r = makeRng(key.length * 7919 + n);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    let x = 0, y = 0, z = 0;
    switch (key) {
      case "droplet": {
        // Shell + soft inner core, a classic "spherical flame" silhouette.
        const shell = i % 5 !== 0;
        const t = i / n;
        const yy = 1 - t * 2;
        const rad = Math.sqrt(1 - yy * yy);
        const th = golden * i;
        const R = shell ? 1.15 + gauss(r) * 0.025 : 0.18 + r() * 0.22;
        x = Math.cos(th) * rad * R;
        y = yy * R;
        z = Math.sin(th) * rad * R;
        break;
      }
      case "solidFuel": {
        // Thin sample plate with a curved flame sheet leaning downstream.
        if (i % 3 === 0) {
          const u = r() * 2 - 1;
          const v = r() * 2 - 1;
          x = u * 1.55;
          y = -0.55 + gauss(r) * 0.012;
          z = v * 0.48;
        } else {
          const u = r();
          const v = r() * 2 - 1;
          const front = -1.2 + u * 1.9;
          const h = Math.sin(u * Math.PI) * 0.95 * (1 - u * 0.35);
          x = front;
          y = -0.5 + h * (0.4 + r() * 0.6);
          z = v * 0.46 * (1 - u * 0.25);
        }
        break;
      }
      case "enclosure": {
        // Box-like module outline with an inner sample panel.
        const sel = r();
        if (sel < 0.72) {
          const face = Math.floor(r() * 6);
          const a = r() * 2 - 1, b = r() * 2 - 1;
          const S = [1.5, 0.85, 0.85];
          if (face < 2) { x = face ? S[0] : -S[0]; y = a * S[1]; z = b * S[2]; }
          else if (face < 4) { y = face === 3 ? S[1] : -S[1]; x = a * S[0]; z = b * S[2]; }
          else { z = face === 5 ? S[2] : -S[2]; x = a * S[0]; y = b * S[1]; }
          const edge = Math.abs(Math.abs(a) - 1) < 0.06 || Math.abs(Math.abs(b) - 1) < 0.06;
          if (!edge && r() < 0.55) { x *= 0.995; y *= 0.995; }
        } else {
          x = (r() * 2 - 1) * 1.1;
          y = (r() * 2 - 1) * 0.6;
          z = gauss(r) * 0.015;
        }
        break;
      }
      case "aerosol": {
        // Clustered smoke cloud.
        const c = i % 7;
        const centers = [[0, 0.1, 0], [0.7, 0.45, 0.2], [-0.75, 0.3, -0.1], [0.35, -0.5, 0.3], [-0.4, -0.45, -0.25], [1.15, -0.1, -0.2], [-1.15, -0.05, 0.25]];
        const s = c === 0 ? 0.42 : 0.3;
        x = centers[c][0] + gauss(r) * s;
        y = centers[c][1] + gauss(r) * s;
        z = centers[c][2] + gauss(r) * s;
        break;
      }
      case "corpus": {
        // Dense lattice sphere used as the "source corpus" in the pipeline section.
        const t = i / n;
        const yy = 1 - t * 2;
        const rad = Math.sqrt(1 - yy * yy);
        const th = golden * i;
        const R = 1.05 + (i % 4 === 0 ? -0.25 * r() : 0);
        x = Math.cos(th) * rad * R * 1.1;
        y = yy * R * 0.92;
        z = Math.sin(th) * rad * R;
        break;
      }
      case "chamber": {
        // Generic cylindrical chamber with rings — conceptual, not a NASA hardware model.
        const sel = r();
        if (sel < 0.6) {
          const th = r() * Math.PI * 2;
          const len = r() * 2 - 1;
          const ring = Math.round(len * 6) / 6;
          const onRing = r() < 0.45;
          x = (onRing ? ring : len) * 1.35;
          y = Math.cos(th) * 0.82;
          z = Math.sin(th) * 0.82;
        } else if (sel < 0.85) {
          const th = r() * Math.PI * 2;
          const rr = 0.82 + r() * 0.28;
          const side = r() < 0.5 ? -1 : 1;
          x = side * 1.35;
          y = Math.cos(th) * rr;
          z = Math.sin(th) * rr;
        } else {
          x = (r() * 2 - 1) * 0.9;
          y = (r() * 2 - 1) * 0.35;
          z = gauss(r) * 0.02;
        }
        break;
      }
    }
    out[i * 3] = x;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = z;
  }
  return out;
}

// NASA Blue → Electric Cobalt → Flame Orange → Solar Amber thermal gradient.
const STOPS: [number, [number, number, number]][] = [
  [0, [0.04, 0.24, 0.57]],    // NASA Deep Blue (#0B3D91)
  [0.38, [0.09, 0.52, 0.95]], // Aerospace Electric Blue (#1785F2)
  [0.72, [1.0, 0.33, 0.0]],   // Ignition Flame Orange (#FF5500)
  [1, [0.98, 0.62, 0.05]],    // Solar Amber (#FA9E0D)
];
function gradient(t: number, out: Float32Array, o: number) {
  const k = Math.min(1, Math.max(0, t));
  for (let s = 0; s < STOPS.length - 1; s++) {
    const [a, ca] = STOPS[s];
    const [b, cb] = STOPS[s + 1];
    if (k <= b) {
      const f = (k - a) / (b - a);
      out[o] = ca[0] + (cb[0] - ca[0]) * f;
      out[o + 1] = ca[1] + (cb[1] - ca[1]) * f;
      out[o + 2] = ca[2] + (cb[2] - ca[2]) * f;
      return;
    }
  }
}
function buildColors(pos: Float32Array, n: number) {
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const y = pos[i * 3 + 1];
    const x = pos[i * 3];
    gradient(0.5 + y * 0.42 + x * 0.08, col, i * 3);
  }
  return col;
}

const vertex = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSize;
  uniform float uSize;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vFade;
  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * aSize * uPixelRatio * (4.6 / -mv.z);
    vFade = clamp((-mv.z - 3.4) / 2.8, 0.0, 1.0);
  }
`;
const fragment = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vFade;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.15, d);
    gl_FragColor = vec4(vColor, a * uOpacity * (1.0 - vFade * 0.6));
  }
`;

type FieldProps = {
  shapes: ShapeKey[];
  active: number;
  count: number;
  pointSize: number;
  animate: boolean;
  autoRotate: boolean;
  rotationY: number | null;
  dark: boolean;
};

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function Field({ shapes, active, count, pointSize, animate, autoRotate, rotationY, dark }: FieldProps) {
  const groupRef = useRef<Group>(null);
  const pointsRef = useRef<Points>(null);
  const { gl } = useThree();

  const data = useMemo(() => {
    const targets = shapes.map((key) => buildShape(key, count));
    const colors = targets.map((t) => buildColors(t, count));
    const r = makeRng(99);
    const delay = new Float32Array(count);
    const scatter = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const phase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      delay[i] = r() * 0.35;
      scatter[i * 3] = gauss(r);
      scatter[i * 3 + 1] = gauss(r);
      scatter[i * 3 + 2] = gauss(r);
      size[i] = 0.55 + r() * 0.9;
      phase[i] = r() * Math.PI * 2;
    }
    return { targets, colors, delay, scatter, size, phase, initialPos: new Float32Array(targets[0]), initialCol: new Float32Array(colors[0]) };
  }, [shapes, count]);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        depthWrite: false,
        blending: dark ? AdditiveBlending : NormalBlending,
        uniforms: {
          uSize: { value: pointSize },
          uPixelRatio: { value: Math.min(gl.getPixelRatio(), 2) },
          uOpacity: { value: dark ? 0.9 : 0.92 },
        },
      }),
    [dark, gl, pointSize],
  );
  useEffect(() => () => material.dispose(), [material]);

  const morph = useRef({ from: new Float32Array(data.initialPos), fromCol: new Float32Array(data.initialCol), to: 0, start: -10 });
  const clockRef = useRef(0);

  useEffect(() => {
    const geo = pointsRef.current?.geometry;
    if (!geo) return;
    const pos = geo.getAttribute("position") as BufferAttribute;
    const col = geo.getAttribute("aColor") as BufferAttribute;
    morph.current.from = new Float32Array(pos.array as Float32Array);
    morph.current.fromCol = new Float32Array(col.array as Float32Array);
    morph.current.to = Math.min(active, data.targets.length - 1);
    morph.current.start = animate ? clockRef.current : -10;
  }, [active, animate, data.targets.length]);

  useFrame((state, dt) => {
    const time = state.clock.elapsedTime;
    clockRef.current = time;
    const geo = pointsRef.current?.geometry;
    const group = groupRef.current;
    if (!geo || !group) return;
    const pos = geo.getAttribute("position") as BufferAttribute;
    const col = geo.getAttribute("aColor") as BufferAttribute;
    const p = pos.array as Float32Array;
    const c = col.array as Float32Array;
    const { from, fromCol, to, start } = morph.current;
    const target = data.targets[to];
    const tCol = data.colors[to];
    const duration = 1.7;
    const elapsed = time - start;

    for (let i = 0; i < count; i++) {
      const o = i * 3;
      let local = (elapsed - data.delay[i] * duration) / (duration * 0.65);
      local = local < 0 ? 0 : local > 1 ? 1 : local;
      const e = easeInOutCubic(local);
      const bump = Math.sin(local * Math.PI) * 0.42;
      const idle = animate ? 0.012 : 0;
      const ph = data.phase[i];
      p[o] = from[o] + (target[o] - from[o]) * e + data.scatter[o] * bump + Math.sin(time * 0.9 + ph) * idle;
      p[o + 1] = from[o + 1] + (target[o + 1] - from[o + 1]) * e + data.scatter[o + 1] * bump + Math.cos(time * 0.8 + ph) * idle;
      p[o + 2] = from[o + 2] + (target[o + 2] - from[o + 2]) * e + data.scatter[o + 2] * bump;
      c[o] = fromCol[o] + (tCol[o] - fromCol[o]) * e;
      c[o + 1] = fromCol[o + 1] + (tCol[o + 1] - fromCol[o + 1]) * e;
      c[o + 2] = fromCol[o + 2] + (tCol[o + 2] - fromCol[o + 2]) * e;
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;

    // Rotation: either a commanded angle (inspector pins) or slow auto-rotation, plus pointer tilt.
    if (rotationY !== null) {
      group.rotation.y += (rotationY - group.rotation.y) * Math.min(1, dt * 3.2);
    } else if (autoRotate && animate) {
      group.rotation.y += dt * 0.16;
    }
    const tiltX = animate ? -state.pointer.y * 0.18 : 0;
    const tiltZ = animate ? state.pointer.x * 0.06 : 0;
    group.rotation.x += (tiltX + 0.12 - group.rotation.x) * Math.min(1, dt * 2.5);
    group.rotation.z += (tiltZ - group.rotation.z) * Math.min(1, dt * 2.5);
  });

  return (
    <group ref={groupRef}>
      <points ref={pointsRef} material={material} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(data.initialPos), 3]} />
          <bufferAttribute attach="attributes-aColor" args={[new Float32Array(data.initialCol), 3]} />
          <bufferAttribute attach="attributes-aSize" args={[data.size, 1]} />
        </bufferGeometry>
      </points>
    </group>
  );
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(q.matches);
    update();
    q.addEventListener("change", update);
    return () => q.removeEventListener("change", update);
  }, []);
  return reduced;
}

type ParticleMorphProps = {
  shapes: ShapeKey[];
  active?: number;
  count?: number;
  pointSize?: number;
  autoRotate?: boolean;
  rotationY?: number | null;
  dark?: boolean;
  cameraZ?: number;
  className?: string;
  label: string;
};

/** Particle morph stage. Renders only while on screen; honours reduced-motion. */
export function ParticleMorph({ shapes, active = 0, count = 5200, pointSize = 9, autoRotate = true, rotationY = null, dark = false, cameraZ = 4.6, className, label }: ParticleMorphProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [webgl, setWebgl] = useState(true);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "120px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const n = typeof window !== "undefined" && window.innerWidth < 768 ? Math.round(count * 0.45) : count;

  return (
    <div ref={wrapRef} className={className} role="img" aria-label={label}>
      {webgl ? (
        <Canvas
          dpr={[1, 1.75]}
          frameloop={visible ? (reduced ? "demand" : "always") : "never"}
          camera={{ position: [0, 0, cameraZ], fov: 40 }}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          onCreated={({ gl }) => gl.domElement.addEventListener("webglcontextlost", () => setWebgl(false), { once: true })}
        >
          <Field shapes={shapes} active={active} count={n} pointSize={pointSize} animate={!reduced} autoRotate={autoRotate} rotationY={rotationY} dark={dark} />
        </Canvas>
      ) : (
        <div className="lp-fallback">Conceptual particle visual unavailable on this device.</div>
      )}
    </div>
  );
}
