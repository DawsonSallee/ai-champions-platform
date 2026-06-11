import { signIn } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  async function go() {
    "use server";
    await signIn("microsoft-entra-id", { redirectTo: "/dashboard" });
  }

  return (
    <div className="mx-auto max-w-md py-24">
      <div className="v3-card v3-card-pad space-y-6 text-center" style={{ padding: 32 }}>
        <div
          className="mx-auto grid place-items-center"
          style={{
            height: 48,
            width: 48,
            borderRadius: 10,
            background: "var(--a)",
            color: "var(--a-fg)",
            fontWeight: 700,
            fontSize: 20,
          }}
        >
          AI
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Sign in</h1>
        <p className="v3-muted" style={{ fontSize: 13 }}>
          Use your organization account to access the AI Champions Platform.
        </p>
        <form action={go}>
          <button
            className="v3-btn-primary"
            style={{ width: "100%", justifyContent: "center" }}
            type="submit"
          >
            Sign in with Microsoft
          </button>
        </form>
        {process.env.DEV_AUTH_BYPASS === "true" && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
            Dev auth bypass is enabled. You're already signed in as the dev
            principal — navigate to{" "}
            <a className="underline" href="/dashboard">
              the dashboard
            </a>
            .
          </p>
        )}
      </div>
    </div>
  );
}
