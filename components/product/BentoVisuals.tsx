import {
  Activity,
  Bell,
  Bot,
  CalendarCheck,
  ChartPie,
  Check,
  Clock,
  Database,
  Globe,
  Headset,
  Inbox,
  Mail,
  MessageCircle,
  Minus,
  Pause,
  Phone,
  Quote,
  RefreshCw,
  Repeat,
  Send,
  Target,
  UserRound,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Disc } from "@/components/ui/Disc";

/** Tilted qualification sheet that bleeds off the card corner. */
export function QualifyVisual() {
  const rows = [
    { label: "Intent", value: "High", met: true },
    { label: "Urgency", value: "This quarter", met: true },
    { label: "Fit", value: "Strong", met: true },
    { label: "Budget", value: "Not shared", met: false },
  ];
  return (
    <div className="absolute inset-0">
      <div className="absolute right-3 -bottom-4 w-[15.5rem] rotate-[-6deg] sm:right-5 sm:w-[17.5rem]">
        <div className="rounded-[1.75rem] bg-linear-to-b from-[#4fd0e8] to-[#1795b1] p-2 pr-2 pb-3 shadow-[0_18px_40px_-14px_rgb(11_113_136/0.55)]">
          <div className="bg-paper rounded-[1.35rem] p-4">
            <p className="flex items-center justify-between font-semibold">
              Lead score
              <span className="font-display text-2xl tabular-nums">86</span>
            </p>
            <ul className="mt-2 space-y-2">
              {rows.map((row) => (
                <li
                  key={row.label}
                  className="flex items-center gap-2.5 text-[0.9375rem]"
                >
                  <span
                    className={
                      row.met
                        ? "bg-amber text-ink inline-flex size-6 items-center justify-center rounded-full"
                        : "bg-fog text-body inline-flex size-6 items-center justify-center rounded-full"
                    }
                  >
                    {row.met ? (
                      <Check className="size-3.5" strokeWidth={3} />
                    ) : (
                      <Minus className="size-3.5" strokeWidth={3} />
                    )}
                  </span>
                  <span className="font-medium">{row.label}</span>
                  <span className="text-body ml-auto">{row.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <Disc size="sm" className="absolute bottom-10 left-9 max-xl:hidden">
        <Target className="text-mint-ink size-5" />
      </Disc>
    </div>
  );
}

/** Follow-up pill over a dotted field, with the earlier touches behind it. */
export function MomentumVisual() {
  return (
    <div className="absolute inset-0">
      <div className="halftone absolute inset-x-0 top-0 h-[85%] [mask-image:radial-gradient(70%_80%_at_50%_35%,#000_20%,transparent_75%)]" />
      <div className="absolute inset-x-6 top-14 sm:inset-x-9">
        <div className="border-line bg-paper shadow-float relative z-20 flex items-center gap-3 rounded-full border py-2.5 pr-3 pl-2.5">
          <Disc size="sm">
            <Mail className="text-cyan-ink size-5" />
          </Disc>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block font-semibold">Follow-up ready</span>
            <span className="text-body block text-sm">
              Answers the rollout question
            </span>
          </span>
          <span className="bg-ink text-paper inline-flex size-8 items-center justify-center rounded-full">
            <Send className="size-4" />
          </span>
        </div>
        <div className="border-line relative z-10 mx-5 -mt-7 h-12 rounded-full border bg-[#f3f5f7] shadow-card" />
        <div className="border-line mx-10 -mt-8 h-12 rounded-full border bg-[#e9ecf0]" />
      </div>
    </div>
  );
}

/** Clock dial: cyan arc marks free time, the amber hand picks a slot. */
export function MeetingDialVisual() {
  const center = 190;
  const hours = [
    { label: "8", angle: -150 },
    { label: "9", angle: -120 },
    { label: "10", angle: -90 },
    { label: "11", angle: -60 },
    { label: "12", angle: -30 },
    { label: "1", angle: 0 },
    { label: "2", angle: 30 },
    { label: "3", angle: 60 },
  ];
  const at = (angle: number, radius: number) => {
    const radians = ((angle - 45) * Math.PI) / 180;
    // Rounded so server and client markup match exactly.
    return {
      x: Math.round((center + radius * Math.cos(radians)) * 100) / 100,
      y: Math.round((center + radius * Math.sin(radians)) * 100) / 100,
    };
  };
  const hand = at(30, 96);
  const arcStart = at(-150, 168);
  const arcEnd = at(38, 168);
  return (
    <svg
      viewBox="0 0 380 300"
      className="absolute -right-8 bottom-0 w-[21.5rem] max-w-none sm:-right-10 sm:w-[23.5rem]"
    >
      <defs>
        <radialGradient id="dial-face" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#eef1f5" />
        </radialGradient>
        <linearGradient id="dial-hand" x1="0" x2="1" y1="1" y2="0">
          <stop offset="0%" stopColor="#8a4b0a" />
          <stop offset="100%" stopColor="#fba00b" />
        </linearGradient>
      </defs>
      <circle cx={center} cy={center} r="160" fill="url(#dial-face)" />
      <circle
        cx={center}
        cy={center}
        r="160"
        fill="none"
        stroke="#e3e7ec"
        strokeWidth="1.5"
      />
      <path
        d={`M ${arcStart.x} ${arcStart.y} A 168 168 0 1 1 ${arcEnd.x} ${arcEnd.y}`}
        fill="none"
        stroke="#33c3de"
        strokeWidth="5"
        strokeLinecap="round"
      />
      {hours.map((hour) => {
        const tickOuter = at(hour.angle, 156);
        const tickInner = at(hour.angle, 147);
        const text = at(hour.angle, 128);
        return (
          <g key={hour.label}>
            <line
              x1={tickOuter.x}
              y1={tickOuter.y}
              x2={tickInner.x}
              y2={tickInner.y}
              stroke="#0b0c0f"
              strokeWidth="2"
            />
            <text
              x={text.x}
              y={text.y + 6}
              textAnchor="middle"
              fontSize="18"
              fill="#0b0c0f"
              fontWeight="500"
            >
              {hour.label}
            </text>
          </g>
        );
      })}
      <text
        x={center}
        y={center - 46}
        textAnchor="middle"
        fontSize="17"
        fontWeight="600"
        fill="#0b0c0f"
      >
        Thu, 2:00 PM
      </text>
      <circle
        cx={center}
        cy={center}
        r="32"
        fill="#ffffff"
        stroke="#dde2e8"
        strokeWidth="9"
      />
      <line
        x1={center}
        y1={center}
        x2={hand.x}
        y2={hand.y}
        stroke="url(#dial-hand)"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <circle cx={center} cy={center} r="8" fill="#0b0c0f" />
      <circle cx={center} cy={center} r="3" fill="#ffffff" />
    </svg>
  );
}

/** Four channels feeding one inbox tile. */
export function OmnichannelVisual() {
  const nodes = [
    { icon: Globe, position: "top-11 left-[13%]" },
    { icon: MessageCircle, position: "top-11 right-[13%]" },
    { icon: Mail, position: "top-[10.5rem] left-[13%]" },
    { icon: Phone, position: "top-[10.5rem] right-[13%]" },
  ];
  return (
    <div className="absolute inset-0">
      <svg
        viewBox="0 0 400 240"
        preserveAspectRatio="none"
        className="absolute inset-x-[18%] top-[4.4rem] h-[8rem] w-[64%]"
      >
        <path
          d="M10 0V70Q10 100 60 100H340Q390 100 390 70V0M10 240V170Q10 140 60 140H340Q390 140 390 170V240"
          fill="none"
          stroke="#cfd5dd"
          strokeWidth="1.5"
          strokeDasharray="5 5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className="text-ink absolute top-[5rem] left-1/2 inline-flex size-[6.75rem] -translate-x-1/2 items-center justify-center rounded-[2rem] bg-linear-to-b from-[#4fd0e8] to-[#2bb9d5] shadow-[inset_0_2px_2px_rgb(255_255_255/0.5),0_20px_34px_-12px_rgb(43_185_213/0.65)]">
        <Inbox className="size-11 text-white" strokeWidth={1.8} />
      </span>
      {nodes.map(({ icon: Icon, position }) => (
        <span key={position} className={`absolute ${position}`}>
          <Disc>
            <Icon className="size-6" strokeWidth={1.9} />
          </Disc>
        </span>
      ))}
    </div>
  );
}

/** Raised control panel with the team's own criteria. */
export function CriteriaVisual() {
  const rows = [
    { label: "Team size", value: "25+ reps", width: "82%" },
    { label: "Timing", value: "This quarter", width: "64%" },
    { label: "Decision", value: "Involved", width: "48%" },
  ];
  return (
    <div className="absolute inset-0">
      <div className="absolute top-8 -right-6 left-9 rounded-l-[2rem] rounded-r-none bg-linear-to-b from-[#f9fafb] to-[#eef1f4] p-5 pr-11 shadow-[inset_0_0_0_7px_#e4e8ed,0_26px_40px_-18px_rgb(20_28_45/0.28)]">
        <ul className="space-y-4 p-2">
          {rows.map((row) => (
            <li key={row.label}>
              <span className="flex justify-between gap-3 text-[0.9375rem]">
                <span className="font-semibold">{row.label}</span>
                <span className="text-body">{row.value}</span>
              </span>
              <span className="relative mt-2.5 block h-2.5 rounded-full bg-[#dde2e8]">
                <span
                  className="bg-violet absolute inset-y-0 left-0 rounded-full"
                  style={{ width: row.width }}
                />
                <span
                  className="disc-surface absolute top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{ left: row.width }}
                />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Amber follow-up button with the touches it schedules orbiting it. */
export function FollowUpVisual() {
  const outer = [
    { icon: ChartPie, position: "top-9 left-[5%]" },
    { icon: CalendarCheck, position: "top-9 right-[5%]" },
    { icon: Clock, position: "top-[10.75rem] left-[5%]" },
    { icon: Activity, position: "top-[10.75rem] right-[5%]" },
  ];
  return (
    <div className="absolute inset-0">
      <svg
        viewBox="0 0 440 240"
        className="absolute top-6 left-1/2 h-60 w-[27.5rem] max-w-none -translate-x-1/2"
      >
        <path
          d="M120 30Q60 120 120 210M320 30Q380 120 320 210M62 60Q32 120 62 180M378 60Q408 120 378 180"
          fill="none"
          stroke="#d3d8df"
          strokeWidth="1.5"
          strokeDasharray="5 6"
        />
      </svg>
      <span className="absolute top-[5.25rem] left-1/2 inline-flex size-[7.5rem] -translate-x-1/2 items-center justify-center rounded-full bg-linear-to-b from-[#ffb02e] to-[#fb9a05] shadow-[inset_0_2px_3px_rgb(255_255_255/0.5),0_24px_40px_-14px_rgb(251_160_11/0.75)]">
        <Repeat className="size-12 text-white" strokeWidth={2} />
      </span>
      {outer.map(({ icon: Icon, position }) => (
        <span key={position} className={`absolute ${position}`}>
          <Disc>
            <Icon className="size-6" strokeWidth={1.9} />
          </Disc>
        </span>
      ))}
      <Disc size="sm" className="absolute top-[7.6rem] left-[17%]">
        <Bell className="size-5" strokeWidth={1.9} />
      </Disc>
      <Disc size="sm" className="absolute top-[7.6rem] right-[17%]">
        <Mail className="size-5" strokeWidth={1.9} />
      </Disc>
    </div>
  );
}

/** Contact, deal and activity records kept in step. */
export function CrmSyncVisual() {
  return (
    <div className="absolute inset-0">
      <div className="halftone absolute inset-x-0 bottom-0 h-52 [mask-image:radial-gradient(75%_90%_at_50%_100%,#000_45%,transparent_78%)]" />
      <p className="border-line bg-paper shadow-card absolute bottom-[12.6rem] left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border px-4 py-2 text-[0.9375rem] font-medium whitespace-nowrap">
        <RefreshCw className="text-mint-ink size-4" />
        Stage moved to Qualified
      </p>
      <svg
        viewBox="0 0 220 60"
        className="absolute bottom-[9.2rem] left-1/2 h-14 w-[13.75rem] -translate-x-1/2"
      >
        <path
          d="M110 0V60M110 20H24Q4 20 4 40V60M110 20H196Q216 20 216 40V60"
          fill="none"
          stroke="#cbd1da"
          strokeWidth="1.5"
          strokeDasharray="5 5"
        />
      </svg>
      <div className="absolute inset-x-0 bottom-12 flex items-center justify-center gap-3">
        <Disc size="xl">
          <UserRound className="text-cyan-ink size-9" strokeWidth={1.9} />
        </Disc>
        <Disc size="xl" className="bg-none! bg-paper!">
          <Database className="size-9" strokeWidth={1.9} />
        </Disc>
        <Disc size="xl">
          <Users className="text-violet size-9" strokeWidth={1.9} />
        </Disc>
      </div>
    </div>
  );
}

/** Tray with the handoff states: agent paused, rep joined. */
export function HandoffVisual() {
  return (
    <div className="absolute inset-0">
      <div className="absolute top-[4.75rem] left-1/2 w-[19rem] -translate-x-1/2 rounded-[2rem] bg-linear-to-b from-[#eceff3] to-[#dfe3e9] px-4 pt-[4.4rem] pb-4 shadow-[inset_0_2px_2px_rgb(255_255_255/0.8),0_22px_34px_-18px_rgb(20_28_45/0.35)]">
        <div className="grid grid-cols-2 gap-2.5">
          <span className="disc-surface flex items-center gap-2.5 rounded-[1.25rem] px-3.5 py-3">
            <Bot className="text-body size-5" />
            <span className="leading-tight">
              <span className="block text-[0.9375rem] font-semibold">
                Agent
              </span>
              <span className="text-body flex items-center gap-1 text-sm">
                <Pause className="size-3.5" />
                Silent
              </span>
            </span>
          </span>
          <span className="disc-surface flex items-center gap-2.5 rounded-[1.25rem] px-3.5 py-3">
            <UserRound className="text-mint-ink size-5" />
            <span className="leading-tight">
              <span className="block text-[0.9375rem] font-semibold">
                Jonas
              </span>
              <span className="text-mint-ink flex items-center gap-1 text-sm font-medium">
                <Check className="size-3.5" strokeWidth={3} />
                Replying
              </span>
            </span>
          </span>
        </div>
      </div>
      <span className="absolute top-6 left-1/2 -translate-x-1/2 rounded-full bg-[#e4e8ed] p-1.5">
        <Disc size="xl">
          <Headset className="size-10 text-[#8a919c]" strokeWidth={1.9} />
        </Disc>
      </span>
    </div>
  );
}

/** A stack of conversation insights, newest in front. */
export function IntelligenceVisual() {
  return (
    <div className="absolute inset-0">
      <div className="halftone absolute inset-x-0 bottom-0 h-56 [mask-image:linear-gradient(to_bottom,transparent,#000_70%)]" />
      <div className="absolute inset-x-5 top-10">
        <div className="border-line bg-paper shadow-float relative z-20 rounded-[1.5rem] border p-5">
          <p className="flex gap-3 leading-snug font-medium">
            <Quote className="text-amber mt-0.5 size-5 shrink-0" />
            We need a security review before we sign.
          </p>
          <div className="mt-3.5 flex flex-wrap gap-2 pl-8">
            <Badge tone="amber">Objection</Badge>
            <Badge tone="cyan">Security</Badge>
          </div>
        </div>
        <div className="border-line relative z-10 mx-5 -mt-9 h-14 rounded-[1.5rem] border bg-[#f2f4f7] shadow-card" />
        <div className="border-line mx-10 -mt-9 h-14 rounded-[1.5rem] border bg-[#e7ebf0]" />
      </div>
    </div>
  );
}
