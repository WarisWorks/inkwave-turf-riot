import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import {
  Bomb,
  Check,
  CircleHelp,
  CloudRain,
  Crown,
  Crosshair,
  House,
  ListOrdered,
  Map as MapIcon,
  Pause,
  Play,
  Radio,
  RotateCcw,
  ScrollText,
  Shirt,
  Settings,
  ShowerHead,
  Sparkles,
  Trophy,
  Waves,
  Zap,
} from "lucide-react";
import type { EngineApi } from "../game/engine";
import { LEVEL_DEFS, MAP, waterRects } from "../game/levels";
import { DEFAULT_SAVE, levelInfo, loadSave, matchCoins, matchXp, rankTitle, writeSave, type SaveData } from "../game/persist";
import {
  CHARACTERS,
  DIFFICULTIES,
  GAME_MODES,
  LEVELS,
  characterById,
  levelById,
  SPECIALS,
  SUBS,
  WEAPONS,
  mvpIndex,
  weaponById,
  type BoardRow,
  type CharacterId,
  type Difficulty,
  type GameMode,
  type HudSnap,
  type InputState,
  type LevelId,
  type LiveConfig,
  type Quality,
  type SpecialId,
  type SubId,
  type WeaponId,
} from "../game/types";

type Screen = "menu" | "loadout" | "stage" | "settings" | "howto" | "credits" | "play";

/** What the last match earned, shown on the results screen. */
type Reward = { xp: number; coins: number; record: boolean; levelUp: number };

const VERSION = "v2.0.0";

function difficultyName(id: Difficulty) {
  return DIFFICULTIES.find((d) => d.id === id)?.name ?? "";
}

function clock(t: number) {
  const s = Math.max(0, Math.ceil(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] items-center gap-2">
      <span className="text-sm text-muted">{label}</span>
      <span className="stat-track">
        <span className="block h-full bg-orange" style={{ width: `${Math.round(value * 100)}%` }} />
      </span>
    </div>
  );
}

type Tone = "foam" | "orange" | "violet";

function InkButton({
  tone = "foam",
  icon,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; icon?: ReactNode }) {
  return (
    <button type="button" {...rest} className={`ink-btn ink-${tone} font-display ${className}`}>
      <span className="ink-btn-wave" aria-hidden />
      {icon ? (
        <span className="ink-btn-icon" aria-hidden>
          {icon}
        </span>
      ) : null}
      {children}
    </button>
  );
}

