import { db } from "@/db/client";
import { businessUnits } from "@/db/schema";
import { IntakeWizard } from "./IntakeWizard";
import { safe } from "@/lib/safe-query";
import { DbDownBanner } from "@/components/DbDownBanner";

export const dynamic = "force-dynamic";

export default async function IntakePage() {
  const bus = await safe(async () => db.select().from(businessUnits));
  return (
    <div className="space-y-6">
      <header className="v3-page-header" style={{ marginBottom: 0 }}>
        <h1 className="v3-headline">New intake</h1>
        <p className="v3-subhead">
          Answer the wizard. Tier is assigned deterministically from your
          answers and recorded so an auditor can see why.
        </p>
      </header>
      {!bus.ok && <DbDownBanner message={bus.error} />}
      <IntakeWizard businessUnits={bus.ok ? bus.value : []} />
    </div>
  );
}
