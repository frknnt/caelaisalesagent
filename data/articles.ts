import type { Article } from "@/types/content";

export const guides: Article[] = [
  {
    slug: "launch-your-first-agent",
    title: "Launch your first agent",
    description:
      "Pick one job, add approved knowledge, test with real questions, then publish.",
    category: "Getting started",
    readingTime: "5 min read",
    intro:
      "The fastest launches start narrow. One agent, one page, one job. This guide takes you from an empty workspace to an agent you are comfortable putting in front of visitors.",
    sections: [
      {
        heading: "Choose one job",
        paragraphs: [
          "Start with the conversation your team repeats most. For many teams that is the first reply on a pricing or contact page. Choose the agent mode that matches it and leave the others for later.",
        ],
      },
      {
        heading: "Add only knowledge you would sign",
        paragraphs: [
          "The agent answers from pages and documents you approve. If a page is out of date, fix it before you add it. Five accurate pages beat fifty uncertain ones.",
        ],
        list: [
          "Product and service descriptions",
          "Delivery, onboarding, and support terms",
          "Answers your reps already send by email",
        ],
      },
      {
        heading: "Write the handoff before the greeting",
        paragraphs: [
          "Decide when a person takes over and who that person is. A clear handoff makes every other decision easier, because the agent always has somewhere safe to go.",
        ],
      },
      {
        heading: "Test with the awkward questions",
        paragraphs: [
          "Collect ten questions from real emails, including the ones you would rather not answer. Run them in preview and read each reply with its source. Publish when you would be happy to have sent every one.",
        ],
      },
    ],
  },
  {
    slug: "write-qualification-criteria",
    title: "Write qualification criteria that hold up",
    description:
      "Turn what your best rep listens for into rules an agent can apply every time.",
    category: "Qualification",
    readingTime: "6 min read",
    intro:
      "A lead score is only useful if two people would agree on why it is high. Good criteria are short, observable, and tied to something the lead actually said.",
    sections: [
      {
        heading: "Start from closed deals",
        paragraphs: [
          "Look at a handful of deals you won and a handful you lost. List what was true in the first conversation for each. The difference between the two lists is your first draft.",
        ],
      },
      {
        heading: "Keep it to four or five signals",
        paragraphs: [
          "Every extra question costs you replies. Most teams need fit, need, timing, and who decides. Add a budget question only when the answer changes what happens next.",
        ],
        list: [
          "Fit: is this the kind of company you serve well?",
          "Need: can they name the problem in their own words?",
          "Timing: is there a date that matters to them?",
          "Decision: who else will be involved?",
        ],
      },
      {
        heading: "Make unknown a valid answer",
        paragraphs: [
          "If a lead does not say, record that they did not say. An agent that guesses a budget creates work for the rep who has to undo it.",
        ],
      },
      {
        heading: "Review the edges monthly",
        paragraphs: [
          "Read the leads that were just above and just below your threshold. If you disagree with the result, change the rule, not the individual score.",
        ],
      },
    ],
  },
  {
    slug: "design-a-human-handoff",
    title: "Design a handoff people trust",
    description:
      "Decide when a rep steps in, what they see first, and what the visitor is told.",
    category: "Handoff",
    readingTime: "4 min read",
    intro:
      "Handoff is the moment a conversation becomes a relationship. It works when the visitor knows what is happening and the rep does not have to ask anything twice.",
    sections: [
      {
        heading: "Name the triggers",
        paragraphs: [
          "Write down the situations that should always reach a person. A direct request for a human is always on the list.",
        ],
        list: [
          "The visitor asks for a person",
          "The question is about custom terms or a discount",
          "The lead meets your qualified threshold",
          "The agent has no approved source for the answer",
        ],
      },
      {
        heading: "Give the rep a summary, not a transcript",
        paragraphs: [
          "The first screen should show who the lead is, what they want, what has been promised, and the next step. The full conversation stays one click away.",
        ],
      },
      {
        heading: "Tell the visitor",
        paragraphs: [
          "Say that a person is joining and give a realistic time. If nobody is available, say so and offer a time to talk. Never let the agent pretend to be the rep.",
        ],
      },
    ],
  },
  {
    slug: "consent-and-retention",
    title: "Set up consent and retention",
    description:
      "Record why you hold contact data, for how long, and how someone can opt out.",
    category: "Data",
    readingTime: "5 min read",
    intro:
      "Sales conversations contain personal data. Decide up front what you keep, why you keep it, and when it goes, so nobody has to improvise later. This guide is practical guidance, not legal advice.",
    sections: [
      {
        heading: "Separate replying from marketing",
        paragraphs: [
          "Answering someone’s question does not give you permission to market to them. Ask for marketing consent separately, leave it unticked, and make it optional.",
        ],
      },
      {
        heading: "Store the evidence",
        paragraphs: [
          "For each consent, keep the purpose, the version of the text that was shown, the time, and where it was given. If the wording changes, the version changes.",
        ],
      },
      {
        heading: "Choose a retention period",
        paragraphs: [
          "Pick a period for unqualified conversations and a longer one for active opportunities. Shorter is easier to defend. Review both with whoever is responsible for privacy in your company.",
        ],
      },
      {
        heading: "Honor opt-outs everywhere",
        paragraphs: [
          "An opt-out on one channel should stop automated follow-up on every channel. Test this path the same way you test the greeting.",
        ],
      },
    ],
  },
];

