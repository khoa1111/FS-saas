// Signature props for each room, built from primitives.
// Palette: keycap white bodies, charcoal details, cobalt + orange accents.

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const WHITE = "#f2f3f8";
const CHARCOAL = "#1d202b";
const STEEL = "#c8ccda";
const COBALT = "#2447f0";
const ORANGE = "#f2661f";

/* ---------- Finance: wall of animated market screens ---------- */

function StockScreen({ color, w = 2.6, h = 1.5 }: { color: string; w?: number; h?: number }) {
  const { canvas, ctx, texture, values } = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 148;
    const ctx = canvas.getContext("2d")!;
    const texture = new THREE.CanvasTexture(canvas);
    const values = Array.from({ length: 48 }, () => 40 + Math.random() * 40);
    return { canvas, ctx, texture, values };
  }, []);
  const frame = useRef(0);

  useFrame(() => {
    frame.current++;
    if (frame.current % 5 !== 0) return;
    values.push(Math.max(14, Math.min(120, values[values.length - 1] + (Math.random() - 0.48) * 14)));
    values.shift();
    // dark chart surface #171922 with validated dark-mode series colors
    ctx.fillStyle = "#171922";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1;
    for (let y = 24; y < canvas.height; y += 26) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    const step = canvas.width / (values.length - 1);
    ctx.beginPath();
    values.forEach((v, i) => {
      const x = i * step;
      const y = canvas.height - v;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.lineTo(canvas.width, canvas.height);
    ctx.lineTo(0, canvas.height);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, color + "55");
    g.addColorStop(1, color + "00");
    ctx.fillStyle = g;
    ctx.fill();
    const last = values[values.length - 1];
    const delta = last - values[values.length - 2];
    ctx.font = "700 13px monospace";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(last.toFixed(2), 10, 20);
    ctx.fillStyle = delta >= 0 ? "#28d17c" : "#ff6a6a";
    ctx.fillText((delta >= 0 ? "▲ " : "▼ ") + Math.abs(delta).toFixed(2), 70, 20);
    texture.needsUpdate = true;
  });

  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[w + 0.16, h + 0.16, 0.1]} />
        <meshStandardMaterial color={CHARCOAL} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.06]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function FinanceRoom({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* three big angled screens facing the camera */}
      <group position={[-1.2, 1.6, -2.6]} rotation={[0, 0.5, 0]}>
        <StockScreen color="#4d6bff" />
        <mesh position={[0, -0.95, 0]}>
          <boxGeometry args={[0.14, 0.5, 0.14]} />
          <meshStandardMaterial color={STEEL} />
        </mesh>
      </group>
      <group position={[-2.6, 1.5, 0.6]} rotation={[0, 0.9, 0]}>
        <StockScreen color="#d95926" w={2.2} h={1.3} />
        <mesh position={[0, -0.85, 0]}>
          <boxGeometry args={[0.14, 0.5, 0.14]} />
          <meshStandardMaterial color={STEEL} />
        </mesh>
      </group>
      <group position={[1.4, 1.5, -0.6]} rotation={[0, 0.2, 0]}>
        <StockScreen color="#28d17c" w={2.0} h={1.2} />
        <mesh position={[0, -0.8, 0]}>
          <boxGeometry args={[0.14, 0.5, 0.14]} />
          <meshStandardMaterial color={STEEL} />
        </mesh>
      </group>
      {/* trader desk */}
      <mesh position={[0, 0.42, 1.6]} castShadow>
        <boxGeometry args={[2.4, 0.12, 1]} />
        <meshStandardMaterial color={WHITE} />
      </mesh>
      <mesh position={[-1, 0.2, 1.6]}>
        <boxGeometry args={[0.12, 0.42, 0.8]} />
        <meshStandardMaterial color={STEEL} />
      </mesh>
      <mesh position={[1, 0.2, 1.6]}>
        <boxGeometry args={[0.12, 0.42, 0.8]} />
        <meshStandardMaterial color={STEEL} />
      </mesh>
    </group>
  );
}

/* ---------- Documents: the big vault ---------- */

