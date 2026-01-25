import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const productLine = formData.get("productLine") as string;

    if (!file) {
      return new Response(
        JSON.stringify({ error: "No file provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Convert file to base64 using chunked approach to avoid stack overflow
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Chunk-based base64 encoding to avoid call stack issues with large files
    let base64 = "";
    const chunkSize = 32768; // 32KB chunks
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      base64 += String.fromCharCode.apply(null, Array.from(chunk));
    }
    base64 = btoa(base64);
    
    const mimeType = file.type || "application/pdf";

    // Build extraction prompt based on product line
    const extractionPrompt = buildExtractionPrompt(productLine);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a data extraction specialist for flexible packaging specifications. Extract data from technical spec sheets (TDS/FT) for bags, pouches, and films. All measurements in the source document are in INCHES unless otherwise specified. Extract them as-is in inches. Be precise with numbers.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: extractionPrompt
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64}`
                }
              }
            ]
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_product_specs",
              description: "Extract product specifications from the technical data sheet",
              parameters: {
                type: "object",
                properties: {
                  // Basic info
                  product_name: { type: "string", description: "Product/item description" },
                  customer: { type: "string", description: "Customer name" },
                  item_id_code: { type: "string", description: "Item ID or Destiny ID or customer item code" },
                  customer_item_code: { type: "string", description: "Customer's internal item number" },
                  
                  // Dimensions in inches
                  width_inches: { type: "number", description: "Width in inches" },
                  length_inches: { type: "number", description: "Length/Height in inches" },
                  gusset_inches: { type: "number", description: "Bottom gusset in inches" },
                  zipper_inches: { type: "number", description: "Zipper header size in inches" },
                  lip_front_inches: { type: "number", description: "Front lip size in inches" },
                  lip_back_inches: { type: "number", description: "Back lip size in inches" },
                  flip_size_inches: { type: "number", description: "Flip size in inches" },
                  
                  // Thickness
                  thickness_value: { type: "number", description: "Film thickness value" },
                  thickness_unit: { type: "string", enum: ["gauge", "microns"], description: "Unit of thickness" },
                  
                  // Film specs
                  film_type: { type: "string", description: "Film material type (LDPE, HDPE, LLDPE, etc.)" },
                  seal_type: { type: "string", description: "Seal type (Side, Bottom, etc.)" },
                  extrusion_type: { type: "string", description: "Extrusion type (Blown, Cast)" },
                  clarity_grade: { type: "string", description: "Clarity grade (Clear, High, etc.)" },
                  
                  // Vents
                  vents_count: { type: "integer", description: "Total number of vents" },
                  vent_size: { type: "string", description: "Vent hole size" },
                  vents_across: { type: "integer", description: "Vents across" },
                  vents_down: { type: "integer", description: "Vents down" },
                  
                  // Wicket specs
                  wicket_size: { type: "string", description: "Wicket size" },
                  wicket_hole: { type: "string", description: "Wicket hole size" },
                  bags_per_wicket: { type: "integer", description: "Bags per wicket" },
                  
                  // Packaging
                  bags_per_case: { type: "integer", description: "Bags per case" },
                  cases_per_pallet: { type: "integer", description: "Cases per pallet" },
                  pallet_size: { type: "string", description: "Pallet dimensions" },
                  box_color: { type: "string", description: "Box color" },
                  
                  // Print specs
                  pms_colors: { type: "array", items: { type: "string" }, description: "PMS color list" },
                  eye_mark: { type: "string", description: "Eye mark specification" },
                  upc_number: { type: "string", description: "UPC/barcode number" },
                  language: { type: "string", description: "Language(s) on packaging" },
                  country_of_origin: { type: "string", description: "Country of origin" },
                  
                  // Additional
                  notes: { type: "string", description: "Additional notes or specifications" }
                },
                required: ["product_name"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_product_specs" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "API credits exhausted. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Failed to process document" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    
    // Extract the tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "extract_product_specs") {
      return new Response(
        JSON.stringify({ error: "Failed to extract specifications" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const extractedData = JSON.parse(toolCall.function.arguments);
    
    // Convert inches to cm for internal use
    const convertedData = {
      ...extractedData,
      width_cm: extractedData.width_inches ? extractedData.width_inches * 2.54 : null,
      length_cm: extractedData.length_inches ? extractedData.length_inches * 2.54 : null,
      gusset_cm: extractedData.gusset_inches ? extractedData.gusset_inches * 2.54 : null,
      zipper_cm: extractedData.zipper_inches ? extractedData.zipper_inches * 2.54 : null,
      lip_front_cm: extractedData.lip_front_inches ? extractedData.lip_front_inches * 2.54 : null,
      lip_back_cm: extractedData.lip_back_inches ? extractedData.lip_back_inches * 2.54 : null,
      flip_size_cm: extractedData.flip_size_inches ? extractedData.flip_size_inches * 2.54 : null,
    };

    console.log("Extracted product specs:", convertedData);

    return new Response(
      JSON.stringify({ success: true, data: convertedData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error extracting product specs:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildExtractionPrompt(productLine: string): string {
  const basePrompt = `Extract ALL specifications from this technical data sheet. Look for:
- Product name/description and customer name
- Item ID codes, Destiny ID, customer item numbers
- All dimensions (width, length, height, gusset, zipper, lips, flips) - these are in INCHES
- Film thickness (gauge or microns)
- Film type (LDPE, HDPE, LLDPE, PET, etc.)
- Seal type and extrusion type
- Vent specifications (count, size, pattern)
- Packaging info (bags per case, cases per pallet, pallet size)
- Print colors (PMS colors)
- UPC/barcode, eye mark, language, country of origin
- Any additional notes or special requirements`;

  const productLineInstructions: Record<string, string> = {
    bag_no_wicket_zipper: `
This is a BAG WITHOUT WICKET OR ZIPPER. Focus on:
- Side seal specifications
- Vent patterns
- Bottom gusset if present`,
    bag_wicket: `
This is a WICKET BAG. Focus on:
- Wicket specifications (size, hole, bags per wicket)
- Chipboard info
- Wire specifications`,
    bag_zipper: `
This is a BAG WITH ZIPPER. Focus on:
- Zipper specifications (size, type)
- Header above zipper
- String or press-to-close type`,
    film: `
This is a FILM/ROLL product. Focus on:
- Web width and repeat
- Impressions per roll
- Rolls per pallet
- Core size and rewind specifications`,
    pouch: `
This is a POUCH (Stand Up Pouch). Focus on:
- Pouch dimensions
- Bottom gusset (fuelle)
- Zipper specifications
- Structure layers (PET, PE, etc.)`
  };

  return basePrompt + (productLineInstructions[productLine] || "");
}