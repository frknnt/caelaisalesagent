import Link from "next/link";

import { PageContainer } from "@/components/layout/PageContainer";
import { marketingConsent } from "@/lib/leads/validation";
import { pageMetadata } from "@/lib/site/metadata";

export const metadata = pageMetadata({
  title: "Privacy",
  description:
    "What this website collects, why, and how marketing consent is handled.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <PageContainer width="text" className="pt-8 pb-16 sm:pt-12">
      <h1 className="display-lg font-normal">Privacy</h1>
      <p className="mt-6 text-xl leading-relaxed text-[#3b404a]">
        This page describes what the Cael AI Sales Agent website does with
        personal data. Terms for customer workspaces are agreed separately.
      </p>
      <div className="prose-cael">
        <h2>What we collect</h2>
        <ul>
          <li>
            Contact form: your topic, name, work email, message, and company if
            you give it.
          </li>
          <li>
            Start free form: your name, work email, company, and the agent mode
            and channel you choose.
          </li>
          <li>Sign-in: your email address and password, to open a session.</li>
        </ul>
        <h2>Why we use it</h2>
        <p>
          We use form details to answer your request and, for a start free
          request, to invite you to a workspace. We use sign-in details only to
          verify that it is you.
        </p>
        <h2>Marketing consent</h2>
        <p>
          The consent box is optional and starts unticked. Its wording is: “
          {marketingConsent.text}” We record whether you agreed, the purpose,
          the wording version ({marketingConsent.version}), the time, and the
          page. Without your consent, you do not receive product updates.
        </p>
        <h2>Cookies and tracking</h2>
        <p>
          This website sets no advertising or analytics cookies. If you sign in,
          it sets the cookies needed to keep your session and remember your
          active workspace.
        </p>
        <h2>Your choices</h2>
        <p>
          To ask for a copy, a correction, or deletion of your data, or to
          withdraw consent, write to us through the{" "}
          <Link
            href="/contact?topic=general"
            className="text-violet-ink font-medium underline underline-offset-4"
          >
            contact page
          </Link>
          .
        </p>
      </div>
    </PageContainer>
  );
}
