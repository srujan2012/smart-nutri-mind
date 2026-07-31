import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Permanently deletes the signed-in user's data and auth account. */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = context.userId;

    const tables = ["meals", "grocery_items", "pantry_scans", "daily_metrics", "workouts", "profiles"] as const;
    for (const t of tables) {
      const col = t === "profiles" ? "id" : "user_id";
      const { error } = await supabaseAdmin.from(t).delete().eq(col, uid);
      if (error) throw new Error(`Failed clearing ${t}: ${error.message}`);
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(uid);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
