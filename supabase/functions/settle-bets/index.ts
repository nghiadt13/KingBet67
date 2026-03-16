import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Find unsettled FINISHED or CANCELLED matches
    const { data: unsettled, error: fetchErr } = await supabaseAdmin
      .from("matches")
      .select("id")
      .in("status", ["FINISHED", "CANCELLED"])
      .eq("is_settled", false);

    if (fetchErr) throw fetchErr;

    if (!unsettled || unsettled.length === 0) {
      return new Response(
        JSON.stringify({
          message: "No unsettled matches found",
          matches_settled: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`Found ${unsettled.length} unsettled matches`);

    // 2. Settle each match via RPC
    const results: Array<{
      match_id: string;
      bets_won: number;
      bets_lost: number;
      total_winnings: number;
    }> = [];

    for (const match of unsettled) {
      try {
        const { data, error } = await supabaseAdmin.rpc(
          "settle_match_bets",
          { p_match_id: match.id },
        );

        if (error) {
          console.error(`settle ${match.id} failed:`, error.message);
          continue;
        }

        if (data) {
          results.push(data);
          console.log(
            `Settled ${match.id}: ${data.bets_won} won, ${data.bets_lost} lost`,
          );
        }
      } catch (e) {
        console.error(`settle ${match.id} exception:`, e);
      }
    }

    // 3. Summary
    const summary = {
      matches_settled: results.length,
      bets_won: results.reduce((s, r) => s + (r.bets_won ?? 0), 0),
      bets_lost: results.reduce((s, r) => s + (r.bets_lost ?? 0), 0),
      total_winnings: results.reduce(
        (s, r) => s + (r.total_winnings ?? 0),
        0,
      ),
      details: results,
      timestamp: new Date().toISOString(),
    };

    console.log("Settlement summary:", JSON.stringify(summary));

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Settlement error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
