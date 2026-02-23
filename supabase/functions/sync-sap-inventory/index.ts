import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the user is authenticated
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: userError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch SAP data
    const sapResponse = await fetch("http://172.16.10.31/api/vwStockDestiny", {
      signal: AbortSignal.timeout(30000),
    });

    if (!sapResponse.ok) {
      return new Response(
        JSON.stringify({ error: "SAP API unavailable", status: sapResponse.status }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const sapData = await sapResponse.json();

    if (!Array.isArray(sapData)) {
      return new Response(
        JSON.stringify({ error: "Unexpected SAP response format" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const now = new Date().toISOString();
    const today = now.split("T")[0];

    const transformedData = sapData.map((item: any) => {
      let fechaFormatted = today;
      if (item.fecha) {
        try {
          const d = new Date(item.fecha);
          if (!isNaN(d.getTime())) {
            fechaFormatted = d.toISOString().split("T")[0];
          }
        } catch {
          // keep today
        }
      }

      return {
        pt_code: item.claveProducto || "",
        description: item.nombreProducto || "",
        stock: item.totalUnits ?? item.cantidad ?? 0,
        unit: item.uom || item.unidad || "MIL",
        gross_weight: item.pesoBruto ?? null,
        net_weight: item.pesoNeto ?? null,
        traceability: item.lote || "",
        bfx_order: item.po || null,
        pieces: item.cajas ?? null,
        pallet_type: "CASES",
        status: item.asignadoAentrega === true ? "assigned" : "available",
        fecha: fechaFormatted,
        raw_data: item,
        synced_at: now,
      };
    });

    // Clear existing sap_inventory
    const { error: deleteError } = await supabase
      .from("sap_inventory")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (deleteError) {
      console.error("Delete error:", deleteError);
      return new Response(
        JSON.stringify({ error: "Failed to clear inventory", details: deleteError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Insert in batches of 500
    const batchSize = 500;
    let insertedCount = 0;
    for (let i = 0; i < transformedData.length; i += batchSize) {
      const batch = transformedData.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from("sap_inventory")
        .insert(batch);

      if (insertError) {
        console.error("Insert error:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to insert inventory", details: insertError.message }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      insertedCount += batch.length;
    }

    return new Response(
      JSON.stringify({
        success: true,
        count: insertedCount,
        synced_at: now,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ error: "Internal error", message: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