export function VaultRoom({ position }: { position: [number, number, number] }) {
  const wheel = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (wheel.current) wheel.current.rotation.z += dt * 0.3;
  });
  return (
    <group position={position}>
      <mesh position={[0, 1.5, -1]} castShadow>
        <boxGeometry args={[3.4, 3, 2.2]} />
        <meshStandardMaterial color={STEEL} metalness={0.55} roughness={0.35} />
      </mesh>
      {/* door */}
      <mesh position={[0, 1.4, 0.14]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[1.05, 1.05, 0.22, 32]} />
        <meshStandardMaterial color="#aeb4c6" metalness={0.65} roughness={0.3} />
      </mesh>
      {/* handle wheel */}
      <group ref={wheel} position={[0, 1.4, 0.36]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.42, 0.055, 10, 24]} />
          <meshStandardMaterial color={CHARCOAL} metalness={0.5} />
        </mesh>
        {[0, Math.PI / 3, (2 * Math.PI) / 3].map((a, i) => (
          <mesh key={i} rotation={[0, 0, a]}>
            <boxGeometry args={[0.84, 0.06, 0.06]} />
            <meshStandardMaterial color={CHARCOAL} metalness={0.5} />
          </mesh>
        ))}
      </group>
      {/* hinges + keypad */}
      <mesh position={[1.15, 1.4, 0.16]}>
        <boxGeometry args={[0.18, 1.6, 0.16]} />
        <meshStandardMaterial color={CHARCOAL} />
      </mesh>
      <mesh position={[-1.25, 1.7, 0.18]}>
        <boxGeometry args={[0.34, 0.44, 0.06]} />
        <meshStandardMaterial color={COBALT} emissive={COBALT} emissiveIntensity={0.4} />
      </mesh>
      {/* document boxes stacked beside */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[2.2, 0.28 + i * 0.42, -0.7 + i * 0.1]} rotation={[0, i * 0.25, 0]} castShadow>
          <boxGeometry args={[0.8, 0.38, 0.6]} />
          <meshStandardMaterial color={i === 1 ? ORANGE : WHITE} />
        </mesh>
      ))}
    </group>
  );
}

/* ---------- HR: check-in machine ---------- */

export function HrRoom({ position }: { position: [number, number, number] }) {
  const light = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (light.current) light.current.emissiveIntensity = 1.2 + Math.sin(clock.elapsedTime * 3) * 0.8;
  });
  return (
    <group position={position}>
      {/* kiosk */}
      <mesh position={[0, 0.75, 0]} castShadow>
        <boxGeometry args={[0.9, 1.5, 0.5]} />
        <meshStandardMaterial color={WHITE} />
      </mesh>
      <mesh position={[0, 1.42, 0.18]} rotation={[-0.5, 0, 0]}>
        <boxGeometry args={[0.7, 0.5, 0.06]} />
        <meshStandardMaterial color={CHARCOAL} />
      </mesh>
      <mesh position={[0, 1.44, 0.22]} rotation={[-0.5, 0, 0]}>
        <planeGeometry args={[0.6, 0.38]} />
        <meshStandardMaterial color={COBALT} emissive={COBALT} emissiveIntensity={0.7} />
      </mesh>
      <mesh position={[0, 0.95, 0.28]}>
        <sphereGeometry args={[0.05, 10, 10]} />
        <meshStandardMaterial ref={light} color="#17b26a" emissive="#17b26a" emissiveIntensity={1.5} />
      </mesh>
      {/* card slot */}
      <mesh position={[0, 0.72, 0.27]}>
        <boxGeometry args={[0.4, 0.05, 0.05]} />
        <meshStandardMaterial color={ORANGE} />
      </mesh>
      {/* bench */}
      <mesh position={[-1.8, 0.3, 0.4]} castShadow>
        <boxGeometry args={[1.6, 0.14, 0.6]} />
        <meshStandardMaterial color={ORANGE} />
      </mesh>
      {[-2.4, -1.2].map((x) => (
        <mesh key={x} position={[x, 0.13, 0.4]}>
          <boxGeometry args={[0.1, 0.28, 0.5]} />
          <meshStandardMaterial color={CHARCOAL} />
        </mesh>
      ))}
    </group>
  );
}

/* ---------- Projects: treadmills ---------- */

