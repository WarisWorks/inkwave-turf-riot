import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bomb,
  CircleHelp,
  CloudRain,
  Crosshair,
  House,
  Pause,
  Play,
  Radio,
  ScrollText,
  Settings,
  ShowerHead,
  Waves,
  Zap,
} from "lucide-react";
import type { EngineApi } from "../game/engine";
import { DEFAULT_SAVE, loadSave, rankTitle, writeSave, type SaveData } from "../game/persist";
import {
  SPECIALS,
  SUBS,
  WEAPONS,
  weaponById,
  type HudSnap,
  type InputState,
  type LiveConfig,
  type Quality,
  type SpecialId,
  type SubId,
  type WeaponId,
} from "../game/types";

type Screen = "menu" | "loadout" | "settings" | "howto" | "credits" | "play";

function clock(t: number) {
  const s = Math.max(0, Math.ceil(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] items-center gap-2">
      <span className="text-sm text-muted">{label}</span>
      <span className="stat-track">
        <span className="block h-full bg-orange" style={{ width: `${Math.round(value * 100)}%` }} />
      </span>
    </div>
  );
}

export function InkWaveApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const apiRef = useRef<EngineApi | null>(null);
  const inputRef = useRef<InputState>({
    ax: 0,
    ay: 0,
    fire: false,
    jump: false,
    swim: false,
    bomb: false,
    special: false,
    lookX: 0,
    lookY: 0,
  });
  const configRef = useRef<LiveConfig>({
    name: DEFAULT_SAVE.name,
    weapon: DEFAULT_SAVE.weapon,
    sub: DEFAULT_SAVE.sub,
    special: DEFAULT_SAVE.special,
    sens: DEFAULT_SAVE.sens,
    volume: DEFAULT_SAVE.volume,
    invertY: DEFAULT_SAVE.invertY,
    quality: DEFAULT_SAVE.quality,
    input: inputRef.current,
  });
  const onHudRef = useRef<(h: HudSnap) => void>(() => {});

  const [save, setSave] = useState<SaveData>(DEFAULT_SAVE);
  const [booted, setBooted] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [screen, setScreen] = useState<Screen>("menu");
  const [hud, setHud] = useState<HudSnap | null>(null);
  const [touchUi, setTouchUi] = useState(false);

  configRef.current = {
    name: save.name,
    weapon: save.weapon,
    sub: save.sub,
    special: save.special,
    sens: save.sens,
    volume: save.volume,
    invertY: save.invertY,
    quality: save.quality,
    input: inputRef.current,
  };
  onHudRef.current = setHud;

  function patch(partial: Partial<SaveData>) {
    setSave((current) => {
      const next = { ...current, ...partial };
      writeSave(next);
      return next;
    });
  }

  useEffect(() => {
    setSave(loadSave());
    setBooted(true);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const apply = () => setTouchUi(mq.matches || window.innerWidth < 760);
    apply();
    mq.addEventListener("change", apply);
    window.addEventListener("resize", apply);
    return () => {
      mq.removeEventListener("change", apply);
      window.removeEventListener("resize", apply);
    };
  }, []);

  useEffect(() => {
    if (!booted) return;
    const canvas = canvasRef.current;
    const mini = miniRef.current;
    if (!canvas || !mini) return;
    let cleanup = () => {};
    let cancel = false;
    void import("../game/engine").then(({ mountInkWave }) => {
      if (cancel) return;
      cleanup = mountInkWave(canvas, mini, {
        config: configRef,
        onHud: (h) => onHudRef.current(h),
        onReady: () => setReady(true),
        onError: (m) => setError(m),
        onResult: (r) => {
          setSave((current) => {
            const next = {
              ...current,
              matches: current.matches + 1,
              wins: current.wins + (r.winner === "orange" ? 1 : 0),
              splats: current.splats + r.splats,
            };
            writeSave(next);
            return next;
          });
        },
        onApi: (api) => {
          apiRef.current = api;
        },
      });
    });
    return () => {
      cancel = true;
      cleanup();
      apiRef.current = null;
    };
  }, [booted]);

  function play() {
    if (!apiRef.current) return;
    apiRef.current.startMatch();
    setScreen("play");
  }

  const weapon = weaponById(save.weapon);
  const playing = screen === "play";

  return (
    <div className="fixed inset-0 touch-none overflow-hidden bg-navy text-foam select-none">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-label="InkWave harbor" />
      <canvas
        ref={miniRef}
        width={180}
        height={228}
        className={
          playing && hud
            ? `pointer-events-none absolute z-20 h-32 w-24 rounded-sticker border-2 border-foam ${touchUi ? "bottom-36 left-3" : "bottom-4 left-3"}`
            : "hidden"
        }
      />

      {error ? (
        <div className="absolute inset-x-4 top-4 z-50 panel p-4 text-sm">{error}</div>
      ) : null}

      {screen === "menu" ? <Menu save={save} ready={ready} weapon={weapon.name} onPlay={play} onNavigate={(s) => {
          if (s === "loadout") apiRef.current?.showcase();
          setScreen(s);
        }} onName={(name) => patch({ name })} /> : null}
      {screen === "loadout" ? (
        <Loadout
          save={save}
          onBack={() => {
            apiRef.current?.orbit();
            setScreen("menu");
          }}
          onWeapon={(weaponId) => patch({ weapon: weaponId })}
          onSub={(sub) => patch({ sub })}
          onSpecial={(special) => patch({ special })}
        />
      ) : null}
      {screen === "settings" ? <SettingsScreen save={save} onBack={() => setScreen("menu")} onChange={patch} /> : null}
      {screen === "howto" ? <HowTo onBack={() => setScreen("menu")} /> : null}
      {screen === "credits" ? <Credits onBack={() => setScreen("menu")} /> : null}

      {playing && hud ? (
        <Hud
          hud={hud}
          touch={touchUi}
          onPause={() => apiRef.current?.pause()}
          onResume={() => apiRef.current?.resume()}
          onMenu={() => {
            apiRef.current?.orbit();
            setScreen("menu");
          }}
          onAgain={play}
        />
      ) : null}

      {playing && touchUi && hud && !hud.paused && hud.phase !== "ended" ? <TouchControls input={inputRef.current} /> : null}

      {playing ? (
        <p className="pointer-events-none absolute top-[4.6rem] left-1/2 z-40 -translate-x-1/2 rounded-full bg-navy px-2 py-0.5 font-display text-xs text-foam">
          v1.0.0
        </p>
      ) : (
        <p className="pointer-events-none absolute bottom-3 left-3 z-40 rounded-full bg-navy px-2 py-1 font-display text-xs text-foam">v1.0.0</p>
      )}
    </div>
  );
}

