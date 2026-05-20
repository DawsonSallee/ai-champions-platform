import { signIn } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  async function go() {
    "use server";
    await signIn("microsoft-entra-id", { redirectTo: "/dashboard" });
  }

  return (
    <div className="mx-auto max-w-md py-24">
      <div className="card p-8 space-y-6 text-center">
        <div className="mx-auto h-12 w-12 rounded bg-brand text-brand-fg grid place-items-center font-bold text-xl">
          AI
        </div>
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="text-sm text-gray-500">
          Use your organization account to access the AI Champions Platform.
        </p>
        <form action={go}>
          <button className="btn-primary w-full justify-center" type="submit">
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