function Treadmill({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  const stripes = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!stripes.current) return;
    stripes.current.children.forEach((c) => {
      c.position.z -= dt * 1.4;
      if (c.position.z < -0.75) c.position.z += 1.5;
    });
  });
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.16, 0]} castShadow>
        <boxGeometry args={[0.9, 0.22, 2]} />
        <meshStandardMaterial color={WHITE} />
      </mesh>
      <mesh position={[0, 0.29, 0]}>
        <boxGeometry args={[0.7, 0.04, 1.7]} />
        <meshStandardMaterial color={CHARCOAL} />
      </mesh>
      <group ref={stripes} position={[0, 0.32, 0]}>
        {[-0.6, -0.1, 0.4].map((z, i) => (
          <mesh key={i} position={[0, 0, z]}>
            <boxGeometry args={[0.66, 0.012, 0.08]} />
            <meshStandardMaterial color="#3a3f52" />
          </mesh>
        ))}
      </group>
      {/* rails + console */}
      {[-0.42, 0.42].map((x) => (
        <mesh key={x} position={[x, 0.7, -0.72]} rotation={[0.35, 0, 0]}>
          <boxGeometry args={[0.06, 0.9, 0.06]} />
          <meshStandardMaterial color={STEEL} />
        </mesh>
      ))}
      <mesh position={[0, 1.12, -0.86]} rotation={[-0.4, 0, 0]}>
        <boxGeometry args={[0.9, 0.3, 0.07]} />
        <meshStandardMaterial color={CHARCOAL} />
      </mesh>
      <mesh position={[0, 1.13, -0.82]} rotation={[-0.4, 0, 0]}>
        <planeGeometry args={[0.7, 0.18]} />
        <meshStandardMaterial color={ORANGE} emissive={ORANGE} emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}

