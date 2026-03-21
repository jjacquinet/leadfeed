import { NextRequest, NextResponse } from 'next/server';
import { listAttachments, uploadAttachment, deleteAttachment } from '@/lib/getsales';

export async function GET() {
  try {
    const attachments = await listAttachments();
    if (attachments.length > 0) {
      console.log('[attachments] sample item keys:', JSON.stringify(attachments[0], null, 2));
    }
    return NextResponse.json({ attachments });
  } catch (error) {
    console.error('[attachments] GET error:', error);
    return NextResponse.json({ error: 'Failed to list attachments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadAttachment(buffer, file.name, file.type);
    if (!result) {
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }

    const name =
      result.original_name || result.file_name || result.name || file.name;

    return NextResponse.json({
      uuid: result.uuid,
      name,
      payload: result.payload,
    });
  } catch (error) {
    console.error('[attachments] POST error:', error);
    return NextResponse.json({ error: 'Failed to upload attachment' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { uuid } = body as { uuid?: string };
    if (!uuid) {
      return NextResponse.json({ error: 'Missing uuid' }, { status: 400 });
    }
    const ok = await deleteAttachment(uuid);
    if (!ok) {
      return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[attachments] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete attachment' }, { status: 500 });
  }
}
