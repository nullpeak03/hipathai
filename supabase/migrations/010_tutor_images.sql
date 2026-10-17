-- HiPath AI migration 010 — Supabase Storage bucket for tutor/quiz images
-- Run via Supabase Dashboard SQL Editor or `supabase db push`
--
-- Creates a public-read bucket `tutor-images` for storing learner-uploaded
-- screenshots (code errors, diagrams) and AI-generated diagram images.
-- Objects are stored under `{clerkId}/{randomId}.{ext}`.
-- Server routes generate signed upload URLs; the client PUTs directly to
-- Supabase Storage (never through Next.js, avoiding 6MB body limits).

insert into storage.buckets (id, name, public)
values ('tutor-images', 'tutor-images', true)
on conflict (id) do nothing;

-- Only authenticated users can upload to their own folder (matched on Clerk sub).
create policy if not exists tutor_images_upload_authenticated
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'tutor-images'
  and (storage.folder(name))[1] = (auth.jwt() ->> 'sub')
);

-- Allow public read (bucket is public).
create policy if not exists tutor_images_select_public
on storage.objects
for select
to public
using (bucket_id = 'tutor-images');

-- Allow owners to delete their own objects.
create policy if not exists tutor_images_delete_owner
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'tutor-images'
  and (storage.folder(name))[1] = (auth.jwt() ->> 'sub')
);
