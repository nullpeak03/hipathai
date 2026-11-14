-- Migration 027 — enforce size and MIME limits on the tutor image bucket.
--
-- `POST /api/upload/image` returns an advisory `maxBytes`, but the browser
-- PUTs straight to Supabase Storage, so only the bucket can enforce a limit.
-- Without this, a signed-in learner could fill the project's storage quota
-- with a 50 MB (project default) "image" of any type.
--
-- Apply via Supabase Dashboard SQL Editor or `supabase db push`.

update storage.buckets
   set file_size_limit = 5 * 1024 * 1024,
       allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
 where id = 'tutor-images';
