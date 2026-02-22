import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/apiAuth';

export async function POST(request) {
  try {
    // Verify authenticated user
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Nincs jogosultság' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const userId = formData.get('userId') || authUser.uid;

    if (!file) {
      return NextResponse.json({ error: 'Nincs fájl' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Csak képfájlok engedélyezettek' }, { status: 400 });
    }

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Maximum 5MB méretű fájl engedélyezett' }, { status: 400 });
    }

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

    if (!cloudName) {
      console.error('Cloudinary configuration missing');
      return NextResponse.json({ error: 'Szerver konfigurációs hiba' }, { status: 500 });
    }

    // Upload to Cloudinary with unsigned upload preset
    const uploadFormData = new FormData();
    uploadFormData.append('file', file);
    uploadFormData.append('upload_preset', 'pharmagister_profiles');
    uploadFormData.append('folder', 'profiles');

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: 'POST',
        body: uploadFormData,
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error('Cloudinary upload error:', result);
      return NextResponse.json({ 
        error: result.error?.message || 'Feltöltés sikertelen' 
      }, { status: 500 });
    }

    return NextResponse.json({
      url: result.secure_url,
      publicId: result.public_id
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Feltöltési hiba' }, { status: 500 });
  }
}
