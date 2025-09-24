import { SimpleOfflineAuth } from "@/components/simple-offline-auth";
import { AuthDebug } from "@/components/debug/auth-debug";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm space-y-6">
        <SimpleOfflineAuth />
        {process.env.NODE_ENV === 'development' && <AuthDebug />}
      </div>
    </div>
  );
}
