import { Check, FileText, UserRound } from "lucide-react";

import { LogoMark } from "@/components/brand/Logo";

/** Physical-looking control switch used in the security section. */
export function ControlSwitch() {
  return (
    <div
      aria-hidden="true"
      className="relative mx-auto h-[12.5rem] w-[22rem] max-w-full sm:w-[27rem]"
    >
      <div className="absolute top-1/2 right-2 left-20 flex h-[6.5rem] -translate-y-1/2 items-center justify-end gap-3 rounded-full bg-linear-to-b from-[#e3e7ec] to-[#edf0f3] pr-6 shadow-[inset_0_3px_8px_rgb(20_28_45/0.1),0_1px_0_#fff]">
        {[FileText, UserRound, Check].map((Icon, index) => (
          <span
            key={index}
            className="inline-flex size-11 items-center justify-center text-[#7b828d] max-sm:first:hidden"
          >
            <Icon className="size-6" strokeWidth={2.2} />
          </span>
        ))}
      </div>
      <div className="absolute top-1/2 left-0 size-[11rem] -translate-y-1/2 rounded-full bg-[conic-gradient(from_200deg,#fba00b,#e9edf1_38%,#e9edf1_82%,#fba00b)] p-2.5 shadow-[0_26px_40px_-16px_rgb(20_28_45/0.35)]">
        <div className="flex size-full items-center justify-center rounded-full bg-linear-to-b from-white to-[#eef1f4] shadow-[inset_0_2px_3px_#fff]">
          <LogoMark className="size-[4.75rem]" />
        </div>
      </div>
    </div>
  );
}
