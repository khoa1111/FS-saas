import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { Group } from "three";

let blobTexture: THREE.CanvasTexture | null = null;
function getBlobTexture() {
  if (!blobTexture) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
    g.addColorStop(0, "rgba(16, 22, 48, 0.5)");
    g.addColorStop(0.6, "rgba(16, 22, 48, 0.28)");
    g.addColorStop(1, "rgba(16, 22, 48, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    blobTexture = new THREE.CanvasTexture(c);
  }
  return blobTexture;
}

interface Props {
  color: string;
  name?: string;
  working?: string | null;
  bubble?: string | null;
  walking?: boolean;
}

/** Cute rounded robot: colored capsule body, dark visor, glowing eyes. */
export default function Character({ color, name, working, bubble, walking }: Props) {
  const body = useRef<Group>(null);
  const t = useRef(Math.random() * 10);

  useFrame((_, dt) => {
    t.current += dt * (walking ? 10 : 2.4);
    if (body.current) {
      body.current.position.y = 0.62 + Math.abs(Math.sin(t.current)) * (walking ? 0.09 : 0.03);
      body.current.rotation.z = walking ? Math.sin(t.current * 0.5) * 0.06 : 0;
    }
  });

  const blob = useMemo(getBlobTexture, []);

  return (
    <group>
      {/* grounding blob shadow */}
      <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.15, 1.15]} />
        <meshBasicMaterial map={blob} transparent depthWrite={false} />
      </mesh>
      <group ref={body} position={[0, 0.62, 0]}>
        {/* body */}
        <mesh castShadow>
          <capsuleGeometry args={[0.34, 0.42, 6, 16]} />
          <meshStandardMaterial color={color} roughness={0.32} envMapIntensity={0.9} />
        </mesh>
        {/* visor */}
        <mesh position={[0, 0.22, 0.24]} scale={[1, 0.72, 0.55]}>
          <sphereGeometry args={[0.26, 20, 16]} />
          <meshStandardMaterial color="#191b22" roughness={0.2} metalness={0.4} />
        </mesh>
        {/* eyes */}
        <mesh position={[-0.09, 0.24, 0.42]}>
          <sphereGeometry args={[0.035, 10, 10]} />
          <meshStandardMaterial color="#bfe0ff" emissive="#7fc4ff" emissiveIntensity={2.4} toneMapped={false} />
        </mesh>
        <mesh position={[0.09, 0.24, 0.42]}>
          <sphereGeometry args={[0.035, 10, 10]} />
          <meshStandardMaterial color="#bfe0ff" emissive="#7fc4ff" emissiveIntensity={2.4} toneMapped={false} />
        </mesh>
        {/* antenna */}
        <mesh position={[0, 0.58, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.18, 6]} />
          <meshStandardMaterial color="#191b22" />
        </mesh>
        <mesh position={[0, 0.7, 0]}>
          <sphereGeometry args={[0.05, 10, 10]} />
          <meshStandardMaterial color={working ? "#ff7a1a" : "#17b26a"} emissive={working ? "#ff7a1a" : "#17b26a"} emissiveIntensity={2} toneMapped={false} />
        </mesh>
      </group>

      {/* little shadow feet */}
      <mesh position={[-0.13, 0.09, 0]} castShadow>
        <sphereGeometry args={[0.09, 10, 10]} />
        <meshStandardMaterial color="#191b22" roughness={0.6} />
      </mesh>
      <mesh position={[0.13, 0.09, 0]} castShadow>
        <sphereGeometry args={[0.09, 10, 10]} />
        <meshStandardMaterial color="#191b22" roughness={0.6} />
      </mesh>

      {name && (
        <Html position={[0, 1.62, 0]} center zIndexRange={[5, 0]}>
          <div className="nametag" style={{ background: color }}>
            {name}
            {working ? " · busy" : ""}
          </div>
        </Html>
      )}
      {bubble && (
        <Html position={[0, 1.95, 0]} center zIndexRange={[6, 0]}>
          <div className="bubble">{bubble}</div>
        </Html>
      )}
    </group>
  );
}
