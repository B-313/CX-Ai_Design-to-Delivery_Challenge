-- Enable pgvector for semantic retrieval
create extension if not exists vector;
create extension if not exists pgcrypto;

create table if not exists public.rag_documents (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  text text not null,
  embedding vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists rag_documents_embedding_idx
  on public.rag_documents
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists rag_documents_source_idx
  on public.rag_documents (source);

create or replace function public.match_rag_documents(
  query_embedding vector(1536),
  match_count int default 4,
  min_similarity float default 0.65
)
returns table (
  id uuid,
  source text,
  text text,
  similarity float
)
language sql
stable
as $$
  select
    d.id,
    d.source,
    d.text,
    1 - (d.embedding <=> query_embedding) as similarity
  from public.rag_documents d
  where d.embedding is not null
    and 1 - (d.embedding <=> query_embedding) >= min_similarity
  order by d.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

comment on function public.match_rag_documents(vector, int, float)
  is 'Semantic retrieval for RAG using cosine similarity over pgvector embeddings.';
