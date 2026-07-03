import { Suspense, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { useStore } from "./store";
import { sendWork } from "./ws";
import { ROOM_LABELS } from "../shared/types";
import OfficeScene from "./scene/OfficeScene";
import Hud from "./hud/Hud";
import WindowOverlay from "./windows/WindowOverlay";

export default function Office() {
  const user = useStore((s) => s.user)!;
  const openApp = useStore((s) => s.openApp);
  const setOpenApp = useStore((s) => s.setOpenApp);
  const nearRoom = useStore((s) => s.nearRoom);
  const showToast = useStore((s) => s.showToast);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;

      if (e.key === "Escape" && openApp) {
        setOpenApp(null);
        sendWork(null);
        return;
      }
      if ((e.key === "e" || e.key === "E") && !openApp && nearRoom) {
        const allowed = user.isAdmin || user.rooms.includes(nearRoom);
        if (!allowed) {
          showToast(`Access denied — ask an admin for ${ROOM_LABELS[nearRoom]}`);
          return;
        }
        setOpenApp(nearRoom);
        sendWork(nearRoom);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openApp, nearRoom, user, setOpenApp, showToast]);

  return (
    <>
      <div className={`stage ${openApp ? "blurred" : ""}`}>
        <Canvas shadows dpr={[1, 2]}>
          <Suspense fallback={null}>
            <OfficeScene />
          </Suspense>
        </Canvas>
      </div>
      <Hud />
      {openApp && <WindowOverlay app={openApp} />}
    </>
  );
}
