import { Link } from "@tanstack/react-router";
import {
  LayoutDashboard,
  LineChart,
  Sparkles,
  ClipboardCheck,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const stages = [
  {
    title: "Capture",
    category: "Farm Records",
    icon: LayoutDashboard,
    description:
      "Record the important activities on your poultry farm in one organised digital system. PoultryPro helps you keep track of egg production, feed consumption, flock numbers, bird age, mortality, health records, inventory, expenses and revenue.",
    detailTitle: "What you can do",
    details: [
      "Record daily egg production by room.",
      "Track feed usage and inventory.",
      "Maintain flock, mortality and health records.",
      "Record farm expenses, sales and other operational activities.",
      "Keep historical records available for review and reporting.",
    ],
    outcome:
      "Your farm information is organised and easier to review, instead of being scattered across notebooks and spreadsheets.",
    example: "A farmer records daily egg production for each room.",
  },
  {
    title: "Understand",
    category: "Farm Analytics",
    icon: LineChart,
    description:
      "PoultryPro turns your recorded farm information into clear performance indicators and reports. See how your birds, egg production, feed consumption and farm finances are performing, and compare results across rooms and time periods.",
    detailTitle: "What you can understand",
    details: [
      "Egg production and laying percentages.",
      "Feed usage and feed costs.",
      "Revenue, recorded expenses and calculated financial indicators.",
      "Mortality trends and historical farm performance.",
      "Differences between rooms, flocks and reporting periods.",
    ],
    note: "Feed margin subtracts feed costs only, excluding labour, electricity, medication, transport and other operating expenses. Where a view values recorded egg production using applicable prices, that value is an estimate, not actual sales revenue. Operating profit uses recorded operating revenue and expenses, and is only as complete as those records. Feed margin is not net profit.",
    outcome:
      "You can see what is happening on your farm and use recorded evidence to understand where attention may be needed.",
    example: "PoultryPro calculates the production trend from the available records.",
  },
  {
    title: "Predict",
    category: "Estimates and Forecasts",
    icon: Sparkles,
    description:
      "Use available farm records, historical trends and relevant weather forecasts to plan ahead. PoultryPro can present record-based estimates and weather-related guidance to help farmers consider possible changes in production, feed requirements and farm conditions.",
    detailTitle: "Assumptions and limitations",
    details: [
      "Estimates depend on the records, assumptions and time period used.",
      "Weather-based guidance depends on the availability and location of weather data.",
      "Estimates are not guarantees of future results.",
      "An estimate is not a validated machine-learning forecast. Such a claim requires an implemented and validated model.",
    ],
    note: "Current planning tools include record-based production estimates, estimated feed-stock coverage and sourced weather guidance. Validated production forecasts and disease-prediction models are not available; future models require research and validation. Advisories are not veterinary diagnoses.",
    outcome:
      "You gain information that can support planning, while understanding the assumptions and limitations behind each estimate.",
    example:
      "Where an applicable estimate is available, PoultryPro presents an estimate with its assumptions and limitations.",
  },
  {
    title: "Recommend",
    category: "Practical Next Steps",
    icon: ClipboardCheck,
    description:
      "When farm records or calculated indicators highlight something unusual, PoultryPro helps you review the supporting information and consider practical next steps. Recommendations explain what was observed, which records support the finding and what the farmer may wish to check.",
    detailTitle: "An example recommendation",
    details: [
      "Observation: Egg production in a room is below its recent recorded trend.",
      "Supporting evidence: Compare the room’s current production with its historical records and confirm that the records are complete.",
      "Suggested checks: Review feed intake, water availability, bird age, environmental conditions and any recent management changes.",
    ],
    note: "This is a prompt for investigation, not a diagnosis of the cause. Missing records are not treated as zero. Current guidance uses transparent calculations and rules, not AI-generated explanations; the expanded Action Centre is preview-only.",
    outcome:
      "Farmers receive clearer guidance on what to investigate, rather than having to interpret every record from scratch.",
    example:
      "A below-trend result prompts the farmer to verify the records and check feed, water and environmental conditions.",
  },
  {
    title: "Act",
    category: "Farmer in Control",
    icon: ShieldCheck,
    description:
      "Once an issue has been reviewed, authorised users can manage the response through the Action Centre when the relevant functionality is available. The intended workflow includes assigning responsibility, recording notes, tracking progress and documenting how the issue was resolved.",
    detailTitle: "How actions can be managed",
    details: [
      "Keep track of issues that need attention.",
      "Assign responsibility where the functionality permits.",
      "Record actions taken and supporting notes.",
      "Review issue status and history.",
      "Maintain accountability across farm operations.",
    ],
    note: "Action Centre workflow: preview only — public release pending. Assigning, tracking and resolving issues with notes and history must not be assumed available on the public platform. Access also depends on farm permissions.",
    outcome:
      "Farm management decisions can become organised actions that are easier to track and review.",
    example:
      "The farmer records the follow-up action using the relevant available functionality. Action Centre tracking remains preview-only.",
  },
];

export function FarmIntelligenceJourney() {
  return (
    <section id="architecture" aria-labelledby="journey-title" className="py-24 scroll-mt-24">
      <div className="container-x">
        <div className="max-w-3xl">
          <span className="text-xs uppercase text-forest font-medium">How PoultryPro Works</span>
          <h2
            id="journey-title"
            className="mt-4 font-display text-4xl md:text-5xl font-semibold leading-tight tracking-normal"
          >
            From Daily Farm Records to Better Decisions
          </h2>
          <p className="mt-5 text-muted-foreground text-lg">
            PoultryPro helps farmers organise their farm records, understand performance, estimate
            what may happen next, identify issues that need attention and manage the actions taken.
            Every stage builds on reliable farm information, while the farmer remains in control.
          </p>
        </div>
        <ol
          aria-label="Five-stage farm management workflow"
          className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-semibold text-primary"
        >
          {stages.map((stage, index) => (
            <li key={stage.title} className="flex items-center gap-3">
              {index > 0 && <ArrowRight aria-hidden="true" className="h-4 w-4 text-gold" />}
              <span>{stage.title}</span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm text-muted-foreground">
          One connected workflow: each stage builds on the records and findings from the stage
          before it. Available tools depend on your plan and the completeness of your records.
        </p>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-5 gap-5">
          {stages.map((stage, index) => (
            <article key={stage.title} className="min-w-0 border-t border-border py-6">
              <div className="flex items-center justify-between">
                <span className="font-display text-5xl font-semibold text-gold">0{index + 1}</span>
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                  <stage.icon aria-hidden="true" className="h-5 w-5" />
                </span>
              </div>
              <div className="mt-4 text-[11px] uppercase text-forest font-medium">
                {stage.category}
              </div>
              <h3 className="mt-1 font-display text-xl font-semibold tracking-normal">
                {stage.title}
              </h3>
              {stage.title === "Act" && (
                <p className="mt-2 text-xs font-semibold text-primary">
                  Preview only · Public release pending
                </p>
              )}
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                {stage.description}
              </p>
              <details className="mt-4 border-y border-border py-3">
                <summary className="cursor-pointer text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                  {stage.detailTitle}
                  <span className="sr-only"> — {stage.title}</span>
                </summary>
                <ul className="mt-3 list-disc pl-4 space-y-2 text-sm text-muted-foreground">
                  {stage.details.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
                {stage.note && (
                  <p className="mt-4 text-sm text-foreground leading-relaxed">{stage.note}</p>
                )}
              </details>
              <p className="mt-4 text-sm leading-relaxed">
                <span className="font-semibold text-primary">The result: </span>
                {stage.outcome}
              </p>
            </article>
          ))}
        </div>
        <p className="mt-5 max-w-3xl text-sm text-muted-foreground">
          Calculations and rule-based alerts are different from AI-generated explanations and
          validated predictions. AI explanations and validated forecasting models are not current
          Action Centre capabilities. Farmers decide what action to take; advisories do not diagnose
          disease.
        </p>

        <div className="mt-12 border-y border-border py-8">
          <span className="text-xs uppercase font-semibold text-primary">
            Illustrative example · Not customer data
          </span>
          <h3 className="mt-3 font-display text-2xl md:text-3xl font-semibold tracking-normal">
            See How It Works on a Real Farm
          </h3>
          <p className="mt-3 text-sm text-muted-foreground">
            An illustrative farm scenario connecting all five stages — not a report of a customer’s
            results.
          </p>
          <ol className="mt-6 grid sm:grid-cols-2 lg:grid-cols-5 gap-5">
            {stages.map((stage, index) => (
              <li key={stage.title} className="min-w-0">
                <h4 className="text-base font-semibold text-primary tracking-normal">
                  {index + 1}. {stage.title}
                </h4>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {stage.example}
                </p>
              </li>
            ))}
          </ol>
        </div>
        <div className="mt-12 max-w-3xl">
          <h3 className="font-display text-3xl font-semibold tracking-normal">
            Better Records. Clearer Insights. More Informed Decisions.
          </h3>
          <p className="mt-4 text-muted-foreground">
            PoultryPro helps you understand your farm through organised records, transparent
            calculations, practical guidance and a clearer view of the actions that need attention.
            You remain in control of the decisions made on your farm.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Button asChild className="h-11 rounded-full px-6">
              <Link to="/dashboard">
                Open Dashboard <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-11 rounded-full px-6">
              <Link to="/presentation">
                Explore PoultryPro <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