export function ProjectsRoom({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <Treadmill position={[-1.3, 0, -0.2]} />
      <Treadmill position={[0, 0, -0.2]} />
      <Treadmill position={[1.3, 0, -0.2]} />
      {/* kanban board on the back */}
      <group position={[2.9, 1.3, -1.4]} rotation={[0, -0.6, 0]}>
        <mesh castShadow>
          <boxGeometry args={[2, 1.3, 0.08]} />
          <meshStandardMaterial color={WHITE} />
        </mesh>
        {[-0.6, 0, 0.6].map((x, col) => (
          <group key={col}>
            {[0.3, 0, -0.3].slice(0, 3 - col).map((y, i) => (
              <mesh key={i} position={[x, y + 0.1, 0.05]}>
                <planeGeometry args={[0.44, 0.2]} />
                <meshStandardMaterial color={[COBALT, ORANGE, "#17b26a"][(col + i) % 3]} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    </group>
  );
}

/* ---------- Workflow: conveyor belts ---------- */

export function WorkflowRoom({ position }: { position: [number, number, number] }) {
  const boxes = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!boxes.current) return;
    boxes.current.children.forEach((c) => {
      c.position.x += dt * 0.9;
      if (c.position.x > 2.6) c.position.x = -2.6;
    });
  });
  return (
    <group position={position}>
      {[-1.1, 1.1].map((z, i) => (
        <group key={i} position={[0, 0, z]}>
          <mesh position={[0, 0.5, 0]} castShadow>
            <boxGeometry args={[5.6, 0.16, 1]} />
            <meshStandardMaterial color={CHARCOAL} />
          </mesh>
          <mesh position={[0, 0.59, 0]}>
            <boxGeometry args={[5.4, 0.03, 0.8]} />
            <meshStandardMaterial color="#3a3f52" />
          </mesh>
          {[-2.2, 0, 2.2].map((x) => (
            <mesh key={x} position={[x, 0.24, 0]}>
              <boxGeometry args={[0.16, 0.5, 0.8]} />
              <meshStandardMaterial color={STEEL} />
            </mesh>
          ))}
          {/* glowing scanner arch */}
          <mesh position={[i === 0 ? -1 : 1, 0.86, 0]}>
            <boxGeometry args={[0.14, 0.6, 1.2]} />
            <meshStandardMaterial color={COBALT} emissive={COBALT} emissiveIntensity={0.9} />
          </mesh>
        </group>
      ))}
      <group ref={boxes}>
        {[-2, -0.5, 1, 2.3].map((x, i) => (
          <mesh key={i} position={[x, 0.75, i % 2 === 0 ? -1.1 : 1.1]} castShadow>
            <boxGeometry args={[0.42, 0.34, 0.42]} />
            <meshStandardMaterial color={i % 3 === 0 ? ORANGE : i % 3 === 1 ? WHITE : COBALT} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/* ---------- CRM: folders & files lounge ---------- */

export function CrmRoom({ position }: { position: [number, number, number] }) {
  const folderColors = [COBALT, ORANGE, "#17b26a", "#7b5cff", "#e8b114"];
  return (
    <group position={position}>
      {/* shelf rack */}
      <mesh position={[1, 1.25, -0.8]} castShadow>
        <boxGeometry args={[0.5, 2.5, 3]} />
        <meshStandardMaterial color={WHITE} />
      </mesh>
      {[0.5, 1.15, 1.8].map((y, row) => (
        <group key={row}>
          {[-1.7, -1.1, -0.5, 0.1, 0.7].map((z, i) => (
            <mesh key={i} position={[0.68, y, z - 0.3]} rotation={[0, 0, 0.06 * ((i + row) % 3)]}>
              <boxGeometry args={[0.1, 0.5, 0.36]} />
              <meshStandardMaterial color={folderColors[(i + row) % folderColors.length]} />
            </mesh>
          ))}
        </group>
      ))}
      {/* reading table with files */}
      <mesh position={[-1.2, 0.5, 0.6]} castShadow>
        <cylinderGeometry args={[0.9, 0.9, 0.08, 24]} />
        <meshStandardMaterial color={WHITE} />
      </mesh>
      <mesh position={[-1.2, 0.25, 0.6]}>
        <cylinderGeometry args={[0.12, 0.16, 0.42, 12]} />
        <meshStandardMaterial color={CHARCOAL} />
      </mesh>
      <mesh position={[-1.4, 0.58, 0.5]} rotation={[0, 0.4, 0]}>
        <boxGeometry args={[0.4, 0.06, 0.3]} />
        <meshStandardMaterial color={ORANGE} />
      </mesh>
      <mesh position={[-1, 0.58, 0.75]} rotation={[0, -0.3, 0]}>
        <boxGeometry args={[0.4, 0.06, 0.3]} />
        <meshStandardMaterial color={COBALT} />
      </mesh>
    </group>
  );
}

/* ---------- Games: arcade corner ---------- */

export function GamesRoom({ position }: { position: [number, number, number] }) {
  const glow = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (glow.current) {
      const t = clock.elapsedTime;
      glow.current.emissiveIntensity = 0.9 + Math.sin(t * 2.4) * 0.4;
    }
  });
  return (
    <group position={position}>
      {/* game table */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[2, 0.14, 1.3]} />
        <meshStandardMaterial color={CHARCOAL} />
      </mesh>
      <mesh position={[0, 0.585, 0]}>
        <planeGeometry args={[1.7, 1]} />
        <meshStandardMaterial ref={glow} color={COBALT} emissive={COBALT} emissiveIntensity={1} />
      </mesh>
      {[-0.85, 0.85].map((x) => (
        <mesh key={x} position={[x, 0.25, 0]}>
          <boxGeometry args={[0.14, 0.5, 1.1]} />
          <meshStandardMaterial color={STEEL} />
        </mesh>
      ))}
      {/* stools */}
      {[
        [-1.5, 0],
        [1.5, 0],
        [0, 1.2],
        [0, -1.2]
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.36, 0]} castShadow>
            <cylinderGeometry args={[0.26, 0.26, 0.08, 16]} />
            <meshStandardMaterial color={i % 2 ? ORANGE : WHITE} />
          </mesh>
          <mesh position={[0, 0.16, 0]}>
            <cylinderGeometry args={[0.06, 0.09, 0.32, 10]} />
            <meshStandardMaterial color={CHARCOAL} />
          </mesh>
        </group>
      ))}
      {/* arcade cabinet */}
      <group position={[2.8, 0, -0.8]} rotation={[0, -0.7, 0]}>
        <mesh position={[0, 0.85, 0]} castShadow>
          <boxGeometry args={[0.8, 1.7, 0.7]} />
          <meshStandardMaterial color={ORANGE} />
        </mesh>
        <mesh position={[0, 1.15, 0.32]} rotation={[-0.25, 0, 0]}>
          <planeGeometry args={[0.6, 0.5]} />
          <meshStandardMaterial color="#171922" emissive={"#4d6bff"} emissiveIntensity={0.6} />
        </mesh>
        <mesh position={[0, 0.72, 0.38]}>
          <boxGeometry args={[0.6, 0.1, 0.2]} />
          <meshStandardMaterial color={WHITE} />
        </mesh>
      </group>
    </group>
  );
}

/* ---------- Center decor: desks, gate, plants ---------- */

export function Desk({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[1.8, 0.1, 0.9]} />
        <meshStandardMaterial color="#b98d5f" roughness={0.7} />
      </mesh>
      {[-0.8, 0.8].map((x) => (
        <mesh key={x} position={[x, 0.27, 0]}>
          <boxGeometry args={[0.1, 0.55, 0.8]} />
          <meshStandardMaterial color={CHARCOAL} />
        </mesh>
      ))}
      {/* dual monitors */}
      {[-0.4, 0.42].map((x, i) => (
        <group key={i} position={[x, 0.86, -0.16]} rotation={[0, i === 0 ? 0.12 : -0.12, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.66, 0.42, 0.05]} />
            <meshStandardMaterial color={CHARCOAL} />
          </mesh>
          <mesh position={[0, 0, 0.03]}>
            <planeGeometry args={[0.58, 0.34]} />
            <meshStandardMaterial color="#171922" emissive={i === 0 ? "#4d6bff" : "#d95926"} emissiveIntensity={0.55} />
          </mesh>
        </group>
      ))}
      <mesh position={[0.75, 0.66, 0.25]}>
        <cylinderGeometry args={[0.06, 0.05, 0.12, 10]} />
        <meshStandardMaterial color={WHITE} />
      </mesh>
    </group>
  );
}

export function SecurityGate({ position }: { position: [number, number, number] }) {
  const beam = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (beam.current) beam.current.emissiveIntensity = 0.8 + Math.sin(clock.elapsedTime * 4) * 0.5;
  });
  return (
    <group position={position}>
      {[-0.9, 0.9].map((x) => (
        <mesh key={x} position={[x, 0.65, 0]} castShadow>
          <boxGeometry args={[0.26, 1.3, 0.5]} />
          <meshStandardMaterial color={STEEL} metalness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[1.56, 0.06, 0.06]} />
        <meshStandardMaterial ref={beam} color={ORANGE} emissive={ORANGE} emissiveIntensity={1} />
      </mesh>
      {[-0.9, 0.9].map((x) => (
        <mesh key={`t${x}`} position={[x, 1.34, 0]}>
          <boxGeometry args={[0.3, 0.08, 0.54]} />
          <meshStandardMaterial color={CHARCOAL} />
        </mesh>
      ))}
    </group>
  );
}

export function Plant({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.28, 0.44, 12]} />
        <meshStandardMaterial color={WHITE} />
      </mesh>
      <mesh position={[0, 0.62, 0]}>
        <sphereGeometry args={[0.32, 12, 12]} />
        <meshStandardMaterial color="#2e9e5b" roughness={0.8} />
      </mesh>
      <mesh position={[0.14, 0.85, 0.05]}>
        <sphereGeometry args={[0.2, 10, 10]} />
        <meshStandardMaterial color="#3cb56d" roughness={0.8} />
      </mesh>
    </group>
  );
}

