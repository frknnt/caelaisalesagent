"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { contactTopics, type ContactTopic } from "@/lib/leads/validation";

import { ChoiceGroup } from "./ChoiceGroup";
import { ConsentFields } from "./ConsentFields";
import { TextAreaField, TextField } from "./Field";
import { FormStatus } from "./FormStatus";
import { useLeadForm } from "./useLeadForm";

interface ContactFormProps {
  initialTopic: ContactTopic | "";
}

export function ContactForm({ initialTopic }: ContactFormProps) {
  const { state, action, pending, onSubmit, statusRef } = useLeadForm();
  const [topic, setTopic] = useState<string>(initialTopic);
  const errors = state.fieldErrors;
  const isDemo = topic === "demo";

  return (
    <form
      action={action}
      onSubmit={onSubmit}
      noValidate
      aria-busy={pending}
      className="space-y-6"
    >
      <input type="hidden" name="kind" value="contact" />
      <FormStatus
        ref={statusRef}
        state={state}
        successTitle="Thanks. Your message is on its way."
        successText="Someone from the team will reply to the address you gave."
      />
      <ChoiceGroup
        name="topic"
        legend="What would you like to talk about?"
        choices={contactTopics}
        value={topic}
        onChange={setTopic}
        error={errors.topic}
        columns="pill"
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
        optional
        error={errors.company}
      />
      <TextAreaField
        id="message"
        name="message"
        label={isDemo ? "What should the demo cover?" : "Message"}
        optional={isDemo}
        required={!isDemo}
        error={errors.message}
      />
      <ConsentFields />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Sending…" : isDemo ? "Request a Demo" : "Send Message"}
      </Button>
    </form>
  );
}
