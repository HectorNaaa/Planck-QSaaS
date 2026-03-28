-- Create storage bucket for digital twin images
INSERT INTO storage.buckets (id, name, public)
VALUES ('digital-twin-images', 'digital-twin-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload images
CREATE POLICY "Users can upload digital twin images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'digital-twin-images');

-- Allow authenticated users to update their own images
CREATE POLICY "Users can update own digital twin images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'digital-twin-images');

-- Allow authenticated users to delete their own images
CREATE POLICY "Users can delete own digital twin images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'digital-twin-images');

-- Allow public read access to images
CREATE POLICY "Public can view digital twin images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'digital-twin-images');