/* ---------- Whiteboard (center, decor like the reference) ---------- */

export function Whiteboard({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 1.4, 0]} castShadow>
        <boxGeometry args={[2.6, 1.5, 0.08]} />
        <meshStandardMaterial color="#fafbff" />
      </mesh>
      <mesh position={[0, 1.4, 0.05]}>
        <planeGeometry args={[2.4, 1.3]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      {/* scribbles */}
      <mesh position={[-0.6, 1.7, 0.06]}>
        <planeGeometry args={[0.9, 0.08]} />
        <meshStandardMaterial color={COBALT} />
      </mesh>
      <mesh position={[-0.45, 1.5, 0.06]}>
        <planeGeometry args={[1.2, 0.06]} />
        <meshStandardMaterial color={STEEL} />
      </mesh>
      <mesh position={[0.55, 1.25, 0.06]}>
        <planeGeometry args={[0.7, 0.5]} />
        <meshStandardMaterial color={"#ffd9c2"} />
      </mesh>
      <mesh position={[-0.55, 1.15, 0.06]}>
        <planeGeometry args={[0.8, 0.06]} />
        <meshStandardMaterial color={ORANGE} />
      </mesh>
      {[-1.1, 1.1].map((x) => (
        <mesh key={x} position={[x, 0.35, 0]}>
          <boxGeometry args={[0.08, 0.75, 0.08]} />
          <meshStandardMaterial color={CHARCOAL} />
        </mesh>
      ))}
    </group>
  );
}
