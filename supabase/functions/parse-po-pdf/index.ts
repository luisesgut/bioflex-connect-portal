import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParsedPOData {
  poNumber: string | null;
  poDate: string | null;
  itemNumber: string | null;
  productDescription: string | null;
  quantity: number | null;
  pricePerThousand: number | null;
  requestedDeliveryDate: string | null;
  customer: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return new Response(
        JSON.stringify({ success: false, error: 'No file uploaded' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing PDF:', file.name, 'Size:', file.size);

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Calling AI to extract PO data...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `You are a purchase order data extractor. Extract the following information from this purchase order PDF and return ONLY a valid JSON object (no markdown, no code blocks, just pure JSON):

{
  "poNumber": "the PO number/reference",
  "poDate": "the PO date in YYYY-MM-DD format",
  "itemNumber": "the item number or SKU code",
  "productDescription": "the product name/description",
  "quantity": numeric quantity (just the number, no commas),
  "pricePerThousand": numeric unit price (just the number),
  "requestedDeliveryDate": "the requested delivery date in YYYY-MM-DD format",
  "customer": "the customer/buyer name"
}

If a field cannot be found, use null. For dates, convert to YYYY-MM-DD format. For numbers, return just the numeric value without commas or currency symbols.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${base64}`
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to process PDF with AI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResponse = await response.json();
    console.log('AI Response:', JSON.stringify(aiResponse));

    const content = aiResponse.choices?.[0]?.message?.content;
    if (!content) {
      return new Response(
        JSON.stringify({ success: false, error: 'No response from AI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the JSON response - handle potential markdown code blocks
    let parsedData: ParsedPOData;
    try {
      // Remove markdown code blocks if present
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7);
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3);
      }
      jsonStr = jsonStr.trim();
      
      parsedData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', content);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to parse extracted data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Parsed PO data:', parsedData);

    return new Response(
      JSON.stringify({ success: true, data: parsedData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error processing PDF:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to process PDF';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
