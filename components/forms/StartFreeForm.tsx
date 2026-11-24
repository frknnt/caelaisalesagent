"use client";

import { Bot, UserCheck } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { agentModes } from "@/data/home-content";
import { trialChannels } from "@/lib/leads/validation";

import { ChoiceGroup } from "./ChoiceGroup";
import { ConsentFields } from "./ConsentFields";
import { TextField } from "./Field";
import { FormStatus } from "./FormStatus";
import { useLeadForm } from "./useLeadForm";

const modeChoices = agentModes.map((mode) => ({
  id: mode.id,
  label: mode.name,
  detail: mode.tagline,
}));

export function StartFreeForm() {
  const { state, action, pending, onSubmit, statusRef } = useLeadForm();
  const [modeId, setModeId] = useState("inbound-sdr");
  const [channelId, setChannelId] = useState("web");
  const [company, setCompany] = useState("");
  const errors = state.fieldErrors;
  const mode = agentModes.find((item) => item.id === modeId);
  const channel = trialChannels.find((item) => item.id === channelId);

  return (
    <div className="grid items-start gap-2 lg:grid-cols-[1.45fr_1fr]">
      <form
        action={action}
        onSubmit={onSubmit}
        noValidate
        aria-busy={pending}
        className="rounded-card border-line bg-paper space-y-7 border p-5 sm:p-9"
      >
        <input type="hidden" name="kind" value="trial" />
        <FormStatus
          ref={statusRef}
          state={state}
          successTitle="Your agent request is in."
          successText="We will email you an invitation to your workspace."
        />
        <ChoiceGroup
          name="agentMode"
          legend="What should your first agent do?"
          choices={modeChoices}
          value={modeId}
          onChange={setModeId}
        />
        <ChoiceGroup
          name="channel"
          legend="Where should it start?"
          choices={trialChannels}
          value={channelId}
          onChange={setChannelId}
          columns="three"
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            id="name"
            name="name"
            label="Name"
            autoComplete="name"
            required
            error={errors.name}
          />
          <TextField
            id="email"
            name="email"
            type="email"
            label="Work email"
            autoComplete="email"
            required
            error={errors.email}
          />
        </div>
        <TextField
          id="company"
          name="company"
          label="Company"
          autoComplete="organization"
          required
          maxLength={160}
          value={company}
          onChange={(event) => setCompany(event.target.value)}
          error={errors.company}
        />
        <ConsentFields />
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Sending…" : "Start Building Free"}
        </Button>
      </form>

      <aside
        aria-label="Your agent so far"
        className="rounded-card border-line bg-paper border p-5 sm:p-8 lg:sticky lg:top-28"
      >
        <h2 className="text-xl font-medium">Your agent so far</h2>
        <p className="text-body mt-1">{mode?.summary}</p>
        <div className="bg-mist mt-5 rounded-[1.4rem] p-4">
          <p className="text-body flex items-center gap-2 text-sm">
            <Bot className="size-4" aria-hidden="true" />
            First message preview
          </p>
          <p className="bg-paper mt-3 rounded-[1.25rem] rounded-bl-md px-4 py-3 text-[0.9375rem] leading-snug">
            Hi, I’m Cael, an AI agent
            {company.trim() ? ` for ${company.trim()}` : ""}. Ask me anything,
            or ask for a person at any time.
          </p>
        </div>
        <dl className="divide-line mt-5 divide-y">
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-body">Mode</dt>
            <dd className="text-right font-semibold">{mode?.name}</dd>
          </div>
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-body">Starts on</dt>
            <dd className="text-right font-semibold">{channel?.label}</dd>
          </div>
        </dl>
        <p className="bg-amber-soft mt-4 flex gap-3 rounded-2xl p-4 text-[0.9375rem] leading-snug">
          <UserCheck
            className="text-amber-ink mt-0.5 size-5 shrink-0"
            aria-hidden="true"
          />
          <span>
            <b className="text-amber-ink font-semibold">Hands over: </b>
            {mode?.handsOver}
          </span>
        </p>
      </aside>
    </div>
  );
}
