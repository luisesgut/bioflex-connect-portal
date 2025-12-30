import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfBase64 } = await req.json();

    if (!pdfBase64) {
      return new Response(
        JSON.stringify({ success: false, error: 'PDF data is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Extracting PO data from PDF using AI...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a data extraction assistant that extracts purchase order information from PDF documents. Extract the following fields and return them in a structured format. Be precise with numbers and dates.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Extract the following information from this purchase order PDF:
1. PO Number (the main purchase order number, often labeled as "PO #" or "Customer PO" or "Destiny PO#")
2. PO Date (the date the PO was created, format: YYYY-MM-DD)
3. Requested Delivery Date (the date when delivery is requested, format: YYYY-MM-DD)
4. Item/Product Code (the vendor item number or product SKU)
5. Item ID Code (look for "ID#" followed by a code like "62036-11/61494-16NZ" - this is critical for matching)
6. Quantity (the order quantity as a number, e.g., 1250000 for 1,250,000)
7. Unit Price (price per thousand or per unit as a number)
8. Total Price (total order amount as a number)
9. Notes (any special instructions or notes from the PO)

Return the data as JSON with these exact field names:
{
  "po_number": "string",
  "po_date": "YYYY-MM-DD",
  "requested_delivery_date": "YYYY-MM-DD or null",
  "product_code": "string (vendor item number)",
  "item_id_code": "string (the ID# code if present)",
  "quantity": number,
  "unit_price": number or null,
  "total_price": number or null,
  "notes": "string or null"
}

Only return the JSON object, no other text.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${pdfBase64}`
                }
              }
            ]
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_po_data',
              description: 'Extract purchase order data from PDF',
              parameters: {
                type: 'object',
                properties: {
                  po_number: { type: 'string', description: 'Purchase order number' },
                  po_date: { type: 'string', description: 'PO date in YYYY-MM-DD format' },
                  requested_delivery_date: { type: 'string', description: 'Requested delivery date in YYYY-MM-DD format, or null' },
                  product_code: { type: 'string', description: 'Product code or vendor item number' },
                  item_id_code: { type: 'string', description: 'The ID# code from the label (e.g., 62036-11/61494-16NZ)' },
                  quantity: { type: 'number', description: 'Order quantity' },
                  unit_price: { type: 'number', description: 'Price per thousand or unit' },
                  total_price: { type: 'number', description: 'Total order price' },
                  notes: { type: 'string', description: 'Any special notes or instructions' }
                },
                required: ['po_number', 'product_code', 'quantity'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extract_po_data' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'AI credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to process PDF with AI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResponse = await response.json();
    console.log('AI response:', JSON.stringify(aiResponse));

    // Extract data from tool call response
    let extractedData = null;
    
    if (aiResponse.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments) {
      try {
        extractedData = JSON.parse(aiResponse.choices[0].message.tool_calls[0].function.arguments);
      } catch (e) {
        console.error('Failed to parse tool call arguments:', e);
      }
    }
    
    // Fallback: try to extract from content if tool call didn't work
    if (!extractedData && aiResponse.choices?.[0]?.message?.content) {
      const content = aiResponse.choices[0].message.content;
      // Try to find JSON in the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          extractedData = JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.error('Failed to parse JSON from content:', e);
        }
      }
    }

    if (!extractedData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Could not extract data from PDF. Please check the document format.' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Extracted PO data:', extractedData);

    return new Response(
      JSON.stringify({ success: true, data: extractedData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error extracting PO data:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
