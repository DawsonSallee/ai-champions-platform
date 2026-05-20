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
      <div>
        <h1 className="text-2xl font-semibold">New intake</h1>
        <p className="mt-1 text-sm text-gray-500">
          Answer the wizard. Tier is assigned deterministically from your
          answers and recorded so an auditor can see why.
        </p>
      </div>
      {!bus.ok && <DbDownBanner message={bus.error} />}
      <IntakeWizard businessUnits={bus.ok ? bus.value : []} />
    </div>
  );
}
