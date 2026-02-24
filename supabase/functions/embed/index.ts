import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMS = 768;

interface EmbeddingJob {
  product_id: string;
  input: string;
}

interface GeminiEmbeddingResponse {
  embedding: {
    values: number[];
  };
}

Deno.serve(async (req) => {
  try {
    const googleApiKey = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!googleApiKey) {
      return new Response(
        JSON.stringify({ error: "GOOGLE_AI_API_KEY not set" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { jobs } = (await req.json()) as { jobs: EmbeddingJob[] };

    if (!jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({ message: "No jobs to process" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    let processed = 0;
    let failed = 0;

    for (const job of jobs) {
      try {
        const text = job.input?.trim();
        if (!text) {
          console.warn(`Skipping product ${job.product_id}: empty input`);
          failed++;
          continue;
        }

        // Call Google Gemini Embedding API
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:embedContent?key=${googleApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: `models/${GEMINI_MODEL}`,
              content: { parts: [{ text }] },
              taskType: "RETRIEVAL_DOCUMENT",
              outputDimensionality: EMBEDDING_DIMS,
            }),
          }
        );

        if (!response.ok) {
          const errorBody = await response.text();
          console.error(
            `Gemini API error for product ${job.product_id}: ${response.status} ${errorBody}`
          );
          failed++;
          continue;
        }

        const data = (await response.json()) as GeminiEmbeddingResponse;
        const values = data.embedding?.values;

        if (!values || values.length !== EMBEDDING_DIMS) {
          console.error(
            `Unexpected embedding dimensions for product ${job.product_id}: got ${values?.length}, expected ${EMBEDDING_DIMS}`
          );
          failed++;
          continue;
        }

        // Store as pgvector string format: [0.1,0.2,...]
        const vectorString = `[${values.join(",")}]`;

        const { error: updateError } = await supabase
          .from("products")
          .update({ embedding: vectorString })
          .eq("id", job.product_id);

        if (updateError) {
          console.error(
            `DB update error for product ${job.product_id}:`,
            updateError
          );
          failed++;
          continue;
        }

        processed++;
      } catch (jobError) {
        console.error(`Error processing product ${job.product_id}:`, jobError);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({
        message: `Processed ${processed} embeddings, ${failed} failed`,
        processed,
        failed,
        total: jobs.length,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
