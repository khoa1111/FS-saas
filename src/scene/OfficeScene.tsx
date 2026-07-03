import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Html, Lightformer, OrthographicCamera, RoundedBox } from "@react-three/drei";
import { EffectComposer, Bloom, BrightnessContrast, N8AO, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { useStore } from "../store";
import { myPlayerId, sendMove } from "../ws";
import { BOUNDS, ROOMS, SPAWN, nearestRoom } from "./layout";
import Character from "./Character";
import {
  CoffeeBar, CrmRoom, Desk, FinanceRoom, GamesRoom, HrRoom, Lounge, Plant,
  ProjectsRoom, SecurityGate, VaultRoom, WorkflowRoom, Whiteboard
} from "./Props";

/* ---------- keyboard ---------- */

const keys = new Set<string>();
function useKeyboard() {
  useEffect(() => {
    const isTyping = () => {
      const el = document.activeElement;
      return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
    };
    const down = (e: KeyboardEvent) => {
      if (isTyping()) return;
      keys.add(e.key.toLowerCase());
    };
    const up = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    const blur = () => keys.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);
}

/* ---------- self-controlled player ---------- */

// Screen-relative directions for the isometric camera at (+x, +y, +z):
const UP = new THREE.Vector2(-0.7071, -0.7071);
const RIGHT = new THREE.Vector2(0.7071, -0.7071);

function Player() {
  useKeyboard();
  const user = useStore((s) => s.user)!;
  const openApp = useStore((s) => s.openApp);
  const bubble = useStore((s) => s.bubbles[user.id]);
  const setNearRoom = useStore((s) => s.setNearRoom);

  const group = useRef<THREE.Group>(null);
  const camRef = useRef<THREE.OrthographicCamera>(null);
  const pos = useRef(new THREE.Vector2(SPAWN[0], SPAWN[1]));
  const heading = useRef(0);
  const walking = useRef(false);
  const lastNear = useRef<string | null>(null);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;

    const move = new THREE.Vector2(0, 0);
    if (!openApp) {
      const u = (keys.has("w") || keys.has("arrowup") ? 1 : 0) - (keys.has("s") || keys.has("arrowdown") ? 1 : 0);
      const r = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
      move.addScaledVector(UP, u).addScaledVector(RIGHT, r);
    }

    walking.current = move.lengthSq() > 0.001;
    if (walking.current) {
      move.normalize().multiplyScalar(dt * 5.2);
      pos.current.add(move);
      pos.current.x = THREE.MathUtils.clamp(pos.current.x, BOUNDS.minX, BOUNDS.maxX);
      pos.current.y = THREE.MathUtils.clamp(pos.current.y, BOUNDS.minZ, BOUNDS.maxZ);
      heading.current = Math.atan2(move.x, move.y);
      sendMove(pos.current.x, pos.current.y, heading.current);
    }

    g.position.set(pos.current.x, 0, pos.current.y);
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, heading.current, Math.min(1, dt * 12));

    const cam = camRef.current;
    if (cam) {
      cam.position.set(pos.current.x + 16, 17, pos.current.y + 16);
      cam.lookAt(pos.current.x, 0.6, pos.current.y);
    }

    const near = nearestRoom(pos.current.x, pos.current.y);
    if (near !== lastNear.current) {
      lastNear.current = near;
      setNearRoom(near);
    }
  });

  return (
    <>
      <OrthographicCamera ref={camRef} makeDefault zoom={42} position={[16, 17, 16]} near={-50} far={200} />
      <group ref={group}>
        <Character
          color={user.color}
          working={openApp}
          bubble={bubble?.text ?? null}
          walking={walking.current}
        />
      </group>
    </>
  );
}

/* ---------- remote players ---------- */

