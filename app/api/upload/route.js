import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/apiAuth';
import { resolveMarketFromRequest } from '@/lib/market';

function getUploadApiCopy(market) {
  if (market === 'de') {
    return {
      unauthorized: 'Keine Berechtigung',
      missingFile: 'Keine Datei',
      imageOnly: 'Nur Bilddateien sind erlaubt',
      fileTooLarge: 'Maximal 5 MB Dateigroesse erlaubt',
      serverConfigError: 'Server-Konfigurationsfehler',
      uploadFailed: 'Upload fehlgeschlagen',
      uploadError: 'Upload-Fehler',
    };
  }

  return {
    unauthorized: 'Nincs jogosultság',
    missingFile: 'Nincs fájl',
    imageOnly: 'Csak képfájlok engedélyezettek',
    fileTooLarge: 'Maximum 5MB méretű fájl engedélyezett',
    serverConfigError: 'Szerver konfigurációs hiba',
    uploadFailed: 'Feltöltés sikertelen',
    uploadError: 'Feltöltési hiba',
  };
}

export async function POST(request) {
  try {
    const requestMarket = resolveMarketFromRequest(request);
    const copy = getUploadApiCopy(requestMarket);
    // Verify authenticated user
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return NextResponse.json({ error: copy.unauthorized }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const userId = formData.get('userId') || authUser.uid;

    if (!file) {
      return NextResponse.json({ error: copy.missingFile }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: copy.imageOnly }, { status: 400 });
    }

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: copy.fileTooLarge }, { status: 400 });
    }

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

    if (!cloudName) {
      console.error('Cloudinary configuration missing');
      return NextResponse.json({ error: copy.serverConfigError }, { status: 500 });
    }

    // Upload to Cloudinary with unsigned upload preset
    const folder = formData.get('folder') || 'profiles';
    const allowedFolders = ['profiles', 'posts'];
    const uploadFolder = allowedFolders.includes(folder) ? folder : 'profiles';

    const uploadFormData = new FormData();
    uploadFormData.append('file', file);
    uploadFormData.append('upload_preset', 'pharmagister_profiles');
    uploadFormData.append('folder', uploadFolder);

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
        error: result.error?.message || copy.uploadFailed 
      }, { status: 500 });
    }

    return NextResponse.json({
      url: result.secure_url,
      publicId: result.public_id
    });

  } catch (error) {
    console.error('Upload error:', error);
    const copy = getUploadApiCopy(resolveMarketFromRequest(request));
    return NextResponse.json({ error: copy.uploadError }, { status: 500 });
  }
}
