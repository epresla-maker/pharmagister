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
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      console.error('Cloudinary configuration missing');
      return NextResponse.json({ error: 'Szerver konfigurációs hiba' }, { status: 500 });
    }

    // Generate signature for signed upload
    const timestamp = Math.round(Date.now() / 1000);
    const folder = 'profiles';
    
    // Build signature string (params must be alphabetically sorted)
    const signatureString = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
    
    // Create SHA-1 signature
    const encoder = new TextEncoder();
    const data = encoder.encode(signatureString);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Upload to Cloudinary with signed request
    const uploadFormData = new FormData();
    uploadFormData.append('file', file);
    uploadFormData.append('api_key', apiKey);
    uploadFormData.append('timestamp', timestamp.toString());
    uploadFormData.append('signature', signature);
    uploadFormData.append('folder', folder);

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