function RemotePlayer({ id }: { id: number }) {
  const player = useStore((s) => s.players[id]);
  const bubble = useStore((s) => s.bubbles[id]);
  const group = useRef<THREE.Group>(null);
  const walking = useRef(false);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g || !player) return;
    const k = Math.min(1, dt * 10);
    const dx = player.x - g.position.x;
    const dz = player.z - g.position.z;
    walking.current = Math.hypot(dx, dz) > 0.05;
    g.position.x += dx * k;
    g.position.z += dz * k;
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, player.ry, k);
  });

  if (!player) return null;
  return (
    <group ref={group} position={[player.x, 0, player.z]}>
      <Character
        color={player.color}
        name={player.name}
        working={player.room}
        bubble={bubble?.text ?? null}
        walking={walking.current}
      />
    </group>
  );
}

function OtherPlayers() {
  const ids = useStore((s) => Object.keys(s.players));
  const me = myPlayerId();
  return (
    <>
      {ids.map(Number).filter((id) => id !== me).map((id) => <RemotePlayer key={id} id={id} />)}
    </>
  );
}

/* ---------- architectural shell ---------- */

function useGridTexture() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#e7eaf3";
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = "rgba(80, 90, 130, 0.22)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0.75, 0.75, 255, 255);
    ctx.strokeStyle = "rgba(80, 90, 130, 0.08)";
    for (let i = 64; i < 256; i += 64) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(20, 15);
    tex.anisotropy = 8;
    return tex;
  }, []);
}

function useSignTexture() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 256;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#12141f";
    ctx.fillRect(0, 0, 1024, 256);
    ctx.fillStyle = "#f2661f";
    ctx.fillRect(46, 92, 14, 72);
    ctx.font = "900 104px 'Archivo Black', 'Arial Black', sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "middle";
    ctx.fillText("FELIC STUDIO", 92, 132);
    ctx.font = "500 26px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#7e86a3";
    ctx.fillText("S T A N D A R D   I N D U S T R Y   O S", 96, 208);
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 8;
    return tex;
  }, []);
}

function Floor() {
  const grid = useGridTexture();
  return (
    <group>
      {/* plinth */}
      <RoundedBox args={[42.5, 1.4, 31.5]} radius={0.35} position={[0, -0.78, -0.25]} receiveShadow>
        <meshStandardMaterial color="#141726" roughness={0.85} />
      </RoundedBox>
      {/* floor slab */}
      <mesh position={[0, -0.04, -0.25]} receiveShadow>
        <boxGeometry args={[41, 0.14, 30]} />
        <meshStandardMaterial map={grid} roughness={0.75} metalness={0.02} envMapIntensity={0.5} />
      </mesh>
    </group>
  );
}

