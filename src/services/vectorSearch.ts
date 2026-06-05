const EMBEDDING_MODEL = '@cf/baai/bge-m3';
const MAX_TEXT_LENGTH = 2000;
const DESCRIPTION_SLICE = 500;

export function prepareSearchText(title: string, description?: string | null): string {
  let text = title;
  if (description) {
    text += '\n' + description.slice(0, DESCRIPTION_SLICE);
  }
  return text.slice(0, MAX_TEXT_LENGTH);
}

export async function generateEmbedding(ai: Ai, text: string): Promise<number[]> {
  const result = await ai.run(EMBEDDING_MODEL, { text: [text] }) as { data: number[][] };
  return result.data[0];
}

export async function generateEmbeddings(ai: Ai, texts: string[]): Promise<number[][]> {
  const result = await ai.run(EMBEDDING_MODEL, { text: texts }) as { data: number[][] };
  return result.data;
}

export async function searchByVector(
  ai: Ai,
  vectorize: VectorizeIndex,
  query: string,
  topK: number = 100,
): Promise<number[]> {
  const queryVector = await generateEmbedding(ai, query);
  const results = await vectorize.query(queryVector, {
    topK,
    returnValues: false,
    returnMetadata: 'none',
  });
  return results.matches.map((match) => parseInt(match.id, 10));
}

export async function upsertJobVector(
  ai: Ai,
  vectorize: VectorizeIndex,
  jobId: number,
  title: string,
  description?: string | null,
): Promise<void> {
  const text = prepareSearchText(title, description);
  const vector = await generateEmbedding(ai, text);
  await vectorize.upsert([{ id: String(jobId), values: vector }]);
}

export async function deleteJobVectors(
  vectorize: VectorizeIndex,
  jobIds: number[],
): Promise<void> {
  if (jobIds.length === 0) return;
  await vectorize.deleteByIds(jobIds.map(String));
}
