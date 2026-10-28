-- Make existing tutor-image objects private as well as future uploads.
update storage.buckets
set public = false
where id = 'tutor-images';

drop policy if exists tutor_images_select_public on storage.objects;