export const posts: Article[] = [
  {
    slug: "reply-speed-is-not-the-goal",
    title: "Reply speed is not the goal. A useful first reply is.",
    description:
      "Why the content of the first answer matters more than shaving off another second.",
    category: "Sales conversations",
    readingTime: "4 min read",
    intro:
      "Most teams that look at AI agents start with speed. It is easy to measure and easy to demo. But a fast reply that says nothing only moves the waiting to the next message.",
    sections: [
      {
        heading: "What a visitor is really asking",
        paragraphs: [
          "When someone asks whether you integrate with their tools, they want to know whether buying from you will create work. A reply that answers the literal question and ignores the worry behind it feels quick and unhelpful.",
          "A useful first reply does three things: it answers, it shows where the answer came from, and it offers the next step.",
        ],
      },
      {
        heading: "Say less, with proof",
        paragraphs: [
          "One sentence and a link to the page it came from builds more confidence than four paragraphs of enthusiasm. If there is no approved source, the honest reply is to say so and bring in a person.",
        ],
      },
      {
        heading: "Measure what happens next",
        paragraphs: [
          "Instead of response time alone, look at how many first replies lead to a second message from the visitor. That number tells you whether the answer was worth reading.",
        ],
      },
    ],
  },
  {
    slug: "what-ai-should-never-decide",
    title: "Five things a sales agent should never decide alone",
    description:
      "Prices, discounts, stock, availability, and payments belong to systems and people.",
    category: "Guardrails",
    readingTime: "5 min read",
    intro:
      "A language model is good at understanding what someone wants. It is not a price list. Drawing that line early is what makes an AI agent safe to put in front of customers.",
    sections: [
      {
        heading: "The list",
        paragraphs: [
          "These facts have an owner somewhere in your business. The agent should read them, never compose them.",
        ],
        list: [
          "Price: read from your price list or quote tool",
          "Discount: approved by a person",
          "Stock: read from inventory",
          "Availability: read from a live calendar",
          "Payment status: read from your billing system",
        ],
      },
      {
        heading: "What to do when the system is silent",
        paragraphs: [
          "Connections fail. When the source does not answer, the agent should say that it cannot confirm the detail and hand the conversation over. A short delay is cheaper than a promise you cannot keep.",
        ],
      },
      {
        heading: "Why this helps the sale",
        paragraphs: [
          "Buyers forgive a moment of waiting. They rarely forgive a quote that changes. Clear limits make every other answer easier to believe.",
        ],
      },
    ],
  },
  {
    slug: "follow-up-without-being-a-nuisance",
    title: "How to follow up without becoming a nuisance",
    description:
      "Give every message a reason, every sequence an end, and every lead a way out.",
    category: "Follow-up",
    readingTime: "4 min read",
    intro:
      "Automated follow-up has a bad reputation because most of it ignores the conversation it claims to continue. Three habits fix most of the problem.",
    sections: [
      {
        heading: "Every message needs a reason",
        paragraphs: [
          "Refer to the last thing the lead asked and add something new: an answer, a document, a time to talk. If there is nothing new to add, do not send it.",
        ],
      },
      {
        heading: "Every sequence needs an end",
        paragraphs: [
          "Decide the last message before you write the first. Tell the lead it is the last one and how to pick the conversation back up.",
        ],
      },
      {
        heading: "Every lead needs a way out",
        paragraphs: [
          "Check consent and opt-outs before each send, on every channel. Silence is a signal too. Treat it as one.",
        ],
      },
    ],
  },
  {
    slug: "the-lead-summary-your-rep-will-read",
    title: "The lead summary your rep will actually read",
    description:
      "Four lines that replace a forty-message transcript before a first call.",
    category: "Handoff",
    readingTime: "3 min read",
    intro:
      "Reps skip long notes. If the summary takes longer to read than the conversation, it will not be read at all. Here is a format that fits on one screen.",
    sections: [
      {
        heading: "Four lines",
        paragraphs: ["Write them in this order and stop."],
        list: [
          "Who they are and why they are here",
          "What they asked, in their own words",
          "What they have been told, with the source",
          "The next step and who owns it",
        ],
      },
      {
        heading: "Leave out the adjectives",
        paragraphs: [
          "Words like hot or promising are opinions. A date, a team size, or a quoted sentence is evidence. Let the rep draw the conclusion.",
        ],
      },
      {
        heading: "Mark what is unknown",
        paragraphs: [
          "A summary that says the budget was not discussed is more useful than one that says nothing. It tells the rep exactly where to start.",
        ],
      },
    ],
  },
];

export function findArticle(list: Article[], slug: string) {
  return list.find((article) => article.slug === slug);
}