function Menu({
  save,
  ready,
  weapon,
  onPlay,
  onNavigate,
  onName,
}: {
  save: SaveData;
  ready: boolean;
  weapon: string;
  onPlay: () => void;
  onNavigate: (s: Screen) => void;
  onName: (name: string) => void;
}) {
  const buttons: { label: string; screen?: Screen; icon: ReactNode; action?: () => void; primary?: boolean }[] = [
    { label: ready ? "PLAY" : "Waking the tide…", icon: <Play className="size-5" />, action: onPlay, primary: true },
    { label: "LOADOUT", screen: "loadout", icon: <Crosshair className="size-5" /> },
    { label: "SETTINGS", screen: "settings", icon: <Settings className="size-5" /> },
    { label: "HOW TO PLAY", screen: "howto", icon: <CircleHelp className="size-5" /> },
    { label: "CREDITS", screen: "credits", icon: <ScrollText className="size-5" /> },
  ];
  return (
    <div className="absolute inset-0 z-30 overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-4 p-4 pb-10 md:flex-row md:items-center md:p-8">
        <section className="panel flex w-full flex-col gap-4 p-5 md:max-w-md">
          <div className="flex items-center gap-3">
            <span className="relative h-14 w-14 shrink-0" aria-hidden>
              <span className="absolute inset-0 rounded-full bg-orange" />
              <span className="absolute top-1 -right-1 h-7 w-7 rounded-full bg-violet" />
              <span className="absolute -bottom-1 left-2 h-4 w-4 rounded-full bg-sun" />
            </span>
            <div>
              <p className="font-display text-xs tracking-widest text-sun">HARBOR TURF WAR</p>
              <h1 className="font-display text-4xl leading-none text-foam md:text-5xl">
                INKWAVE
                <br />
                TURF RIOT
              </h1>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-muted">Paint the coast. The side that owns the ground when the tide runs out wins.</p>
          <div className="flex flex-col gap-3">
            {buttons.map((b) => (
              <button
                key={b.label}
                type="button"
                disabled={b.primary && !ready}
                className={`sticker flex h-12 items-center justify-center gap-2 rounded-sticker px-4 font-display text-lg ${
                  b.primary ? "bg-orange text-navy" : "bg-foam text-navy"
                }`}
                onClick={() => {
                  if (b.screen === "loadout") onNavigate("loadout");
                  else if (b.screen) onNavigate(b.screen);
                  else b.action?.();
                }}
              >
                {b.icon}
                {b.primary ? (ready ? "PLAY  ·  Turf War 4v4" : b.label) : b.label}
              </button>
            ))}
          </div>
        </section>
        <section className="panel w-full p-5 md:ml-auto md:w-80">
          <p className="font-display text-xs tracking-widest text-sun">PLAYER CARD</p>
          <label className="mt-3 block text-sm text-muted" htmlFor="wavelet-name">
            Wavelet name
          </label>
          <input
            id="wavelet-name"
            value={save.name}
            maxLength={16}
            suppressHydrationWarning
            onChange={(e) => onName(e.target.value)}
            className="mt-1 h-12 w-full rounded-sticker border-2 border-foam bg-navy-2 px-3 font-display text-xl text-foam"
          />
          <p className="mt-4 font-display text-2xl text-orange">{rankTitle(save.wins)}</p>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted">Wins</dt>
              <dd className="font-display text-xl">{save.wins}</dd>
            </div>
            <div>
              <dt className="text-muted">Matches</dt>
              <dd className="font-display text-xl">{save.matches}</dd>
            </div>
            <div>
              <dt className="text-muted">Splats</dt>
              <dd className="font-display text-xl">{save.splats}</dd>
            </div>
            <div>
              <dt className="text-muted">Weapon</dt>
              <dd className="font-display text-xl">{weapon}</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm text-muted">Team Orange · 3-minute harbor matches</p>
        </section>
      </div>
    </div>
  );
}