function InkOption({
  selected,
  tone = "orange",
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected: boolean; tone?: Tone }) {
  return (
    <button type="button" aria-pressed={selected} {...rest} className={`ink-option ink-${tone} ${className}`}>
      {selected ? (
        <span className="ink-splat" aria-hidden>
          <Check className="size-3.5" strokeWidth={3.5} />
        </span>
      ) : null}
      {children}
    </button>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <InkButton icon={<House className="size-4" />} className="h-11 w-fit ps-1.5 pe-4 text-base" onClick={onBack}>
      باش بەت
    </InkButton>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="ink-kbd" dir="auto">
      {children}
    </kbd>
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
    difficulty: DEFAULT_SAVE.difficulty,
    level: DEFAULT_SAVE.level,
    character: DEFAULT_SAVE.character,
    gameMode: DEFAULT_SAVE.gameMode,
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
  const [reward, setReward] = useState<Reward | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;

  configRef.current = {
    name: save.name,
    weapon: save.weapon,
    sub: save.sub,
    special: save.special,
    sens: save.sens,
    volume: save.volume,
    invertY: save.invertY,
    quality: save.quality,
    difficulty: save.difficulty,
    level: save.level,
    character: save.character,
    gameMode: save.gameMode,
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
          const current = saveRef.current;
          const xp = matchXp(r);
          const coins = matchCoins(r);
          const next = {
            ...current,
            matches: current.matches + 1,
            wins: current.wins + (r.winner === "orange" ? 1 : 0),
            splats: current.splats + r.splats,
            xp: current.xp + xp,
            coins: current.coins + coins,
            best: Math.max(current.best, r.points),
          };
          writeSave(next);
          setSave(next);
          const level = levelInfo(next.xp).level;
          setReward({ xp, coins, record: r.points > current.best && r.points > 0, levelUp: level > levelInfo(current.xp).level ? level : 0 });
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
    setReward(null);
    setScreen("play");
  }

  const weapon = weaponById(save.weapon);
  const playing = screen === "play";

  return (
    <div className="alkatip-basma fixed inset-0 touch-none overflow-hidden bg-navy text-foam select-none">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-label="سىياھ دولقۇنى پورتى" />
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
          onCharacter={(character) => patch({ character })}
        />
      ) : null}
      {screen === "stage" ? (
        <StageScreen
          save={save}
          onBack={() => setScreen("menu")}
          onLevel={(level) => {
            patch({ level });
            apiRef.current?.setLevel(level);
          }}
          onMode={(gameMode) => patch({ gameMode })}
        />
      ) : null}
      {screen === "settings" ? <SettingsScreen save={save} onBack={() => setScreen("menu")} onChange={patch} /> : null}
      {screen === "howto" ? <HowTo onBack={() => setScreen("menu")} /> : null}
      {screen === "credits" ? <Credits onBack={() => setScreen("menu")} /> : null}

      {playing && hud ? (
        <Hud
          hud={hud}
          touch={touchUi}
          reward={reward}
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

      {playing && hud?.phase !== "ended" ? (
        <p className="pointer-events-none absolute top-[4.6rem] left-1/2 z-40 -translate-x-1/2 rounded-full bg-navy px-2 py-0.5 font-display text-xs text-foam">
          {VERSION}
        </p>
      ) : playing ? null : (
        <p className="pointer-events-none absolute bottom-3 left-3 z-40 rounded-full bg-navy px-2 py-1 font-display text-xs text-foam">{VERSION}</p>
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
  const buttons: { label: string; screen: Screen; icon: ReactNode }[] = [
    { label: "قورال-جابدۇق", screen: "loadout", icon: <Shirt className="size-5" /> },
    { label: "مەيدان تاللاش", screen: "stage", icon: <MapIcon className="size-5" /> },
    { label: "تەڭشەك", screen: "settings", icon: <Settings className="size-5" /> },
    { label: "ئويناش ئۇسۇلى", screen: "howto", icon: <CircleHelp className="size-5" /> },
    { label: "ئويۇن ھەققىدە", screen: "credits", icon: <ScrollText className="size-5" /> },
  ];
  const lv = levelInfo(save.xp);
  return (
    <div className="absolute inset-0 z-30 overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-4 p-4 pb-10 md:flex-row md:items-center md:p-8">
        <section className="panel flex w-full flex-col gap-4 p-5 md:max-w-md">
          <span className="ikat-strip" aria-hidden />
          <div className="flex items-center gap-3">
            <span className="relative h-14 w-14 shrink-0" aria-hidden>
              <span className="absolute inset-0 rounded-full bg-orange" />
              <span className="absolute top-1 -right-1 h-7 w-7 rounded-full bg-violet" />
              <span className="absolute -bottom-1 left-2 h-4 w-4 rounded-full bg-sun" />
            </span>
            <div>
              <p className="font-display text-sm text-sun">رەڭلىك زېمىن تالىشىش جېڭى</p>
              <h1 className="font-display text-4xl leading-[1.35] text-foam md:text-5xl">
                سىياھ دولقۇنى
                <br />
                <span className="text-orange">زېمىن جېڭى</span>
              </h1>
            </div>
          </div>
          <p className="text-base leading-ug text-muted">
            مەيداننى سىياھ بىلەن بوياڭ. ۋاقىت توشقاندا تېخىمۇ كۆپ زېمىنغا ئىگە بولغان تەرەپ غەلىبە قىلىدۇ.
          </p>
          <div className="flex flex-col gap-5 pb-4">
            <InkButton
              tone="orange"
              className="ink-btn-hero h-16 justify-start ps-2 pe-4 text-2xl"
              disabled={!ready}
              aria-busy={!ready}
              icon={<Play className="size-6" />}
              onClick={onPlay}
            >
              {ready ? (
                <>
                  باشلاش
                  <span className="ink-chip ms-auto">{levelById(save.level).name} · {difficultyName(save.difficulty)}</span>
                </>
              ) : (
                <span className="text-lg">دولقۇن ئويغىنىۋاتىدۇ…</span>
              )}
            </InkButton>
            <div className="grid grid-cols-2 gap-x-3 gap-y-5">
              {buttons.map((b, i) => (
                <InkButton
                  key={b.screen}
                  icon={b.icon}
                  className={`h-12 justify-start ps-1.5 pe-3 text-base ${i === buttons.length - 1 && buttons.length % 2 ? "col-span-2" : ""}`}
                  onClick={() => onNavigate(b.screen)}
                >
                  {b.label}
                </InkButton>
              ))}
            </div>
          </div>
        </section>
        <section className="panel w-full p-5 md:ms-auto md:w-80">
          <p className="font-display text-sm text-sun">ئويۇنچى كارتىسى</p>
          <label className="mt-3 block text-sm text-muted" htmlFor="wavelet-name">
            دولقۇنچاق ئىسمى
          </label>
          <input
            id="wavelet-name"
            dir="auto"
            value={save.name}
            maxLength={16}
            suppressHydrationWarning
            onChange={(e) => onName(e.target.value)}
            className="mt-1 h-12 w-full rounded-sticker border-2 border-foam bg-navy-2 px-3 font-display text-xl text-foam"
          />
          <p className="mt-4 font-display text-2xl text-orange">{rankTitle(save.wins)}</p>
          <div className="mt-2">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-display text-lg text-sun">دەرىجە {lv.level}</span>
              <span className="text-muted" dir="ltr">
                {lv.into} / {lv.need}
              </span>
            </div>
            <span className="ink-xp mt-1" role="progressbar" aria-label="تەجرىبە" aria-valuenow={lv.into} aria-valuemax={lv.need}>
              <span style={{ width: `${(lv.into / lv.need) * 100}%` }} />
            </span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted">غەلىبە</dt>
              <dd className="font-display text-xl">{save.wins}</dd>
            </div>
            <div>
              <dt className="text-muted">مۇسابىقە</dt>
              <dd className="font-display text-xl">{save.matches}</dd>
            </div>
            <div>
              <dt className="text-muted">چاچرىتىش</dt>
              <dd className="font-display text-xl">{save.splats}</dd>
            </div>
            <div>
              <dt className="text-muted">ئەڭ ياخشى نومۇر</dt>
              <dd className="font-display text-xl">{save.best}</dd>
            </div>
            <div>
              <dt className="text-muted">قورال</dt>
              <dd className="font-display text-xl">{weapon}</dd>
            </div>
            <div>
              <dt className="text-muted">رەقىب</dt>
              <dd className="font-display text-xl">{difficultyName(save.difficulty)}</dd>
            </div>
            <div>
              <dt className="text-muted">پېرسوناژ</dt>
              <dd className="font-display text-lg leading-7">{characterById(save.character).name}</dd>
            </div>
            <div>
              <dt className="text-muted">مەيدان</dt>
              <dd className="font-display text-lg leading-7">{levelById(save.level).name}</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm leading-ug text-muted">ئاپېلسىن گۇرۇپپا · 3 مىنۇتلۇق مۇسابىقە</p>
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
  onCharacter,
}: {
  save: SaveData;
  onBack: () => void;
  onWeapon: (id: WeaponId) => void;
  onSub: (id: SubId) => void;
  onSpecial: (id: SpecialId) => void;
  onCharacter: (id: CharacterId) => void;
}) {
  const info = weaponById(save.weapon);
  const char = characterById(save.character);
  return (
    <div className="absolute inset-0 z-30 overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-4 p-4 pb-12 md:p-6">
        <div className="flex items-center justify-between gap-3 pb-2">
          <BackButton onBack={onBack} />
          <h2 className="font-display text-3xl">قورال-جابدۇق</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            <div className="panel p-4">
              <p className="mb-3 text-sm text-muted">پېرسوناژ</p>
              <div className="grid grid-cols-2 gap-3">
                {CHARACTERS.map((c) => (
                  <InkOption key={c.id} selected={save.character === c.id} className="p-3" onClick={() => onCharacter(c.id)}>
                    <span className="block font-display text-base leading-7">{c.name}</span>
                    <span className="block text-xs leading-6 text-sun">{c.trait}</span>
                  </InkOption>
                ))}
              </div>
              <p className="mt-3 text-sm leading-ug text-muted">{char.blurb}</p>
            </div>
            <p className="text-sm leading-ug text-muted">پېرسوناژىڭىز ئوتتۇرىدا كۆرۈنۈۋاتىدۇ. گۇرۇپپا رەڭگىڭىز — ئاپېلسىن.</p>
          </div>
          {/* Keeps the middle of the screen clear so the 3D showcase model stays visible. */}
          <div className="order-first h-[58vh] lg:order-none lg:h-auto" aria-hidden />
          <div className="flex flex-col gap-4">
            <div className="panel p-4">
              <p className="mb-3 text-sm text-muted">ئاساسىي قورال</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {WEAPONS.map((w) => (
                  <InkOption key={w.id} selected={save.weapon === w.id} className="p-3" onClick={() => onWeapon(w.id)}>
                    <span className="block font-display text-lg">{w.name}</span>
                    <span className="block text-sm text-sun">{w.kind}</span>
                  </InkOption>
                ))}
              </div>
              <p className="mt-4 text-sm leading-ug text-muted">{info.blurb}</p>
              <div className="mt-3 flex flex-col gap-2">
                <Stat label="ئارىلىق" value={info.range} />
                <Stat label="زەربە" value={info.damage} />
                <Stat label="ئېتىش سۈرئىتى" value={info.fire} />
                <Stat label="ھەرىكەتچانلىق" value={info.mobility} />
                <Stat label="بوياش دائىرىسى" value={info.cover} />
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="panel p-4">
                <p className="mb-3 text-sm text-muted">قوشۇمچە قورال</p>
                {SUBS.map((s) => (
                  <InkOption key={s.id} selected={save.sub === s.id} className="mb-3 flex w-full items-start gap-3 p-3" onClick={() => onSub(s.id)}>
                    {s.id === "pop-bomb" ? <Bomb className="mt-2 size-5 shrink-0 text-orange" /> : <Radio className="mt-2 size-5 shrink-0 text-orange" />}
                    <span>
                      <span className="block font-display text-lg">{s.name}</span>
                      <span className="text-sm leading-ug text-muted">{s.blurb}</span>
                    </span>
                  </InkOption>
                ))}
              </div>
              <div className="panel p-4">
                <p className="mb-3 text-sm text-muted">ئالاھىدە ماھارەت</p>
                {SPECIALS.map((s) => (
                  <InkOption
                    key={s.id}
                    tone="violet"
                    selected={save.special === s.id}
                    className="mb-3 flex w-full items-start gap-3 p-3"
                    onClick={() => onSpecial(s.id)}
                  >
                    {s.id === "tempest" ? <CloudRain className="mt-2 size-5 shrink-0 text-violet" /> : <Zap className="mt-2 size-5 shrink-0 text-violet" />}
                    <span>
                      <span className="block font-display text-lg">{s.name}</span>
                      <span className="text-sm leading-ug text-muted">{s.blurb}</span>
                    </span>
                  </InkOption>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

/** Top-down sketch of a level, drawn from the same data the engine builds from. */
function MapPreview({ id, className = "" }: { id: LevelId; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const g = c?.getContext("2d");
    if (!c || !g) return;
    const def = LEVEL_DEFS[id];
    const W = c.width;
    const H = c.height;
    const px = (x: number) => ((x - MAP.minX) / MAP.w) * W;
    const pz = (z: number) => (1 - (z - MAP.minZ) / MAP.d) * H;
    const rect = (x0: number, x1: number, z0: number, z1: number) => [px(x0), pz(z1), px(x1) - px(x0), pz(z0) - pz(z1)] as const;
    g.fillStyle = hex(def.ground);
    g.fillRect(0, 0, W, H);
    g.fillStyle = hex(def.water);
    for (const r of waterRects(def)) g.fillRect(...rect(r.minX, r.maxX, r.minZ, r.maxZ));
    const blocks: { r: readonly [number, number, number, number]; top: number; c: number }[] = [];
    for (const p of def.prims) {
      if (p.t === "box" && !p.deco) blocks.push({ r: rect(p.x - p.w / 2, p.x + p.w / 2, p.z - p.d / 2, p.z + p.d / 2), top: p.y + p.h / 2, c: p.c });
      else if (p.t === "stairs") {
        const end = p.z + p.dir * p.run;
        blocks.push({ r: rect(p.x - p.w / 2, p.x + p.w / 2, Math.min(p.z, end), Math.max(p.z, end)), top: p.h / 2, c: p.c });
      }
    }
    blocks.sort((a, b) => a.top - b.top);
    g.strokeStyle = "rgba(16, 32, 51, 0.35)";
    g.lineWidth = 1;
    for (const b of blocks) {
      g.fillStyle = hex(b.c);
      g.fillRect(...b.r);
      g.strokeRect(...b.r);
    }
    for (const p of def.prims) {
      if (p.t !== "palm" && p.t !== "poplar" && p.t !== "dome") continue;
      g.fillStyle = p.t === "dome" ? hex(p.c) : "#3f9a4a";
      g.beginPath();
      g.arc(px(p.x), pz(p.z), p.t === "dome" ? (p.r / MAP.w) * W : 2.4, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = "#ff6a1a";
    g.fillRect(...rect(-6, -2, -35, -31.5));
    g.fillStyle = "#5b4dff";
    g.fillRect(...rect(2, 6, 31.5, 35));
    g.strokeStyle = hex(def.wall);
    g.lineWidth = 4;
    g.strokeRect(0, 0, W, H);
  }, [id]);
  return <canvas ref={ref} width={120} height={152} className={className} aria-hidden />;
}

function StageScreen({ save, onBack, onLevel, onMode }: { save: SaveData; onBack: () => void; onLevel: (id: LevelId) => void; onMode: (id: GameMode) => void }) {
  return (
    <div className="absolute inset-0 z-30 overflow-y-auto">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 p-4 pb-12">
        <div className="flex items-center justify-between gap-3 pb-2">
          <BackButton onBack={onBack} />
          <h2 className="font-display text-3xl">مەيدان تاللاش</h2>
        </div>
        <section className="panel p-4">
          <p className="mb-3 font-display text-xl text-sun">جەڭ ئۇسۇلى</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {GAME_MODES.map((m) => (
              <InkOption key={m.id} selected={save.gameMode === m.id} className="flex min-h-28 flex-col justify-center p-3 text-center" onClick={() => onMode(m.id)}>
                <span className="font-display text-lg text-orange">{m.name}</span>
                <span className="mt-1 text-xs leading-ug text-muted">{m.blurb}</span>
              </InkOption>
            ))}
          </div>
        </section>
        <div className="grid gap-4 sm:grid-cols-2">
          {LEVELS.map((l) => (
            <InkOption key={l.id} selected={save.level === l.id} className="flex items-center gap-4 p-3" onClick={() => onLevel(l.id)}>
              <MapPreview id={l.id} className="h-36 w-auto shrink-0 rounded-xl" />
              <span className="flex flex-col">
                <span className="font-display text-xl leading-9">{l.name}</span>
                <span className="text-sm leading-ug text-muted">{l.blurb}</span>
              </span>
            </InkOption>
          ))}
        </div>
        <p className="text-sm leading-ug text-muted">تاللىغان مەيدانىڭىز ئارقا كۆرۈنۈشتە كۆرۈنىدۇ. ئاپېلسىن بازا ئاستىدا، بىنەپشە بازا ئۈستىدە.</p>
      </div>
    </div>
  );
}

function SettingsScreen({ save, onBack, onChange }: { save: SaveData; onBack: () => void; onChange: (p: Partial<SaveData>) => void }) {
  return (
    <div className="absolute inset-0 z-30 overflow-y-auto">
      <div className="mx-auto flex max-w-lg flex-col gap-4 p-4 pb-12">
        <BackButton onBack={onBack} />
        <h2 className="mt-2 font-display text-4xl">تەڭشەك</h2>
        <section className="panel flex flex-col gap-5 p-5">
          <label className="flex flex-col gap-2 text-base">
            قاراش سەزگۈرلۈكى
            <input type="range" min={0.45} max={2} step={0.05} value={save.sens} onChange={(e) => onChange({ sens: Number(e.target.value) })} />
          </label>
          <label className="flex items-center justify-between gap-3 text-base">
            يۇقىرى-تۆۋەن قاراشنى ئەكسىچە قىلىش
            <input type="checkbox" checked={save.invertY} onChange={(e) => onChange({ invertY: e.target.checked })} className="size-5" />
          </label>
          <label className="flex flex-col gap-2 text-base">
            ئاۋاز
            <input type="range" min={0} max={1} step={0.01} value={save.volume} onChange={(e) => onChange({ volume: Number(e.target.value) })} />
          </label>
          <div className="flex flex-col gap-2 text-base">
            رەقىب قىيىنلىقى
            <div className="grid grid-cols-3 gap-3">
              {DIFFICULTIES.map((d) => (
                <InkOption
                  key={d.id}
                  tone="violet"
                  selected={save.difficulty === d.id}
                  className="h-12 text-center font-display text-lg"
                  onClick={() => onChange({ difficulty: d.id })}
                >
                  {d.name}
                </InkOption>
              ))}
            </div>
            <p className="text-sm leading-ug text-muted">پەقەت بىنەپشە گۇرۇپپىغا تەسىر قىلىدۇ؛ سەپداشلىرىڭىز ئۆزگەرمەيدۇ.</p>
          </div>
          <div className="flex flex-col gap-2 text-base">
            گرافىكا
            <div className="grid grid-cols-2 gap-3">
              {(["low", "high"] as Quality[]).map((q) => (
                <InkOption key={q} selected={save.quality === q} className="h-12 text-center font-display text-lg" onClick={() => onChange({ quality: q })}>
                  {q === "low" ? "راۋان" : "ئېنىق"}
                </InkOption>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function HowTo({ onBack }: { onBack: () => void }) {
  const rows: { title: string; keys: string[]; text: string }[] = [
    { title: "ھەرىكەت", keys: ["WASD", "↑↓←→"], text: "ئالدىغا، كەينىگە ۋە يانغا مېڭىڭ؛ يۆنىلىش كۇنۇپكىلىرىمۇ بولىدۇ. A سولغا، D ئوڭغا يانتۇ ماڭىدۇ." },
    { title: "نىشان", keys: ["مائۇس", "Q", "E"], text: "چېكىپ سۆرەڭ ياكى نۇربەلگىنى قۇلۇپلاڭ. كۇنۇپكا ياقتۇرسىڭىز Q ۋە E بىلەن بۇرۇلۇڭ." },
    { title: "ئېتىش", keys: ["سول چېكىش"], text: "پۈركۈگۈچ ئېقىتىدۇ، دومىلاتقۇچ ئىتتىرىدۇ، توپلىغۇچ كۈچ توپلايدۇ، پارتلاتقۇچ ئېگىز ئاتىدۇ." },
    { title: "سەكرەش", keys: ["Space"], text: "دومىلىتىۋاتقاندا سەكرىسىڭىز، چاچرىتىش تېخىمۇ يىراققا ئۇچىدۇ." },
    { title: "ئۈزۈش", keys: ["Shift"], text: "ئۆز سىياھىڭىزدا بېسىپ تۇرسىڭىز، تېز ئۈزۈپ سىياھ تولۇقلايسىز. رەقىب سىياھى سىزنى ئاستىلىتىدۇ ۋە بويايدۇ." },
    { title: "قوشۇمچە / ئالاھىدە", keys: ["ئوڭ چېكىش", "C", "F"], text: "قوشۇمچە قورال ئۈچۈن ئوڭ چېكىش ياكى C. ئالاھىدە ماھارەت ئۆلچىگۈچى تولغاندا F نى بېسىڭ." },
    { title: "نەتىجە تاختىسى", keys: ["Tab"], text: "مۇسابىقە جەريانىدا Tab نى بېسىپ تۇرسىڭىز، ھەممە ئويۇنچىنىڭ بوياش نومۇرى ۋە چاچرىتىشلىرى كۆرۈنىدۇ." },
    { title: "چاچرىتىلىش", keys: [], text: "ساغلاملىق بالدىقى يوق. پۈتۈنلەي سىياھقا بويالسىڭىز، بازىدا قايتا پەيدا بولىسىز." },
    { title: "غەلىبە", keys: [], text: "ئۈچ مىنۇت توشقاندا مەيداننىڭ بىنەپشە گۇرۇپپىدىن كۆپرەك قىسمىغا ئىگە بولۇڭ." },
  ];
  return (
    <div className="absolute inset-0 z-30 overflow-y-auto">
      <div className="mx-auto flex max-w-xl flex-col gap-4 p-4 pb-12">
        <BackButton onBack={onBack} />
        <h2 className="mt-2 font-display text-4xl">ئويناش ئۇسۇلى</h2>
        <div className="panel divide-y divide-foam/15 p-2">
          {rows.map((r) => (
            <div key={r.title} className="px-3 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display text-lg text-orange">{r.title}</p>
                {r.keys.length ? (
                  <span className="ms-auto flex flex-wrap gap-1.5">
                    {r.keys.map((k) => (
                      <Kbd key={k}>{k}</Kbd>
                    ))}
                  </span>
                ) : null}
              </div>
              <p className="text-sm leading-ug text-foam">{r.text}</p>
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
        <BackButton onBack={onBack} />
        <h2 className="mt-2 font-display text-4xl">ئويۇن ھەققىدە</h2>
        <section className="panel p-5 leading-ug">
          <p className="font-display text-2xl text-orange">سىياھ دولقۇنى: زېمىن جېڭى</p>
          <p className="mt-3">4 گە 4 زېمىن تالىشىش ئېتىش ئويۇنى — ئەسلىي ئىجادىيەت. Claude Opus 5.5 بىلەن ياسالدى.</p>
          <p className="mt-3 text-sm leading-ug text-muted">
            پېرسوناژلار، مەيدانلار ۋە بارلىق قوراللار ئەسلىي ئىجادىيەت. Nintendo نىڭ ھېچقانداق پېرسوناژى، ئىسمى ياكى ماتېرىيالى ئىشلىتىلمىدى. شەكىل، سىياھ ۋە
            ئاۋازلارنىڭ ھەممىسى توركۆرگۈچتە ھاسىل قىلىنىدۇ.
          </p>
          <p className="mt-4 font-display text-sm text-sun">{VERSION}</p>
        </section>
      </div>
    </div>
  );
}

function TeamTable({ board, team, pct, mvp }: { board: BoardRow[]; team: "orange" | "violet"; pct: number; mvp: number }) {
  const rows = board.map((r, idx) => ({ ...r, idx })).filter((r) => r.team === team).sort((a, b) => b.points - a.points);
  const tone = team === "orange" ? "text-orange" : "text-violet";
  return (
    <div className={`board-team board-${team}`}>
      <div className="flex items-baseline justify-between px-2">
        <p className={`font-display text-lg ${tone}`}>{team === "orange" ? "ئاپېلسىن" : "بىنەپشە"}</p>
        <p className={`font-display text-2xl ${tone}`}>{Math.round(pct * 100)}%</p>
      </div>
      <table className="w-full text-sm">
        <thead className="text-muted">
          <tr>
            <th className="px-2 text-start font-normal">ئويۇنچى</th>
            <th className="px-1 font-normal">نومۇر</th>
            <th className="px-1 font-normal">چاچرىتىش</th>
            <th className="px-1 font-normal">يۇيۇلۇش</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.idx} className={`${r.isPlayer ? "board-me" : ""} ${r.alive ? "" : "opacity-55"}`}>
              <td className="px-2 py-1">
                <span className="flex items-center gap-1.5 font-display text-base leading-7">
                  {r.idx === mvp ? <Crown className="size-4 shrink-0 text-sun" aria-label="ئەڭ ياخشى ئويۇنچى" /> : null}
                  {r.name}
                  {r.isPlayer ? <span className="text-xs text-sun">(سىز)</span> : null}
                </span>
                <span className="block text-xs leading-5 text-muted">{weaponById(r.weapon).name}</span>
              </td>
              <td className="px-1 text-center font-display text-base">{r.points}</td>
              <td className="px-1 text-center font-display text-base">{r.splats}</td>
              <td className="px-1 text-center font-display text-base">{r.deaths}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Scoreboard({ board, orange, blue }: { board: BoardRow[]; orange: number; blue: number }) {
  const mvp = mvpIndex(board);
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <TeamTable board={board} team="orange" pct={orange} mvp={mvp} />
      <TeamTable board={board} team="violet" pct={blue} mvp={mvp} />
    </div>
  );
}

function Hud({
  hud,
  touch,
  reward,
  onPause,
  onResume,
  onMenu,
  onAgain,
}: {
  hud: HudSnap;
  touch: boolean;
  reward: Reward | null;
  onPause: () => void;
  onResume: () => void;
  onMenu: () => void;
  onAgain: () => void;
}) {
  const [boardOpen, setBoardOpen] = useState(false);
  // Only hijack Tab during live play so it still moves focus on the pause and results screens.
  const inPlayRef = useRef(false);
  inPlayRef.current = hud.phase !== "ended" && !hud.paused;
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Tab" || !inPlayRef.current) return;
      e.preventDefault();
      setBoardOpen(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Tab") setBoardOpen(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const subName = SUBS.find((s) => s.id === hud.sub)?.name ?? "قوشۇمچە";
  const spName = SPECIALS.find((s) => s.id === hud.specialId)?.name ?? "ئالاھىدە";
  const live = hud.phase === "live" && !hud.paused;
  const finalCount = live && hud.time <= 10;
  const lowInk = live && hud.respawn <= 0 && hud.ink < 0.15 && !hud.swimming;
  const specialReady = hud.special >= 1 && hud.respawn <= 0;
  const showBoard = boardOpen && hud.phase !== "ended" && !hud.paused;
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
        <div className="rounded-sticker bg-navy/80 px-3 py-1">
          <p className="font-display text-sm text-orange">ئاپېلسىن</p>
          <p className="font-display text-2xl leading-8">{Math.round(hud.orange * 100)}%</p>
        </div>
        <div className="flex flex-col items-center">
          <p
            className={`font-display text-3xl transition-transform ${
              finalCount ? "clock-final scale-125 text-orange" : live && hud.time <= 60 ? "text-sun" : "text-foam"
            }`}
          >
            {clock(hud.time)}
          </p>
          <div className="mt-1 flex h-3 w-40 overflow-hidden rounded-full bg-navy md:w-64">
            <span className="bg-orange transition-[width] duration-300" style={{ width: `${hud.orange * 100}%` }} />
            <span className="ms-auto bg-violet transition-[width] duration-300" style={{ width: `${hud.blue * 100}%` }} />
          </div>
        </div>
        <div className="rounded-sticker bg-navy/80 px-3 py-1 text-end">
          <p className="font-display text-sm text-violet">بىنەپشە</p>
          <p className="font-display text-2xl leading-8">{Math.round(hud.blue * 100)}%</p>
        </div>
      </div>

      <div className="pointer-events-auto absolute top-20 right-3 flex items-start gap-2">
        <InkButton className="h-11 ps-1.5 pe-3 text-base" icon={<Pause className="size-4" />} onClick={onPause}>
          توختىتىش
        </InkButton>
        {touch ? (
          <InkButton
            className="h-11 ps-1.5 pe-3 text-base"
            icon={<ListOrdered className="size-4" />}
            aria-pressed={boardOpen}
            onClick={() => setBoardOpen((v) => !v)}
          >
            نەتىجە
          </InkButton>
        ) : null}
      </div>

      <div className="absolute top-24 left-3 flex max-w-xs flex-col gap-1">
        {hud.feed.map((line) => (
          <p key={line.id} className="rounded-sticker bg-navy/75 px-2 py-0.5 text-sm leading-7">
            {line.text}
          </p>
        ))}
      </div>

      {hud.banner ? (
        <p key={hud.banner} className="hud-banner absolute top-1/3 left-1/2 -translate-x-1/2 font-display text-5xl whitespace-nowrap text-sun md:text-6xl">{hud.banner}</p>
      ) : null}

      {hud.countdown > 0 && hud.phase !== "ended" ? (
        <p className="absolute top-[42%] left-1/2 -translate-x-1/2 font-display text-7xl text-foam">{Math.ceil(hud.countdown)}</p>
      ) : null}

      {finalCount ? (
        <p className="final-count absolute top-[18%] left-1/2 -translate-x-1/2 font-display text-8xl text-orange" key={Math.ceil(hud.time)}>
          {Math.ceil(hud.time)}
        </p>
      ) : null}

      {hud.respawn > 0 ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-navy/45">
          <p className="font-display text-2xl">دولقۇنغا قايتىۋاتىسىز</p>
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
        <span className="hit-mark" style={{ opacity: hud.hit, transform: `rotate(45deg) scale(${1.25 - hud.hit * 0.25})` }} aria-hidden>
          <span />
          <span />
          <span />
          <span />
        </span>
        <span className="kill-splat" style={{ opacity: hud.kill, transform: `scale(${2.6 - hud.kill * 1.2}) rotate(${hud.kill * 40}deg)` }} aria-hidden />
      </div>

      {lowInk ? (
        <p className="low-ink absolute top-[calc(50%+2.4rem)] left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-navy/85 px-3 py-0.5 text-sm whitespace-nowrap text-orange">
          سىياھ ئاز —{touch ? null : <Kbd>Shift</Kbd>}ئۈزۈپ تولۇقلاڭ
        </p>
      ) : null}

      <div className={`absolute right-3 flex flex-col items-center ${touch ? "bottom-52" : "bottom-4"} md:w-72`}>
        {specialReady ? (
          <p className="special-ready-tag mb-2 flex items-center gap-1.5 rounded-full bg-violet px-3 text-sm text-foam">
            <Sparkles className="size-4" /> {spName} تەييار{touch ? null : <Kbd>F</Kbd>}
          </p>
        ) : null}
        <div className="mb-2 flex items-center gap-2 text-sm whitespace-nowrap text-foam">
          <span>{weaponById(hud.weapon).name}</span>
          <span className="text-muted">·</span>
          <span className="text-muted">{subName}</span>
          <span className="text-muted">·</span>
          <span className={hud.special >= 1 ? "text-sun" : "text-muted"}>{spName}</span>
        </div>
        <div className="flex items-end gap-2">
          <div className={`h-16 w-5 overflow-hidden rounded-full border-2 bg-navy ${lowInk ? "ink-low border-orange" : "border-foam"}`}>
            <div className="w-full bg-orange" style={{ height: `${hud.ink * 100}%`, marginTop: `${(1 - hud.ink) * 100}%` }} />
          </div>
          <div className={`h-10 w-24 overflow-hidden rounded-full border-2 border-foam bg-navy ${specialReady ? "special-ready" : ""}`}>
            <div className="h-full bg-violet" style={{ width: `${hud.special * 100}%` }} />
          </div>
        </div>
        {!touch ? (
          <p className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-sm text-foam/85">
            {[
              ["Shift", "ئۈزۈش"],
              ["ئوڭ چېكىش", "قوشۇمچە"],
              ["F", "ئالاھىدە"],
              ["Tab", "نەتىجە"],
            ].map(([key, action]) => (
              <span key={key} className="flex items-center gap-1.5 whitespace-nowrap">
                <Kbd>{key}</Kbd>
                {action}
              </span>
            ))}
          </p>
        ) : null}
      </div>

      {showBoard ? (
        <div
          className={`absolute inset-x-3 mx-auto max-w-3xl ${touch ? "pointer-events-auto top-32" : "top-24"}`}
          onClick={touch ? () => setBoardOpen(false) : undefined}
        >
          <div className="panel max-h-[70vh] overflow-y-auto p-4">
            <Scoreboard board={hud.board} orange={hud.orange} blue={hud.blue} />
          </div>
        </div>
      ) : null}

      {hud.paused ? (
        <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-navy/70 p-4">
          <div className="panel flex w-full max-w-sm flex-col gap-5 p-5 pb-8">
            <h2 className="font-display text-4xl">توختىتىلدى</h2>
            <InkButton tone="orange" className="h-12 ps-1.5 pe-4 text-lg" icon={<Play className="size-4" />} onClick={onResume}>
              داۋاملاشتۇرۇش
            </InkButton>
            <InkButton className="h-12 ps-1.5 pe-4 text-lg" icon={<House className="size-4" />} onClick={onMenu}>
              باش بەتكە قايتىش
            </InkButton>
          </div>
        </div>
      ) : null}

      {hud.phase === "ended" && hud.result ? (
        <div className="pointer-events-auto absolute inset-0 flex items-center justify-center overflow-y-auto bg-navy/72 p-4">
          <div className="panel my-auto w-full max-w-3xl p-5 pb-9 md:p-6 md:pb-9">
            <span className="ikat-strip" aria-hidden />
            <div className="mt-3 text-center">
              <p className="font-display text-base text-sun">مۇسابىقە ئاخىرلاشتى</p>
              <h2 className="mt-1 font-display text-4xl leading-[1.5]">
                {hud.result.winner === "orange"
                  ? "ئاپېلسىن گۇرۇپپا زېمىننى ئالدى"
                  : hud.result.winner === "violet"
                    ? "بىنەپشە گۇرۇپپا زېمىننى ئالدى"
                    : "تەڭ-تەڭ"}
              </h2>
              <div className="result-bar mx-auto mt-3 max-w-md">
                <span className="bg-orange" style={{ width: `${hud.result.orange * 100}%` }} />
                <span className="ms-auto bg-violet" style={{ width: `${hud.result.blue * 100}%` }} />
              </div>
              <p className="mt-2 text-sm text-muted">
                سىز {hud.result.points} نومۇر بويىدىڭىز · {hud.result.splats} رەقىبنى چاچرىتتىڭىز · {hud.result.deaths} قېتىم يۇيۇلدىڭىز
              </p>
              {reward ? (
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm">
                  <span className="reward-chip ink-orange">
                    <Sparkles className="size-4" /> <span dir="ltr">+{reward.xp}</span> تەجرىبە
                  </span>
                  {reward.levelUp ? (
                    <span className="reward-chip ink-violet">
                      <Crown className="size-4" /> دەرىجە {reward.levelUp} گە ئۆستىڭىز!
                    </span>
                  ) : null}
                  {reward.record ? (
                    <span className="reward-chip ink-foam">
                      <Trophy className="size-4" /> يېڭى رېكورت!
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="mt-5">
              <Scoreboard board={hud.result.board} orange={hud.result.orange} blue={hud.result.blue} />
            </div>
            <div className="mx-auto mt-6 flex max-w-md flex-col gap-5">
              <InkButton tone="orange" className="h-12 ps-1.5 pe-4 text-lg" icon={<RotateCcw className="size-4" />} onClick={onAgain}>
                يەنە ئويناش
              </InkButton>
              <InkButton className="h-12 ps-1.5 pe-4 text-lg" icon={<House className="size-4" />} onClick={onMenu}>
                باش بەت
              </InkButton>
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
    <div className="pointer-events-none absolute inset-0 z-30">
      <div
        className="pointer-events-auto absolute top-32 right-0 bottom-28 left-1/3"
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
        className="pointer-events-auto absolute bottom-6 left-4 h-32 w-32 rounded-full border-2 border-foam/80 bg-navy/50"
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
      <div className="pointer-events-auto absolute right-4 bottom-6 grid grid-cols-2 gap-x-2 gap-y-3">
        <HoldButton label="ئۈزۈش" icon={<Waves className="size-4" />} onHold={(v) => (input.swim = v)} />
        <HoldButton label="سەكرەش" icon={<Zap className="size-4" />} onHold={(v) => (input.jump = v)} />
        <HoldButton label="قوشۇمچە" icon={<Bomb className="size-4" />} onHold={(v) => (input.bomb = v)} />
        <HoldButton label="ئالاھىدە" tone="violet" icon={<ShowerHead className="size-4" />} onHold={(v) => (input.special = v)} />
        <HoldButton label="ئېتىش" tone="orange" icon={<Crosshair className="size-5" />} wide onHold={(v) => (input.fire = v)} />
      </div>
    </div>
  );
}

function HoldButton({
  label,
  icon,
  onHold,
  wide,
  tone = "foam",
}: {
  label: string;
  icon: ReactNode;
  onHold: (v: boolean) => void;
  wide?: boolean;
  tone?: Tone;
}) {
  return (
    <InkButton
      tone={tone}
      icon={icon}
      className={`h-12 gap-1.5 ps-1.5 pe-2.5 text-sm ${wide ? "col-span-2 justify-center text-base" : "w-[6.5rem] justify-start"}`}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        onHold(true);
      }}
      onPointerUp={() => onHold(false)}
      onPointerCancel={() => onHold(false)}
    >
      {label}
    </InkButton>
  );
}
