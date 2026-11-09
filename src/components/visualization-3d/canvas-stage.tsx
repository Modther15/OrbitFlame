"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { BufferAttribute, Points } from "three";

function CombustionParticles({ animate }: { animate: boolean }) {
  const pointsRef = useRef<Points>(null);
  const count = 760;
  const { basePositions, colors } = useMemo(() => {
    const basePositions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    let seed = 21;
    const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    for (let i = 0; i < count; i++) {
      const t = random();
      const angle = random() * Math.PI * 2;
      const radius = (0.12 + random() * 0.68) * (0.62 + 0.38 * Math.sin(t * Math.PI));
      const x = Math.cos(angle) * radius + 0.23 * (t - 0.5);
      const y = (t - 0.5) * 2.25;
      const z = Math.sin(angle) * radius * 0.48;
      const offset = i * 3;
      basePositions[offset] = x;
      basePositions[offset + 1] = y;
      basePositions[offset + 2] = z;
      const core = Math.max(0, 1 - radius);
      colors[offset] = 0.12 + core * 0.88;
      colors[offset + 1] = 0.72 + core * 0.2;
      colors[offset + 2] = 0.92 - core * 0.56;
    }
    return { basePositions, colors };
  }, []);

  useFrame(({ clock }) => {
    const geometry = pointsRef.current?.geometry;
    const attribute = geometry?.getAttribute("position") as BufferAttribute | undefined;
    if (!attribute) return;
    const positions = attribute.array as Float32Array;
    const time = clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      const offset = i * 3;
      const y = basePositions[offset + 1];
      const wave = animate ? Math.sin(time * 0.72 + i * 0.17) : 0;
      positions[offset] = basePositions[offset] + wave * 0.045 * (0.4 + Math.abs(y));
      positions[offset + 1] = y + (animate ? Math.sin(time * 0.5 + i * 0.07) * 0.025 : 0);
      positions[offset + 2] = basePositions[offset + 2] + (animate ? Math.cos(time * 0.6 + i * 0.13) * 0.025 : 0);
    }
    attribute.needsUpdate = true;
  });

  return <points ref={pointsRef}>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[new Float32Array(basePositions), 3]} /><bufferAttribute attach="attributes-color" args={[colors, 3]} /></bufferGeometry>
    <pointsMaterial size={0.065} vertexColors transparent opacity={1} sizeAttenuation depthWrite={false} toneMapped={false} />
  </points>;
}

export function CanvasStage() {
  const [webgl, setWebgl] = useState(true);
  const [paused, setPaused] = useState(false);
  const [motionAllowed, setMotionAllowed] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setMotionAllowed(!query.matches);
    update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return <div className="combustion-stage" aria-label="Conceptual particle visualization of a combustion field. The animation is illustrative and does not show experimental measurements.">
    {webgl ? <Canvas dpr={[1, 1.25]} frameloop={paused || !motionAllowed ? "demand" : "always"} camera={{ position: [0, 0, 4.6], fov: 42 }} gl={{ antialias: false, powerPreference: "low-power", failIfMajorPerformanceCaveat: true }} onCreated={({ gl }) => { gl.domElement.setAttribute("role", "img"); gl.domElement.setAttribute("aria-label", "Illustrative combustion particle field, not NASA measurement data."); gl.domElement.addEventListener("webglcontextlost", () => setWebgl(false), { once: true }); }} fallback={<div className="combustion-fallback">Illustrative combustion field</div>}>
      <color attach="background" args={["#050a11"]} />
      <ambientLight intensity={0.8} />
      <CombustionParticles animate={!paused && motionAllowed} />
    </Canvas> : <div className="combustion-fallback"><div className="flame-glyph" aria-hidden="true">◌</div><span>ILLUSTRATIVE COMBUSTION FIELD</span></div>}
    <div className={`flame-cloud${paused || !motionAllowed ? " is-still" : ""}`} aria-hidden="true">{Array.from({ length: 64 }, (_, index) => { const angle = index * 2.399; const band = (index % 8) / 8; const spread = 8 + band * 37; const x = 50 + Math.cos(angle) * spread; const y = 50 + Math.sin(angle) * spread * 0.68; return <i key={index} style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${-(index % 13) * 0.21}s`, opacity: 0.35 + (index % 5) * 0.12 }} />; })}</div>
    <div className="stage-annotation stage-annotation-top"><span className="annotation-mark" /> PARTICLE TRANSPORT <small>CONCEPTUAL</small></div>
    <div className="stage-annotation stage-annotation-side"><span>OXYGEN FIELD</span><b>UNSPECIFIED</b></div>
    <div className="stage-caption"><span>ILLUSTRATIVE VISUALISATION · NOT NASA MEASUREMENT DATA</span><button type="button" onClick={() => setPaused((value) => !value)} aria-pressed={paused}>{paused ? "RESUME" : "PAUSE"}</button></div>
  </div>;
}