function Loadout({
  save,
  onBack,
  onWeapon,
  onSub,
  onSpecial,
}: {
  save: SaveData;
  onBack: () => void;
  onWeapon: (id: WeaponId) => void;
  onSub: (id: SubId) => void;
  onSpecial: (id: SpecialId) => void;
}) {
  const info = weaponById(save.weapon);
  return (
    <div className="absolute inset-0 z-30 overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-4 p-4 pb-12 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <button type="button" className="sticker flex h-11 items-center gap-2 rounded-sticker bg-foam px-4 font-display text-navy" onClick={onBack}>
            <House className="size-4" /> Menu
          </button>
          <h2 className="font-display text-3xl">Loadout</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="panel p-4">
            <p className="mb-3 text-sm text-muted">Main weapon</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {WEAPONS.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => onWeapon(w.id)}
                  className={`rounded-sticker border-2 p-3 text-left ${save.weapon === w.id ? "border-orange bg-navy-2" : "border-foam/40 bg-navy"}`}
                >
                  <span className="font-display text-lg">{w.name}</span>
                  <span className="mt-1 block text-xs tracking-widest text-sun">{w.kind}</span>
                </button>
              ))}
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted">{info.blurb}</p>
            <div className="mt-3 flex flex-col gap-2">
              <Stat label="Range" value={info.range} />
              <Stat label="Damage" value={info.damage} />
              <Stat label="Fire rate" value={info.fire} />
              <Stat label="Mobility" value={info.mobility} />
              <Stat label="Ink cover" value={info.cover} />
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="panel p-4">
              <p className="mb-2 text-sm text-muted">Sub weapon</p>
              {SUBS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSub(s.id)}
                  className={`mb-2 flex w-full items-start gap-3 rounded-sticker border-2 p-3 text-left ${save.sub === s.id ? "border-orange bg-navy-2" : "border-foam/30"}`}
                >
                  {s.id === "pop-bomb" ? <Bomb className="mt-0.5 size-5 text-orange" /> : <Radio className="mt-0.5 size-5 text-orange" />}
                  <span>
                    <span className="block font-display">{s.name}</span>
                    <span className="text-sm text-muted">{s.blurb}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="panel p-4">
              <p className="mb-2 text-sm text-muted">Special</p>
              {SPECIALS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSpecial(s.id)}
                  className={`mb-2 flex w-full items-start gap-3 rounded-sticker border-2 p-3 text-left ${save.special === s.id ? "border-violet bg-navy-2" : "border-foam/30"}`}
                >
                  {s.id === "tempest" ? <CloudRain className="mt-0.5 size-5 text-violet" /> : <Zap className="mt-0.5 size-5 text-violet" />}
                  <span>
                    <span className="block font-display">{s.name}</span>
                    <span className="text-sm text-muted">{s.blurb}</span>
                  </span>
                </button>
              ))}
            </div>
            <p className="text-sm text-muted">Your wavelet is posing on the orange plaza. Team color follows Orange.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsScreen({ save, onBack, onChange }: { save: SaveData; onBack: () => void; onChange: (p: Partial<SaveData>) => void }) {
  return (
    <div className="absolute inset-0 z-30 overflow-y-auto">
      <div className="mx-auto flex max-w-lg flex-col gap-4 p-4 pb-12">
        <button type="button" className="sticker flex h-11 w-fit items-center gap-2 rounded-sticker bg-foam px-4 font-display text-navy" onClick={onBack}>
          <House className="size-4" /> Menu
        </button>
        <h2 className="font-display text-4xl">Settings</h2>
        <section className="panel flex flex-col gap-4 p-5">
          <label className="flex flex-col gap-2 text-sm">
            Look sensitivity
            <input type="range" min={0.45} max={2} step={0.05} value={save.sens} onChange={(e) => onChange({ sens: Number(e.target.value) })} />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            Invert look up / down
            <input type="checkbox" checked={save.invertY} onChange={(e) => onChange({ invertY: e.target.checked })} className="size-5" />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            Volume
            <input type="range" min={0} max={1} step={0.01} value={save.volume} onChange={(e) => onChange({ volume: Number(e.target.value) })} />
          </label>
          <div className="flex flex-col gap-2 text-sm">
            Graphics
            <div className="grid grid-cols-2 gap-2">
              {(["low", "high"] as Quality[]).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => onChange({ quality: q })}
                  className={`h-11 rounded-sticker border-2 font-display ${save.quality === q ? "border-orange bg-orange text-navy" : "border-foam text-foam"}`}
                >
                  {q === "low" ? "Smooth" : "Sharp"}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function HowTo({ onBack }: { onBack: () => void }) {
  const rows = [
    ["Move", "WASD or arrows. A strafes left, D strafes right."],
    ["Aim", "Click-drag or pointer lock. Q and E turn if you prefer keys."],
    ["Shoot", "Left mouse. Spritzer streams, roller pushes, charger charges, blaster lobs."],
    ["Jump", "Space. A roller flick flies farther if you jump while rolling."],
    ["Swim", "Hold Shift on your own ink to dash and refill. Enemy ink slows you and covers you."],
    ["Sub / Special", "Right mouse or C for sub. F when the special meter is full."],
    ["Splat", "There is no health bar. Get covered and you respawn at base."],
    ["Win", "Own more of the harbor than Violet when three minutes end."],
  ];
  return (
    <div className="absolute inset-0 z-30 overflow-y-auto">
      <div className="mx-auto flex max-w-xl flex-col gap-4 p-4 pb-12">
        <button type="button" className="sticker flex h-11 w-fit items-center gap-2 rounded-sticker bg-foam px-4 font-display text-navy" onClick={onBack}>
          <House className="size-4" /> Menu
        </button>
        <h2 className="font-display text-4xl">How to play</h2>
        <div className="panel divide-y divide-foam/15 p-2">
          {rows.map(([k, v]) => (
            <div key={k} className="px-3 py-3">
              <p className="font-display text-lg text-orange">{k}</p>
              <p className="text-sm leading-relaxed text-foam">{v}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Credits({ onBack }: { onBack: () => void }) {
  return (
    <div className="absolute inset-0 z-30 overflow-y-auto">
      <div className="mx-auto flex max-w-lg flex-col gap-4 p-4 pb-12">
        <button type="button" className="sticker flex h-11 w-fit items-center gap-2 rounded-sticker bg-foam px-4 font-display text-navy" onClick={onBack}>
          <House className="size-4" /> Menu
        </button>
        <h2 className="font-display text-4xl">Credits</h2>
        <section className="panel p-5 leading-relaxed">
          <p className="font-display text-2xl text-orange">InkWave Turf Riot</p>
          <p className="mt-3">An original 4v4 turf-war shooter. Made with Claude Opus 5.5</p>
          <p className="mt-3 text-sm text-muted">
            Wavelets, the harbor, and every weapon here are original. No Nintendo characters, names, or assets. Geometry, ink, and sound are generated in the browser.
          </p>
          <p className="mt-4 font-display text-sm text-sun">v1.0.0</p>
        </section>
      </div>
    </div>
  );
}

function Hud({
  hud,
  touch,
  onPause,
  onResume,
  onMenu,
  onAgain,
}: {
  hud: HudSnap;
  touch: boolean;
  onPause: () => void;
  onResume: () => void;
  onMenu: () => void;
  onAgain: () => void;
}) {
  const subName = SUBS.find((s) => s.id === hud.sub)?.name ?? "Sub";
  const spName = SPECIALS.find((s) => s.id === hud.specialId)?.name ?? "Special";
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div
        className="absolute inset-0 bg-orange"
        style={{
          opacity: Math.max(0, hud.splat * 0.45),
          maskImage: "radial-gradient(circle at center, transparent 35%, black 78%)",
          WebkitMaskImage: "radial-gradient(circle at center, transparent 35%, black 78%)",
        }}
      />
      <div className="absolute top-3 right-3 left-3 flex items-start justify-between gap-3">
        <div className="rounded-sticker bg-navy/80 px-3 py-2">
          <p className="font-display text-xs tracking-widest text-orange">ORANGE</p>
          <p className="font-display text-2xl">{Math.round(hud.orange * 100)}%</p>
        </div>
        <div className="flex flex-col items-center">
          <p className="font-display text-3xl text-foam">{clock(hud.time)}</p>
          <div className="mt-1 flex h-3 w-40 overflow-hidden rounded-full bg-navy md:w-64">
            <span className="bg-orange" style={{ width: `${hud.orange * 100}%` }} />
            <span className="ml-auto bg-violet" style={{ width: `${hud.blue * 100}%` }} />
          </div>
        </div>
        <div className="rounded-sticker bg-navy/80 px-3 py-2 text-right">
          <p className="font-display text-xs tracking-widest text-violet">VIOLET</p>
          <p className="font-display text-2xl">{Math.round(hud.blue * 100)}%</p>
        </div>
      </div>

      <button type="button" className="pointer-events-auto absolute top-20 right-3 flex h-11 items-center gap-2 rounded-sticker bg-foam px-3 font-display text-navy" onClick={onPause}>
        <Pause className="size-4" /> Pause
      </button>

      <div className="absolute top-24 left-3 flex max-w-xs flex-col gap-1">
        {hud.feed.map((line) => (
          <p key={line.id} className="rounded-sticker bg-navy/75 px-2 py-1 text-sm">
            {line.text}
          </p>
        ))}
      </div>

      {hud.banner ? (
        <p className="absolute top-1/3 left-1/2 -translate-x-1/2 font-display text-5xl text-sun md:text-6xl">{hud.banner}</p>
      ) : null}

      {hud.countdown > 0 && hud.phase !== "ended" ? (
        <p className="absolute top-[42%] left-1/2 -translate-x-1/2 font-display text-7xl text-foam">{Math.ceil(hud.countdown)}</p>
      ) : null}

      {hud.respawn > 0 ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-navy/45">
          <p className="font-display text-2xl">Back in the swim</p>
          <p className="font-display text-7xl text-orange">{Math.ceil(hud.respawn)}</p>
        </div>
      ) : null}

      <div className="pointer-events-none absolute top-1/2 left-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2">
        <span className="absolute top-1/2 left-0 h-0.5 w-2 -translate-y-1/2 bg-foam" />
        <span className="absolute top-1/2 right-0 h-0.5 w-2 -translate-y-1/2 bg-foam" />
        <span className="absolute top-0 left-1/2 h-2 w-0.5 -translate-x-1/2 bg-foam" />
        <span className="absolute bottom-0 left-1/2 h-2 w-0.5 -translate-x-1/2 bg-foam" />
        <span
          className="absolute inset-0 rounded-full border-2 border-orange"
          style={{ opacity: hud.charging, transform: `scale(${0.6 + hud.charging})` }}
        />
      </div>

      <div className={`absolute right-3 flex flex-col items-center ${touch ? "bottom-36" : "bottom-4"} md:w-64`}>
        <div className="mb-2 flex items-center gap-2 text-xs text-foam">
          <span>{weaponById(hud.weapon).name}</span>
          <span className="text-muted">{subName}</span>
          <span className={hud.special >= 1 ? "text-sun" : "text-muted"}>{spName}</span>
        </div>
        <div className="flex items-end gap-2">
          <div className="h-16 w-5 overflow-hidden rounded-full border-2 border-foam bg-navy">
            <div className="w-full bg-orange" style={{ height: `${hud.ink * 100}%`, marginTop: `${(1 - hud.ink) * 100}%` }} />
          </div>
          <div className="h-10 w-24 overflow-hidden rounded-full border-2 border-foam bg-navy">
            <div className="h-full bg-violet" style={{ width: `${hud.special * 100}%` }} />
          </div>
        </div>
        {!touch ? <p className="mt-2 text-center text-xs text-foam/80">Shift swim · RMB sub · F special</p> : null}
      </div>

      {hud.paused ? (
        <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-navy/70 p-4">
          <div className="panel flex w-full max-w-sm flex-col gap-3 p-5">
            <h2 className="font-display text-4xl">Paused</h2>
            <button type="button" className="sticker h-12 rounded-sticker bg-orange font-display text-lg text-navy" onClick={onResume}>
              Resume
            </button>
            <button type="button" className="sticker h-12 rounded-sticker bg-foam font-display text-lg text-navy" onClick={onMenu}>
              Quit to menu
            </button>
          </div>
        </div>
      ) : null}

      {hud.phase === "ended" && hud.result ? (
        <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-navy/72 p-4">
          <div className="panel w-full max-w-md p-6 text-center">
            <p className="font-display text-sm tracking-widest text-sun">MATCH OVER</p>
            <h2 className="mt-1 font-display text-4xl">
              {hud.result.winner === "orange" ? "Orange takes the turf" : hud.result.winner === "violet" ? "Violet takes the turf" : "Dead even"}
            </h2>
            <p className="mt-3 font-display text-3xl">
              <span className="text-orange">{Math.round(hud.result.orange * 100)}%</span>
              <span className="text-muted"> · </span>
              <span className="text-violet">{Math.round(hud.result.blue * 100)}%</span>
            </p>
            <p className="mt-2 text-sm text-muted">
              You splatted {hud.result.splats} · washed out {hud.result.deaths}
            </p>
            <div className="mt-5 flex flex-col gap-3">
              <button type="button" className="sticker h-12 rounded-sticker bg-orange font-display text-lg text-navy" onClick={onAgain}>
                Play again
              </button>
              <button type="button" className="sticker h-12 rounded-sticker bg-foam font-display text-lg text-navy" onClick={onMenu}>
                Menu
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TouchControls({ input }: { input: InputState }) {
  const stick = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  function setStick(clientX: number, clientY: number, active: boolean) {
    const pad = stick.current;
    const k = knob.current;
    if (!pad || !k) return;
    if (!active) {
      input.ax = 0;
      input.ay = 0;
      k.style.transform = "translate(-50%, -50%)";
      return;
    }
    const rect = pad.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const max = rect.width * 0.34;
    const mag = Math.hypot(dx, dy) || 1;
    const cl = Math.min(max, mag);
    dx = (dx / mag) * cl;
    dy = (dy / mag) * cl;
    input.ax = dx / max;
    input.ay = -dy / max;
    k.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }
  return (
    <div className="absolute inset-0 z-30">
      <div
        className="absolute top-28 right-0 bottom-28 left-1/3"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          const startX = e.clientX;
          const startY = e.clientY;
          const move = (ev: PointerEvent) => {
            input.lookX += ev.clientX - lastX;
            input.lookY += ev.clientY - lastY;
            lastX = ev.clientX;
            lastY = ev.clientY;
          };
          let lastX = startX;
          let lastY = startY;
          const up = () => {
            e.currentTarget.removeEventListener("pointermove", move);
            e.currentTarget.removeEventListener("pointerup", up);
          };
          e.currentTarget.addEventListener("pointermove", move);
          e.currentTarget.addEventListener("pointerup", up);
        }}
      />
      <div
        ref={stick}
        className="absolute bottom-6 left-4 h-32 w-32 rounded-full border-2 border-foam/80 bg-navy/50"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          e.stopPropagation();
          setStick(e.clientX, e.clientY, true);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) setStick(e.clientX, e.clientY, true);
        }}
        onPointerUp={(e) => setStick(e.clientX, e.clientY, false)}
        onPointerCancel={() => setStick(0, 0, false)}
      >
        <div ref={knob} className="absolute top-1/2 left-1/2 h-14 w-14 rounded-full bg-foam" style={{ transform: "translate(-50%, -50%)" }} />
      </div>
      <div className="absolute right-4 bottom-6 grid grid-cols-2 gap-2">
        <HoldButton label="Swim" icon={<Waves className="size-5" />} onHold={(v) => (input.swim = v)} />
        <HoldButton label="Jump" icon={<Zap className="size-5" />} onHold={(v) => (input.jump = v)} />
        <HoldButton label="Sub" icon={<Bomb className="size-5" />} onHold={(v) => (input.bomb = v)} />
        <HoldButton label="Special" icon={<ShowerHead className="size-5" />} onHold={(v) => (input.special = v)} />
        <HoldButton label="Shoot" icon={<Crosshair className="size-5" />} wide onHold={(v) => (input.fire = v)} />
      </div>
    </div>
  );
}

function HoldButton({ label, icon, onHold, wide }: { label: string; icon: ReactNode; onHold: (v: boolean) => void; wide?: boolean }) {
  return (
    <button
      type="button"
      className={`flex h-14 items-center justify-center gap-1 rounded-sticker bg-foam font-display text-navy ${wide ? "col-span-2" : ""}`}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        onHold(true);
      }}
      onPointerUp={() => onHold(false)}
      onPointerCancel={() => onHold(false)}
    >
      {icon}
      {label}
    </button>
  );
}
