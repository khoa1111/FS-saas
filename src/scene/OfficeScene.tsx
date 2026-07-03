import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html, OrthographicCamera } from "@react-three/drei";
import * as THREE from "three";
import { useStore } from "../store";
import { myPlayerId, sendMove } from "../ws";
import { BOUNDS, ROOMS, SPAWN, nearestRoom } from "./layout";
import Character from "./Character";
import {
  CrmRoom, Desk, FinanceRoom, GamesRoom, HrRoom, Plant,
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

    // camera follow
    const cam = camRef.current;
    if (cam) {
      cam.position.set(pos.current.x + 16, 17, pos.current.y + 16);
      cam.lookAt(pos.current.x, 0.6, pos.current.y);
    }

    // interactable proximity
    const near = nearestRoom(pos.current.x, pos.current.y);
    if (near !== lastNear.current) {
      lastNear.current = near;
      setNearRoom(near);
    }
  });

  return (
    <>
      <OrthographicCamera ref={camRef} makeDefault zoom={44} position={[16, 17, 16]} near={-50} far={200} />
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
      {ids
        .map(Number)
        .filter((id) => id !== me)
        .map((id) => (
          <RemotePlayer key={id} id={id} />
        ))}
    </>
  );
}

/* ---------- room floor plates + chips ---------- */

function RoomPlates() {
  const user = useStore((s) => s.user)!;
  return (
    <>
      {ROOMS.map((r) => {
        const allowed = user.isAdmin || user.rooms.includes(r.id);
        return (
          <group key={r.id} position={[r.center[0], 0, r.center[1]]}>
            <mesh position={[0, 0.05, 0]} receiveShadow>
              <boxGeometry args={[r.size[0], 0.1, r.size[1]]} />
              <meshStandardMaterial color={r.tint} roughness={0.9} />
            </mesh>
            <Html position={[0, 3.1, 0]} center zIndexRange={[4, 0]}>
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
  const { scene } = useThree();
  useMemo(() => {
    scene.background = new THREE.Color("#0e1120");
    scene.fog = new THREE.Fog("#0e1120", 55, 95);
  }, [scene]);

  const roomPos = useMemo(() => {
    const m: Record<string, [number, number, number]> = {};
    for (const r of ROOMS) m[r.id] = [r.center[0], 0, r.center[1]];
    return m;
  }, []);

  return (
    <>
      <ambientLight intensity={0.75} />
      <directionalLight
        position={[14, 22, 8]}
        intensity={1.35}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={26}
        shadow-camera-bottom={-26}
      />
      <directionalLight position={[-10, 8, -14]} intensity={0.25} color="#8fa3ff" />

      {/* diorama platform */}
      <mesh position={[0, -0.65, 0]}>
        <boxGeometry args={[41.5, 1.3, 30.5]} />
        <meshStandardMaterial color="#171a28" roughness={0.9} />
      </mesh>
      <mesh position={[0, -0.05, -0.25]} receiveShadow>
        <boxGeometry args={[40, 0.12, 29.5]} />
        <meshStandardMaterial color="#e7e9f2" roughness={0.95} />
      </mesh>

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
      <Desk position={[-4.5, 0, 0]} rotation={0.8} />
      <Desk position={[4.5, 0, -1]} rotation={-0.8} />
      <Whiteboard position={[-1.5, 0, -5.5]} rotation={0.2} />
      <Plant position={[-8.5, 0, 2.5]} />
      <Plant position={[8.5, 0, 2.5]} />
      <Plant position={[-9, 0, -5]} />
      <Plant position={[9.5, 0, 11]} />

      <Player />
      <OtherPlayers />
    </>
  );
}