function Walls() {
  const sign = useSignTexture();
  const windowMat = (
    <meshStandardMaterial color="#aec4ff" emissive="#8fb0ff" emissiveIntensity={0.5} roughness={0.2} metalness={0.1} />
  );
  return (
    <group>
      {/* north wall (z = -15) */}
      <group position={[0, 0, -15.2]}>
        <mesh position={[0, 2.1, 0]} receiveShadow castShadow>
          <boxGeometry args={[41, 4.2, 0.45]} />
          <meshStandardMaterial color="#f0f1f7" roughness={0.9} />
        </mesh>
        {/* charcoal base strip */}
        <mesh position={[0, 0.35, 0.24]}>
          <boxGeometry args={[41, 0.7, 0.04]} />
          <meshStandardMaterial color="#1a1d2c" roughness={0.6} />
        </mesh>
        {/* orange top trim */}
        <mesh position={[0, 4.14, 0.24]}>
          <boxGeometry args={[41, 0.1, 0.04]} />
          <meshStandardMaterial color="#f2661f" emissive="#f2661f" emissiveIntensity={1.6} />
        </mesh>
        {/* windows */}
        {[-13, -6.5, 6.5, 13].map((x) => (
          <group key={x} position={[x, 2.35, 0.24]}>
            <mesh>
              <boxGeometry args={[3.6, 2.2, 0.06]} />
              <meshStandardMaterial color="#1a1d2c" roughness={0.5} />
            </mesh>
            <mesh position={[0, 0, 0.04]}>
              <planeGeometry args={[3.3, 1.9]} />
              {windowMat}
            </mesh>
            <mesh position={[0, 0, 0.06]}>
              <boxGeometry args={[0.06, 1.9, 0.02]} />
              <meshStandardMaterial color="#1a1d2c" />
            </mesh>
          </group>
        ))}
        {/* studio sign */}
        <mesh position={[0, 2.6, 0.26]}>
          <planeGeometry args={[6.8, 1.7]} />
          <meshBasicMaterial map={sign} toneMapped={false} />
        </mesh>
      </group>

      {/* west wall (x = -21) */}
      <group position={[-20.9, 0, -0.25]} rotation={[0, Math.PI / 2, 0]}>
        <mesh position={[0, 2.1, 0]} receiveShadow castShadow>
          <boxGeometry args={[30, 4.2, 0.45]} />
          <meshStandardMaterial color="#eceef5" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.35, 0.24]}>
          <boxGeometry args={[30, 0.7, 0.04]} />
          <meshStandardMaterial color="#1a1d2c" roughness={0.6} />
        </mesh>
        <mesh position={[0, 4.14, 0.24]}>
          <boxGeometry args={[30, 0.1, 0.04]} />
          <meshStandardMaterial color="#4d6bff" emissive="#4d6bff" emissiveIntensity={1.6} />
        </mesh>
        {[-9, 0, 9].map((x) => (
          <group key={x} position={[x, 2.35, 0.24]}>
            <mesh>
              <boxGeometry args={[3.6, 2.2, 0.06]} />
              <meshStandardMaterial color="#1a1d2c" roughness={0.5} />
            </mesh>
            <mesh position={[0, 0, 0.04]}>
              <planeGeometry args={[3.3, 1.9]} />
              {windowMat}
            </mesh>
          </group>
        ))}
        {/* poster frames */}
        {[[-13.2, "#f2661f"], [13.2, "#7b5cff"]].map(([x, col]) => (
          <group key={String(x)} position={[Number(x), 2.3, 0.26]}>
            <mesh>
              <boxGeometry args={[1.5, 2, 0.06]} />
              <meshStandardMaterial color="#ffffff" roughness={0.6} />
            </mesh>
            <mesh position={[0, 0, 0.04]}>
              <planeGeometry args={[1.26, 1.76]} />
              <meshStandardMaterial color={String(col)} roughness={0.5} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

/* ---------- room carpets, glow rails, ceiling bars, chips ---------- */

function RoomPlates() {
  const user = useStore((s) => s.user)!;
  return (
    <>
      {ROOMS.map((r) => {
        const allowed = user.isAdmin || user.rooms.includes(r.id);
        const [w, d] = r.size;
        // glow rail on the edge facing away from camera (back-left of each room)
        const railAlongX = Math.abs(r.center[1]) > Math.abs(r.center[0]); // rooms on north/south edges
        return (
          <group key={r.id} position={[r.center[0], 0, r.center[1]]}>
            {/* carpet */}
            <RoundedBox args={[w, 0.1, d]} radius={0.05} position={[0, 0.06, 0]} receiveShadow>
              <meshStandardMaterial color={r.tint} roughness={0.95} />
            </RoundedBox>
            {/* accent glow rail */}
            <mesh
              position={railAlongX ? [0, 0.1, -d / 2 + 0.08] : [-w / 2 + 0.08, 0.1, 0]}
              rotation={railAlongX ? [0, 0, 0] : [0, Math.PI / 2, 0]}
            >
              <boxGeometry args={[w - 0.5, 0.06, 0.09]} />
              <meshStandardMaterial color={r.accent} emissive={r.accent} emissiveIntensity={2.2} toneMapped={false} />
            </mesh>
            <Html position={[0, 2.5, 0]} center zIndexRange={[4, 0]}>
              <div className="chip3d">
                <span className={`dot ${allowed ? "green" : "red"}`} />
                <span className="t">{r.label}</span>
                <span className="s">{allowed ? r.sub : "no access"}</span>
              </div>
            </Html>
          </group>
        );
      })}
    </>
  );
}

/* ---------- scene ---------- */

export default function OfficeScene() {
  const { scene, gl } = useThree();
  useMemo(() => {
    scene.background = new THREE.Color("#0a0d1c");
    scene.fog = new THREE.Fog("#0a0d1c", 58, 100);
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.0;
  }, [scene, gl]);

  const roomPos = useMemo(() => {
    const m: Record<string, [number, number, number]> = {};
    for (const r of ROOMS) m[r.id] = [r.center[0], 0, r.center[1]];
    return m;
  }, []);

  return (
    <>
      <ambientLight intensity={0.2} />
      <hemisphereLight args={["#cfd8ff", "#232741", 0.22]} />
      <directionalLight
        position={[14, 22, 10]}
        intensity={1.55}
        color="#fff2e0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-27}
        shadow-camera-right={27}
        shadow-camera-top={27}
        shadow-camera-bottom={-27}
        shadow-bias={-0.0002}
        shadow-normalBias={0.02}
      />
      <directionalLight position={[-12, 9, -14]} intensity={0.25} color="#8fa3ff" />

      <Environment resolution={128} frames={1}>
        <Lightformer intensity={1.0} position={[0, 10, 0]} scale={[12, 12, 1]} rotation-x={Math.PI / 2} color="#ffffff" />
        <Lightformer intensity={0.5} position={[-10, 5, -8]} scale={[10, 4, 1]} color="#b7c6ff" />
        <Lightformer intensity={0.6} position={[10, 5, 8]} rotation-y={Math.PI} scale={[10, 4, 1]} color="#ffd9b8" />
      </Environment>

      <Floor />
      <Walls />
      <ContactShadows
        position={[0, 0.045, -0.25]}
        scale={[44, 33]}
        opacity={0.62}
        blur={1.7}
        far={10}
        resolution={1024}
        frames={Infinity}
        color="#1a2140"
      />
      <RoomPlates />

      <FinanceRoom position={roomPos.finance} />
      <VaultRoom position={roomPos.documents} />
      <HrRoom position={roomPos.hr} />
      <ProjectsRoom position={roomPos.projects} />
      <WorkflowRoom position={roomPos.workflow} />
      <CrmRoom position={roomPos.crm} />
      <GamesRoom position={roomPos.games} />

      {/* center decor */}
      <SecurityGate position={[0, 0, 5.4]} />
      <Lounge position={[5.6, 0, 3.2]} rotation={-0.35} />
      <CoffeeBar position={[-8.2, 0, 8]} rotation={0.5} />
      <Desk position={[-5.2, 0, -1.2]} rotation={Math.PI / 2} />
      <Desk position={[-5.2, 0, 1.2]} rotation={-Math.PI / 2} />
      <Desk position={[-8.2, 0, -1.2]} rotation={Math.PI / 2} />
      <Desk position={[-8.2, 0, 1.2]} rotation={-Math.PI / 2} />
      <Whiteboard position={[-2, 0, -6]} rotation={0.2} />
      <Plant position={[-10.5, 0, 0]} />
      <Plant position={[2.8, 0, 5.8]} />
      <Plant position={[-2.9, 0, 5.8]} />
      <Plant position={[9.5, 0, 11]} />
      <Plant position={[-19.3, 0, -13.4]} />
      <Plant position={[18.5, 0, 12.3]} />

      <Player />
      <OtherPlayers />

      <EffectComposer multisampling={0}>
        <N8AO halfRes intensity={2.2} aoRadius={1.3} distanceFalloff={1} quality="performance" />
        <Bloom mipmapBlur intensity={0.5} luminanceThreshold={1.1} luminanceSmoothing={0.2} />
        <BrightnessContrast brightness={0.01} contrast={0.11} />
        <Vignette eskil={false} offset={0.1} darkness={0.5} />
      </EffectComposer>
    </>
  );
}
