import { NextRequest, NextResponse } from 'next/server';
import { extractCourses } from '@/lib/openrouter';
import { createLogger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const logger = createLogger();

  try {
    const body = await request.json();
    const { image, prodi } = body;

    if (!image || typeof image !== 'string') {
      logger.logAppError('Image is required and must be a base64 string', 'VALIDATION');
      return NextResponse.json(
        { error: 'Image is required and must be a base64 string' },
        { status: 400 }
      );
    }

    logger.logUserInput({
      fileName: 'uploaded_image',
      fileSize: image.length,
      fileType: image.startsWith('data:image') ? image.split(';')[0].split(':')[1] : 'unknown',
      imageBase64Length: image.length,
      prodi,
    });

    const result = await extractCourses(image, prodi, logger.requestId);

    return NextResponse.json(result);
  } catch (error) {
    logger.logAppError(error, 'EXTRACT_API');
    console.error('Extract API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        courses: [],
      },
      { status: 500 }
    );
  }
}
